import Phaser from 'phaser';
import { buildingTier, hearthFireOffset } from '../art/buildings';
import { ART_SCALE } from '../art/paint';
import { ORIGINS } from '../art/registry';
import { TILE_VARIANTS } from '../art/nature';
import { BUILDINGS, defenseAt } from '../data/buildings';
import { ENEMIES, waveComposition, waveStrength } from '../data/enemies';
import { HERO_BY_ID, heroStats } from '../data/heroes';
import { dayAt, dayPhase, isNight, seasonAt, NIGHT_FRACTION, DAY_LENGTH } from '../data/seasons';
import { game } from '../game';
import * as eco from '../sim/economy';
import { HEARTH_POS, MAP_SIZE, Tile, type BuildingState, type NodeState } from '../sim/state';
import { hash2 } from '../sim/rng';
import { depthAt, footprintCenter, tileToWorld, TH, TW, worldToTile } from '../world/iso';
import { Unit } from '../world/units';
import type { FxScene } from './FxScene';

interface BuildingView {
  uid: number;
  sprite: Phaser.GameObjects.Image;
  texKey: string;
  props: Phaser.GameObjects.Image[];
  flame?: Phaser.GameObjects.Sprite;
  glow?: Phaser.GameObjects.Image;
  bar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  smoke?: Phaser.GameObjects.Particles.ParticleEmitter;
  ruined: boolean;
  towerCd: number;
}

type Mode = { kind: 'idle' } | { kind: 'place'; type: string; x: number; y: number } | { kind: 'move'; uid: number; x: number; y: number };

const WALLS = new Set(['palisade', 'stonewall']);
const FONT = '"Lilita One", "Trebuchet MS", sans-serif';

export class WorldScene extends Phaser.Scene {
  private ground: Phaser.GameObjects.Image[] = [];
  private decor = new Map<number, Phaser.GameObjects.Image>();
  private nodeSprites = new Map<number, Phaser.GameObjects.Image>();
  private views = new Map<number, BuildingView>();
  private villagers: Unit[] = [];
  private defenders: Unit[] = [];
  private enemies: Unit[] = [];
  private chief!: Unit;
  private fx!: FxScene;
  private territory!: Phaser.GameObjects.Graphics;
  private ghost?: { sprite: Phaser.GameObjects.Image; grid: Phaser.GameObjects.Graphics; props: Phaser.GameObjects.Image[] };
  private ring!: Phaser.GameObjects.Image;
  private mode: Mode = { kind: 'idle' };
  private selected: number | null = null;
  private lastSeasonId = '';
  private lastHq = 0;
  private prodTimer = 0;
  private raid: { n: number; total: number; queue: { enemy: string; at: number }[]; t: number; strength: number; side: { x: number; y: number } } | null = null;
  private warned = 0;
  // Input.
  private drag: { x: number; y: number; camX: number; camY: number; moved: boolean; onGhost: boolean } | null = null;
  private pinch: { dist: number; zoom: number } | null = null;
  baseZoom = 1;

  constructor() {
    super('world');
  }

  create() {
    this.baseZoom = Math.min(2, window.devicePixelRatio || 1);
    this.cameras.main.setBackgroundColor('#2a1c12');
    this.buildGround();
    this.territory = this.add.graphics().setDepth(600);
    this.ring = this.add.image(0, 0, 'fx_ring').setDepth(700).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.ring, alpha: { from: 0.55, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    this.rebuildWorld();

    this.scene.launch('fx');
    this.fx = this.scene.get('fx') as FxScene;
    const cam = this.cameras.main;
    const h = tileToWorld(HEARTH_POS.x + 1, HEARTH_POS.y + 1);
    cam.setZoom(this.baseZoom * 0.9);
    cam.centerOn(h.x, h.y);
    this.setupInput();

    game.bus.on('placed', (b: BuildingState) => this.onPlaced(b));
    game.bus.on('built', (e: { uid: number; level: number }) => this.onBuilt(e.uid, e.level));
    game.bus.on('upgradeStarted', (uid: number) => this.refreshView(uid));
    game.bus.on('moved', (uid: number) => this.onMoved(uid));
    game.bus.on('removed', (uid: number) => this.removeView(uid));
    game.bus.on('arrived', () => this.syncVillagers());
    game.bus.on('workers', () => this.syncVillagers());
    game.bus.on('regrow', (e: { uid: number }) => this.refreshNode(e.uid));
    game.bus.on('heroSummoned', () => this.syncDefenders());
    game.bus.on('rebuild', () => this.rebuildWorld());
    game.bus.on('ui:place', (type: string) => this.startPlacement(type));
    game.bus.on('ui:confirm', () => this.confirmPlacement());
    game.bus.on('ui:cancel', () => this.cancelMode());
    game.bus.on('ui:move', (uid: number) => this.startMove(uid));
    game.bus.on('ui:focus', (uid: number) => this.focusBuilding(uid));
    game.bus.on('ui:deselect', () => this.select(null));
    game.bus.on('ui:zoom', (dir: number) => this.zoomBy(dir > 0 ? 1.2 : 1 / 1.2));
  }

  // ------------------------------------------------------------------ world building

  private buildGround() {
    const s = game.state;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++) {
        const t = s.terrain[y * MAP_SIZE + x];
        const v = Math.floor(hash2(x, y, s.seed) * TILE_VARIANTS);
        const p = tileToWorld(x, y);
        const img = this.add.image(p.x, p.y, 'terrain', `t${t}_${v}`).setScale(ART_SCALE).setDepth(0);
        this.ground.push(img);
        // Earth cliffs along the two front edges of the map.
        if (y === MAP_SIZE - 1) this.add.image(p.x, p.y, 'terrain', 'side_l').setOrigin(1, 0).setScale(ART_SCALE).setDepth(1);
        if (x === MAP_SIZE - 1) this.add.image(p.x, p.y, 'terrain', 'side_r').setOrigin(0, 0).setScale(ART_SCALE).setDepth(1);
      }
    // Cosmetic decor.
    for (let y = 1; y < MAP_SIZE - 1; y++)
      for (let x = 1; x < MAP_SIZE - 1; x++) {
        const t = s.terrain[y * MAP_SIZE + x];
        if (t === Tile.Water) continue;
        const r = hash2(x * 3 + 1, y * 7 + 2, s.seed + 5);
        let key: string | null = null;
        if (t === Tile.Grass && r < 0.28) key = 'd_tuft';
        else if (t === Tile.DryGrass && r < 0.3) key = 'd_tuft_dry';
        else if (r > 0.985 && t !== Tile.Sand) key = 'd_termite';
        else if (r > 0.965) key = 'd_flowers';
        else if (r > 0.95 && t === Tile.Dirt) key = 'd_pebbles';
        else if (r > 0.947) key = 'd_skull';
        if (!key) continue;
        const ox = (hash2(x, y, 9) - 0.5) * 0.5;
        const oy = (hash2(y, x, 11) - 0.5) * 0.5;
        const p = tileToWorld(x + ox, y + oy);
        const img = this.add.image(p.x, p.y, key).setScale(ART_SCALE);
        const o = ORIGINS.get(key)!;
        img.setOrigin(o[0], o[1]).setDepth(key === 'd_termite' ? depthAt(x, y) : 400);
        this.decor.set(y * MAP_SIZE + x, img);
      }
  }

  /** (Re)creates every node, building and unit view from the game state. */
  private rebuildWorld() {
    for (const s of this.nodeSprites.values()) s.destroy();
    this.nodeSprites.clear();
    for (const uid of [...this.views.keys()]) this.removeView(uid);
    for (const u of [...this.villagers, ...this.defenders, ...this.enemies]) u.destroy();
    this.villagers = [];
    this.defenders = [];
    this.enemies = [];
    this.chief?.destroy();
    this.raid = null;
    game.raidActive = false;

    for (const n of game.state.nodes) this.addNode(n);
    for (const b of game.state.buildings) this.addView(b);
    const h = eco.hearth(game.state);
    this.chief = new Unit(this, { kind: 'chief', tex: 'u_chief', x: h.x + 2.4, y: h.y + 1.2, hp: 400, damage: 14, speed: 2.4, range: 1.1, cooldown: 0.9 });
    this.chief.hpBar = this.add.graphics();
    this.syncVillagers();
    this.syncDefenders();
    this.refreshTerritory();
  }

  private nodeTex(n: NodeState): string {
    if (n.amount <= 0) return n.kind === 'rock' ? 'n_rubble' : n.kind === 'bush' ? 'n_bush_empty' : 'n_stump';
    if (n.kind === 'acacia') return n.uid % 2 ? 'n_acacia' : 'n_acacia2';
    return `n_${n.kind}`;
  }

  private addNode(n: NodeState) {
    const p = tileToWorld(n.x, n.y);
    const key = this.nodeTex(n);
    const img = this.add.image(p.x, p.y, key).setScale(ART_SCALE).setDepth(depthAt(n.x, n.y));
    const o = ORIGINS.get(key)!;
    img.setOrigin(o[0], o[1]);
    img.setData('node', n.uid);
    this.nodeSprites.set(n.uid, img);
    const d = this.decor.get(n.y * MAP_SIZE + n.x);
    if (d) d.setVisible(false);
  }

  private refreshNode(uid: number) {
    const n = game.state.nodes.find((v) => v.uid === uid);
    const img = this.nodeSprites.get(uid);
    if (!n || !img) {
      img?.destroy();
      this.nodeSprites.delete(uid);
      return;
    }
    const key = this.nodeTex(n);
    if (img.texture.key !== key) {
      img.setTexture(key);
      const o = ORIGINS.get(key)!;
      img.setOrigin(o[0], o[1]);
      if (n.amount > 0) {
        img.setScale(0);
        this.tweens.add({ targets: img, scale: ART_SCALE, duration: 500, ease: 'Back.Out' });
      }
    }
  }

  private viewTexKey(b: BuildingState): string {
    if (b.level === 0) return `construct_${BUILDINGS[b.type].size}`;
    return `b_${b.type}_${buildingTier(b.type, b.level)}`;
  }

  private addView(b: BuildingState) {
    const c = footprintCenter(b.type, b.x, b.y);
    const key = this.viewTexKey(b);
    const sprite = this.add.image(c.x, c.y, key).setScale(ART_SCALE);
    const o = ORIGINS.get(key)!;
    sprite.setOrigin(o[0], o[1]);
    const n = BUILDINGS[b.type].size;
    sprite.setDepth(depthAt(b.x + (n - 1) / 2, b.y + (n - 1) / 2) + (WALLS.has(b.type) ? 0 : 1));
    sprite.setData('building', b.uid);
    const bar = this.add.graphics().setDepth(40000);
    const label = this.add
      .text(c.x, c.y, '', { fontFamily: FONT, fontSize: '28px', color: '#fff6dc', stroke: '#2a160a', strokeThickness: 6 })
      .setOrigin(0.5, 1)
      .setScale(0.5)
      .setDepth(40001);
    const view: BuildingView = { uid: b.uid, sprite, texKey: key, props: [], bar, label, ruined: false, towerCd: 0 };
    this.views.set(b.uid, view);
    // Hide decor under the footprint.
    for (const [tx, ty] of eco.footprint(b.type, b.x, b.y)) this.decor.get(ty * MAP_SIZE + tx)?.setVisible(false);
    this.cullKey = '';
    this.refreshView(b.uid);
  }

  private removeView(uid: number) {
    const v = this.views.get(uid);
    if (!v) return;
    v.sprite.destroy();
    v.props.forEach((p) => p.destroy());
    v.flame?.destroy();
    v.glow?.destroy();
    v.bar.destroy();
    v.label.destroy();
    v.smoke?.destroy();
    this.views.delete(uid);
    if (this.selected === uid) this.select(null);
  }

  /** Props from the Kenney farm pack that dress some buildings. */
  private propsFor(b: BuildingState): { key: string; dx: number; dy: number; flat?: boolean }[] {
    if (b.level === 0) return [];
    const tier = buildingTier(b.type, b.level);
    switch (b.type) {
      case 'maize': {
        const crop = tier === 0 ? 'cornYoungDouble_N' : tier === 1 ? 'cornDouble_N' : 'cornDouble_E';
        const out: { key: string; dx: number; dy: number; flat?: boolean }[] = [];
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          out.push({ key: 'dirtFarmland_N', dx, dy, flat: true });
        for (const [dx, dy] of [
          [0, 0],
          [1, 0],
          [0, 1],
          [1, 1],
        ])
          out.push({ key: crop, dx, dy });
        return out;
      }
      case 'granary':
        return [{ key: 'sacksCrate_N', dx: 0.35, dy: 0.35 }];
      case 'forager':
        return [
          { key: 'sack_N', dx: 1.3, dy: 0.9 },
          { key: 'hay_N', dx: -0.1, dy: 1.2 },
        ];
      case 'kraal':
        return [{ key: tier >= 1 ? 'hayBalesStacked_N' : 'hayBales_N', dx: 0.9, dy: -0.15 }];
      case 'woodcutter':
        return [{ key: 'sacksCrate_N', dx: 1.25, dy: 0.2 }];
      default:
        return [];
    }
  }

  private refreshView(uid: number) {
    const b = game.state.buildings.find((v) => v.uid === uid);
    const v = this.views.get(uid);
    if (!b || !v) return;
    const key = this.viewTexKey(b);
    const c = footprintCenter(b.type, b.x, b.y);
    v.sprite.setPosition(c.x, c.y);
    const n = BUILDINGS[b.type].size;
    v.sprite.setDepth(depthAt(b.x + (n - 1) / 2, b.y + (n - 1) / 2) + (WALLS.has(b.type) ? 0 : 1));
    if (key !== v.texKey) {
      v.texKey = key;
      v.sprite.setTexture(key);
      const o = ORIGINS.get(key)!;
      v.sprite.setOrigin(o[0], o[1]);
    }
    // The maize field draws its crops with Kenney sprites, so hide the empty plot.
    v.props.forEach((p) => p.destroy());
    v.props = [];
    for (const p of this.propsFor(b)) {
      const tp = tileToWorld(b.x + p.dx, b.y + p.dy);
      const img = this.add.image(tp.x, tp.y, `k_${p.key}`).setScale(ART_SCALE);
      const o = ORIGINS.get(`k_${p.key}`)!;
      img.setOrigin(o[0], o[1]);
      img.setDepth(p.flat ? 450 : depthAt(b.x + p.dx, b.y + p.dy) + 1);
      v.props.push(img);
    }
    // Fire and night glows.
    const tier = buildingTier(b.type, b.level);
    if (b.type === 'hearth') {
      const [fx, fy] = hearthFireOffset(tier);
      if (!v.flame) {
        v.flame = this.add.sprite(0, 0, 'fx_flame').play('flame');
        const o = ORIGINS.get('fx_flame')!;
        v.flame.setOrigin(o[0], o[1]);
        v.glow = this.add.image(0, 0, 'fx_glow').setVisible(false).setScale(4);
      }
      v.flame.setPosition(c.x + fx, c.y + fy).setScale(0.55 + tier * 0.05).setDepth(v.sprite.depth + 1);
      v.glow!.setPosition(c.x + fx, c.y + fy - 10);
    } else if ((b.type === 'smelter' || b.type === 'watchtower') && b.level > 0) {
      if (!v.glow) v.glow = this.add.image(0, 0, 'fx_glow').setVisible(false);
      const top = b.type === 'smelter' ? 90 : 95 + tier * 10;
      v.glow.setPosition(c.x - (b.type === 'smelter' ? 10 : 0), c.y - top).setScale(b.type === 'smelter' ? 2.2 : 1.6);
    }
  }

  private onPlaced(b: BuildingState) {
    this.addView(b);
    const v = this.views.get(b.uid)!;
    v.sprite.setScale(ART_SCALE * 0.6);
    this.tweens.add({ targets: v.sprite, scale: ART_SCALE, duration: 350, ease: 'Back.Out' });
    this.puff(v.sprite.x, v.sprite.y, 6, 'fx_dust');
    // Removed stumps under the footprint.
    for (const [uid, img] of this.nodeSprites) {
      if (!game.state.nodes.some((n) => n.uid === uid)) {
        img.destroy();
        this.nodeSprites.delete(uid);
      }
    }
  }

  private onBuilt(uid: number, level: number) {
    this.refreshView(uid);
    const v = this.views.get(uid);
    const b = game.state.buildings.find((x) => x.uid === uid);
    if (!v || !b) return;
    this.tweens.add({ targets: v.sprite, scaleY: { from: ART_SCALE * 0.85, to: ART_SCALE }, duration: 400, ease: 'Back.Out' });
    this.puff(v.sprite.x, v.sprite.y, 10, 'fx_dust');
    this.sparkles(v.sprite.x, v.sprite.y - 40);
    game.toast(level === 1 ? `${BUILDINGS[b.type].name} built!` : `${BUILDINGS[b.type].name} reached level ${level}!`, 'good');
    if (b.type === 'hearth') {
      this.refreshTerritory();
      game.bus.emit('hearthUp', level);
    }
    if (BUILDINGS[b.type].workers || BUILDINGS[b.type].guards) this.syncVillagers();
    if (BUILDINGS[b.type].guards) this.syncDefenders();
  }

  private onMoved(uid: number) {
    const b = game.state.buildings.find((x) => x.uid === uid);
    if (!b) return;
    for (const [tx, ty] of eco.footprint(b.type, b.x, b.y)) this.decor.get(ty * MAP_SIZE + tx)?.setVisible(false);
    this.refreshView(uid);
    if (this.selected === uid) this.select(uid);
  }

  private refreshTerritory() {
    const s = game.state;
    const season = seasonAt(s.time);
    const tint = season.tint;
    for (let y = 0; y < MAP_SIZE; y++)
      for (let x = 0; x < MAP_SIZE; x++) {
        const inside = eco.inTerritory(s, x, y);
        this.ground[y * MAP_SIZE + x].setTint(inside ? tint : this.mulTint(tint, 0xa89a88));
      }
    for (const n of s.nodes) this.nodeSprites.get(n.uid)?.setTint(eco.inTerritory(s, n.x, n.y) ? 0xffffff : 0xb8ab98);
    // Border.
    const h = eco.hearth(s);
    const r = eco.territoryRadius(s);
    const x0 = Math.max(-0.5, h.x + 0.5 - r - 0.5);
    const y0 = Math.max(-0.5, h.y + 0.5 - r - 0.5);
    const x1 = Math.min(MAP_SIZE - 0.5, h.x + 0.5 + r + 0.5);
    const y1 = Math.min(MAP_SIZE - 0.5, h.y + 0.5 + r + 0.5);
    const pts = [tileToWorld(x0, y0), tileToWorld(x1, y0), tileToWorld(x1, y1), tileToWorld(x0, y1)];
    this.territory.clear();
    this.territory.lineStyle(10, 0xfff0c0, 0.18);
    this.territory.strokePoints(pts, true);
    this.territory.lineStyle(3, 0xfff0c0, 0.55);
    this.territory.strokePoints(pts, true);
    this.lastSeasonId = season.id;
    this.lastHq = eco.hqLevel(s);
  }

  private mulTint(a: number, b: number) {
    const r = (((a >> 16) & 255) * ((b >> 16) & 255)) / 255;
    const g = (((a >> 8) & 255) * ((b >> 8) & 255)) / 255;
    const bl = ((a & 255) * (b & 255)) / 255;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
  }

  // ------------------------------------------------------------------ villagers & defenders

  private buildingCenterTile(b: BuildingState) {
    const n = BUILDINGS[b.type].size;
    return { x: b.x + (n - 1) / 2, y: b.y + (n - 1) / 2 };
  }

  /** Keeps one villager sprite per survivor (capped), each tied to a job or to the fire. */
  private syncVillagers() {
    const s = game.state;
    const jobs: (number | null)[] = [];
    for (const b of s.buildings) if (!BUILDINGS[b.type].guards) for (let i = 0; i < b.workers; i++) jobs.push(b.uid);
    const idle = Math.max(0, s.pop - 1 - eco.assigned(s));
    for (let i = 0; i < idle; i++) jobs.push(null);
    const want = Math.min(jobs.length, 60);
    const h = eco.hearth(s);
    while (this.villagers.length < want) {
      const i = this.villagers.length;
      const u = new Unit(this, { kind: 'survivor', tex: `u_survivor${i % 5}`, x: h.x + 1 + Math.random(), y: h.y + 2.2 + Math.random(), speed: 1.2 + Math.random() * 0.4 });
      this.villagers.push(u);
      if (this.villagers.length > 1 && game.state.stats.arrivals > 0 && i === want - 1) {
        // Newcomers walk in from the edge of the plain.
        u.x = h.x + 10;
        u.y = h.y + 10;
      }
    }
    while (this.villagers.length > want) this.villagers.pop()!.destroy();
    this.villagers.forEach((u, i) => {
      const job = jobs[i] ?? null;
      if (u.data.job !== job) {
        u.data.job = job;
        u.data.wait = 0;
        const b = job ? s.buildings.find((x) => x.uid === job) : null;
        u.sprite.setTexture(b ? `u_worker${i % 5}` : `u_survivor${i % 5}`, 0);
      }
    });
  }

  private syncDefenders() {
    const s = game.state;
    const h = eco.hearth(s);
    const heroIds = new Set(s.heroes.map((x) => x.id));
    // Heroes.
    for (const hs of s.heroes) {
      if (this.defenders.some((d) => d.kind === 'hero' && d.id === hs.id)) continue;
      const def = HERO_BY_ID[hs.id];
      const st = heroStats(def, hs.level);
      const u = new Unit(this, {
        kind: 'hero',
        id: hs.id,
        tex: `u_hero_${hs.id}`,
        x: h.x + 2 + Math.random() * 2,
        y: h.y - 0.6 + Math.random() * 2,
        hp: st.hp,
        damage: st.damage,
        range: def.range,
        speed: def.speed,
        cooldown: 0.9,
        scale: 1.12,
      });
      u.hpBar = this.add.graphics();
      // A golden ring marks legends.
      u.data.aura = this.add.image(0, 0, 'fx_ring').setScale(0.18).setAlpha(0.7).setBlendMode(Phaser.BlendModes.ADD);
      this.defenders.push(u);
      this.sparkles(u.sprite.x, u.sprite.y - 30);
    }
    for (const d of this.defenders.filter((d) => d.kind === 'hero' && !heroIds.has(d.id))) {
      d.data.aura?.destroy();
      d.destroy();
    }
    this.defenders = this.defenders.filter((d) => d.kind !== 'hero' || heroIds.has(d.id));
    // Guards from warrior lodges.
    const lodges = s.buildings.filter((b) => BUILDINGS[b.type].guards && b.level > 0);
    const want = lodges.reduce((n, b) => n + b.workers, 0);
    const guards = this.defenders.filter((d) => d.kind === 'guard');
    const bonus = 1 + eco.heroBonus(s, (x) => x.kind === 'guards');
    for (let i = guards.length; i < want; i++) {
      let k = i;
      const lodge = lodges.find((b) => (k -= b.workers) < 0) ?? lodges[0];
      const c = this.buildingCenterTile(lodge);
      const lvl = lodge.level;
      const u = new Unit(this, {
        kind: 'guard',
        tex: 'u_guard',
        x: c.x + 1.2 + Math.random(),
        y: c.y + 0.5 + Math.random(),
        hp: (160 + 30 * lvl) * bonus,
        damage: (12 + 3 * lvl) * bonus,
        range: 1.1,
        speed: 2.2,
        cooldown: 0.9,
      });
      u.data.home = lodge.uid;
      u.hpBar = this.add.graphics();
      this.defenders.push(u);
    }
    if (guards.length > want) {
      const extra = guards.slice(want);
      extra.forEach((u) => u.destroy());
      this.defenders = this.defenders.filter((d) => !extra.includes(d));
    }
  }

  private wander(u: Unit, cx: number, cy: number, r: number, dt: number) {
    if (u.dest) return;
    u.data.wait = (u.data.wait ?? 0) - dt;
    if (u.data.wait > 0) return;
    u.data.wait = 1.5 + Math.random() * 4;
    const a = Math.random() * Math.PI * 2;
    const d = r * (0.4 + Math.random() * 0.6);
    const x = Phaser.Math.Clamp(cx + Math.cos(a) * d, 0.5, MAP_SIZE - 1.5);
    const y = Phaser.Math.Clamp(cy + Math.sin(a) * d, 0.5, MAP_SIZE - 1.5);
    u.dest = { x, y };
  }

  private updateVillagers(dt: number) {
    const s = game.state;
    const h = this.buildingCenterTile(eco.hearth(s));
    const hiding = game.raidActive;
    for (const u of this.villagers) {
      if (hiding) {
        // Everyone huddles in the hearth during raids.
        if (!u.data.hidden) {
          u.dest = { x: h.x + 0.3, y: h.y + 0.3 };
          if (u.dist(h.x, h.y) < 0.6) {
            u.data.hidden = true;
            this.tweens.add({ targets: u.sprite, alpha: 0, duration: 300 });
          }
        }
        u.step(dt, 1.8);
        u.sync(dt);
        continue;
      }
      if (u.data.hidden) {
        u.data.hidden = false;
        this.tweens.add({ targets: u.sprite, alpha: 1, duration: 400 });
      }
      const job = u.data.job ? s.buildings.find((b) => b.uid === u.data.job) : null;
      if (job && job.level > 0) {
        const c = this.buildingCenterTile(job);
        const n = BUILDINGS[job.type].size;
        this.wander(u, c.x + n * 0.35, c.y + n * 0.35, n * 0.5, dt);
        // Working animation while standing.
        if (!u.dest && Math.random() < dt * 1.2) u.attackAnim();
      } else {
        this.wander(u, h.x + 0.5, h.y + 1.5, 2.6, dt);
      }
      u.step(dt);
      u.sync(dt);
    }
  }

  // ------------------------------------------------------------------ chief gathering

  private sendChief(n: NodeState) {
    if (game.raidActive) {
      game.toast('Not now — defend the village!', 'warn');
      return;
    }
    if (!eco.inTerritory(game.state, n.x, n.y)) {
      game.toast('Too far — upgrade the Hearth to grow your territory', 'warn');
      return;
    }
    if (n.amount <= 0) {
      game.toast('Depleted — it will grow back', 'warn');
      return;
    }
    this.chief.data.gather = n.uid;
    this.chief.data.chops = 0;
    const side = this.chief.x < n.x ? -0.55 : 0.55;
    this.chief.dest = { x: n.x + side * 0.4, y: n.y + 0.55 };
  }

  private updateChief(dt: number) {
    const c = this.chief;
    if (c.dead) {
      c.sync(dt);
      return;
    }
    if (game.raidActive) {
      c.data.gather = null;
      this.fight(c, dt);
      c.sync(dt);
      return;
    }
    if (c.data.gather) {
      const n = game.state.nodes.find((x) => x.uid === c.data.gather);
      if (!n || n.amount <= 0) {
        c.data.gather = null;
      } else if (c.step(dt)) {
        c.face(n.x - c.x, n.y - c.y);
        c.cd -= dt;
        if (c.cd <= 0) {
          c.cd = 0.38;
          c.attackAnim();
          c.data.chops++;
          const img = this.nodeSprites.get(n.uid);
          if (img) {
            this.tweens.add({ targets: img, angle: { from: -3, to: 3 }, duration: 70, yoyo: true, onComplete: () => img.setAngle(0) });
            this.puff(img.x, img.y - 20, 3, n.kind === 'rock' ? 'fx_dust' : n.kind === 'bush' ? 'fx_leaf' : 'fx_chip');
          }
          if (c.data.chops >= 3) {
            c.data.chops = 0;
            const r = game.gather(n.uid);
            if (r && img) this.floater(img.x, img.y - 60, `+${r.amount}`, r.res);
            if (r && r.amount === 0) game.toast('Storage is full — build a Granary', 'warn');
            this.refreshNode(n.uid);
            const left = game.state.nodes.find((x) => x.uid === n.uid);
            if (!left || left.amount <= 0) c.data.gather = null;
          }
        }
      }
    } else {
      const h = this.buildingCenterTile(eco.hearth(game.state));
      if (!c.dest && c.dist(h.x + 1.5, h.y + 1) > 3) c.dest = { x: h.x + 1.6, y: h.y + 1.1 };
      c.step(dt);
    }
    c.sync(dt);
  }

  // ------------------------------------------------------------------ raids

  private nextRaidDay(): number {
    const day = dayAt(game.state.time);
    const first = eco.FIRST_RAID_DAY;
    if (day < first) return first;
    let d = day;
    if ((d - first) % 2 !== 0 || game.state.raids.lastDay >= d) d += (d - first) % 2 === 0 ? 2 : 1;
    return d;
  }

  /** Seconds until the next raid begins, for the HUD. */
  raidEta(): number {
    const d = this.nextRaidDay();
    const start = (d - 1) * DAY_LENGTH + DAY_LENGTH * (1 - NIGHT_FRACTION);
    return Math.max(0, start - game.state.time);
  }

  private updateRaid(dt: number) {
    const s = game.state;
    // Dusk warning.
    const eta = this.raidEta();
    if (!game.raidActive && eta < 25 && eta > 0 && this.warned !== this.nextRaidDay()) {
      this.warned = this.nextRaidDay();
      game.bus.emit('raidWarning', s.raids.count + 1);
    }
    if (!game.raidActive && eco.raidDue(s)) this.beginRaid();
    if (!this.raid) return;
    const r = this.raid;
    r.t += dt;
    while (r.queue.length && r.queue[0].at <= r.t) this.spawnEnemy(r.queue.shift()!.enemy, r);
    const alive = this.enemies.filter((e) => !e.dead);
    if (!r.queue.length && alive.length === 0) {
      const reward = eco.raidWon(s, r.n);
      game.bus.emit('raidResult', { won: true, n: r.n, reward, kills: r.total });
      this.endRaid();
    } else if (!isNight(s.time)) {
      // Dawn: survivors flee with loot.
      const lost = eco.raidLost(s);
      for (const e of alive) {
        e.dead = true;
        this.tweens.add({ targets: e.sprite, alpha: 0, duration: 800, onComplete: () => e.destroy() });
      }
      game.bus.emit('raidResult', { won: false, n: r.n, lost });
      this.endRaid();
    }
  }

  private beginRaid() {
    const s = game.state;
    const n = eco.startRaid(s);
    const h = this.buildingCenterTile(eco.hearth(s));
    const ang = Math.random() * Math.PI * 2;
    const dist = eco.territoryRadius(s) + 3;
    const side = {
      x: Phaser.Math.Clamp(h.x + Math.cos(ang) * dist, 1, MAP_SIZE - 2),
      y: Phaser.Math.Clamp(h.y + Math.sin(ang) * dist, 1, MAP_SIZE - 2),
    };
    const queue: { enemy: string; at: number }[] = [];
    let t = 0;
    for (const w of waveComposition(n))
      for (let i = 0; i < w.count; i++) {
        queue.push({ enemy: w.enemy, at: t });
        t += ENEMIES[w.enemy].boss ? 2.5 : 0.6;
      }
    this.raid = { n, total: queue.length, queue, t: 0, strength: waveStrength(n) * seasonAt(s.time).raid, side };
    game.raidActive = true;
    game.bus.emit('raidStart', n);
    this.syncDefenders();
    for (const d of this.defenders) {
      d.dead = false;
      d.hp = d.maxHp;
      d.sprite.setAlpha(1);
    }
    this.chief.dead = false;
    this.chief.hp = this.chief.maxHp;
    this.chief.sprite.setAlpha(1);
  }

  private spawnEnemy(id: string, r: NonNullable<WorldScene['raid']>) {
    const d = ENEMIES[id];
    const x = Phaser.Math.Clamp(r.side.x + (Math.random() - 0.5) * 3, 0.5, MAP_SIZE - 1.5);
    const y = Phaser.Math.Clamp(r.side.y + (Math.random() - 0.5) * 3, 0.5, MAP_SIZE - 1.5);
    const tex = id === 'warlord' ? 'u_warlord' : `u_${id}`;
    const u = new Unit(this, {
      kind: 'enemy',
      id,
      tex,
      x,
      y,
      hp: d.hp * r.strength,
      damage: d.damage * r.strength,
      range: d.range,
      speed: d.speed,
      cooldown: d.cooldown,
      scale: id === 'ninki' || id === 'impundulu' ? 1 : d.scale,
      flying: d.flying,
    });
    u.hpBar = this.add.graphics();
    u.sprite.setAlpha(0);
    this.tweens.add({ targets: u.sprite, alpha: 1, duration: 400 });
    this.enemies.push(u);
    if (d.boss) game.bus.emit('boss', d.name);
  }

  private endRaid() {
    this.raid = null;
    game.raidActive = false;
    this.enemies.filter((e) => e.dead).forEach((e) => this.time.delayedCall(900, () => e.destroy()));
    this.enemies = [];
    for (const d of this.defenders) {
      d.dead = false;
      d.hp = d.maxHp;
      this.tweens.add({ targets: d.sprite, alpha: 1, duration: 500 });
    }
    this.chief.dead = false;
    this.chief.hp = this.chief.maxHp;
    this.chief.sprite.setAlpha(1);
    game.save();
  }

  /** Nearest point of a building footprint to (x, y), in tiles. */
  private nearestOn(b: BuildingState, x: number, y: number) {
    const n = BUILDINGS[b.type].size;
    return { x: Phaser.Math.Clamp(x, b.x - 0.5, b.x + n - 0.5), y: Phaser.Math.Clamp(y, b.y - 0.5, b.y + n - 0.5) };
  }

  private pickBuildingTarget(e: Unit): BuildingState | null {
    const prefers = ENEMIES[e.id]?.prefers ?? 'any';
    const alive = game.state.buildings.filter((b) => b.hp > 0 && !WALLS.has(b.type));
    if (!alive.length) return null;
    const pref = alive.filter((b) =>
      prefers === 'storage'
        ? ['granary', 'hearth', 'forager', 'maize', 'kraal', 'woodcutter', 'quarry'].includes(b.type)
        : prefers === 'defense'
          ? ['watchtower', 'lodge'].includes(b.type)
          : true,
    );
    const pool = pref.length ? pref : alive;
    let best: BuildingState | null = null;
    let bd = Infinity;
    for (const b of pool) {
      const p = this.nearestOn(b, e.x, e.y);
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  private updateEnemies(dt: number) {
    const s = game.state;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.cd -= dt;
      // Defenders close by draw attention.
      let foe: Unit | null = null;
      let fd = 2.2;
      for (const d of [...this.defenders, this.chief]) {
        if (d.dead) continue;
        const dd = e.dist(d.x, d.y);
        if (dd < fd) {
          fd = dd;
          foe = d;
        }
      }
      if (foe) {
        if (fd <= e.range + 0.2) {
          e.dest = null;
          e.face(foe.x - e.x, foe.y - e.y);
          if (e.cd <= 0) this.enemyAttackUnit(e, foe);
        } else {
          e.dest = { x: foe.x, y: foe.y };
          e.step(dt);
        }
        e.sync(dt);
        continue;
      }
      let target = e.data.target ? s.buildings.find((b) => b.uid === e.data.target && b.hp > 0) : null;
      if (!target) {
        target = this.pickBuildingTarget(e);
        e.data.target = target?.uid ?? null;
      }
      if (!target) {
        e.sync(dt);
        continue;
      }
      const p = this.nearestOn(target, e.x, e.y);
      const dist = Math.hypot(p.x - e.x, p.y - e.y);
      if (dist <= e.range) {
        e.dest = null;
        e.face(p.x - e.x, p.y - e.y);
        if (e.cd <= 0) this.enemyAttackBuilding(e, target);
      } else {
        e.dest = p;
        const ox = e.x;
        const oy = e.y;
        e.step(dt);
        if (!e.flying) {
          // Walls and other buildings in the way get attacked first.
          const blocker = eco.buildingAt(s, Math.round(e.x), Math.round(e.y));
          if (blocker && blocker.uid !== target.uid && blocker.hp > 0) {
            e.x = ox;
            e.y = oy;
            e.data.target = blocker.uid;
          }
        }
      }
      e.sync(dt);
    }
  }

  private enemyAttackUnit(e: Unit, foe: Unit) {
    e.cd = e.cooldown;
    e.attackAnim();
    const ranged = e.range > 1.5;
    const hit = () => this.damageUnit(foe, e.damage);
    if (ranged) this.projectile(e, foe.x, foe.y, e.id === 'impundulu' ? 'fx_bolt' : 'fx_stone', hit);
    else hit();
  }

  private enemyAttackBuilding(e: Unit, b: BuildingState) {
    e.cd = e.cooldown;
    e.attackAnim();
    const c = this.buildingCenterTile(b);
    const hit = () => {
      if (b.hp <= 0) return;
      b.hp = Math.max(0, b.hp - e.damage);
      const v = this.views.get(b.uid);
      if (v) {
        v.sprite.setTintFill(0xffffff);
        this.time.delayedCall(70, () => v.sprite.clearTint());
      }
      if (b.hp <= 0) this.onBuildingDestroyed(b);
    };
    if (e.range > 1.5) this.projectile(e, c.x, c.y, e.id === 'impundulu' ? 'fx_bolt' : 'fx_stone', hit);
    else hit();
  }

  private onBuildingDestroyed(b: BuildingState) {
    const v = this.views.get(b.uid);
    if (v) {
      this.puff(v.sprite.x, v.sprite.y - 20, 14, 'fx_smoke');
      this.cameras.main.shake(180, 0.004);
    }
    game.toast(`${BUILDINGS[b.type].name} was wrecked!`, 'warn');
  }

  private damageUnit(u: Unit, dmg: number) {
    if (u.dead) return;
    u.hp -= dmg;
    u.sprite.setTintFill(0xffffff);
    this.time.delayedCall(60, () => u.sprite.clearTint());
    if (u.hp <= 0) {
      u.dead = true;
      u.dest = null;
      if (u.kind === 'enemy') {
        game.state.stats.kills++;
        this.puff(u.sprite.x, u.sprite.y - 10, 5, 'fx_dust');
        this.tweens.add({ targets: u.sprite, alpha: 0, y: u.sprite.y - 10, duration: 500 });
      } else {
        this.tweens.add({ targets: u.sprite, alpha: 0.25, duration: 400 });
      }
    }
  }

  /** Shared melee/ranged behaviour for chief, guards and heroes during raids. */
  private fight(u: Unit, dt: number) {
    if (u.dead) return;
    u.cd -= dt;
    let foe: Unit | null = null;
    let fd = 9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.dist(u.x, u.y);
      if (d < fd) {
        fd = d;
        foe = e;
      }
    }
    if (!foe) {
      u.step(dt);
      return;
    }
    if (fd <= u.range) {
      u.dest = null;
      u.face(foe.x - u.x, foe.y - u.y);
      if (u.cd <= 0) {
        u.cd = u.cooldown;
        u.attackAnim();
        const target = foe;
        if (u.range > 1.5) this.projectile(u, target.x, target.y, 'fx_arrow', () => this.damageUnit(target, u.damage));
        else this.damageUnit(target, u.damage);
      }
    } else {
      u.dest = { x: foe.x, y: foe.y };
      u.step(dt);
    }
  }

  private updateDefenders(dt: number) {
    const h = this.buildingCenterTile(eco.hearth(game.state));
    for (const d of this.defenders) {
      if (game.raidActive) this.fight(d, dt);
      else if (!d.dead) {
        if (d.kind === 'guard') {
          const lodge = game.state.buildings.find((b) => b.uid === d.data.home);
          const c = lodge ? this.buildingCenterTile(lodge) : h;
          this.wander(d, c.x + 1.3, c.y + 1, 1.6, dt);
        } else this.wander(d, h.x + 1, h.y + 0.5, 3.2, dt);
        d.step(dt);
      }
      d.sync(dt);
      if (d.data.aura) {
        d.data.aura.setPosition(d.sprite.x, d.sprite.y).setDepth(d.sprite.depth - 1).setVisible(!d.dead);
      }
    }
  }

  private updateTowers(dt: number) {
    if (!game.raidActive) return;
    const s = game.state;
    const season = seasonAt(s.time);
    const dmgBonus = 1 + eco.heroBonus(s, (x) => x.kind === 'defense');
    for (const b of s.buildings) {
      const d = defenseAt(BUILDINGS[b.type], Math.max(1, b.level));
      if (!d || b.level === 0 || b.hp <= 0) continue;
      const v = this.views.get(b.uid);
      if (!v) continue;
      v.towerCd -= dt;
      if (v.towerCd > 0) continue;
      const range = d.range * (season.weather === 'dust' ? 0.8 : 1);
      const c = this.buildingCenterTile(b);
      let foe: Unit | null = null;
      let fd = range;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dd = e.dist(c.x, c.y);
        if (dd < fd) {
          fd = dd;
          foe = e;
        }
      }
      if (!foe) continue;
      v.towerCd = d.cooldown;
      const from = { x: v.sprite.x, y: v.sprite.y - 90 };
      const target = foe;
      this.projectileFrom(from, target.x, target.y, 'fx_arrow', () => this.damageUnit(target, d.damage * dmgBonus));
    }
  }

  private projectile(from: Unit, tx: number, ty: number, key: string, onHit: () => void) {
    this.projectileFrom({ x: from.sprite.x, y: from.sprite.y - 40 }, tx, ty, key, onHit);
  }

  private projectileFrom(from: { x: number; y: number }, tx: number, ty: number, key: string, onHit: () => void) {
    const to = tileToWorld(tx, ty);
    to.y -= 24;
    const p = this.add.image(from.x, from.y, key).setScale(0.5).setDepth(45000);
    if (key === 'fx_bolt') {
      p.setPosition(to.x, to.y - 50).setScale(0.6).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: p, alpha: { from: 1, to: 0 }, duration: 250, onComplete: () => p.destroy() });
      onHit();
      return;
    }
    const dist = Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y);
    p.setRotation(Phaser.Math.Angle.Between(from.x, from.y, to.x, to.y));
    const arc = Math.min(60, dist * 0.25);
    const dur = 150 + dist * 1.1;
    const start = { x: from.x, y: from.y };
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: dur,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0;
        const x = start.x + (to.x - start.x) * t;
        const y = start.y + (to.y - start.y) * t - Math.sin(t * Math.PI) * arc;
        p.setRotation(Math.atan2(y - p.y, x - p.x));
        p.setPosition(x, y);
      },
      onComplete: () => {
        p.destroy();
        onHit();
      },
    });
  }

  // ------------------------------------------------------------------ effects

  floater(x: number, y: number, text: string, icon?: string) {
    const c = this.add.container(x, y).setDepth(46000);
    const t = this.add.text(0, 0, text, { fontFamily: FONT, fontSize: '40px', color: '#fff6dc', stroke: '#2a160a', strokeThickness: 8 }).setOrigin(0, 0.5);
    c.add(t);
    if (icon) {
      const i = this.add.image(-24, 0, `i_${icon}`).setScale(0.75);
      c.add(i);
    }
    c.setScale(0.5);
    this.tweens.add({ targets: c, y: y - 50, alpha: { from: 1, to: 0 }, duration: 1300, ease: 'Cubic.Out', onComplete: () => c.destroy() });
  }

  private puff(x: number, y: number, count: number, key: string) {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x + (Math.random() - 0.5) * 50, y + (Math.random() - 0.5) * 20, key).setDepth(45000);
      const big = key === 'fx_smoke' || key === 'fx_dust';
      p.setScale(big ? 0.6 + Math.random() * 0.6 : 0.8);
      this.tweens.add({
        targets: p,
        x: p.x + (Math.random() - 0.5) * 80,
        y: p.y - 30 - Math.random() * 40,
        alpha: 0,
        scale: big ? p.scale * 1.8 : 0.4,
        angle: big ? 0 : 360,
        duration: 700 + Math.random() * 500,
        onComplete: () => p.destroy(),
      });
    }
  }

  private sparkles(x: number, y: number) {
    for (let i = 0; i < 12; i++) {
      const p = this.add.image(x, y, 'fx_spark').setDepth(46000).setBlendMode(Phaser.BlendModes.ADD).setScale(0.5);
      const a = (i / 12) * Math.PI * 2;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 70, y: y + Math.sin(a) * 40 - 20, alpha: 0, scale: 0.1, duration: 700, onComplete: () => p.destroy() });
    }
  }

  // ------------------------------------------------------------------ frame

  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.1, deltaMs / 1000) * game.speed;
    game.update(dt);
    const s = game.state;
    const season = seasonAt(s.time);
    if (season.id !== this.lastSeasonId || eco.hqLevel(s) !== this.lastHq) {
      if (this.lastSeasonId && season.id !== this.lastSeasonId) game.bus.emit('season', season);
      this.refreshTerritory();
    }
    this.updateLighting(season.weather);
    this.updateRaid(dt);
    this.updateChief(dt);
    this.updateVillagers(dt);
    this.updateDefenders(dt);
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateBuildingBars();
    this.prodTimer += dt;
    if (this.prodTimer > 8) {
      this.prodTimer = 0;
      this.productionFloaters();
    }
    if (this.selected !== null) this.positionRing();
    this.cull();
  }

  private cullKey = '';

  /** Hides ground and scenery outside the camera so phones only draw what is on screen. */
  private cull() {
    const v = this.cameras.main.worldView;
    const key = `${Math.round(v.x / 64)},${Math.round(v.y / 64)},${Math.round(v.width / 64)}`;
    if (key === this.cullKey) return;
    this.cullKey = key;
    const x0 = v.x - TW * 2;
    const x1 = v.right + TW * 2;
    const y0 = v.y - TH * 2;
    const y1 = v.bottom + TH * 6;
    const inView = (o: { x: number; y: number }) => o.x > x0 && o.x < x1 && o.y > y0 && o.y < y1;
    for (const g of this.ground) g.setVisible(inView(g));
    for (const [i, d] of this.decor) {
      const x = i % MAP_SIZE;
      const y = Math.floor(i / MAP_SIZE);
      const hidden = !!eco.buildingAt(game.state, x, y) || !!eco.nodeAt(game.state, x, y);
      d.setVisible(!hidden && inView(d));
    }
    for (const n of this.nodeSprites.values()) n.setVisible(inView(n));
  }

  private productionFloaters() {
    const cam = this.cameras.main;
    for (const b of game.state.buildings) {
      const r = eco.buildingRate(game.state, b);
      if (!r) continue;
      const v = this.views.get(b.uid);
      if (!v || !cam.worldView.contains(v.sprite.x, v.sprite.y)) continue;
      const amt = Math.round((r.perMin * 8) / 60);
      if (amt >= 1) this.floater(v.sprite.x, v.sprite.y - 80, `+${amt}`, r.res);
    }
  }

  private updateBuildingBars() {
    const s = game.state;
    for (const b of s.buildings) {
      const v = this.views.get(b.uid);
      if (!v) continue;
      v.bar.clear();
      const top = v.sprite.getTopCenter();
      const max = eco.maxHp(s, b);
      if (b.construct) {
        const pct = 1 - (b.construct.end - s.time) / b.construct.total;
        const w = 70;
        const y = Math.min(top.y + 20, v.sprite.y - 60);
        v.bar.fillStyle(0x1a0f08, 0.85).fillRoundedRect(v.sprite.x - w / 2 - 2, y - 2, w + 4, 11, 4);
        v.bar.fillStyle(0xf2b33d, 1).fillRoundedRect(v.sprite.x - w / 2, y, Math.max(4, w * Phaser.Math.Clamp(pct, 0, 1)), 7, 3);
        const left = Math.max(0, Math.ceil(b.construct.end - s.time));
        v.label.setText(fmtTime(left)).setPosition(v.sprite.x, y - 3).setVisible(true);
      } else if (b.hp < max * 0.97 && (game.raidActive || b.hp <= 0)) {
        const w = 60;
        const y = Math.min(top.y + 20, v.sprite.y - 60);
        v.bar.fillStyle(0x1a0f08, 0.85).fillRect(v.sprite.x - w / 2 - 1, y - 1, w + 2, 7);
        v.bar.fillStyle(b.hp / max > 0.4 ? 0x7ccf4a : 0xd8432e, 1).fillRect(v.sprite.x - w / 2, y, w * (b.hp / max), 5);
        v.label.setVisible(false);
      } else v.label.setVisible(false);
      const ruined = b.hp <= 0 && b.level > 0;
      if (ruined !== v.ruined) {
        v.ruined = ruined;
        v.sprite.setTint(ruined ? 0x5a4a40 : 0xffffff);
        if (ruined) {
          v.smoke = this.add.particles(v.sprite.x, v.sprite.y - 30, 'fx_smoke', {
            lifespan: 1800,
            speedY: { min: -40, max: -70 },
            speedX: { min: -10, max: 20 },
            scale: { start: 0.6, end: 1.8 },
            alpha: { start: 0.6, end: 0 },
            frequency: 220,
          });
          v.smoke.setDepth(v.sprite.depth + 2);
        } else {
          v.smoke?.destroy();
          v.smoke = undefined;
        }
      }
      if (v.flame) v.flame.setVisible(!ruined);
    }
  }

  /** Day/night colour grading and weather. */
  private updateLighting(weather: string) {
    const ph = dayPhase(game.state.time);
    // Keyframes: dawn, day, dusk, night.
    const keys: [number, number][] = [
      [0.0, 0xc8b0c8],
      [0.08, 0xfff4e6],
      [0.6, 0xffffff],
      [0.7, 0xffc89a],
      [0.76, 0x6a6aa8],
      [0.9, 0x4c5296],
      [1.0, 0xc8b0c8],
    ];
    let col = 0xffffff;
    for (let i = 0; i < keys.length - 1; i++) {
      const [a, ca] = keys[i];
      const [b, cb] = keys[i + 1];
      if (ph >= a && ph <= b) {
        const t = (ph - a) / (b - a);
        const c1 = Phaser.Display.Color.IntegerToColor(ca);
        const c2 = Phaser.Display.Color.IntegerToColor(cb);
        const m = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, t * 100);
        col = Phaser.Display.Color.GetColor(m.r, m.g, m.b);
        break;
      }
    }
    if (weather === 'dust') col = this.mulTint(col, 0xf2dcc0);
    if (weather === 'rain') col = this.mulTint(col, 0xd8e0e8);
    if (!this.fx?.overlay) return;
    this.fx.setGrade(col);
    // Night lights are drawn by the fx scene so the grading does not dim them.
    const night = ph > 0.7 || ph < 0.04;
    const strength = night ? Math.min(1, ph > 0.7 ? (ph - 0.7) / 0.06 : (0.04 - ph) / 0.04 + 0.2) : 0;
    const cam = this.cameras.main;
    const lights: { x: number; y: number; scale: number; alpha: number }[] = [];
    if (strength > 0)
      for (const v of this.views.values()) {
        if (!v.glow || v.ruined) continue;
        const sx = (v.glow.x - cam.worldView.x) * cam.zoom;
        const sy = (v.glow.y - cam.worldView.y) * cam.zoom;
        if (sx < -300 || sy < -300 || sx > this.scale.width + 300 || sy > this.scale.height + 300) continue;
        lights.push({ x: sx, y: sy, scale: v.glow.scaleX * cam.zoom, alpha: strength * (0.55 + Math.sin(this.time.now / 160 + v.uid) * 0.08) });
      }
    this.fx.setLights(lights);
    // Rain falls on the first two days of each rainy season, not constantly.
    const day = dayAt(game.state.time);
    this.fx.setWeather(weather === 'rain' && day % 3 !== 0, weather === 'dust');
  }

  // ------------------------------------------------------------------ input

  private setupInput() {
    this.input.addPointer(1);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const pts = [this.input.pointer1, this.input.pointer2].filter((x) => x.isDown);
      if (pts.length >= 2) {
        this.pinch = { dist: Phaser.Math.Distance.Between(pts[0].x, pts[0].y, pts[1].x, pts[1].y), zoom: this.cameras.main.zoom };
        this.drag = null;
        return;
      }
      const cam = this.cameras.main;
      let onGhost = false;
      if (this.mode.kind !== 'idle') {
        const t = this.pointerTile(p);
        const n = BUILDINGS[this.mode.kind === 'place' ? this.mode.type : this.buildingType(this.mode.uid)].size;
        onGhost = t.x >= this.mode.x - 0.6 && t.y >= this.mode.y - 0.6 && t.x <= this.mode.x + n - 0.4 && t.y <= this.mode.y + n - 0.4;
      }
      this.drag = { x: p.x, y: p.y, camX: cam.scrollX, camY: cam.scrollY, moved: false, onGhost };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        const a = this.input.pointer1;
        const b = this.input.pointer2;
        if (a.isDown && b.isDown) {
          const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
          this.setZoom(this.pinch.zoom * (d / this.pinch.dist));
        }
        return;
      }
      if (!this.drag || !p.isDown) return;
      const dx = p.x - this.drag.x;
      const dy = p.y - this.drag.y;
      if (!this.drag.moved && Math.hypot(dx, dy) > 10 * this.baseZoom) this.drag.moved = true;
      if (!this.drag.moved) return;
      if (this.drag.onGhost && this.mode.kind !== 'idle') {
        const t = this.pointerTile(p);
        const type = this.mode.kind === 'place' ? this.mode.type : this.buildingType(this.mode.uid);
        const n = BUILDINGS[type].size;
        this.setGhost(Math.round(t.x - (n - 1) / 2), Math.round(t.y - (n - 1) / 2));
        return;
      }
      const cam = this.cameras.main;
      cam.setScroll(this.drag.camX - dx / cam.zoom, this.drag.camY - dy / cam.zoom);
      this.clampCamera();
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.pinch) {
        if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) this.pinch = null;
        this.drag = null;
        return;
      }
      if (this.drag && !this.drag.moved) this.tap(p);
      this.drag = null;
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => this.zoomBy(dy > 0 ? 0.9 : 1.1));
  }

  private buildingType(uid: number) {
    return game.state.buildings.find((b) => b.uid === uid)?.type ?? 'hut';
  }

  private pointerTile(p: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return worldToTile(w.x, w.y);
  }

  private zoomBy(f: number) {
    this.setZoom(this.cameras.main.zoom * f);
  }

  private setZoom(z: number) {
    this.cameras.main.setZoom(Phaser.Math.Clamp(z, this.baseZoom * 0.4, this.baseZoom * 1.8));
    this.clampCamera();
  }

  private clampCamera() {
    const cam = this.cameras.main;
    const c = cam.midPoint;
    const t = worldToTile(c.x, c.y);
    const cx = Phaser.Math.Clamp(t.x, 2, MAP_SIZE - 3);
    const cy = Phaser.Math.Clamp(t.y, 2, MAP_SIZE - 3);
    if (cx !== t.x || cy !== t.y) {
      const w = tileToWorld(cx, cy);
      cam.centerOn(w.x, w.y);
    }
  }

  private tap(p: Phaser.Input.Pointer) {
    const t = this.pointerTile(p);
    if (this.mode.kind !== 'idle') {
      const type = this.mode.kind === 'place' ? this.mode.type : this.buildingType(this.mode.uid);
      const n = BUILDINGS[type].size;
      this.setGhost(Math.round(t.x - (n - 1) / 2), Math.round(t.y - (n - 1) / 2));
      return;
    }
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    const hit = this.pick(w.x, w.y);
    if (hit?.getData('building') !== undefined) {
      this.select(hit.getData('building'));
      return;
    }
    if (hit?.getData('node') !== undefined) {
      const n = game.state.nodes.find((x) => x.uid === hit.getData('node'));
      if (n) this.sendChief(n);
      this.select(null);
      return;
    }
    // Tap on the ground near a node also gathers.
    const tx = Math.round(t.x);
    const ty = Math.round(t.y);
    const node = eco.nodeAt(game.state, tx, ty);
    if (node && node.amount > 0) this.sendChief(node);
    const b = eco.buildingAt(game.state, tx, ty);
    this.select(b ? b.uid : null);
  }

  /** Front-most building or node sprite with an opaque pixel at the world point. */
  private pick(wx: number, wy: number): Phaser.GameObjects.Image | null {
    let best: Phaser.GameObjects.Image | null = null;
    const candidates = [...[...this.views.values()].map((v) => v.sprite), ...this.nodeSprites.values()];
    for (const s of candidates) {
      if (!s.visible) continue;
      const b = s.getBounds();
      if (!b.contains(wx, wy)) continue;
      const lx = (wx - b.x) / s.scaleX;
      const ly = (wy - b.y) / s.scaleY;
      const a = this.textures.getPixelAlpha(Math.floor(lx), Math.floor(ly), s.texture.key);
      if (!a || a < 40) continue;
      if (!best || s.depth > best.depth) best = s;
    }
    return best;
  }

  select(uid: number | null) {
    this.selected = uid;
    this.ring.setVisible(uid !== null);
    if (uid !== null) {
      this.positionRing();
      const v = this.views.get(uid);
      if (v) this.tweens.add({ targets: v.sprite, scaleY: { from: ART_SCALE * 1.06, to: ART_SCALE }, duration: 250, ease: 'Back.Out' });
    }
    game.bus.emit('select', uid);
  }

  private positionRing() {
    const b = game.state.buildings.find((x) => x.uid === this.selected);
    if (!b) {
      this.ring.setVisible(false);
      return;
    }
    const c = footprintCenter(b.type, b.x, b.y);
    const n = BUILDINGS[b.type].size;
    this.ring.setPosition(c.x, c.y).setScale((n * TW * 1.05) / 300, (n * TH * 1.05) / 150);
  }

  private focusBuilding(uid: number) {
    const b = game.state.buildings.find((x) => x.uid === uid);
    if (!b) return;
    const c = footprintCenter(b.type, b.x, b.y);
    this.cameras.main.pan(c.x, c.y - 40, 400, 'Sine.easeInOut');
    this.select(uid);
  }

  // ------------------------------------------------------------------ placement

  private startPlacement(type: string) {
    this.cancelMode();
    this.select(null);
    const cam = this.cameras.main;
    const t = worldToTile(cam.midPoint.x, cam.midPoint.y);
    const spot = this.findSpot(type, Math.round(t.x), Math.round(t.y));
    this.mode = { kind: 'place', type, x: spot.x, y: spot.y };
    this.makeGhost(type);
    this.setGhost(spot.x, spot.y);
    game.bus.emit('mode', 'place', type);
  }

  private startMove(uid: number) {
    const b = game.state.buildings.find((x) => x.uid === uid);
    if (!b) return;
    this.cancelMode();
    this.select(null);
    this.mode = { kind: 'move', uid, x: b.x, y: b.y };
    this.makeGhost(b.type, b);
    this.views.get(uid)?.sprite.setAlpha(0.3);
    this.setGhost(b.x, b.y);
    game.bus.emit('mode', 'move', b.type);
  }

  private findSpot(type: string, cx: number, cy: number) {
    const s = game.state;
    for (let r = 0; r < 14; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (eco.canPlaceAt(s, type, cx + dx, cy + dy).ok) return { x: cx + dx, y: cy + dy };
        }
    return { x: cx, y: cy };
  }

  private makeGhost(type: string, b?: BuildingState) {
    const key = b ? this.viewTexKey(b) : `b_${type}_0`;
    const sprite = this.add.image(0, 0, key).setScale(ART_SCALE).setAlpha(0.85).setDepth(30000);
    const o = ORIGINS.get(key)!;
    sprite.setOrigin(o[0], o[1]);
    const grid = this.add.graphics().setDepth(29999);
    const props: Phaser.GameObjects.Image[] = [];
    if (type === 'maize')
      for (let i = 0; i < 4; i++) props.push(this.add.image(0, 0, 'k_cornDouble_N').setScale(ART_SCALE).setAlpha(0.85).setDepth(30000).setOrigin(...ORIGINS.get('k_cornDouble_N')!));
    this.ghost = { sprite, grid, props };
  }

  private setGhost(x: number, y: number) {
    if (!this.ghost || this.mode.kind === 'idle') return;
    this.mode.x = x;
    this.mode.y = y;
    const type = this.mode.kind === 'place' ? this.mode.type : this.buildingType(this.mode.uid);
    const ignore = this.mode.kind === 'move' ? this.mode.uid : undefined;
    const ok = eco.canPlaceAt(game.state, type, x, y, ignore).ok;
    const c = footprintCenter(type, x, y);
    this.ghost.sprite.setPosition(c.x, c.y).setTint(ok ? 0xffffff : 0xff8a7a);
    this.ghost.props.forEach((p, i) => {
      const w = tileToWorld(x + (i % 2), y + Math.floor(i / 2));
      p.setPosition(w.x, w.y);
    });
    const g = this.ghost.grid;
    g.clear();
    for (const [tx, ty] of eco.footprint(type, x, y)) {
      const tok = eco.canPlaceAt(game.state, 'palisade', tx, ty, ignore).ok || (ignore !== undefined && eco.buildingAt(game.state, tx, ty)?.uid === ignore);
      const w = tileToWorld(tx, ty);
      g.fillStyle(ok && tok ? 0x7ccf4a : 0xe0503a, 0.45);
      g.lineStyle(3, ok && tok ? 0xd8ffb0 : 0xffb0a0, 0.9);
      const pts = [
        { x: w.x, y: w.y - TH / 2 },
        { x: w.x + TW / 2, y: w.y },
        { x: w.x, y: w.y + TH / 2 },
        { x: w.x - TW / 2, y: w.y },
      ];
      g.fillPoints(pts, true);
      g.strokePoints(pts, true);
    }
    game.bus.emit('ghost', ok);
  }

  private confirmPlacement() {
    const m = this.mode;
    if (m.kind === 'place') {
      const b = game.place(m.type, m.x, m.y);
      if (!b) return;
      const isWall = WALLS.has(m.type);
      this.cancelMode();
      // Walls chain: keep placing the next segment.
      if (isWall && eco.canBuildType(game.state, m.type).ok) {
        this.mode = { kind: 'place', type: m.type, x: m.x, y: m.y };
        this.makeGhost(m.type);
        const next = [
          [1, 0],
          [0, 1],
          [-1, 0],
          [0, -1],
        ].find(([dx, dy]) => eco.canPlaceAt(game.state, m.type, m.x + dx, m.y + dy).ok) ?? [1, 0];
        this.setGhost(m.x + next[0], m.y + next[1]);
        game.bus.emit('mode', 'place', m.type);
      }
    } else if (m.kind === 'move') {
      if (game.move(m.uid, m.x, m.y)) this.cancelMode();
    }
  }

  cancelMode() {
    if (this.mode.kind === 'move') this.views.get(this.mode.uid)?.sprite.setAlpha(1);
    this.mode = { kind: 'idle' };
    this.ghost?.sprite.destroy();
    this.ghost?.grid.destroy();
    this.ghost?.props.forEach((p) => p.destroy());
    this.ghost = undefined;
    game.bus.emit('mode', 'idle');
  }
}

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.ceil(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
