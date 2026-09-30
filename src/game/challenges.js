// Challenge courses and their maths: ring passes, checkpoints, the arena score and medals.
// Pure: no three.js, no DOM. Medal times come from scripts/challenge-tune.mjs (Task 16).
import { SITES } from '../world/mapData.js';

export const MEDAL_ORDER = [null, 'bronze', 'silver', 'gold'];
export const MEDAL_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
export const MOVE_LABEL = { ladder: 'ladder', ledge: 'ledge', zipline: 'zipline', wallrun: 'wall run' };
export const ARENA_ID = 'challenge:bash';

const ring = (x, y, z, r = 4, n = null) => ({ x, y, z, r, n });
const cp = (x, y, z, r, label, needs = null, h = 4) => ({ x, y, z, r, h, label, needs });

// n rings evenly spaced on a circle of `radius` around (cx, cz), height oscillating between
// baseY - yAmp and baseY + yAmp so a lap reads as a real flight path, not a flat disc. Used by
// wingWalk below.
function ringLoop(cx, cz, radius, baseY, yAmp, n, r = 5) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(ring(cx + Math.sin(a) * radius, baseY + Math.sin(a * 2) * yAmp, cz + Math.cos(a) * radius, r));
  }
  return pts;
}

// Unit normals from each point back to the previous one (the direction you fly through it),
// or the point's own `n`. `flat` keeps checkpoint hoops upright.
export function withNormals(points, start, flat = false) {
  let prev = start;
  return points.map((p) => {
    let [nx, ny, nz] = p.n ?? [p.x - prev.x, p.y - prev.y, p.z - prev.z];
    if (flat) ny = 0;
    const len = Math.hypot(nx, ny, nz) || 1;
    prev = p;
    const { n, ...rest } = p;
    return { ...rest, nx: nx / len, ny: ny / len, nz: nz / len };
  });
}

const g = (dx, dz) => ({ type: 'grunt', dx, dz });
const k = (dx, dz) => ({ type: 'knife', dx, dz });
const b = (dx, dz) => ({ type: 'brute', dx, dz });
export const ARENA_FIGHT = {
  site: 'monarchRoof', radius: 16,
  waves: [
    [g(-5, -5), g(5, -5), g(0, 6), k(-6, 4)],
    [k(-6, -4), k(6, -4), g(-3, 7), g(3, 7), g(0, -8)],
    [b(0, -6), k(-6, 3), k(6, 3), g(-4, -9), g(4, -9)],
  ],
};

const RAW = [
  {
    id: 'signalToSea', name: 'Signal to Sea', kind: 'rings',
    blurb: 'Leap off the GCPD roof and glide south to the container yard.',
    start: { x: 14, y: 42, z: 19, yaw: 0 }, limit: 20, medals: { gold: 7.5, silver: 8.5, bronze: 10.5 },
    // Ring 0 clears the low roof-edge rail (the launch pose is right at the parapet); the rest
    // of the drop makes up the altitude on the next leg.
    rings: [ring(28, 43, 45), ring(30, 31, 80), ring(30, 25, 115), ring(26, 19, 145), ring(12, 12, 172, 5)],
  },
  {
    id: 'neonSlalom', name: 'Neon Slalom', kind: 'rings',
    blurb: 'Weave between the signs of Neon Row, low and fast.',
    start: { x: 163, y: 30, z: 100, yaw: Math.PI }, limit: 35, medals: { gold: 13, silver: 15.5, bronze: 19 },
    // Ring 0 clears the roof-edge rail at the Neon Row launch point.
    rings: [ring(150, 32, 85, 3.5), ring(145, 22.5, 60, 3.5), ring(155, 18.5, 35, 3.5), ring(145, 14.5, 10, 3.5), ring(155, 10.5, -15, 3.5), ring(145, 7, -40, 3.5), ring(150, 4.9, -65, 4)],
  },
  {
    id: 'bellTowerDive', name: 'Bell Tower Dive', kind: 'rings',
    blurb: 'Dive between the cathedral towers, run the ridge and loop back to the plaza.',
    // Start sits close to the tower's south roof edge, but well clear of the west edge too (a
    // launch pose right at a corner leaves no room to walk before the jump); ring 0 sits almost
    // level with the launch so the dive clears the roof's own guard rail.
    start: { x: -79, y: 58, z: -141, yaw: -Math.PI / 2 }, limit: 50, medals: { gold: 16.5, silver: 20, bronze: 24.5 },
    // Rings 4 to 6 sit higher than first drawn: the loop back from the ridge turns sharply twice
    // in a row, and the extra altitude gives a glide enough room to correct through both turns
    // instead of sinking into the street before it lines up.
    rings: [ring(-100, 56, -108), ring(-120, 46, -122, 3.5, [0, 0, -1]), ring(-120, 44, -145, 3.5), ring(-120, 41.6, -170, 3.5), ring(-120, 42, -195), ring(-95, 34, -192), ring(-92, 24, -160, 5)],
  },
  {
    id: 'gothamParkour', name: 'Gotham Parkour', kind: 'parkour',
    blurb: 'Neon Row to the clock plaza. You will need a ladder, a ledge, a zipline and a wall run.',
    // The start sits east of a real street-level fire-escape ladder (most Neon Row storefronts
    // have awnings and skip the drop ladder, so the course uses one of the few buildings that has
    // one), on the side the ladder actually faces, and checkpoint 1 sits on that ladder's landing.
    // Checkpoint 2 grapples up the same building instead of across to the Gazette: the ladder's
    // own grapple always lands well above the Gazette's ledge, so a "grapple up, then across"
    // attempt from that height fails the climb's rise check and sends a real player walking off
    // the roof toward open air over the street below. A ninth zipline (src/world/ziplines.js)
    // then rides from this same roof down to the pawn shop (checkpoint 3), a real cornice with a
    // taller-than-default post so the outgoing cable clears the roof's own guard rail. See
    // task-16-report.md, Fix round 1, for the full geometry writeup.
    start: { x: 92, y: 0.15, z: -8, yaw: -Math.PI / 2 }, limit: 240, medals: { gold: 55, silver: 70, bronze: 95 },
    checkpoints: [
      cp(80, 20.4, -8, 9, 'Up the fire escape', 'ladder'),
      cp(76.5, 53.9, 1.5, 10, 'Hang off the Gazette', 'ledge'),
      cp(116, 26, -48, 8, 'Ride the wire', 'zipline'),
      cp(150, 0, -90, 10, 'Run the wall', 'wallrun', 6),
      cp(-75, 0.15, -112, 9, 'The clock plaza', null, 5),
    ],
  },
  {
    id: 'birthdayBash', name: "Joker's Birthday Bash", kind: 'arena',
    blurb: 'Three waves on the Monarch roof. Mix your moves, keep the combo, do not get hit.',
    start: { x: 190, y: SITES.monarchRoof.y, z: -48, yaw: Math.atan2(-10, -12) }, medals: { gold: 3300, silver: 2250, bronze: 1300 },
    // The Monarch roof has a duct unit close on the standard heading; a shorter side offset
    // clears it. See pillarPos below.
    pillarSide: 1.5,
  },
  {
    // A Batmobile checkpoint race: reuses the parkour checkpoint machinery (ground zones, not
    // aerial hoops, so a car can actually drive through them) on the street grid's own clear
    // centrelines (src/vehicles/vehicles.js LINES: x = -210..210 and z = -210..210 by 60 m,
    // 14 m-wide streets). A rectangle around four blocks south of the GCPD/Ace/Clock compounds,
    // so every leg is a real, unobstructed street with only 90-degree turns at the corners.
    // src/game/vehicleChallenges.js puts Mansi in the Batmobile (summon instant, then enter)
    // when this starts, and takes her out again when it ends.
    id: 'gothamGrandPrix', name: 'Gotham Grand Prix', kind: 'parkour',
    blurb: 'A Batmobile checkpoint race through the streets. Eight gates, then the finish.',
    start: { x: -90, y: 0.15, z: -60, yaw: 0 },
    // Rough numbers: timed with a scripted drive (scripts/challenge-tune.mjs --pilot=drive), not
    // a human lap, so treat these as a first pass to retune once someone actually races it.
    limit: 110, medals: { gold: 48, silver: 62, bronze: 82 },
    checkpoints: [
      cp(-90, 0.15, 20, 6, 'Gate 1'),
      cp(-90, 0.15, 150, 7, 'Gate 2: hard right'),
      cp(0, 0.15, 150, 6, 'Gate 3'),
      cp(90, 0.15, 150, 7, 'Gate 4: hard right'),
      cp(90, 0.15, 60, 6, 'Gate 5'),
      cp(90, 0.15, -30, 7, 'Gate 6: hard right'),
      cp(0, 0.15, -30, 6, 'Gate 7'),
      cp(-90, 0.15, -30, 7, 'Finish line'),
    ],
  },
  {
    // A Batwing ring course looping the clock tower (the "hall" landmark building, the tallest
    // in the city at 58 m) and passing close by the cathedral beside it. Center (-62, -160)
    // matches the hall's footprint in src/world/mapData.js. src/game/vehicleChallenges.js calls
    // the Batwing when this starts
    // when this starts (Mansi needs to already be somewhere she can call it: the pillar sits on
    // the clock tower roof) and ejects her into a glide when it ends.
    id: 'wingWalk', name: 'Wing Walk', kind: 'rings',
    blurb: 'Call the Batwing and fly the ring course around the clock tower.',
    // Powered flight, not a glide: scripts/course-check.mjs's climb check (built for the
    // glide-only ring courses) does not apply here.
    poweredFlight: true,
    // On the clock tower's own roof (the "hall" landmark, matching the arena site nearby), not
    // in open air: the pillar has to be somewhere Mansi can actually walk up to on foot.
    start: { x: -62, y: 58, z: -154, yaw: 0 },
    // Rough numbers: timed with a scripted flight (scripts/challenge-tune.mjs --pilot=fly), not a
    // human pilot, so treat these as a first pass too.
    limit: 100, medals: { gold: 42, silver: 55, bronze: 72 },
    rings: ringLoop(-62, -160, 46, 76, 9, 10),
  },
];

export const CHALLENGES = RAW.map((c) => ({
  ...c,
  ...(c.rings ? { rings: withNormals(c.rings, c.start) } : {}),
  ...(c.checkpoints ? { checkpoints: withNormals(c.checkpoints, c.start, true) } : {}),
}));

// The glowing bat pillar stands 2.2 m to the hero's right and 0.6 m behind the start pose, so it
// frames the hero from the side in the countdown shot instead of sitting on the camera-to-hero
// line (the ground camera sits 3.4 m behind, directly on the "2 m straight behind" spot this used
// to use). Walking up to it starts the challenge. A challenge can override the side distance
// (`pillarSide`) or behind distance (`pillarBehind`) when the standard offset would land the
// pillar inside nearby roof scenery; birthdayBash does, to clear a duct unit on the Monarch roof.
const PILLAR_SIDE = 2.2;
const PILLAR_BEHIND = 0.6;
export function pillarPos(ch) {
  const { x, y, z, yaw } = ch.start;
  const side = ch.pillarSide ?? PILLAR_SIDE;
  const behind = ch.pillarBehind ?? PILLAR_BEHIND;
  const fx = Math.sin(yaw), fz = Math.cos(yaw); // forward
  const rx = -fz, rz = fx; // right (matches camera.js's right(), and hero.js's strafe use of it)
  const round = (v) => Math.round(v * 1e6) / 1e6;
  return { x: round(x + rx * side - fx * behind), y, z: round(z + rz * side - fz * behind) };
}

// Did the segment a -> b pass through the ring's disc? Either direction counts. A segment that
// starts on the plane does not count again, so one crossing never scores twice.
export function ringPass(ring, a, b) {
  const da = (a.x - ring.x) * ring.nx + (a.y - ring.y) * ring.ny + (a.z - ring.z) * ring.nz;
  const db = (b.x - ring.x) * ring.nx + (b.y - ring.y) * ring.ny + (b.z - ring.z) * ring.nz;
  if (!((da < 0 && db >= 0) || (da > 0 && db <= 0))) return false;
  const t = da / (da - db);
  const px = a.x + (b.x - a.x) * t - ring.x, py = a.y + (b.y - a.y) * t - ring.y, pz = a.z + (b.z - a.z) * t - ring.z;
  return px * px + py * py + pz * pz <= ring.r * ring.r;
}

// Only the next ring counts. A missed ring stays the target until you fly back through it.
export function createRingRun(ch) {
  const rings = ch.rings;
  let next = 0, time = 0, done = false;
  return {
    get next() { return next; }, get time() { return time; }, get done() { return done; }, get total() { return rings.length; },
    update(dt, a, b) {
      if (done) return null;
      time += dt;
      if (!ringPass(rings[next], a, b)) return null;
      next += 1;
      if (next >= rings.length) { done = true; return 'finish'; }
      return 'ring';
    },
  };
}

// A checkpoint with `needs` only counts once that move was used since the previous checkpoint.
export function createCheckpointRun(ch) {
  const cps = ch.checkpoints;
  const used = new Set();
  let next = 0, time = 0, done = false, waiting = false;
  return {
    get next() { return next; }, get time() { return time; }, get done() { return done; }, get total() { return cps.length; },
    noteMove(id) { used.add(id); },
    update(dt, p) {
      if (done) return null;
      time += dt;
      const c = cps[next];
      const inside = Math.hypot(p.x - c.x, p.z - c.z) <= c.r && Math.abs(p.y - c.y) <= c.h;
      if (!inside) { waiting = false; return null; }
      if (c.needs && !used.has(c.needs)) {
        if (waiting) return null;
        waiting = true;
        return 'needs';
      }
      used.clear();
      waiting = false;
      next += 1;
      if (next >= cps.length) { done = true; return 'finish'; }
      return 'checkpoint';
    },
  };
}

// Arena scoring. Move names are the `move` field of combat's 'impact' events.
export const MOVE_KIND = {
  punch: 'punch', heavy: 'punch', kick: 'kick', spinKick: 'kick', counter: 'counter', cape: 'cape', batarang: 'batarang',
  special: 'special', jumpKick: 'aerial', diveBomb: 'aerial', slam: 'slam', throw: 'throw', thrownInto: 'throw',
  beatdown: 'beatdown', takedown: 'takedown',
};
export const FINISHERS = new Set(['heavy', 'spinKick', 'special', 'slam', 'takedown']);
export const ARENA_POINTS = { hit: 10, variety: 50, finisher: 100, counter: 75, streakStep: 4, maxMult: 8, streakTimeout: 2 };

export function createArenaScore(P = ARENA_POINTS) {
  let score = 0, streak = 0, idle = 0;
  const kinds = new Set();
  const mult = () => Math.min(P.maxMult, 1 + Math.floor(streak / P.streakStep));
  const breakCombo = () => { streak = 0; idle = 0; kinds.clear(); };
  return {
    get score() { return score; }, get streak() { return streak; }, get multiplier() { return mult(); }, get variety() { return kinds.size; },
    hit(move) {
      const kind = MOVE_KIND[move];
      if (!kind) return 0;
      streak += 1;
      idle = 0;
      let pts = P.hit * mult();
      if (!kinds.has(kind)) { kinds.add(kind); pts += P.variety; }
      if (FINISHERS.has(move)) pts += P.finisher;
      if (move === 'counter') pts += P.counter;
      score += pts;
      return pts;
    },
    hurt: breakCombo,
    tick(dt) {
      if (!streak) return;
      idle += dt;
      if (idle >= P.streakTimeout) breakCombo();
    },
  };
}

export function medalFor(ch, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const m = ch.medals;
  if (ch.kind === 'arena') return value >= m.gold ? 'gold' : value >= m.silver ? 'silver' : value >= m.bronze ? 'bronze' : null;
  return value <= m.gold ? 'gold' : value <= m.silver ? 'silver' : value <= m.bronze ? 'bronze' : null;
}
export const isBetter = (ch, value, best) => best == null || (ch.kind === 'arena' ? value > best : value < best);
const rank = (medal) => MEDAL_ORDER.indexOf(medal ?? null);

// New bests replace old ones; medals only ever go up (thresholds can be retuned later).
export function recordResult(entries, ch, value) {
  const old = entries[ch.id] ?? null;
  const medal = medalFor(ch, value);
  const newBest = isBetter(ch, value, old?.best ?? null);
  const best = newBest ? value : old.best;
  const kept = rank(old?.medal) >= rank(medal) ? old?.medal ?? null : medal;
  return { entry: { best, medal: kept }, newBest, medal };
}

export const allGold = (entries, list = CHALLENGES) => list.every((c) => entries[c.id]?.medal === 'gold');

const ceilTo = (v, step) => Math.ceil(v / step - 1e-9) * step;
const roundTo = (v, step) => Math.round(v / step) * step;
// Timed: from the scripted pilot's best run (it flies a clean line, so gold is hard but
// reachable). Arena: from the bot's median score (it never plays for variety, a person can).
export function suggestThresholds(kind, samples) {
  const s = [...samples].sort((x, y) => x - y);
  if (kind === 'arena') {
    const med = s[Math.floor(s.length / 2)];
    return { gold: roundTo(med * 1.25, 50), silver: roundTo(med * 0.85, 50), bronze: roundTo(med * 0.5, 50) };
  }
  const best = s[0];
  return { gold: ceilTo(best * 1.08, 0.5), silver: ceilTo(best * 1.3, 0.5), bronze: ceilTo(best * 1.6, 0.5), limit: ceilTo(best * 3, 5) };
}

export function formatTime(sec) {
  const t = Math.round(sec * 10) / 10;
  if (t < 60) return `${t.toFixed(1)} s`;
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
}
export const formatResult = (ch, v) => (ch.kind === 'arena' ? `${Math.round(v).toLocaleString('en-US')} pts` : formatTime(v));
