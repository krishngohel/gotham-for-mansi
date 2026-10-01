// Nightwing (Part N): createNightwing(deps) builds a Nightwing actor that can fight beside
// Batman (spawn(p, 'ally')) or play the masked Party Crasher (spawn(p, 'crasher')). Decision
// logic that doesn't need three.js lives in nightwingLogic.js so it can be unit tested directly;
// this file is the wiring: the character, its little state machine, and the hooks into combat's
// existing hit/critical/event pipeline so Nightwing's blows land exactly like Batman's.
import { createNightwingCharacter } from '../actors/nightwingChar.js';
import { footGround } from '../actors/characters.js';
import { pickAllyTarget, canTeamTakedown, nearestThreat, fleeStep } from './nightwingLogic.js';

const WALK = 'Walk_Loop', JOG = 'Jog_Fwd_Loop', IDLE = 'Idle_Loop';
const PUNCHES = ['Punch_Jab', 'Punch_Cross'];
const KICK = 'Kick_Front';
const MELEE_RANGE = 1.35;
const APPROACH_SPEED = 4.6;
const TAKEDOWN_RADIUS = 3;
const TAKEDOWN_COMBO = 5;
const DODGE_RADIUS = 3.2;
const STAGGER_RADIUS = 1.3;

// deps: assets, scene, collision (world collision, for foot planting), events, combat (the
// createCombat() instance running the current fight), hero (the player), rng (shared seeded
// rng), and an optional live `ctx` reference (the same frame ctx game.js passes to
// combat.update) so a team takedown press can be swallowed for that one frame before combat's
// own inputBuffer sees it (ctx.lockInput, already read by combatSystem.js for the gadget wheel).
export function createNightwing({ assets, scene, collision, events, combat, hero, rng, ctx = null }) {
  const groundUnderFoot = footGround(collision);
  // `pos` is ch.root.position itself (like hero.js's and enemy.js's own `pos`), not a copy: moving
  // it moves the character directly, and reading ch.root.position always sees the same numbers.
  let pos = null;
  let ch = null;
  let mode = null; // 'ally' | 'crasher' | null (not spawned)
  let target = null;
  let state = 'idle';
  let stateT = 0;
  let strikeKind = 'punch';
  let hitDone = false;
  let teamCooldown = 0;
  let staggerCooldown = 0;
  let fleeFrom = null, fleeTo = null, fleeT = 0;

  function place(p, yaw) {
    pos.set(p.x, p.y, p.z);
    ch.face(yaw);
  }

  function spawn(p, spawnMode = 'ally') {
    if (ch) despawn();
    mode = spawnMode;
    ch = createNightwingCharacter(assets, mode);
    ch.groundAt = groundUnderFoot;
    pos = ch.root.position;
    scene.add(ch.root);
    place(p, Math.atan2(hero.pos.x - p.x, hero.pos.z - p.z));
    state = mode === 'crasher' ? 'crasher-idle' : 'idle';
    stateT = 0;
    target = null;
    fleeFrom = fleeTo = null;
    return api;
  }

  function despawn() {
    if (!ch) return;
    scene.remove(ch.root);
    ch = null;
    mode = null;
    target = null;
    state = 'idle';
  }

  function faceTowards(dx, dz, rate, dt) {
    const yaw = Math.atan2(dx, dz);
    const delta = Math.atan2(Math.sin(yaw - ch.yaw), Math.cos(yaw - ch.yaw));
    ch.face(ch.yaw + delta * Math.min(1, rate * dt));
  }

  // Batman's own "current target": no such field exists on the hero (freeflow combat picks a
  // target per swing), so it is approximated as the nearest aware, standing goon within melee
  // reach of him. Good enough for "don't steal Batman's target": it tracks whoever he is
  // actually trading blows with.
  function nearestBatmanTarget() {
    let best = null, bestD = 42; // ~6.5 m, melee reach
    for (const e of combat.enemies) {
      if (!e.alive || e.down || !e.aware || e.type === 'joker' || e.def?.boss) continue;
      const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // Any live, standing, non-boss goon within TAKEDOWN_RADIUS of both fighters right now,
  // whatever Nightwing's own AI happens to be chasing.
  function sharedGoon() {
    const r2 = TAKEDOWN_RADIUS * TAKEDOWN_RADIUS;
    for (const e of combat.enemies) {
      if (!e.alive || e.down || e.type === 'joker' || e.def?.boss) continue;
      const dhx = e.pos.x - hero.pos.x, dhz = e.pos.z - hero.pos.z;
      if (dhx * dhx + dhz * dhz > r2) continue;
      const dax = e.pos.x - pos.x, daz = e.pos.z - pos.z;
      if (dax * dax + daz * daz > r2) continue;
      return e;
    }
    return null;
  }

  function teamTakedown(e) {
    combat.gadgetApi.critical(e, { slow: 0.7, scale: 0.26, impact: 2 });
    e.health = 0;
    const wasAttacking = e.applyHit({ outcome: 'ko' }, hero.pos, { power: 2, launch: 3 });
    if (wasAttacking) combat.director.release(e.id);
    combat.combo.spend();
    if (target === e) target = null;
    events.emit('ko', { target: e });
    events.emit('teamTakedown', { target: e });
  }

  function doStrike(kind) {
    strikeKind = kind;
    hitDone = false;
    state = 'strike';
    stateT = 0;
    const clip = kind === 'kick' ? KICK : PUNCHES[rng?.chance?.(0.5) ? 1 : 0];
    ch.animator.play(clip, { once: true, timeScale: 1.6, fade: 0.06 });
  }

  function updateAlly(dt) {
    if (teamCooldown > 0) teamCooldown -= dt;
    if (staggerCooldown > 0) staggerCooldown -= dt;

    // Team takedown: checked first, whatever else Nightwing is doing, as long as he and Batman
    // are both actually standing next to the same goon.
    if (teamCooldown <= 0 && ctx?.input?.pressed('special')) {
      const goon = sharedGoon();
      if (goon && canTeamTakedown({
        heroX: hero.pos.x, heroZ: hero.pos.z, allyX: pos.x, allyZ: pos.z,
        targetX: goon.pos.x, targetZ: goon.pos.z, combo: combat.combo.value,
        radius: TAKEDOWN_RADIUS, comboThreshold: TAKEDOWN_COMBO,
      })) {
        teamTakedown(goon);
        if (ctx) ctx.lockInput = true; // swallow this press for combat.update this same frame
        teamCooldown = 1.2;
        state = 'idle';
        ch.animator.update(dt);
        return;
      }
    }

    // Dodge: a goon winding up within reach of him.
    const threat = nearestThreat(pos.x, pos.z, combat.enemies, DODGE_RADIUS, ['windup']);
    if (threat && state !== 'dodge' && state !== 'strike') { state = 'dodge'; stateT = 0; ch.animator.play('Roll', { once: true, timeScale: 1.6, fade: 0.05 }); }
    if (state === 'dodge') {
      stateT += dt;
      if (threat) {
        const dx = pos.x - threat.pos.x, dz = pos.z - threat.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        pos.x += (dx / d) * 3.2 * dt;
        pos.z += (dz / d) * 3.2 * dt;
      }
      ch.animator.update(dt);
      if (stateT > 0.4) state = 'idle';
      return;
    }

    // He can't die: if a goon's blow lands close enough to hit him, it's just a stagger.
    if (staggerCooldown <= 0 && state !== 'strike') {
      const landing = nearestThreat(pos.x, pos.z, combat.enemies, STAGGER_RADIUS, ['attack']);
      if (landing) {
        state = 'stagger'; stateT = 0; staggerCooldown = 1;
        ch.animator.play(rng?.chance?.(0.5) ? 'Hit_Chest' : 'Hit_Head', { once: true, timeScale: 1.4, fade: 0.05 });
      }
    }
    if (state === 'stagger') {
      stateT += dt;
      ch.animator.update(dt);
      if (stateT > 0.4) state = 'idle';
      return;
    }

    if (!target || !target.alive || target.down) {
      const bt = nearestBatmanTarget();
      target = pickAllyTarget(pos.x, pos.z, combat.enemies, { batmanTarget: bt });
      if (state !== 'strike') state = target ? 'seek' : 'idle';
    }

    if (!target) {
      // Nothing to fight: hold a flank position near Batman.
      const fx = hero.pos.x + Math.sin(hero.bat.yaw + 2.4) * 2.4, fz = hero.pos.z + Math.cos(hero.bat.yaw + 2.4) * 2.4;
      const dx = fx - pos.x, dz = fz - pos.z, d = Math.hypot(dx, dz);
      if (d > 0.4) {
        const step = Math.min(APPROACH_SPEED * dt, d);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        faceTowards(dx, dz, 4, dt);
        ch.animator.play(WALK, { fade: 0.2 });
      } else ch.animator.play(IDLE, { fade: 0.25 });
      ch.animator.update(dt);
      return;
    }

    const dx = target.pos.x - pos.x, dz = target.pos.z - pos.z;
    const d = Math.hypot(dx, dz) || 0.001;
    if (state === 'seek') {
      if (d > MELEE_RANGE) {
        const step = Math.min(APPROACH_SPEED * dt, d - MELEE_RANGE + 0.05);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        faceTowards(dx, dz, 6, dt);
        ch.animator.play(d > 4 ? JOG : WALK, { fade: 0.2 });
      } else {
        doStrike(rng?.chance?.(0.5) ? 'kick' : 'punch');
      }
    } else if (state === 'strike') {
      stateT += dt;
      faceTowards(dx, dz, 8, dt);
      if (!hitDone && stateT > 0.22) {
        hitDone = true;
        if (target.alive) combat.gadgetApi.landHit(strikeKind, target, { power: 1, launch: strikeKind === 'kick' ? 2 : 0, stopTime: 0.05 });
      }
      if (stateT > 0.5) state = 'seek';
    }
    ch.animator.update(dt);
  }

  function crasherFlee(to) {
    if (!ch || mode !== 'crasher') return;
    fleeFrom = { x: pos.x, y: pos.y, z: pos.z };
    fleeTo = { x: to.x, y: to.y, z: to.z };
    fleeT = 0;
    state = 'crasher-flee';
    events.emit('crasherTaunt', { text: 'Too slow, birthday girl!' });
  }

  function updateCrasher(dt) {
    if (state === 'crasher-flee' && fleeFrom && fleeTo) {
      fleeT += dt;
      const s = fleeStep(fleeFrom, fleeTo, fleeT, 1.4);
      pos.set(s.x, s.y, s.z);
      const dx = fleeTo.x - fleeFrom.x, dz = fleeTo.z - fleeFrom.z;
      if (Math.hypot(dx, dz) > 0.01) ch.face(Math.atan2(dx, dz));
      if (s.done) { events.emit('crasherEscaped'); despawn(); return; }
      return;
    }
    ch.animator.update(dt);
  }

  const api = {
    spawn,
    despawn,
    get actor() { return ch; },
    crasherFlee,
    update(dt) {
      if (!ch) return;
      if (mode === 'ally') updateAlly(dt);
      else if (mode === 'crasher') updateCrasher(dt);
      else if (mode === 'pose') {
        // 'pose' (a story moment, the reveal): stays exactly where he was put, unmasked, idling and
        // turning to keep facing Batman. No following, no fighting.
        faceTowards(hero.pos.x - pos.x, hero.pos.z - pos.z, 6, dt);
        ch.animator.play(IDLE, { fade: 0.25 });
        ch.animator.update(dt);
      }
    },
  };
  return api;
}
