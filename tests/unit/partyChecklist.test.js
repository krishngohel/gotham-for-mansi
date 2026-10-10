import { describe, it, expect } from 'vitest';
import { STEPS } from '../../src/game/story.js';
import { CHECKLIST, checklistAt, tickedBy } from '../../src/game/partyChecklist.js';

const idx = (id) => STEPS.findIndex((s) => s.id === id);
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('party checklist', () => {
  it('has five items in story order, each ticked by a real step', () => {
    expect(CHECKLIST.map((c) => c.id)).toEqual(['gifts', 'gear', 'fireworks', 'cake', 'guests']);
    const at = CHECKLIST.map((c) => idx(c.step));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('nothing is back at the start, everything by the boss', () => {
    expect(checklistAt(0, STEPS).every((c) => !c.done)).toBe(true);
    expect(checklistAt(idx('boss'), STEPS).every((c) => c.done)).toBe(true);
  });
  it('an item is done from its own step on, not before', () => {
    for (const c of CHECKLIST) {
      expect(checklistAt(idx(c.step) - 1, STEPS).find((x) => x.id === c.id).done).toBe(false);
      expect(checklistAt(idx(c.step), STEPS).find((x) => x.id === c.id).done).toBe(true);
    }
  });
  it('tickedBy finds the item for its step only', () => {
    expect(tickedBy('toNeon').id).toBe('gifts');
    expect(tickedBy('f1')).toBe(null);
  });
  it('copy is filled in and has no dashes', () => {
    for (const c of CHECKLIST) for (const s of [c.label, c.got]) { expect(s.length).toBeGreaterThan(2); expect(s).not.toMatch(DASH); }
  });
});
