import { BUILDINGS } from '../data/buildings';

/** World units: a tile is 128 x 64. */
export const TW = 128;
export const TH = 64;

/** World position of the centre of tile (x, y); fractional tiles are fine. */
export function tileToWorld(x: number, y: number): { x: number; y: number } {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}

/** Fractional tile coordinates of a world point. */
export function worldToTile(wx: number, wy: number): { x: number; y: number } {
  const a = wx / (TW / 2);
  const b = wy / (TH / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** World position of the ground centre of a building footprint. */
export function footprintCenter(type: string, x: number, y: number) {
  const n = BUILDINGS[type].size;
  return tileToWorld(x + (n - 1) / 2, y + (n - 1) / 2);
}

/** Depth for anything standing at fractional tile (x, y). */
export function depthAt(x: number, y: number): number {
  return 1000 + (x + y) * 10;
}
