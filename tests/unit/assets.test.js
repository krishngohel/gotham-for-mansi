import { describe, it, expect } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { CLIP_SET } from '../../src/config/clips.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const LEAN = ['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0'];

describe('built assets', () => {
  it.each(['anims1', 'anims2'])('%s.glb holds exactly the listed clips and no meshes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    const clips = doc.getRoot().listAnimations().map((a) => a.getName()).sort();
    expect(clips).toEqual([...CLIP_SET[name]].sort());
    expect(doc.getRoot().listMeshes()).toHaveLength(0);
  });

  it.each(['hero_m', 'hero_f'])('%s.glb is skinned with 65 joints and lean attributes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    expect(doc.getRoot().listSkins()[0].listJoints()).toHaveLength(65);
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) expect(prim.listSemantics().sort()).toEqual(LEAN);
  });
});
