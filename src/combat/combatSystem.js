// Freeflow combat: turns hero input into moves against enemies and resolves enemy attacks on the hero.
import * as THREE from 'three';
import { resolveHit, damageToHero, DIFFICULTY, inShockwave, shouldDiveBomb } from './rules.js';
import { selectTarget } from './targeting.js';
import { createCombo } from './combo.js';
import { createDirector } from './director.js';
import { createInputBuffer } from './inputBuffer.js';
import { MOCAP_SPEED, MOCAP_START, MOCAP_BEATS } from '../config/mocap.js';
import { rootMotionAt } from './reach.js';
import { CHAIN_RULES, chainForAction, chainAvailability, selectChainTargets, chainCost, tiedGroup, chainOutcome } from './chains.js';
import { buildChainTimeline } from './chainTimeline.js';
import { createChainControl, CHAIN_SHOTS } from './chainControl.js';

const PUNCHES = ['Punch_Jab', 'Punch_Cross', 'Punch_Jab'];
// Regular kicks alternate the front push kick and the roundhouse (the front kick alone at
// point-blank range, where the roundhouse's step would only slide); the chain finisher is
// the lunge spin kick. All are mocap clips from public/assets/anims_mocap.glb.
const KICKS = ['Kick_Front', 'Kick_Round'];
const KICK_SPEED = MOCAP_SPEED;
// Closer than this, a kick that steps in has nowhere to step.
const POINT_BLANK = 1.3;
// Hit-stop per kind of blow (seconds of frozen time for both fighters).
const STOP = { punch: 0.05, kick: 0.065, heavy: 0.11, finisher: 0.13, counter: 0.1 };
const WORDS = {
  counter: ['KRAK!', 'WHAM!'], kick: ['THWACK!', 'WHUMP!'], ko: ['POW!', 'BLAM!', 'KAPOW!'], special: ['THWAMP!'],
  dive: ['KRUNCH!'], heavy: ['KA-BOOM!', 'WHAMMO!'], spin: ['SWOOSH-THWACK!', 'KRAKOOM!'], slam: ['BADOOM!'], throw: ['WHEEE-CRASH!', 'YOINK!'],
};
// Strikes in a row on the same chain before the finisher lands.
const CHAIN = 4;
// Clip beats the chain timelines don't carry themselves: the mocap kicks (Kick_Front, Kick_Flying).
const BEATS = MOCAP_BEATS;

export function createCombat({ hero, follow, time, events, rng, getDifficulty, reach = {}, getChainDiscount = () => 0 }) {
  const combo = createCombo({ timeout: 1.5, ready: 8 });
  let difficulty = getDifficulty();
  const director = createDirector({ ...DIFFICULTY[difficulty], rng });
  let enemies = [];
  const inputBuffer = createInputBuffer(0.3);
  let punchChain = 0, kickChain = 0, chainT = 0;
  // Which regular kick and which beatdown strike comes next (variety only; not chain state).
  let kickIdx = 0, beatIdx = 0;
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), chest = new THREE.Vector3();
  const push = new THREE.Vector3();
  // What the chain icons show; refreshed every 0.1 s of game time or when the combo changes.
  let chainAvail = chainAvailability({ combo: 0, origin: hero.pos, enemies: [] });
  let availT = 0, availCombo = -1;
  // The chain in progress: its control, its targets, and whether it finished on its own.
  let chainRun = null;
  const pick = (a) => a[Math.floor(rng.next() * a.length)];

  const word = (kind) => pick(WORDS[kind] ?? WORDS.ko);
  const alive = () => enemies.filter((e) => e.alive);
  const engaged = () => enemies.filter((e) => e.alive && e.aware);

  // Stick direction relative to the camera; without input, melee uses the hero's facing and
  // ranged throws use where the camera looks.
  function inputDir(ctx, ranged = false) {
    const f = follow.forward(tmp), r = follow.right(new THREE.Vector3());
    const m = ctx.input.move;
    dir.set(f.x * m.y + r.x * m.x, 0, f.z * m.y + r.z * m.x);
    if (dir.lengthSq() < 0.04) {
      if (ranged) dir.set(f.x, 0, f.z);
      else dir.set(Math.sin(hero.bat.yaw), 0, Math.cos(hero.bat.yaw)).multiplyScalar(0.5);
    }
    return dir;
  }

  // Line of sight from Batman's chest to the target's: no hitting through walls and containers.
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  function canSee(e) {
    eye.set(hero.pos.x, hero.pos.y + 1.2, hero.pos.z);
    aim.set(e.pos.x - eye.x, e.pos.y + 1.1 - eye.y, e.pos.z - eye.z);
    const d = aim.length();
    if (d < 0.8) return true;
    const hit = hero.collision.raycast(eye, aim.divideScalar(d), d);
    return !hit || hit.t > d - 0.45;
  }
  // Lunges slide along walls instead of passing through them.
  function moveHero(to, prevY) {
    hero.pos.copy(to);
    hero.collision.resolveCylinder(hero.pos, 0.35, 1.8, { prevY });
  }

  function faceTo(target) {
    hero.bat.face(Math.atan2(target.pos.x - hero.pos.x, target.pos.z - hero.pos.z));
  }

  // A critical hit: slow motion, a big word, and an action camera shot from the side. `shot`
  // frames the camera (see follow.actionShot); `variant` picks the speed lines.
  function critical(target, { slow = 0.55, scale = 0.28, shot, variant } = {}) {
    time.slowMo(slow, scale);
    target.ch.headWorld(chest, -0.4);
    follow.actionShot?.(chest.clone(), hero.pos.clone(), slow + 0.35, shot);
    events.emit('critical', { target, variant });
  }

  function landHit(move, target, { word: w, power = 1, stopTime = 0.06, launch = 0, crit = false } = {}) {
    if (target.state === 'tied') return breakTied(target);
    const result = resolveHit(move, target);
    const wasAttacking = target.applyHit(result, hero.pos, { power, launch });
    if (wasAttacking) director.release(target.id);
    target.ch.headWorld(chest, -0.3);
    events.emit('impact', { pos: chest.clone(), move, outcome: result.outcome, target, crit });
    if (result.outcome === 'parried' || result.outcome === 'immune') {
      time.hitStop(0.04);
      follow.addShake(0.05);
      events.emit('blocked', { move, target, outcome: result.outcome });
      return result;
    }
    combo.hit();
    const big = result.outcome === 'ko' || result.outcome === 'knockdown';
    // Freeze both fighters on the contact frame, longer for a knockdown or a critical.
    time.hitStop(Math.max(stopTime, big ? 0.12 : 0, crit ? 0.14 : 0));
    follow.addShake(result.outcome === 'hit' ? 0.07 : 0.16);
    follow.hitKick?.(big || crit ? 5 : 2.5);
    if (w || result.outcome === 'ko') events.emit('word', { text: w ?? word('ko'), pos: chest.clone(), big: crit });
    const lastOne = result.outcome === 'ko' && engaged().length === 0;
    if (result.outcome === 'ko') events.emit('ko', { target });
    if (lastOne) { events.emit('lastHit', { target }); critical(target, { slow: 0.9, scale: 0.22 }); }
    else if (crit && result.outcome !== 'hit') critical(target);
    else if (crit) critical(target, { slow: 0.35, scale: 0.4 });
    return result;
  }

  // One goon's part in a chain (or a tied bundle) ends: knocked out, or only knocked down for a
  // brute. Same bookkeeping as landHit: director slot, combo, impact and ko events.
  function finishTarget(e, { power = 1, launch = 0 } = {}) {
    if (!e.alive) return null;
    const outcome = chainOutcome(e);
    if (outcome === 'ko') e.health = 0;
    e.tiedWith = null;
    e.applyHit({ outcome, damage: 0, stun: 0 }, hero.pos, { power, launch });
    director.release(e.id);
    combo.hit();
    e.ch.headWorld(chest, -0.3);
    events.emit('impact', { pos: chest.clone(), move: 'chain', outcome, target: e, crit: false });
    if (outcome === 'ko') events.emit('ko', { target: e });
    return outcome;
  }

  // Any hit on a tied goon knocks the whole bundle out (brutes only go down).
  function breakTied(target) {
    const group = tiedGroup(target);
    let kos = 0;
    for (const e of group) if (finishTarget(e, { power: 1.4, launch: 2.5 }) === 'ko') kos += 1;
    time.hitStop(0.12);
    follow.addShake(0.18);
    target.ch.headWorld(chest, 0.2);
    events.emit('word', { text: 'KAPOW!', pos: chest.clone(), big: true });
    events.emit('tiedBreak', { count: group.length });
    critical(target, { slow: 0.6, scale: 0.3, variant: 'rope', shot: CHAIN_SHOTS.kapow });
    if (kos && engaged().length === 0) events.emit('lastHit', { target });
    return { outcome: kos ? 'ko' : 'knockdown', damage: 0, stun: 0 };
  }

  // ---- moves (hero.control objects) ----

  // How to land `clip` on `target`: the reach table says where the striking limb is on the
  // clip's contact frame (relative to the root, in the root's facing) and how much root
  // motion the clip carries by then. From that: the yaw that lines the limb up with the
  // target, the lunge that puts the limb 0.15 m (scaled) inside the target's body without
  // the bodies overlapping, and how much of the clip's own root motion fits before it would
  // carry the body through the target. `place(t)` moves the hero along that plan.
  function approach(target, clip, speed, start = 0, { fallbackReach = 0.9, fallbackContact = 0.15, maxLunge = 12 } = {}) {
    const entry = reach[clip];
    const from = hero.pos.clone();
    const dx = target.pos.x - from.x, dz = target.pos.z - from.z;
    const d = Math.hypot(dx, dz);
    const baseYaw = Math.atan2(dx, dz);
    const inside = 0.15 * target.scale;
    const radius = target.radius ?? 0.42 * target.scale;
    let limbX = 0, limbZ = fallbackReach, contactClip = start + fallbackContact * speed;
    const rmStart = [0, 0], rmContact = [0, 0], rmNow = [0, 0];
    let rmx = 0, rmz = 0;
    if (entry) {
      contactClip = entry.contact;
      limbX = entry.reach.x;
      limbZ = entry.reach.z;
      rootMotionAt(entry, start, rmStart);
      rootMotionAt(entry, entry.contact, rmContact);
      rmx = rmContact[0] - rmStart[0];
      rmz = rmContact[1] - rmStart[1];
    }
    const impactAt = Math.max(0.03, (contactClip - start) / speed);
    // Scale the clip's step down when the target is closer than the step plus the limb.
    let k = 1;
    let lungeDist = d - inside - limbZ - rmz;
    if (lungeDist < 0 && rmz > 0.05) { k = THREE.MathUtils.clamp((d - inside - limbZ) / rmz, 0, 1); lungeDist = d - inside - limbZ - k * rmz; }
    // Bodies never overlap: the root stays a step outside the target's radius, so a short
    // reach (a knee, a jab) stops short instead of standing inside the goon.
    const standOff = d - (radius + 0.25);
    lungeDist = THREE.MathUtils.clamp(Math.min(lungeDist, standOff), -0.35, maxLunge);
    if (rmz > 0.05 && lungeDist + k * rmz > standOff) k = THREE.MathUtils.clamp((standOff - lungeDist) / rmz, 0, 1);
    const yaw = baseYaw - Math.atan2(limbX + k * rmx, limbZ + k * rmz);
    const lungeT = Math.min(THREE.MathUtils.clamp(Math.abs(lungeDist) / 20, 0.05, 0.24), Math.max(0.03, impactAt - 0.03));
    const sx = Math.sin(baseYaw), sz = Math.cos(baseYaw), fx = Math.sin(yaw), fz = Math.cos(yaw);
    // The target keeps staggering while the blow is on its way: follow that drift so the
    // limb still lands where the target is on the contact frame. The drift is frozen on
    // contact, so the hero never rides the target's own knockback afterwards.
    const tx0 = target.pos.x, tz0 = target.pos.z;
    let driftX = 0, driftZ = 0, frozen = false;
    // The plan is applied as per-frame deltas on top of the resolved position, so a wall
    // push-out is kept rather than recomputed through the wall, and a step that would leave
    // the roof is refused (same guard as the dodge roll).
    const planned = from.clone(), prev = new THREE.Vector3();
    return {
      yaw, impactAt, lungeDist, k, from,
      place(t) {
        const e = Math.min(1, t / lungeT);
        const l = lungeDist * (1 - (1 - e) * (1 - e));
        if (!frozen) {
          const track = Math.min(1, t / impactAt);
          driftX = (target.pos.x - tx0) * track;
          driftZ = (target.pos.z - tz0) * track;
          if (t >= impactAt) frozen = true;
        }
        let mx = driftX, mz = driftZ;
        if (entry && k > 0) {
          rootMotionAt(entry, start + t * speed, rmNow);
          const rx = (rmNow[0] - rmStart[0]) * k, rz = (rmNow[1] - rmStart[1]) * k;
          // Clip-space x is the character's left.
          mx += fz * rx + fx * rz;
          mz += -fx * rx + fz * rz;
        }
        const px = from.x + sx * l + mx, pz = from.z + sz * l + mz;
        prev.copy(hero.pos);
        hero.pos.x += px - planned.x;
        hero.pos.z += pz - planned.z;
        hero.pos.y = from.y;
        planned.set(px, from.y, pz);
        const r = hero.collision.resolveCylinder(hero.pos, 0.35, 1.8, { prevY: from.y });
        if (r && r.groundY < from.y - 0.5) hero.pos.copy(prev);
      },
    };
  }
  const clipLength = (clip) => reach[clip]?.duration ?? 1;

  function strike(kind, target) {
    const isKick = kind === 'kick';
    const ground = target.down && target.alive && !target.air;
    const beatdown = target.type === 'brute' && target.stunned;
    const juggle = !!target.air;
    // Chains: the fourth punch is a heavy haymaker, the third kick the lunge spin kick.
    chainT = 1.1;
    let finisher = null;
    if (!ground && !beatdown && !juggle) {
      if (isKick) { kickChain += 1; punchChain = 0; if (kickChain >= 3) { finisher = 'spinKick'; kickChain = 0; } }
      else { punchChain += 1; kickChain = 0; if (punchChain >= CHAIN) { finisher = 'heavy'; punchChain = 0; } }
    }
    const move = ground ? 'punch' : beatdown ? 'beatdown' : finisher ?? kind;
    const range = Math.hypot(target.pos.x - hero.pos.x, target.pos.z - hero.pos.z);
    let clip, speed;
    if (ground) { clip = 'Sword_Attack'; speed = 1.8; }
    else if (move === 'heavy') { clip = 'Melee_Hook'; speed = 1.35; }
    else if (move === 'spinKick') { clip = 'Kick_Spin'; speed = KICK_SPEED.Kick_Spin; }
    else if (isKick) { clip = range < POINT_BLANK ? 'Kick_Front' : KICKS[kickIdx++ % KICKS.length]; speed = KICK_SPEED[clip]; }
    else if (beatdown) { clip = beatIdx++ % 2 ? 'Knee_Strike' : PUNCHES[(beatIdx >> 1) % PUNCHES.length]; speed = clip === 'Knee_Strike' ? KICK_SPEED.Knee_Strike : 2.6; }
    else { clip = PUNCHES[(punchChain - 1 + PUNCHES.length) % PUNCHES.length]; speed = 1.8; }
    const start = MOCAP_START[clip] ?? 0;
    const spin = move === 'spinKick';
    const ap = approach(target, clip, speed, start, { fallbackReach: 1.0 * target.scale, fallbackContact: 0.11 });
    const impactAt = ap.impactAt;
    const end = beatdown ? impactAt + 0.12
      : Math.min((clipLength(clip) - start) / speed, impactAt + (spin ? 0.45 : move === 'heavy' ? 0.32 : isKick ? 0.35 : 0.22));
    let t = 0, hit = false, refaced = false;
    hero.bat.face(ap.yaw);
    hero.bat.animator.play(clip, { once: true, timeScale: speed, fade: start ? 0.1 : 0.05, startAt: start });
    events.emit('swing', { kind, finisher: move === 'heavy' || spin });
    return {
      name: 'strike', combat: true,
      canChain: () => hit && t > impactAt + 0.04,
      // A buffered block may cut in before contact to counter an incoming attack.
      interruptible: () => !hit && t < impactAt - 0.02,
      update(dt) {
        t += dt;
        ap.place(t);
        // Once the hit-stop has passed, square up to where the target actually is (a step
        // with lateral root motion leaves the body off the line), so the next target pick
        // starts fair. Not on the contact frame itself: that would swing the limb off target.
        if (hit && !refaced && t > impactAt + 0.06) { refaced = true; if (target.alive) faceTo(target); }
        if (!hit && t >= impactAt) {
          hit = true;
          if (!target.alive) return false;
          if (move === 'heavy') landHit('heavy', target, { word: word('heavy'), power: 1.8, launch: 3, crit: true, stopTime: STOP.heavy });
          else if (spin) landHit('spinKick', target, { word: word('spin'), power: 2.2, launch: 6.5, crit: true, stopTime: STOP.finisher });
          else if (juggle) landHit(isKick ? 'kick' : 'punch', target, { word: rng.chance(0.4) ? 'JUGGLE!' : null, power: 1.2, stopTime: isKick ? STOP.kick : STOP.punch });
          else landHit(move, target, { word: isKick && rng.chance(0.4) ? word('kick') : null, power: isKick ? 1.6 : 1, launch: isKick ? 2 : 0, stopTime: isKick ? STOP.kick : STOP.punch });
        }
        return t >= end;
      },
    };
  }

  function whiff() {
    let t = 0;
    hero.bat.animator.play('Punch_Jab', { once: true, timeScale: 1.8, fade: 0.05 });
    combo.miss();
    punchChain = kickChain = 0;
    events.emit('whiff');
    return { name: 'whiff', combat: true, canChain: () => t > 0.2, update(dt) { t += dt; return t > 0.3; } };
  }

  function counter(targets) {
    let i = 0, t = 0, hit = false;
    const bigCounter = combo.value >= 5 || targets.length > 1;
    let ap = null, hitAt = 0.12, stepEnd = 0.3;
    const setup = () => {
      const target = targets[i];
      // Alternate a fast front kick and a hook, each lunging so it connects on its contact frame.
      const clip = i % 2 ? 'Kick_Front' : 'Melee_Hook';
      const speed = i % 2 ? 2.2 : 1.9;
      // The mocap front kick starts past its wind-up; the code-authored fallback has none.
      const start = i % 2 && reach.Kick_Front?.root ? 0.3 : 0;
      ap = approach(target, clip, speed, start, { fallbackReach: 1.1 * target.scale, fallbackContact: 0.12 });
      hitAt = ap.impactAt;
      stepEnd = Math.max(0.3, hitAt + 0.14);
      hero.bat.face(ap.yaw);
      hero.bat.animator.play(clip, { once: true, timeScale: speed, fade: 0.04, startAt: start });
      t = 0; hit = false;
    };
    // Countered attackers freeze mid-windup until the counter lands, and Batman can't be hit
    // while he works through them.
    for (const target of targets) { target.glyph = null; target.countered = true; target.counterT = 0; director.release(target.id); }
    hero.invulnerable = Math.max(hero.invulnerable, 0.32 * targets.length + 0.15);
    time.slowMo(0.18, 0.35);
    events.emit('counter', { count: targets.length });
    setup();
    return {
      name: 'counter', combat: true,
      canChain: () => i === targets.length - 1 && hit && t > 0.2,
      update(dt) {
        t += dt;
        ap.place(t);
        if (!hit && t >= hitAt) {
          hit = true;
          const target = targets[i];
          const last = i === targets.length - 1;
          if (target.alive) landHit('counter', target, { word: word('counter'), power: 1.3, stopTime: STOP.counter, launch: 2.5, crit: bigCounter && last });
        }
        if (t >= stepEnd) {
          i += 1;
          if (i >= targets.length) return true;
          setup();
        }
        return false;
      },
    };
  }

  function capeStun() {
    let t = 0, done = false;
    hero.bat.animator.play('Sword_Regular_B', { once: true, timeScale: 1.7, fade: 0.05 });
    events.emit('cape');
    return {
      name: 'cape', combat: true,
      canChain: () => t > 0.3,
      update(dt) {
        t += dt;
        if (!done && t > 0.12) {
          done = true;
          const fx = Math.sin(hero.bat.yaw), fz = Math.cos(hero.bat.yaw);
          let n = 0;
          for (const e of alive()) {
            const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z;
            const d = Math.hypot(dx, dz);
            if (d > 3.8 || (dx * fx + dz * fz) / (d || 1) < 0.2) continue;
            landHit('cape', e);
            if (e.state === 'windup' || e.state === 'attack') director.release(e.id);
            n++;
          }
          if (!n) events.emit('whiff');
        }
        return t > 0.42;
      },
    };
  }

  function batarang(target, fx) {
    let t = 0, thrown = false;
    faceTo(target);
    hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
    return {
      name: 'batarang', combat: true,
      canChain: () => t > 0.25,
      update(dt) {
        t += dt;
        if (!thrown && t > 0.14) {
          thrown = true;
          hero.bat.bone('hand_r').getWorldPosition(chest);
          events.emit('batarangThrow');
          fx.batarang(chest.clone(), () => target.ch.headWorld(new THREE.Vector3(), -0.25), () => {
            if (!target.alive) return;
            const r = landHit('batarang', target);
            if (target.state === 'windup' || target.state === 'attack') director.release(target.id);
            events.emit('batarangHit', { target, result: r });
          });
        }
        return t > 0.35;
      },
    };
  }

  function dodge(ctx) {
    const d = inputDir(ctx).clone().normalize();
    const from = hero.pos.clone();
    const to = from.clone().addScaledVector(d, 4.5);
    let t = 0;
    const over = alive().some((e) => {
      const ex = e.pos.x - from.x, ez = e.pos.z - from.z;
      const along = ex * d.x + ez * d.z;
      return along > 0 && along < 3 && Math.abs(ex * d.z - ez * d.x) < 0.9;
    });
    hero.bat.face(Math.atan2(d.x, d.z));
    hero.bat.animator.play(over ? 'NinjaJump_Start' : 'Roll', { once: true, timeScale: over ? 1.4 : 1.5, fade: 0.05 });
    hero.invulnerable = 0.45;
    events.emit('dodge');
    return {
      name: 'dodge', combat: true,
      canChain: () => t > 0.35,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / 0.42);
        const px = from.x + (to.x - from.x) * (1 - (1 - k) * (1 - k));
        const pz = from.z + (to.z - from.z) * (1 - (1 - k) * (1 - k));
        const before = hero.pos.clone();
        hero.pos.set(px, from.y + (over ? Math.sin(k * Math.PI) * 1.6 : 0), pz);
        const r = hero.collision.resolveCylinder(hero.pos, 0.35, 1.8);
        if (!over && r.groundY < from.y - 0.5) { hero.pos.copy(before); return true; }
        if (k >= 1) { hero.pos.y = Math.max(r.groundY, from.y); return true; }
        return false;
      },
    };
  }

  function special(target) {
    let t = 0, hit = false;
    if (!target.finishable) combo.spend();
    hero.invulnerable = 1;
    const start = MOCAP_START.Kick_Round ?? 0, speed = 1.3;
    const ap = approach(target, 'Kick_Round', speed, start, { fallbackReach: 1.1, fallbackContact: 0.3 });
    const contact = ap.impactAt;
    hero.bat.face(ap.yaw);
    hero.bat.animator.play('Kick_Round', { once: true, timeScale: speed, fade: 0.05, startAt: start });
    events.emit('special', { target });
    for (const e of alive()) { if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; } }
    // Slow the run-up; the critical (stinger, action shot) fires once, on the contact frame.
    time.slowMo(0.8, 0.28);
    return {
      name: 'special', combat: true,
      canChain: () => hit && t > contact + 0.3,
      update(dt) {
        t += dt;
        ap.place(t);
        if (!hit && t >= contact) {
          hit = true;
          if (target.alive) landHit('special', target, { word: word('special'), power: 2.2, stopTime: 0.15, launch: 5, crit: true });
        }
        return t > Math.max(0.75, contact + 0.45);
      },
    };
  }

  function airKick(target, kind) {
    const from = hero.pos.clone();
    const d = from.distanceTo(target.pos);
    // Stop where the flying kick's foot (from the reach table) ends inside the target.
    const fly = reach.Kick_Flying;
    const stop = fly ? 0.15 * target.scale + fly.reach.z + 0.25 : 1.0;
    const to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - stop) / (d || 1)));
    to.y = target.pos.y;
    const dur = kind === 'diveBomb' ? Math.max(0.25, d / 30) : Math.max(0.28, d / 22);
    let t = 0, hit = false;
    const baseYaw = Math.atan2(target.pos.x - from.x, target.pos.z - from.z);
    hero.bat.face(fly ? baseYaw - Math.atan2(fly.reach.x, fly.reach.z) : baseYaw);
    hero.cape.setWings(false);
    hero.bat.tilt.rotation.set(0, 0, 0);
    // Play the flying kick so its extension frame arrives exactly when the flight ends.
    const start = MOCAP_START.Kick_Flying ?? 0;
    const contact = fly?.contact ?? 0.3;
    hero.bat.animator.play('Kick_Flying', { once: true, timeScale: THREE.MathUtils.clamp((contact - start) / dur, 0.7, 2.5), fade: 0.05, startAt: start });
    events.emit(kind === 'diveBomb' ? 'diveBomb' : 'jumpKick');
    return {
      name: kind, combat: true,
      canChain: () => hit && t > dur + 0.15,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / dur);
        hero.pos.lerpVectors(from, to, k);
        if (!hit && k >= 1) {
          hit = true;
          if (target.alive) landHit(kind, target, { word: kind === 'diveBomb' ? word('dive') : word('kick'), power: 1.8, stopTime: 0.1, launch: 4.5, crit: kind === 'diveBomb' });
          if (kind === 'diveBomb') for (const e of alive()) if (e !== target && e.pos.distanceTo(hero.pos) < 3) landHit('diveBomb', e, { power: 1.3, launch: 3 });
          hero.vel.set(0, 0, 0);
          hero.grounded = true;
          hero.state = 'ground';
        }
        return t > dur + 0.3;
      },
    };
  }

  // Punch in the air: drop like a hammer and knock down everyone around the landing point.
  function airSlam() {
    const from = hero.pos.clone();
    const ground = hero.collision.groundBelow(from.x, from.y, from.z, 0.3);
    const floorY = ground > -Infinity ? ground : from.y;
    const fall = Math.max(0, from.y - floorY);
    const dur = THREE.MathUtils.clamp(fall / 26, 0.12, 0.5);
    let t = 0, hit = false;
    hero.cape.setWings(false);
    hero.bat.tilt.rotation.set(0, 0, 0);
    hero.bat.animator.play('NinjaJump_Land', { once: true, timeScale: 0.9, fade: 0.05 });
    events.emit('slamStart');
    return {
      name: 'slam', combat: true,
      canChain: () => hit && t > dur + 0.25,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / dur);
        hero.pos.set(from.x, from.y + (floorY - from.y) * k * k, from.z);
        if (!hit && k >= 1) {
          hit = true;
          hero.vel.set(0, 0, 0);
          hero.grounded = true;
          hero.state = 'ground';
          follow.addShake(0.3);
          events.emit('slam', { pos: hero.pos.clone() });
          let n = 0;
          for (const e of alive()) {
            if (e.pos.distanceTo(hero.pos) > 3.6 || Math.abs(e.pos.y - hero.pos.y) > 1.5) continue;
            landHit('slam', e, { power: 1.6, launch: 4, word: n === 0 ? word('slam') : null, crit: n === 1 });
            n++;
          }
          if (!n) time.hitStop(0.06);
        }
        return t > dur + 0.4;
      },
    };
  }

  // Grab the nearest goon, spin, and hurl them in the stick direction. They bowl over anyone they hit.
  function grabThrow(target, ctx) {
    const result = resolveHit('throw', target);
    if (result.outcome === 'immune') {
      target.applyHit(result, hero.pos);
      events.emit('blocked', { move: 'throw', target, outcome: 'immune' });
      return null;
    }
    // Undo the damage for now; it lands when they hit the ground.
    target.health += result.damage;
    director.release(target.id);
    target.glyph = null;
    target.state = 'grabbed';
    faceTo(target);
    const yaw0 = hero.bat.yaw;
    const aim = inputDir(ctx, true).clone().setY(0).normalize();
    let t = 0, thrown = false;
    hero.bat.animator.play('Sword_Heavy_Combo', { once: true, timeScale: 1.6, fade: 0.05 });
    events.emit('grab', { target });
    return {
      name: 'throw', combat: true,
      canChain: () => thrown && t > 0.7,
      update(dt) {
        t += dt;
        if (!thrown) {
          // Swing them around once.
          const s = Math.min(1, t / 0.38);
          const a = yaw0 + s * Math.PI * 2 * 0.9;
          hero.bat.face(a);
          target.pos.set(hero.pos.x + Math.sin(a) * 1.1, hero.pos.y + 0.35 + Math.sin(s * Math.PI) * 0.5, hero.pos.z + Math.cos(a) * 1.1);
          target.ch.face(a + Math.PI);
          if (s >= 1) {
            thrown = true;
            hero.bat.face(Math.atan2(aim.x, aim.z));
            target.state = 'down';
            target.down = true;
            target.downT = 2.4;
            target.launch(aim.x * 12, 5.5, aim.z * 12, { thrown: true });
            target.thrownHits = new Set();
            target.pendingThrow = true;
            combo.hit();
            time.hitStop(0.08);
            follow.addShake(0.12);
            events.emit('throwRelease', { target });
            target.ch.headWorld(chest, -0.3);
            events.emit('word', { text: word('throw'), pos: chest.clone(), big: true });
          }
        }
        return thrown && t > 0.85;
      },
    };
  }

  // Thrown goons hurt whoever they fly into, and themselves on landing.
  function onThrownFly(e) {
    for (const o of alive()) {
      // Horizontal reach, with some vertical slack: a body in flight is above the other's feet.
      if (o === e || e.thrownHits?.has(o.id) || Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > 1.4 || Math.abs(o.pos.y - e.pos.y) > 2.2) continue;
      e.thrownHits.add(o.id);
      landHit('thrownInto', o, { power: 1.5, launch: 3.5, crit: e.thrownHits.size === 2 });
    }
  }
  function onLanded(e, drop) {
    if (e.pendingThrow) {
      e.pendingThrow = false;
      if (e.alive) landHit('throw', e, { power: 0.5 });
    }
    if (drop > 4 && e.alive) {
      // Knocked off a roof: out of the fight.
      e.health = 0;
      e.applyHit({ outcome: 'ko' }, e.pos);
      events.emit('ko', { target: e });
      events.emit('word', { text: 'WHUMP!', pos: e.pos.clone().setY(e.pos.y + 1) });
      if (engaged().length === 0) events.emit('lastHit', { target: e });
    }
  }

  function stagger(anim, dur, name = 'stagger') {
    let t = 0;
    hero.bat.animator.play(anim, { once: true, timeScale: 1.3, fade: 0.05 });
    return { name, combat: true, canChain: () => false, update(dt) { t += dt; return t > dur; } };
  }

  // The one way Batman goes down, whatever did it.
  function killHero() {
    if (hero.dead) return;
    hero.dead = true;
    hero.health = 0;
    hero.control = stagger('Death01', 99);
    events.emit('heroDown');
  }

  // ---- enemy attacks landing on the hero ----
  function onAttackLand(e, kind) {
    if (hero.dead) return;
    if (hero.invulnerable > 0) { events.emit('evaded', { e }); return; }
    const blocking = hero.blocking && kind !== 'charge';
    const dmg = damageToHero(kind, { difficulty, blocking });
    hero.health = Math.max(0, hero.health - dmg);
    combo.damaged();
    punchChain = kickChain = 0;
    follow.addShake(blocking ? 0.08 : 0.2);
    if (hero.control?.knockOff) { hero.control.knockOff(); hero.control = null; }
    events.emit('heroHurt', { kind, blocking, damage: dmg, from: e });
    if (hero.health <= 0) { killHero(); return; }
    if (blocking) { hero.control = stagger('Idle_Shield_Break', 0.28, 'blockStagger'); return; }
    if (kind === 'charge') {
      hero.invulnerable = 1.6;
      const s = stagger('Hit_Knockback', 1.1);
      const origUpdate = s.update;
      let t = 0;
      s.update = (dt) => { t += dt; if (t > 0.9 && t - dt <= 0.9) hero.bat.animator.play('LayToIdle', { once: true, timeScale: 1.6 }); return origUpdate(dt) && t > 1.6; };
      hero.control = s;
    } else if (!hero.control || hero.control.combat) {
      hero.control = stagger(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head', 0.38);
    }
  }
  function onAttackEnd(e) { director.release(e.id); }

  function tryStart(action, ctx) {
    const chain = chainForAction(action);
    if (chain) return startChain(chain, ctx);
    const inAir = hero.state === 'air' || hero.state === 'glide';
    const all = alive().filter((e) => e.state !== 'grabbed');
    const list = action === 'block' ? all : all.filter(canSee);
    if (action === 'block') {
      const windups = list.filter((e) => e.state === 'windup' && e.def.counterable && e.pos.distanceTo(hero.pos) < 7.5)
        .sort((a, b) => a.pos.distanceTo(hero.pos) - b.pos.distanceTo(hero.pos)).slice(0, 2);
      if (windups.length && !inAir) { hero.control = counter(windups); return true; }
      const brute = list.find((e) => e.state === 'windup' && !e.def.counterable && e.pos.distanceTo(hero.pos) < 7.5);
      if (brute) events.emit('hint', { id: 'brute-counter' });
      return false;
    }
    if (action === 'punch' || action === 'kick') {
      if (inAir) {
        const target = selectTarget(hero.pos, inputDir(ctx), list, { range: hero.state === 'glide' ? 14 : 10, maxAngle: 1.3 });
        if (target && target.pos.y <= hero.pos.y + 1 && (hero.state === 'glide' || action === 'kick')) {
          hero.control = airKick(target, hero.state === 'glide' ? 'diveBomb' : 'jumpKick');
          return true;
        }
        // Punch in the air with nobody to kick: hammer down.
        if (action === 'punch' && hero.state === 'air' && engaged().length) { hero.control = airSlam(); return true; }
        return false;
      }
      const target = selectTarget(hero.pos, inputDir(ctx), list, { range: action === 'kick' ? 10 : 9, allowDown: true });
      if (!target) { if (engaged().length) { hero.control = whiff(); return true; } return false; }
      if (target.down && target.alive && !target.air && action === 'punch') events.emit('groundTakedown', { target });
      hero.control = strike(action, target);
      return true;
    }
    if (action === 'throw' && !inAir) {
      const target = selectTarget(hero.pos, inputDir(ctx), list.filter((e) => !e.down), { range: 3.2, maxAngle: 1.6 });
      if (!target) return false;
      const ctl = grabThrow(target, ctx);
      if (ctl) { hero.control = ctl; return true; }
      return false;
    }
    if (action === 'cape' && !inAir) { hero.control = capeStun(); return true; }
    if (action === 'batarang') {
      const target = selectTarget(hero.pos, inputDir(ctx, true), list, { range: 26, maxAngle: 1.2 });
      if (target) { hero.control = batarang(target, ctx.fx); return true; }
      return false;
    }
    if (action === 'dodge' && !inAir) { hero.control = dodge(ctx); return true; }
    if (action === 'special') {
      const finisher = list.find((e) => e.finishable && e.pos.distanceTo(hero.pos) < 9);
      if (finisher) { hero.control = special(finisher); return true; }
      if (!combo.ready) { events.emit('hint', { id: 'special-locked' }); return false; }
      const target = selectTarget(hero.pos, inputDir(ctx), list.filter((e) => !e.def.boss), { range: 9 });
      if (target) { hero.control = special(target); return true; }
    }
    return false;
  }

  const ACTIONS = ['block', 'punch', 'kick', 'throw', 'cape', 'batarang', 'dodge', 'special', 'chain1', 'chain2', 'chain3'];
  const inAirNow = () => hero.state === 'air' || hero.state === 'glide';

  // A dive-bomb impact: knocks down every downable goon in range. Armored enemies (brutes)
  // shrug it off via the same immunity resolveHit already gives them (unless stunned), and
  // the boss is excluded outright so neither can be one-shot by it.
  function shockwave(center, radius = 4, { crit = true, word } = {}) {
    let n = 0;
    let first = null;
    for (const e of enemies) {
      if (!e.alive || e.down || e.def.boss || !inShockwave(center, e.pos, radius)) continue;
      const result = resolveHit('diveBomb', e);
      const wasAttacking = e.applyHit(result, center, { power: 1.6, launch: 6 });
      if (wasAttacking) director.release(e.id);
      if (result.outcome === 'immune' || result.outcome === 'parried') continue;
      if (!first) first = e;
      n += 1;
    }
    events.emit('diveImpact', { pos: center.clone(), count: n, word });
    if (first && crit) critical(first);
    return n;
  }

  // An instant KO from a ledge or drop takedown: no fight, just an action shot. Same
  // wasAttacking/director.release bookkeeping as landHit, so a takedown on a goon that was
  // mid-windup or mid-attack still frees its director slot for the others.
  function takedown(e, kind) {
    if (!e?.alive) return false;
    e.health = 0;
    const wasAttacking = e.applyHit({ outcome: 'ko' }, hero.pos);
    if (wasAttacking) director.release(e.id);
    critical(e, { slow: 0.7 });
    events.emit('takedown', { kind, pos: e.pos.clone() });
    return true;
  }

  // ---- chain takedowns ----

  // The hooks a chain lands its steps through (chainControl.js), so chains share this file's hit
  // bookkeeping: director slots, combo, impact events, hit-stop, critical and shockwave.
  // `run` is optional: Plan 5FG's Bat Swarm calls this with no run of its own yet, so the run
  // bookkeeping below just no-ops for it rather than throwing.
  function chainApi(ctx, run = null) {
    return {
      events, time, collision: hero.collision, fx: ctx.chainFx ?? null,
      enemies: () => enemies,
      hold(e) { e.chainHold(); director.release(e.id); },
      // Only a chain that plays to its end releases its targets itself.
      release(e) { if (run) run.over = true; e.chainRelease(); },
      stagger(e) {
        push.set(e.pos.x - hero.pos.x, 0, e.pos.z - hero.pos.z);
        if (push.lengthSq() > 1e-6) e.pos.addScaledVector(push.normalize(), 0.25);
        hero.collision.resolveCylinder(e.pos, e.radius, 1.8 * e.scale);
        e.ch.animator.play(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head', { once: true, timeScale: 1.4, fade: 0.05 });
        combo.hit();
        follow.addShake(0.08);
        e.ch.headWorld(chest, -0.3);
        events.emit('impact', { pos: chest.clone(), move: 'chain', outcome: 'hit', target: e, crit: false });
      },
      finish: finishTarget,
      tie(list) {
        // No combo.hit() here: the stagger hits already paid for landing the chain, and a tie
        // that refunded its own cost too made Rope-a-Dope net free (ruling: chains always cost
        // something).
        for (const e of list) { e.tie(list, CHAIN_RULES.tiedTime); director.release(e.id); }
        events.emit('chainTied', { count: list.length });
      },
      critical,
      shockwave,
      // chainControl passes a vector it reuses: the event gets its own copy.
      word(text, pos, big = false) { events.emit('word', { text, pos: pos.clone(), big }); },
    };
  }

  // Returns true when the press is used up: a chain started, or a hint said why not.
  function startChain(chain, ctx) {
    if (hero.state !== 'ground' || !hero.grounded) return false;
    const discount = getChainDiscount();
    const k = chain.n - 1;
    const avail = chainAvailability({ combo: combo.value, origin: hero.pos, enemies, discount });
    if (!avail.affordable[k]) {
      const why = !avail.show ? 'chain-locked' : !avail.stealth && combo.value < avail.costs[k] ? 'chain-cost' : 'chain-targets';
      // The costs behind the hint, so a future discount doesn't leave the copy hardcoded (5FG).
      events.emit('hint', { id: why, arg: avail.costs });
      return true;
    }
    const targets = selectChainTargets(hero.pos, inputDir(ctx), enemies, { canSee, onlyUnaware: avail.stealth });
    if (!targets) { events.emit('hint', { id: 'chain-targets' }); return true; }
    if (!avail.stealth) combo.take(chainCost(chain, discount));
    const timeline = buildChainTimeline(chain.id, targets.length, BEATS);
    // Everyone else waits: wind-ups in progress are called off and nobody starts one mid-chain.
    // A boss never shares `enemies` with goons today, but skip it on principle: its state is its
    // own fight's, never the chain's to rewrite.
    for (const e of alive()) {
      if (targets.includes(e) || e.def?.boss) continue;
      if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; }
      director.hold(e.id, timeline.duration + 0.6);
    }
    // `prior`: Batman's invulnerability before the chain raised it; `t`: game time since the start.
    const run = { ctl: null, chain: chain.id, targets, over: false, prior: hero.invulnerable, t: 0 };
    run.ctl = createChainControl(hero, chainApi(ctx, run), { chain, targets, stealth: avail.stealth, timeline });
    hero.control = run.ctl;
    chainRun = run;
    events.emit('chainStart', { chain: chain.id, count: targets.length, stealth: avail.stealth, ids: targets.map((e) => e.id) });
    return true;
  }

  // Something took hero.control away from a chain before it finished (a teleport after a fall
  // into the water, a respawn, the finale): let go of every goon still held, rather than leave
  // them frozen until enemy.js's 5 s failsafe.
  function checkChainDropped() {
    if (!chainRun || hero.control === chainRun.ctl) return;
    const run = chainRun;
    chainRun = null;
    if (run.over) return;
    for (const e of run.targets) e.chainRelease();
    // Give back only what the chain added (what he had before, less the time since, or the usual
    // 0.3 s grace). A control that took over owns its own invulnerability: leave it alone.
    if (!hero.control) hero.invulnerable = Math.min(hero.invulnerable, Math.max(run.prior - run.t, 0.3));
    events.emit('chainBroken', { chain: run.chain });
  }

  return {
    combo,
    director,
    shockwave,
    takedown,
    // Clears a buffered press early when a traversal control (ledge takedown, glide dive-bomb)
    // already acted on it itself, so it can't also fire a real strike/kick once that control
    // hands hero.control back.
    consumeInput(action) { inputBuffer.consume(action); },
    get enemies() { return enemies; },
    setEnemies(list) {
      enemies = list;
      director.clear();
      for (const e of list) director.hold(e.id, 1 + rng.next() * 1.6);
    },
    setDifficulty(d) { difficulty = d; director.configure(DIFFICULTY[d]); },
    killHero,
    get active() { return engaged().length > 0; },
    get cameraMode() { return hero.control?.camera ?? (engaged().some((e) => e.pos.distanceTo(hero.pos) < 14) ? 'combat' : null); },
    get chains() { return chainAvail; },
    update(dt, ctx) {
      checkChainDropped();
      if (chainRun) chainRun.t += dt;
      combo.tick(dt);
      availT -= dt;
      if (availT <= 0 || combo.value !== availCombo) {
        availT = 0.1;
        availCombo = combo.value;
        chainAvail = chainAvailability({ combo: combo.value, origin: hero.pos, enemies, discount: getChainDiscount() });
      }
      chainT -= dt;
      if (chainT <= 0) { punchChain = 0; kickChain = 0; }
      const d = getDifficulty();
      if (d !== difficulty) { difficulty = d; director.configure(DIFFICULTY[d]); }
      // Buffer the latest press so freeflow chains feel responsive, e.g. a block/counter tap
      // or an attack press during a grapple, ladder, zip or wall run fires the moment that
      // control lets go. A press a traversal control acts on itself (the ledge takedown's own
      // punch, the glide dive-bomb's kick) is cleared via consumeInput() right where that
      // control consumes it, so it can't also fire a real move later.
      for (const a of ACTIONS) if (ctx.input.pressed(a)) inputBuffer.press(a);
      inputBuffer.tick(dt);
      const buffer = inputBuffer.value;
      const ctl = hero.control;
      // A block tapped during a strike's wind-up counters an incoming attack instead of
      // waiting for the strike to finish: the strike is dropped before its contact frame.
      const counterCut = buffer === 'block' && ctl?.name === 'strike' && ctl.interruptible?.() && !inAirNow()
        && alive().some((e) => e.state === 'windup' && e.def.counterable && e.pos.distanceTo(hero.pos) < 7.5);
      const free = !hero.dead && (!ctl || (ctl.combat && ctl.canChain()) || counterCut);
      // A buffered kick belongs to hero.js's own dive trigger (not the old target-seeking
      // jump-kick/diveBomb here) only when the dive will actually fire this frame, or while
      // one is already in progress. Below the height threshold the old air kick still runs.
      const glideKick = buffer === 'kick' && (shouldDiveBomb(hero.state, hero.heightAboveGround()) || ctl?.name === 'dive');
      if (buffer && free && hero.state !== 'roll' && ctl?.name !== 'grapple' && !glideKick) {
        if (tryStart(buffer, ctx)) inputBuffer.consume(buffer);
      }
      // Hold block to guard when nothing else is going on.
      hero.blocking = (!hero.control || hero.control.name === 'blockStagger') && hero.grounded && ctx.input.down('block') && engaged().length > 0;

      // Enemy AI and the attack director.
      const ectx = { hero, others: enemies, onAttackLand, onAttackEnd, onThrownFly, onLanded };
      const ready = [];
      for (const e of enemies) {
        e.update(dt, ectx);
        if (e.aware) ready.push({ id: e.id, ready: e.ready(hero) && !hero.dead && !['ladder', 'ledge', 'zip', 'wallrun'].includes(hero.control?.name) });
      }
      for (const id of director.tick(dt, ready)) {
        const e = enemies.find((x) => x.id === id);
        if (e) e.startWindup(DIFFICULTY[difficulty].windup, hero);
      }
      for (const e of enemies) if (!e.alive || (e.state !== 'windup' && e.state !== 'attack')) { if (director.active.has(e.id) && e.state !== 'attack') director.release(e.id); }
    },
  };
}
