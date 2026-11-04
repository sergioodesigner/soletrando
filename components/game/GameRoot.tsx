'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Mascot, type MascotMood } from './Mascot';
import { DialogueBox } from './DialogueBox';
import { CoachLayer } from './CoachLayer';
import { IconBtn, SoundSettings, Stats } from './Hud';
import { IntroScreen, ProfileScreen, TitleScreen } from './Onboarding';
import { AlbumScreen, ResultScreen, WorldMap, WorldSelect, totalStars } from './MapScreens';
import { COACH_STEPS, type CoachStep } from '@/lib/game/coach';
import { useDialogue } from '@/lib/game/dialogue';
import {
  activeProfile, completePin, createProfile, hydrateGameStore, markCoachSeen, markIntroSeen,
  pinStars, resetCoachIds, setActiveProfile, setProfileAge, useGameData,
} from '@/lib/game/store';
import type { AgeId, PinDef, WorldDef } from '@/lib/game/types';
import { pinUnlocked, starsFor, WORLDS } from '@/lib/game/worlds';
import { askBrain, FALLBACK_FACTS, type BrainRequest } from '@/lib/brain';
import { usePiperState } from '@/lib/piperTts';

type Phase = 'title' | 'profile' | 'intro' | 'worlds' | 'map' | 'play' | 'result' | 'album';

/** O que a fase entrega para o jogo "por dentro" (soletrar / contas) — ver renderStage em page.tsx. */
export interface StageCtx {
  world: WorldDef;
  pin: PinDef;
  speak: (text: string, staticKey?: string) => Promise<void>;
  askTutor: (req: BrainRequest) => Promise<boolean>;
  onWin: () => void;
  onMistake: () => void;
  onGiveUp: () => void;
}

interface Props {
  age: AgeId;
  onAgeChange: (a: AgeId) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenSettings: () => void;
  /** Alguma janela (configurações etc.) está por cima: pausa os tutoriais. */
  paused: boolean;
  /** Tutor Gemini disponível (ligado, online e no modo híbrido). */
  brainActive: boolean;
  onStartPin: (world: WorldDef, pin: PinDef) => void;
  renderStage: (ctx: StageCtx) => React.ReactNode;
}

export function GameRoot({
  age, onAgeChange, soundEnabled, onToggleSound, onOpenSettings, paused, brainActive, onStartPin, renderStage,
}: Props) {
  const data = useGameData();
  const profile = activeProfile(data);
  const piper = usePiperState();
  const dialogue = useDialogue({ soundEnabled, preferPiper: piper.enabled && piper.status === 'ready' });

  const [phase, setPhase] = useState<Phase>('title');
  const [world, setWorld] = useState<WorldDef | null>(null);
  const [pin, setPin] = useState<PinDef | null>(null);
  const [mood, setMood] = useState<MascotMood>('idle');
  const [pips, setPips] = useState(0);
  const [result, setResult] = useState<{ stars: number; coins: number; newItem: number | null } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [coach, setCoach] = useState<CoachStep | null>(null);

  const stats = useRef({ wins: 0, mistakes: 0, giveUps: 0 });
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speakSeq = useRef(0);
  const factN = useRef(0);

  useEffect(() => {
    hydrateGameStore();
    const w = window as unknown as { __soletrandoGameActive?: boolean };
    w.__soletrandoGameActive = true;
    return () => {
      w.__soletrandoGameActive = false;
    };
  }, []);

  // a idade do perfil manda no nível do jogo
  useEffect(() => {
    if (profile && profile.age !== age) onAgeChange(profile.age);
  }, [profile, age, onAgeChange]);

  const mascotId = world?.mascot ?? 'fox';

  const flash = useCallback((m: MascotMood, ms = 1100) => {
    setMood(m);
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood('idle'), ms);
  }, []);

  const goPhase = useCallback(
    (p: Phase) => {
      dialogue.stop();
      setCoach(null);
      setPhase(p);
    },
    [dialogue]
  );

  const changeAge = useCallback(
    (a: AgeId) => {
      if (!profile) return;
      setProfileAge(profile.id, a);
      onAgeChange(a);
    },
    [profile, onAgeChange]
  );

  /* ---------------- sessão da fase ---------------- */

  const finish = useCallback(() => {
    if (!profile || !world || !pin) return;
    const { wins, mistakes, giveUps } = stats.current;
    const stars = starsFor(mistakes, giveUps);
    const coins = wins * 2 + stars * 5;
    const r = completePin(profile.id, world.id, pin.index, stars, coins, pin.rewardItem);
    setResult({ stars, coins: r.coinsGained, newItem: r.newItem });
    goPhase('result');
  }, [profile, world, pin, goPhase]);

  const resolveOne = useCallback(
    (kind: 'win' | 'giveUp') => {
      if (!pin) return;
      stats.current[kind === 'win' ? 'wins' : 'giveUps']++;
      const n = stats.current.wins + stats.current.giveUps;
      setPips(n);
      if (n >= pin.challenges && !finishTimer.current) {
        finishTimer.current = setTimeout(() => {
          finishTimer.current = null;
          finish();
        }, 2600);
      }
    },
    [pin, finish]
  );

  const handleWin = useCallback(() => {
    flash('happy', 1500);
    resolveOne('win');
  }, [flash, resolveOne]);

  const handleGiveUp = useCallback(() => resolveOne('giveUp'), [resolveOne]);

  const handleMistake = useCallback(() => {
    stats.current.mistakes++;
    flash('sad', 1000);
  }, [flash]);

  const startPin = useCallback(
    (p: PinDef) => {
      if (!world) return;
      stats.current = { wins: 0, mistakes: 0, giveUps: 0 };
      if (finishTimer.current) clearTimeout(finishTimer.current);
      finishTimer.current = null;
      setPips(0);
      setResult(null);
      setPin(p);
      onStartPin(world, p);
      goPhase('play');
    },
    [world, onStartPin, goPhase]
  );

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (moodTimer.current) clearTimeout(moodTimer.current);
    },
    []
  );

  const backToMap = () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
    finishTimer.current = null;
    goPhase('map');
  };

  /* ---------------- fala / tutor dentro da fase ---------------- */

  const speak = useCallback(
    (text: string, staticKey?: string) => {
      speakSeq.current++;
      const tiny = text.trim().length <= 2 || /^letra_/.test(staticKey ?? '');
      return dialogue.say(text, { mascot: mascotId, staticKey, bubble: !tiny });
    },
    [dialogue, mascotId]
  );

  const askTutor = useCallback(
    async (req: BrainRequest) => {
      if (!brainActive) return false;
      const seq = speakSeq.current;
      flash('think', 3000); // o mascote "pensa" enquanto o Gemini escreve a dica
      const reply = await askBrain(req);
      if (!reply?.text || seq !== speakSeq.current) return false;
      speakSeq.current++;
      void dialogue.say(reply.text, { mascot: mascotId, ephemeral: true });
      return true;
    },
    [brainActive, dialogue, mascotId, flash]
  );

  const fetchFact = useCallback(async () => {
    const w = (world?.subject ?? 'letras') as 'letras' | 'matematica';
    factN.current++;
    if (brainActive) {
      const r = await askBrain({ task: 'fun_fact', ageGroup: age, world: w, n: factN.current });
      if (r?.text) return r.text;
    }
    const list = FALLBACK_FACTS[w];
    return list[(factN.current - 1) % list.length];
  }, [world, brainActive, age]);

  /* ---------------- tutoriais de primeira vez ---------------- */

  const screenKey = phase === 'map' ? 'map' : phase === 'play' ? (world?.subject === 'letras' ? 'play-letras' : 'play-matematica') : null;

  useEffect(() => {
    if (!screenKey || paused || coach || (phase === 'map' && sheetOpen)) return;
    const visible = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    };
    const t = setInterval(() => {
      const next = COACH_STEPS.find(
        (s) => !data.coachSeen[s.id] && (s.screen === screenKey || (s.screen === 'play' && phase === 'play')) && visible(s.target)
      );
      if (next) setCoach(next);
    }, 700);
    return () => clearInterval(t);
  }, [screenKey, paused, coach, phase, sheetOpen, data.coachSeen]);

  const closeCoach = useCallback(() => {
    if (coach) markCoachSeen(coach.id);
    dialogue.stop();
    setCoach(null);
  }, [coach, dialogue]);

  const skipAllCoach = useCallback(() => {
    COACH_STEPS.filter((s) => s.screen === screenKey || (s.screen === 'play' && phase === 'play')).forEach((s) => markCoachSeen(s.id));
    dialogue.stop();
    setCoach(null);
  }, [screenKey, phase, dialogue]);

  /** "Como se joga?": faz as explicações da tela atual reaparecerem. */
  const replayCoach = useCallback(
    (key: 'map' | 'play') => {
      const ids = COACH_STEPS.filter((s) =>
        key === 'map' ? s.screen === 'map' : s.screen !== 'map'
      ).map((s) => s.id);
      resetCoachIds(ids);
      setCoach(null);
    },
    []
  );

  /* ---------------- telas ---------------- */

  const top = { soundEnabled, onToggleSound, onSettings: onOpenSettings };

  if (!data.ready) return <div className="flex-1 bg-[#1a1033]" />;

  let body: React.ReactNode = null;

  if (phase === 'title' || (!profile && phase !== 'profile')) {
    body = (
      <TitleScreen
        profiles={data.profiles}
        active={profile}
        onPlay={() => goPhase(profile && !profile.introSeen ? 'intro' : 'worlds')}
        onNewPlayer={() => goPhase('profile')}
        onPick={(id) => {
          setActiveProfile(id);
        }}
      />
    );
  } else if (phase === 'profile') {
    body = (
      <ProfileScreen
        onBack={() => goPhase('title')}
        onCreate={(name, a) => {
          createProfile(name, a);
          onAgeChange(a);
          goPhase('intro');
        }}
      />
    );
  } else if (phase === 'intro' && profile) {
    body = (
      <IntroScreen
        profile={profile}
        dialogue={dialogue}
        onFinish={() => {
          markIntroSeen(profile.id);
          goPhase('worlds');
        }}
      />
    );
  } else if (phase === 'worlds' && profile) {
    body = (
      <WorldSelect
        profile={profile}
        dialogue={dialogue}
        onPick={(w) => {
          setWorld(w);
          goPhase('map');
        }}
        onAlbum={() => goPhase('album')}
        onTitle={() => goPhase('title')}
        onAge={changeAge}
        {...top}
      />
    );
  } else if (phase === 'map' && profile && world) {
    body = (
      <WorldMap
        world={world}
        profile={profile}
        dialogue={dialogue}
        mood={mood}
        onStart={startPin}
        onBack={() => goPhase('worlds')}
        onAlbum={() => goPhase('album')}
        onAge={changeAge}
        onSheetOpen={setSheetOpen}
        onHowToPlay={() => replayCoach('map')}
        onFact={fetchFact}
        {...top}
      />
    );
  } else if (phase === 'album' && profile) {
    body = <AlbumScreen profile={profile} onBack={() => goPhase(world ? 'map' : 'worlds')} />;
  } else if (phase === 'result' && profile && world && pin && result) {
    const stars = pinStars(profile, world.id);
    const next = world.pins[pin.index + 1];
    body = (
      <ResultScreen
        world={world}
        pin={pin}
        stars={result.stars}
        coins={result.coins}
        newItem={result.newItem}
        dialogue={dialogue}
        hasNext={Boolean(next && pinUnlocked(stars, next))}
        onNext={() => next && startPin(next)}
        onMap={() => goPhase('map')}
        onRetry={() => startPin(pin)}
      />
    );
  } else if (phase === 'play' && profile && world && pin) {
    body = (
      <div className="game-root relative flex-1 min-h-0 flex flex-col" style={{ backgroundImage: 'url(/game/park.jpg)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-[#1a1033]/55" />
        {/* barra de cima */}
        <div className="relative z-10 flex items-center gap-1.5 p-2">
          <span data-coach="back">
            <IconBtn label="Voltar ao mapa" onClick={backToMap}>
              <ArrowLeft size={20} />
            </IconBtn>
          </span>
          <div className="flex-1 min-w-0 px-panel px-notch px-2 py-1">
            <p className="px-title text-[9px] truncate">{pin.name}</p>
            <div className="flex gap-1 mt-1" aria-label={`Progresso ${pips} de ${pin.challenges}`}>
              {Array.from({ length: pin.challenges }).map((_, i) => (
                <span key={i} className={`h-2.5 flex-1 border-2 border-[#3b2a1a] ${i < pips ? 'bg-[#6cc24a]' : 'bg-[#e6cf9c]'}`} />
              ))}
            </div>
          </div>
          <Stats stars={totalStars(profile)} coins={profile.coins} />
          <SoundSettings {...top} />
        </div>

        {/* mascote + balão */}
        <div className="relative z-10 px-2 flex items-end gap-2">
          <Mascot
            id={mascotId}
            size={92}
            flip={mascotId === 'owl'}
            mood={dialogue.status === 'typing' ? 'talk' : mood}
            className="shrink-0"
            data-coach="mascot-play"
            onClick={() => {
              void dialogue.say('Estou aqui com você! Toque no "?" azul se quiser rever as explicações.', { mascot: mascotId });
            }}
          />
          <DialogueBox
            data-coach="bubble"
            dialogue={dialogue}
            className={`flex-1 ${coach && !coach.target.includes('bubble') ? 'invisible' : ''}`}
            idleHint={`Vamos lá, ${profile.name}! Eu falo e escrevo aqui para você.`}
          />
        </div>

        {/* o jogo por dentro */}
        <div className="relative z-10 flex-1 min-h-0 px-2 pt-2 pb-2">
          <div className="h-full px-panel px-notch overflow-y-auto p-1.5 flex flex-col items-center">
            {/* speak/askTutor só são chamados em eventos e effects dos jogos — nunca durante o render */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {renderStage({
              world, pin, speak, askTutor,
              onWin: handleWin,
              onMistake: handleMistake,
              onGiveUp: handleGiveUp,
            })}
          </div>
        </div>
        <div className="absolute z-20 right-3" style={{ bottom: 10 }}>
          <button
            type="button"
            onClick={() => replayCoach('play')}
            className="px-btn px-btn-blue px-notch !min-h-[40px] !min-w-[40px] !p-1 flex items-center justify-center"
            aria-label="Como se joga? Rever as explicações"
            title="Como se joga?"
          >
            <HelpCircle size={22} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {body}
      {coach && !paused && (
        <>
          <CoachLayer step={coach} dialogue={dialogue} onDone={closeCoach} />
          <button
            type="button"
            onClick={skipAllCoach}
            className="game-root fixed z-[64] top-2 right-2 px-btn px-btn-plain px-notch !min-h-[34px] !py-0 text-[13px]"
          >
            Pular explicações
          </button>
        </>
      )}
    </>
  );
}

export { WORLDS };
