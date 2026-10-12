import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

/** CC0 models from KayKit (Kay Lousberg), loaded once and cloned per use. */
const BASE = 'models/';

export const NATURE = [
  'Tree_4_A', 'Tree_4_B', 'Tree_4_C', 'Tree_1_A', 'Tree_2_A', 'Tree_3_A', 'Tree_Bare_1_A', 'Tree_Bare_2_A',
  'Rock_1_A', 'Rock_1_E', 'Rock_1_J', 'Rock_2_A', 'Rock_2_C', 'Rock_3_A', 'Rock_3_E',
  'Bush_1_A', 'Bush_1_C', 'Bush_2_A', 'Bush_4_A', 'Grass_1_A', 'Grass_2_A', 'Grass_1_C',
] as const;
export const RES = [
  'Wood_Log_Stack', 'Wood_Log_A', 'Stone_Bricks_Stack_Medium', 'Stone_Chunks_Large', 'Stone_Chunks_Small',
  'Textiles_Stack_Small', 'Iron_Bars_Stack_Small', 'Gold_Nuggets', 'Pallet_Wood', 'Wood_Planks_Stack_Small',
] as const;
export const CHARS = ['Mannequin_Medium'] as const;
const ANIMS = ['General', 'MovementBasic', 'Tools', 'CombatMelee', 'CombatRanged', 'Simulation'];

export type NatureId = (typeof NATURE)[number];
export type ResModelId = (typeof RES)[number];
export type CharId = (typeof CHARS)[number];

const models = new Map<string, THREE.Object3D>();
export const clips = new Map<string, THREE.AnimationClip>();

function prep(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return o;
}

export async function loadAssets(onProgress?: (f: number) => void) {
  const loader = new GLTFLoader();
  const jobs: [string, string][] = [
    ...NATURE.map((n) => [n, `${BASE}nature/${n}.json`] as [string, string]),
    ...RES.map((n) => [n, `${BASE}res/${n}.json`] as [string, string]),
    ...CHARS.map((n) => [n, `${BASE}chars/${n}.json`] as [string, string]),
    ...ANIMS.map((a) => [`anim:${a}`, `${BASE}chars/Rig_Medium_${a}.json`] as [string, string]),
  ];
  let done = 0;
  await Promise.all(
    jobs.map(async ([key, url]) => {
      const g = await loader.loadAsync(url);
      if (key.startsWith('anim:'))
        for (const c of g.animations) {
          // Drop tracks for hand-slot bones the mannequin does not have.
          c.tracks = c.tracks.filter((t) => !t.name.startsWith('handslot'));
          clips.set(c.name, c);
        }
      else models.set(key, prep(g.scene));
      onProgress?.(++done / jobs.length);
    }),
  );
}

export function model(id: NatureId | ResModelId): THREE.Object3D {
  return models.get(id)!.clone(true);
}

/** A tinted copy of a model; materials are cloned so the tint stays local. */
export function tinted(id: NatureId | ResModelId, tint: THREE.ColorRepresentation): THREE.Object3D {
  const o = model(id);
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color.multiply(new THREE.Color(tint));
      m.material = mat;
    }
  });
  return o;
}

// ------------------------------------------------------------------ characters


/** A fresh, independently animatable copy of the KayKit mannequin. */
export function mannequin(): THREE.Object3D {
  const o = SkeletonUtils.clone(models.get('Mannequin_Medium')!);
  o.traverse((c) => {
    const m = c as THREE.SkinnedMesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.frustumCulled = false;
    }
  });
  return o;
}
