# Part S report: Mansi's Birthday Night

Branch `story`, worktree `C:\Users\awsom\Documents\Projects\gotham-story`, based on main `b13c946`.

## What shipped

1. **Radio and cutscene dialogue panels** (`src/ui/radioQueue.js` pure queue, `src/ui/radio.js` DOM
   layer, `src/ui/radioPortraits.js` 8 code-drawn SVG portraits, CSS in `src/ui/style.css`). Comic
   speech panel, bottom left: an 84px portrait in a thick ink frame, a bold colour name tag, 20px
   hand-lettered text wrapping to the same 520px card width the HUD's own cards use, a comic tilt,
   a radio-crackle sound (new `radioCrackle` SFX in `src/audio/sfx.js`) on every new voice. Sits
   above the health ring and gadget panel, clear of the objective card, the bottom hint card, and
   the action camera's framed shot during a fight. Typewriter reveal; click or Space/Enter/E
   advances (finishes the line early, then moves on); Esc skips the whole beat. Auto-advances on
   its own timer either way, so the story never waits on player input to progress.
   Classes are `.dlg-panel` / `.dlg-portrait` / `.dlg-body` / `.dlg-name` / `.dlg-text`, not
   `.radio-*`: `src/ui/sideHud.js` already owns an unrelated crime-dispatch radio toast under
   `.radio` / `.radio-text` (top left, over the combo counter), and the first pass collided with it
   silently (same CSS rule, two different DOM trees) until caught in review.

2. **The new story**: 53 steps, Prologue through the Finale, in `src/game/story.js` (full list
   below). New mission types added to `src/game/flow.js` / `src/game/objectives.js`: `radio` (a
   dialogue beat), `chase` / `battle` (calls `window.__game.vehicles`), `armada` (calls
   `window.__game.batwing`), `crasher` / `ally` (calls `window.__game.nightwing`), `interior`
   (travel to a room site, tries `window.__game.interiors?.enter`). Every one of these is read off
   `window.__game` at call time, never captured at story-creation time, so it still works however
   late that part attaches itself. When the part or the one method a step needs isn't there, the
   step plays its `lines` (if any) through the radio panel and then completes on a 2.2s timer, so
   the whole story always reaches credits with any subset of Vehicles, Batwing, Nightwing or
   Interiors missing. A `radio` step is done as soon as its own lines finish (no timer needed: the
   dialogue was the whole mission). Coordinator contract updates from mid-build were folded in:
   `chase` and `battle` call `vehicles.summon()` then `vehicles.enter(vehicles.active)` before
   `startChase`/`startBattle`; `armada` calls `batwing.call()` first; and any step of type
   `cutscene`, `fight`, `boss`, `radio`, `crasher`, `ally`, `interior` or `collect` exits an active
   vehicle or Batwing before it begins (plain travel steps do not, since driving there is the
   point).

3. **Full reset.** `src/core/save.js`'s progress key is now `gotham-mansi-progress-v2` (was
   `-v1`). `src/game/storyMigrate.js` was simplified to place a save purely by its saved `stepId`
   against the current `STEPS`; there is no numeric-index fallback any more (the old one existed
   only to read pre-Part-D saves written under the v1 key against an older step list). The v1 key
   is never read again; nothing migrates from it, and it can stay in storage untouched. Settings
   (`gotham-mansi-settings-v1`) and bindings are untouched. The old returning-player "predator
   notice" feature (a one-time card for a v1 save that skipped a stealth room) was removed along
   with it, since it no longer has any save shape to trigger from.

4. **Presentation.** The intro comic now frames the Joker's broadcast explicitly as the Batsignal
   turning into a cake (reusing the existing signal SFX and the Joker TV panel art). Three new act
   title cards (`SCENES.actOne/actTwo/actThree` in `src/game/scenes.js`) reuse the existing
   `titleCard()` canvas helper as plain one-panel comic pages. The finale is unchanged: it still
   ends at the existing "HAPPY BIRTHDAY MANSI" Batsignal/fireworks sequence, then credits.

5. **Playthrough.** `scripts/playthrough.mjs` now calls `window.__game.radio.skip()` every poll (a
   real player reads dialogue at typewriter pace; the script just needs each beat to end) and the
   guard loop was raised from 240 to 600 iterations for the longer story. It reaches `credits` with
   no console errors (see Verification below).

## Full step list (53 steps)

**Prologue (GCPD roof).** `intro` (cutscene: Joker hijacks the Batsignal into a cake) → `signal`
(travel) → `card` (cutscene: the calling card) → `gordonRadio` (radio: Gordon briefs the theft) →
`crasherIntro` (crasher: the masked figure grabs the first gift and flees) → `actOneTitle`
(cutscene title card).

**Act 1: Docks and Neon Row.** `toDocks` (travel) → `alfredRadio` (radio: Alfred brings the
Batmobile) → `batmobileChase` (chase) → `f1` (fight: docksRoof) → `toYard` → `f2` (fight: yard) →
`toShip` → `f3` (fight: freighter) → `presents` (collect) → `rewardPresents` (cutscene) → `toNeon`
→ `n1` (fight: gazette) → `toStreet` → `n2` (fight: street) → `toMonarch` → `n3` (fight: monarch) →
`crasherRooftop` (crasher: first clash, escapes on a line) → `monarchBalcony` (stealth fight,
reused from Part D) → `party` (collect) → `rewardParty` (cutscene) → `aceClueRadio` (radio:
Gordon's clue points to Ace Chemicals).

**Act 2: Ace Chemicals.** `actTwoTitle` (cutscene title card) → `toAce` → `aceBattle` (battle:
cannon vs. drone tanks) → `a1` (fight: aceYard) → `toFactory` → `a2` (fight: factory) → `toVat` →
`harleyRadio` (radio: Harley taunts) → `harleyFight` (fight: `HARLEY_FIGHT`, see Gaps) → `a3`
(fight: vats, "protect the cake") → `aceCatwalks` (stealth fight, reused from Part D) → `cake`
(collect) → `rewardCake` (cutscene) → `crasherReveal` (radio: the Crasher unmasks as Nightwing).

**Act 3: The Clock Plaza.** `actThreeTitle` (cutscene title card) → `armadaRun` (armada: Batwing
through the balloon set piece) → `nightwingTagRadio` (radio: Gordon's GCPD backup) → `nightwingAlly`
(ally: Nightwing tags in) → `plazaFight` (fight: plaza, at the clock tower's roof) → `toFunhouse`
(interior: the funhouse door) → `funhouseFight` (fight: funhouseFight) → `rescueGuestsRadio` (radio:
the last guests found) → `toTower` → `boss` (the Joker) → `finale` (cutscene: HAPPY BIRTHDAY MANSI)
→ `credits`.

Existing ids the rest of the game keys off (`intro`, `toDocks`, `toYard`, `toNeon`, `toStreet`,
`toMonarch`, `toAce`, `toVat`, `toTower`) were kept in their original relative order on purpose, so
`src/gadgets/gadgetDefs.js`'s unlock steps and `src/game/progressTracker.js`'s `CHAPTERS` list
needed no changes and are still correct.

## Save-key change

`gotham-mansi-progress-v1` → `gotham-mansi-progress-v2`. Every player starts the new story fresh.
Verified with a rewritten `tests/e2e/stealth.spec.js` case that writes a v2-shaped save directly to
`localStorage` and confirms it resumes on the same step id.

## Guests and the finale party

The DJ (rescued with the `party` pickup at the Monarch), the baker (rescued with the `cake` pickup
at Ace Chemicals) and the band plus "the rest of the guest list" (named in `rescueGuestsRadio`
after the funhouse) are all called out by name in dialogue. The finale reuses the existing party
props, crowd and `Dance_Loop` unchanged; no new 3D guest models were built (see Gaps).

## Coordinator contract updates applied mid-build

- Nightwing (`spawn(p, mode)`, `despawn()`, `crasherFlee(to)`, events `teamTakedown` /
  `crasherEscaped`) and Batwing (`startArmada({ balloons, onDone })`) merged with exactly the
  contracted shape; no changes needed on this side.
- Harley Quinn: added `HARLEY_FIGHT` in `src/game/fights.js`, `FIGHTS.harleyHall ? 'harleyHall' :
  'aceYard'`, and a real `harleyFight` step using it. In this worktree it always resolves to the
  `aceYard` fallback (harleyHall/aceHall are not merged here); once Harley's branch merges its
  fight into this same `FIGHTS` object, this picks it up automatically.
- Vehicle/Batwing exit rule and the summon/enter/call sequencing for chase/battle/armada: done, see
  item 2 above.
- The `window.__game.cinematic.play(shots, { lines, onDone })` API (letterboxed in-engine camera
  shots) was flagged as arriving "in about an hour" and not yet present at any point during this
  build. **Not integrated** — see Gaps. The existing comic-panel presentation (broadcast, act
  titles, Nightwing reveal, finale) is what ships instead, and it was the explicit reuse the spec
  asked for ("reuse the batsignal and a comic page if possible").

## A real bug found and fixed during verification

The first `scripts/playthrough.mjs` run hung indefinitely at `plazaFight` with no console errors
and no output (it only logs at the very end). Probed live with `scripts/dev-play.mjs`:
`FIGHTS.plaza` originally used `site: 'balcony'`, a thin camera-only ledge at the clock tower
(`{x:-62,y:68,z:-176}`). `collision.groundBelow` at the wave's spawn offsets mostly missed that
ledge and dropped goons 58 units down to street level, so the hero's proximity/height check against
the site never passed, `encounters` never triggered, and `fightDone` never fired. Fixed by moving
`plaza` to `SITES.arena` (the boss's own flat rooftop, verified with `collision.groundBelow` at
every wave offset before committing) and tightening `funhouseFight`'s wave offsets after the same
kind of probe on the placeholder `funhouse` site. Re-run confirmed the fix (see Verification).

## Verification

- `npx vitest run`: **868/868 passing**, 79 files, 0 failures. New: `tests/unit/radioQueue.test.js`
  (9 tests, the pure dialogue-queue logic). Rewritten: `tests/unit/story.test.js`,
  `tests/unit/storyMigrate.test.js` (dropped the v1 numeric-migration tests, added stepId-only
  resolution tests, the new-mission-type `matches()` tests, and a no-dash check built from
  `String.fromCharCode(0x2013, 0x2014)` exactly as specified). Updated:
  `tests/unit/gadgetSystem.test.js` (removed the obsolete predator-notice tests, kept
  `newsPending`), `tests/unit/progressTracker.test.js` (a halfway-percent test that assumed an even
  step count), `tests/e2e/stealth.spec.js` (the v1-migration case rewritten for the v2 key).
- Frozen build: `npx vite build --outDir <dir>` (181 modules) → `npx vite preview --port 5289
  --strictPort`.
- `BASE_URL=http://localhost:5289 npx playwright test`: **15/15 passing**, muted browser args
  already in `playwright.config.js`.
- `scripts/playthrough.mjs` against the frozen build: **reaches `credits`, no console errors**, 13
  comic pages captured, gadgets unlocked in the expected order.
  `ended at {"id":"credits","type":"credits","mode":"play","site":null,"phase":4,"joker":"knocked"}`

## Screenshots

Saved to `C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\s\`
(viewed, not just captured):
- `01-opening-broadcast.png` — the Joker's broadcast (Batsignal → cake, TV panel).
- `02-act-title.png` — "ACT ONE: THE PARTY IS STOLEN" title card.
- `03-radio-gordon.png` — the resized radio panel showing a Gordon line.
- `04-radio-joker.png` — the resized radio panel showing a Joker line (green portrait, red name
  tag).
- `05-finale.png` — "HAPPY BIRTHDAY MANSI" over the fireworks and party roof.

## Gaps and known limitations

- **`window.__game.cinematic` not integrated.** It wasn't available at any point during this build
  window. The four moments it was suggested for (Prologue broadcast, act openers, Nightwing
  reveal, finale) all ship instead on the existing comic-panel system, which already reuses the
  batsignal/comic-page art as the spec asked. Wiring `cinematic.play(shots, { lines, onDone })` in
  behind `if (window.__game.cinematic)` for those four moments is the natural next step once it
  lands, but was not attempted here given the hard deadline.
- **`aceHall` (the Interiors part's second room) is unused.** The Ace Chemicals catwalks stealth
  room (reused from Part D) already carries that beat's "indoors" feel, and there wasn't time to
  design a second interior visit there as well. `funhouse` is used, with a placeholder SITE
  (`{x:-78,y:58,z:-168}`, on the same rooftop plane as `arena`) until Part I lands the real room and
  geometry at that id.
- **`plazaFight` and the boss both now use `SITES.arena`.** Reusing the boss's own verified-flat
  rooftop for the pre-funhouse ambush was the fastest safe fix for the hang above; the player
  revisits the same rooftop for the boss a few steps later (via `funhouse`, then back). Not
  incorrect, just a minor narrative repetition worth a real "plaza" site once one is designed with
  proper ground clearance.
- **No new guest character models.** The DJ, baker, band and other guests are represented through
  dialogue and the existing pickups/party props, not new 3D NPCs (the constraints ruled out new AI
  assets, and there wasn't build time for hand-built ones).
- **Harley Quinn has no unique enemy or fight in this worktree.** `harleyFight` runs the `aceYard`
  fight (grunts + a brute) under Harley's name and taunts; it will pick up the real `harleyHall`
  fight automatically once that branch's `FIGHTS` additions are merged in, per the coordinator's
  own fallback instruction.
- **~2 hours of scripted content is estimated, not timed by a real playthrough**: the story reuses
  the original game's fight/travel/stealth pacing (already tuned for its own ~1-1.5 hour original
  run) plus 11 new dialogue beats, 3 new mission-type beats, and 2 new fights, which is the spec's
  intent but wasn't clocked end to end by a human player before the deadline.
