/**
 * The village plan. Buildings are not placed freely: the map is divided into
 * 3x3-tile cells around the hearth (a 2x2 plot plus a road on two sides), and
 * each cell is reserved for one large building or four small ones. Earlier
 * buildings sit closer to the fire, so the village grows outward in rings.
 */
export const HEARTH_X = 23;
export const HEARTH_Y = 23;
const CELL = 3;
export const RINGS = 3;

export interface Plot {
  type: string;
  x: number;
  y: number;
}

type CellPlan = string | [string, string, string, string];

/** Cells in the order they are handed out, ring by ring. */
const PLAN: CellPlan[] = [
  // Ring 1
  'forager',
  ['hut', 'hut', 'well', 'hut'],
  'woodcutter',
  ['hut', 'granary', 'well', 'watchtower'],
  'quarry',
  'maize',
  'griot',
  'lodge',
  // Ring 2
  ['watchtower', 'hut', 'hut', 'granary'],
  'forager',
  'woodcutter',
  'maize',
  ['hut', 'hut', 'well', 'watchtower'],
  'smelter',
  'kraal',
  'quarry',
  ['hut', 'hut', 'granary', 'well'],
  'forager',
  'woodcutter',
  'lodge',
  'smelter',
  'kraal',
  ['watchtower', 'hut', 'hut', 'well'],
  'maize',
  // Ring 3
  'goldmine',
  'quarry',
  ['hut', 'hut', 'granary', 'watchtower'],
  'forager',
  'woodcutter',
  'maize',
  'smelter',
  'kraal',
  ['hut', 'hut', 'well', 'granary'],
  'quarry',
  'goldmine',
  'lodge',
  'forager',
  'woodcutter',
  'maize',
  'smelter',
  'kraal',
  ['hut', 'hut', 'hut', 'hut'],
  'quarry',
  'goldmine',
];

/** Cells of one ring, front of the screen (larger x + y) first. */
function ringCells(k: number): [number, number][] {
  const out: [number, number][] = [];
  for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) if (Math.max(Math.abs(i), Math.abs(j)) === k) out.push([i, j]);
  return out.sort((a, b) => b[0] + b[1] - (a[0] + a[1]) || a[0] - a[1] - (b[0] - b[1]));
}

function buildPlots(): Plot[] {
  const cells: [number, number][] = [];
  for (let k = 1; k <= RINGS; k++) cells.push(...ringCells(k));
  const plots: Plot[] = [];
  PLAN.forEach((entry, n) => {
    const [i, j] = cells[n];
    const ox = HEARTH_X + CELL * i;
    const oy = HEARTH_Y + CELL * j;
    if (typeof entry === 'string') plots.push({ type: entry, x: ox, y: oy });
    else entry.forEach((type, k) => plots.push({ type, x: ox + (k % 2), y: oy + Math.floor(k / 2) }));
  });
  return plots;
}

export const PLOTS: Plot[] = buildPlots();

/** Road tiles of the planned area: every third row and column between the cells. */
export function isRoad(x: number, y: number): boolean {
  const lo = HEARTH_X - CELL * RINGS - 1;
  const hi = HEARTH_X + CELL * RINGS + 2;
  if (x < lo || y < lo || x > hi || y > hi) return false;
  return (x - HEARTH_X) % CELL === 2 || (x - HEARTH_X) % CELL === -1 || (y - HEARTH_Y) % CELL === 2 || (y - HEARTH_Y) % CELL === -1;
}

/** True for tiles inside a plot of the plan (or the hearth). */
export function isPlotTile(x: number, y: number, sizeOf: (type: string) => number): boolean {
  if (x >= HEARTH_X && y >= HEARTH_Y && x < HEARTH_X + 2 && y < HEARTH_Y + 2) return true;
  return PLOTS.some((p) => {
    const n = sizeOf(p.type);
    return x >= p.x && y >= p.y && x < p.x + n && y < p.y + n;
  });
}
