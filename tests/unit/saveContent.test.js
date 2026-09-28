import { describe, it, expect } from 'vitest';
import { DEFAULT_PROGRESS, sanitizeProgress, loadProgress, saveProgress, newGameProgress, registerProgressField } from '../../src/core/save.js';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('side content progress fields', () => {
  it('defaults every new field', () => {
    const p = sanitizeProgress({});
    expect(p.challenges).toEqual({});
    expect(p.stats).toEqual({ playTime: 0, kos: 0, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 });
    expect(p.crimes).toEqual({ stopped: 0 });
    expect(p.moves).toEqual([]);
    expect(p.districts).toEqual([]);
    expect(p.milestone).toBe(0);
    expect(p.unlocks).toEqual([]);
  });
  it('matches DEFAULT_PROGRESS and hands out fresh objects', () => {
    expect(sanitizeProgress({})).toEqual(DEFAULT_PROGRESS);
    const p = sanitizeProgress(DEFAULT_PROGRESS);
    p.stats.kos = 9;
    p.moves.push('ladder');
    expect(DEFAULT_PROGRESS.stats.kos).toBe(0);
    expect(DEFAULT_PROGRESS.moves).toEqual([]);
  });
  it('keeps valid challenge bests and drops junk', () => {
    const p = sanitizeProgress({ challenges: {
      signalToSea: { best: 12.5, medal: 'gold' },
      bad: 'x',
      'no spaces': { best: 1, medal: 'gold' },
      neonSlalom: { best: -1, medal: 'gold' },
      bellTowerDive: { best: 20, medal: 'platinum' },
      birthdayBash: { best: Infinity },
    } });
    expect(p.challenges).toEqual({ signalToSea: { best: 12.5, medal: 'gold' }, bellTowerDive: { best: 20, medal: null } });
    expect(sanitizeProgress({ challenges: [1, 2] }).challenges).toEqual({});
  });
  it('clamps stats to finite, non-negative numbers, whole where counted', () => {
    const p = sanitizeProgress({ stats: { playTime: 'x', kos: 3.7, longestCombo: -2, topGlideSpeed: 41.5, distanceGlided: NaN, photos: 2 } });
    expect(p.stats).toEqual({ playTime: 0, kos: 3, longestCombo: 0, topGlideSpeed: 41.5, distanceGlided: 0, photos: 2 });
  });
  it('sanitizes crimes, moves, districts, milestone and unlocks', () => {
    const p = sanitizeProgress({
      crimes: { stopped: 12.9 }, moves: ['ladder', 'ladder', 7, 'x y', 'counter'],
      districts: ['neon', 'neon', 'moon', 'docks'], milestone: 60, unlocks: ['goldStandard', 'goldStandard', 3],
    });
    expect(p.crimes.stopped).toBe(12);
    expect(p.moves).toEqual(['ladder', 'counter']);
    expect(p.districts).toEqual(['neon', 'docks']);
    expect(p.milestone).toBe(0);
    expect(p.unlocks).toEqual(['goldStandard']);
    expect(sanitizeProgress({ crimes: 'x' }).crimes.stopped).toBe(0);
    expect(sanitizeProgress({ crimes: { stopped: -3 } }).crimes.stopped).toBe(0);
    expect(sanitizeProgress({ milestone: 50 }).milestone).toBe(50);
  });
  it('round-trips every new field through storage', () => {
    const st = memoryStorage();
    const p = sanitizeProgress({
      step: 4, challenges: { neonSlalom: { best: 9.5, medal: 'silver' } }, stats: { playTime: 100, kos: 4, longestCombo: 12, topGlideSpeed: 30, distanceGlided: 900, photos: 1 },
      crimes: { stopped: 3 }, moves: ['zipline'], districts: ['gcpd'], milestone: 25, unlocks: ['fromKrishn'],
    });
    saveProgress(st, p);
    expect(loadProgress(st)).toEqual(p);
  });
  it('new game restarts the story and keeps everything found', () => {
    const old = sanitizeProgress({
      step: 20, finished: true, seenIntro: true, suit: 'f', balloons: [1, 2], goldUnlocked: true,
      challenges: { neonSlalom: { best: 9.5, medal: 'gold' } }, crimes: { stopped: 5 }, moves: ['ladder'], districts: ['neon'], milestone: 50, unlocks: ['goldStandard'],
      stats: { kos: 40 },
    });
    const p = newGameProgress(old);
    expect(p.step).toBe(0);
    expect(p.finished).toBe(false);
    expect(p.seenIntro).toBe(false);
    expect(p.suit).toBe(null);
    expect(p.balloons).toEqual([1, 2]);
    expect(p.goldUnlocked).toBe(true);
    expect(p.challenges.neonSlalom.medal).toBe('gold');
    expect(p.crimes.stopped).toBe(5);
    expect(p.moves).toEqual(['ladder']);
    expect(p.districts).toEqual(['neon']);
    expect(p.milestone).toBe(50);
    expect(p.unlocks).toEqual(['goldStandard']);
    expect(p.stats.kos).toBe(40);
  });
  it('loads a legacy save (no side content fields at all) and fills safe defaults', () => {
    const st = memoryStorage();
    // Shaped like a save written before Plan 3C: none of challenges, stats, crimes, moves,
    // districts, milestone or unlocks exist yet.
    const legacy = { step: 17, balloons: [0, 3, 6], suit: 'gold', goldUnlocked: true, finished: false, seenIntro: true };
    saveProgress(st, legacy);
    const p = loadProgress(st);
    expect(p.step).toBe(17);
    expect(p.balloons).toEqual([0, 3, 6]);
    expect(p.suit).toBe('gold');
    expect(p.goldUnlocked).toBe(true);
    expect(p.finished).toBe(false);
    expect(p.seenIntro).toBe(true);
    expect(p.challenges).toEqual({});
    expect(p.stats).toEqual(DEFAULT_PROGRESS.stats);
    expect(p.crimes).toEqual({ stopped: 0 });
    expect(p.moves).toEqual([]);
    expect(p.districts).toEqual([]);
    expect(p.milestone).toBe(0);
    expect(p.unlocks).toEqual([]);
    expect(p).toEqual({ ...DEFAULT_PROGRESS, ...legacy });
  });
  it('lets later parts register their own saved fields', () => {
    const undo = registerProgressField('crates', { sanitize: (raw) => (Array.isArray(raw) ? raw.filter(Number.isInteger) : []) });
    expect(sanitizeProgress({ crates: [1, 'x', 3] }).crates).toEqual([1, 3]);
    expect(sanitizeProgress({}).crates).toEqual([]);
    expect(() => registerProgressField('stats', { sanitize: () => 0 })).toThrow();
    undo();
    expect('crates' in sanitizeProgress({})).toBe(false);
  });
});
