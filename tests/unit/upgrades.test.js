import { describe, it, expect } from 'vitest';
import { TREES, UPGRADES, UPGRADE_IDS, BASE_EFFECTS, upgradeEffects, canBuy, upgradeStatus, damageFactor, regenStep } from '../../src/progress/upgrades.js';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeWayneSave } from '../../src/progress/wayneSave.js';

const tree = (id) => TREES.find((t) => t.id === id).upgrades.map((u) => u.id);

describe('trees', () => {
  it('four trees of five, unique ids, one point each, no dashes in the copy', () => {
    expect(TREES.map((t) => t.id)).toEqual(['armor', 'combat', 'gadgets', 'traversal']);
    for (const t of TREES) expect(t.upgrades).toHaveLength(5);
    expect(new Set(UPGRADE_IDS).size).toBe(20);
    for (const u of UPGRADES) {
      expect(u.cost).toBe(1);
      expect(`${u.name} ${u.text}`).not.toMatch(/[–—]/);
    }
    expect(tree('combat')[4]).toBe('swarm');
  });
  it('each upgrade needs the one above it in its tree', () => {
    expect(canBuy([], 'plating1', 1)).toEqual({ ok: true, reason: null });
    expect(canBuy([], 'kevlar', 1)).toEqual({ ok: false, reason: 'locked' });
    expect(canBuy(['plating1'], 'kevlar', 0)).toEqual({ ok: false, reason: 'points' });
    expect(canBuy(['plating1'], 'plating1', 3)).toEqual({ ok: false, reason: 'owned' });
    expect(canBuy([], 'laser', 3)).toEqual({ ok: false, reason: 'unknown' });
    expect(upgradeStatus(['plating1'], 'kevlar', 1)).toBe('buyable');
    expect(upgradeStatus(['plating1'], 'kevlar', 0)).toBe('poor');
    expect(upgradeStatus([], 'kevlar', 5)).toBe('locked');
    expect(upgradeStatus(['plating1'], 'plating1', 0)).toBe('owned');
  });
});

describe('effects', () => {
  it('no upgrades: the game as it was', () => {
    expect(upgradeEffects([])).toEqual({ ...BASE_EFFECTS });
    expect(BASE_EFFECTS).toMatchObject({ specialAt: 8, gelRadius: 4, smokeCooldown: 12, freezeTime: 5, clawTargets: 1, batarangCount: 1, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4, boostUp: 15, glideMax: 48 });
  });
  it('every tree applies its numbers', () => {
    const e = upgradeEffects(UPGRADE_IDS);
    expect(e).toMatchObject({
      maxHealthBonus: 50, knifeMult: 0.7, rangedMult: 0.7, damageMult: 0.85, regenDelay: 2.5, regenRate: 12,
      counterWindow: 0.15, comboShield: 1, chainDiscount: 2, specialAt: 6, batSwarm: true,
      batarangCount: 3, gelRadius: 5.5, smokeCooldown: 7, clawTargets: 2, freezeTime: 8,
      boostUp: 19, boostOut: 11, diveGain: 1.3, glideMax: 56, wallRunTime: 1.8, ladderSlide: 14, diveRadius: 6,
    });
  });
  it('fills the object it is given (the live effects object)', () => {
    const live = upgradeEffects([]);
    const same = upgradeEffects(['plating1'], live);
    expect(same).toBe(live);
    expect(live.maxHealthBonus).toBe(25);
    upgradeEffects([], live);
    expect(live.maxHealthBonus).toBe(0);
  });
  it('damageFactor', () => {
    const e = upgradeEffects(tree('armor'));
    expect(damageFactor('knife', e)).toBeCloseTo(0.595);
    expect(damageFactor('buzzer', e)).toBeCloseTo(0.595);
    expect(damageFactor('grunt', e)).toBeCloseTo(0.85);
    expect(damageFactor('grunt', BASE_EFFECTS)).toBe(1);
  });
  it('regen waits for calm, then climbs at the rate, capped at max', () => {
    expect(regenStep(50, 100, { calm: false, sinceHurt: 99 }, BASE_EFFECTS, 1)).toBe(50);
    expect(regenStep(50, 100, { calm: true, sinceHurt: 5 }, BASE_EFFECTS, 1)).toBe(50);
    expect(regenStep(50, 100, { calm: true, sinceHurt: 7 }, BASE_EFFECTS, 1)).toBe(54);
    const medic = upgradeEffects(tree('armor').slice(0, 4));
    expect(regenStep(50, 100, { calm: true, sinceHurt: 3 }, medic, 1)).toBe(62);
    expect(regenStep(99, 100, { calm: true, sinceHurt: 9 }, BASE_EFFECTS, 1)).toBe(100);
  });
});

describe('wayne save field', () => {
  it('defaults, and keeps valid purchases', () => {
    expect(sanitizeProgress({}).wayne).toEqual({ xp: 0, owned: [], medals: {} });
    expect(sanitizeWayneSave({ xp: 3500.7, owned: ['plating1', 'reflexes'], medals: { neonSlalom: 'gold', bad: 'tin', 'x y': 'gold' } }))
      .toEqual({ xp: 3500, owned: ['plating1', 'reflexes'], medals: { neonSlalom: 'gold' } });
  });
  it('drops purchases whose prerequisite is missing, unknown ids and duplicates', () => {
    expect(sanitizeWayneSave({ xp: 9000, owned: ['kevlar', 'plating1', 'plating1', 'laser'] }).owned).toEqual(['plating1', 'kevlar']);
    expect(sanitizeWayneSave({ xp: 9000, owned: ['kevlar'] }).owned).toEqual([]);
  });
  it('never owns more than the XP paid for', () => {
    expect(sanitizeWayneSave({ xp: 1999, owned: ['plating1', 'kevlar', 'reflexes'] }).owned).toEqual(['plating1']);
  });
  it('rejects junk', () => {
    expect(sanitizeWayneSave({ xp: -5, owned: 'x', medals: [] })).toEqual({ xp: 0, owned: [], medals: {} });
    expect(sanitizeWayneSave({ xp: Infinity }).xp).toBe(0);
  });
  it('a new game keeps XP and upgrades', () => {
    const p = sanitizeProgress({ step: 20, wayne: { xp: 5000, owned: ['plating1'] } });
    expect(newGameProgress(p).wayne).toEqual(p.wayne);
  });
});
