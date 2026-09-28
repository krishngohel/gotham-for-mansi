import { describe, it, expect } from 'vitest';
import { ROOMS, ROOM_IDS, roomSquad, roomSpots, stealthFight } from '../../src/stealth/stealthRooms.js';
import { segmentHitsRect } from '../../src/stealth/patrol.js';
import { SITES } from '../../src/world/mapData.js';

const inside = (b, p) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y >= b.minY && p.y <= b.maxY;
function legs(route) {
  const pts = route.points, out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  if (route.mode === 'loop' && pts.length > 2) out.push([pts.at(-1), pts[0]]);
  return out;
}
// Everything a goon could walk into: cover, perch columns, catwalk posts and lamp posts, with their heights.
function obstacles(room) {
  return [
    ...room.cover.map((c) => ({ x: c.x, z: c.z, w: c.w, d: c.d, y0: c.y, y1: c.y + c.h })),
    ...room.columns.map((c) => ({ x: c.x, z: c.z, w: 1, d: 1, y0: c.y0, y1: c.top })),
    ...room.posts.map((p) => ({ x: p.x, z: p.z, w: 0.2, d: 0.2, y0: p.y0, y1: p.y1 })),
    ...room.lights.filter((l) => l.lamp === 'post').map((l) => ({ x: l.x, z: l.z, w: 0.3, d: 0.3, y0: l.base, y1: l.y })),
  ];
}

describe('the predator rooms', () => {
  it('has the two story rooms', () => {
    expect(ROOM_IDS).toEqual(['monarchBalcony', 'aceCatwalks']);
  });
  it('each room points at real sites and has four perches, lights, a huddle and a squad of four', () => {
    for (const r of Object.values(ROOMS)) {
      expect(SITES[r.site], r.id).toBeDefined();
      expect(SITES[r.entry], r.id).toBeDefined();
      expect(r.perches).toHaveLength(4);
      expect(r.lights.length).toBeGreaterThan(2);
      expect(r.huddle).toBeTruthy();
      expect(r.squad).toHaveLength(4);
      expect(r.name).not.toMatch(/[–—]/);
    }
  });
  it('the balcony has three rifles and one thug; the catwalks four rifles, a vent and catwalk decks', () => {
    const count = (r, t) => r.squad.filter((g) => g.type === t).length;
    expect([count(ROOMS.monarchBalcony, 'rifle'), count(ROOMS.monarchBalcony, 'grunt')]).toEqual([3, 1]);
    expect(count(ROOMS.aceCatwalks, 'rifle')).toBe(4);
    expect(ROOMS.aceCatwalks.vent).toMatchObject({ w: 3, d: 3 });
    expect(ROOMS.aceCatwalks.decks.every((d) => d.kind === 'catwalk')).toBe(true);
  });
  it('every route point, perch, light and the huddle sit inside the room bounds', () => {
    for (const r of Object.values(ROOMS)) {
      for (const g of [...r.squad, ...r.encore]) for (const p of g.route.points) expect(inside(r.bounds, p), `${r.id} ${JSON.stringify(p)}`).toBe(true);
      for (const p of r.perches) expect(inside(r.bounds, p), `${r.id} perch`).toBe(true);
      for (const l of r.lights) expect(inside(r.bounds, { ...l, y: r.bounds.minY }), `${r.id} light`).toBe(true);
      expect(inside(r.bounds, r.huddle)).toBe(true);
    }
  });
  it('every leg stays on one level and keeps half a metre clear of cover, columns and posts', () => {
    for (const r of Object.values(ROOMS)) {
      const obs = obstacles(r);
      for (const g of [...r.squad, ...r.encore]) {
        for (const [a, b] of legs(g.route)) {
          expect(a.y, `${r.id} leg height`).toBe(b.y);
          for (const o of obs) {
            if (o.y1 < a.y || o.y0 > a.y + 1.8) continue;
            expect(segmentHitsRect(a, b, o, 0.5), `${r.id} ${JSON.stringify([a, b, o])}`).toBe(false);
          }
        }
      }
    }
  });
  it('roomSpots lists every walkable route point once', () => {
    const spots = roomSpots(ROOMS.aceCatwalks);
    expect(spots.length).toBeGreaterThan(8);
    expect(new Set(spots.map((s) => `${s.x},${s.y},${s.z}`)).size).toBe(spots.length);
  });
  it('stealthFight spawns the squad on its route starts', () => {
    const f = stealthFight('aceCatwalks');
    const site = SITES.aceCatwalks;
    expect(f).toMatchObject({ site: 'aceCatwalks', entry: 'aceCatwalksEntry', stealth: 'aceCatwalks', squad: 'main', radius: 24 });
    expect(f.waves).toHaveLength(1);
    f.waves[0].forEach((w, i) => {
      const p = ROOMS.aceCatwalks.squad[i].route.points[0];
      expect(w).toEqual({ type: ROOMS.aceCatwalks.squad[i].type, dx: p.x - site.x, dz: p.z - site.z, y: p.y });
    });
    expect(() => stealthFight('nope')).toThrow();
  });
  it('the encore squads (post-game) are at least as armed and one bigger on the catwalks', () => {
    for (const r of Object.values(ROOMS)) {
      const rifles = (l) => l.filter((g) => g.type === 'rifle').length;
      expect(rifles(roomSquad(r, 'encore'))).toBeGreaterThanOrEqual(rifles(roomSquad(r)));
    }
    expect(roomSquad(ROOMS.aceCatwalks, 'encore')).toHaveLength(5);
    expect(stealthFight('monarchBalcony', { squad: 'encore' }).waves[0].every((w) => w.type === 'rifle')).toBe(true);
  });
});
