import { describe, it, expect } from 'vitest';
import {
  STEALTH, inCone, inShadow, inRect, sightRange, canLook, spotCheck, fillRate, hears, footstepNoise, perchedOn,
  canSilentTakedown, pickSilentTarget, pickPerchDrop, smokeBlocks,
} from '../../src/stealth/vision.js';

const P = (x, y, z) => ({ x, y, z });
const goonAt = (x, z, yaw = 0, o = {}) => ({ pos: P(x, 0, z), yaw, hostile: false, ...o });
const heroAt = (x, z, o = {}) => ({ pos: P(x, o.y ?? 0, z), crouched: false, perched: false, hidden: false, flying: false, ...o });
const LIT = [{ x: 0, z: 10, r: 30 }];
const enemy = (id, x, z, yaw = 0, o = {}) => ({ id, alive: true, down: false, air: false, aware: false, stunned: false, state: 'patrol', def: {}, pos: P(x, o.y ?? 0, z), yaw, ...o });

describe('the vision cone', () => {
  it('is 70 degrees wide around the facing (yaw 0 faces +z)', () => {
    expect(inCone(P(0, 0, 0), 0, P(6.7, 0, 10))).toBe(true);   // 33.8 degrees off
    expect(inCone(P(0, 0, 0), 0, P(7.4, 0, 10))).toBe(false);  // 36.5 degrees off
    expect(inCone(P(0, 0, 0), Math.PI, P(0, 0, -5))).toBe(true);
    expect(inCone(P(0, 0, 0), 0, P(0, 0, -5))).toBe(false);
  });
});

describe('range, light and hiding', () => {
  it('25 m standing in the light, shorter in shadow and crouched', () => {
    expect(sightRange({})).toBe(25);
    expect(sightRange({ shadow: true })).toBeCloseTo(13.75);
    expect(sightRange({ crouched: true })).toBeCloseTo(15);
    expect(sightRange({ crouched: true, shadow: true })).toBeCloseTo(8.25);
  });
  it('shadow is outside every light pool', () => {
    const lights = [{ x: 0, z: 0, r: 4 }];
    expect(inShadow(P(3, 0, 0), lights)).toBe(false);
    expect(inShadow(P(5, 0, 0), lights)).toBe(true);
    expect(inShadow(P(5, 0, 0), [])).toBe(true);
  });
  it('inRect is the vent footprint at floor height', () => {
    const vent = { x: 10, y: 0, z: 10, w: 3, d: 3 };
    expect(inRect(P(11, 0.1, 9), vent)).toBe(true);
    expect(inRect(P(12, 0, 10), vent)).toBe(false);
    expect(inRect(P(10, 2, 10), vent)).toBe(false);
    expect(inRect(P(10, 0, 10), null)).toBe(false);
  });
});

describe('spotCheck', () => {
  it('sees Batman ahead in the light at 20 m but not at 26 m', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 20), LIT)).toBeCloseTo(20);
    expect(spotCheck(goonAt(0, 0), heroAt(0, 26), [{ x: 0, z: 26, r: 5 }])).toBe(-1);
  });
  it('shadow and crouching shorten the range', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 12), [])).toBeCloseTo(12);
    expect(spotCheck(goonAt(0, 0), heroAt(0, 12, { crouched: true }), [])).toBe(-1);
  });
  it('never sees behind itself', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, -5), LIT)).toBe(-1);
  });
  it('a hostile goon looks wider', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(8, 10), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(8, 10), LIT)).toBeGreaterThan(0);
  });
  it('goons that are not hostile never look up; hostile ones spot a perched Batman only within 6 m (3D)', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 6, { y: 4 }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0), heroAt(0, 4, { y: 4, perched: true }), LIT)).toBe(-1);
    // A low perch 4 m up and 4 m across (5.7 m away): a hostile goon sees him.
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(0, 4, { y: 4, perched: true }), LIT)).toBeGreaterThan(0);
    // A Monarch gargoyle 9.9 m up, only 3 m across: too far away in 3D, a safe perch.
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(0, 3, { y: 9.9, perched: true }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(1, 10, { y: 9, perched: true }), LIT)).toBe(-1);
  });
  it('the vent steam and a grapple in flight hide him completely', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 2, { hidden: true }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(0, 2, { flying: true }), LIT)).toBe(-1);
  });
});

describe('the awareness meter fill rate', () => {
  it('fills fast close up and slowly at the edge of the range', () => {
    expect(fillRate(0, 25)).toBeCloseTo(STEALTH.fill);
    expect(fillRate(25, 25)).toBeCloseTo(STEALTH.minFill);
    expect(fillRate(50, 25)).toBeCloseTo(STEALTH.minFill);
    expect(fillRate(5, 25)).toBeGreaterThan(fillRate(15, 25));
  });
});

describe('noise', () => {
  it('carries its radius across and 5 m up or down', () => {
    expect(hears(P(0, 0, 0), P(4, 0, 0), 5)).toBe(true);
    expect(hears(P(0, 0, 0), P(6, 0, 0), 5)).toBe(false);
    expect(hears(P(0, 0, 0), P(0, 6, 0), 5)).toBe(false);
  });
  it('footsteps: silent crouched, 5 m walking, 9 m sprinting', () => {
    expect(footstepNoise({ crouched: true, sprint: true })).toBe(0);
    expect(footstepNoise({})).toBe(5);
    expect(footstepNoise({ sprint: true })).toBe(9);
  });
});

describe('perches', () => {
  const perches = [{ x: 0, y: 10, z: 0, perch: true }, { x: 5, y: 10, z: 0 }];
  it('finds the perch Batman stands on', () => {
    expect(perchedOn(P(0.5, 10, 0), perches)).toBe(perches[0]);
    expect(perchedOn(P(5, 10, 0), perches)).toBe(null);
    expect(perchedOn(P(0.5, 11, 0), perches)).toBe(null);
    expect(perchedOn(P(2, 10, 0), perches)).toBe(null);
  });
});

describe('canLook', () => {
  it('is false while a goon is hit, down, held, frozen, dancing or out', () => {
    expect(canLook(enemy('a', 0, 0))).toBe(true);
    for (const state of ['hit', 'stunned', 'down', 'getup', 'grabbed', 'chained', 'tied', 'frozen', 'dance', 'ko']) {
      expect(canLook(enemy('a', 0, 0, 0, { state })), state).toBe(false);
    }
    expect(canLook(enemy('a', 0, 0, 0, { stunned: true }))).toBe(false);
    expect(canLook(enemy('a', 0, 0, 0, { alive: false }))).toBe(false);
  });
});

describe('the silent takedown', () => {
  const H = P(0, 0, 0);
  it('works within 1.6 m from behind on a goon that has not noticed Batman', () => {
    expect(canSilentTakedown(enemy('g', 0, 1), H)).toBe(true);
    expect(canSilentTakedown(enemy('g', 0, 1, Math.PI), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, Math.PI / 2), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 2), H)).toBe(false);
  });
  it('not on aware goons, the boss, another floor, or anyone held', () => {
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { aware: true }), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { def: { boss: true } }), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { y: 1 }), H)).toBe(false);
    for (const state of ['grabbed', 'chained', 'tied', 'frozen']) expect(canSilentTakedown(enemy('g', 0, 1, 0, { state }), H), state).toBe(false);
  });
  it('a searching goon (yellow, not aware) can still be taken from behind', () => {
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { state: 'search' }), H)).toBe(true);
  });
  it('picks the closest one', () => {
    const list = [enemy('far', 0, 1.5), enemy('near', 0, 0.9), enemy('facing', 0.2, 0.8, Math.PI)];
    expect(pickSilentTarget(H, list).id).toBe('near');
    expect(pickSilentTarget(H, [enemy('x', 0, 3)])).toBe(null);
  });
});

describe('the perch drop', () => {
  const perch = P(0, 9, 0);
  it('drops on the nearest goon within 5 m across and 1.5 to 14 m below', () => {
    const list = [enemy('a', 3, 1), enemy('b', 1, 1), enemy('c', 6, 0), enemy('high', 0.5, 0, 0, { y: 8 }), enemy('deep', 0.5, 0.5, 0, { y: -6 })];
    expect(pickPerchDrop(perch, list).id).toBe('b');
    expect(pickPerchDrop(perch, [list[2], list[3], list[4]])).toBe(null);
  });
  it('works on hostile goons too, but never the boss or a held goon', () => {
    expect(pickPerchDrop(perch, [enemy('a', 1, 0, 0, { aware: true })]).id).toBe('a');
    expect(pickPerchDrop(perch, [enemy('j', 1, 0, 0, { def: { boss: true } })])).toBe(null);
    expect(pickPerchDrop(perch, [enemy('t', 1, 0, 0, { state: 'tied' })])).toBe(null);
  });
});

describe('allocation-free runtime', () => {
  it('spotCheck gives consistent results across repeated calls (allocation-free)', () => {
    const goon = goonAt(0, 0);
    const hero = heroAt(0, 20);
    const lights = LIT;
    const result1 = spotCheck(goon, hero, lights);
    const result2 = spotCheck(goon, hero, lights);
    const result3 = spotCheck(goon, hero, lights);
    expect(result1).toBeCloseTo(20);
    expect(result2).toBeCloseTo(20);
    expect(result3).toBeCloseTo(20);
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });
});

describe('smoke', () => {
  const cloud = { x: 0, y: 0, z: 10, r: 2.5 };
  const eye = P(0, 1.6, 0);
  const toward = (x, y, z) => { const dx = x - eye.x, dy = y - eye.y, dz = z - eye.z, l = Math.hypot(dx, dy, dz); return [{ x: dx / l, y: dy / l, z: dz / l }, l]; };
  it('hides Batman standing in the cloud and anyone behind it', () => {
    expect(smokeBlocks(eye, ...toward(0, 1.1, 10), cloud)).toBe(true);
    expect(smokeBlocks(eye, ...toward(0, 1.1, 16), cloud)).toBe(true);
  });
  it('does not hide someone off to the side, or in front of it', () => {
    expect(smokeBlocks(eye, ...toward(6, 1.1, 10), cloud)).toBe(false);
    expect(smokeBlocks(eye, ...toward(0, 1.1, 5), cloud)).toBe(false);
  });
});
