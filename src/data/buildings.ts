import type { ResBag, ResId } from './resources';

export type BuildingCategory = 'core' | 'housing' | 'production' | 'storage' | 'defense' | 'special';

export interface DefenseStats {
  /** Range in tiles. */
  range: number;
  damage: number;
  /** Seconds between shots. */
  cooldown: number;
  projectile: 'arrow' | 'spear' | 'stone';
}

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  category: BuildingCategory;
  /** Footprint is size x size tiles. */
  size: number;
  /** Hearth level needed to build the first one. */
  hqRequired: number;
  maxLevel: number;
  /** Cost of level 1. Higher levels multiply by costGrowth^(level-1). */
  cost: ResBag;
  costGrowth: number;
  /** Seconds to build level 1. */
  buildTime: number;
  timeGrowth: number;
  hp: number;
  /** How many may exist, indexed by hearth level - 1 (last value repeats). */
  limits: number[];
  /** Worker slots at level 1; one more slot every 2 levels. */
  workers?: number;
  /** Units produced per worker per minute at level 1 (+25% per level). */
  produces?: { res: ResId; rate: number };
  /** Units consumed per worker per minute while producing. */
  consumes?: { res: ResId; rate: number };
  /** Housing at level 1, +housingGrowth per level. */
  housing?: number;
  housingGrowth?: number;
  /** Storage capacity added per level. */
  storage?: number;
  defense?: DefenseStats;
  /** Workers assigned here become guards that fight raids. */
  guards?: boolean;
  /** Gives the season multipliers of crops instead of foraging. */
  crop?: boolean;
  /** Explicit upgrade costs per level (index = level - 1), overrides cost/costGrowth. */
  levelCosts?: ResBag[];
}

export const BUILDINGS: Record<string, BuildingDef> = {
  hearth: {
    id: 'hearth',
    name: 'Hearth',
    desc: 'The heart of your people. Upgrade it to unlock new buildings and new ages.',
    category: 'core',
    size: 2,
    hqRequired: 1,
    maxLevel: 10,
    cost: {},
    costGrowth: 1,
    buildTime: 20,
    timeGrowth: 1.7,
    hp: 900,
    limits: [1],
    housing: 2,
    housingGrowth: 1,
    storage: 150,
    levelCosts: [
      {},
      { wood: 60, food: 40 },
      { wood: 160, stone: 80, food: 80 },
      { wood: 320, stone: 240, food: 200, water: 120 },
      { wood: 600, stone: 500, iron: 60, food: 400 },
      { wood: 1000, stone: 900, iron: 180, food: 700 },
      { wood: 1600, stone: 1500, iron: 400, food: 1100 },
      { wood: 2400, stone: 2400, iron: 800, gold: 100 },
      { wood: 3600, stone: 3600, iron: 1400, gold: 300 },
      { wood: 5000, stone: 5000, iron: 2400, gold: 700 },
    ],
  },
  hut: {
    id: 'hut',
    name: 'Mud Hut',
    desc: 'A round home of earth and thatch. Houses survivors so more can join you.',
    category: 'housing',
    size: 1,
    hqRequired: 1,
    maxLevel: 10,
    cost: { wood: 20 },
    costGrowth: 1.75,
    buildTime: 5,
    timeGrowth: 1.6,
    hp: 220,
    limits: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    housing: 3,
    housingGrowth: 2,
  },
  forager: {
    id: 'forager',
    name: "Forager's Camp",
    desc: 'Survivors gather berries, roots and honey from the bush.',
    category: 'production',
    size: 2,
    hqRequired: 1,
    maxLevel: 10,
    cost: { wood: 25 },
    costGrowth: 1.8,
    buildTime: 8,
    timeGrowth: 1.6,
    hp: 300,
    limits: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    workers: 2,
    produces: { res: 'food', rate: 6 },
  },
  well: {
    id: 'well',
    name: 'Well',
    desc: 'Draws water from deep underground. Dries up a little in the dry season.',
    category: 'production',
    size: 1,
    hqRequired: 1,
    maxLevel: 10,
    cost: { wood: 15, stone: 10 },
    costGrowth: 1.8,
    buildTime: 8,
    timeGrowth: 1.6,
    hp: 260,
    limits: [1, 2, 2, 3, 3, 4, 4, 5, 5, 6],
    workers: 1,
    produces: { res: 'water', rate: 9 },
  },
  woodcutter: {
    id: 'woodcutter',
    name: "Woodcutter's Lodge",
    desc: 'Cuts acacia and mopane wood from the surrounding bush.',
    category: 'production',
    size: 2,
    hqRequired: 1,
    maxLevel: 10,
    cost: { wood: 30, food: 10 },
    costGrowth: 1.8,
    buildTime: 10,
    timeGrowth: 1.6,
    hp: 320,
    limits: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    workers: 2,
    produces: { res: 'wood', rate: 5 },
  },
  quarry: {
    id: 'quarry',
    name: 'Stone Quarry',
    desc: 'Breaks granite from the kopjes. Stone builds walls and great houses.',
    category: 'production',
    size: 2,
    hqRequired: 2,
    maxLevel: 10,
    cost: { wood: 60, food: 20 },
    costGrowth: 1.8,
    buildTime: 15,
    timeGrowth: 1.6,
    hp: 380,
    limits: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5],
    workers: 2,
    produces: { res: 'stone', rate: 4 },
  },
  granary: {
    id: 'granary',
    name: 'Granary',
    desc: 'A raised clay granary that keeps grain safe from rot and rats. Raises storage.',
    category: 'storage',
    size: 1,
    hqRequired: 2,
    maxLevel: 10,
    cost: { wood: 50, stone: 30 },
    costGrowth: 1.8,
    buildTime: 12,
    timeGrowth: 1.6,
    hp: 350,
    limits: [0, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    storage: 300,
  },
  palisade: {
    id: 'palisade',
    name: 'Palisade',
    desc: 'Sharpened stakes that slow raiders down.',
    category: 'defense',
    size: 1,
    hqRequired: 2,
    maxLevel: 5,
    cost: { wood: 8 },
    costGrowth: 1.9,
    buildTime: 2,
    timeGrowth: 1.4,
    hp: 320,
    limits: [0, 20, 30, 40, 50, 60, 70, 80, 90, 100],
  },
  watchtower: {
    id: 'watchtower',
    name: 'Watchtower',
    desc: 'An archer keeps watch from above and shoots at raiders.',
    category: 'defense',
    size: 1,
    hqRequired: 2,
    maxLevel: 10,
    cost: { wood: 60, stone: 20 },
    costGrowth: 1.8,
    buildTime: 15,
    timeGrowth: 1.6,
    hp: 420,
    limits: [0, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    defense: { range: 5.5, damage: 11, cooldown: 1.1, projectile: 'arrow' },
  },
  maize: {
    id: 'maize',
    name: 'Maize Field',
    desc: 'Rich harvests in the rains, poor ones in the dry season.',
    category: 'production',
    size: 2,
    hqRequired: 3,
    maxLevel: 10,
    cost: { wood: 60, water: 40 },
    costGrowth: 1.8,
    buildTime: 14,
    timeGrowth: 1.6,
    hp: 200,
    limits: [0, 0, 2, 2, 3, 3, 4, 4, 5, 5],
    workers: 2,
    produces: { res: 'food', rate: 10 },
    crop: true,
  },
  lodge: {
    id: 'lodge',
    name: 'Warrior Lodge',
    desc: 'Survivors assigned here train as guards and defend the village at night.',
    category: 'defense',
    size: 2,
    hqRequired: 3,
    maxLevel: 10,
    cost: { wood: 120, stone: 60, food: 60 },
    costGrowth: 1.8,
    buildTime: 20,
    timeGrowth: 1.6,
    hp: 600,
    limits: [0, 0, 1, 1, 2, 2, 2, 3, 3, 3],
    workers: 2,
    guards: true,
  },
  griot: {
    id: 'griot',
    name: 'Griot Baobab',
    desc: 'Under the great baobab, the griot sings of legends. Legends answer the call.',
    category: 'special',
    size: 2,
    hqRequired: 3,
    maxLevel: 5,
    cost: { wood: 100, stone: 100, water: 50 },
    costGrowth: 2.2,
    buildTime: 25,
    timeGrowth: 1.7,
    hp: 700,
    limits: [0, 0, 1],
  },
  smelter: {
    id: 'smelter',
    name: 'Iron Smelter',
    desc: 'A clay furnace that turns ore into iron. Burns wood while it works.',
    category: 'production',
    size: 2,
    hqRequired: 4,
    maxLevel: 10,
    cost: { wood: 200, stone: 150 },
    costGrowth: 1.8,
    buildTime: 30,
    timeGrowth: 1.6,
    hp: 500,
    limits: [0, 0, 0, 1, 2, 2, 3, 3, 4, 4],
    workers: 2,
    produces: { res: 'iron', rate: 2.5 },
    consumes: { res: 'wood', rate: 2 },
  },
  kraal: {
    id: 'kraal',
    name: 'Cattle Kraal',
    desc: 'Long-horned cattle give milk and meat whatever the season.',
    category: 'production',
    size: 2,
    hqRequired: 4,
    maxLevel: 10,
    cost: { wood: 180, stone: 60, water: 100 },
    costGrowth: 1.8,
    buildTime: 25,
    timeGrowth: 1.6,
    hp: 450,
    limits: [0, 0, 0, 1, 2, 2, 3, 3, 4, 4],
    workers: 2,
    produces: { res: 'food', rate: 12 },
  },
  stonewall: {
    id: 'stonewall',
    name: 'Stone Wall',
    desc: 'Dry-stone masonry in the style of Great Zimbabwe. Very tough.',
    category: 'defense',
    size: 1,
    hqRequired: 5,
    maxLevel: 5,
    cost: { stone: 25 },
    costGrowth: 1.9,
    buildTime: 4,
    timeGrowth: 1.4,
    hp: 1100,
    limits: [0, 0, 0, 0, 40, 50, 60, 70, 80, 100],
  },
  goldmine: {
    id: 'goldmine',
    name: 'Gold Mine',
    desc: 'The gold fields of Bambuk and Bure made kings rich.',
    category: 'production',
    size: 2,
    hqRequired: 7,
    maxLevel: 10,
    cost: { wood: 800, stone: 600, iron: 200 },
    costGrowth: 1.8,
    buildTime: 60,
    timeGrowth: 1.6,
    hp: 700,
    limits: [0, 0, 0, 0, 0, 0, 1, 2, 2, 3],
    workers: 3,
    produces: { res: 'gold', rate: 1.5 },
  },
};

export const BUILD_ORDER = [
  'hut', 'forager', 'well', 'woodcutter', 'quarry', 'granary', 'palisade', 'watchtower',
  'maize', 'lodge', 'griot', 'smelter', 'kraal', 'stonewall', 'goldmine',
];

export function levelCost(def: BuildingDef, level: number): ResBag {
  if (def.levelCosts) return def.levelCosts[Math.min(level, def.levelCosts.length) - 1] ?? {};
  const mult = Math.pow(def.costGrowth, level - 1);
  const out: ResBag = {};
  for (const [k, v] of Object.entries(def.cost)) out[k as ResId] = Math.round((v as number) * mult);
  return out;
}

export function levelTime(def: BuildingDef, level: number): number {
  return Math.round(def.buildTime * Math.pow(def.timeGrowth, level - 1));
}

export function levelHp(def: BuildingDef, level: number): number {
  return Math.round(def.hp * (1 + 0.3 * (level - 1)));
}

export function workerSlots(def: BuildingDef, level: number): number {
  if (!def.workers) return 0;
  return def.workers + Math.floor((level - 1) / 2);
}

export function housingAt(def: BuildingDef, level: number): number {
  if (!def.housing) return 0;
  return def.housing + (def.housingGrowth ?? 0) * (level - 1);
}

export function limitAt(def: BuildingDef, hqLevel: number): number {
  return def.limits[Math.min(hqLevel, def.limits.length) - 1] ?? 0;
}

export function defenseAt(def: BuildingDef, level: number) {
  if (!def.defense) return undefined;
  return { ...def.defense, damage: def.defense.damage * (1 + 0.28 * (level - 1)), range: def.defense.range + 0.15 * (level - 1) };
}
