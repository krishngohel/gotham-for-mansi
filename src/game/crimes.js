// Street crimes: where and when they happen, who shows up, and what the radio says. Pure.
export const CRIME_KINDS = ['robbery', 'mugging', 'van'];
export const DISTRICT_LABEL = { gcpd: 'GCPD', docks: 'The Docks', neon: 'Neon Row', ace: 'Ace Chemicals', clock: 'The Clock Plaza' };
export const DISTRICT_PHRASE = { gcpd: 'outside GCPD', docks: 'at the Docks', neon: 'on Neon Row', ace: 'at Ace Chemicals', clock: 'in the Clock Plaza' };
const KIND_TITLE = { robbery: 'Robbery', mugging: 'Civilian cornered', van: 'Van break-in' };

// Street-level spots, two per district. y is the street; the director snaps it to the ground.
export const CRIME_SPOTS = [
  { id: 'gcpdSteps', district: 'gcpd', x: 0, y: 0, z: 27, yaw: 0 },
  { id: 'gcpdWest', district: 'gcpd', x: -27, y: 0, z: 0, yaw: Math.PI / 2 },
  { id: 'dockYard', district: 'docks', x: 0, y: 0.15, z: 178, yaw: 0 },
  { id: 'dockRoad', district: 'docks', x: -90, y: 0, z: 150, yaw: Math.PI / 2 },
  { id: 'neonNorth', district: 'neon', x: 150, y: 0, z: -20, yaw: 0 },
  { id: 'neonDiner', district: 'neon', x: 150, y: 0, z: 70, yaw: 0 },
  { id: 'aceGate', district: 'ace', x: 95, y: 0, z: -140, yaw: 0 },
  { id: 'aceLab', district: 'ace', x: 72, y: 0, z: -100, yaw: Math.PI / 2 },
  { id: 'plazaFountain', district: 'clock', x: -92, y: 0.15, z: -108, yaw: 0 },
  { id: 'plazaHall', district: 'clock', x: -50, y: 0.15, z: -122, yaw: 0 },
];

export const isCrimeId = (id) => typeof id === 'string' && id.startsWith('crime:');
export const crimeTitle = (kind, district) => `${KIND_TITLE[kind]} ${DISTRICT_PHRASE[district]}`;

// Crimes happen in free roam and between story steps only: never during a fight step, the
// boss, the finale, a cutscene, a challenge or photo mode. A crime's own fight doesn't block.
export function crimeBlocked({ mode, stepType, challenge = false, fightId = null, photo = false }) {
  if (mode !== 'play' || challenge || photo) return true;
  if (['fight', 'boss', 'cutscene'].includes(stepType)) return true;
  return !!fightId && !isCrimeId(fightId);
}

// A visited-district spot, not on top of the hero (minDist), not across the city (maxDist),
// and well away from the current objective (avoid) so a crime never sits on the story's path.
export function pickSpot(spots, visited, heroPos, rng, { minDist = 35, maxDist = 260, avoid = null, avoidDist = 60 } = {}) {
  const ok = spots.filter((s) => {
    if (!visited.includes(s.district)) return false;
    const d = Math.hypot(s.x - heroPos.x, s.z - heroPos.z);
    if (d < minDist || d > maxDist) return false;
    return !avoid || Math.hypot(s.x - avoid.x, s.z - avoid.z) >= avoidDist;
  });
  return ok.length ? ok[Math.floor(rng.next() * ok.length)] : null;
}

export function createCrimeScheduler({ rng, minGap = 120, maxGap = 240, expiry = 180, retry = 20, spots = CRIME_SPOTS, minDist = 35, maxDist = 260, avoidDist = 60 } = {}) {
  const gap = () => minGap + rng.next() * (maxGap - minGap);
  let timer = gap();
  let active = null;
  let serial = 0;
  let forced = null;
  return {
    get active() { return active; },
    get timer() { return timer; },
    update(dt, { blocked = false, visited = [], heroPos = { x: 0, z: 0 }, avoid = null } = {}) {
      if (active) {
        if (active.engaged || blocked) return null;
        active.age += dt;
        if (active.age < expiry) return null;
        const crime = active;
        active = null;
        timer = gap();
        return { type: 'expire', crime };
      }
      if (blocked) return null;
      timer -= dt;
      if (timer > 0) return null;
      const spot = forced?.spotId
        ? spots.find((s) => s.id === forced.spotId) ?? null
        : pickSpot(spots, visited, heroPos, rng, { minDist, maxDist, avoid, avoidDist });
      const kind = forced?.kind ?? CRIME_KINDS[Math.floor(rng.next() * CRIME_KINDS.length)];
      forced = null;
      if (!spot) { timer = retry; return null; }
      serial += 1;
      active = { id: `crime${serial}`, fightId: `crime:${serial}`, kind, spot, age: 0, engaged: false };
      return { type: 'spawn', crime: active };
    },
    engage() { if (active) active.engaged = true; },
    resolve() { const c = active; active = null; timer = gap(); return c; },
    force({ kind = null, spotId = null } = {}) { forced = { kind, spotId }; timer = 0; },
  };
}

// 3 to 5 goons in a ring 3.5 to 5 m around the spot. Five come in two waves (3 then 2).
export function crimeFight(kind, spot, rng) {
  const n = 3 + Math.floor(rng.next() * 3);
  const turn = rng.next() * Math.PI * 2;
  const goons = Array.from({ length: n }, (_, i) => {
    const type = i === 1 && kind !== 'mugging' ? 'knife' : i === 4 && kind === 'van' ? 'brute' : 'grunt';
    const a = turn + (i / n) * Math.PI * 2;
    const r = 3.5 + (i % 2) * 1.5;
    return { type, dx: Math.sin(a) * r, dz: Math.cos(a) * r };
  });
  return { site: { x: spot.x, y: spot.y, z: spot.z }, radius: 16, waves: n === 5 ? [goons.slice(0, 3), goons.slice(3)] : [goons] };
}
