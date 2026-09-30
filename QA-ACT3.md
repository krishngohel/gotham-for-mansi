# QA pass: Act 3, the finale, and free roam

Played on the merged `night` integration branch (merged into `wing`, no conflicts), a frozen
build on port 5283, muted, driven with `scripts/dev-play.mjs` plus `?at=<stepId>&god=1&new=1`
loads and `window.__game.jump(id)` for in-session step jumps. No console errors anywhere across
the whole pass. Screenshots referenced below are in
`C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\v2\`
and `C:\Users\awsom\AppData\Local\Temp\v2out\` (`qa-*.png`); I looked at all of them.

## Act 3 and finale, step by step

- `actThreeTitle` - ok (title cutscene, skips cleanly).
- `armadaRun` - ok: objective text, target and radio lines all correct (`qa-01b`). Calling the
  Batwing worked once the hero was actually standing on something (see Problem 1).
- `nightwingTagRadio` - ok: radio lines display and wrap correctly (confirmed with a longer wait,
  `qa-26`; my first, shorter-wait screenshots caught the line mid-typewriter-reveal and looked cut
  off, which had me worried, but it was just animation timing, not a bug).
- `nightwingAlly` - ok: Nightwing actually spawns (`window.__game.nightwing.actor` is set) and
  the objective text is right.
- `plazaFight` - ok, structurally: `winFight()` clears the wave on screen, and a new wave spawns
  right after (3 enemies, then 6) rather than the step advancing on one call. Reads as an
  intentional multi-wave fight, not a bug, but I did not push it all the way to `fightDone` in the
  time available.
- `toFunhouse` - ok: objective text, a real ground-level target (`{x:-120,y:0.15,z:-150}`), and
  the waypoint all check out.
- `funhouseFight` (via `interiors.enter('funhouse')`) - ok visually: good comic-book striped
  pillars, coloured spotlights, no clipping (`qa-07`, `qa-19`).
- `rescueGuestsRadio` - ok: radio lines and objective text correct.
- `toTower` - ok: target and objective text correct, hero on solid ground at the checkpoint.
- `boss` - ok as far as I could confirm: health resets to 999 at the encounter, "THE JOKER" bar
  shows and tracks damage. I could not confirm the actual win trigger with a quick dev poke
  (setting `boss.joker.health = 1` and calling `applyHit({outcome:'ko'})` left health at 1 and
  the step still `boss`); this reads as me using the wrong shortcut, not necessarily a bug, but I
  did not verify the real defeat -> `finale` transition end to end.
- `finale` - ok, and good: `party.guests` has all seven ids, fireworks, the HAPPY BIRTHDAY MANSI
  signal and banners, the cake and every guest all show together (`qa-12`, `qa-13`).
- `credits` - ok: clean credits page, correct attribution (`qa-14`).

## Problems found

1. **Several Act 3 steps share checkpoint `balcony`, which is not solid ground.** Jumping
   directly to `armadaRun`, `nightwingTagRadio`, `nightwingAlly` or `toFunhouse` (all
   `checkpoint: 'balcony'`) teleports the hero to `SITES.balcony` (-62, 68, -176), which has
   nothing underneath it: the hero free-falls about 68 m to street level over a few seconds. Not
   something a normal player hits (they would glide in from the previous beat, not teleport cold),
   but it means the Batwing cannot be called right after a dev jump to these steps until the hero
   lands somewhere with `y > 5` again (I had to teleport to `signal` to confirm the call itself
   still works). Not my file (`src/world/mapData.js` / the story's checkpoint list) - reporting,
   not fixing.
2. **Summoning the Batmobile from the docks container yard (`SITES.yard`) does not produce a
   visible, enterable car.** The "Batmobile is on its way" toast and the SCREEECH sound word both
   fire, but no Batmobile model appears in view and `vehicles.active` never becomes truthy, even
   after pressing the vehicle key again (`qa-15c`, `qa-16c`). From a proper street tile
   (`neonStreet`) summon-then-enter works perfectly (`qa-vehicle-street-2`), so this looks like
   `nearestStreetSpawn` failing to find a nearby street tile from the container yard specifically,
   not a general regression. Not my file (`src/vehicles/vehicles.js`, and the tank battle area of
   that file was explicitly off limits) - reporting, not fixing.
3. **Minor, not fixed:** I did not get a clean confirmation of stealing a specific street traffic
   car (as opposed to the Batmobile) in the time available - no traffic car happened to be in
   pickup range during my pass, so the vehicle key fell back to summoning the Batmobile instead.
   The code path (`handleVehicleKey` picks the nearest enterable car, or summons the Batmobile if
   none is near) reads correctly; I just did not land a screenshot of it happening.

## Free roam (after credits)

Note: jumping to `credits` opens the real credits menu and calls `input.setEnabled(false)`, which
also freezes the frame loop (`flow.mode` stays `'credits'`) until it is dismissed. For scripted
testing I called `window.__game.flow.freeRoam()` and `window.__game.input.setEnabled(true)`
directly instead of clicking the menu's own continue button; a real player just clicks through, so
this is a note about my test method, not a bug.

- Batmobile: summon + enter + drive all confirmed from `neonStreet` (`qa-vehicle-street-1/2`); see
  Problem 2 for the one site where summon does not work.
- Batwing: call, board (`control` becomes `'boarding'` then `'fly'`), and fly all confirmed
  (`qa-17b`, `qa-18b`).
- Interiors: both `funhouse` and `aceHall` enter and exit cleanly, distinct and good-looking
  (`qa-19`, `qa-20`).
- Challenges: teleporting onto a pillar's own marker position (`side.challenges.pillars[0]`)
  starts it automatically (`Signal to Sea`, countdown UI, a glide ring visible) (`qa-21`).
- Street crime: positioned at a crime spot (`gcpdSteps`) without a crash; did not get an isolated
  screenshot of a crime actually starting since a challenge from the previous check was still
  active and took visual priority (`qa-22`). Not a confirmed problem, just unconfirmed coverage.

## Fun and clarity

Objective text throughout Act 3 and the finale is short, clear and always says where to go or
what to do. Radio banter (Gordon, Nightwing, Harley, Joker) reads with personality and no dashes.
The finale reads as a genuine payoff: banners, sky lettering, fireworks, the whole cast dancing.
For a casual trackpad player the controls prompts (WASD, click to aim, gadget wheel) show at
sensible moments and nothing I played felt confusing.

## Fixes made

None needed in my own files (`src/vehicles/batwing.js`, `src/ui/cinematic.js`, `src/game/party.js`,
`src/game/partyStory.js`, `src/game/partySlots.js`): the Batwing, the cinematic camera, and the
party all worked correctly throughout this pass. Nothing elsewhere was small and obvious enough to
fix safely without deeper context in the owning file, so both problems above are reported rather
than patched, per the brief.

## Commits

- Merge of `night` into `wing`: no conflicts (see `git log`).
- This file.
