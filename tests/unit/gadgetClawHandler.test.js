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

// Final review I3: combat hands the fire key to the gadget whenever Batman is "free", which
// includes a strike in its chain window. The claw is built for exactly that moment.
describe('claw gadget handler: mid-combo and railings', () => {
  it('fires during a strike chain window instead of refusing with "plant your feet"', () => {
    const goon = makeGoon();
    const sys = makeSys([goon]);
    sys.hint = vi.fn();
    sys.hero.control = { name: 'strike', combat: true, canChain: () => true, update: () => false };
    expect(createClawHandler().fire(sys)).toBe(true);
    expect(goon.state).toBe('down');
    expect(sys.hint).not.toHaveBeenCalled();
  });
  it('still refuses under a move that cannot be cut (outside the chain window, a chain takedown)', () => {
    for (const control of [
      { name: 'strike', combat: true, canChain: () => false },
      { name: 'chain', combat: true, canChain: () => false },
      { name: 'ladder' },
    ]) {
      const goon = makeGoon();
      const sys = makeSys([goon]);
      sys.hint = vi.fn();
      sys.hero.control = control;
      expect(createClawHandler().fire(sys)).toBe(false);
      expect(goon.state).toBe('engage');
      expect(sys.hint).toHaveBeenCalledWith('claw-ground');
    }
  });
  it('tearing down a railing launches goons standing at it, never frozen, tied, chained or held ones', () => {
    const launched = [];
    const at = (id, state) => ({ ...makeGoon({ id, state }), pos: new THREE.Vector3(0, 0, 10), launch() { launched.push(this.id); } });
    const goons = [at('free', 'engage'), at('ice', 'frozen'), at('rope', 'tied'), at('held', 'chained'), at('grab', 'grabbed')];
    const sys = makeSys(goons);
    sys.api.canSee = () => false; // no goon to yank: the claw goes for the railing
    const rail = { kind: 'railing', bounds: { minX: -1, maxX: 1, minY: 0, maxY: 1, minZ: 9, maxZ: 10 }, normal: { nx: 0, nz: 1 }, center: new THREE.Vector3(0, 0.5, 9.5) };
    sys.breakables = { aimed: () => rail, smash: vi.fn() };
    expect(createClawHandler().fire(sys)).toBe(true);
    expect(launched).toEqual(['free']);
    expect(sys.api.director.release).toHaveBeenCalledTimes(1);
    expect(sys.breakables.smash).toHaveBeenCalledWith(rail, sys.hero.pos);
  });
});
