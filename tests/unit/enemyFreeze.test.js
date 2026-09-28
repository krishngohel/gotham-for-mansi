// Unit coverage for the freeze/dance state guards in src/actors/enemy.js. createEnemy's other
// dependency (createGoon) builds a full skinned character from real GLTF assets, so it's stubbed
// here: these tests exercise the real e.freeze/e.dance/e.thaw closures, just with a fake body.
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createRng } from '../../src/core/rng.js';

vi.mock('../../src/actors/characters.js', () => ({
  createGoon: () => ({
    root: new THREE.Group(),
    yaw: 0,
    face: () => {},
    animator: {
      // createEnemy primes the chain hold clips up front (Plan 4E, CHAIN_HOLD_CLIPS).
      prime: () => {},
      play: () => ({ time: 0, getClip: () => ({ duration: 1 }) }),
      update: () => {},
      mixer: { timeScale: 1 },
    },
    groundAt: null,
  }),
  footGround: () => () => 0,
  enemyPlantsFeet: () => false,
}));

const { createEnemy } = await import('../../src/actors/enemy.js');

function makeEnemy(type = 'grunt') {
  return createEnemy({
    id: 'x', type, assets: {}, scene: { add: () => {} }, collision: {}, rng: createRng(1),
  });
}

describe('e.freeze guards', () => {
  it('freezes a standing goon and leaves it thawable', () => {
    const e = makeEnemy();
    expect(e.freeze(1.5)).toBe(false); // not mid-attack
    expect(e.state).toBe('frozen');
    expect(e.frozenT).toBe(1.5);
    e.thaw();
    expect(e.state).not.toBe('frozen');
  });
  it('refuses an airborne goon and leaves its state unchanged', () => {
    const e = makeEnemy();
    e.air = true;
    const before = e.state;
    expect(e.freeze(1.5)).toBe(false);
    expect(e.state).toBe(before);
    expect(e.state).not.toBe('frozen');
    expect(e.frozenT).toBe(0);
  });
  it('refuses a downed goon and leaves its state unchanged', () => {
    const e = makeEnemy();
    e.down = true;
    const before = e.state;
    expect(e.freeze(1.5)).toBe(false);
    expect(e.state).toBe(before);
    expect(e.state).not.toBe('frozen');
    expect(e.frozenT).toBe(0);
  });
  it('refuses a tied goon (a chain owns it)', () => {
    const e = makeEnemy();
    e.tie([]);
    expect(e.state).toBe('tied');
    expect(e.freeze(1.5)).toBe(false);
    expect(e.state).toBe('tied');
    expect(e.frozenT).toBe(0);
  });
  it('refuses a chained goon (a chain owns it)', () => {
    const e = makeEnemy();
    e.chainHold();
    expect(e.state).toBe('chained');
    expect(e.freeze(1.5)).toBe(false);
    expect(e.state).toBe('chained');
    expect(e.frozenT).toBe(0);
  });
  it('refuses a dead goon or the boss', () => {
    const e = makeEnemy();
    e.alive = false;
    expect(e.freeze(1.5)).toBe(false);
    const boss = makeEnemy('joker');
    expect(boss.freeze(1.5)).toBe(false);
    expect(boss.state).not.toBe('frozen');
  });
});
