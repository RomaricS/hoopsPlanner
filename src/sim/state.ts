import { RES_IDS, type ResId } from '../data/resources';
import { BUILDINGS, levelHp } from '../data/buildings';
import { generateWorld } from './worldgen';

export const MAP_SIZE = 48;
export const SAVE_VERSION = 2;

export enum Tile {
  Grass = 0,
  DryGrass = 1,
  Dirt = 2,
  Sand = 3,
  Water = 4,
}

export type NodeKind = 'acacia' | 'baobab' | 'bush' | 'rock' | 'palm';

export interface BuildingState {
  uid: number;
  type: string;
  x: number;
  y: number;
  /** 0 while the first construction is in progress. */
  level: number;
  hp: number;
  workers: number;
  construct?: { end: number; total: number; toLevel: number };
}

export interface NodeState {
  uid: number;
  kind: NodeKind;
  x: number;
  y: number;
  amount: number;
  max: number;
  /** Sim time at which a depleted node grows back. */
  regrowAt?: number;
}

export interface HeroState {
  id: string;
  level: number;
}

export interface Stats {
  gathered: Record<ResId, number>;
  built: Record<string, number>;
  raidsWon: number;
  kills: number;
  summoned: number;
  arrivals: number;
}

export interface GameState {
  version: number;
  seed: number;
  /** Simulated seconds since the game started. */
  time: number;
  /** Wall-clock ms when the game was last simulated; used for offline progress. */
  lastSeen: number;
  res: Record<ResId, number>;
  /** Hero summoning tokens, earned from raids and quests. */
  legend: number;
  buildings: BuildingState[];
  nodes: NodeState[];
  terrain: Tile[];
  pop: number;
  /** 0..1 progress towards the next survivor arriving. */
  arrival: number;
  heroes: HeroState[];
  raids: { count: number; lastDay: number };
  quest: number;
  stats: Stats;
  nextUid: number;
}

export function emptyRes(): Record<ResId, number> {
  return Object.fromEntries(RES_IDS.map((r) => [r, 0])) as Record<ResId, number>;
}

export const HEARTH_POS = { x: MAP_SIZE / 2 - 1, y: MAP_SIZE / 2 - 1 };

export function newGame(seed = Math.floor(Math.random() * 1e9)): GameState {
  const { terrain, nodes } = generateWorld(seed, MAP_SIZE, HEARTH_POS);
  const state: GameState = {
    version: SAVE_VERSION,
    seed,
    time: 30,
    lastSeen: Date.now(),
    res: { ...emptyRes(), food: 30, water: 30, wood: 10 },
    legend: 0,
    buildings: [],
    nodes: [],
    terrain,
    pop: 1,
    arrival: 0,
    heroes: [],
    raids: { count: 0, lastDay: 0 },
    quest: 0,
    stats: { gathered: emptyRes(), built: {}, raidsWon: 0, kills: 0, summoned: 0, arrivals: 0 },
    nextUid: 1,
  };
  state.nodes = nodes.map((n) => ({ ...n, uid: state.nextUid++ }));
  state.buildings.push({
    uid: state.nextUid++,
    type: 'hearth',
    x: HEARTH_POS.x,
    y: HEARTH_POS.y,
    level: 1,
    hp: levelHp(BUILDINGS.hearth, 1),
    workers: 0,
  });
  return state;
}
