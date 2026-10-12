// Converts the source models in assets-src/models into self-contained glTF JSON files
// in public/models (buffers inlined as data URIs, textures kept as PNG files).
// Animation libraries are stripped down to skeleton + animations.
// Usage: node scripts/convert-models.mjs
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'assets-src/models';
const OUT = 'public/models';
const io = new NodeIO();

async function convert(file, outFile, { animOnly = false } = {}) {
  const doc = await io.read(file);
  const root = doc.getRoot();
  if (animOnly) {
    for (const node of root.listNodes()) {
      node.setMesh(null);
      node.setSkin(null);
    }
    for (const m of root.listMeshes()) m.dispose();
    for (const s of root.listSkins()) s.dispose();
  }
  await doc.transform(dedup(), prune({ keepLeaves: true }));
  // Textures embedded in the source keep living next to the model as PNGs.
  for (const tex of root.listTextures()) {
    if (!tex.getURI()) tex.setURI(`${path.basename(outFile, '.json')}_${tex.getName() || 'tex'}.png`);
  }
  const { json, resources } = await io.writeJSON(doc, { basename: path.basename(outFile, '.json') });
  for (const buf of json.buffers ?? []) {
    const data = resources[buf.uri];
    buf.uri = `data:application/octet-stream;base64,${Buffer.from(data).toString('base64')}`;
  }
  for (const img of json.images ?? []) {
    if (img.uri && resources[img.uri]) fs.writeFileSync(path.join(path.dirname(outFile), img.uri), resources[img.uri]);
  }
  fs.writeFileSync(outFile, JSON.stringify(json));
  return fs.statSync(outFile).size;
}

let total = 0;
for (const dir of ['chars', 'nature', 'res']) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  for (const f of fs.readdirSync(path.join(SRC, dir))) {
    const src = path.join(SRC, dir, f);
    if (/\.(txt)$/.test(f)) fs.copyFileSync(src, path.join(OUT, dir, f));
    if (!/\.(gltf|glb)$/.test(f)) continue;
    const name = f.replace(/\.(gltf|glb)$/, '').replace(/_Color1$/, '');
    const size = await convert(src, path.join(OUT, dir, `${name}.json`), { animOnly: f.startsWith('Rig_Medium_') });
    total += size;
    console.log(`${(size / 1024).toFixed(0).padStart(6)} KB  ${dir}/${name}.json`);
  }
}
console.log(`total ${(total / 1024 / 1024).toFixed(2)} MB`);
