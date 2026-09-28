// Shrinks the built GLBs in public/assets in place. Safe to run more than once.
// - Animation files: drops tracks the game throws away at load (scale everywhere, position on
//   anything but the pelvis; see sanitizeClip), then any data nothing points at.
// - Meshes: stores normals as 16-bit and skin weights as 8-bit. Positions and UVs stay full
//   precision so outfit rebinding and texture coordinates are untouched.
import path from 'node:path';
import { stat } from 'node:fs/promises';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, quantize, resample } from '@gltf-transform/functions';

const DIR = 'public/assets';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function dropOrphans(doc) {
  for (const a of doc.getRoot().listAccessors()) {
    if (a.listParents().every((p) => p === doc.getRoot())) a.dispose();
  }
}

export async function optimizeAnims(file) {
  const doc = await io.read(path.join(DIR, file));
  for (const anim of doc.getRoot().listAnimations()) {
    for (const ch of anim.listChannels()) {
      const p = ch.getTargetPath();
      if (p === 'scale' || (p === 'translation' && ch.getTargetNode()?.getName() !== 'pelvis')) {
        const s = ch.getSampler();
        ch.dispose();
        if (s && !s.listParents().some((x) => x.propertyType === 'AnimationChannel')) s.dispose();
      }
    }
  }
  await doc.transform(resample({ tolerance: 1e-4 }), prune());
  dropOrphans(doc);
  await io.write(path.join(DIR, file), doc);
}

export async function optimizeMesh(file) {
  const doc = await io.read(path.join(DIR, file));
  await doc.transform(quantize({ pattern: /^(NORMAL|WEIGHTS_0|JOINTS_0)$/, quantizeNormal: 10, quantizeWeight: 8 }), prune());
  dropOrphans(doc);
  await io.write(path.join(DIR, file), doc);
}

export async function optimizeAll() {
  for (const f of ['anims1.glb', 'anims2.glb', 'anims_mocap.glb']) await optimizeAnims(f);
  for (const f of ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'outfits.glb']) await optimizeMesh(f);
  for (const f of ['outfits.glb', 'hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb', 'anims_mocap.glb'])
    console.log(f, ((await stat(path.join(DIR, f))).size / 1e6).toFixed(2), 'MB');
}

if (process.argv[1]?.endsWith('optimize-assets.mjs')) await optimizeAll();
