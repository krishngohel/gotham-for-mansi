import { describe, it, expect } from 'vitest';
import { stepDrive, driveVelocity, bounceOffWall, createRamCounter, mergeTuning, DEFAULT_TUNING } from '../../src/vehicles/vehiclePhysics.js';

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
