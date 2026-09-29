import { describe, it, expect } from 'vitest';
import { createImpactTimeline, IMPACT } from '../../src/render/impactTimeline.js';

const out = () => ({ impact: 0, soft: false, freeze: false, panel: 0, panelT: 0 });

describe('impact timeline', () => {
  it('tier 1 is two beats, then nothing', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(1, 1000, 'full')).toBe(1);
    expect(tl.sample(1010, o).impact).toBe(1);
    expect(tl.sample(1060, o).impact).toBe(0.5);
    expect(o.freeze).toBe(false);
    expect(tl.sample(1100, o).impact).toBe(0);
    expect(tl.active).toBe(false);
  });
  it('tier 2 flashes, freezes inside the panel, then releases', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(2, 0, 'full')).toBe(2);
    expect(tl.sample(20, o)).toMatchObject({ impact: 1, freeze: false, panel: 0 });
    expect(tl.sample(200, o)).toMatchObject({ impact: IMPACT.freezeLook, freeze: true, panel: 1 });
    tl.sample(450, o);
    expect(o.panel).toBe(2);
    expect(o.freeze).toBe(false);
    expect(o.impact).toBeGreaterThan(0);
    expect(o.impact).toBeLessThan(IMPACT.freezeLook);
    expect(tl.sample(520, o)).toMatchObject({ impact: 0, panel: 0, freeze: false });
    expect(tl.active).toBe(false);
  });
  it('rate limits: tier 1 at most every 400 ms', () => {
    const tl = createImpactTimeline();
    expect(tl.trigger(1, 0, 'full')).toBe(1);
    tl.sample(200, out());
    expect(tl.trigger(1, 200, 'full')).toBe(0);
    expect(tl.trigger(1, 450, 'full')).toBe(1);
  });
  it('a tier 2 inside 1.5 s of the last one plays as tier 1', () => {
    const tl = createImpactTimeline();
    expect(tl.trigger(2, 0, 'full')).toBe(2);
    tl.sample(600, out());
    expect(tl.trigger(2, 600, 'full')).toBe(1);
    tl.sample(2000, out());
    expect(tl.trigger(2, 2000, 'full')).toBe(2);
  });
  it('the bigger tier wins: tier 2 replaces a running tier 1, tier 1 never interrupts tier 2', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(1, 0, 'full')).toBe(1);
    expect(tl.trigger(2, 20, 'full')).toBe(2);
    expect(tl.sample(20 + 200, o).freeze).toBe(true);
    expect(tl.trigger(1, 250, 'full')).toBe(0);
  });
  it('soft: no inversion beats, softer strength, tier 2 goes straight to the freeze', () => {
    const tl = createImpactTimeline(); const o = out();
    tl.trigger(1, 0, 'soft');
    expect(tl.sample(10, o)).toMatchObject({ impact: IMPACT.soft, soft: true });
    const t2 = createImpactTimeline();
    t2.trigger(2, 0, 'soft');
    expect(t2.sample(10, o)).toMatchObject({ freeze: true, panel: 1, soft: true });
  });
  it('off starts nothing, and cancel stops a running sequence', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(2, 0, 'off')).toBe(0);
    expect(tl.sample(10, o).impact).toBe(0);
    tl.trigger(2, 0, 'full');
    tl.cancel();
    expect(tl.sample(200, o)).toMatchObject({ impact: 0, freeze: false, panel: 0 });
  });
  it('reset forgets the rate limits (test hook)', () => {
    const tl = createImpactTimeline();
    tl.trigger(2, 0, 'full');
    tl.reset();
    expect(tl.trigger(2, 100, 'full')).toBe(2);
  });
});
