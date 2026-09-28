import { describe, it, expect, vi } from 'vitest';
import { createEvents } from '../../src/core/events.js';
import { createWayneTech } from '../../src/progress/wayneTech.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';

function setup({ xp = 0, owned = [] } = {}) {
  const events = createEvents();
  const progress = { wayne: { xp, owned: [...owned], medals: {} } };
  const hero = { health: 100, maxHealth: 100, dead: false };
  const combat = { combo: { value: 0 }, active: false, applyEffects: vi.fn() };
  const hud = { setHealth: vi.fn(), card: vi.fn() };
  const effects = upgradeEffects(owned);
  const save = vi.fn();
  const w = createWayneTech({ events, progress, save, hero, combat, hud, effects, baseHealth: () => 100 });
  return { events, progress, hero, combat, hud, effects, save, w };
}

describe('XP from play', () => {
  it('knockouts, balloons and chains pay', () => {
    const t = setup();
    for (let i = 0; i < 3; i++) t.events.emit('ko', {});
    t.events.emit('balloon', { index: 0 });
    t.events.emit('chainDone', { chain: 'rope', count: 3, stealth: false });
    expect(t.w.xp).toBe(30 + 150 + 150);
  });
  it('a combo pays when it ends, with a bonus for variety', () => {
    const t = setup();
    for (const move of ['punch', 'kick', 'counter']) t.events.emit('impact', { move, outcome: 'hit' });
    t.combat.combo.value = 10;
    t.w.update(0.016);
    t.combat.combo.value = 0;
    t.w.update(0.016);
    expect(t.w.xp).toBe(60);
  });
  it('medals pay the improvement once', () => {
    const t = setup();
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'bronze' });
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'bronze' });
    expect(t.w.xp).toBe(150);
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'gold' });
    expect(t.w.xp).toBe(500);
    expect(t.progress.wayne.medals).toEqual({ neonSlalom: 'gold' });
  });
  it('caches and later side content pay what they say', () => {
    const t = setup();
    t.events.emit('cacheFound', { id: 'cacheColdStore', xp: 250 });
    t.events.emit('crateOpened', {});
    t.events.emit('missionDone', {});
    expect(t.w.xp).toBe(950);
  });
  it('announces every level crossed', () => {
    const t = setup({ xp: 950 });
    const seen = [];
    t.events.on('levelUp', (d) => seen.push(d));
    t.w.award(100, 'test');
    t.w.award(2000, 'test');
    expect(seen).toEqual([{ level: 2, points: 1 }, { level: 3, points: 2 }, { level: 4, points: 3 }]);
  });
});

describe('buying', () => {
  it('spends a point, applies the effects and raises max health', () => {
    const t = setup({ xp: 1000 });
    expect(t.w.buy('plating1')).toEqual({ ok: true, reason: null });
    expect(t.hero.maxHealth).toBe(125);
    expect(t.hero.health).toBe(125);
    expect(t.effects.maxHealthBonus).toBe(25);
    expect(t.combat.applyEffects).toHaveBeenCalled();
    expect(t.save).toHaveBeenCalled();
    expect(t.w.buy('plating2').reason).toBe('locked');
    expect(t.w.buy('kevlar').reason).toBe('points');
    expect(t.w.free).toBe(0);
  });
  it('the page lists every tree with states and the XP bar', () => {
    const t = setup({ xp: 2300, owned: ['plating1'] });
    const p = t.w.page();
    expect(p).toMatchObject({ level: 3, xp: 2300, into: 300, need: 700, free: 1, allOwned: false });
    expect(p.trees.map((x) => x.upgrades.length)).toEqual([5, 5, 5, 5]);
    expect(p.trees[0].upgrades.map((u) => u.state)).toEqual(['owned', 'buyable', 'locked', 'locked', 'locked']);
    expect(p.trees[1].upgrades[0]).toMatchObject({ id: 'reflexes', tier: 1, state: 'buyable' });
  });
});

describe('recovery out of combat', () => {
  it('waits 6 s after a hit, then 4 per second', () => {
    const t = setup();
    t.hero.health = 50;
    t.events.emit('heroHurt', { damage: 10 });
    t.w.update(3);
    expect(t.hero.health).toBe(50);
    t.w.update(4);
    expect(t.hero.health).toBe(66);
  });
  it('not while a fight is on', () => {
    const t = setup();
    t.hero.health = 50;
    t.combat.active = true;
    t.w.update(10);
    expect(t.hero.health).toBe(50);
  });
  it('Field Medic starts sooner and runs faster', () => {
    const t = setup({ xp: 5000, owned: ['plating1', 'kevlar', 'plating2', 'medic'] });
    t.hero.health = 50;
    t.events.emit('heroHurt', { damage: 10 });
    t.w.update(3);
    expect(t.hero.health).toBe(86);
  });
});
