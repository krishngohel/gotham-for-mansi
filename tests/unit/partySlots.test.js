// tests/unit/partySlots.test.js
import { describe, it, expect } from 'vitest';
import { GUEST_IDS, GUEST_SLOTS, guestSlots, allSlotPoints, farEnough, noOverlaps, clearsFurniture, FURNITURE_ZONES, clearsKeepout, KEEPOUT_POINTS, KEEPOUT_DIST, guestsInView, GUEST_VIEW_DIST, PARTY_Y } from '../../src/game/partySlots.js';

describe('GUEST_SLOTS', () => {
  it('has a slot list for every documented guest id', () => {
    for (const id of ['dj', 'baker', 'band', 'gordon', 'alfred', 'nightwing', 'kids']) {
      expect(GUEST_IDS).toContain(id);
      expect(guestSlots(id).length).toBeGreaterThan(0);
    }
  });
  it('places a small cluster for band and kids, one spot for everyone else', () => {
    expect(guestSlots('band').length).toBe(3);
    expect(guestSlots('kids').length).toBeGreaterThanOrEqual(2);
    expect(guestSlots('dj').length).toBe(1);
  });
  it('an unknown id gets no slots, not a crash', () => {
    expect(guestSlots('joker')).toEqual([]);
  });
});

describe('farEnough', () => {
  it('is true past the distance, false within it, true exactly at it', () => {
    expect(farEnough({ x: 0, z: 0 }, { x: 2, z: 0 }, 1.6)).toBe(true);
    expect(farEnough({ x: 0, z: 0 }, { x: 1, z: 0 }, 1.6)).toBe(false);
    expect(farEnough({ x: 0, z: 0 }, { x: 1.6, z: 0 }, 1.6)).toBe(true);
  });
});

describe('noOverlaps (the real, hand-authored slots)', () => {
  it('keeps every guest spot at least 1.6 m from every other, across all ids', () => {
    expect(noOverlaps(1.6)).toBe(true);
  });
  it('catches an actual overlap (regression guard on the checker itself)', () => {
    const pts = allSlotPoints();
    expect(farEnough(pts[0], { x: pts[0].x + 0.1, z: pts[0].z }, 1.6)).toBe(false);
  });
});

describe('clearsKeepout (Batman\'s arrival points: SITES.start, SITES.signal / the Batsignal)', () => {
  it('every guest slot stays at least 5 m from every keepout point', () => {
    for (const id of GUEST_IDS) for (const p of GUEST_SLOTS[id]) expect(clearsKeepout(p)).toBe(true);
  });
  it('rejects a point actually inside a keepout radius', () => {
    const k = KEEPOUT_POINTS[0];
    expect(clearsKeepout({ x: k.x + 1, z: k.z }, KEEPOUT_DIST)).toBe(false);
  });
  it('accepts a point exactly at the keepout distance', () => {
    const k = KEEPOUT_POINTS[0];
    expect(clearsKeepout({ x: k.x + KEEPOUT_DIST, z: k.z }, KEEPOUT_DIST)).toBe(true);
  });
});

describe('clearsFurniture', () => {
  it('every guest slot clears finale.js\'s own furniture', () => {
    for (const id of GUEST_IDS) for (const p of GUEST_SLOTS[id]) expect(clearsFurniture(p)).toBe(true);
  });
  it('rejects a point actually inside a furniture zone', () => {
    const z = FURNITURE_ZONES[0];
    expect(clearsFurniture({ x: z.x, z: z.z })).toBe(false);
  });
});

describe('guestsInView', () => {
  it('shows the guests anywhere on or near the GCPD roof', () => {
    expect(guestsInView({ x: 0, y: PARTY_Y + 3, z: 0 })).toBe(true);
    expect(guestsInView({ x: 18, y: PARTY_Y + 6, z: -18 })).toBe(true);
    expect(guestsInView({ x: GUEST_VIEW_DIST - 1, y: PARTY_Y, z: 0 })).toBe(true);
  });
  it('hides them from across the city (the clock tower arena, the docks)', () => {
    expect(guestsInView({ x: -62, y: 60, z: -150 })).toBe(false);
    expect(guestsInView({ x: 0, y: 2, z: 178 })).toBe(false);
  });
});
