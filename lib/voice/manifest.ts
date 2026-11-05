// Vozes pré-gravadas (geradas por scripts/voice/generate.mjs). Carrega o manifest uma vez e acha o
// arquivo certo para (personagem + texto/chave). Se não houver arquivo, o jogo cai nas outras vozes.

import { staticKeyId, textKey } from './ids';

interface VoiceManifest {
  version: string;
  model?: string;
  /** tom/velocidade por personagem (voices.json → rate) */
  rates?: Record<string, number>;
  files: Record<string, { s: string; t: string; f: string; m?: string }>;
  index: Record<string, string>;
}

const BASE = '/audio/voice/';
const MISSING_KEY = 'soletrando_voice_missing_v1';

let manifest: VoiceManifest | null = null;
let loading: Promise<VoiceManifest | null> | null = null;

/** Carrega o manifest (1x). O service worker guarda /audio/ para sempre, então a URL muda de hora em hora. */
export function loadVoiceManifest(): Promise<VoiceManifest | null> {
  if (manifest) return Promise.resolve(manifest);
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!loading) {
    const stamp = Math.floor(Date.now() / 3_600_000);
    loading = fetch(`${BASE}manifest.json?t=${stamp}`)
      .then((r) => (r.ok ? (r.json() as Promise<VoiceManifest>) : null))
      .then((m) => {
        manifest = m && m.files && m.index ? m : null;
        return manifest;
      })
      .catch(() => null)
      .finally(() => {
        if (!manifest) loading = null; // tenta de novo na próxima fala (ex.: estava offline)
      });
  }
  return loading;
}

export function voiceManifestInfo(): { loaded: boolean; count: number; model?: string } {
  return { loaded: manifest !== null, count: manifest ? Object.keys(manifest.files).length : 0, model: manifest?.model };
}

export interface VoiceQuery {
  speaker: string;
  /** Texto exato que está sendo falado (com o nome já trocado). */
  text: string;
  /** Chave do molde com {nome} (cenas/introdução). */
  audioKey?: string;
  /** Nome estático antigo (ex.: letra_b). */
  staticKey?: string;
}

/** Tom/velocidade ao tocar o personagem (1 = normal). Diferencia personagens que dividem a mesma voz. */
export function voiceRateFor(speaker: string): number {
  const r = manifest?.rates?.[speaker];
  return typeof r === 'number' && r > 0.5 && r < 2 ? r : 1;
}

/** URL do áudio pré-gravado, ou null. Só funciona depois de `loadVoiceManifest()`. */
export function findVoiceUrl(q: VoiceQuery): string | null {
  if (!manifest) return null;
  const tryKeys: string[] = [];
  if (q.audioKey) tryKeys.push(q.audioKey);
  tryKeys.push(textKey(q.text));
  if (q.staticKey) tryKeys.push(staticKeyId(q.staticKey));
  const trimmed = q.text.trim();
  if (trimmed.length === 1) tryKeys.push(textKey(trimmed.toUpperCase())); // letra solta ("b" → "B")
  for (const k of tryKeys) {
    const id = manifest.index[`${q.speaker}|${k}`];
    const f = id ? manifest.files[id] : null;
    if (f) return `${BASE}${f.f}${f.m ? `?m=${f.m}` : ''}`;
  }
  return null;
}

// ---------------------------------------------------------------------------- falas sem áudio
export interface MissingLine {
  speaker: string;
  text: string;
}

/** Guarda a fala que o jogo pediu e não tem áudio (só depois de existir algum áudio gerado). */
export function noteMissingVoice(q: VoiceQuery): void {
  if (!manifest || Object.keys(manifest.files).length === 0) return;
  const text = q.text.trim();
  if (!text) return;
  try {
    const list: MissingLine[] = JSON.parse(localStorage.getItem(MISSING_KEY) || '[]');
    if (list.some((m) => m.speaker === q.speaker && m.text === text)) return;
    list.push({ speaker: q.speaker, text });
    localStorage.setItem(MISSING_KEY, JSON.stringify(list.slice(-400)));
  } catch {
    // ignore
  }
}

export function getMissingVoices(): MissingLine[] {
  try {
    return JSON.parse(localStorage.getItem(MISSING_KEY) || '[]');
  } catch {
    return [];
  }
}

export function clearMissingVoices(): void {
  try {
    localStorage.removeItem(MISSING_KEY);
  } catch {
    // ignore
  }
}
