import type { AgeId } from './types';

/**
 * Conteúdo curado do jogo. Por enquanto só o Nível Aprendiz (3 a 5 anos) tem conteúdo próprio por fase;
 * as outras idades usam as listas gerais do jogo (e ganham o delas depois).
 */

export interface WordItem {
  word: string;
  clue: string;
  /** Como falar (com acentos), quando difere da grafia sem acento do jogo. */
  speech?: string;
}

// ---------------------------------------------------------------------------
// Palavras — Reino das Letras (3-5): 4 do tema do lugar + 1 "palavra que vale a pena" por fase
// ---------------------------------------------------------------------------

const W = (word: string, clue: string, speech?: string): WordItem => ({ word, clue, speech });

const LETRAS_3_5: WordItem[][] = [
  // 0 A Fazenda
  [W('VACA', 'Ela dá leite e faz muuu'), W('PATO', 'Faz quá quá e nada na lagoa'), W('GALO', 'Canta cocoricó de manhã'),
   W('OVO', 'A galinha bota e dentro tem a gema'), W('MAMAE', 'Quem cuida de você com muito amor', 'Mamãe')],
  // 1 A Padaria
  [W('PAO', 'Sai quentinho do forno', 'Pão'), W('BOLO', 'Tem velinhas na festa de aniversário'), W('LEITE', 'Branquinho, vem da vaca'),
   W('FORNO', 'Quente, é onde o pão assa'), W('PAPAI', 'Ele te dá um abraço apertado')],
  // 2 O Moinho
  [W('VENTO', 'Faz as folhas dançarem e gira o moinho'), W('TRIGO', 'Vira farinha para fazer pão'), W('SACO', 'Onde guardamos a farinha'),
   W('PEDRA', 'Dura, o moinho usa para moer o trigo'), W('VOVO', 'A mãe da mamãe ou do papai', 'Vovó')],
  // 3 A Ponte (mini-chefe)
  [W('PONTE', 'Ajuda a gente a atravessar o rio'), W('RIO', 'Água que corre até o mar'), W('BARCO', 'Flutua e navega na água'),
   W('PEIXE', 'Nada e vive na água'), W('AGUA', 'Transparente, a gente bebe', 'Água'), W('BOLA', 'Redonda, a gente chuta e brinca')],
  // 4 O Mercado
  [W('UVA', 'Frutinha roxa que nasce em cachos'), W('MACA', 'Fruta vermelha e crocante', 'Maçã'), W('PERA', 'Fruta verdinha, parece um sininho'),
   W('FRUTA', 'Doce e saudável, nasce nas árvores'), W('DEDO', 'Temos cinco em cada mão')],
  // 5 A Taverna
  [W('SOPA', 'Quentinha, a gente toma de colher'), W('PRATO', 'Onde colocamos a comida'), W('COPO', 'Onde colocamos o suco'),
   W('MESA', 'Onde a família se senta para comer'), W('GATO', 'Faz miau e adora leite')],
  // 6 A Torre dos Livros
  [W('LIVRO', 'Tem muitas páginas e histórias'), W('PENA', 'Usada para escrever com tinta'), W('LETRA', 'A, B, C... elas formam as palavras'),
   W('CONTO', 'Uma historinha curta'), W('LER', 'Olhar as letras e entender a história'), W('CASA', 'Onde a gente mora')],
  // 7 O Castelo (chefe)
  [W('REI', 'Usa coroa e manda no reino'), W('RAINHA', 'A esposa do rei'), W('COROA', 'Brilha na cabeça do rei'),
   W('ESPADA', 'A arma do cavaleiro'), W('ESCUDO', 'Protege o cavaleiro'), W('CASTELO', 'A casa do rei, bem grande'),
   W('DRAGAO', 'Voa e solta fogo', 'Dragão'), W('AMIGO', 'Quem brinca com a gente e gosta de nós')],
];

/** "Palavras que valem a pena" para treinar nessa idade (família, corpo, objetos do dia a dia). */
const TREINO_3_5: WordItem[] = [
  W('MAMAE', 'Quem cuida de você com muito amor', 'Mamãe'), W('PAPAI', 'Ele te dá um abraço apertado'),
  W('VOVO', 'A mãe da mamãe ou do papai', 'Vovó'), W('BOLA', 'Redonda, a gente chuta e brinca'),
  W('CASA', 'Onde a gente mora'), W('GATO', 'Faz miau e adora leite'), W('DEDO', 'Temos cinco em cada mão'),
  W('SOL', 'Brilha no céu de dia'), W('LUA', 'Aparece no céu de noite'), W('FLOR', 'Cheirosa e colorida, nasce no jardim'),
  W('MAO', 'Tem cinco dedinhos', 'Mão'), W('AMOR', 'O que sentimos pela família'), W('AMIGO', 'Quem brinca com a gente'),
  W('NOME', 'A palavra que chama você'), W('OLHO', 'A gente usa para ver'), W('BOCA', 'A gente usa para falar e comer'),
];

/** Pistas/forma falada de qualquer palavra conhecida (usado no treino com palavras que a criança errou). */
export const WORD_BANK: Record<string, WordItem> = (() => {
  const m: Record<string, WordItem> = {};
  [...LETRAS_3_5.flat(), ...TREINO_3_5].forEach((w) => (m[w.word] = m[w.word] ?? w));
  return m;
})();

/** Forma falada (com acento) para o `formatWordForSpeech` do jogo. */
export const CONTENT_SPEECH: Record<string, string> = Object.fromEntries(
  Object.values(WORD_BANK)
    .filter((w) => w.speech)
    .map((w) => [w.word, w.speech as string])
);

export function pinWords(worldId: string, pinIndex: number, age: AgeId): WordItem[] | null {
  if (worldId === 'letras' && age === '3-5') return LETRAS_3_5[pinIndex] ?? null;
  return null;
}

// ---------------------------------------------------------------------------
// Contas — Grécia dos Números (3-5): contar, somar, subtrair e sequências com o tema do lugar
// ---------------------------------------------------------------------------

export interface MathItem {
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

const NUM_M = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];
const NUM_F = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'];

interface Theme { emoji: string; noun: string; g: 'm' | 'f' }

function options(answer: number, max = 10): number[] {
  const set = new Set<number>([answer]);
  for (const d of [1, -1, 2, -2, 3, -3, 4]) {
    const v = answer + d;
    if (v >= 0 && v <= max) set.add(v);
    if (set.size >= 6) break;
  }
  return [...set].sort((a, b) => a - b);
}

type Spec =
  | ['count', number]
  | ['add', number, number]
  | ['sub', number, number]
  | ['next', number]
  | ['before', number];

function build(id: string, t: Theme, spec: Spec): MathItem {
  const num = (n: number) => (t.g === 'f' ? NUM_F[n] : NUM_M[n]);
  const Q = t.g === 'f' ? 'Quantas' : 'Quantos';
  const each = t.g === 'f' ? 'cada uma' : 'cada um';
  switch (spec[0]) {
    case 'count': {
      const n = spec[1];
      return {
        id, question: `${Q} ${t.noun} você vê?`,
        speechText: `${Q} ${t.noun} você vê? Toque em ${each} para contar!`,
        visualItems: { emoji: t.emoji, total: n },
        hint: `Conte devagarzinho: ${Array.from({ length: n }, (_, i) => i + 1).join(', ')} ${t.noun}!`,
        options: options(n), answer: n,
      };
    }
    case 'add': {
      const [, a, b] = spec;
      return {
        id, question: `${Q} ${t.noun} no total?`,
        speechText: `${num(a)} ${t.noun} mais ${num(b)} ${t.noun}. ${Q} ${t.noun} ficam?`,
        visualSum: { count1: a, emoji1: t.emoji, count2: b, emoji2: t.emoji },
        hint: `Junte ${a} com ${b}: dá ${a + b}!`,
        options: options(a + b), answer: a + b,
      };
    }
    case 'sub': {
      const [, a, b] = spec;
      return {
        id, question: `${Q} ${t.noun} ficaram?`,
        speechText: `Tinha ${num(a)} ${t.noun}, e ${num(b)} foram embora. ${Q} ${t.noun} ficaram?`,
        visualItems: { emoji: t.emoji, total: a },
        hint: `${a} menos ${b} é ${a - b}!`,
        options: options(a - b), answer: a - b,
      };
    }
    case 'next': {
      const n = spec[1];
      return {
        id, question: `Depois do número ${n}, qual vem?`,
        speechText: `Depois do número ${num(n)}, qual número vem?`,
        hint: `Conte: ${n}, e depois vem o ${n + 1}!`,
        options: options(n + 1), answer: n + 1,
      };
    }
    default: {
      const n = spec[1];
      return {
        id, question: `Antes do número ${n}, qual vem?`,
        speechText: `Antes do número ${num(n)}, qual número vem?`,
        hint: `Conte voltando: ${n}, e antes vem o ${n - 1}!`,
        options: options(n - 1), answer: n - 1,
      };
    }
  }
}

const GREECE: { theme: Theme; specs: Spec[] }[] = [
  { theme: { emoji: '⛵', noun: 'barcos', g: 'm' }, specs: [['count', 3], ['count', 5], ['add', 2, 1], ['count', 4], ['add', 3, 2]] },
  { theme: { emoji: '🌿', noun: 'ramos de oliveira', g: 'm' }, specs: [['count', 6], ['add', 3, 2], ['count', 2], ['add', 4, 1], ['sub', 5, 2]] },
  { theme: { emoji: '🏺', noun: 'ânforas', g: 'f' }, specs: [['add', 2, 2], ['add', 3, 3], ['count', 7], ['sub', 6, 2], ['add', 1, 4]] },
  { theme: { emoji: '⭐', noun: 'estrelas', g: 'f' }, specs: [['count', 8], ['add', 4, 3], ['sub', 7, 3], ['next', 4], ['count', 5], ['add', 5, 2]] },
  { theme: { emoji: '🎭', noun: 'máscaras', g: 'f' }, specs: [['count', 4], ['add', 2, 3], ['sub', 5, 1], ['next', 6], ['count', 9]] },
  { theme: { emoji: '🏅', noun: 'medalhas', g: 'f' }, specs: [['count', 7], ['add', 4, 4], ['sub', 8, 3], ['add', 3, 6], ['count', 10]] },
  { theme: { emoji: '🌻', noun: 'flores', g: 'f' }, specs: [['next', 2], ['next', 5], ['before', 5], ['count', 8], ['add', 5, 3], ['next', 7]] },
  { theme: { emoji: '🐲', noun: 'cabeças da Hidra', g: 'f' }, specs: [['count', 5], ['add', 2, 3], ['sub', 5, 2], ['next', 8], ['count', 3], ['add', 4, 4], ['sub', 9, 4], ['add', 5, 5]] },
];

export function pinMath(pinIndex: number, age: AgeId): MathItem[] | null {
  if (age !== '3-5') return null;
  const g = GREECE[pinIndex];
  if (!g) return null;
  return g.specs.map((spec, i) => build(`g35-${pinIndex}-${i}`, g.theme, spec));
}

// ---------------------------------------------------------------------------
// Momento Treino
// ---------------------------------------------------------------------------

/** Palavras do treino: primeiro as que a criança errou, depois as "que valem a pena" da idade. */
export function trainingWords(weak: Record<string, number> | undefined, n = 3, age: AgeId = '3-5'): WordItem[] {
  const out: WordItem[] = [];
  const seen = new Set<string>();
  const weakSorted = Object.entries(weak ?? {}).sort((a, b) => b[1] - a[1]).map(([w]) => w);
  for (const w of weakSorted) {
    const item = WORD_BANK[w];
    if (item && !seen.has(w) && out.length < n) {
      out.push(item);
      seen.add(w);
    }
  }
  const pool = age === '3-5' ? TREINO_3_5 : TREINO_3_5;
  const start = Math.floor(Date.now() / 60000) % pool.length;
  for (let i = 0; out.length < n && i < pool.length; i++) {
    const item = pool[(start + i * 5) % pool.length];
    if (!seen.has(item.word)) {
      out.push(item);
      seen.add(item.word);
    }
  }
  return out;
}

export function trainingMath(n = 3): MathItem[] {
  const t = Date.now();
  const picks = GREECE.filter((_, i) => i < 7);
  const out: MathItem[] = [];
  for (let i = 0; i < n; i++) {
    const g = picks[(t / 1000 + i * 3) % picks.length | 0];
    const spec = g.specs[(t / 777 + i) % g.specs.length | 0];
    out.push(build(`g35-treino-${t}-${i}`, g.theme, spec));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Jogo da Memória
// ---------------------------------------------------------------------------

export interface MemoryCard {
  id: string;
  pair: string;
  kind: 'icon' | 'text' | 'qty';
  /** icon: caminho da imagem; text: texto; qty: quantidade de ícones. */
  src?: string;
  text?: string;
  qty?: number;
  /** O que o mascote fala ao acertar o par. */
  say: string;
}

const MEM_LETRAS: { icon: string; word: string; say: string }[] = [
  { icon: '/game/items/item14.png', word: 'LEITE', say: 'Leite!' },
  { icon: '/game/items/item17.png', word: 'BOLO', say: 'Bolo!' },
  { icon: '/game/items/item31.png', word: 'OVO', say: 'Ovo!' },
  { icon: '/game/items/item23.png', word: 'MAÇÃ', say: 'Maçã!' },
  { icon: '/game/items/item04.png', word: 'CHAVE', say: 'Chave!' },
  { icon: '/game/items/item39.png', word: 'LIVRO', say: 'Livro!' },
  { icon: '/game/items/item28.png', word: 'CARTA', say: 'Carta!' },
  { icon: '/game/items/item33.png', word: 'BAÚ', say: 'Baú!' },
  { icon: '/game/items/item24.png', word: 'CENOURA', say: 'Cenoura!' },
  { icon: '/game/items/item16.png', word: 'BALA', say: 'Bala!' },
  { icon: '/game/items/item13.png', word: 'MAPA', say: 'Mapa!' },
  { icon: '/game/items/item35.png', word: 'MOEDA', say: 'Moeda!' },
];

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const memoryPairs = (age: AgeId) => ({ '3-5': 3, '6-8': 4, '9-11': 5, '12-14': 6 })[age];

export function memoryDeck(subject: 'letras' | 'matematica', age: AgeId): MemoryCard[] {
  const n = memoryPairs(age);
  const cards: MemoryCard[] = [];
  if (subject === 'letras') {
    shuffle(MEM_LETRAS).slice(0, n).forEach((p, i) => {
      cards.push({ id: `a${i}`, pair: `p${i}`, kind: 'icon', src: p.icon, say: p.say });
      cards.push({ id: `b${i}`, pair: `p${i}`, kind: 'text', text: p.word, say: p.say });
    });
  } else if (age === '3-5') {
    // número <-> quantidade de ícones
    shuffle([1, 2, 3, 4, 5, 6]).slice(0, n).forEach((q, i) => {
      cards.push({ id: `a${i}`, pair: `p${i}`, kind: 'text', text: String(q), say: NUM_M[q][0].toUpperCase() + NUM_M[q].slice(1) + '!' });
      cards.push({ id: `b${i}`, pair: `p${i}`, kind: 'qty', qty: q, src: '/game/ui/coin.png', say: NUM_M[q][0].toUpperCase() + NUM_M[q].slice(1) + '!' });
    });
  } else {
    // conta <-> resultado
    const used = new Set<number>();
    let guard = 0;
    while (used.size < n && guard++ < 50) {
      const a = 2 + Math.floor(Math.random() * (age === '6-8' ? 7 : 9));
      const b = 2 + Math.floor(Math.random() * (age === '6-8' ? 7 : 9));
      const mult = age === '9-11' || age === '12-14';
      const res = mult ? a * b : a + b;
      if (used.has(res)) continue;
      used.add(res);
      const i = used.size - 1;
      cards.push({ id: `a${i}`, pair: `p${i}`, kind: 'text', text: mult ? `${a} × ${b}` : `${a} + ${b}`, say: `${res}!` });
      cards.push({ id: `b${i}`, pair: `p${i}`, kind: 'text', text: String(res), say: `${res}!` });
    }
  }
  return shuffle(cards);
}
