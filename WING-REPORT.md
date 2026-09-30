# Part V2: The Batwing, the cinematic camera, and the finale party - Report

Branch `wing`, on top of `main` (b13c946). Commits:
- `9d84eb7` Batwing (Part V2): call it, fly it, pop the Joker balloon armada
- `41ab0e2` Batwing: fix the silhouette read per review (coordinator feedback pass)
- `5a31bc7` Add the Part V2 (Batwing) report
- `14f5c06` In-engine cinematic camera: sliding letterbox, HUD fade, radio/subtitle lines
- `74aced8` Fix radio.say call: takes a list of lines, not (text, line)
- `10ce22d` Finale rooftop party: guests join in, celebrate() brings it to life
- `502a154` Party fix: one cake, a clear helipad, guests arced around a dance floor
- (merge) Merge night into wing (no conflicts): story, radio, vehicles, Nightwing, interiors
- `3036558` Party: use the real Nightwing's actor/despawn contract correctly
- `8c4c165` Wire the party to story progress

## Part 4: wiring the party to story progress

`src/game/partyStory.js` (pure, no three.js/DOM) maps the story step whose start confirms a
guest's rescue to that guest:

| Step id | Guest(s) | Why |
|---|---|---|
| `aceClueRadio` | `dj` | right after `party` (Act 1) recovers the DJ's rig |
| `rewardCake` | `baker` | right after `cake` (Act 2) is saved |
| `crasherReveal` | `nightwing` | the mask comes off |
| `rescueGuestsRadio` | `band`, `kids` | Act 3: "found the band... the rest of the guest list" |
| `finale` | `gordon`, `alfred` | plus `party.celebrate()`, the moment the finale cutscene starts |

`guestsUpTo(stepIndex, STEPS)` and `celebrateAt(stepIndex, STEPS)` are both pure and reused for
two cases: live, off `flow.js`'s own `'step'` event (`enterStep()` emits it for every step,
including the finale cutscene itself, `s.type === 'cutscene' && s.scene === 'finale'`), and once
at hook creation against `progress.step`, so a resumed (or already-finished) save catches up
immediately instead of waiting for a `'step'` event that, past credits, never fires again. All of
this lives in the party hook in `game.js`; `story.js` and `flow.js` were not touched.

While merging in the real `window.__game.nightwing` (from `night`, no conflicts), fixed two bugs
in the party's Nightwing guest builder: `spawn(p, mode)` returns the controller, not the
character (`.actor` is the getter for that), and `reset()` now calls nightwing's own `despawn()`
for that guest instead of pulling his root out of the scene directly, since he is externally owned.
Note: his own combat AI (`updateAlly`, run every frame) keeps steering his animation, so
`celebrate()`'s `Dance_Loop` may not visibly stick on the real actor, only the look-alike fallback
used when Nightwing is not spawned as an ally elsewhere.

### Verification

`npx vitest run`: 988 passed. New: `tests/unit/partyStory.test.js` (every `STEP_GUESTS` entry is a
real guest id, every guest id is covered by exactly one step, `guestsUpTo` accumulates correctly
as the story advances and has everyone by the finale, `celebrateAt` flips at the right index).
Browser: `?at=aceClueRadio&god=1&new=1` gave `party.guests === ['dj']` exactly, screenshotted (the
GCPD roof shows only the DJ booth, no other guest or decoration, alongside Gordon's own "The DJ
says thank you" radio line on screen). `?at=finale&god=1&new=1` gave `party.guests` with all seven
ids and `flow.mode === 'finale'`; screenshotted mid-cutscene with fireworks, the HAPPY BIRTHDAY
MANSI signal and banners, the cake and every guest all present at once.

## Part 3: the finale rooftop party

`createParty({ scene, assets, events, gfx, finale })` in `src/game/party.js`, exposed as
`window.__game.party`:

```js
party.addGuest(id)  // 'dj' | 'baker' | 'band' | 'gordon' | 'alfred' | 'nightwing' | 'kids'
party.celebrate()
party.guests          // getter: ids added so far
party.reset()
```

Each guest is a civilian body (`createGoon(assets, { type: 'civilian' })`) with code-painted
primitive props on top (hats, a coat, an apron and toque, glasses, a tray, instruments) rather
than a new outfit; positions are pure data in `src/game/partySlots.js`, unit tested for no
overlaps, clearance from `finale.js`'s own furniture, and a 5 m keepout around `SITES.start`,
`SITES.signal` (the Batsignal). `celebrate()` sets every guest dancing (`Dance_Loop`), reuses the
party popper's own confetti burst and sky lettering (`gfx.confetti`, `src/gadgets/gadgetFx.js`)
for HAPPY BIRTHDAY MANSI, and calls `finale.freeRoam()` for fireworks rather than building a
second firework system.

Reused instead of duplicated: `createPartyKit()` (speakers, crates, disco ball) for the DJ booth,
and `finale.js`'s own cake prop for the baker, who now just stands beside it (see the coordinator
feedback below) instead of bringing a second cake.

**Coordinator review fix (`502a154`):** the first pass placed a second cake next to `finale.js`'s
own, and put the DJ 4.47 m from `SITES.signal`, inside the 5 m Batman needs to land clear.
Dropped the party's cake (the baker stands beside the existing one instead) and re-laid every
guest slot in a loose arc around a dance floor between the DJ booth and the cake, all clearing a
new 5 m keepout around `SITES.start`/`SITES.signal` in addition to the existing furniture check.

String lights (small bulbs, merged into one geometry via `mergeGeometries`, matching
`src/world/buckets.js`'s own approach) and two canvas-drawn "HAPPY BIRTHDAY MANSI" banners
(`MANSI.finaleSignal`) are built once per run.

### Verification

`npx vitest run`: 916 passed. New: `tests/unit/partySlots.test.js` (every guest id has a slot,
band/kids cluster correctly, no two guest spots overlap, every spot clears `finale.js`'s furniture
and the 5 m keepout). Browser: built + previewed on port 5283, all seven guests added, `celebrate()`
called, screenshotted with the cinematic camera (an easy way to hold a still frame) from the roof's
edge looking in: the helipad and the Batsignal are clear, the cake and presents each appear once,
and guests dance in a loose ring around the DJ booth and the cake, confetti falling, sky lettering
and banners reading HAPPY BIRTHDAY MANSI. `ONLY=main` fps sweep: every steady scenario's p95 was
comfortably under the 6.9 ms budget on a clean run (an earlier run showed some scenarios over
budget, which cleared on retry and lines up with heavy concurrent load from the night's other
worktrees, not a regression from this branch: party.js's `update()` is nearly free when no guest
has been added, and none of the sweep's own scenarios add one).

## Part 2: the in-engine cinematic camera (added after the Batwing shipped)

`createCinematic({ camera, hero, hudRoot })` in `src/ui/cinematic.js`, exposed as
`window.__game.cinematic`:

```js
cinematic.play(shots, { lines = [], onDone } = {})
// shots: [{ from:{x,y,z}, to:{x,y,z}, look:{x,y,z}, lookTo?:{x,y,z}, dur, fov? }, ...]
cinematic.orbit(center, radius, height, dur, opts = {})
// opts doubles as orbitShots' own options (segments, startAngle, sweep, fov) and play()'s
// (lines, onDone)
cinematic.skip()
cinematic.active   // getter
```

The camera eases through the shot list in world space (smoothstep, the same ease the Batwing's
boarding swoop and the hero's zip use), sliding in black top/bottom letterbox bars (11% each,
with an inked edge stroke where they meet the footage) and fading the HUD out. The hero freezes
for the duration (`hero.frozen = true`; game time and everything else, weather included, keep
running exactly as normal - confirmed a lightning flash rendered correctly mid-shot during the
browser check). Esc or Space skips straight to the ease back to the follow camera. A line shows
through `window.__game.radio?.say?.(...)` if that system is present (it isn't in this worktree;
verified the fallback path instead), otherwise as a subtitle in the bottom letterbox. Once the
shots (or a skip) finish, the camera eases back to wherever the live follow camera currently is
(read fresh each frame during that ease, so the handoff never snaps even if the player nudges the
mouse mid-cinematic) over 0.7s, then `onDone()` fires.

Wired into `src/game/game.js` in one small marked hook ("Cinematic camera"): created next to the
Batwing, updated once per frame right after `follow.update(...)` (it overrides whatever camera
pose follow.update just set, per the spec's own suggested approach, so no changes to
`src/game/camera.js` were needed). One extra line was needed outside that hook: the existing
pause-key handler already skips itself while `game.comic.playing`; it now also skips while
`game.cinematic.active`, so Esc skips the cinematic instead of also opening the pause menu.

Pure sampler in `src/ui/cinematicShots.js` (`ease`, `sampleShot`, `sampleShot`/`sampleSequence`
fill a reused `out` object instead of allocating, `totalDuration`, `orbitShots`), unit tested in
`tests/unit/cinematicShots.test.js`: easing shape, a shot's start/end/clamp-past-end, `lookTo`
lerp vs. a fixed look point, `fov` default/override, sequence indexing and the done/clamped-pose
state, and `orbitShots`' geometry (radius/height held, shots chain `to` into the next `from`).

**Note on the pad/vehicle-exit feedback:** left `src/core/input.js`'s existing `batwing: [14]` pad
entry alone here, since that's this branch's own D-pad-Left mapping; the coordinator said the
integration branch already resolved the conflict with the Batmobile's `vehicle` action by giving
D-pad Left to `vehicle` there, which is an integration-side decision outside this worktree.

### Browser verification (cinematic)

Built with `npx vite build --outDir "$TEMP/wdist"`, previewed on port 5283 (`--strictPort`, muted),
driven with `scripts/dev-play.mjs`, stopped by PID. Played `cinematic.orbit({x:0,y:44,z:0}, 30, 14,
6, { segments: 3, lines: [...] })` from the GCPD roof (`?at=signal&god=1`): three shots orbiting
the Batsignal. Screenshots (same scratchpad folder as the Batwing shots):
- `cine-01-slide-in.png` - letterbox slid in, HUD gone, first subtitle line ("Gordon: Mansi, do
  you copy.") showing, the roof and signal beam framed from above.
- `cine-02-mid-shot-subtitle.png` - second shot, second line ("Something is stuck to the signal.").
- `cine-03-second-shot.png` - happened to land on the game's own periodic lightning flash (the
  ink shader's `uFlash`, unrelated to this system) mid-shot; confirms the cinematic renders
  correctly through the world's own effects, though it's not a representative "normal" frame.
- `cine-04-return-easing.png`, `cine-05-back-to-follow.png` - after the sequence: letterbox gone,
  HUD back, hero unfrozen, camera settled back into the ordinary third-person follow view.

I looked at all of these before committing. `eval` checks alongside the shots confirmed
`cinematic.active`, `hero.frozen`, and the HUD's `opacity` toggling correctly at each stage, and
returning to `false`/`false`/`''` cleanly at the end.

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
