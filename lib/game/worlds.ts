import type { WorldDef, PinDef, AgeId } from './types';

// Trilha em zigue-zague de baixo para cima (moldura 2:3). Quando a arte final dos mapas chegar,
// basta ajustar estes x/y para cair nos "clareiras" do desenho.
const PATH: [number, number][] = [
  [50, 90], [26, 79], [68, 69], [34, 58], [66, 47], [30, 36], [62, 26], [48, 13],
];
const KINDS: PinDef['kind'][] = ['normal', 'normal', 'normal', 'mini', 'normal', 'normal', 'normal', 'boss'];
const CHALLENGES = [5, 5, 5, 6, 5, 5, 6, 8];

function pins(names: string[], rewards: number[], intros: string[]): PinDef[] {
  return names.map((name, i) => ({
    index: i,
    name,
    kind: KINDS[i],
    x: PATH[i][0],
    y: PATH[i][1],
    challenges: CHALLENGES[i],
    rewardItem: rewards[i],
    intro: intros[i],
  }));
}

export const WORLDS: WorldDef[] = [
  {
    id: 'letras',
    name: 'Reino das Letras',
    subtitle: 'Português com o Rufo',
    mascot: 'fox',
    subject: 'letras',
    mapImage: '/game/village.jpg',
    accent: '#6cc24a',
    pins: pins(
      ['A Padaria', 'O Moinho', 'A Ponte', 'O Mercado', 'A Taverna', 'A Biblioteca', 'O Portão', 'O Castelo'],
      [1, 2, 5, 28, 39, 13, 4, 40],
      [
        'Cheirinho de pão! Vamos soletrar palavras da padaria.',
        'O vento do moinho bagunçou as letras. Ajude a arrumar!',
        'Para atravessar a ponte, só soletrando certinho.',
        'No mercado, cada palavra vale uma moeda. Vamos?',
        'Hmm, deixa eu ver... Esta é uma fase de ouvir bem!',
        'Shhh... a biblioteca guarda as palavras mais difíceis.',
        'O portão do castelo só abre com palavras mágicas.',
        'O Dragão Borrão embaralhou tudo! Soletre para vencê-lo!',
      ]
    ),
  },
  {
    id: 'matematica',
    name: 'Grécia dos Números',
    subtitle: 'Matemática com a Sofia',
    mascot: 'owl',
    subject: 'matematica',
    mapImage: '/game/village.jpg',
    mapFilter: 'hue-rotate(160deg) saturate(0.9) brightness(1.05)',
    accent: '#4aa8e0',
    pins: pins(
      ['O Porto', 'O Bosque de Oliveiras', 'A Ágora', 'O Farol', 'O Teatro', 'O Estádio', 'A Biblioteca de Atenas', 'O Grande Templo'],
      [35, 21, 23, 9, 7, 10, 33, 30],
      [
        'Bem-vindo à Grécia! Aqui os números nasceram.',
        'Cada oliveira esconde uma conta. Vamos resolver!',
        'Na ágora, os mercadores precisam de ajuda com as somas.',
        'O farol só acende com a resposta certa.',
        'No teatro, os números sobem ao palco. Preste atenção!',
        'Olimpíada de números! Quem calcula mais rápido?',
        'Os pergaminhos de Atenas guardam contas desafiadoras.',
        'A Hidra das Contas tem uma resposta em cada cabeça. Corte a certa!',
      ]
    ),
  },
  {
    id: 'fe',
    name: 'Terra da Fé',
    subtitle: 'Em breve',
    mascot: null,
    subject: null,
    mapImage: '',
    accent: '#a78bfa',
    pins: [],
    locked: true,
    lockedHint: 'Uma névoa cobre esta terra... Volte em breve!',
  },
  {
    id: 'dinos',
    name: 'Era dos Dinossauros',
    subtitle: 'Em breve',
    mascot: null,
    subject: null,
    mapImage: '',
    accent: '#fb923c',
    pins: [],
    locked: true,
    lockedHint: 'Ouço pisadas enormes ao longe... Em breve!',
  },
];

export const worldById = (id: string) => WORLDS.find((w) => w.id === id);

export const progressKey = (worldId: string, age: AgeId) => `${worldId}:${age}`;

/** Regra de estrelas: poucos erros = mais estrelas. "Desistir" de um desafio pesa como 2 erros. */
export function starsFor(mistakes: number, giveUps: number): 1 | 2 | 3 {
  const score = mistakes + giveUps * 2;
  return score <= 1 ? 3 : score <= 3 ? 2 : 1;
}

export function pinUnlocked(stars: number[], pin: PinDef): boolean {
  if (pin.index === 0) return true;
  if (pin.kind === 'boss') {
    const before = stars.slice(0, pin.index);
    return before.every((s) => s > 0) && before.reduce((a, b) => a + b, 0) >= 12;
  }
  return (stars[pin.index - 1] ?? 0) > 0;
}

export const BOSS_MIN_STARS = 12;
