import { describe, it, expect } from 'vitest';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeVanChaseSave } from '../../src/game/vanChaseSave.js';
import { tracker } from '../../src/game/progressTracker.js';

describe('van chases save field', () => {
  it('defaults to 0', () => {
    expect(sanitizeProgress({}).vanChases).toEqual({ stopped: 0 });
  });
  it('keeps a real positive count and drops junk', () => {
    expect(sanitizeVanChaseSave({ stopped: 7 })).toEqual({ stopped: 7 });
    expect(sanitizeVanChaseSave({ stopped: -3 })).toEqual({ stopped: 0 });
    expect(sanitizeVanChaseSave({ stopped: 'nope' })).toEqual({ stopped: 0 });
    expect(sanitizeVanChaseSave('x')).toEqual({ stopped: 0 });
    expect(sanitizeVanChaseSave(undefined)).toEqual({ stopped: 0 });
  });
  it('a new game keeps the lifetime count, same as street crimes', () => {
    const p = sanitizeProgress({ step: 12, vanChases: { stopped: 4 } });
    expect(newGameProgress(p).vanChases).toEqual({ stopped: 4 });
  });
  it('registers a small progress category, written without a dash', () => {
    const s = tracker.score(sanitizeProgress({ vanChases: { stopped: 2 } }));
    const part = s.parts.find((p) => p.id === 'vanChases');
    expect(part).toMatchObject({ weight: 3, done: 2, total: 5 });
    expect(part.detail).not.toMatch(/[–—]/);
    const full = tracker.score(sanitizeProgress({ vanChases: { stopped: 50 } }));
    expect(full.parts.find((p) => p.id === 'vanChases').done).toBe(5);
  });
});
