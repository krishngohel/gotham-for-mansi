// src/vehicles/batwing.js
// Part V2 contract (see docs/superpowers/specs/2026-09-30-birthday-night-design.md):
// createBatwing(deps) -> { call(), exit(), active, update(dt, real), startArmada({ balloons, onDone }) }
// Events: wingEnter, wingExit, armadaDone { ok }. Hero control name while flying: 'fly'.
import * as THREE from 'three';
import { WORLD, SITES } from '../world/mapData.js';
import { createRng } from '../core/rng.js';
import { buildBatwingMesh, buildBalloonMesh, buildDartMesh, WING_RADIUS, WING_HEIGHT } from './wingModel.js';
import { createWingState, stepWing, clampToWorld, bounceWing, WING_TUNING } from './wingFlight.js';
import { makeArmadaBalloons, driftArmada, popArmadaNear, armadaPoppedCount, armadaAllPopped } from './wingArmada.js';

const BOARD_DUR = 0.85;    // seconds: the swoop-in before Batman boards
const FLYOFF_DUR = 2.2;    // seconds: how long the plane climbs away after an eject
const DART_SPEED = 95;     // m/s
const DART_LIFE = 1.1;     // seconds
const DART_POOL = 10;
const PLANE_POP_RADIUS = 4.2;  // flying straight through a balloon pops it
const DART_POP_RADIUS = 2.1;
const LAND_RADIUS = 26;    // near the GCPD roof: an easy auto-eject once grounded

// A small HUD counter in the game's ink-comic style, built inline so this file stays self
// contained (src/ui/hud.js already owns the 12 birthday balloons' counter).
function createArmadaHud(hudRoot) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'left:50%', 'top:20px', 'transform:translateX(-50%) rotate(-1deg)',
    'padding:8px 18px', 'background:#f2d24b', 'color:#0b0b12', 'border:3px solid #0b0b12',
    'box-shadow:4px 4px 0 #0b0b12', 'font:22px "Patrick Hand SC",cursive', 'z-index:6',
    'display:none', 'pointer-events:none', 'text-align:center',
  ].join(';');
  el.innerHTML = 'Pop the balloons <b style="display:block;font:30px Bangers,cursive;letter-spacing:1px;">0 / 0</b>';
  (hudRoot ?? document.body).appendChild(el);
  const b = el.querySelector('b');
  return {
    show() { el.style.display = ''; },
    hide() { el.style.display = 'none'; },
    set(n, total) { b.textContent = `${n} / ${total}`; },
    dispose() { el.remove(); },
  };
}

export function createBatwing({ scene, camera, hero, follow, collision, events, hudRoot }) {
  const rng = createRng(747711);
  const { mesh, engines } = buildBatwingMesh();
  scene.add(mesh);
  const hud = createArmadaHud(hudRoot);

  const state = createWingState();
  const scratch = { x: 0, y: 0, z: 0 };
  const fwd = new THREE.Vector3();
  const boardFrom = new THREE.Vector3(), boardTo = new THREE.Vector3();

  const dartPool = [];
  for (let i = 0; i < DART_POOL; i++) {
    dartPool.push({ mesh: buildDartMesh(), t: 0, live: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 });
  }
  for (const d of dartPool) scene.add(d.mesh);

  const armada = { active: false, balloons: [], meshes: [], region: null, total: 0, onDone: null };

  let active = false;
  let mode = 'idle'; // idle | boarding | flying | flyoff
  let boardT = 0, flyoffT = 0;

  function canCall() {
    if (active || mode !== 'idle' || hero.control) return false;
    if (window.__game?.interiors?.inside) return false;
    if (hero.state === 'glide') return true;
    // "On a roof": elevated above street level and standing.
    return hero.state === 'ground' && hero.pos.y > 5;
  }

  function boardingControl() {
    return {
      name: 'boarding',
      update(dt) {
        boardT += dt;
        const k = Math.min(1, boardT / BOARD_DUR);
        const e = k * k * (3 - 2 * k);
        mesh.position.lerpVectors(boardFrom, boardTo, e);
        mesh.lookAt(hero.pos.x, mesh.position.y, hero.pos.z);
        if (k < 1) return false;
        state.x = mesh.position.x; state.y = mesh.position.y; state.z = mesh.position.z;
        state.yaw = hero.bat.yaw; state.pitch = 0; state.roll = 0;
        state.speed = WING_TUNING.cruiseSpeed * 0.6;
        hero.bat.root.visible = false;
        hero.cape.mesh.visible = false;
        active = true;
        mode = 'flying';
        hero.control = flyControl();
        events.emit('wingEnter');
        return true;
      },
    };
  }

  function flyControl() {
    return {
      name: 'fly',
      camera: 'fly',
      update(dt, ctx) {
        const { input } = ctx;
        const invert = ctx.cam?.state?.invertY ? -1 : 1;
        const pitchIn = input.move.y * invert + (-input.look.dy * 0.0007 * invert);
        const rollIn = input.move.x + input.look.dx * 0.001;
        const boost = input.down('sprint'), brake = input.down('jump');
        stepWing(state, { pitchIn, rollIn, boost, brake }, dt);
        clampToWorld(state, WORLD, dt);

        scratch.x = state.x; scratch.y = state.y; scratch.z = state.z;
        const preX = scratch.x, preZ = scratch.z;
        const r = collision.resolveCylinder(scratch, WING_RADIUS, WING_HEIGHT, { prevY: state.y });
        if (r.hitWall) {
          const nx = scratch.x - preX, nz = scratch.z - preZ;
          const len = Math.hypot(nx, nz) || 1;
          bounceWing(state, nx / len, nz / len);
          follow.addShake(7);
        } else {
          state.x = scratch.x; state.y = scratch.y; state.z = scratch.z;
        }

        mesh.position.set(state.x, state.y, state.z);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.y = state.yaw;
        mesh.rotation.x = -state.pitch;
        mesh.rotation.z = -state.roll;
        follow.setBank?.(-state.roll * 0.55);
        hero.pos.copy(mesh.position);

        if (input.pressed('punch')) fireDart();
        updateDarts(dt);
        if (armada.active) updateArmada(dt);

        const gp = SITES.signal;
        if (r.grounded && Math.hypot(state.x - gp.x, state.z - gp.z) < LAND_RADIUS) { doExit(); return true; }
        return false;
      },
    };
  }

  function fireDart() {
    const d = dartPool.find((p) => !p.live);
    if (!d) return;
    mesh.getWorldDirection(fwd);
    d.live = true; d.t = 0;
    d.x = mesh.position.x + fwd.x * 2.6; d.y = mesh.position.y + 0.2; d.z = mesh.position.z + fwd.z * 2.6;
    d.vx = fwd.x * DART_SPEED; d.vy = fwd.y * DART_SPEED; d.vz = fwd.z * DART_SPEED;
    d.mesh.visible = true;
    d.mesh.position.set(d.x, d.y, d.z);
    d.mesh.lookAt(d.x + fwd.x, d.y + fwd.y, d.z + fwd.z);
  }

  function updateDarts(dt) {
    for (const d of dartPool) {
      if (!d.live) continue;
      d.t += dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.mesh.position.set(d.x, d.y, d.z);
      const hit = armada.active && popArmadaNear(armada.balloons, d.x, d.y, d.z, DART_POP_RADIUS) > 0;
      if (hit || d.t > DART_LIFE) { d.live = false; d.mesh.visible = false; }
    }
  }

  function updateArmada(dt) {
    driftArmada(armada.balloons, dt, armada.region);
    popArmadaNear(armada.balloons, state.x, state.y, state.z, PLANE_POP_RADIUS);
    for (const b of armada.balloons) {
      const vm = armada.meshes[b.id];
      if (!vm) continue;
      if (b.popped) { if (vm.visible) vm.visible = false; continue; }
      vm.position.set(b.x, b.y, b.z);
    }
    hud.set(armadaPoppedCount(armada.balloons), armada.total);
    if (armadaAllPopped(armada.balloons)) {
      armada.active = false;
      hud.hide();
      events.emit('armadaDone', { ok: true });
      armada.onDone?.({ ok: true });
    }
  }

  function doExit() {
    events.emit('wingExit');
    hero.pos.copy(mesh.position);
    hero.bat.root.visible = true;
    hero.cape.mesh.visible = true;
    hero.bat.face(state.yaw);
    hero.grounded = false;
    const spd = Math.min(40, Math.max(18, state.speed));
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    hero.vel.set(Math.sin(state.yaw) * cp * spd, sp * spd, Math.cos(state.yaw) * cp * spd);
    hero.control = null;
    hero.startGlide();
    active = false;
    mode = 'flyoff';
    flyoffT = 0;
  }

  function updateFlyoff(dt) {
    flyoffT += dt;
    stepWing(state, { pitchIn: 0.5, rollIn: 0, boost: true, brake: false }, dt);
    mesh.position.set(state.x, state.y, state.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = state.yaw;
    mesh.rotation.x = -state.pitch;
    mesh.rotation.z = -state.roll;
    if (flyoffT > FLYOFF_DUR) { mesh.visible = false; mode = 'idle'; }
  }

  return {
    get active() { return active; },
    call() {
      if (!canCall()) return false;
      mesh.visible = true;
      boardT = 0;
      const yaw = hero.bat.yaw;
      boardFrom.set(hero.pos.x - Math.sin(yaw) * 20 + 45, hero.pos.y + 60, hero.pos.z - Math.cos(yaw) * 20 - 45);
      boardTo.set(hero.pos.x + Math.sin(yaw) * 4.4, hero.pos.y + 1.4, hero.pos.z + Math.cos(yaw) * 4.4);
      mesh.position.copy(boardFrom);
      mesh.lookAt(boardTo);
      hero.control = boardingControl();
      return true;
    },
    exit() {
      if (!active) return false;
      doExit();
      return true;
    },
    update(dt) {
      const pulse = 0.75 + Math.sin(performance.now() * 0.006) * 0.25;
      for (const e of engines) e.scale.setScalar(pulse);
      if (mode === 'flyoff') updateFlyoff(dt);
    },
    // startArmada({ balloons, onDone }): balloons is the count to spawn (the story contract).
    startArmada({ balloons = 12, onDone } = {}) {
      mesh.getWorldDirection(fwd);
      const region = {
        cx: mesh.position.x + fwd.x * 70,
        cy: Math.min(WING_TUNING.ceiling - 25, Math.max(30, mesh.position.y)),
        cz: mesh.position.z + fwd.z * 70,
        rx: 55, ry: 20, rz: 55,
      };
      for (const m of armada.meshes) scene.remove(m);
      const data = makeArmadaBalloons(rng, balloons, region);
      armada.meshes = data.map((b) => {
        const m = buildBalloonMesh(b.kind);
        m.position.set(b.x, b.y, b.z);
        scene.add(m);
        return m;
      });
      armada.balloons = data;
      armada.region = region;
      armada.total = balloons;
      armada.onDone = onDone ?? null;
      armada.active = true;
      hud.set(0, balloons);
      hud.show();
    },
    // Dev/QA fast path (scripts/playthrough.mjs): pops every balloon at once and lets the normal
    // completion check in updateArmada fire armadaDone and onDone, the same as a real playthrough.
    debugWin() {
      if (!armada.active) return false;
      for (const b of armada.balloons) b.popped = true;
      updateArmada(0);
      return true;
    },
  };
}
