import type { ResId } from '../data/resources';
import { boulder, ellipse, log, makeCanvas, outline, srand, type Ctx, type TexInfo } from './paint';

function tex(key: string, w: number, h: number, draw: (ctx: Ctx, w: number, h: number) => void): TexInfo {
  const [canvas, ctx] = makeCanvas(w, h);
  srand(key.length * 97);
  draw(ctx, w, h);
  return { key, w, h, ox: w / 2, oy: h / 2, canvas };
}

export const FLAME_FRAMES = 6;

/** Flame sheet: frames side by side, base of the flame at the bottom centre. */
export function paintFlames(): { canvas: HTMLCanvasElement; fw: number; fh: number } {
  const fw = 96;
  const fh = 128;
  const [canvas, ctx] = makeCanvas(fw * FLAME_FRAMES, fh);
  for (let f = 0; f < FLAME_FRAMES; f++) {
    const cx = f * fw + fw / 2;
    const by = fh - 10;
    const glow = ctx.createRadialGradient(cx, by - 20, 2, cx, by - 20, 46);
    glow.addColorStop(0, 'rgba(255,200,90,0.55)');
    glow.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(f * fw, 0, fw, fh);
    const layers: [string, number, number][] = [
      ['#d2401c', 1, 0],
      ['#ff8a1e', 0.75, 3],
      ['#ffd34a', 0.5, 6],
      ['#fff4c0', 0.25, 8],
    ];
    for (const [col, s, lift] of layers) {
      const sway = Math.sin(f * 1.05 + s * 3) * 8 * s;
      const h = (80 + Math.sin(f * 2.1 + s) * 12) * (0.4 + s * 0.6);
      const w = 28 * (0.4 + s * 0.6);
      ctx.beginPath();
      ctx.moveTo(cx - w, by - lift);
      ctx.bezierCurveTo(cx - w * 1.1, by - h * 0.5, cx + sway - w * 0.3, by - h * 0.7, cx + sway, by - h);
      ctx.bezierCurveTo(cx + sway + w * 0.4, by - h * 0.65, cx + w * 1.1, by - h * 0.45, cx + w, by - lift);
      ctx.quadraticCurveTo(cx, by + 6 - lift, cx - w, by - lift);
      ctx.fillStyle = col;
      ctx.fill();
    }
  }
  return { canvas, fw, fh };
}

export function paintEffects(): TexInfo[] {
  return [
    tex('fx_arrow', 64, 12, (c) => {
      c.strokeStyle = '#6b4220';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(6, 6);
      c.lineTo(52, 6);
      c.stroke();
      c.fillStyle = '#cfd4d9';
      c.beginPath();
      c.moveTo(62, 6);
      c.lineTo(50, 1);
      c.lineTo(50, 11);
      c.closePath();
      c.fill();
      c.fillStyle = '#f4f1e8';
      c.fillRect(4, 2, 8, 3);
      c.fillRect(4, 7, 8, 3);
    }),
    tex('fx_spear', 90, 14, (c) => {
      c.strokeStyle = '#5b3218';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(4, 7);
      c.lineTo(72, 7);
      c.stroke();
      c.fillStyle = '#cfd4d9';
      c.beginPath();
      c.moveTo(88, 7);
      c.lineTo(70, 1);
      c.lineTo(70, 13);
      c.closePath();
      c.fill();
    }),
    tex('fx_stone', 20, 20, (c) => boulder(c, 10, 16, 14, 12, '#8f8a80')),
    tex('fx_spark', 48, 48, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,230,1)');
      g.addColorStop(0.3, 'rgba(255,220,120,0.9)');
      g.addColorStop(1, 'rgba(255,140,40,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    tex('fx_smoke', 64, 64, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(120,110,100,0.65)');
      g.addColorStop(1, 'rgba(120,110,100,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    tex('fx_dust', 64, 64, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(214,170,110,0.6)');
      g.addColorStop(1, 'rgba(214,170,110,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    tex('fx_rain', 6, 40, (c) => {
      const g = c.createLinearGradient(0, 0, 0, 40);
      g.addColorStop(0, 'rgba(200,225,255,0)');
      g.addColorStop(1, 'rgba(200,225,255,0.75)');
      c.fillStyle = g;
      c.fillRect(2, 0, 2, 40);
    }),
    tex('fx_leaf', 16, 12, (c) => {
      ellipse(c, 8, 6, 7, 4);
      c.fillStyle = '#7aa03a';
      c.fill();
    }),
    tex('fx_chip', 12, 8, (c) => {
      c.fillStyle = '#d9a86a';
      c.fillRect(1, 1, 10, 6);
    }),
    tex('fx_ring', 300, 150, (c, w, h) => {
      c.strokeStyle = 'rgba(255,240,180,0.95)';
      c.lineWidth = 6;
      ellipse(c, w / 2, h / 2, w / 2 - 6, h / 2 - 6);
      c.stroke();
      c.strokeStyle = 'rgba(255,200,80,0.5)';
      c.lineWidth = 14;
      ellipse(c, w / 2, h / 2, w / 2 - 12, h / 2 - 12);
      c.stroke();
    }),
    tex('fx_glow', 128, 128, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,190,90,0.9)');
      g.addColorStop(0.4, 'rgba(255,140,50,0.35)');
      g.addColorStop(1, 'rgba(255,120,30,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }),
    tex('fx_bolt', 60, 200, (c) => {
      c.strokeStyle = 'rgba(200,230,255,0.95)';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(30, 0);
      c.lineTo(20, 60);
      c.lineTo(38, 90);
      c.lineTo(22, 140);
      c.lineTo(34, 200);
      c.stroke();
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.stroke();
    }),
  ];
}

// ---------------------------------------------------------------- icons

export type IconId = ResId | 'pop' | 'legend' | 'hammer' | 'sword' | 'clock' | 'star';

const ICON_DRAW: Record<IconId, (c: Ctx) => void> = {
  food: (c) => {
    // Calabash bowl of grain and fruit.
    ellipse(c, 32, 30, 22, 9);
    c.fillStyle = '#f0c33c';
    c.fill();
    for (const [x, y, col] of [
      [24, 24, '#c0182f'],
      [36, 22, '#e2502e'],
      [30, 26, '#7aa03a'],
    ] as const) {
      ellipse(c, x, y, 7, 7);
      c.fillStyle = col;
      c.fill();
      outline(c, 'rgba(40,20,5,0.8)', 1.5);
    }
    c.beginPath();
    c.moveTo(10, 30);
    c.quadraticCurveTo(32, 64, 54, 30);
    c.closePath();
    const g = c.createLinearGradient(10, 30, 54, 50);
    g.addColorStop(0, '#d39a52');
    g.addColorStop(1, '#8a5428');
    c.fillStyle = g;
    c.fill();
    outline(c, 'rgba(40,20,5,0.9)', 2.5);
    c.strokeStyle = '#5b3218';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(16, 38);
    c.quadraticCurveTo(32, 48, 48, 38);
    c.stroke();
  },
  water: (c) => {
    c.beginPath();
    c.moveTo(32, 6);
    c.bezierCurveTo(40, 20, 52, 30, 52, 40);
    c.arc(32, 40, 20, 0, Math.PI);
    c.bezierCurveTo(12, 30, 24, 20, 32, 6);
    c.closePath();
    const g = c.createLinearGradient(12, 6, 52, 60);
    g.addColorStop(0, '#9be0ff');
    g.addColorStop(1, '#1f6fa8');
    c.fillStyle = g;
    c.fill();
    outline(c, 'rgba(10,30,60,0.9)', 2.5);
    ellipse(c, 24, 40, 4, 7);
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.fill();
  },
  wood: (c) => {
    log(c, 8, 44, 46, 30, 8, '#8b5a2b');
    log(c, 14, 30, 52, 18, 8, '#9a6534');
    log(c, 20, 54, 56, 42, 8, '#7a4b28');
  },
  stone: (c) => {
    boulder(c, 24, 52, 32, 30, '#a8a296');
    boulder(c, 40, 54, 34, 36, '#9a948a');
    boulder(c, 32, 58, 30, 18, '#b4aea2');
  },
  iron: (c) => {
    c.beginPath();
    c.moveTo(10, 44);
    c.lineTo(20, 24);
    c.lineTo(54, 24);
    c.lineTo(44, 44);
    c.closePath();
    c.fillStyle = '#b8c2cc';
    c.fill();
    outline(c, 'rgba(20,25,30,0.9)', 2.5);
    c.beginPath();
    c.moveTo(10, 44);
    c.lineTo(44, 44);
    c.lineTo(44, 52);
    c.lineTo(10, 52);
    c.closePath();
    c.fillStyle = '#6d7884';
    c.fill();
    outline(c, 'rgba(20,25,30,0.9)', 2.5);
    c.beginPath();
    c.moveTo(44, 44);
    c.lineTo(54, 24);
    c.lineTo(54, 32);
    c.lineTo(44, 52);
    c.closePath();
    c.fillStyle = '#56606b';
    c.fill();
    outline(c, 'rgba(20,25,30,0.9)', 2.5);
  },
  gold: (c) => {
    for (const [x, y, r] of [
      [22, 40, 13],
      [40, 42, 14],
      [32, 28, 12],
    ] as const) {
      ellipse(c, x, y, r, r * 0.85);
      const g = c.createRadialGradient(x - 4, y - 4, 1, x, y, r);
      g.addColorStop(0, '#fff3b0');
      g.addColorStop(0.5, '#f2c94c');
      g.addColorStop(1, '#a87a12');
      c.fillStyle = g;
      c.fill();
      outline(c, 'rgba(70,45,5,0.9)', 2);
    }
  },
  pop: (c) => {
    ellipse(c, 32, 20, 10, 11);
    c.fillStyle = '#6b3f24';
    c.fill();
    outline(c, 'rgba(30,15,5,0.9)', 2.5);
    c.beginPath();
    c.moveTo(14, 58);
    c.quadraticCurveTo(14, 32, 32, 32);
    c.quadraticCurveTo(50, 32, 50, 58);
    c.closePath();
    c.fillStyle = '#c2733a';
    c.fill();
    outline(c, 'rgba(30,15,5,0.9)', 2.5);
    c.fillStyle = '#2d5fa6';
    c.fillRect(16, 44, 32, 5);
  },
  legend: (c) => {
    // Sankofa-inspired heart spiral token.
    ellipse(c, 32, 32, 26, 26);
    const g = c.createRadialGradient(26, 24, 2, 32, 32, 26);
    g.addColorStop(0, '#ffe9a0');
    g.addColorStop(1, '#c98a1a');
    c.fillStyle = g;
    c.fill();
    outline(c, 'rgba(70,40,5,0.95)', 3);
    c.strokeStyle = '#6b3a0a';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(32, 46);
    c.bezierCurveTo(14, 34, 16, 18, 26, 18);
    c.bezierCurveTo(30, 18, 32, 22, 32, 24);
    c.bezierCurveTo(32, 22, 34, 18, 38, 18);
    c.bezierCurveTo(48, 18, 50, 34, 32, 46);
    c.stroke();
    c.beginPath();
    c.arc(25, 28, 4, 0, Math.PI * 1.5);
    c.moveTo(43, 28);
    c.arc(39, 28, 4, 0, Math.PI * 1.5, true);
    c.stroke();
  },
  hammer: (c) => {
    c.strokeStyle = '#6b4220';
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(16, 52);
    c.lineTo(40, 24);
    c.stroke();
    c.save();
    c.translate(40, 22);
    c.rotate(-0.85);
    c.fillStyle = '#9aa3ad';
    c.fillRect(-16, -8, 32, 14);
    c.strokeStyle = 'rgba(20,25,30,0.9)';
    c.lineWidth = 2.5;
    c.strokeRect(-16, -8, 32, 14);
    c.restore();
  },
  sword: (c) => {
    c.strokeStyle = '#cfd4d9';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(18, 50);
    c.lineTo(52, 12);
    c.stroke();
    c.strokeStyle = '#6b4220';
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(10, 58);
    c.lineTo(20, 48);
    c.moveTo(12, 40);
    c.lineTo(28, 56);
    c.stroke();
  },
  clock: (c) => {
    ellipse(c, 32, 32, 22, 22);
    c.fillStyle = '#f4f1e8';
    c.fill();
    outline(c, 'rgba(30,15,5,0.9)', 3);
    c.strokeStyle = '#3a2414';
    c.lineWidth = 3.5;
    c.beginPath();
    c.moveTo(32, 32);
    c.lineTo(32, 18);
    c.moveTo(32, 32);
    c.lineTo(42, 38);
    c.stroke();
  },
  star: (c) => {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 11 : 24;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      c.lineTo(32 + Math.cos(a) * r, 34 + Math.sin(a) * r);
    }
    c.closePath();
    c.fillStyle = '#f2c94c';
    c.fill();
    outline(c, 'rgba(70,45,5,0.9)', 2.5);
  },
};

export const ICON_IDS = Object.keys(ICON_DRAW) as IconId[];

export function paintIcon(id: IconId): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(64, 64);
  ICON_DRAW[id](ctx);
  return canvas;
}

export function iconTexs(): TexInfo[] {
  return ICON_IDS.map((id) => {
    const canvas = paintIcon(id);
    return { key: `i_${id}`, w: 64, h: 64, ox: 32, oy: 32, canvas };
  });
}

