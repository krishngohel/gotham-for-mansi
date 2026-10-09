import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sanitizeClip, createAnimator } from '../../src/actors/animator.js';
import { classifySuitVertex, classifyGoonVertex } from '../../src/actors/outfits.js';
import { heroPlantsFeet, enemyPlantsFeet } from '../../src/actors/characters.js';
import { CHAIN_HOLD_CLIPS } from '../../src/actors/enemy.js';

const lm = {
  fwd: 1, neckY: 1.5, headCenter: { x: 0, y: 1.66, z: 0.02 }, headRadius: 0.1, headTop: 1.8, eyeY: 1.68,
  shoulderX: 0.2, elbowX: 0.5, kneeY: 0.5, ankleY: 0.1, beltY: 1.0, hipHalfWidth: 0.22, chestY: 1.35, chestFrontZ: 0.12,
};

describe('sanitizeClip', () => {
  it('keeps rotations and pelvis translation only', () => {
    const q = [0, 0, 0, 1, 0, 0, 0, 1];
    const v = [0, 0, 0, 0, 1, 0];
    const clip = new THREE.AnimationClip('T', 1, [
      new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], q),
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], v),
      new THREE.VectorKeyframeTrack('spine_01.position', [0, 1], v),
      new THREE.VectorKeyframeTrack('spine_01.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
      new THREE.QuaternionKeyframeTrack('spine_01.quaternion', [0, 1], q),
    ]);
    expect(sanitizeClip(clip).tracks.map((t) => t.name)).toEqual(['pelvis.quaternion', 'pelvis.position', 'spine_01.quaternion']);
  });
});

describe('suit regions', () => {
  it('paints the head as cowl except the lower front face', () => {
    expect(classifySuitVertex({ x: 0, y: 1.75, z: -0.05 }, lm)).toBe('cowl');
    expect(classifySuitVertex({ x: 0, y: 1.62, z: 0.1 }, lm)).toBe('skin');
    expect(classifySuitVertex({ x: 0, y: 1.62, z: -0.1 }, lm)).toBe('cowl');
  });
  it('flips the face test when the model faces -Z', () => {
    expect(classifySuitVertex({ x: 0, y: 1.62, z: -0.1 }, { ...lm, fwd: -1, headCenter: { x: 0, y: 1.66, z: -0.02 } })).toBe('skin');
  });
  it('paints forearms as gloves, shins as boots, and a belt band', () => {
    expect(classifySuitVertex({ x: 0.7, y: 1.45, z: 0 }, lm)).toBe('glove');
    expect(classifySuitVertex({ x: 0.1, y: 0.3, z: 0 }, lm)).toBe('boot');
    expect(classifySuitVertex({ x: 0.1, y: 1.0, z: 0.1 }, lm)).toBe('belt');
    expect(classifySuitVertex({ x: 0.1, y: 1.3, z: 0.1 }, lm)).toBe('suit');
  });
});

describe('goon regions', () => {
  it('paints the torso as one shirt region and leaves forearms bare', () => {
    expect(classifyGoonVertex({ x: 0, y: 1.2, z: 0 }, lm)).toBe('shirt');
    expect(classifyGoonVertex({ x: 0, y: 1.27, z: 0 }, lm)).toBe('shirt');
    expect(classifyGoonVertex({ x: 0.6, y: 1.45, z: 0 }, lm)).toBe('skin');
    expect(classifyGoonVertex({ x: 0.1, y: 0.7, z: 0 }, lm)).toBe('pants');
    expect(classifyGoonVertex({ x: 0.1, y: 0.05, z: 0 }, lm)).toBe('boot');
  });
});

describe('animator.prime', () => {
  it('builds actions up front and rejects unknown clips', () => {
    const root = new THREE.Object3D();
    const bone = new THREE.Bone();
    bone.name = 'pelvis';
    root.add(bone);
    const clip = new THREE.AnimationClip('A', 1, [new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
    const anim = createAnimator(root, new Map([['A', clip]]));
    anim.prime(['A']);
    expect(anim.mixer.existingAction(clip)).toBeTruthy();
    expect(() => anim.prime(['nope'])).toThrow();
  });
});

describe('enemy chain-clip priming', () => {
  it('primes every clip a chain plays on a held goon, so an enemy is created with them already built', () => {
    const root = new THREE.Object3D();
    const bone = new THREE.Bone();
    bone.name = 'pelvis';
    root.add(bone);
    const track = () => new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]);
    const clips = new Map(CHAIN_HOLD_CLIPS.map((name) => [name, new THREE.AnimationClip(name, 1, [track()])]));
    // createEnemy primes ch.animator with exactly CHAIN_HOLD_CLIPS right after createGoon: this
    // mirrors that call on a mixer built the same way, so it stands for a real enemy's mixer.
    const anim = createAnimator(root, clips);
    anim.prime(CHAIN_HOLD_CLIPS);
    for (const name of CHAIN_HOLD_CLIPS) expect(anim.mixer.existingAction(clips.get(name)), name).toBeTruthy();
    expect(CHAIN_HOLD_CLIPS).toEqual(['Idle_Shield_Break', 'Hit_Head', 'Hit_Chest', 'Hit_Knockback']);
  });
});

describe('foot planting gate', () => {
  it('lets the hero sample the ground under each foot only when standing free', () => {
    expect(heroPlantsFeet({ control: null, grounded: true })).toBe(true);
    expect(heroPlantsFeet({ control: { name: 'ledge' }, grounded: true })).toBe(false);
    expect(heroPlantsFeet({ control: { name: 'ladder' }, grounded: false })).toBe(false);
    expect(heroPlantsFeet({ control: null, grounded: false })).toBe(false);
  });
  it('lets a goon sample the ground only while up, alive and on the ground', () => {
    expect(enemyPlantsFeet({ air: false, down: false, alive: true })).toBe(true);
    expect(enemyPlantsFeet({ air: true, down: false, alive: true })).toBe(false);
    expect(enemyPlantsFeet({ air: false, down: true, alive: true })).toBe(false);
    expect(enemyPlantsFeet({ air: false, down: false, alive: false })).toBe(false);
  });
});

describe('replaying the clip that is already playing', () => {
  // A goon hit twice with the same reaction, a downed goon knocked down again, the same strike
  // twice: the restart must crossfade from where the clip was, never snap to its first frame.
  it('blends from the current pose instead of snapping to frame 0', () => {
    const root = new THREE.Object3D();
    const bone = new THREE.Bone();
    bone.name = 'pelvis';
    root.add(bone);
    const q90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const clip = new THREE.AnimationClip('Hit', 1, [new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, q90.x, q90.y, q90.z, q90.w])]);
    const anim = createAnimator(root, new Map([['Hit', clip]]));
    anim.play('Hit', { once: true, fade: 0 });
    anim.update(0.8);
    const before = bone.quaternion.clone();
    anim.play('Hit', { once: true, fade: 0.2 });
    anim.update(1 / 60);
    // Snapping would put it back at the identity (0 degrees) pose; a blend stays near 72 degrees.
    expect(bone.quaternion.angleTo(before)).toBeLessThan(0.1);
    anim.update(0.4);
    expect(anim.currentName).toBe('Hit');
    // Once the blend is over it is the restarted clip that plays (0.4 s in, ~36 degrees).
    expect(bone.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(0.75);
  });
  it('a restart keeps alternating cleanly', () => {
    const root = new THREE.Object3D();
    const bone = new THREE.Bone();
    bone.name = 'pelvis';
    root.add(bone);
    const clip = new THREE.AnimationClip('Hit', 1, [new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, 0, 0.7071, 0, 0.7071])]);
    const anim = createAnimator(root, new Map([['Hit', clip]]));
    for (let i = 0; i < 5; i++) { const a = anim.play('Hit', { once: true, fade: 0.1 }); anim.update(0.3); expect(anim.currentAction).toBe(a); }
    expect(anim.mixer._actions.filter((a) => a.isRunning()).length).toBeLessThanOrEqual(2);
  });
});
