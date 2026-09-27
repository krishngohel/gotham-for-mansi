import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, sanitizeSettings, loadSettings, saveSettings } from '../../src/core/settings.js';
import { DEFAULT_PROGRESS, sanitizeProgress, loadProgress, saveProgress } from '../../src/core/save.js';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };
const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };

describe('settings', () => {
  it('round-trips through storage', () => {
    const st = memoryStorage();
    const s = { ...DEFAULT_SETTINGS, sensitivity: 1.7, difficulty: 'story' };
    saveSettings(st, s);
    expect(loadSettings(st)).toEqual(s);
  });
  it('falls back field by field and clamps', () => {
    const s = sanitizeSettings({ sensitivity: 99, invertY: 'yes', difficulty: 'nightmare', volume: { master: -1, music: 0.3 }, fov: 'wide' });
    expect(s.sensitivity).toBe(3);
    expect(s.invertY).toBe(DEFAULT_SETTINGS.invertY);
    expect(s.difficulty).toBe('normal');
    expect(s.volume.master).toBe(0);
    expect(s.volume.music).toBe(0.3);
    expect(s.volume.sfx).toBe(DEFAULT_SETTINGS.volume.sfx);
    expect(s.fov).toBe(DEFAULT_SETTINGS.fov);
  });
  it('keeps valid bindings and repairs missing ones', () => {
    const s = sanitizeSettings({ bindings: { kick: ['KeyG'], punch: 'nope' } });
    expect(s.bindings.kick).toEqual(['KeyG']);
    expect(s.bindings.punch).toEqual(DEFAULT_SETTINGS.bindings.punch);
  });
  it('survives storage that throws', () => {
    expect(loadSettings(brokenStorage)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(brokenStorage, DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe('progress', () => {
  it('round-trips and dedupes balloons', () => {
    const st = memoryStorage();
    saveProgress(st, { ...DEFAULT_PROGRESS, step: 7, balloons: [3, 3, 5], suit: 'f' });
    const p = loadProgress(st);
    expect(p.step).toBe(7);
    expect(p.balloons).toEqual([3, 5]);
    expect(p.suit).toBe('f');
  });
  it('rejects junk', () => {
    const p = sanitizeProgress({ step: -4, balloons: [1, 'x', 99], suit: 'z', goldUnlocked: 1 });
    expect(p.step).toBe(0);
    expect(p.balloons).toEqual([1]);
    expect(p.suit).toBe(null);
    expect(p.goldUnlocked).toBe(false);
  });
});
