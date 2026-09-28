import { describe, it, expect } from 'vitest';
import { resolveHit, damageToHero, ENEMY, DIFFICULTY, inShockwave } from '../../src/combat/rules.js';
import { selectTarget } from '../../src/combat/targeting.js';
import { createCombo } from '../../src/combat/combo.js';
import { createDirector } from '../../src/combat/director.js';
import { createRng } from '../../src/core/rng.js';

const foe = (type, extra = {}) => ({ type, health: ENEMY[type].health, stunned: false, down: false, ...extra });

describe('resolveHit', () => {
  it('punches wear a grunt down and the last one KOs', () => {
    const g = foe('grunt');
    for (let i = 0; i < 3; i++) expect(resolveHit('punch', g).outcome).toBe('hit');
    expect(resolveHit('punch', g).outcome).toBe('ko');
    expect(g.health).toBe(0);
  });
  it('kicks do double damage', () => {
    const g = foe('grunt');
    resolveHit('kick', g);
    expect(g.health).toBe(ENEMY.grunt.health - 2);
  });
  it('counters and jump-kicks knock down without killing a healthy grunt', () => {
    expect(resolveHit('counter', foe('grunt')).outcome).toBe('knockdown');
    expect(resolveHit('jumpKick', foe('grunt')).outcome).toBe('knockdown');
  });
  it('a punch on a downed enemy is a ground takedown', () => {
    const g = foe('grunt', { down: true });
    expect(resolveHit('punch', g).outcome).toBe('ko');
  });
  it('knife goons parry punches until their guard is broken', () => {
    const k = foe('knife');
    expect(resolveHit('punch', k).outcome).toBe('parried');
    expect(k.health).toBe(ENEMY.knife.health);
    const r = resolveHit('kick', k);
    expect(r.outcome).toBe('hit');
    expect(r.stun).toBeGreaterThan(0);
    k.stunned = true;
    expect(resolveHit('punch', k).outcome).not.toBe('parried');
  });
  it('brutes shrug off everything until stunned', () => {
    const b = foe('brute');
    expect(resolveHit('punch', b).outcome).toBe('immune');
    expect(resolveHit('kick', b).outcome).toBe('immune');
    expect(resolveHit('counter', b).outcome).toBe('immune');
    expect(resolveHit('cape', b).outcome).toBe('stun');
    b.stunned = true;
    expect(resolveHit('punch', b).outcome).toBe('hit');
  });
  it('special takedowns KO anyone but the boss', () => {
    expect(resolveHit('special', foe('brute')).outcome).toBe('ko');
    expect(resolveHit('special', foe('joker', { health: 30 })).outcome).not.toBe('ko');
  });
  it('batarang and cape stun without damage', () => {
    const g = foe('grunt');
    const r = resolveHit('batarang', g);
    expect(r.outcome).toBe('stun');
    expect(g.health).toBe(ENEMY.grunt.health);
  });
});

describe('damageToHero', () => {
  it('scales with difficulty', () => {
    expect(damageToHero('grunt', { difficulty: 'normal' })).toBe(10);
    expect(damageToHero('grunt', { difficulty: 'story' })).toBe(5);
    expect(damageToHero('grunt', { difficulty: 'hard' })).toBe(15);
  });
  it('block cuts grunt and knife damage but not a brute charge', () => {
    expect(damageToHero('grunt', { difficulty: 'normal', blocking: true })).toBe(2);
    expect(damageToHero('knife', { difficulty: 'normal', blocking: true })).toBe(7.5);
    expect(damageToHero('charge', { difficulty: 'normal', blocking: true })).toBe(25);
  });
  it('dodging is untouchable', () => {
    expect(damageToHero('brute', { difficulty: 'hard', invulnerable: true })).toBe(0);
  });
  it('difficulty table is sane', () => {
    expect(DIFFICULTY.story.windup).toBeGreaterThan(DIFFICULTY.normal.windup);
    expect(DIFFICULTY.hard.windup).toBeLessThan(DIFFICULTY.normal.windup);
  });
});

describe('selectTarget', () => {
  const e = (id, x, z, extra = {}) => ({ id, x, z, alive: true, down: false, ...extra });
  it('prefers the enemy in the input direction over a closer one behind', () => {
    const list = [e('behind', 0, -2), e('ahead', 0, 6)];
    expect(selectTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, list).id).toBe('ahead');
  });
  it('falls back to the nearest when there is no input', () => {
    const list = [e('far', 7, 0), e('near', 0, -3)];
    expect(selectTarget({ x: 0, z: 0 }, null, list).id).toBe('near');
  });
  it('ignores the KOd, the out of range and (by default) the downed', () => {
    const list = [e('ko', 0, 2, { alive: false }), e('far', 0, 20), e('down', 0, 3, { down: true })];
    expect(selectTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, list)).toBe(null);
    expect(selectTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, list, { allowDown: true }).id).toBe('down');
  });
  it('still hits someone right next to you when aiming elsewhere', () => {
    const list = [e('side', 1.5, 0)];
    expect(selectTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, list).id).toBe('side');
  });
});

describe('combo', () => {
  it('counts hits, times out, resets on damage and is spent by specials', () => {
    const c = createCombo({ timeout: 1.5, ready: 8 });
    for (let i = 0; i < 8; i++) c.hit();
    expect(c.value).toBe(8);
    expect(c.ready).toBe(true);
    c.tick(1.0);
    expect(c.value).toBe(8);
    c.tick(0.6);
    expect(c.value).toBe(0);
    c.hit(); c.damaged();
    expect(c.value).toBe(0);
    c.hit(); c.hit(); c.spend();
    expect(c.value).toBe(0);
  });
  it('tracks the best combo', () => {
    const c = createCombo();
    for (let i = 0; i < 5; i++) c.hit();
    c.miss();
    c.hit();
    expect(c.best).toBe(5);
  });
});

describe('director', () => {
  it('never lets more than maxWindups wind up at once', () => {
    const d = createDirector({ maxWindups: 2, gap: [0, 0], minSpacing: 0, rng: createRng(1) });
    const ready = ['a', 'b', 'c', 'd'].map((id) => ({ id, ready: true }));
    const started = d.tick(0.1, ready);
    expect(started.length).toBe(2);
    expect(d.tick(0.1, ready).length).toBe(0);
    d.release(started[0]);
    expect(d.tick(0.1, ready).length).toBe(1);
  });
  it('respects per-enemy cooldowns after an attack', () => {
    const d = createDirector({ maxWindups: 2, gap: [3, 3], minSpacing: 0, rng: createRng(1) });
    const [first] = d.tick(0.1, [{ id: 'a', ready: true }]);
    expect(first).toBe('a');
    d.release('a');
    expect(d.tick(1, [{ id: 'a', ready: true }])).toEqual([]);
    expect(d.tick(2.5, [{ id: 'a', ready: true }])).toEqual(['a']);
  });
  it('spaces windup starts apart', () => {
    const d = createDirector({ maxWindups: 3, gap: [0, 0], minSpacing: 0.4, rng: createRng(1) });
    const ready = ['a', 'b'].map((id) => ({ id, ready: true }));
    expect(d.tick(0.1, ready).length).toBe(1);
    expect(d.tick(0.1, ready).length).toBe(0);
    expect(d.tick(0.35, ready).length).toBe(1);
  });
  it('skips enemies that are not ready', () => {
    const d = createDirector({ maxWindups: 2, gap: [0, 0], minSpacing: 0, rng: createRng(1) });
    expect(d.tick(0.1, [{ id: 'a', ready: false }])).toEqual([]);
  });
});

describe('new moves', () => {
  it('heavy and spin kick finishers knock down and hit hard', () => {
    const g = foe('grunt');
    expect(resolveHit('heavy', g).outcome).toBe('knockdown');
    expect(g.health).toBe(ENEMY.grunt.health - 2);
    const g2 = foe('grunt');
    expect(resolveHit('spinKick', g2).outcome).toBe('knockdown');
    expect(g2.health).toBe(ENEMY.grunt.health - 3);
  });
  it('spin kicks break a knife guard, heavy punches do not', () => {
    expect(resolveHit('heavy', foe('knife')).outcome).toBe('parried');
    expect(resolveHit('spinKick', foe('knife')).outcome).not.toBe('parried');
  });
  it('slam knocks everyone down and throws cannot pick up a brute', () => {
    expect(resolveHit('slam', foe('grunt')).outcome).toBe('knockdown');
    expect(resolveHit('throw', foe('brute')).outcome).toBe('immune');
    expect(resolveHit('throw', foe('knife')).outcome).toBe('knockdown');
    expect(resolveHit('thrownInto', foe('grunt')).outcome).toBe('knockdown');
  });
  it('the Joker cannot be thrown', () => {
    expect(resolveHit('throw', foe('joker', { health: 30 })).outcome).toBe('immune');
  });
});

describe('inShockwave', () => {
  it('shockwave reaches 4 m flat and 2.5 m vertically', () => {
    expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 3.9, y: 0, z: 0 }, 4)).toBe(true);
    expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 4.1, y: 0, z: 0 }, 4)).toBe(false);
    expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 1, y: 3, z: 0 }, 4)).toBe(false);
  });
  it('defaults to a 4 m radius', () => {
    expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 3.9, y: 0, z: 0 })).toBe(true);
    expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 4.1, y: 0, z: 0 })).toBe(false);
  });
});

describe('diveBomb move (used by the shockwave)', () => {
  it('knocks down a healthy grunt without killing it', () => {
    const g = foe('grunt');
    const r = resolveHit('diveBomb', g);
    expect(r.outcome).toBe('knockdown');
    expect(g.health).toBe(ENEMY.grunt.health - 2);
  });
  it('does not one-shot an unstunned brute (armored immunity applies)', () => {
    const b = foe('brute');
    expect(resolveHit('diveBomb', b).outcome).toBe('immune');
    expect(b.health).toBe(ENEMY.brute.health);
  });
  it('does hit a stunned brute', () => {
    const b = foe('brute', { stunned: true });
    expect(resolveHit('diveBomb', b).outcome).toBe('knockdown');
  });
});
