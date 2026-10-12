import * as THREE from 'three';

/** Canvas-painted tiling textures for the procedural African buildings. */

let seed = 7;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function toTexture(c: HTMLCanvasElement, repeatX = 1, repeatY = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function hex(c: string) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, base: string, amount: number, spread: number, size = 3) {
  const [r, g, b] = hex(base);
  for (let i = 0; i < amount; i++) {
    const d = (rnd() - 0.5) * spread;
    ctx.fillStyle = `rgba(${r + d},${g + d},${b + d * 0.8},${0.35 + rnd() * 0.4})`;
    const s = size * (0.5 + rnd());
    ctx.fillRect(rnd() * w, rnd() * h, s, s * 0.7);
  }
}

const cache = new Map<string, THREE.Texture>();
function cached(key: string, make: () => THREE.Texture) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key)!;
}

/** Smoothed mud plaster with hand marks. */
export function mudTexture(base = '#b8693a') {
  return cached(`mud${base}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 256, 256, base, 2600, 50, 4);
    // Horizontal smoothing strokes left by hands.
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '255,230,200' : '60,30,10'},0.08)`;
      ctx.lineWidth = 2 + rnd() * 5;
      ctx.beginPath();
      const y = rnd() * 256;
      ctx.moveTo(rnd() * 256, y);
      ctx.quadraticCurveTo(rnd() * 256, y + (rnd() - 0.5) * 20, rnd() * 256, y + (rnd() - 0.5) * 10);
      ctx.stroke();
    }
    return toTexture(c, 3, 1);
  });
}

/**
 * Mud wall with a painted geometric band (Ndebele / Sotho style). The band sits
 * in the upper part of the wall; v = 0 is the bottom of a cylinder.
 */
export function paintedWallTexture(base: string, colors: string[]) {
  return cached(`wall${base}${colors.join()}`, () => {
    const [c, ctx] = canvas(512, 256);
    ctx.drawImage((mudTexture(base).image as HTMLCanvasElement), 0, 0, 512, 256);
    const top = 60;
    const h = 56;
    const n = 12;
    const w = 512 / n;
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, top - 6, 512, 6);
    ctx.fillRect(0, top + h, 512, 6);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = colors[1 + (i % (colors.length - 1))];
      ctx.beginPath();
      ctx.moveTo(i * w, top + h);
      ctx.lineTo(i * w + w / 2, top);
      ctx.lineTo(i * w + w, top + h);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors[0];
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = colors[0];
      ctx.fillRect(i * w + w / 2 - 4, top + h - 22, 8, 14);
    }
    // Weathering over the paint.
    speckle(ctx, 512, 256, base, 600, 40, 3);
    // Darker splash zone at the foot of the wall.
    const g = ctx.createLinearGradient(0, 200, 0, 256);
    g.addColorStop(0, 'rgba(60,30,10,0)');
    g.addColorStop(1, 'rgba(60,30,10,0.45)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 200, 512, 56);
    return toTexture(c, 1, 1);
  });
}

/** Straw thatch for cone roofs: strands running from apex (v = 1) to eaves (v = 0). */
export function thatchTexture(base = '#c99a4e') {
  return cached(`thatch${base}`, () => {
    const [c, ctx] = canvas(512, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 256);
    const [r, g, b] = hex(base);
    for (let i = 0; i < 2600; i++) {
      const x = rnd() * 512;
      const y = rnd() * 256;
      const d = (rnd() - 0.5) * 90;
      ctx.strokeStyle = `rgba(${r + d},${g + d},${b + d * 0.6},0.7)`;
      ctx.lineWidth = 1 + rnd() * 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 4, y + 14 + rnd() * 26);
      ctx.stroke();
    }
    // Tied rings.
    for (const y of [70, 150]) {
      ctx.fillStyle = 'rgba(70,45,20,0.45)';
      ctx.fillRect(0, y, 512, 5);
    }
    // Ragged dark eaves.
    for (let x = 0; x < 512; x += 3) {
      ctx.strokeStyle = 'rgba(80,50,20,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 256);
      ctx.lineTo(x + 1, 236 - rnd() * 14);
      ctx.stroke();
    }
    return toTexture(c, 2, 1);
  });
}

export function stoneTexture(base = '#a29d92') {
  return cached(`stone${base}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    // Dry-stone courses.
    let y = 0;
    while (y < 256) {
      const h = 18 + rnd() * 14;
      let x = -rnd() * 40;
      while (x < 256) {
        const w = 30 + rnd() * 40;
        const [r, g, b] = hex(base);
        const d = (rnd() - 0.5) * 40;
        ctx.fillStyle = `rgb(${r + d},${g + d},${b + d})`;
        ctx.fillRect(x + 2, y + 2, w - 3, h - 3);
        x += w;
      }
      y += h;
    }
    speckle(ctx, 256, 256, base, 1500, 60, 2);
    return toTexture(c, 2, 1);
  });
}

export function woodTexture(base = '#7a4b28') {
  return cached(`wood${base}`, () => {
    const [c, ctx] = canvas(128, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '40,20,5' : '200,150,100'},0.25)`;
      ctx.lineWidth = 1 + rnd() * 2;
      const x = rnd() * 128;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rnd() - 0.5) * 10, 256);
      ctx.stroke();
    }
    return toTexture(c, 1, 1);
  });
}

export function barkTexture() {
  return cached('bark', () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#9b8672';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 160; i++) {
      ctx.strokeStyle = `rgba(${rnd() > 0.5 ? '70,55,45' : '200,185,165'},0.35)`;
      ctx.lineWidth = 1 + rnd() * 3;
      const x = rnd() * 256;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (rnd() - 0.5) * 30, 80, x + (rnd() - 0.5) * 30, 170, x + (rnd() - 0.5) * 20, 256);
      ctx.stroke();
    }
    return toTexture(c, 2, 1);
  });
}

/** Fine grain multiplied over the terrain's vertex colours. */
export function groundDetailTexture() {
  return cached('ground', () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const v = 200 + rnd() * 55;
      ctx.fillStyle = `rgb(${v},${v},${v * 0.97})`;
      ctx.fillRect(rnd() * 256, rnd() * 256, 2, 2);
    }
    // Short grass strokes.
    for (let i = 0; i < 1400; i++) {
      const v = 175 + rnd() * 60;
      ctx.strokeStyle = `rgb(${v},${v},${v * 0.9})`;
      ctx.lineWidth = 1.2;
      const x = rnd() * 256;
      const y = rnd() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rnd() - 0.5) * 3, y - 3 - rnd() * 5);
      ctx.stroke();
    }
    const t = toTexture(c, 1, 1);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  });
}

export function glowTexture() {
  return cached('glow', () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,220,140,1)');
    g.addColorStop(0.35, 'rgba(255,150,60,0.45)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

export function shadowBlobTexture() {
  return cached('blob', () => {
    const [c, ctx] = canvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  });
}
