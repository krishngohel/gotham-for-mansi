import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { rootMotionAt } from '../../src/combat/reach.js';
import { MOCAP_DATA } from '../../src/config/mocapData.js';
import { MOCAP_SPEED, MOCAP_START } from '../../src/config/mocap.js';
import { ENEMY } from '../../src/combat/rules.js';
import { createRng } from '../../src/core/rng.js';

// A minimal hero/world so a strike can be run frame by frame without three.js scenes.
function harness({ reach, groundY = null } = {}) {
  const hero = {
    pos: new THREE.Vector3(0, 10, 0), vel: new THREE.Vector3(), state: 'ground', grounded: true, dead: false,
    invulnerable: 0, health: 100, maxHealth: 100, control: null, blocking: false,
    bat: { yaw: 0, face(y) { this.yaw = y; }, animator: { play() {} }, tilt: { rotation: { set() {} } } },
    cape: { setWings() {} },
    heightAboveGround: () => 0,
    collision: {
      raycast: () => null,
      // Flat ground at y=10, except a cliff wherever groundY says so.
      resolveCylinder(pos) { return { groundY: groundY ? groundY(pos) : pos.y }; },
      groundBelow: () => 10,
    },
  };
  const follow = { forward: (o) => o.set(0, 0, 1), right: (o) => o.set(-1, 0, 0), addShake() {}, hitKick() {}, actionShot() {} };
  const events = { emit() {}, on() {} };
  const time = { hitStop() {}, slowMo() {} };
  const combat = createCombat({ hero, follow, time, events, rng: createRng(1), getDifficulty: () => 'normal', reach });
  return { hero, combat };
}

function goon(z, { knockback = 3 } = {}) {
  const e = {
    id: 1, type: 'grunt', def: ENEMY.grunt, scale: 1, radius: 0.42, pos: new THREE.Vector3(0, 10, z),
    alive: true, aware: true, state: 'engage', down: false, air: false, stunned: false, health: 40, glyph: null,
    // Knockback: the goon is shoved straight back on the frame it is hit.
    applyHit() { this.pos.z += knockback; return false; },
    ch: { headWorld(out) { return out.copy(e.pos); }, face() {} },
    update() {}, ready: () => false, wake() {}, startWindup() {},
    // Targeting reads flat coordinates.
    get x() { return this.pos.x; }, get z() { return this.pos.z; },
  };
  return e;
}

const ctxFor = (pressed) => ({ input: { pressed: (a) => a === pressed, down: () => false, move: { x: 0, y: 0 } }, fx: {} });

// Run one kick from the press to the end of the move, recording the hero's path.
function runKick({ z = 2.6, groundY = null } = {}) {
  const clip = 'Kick_Front';
  const entry = { ...MOCAP_DATA[clip], reach: { ...MOCAP_DATA[clip].reach } };
  const { hero, combat } = harness({ reach: { [clip]: entry }, groundY });
  const e = goon(z);
  combat.setEnemies([e]);
  const dt = 1 / 120;
  combat.update(dt, ctxFor('kick'));
  expect(hero.control?.name).toBe('strike');
  const ctl = hero.control;
  const speed = MOCAP_SPEED[clip], start = MOCAP_START[clip];
  const impactAt = (entry.contact - start) / speed;
  let t = 0, atContact = null, hitZ = null;
  const path = [];
  for (let i = 0; i < 400 && hero.control === ctl; i++) {
    combat.update(dt, ctxFor(null));
    if (ctl.update(dt)) hero.control = null;
    t += dt;
    path.push(hero.pos.clone());
    if (atContact === null && t >= impactAt) { atContact = hero.pos.clone(); hitZ = e.pos.z; }
  }
  return { hero, e, ctl, entry, speed, start, impactAt, atContact, hitZ, path, t };
}

describe('strike approach', () => {
  it('moves the hero only by the clip root motion after contact, not by the target knockback', () => {
    const { hero, e, entry, speed, start, impactAt, atContact, hitZ, t } = runKick();
    expect(atContact).not.toBeNull();
    // The goon was shoved 3 m on contact.
    expect(hitZ).toBeGreaterThan(2.6 + 2.9);
    // Expected post-contact displacement: the clip's own root motion between the contact
    // frame and the end frame (facing +z, so clip z maps to world z and clip x to world -x).
    const a = rootMotionAt(entry, entry.contact), b = rootMotionAt(entry, start + t * speed, [0, 0]);
    const expected = new THREE.Vector3(-(b[0] - a[0]), 0, b[1] - a[1]);
    const moved = hero.pos.clone().sub(atContact);
    expect(Math.abs(moved.x - expected.x)).toBeLessThan(0.05);
    expect(Math.abs(moved.z - expected.z)).toBeLessThan(0.05);
    expect(moved.length()).toBeLessThan(1);
    expect(hero.pos.y).toBe(10);
  });

  it('lands the foot inside the goon on the contact frame without the bodies overlapping', () => {
    const { atContact, hitZ, entry } = runKick();
    const foot = atContact.z + entry.reach.z;
    const goonBefore = hitZ - 3;
    expect(foot).toBeGreaterThan(goonBefore - 0.42);
    expect(foot).toBeLessThan(goonBefore + 0.42);
    expect(goonBefore - atContact.z).toBeGreaterThan(0.42 + 0.2);
  });

  it('refuses to step off a ledge', () => {
    // A drop just past z = 1: the lunge toward a goon at 2.6 m must stop at the edge.
    const { hero, path } = runKick({ z: 2.6, groundY: (p) => (p.z > 1 ? 0 : p.y) });
    expect(hero.pos.z).toBeLessThanOrEqual(1.01);
    for (const p of path) expect(p.z).toBeLessThanOrEqual(1.01);
    expect(hero.pos.y).toBe(10);
  });
});
