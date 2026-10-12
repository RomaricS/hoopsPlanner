import {
  boulder,
  box,
  cylinder,
  diamondPath,
  doorway,
  ellipse,
  foliage,
  iso,
  log,
  makeCanvas,
  outline,
  paintedBand,
  rand,
  rr,
  shade,
  shadow,
  speckle,
  srand,
  stake,
  thatchCone,
  THP,
  TWP,
  type Ctx,
  type TexInfo,
} from './paint';

const MUD = '#b8693a';
const MUD_LIGHT = '#c98a52';
const LIME = '#e9dcc0';
const THATCH = '#c99a4e';
const STONE = '#a29d92';

/** Texture with room for an n x n footprint plus `top` px of height. */
function tex(key: string, n: number, top: number, draw: (ctx: Ctx, ax: number, ay: number) => void, seed = 1): TexInfo {
  const w = n * TWP + 48;
  const h = n * THP + top + 24;
  const [canvas, ctx] = makeCanvas(w, h);
  const ax = w / 2;
  const ay = h - 12 - (n * THP) / 2;
  srand(seed * 7919 + key.length * 31);
  draw(ctx, ax, ay);
  return { key, w, h, ox: ax, oy: ay, canvas };
}

/** Packed-earth pad under a building. */
function pad(ctx: Ctx, ax: number, ay: number, n: number, color = '#b48a5a') {
  const e = (n / 2) * 0.94;
  diamondPath(ctx, ax, ay + 4, e, e);
  ctx.fillStyle = shade(color, -0.35);
  ctx.fill();
  diamondPath(ctx, ax, ay, e, e);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.save();
  ctx.clip();
  speckle(ctx, ax - n * 128, ay - n * 64, n * 256, n * 128, [shade(color, -0.2, 0.6), shade(color, 0.18, 0.6), '#8a6a44'], n * n * 160, 3);
  ctx.restore();
  diamondPath(ctx, ax, ay, e, e);
  outline(ctx, 'rgba(70,45,20,0.5)', 2);
}

function pt(ax: number, ay: number, dx: number, dy: number): [number, number] {
  const [x, y] = iso(dx, dy);
  return [ax + x, ay + y];
}

// ---------------------------------------------------------------- pieces

function hutBody(ctx: Ctx, cx: number, cy: number, s: number, wall: string, band: string[] | null, roof = THATCH) {
  const rx = 70 * s;
  const ry = 35 * s;
  const h = 62 * s;
  shadow(ctx, cx + 10 * s, cy + 6 * s, rx * 1.35, ry * 1.25);
  cylinder(ctx, cx, cy, rx, ry, h, wall);
  if (band) paintedBand(ctx, cx, cy - h * 0.38, rx, ry, 16 * s, band);
  doorway(ctx, cx - 14 * s, cy + ry * 0.92, 26 * s, 44 * s);
  thatchCone(ctx, cx, cy - h - 6 * s, rx * 1.24, ry * 1.24, 92 * s, roof);
}

/** Open-sided thatched shelter on four poles (a palaver hut). */
function shelter(ctx: Ctx, cx: number, cy: number, s: number) {
  shadow(ctx, cx + 16 * s, cy + 8 * s, 100 * s, 44 * s);
  const e = 0.3 * s;
  const posts = [pt(cx, cy, -e, -e), pt(cx, cy, e, -e), pt(cx, cy, -e, e), pt(cx, cy, e, e)];
  ctx.strokeStyle = '#5b3218';
  ctx.lineWidth = 7 * s;
  for (const [x, y] of posts) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 74 * s);
    ctx.stroke();
  }
  thatchCone(ctx, cx, cy - 70 * s, 112 * s, 56 * s, 78 * s, THATCH);
}

function fireRing(ctx: Ctx, cx: number, cy: number, s = 1) {
  ellipse(ctx, cx, cy, 46 * s, 23 * s);
  ctx.fillStyle = '#3b2a20';
  ctx.fill();
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 36 * s);
  g.addColorStop(0, 'rgba(255,170,60,0.9)');
  g.addColorStop(0.5, 'rgba(200,70,20,0.6)');
  g.addColorStop(1, 'rgba(60,30,20,0)');
  ellipse(ctx, cx, cy, 38 * s, 19 * s);
  ctx.fillStyle = g;
  ctx.fill();
  log(ctx, cx - 26 * s, cy + 4 * s, cx + 10 * s, cy - 6 * s, 6 * s, '#5d3a1e');
  log(ctx, cx + 24 * s, cy + 2 * s, cx - 8 * s, cy - 8 * s, 6 * s, '#5d3a1e');
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const x = cx + Math.cos(a) * 50 * s;
    const y = cy + Math.sin(a) * 25 * s;
    if (Math.sin(a) < 0) boulder(ctx, x, y + 4, rr(16, 22) * s, rr(10, 14) * s, '#8f8a80');
  }
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const x = cx + Math.cos(a) * 50 * s;
    const y = cy + Math.sin(a) * 25 * s;
    if (Math.sin(a) >= 0) boulder(ctx, x, y + 4, rr(16, 22) * s, rr(10, 14) * s, '#9a958a');
  }
}

function drum(ctx: Ctx, cx: number, by: number, s = 1) {
  // Djembe: goblet-shaped wooden drum with a skin head.
  ctx.beginPath();
  ctx.moveTo(cx - 14 * s, by - 46 * s);
  ctx.quadraticCurveTo(cx - 4 * s, by - 22 * s, cx - 7 * s, by - 14 * s);
  ctx.lineTo(cx - 12 * s, by);
  ctx.lineTo(cx + 12 * s, by);
  ctx.lineTo(cx + 7 * s, by - 14 * s);
  ctx.quadraticCurveTo(cx + 4 * s, by - 22 * s, cx + 14 * s, by - 46 * s);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - 14 * s, 0, cx + 14 * s, 0);
  g.addColorStop(0, '#a0612e');
  g.addColorStop(1, '#5b3218');
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, undefined, 2);
  ellipse(ctx, cx, by - 46 * s, 14 * s, 6 * s);
  ctx.fillStyle = '#e8d3a8';
  ctx.fill();
  outline(ctx, undefined, 2);
  ctx.strokeStyle = '#e8d3a8';
  ctx.lineWidth = 1.5;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 5 * s, by - 44 * s);
    ctx.lineTo(cx + i * 3 * s, by - 26 * s);
    ctx.stroke();
  }
}

function shield(ctx: Ctx, cx: number, by: number, s = 1, hide = '#f2ead8', spots = '#3a2414') {
  // Nguni cowhide shield: tall oval with a central stick.
  ctx.save();
  ellipse(ctx, cx, by - 30 * s, 14 * s, 30 * s);
  ctx.fillStyle = hide;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    ellipse(ctx, cx + rr(-12, 12) * s, by - rr(8, 54) * s, rr(5, 9) * s, rr(4, 8) * s);
    ctx.fillStyle = spots;
    ctx.fill();
  }
  ctx.restore();
  ellipse(ctx, cx, by - 30 * s, 14 * s, 30 * s);
  outline(ctx, undefined, 2.5);
  ctx.strokeStyle = '#5b3218';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.moveTo(cx, by - 66 * s);
  ctx.lineTo(cx, by + 4 * s);
  ctx.stroke();
}

function spear(ctx: Ctx, x: number, by: number, h: number, lean = 0.12) {
  const tx = x + h * lean;
  const ty = by - h;
  ctx.strokeStyle = '#6b4220';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, by);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.fillStyle = '#c9cdd2';
  ctx.beginPath();
  const dx = lean * 14;
  ctx.moveTo(tx, ty);
  ctx.lineTo(tx - 4 + dx, ty - 16);
  ctx.lineTo(tx + 4 + dx * 1.5, ty - 28);
  ctx.lineTo(tx + 6 + dx, ty - 14);
  ctx.closePath();
  ctx.fill();
  outline(ctx, undefined, 1.5);
}

function basket(ctx: Ctx, cx: number, by: number, s: number, fill: string) {
  ellipse(ctx, cx, by, 20 * s, 9 * s);
  ctx.fillStyle = 'rgba(40,20,5,0.35)';
  ctx.fill();
  cylinder(ctx, cx, by - 2, 18 * s, 8 * s, 18 * s, '#b98a45', { texture: false });
  ctx.strokeStyle = 'rgba(90,55,20,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, by - 2 - i * 4.5 * s, 18 * s, 8 * s, 0, 0, Math.PI);
    ctx.stroke();
  }
  ellipse(ctx, cx, by - 2 - 18 * s, 17 * s, 7 * s);
  ctx.fillStyle = shade(fill, -0.3);
  ctx.fill();
  for (let i = 0; i < 9; i++) {
    ellipse(ctx, cx + rr(-12, 12) * s, by - 20 * s - rr(0, 6) * s, 4.5 * s, 4 * s);
    ctx.fillStyle = rand() > 0.5 ? fill : shade(fill, 0.25);
    ctx.fill();
  }
}

function logPile(ctx: Ctx, cx: number, by: number, s = 1) {
  const rows = [4, 3, 2];
  rows.forEach((count, r) => {
    for (let i = 0; i < count; i++) {
      const x = cx + (i - (count - 1) / 2) * 20 * s;
      const y = by - r * 16 * s;
      log(ctx, x - 34 * s, y - 18 * s, x, y, 9 * s, '#7a4b28');
    }
  });
}

function stoneBlocks(ctx: Ctx, cx: number, cy: number, s = 1) {
  box(ctx, cx, cy, 0.12 * s, 0.09 * s, 22 * s, '#b3aea4');
  box(ctx, cx + 30 * s, cy + 14 * s, 0.1 * s, 0.1 * s, 22 * s, '#a8a398');
  box(ctx, cx + 12 * s, cy + 2 * s, 0.1 * s, 0.08 * s, 44 * s, '#bdb8ad', { texture: true });
}

function scaffold(ctx: Ctx, ax: number, ay: number, n: number) {
  const e = n * 0.36;
  const corners = [pt(ax, ay, -e, -e), pt(ax, ay, e, -e), pt(ax, ay, -e, e), pt(ax, ay, e, e)];
  const h = 70 + n * 30;
  ctx.strokeStyle = '#6b4220';
  ctx.lineWidth = 6;
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#8b5a2b';
  for (const f of [0.45, 0.9]) {
    ctx.beginPath();
    const ys = corners.map(([x, y]) => [x, y - h * f] as const);
    ctx.moveTo(ys[0][0], ys[0][1]);
    ctx.lineTo(ys[1][0], ys[1][1]);
    ctx.lineTo(ys[3][0], ys[3][1]);
    ctx.lineTo(ys[2][0], ys[2][1]);
    ctx.closePath();
    ctx.stroke();
  }
  // Rope lashings.
  ctx.strokeStyle = '#d8c08a';
  ctx.lineWidth = 2;
  for (const [x, y] of corners) {
    ctx.beginPath();
    ctx.moveTo(x - 4, y - h * 0.45 - 3);
    ctx.lineTo(x + 4, y - h * 0.45 + 3);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- buildings

type Painter = (ctx: Ctx, ax: number, ay: number, tier: number) => void;

const WALL_BY_TIER = [MUD, MUD_LIGHT, LIME];
const BAND_BY_TIER: (string[] | null)[] = [null, ['#7a2e1a', '#e9dcc0'], ['#1d1d1d', '#c23b22', '#2d5fa6', '#f0c33c']];

const PAINTERS: Record<string, { size: number; top: number; paint: Painter }> = {
  hut: {
    size: 1,
    top: 190,
    paint: (ctx, ax, ay, t) => {
      pad(ctx, ax, ay, 1);
      if (t >= 2) {
        hutBody(ctx, ax + 40, ay - 14, 0.62, WALL_BY_TIER[t], BAND_BY_TIER[t]);
        hutBody(ctx, ax - 22, ay + 8, 0.92, WALL_BY_TIER[t], BAND_BY_TIER[t]);
      } else {
        hutBody(ctx, ax, ay + 4, 1, WALL_BY_TIER[t], BAND_BY_TIER[t]);
      }
      if (t >= 1) {
        // Clay pots by the door.
        cylinder(ctx, ax + 52, ay + 30, 9, 4, 14, '#9c4a25', { texture: false });
        cylinder(ctx, ax + 66, ay + 22, 7, 3.5, 11, '#b85c2e', { texture: false });
      }
    },
  },
  hearth: {
    size: 2,
    top: 290,
    paint: (ctx, ax, ay, t) => {
      pad(ctx, ax, ay, 2, t >= 2 ? '#c9a67a' : '#b48a5a');
      if (t === 0) {
        const [bx, by] = pt(ax, ay, -0.42, -0.5);
        hutBody(ctx, bx, by, 0.85, MUD, null);
        // Carved pole.
        const [px, py] = pt(ax, ay, 0.55, -0.6);
        stake(ctx, px, py, 120, 14, '#7a4b28');
        ctx.fillStyle = '#c23b22';
        ctx.fillRect(px - 7, py - 92, 14, 8);
        ctx.fillStyle = '#e9dcc0';
        ctx.fillRect(px - 7, py - 70, 14, 6);
        ctx.fillStyle = '#1d1d1d';
        ctx.fillRect(px - 7, py - 52, 14, 6);
      } else if (t === 1) {
        const [hx, hy] = pt(ax, ay, -0.25, -0.35);
        hutBody(ctx, hx, hy, 1.45, LIME, BAND_BY_TIER[2]);
        shield(ctx, hx + 112, hy + 20, 1);
        shield(ctx, hx + 136, hy + 30, 1, '#5a3420', '#f2ead8');
        spear(ctx, hx - 120, hy + 50, 120, 0.05);
        spear(ctx, hx - 104, hy + 56, 116, 0.1);
      } else {
        // Sudano-Sahelian palace with buttresses and toron beams.
        const [px, py] = pt(ax, ay, -0.2, -0.3);
        shadow(ctx, px + 20, py + 30, 200, 90);
        box(ctx, px, py, 0.62, 0.42, 120, '#c99a64', { top: '#d8ad78' });
        // Towers.
        for (const [dx, dy] of [
          [-0.62, 0.42],
          [0.62, 0.42],
          [0.62, -0.42],
        ] as const) {
          const [tx, ty] = pt(px, py, dx, dy);
          box(ctx, tx, ty, 0.1, 0.1, 160, '#c4925a', { top: '#d8ad78' });
          // Pinnacle.
          ctx.beginPath();
          ctx.moveTo(tx - 16, ty - 160);
          ctx.quadraticCurveTo(tx, ty - 215, tx + 16, ty - 160);
          ctx.closePath();
          ctx.fillStyle = '#c4925a';
          ctx.fill();
          outline(ctx);
          ellipse(ctx, tx, ty - 206, 5, 5);
          ctx.fillStyle = '#e8d6a4';
          ctx.fill();
        }
        // Toron (wooden stakes) sticking out of the walls.
        ctx.strokeStyle = '#6b4220';
        ctx.lineWidth = 4;
        for (let r = 0; r < 3; r++)
          for (let i = 1; i < 6; i++) {
            const [x0, y0] = pt(px, py, -0.62 + i * 0.2, 0.42);
            const yy = y0 - 30 - r * 32;
            ctx.beginPath();
            ctx.moveTo(x0, yy);
            ctx.lineTo(x0 - 10, yy + 5);
            ctx.stroke();
          }
        const [dx, dy] = pt(px, py, 0, 0.42);
        doorway(ctx, dx, dy, 36, 62);
      }
      const [fx, fy] = pt(ax, ay, 0.28, 0.32);
      fireRing(ctx, fx, fy, t === 0 ? 1.05 : 0.9);
      // Log benches.
      if (t === 0) {
        log(ctx, fx - 120, fy + 6, fx - 70, fy + 30, 8);
        log(ctx, fx + 70, fy - 32, fx + 118, fy - 6, 8);
        drum(ctx, fx + 96, fy + 42, 0.9);
      }
    },
  },
  forager: {
    size: 2,
    top: 170,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#a98457');
      const [bx, by] = pt(ax, ay, -0.3, -0.4);
      shelter(ctx, bx, by, 1.1);
      // Drying rack with hanging roots.
      const [rx, ry] = pt(ax, ay, 0.5, -0.2);
      stake(ctx, rx - 40, ry + 20, 80, 6, '#6b4220');
      stake(ctx, rx + 40, ry - 20, 80, 6, '#6b4220');
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rx - 40, ry - 50);
      ctx.lineTo(rx + 40, ry - 90);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const x = rx - 32 + i * 13;
        const y = ry - 54 - i * 6.5;
        ctx.fillStyle = i % 2 ? '#9c5a2e' : '#c2733a';
        ellipse(ctx, x, y + 14, 4, 12);
        ctx.fill();
      }
      basket(ctx, ...pt(ax, ay, 0.15, 0.55), 1.2, '#b0203a');
      basket(ctx, ...pt(ax, ay, 0.5, 0.4), 1, '#5b2a7a');
      basket(ctx, ...pt(ax, ay, -0.25, 0.6), 1, '#e08a1e');
    },
  },
  well: {
    size: 1,
    top: 180,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 1, '#a99a80');
      shadow(ctx, ax + 8, ay + 8, 80, 34);
      cylinder(ctx, ax, ay + 6, 52, 26, 34, STONE);
      // Stone courses.
      ctx.strokeStyle = 'rgba(60,50,40,0.55)';
      ctx.lineWidth = 1.5;
      for (const f of [0.33, 0.66]) {
        ctx.beginPath();
        ctx.ellipse(ax, ay + 6 - 34 * f, 52, 26, 0, 0, Math.PI);
        ctx.stroke();
      }
      ellipse(ctx, ax, ay - 28, 52, 26);
      ctx.fillStyle = shade(STONE, 0.15);
      ctx.fill();
      outline(ctx);
      ellipse(ctx, ax, ay - 27, 38, 18);
      const wg = ctx.createLinearGradient(0, ay - 45, 0, ay - 10);
      wg.addColorStop(0, '#1e4f72');
      wg.addColorStop(1, '#3e86b0');
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ax - 6, ay - 26, 14, 5, 0, Math.PI * 1.1, Math.PI * 1.7);
      ctx.stroke();
      // Frame.
      stake(ctx, ax - 54, ay - 4, 110, 9, '#6b4220');
      stake(ctx, ax + 54, ay - 4, 110, 9, '#6b4220');
      ctx.strokeStyle = '#5b3218';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(ax - 58, ay - 104);
      ctx.lineTo(ax + 58, ay - 104);
      ctx.stroke();
      ctx.strokeStyle = '#d8c08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax + 8, ay - 104);
      ctx.lineTo(ax + 8, ay - 62);
      ctx.stroke();
      cylinder(ctx, ax + 8, ay - 44, 10, 5, 16, '#7a4b28', { texture: false });
      cylinder(ctx, ax + 70, ay + 22, 11, 5, 20, '#9c4a25', { texture: false });
    },
  },
  woodcutter: {
    size: 2,
    top: 200,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#a98457');
      const [hx, hy] = pt(ax, ay, 0.15, -0.45);
      hutBody(ctx, hx, hy, 0.95, MUD, null);
      // Wood chips.
      for (let i = 0; i < 40; i++) {
        const [cx, cy] = pt(ax, ay, rr(-0.6, 0.6), rr(0.1, 0.7));
        ctx.fillStyle = rand() > 0.5 ? '#d9a86a' : '#b8844a';
        ctx.fillRect(cx, cy, 5, 3);
      }
      logPile(ctx, ...pt(ax, ay, -0.42, 0.25), 1.1);
      // Stump with axe.
      const [sx, sy] = pt(ax, ay, 0.45, 0.35);
      cylinder(ctx, sx, sy, 22, 11, 22, '#7a4b28', { texture: false });
      ellipse(ctx, sx, sy - 22, 22, 11);
      ctx.fillStyle = '#d9a86a';
      ctx.fill();
      outline(ctx, undefined, 2);
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(sx - 4, sy - 26);
      ctx.lineTo(sx + 26, sy - 66);
      ctx.stroke();
      ctx.fillStyle = '#9aa3ad';
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy - 22);
      ctx.lineTo(sx + 12, sy - 40);
      ctx.lineTo(sx + 2, sy - 18);
      ctx.closePath();
      ctx.fill();
      outline(ctx, undefined, 1.5);
    },
  },
  quarry: {
    size: 2,
    top: 120,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#a39a88');
      // Stepped pit.
      for (let i = 0; i < 3; i++) {
        const e = 0.55 - i * 0.14;
        diamondPath(ctx, ax - 20, ay + 6 + i * 6, e, e * 0.9);
        ctx.fillStyle = shade('#8a8274', -0.12 * i);
        ctx.fill();
        outline(ctx, 'rgba(50,40,30,0.6)', 2);
      }
      ctx.save();
      diamondPath(ctx, ax - 20, ay + 6, 0.55, 0.5);
      ctx.clip();
      speckle(ctx, ax - 200, ay - 80, 400, 200, ['rgba(60,50,40,0.4)', 'rgba(200,190,170,0.4)'], 300, 4);
      ctx.restore();
      boulder(ctx, ...pt(ax, ay, -0.65, -0.55), 90, 64, '#a8a196');
      boulder(ctx, ...pt(ax, ay, -0.3, -0.75), 70, 50, '#9d968a');
      stoneBlocks(ctx, ...pt(ax, ay, 0.5, 0.1), 1.2);
      boulder(ctx, ...pt(ax, ay, 0.62, -0.45), 60, 44, '#b0aa9f');
      // Pick.
      const [kx, ky] = pt(ax, ay, 0.15, 0.62);
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(kx - 20, ky);
      ctx.lineTo(kx + 30, ky - 30);
      ctx.stroke();
      ctx.strokeStyle = '#8d99a6';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(kx + 14, ky - 44);
      ctx.quadraticCurveTo(kx + 34, ky - 32, kx + 44, ky - 10);
      ctx.stroke();
    },
  },
  granary: {
    size: 1,
    top: 230,
    paint: (ctx, ax, ay, t) => {
      pad(ctx, ax, ay, 1, '#b48a5a');
      shadow(ctx, ax + 10, ay + 10, 80, 36);
      const draw = (cx: number, cy: number, s: number) => {
        for (const [dx, dy] of [
          [-0.2, -0.2],
          [0.2, -0.2],
          [-0.2, 0.2],
          [0.2, 0.2],
        ] as const) {
          const [x, y] = pt(cx, cy, dx * s, dy * s);
          boulder(ctx, x, y + 6, 22 * s, 18 * s, '#8f8a80');
        }
        const [tx, ty] = box(ctx, cx, cy - 14 * s, 0.26 * s, 0.26 * s, 80 * s, t >= 1 ? MUD_LIGHT : MUD);
        // Small hatch.
        const [hx, hy] = pt(cx, cy - 14 * s, -0.1 * s, 0.26 * s);
        ctx.fillStyle = '#3a2414';
        ctx.fillRect(hx - 8 * s, hy - 60 * s, 16 * s, 16 * s);
        thatchCone(ctx, tx, ty + 16 * s, 66 * s, 33 * s, 82 * s, THATCH);
      };
      if (t >= 2) {
        draw(ax + 40, ay - 16, 0.72);
        draw(ax - 26, ay + 10, 0.9);
      } else draw(ax, ay, 1);
    },
  },
  palisade: {
    size: 1,
    top: 100,
    paint: (ctx, ax, ay, t) => {
      const color = t >= 1 ? '#7a4b28' : '#8b5a2b';
      const e = 0.42;
      const back: [number, number][] = [];
      const front: [number, number][] = [];
      for (let i = 0; i <= 6; i++) {
        const f = -e + (i / 6) * e * 2;
        back.push(pt(ax, ay, f, -e), pt(ax, ay, -e, f));
        front.push(pt(ax, ay, f, e), pt(ax, ay, e, f));
      }
      diamondPath(ctx, ax, ay, e, e);
      ctx.fillStyle = 'rgba(60,40,20,0.35)';
      ctx.fill();
      const all = [...back, ...front].sort((a, b) => a[1] - b[1]);
      for (const [x, y] of all) stake(ctx, x, y, rr(62, 78), 12, color);
      // Binding rope.
      ctx.strokeStyle = '#d8c08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const p0 = pt(ax, ay, -e, e);
      const p1 = pt(ax, ay, e, e);
      const p2 = pt(ax, ay, e, -e);
      ctx.moveTo(p0[0], p0[1] - 34);
      ctx.lineTo(p1[0], p1[1] - 34);
      ctx.lineTo(p2[0], p2[1] - 34);
      ctx.stroke();
    },
  },
  watchtower: {
    size: 1,
    top: 300,
    paint: (ctx, ax, ay, t) => {
      pad(ctx, ax, ay, 1, '#a98457');
      shadow(ctx, ax + 30, ay + 14, 90, 36);
      const h = 150 + t * 20;
      const e = 0.26;
      const legs = [pt(ax, ay, -e, -e), pt(ax, ay, e, -e), pt(ax, ay, -e, e), pt(ax, ay, e, e)];
      ctx.strokeStyle = '#5b3218';
      ctx.lineWidth = 9;
      for (const [x, y] of legs.slice(0, 2)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (ax - x) * 0.15, y - h);
        ctx.stroke();
      }
      // Cross bracing.
      ctx.strokeStyle = '#7a4b28';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(legs[2][0], legs[2][1] - 10);
      ctx.lineTo(legs[3][0] + (ax - legs[3][0]) * 0.1, legs[3][1] - h * 0.65);
      ctx.moveTo(legs[3][0], legs[3][1] - 10);
      ctx.lineTo(legs[2][0] + (ax - legs[2][0]) * 0.1, legs[2][1] - h * 0.65);
      ctx.stroke();
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 9;
      for (const [x, y] of legs.slice(2)) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (ax - x) * 0.15, y - h);
        ctx.stroke();
      }
      // Platform.
      const [ptx, pty] = box(ctx, ax, ay - h + 10, 0.3, 0.3, 14, '#8b5a2b', { texture: false });
      // Archer.
      const ax2 = ptx - 4;
      const ay2 = pty + 4;
      ctx.fillStyle = '#4a2c18';
      ctx.fillRect(ax2 - 7, ay2 - 40, 14, 30);
      ctx.fillStyle = '#c23b22';
      ctx.fillRect(ax2 - 8, ay2 - 30, 16, 10);
      ellipse(ctx, ax2, ay2 - 48, 8, 9);
      ctx.fillStyle = '#5a321c';
      ctx.fill();
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(ax2 + 12, ay2 - 32, 18, -1.3, 1.3);
      ctx.stroke();
      // Railing.
      for (let i = 0; i <= 4; i++) {
        const [x, y] = pt(ptx, pty + 14, -0.3 + i * 0.15, 0.3);
        stake(ctx, x, y, 26, 5, '#7a4b28');
        const [x2, y2] = pt(ptx, pty + 14, 0.3, -0.3 + i * 0.15);
        stake(ctx, x2, y2, 26, 5, '#6b4220');
      }
      // Roof on four short poles.
      ctx.strokeStyle = '#5b3218';
      ctx.lineWidth = 5;
      for (const [dx, dy] of [
        [-0.26, 0.26],
        [0.26, -0.26],
        [0.26, 0.26],
      ] as const) {
        const [x, y] = pt(ptx, pty, dx, dy);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 58);
        ctx.stroke();
      }
      thatchCone(ctx, ptx, pty - 52, 88, 44, 70, THATCH);
      if (t >= 1) {
        // Banner.
        ctx.fillStyle = t >= 2 ? '#2d5fa6' : '#c23b22';
        ctx.beginPath();
        ctx.moveTo(ptx, pty - 120);
        ctx.lineTo(ptx + 30, pty - 112);
        ctx.lineTo(ptx, pty - 102);
        ctx.closePath();
        ctx.fill();
        outline(ctx, undefined, 1.5);
      }
    },
  },
  maize: {
    size: 2,
    top: 150,
    paint: (ctx, ax, ay) => {
      // The field itself comes from Kenney sprites; this adds a scarecrow.
      const [sx, sy] = pt(ax, ay, 0.62, -0.62);
      stake(ctx, sx, sy, 110, 8, '#6b4220');
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx - 34, sy - 76);
      ctx.lineTo(sx + 34, sy - 76);
      ctx.stroke();
      ctx.fillStyle = '#c23b22';
      ctx.beginPath();
      ctx.moveTo(sx - 24, sy - 82);
      ctx.lineTo(sx + 24, sy - 82);
      ctx.lineTo(sx + 16, sy - 40);
      ctx.lineTo(sx - 16, sy - 40);
      ctx.closePath();
      ctx.fill();
      outline(ctx, undefined, 2);
      ellipse(ctx, sx, sy - 96, 14, 14);
      ctx.fillStyle = '#d6b36a';
      ctx.fill();
      outline(ctx, undefined, 2);
      thatchCone(ctx, sx, sy - 104, 24, 10, 22, THATCH);
    },
  },
  lodge: {
    size: 2,
    top: 260,
    paint: (ctx, ax, ay, t) => {
      pad(ctx, ax, ay, 2, '#a98457');
      const [hx, hy] = pt(ax, ay, -0.2, -0.25);
      hutBody(ctx, hx, hy, 1.4, t >= 1 ? LIME : MUD_LIGHT, ['#3a2414', '#c23b22', '#e9dcc0']);
      // Spear rack.
      const [rx, ry] = pt(ax, ay, 0.55, -0.1);
      for (let i = 0; i < 4; i++) spear(ctx, rx - 20 + i * 12, ry + 20 - i * 6, 110, -0.05 + i * 0.04);
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(rx - 28, ry - 30);
      ctx.lineTo(rx + 30, ry - 56);
      ctx.stroke();
      shield(ctx, ...pt(ax, ay, 0.4, 0.45), 1.1);
      shield(ctx, ...pt(ax, ay, 0.62, 0.3), 1.1, '#5a3420', '#f2ead8');
      shield(ctx, ...pt(ax, ay, 0.1, 0.62), 1.1, '#f2ead8', '#8a3a1a');
      // Training post.
      const [tx, ty] = pt(ax, ay, -0.6, 0.4);
      stake(ctx, tx, ty, 80, 14, '#7a4b28');
      ctx.fillStyle = '#d8c08a';
      ctx.fillRect(tx - 9, ty - 60, 18, 26);
    },
  },
  griot: {
    size: 2,
    top: 330,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#b8996a');
      baobab(ctx, ...pt(ax, ay, -0.15, -0.2), 1.35);
      // Circle of seat stones.
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const [x, y] = pt(ax, ay, Math.cos(a) * 0.62, Math.sin(a) * 0.62);
        if (Math.sin(a) + Math.cos(a) < -0.5) continue;
        boulder(ctx, x, y + 4, 26, 16, '#a39d90');
      }
      drum(ctx, ...pt(ax, ay, 0.45, 0.3), 1.2);
      drum(ctx, ...pt(ax, ay, 0.25, 0.5), 0.9);
      // Kora (harp-lute) leaning on a stone.
      const [kx, ky] = pt(ax, ay, 0.62, 0.0);
      ellipse(ctx, kx, ky - 14, 16, 16);
      ctx.fillStyle = '#c2843f';
      ctx.fill();
      outline(ctx, undefined, 2);
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(kx, ky - 20);
      ctx.lineTo(kx - 10, ky - 90);
      ctx.stroke();
    },
  },
  smelter: {
    size: 2,
    top: 260,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#9c7a56');
      const [fx, fy] = pt(ax, ay, -0.15, -0.15);
      shadow(ctx, fx + 20, fy + 14, 110, 46);
      // Tapered clay furnace.
      const rx = 62;
      const ry = 31;
      const h = 170;
      ctx.beginPath();
      ctx.moveTo(fx - rx, fy);
      ctx.quadraticCurveTo(fx - rx * 0.8, fy - h * 0.6, fx - rx * 0.38, fy - h);
      ctx.lineTo(fx + rx * 0.38, fy - h);
      ctx.quadraticCurveTo(fx + rx * 0.8, fy - h * 0.6, fx + rx, fy);
      ctx.ellipse(fx, fy, rx, ry, 0, 0, Math.PI);
      ctx.closePath();
      const g = ctx.createLinearGradient(fx - rx, 0, fx + rx, 0);
      g.addColorStop(0, '#c0643a');
      g.addColorStop(0.5, '#9e4a28');
      g.addColorStop(1, '#5e2a16');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      speckle(ctx, fx - rx, fy - h, rx * 2, h + ry, ['rgba(60,20,10,0.4)', 'rgba(230,140,90,0.35)'], 260, 4);
      ctx.restore();
      outline(ctx);
      ellipse(ctx, fx, fy - h, rx * 0.38, ry * 0.38);
      const gl = ctx.createRadialGradient(fx, fy - h, 1, fx, fy - h, rx * 0.38);
      gl.addColorStop(0, '#fff2a8');
      gl.addColorStop(0.5, '#ff9a2e');
      gl.addColorStop(1, '#b4361a');
      ctx.fillStyle = gl;
      ctx.fill();
      outline(ctx, undefined, 2);
      // Glowing tap hole and clay tuyeres.
      const [tx, ty] = [fx - 10, fy + ry * 0.8];
      ctx.beginPath();
      ctx.arc(tx, ty - 14, 13, Math.PI, 0);
      ctx.lineTo(tx + 13, ty);
      ctx.lineTo(tx - 13, ty);
      ctx.closePath();
      ctx.fillStyle = '#ff9a2e';
      ctx.fill();
      outline(ctx, undefined, 2);
      for (const dx of [-46, 34]) {
        ctx.save();
        ctx.translate(fx + dx, fy + 6);
        ctx.rotate(dx < 0 ? 0.5 : -0.5);
        ctx.fillStyle = '#b05a32';
        ctx.fillRect(-20, -6, 40, 12);
        ctx.strokeStyle = 'rgba(40,22,10,0.85)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -6, 40, 12);
        ctx.restore();
      }
      // Goatskin bellows.
      for (const [dx, dy] of [
        [0.55, -0.05],
        [0.4, 0.15],
      ] as const) {
        const [bx, by] = pt(ax, ay, dx, dy);
        ellipse(ctx, bx, by - 14, 26, 16);
        ctx.fillStyle = '#7a5232';
        ctx.fill();
        outline(ctx, undefined, 2);
      }
      // Ore and charcoal heaps.
      for (const [dx, dy, c] of [
        [-0.55, 0.45, '#7a3c22'],
        [0.05, 0.62, '#2e2a28'],
      ] as const) {
        const [hx, hy] = pt(ax, ay, dx, dy);
        for (let i = 0; i < 14; i++) boulder(ctx, hx + rr(-26, 26), hy + rr(-8, 8) - i * 0.6, rr(12, 18), rr(8, 12), c);
      }
    },
  },
  kraal: {
    size: 2,
    top: 120,
    paint: (ctx, ax, ay) => {
      diamondPath(ctx, ax, ay, 0.95, 0.95);
      ctx.fillStyle = '#9e7a4c';
      ctx.fill();
      ctx.save();
      ctx.clip();
      speckle(ctx, ax - 260, ay - 140, 520, 280, ['#7d5c36', '#b89466', '#6a8a3a'], 500, 4);
      ctx.restore();
      const ring: [number, number][] = [];
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        ring.push(pt(ax, ay, Math.cos(a) * 0.86, Math.sin(a) * 0.86));
      }
      const backRing = ring.filter(([, y]) => y <= ay);
      const frontRing = ring.filter(([, y]) => y > ay);
      for (const [x, y] of backRing.sort((a, b) => a[1] - b[1])) stake(ctx, x, y, rr(40, 52), 8, '#7a4b28');
      cow(ctx, ...pt(ax, ay, -0.25, -0.1), 1, false);
      cow(ctx, ...pt(ax, ay, 0.3, 0.15), 1, true);
      for (const [x, y] of frontRing.sort((a, b) => a[1] - b[1])) stake(ctx, x, y, rr(40, 52), 8, '#8b5a2b');
    },
  },
  stonewall: {
    size: 1,
    top: 90,
    paint: (ctx, ax, ay, t) => {
      const color = t >= 2 ? '#b8b0a0' : '#a8a092';
      box(ctx, ax, ay, 0.46, 0.46, 58, color, { top: shade(color, 0.12) });
      // Coursed masonry lines.
      ctx.strokeStyle = 'rgba(60,50,40,0.45)';
      ctx.lineWidth = 1.5;
      for (let r = 1; r < 5; r++) {
        const y = r * 11.5;
        const [lx, ly] = pt(ax, ay, -0.46, 0.46);
        const [bx, by] = pt(ax, ay, 0.46, 0.46);
        const [rx, ry] = pt(ax, ay, 0.46, -0.46);
        ctx.beginPath();
        ctx.moveTo(lx, ly - y);
        ctx.lineTo(bx, by - y);
        ctx.lineTo(rx, ry - y);
        ctx.stroke();
      }
      // Chevron frieze, as on the Great Enclosure.
      const [lx, ly] = pt(ax, ay, -0.46, 0.46);
      const [bx, by] = pt(ax, ay, 0.46, 0.46);
      ctx.strokeStyle = shade(color, -0.45);
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        const x = lx + (bx - lx) * f;
        const y = ly + (by - ly) * f - 44 + (i % 2 ? -6 : 0);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    },
  },
  goldmine: {
    size: 2,
    top: 200,
    paint: (ctx, ax, ay) => {
      pad(ctx, ax, ay, 2, '#a3906a');
      // Rocky mound.
      const [mx, my] = pt(ax, ay, -0.2, -0.2);
      boulder(ctx, mx - 60, my + 10, 120, 100, '#8f877a');
      boulder(ctx, mx + 50, my + 6, 140, 130, '#9a9286');
      boulder(ctx, mx, my + 40, 160, 90, '#a39b8e');
      // Timber-framed entrance.
      const [ex, ey] = [mx + 10, my + 50];
      ctx.beginPath();
      ctx.moveTo(ex - 30, ey);
      ctx.lineTo(ex - 30, ey - 60);
      ctx.lineTo(ex + 30, ey - 60);
      ctx.lineTo(ex + 30, ey);
      ctx.closePath();
      ctx.fillStyle = '#140c06';
      ctx.fill();
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(ex - 34, ey);
      ctx.lineTo(ex - 34, ey - 64);
      ctx.lineTo(ex + 34, ey - 64);
      ctx.lineTo(ex + 34, ey);
      ctx.stroke();
      basket(ctx, ...pt(ax, ay, 0.5, 0.4), 1.2, '#f2c94c');
      basket(ctx, ...pt(ax, ay, 0.2, 0.6), 1, '#f2c94c');
    },
  },
};

export function buildingTier(type: string, level: number): number {
  if (type === 'hearth') return level >= 7 ? 2 : level >= 4 ? 1 : 0;
  return level >= 7 ? 2 : level >= 4 ? 1 : 0;
}

/** Where the hearth fire burns, relative to the building anchor, in world units. */
export function hearthFireOffset(tier: number): [number, number] {
  const [x, y] = iso(0.28, 0.32);
  return [x * 0.5, (y - (tier === 0 ? 14 : 12)) * 0.5];
}

export function paintBuildings(): TexInfo[] {
  const out: TexInfo[] = [];
  for (const [type, p] of Object.entries(PAINTERS)) {
    for (let tier = 0; tier < 3; tier++) {
      out.push(tex(`b_${type}_${tier}`, p.size, p.top, (ctx, ax, ay) => p.paint(ctx, ax, ay, tier), tier + 1));
    }
  }
  for (const n of [1, 2]) {
    // Empty plot: pegs and a rope marking the ground.
    out.push(
      tex(`plot_${n}`, n, 40, (ctx, ax, ay) => {
        const e = (n / 2) * 0.86;
        diamondPath(ctx, ax, ay, e, e);
        ctx.fillStyle = 'rgba(255,236,170,0.22)';
        ctx.fill();
        ctx.setLineDash([14, 10]);
        ctx.strokeStyle = 'rgba(255,240,190,0.95)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([]);
        for (const [dx, dy] of [
          [-e, -e],
          [e, -e],
          [e, e],
          [-e, e],
        ])
          stake(ctx, ...pt(ax, ay, dx, dy), 30, 8, '#8b5a2b');
      }),
    );
    out.push(
      tex(`construct_${n}`, n, 140 + n * 30, (ctx, ax, ay) => {
        pad(ctx, ax, ay, n, '#a98457');
        scaffold(ctx, ax, ay, n);
        log(ctx, ...pt(ax, ay, -0.3 * n, 0.25 * n), ...pt(ax, ay, 0.05 * n, 0.4 * n), 7);
        boulder(ctx, ...pt(ax, ay, 0.3 * n, 0.2 * n), 30, 20);
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------- shared with nature

export function baobab(ctx: Ctx, cx: number, by: number, s: number) {
  shadow(ctx, cx + 30 * s, by + 10 * s, 120 * s, 46 * s, 0.35);
  // Bottle-shaped trunk.
  const w = 46 * s;
  const h = 170 * s;
  ctx.beginPath();
  ctx.moveTo(cx - w, by);
  ctx.bezierCurveTo(cx - w * 1.25, by - h * 0.45, cx - w * 0.6, by - h * 0.8, cx - w * 0.55, by - h);
  ctx.lineTo(cx + w * 0.55, by - h);
  ctx.bezierCurveTo(cx + w * 0.6, by - h * 0.8, cx + w * 1.25, by - h * 0.45, cx + w, by);
  ctx.quadraticCurveTo(cx, by + w * 0.4, cx - w, by);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
  g.addColorStop(0, '#b3a08c');
  g.addColorStop(0.45, '#9b8672');
  g.addColorStop(1, '#5e4e40');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(70,55,45,0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    const x = cx - w + (i / 8) * w * 2;
    ctx.beginPath();
    ctx.moveTo(x, by + 10);
    ctx.quadraticCurveTo(x + rr(-8, 8), by - h * 0.5, x * 0.7 + cx * 0.3, by - h);
    ctx.stroke();
  }
  ctx.restore();
  outline(ctx);
  // Stubby branches.
  ctx.strokeStyle = '#8a7562';
  ctx.lineCap = 'round';
  const tips: [number, number][] = [];
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    const len = rr(50, 80) * s;
    const x0 = cx + (i - 3) * 9 * s;
    const y0 = by - h + 8;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len * 0.75;
    ctx.lineWidth = 14 * s;
    ctx.strokeStyle = 'rgba(40,22,10,0.85)';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.lineWidth = 10 * s;
    ctx.strokeStyle = '#8a7562';
    ctx.stroke();
    tips.push([x1, y1]);
  }
  for (const [x, y] of tips) foliage(ctx, x, y - 6 * s, 70 * s, 50 * s, '#5f8a2e', 5);
}

export function cow(ctx: Ctx, cx: number, by: number, s: number, flip: boolean, fill2?: boolean) {
  ctx.save();
  ctx.translate(cx, by);
  if (flip) ctx.scale(-1, 1);
  ctx.scale(s, s);
  shadow(ctx, 0, 2, 44, 14);
  const body = flip ? '#f0e6d2' : '#8a4a22';
  // Legs.
  ctx.fillStyle = shade(body, -0.3);
  for (const x of [-24, -14, 16, 24]) ctx.fillRect(x - 3, -22, 6, 22);
  // Body.
  ellipse(ctx, 0, -34, 34, 17);
  ctx.fillStyle = body;
  ctx.fill();
  if (flip || fill2) {
    ellipse(ctx, 8, -36, 12, 9);
    ctx.fillStyle = '#6a3a1a';
    ctx.fill();
  }
  ellipse(ctx, 0, -34, 34, 17);
  outline(ctx, undefined, 2);
  // Hump and head.
  ellipse(ctx, -24, -46, 10, 8);
  ctx.fillStyle = body;
  ctx.fill();
  ellipse(ctx, -40, -40, 10, 12);
  ctx.fill();
  outline(ctx, undefined, 2);
  // Long lyre horns (Ankole).
  ctx.strokeStyle = '#efe4c8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-42, -50);
  ctx.quadraticCurveTo(-70, -64, -58, -90);
  ctx.moveTo(-38, -50);
  ctx.quadraticCurveTo(-18, -66, -26, -92);
  ctx.stroke();
  ctx.restore();
}
