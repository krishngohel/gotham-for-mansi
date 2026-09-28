# Plan 3B: Traversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ladders, ledge grab and shimmy (with corner wrap), ziplines, wall runs, the dive bomb, and ledge and drop takedowns to the Batman game.

**Architecture:**
- **Moves are controls.** Every move is a *control*: an object `{ name, camera?, update(dt, ctx) -> done }` placed in `hero.control`. That's the mechanism grapple already uses in `src/actors/hero.js`.
- **Separate maths from moves.** Geometry lives in unit-tested modules with no three.js: `src/world/climbables.js` and `src/actors/traverse/probes.js`. Each move's control lives in its own file in `src/actors/traverse/`.
- **Triggers.** `hero.js` only gains small trigger checks that call a factory and set `h.control`.
- **Where the data comes from.** Ladders and ziplines come from a `climbables` registry that the city builder fills. Ledges are found on the fly from collision boxes.

**Tech Stack:** Three.js 0.186, plain ES modules, Vitest 5, playwright-core scripted play (`scripts/dev-play.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-traversal-comic-content-design.md` (Part B).
- No new keys for traversal. The existing actions are `jump`, `sprint`, `forward`, `back`, `left`, `right`, `grapple`, `kick` and `punch`.
- Assets are CC0 or authored in code. New animation clips are authored in code, like `src/actors/kicks.js`.
- No em dashes in any player-facing text: prompts, hints or captions.
- Commits are authored by Krishn Gohel only. Never add a `Co-Authored-By` trailer.
- Never push to `main` from a task. Pushing redeploys the live site. The final task verifies and the lead pushes.
- Don't touch `src/render/*`, `src/world/textures.js`, `src/world/materials.js`, `src/world/skyline.js`, `src/world/sky.js` or `src/world/water.js`. Plan 3A owns those and runs at the same time.
- In `src/world/cityBuilder.js`, edit only `fireEscape()`, `waterTower()`, `finishCity()` and `createCityContext()`. Plan 3A edits other functions in the same file.
- Verify in a browser only against a frozen production build: `npx vite build --outDir "$TEMP/b3dist"` then `npx vite preview --outDir "$TEMP/b3dist" --port 5204 --strictPort`. The dev server reloads whenever the other plan edits files.
- `window.__game` exposes `hero`, `combat`, `enemies`, `teleport(site|{x,y,z})`, `spawn(type,p)` and `comic.skip()`. URL flags: `?at=<stepId>`, `?god=1`, `?fight=test`.

## File Structure

| File | Responsibility |
|---|---|
| `src/world/climbables.js` (new) | Registry of ladders and ziplines, plus pure ladder and zipline maths |
| `src/actors/traverse/probes.js` (new) | Pure collision probes: `findLedge`, `wrapCorner`, `findRunWall` |
| `src/actors/traverse/ladder.js` (new) | Ladder control |
| `src/actors/traverse/ledge.js` (new) | Hang and shimmy control, pull-up, drop, backflip, ledge takedown |
| `src/actors/traverse/zipline.js` (new) | Zipline ride control |
| `src/actors/traverse/wallrun.js` (new) | Wall-run control |
| `src/actors/traverse/divebomb.js` (new) | Dive-bomb control |
| `src/actors/climbAnims.js` (new) | Code-authored clips: `Ladder_Climb`, `Ladder_Idle`, `Hang_Idle`, `Shimmy`, `Zip_Hang`, `WallRun_Loop`, `Dive`, `Ledge_Yank` |
| `src/world/ziplines.js` (new) | Zipline routes, cable and post meshes |
| `src/actors/hero.js` (modify) | Expose helpers, add trigger checks, camera modes |
| `src/world/cityBuilder.js` (modify) | Ladder geometry and registration in `fireEscape()` and `waterTower()`; `climbables` on the context |
| `src/game/world.js` (modify) | Build ziplines, return `climbables` |
| `src/game/game.js` (modify) | Pass climbables to the hero, register clips, grapple targets for zips and ledges, hints |
| `src/game/camera.js` (modify) | `climb` and `hang` camera modes |
| `src/combat/combatSystem.js` (modify) | `shockwave()` for the dive bomb, `takedown()` for ledge and drop takedowns |
| `src/ui/prompts.js`, `src/ui/menus.js`, `src/core/settings.js` (modify) | Hints, help page, the `autoLedge` setting |
| `tests/unit/climbables.test.js`, `tests/unit/probes.test.js` (new) | Unit tests |

## Shared interfaces (every task relies on these exact names)

```js
// src/world/climbables.js
createClimbables() -> { ladders: Ladder[], ziplines: Zipline[] }
// Ladder: { id, x, z, nx, nz, bottom, top }
//   (x, z) is where the ladder meets the wall. (nx, nz) is the wall's outward unit normal.
//   The climber stands at (x + nx*0.45, z + nz*0.45). Climbing off the top steps toward -n.
addLadder(climbables, { x, z, nx, nz, bottom, top }) -> Ladder
ladderGrab(ladders, pos, { reach = 0.7, facingX, facingZ } = {}) -> { ladder, y } | null
ladderTopGrab(ladders, pos, facingX, facingZ, { reach = 0.9 } = {}) -> Ladder | null
ladderExit(ladder) -> { x, z }   // where the pull-up at the top lands (then snap y with groundBelow)
// Zipline: { id, a: {x,y,z}, b: {x,y,z}, length, dir: {x,y,z} (unit a->b) }
addZipline(climbables, a, b) -> Zipline
zipPoint(line, s) -> { x, y, z }          // s = metres from a, clamped to [0, length]
zipClosest(line, p) -> { s, dist }        // nearest point on the cable
zipSpeed(line, speed, dt) -> number       // gravity along the slope plus drag, capped at 30 m/s

// src/actors/traverse/probes.js
findLedge(collision, pos, dirX, dirZ, opts?) -> Ledge | null
// Ledge: { x, y, z, nx, nz, axis: 'x'|'z', min, max, box }
//   (x, y, z) is the edge point at the top. n is the face's outward normal.
//   axis is the world axis the edge runs along. min and max are that axis's usable range.
hangPos(ledge) -> { x, y, z }   // feet position while hanging
wrapCorner(collision, ledge, dir /* -1 | 1 along axis */) -> Ledge | null   // outside corner onto the next face
findRunWall(collision, pos, velX, velZ, opts?) -> { nx, nz, alongX, alongZ, side } | null

// Every control factory: createXControl(hero, deps, args) -> { name, camera, update(dt, ctx) -> boolean }
// deps = { collision, climbables, events, combat? }
```

`hero.js` exposes these for the controls (Task 3 adds them):
- `h.setState(s)` and `h.faceTowards(dx, dz, rate, dt)`
- `h.integrate(dt) -> collision result`
- `h.startGlide()` and `h.land(impactVy)`
- `h.RADIUS`, `h.HEIGHT`, `h.GRAVITY`
- `h.airRuns`: a counter, reset on landing, used by the one-run-per-airtime rule
- `h.lastClimbT`: the time since the last traversal exit, so a move you just left can't instantly grab you again

---

### Task 1: Climbables registry and pure maths

**Files:**
- Create: `src/world/climbables.js`
- Test: `tests/unit/climbables.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: everything listed under `src/world/climbables.js` above.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/climbables.test.js
import { describe, it, expect } from 'vitest';
import { createClimbables, addLadder, ladderGrab, ladderTopGrab, ladderExit, addZipline, zipPoint, zipClosest, zipSpeed } from '../../src/world/climbables.js';

describe('ladders', () => {
  const c = createClimbables();
  // A ladder on a wall facing +z, from the street to a 10 m roof.
  addLadder(c, { x: 5, z: 20, nx: 0, nz: 1, bottom: 0, top: 10 });

  it('grabs when standing at the foot facing the wall', () => {
    const g = ladderGrab(c.ladders, { x: 5, y: 0, z: 20.5 }, { facingX: 0, facingZ: -1 });
    expect(g.ladder.id).toBe(0);
    expect(g.y).toBe(0);
  });
  it('does not grab when facing away', () => {
    expect(ladderGrab(c.ladders, { x: 5, y: 0, z: 20.5 }, { facingX: 0, facingZ: 1 })).toBe(null);
  });
  it('does not grab from too far away or above the top', () => {
    expect(ladderGrab(c.ladders, { x: 7, y: 0, z: 20.5 }, { facingX: 0, facingZ: -1 })).toBe(null);
    expect(ladderGrab(c.ladders, { x: 5, y: 11, z: 20.5 }, { facingX: 0, facingZ: -1 })).toBe(null);
  });
  it('clamps a mid-air catch below the top rung', () => {
    const g = ladderGrab(c.ladders, { x: 5, y: 9.8, z: 20.4 }, {});
    expect(g.y).toBeCloseTo(9, 5);
  });
  it('grabs from the roof when walking toward the edge', () => {
    const l = ladderTopGrab(c.ladders, { x: 5, y: 10, z: 19.3 }, 0, 1);
    expect(l?.id).toBe(0);
    expect(ladderTopGrab(c.ladders, { x: 5, y: 10, z: 19.3 }, 0, -1)).toBe(null);
  });
  it('exits the top toward the roof', () => {
    const e = ladderExit(c.ladders[0]);
    expect(e.x).toBeCloseTo(5, 5);
    expect(e.z).toBeCloseTo(19.2, 5);
  });
});

describe('ziplines', () => {
  const c = createClimbables();
  const z = addZipline(c, { x: 0, y: 30, z: 0 }, { x: 40, y: 20, z: 0 });

  it('stores length and direction', () => {
    expect(z.length).toBeCloseTo(Math.hypot(40, 10), 5);
    expect(z.dir.x).toBeCloseTo(40 / z.length, 5);
  });
  it('interpolates and clamps points on the cable', () => {
    expect(zipPoint(z, 0)).toEqual({ x: 0, y: 30, z: 0 });
    const end = zipPoint(z, 999);
    expect(end.x).toBeCloseTo(40, 5);
    expect(end.y).toBeCloseTo(20, 5);
  });
  it('finds the closest point', () => {
    const r = zipClosest(z, { x: 20, y: 24, z: 1 });
    expect(r.s).toBeGreaterThan(19);
    expect(r.s).toBeLessThan(22);
    expect(r.dist).toBeLessThan(2);
  });
  it('speeds up downhill and caps at 30', () => {
    let v = 5;
    for (let i = 0; i < 600; i++) v = zipSpeed(z, v, 1 / 60);
    expect(v).toBeGreaterThan(15);
    expect(v).toBeLessThanOrEqual(30);
  });
  it('keeps a minimum crawl on a flat or uphill cable', () => {
    const flat = addZipline(c, { x: 0, y: 10, z: 0 }, { x: 30, y: 12, z: 0 });
    let v = 2;
    for (let i = 0; i < 120; i++) v = zipSpeed(flat, v, 1 / 60);
    expect(v).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/climbables.test.js`
Expected: FAIL, "Failed to resolve import ../../src/world/climbables.js".

- [ ] **Step 3: Implement**

```js
// src/world/climbables.js
// Ladders and ziplines the hero can use. Filled by the city builder, read by the traversal
// controls. Pure data and maths: no three.js, so it is unit-tested.
const ZIP_MAX = 30, ZIP_MIN = 8, ZIP_G = 26;

export function createClimbables() {
  return { ladders: [], ziplines: [] };
}

export function addLadder(c, { x, z, nx, nz, bottom, top }) {
  const l = { id: c.ladders.length, x, z, nx, nz, bottom, top };
  c.ladders.push(l);
  return l;
}

const stand = (l) => ({ x: l.x + l.nx * 0.45, z: l.z + l.nz * 0.45 });

// Catch a ladder from the ground or mid-air. Facing is optional (a falling hero catches any
// ladder they drift into).
export function ladderGrab(ladders, p, { reach = 0.7, facingX, facingZ } = {}) {
  for (const l of ladders) {
    const s = stand(l);
    if (Math.hypot(p.x - s.x, p.z - s.z) > reach) continue;
    if (p.y < l.bottom - 0.3 || p.y > l.top - 0.2) continue;
    if (facingX !== undefined && facingX * -l.nx + facingZ * -l.nz < 0.5) continue;
    return { ladder: l, y: Math.min(Math.max(p.y, l.bottom), l.top - 1) };
  }
  return null;
}

// Stepping off a roof onto the top of a ladder: standing just inside the edge, facing out.
export function ladderTopGrab(ladders, p, facingX, facingZ, { reach = 0.9 } = {}) {
  for (const l of ladders) {
    if (Math.abs(p.y - l.top) > 0.4) continue;
    const e = ladderExit(l);
    if (Math.hypot(p.x - e.x, p.z - e.z) > reach) continue;
    if (facingX * l.nx + facingZ * l.nz < 0.6) continue;
    return l;
  }
  return null;
}

export function ladderExit(l) {
  return { x: l.x - l.nx * 0.8, z: l.z - l.nz * 0.8 };
}

export function addZipline(c, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  const line = { id: c.ziplines.length, a: { ...a }, b: { ...b }, length, dir: { x: dx / length, y: dy / length, z: dz / length } };
  c.ziplines.push(line);
  return line;
}

export function zipPoint(line, s) {
  const k = Math.min(Math.max(s, 0), line.length);
  return { x: line.a.x + line.dir.x * k, y: line.a.y + line.dir.y * k, z: line.a.z + line.dir.z * k };
}

export function zipClosest(line, p) {
  const s = Math.min(Math.max((p.x - line.a.x) * line.dir.x + (p.y - line.a.y) * line.dir.y + (p.z - line.a.z) * line.dir.z, 0), line.length);
  const q = zipPoint(line, s);
  return { s, dist: Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) };
}

// Gravity along the cable minus a little drag. A flat or uphill cable still carries you at a
// crawl, as if the zipline has a motor.
export function zipSpeed(line, speed, dt) {
  const v = speed + (ZIP_G * -line.dir.y - speed * 0.05) * dt;
  return Math.min(ZIP_MAX, Math.max(ZIP_MIN, v));
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run tests/unit/climbables.test.js`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/world/climbables.js tests/unit/climbables.test.js
git commit -m "Climbables registry: ladder and zipline maths"
```

---

### Task 2: Collision probes for ledges, corners and wall runs

**Files:**
- Create: `src/actors/traverse/probes.js`
- Test: `tests/unit/probes.test.js`

**Interfaces:**
- Consumes: `createCollision` from `src/world/collision.js`, which has `query(minX, minZ, maxX, maxZ)`, `groundBelow(x, y, z, r)` and boxes shaped `{minX, minY, minZ, maxX, maxY, maxZ, tag}`.
- Produces: `findLedge`, `hangPos`, `wrapCorner` and `findRunWall`, exactly as in Shared interfaces.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/probes.test.js
import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';
import { findLedge, hangPos, wrapCorner, findRunWall } from '../../src/actors/traverse/probes.js';

// A 10 m cube building from (0,0,0) to (10,10,10), plus a 4 m-tall box sitting on its roof at the
// north-east corner, which blocks headroom there.
const world = () => {
  const c = createCollision({ floor: () => 0 });
  c.addBox(0, 0, 0, 10, 10, 10, 'building');
  c.addBox(7, 10, 0, 10, 14, 3, 'building');
  return c;
};

describe('findLedge', () => {
  it('finds the south roof edge when falling past it facing north', () => {
    const l = findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    expect(l).not.toBe(null);
    expect(l.y).toBe(10);
    expect(l.nz).toBe(1);
    expect(l.axis).toBe('x');
    expect(l.z).toBe(10);
    expect(l.min).toBeCloseTo(0.35, 5);
    expect(l.max).toBeCloseTo(9.65, 5);
  });
  it('ignores an edge that is too high or too low to reach', () => {
    expect(findLedge(world(), { x: 5, y: 6, z: 10.5 }, 0, -1)).toBe(null);
    expect(findLedge(world(), { x: 5, y: 9.5, z: 10.5 }, 0, -1)).toBe(null);
  });
  it('ignores an edge with no headroom above it', () => {
    // East face near z=1.5: the rooftop box covers the landing spot.
    expect(findLedge(world(), { x: 10.5, y: 8.2, z: 1.5 }, -1, 0)).toBe(null);
  });
  it('ignores an edge behind the hero', () => {
    expect(findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, 1)).toBe(null);
  });
  it('hangs with hands at the top and feet off the wall', () => {
    const l = findLedge(world(), { x: 5, y: 8.2, z: 10.5 }, 0, -1);
    const h = hangPos(l);
    expect(h.y).toBeCloseTo(10 - 2.05, 5);
    expect(h.z).toBeCloseTo(10.38, 5);
  });
});

describe('wrapCorner', () => {
  it('wraps the south-west outside corner onto the west face', () => {
    const l = findLedge(world(), { x: 1, y: 8.2, z: 10.5 }, 0, -1);
    const w = wrapCorner(world(), l, -1);
    expect(w.nx).toBe(-1);
    expect(w.axis).toBe('z');
    expect(w.x).toBe(0);
    expect(w.z).toBeCloseTo(9.65, 5);
  });
  it('refuses to wrap onto a face with no headroom', () => {
    // East face at the north end is under the rooftop box.
    const l = findLedge(world(), { x: 9, y: 8.2, z: -0.5 }, 0, 1);
    expect(l).toBe(null);
  });
});

describe('findRunWall', () => {
  it('finds a tall wall beside a hero running along it', () => {
    const r = findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, 0, 10);
    expect(r).not.toBe(null);
    expect(r.nx).toBe(1);
    expect(r.side).toBe(-1);
  });
  it('rejects a steep approach angle', () => {
    expect(findRunWall(world(), { x: 10.6, y: 0.5, z: 5 }, -9, 3)).toBe(null);
  });
  it('rejects walls that are not buildings or are too short', () => {
    const c = createCollision({ floor: () => 0 });
    c.addBox(0, 0, 0, 10, 3, 10, 'building');
    expect(findRunWall(c, { x: 10.6, y: 0.5, z: 5 }, 0, 10)).toBe(null);
    const d = createCollision({ floor: () => 0 });
    d.addBox(0, 0, 0, 10, 10, 10, 'crate');
    expect(findRunWall(d, { x: 10.6, y: 0.5, z: 5 }, 0, 10)).toBe(null);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/probes.test.js`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 3: Implement**

```js
// src/actors/traverse/probes.js
// Collision probes for ledges and wall runs. Pure: works on the collision module's boxes only.
const HANG_DROP = 2.05, HANG_OUT = 0.38, EDGE_PAD = 0.35;

// Which face of `b` is the point outside of? Returns the outward normal, or null when inside.
function outsideFace(b, x, z) {
  const d = [b.minX - x, x - b.maxX, b.minZ - z, z - b.maxZ];
  const i = d.indexOf(Math.max(...d));
  if (d[i] <= 0) return null;
  return [{ nx: -1, nz: 0 }, { nx: 1, nz: 0 }, { nx: 0, nz: -1 }, { nx: 0, nz: 1 }][i];
}

function makeLedge(b, nx, nz, along) {
  const axis = nx !== 0 ? 'z' : 'x';
  const min = (axis === 'z' ? b.minZ : b.minX) + EDGE_PAD;
  const max = (axis === 'z' ? b.maxZ : b.maxX) - EDGE_PAD;
  const t = Math.min(Math.max(along, min), max);
  const x = nx < 0 ? b.minX : nx > 0 ? b.maxX : t;
  const z = nz < 0 ? b.minZ : nz > 0 ? b.maxZ : t;
  return { x, y: b.maxY, z, nx, nz, axis, min, max, box: b };
}

// Room to stand on top at the pull-up spot, and the edge is the real top there.
function clearAbove(collision, l, headroom) {
  const lx = l.x - l.nx * 0.6, lz = l.z - l.nz * 0.6;
  if (collision.groundBelow(lx, l.y + 0.05, lz, 0.2) > l.y + 0.01) return false;
  return !collision.query(lx - 0.3, lz - 0.3, lx + 0.3, lz + 0.3).some((o) =>
    o !== l.box && o.minY < l.y + headroom && o.maxY > l.y + 0.05 && lx > o.minX - 0.3 && lx < o.maxX + 0.3 && lz > o.minZ - 0.3 && lz < o.maxZ + 0.3);
}

export function findLedge(collision, pos, dirX, dirZ, { minRise = 1.2, maxRise = 2.2, reach = 0.7, headroom = 1.9 } = {}) {
  const px = pos.x + dirX * reach, pz = pos.z + dirZ * reach;
  let best = null;
  for (const b of collision.query(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3)) {
    if (b.tag === 'bound') continue;
    const rise = b.maxY - pos.y;
    if (rise < minRise || rise > maxRise) continue;
    const face = outsideFace(b, pos.x, pos.z);
    if (!face) continue;
    if (dirX * -face.nx + dirZ * -face.nz < 0.5) continue; // must be facing the wall
    const l = makeLedge(b, face.nx, face.nz, face.nx !== 0 ? pos.z : pos.x);
    if (Math.hypot(pos.x - (l.x + l.nx * HANG_OUT), pos.z - (l.z + l.nz * HANG_OUT)) > reach + 0.4) continue;
    if (!clearAbove(collision, l, headroom)) continue;
    if (!best || l.y < best.y) best = l;
  }
  return best;
}

export function hangPos(l) {
  return { x: l.x + l.nx * HANG_OUT, y: l.y - HANG_DROP, z: l.z + l.nz * HANG_OUT };
}

// At an outside corner, carry on around onto the adjacent face of the same box.
// dir is -1 (toward min) or 1 (toward max) along the current edge.
export function wrapCorner(collision, l, dir, { headroom = 1.9 } = {}) {
  const b = l.box;
  let nx, nz, along;
  if (l.axis === 'x') { nx = dir < 0 ? -1 : 1; nz = 0; along = l.nz > 0 ? b.maxZ : b.minZ; }
  else { nx = 0; nz = dir < 0 ? -1 : 1; along = l.nx > 0 ? b.maxX : b.minX; }
  const w = makeLedge(b, nx, nz, along);
  // Something built against that face (an inside corner) blocks the hang spot.
  const h = hangPos(w);
  const blocked = collision.query(h.x - 0.3, h.z - 0.3, h.x + 0.3, h.z + 0.3).some((o) =>
    o !== b && o.tag !== 'bound' && o.maxY > h.y && o.minY < w.y && h.x > o.minX - 0.3 && h.x < o.maxX + 0.3 && h.z > o.minZ - 0.3 && h.z < o.maxZ + 0.3);
  if (blocked || !clearAbove(collision, w, headroom)) return null;
  return w;
}

// A building wall beside a running hero, at a shallow angle, tall enough to run on.
export function findRunWall(collision, pos, velX, velZ, { maxAngle = 0.61, reach = 0.8, minHeight = 4 } = {}) {
  const sp = Math.hypot(velX, velZ);
  if (sp < 4) return null;
  const fx = velX / sp, fz = velZ / sp;
  for (const side of [-1, 1]) {
    const sx = fz * side, sz = -fx * side; // perpendicular probe; side -1 is the wall the tests call left
    const px = pos.x + sx * reach, pz = pos.z + sz * reach;
    for (const b of collision.query(px - 0.2, pz - 0.2, px + 0.2, pz + 0.2)) {
      if (b.tag !== 'building' || b.maxY - b.minY < minHeight || b.maxY < pos.y + 2.5 || b.minY > pos.y + 0.5) continue;
      const face = outsideFace(b, pos.x, pos.z);
      if (!face) continue;
      // Travel must run along the face: the angle between velocity and the face plane.
      const into = fx * -face.nx + fz * -face.nz;
      if (Math.asin(Math.min(1, Math.abs(into))) > maxAngle) continue;
      const alongX = face.nz !== 0 ? Math.sign(fx) || 1 : 0, alongZ = face.nx !== 0 ? Math.sign(fz) || 1 : 0;
      return { nx: face.nx, nz: face.nz, alongX, alongZ, side, box: b };
    }
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run tests/unit/probes.test.js`
Expected: PASS (10 tests). The tests fix `side` as `-1` for a wall at +x while running +z. The wall-run control only uses `side` to lean the body away from the wall, so keep that convention.

- [ ] **Step 5: Commit**

```bash
git add src/actors/traverse/probes.js tests/unit/probes.test.js
git commit -m "Traversal probes: ledges, corner wrap, wall-run walls"
```

---

### Task 3: Hero hooks and code-authored climb animations

**Files:**
- Create: `src/actors/climbAnims.js`
- Modify: `src/actors/hero.js` (expose helpers, `airRuns`, `lastClimbT`)
- Modify: `src/game/game.js:64` (register the clips next to the kick clips)
- Modify: `src/game/camera.js:4-11` (add modes)

**Interfaces:**
- Consumes: `buildKickClips` helpers pattern (copy `samplePose`, `axisToward`, `track` into the new file; do not import private functions).
- Produces: clip names `Ladder_Climb`, `Ladder_Idle`, `Hang_Idle`, `Shimmy`, `Zip_Hang`, `WallRun_Loop`, `Dive`, `Ledge_Yank`; hero fields listed in Shared interfaces; camera modes `climb` and `hang`.

- [ ] **Step 1: Expose the hero helpers.** In `src/actors/hero.js`, add these fields to `h` right after `frozen: false,`:

```js
    airRuns: 0,      // wall runs used since last touching the ground
    lastClimbT: 99,  // seconds since leaving a ladder, ledge or zipline
```

At the end of `createHero`, just before `return h;`, add:

```js
  // Used by the traversal controls in src/actors/traverse/.
  Object.assign(h, { setState, faceTowards, integrate, startGlide, land, RADIUS, HEIGHT, GRAVITY });
```

In `land(impact)`, add `h.airRuns = 0;` as the first line. In `h.update`, add `h.lastClimbT += dt;` after `h.stateT += dt;`.

- [ ] **Step 2: Add the camera modes.** In `src/game/camera.js`, extend `MODES`:

```js
  climb: { dist: 4.6, height: 1.2, side: 0.4, fov: 2 },
  hang: { dist: 4.2, height: 0.6, side: 0.35, fov: 4 },
  wallrun: { dist: 4.4, height: 1.4, side: 0.2, fov: 10 },
  dive: { dist: 5.5, height: 2.2, side: 0, fov: 14 },
```

- [ ] **Step 3: Write `src/actors/climbAnims.js`.** Copy `samplePose`, `axisToward` and `track` from `src/actors/kicks.js` verbatim, then:

```js
export function buildClimbClips(model, clips, fwd = 1) {
  const idle = clips.get('Idle_Loop');
  const { pose, dispose } = samplePose(model, idle, 0);
  const bone = (n) => model.getObjectByName(n);
  const forward = new THREE.Vector3(0, 0, fwd), up = new THREE.Vector3(0, 1, 0);
  const ax = {
    armUpR: axisToward(model, bone('upperarm_r'), bone('lowerarm_r'), up),
    armUpL: axisToward(model, bone('upperarm_l'), bone('lowerarm_l'), up),
    elbowR: axisToward(model, bone('lowerarm_r'), bone('hand_r'), up),
    elbowL: axisToward(model, bone('lowerarm_l'), bone('hand_l'), up),
    thighFwdR: axisToward(model, bone('thigh_r'), bone('calf_r'), forward),
    thighFwdL: axisToward(model, bone('thigh_l'), bone('calf_l'), forward),
    kneeR: axisToward(model, bone('calf_r'), bone('foot_r'), forward.clone().negate()),
    kneeL: axisToward(model, bone('calf_l'), bone('foot_l'), forward.clone().negate()),
    spineFwd: axisToward(model, bone('spine_02'), bone('neck_01'), forward),
    spineSide: axisToward(model, bone('spine_02'), bone('neck_01'), new THREE.Vector3(1, 0, 0)),
  };
  dispose();
  const r = (n) => pose.get(n);
  const T = (n, a, k) => track(n, r(n), ax[a], k);
  const clip = (name, dur, tracks) => new THREE.AnimationClip(name, dur, tracks);

  // Hand over hand: opposite arm and leg reach together. 1 s = two rungs.
  const climb = clip('Ladder_Climb', 1, [
    T('upperarm_r', 'armUpR', [[0, 2.6], [0.5, 1.7], [1, 2.6]]), T('upperarm_l', 'armUpL', [[0, 1.7], [0.5, 2.6], [1, 1.7]]),
    T('lowerarm_r', 'elbowR', [[0, 0.3], [0.5, 1.2], [1, 0.3]]), T('lowerarm_l', 'elbowL', [[0, 1.2], [0.5, 0.3], [1, 1.2]]),
    T('thigh_l', 'thighFwdL', [[0, 1.2], [0.5, 0.3], [1, 1.2]]), T('thigh_r', 'thighFwdR', [[0, 0.3], [0.5, 1.2], [1, 0.3]]),
    T('calf_l', 'kneeL', [[0, 1.6], [0.5, 0.5], [1, 1.6]]), T('calf_r', 'kneeR', [[0, 0.5], [0.5, 1.6], [1, 0.5]]),
  ]);
  const ladderIdle = clip('Ladder_Idle', 1, [
    T('upperarm_r', 'armUpR', [[0, 2.3], [1, 2.3]]), T('upperarm_l', 'armUpL', [[0, 2.0], [1, 2.0]]),
    T('lowerarm_r', 'elbowR', [[0, 0.6], [1, 0.6]]), T('lowerarm_l', 'elbowL', [[0, 0.8], [1, 0.8]]),
    T('thigh_l', 'thighFwdL', [[0, 0.8], [1, 0.8]]), T('calf_l', 'kneeL', [[0, 1.1], [1, 1.1]]),
  ]);
  // Both arms straight up, legs dangling with a slight sway.
  const hang = clip('Hang_Idle', 2, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [2, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.9], [2, 2.9]]),
    T('lowerarm_r', 'elbowR', [[0, 0.15], [2, 0.15]]), T('lowerarm_l', 'elbowL', [[0, 0.15], [2, 0.15]]),
    T('thigh_r', 'thighFwdR', [[0, 0.15], [1, -0.1], [2, 0.15]]), T('thigh_l', 'thighFwdL', [[0, -0.1], [1, 0.15], [2, -0.1]]),
    T('calf_r', 'kneeR', [[0, 0.3], [2, 0.3]]), T('calf_l', 'kneeL', [[0, 0.35], [2, 0.35]]),
  ]);
  // Shimmy: arms alternate reaching sideways (the control mirrors it for the other direction).
  const shimmy = clip('Shimmy', 0.8, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [0.4, 2.5], [0.8, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.5], [0.4, 2.9], [0.8, 2.5]]),
    T('lowerarm_r', 'elbowR', [[0, 0.15], [0.4, 0.5], [0.8, 0.15]]), T('lowerarm_l', 'elbowL', [[0, 0.5], [0.4, 0.15], [0.8, 0.5]]),
    T('spine_02', 'spineSide', [[0, 0.08], [0.4, -0.08], [0.8, 0.08]]),
    T('thigh_r', 'thighFwdR', [[0, 0.2], [0.4, -0.05], [0.8, 0.2]]), T('calf_r', 'kneeR', [[0, 0.4], [0.8, 0.4]]),
  ]);
  // One hand on the handle, the other out for balance, knees tucked.
  const zip = clip('Zip_Hang', 1, [
    T('upperarm_r', 'armUpR', [[0, 3.0], [1, 3.0]]), T('lowerarm_r', 'elbowR', [[0, 0.1], [1, 0.1]]),
    T('upperarm_l', 'armUpL', [[0, 1.3], [0.5, 1.45], [1, 1.3]]),
    T('thigh_r', 'thighFwdR', [[0, 1.0], [1, 1.0]]), T('thigh_l', 'thighFwdL', [[0, 0.8], [1, 0.8]]),
    T('calf_r', 'kneeR', [[0, 1.4], [1, 1.4]]), T('calf_l', 'kneeL', [[0, 1.2], [1, 1.2]]),
  ]);
  // Sprint cycle with the torso leaning away from the wall (the control tilts the whole body).
  const wallRun = clip('WallRun_Loop', 0.5, [
    T('thigh_r', 'thighFwdR', [[0, 1.3], [0.25, -0.4], [0.5, 1.3]]), T('thigh_l', 'thighFwdL', [[0, -0.4], [0.25, 1.3], [0.5, -0.4]]),
    T('calf_r', 'kneeR', [[0, 1.2], [0.25, 0.4], [0.5, 1.2]]), T('calf_l', 'kneeL', [[0, 0.4], [0.25, 1.2], [0.5, 0.4]]),
    T('upperarm_r', 'armUpR', [[0, 0.6], [0.25, 1.4], [0.5, 0.6]]), T('upperarm_l', 'armUpL', [[0, 1.4], [0.25, 0.6], [0.5, 1.4]]),
    T('spine_02', 'spineFwd', [[0, 0.35], [0.5, 0.35]]),
  ]);
  // Dive bomb: arms swept back, legs together, head first.
  const dive = clip('Dive', 1, [
    T('upperarm_r', 'armUpR', [[0, -0.5], [1, -0.5]]), T('upperarm_l', 'armUpL', [[0, -0.5], [1, -0.5]]),
    T('thigh_r', 'thighFwdR', [[0, -0.15], [1, -0.15]]), T('thigh_l', 'thighFwdL', [[0, -0.15], [1, -0.15]]),
    T('spine_02', 'spineFwd', [[0, 0.4], [1, 0.4]]),
  ]);
  // Ledge takedown: both hands reach up and yank down hard.
  const yank = clip('Ledge_Yank', 0.9, [
    T('upperarm_r', 'armUpR', [[0, 2.9], [0.25, 3.1], [0.55, 1.2], [0.9, 2.9]]), T('upperarm_l', 'armUpL', [[0, 2.9], [0.25, 3.1], [0.55, 1.2], [0.9, 2.9]]),
    T('lowerarm_r', 'elbowR', [[0, 0.15], [0.25, 0.1], [0.55, 1.4], [0.9, 0.15]]), T('lowerarm_l', 'elbowL', [[0, 0.15], [0.25, 0.1], [0.55, 1.4], [0.9, 0.15]]),
    T('spine_02', 'spineFwd', [[0, 0], [0.55, 0.45], [0.9, 0]]),
  ]);
  return [climb, ladderIdle, hang, shimmy, zip, wallRun, dive, yank];
}
```

- [ ] **Step 4: Register the clips.** In `src/game/game.js`, add `import { buildClimbClips } from '../actors/climbAnims.js';` next to the kicks import. After the kick-clip loop, add:

```js
  for (const c of buildClimbClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
```

- [ ] **Step 5: Check the poses visually.** Build and preview on 5204. Then run:

```bash
node scripts/dev-play.mjs "http://localhost:5204/?at=start&god=1" "$TEMP/b3" '[{"wait":2500,"eval":"window.__game.comic.skip()"},{"wait":500,"eval":"window.__game.hero.frozen=true; window.__game.hero.bat.animator.play(\"Hang_Idle\",{fade:0}); 1"},{"wait":600,"shot":"hang"}]'
```

Repeat for each clip name. Every pose must read clearly. If a limb bends backward, flip the sign of that track's angles, not the axis helper. This is expected, because `axisToward` picks an axis per rig.

- [ ] **Step 6: Run the tests and commit**

Run: `npx vitest run` (all pass). Then:

```bash
git add src/actors/climbAnims.js src/actors/hero.js src/game/game.js src/game/camera.js
git commit -m "Climb, hang, zip, wall-run and dive animations authored in code; hero traversal hooks"
```

---

### Task 4: Ladders in the world and the ladder control

**Files:**
- Create: `src/actors/traverse/ladder.js`
- Modify: `src/world/cityBuilder.js` (`createCityContext`, `fireEscape`, `waterTower`)
- Modify: `src/game/world.js` (return `climbables: ctx.climbables`)
- Modify: `src/actors/hero.js` (the `createHero` signature, and trigger checks in `locomotion`)
- Modify: `src/game/game.js:142` (pass `climbables: world.climbables`)

**Interfaces:**
- Consumes: `addLadder`, `ladderGrab`, `ladderTopGrab` and `ladderExit` (Task 1). Clips `Ladder_Climb`, `Ladder_Idle` and `ClimbUp_1m` (Task 3). Hero helpers (Task 3).
- Produces: `createLadderControl(h, deps, { ladder, y, fromTop }) -> control` with `name: 'ladder'` and `camera: 'climb'`. Events `ladderOn`, `ladderOff` and `climbTop`.

- [ ] **Step 1: Add the registry to the city context.** In `createCityContext`, add `climbables: createClimbables(),` to `ctx` (import `createClimbables, addLadder` from `./climbables.js`). In `src/game/world.js`, add `climbables: ctx.climbables,` to the returned object.

- [ ] **Step 2: Add fire-escape ladders and solid landings.** In `fireEscape(ctx, b)`, inside the loop, change the landing slab from `ctx.buckets.add('steel', box(sx, 0.08, sz, cx, y, cz))` to `solid(ctx, 'steel', box(sx, 0.08, sz, cx, y, cz))`, so the landing collides. After the loop, add:

```js
  // Climbable ladders: a drop ladder from the street to the first landing, short ladders
  // between landings at alternating ends, and a roof ladder from the top landing.
  const levels = [];
  for (let y = 6.8; y < b.h - 3; y += 3.4) levels.push(y);
  if (!levels.length) return;
  const outer = { x: f.px + f.nx * 1.32, z: f.pz + f.nz * 1.32 };
  const endOffset = (i) => (i % 2 ? -1 : 1) * (width / 2 - 0.5);
  const rungs = (lx, lz, nx, nz, y0, y1) => {
    const sideX = -nz * 0.25, sideZ = nx * 0.25;
    for (const s of [-1, 1]) ctx.buckets.add('steel', box(0.05, y1 - y0, 0.05, lx + sideX * s, (y0 + y1) / 2, lz + sideZ * s));
    for (let k = y0 + 0.3; k < y1; k += 0.3) ctx.buckets.add('steel', box(Math.abs(nz) > 0 ? 0.5 : 0.04, 0.04, Math.abs(nx) > 0 ? 0.5 : 0.04, lx, k, lz));
  };
  // Drop ladder hangs off the outer rail of the first landing, facing the street.
  const dx = outer.x + along.x * endOffset(0), dz = outer.z + along.z * endOffset(0);
  rungs(dx, dz, f.nx, f.nz, 0, levels[0]);
  addLadder(ctx.climbables, { x: dx, z: dz, nx: f.nx, nz: f.nz, bottom: 0, top: levels[0] });
  // Between landings: against the wall, alternating ends.
  for (let i = 0; i < levels.length - 1; i++) {
    const lx = f.px + along.x * endOffset(i + 1), lz = f.pz + along.z * endOffset(i + 1);
    rungs(lx, lz, f.nx, f.nz, levels[i], levels[i + 1]);
    addLadder(ctx.climbables, { x: lx, z: lz, nx: f.nx, nz: f.nz, bottom: levels[i], top: levels[i + 1] });
  }
  // Roof ladder from the top landing up the wall.
  const last = levels[levels.length - 1];
  const rx = f.px + along.x * endOffset(levels.length), rz = f.pz + along.z * endOffset(levels.length);
  rungs(rx, rz, f.nx, f.nz, last, b.h);
  addLadder(ctx.climbables, { x: rx, z: rz, nx: f.nx, nz: f.nz, bottom: last, top: b.h });
```

Plan deviation from the spec (B1 says stairs become step boxes): landings are connected by short ladders at alternating ends instead. Walking a 45 degree stair made of step boxes jitters, and the step boxes block the landing. The visual stairs stay as scenery. Update the spec's B1 bullet in the same commit to say so.

- [ ] **Step 3: Make the water-tower ladder climbable.** In `waterTower`, after the rung loop, add:

```js
  addLadder(ctx.climbables, { x, z: z + 2.3, nx: 0, nz: 1, bottom: y, top: y + 7 });
```

The top is the cap perch height (`y + 7`). `ladderExit` then lands on the cap at `z + 1.5`.

- [ ] **Step 4: Write the ladder control**

```js
// src/actors/traverse/ladder.js
// Climbing a ladder: forward/back climb, sprint slides down, jump kicks off, the top pulls up.
import { ladderExit } from '../../world/climbables.js';

const CLIMB = 2.4, SLIDE = 9;

export function createLadderControl(h, { collision, events }, { ladder, y, fromTop = false }) {
  const l = ladder;
  const sx = l.x + l.nx * 0.45, sz = l.z + l.nz * 0.45;
  let phase = fromTop ? 'mountTop' : 'climb', t = 0;
  let cy = fromTop ? l.top - 1 : y;
  const yaw = Math.atan2(-l.nx, -l.nz);
  h.vel.set(0, 0, 0);
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.bat.face(yaw);
  h.setState('air');
  h.grounded = false;
  events.emit('ladderOn');
  const exit = ladderExit(l);

  function leave() { h.lastClimbT = 0; events.emit('ladderOff'); }

  return {
    name: 'ladder',
    camera: 'climb',
    update(dt, ctx) {
      t += dt;
      const { input } = ctx;
      if (phase === 'mountTop') {
        // Step over the edge and turn around onto the rungs.
        const k = Math.min(1, t / 0.45);
        h.pos.set(exit.x + (sx - exit.x) * k, l.top - k * 1, exit.z + (sz - exit.z) * k);
        if (k >= 1) { phase = 'climb'; t = 0; }
        return false;
      }
      if (phase === 'top') {
        const k = Math.min(1, t / 0.6);
        const gy = collision.groundBelow(exit.x, l.top + 1.5, exit.z, 0.2);
        const topY = gy > -Infinity ? gy : l.top;
        h.pos.set(sx + (exit.x - sx) * k, cy + (topY - cy) * Math.min(1, k * 1.6), sz + (exit.z - sz) * k);
        if (k >= 1) { h.pos.y = topY; h.setState('ground'); h.grounded = true; leave(); events.emit('climbTop'); return true; }
        return false;
      }
      // Jump: kick off backward, away from the wall.
      if (input.pressed('jump')) {
        h.vel.set(l.nx * 6, 7, l.nz * 6);
        h.setState('air'); h.airT = 0.25;
        h.bat.face(Math.atan2(l.nx, l.nz));
        h.bat.animator.play('Jump_Start', { once: true, fade: 0.08 });
        leave();
        return true;
      }
      const slide = input.down('sprint');
      const v = slide ? -SLIDE : input.move.y * CLIMB;
      cy += v * dt;
      if (cy >= l.top - 1) { cy = l.top - 1; if (v > 0) { phase = 'top'; t = 0; h.bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.5, fade: 0.08 }); return false; } }
      if (cy <= l.bottom) {
        cy = l.bottom;
        if (v < 0) {
          h.pos.set(sx, l.bottom, sz);
          h.setState(l.bottom <= 0.05 || collision.groundBelow(sx, l.bottom + 0.1, sz, 0.2) >= l.bottom - 0.05 ? 'ground' : 'air');
          h.grounded = h.state === 'ground';
          leave();
          return true;
        }
      }
      h.pos.set(sx, cy, sz);
      h.bat.face(yaw);
      if (Math.abs(v) > 0.1) {
        h.bat.animator.play('Ladder_Climb', { fade: 0.12, timeScale: slide ? 0 : Math.sign(v) * Math.abs(v) / CLIMB });
      } else h.bat.animator.play('Ladder_Idle', { fade: 0.15 });
      return false;
    },
    // Anything that hits the hero knocks them off.
    knockOff() { h.vel.set(l.nx * 3, 0, l.nz * 3); h.setState('air'); leave(); },
  };
}
```

If the animator's `play` doesn't accept a negative or zero `timeScale`, add support in `src/actors/animator.js`: set `action.timeScale = opts.timeScale ?? 1` on every call, including when the clip is already playing, so climbing speed tracks input.

- [ ] **Step 5: Add trigger checks to `hero.js`.**
  - Change the signature to `createHero({ assets, suit, scene, collision, events, climbables = { ladders: [], ziplines: [] } })`.
  - Import `ladderGrab` and `ladderTopGrab`.
  - Import `createLadderControl`.
  - In `locomotion`, directly after `const r = integrate(dt);`, add:

```js
    // Ladders: walk into the foot, walk off the top toward one, or drift into one falling.
    if (!h.control && h.lastClimbT > 0.4 && climbables.ladders.length) {
      const fx = Math.sin(bat.yaw), fz = Math.cos(bat.yaw);
      let g = null, fromTop = false;
      if (h.state === 'ground' && mag > 0.3) {
        g = ladderGrab(climbables.ladders, pos, { facingX: wish.x, facingZ: wish.z });
        if (!g) { const top = ladderTopGrab(climbables.ladders, pos, wish.x, wish.z); if (top) { g = { ladder: top, y: top.top - 1 }; fromTop = true; } }
      } else if ((h.state === 'air' || h.state === 'glide') && vel.y < 0) {
        g = ladderGrab(climbables.ladders, pos, { reach: 0.55 });
      }
      if (g) { h.control = createLadderControl(h, { collision, events }, { ...g, fromTop }); return; }
    }
```

`fx` and `fz` are unused here. Leave them out if the linter complains.

  - Pass `climbables: world.climbables` into `createHero` in `src/game/game.js`.
  - In `h.cameraMode`, add as the first line: `if (h.control?.camera) return h.control.camera;`

- [ ] **Step 6: Knock the hero off on hit.** In `src/combat/combatSystem.js`, find where the hero takes damage (search `heroHurt`). Before the emit, add: `if (hero.control?.knockOff) { hero.control.knockOff(); hero.control = null; }`. In the same file's attack director, goons must not start an attack while `hero.control?.name` is `'ladder'` or `'ledge'`. Find where the director picks an attacker and add that condition to its "may attack" check.

- [ ] **Step 7: Verify in game.** Build and preview on 5204. Find a street-level ladder:

```bash
node scripts/dev-play.mjs "http://localhost:5204/?at=start&god=1" "$TEMP/b3" '[{"wait":2500,"eval":"window.__game.comic.skip()"},{"eval":"(() => { const l = window.__game.climbables.ladders.find(l => l.bottom === 0); window.__game.teleport({ x: l.x + l.nx*1.5, y: 0, z: l.z + l.nz*1.5 }); window.__game.hero.bat.face(Math.atan2(-l.nx,-l.nz)); return l; })()"},{"wait":400,"hold":["KeyW"],"ms":4500},{"shot":"ladder-mid"},{"hold":["KeyW"],"ms":4000},{"eval":"({ state: window.__game.hero.state, ctl: window.__game.hero.control?.name, y: window.__game.hero.pos.y })"},{"shot":"ladder-top"}]'
```

Expose climbables first by adding `climbables: world.climbables` to the `window.__game` assign in `game.js`. Expected: `ladder-mid.png` shows Batman on the rungs, and the final eval shows `ctl: null`, `state: 'ground'` and `y` equal to the first landing height or higher. Also verify that pressing Jump mid-ladder kicks off, and that holding Sprint slides down.

- [ ] **Step 8: Run all the tests and commit**

```bash
npx vitest run
git add src/actors/traverse/ladder.js src/world/cityBuilder.js src/game/world.js src/actors/hero.js src/game/game.js src/combat/combatSystem.js src/actors/animator.js docs/superpowers/specs/2026-09-28-traversal-comic-content-design.md
git commit -m "Climbable ladders on fire escapes and water towers"
```

---

### Task 5: Ledge grab, shimmy, corner wrap, pull-up, backflip and ledge grapple points

**Files:**
- Create: `src/actors/traverse/ledge.js`
- Modify: `src/actors/hero.js` (auto-grab trigger)
- Modify: `src/core/settings.js` (`autoLedge` default, sanitize)
- Modify: `src/ui/menus.js` (the toggle, next to "Action camera")
- Modify: `src/game/game.js` (pass `settings`, and ledge grapple points)
- Test: `tests/unit/persistence.test.js` (`autoLedge` sanitize case)

**Interfaces:**
- Consumes: `findLedge`, `hangPos` and `wrapCorner` (Task 2). Clips `Hang_Idle`, `Shimmy` and `ClimbUp_1m`.
- Produces: `createLedgeControl(h, deps, { ledge }) -> control` with `name: 'ledge'` and `camera: 'hang'`, plus a `ledge` getter used by Task 9. Events `ledgeGrab`, `ledgeUp` and `ledgeDrop`. Setting `settings.autoLedge` (boolean, default true).

- [ ] **Step 1: Write a failing test for the setting** in `tests/unit/persistence.test.js`:

```js
it('keeps autoLedge as a boolean and defaults it on', () => {
  expect(sanitizeSettings({}).autoLedge).toBe(true);
  expect(sanitizeSettings({ autoLedge: false }).autoLedge).toBe(false);
  expect(sanitizeSettings({ autoLedge: 'yes' }).autoLedge).toBe(true);
});
```

Run `npx vitest run tests/unit/persistence.test.js`. Expected: FAIL.

- [ ] **Step 2: Add the setting.** In `DEFAULT_SETTINGS`, add `autoLedge: true,`. In `sanitizeSettings`, add `autoLedge: bool(r.autoLedge, d.autoLedge),`. In `src/ui/menus.js`, copy the existing "Action camera" toggle row and adapt it to `autoLedge`, labelled "Auto ledge grab". Run the test again. Expected: PASS.

- [ ] **Step 3: Write the ledge control**

```js
// src/actors/traverse/ledge.js
// Hanging from a ledge: shimmy left/right (wrapping outside corners), pull up, drop, or backflip.
import { hangPos, wrapCorner } from './probes.js';

const SHIMMY = 1.6;

export function createLedgeControl(h, { collision, events }, { ledge }) {
  let l = ledge, phase = 'catch', t = 0;
  const start = h.pos.clone();
  h.vel.set(0, 0, 0);
  h.cape.setWings(false);
  h.bat.tilt.rotation.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.animator.play('Hang_Idle', { fade: 0.08 });
  events.emit('ledgeGrab');
  const alongOf = () => (l.axis === 'x' ? l.x : l.z);
  const setAlong = (v) => { if (l.axis === 'x') l.x = v; else l.z = v; };
  const face = () => h.bat.face(Math.atan2(-l.nx, -l.nz));

  function leave() { h.lastClimbT = 0; }

  return {
    name: 'ledge',
    camera: 'hang',
    get ledge() { return l; },
    update(dt, ctx) {
      t += dt;
      const { input, cam } = ctx;
      const hp = hangPos(l);
      if (phase === 'catch') {
        const k = Math.min(1, t / 0.12);
        h.pos.lerpVectors(start, hp, k);
        face();
        if (k >= 1) { phase = 'hang'; t = 0; }
        return false;
      }
      if (phase === 'up') {
        const k = Math.min(1, t / 0.6);
        const tx = l.x - l.nx * 0.6, tz = l.z - l.nz * 0.6;
        h.pos.set(hp.x + (tx - hp.x) * k, hp.y + (l.y - hp.y) * Math.min(1, k * 1.6), hp.z + (tz - hp.z) * k);
        if (k >= 1) { h.pos.y = l.y; h.setState('ground'); h.grounded = true; leave(); events.emit('ledgeUp'); return true; }
        return false;
      }
      // Hanging.
      if (input.pressed('jump') && input.move.y < -0.5) {
        // Backflip away from the wall.
        h.vel.set(l.nx * 7, 9, l.nz * 7);
        h.setState('air'); h.airT = 0.25;
        h.bat.face(Math.atan2(l.nx, l.nz));
        h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
        leave(); events.emit('jump');
        return true;
      }
      if (input.pressed('jump') || input.move.y > 0.5) {
        phase = 'up'; t = 0;
        h.bat.animator.play('ClimbUp_1m', { once: true, timeScale: 1.5, fade: 0.08 });
        return false;
      }
      if (input.move.y < -0.5 || input.pressed('sprint')) {
        h.pos.set(hp.x + l.nx * 0.25, hp.y, hp.z + l.nz * 0.25);
        h.vel.set(0, -1, 0);
        h.setState('air'); h.airT = 0.4;
        leave(); events.emit('ledgeDrop');
        return true;
      }
      // Shimmy: screen-left/right mapped onto the edge axis using the camera's right vector.
      const right = cam.right({ x: 0, y: 0, z: 0 });
      const ax = l.axis === 'x' ? right.x : right.z;
      const dir = Math.sign(ax * input.move.x);
      if (Math.abs(input.move.x) > 0.3 && dir !== 0) {
        let v = alongOf() + dir * SHIMMY * dt;
        if (v > l.max || v < l.min) {
          const w = wrapCorner(collision, l, v > l.max ? 1 : -1);
          if (w) { l = w; phase = 'catch'; t = 0; start.copy(h.pos); return false; }
          v = Math.min(Math.max(v, l.min), l.max);
        }
        setAlong(v);
        h.bat.animator.play('Shimmy', { fade: 0.1, timeScale: dir });
      } else h.bat.animator.play('Hang_Idle', { fade: 0.15 });
      const p = hangPos(l);
      h.pos.set(p.x, p.y, p.z);
      face();
      return false;
    },
    knockOff() { h.vel.set(l.nx * 2, -2, l.nz * 2); h.setState('air'); leave(); },
  };
}
```

`cam.right(out)` must accept a plain object. If `follow.right` requires a `THREE.Vector3`, pass `new THREE.Vector3()` created once at the top of the factory instead (import THREE).

- [ ] **Step 4: Add the auto-grab trigger in `hero.js`.**
  - Add `settings = { autoLedge: true }` to the `createHero` params, and pass `settings` from `game.js`.
  - Import `findLedge` and `createLedgeControl`.
  - Right after the ladder trigger block from Task 4, add:

```js
    // Ledges: falling (or gliding slowly) with an edge in reach.
    if (!h.control && settings.autoLedge && h.lastClimbT > 0.35 && vel.y < 0 &&
        (h.state === 'air' || (h.state === 'glide' && h.glide.speed < 16))) {
      const fx = Math.sin(bat.yaw), fz = Math.cos(bat.yaw);
      const ledge = findLedge(collision, pos, fx, fz);
      if (ledge) { h.control = createLedgeControl(h, { collision, events }, { ledge }); return; }
    }
```

- [ ] **Step 5: Add ledge grapple points.** In `src/game/game.js`, where `pickGrapple` is defined, build a list of ledge points once at run start. Take every `world.grapplePoints` entry that is not a perch and add a copy with `ledge: true` placed 0.1 m below. Then change the grapple control so that a `ledge` point finishes by hanging. In `hero.js` `grappleControl`, replace the `if (k >= 1) {` branch's `phase = 'vault'` path:

```js
            if (point.ledge) {
              const l = findLedge(collision, hang, -n.x, -n.z, { minRise: 0.6, maxRise: 2.6, reach: 0.9 });
              if (l) { cable.visible = false; h.control = createLedgeControl(h, { collision, events }, { ledge: l }); return false; }
            }
```

`hero.update` must not clear `h.control` when a control hands over to another. Change `if (h.control.update(dt, ctx)) { h.control = null; ... }` to:

```js
      const ctl = h.control;
      if (ctl.update(dt, ctx) && h.control === ctl) { h.control = null; cable.visible = false; }
```

Target choice: the ledge copies must not crowd out landing points. In `pickGrapplePoint`'s caller, prefer the landing variant unless the player holds `back` when the target is picked. In that case, pass `world.grapplePoints.filter(p => p.ledge)`. Document this in the hint text in Task 10.

- [ ] **Step 6: Verify in game.** Build and preview. Then:

```bash
node scripts/dev-play.mjs "http://localhost:5204/?at=start&god=1" "$TEMP/b3" '[{"wait":2500,"eval":"window.__game.comic.skip()"},{"eval":"(() => { const r = window.__game.world.roofs.find(r => r.y > 12 && r.y < 30); window.__game.teleport({ x: r.x, y: r.y - 1.6 , z: r.z + r.d/2 + 0.6 }); window.__game.hero.state = \"air\"; window.__game.hero.bat.face(Math.PI); return r; })()"},{"wait":300,"eval":"({ ctl: window.__game.hero.control?.name })"},{"shot":"hang"},{"hold":["KeyD"],"ms":1500,"shot":"shimmy"},{"hold":["KeyW"],"ms":800},{"wait":700,"eval":"({ ctl: window.__game.hero.control?.name, state: window.__game.hero.state })"}]'
```

Expose `world` in `window.__game` if it isn't already. Expected: the first eval shows `ctl: 'ledge'`, the shimmy moves along the edge, and the last eval shows `ctl: null`, `state: 'ground'`. Separately, check the corner wrap by holding one direction until the corner and taking a screenshot. Check the backflip with Space held together with S.

- [ ] **Step 7: Run all the tests and commit**

```bash
npx vitest run
git add src/actors/traverse/ledge.js src/actors/hero.js src/core/settings.js src/ui/menus.js src/game/game.js tests/unit/persistence.test.js
git commit -m "Ledge grab, shimmy with corner wrap, pull-up, backflip and ledge grapples"
```

---

### Task 6: Ziplines

**Files:**
- Create: `src/world/ziplines.js`, `src/actors/traverse/zipline.js`
- Modify: `src/game/world.js` (build them after `buildDistricts`, before `finishCity`)
- Modify: `src/actors/hero.js` (the hook-on trigger, and the zip grapple point)
- Modify: `src/game/game.js` (zip start points go into the grapple targets)
- Test: `tests/unit/climbables.test.js` (the route validity test)

**Interfaces:**
- Consumes: `addZipline`, `zipPoint`, `zipClosest` and `zipSpeed` (Task 1). Clip `Zip_Hang`. `h.startGlide()`.
- Produces: `buildZiplines(ctx)`, which adds meshes, colliders for the posts and registry entries, and pushes a grapple point `{ x, y, z, nx: 0, nz: 0, zip: line }` at each start. Also `createZipControl(h, deps, { line, s }) -> control` with `name: 'zip'` and `camera: 'zip'`. Events `zipOn` and `zipOff`.

- [ ] **Step 1: Define the routes.** Each end snaps to the roof under it: `y = roof + 2.2`, which is the post-top height. Routes are listed as approximate roof centres plus the direction of travel. The builder snaps each end to the nearest roof edge on that roof, facing the other end.

```js
// src/world/ziplines.js
// Hand-placed cables across the longest roof gaps. Ends are roof ids' centers nudged toward
// each other; buildZiplines snaps them to the roof edge and a post top 2.2 m above the roof.
import * as THREE from 'three';
import { addZipline } from './climbables.js';
import { solid } from './cityBuilder.js';

export const ZIP_ROUTES = [
  // [from {x,z}, to {x,z}]  (world coordinates of a roof each end sits on)
  [{ x: -60, z: 180 }, { x: -20, z: 215 }],   // Docks: warehouse 3 to crane gantry
  [{ x: -44, z: 232 }, { x: 0, z: 262 }],     // Docks: freighter to pier shed
  [{ x: 120, z: 40 }, { x: 180, z: 20 }],     // Neon Row: across the avenue
  [{ x: 180, z: -20 }, { x: 120, z: -40 }],   // Neon Row: back across, south block
  [{ x: 6, z: 10 }, { x: -60, z: -110 }],     // GCPD roof to the clock plaza
  [{ x: 150, z: -60 }, { x: 140, z: -172 }],  // Neon Row to the Ace factory roof
  [{ x: -120, z: -165 }, { x: -62, z: -176 }],// Cathedral to the deco tower
  [{ x: 112, z: -191 }, { x: 180, z: -118 }], // Ace chimney to the tank farm
];
```

- [ ] **Step 2: Write a failing route-validity test** in `tests/unit/climbables.test.js`. The route data must be well formed, and the long gaps must be long:

```js
import { ZIP_ROUTES } from '../../src/world/ziplines.js';
it('zip routes cross real gaps', () => {
  for (const [a, b] of ZIP_ROUTES) expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(25);
  expect(ZIP_ROUTES.length).toBeGreaterThanOrEqual(8);
});
```

Importing `ziplines.js` pulls in `three` and `cityBuilder.js`, which Vitest runs fine in node, as `lookTestSet` already does. Run it and expect FAIL before the file exists, PASS after.

- [ ] **Step 3: Implement `buildZiplines`** in the same file:

```js
function roofAt(ctx, x, z) {
  let best = null, bd = Infinity;
  for (const r of ctx.roofs) {
    const d = Math.hypot(r.x - x, r.z - z);
    if (d < bd && Math.abs(x - r.x) <= r.w / 2 + 6 && Math.abs(z - r.z) <= r.d / 2 + 6) { best = r; bd = d; }
  }
  return best;
}

function postTop(ctx, r, toward) {
  // Stand the post 2 m in from the roof edge facing the other end.
  const dx = toward.x - r.x, dz = toward.z - r.z;
  const k = Math.min((r.w / 2 - 2) / Math.max(Math.abs(dx), 1e-3), (r.d / 2 - 2) / Math.max(Math.abs(dz), 1e-3));
  const x = r.x + dx * Math.min(1, k), z = r.z + dz * Math.min(1, k);
  const ground = ctx.collision.groundBelow(x, r.y + 3, z, 0.3);
  return { x, y: (ground > -Infinity ? ground : r.y) + 2.2, z };
}

export function buildZiplines(ctx) {
  const pts = [];
  for (const [fa, fb] of ZIP_ROUTES) {
    const ra = roofAt(ctx, fa.x, fa.z), rb = roofAt(ctx, fb.x, fb.z);
    if (!ra || !rb) { console.warn('zipline: no roof near', fa, fb); continue; }
    let a = postTop(ctx, ra, rb), b = postTop(ctx, rb, ra);
    if (b.y > a.y) [a, b] = [b, a]; // always ride downhill
    // Skip cables that would pass through a building.
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = ctx.collision.raycast({ x: a.x, y: a.y - 0.3, z: a.z }, { x: d.x / len, y: d.y / len, z: d.z / len }, len - 1);
    if (hit) { console.warn('zipline blocked', fa, fb, hit.box.tag); continue; }
    const line = addZipline(ctx.climbables, a, b);
    for (const p of [a, b]) solid(ctx, 'steel', new THREE.CylinderGeometry(0.09, 0.12, 2.2, 6).translate(p.x, p.y - 1.1, p.z));
    // The cable sags 3% in the middle; drawn as an ink line strip.
    const n = 24, arr = [];
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      arr.push(new THREE.Vector3(a.x + d.x * k, a.y + d.y * k - Math.sin(k * Math.PI) * len * 0.03, a.z + d.z * k));
    }
    const cable = new THREE.Line(new THREE.BufferGeometry().setFromPoints(arr), new THREE.LineBasicMaterial({ color: 0x0b0b12 }));
    ctx.scene.add(cable);
    ctx.grapple.push({ x: a.x, y: a.y - 1.2, z: a.z, nx: 0, nz: 0, perch: true, zip: line });
    pts.push(line);
  }
  return pts;
}
```

In `src/game/world.js`, import it and call `buildZiplines(ctx);` between `buildDistricts(ctx);` and `finishCity(ctx);`. `pruneGrapples` keeps perch points whose spot is clear. The zip grapple point sits at the post, 1.2 m below its top, and the post collider is 0.12 m wide, so it's clear.

- [ ] **Step 4: Write the zip control**

```js
// src/actors/traverse/zipline.js
// Riding a zipline: speed builds downhill; jump lets go with full momentum; the end launches you.
import { zipPoint, zipSpeed } from '../../world/climbables.js';

export function createZipControl(h, { events }, { line, s = 0 }) {
  let pos = s, speed = Math.max(8, Math.hypot(h.vel.x, h.vel.z) * 0.6);
  h.cape.setWings(false);
  h.setState('air');
  h.grounded = false;
  h.bat.animator.play('Zip_Hang', { fade: 0.1 });
  h.bat.face(Math.atan2(line.dir.x, line.dir.z));
  events.emit('zipOn');
  function release(extraUp) {
    h.vel.set(line.dir.x * speed, line.dir.y * speed + extraUp, line.dir.z * speed);
    h.setState('air'); h.airT = 0.3; h.lastClimbT = 0;
    events.emit('zipOff');
  }
  return {
    name: 'zip',
    camera: 'zip',
    get speed() { return speed; },
    update(dt, ctx) {
      speed = zipSpeed(line, speed, dt);
      pos += speed * dt;
      const p = zipPoint(line, pos);
      h.pos.set(p.x, p.y - 2.05, p.z); // hanging below the cable by one arm
      h.vel.set(line.dir.x * speed, line.dir.y * speed, line.dir.z * speed);
      if (ctx.input.pressed('jump')) {
        release(6);
        if (ctx.input.down('jump')) h.startGlide();
        return true;
      }
      if (pos >= line.length - 0.5) { release(8); return true; }
      return false;
    },
  };
}
```

`h.startGlide()` sets its speed from horizontal velocity, so the glide inherits the zip speed.

- [ ] **Step 5: Add the triggers in `hero.js`.**
  - **Grapple to a zip start.** In `grappleControl`'s `k >= 1` branch, before the ledge check from Task 5, add:

```js
            if (point.zip) { cable.visible = false; h.control = createZipControl(h, { events }, { line: point.zip, s: 0.5 }); return false; }
```

  - **Jump or glide into a cable.** After the ledge trigger, add:

```js
    if (!h.control && h.lastClimbT > 0.5 && (h.state === 'air' || h.state === 'glide') && climbables.ziplines.length) {
      for (const line of climbables.ziplines) {
        const c = zipClosest(line, { x: pos.x, y: pos.y + 2.05, z: pos.z });
        if (c.dist < 0.9 && c.s < line.length - 3) { h.control = createZipControl(h, { events }, { line, s: c.s }); return; }
      }
    }
```

Import `zipClosest` and `createZipControl`.

- [ ] **Step 6: Verify in game.** Build and preview:

```bash
node scripts/dev-play.mjs "http://localhost:5204/?at=start&god=1" "$TEMP/b3" '[{"wait":2500,"eval":"window.__game.comic.skip()"},{"eval":"window.__game.climbables.ziplines.length"},{"eval":"(() => { const z = window.__game.climbables.ziplines[4]; window.__game.teleport({ x: z.a.x, y: z.a.y - 2.1, z: z.a.z }); window.__game.hero.state = \"air\"; return z.length; })()"},{"wait":200,"eval":"window.__game.hero.control?.name"},{"wait":1200,"shot":"zip"},{"wait":2000,"eval":"({ ctl: window.__game.hero.control?.name, speed: window.__game.hero.control?.speed })"}]'
```

Expected: at least 7 ziplines are built (a warning names any that got skipped). The control is `'zip'`, and the speed is above 12 after 3 s on a downhill cable. Take a screenshot of each cable from the side, then fix any route that is skipped or clips a building by nudging its coordinates.

- [ ] **Step 7: Run all the tests and commit**

```bash
npx vitest run
git add src/world/ziplines.js src/actors/traverse/zipline.js src/game/world.js src/actors/hero.js src/game/game.js tests/unit/climbables.test.js
git commit -m "Ziplines across the longest roof gaps"
```

---

### Task 7: Wall run

**Files:**
- Create: `src/actors/traverse/wallrun.js`
- Modify: `src/actors/hero.js` (the trigger in the ground and air states)

**Interfaces:**
- Consumes: `findRunWall` (Task 2). Clip `WallRun_Loop`. `h.airRuns`.
- Produces: `createWallRunControl(h, deps, { wall, speed }) -> control` with `name: 'wallrun'` and `camera: 'wallrun'`. Events `wallRun` and `wallKick`.

- [ ] **Step 1: Write the control**

```js
// src/actors/traverse/wallrun.js
// Running along a wall for up to 1.2 s on a gentle arc; jump kicks off with a boost.
const DUR = 1.2;

export function createWallRunControl(h, { collision, events }, { wall, speed }) {
  let t = 0;
  const sp = Math.max(9, Math.min(14, speed));
  const ax = wall.alongX, az = wall.alongZ;
  h.airRuns += 1;
  h.setState('air'); h.grounded = false;
  h.bat.face(Math.atan2(ax, az));
  h.bat.animator.play('WallRun_Loop', { fade: 0.08 });
  events.emit('wallRun');
  return {
    name: 'wallrun',
    camera: 'wallrun',
    update(dt, ctx) {
      t += dt;
      // Up then down: a 1.2 s arc that peaks 1.4 m above the start.
      const vy = 4.6 - 7.7 * t;
      h.vel.set(ax * sp - wall.nx * 1.5, vy, az * sp - wall.nz * 1.5);
      const r = h.integrate(dt);
      h.bat.tilt.rotation.z = wall.side * 0.45;
      if (ctx.input.pressed('jump')) {
        h.bat.tilt.rotation.set(0, 0, 0);
        h.vel.set(ax * sp * 0.8 + wall.nx * 7.5, 9, az * sp * 0.8 + wall.nz * 7.5);
        h.setState('air'); h.airT = 0.3; h.lastClimbT = 0;
        h.bat.face(Math.atan2(h.vel.x, h.vel.z));
        h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
        events.emit('wallKick');
        return true;
      }
      const still = collision.query(h.pos.x - 1, h.pos.z - 1, h.pos.x + 1, h.pos.z + 1).includes(wall.box);
      if (t > DUR || r.grounded || !still) {
        h.bat.tilt.rotation.set(0, 0, 0);
        h.setState(r.grounded ? 'ground' : 'air');
        h.lastClimbT = 0;
        return true;
      }
      return false;
    },
  };
}
```

- [ ] **Step 2: Add the trigger in `hero.js`.** In `locomotion`, inside the `h.jumpBuffer > 0 && h.state === 'ground'` branch and the air branch, check for a wall first. Add this before the normal ground jump, as the first statement of the `if (h.jumpBuffer > 0 && h.state === 'ground')` block:

```js
        const wall = input.down('sprint') && h.airRuns < 1 ? findRunWall(collision, pos, vel.x, vel.z) : null;
        if (wall) { h.jumpBuffer = 0; h.control = createWallRunControl(h, { collision, events }, { wall, speed: h.speed }); return; }
```

In the air branch, next to the coyote-jump line, add the same check against `h.jumpBuffer > 0` (a mid-air Jump near a wall also starts a run). Import `findRunWall` and `createWallRunControl`.

- [ ] **Step 3: Verify in game.** Teleport beside a building wall on the neon street `{ x: 150, y: 0, z: 10 }`, face along it, then hold `ShiftLeft` plus `KeyW` for 0.8 s and press Space. Take screenshots during the run. Expected: `control.name === 'wallrun'` for at least 0.5 s. A second Space kicks off, and a second run can't start until you land.

- [ ] **Step 4: Run all the tests and commit**

```bash
npx vitest run
git add src/actors/traverse/wallrun.js src/actors/hero.js
git commit -m "Wall run with kick-off"
```

---

### Task 8: Dive bomb

**Files:**
- Create: `src/actors/traverse/divebomb.js`
- Modify: `src/combat/combatSystem.js` (add `shockwave(center, radius)`)
- Modify: `src/actors/hero.js` (the trigger in the glide state)
- Modify: `src/game/game.js` (pass `combat` to the hero after it's created: `hero.combat = combat`)
- Test: `tests/unit/combat.test.js` (the shockwave radius, via a pure helper)

**Interfaces:**
- Consumes: `enemy.launch(vx, vy, vz)`, `enemy.applyHit(result, fromPos)`, `critical(target)` inside combatSystem, and `follow.actionShot`.
- Produces: `combat.shockwave(center, radius = 4) -> number` (goons knocked down). A pure `inShockwave(center, p, radius)` exported from `src/combat/rules.js`. Events `diveStart` and `diveImpact` (payload `{ pos, count }`).

- [ ] **Step 1: Write a failing test** in `tests/unit/combat.test.js`:

```js
import { inShockwave } from '../../src/combat/rules.js';
it('shockwave reaches 4 m flat and 2.5 m vertically', () => {
  expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 3.9, y: 0, z: 0 }, 4)).toBe(true);
  expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 4.1, y: 0, z: 0 }, 4)).toBe(false);
  expect(inShockwave({ x: 0, y: 0, z: 0 }, { x: 1, y: 3, z: 0 }, 4)).toBe(false);
});
```

- [ ] **Step 2: Implement `inShockwave`** in `src/combat/rules.js`:

```js
export function inShockwave(c, p, radius = 4) {
  return Math.hypot(p.x - c.x, p.z - c.z) <= radius && Math.abs(p.y - c.y) <= 2.5;
}
```

Then add `shockwave` to the object returned by `createCombat`:

```js
    shockwave(center, radius = 4) {
      let n = 0;
      for (const e of enemies) {
        if (!e.alive || e.down || e.type === 'joker' || !inShockwave(center, e.pos, radius)) continue;
        const dx = e.pos.x - center.x, dz = e.pos.z - center.z, d = Math.hypot(dx, dz) || 1;
        e.applyHit({ outcome: 'hit', damage: 30, knockdown: true }, center);
        e.launch((dx / d) * 6, 6, (dz / d) * 6);
        n += 1;
      }
      if (n) critical(enemies.find((e) => inShockwave(center, e.pos, radius)) ?? enemies[0]);
      events.emit('diveImpact', { pos: center.clone(), count: n });
      return n;
    },
```

Before writing it, check `applyHit`'s expected result shape in `src/actors/enemy.js` and match its existing fields for a knockdown hit. The field names above are illustrative only; use the ones `resolveHit` in `rules.js` returns for a heavy knockdown.

- [ ] **Step 3: Write the control**

```js
// src/actors/traverse/divebomb.js
// From a glide: dive straight at the aimed ground spot, then a shockwave.
export function createDiveControl(h, { collision, events, combat }) {
  h.cape.setWings(false);
  h.bat.animator.play('Dive', { fade: 0.06 });
  h.setState('air');
  events.emit('diveStart');
  let t = 0;
  return {
    name: 'dive',
    camera: 'dive',
    update(dt, ctx) {
      t += dt;
      const f = ctx.cam.forward({ x: 0, y: 0, z: 0 });
      h.vel.x += (f.x * 8 - h.vel.x) * Math.min(1, dt * 3);
      h.vel.z += (f.z * 8 - h.vel.z) * Math.min(1, dt * 3);
      h.vel.y = Math.max(-42, h.vel.y - 60 * dt);
      h.bat.tilt.rotation.x = 1.2 * h.bat.lm.fwd;
      // Direct hit on a goon on the way down.
      for (const e of combat.enemies) {
        if (e.alive && !e.down && e.pos.distanceTo(h.pos) < 1.1) { e.applyHit({ outcome: 'hit', damage: 40, knockdown: true }, h.pos); }
      }
      const r = h.integrate(dt);
      if (r.grounded || t > 4) {
        h.bat.tilt.rotation.set(0, 0, 0);
        combat.shockwave(h.pos, 4);
        h.land(-20);
        return true;
      }
      return false;
    },
  };
}
```

As in Step 2, match the enemy result fields to the real ones. `cam.forward` must accept a plain object, or else use a `THREE.Vector3` as in Task 5.

- [ ] **Step 4: Add the trigger.** In `hero.js` glide state, before the `if (!input.down('jump'))` release check, add:

```js
      if (input.pressed('kick') && heightAboveGround() > 6 && h.combat) {
        h.control = createDiveControl(h, { collision, events, combat: h.combat });
        return;
      }
```

In `combatSystem.update`, the buffered `kick` press must not also start a jump-kick while gliding. Skip `tryStart` when `hero.state === 'glide'`.

- [ ] **Step 5: Verify in game.** Use `?fight=test&god=1`. Teleport 25 m above the squad and start a glide (set `hero.state` with `startGlide()`), then press `KeyE`. Take a screenshot at impact and eval `enemies.filter(e => e.down || e.air).length`. Expected: 2 or more goons are knocked down, the action camera fires, and there are no console errors.

- [ ] **Step 6: Run all the tests and commit**

```bash
npx vitest run
git add src/actors/traverse/divebomb.js src/combat/combatSystem.js src/combat/rules.js src/actors/hero.js src/game/game.js tests/unit/combat.test.js
git commit -m "Dive bomb with shockwave"
```

---

### Task 9: Ledge and drop takedowns

**Files:**
- Modify: `src/actors/traverse/ledge.js` (punch while hanging below an unaware goon)
- Modify: `src/actors/hero.js` (the drop-takedown check on landing)
- Modify: `src/combat/combatSystem.js` (add `takedown(enemy, kind)`)

**Interfaces:**
- Consumes: the `ledge` control from Task 5, `h.combat` from Task 8, clip `Ledge_Yank`, and `critical()`.
- Produces: `combat.takedown(enemy, kind /* 'ledge' | 'drop' */)`, which is an instant KO with an action shot. Events `takedown` (payload `{ kind }`).

- [ ] **Step 1: Add `takedown` to combat.** Add it to the returned object:

```js
    takedown(e, kind) {
      if (!e?.alive) return false;
      e.health = 0;
      e.applyHit({ outcome: 'ko' }, hero.pos);
      critical(e, { slow: 0.7 });
      events.emit('takedown', { kind, pos: e.pos.clone() });
      return true;
    },
```

`{ outcome: 'ko' }` is the shape `winFight` in `game.js` already uses, so it's known to work.

- [ ] **Step 2: Ledge takedown.** In the ledge control's hanging branch, before the jump checks, add:

```js
      if (input.pressed('punch') && h.combat) {
        const e = h.combat.enemies.find((g) => g.alive && !g.down && !g.aware &&
          Math.abs(g.pos.y - l.y) < 0.4 && Math.hypot(g.pos.x - l.x, g.pos.z - l.z) < 1.5);
        if (e) {
          h.bat.animator.play('Ledge_Yank', { once: true, fade: 0.05 });
          e.launch(l.nx * 3, 2, l.nz * 3);
          h.combat.takedown(e, 'ledge');
        }
      }
```

`g.aware` is the existing enemy flag. Part D will add proper awareness, and this check keeps working with it.

- [ ] **Step 3: Drop takedown.** In `hero.js` `land(impact)`, at the top, add:

```js
    if (impact < -8 && h.combat && h.control?.name !== 'dive') {
      const e = h.combat.enemies.find((g) => g.alive && !g.down && Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z) < 1.2 && Math.abs(g.pos.y - pos.y) < 1);
      if (e) h.combat.takedown(e, 'drop');
    }
```

- [ ] **Step 4: Verify in game.**
  - **Ledge takedown:** in `?fight=test&god=1`, move one goon (`enemies[0].pos`) onto a roof edge where the hero hangs, set `aware = false` and put it in `idle` state, then press punch. Expected: `enemies[0].alive === false` and a `takedown` event.
  - **Drop takedown:** teleport 6 m above a goon and let the hero fall. Expected: the same result.

- [ ] **Step 5: Run all the tests and commit**

```bash
npx vitest run
git add src/actors/traverse/ledge.js src/actors/hero.js src/combat/combatSystem.js
git commit -m "Ledge and drop takedowns"
```

---

### Task 10: Hints, help, sound words and gamepad

**Files:**
- Modify: `src/ui/prompts.js` (new prompt texts)
- Modify: `src/game/game.js` (`PROMPT_DONE` map, trigger the first-time hints, sound words)
- Modify: `src/game/sound.js` (audio for the new events)
- Modify: `src/ui/menus.js` (help page lines)

**Interfaces:**
- Consumes: the events from Tasks 4 to 9.
- Produces: prompts `ladder`, `ledge`, `zip`, `wallrun`, `dive` and `takedown`. `moveLearned` events (payload `{ id }`) for the progress tracker in Plan 3C. Ids: `ladder`, `ledge`, `zipline`, `wallrun`, `divebomb`.

- [ ] **Step 1: Add the prompt texts** to the `P` object in `promptText`. Keep the current tone and use no em dashes:

```js
    ladder: `Walk into a ladder to climb it. ${k('forward')} and ${k('back')} climb, ${k('sprint')} slides down, ${k('jump')} kicks off.`,
    ledge: `You grab ledges when you fall short. ${k('left')} ${k('right')} shimmy, ${k('forward')} pulls up, ${k('back')} lets go. ${k('jump')} while holding ${k('back')} backflips off.`,
    zip: `Grapple to a zipline post with ${k('grapple')} or glide into the cable. ${k('jump')} lets go at full speed.`,
    wallrun: `Sprint along a wall and press ${k('jump')} to run on it. ${k('jump')} again to kick off.`,
    dive: `Gliding high? Press ${k('kick')} to dive bomb and flatten everyone where you land.`,
    takedown: `Hanging under an unaware goon? ${k('punch')} pulls them over the edge. Landing on one from above works too.`,
```

- [ ] **Step 2: Trigger first-time hints and mark them done.**
  - Extend `PROMPT_DONE` with `{ ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zip', wallRun: 'wallrun', diveStart: 'dive', takedown: 'takedown' }`.
  - Queue the ladder hint when the hero is within 6 m of a ladder foot for the first time. Queue the zip hint when a zip grapple point is the grapple target for the first time. Queue the dive hint after the first 3 s of gliding more than 10 m up. Do this in `game.update` with cheap checks every 0.5 s, using `prompts.show(id)`. Look up the queue's real method name in `src/ui/prompts.js` (`createPromptQueue`) before writing the call.
  - Emit `moveLearned` once per id the first time each event fires:

```js
    const MOVE_IDS = { ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zipline', wallRun: 'wallrun', diveImpact: 'divebomb' };
    const learned = new Set();
    for (const [ev, id] of Object.entries(MOVE_IDS)) events.on(ev, () => { if (!learned.has(id)) { learned.add(id); events.emit('moveLearned', { id }); } });
```

- [ ] **Step 3: Sound words.** In `game.js`, next to the existing `events.on('word', ...)`, add these through the existing `word` event:

```js
    events.on('zipOn', () => events.emit('word', { text: 'ZZZIP!', pos: hero.pos.clone().setY(hero.pos.y + 2), big: false }));
    events.on('diveStart', () => events.emit('word', { text: 'FWOOSH!', pos: hero.pos.clone(), big: false }));
    events.on('diveImpact', ({ pos }) => events.emit('word', { text: 'KA-THOOM!', pos, big: true }));
    events.on('land', ({ hard }) => { if (hard) events.emit('word', { text: 'THUD', pos: hero.pos.clone(), big: false }); });
```

In `src/game/sound.js`, map the new events to existing synth sounds:
- `ladderOn`, `ledgeGrab`: `grappleLand`
- `zipOn`: `grapple`
- `wallRun`, `wallKick`: `whoosh`
- `diveStart`: `glideStart`
- `diveImpact`: `land` at gain 1.4
- `takedown`: the same sound as a critical hit

- [ ] **Step 4: Help page.** In `src/ui/menus.js`, add a "Moving around" section to the help or controls page with one line per move, reusing the prompt texts from `promptText`.

- [ ] **Step 5: Gamepad.** No new bindings. The moves use actions that already have pad buttons. Confirm this by reading `PAD_BUTTONS` in `src/core/input.js`.

- [ ] **Step 6: Run all the tests and commit**

```bash
npx vitest run
git add src/ui/prompts.js src/game/game.js src/game/sound.js src/ui/menus.js
git commit -m "Traversal hints, sound words and help"
```

---

### Task 11: Full verification (the lead runs this)

- [ ] **Step 1:** `npx vitest run`. Every test passes, including the new ones (about 110).
- [ ] **Step 2:** `npx playwright test`. All 4 smoke tests pass.
- [ ] **Step 3:** Build to `$TEMP/gdist` and preview on 5202. Then run `BASE=http://localhost:5202/ OUT="$TEMP/pt3" node scripts/playthrough.mjs`. It must end at `credits` with no console errors. The auto-ledge grab must not trap the scripted playthrough. If it does, the playthrough script sets `settings.autoLedge = false`, or better, the hero only grabs when moving toward the wall.
- [ ] **Step 4:** The scripted run for every move (Tasks 4 to 9) passes on the frozen build, with screenshots saved to `docs/screens/traversal-*.png`.
- [ ] **Step 5:** Performance: `node scripts/perf.mjs` against the build. No scene is more than 5% slower than before (the ziplines add 8 line meshes).
- [ ] **Step 6:** Load time: `node scripts/load-time.mjs http://localhost:5202/ 40 1`. `firstFrame` is still under 3.2 s.
- [ ] **Step 7:** WebKit: `node scripts/webkit-check.mjs http://localhost:5202/ "$TEMP/wk"`. No console errors.
- [ ] **Step 8:** The lead pushes to `main` after reviewing the screenshots.
