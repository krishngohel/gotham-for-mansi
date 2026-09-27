import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';
import { createTimeControl } from '../../src/core/time.js';
import { getQuality } from '../../src/render/quality.js';
import { batOutline, batSvgPath, BAT_RIGHT_HALF } from '../../src/config/batShape.js';
import { hex, PALETTE } from '../../src/config/palette.js';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(7), b = createRng(7);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('stays in range', () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
      const n = r.int(2, 4); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(4);
    }
  });
});

describe('time control', () => {
  it('freezes game time during hit-stop, then resumes with the leftover', () => {
    const t = createTimeControl();
    t.hitStop(0.06);
    expect(t.scale(0.05)).toBe(0);
    expect(t.scale(0.05)).toBeCloseTo(0.04, 6);
    expect(t.scale(0.05)).toBeCloseTo(0.05, 6);
  });
  it('keeps the longer of overlapping hit-stops', () => {
    const t = createTimeControl();
    t.hitStop(0.12); t.hitStop(0.06);
    expect(t.scale(0.1)).toBe(0);
    expect(t.stopped).toBe(true);
  });
  it('slows time for the slow-mo window', () => {
    const t = createTimeControl();
    t.slowMo(0.5, 0.25);
    expect(t.scale(0.1)).toBeCloseTo(0.025, 6);
  });
});

describe('quality', () => {
  it('falls back to high and has a cheaper low preset', () => {
    expect(getQuality('nope').name).toBe('high');
    const low = getQuality('low');
    expect(low.shadows).toBe(false);
    expect(low.normalScale).toBe(0.5);
    expect(low.rainCount).toBeLessThan(getQuality('high').rainCount);
  });
});

describe('bat shape', () => {
  it('mirrors the right half into a symmetric closed outline', () => {
    const pts = batOutline();
    expect(pts).toHaveLength(BAT_RIGHT_HALF.length * 2 - 2);
    const xs = pts.map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs));
  });
  it('produces an SVG path', () => {
    const d = batSvgPath(1, 50, 50);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('palette', () => {
  it('formats hex', () => {
    expect(hex(PALETTE.ink)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

import { createFixedStep } from '../../src/core/loop.js';

describe('fixed step', () => {
  it('runs one step per 60 Hz frame', () => {
    const f = createFixedStep();
    expect(f.advance(1 / 60).steps).toBe(1);
  });
  it('accumulates short frames', () => {
    const f = createFixedStep();
    expect(f.advance(1 / 120).steps).toBe(0);
    expect(f.advance(1 / 120).steps).toBe(1);
  });
  it('caps catch-up after a long stall', () => {
    const f = createFixedStep();
    expect(f.advance(2).steps).toBe(5);
    expect(f.advance(0).steps).toBe(0);
  });
});
