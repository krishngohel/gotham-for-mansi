// Harley Quinn's pure move-choice, timing and glyph helpers (src/combat/harleyLogic.js).
import { describe, it, expect } from 'vitest';
import { chooseHarleyMove, shouldCartwheel, harleyGlyph, harleyWindup, harleyRecover, HARLEY_MOVES } from '../../src/combat/harleyLogic.js';

describe('chooseHarleyMove', () => {
  it('picks the slam or sweep at melee range when both are ready', () => {
    const move = chooseHarleyMove(2, { slam: 0, sweep: 0, throw: 0 }, 0);
    expect(['slam', 'sweep']).toContain(move);
  });

  it('picks the throw at range, never the melee moves', () => {
    const move = chooseHarleyMove(8, { slam: 0, sweep: 0, throw: 0 }, 0.5);
    expect(move).toBe('throw');
  });

  it('returns null with everything on cooldown', () => {
    expect(chooseHarleyMove(2, { slam: 1, sweep: 1, throw: 1 }, 0)).toBeNull();
  });

  it('returns null at melee range with only the throw off cooldown (out of its minimum range)', () => {
    expect(chooseHarleyMove(1.5, { slam: 1, sweep: 1, throw: 0 }, 0)).toBeNull();
  });

  it('skips a move still on cooldown even in range', () => {
    const move = chooseHarleyMove(2, { slam: 0.4, sweep: 0, throw: 0 }, 0);
    expect(move).toBe('sweep');
  });

  it('is deterministic for a given rng01: same inputs, same output', () => {
    const a = chooseHarleyMove(2, { slam: 0, sweep: 0, throw: 0 }, 0.9);
    const b = chooseHarleyMove(2, { slam: 0, sweep: 0, throw: 0 }, 0.9);
    expect(a).toBe(b);
  });

  it('never picks the throw within melee range even when it alone is off cooldown, if she is too close for it', () => {
    // throw's range floor is the slam range: inside that she has nothing ready but melee moves.
    const move = chooseHarleyMove(1, { slam: 0, sweep: 0, throw: 0 }, 0.99);
    expect(['slam', 'sweep']).toContain(move);
  });
});

describe('shouldCartwheel', () => {
  it('never cartwheels when not engaged', () => {
    expect(shouldCartwheel(false, 0, 0)).toBe(false);
  });

  it('never cartwheels on cooldown, however lucky the roll', () => {
    expect(shouldCartwheel(true, 0.5, 0)).toBe(false);
  });

  it('rolls under the chance threshold to cartwheel', () => {
    expect(shouldCartwheel(true, 0, 0.1, 0.35)).toBe(true);
    expect(shouldCartwheel(true, 0, 0.9, 0.35)).toBe(false);
  });
});

describe('glyph and timing windows', () => {
  it('the slam and sweep both show the red (dodge, not block) glyph', () => {
    expect(harleyGlyph('slam')).toBe('red');
    expect(harleyGlyph('sweep')).toBe('red');
  });

  it('the thrown pie/confetti has no telegraph glyph', () => {
    expect(harleyGlyph('throw')).toBeNull();
  });

  it('an unknown move has no glyph', () => {
    expect(harleyGlyph('nonsense')).toBeNull();
  });

  it('the slam is telegraphed longest, so it reads as the big, dodge-only hit', () => {
    expect(harleyWindup('slam')).toBeGreaterThan(harleyWindup('sweep'));
    expect(harleyWindup('sweep')).toBeGreaterThan(harleyWindup('throw'));
  });

  it('every move recovers faster than it telegraphs', () => {
    for (const name of Object.keys(HARLEY_MOVES)) {
      expect(harleyRecover(name)).toBeLessThan(harleyWindup(name));
    }
  });

  it('falls back to the given default for an unknown move', () => {
    expect(harleyWindup('nonsense', 0.42)).toBe(0.42);
    expect(harleyRecover('nonsense', 0.33)).toBe(0.33);
  });
});
