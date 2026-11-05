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
  for (const s of catalog.speakers) speakers[s.id] = { _nota: PERSONA[s.id] || `${s.name} (${s.kind})`, voice: null, extra: {} };
  fs.writeFileSync(VOICES, JSON.stringify({
    _ajuda: 'Preencha "voice" de cada personagem com um id de voz do modelo (null = voz padrão do modelo). "extra" é mesclado ao corpo da requisição (ex.: {"speed":1.0}).',
    default: { voice: null, extra: {} },
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
function isPlayable(buf) {
  if (!buf || buf.length < 400) return false;
  if (buf.slice(0, 3).toString() === 'ID3') return true;                                  // MP3 com tag
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return true;                            // MP3 frame sync
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE') return true; // WAV
  if (buf.slice(0, 4).toString() === 'OggS') return true;                                  // OGG
  return false;
}
const extOf = (buf) => (buf.slice(0, 4).toString() === 'RIFF' ? 'wav' : buf.slice(0, 4).toString() === 'OggS' ? 'ogg' : 'mp3');
const fileFor = (e) => {
  for (const ext of ['mp3', 'wav', 'ogg']) {
    const f = path.join(OUT, e.speaker, `${e.id}.${ext}`);
    if (fs.existsSync(f) && isPlayable(fs.readFileSync(f))) return f;
  }
  return null;
};

async function synth(e) {
  const { voice, extra } = voiceFor(e.speaker);
  const body = { model: MODEL, input: e.say, response_format: 'mp3', ...(voice ? { voice } : {}), ...extra };
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
        throw err;
      }
      let buf = Buffer.from(await res.arrayBuffer());
      if (ct.includes('json') && !isPlayable(buf)) throw Object.assign(new Error(`Resposta JSON sem áudio: ${buf.toString('utf8').slice(0, 300)}`), { status: 0, fatal: false });
      if (!isPlayable(buf) && (ct.includes('pcm') || ct.includes('octet'))) {
        const rate = String(args['pcm-rate'] || 24000);
        try {
          const tmp = path.join(OUT, '.tmp.pcm');
          fs.writeFileSync(tmp, buf);
          buf = execFileSync('ffmpeg', ['-v', 'error', '-f', 's16le', '-ar', rate, '-ac', '1', '-i', tmp, '-f', 'mp3', '-'], { maxBuffer: 64 * 1024 * 1024 });
          fs.rmSync(tmp, { force: true });
        } catch { /* sem ffmpeg: cai no erro abaixo */ }
      }
      if (!isPlayable(buf)) throw Object.assign(new Error(`Áudio inválido (content-type=${ct || '?'}, ${buf.length} bytes)`), { fatal: true });
      return buf;
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
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ version: Date.now().toString(36), model: MODEL, generatedAt: new Date().toISOString(), files, index }));
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

if (args.probe) {
  if (!KEY) { console.error('Informe --key=...'); process.exit(1); }
  fs.mkdirSync(path.join(OUT, '_probe'), { recursive: true });
  const seen = new Set();
  for (const e of entries.filter((x) => !SPEAKERS.length || SPEAKERS.includes(x.speaker))) {
    if (seen.has(e.speaker)) continue;
    seen.add(e.speaker);
    const v = voiceFor(e.speaker);
    process.stdout.write(`[${e.speaker}] voz=${v.voice ?? '(padrão)'} "${e.say.slice(0, 50)}" … `);
    try { const b = await synth(e); const f = path.join(OUT, '_probe', `${e.speaker}.${extOf(b)}`); fs.writeFileSync(f, b); console.log(`ok (${Math.round(b.length / 1024)} KB) → ${path.relative(ROOT, f)}`); }
    catch (err) { console.log(`FALHOU: ${err.message}`); }
    await sleep(DELAY);
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

let done = 0, failed = [];
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
