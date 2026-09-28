import { describe, it, expect } from 'vitest';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeGadgetSave } from '../../src/gadgets/gadgetSave.js';

describe('gadgets save field', () => {
  it('defaults', () => {
    expect(sanitizeProgress({}).gadgets).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [], wheelUsed: false });
  });
  it('drops junk and duplicates', () => {
    expect(sanitizeGadgetSave({ equipped: 'laser', unlocked: ['gel', 'gel', 'laser', 3], broken: ['wallMonarchBooth', 'x', 'wallMonarchBooth'], caches: ['cacheColdStore', 9] }))
      .toEqual({ equipped: 'batarang', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'], wheelUsed: false });
    expect(sanitizeGadgetSave('x')).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [], wheelUsed: false });
  });
  it('a new game keeps gadgets, broken walls and caches', () => {
    const p = sanitizeProgress({ step: 12, gadgets: { equipped: 'gel', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'] } });
    expect(newGameProgress(p).gadgets).toEqual(p.gadgets);
  });
  it('wheelUsed: only a real true survives; an old save without it reads false', () => {
    expect(sanitizeGadgetSave({ wheelUsed: true }).wheelUsed).toBe(true);
    expect(sanitizeGadgetSave({ wheelUsed: 'yes' }).wheelUsed).toBe(false);
    expect(sanitizeProgress({ step: 30, finished: true, gadgets: { equipped: 'gel' } }).gadgets.wheelUsed).toBe(false);
    const p = sanitizeProgress({ gadgets: { wheelUsed: true } });
    expect(newGameProgress(p).gadgets.wheelUsed).toBe(true);
  });
});
