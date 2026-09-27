import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';

const world = () => {
  const c = createCollision({ floor: (x) => (x > 100 ? -Infinity : 0) });
  c.addBox(0, 0, 0, 10, 20, 10, 'building');   // roof top at y 20
  c.addBox(20, 0, 0, 22, 0.3, 10, 'curb');      // low step
  c.addBox(-10, 0, -1, -9, 3, 1, 'wall');       // thin wall
  return c;
};

describe('collision', () => {
  it('stands on a roof top', () => {
    const c = world();
    const p = { x: 5, y: 19.9, z: 5 };
    const r = c.resolveCylinder(p, 0.35, 1.8);
    expect(r.groundY).toBe(20);
    expect(p.y).toBe(20);
    expect(r.grounded).toBe(true);
  });

  it('keeps falling above empty space and reports the floor', () => {
    const c = world();
    const p = { x: 50, y: 5, z: 50 };
    const r = c.resolveCylinder(p, 0.35, 1.8);
    expect(r.grounded).toBe(false);
    expect(r.groundY).toBe(0);
    expect(p.y).toBe(5);
  });

  it('pushes out of a wall sideways without climbing it', () => {
    const c = world();
    const p = { x: -10.2, y: 0, z: 0 };
    const r = c.resolveCylinder(p, 0.35, 1.8);
    expect(r.hitWall).toBe(true);
    expect(p.x).toBeCloseTo(-10.35, 5);
    expect(p.y).toBe(0);
  });

  it('pushes out of a building side at street level', () => {
    const c = world();
    const p = { x: 10.1, y: 0, z: 5 };
    c.resolveCylinder(p, 0.35, 1.8);
    expect(p.x).toBeCloseTo(10.35, 5);
  });

  it('steps up a curb', () => {
    const c = world();
    const p = { x: 21, y: 0, z: 5 };
    const r = c.resolveCylinder(p, 0.35, 1.8);
    expect(p.y).toBeCloseTo(0.3, 5);
    expect(r.grounded).toBe(true);
  });

  it('has no floor over the water', () => {
    const c = world();
    expect(c.groundBelow(150, 3, 0, 0.3)).toBe(-Infinity);
  });

  it('raycasts to the nearest box face', () => {
    const c = world();
    const hit = c.raycast({ x: -5, y: 10, z: 5 }, { x: 1, y: 0, z: 0 }, 50);
    expect(hit.t).toBeCloseTo(5, 5);
    expect(hit.normal).toEqual({ x: -1, y: 0, z: 0 });
    expect(c.raycast({ x: -5, y: 30, z: 5 }, { x: 1, y: 0, z: 0 }, 50)).toBe(null);
  });

  it('raycasts down onto a roof', () => {
    const c = world();
    const hit = c.raycast({ x: 5, y: 40, z: 5 }, { x: 0, y: -1, z: 0 }, 50);
    expect(hit.t).toBeCloseTo(20, 5);
    expect(hit.normal.y).toBe(1);
  });
});
