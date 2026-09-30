// src/game/partySlots.js
// Pure guest placement data for the finale rooftop party (GCPD roof, SITES.start / signal,
// y 42): no three.js, no DOM, so it is cheap to unit test. Positions are local to the roof
// centre (0, 0) and chosen clear of src/game/finale.js's own furniture (the table and cake near
// (3, 4), the presents near (-1, 6.5), the party kit near (8, 1), and the Joker's chair near
// (-7, 9)) and of each other.
export const PARTY_Y = 42;

// One or more (x, z) spots per guest id: 'band' and 'kids' place a small cluster.
export const GUEST_SLOTS = {
  dj: [{ x: -14, z: -8, yaw: 0.5 }],
  baker: [{ x: 7, z: 8, yaw: -2.2 }],
  band: [{ x: -11, z: 10, yaw: -1 }, { x: -8.7, z: 11.4, yaw: -1.3 }, { x: -13.2, z: 11.6, yaw: -0.7 }],
  gordon: [{ x: 12, z: -10, yaw: 2.4 }],
  alfred: [{ x: 5, z: -6, yaw: 1.1 }],
  nightwing: [{ x: -6, z: -13, yaw: 3 }],
  kids: [{ x: 13, z: 10, yaw: -1.6 }, { x: 15, z: 11.4, yaw: -2 }, { x: 11.3, z: 11.6, yaw: -1.2 }],
};

export const GUEST_IDS = Object.keys(GUEST_SLOTS);

export function guestSlots(id) { return GUEST_SLOTS[id] ?? []; }

export function allSlotPoints() {
  const out = [];
  for (const id of GUEST_IDS) for (const p of GUEST_SLOTS[id]) out.push({ id, x: p.x, z: p.z });
  return out;
}

// 2D (x, z) distance clears `minDist`.
export function farEnough(a, b, minDist) { return Math.hypot(a.x - b.x, a.z - b.z) >= minDist; }

// True only if every placed point (across every guest, including within one guest's own
// cluster) clears `minDist` of every other. Pure, so the hand-authored slots above are checked
// by the test suite instead of by eye.
export function noOverlaps(minDist = 1.6) {
  const pts = allSlotPoints();
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (!farEnough(pts[i], pts[j], minDist)) return false;
    }
  }
  return true;
}

// Furniture zones from finale.js: { x, z, r } circles, kept here (not imported from finale.js,
// which is three.js-heavy) so this stays pure and the test suite can assert the slots clear them.
export const FURNITURE_ZONES = [
  { x: 3, z: 4, r: 2 }, // table + cake
  { x: -1, z: 6.5, r: 1.4 }, // presents
  { x: 8, z: 1, r: 2.6 }, // party kit (speakers, crates, disco ball)
  { x: -7, z: 9, r: 1.4 }, // the Joker's chair
];

export function clearsFurniture(p, zones = FURNITURE_ZONES) {
  return zones.every((z) => Math.hypot(p.x - z.x, p.z - z.z) >= z.r);
}
