import { fbm, mulberry32 } from './rng';
import type { NodeKind, NodeState } from './state';
import { Tile } from './state';

const NODE_AMOUNT: Record<NodeKind, number> = { acacia: 30, baobab: 60, palm: 25, bush: 25, rock: 40 };

export function nodeMax(kind: NodeKind) {
  return NODE_AMOUNT[kind];
}

/**
 * Builds a savanna: golden grass with greener patches, a river with sandy banks
 * along one side, a pond, scattered acacias, baobabs, berry bushes and granite kopjes.
 * The area around the hearth is kept clear, with a few starter nodes nearby.
 */
export function generateWorld(seed: number, size: number, hearth: { x: number; y: number }) {
  const rnd = mulberry32(seed);
  const terrain: Tile[] = new Array(size * size).fill(Tile.Grass);
  const cx = hearth.x + 1;
  const cy = hearth.y + 1;
  const water = new Uint8Array(size * size);

  // River: meanders along x at roughly y = cy + 14, crossing the whole map.
  const riverBase = cy + 13 + Math.floor(rnd() * 3);
  const phase = rnd() * Math.PI * 2;
  for (let x = 0; x < size; x++) {
    const center = riverBase + Math.sin(x * 0.18 + phase) * 2.5 + Math.sin(x * 0.07 + phase * 2) * 2;
    const half = 1.1 + (fbm(x * 0.2, 3, seed + 9) - 0.5) * 1.2;
    for (let y = 0; y < size; y++) if (Math.abs(y - center) <= half) water[y * size + x] = 1;
  }

  // Pond to the north-west of the hearth.
  const px = cx - 8 - Math.floor(rnd() * 3);
  const py = cy - 6 - Math.floor(rnd() * 3);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const d = Math.hypot((x - px) * 0.9, y - py) + (fbm(x * 0.4, y * 0.4, seed + 3) - 0.5) * 1.6;
      if (d < 2.4) water[y * size + x] = 1;
    }

  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (water[i]) {
        terrain[i] = Tile.Water;
        continue;
      }
      let nearWater = false;
      for (let dy = -1; dy <= 1 && !nearWater; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size && water[ny * size + nx]) {
            nearWater = true;
            break;
          }
        }
      if (nearWater) {
        terrain[i] = Tile.Sand;
        continue;
      }
      const m = fbm(x * 0.09, y * 0.09, seed, 4);
      const d = fbm(x * 0.25, y * 0.25, seed + 41, 2);
      const distC = Math.hypot(x - cx, y - cy);
      if (distC < 2.6) terrain[i] = Tile.Dirt;
      else if (d > 0.7) terrain[i] = Tile.Dirt;
      else if (m > 0.56) terrain[i] = Tile.Grass;
      else terrain[i] = Tile.DryGrass;
    }

  const nodes: Omit<NodeState, 'uid'>[] = [];
  const taken = new Set<number>();
  const free = (x: number, y: number) =>
    x >= 1 && y >= 1 && x < size - 1 && y < size - 1 && terrain[y * size + x] !== Tile.Water && !taken.has(y * size + x);
  const inClearing = (x: number, y: number) => Math.max(Math.abs(x - cx + 0.5), Math.abs(y - cy + 0.5)) < 3.5;
  const place = (kind: NodeKind, x: number, y: number) => {
    if (!free(x, y) || inClearing(x, y)) return false;
    taken.add(y * size + x);
    nodes.push({ kind, x, y, amount: NODE_AMOUNT[kind], max: NODE_AMOUNT[kind] });
    return true;
  };

  // Starter nodes close to the hearth so the first minutes are about tapping.
  const starters: [NodeKind, number, number][] = [
    ['acacia', cx + 3, cy - 2],
    ['acacia', cx - 4, cy + 2],
    ['acacia', cx + 1, cy + 4],
    ['bush', cx - 3, cy - 3],
    ['bush', cx + 4, cy + 2],
    ['rock', cx - 2, cy + 5],
    ['rock', cx + 5, cy - 4],
  ];
  for (const [k, x, y] of starters) place(k, x, y);

  // Kopjes: clusters of granite boulders.
  for (let k = 0; k < 9; k++) {
    const kx = Math.floor(rnd() * size);
    const ky = Math.floor(rnd() * size);
    if (Math.hypot(kx - cx, ky - cy) < 7) continue;
    const n = 3 + Math.floor(rnd() * 5);
    for (let j = 0; j < n; j++) place('rock', kx + Math.floor(rnd() * 4 - 2), ky + Math.floor(rnd() * 4 - 2));
  }

  for (let y = 1; y < size - 1; y++)
    for (let x = 1; x < size - 1; x++) {
      const t = terrain[y * size + x];
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < 6) continue;
      const r = rnd();
      const lush = fbm(x * 0.12, y * 0.12, seed + 77, 2);
      if (t === Tile.Sand) {
        if (r < 0.1) place('palm', x, y);
      } else if (t === Tile.Grass || t === Tile.DryGrass) {
        const treeChance = 0.025 + lush * 0.06;
        if (r < treeChance) place('acacia', x, y);
        else if (r < treeChance + 0.006) place('baobab', x, y);
        else if (r < treeChance + 0.03 && t === Tile.Grass) place('bush', x, y);
      }
    }

  return { terrain, nodes };
}
