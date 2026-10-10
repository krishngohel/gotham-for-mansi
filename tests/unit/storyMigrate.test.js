import { describe, it, expect } from 'vitest';
import '../../src/gadgets/gadgetSave.js'; // registers progress.gadgets, as game.js does before loading
import { STEPS, tutorialFor, CATCH_UP } from '../../src/game/story.js';
import { PROMPT_IDS } from '../../src/ui/prompts.js';
import { resolveStep, migrateProgress } from '../../src/game/storyMigrate.js';
import { sanitizeProgress, loadProgress, saveProgress, newGameProgress, registerProgressField } from '../../src/core/save.js';
import { GADGETS, isUnlocked } from '../../src/gadgets/gadgetDefs.js';
import { tracker } from '../../src/game/progressTracker.js';

const idx = (id) => STEPS.findIndex((s) => s.id === id);
const KEY = 'gotham-mansi-progress-v2';
const memStorage = (init = {}) => {
  const m = new Map(Object.entries(init));
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};
// What the game does on start: read localStorage, then place the save on the story.
const loadRaw = (raw) => migrateProgress(loadProgress(memStorage({ [KEY]: JSON.stringify(raw) })));

// Part S is a full reset: progress now lives under gotham-mansi-progress-v2, and a save's place in
// the story comes only from its own stepId. There is no old data under this key, so there is
// nothing to migrate from a numeric index; a save with no id (or an id that no longer exists, say
// after some future step is renamed) simply starts over at the top.
describe('resolveStep: stepId only, no numeric fallback', () => {
  it('uses the saved step id when there is one', () => {
    expect(resolveStep({ step: 3, stepId: 'party' })).toBe(idx('party'));
    expect(resolveStep({ step: 0, stepId: 'aceCatwalks' })).toBe(idx('aceCatwalks'));
  });
  it('an id that no longer exists starts over, whatever the numeric step says', () => {
    expect(resolveStep({ step: 17, stepId: 'gone' })).toBe(0);
    expect(resolveStep({ step: 999, stepId: 'gone' })).toBe(0);
  });
  it('a save on a retired step lands on the step that replaced it', () => {
    expect(resolveStep({ stepId: 'armadaRun' })).toBe(idx('nightwingTagRadio'));
  });
  it('no id at all starts over', () => {
    expect(resolveStep({})).toBe(0);
    expect(resolveStep({ step: 25 })).toBe(0);
  });
  it('stepId is a saved field that survives sanitizing and rejects junk', () => {
    expect(sanitizeProgress({ stepId: 'party' }).stepId).toBe('party');
    expect(sanitizeProgress({ stepId: 42 }).stepId).toBe(null);
    expect(sanitizeProgress({ stepId: '<script>' }).stepId).toBe(null);
    expect(sanitizeProgress({}).stepId).toBe(null);
  });
});

describe('migrateProgress under the new key', () => {
  it('a fresh save starts at the intro', () => {
    expect(loadRaw({})).toMatchObject({ step: 0, stepId: 'intro' });
    expect(migrateProgress(loadProgress(memStorage()))).toMatchObject({ step: 0, stepId: 'intro' });
  });
  it('a save mid-story resumes on the same step id, and stays stable across save and reload', () => {
    for (const id of ['toDocks', 'party', 'monarchBalcony', 'aceCatwalks', 'cake', 'boss', 'credits']) {
      const once = loadRaw({ stepId: id, balloons: [1] });
      expect(once, id).toMatchObject({ step: idx(id), stepId: id });
      const storage = memStorage();
      saveProgress(storage, once);
      expect(migrateProgress(loadProgress(storage)), id).toEqual(once);
    }
  });
  it('a finished save stays finished with everything it found', () => {
    const raw = {
      stepId: 'credits', finished: true, seenIntro: true, suit: 'gold', goldUnlocked: true,
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
    expect(loadRaw({ stepId: 'gone', finished: true, step: STEPS.length })).toMatchObject({ step: 0, stepId: 'intro', finished: true });
  });
  it('newGameProgress clears the step id, keeping what was found, and resets cleanly into the new game', () => {
    const done = loadRaw({
      stepId: 'credits', finished: true, balloons: [0, 5],
      gadgets: { equipped: 'gel', unlocked: ['remote', 'gel'], broken: [], caches: [] },
    });
    expect(done.stepId).toBe('credits');
    const fresh = newGameProgress(done);
    expect(fresh).toMatchObject({ step: 0, stepId: null, finished: false, suit: null, balloons: [0, 5] });
    expect(fresh.gadgets.unlocked).toEqual(['remote', 'gel']);
    expect(migrateProgress(fresh)).toMatchObject({ step: 0, stepId: 'intro' });
    const storage = memStorage();
    saveProgress(storage, fresh);
    expect(migrateProgress(loadProgress(storage))).toMatchObject({ step: 0, stepId: 'intro', finished: false });
  });
  it('a registered field with no fresh value survives a new game, one with a fresh value resets', () => {
    const undoKeep = registerProgressField('testKeep', { sanitize: (v) => (typeof v === 'number' ? v : 0) });
    const undoReset = registerProgressField('testReset', { sanitize: (v) => (typeof v === 'number' ? v : 0), fresh: 7 });
    try {
      expect(newGameProgress({ testKeep: 3, testReset: 3 })).toMatchObject({ testKeep: 3, testReset: 7 });
    } finally { undoKeep(); undoReset(); }
    expect(newGameProgress({ testReset: 3 })).not.toHaveProperty('testReset');
  });
  it('malformed saves fall back safely to the intro', () => {
    for (const stepId of [undefined, null, -1, 1.5, NaN, 17, true, [], {}, '<script>']) {
      expect(loadRaw({ stepId }), String(stepId)).toMatchObject({ step: 0, stepId: 'intro' });
    }
    expect(migrateProgress(loadProgress(memStorage({ [KEY]: '{not json' })))).toMatchObject({ step: 0, stepId: 'intro' });
    expect(resolveStep({})).toBe(0);
  });
  it('the old v1 key is never read: a save there has no effect on a v2 load', () => {
    const storage = memStorage({ 'gotham-mansi-progress-v1': JSON.stringify({ step: 25, stepId: 'cake', finished: true }) });
    expect(migrateProgress(loadProgress(storage))).toMatchObject({ step: 0, stepId: 'intro', finished: false });
  });
});

describe('tutorialFor and CATCH_UP', () => {
  it('the catwalks teach the basics first to a save that skipped the balcony', () => {
    const cat = STEPS[idx('aceCatwalks')];
    expect(tutorialFor(cat, [])).toEqual(['crouch', 'silent', 'perch', 'perchDrop', 'distract', 'vent', 'ledgeStealth']);
    expect(tutorialFor(cat, ['perchDrop'])).toEqual(['crouch', 'silent', 'distract', 'vent', 'ledgeStealth']);
    expect(tutorialFor(cat, ['silentTakedown'])).toEqual(['perch', 'perchDrop', 'distract', 'vent', 'ledgeStealth']);
    expect(tutorialFor(cat, ['silentTakedown', 'perchDrop', 'ladder'])).toEqual(['distract', 'vent', 'ledgeStealth']);
    expect(tutorialFor(STEPS[idx('monarchBalcony')], [])).toEqual(['crouch', 'silent', 'perch', 'perchDrop']);
    expect(tutorialFor(STEPS[idx('boss')], [])).toBe(null);
    for (const tips of Object.values(CATCH_UP)) for (const c of tips) for (const id of c.tips) expect(PROMPT_IDS).toContain(id);
  });
});
