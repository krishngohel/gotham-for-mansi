import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { loadGlb } from '../../tools/rigNode.mjs';
import { sanitizeClip } from '../../src/actors/animator.js';
import { buildChainClips, CHAIN_CLIPS } from '../../src/actors/chainAnims.js';
import { CHAIN_BEATS } from '../../src/combat/chainTimeline.js';

describe('buildChainClips', () => {
  let model, clips, built;
  beforeAll(async () => {
    const [m, a1, a2] = await Promise.all([
      loadGlb('public/assets/hero_m.glb'),
      loadGlb('public/assets/anims1.glb', { stripTextures: false }),
      loadGlb('public/assets/anims2.glb', { stripTextures: false }),
    ]);
    model = m.scene;
    clips = new Map();
    for (const c of [...a1.animations, ...a2.animations]) clips.set(c.name, sanitizeClip(c));
    built = new Map(buildChainClips(model, clips).map((c) => [c.name, c]));
  });

  // Model-space position of a bone at time t of a clip (+Z is forward, +X is the character's left).
  function at(clip, t, bone) {
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    const p = model.worldToLocal(model.getObjectByName(bone).getWorldPosition(new THREE.Vector3()));
    action.stop();
    mixer.uncacheClip(clip);
    return p;
  }

  it('builds every clip at its beat length', () => {
    expect([...built.keys()]).toEqual(CHAIN_CLIPS);
    for (const [name, c] of built) expect(c.duration).toBeCloseTo(CHAIN_BEATS[name].duration, 6);
  });

  it('has no NaN and only unit quaternions', () => {
    for (const c of built.values()) for (const t of c.tracks) {
      expect(Array.from(t.values).some(Number.isNaN), `${c.name} ${t.name}`).toBe(false);
      if (t instanceof THREE.QuaternionKeyframeTrack) {
        for (let i = 0; i < t.values.length; i += 4) expect(Math.abs(Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]) - 1)).toBeLessThan(1e-3);
      }
    }
  });

  it('Chain_GrabHeads opens wide at the grab and claps the hands together in front at contact', () => {
    const c = built.get('Chain_GrabHeads'), b = CHAIN_BEATS.Chain_GrabHeads;
    const open = at(c, b.grab, 'hand_l').distanceTo(at(c, b.grab, 'hand_r'));
    const l = at(c, b.contact, 'hand_l'), r = at(c, b.contact, 'hand_r'), chest = at(c, b.contact, 'spine_03');
    expect(open).toBeGreaterThan(1.0);
    expect(l.distanceTo(r)).toBeLessThan(0.3);
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.25);
  });

  it('Chain_Yank rips both hands back from the reach', () => {
    const c = built.get('Chain_Yank');
    for (const hand of ['hand_l', 'hand_r']) expect(at(c, 0.08, hand).z - at(c, CHAIN_BEATS.Chain_Yank.contact, hand).z).toBeGreaterThan(0.2);
  });

  it('Chain_Stomp drives both feet down from the tuck', () => {
    const c = built.get('Chain_Stomp');
    const drop = (t, foot) => at(c, t, 'pelvis').y - at(c, t, foot).y;
    for (const foot of ['foot_l', 'foot_r']) expect(drop(CHAIN_BEATS.Chain_Stomp.contact, foot) - drop(0.07, foot)).toBeGreaterThan(0.25);
  });

  it('Chain_Stomp puts the left heel where CHAIN_BEATS.heel says on the contact frame', () => {
    // chainControl lands this heel on a goon's head, so the number and the clip must agree.
    const b = CHAIN_BEATS.Chain_Stomp;
    const p = at(built.get('Chain_Stomp'), b.contact, 'foot_l');
    expect(Math.abs(p.x - b.heel.x)).toBeLessThan(0.04);
    expect(Math.abs(p.y - b.heel.y)).toBeLessThan(0.04);
    expect(Math.abs(p.z - b.heel.z)).toBeLessThan(0.04);
  });

  it('starts and ends every clip on the idle pose', () => {
    const idle = clips.get('Idle_Loop');
    const idleQ = new Map(idle.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => [t.name, Array.from(t.values.slice(0, 4))]));
    for (const c of built.values()) for (const t of c.tracks) {
      if (!idleQ.has(t.name)) continue;
      const q0 = new THREE.Quaternion(...idleQ.get(t.name));
      expect(Math.abs(new THREE.Quaternion(...t.values.slice(0, 4)).dot(q0)), `${c.name} ${t.name} start`).toBeGreaterThan(0.999);
      expect(Math.abs(new THREE.Quaternion(...t.values.slice(-4)).dot(q0)), `${c.name} ${t.name} end`).toBeGreaterThan(0.999);
    }
  });
});
