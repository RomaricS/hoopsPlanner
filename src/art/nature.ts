import { baobab } from './buildings';
import {
  boulder,
  diamondPath,
  ellipse,
  foliage,
  makeCanvas,
  outline,
  rand,
  rr,
  shade,
  shadow,
  speckle,
  srand,
  THP,
  TWP,
  type Ctx,
  type TexInfo,
} from './paint';

function tex(key: string, w: number, h: number, oy: number, draw: (ctx: Ctx, ax: number, ay: number) => void, seed: number): TexInfo {
  const [canvas, ctx] = makeCanvas(w, h);
  srand(seed);
  draw(ctx, w / 2, oy);
  return { key, w, h, ox: w / 2, oy, canvas };
}

// ---------------------------------------------------------------- terrain atlas

export const TILE_COLORS = ['#a4ad4c', '#cbb264', '#bb8c5a', '#e2c995', '#3f8fb8'];
export const TILE_VARIANTS = 4;
export const TILE_FRAME_W = TWP + 4;
export const TILE_FRAME_H = THP + 4;

/** One canvas holding every terrain tile variant so the ground renders in one batch. */
export function paintTerrainAtlas(): { canvas: HTMLCanvasElement; frames: { name: string; x: number; y: number }[] } {
  const cols = TILE_VARIANTS;
  const rows = TILE_COLORS.length + 1;
  const [canvas, ctx] = makeCanvas(cols * TILE_FRAME_W, rows * TILE_FRAME_H + 80);
  const frames: { name: string; x: number; y: number }[] = [];
  TILE_COLORS.forEach((base, t) => {
    for (let v = 0; v < cols; v++) {
      const x = v * TILE_FRAME_W;
      const y = t * TILE_FRAME_H;
      srand(1000 + t * 31 + v * 7);
      const cx = x + TILE_FRAME_W / 2;
      const cy = y + TILE_FRAME_H / 2;
      ctx.save();
      diamondPath(ctx, cx, cy, 0.508, 0.508);
      ctx.clip();
      paintTile(ctx, cx, cy, t, base, v);
      ctx.restore();
      frames.push({ name: `t${t}_${v}`, x, y });
    }
  });
  // Earth cliff faces for the map border.
  const ey = rows * TILE_FRAME_H - TILE_FRAME_H;
  const sides: [string, number][] = [
    ['side_l', 0],
    ['side_r', 1],
  ];
  for (const [name, i] of sides) {
    const x = i * TILE_FRAME_W;
    const y = ey;
    srand(77 + i);
    ctx.beginPath();
    if (i === 0) {
      ctx.moveTo(x + 2, y + 2);
      ctx.lineTo(x + 2 + TWP / 2, y + 2 + THP / 2);
      ctx.lineTo(x + 2 + TWP / 2, y + 2 + THP / 2 + 60);
      ctx.lineTo(x + 2, y + 2 + 60);
    } else {
      ctx.moveTo(x + 2 + TWP / 2, y + 2);
      ctx.lineTo(x + 2, y + 2 + THP / 2);
      ctx.lineTo(x + 2, y + 2 + THP / 2 + 60);
      ctx.lineTo(x + 2 + TWP / 2, y + 2 + 60);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, y, 0, y + THP / 2 + 60);
    g.addColorStop(0, i === 0 ? '#9a6a3e' : '#7a5030');
    g.addColorStop(1, i === 0 ? '#5e3c22' : '#4a2e1a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    speckle(ctx, x, y, TWP / 2 + 4, THP / 2 + 64, ['rgba(40,20,10,0.4)', 'rgba(200,150,100,0.3)'], 120, 4);
    ctx.strokeStyle = 'rgba(40,20,10,0.35)';
    ctx.lineWidth = 2;
    for (let k = 1; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(x, y + k * 18 + (i === 0 ? 0 : THP / 2));
      ctx.lineTo(x + TWP / 2 + 4, y + k * 18 + (i === 0 ? THP / 2 : 0));
      ctx.stroke();
    }
    ctx.restore();
    frames.push({ name, x, y });
  }
  return { canvas, frames };
}

function paintTile(ctx: Ctx, cx: number, cy: number, t: number, base: string, v: number) {
  const x0 = cx - TWP / 2 - 4;
  const y0 = cy - THP / 2 - 4;
  const w = TWP + 8;
  const h = THP + 8;
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  if (t === 4) {
    const g = ctx.createLinearGradient(x0, y0, x0 + w, y0 + h);
    g.addColorStop(0, '#4b9cc4');
    g.addColorStop(1, '#2f7aa6');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 4; i++) {
      const wx = x0 + rr(30, w - 60);
      const wy = y0 + rr(20, h - 20);
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.quadraticCurveTo(wx + 12, wy - 5, wx + 24, wy);
      ctx.quadraticCurveTo(wx + 36, wy + 5, wx + 48, wy);
      ctx.stroke();
    }
    return;
  }
  // Soft blotches.
  for (let i = 0; i < 10; i++) {
    const bx = x0 + rand() * w;
    const by = y0 + rand() * h;
    const r = rr(20, 50);
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, r);
    const c = rand() > 0.5 ? shade(base, 0.12, 0.5) : shade(base, -0.12, 0.5);
    g.addColorStop(0, c);
    g.addColorStop(1, shade(base, 0, 0));
    ctx.fillStyle = g;
    ctx.fillRect(bx - r, by - r, r * 2, r * 2);
  }
  speckle(ctx, x0, y0, w, h, [shade(base, -0.2, 0.6), shade(base, 0.2, 0.6)], 140, 2.5);
  if (t === 0 || t === 1) {
    // Grass blades.
    const blade = t === 0 ? ['#7c8a32', '#c3c56a', '#8f9a3c'] : ['#a88c42', '#e2cf86', '#b99a4c'];
    for (let i = 0; i < 70 + v * 10; i++) {
      const gx = x0 + rand() * w;
      const gy = y0 + rand() * h;
      ctx.strokeStyle = blade[Math.floor(rand() * blade.length)];
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + rr(-3, 3), gy - rr(5, 10));
      ctx.stroke();
    }
  } else if (t === 2) {
    ctx.strokeStyle = 'rgba(110,70,40,0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      let px = x0 + rand() * w;
      let py = y0 + rand() * h;
      ctx.beginPath();
      ctx.moveTo(px, py);
      for (let k = 0; k < 4; k++) {
        px += rr(-14, 14);
        py += rr(-6, 6);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  } else if (t === 3) {
    for (let i = 0; i < 14; i++) {
      ellipse(ctx, x0 + rand() * w, y0 + rand() * h, rr(2, 4), rr(1.5, 3));
      ctx.fillStyle = rand() > 0.5 ? '#c4a978' : '#f1dfb4';
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- nodes and decor

function acacia(ctx: Ctx, cx: number, by: number, s: number) {
  shadow(ctx, cx + 40 * s, by + 6 * s, 110 * s, 40 * s, 0.35);
  // Forked trunk.
  ctx.strokeStyle = 'rgba(40,22,10,0.9)';
  ctx.lineWidth = 16 * s;
  const trunk = () => {
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.quadraticCurveTo(cx - 6 * s, by - 60 * s, cx + 4 * s, by - 100 * s);
    ctx.moveTo(cx + 2 * s, by - 80 * s);
    ctx.quadraticCurveTo(cx - 30 * s, by - 120 * s, cx - 64 * s, by - 150 * s);
    ctx.moveTo(cx + 4 * s, by - 100 * s);
    ctx.quadraticCurveTo(cx + 30 * s, by - 130 * s, cx + 58 * s, by - 152 * s);
    ctx.moveTo(cx + 2 * s, by - 96 * s);
    ctx.lineTo(cx + 4 * s, by - 160 * s);
  };
  trunk();
  ctx.stroke();
  ctx.strokeStyle = '#5e4330';
  ctx.lineWidth = 11 * s;
  trunk();
  ctx.stroke();
  // Flat umbrella crown in two layers.
  foliage(ctx, cx, by - 160 * s, 230 * s, 70 * s, '#6f8f2c', 22, true);
  foliage(ctx, cx - 10 * s, by - 178 * s, 170 * s, 50 * s, '#86a338', 14, true);
}

function palm(ctx: Ctx, cx: number, by: number, s: number) {
  shadow(ctx, cx + 30 * s, by + 4, 70 * s, 26 * s, 0.3);
  ctx.strokeStyle = 'rgba(40,22,10,0.9)';
  ctx.lineWidth = 15 * s;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx, by);
    ctx.quadraticCurveTo(cx + 26 * s, by - 90 * s, cx + 10 * s, by - 180 * s);
  };
  path();
  ctx.stroke();
  ctx.strokeStyle = '#8a6a48';
  ctx.lineWidth = 11 * s;
  path();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(60,40,20,0.6)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) {
    const t = i / 10;
    const x = cx + 2 * (1 - t) * t * 26 * s + t * t * 10 * s;
    const y = by - 2 * (1 - t) * t * 90 * s - t * t * 180 * s;
    ctx.beginPath();
    ctx.moveTo(x - 6 * s, y);
    ctx.lineTo(x + 6 * s, y - 3);
    ctx.stroke();
  }
  const tx = cx + 10 * s;
  const ty = by - 180 * s;
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI + rr(-0.1, 0.1);
    const len = rr(60, 80) * s;
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + 24 * s;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo((tx + ex) / 2, ty - 26 * s, ex, ey);
    ctx.quadraticCurveTo((tx + ex) / 2, ty - 6 * s, tx, ty);
    ctx.fillStyle = i % 2 ? '#6f9a3a' : '#5a8530';
    ctx.fill();
    outline(ctx, 'rgba(30,40,10,0.7)', 2);
  }
}

function bush(ctx: Ctx, cx: number, by: number, berries: boolean) {
  shadow(ctx, cx + 10, by + 4, 60, 22);
  foliage(ctx, cx, by - 34, 110, 70, '#5f8a2e', 16);
  if (berries) {
    for (let i = 0; i < 16; i++) {
      const x = cx + rr(-42, 42);
      const y = by - 34 + rr(-24, 18);
      ellipse(ctx, x, y, 5, 5);
      ctx.fillStyle = rand() > 0.4 ? '#c0182f' : '#e2502e';
      ctx.fill();
      ellipse(ctx, x - 1.5, y - 1.5, 1.5, 1.5);
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fill();
    }
  }
}

function rocks(ctx: Ctx, cx: number, by: number) {
  shadow(ctx, cx + 14, by + 6, 90, 34);
  boulder(ctx, cx - 30, by - 6, 74, 70, '#a6a094');
  boulder(ctx, cx + 30, by - 2, 86, 92, '#9c968a');
  boulder(ctx, cx - 4, by + 18, 70, 42, '#b0aa9e');
  // Lichen.
  for (let i = 0; i < 10; i++) {
    ellipse(ctx, cx + rr(-50, 50), by - rr(10, 70), rr(3, 6), rr(2, 4));
    ctx.fillStyle = rand() > 0.5 ? 'rgba(200,170,60,0.6)' : 'rgba(140,150,70,0.6)';
    ctx.fill();
  }
}

function stump(ctx: Ctx, cx: number, by: number) {
  shadow(ctx, cx + 6, by + 2, 34, 14);
  ctx.beginPath();
  ctx.moveTo(cx - 18, by);
  ctx.lineTo(cx - 16, by - 26);
  ctx.lineTo(cx + 16, by - 26);
  ctx.lineTo(cx + 18, by);
  ctx.closePath();
  ctx.fillStyle = '#5e4330';
  ctx.fill();
  outline(ctx, undefined, 2);
  ellipse(ctx, cx, by - 26, 16, 7);
  ctx.fillStyle = '#d4a46a';
  ctx.fill();
  outline(ctx, undefined, 2);
  // Sapling.
  foliage(ctx, cx + 22, by - 14, 30, 22, '#7aa03a', 4);
}

function termiteMound(ctx: Ctx, cx: number, by: number) {
  shadow(ctx, cx + 10, by + 4, 50, 18);
  ctx.beginPath();
  ctx.moveTo(cx - 34, by);
  ctx.quadraticCurveTo(cx - 26, by - 50, cx - 10, by - 70);
  ctx.quadraticCurveTo(cx - 4, by - 110, cx + 4, by - 112);
  ctx.quadraticCurveTo(cx + 12, by - 80, cx + 14, by - 64);
  ctx.quadraticCurveTo(cx + 24, by - 60, cx + 26, by - 40);
  ctx.quadraticCurveTo(cx + 34, by - 20, cx + 34, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - 34, 0, cx + 34, 0);
  g.addColorStop(0, '#c98a52');
  g.addColorStop(1, '#7e4a26');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, undefined, 2.5);
}

function tuft(ctx: Ctx, cx: number, by: number, color: string) {
  for (let i = 0; i < 14; i++) {
    ctx.strokeStyle = rand() > 0.5 ? color : shade(color, 0.25);
    ctx.lineWidth = 2;
    const a = -Math.PI / 2 + rr(-0.7, 0.7);
    const len = rr(14, 28);
    ctx.beginPath();
    ctx.moveTo(cx + rr(-8, 8), by);
    ctx.quadraticCurveTo(cx + Math.cos(a) * len * 0.3, by - len * 0.6, cx + Math.cos(a) * len, by + Math.sin(a) * len);
    ctx.stroke();
  }
}

function skull(ctx: Ctx, cx: number, by: number) {
  ellipse(ctx, cx, by - 6, 10, 7);
  ctx.fillStyle = '#efe6d2';
  ctx.fill();
  outline(ctx, undefined, 1.5);
  ctx.strokeStyle = '#efe6d2';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - 8, by - 10);
  ctx.quadraticCurveTo(cx - 24, by - 14, cx - 22, by - 28);
  ctx.moveTo(cx + 8, by - 10);
  ctx.quadraticCurveTo(cx + 24, by - 14, cx + 22, by - 28);
  ctx.stroke();
}

export function paintNature(): TexInfo[] {
  return [
    tex('n_acacia', 300, 300, 260, (c, x, y) => acacia(c, x, y, 1), 11),
    tex('n_acacia2', 300, 300, 260, (c, x, y) => acacia(c, x, y, 0.85), 12),
    tex('n_baobab', 330, 360, 320, (c, x, y) => baobab(c, x, y, 1), 13),
    tex('n_palm', 240, 270, 240, (c, x, y) => palm(c, x, y, 1), 14),
    tex('n_bush', 160, 120, 100, (c, x, y) => bush(c, x, y, true), 15),
    tex('n_bush_empty', 160, 120, 100, (c, x, y) => bush(c, x, y, false), 15),
    tex('n_rock', 220, 150, 120, (c, x, y) => rocks(c, x, y), 16),
    tex('n_rubble', 120, 60, 44, (c, x, y) => {
      for (let i = 0; i < 6; i++) boulder(c, x + rr(-30, 30), y + rr(-6, 8), rr(12, 20), rr(8, 12), '#a39d90');
    }, 17),
    tex('n_stump', 120, 80, 64, (c, x, y) => stump(c, x, y), 18),
    tex('d_termite', 110, 140, 124, (c, x, y) => termiteMound(c, x, y), 19),
    tex('d_tuft', 70, 50, 40, (c, x, y) => tuft(c, x, y, '#8f9a3c'), 20),
    tex('d_tuft_dry', 70, 50, 40, (c, x, y) => tuft(c, x, y, '#bfa452'), 21),
    tex('d_skull', 70, 50, 40, (c, x, y) => skull(c, x, y), 22),
    tex('d_flowers', 70, 40, 30, (c, x, y) => {
      for (let i = 0; i < 7; i++) {
        ellipse(c, x + rr(-24, 24), y + rr(-8, 8), 4, 3);
        c.fillStyle = ['#f2c94c', '#e2502e', '#f4f1e8'][i % 3];
        c.fill();
      }
    }, 23),
    tex('d_pebbles', 70, 40, 30, (c, x, y) => {
      for (let i = 0; i < 5; i++) boulder(c, x + rr(-22, 22), y + rr(-6, 6), rr(8, 12), rr(5, 8), '#b0aa9e');
    }, 24),
  ];
}
