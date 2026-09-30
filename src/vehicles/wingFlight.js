// src/vehicles/wingFlight.js
// Pure arcade flight math for the Batwing: no three.js, no allocation per call. State is a plain
// object the caller owns and keeps across frames: { x, y, z, yaw, pitch, roll, speed, shakeT }.
// Angles are radians. yaw 0 faces +Z (matches the hero's own forward convention).

export const WING_TUNING = Object.freeze({
  cruiseSpeed: 42,
  boostSpeed: 76,
  brakeSpeed: 20,
  minSpeed: 16,
  speedRate: 1.6,     // how fast current speed chases its target (per second, scaled by dt below)
  pitchRate: 1.05,    // rad/s at full stick
  maxPitch: 0.88,
  levelRate: 1.1,     // auto level-out chase rate when there is no pitch input
  rollRate: 3.2,      // bank chase rate
  maxBank: 0.85,
  turnRate: 1.15,     // yaw rad/s per rad of bank (coordinated turn)
  ceiling: 140,
  ceilingPush: 1.6,
  edgePush: 1.4,
  bounceBack: 5,
  bounceSpeedMul: 0.35,
  shakeDur: 0.4,
});

export function createWingState(x = 0, y = 0, z = 0, yaw = 0) {
  return { x, y, z, yaw, pitch: 0, roll: 0, speed: WING_TUNING.cruiseSpeed, shakeT: 0 };
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

// Soft push-back at the world edge (src/world/mapData.js WORLD bounds), same spring approach.
export function clampToWorld(state, bounds, dt, tune = WING_TUNING) {
  if (state.x > bounds.maxX) state.x -= (state.x - bounds.maxX) * Math.min(1, tune.edgePush * dt);
  else if (state.x < bounds.minX) state.x -= (state.x - bounds.minX) * Math.min(1, tune.edgePush * dt);
  if (state.z > bounds.maxZ) state.z -= (state.z - bounds.maxZ) * Math.min(1, tune.edgePush * dt);
  else if (state.z < bounds.minZ) state.z -= (state.z - bounds.minZ) * Math.min(1, tune.edgePush * dt);
  return state;
}

// A building hit: knock the plane back along the outward wall normal (nx, nz already normalized),
// bleed most of its speed (never below the stall floor) and arm a short camera shake. No death.
export function bounceWing(state, nx, nz, tune = WING_TUNING) {
  state.x += nx * tune.bounceBack;
  state.z += nz * tune.bounceBack;
  state.speed = Math.max(tune.minSpeed, state.speed * tune.bounceSpeedMul);
  state.yaw = Math.atan2(nx, nz);
  state.roll *= 0.3;
  state.shakeT = tune.shakeDur;
  return state;
}
