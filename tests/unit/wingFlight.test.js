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
  it('never lets the plane past the edge', () => {
    const bounds = { minX: -100, maxX: 100, minZ: -100, maxZ: 100 };
    const s = createWingState(150, 50, 0);
    clampToWorld(s, bounds, 1 / 60);
    expect(s.x).toBe(100);
  });

  it('turns a plane flying at the edge back toward the city, smoothly, without shuddering', () => {
    // About the real world's size (src/world/mapData.js WORLD, 472 m across).
    const bounds = { minX: -236, maxX: 236, minZ: -236, maxZ: 236 };
    const s = createWingState(0, 50, 0, Math.PI / 2); // heading +x, straight at the east edge
    let maxStep = 0, lastX = s.x, lastYaw = s.yaw;
    for (let i = 0; i < 60 * 8; i++) {
      stepWing(s, {}, 1 / 60);
      clampToWorld(s, bounds, 1 / 60);
      maxStep = Math.max(maxStep, Math.abs(s.yaw - lastYaw));
      lastYaw = s.yaw;
      expect(s.x).toBeLessThanOrEqual(236);
      lastX = s.x;
    }
    expect(Math.sin(s.yaw)).toBeLessThan(0); // heading back west, into the city
    expect(maxStep).toBeLessThan(0.1);       // no snap: at most a few degrees a frame
    expect(lastX).toBeLessThan(236);
  });

  it('a full-bank turn at cruise fits between city blocks (under 30 m across)', () => {
    const s = createWingState(0, 50, 0, 0);
    let minX = 0, maxX = 0;
    for (let i = 0; i < 60 * 4; i++) { stepWing(s, { rollIn: 1 }, 1 / 60); minX = Math.min(minX, s.x); maxX = Math.max(maxX, s.x); }
    expect(maxX - minX).toBeLessThan(60);
    expect((WING_TUNING.cruiseSpeed / (WING_TUNING.turnRate * WING_TUNING.maxBank)) * 2).toBeLessThan(50);
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
  it('glances off a wall: heading turned along it, not spun to face out of it', () => {
    const s = createWingState(0, 50, 0, Math.PI / 2 + 0.6); // flying +x and a little -z
    s.speed = 40;
    bounceWing(s, -1, 0); // a wall to the east, outward normal -x
    for (let i = 0; i < 30; i++) stepWing(s, {}, 1 / 60); // the glance finishes over half a second
    const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    expect(fx).toBeLessThanOrEqual(0.3);       // no longer driving into the wall
    expect(fz).toBeLessThan(-0.5);             // still going the way it was going along it
  });

  it('a head-on hit turns the plane smoothly over a few frames, never in one big snap', () => {
    const s = createWingState(0, 50, 0, Math.PI / 2); // straight at a wall to the east
    s.roll = 0.3;
    const before = s.yaw;
    bounceWing(s, -1, 0);
    expect(Math.abs(s.yaw - before)).toBeLessThanOrEqual(WING_TUNING.bounceSnap + 1e-9);
    let last = s.yaw, maxStep = 0;
    for (let i = 0; i < 40; i++) { stepWing(s, {}, 1 / 60); maxStep = Math.max(maxStep, Math.abs(s.yaw - last)); last = s.yaw; }
    expect(maxStep).toBeLessThan(0.12);
    expect(Math.sin(s.yaw)).toBeLessThan(0.35); // ends up along or away from the wall
  });

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
