import * as THREE from 'three';

// The shared skeleton has matching bone lengths, but only rotations and the pelvis
// translation are safe to apply across bodies. Scale tracks are identity noise.
export function sanitizeClip(clip) {
  const tracks = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf('.');
    const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    if (prop === 'scale') return false;
    if (prop === 'position') return node === 'pelvis';
    return true;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function createAnimator(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  let current = null;
  const action = (name) => {
    if (!actions.has(name)) {
      const clip = clips.get(name);
      if (!clip) throw new Error(`Missing animation clip ${name}`);
      actions.set(name, mixer.clipAction(clip));
    }
    return actions.get(name);
  };
  return {
    mixer,
    play(name, { fade = 0.15, once = false, timeScale = 1 } = {}) {
      const next = action(name);
      if (next === current && !once) { next.timeScale = timeScale; return next; }
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.timeScale = timeScale;
      next.enabled = true;
      next.setEffectiveWeight(1);
      if (current && current !== next) next.crossFadeFrom(current, fade, false);
      next.play();
      current = next;
      return next;
    },
    get currentName() { return current?.getClip().name ?? null; },
    update(dt) { mixer.update(dt); },
  };
}
