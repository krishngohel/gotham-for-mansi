import { describe, it, expect } from 'vitest';
import { sanitizeProgress, DISTRICT_IDS, BALLOON_COUNT } from '../../src/core/save.js';
import { STEPS } from '../../src/game/story.js';
import { CHALLENGES } from '../../src/game/challenges.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';
import {
  tracker, createProgressRegistry, scoreProgress, BASE_CATEGORIES, BASE_MOVES, registerMoves, moveList, moveReachable,
  milestonesCrossed, chapterOf, nextBalloonHint, storyCount,
} from '../../src/game/progressTracker.js';

const allGold = () => Object.fromEntries(CHALLENGES.map((c) => [c.id, { best: 1, medal: 'gold' }]));
const finished = () => sanitizeProgress({
  step: STEPS.length - 1, finished: true, balloons: [...Array(BALLOON_COUNT).keys()], challenges: allGold(),
  crimes: { stopped: 10 }, moves: BASE_MOVES, districts: DISTRICT_IDS,
});
const part = (s, id) => s.parts.find((p) => p.id === id);

describe('progress percentage', () => {
  it('uses the spec weights', () => {
    expect(BASE_CATEGORIES.map((c) => [c.id, c.weight])).toEqual([
      ['story', 40], ['balloons', 20], ['challenges', 20], ['crimes', 10], ['moves', 5], ['districts', 5],
    ]);
  });
  it('is 0 for an empty save', () => {
    const s = tracker.score(sanitizeProgress({}));
    expect(s.percent).toBe(0);
    expect(s.parts).toHaveLength(6);
  });
  it('is 100 for a finished save', () => {
    expect(tracker.score(finished()).percent).toBe(100);
  });
  it('gives 40 for the story alone and roughly half that at the halfway step', () => {
    expect(tracker.score(sanitizeProgress({ finished: true, step: STEPS.length - 1 })).percent).toBe(40);
    // STEPS.length - 1 need not be even (Part S added steps), so round to the nearest whole step
    // and check against the same math the tracker itself uses, rather than a hardcoded 20.
    const half = Math.round((STEPS.length - 1) / 2);
    const expected = Math.floor(40 * (half / (STEPS.length - 1)));
    expect(tracker.score(sanitizeProgress({ step: half })).percent).toBe(expected);
  });
  it('counts balloons and medal points', () => {
    expect(tracker.score(sanitizeProgress({ balloons: [0, 1, 2, 3, 4, 5] })).percent).toBe(10);
    const one = sanitizeProgress({ challenges: { [CHALLENGES[0].id]: { best: 1, medal: 'gold' } } });
    expect(part(tracker.score(one), 'challenges').done).toBe(3);
    expect(part(tracker.score(one), 'challenges').total).toBe(CHALLENGES.length * 3);
  });
  it('caps crimes at 10 for the percentage but reports every one stopped', () => {
    const s = tracker.score(sanitizeProgress({ crimes: { stopped: 25 } }));
    expect(part(s, 'crimes').fraction).toBe(1);
    expect(part(s, 'crimes').done).toBe(10);
    expect(part(s, 'crimes').detail).toContain('25');
    expect(s.percent).toBe(10);
  });
  it('never shows 100 until every category is complete', () => {
    const p = finished();
    p.districts = DISTRICT_IDS.slice(1);
    expect(tracker.score(p).percent).toBe(99);
    const q = finished();
    q.moves = BASE_MOVES.slice(1);
    expect(tracker.score(q).percent).toBe(99);
  });
  it('ignores medals for unknown challenge ids', () => {
    expect(part(tracker.score(sanitizeProgress({ challenges: { retired: { best: 1, medal: 'gold' } } })), 'challenges').done).toBe(0);
  });
});

describe('category registry', () => {
  const cat = (id, weight, done, total, extra = {}) => ({ id, label: id, weight, count: () => ({ done, total }), ...extra });
  it('weights and normalizes over active categories', () => {
    const r = createProgressRegistry();
    r.register(cat('a', 50, 1, 2));
    r.register(cat('b', 50, 3, 3));
    expect(r.score({}).percent).toBe(75);
    r.register(cat('post', 100, 0, 5, { active: (p) => p.finished }));
    expect(r.score({ finished: false }).percent).toBe(75);
    expect(r.score({ finished: true }).percent).toBe(37);
  });
  it('replaces a category with the same id and can unregister', () => {
    const r = createProgressRegistry();
    const undo = r.register(cat('a', 10, 0, 1));
    r.register(cat('a', 10, 1, 1));
    expect(r.categories).toHaveLength(1);
    expect(r.score({}).percent).toBe(100);
    r.register(cat('b', 10, 0, 1));
    undo();
    // The undo belonged to the replaced object, so it removes nothing.
    expect(r.categories.map((c) => c.id)).toEqual(['a', 'b']);
    const undoB = r.register(cat('c', 10, 0, 1));
    undoB();
    expect(r.categories.map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('rejects bad categories', () => {
    const r = createProgressRegistry();
    expect(() => r.register({ label: 'x', weight: 1, count: () => ({ done: 0, total: 1 }) })).toThrow();
    expect(() => r.register(cat('x', 0, 0, 1))).toThrow();
    expect(() => r.register({ id: 'x', weight: 1 })).toThrow();
  });
  it('treats an empty category as complete and an empty registry as 0', () => {
    expect(scoreProgress({}, [cat('a', 10, 0, 0)]).percent).toBe(100);
    expect(scoreProgress({}, []).percent).toBe(0);
  });
});

describe('helpers', () => {
  it('lists the milestones crossed', () => {
    expect(milestonesCrossed(0, 24)).toEqual([]);
    expect(milestonesCrossed(0, 25)).toEqual([25]);
    expect(milestonesCrossed(20, 80)).toEqual([25, 50, 75]);
    expect(milestonesCrossed(75, 99)).toEqual([]);
    expect(milestonesCrossed(75, 100)).toEqual([100]);
    expect(milestonesCrossed(100, 100)).toEqual([]);
  });
  it('names the chapter of a step', () => {
    expect(chapterOf(0)).toEqual({ number: 1, of: 5, name: 'The Signal' });
    expect(chapterOf(STEPS.findIndex((s) => s.id === 'toNeon'))).toMatchObject({ number: 3, name: 'Neon Row' });
    expect(chapterOf(STEPS.findIndex((s) => s.id === 'boss'))).toMatchObject({ number: 5, name: 'The Clock Tower' });
  });
  it('counts story steps up to the credits', () => {
    expect(storyCount(sanitizeProgress({ step: 3 }))).toEqual({ done: 3, total: STEPS.length - 1 });
    expect(storyCount(sanitizeProgress({ step: 999 })).done).toBe(STEPS.length - 1);
  });
  it('hints at the next unfound balloon', () => {
    expect(nextBalloonHint(sanitizeProgress({ balloons: [0, 1] }))).toBe(BALLOONS[2].where);
    expect(nextBalloonHint(sanitizeProgress({ balloons: [...Array(12).keys()] }))).toBe(null);
  });
  it('lets Part D register more moves', () => {
    const undo = registerMoves(['silentTakedown', 'perchDrop', 'ladder']);
    expect(moveList()).toEqual([...BASE_MOVES, 'silentTakedown', 'perchDrop']);
    expect(part(tracker.score(sanitizeProgress({ moves: BASE_MOVES })), 'moves').total).toBe(10);
    undo();
    expect(moveList()).toEqual(BASE_MOVES);
  });
  it('counts the stealth moves only while a predator room is still ahead, or once learned', () => {
    const undo = registerMoves(['silentTakedown', 'perchDrop'], { until: 'aceCatwalks' });
    try {
      const at = (id) => STEPS.findIndex((s) => s.id === id);
      const moves = (p) => part(tracker.score(p), 'moves');
      // Before the rooms (or at the catwalks themselves): all 10 moves count.
      for (const id of ['intro', 'n3', 'monarchBalcony', 'party', 'a3', 'aceCatwalks']) {
        expect(moves(sanitizeProgress({ step: at(id), moves: BASE_MOVES })).total, id).toBe(10);
      }
      expect(moves(sanitizeProgress({ step: at('party'), moves: BASE_MOVES })).detail).toMatch(/silent takedown, perch drop$/);
      // Past the last room without them: the old 8, and nothing it can no longer do is promised.
      const past = moves(sanitizeProgress({ step: at('cake'), moves: BASE_MOVES }));
      expect(past).toMatchObject({ done: 8, total: 8, detail: 'All learned' });
      // Learned ones always count, even past the rooms.
      expect(moves(sanitizeProgress({ step: at('boss'), moves: [...BASE_MOVES, 'perchDrop'] }))).toMatchObject({ done: 9, total: 9 });
      expect(moves(sanitizeProgress({ step: at('party'), moves: [...BASE_MOVES, 'perchDrop'] }))).toMatchObject({ done: 9, total: 10 });
      // A finished save from before Part D (migrated to the credits) still reads 100%.
      expect(tracker.score(finished()).percent).toBe(100);
      expect(moves(finished())).toMatchObject({ done: 8, total: 8 });
      expect(tracker.score({ ...finished(), moves: [...BASE_MOVES, 'silentTakedown', 'perchDrop'] }).percent).toBe(100);
    } finally { undo(); }
    expect(moveReachable('perchDrop', sanitizeProgress({ finished: true }))).toBe(true);
  });
  it('writes no em or en dashes in any detail text', () => {
    for (const p of [sanitizeProgress({}), finished()]) for (const x of tracker.score(p).parts) expect(x.detail).not.toMatch(/[–—]/);
  });
});
