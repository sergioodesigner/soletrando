export type AgeId = '3-5' | '6-8' | '9-11' | '12-14';
export type MascotId = 'fox' | 'owl';
export type WorldId = 'letras' | 'matematica' | 'fe' | 'dinos';

export const AGES: { id: AgeId; label: string; icon: string; hint: string }[] = [
  { id: '3-5', label: '3 a 5 anos', icon: '🐣', hint: 'Pequenos' },
  { id: '6-8', label: '6 a 8 anos', icon: '🎨', hint: 'Iniciante' },
  { id: '9-11', label: '9 a 11 anos', icon: '🚀', hint: 'Médio' },
  { id: '12-14', label: '12 a 14 anos', icon: '🧠', hint: 'Expert' },
];

export interface MascotDef {
  id: MascotId;
  name: string;
  title: string;
  img: string;
  /** Tom/velocidade da voz (playbackRate sobre a voz Faber): >1 mais agudo, <1 mais grave. */
  voiceRate: number;
}

export const MASCOTS: Record<MascotId, MascotDef> = {
  fox: { id: 'fox', name: 'Rufo', title: 'o Raposo Letrado', img: '/game/fox/idle.png', voiceRate: 1.06 },
  owl: { id: 'owl', name: 'Sofia', title: 'a Coruja', img: '/game/owl/idle.png', voiceRate: 0.92 },
};

export type PinKind = 'normal' | 'mini' | 'boss';

export interface PinDef {
  index: number;
  name: string;
  kind: PinKind;
  /** Posição no mapa em % (0–100), moldura vertical 2:3. */
  x: number;
  y: number;
  /** Quantos desafios tem a fase. */
  challenges: number;
  /** Índice do ícone (public/game/items/itemNN.png) ganho ao vencer pela 1ª vez. */
  rewardItem: number;
  /** Frase do mascote ao abrir a fase. */
  intro: string;
}

export interface WorldDef {
  id: WorldId;
  name: string;
  subtitle: string;
  mascot: MascotId | null;
  subject: 'letras' | 'matematica' | null;
  /** Arte do mapa (provisória até as imagens finais). */
  mapImage: string;
  mapFilter?: string;
  accent: string;
  pins: PinDef[];
  locked?: boolean;
  lockedHint?: string;
}

export interface Profile {
  id: string;
  name: string;
  age: AgeId;
  createdAt: number;
  coins: number;
  /** Itens (figurinhas) já conquistados — índices de public/game/items. */
  items: number[];
  /** `${world}:${age}` -> melhor nota (0–3 estrelas) de cada pin. */
  progress: Record<string, number[]>;
  introSeen: boolean;
}
