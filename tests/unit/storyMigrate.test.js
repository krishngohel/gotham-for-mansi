import { describe, it, expect } from 'vitest';
import '../../src/gadgets/gadgetSave.js'; // registers progress.gadgets, as game.js does before loading
import { STEPS } from '../../src/game/story.js';
import { LEGACY_STEP_IDS, resolveStep, migrateProgress } from '../../src/game/storyMigrate.js';
import { sanitizeProgress, loadProgress, saveProgress, newGameProgress } from '../../src/core/save.js';
import { GADGETS, isUnlocked } from '../../src/gadgets/gadgetDefs.js';
import { tracker } from '../../src/game/progressTracker.js';

const idx = (id) => STEPS.findIndex((s) => s.id === id);
const NEW_IDS = ['monarchBalcony', 'aceCatwalks'];
const KEY = 'gotham-mansi-progress-v1';
const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
// What the game does on start: read localStorage, then place the save on the story.
const loadRaw = (raw) => migrateProgress(loadProgress(memStorage({ [KEY]: JSON.stringify(raw) })));

describe('story steps', () => {
  it('the balcony comes right before the party and the catwalks right before the cake', () => {
    expect(STEPS[idx('monarchBalcony') - 1].id).toBe('n3');
    expect(STEPS[idx('monarchBalcony') + 1].id).toBe('party');
    expect(STEPS[idx('aceCatwalks') - 1].id).toBe('a3');
    expect(STEPS[idx('aceCatwalks') + 1].id).toBe('cake');
    for (const id of ['monarchBalcony', 'aceCatwalks']) expect(STEPS[idx(id)]).toMatchObject({ type: 'fight', fight: id, checkpoint: `${id}Entry` });
  });
  it('LEGACY_STEP_IDS is the story as it was before Part D', () => {
    expect(STEPS.map((s) => s.id).filter((id) => id !== 'monarchBalcony' && id !== 'aceCatwalks')).toEqual(LEGACY_STEP_IDS);
  });
  it('LEGACY_STEP_IDS is exactly the list the live site shipped (31 steps)', () => {
    expect(LEGACY_STEP_IDS).toEqual([
      'intro', 'signal', 'card', 'toDocks', 'f1', 'toYard', 'f2', 'toShip', 'f3', 'presents', 'rewardPresents',
      'toNeon', 'n1', 'toStreet', 'n2', 'toMonarch', 'n3', 'party', 'rewardParty',
      'toAce', 'a1', 'toFactory', 'a2', 'toVat', 'a3', 'cake', 'rewardCake', 'toTower', 'boss', 'finale', 'credits',
    ]);
    expect(Object.isFrozen(LEGACY_STEP_IDS)).toBe(true);
    expect(STEPS).toHaveLength(LEGACY_STEP_IDS.length + 2);
  });
  it('the new story text avoids em and en dashes', () => {
    for (const id of NEW_IDS) expect(STEPS[idx(id)].text).not.toMatch(/[–—]/);
  });
});

describe('resolveStep', () => {
  it('uses the saved step id when there is one', () => {
    expect(resolveStep({ step: 3, stepId: 'party' })).toBe(idx('party'));
    expect(resolveStep({ step: 0, stepId: 'aceCatwalks' })).toBe(idx('aceCatwalks'));
  });
  it('reads an old save (no id) against the old step list', () => {
    const old = (id) => LEGACY_STEP_IDS.indexOf(id);
    expect(resolveStep({ step: old('toDocks') })).toBe(idx('toDocks'));
    expect(resolveStep({ step: old('party') })).toBe(idx('party'));
    expect(resolveStep({ step: old('cake') })).toBe(idx('cake'));
    expect(resolveStep({ step: old('credits') })).toBe(idx('credits'));
    expect(resolveStep({ step: 999 })).toBe(STEPS.length);
  });
  it('an unknown id falls back to the old index', () => {
    expect(resolveStep({ step: LEGACY_STEP_IDS.indexOf('boss'), stepId: 'gone' })).toBe(idx('boss'));
  });
  it('stepId is a saved field that survives sanitizing and rejects junk', () => {
    expect(sanitizeProgress({ stepId: 'party' }).stepId).toBe('party');
    expect(sanitizeProgress({ stepId: 42 }).stepId).toBe(null);
    expect(sanitizeProgress({ stepId: '<script>' }).stepId).toBe(null);
    expect(sanitizeProgress({}).stepId).toBe(null);
  });
});

describe('every pre-Part D save keeps its place', () => {
  it('an old save at every old index lands on the same step id', () => {
    LEGACY_STEP_IDS.forEach((id, old) => {
      const p = loadRaw({ step: old });
      expect(STEPS[p.step].id, `old index ${old}`).toBe(id);
      expect(p.stepId, `old index ${old}`).toBe(id);
    });
  });
  it('an old save never lands on a stealth step', () => {
    for (let old = 0; old <= LEGACY_STEP_IDS.length; old++) {
      const p = loadRaw({ step: old });
      expect(NEW_IDS).not.toContain(STEPS[p.step]?.id);
    }
  });
  it('saves on either side of each insertion point', () => {
    // Before: still to play n3 / a3, so the stealth step comes next.
    expect(STEPS[loadRaw({ step: LEGACY_STEP_IDS.indexOf('n3') }).step + 1].id).toBe('monarchBalcony');
    expect(STEPS[loadRaw({ step: LEGACY_STEP_IDS.indexOf('a3') }).step + 1].id).toBe('aceCatwalks');
    // After: already past it, so it is simply skipped.
    expect(loadRaw({ step: LEGACY_STEP_IDS.indexOf('party') })).toMatchObject({ step: idx('party'), stepId: 'party' });
    expect(loadRaw({ step: LEGACY_STEP_IDS.indexOf('cake') })).toMatchObject({ step: idx('cake'), stepId: 'cake' });
    // The live site's party index (17) now sits at 18.
    expect(loadRaw({ step: 17, balloons: [], suit: 'm' })).toMatchObject({ step: 18, stepId: 'party', suit: 'm' });
  });
  it('gadgets unlocked at every old index are the same after moving', () => {
    LEGACY_STEP_IDS.forEach((_, old) => {
      const legacy = LEGACY_STEP_IDS.map((id) => ({ id }));
      const before = GADGETS.filter((g) => isUnlocked(g, { step: old, finished: false }, legacy)).map((g) => g.id);
      const after = GADGETS.filter((g) => isUnlocked(g, loadRaw({ step: old }), STEPS)).map((g) => g.id);
      expect(after, `old index ${old}`).toEqual(before);
    });
  });
  it('a finished save stays finished with everything it found', () => {
    const raw = {
      step: LEGACY_STEP_IDS.indexOf('credits'), finished: true, seenIntro: true, suit: 'gold', goldUnlocked: true,
      balloons: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], unlocks: ['goldStandard', 'fromKrishn'], moves: ['ladder'],
      districts: ['docks'], milestone: 100, challenges: { rooftop: { best: 12, medal: 'gold' } },
      gadgets: { equipped: 'gel', unlocked: ['remote', 'gel'], broken: [], caches: [] },
    };
    const p = loadRaw(raw);
    expect(p).toMatchObject({
      step: idx('credits'), stepId: 'credits', finished: true, seenIntro: true, suit: 'gold', goldUnlocked: true,
      balloons: raw.balloons, unlocks: raw.unlocks, milestone: 100, challenges: raw.challenges,
    });
    expect(p.gadgets.unlocked).toEqual(['remote', 'gel']);
    expect(tracker.categories.find((c) => c.id === 'story').count(p)).toEqual({ done: STEPS.length - 1, total: STEPS.length - 1 });
    for (const g of GADGETS) expect(isUnlocked(g, p, STEPS), g.id).toBe(true);
  });
  it('a save past the end (objectives done) stays past the end', () => {
    expect(loadRaw({ step: LEGACY_STEP_IDS.length, finished: true })).toMatchObject({ step: STEPS.length, stepId: null, finished: true });
  });
  it('a fresh save starts at the intro', () => {
    expect(loadRaw({})).toMatchObject({ step: 0, stepId: 'intro' });
    expect(migrateProgress(loadProgress(memStorage()))).toMatchObject({ step: 0, stepId: 'intro' });
    const fresh = { ...newGameProgress(loadRaw({ step: 20, stepId: 'a1', balloons: [3] })), stepId: null };
    expect(migrateProgress(fresh)).toMatchObject({ step: 0, stepId: 'intro', balloons: [3] });
  });
  it('malformed saves fall back safely', () => {
    for (const step of [undefined, null, -1, -999, 1.5, NaN, '17', true, [], {}]) {
      expect(loadRaw({ step }), String(step)).toMatchObject({ step: 0, stepId: 'intro' });
    }
    expect(loadRaw({ step: 1e9 })).toMatchObject({ step: STEPS.length, stepId: null });
    expect(loadRaw({ step: 17, stepId: 'gone' })).toMatchObject({ step: idx('party'), stepId: 'party' });
    expect(loadRaw({ step: 17, stepId: 42 })).toMatchObject({ step: idx('party'), stepId: 'party' });
    expect(loadRaw({ step: 17, stepId: '' })).toMatchObject({ step: idx('party'), stepId: 'party' });
    expect(migrateProgress(loadProgress(memStorage({ [KEY]: '{not json' })))).toMatchObject({ step: 0, stepId: 'intro' });
    expect(resolveStep({})).toBe(0);
  });
  it('a saved id wins over a stale index', () => {
    expect(loadRaw({ step: 0, stepId: 'monarchBalcony' })).toMatchObject({ step: idx('monarchBalcony'), stepId: 'monarchBalcony' });
    expect(loadRaw({ step: 5, stepId: 'credits', finished: true })).toMatchObject({ step: idx('credits'), finished: true });
  });
  it('migrating is stable across save and reload', () => {
    for (let old = 0; old <= LEGACY_STEP_IDS.length; old++) {
      const once = loadRaw({ step: old, balloons: [1] });
      const storage = memStorage();
      saveProgress(storage, once);
      const twice = migrateProgress(loadProgress(storage));
      expect(twice, `old index ${old}`).toEqual(once);
    }
  });
});
