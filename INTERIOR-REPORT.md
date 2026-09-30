# Part I: Interiors — report

Branch `interior`, worktree `C:\Users\awsom\Documents\Projects\gotham-interior`. Built for the
2026-09-30 Birthday Night spec's Interiors contract.

## What works

- The cathedral (Ace's clock plaza landmark) is hollow inside, keeping its exterior look, roof and
  pitched-roof collision exactly as the city built them. It has the **Joker's Funhouse**: a nave
  about 22 x 58 x 20 m, checkered floor, ten purple/Joker-green striped pillars with carnival bulb
  strings sagging between them, a Joker face stage on the far wall lit by a hanging spotlight cone
  and warm/purple floor light pools, two HAPPY BIRTHDAY banners with a Joker twist ("COURTESY OF
  THE JOKER" / "GUESS WHO... HA HA HA HA"), a bunting garland, balloon clusters, four funhouse
  mirror panels, a spinning spiral wall panel, confetti scattered on the floor, and a balcony ledge
  with grapple points down both long walls.
  - **Entrances**: the plaza doors at street level (under the existing stone portal, walkable) and
    a broken rose window high on the far gable (glide in, no floor there).
  - New `funhouse` SITE at the nave centre floor (`{x:-120, y:0.15, z:-150}`), fight radius 12.
- The Ace Chemicals factory is hollow inside (its sawtooth roof deck, from the earlier fix, is
  completely untouched). It has the **Ace Hall**: two rows of glowing green vats, a catwalk
  spine with cross-brace and posts (collision), two pipe runs with hand-wheel valves, hazard
  stripes on the floor around the catwalk footprint, hanging work lights, a raised glass office,
  and scattered barrels.
  - **Entrance**: a loading dock door at street level on the west wall, right by the existing
    "WANTED" poster and graffiti (districts.js already anticipated a door there).
  - New `aceHall` SITE at the hall centre floor (`{x:140, y:0.15, z:-172}`), fight radius 12.
- Walking (or gliding) through a doorway is detected automatically every frame (room-bounds test
  against the hero's own position — every way in is a real gap in the collision, so this is exactly
  "went through a doorway"); it sets `inside` and emits `roomEnter { id }` / `roomExit { id }`.
- Inside: the rain hides (`rain.mesh.visible = false`, restored on exit — verified live, not just
  unit-tested); the exterior sky/fog stay; the ceiling and every wall are real collision boxes, so
  the follow camera's own wall-avoidance raycast never lets it clip through them; interior lighting
  uses the existing shared light-pool (`lightSpot`, picks the 4 closest sources to the player citywide)
  plus baked halos/glow, so it costs nothing extra when the player is elsewhere — no new
  always-on lights were added.
- `enter(id)` / `exit()` teleport to the room's fight centre / a safe point just outside the main
  door (ground-snapped via `collision.groundBelow`), for dev/story use, e.g.
  `window.__game.interiors.enter('funhouse')`.

## The API as built

`src/world/interiors.js`:
- Pure data/logic (unit-tested, no three.js): `INTERIOR_ROOMS` (`funhouse`, `aceHall`, each with
  `bounds`, `doors`, `fight`, `outside`), `roomBounds(room)`, `insideRoom(room, p)`,
  `roomAt(p, rooms?)`.
- `buildInteriors(ctx)` — impure builder, called from `src/game/world.js` right alongside
  `buildCity`/`buildDistricts`/`buildZiplines`, before `finishCity(ctx)`, so its geometry merges
  into the same buckets and freezes with the rest of the city. Uses its own seeded `createRng`
  instances (4242 for the funhouse, 9911 for the hall) — never `ctx.rng` — so the city's draw
  count and layout are untouched.
- `createInteriors({ hero, events, rain, collision, rooms? })` — the runtime contract:
  `{ rooms, enter(id), exit(), inside, update() }`. Wired into `src/game/game.js`'s small marked
  "Part I" hook block: created in `buildRun()`, `update()` called once a frame, exposed on the
  run's `api` (and so on `window.__game.interiors`).

### How the hollow buildings were cut in (cityBuilder.js / mapData.js)

`mapData.js`'s cathedral and factory entries gained two new fields: `hollow: true` (skip the
building's whole-volume collision box) and `exteriorHoles: [...]` (drop those side faces — 0 +x,
1 -x, 4 +z, 5 -z — from the shared exterior mesh so a real doorway/window can be cut into them).
`cityBuilder.js`'s `facade()` reads these through two new options (`collide`, `excludeFaces`);
its one `ctx.rng.next()` call is unconditional, so this changes zero rng draws for any building.
`interiors.js` then builds real wall pieces with door/window gaps for the faces it excluded
(`wallWithGap`), and a double-sided inside lining for the faces it kept (`wallLining`) — a
single-sided kept face is invisible from its own inside (backface-culled), so without the lining
it reads as a hole; the lining uses one small dedicated `interiorWall` material, not the shared
city facade materials, so this costs nothing on the exterior view.

## A real bug found and fixed along the way

The first pass looked "see-through" from inside: standing in the Ace hall you could apparently see
the exterior yard, a car, wet-ground reflections. It **was not** a rendering bug — the wall
geometry, collision and depth-testing were all correct (I traced it with the actual `position`
buffer and `collision.raycast`). The real cause: `src/world/cityLife.js`'s decorative traffic runs
cars along fixed lines, and `z = -150` is one of them. That line runs straight through the
funhouse's centre and is exactly the Ace hall's south wall, and traffic has no idea either building
is now hollow. Fixed by dropping that one line from the `alongX` traffic pick
(`src/world/cityLife.js`); the `rng.pick()` call count per car is unchanged (same one call, just a
narrower array), so this is safe under the "don't change the city's draw count" rule and doesn't
touch `ctx.rng` at all.

## Tests

- `tests/unit/interiors.test.js` (10 tests, all green): pure room-bounds/door-threshold logic,
  `roomAt` telling the two rooms apart, `SITES.funhouse`/`SITES.aceHall` on solid floor collision
  (built with a stub ctx + `createCollision`, the `sawtoothRoof.test.js` pattern), the plaza doors
  and loading dock as real unblocked raycasts, both ceilings as real collision (camera can't see
  through the roof), pillars/catwalks present, and the `createInteriors` runtime (enter/exit,
  rain toggle, automatic doorway detection).
- Full suite: `npx vitest run` → **79 files, 876 tests, all green** (866+ baseline plus these 10).
- `node scripts/course-check.mjs`, `breakables-check.mjs`, `stealth-check.mjs`: all green against
  the frozen preview build — the city layout (courses, crime spots, breakable rooms, stealth rooms,
  street-level ladders) is unshifted.

## Browser verification

Built with `npx vite build --outDir "$TEMP/idist"`, served with
`npx vite preview --outDir "$TEMP/idist" --port 5287 --strictPort`. Driven with `dev-play.mjs`
against `?at=toAce&god=1&new=1` (joins mid-story in free-roam, no intro cutscene to fight through).
Teleported outside each door, walked in on foot (held `KeyW` after facing the door with
`follow.snapBehind`), looked around from several angles, and spawned a small goon squad at each
fight SITE to show the space. `ONLY=main node scripts/fps-sweep.mjs http://localhost:5287/ high`
was run once; the exterior scenes near the two buildings (`clock plaza` p95 6.1 ms, `ace yard` p95
4 ms) are within the 6.9 ms budget. `arrive:glide` (p95 13.3 ms) and `spawn` (p95 7 ms) are over,
but those scenarios fly over/spawn goons on the far side of the city from both interiors — they
read like pre-existing camera-cut/instantiation cost, not something this part added; I did not
have time to diff against a pre-change baseline to prove that conclusively, so it's flagged as a
gap below rather than claimed clean.

Screenshots saved to
`C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\i\`:
- `01-cathedral-exterior.png`, `02-acehall-exterior.png` — exterior look, unchanged, with the real
  doors visible as actual openings (not painted-on).
- `03-funhouse-doors-outside.png`, `04-funhouse-walked-in.png` — walking through the plaza doors.
- `05-funhouse-stage-view.png`, `06-funhouse-entrance-view.png`, `07-funhouse-mirrors-view.png` —
  striped pillars, carnival lights, the Joker face stage under its spotlight, light pools, mirrors.
- `08-funhouse-fight.png` — three goons spawned at the `funhouse` SITE.
- `09-acehall-dock-outside.png`, `10-acehall-walked-in.png` — walking through the loading dock.
- `11-acehall-center-view.png`, `12-acehall-office-view.png` — catwalks, the glass office.
- `13-acehall-fight.png` — two goons spawned at the `aceHall` SITE, vats/valve/hanging light visible.

All were looked at; the funhouse and hall read as intentional, colourful, readable spaces in the
ink style, not dark or empty holes in the city.

## Gaps / known limitations (scoped down for the deadline)

- The fps-sweep's `arrive:glide`/`spawn` numbers above 6.9 ms p95 are unconfirmed as pre-existing
  (see above) — worth a baseline diff before shipping wider.
- Interior wall texturing is a plain colour (stone/steel), not the tiled facade texture other
  buildings use, on the pieces this part built by hand (the door/window walls and the inside
  linings) — a deliberate simplification to keep the fix small and safe under time pressure.
- No dedicated stealth/AI wiring for `aceHall` as a predator room; it's built to host either a
  straight fight or a future stealth pass (catwalks + cover-height posts are there), but only the
  fight path was exercised tonight.
- The Joker face, spiral panel and party banners are canvas/primitive-built in code
  (Fable-authored, no external art); the canvas-based ones (spiral, banners) are guarded by
  `typeof document !== 'undefined'` so `buildInteriors` still builds cleanly (and stays
  unit-testable) under Vitest's node environment.
- Story's fight/stealth definitions for `funhouse`/`aceHall` (waves, goon types) are not part of
  this contract and weren't added — only the SITES and the room space they need.

## Files touched

- `src/world/interiors.js` (new) — pure room data + impure builder + runtime.
- `src/world/mapData.js` — cathedral/factory `hollow`/`exteriorHoles`, `SITES.funhouse`/`aceHall`.
- `src/world/cityBuilder.js` — `facade()` gains `collide`/`excludeFaces` options (rng-neutral).
- `src/world/cityLife.js` — traffic no longer drives the `z = -150` line (rng-call-count-neutral).
- `src/game/world.js` — calls `buildInteriors(ctx)` alongside the rest of city construction.
- `src/game/game.js` — the small marked Part I hook block: builds `createInteriors`, ticks
  `update()`, exposes `interiors` on the run API / `window.__game`.
- `tests/unit/interiors.test.js` (new).

Commits on `interior` (no trailers, author Krishn Gohel): `Interiors WIP: funhouse and Ace hall`,
`Interiors: fix see-through walls, dress both rooms`.
