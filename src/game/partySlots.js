// src/game/partySlots.js
// Pure guest placement data for the finale rooftop party (GCPD roof, SITES.start / signal,
// y 42): no three.js, no DOM, so it is cheap to unit test. Positions are local to the roof
// centre (0, 0). A loose half-circle of guests faces a dance floor between the DJ booth and the
// cake (which is src/game/finale.js's own cake prop at its table, reused rather than duplicated:
// the baker guest stands beside it instead of bringing a second one). Every slot also clears
// Batman's arrival points (SITES.start and SITES.signal / the Batsignal) by KEEPOUT_DIST, and
// finale.js's other furniture (the presents, the party kit, the Joker's chair).
export const PARTY_Y = 42;

// SITES.start and SITES.signal (src/world/mapData.js): kept here, not imported, so this module
// stays free of any three.js/city dependency.
export const KEEPOUT_POINTS = [{ id: 'start', x: 6, z: 10 }, { id: 'signal', x: -12, z: -12 }];
export const KEEPOUT_DIST = 5;

// One or more (x, z, yaw) spots per guest id: 'band' and 'kids' place a small cluster. The dance
// floor sits around (-2, 3): the DJ booth (west) faces it across from the cake (east), and
// everyone else forms a loose arc south of it, all yawed roughly toward the middle.
export const GUEST_SLOTS = {
  dj: [{ x: -9, z: 2, yaw: -1.0 }],
  baker: [{ x: 5.6, z: 2.6, yaw: 2.4 }],
  band: [{ x: -6, z: -2.4, yaw: 0.7 }, { x: -3.8, z: -1.2, yaw: 0.5 }, { x: -8, z: -1, yaw: 0.9 }],
  gordon: [{ x: -3, z: -6.5, yaw: 0.9 }],
  alfred: [{ x: 2.5, z: -7, yaw: 1.6 }],
  nightwing: [{ x: -8.5, z: -6.2, yaw: 0.6 }],
  kids: [{ x: 1, z: -9.5, yaw: -0.4 }, { x: 3.2, z: -10.6, yaw: -0.6 }, { x: -1.2, z: -10.4, yaw: -0.2 }],
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
// The cake's own zone is drawn a little wider: the baker stands close beside it on purpose, but
// must not stand on the table.
export const FURNITURE_ZONES = [
  { x: 3, z: 4, r: 1.9 }, // table + cake (reused, not duplicated: see src/game/party.js)
  { x: -1, z: 6.5, r: 1.4 }, // presents
  { x: 8, z: 1, r: 2.6 }, // party kit (speakers, crates, disco ball)
  { x: -7, z: 9, r: 1.4 }, // the Joker's chair
];

export function clearsFurniture(p, zones = FURNITURE_ZONES) {
  return zones.every((z) => Math.hypot(p.x - z.x, p.z - z.z) >= z.r);
}

// Clears every keepout point (Batman's arrival spots) by at least `dist`.
export function clearsKeepout(p, dist = KEEPOUT_DIST, points = KEEPOUT_POINTS) {
  return points.every((k) => Math.hypot(p.x - k.x, p.z - k.z) >= dist);
}
