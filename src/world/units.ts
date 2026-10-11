import Phaser from 'phaser';
import { ORIGINS } from '../art/registry';
import { ART_SCALE } from '../art/paint';
import { depthAt, tileToWorld } from './iso';

export type UnitKind = 'chief' | 'survivor' | 'guard' | 'hero' | 'enemy';

export interface UnitOpts {
  kind: UnitKind;
  tex: string;
  x: number;
  y: number;
  hp?: number;
  damage?: number;
  range?: number;
  speed?: number;
  cooldown?: number;
  scale?: number;
  flying?: boolean;
  id?: string;
}

/** A character walking on the iso grid; position is in fractional tiles. */
export class Unit {
  sprite: Phaser.GameObjects.Sprite;
  kind: UnitKind;
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  speed: number;
  cooldown: number;
  flying: boolean;
  dead = false;
  /** Seconds until the next attack is allowed. */
  cd = 0;
  /** Where the unit is walking to, if anywhere. */
  dest: { x: number; y: number } | null = null;
  /** Free-form per-unit data for behaviours. */
  data: Record<string, any> = {};
  private walkT = Math.random();
  private attackFlash = 0;
  private baseScale: number;
  hpBar?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, o: UnitOpts) {
    this.kind = o.kind;
    this.id = o.id ?? o.tex;
    this.x = o.x;
    this.y = o.y;
    this.hp = this.maxHp = o.hp ?? 100;
    this.damage = o.damage ?? 10;
    this.range = o.range ?? 1;
    this.speed = o.speed ?? 1.5;
    this.cooldown = o.cooldown ?? 1;
    this.flying = !!o.flying;
    this.baseScale = (o.scale ?? 1) * ART_SCALE;
    const p = tileToWorld(o.x, o.y);
    this.sprite = scene.add.sprite(p.x, p.y, o.tex, 0);
    const org = ORIGINS.get(o.tex) ?? [0.5, 0.9];
    this.sprite.setOrigin(org[0], org[1]).setScale(this.baseScale);
    this.sprite.setDepth(depthAt(o.x, o.y));
  }

  get pos() {
    return { x: this.x, y: this.y };
  }

  dist(x: number, y: number) {
    return Math.hypot(this.x - x, this.y - y);
  }

  /** Steps towards dest; returns true on arrival. */
  step(dt: number, speedMult = 1): boolean {
    if (!this.dest) return true;
    const dx = this.dest.x - this.x;
    const dy = this.dest.y - this.y;
    const d = Math.hypot(dx, dy);
    const s = this.speed * speedMult * dt;
    if (d <= s || d < 0.02) {
      this.x = this.dest.x;
      this.y = this.dest.y;
      this.dest = null;
      return true;
    }
    this.x += (dx / d) * s;
    this.y += (dy / d) * s;
    this.face(dx, dy);
    this.walkT += dt;
    return false;
  }

  face(dx: number, dy: number) {
    // Screen-space x direction of a tile move is (dx - dy).
    const sx = dx - dy;
    if (Math.abs(sx) > 0.01) this.sprite.setFlipX(sx < 0);
  }

  attackAnim() {
    this.attackFlash = 0.22;
  }

  sync(dt: number) {
    const p = tileToWorld(this.x, this.y);
    this.sprite.setPosition(p.x, p.y);
    this.sprite.setDepth(depthAt(this.x, this.y) + 2);
    if (this.attackFlash > 0) {
      this.attackFlash -= dt;
      this.sprite.setFrame(3);
    } else if (this.dest) {
      this.sprite.setFrame(1 + (Math.floor(this.walkT * 7) % 2));
    } else {
      this.sprite.setFrame(0);
    }
    if (this.hpBar) {
      const show = this.hp < this.maxHp && !this.dead;
      this.hpBar.setVisible(show);
      if (show) {
        const w = 34;
        const top = this.sprite.getTopCenter();
        this.hpBar.clear();
        this.hpBar.fillStyle(0x1a0f08, 0.85).fillRect(top.x - w / 2 - 1, top.y - 9, w + 2, 6);
        const col = this.kind === 'enemy' ? 0xd8432e : 0x7ccf4a;
        this.hpBar.fillStyle(col, 1).fillRect(top.x - w / 2, top.y - 8, w * Math.max(0, this.hp / this.maxHp), 4);
        this.hpBar.setDepth(this.sprite.depth + 1);
      }
    }
  }

  destroy() {
    this.sprite.destroy();
    this.hpBar?.destroy();
  }
}
