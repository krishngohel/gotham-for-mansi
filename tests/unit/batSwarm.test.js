import { describe, it, expect } from 'vitest';
import { SWARM, swarmTargets, swarmAvailability, swarmTimeline, createSwarmControl } from '../../src/combat/batSwarm.js';
import { createEvents } from '../../src/core/events.js';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { ENEMY } from '../../src/combat/rules.js';
import { createRng } from '../../src/core/rng.js';
import { BASE_EFFECTS } from '../../src/progress/upgrades.js';

const goon = (id, x, z, o = {}) => ({ id, type: 'grunt', def: {}, alive: true, down: false, air: false, aware: true, state: 'engage', pos: { x, y: 0, z }, ...o });
const O = { x: 0, y: 0, z: 0 };

describe('Bat Swarm rules', () => {
  it('is chain 4 on its own key, costing 15', () => {
    expect(SWARM).toMatchObject({ n: 4, id: 'swarm', cost: 15, action: 'chain4', reach: 10, maxTargets: 6, minTargets: 2 });
  });
  it('takes up to six eligible goons in 10 m, nearest first', () => {
    const list = [goon('far', 12, 0), goon('b', 3, 0), goon('a', 1, 0), goon('j', 2, 0, { type: 'joker', def: { boss: true } }), goon('ice', 2, 1, { state: 'frozen' }),
      ...[4, 5, 6, 7, 8].map((x) => goon(`g${x}`, x, 0.5))];
    expect(swarmTargets(O, list).map((e) => e.id)).toEqual(['a', 'b', 'g4', 'g5', 'g6', 'g7']);
    expect(swarmTargets(O, [goon('a', 1, 0)])).toBe(null);
    expect(swarmTargets(O, [goon('a', 1, 0), goon('b', 2, 0)], { canSee: (e) => e.id !== 'b' })).toBe(null);
  });
  it('hidden until owned; affordable at 15, or 13 with Efficient Chains', () => {
    const squad = [goon('a', 1, 0), goon('b', 2, 0)];
    expect(swarmAvailability({ owned: false, combo: 30, origin: O, enemies: squad })).toMatchObject({ show: false, affordable: false });
    expect(swarmAvailability({ owned: true, combo: 14, origin: O, enemies: squad })).toMatchObject({ show: true, affordable: false, cost: 15 });
    expect(swarmAvailability({ owned: true, combo: 15, origin: O, enemies: squad }).affordable).toBe(true);
    expect(swarmAvailability({ owned: true, combo: 13, origin: O, enemies: squad, discount: 2 })).toMatchObject({ affordable: true, cost: 13 });
    expect(swarmAvailability({ owned: true, combo: 3, origin: O, enemies: squad }).show).toBe(false);
  });
  it('the timeline holds, staggers each goon once, finishes, then ends', () => {
    const tl = swarmTimeline(3);
    expect(tl.steps.map((s) => s.kind)).toEqual(['hold', 'stagger', 'stagger', 'stagger', 'finish', 'end']);
    expect(tl.steps.filter((s) => s.kind === 'stagger').map((s) => s.index)).toEqual([0, 1, 2]);
    const at = tl.steps.map((s) => s.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(tl.duration).toBeCloseTo(1.94);
  });
});

describe('Bat Swarm control', () => {
  it('plays the timeline through the chain api and reports when done', () => {
    const calls = [];
    const events = createEvents();
    events.on('swarmDone', ({ count }) => calls.push(['done', count]));
    const api = {
      events,
      hold: (e) => calls.push(['hold', e.id]), release: (e) => calls.push(['release', e.id]),
      stagger: (e) => calls.push(['stagger', e.id]), finish: (e) => calls.push(['finish', e.id]),
      critical: () => calls.push(['critical']), word: (text) => calls.push(['word', text]),
    };
    const hero = { pos: { x: 0, y: 0, z: 0, clone() { return { ...this }; } }, bat: { animator: { play() {} } } };
    const targets = [goon('a', 1, 0), goon('b', 2, 0)];
    const ctl = createSwarmControl(hero, api, { targets, timeline: swarmTimeline(2), fx: null });
    expect(ctl).toMatchObject({ name: 'swarm', camera: 'chain', combat: true });
    let done = false;
    for (let i = 0; i < 200 && !done; i++) done = ctl.update(0.02);
    expect(done).toBe(true);
    const kinds = calls.map((c) => c[0]);
    expect(kinds.slice(0, 2)).toEqual(['hold', 'hold']);
    expect(kinds.filter((k) => k === 'stagger')).toHaveLength(2);
    expect(kinds.indexOf('release')).toBeLessThan(kinds.indexOf('finish'));
    expect(calls.at(-1)).toEqual(['done', 2]);
  });
});

// ---- started from combat (combatSystem.js): hints, cost, holds, cleanup ----

function harness({ owned = true, discount = 0 } = {}) {
  const bat = { yaw: 0, face(y) { bat.yaw = y; }, tilt: { rotation: { set() {} } }, bone: () => ({ getWorldPosition: (o) => o.set(0, 11.4, 0) }), animator: { play() {} } };
  const hero = {
    pos: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector3(), state: 'ground', grounded: true, dead: false,
    invulnerable: 0, health: 100, maxHealth: 100, control: null, blocking: false, bat, cape: { setWings() {} },
    setState(s) { hero.state = s; }, heightAboveGround: () => 0,
    collision: { raycast: () => null, resolveCylinder: (pos) => ({ groundY: pos.y }), groundBelow: () => 10 },
  };
  const follow = { forward: (o) => o.set(0, 0, 1), right: (o) => o.set(-1, 0, 0), addShake() {}, hitKick() {}, actionShot() {} };
  const events = { log: [], emit(type, data) { this.log.push({ type, data }); }, on() {} };
  const time = { hitStop() {}, slowMo() {} };
  const effects = { ...BASE_EFFECTS, batSwarm: owned, chainDiscount: discount };
  const combat = createCombat({ hero, follow, time, events, rng: createRng(1), getDifficulty: () => 'normal', effects });
  return { hero, combat, events };
}
function fighter(id, x, z, o = {}) {
  const e = {
    id, type: 'grunt', def: ENEMY.grunt, scale: 1, radius: 0.42, pos: new THREE.Vector3(x, 10, z),
    alive: true, aware: true, state: 'engage', down: false, air: false, stunned: false, health: 40, glyph: null, tiedWith: null,
    applyHit(result) { if (result.outcome === 'ko') { e.alive = false; e.state = 'ko'; } else if (result.outcome === 'knockdown') { e.down = true; e.state = 'down'; } return false; },
    chainHold() { e.state = 'chained'; return false; },
    chainRelease() { if (e.state === 'chained') e.state = 'engage'; },
    ch: { headWorld(out, lift = 0) { return out.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z); }, face() {}, animator: { play() {} } },
    update() {}, ready: () => false, wake() {}, startWindup() {},
    ...o,
  };
  return e;
}
const fx = () => {
  const log = [];
  return { log, start: (list) => log.push(['start', list.length]), rise: () => log.push(['rise']), stop: () => log.push(['stop']) };
};
const ctxFor = (pressed, swarmFx = null) => ({ input: { pressed: (a) => a === pressed, down: () => false, move: { x: 0, y: 0 } }, fx: {}, chainFx: null, swarmFx });
const DT = 1 / 60;
const of = (events, type) => events.log.filter((ev) => ev.type === type);
function play(hero, combat, ctx, frames = 600) {
  const ctl = hero.control;
  for (let i = 0; i < frames && hero.control === ctl; i++) {
    combat.update(DT, ctx);
    if (ctl.update(DT) && hero.control === ctl) hero.control = null;
  }
}

describe('Bat Swarm from combat', () => {
  it('hints why not, and uses up the press: locked, short of combo, too few goons', () => {
    const locked = harness({ owned: false });
    locked.combat.setEnemies([fighter('a', 0, 3), fighter('b', 1, 4)]);
    for (let i = 0; i < 20; i++) locked.combat.combo.hit();
    locked.combat.update(DT, ctxFor('chain4'));
    expect(of(locked.events, 'hint').map((ev) => ev.data.id)).toEqual(['swarm-locked']);
    const poor = harness();
    poor.combat.setEnemies([fighter('a', 0, 3), fighter('b', 1, 4)]);
    for (let i = 0; i < 14; i++) poor.combat.combo.hit();
    poor.combat.update(DT, ctxFor('chain4'));
    expect(of(poor.events, 'hint').map((ev) => ev.data)).toEqual([{ id: 'swarm-cost', arg: 15 }]);
    const alone = harness();
    alone.combat.setEnemies([fighter('a', 0, 3)]);
    for (let i = 0; i < 15; i++) alone.combat.combo.hit();
    alone.combat.update(DT, ctxFor('chain4'));
    expect(of(alone.events, 'hint').map((ev) => ev.data.id)).toEqual(['swarm-targets']);
    expect(alone.combat.combo.value).toBe(15);
    for (const h of [locked, poor, alone]) {
      expect(h.hero.control).toBeNull();
      h.combat.update(DT, ctxFor(null));
      expect(of(h.events, 'hint')).toHaveLength(1);
    }
  });

  it('shows on the HUD once owned, lit at 13 with Efficient Chains', () => {
    const { combat } = harness({ discount: 2 });
    combat.setEnemies([fighter('a', 0, 3), fighter('b', 1, 4)]);
    for (let i = 0; i < 13; i++) combat.combo.hit();
    combat.update(DT, ctxFor(null));
    expect(combat.swarm).toMatchObject({ show: true, affordable: true, cost: 13 });
  });

  it('spends the combo, knocks out the squad (the brute only goes down), one critical, then swarmDone', () => {
    const { hero, combat, events } = harness();
    const squad = [fighter('a', 0, 3), fighter('b', 2, 4), fighter('c', -2, 4), fighter('br', 1, 6, { type: 'brute', def: ENEMY.brute })];
    const joker = fighter('j', 1, 2, { type: 'joker', def: { ...ENEMY.grunt, boss: true } });
    combat.setEnemies([...squad, joker]);
    for (let i = 0; i < 16; i++) combat.combo.hit();
    const f = fx();
    const ctx = ctxFor('chain4', f);
    combat.update(DT, ctx);
    expect(hero.control?.name).toBe('swarm');
    expect(of(events, 'swarmStart').map((ev) => ev.data)).toEqual([{ count: 4 }]);
    expect(hero.invulnerable).toBeGreaterThan(1);
    play(hero, combat, ctxFor(null, f));
    combat.update(DT, ctxFor(null, f));
    expect(squad.map((e) => e.state)).toEqual(['ko', 'ko', 'ko', 'down']);
    expect(joker.state).toBe('engage');
    expect(of(events, 'critical')).toHaveLength(1);
    expect(of(events, 'critical')[0].data.variant).toBe('swarm');
    expect(of(events, 'swarmDone').map((ev) => ev.data)).toEqual([{ count: 4 }]);
    expect(of(events, 'chainBroken')).toHaveLength(0);
    expect(f.log.map((l) => l[0])).toEqual(['start', 'rise', 'stop', 'stop']);
  });

  it('lets every goon go and sends the bats off when the swarm is cut short (a teleport)', () => {
    const { hero, combat, events } = harness();
    const squad = [fighter('a', 0, 3), fighter('b', 2, 4), fighter('c', -2, 4)];
    combat.setEnemies(squad);
    for (let i = 0; i < 15; i++) combat.combo.hit();
    const f = fx();
    combat.update(DT, ctxFor('chain4', f));
    for (let i = 0; i < 10; i++) { combat.update(DT, ctxFor(null, f)); hero.control.update(DT); }
    expect(squad.every((e) => e.state === 'chained')).toBe(true);
    hero.control = null;
    combat.update(DT, ctxFor(null, f));
    expect(squad.map((e) => e.state)).toEqual(['engage', 'engage', 'engage']);
    expect(hero.invulnerable).toBeLessThanOrEqual(0.3);
    expect(f.log.at(-1)).toEqual(['stop']);
    expect(of(events, 'chainBroken').map((ev) => ev.data)).toEqual([{ chain: 'swarm' }]);
    expect(of(events, 'swarmDone')).toHaveLength(0);
  });
});
