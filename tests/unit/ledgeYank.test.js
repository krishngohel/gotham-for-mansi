import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createLedgeControl, ledgeYankSpeed, YANK_UP } from '../../src/actors/traverse/ledge.js';

// A ledge along z at x = 206 whose outward normal points east (+x), like the Monarch Balcony edge.
const ledge = () => ({ x: 206, y: 13, z: -70, nx: 1, nz: 0, axis: 'z', min: -78, max: -42 });

// Flies a goon launched from `pos` with velocity v under enemy gravity (24) until it is back at
// its start height; returns where it is then.
function landX(pos, v) {
  const t = (2 * v.y) / 24;
  return pos.x + v.x * t;
}

describe('ledgeYankSpeed', () => {
  it('throws a goon far enough out to clear the edge and its ground probe', () => {
    for (const x of [205.9, 205.3, 204.6]) {
      const pos = { x, y: 13, z: -70 };
      const out = ledgeYankSpeed(ledge(), pos);
      expect(landX(pos, { x: out, y: YANK_UP })).toBeGreaterThan(206 + 0.3);
    }
  });
  it('never yanks slower than the old 3 m/s', () => {
    expect(ledgeYankSpeed(ledge(), { x: 207, y: 13, z: -70 })).toBe(3);
  });
});

describe('ledge takedown', () => {
  it('sends the goon out over the edge, not back onto the deck', () => {
    const goon = {
      alive: true, down: false, aware: false, air: false, def: {}, state: 'patrol',
      pos: new THREE.Vector3(205.3, 13, -70), vel: new THREE.Vector3(),
      launch(vx, vy, vz) { this.air = true; this.vel.set(vx, vy, vz); },
    };
    const h = {
      pos: new THREE.Vector3(206.4, 11, -70), vel: new THREE.Vector3(), grounded: false,
      cape: { setWings() {} },
      bat: { tilt: { rotation: { set() {} } }, animator: { play() {} }, face() {} },
      setState() {},
      combat: {
        enemies: [goon], consumeInput() {},
        // Like combatSystem.takedown: the KO knocks an airborne goon away from Batman.
        takedown(e) {
          e.alive = false;
          const dx = e.pos.x - h.pos.x, dz = e.pos.z - h.pos.z, d = Math.hypot(dx, dz) || 1;
          if (e.air) e.launch((dx / d) * 4, 4, (dz / d) * 4);
          return true;
        },
      },
    };
    const ctl = createLedgeControl(h, { collision: {}, events: { emit() {} } }, { ledge: ledge() });
    const idle = { input: { pressed: () => false, move: { x: 0, y: 0 } }, cam: {} };
    ctl.update(0.2, idle);
    ctl.update(0.016, { input: { pressed: (a) => a === 'punch', move: { x: 0, y: 0 } }, cam: {} });
    expect(goon.alive).toBe(false);
    expect(goon.vel.x).toBeGreaterThan(0);
    expect(landX(goon.pos, goon.vel)).toBeGreaterThan(206.3);
  });
});
