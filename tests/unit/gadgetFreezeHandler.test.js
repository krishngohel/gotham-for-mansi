// Unit coverage for src/gadgets/g/freeze.js's own frozen[] bookkeeping (not enemy.js's freeze
// guards, covered by enemyFreeze.test.js). Regression test for the leak found in task-25's fix
// round 2 review: a goon despawned (removed from combat.enemies) while still in state 'frozen'
// never has its ice slot released, because the old update() only checked `f.e.state === 'frozen'`
// and a despawned enemy is never ticked again, so its state never changes away from 'frozen'.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createFreezeHandler } from '../../src/gadgets/g/freeze.js';

function makeGoon(overrides = {}) {
  return {
    id: 'e1', pos: new THREE.Vector3(0, 0, 10), alive: true, def: { boss: false }, down: false, air: false,
    state: 'idle', shattered: false,
    freeze(t) { this.state = 'frozen'; this.frozenT = t; return true; },
    ...overrides,
  };
}

// A minimal `sys` good enough for freeze.js's fire(): a goon dead ahead, in range and angle, with
// gfx.ice.throw calling its onHit callback synchronously (as if the grenade had already landed).
function makeSys(enemies, release) {
  return {
    hero: { pos: { x: 0, y: 0, z: 0 }, bat: { bone: () => ({ getWorldPosition: () => {} }) } },
    api: { canSee: () => true, faceTo: () => {}, director: { release: () => {} } },
    effects: { freezeTime: 5 },
    follow: { lookDir: (out) => { out.x = 0; out.y = 0; out.z = 1; } },
    pose: () => {},
    combat: { enemies },
    gfx: { ice: { throw: (from, getTarget, onHit) => onHit(), attach: () => 0, release } },
    events: { emit: () => {} },
  };
}

describe('freeze gadget handler: frozen[] bookkeeping', () => {
  it('releases the ice slot once the goon thaws normally (state leaves frozen, still enemies-listed)', () => {
    const goon = makeGoon();
    const release = vi.fn();
    const enemies = [goon];
    const sys = makeSys(enemies, release);
    const handler = createFreezeHandler();
    expect(handler.fire(sys)).toBe(true);
    expect(goon.state).toBe('frozen');
    handler.update(sys); // still frozen and still listed: no release yet
    expect(release).not.toHaveBeenCalled();
    goon.state = 'idle'; // thaw.js would set this
    handler.update(sys);
    expect(release).toHaveBeenCalledWith(0, goon.shattered);
  });

  it('releases the ice slot when the frozen goon is despawned (dropped from combat.enemies) even though its state never changes', () => {
    const goon = makeGoon();
    const release = vi.fn();
    const enemies = [goon];
    const sys = makeSys(enemies, release);
    const handler = createFreezeHandler();
    expect(handler.fire(sys)).toBe(true);
    expect(goon.state).toBe('frozen');
    // A checkpoint restart / encounter despawn while frozen: the goon's mesh and combat entry are
    // gone, but nothing ever thaws a despawned enemy, so its state stays 'frozen' forever.
    enemies.length = 0;
    handler.update(sys);
    expect(release).toHaveBeenCalledWith(0, goon.shattered);
  });
});
