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

describe('melee reach is on one level', () => {
  it('a melee goon does not wind up at Batman perched high above it; a rifle goon still can', () => {
    const e = makeEnemy('grunt');
    e.engageNow();
    const below = { pos: new THREE.Vector3(0.5, 0, 1) }, above = { pos: new THREE.Vector3(0.5, 9.9, 1) };
    expect(e.ready(below)).toBe(true);
    expect(e.ready(above)).toBe(false);
    const r = makeEnemy('rifle');
    r.engageNow();
    r.seesHero = true;
    expect(r.ready(above)).toBe(true);
  });
});

describe('getting up', () => {
  it('an unaware goon that gets up wakes once and is steerable again (a predator room sends it looking)', () => {
    const e = createEnemy({
      id: 'g', type: 'grunt', assets: {}, scene: { add: () => {} }, rng: createRng(1),
      collision: { resolveCylinder: () => ({ groundY: 0 }), groundBelow: () => 0 },
    });
    let woke = 0;
    e.wake = () => { woke += 1; };
    e.down = true;
    e.state = 'getup';
    e.t = 1.5;
    const ctx = { hero: { pos: new THREE.Vector3(5, 0, 5) }, others: [e] };
    e.update(0.016, ctx);
    e.update(0.016, ctx);
    expect(e.down).toBe(false);
    expect(woke).toBe(1);
    expect(e.canNav()).toBe(true);
  });
});
