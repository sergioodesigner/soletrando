'use client';

import { MASCOTS, type MascotId } from '@/lib/game/types';

export type MascotMood = 'idle' | 'talk' | 'happy' | 'sad' | 'think';

interface Props {
  id: MascotId;
  mood?: MascotMood;
  /** Altura em px. */
  size?: number;
  flip?: boolean;
  dim?: boolean;
  className?: string;
  onClick?: () => void;
  'data-coach'?: string;
}

/** Mascote em pixel art. As emoções são animações CSS (só temos uma pose por enquanto). */
export function Mascot({ id, mood = 'idle', size = 96, flip, dim, className = '', onClick, ...rest }: Props) {
  const m = MASCOTS[id];
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.img}
      alt={m.name}
      draggable={false}
      className={`px-img select-none mascot-${mood} ${dim ? 'opacity-70 saturate-50' : ''}`}
      style={{ height: size, width: 'auto', transform: flip ? 'scaleX(-1)' : undefined }}
    />
  );
  if (!onClick) return <div className={className} {...rest}>{img}</div>;
  return (
    <button type="button" onClick={onClick} className={`${className} block`} aria-label={`Falar com ${m.name}`} {...rest}>
      {img}
    </button>
  );
}
