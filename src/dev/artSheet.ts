// Dev-only page that lays out every procedural texture for visual review.
import { paintBuildings } from '../art/buildings';
import { paintNature, paintTerrainAtlas } from '../art/nature';
import { paintUnits, paintPortrait } from '../art/units';
import { paintEffects, iconTexs, paintFlames } from '../art/effects';
import { HEROES } from '../data/heroes';

function show(label: string, canvas: HTMLCanvasElement, scale = 0.5) {
  const d = document.createElement('div');
  d.className = 'cell';
  const c = document.createElement('canvas');
  c.width = canvas.width * scale;
  c.height = canvas.height * scale;
  c.getContext('2d')!.drawImage(canvas, 0, 0, c.width, c.height);
  d.append(c, label);
  document.body.append(d);
}
const only = new URLSearchParams(location.search).get('only');
if (!only || only === 'b') for (const t of paintBuildings()) show(t.key, t.canvas);
if (!only || only === 'n') {
  show('terrain', paintTerrainAtlas().canvas);
  for (const t of paintNature()) show(t.key, t.canvas);
}
if (!only || only === 'u') {
  for (const s of paintUnits(HEROES.map((h) => ({ id: h.id, look: { skin: h.look.skin, cloth: h.look.robe, cloth2: h.look.accent, head: h.look.headwear, weapon: 'spear', cape: h.look.accent } })))) show(s.key, s.canvas, 0.75);
  for (const h of HEROES) show(h.id, paintPortrait({ skin: h.look.skin, cloth: h.look.robe, cloth2: h.look.accent, head: h.look.headwear, weapon: 'none', accent: h.look.accent }, h.look.bg), 0.6);
  show('flames', paintFlames().canvas);
  for (const t of paintEffects()) show(t.key, t.canvas, 1);
  for (const t of iconTexs()) show(t.key, t.canvas, 1);
}
(window as unknown as { artReady: boolean }).artReady = true;
