// Unit coverage for src/gadgets/g/claw.js's clawYank event. Regression test for a bug found while
// verifying task-26's browser check: e.yank(to) in enemy.js always performs the yank (the goon
// flies in and goes down); its return value only says whether the goon was mid-attack, so the
// caller knows to release its director slot. The old fire() used that same return value to gate
// yankedAny, so clawYank (the "claw" sound, the "YOINK!" word) only fired when the goon happened
// to already be windup/attack, staying silent for the ordinary case of clawing an engaging goon.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createClawHandler } from '../../src/gadgets/g/claw.js';

function makeGoon(overrides = {}) {
  return {
    id: 'e1', pos: new THREE.Vector3(0, 0, 5), alive: true, def: { boss: false, armored: false }, down: false, air: false,
    state: 'engage', stunned: false,
    // Mirrors enemy.js's e.yank: always performs the yank, returns whether it interrupted an attack.
    yank(_to) {
      const was = this.state === 'windup' || this.state === 'attack';
      this.state = 'down';
      this.down = true;
      return was;
    },
    ...overrides,
  };
}

// A minimal `sys` good enough for claw.js's fire(): a goon dead ahead, in range and angle.
function makeSys(enemies) {
  return {
    hero: { pos: { x: 0, y: 0, z: 0 }, state: 'ground', control: null, bat: { face: () => {} } },
    api: { canSee: () => true, landHit: vi.fn(), director: { release: vi.fn() } },
    effects: { clawTargets: 1 },
    follow: { lookDir: (out) => { out.x = 0; out.y = 0; out.z = 1; } },
    pose: () => {},
    combat: { enemies },
    events: { emit: vi.fn() },
  };
}

describe('claw gadget handler: clawYank', () => {
  it('fires clawYank when a goon that was not mid-attack gets yanked', () => {
    const goon = makeGoon({ state: 'engage' });
    const sys = makeSys([goon]);
    const handler = createClawHandler();
    expect(handler.fire(sys)).toBe(true);
    expect(goon.state).toBe('down'); // the yank happened
    expect(sys.events.emit).toHaveBeenCalledWith('clawYank', { count: 1 });
    expect(sys.api.director.release).not.toHaveBeenCalled(); // wasn't mid-attack: nothing to release
  });

  it('still fires clawYank, and releases the director slot, when the goon was mid-attack', () => {
    const goon = makeGoon({ state: 'attack' });
    const sys = makeSys([goon]);
    const handler = createClawHandler();
    expect(handler.fire(sys)).toBe(true);
    expect(sys.events.emit).toHaveBeenCalledWith('clawYank', { count: 1 });
    expect(sys.api.director.release).toHaveBeenCalledWith('e1');
  });
});
