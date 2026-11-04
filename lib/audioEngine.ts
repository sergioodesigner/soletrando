// Unified Audio Engine: Offline-First Hybrid Audio Architecture
// Combines Pre-bundled Kore Audios, IndexedDB Persistence, and Tuned Natural Speech Synthesis

import { getCachedAudio, saveCachedAudio, getCachedAudioCount, clearCachedAudios } from './audioStorage';
import recordedManifest from './recordedAudioManifest.json';
import { isPiperReady, synthesizePiper } from './piperTts';

// Nomes das letras para TTS do aparelho (soletrar).
// Evitar Á/É/Ó — o sintetizador exagera o acento agudo (ex.: A de CASA virava “Á”).
export const PT_LETTER_PHONETICS: Record<string, string> = {
  A: 'A',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'E',
  F: 'efe',
  G: 'Gê',
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
  // "Tê" maiúsculo/agudo costuma soar como inglês "tea" ou alongar demais.
  T: 'tê',
  U: 'U',
  V: 'Vê',
  W: 'dáblio',
  // Minúsculo evita inglês "ex" / "eks".
  X: 'xis',
  Y: 'ípsilon',
  Z: 'Zê'
};

/** Só o toque na letra isolada (chave letra_*). "próxima letra" NÃO entra aqui. */
export function isLetterSpeechKey(staticKey?: string): boolean {
  if (!staticKey) return false;
  return /^letra_[a-z]$/i.test(staticKey);
}

export function isIsolatedLetterText(text: string): boolean {
  const clean = text.trim();
  if (clean.length === 1 && /[A-Za-zÀ-ÿÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç]/.test(clean)) {
    return true;
  }
  const lower = clean.toLowerCase();
  return Object.values(PT_LETTER_PHONETICS).some((p) => p.toLowerCase() === lower);
}

function letterKeyFromText(text: string): string | undefined {
  const clean = text.trim();
  if (clean.length === 1) {
    const upper = clean.toUpperCase();
    if (PT_LETTER_PHONETICS[upper]) return `letra_${upper.toLowerCase()}`;
  }
  const lower = clean.toLowerCase();
  for (const [letter, phonetic] of Object.entries(PT_LETTER_PHONETICS)) {
    if (phonetic.toLowerCase() === lower) return `letra_${letter.toLowerCase()}`;
  }
  return undefined;
}

// Comprehensive pre-recorded audio library (WAV & MP3 files)
// Includes all 26 letters, 10 counting numbers, all default words, clues, challenges, celebrations & math questions
const rawManifest = recordedManifest as Record<string, string>;
/** Versão do bundle — invalida cache HTTP de MP3 antigos (PCM inválido). */
export const AUDIO_CACHE_VERSION =
  rawManifest.__version || String(Object.keys(rawManifest).length);

export const RECORDED_AUDIO_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(rawManifest).filter(([key]) => key !== '__version')
);

// Backwards compatibility alias
export const PREGENERATED_KORE_FILES: Record<string, string> = RECORDED_AUDIO_MAP;

// Clean Web Audio Synthesizer for instant tactile sound feedback
let sharedAudioCtx: AudioContext | null = null;

function getFxAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

const PENTATONIC_CHIMES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

/** Sino pentatônico ao contar/tocar itens nas dicas (usa AudioContext compartilhado). */
export function playStarChime(index: number) {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getFxAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = PENTATONIC_CHIMES[index % PENTATONIC_CHIMES.length] || 659.25;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.33, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.22, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

/** Arpejo curto de vitória no mini-desafio. */
export function playWinSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getFxAudioContext();
    if (!ctx) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.4);
    });
  } catch {
    // Ignore
  }
}

export function playSoundFx(type: 'correct' | 'wrong' | 'pop' | 'star' | 'shuffle') {
  if (typeof window === 'undefined') return;
  try {
    const ctx = getFxAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Volumes baixos para não “ecoar” por cima da voz Bella / TTS
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, ctx.currentTime);
      gain.gain.setValueAtTime(0.045, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'shuffle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else if (type === 'star') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.08);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.07, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    }
  } catch {
    // Web Audio fallback
  }
}

// Local Speech Synthesis voice management
let activeSelectedVoice: SpeechSynthesisVoice | null = null;

export function getAvailablePtVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  const allVoices = window.speechSynthesis.getVoices();
  return allVoices.filter(v => v.lang.toLowerCase().startsWith('pt'));
}

export function setSelectedVoice(voice: SpeechSynthesisVoice | null) {
  activeSelectedVoice = voice;
}

export function pickBestDefaultPtVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // 1. Natural / Enhanced / Neural Brazilian Portuguese voices
  const naturalPtBr = voices.find(
    v => (v.lang === 'pt-BR' || v.lang === 'pt_BR') &&
         (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Francisca') || v.name.includes('Luciana') || v.name.includes('Felipe') || v.name.includes('Maria') || v.name.includes('Neural'))
  );
  if (naturalPtBr) return naturalPtBr;

  // 2. Any Brazilian Portuguese voice
  const anyPtBr = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
  if (anyPtBr) return anyPtBr;

  // 3. Any Portuguese voice
  return voices.find(v => v.lang.toLowerCase().startsWith('pt')) || null;
}

// In-memory audio player reference (antes de speakTunedLocal / stopAllAudio)
let activeAudioElement: HTMLAudioElement | null = null;
let playGeneration = 0;
let speakLocalTimer: ReturnType<typeof setTimeout> | null = null;

// Speak locally with tuned pitch & rate for educational warmth
export function getFriendlyPhoneticText(text: string): string {
  // Remove acentos do input (ex.: "Á" → "A") para não forçar agudo no TTS
  const clean = text
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (clean.length === 1 && PT_LETTER_PHONETICS[clean]) {
    return PT_LETTER_PHONETICS[clean];
  }
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function speakTunedLocal(
  text: string,
  enabled: boolean = true,
  opts: { slowerForLetter?: boolean } = {}
) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const voice = activeSelectedVoice || pickBestDefaultPtVoice();
    const spokenText = getFriendlyPhoneticText(text);
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'pt-BR';
    utterance.rate = opts.slowerForLetter ? 0.82 : 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    if (voice) {
      utterance.voice = voice;
    }

    // cancel() + speak() imediato causa eco/duplicação no Chrome/Safari
    window.speechSynthesis.cancel();
    if (speakLocalTimer) {
      clearTimeout(speakLocalTimer);
      speakLocalTimer = null;
    }
    // Delay mínimo — delays longos perdem o gesto do usuário no iOS e o áudio fica mudo
    speakLocalTimer = setTimeout(() => {
      speakLocalTimer = null;
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch {
        // ignore
      }
    }, 16);
  } catch {
    // Graceful fallback
  }
}

// Stop any active audio
export function stopAllAudio() {
  if (typeof window !== 'undefined') {
    if (speakLocalTimer) {
      clearTimeout(speakLocalTimer);
      speakLocalTimer = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioElement) {
      try {
        activeAudioElement.onended = null;
        activeAudioElement.onerror = null;
        activeAudioElement.pause();
        activeAudioElement.removeAttribute('src');
        activeAudioElement.load();
      } catch {
        // ignore
      }
      activeAudioElement = null;
    }
  }
}

// Slug generator for matching cached audio
export function toAudioKey(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

export interface PlayAudioOptions {
  staticKey?: string;
  useKoreApi?: boolean;
  soundEnabled?: boolean;
  onLoadingChange?: (loading: boolean) => void;
  onVoiceTypeUsed?: (
    type: 'kore_static' | 'kore_cached' | 'kore_api' | 'piper_local' | 'local_fallback' | 'local_letter'
  ) => void;
}

let ttsQuotaCooldownUntil = 0;

export function isTtsQuotaExhausted(): boolean {
  return Date.now() < ttsQuotaCooldownUntil;
}

export function resetTtsQuota(): void {
  ttsQuotaCooldownUntil = 0;
}

// Main Unified Speech & Audio Player
export async function playSmartAudio(
  text: string,
  options: PlayAudioOptions = {}
): Promise<void> {
  const {
    staticKey,
    useKoreApi = true,
    soundEnabled = true,
    onLoadingChange,
    onVoiceTypeUsed
  } = options;

  if (!soundEnabled || !text) return;

  const generation = ++playGeneration;
  stopAllAudio();

  const cleanText = text.trim();
  const normalizeKey = (key: string) =>
    key
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const slugKey = staticKey || toAudioKey(cleanText);
  const inferredLetterKey =
    (staticKey && isLetterSpeechKey(staticKey) ? staticKey : undefined) ||
    letterKeyFromText(cleanText);

  // 1. TIER 1: Pre-recorded library (inclui letra_*.mp3 quando existir)
  const candidateKeys = [
    staticKey,
    staticKey ? normalizeKey(staticKey) : undefined,
    inferredLetterKey,
    slugKey,
    normalizeKey(slugKey),
    `proxima_letra_${slugKey}`,
    `palavra_${slugKey}`,
    `desafio_${slugKey}`,
    `pista_${slugKey}`,
    `completou_${slugKey}`,
    `contar_${slugKey}`,
    `math_pergunta_${slugKey}`,
    `math_dica_${slugKey}`,
  ].filter(Boolean) as string[];

  // Dedup preserving order
  const uniqueKeys = [...new Set(candidateKeys)];

  let playedRecorded = false;
  for (const key of uniqueKeys) {
    if (generation !== playGeneration) return;
    const audioUrl = RECORDED_AUDIO_MAP[key];
    if (!audioUrl) continue;

    const played = await playRecordedUrl(audioUrl, generation, () => {
      onVoiceTypeUsed?.('kore_static');
    });
    if (played) {
      playedRecorded = true;
      if (generation !== playGeneration) return;
      return;
    }
  }

  // Fallback de letra: só se NÃO houver MP3 gravado
  const useDeviceLetterVoice =
    Boolean(inferredLetterKey) && !RECORDED_AUDIO_MAP[inferredLetterKey!];

  // Com a voz Faber (Piper local) pronta, a letra sem MP3 é falada por ela em vez da voz do aparelho.
  if (useDeviceLetterVoice && !isPiperReady()) {
    if (generation !== playGeneration) return;
    onVoiceTypeUsed?.('local_letter');
    speakTunedLocal(cleanText, soundEnabled, { slowerForLetter: true });
    return;
  }

  // 2. TIER 2: Check IndexedDB Persistent Cache
  try {
    if (generation !== playGeneration) return;
    const cachedDataUrl = await getCachedAudio(slugKey);
    if (cachedDataUrl) {
      const audio = new Audio(cachedDataUrl);
      audio.volume = 1;
      activeAudioElement = audio;
      onVoiceTypeUsed?.('kore_cached');
      await audio.play();
      if (generation !== playGeneration) {
        audio.pause();
        return;
      }
      return;
    }
  } catch {
    // Continue to next tier
  }

  // 3. TIER 3: Piper "faber" rodando no navegador (opt-in, grátis e offline depois de baixar o modelo)
  if (isPiperReady()) {
    try {
      if (generation !== playGeneration) return;
      onLoadingChange?.(true);
      const letter = inferredLetterKey ? inferredLetterKey.slice(-1).toUpperCase() : undefined;
      const spoken = letter && PT_LETTER_PHONETICS[letter] ? PT_LETTER_PHONETICS[letter] : cleanText;
      const wav = await synthesizePiper(spoken, { slow: Boolean(letter) });
      onLoadingChange?.(false);
      if (generation !== playGeneration) return;

      const dataUrl = await blobToDataUrl(wav);
      if (generation !== playGeneration) return;
      // Guarda no IndexedDB: da próxima vez toca na hora pelo TIER 2, sem sintetizar de novo
      saveCachedAudio(slugKey, cleanText, dataUrl).catch(() => {});

      const audio = new Audio(dataUrl);
      audio.volume = 1;
      activeAudioElement = audio;
      onVoiceTypeUsed?.('piper_local');
      await audio.play();
      return;
    } catch {
      onLoadingChange?.(false);
      if (generation !== playGeneration) return;
      // Falhou/expirou: segue para os próximos tiers
    }
  }

  // Letra sem MP3 e sem Piper: nunca vai para a API, usa a voz do aparelho
  if (useDeviceLetterVoice) {
    if (generation !== playGeneration) return;
    onVoiceTypeUsed?.('local_letter');
    speakTunedLocal(cleanText, soundEnabled, { slowerForLetter: true });
    return;
  }

  // 4. TIER 4: Kore/Gemini API — se MP3 do manifesto falhou ou não existe
  const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
  const isQuotaActive = Date.now() < ttsQuotaCooldownUntil;

  if (useKoreApi && isOnline && !isQuotaActive && !playedRecorded) {
    try {
      onLoadingChange?.(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          voice: 'Kore',
          model: 'gemini-3.1-flash-tts-preview'
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      onLoadingChange?.(false);

      if (generation !== playGeneration) return;

      if (res.ok) {
        const data = await res.json();
        if (data.isQuota) {
          // Pause API attempts for 5 minutes so children experience immediate speech with no lag
          ttsQuotaCooldownUntil = Date.now() + 5 * 60 * 1000;
        } else if (data.success && data.audio) {
          const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
          // Save to IndexedDB for permanent offline use
          saveCachedAudio(slugKey, cleanText, dataUrl).catch(() => {});

          const audio = new Audio(dataUrl);
          audio.volume = 1;
          activeAudioElement = audio;
          onVoiceTypeUsed?.('kore_api');
          await audio.play();
          return;
        }
      }
    } catch {
      onLoadingChange?.(false);
      // Seamlessly fall through to local fallback
    }
  }

  // 5. TIER 5: Local Optimized Web Speech Synthesis Fallback (Instant & 100% Offline)
  if (generation !== playGeneration) return;
  onVoiceTypeUsed?.('local_fallback');
  speakTunedLocal(cleanText, soundEnabled);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Toca URL gravada; retorna false se o browser não conseguir decodificar (ex.: cache de PCM antigo). */
function playRecordedUrl(
  audioUrl: string,
  generation: number,
  onStart?: () => void
): Promise<boolean> {
  return new Promise((resolve) => {
    if (generation !== playGeneration) {
      resolve(false);
      return;
    }

    const audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 1;
    let settled = false;

    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      audio.onerror = null;
      audio.onended = null;
      resolve(ok);
    };

    audio.onerror = () => {
      if (activeAudioElement === audio) activeAudioElement = null;
      finish(false);
    };

    audio.onended = () => {
      if (activeAudioElement === audio) activeAudioElement = null;
    };

    // Cache-bust: evita MP3 PCM inválido antigo no HTTP cache do browser
    const bust = audioUrl.includes('?')
      ? audioUrl
      : `${audioUrl}?v=${encodeURIComponent(AUDIO_CACHE_VERSION)}`;
    audio.src = bust;
    activeAudioElement = audio;
    onStart?.();

    audio
      .play()
      .then(() => {
        if (generation !== playGeneration) {
          audio.pause();
          finish(false);
          return;
        }
        finish(true);
      })
      .catch(() => {
        if (activeAudioElement === audio) activeAudioElement = null;
        finish(false);
      });
  });
}

export { getCachedAudioCount, clearCachedAudios };

