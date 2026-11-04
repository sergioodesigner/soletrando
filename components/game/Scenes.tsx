'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Mascot, type MascotMood } from './Mascot';
import { DialogueBox } from './DialogueBox';
import { IconBtn, SoundSettings } from './Hud';
import { fillName, sceneBg, type Line } from '@/lib/game/story';
import { memoryDeck, memoryPairs, type MemoryCard } from '@/lib/game/content';
import { speakerOf, type AgeId, type MascotId, type SpeakerId } from '@/lib/game/types';
import type { DialogueApi } from '@/lib/game/dialogue';

const PARK = { backgroundImage: 'url(/game/park.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' } as const;

/* ------------------------------------------------------------------ Retrato */

/**
 * Retrato de quem fala. Mascotes usam as poses; chefes usam a arte; NPCs usam /game/npcs/<id>.png
 * quando existir e, enquanto não existe, um emoji dentro de uma moldura pixel.
 */
export function Portrait({
  who, size = 120, talking = false, dim = false, mood,
}: { who: SpeakerId; size?: number; talking?: boolean; dim?: boolean; mood?: MascotMood }) {
  const def = speakerOf(who);
  const [failed, setFailed] = useState(false);

  if (def.kind === 'mascot') {
    return <Mascot id={who as MascotId} size={size} flip={who === 'owl'} dim={dim} mood={talking ? 'talk' : (mood ?? 'idle')} />;
  }
  if (def.kind === 'boss') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={def.img}
        alt={def.name}
        draggable={false}
        className={`px-img select-none ${talking ? 'mascot-talk' : 'mascot-idle'} ${dim ? 'opacity-70 saturate-50' : ''}`}
        style={{ height: size * 1.05, width: 'auto', maxWidth: 'none', flexShrink: 0 }}
      />
    );
  }
  const src = `/game/npcs/${who}.png`;
  return (
    <div className={`shrink-0 flex flex-col items-center ${dim ? 'opacity-70 saturate-50' : ''}`}>
      {failed ? (
        <div
          className={`px-panel px-notch flex items-center justify-center ${talking ? 'mascot-talk' : 'mascot-idle'}`}
          style={{ width: size * 0.8, height: size * 0.8, fontSize: size * 0.5 }}
          aria-label={def.name}
        >
          <span aria-hidden>{def.emoji}</span>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={def.name}
          draggable={false}
          onError={() => setFailed(true)}
          className={`px-img select-none ${talking ? 'mascot-talk' : 'mascot-idle'}`}
          style={{ height: size, width: 'auto', maxWidth: 'none', flexShrink: 0 }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Cena (história) */

interface SceneProps {
  title: string;
  /** Cenário da fase (nome do arquivo em /game/scenes). */
  scene?: string;
  /** Falas da cena, em ordem. */
  lines: Line[];
  npc: SpeakerId;
  mascot: MascotId;
  playerName: string;
  dialogue: DialogueApi;
  onDone: () => void;
  doneLabel: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSettings: () => void;
}

/** Cena curta antes/depois da fase: o personagem conta o problema (ou agradece) e o mascote responde. */
export function SceneScreen({ title, scene, lines, npc, mascot, playerName, dialogue, onDone, doneLabel, ...top }: SceneProps) {
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const cast = useMemo(() => {
    const ids = [npc, ...lines.map((l) => l.who).filter((w) => w !== npc && w !== mascot), mascot];
    return [...new Set(ids)];
  }, [npc, mascot, lines]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let k = 0; k < lines.length; k++) {
        if (cancelled) return;
        setI(k);
        await dialogue.say(fillName(lines[k].text, playerName), { mascot: lines[k].who });
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 650));
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
      dialogue.stop();
    };
    // roda uma vez ao entrar na cena
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const speaking = lines[i]?.who;
  const talking = dialogue.status === 'typing';

  return (
    <div className="game-root relative flex-1 min-h-0 overflow-hidden flex flex-col" style={sceneBg(scene)}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1033]/50 via-transparent to-[#1a1033]/70" />
      <div className="relative z-10 flex items-center gap-1.5 p-2">
        <p className="px-title text-[#fff4d6] text-[10px] [text-shadow:2px_2px_0_#3b2a1a] flex-1 pl-1">{title.toUpperCase()}</p>
        <SoundSettings {...top} />
        <button
          type="button"
          onClick={() => {
            dialogue.stop();
            onDone();
          }}
          className="px-btn px-btn-plain px-notch !min-h-[40px] text-[14px]"
        >
          Pular ▶▶
        </button>
      </div>
      <div className="relative z-10 flex-1 min-h-0 flex items-end justify-center gap-1 px-2">
        {cast.map((id) => (
          <Portrait key={id} who={id} size={cast.length > 2 ? 140 : 190} dim={speaking !== id} talking={speaking === id && talking} />
        ))}
      </div>
      <div className="relative z-10 px-3 pb-4 pt-2 mx-auto w-full max-w-md">
        <DialogueBox
          dialogue={dialogue}
          choices={done ? [{ label: doneLabel, onClick: onDone, tone: 'green' }] : undefined}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Jogo da Memória */

export interface MemoryResult {
  moves: number;
  pairs: number;
  perfect: boolean;
}

interface MemoryProps {
  subject: 'letras' | 'matematica';
  age: AgeId;
  mascot: MascotId;
  dialogue: DialogueApi;
  onFinish: (r: MemoryResult) => void;
  onBack: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSettings: () => void;
}

export function MemoryScreen({ subject, age, mascot, dialogue, onFinish, onBack, ...top }: MemoryProps) {
  const [deck] = useState<MemoryCard[]>(() => memoryDeck(subject, age));
  const pairs = memoryPairs(age);
  const [open, setOpen] = useState<string[]>([]);
  const [matched, setMatched] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [mood, setMood] = useState<MascotMood>('idle');
  const lock = useRef(false);
  const finished = useRef(false);

  useEffect(() => {
    void dialogue.say(
      subject === 'letras'
        ? 'Jogo da Memória! Ache a figura e a palavra que combinam.'
        : age === '3-5'
          ? 'Jogo da Memória! Ache o número e a quantidade que combinam.'
          : 'Jogo da Memória! Ache cada conta e o resultado dela.',
      { mascot }
    );
    return () => dialogue.stop();
    // só ao entrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = (id: string) => deck.find((c) => c.id === id) as MemoryCard;

  const flip = (card: MemoryCard) => {
    if (lock.current || open.includes(card.id) || matched.includes(card.pair)) return;
    const next = [...open, card.id];
    setOpen(next);
    void dialogue.say(card.say, { mascot, bubble: true });
    if (next.length < 2) return;

    lock.current = true;
    const nm = moves + 1;
    setMoves(nm);
    const [a, b] = next.map(byId);
    if (a.pair === b.pair) {
      setTimeout(() => {
        const m = [...matched, a.pair];
        setMatched(m);
        setOpen([]);
        lock.current = false;
        setMood('happy');
        setTimeout(() => setMood('idle'), 900);
        if (m.length === pairs && !finished.current) {
          finished.current = true;
          setTimeout(() => onFinish({ moves: nm, pairs, perfect: nm <= pairs + 1 }), 1100);
        }
      }, 700);
    } else {
      setTimeout(() => {
        setOpen([]);
        lock.current = false;
        setMood('sad');
        setTimeout(() => setMood('idle'), 700);
      }, 1000);
    }
  };

  const cols = deck.length <= 6 ? 3 : 4;

  return (
    <div className="game-root relative flex-1 min-h-0 flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/65" />
      <div className="relative z-10 flex items-center gap-1.5 p-2 mx-auto w-full max-w-md">
        <IconBtn label="Voltar" onClick={onBack}>
          <ArrowLeft size={20} />
        </IconBtn>
        <p className="px-title text-[#fff4d6] text-[10px] [text-shadow:2px_2px_0_#3b2a1a] flex-1 pl-1">JOGO DA MEMÓRIA</p>
        <span className="px-panel px-notch px-2 py-1 text-[15px] font-bold">Jogadas: {moves}</span>
        <SoundSettings {...top} />
      </div>

      <div className="relative z-10 px-2 flex items-end gap-2 mx-auto w-full max-w-md">
        <Mascot id={mascot} size={84} flip={mascot === 'owl'} mood={dialogue.status === 'typing' ? 'talk' : mood} className="shrink-0" />
        <DialogueBox dialogue={dialogue} className="flex-1" idleHint="Toque em duas cartas!" />
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto p-3">
        <div data-coach="memory-grid" className="mx-auto max-w-sm grid gap-2.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {deck.map((c) => {
            const isUp = open.includes(c.id) || matched.includes(c.pair);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => flip(c)}
                aria-label={isUp ? c.say : 'Carta virada para baixo'}
                className={`px-notch aspect-[3/4] border-4 flex items-center justify-center transition-transform ${
                  matched.includes(c.pair) ? 'border-[#6cc24a] bg-[#e8f7d4] scale-[0.97]' : isUp ? 'border-[#3b2a1a] bg-[#fff4d6]' : 'border-[#140c1f] bg-[#4a3a66]'
                }`}
              >
                {!isUp ? (
                  <span className="px-title text-[#facc15] text-2xl" aria-hidden>?</span>
                ) : c.kind === 'icon' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.src} alt="" className="px-img w-3/4 h-3/4 object-contain" />
                ) : c.kind === 'qty' ? (
                  <span className="flex flex-wrap justify-center gap-0.5 p-1">
                    {Array.from({ length: c.qty ?? 0 }).map((_, k) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={k} src={c.src} alt="" className="px-img w-6 h-6 object-contain" />
                    ))}
                  </span>
                ) : (
                  <span className="px-title text-[13px] text-center leading-snug px-1 break-words">{c.text}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
