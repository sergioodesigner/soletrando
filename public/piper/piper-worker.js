// Web Worker do Piper TTS (voz pt_BR-faber-medium) — roda 100% no navegador.
//
// Pipeline (igual ao Piper de servidor, só que em WASM):
//   texto -> piper_phonemize (espeak-ng, WASM) -> ids de fonemas -> VITS (.onnx) via onnxruntime-web -> PCM
//
// Worker "clássico" (importScripts) de propósito: não passa pelo bundler do Next
// e mantém a sessão ONNX carregada entre falas (carregar o modelo é a parte cara).
//
// Protocolo (main -> worker):
//   { type: 'init',  id, config }          carrega runtime + modelo (baixa se permitido)
//   { type: 'synth', id, text, slow }      sintetiza; só a última fala pendente é processada
// Protocolo (worker -> main):
//   { type: 'status',   id, status }                'loading' | 'ready'
//   { type: 'progress', id, loaded, total }         download do modelo
//   { type: 'done',     id, pcm, sampleRate }       Int16Array (buffer transferido)
//   { type: 'error',    id, message, code }

'use strict';

var cfg = null;
var ort = null;
var session = null;
var voice = null;
var initPromise = null;
var pending = null; // última fala aguardando (as anteriores são descartadas)
var busy = false;

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

function fail(id, err, code) {
  post({
    type: 'error',
    id: id,
    code: code || (err && err.code) || 'ERROR',
    message: String((err && err.message) || err),
  });
}

// ---------------------------------------------------------------------------
// Download com cache persistente (Cache API) — o modelo (~63 MB) baixa uma vez só
// ---------------------------------------------------------------------------

async function readAsset(url, opts) {
  var cache = await caches.open(cfg.cacheName);
  var hit = await cache.match(url);
  if (hit) return hit.arrayBuffer();

  if (!opts.allowNetwork) {
    var e = new Error('Modelo de voz ainda não baixado.');
    e.code = 'NOT_CACHED';
    throw e;
  }

  var res = await fetch(url);
  if (!res.ok) throw new Error('Falha ao baixar ' + url + ' (HTTP ' + res.status + ')');

  var total = Number(res.headers.get('Content-Length')) || opts.fallbackTotal || 0;
  var chunks = [];
  var loaded = 0;

  if (res.body && res.body.getReader) {
    var reader = res.body.getReader();
    for (;;) {
      var r = await reader.read();
      if (r.done) break;
      chunks.push(r.value);
      loaded += r.value.length;
      if (opts.onProgress) opts.onProgress(loaded, Math.max(total, loaded));
    }
  } else {
    var whole = new Uint8Array(await res.arrayBuffer());
    chunks.push(whole);
    loaded = whole.length;
    if (opts.onProgress) opts.onProgress(loaded, loaded);
  }

  var blob = new Blob(chunks, {
    type: res.headers.get('Content-Type') || 'application/octet-stream',
  });
  try {
    await cache.put(url, new Response(blob));
  } catch (err) {
    // cota cheia / modo privado: segue sem persistir
    console.warn('[piper] não consegui guardar no cache:', err);
  }
  return blob.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

async function doInit(id, config) {
  cfg = config;
  post({ type: 'status', id: id, status: 'loading' });

  if (!ort) {
    importScripts(cfg.ortBase + 'ort.wasm.min.js');
    ort = self.ort;
    ort.env.wasm.wasmPaths = cfg.ortBase;
    // Multi-thread exige cross-origin isolation (SharedArrayBuffer); sem isso, 1 thread.
    ort.env.wasm.numThreads = self.crossOriginIsolated
      ? Math.max(1, Math.min(4, self.navigator.hardwareConcurrency || 1))
      : 1;
    ort.env.wasm.proxy = false;
  }
  if (typeof self.createPiperPhonemize !== 'function') {
    importScripts(cfg.phonemizeBase + 'piper_phonemize.js');
  }

  var cfgBuf = await readAsset(cfg.configUrl, { allowNetwork: cfg.allowDownload });
  voice = JSON.parse(new TextDecoder().decode(cfgBuf));

  var onProgress = function (loaded, total) {
    post({ type: 'progress', id: id, loaded: loaded, total: total });
  };
  var modelBuf = await readAsset(cfg.modelUrl, {
    allowNetwork: cfg.allowDownload,
    fallbackTotal: cfg.modelSize,
    onProgress: onProgress,
  });

  post({ type: 'status', id: id, status: 'compiling' });
  session = await ort.InferenceSession.create(new Uint8Array(modelBuf), {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  });

  try {
    await synthesize('oi', false); // aquecimento: a 1ª inferência é bem mais lenta
  } catch (e) {
    console.warn('[piper] aquecimento falhou (segue mesmo assim):', e);
  }
}

function ensureInit(id, config) {
  if (session) return Promise.resolve();
  if (!initPromise) {
    initPromise = doInit(id, config).catch(function (err) {
      initPromise = null; // permite tentar de novo (ex.: depois de baixar o modelo)
      throw err;
    });
  }
  return initPromise;
}

// ---------------------------------------------------------------------------
// Síntese
// ---------------------------------------------------------------------------

// Fonemiza e devolve UMA lista de ids por sentença (o phonemize imprime uma linha por sentença).
async function phonemize(text) {
  var lines = [];
  var mod = await self.createPiperPhonemize({
    print: function (line) {
      try {
        var parsed = JSON.parse(line);
        if (parsed && parsed.phoneme_ids && parsed.phoneme_ids.length) lines.push(parsed.phoneme_ids);
      } catch (e) {
        /* linha que não é JSON */
      }
    },
    printErr: function (line) {
      console.warn('[piper-phonemize]', line);
    },
    locateFile: function (file) {
      if (file.endsWith('.wasm')) return cfg.phonemizeBase + 'piper_phonemize.wasm';
      if (file.endsWith('.data')) return cfg.phonemizeBase + 'piper_phonemize.data';
      return file;
    },
  });

  try {
    mod.callMain([
      '-l',
      voice.espeak.voice,
      '--input',
      JSON.stringify([{ text: text }]),
      '--espeak_data',
      '/espeak-ng-data',
    ]);
  } catch (e) {
    // emscripten lança ExitStatus ao terminar o main(); o que importa são as linhas já impressas
    if (!(e && (e.name === 'ExitStatus' || /exit/i.test(String(e.message))))) throw e;
  }
  return lines;
}

async function runSentence(phonemeIds, lengthScale) {
  var inf = voice.inference || {};
  var ids = BigInt64Array.from(phonemeIds, function (n) {
    return BigInt(n);
  });
  var feeds = {
    input: new ort.Tensor('int64', ids, [1, ids.length]),
    input_lengths: new ort.Tensor('int64', BigInt64Array.of(BigInt(ids.length)), [1]),
    scales: new ort.Tensor(
      'float32',
      Float32Array.of(
        inf.noise_scale != null ? inf.noise_scale : 0.667,
        lengthScale,
        inf.noise_w != null ? inf.noise_w : 0.8
      ),
      [3]
    ),
  };
  if (voice.speaker_id_map && Object.keys(voice.speaker_id_map).length) {
    feeds.sid = new ort.Tensor('int64', BigInt64Array.of(0n), [1]);
  }
  var out = await session.run(feeds);
  return out.output.data; // Float32Array
}

async function synthesize(text, slow) {
  var inf = voice.inference || {};
  var baseLength = inf.length_scale != null ? inf.length_scale : 1;
  var lengthScale = baseLength * (slow ? 1.2 : 1.05); // um pouco mais devagar: público infantil
  var sampleRate = (voice.audio && voice.audio.sample_rate) || 22050;

  var sentences = await phonemize(text);
  if (!sentences.length) throw new Error('Não consegui fonemizar o texto.');

  var parts = [];
  var total = 0;
  var gap = new Float32Array(Math.round(sampleRate * 0.22)); // silêncio entre sentenças
  for (var i = 0; i < sentences.length; i++) {
    var pcm = await runSentence(sentences[i], lengthScale);
    if (i > 0) {
      parts.push(gap);
      total += gap.length;
    }
    parts.push(pcm);
    total += pcm.length;
  }

  // O Piper oficial normaliza o pico do áudio (audio_float_to_int16). A saída crua do VITS costuma
  // ter pico baixo (~0.1–0.4): sem normalizar, a voz sai MUITO baixa. Aqui normalizamos para 0.95.
  var peak = 0;
  for (var q = 0; q < parts.length; q++) {
    var pp = parts[q];
    for (var m = 0; m < pp.length; m++) {
      var a = pp[m] < 0 ? -pp[m] : pp[m];
      if (a > peak) peak = a;
    }
  }
  var gain = 0.95 / Math.max(0.01, peak);

  var out = new Int16Array(total);
  var o = 0;
  for (var p = 0; p < parts.length; p++) {
    var part = parts[p];
    for (var k = 0; k < part.length; k++) {
      var s = part[k] * gain;
      out[o++] = s >= 1 ? 32767 : s <= -1 ? -32768 : (s * 32767) | 0;
    }
  }
  return { pcm: out, sampleRate: sampleRate, peak: peak };
}

async function drain() {
  if (busy) return;
  busy = true;
  try {
    while (pending) {
      var job = pending;
      pending = null;
      try {
        if (!session) throw Object.assign(new Error('Voz ainda não carregada.'), { code: 'NOT_READY' });
        var t0 = Date.now();
        var r = await synthesize(job.text, job.slow);
        post(
          { type: 'done', id: job.id, pcm: r.pcm, sampleRate: r.sampleRate, peak: r.peak, ms: Date.now() - t0 },
          [r.pcm.buffer]
        );
      } catch (err) {
        fail(job.id, err);
      }
    }
  } finally {
    busy = false;
  }
}

self.onmessage = function (e) {
  var msg = e.data || {};
  if (msg.type === 'init') {
    ensureInit(msg.id, msg.config)
      .then(function () {
        post({ type: 'status', id: msg.id, status: 'ready' });
      })
      .catch(function (err) {
        fail(msg.id, err);
      });
  } else if (msg.type === 'synth') {
    if (pending) fail(pending.id, new Error('Substituída por uma fala mais nova.'), 'SUPERSEDED');
    pending = { id: msg.id, text: String(msg.text || '').trim(), slow: !!msg.slow };
    if (!pending.text) {
      var j = pending;
      pending = null;
      fail(j.id, new Error('Texto vazio.'), 'EMPTY');
      return;
    }
    drain();
  }
};
