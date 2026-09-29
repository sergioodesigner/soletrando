'use client';

import React, { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { 
  Settings, 
  Lightbulb, 
  Trash2, 
  Plus, 
  Volume1, 
  Volume2, 
  VolumeX, 
  Star, 
  Sparkles, 
  Calculator, 
  BookOpen, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Shuffle,
  Bot,
  Check,
  Download,
  Wifi,
  WifiOff,
  HelpCircle,
  Smartphone,
  Tv
} from 'lucide-react';
import { 
  playSmartAudio, 
  playSoundFx, 
  PT_LETTER_PHONETICS, 
  getAvailablePtVoices, 
  setSelectedVoice, 
  pickBestDefaultPtVoice, 
  getCachedAudioCount, 
  clearCachedAudios, 
  stopAllAudio,
  isTtsQuotaExhausted
} from '@/lib/audioEngine';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useTvMode } from '@/hooks/useTvMode';
import { initTvSpatialNavigation, focusFirstTvControl } from '@/lib/tvSpatialNav';

// Normalize word to uppercase, remove accents and special chars
const normalizeWord = (w: string) => 
  w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/[^A-Z]/g, '');

// Ortografia falada (acentos + respelling) para o TTS acertar a sílaba tônica / o som.
// Chave = palavra do jogo (sem acento). Valor = como deve soar na narração.
const SPEECH_WORD_FORMS: Record<string, string> = {
  METAFORA: 'Metáfora',
  HIPOTESE: 'Hipótese',
  // "Paradoxo" sozinho o TTS costuma ler o X como "ch"; "quiso" força /ks/.
  PARADOXO: 'Paradóquiso',
  CONSCIENCIA: 'Consciência',
  RESILIENCIA: 'Resiliência',
  ATMOSFERA: 'Atmosfera'
};

// Formats uppercase word for natural Brazilian Portuguese TTS
const formatWordForSpeech = (w: string): string => {
  if (!w) return '';
  const upper = w.trim().toUpperCase();
  if (SPEECH_WORD_FORMS[upper]) return SPEECH_WORD_FORMS[upper];
  const clean = w.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

// Types
type AgeGroup = '3-5' | '6-8' | '9-11' | '12-14';
type Subject = 'letras' | 'matematica';

interface LetterItem {
  id: string;
  char: string;
  isTarget: boolean;
}

interface WordChallenge {
  word: string;
  clue?: string;
}

interface MathProblem {
  id: string;
  question: string;
  speechText: string;
  visualItems?: { emoji: string; total: number };
  visualSum?: { count1: number; emoji1: string; count2: number; emoji2: string };
  hint: string;
  options: (number | string)[];
  answer: number | string;
  explanation?: string;
}

// Initial Preset Words by Age Group
const INITIAL_WORDS: Record<AgeGroup, WordChallenge[]> = {
  '3-5': [
    { word: 'BOLA' },
    { word: 'GATO' },
    { word: 'CASA' },
    { word: 'SOL' },
    { word: 'PATO' },
    { word: 'PEIXE' },
    { word: 'DADO' },
    { word: 'URSO' },
    { word: 'LUA' },
    { word: 'SAPO' },
    { word: 'MAMA' },
    { word: 'PAPA' }
  ],
  '6-8': [
    { word: 'ESCOLA', clue: 'Lugar onde aprendemos e brincamos' },
    { word: 'PIPOCA', clue: 'Lanche crocante que estoura na panela' },
    { word: 'JANELA', clue: 'Abre para ver a luz do sol e o vento' },
    { word: 'AMIZADE', clue: 'O carinho sincero entre amigos' },
    { word: 'FOGUETE', clue: 'Voa alto em direção às estrelas' },
    { word: 'CANETA', clue: 'Usada para escrever no caderno' },
    { word: 'CAVALO', clue: 'Animal forte e veloz' },
    { word: 'ESTRELA', clue: 'Brilha no céu durante a noite' },
    { word: 'JARDIM', clue: 'Cheio de flores e plantas coloridas' }
  ],
  '9-11': [
    { word: 'DINOSSAURO', clue: 'Criaturas gigantes que habitaram a Terra no passado' },
    { word: 'AVENTURA', clue: 'Uma emocionante viagem cheia de desafios' },
    { word: 'UNIVERSO', clue: 'A imensidão com todos os planetas e galáxias' },
    { word: 'CORAGEM', clue: 'Força interior para enfrentar o desconhecido' },
    { word: 'NATUREZA', clue: 'O conjunto de florestas, rios, oceanos e animais' },
    { word: 'BRILHANTE', clue: 'Algo que reflete muita luz ou muito inteligente' },
    { word: 'BORBOLETA', clue: 'Inseto gracioso que passa por metamorfose' },
    { word: 'PLANETA', clue: 'Corpo celeste como a Terra, Marte ou Júpiter' }
  ],
  '12-14': [
    { word: 'METAFORA', clue: 'Figura de linguagem com comparação implícita' },
    { word: 'CONSCIENCIA', clue: 'Capacidade de perceber e julgar a própria mente' },
    { word: 'PARADOXO', clue: 'Ideia que desafia a lógica comum com sentidos opostos' },
    { word: 'ATMOSFERA', clue: 'Camada de gases que envolve e protege nosso planeta' },
    { word: 'HIPOTESE', clue: 'Suposição formulada para ser comprovada por experimentos' },
    { word: 'LABIRINTO', clue: 'Estrutura complexa de caminhos que desafia o raciocínio' },
    { word: 'RESILIENCIA', clue: 'Habilidade de se adaptar e superar momentos difíceis' },
    { word: 'FILOSOFIA', clue: 'Investigação profunda sobre a existência, mente e verdade' }
  ]
};

// Math Problems by Age Group
const MATH_PROBLEMS: Record<AgeGroup, MathProblem[]> = {
  '3-5': [
    {
      id: 'm3-1',
      question: 'Quantas maçãs você vê?',
      speechText: 'Quantas maçãs você vê? Toque nas maçãs para contar!',
      visualItems: { emoji: '🍎', total: 3 },
      hint: 'Toque em cada maçã para contar: 1, 2, 3!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 3
    },
    {
      id: 'm3-2',
      question: 'Quantas estrelinhas estão brilhando?',
      speechText: 'Quantas estrelinhas estão brilhando? Vamos contar!',
      visualItems: { emoji: '⭐', total: 5 },
      hint: 'Conte devagarzinho: 1, 2, 3, 4, 5 estrelas!',
      options: [2, 3, 4, 5, 6, 7],
      answer: 5
    },
    {
      id: 'm3-3',
      question: 'Quantos carrinhos você vê?',
      speechText: 'Quantos carrinhos você vê aqui na tela?',
      visualItems: { emoji: '🚗', total: 2 },
      hint: 'Tem 1 e depois 2!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 2
    },
    {
      id: 'm3-4',
      question: 'Quantos balões coloridos temos?',
      speechText: 'Quantos balões coloridos estão flutuando?',
      visualItems: { emoji: '🎈', total: 4 },
      hint: 'São quatro balões: 1, 2, 3, 4!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 4
    },
    {
      id: 'm3-5',
      question: 'Quantos gatinhos no total?',
      speechText: 'Dois gatinhos mais um gatinho. Quantos gatinhos ficam?',
      visualSum: { count1: 2, emoji1: '🐱', count2: 1, emoji2: '🐱' },
      hint: 'Junte 2 gatinhos com mais 1 gatinho = 3 gatinhos!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 3
    },
    {
      id: 'm3-6',
      question: 'Quantos cachorrinhos no total?',
      speechText: 'Um cachorrinho mais um cachorrinho. Quanto dá?',
      visualSum: { count1: 1, emoji1: '🐶', count2: 1, emoji2: '🐶' },
      hint: '1 mais 1 é igual a 2!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 2
    },
    {
      id: 'm3-7',
      question: 'Quantos sóis você vê no céu?',
      speechText: 'Quantos sóis você vê no céu?',
      visualItems: { emoji: '☀️', total: 1 },
      hint: 'Temos apenas um sol radiante!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 1
    }
  ],
  '6-8': [
    {
      id: 'm6-1',
      question: '5 + 4 = ?',
      speechText: 'Quanto é 5 mais 4?',
      hint: 'Pense: 5 mais 5 é 10, então 5 mais 4 é 9!',
      options: [7, 8, 9, 10, 11, 6],
      answer: 9
    },
    {
      id: 'm6-2',
      question: '8 + 7 = ?',
      speechText: 'Quanto é 8 mais 7?',
      hint: '8 mais 2 é 10, com mais 5 dá 15!',
      options: [13, 14, 15, 16, 17, 12],
      answer: 15
    },
    {
      id: 'm6-3',
      question: '10 - 4 = ?',
      speechText: 'Se você tem 10 e tira 4, quanto sobra?',
      hint: 'Conte voltando de 10 tirando 4: 9, 8, 7, 6!',
      options: [4, 5, 6, 7, 8, 9],
      answer: 6
    },
    {
      id: 'm6-4',
      question: '14 - 6 = ?',
      speechText: 'Quanto é 14 menos 6?',
      hint: '14 menos 4 é 10, menos 2 é 8!',
      options: [6, 7, 8, 9, 10, 5],
      answer: 8
    },
    {
      id: 'm6-5',
      question: '2, 4, 6, [ ? ]',
      speechText: 'Complete a sequência de 2 em 2: 2, 4, 6, e o próximo?',
      hint: 'Estamos contando de 2 em 2. Depois de 6 vem o 8!',
      options: [5, 6, 7, 8, 9, 10],
      answer: 8
    },
    {
      id: 'm6-6',
      question: 'Quanto falta para 10 se você tem 7?',
      speechText: 'Se você tem 7, quantos faltam para chegar no 10?',
      hint: '7 mais 3 dá 10!',
      options: [1, 2, 3, 4, 5, 6],
      answer: 3
    },
    {
      id: 'm6-7',
      question: '6 + 6 = ?',
      speechText: 'Qual é o dobro de 6? 6 mais 6!',
      hint: '6 mais 6 é uma dúzia: 12!',
      options: [9, 10, 11, 12, 13, 14],
      answer: 12
    }
  ],
  '9-11': [
    {
      id: 'm9-1',
      question: '7 × 8 = ?',
      speechText: 'Quanto é 7 vezes 8?',
      hint: 'Lembre-se da tabuada: 7 vezes 7 é 49. Some mais 7 e terá 56!',
      options: [48, 52, 54, 56, 58, 64],
      answer: 56
    },
    {
      id: 'm9-2',
      question: '6 × 9 = ?',
      speechText: 'Quanto é 6 vezes 9?',
      hint: '6 vezes 10 é 60. Subtraia 6 e você terá 54!',
      options: [48, 50, 52, 54, 56, 63],
      answer: 54
    },
    {
      id: 'm9-3',
      question: '48 ÷ 6 = ?',
      speechText: 'Quanto é 48 dividido por 6?',
      hint: 'Qual número multiplicado por 6 dá 48? É o 8!',
      options: [5, 6, 7, 8, 9, 10],
      answer: 8
    },
    {
      id: 'm9-4',
      question: '72 ÷ 9 = ?',
      speechText: 'Quanto é 72 dividido por 9?',
      hint: 'Pense: 9 vezes quanto é igual a 72? É o 8!',
      options: [6, 7, 8, 9, 10, 11],
      answer: 8
    },
    {
      id: 'm9-5',
      question: '45 + 38 = ?',
      speechText: 'Quanto é 45 mais 38?',
      hint: '45 mais 30 dá 75, mais 8 resulta em 83!',
      options: [79, 81, 83, 85, 87, 73],
      answer: 83
    },
    {
      id: 'm9-6',
      question: '100 - 37 = ?',
      speechText: 'Quanto é 100 menos 37?',
      hint: '100 menos 30 dá 70. 70 menos 7 dá 63!',
      options: [57, 60, 63, 67, 70, 73],
      answer: 63
    },
    {
      id: 'm9-7',
      question: 'Qual é o dobro de 18?',
      speechText: 'Qual é o dobro de 18?',
      hint: '18 vezes 2: 10x2=20 mais 8x2=16 -> 36!',
      options: [30, 32, 34, 36, 38, 40],
      answer: 36
    }
  ],
  '12-14': [
    {
      id: 'm12-1',
      question: 'x + 9 = 24. Quanto vale x?',
      speechText: 'Se x mais 9 é igual a 24, qual é o valor de x?',
      hint: 'Isole o x: subtraia 9 de 24. x = 24 - 9 = 15!',
      options: [11, 12, 13, 14, 15, 16],
      answer: 15,
      explanation: 'x = 24 - 9 = 15'
    },
    {
      id: 'm12-2',
      question: 'Quanto é 25% de 80?',
      speechText: 'Quanto é vinte e cinco por cento de oitenta?',
      hint: '25% é o mesmo que dividir por 4. 80 ÷ 4 = 20!',
      options: [10, 15, 20, 25, 30, 40],
      answer: 20,
      explanation: '80 ÷ 4 = 20'
    },
    {
      id: 'm12-3',
      question: 'Qual o valor de 3³ (3 ao cubo)?',
      speechText: 'Qual o valor de 3 elevado a 3?',
      hint: 'Multiplique 3 por ele mesmo 3 vezes: 3 × 3 = 9, e 9 × 3 = 27!',
      options: [9, 18, 21, 27, 36, 81],
      answer: 27,
      explanation: '3 × 3 × 3 = 27'
    },
    {
      id: 'm12-4',
      question: 'Qual é a raiz quadrada de 144 (√144)?',
      speechText: 'Qual é a raiz quadrada de 144?',
      hint: 'Qual número multiplicado por ele mesmo dá 144? 12 × 12 = 144!',
      options: [10, 11, 12, 13, 14, 16],
      answer: 12,
      explanation: '12 × 12 = 144'
    },
    {
      id: 'm12-5',
      question: 'Qual o resultado de 1/2 + 1/4?',
      speechText: 'Quanto é a fração um meio mais um quarto?',
      hint: '1/2 equivale a 2/4. Somando 2/4 + 1/4 obtemos 3/4!',
      options: ['1/4', '2/6', '1/2', '3/4', '2/4', '1/8'],
      answer: '3/4',
      explanation: '2/4 + 1/4 = 3/4'
    },
    {
      id: 'm12-6',
      question: '2x - 4 = 16. Quanto vale x?',
      speechText: 'Se 2x menos 4 é igual a 16, qual é o valor de x?',
      hint: 'Some 4 aos dois lados: 2x = 20. Divida por 2: x = 10!',
      options: [6, 8, 9, 10, 12, 14],
      answer: 10,
      explanation: '2x = 20 -> x = 10'
    },
    {
      id: 'm12-7',
      question: 'Se 3 livros custam R$ 15, quanto custam 6 livros?',
      speechText: 'Se 3 livros custam 15 reais, quanto custam 6 livros?',
      hint: '6 livros é o dobro de 3, logo o preço é o dobro de 15: R$ 30!',
      options: ['R$ 20', 'R$ 25', 'R$ 30', 'R$ 35', 'R$ 40', 'R$ 45'],
      answer: 'R$ 30',
      explanation: 'Dobro da quantidade = dobro do valor'
    }
  ]
};

// Vowels for hint system
const PT_VOWELS = new Set(['A','E','I','O','U']);
const isVowel = (c: string) => PT_VOWELS.has(c.toUpperCase());

// Helper to generate letter bank (normal difficulty)
function generateBank(word: string): LetterItem[] {
  const letters: LetterItem[] = word.split('').map((char, i) => ({
    id: `word-${i}-${char}`,
    char,
    isTarget: true
  }));

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const decoyCount = Math.max(3, 11 - word.length);
  for (let i = 0; i < decoyCount; i++) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    letters.push({
      id: `decoy-${i}-${randomChar}`,
      char: randomChar,
      isTarget: false
    });
  }
  return letters.sort(() => Math.random() - 0.5);
}

// Hard bank: word remaining letters + 3 fixed decoys + extra decoys by progress
function generateHardBank(word: string, spelledCount: number, extraDecoys: number): LetterItem[] {
  const remaining = word.slice(spelledCount).split('').map((char, i) => ({
    id: `word-${spelledCount + i}-${char}`,
    char,
    isTarget: true
  }));
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const totalDecoys = 3 + extraDecoys;
  const decoys: LetterItem[] = [];
  for (let i = 0; i < totalDecoys; i++) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    decoys.push({ id: `decoy-hard-${i}-${randomChar}`, char: randomChar, isTarget: false });
  }
  return [...remaining, ...decoys].sort(() => Math.random() - 0.5);
}

// -------------------------------------------------------------
// Letter Tracing Modal for 3-5 age group
// Strict path tracking: drawing outside is blocked and clipped to the letter stencil.
// Star checkpoints and musical chimes stimulate the child to trace inside the outline.
// -------------------------------------------------------------
const PENTATONIC_CHIMES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];

function playStarChime(index: number) {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = PENTATONIC_CHIMES[index % PENTATONIC_CHIMES.length] || 659.25;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.33, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Ignore audio autoplay restrictions
  }
}

function playWinSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.08);
      gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.08 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.4);
    });
  } catch {
    // Ignore
  }
}

interface StarPoint {
  id: number;
  x: number;
  y: number;
  collected: boolean;
}

function LetterTracingModal({
  letter,
  onSuccess
}: { letter: string; onSuccess: () => void }) {
  const CANVAS_SIZE = 300;
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const trackDataRef = useRef<Uint8ClampedArray | null>(null);

  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const offTrackTimer = useRef<NodeJS.Timeout | null>(null);

  const [stars, setStars] = useState<StarPoint[]>([]);
  const [coverage, setCoverage] = useState(0);
  const [offTrack, setOffTrack] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const bg = bgCanvasRef.current;
    const draw = drawCanvasRef.current;
    if (!bg || !draw) return;

    const bgCtx = bg.getContext('2d')!;
    const dCtx = draw.getContext('2d')!;

    bgCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    dCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    // Dynamic large font calculation to maximize letter size without clipping
    let fontSize = 230;
    bgCtx.font = `bold ${fontSize}px "Nunito", "Arial Rounded MT Bold", Arial, sans-serif`;
    let metrics = bgCtx.measureText(letter);
    while (metrics.width > CANVAS_SIZE - 46 && fontSize > 150) {
      fontSize -= 8;
      bgCtx.font = `bold ${fontSize}px "Nunito", "Arial Rounded MT Bold", Arial, sans-serif`;
      metrics = bgCtx.measureText(letter);
    }
    const fontStr = `bold ${fontSize}px "Nunito", "Arial Rounded MT Bold", Arial, sans-serif`;
    bgCtx.font = fontStr;
    bgCtx.textAlign = 'center';
    bgCtx.textBaseline = 'middle';

    const cx = CANVAS_SIZE / 2;
    const cy = CANVAS_SIZE / 2;

    // 1. Offscreen letter track mask (in-memory) for exact boundary check & counting
    const trackCanvas = document.createElement('canvas');
    trackCanvas.width = CANVAS_SIZE;
    trackCanvas.height = CANVAS_SIZE;
    const tCtx = trackCanvas.getContext('2d', { willReadFrequently: true })!;
    tCtx.font = fontStr;
    tCtx.textAlign = 'center';
    tCtx.textBaseline = 'middle';
    tCtx.lineWidth = 44;
    tCtx.lineCap = 'round';
    tCtx.lineJoin = 'round';
    tCtx.strokeStyle = '#000000';
    tCtx.fillStyle = '#000000';
    tCtx.strokeText(letter, cx, cy);
    tCtx.fillText(letter, cx, cy);
    trackDataRef.current = tCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;

    // 2. Offscreen reference canvas (in-memory) for star sampling along the centerline
    const refCanvas = document.createElement('canvas');
    refCanvas.width = CANVAS_SIZE;
    refCanvas.height = CANVAS_SIZE;
    const rCtx = refCanvas.getContext('2d', { willReadFrequently: true })!;
    rCtx.font = fontStr;
    rCtx.textAlign = 'center';
    rCtx.textBaseline = 'middle';
    rCtx.fillStyle = '#000000';
    rCtx.fillText(letter, cx, cy);

    // 3. Background Canvas: Floating Letter Track (no square frame)
    // Outer border of the road
    bgCtx.lineWidth = 48;
    bgCtx.lineCap = 'round';
    bgCtx.lineJoin = 'round';
    bgCtx.strokeStyle = '#e2e8f0';
    bgCtx.strokeText(letter, cx, cy);

    // Inner crisp white road track
    bgCtx.lineWidth = 38;
    bgCtx.strokeStyle = '#ffffff';
    bgCtx.strokeText(letter, cx, cy);

    // Soft letter fill
    bgCtx.fillStyle = '#f8fafc';
    bgCtx.fillText(letter, cx, cy);

    // Centerline dashed guide
    bgCtx.lineWidth = 2.5;
    bgCtx.setLineDash([8, 7]);
    bgCtx.strokeStyle = '#94a3b8';
    bgCtx.strokeText(letter, cx, cy);
    bgCtx.setLineDash([]);

    // 4. Sample Star Checkpoints from letter pixels
    const refData = rCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    const candidatePoints: { x: number; y: number }[] = [];
    for (let y = 16; y < CANVAS_SIZE - 16; y += 4) {
      for (let x = 16; x < CANVAS_SIZE - 16; x += 4) {
        if (refData[(y * CANVAS_SIZE + x) * 4 + 3] > 180) {
          candidatePoints.push({ x, y });
        }
      }
    }

    const interior = candidatePoints.filter(p => {
      const check = (dx: number, dy: number) => {
        const nx = p.x + dx, ny = p.y + dy;
        if (nx < 0 || nx >= CANVAS_SIZE || ny < 0 || ny >= CANVAS_SIZE) return false;
        return refData[(ny * CANVAS_SIZE + nx) * 4 + 3] > 180;
      };
      return check(0, -6) && check(0, 6) && check(-6, 0) && check(6, 0);
    });

    const pool = interior.length > 25 ? interior : candidatePoints;
    const newStars: StarPoint[] = [];

    if (pool.length > 0) {
      pool.sort((a, b) => a.y - b.y || a.x - b.x);
      newStars.push({ id: 0, x: pool[0].x, y: pool[0].y, collected: false });

      const targetCount = 5;
      while (newStars.length < targetCount && pool.length > newStars.length) {
        let best = pool[0];
        let maxMinDist = -1;
        for (const pt of pool) {
          let minDist = Infinity;
          for (const s of newStars) {
            const d = Math.hypot(pt.x - s.x, pt.y - s.y);
            if (d < minDist) minDist = d;
          }
          if (minDist > maxMinDist) {
            maxMinDist = minDist;
            best = pt;
          }
        }
        if (maxMinDist < 32) break;
        newStars.push({ id: newStars.length, x: best.x, y: best.y, collected: false });
      }

      newStars.sort((a, b) => a.y - b.y || a.x - b.x);
      newStars.forEach((s, idx) => { s.id = idx; });
    }

    setStars(newStars);
    setCoverage(0);
    setDone(false);
    setOffTrack(false);
    setHasStarted(false);
  }, [letter]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_SIZE / rect.width;
    const scaleY = CANVAS_SIZE / rect.height;
    if ('touches' in e) {
      const touch = e.touches[0] || (e as unknown as React.TouchEvent).changedTouches?.[0];
      if (!touch) return { x: 0, y: 0 };
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY
      };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const isInsideTrack = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= CANVAS_SIZE || iy < 0 || iy >= CANVAS_SIZE) return false;
    if (!trackDataRef.current) return true;
    return trackDataRef.current[(iy * CANVAS_SIZE + ix) * 4 + 3] > 30;
  };

  const triggerOffTrackAlert = () => {
    setOffTrack(true);
    if (offTrackTimer.current) clearTimeout(offTrackTimer.current);
    offTrackTimer.current = setTimeout(() => {
      setOffTrack(false);
    }, 1200);
  };

  const paintDot = (x: number, y: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const paintSegment = (x1: number, y1: number, x2: number, y2: number) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    ctx.save();
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f59e0b';

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  };

  const checkStarProximity = (x: number, y: number) => {
    setStars(prev => {
      let changed = false;
      const next = prev.map((s, idx) => {
        if (s.collected) return s;
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < 26) {
          changed = true;
          playStarChime(idx);
          return { ...s, collected: true };
        }
        return s;
      });
      return changed ? next : prev;
    });
  };

  const computeCoverage = () => {
    const draw = drawCanvasRef.current;
    if (!draw || !trackDataRef.current) return;
    const dCtx = draw.getContext('2d', { willReadFrequently: true })!;
    const drawData = dCtx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
    const trackData = trackDataRef.current;

    let totalTrackPixels = 0;
    let filledTrackPixels = 0;

    for (let y = 0; y < CANVAS_SIZE; y += 4) {
      for (let x = 0; x < CANVAS_SIZE; x += 4) {
        const i = (y * CANVAS_SIZE + x) * 4;
        // Strictly consider ONLY pixels that belong inside the letter track
        if (trackData[i + 3] > 60) {
          totalTrackPixels++;
          if (drawData[i + 3] > 60) {
            filledTrackPixels++;
          }
        }
      }
    }

    if (totalTrackPixels === 0) return;
    const pct = Math.round((filledTrackPixels / totalTrackPixels) * 100);
    setCoverage(pct);

    const collectedStars = stars.filter(s => s.collected).length;
    const neededStars = Math.max(1, Math.min(stars.length, 4));

    if (pct >= 45 && collectedStars >= neededStars && !done) {
      setDone(true);
      playWinSound();
      confetti({
        particleCount: 45,
        spread: 70,
        origin: { y: 0.5 }
      });
      setTimeout(onSuccess, 850);
    }
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (done) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const { x, y } = getPos(e, canvas);

    if (!isInsideTrack(x, y)) {
      triggerOffTrackAlert();
      isDrawing.current = false;
      lastPos.current = null;
      return;
    }

    isDrawing.current = true;
    lastPos.current = { x, y };
    setHasStarted(true);
    setOffTrack(false);

    paintDot(x, y);
    checkStarProximity(x, y);
    computeCoverage();
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing.current || done) return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const { x, y } = getPos(e, canvas);

    if (!isInsideTrack(x, y)) {
      triggerOffTrackAlert();
      lastPos.current = null;
      return;
    }

    setOffTrack(false);

    const from = lastPos.current || { x, y };
    paintSegment(from.x, from.y, x, y);
    lastPos.current = { x, y };

    checkStarProximity(x, y);
    computeCoverage();
  };

  const stopDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const handleReset = () => {
    const draw = drawCanvasRef.current;
    if (!draw) return;
    const dCtx = draw.getContext('2d')!;
    dCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    setCoverage(0);
    setStars(prev => prev.map(s => ({ ...s, collected: false })));
    setOffTrack(false);
    setHasStarted(false);
  };

  const collectedCount = stars.filter(s => s.collected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-5 flex flex-col items-center gap-3.5 max-w-sm w-full border-2 border-indigo-100">
        <div className="text-center">
          <h3 className="font-black text-2xl text-slate-800 flex items-center justify-center gap-2">
            <span>✏️</span> Trace a Letra <span className="text-amber-500 font-extrabold">{letter}</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Passe o dedinho <strong>dentro do caminho</strong> e pegue as estrelinhas!
          </p>
        </div>

        {/* Status badges */}
        <div className="flex items-center justify-between w-full px-2">
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-bold text-amber-700">
            <span>⭐</span>
            <span>{collectedCount} de {stars.length} estrelas</span>
          </div>
          <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full text-xs font-bold text-indigo-700">
            <span>🎨</span>
            <span>{coverage}% traçado</span>
          </div>
        </div>

        {/* Floating Letter Area (Big Square Box ELIMINATED) */}
        <div className="relative w-[300px] h-[300px] select-none touch-none flex items-center justify-center">
          {/* Background Canvas: Road & Guideline */}
          <canvas
            ref={bgCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 pointer-events-none"
          />

          {/* User Drawing Canvas */}
          <canvas
            ref={drawCanvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 cursor-crosshair touch-none"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={stopDraw}
            onMouseLeave={stopDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={stopDraw}
          />

          {/* Interactive Star Overlays */}
          {stars.map((s) => (
            <div
              key={s.id}
              style={{
                left: `${(s.x / CANVAS_SIZE) * 100}%`,
                top: `${(s.y / CANVAS_SIZE) * 100}%`
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300 ${
                s.collected ? 'scale-110' : 'scale-100'
              }`}
            >
              {s.collected ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-black animate-scale-in">
                  ✓
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-amber-400 border-2 border-white shadow-md flex items-center justify-center text-white text-[11px] font-black animate-bounce shadow-amber-300/50">
                  ⭐
                </div>
              )}
            </div>
          ))}

          {/* Guide pointer on the first star until user begins drawing */}
          {!hasStarted && stars[0] && (
            <div
              style={{
                left: `${(stars[0].x / CANVAS_SIZE) * 100}%`,
                top: `${(stars[0].y / CANVAS_SIZE) * 100}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-10 pointer-events-none flex flex-col items-center animate-bounce z-10"
            >
              <span className="text-xl drop-shadow-md">👇</span>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-md whitespace-nowrap">
                Comece aqui!
              </span>
            </div>
          )}

          {/* Friendly off-track alert banner */}
          {offTrack && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-amber-600/95 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg pointer-events-none animate-pulse whitespace-nowrap z-20">
              ✏️ Fique dentro do caminho da letrinha!
            </div>
          )}

          {/* Victory Overlay */}
          {done && (
            <div className="absolute inset-0 bg-white/85 backdrop-blur-2xs flex flex-col items-center justify-center animate-fade-in z-30">
              <span className="text-6xl animate-bounce">⭐</span>
              <span className="text-base font-black text-amber-600 mt-2">🎉 Muito bem! Letra {letter}!</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-300 rounded-full"
            style={{ width: `${coverage}%` }}
          />
        </div>

        {/* Actions & hint text */}
        <div className="w-full flex items-center justify-between text-xs text-slate-500 px-1">
          <span>{coverage < 50 ? 'Continue traçando a letra!' : '🎉 Quase lá!'}</span>
          <button
            type="button"
            onClick={handleReset}
            className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 hover:underline active:scale-95 transition-all"
            title="Limpar e recomeçar"
          >
            <span>🔄</span> Recomeçar
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// LETTERS STAGE COMPONENT
// -------------------------------------------------------------
interface LettersStageProps {
  ageGroup: AgeGroup;
  wordObj: WordChallenge;
  soundEnabled: boolean;
  onNextWord: () => void;
  onPrevWord: () => void;
  wordIndex: number;
  totalWords: number;
  onWinStar: () => void;
  speakAudio: (text: string, staticKey?: string) => Promise<void>;
  isAudioLoading: boolean;
  tvMode?: boolean;
}

function LettersStage({
  ageGroup,
  wordObj,
  soundEnabled,
  onNextWord,
  onPrevWord,
  wordIndex,
  totalWords,
  onWinStar,
  speakAudio,
  isAudioLoading,
  tvMode = false
}: LettersStageProps) {
  const currentWord = wordObj.word;
  const [spelledCount, setSpelledCount] = useState(0);
  const [letterBank, setLetterBank] = useState<LetterItem[]>(() =>
    wordObj.word.split('').map((char, i) => ({
      id: `word-${i}-${char}`,
      char,
      isTarget: true
    }))
  );
  const [wrongLetterId, setWrongLetterId] = useState<string | null>(null);
  const [hintLetterId, setHintLetterId] = useState<string | null>(null);
  const [isLetterCelebrating, setIsLetterCelebrating] = useState(false);
  const [wrongLetterCount, setWrongLetterCount] = useState(0);
  // hintLevel: 0 = nenhuma, 1 = 1ª dica usada, 2 = 2ª dica usada
  const [hintLevel, setHintLevel] = useState(0);
  const [showTracingModal, setShowTracingModal] = useState(false);
  // IDs desabilitados pela 2ª dica (bloqueia tipo oposto: vogais ou consoantes)
  const [disabledByHint, setDisabledByHint] = useState<string[]>([]);
  // Decoys extras acumulados para faixa 9-12
  const [extraDecoys, setExtraDecoys] = useState(0);
  const isHardMode = ageGroup === '9-11' || ageGroup === '12-14';

  const expectedChar = currentWord[spelledCount];

  // Reinitialise bank when word changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isHardMode) {
        setLetterBank(generateHardBank(currentWord, 0, 0));
      } else {
        setLetterBank(generateBank(currentWord));
      }
    }, 0);
    setExtraDecoys(0);
    setWrongLetterCount(0);
    setHintLevel(0);
    setDisabledByHint([]);
    setHintLetterId(null);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord]);


  // Question speech prompt text
  const questionSpeechText = wordObj.clue
    ? `Desafio de Soletrar! Pista: ${wordObj.clue}. Qual é a palavra? É ${formatWordForSpeech(currentWord)}! Toque nas letras para soletrar.`
    : `Desafio de Soletrar! Soletre a palavra: ${formatWordForSpeech(currentWord)}! Toque nas letras na ordem certa para formar a palavra.`;

  useEffect(() => {
    if (!tvMode) return;
    const t = window.setTimeout(() => {
      const firstLetter = document.querySelector<HTMLElement>('#letter-bank button');
      (firstLetter || document.querySelector<HTMLElement>('#btn-speak-next-letter'))?.focus();
    }, 120);
    return () => clearTimeout(t);
  }, [tvMode, currentWord]);

  const handleSpeakQuestion = () => {
    playSoundFx('pop');
    const slug = currentWord.toLowerCase();
    speakAudio(questionSpeechText, `desafio_${slug}`);
  };

  const handleSpeakFullWord = () => {
    playSoundFx('pop');
    const slug = currentWord.toLowerCase();
    speakAudio(`Palavra: ${formatWordForSpeech(currentWord)}!`, `palavra_${slug}`);
  };

  const handleSpeakNextLetter = () => {
    if (!expectedChar || isLetterCelebrating) return;
    playSoundFx('pop');
    const upper = expectedChar.toUpperCase();
    const phonetic = PT_LETTER_PHONETICS[upper] || upper;
    const staticKey = `proxima_letra_${upper.toLowerCase()}`;
    speakAudio(`A próxima letra é ${phonetic}!`, staticKey);
  };

  const handleManualShuffle = () => {
    playSoundFx('shuffle');
    setLetterBank(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  const handleLetterClick = (item: LetterItem) => {
    if (isLetterCelebrating || disabledByHint.includes(item.id)) return;
    const upper = item.char.toUpperCase();
    speakAudio(upper, `letra_${upper.toLowerCase()}`);

    if (item.char === expectedChar) {
      const newCount = spelledCount + 1;
      setSpelledCount(newCount);
      // Reset hint state per letter
      setWrongLetterCount(0);
      setHintLevel(0);
      setDisabledByHint([]);
      setHintLetterId(null);

      if (newCount === currentWord.length) {
        setLetterBank(prev => prev.filter(x => x.id !== item.id));
        setIsLetterCelebrating(true);
        playSoundFx('star');
        onWinStar();
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#facc15', '#4ade80', '#60a5fa', '#f87171', '#c084fc']
        });
        setTimeout(() => {
          speakAudio(
            `Muito bem! Você completou a palavra ${formatWordForSpeech(currentWord)}!`,
            `completou_${currentWord.toLowerCase()}`
          );
        }, 500);
        setTimeout(() => { onNextWord(); }, 3000);
      } else {
        if (isHardMode) {
          // Hard mode: remove acertada e adiciona novo decoy, embaralha
          const newExtra = extraDecoys + 1;
          setExtraDecoys(newExtra);
          setLetterBank(generateHardBank(currentWord, newCount, newExtra));
        } else {
          setLetterBank(prev => prev.filter(x => x.id !== item.id));
        }
      }
    } else {
      setTimeout(() => playSoundFx('wrong'), 280);
      setWrongLetterId(item.id);
      setTimeout(() => setWrongLetterId(null), 500);
      const newWrongCount = wrongLetterCount + 1;
      setWrongLetterCount(newWrongCount);
      // Se já usou 2ª dica e errou 4+ vezes → pula a palavra
      if (hintLevel >= 2 && newWrongCount >= 4) {
        setIsLetterCelebrating(true);
        speakAudio('Vamos tentar essa palavra de novo mais tarde!', 'pula_palavra');
        setTimeout(() => { onNextWord(); }, 2200);
      }
    }
  };

  // 1ª dica por faixa etária
  const giveHint1 = () => {
    if (!expectedChar || isLetterCelebrating || hintLevel >= 1) return;
    playSoundFx('pop');
    setHintLevel(1);
    if (ageGroup === '3-5') {
      // Mini-desafio de traçado
      setShowTracingModal(true);
    } else {
      // 6-8, 9-11, 12-14: fala vogal ou consoante
      const upper = expectedChar.toUpperCase();
      const tipo = isVowel(upper) ? 'vogal' : 'consoante';
      speakAudio(`Dica: A próxima letra é uma ${tipo}!`, `dica_tipo_${tipo}`);
    }
  };

  // 2ª dica por faixa etária
  const giveHint2 = () => {
    if (!expectedChar || isLetterCelebrating || hintLevel >= 2) return;
    playSoundFx('pop');
    setHintLevel(2);
    if (ageGroup === '3-5') {
      // Contorno dourado na letra certa
      const target = letterBank.find(x => x.char === expectedChar);
      if (target) {
        setHintLetterId(target.id);
        setTimeout(() => setHintLetterId(null), 3000);
      }
      speakAudio('Olha a letra brilhando!', 'dica_brilho');
    } else {
      // 6-8, 9-11, 12-14: bloqueia letras do tipo oposto
      const upper = expectedChar.toUpperCase();
      const expectedIsVowel = isVowel(upper);
      // Bloqueia letras que são do tipo oposto (não é a letra esperada)
      const toDisable = letterBank
        .filter(x => x.char !== expectedChar && isVowel(x.char) !== expectedIsVowel)
        .map(x => x.id);
      setDisabledByHint(toDisable);
      const tipo = expectedIsVowel ? 'vogal' : 'consoante';
      speakAudio(`Dica: É uma ${tipo}! As outras letras do tipo errado ficaram bloqueadas.`, `dica_bloqueia_${tipo}`);
    }
  };

  // Callback do modal de traçado: sucesso = mostrar brilho na letra
  const handleTracingSuccess = () => {
    setShowTracingModal(false);
    const target = letterBank.find(x => x.char === expectedChar);
    if (target) {
      setHintLetterId(target.id);
      setTimeout(() => setHintLetterId(null), 3000);
    }
    speakAudio('Muito bem! Agora você sabe qual letra é. Encontre ela!', 'dica_tracado_ok');
  };

  return (
    <>
    {showTracingModal && expectedChar && (
      <LetterTracingModal
        letter={expectedChar}
        onSuccess={handleTracingSuccess}
      />
    )}
    <div className="w-full flex-1 flex flex-col items-center justify-between">
      {/* Word Progress & Header */}
      <div className="w-full flex flex-col items-center gap-2 mb-3">
        {/* Clue with individual listen button */}
        {wordObj.clue && (
          <div className="w-full max-w-md bg-indigo-50/90 border border-indigo-100 rounded-2xl px-4 py-2 flex items-center justify-between gap-2 shadow-2xs">
            <div className="text-left text-xs sm:text-sm font-semibold text-indigo-950 flex items-center gap-2">
              <span className="text-base">💡</span>
              <span><strong>Pista:</strong> {wordObj.clue}</span>
            </div>
            <button
              id="speak-clue-btn"
              onClick={() => {
                playSoundFx('pop');
                const slug = currentWord.toLowerCase();
                speakAudio(`Pista: ${wordObj.clue}`, `pista_${slug}`);
              }}
              className="p-1.5 rounded-full bg-white text-indigo-600 hover:bg-indigo-100 transition-colors shrink-0 shadow-2xs"
              title="Ouvir apenas a pista"
            >
              <Volume2 size={16} />
            </button>
          </div>
        )}

        {/* Prominent Question Speech Button */}
        <button
          id="btn-speak-word-prominent"
          onClick={handleSpeakQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-800 rounded-full font-bold text-xs sm:text-sm border border-indigo-200 shadow-2xs transition-all mt-1"
          title="Ouvir a pergunta do desafio em voz alta"
        >
          <Volume2 size={18} className="text-indigo-600 shrink-0" />
          <span>Ouvir a Pergunta em Voz Alta</span>
          {isAudioLoading && (
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping ml-1" />
          )}
        </button>
      </div>

      {/* Prominent Speech Action Buttons */}
      <div className={`w-full mx-auto grid grid-cols-2 gap-2.5 sm:gap-3 my-2 ${tvMode ? 'max-w-3xl gap-4' : 'max-w-md'}`}>
        {/* Botão 1: Falar Palavra Toda */}
        <button
          id="btn-speak-full-word"
          onClick={handleSpeakFullWord}
          className={`tv-action-btn flex items-center justify-center gap-2.5 px-3 py-3 sm:py-3.5 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 text-white rounded-2xl font-black shadow-md border-b-4 border-indigo-800 transition-all text-xs sm:text-sm group ${tvMode ? 'text-base py-5' : ''}`}
          title="Falar e ouvir a palavra toda"
        >
          <div className="p-1.5 rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors">
            <Volume2 size={tvMode ? 28 : 22} className="text-white shrink-0" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] sm:text-xs text-indigo-100 font-semibold uppercase tracking-wider">
              Ouvir Tudo
            </span>
            <span className="text-xs sm:text-sm font-extrabold tracking-wide">
              Falar Palavra
            </span>
          </div>
        </button>

        {/* Botão 2: Falar Próxima Letra */}
        <button
          id="btn-speak-next-letter"
          data-tv-autofocus
          onClick={handleSpeakNextLetter}
          disabled={isLetterCelebrating || !expectedChar}
          className={`tv-action-btn flex items-center justify-center gap-2.5 px-3 py-3 sm:py-3.5 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-amber-950 rounded-2xl font-black shadow-md border-b-4 border-amber-700 transition-all text-xs sm:text-sm disabled:opacity-50 group ${tvMode ? 'text-base py-5' : ''}`}
          title="Falar e ouvir apenas a próxima letra"
        >
          <div className="p-1.5 rounded-xl bg-amber-600/20 group-hover:bg-amber-600/30 transition-colors">
            <Volume1 size={22} className="text-amber-950 shrink-0" />
          </div>
          <div className="flex flex-col text-left leading-tight">
            <span className="text-[10px] sm:text-xs text-amber-900/80 font-semibold uppercase tracking-wider">
              {expectedChar ? `Letra ${expectedChar}` : 'Finalizada'}
            </span>
            <span className="text-xs sm:text-sm font-extrabold tracking-wide">
              Próxima Letra
            </span>
          </div>
        </button>
      </div>

      {/* Target Word Slots Area */}
      <div className={`my-auto py-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-full ${tvMode ? 'gap-4 py-6' : ''}`}>
        {currentWord.split('').map((char, idx) => {
          const isSpelled = idx < spelledCount;
          const isCurrent = idx === spelledCount;
          return (
            <div
              key={idx}
              className={`tv-word-slot relative flex items-center justify-center rounded-2xl font-black transition-all duration-200 ${
                ageGroup === '3-5'
                  ? 'w-14 h-20 sm:w-20 sm:h-24 text-4xl sm:text-6xl border-4'
                  : 'w-11 h-16 sm:w-16 sm:h-20 text-3xl sm:text-5xl border-3 sm:border-4'
              } ${
                isSpelled
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-md'
                  : isCurrent
                    ? 'bg-white border-amber-400 shadow-md ring-4 ring-amber-100'
                    : 'bg-white/70 border-slate-200'
              }`}
            >
              {isSpelled ? (
                <span className="text-white font-black drop-shadow-sm select-none">
                  {char}
                </span>
              ) : (
                <div className="w-1/2 h-1.5 rounded-full bg-slate-300 opacity-60 absolute bottom-3" />
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Letter Bank */}
      <div className="w-full flex flex-col items-center mt-4">
        <div
          id="letter-bank"
          className={`flex flex-wrap justify-center gap-2 sm:gap-3 mb-4 ${tvMode ? 'max-w-4xl gap-4' : 'max-w-lg'}`}
        >
          {letterBank.map((item, idx) => {
            const isWrong = wrongLetterId === item.id;
            const isHint = hintLetterId === item.id;
            const isDisabled = disabledByHint.includes(item.id);
            return (
              <button
                key={item.id}
                data-tv-autofocus={idx === 0 ? true : undefined}
                onClick={() => handleLetterClick(item)}
                disabled={isDisabled}
                className={`tv-letter-tile relative font-black rounded-2xl shadow-sm border-b-4 active:border-b-0 active:translate-y-1 transition-all duration-150 select-none ${
                  isDisabled
                    ? 'bg-slate-100 border-slate-200 text-slate-300 opacity-40 cursor-not-allowed'
                    : isWrong
                      ? 'bg-rose-100 border-rose-400 text-rose-700 animate-bounce'
                      : isHint
                        ? 'ring-4 ring-amber-400 bg-amber-50 border-amber-300 text-amber-700 animate-pulse'
                        : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800 hover:bg-slate-50'
                } ${
                  ageGroup === '3-5'
                    ? 'w-16 h-16 sm:w-20 sm:h-20 text-4xl sm:text-5xl'
                    : 'w-12 h-12 sm:w-16 sm:h-16 text-2xl sm:text-4xl'
                }`}
              >
                {item.char}
              </button>
            );
          })}
        </div>

        {/* Action Controls: Shuffle & Hint */}
        <div className={`flex items-center gap-3 ${tvMode ? 'gap-5 mt-2' : ''}`}>
          <button
            id="btn-shuffle-letters"
            onClick={handleManualShuffle}
            disabled={isLetterCelebrating}
            className={`tv-action-btn flex items-center gap-1.5 px-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-sm sm:text-base shadow-xs active:scale-95 transition-all disabled:opacity-50 ${tvMode ? 'px-8 py-4 text-lg' : ''}`}
            title="Embaralhar as letras disponíveis"
          >
            <Shuffle size={tvMode ? 24 : 18} />
            <span>Embaralhar</span>
          </button>

          {/* Hint buttons: appear after 2 errors, 2 levels */}
          {wrongLetterCount > 1 && hintLevel < 1 && (
            <button
              id="btn-hint-letter-1"
              onClick={giveHint1}
              disabled={isLetterCelebrating || spelledCount >= currentWord.length}
              className={`tv-action-btn flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 ${tvMode ? 'px-10 py-4 text-xl' : ''}`}
            >
              <Lightbulb size={tvMode ? 26 : 20} className="fill-amber-100 text-amber-900" />
              <span>DICA</span>
            </button>
          )}
          {hintLevel === 1 && !showTracingModal && (
            <button
              id="btn-hint-letter-2"
              onClick={giveHint2}
              disabled={isLetterCelebrating || spelledCount >= currentWord.length}
              className={`tv-action-btn flex items-center gap-2 bg-gradient-to-r from-orange-400 to-orange-500 text-orange-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-orange-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 ${tvMode ? 'px-10 py-4 text-xl' : ''}`}
            >
              <Lightbulb size={tvMode ? 26 : 20} className="fill-orange-100 text-orange-900" />
              <span>MAIS UMA DICA</span>
            </button>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

// -------------------------------------------------------------
// Interactive Math Mini-Challenge Hint Modal
// Hands-on Montessori-style learning: Basket counting & Hand finger manipulation
// -------------------------------------------------------------
interface MathChallengeConfig {
  type: 'basket' | 'basket_sum' | 'items_add' | 'items_sub' | 'items_missing' | 'stepping_stones' | 'mult_groups' | 'div_groups';
  title: string;
  instruction: string;
  targetAnswer: number | string;
  total?: number;
  emoji?: string;
  count1?: number;
  emoji1?: string;
  count2?: number;
  emoji2?: string;
  totalFingers?: number;
  toFold?: number;
  remaining?: number;
  totalItems?: number;
  toTake?: number;
  standing?: number;
  missing?: number;
  steps?: number[];
  nextStep?: number;
  groups?: number;
  itemsPerGroup?: number;
  groupEmoji?: string;
  totalForDiv?: number;
}

function getMathChallengeConfig(problem: MathProblem): MathChallengeConfig | null {
  // 1. Visual items (Basket mode)
  if (problem.visualItems) {
    return {
      type: 'basket',
      title: '🧺 Desafio do Cesto de Contagem!',
      instruction: `Coloque as ${problem.visualItems.emoji} no cesto tocando uma por uma!`,
      total: problem.visualItems.total,
      emoji: problem.visualItems.emoji,
      targetAnswer: Number(problem.answer)
    };
  }

  // 2. Visual sum (Basket sum mode)
  if (problem.visualSum) {
    const total = problem.visualSum.count1 + problem.visualSum.count2;
    return {
      type: 'basket_sum',
      title: '🧺 Junte tudo no Cesto!',
      instruction: 'Toque nos bichinhos para colocá-los no cesto e somar!',
      count1: problem.visualSum.count1,
      emoji1: problem.visualSum.emoji1,
      count2: problem.visualSum.count2,
      emoji2: problem.visualSum.emoji2,
      total,
      targetAnswer: Number(problem.answer)
    };
  }

  // 3. Subtraction with apples (e.g., "10 - 4 = ?", "14 - 6 = ?")
  const subMatch = problem.question.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (subMatch) {
    const a = parseInt(subMatch[1], 10);
    const b = parseInt(subMatch[2], 10);
    return {
      type: 'items_sub',
      title: '🍎 Desafio de Tirar e Subtrair!',
      instruction: `Você tem ${a} maçãs vermelhas. Toque em ${b} maçãs para tirá-las e veja quantas sobram!`,
      totalItems: Math.min(a, 30),
      toTake: Math.min(b, 30),
      remaining: a - b,
      targetAnswer: a - b
    };
  }

  // 4. Addition with apples (e.g., "5 + 4 = ?", "8 + 7 = ?", "6 + 6 = ?")
  const addMatch = problem.question.match(/(\d+)\s*\+\s*(\d+)/);
  if (addMatch) {
    const a = parseInt(addMatch[1], 10);
    const b = parseInt(addMatch[2], 10);
    return {
      type: 'items_add',
      title: '🍎🍏 Soma de Maçãs!',
      instruction: `Temos ${a} maçãs vermelhas 🍎 e ${b} maçãs verdes 🍏. Toque em cada uma para contar o total!`,
      count1: Math.min(a, 15),
      count2: Math.min(b, 15),
      total: a + b,
      emoji1: '🍎',
      emoji2: '🍏',
      targetAnswer: a + b
    };
  }

  // 5. "Quanto falta para 10 se você tem 7?"
  if (problem.question.includes('10') && problem.question.includes('7')) {
    return {
      type: 'items_missing',
      title: '🍎 Quantas faltam até 10?',
      instruction: 'Já temos 7 maçãs vermelhas 🍎. Toque nas maçãs verdes para completar até 10!',
      standing: 7,
      missing: 3,
      targetAnswer: 3
    };
  }

  // 6. Sequence "2, 4, 6, [ ? ]"
  if (problem.question.includes('2, 4, 6')) {
    return {
      type: 'stepping_stones',
      title: '🐸 Pulos do Sapinho!',
      instruction: 'O sapinho pula de 2 em 2: 2 ➔ 4 ➔ 6... Toque na próxima pedra para pular!',
      steps: [2, 4, 6],
      nextStep: 8,
      targetAnswer: 8
    };
  }

  // 7. Multiplication (e.g. 7 × 8, 6 × 9)
  const multMatch = problem.question.match(/(\d+)\s*[×x*]\s*(\d+)/);
  if (multMatch) {
    const a = parseInt(multMatch[1], 10);
    const b = parseInt(multMatch[2], 10);
    const groupEmojis = ['🍎','🌟','🐣','🍬','🎈','🐥','🦋','🍓'];
    const chosen = groupEmojis[Math.floor(Math.random() * groupEmojis.length)];
    return {
      type: 'mult_groups',
      title: '🛍️ Sacolas da Multiplicação!',
      instruction: `Temos ${a} sacolas, cada uma com ${b} ${chosen}. Toque nas sacolas para contar tudo!`,
      groups: Math.min(a, 8),
      itemsPerGroup: Math.min(b, 8),
      groupEmoji: chosen,
      targetAnswer: a * b
    };
  }

  // 8. Division (e.g. 12 ÷ 3 = ?)
  const divMatch = problem.question.match(/(\d+)\s*[÷/]\s*(\d+)/);
  if (divMatch) {
    const total = parseInt(divMatch[1], 10);
    const divisor = parseInt(divMatch[2], 10);
    const perGroup = total / divisor;
    const groupEmojis = ['🍎','🌟','🐣','🍬','🎈','🍓'];
    const chosen = groupEmojis[Math.floor(Math.random() * groupEmojis.length)];
    return {
      type: 'div_groups',
      title: '🎒 Divisão em Grupos!',
      instruction: `Temos ${total} ${chosen} para dividir igualmente em ${divisor} grupos. Distribua um por vez!`,
      groups: Math.min(divisor, 8),
      itemsPerGroup: Math.round(perGroup),
      groupEmoji: chosen,
      totalForDiv: Math.min(total, 32),
      targetAnswer: Math.round(perGroup)
    };
  }

  // Fallback for young age groups: simple basket of stars
  const numAnswer = parseInt(String(problem.answer), 10);
  if (!isNaN(numAnswer) && numAnswer > 0 && numAnswer <= 15) {
    return {
      type: 'basket',
      title: '🧺 Desafio do Cesto de Estrelas!',
      instruction: `Coloque as estrelas no cesto para descobrir a resposta!`,
      total: numAnswer,
      emoji: '⭐',
      targetAnswer: numAnswer
    };
  }

  return null;
}

interface MathInteractiveHintModalProps {
  problem: MathProblem;
  onComplete: () => void;
  onClose: () => void;
  speakAudio: (text: string, staticKey?: string) => Promise<void>;
}

function MathInteractiveHintModal({
  problem,
  onComplete,
  onClose,
  speakAudio
}: MathInteractiveHintModalProps) {
  const config = getMathChallengeConfig(problem);
  if (!config) return null;

  const [collectedBasketIds, setCollectedBasketIds] = useState<number[]>([]);
  const [countedFingers, setCountedFingers] = useState<number[]>([]);
  const [foldedFingers, setFoldedFingers] = useState<number[]>([]);
  const [raisedMissingFingers, setRaisedMissingFingers] = useState<number[]>([]);
  const [takenItems, setTakenItems] = useState<number[]>([]);
  const [countedGroups, setCountedGroups] = useState<number[]>([]);
  const [distributedItems, setDistributedItems] = useState<number[]>([]);
  const [stoneRevealed, setStoneRevealed] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const triggerWin = () => {
    setIsCompleted(true);
    playWinSound();
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.5 }
    });
  };

  // 1. Basket tap
  const handleBasketItemTap = (idx: number, total: number) => {
    if (collectedBasketIds.includes(idx) || isCompleted) return;
    const next = [...collectedBasketIds, idx];
    setCollectedBasketIds(next);
    playStarChime(next.length);
    if (next.length === total) {
      triggerWin();
    }
  };

  // 2. Fingers addition tap
  const handleFingerAddTap = (idx: number, total: number) => {
    if (countedFingers.includes(idx) || isCompleted) return;
    const next = [...countedFingers, idx];
    setCountedFingers(next);
    playStarChime(next.length);
    if (next.length === total) {
      triggerWin();
    }
  };

  // 3. Fingers subtraction tap (fold finger)
  const handleFingerSubTap = (idx: number, toFold: number) => {
    if (foldedFingers.includes(idx) || isCompleted) return;
    const next = [...foldedFingers, idx];
    setFoldedFingers(next);
    playStarChime(next.length);
    if (next.length === toFold) {
      triggerWin();
    }
  };

  // 4. Missing to 10 tap (raise finger)
  const handleRaiseMissingFinger = (idx: number, missing: number) => {
    if (raisedMissingFingers.includes(idx) || isCompleted) return;
    const next = [...raisedMissingFingers, idx];
    setRaisedMissingFingers(next);
    playStarChime(next.length);
    if (next.length === missing) {
      triggerWin();
    }
  };

  // 5. Items takeaway tap
  const handleTakeawayItemTap = (idx: number, toTake: number) => {
    if (takenItems.includes(idx) || isCompleted) return;
    const next = [...takenItems, idx];
    setTakenItems(next);
    playStarChime(next.length);
    if (next.length === toTake) {
      triggerWin();
    }
  };

  // 6. Stepping stone tap
  const handleStoneTap = () => {
    if (stoneRevealed || isCompleted) return;
    setStoneRevealed(true);
    playStarChime(3);
    triggerWin();
  };

  // 7. Multiplication groups tap
  const handleGroupTap = (idx: number, totalGroups: number) => {
    if (countedGroups.includes(idx) || isCompleted) return;
    const next = [...countedGroups, idx];
    setCountedGroups(next);
    playStarChime(next.length);
    if (next.length === totalGroups) {
      triggerWin();
    }
  };

  // 8. Division distribution tap
  const handleDivItemTap = (itemIdx: number, totalItems: number) => {
    if (distributedItems.includes(itemIdx) || isCompleted) return;
    const next = [...distributedItems, itemIdx];
    setDistributedItems(next);
    playStarChime(next.length);
    if (next.length === totalItems) {
      triggerWin();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-5 sm:p-6 flex flex-col items-center gap-4 max-w-lg w-full border-2 border-indigo-100 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💡</span>
            <h3 className="font-black text-xl text-slate-800">{config.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-sm transition-all cursor-pointer"
            title="Fechar dica"
          >
            ✕
          </button>
        </div>

        {/* Speak instruction button */}
        <button
          type="button"
          onClick={() => speakAudio(config.instruction, `math_hint_instruction_${config.type}`)}
          className="flex items-center gap-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-4 py-2 rounded-full font-bold text-sm transition-all cursor-pointer shadow-xs active:scale-95 w-full justify-center"
        >
          <span className="text-xl">🔊</span>
          <span>Ouvir como fazer</span>
        </button>

        {/* Challenge Body */}
        <div className="w-full py-2 flex flex-col items-center">
          {/* A. Basket Mode (Single items or Sum items) */}
          {(config.type === 'basket' || config.type === 'basket_sum') && (
            <div className="w-full flex flex-col items-center gap-5">
              {/* Top items shelf */}
              <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-md p-3 bg-amber-50/50 rounded-2xl border border-amber-100 min-h-[80px] items-center">
                {config.type === 'basket' &&
                  Array.from({ length: config.total || 0 }).map((_, i) => {
                    const isCollected = collectedBasketIds.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleBasketItemTap(i, config.total || 0)}
                        disabled={isCollected}
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-3xl sm:text-4xl transition-all shadow-xs ${
                          isCollected
                            ? 'bg-slate-100 border border-slate-200 opacity-30 scale-90'
                            : 'bg-white hover:bg-amber-100 border-2 border-amber-300 hover:scale-110 active:scale-90 cursor-pointer animate-bounce'
                        }`}
                      >
                        {isCollected ? '✓' : config.emoji}
                      </button>
                    );
                  })}

                {config.type === 'basket_sum' && (
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    {/* Group 1 */}
                    <div className="flex gap-2">
                      {Array.from({ length: config.count1 || 0 }).map((_, i) => {
                        const isCollected = collectedBasketIds.includes(i);
                        return (
                          <button
                            key={`g1-${i}`}
                            type="button"
                            onClick={() => handleBasketItemTap(i, config.total || 0)}
                            disabled={isCollected}
                            className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center text-3xl transition-all shadow-xs ${
                              isCollected
                                ? 'bg-slate-100 border border-slate-200 opacity-30 scale-90'
                                : 'bg-white hover:bg-amber-100 border-2 border-amber-300 hover:scale-110 active:scale-90 cursor-pointer animate-bounce'
                            }`}
                          >
                            {isCollected ? '✓' : config.emoji1}
                          </button>
                        );
                      })}
                    </div>
                    <span className="font-black text-2xl text-amber-600">+</span>
                    {/* Group 2 */}
                    <div className="flex gap-2">
                      {Array.from({ length: config.count2 || 0 }).map((_, i) => {
                        const itemIdx = (config.count1 || 0) + i;
                        const isCollected = collectedBasketIds.includes(itemIdx);
                        return (
                          <button
                            key={`g2-${i}`}
                            type="button"
                            onClick={() => handleBasketItemTap(itemIdx, config.total || 0)}
                            disabled={isCollected}
                            className={`w-13 h-13 sm:w-15 sm:h-15 rounded-2xl flex items-center justify-center text-3xl transition-all shadow-xs ${
                              isCollected
                                ? 'bg-slate-100 border border-slate-200 opacity-30 scale-90'
                                : 'bg-white hover:bg-emerald-100 border-2 border-emerald-300 hover:scale-110 active:scale-90 cursor-pointer animate-bounce'
                            }`}
                          >
                            {isCollected ? '✓' : config.emoji2}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Basket drop area */}
              <div className="w-full bg-gradient-to-b from-amber-100 to-amber-200 border-2 border-amber-300 rounded-3xl p-4 flex flex-col items-center justify-center shadow-inner relative">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-4xl">🧺</span>
                  <span className="font-black text-base text-amber-900">
                    {collectedBasketIds.length} de {config.total} no cesto
                  </span>
                </div>
                {/* Items in basket */}
                <div className="flex flex-wrap justify-center gap-2 min-h-[44px]">
                  {collectedBasketIds.map((idx, order) => (
                    <div
                      key={idx}
                      className="bg-white border border-amber-300 rounded-full px-2.5 py-1 text-sm font-black flex items-center gap-1 shadow-xs animate-scale-in"
                    >
                      <span>{config.emoji || (idx < (config.count1 || 0) ? config.emoji1 : config.emoji2)}</span>
                      <span className="text-amber-800 text-xs">#{order + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* B. Apple Addition Mode */}
          {config.type === 'items_add' && (() => {
            const c1 = config.count1 || 0;
            const c2 = config.count2 || 0;
            const total = c1 + c2;
            // Compute cols so all items fit in ~300px wide area (each item ~44px + gap)
            const cols = total <= 5 ? total : total <= 12 ? Math.ceil(total / 2) : total <= 20 ? Math.ceil(total / 3) : Math.ceil(total / 4);
            return (
              <div className="w-full flex flex-col items-center gap-3">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols, 6)}, 1fr)`, gap: 6, maxWidth: 320 }}
                  className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 w-full justify-items-center"
                >
                  {Array.from({ length: c1 + c2 }).map((_, i) => {
                    const isGroup2 = i >= c1;
                    const isCounted = collectedBasketIds.includes(i);
                    const emoji = isGroup2 ? config.emoji2 : config.emoji1;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          if (isCounted || isCompleted) return;
                          const next = [...collectedBasketIds, i];
                          setCollectedBasketIds(next);
                          playStarChime(next.length);
                          if (next.length === total) triggerWin();
                        }}
                        disabled={isCounted || isCompleted}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          isCounted
                            ? 'opacity-30 scale-75 bg-slate-100'
                            : isGroup2
                              ? 'bg-green-50 border-2 border-green-300 hover:bg-green-100 hover:scale-110 cursor-pointer active:scale-90 shadow-xs'
                              : 'bg-red-50 border-2 border-red-300 hover:bg-red-100 hover:scale-110 cursor-pointer active:scale-90 shadow-xs'
                        }`}
                      >
                        {isCounted ? '✓' : emoji}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">🍎 {Math.min(collectedBasketIds.filter(x => x < c1).length, c1)}/{c1}</span>
                  <span className="font-bold text-slate-400">+</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-bold">🍏 {collectedBasketIds.filter(x => x >= c1).length}/{c2}</span>
                  <span className="font-bold text-slate-400">=</span>
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-0.5 rounded-full text-xs font-bold">{collectedBasketIds.length} total</span>
                </div>
              </div>
            );
          })()}

          {/* D. Missing to 10 Mode */}
          {config.type === 'fingers_missing10' && (
            <div className="w-full flex flex-col items-center gap-3">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                {[0, 1].map((handIdx) => (
                  <div key={handIdx} className="flex flex-col items-center gap-1">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-wide">Mão {handIdx + 1}</span>
                    <div className="relative w-[110px] h-[110px]">
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[86px] h-[52px] bg-amber-200 border-2 border-amber-300 rounded-b-[40px] rounded-t-[16px] shadow-sm" />
                      {[0,1,2,3,4].map((fi) => {
                        const fingerId = handIdx * 5 + fi;
                        const isPreStanding = fingerId < (config.standing || 7);
                        const isRaised = raisedMissingFingers.includes(fingerId);
                        const heights = [44, 56, 64, 56, 40];
                        const offsets = [4, 18, 31, 44, 58];
                        return (
                          <button
                            key={fi}
                            type="button"
                            onClick={() => !isPreStanding && !isRaised && handleRaiseMissingFinger(fingerId, config.missing || 3)}
                            disabled={isPreStanding || isRaised}
                            style={{ left: offsets[fi], height: isPreStanding || isRaised ? heights[fi] : 12, bottom: 44 }}
                            className={`absolute w-[14px] rounded-t-full border-2 transition-all duration-300 origin-bottom ${
                              isPreStanding
                                ? 'bg-indigo-300 border-indigo-400'
                                : isRaised
                                  ? 'bg-emerald-400 border-emerald-500'
                                  : 'bg-amber-100 border-dashed border-amber-300 cursor-pointer hover:bg-amber-300 animate-pulse'
                            }`}
                          />
                        );
                      })}
                    </div>
                    <div className="text-center text-xs font-bold mt-1 text-slate-500">
                      Mão {handIdx + 1}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-50 border border-amber-200 px-4 py-1.5 rounded-full text-xs font-bold text-amber-900">
                ☝️ Levante os dedos em falta! Levantados: {raisedMissingFingers.length} de {config.missing}
              </div>
            </div>
          )}

          {/* C. Apple Missing Mode ("Quanto falta para 10?") */}
          {config.type === 'items_missing' && (() => {
            const standing = config.standing || 7;
            const missing = config.missing || 3;
            const total = standing + missing;
            const cols = total <= 5 ? total : total <= 12 ? Math.ceil(total / 2) : Math.ceil(total / 3);
            return (
              <div className="w-full flex flex-col items-center gap-3">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols, 6)}, 1fr)`, gap: 6, maxWidth: 320 }}
                  className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100 w-full justify-items-center"
                >
                  {Array.from({ length: total }).map((_, i) => {
                    const isExisting = i < standing;
                    const isRaised = raisedMissingFingers.includes(i);
                    const canRaise = !isExisting && !isRaised && !isCompleted;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => canRaise && handleRaiseMissingFinger(i, missing)}
                        disabled={!canRaise}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          isExisting
                            ? 'bg-red-100 border-2 border-red-300 cursor-default'
                            : isRaised
                              ? 'bg-emerald-100 border-2 border-emerald-400 scale-105 shadow-sm'
                              : 'bg-white border-2 border-dashed border-green-300 hover:bg-green-50 hover:scale-110 cursor-pointer active:scale-90 animate-pulse'
                        }`}
                      >
                        {isExisting ? '🍎' : isRaised ? '🍏' : '➕'}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">🍎 {standing} existentes</span>
                  <span className="text-slate-400">+</span>
                  <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🍏 {raisedMissingFingers.length}/{missing} adicionadas</span>
                </div>
              </div>
            );
          })()}

          {/* E. Items Subtraction Takeaway Mode */}
          {config.type === 'items_sub' && (() => {
            const totalShow = Math.min(config.totalItems || 0, 30);
            const toTake = config.toTake || 0;
            // Responsive cols: fit inside ~320px (each apple ~42px+gap)
            const cols = totalShow <= 5 ? totalShow
              : totalShow <= 12 ? Math.ceil(totalShow / 2)
              : totalShow <= 20 ? Math.ceil(totalShow / 3)
              : Math.ceil(totalShow / 4);
            return (
              <div className="w-full flex flex-col items-center gap-3">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cols, 7)}, 1fr)`, gap: 6, maxWidth: 320 }}
                  className="p-3 bg-red-50/50 rounded-2xl border border-red-100 w-full justify-items-center"
                >
                  {Array.from({ length: totalShow }).map((_, i) => {
                    const isTaken = takenItems.includes(i);
                    const isRemaining = isCompleted && !isTaken;
                    const canTake = !isTaken && !isCompleted && takenItems.length < toTake;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => canTake && handleTakeawayItemTap(i, toTake)}
                        disabled={!canTake}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ${
                          isTaken
                            ? 'opacity-15 scale-75 cursor-default'
                            : isRemaining
                              ? 'bg-emerald-100 border-2 border-emerald-400 scale-105'
                              : canTake
                                ? 'bg-white hover:bg-red-50 border-2 border-red-200 hover:scale-110 cursor-pointer active:scale-90 shadow-xs'
                                : 'bg-white border-2 border-slate-100 opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {isTaken ? '' : '🍎'}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="bg-red-100 text-red-700 px-3 py-0.5 rounded-full">🍎 {totalShow} maçãs</span>
                  <span className="text-slate-400">→</span>
                  <span className="bg-amber-100 text-amber-700 px-3 py-0.5 rounded-full">Tirar {toTake}</span>
                  <span className="text-slate-400">→</span>
                  <span className={`px-3 py-0.5 rounded-full ${takenItems.length >= toTake ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {takenItems.length}/{toTake} tiradas
                  </span>
                </div>
              </div>
            );
          })()}

          {/* F. Stepping Stones Mode */}
          {config.type === 'stepping_stones' && (
            <div className="w-full flex flex-col items-center gap-5">
              <div className="flex items-center justify-center gap-3 sm:gap-4">
                {(config.steps || [2, 4, 6]).map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 border-2 border-indigo-200 flex flex-col items-center justify-center font-black text-xl text-indigo-700 shadow-xs">
                      <span className="text-xs text-indigo-400">🐸</span>
                      <span>{step}</span>
                    </div>
                    <span className="text-sm font-bold text-indigo-400">+2 ➔</span>
                  </div>
                ))}
                {/* Next Stone */}
                <button
                  type="button"
                  onClick={handleStoneTap}
                  className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-black text-2xl transition-all shadow-md ${
                    stoneRevealed
                      ? 'bg-emerald-500 border-2 border-emerald-600 text-white animate-scale-in'
                      : 'bg-amber-400 hover:bg-amber-500 border-2 border-amber-600 text-amber-950 animate-bounce cursor-pointer'
                  }`}
                >
                  {stoneRevealed ? (
                    <>
                      <span className="text-xs">⭐</span>
                      <span>{config.nextStep}</span>
                    </>
                  ) : (
                    <span>?</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* G. Multiplication Groups Mode */}
          {config.type === 'mult_groups' && (() => {
            const totalGroups = config.groups || 0;
            const perGroup = config.itemsPerGroup || 1;
            const emoji = config.groupEmoji || '🍎';
            const runningTotal = countedGroups.length * perGroup;
            return (
              <div className="w-full flex flex-col items-center gap-3">
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(totalGroups, 4)}, 1fr)`, gap: 10, maxWidth: 300 }}
                  className="p-3 bg-amber-50/40 rounded-2xl border border-amber-100 w-full justify-items-center"
                >
                  {Array.from({ length: totalGroups }).map((_, i) => {
                    const isCounted = countedGroups.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleGroupTap(i, totalGroups)}
                        disabled={isCounted}
                        className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 transition-all ${
                          isCounted
                            ? 'bg-emerald-50 border-emerald-400 scale-105 shadow-sm'
                            : 'bg-white border-amber-200 hover:border-amber-400 hover:bg-amber-50 cursor-pointer hover:scale-105 active:scale-95 shadow-xs'
                        }`}
                      >
                        {/* Bag icon */}
                        <span className="text-2xl">{isCounted ? '✅' : '🛍️'}</span>
                        {/* Items inside */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(perGroup, 3)}, 1fr)`, gap: 2 }}>
                          {Array.from({ length: Math.min(perGroup, 6) }).map((_, j) => (
                            <span key={j} className="text-xs leading-none">{isCounted ? emoji : '•'}</span>
                          ))}
                          {perGroup > 6 && <span className="text-xs text-slate-400">+{perGroup - 6}</span>}
                        </div>
                        <span className={`text-xs font-black ${isCounted ? 'text-emerald-600' : 'text-amber-600'}`}>×{perGroup}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="bg-indigo-50 border border-indigo-200 px-4 py-1.5 rounded-full text-xs font-bold text-indigo-900">
                  🛍️ Sacolas abertas: {countedGroups.length}/{totalGroups} = <span className="text-indigo-700">{runningTotal}</span>
                </div>
              </div>
            );
          })()}

          {/* H. Division Groups Mode */}
          {config.type === 'div_groups' && (() => {
            const groups = config.groups || 0;
            const total = config.totalForDiv || 0;
            const emoji = config.groupEmoji || '🍎';
            // Each item is distributed one by one; groups get filled sequentially
            const distributed = distributedItems.length;
            const perGroup = config.itemsPerGroup || 0;
            return (
              <div className="w-full flex flex-col items-center gap-3">
                {/* Source pile */}
                <div className="w-full">
                  <p className="text-xs font-bold text-center text-slate-500 mb-1">Toque nos itens para distribuir 👇</p>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(total, 6)}, 1fr)`, gap: 6, maxWidth: 280 }}
                    className="p-2 bg-amber-50 rounded-xl border border-amber-100 mx-auto"
                  >
                    {Array.from({ length: total }).map((_, i) => {
                      const isDone = distributedItems.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleDivItemTap(i, total)}
                          disabled={isDone || isCompleted}
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-base transition-all ${
                            isDone
                              ? 'opacity-15 scale-75'
                              : 'bg-white border-2 border-amber-200 hover:border-amber-400 cursor-pointer hover:scale-110 active:scale-90 shadow-xs'
                          }`}
                        >
                          {isDone ? '' : emoji}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Destination groups */}
                <div
                  style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(groups, 4)}, 1fr)`, gap: 8, maxWidth: 300 }}
                  className="p-2 w-full justify-items-center"
                >
                  {Array.from({ length: groups }).map((_, gi) => {
                    const itemsHere = Math.min(Math.max(0, distributed - gi * perGroup), perGroup);
                    const isFull = itemsHere >= perGroup;
                    return (
                      <div
                        key={gi}
                        className={`flex flex-col items-center p-2 rounded-xl border-2 w-full ${
                          isFull
                            ? 'bg-emerald-50 border-emerald-400'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <span className="text-lg">🎒</span>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(perGroup, 3)}, 1fr)`, gap: 2 }}>
                          {Array.from({ length: perGroup }).map((_, j) => (
                            <span key={j} className={`text-xs ${j < itemsHere ? 'opacity-100' : 'opacity-20'}`}>{emoji}</span>
                          ))}
                        </div>
                        <span className="text-xs font-bold text-slate-500">{itemsHere}/{perGroup}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="bg-indigo-50 border border-indigo-200 px-4 py-1.5 rounded-full text-xs font-bold text-indigo-900">
                  🎒 Distribuídos: {distributed}/{total}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Victory Banner — no answer reveal */}
        {isCompleted && (
          <div className="w-full bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-4 flex flex-col items-center gap-3 shadow-sm" style={{ animation: 'fadeIn 0.4s ease' }}>
            <span className="text-4xl">🎉</span>
            <span className="font-black text-base text-emerald-900 text-center">
              Incrível! Você conseguiu! Agora escolha a resposta certa! 💪
            </span>
            <button
              type="button"
              onClick={onComplete}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black px-8 py-3 rounded-full text-base shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Ir para as opções!</span>
              <span>➔</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MATH STAGE COMPONENT
// -------------------------------------------------------------
interface MathStageProps {
  ageGroup: AgeGroup;
  problem: MathProblem;
  soundEnabled: boolean;
  onNextProblem: () => void;
  onPrevProblem: () => void;
  onMissProblem: () => void;
  mathIndex: number;
  totalProblems: number;
  onWinStar: () => void;
  speakAudio: (text: string, staticKey?: string) => Promise<void>;
  isAudioLoading: boolean;
  tvMode?: boolean;
}

function MathStage({
  ageGroup,
  problem,
  soundEnabled,
  onNextProblem,
  onPrevProblem,
  onMissProblem,
  mathIndex,
  totalProblems,
  onWinStar,
  speakAudio,
  isAudioLoading,
  tvMode = false
}: MathStageProps) {
  const [selectedMathOption, setSelectedMathOption] = useState<number | string | null>(null);
  const [mathWrongOption, setMathWrongOption] = useState<number | string | null>(null);
  const [mathHintActive, setMathHintActive] = useState(false);
  const [isMathCelebrating, setIsMathCelebrating] = useState(false);
  const [tappedCountItems, setTappedCountItems] = useState<number[]>([]);
  // Mini-desafio interativo de matemática (Cesto / Mãozinhas)
  const [showInteractiveMathModal, setShowInteractiveMathModal] = useState(false);
  // Só libera as alternativas depois de ouvir a pergunta
  const [showOptions, setShowOptions] = useState(false);
  const [wrongAttempts, setWrongAttempts] = useState(0);
  const [disabledOptions, setDisabledOptions] = useState<(number | string)[]>([]);
  // Embaralha a cada montagem (cada pergunta), para a certa não ficar sempre no mesmo lugar
  const [shuffledOptions] = useState<(number | string)[]>(() => {
    const opts = [...problem.options];
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [opts[i], opts[j]] = [opts[j], opts[i]];
    }
    return opts;
  });

  const MAX_ATTEMPTS = 4;
  const chancesLeft = MAX_ATTEMPTS - wrongAttempts;

  const handleSpeakQuestion = () => {
    playSoundFx('pop');
    speakAudio(problem.speechText, `math_pergunta_${problem.id}`);
    setShowOptions(true);
  };

  const handleMathOptionClick = (opt: number | string) => {
    if (isMathCelebrating || !showOptions || disabledOptions.includes(opt)) return;

    if (opt === problem.answer) {
      setSelectedMathOption(opt);
      setIsMathCelebrating(true);
      playSoundFx('star');
      onWinStar();
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#4ade80', '#facc15', '#f43f5e']
      });
      speakAudio(`Parabéns! Resposta correta: ${opt}!`, 'parabens_acertou');
      setTimeout(() => {
        onNextProblem();
      }, 2500);
      return;
    }

    // Errou
    playSoundFx('wrong');
    setMathWrongOption(opt);
    const nextAttempts = wrongAttempts + 1;
    setWrongAttempts(nextAttempts);
    setDisabledOptions((prev) => (prev.includes(opt) ? prev : [...prev, opt]));

    if (nextAttempts >= MAX_ATTEMPTS) {
      // Não revela a resposta — pula e agenda para outra oportunidade
      setIsMathCelebrating(true);
      speakAudio('Vamos tentar essa de novo mais tarde! Próxima pergunta!');
      setTimeout(() => {
        onMissProblem();
      }, 2200);
    } else {
      speakAudio('Tente de novo! Você tem mais uma chance!', 'tente_de_novo');
      setTimeout(() => setMathWrongOption(null), 700);
    }
  };

  // Math hint level: 0=none, 1=1st hint, 2=2nd hint
  const [mathHintLevel, setMathHintLevel] = useState(0);

  const giveMathHint = () => {
    if (!showOptions || mathHintLevel >= 2) return;
    playSoundFx('pop');
    const nextLevel = mathHintLevel + 1;
    setMathHintLevel(nextLevel);

    if (nextLevel === 1) {
      // 1ª dica: mini-desafio interativo se disponível (Cesto ou Mãozinhas)
      const challengeConfig = getMathChallengeConfig(problem);
      if (challengeConfig) {
        setShowInteractiveMathModal(true);
        speakAudio('Vamos resolver juntos com um desafio divertido!', 'dica_math_interativa');
      } else if (ageGroup === '3-5' || ageGroup === '6-8') {
        const wrong = shuffledOptions.filter(o => o !== problem.answer && !disabledOptions.includes(o));
        if (wrong.length > 0) {
          setDisabledOptions(prev => [...prev, wrong[0]]);
          speakAudio('Dica: Essa resposta não está certa! Tente as outras.', 'math_dica_elimina');
        }
      } else {
        const ans = Number(problem.answer);
        if (!isNaN(ans)) {
          const tipo = ans % 2 === 0 ? 'par' : 'ímpar';
          speakAudio(`Dica: A resposta é um número ${tipo}!`, `math_dica_paridade_${tipo}`);
          setMathHintActive(true);
        } else {
          speakAudio(problem.hint, `math_dica_${problem.id}`);
          setMathHintActive(true);
        }
      }
    } else {
      // 2ª dica: par/ímpar para 3-5 e 6-8; elimina opção para 9-12
      if (ageGroup === '3-5' || ageGroup === '6-8') {
        const ans = Number(problem.answer);
        const tipo = !isNaN(ans) ? (ans % 2 === 0 ? 'par' : 'ímpar') : null;
        if (tipo) speakAudio(`Mais uma dica: A resposta é ${tipo}!`, `math_dica2_${tipo}`);
        setMathHintActive(true);
      } else {
        // 9-11/12-14: elimina uma alternativa errada
        const wrong = shuffledOptions.filter(o => o !== problem.answer && !disabledOptions.includes(o));
        if (wrong.length > 0) {
          setDisabledOptions(prev => [...prev, wrong[0]]);
          speakAudio('Mais uma dica: Eliminei uma opção errada!', 'math_dica2_elimina');
        }
      }
    }
  };

  const handleTapCountItem = (idx: number) => {
    if (!tappedCountItems.includes(idx)) {
      const newItems = [...tappedCountItems, idx];
      setTappedCountItems(newItems);
      const numberWords = ['Um!', 'Dois!', 'Três!', 'Quatro!', 'Cinco!', 'Seis!'];
      const speechText = numberWords[newItems.length - 1] || `${newItems.length}!`;
      const staticKey = `contar_${newItems.length}`;
      speakAudio(speechText, staticKey);
      playSoundFx('pop');
    }
  };

  return (
    <>
    {showInteractiveMathModal && (
      <MathInteractiveHintModal
        problem={problem}
        onComplete={() => {
          setShowInteractiveMathModal(false);
          setMathHintActive(true);
          speakAudio(`Muito bem! A resposta certa é ${problem.answer}! Encontre nas opções!`, 'dica_math_ok');
        }}
        onClose={() => setShowInteractiveMathModal(false)}
        speakAudio={speakAudio}
      />
    )}
    <div className="w-full flex-1 flex flex-col items-center justify-between">
      {/* Problem Display Card */}
      <div className="w-full bg-white rounded-3xl border-2 border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col items-center text-center my-auto">

        {/* Prominent Question Speech Button */}
        <button
          id="btn-speak-math-prominent"
          data-tv-autofocus
          onClick={handleSpeakQuestion}
          className={`flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 rounded-full font-bold text-xs sm:text-sm border border-emerald-200 shadow-2xs transition-all my-2 ${
            !showOptions ? 'ring-4 ring-emerald-200 animate-pulse' : ''
          } ${tvMode ? 'tv-action-btn text-base px-6 py-4' : ''}`}
          title="Ouvir a pergunta em voz alta"
        >
          <Volume2 size={tvMode ? 24 : 18} className="text-emerald-600 shrink-0" />
          <span>{showOptions ? 'Ouvir a Pergunta de Novo' : 'Ouvir a Pergunta em Voz Alta'}</span>
          {isAudioLoading && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping ml-1" />
          )}
        </button>

        {!showOptions && (
          <p className="text-xs sm:text-sm text-slate-500 font-semibold mt-1 max-w-md">
            Escute a pergunta para liberar as alternativas
          </p>
        )}

        {showOptions && chancesLeft < MAX_ATTEMPTS && !isMathCelebrating && (
          <p className="text-xs sm:text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-2">
            {chancesLeft === 1 ? 'Última chance!' : `${chancesLeft} chances restantes`}
          </p>
        )}

        {/* Special Interactive Counting Display for 3-5 Years */}
        {problem.visualItems && (
          <div className="my-3 flex flex-col items-center">
            <p className="text-xs sm:text-sm text-slate-500 font-medium mb-3">
              👆 Toque nos itens para contar em voz alta:
            </p>
            <div className="flex flex-wrap justify-center gap-3 sm:gap-4 max-w-sm">
              {Array.from({ length: problem.visualItems.total }).map((_, i) => {
                const isTapped = tappedCountItems.includes(i);
                return (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.85 }}
                    onClick={() => handleTapCountItem(i)}
                    className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-4xl sm:text-5xl shadow-xs border-2 transition-all ${
                      isTapped
                        ? 'bg-amber-50 border-amber-400 scale-105 ring-2 ring-amber-200'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{problem.visualItems?.emoji}</span>
                    {isTapped && (
                      <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs font-black rounded-full w-6 h-6 flex items-center justify-center shadow-xs">
                        {tappedCountItems.indexOf(i) + 1}
                      </span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}

        {/* Visual Sum for 3-5 Years */}
        {problem.visualSum && (
          <div className="my-4 flex items-center justify-center gap-3 sm:gap-4 text-3xl sm:text-4xl bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex gap-1">
              {Array.from({ length: problem.visualSum.count1 }).map((_, i) => (
                <span key={i}>{problem.visualSum?.emoji1}</span>
              ))}
            </div>
            <span className="font-black text-indigo-600 text-2xl">+</span>
            <div className="flex gap-1">
              {Array.from({ length: problem.visualSum.count2 }).map((_, i) => (
                <span key={i}>{problem.visualSum?.emoji2}</span>
              ))}
            </div>
            <span className="font-black text-indigo-600 text-2xl">=</span>
            <span className="font-black text-amber-500 text-3xl">?</span>
          </div>
        )}

        {/* Clue/Hint text if active */}
        {mathHintActive && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold max-w-md"
          >
            💡 <strong>Dica:</strong> {problem.hint}
          </motion.div>
        )}
      </div>

      {/* Answer Options Grid — só depois de ouvir a pergunta */}
      <div className="w-full mt-6">
        {showOptions ? (
          <>
            <div className={`grid grid-cols-3 gap-3 mx-auto mb-6 ${tvMode ? 'max-w-3xl gap-5' : 'max-w-lg'}`}>
              {shuffledOptions.map((opt, idx) => {
                const isCorrect = selectedMathOption === opt;
                const isWrong = mathWrongOption === opt || disabledOptions.includes(opt);
                const isDisabled = disabledOptions.includes(opt) && opt !== problem.answer;
                return (
                  <motion.button
                    key={`${String(opt)}-${idx}`}
                    data-tv-autofocus={idx === 0 ? true : undefined}
                    whileHover={tvMode ? undefined : { scale: 1.02 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleMathOptionClick(opt)}
                    disabled={isMathCelebrating || isDisabled}
                    className={`tv-math-option relative font-black rounded-2xl border-b-4 py-4 sm:py-5 text-2xl sm:text-3xl shadow-sm transition-all flex items-center justify-center active:border-b-0 active:translate-y-1 ${
                      isCorrect
                        ? 'bg-emerald-500 border-emerald-700 text-white'
                        : isWrong
                          ? 'bg-red-100 border-red-400 text-red-700 opacity-60'
                          : mathHintActive && opt === problem.answer
                            ? 'bg-amber-50 border-amber-500 text-amber-950 ring-4 ring-amber-300 animate-pulse'
                            : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                    } ${tvMode ? 'py-8 text-4xl' : ''} disabled:cursor-not-allowed`}
                  >
                    {opt}
                  </motion.button>
                );
              })}
            </div>

            {wrongAttempts > 1 && mathHintLevel < 2 && (
              <div className="flex justify-center gap-3 flex-wrap">
                {mathHintLevel < 1 && (
                  <button
                    id="btn-hint-math-1"
                    onClick={giveMathHint}
                    disabled={isMathCelebrating}
                    className={`tv-action-btn flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 ${tvMode ? 'px-10 py-5 text-xl' : ''}`}
                  >
                    <Lightbulb size={tvMode ? 26 : 20} className="fill-amber-100 text-amber-900" />
                    <span>DICA</span>
                  </button>
                )}
                {mathHintLevel === 1 && (
                  <button
                    id="btn-hint-math-2"
                    onClick={giveMathHint}
                    disabled={isMathCelebrating}
                    className={`tv-action-btn flex items-center gap-2 bg-gradient-to-r from-orange-400 to-orange-500 text-orange-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-orange-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 ${tvMode ? 'px-10 py-5 text-xl' : ''}`}
                  >
                    <Lightbulb size={tvMode ? 26 : 20} className="fill-orange-100 text-orange-900" />
                    <span>MAIS UMA DICA</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex justify-center mb-4">
            <div className="bg-slate-100 border border-slate-200 text-slate-500 rounded-2xl px-5 py-4 text-sm font-bold text-center max-w-md">
              As alternativas aparecem depois que você ouvir a pergunta
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}

const emptySubscribe = () => () => {};

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
export default function EducationalApp() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('3-5');
  const [subject, setSubject] = useState<Subject>('letras');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stars, setStars] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // PWA & Connectivity hooks
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const isOnline = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install: installPWA } = usePWAInstall();
  const { tvMode, toggleTvMode } = useTvMode();
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  // Audio Strategy Settings
  // 'hybrid' = Use pre-bundled Kore files & IndexedDB cache, fallback to tuned local voice
  // 'offline_only' = Exclusively use local speech synthesis without trying API
  const [audioMode, setAudioMode] = useState<'hybrid' | 'offline_only'>('hybrid');
  const [cachedAudioCount, setCachedAudioCount] = useState(0);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [deviceVoices, setDeviceVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [lastVoiceUsedType, setLastVoiceUsedType] = useState<string>('kore_static');

  // Custom Words for spelling
  const [customWords, setCustomWords] = useState<WordChallenge[]>(INITIAL_WORDS['3-5']);
  const [newWordInput, setNewWordInput] = useState('');

  // Indices
  const [wordIndex, setWordIndex] = useState(0);
  const [mathIndex, setMathIndex] = useState(0);
  // Fila de índices das perguntas — erros voltam mais tarde na fila
  const [mathOrder, setMathOrder] = useState<number[]>(() =>
    MATH_PROBLEMS['3-5'].map((_, i) => i)
  );
  const [settingsTab, setSettingsTab] = useState<'audio' | 'palavras'>('audio');

  // Load voices & cached audio count on mount
  useEffect(() => {
    const updateVoiceList = () => {
      const ptVoices = getAvailablePtVoices();
      setDeviceVoices(ptVoices);
      const best = pickBestDefaultPtVoice();
      if (best) {
        setSelectedVoiceName(best.name);
      }
    };

    updateVoiceList();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoiceList;
    }

    getCachedAudioCount().then(setCachedAudioCount);
  }, []);

  // Navegação por setas SEMPRE ativa — a 1ª seta liga o modo TV se precisar
  useEffect(() => {
    const stopNav = initTvSpatialNavigation();
    const t = window.setTimeout(() => focusFirstTvControl(), 250);
    const showCursor = () => document.documentElement.classList.add('tv-cursor');
    window.addEventListener('mousemove', showCursor, { once: true });
    return () => {
      stopNav();
      clearTimeout(t);
      window.removeEventListener('mousemove', showCursor);
    };
  }, [subject, ageGroup]);

  // Load custom words and audio mode from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('aprender_custom_words_v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomWords(parsed);
          }
        }
        const savedMode = localStorage.getItem('aprender_audio_mode_v1');
        if (savedMode === 'hybrid' || savedMode === 'offline_only') {
          setAudioMode(savedMode);
        }
      } catch {
        // Fallback
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Persist custom words
  useEffect(() => {
    try {
      localStorage.setItem('aprender_custom_words_v1', JSON.stringify(customWords));
    } catch {}
  }, [customWords]);

  // Persist audio mode
  useEffect(() => {
    try {
      localStorage.setItem('aprender_audio_mode_v1', audioMode);
    } catch {}
  }, [audioMode]);

  // Unified speech caller
  const handleSpeak = async (text: string, staticKey?: string) => {
    if (!soundEnabled || !text) return;
    await playSmartAudio(text, {
      staticKey,
      useKoreApi: audioMode === 'hybrid' && isOnline,
      soundEnabled,
      onLoadingChange: setIsAudioLoading,
      onVoiceTypeUsed: (type) => {
        setLastVoiceUsedType(type);
      }
    });
  };

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoiceName(voiceName);
    const target = deviceVoices.find(v => v.name === voiceName) || null;
    setSelectedVoice(target);
  };

  const handleTestSelectedVoice = () => {
    handleSpeak('Muito bem! Você acertou!', 'parabens_acertou');
  };

  const handleClearCache = async () => {
    await clearCachedAudios();
    const count = await getCachedAudioCount();
    setCachedAudioCount(count);
  };

  const currentWordList = ageGroup === '3-5' ? customWords : INITIAL_WORDS[ageGroup];
  const activeWordObj = currentWordList[wordIndex % currentWordList.length] || { word: 'BOLA' };
  const currentMathList = MATH_PROBLEMS[ageGroup];
  const mathOrderSafe =
    mathOrder.length === 0 || mathOrder.some((i) => i < 0 || i >= currentMathList.length)
      ? currentMathList.map((_, i) => i)
      : mathOrder;
  const mathPos = mathIndex % Math.max(mathOrderSafe.length, 1);
  const activeMathProblem =
    currentMathList[mathOrderSafe[mathPos] ?? 0] || currentMathList[0];

  const goNextMath = () => setMathIndex((prev) => prev + 1);
  const goPrevMath = () => setMathIndex((prev) => Math.max(0, prev - 1));
  const handleMissMath = () => {
    // Recoloca a pergunta atual mais adiante na fila (sem revelar a resposta)
    setMathOrder((prev) => {
      const order =
        prev.length === 0 || prev.some((i) => i < 0 || i >= currentMathList.length)
          ? currentMathList.map((_, i) => i)
          : [...prev];
      const currentPos = mathIndex % order.length;
      const missed = order[currentPos];
      // Remove da posição atual e insere 3 posições à frente
      const newOrder = order.filter((_, idx) => idx !== currentPos);
      const insertAt = Math.min(currentPos + 3, newOrder.length);
      newOrder.splice(insertAt, 0, missed);
      return newOrder;
    });
    // NÃO incrementa mathIndex — a lista mudou, então mathIndex agora aponta para o próximo
    // Forçamos re-render alterando mathIndex para o valor correto
    setMathIndex((prev) => prev);
    // Usamos um pequeno truque: disparamos o próximo sem incrementar
    // Na prática avançamos via setMathIndex usando o novo order
    setMathIndex((prev) => {
      // Verifica se o novo order ainda colocaria o mesmo problema
      // Se sim, avança um extra
      return prev + 1;
    });
  };

  const handleSelectAgeGroup = (newAge: AgeGroup) => {
    setAgeGroup(newAge);
    setWordIndex(0);
    setMathIndex(0);
    setMathOrder(MATH_PROBLEMS[newAge].map((_, i) => i));
    const ageNames: Record<AgeGroup, string> = {
      '3-5': 'Fase 3 a 5 anos! Bem-vindos pequenos!',
      '6-8': 'Fase 6 a 8 anos! Vamos praticar!',
      '9-11': 'Fase 9 a 11 anos! Desafios incríveis!',
      '12-14': 'Fase 12 a 14 anos! Modo expert!'
    };
    const ageKeys: Record<AgeGroup, string> = {
      '3-5': 'fase_3_5',
      '6-8': 'fase_6_8',
      '9-11': 'fase_9_11',
      '12-14': 'fase_12_14'
    };
    handleSpeak(ageNames[newAge], ageKeys[newAge]);
  };

  const handleSelectSubject = (newSubject: Subject) => {
    setSubject(newSubject);
    const key = newSubject === 'letras' ? 'modo_letras' : 'modo_matematica';
    handleSpeak(newSubject === 'letras' ? 'Modo Letras e Palavras!' : 'Modo Matemática!', key);
  };

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeWord(newWordInput);
    if (clean && !customWords.some(w => w.word === clean)) {
      setCustomWords([{ word: clean }, ...customWords]);
      setNewWordInput('');
      handleSpeak(`Palavra ${clean} adicionada!`);
    }
  };

  const handleRemoveCustomWord = (w: string) => {
    if (customWords.length > 1) {
      setCustomWords(customWords.filter(item => item.word !== w));
    }
  };

  return (
    <div
      data-tv-nav
      className={`min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans select-none pb-8 ${tvMode ? 'tv-shell pb-12' : ''}`}
    >
      {/* Offline Status Toast */}
      {mounted && !isOnline && (
        <div className="bg-amber-500 text-white px-4 py-1.5 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-xs transition-all">
          <WifiOff size={15} />
          <span>Modo Offline Ativo — O aplicativo funciona 100% sem internet</span>
        </div>
      )}

      {/* Banner Modo TV */}
      {tvMode && (
        <div className="tv-banner bg-indigo-700 text-white px-4 py-2.5 text-sm sm:text-base font-bold items-center justify-center gap-3 shadow-sm">
          <Tv size={20} className="shrink-0" />
          <span>
            Modo TV: use as <strong>setas</strong> do controle para navegar e <strong>OK</strong> para escolher
          </span>
        </div>
      )}

      {/* Top Header & Console */}
      <header className={`sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-3 sm:px-6 py-2.5 ${tvMode ? 'tv-header' : ''}`}>
        <div className={`mx-auto flex flex-col gap-2 ${tvMode ? 'max-w-6xl gap-3' : 'max-w-3xl'}`}>
          
          {/* Top Row: Brand, PWA, Stars, Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-indigo-600 flex items-center gap-1.5">
                <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400" />
                Soletrando & Calculando
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Toggle Modo TV */}
              <button
                id="toggle-tv-mode-btn"
                onClick={toggleTvMode}
                className={`tv-nav-chip flex items-center gap-1.5 px-3 py-2 rounded-xl border font-extrabold text-xs shadow-2xs transition-all ${
                  tvMode
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
                title={tvMode ? 'Desativar modo TV' : 'Ativar modo TV (controle remoto)'}
              >
                <Tv size={16} />
                <span className="hidden sm:inline">{tvMode ? 'TV ON' : 'Modo TV'}</span>
              </button>

              {/* Install PWA Button if available */}
              {mounted && isInstallable && !isInstalled && (
                <button
                  id="install-pwa-header-btn"
                  onClick={installPWA}
                  className="tv-hide-on-tv hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-extrabold text-xs shadow-2xs transition-all"
                  title="Instalar aplicativo para usar offline"
                >
                  <Smartphone size={15} />
                  <span>Instalar App</span>
                </button>
              )}

              {/* iOS Guide Trigger if Safari */}
              {mounted && isIOS && !isInstalled && (
                <button
                  onClick={() => setShowIOSPrompt(true)}
                  className="tv-hide-on-tv hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-extrabold text-xs shadow-2xs"
                  title="Como instalar no iPhone / iPad"
                >
                  <Smartphone size={15} />
                  <span>Instalar no iOS</span>
                </button>
              )}

              {/* Star Counter */}
              <div 
                id="stars-badge"
                className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full text-amber-700 font-extrabold text-sm shadow-xs"
              >
                <Star className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
                <span>{stars}</span>
              </div>

              {/* Mute/Unmute Audio */}
              <button
                id="toggle-audio-button"
                onClick={() => {
                  if (soundEnabled) stopAllAudio();
                  setSoundEnabled(!soundEnabled);
                }}
                className={`tv-nav-chip p-2 rounded-xl border transition-colors ${
                  soundEnabled 
                    ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100' 
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
                title={soundEnabled ? 'Áudio ativado' : 'Áudio desativado'}
              >
                {soundEnabled ? <Volume2 size={tvMode ? 24 : 18} /> : <VolumeX size={tvMode ? 24 : 18} />}
              </button>

              {/* Parents Settings */}
              <button
                id="open-settings-button"
                onClick={() => setShowSettingsModal(true)}
                className={`tv-nav-chip p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors ${tvMode ? 'tv-hide-on-tv' : ''}`}
                title="Configurações dos Pais & Áudio"
              >
                <Settings size={tvMode ? 24 : 18} />
              </button>
            </div>
          </div>

          {/* Second Row: Age Group Segmented Selector */}
          <div className="w-full">
            <div className="grid grid-cols-4 gap-1 sm:gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 shadow-2xs">
              {(['3-5', '6-8', '9-11', '12-14'] as AgeGroup[]).map((age) => {
                const shortLabels: Record<AgeGroup, string> = {
                  '3-5': '3-5',
                  '6-8': '6-8',
                  '9-11': '9-11',
                  '12-14': '12-14'
                };
                const fullLabels: Record<AgeGroup, string> = {
                  '3-5': '3 a 5 anos',
                  '6-8': '6 a 8 anos',
                  '9-11': '9 a 11 anos',
                  '12-14': '12 a 14 anos'
                };
                const stageDesc: Record<AgeGroup, string> = {
                  '3-5': 'Pequenos',
                  '6-8': 'Iniciante',
                  '9-11': 'Médio',
                  '12-14': 'Expert'
                };
                const icons: Record<AgeGroup, string> = {
                  '3-5': '🐣',
                  '6-8': '🎨',
                  '9-11': '🚀',
                  '12-14': '🧠'
                };
                const isSelected = ageGroup === age;
                return (
                  <button
                    key={age}
                    id={`age-btn-${age}`}
                    onClick={() => handleSelectAgeGroup(age)}
                    className={`flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 py-1.5 sm:py-2 px-1 rounded-xl transition-all duration-200 min-h-[44px] select-none ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 font-black'
                        : 'text-slate-600 hover:bg-white/80 hover:text-slate-900 active:bg-slate-200 font-bold'
                    } ${tvMode ? 'tv-nav-chip min-h-[64px] text-base py-3' : ''}`}
                    title={`Faixa etária: ${fullLabels[age]} (${stageDesc[age]})`}
                  >
                    <span className="text-base leading-none">{icons[age]}</span>
                    <div className="flex flex-col items-center sm:items-start leading-none sm:leading-tight">
                      <span className="text-[11px] sm:text-xs font-black tracking-tight whitespace-nowrap">
                        <span className="sm:hidden">{shortLabels[age]}</span>
                        <span className="hidden sm:inline">{fullLabels[age]}</span>
                      </span>
                      <span className={`text-[9px] font-semibold sm:hidden ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                        anos
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Third Row: Subject Switcher (Letras vs Matemática) */}
          <div className={`grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl ${tvMode ? 'gap-3 p-2' : ''}`}>
            <button
              id="tab-letras"
              onClick={() => handleSelectSubject('letras')}
              className={`tv-nav-chip flex items-center justify-center gap-2 py-2 rounded-xl text-sm sm:text-base font-extrabold transition-all duration-200 ${
                subject === 'letras'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              } ${tvMode ? 'py-4 text-lg' : ''}`}
            >
              <BookOpen size={tvMode ? 24 : 18} />
              <span>Letras & Palavras</span>
            </button>
            <button
              id="tab-matematica"
              onClick={() => handleSelectSubject('matematica')}
              className={`tv-nav-chip flex items-center justify-center gap-2 py-2 rounded-xl text-sm sm:text-base font-extrabold transition-all duration-200 ${
                subject === 'matematica'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              } ${tvMode ? 'py-4 text-lg' : ''}`}
            >
              <Calculator size={tvMode ? 24 : 18} />
              <span>Matemática</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Game Stage */}
      <main className={`flex-1 w-full mx-auto px-4 py-4 sm:py-6 flex flex-col items-center justify-between ${tvMode ? 'tv-main max-w-5xl' : 'max-w-2xl'}`}>
        {subject === 'letras' ? (
          <LettersStage
            key={`letters-${ageGroup}-${wordIndex % currentWordList.length}-${activeWordObj.word}`}
            ageGroup={ageGroup}
            wordObj={activeWordObj}
            soundEnabled={soundEnabled}
            onNextWord={() => setWordIndex(prev => (prev + 1) % currentWordList.length)}
            onPrevWord={() => setWordIndex(prev => (prev - 1 + currentWordList.length) % currentWordList.length)}
            wordIndex={wordIndex % currentWordList.length}
            totalWords={currentWordList.length}
            onWinStar={() => setStars(s => s + 1)}
            speakAudio={handleSpeak}
            isAudioLoading={isAudioLoading}
            tvMode={tvMode}
          />
        ) : (
          <MathStage
            key={`math-${ageGroup}-${mathPos}-${activeMathProblem.id}-${mathIndex}`}
            ageGroup={ageGroup}
            problem={activeMathProblem}
            soundEnabled={soundEnabled}
            onNextProblem={goNextMath}
            onPrevProblem={goPrevMath}
            onMissProblem={handleMissMath}
            mathIndex={mathPos}
            totalProblems={currentMathList.length}
            onWinStar={() => setStars(s => s + 1)}
            speakAudio={handleSpeak}
            isAudioLoading={isAudioLoading}
            tvMode={tvMode}
          />
        )}
      </main>

      {/* iOS Safari Install Guide Modal */}
      {showIOSPrompt && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <Smartphone className="text-indigo-600" />
              Instalar no iPhone / iPad
            </h3>
            <p className="mt-3 text-sm text-slate-600 leading-relaxed">
              Para usar o aplicativo 100% offline no seu dispositivo Apple:
            </p>
            <ol className="mt-3 space-y-2 text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center shrink-0 font-bold">1</span>
                <span>Toque no botão <strong>Compartilhar</strong> (ícone do quadrado com a seta para cima) na barra do Safari.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center shrink-0 font-bold">2</span>
                <span>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center shrink-0 font-bold">3</span>
                <span>Abra o app pela tela inicial. Ele funcionará sem necessidade de internet!</span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSPrompt(false)}
              className="mt-4 w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 transition"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Parents / Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                Painel dos Pais & Voz Offline
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                data-tv-close
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
                title="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl mb-4 text-xs font-bold">
              <button
                onClick={() => setSettingsTab('audio')}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  settingsTab === 'audio'
                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bot size={15} />
                <span>Voz & Modo Offline</span>
              </button>
              <button
                onClick={() => setSettingsTab('palavras')}
                className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  settingsTab === 'palavras'
                    ? 'bg-white text-indigo-700 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen size={15} />
                <span>Palavras (3-5a)</span>
              </button>
            </div>

            {/* Tab 1: Voice & Offline Configuration */}
            {settingsTab === 'audio' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-slate-700">
                
                {/* Offline Strategy Card */}
                <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                      <Sparkles size={15} className="text-indigo-600 fill-indigo-200" />
                      Falas Gravadas & Estratégia de Áudio
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-black">
                      277 Áudios Gravados (0ms)
                    </span>
                  </div>

                  <p className="text-xs text-indigo-900/90 leading-relaxed">
                    O aplicativo possui <strong>falas gravadas (voz Bella)</strong> para letras, palavras, pistas, desafios, matemática e “próxima letra”. Os áudios gravados têm prioridade; se algum faltar, usa a voz do aparelho. Tudo toca <strong>instantaneamente</strong> e funciona <strong>offline</strong>.
                  </p>

                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {/* Option 1: Hybrid Mode */}
                    <button
                      type="button"
                      onClick={() => setAudioMode('hybrid')}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                        audioMode === 'hybrid'
                          ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="mt-0.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          audioMode === 'hybrid' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {audioMode === 'hybrid' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">
                          Modo Inteligente Híbrido (Recomendado)
                        </span>
                        <span className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          Toca áudios Kore já armazenados localmente. Quando online, gera e salva novos áudios na memória; quando offline, usa fallback de voz local suave sem erro.
                        </span>
                        {isTtsQuotaExhausted() && (
                          <span className="mt-1.5 inline-flex items-center gap-1.5 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200">
                            <Sparkles size={12} className="text-amber-500" />
                            Cota diária da API de voz atingida — Sistema falando com a voz otimizada do aparelho.
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Option 2: 100% Offline Mode */}
                    <button
                      type="button"
                      onClick={() => setAudioMode('offline_only')}
                      className={`p-3 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                        audioMode === 'offline_only'
                          ? 'bg-white border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                          : 'bg-white/60 border-slate-200 hover:bg-white'
                      }`}
                    >
                      <div className="mt-0.5">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          audioMode === 'offline_only' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                        }`}>
                          {audioMode === 'offline_only' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-800">
                          Modo 100% Offline Local
                        </span>
                        <span className="text-[11px] text-slate-600 mt-0.5 leading-snug">
                          Nunca faz chamadas de rede. Usa os áudios estáticos já no aparelho e a síntese de voz nativa pt-BR otimizada para crianças.
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Local Device Voice Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Voz Nativa do Aparelho (pt-BR):</span>
                    <span className="text-[10px] text-slate-400 font-semibold">
                      {deviceVoices.length} voz(es) encontrada(s)
                    </span>
                  </label>

                  {deviceVoices.length > 0 ? (
                    <select
                      value={selectedVoiceName}
                      onChange={(e) => handleVoiceChange(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                    >
                      {deviceVoices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name} {v.name.includes('Natural') || v.name.includes('Google') ? '⭐ (Natural)' : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                      Voz nativa padrão em português brasileiro ativada.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleTestSelectedVoice}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs border border-slate-200 transition-colors mt-1"
                  >
                    <Volume2 size={15} />
                    <span>Testar Reprodução de Voz Agora</span>
                  </button>
                </div>

                {/* Local Memory Storage Statistics */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800">
                      Memória Local de Áudios:
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {cachedAudioCount} áudio(s) Kore gravados no seu navegador.
                    </p>
                  </div>
                  {cachedAudioCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearCache}
                      className="text-[11px] text-red-600 hover:text-red-700 font-bold underline px-2 py-1"
                    >
                      Limpar
                    </button>
                  )}
                </div>

                {/* Install App PWA Section */}
                {isInstallable && !isInstalled && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-emerald-900">
                        Instalar como Aplicativo
                      </span>
                      <p className="text-[11px] text-emerald-800">
                        Instale no tablet ou celular para jogar offline sem abrir o navegador.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={installPWA}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-xs shrink-0"
                    >
                      Instalar
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* Tab 2: Custom Words (3-5 Years) */}
            {settingsTab === 'palavras' && (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col">
                <p className="text-xs text-slate-600 mb-3">
                  Adicione palavras personalizadas na fase <strong>3 a 5 anos</strong> (como o nome do seu filho, animais de estimação ou familiares):
                </p>

                {/* Add Custom Word Form */}
                <form onSubmit={handleAddCustomWord} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={newWordInput}
                    onChange={(e) => setNewWordInput(e.target.value)}
                    placeholder="Ex: NOME DA CRIANÇA"
                    className="flex-1 bg-slate-50 border-2 border-slate-200 rounded-xl px-3 py-2 font-bold uppercase text-slate-800 placeholder:normal-case placeholder:font-normal text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={!newWordInput.trim()}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-3.5 py-2 rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1 transition-colors text-xs"
                  >
                    <Plus size={16} />
                    Adicionar
                  </button>
                </form>

                {/* List of Words */}
                <div className="flex-1 overflow-y-auto max-h-48 space-y-1.5 border border-slate-100 rounded-xl p-2 bg-slate-50/50 mb-3">
                  {customWords.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-lg shadow-2xs"
                    >
                      <span className="font-extrabold tracking-wider text-slate-800 text-xs sm:text-sm">
                        {item.word}
                      </span>
                      {customWords.length > 1 && (
                        <button
                          onClick={() => handleRemoveCustomWord(item.word)}
                          className="text-red-400 hover:text-red-600 p-1 rounded-md transition-colors"
                          title="Remover palavra"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => setShowSettingsModal(false)}
              data-tv-close
              className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white font-black py-2.5 rounded-xl shadow-md text-sm transition-all mt-2"
            >
              Voltar ao Jogo
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
