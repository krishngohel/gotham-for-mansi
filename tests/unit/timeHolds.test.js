import { describe, it, expect } from 'vitest';
import { createTimeControl } from '../../src/core/time.js';

describe('time holds', () => {
  it('a hold scales game time until it is released', () => {
    const t = createTimeControl();
    t.hold('wheel', 0.2);
    expect(t.scale(0.1)).toBeCloseTo(0.02);
    expect(t.held).toBeCloseTo(0.2);
    t.release('wheel');
    expect(t.scale(0.1)).toBeCloseTo(0.1);
    expect(t.held).toBe(1);
  });
  it('the slowest hold wins, and it stacks with slow motion', () => {
    const t = createTimeControl();
    t.hold('a', 0.5);
    t.hold('b', 0.2);
    expect(t.scale(0.1)).toBeCloseTo(0.02);
    t.slowMo(1, 0.5);
    expect(t.scale(0.1)).toBeCloseTo(0.01);
    t.release('b');
    expect(t.scale(0.1)).toBeCloseTo(0.025);
  });
  it('hit-stop still freezes time under a hold', () => {
    const t = createTimeControl();
    t.hold('wheel', 0.2);
    t.hitStop(0.05);
    expect(t.scale(0.03)).toBe(0);
    expect(t.scale(0.1)).toBeCloseTo(0.08 * 0.2);
  });
  it('releasing an unknown hold is harmless, and scales are clamped', () => {
    const t = createTimeControl();
    t.release('nope');
    t.hold('x', 5);
    expect(t.held).toBe(1);
    t.hold('x', -1);
    expect(t.held).toBeCloseTo(0.01);
  });
});

describe('time holds: release all', () => {
  it('releaseAll drops every hold at once (pause, death, a cutscene, a new run)', () => {
    const t = createTimeControl();
    t.hold('wheel', 0.2);
    t.hold('remote', 0.3);
    t.releaseAll();
    expect(t.held).toBe(1);
    expect(t.scale(0.1)).toBeCloseTo(0.1);
    t.releaseAll();
    expect(t.held).toBe(1);
  });
});
