import { describe, it, expect } from 'vitest';
import { stepDrive, driveVelocity, bounceOffWall, createRamCounter, mergeTuning, DEFAULT_TUNING, findClearGroundSpot, damageArmor, stepArmor, stepLane } from '../../src/vehicles/vehiclePhysics.js';

const T = DEFAULT_TUNING;

describe('stepDrive (arcade car physics)', () => {
  it('accelerates forward under throttle', () => {
    const v = { speed: 0, yaw: 0, drift: 0 };
    stepDrive(v, { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false }, 0.1, T);
    expect(v.speed).toBeGreaterThan(0);
    expect(v.speed).toBeCloseTo(T.accel * 0.1, 5);
  });

  it('boost accelerates faster and raises the top speed', () => {
    const plain = { speed: 0, yaw: 0, drift: 0 };
    const boosted = { speed: 0, yaw: 0, drift: 0 };
    for (let i = 0; i < 200; i++) {
      stepDrive(plain, { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false }, 1 / 60, T);
      stepDrive(boosted, { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: true }, 1 / 60, T);
    }
    expect(boosted.speed).toBeGreaterThan(plain.speed);
    expect(plain.speed).toBeLessThanOrEqual(T.maxSpeed + 1e-6);
    expect(boosted.speed).toBeLessThanOrEqual(T.maxBoostSpeed + 1e-6);
  });

  it('brakes a moving car toward a stop, then reverses', () => {
    const v = { speed: 10, yaw: 0, drift: 0 };
    for (let i = 0; i < 30; i++) stepDrive(v, { throttle: 0, brake: 1, steer: 0, handbrake: false, boost: false }, 1 / 60, T);
    expect(v.speed).toBeLessThan(0);
    expect(v.speed).toBeGreaterThanOrEqual(-T.maxReverse - 1e-6);
  });

  it('coasts to rest under drag with no input', () => {
    const v = { speed: 8, yaw: 0, drift: 0 };
    for (let i = 0; i < 600; i++) stepDrive(v, { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false }, 1 / 60, T);
    expect(Math.abs(v.speed)).toBeLessThan(0.05);
  });

  it('does not turn while stationary', () => {
    const v = { speed: 0, yaw: 0.4, drift: 0 };
    stepDrive(v, { throttle: 0, brake: 0, steer: 1, handbrake: false, boost: false }, 0.5, T);
    expect(v.yaw).toBeCloseTo(0.4, 5);
  });

  it('turns while moving, and steering flips sign in reverse', () => {
    const fwd = { speed: 8, yaw: 0, drift: 0 };
    stepDrive(fwd, { throttle: 0, brake: 0, steer: 1, handbrake: false, boost: false }, 0.2, T);
    expect(fwd.yaw).toBeGreaterThan(0);
    const rev = { speed: -8, yaw: 0, drift: 0 };
    stepDrive(rev, { throttle: 0, brake: 0, steer: 1, handbrake: false, boost: false }, 0.2, T);
    expect(rev.yaw).toBeLessThan(0);
  });

  it('builds drift under handbrake + steer, and decays once released', () => {
    const v = { speed: 12, yaw: 0, drift: 0 };
    for (let i = 0; i < 30; i++) stepDrive(v, { throttle: 0, brake: 0, steer: 1, handbrake: true, boost: false }, 1 / 60, T);
    expect(Math.abs(v.drift)).toBeGreaterThan(0.3);
    const held = v.drift;
    for (let i = 0; i < 120; i++) stepDrive(v, { throttle: 1, brake: 0, steer: 0, handbrake: false, boost: false }, 1 / 60, T);
    expect(Math.abs(v.drift)).toBeLessThan(Math.abs(held));
    expect(Math.abs(v.drift)).toBeLessThan(0.05);
  });

  it('is frame-rate independent: a coarse step tracks a fine one over one second', () => {
    const tuning = mergeTuning({ drag: 0.6 });
    const input = { throttle: 1, brake: 0, steer: 0.6, handbrake: false, boost: false };
    // 10 fps vs 120 fps over the same one second of simulated time.
    const coarse = { speed: 0, yaw: 0, drift: 0 };
    for (let i = 0; i < 10; i++) stepDrive(coarse, input, 1 / 10, tuning);
    const fine = { speed: 0, yaw: 0, drift: 0 };
    for (let i = 0; i < 120; i++) stepDrive(fine, input, 1 / 120, tuning);
    expect(coarse.speed).toBeCloseTo(fine.speed, 0);
    expect(Math.abs(coarse.yaw - fine.yaw)).toBeLessThan(0.06);
  });
});

describe('driveVelocity', () => {
  it('matches forward heading when there is no drift', () => {
    const out = driveVelocity({ speed: 10, yaw: 0, drift: 0 }, T);
    expect(out.x).toBeCloseTo(0, 5);
    expect(out.z).toBeCloseTo(10, 5);
  });

  it('adds a sideways component when drifting', () => {
    const out = driveVelocity({ speed: 10, yaw: 0, drift: 0.5 }, T);
    expect(Math.abs(out.x)).toBeGreaterThan(0.5);
  });
});

describe('bounceOffWall', () => {
  it('reflects velocity heading into the wall', () => {
    const vel = { x: 0, z: 10 };
    bounceOffWall(vel, 0, -1, 0.5); // wall normal points back at -z, car heads +z into it
    expect(vel.z).toBeLessThan(0);
  });

  it('leaves velocity alone when already moving away from the wall', () => {
    const vel = { x: 0, z: -10 };
    bounceOffWall(vel, 0, -1, 0.5);
    expect(vel.z).toBe(-10);
  });

  it('a restitution of 0 just cancels the inward component (no tunneling, no bounce)', () => {
    const vel = { x: 3, z: 10 };
    bounceOffWall(vel, 0, -1, 0);
    expect(vel.z).toBeCloseTo(0, 5);
    expect(vel.x).toBeCloseTo(3, 5);
  });
});

describe('createRamCounter (chase mission)', () => {
  it('counts a ram and reports done at the threshold', () => {
    const c = createRamCounter(3, 0.5);
    expect(c.ram()).toBe(true);
    expect(c.hits).toBe(1);
    expect(c.done).toBe(false);
    expect(c.ram()).toBe(false); // cooldown still active this instant
    c.update(0.5);
    expect(c.ram()).toBe(true);
    expect(c.hits).toBe(2);
    c.update(0.5);
    expect(c.ram()).toBe(true);
    expect(c.hits).toBe(3);
    expect(c.done).toBe(true);
  });

  it('resets cleanly', () => {
    const c = createRamCounter(3, 0.1);
    c.ram();
    c.reset();
    expect(c.hits).toBe(0);
    expect(c.done).toBe(false);
  });
});

describe('findClearGroundSpot (summon fallback)', () => {
  const near = { x: 0, y: 0, z: 0 };

  it('takes the spot dead on `near` when it is clear', () => {
    const isClear = (x, y, z) => ({ x, y, z });
    const spot = findClearGroundSpot(near, isClear);
    expect(spot).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('rings outward past a blocked centre and every blocked inner ring', () => {
    // Nothing is clear inside 5m (a wide open-yard obstruction); the first ring with any room is
    // the one at radius 5.
    const isClear = (x, y, z) => (Math.hypot(x - near.x, z - near.z) >= 5 ? { x, y, z } : null);
    const spot = findClearGroundSpot(near, isClear, [0, 3, 5, 7]);
    expect(spot).not.toBeNull();
    expect(Math.hypot(spot.x, spot.z)).toBeCloseTo(5, 5);
  });

  it('returns null when every ring is blocked (truly boxed in)', () => {
    const isClear = () => null;
    expect(findClearGroundSpot(near, isClear, [0, 3, 5])).toBeNull();
  });

  it('never calls isClear for a candidate outside the radii it was given', () => {
    const seen = [];
    const isClear = (x, y, z) => { seen.push(Math.hypot(x - near.x, z - near.z)); return null; };
    findClearGroundSpot(near, isClear, [0, 4]);
    for (const d of seen) expect(d).toBeLessThanOrEqual(4 + 1e-9);
  });
});

describe('damageArmor / stepArmor (Batmobile battle armour)', () => {
  it('a hit removes hp and resets the regen delay', () => {
    const a = { hp: 100, sinceHit: 99 };
    damageArmor(a, 22);
    expect(a.hp).toBe(78);
    expect(a.sinceHit).toBe(0);
  });

  it('never drops hp below zero', () => {
    const a = { hp: 10, sinceHit: 0 };
    damageArmor(a, 50);
    expect(a.hp).toBe(0);
  });

  it('does not regen while still inside the post-hit delay', () => {
    const a = { hp: 50, sinceHit: 0 };
    stepArmor(a, 1, { max: 100, regenDelay: 3, regenRate: 6 });
    expect(a.hp).toBe(50);
  });

  it('regens once the delay has passed, and stops at max', () => {
    const a = { hp: 50, sinceHit: 2.9 };
    stepArmor(a, 0.2, { max: 100, regenDelay: 3, regenRate: 6 }); // crosses the 3s delay this step
    expect(a.hp).toBeGreaterThan(50);
    for (let i = 0; i < 200; i++) stepArmor(a, 1, { max: 100, regenDelay: 3, regenRate: 6 });
    expect(a.hp).toBe(100);
  });

  it('a destroyed car (hp 0) stays at 0 until healed explicitly, not by regen', () => {
    const a = { hp: 0, sinceHit: 50 };
    stepArmor(a, 1, { max: 100, regenDelay: 3, regenRate: 6 });
    expect(a.hp).toBe(0);
  });
});

describe('stepLane (traffic lane following)', () => {
  const crossings = [-30, 30, 90];

  it('advances t by speed * dir * dt when clear of a stop', () => {
    const lane = { t: 0, dir: 1, speed: 10, stopT: 0 };
    stepLane(lane, 0.5, []);
    expect(lane.t).toBeCloseTo(5, 5);
  });

  it('reverses direction correctly for dir -1', () => {
    const lane = { t: 0, dir: -1, speed: 10, stopT: 0 };
    stepLane(lane, 0.5, []);
    expect(lane.t).toBeCloseTo(-5, 5);
  });

  it('stops exactly at a crossing it would otherwise drive through', () => {
    const lane = { t: 28, dir: 1, speed: 10, stopT: 0 };
    stepLane(lane, 1, crossings, 1.1); // would go from 28 to 38, crossing 30
    expect(lane.t).toBe(30);
    expect(lane.stopT).toBeCloseTo(1.1, 5);
  });

  it('holds position while stopped, then resumes after stopT elapses', () => {
    const lane = { t: 30, dir: 1, speed: 10, stopT: 1.1 };
    stepLane(lane, 0.6, crossings);
    expect(lane.t).toBe(30);
    expect(lane.stopT).toBeCloseTo(0.5, 5);
    stepLane(lane, 0.6, crossings); // stopT runs out mid-step; next call moves again
    stepLane(lane, 0.2, crossings);
    expect(lane.t).toBeGreaterThan(30);
  });

  it('never allocates a new object: same lane reference back', () => {
    const lane = { t: 0, dir: 1, speed: 10, stopT: 0 };
    expect(stepLane(lane, 0.1, crossings)).toBe(lane);
  });
});

describe('stepDrive steering feel', () => {
  const fresh = () => ({ speed: 20, yaw: 0, drift: 0 });
  const hold = (v, input, secs, dt = 1 / 60) => { for (let t = 0; t < secs; t += dt) stepDrive(v, input, dt, DEFAULT_TUNING); return v; };
  it('eases a key press in instead of snapping to full lock', () => {
    const v = fresh();
    stepDrive(v, { throttle: 0, brake: 0, steer: 1 }, 1 / 60, DEFAULT_TUNING);
    expect(v.steer).toBeGreaterThan(0);
    expect(v.steer).toBeLessThan(0.2);
    hold(v, { throttle: 0, brake: 0, steer: 1 }, 0.3);
    expect(v.steer).toBeCloseTo(1, 5);
  });
  it('recentres faster than it turns in', () => {
    const v = hold(fresh(), { throttle: 0, brake: 0, steer: 1 }, 0.5);
    hold(v, { throttle: 0, brake: 0, steer: 0 }, 0.12);
    expect(v.steer).toBeLessThanOrEqual(0);
  });
  it('turns less sharply at top speed than around town', () => {
    const rate = (speed) => {
      const v = { speed, yaw: 0, drift: 0, steer: 1 };
      stepDrive(v, { throttle: 1, brake: 0, steer: 1 }, 1 / 60, DEFAULT_TUNING);
      return v.yaw * 60;
    };
    expect(rate(DEFAULT_TUNING.turnRefSpeed)).toBeCloseTo(DEFAULT_TUNING.turnRate, 1);
    expect(rate(DEFAULT_TUNING.maxSpeed)).toBeLessThan(rate(DEFAULT_TUNING.turnRefSpeed) * 0.8);
    // Still a usable turn at full boost: a city block's corner, not a motorway curve.
    expect(DEFAULT_TUNING.maxBoostSpeed / rate(DEFAULT_TUNING.maxBoostSpeed)).toBeLessThan(35);
  });
});
