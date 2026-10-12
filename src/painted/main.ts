// Portrait prototype using AI-painted art: cutaway rooms on an isometric grass map,
// villagers walking the paths, and the real economy driving production and upgrades.
import '@fontsource/lilita-one';
import '@fontsource/nunito/800.css';
import Phaser from 'phaser';
import { iconUrl } from '../art/registry';
import { BUILDINGS, levelCost } from '../data/buildings';
import type { ResId } from '../data/resources';
import * as eco from '../sim/economy';
import { newGame, type BuildingState } from '../sim/state';
import './painted.css';

/** World units: a grass tile is 128 wide; its diamond is 0.61 as tall (the art's angle). */
const TW = 128;
const TH = TW * 0.613;
const MAP = 15;

function iso(x: number, y: number) {
  return { x: (x - y) * (TW / 2), y: (x + y) * (TH / 2) };
}

/** Plot (3x3 tiles, top-left tile) → building type and art per tier. */
interface Plot {
  type: string;
  x: number;
  y: number;
  art: string[];
  label?: string;
}

const PLOTS: Plot[] = [
  { type: 'hearth', x: 6, y: 6, art: ['heart'], label: 'Village Baobab' },
  { type: 'forager', x: 2, y: 6, art: ['kitchen_t1'], label: 'Kitchen' },
  { type: 'woodcutter', x: 6, y: 2, art: ['workshop_t1'], label: 'Workshop' },
  { type: 'hut', x: 10, y: 6, art: ['house_t1', 'house_t2'] },
  { type: 'granary', x: 6, y: 10, art: ['granary_t1', 'granary_t2', 'granary_t3'], label: 'Storehouse' },
  { type: 'smelter', x: 2, y: 2, art: ['forge_t1'], label: 'Forge' },
  { type: 'lodge', x: 10, y: 10, art: ['lodge_t1'], label: 'Training Yard' },
  { type: 'hut', x: 10, y: 2, art: ['house_t1', 'house_t2'] },
  { type: 'granary', x: 2, y: 10, art: ['granary_t1', 'granary_t2', 'granary_t3'], label: 'Storehouse' },
];


// ------------------------------------------------------------------ game state

const state = newGame(4242);
state.buildings[0].level = 4;
Object.assign(state.res, { food: 420, water: 380, wood: 640, stone: 520, iron: 60 });
state.pop = 14;
const views = new Map<number, BuildingState>();
for (const p of PLOTS) {
  if (p.type === 'hearth') {
    views.set(PLOTS.indexOf(p), state.buildings[0]);
    continue;
  }
  const b: BuildingState = { uid: state.nextUid++, type: p.type, x: 30 + PLOTS.indexOf(p) * 2, y: 40, level: 1, hp: 300, workers: 0 };
  state.buildings.push(b);
  views.set(PLOTS.indexOf(p), b);
}
eco.autoAssign(state);
const tierOf = (p: Plot, b: BuildingState) => Math.min(p.art.length - 1, b.type === 'granary' ? Math.floor((b.level - 1) / 2) : b.level >= 3 ? 1 : 0);

// ------------------------------------------------------------------ scene

class Village extends Phaser.Scene {
  private rooms = new Map<number, Phaser.GameObjects.Image>();
  private bars = new Map<number, Phaser.GameObjects.Graphics>();
  private walkers: { s: Phaser.GameObjects.Image; path: { x: number; y: number }[]; i: number; t: number; speed: number }[] = [];
  private workers: Phaser.GameObjects.Image[] = [];
  private drag: { x: number; y: number; sx: number; sy: number; moved: boolean } | null = null;
  private pinch: { d: number; z: number } | null = null;
  private floatT = 0;

  constructor() {
    super('village');
  }

  preload() {
    const base = 'painted/';
    this.load.image('grass_fill', `${base}grass_fill.jpg`);
    for (const n of ['tile_grass', 'tile_path_straight', 'tree_baobab', 'tree_acacia', 'kitchen_t1', 'workshop_t1', 'house_t1', 'house_t2', 'granary_t1', 'granary_t2', 'granary_t3', 'forge_t1', 'lodge_t1'])
      this.load.image(n, `${base}${n}.webp`);
    for (let i = 0; i < 9; i++) this.load.image(`pots_${i}`, `${base}pots_${i}.webp`);
    for (let i = 0; i < 4; i++) this.load.image(`worker_${i}`, `${base}worker_${i}.webp`);
  }

  create() {
    this.cameras.main.setBackgroundColor('#5a8a3a');
    this.buildGround();
    this.buildPlots();
    this.scatterNature();
    this.spawnPeople();
    const c = iso(7.2, 6.6);
    const cam = this.cameras.main;
    cam.setZoom(Math.min(1.1, (this.scale.width / 900) * 1.35));
    cam.centerOn(c.x, c.y);
    this.setupInput();
    this.scale.on('resize', () => cam.centerOn(cam.midPoint.x, cam.midPoint.y));
  }

  private buildGround() {
    // Grass blocks; the earth sides only show along the front edges of the island.
    const sGrass = TW / 512;
    for (let y = 0; y < MAP; y++)
      for (let x = 0; x < MAP; x++) {
        const p = iso(x, y);
        const img = this.add.image(p.x, p.y, 'tile_grass').setOrigin(0.5, 160 / 391).setScale(sGrass * 1.01);
        img.setFlipX((x * 7 + y * 3) % 2 === 0);
        img.setDepth(-10000 + (x + y));
      }
    // Seamless grass over the island top so the tile outlines only show at the edge.
    const top = [iso(0.06, 0.06), iso(MAP - 0.06, 0.06), iso(MAP - 0.06, MAP - 0.06), iso(0.06, MAP - 0.06)].map((p) => new Phaser.Math.Vector2(p.x, p.y - TH / 2));
    const minX = Math.min(...top.map((p) => p.x));
    const maxX = Math.max(...top.map((p) => p.x));
    const minY = Math.min(...top.map((p) => p.y));
    const maxY = Math.max(...top.map((p) => p.y));
    const fill = this.add.tileSprite((minX + maxX) / 2, (minY + maxY) / 2, maxX - minX, maxY - minY, 'grass_fill').setDepth(-6000);
    fill.setTileScale(0.32);
    const shape = this.make.graphics({}, false).fillStyle(0xffffff).fillPoints(top, true);
    fill.setMask(shape.createGeometryMask());
    // Dirt paths: a strip of dirt painted along each road, with soft edges.
    const g = this.add.graphics().setDepth(-5000);
    const dirt = 0xb4875a;
    const roads: [number, number, number, number][] = [];
    for (const r of [5, 9]) {
      roads.push([r, 0.6, r, MAP - 0.6]);
      roads.push([0.6, r, MAP - 0.6, r]);
    }
    for (const [width, alpha, color] of [
      [0.92, 0.35, 0x8a6a3e],
      [0.8, 1, dirt],
      [0.42, 0.5, 0xc89a68],
    ] as const) {
      g.fillStyle(color, alpha);
      for (const [x0, y0, x1, y1] of roads) {
        const w = width / 2;
        const pts = x0 === x1 ? [iso(x0 + 0.5 - w, y0), iso(x0 + 0.5 + w, y0), iso(x1 + 0.5 + w, y1), iso(x1 + 0.5 - w, y1)] : [iso(x0, y0 + 0.5 - w), iso(x1, y1 + 0.5 - w), iso(x1, y1 + 0.5 + w), iso(x0, y0 + 0.5 + w)];
        g.fillPoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y - TH / 2)), true);
      }
    }
    // Pebbles along the paths.
    for (let i = 0; i < 160; i++) {
      const r = [5, 9][i % 2];
      const along = 0.8 + ((i * 37) % 130) / 10;
      const off = ((i * 53) % 9) / 10 - 0.4;
      const p = i % 4 < 2 ? iso(r + 0.5 + off, along) : iso(along, r + 0.5 + off);
      g.fillStyle(0x8f877a, 0.9).fillEllipse(p.x, p.y - TH / 2, 6 + (i % 3) * 2, 4 + (i % 2) * 2);
    }
  }

  private buildPlots() {
    PLOTS.forEach((p, i) => {
      const b = views.get(i)!;
      const center = iso(p.x + 1.5, p.y + 1.5);
      const depth = (p.x + p.y + 3) * 10;
      if (p.art[0] === 'heart') {
        const tree = this.add.image(center.x, center.y - TH / 2 + 40, 'tree_baobab').setOrigin(0.5, 0.92).setScale(0.46).setDepth(depth);
        tree.setInteractive({ pixelPerfect: true, alphaTolerance: 40 });
        tree.on('pointerup', () => this.tapBuilding(i));
        this.rooms.set(i, tree);
        // Pots and a fire circle under the tree.
        [
          [-120, 10, 3],
          [125, 5, 1],
          [70, 45, 5],
          [-75, 45, 8],
        ].forEach(([dx, dy, k]) => this.add.image(center.x + dx, center.y - TH / 2 + 40 + dy, `pots_${k}`).setScale(0.13).setOrigin(0.5, 1).setDepth(depth + 1));
        return;
      }
      const key = p.art[tierOf(p, b)];
      // A room covers its 3x3 plot; the art's floor centre sits at ~62% of its height.
      const img = this.add.image(center.x, center.y - TH / 2, key).setOrigin(0.5, 0.6).setScale((TW * 2.85) / 720).setDepth(depth);
      img.setInteractive({ pixelPerfect: true, alphaTolerance: 40 });
      img.on('pointerup', () => this.tapBuilding(i));
      this.rooms.set(i, img);
      this.bars.set(i, this.add.graphics().setDepth(depth + 500));
    });
  }

  private scatterNature() {
    const spots: [string, number, number, number][] = [];
    for (let i = 0; i < 26; i++) {
      const edge = i % 4;
      const t = ((i * 37) % 13) + 1;
      const [x, y] = edge === 0 ? [0.4, t] : edge === 1 ? [t, 0.4] : edge === 2 ? [MAP - 0.5, t] : [t, MAP - 0.5];
      spots.push([i % 5 === 0 ? 'tree_baobab' : 'tree_acacia', x, y, i % 5 === 0 ? 0.32 : 0.34 + (i % 3) * 0.04]);
    }
    spots.push(['tree_acacia', 5.5, 0.3, 0.3], ['tree_acacia', 9.4, 13.8, 0.3], ['tree_acacia', 4.6, 4.6, 0.22], ['tree_acacia', 9.6, 4.5, 0.22]);
    for (const [k, x, y, s] of spots) {
      const p = iso(x, y);
      this.add.image(p.x, p.y, k).setOrigin(0.5, 0.88).setScale(s).setDepth((x + y) * 10);
    }
    // Pots by the doors of a few rooms.
    for (let i = 0; i < 10; i++) {
      const p = PLOTS[(i % 8) + 1];
      const pos = iso(p.x + 3.1, p.y + 1 + (i % 3) * 0.6);
      this.add.image(pos.x, pos.y - TH / 2, `pots_${(i * 3) % 9}`).setOrigin(0.5, 1).setScale(0.16).setDepth((p.x + p.y + 4.5) * 10);
    }
  }

  private spawnPeople() {
    // Walkers loop around the road grid.
    const loops = [
      [iso(5.5, 1), iso(5.5, 13.5), iso(9.5, 13.5), iso(9.5, 1)],
      [iso(1, 5.5), iso(13.5, 5.5), iso(13.5, 9.5), iso(1, 9.5)],
      [iso(5.5, 5.5), iso(9.5, 5.5), iso(9.5, 9.5), iso(5.5, 9.5)],
    ];
    for (let k = 0; k < 9; k++) {
      const path = loops[k % 3].map((p) => ({ x: p.x, y: p.y - TH / 2 }));
      const s = this.add.image(0, 0, 'worker_2').setOrigin(0.5, 0.97).setScale(0.105);
      this.walkers.push({ s, path, i: k % 4, t: (k * 0.37) % 1, speed: 38 + (k % 3) * 8 });
    }
    // A couple of workers busy at the door of rooms.
    [
      [2, 'worker_3'],
      [5, 'worker_3'],
      [1, 'worker_0'],
    ].forEach(([pi, key]) => {
      const p = PLOTS[pi as number];
      const pos = iso(p.x + 3.25, p.y + 1.8);
      const s = this.add.image(pos.x, pos.y - TH / 2, key as string).setOrigin(0.5, 0.97).setScale(0.105).setDepth((p.x + p.y + 5) * 10);
      this.workers.push(s);
    });
  }

  private setupInput() {
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const a = this.input.pointer1;
      const b = this.input.pointer2;
      if (a.isDown && b.isDown) {
        this.pinch = { d: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), z: this.cameras.main.zoom };
        this.drag = null;
        return;
      }
      this.drag = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY, moved: false };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (this.pinch) {
        const a = this.input.pointer1;
        const b = this.input.pointer2;
        if (a.isDown && b.isDown) cam.setZoom(Phaser.Math.Clamp(this.pinch.z * (Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / this.pinch.d), 0.35, 2.2));
        return;
      }
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (Math.hypot(dx, dy) > 8) this.drag.moved = true;
      cam.setScroll(this.drag.sx - dx / cam.zoom, this.drag.sy - dy / cam.zoom);
    });
    this.input.on('pointerup', () => {
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
      setTimeout(() => (this.drag = null), 0);
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 0.35, 2.2));
    });
  }

  private tapBuilding(i: number) {
    if (this.drag?.moved) return;
    ui.open(i);
    const img = this.rooms.get(i)!;
    this.tweens.add({ targets: img, scaleY: { from: img.scaleX * 1.04, to: img.scaleX }, duration: 220, ease: 'Back.Out' });
  }

  refreshRoom(i: number) {
    const p = PLOTS[i];
    const b = views.get(i)!;
    const img = this.rooms.get(i);
    if (!img || p.art[0] === 'heart') return;
    const key = p.art[tierOf(p, b)];
    if (img.texture.key !== key) {
      img.setTexture(key);
      this.tweens.add({ targets: img, alpha: { from: 0.3, to: 1 }, duration: 500 });
    }
  }

  floater(i: number, text: string, icon: string) {
    const p = PLOTS[i];
    const c = iso(p.x + 1.5, p.y + 1.5);
    const el = this.add.dom(c.x, c.y - 120).createFromHTML(`<div class="float"><img src="${icon}">${text}</div>`);
    el.setDepth(9000);
    this.tweens.add({ targets: el, y: el.y - 50, alpha: 0, duration: 1600, ease: 'Cubic.Out', onComplete: () => el.destroy() });
  }

  update(_t: number, dms: number) {
    const dt = Math.min(0.1, dms / 1000);
    for (const e of eco.tick(state, dt)) if (e.type === 'built') {
      for (const [i, b] of views) if (b.uid === e.uid) this.refreshRoom(i);
    }
    for (const w of this.walkers) {
      const a = w.path[w.i];
      const b = w.path[(w.i + 1) % w.path.length];
      const len = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      w.t += (w.speed * dt) / len;
      if (w.t >= 1) {
        w.t = 0;
        w.i = (w.i + 1) % w.path.length;
      }
      const x = a.x + (b.x - a.x) * w.t;
      const y = a.y + (b.y - a.y) * w.t;
      w.s.setPosition(x, y - Math.abs(Math.sin(w.t * len * 0.12)) * 3);
      w.s.setFlipX(b.x < a.x);
      w.s.setDepth(((x / (TW / 2) + y / (TH / 2)) / 2 + (y / (TH / 2) - x / (TW / 2)) / 2) * 10 + 15);
    }
    for (const [k, s] of this.workers.entries()) s.setAngle(Math.sin(this.time.now / 180 + k) * 6);
    // Construction progress bars.
    for (const [i, g] of this.bars) {
      const b = views.get(i)!;
      g.clear();
      if (!b.construct) continue;
      const p = PLOTS[i];
      const c = iso(p.x + 1.5, p.y + 1.5);
      const pct = 1 - (b.construct.end - state.time) / b.construct.total;
      g.fillStyle(0x2a160a, 0.85).fillRoundedRect(c.x - 62, c.y - 150, 124, 16, 7);
      g.fillStyle(0xf2b33d, 1).fillRoundedRect(c.x - 60, c.y - 148, Math.max(8, 120 * pct), 12, 5);
    }
    this.floatT += dt;
    if (this.floatT > 5) {
      this.floatT = 0;
      for (const [i, b] of views) {
        const r = eco.buildingRate(state, b);
        if (r && r.perMin > 0) this.floater(i, `+${Math.max(1, Math.round((r.perMin * 5) / 60))}`, iconUrl(r.res as ResId));
      }
    }
    ui.render();
  }
}

// ------------------------------------------------------------------ HUD

const RES: ResId[] = ['food', 'water', 'wood', 'stone'];
const ui = {
  hud: document.getElementById('hud')!,
  panel: document.getElementById('panel')!,
  sel: -1,
  last: '',
  render() {
    const html = RES.map((r) => `<div class="res"><img src="${iconUrl(r)}"><b>${Math.floor(state.res[r])}</b></div>`).join('') + `<div class="res pop"><img src="${iconUrl('pop')}"><b>${state.pop}</b></div>`;
    if (html !== this.last) {
      this.last = html;
      this.hud.innerHTML = html;
    }
    if (this.sel >= 0) this.renderPanel();
  },
  open(i: number) {
    this.sel = i;
    this.panel.hidden = false;
    this.renderPanel();
  },
  renderPanel() {
    const p = PLOTS[this.sel];
    const b = views.get(this.sel)!;
    const d = BUILDINGS[b.type];
    const name = p.label ?? d.name;
    const rate = eco.buildingRate(state, b);
    let action = '';
    if (b.construct) {
      action = `<div class="busy">Upgrading… ${Math.ceil(b.construct.end - state.time)}s</div>`;
    } else if (b.level < d.maxLevel) {
      const check = eco.upgradeCheck(state, b);
      const cost = levelCost(d, b.level + 1);
      const chips = Object.entries(cost)
        .map(([k, v]) => `<span class="chip ${state.res[k as ResId] < (v as number) ? 'bad' : ''}"><img src="${iconUrl(k as ResId)}">${v}</span>`)
        .join('');
      action = `<button id="up" ${check.ok ? '' : 'disabled'}>Upgrade to ${b.level + 1}<span>${chips}</span>${check.ok || check.reason === 'Not enough resources' ? '' : `<small>${check.reason}</small>`}</button>`;
    }
    const tiers = p.art.length > 1 ? `<div class="tier">Look changes at ${p.type === 'granary' ? 'levels 3 and 5' : 'level 3'}</div>` : '';
    const html = `<div class="ph"><h2>${name}</h2><span>Level ${b.level}</span><button id="x">✕</button></div>
      <p>${d.desc}</p>${rate ? `<div class="stat"><img src="${iconUrl(rate.res as ResId)}"> ${rate.perMin.toFixed(1)} / min · ${b.workers} workers</div>` : ''}${tiers}${action}`;
    if (this.panel.innerHTML !== html) this.panel.innerHTML = html;
  },
};
ui.panel.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  if (t.closest('#x')) {
    ui.sel = -1;
    ui.panel.hidden = true;
  }
  if (t.closest('#up')) {
    const b = views.get(ui.sel)!;
    eco.startUpgrade(state, b.uid);
    // Prototype: finish quickly so the new look shows.
    if (b.construct) {
      b.construct.total = Math.min(b.construct.total, 4);
      b.construct.end = state.time + b.construct.total;
    }
    ui.renderPanel();
  }
});

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#5a8a3a',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  dom: { createContainer: true },
  render: { antialias: true },
  input: { activePointers: 3 },
  scene: [Village],
});
Object.assign(window, { game, state });
