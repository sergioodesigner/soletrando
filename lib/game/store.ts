import { useSyncExternalStore } from 'react';
import type { AgeId, Profile } from './types';
import { progressKey } from './worlds';

const KEY = 'soletrando_game_v1';

export interface GameData {
  /** false até ler o localStorage (evita diferença entre servidor e cliente na hidratação). */
  ready: boolean;
  profiles: Profile[];
  activeId: string | null;
  /** Tutoriais "primeira vez" já vistos. */
  coachSeen: Record<string, true>;
  /** Modo clássico (sem mapa/RPG). */
  classic: boolean;
}

const EMPTY: GameData = { ready: false, profiles: [], activeId: null, coachSeen: {}, classic: false };
let data: GameData = EMPTY;
const listeners = new Set<() => void>();

function persist() {
  try {
    const { ready: _ready, ...rest } = data;
    void _ready;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // ignore (modo privado / cota)
  }
}

function set(patch: Partial<GameData>) {
  data = { ...data, ...patch };
  persist();
  listeners.forEach((l) => l());
}

/** Lê o localStorage (chamar uma vez no cliente, dentro de um effect). */
export function hydrateGameStore(): void {
  if (data.ready) return;
  let loaded: Partial<GameData> = {};
  try {
    loaded = JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    loaded = {};
  }
  data = {
    ready: true,
    profiles: Array.isArray(loaded.profiles) ? loaded.profiles : [],
    activeId: loaded.activeId ?? null,
    coachSeen: loaded.coachSeen && typeof loaded.coachSeen === 'object' ? loaded.coachSeen : {},
    classic: Boolean(loaded.classic),
  };
  listeners.forEach((l) => l());
}

export function useGameData(): GameData {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => data,
    () => EMPTY
  );
}

export function activeProfile(d: GameData): Profile | null {
  return d.profiles.find((p) => p.id === d.activeId) ?? null;
}

function updateProfile(id: string, fn: (p: Profile) => Profile) {
  set({ profiles: data.profiles.map((p) => (p.id === id ? fn(p) : p)) });
}

export function createProfile(name: string, age: AgeId): string {
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  const profile: Profile = {
    id,
    name: name.trim().slice(0, 14) || 'Amigo',
    age,
    createdAt: Date.now(),
    coins: 0,
    items: [],
    progress: {},
    introSeen: false,
  };
  set({ profiles: [...data.profiles, profile], activeId: id });
  return id;
}

export function setActiveProfile(id: string | null) {
  set({ activeId: id });
}

export function setProfileAge(id: string, age: AgeId) {
  updateProfile(id, (p) => ({ ...p, age }));
}

export function markIntroSeen(id: string) {
  updateProfile(id, (p) => ({ ...p, introSeen: true }));
}

export function pinStars(p: Profile, worldId: string, age: AgeId = p.age): number[] {
  return p.progress[progressKey(worldId, age)] ?? [];
}

export interface PinResult {
  firstClear: boolean;
  improved: boolean;
  newItem: number | null;
  coinsGained: number;
}

/** Registra o resultado de uma fase: guarda a melhor nota, soma moedas e libera o item na 1ª vitória. */
export function completePin(
  profileId: string,
  worldId: string,
  pinIndex: number,
  stars: number,
  coinsGained: number,
  rewardItem: number
): PinResult {
  const p = data.profiles.find((x) => x.id === profileId);
  if (!p) return { firstClear: false, improved: false, newItem: null, coinsGained: 0 };
  const key = progressKey(worldId, p.age);
  const arr = [...(p.progress[key] ?? [])];
  while (arr.length <= pinIndex) arr.push(0);
  const prev = arr[pinIndex] ?? 0;
  const firstClear = prev === 0;
  const improved = stars > prev;
  if (improved) arr[pinIndex] = stars;
  const newItem = firstClear && !p.items.includes(rewardItem) ? rewardItem : null;
  updateProfile(profileId, (pp) => ({
    ...pp,
    coins: pp.coins + coinsGained,
    items: newItem !== null ? [...pp.items, newItem] : pp.items,
    progress: { ...pp.progress, [key]: arr },
  }));
  return { firstClear, improved, newItem, coinsGained };
}

// ---- tutoriais "primeira vez" ----
export function markCoachSeen(id: string) {
  if (data.coachSeen[id]) return;
  set({ coachSeen: { ...data.coachSeen, [id]: true } });
}
export function resetCoach() {
  set({ coachSeen: {} });
}
/** Faz os tutoriais cujos ids estão na lista reaparecerem. */
export function resetCoachIds(ids: string[]) {
  const next = { ...data.coachSeen };
  ids.forEach((id) => delete next[id]);
  set({ coachSeen: next });
}
export function setClassicMode(on: boolean) {
  set({ classic: on });
}
