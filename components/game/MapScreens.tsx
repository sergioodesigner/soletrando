'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Mascot, type MascotMood } from './Mascot';
import { DialogueBox, type Choice } from './DialogueBox';
import { AgeChip, IconBtn, SoundSettings, Stats } from './Hud';
import { itemName, itemSrc } from '@/lib/game/items';
import { BOSS_MIN_STARS, WORLDS, pinUnlocked } from '@/lib/game/worlds';
import { pinStars } from '@/lib/game/store';
import type { DialogueApi } from '@/lib/game/dialogue';
import type { AgeId, PinDef, Profile, WorldDef } from '@/lib/game/types';

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
    void dialogue.say(`Para onde vamos hoje, ${profile.name}?`, { mascot: 'fox' });
    // só ao entrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-root relative flex-1 min-h-0 flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/55" />
      <div className="relative z-10 flex items-center gap-2 p-2">
        <IconBtn label="Voltar ao título" onClick={onTitle}>
          <ArrowLeft size={20} />
        </IconBtn>
        <div className="flex-1" />
        <AgeChip profile={profile} onChange={onAge} />
        <SoundSettings {...top} />
      </div>

      <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        <div className="mx-auto max-w-md flex flex-col gap-3">
          <h2 className="px-title text-[#fff4d6] text-[13px] text-center [text-shadow:3px_3px_0_#3b2a1a] mt-1">MAPA-MÚNDI</h2>
          {WORLDS.map((w) => {
            const stars = pinStars(profile, w.id).reduce((a, b) => a + b, 0);
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => (w.locked ? void dialogue.say(w.lockedHint ?? 'Em breve!', { mascot: 'fox' }) : onPick(w))}
                className={`px-panel px-notch p-3 flex items-center gap-3 text-left ${w.locked ? 'opacity-80' : ''}`}
                style={{ borderColor: w.locked ? '#475569' : '#3b2a1a' }}
              >
                <div className="w-20 h-20 shrink-0 flex items-end justify-center" style={{ background: `${w.accent}33` }}>
                  {w.mascot ? (
                    <Mascot id={w.mascot} size={72} flip={w.mascot === 'owl'} />
                  ) : (
                    <span className="text-4xl self-center" aria-hidden>
                      🌫️
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="px-title text-[11px] leading-snug">{w.name}</p>
                  <p className="text-[16px]">{w.subtitle}</p>
                  {!w.locked && (
                    <p className="text-[15px] mt-1 font-bold">
                      ⭐ {stars}/{w.pins.length * 3}
                    </p>
                  )}
                </div>
                <span className="text-2xl" aria-hidden>
                  {w.locked ? '🔒' : '▶'}
                </span>
              </button>
            );
          })}
          <button type="button" onClick={onAlbum} className="px-btn px-btn-blue px-notch text-[17px]">
            📖 Meu álbum de figurinhas
          </button>
        </div>
      </div>

      <div className="relative z-10 px-3 pb-3 mx-auto w-full max-w-md">
        <DialogueBox dialogue={dialogue} idleHint="Escolha um mundo para explorar!" />
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

  const openPin = (p: PinDef) => {
    setMenu(false);
    setSel(p.index);
    setAt(p.index);
    const locked = !pinUnlocked(stars, p);
    void dialogue.say(locked ? 'Esta fase ainda está trancada. Vença as anteriores!' : p.intro, { mascot });
  };

  const atPin = world.pins[at] ?? world.pins[0];
  const mascotLeft = atPin.x > 50 ? atPin.x - 14 : atPin.x + 14;
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
          style={{
            aspectRatio: '2 / 3',
            backgroundImage: `url(${world.mapImage})`,
            backgroundSize: 'cover',
            backgroundPosition: '0% 55%',
            filter: undefined,
          }}
        >
          {/* filtro de cor só na arte (provisório), não nos pins */}
          <div className="absolute inset-0" style={{ backdropFilter: world.mapFilter }} />
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden>
            <polyline points={world.pins.map((p) => `${p.x},${p.y * 1.5}`).join(' ')} fill="none" stroke="#3b2a1a" strokeWidth="2.6" strokeLinejoin="round" strokeDasharray="1.2 3" strokeLinecap="square" />
            <polyline points={world.pins.map((p) => `${p.x},${p.y * 1.5}`).join(' ')} fill="none" stroke="#fff4d6" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="1.2 3" strokeLinecap="square" />
          </svg>

          {world.pins.map((p) => {
            const unlocked = pinUnlocked(stars, p);
            const s = stars[p.index] ?? 0;
            const available = unlocked && s === 0;
            const big = p.kind !== 'normal';
            const size = big ? 60 : 50;
            return (
              <div key={p.index} className="absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                <button
                  type="button"
                  onClick={() => openPin(p)}
                  data-coach={available && p.index === firstOpen ? 'pin-available' : undefined}
                  aria-label={`Fase ${p.index + 1}: ${p.name}${!unlocked ? ' (trancada)' : ''}`}
                  className={`px-btn px-notch absolute !p-0 flex items-center justify-center ${available ? 'px-pin-available' : ''}`}
                  style={{
                    width: size,
                    height: size,
                    left: 0,
                    top: 0,
                    transform: available ? undefined : 'translate(-50%, -50%)',
                    ['--btn' as string]: !unlocked ? '#9ca3af' : s > 0 ? '#6cc24a' : p.kind === 'boss' ? '#e8624a' : '#facc15',
                  }}
                >
                  {!unlocked ? (
                    <span className="text-xl" aria-hidden>🔒</span>
                  ) : big ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={itemSrc(p.rewardItem)} alt="" className="px-img w-8 h-8 object-contain" />
                  ) : (
                    <span className="px-title text-[14px]">{p.index + 1}</span>
                  )}
                </button>
                {s > 0 && (
                  <span className="absolute text-[13px] leading-none -translate-x-1/2 whitespace-nowrap" style={{ top: size / 2 + 2, left: 0 }}>
                    {'⭐'.repeat(s)}
                  </span>
                )}
              </div>
            );
          })}

          {/* mascote ao lado do pin atual */}
          <div
            className="absolute z-10 transition-[left,top] duration-700 ease-steps"
            style={{ left: `${mascotLeft}%`, top: `${atPin.y}%`, transform: 'translate(-50%, -78%)', transitionTimingFunction: 'steps(8)' }}
          >
            <Mascot
              id={mascot}
              size={86}
              mood={dialogue.status === 'typing' ? 'talk' : mood}
              flip={atPin.x > 50 ? false : mascot === 'owl'}
              data-coach="mascot"
              onClick={() => {
                setSel(null);
                setMenu(true);
                void dialogue.say(mascot === 'fox' ? 'Oi! O que você quer fazer?' : 'Olá! Em que posso ajudar?', { mascot });
              }}
            />
          </div>
        </div>
      </div>

      {sheetOpen && (
        <div className="absolute z-30 left-0 right-0 bottom-0 p-3">
          <div className="mx-auto max-w-md px-panel px-notch p-3">
            {pin ? (
              <PinSheet
                world={world}
                pin={pin}
                stars={stars}
                total={total}
                dialogue={dialogue}
                onStart={() => onStart(pin)}
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
  world, pin, stars, total, dialogue, onStart, onClose, profile,
}: {
  world: WorldDef; pin: PinDef; stars: number[]; total: number; dialogue: DialogueApi;
  onStart: () => void; onClose: () => void; profile: Profile;
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
            <span key={n} className={n <= got ? '' : 'opacity-30 grayscale'}>⭐</span>
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
        onClick={onStart}
        className="px-btn px-btn-green px-notch w-full mt-2 text-[19px]"
      >
        {got > 0 ? 'Jogar de novo ▶' : 'Começar ▶'}
      </button>
      <span className="hidden">{world.id}</span>
    </>
  );
}

/* ------------------------------------------------------------------ Resultado */

interface ResultProps {
  world: WorldDef;
  pin: PinDef;
  stars: number;
  coins: number;
  newItem: number | null;
  dialogue: DialogueApi;
  hasNext: boolean;
  onNext: () => void;
  onMap: () => void;
  onRetry: () => void;
}

export function ResultScreen({ world, pin, stars, coins, newItem, dialogue, hasNext, onNext, onMap, onRetry }: ResultProps) {
  const [shown, setShown] = useState(0);
  const mascot = world.mascot ?? 'fox';

  useEffect(() => {
    const line =
      stars === 3
        ? 'Perfeito! Você arrasou!'
        : stars === 2
          ? 'Muito bem! Quase perfeito!'
          : 'Você conseguiu! Que tal tentar de novo para ganhar mais estrelas?';
    void dialogue.say(`${line}${newItem !== null ? ` Olha só, você ganhou: ${itemName(newItem)}!` : ''}`, { mascot });
    const timers = [1, 2, 3].map((n) => setTimeout(() => setShown((s) => Math.max(s, n)), 500 * n));
    return () => timers.forEach(clearTimeout);
    // só ao entrar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="game-root relative flex-1 min-h-0 overflow-y-auto flex flex-col items-center" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/65" />
      <div className="relative z-10 w-full max-w-md px-3 pt-4 pb-3 flex flex-col items-center gap-3">
        <p className="px-title text-[#facc15] text-[13px] [text-shadow:3px_3px_0_#3b2a1a] text-center">
          {pin.kind === 'boss' ? 'CHEFE DERROTADO!' : 'FASE CUMPRIDA!'}
        </p>
        <div className="flex gap-2 text-5xl" aria-label={`${stars} estrelas`}>
          {[1, 2, 3].map((n) => (
            <span key={n} className={n <= stars && n <= shown ? 'px-float' : 'opacity-25 grayscale'}>⭐</span>
          ))}
        </div>
        <div className="px-panel px-notch w-full p-3 flex items-center justify-around text-[18px] font-bold">
          <span className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/game/items/item35.png" alt="" className="px-img w-6 h-6" /> +{coins}
          </span>
          {newItem !== null && (
            <span className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={itemSrc(newItem)} alt="" className="px-img w-10 h-10 object-contain px-float" />
              <span className="text-[14px] leading-tight">{itemName(newItem)}</span>
            </span>
          )}
        </div>
        <div className="flex items-end gap-2 w-full">
          <Mascot id={mascot} size={120} mood={stars === 3 ? 'trophy' : 'happy'} flip={mascot === 'owl'} className="shrink-0" />
          <DialogueBox dialogue={dialogue} className="flex-1" />
        </div>
        <div className="w-full flex flex-col gap-2">
          {hasNext && (
            <button type="button" onClick={onNext} className="px-btn px-btn-green px-notch text-[19px]">
              Próxima fase ▶
            </button>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onRetry} className="px-btn px-btn-plain px-notch flex-1 text-[16px]">
              ↻ Repetir
            </button>
            <button type="button" onClick={onMap} className="px-btn px-btn-blue px-notch flex-1 text-[16px]">
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
