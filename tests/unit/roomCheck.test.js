import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';
import { checkRooms } from '../../src/stealth/roomCheck.js';

const route = (...points) => ({ mode: 'pingpong', points });
const P = (x, y, z) => ({ x, y, z });
const room = (o = {}) => ({
  id: 'test', entry: 'e', site: 's',
  bounds: { minX: -50, maxX: 50, minY: -5, maxY: 20, minZ: -50, maxZ: 50 },
  perches: [{ x: 0, y: 5, z: 10 }], huddle: P(5, 0, 5), vent: null,
  squad: [{ type: 'rifle', route: route(P(-10, 0, 0), P(10, 0, 0)) }], encore: [],
  ...o,
});
const sites = { e: P(0, 0, -5), s: P(0, 0, 0) };
const perchPoints = [{ x: 0, y: 5.9, z: 10, perch: true }];
function world({ gap = false, wall = false, hide = false, overlap = false } = {}) {
  const c = createCollision({ floor: () => -Infinity });
  if (gap) { c.addBox(-30, -1, -30, -2, 0, 30, 'floor'); c.addBox(2, -1, -30, 30, 0, 30, 'floor'); }
  else c.addBox(-30, -1, -30, 30, 0, 30, 'floor');
  if (wall) c.addBox(-0.2, 0, -3, 0.2, 3, 3, 'wall');
  if (hide) c.addBox(-30, 0, 7, 30, 20, 8, 'wall');
  if (overlap) { c.addBox(3, 0, -9, 4, 1, -8, 'crate'); c.addBox(3.5, 0, -8.5, 4.5, 1, -7.5, 'stealthCover'); }
  c.addBox(-0.45, 0, 9.4, 0.45, 5.9, 10.6, 'gargoyle');
  return c;
}
const kinds = (rep) => rep.map((r) => r.kind);

describe('checkRooms', () => {
  it('a sound room passes', () => {
    expect(checkRooms(world(), perchPoints, { test: room() }, sites)).toEqual([]);
  });
  it('reports a wall across a leg', () => {
    expect(kinds(checkRooms(world({ wall: true }), perchPoints, { test: room() }, sites))).toContain('blocked');
  });
  it('reports a hole under a leg', () => {
    expect(kinds(checkRooms(world({ gap: true }), perchPoints, { test: room() }, sites))).toContain('gap');
  });
  it('reports a patrol point off its floor', () => {
    const r = room({ squad: [{ type: 'rifle', route: route(P(-10, 1, 0), P(10, 1, 0)) }] });
    expect(kinds(checkRooms(world(), perchPoints, { test: r }, sites))).toContain('point');
  });
  it('reports a perch with no grapple point, and one nobody in the room can see', () => {
    expect(kinds(checkRooms(world(), [], { test: room() }, sites))).toContain('perch-missing');
    expect(kinds(checkRooms(world({ hide: true }), perchPoints, { test: room() }, sites))).toContain('perch-hidden');
  });
  it('reports an entry, huddle or vent with no floor', () => {
    expect(kinds(checkRooms(world(), perchPoints, { test: room() }, { ...sites, e: P(0, 3, -5) }))).toContain('entry');
    expect(kinds(checkRooms(world(), perchPoints, { test: room({ huddle: P(5, 2, 5) }) }, sites))).toContain('huddle');
    expect(kinds(checkRooms(world(), perchPoints, { test: room({ vent: { x: 0, y: 2, z: -20, w: 3, d: 3 } }) }, sites))).toContain('vent');
  });
  it('reports a set piece inside another box', () => {
    expect(kinds(checkRooms(world({ overlap: true }), perchPoints, { test: room() }, sites))).toContain('overlap');
  });
});
