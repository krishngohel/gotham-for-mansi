import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { loadGlb } from '../../tools/rigNode.mjs';
import { sanitizeClip } from '../../src/actors/animator.js';
import { buildStealthClips, STEALTH_CLIPS, STEALTH_BEATS } from '../../src/actors/stealthAnims.js';

describe('buildStealthClips', () => {
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
    built = new Map(buildStealthClips(model, clips).map((c) => [c.name, c]));
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
  const track = (c, n) => c.tracks.find((t) => t.name === n);

  it('builds every clip at its length', () => {
    expect([...built.keys()]).toEqual(STEALTH_CLIPS);
    for (const n of ['Rifle_Aim', 'Rifle_Search', 'Takedown_Choke', 'Choked']) expect(built.get(n).duration).toBeCloseTo(STEALTH_BEATS[n].duration, 6);
    expect(built.get('Rifle_Walk').duration).toBeCloseTo(clips.get('Walk_Loop').duration, 6);
    expect(built.get('Rifle_Idle').duration).toBeCloseTo(clips.get('Idle_Loop').duration, 6);
  });

  it('has no NaN and only unit quaternions', () => {
    for (const c of built.values()) for (const t of c.tracks) {
      expect(Array.from(t.values).some(Number.isNaN), `${c.name} ${t.name}`).toBe(false);
      if (t instanceof THREE.QuaternionKeyframeTrack) {
        for (let i = 0; i < t.values.length; i += 4) expect(Math.abs(Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]) - 1)).toBeLessThan(1e-3);
      }
    }
  });

  it('the rifle walk keeps the walk legs and only replaces the arms', () => {
    const walk = clips.get('Walk_Loop'), rw = built.get('Rifle_Walk');
    expect(track(rw, 'thigh_l.quaternion')).toBe(track(walk, 'thigh_l.quaternion'));
    expect(track(rw, 'pelvis.position')).toBe(track(walk, 'pelvis.position'));
    expect(track(rw, 'upperarm_r.quaternion')).not.toBe(track(walk, 'upperarm_r.quaternion'));
  });

  it('the rifle hold carries both hands in front of the chest, the left one further out', () => {
    const c = built.get('Rifle_Idle');
    const l = at(c, 0.5, 'hand_l'), r = at(c, 0.5, 'hand_r'), chest = at(c, 0.5, 'spine_03');
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.15);
    expect(l.z).toBeGreaterThan(r.z);
    expect(l.distanceTo(r)).toBeLessThan(0.6);
  });

  it('the aim raises the rifle to the shoulder', () => {
    const c = built.get('Rifle_Aim');
    const l = at(c, 0.5, 'hand_l'), r = at(c, 0.5, 'hand_r'), chest = at(c, 0.5, 'spine_03');
    expect(r.y).toBeGreaterThan(chest.y - 0.1);
    expect(l.z - chest.z).toBeGreaterThan(0.35);
  });

  it('the search swings the rifle from side to side', () => {
    const c = built.get('Rifle_Search');
    expect(Math.abs(at(c, 0.75, 'hand_l').x - at(c, 2.25, 'hand_l').x)).toBeGreaterThan(0.15);
  });

  it('the choke locks both arms round a neck in front of the chest', () => {
    const c = built.get('Takedown_Choke');
    const l = at(c, 1, 'hand_l'), r = at(c, 1, 'hand_r'), chest = at(c, 1, 'spine_03');
    expect(l.distanceTo(r)).toBeLessThan(0.3);
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.2);
    expect(Math.abs((l.y + r.y) / 2 - chest.y)).toBeLessThan(0.3);
  });

  it('the choked goon claws at its throat and sinks at the knees', () => {
    const c = built.get('Choked');
    const neck = at(c, 1, 'neck_01');
    for (const hand of ['hand_l', 'hand_r']) expect(at(c, 1, hand).distanceTo(neck)).toBeLessThan(0.3);
    expect(at(c, 0, 'pelvis').y - at(c, 1.95, 'pelvis').y).toBeGreaterThan(0.2);
  });
});
