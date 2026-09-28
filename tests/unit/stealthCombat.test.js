import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createTimeControl } from '../../src/core/time.js';
import { createRng } from '../../src/core/rng.js';
import { ENEMY } from '../../src/combat/rules.js';

function makeHero() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false, crouched: false,
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
      return false;
    },
    update(dt, ctx) { if (this.attack) { const k = this.attack; this.attack = null; if (k === 'rifle') ctx.onRifleFire?.(this); ctx.onAttackLand(this, k); } },
    ready() { return this.state === 'engage'; },
    startWindup(w) { this.windups.push(w); this.state = 'windup'; },
    ...o,
  };
}
const follow = { forward: (v = new THREE.Vector3()) => v.set(0, 0, 1), right: (v = new THREE.Vector3()) => v.set(-1, 0, 0), addShake() {}, actionShot() {} };
const ctxWith = (pressed = []) => ({ input: { move: { x: 0, y: 0 }, pressed: (a) => pressed.includes(a), down: () => false }, fx: {} });
function setup(stealthStart = null) {
  const hero = makeHero();
  const events = createEvents();
  const combat = createCombat({ hero, follow, time: createTimeControl(), events, rng: createRng(3), getDifficulty: () => 'normal', stealthStart });
  hero.combat = combat;
  return { hero, events, combat };
}

describe('the stealth hook in combat', () => {
  it('a punch or a kick asks the stealth runtime first', () => {
    const calls = [];
    const { combat, hero } = setup((a) => { calls.push(a); return true; });
    combat.setEnemies([makeGoon('g', 'grunt', 0, 1.2, { aware: false, state: 'idle' })]);
    combat.update(0.016, ctxWith(['punch']));
    combat.update(0.016, ctxWith(['kick']));
    expect(calls).toEqual(['punch', 'kick']);
    expect(hero.control).toBe(null);
  });
  it('when it declines, the punch lands as usual', () => {
    const { combat, hero } = setup(() => false);
    combat.setEnemies([makeGoon('g', 'grunt', 0, 1.5)]);
    combat.update(0.016, ctxWith(['punch']));
    expect(hero.control?.name).toBe('strike');
  });
  it('blocks and dodges never reach it', () => {
    const calls = [];
    const { combat } = setup((a) => { calls.push(a); return true; });
    combat.setEnemies([makeGoon('g', 'grunt', 0, 3)]);
    combat.update(0.016, ctxWith(['block']));
    combat.update(0.016, ctxWith(['dodge']));
    expect(calls).toEqual([]);
  });
});

describe('takedowns and rifles', () => {
  it('a takedown can be quiet (no critical) and names its target', () => {
    const { combat, events } = setup();
    const g = makeGoon('g', 'grunt', 0, 2), h = makeGoon('h', 'grunt', 1, 2);
    combat.setEnemies([g, h]);
    const seen = [];
    events.on('critical', () => seen.push('critical'));
    events.on('takedown', (d) => seen.push([d.kind, d.target.id]));
    expect(combat.takedown(g, 'silent', { crit: false })).toBe(true);
    expect(g.alive).toBe(false);
    expect(seen).toEqual([['silent', 'g']]);
    combat.takedown(h, 'perch');
    expect(seen).toEqual([['silent', 'g'], 'critical', ['perch', 'h']]);
  });
  it('a rifle shot emits rifleShot at Batman chest height and lands 25 damage', () => {
    const { combat, events, hero } = setup();
    const r = makeGoon('r', 'rifle', 0, 12, { attack: 'rifle' });
    combat.setEnemies([r]);
    const shots = [];
    events.on('rifleShot', (d) => shots.push([d.target.id, d.hit, +d.to.y.toFixed(1)]));
    combat.update(0.016, ctxWith());
    expect(shots).toEqual([['r', true, 1.1]]);
    expect(hero.health).toBe(75);
  });
  it('the director announces a rifle wind-up', () => {
    const { combat, events } = setup();
    combat.setEnemies([makeGoon('r', 'rifle', 0, 8)]);
    const aims = [];
    events.on('rifleAim', (d) => aims.push(d.target.id));
    for (let i = 0; i < 300 && !aims.length; i++) combat.update(0.05, ctxWith());
    expect(aims).toEqual(['r']);
  });
});
