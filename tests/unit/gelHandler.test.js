// Explosive gel (src/gadgets/g/gel.js) reads the fire key itself, so it has to know when not to:
// final review I4. Under a chain takedown, the Bat Swarm or a challenge countdown a tap must not
// spray (and play a pose over the chain clip) and a hold must not detonate.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createGelHandler } from '../../src/gadgets/g/gel.js';

function makeSys() {
  const sys = {
    hero: { pos: new THREE.Vector3(0, 0, 0), dead: false, control: null },
    state: { equipped: 'gel', ready: () => true, use: vi.fn() },
    wheelOpen: false,
    camera: { position: new THREE.Vector3(0, 2, -3) },
    // Straight ahead and a little down: a wall 5 m out.
    follow: { lookDir: (out) => out.set(0, -0.2, 1).normalize() },
    collision: { raycast: () => ({ t: 5, normal: { x: 0, y: 0, z: -1 } }), groundBelow: () => 0 },
    gfx: { gel: { place: vi.fn(() => 0), clear: vi.fn() }, debris: { burst: vi.fn() } },
    api: { areaBlast: vi.fn(() => 0) },
    effects: { gelRadius: 4 },
    breakables: { forNear: vi.fn() },
    fx: { impact: vi.fn() },
    events: { emit: vi.fn() },
    pose: vi.fn(),
    hint: vi.fn(),
  };
  sys.follow.addShake = vi.fn();
  return sys;
}
function makeInput() {
  const st = { down: false, pressed: false };
  return {
    st,
    input: { pressed: (a) => a === 'batarang' && st.pressed, down: (a) => a === 'batarang' && st.down },
  };
}
// One frame: `press` is a fresh press this frame, `hold` whether the key is down.
function frame(h, sys, inp, { press = false, hold = false, dt = 0.05 } = {}) {
  inp.st.pressed = press;
  inp.st.down = hold;
  h.update(sys, dt, dt, { input: inp.input });
}

describe('gel handler', () => {
  it('a tap sprays a blob and a hold sets it off (the normal case)', () => {
    const h = createGelHandler(), sys = makeSys(), inp = makeInput();
    frame(h, sys, inp, { press: true, hold: true });
    frame(h, sys, inp);
    expect(sys.gfx.gel.place).toHaveBeenCalledTimes(1);
    expect(h.placed).toBe(1);
    frame(h, sys, inp, { press: true, hold: true });
    for (let i = 0; i < 10; i++) frame(h, sys, inp, { hold: true });
    expect(sys.api.areaBlast).toHaveBeenCalledTimes(1);
    expect(h.placed).toBe(0);
  });

  for (const name of ['chain', 'swarm', 'countdown']) {
    it(`is inert under a ${name} control: a tap never sprays or poses, a hold never detonates`, () => {
      const h = createGelHandler(), sys = makeSys(), inp = makeInput();
      // One blob down before the chain starts.
      frame(h, sys, inp, { press: true, hold: true });
      frame(h, sys, inp);
      expect(h.placed).toBe(1);
      sys.pose.mockClear();
      sys.hero.control = { name, combat: name !== 'countdown', canChain: () => false };
      frame(h, sys, inp, { press: true, hold: true });
      frame(h, sys, inp);
      frame(h, sys, inp, { press: true, hold: true });
      for (let i = 0; i < 10; i++) frame(h, sys, inp, { hold: true });
      frame(h, sys, inp);
      expect(sys.gfx.gel.place).toHaveBeenCalledTimes(1);
      expect(sys.pose).not.toHaveBeenCalled();
      expect(sys.api.areaBlast).not.toHaveBeenCalled();
      expect(sys.hint).not.toHaveBeenCalled();
      expect(h.placed).toBe(1);
    });
  }

  it('a press that a chain cuts into is dropped, not sprayed when the key comes up', () => {
    const h = createGelHandler(), sys = makeSys(), inp = makeInput();
    frame(h, sys, inp, { press: true, hold: true });
    sys.hero.control = { name: 'chain', combat: true, canChain: () => false };
    frame(h, sys, inp, { hold: true });
    frame(h, sys, inp);
    sys.hero.control = null;
    frame(h, sys, inp);
    expect(sys.gfx.gel.place).not.toHaveBeenCalled();
  });
});
