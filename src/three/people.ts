import * as THREE from 'three';
import { clips, mannequin } from './assets';

/**
 * Villagers, guards, raiders and heroes are the KayKit mannequin (CC0) with
 * a recoloured skin and clothing built from simple shapes attached to its bones.
 */
export type Hair = 'short' | 'bald' | 'headwrap' | 'braids' | 'plume' | 'crown' | 'turban' | 'mask' | 'lionmane' | 'nemes';
export type Tool = 'none' | 'axe' | 'hoe' | 'spear' | 'bow' | 'basket' | 'pick' | 'hammer' | 'staff' | 'club' | 'sling';

export interface Outfit {
  skin: string;
  wrap: string;
  wrap2?: string;
  top?: string;
  hair: Hair;
  hairColor?: string;
  tool?: Tool;
  shield?: boolean;
  cape?: string;
  accent?: string;
}

const skinMats = new Map<string, THREE.MeshStandardMaterial>();
function skinMaterial(skin: string) {
  if (!skinMats.has(skin)) skinMats.set(skin, new THREE.MeshStandardMaterial({ color: skin, roughness: 0.62 }));
  return skinMats.get(skin)!;
}

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.85) {
  const k = `${color}${rough}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: rough }));
  return matCache.get(k)!;
}

function part(geo: THREE.BufferGeometry, m: THREE.Material) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  return mesh;
}

/** Striped cloth texture (kente-like) for wraps. */
const clothTextures = new Map<string, THREE.Texture>();
function clothTexture(a: string, b: string) {
  const k = a + b;
  if (clothTextures.has(k)) return clothTextures.get(k)!;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = b;
  for (let y = 6; y < 64; y += 16) ctx.fillRect(0, y, 64, 5);
  for (let x = 4; x < 64; x += 16) {
    ctx.fillRect(x, 0, 3, 64);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  for (let y = 0; y < 64; y += 4) ctx.fillRect(0, y, 64, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  clothTextures.set(k, t);
  return t;
}

function wrapMat(a: string, b?: string) {
  const k = `wrap${a}${b}`;
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ map: b ? clothTexture(a, b) : null, color: b ? '#ffffff' : a, roughness: 0.9, side: THREE.DoubleSide }));
  return matCache.get(k)!;
}

interface Frame {
  bones: Record<string, THREE.Bone>;
  pos: Record<string, THREE.Vector3>;
  headR: number;
  /** Head centre and half extents (the chibi head is a tall egg). */
  headC: THREE.Vector3;
  headScale: THREE.Vector3;
  bodyR: number;
  bodyBox: THREE.Box3;
  height: number;
}

function measure(o: THREE.Object3D): Frame {
  o.updateMatrixWorld(true);
  const bones: Record<string, THREE.Bone> = {};
  const pos: Record<string, THREE.Vector3> = {};
  o.traverse((c) => {
    if ((c as THREE.Bone).isBone) {
      // GLTFLoader strips dots from node names ("upperleg.l" -> "upperlegl").
      const name = c.name.replace(/\.(l|r)$/, '$1').replace(/\./g, '');
      bones[name] = c as THREE.Bone;
      pos[name] = c.getWorldPosition(new THREE.Vector3());
    }
  });
  const box = new THREE.Box3().setFromObject(o);
  const height = box.max.y - box.min.y;
  const head = o.getObjectByName('Mannequin_Medium_Head') as THREE.Mesh | undefined;
  const hb = head ? new THREE.Box3().setFromObject(head) : new THREE.Box3(new THREE.Vector3(-0.4, 1.1, -0.45), new THREE.Vector3(0.4, 2.2, 0.5));
  const headR = (hb.max.x - hb.min.x) / 2;
  const headC = hb.getCenter(new THREE.Vector3());
  const hs = hb.getSize(new THREE.Vector3()).multiplyScalar(0.5);
  const headScale = new THREE.Vector3(1, hs.y / headR, hs.z / headR).multiplyScalar(1.04);
  const body = o.getObjectByName('Mannequin_Medium_Body') as THREE.Mesh | undefined;
  const bodyBox = body ? new THREE.Box3().setFromObject(body) : new THREE.Box3(new THREE.Vector3(-0.37, 0.38, -0.26), new THREE.Vector3(0.37, 1.24, 0.28));
  const bodyR = (bodyBox.max.x - bodyBox.min.x) / 2;
  return { bones, pos, headR, headC, headScale, bodyR, bodyBox, height };
}

function attach(f: Frame, bone: string, obj: THREE.Object3D, world: THREE.Vector3) {
  obj.position.copy(world);
  obj.updateMatrixWorld(true);
  f.bones[bone].attach(obj);
}

function headTop(f: Frame) {
  return f.pos.head.clone().add(new THREE.Vector3(0, f.headR * 1.0, 0));
}

function dressHead(f: Frame, o: Outfit) {
  const r = f.headR;
  const hc = o.hairColor ?? '#2a1810';
  const center = f.headC.clone();
  const g = new THREE.Group();
  // Everything is modelled on a sphere of radius r, then stretched to the egg-shaped head.
  g.scale.copy(f.headScale);
  // In this local space the head is roughly a rounded cylinder of radius ~r spanning y in [-r, r].
  const cap = (m: THREE.Material, from = 0.22, to = 1.0, rad = 1.04) => {
    const shell = part(new THREE.CylinderGeometry(r * rad, r * rad * 1.01, r * (to - from), 20, 1, true), m);
    shell.position.y = r * (from + to) / 2;
    g.add(shell);
    const lid = part(new THREE.SphereGeometry(r * rad, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), m);
    lid.scale.y = 0.35;
    lid.position.y = r * to;
    g.add(lid);
  };
  const hairMat = mat(hc, 1);
  switch (o.hair) {
    case 'short':
      cap(hairMat, 0.45, 0.85);
      break;
    case 'braids': {
      cap(hairMat, 0.25);
      for (let i = 0; i < 10; i++) {
        const a = Math.PI * 0.62 + (i / 9) * Math.PI * 1.76;
        const br = part(new THREE.CylinderGeometry(r * 0.08, r * 0.06, r * 1.1, 5), hairMat);
        br.position.set(Math.cos(a) * r * 1.03, -r * 0.25, Math.sin(a) * r * 1.03);
        g.add(br);
        const bead = part(new THREE.SphereGeometry(r * 0.09, 6, 4), mat(i % 2 ? '#e8b83a' : '#c23b22'));
        bead.position.set(Math.cos(a) * r * 1.03, -r * 0.82, Math.sin(a) * r * 1.03);
        g.add(bead);
      }
      break;
    }
    case 'headwrap': {
      const wm = wrapMat(o.wrap2 ?? o.wrap, o.accent);
      const shell = part(new THREE.CylinderGeometry(r * 1.08, r * 1.06, r * 0.7, 20, 1, true), wm);
      shell.position.y = r * 0.68;
      g.add(shell);
      const dome = part(new THREE.SphereGeometry(r * 1.08, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), wm);
      dome.scale.y = 0.55;
      dome.position.y = r * 1.03;
      g.add(dome);
      const knot = part(new THREE.SphereGeometry(r * 0.32, 10, 8), wm);
      knot.position.set(0, r * 1.5, r * 0.25);
      knot.scale.set(1.4, 0.75, 1);
      g.add(knot);
      break;
    }
    case 'turban': {
      const tm = mat(o.wrap2 ?? '#f4f1e8');
      const sh = part(new THREE.CylinderGeometry(r * 1.15, r * 1.08, r * 0.9, 20), tm);
      sh.position.y = r * 0.75;
      g.add(sh);
      for (let i = 0; i < 2; i++) {
        const ring = part(new THREE.TorusGeometry(r * 1.1, r * 0.16, 8, 20), tm);
        ring.rotation.x = Math.PI / 2 + (i ? 0.2 : -0.15);
        ring.position.y = r * (0.55 + i * 0.4);
        g.add(ring);
      }
      if (o.accent) {
        const gem = part(new THREE.SphereGeometry(r * 0.16, 8, 6), new THREE.MeshStandardMaterial({ color: o.accent, metalness: 0.5, roughness: 0.3 }));
        gem.position.set(0, r * 0.85, r * 1.2);
        g.add(gem);
      }
      break;
    }
    case 'plume':
      cap(hairMat, 0.35);
      for (let i = 0; i < 3; i++) {
        const fe = part(new THREE.ConeGeometry(r * 0.14, r * 1.3, 5), mat(i === 1 ? '#c23b22' : '#f4f1e8'));
        fe.position.set((i - 1) * r * 0.3, r * 1.65, -r * 0.3);
        fe.rotation.z = (i - 1) * -0.35;
        g.add(fe);
      }
      break;
    case 'crown': {
      cap(hairMat, 0.3);
      const gold = new THREE.MeshStandardMaterial({ color: o.accent ?? '#e0b84a', metalness: 0.75, roughness: 0.3, side: THREE.DoubleSide });
      const band = part(new THREE.CylinderGeometry(r * 0.95, r * 0.9, r * 0.45, 8, 1, true), gold);
      band.position.y = r * 1.28;
      g.add(band);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = part(new THREE.ConeGeometry(r * 0.12, r * 0.3, 4), gold);
        spike.position.set(Math.cos(a) * r * 0.92, r * 1.62, Math.sin(a) * r * 0.92);
        g.add(spike);
      }
      break;
    }
    case 'mask': {
      cap(mat('#3a2a3e'), 0.25, 1.0, 1.06);
      const band = part(new THREE.CylinderGeometry(r * 1.07, r * 1.07, r * 0.45, 20, 1, true), mat('#8c1c1c'));
      band.position.y = -r * 0.45;
      g.add(band);
      break;
    }
    case 'lionmane': {
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const tuft = part(new THREE.SphereGeometry(r * 0.36, 6, 5), mat(i % 2 ? '#c88a2e' : '#a86a1e'));
        tuft.position.set(Math.cos(a) * r * 1.08, -r * 0.1 + Math.sin(i * 2.3) * r * 0.35, Math.sin(a) * r * 1.0);
        if (Math.sin(a) > 0.55) tuft.position.y = r * 0.95; // keep the face clear
        g.add(tuft);
      }
      cap(mat('#d49a3e'), 0.45);
      break;
    }
    case 'nemes': {
      const nm = wrapMat('#e8d8a8', o.accent ?? '#2a5c9a');
      cap(nm, 0.15, 1.05, 1.1);
      for (const sx of [-1, 1]) {
        const lap = part(new THREE.BoxGeometry(r * 0.35, r * 1.3, r * 0.15), nm);
        lap.position.set(sx * r * 0.95, -r * 0.45, r * 0.55);
        g.add(lap);
      }
      break;
    }
    case 'bald':
      break;
  }
  // Face: two dark eyes with a catch-light, slightly in front of the head centre.
  const eyeMat = mat('#1a0e08', 0.3);
  for (const sx of [-1, 1]) {
    const eye = part(new THREE.SphereGeometry(r * 0.13, 8, 6), eyeMat);
    eye.scale.set(0.8, 1.25, 0.5);
    eye.position.set(sx * r * 0.36, -r * 0.05, r * 0.99);
    g.add(eye);
    const glint = part(new THREE.SphereGeometry(r * 0.04, 6, 4), mat('#ffffff', 0.2));
    glint.position.set(sx * r * 0.36 + r * 0.03, r * 0.02, r * 1.04);
    g.add(glint);
  }
  attach(f, 'head', g, center);
  void headTop;
}

function dressBody(f: Frame, o: Outfit) {
  const bb = f.bodyBox;
  const bh = bb.max.y - bb.min.y;
  const rx = f.bodyR;
  const depth = (bb.max.z - bb.min.z) / 2 / rx;
  // Wrap skirt from the waist to just above the feet.
  const top = bb.min.y + bh * 0.42;
  const bottom = Math.max(0.12 * f.height * 0.5, bb.min.y - bh * 0.25);
  const skirtH = top - bottom;
  const skirt = part(new THREE.CylinderGeometry(rx * 1.03, rx * 1.16, skirtH, 18, 1, true), wrapMat(o.wrap, o.wrap2));
  skirt.scale.z = depth;
  attach(f, 'hips', skirt, new THREE.Vector3(0, bottom + skirtH / 2, (bb.max.z + bb.min.z) / 2));
  const waist = part(new THREE.TorusGeometry(rx * 1.04, rx * 0.07, 6, 18), wrapMat(o.wrap2 ?? o.wrap));
  waist.rotation.x = Math.PI / 2;
  waist.scale.y = depth;
  attach(f, 'hips', waist, new THREE.Vector3(0, top, (bb.max.z + bb.min.z) / 2));
  if (o.top) {
    const t0 = bb.min.y + bh * 0.48;
    const t1 = bb.max.y - bh * 0.06;
    const t = part(new THREE.CylinderGeometry(rx * 1.02, rx * 1.06, t1 - t0, 18, 1, true), wrapMat(o.top, o.accent));
    t.scale.z = depth;
    attach(f, 'chest', t, new THREE.Vector3(0, (t0 + t1) / 2, (bb.max.z + bb.min.z) / 2));
  } else {
    // A sash over one shoulder.
    const sash = part(new THREE.TorusGeometry(rx * 0.98, rx * 0.1, 6, 18), wrapMat(o.wrap2 ?? o.wrap));
    sash.rotation.set(0.1, Math.PI / 2, 0.7);
    sash.scale.set(1, 1.25, depth);
    attach(f, 'chest', sash, new THREE.Vector3(0, bb.min.y + bh * 0.68, 0));
  }
  if (o.cape) {
    const cape = part(new THREE.PlaneGeometry(rx * 2, bh * 0.85), new THREE.MeshStandardMaterial({ color: o.cape, side: THREE.DoubleSide, roughness: 0.8 }));
    attach(f, 'chest', cape, new THREE.Vector3(0, bb.min.y + bh * 0.5, bb.min.z - 0.03));
  }
}

function makeTool(t: Tool, s: number): THREE.Object3D | null {
  const wood = mat('#6b4220');
  const metal = new THREE.MeshStandardMaterial({ color: '#c9cdd2', metalness: 0.6, roughness: 0.4 });
  const g = new THREE.Group();
  switch (t) {
    case 'spear': {
      const shaft = part(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 2.2, 5), wood);
      g.add(shaft);
      const tip = part(new THREE.ConeGeometry(s * 0.08, s * 0.35, 5), metal);
      tip.position.y = s * 1.25;
      g.add(tip);
      break;
    }
    case 'axe':
    case 'pick':
    case 'hammer':
    case 'hoe':
    case 'club': {
      g.add(part(new THREE.CylinderGeometry(s * 0.035, s * 0.035, s * 1.0, 5), wood));
      if (t === 'club') {
        const k = part(new THREE.SphereGeometry(s * 0.14, 7, 6), wood);
        k.position.y = s * 0.5;
        g.add(k);
      } else {
        const head = part(new THREE.BoxGeometry(t === 'pick' ? s * 0.5 : s * 0.12, s * 0.12, t === 'axe' ? s * 0.3 : s * 0.12), metal);
        head.position.set(0, s * 0.45, t === 'axe' ? s * 0.1 : 0);
        g.add(head);
      }
      break;
    }
    case 'staff': {
      g.add(part(new THREE.CylinderGeometry(s * 0.035, s * 0.04, s * 2.0, 5), wood));
      const k = part(new THREE.SphereGeometry(s * 0.1, 8, 6), new THREE.MeshStandardMaterial({ color: '#e0b84a', metalness: 0.7, roughness: 0.3 }));
      k.position.y = s * 1.0;
      g.add(k);
      break;
    }
    case 'bow': {
      const bow = part(new THREE.TorusGeometry(s * 0.6, s * 0.03, 5, 16, Math.PI * 0.9), wood);
      bow.rotation.z = Math.PI / 2 + 0.15;
      g.add(bow);
      break;
    }
    case 'basket': {
      const b = part(new THREE.CylinderGeometry(s * 0.3, s * 0.22, s * 0.25, 10), mat('#b98a45'));
      g.add(b);
      break;
    }
    case 'sling':
    case 'none':
      return null;
  }
  return g;
}

export class Person {
  obj: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  current = '';

  constructor(outfit: Outfit, scale = 0.42) {
    const o = mannequin();
    o.traverse((c) => {
      const m = c as THREE.SkinnedMesh;
      if (m.isMesh) m.material = skinMaterial(outfit.skin);
    });
    const f = measure(o);
    dressBody(f, outfit);
    dressHead(f, outfit);
    const tool = makeTool(outfit.tool ?? 'none', f.height * 0.28);
    if (tool) {
      const hand = f.pos['handr'];
      tool.traverse((c) => ((c as THREE.Mesh).castShadow = true));
      attach(f, 'handr', tool, hand.clone());
    }
    if (outfit.shield) {
      const sh = part(new THREE.SphereGeometry(f.height * 0.18, 10, 8), mat('#efe6d2'));
      sh.scale.set(0.15, 1.3, 0.65);
      attach(f, 'lowerarml', sh, f.pos['handl'].clone().add(new THREE.Vector3(f.bodyR * 0.3, 0, 0)));
    }
    o.scale.setScalar(scale / f.height);
    const holder = new THREE.Group();
    holder.add(o);
    this.obj = holder;
    this.mixer = new THREE.AnimationMixer(o);
  }

  play(name: string, fade = 0.25, once = false) {
    if (this.current === name) return;
    let a = this.actions.get(name);
    if (!a) {
      const clip = clips.get(name);
      if (!clip) return;
      a = this.mixer.clipAction(clip);
      this.actions.set(name, a);
    }
    a.reset();
    if (once) {
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
    }
    a.play();
    const prev = this.actions.get(this.current);
    if (prev) prev.crossFadeTo(a, fade, false);
    this.current = name;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }
}
