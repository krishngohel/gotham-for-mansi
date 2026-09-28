// Freeflow combat: turns hero input into moves against enemies and resolves enemy attacks on the hero.
import * as THREE from 'three';
import { resolveHit, damageToHero, DIFFICULTY, inShockwave } from './rules.js';
import { selectTarget } from './targeting.js';
import { createCombo } from './combo.js';
import { createDirector } from './director.js';

const PUNCHES = ['Punch_Jab', 'Punch_Cross', 'Punch_Jab'];
const KICKS = ['Kick_Front', 'Kick_Round'];
const WORDS = {
  counter: ['KRAK!', 'WHAM!'], kick: ['THWACK!', 'WHUMP!'], ko: ['POW!', 'BLAM!', 'KAPOW!'], special: ['THWAMP!'],
  dive: ['KRUNCH!'], heavy: ['KA-BOOM!', 'WHAMMO!'], spin: ['SWOOSH-THWACK!', 'KRAKOOM!'], slam: ['BADOOM!'], throw: ['WHEEE-CRASH!', 'YOINK!'],
};
// Strikes in a row on the same chain before the finisher lands.
const CHAIN = 4;

export function createCombat({ hero, follow, time, events, rng, getDifficulty }) {
  const combo = createCombo({ timeout: 1.5, ready: 8 });
  let difficulty = getDifficulty();
  const director = createDirector({ ...DIFFICULTY[difficulty], rng });
  let enemies = [];
  let buffer = null;
  let bufferT = 0;
  let punchChain = 0, kickChain = 0, chainT = 0;
  const tmp = new THREE.Vector3(), dir = new THREE.Vector3(), chest = new THREE.Vector3();
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

  // A critical hit: slow motion, a big word, and an action camera shot from the side.
  function critical(target, { slow = 0.55, scale = 0.28 } = {}) {
    time.slowMo(slow, scale);
    target.ch.headWorld(chest, -0.4);
    follow.actionShot?.(chest.clone(), hero.pos.clone(), slow + 0.35);
    events.emit('critical', { target });
  }

  function landHit(move, target, { word: w, power = 1, stopTime = 0.06, launch = 0, crit = false } = {}) {
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
    time.hitStop(big ? 0.12 : stopTime);
    follow.addShake(result.outcome === 'hit' ? 0.07 : 0.16);
    if (w || result.outcome === 'ko') events.emit('word', { text: w ?? word('ko'), pos: chest.clone(), big: crit });
    const lastOne = result.outcome === 'ko' && engaged().length === 0;
    if (result.outcome === 'ko') events.emit('ko', { target });
    if (lastOne) { events.emit('lastHit', { target }); critical(target, { slow: 0.9, scale: 0.22 }); }
    else if (crit && result.outcome !== 'hit') critical(target);
    else if (crit) critical(target, { slow: 0.35, scale: 0.4 });
    return result;
  }

  // ---- moves (hero.control objects) ----

  function strike(kind, target) {
    const isKick = kind === 'kick';
    const ground = target.down && target.alive && !target.air;
    const beatdown = target.type === 'brute' && target.stunned;
    const juggle = !!target.air;
    // Chains: the fourth punch is a heavy haymaker, the third kick a spinning heel kick.
    chainT = 1.1;
    let finisher = null;
    if (!ground && !beatdown && !juggle) {
      if (isKick) { kickChain += 1; punchChain = 0; if (kickChain >= 3) { finisher = 'spinKick'; kickChain = 0; } }
      else { punchChain += 1; kickChain = 0; if (punchChain >= CHAIN) { finisher = 'heavy'; punchChain = 0; } }
    }
    const move = ground ? 'punch' : beatdown ? 'beatdown' : finisher ?? kind;
    const from = hero.pos.clone();
    const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
    const stop = 1.0 * target.scale + (isKick ? 0.35 : 0);
    const to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - stop) / (d || 1)));
    to.y = from.y;
    const lunge = THREE.MathUtils.clamp(d / 22, 0.05, 0.24);
    let clip, speed;
    if (ground) { clip = 'Sword_Attack'; speed = 1.8; }
    else if (move === 'heavy') { clip = 'Melee_Hook'; speed = 1.35; }
    else if (move === 'spinKick') { clip = 'Kick_Round'; speed = 1.05; }
    else if (isKick) { clip = KICKS[(kickChain + 1) % KICKS.length]; speed = 1.45; }
    else if (beatdown) { clip = PUNCHES[punchChain % PUNCHES.length]; speed = 2.6; }
    else { clip = PUNCHES[(punchChain - 1 + PUNCHES.length) % PUNCHES.length]; speed = 1.8; }
    const spin = move === 'spinKick';
    const impactAt = lunge + (spin ? 0.34 : move === 'heavy' ? 0.2 : isKick ? 0.18 : beatdown ? 0.06 : 0.11);
    const end = impactAt + (spin ? 0.35 : isKick ? 0.3 : move === 'heavy' ? 0.32 : beatdown ? 0.12 : 0.22);
    let t = 0, hit = false;
    const baseYaw = Math.atan2(target.pos.x - from.x, target.pos.z - from.z);
    faceTo(target);
    hero.bat.animator.play(clip, { once: true, timeScale: speed, fade: 0.05 });
    events.emit('swing', { kind, finisher: move === 'heavy' || spin });
    return {
      name: 'strike', combat: true,
      canChain: () => hit && t > impactAt + 0.04,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / lunge);
        moveHero(tmp.lerpVectors(from, to, 1 - (1 - k) * (1 - k)), from.y);
        // Spinning heel kick: a full turn and a little hop before the heel connects.
        if (spin && !hit) {
          const s = Math.min(1, t / impactAt);
          hero.bat.face(baseYaw + (1 - s) * Math.PI * 2 * (s > 0.05 ? 1 : 0));
          hero.pos.y = from.y + Math.sin(s * Math.PI) * 0.45;
        }
        if (!hit && t >= impactAt) {
          hit = true;
          hero.pos.y = from.y;
          if (!target.alive) return false;
          if (move === 'heavy') landHit('heavy', target, { word: word('heavy'), power: 1.8, launch: 3, crit: true });
          else if (spin) landHit('spinKick', target, { word: word('spin'), power: 2.2, launch: 6.5, crit: true });
          else if (juggle) landHit(isKick ? 'kick' : 'punch', target, { word: rng.chance(0.4) ? 'JUGGLE!' : null, power: 1.2 });
          else landHit(move, target, { word: isKick && rng.chance(0.4) ? word('kick') : null, power: isKick ? 1.6 : 1, launch: isKick ? 2 : 0, stopTime: isKick ? 0.09 : 0.06 });
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
    let from = hero.pos.clone(), to = from.clone();
    const bigCounter = combo.value >= 5 || targets.length > 1;
    const setup = () => {
      const target = targets[i];
      from = hero.pos.clone();
      const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
      to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - 1.1 * target.scale) / (d || 1)));
      to.y = from.y;
      faceTo(target);
      hero.bat.animator.play(i % 2 ? 'Kick_Round' : 'Melee_Hook', { once: true, timeScale: 1.9, fade: 0.04 });
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
        const k = Math.min(1, t / 0.08);
        moveHero(tmp.lerpVectors(from, to, k), from.y);
        if (!hit && t >= 0.12) {
          hit = true;
          const target = targets[i];
          const last = i === targets.length - 1;
          if (target.alive) landHit('counter', target, { word: word('counter'), power: 1.3, stopTime: 0.12, launch: 2.5, crit: bigCounter && last });
        }
        if (t >= 0.3) {
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
    const from = hero.pos.clone();
    const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
    const to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - 1.1) / (d || 1)));
    to.y = from.y;
    faceTo(target);
    if (!target.finishable) combo.spend();
    hero.invulnerable = 1;
    hero.bat.animator.play('Kick_Round', { once: true, timeScale: 1.1, fade: 0.05 });
    events.emit('special', { target });
    for (const e of alive()) { if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; } }
    critical(target, { slow: 0.8, scale: 0.28 });
    return {
      name: 'special', combat: true,
      canChain: () => hit && t > 0.6,
      update(dt) {
        t += dt;
        moveHero(tmp.lerpVectors(from, to, Math.min(1, t / 0.12)), from.y);
        if (!hit && t > 0.3) {
          hit = true;
          if (target.alive) landHit('special', target, { word: word('special'), power: 2.2, stopTime: 0.15, launch: 5 });
        }
        return t > 0.75;
      },
    };
  }

  function airKick(target, kind) {
    const from = hero.pos.clone();
    const d = from.distanceTo(target.pos);
    const to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - 1.0) / (d || 1)));
    to.y = target.pos.y;
    const dur = kind === 'diveBomb' ? Math.max(0.25, d / 30) : Math.max(0.28, d / 22);
    let t = 0, hit = false;
    faceTo(target);
    hero.cape.setWings(false);
    hero.bat.tilt.rotation.set(0, 0, 0);
    hero.bat.animator.play('Kick_Flying', { once: true, timeScale: 1.1, fade: 0.05 });
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

  const ACTIONS = ['block', 'punch', 'kick', 'throw', 'cape', 'batarang', 'dodge', 'special'];

  // A dive-bomb impact: knocks down every downable goon in range. Armored enemies (brutes)
  // shrug it off via the same immunity resolveHit already gives them (unless stunned), and
  // the boss is excluded outright so neither can be one-shot by it.
  function shockwave(center, radius = 4) {
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
    events.emit('diveImpact', { pos: center.clone(), count: n });
    if (first) critical(first);
    return n;
  }

  return {
    combo,
    director,
    shockwave,
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
    update(dt, ctx) {
      combo.tick(dt);
      chainT -= dt;
      if (chainT <= 0) { punchChain = 0; kickChain = 0; }
      const d = getDifficulty();
      if (d !== difficulty) { difficulty = d; director.configure(DIFFICULTY[d]); }
      // Buffer the latest press so freeflow chains feel responsive.
      for (const a of ACTIONS) if (ctx.input.pressed(a)) { buffer = a; bufferT = 0.3; }
      bufferT -= dt;
      if (bufferT <= 0) buffer = null;
      const ctl = hero.control;
      const free = !hero.dead && (!ctl || (ctl.combat && ctl.canChain()));
      // A buffered kick while gliding (or mid dive-bomb) belongs to hero.js's own dive
      // trigger, not the old target-seeking jump-kick/diveBomb here.
      const glideKick = buffer === 'kick' && (hero.state === 'glide' || ctl?.name === 'dive');
      if (buffer && free && hero.state !== 'roll' && ctl?.name !== 'grapple' && !glideKick) {
        if (tryStart(buffer, ctx)) buffer = null;
      }
      // Hold block to guard when nothing else is going on.
      hero.blocking = (!hero.control || hero.control.name === 'blockStagger') && hero.grounded && ctx.input.down('block') && engaged().length > 0;

      // Enemy AI and the attack director.
      const ectx = { hero, others: enemies, onAttackLand, onAttackEnd, onThrownFly, onLanded };
      const ready = [];
      for (const e of enemies) {
        e.update(dt, ectx);
        if (e.aware) ready.push({ id: e.id, ready: e.ready(hero) && !hero.dead && hero.control?.name !== 'ladder' && hero.control?.name !== 'ledge' });
      }
      for (const id of director.tick(dt, ready)) {
        const e = enemies.find((x) => x.id === id);
        if (e) e.startWindup(DIFFICULTY[difficulty].windup, hero);
      }
      for (const e of enemies) if (!e.alive || (e.state !== 'windup' && e.state !== 'attack')) { if (director.active.has(e.id) && e.state !== 'attack') director.release(e.id); }
    },
  };
}
