// tests/unit/actionFloor.test.js: the critical-hit action camera never sinks into the floor.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFollowCamera } from '../../src/game/camera.js';
import { createCollision } from '../../src/world/collision.js';

// A 40 m wide rooftop whose surface is at y 42, like the GCPD roof.
function roofWorld() {
  const collision = createCollision();
  collision.addBox(-20, 0, -20, 20, 42, 20);
  return collision;
}

// Plays a whole action shot and returns the lowest the camera got above the roof surface.
function lowestClearance(focusY, yaw) {
  const collision = roofWorld();
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const follow = createFollowCamera(camera, collision);
  follow.state.yaw = yaw;
  const hero = new THREE.Vector3(0, 42, 0);
  const look = { dx: 0, dy: 0 };
  for (let f = 0; f < 60; f++) follow.update(1 / 60, hero, look);
  follow.actionShot(new THREE.Vector3(1.4, focusY, 0.3), hero.clone(), 0.9);
  let low = Infinity;
  for (let t = 0; t < 1; t += 1 / 60) {
    follow.update(1 / 60, hero, look);
    low = Math.min(low, camera.position.y - 42);
  }
  return low;
}

describe('action camera and the floor', () => {
  for (const yaw of [0, 0.7, 2, -2.5]) {
    it(`a blow on a goon lying on the roof keeps the camera above it (yaw ${yaw})`, () => {
      expect(lowestClearance(42.3, yaw)).toBeGreaterThan(0.5);
    });
    it(`a blow on a standing goon keeps a comfortable height (yaw ${yaw})`, () => {
      expect(lowestClearance(43.25, yaw)).toBeGreaterThan(0.5);
    });
  }
});
