// tests/unit/probes.test.js
import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';
import { findLedge, hangPos, wrapCorner, findRunWall } from '../../src/actors/traverse/probes.js';

// A 10 m cube building from (0,0,0) to (10,10,10), plus a 4 m-tall box sitting on its roof at the
// north-east corner, which blocks headroom there.
const world = () => {
  const c = createCollision({ floor: () => 0 });
  c.addBox(0, 0, 0, 10, 10, 10, 'building');
  c.addBox(7, 10, 0, 10, 14, 3, 'building');
  return c;
};

describe('findLedge', () => {
  it('finds the south roof edge when falling past it facing north', () => {
    const l = findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    expect(l).not.toBe(null);
    expect(l.y).toBe(10);
    expect(l.nz).toBe(1);
    expect(l.axis).toBe('x');
    expect(l.z).toBe(10);
    expect(l.min).toBeCloseTo(0.35, 5);
    expect(l.max).toBeCloseTo(9.65, 5);
  });
  it('ignores an edge that is too high or too low to reach', () => {
    expect(findLedge(world(), { x: 5, y: 6, z: 10.5 }, 0, -1)).toBe(null);
    expect(findLedge(world(), { x: 5, y: 9.5, z: 10.5 }, 0, -1)).toBe(null);
  });
  it('ignores an edge with no headroom above it', () => {
    // East face near z=1.5: the rooftop box covers the landing spot.
    expect(findLedge(world(), { x: 10.5, y: 8.2, z: 1.5 }, -1, 0)).toBe(null);
  });
  it('ignores an edge behind the hero', () => {
    expect(findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, 1)).toBe(null);
  });
  it('hangs with hands at the top and feet off the wall', () => {
    const l = findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    const h = hangPos(l);
    expect(h.y).toBeCloseTo(10 - 2.05, 5);
    expect(h.z).toBeCloseTo(10.38, 5);
  });
});

describe('wrapCorner', () => {
  it('wraps the south-west outside corner onto the west face', () => {
    const l = findLedge(world(), { x: 1, y: 8.2, z: 10.5 }, 0, -1);
    const w = wrapCorner(world(), l, -1);
    expect(w.nx).toBe(-1);
    expect(w.axis).toBe('z');
    expect(w.x).toBe(0);
    expect(w.z).toBeCloseTo(9.65, 5);
  });
  it('refuses to wrap onto a face with no headroom', () => {
    // East face at the north end is under the rooftop box.
    const l = findLedge(world(), { x: 9, y: 8.2, z: -0.5 }, 0, 1);
    expect(l).toBe(null);
  });
});

describe('findRunWall', () => {
  it('finds a tall wall beside a hero running along it', () => {
    const r = findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, 0, 10);
    expect(r).not.toBe(null);
    expect(r.nx).toBe(1);
    expect(r.side).toBe(-1);
  });
  it('rejects a steep approach angle', () => {
    expect(findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, -9, 3)).toBe(null);
  });
  it('rejects walls that are not buildings or are too short', () => {
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 3, 10, 'building');
    expect(findRunWall(c, { x: 10.6, y: 0.5, z: 5 }, 0, 10)).toBe(null);
    const d = createCollision({ floor: () => 0 });
    d.addBox(0, 0, 0, 10, 10, 10, 'crate');
    expect(findRunWall(d, { x: 10.6, y: 0.5, z: 5 }, 0, 10)).toBe(null);
  });
});
