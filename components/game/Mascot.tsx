'use client';

import { useEffect, useState } from 'react';
import { MASCOTS, type MascotId } from '@/lib/game/types';

/** Humor = pose do personagem. (No Raposo "trophy" é o troféu; na Coruja é o ramo de oliveira; "read" = livro/pergaminho.) */
export type MascotMood = 'idle' | 'talk' | 'happy' | 'sad' | 'think' | 'trophy' | 'wave' | 'point' | 'read';

const POSES: MascotMood[] = ['idle', 'talk', 'happy', 'sad', 'think', 'trophy', 'wave', 'point', 'read'];
const src = (id: MascotId, pose: MascotMood) => `/game/${id}/${pose}.png`;

const preloaded = new Set<MascotId>();
function preload(id: MascotId) {
  if (preloaded.has(id) || typeof window === 'undefined') return;
  preloaded.add(id);
  POSES.forEach((p) => {
    const im = new Image();
    im.src = src(id, p);
  });
}

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

const MOTION: Record<MascotMood, string> = {
  idle: 'mascot-idle',
  talk: 'mascot-idle',
  happy: 'mascot-happy',
  sad: 'mascot-sad',
  think: 'mascot-think',
  trophy: 'mascot-idle',
  wave: 'mascot-idle',
  point: 'mascot-idle',
  read: 'mascot-idle',
};

/** Mascote em pixel art com poses. Falando: alterna boca aberta/fechada. */
export function Mascot({ id, mood = 'idle', size = 96, flip, dim, className = '', onClick, ...rest }: Props) {
  const m = MASCOTS[id];
  const [mouthOpen, setMouthOpen] = useState(false);

  useEffect(() => preload(id), [id]);

  useEffect(() => {
    if (mood !== 'talk') return;
    const t = setInterval(() => setMouthOpen((o) => !o), 190);
    return () => clearInterval(t);
  }, [mood]);

  const pose: MascotMood = mood === 'talk' ? (mouthOpen ? 'talk' : 'idle') : mood;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src(id, pose)}
      alt={m.name}
      draggable={false}
      className={`px-img select-none ${MOTION[mood]} ${dim ? 'opacity-70 saturate-50' : ''}`}
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
