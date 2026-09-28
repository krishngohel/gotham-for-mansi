import { describe, it, expect } from 'vitest';
import { createClimbables, addLadder, ladderGrab, ladderTopGrab, ladderExit, ladderBottomExit, addZipline, zipPoint, zipSag, zipClosest, zipSpeed, ZIP_SAG } from '../../src/world/climbables.js';
import { ZIP_ROUTES } from '../../src/world/ziplines.js';

describe('ladders', () => {
  const c = createClimbables();
  // A ladder on a wall facing +z, from the street to a 10 m roof.
  addLadder(c, { x: 5, z: 20, nx: 0, nz: 1, bottom: 0, top: 10 });

  it('grabs when standing at the foot facing the wall', () => {
    const g = ladderGrab(c.ladders, { x: 5, y: 0, z: 20.5 }, { facingX: 0, facingZ: -1 });
    expect(g.ladder.id).toBe(0);
    expect(g.y).toBe(0);
  });
  it('does not grab when facing away', () => {
    expect(ladderGrab(c.ladders, { x: 5, y: 0, z: 20.5 }, { facingX: 0, facingZ: 1 })).toBe(null);
  });
  it('does not grab from too far away or above the top', () => {
    expect(ladderGrab(c.ladders, { x: 7, y: 0, z: 20.5 }, { facingX: 0, facingZ: -1 })).toBe(null);
    expect(ladderGrab(c.ladders, { x: 5, y: 11, z: 20.5 }, { facingX: 0, facingZ: -1 })).toBe(null);
  });
  it('clamps a mid-air catch below the top rung', () => {
    const g = ladderGrab(c.ladders, { x: 5, y: 9.8, z: 20.4 }, {});
    expect(g.y).toBeCloseTo(9, 5);
  });
  it('grabs from the roof when walking toward the edge', () => {
    const l = ladderTopGrab(c.ladders, { x: 5, y: 10, z: 19.3 }, 0, 1);
    expect(l?.id).toBe(0);
    expect(ladderTopGrab(c.ladders, { x: 5, y: 10, z: 19.3 }, 0, -1)).toBe(null);
  });
  it('exits the top toward the roof', () => {
    const e = ladderExit(c.ladders[0]);
    expect(e.x).toBeCloseTo(5, 5);
    expect(e.z).toBeCloseTo(19.2, 5);
  });
});

describe('ladderBottomExit', () => {
  it('uses the stand point directly for a street-level ladder, without needing ground', () => {
    const l = { x: 5, z: 20, nx: 0, nz: 1, bottom: 0, top: 10 };
    const e = ladderBottomExit(l, () => -Infinity);
    expect(e.x).toBeCloseTo(5, 5);
    expect(e.z).toBeCloseTo(20.45, 5);
  });
  it('returns the stand point unchanged when it is already solid ground', () => {
    const l = { x: 100, z: 0, nx: 1, nz: 0, bottom: 6.8, top: 10.2 };
    // Solid everywhere near the stand point.
    const e = ladderBottomExit(l, () => 6.8);
    expect(e.x).toBeCloseTo(100.45, 5);
    expect(e.z).toBeCloseTo(0, 5);
  });
  it('steps inward toward the wall until it finds the landing under an outer-rail mount', () => {
    // Ladder mounted 1.32 out from the wall (outer rail), landing only spans x in [100.05, 101.35].
    const l = { x: 101.32, z: -50, nx: 1, nz: 0, bottom: 6.8, top: 10.2 };
    const groundBelow = (x) => (x >= 100.05 && x <= 101.35 ? 6.8 : -Infinity);
    const e = ladderBottomExit(l, groundBelow);
    expect(e.x).toBeLessThanOrEqual(101.35);
    expect(e.x).toBeGreaterThanOrEqual(100.05);
    expect(e.z).toBeCloseTo(-50, 5);
  });
  it('falls back to the stand point if no ground is found within the search range', () => {
    const l = { x: 200, z: 0, nx: 1, nz: 0, bottom: 6.8, top: 10.2 };
    const e = ladderBottomExit(l, () => -Infinity);
    expect(e.x).toBeCloseTo(200.45, 5);
    expect(e.z).toBeCloseTo(0, 5);
  });
});

describe('ziplines', () => {
  const c = createClimbables();
  const z = addZipline(c, { x: 0, y: 30, z: 0 }, { x: 40, y: 20, z: 0 });

  it('stores length and direction', () => {
    expect(z.length).toBeCloseTo(Math.hypot(40, 10), 5);
    expect(z.dir.x).toBeCloseTo(40 / z.length, 5);
  });
  it('interpolates and clamps points on the cable', () => {
    expect(zipPoint(z, 0)).toEqual({ x: 0, y: 30, z: 0 });
    const end = zipPoint(z, 999);
    expect(end.x).toBeCloseTo(40, 5);
    expect(end.y).toBeCloseTo(20, 5);
  });
  it('finds the closest point', () => {
    const r = zipClosest(z, { x: 20, y: 24, z: 1 });
    expect(r.s).toBeGreaterThan(19);
    expect(r.s).toBeLessThan(22);
    expect(r.dist).toBeLessThan(2);
  });
  it('speeds up downhill and caps at 30', () => {
    let v = 5;
    for (let i = 0; i < 600; i++) v = zipSpeed(z, v, 1 / 60);
    expect(v).toBeGreaterThan(15);
    expect(v).toBeLessThanOrEqual(30);
  });
  it('keeps a minimum crawl on a flat or uphill cable', () => {
    const flat = addZipline(c, { x: 0, y: 10, z: 0 }, { x: 30, y: 12, z: 0 });
    let v = 2;
    for (let i = 0; i < 120; i++) v = zipSpeed(flat, v, 1 / 60);
    expect(v).toBeGreaterThanOrEqual(8);
  });
});

describe('zipSag', () => {
  const c = createClimbables();
  const z = addZipline(c, { x: 0, y: 30, z: 0 }, { x: 40, y: 20, z: 0 });

  it('is zero at both ends', () => {
    expect(zipSag(z, 0)).toBeCloseTo(0, 5);
    expect(zipSag(z, z.length)).toBeCloseTo(0, 5);
  });
  it('peaks at the middle, at ZIP_SAG of the cable length', () => {
    expect(zipSag(z, z.length / 2)).toBeCloseTo(z.length * ZIP_SAG, 5);
  });
  it('is symmetric and always non-negative along the span', () => {
    for (let k = 0; k <= 1; k += 0.1) {
      const s = k * z.length;
      const mirrored = z.length - s;
      expect(zipSag(z, s)).toBeGreaterThanOrEqual(0);
      expect(zipSag(z, s)).toBeCloseTo(zipSag(z, mirrored), 5);
    }
  });
  it('matches the drawn cable and the catch check: zipClosest measures against the sagged curve', () => {
    // A point sitting exactly on the straight chord at mid-span is `zipSag` above the real cable.
    const mid = zipPoint(z, z.length / 2);
    const r = zipClosest(z, mid);
    expect(r.dist).toBeCloseTo(zipSag(z, z.length / 2), 5);
  });
});

it('zip routes cross real gaps', () => {
  for (const [a, b] of ZIP_ROUTES) expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(25);
  expect(ZIP_ROUTES.length).toBeGreaterThanOrEqual(8);
});
