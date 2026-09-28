import { describe, it, expect } from 'vitest';
import { XP, MEDAL_XP, XP_PER_LEVEL, levelOf, pointsEarned, pointsFree, toNext, comboXp, chainXp, medalXp, levelsCrossed, createComboRun } from '../../src/progress/xp.js';

describe('levels and points', () => {
  it('a level and a point every 1000 XP', () => {
    expect(XP_PER_LEVEL).toBe(1000);
    expect([levelOf(0), levelOf(999), levelOf(1000), levelOf(4321)]).toEqual([1, 1, 2, 5]);
    expect(pointsEarned(4321)).toBe(4);
    expect(pointsFree(4321, 3)).toBe(1);
    expect(pointsFree(1000, 5)).toBe(0);
    expect(levelOf(-50)).toBe(1);
  });
  it('toNext', () => {
    expect(toNext(4321)).toEqual({ into: 321, need: 679, fraction: 0.321 });
  });
  it('levelsCrossed lists every level gained', () => {
    expect(levelsCrossed(900, 1100)).toEqual([2]);
    expect(levelsCrossed(900, 3100)).toEqual([2, 3, 4]);
    expect(levelsCrossed(1100, 1900)).toEqual([]);
  });
});

describe('sources', () => {
  it('combos pay from 5 hits, with a bonus for variety', () => {
    expect(comboXp(4, 4)).toBe(0);
    expect(comboXp(5, 1)).toBe(20);
    expect(comboXp(10, 4)).toBe(80);
    expect(comboXp(20, 6)).toBe(160);
  });
  it('chains pay per goon, half again from stealth', () => {
    expect(chainXp(3, false)).toBe(150);
    expect(chainXp(2, true)).toBe(150);
  });
  it('medals pay only the improvement', () => {
    expect(medalXp(null, 'bronze')).toBe(MEDAL_XP.bronze);
    expect(medalXp('bronze', 'gold')).toBe(MEDAL_XP.gold - MEDAL_XP.bronze);
    expect(medalXp('gold', 'silver')).toBe(0);
    expect(medalXp('gold', null)).toBe(0);
  });
  it('a combo run tracks its peak and how many different moves', () => {
    const r = createComboRun();
    r.note('punch', 1); r.note('punch', 2); r.note('kick', 3); r.note('counter', 4);
    expect(r.peak).toBe(4);
    expect(r.close()).toEqual({ peak: 4, variety: 3 });
    expect(r.close()).toEqual({ peak: 0, variety: 0 });
  });
  it('the story alone earns 6 to 12 points (pacing guard)', () => {
    const fights = 12 * (XP.fightDone + 5 * XP.ko + 2 * comboXp(12, 4) + 3 * XP.counter);
    const story = fights + 12 * XP.balloon + 3 * 250 + 3 * 100 + 5 * chainXp(2, false) + 20 * XP.objectiveDone + 6 * XP.glassBroken;
    expect(pointsEarned(story)).toBeGreaterThanOrEqual(6);
    expect(pointsEarned(story)).toBeLessThanOrEqual(12);
  });
});
