// Third-person orbit camera with collision pull-in, per-mode framing, FOV kick and shake.
import * as THREE from 'three';

const MODES = {
  ground: { dist: 4.2, height: 1.55, side: 0.55, fov: 0 },
  sprint: { dist: 4.9, height: 1.5, side: 0.45, fov: 7 },
  glide: { dist: 7, height: 1.3, side: 0, fov: 12 },
  zip: { dist: 5.2, height: 1.4, side: 0.3, fov: 9 },
  combat: { dist: 5.8, height: 1.7, side: 0.2, fov: 3 },
  takedown: { dist: 2.6, height: 1.3, side: 0.9, fov: -8 },
};

export function createFollowCamera(camera, collision) {
  const s = {
    yaw: 0, pitch: 0.22, dist: 4.2, height: 1.55, side: 0.55, fovKick: 0,
    pivot: new THREE.Vector3(), shake: 0, baseFov: 60, sensitivity: 1, invertY: false, shakeEnabled: true,
    mode: 'ground',
  };
  const tmp = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let first = true;

  return {
    state: s,
    configure({ fov, sensitivity, invertY, cameraShake }) {
      s.baseFov = fov; s.sensitivity = sensitivity; s.invertY = invertY; s.shakeEnabled = cameraShake;
    },
    addShake(amount) { if (s.shakeEnabled) s.shake = Math.max(s.shake, amount); },
    forward(out = new THREE.Vector3()) { return out.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)); },
    right(out = new THREE.Vector3()) { return out.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw)); },
    lookDir(out = new THREE.Vector3()) { return camera.getWorldDirection(out); },
    snapBehind(yaw, pitch = 0.22) { s.yaw = yaw; s.pitch = pitch; first = true; },
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
      camera.lookAt(lookAt);
      const fov = s.baseFov + s.fovKick;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
