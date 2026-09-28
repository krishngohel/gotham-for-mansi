import { describe, it, expect } from 'vitest';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeGadgetSave } from '../../src/gadgets/gadgetSave.js';

describe('gadgets save field', () => {
  it('defaults', () => {
    expect(sanitizeProgress({}).gadgets).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [] });
  });
  it('drops junk and duplicates', () => {
    expect(sanitizeGadgetSave({ equipped: 'laser', unlocked: ['gel', 'gel', 'laser', 3], broken: ['wallMonarchBooth', 'x', 'wallMonarchBooth'], caches: ['cacheColdStore', 9] }))
      .toEqual({ equipped: 'batarang', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'] });
    expect(sanitizeGadgetSave('x')).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [] });
  });
  it('a new game keeps gadgets, broken walls and caches', () => {
    const p = sanitizeProgress({ step: 12, gadgets: { equipped: 'gel', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'] } });
    expect(newGameProgress(p).gadgets).toEqual(p.gadgets);
  });
});
