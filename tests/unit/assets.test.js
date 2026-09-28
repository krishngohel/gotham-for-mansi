import { describe, it, expect } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { CLIP_SET } from '../../src/config/clips.js';
import { MOCAP_CLIPS } from '../../src/config/mocap.js';
import { MOCAP_DATA } from '../../src/config/mocapData.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const LEAN = ['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0'];

describe('built assets', () => {
  it.each(['anims1', 'anims2'])('%s.glb holds exactly the listed clips and no meshes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    const clips = doc.getRoot().listAnimations().map((a) => a.getName()).sort();
    expect(clips).toEqual([...CLIP_SET[name]].sort());
    expect(doc.getRoot().listMeshes()).toHaveLength(0);
  });

  it('anims_mocap.glb holds the listed mocap clips on the game skeleton, no meshes', async () => {
    const doc = await io.read('public/assets/anims_mocap.glb');
    const clips = doc.getRoot().listAnimations().map((a) => a.getName()).sort();
    expect(clips).toEqual([...MOCAP_CLIPS].sort());
    expect(doc.getRoot().listMeshes()).toHaveLength(0);
    const names = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
    for (const b of ['root', 'pelvis', 'spine_01', 'Head', 'thigh_r', 'ball_l', 'hand_r']) expect(names.has(b), b).toBe(true);
    for (const anim of doc.getRoot().listAnimations()) {
      const paths = new Set(anim.listChannels().map((c) => c.getTargetPath()));
      expect(paths.has('scale')).toBe(false);
      const t = anim.listChannels()[0].getSampler().getInput();
      const dur = t.getMax([0])[0];
      expect(dur).toBeGreaterThan(0.3);
      expect(dur).toBeLessThan(3);
      // The generated data must describe this very pack.
      const d = MOCAP_DATA[anim.getName()];
      expect(Math.abs(dur - d.duration)).toBeLessThan(2e-3);
      expect(d.contact).toBeLessThan(d.duration);
      expect(d.root.length).toBe(2 * (Math.round(d.duration * d.fps) + 1));
      for (const c of anim.listChannels()) expect(Array.from(c.getSampler().getOutput().getArray()).some(Number.isNaN)).toBe(false);
    }
  });

  it.each(['hero_m', 'hero_f'])('%s.glb is skinned with 65 joints and lean attributes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    expect(doc.getRoot().listSkins()[0].listJoints()).toHaveLength(65);
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) expect(prim.listSemantics().sort()).toEqual(LEAN);
  });
});
