// Third-person orbit camera with collision pull-in, per-mode framing, FOV kick and shake.
import * as THREE from 'three';

const MODES = {
  ground: { dist: 3.4, height: 1.5, side: 0.62, fov: 0 },
  sprint: { dist: 4.1, height: 1.45, side: 0.5, fov: 7 },
  glide: { dist: 7, height: 1.3, side: 0, fov: 12 },
  zip: { dist: 5.2, height: 1.4, side: 0.3, fov: 9 },
  combat: { dist: 5.2, height: 1.65, side: 0.25, fov: 3 },
  takedown: { dist: 2.6, height: 1.3, side: 0.9, fov: -8 },
  climb: { dist: 4.6, height: 1.2, side: 0.4, fov: 2 },
  hang: { dist: 4.2, height: 0.6, side: 0.35, fov: 4 },
  wallrun: { dist: 4.4, height: 1.4, side: 0.2, fov: 10 },
  dive: { dist: 5.5, height: 2.2, side: 0, fov: 14 },
};

export function createFollowCamera(camera, collision) {
  const s = {
    yaw: 0, pitch: 0.22, dist: 4.2, height: 1.55, side: 0.55, fovKick: 0, hitKick: 0,
    pivot: new THREE.Vector3(), shake: 0, baseFov: 60, sensitivity: 1, invertY: false, shakeEnabled: true, actionEnabled: true,
    mode: 'ground',
  };
  const tmp = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let first = true;
  const action = { active: false, t: 0, dur: 1, focus: new THREE.Vector3(), pos: new THREE.Vector3(), roll: 0 };
  const blendPos = new THREE.Vector3(), blendLook = new THREE.Vector3(), toAction = new THREE.Vector3();

  return {
    state: s,
    configure({ fov, sensitivity, invertY, cameraShake, actionCam = true }) {
      s.baseFov = fov; s.sensitivity = sensitivity; s.invertY = invertY; s.shakeEnabled = cameraShake; s.actionEnabled = actionCam;
    },
    addShake(amount) { if (s.shakeEnabled) s.shake = Math.max(s.shake, amount); },
    // A hit lands: a short FOV punch-in (narrower) that decays over about a tenth of a second.
    hitKick(amount = 3) { if (s.shakeEnabled) s.hitKick = Math.min(s.hitKick, -amount); },
    forward(out = new THREE.Vector3()) { return out.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)); },
    right(out = new THREE.Vector3()) { return out.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw)); },
    lookDir(out = new THREE.Vector3()) { return camera.getWorldDirection(out); },
    snapBehind(yaw, pitch = 0.22) { s.yaw = yaw; s.pitch = pitch; first = true; },
    // Action shot for critical hits: the camera swings low and to the side of the blow,
    // tilts like a comic panel, then eases back. Player control of the orbit is untouched.
    actionShot(focus, attacker, duration = 0.9) {
      if (!s.actionEnabled) return;
      const dx = focus.x - attacker.x, dz = focus.z - attacker.z;
      const len = Math.hypot(dx, dz) || 1;
      // Pick the side of the attack line that's closer to where the camera already is.
      const px = -dz / len, pz = dx / len;
      const side = (camera.position.x - focus.x) * px + (camera.position.z - focus.z) * pz >= 0 ? 1 : -1;
      action.t = 0;
      action.dur = duration;
      action.focus.copy(focus).lerp(attacker, 0.35);
      action.focus.y = focus.y - 0.2;
      action.pos.set(action.focus.x + px * side * 3.2 - (dx / len) * 1.2, focus.y - 0.55, action.focus.z + pz * side * 3.2 - (dz / len) * 1.2);
      action.roll = side * 0.16;
      action.active = true;
    },
    update(dt, focus, look, mode = 'ground', speed = 0) {
      const m = MODES[mode] ?? MODES.ground;
      s.mode = mode;
      s.yaw -= look.dx * 0.0022 * s.sensitivity;
      s.pitch += look.dy * 0.0022 * s.sensitivity * (s.invertY ? -1 : 1);
      s.pitch = THREE.MathUtils.clamp(s.pitch, -1.05, 1.25);
      // During a grapple zip the view levels out so the landing is framed.
      if (mode === 'zip') s.pitch += (0.35 - s.pitch) * Math.min(1, dt * 3);
      const k = 1 - Math.exp(-dt * 6);
      s.dist += (m.dist - s.dist) * k;
      s.height += (m.height - s.height) * k;
      s.side += (m.side - s.side) * k;
      const speedKick = mode === 'glide' ? Math.min(10, speed * 0.3) : 0;
      s.fovKick += (m.fov + speedKick - s.fovKick) * k;
      s.hitKick *= Math.exp(-dt * 14);

      tmp.copy(focus);
      tmp.y += s.height;
      if (first) { s.pivot.copy(tmp); first = false; }
      // Follow tightly horizontally, a little softer vertically so jumps don't jolt the view.
      const kh = 1 - Math.exp(-dt * 20), kv = 1 - Math.exp(-dt * 10);
      s.pivot.x += (tmp.x - s.pivot.x) * kh;
      s.pivot.z += (tmp.z - s.pivot.z) * kh;
      s.pivot.y += (tmp.y - s.pivot.y) * kv;

      const cp = Math.cos(s.pitch);
      const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
      const rx = -fz, rz = fx;
      lookAt.set(s.pivot.x + rx * s.side, s.pivot.y, s.pivot.z + rz * s.side);
      desired.set(lookAt.x - fx * cp * s.dist, lookAt.y + Math.sin(s.pitch) * s.dist, lookAt.z - fz * cp * s.dist);
      // The shoulder offset itself must not poke into a wall next to the hero.
      dir.subVectors(lookAt, s.pivot);
      const sideLen = dir.length();
      if (sideLen > 1e-4) {
        dir.divideScalar(sideLen);
        const sideHit = collision.raycast(s.pivot, dir, sideLen + 0.25);
        if (sideHit) lookAt.copy(s.pivot).addScaledVector(dir, Math.max(0, sideHit.t - 0.3));
      }
      // Pull in if a wall is between the pivot and the camera.
      dir.subVectors(desired, lookAt);
      const len = dir.length();
      dir.divideScalar(len || 1);
      const hit = collision.raycast(lookAt, dir, len + 0.3);
      const d = hit ? Math.max(0.6, hit.t - 0.35) : len;
      camera.position.copy(lookAt).addScaledVector(dir, d);
      if (camera.position.y < 0.4) camera.position.y = 0.4;
      if (s.shake > 0) {
        s.shake = Math.max(0, s.shake - dt);
        const a = s.shake * 0.3;
        camera.position.x += (Math.random() - 0.5) * a;
        camera.position.y += (Math.random() - 0.5) * a;
        camera.position.z += (Math.random() - 0.5) * a;
      }
      // Looking up tilts the view toward the rooftops instead of only lowering the camera.
      lookAt.y += Math.max(0, -s.pitch - 0.1) * 9;
      camera.up.set(0, 1, 0);
      if (action.active) {
        action.t += dt;
        const k = action.t / action.dur;
        if (k >= 1) action.active = false;
        else {
          // Snap in fast, hold, ease out.
          const w = k < 0.12 ? k / 0.12 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
          const e = w * w * (3 - 2 * w);
          // Keep the action camera out of walls too.
          toAction.subVectors(action.pos, action.focus);
          const dist = toAction.length();
          toAction.divideScalar(dist || 1);
          const wall = collision.raycast(action.focus, toAction, dist);
          const d = wall ? Math.max(0.8, wall.t - 0.3) : dist;
          blendPos.copy(action.focus).addScaledVector(toAction, d);
          blendPos.addScaledVector(toAction, k * 0.6);
          camera.position.lerp(blendPos, e);
          blendLook.copy(lookAt).lerp(action.focus, e);
          camera.lookAt(blendLook);
          camera.rotateZ(action.roll * e);
          const fov = s.baseFov + s.fovKick + s.hitKick - 12 * e;
          if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
          return;
        }
      }
      camera.lookAt(lookAt);
      const fov = s.baseFov + s.fovKick + s.hitKick;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
