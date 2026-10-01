// tests/unit/sideVanChase.test.js
import { describe, it, expect } from 'vitest';
import { createVanChaseScheduler, vanChaseBlocked } from '../../src/game/sideVanChase.js';
import { pickSideVanRoute, SIDE_VAN_MIN, SIDE_VAN_MAX, LINES } from '../../src/vehicles/vehicles.js';

const fixed = (v) => ({ next: () => v, chance: (p) => v < p, range: (min, max) => min + (max - min) * v });

describe('van chase blocking rules', () => {
  const base = { mode: 'play', stepType: 'reach' };
  it('allows free roam and plain travel/collect steps', () => {
    expect(vanChaseBlocked(base)).toBe(false);
    expect(vanChaseBlocked({ ...base, stepType: 'collect' })).toBe(false);
    expect(vanChaseBlocked({ ...base, stepType: 'radio' })).toBe(false);
    expect(vanChaseBlocked({ ...base, stepType: 'credits' })).toBe(false);
  });
  it('blocks every story beat that touches a vehicle, a fight, the boss or a cutscene', () => {
    for (const stepType of ['fight', 'boss', 'cutscene', 'board', 'chase', 'battle', 'armada']) {
      expect(vanChaseBlocked({ ...base, stepType })).toBe(true);
    }
  });
  it('blocks while a vehicle mission is already running, in a menu, a challenge or photo mode', () => {
    expect(vanChaseBlocked({ ...base, vehicleBusy: true })).toBe(true);
    expect(vanChaseBlocked({ ...base, mode: 'cutscene' })).toBe(true);
    expect(vanChaseBlocked({ ...base, mode: 'dead' })).toBe(true);
    expect(vanChaseBlocked({ ...base, challenge: true })).toBe(true);
    expect(vanChaseBlocked({ ...base, photo: true })).toBe(true);
  });
});

describe('van chase scheduler', () => {
  it('waits at least 90s before the first attempt and tries by 210s at the latest', () => {
    const early = createVanChaseScheduler({ rng: fixed(0) });
    expect(early.update(89, {})).toBe(false);
    expect(early.update(1, {})).toBe(true);
    const late = createVanChaseScheduler({ rng: fixed(0.999) });
    expect(late.update(209, {})).toBe(false);
    expect(late.update(1, {})).toBe(true);
  });
  it('pauses the clock while blocked', () => {
    const s = createVanChaseScheduler({ rng: fixed(0) });
    expect(s.update(500, { blocked: true })).toBe(false);
    expect(s.update(89, {})).toBe(false);
    expect(s.update(1, {})).toBe(true);
  });
  it('keeps returning true until spawned() is told the result', () => {
    const s = createVanChaseScheduler({ rng: fixed(0) });
    s.update(90, {});
    expect(s.update(0.1, {})).toBe(true);
    expect(s.update(0.1, {})).toBe(true);
  });
  it('spaces the next try 90 to 210s after a successful spawn', () => {
    const s = createVanChaseScheduler({ rng: fixed(0.5) });
    s.update(90, {});
    s.spawned(true);
    expect(s.timer).toBeGreaterThanOrEqual(90);
    expect(s.timer).toBeLessThanOrEqual(210);
  });
  it('retries soon after a failed spawn attempt (no clear street found)', () => {
    const s = createVanChaseScheduler({ rng: fixed(0) });
    s.update(90, {});
    s.spawned(false);
    expect(s.timer).toBe(20);
  });
});

describe('side van route picking (pure)', () => {
  const alwaysClear = () => true;
  it('builds a short there-and-back route along the nearest street line, a few hundred metres off', () => {
    const route = pickSideVanRoute({ x: 0, z: 0 }, fixed(0.3), alwaysClear);
    expect(route).not.toBeNull();
    expect(route.path).toHaveLength(3);
    expect(route.path[0]).toEqual(route.path[2]); // there-and-back loop
    expect(route.spot).toEqual(route.path[0]);
    // Every point sits on one of the real street lines (the same ones street cars spawn on).
    for (const p of route.path) expect(LINES.includes(p.x) || LINES.includes(p.z)).toBe(true);
  });
  it('picks the axis whose line is actually closest to the hero', () => {
    // Nearest to (31, 500): x = 30 (an x-fixed, north-south line) beats any z line this far off.
    const route = pickSideVanRoute({ x: 31, z: 500 }, fixed(0.2), alwaysClear);
    expect(route.path.every((p) => p.x === 30)).toBe(true);
  });
  it('keeps the spawn point within SIDE_VAN_MIN..SIDE_VAN_MAX of the hero', () => {
    const near = { x: 0, z: 0 };
    const route = pickSideVanRoute(near, fixed(0.1), alwaysClear);
    const d = Math.hypot(route.spot.x - near.x, route.spot.z - near.z);
    expect(d).toBeGreaterThanOrEqual(SIDE_VAN_MIN - 1);
    expect(d).toBeLessThanOrEqual(SIDE_VAN_MAX + 1);
  });
  it('returns null when every tried spot is blocked (no clear street)', () => {
    const route = pickSideVanRoute({ x: 0, z: 0 }, fixed(0.3), () => false);
    expect(route).toBeNull();
  });
  it('retries a few times and succeeds once a later try is clear', () => {
    let calls = 0;
    // .every() short-circuits on the first blocked point, so the first 3 tries each fail fast
    // (one call apiece); the 4th try's 3 points all land clear.
    const groundOk = () => { calls += 1; return calls > 3; };
    const route = pickSideVanRoute({ x: 0, z: 0 }, fixed(0.3), groundOk, undefined, 4);
    expect(route).not.toBeNull();
    expect(calls).toBe(6);
  });
});
