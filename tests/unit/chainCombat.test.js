// Chain takedowns started from combat (combatSystem.js): costs, hints, stealth, target holds,
// the api the chain lands through, and cleanup when the chain control is dropped.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { ENEMY } from '../../src/combat/rules.js';
import { createRng } from '../../src/core/rng.js';

function harness({ discount = 0 } = {}) {
  const bat = {
    yaw: 0, face(y) { bat.yaw = y; }, tilt: { rotation: { set() {} } },
    bone: () => ({ getWorldPosition: (o) => o.set(0, 11.4, 0) }),
    animator: { play() {} },
  };
  const hero = {
    pos: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector3(), state: 'ground', grounded: true, dead: false,
    invulnerable: 0, health: 100, maxHealth: 100, control: null, blocking: false,
    bat, cape: { setWings() {} },
    setState(s) { hero.state = s; },
    heightAboveGround: () => 0,
    collision: { raycast: () => null, resolveCylinder: (pos) => ({ groundY: pos.y }), groundBelow: () => 10 },
  };
  const follow = { forward: (o) => o.set(0, 0, 1), right: (o) => o.set(-1, 0, 0), addShake() {}, hitKick() {}, actionShot() {} };
  // Each event keeps a snapshot of any vector it carried, to check nobody mutates it later.
  const events = {
    log: [],
    emit(type, data) { this.log.push({ type, data, snap: data?.pos?.clone?.() }); },
    on() {},
  };
  const time = { hitStop() {}, slowMo() {} };
  const combat = createCombat({ hero, follow, time, events, rng: createRng(1), getDifficulty: () => 'normal', getChainDiscount: () => discount });
  return { hero, combat, events };
}

function goon(id, x, z, o = {}) {
  const e = {
    id, type: 'grunt', def: ENEMY.grunt, scale: 1, radius: 0.42, pos: new THREE.Vector3(x, 10, z),
    alive: true, aware: true, state: 'engage', down: false, air: false, stunned: false, health: 40, glyph: null,
    tiedWith: null,
    applyHit(result) { if (result.outcome === 'ko') { e.alive = false; e.state = 'ko'; } return false; },
    chainHold() { e.state = 'chained'; return false; },
    chainRelease() { if (e.state === 'chained') e.state = e.aware ? 'engage' : 'idle'; },
    tie(partners) { e.state = 'tied'; e.down = true; e.tiedWith = partners.filter((p) => p !== e); return false; },
    ch: { headWorld(out, lift = 0) { return out.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z); }, face() {}, animator: { play() {} } },
    update() {}, ready: () => false, wake() { e.aware = true; }, startWindup() {},
    get x() { return e.pos.x; }, get z() { return e.pos.z; },
    ...o,
  };
  return e;
}

const ctxFor = (pressed) => ({ input: { pressed: (a) => a === pressed, down: () => false, move: { x: 0, y: 0 } }, fx: {}, chainFx: null });
const dt = 1 / 60;
const of = (events, type) => events.log.filter((ev) => ev.type === type);
function hits(combat, n) { for (let i = 0; i < n; i++) combat.combo.hit(); }
// Plays hero.control the way hero.js does (combat first, then the control), until it hands back.
function play(hero, combat, frames = 600) {
  const ctl = hero.control;
  for (let i = 0; i < frames && hero.control === ctl; i++) {
    combat.update(dt, ctxFor(null));
    if (ctl.update(dt) && hero.control === ctl) hero.control = null;
  }
}

describe('starting a chain from combat', () => {
  it('says the chains are locked below the cheapest cost, and uses up the press', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4)]);
    combat.update(dt, ctxFor('chain1'));
    expect(hero.control).toBeNull();
    expect(of(events, 'hint').map((ev) => ev.data.id)).toEqual(['chain-locked']);
    // Used up: it is not retried on the next frames.
    combat.update(dt, ctxFor(null));
    expect(of(events, 'hint')).toHaveLength(1);
  });

  it('says a chain costs more when the combo covers a cheaper one', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4)]);
    hits(combat, 6);
    combat.update(dt, ctxFor('chain2'));
    expect(hero.control).toBeNull();
    expect(of(events, 'hint').map((ev) => ev.data.id)).toEqual(['chain-cost']);
  });

  it('says there are not enough targets when only one goon is near', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3)]);
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    expect(hero.control).toBeNull();
    expect(of(events, 'hint').map((ev) => ev.data.id)).toEqual(['chain-targets']);
  });

  it('spends the cost, holds the targets and hands hero.control to the chain', () => {
    const { hero, combat, events } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4);
    combat.setEnemies([a, b]);
    combat.director.active.add('a');
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    expect(hero.control?.name).toBe('chain');
    expect(combat.combo.value).toBe(0);
    expect(a.state).toBe('chained');
    expect(b.state).toBe('chained');
    expect(combat.director.active.has('a')).toBe(false);
    const start = of(events, 'chainStart');
    expect(start).toHaveLength(1);
    expect(start[0].data).toMatchObject({ chain: 'rope', count: 2, stealth: false, ids: ['a', 'b'] });
  });

  it('applies the chain discount to the cost', () => {
    const { hero, combat } = harness({ discount: 2 });
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4)]);
    hits(combat, 7);
    combat.update(dt, ctxFor('chain2'));
    expect(hero.control?.name).toBe('chain');
    expect(combat.combo.value).toBe(0);
  });

  it('runs free from stealth when two unaware goons are close', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3, { aware: false, state: 'idle' }), goon('b', 1, 4, { aware: false, state: 'idle' })]);
    hits(combat, 2);
    combat.update(dt, ctxFor('chain3'));
    expect(hero.control?.name).toBe('chain');
    expect(combat.combo.value).toBe(2);
    expect(of(events, 'chainStart')[0].data).toMatchObject({ chain: 'domino', stealth: true });
  });

  it('calls off wind-ups of goons left out of the chain', () => {
    const { hero, combat } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4), c = goon('c', 0, 20, { state: 'windup', glyph: 'x' });
    combat.setEnemies([a, b, c]);
    combat.director.active.add('c');
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    expect(hero.control?.name).toBe('chain');
    expect(c.state).toBe('engage');
    expect(c.glyph).toBeNull();
    expect(combat.director.active.has('c')).toBe(false);
  });

  it('waits for the ground: a press in the air is kept in the buffer', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4)]);
    hits(combat, 6);
    hero.state = 'air'; hero.grounded = false;
    combat.update(dt, ctxFor('chain1'));
    expect(hero.control).toBeNull();
    expect(of(events, 'hint')).toHaveLength(0);
    hero.state = 'ground'; hero.grounded = true;
    combat.update(dt, ctxFor(null));
    expect(hero.control?.name).toBe('chain');
  });
});

describe('combat.chains', () => {
  it('refreshes what the chain icons show when the combo changes', () => {
    const { combat } = harness();
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4)]);
    combat.update(dt, ctxFor(null));
    expect(combat.chains.show).toBe(false);
    hits(combat, 6);
    combat.update(dt, ctxFor(null));
    expect(combat.chains.show).toBe(true);
    expect(combat.chains.affordable).toEqual([true, false, false]);
  });
});

describe('a chain played through combat', () => {
  it('Rope-a-Dope ties the pair, releases their slots and hands control back', () => {
    const { hero, combat, events } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4);
    combat.setEnemies([a, b]);
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    play(hero, combat);
    expect(hero.control).toBeNull();
    expect(a.state).toBe('tied');
    expect(b.state).toBe('tied');
    expect(of(events, 'chainTied')[0]?.data.count).toBe(2);
    expect(of(events, 'chainDone')).toHaveLength(1);
    // Each stagger and the tie count as hits.
    expect(combat.combo.value).toBeGreaterThanOrEqual(4);
  });

  it('Headbanger knocks both goons out', () => {
    const { hero, combat, events } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4);
    combat.setEnemies([a, b]);
    hits(combat, 9);
    combat.update(dt, ctxFor('chain2'));
    play(hero, combat);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false);
    expect(of(events, 'ko')).toHaveLength(2);
    expect(of(events, 'critical').length).toBeGreaterThanOrEqual(1);
  });

  it('never mutates a vector it handed out in a word event', () => {
    const { hero, combat, events } = harness();
    combat.setEnemies([goon('a', 0, 3), goon('b', 1, 4), goon('c', -1, 5)]);
    hits(combat, 12);
    combat.update(dt, ctxFor('chain3'));
    play(hero, combat);
    const words = of(events, 'word');
    expect(words.length).toBeGreaterThanOrEqual(3);
    for (const w of words) expect(w.data.pos.equals(w.snap)).toBe(true);
    // And no two word events share one vector.
    expect(new Set(words.map((w) => w.data.pos)).size).toBe(words.length);
  });

  it('lets go of every still-chained goon when the chain control is dropped (a teleport)', () => {
    const { hero, combat, events } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4), c = goon('c', -1, 5);
    combat.setEnemies([a, b, c]);
    hits(combat, 12);
    combat.update(dt, ctxFor('chain3'));
    expect(hero.control?.name).toBe('chain');
    // Two frames in: nobody stomped yet, all three held.
    for (let i = 0; i < 2; i++) hero.control.update(dt);
    expect([a.state, b.state, c.state]).toEqual(['chained', 'chained', 'chained']);
    hero.control = null; // hero.teleport does this
    combat.update(dt, ctxFor(null));
    expect([a.state, b.state, c.state]).toEqual(['engage', 'engage', 'engage']);
    expect(hero.invulnerable).toBeLessThanOrEqual(0.3);
    expect(of(events, 'chainBroken')).toHaveLength(1);
    // Not twice.
    combat.update(dt, ctxFor(null));
    expect(of(events, 'chainBroken')).toHaveLength(1);
  });

  it('leaves goons alone after a chain that finished normally', () => {
    const { hero, combat, events } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4);
    combat.setEnemies([a, b]);
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    play(hero, combat);
    combat.update(dt, ctxFor(null));
    expect(a.state).toBe('tied');
    expect(of(events, 'chainBroken')).toHaveLength(0);
  });

  it('lets go of chained goons when the control is replaced by another one', () => {
    const { hero, combat } = harness();
    const a = goon('a', 0, 3), b = goon('b', 1, 4);
    combat.setEnemies([a, b]);
    hits(combat, 6);
    combat.update(dt, ctxFor('chain1'));
    hero.control = { name: 'stagger', combat: true, canChain: () => false, update: () => false };
    combat.update(dt, ctxFor(null));
    expect(a.state).toBe('engage');
    expect(b.state).toBe('engage');
  });
});
