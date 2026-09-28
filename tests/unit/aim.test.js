import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';
import { pickAimed, pickAimedMany, launcherLine, lineBetween, gelSpot, inRadius, steerDir, yankVelocity } from '../../src/gadgets/aim.js';

const goon = (id, x, z, y = 0) => ({ id, pos: { x, y, z } });
const eye = { x: 0, y: 1.1, z: 0 };
const ahead = { x: 0, y: 0, z: 1 };

describe('pickAimed', () => {
  it('takes the goon nearest the aim line, inside range and the cone', () => {
    const list = [goon('left', -3, 6), goon('ahead', 0.2, 9), goon('behind', 0, -5), goon('far', 0, 30)];
    expect(pickAimed(list, eye, ahead).id).toBe('ahead');
    expect(pickAimed([goon('far', 0, 30)], eye, ahead)).toBe(null);
    expect(pickAimed([goon('left', -3, 6)], eye, ahead)).toBe(null);
  });
  it('picks several in order and respects the filter', () => {
    const list = [goon('a', 0, 5), goon('b', 0.5, 8), goon('c', -0.4, 12), goon('d', 0, 7)];
    expect(pickAimedMany(list, eye, ahead, 2).map((g) => g.id)).toEqual(['a', 'd']);
    expect(pickAimedMany(list, eye, ahead, 2, { filter: (g) => g.id !== 'a' }).map((g) => g.id)).toEqual(['d', 'c']);
  });
});

describe('launcherLine', () => {
  const city = () => { const c = createCollision(); c.addBox(-10, 0, 25, 10, 30, 30, 'building'); return c; };
  it('runs level to the wall ahead, hanging at hand height', () => {
    const r = launcherLine(city(), { x: 0, y: 0, z: 0 }, 0);
    expect(r.ok).toBe(true);
    expect(r.dist).toBeCloseTo(25);
    expect(r.line.a).toEqual({ x: 0, y: 2.05, z: 0 });
    expect(r.line.b.z).toBeCloseTo(24.4);
    expect(r.line.b.y).toBeCloseTo(2.05);
    expect(r.line.sag).toBe(0);
    expect(r.line.dir.z).toBeCloseTo(1);
  });
  it('fails with no wall in 40 m, or a wall closer than 6 m', () => {
    expect(launcherLine(city(), { x: 0, y: 0, z: 0 }, Math.PI).reason).toBe('none');
    const c = createCollision();
    c.addBox(-2, 0, 4, 2, 3, 5, 'crate');
    expect(launcherLine(c, { x: 0, y: 0, z: 0 }, 0).reason).toBe('short');
  });
  it('a low obstacle shortens the line (the rider must pass over nothing)', () => {
    const c = city();
    c.addBox(-2, 0, 15, 2, 0.8, 16, 'crate');
    expect(launcherLine(c, { x: 0, y: 0, z: 0 }, 0).dist).toBeCloseTo(15);
  });
});

describe('lineBetween', () => {
  it('builds a zipline-shaped line', () => {
    const l = lineBetween({ x: 0, y: 5, z: 0 }, { x: 3, y: 5, z: 4 });
    expect(l.length).toBeCloseTo(5);
    expect(l.dir).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(l.id).toBe(-1);
  });
});

describe('gelSpot', () => {
  it('sticks to the wall it hits, with the wall normal', () => {
    const c = createCollision();
    c.addBox(-5, 0, 8, 5, 10, 9, 'breakable');
    const s = gelSpot(c, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 });
    expect(s).toMatchObject({ z: 8, nz: -1, ny: 0 });
  });
  it('lands on the floor when aimed down at open ground', () => {
    const c = createCollision({ floor: () => 0 });
    const d = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
    const s = gelSpot(c, { x: 0, y: 3, z: 0 }, d);
    expect(s.y).toBe(0);
    expect(s.z).toBeCloseTo(3);
    expect(s.ny).toBe(1);
  });
  it('gives up aimed at the sky', () => {
    expect(gelSpot(createCollision({ floor: () => 0 }), { x: 0, y: 3, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(null);
  });
});

describe('small helpers', () => {
  it('inRadius is flat distance plus a height band', () => {
    expect(inRadius({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }, 2.5)).toBe(true);
    expect(inRadius({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 0 }, 2.5)).toBe(false);
  });
  it('steerDir turns toward the wanted direction at a limited rate and stays unit length', () => {
    const out = { x: 0, y: 0, z: 0 };
    steerDir({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 0.05, 5, out);
    expect(out.x).toBeGreaterThan(0);
    expect(out.z).toBeGreaterThan(out.x);
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1);
  });
  it('yankVelocity lands the goon at the target point', () => {
    const from = { x: 0, y: 4, z: 10 }, to = { x: 0, y: 0, z: 1.3 };
    const v = yankVelocity(from, to);
    const x = from.z + v.vz * v.t;
    const y = from.y + v.vy * v.t - 12 * v.t * v.t;
    expect(x).toBeCloseTo(to.z);
    expect(y).toBeCloseTo(to.y);
    expect(v.t).toBeGreaterThanOrEqual(0.3);
    expect(v.t).toBeLessThanOrEqual(0.6);
  });
});
