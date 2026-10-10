// Joker goon AI: idle, alert, circle the hero, wind up (glyph), attack, react to hits.
import * as THREE from 'three';
import { createGoon, footGround, enemyPlantsFeet } from './characters.js';
import { createHarleyCharacter } from './harleyChar.js';
import { ENEMY } from '../combat/rules.js';
import { yankVelocity } from '../gadgets/aim.js';
import { chooseHarleyMove, shouldCartwheel, harleyGlyph, harleyWindup, HARLEY_COOLDOWN, HARLEY_TAUNTS } from '../combat/harleyLogic.js';
import { MOCAP_DATA } from '../config/mocapData.js';

const IDLE_POSES = ['Idle_Talking_Loop', 'Idle_TalkingPhone_Loop', 'Idle_FoldArms_Loop', 'Idle_Loop'];
// Motion-captured goon attacks (scripts/mixamo-fetch.mjs). Each winds up to a cocked pose held
// just short of its contact frame, then fires so that frame lands on the hit (see strikeClip).
const GRUNT_ATTACKS = ['Goon_Hook', 'Goon_Haymaker', 'Punch_Cross'];
const BRUTE_ATTACKS = ['Goon_Overhead', 'Goon_Headbutt'];
// How long a melee blow takes from the end of the wind-up to landing (attack state, e.t).
const STRIKE_LAND = 0.17;
// Fight stances and taunts, while circling Batman.
const GUARDS = ['Goon_Fight_Idle', 'Goon_Bounce_Idle'];
const TAUNTS = ['Goon_Taunt_A', 'Goon_Taunt_B'];
// The get-up from the back: the clip lies still for its first 2.6 s.
const GETUP = { clip: 'Goon_GetUp', from: 2.55, speed: 2.6, length: 1.2 };
// Hit reactions by where the blow landed (src/actors/reactions.js).
const REACTIONS = { head: 'Hit_Head_Snap', gut: 'Hit_Gut_Fold', spin: 'Hit_Spin', sweep: 'Sweep_Fall' };
// Clips a chain takedown plays straight onto a held goon's mixer (chainControl.js: the daze while
// waiting for a turn, the head grab, the yank, and enemy.tie's knockback into the tied pose).
// Primed here, at spawn, so the first chain of a fight doesn't build an action mid-chain.
// createEnemy (and so this prime) runs once per spawn, for the whole wave in the same frame; only
// scene.add is spread one goon per frame (game.js's reveal step).
// Where each KO clip starts going over. Both open on their feet (Death01 sags for 0.8 s), and a
// critical KO plays in slow motion, so from frame 0 a knocked-out goon stood for over a second.
export const KO_FALL = {
  Death01: { startAt: 0.6, timeScale: 1.3 },
  Hit_Knockback: { startAt: 0.3, timeScale: 1.2 },
};
export const CHAIN_HOLD_CLIPS = ['Idle_Shield_Break', 'Hit_Head', 'Hit_Chest', 'Hit_Knockback'];
// States wake() lets finish on their own instead of jumping straight to 'alert' (see e.wake below).
const WAKE_HOLD_STATES = ['tied', 'down', 'getup', 'chained', 'grabbed'];

export function createEnemy({ id, type, assets, scene, collision, rng, events = null }) {
  const ch = type === 'harley' ? createHarleyCharacter(assets) : createGoon(assets, { type, rng });
  ch.animator.prime(CHAIN_HOLD_CLIPS);
  const groundUnderFoot = footGround(collision);
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
    guard: rng.pick(GUARDS), tauntT: 0, tauntCd: rng.range(3, 8), locoName: null, locoT: 0,
    glyph: null,
    tiedWith: null, tiedT: 0,
    frozenT: 0, danceT: 0, lostT: 0, shattered: false,
    // Harley Quinn only (type 'harley'): per-move cooldowns and her cartwheel dodge tic.
    harleyCd: { slam: 0, sweep: 0, throw: 0 }, cartwheelCd: rng.range(0.6, 1.6), harleySlammed: false,
    // Predator stealth (src/stealth/stealthSystem.js): where the goon walks or looks, which room it
    // belongs to, and whether it can see Batman right now (a rifle only fires when it can).
    nav: { x: 0, y: 0, z: 0, speed: 0, face: null, lookX: 0, lookZ: 0, arrived: false, px: 0, pz: 0, stuckT: 0 },
    room: null, seesHero: undefined,
    get yaw() { return ch.yaw; },
    get aiming() { return e.state === 'windup' && e.attackKind === 'rifle'; },
    radius: 0.42 * scale,
    get x() { return pos.x; },
    get z() { return pos.z; },
  };

  // Rifle goons fight from range and carry their rifle in every pose.
  const RIFLE = type === 'rifle';
  const WALK = RIFLE ? 'Rifle_Walk' : 'Walk_Loop', IDLE = RIFLE ? 'Rifle_Idle' : 'Idle_Loop', LOOK = RIFLE ? 'Rifle_Search' : 'Idle_No_Loop';
  if (RIFLE) { e.ringDist = rng.range(9, 14); e.idlePose = 'Rifle_Idle'; }

  const faceHero = (hero, rate, dt) => {
    const dx = hero.pos.x - pos.x, dz = hero.pos.z - pos.z;
    const target = Math.atan2(dx, dz);
    const delta = Math.atan2(Math.sin(target - ch.yaw), Math.cos(target - ch.yaw));
    ch.face(ch.yaw + (rate ? delta * Math.min(1, rate * dt) : delta));
  };
  const turnTo = (yaw, rate, dt) => {
    const d = Math.atan2(Math.sin(yaw - ch.yaw), Math.cos(yaw - ch.yaw));
    ch.face(ch.yaw + d * Math.min(1, rate * dt));
  };
  // States the stealth runtime may steer a goon out of.
  const NAV = new Set(['idle', 'alert', 'patrol', 'search', 'hunt', 'suspicious', 'look', 'engage', 'recover']);
  const WALKING = new Set(['patrol', 'search', 'hunt']);
  const MELEE_DY = 2.5; // metres up or down a punch, knife or charge can still reach
  const play = (name, opts) => ch.animator.play(name, opts);
  // Locomotion clips (guard, strafe, walk, jog) hold for at least LOCO_HOLD seconds once picked:
  // a goon whose speed flickers round zero (crowding round Batman, circling) used to swap clips
  // every few frames, and each swap back cut off a clip that was still fading out (a pop).
  const LOCO_HOLD = 0.35;
  const loco = (name, opts) => {
    const cur = ch.animator.currentName;
    if (cur !== name && cur === e.locoName && e.locoT > 0) return;
    if (cur !== name) { e.locoName = name; e.locoT = LOCO_HOLD; }
    play(name, opts);
  };
  const has = (name) => ch.animator.has?.(name) ?? false;
  // A strike clip winds up over `dur` seconds to its cocked pose (a beat before contact) and holds
  // there; strikeFire() then lands the contact frame STRIKE_LAND seconds after the wind-up ends.
  // Clips without mocap data keep the old slow-motion wind-up.
  const strikeClip = (name, dur, fallback, fallbackScale) => {
    const d = MOCAP_DATA[name];
    if (!d || !has(name)) { play(fallback, { once: true, timeScale: fallbackScale, fade: 0.1 }); return; }
    const cocked = Math.max(0.05, d.contact - 0.14);
    // A long blend: the guard stance is a crouch and the clip starts upright, and the wind-up is
    // slow anyway (0.6 s or more).
    play(name, { once: true, timeScale: cocked / Math.max(0.2, dur), fade: 0.25 });
  };
  const strikeFire = () => {
    const a = ch.animator.currentAction, d = a && MOCAP_DATA[a.getClip().name];
    if (d) { a.timeScale = Math.min(3, Math.max(1, (d.contact - a.time) / STRIKE_LAND)); return; }
    // Old clips: restart at speed (the slow wind-up was the clip's opening).
    ch.animator.play(ch.animator.currentName, { once: true, timeScale: 1.7 });
  };
  const getUp = () => {
    if (has(GETUP.clip)) play(GETUP.clip, { once: true, timeScale: GETUP.speed, startAt: GETUP.from, fade: 0.15 });
    else play('LayToIdle', { once: true, timeScale: 1.4, fade: 0.1 });
  };
  function setState(s) { e.state = s; e.t = 0; }

  e.place = (p, yaw = 0) => { pos.set(p.x, p.y, p.z); ch.face(yaw); };

  e.wake = () => {
    if (e.aware || !e.alive) return;
    e.aware = true;
    if (type === 'harley') events?.emit('harleyTaunt', { text: HARLEY_TAUNTS[0] });
    // Held, tied or on the floor: aware from now on, but let that state finish on its own.
    // getup and tie expiry (below) and chainRelease already send an aware goon on to 'engage'.
    if (WAKE_HOLD_STATES.includes(e.state)) return;
    setState('alert');
    play(rng.chance(0.5) ? 'Idle_No_Loop' : 'Yes', { once: true, timeScale: 1.3, fade: 0.15 });
  };

  // Chain takedowns (src/combat/chainControl.js) hold a goon in place: no AI, no physics; the
  // chain moves and animates it. Returns whether it was mid-attack (the caller frees its
  // director slot).
  e.chainHold = () => {
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.knock.set(0, 0, 0);
    e.vel.set(0, 0, 0);
    setState('chained');
    return was;
  };
  e.chainRelease = () => { if (e.state === 'chained') setState(e.aware ? 'engage' : 'idle'); };

  // Rope-a-Dope: tied up with `partners` for `seconds`. Down and helpless; any hit on one of
  // them knocks the whole bundle out (combatSystem's landHit). Returns whether it was mid-attack.
  e.tie = (partners, seconds = 6) => {
    if (!e.alive) return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.stunned = false;
    e.down = true;
    e.tiedWith = partners.filter((p) => p !== e);
    e.tiedT = seconds;
    setState('tied');
    play('Hit_Knockback', { once: true, timeScale: 1.3, fade: 0.05 });
    return was;
  };

  // Freeze blast: stuck in ice for `sec`. No AI and no animation (the pose stays in the ice).
  // Any hit shatters it (applyHit). Returns whether it was mid-attack.
  e.freeze = (sec) => {
    if (!e.alive || e.def.boss || e.down || e.air || e.state === 'tied' || e.state === 'chained') return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.knock.set(0, 0, 0);
    e.frozenT = sec;
    e.shattered = false;
    setState('frozen');
    return was;
  };
  e.thaw = () => {
    if (e.state !== 'frozen') return;
    e.frozenT = 0;
    setState(e.aware ? 'engage' : 'idle');
  };

  // Party popper: stunned and dancing for `sec`. A hit ends the dance early.
  e.dance = (sec) => {
    if (!e.alive || e.down || e.air || e.def.boss) return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.stunned = true;
    e.stunT = Math.max(e.stunT, sec);
    e.danceT = sec;
    setState('dance');
    play('Dance_Loop', { fade: 0.15 });
    return was;
  };

  // Smoke: loses track of Batman for `sec`: no wind-ups, and the goon drifts off its ring.
  // Part D's stealth can define e.search(from) to send it looking instead.
  e.lose = (sec, from) => {
    if (e.lostT <= 0) e.ringDist += 3;
    e.lostT = Math.max(e.lostT, sec);
    e.ringAngle += Math.PI * (0.5 + rng.next());
    e.search?.(from);
  };

  // Batclaw: yanked on an arc to `to` (in front of Batman). It lands down, so the next punch is a
  // free knockout; yanked off a ledge, it falls and onLanded knocks it out.
  e.yank = (to) => {
    if (!e.alive || e.def.boss || e.state === 'frozen') return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    const v = yankVelocity(pos, to);
    e.launch(v.vx, v.vy, v.vz);
    e.down = true;
    e.downT = Math.max(e.downT, 1.8);
    setState('down');
    play('Hit_Knockback', { once: true, timeScale: 1.3, fade: 0.05 });
    return was;
  };

  // Stealth steering. The runtime calls these every frame; they only change state when the state
  // changes, so the state timer and animations don't restart.
  e.canNav = () => e.alive && !e.down && !e.air && !e.countered && NAV.has(e.state);
  e.goTo = (x, y, z, speed, state = 'patrol', face = null) => {
    if (Math.hypot(x - e.nav.x, z - e.nav.z) > 0.3) { e.nav.arrived = false; e.nav.stuckT = 0; }
    e.nav.x = x; e.nav.y = y; e.nav.z = z; e.nav.speed = speed; e.nav.face = face;
    if (e.state !== state) { setState(state); e.nav.arrived = false; }
  };
  e.lookAt = (x, z, state = 'suspicious') => {
    e.nav.lookX = x; e.nav.lookZ = z;
    if (e.state !== state) setState(state);
  };
  // Hostile and seen: the fight AI takes over.
  e.engageNow = () => {
    e.aware = true;
    if (e.state !== 'engage' && NAV.has(e.state)) setState('engage');
  };
  // The squad lost Batman: back under stealth control.
  e.calm = () => {
    e.aware = false;
    e.glyph = null;
    if (NAV.has(e.state) || e.state === 'windup' || e.state === 'attack') setState('look');
  };

  e.ready = (hero) => {
    if (e.state !== 'engage' || !e.alive || e.down || e.lostT > 0) return false;
    const d = tmp.set(hero.pos.x - pos.x, 0, hero.pos.z - pos.z).length();
    // Fists and knives only reach Batman on the goon's own level (not up on a gargoyle).
    if (type === 'harley') return d < 14 && Math.abs(hero.pos.y - pos.y) < MELEE_DY;
    return def.ranged ? e.seesHero !== false && d < 30 : d < 6.5 && Math.abs(hero.pos.y - pos.y) < MELEE_DY;
  };

  e.startWindup = (windup, hero) => {
    setState('windup');
    e.hitDone = false;
    if (type === 'brute') {
      e.attackKind = rng.chance(0.45) ? 'charge' : 'brute';
      e.windupDur = windup + 0.35;
      e.glyph = 'red';
      if (e.attackKind === 'charge') play('Shield_Dash', { once: true, timeScale: 0.22, fade: 0.1 });
      else strikeClip(rng.pick(BRUTE_ATTACKS), e.windupDur, 'Sword_Heavy_Combo', 0.22);
    } else if (type === 'knife') {
      e.attackKind = 'knife';
      e.windupDur = windup + 0.1;
      e.glyph = 'blue';
      strikeClip('Goon_Stab', e.windupDur, 'Sword_Regular_A', 0.28);
    } else if (def.ranged) {
      // A long, readable aim: the red laser holds on Batman, then one shot.
      e.attackKind = 'rifle';
      e.windupDur = windup + 0.55;
      e.glyph = 'red';
      play('Rifle_Aim', { fade: 0.1 });
    } else if (type === 'harley') {
      // Mallet slam and sweep at melee range, an occasional pie/confetti throw at a distance;
      // src/combat/harleyLogic.js picks which and gates it on her own per-move cooldowns.
      const dx0 = hero.pos.x - pos.x, dz0 = hero.pos.z - pos.z;
      const dist0 = Math.hypot(dx0, dz0);
      const move = chooseHarleyMove(dist0, e.harleyCd, rng.next()) ?? 'slam';
      e.harleyCd[move] = HARLEY_COOLDOWN[move];
      e.attackKind = move === 'slam' ? 'harleySlam' : move === 'sweep' ? 'harleySweep' : 'harleyThrow';
      e.windupDur = windup + harleyWindup(move);
      e.glyph = harleyGlyph(move);
      if (move === 'slam') {
        if (!e.harleySlammed) { e.harleySlammed = true; events?.emit('harleyTaunt', { text: HARLEY_TAUNTS[1] }); }
        play('Sword_Heavy_Combo', { once: true, timeScale: 0.22, fade: 0.1 });
      } else if (move === 'sweep') {
        play('Sword_Regular_A', { once: true, timeScale: 0.28, fade: 0.1 });
      } else {
        play('OverhandThrow', { once: true, timeScale: 0.45, fade: 0.1 });
      }
    } else {
      e.attackKind = type === 'joker' ? 'joker' : 'grunt';
      e.windupDur = windup;
      e.glyph = 'blue';
      strikeClip(rng.pick(GRUNT_ATTACKS), e.windupDur, 'Punch_Cross', 0.25);
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
  // react: which reaction a plain hit plays ('head', 'gut' or 'spin', from the strike that
  // landed); without one, the library's small flinches.
  e.applyHit = (result, from, { power = 1, launch = 0, react = null } = {}) => {
    if (!e.alive) return;
    // A hit on ice shatters it: out cold, whatever the move was.
    if (e.state === 'frozen') { e.shattered = true; e.frozenT = 0; e.health = 0; result = { outcome: 'ko', damage: 0, stun: 0 }; }
    e.countered = false;
    const wasWindup = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    tmp.set(pos.x - from.x, 0, pos.z - from.z).normalize();
    // Already lying on the floor: a blow keeps him there. Replaying a fall or a flinch would stand
    // him up for a frame first (every such clip starts on its feet).
    const lying = e.down && !e.air && (e.state === 'down' || e.state === 'ko');
    if (lying && (result.outcome === 'hit' || result.outcome === 'knockdown')) {
      setState('down');
      e.downT = Math.max(e.downT, 1.6);
      e.knock.copy(tmp).multiplyScalar(0.6 * power);
      return wasWindup;
    }
    switch (result.outcome) {
      case 'hit':
        // A low sweep takes a grunt's feet out: a short spell on the floor (brutes and bosses
        // only flinch).
        if (react === 'sweep' && !e.air && type !== 'brute' && !def.boss && has('Sweep_Fall')) {
          setState('down');
          e.down = true;
          e.downT = 1.3;
          e.knock.copy(tmp).multiplyScalar(1.5 * power);
          play('Sweep_Fall', { once: true, timeScale: 1.25, fade: 0.04 });
          if (result.stun) { e.stunned = true; e.stunT = result.stun; }
          break;
        }
        setState('hit');
        e.knock.copy(tmp).multiplyScalar(2.2 * power);
        if (e.air) { e.vel.y = Math.max(e.vel.y, 4.5); e.vel.x = tmp.x * 2; e.vel.z = tmp.z * 2; }
        else if (launch) e.launch(tmp.x * 2.5 * power, launch, tmp.z * 2.5 * power);
        play(REACTIONS[react] && react !== 'sweep' ? REACTIONS[react] : (rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head'), { once: true, timeScale: react ? 1.15 : 1.4, fade: 0.04 });
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
        if (!lying) {
          const clip = rng.chance(0.5) ? 'Death01' : 'Hit_Knockback';
          play(clip, { once: true, fade: 0.1, ...KO_FALL[clip] });
        }
        if (type === 'harley') events?.emit('harleyDown', { target: e });
        break;
      case 'stun':
        setState('stunned');
        e.stunned = true;
        e.stunT = result.stun * (type === 'brute' ? 1.8 : 1);
        play('Idle_Shield_Break', { once: true, timeScale: 0.8, fade: 0.1 });
        break;
      case 'parried':
        // A parry costs the knife goon nothing: an attack in progress carries on.
        e.knock.set(0, 0, 0);
        if (wasWindup) return false;
        setState('hit');
        play('Sword_Block', { once: true, timeScale: 1.8, fade: 0.05 });
        break;
      case 'immune':
        // Brutes shrug it off without breaking stride (no stun-lock by spamming punches).
        e.knock.copy(tmp).multiplyScalar(0.4);
        if (!wasWindup && e.state !== 'recover' && e.state !== 'engage') play('Yes', { once: true, timeScale: 2, fade: 0.1 });
        return false;
      default:
        break;
    }
    return wasWindup;
  };

  e.update = (dt, ctx) => {
    const { hero, others } = ctx;
    if (e.locoT > 0) e.locoT -= dt;
    ch.groundAt = enemyPlantsFeet(e) ? groundUnderFoot : null;
    // Frozen by a counter until its blow lands (with a failsafe).
    if (e.countered) {
      e.counterT += dt;
      if (e.counterT < 1.2) { ch.animator.update(dt * 0.2); return; }
      e.countered = false;
    }
    e.t += dt;
    if (e.stunT > 0) { e.stunT -= dt; if (e.stunT <= 0) e.stunned = false; }
    if (type === 'harley') {
      if (e.harleyCd.slam > 0) e.harleyCd.slam -= dt;
      if (e.harleyCd.sweep > 0) e.harleyCd.sweep -= dt;
      if (e.harleyCd.throw > 0) e.harleyCd.throw -= dt;
      if (e.cartwheelCd > 0) e.cartwheelCd -= dt;
    }
    const dx = hero.pos.x - pos.x, dz = hero.pos.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const level = Math.abs(hero.pos.y - pos.y) < MELEE_DY;
    let speed = 0;
    let moveX = 0, moveZ = 0;

    if (e.state === 'grabbed' || e.state === 'chained') {
      // Failsafe: a chain that never finished (a teleport, a restart) lets go after 5 s.
      if (e.state === 'chained' && e.t > 5) e.chainRelease();
      ch.animator.update(dt);
      return;
    }
    if (e.state === 'frozen') {
      e.frozenT -= dt;
      if (e.frozenT <= 0) e.thaw();
      return;
    }
    if (e.lostT > 0) { e.lostT -= dt; if (e.lostT <= 0) e.ringDist = Math.max(3.6, e.ringDist - 3); }
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
        if (type === 'harley' && e.state === 'engage' && shouldCartwheel(true, e.cartwheelCd, rng.next())) {
          e.cartwheelCd = rng.range(1.8, 2.8);
          setState('cartwheel');
          play('Roll', { once: true, timeScale: 1.3, fade: 0.05 });
          break;
        }
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
        if ((dist < 8 || def.ranged) && e.lostT <= 0) faceHero(hero, 8, dt);
        else if (speed) ch.face(Math.atan2(moveX, moveZ));
        // Squared up to Batman, a goon circles in a fight stance: a sideways step strafes, a
        // stand is its guard, and now and then, out of reach, it taunts.
        const squared = (dist < 8 || def.ranged) && e.lostT <= 0;
        const fwdX = Math.sin(ch.yaw), fwdZ = Math.cos(ch.yaw);
        const lateral = moveX * -fwdZ + moveZ * fwdX; // + = a step to its right (facing +z, right is -x)
        const melee = !RIFLE && type !== 'harley';
        if (e.tauntCd > 0) e.tauntCd -= dt;
        if (e.tauntT > 0) { e.tauntT -= dt; if (e.state !== 'engage') e.tauntT = 0; }
        else if (melee && e.state === 'engage' && !speed && dist > 4.2 && e.tauntCd <= 0 && has(TAUNTS[0])) {
          e.tauntCd = rng.range(7, 14);
          if (rng.chance(0.35)) { e.tauntT = 1.6; play(rng.pick(TAUNTS), { once: true, timeScale: 1.35, fade: 0.2 }); }
        }
        if (e.tauntT > 0) speed = 0;
        else if (speed > 2) loco('Jog_Fwd_Loop', { fade: 0.2 });
        else if (speed > 0 && melee && squared && Math.abs(lateral) > 0.55 && has('Goon_Strafe_L')) loco(lateral > 0 ? 'Goon_Strafe_R' : 'Goon_Strafe_L', { fade: 0.2, timeScale: Math.max(0.5, speed / 1.65) });
        else if (speed > 0) loco(type === 'brute' ? 'Zombie_Walk_Fwd_Loop' : WALK, { fade: 0.2 });
        else if (type === 'knife') loco(has('Goon_Knife_Idle') ? 'Goon_Knife_Idle' : 'Sword_Idle', { fade: 0.25 });
        else if (melee && has(e.guard)) loco(e.guard, { fade: 0.25 });
        else loco(type === 'brute' ? 'Idle_FoldArms_Loop' : IDLE, { fade: 0.25 });
        break;
      }
      case 'windup': {
        faceHero(hero, 10, dt);
        const want = type === 'brute' ? 3 : 2.3;
        if (!def.ranged && dist > want + 0.3) { speed = 2.2; moveX = dx / dist; moveZ = dz / dist; }
        if (e.t >= e.windupDur) {
          if (def.ranged) { setState('attack'); e.glyph = null; break; }
          setState('attack');
          e.lungeFrom.copy(pos);
          const reach = (e.attackKind === 'charge' || e.attackKind === 'harleyThrow') ? 0 : Math.max(0, dist - 1.1);
          e.lungeTo.set(pos.x + (dx / (dist || 1)) * reach, pos.y, pos.z + (dz / (dist || 1)) * reach);
          e.chargeDir.set(dx / (dist || 1), 0, dz / (dist || 1));
          ch.animator.mixer.timeScale = 1;
          if (e.attackKind === 'charge' || e.attackKind?.startsWith('harley')) {
            const a = ch.animator.play(ch.animator.currentName, { once: true, timeScale: 1.7 });
            a.time = Math.min(a.time, a.getClip().duration * 0.2);
          } else strikeFire();
          e.glyph = null;
        }
        break;
      }
      case 'attack': {
        if (e.attackKind === 'rifle') {
          faceHero(hero, 10, dt);
          if (!e.hitDone) {
            e.hitDone = true;
            // One gate for the tracer and the damage: a shot that "hits" always lands. A rifle
            // marked warnShot (every rifle in a predator room, when the alarm goes up) misses on
            // purpose with the first shot that would have hit: a moment to react.
            const onTarget = e.seesHero !== false && dist < 32;
            const lands = onTarget && !e.warnShot;
            if (onTarget) e.warnShot = false;
            ctx.onRifleFire?.(e, lands);
            if (lands) ctx.onAttackLand(e, 'rifle');
          }
          if (e.t > 0.45) { setState('recover'); ctx.onAttackEnd(e); }
          break;
        }
        if (e.attackKind === 'charge') {
          speed = 12;
          moveX = e.chargeDir.x; moveZ = e.chargeDir.z;
          if (!e.hitDone && dist < 1.5 * scale && level) { e.hitDone = true; ctx.onAttackLand(e, 'charge'); }
          if (e.t > 0.75) { setState('recover'); ctx.onAttackEnd(e); }
        } else if (e.attackKind === 'harleyThrow') {
          // A thrown pie/confetti bomb: stands her ground and tosses it, no lunge.
          faceHero(hero, 10, dt);
          if (!e.hitDone && e.t > 0.22) {
            e.hitDone = true;
            if (dist < 16 && level) ctx.onAttackLand(e, 'harleyThrow');
          }
          if (e.t > 0.5) { setState('recover'); ctx.onAttackEnd(e); }
        } else {
          const k = Math.min(1, e.t / 0.16);
          pos.x = e.lungeFrom.x + (e.lungeTo.x - e.lungeFrom.x) * k;
          pos.z = e.lungeFrom.z + (e.lungeTo.z - e.lungeFrom.z) * k;
          if (!e.hitDone && e.t >= STRIKE_LAND) {
            e.hitDone = true;
            if (dist < 2 * scale && level) ctx.onAttackLand(e, e.attackKind);
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
        if (e.downT <= 0) { setState('getup'); getUp(); }
        break;
      case 'getup':
        // Unaware: stand, then wake. A predator room's wake() only sends it looking, so it must not
        // be left in getup (unsteerable, and waking again every frame).
        if (e.t > (has(GETUP.clip) ? GETUP.length : 1.0)) { e.down = false; if (e.aware) setState('engage'); else { setState('idle'); e.wake(); } }
        break;
      case 'tied':
        e.tiedT -= dt;
        if (e.tiedT <= 0) { e.tiedWith = null; setState('getup'); getUp(); }
        break;
      case 'dance':
        e.danceT -= dt;
        if (e.danceT <= 0) { e.stunned = false; e.stunT = 0; setState(e.aware ? 'engage' : 'idle'); }
        break;
      case 'cartwheel': {
        // Harley Quinn only: a quick hop-roll away from Batman. Flavor, not a hard i-frame.
        const cx = pos.x - hero.pos.x, cz = pos.z - hero.pos.z;
        const cd = Math.hypot(cx, cz) || 1;
        speed = 5;
        moveX = cx / cd; moveZ = cz / cd;
        ch.face(Math.atan2(moveX, moveZ));
        if (e.t > 0.45) setState('engage');
        break;
      }
      case 'patrol':
      case 'search':
      case 'hunt': {
        e.nav.px = pos.x; e.nav.pz = pos.z;
        const gx = e.nav.x - pos.x, gz = e.nav.z - pos.z, gd = Math.hypot(gx, gz);
        if (gd < 0.35) e.nav.arrived = true;
        if (!e.nav.arrived) {
          speed = e.nav.speed;
          moveX = gx / gd; moveZ = gz / gd;
          turnTo(Math.atan2(moveX, moveZ), 8, dt);
        } else if (e.nav.face !== null) turnTo(e.nav.face, 4, dt);
        if (speed > 2.6) play('Jog_Fwd_Loop', { fade: 0.2 });
        else if (speed > 0) play(WALK, { fade: 0.2, timeScale: Math.max(0.8, speed / 1.7) });
        else play(IDLE, { fade: 0.25 });
        break;
      }
      case 'suspicious':
      case 'look':
        turnTo(Math.atan2(e.nav.lookX - pos.x, e.nav.lookZ - pos.z), e.state === 'look' ? 2.5 : 5, dt);
        play(e.state === 'look' ? LOOK : IDLE, { fade: 0.25 });
        break;
      case 'ko':
        break;
      default:
        break;
    }

    if (e.air) {
      // Ballistic flight: gravity, walls, landing. Thrown goons bowl over whoever they hit.
      e.vel.y -= 24 * dt;
      const prevY = pos.y;
      pos.addScaledVector(e.vel, dt);
      const r = collision.resolveCylinder(pos, e.radius, 1.8 * scale, { stepUp: 0.45, prevY });
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
        if (e.alive && e.state !== 'ko' && e.state !== 'tied') { e.down = true; e.downT = Math.max(e.downT, 1.6); setState('down'); }
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
    // Room goons never walk off a catwalk or the balcony: they stop at the edge instead.
    if (speed && e.room && !e.air) {
      const ahead = collision.groundBelow(pos.x + moveX * 0.6, pos.y + 0.5, pos.z + moveZ * 0.6, 0.15);
      if (ahead < pos.y - 0.6) { speed = 0; e.nav.arrived = true; }
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
    // Walking into a wall or a crate: count it as arrived after a second, so the runtime moves on.
    if (WALKING.has(e.state)) {
      const moved = Math.hypot(pos.x - e.nav.px, pos.z - e.nav.pz);
      e.nav.stuckT = !e.nav.arrived && e.nav.speed > 0 && moved < e.nav.speed * dt * 0.25 ? e.nav.stuckT + dt : 0;
      if (e.nav.stuckT > 1) { e.nav.arrived = true; e.nav.stuckT = 0; }
    }
    // Walked or slid off an edge: fall instead of teleporting down.
    if (r.groundY < pos.y - 0.6) e.launch(e.knock.x * 0.5, 0, e.knock.z * 0.5);
    else if (r.groundY > -Infinity) pos.y = r.groundY;
    ch.animator.update(dt);
  };

  e.remove = () => { scene.remove(ch.root); };
  return e;
}
