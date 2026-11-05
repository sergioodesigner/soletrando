// Piper TTS (voz pt_BR-faber-medium) rodando NO NAVEGADOR do usuário.
//
// - Inferência num Web Worker (public/piper/piper-worker.js): ONNX Runtime Web + espeak-ng WASM.
// - O modelo (~63 MB) é baixado uma única vez, de forma explícita (botão nas configurações),
//   e fica na Cache API do navegador — depois disso funciona offline.
// - Nada roda no servidor: é a mesma voz do tts-api (Piper faber), só que local.

import { useSyncExternalStore } from 'react';

const MODEL_BASE = (
  process.env.NEXT_PUBLIC_PIPER_MODEL_BASE ||
  'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium'
).replace(/\/+$/, '');

// Runtime WASM (versões fixadas — precisam bater com o worker). Para self-host, aponte
// NEXT_PUBLIC_PIPER_ORT_BASE / NEXT_PUBLIC_PIPER_PHONEMIZE_BASE para uma pasta sua (com "/" no fim).
const ORT_BASE =
  process.env.NEXT_PUBLIC_PIPER_ORT_BASE || 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/';
const PHONEMIZE_BASE =
  process.env.NEXT_PUBLIC_PIPER_PHONEMIZE_BASE ||
  'https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/';

const MODEL_URL = `${MODEL_BASE}/pt_BR-faber-medium.onnx`;
const CONFIG_URL = `${MODEL_BASE}/pt_BR-faber-medium.onnx.json`;
const MODEL_SIZE_BYTES = 63_201_294; // usado só como estimativa quando o servidor não manda Content-Length

// Precisa constar na lista de caches preservados em public/sw.js
export const PIPER_MODEL_CACHE = 'aprender-piper-model-v1';
const ENABLED_KEY = 'aprender_piper_enabled_v1';
const WORKER_URL = '/piper/piper-worker.js';

/**
 * Voz Faber (Piper) no navegador: EM STANDBY. O jogo usa as vozes pré-gravadas (scripts/voice).
 * Para reativar: NEXT_PUBLIC_ENABLE_PIPER=1 no ambiente de build.
 */
export const PIPER_ENABLED = process.env.NEXT_PUBLIC_ENABLE_PIPER === '1';

export type PiperStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error';

export interface PiperState {
  status: PiperStatus;
  /** Usuário ligou a voz Faber. */
  enabled: boolean;
  /** Modelo já está guardado no aparelho (dá para usar offline). */
  modelCached: boolean;
  /** 0..1 durante o download. */
  progress: number;
  error: string | null;
  /** Métricas da última fala (diagnóstico na tela de configurações). */
  lastStats: PiperStats | null;
}

export interface PiperStats {
  /** Tempo de síntese em ms. */
  ms: number;
  /** Duração do áudio gerado em ms. */
  audioMs: number;
  /** Pico bruto da saída do modelo (antes de normalizar). */
  peak: number;
}

export interface PiperPcm {
  pcm: Int16Array;
  sampleRate: number;
  stats: PiperStats;
}

const SERVER_STATE: PiperState = {
  status: 'idle',
  enabled: false,
  modelCached: false,
  progress: 0,
  error: null,
  lastStats: null,
};

let state: PiperState = SERVER_STATE;
const listeners = new Set<() => void>();

function setState(patch: Partial<PiperState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function getPiperState(): PiperState {
  return state;
}

export function subscribePiper(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Hook para a UI. */
export function usePiperState(): PiperState {
  return useSyncExternalStore(subscribePiper, getPiperState, () => SERVER_STATE);
}

export function isPiperSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof WebAssembly !== 'undefined' &&
    typeof caches !== 'undefined' &&
    typeof BigInt64Array !== 'undefined'
  );
}

export function isPiperReady(): boolean {
  return state.enabled && state.status === 'ready';
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

interface Pending {
  resolve: (v: { pcm: Int16Array; sampleRate: number; peak: number; ms: number }) => void;
  reject: (e: Error & { code?: string }) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const synthPending = new Map<number, Pending>();
const initPending = new Map<
  number,
  { resolve: () => void; reject: (e: Error & { code?: string }) => void }
>();

function makeError(message: string, code?: string): Error & { code?: string } {
  const e = new Error(message) as Error & { code?: string };
  e.code = code;
  return e;
}

function killWorker(reason: string) {
  if (worker) {
    worker.terminate();
    worker = null;
  }
  synthPending.forEach((p) => p.reject(makeError(reason, 'WORKER_STOPPED')));
  synthPending.clear();
  initPending.forEach((p) => p.reject(makeError(reason, 'WORKER_STOPPED')));
  initPending.clear();
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(WORKER_URL);
  w.onmessage = (e: MessageEvent) => {
    const m = e.data;
    if (!m) return;
    switch (m.type) {
      case 'progress': {
        const total = m.total || MODEL_SIZE_BYTES;
        setState({ status: 'downloading', progress: Math.min(1, m.loaded / total) });
        break;
      }
      case 'status':
        if (m.status === 'loading') setState({ status: state.status === 'downloading' ? 'downloading' : 'loading' });
        if (m.status === 'compiling') setState({ status: 'loading', progress: 1 });
        if (m.status === 'ready') {
          setState({ status: 'ready', modelCached: true, progress: 1, error: null });
          initPending.get(m.id)?.resolve();
          initPending.delete(m.id);
        }
        break;
      case 'done': {
        const p = synthPending.get(m.id);
        synthPending.delete(m.id);
        p?.resolve({ pcm: m.pcm, sampleRate: m.sampleRate, peak: m.peak ?? 0, ms: m.ms ?? 0 });
        break;
      }
      case 'error': {
        const err = makeError(m.message, m.code);
        const sp = synthPending.get(m.id);
        if (sp) {
          synthPending.delete(m.id);
          sp.reject(err);
          break;
        }
        const ip = initPending.get(m.id);
        if (ip) {
          initPending.delete(m.id);
          ip.reject(err);
        }
        break;
      }
    }
  };
  w.onerror = (e) => {
    const msg = e.message || 'Erro no worker da voz Faber.';
    killWorker(msg);
    setState({ status: 'error', error: msg });
  };
  worker = w;
  return w;
}

async function checkModelCached(): Promise<boolean> {
  try {
    const cache = await caches.open(PIPER_MODEL_CACHE);
    return Boolean(await cache.match(MODEL_URL)) && Boolean(await cache.match(CONFIG_URL));
  } catch {
    return false;
  }
}

function readEnabledFlag(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeEnabledFlag(on: boolean) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

function initWorker(allowDownload: boolean): Promise<void> {
  const id = nextId++;
  const w = getWorker();
  return new Promise<void>((resolve, reject) => {
    initPending.set(id, { resolve, reject });
    w.postMessage({
      type: 'init',
      id,
      config: {
        ortBase: ORT_BASE,
        phonemizeBase: PHONEMIZE_BASE,
        modelUrl: MODEL_URL,
        configUrl: CONFIG_URL,
        modelSize: MODEL_SIZE_BYTES,
        cacheName: PIPER_MODEL_CACHE,
        allowDownload,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

let booted = false;

/**
 * Chamar uma vez no cliente (ex.: useEffect do app). Se a voz estava ligada e o modelo
 * já está no aparelho, carrega em segundo plano — sem nenhuma chamada de rede para o modelo.
 */
export async function bootPiper(): Promise<void> {
  if (!PIPER_ENABLED || booted || !isPiperSupported()) return;
  booted = true;
  const enabled = readEnabledFlag();
  const cached = await checkModelCached();
  setState({ enabled: enabled && cached, modelCached: cached });
  if (enabled && cached) {
    setState({ status: 'loading' });
    try {
      await initWorker(false);
    } catch (e) {
      killWorker('init falhou');
      setState({ status: 'error', error: (e as Error).message });
    }
  } else if (enabled && !cached) {
    writeEnabledFlag(false); // cache foi limpo pelo navegador
  }
}

/** Liga a voz Faber; baixa o modelo (~63 MB) se ainda não estiver no aparelho. */
export async function enablePiper(): Promise<void> {
  if (!isPiperSupported()) {
    setState({ status: 'error', error: 'Este navegador não suporta a voz Faber local.' });
    return;
  }
  if (isPiperReady() || state.status === 'downloading' || state.status === 'loading') return;

  writeEnabledFlag(true);
  setState({ enabled: true, error: null, progress: 0, status: 'loading' });

  try {
    killWorker('reiniciando'); // garante estado limpo depois de erro anterior
    await initWorker(true);
    // pede ao navegador para não despejar o modelo quando faltar espaço
    navigator.storage?.persist?.().catch(() => {});
  } catch (e) {
    killWorker('init falhou');
    writeEnabledFlag(false);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    setState({
      enabled: false,
      status: 'error',
      error: offline
        ? 'Sem internet: conecte-se para baixar a voz Faber (só na primeira vez).'
        : (e as Error).message || 'Não foi possível baixar a voz Faber.',
    });
    setState({ modelCached: await checkModelCached() });
  }
}

/** Desliga (mantém o modelo guardado para religar sem baixar de novo). */
export function disablePiper(): void {
  writeEnabledFlag(false);
  killWorker('desligado');
  setState({ enabled: false, status: 'idle', progress: 0, error: null });
}

/** Apaga o modelo do aparelho. */
export async function removePiperModel(): Promise<void> {
  disablePiper();
  try {
    await caches.delete(PIPER_MODEL_CACHE);
  } catch {
    // ignore
  }
  setState({ modelCached: false });
}

/**
 * Sintetiza `text` com a voz Faber e devolve o PCM (Int16 mono). Rejeita (code 'NOT_READY') se a
 * voz não estiver pronta — quem chama deve cair no próximo tier de áudio.
 */
export async function synthesizePiperPcm(
  text: string,
  opts: { slow?: boolean; timeoutMs?: number } = {}
): Promise<PiperPcm> {
  if (!isPiperReady() || !worker) throw makeError('Voz Faber não está pronta.', 'NOT_READY');

  const id = nextId++;
  const w = worker;
  const result = await new Promise<{ pcm: Int16Array; sampleRate: number; peak: number; ms: number }>(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        if (synthPending.delete(id)) reject(makeError('Tempo esgotado na voz Faber.', 'TIMEOUT'));
      }, opts.timeoutMs ?? 25_000);
      synthPending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });
      w.postMessage({ type: 'synth', id, text, slow: Boolean(opts.slow) });
    }
  );

  const stats: PiperStats = {
    ms: result.ms,
    audioMs: Math.round((result.pcm.length / result.sampleRate) * 1000),
    peak: result.peak,
  };
  setState({ lastStats: stats });
  return { pcm: result.pcm, sampleRate: result.sampleRate, stats };
}

/** Igual a synthesizePiperPcm, mas devolve um WAV (para guardar no cache / tocar num <audio>). */
export async function synthesizePiper(
  text: string,
  opts: { slow?: boolean; timeoutMs?: number } = {}
): Promise<Blob> {
  const r = await synthesizePiperPcm(text, opts);
  return pcmToWavBlob(r.pcm, r.sampleRate);
}

export function pcmToWavBlob(pcm: Int16Array, sampleRate: number): Blob {
  const dataBytes = pcm.length * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  v.setUint32(4, 36 + dataBytes, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, dataBytes, true);
  new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}
