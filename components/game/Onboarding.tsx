'use client';

import { useEffect, useRef, useState } from 'react';
import { Mascot } from './Mascot';
import { DialogueBox } from './DialogueBox';
import { AGES, MASCOTS, type AgeId, type Profile } from '@/lib/game/types';
import type { DialogueApi } from '@/lib/game/dialogue';
import { enablePiper, isPiperSupported, usePiperState, PIPER_ENABLED } from '@/lib/piperTts';
import { isDpad } from '@/lib/dpad';
import { textKey } from '@/lib/voice/ids';
import { INTRO_TEMPLATES } from '@/lib/game/story';

const PARK = { backgroundImage: 'url(/game/park.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' } as const;

/* ------------------------------------------------------------------ Título */

interface TitleProps {
  profiles: Profile[];
  active: Profile | null;
  onPlay: () => void;
  onNewPlayer: () => void;
  onPick: (id: string) => void;
}

export function TitleScreen({ profiles, active, onPlay, onNewPlayer, onPick }: TitleProps) {
  return (
    <div className="game-root relative flex-1 min-h-0 overflow-hidden flex flex-col items-center" style={PARK}>
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1033]/55 via-transparent to-[#1a1033]/70" />
      <div className="relative z-10 mt-[7dvh] text-center px-4">
        <h1 className="px-title text-[#fff4d6] text-[26px] sm:text-[34px] [text-shadow:4px_4px_0_#3b2a1a]">SOLETRANDO</h1>
        <p className="px-title text-[#facc15] text-[13px] sm:text-[16px] mt-3 [text-shadow:3px_3px_0_#3b2a1a]">& CALCULANDO</p>
      </div>

      <div className="relative z-10 flex-1 min-h-0 w-full flex items-end justify-center gap-3 px-4">
        <Mascot id="fox" size={190} mood="wave" className="mb-2" />
        <Mascot id="owl" size={170} mood="idle" flip className="mb-2" />
      </div>

      <div className="relative z-10 w-full max-w-xs px-4 pb-6 flex flex-col gap-3">
        {active ? (
          <button type="button" data-tv-autofocus onClick={onPlay} className="px-btn px-btn-green px-notch px-title text-[13px] py-4">
            CONTINUAR
            <span className="block text-[11px] mt-1 font-sans normal-case tracking-normal" style={{ fontFamily: 'Pixelify' }}>
              {active.name}
            </span>
          </button>
        ) : (
          <button type="button" data-tv-autofocus onClick={onNewPlayer} className="px-btn px-btn-green px-notch px-title text-[14px] py-4">
            JOGAR
          </button>
        )}
        {profiles.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {profiles
              .filter((p) => p.id !== active?.id)
              .map((p) => (
                <button key={p.id} type="button" onClick={() => onPick(p.id)} className="px-btn px-btn-plain px-notch text-[15px]">
                  {p.name}
                </button>
              ))}
            <button type="button" onClick={onNewPlayer} className="px-btn px-btn-blue px-notch text-[15px]">
              + Novo jogador
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Perfil */

interface ProfileProps {
  onCreate: (name: string, age: AgeId) => void;
  onBack?: () => void;
}

export function ProfileScreen({ onCreate, onBack }: ProfileProps) {
  const [step, setStep] = useState<'who' | 'voice'>('who');
  const [name, setName] = useState('');
  const [age, setAge] = useState<AgeId>('3-5');
  const piper = usePiperState();
  const supported = PIPER_ENABLED && typeof window !== 'undefined' && isPiperSupported();
  const busy = piper.status === 'downloading' || piper.status === 'loading';
  const ready = piper.status === 'ready' && piper.enabled;

  return (
    <div className="game-root relative flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4" style={PARK}>
      <div className="absolute inset-0 bg-[#1a1033]/60" />
      <div className="relative z-10 w-full max-w-sm px-panel px-notch p-4">
        {step === 'who' ? (
          <>
            <div className="flex items-end gap-3 mb-3">
              <Mascot id="fox" size={84} mood="wave" />
              <p className="text-[18px] leading-snug pb-1">Oi! Eu sou o <b>Rufo</b>. Qual é o seu nome?</p>
            </div>
            <input
              autoFocus={!isDpad()}
              value={name}
              maxLength={14}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full px-3 py-3 text-[20px] bg-white border-4 border-[#3b2a1a] outline-none focus:border-[#f59e0b]"
              style={{ fontFamily: 'Pixelify' }}
            />
            {/* Sem teclado (TV/controle): nomes rápidos para escolher com as setas */}
            <div className="flex flex-wrap gap-1.5 mt-2" aria-label="Nomes rápidos">
              {['Ana', 'Bia', 'Léo', 'Davi', 'Mia', 'Théo', 'Sofia', 'Pedro'].map((n) => (
                <button key={n} type="button" onClick={() => setName(n)} className={`px-btn px-notch !min-h-[36px] !py-0 text-[15px] ${name === n ? 'px-btn-green' : 'px-btn-plain'}`}>
                  {n}
                </button>
              ))}
            </div>
            <p className="text-[16px] mt-4 mb-2 font-bold">Quantos anos você tem?</p>
            <div className="grid grid-cols-2 gap-2">
              {AGES.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAge(a.id)}
                  className={`px-btn px-notch text-[16px] ${age === a.id ? 'px-btn-green' : 'px-btn-plain'}`}
                >
                  <span className="mr-1">{a.icon}</span>
                  {a.level}
                  <span className="block text-[12px] opacity-70 leading-none">{a.label}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-4">
              {onBack && (
                <button type="button" onClick={onBack} className="px-btn px-btn-plain px-notch">
                  Voltar
                </button>
              )}
              <button
                type="button"
                disabled={!name.trim()}
                onClick={() => (supported ? setStep('voice') : onCreate(name, age))}
                className="px-btn px-btn-green px-notch flex-1 text-[18px]"
              >
                Próximo ▶
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-end gap-3 mb-3">
              <Mascot id="owl" size={84} mood={busy ? 'think' : 'idle'} flip />
              <p className="text-[18px] leading-snug pb-1">
                Para ouvir a <b>voz dos amigos</b>, preciso baixar um pacotinho de voz.
              </p>
            </div>
            <div className="bg-white/70 border-4 border-[#3b2a1a]/30 p-3 text-[16px] leading-snug mb-3">
              Tamanho: <b>63 MB</b> (só uma vez, use o Wi-Fi). Depois disso a voz funciona <b>sem internet</b>.
              {piper.error && <p className="mt-2 text-[#b91c1c] font-bold">{piper.error}</p>}
            </div>
            {busy && (
              <div className="h-5 w-full bg-[#e6cf9c] border-4 border-[#3b2a1a] mb-3">
                <div className="h-full bg-[#6cc24a]" style={{ width: `${Math.round((piper.status === 'loading' ? 1 : piper.progress) * 100)}%` }} />
              </div>
            )}
            <div className="flex flex-col gap-2">
              {!ready && (
                <button type="button" data-tv-autofocus disabled={busy} onClick={() => enablePiper()} className="px-btn px-btn-blue px-notch text-[18px]">
                  {busy ? `Baixando ${Math.round(piper.progress * 100)}%…` : '⬇ Baixar a voz'}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => onCreate(name, age)}
                className={`px-btn px-notch text-[18px] ${ready ? 'px-btn-green' : 'px-btn-plain'}`}
              >
                {ready ? '✔ Pronto! Vamos jogar' : 'Agora não (jogar sem a voz)'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Introdução */

type Who = 'fox' | 'owl';
const script = (name: string) => INTRO_TEMPLATES.map((l) => ({ ...l, text: l.text.replace('{nome}', name) }));

interface IntroProps {
  profile: Profile;
  dialogue: DialogueApi;
  onFinish: () => void;
}

export function IntroScreen({ profile, dialogue, onFinish }: IntroProps) {
  const [speaker, setSpeaker] = useState<Who>('fox');
  const [i, setI] = useState(0);
  const [done, setDone] = useState(false);
  const lines = script(profile.name);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    (async () => {
      for (let k = 0; k < lines.length; k++) {
        if (cancelled) return;
        setI(k);
        setSpeaker(lines[k].who);
        await dialogue.say(lines[k].text, { mascot: lines[k].who, audioKey: textKey(INTRO_TEMPLATES[k].text) });
        if (cancelled) return;
        await new Promise((r) => setTimeout(r, 700));
      }
      if (!cancelled) setDone(true);
    })();
    return () => {
      cancelled = true;
      alive.current = false;
      dialogue.stop();
    };
    // roda uma vez ao entrar na tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const talking = dialogue.status === 'typing';

  return (
    <div data-tv-cutscene className="game-root relative flex-1 min-h-0 overflow-hidden flex flex-col" style={PARK}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#1a1033]/60" />
      <button
        type="button"
        onClick={() => {
          dialogue.stop();
          onFinish();
        }}
        className="absolute top-3 right-3 z-20 px-btn px-btn-plain px-notch text-[15px]"
      >
        Pular ▶▶
      </button>
      <div className="relative z-10 flex-1 min-h-0 flex items-end justify-center gap-2 px-4">
        <Mascot id="fox" size={210} mood={speaker === 'fox' && talking ? 'talk' : i === 0 && speaker === 'fox' ? 'wave' : 'idle'} dim={speaker !== 'fox'} />
        <Mascot id="owl" size={190} flip mood={speaker === 'owl' && talking ? 'talk' : 'idle'} dim={speaker !== 'owl'} />
      </div>
      <div className="relative z-10 px-3 pb-4 pt-2 mx-auto w-full max-w-md">
        <DialogueBox
          dialogue={dialogue}
          choices={done ? [{ label: 'Começar a aventura!', onClick: onFinish, tone: 'green' }] : undefined}
        />
        <p className="text-center text-[12px] text-[#fff4d6]/80 mt-2">
          {MASCOTS[lines[i].who].name} · {i + 1}/{lines.length}
        </p>
      </div>
    </div>
  );
}
