'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  Mic,
  Check
} from 'lucide-react';

// Normalize word to uppercase, remove accents and special chars
const normalizeWord = (w: string) => 
  w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/[^A-Z]/g, '');

// Portuguese Alphabet letter phonetic pronunciations
const PT_LETTER_NAMES: Record<string, string> = {
  A: 'Á',
  B: 'Bê',
  C: 'Cê',
  D: 'Dê',
  E: 'É',
  F: 'Éfe',
  G: 'Gê',
  H: 'Agá',
  I: 'I',
  J: 'Jota',
  K: 'Cá',
  L: 'Éle',
  M: 'Ême',
  N: 'Êne',
  O: 'Ó',
  P: 'Pê',
  Q: 'Quê',
  R: 'Érre',
  S: 'Ésse',
  T: 'Tê',
  U: 'U',
  V: 'Vê',
  W: 'Dáblio',
  X: 'Xis',
  Y: 'Ípsilon',
  Z: 'Zê'
};

// Formats uppercase word to Titlecase so TTS voices don't spell it out as an acronym
const formatWordForSpeech = (w: string): string => {
  if (!w) return '';
  const clean = w.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

// Clean Web Audio Synthesizer for instant sound feedback
const playSound = (type: 'correct' | 'wrong' | 'pop' | 'star' | 'shuffle') => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else if (type === 'wrong') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
    } else if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'shuffle') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.14);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } else if (type === 'star') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // AudioContext fallback handled
  }
};

// Brazilian Portuguese voice caching & high-quality selection
let activePtVoice: SpeechSynthesisVoice | null = null;

const pickBestVoice = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return;

  const naturalPtBr = voices.find(
    v => (v.lang === 'pt-BR' || v.lang === 'pt_BR') && 
         (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Luciana') || v.name.includes('Felipe') || v.name.includes('Francisca') || v.name.includes('Maria'))
  );
  if (naturalPtBr) {
    activePtVoice = naturalPtBr;
    return;
  }

  const anyPtBr = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR');
  if (anyPtBr) {
    activePtVoice = anyPtBr;
    return;
  }

  const anyPt = voices.find(v => v.lang.toLowerCase().startsWith('pt'));
  if (anyPt) {
    activePtVoice = anyPt;
  }
};

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  pickBestVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    pickBestVoice();
  };
}

// In-memory cache for generated Gemini TTS audio base64 data URLs
const ttsAudioCache = new Map<string, string>();

// Portuguese Speech Synthesis fallback helpers (Web Speech API)
const speakLocal = (text: string, enabled: boolean = true) => {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    if (!activePtVoice) {
      pickBestVoice();
    }
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = 'pt-BR';
    msg.rate = 0.88;
    msg.pitch = 1.05;
    if (activePtVoice) {
      msg.voice = activePtVoice;
    }
    window.speechSynthesis.speak(msg);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
};

const speak = speakLocal;

// Pronounces a single letter cleanly using its Portuguese phonetic name
const speakSingleLetter = (char: string, enabled: boolean = true) => {
  const upper = char.toUpperCase();
  const phonetic = PT_LETTER_NAMES[upper] || upper;
  speak(phonetic, enabled);
};

// Pronounces the next expected letter with encouraging guidance
const speakNextLetterPrompt = (char: string, enabled: boolean = true) => {
  const upper = char.toUpperCase();
  const phonetic = PT_LETTER_NAMES[upper] || upper;
  speak(`A próxima letra é: ${phonetic}!`, enabled);
};

// Pronounces full word formatted cleanly for Brazilian Portuguese natural tone
const speakFullWord = (word: string, enabled: boolean = true) => {
  const natural = formatWordForSpeech(word);
  speak(natural, enabled);
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
    { word: 'BRILHANTE', clue: 'Algo que reflete muita luz ou alguém muito inteligente' },
    { word: 'BORBOLETA', clue: 'Inseto gracioso que passa por metamorfose' },
    { word: 'PLANETA', clue: 'Corpo celeste como a Terra, Marte ou Júpiter' }
  ],
  '12-14': [
    { word: 'METAFORA', clue: 'Figura de linguagem com comparação implícita' },
    { word: 'CONSCIENCIA', clue: 'Capacidade humana de perceber e julgar a própria mente' },
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
      options: [2, 3, 4, 5],
      answer: 3
    },
    {
      id: 'm3-2',
      question: 'Quantas estrelinhas estão brilhando?',
      speechText: 'Quantas estrelinhas estão brilhando? Vamos contar!',
      visualItems: { emoji: '⭐️', total: 5 },
      hint: 'Conte devagarzinho: 1, 2, 3, 4, 5 estrelas!',
      options: [3, 4, 5, 6],
      answer: 5
    },
    {
      id: 'm3-3',
      question: 'Quantos carrinhos você vê?',
      speechText: 'Quantos carrinhos você vê aqui na tela?',
      visualItems: { emoji: '🚗', total: 2 },
      hint: 'Tem 1 e depois 2!',
      options: [1, 2, 3, 4],
      answer: 2
    },
    {
      id: 'm3-4',
      question: 'Quantos balões coloridos temos?',
      speechText: 'Quantos balões coloridos estão flutuando?',
      visualItems: { emoji: '🎈', total: 4 },
      hint: 'São quatro balões: 1, 2, 3, 4!',
      options: [2, 3, 4, 5],
      answer: 4
    },
    {
      id: 'm3-5',
      question: 'Quantos gatinhos no total?',
      speechText: 'Dois gatinhos mais um gatinho. Quantos gatinhos ficam?',
      visualSum: { count1: 2, emoji1: '🐱', count2: 1, emoji2: '🐱' },
      hint: 'Junte 2 gatinhos com mais 1 gatinho = 3 gatinhos!',
      options: [2, 3, 4],
      answer: 3
    },
    {
      id: 'm3-6',
      question: 'Quantos cachorrinhos no total?',
      speechText: 'Um cachorrinho mais um cachorrinho. Quanto dá?',
      visualSum: { count1: 1, emoji1: '🐶', count2: 1, emoji2: '🐶' },
      hint: '1 mais 1 é igual a 2!',
      options: [1, 2, 3],
      answer: 2
    },
    {
      id: 'm3-7',
      question: 'Quantos sóis você vê no céu?',
      speechText: 'Quantos sóis você vê?',
      visualItems: { emoji: '☀️', total: 1 },
      hint: 'Temos apenas um sol radiante!',
      options: [1, 2, 3, 4],
      answer: 1
    }
  ],
  '6-8': [
    {
      id: 'm6-1',
      question: '5 + 4 = ?',
      speechText: 'Quanto é 5 mais 4?',
      hint: 'Pense: 5 mais 5 é 10, então 5 mais 4 é 9!',
      options: [8, 9, 10, 7],
      answer: 9
    },
    {
      id: 'm6-2',
      question: '8 + 7 = ?',
      speechText: 'Quanto é 8 mais 7?',
      hint: '8 mais 2 é 10, com mais 5 dá 15!',
      options: [14, 15, 16, 13],
      answer: 15
    },
    {
      id: 'm6-3',
      question: '10 - 4 = ?',
      speechText: 'Se você tem 10 e tira 4, quanto sobra?',
      hint: 'Conte voltando de 10 tirando 4: 9, 8, 7, 6!',
      options: [5, 6, 7, 4],
      answer: 6
    },
    {
      id: 'm6-4',
      question: '14 - 6 = ?',
      speechText: 'Quanto é 14 menos 6?',
      hint: '14 menos 4 é 10, menos 2 é 8!',
      options: [7, 8, 9, 6],
      answer: 8
    },
    {
      id: 'm6-5',
      question: '2, 4, 6, [ ? ]',
      speechText: 'Complete a sequência de 2 em 2: 2, 4, 6, e o próximo é?',
      hint: 'Estamos contando de 2 em 2. Depois de 6 vem o 8!',
      options: [7, 8, 9, 10],
      answer: 8
    },
    {
      id: 'm6-6',
      question: 'Quanto falta para 10 se você tem 7?',
      speechText: 'Se você já tem 7, quantos faltam para chegar no 10?',
      hint: '7 mais 3 dá 10!',
      options: [2, 3, 4, 5],
      answer: 3
    },
    {
      id: 'm6-7',
      question: '6 + 6 = ?',
      speechText: 'Qual é o dobro de 6? 6 mais 6!',
      hint: '6 mais 6 é uma dúzia: 12!',
      options: [11, 12, 13, 10],
      answer: 12
    }
  ],
  '9-11': [
    {
      id: 'm9-1',
      question: '7 × 8 = ?',
      speechText: 'Quanto é 7 vezes 8?',
      hint: 'Lembre-se da tabuada: 7 vezes 7 é 49. Some mais 7 e terá 56!',
      options: [54, 56, 58, 64],
      answer: 56
    },
    {
      id: 'm9-2',
      question: '6 × 9 = ?',
      speechText: 'Quanto é 6 vezes 9?',
      hint: '6 vezes 10 é 60. Subtraia 6 e você terá 54!',
      options: [52, 54, 56, 63],
      answer: 54
    },
    {
      id: 'm9-3',
      question: '48 ÷ 6 = ?',
      speechText: 'Quanto é 48 dividido por 6?',
      hint: 'Qual número multiplicado por 6 dá 48? É o 8!',
      options: [6, 7, 8, 9],
      answer: 8
    },
    {
      id: 'm9-4',
      question: '72 ÷ 9 = ?',
      speechText: 'Quanto é 72 dividido por 9?',
      hint: 'Pense: 9 vezes quanto é igual a 72? É o 8!',
      options: [7, 8, 9, 6],
      answer: 8
    },
    {
      id: 'm9-5',
      question: '45 + 38 = ?',
      speechText: 'Quanto é 45 mais 38?',
      hint: '45 mais 30 dá 75, mais 8 resulta em 83!',
      options: [81, 83, 85, 73],
      answer: 83
    },
    {
      id: 'm9-6',
      question: '100 - 37 = ?',
      speechText: 'Quanto é 100 menos 37?',
      hint: '100 menos 30 dá 70. 70 menos 7 dá 63!',
      options: [63, 67, 73, 57],
      answer: 63
    },
    {
      id: 'm9-7',
      question: 'Qual é o dobro de 18?',
      speechText: 'Qual é o dobro de 18?',
      hint: '18 vezes 2: 10x2=20 mais 8x2=16 -> 36!',
      options: [32, 36, 38, 40],
      answer: 36
    }
  ],
  '12-14': [
    {
      id: 'm12-1',
      question: 'x + 9 = 24. Quanto vale x?',
      speechText: 'Se x mais 9 é igual a 24, qual é o valor de x?',
      hint: 'Isole o x: subtraia 9 de 24. x = 24 - 9 = 15!',
      options: [13, 14, 15, 16],
      answer: 15,
      explanation: 'x = 24 - 9 = 15'
    },
    {
      id: 'm12-2',
      question: 'Quanto é 25% de 80?',
      speechText: 'Quanto é vinte e cinco por cento de oitenta?',
      hint: '25% é o mesmo que dividir por 4. 80 ÷ 4 = 20!',
      options: [15, 20, 25, 30],
      answer: 20,
      explanation: '80 ÷ 4 = 20'
    },
    {
      id: 'm12-3',
      question: 'Qual o valor de 3³ (3 ao cubo)?',
      speechText: 'Qual o valor de 3 elevado a 3?',
      hint: 'Multiplique 3 por ele mesmo 3 vezes: 3 × 3 = 9, e 9 × 3 = 27!',
      options: [9, 18, 27, 81],
      answer: 27,
      explanation: '3 × 3 × 3 = 27'
    },
    {
      id: 'm12-4',
      question: 'Qual é a raiz quadrada de 144 (√144)?',
      speechText: 'Qual é a raiz quadrada de 144?',
      hint: 'Qual número multiplicado por ele mesmo dá 144? 12 × 12 = 144!',
      options: [11, 12, 14, 16],
      answer: 12,
      explanation: '12 × 12 = 144'
    },
    {
      id: 'm12-5',
      question: 'Qual o resultado de 1/2 + 1/4?',
      speechText: 'Quanto é a fração um meio mais um quarto?',
      hint: '1/2 equivale a 2/4. Somando 2/4 + 1/4 obtemos 3/4!',
      options: ['2/6', '3/4', '1/8', '2/4'],
      answer: '3/4',
      explanation: '2/4 + 1/4 = 3/4'
    },
    {
      id: 'm12-6',
      question: '2x - 4 = 16. Quanto vale x?',
      speechText: 'Se 2x menos 4 é igual a 16, qual é o valor de x?',
      hint: 'Some 4 aos dois lados: 2x = 20. Divida por 2: x = 10!',
      options: [8, 10, 12, 14],
      answer: 10,
      explanation: '2x = 20 -> x = 10'
    },
    {
      id: 'm12-7',
      question: 'Se 3 livros custam R$ 15, quanto custam 6 livros?',
      speechText: 'Se 3 livros custam 15 reais, quanto custam 6 livros?',
      hint: '6 livros é o dobro de 3, logo o preço é o dobro de 15: R$ 30!',
      options: ['R$ 25', 'R$ 30', 'R$ 35', 'R$ 45'],
      answer: 'R$ 30',
      explanation: 'Dobro da quantidade = dobro do valor'
    }
  ]
};

// Helper to generate letter bank
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

// Helper to advance, replenish decoys and shuffle bank
function advanceAndShuffleBank(
  currentBank: LetterItem[],
  clickedId: string,
  word: string,
  newSpelledCount: number
): LetterItem[] {
  const remaining = currentBank.filter(x => x.id !== clickedId);
  const neededRemaining = word.slice(newSpelledCount).split('');
  const currentBankChars = [...remaining.map(x => x.char)];
  const missingItems: LetterItem[] = [];

  for (let i = 0; i < neededRemaining.length; i++) {
    const ch = neededRemaining[i];
    const idxInBank = currentBankChars.indexOf(ch);
    if (idxInBank !== -1) {
      currentBankChars.splice(idxInBank, 1);
    } else {
      missingItems.push({
        id: `target-${newSpelledCount}-${i}-${ch}-${Math.random().toString(36).slice(2, 6)}`,
        char: ch,
        isTarget: true
      });
    }
  }

  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const newDecoys: LetterItem[] = [];
  const decoysToAdd = remaining.length < 8 ? 2 : 1;
  for (let i = 0; i < decoysToAdd; i++) {
    const randomChar = alphabet[Math.floor(Math.random() * alphabet.length)];
    newDecoys.push({
      id: `decoy-dyn-${newSpelledCount}-${i}-${randomChar}-${Math.random().toString(36).slice(2, 6)}`,
      char: randomChar,
      isTarget: false
    });
  }

  return [...remaining, ...missingItems, ...newDecoys].sort(() => Math.random() - 0.5);
}

function shuffleArray<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

// -------------------------------------------------------------
// LETTERS STAGE COMPONENT (Self-contained, clean React state)
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
  speakAudio: (text: string, onLoadingChange?: (loading: boolean) => void) => Promise<void>;
  isAiTtsEnabled: boolean;
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
  isAiTtsEnabled
}: LettersStageProps) {
  const currentWord = wordObj.word;
  const [spelledCount, setSpelledCount] = useState(0);
  // Deterministic initial state to eliminate hydration mismatch on SSR
  const [letterBank, setLetterBank] = useState<LetterItem[]>(() =>
    wordObj.word.split('').map((char, i) => ({
      id: `word-${i}-${char}`,
      char,
      isTarget: true
    }))
  );

  // Randomize bank and decoys on client-side mount / word change
  useEffect(() => {
    const timer = setTimeout(() => {
      setLetterBank(generateBank(currentWord));
    }, 0);
    return () => clearTimeout(timer);
  }, [currentWord]);
  const [wrongLetterId, setWrongLetterId] = useState<string | null>(null);
  const [hintLetterId, setHintLetterId] = useState<string | null>(null);
  const [isLetterCelebrating, setIsLetterCelebrating] = useState(false);
  const [isQuestionAudioLoading, setIsQuestionAudioLoading] = useState(false);

  const expectedChar = currentWord[spelledCount];

  // Question speech prompt text (with clue if available)
  const questionSpeechText = wordObj.clue
    ? `Desafio de Soletrar! Pista: ${wordObj.clue}. Qual é a palavra? É ${formatWordForSpeech(currentWord)}! Toque nas letras para soletrar.`
    : `Desafio de Soletrar! Soletre a palavra: ${formatWordForSpeech(currentWord)}! Toque nas letras na ordem certa para formar a palavra.`;

  // Hear question button action (matching the Math tab functionality)
  const handleSpeakQuestion = () => {
    playSound('pop');
    speakAudio(questionSpeechText, setIsQuestionAudioLoading);
  };

  // Speak full word button action
  const handleSpeakFullWord = () => {
    playSound('pop');
    speakAudio(`Palavra: ${formatWordForSpeech(currentWord)}!`);
  };

  // Speak next letter button action
  const handleSpeakNextLetter = () => {
    if (!expectedChar || isLetterCelebrating) return;
    playSound('pop');
    const upper = expectedChar.toUpperCase();
    const phonetic = PT_LETTER_NAMES[upper] || upper;
    speakAudio(`A próxima letra é: ${phonetic}!`);

    // Provide visual pulse on the matching letter in bank
    const target = letterBank.find(x => x.char === expectedChar);
    if (target) {
      setHintLetterId(target.id);
      setTimeout(() => setHintLetterId(null), 2200);
    }
  };

  // Shuffle letters manually
  const handleManualShuffle = () => {
    playSound('shuffle');
    setLetterBank(prev => [...prev].sort(() => Math.random() - 0.5));
  };

  // Letter clicked
  const handleLetterClick = (item: LetterItem) => {
    if (isLetterCelebrating) return;

    speakSingleLetter(item.char, soundEnabled);
    playSound('pop');

    if (item.char === expectedChar) {
      const newCount = spelledCount + 1;
      setSpelledCount(newCount);

      if (newCount === currentWord.length) {
        // Complete word celebration
        setLetterBank(prev => prev.filter(x => x.id !== item.id));
        setIsLetterCelebrating(true);
        playSound('star');
        onWinStar();

        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#facc15', '#4ade80', '#60a5fa', '#f87171', '#c084fc']
        });

        setTimeout(() => {
          speakAudio(`Muito bem! Você completou a palavra ${formatWordForSpeech(currentWord)}!`);
        }, 600);

        setTimeout(() => {
          onNextWord();
        }, 3000);
      } else {
        // ADVANCING TO NEXT LETTER:
        // Filter out used letter, guarantee all remaining required letters, add new decoys, and SHUFFLE!
        setLetterBank(prev => advanceAndShuffleBank(prev, item.id, currentWord, newCount));
        playSound('shuffle');
      }
    } else {
      playSound('wrong');
      setWrongLetterId(item.id);
      setTimeout(() => setWrongLetterId(null), 500);
    }
  };

  const giveLetterHint = () => {
    if (!expectedChar || isLetterCelebrating) return;
    playSound('pop');
    const upper = expectedChar.toUpperCase();
    const phonetic = PT_LETTER_NAMES[upper] || upper;
    speakAudio(`Dica: A próxima letra é ${phonetic}!`);

    const target = letterBank.find(x => x.char === expectedChar);
    if (target) {
      setHintLetterId(target.id);
      setTimeout(() => setHintLetterId(null), 2500);
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-between">
      {/* Word Progress & Header */}
      <div className="w-full flex flex-col items-center gap-2 mb-3">
        <div className="flex items-center justify-between w-full">
          <button
            id="prev-word-btn"
            onClick={onPrevWord}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs active:scale-95 transition-all"
            title="Palavra anterior"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Palavra {wordIndex + 1} de {totalWords}
            </span>
            {/* Listen to Word Question in Header - Exact parity with Math tab */}
            <button
              id="speak-word-header-btn"
              onClick={handleSpeakQuestion}
              className="p-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-2xs"
              title="Ouvir a pergunta / desafio da palavra"
            >
              <Volume2 size={18} />
            </button>
          </div>

          <button
            id="next-word-btn"
            onClick={onNextWord}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs active:scale-95 transition-all"
            title="Próxima palavra"
          >
            <ChevronRight size={22} />
          </button>
        </div>

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
                playSound('pop');
                speakAudio(`Pista: ${wordObj.clue}`);
              }}
              className="p-1.5 rounded-full bg-white text-indigo-600 hover:bg-indigo-100 transition-colors shrink-0 shadow-2xs"
              title="Ouvir apenas a pista"
            >
              <Volume2 size={16} />
            </button>
          </div>
        )}

        {/* Prominent Question Speech Button - Same prominent audio button as in Math Tab */}
        <button
          id="btn-speak-word-prominent"
          onClick={handleSpeakQuestion}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 active:scale-95 text-indigo-800 rounded-full font-bold text-xs sm:text-sm border border-indigo-200 shadow-2xs transition-all mt-1"
          title="Ouvir a pergunta do desafio em voz alta"
        >
          <Volume2 size={18} className="text-indigo-600 shrink-0" />
          <span>Ouvir a Pergunta em Voz Alta</span>
          {isQuestionAudioLoading && (
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping ml-1" />
          )}
          {isAiTtsEnabled && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md ml-1">
              ✨ IA
            </span>
          )}
        </button>
      </div>

      {/* PROMINENT PRONUNCIATION / SPEECH BUTTONS */}
      <div className="w-full max-w-md mx-auto grid grid-cols-2 gap-2.5 sm:gap-3 my-2">
        {/* Botão 1: Falar Palavra Toda */}
        <button
          id="btn-speak-full-word"
          onClick={handleSpeakFullWord}
          className="flex items-center justify-center gap-2.5 px-3 py-3 sm:py-3.5 bg-gradient-to-br from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-95 text-white rounded-2xl font-black shadow-md border-b-4 border-indigo-800 transition-all text-xs sm:text-sm group"
          title="Falar e ouvir a palavra toda"
        >
          <div className="p-1.5 rounded-xl bg-white/20 group-hover:bg-white/30 transition-colors">
            <Volume2 size={22} className="text-white shrink-0" />
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
          onClick={handleSpeakNextLetter}
          disabled={isLetterCelebrating || !expectedChar}
          className="flex items-center justify-center gap-2.5 px-3 py-3 sm:py-3.5 bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 active:scale-95 text-amber-950 rounded-2xl font-black shadow-md border-b-4 border-amber-700 transition-all text-xs sm:text-sm disabled:opacity-50 group"
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
      <div className="my-auto py-4 flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-full">
        {currentWord.split('').map((char, idx) => {
          const isSpelled = idx < spelledCount;
          const isCurrent = idx === spelledCount;

          return (
            <div
              key={idx}
              className={`relative flex items-center justify-center rounded-2xl font-black transition-all duration-300 ${
                ageGroup === '3-5'
                  ? 'w-14 h-20 sm:w-20 sm:h-24 text-4xl sm:text-6xl border-4'
                  : 'w-11 h-16 sm:w-16 sm:h-20 text-3xl sm:text-5xl border-3 sm:border-4'
              } ${
                isSpelled
                  ? 'bg-emerald-500 border-emerald-600 text-white shadow-md'
                  : isCurrent
                    ? 'bg-white border-amber-400 shadow-md ring-4 ring-amber-100'
                    : 'bg-white/70 border-slate-200 text-transparent'
              }`}
            >
              <AnimatePresence>
                {isSpelled && (
                  <motion.span
                    initial={{ scale: 0.2, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="drop-shadow-sm"
                  >
                    {char}
                  </motion.span>
                )}
              </AnimatePresence>

              {!isSpelled && (
                <div className="w-1/2 h-1.5 rounded-full bg-slate-300 opacity-60 absolute bottom-3" />
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Letter Bank with Dynamic Shuffle */}
      <div className="w-full flex flex-col items-center mt-4">
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-lg mb-4">
          <AnimatePresence>
            {letterBank.map((item) => (
              <motion.button
                key={item.id}
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: 1,
                  opacity: 1,
                  x: wrongLetterId === item.id ? [-6, 6, -6, 6, 0] : 0,
                  backgroundColor: wrongLetterId === item.id ? '#fee2e2' : '#ffffff',
                  borderColor: wrongLetterId === item.id ? '#f87171' : '#cbd5e1',
                  color: wrongLetterId === item.id ? '#b91c1c' : '#1e293b'
                }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', bounce: 0.3 }}
                onClick={() => handleLetterClick(item)}
                className={`relative font-black rounded-2xl shadow-xs border-b-4 active:border-b-0 active:translate-y-1 transition-all ${
                  ageGroup === '3-5'
                    ? 'w-16 h-16 sm:w-20 sm:h-20 text-4xl sm:text-5xl'
                    : 'w-12 h-12 sm:w-16 sm:h-16 text-2xl sm:text-4xl'
                } ${
                  hintLetterId === item.id
                    ? 'ring-4 ring-amber-400 bg-amber-50 animate-pulse text-amber-600'
                    : ''
                }`}
              >
                {item.char}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Action Controls: Shuffle & Hint */}
        <div className="flex items-center gap-3">
          {/* Embaralhar Letras */}
          <button
            id="btn-shuffle-letters"
            onClick={handleManualShuffle}
            disabled={isLetterCelebrating}
            className="flex items-center gap-1.5 px-4 py-3 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-bold text-sm sm:text-base shadow-xs active:scale-95 transition-all disabled:opacity-50"
            title="Embaralhar as letras disponíveis"
          >
            <Shuffle size={18} />
            <span>Embaralhar</span>
          </button>

          {/* Hint Button */}
          <button
            id="btn-hint-letter"
            onClick={giveLetterHint}
            disabled={isLetterCelebrating || spelledCount >= currentWord.length}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
          >
            <Lightbulb size={20} className="fill-amber-100 text-amber-900" />
            <span>DICA</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MATH STAGE COMPONENT (Self-contained, clean React state)
// -------------------------------------------------------------
interface MathStageProps {
  problem: MathProblem;
  soundEnabled: boolean;
  onNextProblem: () => void;
  onPrevProblem: () => void;
  mathIndex: number;
  totalProblems: number;
  onWinStar: () => void;
  speakAudio: (text: string, onLoadingChange?: (loading: boolean) => void) => Promise<void>;
  isAiTtsEnabled: boolean;
}

function MathStage({
  problem,
  soundEnabled,
  onNextProblem,
  onPrevProblem,
  mathIndex,
  totalProblems,
  onWinStar,
  speakAudio,
  isAiTtsEnabled
}: MathStageProps) {
  const [selectedMathOption, setSelectedMathOption] = useState<number | string | null>(null);
  const [mathWrongOption, setMathWrongOption] = useState<number | string | null>(null);
  const [mathHintActive, setMathHintActive] = useState(false);
  const [isMathCelebrating, setIsMathCelebrating] = useState(false);
  const [tappedCountItems, setTappedCountItems] = useState<number[]>([]);
  const [isMathAudioLoading, setIsMathAudioLoading] = useState(false);

  const handleMathOptionClick = (opt: number | string) => {
    if (isMathCelebrating) return;

    if (opt === problem.answer) {
      setSelectedMathOption(opt);
      setIsMathCelebrating(true);
      playSound('star');
      onWinStar();

      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#38bdf8', '#4ade80', '#facc15', '#f43f5e']
      });

      speakAudio(`Parabéns! Resposta correta: ${opt}!`);

      setTimeout(() => {
        onNextProblem();
      }, 2500);
    } else {
      playSound('wrong');
      setMathWrongOption(opt);
      speakAudio('Tente de novo!');
      setTimeout(() => setMathWrongOption(null), 600);
    }
  };

  const giveMathHint = () => {
    setMathHintActive(true);
    playSound('pop');
    speakAudio(problem.hint);
  };

  const handleTapCountItem = (idx: number) => {
    if (!tappedCountItems.includes(idx)) {
      const newItems = [...tappedCountItems, idx];
      setTappedCountItems(newItems);
      const numberWords = ['Um!', 'Dois!', 'Três!', 'Quatro!', 'Cinco!', 'Seis!'];
      const speechText = numberWords[newItems.length - 1] || `${newItems.length}!`;
      speakAudio(speechText);
      playSound('pop');
    }
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-between">
      {/* Top Navigation & Audio */}
      <div className="flex items-center justify-between w-full mb-4">
        <button
          id="prev-math-btn"
          onClick={onPrevProblem}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs"
          title="Desafio anterior"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Desafio {mathIndex + 1} de {totalProblems}
          </span>
          <button
            id="speak-math-btn"
            onClick={() => {
              playSound('pop');
              speakAudio(problem.speechText, setIsMathAudioLoading);
            }}
            className="p-1.5 rounded-full bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-2xs"
            title="Ouvir desafio de matemática"
          >
            <Volume2 size={18} />
          </button>
        </div>

        <button
          id="next-math-btn"
          onClick={onNextProblem}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 shadow-xs"
          title="Próximo desafio"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Problem Display Card */}
      <div className="w-full bg-white rounded-3xl border-2 border-slate-200 p-5 sm:p-8 shadow-sm flex flex-col items-center text-center my-auto">
        <h2 className="text-xl sm:text-2xl font-black text-slate-800 mb-2">
          {problem.question}
        </h2>

        {/* Prominent Question Speech Button */}
        <button
          id="btn-speak-math-prominent"
          onClick={() => {
            playSound('pop');
            speakAudio(problem.speechText, setIsMathAudioLoading);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 rounded-full font-bold text-xs sm:text-sm border border-emerald-200 shadow-2xs transition-all my-2"
          title="Ouvir a pergunta em voz alta"
        >
          <Volume2 size={18} className="text-emerald-600 shrink-0" />
          <span>Ouvir a Pergunta em Voz Alta</span>
          {isMathAudioLoading && (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping ml-1" />
          )}
          {isAiTtsEnabled && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-md ml-1">
              ✨ IA
            </span>
          )}
        </button>

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
                        ? 'bg-amber-50 border-amber-400 scale-105'
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

        {/* Visual Sum for 3-5 Years (e.g. 2 🐱 + 1 🐱) */}
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

      {/* Answer Options Grid */}
      <div className="w-full mt-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto mb-6">
          {problem.options.map((opt, idx) => {
            const isCorrect = selectedMathOption === opt;
            const isWrong = mathWrongOption === opt;

            return (
              <motion.button
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleMathOptionClick(opt)}
                className={`relative font-black rounded-2xl border-b-4 py-4 sm:py-5 text-2xl sm:text-3xl shadow-sm transition-all flex items-center justify-center active:border-b-0 active:translate-y-1 ${
                  isCorrect
                    ? 'bg-emerald-500 border-emerald-700 text-white'
                    : isWrong
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                {opt}
              </motion.button>
            );
          })}
        </div>

        {/* Hint Button */}
        <div className="flex justify-center">
          <button
            id="btn-hint-math"
            onClick={giveMathHint}
            disabled={isMathCelebrating}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-amber-950 px-6 py-3 rounded-full font-black text-base sm:text-lg shadow-md border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50"
          >
            <Lightbulb size={20} className="fill-amber-100 text-amber-900" />
            <span>AJUDA / DICA</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// MAIN APP COMPONENT
// -------------------------------------------------------------
export default function EducationalApp() {
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('3-5');
  const [subject, setSubject] = useState<Subject>('letras');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [stars, setStars] = useState(0);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Custom Words for spelling (load on client in useEffect to guarantee deterministic initial hydration)
  const [customWords, setCustomWords] = useState<WordChallenge[]>(INITIAL_WORDS['3-5']);
  const [newWordInput, setNewWordInput] = useState('');

  // Load saved custom words once on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const saved = localStorage.getItem('soletrando_custom_words_v2');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomWords(parsed);
          }
        }
      } catch {
        // Fallback to default
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Indices
  const [wordIndex, setWordIndex] = useState(0);
  const [mathIndex, setMathIndex] = useState(0);

  // Gemini TTS Audio Engine settings
  const [useGeminiTts, setUseGeminiTts] = useState(true);
  const [geminiVoice, setGeminiVoice] = useState('Kore');
  const [geminiModel, setGeminiModel] = useState('gemini-2.5-flash-preview-tts');
  const [isTestAudioPlaying, setIsTestAudioPlaying] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'audio' | 'palavras'>('audio');
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Load persisted TTS settings on client mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          const savedTts = localStorage.getItem('soletrando_tts_settings_v1');
          if (savedTts) {
            const parsed = JSON.parse(savedTts);
            if (typeof parsed.useGeminiTts === 'boolean') setUseGeminiTts(parsed.useGeminiTts);
            if (parsed.geminiVoice) setGeminiVoice(parsed.geminiVoice);
            if (parsed.geminiModel) setGeminiModel(parsed.geminiModel);
          }
        } catch {
          // Fallback
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Persist TTS settings
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'soletrando_tts_settings_v1',
          JSON.stringify({ useGeminiTts, geminiVoice, geminiModel })
        );
      } catch {
        // Fallback
      }
    }
  }, [useGeminiTts, geminiVoice, geminiModel]);

  // Unified audio playback: Gemini TTS with instant client-side cache & Web Speech fallback
  const playAudioUnified = async (
    text: string,
    onLoadingChange?: (loading: boolean) => void
  ) => {
    if (!soundEnabled || !text) return;

    // Cancel any currently playing speech or audio
    if (typeof window !== 'undefined') {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
    }

    if (useGeminiTts) {
      const cacheKey = `${geminiModel}-${geminiVoice}-${text.trim().toLowerCase()}`;
      const cached = ttsAudioCache.get(cacheKey);

      if (cached) {
        try {
          const audio = new Audio(cached);
          audioPlayerRef.current = audio;
          await audio.play();
          return;
        } catch (e) {
          console.warn('Audio element play failed, falling back:', e);
        }
      }

      try {
        onLoadingChange?.(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text,
            voice: geminiVoice,
            model: geminiModel,
          }),
        });

        onLoadingChange?.(false);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.audio) {
            const dataUrl = `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
            ttsAudioCache.set(cacheKey, dataUrl);
            const audio = new Audio(dataUrl);
            audioPlayerRef.current = audio;
            await audio.play();
            return;
          }
        }
      } catch (err) {
        onLoadingChange?.(false);
        console.warn('Gemini TTS fetch error, fallback to device voice:', err);
      }
    }

    // Seamless Fallback: Browser Web Speech API
    speak(text, soundEnabled);
  };

  // Test Gemini Voice sample
  const handleTestGeminiVoice = async () => {
    setIsTestAudioPlaying(true);
    await playAudioUnified(
      'Olá amiguinho! Estou muito feliz em aprender com você no Soletrando e Calculando!'
    );
    setTimeout(() => setIsTestAudioPlaying(false), 2000);
  };

  // Persist custom words
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('soletrando_custom_words_v2', JSON.stringify(customWords));
      } catch {
        // Fallback
      }
    }
  }, [customWords]);

  const currentWordList = ageGroup === '3-5' ? customWords : INITIAL_WORDS[ageGroup];
  const activeWordObj = currentWordList[wordIndex % currentWordList.length] || { word: 'BOLA' };

  const currentMathList = MATH_PROBLEMS[ageGroup];
  const activeMathProblem = currentMathList[mathIndex % currentMathList.length];

  const handleSelectAgeGroup = (newAge: AgeGroup) => {
    setAgeGroup(newAge);
    setWordIndex(0);
    setMathIndex(0);
    const ageNames: Record<AgeGroup, string> = {
      '3-5': 'Fase 3 a 5 anos! Bem-vindos pequenos!',
      '6-8': 'Fase 6 a 8 anos! Vamos praticar!',
      '9-11': 'Fase 9 a 11 anos! Desafios incríveis!',
      '12-14': 'Fase 12 a 14 anos! Modo expert!'
    };
    playAudioUnified(ageNames[newAge]);
  };

  const handleSelectSubject = (newSubject: Subject) => {
    setSubject(newSubject);
    playAudioUnified(newSubject === 'letras' ? 'Modo Letras e Palavras!' : 'Modo Matemática!');
  };

  const handleAddCustomWord = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = normalizeWord(newWordInput);
    if (clean && !customWords.some(w => w.word === clean)) {
      setCustomWords([{ word: clean }, ...customWords]);
      setNewWordInput('');
      playAudioUnified(`Palavra ${clean} adicionada!`);
    }
  };

  const handleRemoveCustomWord = (w: string) => {
    if (customWords.length > 1) {
      setCustomWords(customWords.filter(item => item.word !== w));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans select-none pb-8">
      
      {/* Top Header & Console */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs px-3 sm:px-6 py-2.5">
        <div className="max-w-3xl mx-auto flex flex-col gap-2">
          
          {/* Top Row: Brand, Stars, Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-indigo-600 flex items-center gap-1.5">
                <Sparkles className="w-6 h-6 text-amber-400 fill-amber-400" />
                Soletrando & Calculando
              </span>
            </div>

            <div className="flex items-center gap-2">
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
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border transition-colors ${
                  soundEnabled 
                    ? 'bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100' 
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}
                title={soundEnabled ? 'Áudio ativado' : 'Áudio desativado'}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>

              {/* Parents Settings */}
              <button
                id="open-settings-button"
                onClick={() => setShowSettingsModal(true)}
                className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 transition-colors"
                title="Configurações dos Pais"
              >
                <Settings size={18} />
              </button>
            </div>
          </div>

          {/* Second Row: Mobile-Optimized Age Group Segmented Selector */}
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
                  '6-8': '🌱',
                  '9-11': '🧭',
                  '12-14': '🚀'
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
                    }`}
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
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              id="tab-letras"
              onClick={() => handleSelectSubject('letras')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm sm:text-base font-extrabold transition-all duration-200 ${
                subject === 'letras'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen size={18} />
              <span>Letras & Palavras</span>
            </button>
            <button
              id="tab-matematica"
              onClick={() => handleSelectSubject('matematica')}
              className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm sm:text-base font-extrabold transition-all duration-200 ${
                subject === 'matematica'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calculator size={18} />
              <span>Matemática</span>
            </button>
          </div>

        </div>
      </header>

      {/* Main Game Stage */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 sm:py-6 flex flex-col items-center justify-between">
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
            speakAudio={playAudioUnified}
            isAiTtsEnabled={useGeminiTts}
          />
        ) : (
          <MathStage
            key={`math-${ageGroup}-${mathIndex % currentMathList.length}-${activeMathProblem.id}`}
            problem={activeMathProblem}
            soundEnabled={soundEnabled}
            onNextProblem={() => setMathIndex(prev => (prev + 1) % currentMathList.length)}
            onPrevProblem={() => setMathIndex(prev => (prev - 1 + currentMathList.length) % currentMathList.length)}
            mathIndex={mathIndex % currentMathList.length}
            totalProblems={currentMathList.length}
            onWinStar={() => setStars(s => s + 1)}
            speakAudio={playAudioUnified}
            isAiTtsEnabled={useGeminiTts}
          />
        )}
      </main>

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
                Painel dos Pais & Voz
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
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
                <span>Voz IA (Gemini)</span>
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

            {/* Tab 1: Gemini TTS Voice Engine Configuration */}
            {settingsTab === 'audio' && (
              <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-slate-700">
                {/* Gemini Engine Toggle */}
                <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black text-indigo-900 uppercase tracking-wide flex items-center gap-1">
                      <Sparkles size={14} className="text-amber-500 fill-amber-500" />
                      Motor de Voz Gemini AI
                    </span>
                    <p className="text-xs text-indigo-950/80 mt-0.5 leading-snug">
                      Gera pronúncias em áudio com entonação humana e expressiva.
                    </p>
                  </div>
                  <button
                    onClick={() => setUseGeminiTts(!useGeminiTts)}
                    className={`relative w-12 h-6.5 rounded-full transition-colors shrink-0 ${
                      useGeminiTts ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`block w-5 h-5 bg-white rounded-full shadow-xs transform transition-transform ${
                        useGeminiTts ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {useGeminiTts ? (
                  <>
                    {/* Model Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Modelo Gemini TTS:
                      </label>
                      <select
                        value={geminiModel}
                        onChange={(e) => setGeminiModel(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="gemini-2.5-flash-preview-tts">
                          gemini-2.5-flash-preview-tts (Solicitado)
                        </option>
                        <option value="gemini-3.1-flash-tts-preview">
                          gemini-3.1-flash-tts-preview (Recomendado)
                        </option>
                      </select>
                    </div>

                    {/* Prebuilt Voice Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">
                        Escolha o Timbre da Voz:
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'Kore', label: 'Kore', desc: 'Feminina e Doce' },
                          { id: 'Puck', label: 'Puck', desc: 'Jovem e Animada' },
                          { id: 'Fenrir', label: 'Fenrir', desc: 'Grave e Firme' },
                          { id: 'Zephyr', label: 'Zephyr', desc: 'Suave e Calma' }
                        ].map((v) => (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setGeminiVoice(v.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all flex flex-col ${
                              geminiVoice === v.id
                                ? 'bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <span className="text-xs font-black text-slate-800 flex items-center justify-between">
                              {v.label}
                              {geminiVoice === v.id && <Check size={14} className="text-indigo-600" />}
                            </span>
                            <span className="text-[11px] text-slate-500">{v.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Test Audio Playback Button */}
                    <button
                      type="button"
                      onClick={handleTestGeminiVoice}
                      disabled={isTestAudioPlaying}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-black text-xs border border-emerald-200 shadow-2xs transition-all active:scale-98 disabled:opacity-50"
                    >
                      <Volume2 size={16} className="text-emerald-600" />
                      <span>{isTestAudioPlaying ? 'Reproduzindo Voz...' : 'Testar Voz da IA Agora'}</span>
                      {isTestAudioPlaying && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping ml-1" />
                      )}
                    </button>
                  </>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
                    O app utilizará a síntese de voz nativa do dispositivo (Web Speech API pt-BR).
                  </div>
                )}

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  💡 <em>Nota:</em> Se a conexão com a internet oscilar ou a API do Gemini atingir limites temporários, o aplicativo faz fallback automático e instantâneo para a voz local do dispositivo para que a criança nunca pare de aprender.
                </p>
              </div>
            )}

            {/* Tab 2: Custom Words (3-5 Years) */}
            {settingsTab === 'palavras' && (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col">
                <p className="text-xs text-slate-600 mb-3">
                  Adicione palavras personalizadas na fase <strong>3 a 5 anos</strong> (como o nome do seu filho, amigos ou familiares):
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
