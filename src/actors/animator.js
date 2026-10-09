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
  // Two actions per clip: replaying the clip that is playing (the same hit reaction twice, the
  // same strike again) restarts it on the other one and crossfades, where a single action could
  // only jump back to its first frame. The twin is made the first time it is needed.
  const actions = new Map();
  let current = null;
  const action = (name, twin = false) => {
    let pair = actions.get(name);
    if (!pair) {
      const clip = clips.get(name);
      if (!clip) throw new Error(`Missing animation clip ${name}`);
      pair = [mixer.clipAction(clip), null];
      actions.set(name, pair);
    }
    if (twin && !pair[1]) pair[1] = mixer.clipAction(pair[0].getClip().clone());
    return twin ? pair[1] : pair[0];
  };
  return {
    mixer,
    // `startAt` begins the clip partway in (clip seconds), which skips a long wind-up.
    play(name, { fade = 0.15, once = false, timeScale = 1, startAt = 0 } = {}) {
      let next = action(name);
      if (current && current.getClip().name === name) {
        if (!once) { current.timeScale = timeScale; return current; }
        next = current === next ? action(name, true) : next;
      }
      next.reset();
      next.time = startAt;
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
    // Creates the actions up front, so a clip's first play mid-fight doesn't build its bindings.
    prime(names) { for (const n of names) action(n); },
    get currentName() { return current?.getClip().name ?? null; },
    // The playing action itself (a goon's strike speeds up from its held wind-up without a restart).
    get currentAction() { return current; },
    has: (name) => clips.has(name),
    update(dt) { mixer.update(dt); },
  };
}
