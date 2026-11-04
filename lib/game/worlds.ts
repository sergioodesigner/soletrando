import type { WorldDef, PinDef, AgeId } from './types';

const KINDS: PinDef['kind'][] = ['normal', 'normal', 'normal', 'mini', 'normal', 'normal', 'normal', 'boss'];
const CHALLENGES = [5, 5, 5, 6, 5, 5, 6, 8];

function pins(names: string[], spots: [number, number][], rewards: number[], intros: string[]): PinDef[] {
  return names.map((name, i) => ({
    index: i,
    name,
    kind: KINDS[i],
    x: spots[i][0],
    y: spots[i][1],
    challenges: CHALLENGES[i],
    rewardItem: rewards[i],
    intro: intros[i],
  }));
}

/** Mapa-múndi (as 4 ilhas). x/y em % da imagem. */
export const WORLD_MAP = {
  image: '/game/maps/world.jpg',
  aspect: 1116 / 2000,
  spots: {
    letras: { x: 68, y: 80 },
    matematica: { x: 30, y: 58 },
    fe: { x: 73, y: 45 },
    dinos: { x: 48, y: 20 },
  } as Record<string, { x: number; y: number }>,
};

export const WORLDS: WorldDef[] = [
  {
    id: 'letras',
    name: 'Reino das Letras',
    subtitle: 'Português com o Rufo',
    mascot: 'fox',
    subject: 'letras',
    mapImage: '/game/maps/letras.jpg',
    mapAspect: 1116 / 2000,
    accent: '#6cc24a',
    pins: pins(
      ['A Fazenda', 'A Padaria', 'O Moinho', 'A Ponte', 'O Mercado', 'A Taverna', 'A Torre dos Livros', 'O Castelo'],
      [[42, 91], [78, 83], [22, 58], [46, 54.5], [80, 51], [33, 35], [80, 32], [57, 16]],
      [1, 2, 5, 28, 39, 13, 4, 40],
      [
        'Bom dia na fazenda! Vamos soletrar palavras do campo.',
        'Cheirinho de pão quentinho! Vamos soletrar na padaria.',
        'O vento do moinho bagunçou as letras. Ajude a arrumar!',
        'Para atravessar a ponte, só soletrando certinho.',
        'No mercado, cada palavra vale uma moeda. Vamos?',
        'Hmm, deixa eu ver... Na taverna a gente precisa ouvir bem!',
        'Shhh... a torre guarda as palavras mais difíceis.',
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
    mapImage: '/game/maps/matematica.jpg',
    mapAspect: 1116 / 2000,
    accent: '#4aa8e0',
    pins: pins(
      ['O Porto', 'O Bosque de Oliveiras', 'A Ágora', 'O Farol', 'O Teatro', 'O Estádio', 'O Jardim do Relógio de Sol', 'O Grande Templo'],
      [[47, 84], [72, 77], [31, 67], [23, 52.5], [51, 45], [81, 48], [65, 29], [54, 15]],
      [104, 105, 108, 106, 102, 107, 109, 100],
      [
        'Bem-vindo à Grécia! Foi aqui que os números nasceram.',
        'Cada oliveira esconde uma conta. Vamos resolver!',
        'Na ágora, os mercadores precisam de ajuda com as somas.',
        'O farol só acende com a resposta certa.',
        'No teatro, os números sobem ao palco. Preste atenção!',
        'Olimpíada de números! Quem calcula mais rápido?',
        'O relógio de sol mede o tempo... e também as contas!',
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
    mapAspect: 1,
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
    mapAspect: 1,
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
