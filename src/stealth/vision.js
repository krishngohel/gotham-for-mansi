// Predator stealth: what a goon can see and hear, and where Batman can take one down from.
// Pure: no three.js. Points are plain { x, y, z }; yaw is radians and 0 faces +z (like ch.face).

export const STEALTH = {
  fov: (70 * Math.PI) / 180,         // full width of a goon's vision cone
  hostileFov: (110 * Math.PI) / 180, // a hostile goon looks around more
  range: 25,        // metres, Batman standing in the light
  shadow: 0.55,     // range factor when he is outside every light pool
  crouch: 0.6,      // range factor when he crouches
  instant: 3,       // this close inside the cone: spotted at once
  fill: 1.6,        // meter per second at point blank
  minFill: 0.3,     // meter per second at the edge of the range
  decay: 0.25,      // meter per second a suspicious goon loses while it sees nothing
  searchAt: 0.5,    // meter level that sends a goon to look (the glyph turns yellow)
  searchTime: 20,   // seconds a search lasts before the goon goes back to its patrol
  loseTime: 8,      // seconds unseen before a hostile squad falls back to searching
  huntAfter: 1,     // seconds unseen before engaged goons walk to the last known spot
  lookUp: 3,        // goons that aren't hostile never look higher than this above their feet
  perchSpot: 6,     // hostile goons spot a perched Batman only this close (3D: a high gargoyle is safe)
  eye: 1.6, chest: 1.1, crouchChest: 0.7,
  hearDy: 5,        // noises carry this far up or down
  noise: { step: 5, sprint: 9, land: 10, batarang: 12, takedown: 3, perch: 8 },
  silentReach: 1.6,  // metres between Batman and the goon's back
  silentBehind: -0.2, // cos of the angle between the goon's facing and the way to Batman
  silentTime: 2,     // seconds a silent takedown takes
  perchOn: 0.9,      // metres from a perch point that count as standing on it
  perchReach: 5, perchMinDrop: 1.5, perchMaxDrop: 14,
};

// States in which a goon can't look around or react: being hit, held, tied, frozen, dancing or out.
export const BLIND = new Set(['hit', 'stunned', 'down', 'getup', 'grabbed', 'chained', 'tied', 'frozen', 'dance', 'ko']);
// States in which a goon can't be grabbed for a takedown.
export const HELD = new Set(['grabbed', 'chained', 'tied', 'frozen', 'ko']);
const SIGHT_ARG = { crouched: false, shadow: false };

export const planar = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
// Whether p is inside a cone of full width fov around yaw, seen from `from` (planar).
export function inCone(from, yaw, p, fov = STEALTH.fov) {
  const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= Math.cos(fov / 2);
}

export function inShadow(p, lights = []) {
  for (const l of lights) if (Math.hypot(p.x - l.x, p.z - l.z) <= l.r) return false;
  return true;
}

export const inRect = (p, r) => !!r && Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.z - r.z) <= r.d / 2 && Math.abs(p.y - r.y) < 0.8;

export function sightRange({ crouched = false, shadow = false } = {}, rules = STEALTH) {
  return rules.range * (crouched ? rules.crouch : 1) * (shadow ? rules.shadow : 1);
}

export const canLook = (e) => !!e && e.alive && !e.down && !e.air && !e.stunned && !BLIND.has(e.state);

// How far away the goon sees Batman, or -1. Everything except the line of sight, which the
// runtime casts afterwards (and only when this says yes).
// goon: { pos, yaw, hostile }; hero: { pos, crouched, perched, hidden, flying }
export function spotCheck(goon, hero, lights = [], rules = STEALTH) {
  if (hero.hidden || hero.flying) return -1;
  const d = planar(goon.pos, hero.pos);
  const rise = hero.pos.y - goon.pos.y;
  if (hero.perched) { if (!goon.hostile || Math.hypot(d, rise) > rules.perchSpot) return -1; }
  else if (rise > rules.lookUp && !goon.hostile) return -1;
  SIGHT_ARG.crouched = hero.crouched;
  SIGHT_ARG.shadow = inShadow(hero.pos, lights);
  if (d > sightRange(SIGHT_ARG, rules)) return -1;
  if (!inCone(goon.pos, goon.yaw, hero.pos, goon.hostile ? rules.hostileFov : rules.fov)) return -1;
  return d;
}

// Meter per second while a goon sees Batman at distance d with this sight range.
export function fillRate(d, range, rules = STEALTH) {
  const k = Math.min(1, Math.max(0, d / Math.max(1e-6, range)));
  return rules.minFill + (rules.fill - rules.minFill) * (1 - k) * (1 - k);
}

export const hears = (listener, at, radius, rules = STEALTH) => planar(listener, at) <= radius && Math.abs(listener.y - at.y) <= rules.hearDy;

export function footstepNoise({ sprint = false, crouched = false } = {}, rules = STEALTH) {
  if (crouched) return 0;
  return sprint ? rules.noise.sprint : rules.noise.step;
}

// The perch Batman stands on (a grapple point marked perch), or null.
export function perchedOn(pos, perches, rules = STEALTH) {
  for (const p of perches) {
    if (!p.perch || Math.abs(pos.y - p.y) > 0.5) continue;
    if (planar(pos, p) <= rules.perchOn) return p;
  }
  return null;
}

// Batman can choke out a goon from behind: close, same floor, behind its shoulders, and it
// hasn't noticed him (hunting and fighting goons are aware).
export function canSilentTakedown(e, heroPos, rules = STEALTH) {
  if (!e || !e.alive || e.down || e.air || e.aware || e.def?.boss) return false;
  if (HELD.has(e.state)) return false;
  if (Math.abs(e.pos.y - heroPos.y) > 0.6) return false;
  const dx = heroPos.x - e.pos.x, dz = heroPos.z - e.pos.z, d = Math.hypot(dx, dz);
  if (d > rules.silentReach || d < 1e-6) return false;
  return (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / d <= rules.silentBehind;
}

export function pickSilentTarget(heroPos, enemies, rules = STEALTH) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (!canSilentTakedown(e, heroPos, rules)) continue;
    const d = planar(heroPos, e.pos);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

// From a perch: the nearest goon below, close enough across and neither too shallow nor too deep.
export function pickPerchDrop(heroPos, enemies, rules = STEALTH) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (!e || !e.alive || e.down || e.air || e.def?.boss || HELD.has(e.state)) continue;
    const drop = heroPos.y - e.pos.y;
    if (drop < rules.perchMinDrop || drop > rules.perchMaxDrop) continue;
    const d = planar(heroPos, e.pos);
    if (d <= rules.perchReach && d < bestD) { best = e; bestD = d; }
  }
  return best;
}
