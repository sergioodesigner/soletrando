'use client';

import { speakerOf } from '@/lib/game/types';
import type { DialogueApi } from '@/lib/game/dialogue';

export interface Choice {
  label: string;
  onClick: () => void;
  tone?: 'green' | 'blue' | 'red' | 'plain';
}

interface Props {
  dialogue: Pick<DialogueApi, 'line' | 'shown' | 'status' | 'skip'>;
  /** Texto de espera quando não há fala. */
  idleHint?: string;
  choices?: Choice[];
  className?: string;
  'data-coach'?: string;
}

/** Balão de fala pixel: o texto aparece "digitando" na medida em que a voz fala. Toque para ler tudo de uma vez. */
export function DialogueBox({ dialogue, idleHint, choices, className = '', ...rest }: Props) {
  const { line, shown, status, skip } = dialogue;
  const who = line ? speakerOf(line.mascot) : null;
  const text = line?.text ?? idleHint ?? '';
  const visible = line ? text.slice(0, shown) : text;
  const hidden = line ? text.slice(shown) : '';

  return (
    <div className={`relative ${className}`} {...rest}>
      {/* a etiqueta fica fora do painel (o recorte pixel cortaria o que passa da borda) */}
      {who && (
        <span className="px-title absolute -top-3 left-3 z-10 bg-[#3b2a1a] text-[#fff4d6] text-[9px] px-2 py-1">
          {who.name}
        </span>
      )}
      <div
        role="status"
        aria-live="polite"
        onClick={skip}
        className="px-panel px-notch px-3 pt-4 pb-2.5 min-h-[88px] cursor-pointer select-none"
      >
        <p className="text-[18px] leading-snug">
          <span>{visible}</span>
          {status === 'waiting' ? <span className="px-caret">…</span> : null}
          <span className="invisible">{hidden}</span>
          {status === 'done' && <span className="px-caret ml-1 text-[#c2410c]">▼</span>}
        </p>
      </div>
      {choices && choices.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {choices.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick}
              className={`px-btn px-notch text-[16px] ${
                c.tone === 'green' ? 'px-btn-green' : c.tone === 'blue' ? 'px-btn-blue' : c.tone === 'red' ? 'px-btn-red' : 'px-btn-plain'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
