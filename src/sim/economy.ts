import {
  BUILDINGS,
  housingAt,
  levelCost,
  levelHp,
  levelTime,
  limitAt,
  workerSlots,
  type BuildingDef,
} from '../data/buildings';
import { eraForHq } from '../data/eras';
import { HERO_BY_ID, heroUpgradeCost, type HeroBonus } from '../data/heroes';
import { RES_IDS, type ResBag, type ResId } from '../data/resources';
import { dayAt, isNight, seasonAt } from '../data/seasons';
import { waveReward } from '../data/enemies';
import { nodeMax } from './worldgen';
import { MAP_SIZE, type BuildingState, type GameState, type NodeState } from './state';
import { PLOTS, type Plot } from './layout';

/** Food and water each survivor needs per minute. */
export const FOOD_PER_POP = 0.6;
export const WATER_PER_POP = 0.5;
/** Seconds between survivor arrivals when there is room and supplies. */
export const ARRIVAL_SECONDS = 25;
export const GATHER_AMOUNT: Record<string, { res: ResId; amount: number }> = {
  acacia: { res: 'wood', amount: 5 },
  baobab: { res: 'wood', amount: 8 },
  palm: { res: 'wood', amount: 4 },
  bush: { res: 'food', amount: 5 },
  rock: { res: 'stone', amount: 4 },
};
export const NODE_REGROW_SECONDS = 150;
/** Raids happen on the night of every second day from this day on. */
export const FIRST_RAID_DAY = 3;
/** Maximum offline catch-up, in seconds. */
export const OFFLINE_CAP = 8 * 3600;

export type GameEvent =
  | { type: 'built'; uid: number; level: number }
  | { type: 'arrived' }
  | { type: 'hungry'; res: ResId }
  | { type: 'regrow'; uid: number };

export function def(b: BuildingState): BuildingDef {
  return BUILDINGS[b.type];
}

export function hearth(state: GameState): BuildingState {
  return state.buildings.find((b) => b.type === 'hearth')!;
}

export function hqLevel(state: GameState): number {
  return Math.max(1, hearth(state).level);
}

export function era(state: GameState) {
  return eraForHq(hqLevel(state));
}

/** Territory you may build in: a square around the hearth, growing with its level. */
export function territoryRadius(state: GameState): number {
  return 6 + 2 * hqLevel(state);
}

export function inTerritory(state: GameState, x: number, y: number): boolean {
  const h = hearth(state);
  const r = territoryRadius(state);
  return Math.abs(x - (h.x + 0.5)) <= r && Math.abs(y - (h.y + 0.5)) <= r;
}

export function heroBonus(state: GameState, match: (b: HeroBonus) => boolean): number {
  let pct = 0;
  for (const h of state.heroes) {
    const d = HERO_BY_ID[h.id];
    if (d && match(d.bonus)) pct += d.bonus.pct * (1 + 0.1 * (h.level - 1));
  }
  return pct / 100;
}

export function capacity(state: GameState): number {
  let cap = 0;
  for (const b of state.buildings) {
    const d = def(b);
    if (d.storage && b.level > 0) cap += d.storage * b.level;
  }
  return 100 + cap;
}

export function housing(state: GameState): number {
  let h = 0;
  for (const b of state.buildings) if (b.level > 0) h += housingAt(def(b), b.level);
  return h;
}

export function assigned(state: GameState): number {
  return state.buildings.reduce((s, b) => s + b.workers, 0);
}

export function idle(state: GameState): number {
  return Math.max(0, state.pop - assigned(state));
}

export function guards(state: GameState): number {
  return state.buildings.reduce((s, b) => s + (def(b).guards && b.level > 0 ? b.workers : 0), 0);
}

export function builders(state: GameState): number {
  const hq = hqLevel(state);
  return 2 + (hq >= 4 ? 1 : 0) + (hq >= 7 ? 1 : 0);
}

export function busyBuilders(state: GameState): number {
  return state.buildings.filter((b) => b.construct).length;
}

/** A building produces when it is built, standing, and not being built for the first time. */
export function isWorking(b: BuildingState): boolean {
  return b.level > 0 && b.hp > 0;
}

/** Output of one building, per minute, before global shortages. */
export function buildingRate(state: GameState, b: BuildingState): { res: ResId; perMin: number } | null {
  const d = def(b);
  if (!d.produces || !isWorking(b) || b.workers <= 0) return null;
  const season = seasonAt(state.time);
  const seasonMult = d.crop ? season.mult.crop ?? 1 : season.mult[d.produces.res] ?? 1;
  const levelMult = 1 + 0.25 * (b.level - 1);
  const hero = 1 + heroBonus(state, (x) => x.kind === 'production' && x.res === d.produces!.res);
  return { res: d.produces.res, perMin: d.produces.rate * b.workers * levelMult * seasonMult * hero };
}

/** Net change per minute of every resource, including what survivors eat and drink. */
export function netRates(state: GameState): Record<ResId, number> {
  const out = Object.fromEntries(RES_IDS.map((r) => [r, 0])) as Record<ResId, number>;
  for (const b of state.buildings) {
    const r = buildingRate(state, b);
    if (!r) continue;
    out[r.res] += r.perMin;
    const c = def(b).consumes;
    if (c) out[c.res] -= c.rate * b.workers;
  }
  out.food -= state.pop * FOOD_PER_POP;
  out.water -= state.pop * WATER_PER_POP;
  return out;
}

export function addRes(state: GameState, bag: ResBag, track = false) {
  const cap = capacity(state);
  for (const [k, v] of Object.entries(bag)) {
    const id = k as ResId;
    const before = state.res[id];
    state.res[id] = Math.min(cap, Math.max(0, before + (v as number)));
    if (track && (v as number) > 0) state.stats.gathered[id] += state.res[id] - before;
  }
}

export function canAfford(state: GameState, bag: ResBag): boolean {
  return Object.entries(bag).every(([k, v]) => state.res[k as ResId] >= (v as number));
}

export function spend(state: GameState, bag: ResBag): boolean {
  if (!canAfford(state, bag)) return false;
  for (const [k, v] of Object.entries(bag)) state.res[k as ResId] -= v as number;
  return true;
}

export function countOf(state: GameState, type: string): number {
  return state.buildings.filter((b) => b.type === type).length;
}

export function buildTimeFor(state: GameState, d: BuildingDef, level: number): number {
  return levelTime(d, level) / (1 + heroBonus(state, (x) => x.kind === 'buildSpeed'));
}

export function maxHp(state: GameState, b: BuildingState): number {
  const d = def(b);
  const lvl = Math.max(1, b.level);
  const wallBonus = heroBonus(state, (x) => x.kind === 'wallHp');
  return Math.round(levelHp(d, lvl) * (1 + wallBonus));
}

// ---------------------------------------------------------------- placement

export function footprint(type: string, x: number, y: number): [number, number][] {
  const n = BUILDINGS[type].size;
  const out: [number, number][] = [];
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) out.push([x + dx, y + dy]);
  return out;
}

export function buildingAt(state: GameState, x: number, y: number): BuildingState | undefined {
  return state.buildings.find((b) => {
    const n = def(b).size;
    return x >= b.x && y >= b.y && x < b.x + n && y < b.y + n;
  });
}

export function nodeAt(state: GameState, x: number, y: number): NodeState | undefined {
  return state.nodes.find((n) => n.x === x && n.y === y);
}

export type PlaceCheck = { ok: true } | { ok: false; reason: string };

/** The next empty plot reserved for this building type, if any. */
export function nextPlot(state: GameState, type: string): Plot | undefined {
  const n = BUILDINGS[type].size;
  return PLOTS.find((p) => p.type === type && !footprint(type, p.x, p.y).some(([x, y]) => buildingAt(state, x, y)) && p.x + n <= MAP_SIZE);
}

export function canBuildType(state: GameState, type: string): PlaceCheck {
  const d = BUILDINGS[type];
  const hq = hqLevel(state);
  if (hq < d.hqRequired) return { ok: false, reason: `Needs Hearth level ${d.hqRequired}` };
  if (countOf(state, type) >= limitAt(d, hq)) return { ok: false, reason: 'Upgrade the Hearth to build more' };
  const plot = nextPlot(state, type);
  if (!plot) return { ok: false, reason: 'No free plot left' };
  if (!footprint(type, plot.x, plot.y).every(([x, y]) => inTerritory(state, x, y))) return { ok: false, reason: 'Upgrade the Hearth to grow your land' };
  if (busyBuilders(state) >= builders(state)) return { ok: false, reason: 'All builders are busy' };
  if (!canAfford(state, levelCost(d, 1))) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

/** Builds on the next free plot for this type. Trees and rocks on the plot are cleared. */
export function placeBuilding(state: GameState, type: string): BuildingState | { ok: false; reason: string } {
  const can = canBuildType(state, type);
  if (!can.ok) return can;
  const plot = nextPlot(state, type)!;
  const d = BUILDINGS[type];
  spend(state, levelCost(d, 1));
  const fp = new Set(footprint(type, plot.x, plot.y).map(([a, b]) => `${a},${b}`));
  state.nodes = state.nodes.filter((n) => !fp.has(`${n.x},${n.y}`));
  const total = buildTimeFor(state, d, 1);
  const b: BuildingState = {
    uid: state.nextUid++,
    type,
    x: plot.x,
    y: plot.y,
    level: 0,
    hp: Math.round(levelHp(d, 1) * 0.3),
    workers: 0,
    construct: { end: state.time + total, total, toLevel: 1 },
  };
  state.buildings.push(b);
  return b;
}

export function upgradeCheck(state: GameState, b: BuildingState): PlaceCheck {
  const d = def(b);
  if (b.construct) return { ok: false, reason: 'Already under construction' };
  if (b.level >= d.maxLevel) return { ok: false, reason: 'Maximum level' };
  if (b.type !== 'hearth' && b.level >= hqLevel(state)) return { ok: false, reason: 'Upgrade the Hearth first' };
  if (b.hp <= 0) return { ok: false, reason: 'Repair it first' };
  if (busyBuilders(state) >= builders(state)) return { ok: false, reason: 'All builders are busy' };
  if (!canAfford(state, levelCost(d, b.level + 1))) return { ok: false, reason: 'Not enough resources' };
  return { ok: true };
}

export function startUpgrade(state: GameState, uid: number): PlaceCheck {
  const b = state.buildings.find((v) => v.uid === uid);
  if (!b) return { ok: false, reason: 'Missing building' };
  const check = upgradeCheck(state, b);
  if (!check.ok) return check;
  const d = def(b);
  spend(state, levelCost(d, b.level + 1));
  const total = buildTimeFor(state, d, b.level + 1);
  b.construct = { end: state.time + total, total, toLevel: b.level + 1 };
  return { ok: true };
}

/** Cost in legend tokens to finish a construction right away. */
export function rushCost(state: GameState, b: BuildingState): number {
  if (!b.construct) return 0;
  return Math.max(1, Math.ceil((b.construct.end - state.time) / 120));
}

export function rush(state: GameState, uid: number): boolean {
  const b = state.buildings.find((v) => v.uid === uid);
  if (!b?.construct) return false;
  const cost = rushCost(state, b);
  if (state.legend < cost) return false;
  state.legend -= cost;
  b.construct.end = state.time;
  return true;
}

export function demolish(state: GameState, uid: number) {
  const b = state.buildings.find((v) => v.uid === uid);
  if (!b || b.type === 'hearth') return;
  state.buildings = state.buildings.filter((v) => v.uid !== uid);
  // Refund half of the level 1 cost.
  const refund: ResBag = {};
  for (const [k, v] of Object.entries(levelCost(def(b), 1))) refund[k as ResId] = Math.floor((v as number) / 2);
  addRes(state, refund);
}

// ---------------------------------------------------------------- workers

export function setWorkers(state: GameState, uid: number, n: number) {
  const b = state.buildings.find((v) => v.uid === uid);
  if (!b) return;
  const slots = workerSlots(def(b), Math.max(1, b.level));
  const free = idle(state) + b.workers;
  b.workers = Math.max(0, Math.min(n, slots, free));
}

const ASSIGN_PRIORITY: string[] = ['well', 'forager', 'maize', 'kraal', 'woodcutter', 'quarry', 'smelter', 'goldmine', 'lodge'];

/** Puts idle survivors into empty slots, most vital jobs first. */
export function autoAssign(state: GameState) {
  let free = idle(state);
  if (free <= 0) return;
  const sorted = state.buildings
    .filter((b) => b.level > 0 && def(b).workers)
    .sort((a, b) => ASSIGN_PRIORITY.indexOf(a.type) - ASSIGN_PRIORITY.indexOf(b.type));
  // Spread one worker at a time so every building gets someone.
  let changed = true;
  while (free > 0 && changed) {
    changed = false;
    for (const b of sorted) {
      if (free <= 0) break;
      if (b.workers < workerSlots(def(b), b.level)) {
        b.workers++;
        free--;
        changed = true;
      }
    }
  }
}

// ---------------------------------------------------------------- gathering

export function gather(state: GameState, uid: number): { res: ResId; amount: number } | null {
  const n = state.nodes.find((v) => v.uid === uid);
  if (!n || n.amount <= 0) return null;
  const g = GATHER_AMOUNT[n.kind];
  const amount = Math.min(g.amount, n.amount);
  n.amount -= amount;
  if (n.amount <= 0) n.regrowAt = state.time + NODE_REGROW_SECONDS;
  const before = state.res[g.res];
  addRes(state, { [g.res]: amount }, true);
  return { res: g.res, amount: state.res[g.res] - before };
}

// ---------------------------------------------------------------- heroes

export function canSummon(state: GameState, id: string): PlaceCheck {
  const d = HERO_BY_ID[id];
  if (!d) return { ok: false, reason: 'Unknown hero' };
  if (state.heroes.some((h) => h.id === id)) return { ok: false, reason: 'Already with you' };
  if (!state.buildings.some((b) => b.type === 'griot' && b.level > 0)) return { ok: false, reason: 'Build the Griot Baobab' };
  if (era(state).id < d.era) return { ok: false, reason: `Reach the ${['', 'Savanna', 'Iron', 'Kingdom', 'Empire'][d.era]} age` };
  if (state.legend < d.cost) return { ok: false, reason: 'Not enough legend tokens' };
  return { ok: true };
}

export function summonHero(state: GameState, id: string): PlaceCheck {
  const check = canSummon(state, id);
  if (!check.ok) return check;
  const d = HERO_BY_ID[id];
  state.legend -= d.cost;
  state.heroes.push({ id, level: 1 });
  state.stats.summoned++;
  return { ok: true };
}

export function heroMaxLevel(state: GameState): number {
  const griot = state.buildings.find((b) => b.type === 'griot');
  return 5 * Math.max(1, griot?.level ?? 1);
}

export function upgradeHero(state: GameState, id: string): PlaceCheck {
  const h = state.heroes.find((v) => v.id === id);
  if (!h) return { ok: false, reason: 'Not summoned' };
  if (h.level >= heroMaxLevel(state)) return { ok: false, reason: 'Upgrade the Griot Baobab' };
  const cost = heroUpgradeCost(h.level);
  if (state.legend < cost.legend) return { ok: false, reason: 'Not enough legend tokens' };
  if (state.res.food < cost.food) return { ok: false, reason: 'Not enough food' };
  state.legend -= cost.legend;
  state.res.food -= cost.food;
  h.level++;
  return { ok: true };
}

// ---------------------------------------------------------------- raids

export function raidDue(state: GameState): boolean {
  const day = dayAt(state.time);
  return isNight(state.time) && day >= FIRST_RAID_DAY && (day - FIRST_RAID_DAY) % 2 === 0 && state.raids.lastDay < day;
}

export function startRaid(state: GameState): number {
  state.raids.lastDay = dayAt(state.time);
  state.raids.count++;
  return state.raids.count;
}

export function raidWon(state: GameState, n: number) {
  const r = waveReward(n);
  state.legend += r.legend;
  state.stats.raidsWon++;
  addRes(state, { food: r.food, wood: r.wood });
  return r;
}

/** Raiders who survive until dawn run off with part of the stores. */
export function raidLost(state: GameState): ResBag {
  const lost: ResBag = {};
  for (const id of RES_IDS) {
    const amt = Math.floor(state.res[id] * 0.12);
    if (amt > 0) {
      lost[id] = amt;
      state.res[id] -= amt;
    }
  }
  return lost;
}

// ---------------------------------------------------------------- tick

/** Advances the economy by dt seconds. Raids and combat are driven by the world scene. */
export function tick(state: GameState, dt: number): GameEvent[] {
  const events: GameEvent[] = [];
  state.time += dt;
  const minutes = dt / 60;

  // Production and consumption. Shortages of food or water halve output.
  const rates = netRates(state);
  const starving = state.res.food <= 0 || state.res.water <= 0;
  const delta: ResBag = {};
  for (const id of RES_IDS) {
    let r = rates[id];
    if (starving && r > 0) r *= 0.5;
    delta[id] = r * minutes;
  }
  // Consumers stop when their input runs out.
  for (const b of state.buildings) {
    const c = def(b).consumes;
    if (c && isWorking(b) && b.workers > 0 && state.res[c.res] <= 0) {
      const r = buildingRate(state, b);
      if (r) delta[r.res] = (delta[r.res] ?? 0) - r.perMin * minutes;
    }
  }
  addRes(state, delta, true);
  if (state.res.food <= 0) events.push({ type: 'hungry', res: 'food' });
  if (state.res.water <= 0) events.push({ type: 'hungry', res: 'water' });

  // Construction.
  for (const b of state.buildings) {
    if (b.construct && state.time >= b.construct.end) {
      const was = b.level;
      b.level = b.construct.toLevel;
      b.construct = undefined;
      b.hp = maxHp(state, b);
      state.stats.built[b.type] = (state.stats.built[b.type] ?? 0) + (was === 0 ? 1 : 0);
      events.push({ type: 'built', uid: b.uid, level: b.level });
      if (was === 0 && def(b).workers) autoAssign(state);
    }
  }

  // Slow repairs between raids.
  if (!isNight(state.time)) {
    for (const b of state.buildings) {
      const max = maxHp(state, b);
      if (b.level > 0 && b.hp < max) b.hp = Math.min(max, b.hp + max * 0.02 * dt);
    }
  }

  // Nodes grow back.
  for (const n of state.nodes) {
    if (n.amount <= 0 && n.regrowAt !== undefined && state.time >= n.regrowAt) {
      n.amount = nodeMax(n.kind);
      n.regrowAt = undefined;
      events.push({ type: 'regrow', uid: n.uid });
    }
  }

  // New survivors find the fire when there is room, food and water.
  const room = housing(state) - state.pop;
  if (room > 0 && state.res.food > 5 && state.res.water > 5) {
    const growth = 1 + heroBonus(state, (x) => x.kind === 'growth');
    state.arrival += (dt / ARRIVAL_SECONDS) * growth;
    if (state.arrival >= 1) {
      state.arrival = 0;
      state.pop++;
      state.stats.arrivals++;
      autoAssign(state);
      events.push({ type: 'arrived' });
    }
  } else {
    state.arrival = Math.max(0, state.arrival - dt / 120);
  }
  return events;
}

/**
 * Catches up on time spent away: production, construction and arrivals run,
 * raids do not. Returns the resources gained.
 */
export function catchUp(state: GameState, seconds: number) {
  const elapsed = Math.min(OFFLINE_CAP, Math.max(0, seconds));
  const before = { ...state.res };
  const popBefore = state.pop;
  let built = 0;
  let left = elapsed;
  while (left > 0) {
    const step = Math.min(10, left);
    for (const e of tick(state, step)) if (e.type === 'built') built++;
    left -= step;
  }
  // Raids that would have happened while away are skipped.
  state.raids.lastDay = Math.max(state.raids.lastDay, dayAt(state.time));
  const gained: ResBag = {};
  for (const id of RES_IDS) {
    const d = Math.round(state.res[id] - before[id]);
    if (d !== 0) gained[id] = d;
  }
  return { elapsed, gained, arrivals: state.pop - popBefore, built };
}

export { levelCost, workerSlots };
