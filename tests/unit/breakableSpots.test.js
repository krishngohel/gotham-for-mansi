import { describe, it, expect } from 'vitest';
import { BREAKABLES, BREAKABLE_IDS, CACHES, CACHE_IDS, cacheById, roomWalls, cageRoom, nearestLadder, roofEdgeRail, boxDistance, faceFromNormal } from '../../src/world/breakableSpots.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';

describe('breakable data', () => {
  it('has unique ids and the promised mix', () => {
    expect(new Set(BREAKABLE_IDS).size).toBe(BREAKABLES.length);
    const count = (k) => BREAKABLES.filter((b) => b.kind === k).length;
    expect([count('weakWall'), count('glass'), count('vent'), count('railing')]).toEqual([6, 4, 3, 2]);
    const hides = (t) => BREAKABLES.filter((b) => b.hides?.type === t).length;
    expect(hides('balloon')).toBe(1);
    expect(hides('shortcut')).toBe(2);
    expect(hides('cache')).toBe(6);
  });
  it('every cache is hidden behind exactly one breakable', () => {
    for (const c of CACHES) expect(BREAKABLES.filter((b) => b.hides?.id === c.id), c.id).toHaveLength(1);
    expect(CACHE_IDS).toHaveLength(6);
    expect(cacheById('cacheColdStore').xp).toBe(250);
    expect(cacheById('cacheVentGcpd').xp).toBe(100);
  });
});

describe('roomWalls', () => {
  const room = { x: 0, y: 0, z: 0, w: 3, d: 3, h: 3, open: 'w' };
  it('builds the open face as the weak wall and three solid walls', () => {
    const r = roomWalls(room);
    expect(r.weak).toEqual({ minX: -1.5, maxX: -1.2, minZ: -1.5, maxZ: 1.5, minY: 0, maxY: 3 });
    expect(r.solid).toHaveLength(3);
    expect(r.roof).toMatchObject({ minY: 3, maxY: 3.3 });
  });
  it('leaves out the face against a building, and the roof when asked', () => {
    const r = roomWalls({ ...room, against: 'e', noRoof: true });
    expect(r.solid).toHaveLength(2);
    expect(r.solid.some((b) => b.maxX === 1.5 && b.minX === 1.2)).toBe(false);
    expect(r.roof).toBe(null);
  });
  it('the Monarch booth encloses balloon 7 and keeps it out of reach through the wall', () => {
    const booth = BREAKABLES.find((b) => b.hides?.type === 'balloon');
    const bal = BALLOONS[booth.hides.index];
    const { weak } = roomWalls(booth.room);
    const r = booth.room;
    expect(bal.x).toBeGreaterThan(weak.maxX);
    expect(bal.x).toBeLessThan(r.x + r.w / 2);
    expect(Math.abs(bal.z - r.z)).toBeLessThan(r.d / 2 - 0.3);
    expect(bal.y).toBeLessThan(r.y + r.h);
    // Balloons pop inside 2.2 m (balloons.js); a hero pressed against the wall (radius 0.35)
    // standing on the sidewalk must stay outside that.
    const hx = weak.minX - 0.35, dy = r.y + 1 - bal.y;
    expect((hx - bal.x) ** 2 + dy * dy * 0.5).toBeGreaterThan(2.2 * 2.2);
  });
});

describe('cages, ladders and rails', () => {
  const ladder = { id: 3, x: 140, z: 48, nx: 1, nz: 0, bottom: 0, top: 12 };
  it('a cage stands out from the wall with its weak face toward the street', () => {
    const c = cageRoom(ladder);
    expect(c).toMatchObject({ open: 'e', against: 'w', noRoof: true, y: 0 });
    expect(c.x).toBeCloseTo(140.9);
    expect(c.w).toBeCloseTo(1.8);
    expect(c.d).toBeCloseTo(2.2);
  });
  it('nearestLadder takes the closest street-level ladder in range', () => {
    const list = [{ ...ladder, id: 1, z: 60 }, { ...ladder, id: 2, z: 50 }, { ...ladder, id: 4, z: 49, bottom: 6 }];
    expect(nearestLadder(list, 140, 48).id).toBe(2);
    expect(nearestLadder(list, 140, 90)).toBe(null);
  });
  it('faceFromNormal', () => {
    expect([faceFromNormal(1, 0), faceFromNormal(-1, 0), faceFromNormal(0, 1), faceFromNormal(0, -1)]).toEqual(['e', 'w', 's', 'n']);
  });
  it('roofEdgeRail runs along the roof edge nearest the site', () => {
    const roof = { minX: 40, maxX: 80, minZ: 162, maxZ: 198, minY: 0, maxY: 13 };
    const r = roofEdgeRail(roof, 60, 166, 6);
    expect(r).toMatchObject({ face: 'n', nx: 0, nz: -1, minY: 13 });
    expect(r.maxY).toBeCloseTo(14.1);
    expect(r.minX).toBeCloseTo(57);
    expect(r.maxX).toBeCloseTo(63);
    expect(r.minZ).toBeCloseTo(162.025);
  });
  it('boxDistance is 0 inside and the gap outside', () => {
    const b = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    expect(boxDistance(b, { x: 0.5, y: 0.5, z: 0.5 })).toBe(0);
    expect(boxDistance(b, { x: 3, y: 0.5, z: 0.5 })).toBeCloseTo(2);
  });
});
