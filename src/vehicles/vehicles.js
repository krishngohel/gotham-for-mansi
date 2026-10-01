// Ground vehicles: the Batmobile, street cars you can commandeer, a Joker chase van and drone
// tanks for the Ace Chemicals battle. Contract (docs/superpowers/specs/2026-09-30-birthday-night
// -design.md): createVehicles(deps) -> { summon, enter, exit, active, update, startChase,
// startBattle, park }. Events: vehicleEnter{kind}, vehicleExit{kind}, chaseDone{ok}, battleDone{ok}.
// The hero's control name while driving is 'drive'.
// park(spot, opts): parks the Batmobile at an exact { x, y, z, yaw } (a story 'board' step's own
// site, src/game/story.js), unlike summon() which always places it relative to wherever Batman is
// currently standing. Added alongside the rest of this file's driving/physics work without
// touching it (see the note on park() itself).
import * as THREE from 'three';
import { createRng } from '../core/rng.js';
import { WORLD } from '../world/mapData.js';
import { stepDrive, driveVelocity, bounceOffWall, createRamCounter, mergeTuning, findClearGroundSpot, damageArmor, stepArmor, stepLane } from './vehiclePhysics.js';
import { createBatmobile, createStreetCar, createJokerVan, createDroneTank, createTracer, createShell } from './vehicleModels.js';

// The same street centrelines cityLife.js drives its ambient traffic on (60 m block grid, 14 m
// wide streets): known-safe points to spawn a stationary car on. Duplicated here on purpose: the
// city's own rng (ctx.rng in cityBuilder) must never be redrawn from, so street cars use their
// own seeded rng instead (see the module rule below).
export const LINES = [-210, -150, -90, -30, 30, 90, 150, 210];
const CAR_COLORS = [0x6d2f2f, 0x2f3f5a, 0x39473a, 0x5a5146, 0x1e2026, 0x7a6a44];

// ---------------- free-roam side van chase: route picking (pure) ----------------
// Picks a short there-and-back route along whichever real street line (see LINES above) is
// nearest `near`, a few hundred metres off in a random direction, and confirms every point on it
// is real, walkable-for-a-van ground (never inside a merged compound or off the world). Pure given
// an injected rng (createRng's shape: .chance/.range) and groundOk(x, z) predicate, so it's
// testable without a live scene or collision world. Exported for src/game/sideVanChase.js's tests.
export const SIDE_VAN_MIN = 110, SIDE_VAN_MAX = 320; // metres from `near`
export function pickSideVanRoute(near, rng, groundOk, bounds = WORLD, tries = 4) {
  let axisIsX = true, line = LINES[0], bestD = Infinity;
  for (const L of LINES) {
    const dx = Math.abs(near.x - L);
    if (dx < bestD) { bestD = dx; line = L; axisIsX = true; }
    const dz = Math.abs(near.z - L);
    if (dz < bestD) { bestD = dz; line = L; axisIsX = false; }
  }
  const span = SIDE_VAN_MAX - SIDE_VAN_MIN;
  for (let t = 0; t < tries; t++) {
    const dir = rng.chance(0.5) ? 1 : -1;
    const base = axisIsX ? near.z : near.x;
    const nearT = base + dir * (SIDE_VAN_MIN + rng.range(0, span * 0.5));
    const farT = base + dir * (SIDE_VAN_MIN + span * 0.5 + rng.range(0, span * 0.5));
    const lo = axisIsX ? bounds.minZ + 12 : bounds.minX + 12;
    const hi = axisIsX ? bounds.waterZ - 12 : bounds.maxX - 12;
    const clampT = (v) => Math.max(lo, Math.min(hi, v));
    const mk = (v) => (axisIsX ? { x: line, z: clampT(v) } : { x: clampT(v), z: line });
    const path = [mk(nearT), mk(farT), mk(nearT)];
    if (path.every((p) => groundOk(p.x, p.z))) return { path, spot: path[0] };
  }
  return null;
}

const BATMOBILE_TUNING = mergeTuning({});
const STREET_CAR_TUNING = mergeTuning({
  accel: 9, boostAccel: 12, brakeDecel: 14, maxSpeed: 17, maxBoostSpeed: 21, maxReverse: 7,
  turnRate: 1.7, driftAmount: 0.5, driftTurnMul: 1.25, wallRestitution: 0.2,
});
const JOKER_TUNING = mergeTuning({ maxSpeed: 15, accel: 7 });

const RAM_MIN_SPEED = 4.5;    // m/s: below this, touching a goon or a car is just a nudge
const ENTER_RANGE = 6;        // meters, from the car's centre (a car is about 4.5 m long)
// Her own car answers from farther: T near the parked Batmobile should always mean "get in",
// never "call it again" (which slid it over to her and made her press T twice).
const BATMOBILE_ENTER_RANGE = 10;
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

// A HUD-style armour bar for the drone battle, its own DOM (same self-contained approach as
// missionMeter and tinyToast above: Part V1 never touches src/ui/hud.js or style.css).
function armorBar(hudRoot) {
  const el = document.createElement('div');
  el.style.cssText = 'position:absolute;left:50%;top:130px;transform:translateX(-50%);'
    + 'width:min(360px,70vw);padding:7px 16px 9px;background:#fffdf5;border:3px solid #0b0b12;'
    + 'box-shadow:3px 3px 0 #0b0b12;display:none;z-index:20;';
  el.innerHTML = '<div style="font:16px Bangers,cursive;letter-spacing:1.5px;color:#0b0b12;margin-bottom:4px;">BATMOBILE ARMOUR</div>'
    + '<div style="height:13px;background:#d8cfa8;border:2px solid #0b0b12;">'
    + '<div class="fill" style="height:100%;width:100%;background:#c8323c;transition:width 0.12s linear;"></div></div>';
  hudRoot.appendChild(el);
  const fill = el.querySelector('.fill');
  return {
    show() { el.style.display = ''; },
    hide() { el.style.display = 'none'; },
    set(frac) {
      const f = Math.max(0, Math.min(1, frac));
      fill.style.width = `${f * 100}%`;
      fill.style.background = f < 0.3 ? '#7a1c1c' : '#c8323c';
    },
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createVehicles(deps) {
  const { scene, collision, hero, events, input, follow, combat, fx, hudRoot, audio } = deps;
  const rng = createRng(7331); // own rng: never draws from ctx.rng (the city's seed)

  const toast = tinyToast(hudRoot);
  const meter = missionMeter(hudRoot);
  const armorHud = armorBar(hudRoot);

  // ---- scratch (no per-frame allocation) ----
  const velScratch = { x: 0, z: 0 };
  const wallVel = { x: 0, z: 0 };
  const tracerA = new THREE.Vector3(), tracerB = new THREE.Vector3();

  let active = null;      // the instance currently being driven, or null
  let lastSteer = 0;      // this frame's steer input, for the driven car's front-wheel visual
  let wasBoosting = false; // last frame's boost state, so 'vehicleBoost' fires once per press

  // ---------------- the Batmobile ----------------
  const bm = createBatmobile();
  bm.group.visible = false;
  bm.kind = 'batmobile';
  bm.v = { speed: 0, yaw: 0, drift: 0 };
  bm.tuning = BATMOBILE_TUNING;
  bm.summoned = false;
  bm.arriving = null; // set while summon() is sliding it in; see updateSummonArrival
  bm.maxArmor = 100;
  bm.armor = { hp: bm.maxArmor, sinceHit: 999 }; // battle armour (src/vehicles/vehiclePhysics.js stepArmor)
  scene.add(bm.group);

  // ---------------- street cars (commandeerable, some of them moving traffic) ----------------
  const streetCars = [];
  // Perf audit (2026-09-30): each street car is ~17 unmerged draw calls (a real extruded body,
  // not city-bucket geometry), and from an elevated vantage several are in view at once. Eight
  // in all (down from 12), five of them moving traffic and the rest parked.
  const TRAFFIC_COUNT = 5;
  function spawnStreetCars(count = 8) {
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
      car.traffic = i < TRAFFIC_COUNT;
      car.knockT = 0; // >0 while a ram is carrying it off its lane; see updateTrafficCar
      if (car.traffic) car.lane = { alongX, line, dir, t, speed: rng.range(8, 11), stopT: 0 };
      scene.add(car.group);
      streetCars.push(car);
    }
  }
  spawnStreetCars();

  // One moving traffic car's frame step: cheap lane-following (stepLane, pure) instead of the
  // full drive-physics pipeline, and no allocation (car.lane and car.group.position are mutated
  // in place). Ramming it (tryRamOther) sets car.knockT, which switches it briefly onto the same
  // simple ballistic-ish slide integrateVehicle would give it, then it rejoins its lane.
  function updateTrafficCar(car, dt) {
    if (car.knockT > 0) {
      car.knockT -= dt;
      driveVelocity(car.v, car.tuning, velScratch);
      car.group.position.x += velScratch.x * dt;
      car.group.position.z += velScratch.z * dt;
      car.v.speed *= Math.max(0, 1 - dt * 1.5);
      car.group.rotation.y = car.v.yaw;
      if (car.knockT <= 0) {
        // Rejoin the lane from wherever the knock left it, instead of snapping back.
        car.lane.t = car.lane.alongX ? car.group.position.x : car.group.position.z;
        car.lane.stopT = 0;
      }
      return;
    }
    const lane = car.lane;
    stepLane(lane, dt, LINES, 1.1);
    // Streets are flat (world.js's floor is a constant 0 short of the waterline, which traffic
    // never reaches): no per-frame ground query needed here, just the one done once at spawn.
    car.group.position.x = lane.alongX ? lane.t : lane.line;
    car.group.position.z = lane.alongX ? lane.line : lane.t;
    const yaw = lane.alongX ? (lane.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane.dir > 0 ? 0 : Math.PI);
    car.v.yaw = yaw;
    car.v.speed = lane.stopT > 0 ? 0 : lane.speed;
    car.group.rotation.y = yaw;
  }

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
  // Above this straight-line distance, the nearest street line isn't actually near Batman (a big
  // open yard or plaza, mid-block): nearestStreetSpawn only ever checks one axis, so a spot on a
  // "nearest" line can still be tens of meters away across the other axis. Past this, fall back
  // to a clear-ground search centered on him instead.
  const STREET_SPOT_MAX = 14;
  const CLEAR_SPOT_RADII = [3, 4.5, 6, 8, 11, 15]; // meters, rings tried around Batman in the fallback

  // ---------------- summon / enter / exit ----------------
  // Appears on a real street point 6 to 10 m from Batman, facing along the street toward him,
  // then slides in over SUMMON_DUR and parks a few meters away (inside ENTER_RANGE) with a
  // screech. { instant: true } (used by startBattle, so it can chain straight into enter()) skips
  // the slide and places it parked immediately.
  // A spot's ground is real and the Batmobile's own footprint fits there without a wall pushing
  // it away: the collision-aware half of findClearGroundSpot's isClear(x, y, z) contract.
  function clearBatmobileSpot(x, y, z) {
    const gy = collision.groundBelow(x, y + 4, z, 0.3);
    if (gy <= -Infinity) return null;
    const probe = { x, y: gy, z };
    const r = collision.resolveCylinder(probe, bm.radius, 1.6, { prevY: gy });
    if (r.hitWall) return null;
    // resolveCylinder nudges an embedded cylinder out the nearest side; a big nudge means the
    // footprint didn't really fit at (x, z) at all, so this candidate isn't the clear spot it
    // looked like.
    if (Math.hypot(probe.x - x, probe.z - z) > 0.4) return null;
    return { x: probe.x, y: gy, z: probe.z };
  }

  function summon(kind = 'batmobile', { instant = false } = {}) {
    if (kind !== 'batmobile') return; // only the Batmobile is summonable; street cars are found, not called
    if (bm.arriving) return; // already on the way
    const spot = nearestStreetSpawn(hero.pos, SUMMON_FAR);
    const spotDist = Math.hypot(spot.x - hero.pos.x, spot.z - hero.pos.z);
    if (spotDist > STREET_SPOT_MAX) {
      // Batman is too far from any street line for a street-side summon to make sense (a big
      // open yard, a plaza, deep mid-block): find the nearest spot the car actually fits instead
      // of snapping to a street tile that could be tens of meters away across the block.
      const clear = findClearGroundSpot(hero.pos, clearBatmobileSpot, CLEAR_SPOT_RADII);
      if (!clear) { toast.show('No room for the Batmobile here.', 2500); return; }
      const yaw = hero.bat.yaw;
      bm.v.speed = 0; bm.v.drift = 0; bm.v.yaw = yaw;
      bm.group.rotation.y = yaw;
      bm.group.position.set(clear.x, clear.y, clear.z);
      bm.group.visible = true;
      bm.summoned = true;
      bm.arriving = null;
      events.emit('word', { text: 'SCREEECH!', pos: bm.group.position.clone().setY(clear.y + 1), big: true });
      toast.show('The Batmobile screeches in.', 2200);
      return;
    }
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

  // Parks the Batmobile at an exact spot (a story 'board' step's own site, not wherever Batman
  // happens to be standing): a small, self-contained addition next to summon() that reuses its
  // slide-in (bm.arriving, updateSummonArrival above) rather than touching any driving/physics
  // code. { slide: false } places it immediately (used by the dev fast path); the default slides
  // it in from SUMMON_FAR back along its own facing, the same distance and duration summon() uses.
  function park(spot, { slide = true } = {}) {
    if (bm.arriving) return; // already on its way somewhere
    const yaw = spot.yaw ?? 0;
    if (!slide) {
      const groundY = collision.groundBelow(spot.x, (spot.y ?? 0) + 4, spot.z, 0.3);
      bm.v.speed = 0; bm.v.drift = 0; bm.v.yaw = yaw;
      bm.group.rotation.y = yaw;
      bm.group.position.set(spot.x, groundY > -Infinity ? groundY : (spot.y ?? 0), spot.z);
      bm.group.visible = true;
      bm.summoned = true;
      events.emit('word', { text: 'SCREEECH!', pos: bm.group.position.clone().setY(bm.group.position.y + 1), big: true });
      toast.show('The Batmobile screeches in.', 2200);
      return;
    }
    const fromX = spot.x - Math.sin(yaw) * SUMMON_FAR, fromZ = spot.z - Math.cos(yaw) * SUMMON_FAR;
    const groundY = collision.groundBelow(fromX, (spot.y ?? 0) + 4, fromZ, 0.3);
    bm.v.speed = 0; bm.v.drift = 0; bm.v.yaw = yaw;
    bm.group.rotation.y = yaw;
    bm.group.visible = true;
    bm.summoned = true;
    bm.group.position.set(fromX, groundY > -Infinity ? groundY : (spot.y ?? 0), fromZ);
    bm.arriving = { t: 0, dur: SUMMON_DUR, fromX, fromZ, toX: spot.x, toZ: spot.z, yaw };
    toast.show('The Batmobile is on its way.', 2200);
  }

  // A little code figure that hops out and dashes off: enter()'s carjack flourish. Only one ever
  // needed at a time in practice, but kept as a small pool-free list since it's an event (a
  // carjack), not a per-frame cost.
  const fleeingFigures = [];
  function spawnFleeingDriver(car) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.26), new THREE.MeshBasicMaterial({ color: 0x3a3a44 }));
    body.position.y = 0.72;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), new THREE.MeshBasicMaterial({ color: 0xc99a7c }));
    head.position.y = 1.28;
    g.add(body, head);
    const away = rng.chance(0.5) ? 1 : -1;
    const yaw = car.v.yaw + (Math.PI / 2) * away;
    g.position.copy(car.group.position);
    g.rotation.y = yaw;
    scene.add(g);
    fleeingFigures.push({ g, dx: Math.sin(yaw), dz: Math.cos(yaw), t: 0 });
  }
  function updateFleeingFigures(dt) {
    for (let i = fleeingFigures.length - 1; i >= 0; i--) {
      const f = fleeingFigures[i];
      f.t += dt;
      f.g.position.x += f.dx * 5.5 * dt;
      f.g.position.z += f.dz * 5.5 * dt;
      if (f.t > 1.8) { scene.remove(f.g); fleeingFigures.splice(i, 1); }
    }
  }

  function enter(v) {
    if (!v || active || !v.group.visible || v.arriving) return;
    // A carjack: the car was actually moving under its own lane logic, not parked or already
    // knocked around. Stop it dead, and send its driver running.
    const carjack = v.traffic && v.knockT <= 0 && v.lane && v.lane.stopT <= 0 && Math.abs(v.v.speed) > 1;
    active = v;
    v.driven = true;
    lastSteer = 0;
    hero.control = { name: 'drive', camera: 'drive', update: () => false };
    hero.bat.root.visible = false;
    hero.cape.mesh.visible = false;
    hero.vel.set(0, 0, 0);
    if (carjack) {
      spawnFleeingDriver(v);
      v.v.speed = 0;
      v.v.drift = 0;
      toast.show('Carjacked! Gordon will REALLY have questions.', 3200);
    } else if (v.kind === 'car') {
      toast.show('Borrowed for the birthday. Gordon will explain.', 3200);
    }
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
    // Once commandeered, a traffic car stays exactly where it's left, like any other borrowed
    // car; without this its stale lane.t (frozen since the moment it was entered) would snap it
    // back to wherever its route was when the player drives or ejects out of it somewhere else.
    if (v.traffic) v.traffic = false;
    if (v.kind === 'car') v.borrowed = true;
    events.emit('vehicleExit', { kind: v.kind });
    audio?.setEngine(null);
    wasBoosting = false;
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
    if (v.traffic) v.traffic = false; // see the same note in exit()
    if (v.kind === 'car') v.borrowed = true;
    events.emit('vehicleExit', { kind: v.kind });
    audio?.setEngine(null);
    wasBoosting = false;
    active = null;
  }

  // ---------------- one vehicle's physics step ----------------
  function integrateVehicle(inst, input2, dt) {
    inst.wallCd = Math.max(0, (inst.wallCd ?? 0) - dt); // cooldown: see the crash event below
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
        // A fresh, fast hit on the player's own car: a crash sound (cooldown so being pinned
        // against a wall doesn't retrigger it every frame).
        if (inst === active && inst.wallCd <= 0) {
          const impactSpeed = Math.hypot(velScratch.x, velScratch.z);
          if (impactSpeed > 6) { events.emit('vehicleImpact', { speed: impactSpeed }); inst.wallCd = 0.5; }
        }
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

  // One potential ram target: no allocation, so the call sites below can run every frame without
  // building a temporary list. `tracked` (the story chase, or the free-roam side chase below) is
  // whichever of the two `other` belongs to, or null for an ordinary street car.
  function tryRamOther(inst, other, dt, tracked = null) {
    if (!other || other === inst || other.driven) return;
    other.ramCd = Math.max(0, (other.ramCd ?? 0) - dt);
    const pos = inst.group.position;
    const dx = other.group.position.x - pos.x, dz = other.group.position.z - pos.z;
    const d = Math.hypot(dx, dz);
    if (d < inst.radius + other.radius + 0.3 && other.ramCd <= 0) {
      events.emit('vehicleImpact', { speed: Math.abs(inst.v.speed) });
      // A parked or borrowed car spins off however it was hit: fun, arcade, doesn't matter where
      // it ends up. A tracked chase van keeps its own path-following yaw instead: a full
      // contact-normal spin can knock it sideways off a narrow street and out of its own steering
      // range, turning one lucky ram into an unwinnable (or just tedious) game of catch-up.
      if (!tracked) {
        const nx = d > 1e-4 ? dx / d : 1, nz = d > 1e-4 ? dz / d : 0;
        other.v.yaw = Math.atan2(nx, nz);
      }
      other.v.speed = Math.min(other.tuning.maxSpeed * 0.6, Math.abs(inst.v.speed) * 0.5 + 3);
      other.v.drift = 0;
      other.ramCd = 0.6;
      // A shove off its lane, not a takeover: moving traffic rides the knock out (see
      // updateTrafficCar) and rejoins its lane afterward, same as real comic-book traffic.
      if (other.traffic) other.knockT = 1.2;
      if (tracked && tracked.ramCounter.ram()) {
        fx?.impact(other.group.position.clone(), 1.1);
        events.emit('word', { text: 'KRUNCH!', pos: other.group.position.clone().setY(other.group.position.y + 1.2), big: true });
        if (tracked === chase) {
          meter.set(`CHASE  ${chase.ramCounter.hits}/${chase.hitsNeeded}`);
          if (chase.ramCounter.done) endChase(true);
        } else {
          events.emit('sideChaseHit', { hits: tracked.ramCounter.hits, hitsNeeded: tracked.hitsNeeded });
          if (tracked.ramCounter.done) endSideChase(true);
        }
      }
    }
  }
  function ramVehicles(inst, dt) {
    if (Math.abs(inst.v.speed) < RAM_MIN_SPEED) return;
    for (const other of streetCars) tryRamOther(inst, other, dt);
    if (chase?.active) tryRamOther(inst, chase.van, dt, chase);
    if (sideVan?.active) tryRamOther(inst, sideVan.van, dt, sideVan);
  }

  // ---------------- the Joker chase ----------------
  let chase = null;
  function startChase({ path, onDone } = {}) {
    if (!Array.isArray(path) || path.length < 2) {
      console.warn('startChase: needs at least two path points; skipping the chase.');
      onDone?.({ ok: false });
      return;
    }
    // Normal play: the story's 'board' step (flow.js) already had her walk up and get in the
    // Batmobile herself before this ever runs, so this branch never fires. It stays only as a
    // last-resort fallback for a state the board step couldn't have covered (an old save resumed
    // mid-chase, say) so the mission is never unwinnable, not as the everyday path in.
    if (!active || active.kind !== 'batmobile') {
      const groundY = collision.groundBelow(path[0].x, path[0].y ?? 40, path[0].z, 0.3);
      hero.teleport({ x: path[0].x, y: groundY > -Infinity ? groundY : (path[0].y ?? 0), z: path[0].z });
      summon('batmobile', { instant: true });
      enter(bm);
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
  // Shared by the story chase and the free-roam side chase below: steers `c.van` toward
  // `c.path[c.idx]`, advances to the next point within 3 m of it (wrapping, so a short there-and-
  // back route just loops), and snaps it to the ground. Pure movement; `c` is mutated in place.
  function advanceOnPath(c, dt) {
    const van = c.van, path = c.path;
    const target = path[c.idx];
    const dx = target.x - van.group.position.x, dz = target.z - van.group.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 3) c.idx = (c.idx + 1) % path.length;
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
  }
  function updateChase(dt) {
    if (!chase?.active) return;
    chase.t += dt;
    if (chase.t > 90) { endChase(false); return; } // a safety timeout so a missed chase can't hang the story
    advanceOnPath(chase, dt);
    chase.ramCounter.update(dt);
  }

  // ---------------- free-roam side van chase (optional, repeatable, never during a story mission)
  // A lighter-weight sibling of the story chase above: the same "ram it 3 times" rule and the same
  // van, but she finds it herself out in the city, nothing forces her into the Batmobile, and
  // ignoring it just lets it drive off (it despawns after `expiry` seconds). src/game/sideVanChase.js
  // decides *when* to try (pure timing); trySpawnSideChase below decides *where* (a real nearby
  // street, via pickSideVanRoute above) and does the actual spawning. Only one at a time.
  const SIDE_CHASE_EXPIRY = 65; // seconds: "drives off and despawns after a while"
  let sideVan = null;
  function startSideChase({ spot, path, hitsNeeded = 3, expiry = SIDE_CHASE_EXPIRY } = {}) {
    if (sideVan?.active || !Array.isArray(path) || path.length < 2) return false;
    const van = createJokerVan();
    van.kind = 'sideVan';
    van.radius = 1.9;
    const startYaw = Math.atan2(path[1].x - path[0].x, path[1].z - path[0].z);
    van.v = { speed: JOKER_TUNING.maxSpeed * 0.6, yaw: startYaw, drift: 0 };
    van.tuning = JOKER_TUNING;
    const groundY0 = collision.groundBelow(path[0].x, (spot?.y ?? 3) + 3, path[0].z, 0.3);
    van.group.position.set(path[0].x, groundY0 > -Infinity ? groundY0 : 0, path[0].z);
    van.group.rotation.y = startYaw;
    scene.add(van.group);
    sideVan = { van, path, idx: 1, active: true, ramCounter: createRamCounter(hitsNeeded, 0.6), hitsNeeded, t: 0, expiry };
    events.emit('sideChaseStart', { x: path[0].x, z: path[0].z });
    return true;
  }
  // `silent`: true for a cancellation (a story mission needs the Batmobile, say) that shouldn't
  // read as a result at all, false for a real outcome (won, or drove off unchallenged).
  function endSideChase(ok, { silent = false } = {}) {
    if (!sideVan) return;
    scene.remove(sideVan.van.group);
    sideVan.active = false;
    sideVan = null;
    if (!silent) events.emit('sideChaseDone', { ok });
  }
  function updateSideChase(dt) {
    if (!sideVan?.active) return;
    sideVan.t += dt;
    if (sideVan.t > sideVan.expiry) { endSideChase(false); return; }
    advanceOnPath(sideVan, dt);
    sideVan.ramCounter.update(dt);
  }
  // Tries to spawn a side chase on a real street a few hundred metres from `near` (own rng, own
  // street-picking: never touches the city's build-time rng). False (nothing spawned, caller
  // retries soon) when one's already running or no clear nearby street was found in a few tries.
  function trySpawnSideChase(near, opts = {}) {
    if (sideVan?.active) return false;
    const groundOk = (x, z) => collision.groundBelow(x, (near.y ?? 0) + 4, z, 0.3) > -Infinity;
    const route = pickSideVanRoute(near, rng, groundOk);
    if (!route) return false;
    return startSideChase({ spot: route.spot, path: route.path, ...opts });
  }
  function cancelSideChase() { if (sideVan?.active) endSideChase(false, { silent: true }); }

  // ---------------- the Ace Chemicals battle ----------------
  const SHELL_DAMAGE = 16;    // armour hp lost per shell that connects: about 7 hits to destroy
  const SHELL_SPEED = 8;      // m/s: slow and dodgeable, especially boosting away from one
  const SHELL_HIT_RADIUS = 2.1;
  let battle = null;
  function startBattle({ site, drones, onDone } = {}) {
    if (!site) { console.warn('startBattle: no site given; skipping the battle.'); onDone?.({ ok: false }); return; }
    if (!active || active.kind !== 'batmobile') {
      // Same fallback as startChase above: the 'board' step ahead of this one already parked the
      // Batmobile at the Ace Chemicals gate and got her into it, so this never fires in normal
      // play. Kept only so an old save resumed mid-battle still has somewhere to stand.
      hero.teleport(site);
      summon('batmobile', { instant: true });
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
    battle = { site, drones: list, droneCount: count, onDone, active: true, tracer: createTracer(), flash: null, cannonCdT: 0, debris: [] };
    scene.add(battle.tracer);
    bm.armor.hp = bm.maxArmor;
    bm.armor.sinceHit = 999;
    armorHud.set(1);
    armorHud.show();
    meter.show(`DRONES  ${list.length}`);
    toast.show('Shock cannon: PUNCH to fire from the Batmobile.', 3200);
  }
  function clearBattleScene() {
    for (const d of battle.drones) { scene.remove(d.group); for (const s of d.shells) scene.remove(s); }
    for (const m of battle.debris) scene.remove(m);
    scene.remove(battle.tracer);
    if (battle.flash) scene.remove(battle.flash);
    meter.hide();
    armorHud.hide();
  }
  function endBattle(ok) {
    if (!battle) return;
    clearBattleScene();
    events.emit('battleDone', { ok });
    battle.onDone?.({ ok });
    battle.active = false;
    battle = null;
  }
  // The Batmobile's armour hit zero: Mansi is knocked out of it and the battle resets clean, so a
  // casual player always gets a fair retry instead of a hard fail state.
  function disableBatmobile() {
    if (!battle?.active) return;
    const site = battle.site, count = battle.droneCount, onDone = battle.onDone;
    events.emit('word', { text: 'KRAKOOM!', pos: bm.group.position.clone().setY(bm.group.position.y + 1.4), big: true });
    fx?.impact(bm.group.position.clone().setY(bm.group.position.y + 0.6), 1.6);
    follow.addShake?.(6);
    clearBattleScene();
    battle.active = false;
    battle = null;
    if (active === bm) exit();
    bm.group.visible = false;
    toast.show('Batmobile disabled! Resetting the battle.', 2800);
    setTimeout(() => {
      bm.armor.hp = bm.maxArmor;
      bm.armor.sinceHit = 999;
      startBattle({ site, drones: count, onDone });
    }, 1700);
  }
  function spawnDebris(pos) {
    if (!battle) return;
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: 0x1c1c1c }));
      m.position.copy(pos).setY(pos.y + 0.6);
      const a = rng.range(0, Math.PI * 2), s = rng.range(3, 7);
      m.userData.vx = Math.cos(a) * s;
      m.userData.vz = Math.sin(a) * s;
      m.userData.vy = rng.range(4, 7);
      m.userData.life = 0.9;
      scene.add(m);
      battle.debris.push(m);
    }
  }
  function fireCannon() {
    if (!battle?.active || active !== bm || battle.cannonCdT > 0) return;
    battle.cannonCdT = 0.35;
    events.emit('cannonFire');
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
    // Muzzle flash (a reused, repositioned glow sphere) and a little recoil kick.
    if (!battle.flash) { battle.flash = createShell(0xeaf2ff); battle.flash.scale.setScalar(2.1); scene.add(battle.flash); }
    battle.flash.position.set(ox, bm.group.position.y + 0.65, oz);
    battle.flash.visible = true;
    battle.flash.material.opacity = 1;
    battle.flash.userData.fadeT = 0.1;
    bm.v.speed -= 1.6;
    follow.hitKick?.(4);
    if (hitDrone) {
      hitDrone.health -= 1;
      fx?.impact(hitDrone.group.position.clone().setY(hitDrone.group.position.y + 0.8), 1.1);
      events.emit('word', { text: 'BAZZAP!', pos: hitDrone.group.position.clone().setY(hitDrone.group.position.y + 1.4), big: true });
      if (hitDrone.health <= 0 && !hitDrone.dead) {
        hitDrone.dead = true;
        hitDrone.group.visible = false;
        fx?.impact(hitDrone.group.position.clone().setY(hitDrone.group.position.y + 0.9), 1.8);
        events.emit('word', { text: 'KRAKOOM!', pos: hitDrone.group.position.clone().setY(hitDrone.group.position.y + 1.7), big: true });
        events.emit('droneDestroyed');
        spawnDebris(hitDrone.group.position);
        const remaining = battle.drones.filter((d) => !d.dead).length;
        meter.set(`DRONES  ${remaining}`);
        if (remaining <= 0) endBattle(true);
      }
    }
  }
  function updateBattle(dt) {
    if (!battle?.active) return;
    battle.cannonCdT = Math.max(0, battle.cannonCdT - dt);
    if (active === bm) {
      stepArmor(bm.armor, dt, { max: bm.maxArmor, regenDelay: 3, regenRate: bm.maxArmor / 16 });
      armorHud.set(bm.armor.hp / bm.maxArmor);
    }
    if (battle.tracer.visible) {
      battle.tracer.userData.fadeT -= dt;
      battle.tracer.material.opacity = Math.max(0, battle.tracer.userData.fadeT / 0.14) * 0.95;
      if (battle.tracer.userData.fadeT <= 0) battle.tracer.visible = false;
    }
    if (battle.flash?.visible) {
      battle.flash.userData.fadeT -= dt;
      if (battle.flash.userData.fadeT <= 0) battle.flash.visible = false;
      else battle.flash.material.opacity = battle.flash.userData.fadeT / 0.1;
    }
    for (let i = battle.debris.length - 1; i >= 0; i--) {
      const m = battle.debris[i];
      m.userData.vy -= 18 * dt;
      m.position.x += m.userData.vx * dt;
      m.position.y += m.userData.vy * dt;
      m.position.z += m.userData.vz * dt;
      m.userData.life -= dt;
      if (m.userData.life <= 0 || m.position.y < -2) { scene.remove(m); battle.debris.splice(i, 1); }
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
        events.emit('droneShot');
        const shell = createShell(0x8a2fbf);
        shell.position.set(d.group.position.x, d.group.position.y + 0.95, d.group.position.z);
        const dist = Math.hypot(dx, dz) || 1;
        shell.userData.vx = (dx / dist) * SHELL_SPEED;
        shell.userData.vz = (dz / dist) * SHELL_SPEED;
        shell.userData.life = 5;
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
        const hit = Math.hypot(hitDx, hitDz) < SHELL_HIT_RADIUS;
        if (hit || s.userData.life <= 0) {
          if (hit) {
            events.emit('shellHit');
            follow.addShake?.(4);
            if (active === bm) {
              damageArmor(bm.armor, SHELL_DAMAGE);
              armorHud.set(bm.armor.hp / bm.maxArmor);
              events.emit('armorHit');
              if (bm.armor.hp <= 0) { scene.remove(s); d.shells.splice(i, 1); disableBatmobile(); return; }
            }
          }
          scene.remove(s);
          d.shells.splice(i, 1);
        }
      }
    }
  }

  // ---------------- per-frame driving key + input ----------------
  function handleVehicleKey() {
    // At speed the same key ejects Batman up into a glide (the Arkham exit); slower, she steps out.
    if (active) { if (Math.abs(active.v.speed) >= EJECT_MIN_SPEED) eject(); else exit(); return; }
    let nearest = null, nearestD = Infinity;
    for (const v of enterables()) {
      if (v.driven || v.arriving || !v.group.visible) continue;
      const d = Math.hypot(hero.pos.x - v.group.position.x, hero.pos.z - v.group.position.z);
      if (d < (v === bm ? BATMOBILE_ENTER_RANGE : ENTER_RANGE) && d < nearestD) { nearestD = d; nearest = v; }
    }
    if (nearest) enter(nearest);
    else summon('batmobile');
  }

  // ---------------- the frame update (called from game.js's vehicles hook) ----------------
  // m/s: at or above this the vehicle key ejects into a glide instead of stepping out. Jump is only
  // ever the handbrake: a tap of it to tighten a corner must never throw Batman out of the car.
  const EJECT_MIN_SPEED = 14;

  function update(dt, real = dt) {
    if (input.pressed('vehicle')) handleVehicleKey();
    if (active) {
      // Physics steer is +1 = yaw up = a LEFT turn (vehiclePhysics.js); the D key is move.x +1,
      // a right turn, so it goes in negated.
      const steer = -input.move.x;
      const driveInput = {
        throttle: Math.max(0, input.move.y),
        brake: Math.max(0, -input.move.y),
        steer,
        handbrake: input.down('jump'),
        boost: input.down('sprint'),
      };
      const boosting = active.kind === 'batmobile' && driveInput.boost && driveInput.throttle > 0;
      if (active.kind === 'batmobile') bm.setBoost(boosting);
      if (boosting && !wasBoosting) events.emit('vehicleBoost');
      wasBoosting = boosting;
      integrateVehicle(active, driveInput, dt);
      lastSteer = active.v.steer ?? 0; // the eased steer (vehiclePhysics.js), for the front wheels
      // The chase camera swings in behind the car's own heading (src/game/camera.js).
      follow.setHeading?.(active.v.yaw, Math.abs(active.v.speed));
      hero.pos.copy(active.group.position);
      hero.speed = Math.abs(active.v.speed);
      // Engine loop: level stays 1 while driving (fade in/out lives in ambience.js's
      // setTargetAtTime ramps, not here), speed normalized 0..1 by this vehicle's own top speed.
      const engineMax = (boosting ? active.tuning.maxBoostSpeed : active.tuning.maxSpeed) || 1;
      audio?.setEngine(active.kind === 'batmobile' ? 'batmobile' : 'car', 1, Math.abs(active.v.speed) / engineMax, { boost: boosting });
      ramGoons(active);
      ramVehicles(active, dt);
      if (battle?.active && active === bm && input.pressed('punch')) fireCannon();
    }
    if (bm.arriving) updateSummonArrival(dt);
    else if (bm !== active) integrateVehicle(bm, NEUTRAL_INPUT, dt);
    for (const v of streetCars) {
      if (v === active) continue;
      if (v.traffic) updateTrafficCar(v, dt);
      else integrateVehicle(v, NEUTRAL_INPUT, dt);
    }
    updateChase(dt);
    updateSideChase(dt);
    updateBattle(dt);
    updateFleeingFigures(dt);
  }

  // Dev/QA fast path (scripts/playthrough.mjs, the same way it force-wins a fight): completes
  // whichever mission is running right now as a win, through the exact same onDone path a real
  // 3rd ram or a real last drone would take, so the story advances exactly as it would live.
  function debugWin() {
    if (chase?.active) { endChase(true); return true; }
    if (battle?.active) { endBattle(true); return true; }
    if (sideVan?.active) { endSideChase(true); return true; }
    return false;
  }

  return {
    summon, enter, exit, eject, park,
    get active() { return active; },
    update,
    startChase, startBattle, debugWin,
    // Free-roam side content (src/game/sideVanChase.js decides *when*; this decides *where* and
    // does the spawning/ramming/despawning, same rules as the story chase above).
    trySpawnSideChase, cancelSideChase,
    get sideChase() { return sideVan; },
    // Dev/story helpers, not part of the frozen contract above.
    get batmobile() { return bm; },
    get streetCars() { return streetCars; },
    get chase() { return chase; },
    get battle() { return battle; },
  };
}
