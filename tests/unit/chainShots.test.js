// tests/unit/chainShots.test.js: the chain finishers' action camera frames what matters.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFollowCamera } from '../../src/game/camera.js';
import { CHAIN_SHOTS } from '../../src/combat/chainControl.js';

// Runs a shot of `dur` seconds to the middle of its hold and returns the camera.
function shoot(focus, attacker, shot, dur = 1.25, yaw = 0.7) {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const follow = createFollowCamera(camera, { raycast: () => null });
  follow.state.yaw = yaw;
  const look = { dx: 0, dy: 0 };
  for (let f = 0; f < 60; f++) follow.update(1 / 60, attacker, look, 'chain');
  follow.actionShot(focus, attacker, dur, shot);
  for (let t = 0; t < dur * 0.4; t += 1 / 60) follow.update(1 / 60, attacker, look, 'chain');
  camera.updateMatrixWorld(true);
  return camera;
}
const ndc = (camera, x, y, z) => new THREE.Vector3(x, y, z).project(camera);

describe('chain finisher shots', () => {
  it('Domino Drop fits Batman standing in the pile, with headroom, and the goons around him', () => {
    // Batman lands at the origin; the goon the shot is aimed at lies 1 m away (chest near the floor).
    for (const yaw of [0, 0.7, 2, -2.5]) {
      const cam = shoot(new THREE.Vector3(1, 0.1, 0), new THREE.Vector3(0, 0, 0), CHAIN_SHOTS.domino, 1.25, yaw);
      const head = ndc(cam, 0, 1.95, 0), feet = ndc(cam, 0, 0, 0);
      expect(head.y, `yaw ${yaw}`).toBeLessThan(0.8);
      expect(feet.y, `yaw ${yaw}`).toBeGreaterThan(-0.9);
      for (const p of [head, feet, ndc(cam, 1, 0.1, 0), ndc(cam, -0.8, 0.1, 0.6)]) expect(Math.abs(p.x), `yaw ${yaw}`).toBeLessThan(0.9);
    }
  });

  it('the KAPOW that breaks a tied bundle looks down on it from above the floor, bodies in frame', () => {
    for (const yaw of [0, 0.7, 2, -2.5]) {
      const cam = shoot(new THREE.Vector3(3, 0.05, 0), new THREE.Vector3(1.8, 0, 0), CHAIN_SHOTS.kapow, 0.95, yaw);
      expect(cam.position.y, `yaw ${yaw}`).toBeGreaterThan(0.8);
      // The bundle is thrown up to about 1.2 m.
      for (const y of [0, 1.2]) {
        const p = ndc(cam, 3, y, 0);
        expect(Math.abs(p.x), `yaw ${yaw}`).toBeLessThan(0.9);
        expect(Math.abs(p.y), `yaw ${yaw}`).toBeLessThan(0.85);
      }
    }
  });
});
