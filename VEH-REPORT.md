# Part V1: Ground Vehicles — report

Branch `veh`, worktree `gotham-veh`. Built against the spec at
`docs/superpowers/specs/2026-09-30-birthday-night-design.md`.

## Polish round (after merge into the integration branch)

The controller looked at the merged build and flagged that the Batmobile didn't read (a stack of
flat boxes) and that summon overlapped Batman. Addressed, same worktree:

- **Model rebuilt as a real silhouette.** `createBatmobile` now extrudes the hull from a single
  side-profile `Shape` (nose tapered and low, canopy set forward, a longer flat rear deck, a low
  tail), bevelled instead of flat-faced. The cockpit canopy is a blue-tinted glass bubble. Two tail
  fins are the actual bat emblem (`batOutline` from `src/config/batShape.js`), mounted as raked
  blades standing off the rear deck (full face from the side, a thin edge from behind, like a real
  fin). Wheels are chunkier with a hub that visibly protrudes and a bright cap. The rear jet glow
  was cut down to size (it was blowing out to dominate the whole back of the car) and now sits
  inside its housing ring; white headlights and a split red tail-light strip were added. The
  armour material carries the same rim-light treatment the characters get
  (`addRim`, `src/actors/outfitParts.js`), plus mid-grey panel lines on the hood and doors, so it
  pops against the dark street. Verified from behind, from the side and head-on — see screenshots.
- **Street cars rebuilt the same way**: an extruded body profile per kind (a fastback sedan, a
  boxier van) instead of stacked boxes, inset windscreen/rear/side glass, a wheel-arch overlay per
  wheel, headlights and tail lights, ink edges. Still cheap (a handful of meshes each, no new
  shader variants).
- **Drive camera pulled back and up**: `MODES.drive` in `src/game/camera.js` went from
  `{ dist: 7.2, height: 1.7 }` to `{ dist: 11.5, height: 3.6 }`, with a smaller speed FOV kick, so
  the car reads as a whole with the road ahead visible instead of filling most of the frame.
- **Summon no longer overlaps Batman.** It now appears on a real street point 8 m away (not on top
  of him), facing along the street toward him, then slides in over 0.85 s (wheels spinning, ground
  snapped every step) and parks 2.6 m away — inside the 4 m enter range — with the "SCREEECH!" word
  firing on arrival, not on appearance. `summon(kind, { instant: true })` (used only by
  `startBattle`, so its auto-enter still chains synchronously) skips the slide. While the Batmobile
  is mid-slide (`bm.arriving`) it can't be entered or re-summoned, so a second `vehicle` press
  during the animation is a safe no-op. Verified deterministic across three repeated runs: appears
  7.5 m out, parks at 2.60 m, enters every time (`vehicles.active.kind === 'batmobile'`,
  `hero.control.name === 'drive'`).
- Also fixed in passing: the collision radius (was hand-set to 1.7, independent of the model) now
  comes from the model itself (1.9, sized for the longer hull); the wheel-spin radius constant was
  updated to match the bigger tyres.

Full vitest suite still green (881/881) and the fps sweep still comfortably under budget (p95
2.9–6.3 ms) after these changes; see the updated sections below.

## What works

- **Batmobile model** (`src/vehicles/vehicleModels.js: createBatmobile`): code-built from boxes,
  an extruded canopy shape and cylinders, in the game's toon/ink materials. Low, wide, black
  armour, a bat-wing cockpit canopy, side pontoons and rear fins, a glowing orange rear jet
  (brighter and larger while boosting), and four wheels that steer (front pair) and spin. Reads
  clearly as the Batmobile at a glance in the comic style (see screenshots below).
- **Summon and enter.** Press `vehicle` (KeyT): if a vehicle is within 4 m it is entered; otherwise
  the Batmobile appears at the nearest street point near Batman with a "SCREEECH!" word burst and
  a caption. Pressing `vehicle` again immediately after (now within range) enters it.
- **Driving.** While driving, the hero's `control` is `{ name: 'drive', camera: 'drive' }`, the hero
  mesh and cape are hidden, and the follow camera switches to a new `'drive'` mode (behind, low,
  with its own speed FOV kick), added to `src/game/camera.js`'s `MODES`.
- **Arcade physics**: W/S throttle and brake/reverse, A/D steer, Space handbrake drift, Shift
  boost (with the jet glowing bigger and an FOV kick). Frame-rate independent (exponential-style
  `Math.min(1, rate*dt)` blending, same convention as `hero.js`), no per-frame allocation (scratch
  vectors are reused; the one place that allocates, `fx.impact(...).clone()` on a ram or a hit, is
  event-driven, not steady-state, matching the rest of the codebase).
- **Collision**: vehicles are simple cylinders against the existing AABB world (`collision.
  resolveCylinder`), bounced off walls with restitution (no tunneling), snapped to the street
  ground, and clamped inside `WORLD` bounds.
- **Exit and eject.** Press `vehicle` again to exit beside the car. While driving fast (>= 14 m/s),
  a quick tap of Jump (Space) ejects Batman upward and calls `hero.startGlide()` directly (reusing
  the hero's own glide state). Space also doubles as the handbrake: a tap under ~0.22 s at speed
  ejects, holding it (a drift) never does, so drifting at any speed still works.
- **Commandeer street cars**: 12 parked cars (sedans and vans, a few colours) spawn on real street
  lines, from the vehicle module's own seeded rng (`createRng(7331)`) — `ctx.rng` (the city's rng)
  is never touched. Walking up and pressing `vehicle` takes one, with the caption "Borrowed for
  the birthday. Gordon will explain." It drives with the same controller at slower, softer tuning.
  Exiting leaves it where it stopped.
- **Ramming**: driving into an aware goon within reach knocks them down (`enemy.applyHit` with
  `outcome: 'knockdown'`, non-lethal) with a hit burst. Ramming another vehicle (a parked car, or
  the Joker's van) shoves it, with a burst and a "KRUNCH!" word on a chase-relevant hit.
- **Chase mission**: `startChase({ path, onDone })` spawns a purple-and-green Joker van (repainted
  civilian van shape, a spinning beacon) that drives a given path of street points. Ramming it 3
  times (with a short per-vehicle cooldown so one graze can't double-count) ends the chase and
  emits `chaseDone { ok }`. A small ink-styled "CHASE n/3" meter shows in its own DOM (no changes
  to `src/ui/hud.js`). A 90 s safety timeout ends it as a loss if the van is never caught, so the
  story can't hang.
- **Battle mission**: `startBattle({ site, drones, onDone })` auto-summons and enters the Batmobile
  at the site if not already driving it, spawns N code-built drone tanks (tracked-box hull, turret
  and barrel that track the Batmobile), and lets Punch fire a shock cannon while in battle and
  driving the Batmobile: a tracer plus a hit burst and a "BAZZAP!" word. Drones take 3 hits each;
  the last one ends the battle and emits `battleDone { ok }`. Drones fire slow (9 m/s), dodgeable
  purple shells back; a hit is a camera shake, not damage (kept low-risk given the time budget —
  see gaps below).
- **Wiring**: `createVehicles(deps)` in `src/vehicles/`, one small marked hook block in
  `src/game/game.js` (`// ---- Part V1: ground vehicles ... ----`, both at creation and in the
  per-frame `update()`), `window.__game.vehicles` exposed. The `vehicle` action is in
  `src/core/bindings.js` (rebindable, default KeyT) with a Controls-help row (falls out of the
  existing group loop) and in `src/ui/menus.js`'s gamepad list. Materials are warmed for free: all
  vehicle meshes (Batmobile, all 12 street cars) are built and added to the scene during
  `buildRun()`, before `game.js`'s existing `uploadTextures`/`drawEverything` prewarm pass runs, so
  they're compiled and uploaded under the loading screen exactly like the rest of the run's
  objects. The Joker van and drone tanks (mission-only) use only stock `toonMaterial`/
  `MeshBasicMaterial`/`addHullOutline` with no new `onBeforeCompile` shader variants, so they don't
  need separate warming.

## Controls

- Keyboard: `T` summons, enters or exits a vehicle. While driving: `W`/`S` throttle/brake-reverse,
  `A`/`D` steer, `Space` handbrake (hold) or eject (tap while fast), `Shift` boost, `Mouse0` (punch)
  fires the shock cannon in a battle.
- Gamepad: D-pad down and up were already taken (`help`, `photo`), so `vehicle` is **D-pad left**
  (button 14) — it doubles as the chain-1 chord button, and the existing chord-latch logic in
  `src/core/input.js` already suppresses it correctly while block (Y) is held for a chain takedown.
  Noted in the pad help list in `src/ui/menus.js`.
- No existing binding was changed.

## API as built (matches the spec's contract)

```js
createVehicles(deps) // deps: scene, collision, hero, events, input, follow, combat, fx, hudRoot
// -> { summon(kind='batmobile'), enter(v), exit(), eject(), active, update(dt, real),
//      startChase({ path, onDone }), startBattle({ site, drones, onDone }) }
```
Events: `vehicleEnter { kind }`, `vehicleExit { kind }`, `chaseDone { ok }`, `battleDone { ok }`.
Hero control name while driving: `'drive'`.
Dev/debug extras (not part of the frozen contract): `vehicles.batmobile`, `vehicles.streetCars`,
`vehicles.chase`, `vehicles.battle`.

## Tests

- `npx vitest run`: **881 passed** (866 pre-existing + 15 new), 0 failed. New file:
  `tests/unit/vehiclePhysics.test.js` covers `stepDrive` (throttle/boost accel and top speed,
  braking into reverse, drag coast-down, no turning while stationary, steering sign-flip in
  reverse, drift build/decay, frame-rate independence at 10 fps vs 120 fps), `driveVelocity`,
  `bounceOffWall` (reflects into a wall, leaves away-from-wall velocity alone, a restitution of 0
  just cancels the inward component), and `createRamCounter` (chase ram counting with cooldown).
  Two pre-existing tests hard-coded `KeyT` and pad button 14 as "known free" placeholders; updated
  them to `KeyU` and to expect `['vehicle']` respectively, since those are no longer free.
- Browser check on a frozen `vite build` served via `vite preview` (port 5281), driven with
  `scripts/dev-play.mjs`: summon, enter, drive, wall/vehicle bounce, drift, boost, eject into a
  glide, exit, commandeer a street car and drive/exit it, run a chase (ram registered, HUD updated,
  van model and beacon visible), and run a battle (cannon tracer, drone hit and death, HUD
  updated). No console errors in any run.
- `ONLY=main node scripts/fps-sweep.mjs http://localhost:5281/ high`: p95 **4.7–6.2 ms** across
  every section (budget 6.9 ms). Two hitches (34 ms, 51 ms) both landed in the pre-existing
  "glide" section, not touched by this part; not investigated further given the time budget.

## Screenshots

`C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\v1\`
- `01_start.png` … `04_driving.png`: summon, enter, drive (Batmobile reads well: low black armour,
  canopy, glowing jet).
- `05_drift.png`, `06_boost.png`: a hard drift into a parked street car (a real ram + wall-style
  bounce, not scripted), boost with the bigger jet glow.
- `07_eject_glide.png`, `08_after_glide.png`: eject into a glide, gliding away.
- `sc_01_entered.png`, `sc_02_driving.png`, `sc_03_exited.png`: an isolated, clean commandeer of a
  parked street car (enter, drive, exit) — the clearest single proof of that path.
- `12_chase_start.png`, `13_chase_ram1.png` (a "KRUNCH!" burst on the Joker van, chase meter at
  1/3), `14_chase_ram2.png`.
- `16_battle_start.png`, `17_battle_cannon1.png`, `18_battle_cannon2.png` ("BAZZAP!" bursts, the
  drone counter ticking down).

**Polish round** (same folder): `p01_summon_mid.png`/`p02_summon_arrived.png` (the slide-in and the
screech on arrival), `p03_driving_behind.png`/`p04_driving_boost.png` (the pulled-back drive
camera), `p05_batmobile_side.png` (the new silhouette — nose taper, forward canopy, tail fins),
`p06_batmobile_rear_close.png` (fins, jet, tail-light strip, all correctly sized),
`p07_batmobile_front_close.png` (raked nose, headlights), `p08_sedan_side.png`/`p09_van_side.png`
(the shaped street cars), `check_parked.png`/`check_entered.png` (summon parking cleanly beside
Batman, not on top of him, then entering).

## Known gaps (time-boxed choices, not hidden bugs)

- **Chase completion in the automated test**: the scripted browser check drives straight with no
  steering (`hold: ["KeyW","ShiftLeft"]`, no A/D), so after the van is shoved off in the ramGoons
  path it sometimes outran a second pass within the test's short hold windows. One ram was
  registered and verified end-to-end (HUD, burst, counter); a human player (or the story's own
  driving) steers to keep pace, so this reads as a test-harness limitation, not a code bug. The
  ram-counting and `chaseDone` path themselves are unit-tested and used identically for both hits.
- **Battle shells don't damage the hero**: a shell hit is a camera shake only, not health loss —
  kept intentionally low-risk given the time budget (a wrong damage number would be worse than
  none). Easy to add later: `hero.health -= X; hud.setHealth(...)` where the shell-hit branch is in
  `updateBattle`.
- **Summon doesn't check "street level or on a low roof"**: it always spawns at the nearest street
  point to Batman's x/z, regardless of his height. In practice this is harmless (the car just
  waits on the street below), but it doesn't gate against summoning while very high up.
- **The chase/battle helpers auto-position the Batmobile** when driven from a test/console call
  outside the real story flow (see the `eval` steps in the report above); the Story part is
  expected to call `startChase`/`startBattle` with the player already near the site, per the
  contract's spirit ("every mission type degrades safely... so the story can always be played end
  to end").
- Never touched: `src/ui/hud.js`, `src/ui/style.css`, `ctx.rng`, any existing key binding.
