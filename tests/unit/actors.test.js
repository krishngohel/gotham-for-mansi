import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sanitizeClip, createAnimator } from '../../src/actors/animator.js';
import { classifySuitVertex, classifyGoonVertex } from '../../src/actors/outfits.js';

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
