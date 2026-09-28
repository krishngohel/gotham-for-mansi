import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createTimeControl } from '../../src/core/time.js';
import { createRng } from '../../src/core/rng.js';
import { ENEMY } from '../../src/combat/rules.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';

function makeHero() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false,
    invulnerable: 0, health: 100, maxHealth: 100, blocking: false, heightAboveGround: () => 0,
    collision: { raycast: () => null, resolveCylinder: () => ({ groundY: 0 }), groundBelow: () => 0 },
    bat: {
      yaw: 0, face() {}, tilt: { rotation: { set() {} } },
      animator: { play: () => ({ time: 0, getClip: () => ({ duration: 1 }) }), update() {} },
      bone: () => ({ getWorldPosition: (v) => v.set(0, 1.4, 0) }),
    },
    cape: { setWings() {} },
  };
}
function makeGoon(id, type, x, z, o = {}) {
  return {
    id, type, def: ENEMY[type], scale: ENEMY[type].scale, radius: 0.42, alive: true, down: false, air: false, aware: true,
    state: 'engage', health: ENEMY[type].health, stunned: false, glyph: null, pos: new THREE.Vector3(x, 0, z),
    get x() { return this.pos.x; }, get z() { return this.pos.z; },
    ch: { headWorld: (v) => v.set(x, 1.6, z), animator: { play() {} } },
    outcomes: [], windups: [], attack: null,
    applyHit(r) {
      this.outcomes.push(r.outcome);
      if (r.outcome === 'ko') { this.alive = false; this.down = true; this.state = 'ko'; }
      else if (r.outcome === 'knockdown') { this.down = true; this.state = 'down'; }
      return false;
    },
    update(dt, ctx) { if (this.attack) { const k = this.attack; this.attack = null; ctx.onAttackLand(this, k); } },
    ready() { return this.state === 'engage'; },
    startWindup(w) { this.windups.push(w); this.state = 'windup'; },
    ...o,
  };
}
const follow = { forward: (v = new THREE.Vector3()) => v.set(0, 0, 1), right: (v = new THREE.Vector3()) => v.set(-1, 0, 0), addShake() {}, actionShot() {} };
const ctxWith = (pressed = []) => ({ input: { move: { x: 0, y: 0 }, pressed: (a) => pressed.includes(a), down: () => false }, fx: {} });
function setup({ owned = [], useGadget = null } = {}) {
  const hero = makeHero();
  const events = createEvents();
  const effects = upgradeEffects(owned);
  const combat = createCombat({ hero, follow, time: createTimeControl(), events, rng: createRng(3), getDifficulty: () => 'normal', effects, useGadget });
  hero.combat = combat;
  return { hero, events, combat, effects };
}
const tree = { armor: ['plating1', 'kevlar', 'plating2', 'medic', 'dampers'], combat: ['reflexes', 'flow', 'efficient', 'fastFinish', 'swarm'] };

describe('armor hooks', () => {
  it('knife damage without and with Kevlar Weave', () => {
    for (const [owned, left] of [[[], 85], [tree.armor.slice(0, 2), 89.5]]) {
      const { hero, combat } = setup({ owned });
      combat.setEnemies([makeGoon('k', 'knife', 0, 1.5, { attack: 'knife' })]);
      combat.update(0.016, ctxWith());
      expect(hero.health).toBeCloseTo(left);
    }
  });
  it('Impact Dampers stack with Kevlar', () => {
    const { hero, combat } = setup({ owned: tree.armor });
    combat.setEnemies([makeGoon('k', 'knife', 0, 1.5, { attack: 'knife' })]);
    combat.update(0.016, ctxWith());
    expect(hero.health).toBeCloseTo(100 - 15 * 0.7 * 0.85, 1);
  });
});

describe('combat hooks', () => {
  it('Steady Flow keeps the combo through the first hit taken', () => {
    const { combat } = setup({ owned: tree.combat.slice(0, 2) });
    const g = makeGoon('g', 'grunt', 0, 1.5);
    combat.setEnemies([g]);
    for (let i = 0; i < 5; i++) combat.combo.hit();
    g.attack = 'grunt';
    combat.update(0.016, ctxWith());
    expect(combat.combo.value).toBe(5);
    g.attack = 'grunt';
    combat.update(0.016, ctxWith());
    expect(combat.combo.value).toBe(0);
  });
  it('Quick Reflexes lengthens counterable wind-ups only', () => {
    const { combat } = setup({ owned: ['reflexes'] });
    const g = makeGoon('g', 'grunt', 0, 3), b = makeGoon('b', 'brute', 1, 4);
    combat.setEnemies([g, b]);
    combat.update(3, ctxWith());
    combat.update(0.5, ctxWith());
    expect(g.windups[0]).toBeCloseTo(0.75);
    expect(b.windups[0]).toBeCloseTo(0.6);
  });
  it('Fast Finish readies the special at combo 6', () => {
    for (const [owned, ready] of [[[], false], [tree.combat.slice(0, 4), true]]) {
      const { combat } = setup({ owned });
      for (let i = 0; i < 6; i++) combat.combo.hit();
      expect(combat.combo.ready).toBe(ready);
    }
  });
  it('Efficient Chains lowers every chain cost by 2 through the 4E hook', () => {
    const { combat } = setup({ owned: tree.combat.slice(0, 3) });
    combat.setEnemies([makeGoon('a', 'grunt', 1, 2), makeGoon('b', 'grunt', -1, 2)]);
    for (let i = 0; i < 4; i++) combat.combo.hit();
    combat.update(0.016, ctxWith());
    expect(combat.chains.costs).toEqual([4, 7, 10]);
  });
  it('applyEffects picks up a purchase made mid-run', () => {
    const { combat, effects } = setup();
    upgradeEffects(tree.combat.slice(0, 4), effects);
    combat.applyEffects();
    for (let i = 0; i < 6; i++) combat.combo.hit();
    expect(combat.combo.ready).toBe(true);
  });
});

describe('gadget hooks', () => {
  it('the fire key goes to the gadget system through the input buffer', () => {
    const useGadget = vi.fn(() => true);
    const { combat } = setup({ useGadget });
    combat.update(0.016, ctxWith(['batarang']));
    combat.update(0.016, ctxWith());
    expect(useGadget).toHaveBeenCalledTimes(1);
    expect(useGadget.mock.calls[0][1]).toEqual({ inAir: false });
  });
  it('nothing is buffered while the wheel is open', () => {
    const useGadget = vi.fn(() => true);
    const { combat } = setup({ useGadget });
    const ctx = ctxWith(['batarang']);
    ctx.lockInput = true;
    combat.update(0.016, ctx);
    combat.update(0.016, ctxWith());
    expect(useGadget).not.toHaveBeenCalled();
  });
  it('holding block under the open wheel does not guard', () => {
    const { hero, combat } = setup();
    combat.setEnemies([makeGoon('g', 'grunt', 0, 3)]);
    const ctx = { ...ctxWith(), input: { ...ctxWith().input, down: (a) => a === 'block' } };
    combat.update(0.016, ctx);
    expect(hero.blocking).toBe(true);
    ctx.lockInput = true;
    combat.update(0.016, ctx);
    expect(hero.blocking).toBe(false);
  });
  it('areaBlast knocks down goons in reach; brutes shrug it off; far goons are safe', () => {
    const { combat } = setup();
    const near = makeGoon('n', 'grunt', 0, 2), far = makeGoon('f', 'grunt', 0, 6), brute = makeGoon('b', 'brute', 1, 0);
    combat.setEnemies([near, far, brute]);
    expect(combat.gadgetApi.areaBlast({ x: 0, y: 0, z: 0 }, 4, 'gel')).toBe(1);
    expect(near.outcomes).toEqual(['knockdown']);
    expect(brute.outcomes).toEqual(['immune']);
    expect(far.outcomes).toEqual([]);
  });
  it('any hit on a frozen goon shatters the ice and knocks it out', () => {
    const { combat, events } = setup();
    const g = makeGoon('g', 'grunt', 0, 2, { state: 'frozen' });
    combat.setEnemies([g]);
    const seen = [];
    events.on('iceShatter', () => seen.push('shatter'));
    events.on('ko', () => seen.push('ko'));
    expect(combat.gadgetApi.landHit('punch', g).outcome).toBe('ko');
    expect(g.alive).toBe(false);
    expect(seen).toEqual(['shatter', 'ko']);
  });
});
