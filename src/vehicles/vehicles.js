// Ground vehicles: the Batmobile, street cars you can commandeer, a Joker chase van and drone
// tanks for the Ace Chemicals battle. Contract (docs/superpowers/specs/2026-09-30-birthday-night
// -design.md): createVehicles(deps) -> { summon, enter, exit, active, update, startChase,
// startBattle }. Events: vehicleEnter{kind}, vehicleExit{kind}, chaseDone{ok}, battleDone{ok}.
// The hero's control name while driving is 'drive'.
import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { WORLD } from '../world/mapData.js';
import { stepDrive, driveVelocity, bounceOffWall, createRamCounter, mergeTuning } from './vehiclePhysics.js';
import { createBatmobile, createStreetCar, createJokerVan, createDroneTank, createTracer, createShell } from './vehicleModels.js';

// The same street centrelines cityLife.js drives its ambient traffic on (60 m block grid, 14 m
// wide streets): known-safe points to spawn a stationary car on. Duplicated here on purpose: the
// city's own rng (ctx.rng in cityBuilder) must never be redrawn from, so street cars use their
// own seeded rng instead (see the module rule below).
const LINES = [-210, -150, -90, -30, 30, 90, 150, 210];
const CAR_COLORS = [0x6d2f2f, 0x2f3f5a, 0x39473a, 0x5a5146, 0x1e2026, 0x7a6a44];

const BATMOBILE_TUNING = mergeTuning({});
const STREET_CAR_TUNING = mergeTuning({
  accel: 9, boostAccel: 12, brakeDecel: 14, maxSpeed: 17, maxBoostSpeed: 21, maxReverse: 7,
  turnRate: 1.7, driftAmount: 0.5, driftTurnMul: 1.25, wallRestitution: 0.2,
});
const JOKER_TUNING = mergeTuning({ maxSpeed: 15, accel: 7 });

const RAM_MIN_SPEED = 4.5;    // m/s: below this, touching a goon or a car is just a nudge
const ENTER_RANGE = 4;        // meters
const CANNON_RANGE = 34;
const CANNON_HALF_WIDTH = 2.2;
const WHEEL_RADIUS = 0.46;
const MAX_STEER = 0.55;       // radians, front wheel visual steer cap

function tinyToast(hudRoot) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);'
    + 'max-width:min(560px,80vw);padding:10px 18px;background:#fffdf5;border:3px solid #0b0b12;'
    + 'box-shadow:3px 3px 0 #0b0b12;color:#0b0b12;font:20px "Patrick Hand SC",cursive;text-align:center;'
    + 'opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:20;';
  hudRoot.appendChild(el);
  let timer = null;
  return {
    show(text, ms = 3200) {
      el.textContent = text;
      el.style.opacity = '1';
      clearTimeout(timer);
      timer = setTimeout(() => { el.style.opacity = '0'; }, ms);
    },
  };
}

// A small ink-styled meter for the chase and battle set pieces (its own DOM, so Part V1 never
// has to touch src/ui/hud.js or style.css).
function missionMeter(hudRoot) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:50%;top:86px;transform:translateX(-50%);'
    + 'padding:8px 22px;background:#fffdf5;border:3px solid #0b0b12;box-shadow:3px 3px 0 #0b0b12;'
    + 'color:#0b0b12;font:26px Bangers,cursive;letter-spacing:1px;text-align:center;display:none;z-index:20;';
  hudRoot.appendChild(el);
  return {
    show(text) { el.textContent = text; el.style.display = ''; },
    set(text) { el.textContent = text; },
    hide() { el.style.display = 'none'; },
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createVehicles(deps) {
  const { scene, collision, hero, events, input, follow, combat, fx, hudRoot } = deps;
  const rng = createRng(7331); // own rng: never draws from ctx.rng (the city's seed)

  const toast = tinyToast(hudRoot);
  const meter = missionMeter(hudRoot);

  // ---- scratch (no per-frame allocation) ----
  const velScratch = { x: 0, z: 0 };
  const wallVel = { x: 0, z: 0 };
  const tracerA = new THREE.Vector3(), tracerB = new THREE.Vector3();

  let active = null;      // the instance currently being driven, or null
  let lastSteer = 0;      // this frame's steer input, for the driven car's front-wheel visual

  // ---------------- the Batmobile ----------------
  const bm = createBatmobile();
  bm.group.visible = false;
  bm.kind = 'batmobile';
  bm.v = { speed: 0, yaw: 0, drift: 0 };
  bm.tuning = BATMOBILE_TUNING;
  bm.summoned = false;
  bm.arriving = null; // set while summon() is sliding it in; see updateSummonArrival
  scene.add(bm.group);

  // ---------------- street cars (commandeerable) ----------------
  const streetCars = [];
  function spawnStreetCars(count = 12) {
    for (let i = 0; i < count; i++) {
      const alongX = rng.chance(0.5);
      const line = rng.pick(LINES);
      const dir = rng.chance(0.5) ? 1 : -1;
      const lane = 3.4 * dir;
      const min = alongX ? WORLD.minX + 20 : WORLD.minZ + 20;
      const max = alongX ? WORLD.maxX - 20 : WORLD.waterZ - 30;
      const t = rng.range(min, max);
      const x = alongX ? t : line + lane;
      const z = alongX ? line - lane : t;
      const kind = rng.chance(0.25) ? 'van' : 'sedan';
      const car = createStreetCar(rng.pick(CAR_COLORS), kind);
      car.kind = 'car';
      // forward = (sin(yaw), cos(yaw)): along x needs yaw = +-90deg, along z needs yaw = 0 or 180.
      car.v = { speed: 0, yaw: alongX ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), drift: 0 };
      car.tuning = STREET_CAR_TUNING;
      const groundY = collision.groundBelow(x, 2, z, 0.3);
      car.group.position.set(x, groundY > -Infinity ? groundY : 0, z);
      car.group.rotation.y = car.v.yaw;
      car.borrowed = false;
      scene.add(car.group);
      streetCars.push(car);
    }
  }
  spawnStreetCars(12);

  function enterables() { return [bm, ...streetCars]; }

  // ---------------- nearest street point (for summoning near Batman) ----------------
  // Picks whichever grid line (an x-street or a z-street) is closest to `near` and returns a
  // point `dist` meters along it from `near` (clamped inside the world). Called twice per summon
  // with two different distances, so both points always land on the same street line.
  function nearestStreetSpawn(near, dist) {
    let best = null, bestD = Infinity;
    for (const line of LINES) {
      const dx = Math.abs(near.x - line);
      if (dx < bestD) { bestD = dx; best = { alongX: false, line }; }
      const dz = Math.abs(near.z - line);
      if (dz < bestD) { bestD = dz; best = { alongX: true, line }; }
    }
    if (best.alongX) return { x: clamp(near.x - dist, WORLD.minX + 5, WORLD.maxX - 5), z: best.line };
    return { x: best.line, z: clamp(near.z - dist, WORLD.minZ + 5, WORLD.waterZ - 10) };
  }

  const SUMMON_FAR = 8;   // meters: where the Batmobile first appears, out of Batman's way
  const SUMMON_NEAR = 2.6; // meters: where it parks, safely inside ENTER_RANGE
  const SUMMON_DUR = 0.85; // seconds: the slide-in

  // ---------------- summon / enter / exit ----------------
  // Appears on a real street point 6 to 10 m from Batman, facing along the street toward him,
  // then slides in over SUMMON_DUR and parks a few meters away (inside ENTER_RANGE) with a
  // screech. { instant: true } (used by startBattle, so it can chain straight into enter()) skips
  // the slide and places it parked immediately.
  function summon(kind = 'batmobile', { instant = false } = {}) {
    if (kind !== 'batmobile') return; // only the Batmobile is summonable; street cars are found, not called
    if (bm.arriving) return; // already on the way
    const spot = nearestStreetSpawn(hero.pos, SUMMON_FAR);
    const park = nearestStreetSpawn(hero.pos, SUMMON_NEAR);
    const yaw = Math.atan2(park.x - spot.x, park.z - spot.z);
    bm.v.speed = 0; bm.v.drift = 0; bm.v.yaw = yaw;
    bm.group.rotation.y = yaw;
    bm.group.visible = true;
    bm.summoned = true;
    if (instant) {
      const groundY = collision.groundBelow(park.x, hero.pos.y + 4, park.z, 0.3);
      bm.group.position.set(park.x, groundY > -Infinity ? groundY : hero.pos.y, park.z);
      events.emit('word', { text: 'SCREEECH!', pos: bm.group.position.clone().setY(bm.group.position.y + 1), big: true });
      toast.show('The Batmobile screeches in.', 2200);
      return;
    }
    const groundY = collision.groundBelow(spot.x, hero.pos.y + 4, spot.z, 0.3);
    bm.group.position.set(spot.x, groundY > -Infinity ? groundY : hero.pos.y, spot.z);
    bm.arriving = { t: 0, dur: SUMMON_DUR, fromX: spot.x, fromZ: spot.z, toX: park.x, toZ: park.z, yaw };
    toast.show('The Batmobile is on its way.', 2200);
  }

  // Slides the Batmobile from its summon point to its park point while summon() is arriving:
  // called every frame from update() instead of integrateVehicle (it has its own, scripted move).
  function updateSummonArrival(dt) {
    const a = bm.arriving;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const e = k * k * (3 - 2 * k); // smoothstep
    bm.group.position.x = a.fromX + (a.toX - a.fromX) * e;
    bm.group.position.z = a.fromZ + (a.toZ - a.fromZ) * e;
    const groundY = collision.groundBelow(bm.group.position.x, bm.group.position.y + 2, bm.group.position.z, 0.4);
    if (groundY > -Infinity) bm.group.position.y = groundY;
    bm.group.rotation.y = a.yaw;
    const dist = Math.hypot(a.toX - a.fromX, a.toZ - a.fromZ);
    const roll = (dist / a.dur / WHEEL_RADIUS) * dt;
    for (const w of bm.wheels) w.spin.rotation.x -= roll;
    if (k >= 1) {
      bm.arriving = null;
      events.emit('word', { text: 'SCREEECH!', pos: bm.group.position.clone().setY(bm.group.position.y + 1), big: true });
    }
  }

  function enter(v) {
    if (!v || active || !v.group.visible || v.arriving) return;
    active = v;
    v.driven = true;
    lastSteer = 0;
    hero.control = { name: 'drive', camera: 'drive', update: () => false };
    hero.bat.root.visible = false;
    hero.cape.mesh.visible = false;
    hero.vel.set(0, 0, 0);
    if (v.kind === 'car') toast.show('Borrowed for the birthday. Gordon will explain.', 3200);
    events.emit('vehicleEnter', { kind: v.kind });
  }

  function exit() {
    if (!active) return;
    const v = active;
    const fx2 = -Math.cos(v.v.yaw), fz2 = Math.sin(v.v.yaw); // right vector of the car
    const ex = v.group.position.x + fx2 * (v.radius + 1.4);
    const ez = v.group.position.z + fz2 * (v.radius + 1.4);
    const groundY = collision.groundBelow(ex, v.group.position.y + 3, ez, 0.3);
    hero.bat.root.visible = true;
    hero.cape.mesh.visible = true;
    hero.control = null;
    hero.teleport({ x: ex, y: groundY > -Infinity ? groundY : v.group.position.y, z: ez }, v.v.yaw);
    v.driven = false;
    if (v.kind === 'car') v.borrowed = true;
    events.emit('vehicleExit', { kind: v.kind });
    active = null;
  }

  // Ejects Batman up and out of the car into a glide (only while moving fast). Reuses the hero's
  // own glide entry (hero.js's startGlide reads velocity to set the glide heading and speed).
  function eject() {
    if (!active) return;
    const v = active;
    const speed = Math.abs(v.v.speed);
    if (speed < 10) { exit(); return; }
    const fxh = Math.sin(v.v.yaw), fzh = Math.cos(v.v.yaw);
    const upY = v.group.position.y + 1.6;
    hero.bat.root.visible = true;
    hero.cape.mesh.visible = true;
    hero.control = null;
    hero.pos.set(v.group.position.x, upY, v.group.position.z);
    hero.vel.set(fxh * speed * 0.6, 12, fzh * speed * 0.6);
    hero.grounded = false;
    hero.setState('air');
    hero.airT = 0.25;
    hero.bat.face(v.v.yaw);
    hero.startGlide();
    v.driven = false;
    if (v.kind === 'car') v.borrowed = true;
    events.emit('vehicleExit', { kind: v.kind });
    active = null;
  }

  // ---------------- one vehicle's physics step ----------------
  function integrateVehicle(inst, input2, dt) {
    stepDrive(inst.v, input2, dt, inst.tuning);
    driveVelocity(inst.v, inst.tuning, velScratch);
    const pos = inst.group.position;
    const beforeX = pos.x, beforeZ = pos.z;
    pos.x += velScratch.x * dt;
    pos.z += velScratch.z * dt;
    const r = collision.resolveCylinder(pos, inst.radius, 1.6, { prevY: pos.y });
    if (r.hitWall) {
      const pushX = pos.x - (beforeX + velScratch.x * dt), pushZ = pos.z - (beforeZ + velScratch.z * dt);
      const pl = Math.hypot(pushX, pushZ);
      if (pl > 1e-5) {
        const nx = pushX / pl, nz = pushZ / pl;
        wallVel.x = velScratch.x; wallVel.z = velScratch.z;
        bounceOffWall(wallVel, nx, nz, inst.tuning.wallRestitution);
        const fxh = Math.sin(inst.v.yaw), fzh = Math.cos(inst.v.yaw), rxh = -Math.cos(inst.v.yaw), rzh = Math.sin(inst.v.yaw);
        inst.v.speed = wallVel.x * fxh + wallVel.z * fzh;
        const speedMag = Math.max(0.01, Math.abs(inst.v.speed));
        inst.v.drift = clamp((wallVel.x * rxh + wallVel.z * rzh) / (speedMag * inst.tuning.driftLateralMul), -1, 1);
      }
    }
    const groundY = collision.groundBelow(pos.x, pos.y + 0.6, pos.z, 0.4);
    if (groundY > -Infinity) pos.y = groundY;
    pos.x = clamp(pos.x, WORLD.minX + 3, WORLD.maxX - 3);
    pos.z = clamp(pos.z, WORLD.minZ + 3, WORLD.waterZ - 3);
    inst.group.rotation.y = inst.v.yaw;
    if (inst.wheels) {
      const steer = clamp((inst === active ? lastSteer : 0) * MAX_STEER, -MAX_STEER, MAX_STEER);
      const roll = (inst.v.speed / WHEEL_RADIUS) * dt;
      for (const w of inst.wheels) {
        if (w.front) w.pivot.rotation.y = steer;
        w.spin.rotation.x -= roll;
      }
    }
  }

  const NEUTRAL_INPUT = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };

  // ---------------- ramming ----------------
  function ramGoons(inst) {
    if (Math.abs(inst.v.speed) < RAM_MIN_SPEED || !combat) return;
    const pos = inst.group.position;
    for (const e of combat.enemies) {
      if (!e.alive || e.down || e.air) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z;
      if (Math.abs(e.pos.y - pos.y) > 2.5) continue;
      const d = Math.hypot(dx, dz);
      if (d < inst.radius + e.radius + 0.4) {
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        e.launch?.(nx * 3, 4, nz * 3);
        e.applyHit?.({ outcome: 'knockdown', damage: 0, stun: 0 }, pos, { power: 1, launch: 4 });
        fx?.impact(e.pos.clone(), 0.9);
      }
    }
  }

  // One potential ram target: no allocation, so the two call sites below can run every frame
  // without building a temporary list.
  function tryRamOther(inst, other, dt) {
    if (!other || other === inst || other.driven) return;
    other.ramCd = Math.max(0, (other.ramCd ?? 0) - dt);
    const pos = inst.group.position;
    const dx = other.group.position.x - pos.x, dz = other.group.position.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < inst.radius + other.radius + 0.3 && other.ramCd <= 0) {
      const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
      other.v.yaw = Math.atan2(nx, nz);
      other.v.speed = Math.min(other.tuning.maxSpeed * 0.6, Math.abs(inst.v.speed) * 0.5 + 3);
      other.v.drift = 0;
      other.ramCd = 0.6;
      if (chase?.active && other === chase.van && chase.ramCounter.ram()) {
        fx?.impact(other.group.position.clone(), 1.1);
        events.emit('word', { text: 'KRUNCH!', pos: other.group.position.clone().setY(other.group.position.y + 1.2), big: true });
        meter.set(`CHASE  ${chase.ramCounter.hits}/${chase.hitsNeeded}`);
        if (chase.ramCounter.done) endChase(true);
      }
    }
  }
  function ramVehicles(inst, dt) {
    if (Math.abs(inst.v.speed) < RAM_MIN_SPEED) return;
    for (const other of streetCars) tryRamOther(inst, other, dt);
    if (chase?.active) tryRamOther(inst, chase.van, dt);
  }

  // ---------------- the Joker chase ----------------
  let chase = null;
  function startChase({ path, onDone } = {}) {
    if (!Array.isArray(path) || path.length < 2) {
      console.warn('startChase: needs at least two path points; skipping the chase.');
      onDone?.({ ok: false });
      return;
    }
    const van = createJokerVan();
    van.kind = 'jokerVan';
    van.radius = 1.9;
    // Face the second path point from the start, not a fixed yaw: otherwise a path that doesn't
    // happen to run toward +z has the van pull away and turn around before it even gets moving.
    const startYaw = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
    van.v = { speed: JOKER_TUNING.maxSpeed * 0.7, yaw: startYaw, drift: 0 };
    van.tuning = JOKER_TUNING;
    const groundY0 = collision.groundBelow(path[0].x, 3, path[0].z, 0.3);
    van.group.position.set(path[0].x, groundY0 > -Infinity ? groundY0 : 0, path[0].z);
    van.group.rotation.y = startYaw;
    scene.add(van.group);
    chase = { van, path, idx: 1, onDone, active: true, ramCounter: createRamCounter(3, 0.6), hitsNeeded: 3, t: 0 };
    meter.show('CHASE  0/3');
    toast.show('Stop the Joker\'s van. Ram it three times!', 3200);
  }
  function endChase(ok) {
    if (!chase) return;
    scene.remove(chase.van.group);
    meter.hide();
    events.emit('chaseDone', { ok });
    chase.onDone?.({ ok });
    chase.active = false;
    chase = null;
  }
  function updateChase(dt) {
    if (!chase?.active) return;
    chase.t += dt;
    if (chase.t > 90) { endChase(false); return; } // a safety timeout so a missed chase can't hang the story
    const van = chase.van, path = chase.path;
    const target = path[chase.idx];
    const dx = target.x - van.group.position.x, dz = target.z - van.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) chase.idx = (chase.idx + 1) % path.length;
    else {
      const wantYaw = Math.atan2(dx, dz);
      const delta = Math.atan2(Math.sin(wantYaw - van.v.yaw), Math.cos(wantYaw - van.v.yaw));
      van.v.yaw += clamp(delta, -1, 1) * Math.min(1, dt * 3);
    }
    driveVelocity(van.v, van.tuning, velScratch);
    van.group.position.x += velScratch.x * dt;
    van.group.position.z += velScratch.z * dt;
    const groundY = collision.groundBelow(van.group.position.x, van.group.position.y + 2, van.group.position.z, 0.4);
    if (groundY > -Infinity) van.group.position.y = groundY;
    van.group.rotation.y = van.v.yaw;
    if (van.beacon) van.beacon.rotation.y += dt * 6;
    chase.ramCounter.update(dt);
  }

  // ---------------- the Ace Chemicals battle ----------------
  let battle = null;
  function startBattle({ site, drones, onDone } = {}) {
    if (!site) { console.warn('startBattle: no site given; skipping the battle.'); onDone?.({ ok: false }); return; }
    if (!active || active.kind !== 'batmobile') {
      if (!bm.summoned || !bm.group.visible) { hero.teleport(site); summon('batmobile', { instant: true }); }
      enter(bm);
    }
    const count = Array.isArray(drones) ? drones.length : (drones ?? 3);
    const list = [];
    for (let i = 0; i < count; i++) {
      const spec = Array.isArray(drones) ? drones[i] : null;
      const tank = createDroneTank();
      const angle = (i / count) * Math.PI * 2;
      const x = spec?.x ?? site.x + Math.cos(angle) * 10;
      const z = spec?.z ?? site.z + Math.sin(angle) * 10;
      const groundY = collision.groundBelow(x, site.y + 3, z, 0.3);
      tank.group.position.set(x, groundY > -Infinity ? groundY : site.y, z);
      tank.fireT = 1.5 + rng.range(0, 2);
      tank.shells = [];
      scene.add(tank.group);
      list.push(tank);
    }
    battle = { site, drones: list, onDone, active: true, tracer: createTracer(), cannonCdT: 0 };
    scene.add(battle.tracer);
    meter.show(`DRONES  ${list.length}`);
    toast.show('Shock cannon: PUNCH to fire from the Batmobile.', 3200);
  }
  function endBattle(ok) {
    if (!battle) return;
    for (const d of battle.drones) { scene.remove(d.group); for (const s of d.shells) scene.remove(s); }
    scene.remove(battle.tracer);
    meter.hide();
    events.emit('battleDone', { ok });
    battle.onDone?.({ ok });
    battle.active = false;
    battle = null;
  }
  function fireCannon() {
    if (!battle?.active || active !== bm || battle.cannonCdT > 0) return;
    battle.cannonCdT = 0.35;
    const yaw = bm.v.yaw;
    const fxh = Math.sin(yaw), fzh = Math.cos(yaw);
    const ox = bm.group.position.x + fxh * 2.6, oz = bm.group.position.z + fzh * 2.6;
    let hitDrone = null, hitDist = CANNON_RANGE;
    for (const d of battle.drones) {
      if (d.dead) continue;
      const dx = d.group.position.x - ox, dz = d.group.position.z - oz;
      const forward = dx * fxh + dz * fzh;
      const lateralDist = Math.abs(-dx * fzh + dz * fxh);
      if (forward > 0 && forward < CANNON_RANGE && lateralDist < CANNON_HALF_WIDTH && forward < hitDist) { hitDist = forward; hitDrone = d; }
    }
    tracerA.set(ox, bm.group.position.y + 0.65, oz);
    tracerB.set(ox + fxh * hitDist, bm.group.position.y + 0.65, oz + fzh * hitDist);
    const posAttr = battle.tracer.geometry.attributes.position;
    posAttr.setXYZ(0, tracerA.x, tracerA.y, tracerA.z);
    posAttr.setXYZ(1, tracerB.x, tracerB.y, tracerB.z);
    posAttr.needsUpdate = true;
    battle.tracer.visible = true;
    battle.tracer.userData.fadeT = 0.14;
    if (hitDrone) {
      hitDrone.health -= 1;
      fx?.impact(hitDrone.group.position.clone().setY(hitDrone.group.position.y + 0.8), 1.1);
      events.emit('word', { text: 'BAZZAP!', pos: hitDrone.group.position.clone().setY(hitDrone.group.position.y + 1.4), big: true });
      if (hitDrone.health <= 0 && !hitDrone.dead) {
        hitDrone.dead = true;
        hitDrone.group.visible = false;
        const remaining = battle.drones.filter((d) => !d.dead).length;
        meter.set(`DRONES  ${remaining}`);
        if (remaining <= 0) endBattle(true);
      }
    }
  }
  function updateBattle(dt) {
    if (!battle?.active) return;
    battle.cannonCdT = Math.max(0, battle.cannonCdT - dt);
    if (battle.tracer.visible) {
      battle.tracer.userData.fadeT -= dt;
      battle.tracer.material.opacity = Math.max(0, battle.tracer.userData.fadeT / 0.14) * 0.95;
      if (battle.tracer.userData.fadeT <= 0) battle.tracer.visible = false;
    }
    const targetPos = active ? active.group.position : bm.group.position;
    for (const d of battle.drones) {
      if (d.dead) continue;
      const dx = targetPos.x - d.group.position.x, dz = targetPos.z - d.group.position.z;
      const worldAngle = Math.atan2(dx, dz);
      d.turretPivot.rotation.y = worldAngle;
      d.fireT -= dt;
      if (d.fireT <= 0) {
        d.fireT = 2.6 + rng.range(0, 2.2);
        const shell = createShell(0x8a2fbf);
        shell.position.set(d.group.position.x, d.group.position.y + 0.95, d.group.position.z);
        const dist = Math.hypot(dx, dz) || 1;
        shell.userData.vx = (dx / dist) * 9;
        shell.userData.vz = (dz / dist) * 9;
        shell.userData.life = 4;
        shell.visible = true;
        scene.add(shell);
        d.shells.push(shell);
      }
      for (let i = d.shells.length - 1; i >= 0; i--) {
        const s = d.shells[i];
        s.position.x += s.userData.vx * dt;
        s.position.z += s.userData.vz * dt;
        s.userData.life -= dt;
        const hitDx = s.position.x - targetPos.x, hitDz = s.position.z - targetPos.z;
        const hit = Math.hypot(hitDx, hitDz) < 2.3;
        if (hit || s.userData.life <= 0) {
          if (hit) follow.addShake?.(4);
          scene.remove(s);
          d.shells.splice(i, 1);
        }
      }
    }
  }

  // ---------------- per-frame driving key + input ----------------
  function handleVehicleKey() {
    if (active) { exit(); return; }
    let nearest = null, nearestD = ENTER_RANGE;
    for (const v of enterables()) {
      if (v.driven || v.arriving || !v.group.visible) continue;
      const d = Math.hypot(hero.pos.x - v.group.position.x, hero.pos.z - v.group.position.z);
      if (d < nearestD) { nearestD = d; nearest = v; }
    }
    if (nearest) enter(nearest);
    else summon('batmobile');
  }

  // ---------------- the frame update (called from game.js's vehicles hook) ----------------
  const EJECT_MIN_SPEED = 14;  // m/s: below this, jump just handbrakes, it never ejects
  const EJECT_TAP_WINDOW = 0.22; // seconds: jump held longer than this is a drift, not an eject tap
  let jumpHeldT = 0;

  function update(dt, real = dt) {
    if (input.pressed('vehicle')) handleVehicleKey();
    if (active) {
      // Space (jump) does double duty while driving, same as it does gliding: held, it's the
      // handbrake for a drift; a quick tap of it (released again inside EJECT_TAP_WINDOW) while
      // already moving fast ejects Batman up into a glide instead. Checked against the timer
      // BEFORE this frame updates it, so a held key (mid-drift) never fires the eject on release.
      if (input.released('jump') && jumpHeldT > 0 && jumpHeldT <= EJECT_TAP_WINDOW && Math.abs(active.v.speed) >= EJECT_MIN_SPEED) eject();
      jumpHeldT = input.down('jump') ? jumpHeldT + dt : 0;
    } else jumpHeldT = 0;
    if (active) {
      const steer = input.move.x;
      lastSteer = steer;
      const driveInput = {
        throttle: Math.max(0, input.move.y),
        brake: Math.max(0, -input.move.y),
        steer,
        handbrake: input.down('jump'),
        boost: input.down('sprint'),
      };
      if (active.kind === 'batmobile') bm.setBoost(driveInput.boost && driveInput.throttle > 0);
      integrateVehicle(active, driveInput, dt);
      hero.pos.copy(active.group.position);
      hero.speed = Math.abs(active.v.speed);
      ramGoons(active);
      ramVehicles(active, dt);
      if (battle?.active && active === bm && input.pressed('punch')) fireCannon();
    }
    if (bm.arriving) updateSummonArrival(dt);
    else if (bm !== active) integrateVehicle(bm, NEUTRAL_INPUT, dt);
    for (const v of streetCars) if (v !== active) integrateVehicle(v, NEUTRAL_INPUT, dt);
    updateChase(dt);
    updateBattle(dt);
  }

  return {
    summon, enter, exit, eject,
    get active() { return active; },
    update,
    startChase, startBattle,
    // Dev/story helpers, not part of the frozen contract above.
    get batmobile() { return bm; },
    get streetCars() { return streetCars; },
    get chase() { return chase; },
    get battle() { return battle; },
  };
}
