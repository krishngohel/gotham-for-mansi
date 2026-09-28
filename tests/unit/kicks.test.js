import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { loadGlb } from '../../tools/rigNode.mjs';
import { sanitizeClip } from '../../src/actors/animator.js';
import { buildKickClips, KICK_BEATS } from '../../src/actors/kicks.js';

const EXPECTED = ['Kick_Front', 'Kick_Round', 'Kick_Side', 'Kick_Spin', 'Kick_Flying', 'Knee_Strike'];

describe('buildKickClips', () => {
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
    built = buildKickClips(model, clips);
  });

  it('returns every kick with the expected names', () => {
    expect(built.map((c) => c.name)).toEqual(EXPECTED);
    expect(Object.keys(KICK_BEATS).sort()).toEqual([...EXPECTED].sort());
  });

  it('has sane durations and a contact frame inside each clip', () => {
    for (const c of built) {
      expect(c.duration).toBeGreaterThanOrEqual(0.3);
      expect(c.duration).toBeLessThanOrEqual(1.2);
      expect(KICK_BEATS[c.name].duration).toBe(c.duration);
      expect(KICK_BEATS[c.name].contact).toBeGreaterThan(0.1);
      expect(KICK_BEATS[c.name].contact).toBeLessThan(c.duration - 0.1);
    }
  });

  it('has no NaN and only unit quaternions in rotation tracks', () => {
    for (const c of built) {
      for (const t of c.tracks) {
        expect(Array.from(t.values).some(Number.isNaN), `${c.name} ${t.name}`).toBe(false);
        if (t instanceof THREE.QuaternionKeyframeTrack) {
          for (let i = 0; i < t.values.length; i += 4) {
            const len = Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]);
            expect(Math.abs(len - 1)).toBeLessThan(1e-3);
          }
        }
      }
    }
  });

  it('covers every bone with a rotation track plus the pelvis position', () => {
    const bones = [];
    model.traverse((o) => { if (o.isBone) bones.push(o.name); });
    for (const c of built) {
      const names = new Set(c.tracks.map((t) => t.name));
      for (const b of bones) expect(names.has(`${b}.quaternion`), `${c.name} ${b}`).toBe(true);
      expect(names.has('pelvis.position')).toBe(true);
      expect(c.tracks.some((t) => t.name.endsWith('.scale'))).toBe(false);
    }
  });

  it('keeps the support foot planted through the grounded kicks', () => {
    const mixer = new THREE.AnimationMixer(model);
    const ball = model.getObjectByName('ball_l');
    const p = new THREE.Vector3();
    for (const c of built) {
      if (c.name === 'Kick_Flying') continue;
      const action = mixer.clipAction(c);
      action.play();
      mixer.setTime(0);
      model.updateMatrixWorld(true);
      const ref = ball.getWorldPosition(new THREE.Vector3());
      for (let t = 0; t <= c.duration; t += c.duration / 20) {
        mixer.setTime(t);
        model.updateMatrixWorld(true);
        // Keys are baked at 60 Hz with the ball pinned exactly; slerp between keys during the
        // fastest part of the spin can wobble it by about a centimetre.
        expect(ball.getWorldPosition(p).distanceTo(ref), `${c.name} t=${t.toFixed(2)}`).toBeLessThan(0.02);
      }
      action.stop();
      mixer.uncacheClip(c);
    }
  });

  it('starts and ends every grounded kick on the idle pose', () => {
    const idle = clips.get('Idle_Loop');
    const idleQ = new Map(idle.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => [t.name, Array.from(t.values.slice(0, 4))]));
    for (const c of built) {
      if (c.name === 'Kick_Flying') continue;
      for (const t of c.tracks) {
        if (!idleQ.has(t.name)) continue;
        const first = Array.from(t.values.slice(0, 4)), last = Array.from(t.values.slice(-4));
        const q0 = new THREE.Quaternion(...idleQ.get(t.name));
        expect(Math.abs(new THREE.Quaternion(...first).dot(q0)), `${c.name} ${t.name} start`).toBeGreaterThan(0.999);
        expect(Math.abs(new THREE.Quaternion(...last).dot(q0)), `${c.name} ${t.name} end`).toBeGreaterThan(0.999);
      }
    }
  });
});
