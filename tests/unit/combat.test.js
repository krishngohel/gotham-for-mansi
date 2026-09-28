import { describe, it, expect } from 'vitest';
import { resolveHit, damageToHero, ENEMY, DIFFICULTY, inShockwave, shouldDiveBomb, canLedgeTakedown, canDropTakedown, RIFLE_DAMAGE } from '../../src/combat/rules.js';
import { selectTarget } from '../../src/combat/targeting.js';
import { createCombo } from '../../src/combat/combo.js';
import { createDirector } from '../../src/combat/director.js';
import { createInputBuffer } from '../../src/combat/inputBuffer.js';
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

describe('inputBuffer', () => {
  it('holds the latest press until consumed or read', () => {
    const b = createInputBuffer(0.3);
    expect(b.value).toBe(null);
    b.press('punch');
    expect(b.value).toBe('punch');
  });
  it('a later press overwrites an earlier one', () => {
    const b = createInputBuffer(0.3);
    b.press('punch');
    b.press('kick');
    expect(b.value).toBe('kick');
  });
  it('ages out after the window with nothing consuming it', () => {
    const b = createInputBuffer(0.3);
    b.press('punch');
    b.tick(0.2);
    expect(b.value).toBe('punch');
    b.tick(0.11);
    expect(b.value).toBe(null);
  });
  it('consume clears only the matching action, leaving a different buffered action alone', () => {
    const b = createInputBuffer(0.3);
    b.press('kick');
    b.consume('punch');
    expect(b.value).toBe('kick');
    b.consume('kick');
    expect(b.value).toBe(null);
  });
  it('consuming an empty buffer is a no-op', () => {
    const b = createInputBuffer(0.3);
    b.consume('punch');
    expect(b.value).toBe(null);
  });
  it('a press right after a consume buffers normally again', () => {
    const b = createInputBuffer(0.3);
    b.press('punch');
    b.consume('punch');
    b.press('block');
    expect(b.value).toBe('block');
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

describe('shouldDiveBomb', () => {
  it('only triggers while gliding above 6 m', () => {
    expect(shouldDiveBomb('glide', 6.1)).toBe(true);
    expect(shouldDiveBomb('glide', 25)).toBe(true);
    expect(shouldDiveBomb('glide', 6)).toBe(false);
    expect(shouldDiveBomb('glide', 5.9)).toBe(false);
    expect(shouldDiveBomb('air', 20)).toBe(false);
    expect(shouldDiveBomb('ground', 20)).toBe(false);
  });
});

describe('canLedgeTakedown', () => {
  const ledge = { x: 0, y: 5, z: 0 };
  const goon = (extra = {}) => ({ alive: true, down: false, aware: false, def: ENEMY.grunt, state: 'idle', pos: { x: 0, y: 5, z: 0.5 }, ...extra });
  it('allows an unaware standing goon within reach of the hang point', () => {
    expect(canLedgeTakedown(goon(), ledge)).toBe(true);
  });
  it('rejects a goon out of range (too far along the wall, or wrong height)', () => {
    expect(canLedgeTakedown(goon({ pos: { x: 2, y: 5, z: 0 } }), ledge)).toBe(false);
    expect(canLedgeTakedown(goon({ pos: { x: 0, y: 6, z: 0.5 } }), ledge)).toBe(false);
  });
  it('the vertical threshold is a strict < 0.4 m', () => {
    expect(canLedgeTakedown(goon({ pos: { x: 0, y: 5.39, z: 0 } }), ledge)).toBe(true);
    expect(canLedgeTakedown(goon({ pos: { x: 0, y: 5.4, z: 0 } }), ledge)).toBe(false);
  });
  it('the horizontal threshold is a strict < 1.5 m', () => {
    expect(canLedgeTakedown(goon({ pos: { x: 1.49, y: 5, z: 0 } }), ledge)).toBe(true);
    expect(canLedgeTakedown(goon({ pos: { x: 1.5, y: 5, z: 0 } }), ledge)).toBe(false);
  });
  it('rejects an aware goon', () => {
    expect(canLedgeTakedown(goon({ aware: true }), ledge)).toBe(false);
  });
  it('rejects a dead or already-down goon', () => {
    expect(canLedgeTakedown(goon({ alive: false }), ledge)).toBe(false);
    expect(canLedgeTakedown(goon({ down: true }), ledge)).toBe(false);
  });
  it('never targets the boss, even if unaware and in range', () => {
    expect(canLedgeTakedown(goon({ def: ENEMY.joker }), ledge)).toBe(false);
  });
  it('rejects a grabbed enemy', () => {
    expect(canLedgeTakedown(goon({ state: 'grabbed' }), ledge)).toBe(false);
  });
});

describe('canDropTakedown', () => {
  const heroPos = { x: 0, y: 0, z: 0 };
  const goon = (extra = {}) => ({ alive: true, down: false, def: ENEMY.grunt, state: 'idle', pos: { x: 0.5, y: 0, z: 0 }, ...extra });
  it('allows a standing goon right under the hero', () => {
    expect(canDropTakedown(goon(), heroPos)).toBe(true);
  });
  it('rejects a goon out of range (too far, or wrong height)', () => {
    expect(canDropTakedown(goon({ pos: { x: 2, y: 0, z: 0 } }), heroPos)).toBe(false);
    expect(canDropTakedown(goon({ pos: { x: 0.5, y: 1.5, z: 0 } }), heroPos)).toBe(false);
  });
  it('the horizontal threshold is a strict < 1.2 m', () => {
    expect(canDropTakedown(goon({ pos: { x: 1.19, y: 0, z: 0 } }), heroPos)).toBe(true);
    expect(canDropTakedown(goon({ pos: { x: 1.2, y: 0, z: 0 } }), heroPos)).toBe(false);
  });
  it('the vertical threshold is a strict < 1 m', () => {
    expect(canDropTakedown(goon({ pos: { x: 0.5, y: 0.99, z: 0 } }), heroPos)).toBe(true);
    expect(canDropTakedown(goon({ pos: { x: 0.5, y: 1.0, z: 0 } }), heroPos)).toBe(false);
  });
  it('rejects a dead or already-down goon', () => {
    expect(canDropTakedown(goon({ alive: false }), heroPos)).toBe(false);
    expect(canDropTakedown(goon({ down: true }), heroPos)).toBe(false);
  });
  it('never targets the boss, so a drop can never one-shot the Joker', () => {
    expect(canDropTakedown(goon({ def: ENEMY.joker }), heroPos)).toBe(false);
  });
  it('rejects a grabbed enemy', () => {
    expect(canDropTakedown(goon({ state: 'grabbed' }), heroPos)).toBe(false);
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

describe('combo shield and threshold (WayneTech)', () => {
  it('damaged() breaks a combo and says so', () => {
    const c = createCombo();
    for (let i = 0; i < 4; i++) c.hit();
    expect(c.damaged()).toBe(true);
    expect(c.value).toBe(0);
  });
  it('a shield absorbs one hit per combo run', () => {
    const c = createCombo({ shield: 1 });
    for (let i = 0; i < 5; i++) c.hit();
    expect(c.damaged()).toBe(false);
    expect(c.value).toBe(5);
    expect(c.damaged()).toBe(true);
    expect(c.value).toBe(0);
    c.hit();
    expect(c.damaged()).toBe(false);
    expect(c.value).toBe(1);
  });
  it('an absorbed hit restarts the timeout', () => {
    const c = createCombo({ timeout: 1.5, shield: 1 });
    c.hit();
    c.tick(1.4);
    c.damaged();
    c.tick(1.4);
    expect(c.value).toBe(1);
  });
  it('setShield and setReady change the rules live', () => {
    const c = createCombo();
    c.setShield(1);
    c.hit();
    expect(c.damaged()).toBe(false);
    for (let i = 0; i < 5; i++) c.hit();
    expect(c.ready).toBe(false);
    c.setReady(6);
    expect(c.ready).toBe(true);
    expect(c.readyAt).toBe(6);
  });
  it('an empty combo takes damage without using the shield', () => {
    const c = createCombo({ shield: 1 });
    expect(c.damaged()).toBe(true);
    c.hit();
    expect(c.damaged()).toBe(false);
  });
});

describe('gadget moves', () => {
  const e = (type, o = {}) => ({ type, health: ENEMY[type].health, stunned: false, down: false, ...o });
  it('gel knocks goons down and breaks a knife guard; brutes shrug it off unless stunned', () => {
    expect(resolveHit('gel', e('grunt')).outcome).toBe('knockdown');
    expect(resolveHit('gel', e('knife')).outcome).toBe('knockdown');
    expect(resolveHit('gel', e('brute')).outcome).toBe('immune');
    expect(resolveHit('gel', e('brute', { stunned: true })).outcome).toBe('knockdown');
  });
  it('remote, claw, smoke and popper only stun, even brutes', () => {
    for (const m of ['remote', 'claw', 'smoke', 'popper']) expect(resolveHit(m, e('brute')).outcome, m).toBe('stun');
    expect(resolveHit('smoke', e('grunt')).stun).toBe(3);
    expect(resolveHit('popper', e('grunt')).stun).toBe(3);
  });
  it('shatter knocks anyone out', () => {
    expect(resolveHit('shatter', e('brute')).outcome).toBe('ko');
  });
});

describe('the rifle goon', () => {
  const rifle = (o = {}) => ({ type: 'rifle', health: ENEMY.rifle.health, stunned: false, down: false, ...o });
  it('parries punches head-on; a kick breaks the guard; a stun opens it', () => {
    expect(resolveHit('punch', rifle()).outcome).toBe('parried');
    expect(resolveHit('kick', rifle()).outcome).toBe('hit');
    expect(resolveHit('punch', rifle({ stunned: true })).outcome).toBe('hit');
  });
  it('cannot be countered, and its shot hurts 10 on Story, 15 on Normal and 37.5 on Hard, blocked or not', () => {
    expect(ENEMY.rifle).toMatchObject({ counterable: false, parry: true, ranged: true, damage: 15 });
    expect(RIFLE_DAMAGE).toEqual({ story: 10, normal: 15, hard: 37.5 });
    expect(damageToHero('rifle')).toBe(15);
    expect(damageToHero('rifle', { blocking: true })).toBe(15);
    expect(damageToHero('rifle', { difficulty: 'story' })).toBe(10);
    expect(damageToHero('rifle', { difficulty: 'hard' })).toBe(37.5);
    // Everything else still scales with the difficulty multiplier.
    expect(damageToHero('knife', { difficulty: 'hard' })).toBe(22.5);
  });
});
