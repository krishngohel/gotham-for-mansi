// tests/unit/engineCurve.test.js
import { describe, it, expect } from 'vitest';
import { engineParams, ENGINE_KINDS } from '../../src/audio/engineCurve.js';

describe('engineParams', () => {
  it('climbs frequency and volume with speed for every kind', () => {
    for (const kind of ENGINE_KINDS) {
      const low = engineParams(kind, 0, false);
      const mid = engineParams(kind, 0.5, false);
      const high = engineParams(kind, 1, false);
      expect(mid.freq).toBeGreaterThan(low.freq);
      expect(high.freq).toBeGreaterThan(mid.freq);
      expect(mid.vol).toBeGreaterThan(low.vol);
      expect(high.vol).toBeGreaterThan(mid.vol);
      expect(mid.noise).toBeGreaterThan(low.noise);
      expect(high.noise).toBeGreaterThan(mid.noise);
    }
  });

  it('clamps speedFrac outside 0..1', () => {
    const under = engineParams('car', -5, false);
    const over = engineParams('car', 50, false);
    const zero = engineParams('car', 0, false);
    const one = engineParams('car', 1, false);
    expect(under.freq).toBeCloseTo(zero.freq, 5);
    expect(over.freq).toBeCloseTo(one.freq, 5);
  });

  it('only the Batmobile gets a boost layer, and only when boosting', () => {
    expect(engineParams('batmobile', 0.5, false).boostVol).toBe(0);
    expect(engineParams('batmobile', 0.5, true).boostVol).toBeGreaterThan(0);
    expect(engineParams('car', 0.5, true).boostVol).toBe(0);
    expect(engineParams('wing', 0.5, true).boostVol).toBe(0);
  });

  it('the Batmobile is deeper and louder than the civilian car at every speed', () => {
    for (const s of [0, 0.3, 0.6, 1]) {
      const bm = engineParams('batmobile', s, false);
      const car = engineParams('car', s, false);
      expect(bm.freq).toBeLessThan(car.freq);
      expect(bm.vol).toBeGreaterThan(car.vol);
    }
  });

  it('writes into a reusable output object instead of always allocating', () => {
    const scratch = {};
    const ret = engineParams('wing', 0.4, false, scratch);
    expect(ret).toBe(scratch);
    expect(scratch.freq).toBeGreaterThan(0);
  });

  it('never exceeds the tuned max at speedFrac 1 for any kind', () => {
    // loop:glide peaks around 0.25 and loop:rain around 0.35 in the offline self-check; the
    // engine loops are tuned to sit comfortably under both even before mixer attenuation.
    for (const kind of ENGINE_KINDS) {
      const p = engineParams(kind, 1, kind === 'batmobile');
      expect(p.vol).toBeLessThan(0.4);
      expect(p.vol + p.boostVol).toBeLessThan(0.7);
    }
  });
});
