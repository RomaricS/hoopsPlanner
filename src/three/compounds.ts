import * as THREE from 'three';
import { model } from './assets';
import { baobab, buildingModel } from './models';
import { mudTexture, thatchTexture, woodTexture } from './textures';

/**
 * Cutaway compounds in the spirit of idle base-builders: no roofs, low walls on the
 * camera side, and the work happening inside on show. Each compound also returns
 * work stations (local position, facing and animation) for villagers.
 */
export interface Station {
  x: number;
  z: number;
  /** Rotation around Y; 0 faces +z. */
  face: number;
  anim: string;
  /** Height above ground (e.g. the watchtower platform). */
  y?: number;
  tool?: 'axe' | 'hoe' | 'spear' | 'basket' | 'pick' | 'hammer' | 'staff' | 'none';
}

export interface Compound {
  group: THREE.Group;
  stations: Station[];
}

const mats = new Map<string, THREE.MeshStandardMaterial>();
function std(key: string, p: () => THREE.MeshStandardMaterialParameters) {
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ roughness: 0.9, ...p() }));
  return mats.get(key)!;
}
const M = {
  wall: () => std('cwall', () => ({ map: mudTexture('#c27a46') })),
  wallTop: () => std('cwallTop', () => ({ color: '#9a5a30' })),
  floor: () => std('cfloor', () => ({ color: '#c9a27a' })),
  mat: (c: string) => std(`mat${c}`, () => ({ color: c })),
  wood: () => std('cwood', () => ({ map: woodTexture('#8b5a2b') })),
  dark: () => std('cdark', () => ({ map: woodTexture('#5b3218') })),
  thatch: () => std('cthatch', () => ({ map: thatchTexture() })),
  clay: () => std('cclay', () => ({ color: '#a8552e' })),
  metal: () => std('cmetal', () => ({ color: '#8f99a3', metalness: 0.5, roughness: 0.45 })),
  fire: () => std('cfire', () => ({ color: '#ff8a2a', emissive: '#ff5a10', emissiveIntensity: 1.6 })),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/**
 * Mud wall enclosure of half-size e. Back walls (-x, -z) are taller than the
 * front walls facing the camera, with a gate in the front-right wall.
 */
function enclosure(e: number, back = 0.34, front = 0.12) {
  const g = new THREE.Group();
  const t = 0.08;
  const floor = mesh(new THREE.BoxGeometry(e * 2, 0.05, e * 2), M.floor(), 0, 0.025, 0);
  floor.castShadow = false;
  g.add(floor);
  const wall = (len: number, h: number, x: number, z: number, alongX: boolean) => {
    const w = mesh(new THREE.BoxGeometry(alongX ? len : t, h, alongX ? t : len), M.wall(), x, h / 2, z);
    g.add(w);
    const cap = mesh(new THREE.BoxGeometry(alongX ? len + 0.02 : t + 0.04, 0.03, alongX ? t + 0.04 : len + 0.02), M.wallTop(), x, h + 0.015, z);
    g.add(cap);
  };
  wall(e * 2, back, 0, -e, true);
  wall(e * 2, back, -e, 0, false);
  // Front-left wall full, front-right wall split around a gate.
  wall(e * 2, front, 0, e, true);
  const gate = 0.32;
  const seg = (e * 2 - gate) / 2;
  wall(seg, front, e, -e + seg / 2, false);
  wall(seg, front, e, e - seg / 2, false);
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 6), M.dark(), e, 0.16, s * gate / 2));
  return g;
}

/** Small shaded corner shelter at the back of a compound. */
function backShelter(e: number, size = 0.55) {
  const g = new THREE.Group();
  for (const [x, z] of [
    [0, 0],
    [size, 0],
    [0, size],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6), M.dark(), x, 0.21, z));
  const roof = mesh(new THREE.BoxGeometry(size + 0.25, 0.06, size + 0.25), M.thatch(), size / 2, 0.45, size / 2);
  roof.rotation.z = -0.12;
  roof.rotation.x = 0.12;
  g.add(roof);
  g.position.set(-e + 0.12, 0, -e + 0.12);
  return g;
}

function table(w: number, d: number) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(w, 0.035, d), M.wood(), 0, 0.14, 0));
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ])
    g.add(mesh(new THREE.BoxGeometry(0.025, 0.14, 0.025), M.dark(), (x * (w - 0.05)) / 2, 0.07, (z * (d - 0.05)) / 2));
  return g;
}

function basket(fill: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.08, 10), std('basket', () => ({ color: '#b98a45' })), 0, 0.04, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.028, 6, 5), M.mat(fill), Math.cos(a) * 0.04, 0.085, Math.sin(a) * 0.04));
  }
  return g;
}

function pot(r = 0.07, color?: string) {
  const p = mesh(new THREE.SphereGeometry(r, 10, 8), color ? M.mat(color) : M.clay());
  p.scale.y = 1.15;
  p.position.y = r;
  return p;
}

function sleepingMat(c: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.42, 0.025, 0.2), M.mat(c), 0, 0.03, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), M.mat('#efe6d2'), -0.17, 0.06, 0).rotateX(Math.PI / 2));
  return g;
}

function cookingFire() {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const st = mesh(new THREE.DodecahedronGeometry(0.04, 0), std('stone', () => ({ color: '#8f8a80', flatShading: true })), Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08);
    g.add(st);
  }
  g.add(mesh(new THREE.ConeGeometry(0.05, 0.1, 6), M.fire(), 0, 0.06, 0));
  const pot = mesh(new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65), std('blackpot', () => ({ color: '#2a2420', roughness: 0.5 })), 0, 0.17, 0);
  g.add(pot);
  return g;
}

// ------------------------------------------------------------------ compounds

/** Homestead: a roofless round house with sleeping mats, pots and a cooking fire. */
function home(tier: number): Compound {
  const g = new THREE.Group();
  const r = 0.36;
  const wallMat = tier >= 1 ? std('homePaint', () => ({ map: mudTexture('#d9c3a0') })) : M.wall();
  // Ring wall: tall behind, low in front so the inside shows.
  const segs = 18;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const facing = Math.cos(a - Math.PI / 4); // +1 towards the camera
    if (facing > 0.75) continue; // doorway
    const h = facing > 0.2 ? 0.1 : 0.3;
    const w = mesh(new THREE.BoxGeometry(0.06, h, (2 * Math.PI * r) / segs + 0.01), wallMat, Math.cos(a) * r, h / 2, Math.sin(a) * r);
    w.rotation.y = -a;
    g.add(w);
    const cap = mesh(new THREE.BoxGeometry(0.08, 0.02, (2 * Math.PI * r) / segs + 0.02), M.wallTop(), Math.cos(a) * r, h + 0.01, Math.sin(a) * r);
    cap.rotation.y = -a;
    g.add(cap);
  }
  const floor = mesh(new THREE.CylinderGeometry(r, r, 0.03, 18), M.floor(), 0, 0.015, 0);
  floor.castShadow = false;
  g.add(floor);
  const m1 = sleepingMat('#c23b22');
  m1.position.set(-0.12, 0, -0.08);
  m1.rotation.y = 0.6;
  g.add(m1);
  if (tier >= 1) {
    const m2 = sleepingMat('#2d5fa6');
    m2.position.set(0.05, 0, -0.2);
    m2.rotation.y = -0.3;
    g.add(m2);
  }
  const p1 = pot(0.05);
  p1.position.set(-0.24, p1.position.y, 0.12);
  g.add(p1);
  const p2 = pot(0.04, '#c4703c');
  p2.position.set(-0.2, p2.position.y, 0.2);
  g.add(p2);
  const fire = cookingFire();
  fire.position.set(0.42, 0, 0.42);
  g.add(fire);
  return {
    group: g,
    stations: [
      { x: -0.12, z: -0.08, face: 0.6, anim: 'Lie_Idle' },
      { x: 0.32, z: 0.42, face: Math.PI / 2, anim: 'Sit_Floor_Idle' },
    ],
  };
}

function forager(): Compound {
  const e = 0.9;
  const g = enclosure(e);
  g.add(backShelter(e));
  const t = table(0.6, 0.28);
  t.position.set(0.1, 0, -0.15);
  g.add(t);
  const fills = ['#c0182f', '#e08a1e', '#5b2a7a', '#7aa03a', '#c0182f'];
  fills.forEach((f, i) => {
    const b = basket(f);
    b.position.set(-0.15 + i * 0.12, 0.155, -0.15);
    b.scale.setScalar(0.7);
    g.add(b);
  });
  [
    [-0.55, 0.35, '#c0182f'],
    [-0.4, 0.55, '#e08a1e'],
    [0.5, 0.5, '#5b2a7a'],
    [0.6, -0.55, '#7aa03a'],
  ].forEach(([x, z, c]) => {
    const b = basket(c as string);
    b.position.set(x as number, 0.03, z as number);
    g.add(b);
  });
  const sack = model('Textiles_Stack_Small');
  sack.scale.setScalar(0.28);
  sack.position.set(-0.6, 0.03, -0.1);
  g.add(sack);
  return {
    group: g,
    stations: [
      { x: 0.1, z: 0.08, face: Math.PI, anim: 'Working_A', tool: 'none' },
      { x: -0.25, z: 0.1, face: Math.PI, anim: 'Working_B', tool: 'none' },
      { x: -0.45, z: 0.45, face: 0.4, anim: 'PickUp', tool: 'basket' },
    ],
  };
}

function woodYard(): Compound {
  const e = 0.9;
  const g = enclosure(e, 0.3, 0.1);
  const pile = model('Wood_Log_Stack');
  pile.scale.setScalar(0.32);
  pile.position.set(-0.45, 0.03, -0.45);
  g.add(pile);
  const planks = model('Wood_Planks_Stack_Small');
  planks.scale.setScalar(0.3);
  planks.position.set(0.5, 0.03, -0.55);
  g.add(planks);
  for (const [x, z] of [
    [-0.1, 0.25],
    [0.4, 0.05],
  ]) {
    const stump = mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.1, 10), M.wood(), x, 0.08, z);
    g.add(stump);
  }
  // Sawhorse with a log.
  const saw = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = mesh(new THREE.BoxGeometry(0.03, 0.18, 0.16), M.dark(), s * 0.15, 0.09, 0);
    saw.add(leg);
  }
  const lg = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), M.wood(), 0, 0.2, 0);
  lg.rotation.z = Math.PI / 2;
  saw.add(lg);
  saw.position.set(-0.4, 0.03, 0.35);
  saw.rotation.y = 0.5;
  g.add(saw);
  // Wood chips.
  for (let i = 0; i < 20; i++) {
    const c = mesh(new THREE.BoxGeometry(0.03, 0.01, 0.02), M.mat('#d9a86a'), Math.sin(i * 7.1) * 0.5, 0.06, Math.cos(i * 3.3) * 0.5);
    c.rotation.y = i;
    c.castShadow = false;
    g.add(c);
  }
  return {
    group: g,
    stations: [
      { x: -0.1, z: 0.42, face: Math.PI, anim: 'Chopping', tool: 'axe' },
      { x: 0.4, z: 0.25, face: Math.PI, anim: 'Chopping', tool: 'axe' },
      { x: -0.4, z: 0.55, face: Math.PI * 0.8, anim: 'Sawing', tool: 'none' },
    ],
  };
}

function lodge(tier: number): Compound {
  const e = 0.9;
  const g = enclosure(e, 0.36, 0.12);
  g.add(backShelter(e, 0.6));
  // Weapon rack.
  for (let i = 0; i < 5; i++) {
    const sp = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6, 4), M.dark(), 0.2 + i * 0.08, 0.3, -0.75);
    g.add(sp);
    g.add(mesh(new THREE.ConeGeometry(0.02, 0.08, 4), M.metal(), 0.2 + i * 0.08, 0.64, -0.75));
  }
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), M.dark(), 0.36, 0.42, -0.74));
  // Training dummies.
  for (const [x, z] of [
    [0.45, 0.2],
    [-0.1, 0.5],
  ]) {
    const d = new THREE.Group();
    d.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 5), M.dark(), 0, 0.2, 0));
    d.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 8), std('straw', () => ({ map: thatchTexture() })), 0, 0.3, 0));
    d.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), std('straw', () => ({})), 0, 0.44, 0));
    d.position.set(x, 0.03, z);
    g.add(d);
  }
  void tier;
  return {
    group: g,
    stations: [
      { x: 0.45, z: -0.05, face: 0, anim: 'Melee_2H_Attack_Stab', tool: 'spear' },
      { x: -0.1, z: 0.25, face: 0, anim: 'Melee_1H_Attack_Chop', tool: 'spear' },
      { x: -0.35, z: -0.2, face: 0.8, anim: 'Melee_Blocking', tool: 'spear' },
    ],
  };
}

function smithy(): Compound {
  const e = 0.9;
  const g = enclosure(e, 0.34, 0.12);
  const furnace = buildingModel('smelter', 0);
  furnace.scale.setScalar(0.75);
  furnace.position.set(-0.25, 0, -0.25);
  // Drop the smelter's own pad.
  furnace.children[0].visible = false;
  g.add(furnace);
  const anvil = new THREE.Group();
  anvil.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8), M.wood(), 0, 0.06, 0));
  anvil.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), M.metal(), 0, 0.15, 0));
  anvil.position.set(0.35, 0.03, 0.3);
  g.add(anvil);
  return {
    group: g,
    stations: [
      { x: 0.35, z: 0.5, face: Math.PI, anim: 'Hammering', tool: 'hammer' },
      { x: 0.25, z: -0.25, face: -Math.PI / 2, anim: 'Working_C', tool: 'none' },
    ],
  };
}

function quarry(): Compound {
  const c = buildingModel('quarry', 0);
  return {
    group: c,
    stations: [
      { x: -0.25, z: 0.05, face: -Math.PI * 0.75, anim: 'Pickaxing', tool: 'pick' },
      { x: 0.15, z: -0.2, face: -Math.PI * 0.75, anim: 'Pickaxing', tool: 'pick' },
    ],
  };
}

function farm(tier: number): Compound {
  const c = buildingModel('maize', tier);
  return {
    group: c,
    stations: [
      { x: -0.5, z: 0.05, face: 0, anim: 'Digging', tool: 'hoe' },
      { x: 0.3, z: 0.55, face: 0, anim: 'Digging', tool: 'hoe' },
    ],
  };
}

function hearth(tier: number): Compound {
  const c = buildingModel('hearth', tier);
  return {
    group: c,
    stations: [
      { x: 0.85, z: 0.15, face: -Math.PI / 2, anim: 'Sit_Floor_Idle' },
      { x: 0.15, z: 0.85, face: Math.PI, anim: 'Sit_Floor_Idle' },
      { x: 0.75, z: 0.75, face: -Math.PI * 0.75, anim: 'Cheering' },
    ],
  };
}

function griot(): Compound {
  const g = new THREE.Group();
  const floor = mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.04, 24), M.floor(), 0, 0.02, 0);
  floor.castShadow = false;
  g.add(floor);
  const tree = baobab(1.1);
  tree.position.set(-0.25, 0, -0.25);
  g.add(tree);
  return {
    group: g,
    stations: [
      { x: 0.35, z: 0.1, face: -Math.PI / 2, anim: 'Sit_Floor_Idle' },
      { x: 0.05, z: 0.45, face: Math.PI, anim: 'Sit_Floor_Idle' },
      { x: 0.55, z: 0.55, face: -Math.PI * 0.75, anim: 'Sit_Floor_Idle' },
      { x: 0.2, z: 0.25, face: Math.PI * 0.25, anim: 'Waving', tool: 'staff' },
    ],
  };
}

function well(): Compound {
  return { group: buildingModel('well', 0), stations: [{ x: 0.3, z: 0.05, face: -Math.PI / 2, anim: 'Working_B' }] };
}

function watchtower(tier: number): Compound {
  const g = buildingModel('watchtower', tier);
  const h = 1.0 + tier * 0.15;
  return { group: g, stations: [{ x: 0, z: 0, face: Math.PI / 4, anim: 'Ranged_Bow_Idle', tool: 'none', y: h + 0.03 }] };
}

export function compoundModel(type: string, tier: number): Compound {
  switch (type) {
    case 'hut':
      return home(tier);
    case 'forager':
      return forager();
    case 'woodcutter':
      return woodYard();
    case 'lodge':
      return lodge(tier);
    case 'smelter':
      return smithy();
    case 'quarry':
      return quarry();
    case 'maize':
      return farm(tier);
    case 'hearth':
      return hearth(tier);
    case 'griot':
      return griot();
    case 'well':
      return well();
    case 'watchtower':
      return watchtower(tier);
    default:
      return { group: buildingModel(type, tier), stations: [] };
  }
}
