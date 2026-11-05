'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Mascot, type MascotMood } from './Mascot';
import { Portrait } from './Scenes';
import { DialogueBox, type Choice } from './DialogueBox';
import { AgeChip, IconBtn, SoundSettings, Stats } from './Hud';
import { itemName, itemSrc } from '@/lib/game/items';
import { BOSS_MIN_STARS, WORLDS, WORLD_MAP, pinUnlocked } from '@/lib/game/worlds';
import { pinStars } from '@/lib/game/store';
import type { DialogueApi } from '@/lib/game/dialogue';
import { isDpad, registerBack } from '@/lib/dpad';
import { PH, pGanhou } from '@/lib/voice/phrases';
import { speakerOf, type AgeId, type PinDef, type Profile, type WorldDef } from '@/lib/game/types';

const PARK = { backgroundImage: 'url(/game/park.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' } as const;

export const totalStars = (p: Profile, age: AgeId = p.age) =>
  WORLDS.reduce((sum, w) => sum + (p.progress[`${w.id}:${age}`] ?? []).reduce((a, b) => a + b, 0), 0);

interface TopProps {
  profile: Profile;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSettings: () => void;
}

/* ------------------------------------------------------------------ Mapa-múndi */

interface WorldSelectProps extends TopProps {
  dialogue: DialogueApi;
  onPick: (w: WorldDef) => void;
  onAlbum: () => void;
  onTitle: () => void;
  onAge: (a: AgeId) => void;
}

export function WorldSelect({ profile, dialogue, onPick, onAlbum, onTitle, onAge, ...top }: WorldSelectProps) {
  useEffect(() => {
    void dialogue.say(PH.paraOndeVamos, { mascot: 'fox' });
    // só ao entrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-root relative flex-1 min-h-0 flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/70" />
      <div className="relative z-10 flex items-center gap-1.5 p-2">
        <IconBtn label="Voltar ao título" onClick={onTitle}>
          <ArrowLeft size={20} />
        </IconBtn>
        <Stats stars={totalStars(profile)} coins={profile.coins} />
        <div className="flex-1" />
        <IconBtn label="Meu álbum de figurinhas" onClick={onAlbum}>
          <span aria-hidden>📖</span>
        </IconBtn>
        <AgeChip profile={profile} onChange={onAge} />
        <SoundSettings {...top} />
      </div>

      <div className="relative z-10 flex-1 min-h-0 flex justify-center px-2 pb-2">
        <div
          className="relative h-full max-w-full border-4 border-[#3b2a1a] overflow-hidden"
          style={{ aspectRatio: String(WORLD_MAP.aspect), backgroundImage: `url(${WORLD_MAP.image})`, backgroundSize: '100% 100%' }}
        >
          {WORLDS.map((w) => {
            const spot = WORLD_MAP.spots[w.id];
            if (!spot) return null;
            const stars = pinStars(profile, w.id).reduce((a, b) => a + b, 0);
            return (
              <button
                key={w.id}
                type="button"
                data-coach={`world-${w.id}`}
                data-tv-autofocus={w.id === 'letras' ? true : undefined}
                onClick={() => (w.locked ? void dialogue.say(w.lockedHint ?? PH.emBreve, { mascot: 'fox' }) : onPick(w))}
                aria-label={`${w.name}${w.locked ? ' (trancado)' : ''}`}
                className="absolute flex flex-col items-center"
                style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {w.locked ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/game/ui/lock.png" alt="" className="px-img w-11 h-11 object-contain drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]" />
                ) : (
                  <span className="px-pin-bounce">
                    <Mascot id={w.mascot ?? 'fox'} size={74} flip={w.mascot === 'owl'} mood="wave" />
                  </span>
                )}
                <span className={`px-panel px-notch px-2 py-0.5 mt-0.5 text-center leading-tight ${w.locked ? 'opacity-85' : ''}`}>
                  <span className="px-title block text-[8px] whitespace-nowrap">{w.name}</span>
                  <span className="block text-[13px] font-bold whitespace-nowrap">
                    {w.locked ? 'Em breve' : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/game/ui/star.png" alt="" className="px-img inline w-3.5 h-3.5 mr-1 -mt-0.5" />
                        {stars}/{w.pins.length * 3}
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="absolute z-20 left-0 right-0 bottom-0 px-3 pb-3 pointer-events-none">
        <div className="mx-auto max-w-md pointer-events-auto">
          <DialogueBox dialogue={dialogue} idleHint="Escolha um mundo para explorar!" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Mapa do mundo */

interface WorldMapProps extends TopProps {
  world: WorldDef;
  dialogue: DialogueApi;
  mood: MascotMood;
  onStart: (pin: PinDef) => void;
  onBack: () => void;
  onAlbum: () => void;
  onAge: (a: AgeId) => void;
  onSheetOpen: (open: boolean) => void;
  onHowToPlay: () => void;
  onFact: () => Promise<string>;
  onTrain: () => void;
  onMemory: () => void;
  /** Aliado deste mundo (chefe que virou amigo), se já conquistado. */
  ally: string | null;
  onAlly: () => void;
}

export function WorldMap({
  world,
  profile,
  dialogue,
  mood,
  onStart,
  onBack,
  onAlbum,
  onAge,
  onSheetOpen,
  onHowToPlay,
  onFact,
  onTrain,
  onMemory,
  ally,
  onAlly,
  ...top
}: WorldMapProps) {
  const stars = useMemo(() => pinStars(profile, world.id), [profile, world.id]);
  const mascot = world.mascot ?? 'fox';
  const firstOpen = useMemo(() => world.pins.find((p) => pinUnlocked(stars, p) && (stars[p.index] ?? 0) === 0)?.index ?? world.pins.length - 1, [world.pins, stars]);
  const [sel, setSel] = useState<number | null>(null);
  const [menu, setMenu] = useState(false);
  const [at, setAt] = useState<number>(firstOpen);

  const pin = sel !== null ? world.pins[sel] : null;
  const sheetOpen = pin !== null || menu;
  useEffect(() => onSheetOpen(sheetOpen), [sheetOpen, onSheetOpen]);
  // Voltar do controle fecha a ficha / o menu do mascote
  useEffect(() => {
    if (!sheetOpen) return;
    return registerBack(() => {
      setSel(null);
      setMenu(false);
      dialogue.stop();
      return true;
    });
  }, [sheetOpen, dialogue]);

  const openPin = (p: PinDef) => {
    setMenu(false);
    setSel(p.index);
    setAt(p.index);
    const locked = !pinUnlocked(stars, p);
    void dialogue.say(locked ? PH.faseTrancada : p.intro, { mascot });
  };

  const atPin = world.pins[at] ?? world.pins[0];
  const mascotLeft = atPin.x > 50 ? atPin.x - 13 : atPin.x + 13;
  const total = stars.reduce((a, b) => a + b, 0);

  const menuChoices: Choice[] = [
    {
      label: '💡 Conta uma curiosidade',
      tone: 'blue',
      onClick: async () => {
        const fact = await onFact();
        void dialogue.say(fact, { mascot, ephemeral: true });
      },
    },
    { label: '❓ Como se joga?', tone: 'green', onClick: () => { setMenu(false); onHowToPlay(); } },
    { label: 'Fechar', onClick: () => { setMenu(false); dialogue.stop(); } },
  ];

  return (
    <div className="game-root relative flex-1 min-h-0 flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/60" />
      <div className="relative z-10 flex items-center gap-1.5 p-2">
        <span data-coach="worlds">
          <IconBtn label="Voltar ao mapa-múndi" onClick={onBack}>
            <ArrowLeft size={20} />
          </IconBtn>
        </span>
        <Stats stars={totalStars(profile)} coins={profile.coins} />
        <div className="flex-1" />
        <span data-coach="album">
          <IconBtn label="Meu álbum" onClick={onAlbum}>
            <span aria-hidden>📖</span>
          </IconBtn>
        </span>
        <AgeChip profile={profile} onChange={onAge} />
        <SoundSettings {...top} />
      </div>

      <p className="relative z-10 px-title text-[#fff4d6] text-[11px] text-center [text-shadow:3px_3px_0_#3b2a1a] -mt-0.5 mb-1">
        {world.name.toUpperCase()}
      </p>

      <div className="relative z-10 flex-1 min-h-0 flex justify-center px-2 pb-2">
        <div
          className="relative h-full max-w-full border-4 border-[#3b2a1a] overflow-hidden"
          style={{ aspectRatio: String(world.mapAspect), backgroundImage: `url(${world.mapImage})`, backgroundSize: '100% 100%' }}
        >
          {world.pins.map((p) => {
            const unlocked = pinUnlocked(stars, p);
            const s = stars[p.index] ?? 0;
            const available = unlocked && s === 0;
            const w = p.kind === 'boss' ? 62 : p.kind === 'mini' ? 54 : 46;
            const sprite = !unlocked ? '/game/ui/lock.png' : s > 0 ? '/game/ui/pin-done.png' : '/game/ui/pin.png';
            return (
              <button
                key={p.index}
                type="button"
                onClick={() => openPin(p)}
                data-coach={available && p.index === firstOpen ? 'pin-available' : undefined}
                data-tv-autofocus={p.index === firstOpen ? true : undefined}
                aria-label={`Fase ${p.index + 1}: ${p.name}${!unlocked ? ' (trancada)' : ''}`}
                className="absolute z-20 flex flex-col items-center"
                style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -100%)', minWidth: 48, minHeight: 48, justifyContent: 'flex-end' }}
              >
                <span className={available ? 'px-pin-bounce' : ''}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sprite} alt="" draggable={false} className="px-img object-contain drop-shadow-[0_3px_0_rgba(0,0,0,0.45)]" style={{ width: w, height: w }} />
                </span>
                {p.kind !== 'normal' && unlocked && (
                  <span className="px-title absolute -top-3 text-[7px] bg-[#3b2a1a] text-[#fff4d6] px-1 py-0.5 whitespace-nowrap">
                    {p.kind === 'boss' ? 'CHEFE' : 'MINI'}
                  </span>
                )}
                {s > 0 && (
                  <span className="absolute flex" style={{ bottom: -12 }}>
                    {[1, 2, 3].map((n) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={n} src={n <= s ? '/game/ui/star.png' : '/game/ui/star-empty.png'} alt="" className="px-img w-3.5 h-3.5" />
                    ))}
                  </span>
                )}
              </button>
            );
          })}

          {/* aliado (chefe que virou amigo) acompanha o mascote */}
          {ally && (
            <button
              type="button"
              data-coach="ally"
              onClick={onAlly}
              aria-label={`Falar com ${speakerOf(ally).name}`}
              className="absolute z-10 px-float"
              style={{ left: `${atPin.x > 50 ? atPin.x - 30 : atPin.x + 30}%`, top: `${atPin.y}%`, transform: 'translate(-50%, -85%)' }}
            >
              <Portrait who={ally} size={64} />
            </button>
          )}

          {/* mascote ao lado do pin atual */}
          <div
            className="absolute z-10 transition-[left,top] duration-700 ease-steps"
            style={{ left: `${mascotLeft}%`, top: `${atPin.y}%`, transform: 'translate(-50%, -92%)', transitionTimingFunction: 'steps(8)' }}
          >
            <Mascot
              id={mascot}
              size={86}
              mood={dialogue.status === 'typing' ? 'talk' : mood}
              flip={atPin.x > 50 ? mascot !== 'owl' : mascot === 'owl'}
              data-coach="mascot"
              onClick={() => {
                setSel(null);
                setMenu(true);
                void dialogue.say(mascot === 'fox' ? PH.oiFox : PH.oiOwl, { mascot });
              }}
            />
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="absolute z-30 left-0 right-0 bottom-0 p-3">
          <div data-tv-modal className="mx-auto max-w-md px-panel px-notch p-3">
            {pin ? (
              <PinSheet
                world={world}
                pin={pin}
                stars={stars}
                total={total}
                dialogue={dialogue}
                onStart={() => onStart(pin)}
                onTrain={onTrain}
                onMemory={onMemory}
                onClose={() => {
                  setSel(null);
                  dialogue.stop();
                }}
                profile={profile}
              />
            ) : (
              <div className="flex gap-2 items-end">
                <DialogueBox dialogue={dialogue} className="flex-1" choices={menuChoices} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PinSheet({
  world, pin, stars, total, dialogue, onStart, onClose, profile, onTrain, onMemory,
}: {
  world: WorldDef; pin: PinDef; stars: number[]; total: number; dialogue: DialogueApi;
  onStart: () => void; onClose: () => void; profile: Profile; onTrain: () => void; onMemory: () => void;
}) {
  const unlocked = pinUnlocked(stars, pin);
  const got = stars[pin.index] ?? 0;
  const have = profile.items.includes(pin.rewardItem);
  const kind = pin.kind === 'boss' ? 'CHEFE' : pin.kind === 'mini' ? 'MINI-CHEFE' : `FASE ${pin.index + 1}`;
  const lockReason =
    pin.kind === 'boss'
      ? `Precisa vencer as fases anteriores e ter ${BOSS_MIN_STARS} estrelas aqui (você tem ${total}).`
      : 'Vença a fase anterior para destrancar.';
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="px-title text-[11px] leading-snug">
          <span className="text-[#c2410c]">{kind}</span> · {pin.name}
        </p>
        <button type="button" onClick={onClose} aria-label="Fechar" className="px-btn px-btn-plain px-notch !min-h-[32px] !px-2 text-[14px]">
          ✕
        </button>
      </div>
      <DialogueBox dialogue={dialogue} />
      <div className="flex items-center justify-between mt-2 text-[15px]">
        <span aria-label={`${got} de 3 estrelas`}>
          {[1, 2, 3].map((n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={n <= got ? '/game/ui/star.png' : '/game/ui/star-empty.png'} alt="" className="px-img inline w-5 h-5 mr-0.5" />
          ))}
          <span className="ml-2 text-[13px]">{pin.challenges} desafios</span>
        </span>
        <span className="flex items-center gap-1.5 text-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={itemSrc(pin.rewardItem)} alt="" className={`px-img w-7 h-7 object-contain ${have ? '' : 'opacity-60'}`} />
          {have ? <span>✔ {itemName(pin.rewardItem)}</span> : <span>Prêmio: {itemName(pin.rewardItem)}</span>}
        </span>
      </div>
      {!unlocked && <p className="text-[14px] text-[#b45309] font-bold mt-1">🔒 {lockReason}</p>}
      <button
        type="button"
        disabled={!unlocked}
        data-tv-autofocus
        autoFocus={isDpad()}
        onClick={onStart}
        className="px-btn px-btn-green px-notch w-full mt-2 text-[19px]"
      >
        {got > 0 ? 'Jogar de novo ▶' : 'Começar ▶'}
      </button>
      {got > 0 && (
        <div className="flex gap-2 mt-2">
          <button type="button" onClick={onTrain} className="px-btn px-btn-blue px-notch flex-1 text-[15px]">
            💪 Treino
          </button>
          <button type="button" onClick={onMemory} className="px-btn px-btn-blue px-notch flex-1 text-[15px]">
            🃏 Memória
          </button>
        </div>
      )}
      <span className="hidden">{world.id}</span>
    </>
  );
}

/* ------------------------------------------------------------------ Resultado */

interface ResultProps {
  world: WorldDef;
  /** null no Treino e na Memória (não são fases do mapa). */
  pin: PinDef | null;
  /** Título (padrão: FASE CUMPRIDA!). */
  title?: string;
  /** Fala do mascote (padrão: baseada nas estrelas). */
  speech?: string;
  /** Linhas de bônus mostradas no quadro (ex.: "Bônus do treino +10"). */
  bonusLines?: string[];
  /** Aliado que acabou de entrar para o time. */
  ally?: { id: string; name: string; text: string } | null;
  onTrain?: () => void;
  onMemory?: () => void;
  stars: number;
  coins: number;
  newItem: number | null;
  dialogue: DialogueApi;
  hasNext: boolean;
  onNext: () => void;
  onMap: () => void;
  onRetry: () => void;
}

export function ResultScreen({ world, pin, title, speech, bonusLines, ally, onTrain, onMemory, stars, coins, newItem, dialogue, hasNext, onNext, onMap, onRetry }: ResultProps) {
  const [shown, setShown] = useState(0);
  const mascot = world.mascot ?? 'fox';

  useEffect(() => {
    let cancelled = false;
    const line = stars === 3 ? PH.estrelas3 : stars === 2 ? PH.estrelas2 : PH.estrelas1;
    const base = speech ?? line;
    // falas em sequência (cada uma tem o próprio áudio gravado): resultado → prêmio → aliado
    (async () => {
      await dialogue.say(base, { mascot });
      if (cancelled) return;
      if (newItem !== null && !speech) {
        await dialogue.say(pGanhou(itemName(newItem)), { mascot });
        if (cancelled) return;
      }
      if (ally) await dialogue.say(ally.text, { mascot });
    })();
    const timers = [1, 2, 3].map((n) => setTimeout(() => setShown((s) => Math.max(s, n)), 500 * n));
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // só ao entrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-root relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/65" />
      <div className="relative z-10 w-full max-w-md px-3 pt-4 pb-3 flex flex-col items-center gap-3">
        <p className="px-title text-[#facc15] text-[13px] [text-shadow:3px_3px_0_#3b2a1a] text-center">
          {title ?? (pin?.kind === 'boss' ? 'CHEFE AMIGO!' : 'FASE CUMPRIDA!')}
        </p>
        <div className="flex gap-2" aria-label={`${stars} estrelas`}>
          {[1, 2, 3].map((n) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={n} src={n <= stars && n <= shown ? '/game/ui/star.png' : '/game/ui/star-empty.png'} alt="" className={`px-img w-16 h-16 object-contain shrink-0 ${n <= stars && n <= shown ? 'px-float' : 'opacity-60'}`} />
          ))}
        </div>
        <div className="px-panel px-notch w-full p-3 flex items-center justify-around text-[18px] font-bold">
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/game/ui/coin.png" alt="" className="px-img w-6 h-6" /> +{coins}
          </span>
          {newItem !== null && (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemSrc(newItem)} alt="" className="px-img w-10 h-10 object-contain px-float" />
              <span className="text-[14px] leading-tight">{itemName(newItem)}</span>
            </span>
          )}
        </div>
        {bonusLines && bonusLines.length > 0 && (
          <div className="px-panel px-notch w-full px-3 py-2 text-[16px] font-bold text-[#92400e]">
            {bonusLines.map((b) => (
              <p key={b}>✨ {b}</p>
            ))}
          </div>
        )}
        {ally && (
          <div className="px-panel px-notch w-full p-2 flex items-center gap-3 border-[#6cc24a]">
            <Portrait who={ally.id} size={70} />
            <div className="text-[16px] leading-snug">
              <p className="px-title text-[9px] text-[#2f7d17]">NOVO ALIADO!</p>
              <p className="font-bold">{ally.name}</p>
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 w-full">
          <Mascot id={mascot} size={120} mood={stars === 3 ? 'trophy' : 'happy'} flip={mascot === 'owl'} className="shrink-0" />
          <DialogueBox dialogue={dialogue} className="flex-1" />
        </div>
        <div className="w-full flex flex-col gap-2">
          {hasNext && (
            <button type="button" data-tv-autofocus onClick={onNext} className="px-btn px-btn-green px-notch text-[19px]">
              Próxima fase ▶
            </button>
          )}
          {(onTrain || onMemory) && (
            <div className="flex gap-2">
              {onTrain && (
                <button type="button" data-coach="btn-training" onClick={onTrain} className="px-btn px-btn-blue px-notch flex-1 text-[15px] leading-tight">
                  💪 Momento Treino
                  <span className="block text-[11px] opacity-80">ganhe bônus</span>
                </button>
              )}
              {onMemory && (
                <button type="button" data-coach="btn-memory" onClick={onMemory} className="px-btn px-btn-blue px-notch flex-1 text-[15px] leading-tight">
                  🃏 Jogo da Memória
                  <span className="block text-[11px] opacity-80">ganhe bônus</span>
                </button>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onRetry} className="px-btn px-btn-plain px-notch flex-1 text-[16px]">
              ↻ Repetir
            </button>
            <button type="button" data-tv-autofocus={!hasNext ? true : undefined} onClick={onMap} className="px-btn px-btn-blue px-notch flex-1 text-[16px]">
              Voltar ao mapa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Álbum */

export function AlbumScreen({ profile, onBack }: { profile: Profile; onBack: () => void }) {
  const done = WORLDS.filter((w) => !w.locked);
  const got = profile.items.length;
  const all = done.reduce((n, w) => n + w.pins.length, 0);
  return (
    <div className="game-root relative flex-1 min-h-0 flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/65" />
      <div className="relative z-10 flex items-center gap-2 p-2">
        <IconBtn label="Voltar" onClick={onBack}>
          <ArrowLeft size={20} />
        </IconBtn>
        <h2 className="px-title text-[#fff4d6] text-[12px] [text-shadow:3px_3px_0_#3b2a1a]">ÁLBUM DE {profile.name.toUpperCase()}</h2>
        <div className="flex-1" />
        <span className="px-panel px-notch px-2 py-1 text-[15px] font-bold">{got}/{all}</span>
      </div>
      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 pb-4">
        <div className="mx-auto max-w-md flex flex-col gap-3">
          <div className="px-panel px-notch p-3">
            <p className="px-title text-[11px] mb-2">Meus aliados</p>
            <div className="flex gap-3">
              {(['borrao', 'hidra'] as const).map((id) => {
                const has = profile.allies?.includes(id);
                return (
                  <div key={id} className="flex flex-col items-center text-center w-24">
                    <div className={has ? '' : 'opacity-25'} style={has ? undefined : { filter: 'brightness(0)' }}>
                      <Portrait who={id} size={72} />
                    </div>
                    <span className="text-[13px] mt-1 leading-tight">{has ? speakerOf(id).name : '???'}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[12px] opacity-70 mt-1">Vença os chefes para fazer novos amigos!</p>
          </div>
          {WORLDS.map((w) => (
            <div key={w.id} className="px-panel px-notch p-3">
              <p className="px-title text-[11px] mb-2">{w.name}</p>
              {w.locked ? (
                <p className="text-[15px] opacity-70">🌫️ Em breve, novas figurinhas!</p>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {w.pins.map((p) => {
                    const has = profile.items.includes(p.rewardItem);
                    return (
                      <div key={p.index} className="flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-white/60 border-4 border-[#3b2a1a]/30 flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={itemSrc(p.rewardItem)}
                            alt={has ? itemName(p.rewardItem) : 'Figurinha escondida'}
                            className="px-img w-10 h-10 object-contain"
                            style={has ? undefined : { filter: 'brightness(0)', opacity: 0.25 }}
                          />
                        </div>
                        <span className="text-[12px] leading-tight mt-1">{has ? itemName(p.rewardItem) : '???'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
