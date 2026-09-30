// tests/unit/cinematicShots.test.js
import { describe, it, expect } from 'vitest';
import { ease, sampleShot, totalDuration, sampleSequence, orbitShots } from '../../src/ui/cinematicShots.js';

describe('ease', () => {
  it('is a smoothstep from 0 to 1, clamped outside that range', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 5);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
  });
  it('eases in and out (slower at the ends than the middle)', () => {
    const d1 = ease(0.1) - ease(0);
    const d2 = ease(0.5) - ease(0.4);
    expect(d1).toBeLessThan(d2);
  });
});

const shot = (over = {}) => ({
  from: { x: 0, y: 0, z: 0 },
  to: { x: 10, y: 20, z: -10 },
  look: { x: 1, y: 1, z: 1 },
  dur: 2,
  ...over,
});

describe('sampleShot', () => {
  it('starts exactly at `from`, looking at `look`', () => {
    const out = sampleShot(shot(), 0);
    expect(out).toMatchObject({ x: 0, y: 0, z: 0, lx: 1, ly: 1, lz: 1 });
  });
  it('ends exactly at `to` once local time reaches dur', () => {
    const out = sampleShot(shot(), 2);
    expect(out).toMatchObject({ x: 10, y: 20, z: -10 });
  });
  it('clamps past the end of the shot instead of overshooting', () => {
    const out = sampleShot(shot(), 50);
    expect(out).toMatchObject({ x: 10, y: 20, z: -10 });
  });
  it('lerps the look point toward lookTo when given', () => {
    const out = sampleShot(shot({ lookTo: { x: 5, y: 5, z: 5 } }), 2);
    expect(out).toMatchObject({ lx: 5, ly: 5, lz: 5 });
  });
  it('holds the look point fixed when lookTo is not given', () => {
    const out = sampleShot(shot(), 1);
    expect(out).toMatchObject({ lx: 1, ly: 1, lz: 1 });
  });
  it('defaults fov, or uses the one given', () => {
    expect(sampleShot(shot(), 0).fov).toBe(50);
    expect(sampleShot(shot({ fov: 30 }), 0).fov).toBe(30);
  });
  it('fills and returns the given out object instead of allocating', () => {
    const out = {};
    const r = sampleShot(shot(), 1, out);
    expect(r).toBe(out);
  });
});

describe('totalDuration / sampleSequence', () => {
  const shots = [shot({ dur: 2, to: { x: 10, y: 0, z: 0 } }), shot({ dur: 3, from: { x: 10, y: 0, z: 0 }, to: { x: 10, y: 0, z: 30 } })];

  it('sums every shot duration', () => {
    expect(totalDuration(shots)).toBe(5);
  });

  it('picks the right shot for a given global time and reports a local pose', () => {
    const a = sampleSequence(shots, 1, {});
    expect(a.index).toBe(0);
    expect(a.done).toBe(false);
    const b = sampleSequence(shots, 3, {});
    expect(b.index).toBe(1);
    expect(b.x).toBe(10);
    expect(b.done).toBe(false);
  });

  it('reports done once time reaches the total, holding the last pose', () => {
    const out = sampleSequence(shots, 5, {});
    expect(out.done).toBe(true);
    expect(out.index).toBe(1);
    expect(out).toMatchObject({ x: 10, y: 0, z: 30 });
    const past = sampleSequence(shots, 99, {});
    expect(past.done).toBe(true);
    expect(past).toMatchObject({ x: 10, y: 0, z: 30 });
  });

  it('an empty sequence is immediately done', () => {
    expect(sampleSequence([], 0, {}).done).toBe(true);
    expect(sampleSequence([], 0, {}).index).toBe(-1);
  });
});

describe('orbitShots', () => {
  it('builds `segments` shots totalling `dur`, all looking at the centre', () => {
    const center = { x: 5, y: 5, z: 5 };
    const shots = orbitShots(center, 20, 8, 6, 3);
    expect(shots).toHaveLength(3);
    expect(totalDuration(shots)).toBeCloseTo(6, 5);
    for (const s of shots) expect(s.look).toEqual(center);
  });

  it('keeps every point at `radius` from the centre, `height` above it', () => {
    const center = { x: 0, y: 0, z: 0 };
    const shots = orbitShots(center, 15, 10, 3, 2);
    for (const s of shots) {
      for (const p of [s.from, s.to]) {
        expect(Math.hypot(p.x - center.x, p.z - center.z)).toBeCloseTo(15, 5);
        expect(p.y).toBeCloseTo(10, 5);
      }
    }
  });

  it('chains: one shot\'s `to` matches the next shot\'s `from`', () => {
    const shots = orbitShots({ x: 0, y: 0, z: 0 }, 10, 5, 4, 4);
    for (let i = 0; i < shots.length - 1; i++) {
      expect(shots[i].to.x).toBeCloseTo(shots[i + 1].from.x, 5);
      expect(shots[i].to.z).toBeCloseTo(shots[i + 1].from.z, 5);
    }
  });
});
