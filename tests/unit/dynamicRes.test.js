import { describe, it, expect } from 'vitest';
import { createDynamicRes, snapRefresh } from '../../src/render/dynamicRes.js';

// Feeds `seconds` of frames spaced `dt` ms apart, with a work estimate per frame.
const run = (d, seconds, dt, busy = null) => { for (let t = 0; t < seconds * 1000; t += dt) d.update(dt, typeof busy === 'function' ? busy(t) : busy); };
const hz144 = 1000 / 144;

describe('dynamic resolution', () => {
  it('snaps measured rates to common refresh rates', () => {
    expect(snapRefresh(143.2)).toBe(144);
    expect(snapRefresh(59.4)).toBe(60);
    expect(snapRefresh(238)).toBe(240);
  });

  it('measures the refresh rate from the first frames', () => {
    const d = createDynamicRes();
    run(d, 1, hz144, 2);
    expect(d.refreshHz).toBe(144);
    expect(d.scale).toBe(1);
  });

  it('holds full scale while frames arrive on time', () => {
    const d = createDynamicRes();
    run(d, 30, hz144, 3);
    expect(d.scale).toBe(1);
  });

  it('steps down when frames miss the refresh, never below the floor', () => {
    const changes = [];
    const d = createDynamicRes({ onChange: (s) => changes.push(s) });
    run(d, 1, hz144, 3);
    run(d, 30, hz144 * 2, 12);
    expect(d.scale).toBeCloseTo(0.6);
    expect(changes.every((s, i) => i === 0 || s < changes[i - 1])).toBe(true);
  });

  it('climbs back up once frames are on time again, and does not oscillate', () => {
    const changes = [];
    const d = createDynamicRes({ onChange: (s) => changes.push(s) });
    run(d, 1, hz144, 3);
    run(d, 3, hz144 * 2, 12);
    const low = d.scale;
    expect(low).toBeLessThan(1);
    run(d, 30, hz144, 2); // plenty of headroom: back to full
    expect(d.scale).toBe(1);
    const ups = changes.filter((s, i) => i > 0 && s > changes[i - 1]).length;
    const downs = changes.filter((s, i) => i > 0 && s < changes[i - 1]).length;
    expect(ups + downs).toBe(changes.length - 1);
    expect(changes.length).toBeLessThan(20);
  });

  it('backs off its upward probes when they bring misses back', () => {
    const d = createDynamicRes();
    run(d, 1, hz144, null);
    run(d, 4, hz144 * 2, null);
    const low = d.scale;
    // Frames miss whenever the scale is above `low`: probes must get rarer, not keep pumping.
    let changes = 0, last = d.scale;
    for (let t = 0; t < 120000; t += hz144) {
      d.update(d.scale > low + 1e-6 ? hz144 * 2 : hz144, null);
      if (d.scale !== last) { changes += 1; last = d.scale; }
    }
    expect(changes).toBeLessThan(14);
  });

  it('settles when misses come from load it cannot measure', () => {
    const d = createDynamicRes();
    run(d, 1, hz144, 2);
    run(d, 4, hz144 * 2, 2);
    const low = d.scale;
    let changes = 0, last = d.scale;
    for (let t = 0; t < 120000; t += hz144) {
      d.update(d.scale > low + 1e-6 ? hz144 * 2 : hz144, 2);
      if (d.scale !== last) { changes += 1; last = d.scale; }
    }
    expect(changes).toBeLessThan(14);
    expect(d.scale).toBeLessThanOrEqual(low + 0.05 + 1e-6);
  });

  it('reports full scale when switched off', () => {
    const d = createDynamicRes();
    run(d, 1, hz144, 3);
    run(d, 5, hz144 * 2, 12);
    d.setEnabled(false);
    expect(d.scale).toBe(1);
  });
});
