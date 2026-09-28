import { describe, it, expect } from 'vitest';
import { createPatrol, stepPatrol, huddleSpot, pickSpot, segmentHitsRect } from '../../src/stealth/patrol.js';

const P = (x, y, z) => ({ x, y, z });
const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });

describe('stepPatrol', () => {
  const route = { mode: 'pingpong', points: [W(0, 0, 0, 1, Math.PI), W(10, 0, 0), W(10, 0, 10, 2)] };
  it('walks toward the current point', () => {
    const p = createPatrol(), out = {};
    expect(stepPatrol(p, route, P(5, 0, 5), 0.1, out)).toBe(false);
    expect(out).toMatchObject({ x: 0, y: 0, z: 0, face: null });
  });
  it('waits at a point facing its yaw, then heads for the next one', () => {
    const p = createPatrol(), out = {};
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(true);
    expect(out.face).toBe(Math.PI);
    for (let i = 0; i < 9; i++) expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(true);
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.11, out)).toBe(true);
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(false);
    expect(out).toMatchObject({ x: 10, z: 0 });
  });
  it('pingpong turns round at the ends; loop wraps', () => {
    const seq = (mode, n) => {
      const r = { mode, points: [W(0, 0, 0), W(10, 0, 0), W(10, 0, 10)] };
      const q = createPatrol(), out = {}, s = [];
      for (let k = 0; k < n; k++) { s.push(q.i); stepPatrol(q, r, r.points[q.i], 0.1, out); }
      return s;
    };
    expect(seq('pingpong', 6)).toEqual([0, 1, 2, 1, 0, 1]);
    expect(seq('loop', 5)).toEqual([0, 1, 2, 0, 1]);
  });
  it('a single point with a wait is a guard that never leaves', () => {
    const r = { mode: 'pingpong', points: [W(5, 0, 5, 4, 0.5)] };
    const p = createPatrol(), out = {};
    for (let i = 0; i < 100; i++) expect(stepPatrol(p, r, P(5, 0, 5), 0.1, out)).toBe(true);
    expect(out).toMatchObject({ x: 5, z: 5, face: 0.5 });
  });
});

describe('huddle and search spots', () => {
  it('huddleSpot spreads goons round the centre, back to back', () => {
    const out = {};
    expect(huddleSpot(P(10, 0, 10), 0, 2, out)).toMatchObject({ x: 10, z: 11.6, face: 0 });
    huddleSpot(P(10, 0, 10), 1, 2, out);
    expect(out.x).toBeCloseTo(10);
    expect(out.z).toBeCloseTo(8.4);
    expect(out.face).toBeCloseTo(Math.PI);
  });
  it('pickSpot cycles through walkable spots on the same level near the centre', () => {
    const spots = [P(0, 0, 0), P(5, 0, 0), P(0, 7, 0), P(30, 0, 0)];
    const out = {};
    expect(pickSpot(spots, P(0, 0, 0), 0, 0, out)).toMatchObject({ x: 0, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 0, 1, out)).toMatchObject({ x: 5, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 0, 2, out)).toMatchObject({ x: 0, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 7, 0, out)).toMatchObject({ x: 0, y: 7, z: 0 });
    expect(pickSpot(spots, P(100, 0, 0), 0, 0, out)).toBe(null);
  });
});

describe('segmentHitsRect', () => {
  it('finds a leg that crosses a box, with a clearance pad', () => {
    const a = P(0, 0, 0), b = P(10, 0, 0);
    expect(segmentHitsRect(a, b, { x: 5, z: 0, w: 1, d: 1 })).toBe(true);
    expect(segmentHitsRect(a, b, { x: 5, z: 0.5, w: 1, d: 0.4 })).toBe(false);
    expect(segmentHitsRect(a, b, { x: 5, z: 0.5, w: 1, d: 0.4 }, 0.5)).toBe(true);
    expect(segmentHitsRect(a, b, { x: 12, z: 0, w: 1, d: 1 })).toBe(false);
  });
});
