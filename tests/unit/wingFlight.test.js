// tests/unit/wingFlight.test.js
import { describe, it, expect } from 'vitest';
import { createWingState, stepWing, clampToWorld, bounceWing, WING_TUNING } from '../../src/vehicles/wingFlight.js';

describe('stepWing: pitch', () => {
  it('climbs when pitchIn is positive and dives when negative', () => {
    const up = createWingState();
    for (let i = 0; i < 30; i++) stepWing(up, { pitchIn: 1 }, 1 / 60);
    expect(up.pitch).toBeGreaterThan(0);
    expect(up.y).toBeGreaterThan(0);

    const down = createWingState();
    for (let i = 0; i < 30; i++) stepWing(down, { pitchIn: -1 }, 1 / 60);
    expect(down.pitch).toBeLessThan(0);
    expect(down.y).toBeLessThan(0);
  });

  it('clamps pitch to maxPitch', () => {
    const s = createWingState();
    for (let i = 0; i < 300; i++) stepWing(s, { pitchIn: 1 }, 1 / 60);
    expect(s.pitch).toBeCloseTo(WING_TUNING.maxPitch, 5);
  });

  it('auto levels back toward 0 pitch once input stops', () => {
    const s = createWingState();
    for (let i = 0; i < 30; i++) stepWing(s, { pitchIn: 1 }, 1 / 60);
    const climbed = s.pitch;
    expect(climbed).toBeGreaterThan(0.2);
    for (let i = 0; i < 220; i++) stepWing(s, {}, 1 / 60);
    expect(Math.abs(s.pitch)).toBeLessThan(0.02);
  });
});

describe('stepWing: roll', () => {
  it('banks toward a target proportional to rollIn', () => {
    const s = createWingState();
    for (let i = 0; i < 30; i++) stepWing(s, { rollIn: 1 }, 1 / 60);
    expect(s.roll).toBeGreaterThan(0.3);
    expect(s.roll).toBeLessThanOrEqual(WING_TUNING.maxBank + 1e-6);
  });

  it('turns the heading while banked (coordinated turn)', () => {
    const s = createWingState();
    for (let i = 0; i < 60; i++) stepWing(s, { rollIn: 1 }, 1 / 60);
    expect(s.yaw).toBeGreaterThan(0);
  });

  it('self-levels the bank back to 0 once rollIn stops', () => {
    const s = createWingState();
    for (let i = 0; i < 30; i++) stepWing(s, { rollIn: 1 }, 1 / 60);
    for (let i = 0; i < 100; i++) stepWing(s, {}, 1 / 60);
    expect(Math.abs(s.roll)).toBeLessThan(0.02);
  });
});

describe('stepWing: minimum speed', () => {
  it('never drops below the stall floor even under hover-brake', () => {
    const s = createWingState();
    s.speed = 500; // start absurdly fast
    for (let i = 0; i < 600; i++) stepWing(s, { brake: true }, 1 / 60);
    expect(s.speed).toBeGreaterThanOrEqual(WING_TUNING.minSpeed);
    expect(s.speed).toBeCloseTo(WING_TUNING.brakeSpeed, 1);
  });

  it('clamps a speed forced below the floor back up on the very next step', () => {
    const s = createWingState();
    s.speed = 1; // below minSpeed, as if something else had zeroed it out
    stepWing(s, {}, 1 / 60);
    expect(s.speed).toBeGreaterThanOrEqual(WING_TUNING.minSpeed);
  });

  it('boost chases a higher target speed than cruise', () => {
    const s = createWingState();
    for (let i = 0; i < 300; i++) stepWing(s, { boost: true }, 1 / 60);
    expect(s.speed).toBeCloseTo(WING_TUNING.boostSpeed, 0);
  });
});

describe('stepWing: soft ceiling', () => {
  it('pulls the plane back down toward the ceiling instead of a hard wall', () => {
    const s = createWingState(0, WING_TUNING.ceiling + 40, 0);
    s.pitch = 0;
    for (let i = 0; i < 120; i++) stepWing(s, {}, 1 / 60);
    // Approaches the ceiling, settling close to it rather than staying 40m above.
    expect(s.y).toBeLessThan(WING_TUNING.ceiling + 40);
    expect(s.y).toBeLessThan(WING_TUNING.ceiling + 5);
  });

  it('leaves altitude alone under the ceiling in level flight', () => {
    const s = createWingState(0, 50, 0);
    stepWing(s, {}, 1 / 60);
    expect(s.y).toBeCloseTo(50, 5); // level (pitch 0) flight: no vertical speed, no ceiling spring below it
  });
});

describe('clampToWorld', () => {
  it('softly pushes the plane back inside the world bounds', () => {
    const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    const s = createWingState(150, 50, 0);
    clampToWorld(s, bounds, 1 / 60);
    expect(s.x).toBeLessThan(150);
    expect(s.x).toBeGreaterThan(100);
  });

  it('does nothing when already inside the bounds', () => {
    const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    const s = createWingState(10, 50, 10);
    clampToWorld(s, bounds, 1 / 60);
    expect(s.x).toBe(10);
    expect(s.z).toBe(10);
  });
});

describe('bounceWing', () => {
  it('knocks the plane back along the wall normal and bleeds speed', () => {
    const s = createWingState(0, 50, 0);
    s.speed = 60;
    bounceWing(s, 1, 0);
    expect(s.x).toBeGreaterThan(0);
    expect(s.speed).toBeLessThan(60);
    expect(s.speed).toBeGreaterThanOrEqual(WING_TUNING.minSpeed);
  });

  it('arms a shake timer so the caller can react (no death)', () => {
    const s = createWingState();
    expect(s.shakeT).toBe(0);
    bounceWing(s, 0, 1);
    expect(s.shakeT).toBeGreaterThan(0);
  });

  it('never leaves speed below the stall floor, even from a near-stopped bounce', () => {
    const s = createWingState();
    s.speed = WING_TUNING.minSpeed;
    bounceWing(s, 1, 0);
    expect(s.speed).toBeGreaterThanOrEqual(WING_TUNING.minSpeed);
  });
});
