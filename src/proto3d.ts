// 3D visual test: a sample village built from the real game data, rendered with Three.js.
import '@fontsource/lilita-one';
import * as THREE from 'three';
import * as assets from './three/assets';
import * as people from './three/people';
const { loadAssets } = assets;
import type { Outfit } from './three/people';
import { World3D } from './three/world3d';
import { newGame } from './sim/state';
import * as eco from './sim/economy';

const css = document.createElement('style');
css.textContent = `
  html, body { margin: 0; height: 100%; overflow: hidden; background: #1a0f08; touch-action: none; font-family: 'Lilita One', sans-serif; color: #fff6dc; }
  #view { position: fixed; inset: 0; }
  #hud { position: fixed; left: 50%; bottom: max(10px, env(safe-area-inset-bottom)); transform: translateX(-50%); display: flex; gap: 6px; align-items: center;
    background: rgba(30,18,9,.85); border: 2px solid #2a160a; border-radius: 14px; padding: 6px 10px; }
  #hud button { font: inherit; font-size: 14px; color: #fff6dc; background: linear-gradient(#a06a3a,#5a3720); border: 2px solid #2a160a; border-radius: 10px; padding: 6px 10px; text-shadow: 0 2px 0 #2a160a; }
  #hud button.on { background: linear-gradient(#ffe38a,#d79a1e); }
  #hud input { width: 140px; }
  #loading { position: fixed; inset: 0; display: grid; place-items: center; font-size: 22px; background: #1a0f08; z-index: 5; }
  #fps { position: fixed; top: 8px; right: 10px; font: 12px monospace; opacity: .7; }
`;
document.head.append(css);
const loading = Object.assign(document.createElement('div'), { id: 'loading', textContent: 'Loading the savanna…' });
document.body.append(loading);

async function main() {
  await loadAssets((f) => (loading.textContent = `Loading the savanna… ${Math.round(f * 100)}%`));
  const state = newGame(20261012);
  // A village as a player would have it around Hearth level 4.
  state.buildings[0].level = 4;
  for (const k of Object.keys(state.res)) (state.res as Record<string, number>)[k] = 99999;
  const order = ['hut', 'forager', 'hut', 'woodcutter', 'well', 'granary', 'watchtower', 'quarry', 'maize', 'griot', 'lodge', 'hut', 'hut', 'well', 'forager', 'smelter', 'kraal', 'hut', 'hut', 'woodcutter', 'maize', 'watchtower', 'hut', 'hut'];
  for (const t of order) {
    eco.placeBuilding(state, t);
    for (const b of state.buildings) if (b.construct) b.construct.end = state.time;
    eco.tick(state, 0.01);
  }

  const world = new World3D(document.getElementById('view')!);
  world.buildTerrain(state);
  for (const n of state.nodes) world.addNode(n);

  const skins = ['#8d5524', '#a0673a', '#7a4a2a', '#9a6440', '#6e4226', '#b07850'];
  const wraps: [string, string][] = [
    ['#c2733a', '#2d5fa6'],
    ['#2e6b4f', '#f0c33c'],
    ['#8c2f39', '#e9dcc0'],
    ['#d9b36a', '#c23b22'],
    ['#5b4a8a', '#f0c33c'],
    ['#1f6b3a', '#e8b83a'],
    ['#e2c044', '#8c2f39'],
  ];
  let k = 0;
  const villager = (tool?: string, guard = false): Outfit => {
    const i = k++;
    const woman = i % 2 === 0 && !guard;
    const [w1, w2] = wraps[i % wraps.length];
    if (guard) return { skin: skins[i % skins.length], wrap: '#e9dcc0', wrap2: '#3a2414', hair: 'plume', tool: 'spear', shield: true };
    return {
      skin: skins[i % skins.length],
      wrap: w1,
      wrap2: w2,
      top: woman ? w2 : undefined,
      accent: woman ? w1 : undefined,
      hair: woman ? (i % 4 === 0 ? 'headwrap' : 'braids') : i % 3 === 0 ? 'bald' : 'short',
      tool: (tool as Outfit['tool']) ?? 'none',
    };
  };
  for (const b of state.buildings) world.addCompound(b.type, b.x, b.y, b.level, (_i, tool) => villager(tool, b.type === 'lodge'));

  // People walking the roads between compounds.
  const h = state.buildings[0];
  const center = new THREE.Vector3(h.x + 1, 0, h.y + 1);
  for (let i = 0; i < 14; i++) {
    const road = (Math.floor(i / 2) - 3) * 3 + 2;
    const home = i % 2 ? new THREE.Vector3(center.x + road + 0.5, 0, center.z + 0.5) : new THREE.Vector3(center.x + 0.5, 0, center.z + road + 0.5);
    world.addWalker(villager(i % 3 === 0 ? 'basket' : undefined), home, 2.5, 'Waving');
  }
  world.applyToon();
  world.target.set(center.x + 1, 0, center.z + 1);
  world.setZoom(2);

  // Time-of-day controls.
  const hud = document.getElementById('hud')!;
  hud.innerHTML = `<button data-p="0.3" class="on">Day</button><button data-p="0.69">Dusk</button><button data-p="0.85">Night</button>
    <input id="t" type="range" min="0" max="1000" value="300"><button id="play">▶ Time</button>`;
  let running = false;
  const slider = hud.querySelector('#t') as HTMLInputElement;
  hud.onclick = (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.id === 'play') {
      running = !running;
      b.classList.toggle('on', running);
      return;
    }
    hud.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b));
    world.setPhase(+b.dataset.p!);
    slider.value = String(+b.dataset.p! * 1000);
  };
  slider.oninput = () => world.setPhase(+slider.value / 1000);
  world.setPhase(0.3);

  const fps = Object.assign(document.createElement('div'), { id: 'fps' });
  document.body.append(fps);
  let frames = 0;
  let acc = 0;
  world.start((dt) => {
    if (running) {
      world.setPhase(world.phase + dt / 60);
      slider.value = String(world.phase * 1000);
    }
    frames++;
    acc += dt;
    if (acc > 1) {
      fps.textContent = `${Math.round(frames / acc)} fps`;
      frames = 0;
      acc = 0;
    }
  });
  Object.assign(window, { world, THREE, assets, people });
  loading.remove();

}

main();
