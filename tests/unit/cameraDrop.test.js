import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createFollowCamera } from '../../src/game/camera.js';

const NO_LOOK = { dx: 0, dy: 0 };
// A wall of the building the gargoyle stands on: everything west of x = 0 below y = 10 is solid.
const collision = {
  raycast(from, dir, len) {
    if (dir.x >= 0 || from.x < 0) return null;
    const t = -from.x / dir.x;
    if (t > len) return null;
    const y = from.y + dir.y * t;
    return y < 10 ? { t } : null;
  },
};

function dropFrames(shot) {
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 500);
  const follow = createFollowCamera(cam, collision);
  follow.snapBehind(Math.PI / 2, 0.45); // looking east, off the roof edge
  const focus = new THREE.Vector3(0.3, 10.9, 0);
  for (let i = 0; i < 30; i++) follow.update(1 / 60, focus, NO_LOOK, 'ground');
  if (shot) follow.dropShot(focus, new THREE.Vector3(3, 1.9, 0));
  return { cam, follow, focus, start: cam.position.clone() };
}

describe('the perch drop camera', () => {
  for (const shot of [true, false]) it(`keeps Batman in frame all the way down (${shot ? 'side shot' : 'no dropShot: over the perch'})`, () => {
    const { cam, follow, focus, start } = dropFrames(shot);
    const ndc = new THREE.Vector3();
    for (let i = 0; i <= 40; i++) {
      // Down 9 m and 2.7 m east over 0.65 s, like the Monarch Balcony drop.
      const k = i / 40;
      focus.set(0.3 + 2.7 * k, 10.9 - 9 * k * k, 0);
      follow.update(1 / 60, focus, NO_LOOK, 'drop');
      cam.updateMatrixWorld();
      ndc.copy(focus).setY(focus.y + 0.9).project(cam);
      expect(Math.abs(ndc.x), `frame ${i}`).toBeLessThan(0.9);
      expect(Math.abs(ndc.y), `frame ${i}`).toBeLessThan(0.9);
      expect(cam.position.x < 0 && cam.position.y < 10, 'never inside the building').toBe(false);
    }
    if (!shot) expect(cam.position.y).toBeGreaterThan(start.y);
  });
  it('the side shot sits off the drop line, out over the balcony', () => {
    const { cam, follow, focus } = dropFrames(true);
    follow.update(1 / 60, focus, NO_LOOK, 'drop');
    expect(Math.abs(cam.position.z)).toBeCloseTo(5, 1);
    expect(cam.position.x).toBeGreaterThan(0);
  });
});
