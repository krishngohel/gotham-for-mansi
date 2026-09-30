// Pure arcade car physics: no three.js, no allocation beyond what the caller already owns.
// A vehicle's driving state is { speed, yaw, drift }: speed is meters/second along its facing
// (negative is reverse), yaw is world heading (radians, same convention as bat.face: forward is
// (sin(yaw), cos(yaw))), drift is a -1..1 lateral slip fraction of speed (0 = no slide).

// Default arcade tuning. A caller (the Batmobile, a borrowed street car) merges its own numbers
// over these.
export const DEFAULT_TUNING = {
  accel: 16,          // m/s^2, throttle held
  boostAccel: 26,      // m/s^2, throttle + boost held
  brakeDecel: 22,      // m/s^2, brake held while still moving forward
  reverseAccel: 9,      // m/s^2, brake held from a stop or already reversing
  drag: 0.6,           // 1/s, speed bleed with no throttle or brake
  maxSpeed: 32,         // m/s forward, no boost
  maxBoostSpeed: 46,     // m/s forward, boosting
  maxReverse: 11,       // m/s reverse
  turnRate: 2.1,        // rad/s at full steer and turnRefSpeed
  turnRefSpeed: 9,       // m/s: steering ramps in below this, full above it
  driftTurnMul: 1.5,     // steering multiplier while handbrake-drifting
  driftAmount: 0.85,     // target lateral slip at full steer + handbrake
  driftBuildRate: 4.5,   // 1/s, how fast drift approaches its target while handbraking
  driftDecayRate: 3.5,   // 1/s, how fast drift relaxes to 0 once handbrake is released
  driftLateralMul: 0.9,  // how much of (drift * |speed|) becomes sideways velocity
  wallRestitution: 0.35, // 0 = stop dead on a wall, 1 = a perfectly bouncy wall
};

export function mergeTuning(overrides = {}) {
  return { ...DEFAULT_TUNING, ...overrides };
}

// Advances { speed, yaw, drift } by dt given this frame's input. Mutates and returns `v`.
// input: { throttle: 0|1, brake: 0|1, steer: -1..1, handbrake: bool, boost: bool }
export function stepDrive(v, input, dt, tuning = DEFAULT_TUNING) {
  const t = tuning;
  const boosting = !!input.boost && input.throttle > 0;
  let accel = 0;
  if (input.throttle > 0) accel = boosting ? t.boostAccel : t.accel;
  else if (input.brake > 0) accel = v.speed > 0.3 ? -t.brakeDecel : -t.reverseAccel;
  v.speed += accel * dt;
  if (!input.throttle && !input.brake) v.speed -= v.speed * Math.min(1, t.drag * dt);
  const maxFwd = boosting ? t.maxBoostSpeed : t.maxSpeed;
  v.speed = Math.max(-t.maxReverse, Math.min(maxFwd, v.speed));

  const speedFrac = Math.min(1, Math.abs(v.speed) / t.turnRefSpeed);
  const steerDir = v.speed < 0 ? -1 : 1;
  const turnMul = input.handbrake ? t.driftTurnMul : 1;
  v.yaw += input.steer * steerDir * t.turnRate * turnMul * speedFrac * dt;

  const targetDrift = input.handbrake ? -input.steer * t.driftAmount : 0;
  const driftRate = input.handbrake ? t.driftBuildRate : t.driftDecayRate;
  v.drift += (targetDrift - v.drift) * Math.min(1, dt * driftRate);

  return v;
}

// World-space velocity for the current driving state, using the same forward/right convention
// as the follow camera (forward = sin/cos(yaw), right = -cos/sin(yaw)).
export function driveVelocity(v, tuning = DEFAULT_TUNING, out = { x: 0, z: 0 }) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  const rx = -Math.cos(v.yaw), rz = Math.sin(v.yaw);
  const lateral = v.drift * Math.abs(v.speed) * tuning.driftLateralMul;
  out.x = fx * v.speed + rx * lateral;
  out.z = fz * v.speed + rz * lateral;
  return out;
}

// Reflects `vel` ({x,z}) off a wall whose outward normal is (nx, nz) (unit length), scaled by
// `restitution` (0 = the velocity into the wall is simply cancelled, 1 = fully bounced back).
// Velocity already moving away from the wall is left untouched. Mutates and returns `vel`.
export function bounceOffWall(vel, nx, nz, restitution = 0.35) {
  const into = vel.x * nx + vel.z * nz;
  if (into < 0) {
    vel.x -= nx * into * (1 + restitution);
    vel.z -= nz * into * (1 + restitution);
  }
  return vel;
}

// Summon fallback: when Batman is standing too far from any real street line (a big open yard or
// plaza, mid-block), search a small grid of rings around him for a spot the Batmobile actually
// fits. `isClear(x, y, z)` is the caller's own collision-aware test (real collision.groundBelow
// plus a footprint check against the world) returning a placeable {x, y, z} or a falsy value; kept
// as an injected function so this search itself stays pure and unit-testable without three.js or
// a real collision world. Tries the spot dead on `near` first, then rings outward. Returns the
// first clear spot `isClear` accepts, or null if every ring came up empty.
export function findClearGroundSpot(near, isClear, radii = [0, 3, 5, 7, 10]) {
  for (const r of radii) {
    const steps = r === 0 ? 1 : 8;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const x = near.x + Math.cos(a) * r, z = near.z + Math.sin(a) * r;
      const p = isClear(x, near.y, z);
      if (p) return p;
    }
  }
  return null;
}

// Battle armour: a hit removes hp immediately and resets the regen delay; stepArmor only starts
// trickling hp back once `regenDelay` seconds have passed with no hit, so a player under fire
// can't out-regen a steady attacker, but a player who dodges (or the attacker missing) recovers.
// `a` is a plain { hp, sinceHit } the caller owns; both functions mutate and return it.
export function damageArmor(a, amount) {
  a.hp = Math.max(0, a.hp - amount);
  a.sinceHit = 0;
  return a;
}
export function stepArmor(a, dt, { max = 100, regenDelay = 3, regenRate = 6 } = {}) {
  a.sinceHit += dt;
  if (a.sinceHit >= regenDelay && a.hp < max && a.hp > 0) a.hp = Math.min(max, a.hp + regenRate * dt);
  return a;
}

// Traffic lane following: advances `lane.t` (a position along its street line, same convention as
// nearestStreetSpawn's x-or-z) at `lane.speed * lane.dir`, pausing for `stopDur` seconds whenever
// it crosses one of `crossings` (the perpendicular streets), so it reads as city traffic stopping
// at intersections without any real traffic-light logic. Mutates and returns `lane`.
export function stepLane(lane, dt, crossings, stopDur = 1.1) {
  if (lane.stopT > 0) {
    lane.stopT -= dt;
    return lane;
  }
  const prevT = lane.t;
  const nextT = lane.t + lane.dir * lane.speed * dt;
  for (const c of crossings) {
    if ((prevT < c && nextT >= c) || (prevT > c && nextT <= c)) {
      lane.t = c;
      lane.stopT = stopDur;
      return lane;
    }
  }
  lane.t = nextT;
  return lane;
}

// Chase mission: counts rams on a fleeing target with a short cooldown so one collision can't
// register twice in the same graze.
export function createRamCounter(hitsNeeded = 3, cooldown = 0.6) {
  let hits = 0, t = 0;
  return {
    get hits() { return hits; },
    get done() { return hits >= hitsNeeded; },
    get ready() { return t <= 0; },
    update(dt) { if (t > 0) t -= dt; },
    ram() { if (t > 0) return false; hits += 1; t = cooldown; return true; },
    reset() { hits = 0; t = 0; },
  };
}
