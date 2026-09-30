// tests/unit/interiors.test.js: Part I (enterable interiors). Pure room-bounds/door logic, plus
// the SITES the encounters system spawns fights at, checked against the real collision built by
// buildInteriors() with a stub ctx (the same pattern as tests/unit/sawtoothRoof.test.js).
import { describe, it, expect } from 'vitest';
import { INTERIOR_ROOMS, roomBounds, insideRoom, roomAt, buildInteriors, createInteriors } from '../../src/world/interiors.js';
import { lobbyInView, LOBBY_VIEW_DIST } from '../../src/game/gcpdLobby.js';
import { createCollision } from '../../src/world/collision.js';
import { createClimbables } from '../../src/world/climbables.js';
import { SITES } from '../../src/world/mapData.js';

function buildCtx() {
  const collision = createCollision();
  const ctx = {
    collision,
    materials: {},
    buckets: { add() {} },
    scene: { add() {} },
    halos: { add: () => 0 },
    grapple: [],
    lights: [],
    reflect: [],
    steam: [],
    updaters: [],
    climbables: createClimbables(),
  };
  buildInteriors(ctx);
  return ctx;
}

describe('interior room bounds', () => {
  it('room centres and door thresholds read as inside; the open plaza and yard do not', () => {
    const fh = INTERIOR_ROOMS.funhouse, ace = INTERIOR_ROOMS.aceHall;
    expect(insideRoom(fh, { x: -120, y: 1, z: -150 })).toBe(true);
    expect(insideRoom(fh, { x: -120, y: 0, z: -120 })).toBe(true); // a step past the plaza doors
    expect(insideRoom(fh, { x: -120, y: 0, z: -105 })).toBe(false); // out in the plaza
    expect(insideRoom(ace, { x: 140, y: 1, z: -172 })).toBe(true);
    expect(insideRoom(ace, { x: 111, y: 0, z: -164 })).toBe(true); // a step past the dock door
    expect(insideRoom(ace, { x: 95, y: 0, z: -164 })).toBe(false); // out in the yard
  });

  it('roomAt tells the two rooms apart and returns null everywhere else', () => {
    expect(roomAt({ x: -120, y: 1, z: -150 })).toBe('funhouse');
    expect(roomAt({ x: 140, y: 1, z: -172 })).toBe('aceHall');
    expect(roomAt({ x: 0, y: 1, z: 50 })).toBe(null);
  });

  it('roomBounds pads every side outward from the clear floor plan', () => {
    const b = roomBounds(INTERIOR_ROOMS.funhouse);
    const raw = INTERIOR_ROOMS.funhouse.bounds;
    expect(b.minX).toBeLessThan(raw.minX);
    expect(b.maxX).toBeGreaterThan(raw.maxX);
    expect(b.minZ).toBeLessThan(raw.minZ);
    expect(b.maxZ).toBeGreaterThan(raw.maxZ);
  });
});

describe('the gcpd lobby', () => {
  it('the lobby floor and a step past the street doors read as inside; the plaza does not', () => {
    const g = INTERIOR_ROOMS.gcpd;
    expect(insideRoom(g, { x: 0, y: 1, z: 0 })).toBe(true);
    expect(insideRoom(g, { x: 0, y: 0, z: 19 })).toBe(true); // a step past the street doors
    expect(insideRoom(g, { x: 0, y: 0, z: 25 })).toBe(false); // out on the plaza (the outside pose)
    expect(roomAt({ x: 0, y: 1, z: 0 })).toBe('gcpd');
  });

  it('SITES.gcpdLobby (the fight/arrival spot) sits on solid floor, inside the room', () => {
    const ctx = buildCtx();
    const y = ctx.collision.groundBelow(SITES.gcpdLobby.x, SITES.gcpdLobby.y, SITES.gcpdLobby.z, 0.3);
    expect(Math.abs(y - SITES.gcpdLobby.y)).toBeLessThanOrEqual(0.35);
    expect(insideRoom(INTERIOR_ROOMS.gcpd, SITES.gcpdLobby)).toBe(true);
  });

  it('the fight site matches the pure room data', () => {
    expect(SITES.gcpdLobby).toMatchObject({ x: INTERIOR_ROOMS.gcpd.fight.x, z: INTERIOR_ROOMS.gcpd.fight.z });
  });

  it('the street doors are a real, walkable gap: no wall blocks a straight line through them', () => {
    const ctx = buildCtx();
    const d = { x: 0 - 0, y: 0, z: 15 - 24 };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = ctx.collision.raycast({ x: 0, y: 1.2, z: 24 }, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
    expect(hit).toBe(null);
  });

  it('the north, east and west walls are real collision (only the south door face is open)', () => {
    const ctx = buildCtx();
    const blocked = (a, b) => {
      const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const len = Math.hypot(d.x, d.y, d.z);
      return !!ctx.collision.raycast(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
    };
    expect(blocked({ x: 0, y: 1.2, z: 10 }, { x: 0, y: 1.2, z: -30 })).toBe(true); // north wall
    expect(blocked({ x: 10, y: 1.2, z: 0 }, { x: 30, y: 1.2, z: 0 })).toBe(true); // east wall
    expect(blocked({ x: -10, y: 1.2, z: 0 }, { x: -30, y: 1.2, z: 0 })).toBe(true); // west wall
  });

  it('the lobby ceiling is real collision, so the follow camera cannot see through to the tower above', () => {
    const ctx = buildCtx();
    const hit = ctx.collision.raycast({ x: 0, y: 2, z: 0 }, { x: 0, y: 1, z: 0 }, 30);
    expect(hit).toBeTruthy();
    expect(hit.box.tag).toBe('ceiling');
  });

  it('the holding cell bars stand as real collision', () => {
    const ctx = buildCtx();
    // A wall-tagged box near the east cells (x around 15.5 to 18), not just the plain east wall
    // (x = 20): confirms the cell bar posts, not only the exterior, were actually built.
    expect(ctx.collision.boxes.some((bx) => bx.tag === 'building' && bx.minX > 15 && bx.maxX < 19)).toBe(true);
  });
});

describe('interior collision (built with a stub ctx)', () => {
  it('SITES.funhouse and SITES.aceHall (the fight spots) sit on solid floor', () => {
    const ctx = buildCtx();
    for (const site of [SITES.funhouse, SITES.aceHall]) {
      const y = ctx.collision.groundBelow(site.x, site.y, site.z, 0.3);
      expect(Math.abs(y - site.y)).toBeLessThanOrEqual(0.35);
    }
  });

  it('the fight sites match the pure room data (nave centre, hall centre)', () => {
    expect(SITES.funhouse).toMatchObject({ x: INTERIOR_ROOMS.funhouse.fight.x, z: INTERIOR_ROOMS.funhouse.fight.z });
    expect(SITES.aceHall).toMatchObject({ x: INTERIOR_ROOMS.aceHall.fight.x, z: INTERIOR_ROOMS.aceHall.fight.z });
  });

  it('the plaza doors and the loading dock are real, walkable gaps: no wall blocks a straight line through them at standing height', () => {
    const ctx = buildCtx();
    const clearAt = (a, b) => {
      const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const len = Math.hypot(d.x, d.y, d.z);
      const hit = ctx.collision.raycast(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
      return !hit;
    };
    // Straight through the cathedral's plaza doors, from the plaza to just inside the nave.
    expect(clearAt({ x: -120, y: 1.2, z: -110 }, { x: -120, y: 1.2, z: -122 })).toBe(true);
    // Straight through the Ace Chemicals loading dock, from the yard to just inside the hall.
    expect(clearAt({ x: 96, y: 1.2, z: -164 }, { x: 112, y: 1.2, z: -164 })).toBe(true);
  });

  it('the nave and hall ceilings are real collision, so the follow camera cannot see through the roof', () => {
    const ctx = buildCtx();
    const hit = ctx.collision.raycast({ x: -120, y: 5, z: -150 }, { x: 0, y: 1, z: 0 }, 30);
    expect(hit).toBeTruthy();
    expect(hit.box.tag).toBe('ceiling');
    const hit2 = ctx.collision.raycast({ x: 150, y: 5, z: -178 }, { x: 0, y: 1, z: 0 }, 30);
    expect(hit2).toBeTruthy();
    expect(hit2.box.tag).toBe('ceiling');
  });

  it('the funhouse pillars and the hall catwalks stand as real collision', () => {
    const ctx = buildCtx();
    expect(ctx.collision.boxes.some((b) => b.tag === 'pillar')).toBe(true);
    expect(ctx.collision.boxes.some((b) => b.tag === 'catwalk')).toBe(true);
  });
});

describe('createInteriors runtime', () => {
  function makeHero(pos) { return { pos, teleport(p) { Object.assign(pos, p); } }; }

  it('enter()/exit() set inside, emit roomEnter/roomExit, and hide the rain while inside', () => {
    const seen = [];
    const events = { on() {}, emit(name, data) { seen.push([name, data]); } };
    const rain = { mesh: { visible: true } };
    const hero = makeHero({ x: 0, y: 0, z: 0 });
    const interiors = createInteriors({ hero, events, rain });
    expect(interiors.inside).toBe(null);
    interiors.enter('funhouse');
    expect(interiors.inside).toBe('funhouse');
    expect(rain.mesh.visible).toBe(false);
    expect(seen).toContainEqual(['roomEnter', { id: 'funhouse' }]);
    interiors.exit();
    expect(interiors.inside).toBe(null);
    expect(rain.mesh.visible).toBe(true);
    expect(seen).toContainEqual(['roomExit', { id: 'funhouse' }]);
  });

  it('update() detects walking through a doorway automatically, without enter()/exit()', () => {
    const events = { on() {}, emit() {} };
    const hero = makeHero({ x: -120, y: 0, z: -105 }); // out in the plaza
    const interiors = createInteriors({ hero, events });
    interiors.update();
    expect(interiors.inside).toBe(null);
    hero.pos.z = -150; // walked in through the plaza doors
    interiors.update();
    expect(interiors.inside).toBe('funhouse');
    hero.pos.z = -105; // walked back out
    interiors.update();
    expect(interiors.inside).toBe(null);
  });
});

describe('lobbyInView', () => {
  it('shows the lobby from inside it, at its door and from the GCPD roof', () => {
    expect(lobbyInView({ x: 0, y: 1.7, z: 6 })).toBe(true);
    expect(lobbyInView({ x: 0, y: 2, z: 30 })).toBe(true);
    expect(lobbyInView({ x: 6, y: 45, z: 10 })).toBe(true);
    expect(lobbyInView({ x: LOBBY_VIEW_DIST - 1, y: 3, z: 0 })).toBe(true);
  });
  it('hides it from across the city', () => {
    expect(lobbyInView({ x: 95, y: 2, z: -140 })).toBe(false);
    expect(lobbyInView({ x: -62, y: 60, z: -150 })).toBe(false);
  });
});
