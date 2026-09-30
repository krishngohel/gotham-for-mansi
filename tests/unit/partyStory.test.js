// tests/unit/partyStory.test.js
import { describe, it, expect } from 'vitest';
import { STEP_GUESTS, FINALE_STEP_ID, guestsUpTo, celebrateAt } from '../../src/game/partyStory.js';
import { GUEST_IDS } from '../../src/game/partySlots.js';

// A small stand-in step list, same shape as story.js's STEPS (only id matters here).
const steps = ['a', 'aceClueRadio', 'b', 'cake', 'rewardCake', 'c', 'crasherReveal', 'd', 'rescueGuestsRadio', 'e', 'finale', 'credits']
  .map((id) => ({ id }));
const at = (id) => steps.findIndex((s) => s.id === id);

describe('STEP_GUESTS', () => {
  it('every mapped guest is a real guest id from partySlots.js', () => {
    for (const guests of Object.values(STEP_GUESTS)) for (const g of guests) expect(GUEST_IDS).toContain(g);
  });
  it('every guest id is covered by exactly one step', () => {
    const seen = new Set();
    for (const guests of Object.values(STEP_GUESTS)) for (const g of guests) { expect(seen.has(g)).toBe(false); seen.add(g); }
    expect([...seen].sort()).toEqual([...GUEST_IDS].sort());
  });
});

describe('guestsUpTo', () => {
  it('adds nothing before any join step', () => {
    expect(guestsUpTo(0, steps)).toEqual([]);
  });
  it('adds the dj right at aceClueRadio, not before', () => {
    expect(guestsUpTo(at('aceClueRadio') - 1, steps)).not.toContain('dj');
    expect(guestsUpTo(at('aceClueRadio'), steps)).toContain('dj');
  });
  it('accumulates guests as the story advances (a save resumed further along)', () => {
    const mid = guestsUpTo(at('crasherReveal'), steps).sort();
    expect(mid).toEqual(['baker', 'dj', 'nightwing'].sort());
  });
  it('has every guest by the finale', () => {
    expect(guestsUpTo(at('finale'), steps).sort()).toEqual([...GUEST_IDS].sort());
  });
  it('an id with no matching step contributes nothing (missing part / renamed step)', () => {
    const r = guestsUpTo(99, steps, { notAStep: ['dj'] });
    expect(r).toEqual([]);
  });
});

describe('celebrateAt', () => {
  it('is false before the finale step and true at or after it', () => {
    expect(celebrateAt(at('finale') - 1, steps)).toBe(false);
    expect(celebrateAt(at('finale'), steps)).toBe(true);
    expect(celebrateAt(at('credits'), steps)).toBe(true);
  });
  it('is false if the finale id is not found in steps at all', () => {
    expect(celebrateAt(5, steps, 'noSuchStep')).toBe(false);
  });
  it('uses FINALE_STEP_ID by default, matching story.js\'s own finale step id', () => {
    expect(FINALE_STEP_ID).toBe('finale');
  });
});
