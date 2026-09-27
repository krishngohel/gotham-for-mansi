// Converts the Quaternius CC0 source packs in assets-src/ into slim GLBs in public/assets/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { CLIP_SET } from '../src/config/clips.js';

const SRC = process.env.ASSETS_SRC ?? 'assets-src';
const OUT = 'public/assets';
const KEEP = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics()) if (!KEEP.has(sem)) prim.setAttribute(sem, null);
}

async function character(src, out, { keepBaseColor = false } = {}) {
  const doc = await io.read(path.join(SRC, src));
  stripAttributes(doc);
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null);
    if (!keepBaseColor) mat.setBaseColorTexture(null);
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
  await io.write(path.join(OUT, out), doc);
}

async function anims(src, out, keep) {
  const doc = await io.read(path.join(SRC, src));
  for (const anim of doc.getRoot().listAnimations()) if (!keep.includes(anim.getName())) anim.dispose();
  for (const node of doc.getRoot().listNodes()) { node.setMesh(null); node.setSkin(null); }
  await doc.transform(resample({ tolerance: 1e-4 }), prune());
  await io.write(path.join(OUT, out), doc);
}

await mkdir(OUT, { recursive: true });
await character('Superhero_Male_FullBody.gltf', 'hero_m.glb');
await character('Superhero_Female_FullBody.gltf', 'hero_f.glb');
await character('Hair_Long.gltf', 'hair_long.glb', { keepBaseColor: true });
await anims('UAL1_Standard.glb', 'anims1.glb', CLIP_SET.anims1);
await anims('UAL2_Standard.glb', 'anims2.glb', CLIP_SET.anims2);
for (const f of ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb'])
  console.log(f, ((await stat(path.join(OUT, f))).size / 1e6).toFixed(2), 'MB');
