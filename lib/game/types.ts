export type AgeId = '3-5' | '6-8' | '9-11' | '12-14';
export type MascotId = 'fox' | 'owl';
export type WorldId = 'letras' | 'matematica' | 'fe' | 'dinos';

export const AGES: { id: AgeId; label: string; level: string; icon: string; hint: string }[] = [
  { id: '3-5', label: '3 a 5 anos', level: 'Aprendiz', icon: '🐣', hint: 'Pequenos' },
  { id: '6-8', label: '6 a 8 anos', level: 'Explorador', icon: '🎨', hint: 'Iniciante' },
  { id: '9-11', label: '9 a 11 anos', level: 'Mestre', icon: '🚀', hint: 'Médio' },
  { id: '12-14', label: '12 a 14 anos', level: 'Sábio', icon: '🧠', hint: 'Expert' },
];

export interface MascotDef {
  id: MascotId;
  name: string;
  title: string;
  img: string;
  /** Tom/velocidade da voz (playbackRate sobre a voz Faber): >1 mais agudo, <1 mais grave. */
  voiceRate: number;
}

/** Quem fala nos diálogos: mascotes, chefes/aliados e personagens (NPCs) das fases. */
export type SpeakerId = string;

export interface SpeakerDef {
  id: SpeakerId;
  name: string;
  /** Tom da voz (playbackRate sobre a voz Faber). */
  voiceRate: number;
  /** Retrato provisório (emoji) até existir a arte em /game/npcs/<id>.png. */
  emoji?: string;
  /** Imagem do retrato quando existir. */
  img?: string;
  kind: 'mascot' | 'boss' | 'npc';
}

export const SPEAKERS: Record<string, SpeakerDef> = {
  fox: { id: 'fox', name: 'Rufo', voiceRate: 1.06, img: '/game/fox/idle.png', kind: 'mascot' },
  owl: { id: 'owl', name: 'Sofia', voiceRate: 0.92, img: '/game/owl/idle.png', kind: 'mascot' },
  borrao: { id: 'borrao', name: 'Borrão', voiceRate: 0.8, img: '/game/bosses/borrao.png', kind: 'boss' },
  hidra: { id: 'hidra', name: 'Hidra', voiceRate: 1.12, img: '/game/bosses/hidra.png', kind: 'boss' },
  // Reino das Letras
  tiao: { id: 'tiao', name: 'Seu Tião', voiceRate: 0.88, emoji: '👨‍🌾', kind: 'npc' },
  rosa: { id: 'rosa', name: 'Dona Rosa', voiceRate: 1.14, emoji: '👩‍🍳', kind: 'npc' },
  moa: { id: 'moa', name: 'Seu Moa', voiceRate: 0.84, emoji: '🧔', kind: 'npc' },
  bia: { id: 'bia', name: 'Guarda Bia', voiceRate: 1.0, emoji: '💂', kind: 'npc' },
  lia: { id: 'lia', name: 'Dona Lia', voiceRate: 1.1, emoji: '🧑‍🌾', kind: 'npc' },
  beto: { id: 'beto', name: 'Seu Beto', voiceRate: 0.9, emoji: '🧑‍🍳', kind: 'npc' },
  bento: { id: 'bento', name: 'Velho Bento', voiceRate: 0.8, emoji: '👴', kind: 'npc' },
  rei: { id: 'rei', name: 'Rei Bartolomeu', voiceRate: 0.82, emoji: '🤴', kind: 'npc' },
  // Grécia dos Números
  nico: { id: 'nico', name: 'Capitão Nico', voiceRate: 0.88, emoji: '🧑‍✈️', kind: 'npc' },
  olivia: { id: 'olivia', name: 'Dona Olívia', voiceRate: 1.1, emoji: '👵', kind: 'npc' },
  dimitri: { id: 'dimitri', name: 'Dimitri', voiceRate: 0.95, emoji: '🧔‍♂️', kind: 'npc' },
  teo: { id: 'teo', name: 'Faroleiro Teo', voiceRate: 0.82, emoji: '🧓', kind: 'npc' },
  ariadne: { id: 'ariadne', name: 'Ariadne', voiceRate: 1.15, emoji: '🎭', kind: 'npc' },
  pan: { id: 'pan', name: 'Corredor Pan', voiceRate: 1.05, emoji: '🏃', kind: 'npc' },
  selene: { id: 'selene', name: 'Sábia Selene', voiceRate: 1.08, emoji: '🧙‍♀️', kind: 'npc' },
  zenon: { id: 'zenon', name: 'Zênon', voiceRate: 0.8, emoji: '🧙', kind: 'npc' },
};

export const speakerOf = (id: SpeakerId): SpeakerDef => SPEAKERS[id] ?? SPEAKERS.fox;

export const MASCOTS: Record<MascotId, MascotDef> = {
  fox: { id: 'fox', name: 'Rufo', title: 'o Raposo Letrado', img: '/game/fox/idle.png', voiceRate: 1.06 },
  owl: { id: 'owl', name: 'Sofia', title: 'a Coruja', img: '/game/owl/idle.png', voiceRate: 0.92 },
};

export type PinKind = 'normal' | 'mini' | 'boss';

export interface PinDef {
  index: number;
  name: string;
  kind: PinKind;
  /** Posição no mapa em % da imagem — é a PONTA do pin (onde ele "pisa"). */
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
  /** Arte do mapa (vertical). */
  mapImage: string;
  /** largura / altura da imagem do mapa. */
  mapAspect: number;
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
  /** Chefes que viraram aliados (ids de SPEAKERS: 'borrao', 'hidra'). */
  allies?: string[];
  /** Palavras em que a criança errou — voltam no Momento Treino. word -> peso. */
  weak?: Record<string, number>;
  /** Bônus já recebidos (chave `treino:mundo:idade:pin` ou `memoria:mundo:idade`) -> vezes. */
  bonus?: Record<string, number>;
}
