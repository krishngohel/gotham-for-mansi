// tests/unit/ladderGait.test.js
import { describe, it, expect } from 'vitest';
import { GAIT, limbGrip, ladderGrips } from '../../src/actors/traverse/ladderGait.js';

const RUNG = 0.3;
const onRung = (y, bottom = 0) => Math.abs(((y - bottom) / RUNG) - Math.round((y - bottom) / RUNG)) < 1e-6;

describe('limbGrip', () => {
  it('holds a limb still on a rung, then swings it up a whole stride', () => {
    const y0 = 0.3;
    const a = limbGrip(1.0, GAIT.HAND_R, y0);
    const b = limbGrip(1.1, GAIT.HAND_R, y0);
    expect(a.swing).toBe(0);
    expect(b.y).toBeCloseTo(a.y); // planted: the body rises past it
    expect(onRung(a.y)).toBe(true);
  });
  it('lands every plant on a rung, for both pairs of limbs', () => {
    const grips = [];
    // Below the top: up there the hands take the ledge instead (see the last test).
    for (let cy = 0; cy < 5; cy += 0.013) {
      const g = ladderGrips(cy, { bottom: 0, top: 7 });
      for (const k of ['handR', 'handL', 'footR', 'footL']) if (g[k].swing === 0) grips.push(g[k].y);
    }
    expect(grips.every((y) => onRung(y))).toBe(true);
  });
  it('moves opposite hand and foot together, and never lets both pairs swing at once', () => {
    for (let cy = 0; cy < 5; cy += 0.017) {
      const g = ladderGrips(cy, { bottom: 0, top: 7 });
      expect(g.handR.swing > 0).toBe(g.footL.swing > 0);
      expect(g.handL.swing > 0).toBe(g.footR.swing > 0);
      expect(g.handR.swing > 0 && g.handL.swing > 0).toBe(false);
    }
  });
  it('keeps every grip within reach of the body', () => {
    // A swinging limb runs a few centimetres ahead of the body mid-reach; a planted one never.
    const ahead = (g) => (g.swing > 0 ? 0.03 : 1e-6);
    for (let cy = 0.5; cy < 5; cy += 0.011) {
      const g = ladderGrips(cy, { bottom: 0, top: 7 });
      for (const k of ['handR', 'handL']) {
        expect(g[k].y - cy).toBeGreaterThanOrEqual(GAIT.HAND_R - GAIT.D / 2 - ahead(g[k]));
        expect(g[k].y - cy).toBeLessThanOrEqual(GAIT.HAND_R + ahead(g[k]));
      }
      for (const k of ['footR', 'footL']) {
        expect(g[k].y - cy).toBeGreaterThanOrEqual(GAIT.FOOT_R - GAIT.D / 2 - ahead(g[k]));
        expect(g[k].y - cy).toBeLessThanOrEqual(GAIT.FOOT_R + ahead(g[k]));
      }
    }
  });
  it('is continuous: no limb ever jumps between frames', () => {
    let prev = ladderGrips(0, { bottom: 0, top: 7 });
    for (let cy = 0.005; cy < 6; cy += 0.005) {
      const g = ladderGrips(cy, { bottom: 0, top: 7 });
      for (const k of ['handR', 'handL', 'footR', 'footL']) expect(Math.abs(g[k].y - prev[k].y)).toBeLessThan(0.05);
      prev = g;
    }
  });
  it('never reaches past the top of the ladder or below its foot', () => {
    for (let cy = 0; cy <= 6; cy += 0.01) {
      const g = ladderGrips(cy, { bottom: 0, top: 7 });
      for (const k of ['handR', 'handL', 'footR', 'footL']) {
        expect(g[k].y).toBeLessThanOrEqual(7 + 1e-6);
        expect(g[k].y).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
