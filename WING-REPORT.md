# Part V2: The Batwing - Report

Branch `wing`, on top of `main` (b13c946). Commits:
- `9d84eb7` Batwing (Part V2): call it, fly it, pop the Joker balloon armada
- `41ab0e2` Batwing: fix the silhouette read per review (coordinator feedback pass)

## What works

- **The model.** A code-built, sleek black bat-winged jet in `src/vehicles/wingModel.js`: the
  planform is the bat emblem outline (`batOutline()` from `src/config/batShape.js`) extruded and
  stretched into a ~14 m-wingspan delta wing, with a raised cockpit canopy, twin tail fins, a
  raised centre-spine highlight, twin glowing engines with a trailing exhaust cone, and red/green/
  white nav lights at the wingtips and tail. Toon-shaded with an ink hull outline, matching the
  rest of the cast. No asset files.
- **Calling it and boarding.** `KeyY` calls the Batwing when Batman is on a roof (elevated, not
  indoors) or gliding. It swoops in from high up and to the side, and Batman boards it over about
  0.85s: his own model and cape hide, `hero.control.name` becomes `'boarding'` then `'fly'`.
- **Camera.** New `'fly'` mode in `src/game/camera.js`: well back and above (dist 26, height 9) so
  the whole planform reads at roughly a quarter to a third of the screen width, a speed-based FOV
  kick, and a slight camera roll that follows the plane's bank (`follow.setBank()`, self-clearing
  the moment the mode isn't `'fly'`).
- **Flight feel.** W/S pitch (climb/dive; Invert Y respected), A/D bank and turn (coordinated turn:
  banking steers the heading), Shift boosts, Space hover-brakes, a little mouse-look steering on
  top of the keys, auto level-out on both axes when input lets go, a speed floor so it can't stall,
  a soft spring-back ceiling at 140 m and a soft push-back at the world edge. Hitting a building
  bounces it back along the wall normal, bleeds speed, and shakes the camera; no death.
- **Exit.** `KeyY` again ejects Batman into a glide at the plane's position and heading (his
  velocity is seeded from the plane's, so the glide starts at a sane speed); the plane then keeps
  flying off under its own autopilot for about 2.2s before disappearing. Landing within about 26 m
  of the GCPD roof (SITES.signal) while grounded auto-ejects the same way.
- **Armada set piece.** `startArmada({ balloons, onDone })` spawns N purple/green grinning Joker
  balloons (code-built: toon sphere, knot, two eyes, a torus-arc grin) drifting in a box ahead of
  wherever the plane currently is. Flying through one pops it; so does a bat-dart tracer fired with
  punch. A small ink-styled HUD counter ("Pop the balloons N / total") tracks progress and hides
  once done, and `armadaDone { ok: true }` fires (plus `onDone`) when every balloon is popped.
- **Tutorial hints suppressed while flying.** Added `'boarding'` and `'fly'` to `QUIET_CONTROLS`
  in `src/ui/prompts.js` so the glide tip and every other traversal card stay off screen (and hide
  immediately if one was already showing) for as long as the control is set.

## Controls

| Action | Key | Pad |
|---|---|---|
| Call / eject the Batwing | `Y` | D-pad Left (button 14) |
| Pitch (climb / dive) | `W` / `S` | left stick Y |
| Bank / turn | `A` / `D` | left stick X |
| Boost | `Shift` | held sprint |
| Hover-brake | `Space` | jump button |
| Fire a bat-dart (pops balloons) | `LMB` (punch) | punch button |

D-pad Left (14) was the only pad button with no existing plain-action mapping (12/13/15 already
double as photo/help/throw alongside the D-pad chain chords); it now does the same double duty for
`batwing`, which is why `tests/unit/input.test.js` line 13 was updated to expect `['batwing']`
there instead of `[]` - a one-line update to a test that pinned "current" pre-Batwing behaviour,
not a change to any real binding. No existing binding's key was touched.

## API as built (matches the spec's Contracts section)

```js
createBatwing({ scene, camera, hero, follow, collision, events, hudRoot }) -> {
  call(), exit(), active, update(dt, real), startArmada({ balloons, onDone })
}
// events: wingEnter, wingExit, armadaDone { ok }
// hero.control.name while flying: 'fly'
```

Wired into `src/game/game.js` in one small marked hook block ("Batwing (Part V2)"): created after
`hud`, updated once per frame right after `hero.update`, the `batwing` action toggles call/exit,
and it is exposed as `window.__game.batwing`.

New pure helper modules (all `wing*.js`, all in `src/vehicles/`):
- `wingFlight.js` - the flight step (`stepWing`, `clampToWorld`, `bounceWing`), no three.js, no
  per-frame allocation.
- `wingArmada.js` - balloon spawn/drift/pop-counting, also pure.
- `wingModel.js` - the three.js mesh builders (plane, balloon, dart tracer).

Materials are warmed the "meshes built before the first frame" way: the plane and dart pool are
created and added to the scene during `buildRun()`, before the game's own `uploadTextures` /
`drawEverything` warm-up pass runs, so they're already compiled by the time flight starts. Balloon
materials are plain `MeshToonMaterial` with the same feature set the cast already uses (color +
emissive, no maps), so they share an already-compiled program rather than needing their own.

## Tests

- `npx vitest run`: **889 passed, 0 failed** (866+ baseline plus this branch's new tests).
- New: `tests/unit/wingFlight.test.js` (pitch climbs/dives/auto-levels/clamps, bank turns/auto-
  levels, speed never drops below the stall floor even under hover-brake or a bounce, the soft
  ceiling pulls it back down instead of a wall, `clampToWorld` softly pushes back at the edge,
  `bounceWing` knocks it back along the normal, bleeds speed and arms a shake timer) and
  `tests/unit/wingArmada.test.js` (deterministic spawn/colour split, pop radius and no-double-count,
  `allPopped` only true once everything is gone, drift bounces off the region box). Updated
  `tests/unit/input.test.js` for the new pad mapping (see Controls above).

## Browser verification

Built with `npx vite build --outDir "$TEMP/wdist"`, previewed on port 5283 (`--strictPort`),
driven with `scripts/dev-play.mjs`, stopped by PID. `ONLY=main node scripts/fps-sweep.mjs
http://localhost:5283/ high` result: every steady-state scenario's p95 is well under the 6.9ms
budget (gcpd roof 5.9, docks yard 4.9, neon street 4.7, ace yard 5.7, clock plaza 4.7, glide 4.7,
spawn 3.1), 0 hitches >25ms after warm-up. (Two of the momentary post-teleport "arrive:" transition
samples ran a bit over, 6.9 and 7.8ms; those are a few frames of texture/prop pop-in right after a
hard teleport in scenarios the Batwing never touches, not a steady-state cost, and the sweep
reports zero real hitches.)

Screenshots saved to
`C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\v2\`:
- `v2-gcpd-01-called.png` - called from the GCPD roof (`?at=signal&god=1`): reads as a jet next to
  the helipad marking and the water tower, wingtip lights visible.
- `x-00-boarded.png`, `x-02-level.png` - level flight, full planform visible, roughly a third of
  the screen width, from above and behind.
- `x-01-bank.png` - mid-turn bank.
- `x-03-boost.png` - boosting.
- `x-04-armada.png`, `x-05-popping.png` - the armada HUD counter and dart tracers.
- `x-06-eject.png` - ejected into a glide.

I looked at all of these before committing. The `w-0*` and `v2-0*` files in the same folder are
earlier passes (including the pre-fix "flat black mass" version) kept for the coordinator's own
comparison; the `x-0*` and `v2-gcpd-*` ones are the current, correct model/camera.

## A known interaction (not a Batwing bug)

Default spawn facing on the GCPD roof (`Math.PI*1.2`) points almost exactly at the nearby
`SITES.signal` Batsignal objective, ~24m away. Any *unsteered* Batwing flight of more than about
half a second after boarding drifts close enough to trip that step's own radius-based auto-advance
(`src/game/flow.js`), which starts the 'card' cutscene and freezes physics - this is the pre-
existing story system reacting to `hero.pos` following the plane exactly as the contract asks it
to, not something wrong with the flight model (verified: with the plane deliberately steered away
within the first ~100ms, or on any other step, pitch/roll/speed/altitude all behave correctly - see
the diagnostic reads in this session). Story (Part S) will want to gate site-radius advances while
a vehicle/wing control is active, the same way it already skips them for `type: 'fight'`/`'boss'`/
`'cutscene'` steps.

## Gaps / not done

- No screenshot of a building-collision bounce specifically (unit-tested instead; didn't line up a
  clean in-city collision inside the time budget).
- Armada `armadaDone` full-clear wasn't captured on screen (only partial progress, 1-2 of N popped,
  shown live in the HUD counter); the completion path itself (`armadaAllPopped` -> emit
  `armadaDone` -> `onDone`) is unit-tested and is a direct, three-line call from `updateArmada()`.
- The pad's D-pad-Left mapping is verified only through the `padActions` unit tests, not on a
  physical or virtual gamepad in the browser.
- Dart tracer mesh orientation is a little rough up close; it still pops balloons correctly.
- No death/damage on a building hit, as specified; there is also no separate "success" cue beyond
  the HUD counter reaching total and hiding (no fanfare/sound), left for Story/audio to add if
  wanted.
