import { describe, it, expect } from 'vitest';
import { wallRunVy } from '../../src/actors/traverse/wallrun.js';
import { createZipControl } from '../../src/actors/traverse/zipline.js';
import { lineBetween } from '../../src/gadgets/aim.js';

describe('wall run arc', () => {
  const rise = (dur, steps = 1200) => {
    let y = 0, peak = 0;
    const dt = dur / steps;
    for (let i = 0; i < steps; i++) { y += wallRunVy(i * dt, dur) * dt; peak = Math.max(peak, y); }
    return { y, peak };
  };
  it('matches the old 1.2 s arc', () => {
    for (const t of [0, 0.3, 0.6, 0.9, 1.2]) expect(Math.abs(wallRunVy(t, 1.2) - (4.6 - 7.7 * t))).toBeLessThan(0.05);
  });
  it('a longer run (Wall Grip Boots) keeps the same height and ends level', () => {
    const a = rise(1.2), b = rise(1.8);
    expect(b.peak).toBeCloseTo(a.peak, 1);
    expect(Math.abs(b.y)).toBeLessThan(0.05);
  });
});

describe('zip control options (line launcher)', () => {
  const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
  const stubHero = () => ({
    pos: vec(), vel: vec(), grounded: true, setState() {},
    cape: { setWings() {} }, bat: { face() {}, tilt: { rotation: { set() {} } }, animator: { play() {} } },
  });
  it('rides a taut line at its minimum speed and uses its own events', () => {
    const seen = [];
    const h = stubHero();
    const line = lineBetween({ x: 0, y: 2.05, z: 0 }, { x: 0, y: 2.05, z: 30 });
    const z = createZipControl(h, { events: { emit: (n) => seen.push(n) } }, { line, minSpeed: 18, onEvent: 'launcherOn', offEvent: 'launcherOff' });
    expect(z.line).toBe(line);
    const ctx = { input: { pressed: () => false } };
    z.update(0.1, ctx);
    expect(z.speed).toBeGreaterThanOrEqual(18);
    expect(h.pos.y).toBeCloseTo(0);
    let done = false;
    for (let i = 0; i < 40 && !done; i++) done = z.update(0.1, ctx);
    expect(done).toBe(true);
    expect(seen).toEqual(['launcherOn', 'launcherOff']);
  });
  it('city ziplines still announce zipOn and zipOff', () => {
    const seen = [];
    const line = lineBetween({ x: 0, y: 12, z: 0 }, { x: 0, y: 8, z: 20 }, 0.03);
    const z = createZipControl(stubHero(), { events: { emit: (n) => seen.push(n) } }, { line });
    for (let i = 0; i < 60; i++) if (z.update(0.1, { input: { pressed: () => false } })) break;
    expect(seen).toEqual(['zipOn', 'zipOff']);
  });
});
