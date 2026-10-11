export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  /** Seconds between hits. */
  cooldown: number;
  /** Tiles per second. */
  speed: number;
  /** Attack range in tiles. */
  range: number;
  /** Flying enemies ignore walls. */
  flying?: boolean;
  /** Raiders prefer production/storage buildings; beasts attack survivors and anything near. */
  prefers?: 'any' | 'storage' | 'defense';
  scale: number;
  boss?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  hyena: { id: 'hyena', name: 'Hyena', hp: 45, damage: 6, cooldown: 0.8, speed: 2.6, range: 0.8, scale: 1, prefers: 'any' },
  jackal: { id: 'jackal', name: 'Jackal', hp: 28, damage: 4, cooldown: 0.6, speed: 3.2, range: 0.7, scale: 0.8, prefers: 'any' },
  raider: { id: 'raider', name: 'Dust Raider', hp: 90, damage: 12, cooldown: 1.1, speed: 1.9, range: 0.9, scale: 1, prefers: 'storage' },
  slinger: { id: 'slinger', name: 'Raider Slinger', hp: 60, damage: 9, cooldown: 1.6, speed: 1.8, range: 4, scale: 1, prefers: 'defense' },
  lion: { id: 'lion', name: 'Rogue Lion', hp: 260, damage: 26, cooldown: 1.2, speed: 2.4, range: 1, scale: 1.3, prefers: 'any' },
  warlord: { id: 'warlord', name: 'Raider Warlord', hp: 700, damage: 40, cooldown: 1.4, speed: 1.6, range: 1, scale: 1.5, prefers: 'defense', boss: true },
  impundulu: { id: 'impundulu', name: 'Impundulu, the Lightning Bird', hp: 900, damage: 35, cooldown: 1.5, speed: 2.2, range: 3, flying: true, scale: 1.6, prefers: 'defense', boss: true },
  ninki: { id: 'ninki', name: 'Ninki Nanka', hp: 2600, damage: 70, cooldown: 1.6, speed: 1.3, range: 1.4, scale: 2.2, prefers: 'any', boss: true },
};

export interface WaveSpawn {
  enemy: string;
  count: number;
}

/** Composition of raid number n (1-based). Grows forever, with bosses every 5th raid. */
export function waveComposition(n: number): WaveSpawn[] {
  const out: WaveSpawn[] = [];
  const add = (enemy: string, count: number) => {
    if (count > 0) out.push({ enemy, count: Math.round(count) });
  };
  if (n <= 2) {
    add('hyena', 2 + n);
    return out;
  }
  add('hyena', 2 + n * 0.6);
  add('jackal', n >= 4 ? n * 0.5 : 0);
  add('raider', n >= 3 ? 1 + (n - 3) * 0.7 : 0);
  add('slinger', n >= 6 ? (n - 5) * 0.5 : 0);
  add('lion', n >= 7 ? Math.floor((n - 5) / 2) : 0);
  if (n % 5 === 0) {
    const bossCycle = Math.floor(n / 5) % 3;
    add(bossCycle === 1 ? 'warlord' : bossCycle === 2 ? 'impundulu' : 'ninki', 1 + Math.floor(n / 15));
  }
  return out;
}

/** Enemy stat multiplier for raid n so late raids stay threatening. */
export function waveStrength(n: number): number {
  return 1 + Math.max(0, n - 3) * 0.12;
}

export function waveReward(n: number) {
  return { legend: 1 + Math.floor(n / 3), food: 20 + n * 15, wood: 20 + n * 12 };
}
