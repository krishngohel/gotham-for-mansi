// Chain takedowns: which chains are available, who gets chained, what they cost, and the lunge
// maths the chain control moves Batman with. Pure: no three.js, positions are plain { x, y, z }.

export const CHAINS = [
  { n: 1, id: 'rope', name: 'Rope-a-Dope', cost: 6, action: 'chain1' },
  { n: 2, id: 'head', name: 'Headbanger', cost: 9, action: 'chain2' },
  { n: 3, id: 'domino', name: 'Domino Drop', cost: 12, action: 'chain3' },
];

export const CHAIN_RULES = {
  stealthRadius: 6, // two unaware goons this close make every chain free and silent
  stealthMin: 2,
  reach: 9,         // chain targets are within this distance
  maxRise: 1.2,     // and on the same floor
  maxTargets: 3,
  minTargets: 2,
  hearRadius: 8,    // a silent chain still wakes unaware goons this close
  tiedTime: 6,      // seconds a Rope-a-Dope bundle stays tied
};

export const chainForAction = (action) => CHAINS.find((c) => c.action === action) ?? null;
export const chainCost = (chain, discount = 0) => Math.max(1, chain.cost - discount);

const planar = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const byId = (a, b) => String(a.id).localeCompare(String(b.id));
const inRange = (origin, e, radius, maxRise) => Math.abs(e.pos.y - origin.y) <= maxRise && planar(origin, e.pos) <= radius;

// A goon that can be pulled into a chain: standing, not flying, not already held, not the boss.
export function chainEligible(e) {
  if (!e || !e.alive || e.down || e.air) return false;
  if (e.def?.boss || e.type === 'joker') return false;
  return e.state !== 'grabbed' && e.state !== 'chained' && e.state !== 'tied' && e.state !== 'frozen';
}

export function stealthChainReady(origin, enemies, { radius = CHAIN_RULES.stealthRadius, min = CHAIN_RULES.stealthMin, maxRise = CHAIN_RULES.maxRise } = {}) {
  let n = 0;
  for (const e of enemies) if (chainEligible(e) && !e.aware && inRange(origin, e, radius, maxRise)) n += 1;
  return n >= min;
}

// What the HUD shows and what the keys can start. No raycasts here: line of sight is checked
// only when a chain actually starts (selectChainTargets).
export function chainAvailability({ combo, origin, enemies, discount = 0 }) {
  const stealth = stealthChainReady(origin, enemies);
  let near = 0, leaders = 0;
  for (const e of enemies) {
    if (!chainEligible(e) || (stealth && e.aware) || !inRange(origin, e, CHAIN_RULES.reach, CHAIN_RULES.maxRise)) continue;
    near += 1;
    if (!e.def?.armored) leaders += 1;
  }
  const enough = near >= CHAIN_RULES.minTargets && leaders >= 1;
  const costs = CHAINS.map((c) => chainCost(c, discount));
  return {
    show: stealth || combo >= Math.min(...costs),
    stealth,
    affordable: costs.map((cost) => enough && (stealth || combo >= cost)),
    costs,
  };
}

// Combo left after starting `chain`: stealth chains are free, fight chains spend their cost.
export function comboAfter(combo, chain, { stealth = false, discount = 0 } = {}) {
  return stealth ? combo : Math.max(0, combo - chainCost(chain, discount));
}

// Up to 3 goons within reach and in sight. The first is the closest non-brute, favouring the
// direction Batman faces (or the stick). Each next one is the closest to the previous, so the
// path hops goon to goon instead of zigzagging. Returns null with fewer than 2.
export function selectChainTargets(origin, facing, enemies, {
  canSee = () => true, reach = CHAIN_RULES.reach, max = CHAIN_RULES.maxTargets, min = CHAIN_RULES.minTargets,
  maxRise = CHAIN_RULES.maxRise, onlyUnaware = false,
} = {}) {
  const pool = enemies.filter((e) => chainEligible(e) && (!onlyUnaware || !e.aware) && inRange(origin, e, reach, maxRise) && canSee(e));
  if (pool.length < min) return null;
  const fl = Math.hypot(facing?.x ?? 0, facing?.z ?? 0);
  const score = (e) => {
    const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z, d = Math.hypot(dx, dz);
    const cos = fl > 0.2 && d > 1e-6 ? (dx * facing.x + dz * facing.z) / (d * fl) : 0;
    return d - cos * 1.5;
  };
  const leaders = pool.filter((e) => !e.def?.armored).sort((a, b) => score(a) - score(b) || byId(a, b));
  if (!leaders.length) return null;
  const path = [leaders[0]];
  const rest = pool.filter((e) => e !== leaders[0]);
  while (path.length < max && rest.length) {
    const last = path[path.length - 1].pos;
    rest.sort((a, b) => planar(last, a.pos) - planar(last, b.pos) || byId(a, b));
    path.push(rest.shift());
  }
  return path.length >= min ? path : null;
}

// Unaware, upright goons close enough to hear a silent chain (the ones in the chain don't count).
// Skips a tied or downed goon: waking one mid-tie/getup would fight enemy.js's own state machine
// (see enemy.wake), and it can't act on being woken until it's back on its feet anyway.
export function chainHearers(origin, enemies, chained, radius = CHAIN_RULES.hearRadius) {
  return enemies.filter((e) => e.alive && !e.aware && !e.down && !chained.includes(e) && planar(origin, e.pos) <= radius && Math.abs(e.pos.y - origin.y) <= 4);
}

// Everyone tied up with `e` who is still tied, e included: one hit knocks them all out.
export function tiedGroup(e) {
  if (!e || e.state !== 'tied') return [];
  return [e, ...(e.tiedWith ?? [])].filter((p, i, all) => p.alive && p.state === 'tied' && all.indexOf(p) === i);
}

// How a chain (or a hit on a tied bundle) ends for one goon: knocked out, or only knocked down
// for an armored brute. The Joker is never chained, so never gets here.
export const chainOutcome = (e) => (e.def?.armored ? 'knockdown' : 'ko');

export function chainHudKey({ show, stealth, affordable }) {
  return show ? `${stealth ? 's' : 'c'}${affordable.map((a) => (a ? 1 : 0)).join('')}` : 'off';
}

// ---- lunge maths ----

// Where Batman stands to strike `target` from `from`: on the line between them, `stop` short.
export function strikeSpot(from, target, stop) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop || d < 1e-6) return { x: from.x, y: from.y, z: from.z };
  const k = (d - stop) / d;
  return { x: from.x + dx * k, y: from.y, z: from.z + dz * k };
}

export const midSpot = (a, b) => ({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y), z: (a.z + b.z) / 2 });

export function pileCenter(points) {
  let x = 0, z = 0, y = Infinity;
  for (const p of points) { x += p.x; z += p.z; y = Math.min(y, p.y); }
  return { x: x / points.length, y, z: z / points.length };
}

// A spot `dist` from `center` on the side `from` is on (where Batman steps back to throw a line).
export function backSpot(center, from, dist) {
  const dx = from.x - center.x, dz = from.z - center.z, d = Math.hypot(dx, dz);
  const ux = d > 1e-6 ? dx / d : 0, uz = d > 1e-6 ? dz / d : 1;
  return { x: center.x + ux * dist, y: from.y, z: center.z + uz * dist };
}

// A point along a lunge: eased across the ground ('out' for lunges, 'in' for dives) plus an arc
// of `arc` metres at the middle.
export function lungePoint(from, to, k, arc = 0, out = { x: 0, y: 0, z: 0 }, ease = 'out') {
  const c = Math.min(1, Math.max(0, k));
  const e = ease === 'in' ? c * c : 1 - (1 - c) * (1 - c);
  out.x = from.x + (to.x - from.x) * e;
  out.z = from.z + (to.z - from.z) * e;
  out.y = from.y + (to.y - from.y) * (ease === 'in' ? e : c) + arc * Math.sin(c * Math.PI);
  return out;
}
