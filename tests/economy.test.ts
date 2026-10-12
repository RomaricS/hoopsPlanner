import { describe, expect, it } from 'vitest';
import { BUILDINGS, levelCost, limitAt } from '../src/data/buildings';
import { PLOTS } from '../src/sim/layout';
import { waveComposition } from '../src/data/enemies';
import { QUESTS } from '../src/data/quests';
import { HEROES } from '../src/data/heroes';
import * as eco from '../src/sim/economy';
import { newGame, MAP_SIZE, Tile } from '../src/sim/state';

function richGame(seed = 42) {
  const s = newGame(seed);
  for (const k of Object.keys(s.res)) (s.res as Record<string, number>)[k] = 5000;
  return s;
}

function finish(s: ReturnType<typeof newGame>) {
  for (const b of s.buildings) if (b.construct) b.construct.end = s.time;
  eco.tick(s, 0.01);
}

describe('world generation', () => {
  it('is deterministic for a seed and keeps the hearth area dry and clear', () => {
    const a = newGame(7);
    const b = newGame(7);
    expect(a.terrain).toEqual(b.terrain);
    expect(a.nodes.map((n) => [n.x, n.y, n.kind])).toEqual(b.nodes.map((n) => [n.x, n.y, n.kind]));
    const h = eco.hearth(a);
    for (const [x, y] of eco.footprint('hearth', h.x, h.y)) {
      expect(a.terrain[y * MAP_SIZE + x]).not.toBe(Tile.Water);
      expect(eco.nodeAt(a, x, y)).toBeUndefined();
    }
  });

  it('puts starter trees, bushes and rocks inside the first territory', () => {
    const s = newGame(3);
    const near = s.nodes.filter((n) => eco.inTerritory(s, n.x, n.y));
    for (const kind of ['acacia', 'bush', 'rock']) expect(near.some((n) => n.kind === kind)).toBe(true);
  });
});

describe('building', () => {
  it('spends resources, takes a builder and completes after its build time', () => {
    const s = newGame(1);
    s.res.wood = 100;
    const b = eco.placeBuilding(s, 'hut');
    expect('uid' in b).toBe(true);
    expect(s.res.wood).toBe(100 - levelCost(BUILDINGS.hut, 1).wood!);
    expect(eco.busyBuilders(s)).toBe(1);
    eco.tick(s, BUILDINGS.hut.buildTime + 0.1);
    const hut = s.buildings.find((x) => x.type === 'hut')!;
    expect(hut.level).toBe(1);
    expect(eco.housing(s)).toBe(2 + 3);
  });

  it('fills the reserved plots in order and clears trees on them', () => {
    const s = richGame();
    const first = eco.nextPlot(s, 'forager')!;
    expect(PLOTS.find((p) => p.type === 'forager')).toEqual(first);
    s.nodes.push({ uid: 5000, kind: 'acacia', x: first.x, y: first.y, amount: 30, max: 30 });
    const b = eco.placeBuilding(s, 'forager');
    expect('uid' in b && [b.x, b.y]).toEqual([first.x, first.y]);
    expect(s.nodes.some((n) => n.uid === 5000)).toBe(false);
    expect(eco.nextPlot(s, 'forager')).not.toEqual(first);
  });

  it('has a dry plot for every building the limits allow, none overlapping', () => {
    const s = newGame(8);
    const seen = new Set<string>();
    for (const [type, d] of Object.entries(BUILDINGS)) {
      if (type === 'hearth') continue;
      const plots = PLOTS.filter((p) => p.type === type);
      expect(plots.length, type).toBeGreaterThanOrEqual(Math.max(...d.limits));
      for (const p of plots)
        for (const [x, y] of eco.footprint(type, p.x, p.y)) {
          expect(seen.has(`${x},${y}`)).toBe(false);
          seen.add(`${x},${y}`);
          expect(s.terrain[y * MAP_SIZE + x]).not.toBe(Tile.Water);
        }
    }
  });

  it('keeps each unlocked plot inside the territory of the Hearth level that unlocks it', () => {
    for (let hq = 1; hq <= 10; hq++) {
      const s = newGame(1);
      s.buildings[0].level = hq;
      for (const [type, d] of Object.entries(BUILDINGS)) {
        if (type === 'hearth' || hq < d.hqRequired) continue;
        const plots = PLOTS.filter((p) => p.type === type).slice(0, limitAt(d, hq));
        for (const p of plots) for (const [x, y] of eco.footprint(type, p.x, p.y)) expect(eco.inTerritory(s, x, y), `${type} at hq ${hq}`).toBe(true);
      }
    }
  });

  it('respects hearth requirements and per-level limits', () => {
    const s = richGame();
    expect(eco.canBuildType(s, 'watchtower').ok).toBe(false);
    for (let i = 0; i < 2; i++) {
      eco.placeBuilding(s, 'hut');
      finish(s);
    }
    expect(eco.canBuildType(s, 'hut')).toEqual({ ok: false, reason: 'Upgrade the Hearth to build more' });
  });

  it('caps other buildings at the hearth level', () => {
    const s = richGame();
    eco.placeBuilding(s, 'hut');
    finish(s);
    const hut = s.buildings.find((b) => b.type === 'hut')!;
    expect(eco.upgradeCheck(s, hut)).toEqual({ ok: false, reason: 'Upgrade the Hearth first' });
    expect(eco.startUpgrade(s, eco.hearth(s).uid).ok).toBe(true);
    finish(s);
    expect(eco.hqLevel(s)).toBe(2);
    expect(eco.upgradeCheck(s, hut).ok).toBe(true);
  });
});

describe('economy', () => {
  it('produces with workers and consumes food and water per survivor', () => {
    const s = richGame();
    s.res.food = 100;
    s.res.water = 100;
    eco.placeBuilding(s, 'forager');
    finish(s);
    s.pop = 3;
    eco.autoAssign(s);
    const forager = s.buildings.find((b) => b.type === 'forager')!;
    expect(forager.workers).toBe(2);
    const rates = eco.netRates(s);
    const season = 1.15; // Game starts in the Long Rains.
    expect(rates.food).toBeCloseTo(2 * 6 * season - 3 * eco.FOOD_PER_POP, 5);
    expect(rates.water).toBeCloseTo(-3 * eco.WATER_PER_POP, 5);
  });

  it('never stores more than capacity', () => {
    const s = newGame(5);
    eco.addRes(s, { wood: 10_000 });
    expect(s.res.wood).toBe(eco.capacity(s));
  });

  it('welcomes survivors when there is housing, food and water', () => {
    const s = newGame(9);
    s.res.food = 50;
    s.res.water = 50;
    expect(s.pop).toBe(1);
    for (let i = 0; i < 40; i++) eco.tick(s, 1);
    expect(s.pop).toBe(2);
    for (let i = 0; i < 100; i++) eco.tick(s, 1);
    expect(s.pop).toBe(eco.housing(s));
  });

  it('gathering depletes nodes, which grow back later', () => {
    const s = newGame(11);
    const tree = s.nodes.find((n) => n.kind === 'acacia')!;
    let total = 0;
    while (tree.amount > 0) total += eco.gather(s, tree.uid)!.amount;
    expect(total).toBe(eco.GATHER_AMOUNT.acacia.amount * 6);
    expect(eco.gather(s, tree.uid)).toBeNull();
    eco.tick(s, eco.NODE_REGROW_SECONDS + 1);
    expect(tree.amount).toBeGreaterThan(0);
  });

  it('catches up offline without raids and caps the time away', () => {
    const s = richGame();
    s.res.food = 0;
    const r = eco.catchUp(s, 48 * 3600);
    expect(r.elapsed).toBe(eco.OFFLINE_CAP);
    expect(eco.raidDue(s)).toBe(false);
  });
});

describe('raids, heroes and quests', () => {
  it('schedules raids on alternate nights from day 3', () => {
    const s = newGame(2);
    const night = (day: number) => (day - 1 + 0.8) * 240;
    s.time = night(2);
    expect(eco.raidDue(s)).toBe(false);
    s.time = night(3);
    expect(eco.raidDue(s)).toBe(true);
    eco.startRaid(s);
    expect(eco.raidDue(s)).toBe(false);
    s.time = night(4);
    expect(eco.raidDue(s)).toBe(false);
    s.time = night(5);
    expect(eco.raidDue(s)).toBe(true);
  });

  it('grows raids and brings a boss every fifth one', () => {
    expect(waveComposition(1).reduce((n, w) => n + w.count, 0)).toBeGreaterThan(0);
    const size = (n: number) => waveComposition(n).reduce((t, w) => t + w.count, 0);
    expect(size(12)).toBeGreaterThan(size(4));
    expect(waveComposition(5).some((w) => ['warlord', 'impundulu', 'ninki'].includes(w.enemy))).toBe(true);
  });

  it('summons a hero only with a griot, the right age and enough tokens', () => {
    const s = richGame();
    s.legend = 50;
    expect(eco.canSummon(s, 'sundiata').ok).toBe(false);
    s.buildings.push({ uid: 999, type: 'griot', x: 0, y: 0, level: 1, hp: 100, workers: 0 });
    expect(eco.summonHero(s, 'sundiata').ok).toBe(true);
    expect(s.legend).toBe(50 - HEROES.find((h) => h.id === 'sundiata')!.cost);
    expect(eco.canSummon(s, 'amanirenas')).toEqual({ ok: false, reason: 'Reach the Iron age' });
    expect(eco.heroBonus(s, (b) => b.kind === 'production' && b.res === 'food')).toBeCloseTo(0.15);
  });

  it('has quests with reachable targets', () => {
    const s = newGame(4);
    for (const q of QUESTS) {
      const [cur, target] = q.progress(s);
      expect(target).toBeGreaterThan(0);
      expect(cur).toBeGreaterThanOrEqual(0);
    }
  });
});
