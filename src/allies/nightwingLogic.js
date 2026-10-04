// Pure decision helpers for Nightwing (src/allies/nightwing.js). No THREE, no assets: everything
// here takes plain numbers or the same enemy records combatSystem.js already works with (id,
// alive, down, type, def, pos.x/pos.z or x/z getters), so it is unit-testable in isolation and
// safe to call every frame with zero allocation (each is a single manual loop, no filter/map).

const ex = (e) => (typeof e.x === 'number' ? e.x : e.pos.x);
const ez = (e) => (typeof e.z === 'number' ? e.z : e.pos.z);

// Picks the goon Nightwing should go fight: the nearest live, standing, non-boss, non-Joker
// enemy, skipping whichever one Batman is currently on (his nearest aware enemy, computed by the
// caller) unless that is the only one left standing, in which case sharing it is fine (the last
// goon rule).
// leash ({ x, z, r }, optional): only goons within r of that point, Batman. Without it he ran
// off across the city to any street-crime goon still standing, every punch of his ticking her
// combo up and shaking her camera while she stood somewhere else entirely.
export const ALLY_LEASH = 18;
export function withinLeash(e, leash) {
  if (!leash) return true;
  const dx = ex(e) - leash.x, dz = ez(e) - leash.z;
  return dx * dx + dz * dz <= leash.r * leash.r;
}
export function pickAllyTarget(x, z, enemies, { batmanTarget = null, leash = null } = {}) {
  let bestAny = null, bestAnyD = Infinity;
  let bestOther = null, bestOtherD = Infinity;
  let aliveCount = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || e.down || e.type === 'joker' || e.def?.boss || !withinLeash(e, leash)) continue;
    aliveCount += 1;
    const dx = ex(e) - x, dz = ez(e) - z;
    const d = dx * dx + dz * dz;
    if (d < bestAnyD) { bestAnyD = d; bestAny = e; }
    if (e !== batmanTarget && d < bestOtherD) { bestOtherD = d; bestOther = e; }
  }
  if (aliveCount <= 1) return bestAny;
  return bestOther ?? bestAny;
}

// Whether Batman and Nightwing are both close enough to the same goon, and the combo is high
// enough, for a team takedown to be allowed this press.
export function canTeamTakedown({ heroX, heroZ, allyX, allyZ, targetX, targetZ, combo, radius = 3, comboThreshold = 5 }) {
  const dh = Math.hypot(heroX - targetX, heroZ - targetZ);
  const da = Math.hypot(allyX - targetX, allyZ - targetZ);
  return dh <= radius && da <= radius && combo >= comboThreshold;
}

// The nearest enemy in one of `states` within `radius` of (x, z), or null. Used both for "a goon
// winds up at him" (states: ['windup']) and "a goon's blow is on its way in" (states: ['attack']).
export function nearestThreat(x, z, enemies, radius, states) {
  const r2 = radius * radius;
  let best = null, bestD = r2;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.alive || !states.includes(e.state)) continue;
    const dx = ex(e) - x, dz = ez(e) - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// The Party Crasher's flee step: an eased run from `from` to `to` with an arc (the grapple's
// rise) layered on top of the straight lerp. Pure: t and duration are seconds, from/to/{x,y,z}.
export function fleeStep(from, to, t, duration = 1.4) {
  const k = Math.max(0, Math.min(1, t / duration));
  const ease = 1 - (1 - k) * (1 - k);
  const arc = Math.sin(k * Math.PI) * 2.4;
  return {
    x: from.x + (to.x - from.x) * ease,
    y: from.y + (to.y - from.y) * ease + arc,
    z: from.z + (to.z - from.z) * ease,
    done: k >= 1,
  };
}
