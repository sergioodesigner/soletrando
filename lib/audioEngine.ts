// Unified Audio Engine: Offline-First Hybrid Audio Architecture
// Combines Pre-bundled Kore Audios, IndexedDB Persistence, and Tuned Natural Speech Synthesis

import { getCachedAudio, saveCachedAudio, getCachedAudioCount, clearCachedAudios } from './audioStorage';
import recordedManifest from './recordedAudioManifest.json';

// Brazilian Portuguese phonetic letter names (for device TTS — ElevenLabs falha em letras isoladas)
export const PT_LETTER_PHONETICS: Record<string, string> = {
  A: 'Á',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'É',
  F: 'Éfe',
  G: 'Gê',
  H: 'Agá',
  I: 'I',
  J: 'Jota',
  K: 'Cá',
  L: 'Éle',
  M: 'Ême',
  N: 'Êne',
  O: 'Ó',
  P: 'Pê',
  Q: 'Quê',
  R: 'Érre',
  S: 'Ésse',
  T: 'Tê',
  U: 'U',
  V: 'Vê',
  W: 'Dáblio',
  X: 'Xis',
  Y: 'Ípsilon',
  Z: 'Zê'
};

/** Só o toque na letra isolada usa voz do aparelho. “Próxima letra” continua com Bella. */
export function isLetterSpeechKey(staticKey?: string): boolean {
  if (!staticKey) return false;
  return staticKey.startsWith('letra_');
}

export function isIsolatedLetterText(text: string): boolean {
  const clean = text.trim();
  if (clean.length === 1 && /[A-Za-zÀ-ÿÁÉÍÓÚáéíóúÂÊÔâêôÃÕãõÇç]/.test(clean)) {
    return true;
  }
  const lower = clean.toLowerCase();
  return Object.values(PT_LETTER_PHONETICS).some((p) => p.toLowerCase() === lower);
}

// Comprehensive pre-recorded audio library (WAV & MP3 files)
// Includes all 26 letters, 10 counting numbers, all default words, clues, challenges, celebrations & math questions
export const RECORDED_AUDIO_MAP: Record<string, string> = {
  ...(recordedManifest as Record<string, string>),
};

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
  const clean = text.trim().toUpperCase();
  if (clean.length === 1 && PT_LETTER_PHONETICS[clean]) {
    return PT_LETTER_PHONETICS[clean];
  }
  return text;
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
    }, 60);
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
  onVoiceTypeUsed?: (type: 'kore_static' | 'kore_cached' | 'kore_api' | 'local_fallback' | 'local_letter') => void;
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
  const slugKey = staticKey || toAudioKey(cleanText);

  // Letras isoladas: voz sintetizada do aparelho (pt-BR).
  // ElevenLabs / áudios gravados costumam pronunciar letras de forma errada.
  const useDeviceLetterVoice =
    isLetterSpeechKey(staticKey) || isIsolatedLetterText(cleanText);

  if (useDeviceLetterVoice) {
    if (generation !== playGeneration) return;
    onVoiceTypeUsed?.('local_letter');
    speakTunedLocal(cleanText, soundEnabled, { slowerForLetter: true });
    return;
  }

  // 1. TIER 1: Check Pre-recorded Audio Library (Instant 0ms, 100% Offline, Natural Voice)
  const candidateKeys = [
    staticKey,
    slugKey,
    `proxima_letra_${slugKey}`,
    `palavra_${slugKey}`,
    `desafio_${slugKey}`,
    `pista_${slugKey}`,
    `completou_${slugKey}`,
    `contar_${slugKey}`,
    `math_pergunta_${slugKey}`,
    `math_dica_${slugKey}`,
  ].filter(Boolean) as string[];

  const hasBundledRecording = candidateKeys.some((key) => Boolean(RECORDED_AUDIO_MAP[key]));

  for (const key of candidateKeys) {
    if (generation !== playGeneration) return;
    if (RECORDED_AUDIO_MAP[key]) {
      try {
        const audioUrl = RECORDED_AUDIO_MAP[key];
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        audio.volume = 1;
        activeAudioElement = audio;
        audio.onended = () => {
          if (activeAudioElement === audio) activeAudioElement = null;
        };
        audio.onerror = () => {
          if (activeAudioElement === audio) activeAudioElement = null;
        };
        onVoiceTypeUsed?.('kore_static');
        await audio.play();
        if (generation !== playGeneration) {
          audio.pause();
          return;
        }
        return;
      } catch (err) {
        console.warn('Playback error for static audio:', key, err);
        // Continue to next candidate or tier
      }
    }
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

  // 3. TIER 3: Kore/Gemini API — só para textos sem gravação Bella.
  // Evita voz “sintética” + eco quando o MP3 falha e a API entra por cima.
  const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
  const isQuotaActive = Date.now() < ttsQuotaCooldownUntil;

  if (useKoreApi && isOnline && !isQuotaActive && !hasBundledRecording) {
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

  // 4. TIER 4: Local Optimized Web Speech Synthesis Fallback (Instant & 100% Offline)
  if (generation !== playGeneration) return;
  onVoiceTypeUsed?.('local_fallback');
  speakTunedLocal(cleanText, soundEnabled);
}

export { getCachedAudioCount, clearCachedAudios };

