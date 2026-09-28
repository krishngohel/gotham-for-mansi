import { describe, it, expect } from 'vitest';
import { sanitizeProgress } from '../../src/core/save.js';
import { createPlayStats, formatPlayTime, formatDistance, formatStatsLine } from '../../src/game/playStats.js';

describe('play stats', () => {
  it('accumulates time, KOs, glide distance and keeps the bests', () => {
    const { stats } = sanitizeProgress({});
    const s = createPlayStats(stats);
    s.tick(1.5); s.tick(0.5);
    s.ko(); s.ko(2);
    s.combo(5); s.combo(12); s.combo(3);
    s.glide(20, 1); s.glide(35, 2.5); s.glide(18, 0.5);
    s.photo();
    expect(stats).toEqual({ playTime: 2, kos: 3, longestCombo: 12, topGlideSpeed: 35, distanceGlided: 4, photos: 1 });
  });
  it('formats play time', () => {
    expect(formatPlayTime(45)).toBe('45 s');
    expect(formatPlayTime(600)).toBe('10 min');
    expect(formatPlayTime(3725)).toBe('1 h 02 min');
  });
  it('formats distance', () => {
    expect(formatDistance(640.4)).toBe('640 m');
    expect(formatDistance(3400)).toBe('3.4 km');
  });
  it('builds the stats line with singular and plural forms and no dashes', () => {
    const line = formatStatsLine({ playTime: 4330, kos: 1, longestCombo: 37, topGlideSpeed: 47.8, distanceGlided: 3400, photos: 0 }, { crimes: 12 });
    expect(line).toBe('Play time 1 h 12 min · 1 goon knocked out · 12 crimes stopped · Longest combo 37 · Top glide speed 172 km/h · 3.4 km glided');
    expect(formatStatsLine({ playTime: 0, kos: 2, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 }, { crimes: 1 })).toContain('1 crime stopped');
    expect(line).not.toMatch(/[–—]/);
  });
  it('ignores non-finite or negative per-frame inputs', () => {
    const { stats } = sanitizeProgress({});
    const s = createPlayStats(stats);
    s.tick(NaN); s.tick(-1); s.tick(Infinity); s.tick(-Infinity);
    s.glide(NaN, 0); s.glide(-10, 0); s.glide(Infinity, 0);
    s.glide(0, NaN); s.glide(0, -3); s.glide(0, Infinity);
    s.ko(NaN); s.ko(-1); s.ko(Infinity);
    expect(stats).toEqual({ playTime: 0, kos: 0, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 });
  });
  it('clamps non-finite or negative values to 0 when formatting', () => {
    expect(formatPlayTime(NaN)).toBe('0 s');
    expect(formatPlayTime(-5)).toBe('0 s');
    expect(formatPlayTime(Infinity)).toBe('0 s');
    expect(formatDistance(NaN)).toBe('0 m');
    expect(formatDistance(-100)).toBe('0 m');
    expect(formatDistance(Infinity)).toBe('0 m');
  });
});
