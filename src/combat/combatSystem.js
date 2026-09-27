// Freeflow combat: turns hero input into moves against enemies and resolves enemy attacks on the hero.
import * as THREE from 'three';
import { resolveHit, damageToHero, DIFFICULTY } from './rules.js';
import { selectTarget } from './targeting.js';
import { createCombo } from './combo.js';
import { createDirector } from './director.js';

const PUNCHES = ['Punch_Jab', 'Punch_Cross', 'Melee_Hook'];
const KICKS = ['Kick_Front', 'Kick_Round'];
const WORDS = { counter: ['KRAK!', 'WHAM!'], kick: ['THWACK!', 'WHUMP!'], ko: ['POW!', 'BLAM!', 'KAPOW!'], special: ['THWAMP!'], dive: ['KRUNCH!'] };

export function createCombat({ hero, follow, time, events, rng, getDifficulty }) {
  const combo = createCombo({ timeout: 1.5, ready: 8 });
  let difficulty = getDifficulty();
  const director = createDirector({ ...DIFFICULTY[difficulty], rng });
  let enemies = [];
  let buffer = null;
  let bufferT = 0;
  let strikeIndex = 0, kickIndex = 0;
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

  function faceTo(target) {
    hero.bat.face(Math.atan2(target.pos.x - hero.pos.x, target.pos.z - hero.pos.z));
  }

  function landHit(move, target, { word: w, power = 1, stopTime = 0.06 } = {}) {
    const result = resolveHit(move, target);
    const wasAttacking = target.applyHit(result, hero.pos, { power });
    if (wasAttacking) director.release(target.id);
    target.ch.headWorld(chest, -0.3);
    events.emit('impact', { pos: chest.clone(), move, outcome: result.outcome, target });
    if (result.outcome === 'parried' || result.outcome === 'immune') {
      time.hitStop(0.04);
      follow.addShake(0.05);
      events.emit('blocked', { move, target, outcome: result.outcome });
      return result;
    }
    combo.hit();
    time.hitStop(result.outcome === 'ko' || result.outcome === 'knockdown' ? 0.12 : stopTime);
    follow.addShake(result.outcome === 'hit' ? 0.07 : 0.14);
    if (w || result.outcome === 'ko') events.emit('word', { text: w ?? word('ko'), pos: chest.clone() });
    if (result.outcome === 'ko') {
      events.emit('ko', { target });
      const left = engaged().length;
      if (left === 0) { time.slowMo(0.9, 0.25); events.emit('lastHit', { target }); }
    }
    return result;
  }

  // ---- moves (hero.control objects) ----

  function strike(kind, target) {
    const isKick = kind === 'kick';
    const ground = target.down && target.alive;
    const beatdown = target.type === 'brute' && target.stunned;
    const move = ground ? 'punch' : beatdown ? 'beatdown' : kind;
    const from = hero.pos.clone();
    const d = Math.hypot(target.pos.x - from.x, target.pos.z - from.z);
    const stop = 1.0 * target.scale + (isKick ? 0.3 : 0);
    const to = new THREE.Vector3().lerpVectors(from, target.pos, Math.max(0, (d - stop) / (d || 1)));
    to.y = from.y;
    const lunge = THREE.MathUtils.clamp(d / 22, 0.05, 0.24);
    const clip = ground ? 'Sword_Attack' : isKick ? KICKS[kickIndex++ % KICKS.length] : PUNCHES[strikeIndex++ % PUNCHES.length];
    const impactAt = lunge + (isKick ? 0.18 : beatdown ? 0.06 : 0.11);
    const end = impactAt + (isKick ? 0.3 : beatdown ? 0.12 : 0.22);
    let t = 0, hit = false;
    faceTo(target);
    hero.bat.animator.play(clip, { once: true, timeScale: beatdown ? 2.6 : isKick ? 1.35 : 1.8, fade: 0.05 });
    events.emit('swing', { kind });
    return {
      name: 'strike', combat: true,
      canChain: () => hit && t > impactAt + 0.04,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / lunge);
        hero.pos.lerpVectors(from, to, 1 - (1 - k) * (1 - k));
        if (!hit && t >= impactAt) {
          hit = true;
          if (target.alive) landHit(move, target, { word: isKick && rng.chance(0.5) ? word('kick') : null, power: isKick ? 1.3 : 1 });
        }
        return t >= end;
      },
    };
  }

  function whiff() {
    let t = 0;
    hero.bat.animator.play('Punch_Jab', { once: true, timeScale: 1.8, fade: 0.05 });
    combo.miss();
    events.emit('whiff');
    return { name: 'whiff', combat: true, canChain: () => t > 0.2, update(dt) { t += dt; return t > 0.3; } };
  }

  function counter(targets) {
    let i = 0, t = 0, hit = false;
    let from = hero.pos.clone(), to = from.clone();
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
    for (const target of targets) { target.glyph = null; director.release(target.id); }
    time.slowMo(0.18, 0.35);
    events.emit('counter', { count: targets.length });
    setup();
    return {
      name: 'counter', combat: true,
      canChain: () => i === targets.length - 1 && hit && t > 0.2,
      update(dt) {
        t += dt;
        const k = Math.min(1, t / 0.08);
        hero.pos.lerpVectors(from, to, k);
        if (!hit && t >= 0.12) {
          hit = true;
          const target = targets[i];
          if (target.alive) landHit('counter', target, { word: word('counter'), power: 1.2, stopTime: 0.12 });
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
    // Vault over an enemy in the way.
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
    time.slowMo(0.7, 0.3);
    hero.invulnerable = 1;
    hero.bat.animator.play('Kick_Round', { once: true, timeScale: 1.1, fade: 0.05 });
    events.emit('special', { target });
    for (const e of alive()) { if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; } }
    return {
      name: 'special', combat: true, camera: 'takedown',
      canChain: () => hit && t > 0.6,
      update(dt) {
        t += dt;
        hero.pos.lerpVectors(from, to, Math.min(1, t / 0.12));
        if (!hit && t > 0.3) {
          hit = true;
          if (target.alive) landHit('special', target, { word: word('special'), power: 2, stopTime: 0.15 });
        }
        return t > 0.75;
      },
    };
  }

  function airKick(target, kind) {
    const from = hero.pos.clone();
    const to = new THREE.Vector3().lerpVectors(from, target.pos, 1);
    const d = from.distanceTo(target.pos);
    const stop = Math.max(0, (d - 1.0) / (d || 1));
    to.lerpVectors(from, target.pos, stop);
    to.y = target.pos.y;
    const dur = kind === 'diveBomb' ? Math.max(0.25, d / 30) : Math.max(0.28, d / 22);
    let t = 0, hit = false;
    faceTo(target);
    hero.cape.setWings(false);
    hero.bat.tilt.rotation.set(0, 0, 0);
    hero.bat.animator.play(kind === 'diveBomb' ? 'Kick_Flying' : 'Kick_Flying', { once: true, timeScale: 1.1, fade: 0.05 });
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
          if (target.alive) landHit(kind, target, { word: kind === 'diveBomb' ? word('dive') : word('kick'), power: 1.5, stopTime: 0.1 });
          if (kind === 'diveBomb') for (const e of alive()) if (e !== target && e.pos.distanceTo(hero.pos) < 3) landHit('diveBomb', e, { power: 1.2 });
          hero.vel.set(0, 0, 0);
          hero.grounded = true;
          hero.state = 'ground';
        }
        return t > dur + 0.3;
      },
    };
  }

  function stagger(anim, dur) {
    let t = 0;
    hero.bat.animator.play(anim, { once: true, timeScale: 1.3, fade: 0.05 });
    return { name: 'stagger', combat: true, canChain: () => false, update(dt) { t += dt; return t > dur; } };
  }

  // ---- enemy attacks landing on the hero ----
  function onAttackLand(e, kind) {
    if (hero.dead) return;
    if (hero.invulnerable > 0) { events.emit('evaded', { e }); return; }
    const blocking = hero.blocking && kind !== 'charge';
    const dmg = damageToHero(kind, { difficulty, blocking });
    hero.health = Math.max(0, hero.health - dmg);
    combo.damaged();
    follow.addShake(blocking ? 0.08 : 0.2);
    events.emit('heroHurt', { kind, blocking, damage: dmg, from: e });
    if (hero.health <= 0) {
      hero.dead = true;
      hero.control = stagger('Death01', 99);
      events.emit('heroDown');
      return;
    }
    if (blocking) { hero.control = stagger('Idle_Shield_Break', 0.28); return; }
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
    const list = alive();
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
        return false;
      }
      const target = selectTarget(hero.pos, inputDir(ctx), list, { range: action === 'kick' ? 10 : 9, allowDown: true });
      if (!target) { if (engaged().length) { hero.control = whiff(); return true; } return false; }
      if (target.down && target.alive && action === 'punch') events.emit('groundTakedown', { target });
      hero.control = strike(action, target);
      return true;
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

  const ACTIONS = ['block', 'punch', 'kick', 'cape', 'batarang', 'dodge', 'special'];

  return {
    combo,
    director,
    get enemies() { return enemies; },
    setEnemies(list) {
      enemies = list;
      director.clear();
      for (const e of list) director.hold(e.id, 1 + rng.next() * 1.6);
    },
    setDifficulty(d) { difficulty = d; director.configure(DIFFICULTY[d]); },
    get active() { return engaged().length > 0; },
    get cameraMode() { return hero.control?.camera ?? (engaged().some((e) => e.pos.distanceTo(hero.pos) < 14) ? 'combat' : null); },
    update(dt, ctx) {
      combo.tick(dt);
      difficulty = getDifficulty();
      // Buffer the latest press so freeflow chains feel responsive.
      for (const a of ACTIONS) if (ctx.input.pressed(a)) { buffer = a; bufferT = 0.3; }
      bufferT -= dt;
      if (bufferT <= 0) buffer = null;
      const ctl = hero.control;
      const free = !hero.dead && (!ctl || (ctl.combat && ctl.canChain()));
      if (buffer && free && hero.state !== 'roll' && ctl?.name !== 'grapple') {
        if (tryStart(buffer, ctx)) buffer = null;
      }
      // Hold block to guard when nothing else is going on.
      hero.blocking = !hero.control && hero.grounded && ctx.input.down('block') && engaged().length > 0;

      // Enemy AI and the attack director.
      const ectx = { hero, others: enemies, onAttackLand, onAttackEnd };
      const ready = [];
      for (const e of enemies) {
        e.update(dt, ectx);
        if (e.aware) ready.push({ id: e.id, ready: e.ready(hero) && !hero.dead });
      }
      for (const id of director.tick(dt, ready)) {
        const e = enemies.find((x) => x.id === id);
        if (e) e.startWindup(DIFFICULTY[difficulty].windup, hero);
      }
      for (const e of enemies) if (!e.alive || e.state !== 'windup' && e.state !== 'attack') { if (director.active.has(e.id) && e.state !== 'attack') director.release(e.id); }
    },
  };
}
