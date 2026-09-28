// The player character: locomotion, jumping, gliding and grappling. Combat moves take over
// through `hero.control` (an object with update(dt) -> true when finished).
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { createBat, footGround, heroPlantsFeet } from './characters.js';
import { createCape } from './cape.js';
import { ladderGrab, ladderTopGrab, zipClosest } from '../world/climbables.js';
import { createLadderControl } from './traverse/ladder.js';
import { findLedge, findRunWall } from './traverse/probes.js';
import { createLedgeControl } from './traverse/ledge.js';
import { createZipControl } from './traverse/zipline.js';
import { createWallRunControl } from './traverse/wallrun.js';
import { createDiveControl } from './traverse/divebomb.js';
import { shouldDiveBomb, canDropTakedown } from '../combat/rules.js';

const GRAVITY = 26;
const JUMP_V = 9.4;
const RUN = 6.8;
const SPRINT = 11.5;
const CROUCH = 3.2;       // m/s crouched
const RADIUS = 0.35;
const HEIGHT = 1.8;
const GLIDE_G = 20;       // how hard gravity pulls along a dive
const GLIDE_MAX = 48;     // m/s
const GLIDE_CRUISE = 17;  // m/s

export function createHero({ assets, suit, scene, collision, events, climbables = { ladders: [], ziplines: [] }, settings = { autoLedge: true } }) {
  const bat = createBat(assets, ['m', 'f', 'gold'].includes(suit) ? suit : 'm');
  scene.add(bat.root);
  const groundUnderFoot = footGround(collision);
  const cape = createCape(bat, bat.colors.cape);
  scene.add(cape.mesh);

  // Grapple cable.
  const cableGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const cable = new THREE.Line(cableGeo, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
  cable.layers.set(LAYER_FX);
  cable.frustumCulled = false;
  cable.visible = false;
  scene.add(cable);

  const pos = bat.root.position;
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), wish = new THREE.Vector3();
  const before = new THREE.Vector3();
  const zipProbe = { x: 0, y: 0, z: 0 }; // reused each frame for the nearest-zipline check while airborne
  const zipHit = { s: 0, dist: 0 }; // reused result for zipClosest, likewise
  const ladderOpts = { reach: 0.7, facingX: undefined, facingZ: undefined }; // reused options for ladderGrab

  const h = {
    bat, cape, cable, pos, vel, collision, dead: false,
    state: 'ground', stateT: 0, grounded: true, airT: 0, coyote: 0, jumpBuffer: 0,
    health: 100, maxHealth: 100,
    glide: { speed: 0, heading: 0 },
    control: null, // combat or scripted move in progress
    blocking: false,
    invulnerable: 0,
    groundY: 0,
    lastSafe: new THREE.Vector3(),
    stride: 0,
    speed: 0,
    frozen: false,
    airRuns: 0,      // wall runs used since last touching the ground
    lastClimbT: 99,  // seconds since leaving a ladder, ledge or zipline
    crouched: false, // crouch toggle: slow, silent, harder to see (Part D)
    perched: false,  // standing on a gargoyle or other perch (set by src/stealth/stealthSystem.js)
    // Traversal numbers WayneTech upgrades (game.js points this at the live effects object).
    tuning: { boostUp: 15, boostOut: 9, diveGain: 1, glideMax: 48, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4 },
  };

  function setState(s) { h.state = s; h.stateT = 0; }

  function setCrouch(v) {
    if (h.crouched === v) return;
    h.crouched = v;
    events.emit(v ? 'crouchOn' : 'crouchOff');
  }
  // A perch drop in a predator room lands Batman in a crouch (src/stealth/takedowns.js).
  h.setCrouch = setCrouch;

  function faceTowards(dx, dz, rate, dt) {
    const target = Math.atan2(dx, dz);
    const delta = Math.atan2(Math.sin(target - bat.yaw), Math.cos(target - bat.yaw));
    bat.face(bat.yaw + (rate ? delta * Math.min(1, rate * dt) : delta));
  }

  function heightAboveGround() {
    const g = collision.groundBelow(pos.x, pos.y, pos.z, RADIUS * 0.6);
    return g === -Infinity ? 999 : pos.y - g;
  }

  // Move with collision; strip velocity going into whatever pushed us back.
  function integrate(dt) {
    before.copy(pos);
    pos.addScaledVector(vel, dt);
    const r = collision.resolveCylinder(pos, RADIUS, HEIGHT, { prevY: before.y });
    const pushX = pos.x - (before.x + vel.x * dt), pushZ = pos.z - (before.z + vel.z * dt);
    const pl = Math.hypot(pushX, pushZ);
    if (pl > 1e-5) {
      const nx = pushX / pl, nz = pushZ / pl;
      const into = vel.x * nx + vel.z * nz;
      if (into < 0) { vel.x -= into * nx; vel.z -= into * nz; }
    }
    if (r.ceiling && vel.y > 0) vel.y = 0;
    h.groundY = r.groundY;
    return r;
  }

  function land(impact) {
    if (impact < -8 && h.combat && h.control?.name !== 'dive') {
      const e = h.combat.enemies.find((g) => canDropTakedown(g, pos));
      if (e) h.combat.takedown(e, 'drop');
    }
    h.airRuns = 0;
    h.grounded = true;
    h.airT = 0;
    cape.setWings(false);
    bat.tilt.rotation.set(0, 0, 0);
    if (impact < -15) {
      setState('roll');
      bat.animator.play('Roll', { once: true, timeScale: 1.35, fade: 0.08 });
      events.emit('land', { hard: true, who: 'hero' });
    } else {
      setState('ground');
      if (impact < -6) { bat.animator.play('Jump_Land', { once: true, timeScale: 1.5, fade: 0.06 }); h.landT = 0.18; }
      events.emit('land', { hard: false, who: 'hero' });
    }
  }

  function startGlide() {
    setState('glide');
    const hs = Math.hypot(vel.x, vel.z);
    h.glide.speed = Math.max(14, hs);
    h.glide.heading = hs > 1 ? Math.atan2(vel.x, vel.z) : bat.yaw;
    cape.setWings(true);
    bat.animator.play('A_TPose', { fade: 0.2 });
    events.emit('glideStart');
  }

  function tryAutoVault(dirX, dirZ) {
    // Hop over waist-high obstacles (parapets, crates) when running into them.
    const probeX = pos.x + dirX * 0.75, probeZ = pos.z + dirZ * 0.75;
    const top = collision.groundBelow(probeX, pos.y + 1.6, probeZ, 0.1);
    const rise = top - pos.y;
    if (rise > 0.45 && rise < 1.55) {
      vel.y = Math.sqrt(2 * GRAVITY * (rise + 0.45));
      vel.x = dirX * 5;
      vel.z = dirZ * 5;
      h.grounded = false;
      setState('air');
      bat.animator.play('Jump_Start', { once: true, timeScale: 1.6, fade: 0.06 });
      events.emit('vault');
      return true;
    }
    return false;
  }

  function locomotion(dt, ctx) {
    const { input, cam } = ctx;
    const f = cam.forward(tmp), side = cam.right(tmp2);
    wish.set(f.x * input.move.y + side.x * input.move.x, 0, f.z * input.move.y + side.z * input.move.x);
    const mag = Math.min(1, wish.length());
    if (mag > 0) wish.divideScalar(wish.length());
    if (h.state === 'ground' && input.pressed('crouch')) setCrouch(!h.crouched);
    const sprint = input.down('sprint') && mag > 0.5 && !h.blocking;
    if (h.crouched && (sprint || h.blocking)) setCrouch(false);
    const max = h.blocking ? 2.2 : sprint ? SPRINT : h.crouched ? CROUCH : RUN;

    if (input.pressed('jump')) h.jumpBuffer = 0.14;
    h.jumpBuffer = Math.max(0, h.jumpBuffer - dt);

    if (h.state === 'ground' || h.state === 'roll') {
      const accel = h.state === 'roll' ? 4 : 50;
      vel.x += (wish.x * max * mag - vel.x) * Math.min(1, accel * dt / Math.max(1, max));
      vel.z += (wish.z * max * mag - vel.z) * Math.min(1, accel * dt / Math.max(1, max));
      if (h.state === 'roll') {
        if (h.stateT > 0.55) setState('ground');
      }
      if (mag > 0.05 && !h.blocking) faceTowards(wish.x, wish.z, 14, dt);
      vel.y = -2;
      if (h.jumpBuffer > 0 && h.state === 'ground') {
        setCrouch(false);
        const wall = input.down('sprint') && h.airRuns < 1 ? findRunWall(collision, pos, vel.x, vel.z) : null;
        if (wall) { h.jumpBuffer = 0; h.control = createWallRunControl(h, { collision, events }, { wall, speed: h.speed }); return; }
        h.jumpBuffer = 0;
        vel.y = JUMP_V;
        h.grounded = false;
        setState('air');
        bat.animator.play('Jump_Start', { once: true, timeScale: 1.4, fade: 0.08 });
        events.emit('jump');
      }
    } else if (h.state === 'air') {
      vel.x += (wish.x * max * mag - vel.x) * Math.min(1, 3 * dt);
      vel.z += (wish.z * max * mag - vel.z) * Math.min(1, 3 * dt);
      vel.y = Math.max(-48, vel.y - GRAVITY * dt);
      h.airT += dt;
      if (input.down('sprint') && h.airRuns < 1 && h.jumpBuffer > 0) {
        const wall = findRunWall(collision, pos, vel.x, vel.z);
        if (wall) { h.jumpBuffer = 0; h.control = createWallRunControl(h, { collision, events }, { wall, speed: h.speed }); return; }
      }
      if (h.coyote > 0 && h.jumpBuffer > 0) { vel.y = JUMP_V; h.coyote = 0; h.jumpBuffer = 0; events.emit('jump'); }
      h.coyote = Math.max(0, h.coyote - dt);
      if (mag > 0.05) faceTowards(wish.x, wish.z, 6, dt);
      if (h.airT > 0.2 && vel.y < 3 && input.down('jump') && heightAboveGround() > 2.2) startGlide();
      else if (h.airT > 0.35 && bat.animator.currentName !== 'Jump_Loop' && bat.animator.currentName !== 'Jump_Start') bat.animator.play('Jump_Loop', { fade: 0.2 });
    } else if (h.state === 'glide') {
      const g = h.glide;
      // Pitch control: sprint key or looking down dives, back key or looking up pulls up.
      let ctrl = THREE.MathUtils.clamp((cam.state.pitch - 0.25) / 0.45, -1, 1);
      if (input.down('sprint')) ctrl = 1;
      else if (input.move.y < -0.3) ctrl = -1;
      else if (Math.abs(ctrl) < 0.12) ctrl = 0;
      g.ctrl = ctrl;
      let vyTarget;
      if (ctrl > 0) {
        // Dive: gravity turns height into speed.
        // Arcade physics: a dive buys more speed per meter than real gravity would.
        const angle = ctrl * 0.75;
        g.speed = Math.min(h.tuning.glideMax, g.speed + (GLIDE_G * 1.35 * h.tuning.diveGain * Math.sin(angle) - g.speed * 0.02) * dt);
        vyTarget = -g.speed * Math.sin(angle) * 0.55;
      } else if (ctrl < 0 && g.speed > GLIDE_CRUISE - 2) {
        // Swoop: spend speed to climb. v^2 = 2gh, with some loss.
        const climb = Math.min(20, (g.speed - GLIDE_CRUISE + 6) * 0.85) * -ctrl;
        vyTarget = climb;
        g.speed = Math.max(GLIDE_CRUISE - 4, g.speed - ((climb * GLIDE_G * 1.25) / Math.max(8, g.speed) + 2.5) * dt);
      } else {
        // Level: a slow bleed toward cruising speed and a gentle sink; faster sink when stalling.
        g.speed += (GLIDE_CRUISE - g.speed) * Math.min(1, dt * (g.speed > GLIDE_CRUISE ? 0.25 : 0.8));
        vyTarget = g.speed < 11 ? -7 : -2.4 + Math.max(0, g.speed - 22) * 0.12;
      }
      const sink = -vyTarget;
      // Steer toward where the camera faces, plus left/right input.
      const camYaw = Math.atan2(f.x, f.z);
      const want = camYaw - input.move.x * 0.9;
      const delta = Math.atan2(Math.sin(want - g.heading), Math.cos(want - g.heading));
      const turn = THREE.MathUtils.clamp(delta, -1, 1) * 2.1 * dt;
      g.heading += turn;
      vel.x = Math.sin(g.heading) * g.speed;
      vel.z = Math.cos(g.heading) * g.speed;
      vel.y += (-sink - vel.y) * Math.min(1, dt * 4);
      bat.face(g.heading);
      const lean = 1.0 + ctrl * 0.45;
      bat.tilt.rotation.x += (lean * bat.lm.fwd - bat.tilt.rotation.x) * Math.min(1, dt * 5);
      bat.tilt.rotation.z += (-turn / dt * 0.12 - bat.tilt.rotation.z) * Math.min(1, dt * 4);
      if (input.pressed('kick') && shouldDiveBomb(h.state, heightAboveGround()) && h.combat) {
        h.control = createDiveControl(h, { events, combat: h.combat });
        h.combat.consumeInput('kick');
        return;
      }
      if (!input.down('jump')) {
        setState('air');
        h.airT = 0.5;
        cape.setWings(false);
        bat.tilt.rotation.set(0, 0, 0);
        bat.animator.play('Jump_Loop', { fade: 0.2 });
      }
    }

    const vy = vel.y;
    const r = integrate(dt);
    // Ladders: walk into the foot, walk off the top toward one, or drift into one falling.
    if (!h.control && h.lastClimbT > 0.4 && climbables.ladders.length) {
      let g = null, fromTop = false;
      if (h.state === 'ground' && mag > 0.3) {
        ladderOpts.reach = 0.7; ladderOpts.facingX = wish.x; ladderOpts.facingZ = wish.z;
        g = ladderGrab(climbables.ladders, pos, ladderOpts);
        if (!g) { const top = ladderTopGrab(climbables.ladders, pos, wish.x, wish.z); if (top) { g = { ladder: top, y: top.top - 1 }; fromTop = true; } }
      } else if ((h.state === 'air' || h.state === 'glide') && vel.y < 0) {
        ladderOpts.reach = 0.55; ladderOpts.facingX = undefined; ladderOpts.facingZ = undefined;
        g = ladderGrab(climbables.ladders, pos, ladderOpts);
      }
      if (g) { h.control = createLadderControl(h, { collision, events }, { ...g, fromTop }); return; }
    }
    // Ledges: falling (or gliding slowly) with an edge in reach.
    if (!h.control && settings.autoLedge && h.lastClimbT > 0.35 && vel.y < 0 &&
        (h.state === 'air' || (h.state === 'glide' && h.glide.speed < 16))) {
      const fx = Math.sin(bat.yaw), fz = Math.cos(bat.yaw);
      const ledge = findLedge(collision, pos, fx, fz);
      if (ledge) { h.control = createLedgeControl(h, { collision, events }, { ledge }); return; }
    }
    // Ziplines: jumping or gliding into a cable catches it, riding from the closest point.
    if (!h.control && h.lastClimbT > 0.5 && (h.state === 'air' || h.state === 'glide') && climbables.ziplines.length) {
      zipProbe.x = pos.x; zipProbe.y = pos.y + 2.05; zipProbe.z = pos.z;
      for (const line of climbables.ziplines) {
        zipClosest(line, zipProbe, zipHit);
        if (zipHit.dist < 0.9 && zipHit.s < line.length - 3) { h.control = createZipControl(h, { events }, { line, s: zipHit.s }); return; }
      }
    }
    const wasGrounded = h.grounded;
    if (r.grounded && vy <= 0.01) {
      if (h.state === 'air' || h.state === 'glide') land(vy);
      h.grounded = true;
      vel.y = 0;
    } else if (!r.grounded && wasGrounded && (h.state === 'ground' || h.state === 'roll')) {
      h.grounded = false;
      h.coyote = 0.12;
      h.airT = 0;
      setState('air');
    }
    if (h.state === 'glide' && r.hitWall && Math.hypot(vel.x, vel.z) < 4) {
      setState('air'); cape.setWings(false); bat.tilt.rotation.set(0, 0, 0);
    }
    if (h.state === 'ground' && r.hitWall && mag > 0.5) tryAutoVault(wish.x, wish.z);

    h.speed = Math.hypot(vel.x, vel.z);
    if (h.state === 'ground') {
      if (h.landT > 0) h.landT -= dt;
      else if (h.blocking) bat.animator.play('Idle_Shield_Loop', { fade: 0.1 });
      else if (h.crouched || h.perched) bat.animator.play(h.speed < 0.3 ? 'Crouch_Idle_Loop' : 'Crouch_Fwd_Loop', { fade: 0.2, timeScale: h.speed < 0.3 ? 1 : Math.max(0.7, h.speed / 2.4) });
      else if (h.speed < 0.4) bat.animator.play('Idle_Loop', { fade: 0.2 });
      else if (h.speed < 8) bat.animator.play('Jog_Fwd_Loop', { fade: 0.15 });
      else bat.animator.play('Sprint_Loop', { fade: 0.15 });
      h.stride += h.speed * dt;
      if (!h.crouched && h.speed > 0.5 && h.stride > (h.speed > 8 ? 2.3 : 1.7)) { h.stride = 0; events.emit('footstep', { sprint: h.speed > 8 }); }
      if (r.groundY > -Infinity && h.speed < 20) h.lastSafe.copy(pos);
    }
  }

  // ---- grapple ----
  const hand = new THREE.Vector3();
  function grappleControl(point, events) {
    const start = pos.clone();
    const n = new THREE.Vector3(point.nx ?? 0, 0, point.nz ?? 0);
    const hang = new THREE.Vector3(point.x, point.y - 1.3, point.z).addScaledVector(n, 0.55);
    const landing = new THREE.Vector3(point.x, point.y, point.z).addScaledVector(n, point.perch ? 0 : -1.1);
    let phase = 'fire', t = 0, boost = false;
    const total = start.distanceTo(hang);
    cape.setWings(false);
    bat.tilt.rotation.set(0, 0, 0);
    faceTowards(point.x - pos.x, point.z - pos.z, 0, 0);
    bat.animator.play('Spell_Simple_Shoot', { once: true, timeScale: 2.4, fade: 0.05 });
    events.emit('grapple');
    return {
      name: 'grapple',
      update(dt, ctx) {
        t += dt;
        cable.visible = phase !== 'vault';
        bat.bone('hand_r').getWorldPosition(hand);
        cableGeo.attributes.position.setXYZ(0, hand.x, hand.y, hand.z);
        cableGeo.attributes.position.setXYZ(1, point.x, point.y, point.z);
        cableGeo.attributes.position.needsUpdate = true;
        if (ctx.input.pressed('jump')) boost = true;
        if (phase === 'fire') {
          if (t > 0.2) { phase = 'zip'; t = 0; bat.animator.play('NinjaJump_Idle_Loop', { fade: 0.1 }); }
          return false;
        }
        if (phase === 'zip') {
          const dur = Math.max(0.35, total / 30);
          const k = Math.min(1, t / dur);
          const e = k * k * (3 - 2 * k);
          pos.lerpVectors(start, hang, e);
          pos.y += Math.sin(k * Math.PI) * Math.min(3, total * 0.05);
          vel.set(0, 0, 0);
          if (k >= 1) {
            if (point.zip) { cable.visible = false; h.control = createZipControl(h, { events }, { line: point.zip, s: 0.5 }); return false; }
            if (boost) {
              // Grapple boost: fling up over the ledge and straight into a glide if jump is held.
              pos.copy(hang);
              vel.set(-n.x * h.tuning.boostOut, h.tuning.boostUp, -n.z * h.tuning.boostOut);
              h.grounded = false;
              setState('air');
              h.airT = 0.3;
              bat.face(Math.atan2(-n.x, -n.z));
              bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
              events.emit('grappleBoost');
              cable.visible = false;
              return true;
            }
            if (point.ledge) {
              const l = findLedge(collision, hang, -n.x, -n.z, { minRise: 0.6, maxRise: 2.6, reach: 0.9 });
              if (l) { cable.visible = false; h.control = createLedgeControl(h, { collision, events }, { ledge: l }); return false; }
            }
            phase = 'vault'; t = 0;
            bat.face(Math.atan2(-n.x || point.x - pos.x, -n.z || point.z - pos.z));
            bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.5, fade: 0.08 });
            events.emit('grappleLand');
          }
          return false;
        }
        // vault
        const k = Math.min(1, t / 0.6);
        pos.lerpVectors(hang, landing, k);
        pos.y = hang.y + (landing.y - hang.y) * Math.min(1, k * 1.6);
        if (k >= 1) {
          pos.copy(landing);
          vel.set(0, 0, 0);
          h.grounded = true;
          setState('ground');
          cable.visible = false;
          return true;
        }
        return false;
      },
    };
  }

  h.update = (dt, ctx) => {
    h.stateT += dt;
    h.lastClimbT += dt;
    // Leaving the ground (or starting a move that isn't a quiet takedown) stands Batman up.
    if (h.crouched && (h.state !== 'ground' || (h.control && !h.control.keepCrouch))) setCrouch(false);
    h.invulnerable = Math.max(0, h.invulnerable - dt);
    bat.groundAt = heroPlantsFeet(h) ? groundUnderFoot : null;
    if (h.frozen) { bat.animator.update(dt); return; }
    if (h.control) {
      const ctl = h.control;
      if (ctl.update(dt, ctx) && h.control === ctl) { h.control = null; cable.visible = false; }
    } else {
      if (ctx.input.pressed('grapple') && ctx.grappleTarget && h.state !== 'roll') {
        h.control = grappleControl(ctx.grappleTarget, events);
      } else {
        locomotion(dt, ctx);
      }
    }
    bat.animator.update(dt);
  };

  const groundUnderHem = (x, z) => collision.groundBelow(x, pos.y + 0.3, z, 0.02);
  h.updateCape = (dt) => {
    // Air rushing past the cape.
    const wind = [-vel.x * 0.8 + 0.6, -vel.y * 0.5 + (h.state === 'glide' ? 6 : 0), -vel.z * 0.8 + 0.3];
    // While the hero stands, the hem rests on whatever is within a step of the feet under each of
    // its points (a roof, a parapet) and hangs free past an edge; hanging, climbing or airborne
    // the whole cloth falls free.
    const standing = !h.control && h.grounded && (h.state === 'ground' || h.state === 'roll');
    cape.update(dt, wind, standing ? groundUnderHem : null);
  };

  h.teleport = (p, yaw = bat.yaw) => {
    pos.set(p.x, p.y, p.z);
    vel.set(0, 0, 0);
    bat.face(yaw);
    h.control = null;
    h.crouched = false; h.perched = false;
    h.grounded = true;
    setState('ground');
    cape.setWings(false);
    bat.tilt.rotation.set(0, 0, 0);
    cape.reset();
    bat.animator.play('Idle_Loop', { fade: 0 });
  };

  h.cameraMode = () => {
    if (h.control?.camera) return h.control.camera;
    if (h.control?.name === 'grapple') return 'zip';
    if (h.state === 'glide') return 'glide';
    if (h.speed > 8.5 && h.state === 'ground') return 'sprint';
    return 'ground';
  };

  // Used by the traversal controls in src/actors/traverse/.
  Object.assign(h, { setState, faceTowards, integrate, startGlide, land, heightAboveGround, RADIUS, HEIGHT, GRAVITY });

  return h;
}
