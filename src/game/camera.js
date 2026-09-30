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
  // Ground vehicles (Part V1): behind and low, with its own speed FOV kick below.
  drive: { dist: 7.2, height: 1.7, side: 0, fov: 4 },
  // Perch drop: the orbit numbers only matter for the hand-back; see DROP_UP below.
  drop: { dist: 5.5, height: 2.2, side: 0, fov: 8 },
  chain: { dist: 4.8, height: 1.6, side: 0.2, fov: 2 },
  remote: { dist: 2.4, height: 0.35, side: 0, fov: 8 },
  // The Batwing (Part V2): well back and well above so the whole delta-wing planform reads
  // (about a quarter to a third of the screen width in level flight), not a close-in tail shot.
  fly: { dist: 26, height: 9, side: 0, fov: 6 },
};

// Perch drop framing: the camera holds still off to the side of the drop, DROP_SIDE out from the
// line between the perch and the goon and DROP_UP above the perch, and turns to watch Batman
// plunge onto the goon. Following him down instead would put the camera inside the building or
// column the gargoyle sits on, and he would fall out of the bottom of the frame. Without a
// dropShot() it rises DROP_UP over the perch, DROP_BACK behind it.
const DROP_SIDE = 5, DROP_UP = 1, DROP_BACK = 1.2;
// The action camera's lowest point above the floor under it: where a shot is set up, and during it.
const ACTION_CLEAR = 1.0, ACTION_FLOOR = 0.6;

export function createFollowCamera(camera, collision) {
  const s = {
    yaw: 0, pitch: 0.22, dist: 4.2, height: 1.55, side: 0.55, fovKick: 0, hitKick: 0,
    pivot: new THREE.Vector3(), shake: 0, baseFov: 60, sensitivity: 1, invertY: false, shakeEnabled: true, actionEnabled: true,
    mode: 'ground',
    // Batwing bank: a slight roll with the plane's turn (src/vehicles/batwing.js calls setBank()
    // every flight frame; it self-clears the moment the mode isn't 'fly').
    bank: 0, bankTarget: 0,
  };
  const tmp = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const dir = new THREE.Vector3();
  let first = true;
  const action = { active: false, t: 0, dur: 1, focus: new THREE.Vector3(), pos: new THREE.Vector3(), roll: 0 };
  const blendPos = new THREE.Vector3(), blendLook = new THREE.Vector3(), toAction = new THREE.Vector3();
  const held = new THREE.Vector3(), up = new THREE.Vector3();
  const dropFrom = new THREE.Vector3(), dropTo = new THREE.Vector3();
  let holding = false, dropSet = false;

  return {
    state: s,
    // True while an action-shot camera swing (from a critical hit) is running.
    get actionActive() { return action.active; },
    configure({ fov, sensitivity, invertY, cameraShake, actionCam = true }) {
      s.baseFov = fov; s.sensitivity = sensitivity; s.invertY = invertY; s.shakeEnabled = cameraShake; s.actionEnabled = actionCam;
    },
    addShake(amount) { if (s.shakeEnabled) s.shake = Math.max(s.shake, amount); },
    // Batwing bank (radians); harmless when not flying, since update() zeroes the target itself.
    setBank(radians) { s.bankTarget = radians; },
    // A hit lands: a short FOV punch-in (narrower) that decays over about a tenth of a second.
    hitKick(amount = 3) { if (s.shakeEnabled) s.hitKick = Math.min(s.hitKick, -amount); },
    forward(out = new THREE.Vector3()) { return out.set(Math.sin(s.yaw), 0, Math.cos(s.yaw)); },
    right(out = new THREE.Vector3()) { return out.set(-Math.cos(s.yaw), 0, Math.sin(s.yaw)); },
    lookDir(out = new THREE.Vector3()) { return camera.getWorldDirection(out); },
    snapBehind(yaw, pitch = 0.22) { s.yaw = yaw; s.pitch = pitch; first = true; },
    // A perch drop is starting from `from` onto a goon at `to`: frame it from the side.
    dropShot(from, to) { dropFrom.copy(from); dropTo.copy(to); dropSet = true; },
    // Action shot for critical hits: the camera swings low and to the side of the blow,
    // tilts like a comic panel, then eases back. Player control of the orbit is untouched.
    // `rise` lifts the point it looks at above the blow (a shot that must also fit a standing
    // Batman over a goon lying on the floor).
    actionShot(focus, attacker, duration = 0.9, { dist = 3.2, lift = -0.55, back = 1.2, rise = 0 } = {}) {
      if (!s.actionEnabled) return;
      const dx = focus.x - attacker.x, dz = focus.z - attacker.z;
      const len = Math.hypot(dx, dz) || 1;
      // Pick the side of the attack line that's closer to where the camera already is.
      const px = -dz / len, pz = dx / len;
      const side = (camera.position.x - focus.x) * px + (camera.position.z - focus.z) * pz >= 0 ? 1 : -1;
      action.t = 0;
      action.dur = duration;
      action.focus.copy(focus).lerp(attacker, 0.35);
      action.focus.y = focus.y - 0.2 + rise;
      action.pos.set(action.focus.x + px * side * dist - (dx / len) * back, focus.y + lift, action.focus.z + pz * side * dist - (dz / len) * back);
      // A low blow (a goon lying down, a tied bundle) must not put the camera, or the point it
      // looks at, below the floor it happens on: the street or a rooftop.
      const top = Math.max(focus.y, attacker.y) + 1.5;
      const under = collision.groundBelow(action.pos.x, top, action.pos.z);
      if (action.pos.y < under + ACTION_CLEAR) action.pos.y = under + ACTION_CLEAR;
      const underFocus = collision.groundBelow(action.focus.x, top, action.focus.z);
      if (action.focus.y < underFocus + 0.25) action.focus.y = underFocus + 0.25;
      action.roll = side * 0.16;
      action.active = true;
    },
    update(dt, focus, look, mode = 'ground', speed = 0) {
      const m = MODES[mode] ?? MODES.ground;
      s.mode = mode;
      // Only the Batwing drives a bank; any other mode relaxes it back to level on its own.
      if (mode !== 'fly') s.bankTarget = 0;
      s.bank += (s.bankTarget - s.bank) * Math.min(1, dt * 5);
      s.yaw -= look.dx * 0.0022 * s.sensitivity;
      s.pitch += look.dy * 0.0022 * s.sensitivity * (s.invertY ? -1 : 1);
      s.pitch = THREE.MathUtils.clamp(s.pitch, -1.05, 1.25);
      // During a grapple zip the view levels out so the landing is framed.
      if (mode === 'zip') s.pitch += (0.35 - s.pitch) * Math.min(1, dt * 3);
      const k = 1 - Math.exp(-dt * 6);
      s.dist += (m.dist - s.dist) * k;
      s.height += (m.height - s.height) * k;
      s.side += (m.side - s.side) * k;
      const speedKick = mode === 'glide' ? Math.min(10, speed * 0.3) : mode === 'fly' ? Math.min(9, speed * 0.09) : mode === 'drive' ? Math.min(14, speed * 0.22) : 0;
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
      // Looking up tilts the view toward the rooftops instead of only lowering the camera. Skipped
      // in remote mode: its tight 2.4 m distance turns this fixed offset into a much steeper look
      // angle than the pitch alone (the batarang, steered by this same look direction, overshoots
      // anything it's aimed at from more than a few metres away).
      if (mode !== 'remote') lookAt.y += Math.max(0, -s.pitch - 0.1) * 9;
      if (mode === 'drop') {
        if (!holding) {
          // Once, when the drop starts; pulled in if a wall or roof is in the way.
          holding = true;
          if (dropSet) {
            const dx = dropTo.x - dropFrom.x, dz = dropTo.z - dropFrom.z, dl = Math.hypot(dx, dz) || 1;
            const px = -dz / dl, pz = dx / dl;
            const mx = (dropFrom.x + dropTo.x) / 2, mz = (dropFrom.z + dropTo.z) / 2;
            // The side of the drop the camera is already on.
            const side = (camera.position.x - mx) * px + (camera.position.z - mz) * pz >= 0 ? 1 : -1;
            held.set(mx, dropFrom.y + DROP_UP, mz);
            up.set(px * side, 0, pz * side);
            const wall = collision.raycast(held, up, DROP_SIDE + 0.3);
            held.addScaledVector(up, wall ? Math.max(0.8, wall.t - 0.3) : DROP_SIDE);
          } else {
            up.set(-fx * DROP_BACK, 4, -fz * DROP_BACK);
            const upLen = up.length();
            up.divideScalar(upLen);
            const roof = collision.raycast(focus, up, upLen + 0.3);
            held.copy(focus).addScaledVector(up, roof ? Math.max(0.8, roof.t - 0.3) : upLen);
          }
        }
        camera.position.copy(held);
        lookAt.set(focus.x, focus.y + 0.6, focus.z);
      } else { holding = false; dropSet = false; }
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
          const wall = collision.raycast(action.focus, toAction, dist + 0.6);
          // Stop short of whatever the ray hit: never push through it to keep a minimum distance.
          const d = wall ? Math.max(0.2, Math.min(dist + k * 0.6, wall.t - 0.3)) : dist + k * 0.6;
          blendPos.copy(action.focus).addScaledVector(toAction, d);
          // And never below the floor under where the camera ends up.
          const under = collision.groundBelow(blendPos.x, action.focus.y + 1.5, blendPos.z);
          if (blendPos.y < under + ACTION_FLOOR) blendPos.y = under + ACTION_FLOOR;
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
      if (Math.abs(s.bank) > 1e-4) camera.rotateZ(s.bank);
      const fov = s.baseFov + s.fovKick + s.hitKick;
      if (Math.abs(camera.fov - fov) > 0.05) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
