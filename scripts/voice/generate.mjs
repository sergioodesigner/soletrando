#!/usr/bin/env node
/**
 * Gerador de vozes do Soletrando (OpenRouter → heygen/heygen-voice-1-turbo:free).
 *
 *   npm run voice:generate -- --key=SUA_CHAVE            # gera tudo o que falta
 *   npm run voice:generate -- --key=... --probe          # testa 1 fala por personagem (confere as vozes)
 *   npm run voice:generate -- --key=... --group=letras   # só um grupo
 *   npm run voice:generate -- --redo=letra_g,letra_h     # refaz falas específicas (depois de ouvir o review.html)
 *   npm run voice:info                                    # mostra o que o OpenRouter diz sobre o modelo
 *
 * Sem dependências. Retoma de onde parou (pula o que já existe). Veja scripts/voice/README.md.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { estimateF0, suggestRate, STANDARD_RATES } from './pitch.mjs';

const ROOT = process.cwd();
const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, ...v] = a.slice(2).split('=');
    return [k, v.length ? v.join('=') : true];
  })
);

const KEY = args.key || process.env.OPENROUTER_API_KEY || '';
const MODEL = args.model || process.env.VOICE_MODEL || 'heygen/heygen-voice-1-turbo:free';
const BASE = (args['base-url'] || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const OUT = path.resolve(ROOT, args.out || 'public/audio/voice');
const DELAY = Number(args.delay ?? 1200);
const RETRIES = Number(args.retries ?? 6);
const FORMAT = String(args.format || 'pcm'); // o heygen devolve PCM (16-bit mono, sem cabeçalho)
const NO_TRIM = Boolean(args['no-trim']);
const NO_NORM = Boolean(args['no-normalize']);
const FORCE = Boolean(args.force);
const DRY = Boolean(args['dry-run']);
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const csv = (v) => (v && v !== true ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);
const REDO = csv(args.redo);
const ONLY = csv(args.only);
const GROUPS = csv(args.group);
const SKIP_GROUPS = csv(args['skip-group']);
const SPEAKERS = csv(args.speaker);

const VDIR = path.resolve(ROOT, 'scripts/voice');
const CATALOG = path.join(VDIR, 'catalog.json');
const VOICES = path.join(VDIR, 'voices.json');
const OVERRIDES = path.join(VDIR, 'overrides.json');
const EXTRA = path.join(VDIR, 'extra.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (f, fallback) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; }
};

// ---------------------------------------------------------------------------- hash (igual ao do jogo: lib/voice/ids.ts)
const normText = (t) => t.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
function fnv(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36).padStart(7, '0'); }
const textKey = (t) => 'h' + fnv(normText(t));
const voiceId = (sp, t) => `${sp}_${textKey(t)}`;
const speechFromTemplate = (t) => t.replace(/,\s*\{nome\}/g, '').replace(/\{nome\},\s*/g, '').replace(/\{nome\}/g, 'amigo').replace(/\s+([!?.,])/g, '$1').trim();

// ---------------------------------------------------------------------------- modos auxiliares
if (args.info) {
  const res = await fetch(`${BASE}/models`);
  if (!res.ok) { console.error(`HTTP ${res.status}`); process.exit(1); }
  const all = (await res.json()).data || [];
  const hit = all.filter((m) => m.id === MODEL || m.id.includes('heygen') || (m.architecture?.output_modalities || []).includes('speech') || (m.architecture?.output_modalities || []).includes('audio'));
  if (!hit.length) console.log(`Nenhum modelo de voz encontrado na lista pública (${all.length} modelos).`);
  for (const m of hit) console.log(JSON.stringify(m, null, 2));
  console.log('\nDica: a lista de vozes (campo "voice") do modelo costuma estar na página dele em openrouter.ai/' + MODEL.replace(':free', ''));
  process.exit(0);
}

// ---------------------------------------------------------------------------- catálogo
if (!fs.existsSync(CATALOG)) {
  console.error('scripts/voice/catalog.json não existe. Rode:  npm run voice:catalog');
  process.exit(1);
}
const catalog = readJson(CATALOG, null);
let entries = catalog.entries;

// falas extras (coladas das "Falas sem áudio" do jogo)
const extra = readJson(EXTRA, []);
for (const x of Array.isArray(extra) ? extra : []) {
  if (!x?.speaker || !x?.text) continue;
  const id = voiceId(x.speaker, x.text);
  if (entries.some((e) => e.id === id)) continue;
  entries.push({ id, label: x.label || `extra:${id.slice(-6)}`, group: x.group || 'extra', speaker: x.speaker, text: x.text, say: speechFromTemplate(x.text), aliases: x.aliases || [] });
}
// substituições do que é enviado à voz (corrigir pronúncia sem mexer no jogo)
const overrides = readJson(OVERRIDES, {});
entries = entries.map((e) => {
  const o = overrides[e.label] ?? overrides[e.id];
  return o ? { ...e, say: String(o) } : e;
});

// ---------------------------------------------------------------------------- vozes por personagem
const PERSONA = {
  fox: 'Rufo, o Raposo Letrado — curioso, alegre, voz jovem e animada',
  owl: 'Sofia, a Coruja — sábia, calma e carinhosa, voz feminina suave',
  borrao: 'Dragão Borrão — travesso, voz grave e brincalhona (nada assustadora)',
  hidra: 'Hidra das Contas — voz aguda, animada e engraçada',
};
if (!fs.existsSync(VOICES)) {
  const speakers = {};
  for (const s of catalog.speakers) speakers[s.id] = { _nota: PERSONA[s.id] || `${s.name} (${s.kind})`, voice: null, rate: 1, extra: {} };
  fs.writeFileSync(VOICES, JSON.stringify({
    _ajuda: 'Preencha "voice" de cada personagem. "rate" muda tom/velocidade ao tocar (0.9 = mais grave). "extra" é mesclado ao corpo da requisição. "pcmRate" = taxa do PCM do modelo (24000 é o padrão).',
    default: { voice: null, extra: {}, pcmRate: 24000 },
    speakers,
  }, null, 2));
  console.log(`Criei ${path.relative(ROOT, VOICES)} — preencha as vozes de cada personagem.`);
}
const voices = readJson(VOICES, { default: {}, speakers: {} });
const voiceFor = (sp) => {
  const v = voices.speakers?.[sp] || {};
  const d = voices.default || {};
  return { voice: v.voice ?? d.voice ?? null, extra: { ...(d.extra || {}), ...(v.extra || {}) } };
};

// ---------------------------------------------------------------------------- áudio
const hasContainer = (buf) =>
  buf.length > 12 && (
    buf.slice(0, 3).toString() === 'ID3' ||
    (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) ||
    (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE') ||
    buf.slice(0, 4).toString() === 'OggS');
const isPlayable = (buf) => !!buf && buf.length >= 400 && hasContainer(buf);
const extOf = (buf) => (buf.slice(0, 4).toString() === 'RIFF' ? 'wav' : buf.slice(0, 4).toString() === 'OggS' ? 'ogg' : 'mp3');
const fileFor = (e) => {
  for (const ext of ['mp3', 'wav', 'ogg']) {
    const f = path.join(OUT, e.speaker, `${e.id}.${ext}`);
    if (fs.existsSync(f) && isPlayable(fs.readFileSync(f))) return f;
  }
  return null;
};

/** Taxa de amostragem do PCM: --pcm-rate > voices.json (por personagem ou default) > 44100. */
const pcmRateFor = (sp) => Number(args['pcm-rate'] || voices.speakers?.[sp]?.pcmRate || voices.default?.pcmRate || 44100);

/** PCM 16-bit mono → WAV (reserva quando não há ffmpeg; arquivos maiores). */
function pcmToWav(pcm, rate) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

let ffmpegOk = null;
function haveFfmpeg() {
  if (ffmpegOk === null) {
    try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); ffmpegOk = true; } catch { ffmpegOk = false; }
    if (!ffmpegOk) console.warn('\n⚠ ffmpeg não encontrado: vou gravar WAV (funciona, mas os arquivos ficam ~6x maiores).\n  Instale o ffmpeg (brew install ffmpeg / apt install ffmpeg) para gerar MP3 compacto.\n');
  }
  return ffmpegOk;
}

/** Corta silêncio do começo/fim, nivela o volume e comprime em MP3 mono. */
function pcmToMp3(pcm, rate, keepTail = false) {
  const trim = 'silenceremove=start_periods=1:start_duration=0.01:start_threshold=-48dB:detection=peak';
  const filters = [];
  // falas muito curtas (letras): corta só o silêncio do COMEÇO e deixa folga no fim, para nunca perder o final
  if (!NO_TRIM) filters.push(...(keepTail ? [trim, 'apad=pad_dur=0.2'] : [trim, 'areverse', trim, 'areverse', 'apad=pad_dur=0.08']));
  if (!NO_NORM) filters.push('loudnorm=I=-18:TP=-2:LRA=9');
  const argv = ['-v', 'error', '-f', 's16le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0'];
  if (filters.length) argv.push('-af', filters.join(','));
  argv.push('-ar', '24000', '-ac', '1', '-b:a', '64k', '-f', 'mp3', 'pipe:1');
  return execFileSync('ffmpeg', argv, { input: pcm, maxBuffer: 64 * 1024 * 1024 });
}

async function synth(e, info = {}) {
  const { voice, extra } = voiceFor(e.speaker);
  const body = { model: MODEL, input: e.say, response_format: FORMAT, ...(voice ? { voice } : {}), ...extra };
  const rate = pcmRateFor(e.speaker);
  let lastErr;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}/audio/speech`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://soletrando.app', 'X-Title': 'Soletrando Voice Generator' },
        body: JSON.stringify(body),
      });
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) {
        const txt = (await res.text()).slice(0, 400);
        const err = new Error(`HTTP ${res.status}: ${txt}`);
        err.status = res.status;
        err.retryAfter = Number(res.headers.get('retry-after')) || 0;
        // limite DIÁRIO/cota esgotada: insistir não adianta — para já (o que foi gerado fica salvo)
        if (res.status === 429 && /day|daily|quota|credit|exceeded|limit.*(reset|tomorrow)/i.test(txt) && !/per.?minute|rpm/i.test(txt)) { err.dailyLimit = true; err.fatal = true; }
        throw err;
      }
      const raw = Buffer.from(await res.arrayBuffer());
      // erro em JSON/texto com status 200
      if (raw[0] === 0x7b || raw[0] === 0x3c || ct.includes('json') || ct.includes('text/')) {
        throw Object.assign(new Error(`Resposta sem áudio: ${raw.toString('utf8').slice(0, 300)}`), { status: 0 });
      }
      // já veio com cabeçalho (mp3/wav/ogg) e não é declarado PCM → usa como veio
      if (!ct.includes('pcm') && hasContainer(raw)) {
        if (!isPlayable(raw)) throw Object.assign(new Error('Áudio curto demais'), { fatal: true });
        return raw;
      }
      // PCM cru 16-bit mono
      const pcm = raw.length % 2 ? raw.subarray(0, raw.length - 1) : raw;
      if (pcm.length < rate * 2 * 0.08) throw Object.assign(new Error(`PCM curto demais (${pcm.length} bytes)`), { status: 0 });
      let peak = 0;
      for (let i = 0; i < pcm.length - 1; i += 2) { const v = Math.abs(pcm.readInt16LE(i)); if (v > peak) peak = v; if (peak > 400) break; }
      if (peak < 40) throw Object.assign(new Error('Áudio vazio (só silêncio)'), { status: 0 });
      if (info.onRaw) info.onRaw(pcm, rate);
      return haveFfmpeg() ? pcmToMp3(pcm, rate, e.group === 'letras') : pcmToWav(pcm, rate);
    } catch (err) {
      lastErr = err;
      const retryable = !err.fatal && (err.status === 429 || err.status >= 500 || err.status === undefined || err.status === 0);
      if (!retryable || attempt === RETRIES) break;
      const wait = Math.max(err.retryAfter * 1000, Math.min(60000, 2000 * 2 ** attempt));
      process.stdout.write(` (tentativa ${attempt + 1}/${RETRIES}: ${String(err.message).slice(0, 80)} — aguardando ${Math.round(wait / 1000)}s) `);
      await sleep(wait);
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------- seleção
function selected() {
  let list = entries;
  if (SPEAKERS.length) list = list.filter((e) => SPEAKERS.includes(e.speaker));
  if (GROUPS.length) list = list.filter((e) => GROUPS.includes(e.group));
  if (SKIP_GROUPS.length) list = list.filter((e) => !SKIP_GROUPS.includes(e.group));
  // --redo = nome exato (o que aparece no review.html); --only também aceita pedaço do nome
  if (REDO.length) list = list.filter((e) => REDO.some((o) => e.label === o || e.id === o));
  else if (ONLY.length) list = list.filter((e) => ONLY.some((o) => e.label === o || e.id === o || e.label.includes(o)));
  return list;
}

// ---------------------------------------------------------------------------- manifest + review
function writeManifest() {
  fs.mkdirSync(OUT, { recursive: true });
  const files = {};
  const index = {};
  let have = 0;
  for (const e of entries) {
    const f = fileFor(e);
    if (!f) continue;
    have++;
    const rel = path.relative(OUT, f).split(path.sep).join('/');
    files[e.id] = { s: e.speaker, t: e.text, f: rel, m: Math.floor(fs.statSync(f).mtimeMs / 1000).toString(36) };
    index[`${e.speaker}|${e.id.slice(e.speaker.length + 1)}`] = e.id;
    for (const a of e.aliases || []) index[`${e.speaker}|${a}`] = e.id;
  }
  // "rate" por personagem (voices.json): <1 mais grave/lento, >1 mais agudo/rápido — diferencia personagens que dividem a mesma voz
  const rates = {};
  for (const [sp, v] of Object.entries(voices.speakers || {})) if (v && typeof v.rate === 'number' && v.rate !== 1) rates[sp] = v.rate;
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ version: Date.now().toString(36), model: MODEL, generatedAt: new Date().toISOString(), rates, files, index }));
  // página de revisão (ouvir tudo e marcar o que refazer)
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const groups = {};
  for (const e of entries) (groups[e.group] ||= []).push(e);
  const rows = Object.entries(groups).map(([g, list]) => `<h2>${esc(g)} <small>(${list.length})</small></h2>` + list.map((e) => {
    const f = fileFor(e);
    const src = f ? path.relative(OUT, f).split(path.sep).join('/') : null;
    return `<div class="r"><label><input type="checkbox" data-l="${esc(e.label)}"> <b>${esc(e.speaker)}</b> <code>${esc(e.label)}</code></label><div class="t">${esc(e.say)}</div>${src ? `<audio controls preload="none" src="${esc(src)}"></audio>` : '<em>sem áudio ainda</em>'}</div>`;
  }).join('')).join('');
  fs.writeFileSync(path.join(OUT, 'review.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisão das vozes</title>
<style>body{font:16px system-ui;margin:16px;max-width:900px}h2{margin-top:28px;border-bottom:2px solid #ddd}.r{padding:8px 0;border-bottom:1px solid #eee}.t{color:#444;margin:2px 0 4px}audio{width:100%}#bar{position:sticky;top:0;background:#fff8e1;padding:8px;border:2px solid #f59e0b;z-index:5}code{background:#eee;padding:1px 4px}</style>
<div id="bar"><b id="n">0</b> marcadas para refazer · <button onclick="c()">Copiar comando</button><pre id="cmd" style="white-space:pre-wrap;margin:6px 0 0"></pre></div>${rows}
<script>function c(){const l=[...document.querySelectorAll('input:checked')].map(i=>i.dataset.l);const s='npm run voice:generate -- --redo='+l.join(',');cmd.textContent=s;navigator.clipboard&&navigator.clipboard.writeText(s)}
document.addEventListener('change',()=>{n.textContent=document.querySelectorAll('input:checked').length})</script>`);
  return have;
}

// ---------------------------------------------------------------------------- execução
const list = selected();
const todo = list.filter((e) => FORCE || REDO.length || !fileFor(e));

// ---------------------------------------------------------------------------- --probe-voices: ouvir cada VOZ do modelo
if (args['probe-voices']) {
  if (!KEY) { console.error('Informe --key=...'); process.exit(1); }
  const VD = path.join(OUT, '_probe', 'vozes');
  fs.mkdirSync(VD, { recursive: true });
  const assumed = voices.vozes || {};
  const ids = [...new Set([...Object.keys(assumed), ...Object.values(voices.speakers || {}).map((v) => v?.voice).filter(Boolean)])];
  const sample = 'Olá! Eu sou um dos personagens do jogo. Vamos aprender juntos?';
  console.log(`Gravando a mesma frase em ${ids.length} vozes → ${path.relative(ROOT, VD)}/\n`);
  const rows = [];
  for (const v of ids) {
    const sp = `__voz_${v}`;
    voices.speakers[sp] = { voice: v, genero: assumed[v] || 'm' };
    process.stdout.write(`[${v}] … `);
    try {
      let raw = null;
      const b = await synth({ speaker: sp, say: sample, id: sp, label: sp }, { onRaw: (pcm, rate) => (raw = { pcm, rate }) });
      fs.writeFileSync(path.join(VD, `${v}.${extOf(b)}`), b);
      const f0 = raw ? estimateF0(raw.pcm, raw.rate) : 0;
      const est = f0 ? (f0 > 165 ? 'f' : 'm') : '?';
      const flag = assumed[v] && est !== '?' && est !== assumed[v] ? '  ⚠ tom parece de voz ' + (est === 'f' ? 'FEMININA' : 'MASCULINA') + ` (assumi ${assumed[v] === 'f' ? 'feminina' : 'masculina'})` : '';
      console.log(`ok  tom ≈ ${f0 ? Math.round(f0) : '?'} Hz${flag}`);
      rows.push({ v, f0, assumed: assumed[v], est });
    } catch (err) { console.log(`FALHOU: ${String(err.message).slice(0, 200)}`); }
    await sleep(DELAY);
  }
  rows.sort((a, b) => a.f0 - b.f0);
  console.log('\nDo mais grave ao mais agudo:');
  for (const r of rows) console.log(`  ${String(r.f0 ? Math.round(r.f0) : '?').padStart(4)} Hz  ${r.v.padEnd(9)} (assumida ${r.assumed === 'f' ? 'feminina' : 'masculina'})`);
  console.log('\nOuça os arquivos para conferir. Se alguma voz estiver com o gênero trocado, corrija em "vozes" e no "genero" dos personagens que a usam (voices.json).');
  process.exit(0);
}

if (args.probe) {
  if (!KEY) { console.error('Informe --key=...'); process.exit(1); }
  const PDIR = path.join(OUT, '_probe');
  fs.mkdirSync(PDIR, { recursive: true });
  const seen = new Set();
  const found = []; // { speaker, gender, f0, rate, exact }
  const raws = {};
  for (const e of entries.filter((x) => !SPEAKERS.length || SPEAKERS.includes(x.speaker))) {
    if (seen.has(e.speaker)) continue;
    seen.add(e.speaker);
    const v = voiceFor(e.speaker);
    process.stdout.write(`[${e.speaker}] voz=${v.voice ?? '(padrão)'} "${e.say.slice(0, 50)}" … `);
    try {
      let raw = null;
      const b = await synth(e, { onRaw: (pcm, rate) => (raw = { pcm, rate }) });
      const f = path.join(PDIR, `${e.speaker}.${extOf(b)}`); fs.writeFileSync(f, b);
      console.log(`ok (${Math.round(b.length / 1024)} KB) → ${path.relative(ROOT, f)}`);
      if (raw) {
        const gender = voices.speakers?.[e.speaker]?.genero === 'f' ? 'f' : 'm';
        const f0 = estimateF0(raw.pcm, raw.rate);
        if (f0) { const s2 = suggestRate(f0, raw.rate, gender); found.push({ speaker: e.speaker, gender, f0, rate: raw.rate, exact: s2.exact }); console.log(`    tom ≈ ${Math.round(f0)} Hz a ${raw.rate} Hz (voz ${gender === 'f' ? 'feminina' : 'masculina'}) → taxa provável ≈ ${s2.exact} Hz`); }
        raws[e.speaker] = raw;
      }
    } catch (err) { console.log(`FALHOU: ${err.message}`); }
    await sleep(DELAY);
  }
  if (found.length) {
    // a taxa é UMA só para o modelo: combina as estimativas de todos os personagens (mediana)
    const exacts = found.map((x) => x.exact).sort((a, b) => a - b);
    const med = exacts[Math.floor(exacts.length / 2)];
    const rec = STANDARD_RATES.reduce((a, b) => (Math.abs(Math.log(b / med)) < Math.abs(Math.log(a / med)) ? b : a));
    const used = pcmRateFor(found[0].speaker);
    console.log(`\nTaxa do PCM: estimativas ${exacts.join(', ')} → mediana ≈ ${med} Hz → recomendada: ${rec} Hz (em uso: ${used} Hz)`);
    // candidatas gravadas para você escolher OUVINDO (a voz certa soa natural; taxa baixa demais = grossa e lenta)
    const cands = [...new Set([32000, 44100, 48000, rec])].sort((a, b) => a - b);
    const picks = [found.find((x) => x.gender === 'm'), found.find((x) => x.gender === 'f')].filter(Boolean);
    const TD = path.join(PDIR, 'teste-de-taxa');
    fs.mkdirSync(TD, { recursive: true });
    if (haveFfmpeg()) for (const pk of picks) for (const r of cands) fs.writeFileSync(path.join(TD, `${pk.speaker}_${r}Hz.mp3`), pcmToMp3(raws[pk.speaker].pcm, r));
    console.log(`Teste de taxa: ouça ${path.relative(ROOT, TD)}/ — a versão que soa NATURAL (nem grossa/lenta, nem fina/rápida) mostra a taxa certa.`);
    if (rec === used) console.log(`✔ A taxa em uso (${used} Hz) bate com a estimada. Ouça os arquivos de _probe/ para confirmar.`);
    else console.log(`⚠ A taxa em uso (${used} Hz) difere da estimada. Rode de novo com --fix-rate (grava ${rec} no voices.json) ou ajuste "pcmRate" à mão.`);
    if (args['fix-rate']) {
      const vj = readJson(VOICES, {}); vj.default = { ...(vj.default || {}), pcmRate: rec }; fs.writeFileSync(VOICES, JSON.stringify(vj, null, 2) + '\n');
      console.log(`voices.json atualizado: pcmRate = ${rec}`);
    }
  }
  process.exit(0);
}

console.log(`Modelo: ${MODEL}\nFalas no catálogo: ${entries.length} | selecionadas: ${list.length} | a gerar: ${Math.min(todo.length, LIMIT)} | saída: ${path.relative(ROOT, OUT)}`);
if (!DRY && !KEY) { console.error('\nFalta a chave. Use --key=SUA_CHAVE ou defina OPENROUTER_API_KEY.'); process.exit(1); }
if (DRY) {
  const chars = todo.reduce((n, e) => n + e.say.length, 0);
  const perSpeaker = {};
  todo.forEach((e) => (perSpeaker[e.speaker] = (perSpeaker[e.speaker] || 0) + 1));
  console.log(`(simulação) ${todo.length} falas, ${chars} caracteres.\nPor personagem:`, perSpeaker);
  process.exit(0);
}

let done = 0, failed = [], limited = 0;
const queue = todo.slice(0, LIMIT);
let stop = false;
process.on('SIGINT', () => { stop = true; console.log('\nInterrompido — salvando o que já foi gerado…'); });
for (const e of queue) {
  if (stop) break;
  const i = ++done;
  process.stdout.write(`[${i}/${queue.length}] ${e.speaker.padEnd(7)} ${e.label.slice(0, 42).padEnd(42)} `);
  try {
    const buf = await synth(e);
    const dir = path.join(OUT, e.speaker);
    fs.mkdirSync(dir, { recursive: true });
    for (const ext of ['mp3', 'wav', 'ogg']) fs.rmSync(path.join(dir, `${e.id}.${ext}`), { force: true });
    fs.writeFileSync(path.join(dir, `${e.id}.${extOf(buf)}`), buf);
    console.log(`ok ${Math.round(buf.length / 1024)} KB`);
  } catch (err) {
    console.log(`FALHOU: ${String(err.message).slice(0, 160)}`);
    failed.push({ label: e.label, id: e.id, error: String(err.message).slice(0, 300) });
    if (err.status === 401 || err.status === 403) { console.error('\nChave recusada. Confira a chave e o acesso ao modelo.'); break; }
    if (err.dailyLimit) { console.error('\n⏸ Limite diário/cota do OpenRouter atingido. Tudo o que foi gerado está salvo — rode o MESMO comando amanhã (ou depois de liberar mais cota) que ele continua de onde parou.'); break; }
    limited = err.status === 429 ? limited + 1 : 0;
    if (limited >= 3) { console.error('\n⏸ 3 falas seguidas barradas por limite de taxa. Parando para não desperdiçar tentativas — rode o mesmo comando daqui a pouco.'); break; }
  }
  if (queue.length > 1) await sleep(DELAY);
}

const have = writeManifest();
if (failed.length) fs.writeFileSync(path.join(VDIR, 'failed.json'), JSON.stringify(failed, null, 2));
else fs.rmSync(path.join(VDIR, 'failed.json'), { force: true });
console.log(`\nPronto: ${done - failed.length} gerados, ${failed.length} falharam. Manifest com ${have}/${entries.length} falas.`);
if (failed.length) console.log('Falhas em scripts/voice/failed.json — rode o mesmo comando de novo para tentar só as que faltam.');
console.log(`Ouça tudo em ${path.relative(ROOT, path.join(OUT, 'review.html'))}`);
process.exit(failed.length ? 2 : 0);
