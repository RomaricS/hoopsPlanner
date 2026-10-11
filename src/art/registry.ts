import Phaser from 'phaser';
import { HEROES, type HeroDef } from '../data/heroes';
import { paintBuildings } from './buildings';
import { iconTexs, paintEffects, paintFlames, paintIcon, FLAME_FRAMES, type IconId } from './effects';
import { paintNature, paintTerrainAtlas, TILE_FRAME_H, TILE_FRAME_W } from './nature';
import type { TexInfo } from './paint';
import { paintPortrait, paintUnits, type PersonLook, type Weapon } from './units';

/** Origin (0..1) of each generated texture, so sprites stand on their anchor. */
export const ORIGINS = new Map<string, [number, number]>();

export const KENNEY = [
  'dirtFarmland_N', 'dirtFarmland_E', 'corn_N', 'cornDouble_N', 'cornDouble_E', 'cornYoung_N', 'cornYoungDouble_N',
  'hayBales_N', 'hayBalesStacked_N', 'sacksCrate_N', 'sack_N', 'hay_N', 'fenceLow_N', 'fenceLow_E', 'fenceLow_S', 'fenceLow_W',
];
/** Kenney sprites are 256 wide with the tile centre 157 px down a 232 px crop. */
export const KENNEY_ORIGIN: [number, number] = [0.5, 157 / 232];

export function heroLook(h: HeroDef): PersonLook {
  const weapon: Weapon = h.role === 'Warrior' ? 'spear' : h.role === 'Archer' ? 'bow' : 'staff';
  return { skin: h.look.skin, cloth: h.look.robe, cloth2: h.look.accent, head: h.look.headwear, weapon, cape: h.look.bg, accent: h.look.accent };
}

function addTex(scene: Phaser.Scene, t: TexInfo) {
  scene.textures.addCanvas(t.key, t.canvas);
  ORIGINS.set(t.key, [t.ox / t.w, t.oy / t.h]);
}

export function registerArt(scene: Phaser.Scene) {
  for (const t of paintBuildings()) addTex(scene, t);
  for (const t of paintNature()) addTex(scene, t);
  for (const t of paintEffects()) addTex(scene, t);
  for (const t of iconTexs()) addTex(scene, t);

  const atlas = paintTerrainAtlas();
  const tt = scene.textures.addCanvas('terrain', atlas.canvas)!;
  for (const f of atlas.frames) {
    const h = f.name.startsWith('side') ? TILE_FRAME_H / 2 + 64 : TILE_FRAME_H;
    const w = f.name.startsWith('side') ? TILE_FRAME_W / 2 + 2 : TILE_FRAME_W;
    tt.add(f.name, 0, f.x, f.y, w, h);
  }

  for (const s of paintUnits(HEROES.map((h) => ({ id: h.id, look: heroLook(h) })))) {
    const t = scene.textures.addCanvas(s.key, s.canvas)!;
    for (let i = 0; i < s.frames; i++) t.add(i, 0, i * s.frameW, 0, s.frameW, s.frameH);
    ORIGINS.set(s.key, [s.ox / s.frameW, s.oy / s.frameH]);
  }

  const fl = paintFlames();
  const ft = scene.textures.addCanvas('fx_flame', fl.canvas)!;
  for (let i = 0; i < FLAME_FRAMES; i++) ft.add(i, 0, i * fl.fw, 0, fl.fw, fl.fh);
  ORIGINS.set('fx_flame', [0.5, (fl.fh - 10) / fl.fh]);
  scene.anims.create({
    key: 'flame',
    frames: scene.anims.generateFrameNumbers('fx_flame', { start: 0, end: FLAME_FRAMES - 1 }),
    frameRate: 10,
    repeat: -1,
  });
  for (const k of KENNEY) ORIGINS.set(`k_${k}`, KENNEY_ORIGIN);
}

// ---------------------------------------------------------------- DOM images

const urlCache = new Map<string, string>();

export function iconUrl(id: IconId): string {
  const key = `icon:${id}`;
  if (!urlCache.has(key)) urlCache.set(key, paintIcon(id).toDataURL());
  return urlCache.get(key)!;
}

export function portraitUrl(h: HeroDef): string {
  const key = `portrait:${h.id}`;
  if (!urlCache.has(key)) urlCache.set(key, paintPortrait(heroLook(h), h.look.bg).toDataURL());
  return urlCache.get(key)!;
}

/** Thumbnail of a building texture for the build menu. */
export function buildingThumb(scene: Phaser.Scene, type: string, tier = 0): string {
  const key = `thumb:${type}:${tier}`;
  if (urlCache.has(key)) return urlCache.get(key)!;
  const src = scene.textures.get(`b_${type}_${tier}`).getSourceImage() as HTMLCanvasElement;
  const c = document.createElement('canvas');
  const size = 160;
  c.width = size;
  c.height = size;
  const s = Math.min(size / src.width, size / src.height) * 0.98;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, (size - src.width * s) / 2, size - src.height * s, src.width * s, src.height * s);
  if (type === 'maize') {
    // The field is made of Kenney sprites; draw them into the thumbnail too.
    const corn = scene.textures.get('k_cornDouble_N').getSourceImage() as HTMLImageElement;
    const k = s * 0.5 * 2;
    for (const [dx, dy] of [
      [0, -0.5],
      [-0.5, 0],
      [0.5, 0],
      [0, 0.5],
    ]) {
      const cx = size / 2 + dx * 128 * s * 2 * 0.5;
      const cy = size - 20 - 64 * s - 10 + dy * 64 * s * 1.2;
      ctx.drawImage(corn, cx - 128 * k * 0.5, cy - 157 * k * 0.5, 256 * k * 0.5, 232 * k * 0.5);
    }
  }
  const url = c.toDataURL();
  urlCache.set(key, url);
  return url;
}
