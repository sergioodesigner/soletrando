import { useCallback, useEffect, useRef, useState } from 'react';
import { playSmartAudio, stopAllAudio } from '@/lib/audioEngine';
import { MASCOTS, type MascotId } from './types';

export interface DialogueLine {
  id: number;
  mascot: MascotId;
  text: string;
}

export type DialogueStatus = 'idle' | 'waiting' | 'typing' | 'done';

export interface SayOptions {
  mascot: MascotId;
  /** Chave de áudio gravado (se houver). */
  staticKey?: string;
  /** Frase única (ex.: gerada pelo Gemini): não usa o cache local. */
  ephemeral?: boolean;
  /** false = só mostra o texto digitando, sem voz. */
  voice?: boolean;
  /** Mostra o balão de texto (padrão: true). */
  bubble?: boolean;
}

export interface DialogueApi {
  line: DialogueLine | null;
  /** Quantos caracteres já foram "digitados". */
  shown: number;
  status: DialogueStatus;
  /** Fala e digita ao mesmo tempo. Resolve quando termina (ou quando é substituída por outra fala). */
  say: (text: string, opts: SayOptions) => Promise<void>;
  /** Mostra o texto todo na hora (toque no balão). */
  skip: () => void;
  /** Para a voz e esconde o balão. */
  stop: () => void;
}

interface Config {
  soundEnabled: boolean;
  /** Usa a voz Faber (Piper) quando estiver pronta, mesmo havendo MP3 gravado. */
  preferPiper: boolean;
}

/** Estimativa de duração quando a voz não informa (ex.: voz do aparelho): ~62 ms por caractere. */
const estimateMs = (text: string) => Math.max(900, text.length * 62 + 300);

/**
 * Sistema de diálogo do jogo: a mesma fala toca na voz do personagem E aparece no balão
 * "sendo digitada" no ritmo da voz (usa a duração real do áudio quando existe).
 */
export function useDialogue(config: Config): DialogueApi {
  const [line, setLine] = useState<DialogueLine | null>(null);
  const [shown, setShown] = useState(0);
  const [status, setStatus] = useState<DialogueStatus>('idle');

  const cfg = useRef(config);
  useEffect(() => {
    cfg.current = config;
  }, [config]);

  const idRef = useRef(0);
  const raf = useRef<number | null>(null);
  const finishers = useRef<(() => void) | null>(null);
  const skipFn = useRef<(() => void) | null>(null);

  const cancelTyping = () => {
    if (raf.current !== null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  };

  const say = useCallback((text: string, opts: SayOptions) => {
    // uma fala nova substitui a anterior
    finishers.current?.();
    cancelTyping();

    const id = ++idRef.current;
    const wantsVoice = (opts.voice ?? true) && cfg.current.soundEnabled;
    const showBubble = opts.bubble ?? true;

    return new Promise<void>((resolve) => {
      let typingStarted = false;
      let typingDone = false;
      let audioStarted = false;
      let audioEnded = false;
      let resolved = false;
      const timers: ReturnType<typeof setTimeout>[] = [];

      const isCurrent = () => idRef.current === id;
      const done = () => {
        if (resolved) return;
        resolved = true;
        timers.forEach(clearTimeout);
        if (finishers.current === done) finishers.current = null;
        resolve();
      };
      finishers.current = done;

      const maybeResolve = () => {
        if (typingDone && (audioEnded || !audioStarted)) done();
      };

      if (showBubble) {
        setLine({ id, mascot: opts.mascot, text });
        setShown(0);
        setStatus('waiting');
      }

      const startTyping = (durationMs?: number) => {
        if (typingStarted || !isCurrent()) return;
        typingStarted = true;
        if (!showBubble) {
          typingDone = true;
          maybeResolve();
          return;
        }
        setStatus('typing');
        // o texto termina um pouco antes da voz acabar, para o olho não ficar esperando
        const total = Math.max(500, (durationMs ?? estimateMs(text)) * 0.92);
        const t0 = performance.now();
        const tick = (now: number) => {
          if (!isCurrent()) return;
          const n = Math.min(text.length, Math.ceil(((now - t0) / total) * text.length));
          setShown(n);
          if (n >= text.length) {
            raf.current = null;
            setStatus('done');
            typingDone = true;
            maybeResolve();
            return;
          }
          raf.current = requestAnimationFrame(tick);
        };
        raf.current = requestAnimationFrame(tick);
      };

      skipFn.current = () => {
        if (!isCurrent() || typingDone) return;
        typingStarted = true;
        cancelTyping();
        if (showBubble) {
          setShown(text.length);
          setStatus('done');
        }
        typingDone = true;
        maybeResolve();
      };

      if (!wantsVoice) {
        startTyping();
      } else {
        // se a voz demorar (síntese do Piper) ou não tocar, o texto começa mesmo assim
        // Piper precisa sintetizar antes de tocar (pode levar ~1–2 s); voz do aparelho/MP3 começa quase na hora
        timers.push(setTimeout(() => startTyping(), cfg.current.preferPiper ? 2500 : 800));
        void playSmartAudio(text, {
          staticKey: opts.staticKey,
          ephemeral: opts.ephemeral,
          soundEnabled: true,
          useKoreApi: false,
          preferPiper: cfg.current.preferPiper,
          voiceRate: MASCOTS[opts.mascot].voiceRate,
          onPlaybackStart: (info) => {
            if (!isCurrent()) return;
            audioStarted = true;
            startTyping(info.durationMs);
          },
          onPlaybackEnd: () => {
            if (!isCurrent()) return;
            audioEnded = true;
            maybeResolve();
          },
        }).catch(() => {});
      }

      // segurança: nunca deixa uma fala "pendurada"
      timers.push(setTimeout(done, estimateMs(text) + 8000));
    });
  }, []);

  const skip = useCallback(() => {
    skipFn.current?.();
  }, []);

  const stop = useCallback(() => {
    idRef.current++;
    finishers.current?.();
    cancelTyping();
    stopAllAudio();
    setLine(null);
    setShown(0);
    setStatus('idle');
  }, []);

  useEffect(
    () => () => {
      idRef.current++;
      cancelTyping();
    },
    []
  );

  return { line, shown, status, say, skip, stop };
}
