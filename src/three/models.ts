import * as THREE from 'three';
import { model, tinted } from './assets';
import { barkTexture, mudTexture, paintedWallTexture, stoneTexture, thatchTexture, woodTexture } from './textures';

/**
 * Procedural low-poly African architecture. Units: 1 = one tile. Every builder
 * returns a group whose origin is the ground centre of the building footprint.
 * The camera looks from +x +z, so "front" faces that way.
 */

const FRONT = Math.PI / 4; // y-rotation that turns a +x facing detail towards the camera.
const mats = new Map<string, THREE.Material>();

function std(key: string, make: () => THREE.MeshStandardMaterialParameters) {
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...make() }));
  return mats.get(key)! as THREE.MeshStandardMaterial;
}

const M = {
  thatch: () => std('thatch', () => ({ map: thatchTexture() })),
  thatchDark: () => std('thatchDark', () => ({ map: thatchTexture('#a87a3a') })),
  mud: () => std('mud', () => ({ map: mudTexture('#b8693a') })),
  mudLight: () => std('mudLight', () => ({ map: mudTexture('#c98a52') })),
  wallPaint: () => std('wallPaint', () => ({ map: paintedWallTexture('#e6d6b8', ['#1d1d1d', '#c23b22', '#2d5fa6', '#e8b83a']) })),
  wallOchre: () => std('wallOchre', () => ({ map: paintedWallTexture('#c98a52', ['#4a2412', '#e9dcc0', '#7a2e1a']) })),
  stone: () => std('stone', () => ({ map: stoneTexture() })),
  wood: () => std('wood', () => ({ map: woodTexture() })),
  darkWood: () => std('darkWood', () => ({ map: woodTexture('#5b3218') })),
  bark: () => std('bark', () => ({ map: barkTexture() })),
  dark: () => std('dark', () => ({ color: '#1e130b' })),
  earth: () => std('earth', () => ({ color: '#9c7650' })),
  leaf: () => std('leaf', () => ({ color: '#6c8f2f', flatShading: true })),
  leafDark: () => std('leafDark', () => ({ color: '#557a26', flatShading: true })),
  clay: () => std('clay', () => ({ color: '#a8552e' })),
  hide: () => std('hide', () => ({ color: '#efe6d2' })),
  cloth: (c: string) => std(`cloth${c}`, () => ({ color: c })),
};

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Packed-earth pad under a building. */
function pad(n: number, color = '#a88a62') {
  const g = new THREE.CylinderGeometry(n * 0.5, n * 0.52, 0.06, 4, 1);
  g.rotateY(Math.PI / 4);
  const m = mesh(g, std(`pad${color}`, () => ({ color })), 0, 0.02, 0);
  m.scale.set(1.3, 1, 1.3);
  m.castShadow = false;
  return m;
}

function roundHut(r: number, h: number, wall: THREE.Material, roof = M.thatch()) {
  const g = new THREE.Group();
  const w = mesh(new THREE.CylinderGeometry(r, r * 1.04, h, 24, 1, false), wall, 0, h / 2, 0);
  g.add(w);
  // Doorway on the camera side.
  const door = mesh(new THREE.BoxGeometry(0.06, h * 0.68, r * 0.55), M.dark(), 0, h * 0.34, 0);
  door.position.set(Math.cos(FRONT) * r * 0.97, h * 0.34, Math.sin(FRONT) * r * 0.97);
  door.rotation.y = -FRONT;
  g.add(door);
  const lintel = mesh(new THREE.BoxGeometry(0.08, 0.04, r * 0.7), M.darkWood(), door.position.x * 1.02, h * 0.7, door.position.z * 1.02);
  lintel.rotation.y = -FRONT;
  g.add(lintel);
  // Thatched cone with an overhang and a finial.
  const roofH = r * 1.55;
  const cone = mesh(new THREE.ConeGeometry(r * 1.32, roofH, 24, 3, true), roof, 0, h + roofH / 2 - 0.06, 0);
  (cone.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(cone);
  g.add(mesh(new THREE.ConeGeometry(r * 0.12, r * 0.35, 8), M.thatchDark(), 0, h + roofH - 0.02, 0));
  return g;
}

function stake(h: number, r = 0.035, mat = M.wood()) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(r, r, h, 6), mat, 0, h / 2, 0));
  g.add(mesh(new THREE.ConeGeometry(r, r * 3, 6), mat, 0, h + r * 1.5, 0));
  return g;
}

function log(len: number, r: number) {
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 8), M.wood());
  m.rotation.z = Math.PI / 2;
  return m;
}

function basket(fruit: string) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.08, 12), std('basket', () => ({ color: '#b98a45' })), 0, 0.04, 0));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    g.add(mesh(new THREE.SphereGeometry(0.03, 6, 5), M.cloth(fruit), Math.cos(a) * 0.045, 0.09, Math.sin(a) * 0.045));
  }
  return g;
}

function boulder(s: number, color = '#9c968c') {
  const geo = new THREE.DodecahedronGeometry(s, 0);
  geo.scale(1, 0.7, 1);
  return mesh(geo, std(`rock${color}`, () => ({ color, flatShading: true })));
}

function cow(white: boolean) {
  const g = new THREE.Group();
  const body = white ? M.hide() : std('cowBrown', () => ({ color: '#8a4a22' }));
  g.add(mesh(new THREE.BoxGeometry(0.34, 0.16, 0.16), body, 0, 0.2, 0));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), body, 0.2, 0.26, 0));
  for (const [x, z] of [
    [-0.12, -0.05],
    [-0.12, 0.05],
    [0.12, -0.05],
    [0.12, 0.05],
  ])
    g.add(mesh(new THREE.BoxGeometry(0.04, 0.13, 0.04), body, x, 0.065, z));
  // Long lyre horns (Ankole).
  for (const s of [-1, 1]) {
    const horn = mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.22, 5), M.hide(), 0.21, 0.36, s * 0.07);
    horn.rotation.x = s * 0.6;
    g.add(horn);
  }
  return g;
}

// ------------------------------------------------------------------ buildings

function hearth(tier: number) {
  const g = new THREE.Group();
  g.add(pad(2, tier >= 2 ? '#c9a67a' : '#a88a62'));
  const fire = new THREE.Group();
  fire.name = 'fire';
  fire.position.set(0.35, 0, 0.35);
  // Stone ring.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const b = boulder(0.07 + (i % 3) * 0.01);
    b.position.set(Math.cos(a) * 0.3, 0.04, Math.sin(a) * 0.3);
    b.rotation.y = i;
    fire.add(b);
  }
  for (let i = 0; i < 3; i++) {
    const l = log(0.42, 0.035);
    l.rotation.set(0.2, (i / 3) * Math.PI, Math.PI / 2 - 0.35);
    l.position.y = 0.07;
    fire.add(l);
  }
  g.add(fire);
  if (tier === 0) {
    const hut = roundHut(0.32, 0.38, M.mud());
    hut.position.set(-0.35, 0.04, -0.35);
    g.add(hut);
    const pole = stake(0.9, 0.05, M.darkWood());
    pole.position.set(0.5, 0, -0.55);
    g.add(pole);
    for (const [x, z, r] of [
      [0.95, 0.15, 0.6],
      [0.15, 0.95, -0.6],
    ]) {
      const bench = log(0.5, 0.06);
      bench.position.set(x, 0.06, z);
      bench.rotation.y = r;
      g.add(bench);
    }
  } else if (tier === 1) {
    const hut = roundHut(0.5, 0.55, M.wallPaint());
    hut.position.set(-0.3, 0.04, -0.3);
    g.add(hut);
  } else {
    // Sudano-Sahelian palace: plastered walls, buttress towers, toron beams.
    const p = new THREE.Group();
    const mat = std('banco', () => ({ map: mudTexture('#c99a64') }));
    p.add(mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), mat, 0, 0.4, 0));
    for (const [x, z] of [
      [-0.55, -0.4],
      [0.55, -0.4],
      [-0.55, 0.4],
      [0.55, 0.4],
    ]) {
      p.add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.1, 8), mat, x, 0.55, z));
      p.add(mesh(new THREE.ConeGeometry(0.1, 0.25, 8), mat, x, 1.22, z));
      p.add(mesh(new THREE.SphereGeometry(0.035, 6, 4), std('egg', () => ({ color: '#efe4c8' })), x, 1.36, z));
    }
    for (let i = 0; i < 6; i++)
      for (let r = 0; r < 2; r++) {
        const beam = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 4), M.darkWood(), -0.45 + i * 0.18, 0.3 + r * 0.3, 0.42);
        beam.rotation.x = Math.PI / 2;
        p.add(beam);
      }
    p.add(mesh(new THREE.BoxGeometry(0.22, 0.38, 0.05), M.dark(), 0, 0.19, 0.41));
    p.position.set(-0.3, 0, -0.3);
    p.rotation.y = 0;
    g.add(p);
  }
  return g;
}

function hut(tier: number) {
  const g = new THREE.Group();
  g.add(pad(1));
  const wall = [M.mud(), M.wallOchre(), M.wallPaint()][tier];
  if (tier >= 2) {
    const a = roundHut(0.26, 0.32, wall);
    a.position.set(-0.12, 0.04, -0.14);
    g.add(a);
    const b = roundHut(0.18, 0.24, wall);
    b.position.set(0.22, 0.04, 0.18);
    g.add(b);
  } else {
    const a = roundHut(0.3, 0.36, wall);
    a.position.y = 0.04;
    g.add(a);
  }
  if (tier >= 1) {
    const pot = mesh(new THREE.SphereGeometry(0.06, 10, 8), M.clay(), 0.34, 0.08, 0.1);
    pot.scale.y = 1.2;
    g.add(pot);
  }
  return g;
}

function forager() {
  const g = new THREE.Group();
  g.add(pad(2));
  const s = new THREE.Group();
  for (const [x, z] of [
    [-0.32, -0.32],
    [0.32, -0.32],
    [-0.32, 0.32],
    [0.32, 0.32],
  ])
    s.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.5, 6), M.darkWood(), x, 0.25, z));
  const roof = mesh(new THREE.ConeGeometry(0.62, 0.45, 20, 2, true), M.thatch(), 0, 0.66, 0);
  s.add(roof);
  s.position.set(-0.3, 0, -0.3);
  g.add(s);
  const colors = ['#b0203a', '#5b2a7a', '#e08a1e', '#c0182f'];
  [
    [0.35, 0.2],
    [0.55, 0.45],
    [0.15, 0.55],
    [0.6, -0.1],
  ].forEach(([x, z], i) => {
    const b = basket(colors[i]);
    b.position.set(x, 0.05, z);
    g.add(b);
  });
  // Drying rack with roots.
  const rack = new THREE.Group();
  rack.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), M.wood(), -0.25, 0.25, 0));
  rack.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 5), M.wood(), 0.25, 0.25, 0));
  const bar = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.56, 5), M.wood(), 0, 0.48, 0);
  bar.rotation.z = Math.PI / 2;
  rack.add(bar);
  for (let i = 0; i < 6; i++) rack.add(mesh(new THREE.CapsuleGeometry(0.02, 0.1, 2, 5), M.cloth(i % 2 ? '#9c5a2e' : '#c2733a'), -0.2 + i * 0.08, 0.38, 0));
  rack.position.set(0.55, 0, -0.45);
  rack.rotation.y = -FRONT;
  g.add(rack);
  return g;
}

function well() {
  const g = new THREE.Group();
  g.add(pad(1, '#a99a80'));
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 20, 1, true), M.stone(), 0, 0.13, 0));
  const rim = mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 20), M.stone(), 0, 0.24, 0);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const water = mesh(new THREE.CircleGeometry(0.26, 20), std('wellWater', () => ({ color: '#2f78a6', roughness: 0.15 })), 0, 0.16, 0);
  water.rotation.x = -Math.PI / 2;
  g.add(water);
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.62, 6), M.darkWood(), s * 0.3, 0.31, 0));
  const bar = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), M.darkWood(), 0, 0.6, 0);
  bar.rotation.z = Math.PI / 2;
  g.add(bar);
  g.add(mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.24, 3), std('rope', () => ({ color: '#d8c08a' })), 0.05, 0.47, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 10), M.wood(), 0.05, 0.33, 0));
  const pot = mesh(new THREE.SphereGeometry(0.07, 10, 8), M.clay(), 0.35, 0.09, 0.3);
  g.add(pot);
  return g;
}

function woodcutter() {
  const g = new THREE.Group();
  g.add(pad(2));
  const h = roundHut(0.32, 0.38, M.mud());
  h.position.set(0.25, 0.04, -0.4);
  g.add(h);
  const pile = model('Wood_Log_Stack');
  pile.scale.setScalar(0.35);
  pile.position.set(-0.35, 0.04, 0.25);
  pile.rotation.y = FRONT;
  g.add(pile);
  const stump = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 10), M.wood(), 0.45, 0.07, 0.4);
  g.add(stump);
  const planks = model('Wood_Planks_Stack_Small');
  planks.scale.setScalar(0.3);
  planks.position.set(-0.45, 0.04, -0.4);
  g.add(planks);
  return g;
}

function quarry() {
  const g = new THREE.Group();
  g.add(pad(2, '#a39a88'));
  const pit = mesh(new THREE.CylinderGeometry(0.45, 0.32, 0.08, 6), std('pit', () => ({ color: '#6e675c', flatShading: true })), -0.1, 0.03, -0.1);
  g.add(pit);
  const rockA = tinted('Rock_3_A', '#e8d8c8');
  rockA.scale.setScalar(0.32);
  rockA.position.set(-0.45, 0, -0.5);
  g.add(rockA);
  const bricks = model('Stone_Bricks_Stack_Medium');
  bricks.scale.setScalar(0.32);
  bricks.position.set(0.45, 0.04, 0.3);
  g.add(bricks);
  const chunks = model('Stone_Chunks_Large');
  chunks.scale.setScalar(0.32);
  chunks.position.set(0.1, 0.04, 0.55);
  g.add(chunks);
  return g;
}

function granary(tier: number) {
  const g = new THREE.Group();
  g.add(pad(1));
  const make = (s: number) => {
    const o = new THREE.Group();
    for (const [x, z] of [
      [-0.12, -0.12],
      [0.12, -0.12],
      [-0.12, 0.12],
      [0.12, 0.12],
    ]) {
      const b = boulder(0.06 * s);
      b.position.set(x * s, 0.05, z * s);
      o.add(b);
    }
    o.add(mesh(new THREE.BoxGeometry(0.34 * s, 0.4 * s, 0.34 * s), tier ? M.mudLight() : M.mud(), 0, 0.1 + 0.2 * s, 0));
    const hatch = mesh(new THREE.BoxGeometry(0.1 * s, 0.1 * s, 0.02), M.darkWood(), 0, 0.1 + 0.26 * s, 0.17 * s + 0.01);
    o.add(hatch);
    const roof = mesh(new THREE.ConeGeometry(0.33 * s, 0.38 * s, 16, 2, true), M.thatch(), 0, 0.1 + 0.4 * s + 0.17 * s, 0);
    o.add(roof);
    return o;
  };
  if (tier >= 2) {
    const a = make(0.8);
    a.position.set(-0.15, 0, -0.15);
    const b = make(0.65);
    b.position.set(0.22, 0, 0.2);
    g.add(a, b);
  } else g.add(make(1));
  return g;
}

function watchtower(tier: number) {
  const g = new THREE.Group();
  g.add(pad(1));
  const h = 1.0 + tier * 0.15;
  for (const [x, z] of [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25],
  ]) {
    const p = mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 6), M.darkWood(), x * 0.9, h / 2, z * 0.9);
    p.rotation.set(z * 0.08, 0, -x * 0.08);
    g.add(p);
  }
  for (const y of [0.3, 0.65]) {
    for (const r of [0, Math.PI / 2]) {
      const brace = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.68, 4), M.wood(), 0, y * h, 0);
      brace.rotation.set(0, r, Math.PI / 2 - 0.5);
      g.add(brace);
    }
  }
  g.add(mesh(new THREE.BoxGeometry(0.66, 0.06, 0.66), M.wood(), 0, h, 0));
  for (let i = 0; i < 4; i++) {
    const rail = mesh(new THREE.BoxGeometry(0.64, 0.12, 0.03), M.darkWood(), 0, h + 0.1, 0.31);
    rail.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), (i * Math.PI) / 2);
    rail.rotation.y = (i * Math.PI) / 2;
    g.add(rail);
  }
  for (const [x, z] of [
    [-0.28, -0.28],
    [0.28, -0.28],
    [-0.28, 0.28],
    [0.28, 0.28],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 5), M.darkWood(), x, h + 0.18, z));
  g.add(mesh(new THREE.ConeGeometry(0.5, 0.42, 16, 2, true), M.thatch(), 0, h + 0.55, 0));
  if (tier >= 1) {
    const flag = mesh(new THREE.PlaneGeometry(0.2, 0.12), std(tier >= 2 ? 'flagB' : 'flagR', () => ({ color: tier >= 2 ? '#2d5fa6' : '#c23b22', side: THREE.DoubleSide })), 0.1, h + 0.92, 0);
    g.add(flag);
    g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), M.darkWood(), 0, h + 0.85, 0));
  }
  return g;
}

function maize(tier: number) {
  const g = new THREE.Group();
  const soil = mesh(new THREE.BoxGeometry(1.85, 0.06, 1.85), std('soil', () => ({ color: '#6e4a2c' })), 0, 0.03, 0);
  soil.castShadow = false;
  g.add(soil);
  // Furrows.
  for (let i = 0; i < 7; i++) {
    const f = mesh(new THREE.BoxGeometry(1.75, 0.04, 0.08), std('furrow', () => ({ color: '#8a5e38' })), 0, 0.07, -0.78 + i * 0.26);
    f.castShadow = false;
    g.add(f);
  }
  // Maize plants, instanced.
  const h = [0.28, 0.42, 0.5][tier];
  const stalk = new THREE.CylinderGeometry(0.012, 0.018, h, 4);
  stalk.translate(0, h / 2, 0);
  const leaf = new THREE.BoxGeometry(0.2, 0.01, 0.05);
  leaf.translate(0.08, h * 0.55, 0);
  const tassel = new THREE.ConeGeometry(0.025, 0.08, 4);
  tassel.translate(0, h + 0.04, 0);
  const count = 7 * 7;
  const parts: [THREE.BufferGeometry, THREE.Material][] = [
    [stalk, std('stalk', () => ({ color: '#7f9a34' }))],
    [leaf, std('mleaf', () => ({ color: '#6e9a2e' }))],
    [tassel, std('tassel', () => ({ color: '#e0c060' }))],
  ];
  for (const [geo, mat] of parts) {
    const im = new THREE.InstancedMesh(geo, mat, count);
    const m4 = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < 7; i++)
      for (let j = 0; j < 7; j++) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i * 7 + j) * 2.4, 0));
        m4.compose(new THREE.Vector3(-0.78 + j * 0.26 + ((i * 13) % 5) * 0.01, 0.06, -0.78 + i * 0.26), q, new THREE.Vector3(1, 0.85 + ((i + j) % 3) * 0.1, 1));
        im.setMatrixAt(k++, m4);
      }
    im.castShadow = true;
    im.receiveShadow = true;
    g.add(im);
  }
  return g;
}

function shield(color: string) {
  const s = mesh(new THREE.SphereGeometry(0.12, 10, 8), std(`shield${color}`, () => ({ color })), 0, 0.16, 0);
  s.scale.set(0.15, 1.3, 0.6);
  return s;
}

function lodge(tier: number) {
  const g = new THREE.Group();
  g.add(pad(2));
  const h = roundHut(0.48, 0.5, tier ? M.wallPaint() : M.wallOchre());
  h.position.set(-0.25, 0.04, -0.25);
  g.add(h);
  [
    ['#efe6d2', 0.5, 0.3],
    ['#5a3420', 0.65, 0.05],
    ['#efe6d2', 0.25, 0.6],
  ].forEach(([c, x, z]) => {
    const s = shield(c as string);
    s.position.set(x as number, 0, z as number);
    s.rotation.y = -FRONT;
    g.add(s);
  });
  for (let i = 0; i < 4; i++) {
    const sp = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 4), M.darkWood(), 0.6 + i * 0.05, 0.37, -0.45 + i * 0.05);
    sp.rotation.z = 0.12;
    g.add(sp);
    g.add(mesh(new THREE.ConeGeometry(0.025, 0.1, 4), std('blade', () => ({ color: '#cfd4d9', metalness: 0.6, roughness: 0.35 })), 0.6 + i * 0.05 - 0.045, 0.78, -0.45 + i * 0.05));
  }
  return g;
}

/** Umbrella thorn acacia: forked trunk with flat, layered canopies. */
export function acacia(s = 1, seed = 1) {
  const g = new THREE.Group();
  const trunkMat = std('acaciaBark', () => ({ color: '#5e4636' }));
  const h = 0.75 * s;
  g.add(mesh(new THREE.CylinderGeometry(0.035 * s, 0.06 * s, h * 0.55, 6), trunkMat, 0, h * 0.27, 0));
  const crowns: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = seed * 1.3 + (i / 3) * Math.PI * 2;
    const lean = 0.5 + (i % 2) * 0.15;
    const len = h * (0.55 + ((seed + i) % 3) * 0.08);
    const br = mesh(new THREE.CylinderGeometry(0.02 * s, 0.035 * s, len, 5), trunkMat);
    const dx = Math.cos(a) * Math.sin(lean) * len;
    const dz = Math.sin(a) * Math.sin(lean) * len;
    br.position.set(dx / 2, h * 0.5 + (Math.cos(lean) * len) / 2, dz / 2);
    br.lookAt(new THREE.Vector3(dx, h * 0.5 + Math.cos(lean) * len, dz).add(g.position));
    br.rotateX(Math.PI / 2);
    g.add(br);
    crowns.push([dx, h * 0.5 + Math.cos(lean) * len, dz]);
  }
  const leafA = std('acaciaLeaf', () => ({ color: '#6f8a2e', flatShading: true }));
  const leafB = std('acaciaLeaf2', () => ({ color: '#8a9a38', flatShading: true }));
  crowns.forEach(([x, y, z], i) => {
    const disc = mesh(new THREE.CylinderGeometry(0.42 * s, 0.32 * s, 0.1 * s, 9), i % 2 ? leafA : leafB, x * 1.1, y + 0.02, z * 1.1);
    disc.rotation.y = i;
    g.add(disc);
    const top = mesh(new THREE.CylinderGeometry(0.3 * s, 0.38 * s, 0.07 * s, 9), i % 2 ? leafB : leafA, x * 1.1, y + 0.1 * s, z * 1.1);
    g.add(top);
  });
  return g;
}

export function baobab(s = 1) {
  const g = new THREE.Group();
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const r = 0.36 - 0.14 * t + Math.sin(t * Math.PI) * 0.08;
    pts.push(new THREE.Vector2(r * s, t * 1.25 * s));
  }
  g.add(mesh(new THREE.LatheGeometry(pts, 16), M.bark()));
  const top = 1.22 * s;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const len = (0.38 + (i % 3) * 0.08) * s;
    const br = mesh(new THREE.CylinderGeometry(0.035 * s, 0.07 * s, len, 6), M.bark());
    br.position.set(Math.cos(a) * len * 0.35, top + len * 0.3, Math.sin(a) * len * 0.35);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(br);
    const leaves = mesh(new THREE.IcosahedronGeometry(0.17 * s, 0), i % 2 ? M.leaf() : M.leafDark());
    leaves.position.set(Math.cos(a) * len * 0.75, top + len * 0.62, Math.sin(a) * len * 0.75);
    leaves.scale.y = 0.7;
    g.add(leaves);
  }
  return g;
}

function drum() {
  const pts = [
    new THREE.Vector2(0.06, 0),
    new THREE.Vector2(0.04, 0.07),
    new THREE.Vector2(0.05, 0.11),
    new THREE.Vector2(0.09, 0.2),
    new THREE.Vector2(0.09, 0.21),
  ];
  const g = new THREE.Group();
  g.add(mesh(new THREE.LatheGeometry(pts, 12), M.wood()));
  const head = mesh(new THREE.CircleGeometry(0.09, 12), M.hide(), 0, 0.212, 0);
  head.rotation.x = -Math.PI / 2;
  g.add(head);
  return g;
}

function griot() {
  const g = new THREE.Group();
  g.add(pad(2, '#b8996a'));
  const tree = baobab(1.15);
  tree.position.set(-0.2, 0, -0.2);
  g.add(tree);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const b = boulder(0.07);
    b.position.set(Math.cos(a) * 0.72, 0.05, Math.sin(a) * 0.72);
    g.add(b);
  }
  const d1 = drum();
  d1.position.set(0.45, 0.04, 0.3);
  const d2 = drum();
  d2.position.set(0.3, 0.04, 0.5);
  d2.scale.setScalar(0.8);
  g.add(d1, d2);
  return g;
}

function smelter() {
  const g = new THREE.Group();
  g.add(pad(2, '#9c7a56'));
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.4 - 0.26 * t + Math.sin(t * 3) * 0.02, t * 1.15));
  }
  const furnace = mesh(new THREE.LatheGeometry(pts, 16), std('furnace', () => ({ map: mudTexture('#a14e2a') })));
  furnace.position.set(-0.15, 0.04, -0.15);
  g.add(furnace);
  const glow = mesh(new THREE.CircleGeometry(0.13, 12), std('molten', () => ({ color: '#ff8a2a', emissive: '#ff6a10', emissiveIntensity: 2 })), -0.15, 1.2, -0.15);
  glow.rotation.x = -Math.PI / 2;
  glow.name = 'glow';
  g.add(glow);
  const tap = mesh(new THREE.SphereGeometry(0.08, 8, 6), std('molten', () => ({})), -0.15 + 0.28, 0.12, -0.15 + 0.28);
  g.add(tap);
  for (const [x, z] of [
    [0.5, -0.1],
    [0.35, 0.2],
  ]) {
    const b = mesh(new THREE.SphereGeometry(0.12, 8, 6), std('bellows', () => ({ color: '#7a5232' })), x, 0.1, z);
    b.scale.y = 0.6;
    g.add(b);
  }
  const ore = model('Iron_Bars_Stack_Small');
  ore.scale.setScalar(0.32);
  ore.position.set(0.5, 0.04, 0.55);
  g.add(ore);
  return g;
}

function kraal() {
  const g = new THREE.Group();
  const ground = mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.04, 24), std('kraalGround', () => ({ color: '#8f6d44' })), 0, 0.02, 0);
  ground.castShadow = false;
  g.add(ground);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    if (Math.abs(a - FRONT) < 0.25) continue;
    const s = stake(0.28 + (i % 3) * 0.03, 0.025);
    s.position.set(Math.cos(a) * 0.86, 0, Math.sin(a) * 0.86);
    g.add(s);
  }
  const c1 = cow(false);
  c1.position.set(-0.25, 0.02, -0.1);
  c1.rotation.y = 0.6;
  const c2 = cow(true);
  c2.position.set(0.25, 0.02, 0.2);
  c2.rotation.y = 2.4;
  g.add(c1, c2);
  return g;
}

function goldmine() {
  const g = new THREE.Group();
  g.add(pad(2, '#a3906a'));
  const mound = tinted('Rock_1_A', '#d8c8b0');
  mound.scale.setScalar(0.5);
  mound.position.set(-0.35, 0, -0.35);
  g.add(mound);
  const frame = new THREE.Group();
  frame.add(mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), M.darkWood(), -0.18, 0.22, 0));
  frame.add(mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06), M.darkWood(), 0.18, 0.22, 0));
  frame.add(mesh(new THREE.BoxGeometry(0.46, 0.06, 0.08), M.darkWood(), 0, 0.46, 0));
  frame.add(mesh(new THREE.BoxGeometry(0.3, 0.4, 0.04), M.dark(), 0, 0.2, -0.03));
  frame.position.set(0.05, 0.04, 0.05);
  frame.rotation.y = FRONT;
  g.add(frame);
  const gold = model('Gold_Nuggets');
  gold.scale.setScalar(0.4);
  gold.position.set(0.5, 0.04, 0.45);
  g.add(gold);
  return g;
}

export function scaffold(n: number) {
  const g = new THREE.Group();
  g.add(pad(n));
  const e = n * 0.36;
  const h = 0.5 + n * 0.25;
  for (const [x, z] of [
    [-e, -e],
    [e, -e],
    [-e, e],
    [e, e],
  ])
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 5), M.wood(), x, h / 2, z));
  for (const y of [h * 0.45, h * 0.9])
    for (const [x, z, r] of [
      [0, -e, 0],
      [0, e, 0],
      [-e, 0, Math.PI / 2],
      [e, 0, Math.PI / 2],
    ]) {
      const b = mesh(new THREE.BoxGeometry(e * 2, 0.03, 0.03), M.wood(), x, y, z);
      b.rotation.y = r;
      g.add(b);
    }
  const planks = model('Wood_Planks_Stack_Small');
  planks.scale.setScalar(0.25);
  planks.position.set(e * 0.7, 0.03, -e * 0.2);
  g.add(planks);
  return g;
}

const BUILDERS: Record<string, (tier: number) => THREE.Group> = {
  hearth,
  hut,
  forager,
  well,
  woodcutter,
  quarry,
  granary,
  watchtower,
  maize,
  lodge,
  griot,
  smelter,
  kraal,
  goldmine,
};

export function buildingModel(type: string, tier: number): THREE.Group {
  const g = BUILDERS[type](tier);
  g.name = type;
  return g;
}
