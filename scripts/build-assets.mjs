// Converts the Quaternius CC0 source packs in assets-src/ into slim GLBs in public/assets/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, mergeDocuments, prune, resample, textureCompress } from '@gltf-transform/functions';
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

// Outfit parts from Quaternius's Modular Character Outfits (CC0), merged into one file.
// Each part keeps its own skin; the game rebinds them to a character's skeleton by bone name.
export const OUTFIT_PARTS = [
  'Male_Peasant_Arms', 'Male_Peasant_Body', 'Male_Peasant_Legs', 'Male_Peasant_Feet',
  'Male_Ranger_Arms', 'Male_Ranger_Body', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Head_Hood', 'Male_Ranger_Acc_Pauldron',
  'Female_Ranger_Feet', 'Female_Ranger_Arms',
];

async function outfits(out) {
  const doc = await io.read(path.join(SRC, 'outfits', OUTFIT_PARTS[0] + '.gltf'));
  const root = doc.getRoot();
  const scene = root.listScenes()[0];
  const tag = (d, name) => { for (const n of d.getRoot().listNodes()) if (n.getMesh()) { n.setName(name); n.getMesh().setName(name); } };
  tag(doc, OUTFIT_PARTS[0]);
  for (const part of OUTFIT_PARTS.slice(1)) {
    const other = await io.read(path.join(SRC, 'outfits', part + '.gltf'));
    tag(other, part);
    const map = mergeDocuments(doc, other);
    const otherScene = other.getRoot().listScenes()[0];
    for (const n of otherScene.listChildren()) scene.addChild(map.get(n));
  }
  for (const s of root.listScenes()) if (s !== scene) s.dispose();
  // GLB allows one buffer: point everything at the first.
  const [buffer, ...extra] = root.listBuffers();
  for (const a of root.listAccessors()) a.setBuffer(buffer);
  for (const b of extra) b.dispose();
  stripAttributes(doc);
  for (const mat of root.listMaterials()) mat.setMetallicRoughnessTexture(null);
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
  await io.write(path.join(OUT, out), doc);
}

await mkdir(OUT, { recursive: true });
await outfits('outfits.glb');
await character('Superhero_Male_FullBody.gltf', 'hero_m.glb');
await character('Superhero_Female_FullBody.gltf', 'hero_f.glb');
await character('Hair_Long.gltf', 'hair_long.glb', { keepBaseColor: true });
await anims('UAL1_Standard.glb', 'anims1.glb', CLIP_SET.anims1);
await anims('UAL2_Standard.glb', 'anims2.glb', CLIP_SET.anims2);
for (const f of ['outfits.glb', 'hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb'])
  console.log(f, ((await stat(path.join(OUT, f))).size / 1e6).toFixed(2), 'MB');
