// Party popper (src/gadgets/g/popper.js): final review I3 (it throws mid-combo, replacing a strike
// in its chain window) and M4 (the pop lands 0.35 s after the throw, so a chain begun in between
// keeps its goons out of the dance).
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createPopperHandler } from '../../src/gadgets/g/popper.js';

function goon(id, x, z, o = {}) {
  return { id, alive: true, def: { boss: false }, down: false, state: 'engage', pos: new THREE.Vector3(x, 0, z), dance: vi.fn(() => false), ...o };
}
function makeSys(enemies) {
  return {
    hero: { pos: new THREE.Vector3(0, 0, 0), state: 'ground', control: null },
    follow: { forward: (v) => v.set(0, 0, 1), right: (v) => v.set(-1, 0, 0), state: { pitch: 0 } },
    collision: { groundBelow: () => 0 },
    gfx: { confetti: { burst: vi.fn(), letters: vi.fn() } },
    api: { landHit: vi.fn(), director: { release: vi.fn() } },
    combat: { enemies },
    fx: { impact: vi.fn() },
    events: { emit: vi.fn() },
    pose: vi.fn(),
    hint: vi.fn(),
  };
}

describe('party popper handler', () => {
  it('throws mid-combo: a strike in its chain window counts as free', () => {
    const sys = makeSys([]);
    sys.hero.control = { name: 'strike', combat: true, canChain: () => true };
    expect(createPopperHandler().fire(sys)).toBe(true);
    expect(sys.pose).toHaveBeenCalledWith('OverhandThrow', 0.4, 1.6);
    expect(sys.hint).not.toHaveBeenCalled();
  });
  it('refuses under a move that cannot be cut', () => {
    const sys = makeSys([]);
    sys.hero.control = { name: 'strike', combat: true, canChain: () => false };
    expect(createPopperHandler().fire(sys)).toBe(false);
    expect(sys.hint).toHaveBeenCalledWith('popper-ground');
  });
  it('the delayed pop skips goons a chain takedown grabbed after the throw', () => {
    const free = goon('a', 0, 5), held = goon('b', 1, 5);
    const sys = makeSys([free, held]);
    const h = createPopperHandler();
    expect(h.fire(sys)).toBe(true);
    held.state = 'chained';
    for (let i = 0; i < 30; i++) h.update(sys, 0.016, 0.016);
    expect(sys.api.landHit).toHaveBeenCalledTimes(1);
    expect(sys.api.landHit).toHaveBeenCalledWith('popper', free);
    expect(held.dance).not.toHaveBeenCalled();
    expect(sys.events.emit).toHaveBeenCalledWith('popper', expect.objectContaining({ count: 1 }));
  });
});
