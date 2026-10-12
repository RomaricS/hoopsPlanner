import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { fbm, hash2 } from '../sim/rng';
import { MAP_SIZE, Tile, type GameState, type NodeState } from '../sim/state';
import { model, tinted, type NatureId } from './assets';
import { Person, type Outfit } from './people';
import { acacia, buildingModel, baobab, scaffold } from './models';
import { compoundModel } from './compounds';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { glowTexture, groundDetailTexture, shadowBlobTexture } from './textures';

/** Tile (x, y) covers world [x, x+1] x [y, y+1] on the XZ plane. */
export function tileCenter(x: number, y: number) {
  return new THREE.Vector3(x + 0.5, 0, y + 0.5);
}

/** Savanna palette (sRGB hex), converted to linear for vertex colours. */
const TILE_HEX: Record<number, string> = {
  [Tile.Grass]: '#7fb04a',
  [Tile.DryGrass]: '#9db450',
  [Tile.Dirt]: '#d6ae74',
  [Tile.Sand]: '#e2c78e',
  [Tile.Water]: '#6f8a54',
};
const TILE_RGB: Record<number, [number, number, number]> = Object.fromEntries(
  Object.entries(TILE_HEX).map(([k, v]) => {
    const c = new THREE.Color(v);
    return [k, [c.r, c.g, c.b]];
  }),
) as Record<number, [number, number, number]>;

interface Walker {
  /** Workers stay at their station instead of wandering. */
  fixed?: boolean;
  person: Person;
  obj: THREE.Object3D;
  work: string;
  pos: THREE.Vector3;
  dest: THREE.Vector3 | null;
  wait: number;
  home: THREE.Vector3;
  radius: number;
  speed: number;
}

/** Keyframes of the day: phase → sun elevation, light colours and intensities. */
const DAY_KEYS = [
  { p: 0.0, sun: 0x8a6a9a, sunI: 0.4, sky: 0x8090c0, ground: 0x403040, hemiI: 0.6, elev: 6, bg: 0x2a2440 },
  { p: 0.07, sun: 0xffb070, sunI: 1.6, sky: 0xffd0a0, ground: 0x6a4a30, hemiI: 0.9, elev: 18, bg: 0x6a4a40 },
  { p: 0.3, sun: 0xfff2dc, sunI: 2.6, sky: 0xcfe4ff, ground: 0x8a6a40, hemiI: 1.1, elev: 55, bg: 0x3a2a1c },
  { p: 0.6, sun: 0xfff0d0, sunI: 2.4, sky: 0xd8e4ff, ground: 0x8a6a40, hemiI: 1.05, elev: 45, bg: 0x3a2a1c },
  { p: 0.7, sun: 0xff9a50, sunI: 1.6, sky: 0xffb080, ground: 0x6a4030, hemiI: 0.8, elev: 14, bg: 0x4a2a20 },
  { p: 0.76, sun: 0x8090d0, sunI: 0.75, sky: 0x5a6aa0, ground: 0x2a2438, hemiI: 0.7, elev: 35, bg: 0x141020 },
  { p: 0.94, sun: 0x8090d0, sunI: 0.7, sky: 0x55659a, ground: 0x2a2438, hemiI: 0.65, elev: 40, bg: 0x141020 },
  { p: 1.0, sun: 0x8a6a9a, sunI: 0.4, sky: 0x8090c0, ground: 0x403040, hemiI: 0.6, elev: 6, bg: 0x2a2440 },
];

export class World3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  target = new THREE.Vector3(24, 0, 24);
  zoom = 1;
  private sun = new THREE.DirectionalLight(0xffffff, 2.5);
  private hemi = new THREE.HemisphereLight(0xcfe4ff, 0x8a6a40, 1.1);
  private fires: { light: THREE.PointLight; flames: THREE.Mesh[]; glow: THREE.Sprite; base: THREE.Vector3 }[] = [];
  private glows: THREE.Mesh[] = [];
  private walkers: Walker[] = [];
  private last = performance.now();
  private elapsed = 0;
  private water!: THREE.Mesh;
  private outline: OutlineEffect;
  toon = true;
  private viewH = 14;
  phase = 0.3;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.outline = new OutlineEffect(this.renderer, { defaultThickness: 0.0035, defaultColor: [0.12, 0.07, 0.04] });

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.scene.add(this.hemi);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.setupControls();
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    const vh = this.viewH / this.zoom;
    this.camera.left = (-vh * aspect) / 2;
    this.camera.right = (vh * aspect) / 2;
    this.camera.top = vh / 2;
    this.camera.bottom = -vh / 2;
    this.camera.updateProjectionMatrix();
  }

  private placeCamera() {
    // Classic isometric-ish view: 45° around, ~35° down, like Clash of Clans.
    const d = 40;
    const elev = THREE.MathUtils.degToRad(38);
    this.camera.position.set(this.target.x + Math.cos(elev) * d * Math.SQRT1_2, Math.sin(elev) * d, this.target.z + Math.cos(elev) * d * Math.SQRT1_2);
    this.camera.lookAt(this.target);
    // Shadow frustum follows what is on screen.
    const s = (this.viewH / this.zoom) * 1.1;
    const cam = this.sun.shadow.camera;
    cam.left = -s;
    cam.right = s;
    cam.top = s;
    cam.bottom = -s;
    cam.near = 1;
    cam.far = 80;
    cam.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ terrain

  buildTerrain(state: GameState) {
    const N = MAP_SIZE;
    const res = 5; // vertices per tile edge
    const seg = N * res;
    const geo = new THREE.PlaneGeometry(N, N, seg, seg);
    geo.rotateX(-Math.PI / 2);
    geo.translate(N / 2, 0, N / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const raw = (x: number, y: number) => state.terrain[Math.max(0, Math.min(N - 1, y)) * N + Math.max(0, Math.min(N - 1, x))];
    // Inside the village plan: green plots and dirt roads, like a tended settlement.
    const tileAt = (x: number, y: number) => {
      const t = raw(x, y);
      if (t === Tile.Water || t === Tile.Sand) return t;
      if (Math.max(Math.abs(x - 24), Math.abs(y - 24)) <= 11) return Tile.Grass;
      return t;
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Bilinear blend of the four nearest tile centres for soft transitions.
      const fx = x - 0.5;
      const fz = z - 0.5;
      const x0 = Math.floor(fx);
      const z0 = Math.floor(fz);
      // Sharpened blend: crisp road edges, still soft at the very border.
      const sharpen = (t: number) => THREE.MathUtils.smoothstep(t, 0.3, 0.7);
      const tx = sharpen(fx - x0);
      const tz = sharpen(fz - z0);
      let r = 0;
      let g = 0;
      let b = 0;
      let water = 0;
      let w = 0;
      for (const [dx, dz, wt] of [
        [0, 0, (1 - tx) * (1 - tz)],
        [1, 0, tx * (1 - tz)],
        [0, 1, (1 - tx) * tz],
        [1, 1, tx * tz],
      ] as const) {
        const t = tileAt(x0 + dx, z0 + dz);
        const c = TILE_RGB[t];
        r += c[0] * wt;
        g += c[1] * wt;
        b += c[2] * wt;
        w += wt;
        if (t === Tile.Water) water += wt;
      }
      // Large soft patches of greener and drier grass, independent of the tile grid.
      const patch = fbm(x * 0.07, z * 0.07, state.seed + 21, 3) - 0.5;
      const n = fbm(x * 0.25, z * 0.25, state.seed + 3, 2) - 0.5;
      const v = 1 + n * 0.16 + (hash2(Math.floor(x * 4), Math.floor(z * 4), 5) - 0.5) * 0.04;
      // Narrow dirt paths along the centre of the road grid.
      const roadDist = (c: number) => {
        const u = ((((c - 25.5) % 3) + 3) % 3);
        return Math.min(u, 3 - u);
      };
      const inTown = Math.max(Math.abs(x - 24), Math.abs(z - 24)) <= 11.5;
      const d = inTown ? Math.min(roadDist(x), roadDist(z)) : 9;
      const pathK = 1 - THREE.MathUtils.smoothstep(d, 0.28, 0.42);
      const dirt = TILE_RGB[Tile.Dirt];
      r = r + (dirt[0] - r) * pathK;
      g = g + (dirt[1] - g) * pathK;
      b = b + (dirt[2] - b) * pathK;
      colors[i * 3] = (r - patch * 0.08 * (1 - pathK)) * v;
      colors[i * 3 + 1] = (g + patch * 0.05 * (1 - pathK)) * v;
      colors[i * 3 + 2] = (b - patch * 0.04 * (1 - pathK)) * v;
      // Gentle relief outside the village; water beds dip.
      const fromCenter = Math.hypot(x - 24, z - 24);
      const hill = fromCenter > 12 ? (fbm(x * 0.08, z * 0.08, state.seed + 9, 3) - 0.45) * Math.min(1, (fromCenter - 12) / 6) * 1.2 : 0;
      pos.setY(i, Math.max(0, hill) - water * 0.35);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const detail = groundDetailTexture();
    detail.repeat.set(N / 2, N / 2);
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 1 }));
    ground.receiveShadow = true;
    ground.userData.noOutline = true;
    this.scene.add(ground);

    // Earth skirt so the map reads as a slab.
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(N, 3, N), new THREE.MeshStandardMaterial({ color: 0x5e3c22, roughness: 1 }));
    skirt.position.set(N / 2, -2.1, N / 2);
    this.scene.add(skirt);

    // Water surface.
    const wg = new THREE.PlaneGeometry(N, N, 1, 1);
    wg.rotateX(-Math.PI / 2);
    wg.translate(N / 2, -0.12, N / 2);
    this.water = new THREE.Mesh(
      wg,
      new THREE.MeshStandardMaterial({ color: 0x3c8fbf, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
    );
    (this.water.material as THREE.Material).userData.outlineParameters = { visible: false };
    (skirt.material as THREE.Material).userData.outlineParameters = { visible: false };
    this.scene.add(this.water);

    // Grass tufts scattered on grassy tiles, instanced.
    const tuft = model('Grass_1_A');
    let tuftMesh: THREE.Mesh | null = null;
    tuft.traverse((c) => {
      if ((c as THREE.Mesh).isMesh && !tuftMesh) tuftMesh = c as THREE.Mesh;
    });
    if (tuftMesh) {
      const tm = tuftMesh as THREE.Mesh;
      const mat = (tm.material as THREE.MeshStandardMaterial).clone();
      mat.color.set(0xe8c870);
      const spots: THREE.Matrix4[] = [];
      for (let y = 0; y < N; y++)
        for (let x = 0; x < N; x++) {
          const t = state.terrain[y * N + x];
          if (t !== Tile.Grass && t !== Tile.DryGrass) continue;
          const k = hash2(x, y, 77);
          if (k > 0.45) continue;
          for (let i = 0; i < 2; i++) {
            const m = new THREE.Matrix4();
            const s = 0.3 + hash2(x + i, y, 3) * 0.18;
            m.compose(
              new THREE.Vector3(x + hash2(x, y + i, 1), 0, y + hash2(x + i, y, 2)),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(0, k * 20 + i, 0)),
              new THREE.Vector3(s, s, s),
            );
            spots.push(m);
          }
        }
      const im = new THREE.InstancedMesh(tm.geometry, mat, spots.length);
      spots.forEach((m, i) => im.setMatrixAt(i, m));
      im.receiveShadow = true;
      im.userData.noOutline = true;
      this.scene.add(im);
    }
  }

  // ------------------------------------------------------------------ nature

  addNode(n: NodeState) {
    const p = tileCenter(n.x, n.y);
    let o: THREE.Object3D;
    const pick = <T extends string>(arr: T[]) => arr[n.uid % arr.length];
    switch (n.kind) {
      case 'acacia':
        o = acacia(0.95 + (n.uid % 4) * 0.12, n.uid);
        break;
      case 'baobab':
        o = baobab(0.9);
        break;
      case 'palm':
        o = tinted('Tree_1_A', 0xd8e080);
        o.scale.setScalar(0.42);
        break;
      case 'bush':
        o = tinted(pick(['Bush_1_A', 'Bush_2_A', 'Bush_4_A'] as NatureId[]), 0xd8d890);
        o.scale.setScalar(0.4);
        break;
      default:
        o = tinted(pick(['Rock_1_E', 'Rock_2_A', 'Rock_2_C', 'Rock_3_E'] as NatureId[]), 0xfff0e0);
        o.scale.setScalar(0.3);
    }
    o.position.copy(p);
    o.rotation.y = (n.uid * 1.7) % (Math.PI * 2);
    this.scene.add(o);
    return o;
  }

  // ------------------------------------------------------------------ buildings

  /** A cutaway compound with villagers working at its stations. */
  addCompound(type: string, x: number, y: number, level: number, dress: (i: number, tool?: string) => Outfit) {
    const n = BUILDINGS[type].size;
    const tier = level >= 7 ? 2 : level >= 4 ? 1 : 0;
    const c = compoundModel(type, tier);
    c.group.position.set(x + n / 2, 0, y + n / 2);
    this.scene.add(c.group);
    this.hookFire(c.group);
    c.stations.forEach((st, i) => {
      const o = dress(i, st.tool);
      const pos = new THREE.Vector3(x + n / 2 + st.x, st.y ?? 0.03, y + n / 2 + st.z);
      this.addWorker(o, pos, st.face, st.anim);
    });
    return c.group;
  }

  addWorker(outfit: Outfit, pos: THREE.Vector3, face: number, anim: string) {
    const person = new Person(outfit);
    person.obj.position.copy(pos);
    person.obj.rotation.y = face;
    person.play(anim, 0);
    person.mixer.setTime(Math.random() * 3);
    this.scene.add(person.obj);
    this.walkers.push({ fixed: true, person, obj: person.obj, work: anim, pos: pos.clone(), dest: null, wait: 0, home: pos, radius: 0, speed: 0 });
  }

  addBuilding(type: string, x: number, y: number, level: number, building = false) {
    const n = BUILDINGS[type].size;
    const tier = level >= 7 ? 2 : level >= 4 ? 1 : 0;
    const g = building ? scaffold(n) : buildingModel(type, tier);
    g.position.set(x + n / 2, 0, y + n / 2);
    this.scene.add(g);
    this.hookFire(g);
    return g;
  }

  /** Lights any hearth fire and molten glow inside a building group. */
  private hookFire(g: THREE.Object3D) {
    g.updateMatrixWorld(true);
    // Fire: flickering flame cones, a warm point light and a glow sprite.
    const fire = g.getObjectByName('fire');
    if (fire) {
      const base = new THREE.Vector3();
      fire.getWorldPosition(base);
      const flames: THREE.Mesh[] = [];
      const fmat = (c: string) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9 });
      [
        ['#ff5a1a', 0.13, 0.42],
        ['#ffa020', 0.09, 0.32],
        ['#ffe070', 0.05, 0.2],
      ].forEach(([c, r, h]) => {
        const f = new THREE.Mesh(new THREE.ConeGeometry(r as number, h as number, 7), fmat(c as string));
        f.position.set(base.x, 0.12 + (h as number) / 2, base.z);
        this.scene.add(f);
        flames.push(f);
      });
      const light = new THREE.PointLight(0xff8a3a, 0, 7, 1.6);
      light.position.set(base.x, 0.6, base.z);
      this.scene.add(light);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.position.set(base.x, 0.4, base.z);
      glow.scale.setScalar(1.6);
      this.scene.add(glow);
      this.fires.push({ light, flames, glow, base });
    }
    const glow = g.getObjectByName('glow') as THREE.Mesh | undefined;
    if (glow) this.glows.push(glow);
  }

  // ------------------------------------------------------------------ people

  /** A villager who wanders around `home`, stopping to do `work` (an animation name). */
  addWalker(outfit: Outfit, home: THREE.Vector3, radius: number, work = 'Interact') {
    const person = new Person(outfit);
    const obj = person.obj;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: shadowBlobTexture(), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2;
    blob.position.y = 0.015;
    obj.add(blob);
    person.play('Idle_A');
    const pos = home.clone().add(new THREE.Vector3((Math.random() - 0.5) * radius, 0, (Math.random() - 0.5) * radius));
    obj.position.copy(pos);
    this.scene.add(obj);
    const w: Walker = { person, obj, work, pos, dest: null, wait: Math.random() * 3, home, radius, speed: 0.55 + Math.random() * 0.25 };
    person.mixer.setTime(Math.random() * 2);
    this.walkers.push(w);
    return w;
  }

  private updateWalkers(dt: number) {
    for (const w of this.walkers) {
      w.person.update(dt);
      if (w.fixed) continue;
      if (w.dest) {
        const d = w.dest.clone().sub(w.pos);
        const len = d.length();
        if (len < 0.05) {
          w.dest = null;
          w.wait = 2 + Math.random() * 5;
          const r = Math.random();
          w.person.play(r < 0.6 ? w.work : r < 0.8 ? 'Idle_B' : 'Idle_A');
        } else {
          d.normalize();
          w.pos.addScaledVector(d, Math.min(len, w.speed * dt));
          w.obj.rotation.y = Math.atan2(d.x, d.z);
          w.person.play('Walking_A');
        }
      } else {
        w.wait -= dt;
        if (w.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const r = w.radius * (0.3 + Math.random() * 0.7);
          w.dest = w.home.clone().add(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
        }
      }
      w.obj.position.copy(w.pos);
    }
  }

  // ------------------------------------------------------------------ lighting

  setPhase(p: number) {
    this.phase = ((p % 1) + 1) % 1;
  }

  private updateLighting(t: number) {
    const p = this.phase;
    let a = DAY_KEYS[0];
    let b = DAY_KEYS[1];
    for (let i = 0; i < DAY_KEYS.length - 1; i++)
      if (p >= DAY_KEYS[i].p && p <= DAY_KEYS[i + 1].p) {
        a = DAY_KEYS[i];
        b = DAY_KEYS[i + 1];
        break;
      }
    const k = (p - a.p) / Math.max(0.0001, b.p - a.p);
    const lerpC = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k);
    this.sun.color.copy(lerpC(a.sun, b.sun));
    this.sun.intensity = THREE.MathUtils.lerp(a.sunI, b.sunI, k);
    this.hemi.color.copy(lerpC(a.sky, b.sky));
    this.hemi.groundColor.copy(lerpC(a.ground, b.ground));
    this.hemi.intensity = THREE.MathUtils.lerp(a.hemiI, b.hemiI, k);
    this.scene.background = lerpC(a.bg, b.bg);
    // Sun travels from east to west across the day; the moon light comes from the other side.
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(a.elev, b.elev, k));
    const az = p < 0.72 ? -0.6 + (p / 0.72) * 2.2 : 2.2;
    const dir = new THREE.Vector3(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev));
    this.sun.position.copy(this.target).addScaledVector(dir, 30);
    this.sun.target.position.copy(this.target);
    const night = p > 0.7 || p < 0.06 ? 1 : 0;
    const nightAmt = p > 0.7 ? Math.min(1, (p - 0.7) / 0.06) : p < 0.06 ? 1 - p / 0.06 : 0;
    for (const f of this.fires) {
      const flick = 0.85 + Math.sin(t * 13 + f.base.x) * 0.08 + Math.sin(t * 23) * 0.05;
      f.light.intensity = (0.05 + nightAmt * 5) * flick;
      f.glow.material.opacity = 0.08 + nightAmt * 0.7 * flick;
      f.flames.forEach((m, i) => {
        m.scale.set(1 + Math.sin(t * 9 + i) * 0.08, flick + Math.sin(t * 11 + i * 2) * 0.12, 1 + Math.cos(t * 7 + i) * 0.08);
        m.rotation.y = t * (1 + i);
      });
    }
    void night;
    (this.water.material as THREE.MeshStandardMaterial).color.setHSL(0.56, 0.5, 0.42 + Math.sin(t * 0.8) * 0.01);
  }

  // ------------------------------------------------------------------ illustrated look

  /** Swaps lit materials for 3-tone toon materials; outlines are drawn at render time. */
  applyToon() {
    const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
    const ramp = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;
    const swapped = new Map<string, THREE.Material>();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m === this.water) return;
      const conv = (mat: THREE.Material) => {
        const sm = mat as THREE.MeshStandardMaterial;
        if (!sm.isMeshStandardMaterial) return mat;
        if (!swapped.has(sm.uuid)) {
          const t = new THREE.MeshToonMaterial({
            color: sm.color,
            map: sm.map,
            gradientMap: ramp,
            side: sm.side,
            transparent: sm.transparent,
            opacity: sm.opacity,
            vertexColors: sm.vertexColors,
            emissive: sm.emissive,
            emissiveIntensity: sm.emissiveIntensity,
          });
          t.userData = { ...sm.userData };
          swapped.set(sm.uuid, t);
        }
        return swapped.get(sm.uuid)!;
      };
      m.material = Array.isArray(m.material) ? m.material.map(conv) : conv(m.material);
      if (m.userData.noOutline) (m.material as THREE.Material).userData.outlineParameters = { visible: false };
    });
  }

  // ------------------------------------------------------------------ controls

  private setupControls() {
    const el = this.renderer.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let zoomStart = 1;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
        zoomStart = this.zoom;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        this.setZoom(zoomStart * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart));
        return;
      }
      const h = this.container.clientHeight || window.innerHeight;
      const unitsPerPx = this.viewH / this.zoom / h;
      const dx = (cur.x - prev.x) * unitsPerPx;
      const dy = (cur.y - prev.y) * unitsPerPx / Math.sin(THREE.MathUtils.degToRad(38));
      // Screen right is world (+x, -z); screen down is world (+x, +z).
      this.target.x += (-dx - dy) * Math.SQRT1_2;
      this.target.z += (dx - dy) * Math.SQRT1_2;
      this.target.x = THREE.MathUtils.clamp(this.target.x, 4, MAP_SIZE - 4);
      this.target.z = THREE.MathUtils.clamp(this.target.z, 4, MAP_SIZE - 4);
    });
    const up = (e: PointerEvent) => pointers.delete(e.pointerId);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => this.setZoom(this.zoom * (e.deltaY > 0 ? 0.9 : 1.1)), { passive: true });
  }

  setZoom(z: number) {
    this.zoom = THREE.MathUtils.clamp(z, 0.45, 2.6);
    this.resize();
  }

  // ------------------------------------------------------------------ loop

  start(onFrame?: (dt: number) => void) {
    this.renderer.setAnimationLoop(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - this.last) / 1000);
      this.last = now;
      this.elapsed += dt;
      const t = this.elapsed;
      onFrame?.(dt);
      this.placeCamera();
      this.updateLighting(t);
      this.updateWalkers(dt);
      for (const g of this.glows) (g.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(t * 5) * 0.4;
      if (this.toon) this.outline.render(this.scene, this.camera);
      else this.renderer.render(this.scene, this.camera);
    });
  }
}
