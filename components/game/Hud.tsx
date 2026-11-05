'use client';

import { Settings, Volume2, VolumeX } from 'lucide-react';
import { AGES, type AgeId, type Profile } from '@/lib/game/types';
import { useEffect, useState } from 'react';
import { isDpad, registerBack } from '@/lib/dpad';

interface StatsProps {
  stars: number;
  coins: number;
}

export function Stats({ stars, coins }: StatsProps) {
  return (
    <div data-coach="stats" className="px-panel px-notch flex items-center gap-3 px-3 py-1 text-[16px] font-bold">
      <span className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/game/ui/star.png" alt="" className="px-img w-5 h-5 object-contain" />
        {stars}
      </span>
      <span className="flex items-center gap-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/game/ui/coin.png" alt="" className="px-img w-5 h-5 object-contain" />
        {coins}
      </span>
    </div>
  );
}

interface RoundBtnProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  coach?: string;
}
export function IconBtn({ label, onClick, children, coach }: RoundBtnProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-coach={coach}
      onClick={onClick}
      className="px-btn px-btn-plain px-notch !min-h-[40px] !min-w-[40px] !p-1 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

export function SoundSettings({
  soundEnabled,
  onToggleSound,
  onSettings,
}: {
  soundEnabled: boolean;
  onToggleSound: () => void;
  onSettings: () => void;
}) {
  return (
    <>
      <IconBtn label={soundEnabled ? 'Desligar o som' : 'Ligar o som'} onClick={onToggleSound} coach="sound">
        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </IconBtn>
      <IconBtn label="Configurações dos pais" onClick={onSettings}>
        <Settings size={20} />
      </IconBtn>
    </>
  );
}

/** Seletor de nível por idade (mesmo mapa, desafios do tamanho de cada idade). */
export function AgeChip({ profile, onChange }: { profile: Profile; onChange: (a: AgeId) => void }) {
  const [open, setOpen] = useState(false);
  const cur = AGES.find((a) => a.id === profile.age) ?? AGES[1];
  useEffect(() => {
    if (!open) return;
    return registerBack(() => {
      setOpen(false);
      return true;
    });
  }, [open]);
  return (
    <div className="relative" data-coach="age">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="px-btn px-btn-plain px-notch !min-h-[40px] !px-2 text-[15px] flex items-center gap-1 whitespace-nowrap"
        aria-label="Escolher o nível por idade"
      >
        <span aria-hidden>{cur.icon}</span>
        {cur.id}
      </button>
      {open && (
        <div data-tv-modal className="absolute right-0 top-full mt-1 z-40 px-panel px-notch p-2 flex flex-col gap-1.5 w-44">
          {AGES.map((a) => (
            <button
              key={a.id}
              type="button"
              data-tv-autofocus={a.id === profile.age ? true : undefined}
              autoFocus={a.id === profile.age && isDpad()}
              onClick={() => {
                setOpen(false);
                if (a.id !== profile.age) onChange(a.id);
              }}
              className={`px-btn px-notch text-[15px] text-left ${a.id === profile.age ? 'px-btn-green' : 'px-btn-plain'}`}
            >
              {a.icon} {a.level}
              <span className="block text-[11px] opacity-70 leading-none">{a.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
