// src/vehicles/wingFlight.js
// Pure arcade flight math for the Batwing: no three.js, no allocation per call. State is a plain
// object the caller owns and keeps across frames: { x, y, z, yaw, pitch, roll, speed, shakeT }.
// Angles are radians. yaw 0 faces +Z (matches the hero's own forward convention).

// Tuned to fly between city blocks: at cruise a full-bank turn is about 23 m across (it was 43 m,
// a U-turn taking over three seconds), and the bank answers in about a fifth of a second.
export const WING_TUNING = Object.freeze({
  cruiseSpeed: 38,
  boostSpeed: 70,
  brakeSpeed: 20,
  minSpeed: 16,
  speedRate: 1.6,     // how fast current speed chases its target (per second, scaled by dt below)
  pitchRate: 1.5,     // rad/s at full stick
  maxPitch: 0.88,
  levelRate: 1.1,     // auto level-out chase rate when there is no pitch input
  rollRate: 5.5,      // bank chase rate
  maxBank: 1.0,
  turnRate: 1.65,     // yaw rad/s per rad of bank (coordinated turn)
  ceiling: 140,
  ceilingPush: 1.6,
  edgeMargin: 80,     // m: inside this distance of the world edge the plane banks back toward the city
  edgeTurnRate: 2.6,  // rad/s of that turn right at the edge
  bounceBack: 0.6,    // m: pushed off a wall this far past where collision already put it
  bounceSnap: 0.6,    // rad: the most a wall hit turns the plane at once; the rest is steered
  avoidDur: 0.5,      // s: over which a wall hit finishes turning the plane along the wall
  avoidRate: 4,       // rad/s for that turn
  bounceSpeedMul: 0.7,
  shakeDur: 0.25,
});

export function createWingState(x = 0, y = 0, z = 0, yaw = 0) {
  return { x, y, z, yaw, pitch: 0, roll: 0, speed: WING_TUNING.cruiseSpeed, shakeT: 0, avoidYaw: 0, avoidT: 0 };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Advances the flight state one frame. `input`: { pitchIn, rollIn, boost, brake } each -1..1 /
// booleans, already resolved for Invert Y by the caller. Mutates and returns `state`.
export function stepWing(state, input, dt, tune = WING_TUNING) {
  const pitchIn = clamp(input.pitchIn ?? 0, -1, 1);
  const rollIn = clamp(input.rollIn ?? 0, -1, 1);

  // Bank: chases a target proportional to roll input, self-leveling back to 0 when let go.
  const targetRoll = rollIn * tune.maxBank;
  state.roll += (targetRoll - state.roll) * Math.min(1, tune.rollRate * dt);

  // Pitch: integrates while held, auto-levels toward 0 when neutral.
  if (Math.abs(pitchIn) > 0.02) state.pitch += pitchIn * tune.pitchRate * dt;
  else state.pitch += (0 - state.pitch) * Math.min(1, tune.levelRate * dt);
  state.pitch = clamp(state.pitch, -tune.maxPitch, tune.maxPitch);

  // Coordinated turn: banking steers the heading.
  state.yaw += state.roll * tune.turnRate * dt;
  // Finishing a wall glance (bounceWing): steer onto the heading along the wall.
  if (state.avoidT > 0) {
    state.avoidT -= dt;
    const d = Math.atan2(Math.sin(state.avoidYaw - state.yaw), Math.cos(state.avoidYaw - state.yaw));
    const step = tune.avoidRate * dt;
    state.yaw += Math.max(-step, Math.min(step, d));
  }

  // Speed: chases boost / brake / cruise target, never below the stall floor.
  const target = input.brake ? tune.brakeSpeed : input.boost ? tune.boostSpeed : tune.cruiseSpeed;
  state.speed += (target - state.speed) * Math.min(1, tune.speedRate * dt);
  if (state.speed < tune.minSpeed) state.speed = tune.minSpeed;

  // Integrate position along the nose.
  const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
  const fx = Math.sin(state.yaw) * cp, fy = sp, fz = Math.cos(state.yaw) * cp;
  state.x += fx * state.speed * dt;
  state.y += fy * state.speed * dt;
  state.z += fz * state.speed * dt;

  // Soft ceiling: a spring pulling it back down, not a hard wall.
  if (state.y > tune.ceiling) state.y -= (state.y - tune.ceiling) * Math.min(1, tune.ceilingPush * dt);

  if (state.shakeT > 0) state.shakeT = Math.max(0, state.shakeT - dt);
  return state;
}

// The world edge (src/world/mapData.js WORLD bounds). A spring pushing the plane back while it kept
// flying outward made it shudder against an invisible wall. Instead, inside edgeMargin of an edge,
// while heading outward, the plane is turned back toward the city (harder the closer it is), and
// the edge itself is a plain stop it can slide along. Mutates and returns `state`.
export function clampToWorld(state, bounds, dt, tune = WING_TUNING) {
  const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
  // How far into each edge's margin, 0..1, and which way is back inside.
  let ix = 0, iz = 0, depth = 0;
  const into = (d) => Math.max(0, Math.min(1, 1 - d / tune.edgeMargin));
  const kx1 = into(bounds.maxX - state.x), kx0 = into(state.x - bounds.minX);
  const kz1 = into(bounds.maxZ - state.z), kz0 = into(state.z - bounds.minZ);
  if (kx1 > 0 && fx > 0) { ix -= kx1; depth = Math.max(depth, kx1); }
  if (kx0 > 0 && fx < 0) { ix += kx0; depth = Math.max(depth, kx0); }
  if (kz1 > 0 && fz > 0) { iz -= kz1; depth = Math.max(depth, kz1); }
  if (kz0 > 0 && fz < 0) { iz += kz0; depth = Math.max(depth, kz0); }
  if (depth > 0) {
    // Turn toward the heading that points back inside: the shortest way round.
    const want = Math.atan2(ix + fx * 0.15, iz + fz * 0.15);
    const d = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
    const step = tune.edgeTurnRate * depth * dt;
    state.yaw += Math.max(-step, Math.min(step, d));
    state.roll += (Math.sign(-d) * tune.maxBank * depth - state.roll) * Math.min(1, tune.rollRate * dt);
  }
  state.x = clamp(state.x, bounds.minX, bounds.maxX);
  state.z = clamp(state.z, bounds.minZ, bounds.maxZ);
  return state;
}

// A building hit: (nx, nz) is the wall's outward normal, already normalized, and the caller has
// already put the plane where collision resolved it. It used to be thrown 5 m back and spun to
// face straight out from the wall, which near other buildings bounced it from wall to wall. Now it
// glances off: nudged clear, its heading turned along the wall (the side it was already leaning
// toward), some speed lost (never below the stall floor) and a short shake. No death.
export function bounceWing(state, nx, nz, tune = WING_TUNING) {
  state.x += nx * tune.bounceBack;
  state.z += nz * tune.bounceBack;
  const fx = Math.sin(state.yaw), fz = Math.cos(state.yaw);
  const dot = fx * nx + fz * nz;
  if (dot < 0) {
    // Keep only the part of the heading along the wall; head-on, pick the side it was banking to.
    let tx = fx - nx * dot, tz = fz - nz * dot;
    if (Math.hypot(tx, tz) < 0.2) { const s = state.roll >= 0 ? 1 : -1; tx = -nz * s; tz = nx * s; }
    // A little away from the wall too, so the next frame isn't another hit. A head-on hit can
    // need a 100 degree turn: only part of it happens now (a visible snap otherwise), and stepWing
    // finishes it over the next half second (avoidYaw / avoidT).
    const want = Math.atan2(tx + nx * 0.25, tz + nz * 0.25);
    const d = Math.atan2(Math.sin(want - state.yaw), Math.cos(want - state.yaw));
    state.yaw += Math.max(-tune.bounceSnap, Math.min(tune.bounceSnap, d));
    state.avoidYaw = want;
    state.avoidT = tune.avoidDur;
  }
  state.speed = Math.max(tune.minSpeed, state.speed * tune.bounceSpeedMul);
  state.roll *= 0.5;
  state.shakeT = tune.shakeDur;
  return state;
}
