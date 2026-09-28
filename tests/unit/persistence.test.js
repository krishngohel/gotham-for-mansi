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
    const s = sanitizeSettings({ bindings: { kick: ['KeyZ'], punch: 'nope' } });
    expect(s.bindings.kick).toEqual(['KeyZ']);
    expect(s.bindings.punch).toEqual(DEFAULT_SETTINGS.bindings.punch);
  });
  it('survives storage that throws', () => {
    expect(loadSettings(brokenStorage)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(brokenStorage, DEFAULT_SETTINGS)).not.toThrow();
  });
  it('keeps the comic toggles as booleans, on by default', () => {
    const s = sanitizeSettings({});
    expect(s.lineWobble).toBe(true);
    expect(s.impactFrames).toBe(true);
    expect(sanitizeSettings({ lineWobble: false, impactFrames: false }).lineWobble).toBe(false);
    expect(sanitizeSettings({ impactFrames: 3 }).impactFrames).toBe(true);
  });
  it('keeps autoLedge as a boolean and defaults it on', () => {
    expect(sanitizeSettings({}).autoLedge).toBe(true);
    expect(sanitizeSettings({ autoLedge: false }).autoLedge).toBe(false);
    expect(sanitizeSettings({ autoLedge: 'yes' }).autoLedge).toBe(true);
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

describe('binding de-duplication', () => {
  it('drops a code bound to two actions when loading', () => {
    const s = sanitizeSettings({ bindings: { punch: ['KeyE'], kick: ['KeyE'] } });
    const holders = Object.entries(s.bindings).filter(([, c]) => c.includes('KeyE')).map(([a]) => a);
    expect(holders).toEqual(['kick']);
    expect(s.bindings.punch.length).toBeGreaterThan(0);
  });
});
