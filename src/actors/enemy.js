// Joker goon AI: idle, alert, circle the hero, wind up (glyph), attack, react to hits.
import * as THREE from 'three';
import { createGoon } from './characters.js';
import { ENEMY } from '../combat/rules.js';

const IDLE_POSES = ['Idle_Talking_Loop', 'Idle_TalkingPhone_Loop', 'Idle_FoldArms_Loop', 'Idle_Loop'];
const GRUNT_ATTACKS = ['Punch_Cross', 'Punch_Jab', 'Melee_Hook'];

export function createEnemy({ id, type, assets, scene, collision, rng }) {
  const ch = createGoon(assets, { type, rng });
  scene.add(ch.root);
  const def = ENEMY[type];
  const scale = def.scale;
  const pos = ch.root.position;
  const tmp = new THREE.Vector3();
  const e = {
    id, type, def, ch, pos, scale,
    health: def.health, alive: true, down: false, stunned: false,
    state: 'idle', t: 0, stunT: 0, downT: 0, aware: false,
    ringAngle: rng.range(0, Math.PI * 2), ringDist: rng.range(3.6, 5.8), strafe: rng.chance(0.5) ? 1 : -1, strafeT: rng.range(1, 3),
    attackKind: null, windupDur: 0.6, hitDone: false,
    lungeFrom: new THREE.Vector3(), lungeTo: new THREE.Vector3(), chargeDir: new THREE.Vector3(),
    knock: new THREE.Vector3(),
    vel: new THREE.Vector3(), air: false, airFrom: 0, thrown: false,
    idlePose: rng.pick(IDLE_POSES),
    glyph: null,
    radius: 0.42 * scale,
    get x() { return pos.x; },
    get z() { return pos.z; },
  };

  const faceHero = (hero, rate, dt) => {
    const dx = hero.pos.x - pos.x, dz = hero.pos.z - pos.z;
    const target = Math.atan2(dx, dz);
    const delta = Math.atan2(Math.sin(target - ch.yaw), Math.cos(target - ch.yaw));
    ch.face(ch.yaw + (rate ? delta * Math.min(1, rate * dt) : delta));
  };
  const play = (name, opts) => ch.animator.play(name, opts);
  function setState(s) { e.state = s; e.t = 0; }

  e.place = (p, yaw = 0) => { pos.set(p.x, p.y, p.z); ch.face(yaw); };

  e.wake = () => {
    if (e.aware || !e.alive) return;
    e.aware = true;
    setState('alert');
    play(rng.chance(0.5) ? 'Idle_No_Loop' : 'Yes', { once: true, timeScale: 1.3, fade: 0.15 });
  };

  e.ready = (hero) => e.state === 'engage' && e.alive && !e.down && tmp.set(hero.pos.x - pos.x, 0, hero.pos.z - pos.z).length() < 6.5;

  e.startWindup = (windup, hero) => {
    setState('windup');
    e.hitDone = false;
    if (type === 'brute') {
      e.attackKind = rng.chance(0.45) ? 'charge' : 'brute';
      e.windupDur = windup + 0.35;
      e.glyph = 'red';
      play(e.attackKind === 'charge' ? 'Shield_Dash' : 'Sword_Heavy_Combo', { once: true, timeScale: 0.22, fade: 0.1 });
    } else if (type === 'knife') {
      e.attackKind = 'knife';
      e.windupDur = windup + 0.1;
      e.glyph = 'blue';
      play('Sword_Regular_A', { once: true, timeScale: 0.28, fade: 0.1 });
    } else {
      e.attackKind = type === 'joker' ? 'joker' : 'grunt';
      e.windupDur = windup;
      e.glyph = 'blue';
      play(rng.pick(GRUNT_ATTACKS), { once: true, timeScale: 0.25, fade: 0.1 });
    }
    faceHero(hero, 0, 0);
  };

  // Sends the goon flying (knockdown launches, throws, juggles).
  e.launch = (vx, vy, vz, { thrown = false } = {}) => {
    if (!e.air) e.airFrom = pos.y;
    e.air = true;
    e.thrown = thrown;
    e.vel.set(vx, vy, vz);
    e.knock.set(0, 0, 0);
  };

  // Called by the combat system with the result of resolveHit.
  // launch: vertical launch speed for knockdowns/KOs (0 = slide along the ground).
  e.applyHit = (result, from, { power = 1, launch = 0 } = {}) => {
    if (!e.alive) return;
    const wasWindup = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    tmp.set(pos.x - from.x, 0, pos.z - from.z).normalize();
    switch (result.outcome) {
      case 'hit':
        setState('hit');
        e.knock.copy(tmp).multiplyScalar(2.2 * power);
        if (e.air) { e.vel.y = Math.max(e.vel.y, 4.5); e.vel.x = tmp.x * 2; e.vel.z = tmp.z * 2; }
        else if (launch) e.launch(tmp.x * 2.5 * power, launch, tmp.z * 2.5 * power);
        play(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head', { once: true, timeScale: 1.4, fade: 0.05 });
        if (result.stun) { e.stunned = true; e.stunT = result.stun; }
        break;
      case 'knockdown':
        setState('down');
        e.down = true;
        e.downT = 2.6;
        e.knock.copy(tmp).multiplyScalar(4.5 * power);
        if (launch || e.air) e.launch(tmp.x * 4.5 * power, Math.max(launch, e.air ? 5 : 0), tmp.z * 4.5 * power);
        play('Hit_Knockback', { once: true, timeScale: 1.2, fade: 0.05 });
        break;
      case 'ko':
        setState('ko');
        e.alive = false;
        e.down = true;
        e.knock.copy(tmp).multiplyScalar(3.5 * power);
        if (launch || e.air) e.launch(tmp.x * 4 * power, Math.max(launch, e.air ? 4 : 0), tmp.z * 4 * power);
        play(rng.chance(0.5) ? 'Death01' : 'Hit_Knockback', { once: true, timeScale: 1.1, fade: 0.05 });
        break;
      case 'stun':
        setState('stunned');
        e.stunned = true;
        e.stunT = result.stun * (type === 'brute' ? 1.8 : 1);
        play('Idle_Shield_Break', { once: true, timeScale: 0.8, fade: 0.1 });
        break;
      case 'parried':
        setState('hit');
        e.knock.set(0, 0, 0);
        play('Sword_Block', { once: true, timeScale: 1.8, fade: 0.05 });
        break;
      case 'immune':
        e.knock.copy(tmp).multiplyScalar(0.4);
        play('Yes', { once: true, timeScale: 2, fade: 0.1 });
        if (!wasWindup) setState('recover');
        return wasWindup;
      default:
        break;
    }
    return wasWindup;
  };

  e.update = (dt, ctx) => {
    const { hero, others } = ctx;
    e.t += dt;
    if (e.stunT > 0) { e.stunT -= dt; if (e.stunT <= 0) e.stunned = false; }
    const dx = hero.pos.x - pos.x, dz = hero.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    let speed = 0;
    let moveX = 0, moveZ = 0;

    if (e.state === 'grabbed') { ch.animator.update(dt); return; }
    switch (e.state) {
      case 'idle':
        play(e.idlePose, { fade: 0.3 });
        break;
      case 'alert':
        faceHero(hero, 6, dt);
        if (e.t > 0.8) setState('engage');
        break;
      case 'engage':
      case 'recover': {
        if (e.state === 'recover' && e.t > 0.55) setState('engage');
        e.strafeT -= dt;
        if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rng.range(1.2, 3); }
        e.ringAngle += e.strafe * dt * 0.35;
        const tx = hero.pos.x + Math.sin(e.ringAngle) * e.ringDist, tz = hero.pos.z + Math.cos(e.ringAngle) * e.ringDist;
        const gx = tx - pos.x, gz = tz - pos.z;
        const gd = Math.hypot(gx, gz);
        if (gd > 0.4) {
          speed = gd > 4 ? def.speed : 1.4;
          moveX = gx / gd; moveZ = gz / gd;
        }
        if (dist < 8) faceHero(hero, 8, dt);
        else if (speed) ch.face(Math.atan2(moveX, moveZ));
        if (speed > 2) play('Jog_Fwd_Loop', { fade: 0.2 });
        else if (speed > 0) play(type === 'brute' ? 'Zombie_Walk_Fwd_Loop' : 'Walk_Loop', { fade: 0.2 });
        else play(type === 'knife' ? 'Sword_Idle' : type === 'brute' ? 'Idle_FoldArms_Loop' : 'Idle_Loop', { fade: 0.25 });
        break;
      }
      case 'windup': {
        faceHero(hero, 10, dt);
        const want = type === 'brute' ? 3 : 2.3;
        if (dist > want + 0.3) { speed = 2.2; moveX = dx / dist; moveZ = dz / dist; }
        if (e.t >= e.windupDur) {
          setState('attack');
          e.lungeFrom.copy(pos);
          const reach = e.attackKind === 'charge' ? 0 : Math.max(0, dist - 1.1);
          e.lungeTo.set(pos.x + (dx / (dist || 1)) * reach, pos.y, pos.z + (dz / (dist || 1)) * reach);
          e.chargeDir.set(dx / (dist || 1), 0, dz / (dist || 1));
          ch.animator.mixer.timeScale = 1;
          const a = ch.animator.play(ch.animator.currentName, { once: true, timeScale: 1.7 });
          a.time = Math.min(a.time, a.getClip().duration * 0.2);
          e.glyph = null;
        }
        break;
      }
      case 'attack': {
        if (e.attackKind === 'charge') {
          speed = 12;
          moveX = e.chargeDir.x; moveZ = e.chargeDir.z;
          if (!e.hitDone && dist < 1.5 * scale) { e.hitDone = true; ctx.onAttackLand(e, 'charge'); }
          if (e.t > 0.75) { setState('recover'); ctx.onAttackEnd(e); }
        } else {
          const k = Math.min(1, e.t / 0.16);
          pos.x = e.lungeFrom.x + (e.lungeTo.x - e.lungeFrom.x) * k;
          pos.z = e.lungeFrom.z + (e.lungeTo.z - e.lungeFrom.z) * k;
          if (!e.hitDone && e.t >= 0.17) {
            e.hitDone = true;
            if (dist < 2 * scale) ctx.onAttackLand(e, e.attackKind);
          }
          if (e.t > 0.5) { setState('recover'); ctx.onAttackEnd(e); }
        }
        break;
      }
      case 'hit':
        if (e.t > 0.5) setState(e.stunned ? 'stunned' : 'engage');
        break;
      case 'stunned':
        if (!e.stunned) setState('engage');
        break;
      case 'down':
        e.downT -= dt;
        if (e.downT <= 0) { setState('getup'); play('LayToIdle', { once: true, timeScale: 1.4, fade: 0.1 }); }
        break;
      case 'getup':
        if (e.t > 1.0) { e.down = false; setState('engage'); }
        break;
      case 'ko':
        break;
      default:
        break;
    }

    if (e.air) {
      // Ballistic flight: gravity, walls, landing. Thrown goons bowl over whoever they hit.
      e.vel.y -= 24 * dt;
      pos.addScaledVector(e.vel, dt);
      const r = collision.resolveCylinder(pos, e.radius, 1.8 * scale, { stepUp: 0.45 });
      if (r.grounded && e.vel.y > 0) pos.y = Math.max(pos.y, r.groundY);
      if (r.hitWall) { e.vel.x *= -0.25; e.vel.z *= -0.25; }
      if (e.thrown) ctx.onThrownFly?.(e);
      const ground = collision.groundBelow(pos.x, pos.y + 0.4, pos.z, 0.3);
      if (e.vel.y <= 0 && ground > -Infinity && pos.y <= ground) {
        pos.y = ground;
        const drop = e.airFrom - ground;
        e.air = false;
        e.thrown = false;
        e.vel.set(0, 0, 0);
        ctx.onLanded?.(e, drop);
        if (e.alive && e.state !== 'ko') { e.down = true; e.downT = Math.max(e.downT, 1.6); setState('down'); }
      } else if (ground === -Infinity && pos.y < -5) {
        pos.y = -5; e.air = false; e.alive = false; e.state = 'ko';
      }
      ch.animator.update(dt);
      return;
    }

    // Knockback slide.
    if (e.knock.lengthSq() > 0.0001) {
      pos.addScaledVector(e.knock, dt);
      e.knock.multiplyScalar(Math.max(0, 1 - dt * 5));
    }
    if (speed) { pos.x += moveX * speed * dt; pos.z += moveZ * speed * dt; }
    // Keep apart from other goons and from the hero.
    if (e.alive && !e.down) {
      for (const o of others) {
        if (o === e || !o.alive || o.down) continue;
        const ox = pos.x - o.pos.x, oz = pos.z - o.pos.z;
        const od = Math.hypot(ox, oz);
        const min = e.radius + o.radius + 0.5;
        if (od < min && od > 1e-4) { pos.x += (ox / od) * (min - od) * 0.5; pos.z += (oz / od) * (min - od) * 0.5; }
      }
      if (dist < 0.9 && e.state !== 'attack') { pos.x -= (dx / (dist || 1)) * (0.9 - dist); pos.z -= (dz / (dist || 1)) * (0.9 - dist); }
    }
    const r = collision.resolveCylinder(pos, e.radius, 1.8 * scale);
    // Walked or slid off an edge: fall instead of teleporting down.
    if (r.groundY < pos.y - 0.6) e.launch(e.knock.x * 0.5, 0, e.knock.z * 0.5);
    else if (r.groundY > -Infinity) pos.y = r.groundY;
    ch.animator.update(dt);
  };

  e.remove = () => { scene.remove(ch.root); };
  return e;
}
