import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { WORDS_WITH_CLUES, MATH_ITEMS, textToSlug } from './generate_recorded_audios.mjs';

const OUTPUT_DIR = path.resolve(process.cwd(), 'public/audio/recorded');
const TRACKER_FILE = path.resolve(process.cwd(), 'public/audio/recorded/.generated_audios.json');

// Áudio de referência de voz (cópia do arquivo com espaços no nome).
const DEFAULT_REF_AUDIO = path.resolve(process.cwd(), 'public/audio/recorded/voice_reference.mp3');
const LEGACY_REF_AUDIO = path.resolve(process.cwd(), 'public/audio/recorded/    .mp3');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const args = process.argv.slice(2).reduce((acc, arg) => {
  if (arg.startsWith('--')) {
    const [key, ...val] = arg.slice(2).split('=');
    acc[key] = val.join('=') || true;
  }
  return acc;
}, {});

const provider = (args.provider || process.env.TTS_PROVIDER || 'openrouter').toLowerCase();
const apiKey =
  args.key ||
  args.apiKey ||
  process.env.OPENROUTER_API_KEY ||
  process.env.TTS_API_KEY ||
  process.env.ELEVENLABS_API_KEY ||
  process.env.OPENAI_API_KEY;
const model =
  args.model ||
  (provider === 'openrouter' ? 'fish-audio/s2.1-pro-free:free' : 'eleven_multilingual_v2');
const voice = args.voice || (provider === 'openai' ? 'nova' : undefined);
const refAudioPath =
  args.refAudio ||
  args.referenceAudio ||
  (fs.existsSync(DEFAULT_REF_AUDIO)
    ? DEFAULT_REF_AUDIO
    : fs.existsSync(LEGACY_REF_AUDIO)
      ? LEGACY_REF_AUDIO
      : DEFAULT_REF_AUDIO);
const refText = args.refText || args.referenceText || '';
const force = Boolean(args.force);
const fixBroken = args.fixBroken !== 'false'; // por padrão, regenera MP3 inválidos (PCM salvo como .mp3)
const onlyRaw = args.only || args.keys || '';

/** Presets nomeados para regenerar grupos comuns. */
const ONLY_PRESETS = {
  // Letras/palavras com pronúncia problemática
  pronuncia: [
    'letra_h',
    'letra_t',
    'letra_x',
    'proxima_letra_h',
    'proxima_letra_t',
    'proxima_letra_x',
    'palavra_metafora',
    'desafio_metafora',
    'pista_metafora',
    'completou_metafora',
    'palavra_hipotese',
    'desafio_hipotese',
    'pista_hipotese',
    'completou_hipotese',
    'palavra_paradoxo',
    'desafio_paradoxo',
    'pista_paradoxo',
    'completou_paradoxo'
  ],
  letras_htx: ['letra_h', 'letra_t', 'letra_x', 'proxima_letra_h', 'proxima_letra_t', 'proxima_letra_x'],
  metafora: ['palavra_metafora', 'desafio_metafora', 'pista_metafora', 'completou_metafora'],
  hipotese: ['palavra_hipotese', 'desafio_hipotese', 'pista_hipotese', 'completou_hipotese'],
  paradoxo: ['palavra_paradoxo', 'desafio_paradoxo', 'pista_paradoxo', 'completou_paradoxo']
};

function resolveOnlyFilter(raw) {
  if (!raw || raw === true) return null;
  const parts = String(raw)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const patterns = [];
  for (const part of parts) {
    if (ONLY_PRESETS[part]) {
      patterns.push(...ONLY_PRESETS[part]);
    } else {
      patterns.push(part);
    }
  }
  return patterns;
}

const onlyPatterns = resolveOnlyFilter(onlyRaw);
// Com --only, regenera os selecionados mesmo que já existam (a menos que --noForceOnly)
const forceOnly = onlyPatterns && args.noForceOnly !== true && args.noForceOnly !== 'true';

function printUsageAndExit() {
  console.error('\n❌ ERRO: Nenhuma Chave de API foi informada.\n');
  console.error('Como usar (OpenRouter + Fish Audio com clonagem de voz):');
  console.error(
    '  npm run generate-audios -- --key=SUA_CHAVE_OPENROUTER --force\n'
  );
  console.error('Só os que precisam de correção de pronúncia:');
  console.error(
    '  npm run generate-audios -- --key=SUA_CHAVE --only=pronuncia\n'
  );
  console.error('Opções:');
  console.error('  --provider       openrouter | elevenlabs | openai (padrão: openrouter)');
  console.error('  --key            Sua API Key');
  console.error('  --model          padrão: fish-audio/s2.1-pro-free:free');
  console.error('  --refAudio       Áudio de referência (padrão: voice_reference.mp3)');
  console.error('  --refText        Transcrição do áudio de referência (opcional, recomendado)');
  console.error('  --force          Regera TODOS os áudios');
  console.error('  --only=LISTA     Regenera só as chaves/presets (separados por vírgula)');
  console.error('                   Presets: pronuncia | letras_htx | metafora | hipotese | paradoxo');
  console.error('                   Ex.: --only=pronuncia');
  console.error('                   Ex.: --only=letra_h,letra_x,palavra_paradoxo');
  console.error('                   Ex.: --only=metafora,hipotese (parcial / substring também vale)');
  console.error('  --fixBroken=false  Não regenera automaticamente arquivos PCM inválidos\n');
  console.error('IMPORTANTE: a OpenRouter retorna PCM por padrão. Este script força response_format=mp3');
  console.error('para o navegador conseguir tocar os arquivos.\n');
  process.exit(1);
}

if (!apiKey) printUsageAndExit();

/** Detecta MP3/WAV tocável no browser (rejeita PCM cru salvo como .mp3). */
function isPlayableAudioBuffer(buf) {
  if (!buf || buf.length < 12) return false;
  // WAV
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46) return true;
  // ID3 tag
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  // MPEG frame sync
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;
  // JSON error body accidentally saved
  const head = buf.slice(0, 32).toString('utf8').trimStart();
  if (head.startsWith('{') || head.startsWith('<')) return false;
  return false;
}

function isPlayableAudioFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  return isPlayableAudioBuffer(fs.readFileSync(filePath));
}

function looksLikePcm(buf) {
  if (!buf || buf.length < 64) return false;
  if (isPlayableAudioBuffer(buf)) return false;
  // PCM 16-bit little-endian tende a ter muitos bytes "baixos" alternados
  return true;
}

function pcmToMp3(pcmBuffer, sampleRate = 44100) {
  const tmpPcm = path.join(OUTPUT_DIR, `._tmp_${Date.now()}.pcm`);
  const tmpMp3 = path.join(OUTPUT_DIR, `._tmp_${Date.now()}.mp3`);
  try {
    fs.writeFileSync(tmpPcm, pcmBuffer);
    execFileSync(
      'ffmpeg',
      ['-y', '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', tmpPcm, '-b:a', '128k', tmpMp3],
      { stdio: 'ignore' }
    );
    const out = fs.readFileSync(tmpMp3);
    if (!isPlayableAudioBuffer(out)) {
      throw new Error('ffmpeg gerou arquivo inválido');
    }
    return out;
  } finally {
    for (const p of [tmpPcm, tmpMp3]) {
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

function mimeForRef(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.wav') return 'audio/wav';
  if (ext === '.ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

// Carrega áudio de referência para clonagem
let base64RefAudio = null;
if (fs.existsSync(refAudioPath)) {
  if (!isPlayableAudioFile(refAudioPath)) {
    console.error(
      `\n❌ Áudio de referência inválido (parece PCM/corrompido): ${refAudioPath}\n` +
        'Use um MP3 real, por exemplo voice_reference.mp3\n'
    );
    process.exit(1);
  }
  const audioBuffer = fs.readFileSync(refAudioPath);
  base64RefAudio = `data:${mimeForRef(refAudioPath)};base64,${audioBuffer.toString('base64')}`;
} else {
  console.warn(`\n⚠️  Áudio de referência não encontrado: ${refAudioPath}`);
  console.warn('A clonagem de voz ficará desativada.\n');
}

const PT_LETTER_NAMES = {
  A: 'A',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'E',
  F: 'efe',
  G: 'Gê',
  // Maiúsculo "Agá" vira "Á-ga"; minúsculo soa como o nome da letra em PT-BR.
  H: 'agá',
  I: 'I',
  J: 'jota',
  K: 'cá',
  L: 'ele',
  M: 'eme',
  N: 'ene',
  O: 'O',
  P: 'Pê',
  Q: 'quê',
  R: 'erre',
  S: 'esse',
  // "Tê" maiúsculo/agudo costuma soar como inglês "tea".
  T: 'tê',
  U: 'U',
  V: 'Vê',
  W: 'dáblio',
  // Minúsculo evita inglês "ex" / "eks".
  X: 'xis',
  Y: 'ípsilon',
  Z: 'Zê'
};

/** Forma falada com acento/respelling para o TTS (não altera a palavra do jogo). */
const SPEECH_WORD_FORMS = {
  METAFORA: 'Metáfora',
  HIPOTESE: 'Hipótese',
  // Força /ks/ em vez de X como "ch".
  PARADOXO: 'Paradóquiso',
  CONSCIENCIA: 'Consciência',
  RESILIENCIA: 'Resiliência',
  ATMOSFERA: 'Atmosfera'
};

function formatWordForSpeech(word) {
  const upper = String(word || '').trim().toUpperCase();
  if (SPEECH_WORD_FORMS[upper]) return SPEECH_WORD_FORMS[upper];
  const clean = String(word || '').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
}

const ITEMS_ALL = [
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `letra_${letter.toLowerCase()}`,
    text: phonetic
  })),
  ...Object.entries(PT_LETTER_NAMES).map(([letter, phonetic]) => ({
    key: `proxima_letra_${letter.toLowerCase()}`,
    text: `A próxima letra é ${phonetic}!`
  })),
  { key: 'contar_1', text: 'Um!' },
  { key: 'contar_2', text: 'Dois!' },
  { key: 'contar_3', text: 'Três!' },
  { key: 'contar_4', text: 'Quatro!' },
  { key: 'contar_5', text: 'Cinco!' },
  { key: 'contar_6', text: 'Seis!' },
  { key: 'contar_7', text: 'Sete!' },
  { key: 'contar_8', text: 'Oito!' },
  { key: 'contar_9', text: 'Nove!' },
  { key: 'contar_10', text: 'Dez!' },
  { key: 'parabens_acertou', text: 'Parabéns! Resposta correta!' },
  { key: 'tente_de_novo', text: 'Tente de novo! Você tem mais uma chance!' },
  { key: 'muito_bem', text: 'Muito bem!' },
  { key: 'excelente', text: 'Excelente!' },
  { key: 'fase_concluida', text: 'Parabéns, você concluiu a fase!' },
  { key: 'modo_letras', text: 'Modo Letras e Palavras!' },
  { key: 'modo_matematica', text: 'Modo Matemática!' },
  { key: 'fase_3_5', text: 'Fase 3 a 5 anos! Bem-vindos pequenos!' },
  { key: 'fase_6_8', text: 'Fase 6 a 8 anos! Vamos praticar!' },
  { key: 'fase_9_11', text: 'Fase 9 a 11 anos! Desafios incríveis!' },
  { key: 'fase_12_14', text: 'Fase 12 a 14 anos! Modo expert!' },
  // Feedbacks / dicas do sistema (antes só caíam no TTS online)
  { key: 'dica_brilho', text: 'Olha a letra brilhando!' },
  { key: 'dica_tipo_vogal', text: 'Dica: A próxima letra é uma vogal!' },
  { key: 'dica_tipo_consoante', text: 'Dica: A próxima letra é uma consoante!' },
  {
    key: 'dica_bloqueia_vogal',
    text: 'Dica: É uma vogal! As outras letras do tipo errado ficaram bloqueadas.'
  },
  {
    key: 'dica_bloqueia_consoante',
    text: 'Dica: É uma consoante! As outras letras do tipo errado ficaram bloqueadas.'
  },
  { key: 'dica_tracado_ok', text: 'Muito bem! Agora você sabe qual letra é. Encontre ela!' },
  { key: 'pula_palavra', text: 'Vamos tentar essa palavra de novo mais tarde!' },
  { key: 'dica_math_interativa', text: 'Vamos resolver juntos com um desafio divertido!' },
  { key: 'dica_math_ok', text: 'Muito bem! A resposta certa foi encontrada! Encontre ela nas opções!' },
  { key: 'math_dica_elimina', text: 'Dica: Essa resposta não está certa! Tente as outras.' },
  { key: 'math_dica2_elimina', text: 'Mais uma dica: Eliminei uma opção errada!' },
  { key: 'math_dica_paridade_par', text: 'Dica: A resposta é um número par!' },
  { key: 'math_dica_paridade_impar', text: 'Dica: A resposta é um número ímpar!' },
  { key: 'math_dica2_par', text: 'Mais uma dica: A resposta é par!' },
  { key: 'math_dica2_impar', text: 'Mais uma dica: A resposta é ímpar!' },
  ...WORDS_WITH_CLUES.flatMap((wObj) => {
    const w = wObj.word;
    const formatted = formatWordForSpeech(w);
    const slug = textToSlug(w);
    return [
      { key: `palavra_${slug}`, text: `A palavra é: ${formatted}!` },
      { key: `desafio_${slug}`, text: `Soletre a palavra: ${formatted}!` },
      { key: `pista_${slug}`, text: `Pista: ${wObj.clue}` },
      {
        key: `completou_${slug}`,
        text: `Muito bem! Você completou a palavra ${formatted}!`
      }
    ];
  }),
  ...MATH_ITEMS.flatMap((m) => [
    { key: `math_pergunta_${m.id}`, text: m.question },
    { key: `math_dica_${m.id}`, text: m.hint }
  ])
];

function matchesOnlyFilter(key, patterns) {
  const k = key.toLowerCase();
  return patterns.some((p) => {
    const pat = p.toLowerCase();
    return k === pat || k.includes(pat) || k.endsWith(`_${pat}`) || k.startsWith(`${pat}_`);
  });
}

const ALL_ITEMS = ITEMS_ALL;
const ITEMS = onlyPatterns
  ? ALL_ITEMS.filter((item) => matchesOnlyFilter(item.key, onlyPatterns))
  : ALL_ITEMS;

if (onlyPatterns && ITEMS.length === 0) {
  console.error('\n❌ --only não bateu com nenhum áudio.');
  console.error(`   Filtro: ${onlyPatterns.join(', ')}`);
  console.error('   Exemplos: --only=pronuncia | --only=letra_h,metafora,paradoxo\n');
  process.exit(1);
}

let completed = {};
if (fs.existsSync(TRACKER_FILE) && !force && !forceOnly) {
  try {
    completed = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    completed = {};
  }
} else if (fs.existsSync(TRACKER_FILE)) {
  // Mantém tracker existente; só força os itens selecionados
  try {
    completed = JSON.parse(fs.readFileSync(TRACKER_FILE, 'utf8'));
  } catch {
    completed = {};
  }
  if (forceOnly) {
    for (const item of ITEMS) delete completed[item.key];
  }
  if (force && !onlyPatterns) {
    completed = {};
  }
}

function saveTracker() {
  fs.writeFileSync(TRACKER_FILE, JSON.stringify(completed, null, 2), 'utf8');
}

async function fetchOpenRouter(text) {
  const url = 'https://openrouter.ai/api/v1/audio/speech';

  // CRÍTICO: sem response_format=mp3 a OpenRouter devolve PCM cru,
  // e o browser não consegue tocar o arquivo .mp3.
  const bodyPayload = {
    model,
    input: text,
    response_format: 'mp3'
  };

  if (voice) {
    bodyPayload.voice = voice;
  }

  if (base64RefAudio) {
    bodyPayload.input_references = [
      {
        type: 'input_audio',
        input_audio: {
          data: base64RefAudio
        }
      }
    ];
    if (refText) {
      bodyPayload.input_references.push({
        type: 'text',
        text: refText
      });
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://soletrando.app',
      'X-Title': 'Soletrando Audio Generator'
    },
    body: JSON.stringify(bodyPayload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API HTTP ${res.status}: ${errText}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  let buffer = Buffer.from(await res.arrayBuffer());

  if (isPlayableAudioBuffer(buffer)) {
    return buffer;
  }

  // Fallback: se ainda veio PCM, converte para MP3
  if (contentType.includes('pcm') || looksLikePcm(buffer)) {
    console.log('(PCM detectado → convertendo com ffmpeg)... ');
    // Fish/OpenRouter PCM costuma ser 44.1kHz ou 24kHz; tenta 44100 primeiro
    try {
      return pcmToMp3(buffer, 44100);
    } catch {
      return pcmToMp3(buffer, 24000);
    }
  }

  throw new Error(
    `Resposta sem áudio tocável (content-type=${contentType || 'desconhecido'}, ` +
      `${buffer.length} bytes). Cabeçalho: ${buffer.slice(0, 16).toString('hex')}`
  );
}

async function fetchElevenLabs(text) {
  const vId = voice || 'alloy';
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${vId}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      model_id: model,
      language_code: 'pt',
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.85,
        style: 0.1,
        use_speaker_boost: true
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs API HTTP ${res.status}: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isPlayableAudioBuffer(buffer)) {
    throw new Error('ElevenLabs retornou áudio inválido');
  }
  return buffer;
}

async function fetchOpenAI(text) {
  const url = 'https://api.openai.com/v1/audio/speech';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input: text,
      voice: voice || 'nova',
      response_format: 'mp3'
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI TTS API HTTP ${res.status}: ${errText}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!isPlayableAudioBuffer(buffer)) {
    throw new Error('OpenAI retornou áudio inválido');
  }
  return buffer;
}

async function generateAudio(text) {
  if (provider === 'openai') return fetchOpenAI(text);
  if (provider === 'elevenlabs') return fetchElevenLabs(text);
  return fetchOpenRouter(text);
}

function shouldSkip(item, filePath) {
  // --only regenera os selecionados por padrão
  if (force || forceOnly) return false;
  if (!fs.existsSync(filePath)) return false;
  if (fixBroken && !isPlayableAudioFile(filePath)) return false; // regenera PCM inválido
  if (completed[item.key] && isPlayableAudioFile(filePath)) return true;
  if (isPlayableAudioFile(filePath) && !force) return true;
  return false;
}

async function main() {
  const brokenCount = ITEMS.filter((item) => {
    const fp = path.join(OUTPUT_DIR, `${item.key}.mp3`);
    return fs.existsSync(fp) && !isPlayableAudioFile(fp);
  }).length;

  console.log(`\n🎙️  Gerador de Áudios em Lote (Voice Cloning) - Soletrando`);
  console.log(`--------------------------------------------------------`);
  console.log(`Provedor: ${provider.toUpperCase()}`);
  console.log(`Modelo:   ${model}`);
  console.log(`Formato:  mp3 (forçado — evita PCM ilegível no browser)`);
  if (base64RefAudio) {
    console.log(`Voz Ref.: ${path.basename(refAudioPath)} (clonagem ativa 🐟)`);
  } else {
    console.log(`Voz Ref.: (nenhuma)`);
  }
  console.log(`Destino:  ${OUTPUT_DIR}`);
  if (onlyPatterns) {
    console.log(`Filtro:   --only=${onlyRaw} → ${ITEMS.length} arquivo(s)`);
    console.log(`Chaves:   ${ITEMS.map((i) => i.key).join(', ')}`);
  } else {
    console.log(`Total:    ${ITEMS.length} itens`);
  }
  if (!onlyPatterns && brokenCount > 0) {
    console.log(`⚠️  ${brokenCount} arquivos existentes são PCM inválido e serão regenerados`);
  }
  if (force) console.log(`Modo:     --force (regenera tudo)`);
  if (forceOnly) console.log(`Modo:     regenerar seleção (--only)`);
  console.log('');

  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (let i = 0; i < ITEMS.length; i++) {
    const item = ITEMS[i];
    const filename = `${item.key}.mp3`;
    const filePath = path.join(OUTPUT_DIR, filename);

    if (shouldSkip(item, filePath)) {
      successCount++;
      skippedCount++;
      continue;
    }

    let attempts = 0;
    let ok = false;
    while (!ok && attempts < 3) {
      attempts++;
      try {
        process.stdout.write(`[${i + 1}/${ITEMS.length}] Gerando ${filename} ("${item.text}")... `);
        const buffer = await generateAudio(item.text);
        if (!isPlayableAudioBuffer(buffer)) {
          throw new Error('buffer final ainda não é MP3/WAV tocável');
        }
        fs.writeFileSync(filePath, buffer);
        completed[item.key] = {
          ok: true,
          bytes: buffer.length,
          model,
          at: new Date().toISOString()
        };
        saveTracker();
        successCount++;
        console.log(`✅ OK (${buffer.length} bytes)`);
        ok = true;
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.log(`❌ FALHA: ${err.message}`);
        if (err.message.includes('429')) {
          console.log('Aguardando 8s por rate limit...');
          await new Promise((r) => setTimeout(r, 8000));
        } else {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
    if (!ok) failCount++;
  }

  // Manifesto: com --only faz merge; sem filtro reconstrói a lista completa
  const manifestPath = path.resolve(process.cwd(), 'lib/recordedAudioManifest.json');
  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      manifest = {};
    }
  }
  manifest.__version = new Date().toISOString();

  const manifestSource = onlyPatterns ? ITEMS : ALL_ITEMS;
  for (const item of manifestSource) {
    const filename = `${item.key}.mp3`;
    const filePath = path.join(OUTPUT_DIR, filename);
    if (isPlayableAudioFile(filePath)) {
      manifest[item.key] = `/audio/recorded/${filename}`;
    }
  }
  if (!onlyPatterns) {
    const keep = new Set(['__version', ...ALL_ITEMS.map((i) => i.key)]);
    for (const key of Object.keys(manifest)) {
      if (!keep.has(key)) delete manifest[key];
      else if (key !== '__version') {
        const fp = path.join(OUTPUT_DIR, `${key}.mp3`);
        if (!isPlayableAudioFile(fp)) delete manifest[key];
      }
    }
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(
    `📜 Manifesto atualizado: ${Object.keys(manifest).length - 1} áudios → ${manifestPath}`
  );

  console.log(
    `\n✨ Concluído! ${successCount}/${ITEMS.length} ok` +
      (skippedCount ? ` (${skippedCount} já válidos)` : '') +
      (failCount ? ` | ${failCount} falhas` : '') +
      `\n`
  );

  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Erro fatal:', err.message);
  process.exit(1);
});
