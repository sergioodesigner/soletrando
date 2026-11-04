'use client';

import { useEffect, useState } from 'react';
import { DialogueBox } from './DialogueBox';
import { Mascot } from './Mascot';
import type { CoachStep } from '@/lib/game/coach';
import type { DialogueApi } from '@/lib/game/dialogue';

interface Props {
  step: CoachStep;
  dialogue: DialogueApi;
  onDone: () => void;
}

interface Rect { x: number; y: number; w: number; h: number }

/**
 * Explica um elemento na primeira vez: escurece a tela, deixa um "buraco" em volta do alvo
 * (o toque passa direto para ele), aponta com um dedo e o mascote explica falando e digitando.
 */
export function CoachLayer({ step, dialogue, onDone }: Props) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [vh, setVh] = useState(0);
  const [vw, setVw] = useState(0);

  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(step.target);
      setVh(window.innerHeight);
      setVw(window.innerWidth);
      if (!el) return setRect(null);
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    const t = setInterval(measure, 250);
    window.addEventListener('resize', measure);
    return () => {
      clearInterval(t);
      window.removeEventListener('resize', measure);
    };
  }, [step.target]);

  // mode 'tap': tocar no próprio alvo também conclui o passo (o clique segue para o botão normalmente)
  useEffect(() => {
    if (step.mode !== 'tap') return;
    const el = document.querySelector(step.target);
    if (!el) return;
    const handler = () => onDone();
    el.addEventListener('click', handler, { once: true, capture: true });
    return () => el.removeEventListener('click', handler, { capture: true });
  }, [step.target, step.mode, onDone]);

  useEffect(() => {
    void dialogue.say(step.text, { mascot: step.mascot });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  if (!rect || rect.w === 0) return null;
  // quando o alvo É o balão da cena, a fala já aparece nele (o diálogo é compartilhado): sem balão duplicado
  const targetIsBubble = step.target.includes('bubble');

  const pad = 6;
  const hx = Math.max(0, rect.x - pad);
  const hy = Math.max(0, rect.y - pad);
  const hw = rect.w + pad * 2;
  const hh = rect.h + pad * 2;
  const shade = 'fixed z-[60] bg-[rgba(20,10,30,0.66)]';
  const bubbleAtTop = !targetIsBubble && rect.y + rect.h / 2 > vh * 0.55;
  const fingerBelow = rect.y < vh * 0.35;

  return (
    <div className="game-root">
      {/* 4 faixas ao redor do alvo: o "buraco" deixa o toque passar */}
      <div className={shade} style={{ left: 0, top: 0, width: vw, height: hy }} onClick={(e) => e.stopPropagation()} />
      <div className={shade} style={{ left: 0, top: hy + hh, width: vw, height: Math.max(0, vh - hy - hh) }} />
      <div className={shade} style={{ left: 0, top: hy, width: hx, height: hh }} />
      <div className={shade} style={{ left: hx + hw, top: hy, width: Math.max(0, vw - hx - hw), height: hh }} />
      <div
        className="fixed z-[61] pointer-events-none border-4 border-[#facc15] px-pin-available"
        style={{ left: hx + hw / 2, top: hy + hh / 2, width: hw, height: hh, translate: '0 0' }}
      />
      <div
        className="fixed z-[62] pointer-events-none text-3xl px-finger"
        style={{
          left: rect.x + rect.w / 2 - 14,
          top: fingerBelow ? hy + hh + 2 : hy - 40,
          transform: fingerBelow ? 'rotate(180deg)' : undefined,
        }}
        aria-hidden
      >
        👆
      </div>

      <div className={`fixed z-[63] left-0 right-0 px-3 ${bubbleAtTop ? 'top-3' : 'bottom-3'}`}>
        <div className="mx-auto max-w-md flex items-end gap-2">
          {!targetIsBubble && <Mascot id={step.mascot} size={72} mood={dialogue.status === 'typing' ? 'talk' : 'point'} className="shrink-0" />}
          {targetIsBubble ? (
            <button type="button" onClick={onDone} className="px-btn px-btn-green px-notch ml-auto">
              Entendi!
            </button>
          ) : (
            <DialogueBox dialogue={dialogue} className="flex-1" choices={[{ label: 'Entendi!', onClick: onDone, tone: 'green' }]} />
          )}
        </div>
      </div>
    </div>
  );
}
