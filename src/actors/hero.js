// The player character: locomotion, jumping, gliding and grappling. Combat moves take over
// through `hero.control` (an object with update(dt) -> true when finished).
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { createBat } from './characters.js';
import { createCape } from './cape.js';

const GRAVITY = 26;
const JUMP_V = 9.4;
const RUN = 6.8;
const SPRINT = 11.5;
const RADIUS = 0.35;
const HEIGHT = 1.8;

export function createHero({ assets, suit, scene, collision, events }) {
  const bat = createBat(assets, ['m', 'f', 'gold'].includes(suit) ? suit : 'm');
  scene.add(bat.root);
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

  const h = {
    bat, cape, pos, vel, collision, dead: false,
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
  };

  function setState(s) { h.state = s; h.stateT = 0; }

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
    const r = collision.resolveCylinder(pos, RADIUS, HEIGHT);
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
    h.grounded = true;
    h.airT = 0;
    cape.setWings(false);
    bat.tilt.rotation.set(0, 0, 0);
    if (impact < -15) {
      setState('roll');
      bat.animator.play('Roll', { once: true, timeScale: 1.35, fade: 0.08 });
      events.emit('land', { hard: true });
    } else {
      setState('ground');
      if (impact < -6) { bat.animator.play('Jump_Land', { once: true, timeScale: 1.5, fade: 0.06 }); h.landT = 0.18; }
      events.emit('land', { hard: false });
    }
  }

  function startGlide() {
    setState('glide');
    const hs = Math.hypot(vel.x, vel.z);
    h.glide.speed = Math.max(12, hs);
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
    const sprint = input.down('sprint') && mag > 0.5 && !h.blocking;
    const max = h.blocking ? 2.2 : sprint ? SPRINT : RUN;

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
      if (h.coyote > 0 && h.jumpBuffer > 0) { vel.y = JUMP_V; h.coyote = 0; h.jumpBuffer = 0; events.emit('jump'); }
      h.coyote = Math.max(0, h.coyote - dt);
      if (mag > 0.05) faceTowards(wish.x, wish.z, 6, dt);
      if (h.airT > 0.2 && vel.y < 3 && input.down('jump') && heightAboveGround() > 2.2) startGlide();
      else if (h.airT > 0.35 && bat.animator.currentName !== 'Jump_Loop' && bat.animator.currentName !== 'Jump_Start') bat.animator.play('Jump_Loop', { fade: 0.2 });
    } else if (h.state === 'glide') {
      const g = h.glide;
      // Look down to dive (faster, steeper), level out to trade speed for lift.
      const dive = THREE.MathUtils.clamp((cam.state.pitch - 0.3) / 0.6, 0, 1);
      const target = 15 + dive * 20;
      g.speed += (target - g.speed) * Math.min(1, dt * (dive > 0 ? 1.4 : 0.6));
      const lift = dive === 0 && g.speed > 17 ? (g.speed - 17) * 0.55 : 0;
      const sink = 3 + dive * 11 - lift;
      // Steer toward where the camera faces, plus left/right input.
      const camYaw = Math.atan2(f.x, f.z);
      const want = camYaw - input.move.x * 0.9;
      const delta = Math.atan2(Math.sin(want - g.heading), Math.cos(want - g.heading));
      const turn = THREE.MathUtils.clamp(delta, -1, 1) * 2.1 * dt;
      g.heading += turn;
      vel.x = Math.sin(g.heading) * g.speed;
      vel.z = Math.cos(g.heading) * g.speed;
      vel.y += (-sink - vel.y) * Math.min(1, dt * 3);
      bat.face(g.heading);
      const lean = 1.05 + dive * 0.35;
      bat.tilt.rotation.x += (lean * bat.lm.fwd - bat.tilt.rotation.x) * Math.min(1, dt * 5);
      bat.tilt.rotation.z += (-turn / dt * 0.12 - bat.tilt.rotation.z) * Math.min(1, dt * 4);
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
      else if (h.speed < 0.4) bat.animator.play('Idle_Loop', { fade: 0.2 });
      else if (h.speed < 8) bat.animator.play('Jog_Fwd_Loop', { fade: 0.15 });
      else bat.animator.play('Sprint_Loop', { fade: 0.15 });
      h.stride += h.speed * dt;
      if (h.speed > 0.5 && h.stride > (h.speed > 8 ? 2.3 : 1.7)) { h.stride = 0; events.emit('footstep'); }
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
            if (boost) {
              // Grapple boost: fling up over the ledge and straight into a glide if jump is held.
              pos.copy(hang);
              vel.set(-n.x * 9, 15, -n.z * 9);
              h.grounded = false;
              setState('air');
              h.airT = 0.3;
              bat.face(Math.atan2(-n.x, -n.z));
              bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
              events.emit('grappleBoost');
              cable.visible = false;
              return true;
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
    h.invulnerable = Math.max(0, h.invulnerable - dt);
    if (h.frozen) { bat.animator.update(dt); return; }
    if (h.control) {
      if (h.control.update(dt, ctx)) { h.control = null; cable.visible = false; }
    } else {
      if (ctx.input.pressed('grapple') && ctx.grappleTarget && h.state !== 'roll') {
        h.control = grappleControl(ctx.grappleTarget, events);
      } else {
        locomotion(dt, ctx);
      }
    }
    bat.animator.update(dt);
  };

  h.updateCape = (dt) => {
    // Air rushing past the cape.
    const wind = [-vel.x * 0.8 + 0.6, -vel.y * 0.5 + (h.state === 'glide' ? 6 : 0), -vel.z * 0.8 + 0.3];
    cape.update(dt, wind);
  };

  h.teleport = (p, yaw = bat.yaw) => {
    pos.set(p.x, p.y, p.z);
    vel.set(0, 0, 0);
    bat.face(yaw);
    h.control = null;
    h.grounded = true;
    setState('ground');
    cape.setWings(false);
    bat.tilt.rotation.set(0, 0, 0);
    cape.reset();
    bat.animator.play('Idle_Loop', { fade: 0 });
  };

  h.cameraMode = () => {
    if (h.control?.name === 'grapple') return 'zip';
    if (h.state === 'glide') return 'glide';
    if (h.speed > 8.5 && h.state === 'ground') return 'sprint';
    return 'ground';
  };

  return h;
}
