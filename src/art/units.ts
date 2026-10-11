import type { Headwear } from '../data/heroes';
import { ellipse, makeCanvas, outline, rr, shade, shadow, srand, type Ctx } from './paint';

export interface SheetInfo {
  key: string;
  frameW: number;
  frameH: number;
  frames: number;
  /** Feet position inside a frame. */
  ox: number;
  oy: number;
  canvas: HTMLCanvasElement;
}

export type Weapon = 'none' | 'spear' | 'bow' | 'sling' | 'staff' | 'club' | 'axe' | 'basket';

export interface PersonLook {
  skin: string;
  cloth: string;
  cloth2: string;
  head: 'bare' | 'wrap' | 'mask' | Headwear;
  weapon: Weapon;
  cape?: string;
  shield?: boolean;
  accent?: string;
}

const FW = 112;
const FH = 140;
const FOOT_Y = 128;
export const UNIT_FRAMES = 4;

function sheet(key: string, fw: number, fh: number, frames: number, oy: number, draw: (ctx: Ctx, fx: number, fy: number, frame: number) => void, seed = 1): SheetInfo {
  const [canvas, ctx] = makeCanvas(fw * frames, fh);
  for (let f = 0; f < frames; f++) {
    srand(seed);
    ctx.save();
    ctx.beginPath();
    ctx.rect(f * fw, 0, fw, fh);
    ctx.clip();
    draw(ctx, f * fw + fw / 2, oy, f);
    ctx.restore();
  }
  return { key, frameW: fw, frameH: fh, frames, ox: fw / 2, oy, canvas };
}

/** A person facing right. frame: 0 idle, 1-2 walk, 3 attack. */
export function drawPerson(ctx: Ctx, x: number, fy: number, frame: number, look: PersonLook, s = 1) {
  ctx.save();
  ctx.translate(x, fy);
  ctx.scale(s, s);
  shadow(ctx, 0, 0, 26, 9, 0.4);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const bob = frame === 1 || frame === 2 ? -2 : 0;
  // Cape behind.
  if (look.cape) {
    ctx.beginPath();
    ctx.moveTo(-10, -70 + bob);
    ctx.quadraticCurveTo(-26, -40, -22 + step * 3, -12);
    ctx.lineTo(4, -14);
    ctx.lineTo(6, -68 + bob);
    ctx.closePath();
    ctx.fillStyle = shade(look.cape, -0.15);
    ctx.fill();
    outline(ctx, undefined, 2);
  }
  // Legs.
  ctx.lineCap = 'round';
  const legs: [number, number][] = [
    [-5, step * 8],
    [5, -step * 8],
  ];
  for (const [lx, off] of legs) {
    ctx.strokeStyle = 'rgba(30,16,8,0.9)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(lx, -30 + bob);
    ctx.lineTo(lx + off, -3);
    ctx.stroke();
    ctx.strokeStyle = shade(look.skin, -0.1);
    ctx.lineWidth = 6.5;
    ctx.stroke();
  }
  // Wrap / tunic body.
  ctx.beginPath();
  ctx.moveTo(-12, -68 + bob);
  ctx.lineTo(12, -68 + bob);
  ctx.lineTo(15, -24 + bob);
  ctx.lineTo(-15, -24 + bob);
  ctx.closePath();
  const g = ctx.createLinearGradient(-15, 0, 15, 0);
  g.addColorStop(0, shade(look.cloth, 0.15));
  g.addColorStop(1, shade(look.cloth, -0.3));
  ctx.fillStyle = g;
  ctx.fill();
  outline(ctx, undefined, 2.5);
  // Cloth pattern band (kente-like stripes).
  ctx.fillStyle = look.cloth2;
  ctx.fillRect(-14, -44 + bob, 28, 6);
  ctx.fillStyle = look.accent ?? shade(look.cloth2, 0.4);
  for (let i = -12; i < 12; i += 6) ctx.fillRect(i, -44 + bob, 3, 6);
  // Back arm.
  const atk = frame === 3;
  ctx.strokeStyle = shade(look.skin, -0.25);
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-9, -62 + bob);
  ctx.lineTo(-13 - step * 4, -40 + bob);
  ctx.stroke();
  // Head.
  drawMane(ctx, 1, -80 + bob, look);
  ellipse(ctx, 1, -80 + bob, 10, 11);
  ctx.fillStyle = look.skin;
  ctx.fill();
  outline(ctx, undefined, 2.2);
  ctx.fillStyle = 'rgba(20,10,5,0.9)';
  ctx.fillRect(5, -82 + bob, 2.5, 2.5);
  drawHeadwear(ctx, 1, -80 + bob, look);
  // Weapon and front arm.
  const handX = atk ? 18 : 11;
  const handY = atk ? -56 + bob : -42 + bob;
  drawWeapon(ctx, handX, handY, look.weapon, atk, bob);
  ctx.strokeStyle = look.skin;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(8, -62 + bob);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  if (look.shield) {
    ellipse(ctx, -12, -46 + bob, 8, 20);
    ctx.fillStyle = '#f2ead8';
    ctx.fill();
    ellipse(ctx, -12, -50 + bob, 4, 6);
    ctx.fillStyle = '#3a2414';
    ctx.fill();
    ellipse(ctx, -12, -46 + bob, 8, 20);
    outline(ctx, undefined, 2);
  }
  ctx.restore();
}

function drawMane(ctx: Ctx, x: number, y: number, look: PersonLook) {
  if (look.head === 'lionmane') drawHeadwear(ctx, x, y, { ...look, head: 'lionmane_ring' });
}

function drawHeadwear(ctx: Ctx, x: number, y: number, look: Omit<PersonLook, 'head'> & { head: PersonLook['head'] | 'lionmane_ring' }) {
  const a = look.accent ?? '#e0b84a';
  switch (look.head) {
    case 'bare':
      ctx.beginPath();
      ctx.arc(x, y - 3, 10.5, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fillStyle = '#1a0f08';
      ctx.fill();
      break;
    case 'wrap':
      ctx.beginPath();
      ctx.ellipse(x - 1, y - 8, 12, 8, -0.1, Math.PI, 0);
      ctx.quadraticCurveTo(x + 6, y - 22, x - 4, y - 20);
      ctx.closePath();
      ctx.fillStyle = look.cloth2;
      ctx.fill();
      outline(ctx, undefined, 2);
      break;
    case 'mask':
      ctx.fillStyle = '#8c1c1c';
      ctx.fillRect(x - 10, y - 2, 21, 8);
      ctx.beginPath();
      ctx.ellipse(x, y - 7, 11, 7, 0, Math.PI, 0);
      ctx.fillStyle = '#3a2a3e';
      ctx.fill();
      outline(ctx, undefined, 2);
      break;
    case 'lionmane':
      // The mane itself is drawn behind the head by drawMane(); this is the pelt cap.
      ctx.beginPath();
      ctx.ellipse(x, y - 9, 11, 6, 0, Math.PI, 0);
      ctx.fillStyle = '#d49a3e';
      ctx.fill();
      outline(ctx, undefined, 1.5);
      break;
    case 'lionmane_ring':
      for (let i = 0; i < 14; i++) {
        const ang = Math.PI * 0.6 + (i / 13) * Math.PI * 1.6;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(ang) * 11, y + Math.sin(ang) * 11, 7, 5, ang, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? '#c88a2e' : '#a86a1e';
        ctx.fill();
      }
      break;
    case 'crown':
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - 8);
      ctx.lineTo(x - 10, y - 20);
      ctx.lineTo(x - 5, y - 14);
      ctx.lineTo(x, y - 24);
      ctx.lineTo(x + 5, y - 14);
      ctx.lineTo(x + 10, y - 20);
      ctx.lineTo(x + 10, y - 8);
      ctx.closePath();
      ctx.fill();
      outline(ctx, undefined, 1.5);
      break;
    case 'nemes':
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 6);
      ctx.quadraticCurveTo(x, y - 24, x + 11, y - 6);
      ctx.lineTo(x + 13, y + 12);
      ctx.lineTo(x + 6, y + 12);
      ctx.lineTo(x + 5, y - 2);
      ctx.lineTo(x - 7, y - 2);
      ctx.lineTo(x - 9, y + 14);
      ctx.lineTo(x - 15, y + 12);
      ctx.closePath();
      ctx.fillStyle = '#e8d8a8';
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = a;
      ctx.lineWidth = 2;
      for (let i = 0; i < 9; i++) {
        ctx.beginPath();
        ctx.moveTo(x - 16, y - 18 + i * 4);
        ctx.lineTo(x + 16, y - 18 + i * 4);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 6);
      ctx.quadraticCurveTo(x, y - 24, x + 11, y - 6);
      outline(ctx, undefined, 1.5);
      break;
    case 'plume':
      ctx.beginPath();
      ctx.ellipse(x, y - 8, 11, 7, 0, Math.PI, 0);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(x - 4 + i * 4, y - 22 - i * 2, 3, 10, -0.3 + i * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = i === 1 ? '#c23b22' : '#f4f1e8';
        ctx.fill();
      }
      break;
    case 'braids':
      ctx.strokeStyle = '#1a0f08';
      ctx.lineWidth = 3;
      for (let i = -8; i <= 8; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x + i, y - 10);
        ctx.lineTo(x + i * 1.3, y + 8);
        ctx.stroke();
      }
      ctx.fillStyle = a;
      ctx.fillRect(x - 10, y - 13, 20, 3);
      break;
    case 'turban':
      ctx.beginPath();
      ctx.ellipse(x, y - 11, 13, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#f4f1e8';
      ctx.fill();
      outline(ctx, undefined, 1.5);
      ctx.fillStyle = a;
      ctx.beginPath();
      ctx.ellipse(x + 2, y - 14, 3, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'helm':
      ctx.beginPath();
      ctx.ellipse(x, y - 8, 11, 6, 0, Math.PI, 0);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x - 8 + i * 4, y - 18, 2.5, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#1d1d1d';
        ctx.fill();
      }
      ctx.fillStyle = '#e8dcc0';
      ctx.fillRect(x - 11, y - 9, 22, 3);
      break;
    case 'beads':
      ctx.beginPath();
      ctx.arc(x, y - 3, 11, Math.PI, 0);
      ctx.fillStyle = '#1a0f08';
      ctx.fill();
      for (let i = 0; i < 7; i++) {
        ctx.beginPath();
        ctx.arc(x - 9 + i * 3, y - 12 + Math.abs(i - 3), 2, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 ? a : '#c23b22';
        ctx.fill();
      }
      break;
  }
}

function drawWeapon(ctx: Ctx, hx: number, hy: number, w: Weapon, atk: boolean, bob: number) {
  ctx.lineCap = 'round';
  switch (w) {
    case 'spear': {
      const ang = atk ? -0.15 : -1.35;
      const len = 70;
      const bx = hx - Math.cos(ang) * 22;
      const by = hy - Math.sin(ang) * 22;
      const tx = hx + Math.cos(ang) * len;
      const ty = hy + Math.sin(ang) * len;
      ctx.strokeStyle = '#5b3218';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, -4);
      ctx.lineTo(16, 0);
      ctx.lineTo(0, 4);
      ctx.closePath();
      ctx.fillStyle = '#cfd4d9';
      ctx.fill();
      outline(ctx, undefined, 1.2);
      ctx.restore();
      break;
    }
    case 'bow':
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hx - 4, hy, 22, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = '#efe4c8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx - 4 + Math.cos(-1.2) * 22, hy + Math.sin(-1.2) * 22);
      ctx.lineTo(atk ? hx - 14 : hx - 4, hy);
      ctx.lineTo(hx - 4 + Math.cos(1.2) * 22, hy + Math.sin(1.2) * 22);
      ctx.stroke();
      break;
    case 'sling':
      ctx.strokeStyle = '#a07a4a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + (atk ? 18 : -2), hy + (atk ? -18 : 20));
      ctx.stroke();
      ellipse(ctx, hx + (atk ? 18 : -2), hy + (atk ? -18 : 20), 3.5, 3.5);
      ctx.fillStyle = '#8f8a80';
      ctx.fill();
      break;
    case 'staff':
      ctx.strokeStyle = '#6b4220';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx, hy + 38 - bob);
      ctx.lineTo(hx + (atk ? 10 : 2), hy - 40);
      ctx.stroke();
      ellipse(ctx, hx + (atk ? 10 : 2), hy - 42, 6, 6);
      ctx.fillStyle = '#e0b84a';
      ctx.fill();
      break;
    case 'club':
    case 'axe': {
      const ang = atk ? 0.2 : -1.0;
      const tx = hx + Math.cos(ang) * 32;
      const ty = hy + Math.sin(ang) * 32;
      ctx.strokeStyle = '#5b3218';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      if (w === 'club') {
        ellipse(ctx, tx, ty, 7, 7);
        ctx.fillStyle = '#6b4220';
        ctx.fill();
        outline(ctx, undefined, 1.5);
      } else {
        ctx.fillStyle = '#9aa3ad';
        ctx.beginPath();
        ctx.moveTo(tx - 4, ty - 2);
        ctx.lineTo(tx + 6, ty - 12);
        ctx.lineTo(tx + 8, ty + 6);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'basket':
      ellipse(ctx, hx + 2, hy - 2, 11, 7);
      ctx.fillStyle = '#b98a45';
      ctx.fill();
      outline(ctx, undefined, 1.5);
      break;
    case 'none':
      break;
  }
}

// ---------------------------------------------------------------- animals

function quadruped(
  ctx: Ctx,
  x: number,
  fy: number,
  frame: number,
  o: { body: string; belly: string; len: number; h: number; head: number; spots?: string; mane?: string; slope?: number; tail?: string; ears?: 'round' | 'pointy' },
) {
  ctx.save();
  ctx.translate(x, fy);
  shadow(ctx, 0, 0, o.len * 0.7, 9, 0.4);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const atk = frame === 3;
  const slope = o.slope ?? 0;
  const L = o.len / 2;
  const legTop = -o.h * 0.55;
  const legs: [number, number, string][] = [
    [-L * 0.65, step * 7, shade(o.body, -0.35)],
    [L * 0.55, -step * 7, shade(o.body, -0.35)],
    [-L * 0.45, -step * 7, o.body],
    [L * 0.75, step * 7, o.body],
  ];
  for (const [lx, off, c] of legs) {
    ctx.strokeStyle = 'rgba(30,16,8,0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(lx, legTop + (lx > 0 ? -slope : slope));
    ctx.lineTo(lx + off, -2);
    ctx.stroke();
    ctx.strokeStyle = c;
    ctx.lineWidth = 5;
    ctx.stroke();
  }
  // Tail.
  ctx.strokeStyle = o.tail ?? shade(o.body, -0.3);
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-L, -o.h * 0.75 + slope);
  ctx.quadraticCurveTo(-L - 14, -o.h * 0.6, -L - 10 + step * 3, -o.h * 0.3);
  ctx.stroke();
  // Body.
  ctx.beginPath();
  ctx.moveTo(-L, -o.h * 0.5 + slope);
  ctx.quadraticCurveTo(-L - 4, -o.h + slope, -L * 0.4, -o.h + slope * 0.6);
  ctx.quadraticCurveTo(L * 0.4, -o.h * 1.08 - slope * 0.4, L, -o.h * 0.9 - slope);
  ctx.quadraticCurveTo(L + 6, -o.h * 0.55 - slope, L * 0.7, -o.h * 0.42 - slope);
  ctx.quadraticCurveTo(0, -o.h * 0.32, -L, -o.h * 0.5 + slope);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -o.h * 1.1, 0, -o.h * 0.3);
  g.addColorStop(0, shade(o.body, 0.15));
  g.addColorStop(0.7, o.body);
  g.addColorStop(1, o.belly);
  ctx.fillStyle = g;
  ctx.fill();
  if (o.spots) {
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 14; i++) {
      ellipse(ctx, rr(-L, L), -o.h * rr(0.45, 1), rr(2.5, 4.5), rr(2, 3.5));
      ctx.fillStyle = o.spots;
      ctx.fill();
    }
    ctx.restore();
  }
  outline(ctx, undefined, 2.2);
  if (o.mane) {
    ellipse(ctx, L * 0.92, -o.h * 0.95 - slope, o.head * 1.45, o.head * 1.55);
    ctx.fillStyle = o.mane;
    ctx.fill();
    outline(ctx, undefined, 2);
  }
  // Head.
  const hx = L + o.head * 0.6 + (atk ? 8 : 0);
  const hy = -o.h * 0.95 - slope + (atk ? 6 : 0);
  ellipse(ctx, hx, hy, o.head, o.head * 0.85);
  ctx.fillStyle = o.body;
  ctx.fill();
  outline(ctx, undefined, 2);
  ellipse(ctx, hx + o.head * 0.8, hy + o.head * 0.25, o.head * 0.6, o.head * 0.45);
  ctx.fillStyle = shade(o.body, -0.2);
  ctx.fill();
  outline(ctx, undefined, 1.8);
  ctx.fillStyle = '#140a04';
  ellipse(ctx, hx + o.head * 1.3, hy + o.head * 0.15, 2.5, 2);
  ctx.fill();
  ellipse(ctx, hx + o.head * 0.2, hy - o.head * 0.3, 2.2, 2.2);
  ctx.fillStyle = atk ? '#ffda4a' : '#140a04';
  ctx.fill();
  // Ears.
  ctx.fillStyle = shade(o.body, -0.15);
  ctx.beginPath();
  if (o.ears === 'pointy') {
    ctx.moveTo(hx - o.head * 0.5, hy - o.head * 0.6);
    ctx.lineTo(hx - o.head * 0.3, hy - o.head * 1.8);
    ctx.lineTo(hx + o.head * 0.1, hy - o.head * 0.7);
  } else {
    ctx.ellipse(hx - o.head * 0.4, hy - o.head * 0.95, o.head * 0.35, o.head * 0.45, -0.3, 0, Math.PI * 2);
  }
  ctx.fill();
  outline(ctx, undefined, 1.5);
  if (atk) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(hx + o.head * 0.9, hy + o.head * 0.5, 3, 4);
    ctx.fillRect(hx + o.head * 1.2, hy + o.head * 0.5, 3, 4);
  }
  ctx.restore();
}

function serpentDragon(ctx: Ctx, x: number, fy: number, frame: number) {
  // Ninki Nanka: a great swamp serpent-dragon with a crest, from Mande folklore.
  ctx.save();
  ctx.translate(x, fy);
  shadow(ctx, 0, 0, 90, 18, 0.45);
  const w = frame === 1 ? 6 : frame === 2 ? -6 : 0;
  ctx.lineCap = 'round';
  const seg = (lw: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(-100, -12);
    ctx.bezierCurveTo(-60, -50 + w, -30, 10 - w, 0, -30);
    ctx.bezierCurveTo(26, -60 + w, 40, -70, 60, -100);
    ctx.stroke();
  };
  seg(40, 'rgba(20,30,10,0.9)');
  seg(34, '#3f6b2a');
  seg(14, '#7aa04a');
  // Belly plates.
  ctx.strokeStyle = '#d9c27a';
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const t = i / 8;
    const px = -90 + t * 150;
    const py = -20 - t * 70 + Math.sin(t * 6 + w * 0.1) * 12;
    ctx.beginPath();
    ctx.moveTo(px - 6, py + 12);
    ctx.lineTo(px + 6, py + 14);
    ctx.stroke();
  }
  // Head with crest and horns.
  const hx = 66 + (frame === 3 ? 12 : 0);
  const hy = -108;
  ellipse(ctx, hx, hy, 26, 18);
  ctx.fillStyle = '#3f6b2a';
  ctx.fill();
  outline(ctx, undefined, 2.5);
  ellipse(ctx, hx + 22, hy + 6, 16, 10);
  ctx.fillStyle = '#4f7f34';
  ctx.fill();
  outline(ctx, undefined, 2);
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 18 + i * 8, hy - 14);
    ctx.lineTo(hx - 24 + i * 8, hy - 36 - (i % 2) * 8);
    ctx.lineTo(hx - 12 + i * 8, hy - 16);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#c23b22' : '#e0b84a';
    ctx.fill();
    outline(ctx, undefined, 1.5);
  }
  ellipse(ctx, hx + 6, hy - 4, 4, 4);
  ctx.fillStyle = '#ffda4a';
  ctx.fill();
  if (frame === 3) {
    ctx.fillStyle = 'rgba(255,140,40,0.85)';
    ctx.beginPath();
    ctx.moveTo(hx + 36, hy + 6);
    ctx.lineTo(hx + 60, hy - 6);
    ctx.lineTo(hx + 62, hy + 18);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function lightningBird(ctx: Ctx, x: number, fy: number, frame: number) {
  // Impundulu: the black-and-white lightning bird of Zulu and Xhosa lore.
  ctx.save();
  ctx.translate(x, fy);
  shadow(ctx, 0, 0, 40, 10, 0.3);
  ctx.translate(0, -70);
  const flap = frame === 1 ? -1 : frame === 2 ? 1 : 0;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.quadraticCurveTo(side * 40, -50 + flap * 26, side * 78, -20 + flap * 30);
    ctx.quadraticCurveTo(side * 40, -6, 0, 6);
    ctx.closePath();
    ctx.fillStyle = side < 0 ? '#1d1d24' : '#2c2c36';
    ctx.fill();
    outline(ctx, undefined, 2);
    ctx.strokeStyle = '#f4f1e8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(side * 30, -24 + flap * 12);
    ctx.lineTo(side * 64, -18 + flap * 24);
    ctx.stroke();
  }
  ellipse(ctx, 0, 0, 18, 24);
  ctx.fillStyle = '#f4f1e8';
  ctx.fill();
  outline(ctx, undefined, 2);
  ellipse(ctx, 10, -26, 12, 11);
  ctx.fillStyle = '#1d1d24';
  ctx.fill();
  outline(ctx, undefined, 2);
  ctx.fillStyle = '#e0b84a';
  ctx.beginPath();
  ctx.moveTo(20, -28);
  ctx.lineTo(34, -24);
  ctx.lineTo(20, -20);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 13, -29, 2.5, 2.5);
  ctx.fillStyle = '#ff3b3b';
  ctx.fill();
  // Crackling lightning.
  ctx.strokeStyle = frame === 3 ? '#fff6a0' : 'rgba(170,220,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-4, 22);
  ctx.lineTo(4, 34);
  ctx.lineTo(-4, 42);
  ctx.lineTo(6, 58);
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- catalogue

export const SURVIVOR_LOOKS: PersonLook[] = [
  { skin: '#6b3f24', cloth: '#c2733a', cloth2: '#2d5fa6', head: 'bare', weapon: 'none' },
  { skin: '#5a321c', cloth: '#2e6b4f', cloth2: '#f0c33c', head: 'wrap', weapon: 'none' },
  { skin: '#4a2a17', cloth: '#8c2f39', cloth2: '#e9dcc0', head: 'wrap', weapon: 'none' },
  { skin: '#7a4a2a', cloth: '#d9b36a', cloth2: '#c23b22', head: 'bare', weapon: 'none' },
  { skin: '#3f2414', cloth: '#5b4a8a', cloth2: '#f0c33c', head: 'wrap', weapon: 'none' },
];

export const CHIEF_LOOK: PersonLook = { skin: '#5a321c', cloth: '#7a2e1a', cloth2: '#f0c33c', head: 'beads', weapon: 'staff', cape: '#c99a4e', accent: '#2d5fa6' };
export const GUARD_LOOK: PersonLook = { skin: '#4a2a17', cloth: '#e9dcc0', cloth2: '#3a2414', head: 'plume', weapon: 'spear', shield: true };
export const RAIDER_LOOK: PersonLook = { skin: '#5a3a28', cloth: '#3a2a3e', cloth2: '#8c1c1c', head: 'mask', weapon: 'club' };
export const SLINGER_LOOK: PersonLook = { skin: '#5a3a28', cloth: '#4a3a2e', cloth2: '#8c1c1c', head: 'mask', weapon: 'sling' };
export const WARLORD_LOOK: PersonLook = { skin: '#4a2e20', cloth: '#1d1d24', cloth2: '#c23b22', head: 'mask', weapon: 'axe', cape: '#8c1c1c', shield: true };

export function paintUnits(heroLooks: { id: string; look: PersonLook }[]): SheetInfo[] {
  const person = (key: string, look: PersonLook, s = 1, seed = 1) => sheet(key, FW, FH, UNIT_FRAMES, FOOT_Y, (c, x, y, f) => drawPerson(c, x, y, f, look, s), seed);
  const out: SheetInfo[] = [];
  SURVIVOR_LOOKS.forEach((l, i) => out.push(person(`u_survivor${i}`, l, 0.95, i + 1)));
  SURVIVOR_LOOKS.forEach((l, i) => out.push(person(`u_worker${i}`, { ...l, weapon: i % 2 ? 'basket' : 'axe' }, 0.95, i + 1)));
  out.push(person('u_chief', CHIEF_LOOK, 1.05));
  out.push(person('u_guard', GUARD_LOOK, 1));
  out.push(person('u_raider', RAIDER_LOOK, 1));
  out.push(person('u_slinger', SLINGER_LOOK, 1));
  out.push(person('u_warlord', WARLORD_LOOK, 1));
  for (const h of heroLooks) out.push(person(`u_hero_${h.id}`, h.look, 1));
  out.push(
    sheet('u_hyena', FW, FH, UNIT_FRAMES, FOOT_Y, (c, x, y, f) =>
      quadruped(c, x, y, f, { body: '#a88a5a', belly: '#d8c08a', len: 70, h: 44, head: 11, spots: '#4a3420', slope: 8, ears: 'round' }),
    ),
  );
  out.push(
    sheet('u_jackal', FW, FH, UNIT_FRAMES, FOOT_Y, (c, x, y, f) =>
      quadruped(c, x, y, f, { body: '#b4683a', belly: '#e8d0a8', len: 56, h: 36, head: 9, ears: 'pointy', tail: '#2a1a10' }),
    ),
  );
  out.push(
    sheet('u_lion', FW, FH, UNIT_FRAMES, FOOT_Y, (c, x, y, f) =>
      quadruped(c, x, y, f, { body: '#d0a050', belly: '#ecd3a0', len: 84, h: 52, head: 13, mane: '#7a4a1e', ears: 'round', tail: '#7a4a1e' }),
    ),
  );
  out.push(sheet('u_ninki', 260, 200, UNIT_FRAMES, 186, (c, x, y, f) => serpentDragon(c, x, y, f)));
  out.push(sheet('u_impundulu', 200, 200, UNIT_FRAMES, 186, (c, x, y, f) => lightningBird(c, x, y, f)));
  return out;
}

/** Bust portrait for hero cards. */
export function paintPortrait(look: PersonLook, bg: string, size = 192): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size * 0.35, size * 0.1, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, shade(bg, 0.35));
  g.addColorStop(1, shade(bg, -0.45));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Sun rays.
  ctx.save();
  ctx.translate(size / 2, size * 0.45);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = 'rgba(255,240,200,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(size, -size * 0.12);
    ctx.lineTo(size, size * 0.12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.translate(size / 2, size * 1.02);
  const s = size / 70;
  ctx.scale(s, s);
  // Shoulders.
  ctx.beginPath();
  ctx.moveTo(-30, 0);
  ctx.quadraticCurveTo(-28, -26, -10, -30);
  ctx.lineTo(10, -30);
  ctx.quadraticCurveTo(28, -26, 30, 0);
  ctx.closePath();
  ctx.fillStyle = look.cloth;
  ctx.fill();
  outline(ctx, undefined, 1.2);
  ctx.fillStyle = look.cloth2;
  ctx.fillRect(-30, -14, 60, 4);
  if (look.cape) {
    ctx.fillStyle = look.cape;
    ctx.fillRect(-30, -10, 60, 3);
  }
  // Neck and head.
  ctx.fillStyle = shade(look.skin, -0.15);
  ctx.fillRect(-5, -36, 10, 8);
  ctx.save();
  ctx.scale(1.25, 1.25);
  drawMane(ctx, 0, -38.5, look);
  ctx.restore();
  ellipse(ctx, 0, -47, 12, 14);
  ctx.fillStyle = look.skin;
  ctx.fill();
  outline(ctx, undefined, 1.2);
  ctx.fillStyle = '#140a04';
  ellipse(ctx, -4.5, -48, 1.6, 1.4);
  ctx.fill();
  ellipse(ctx, 4.5, -48, 1.6, 1.4);
  ctx.fill();
  ctx.strokeStyle = shade(look.skin, -0.45);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -41, 3.5, 0.2, Math.PI - 0.2);
  ctx.stroke();
  ctx.scale(1.25, 1.25);
  drawHeadwear(ctx, 0, -38.5, look);
  ctx.restore();
  return c;
}
