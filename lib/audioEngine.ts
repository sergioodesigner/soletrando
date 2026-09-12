// Unified Audio Engine: Offline-First Hybrid Audio Architecture
// Combines Pre-bundled Kore Audios, IndexedDB Persistence, and Tuned Natural Speech Synthesis

import { getCachedAudio, saveCachedAudio, getCachedAudioCount, clearCachedAudios } from './audioStorage';
import recordedManifest from './recordedAudioManifest.json';

// Brazilian Portuguese phonetic letter names
export const PT_LETTER_PHONETICS: Record<string, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  E: 'E',
  F: 'F',
  G: 'G',
  H: 'H',
  I: 'I',
  J: 'J',
  K: 'K',
  L: 'L',
  M: 'M',
  N: 'N',
  O: 'O',
  P: 'P',
  Q: 'Q',
  R: 'R',
  S: 'S',
  T: 'T',
  U: 'U',
  V: 'V',
  W: 'W',
  X: 'X',
  Y: 'Y',
  Z: 'Z'
};

// Comprehensive pre-recorded audio library (WAV & MP3 files)
// Includes all 26 letters, 10 counting numbers, all default words, clues, challenges, celebrations & math questions
export const RECORDED_AUDIO_MAP: Record<string, string> = {
  // Pre-generated Kore WAVs (priority)
  'letra_b': '/audio/kore/letra_b.wav',
  'proxima_letra_a': '/audio/kore/proxima_letra_a.wav',
  'proxima_letra_b': '/audio/kore/proxima_letra_b.wav',
  'proxima_letra_n': '/audio/kore/proxima_letra_n.wav',
  'parabens_acertou': '/audio/kore/parabens_acertou.wav',
  'fase_9_11': '/audio/kore/fase_9_11.wav',
  // Pre-recorded Natural Brazilian Portuguese Voice Library (277+ files)
  ...(recordedManifest as Record<string, string>),
};

// Backwards compatibility alias
export const PREGENERATED_KORE_FILES: Record<string, string> = RECORDED_AUDIO_MAP;

// Clean Web Audio Synthesizer for instant tactile sound feedback
export function playSoundFx(type: 'correct' | 'wrong' | 'pop' | 'star' | 'shuffle') {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'shuffle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else if (type === 'star') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
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

// Speak locally with tuned pitch & rate for educational warmth
export function getFriendlyPhoneticText(text: string): string {
  const clean = text.trim().toUpperCase();
  if (clean.length === 1 && PT_LETTER_PHONETICS[clean]) {
    return PT_LETTER_PHONETICS[clean];
  }
  return text;
}

export function speakTunedLocal(text: string, enabled: boolean = true) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const voice = activeSelectedVoice || pickBestDefaultPtVoice();
    const spokenText = getFriendlyPhoneticText(text);
    const utterance = new SpeechSynthesisUtterance(spokenText);
    utterance.lang = 'pt-BR';
    utterance.rate = 0.88; // Slightly slower, clear pacing for kids
    utterance.pitch = 1.08; // Friendly, warm, slightly elevated pitch
    if (voice) {
      utterance.voice = voice;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // Graceful fallback
  }
}

// In-memory audio player reference
let activeAudioElement: HTMLAudioElement | null = null;

// Stop any active audio
export function stopAllAudio() {
  if (typeof window !== 'undefined') {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (activeAudioElement) {
      activeAudioElement.pause();
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
  onVoiceTypeUsed?: (type: 'kore_static' | 'kore_cached' | 'kore_api' | 'local_fallback') => void;
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

  stopAllAudio();

  const cleanText = text.trim();
  const slugKey = staticKey || toAudioKey(cleanText);

  // 1. TIER 1: Check Pre-recorded Audio Library (Instant 0ms, 100% Offline, Natural Voice)
  const candidateKeys = [
    staticKey,
    slugKey,
    `letra_${slugKey}`,
    `proxima_letra_${slugKey}`,
    `palavra_${slugKey}`,
    `desafio_${slugKey}`,
    `pista_${slugKey}`,
    `completou_${slugKey}`,
    `contar_${slugKey}`,
    `math_pergunta_${slugKey}`,
    `math_dica_${slugKey}`,
  ].filter(Boolean) as string[];

  for (const key of candidateKeys) {
    if (RECORDED_AUDIO_MAP[key]) {
      try {
        const audioUrl = RECORDED_AUDIO_MAP[key];
        const audio = new Audio(audioUrl);
        activeAudioElement = audio;
        audio.onended = () => {
          if (activeAudioElement === audio) activeAudioElement = null;
        };
        audio.onerror = () => {
          if (activeAudioElement === audio) activeAudioElement = null;
        };
        onVoiceTypeUsed?.('kore_static');
        await audio.play();
        return;
      } catch (err) {
        console.warn('Playback error for static audio:', key, err);
        // Continue to next candidate or tier
      }
    }
  }

  // 2. TIER 2: Check IndexedDB Persistent Cache
  try {
    const cachedDataUrl = await getCachedAudio(slugKey);
    if (cachedDataUrl) {
      const audio = new Audio(cachedDataUrl);
      activeAudioElement = audio;
      onVoiceTypeUsed?.('kore_cached');
      await audio.play();
      return;
    }
  } catch {
    // Continue to next tier
  }

  // 3. TIER 3: If Online, Kore API Enabled, and Quota is available
  const isOnline = typeof navigator !== 'undefined' ? (navigator.onLine ?? true) : true;
  const isQuotaActive = Date.now() < ttsQuotaCooldownUntil;

  if (useKoreApi && isOnline && !isQuotaActive) {
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
  onVoiceTypeUsed?.('local_fallback');
  speakTunedLocal(cleanText, soundEnabled);
}

export { getCachedAudioCount, clearCachedAudios };

