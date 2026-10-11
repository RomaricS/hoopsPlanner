/**
 * Canvas painting helpers for the procedural art. All textures are painted at 2x
 * (a tile is 256 x 128 px) and displayed at 0.5 scale so they stay crisp when zoomed.
 */
export const TWP = 256;
export const THP = 128;
export const ART_SCALE = 0.5;

export type Ctx = CanvasRenderingContext2D;

export interface TexInfo {
  key: string;
  w: number;
  h: number;
  /** Anchor (ground centre of the footprint) in texture pixels. */
  ox: number;
  oy: number;
  canvas: HTMLCanvasElement;
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

// ---------------------------------------------------------------- colour

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgb(r: number, g: number, b: number, a = 1) {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return a >= 1 ? `rgb(${c(r)},${c(g)},${c(b)})` : `rgba(${c(r)},${c(g)},${c(b)},${a})`;
}

/** Lighten (amt > 0) or darken (amt < 0) a colour; amt in -1..1. */
export function shade(hex: string, amt: number, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  if (amt >= 0) return rgb(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt, alpha);
  return rgb(r * (1 + amt), g * (1 + amt), b * (1 + amt), alpha);
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgb(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}

// ---------------------------------------------------------------- random

let seed = 1;
export function srand(s: number) {
  seed = s >>> 0 || 1;
}
export function rand(): number {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return ((seed >>> 0) % 100000) / 100000;
}
export function rr(a: number, b: number) {
  return a + rand() * (b - a);
}

// ---------------------------------------------------------------- iso geometry

/** Screen offset of moving (dx, dy) tiles from a point, in texture px. */
export function iso(dx: number, dy: number): [number, number] {
  return [(dx - dy) * (TWP / 2), (dx + dy) * (THP / 2)];
}

export function diamondPath(ctx: Ctx, cx: number, cy: number, a: number, b: number) {
  // a, b are half-extents in tiles along x and y.
  const [tx, ty] = iso(-a, -b);
  const [rx, ry] = iso(a, -b);
  const [bx, by] = iso(a, b);
  const [lx, ly] = iso(-a, b);
  ctx.beginPath();
  ctx.moveTo(cx + tx, cy + ty);
  ctx.lineTo(cx + rx, cy + ry);
  ctx.lineTo(cx + bx, cy + by);
  ctx.lineTo(cx + lx, cy + ly);
  ctx.closePath();
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
}

/** Soft contact shadow, cast down-right (sun from the upper left). */
export function shadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.32) {
  ctx.save();
  const g = ctx.createRadialGradient(cx + rx * 0.15, cy + ry * 0.1, 0, cx + rx * 0.15, cy + ry * 0.1, rx);
  g.addColorStop(0, `rgba(30,18,8,${alpha})`);
  g.addColorStop(0.65, `rgba(30,18,8,${alpha * 0.6})`);
  g.addColorStop(1, 'rgba(30,18,8,0)');
  ctx.fillStyle = g;
  ctx.translate(cx + rx * 0.15, cy + ry * 0.1);
  ctx.scale(1, ry / rx);
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function outline(ctx: Ctx, color = 'rgba(40,22,10,0.85)', width = 3) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

/** Speckles inside the current clip to give surfaces texture. */
export function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, colors: string[], count: number, size = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const s = size * rr(0.6, 1.4);
    ctx.fillRect(x + rand() * w, y + rand() * h, s, s * 0.8);
  }
}

/**
 * Upright cylinder (mud walls, granary bodies). Base ellipse centred at (cx, by).
 */
export function cylinder(ctx: Ctx, cx: number, by: number, rx: number, ry: number, h: number, color: string, opts: { texture?: boolean } = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - rx, by - h);
  ctx.lineTo(cx - rx, by);
  ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, by - h);
  ctx.ellipse(cx, by - h, rx, ry, 0, 0, Math.PI, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, shade(color, 0.12));
  g.addColorStop(0.35, shade(color, 0.05));
  g.addColorStop(0.75, shade(color, -0.22));
  g.addColorStop(1, shade(color, -0.38));
  ctx.fillStyle = g;
  ctx.fill();
  if (opts.texture !== false) {
    ctx.clip();
    speckle(ctx, cx - rx, by - h - ry, rx * 2, h + ry * 2, [shade(color, -0.15, 0.5), shade(color, 0.15, 0.5)], (rx * h) / 25, 3);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - rx, by - h);
  ctx.lineTo(cx - rx, by);
  ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, by - h);
  outline(ctx);
}

/** Conical thatched roof with straw strokes. Rim ellipse centred at (cx, by). */
export function thatchCone(ctx: Ctx, cx: number, by: number, rx: number, ry: number, h: number, color = '#c99a4e') {
  const apexX = cx;
  const apexY = by - h;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(cx - rx, by);
  ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx, apexY, cx + rx, by);
  g.addColorStop(0, shade(color, 0.22));
  g.addColorStop(0.45, color);
  g.addColorStop(1, shade(color, -0.4));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();
  // Straw strokes radiating from the apex.
  for (let i = 0; i < 70; i++) {
    const t = rand();
    const ex = cx - rx + t * rx * 2;
    const ey = by + Math.sin(Math.acos(Math.max(-1, Math.min(1, (ex - cx) / rx)))) * ry;
    const len = rr(0.35, 1);
    ctx.strokeStyle = rand() > 0.5 ? shade(color, -0.3, 0.55) : shade(color, 0.3, 0.45);
    ctx.lineWidth = rr(1.2, 2.4);
    ctx.beginPath();
    ctx.moveTo(apexX + (ex - apexX) * (1 - len), apexY + (ey - apexY) * (1 - len));
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  // Tied bands.
  for (const f of [0.38, 0.7]) {
    ctx.strokeStyle = shade(color, -0.45, 0.6);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, apexY + (by - apexY) * f, rx * f, ry * f, 0, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  // Ragged rim.
  ctx.beginPath();
  ctx.moveTo(apexX, apexY);
  ctx.lineTo(cx - rx, by);
  ctx.ellipse(cx, by, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  outline(ctx);
  ctx.strokeStyle = shade(color, -0.5, 0.7);
  ctx.lineWidth = 2;
  for (let a = 0.05; a < Math.PI; a += 0.09) {
    const x = cx + Math.cos(a) * rx;
    const y = by + Math.sin(a) * ry;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x + rr(-2, 2), y + rr(3, 7));
    ctx.stroke();
  }
  // Finial.
  ctx.fillStyle = shade(color, -0.35);
  ellipse(ctx, apexX, apexY + 2, 5, 4);
  ctx.fill();
}

/**
 * Iso box: footprint half extents a (along x) and b (along y) in tiles, height h px.
 * Ground centre at (cx, cy). Returns the top face centre.
 */
export function box(ctx: Ctx, cx: number, cy: number, a: number, b: number, h: number, color: string, opts: { top?: string; texture?: boolean; outlineColor?: string } = {}) {
  const [rx, ry] = iso(a, -b);
  const [bx, by] = iso(a, b);
  const [lx, ly] = iso(-a, b);
  const [tx, ty] = iso(-a, -b);
  // Left face (+y side).
  ctx.beginPath();
  ctx.moveTo(cx + lx, cy + ly);
  ctx.lineTo(cx + bx, cy + by);
  ctx.lineTo(cx + bx, cy + by - h);
  ctx.lineTo(cx + lx, cy + ly - h);
  ctx.closePath();
  ctx.fillStyle = shade(color, -0.08);
  ctx.fill();
  if (opts.texture !== false) {
    ctx.save();
    ctx.clip();
    speckle(ctx, cx + lx, cy + ly - h, bx - lx, by - ly + h, [shade(color, -0.25, 0.5), shade(color, 0.12, 0.5)], Math.abs((bx - lx) * h) / 30, 3);
    ctx.restore();
  }
  outline(ctx, opts.outlineColor);
  // Right face (+x side).
  ctx.beginPath();
  ctx.moveTo(cx + bx, cy + by);
  ctx.lineTo(cx + rx, cy + ry);
  ctx.lineTo(cx + rx, cy + ry - h);
  ctx.lineTo(cx + bx, cy + by - h);
  ctx.closePath();
  ctx.fillStyle = shade(color, -0.32);
  ctx.fill();
  if (opts.texture !== false) {
    ctx.save();
    ctx.clip();
    speckle(ctx, cx + bx, cy + ry - h, rx - bx, by - ry + h, [shade(color, -0.45, 0.5), shade(color, -0.15, 0.5)], Math.abs((rx - bx) * h) / 30, 3);
    ctx.restore();
  }
  outline(ctx, opts.outlineColor);
  // Top.
  ctx.beginPath();
  ctx.moveTo(cx + tx, cy + ty - h);
  ctx.lineTo(cx + rx, cy + ry - h);
  ctx.lineTo(cx + bx, cy + by - h);
  ctx.lineTo(cx + lx, cy + ly - h);
  ctx.closePath();
  ctx.fillStyle = opts.top ?? shade(color, 0.14);
  ctx.fill();
  outline(ctx, opts.outlineColor);
  return [cx, cy - h] as const;
}

/** Simple quadratic-curve log lying on the ground. */
export function log(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, r: number, color = '#7a4b28') {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const nx = Math.sin(ang) * r;
  const ny = -Math.cos(ang) * r;
  ctx.beginPath();
  ctx.moveTo(x1 + nx, y1 + ny);
  ctx.lineTo(x2 + nx, y2 + ny);
  ctx.lineTo(x2 - nx, y2 - ny);
  ctx.lineTo(x1 - nx, y1 - ny);
  ctx.closePath();
  const g = ctx.createLinearGradient(x1 + nx, y1 + ny, x1 - nx, y1 - ny);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, 'rgba(40,22,10,0.8)', 2.5);
  // End grain.
  ellipse(ctx, x2, y2, r * 0.75, r);
  ctx.fillStyle = '#d9a86a';
  ctx.fill();
  outline(ctx, 'rgba(40,22,10,0.8)', 2);
  ctx.strokeStyle = 'rgba(120,70,30,0.6)';
  ctx.lineWidth = 1.5;
  ellipse(ctx, x2, y2, r * 0.4, r * 0.55);
  ctx.stroke();
}

/** Rounded boulder. */
export function boulder(ctx: Ctx, cx: number, by: number, w: number, h: number, color = '#9c968c') {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, by);
  ctx.bezierCurveTo(cx - w / 2 - w * 0.08, by - h * 0.7, cx - w * 0.2, by - h * 1.05, cx + w * 0.05, by - h);
  ctx.bezierCurveTo(cx + w * 0.38, by - h * 0.95, cx + w / 2 + w * 0.05, by - h * 0.5, cx + w / 2, by);
  ctx.quadraticCurveTo(cx, by + h * 0.18, cx - w / 2, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - w / 2, by - h, cx + w / 2, by);
  g.addColorStop(0, shade(color, 0.3));
  g.addColorStop(0.5, color);
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, cx - w / 2, by - h, w, h * 1.2, [shade(color, -0.3, 0.6), shade(color, 0.35, 0.6)], (w * h) / 40, 2.5);
  // Crack.
  ctx.strokeStyle = shade(color, -0.45, 0.6);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.1, by - h * 0.9);
  ctx.lineTo(cx + w * 0.02, by - h * 0.55);
  ctx.lineTo(cx + w * 0.14, by - h * 0.3);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, by);
  ctx.bezierCurveTo(cx - w / 2 - w * 0.08, by - h * 0.7, cx - w * 0.2, by - h * 1.05, cx + w * 0.05, by - h);
  ctx.bezierCurveTo(cx + w * 0.38, by - h * 0.95, cx + w / 2 + w * 0.05, by - h * 0.5, cx + w / 2, by);
  ctx.quadraticCurveTo(cx, by + h * 0.18, cx - w / 2, by);
  outline(ctx);
}

/** Zigzag band of painted triangles, Ndebele / Sotho style, wrapped on a cylinder front. */
export function paintedBand(ctx: Ctx, cx: number, y: number, rx: number, ry: number, bandH: number, colors: string[]) {
  const n = 9;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI - (i / n) * Math.PI;
    const a1 = Math.PI - ((i + 1) / n) * Math.PI;
    const x0 = cx + Math.cos(a0) * rx * 0.97;
    const x1 = cx + Math.cos(a1) * rx * 0.97;
    const y0 = y + Math.sin(a0) * ry;
    const y1 = y + Math.sin(a1) * ry;
    const xm = (x0 + x1) / 2;
    const ym = (y0 + y1) / 2;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    if (i % 2 === 0) {
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.lineTo(xm, ym - bandH);
    } else {
      ctx.moveTo(x0, y0 - bandH);
      ctx.lineTo(x1, y1 - bandH);
      ctx.lineTo(xm, ym);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(40,22,10,0.6)';
  ctx.lineWidth = 2;
  for (const off of [0, -bandH]) {
    ctx.beginPath();
    ctx.ellipse(cx, y + off, rx * 0.98, ry, 0, 0, Math.PI);
    ctx.stroke();
  }
}

/** Arched doorway on a cylinder or wall. */
export function doorway(ctx: Ctx, x: number, by: number, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, by);
  ctx.lineTo(x - w / 2, by - h + w / 2);
  ctx.arc(x, by - h + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w / 2, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, by - h, 0, by);
  g.addColorStop(0, '#1d120a');
  g.addColorStop(1, '#3a2414');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, 'rgba(30,16,8,0.9)', 2.5);
}

/** Pointed wooden stake. */
export function stake(ctx: Ctx, x: number, by: number, h: number, w = 9, color = '#8b5a2b') {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, by);
  ctx.lineTo(x - w / 2, by - h + w);
  ctx.lineTo(x, by - h);
  ctx.lineTo(x + w / 2, by - h + w);
  ctx.lineTo(x + w / 2, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, 'rgba(40,22,10,0.85)', 2);
}

/** Leafy blob cluster used for bushes and acacia crowns. */
export function foliage(ctx: Ctx, cx: number, cy: number, w: number, h: number, color: string, blobs = 14, flat = false) {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < blobs; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand());
    pts.push([cx + Math.cos(a) * d * w * 0.42, cy + Math.sin(a) * d * h * (flat ? 0.3 : 0.4), rr(0.16, 0.26) * w * (flat ? 0.8 : 1)]);
  }
  pts.sort((p, q) => p[1] - q[1]);
  // Dark underlayer for depth.
  for (const [x, y, r] of pts) {
    ellipse(ctx, x, y + r * 0.25, r * 1.08, r * (flat ? 0.55 : 0.85));
    ctx.fillStyle = shade(color, -0.45);
    ctx.fill();
  }
  for (const [x, y, r] of pts) {
    const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r);
    g.addColorStop(0, shade(color, 0.28));
    g.addColorStop(0.6, color);
    g.addColorStop(1, shade(color, -0.25));
    ellipse(ctx, x, y, r, r * (flat ? 0.5 : 0.8));
    ctx.fillStyle = g;
    ctx.fill();
  }
}
