'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { Mascot, type MascotMood } from './Mascot';
import { DialogueBox } from './DialogueBox';
import { CoachLayer } from './CoachLayer';
import { IconBtn, SoundSettings, Stats } from './Hud';
import { IntroScreen, ProfileScreen, TitleScreen } from './Onboarding';
import { AlbumScreen, ResultScreen, WorldMap, WorldSelect, totalStars } from './MapScreens';
import { MemoryScreen, Portrait, SceneScreen, type MemoryResult } from './Scenes';
import { COACH_STEPS, type CoachStep } from '@/lib/game/coach';
import { useDialogue } from '@/lib/game/dialogue';
import {
  activeProfile, addAlly, addCoins, claimBonus, completePin, createProfile, hydrateGameStore, markCoachSeen,
  markIntroSeen, noteWeak, pinStars, relieveWeak, resetCoachIds, setActiveProfile, setProfileAge, useGameData,
} from '@/lib/game/store';
import { pinMath, pinWords, trainingMath, trainingWords, type MathItem, type WordItem } from '@/lib/game/content';
import { ALLY_LINES, BOSS_OF, STORIES, sceneBg } from '@/lib/game/story';
import type { AgeId, PinDef, WorldDef } from '@/lib/game/types';
import { pinUnlocked, starsFor, WORLDS } from '@/lib/game/worlds';
import { askBrain, FALLBACK_FACTS, type BrainRequest } from '@/lib/brain';
import { usePiperState } from '@/lib/piperTts';

type Phase = 'title' | 'profile' | 'intro' | 'worlds' | 'map' | 'sceneOpen' | 'play' | 'sceneClose' | 'result' | 'album' | 'memory';

/** Conteúdo específico da fase (Nível Aprendiz) — null = o jogo usa as listas gerais. */
export interface StartCtx {
  age: AgeId;
  words?: WordItem[];
  math?: MathItem[];
  training: boolean;
}

interface ResultData {
  stars: number;
  coins: number;
  newItem: number | null;
  title?: string;
  speech?: string;
  bonusLines?: string[];
  ally?: { id: string; name: string; text: string } | null;
  variant: 'pin' | 'training' | 'memory';
}

/** O que a fase entrega para o jogo "por dentro" (soletrar / contas) — ver renderStage em page.tsx. */
export interface StageCtx {
  world: WorldDef;
  pin: PinDef;
  speak: (text: string, staticKey?: string) => Promise<void>;
  askTutor: (req: BrainRequest) => Promise<boolean>;
  /** `key` = palavra do desafio (alimenta o Momento Treino). */
  onWin: (key?: string) => void;
  onMistake: (key?: string) => void;
  onGiveUp: () => void;
  training: boolean;
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
  onStartPin: (world: WorldDef, pin: PinDef, ctx: StartCtx) => void;
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
  const [result, setResult] = useState<ResultData | null>(null);
  const [training, setTraining] = useState(false);
  const [combo, setCombo] = useState(0);
  const [comboToast, setComboToast] = useState<number | null>(null);
  const [bossAnim, setBossAnim] = useState<'hit' | 'taunt' | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [coach, setCoach] = useState<CoachStep | null>(null);

  const stats = useRef({ wins: 0, mistakes: 0, giveUps: 0, comboBonus: 0 });
  const pendingResult = useRef<ResultData | null>(null);
  const comboRef = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const { wins, mistakes, giveUps, comboBonus } = stats.current;
    const mascot = world.mascot ?? 'fox';

    if (training) {
      // Momento Treino: sem estrelas do mapa; bônus de moedas (cheio na 1ª vez perfeita)
      const perfect = mistakes + giveUps === 0;
      const key = `treino:${world.id}:${profile.age}:${pin.index}`;
      const coins = perfect ? claimBonus(profile.id, key, 10, 2) : (addCoins(profile.id, 3), 3);
      const data: ResultData = {
        variant: 'training', stars: perfect ? 3 : wins >= 2 ? 2 : 1, coins, newItem: null,
        title: 'TREINO CUMPRIDO!',
        speech: perfect ? 'Treino perfeito! Você acertou tudo sem errar!' : 'Bom treino! Praticando você fica cada vez melhor!',
        bonusLines: perfect ? [`Bônus de treino perfeito: +${coins} moedas`] : [`Treino concluído: +${coins} moedas`],
      };
      setResult(data);
      goPhase('result');
      return;
    }

    const stars = starsFor(mistakes, giveUps);
    const coins = wins * 2 + stars * 5 + comboBonus;
    const prev = pinStars(profile, world.id)[pin.index] ?? 0;
    const r = completePin(profile.id, world.id, pin.index, stars, coins, pin.rewardItem);
    let ally: ResultData['ally'] = null;
    const boss = BOSS_OF[world.id];
    if (pin.kind === 'boss' && boss && !profile.allies?.includes(boss.id)) {
      addAlly(profile.id, boss.id);
      ally = { id: boss.id, name: boss.name, text: boss.ally };
    }
    const data: ResultData = {
      variant: 'pin', stars, coins: r.coinsGained, newItem: r.newItem, ally,
      bonusLines: comboBonus > 0 ? [`Bônus de combo: +${comboBonus} moedas`] : undefined,
    };
    pendingResult.current = data;
    void mascot;
    if (prev === 0) {
      goPhase('sceneClose'); // 1ª vez: agradecimento do personagem e o que foi restaurado
    } else {
      setResult(data);
      goPhase('result');
    }
  }, [profile, world, pin, training, goPhase]);

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

  const showAnim = useCallback((a: 'hit' | 'taunt') => {
    setBossAnim(a);
    setTimeout(() => setBossAnim(null), 700);
  }, []);

  const handleWin = useCallback(
    (key?: string) => {
      flash('happy', 1500);
      showAnim('hit');
      if (profile && training && key) relieveWeak(profile.id, key);
      // combo: a cada 3 acertos seguidos, +1 moeda de bônus
      comboRef.current += 1;
      setCombo(comboRef.current);
      if (comboRef.current >= 3 && comboRef.current % 3 === 0) {
        stats.current.comboBonus += 1;
        setComboToast(comboRef.current);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setComboToast(null), 1700);
      }
      resolveOne('win');
    },
    [flash, showAnim, resolveOne, profile, training]
  );

  const handleGiveUp = useCallback(() => {
    comboRef.current = 0;
    setCombo(0);
    resolveOne('giveUp');
  }, [resolveOne]);

  const handleMistake = useCallback(
    (key?: string) => {
      stats.current.mistakes++;
      comboRef.current = 0;
      setCombo(0);
      flash('sad', 1000);
      showAnim('taunt');
      if (profile && key) noteWeak(profile.id, key);
    },
    [flash, showAnim, profile]
  );

  /** Monta o conteúdo da fase (Nível Aprendiz tem conteúdo próprio por fase). */
  const buildCtx = useCallback(
    (w: WorldDef, p: PinDef, isTraining: boolean): StartCtx => {
      const a = profile?.age ?? age;
      const ctx: StartCtx = { age: a, training: isTraining };
      if (isTraining) {
        if (a === '3-5') {
          if (w.subject === 'letras') ctx.words = trainingWords(profile?.weak, 3, a);
          else ctx.math = trainingMath(3);
        }
      } else if (w.subject === 'letras') ctx.words = pinWords(w.id, p.index, a) ?? undefined;
      else ctx.math = pinMath(p.index, a) ?? undefined;
      return ctx;
    },
    [profile, age]
  );

  const beginPlay = useCallback(
    (w: WorldDef, p: PinDef, isTraining: boolean) => {
      stats.current = { wins: 0, mistakes: 0, giveUps: 0, comboBonus: 0 };
      comboRef.current = 0;
      setCombo(0);
      if (finishTimer.current) clearTimeout(finishTimer.current);
      finishTimer.current = null;
      pendingResult.current = null;
      setPips(0);
      setResult(null);
      setPin(p);
      setTraining(isTraining);
      onStartPin(w, p, buildCtx(w, p, isTraining));
      goPhase('play');
    },
    [onStartPin, buildCtx, goPhase]
  );

  /** Abre uma fase do mapa: na 1ª vez começa pela cena da história; nas próximas vai direto ao jogo. */
  const startPin = useCallback(
    (p: PinDef) => {
      if (!world || !profile) return;
      const first = (pinStars(profile, world.id)[p.index] ?? 0) === 0;
      if (first && world.subject && STORIES[world.subject as 'letras' | 'matematica']?.[p.index]) {
        setPin(p);
        setTraining(false);
        goPhase('sceneOpen');
      } else {
        beginPlay(world, p, false);
      }
    },
    [world, profile, beginPlay, goPhase]
  );

  /** Momento Treino: 3 desafios com palavras/contas que a criança precisa praticar. */
  const startTraining = useCallback(
    (from: PinDef | null) => {
      if (!world) return;
      const p: PinDef = {
        index: from?.index ?? 0, name: 'Momento Treino', kind: 'normal',
        x: 0, y: 0, challenges: 3, rewardItem: -1, intro: '',
      };
      beginPlay(world, p, true);
    },
    [world, beginPlay]
  );

  const finishMemory = useCallback(
    (r: MemoryResult) => {
      if (!profile || !world) return;
      const key = `memoria:${world.id}:${profile.age}`;
      const coins = claimBonus(profile.id, key, r.perfect ? 10 : 6, 2);
      setResult({
        variant: 'memory', stars: r.perfect ? 3 : r.moves <= r.pairs * 2 ? 2 : 1, coins, newItem: null,
        title: 'MEMÓRIA COMPLETA!',
        speech: r.perfect ? 'Que memória incrível! Você achou todos os pares com pouquíssimas jogadas!' : 'Muito bem! Você achou todos os pares!',
        bonusLines: [`Bônus da memória: +${coins} moedas`, `Jogadas: ${r.moves}`],
      });
      setPin(null);
      goPhase('result');
    },
    [profile, world, goPhase]
  );

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current);
      if (moodTimer.current) clearTimeout(moodTimer.current);
      if (toastTimer.current) clearTimeout(toastTimer.current);
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

  const screenKey = phase === 'worlds' ? 'worlds' : phase === 'map' ? 'map' : phase === 'result' ? 'result' : phase === 'memory' ? 'memory' : phase === 'play' ? (world?.subject === 'letras' ? 'play-letras' : 'play-matematica') : null;

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
      // o tutorial fala pelo mascote do mundo atual (Rufo nas Letras, Sofia na Grécia); no mapa-múndi, o Rufo
      if (next) setCoach(screenKey === 'worlds' || !world?.mascot ? next : { ...next, mascot: world.mascot });
    }, 700);
    return () => clearInterval(t);
  }, [screenKey, paused, coach, phase, sheetOpen, data.coachSeen, world]);

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
        onTrain={() => startTraining(null)}
        onMemory={() => goPhase('memory')}
        ally={
          world && BOSS_OF[world.id] && profile.allies?.includes(BOSS_OF[world.id].id) ? BOSS_OF[world.id].id : null
        }
        onAlly={() => {
          const id = world ? BOSS_OF[world.id]?.id : null;
          if (!id) return;
          const lines = ALLY_LINES[id] ?? [];
          factN.current++;
          void dialogue.say(lines[factN.current % Math.max(lines.length, 1)] ?? 'Oi!', { mascot: id });
        }}
        {...top}
      />
    );
  } else if ((phase === 'sceneOpen' || phase === 'sceneClose') && profile && world && pin && world.subject) {
    const story = STORIES[world.subject as 'letras' | 'matematica'][pin.index];
    const closing = phase === 'sceneClose';
    body = (
      <SceneScreen
        key={phase}
        title={pin.name}
        scene={pin.scene}
        lines={closing ? story.close : story.open}
        npc={story.npc}
        mascot={world.mascot ?? 'fox'}
        playerName={profile.name}
        dialogue={dialogue}
        doneLabel={closing ? 'Continuar ▶' : 'Vamos lá! ▶'}
        onDone={() => {
          if (closing) {
            setResult(pendingResult.current);
            goPhase('result');
          } else {
            beginPlay(world, pin, false);
          }
        }}
        {...top}
      />
    );
  } else if (phase === 'memory' && profile && world && world.subject) {
    body = (
      <MemoryScreen
        key="memory"
        subject={world.subject as 'letras' | 'matematica'}
        age={profile.age}
        mascot={world.mascot ?? 'fox'}
        dialogue={dialogue}
        onFinish={finishMemory}
        onBack={() => goPhase('map')}
        {...top}
      />
    );
  } else if (phase === 'album' && profile) {
    body = <AlbumScreen profile={profile} onBack={() => goPhase(world ? 'map' : 'worlds')} />;
  } else if (phase === 'result' && profile && world && result) {
    const stars = pinStars(profile, world.id);
    const next = result.variant === 'pin' && pin ? world.pins[pin.index + 1] : undefined;
    body = (
      <ResultScreen
        world={world}
        pin={result.variant === 'pin' ? pin : null}
        title={result.title}
        speech={result.speech}
        bonusLines={result.bonusLines}
        ally={result.ally}
        stars={result.stars}
        coins={result.coins}
        newItem={result.newItem}
        dialogue={dialogue}
        hasNext={Boolean(next && pinUnlocked(stars, next))}
        onNext={() => next && startPin(next)}
        onMap={() => goPhase('map')}
        onRetry={() => {
          if (result.variant === 'memory') goPhase('memory');
          else if (result.variant === 'training') startTraining(pin);
          else if (pin) beginPlay(world, pin, false);
        }}
        onTrain={() => startTraining(result.variant === 'pin' ? pin : null)}
        onMemory={() => goPhase('memory')}
      />
    );
  } else if (phase === 'play' && profile && world && pin) {
    body = (
      <div className="game-root relative flex-1 min-h-0 flex flex-col" style={sceneBg(training ? undefined : pin.scene)}>
        <div className="absolute inset-0 bg-[#1a1033]/30" />
        <div className="relative z-10 mx-auto w-full max-w-xl flex-1 min-h-0 flex flex-col">
        {/* barra de cima */}
        <div className="relative z-10 flex items-center gap-1.5 p-2">
          <span data-coach="back">
            <IconBtn label="Voltar ao mapa" onClick={backToMap}>
              <ArrowLeft size={20} />
            </IconBtn>
          </span>
          <div className="flex-1 min-w-0 px-panel px-notch px-2 py-1">
            <p className="px-title text-[9px] truncate">{training ? '💪 ' : ''}{pin.name}</p>
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

        {/* chefe: barra de vida (cada acerto tira um pedaço) */}
        {pin.kind === 'boss' && !training && BOSS_OF[world.id] && (
          <div data-coach="boss-bar" className="relative z-10 px-2 pt-1.5 flex items-center gap-2">
            <span className={bossAnim === 'hit' ? 'mascot-sad' : ''}>
              <Portrait who={BOSS_OF[world.id].id} size={58} talking={bossAnim === 'taunt'} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="px-title text-[8px] text-[#fff4d6] [text-shadow:2px_2px_0_#3b2a1a] mb-1">{BOSS_OF[world.id].name.toUpperCase()}</p>
              <div className="flex gap-0.5" aria-label={`Vida do chefe: ${Math.max(0, pin.challenges - pips)} de ${pin.challenges}`}>
                {Array.from({ length: pin.challenges }).map((_, i) => (
                  <span key={i} className={`h-3.5 flex-1 border-2 border-[#3b2a1a] ${i < pin.challenges - pips ? 'bg-[#e8624a]' : 'bg-[#4a3a66]'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {comboToast !== null && (
          <div className="absolute z-30 left-1/2 top-24 -translate-x-1/2 pointer-events-none">
            <span className="px-title px-notch px-3 py-2 bg-[#facc15] text-[#3b2a1a] border-4 border-[#3b2a1a] text-[12px] px-float inline-block">
              COMBO ×{comboToast}! +1
            </span>
          </div>
        )}

        {/* o jogo por dentro */}
        <div className="relative z-10 flex-1 min-h-0 px-2 pt-2 pb-2">
          <div className="game-stage max-h-full overflow-y-auto p-1 flex flex-col items-center">
            {/* speak/askTutor só são chamados em eventos e effects dos jogos — nunca durante o render */}
            {/* eslint-disable-next-line react-hooks/refs */}
            {renderStage({
              world, pin, speak, askTutor,
              onWin: handleWin,
              onMistake: handleMistake,
              onGiveUp: handleGiveUp,
              training,
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
