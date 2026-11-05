// Dados do jogo compartilhados entre o app e o catálogo de vozes (scripts/voice).
// Mantenha este arquivo SEM imports de React/Next.
import { CONTENT_SPEECH } from './content';

// Normalize word to uppercase, remove accents and special chars
export const normalizeWord = (w: string) => 
  w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim().replace(/[^A-Z]/g, '');

// Ortografia falada (acentos + respelling) para o TTS acertar a sílaba tônica / o som.
// Chave = palavra do jogo (sem acento). Valor = como deve soar na narração.
export const SPEECH_WORD_FORMS: Record<string, string> = {
  METAFORA: 'Metáfora',
  HIPOTESE: 'Hipótese',
  // "Paradoxo" sozinho o TTS costuma ler o X como "ch"; "quiso" força /ks/.
  PARADOXO: 'Paradóquiso',
  CONSCIENCIA: 'Consciência',
  RESILIENCIA: 'Resiliência',
  ATMOSFERA: 'Atmosfera'
};

// Formats uppercase word for natural Brazilian Portuguese TTS
export const formatWordForSpeech = (w: string): string => {
  if (!w) return '';
  const upper = w.trim().toUpperCase();
  if (SPEECH_WORD_FORMS[upper]) return SPEECH_WORD_FORMS[upper];
  if (CONTENT_SPEECH[upper]) return CONTENT_SPEECH[upper];
  const clean = w.trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase();
};

// Types
export type AgeGroup = '3-5' | '6-8' | '9-11' | '12-14';
export type Subject = 'letras' | 'matematica';

export interface WordChallenge {
  word: string;
  clue?: string;
  /** Frase de exemplo (gerada pelo cérebro de texto) falada ao completar a palavra. */
  sentence?: string;
}

export interface MathProblem {
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
export const INITIAL_WORDS: Record<AgeGroup, WordChallenge[]> = {
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
export const MATH_PROBLEMS: Record<AgeGroup, MathProblem[]> = {
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
