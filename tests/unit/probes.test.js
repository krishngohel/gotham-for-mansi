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
  it('wraps the south-west outside corner onto the west face (axis x, dir -1)', () => {
    const l = findLedge(world(), { x: 1, y: 8.2, z: 10.5 }, 0, -1);
    const w = wrapCorner(world(), l, -1);
    expect(w.nx).toBe(-1);
    expect(w.axis).toBe('z');
    expect(w.x).toBe(0);
    expect(w.z).toBeCloseTo(9.65, 5);
  });
  it('wraps onto an axis z ledge (east face) with dir 1', () => {
    // Ledge on east face (nx=1, nz=0), wrap toward max z (dir 1) goes to north face (nx=0, nz=1)
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 10, 10, 'building');
    const l = findLedge(c, { x: 10.5, y: 8.2, z: 5 }, -1, 0);
    expect(l).not.toBe(null);
    expect(l.axis).toBe('z');
    const w = wrapCorner(c, l, 1);
    expect(w).not.toBe(null);
    expect(w.axis).toBe('x');
    expect(w.nz).toBe(1);
    expect(w.z).toBe(10);
  });
  it('wraps with dir 1 on an axis x ledge (north face)', () => {
    // Ledge on north face (nx=0, nz=1), wrap toward max x (dir 1) goes to east face (nx=1, nz=0)
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 10, 10, 'building');
    const l = findLedge(c, { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    expect(l).not.toBe(null);
    expect(l.axis).toBe('x');
    const w = wrapCorner(c, l, 1);
    expect(w).not.toBe(null);
    expect(w.axis).toBe('z');
    expect(w.nx).toBe(1);
    expect(w.x).toBe(10);
  });
  it('refuses to wrap when adjacent face has no headroom (clearAbove check)', () => {
    // Test clearAbove rejection path specifically. Build: main 10m box with rooftop cover
    // that blocks headroom above the wrapped-to face but doesn't block the hang spot itself.
    // Starting ledge on north edge at z=10. Wrap east (dir 1) attempts east face.
    // Wrapped ledge would be at (10, 10, ~9.65). Pull-up spot at (9.4, ~9.65).
    // Hang spot at (~10.38, ~7.95, ~9.27).
    // Rooftop box covers pull-up area but not hang spot (x 8.5-10, y 10-13, z 9-10).
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 10, 10, 'building');
    c.addBox(8.5, 10, 9, 10, 13, 10, 'building'); // rooftop over pull-up spot
    const l = findLedge(c, { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    expect(l).not.toBe(null); // starting ledge exists
    const w = wrapCorner(c, l, 1);
    // Returns null due to clearAbove failing (rooftop blocks headroom), not blocked check
    expect(w).toBe(null);
  });
  it('refuses to wrap when adjacent face is blocked', () => {
    // Build: main box plus blocking box at wrap destination
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 10, 10, 'building');
    // Box positioned to block the west face wrap-to point
    c.addBox(-2, 9, 5, -0.1, 12, 10, 'building');
    const l = findLedge(c, { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    expect(l).not.toBe(null);
    const w = wrapCorner(c, l, -1);
    expect(w).toBe(null);
  });
});

describe('findRunWall', () => {
  it('finds a tall wall beside a hero running along it (side -1)', () => {
    const r = findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, 0, 10);
    expect(r).not.toBe(null);
    expect(r.nx).toBe(1);
    expect(r.side).toBe(-1);
  });
  it('finds a wall on the other side (side 1)', () => {
    // Hero left of building running parallel; building found on right side (side 1)
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 10, 10, 'building');
    const r = findRunWall(c, { x: -0.5, y: 3, z: 5 }, 0, 10);
    expect(r).not.toBe(null);
    expect(r.nx).toBe(-1);
    expect(r.side).toBe(1);
  });
  it('rejects a steep approach angle', () => {
    expect(findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, -9, 3)).toBe(null);
  });
  it('rejects a wall exactly 4 m tall', () => {
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 4, 10, 'building');
    expect(findRunWall(c, { x: 10.6, y: 0.5, z: 5 }, 0, 10)).toBe(null);
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
