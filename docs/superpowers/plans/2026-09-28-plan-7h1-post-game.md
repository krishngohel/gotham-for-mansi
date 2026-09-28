# Plan 7H-1: After the Party, part 1 (foundation, Joker Crates, Missing Guests, New Game Plus)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once the credits have rolled, free roam becomes "After the Party": an objective list, map pins and on-screen markers appear, 20 Joker Crates with small puzzles unlock Harley's Party Hat for the cowl, 6 Missing Guests (fights, a stealth room, a timed rescue) join a growing dance party on the GCPD roof, and New Game Plus replays the story in the gold suit with harder goons, keeping every gadget and upgrade. Everything is tracked in the Progress tracker. (Part H items 1, 2 and 7. Plan 7H-2 adds items 3 to 6 on top of this.)

**Architecture:**
- **Pure rules first, thin runtime.** Every number, spot and rule is in a pure, unit-tested module under `src/postgame/` with no three.js and no DOM: crate spots and puzzle rules (`crateSpots.js`), the guests (`guests.js`), goon hardness (`src/combat/hardness.js`), New Game Plus (`ngPlus.js`), the saved fields (`postSave.js`), and the objective-list model (`afterPartyModel.js`). Runtime modules only move meshes, read input and call those functions.
- **Registries, not edits.** Post-game content plugs into what Plans 3C and 5FG built: saved fields through `registerProgressField`, Progress categories through `tracker.register`, XP through 5FG's reserved `crateOpened` and `missionDone` events, crate sheds and ducts as new rows in 5FG's `BREAKABLES`, fights through `encounters.begin(id, def)`, captions through 3C's side HUD. The objective list is itself a registry (`registerActivity`), so Plan 7H-2 adds its four activities without touching this plan's files.
- **One glue object.** `src/postgame/afterParty.js` owns the post-game systems (crates, guests, and 7H-2's later), the objective line, the objective list, the world markers and the flow hooks. It is on exactly when `progress.finished` is true. Systems are small objects with optional `update`, `busy`, `marker`, `onRespawn`, `music`, `livePos`.
- **Shared encounter system, politely.** A guest's squad is set up only when Batman is within 80 m and nothing else holds the encounter system, and is taken down past 120 m if the fight never started. While a post-game mission or race runs, `busy()` blocks street crimes and challenge pillars (a one-line hook in `sideContent.js`).
- **Harder goons are one rules object.** `combat.setHardness(rules)` scales damage, wind-ups, attack gaps and simultaneous wind-ups; encounters' new `shape` hook adds goons to waves; the spawn wrapper scales goon health. New Game Plus sets the rules; Plan 7H-2's survival arena reuses them.
- **Everything visual is built once and pre-warmed.** Crates, hats, ropes, the party kit and the six guests are created in `buildRun` before `begin()` calls `drawEverything`; one copy of every new material goes into the boot warm cast.

**Tech Stack:** Three.js 0.186, plain ES modules, Vite 8, Vitest (node environment), Playwright (`tests/e2e`), playwright-core scripted play (`scripts/dev-play.mjs`, `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`, `scripts/webkit-check.mjs`, `scripts/load-time.mjs`).

**Base:** Branch `postgame`, cut from `main` **after** Plan 4E (`chains`), Plan 3C (`content`), Plan 5FG (`gadgets`) and Plan 6D (stealth) are all merged. Every file and name referenced below is as it stands after those merges. Where this plan says "after 3C" or "5FG's" it names the exact function those plans add. Plan 7H-2 (`2026-09-28-plan-7h2-post-game.md`: Cake Bombs, Balloon Army, Joker's Encore, Endless Party Crashers) is cut from `main` after this plan ships.

**Revisions from the 5FG and 6D final reviews (2026-09-28).** These bind Tasks 2, 4, 9 and 12:
- 6D now counts `silentTakedown` and `perchDrop` in "Moves learned" only while a predator room is still reachable, or once they are learned (6D's reachability check in `progressTracker.js`). Marvelous Marco's stealth rescue makes the catwalk room reachable again after the credits. Extend that reachability check so an unrescued `magician` counts as reachable. Add a tracker test: a finished save without the two moves reads 8 of 8 before After the Party is active, and 8 of 10 once it is.
- When Marco's rescue room begins, show the tutorial list from 6D's `tutorialFor('aceCatwalks', progress)`. It puts crouch, silent, perch and perchDrop first for any basic not yet learned. Finished and migrated saves never played Monarch Balcony, so this rescue is where they learn silent takedowns and perch drops. Add a test that a save without the moves gets the basics first.
- Returning players are told about new things once, with a comic card on the first live frame and a seen-flag saved only after the card shows. 5FG's "WAYNETECH DELIVERY!" and 6D's "MEANWHILE IN GOTHAM" work this way. The After the Party intro comic already covers activation; keep any other post-game announcement to this same pattern.
- With the pointer unlocked, the first canvas click only re-locks it (main's Safari fix). Scripted runs that enter via `?at=` spend one click first.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`, Part H ("After the party: post-game world"), items 1 (Joker Crates), 2 (Missing Guests) and 7 (New Game Plus), plus the post-game objective list, map markers and Progress tracker categories. Keep it a birthday gift: warm, funny, Joker-party tone, with `MANSI.name` (from `src/mansi.config.js`) where it fits.
- **No em dashes** (U+2014) or en dashes (U+2013) in any player-visible text: captions, cards, toasts, hints, radio lines, notes, crate prizes, guest pleas, menu labels, prompts, comic pages. Use commas, colons or full stops. Task 18 greps for them.
- **Commits** are authored by Krishn Gohel only (check `git config user.name` prints `Krishn Gohel` before the first commit). Never add `Co-Authored-By` or any other trailer.
- **Never push.** Pushing `main` redeploys the live site. The coordinator reviews and pushes after Task 18.
- **Art is authored in code.** Crate faces, hat stripes, speaker grilles and marker icons are drawn on canvases or written as SVG paths in this plan's code. No image files, no downloaded art, no AI image or model generators. All player-facing copy is written out in this plan; implementers transcribe it and don't invent new lines.
- **Performance.** Keep 144 fps or better on the owner's laptop. In the fps sweep (`scripts/fps-sweep.mjs`, High, `dynres=0`) every row's p95 is at or under 6.9 ms and no frame is over 25 ms after the first 5 s. Every new material and geometry has a copy in the warm cast (`src/game/warmCast.js`); every run object is created in `buildRun` before `begin()` calls `drawEverything`. No per-frame allocation in hot paths: runtime loops use `for` loops over preallocated arrays (never `filter`, `map` or closures per frame), scratch `THREE.Vector3`s, and touch the DOM only when a displayed value changes. Guests animate only within 90 m; markers update at 30 Hz.
- **Load time.** The first frame stays near 3 s. This plan adds no asset files. Canvases are drawn in `buildRun`, except the few small ones the warm cast needs at boot (shared through a material cache, so the run reuses them).
- **Pure modules** import nothing from three.js, the DOM or `src/ui/`. They may import other pure modules (`save.js`, `story.js`, `mapData.js`, `climbables.js`, `balloonSpots.js`, `mansi.config.js`, `progressTracker.js`, `challenges.js`, `gadgetDefs.js`, `breakableSpots.js`, `rules.js`).
- **Keys.** This plan adds no bindings. The race start is walking into a crate; everything else uses existing actions.
- **Browser checks run against a frozen production build only** (the dev server reloads on every edit):
  ```bash
  npx vite build --outDir "$TEMP/g7adist"
  npx vite preview --outDir "$TEMP/g7adist" --port 5212 --strictPort
  ```
  Rebuild after each code change you want to check. URL flags: `?at=<stepId>`, `?god=1`, `?new=1`, `?fight=test`, `?dynres=0`, `?gadgets=all` (5FG), and the new `?post=1` (marks the credits as rolled for this run, with the After the Party intro already seen; use `?at=credits&post=1&new=1` for a clean post-game save).
- **WebKit.** `scripts/webkit-check.mjs` runs against the frozen build for this release (Task 18).
- `window.__game` already exposes `hero`, `follow`, `combat`, `enemies`, `camera`, `world`, `ink`, `events`, `progress`, `state`, `time`, `climbables`, `teleport(site|{x,y,z})`, `jump(stepId)`, `spawn(type, p)`, `winFight()`, `comic`, `side`, `photo`, `gadgets`, `wayne`, `breakables`, `gfx`, `begin(suit, fresh)`. This plan adds `post` (with `post.crates`, `post.guests`, `post.ng`, `post.data`) and `ng`.

## File Structure

| File | Responsibility |
|---|---|
| `src/postgame/crateSpots.js` (new) | Pure: the 20 crates, puzzle kinds, race limits, open rules, zip crate spots, notes and prizes |
| `src/world/breakableSpots.js` (modify) | Seven new rows: four cracked-wall sheds and three vent ducts that hide crates |
| `src/postgame/guests.js` (new) | Pure: the 6 guests, squads, the stealth room, the timed rescue timer, party slots, rescue copy |
| `src/mansi.config.js` (modify) | `partyGuests`: the six guest names, editable |
| `src/combat/hardness.js` (new) | Pure: `NORMAL_RULES`, `scaleDifficulty`, `scaledHealth`, `hardenFight` |
| `src/postgame/ngPlus.js` (new) | Pure: New Game Plus cycles, `ngRules`, `ngActive`, `startNewGame`, `ngLabel` |
| `src/postgame/postSave.js` (new) | Pure: registers `progress.postgame`, `progress.crates`, `progress.guests` |
| `src/postgame/afterPartyModel.js` (new) | Pure: activity registry, rows, targets, nearest target, objective line, map pins |
| `src/postgame/partyRegistry.js` (new) | Pure: registers 7H-1's saved fields, tracker categories and activities; story row stays full in NG+ |
| `src/combat/combatSystem.js` (modify) | `setHardness(rules)`, `hardness` |
| `src/game/encounters.js` (modify) | `shape(def, id)` hook |
| `src/game/flowHooks.js` (new) | Pure: `mergeFlowHooks(...providers)` |
| `src/game/flow.js` (modify) | `playPages(pages)`: a comic over free roam, like a cutscene |
| `src/game/sideContent.js` (modify) | `busy()` blocks challenge pillars and street crimes; `extras()` pins on the Progress map |
| `src/postgame/postProps.js` (new) | Code-drawn crate, party hats, rope, rooftop party kit, `createPostWarm()` |
| `src/game/warmCast.js` (modify) | Post-game props in the warm-up |
| `src/ui/postHud.js` (new) | World markers with kind icons, the objective list panel |
| `src/postgame/postPages.js` (new) | The "After the Party" comic page |
| `src/postgame/afterParty.js` (new) | Glue: activation, intro, objective line, list, markers, flow hooks, page data |
| `src/postgame/crates.js` (new) | Crates at run time, races, the party hat on the cowl |
| `scripts/postgame-check.mjs` (new) | Validates every crate, race start, guest and party slot against the live city |
| `src/postgame/roofParty.js` (new) | The GCPD rooftop party kit and lights |
| `src/postgame/guestMissions.js` (new) | Guests at run time: placement, fights, stealth room, timed rescue, dancing |
| `src/postgame/ngPlusRun.js` (new) | New Game Plus at run time: hardness, wave shaping, captions, clearing |
| `src/game/mapModel.js`, `src/ui/progressMap.js` (modify) | Post-game pins on the map |
| `src/ui/menus.js` (modify) | Title `New Game Plus` button; pause `After the Party` button and page |
| `src/ui/prompts.js`, `src/game/sound.js` (modify) | Prompts, sounds, the party waltz |
| `src/game/game.js` (modify) | Wiring, `?post=1`, spawn health, title and begin |
| `src/ui/style.css` (modify) | Styles for the markers, list and page |
| `scripts/fps-sweep.mjs` (modify) | `post` page |
| `scripts/playthrough.mjs`, `scripts/webkit-check.mjs` (modify) | Post-game report and WebKit shots |
| `scripts/runs/post-crates.json`, `post-guests.json`, `post-ngplus.json` (new) | Replayable scripted runs |
| `tests/unit/crateSpots.test.js`, `guests.test.js`, `ngPlus.test.js`, `postSave.test.js`, `afterParty.test.js`, `flowHooks.test.js`, `postHud.test.js`, `ngPlusRun.test.js` (new) | Unit tests |
| `tests/unit/breakableSpots.test.js`, `encounters.test.js`, `mapModel.test.js`, `prompts.test.js` (modify) | Unit tests |
| `tests/e2e/postgame.spec.js` (new) | Browser tests |

## Shared interfaces (every task relies on these exact names)

```js
// src/postgame/crateSpots.js (pure)
MOVE_WINDOW = 4, RACE_SPEED = { flat: 9, climb: 4 }, TOUCH = { crate: 1.7, vent: 2, zipline: 2.4 }, HAT_UNLOCK = 'partyHat'
CRATES, CRATE_IDS, crateById(id), NOTE { [kind]: string }, CRATE_PRIZES (20 strings)
// Crate: { id, kind: 'gel'|'vent'|'ladder'|'wallrun'|'zipline'|'race', x, y, z, where, lock?, needs?, zip?: { a:{x,z}, b:{x,z} },
//          race?: { from: {x,y,z}, limit } }
raceLimit(from, to) -> seconds
crateOpenable(crate, { broken, lastMove, now, riding, racing }) -> { ok, reason: null|'locked'|'move'|'race'|'unknown' }
createRace(crate) -> { id, limit, time, left, over, update(dt) -> 'timeout'|null, finish() -> time }
findZipLine(lines, zip) -> line|null, zipCrateSpot(line, k = 0.5, drop = 1.1) -> {x,y,z}, touchRadius(crate)

// src/postgame/guests.js (pure)
PARTY_CENTER = { x: -8, y: 42, z: 10 }, RESCUE_LIMIT = 50, GUESTS, GUEST_IDS, guestById(id), guestName(i, names?)
// Guest: { id, name, role, kind: 'fight'|'stealth'|'timed', where, site, captive, radius, waves?, room? (6D room id), limit?, plea, slot: {x,y,z,yaw} }
partySlot(i, n = 6, r = 3.2), guestFightId(id) -> 'guest:<id>', isGuestFight(id), guestFight(guest) -> encounter definition (6D's stealthFight for the stealth room)
rescueCard(guest, count, total = 6) -> { title, text }, timedFailText(guest), partyStatus(count, total = 6)
createRescueTimer(limit = 50) -> { left, done, update(dt) -> 'expired'|null, stop() }

// src/combat/hardness.js (pure)
NORMAL_RULES = { health: 1, damage: 1, windup: 1, gap: 1, maxWindups: 0, extraPerWave: 0 }
scaleDifficulty(base, rules) -> DIFFICULTY-shaped row, scaledHealth(health, rules), hardenFight(def, rules) -> def

// src/postgame/ngPlus.js (pure)
NG_MAX = 3, ngRules(cycle) -> rules, ngActive(progress) -> boolean, startNewGame(old, { plus }) -> progress, ngLabel(cleared) -> string

// src/postgame/postSave.js (pure; registers at load)
// progress.postgame: { cleared, introSeen, hatOn, ngCycle, ngCleared }   progress.crates: id[]   progress.guests: id[]
sanitizePostgame(raw), idsFrom(raw, allowed)

// src/postgame/afterPartyModel.js (pure)
MARKER_KINDS = ['crate', 'race', 'guest', 'bomb', 'army', 'encore', 'crashers']
// Activity: { id, label, order, count(p) -> {done,total}, status?(p) -> string, targets?(p) -> Target[] }
// Target: { id, kind, label, x, y, z, near }
registerActivity(a) -> undo, activityList(), afterPartyRows(p) -> [{ id, label, done, total, complete, status }]
allTargets(p, out = []) -> out, targetPos(t, live), nearestTarget(targets, pos, live) -> { target, dist }|null
objectiveLine(p, pos, targets, live) -> string, mapExtras(p) -> [{ id, kind, x, z }]

// src/postgame/partyRegistry.js (pure; import before loadProgress): POST_WEIGHTS = { crates: 8, guests: 6, ngPlus: 4 }
// tracker categories 'crates', 'guests', 'ngPlus' (active once postgame.cleared); the 'story' category re-registered

// src/combat/combatSystem.js: combat.setHardness(rules), combat.hardness
// src/game/encounters.js: createEncounters({ ..., shape = null })   shape(def, id) -> def, applied in begin()
// src/game/flowHooks.js: mergeFlowHooks(...providers) -> { holdStory(), marker(), onRespawn() }
// src/game/flow.js: flow.playPages(pages) -> Promise   (a comic over free roam; mode 'cutscene' meanwhile)
// src/game/sideContent.js: createSideContent({ ..., busy = () => false, extras = () => [] })

// src/postgame/postProps.js
HARLEY, GUEST_HATS (6 color sets), HAT_LIFT, createJokerCrate(face = 'plain'|'clock', { hang = 0 }) -> Group
createPartyHat(colors) -> Group, attachHat(ch, hat) -> hat, createRopeRing() -> Mesh,
createRoofPartyKit() -> { group, lights: [x,y,z][] (relative to PARTY_CENTER) }, createPostWarm() -> Group

// src/ui/postHud.js
KIND_ICON { [kind]: svgInner }, listCode(rows) -> string
createPostHud(root) -> { marker(id, x, y, visible, kind), hideMarkers(), list(rows), showList(on) }

// src/postgame/postPages.js: introPages(stage), POST_RADIO = { title, text }
// src/postgame/afterParty.js
createAfterParty({ hero, events, flow, hud, progress, storage, camera, comic, stage, side, combat, encounters, hudRoot })
  -> { active, ui, add(system), update(dt, real), start(), busy(), music(), flowHooks, livePos(id), page(), refresh(),
       pages: [{ id, title, make(stage) }], addPage(entry), debug }
// system: { update?(dt, real, on), busy?(), marker?(), onRespawn?(), music?(), livePos?(id) }

// src/postgame/crates.js
createCrates({ scene, hero, events, progress, save, ui, hud, climbables, gfx, canRace })
  -> { items, update, busy, marker, onRespawn, livePos, setHat(on), hatUnlocked, open(id), debug }
// src/postgame/roofParty.js: createRoofParty({ scene, halos }) -> { set(count), group }
// src/postgame/guestMissions.js
createGuestMissions({ scene, assets, hero, events, encounters, progress, save, ui, hud, readyObjects, party, canPlace, canHold })
  -> { guests, update, busy, onRespawn, music, forceRescue(id), placeNow(id), setTimer(sec), debug }
// src/postgame/ngPlusRun.js: createNgPlus({ events, progress, save, combat, hud }) -> { active, rules(), shape(def), announce(), cleared() }

// src/ui/menus.js: title({ ..., onNewPlus, plusLabel }), pause opts.onAfterParty, afterPartyPage(data, { onBack, onHat, onRead })
// src/game/mapModel.js: mapModel({ ..., extras = [] }) -> { ..., extras: [{ id, kind, u, v }] }

// New events: crateOpened { id, count } (pays 5FG XP), raceStart { id }, raceFail { id }, guestPlaced { id },
// guestRescued { id, count }, guestFailed { id }, missionDone { id } (pays 5FG XP), unlock { id: 'partyHat' }
```

### Plan 6D pieces this plan uses

Plan 6D (`docs/superpowers/plans/2026-09-28-plan-6d-stealth.md`) builds predator rooms as encounter definitions and wrote an `encore` squad per room for this rescue. The Missing Guests stealth room is nothing more than:

```js
// src/stealth/stealthRooms.js (6D, pure)
stealthFight('aceCatwalks', { squad: 'encore' })   // { site: 'aceCatwalks', radius: 24, entry, stealth: 'aceCatwalks', squad: 'encore', waves: [[...5 goons]] }
ROOMS.aceCatwalks, roomSquad(room, 'encore'), SITES.aceCatwalks = { x: 124, y: 0.15, z: -118 }, SITES.aceCatwalksEntry
// src/game/encounters.js (6D): a fight with `stealth` set spawns the squad on its routes, hands it to the stealth runtime,
// emits fightStart when Batman enters the radius (or encounters.trigger()), and fightDone when every goon is down.
// src/stealth/patrol.js (6D, pure): segmentHitsRect(a, b, rect)   (test only: the captive sits off every patrol leg)
```
So the magician's rescue runs through `encounters.begin('guest:magician', guestFight(magician))` exactly like the other guests, and ends on `fightDone`. If a 6D name reads differently when this plan is executed, change only `guestFight` in `src/postgame/guests.js` and its test.

### The 20 Joker crates at a glance

| Kind | Count | How it opens | Where |
|---|---|---|---|
| Explosive gel | 4 | blow the cracked wall of its brick shed (5FG gel) | hotel, Live Jazz, Iceberg, Ace lab roofs |
| Batclaw vent | 3 | tear the duct's vent cover off (5FG batclaw) | Docks warehouse, 24 hour sign, Harvey Dent billboard |
| Ladder | 2 | arrive within 4 s of climbing a ladder | pawn shop and noodle bar fire escapes |
| Wall run | 2 | arrive within 4 s of a wall run | diner roof edge, vat deck edge |
| Zipline | 3 | grab it while riding the cable | Docks, Gazette, Ace Chemicals cables |
| Race | 6 | touch the clock crate, reach the prize before the clock | GCPD drop, Neon Row sprint, Docks hop, Ace dash, bell tower drop, harbour glide |

Each crate pays 200 XP through 5FG's `crateOpened`. All twenty put **Harley's Party Hat** on the cowl (toggle on the After the Party page).

### The six guests at a glance

| Guest (default name) | Role | Kind | Where |
|---|---|---|---|
| DJ Spinz | the DJ | fight, 2 waves | cold storage roof, Docks |
| Chef Crumbs | the baker | fight with a brute | factory roof, Ace Chemicals |
| Marvelous Marco | the magician | stealth room (6D's Ace Chemicals Catwalks, encore squad) | the catwalk floor, Ace Chemicals |
| Bella Balloons | the balloon artist | fight, 2 waves | brick roof, Docks |
| Flash Freddie | the photographer | timed rescue, 50 s | freighter deck |
| Grandma Rosie | `${MANSI.name}`'s biggest fan | fight with a brute | Gazette roof, Neon Row |

Each rescue pays 500 XP through `missionDone` and adds the guest to the dance party on the GCPD roof (`Dance_Loop`, in their own party hats).

### New Game Plus at a glance

| Cycle | Goon health | Damage | Wind-up | Gap between attacks | Extra wind-ups | Extra goons per wave |
|---|---|---|---|---|---|---|
| 1 | x1.5 | x1.35 | x0.8 | x0.8 | +1 | +1 |
| 2 | x1.75 | x1.5 | x0.72 | x0.72 | +1 | +1 |
| 3 (max) | x2 | x1.65 | x0.65 | x0.65 | +2 | +2 |

Gold suit, every gadget unlocked, every WayneTech upgrade and all XP kept. Finishing it pays 500 XP and fills the Progress tracker's "New Game Plus" row.

---
### Task 1: Joker crate spots and their sheds and ducts (pure)

**Files:**
- Create: `src/postgame/crateSpots.js`
- Modify: `src/world/breakableSpots.js` (5FG)
- Test: `tests/unit/crateSpots.test.js` (new), `tests/unit/breakableSpots.test.js` (5FG, modify)

**Interfaces:**
- Consumes: `BREAKABLES` (5FG, `breakableSpots.js`), `ZIP_SAG`, `createClimbables`, `addZipline` (`src/world/climbables.js`, pure).
- Produces: everything listed for `crateSpots.js` in Shared interfaces; seven new `BREAKABLES` rows (`wallCrateHotel`, `wallCrateJazz`, `wallCrateIceberg`, `wallCrateAceLab`, `ventCrateWh2`, `ventCrateOpen24`, `ventCrateHarvey`) with `hides: { type: 'crate', id }`. 5FG's `createBreakables` builds them with no change: it only looks up `hides.id` for caches, so a `crate` row is a plain shed or duct, and its `cachePos` is the crate's spot.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/crateSpots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  CRATES, CRATE_IDS, crateById, NOTE, CRATE_PRIZES, MOVE_WINDOW, raceLimit, crateOpenable, createRace, findZipLine, zipCrateSpot, touchRadius,
} from '../../src/postgame/crateSpots.js';
import { BREAKABLES } from '../../src/world/breakableSpots.js';
import { createClimbables, addZipline } from '../../src/world/climbables.js';

const DASH = /[\u2013\u2014]/;

describe('crate data', () => {
  it('has 20 unique crates in the promised mix', () => {
    expect(CRATES).toHaveLength(20);
    expect(new Set(CRATE_IDS).size).toBe(20);
    const count = (k) => CRATES.filter((c) => c.kind === k).length;
    expect(['gel', 'vent', 'ladder', 'wallrun', 'zipline', 'race'].map(count)).toEqual([4, 3, 2, 2, 3, 6]);
    expect(crateById('crateHotel').lock).toBe('wallCrateHotel');
    expect(crateById('nope')).toBe(null);
  });
  it('every gel and vent crate sits at the floor center of the breakable room that hides it', () => {
    for (const c of CRATES.filter((x) => x.lock)) {
      const b = BREAKABLES.find((x) => x.id === c.lock);
      expect(b, c.id).toBeTruthy();
      expect(b.kind).toBe(c.kind === 'gel' ? 'weakWall' : 'vent');
      expect(b.hides).toEqual({ type: 'crate', id: c.id });
      expect([b.room.x, b.room.y, b.room.z]).toEqual([c.x, c.y, c.z]);
    }
  });
  it('race limits come from distance and climb', () => {
    expect(raceLimit({ x: 0, y: 0, z: 0 }, { x: 90, y: 0, z: 0 })).toBe(16);
    expect(raceLimit({ x: 0, y: 0, z: 0 }, { x: 0, y: 8, z: 0 })).toBe(8);
    expect(CRATES.filter((c) => c.race).map((c) => [c.id, c.race.limit])).toEqual([
      ['raceGcpdDrop', 9], ['raceNeonSprint', 20], ['raceDocksHop', 13], ['raceAceDash', 16], ['raceBellDrop', 11], ['raceHarbour', 16],
    ]);
  });
  it('the copy has no dashes', () => {
    expect(CRATE_PRIZES).toHaveLength(20);
    for (const s of [...CRATE_PRIZES, ...Object.values(NOTE), ...CRATES.map((c) => c.where)]) expect(s).not.toMatch(DASH);
  });
});

describe('opening', () => {
  const gel = crateById('crateHotel'), ladder = crateById('cratePawnLadder'), zip = crateById('crateDocksZip'), race = crateById('raceNeonSprint');
  it('gel and vent crates open once their breakable is broken', () => {
    expect(crateOpenable(gel, { broken: [] })).toEqual({ ok: false, reason: 'locked' });
    expect(crateOpenable(gel, { broken: ['wallCrateHotel'] }).ok).toBe(true);
    expect(crateOpenable(crateById('crateOpen24'), { broken: ['ventCrateOpen24'] }).ok).toBe(true);
  });
  it('traversal crates want their move in the last 4 s', () => {
    expect(MOVE_WINDOW).toBe(4);
    expect(crateOpenable(ladder, { lastMove: {}, now: 10 }).reason).toBe('move');
    expect(crateOpenable(ladder, { lastMove: { ladder: 7 }, now: 10 }).ok).toBe(true);
    expect(crateOpenable(ladder, { lastMove: { ladder: 5.9 }, now: 10 }).ok).toBe(false);
    expect(crateOpenable(crateById('crateDinerWall'), { lastMove: { ladder: 9.9 }, now: 10 }).ok).toBe(false);
    expect(crateOpenable(crateById('crateDinerWall'), { lastMove: { wallrun: 9.9 }, now: 10 }).ok).toBe(true);
  });
  it('zip crates open only while riding, race crates only during their own race', () => {
    expect(crateOpenable(zip, { riding: null }).ok).toBe(false);
    expect(crateOpenable(zip, { riding: 'zip' }).ok).toBe(true);
    expect(crateOpenable(race, { racing: null }).reason).toBe('race');
    expect(crateOpenable(race, { racing: 'raceGcpdDrop' }).ok).toBe(false);
    expect(crateOpenable(race, { racing: 'raceNeonSprint' }).ok).toBe(true);
  });
  it('touch radius per kind', () => {
    expect([touchRadius(gel), touchRadius(crateById('crateOpen24')), touchRadius(zip)]).toEqual([1.7, 2, 2.4]);
  });
});

describe('races', () => {
  it('count up and time out once', () => {
    const r = createRace(crateById('raceGcpdDrop'));
    expect(r.limit).toBe(9);
    expect(r.update(8.5)).toBe(null);
    expect(r.left).toBeCloseTo(0.5);
    expect(r.update(0.6)).toBe('timeout');
    expect(r.update(1)).toBe(null);
    expect(r.over).toBe(true);
  });
  it('finish reports the time and stops the clock', () => {
    const r = createRace(crateById('raceGcpdDrop'));
    r.update(4.25);
    expect(r.finish()).toBeCloseTo(4.25);
    expect(r.update(10)).toBe(null);
  });
});

describe('zip crates', () => {
  it('find their cable either way round and hang under its middle', () => {
    const c = createClimbables();
    addZipline(c, { x: 118, y: 32.2, z: -2 }, { x: 121, y: 28.2, z: -46 });
    const docks = addZipline(c, { x: -62, y: 18.2, z: 180 }, { x: -118, y: 16.2, z: 182 });
    expect(findZipLine(c.ziplines, crateById('crateDocksZip').zip)).toBe(docks);
    expect(findZipLine(c.ziplines, crateById('crateNeonZip').zip)).toBe(c.ziplines[0]);
    expect(findZipLine(c.ziplines, crateById('crateAceZip').zip)).toBe(null);
    const s = zipCrateSpot(docks);
    expect(s.x).toBeCloseTo(-90);
    expect(s.z).toBeCloseTo(181);
    expect(s.y).toBeCloseTo(17.2 - docks.length * 0.03 - 1.1);
    expect(zipCrateSpot({ ...docks, sag: 0 }).y).toBeCloseTo(16.1);
  });
});
```

In `tests/unit/breakableSpots.test.js` (5FG), in `it('has unique ids and the promised mix', ...)` change the mix line to:

```js
    expect([count('weakWall'), count('glass'), count('vent'), count('railing')]).toEqual([10, 4, 6, 2]);
```
and add the crate count right after the existing `expect(hides('cache')).toBe(6);` line (it must come after `const hides = ...`):
```js
    expect(hides('crate')).toBe(7);
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/crateSpots.test.js tests/unit/breakableSpots.test.js`
Expected: FAIL (`crateSpots.js` is missing; the breakable mix is still `[6, 4, 3, 2]`).

- [ ] **Step 3: Add the sheds and ducts.** In `src/world/breakableSpots.js`, append to `BREAKABLES` after the `railFactory` row:

```js
  // Part H (Plan 7H-1): Joker crates in brick sheds and rooftop ducts. The crate sits at the room's
  // floor center; src/postgame/crateSpots.js holds the matching crate with `lock` set to this id.
  { id: 'wallCrateHotel', kind: 'weakWall', room: { x: 112, y: 45, z: -75, w: 3, d: 3, h: 2.6, open: 'e' }, hides: { type: 'crate', id: 'crateHotel' } },
  { id: 'wallCrateJazz', kind: 'weakWall', room: { x: 131, y: 34, z: 76, w: 3, d: 3, h: 2.6, open: 'w' }, hides: { type: 'crate', id: 'crateJazz' } },
  { id: 'wallCrateIceberg', kind: 'weakWall', room: { x: 188, y: 30, z: 106, w: 3, d: 3, h: 2.6, open: 'n' }, hides: { type: 'crate', id: 'crateIceberg' } },
  { id: 'wallCrateAceLab', kind: 'weakWall', room: { x: 64, y: 14, z: -112, w: 3, d: 3, h: 2.6, open: 's' }, hides: { type: 'crate', id: 'crateAceLab' } },
  { id: 'ventCrateWh2', kind: 'vent', room: { x: -126, y: 14, z: 178, w: 1.4, d: 1.4, h: 1.2, open: 'e' }, hides: { type: 'crate', id: 'crateWarehouse2' } },
  { id: 'ventCrateOpen24', kind: 'vent', room: { x: 186, y: 38, z: -6, w: 1.4, d: 1.4, h: 1.2, open: 'w' }, hides: { type: 'crate', id: 'crateOpen24' } },
  { id: 'ventCrateHarvey', kind: 'vent', room: { x: 176, y: 28, z: 16, w: 1.4, d: 1.4, h: 1.2, open: 's' }, hides: { type: 'crate', id: 'crateHarvey' } },
```

- [ ] **Step 4: Write `src/postgame/crateSpots.js`**

```js
// The 20 Joker crates of After the Party, as data, and their puzzle rules. Pure.
// kind:
//   'gel', 'vent'      inside a brick shed or a rooftop duct; `lock` is the cracked wall or vent
//                      cover in src/world/breakableSpots.js (explosive gel, batclaw)
//   'ladder','wallrun' Batman must have used that move in the last MOVE_WINDOW seconds
//   'zipline'          hangs under a cable (`zip` names the ZIP_ROUTES pair); grab it while riding
//   'race'             touch the clock crate at `race.from`, then reach this crate before the clock
// x, y, z is where the crate sits (y is the floor under it). Zip crates carry a rough spot for the
// map; the game hangs them under the real cable (zipCrateSpot). scripts/postgame-check.mjs checks
// every spot against the live city.
import { ZIP_SAG } from '../world/climbables.js';

export const MOVE_WINDOW = 4;
export const RACE_SPEED = { flat: 9, climb: 4 };
export const TOUCH = { crate: 1.7, vent: 2, zipline: 2.4 };
export const HAT_UNLOCK = 'partyHat';

// A race's time limit: 9 m/s across the ground, 4 m/s for every metre climbed, plus 6 s.
export function raceLimit(from, to) {
  const flat = Math.hypot(to.x - from.x, to.z - from.z);
  const rise = Math.max(0, to.y - from.y);
  return Math.ceil(flat / RACE_SPEED.flat + rise / RACE_SPEED.climb + 6);
}

const c = (id, kind, x, y, z, where, extra = {}) => ({ id, kind, x, y, z, where, ...extra });
const RAW = [
  c('crateHotel', 'gel', 112, 45, -75, 'Hotel roof, Neon Row', { lock: 'wallCrateHotel' }),
  c('crateJazz', 'gel', 131, 34, 76, 'Live Jazz roof, Neon Row', { lock: 'wallCrateJazz' }),
  c('crateIceberg', 'gel', 188, 30, 106, 'Iceberg roof, Neon Row', { lock: 'wallCrateIceberg' }),
  c('crateAceLab', 'gel', 64, 14, -112, 'Lab roof, Ace Chemicals', { lock: 'wallCrateAceLab' }),
  c('crateWarehouse2', 'vent', -126, 14, 178, 'A duct on a Docks warehouse', { lock: 'ventCrateWh2' }),
  c('crateOpen24', 'vent', 186, 38, -6, 'A duct over the 24 hour sign', { lock: 'ventCrateOpen24' }),
  c('crateHarvey', 'vent', 176, 28, 16, 'A duct behind the Harvey Dent billboard', { lock: 'ventCrateHarvey' }),
  c('cratePawnLadder', 'ladder', 137.5, 26, -48, 'Top of the pawn shop fire escape', { needs: 'ladder' }),
  c('crateNoodleLadder', 'ladder', 137.5, 20, 112, 'Top of the noodle bar fire escape', { needs: 'ladder' }),
  c('crateDinerWall', 'wallrun', 162.5, 9, 60, 'On the diner roof edge', { needs: 'wallrun' }),
  c('crateVatWall', 'wallrun', 169.5, 10, -118, 'On the edge of the vat deck', { needs: 'wallrun' }),
  c('crateDocksZip', 'zipline', -90, 13, 181, 'Under the Docks warehouse cable', { needs: 'zipline', zip: { a: { x: -60, z: 180 }, b: { x: -120, z: 182 } } }),
  c('crateNeonZip', 'zipline', 120, 25, -24, 'Under the Gazette cable', { needs: 'zipline', zip: { a: { x: 120, z: -48 }, b: { x: 120, z: 0 } } }),
  c('crateAceZip', 'zipline', 160, 15, -145, 'Under the Ace Chemicals cable', { needs: 'zipline', zip: { a: { x: 140, z: -172 }, b: { x: 180, z: -118 } } }),
  c('raceGcpdDrop', 'race', 0, 0.15, 32, 'GCPD roof to the street', { race: { from: { x: -12, y: 42, z: 14 } } }),
  c('raceNeonSprint', 'race', 150, 0, 60, 'The length of Neon Row', { race: { from: { x: 150, y: 0, z: -60 } } }),
  c('raceDocksHop', 'race', -60, 22, 128, 'Warehouse to cold storage', { race: { from: { x: -60, y: 16, z: 172 } } }),
  c('raceAceDash', 'race', 70, 14, -122, 'Factory roof to the lab', { race: { from: { x: 140, y: 25.1, z: -166 } } }),
  c('raceBellDrop', 'race', -86, 0.15, -112, 'Clock tower to the plaza', { race: { from: { x: -62, y: 58, z: -150 } } }),
  c('raceHarbour', 'race', 6, 0.15, 172, 'Cold storage to the container yard', { race: { from: { x: -60, y: 22, z: 114 } } }),
];
export const CRATES = RAW.map((cr) => (cr.race ? { ...cr, race: { ...cr.race, limit: raceLimit(cr.race.from, cr) } } : cr));
export const CRATE_IDS = CRATES.map((cr) => cr.id);
export const crateById = (id) => CRATES.find((cr) => cr.id === id) ?? null;

// What the Joker's note says when a crate won't open yet.
export const NOTE = {
  gel: 'A Joker crate, bricked in. The note says: "Bring something with a bang."',
  vent: 'A Joker crate behind a vent cover. The note says: "Grab it if you can."',
  ladder: 'The note says: "Climbers only. Come up the ladder, birthday bat."',
  wallrun: 'The note says: "Real acrobats run up the wall." Drop down and try it.',
  zipline: 'It dangles from the cable. Ride the zipline and grab it on the way past.',
  race: 'A clock crate. The note says: "Tick tock! Touch me to start the race."',
};

// The prize inside each crate, in the order they are opened.
export const CRATE_PRIZES = [
  'Inside: a rubber chicken and a note. "Made you look!"',
  'Inside: one very squeaky whoopee cushion. Gotham is safer without it.',
  'Inside: confetti. Only confetti. So much confetti.',
  'Inside: a birthday card signed by every goon in Gotham. Most of them spelled their own names wrong.',
  'Inside: a trick candle that never goes out. The Joker thinks this is hilarious.',
  'Inside: a squirting flower. It squirted. Of course it did.',
  'Inside: a jack in the box that just says "HAPPY BIRTHDAY" in a very sarcastic voice.',
  'Inside: a coupon for one free hug from Harley. Expires never.',
  'Inside: a tiny cake. It is real. It is delicious. Batman does not share.',
  'Inside: fake teeth that chatter. They followed you for a block.',
  'Inside: a note: "Halfway, birthday bat. Keep going!"',
  'Inside: glitter. It will be in the Batcave until next year.',
  'Inside: a kazoo. Alfred will not be pleased.',
  'Inside: a Joker card with a smiley face drawn on the back.',
  'Inside: a bag of party poppers with a sign that says "for emergencies".',
  'Inside: a photo of the Joker in a birthday hat, trying very hard to look menacing.',
  'Inside: a spring loaded boxing glove. It missed. Mostly.',
  'Inside: balloons shaped like tiny bats. Adorable. Suspicious, but adorable.',
  'Inside: a note: "One more after this. The hat is nearly yours."',
  'Inside: the last note. "You found every one. Happy birthday. Signed, J."',
];

const OK = Object.freeze({ ok: true, reason: null });
const NO = (reason) => ({ ok: false, reason });

// Can Batman open this crate right now? state: { broken: breakable ids, lastMove: { ladder, wallrun }
// (game time the move was last used), now, riding (hero.control name), racing (crate id or null) }.
export function crateOpenable(crate, { broken = [], lastMove = {}, now = 0, riding = null, racing = null } = {}) {
  switch (crate.kind) {
    case 'gel':
    case 'vent':
      return broken.includes(crate.lock) ? OK : NO('locked');
    case 'ladder':
    case 'wallrun': {
      const t = lastMove[crate.needs];
      return typeof t === 'number' && now - t <= MOVE_WINDOW ? OK : NO('move');
    }
    case 'zipline':
      return riding === 'zip' ? OK : NO('move');
    case 'race':
      return racing === crate.id ? OK : NO('race');
    default:
      return NO('unknown');
  }
}

// A race in progress: counts up in game time; 'timeout' once, at the limit.
export function createRace(crate) {
  const limit = crate.race.limit;
  let time = 0, over = false;
  return {
    id: crate.id,
    limit,
    get time() { return time; },
    get left() { return Math.max(0, limit - time); },
    get over() { return over; },
    update(dt) {
      if (over) return null;
      time += dt;
      if (time < limit) return null;
      over = true;
      return 'timeout';
    },
    finish() { over = true; return time; },
  };
}

// The cable a zip crate hangs under: the line whose two ends are nearest the route's two roofs,
// either way round (a cable always runs downhill, whichever roof is higher).
export function findZipLine(lines, zip) {
  let best = null, bd = Infinity;
  for (const l of lines) {
    const same = Math.hypot(l.a.x - zip.a.x, l.a.z - zip.a.z) + Math.hypot(l.b.x - zip.b.x, l.b.z - zip.b.z);
    const swap = Math.hypot(l.a.x - zip.b.x, l.a.z - zip.b.z) + Math.hypot(l.b.x - zip.a.x, l.b.z - zip.a.z);
    const d = Math.min(same, swap);
    if (d < bd) { bd = d; best = l; }
  }
  return bd <= 60 ? best : null;
}

// Where a zip crate hangs: `k` of the way along the cable (sag included), `drop` below it, which
// is where a rider's chest passes.
export function zipCrateSpot(line, k = 0.5, drop = 1.1) {
  const sag = Math.sin(Math.PI * k) * line.length * (line.sag ?? ZIP_SAG);
  return {
    x: line.a.x + (line.b.x - line.a.x) * k,
    y: line.a.y + (line.b.y - line.a.y) * k - sag - drop,
    z: line.a.z + (line.b.z - line.a.z) * k,
  };
}

export const touchRadius = (crate) => (crate.kind === 'zipline' ? TOUCH.zipline : crate.kind === 'vent' ? TOUCH.vent : TOUCH.crate);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/crateSpots.test.js tests/unit/breakableSpots.test.js tests/unit/saveGadgets.test.js`
Expected: PASS. `saveGadgets.test.js` still passes: `sanitizeGadgetSave` validates against `BREAKABLE_IDS`, which now includes the seven new ids.

- [ ] **Step 6: Commit**

```bash
git config user.name   # must print: Krishn Gohel
git add src/postgame/crateSpots.js src/world/breakableSpots.js tests/unit/crateSpots.test.js tests/unit/breakableSpots.test.js
git commit -m "Joker crates: twenty spots, puzzle rules, races, and the sheds and ducts that hide them"
```

---

### Task 2: The six Missing Guests (pure)

**Files:**
- Create: `src/postgame/guests.js`
- Modify: `src/mansi.config.js`
- Test: `tests/unit/guests.test.js` (new)

**Interfaces:**
- Consumes: `MANSI` (`src/mansi.config.js`); Plan 6D's `stealthFight(roomId, { squad })`, `ROOMS`, `roomSquad` (`src/stealth/stealthRooms.js`) and `segmentHitsRect` (`src/stealth/patrol.js`, test only), all pure. 6D wrote its `encore` squads for exactly this rescue: `stealthFight('aceCatwalks', { squad: 'encore' })` is the catwalk room with its four rifle goons plus a knife goon.
- Produces: everything listed for `guests.js` in Shared interfaces; `MANSI.partyGuests`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/guests.test.js`:

```js
import { describe, it, expect } from 'vitest';
import MANSI from '../../src/mansi.config.js';
import { SITES } from '../../src/world/mapData.js';
import { ROOMS, roomSquad } from '../../src/stealth/stealthRooms.js';
import { segmentHitsRect } from '../../src/stealth/patrol.js';
import {
  GUESTS, GUEST_IDS, PARTY_CENTER, RESCUE_LIMIT, guestById, guestName, partySlot, guestFightId, isGuestFight, guestFight,
  rescueCard, timedFailText, partyStatus, createRescueTimer,
} from '../../src/postgame/guests.js';

const DASH = /[\u2013\u2014]/;

describe('guests', () => {
  it('six guests: four fights, one stealth room, one timed rescue', () => {
    expect(GUEST_IDS).toEqual(['dj', 'baker', 'magician', 'balloonArtist', 'photographer', 'grandma']);
    expect(GUESTS.filter((g) => g.kind === 'fight')).toHaveLength(4);
    expect(guestById('magician').kind).toBe('stealth');
    expect(guestById('photographer')).toMatchObject({ kind: 'timed', limit: RESCUE_LIMIT });
    expect(RESCUE_LIMIT).toBe(50);
    expect(guestById('nope')).toBe(null);
  });
  it('names come from mansi.config.js, with defaults for blanks', () => {
    expect(MANSI.partyGuests).toHaveLength(6);
    GUESTS.forEach((g, i) => expect(g.name).toBe(guestName(i)));
    expect(guestName(0, ['  Priya  '])).toBe('Priya');
    expect(guestName(1, ['x', ''])).toBe('Chef Crumbs');
    expect(guestName(2, null)).toBe('Marvelous Marco');
    expect(guestName(0, ['A very long name that goes on and on'])).toHaveLength(24);
  });
  it('every squad is well formed and near its guest', () => {
    for (const g of GUESTS.filter((x) => x.kind !== 'stealth')) {
      expect(g.waves.length).toBeGreaterThan(0);
      for (const w of g.waves) for (const e of w) expect(['grunt', 'knife', 'brute']).toContain(e.type);
      expect(guestFight(g)).toEqual({ site: g.site, radius: g.radius, waves: g.waves });
    }
    for (const g of GUESTS) {
      expect(Math.hypot(g.captive.x - g.site.x, g.captive.z - g.site.z)).toBeLessThan(g.radius);
      expect(g.captive.y).toBe(g.site.y);
    }
  });
  it('the magician is held in Plan 6D\'s catwalk room, guarded by its encore squad', () => {
    const g = guestById('magician');
    const room = ROOMS[g.room];
    expect(g.site).toEqual(SITES[room.site]);
    expect(g.radius).toBe(room.radius);
    const f = guestFight(g);
    expect(f).toMatchObject({ stealth: 'aceCatwalks', squad: 'encore', radius: room.radius });
    expect(f.waves[0]).toHaveLength(roomSquad(room, 'encore').length);
    const b = room.bounds;
    expect(g.captive.x > b.minX && g.captive.x < b.maxX && g.captive.z > b.minZ && g.captive.z < b.maxZ).toBe(true);
    const cell = { x: g.captive.x, z: g.captive.z, w: 2, d: 2 };
    for (const s of roomSquad(room, 'encore')) {
      const pts = s.route.points;
      const legs = s.route.mode === 'loop' ? pts.length : pts.length - 1;
      for (let i = 0; i < legs; i++) expect(segmentHitsRect(pts[i], pts[(i + 1) % pts.length], cell)).toBe(false);
    }
    for (const c of room.cover) expect(Math.hypot(c.x - g.captive.x, c.z - g.captive.z)).toBeGreaterThan(2);
  });
  it('party slots ring the dance floor on the GCPD roof, each facing the middle', () => {
    expect(partySlot(0)).toEqual({ x: -8, y: 42, z: 13.2, yaw: 3.14 });
    const slots = GUESTS.map((g) => g.slot);
    for (const s of slots) {
      expect(Math.abs(s.x)).toBeLessThan(19);
      expect(Math.abs(s.z)).toBeLessThan(19);
      expect(Math.hypot(s.x - PARTY_CENTER.x, s.z - PARTY_CENTER.z)).toBeCloseTo(3.2, 1);
      expect(Math.sin(s.yaw) * (PARTY_CENTER.x - s.x) + Math.cos(s.yaw) * (PARTY_CENTER.z - s.z)).toBeGreaterThan(3.1);
    }
    for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) expect(Math.hypot(slots[i].x - slots[j].x, slots[i].z - slots[j].z)).toBeGreaterThan(2);
  });
  it('fight ids and copy', () => {
    expect(guestFightId('dj')).toBe('guest:dj');
    expect([isGuestFight('guest:dj'), isGuestFight('crime:1'), isGuestFight(null)]).toEqual([true, false, false]);
    const g = guestById('grandma');
    expect(g.role).toBe(`${MANSI.name}'s biggest fan`);
    expect(rescueCard(g, 2)).toEqual({
      title: `${g.name.toUpperCase()} IS FREE!`,
      text: `${g.name}, ${MANSI.name}'s biggest fan, is off to the rooftop party on GCPD. 2 of 6 guests rescued.`,
    });
    expect(rescueCard(g, 6).title).toBe('EVERYONE IS SAFE!');
    expect(partyStatus(3)).toBe('3 of 6 at the rooftop party');
    expect(partyStatus(6)).toBe('Everyone is at the party');
    const copy = [...GUESTS.flatMap((x) => [x.name, x.role, x.plea, x.where]), timedFailText(g), rescueCard(g, 1).text, rescueCard(g, 6).text];
    for (const s of copy) expect(s).not.toMatch(DASH);
  });
  it('the rescue timer expires once', () => {
    const t = createRescueTimer(10);
    expect(t.update(9)).toBe(null);
    expect(t.left).toBeCloseTo(1);
    expect(t.update(1.5)).toBe('expired');
    expect(t.update(1)).toBe(null);
    expect(t.left).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/guests.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Add the names to `src/mansi.config.js`.** After `fromName: 'Krishn',` add:

```js
  // After the Party (post-game): the six party guests Batman rescues. Swap in real friends' names
  // if you like (24 characters at most). In order: the DJ, the baker, the magician, the balloon
  // artist, the photographer, and Mansi's biggest fan.
  partyGuests: ['DJ Spinz', 'Chef Crumbs', 'Marvelous Marco', 'Bella Balloons', 'Flash Freddie', 'Grandma Rosie'],
```

- [ ] **Step 4: Write `src/postgame/guests.js`**

```js
// The six Missing Guests of After the Party, as data, plus the rooftop party layout and the
// rescue copy. Pure. Names come from mansi.config.js (partyGuests), so the owner can swap in real
// friends. kind: 'fight' (a goon squad), 'stealth' (a Plan 6D predator room), 'timed' (beat the
// squad before the clock runs out). site: the fight's center; captive: where the guest waits.
// scripts/postgame-check.mjs checks every spot against the live city.
import MANSI from '../mansi.config.js';
import { stealthFight } from '../stealth/stealthRooms.js';

export const PARTY_CENTER = { x: -8, y: 42, z: 10 };
export const RESCUE_LIMIT = 50;
const DEFAULT_NAMES = ['DJ Spinz', 'Chef Crumbs', 'Marvelous Marco', 'Bella Balloons', 'Flash Freddie', 'Grandma Rosie'];

export function guestName(i, names = MANSI.partyGuests) {
  const n = Array.isArray(names) && typeof names[i] === 'string' ? names[i].trim().slice(0, 24) : '';
  return n || DEFAULT_NAMES[i];
}

const round2 = (v) => Math.round(v * 100) / 100;
// Six spots in a ring on the GCPD roof, each facing the middle of the dance floor.
export function partySlot(i, n = 6, r = 3.2) {
  const a = (i / n) * Math.PI * 2;
  return {
    x: round2(PARTY_CENTER.x + Math.sin(a) * r), y: PARTY_CENTER.y, z: round2(PARTY_CENTER.z + Math.cos(a) * r),
    yaw: round2(a + Math.PI),
  };
}

const g = (dx, dz) => ({ type: 'grunt', dx, dz });
const k = (dx, dz) => ({ type: 'knife', dx, dz });
const b = (dx, dz) => ({ type: 'brute', dx, dz });

const RAW = [
  {
    id: 'dj', role: 'the DJ', kind: 'fight', where: 'Cold storage roof, the Docks',
    site: { x: -60, y: 22, z: 116 }, captive: { x: -52, y: 22, z: 108 }, radius: 14,
    waves: [[g(-5, -4), g(5, -4), k(0, 6)], [g(-6, 4), k(6, 3), g(0, -7)]],
    plea: 'They took my turntables! And me! Mostly the turntables!',
  },
  {
    id: 'baker', role: 'the baker', kind: 'fight', where: 'Factory roof, Ace Chemicals',
    site: { x: 150, y: 25.1, z: -166 }, captive: { x: 157, y: 25.1, z: -160 }, radius: 16,
    waves: [[g(-6, -5), g(6, -5), k(-4, 6), b(4, 7)]],
    plea: 'The cake needs another layer and I need a rescue! In that order!',
  },
  {
    // Plan 6D's Ace Chemicals Catwalks predator room with its post-game "encore" squad. The
    // magician sits on the floor inside the east patrol loop, off every route.
    id: 'magician', role: 'the magician', kind: 'stealth', where: 'The Ace Chemicals catwalks', room: 'aceCatwalks',
    site: { x: 124, y: 0.15, z: -118 }, captive: { x: 146, y: 0.15, z: -118 }, radius: 24,
    plea: 'I would make myself disappear, but they took my wand. Quietly, please. Those goons have rifles.',
  },
  {
    id: 'balloonArtist', role: 'the balloon artist', kind: 'fight', where: 'Brick roof, the Docks',
    site: { x: -176, y: 26, z: 126 }, captive: { x: -170, y: 26, z: 133 }, radius: 14,
    waves: [[k(-5, -4), g(5, -4), g(0, 6)], [g(-6, 3), g(6, 3), k(0, -7)]],
    plea: 'Every balloon I make, they pop. Rude!',
  },
  {
    id: 'photographer', role: 'the photographer', kind: 'timed', where: 'The freighter deck', limit: RESCUE_LIMIT,
    site: { x: -44, y: 9, z: 238 }, captive: { x: -44, y: 9, z: 232 }, radius: 14,
    waves: [[g(-4, -6), g(4, -4), k(0, 6)], [k(-4, 10), g(4, 12), g(0, -10)]],
    plea: 'They tied me to a giant firework! Get a good angle when it goes!',
  },
  {
    id: 'grandma', role: `${MANSI.name}'s biggest fan`, kind: 'fight', where: 'Gazette roof, Neon Row',
    site: { x: 120, y: 30, z: 0 }, captive: { x: 127, y: 30, z: 8 }, radius: 15,
    waves: [[k(-5, -4), g(5, -4), g(0, 6)], [b(0, -6), k(6, 5), g(-6, 5)]],
    plea: 'Young man, I have a party to get to. Knock these boys over.',
  },
];

export const GUESTS = RAW.map((x, i) => ({ ...x, name: guestName(i), slot: partySlot(i) }));
export const GUEST_IDS = GUESTS.map((x) => x.id);
export const guestById = (id) => GUESTS.find((x) => x.id === id) ?? null;
export const guestFightId = (id) => `guest:${id}`;
export const isGuestFight = (id) => typeof id === 'string' && id.startsWith('guest:');

// What encounters.begin runs for a guest: a squad (or the timed rescue's squad) at the site, or
// Plan 6D's predator room with its encore squad (6D's encounters hand a `stealth` fight to the
// stealth runtime, and it completes with fightDone like any fight).
export const guestFight = (guest) => (guest.kind === 'stealth'
  ? stealthFight(guest.room, { squad: 'encore' })
  : { site: guest.site, radius: guest.radius, waves: guest.waves });

export function rescueCard(guest, count, total = GUESTS.length) {
  if (count >= total) {
    return { title: 'EVERYONE IS SAFE!', text: `All ${total} guests are dancing on the GCPD roof. The party is complete, ${MANSI.name}. Go say hi.` };
  }
  return {
    title: `${guest.name.toUpperCase()} IS FREE!`,
    text: `${guest.name}, ${guest.role}, is off to the rooftop party on GCPD. ${count} of ${total} guests rescued.`,
  };
}
export const timedFailText = (guest) => `FIZZ... pop. The firework fizzled out. ${guest.name} is fine, just a little sooty. Try again.`;
export const partyStatus = (count, total = GUESTS.length) => (count >= total ? 'Everyone is at the party' : `${count} of ${total} at the rooftop party`);

// A countdown for the timed rescue: 'expired' once, when it reaches 0.
export function createRescueTimer(limit = RESCUE_LIMIT) {
  let left = limit, done = false;
  return {
    get left() { return Math.max(0, left); },
    get done() { return done; },
    update(dt) {
      if (done) return null;
      left -= dt;
      if (left > 0) return null;
      done = true;
      return 'expired';
    },
    stop() { done = true; },
  };
}
```

The balloon artist's "Rude!" ends with an exclamation mark on purpose; the grandma's plea says "Young man" because Batman is in the suit either way (it's a joke, she can't tell under the cowl).

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/guests.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/guests.js src/mansi.config.js tests/unit/guests.test.js
git commit -m "Missing guests: six captives, their squads, the stealth room, the timed rescue and the party slots"
```

---

### Task 3: Saved fields, harder goons and New Game Plus rules (pure)

**Files:**
- Create: `src/combat/hardness.js`, `src/postgame/ngPlus.js`, `src/postgame/postSave.js`
- Test: `tests/unit/ngPlus.test.js`, `tests/unit/postSave.test.js` (new)

**Interfaces:**
- Consumes: `newGameProgress`, `registerProgressField`, `sanitizeProgress` (3C `save.js`); `DIFFICULTY` (`rules.js`); `GADGET_IDS` (5FG `gadgetDefs.js`); `CRATE_IDS` (Task 1); `GUEST_IDS` (Task 2); `FIGHTS` (test only).
- Produces: everything listed for `hardness.js`, `ngPlus.js` and `postSave.js` in Shared interfaces.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/ngPlus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import '../../src/gadgets/gadgetSave.js';
import '../../src/postgame/postSave.js';
import { sanitizeProgress } from '../../src/core/save.js';
import { DIFFICULTY } from '../../src/combat/rules.js';
import { FIGHTS } from '../../src/game/fights.js';
import { GADGET_IDS } from '../../src/gadgets/gadgetDefs.js';
import { NORMAL_RULES, scaleDifficulty, scaledHealth, hardenFight } from '../../src/combat/hardness.js';
import { NG_MAX, ngRules, ngActive, startNewGame, ngLabel } from '../../src/postgame/ngPlus.js';

describe('hardness', () => {
  it('normal rules change nothing', () => {
    expect(scaleDifficulty(DIFFICULTY.normal, NORMAL_RULES)).toEqual(DIFFICULTY.normal);
    expect(scaledHealth(4, NORMAL_RULES)).toBe(4);
    expect(hardenFight(FIGHTS.yard, NORMAL_RULES)).toBe(FIGHTS.yard);
  });
  it('scales a difficulty row', () => {
    const d = scaleDifficulty(DIFFICULTY.normal, ngRules(1));
    expect(d.damage).toBeCloseTo(1.35);
    expect(d.windup).toBeCloseTo(0.48);
    expect(d.gap[0]).toBeCloseTo(1.76);
    expect(d.gap[1]).toBeCloseTo(3.2);
    expect(d.maxWindups).toBe(3);
    expect(scaleDifficulty({ ...DIFFICULTY.hard, windup: 0.3 }, ngRules(3)).windup).toBe(0.25);
  });
  it('rounds goon health up', () => {
    expect(scaledHealth(4, ngRules(1))).toBe(6);
    expect(scaledHealth(10, ngRules(2))).toBe(18);
  });
  it('adds goons to every wave, turned 90 degrees from existing ones', () => {
    const one = hardenFight(FIGHTS.docksRoof, ngRules(1));
    expect(one.site).toBe('wh3Roof');
    expect(one.waves[0]).toEqual([...FIGHTS.docksRoof.waves[0], { type: 'knife', dx: 4.5, dz: -3.6 }]);
    const three = hardenFight(FIGHTS.yard, ngRules(3));
    expect(three.waves.map((w) => w.length)).toEqual([5, 4]);
    expect(three.waves[0][4].type).toBe('grunt');
  });
});

describe('New Game Plus', () => {
  it('has three cycles, clamped', () => {
    expect(NG_MAX).toBe(3);
    expect(ngRules(0)).toBe(NORMAL_RULES);
    expect(ngRules(-2)).toBe(NORMAL_RULES);
    expect(ngRules(Number.NaN)).toBe(NORMAL_RULES);
    expect(ngRules(9)).toBe(ngRules(3));
    expect(ngRules(1)).toMatchObject({ health: 1.5, damage: 1.35, extraPerWave: 1 });
  });
  it('is active while its story is played', () => {
    expect(ngActive({ postgame: { ngCycle: 1 }, finished: false })).toBe(true);
    expect(ngActive({ postgame: { ngCycle: 1 }, finished: true })).toBe(false);
    expect(ngActive({ postgame: { ngCycle: 0 }, finished: false })).toBe(false);
    expect(ngActive({ finished: false })).toBe(false);
  });
  it('starts in gold with every gadget, one cycle past the best cleared', () => {
    const old = sanitizeProgress({ step: 30, finished: true, suit: 'm', crates: ['crateHotel'], postgame: { cleared: true, ngCleared: 1 }, gadgets: { unlocked: ['gel'] } });
    const p = startNewGame(old, { plus: true });
    expect([p.step, p.finished, p.suit]).toEqual([0, false, 'gold']);
    expect(p.postgame).toMatchObject({ cleared: true, ngCycle: 2, ngCleared: 1 });
    expect(p.gadgets.unlocked).toEqual(GADGET_IDS);
    expect(p.crates).toEqual(['crateHotel']);
    expect(startNewGame(sanitizeProgress({ postgame: { ngCleared: 3 } }), { plus: true }).postgame.ngCycle).toBe(3);
  });
  it('a plain new game turns New Game Plus off and keeps everything found', () => {
    const old = sanitizeProgress({ step: 12, postgame: { cleared: true, ngCycle: 2, ngCleared: 1 }, gadgets: { unlocked: ['gel'] }, guests: ['dj'] });
    const p = startNewGame(old);
    expect([p.step, p.suit, p.postgame.ngCycle, p.postgame.ngCleared]).toEqual([0, null, 0, 1]);
    expect(p.gadgets.unlocked).toEqual(['gel']);
    expect(p.guests).toEqual(['dj']);
  });
  it('labels', () => {
    expect([ngLabel(0), ngLabel(1), ngLabel(2), ngLabel(3)]).toEqual(['New Game Plus', 'New Game Plus 2', 'New Game Plus 3', 'New Game Plus 3']);
  });
});
```

Create `tests/unit/postSave.test.js`:

```js
import { describe, it, expect } from 'vitest';
import '../../src/postgame/postSave.js';
import { sanitizeProgress, newGameProgress, saveProgress, loadProgress } from '../../src/core/save.js';
import { sanitizePostgame, idsFrom } from '../../src/postgame/postSave.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('post-game save fields', () => {
  it('defaults', () => {
    const p = sanitizeProgress({});
    expect(p.postgame).toEqual({ cleared: false, introSeen: false, hatOn: true, ngCycle: 0, ngCleared: 0 });
    expect(p.crates).toEqual([]);
    expect(p.guests).toEqual([]);
  });
  it('drops junk, duplicates and unknown ids, and clamps the cycles', () => {
    expect(sanitizePostgame({ cleared: 'yes', introSeen: true, hatOn: false, ngCycle: 7, ngCleared: -1 }))
      .toEqual({ cleared: false, introSeen: true, hatOn: false, ngCycle: 3, ngCleared: 0 });
    expect(sanitizePostgame([1])).toEqual({ cleared: false, introSeen: false, hatOn: true, ngCycle: 0, ngCleared: 0 });
    expect(sanitizePostgame({ ngCycle: 1.5 }).ngCycle).toBe(0);
    expect(sanitizeProgress({ crates: ['crateHotel', 'x', 'crateHotel', 3], guests: ['dj', 'dj', 'joker'] })).toMatchObject({ crates: ['crateHotel'], guests: ['dj'] });
    expect(idsFrom('nope', ['a'])).toEqual([]);
  });
  it('round-trips through storage and a new game keeps it all', () => {
    const st = memory();
    const p = sanitizeProgress({ step: 30, finished: true, postgame: { cleared: true, introSeen: true, ngCleared: 1 }, crates: ['crateJazz'], guests: ['baker'] });
    saveProgress(st, p);
    expect(loadProgress(st)).toEqual(p);
    const n = newGameProgress(p);
    expect([n.postgame, n.crates, n.guests]).toEqual([p.postgame, p.crates, p.guests]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/ngPlus.test.js tests/unit/postSave.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/combat/hardness.js`**

```js
// Harder goons as one rules object. New Game Plus (Plan 7H-1) and the survival arena (Plan 7H-2)
// hand one to combat.setHardness; encounters' shape hook adds goons with hardenFight; the spawn
// wrapper in game.js scales goon health. Pure.
export const NORMAL_RULES = Object.freeze({ health: 1, damage: 1, windup: 1, gap: 1, maxWindups: 0, extraPerWave: 0 });

// A DIFFICULTY row (src/combat/rules.js) with the rules applied. Wind-ups never drop under 0.25 s.
export function scaleDifficulty(base, r = NORMAL_RULES) {
  return {
    ...base,
    damage: base.damage * r.damage,
    windup: Math.max(0.25, base.windup * r.windup),
    gap: [base.gap[0] * r.gap, base.gap[1] * r.gap],
    maxWindups: base.maxWindups + r.maxWindups,
  };
}

export const scaledHealth = (health, r = NORMAL_RULES) => Math.ceil(health * r.health);

// Extra goons in every wave. Each stands where an existing goon of that wave stands, turned 90
// degrees around the site (so nobody spawns inside anybody), knives first, then grunts.
export function hardenFight(def, r = NORMAL_RULES) {
  if (!r.extraPerWave) return def;
  return {
    ...def,
    waves: def.waves.map((w) => {
      const extra = [];
      for (let i = 0; i < r.extraPerWave; i++) {
        const src = w[i % w.length];
        extra.push({ type: i % 2 ? 'grunt' : 'knife', dx: Math.round(-src.dz * 90) / 100, dz: Math.round(src.dx * 90) / 100 });
      }
      return [...w, ...extra];
    }),
  };
}
```

- [ ] **Step 4: Write `src/postgame/ngPlus.js`**

```js
// New Game Plus, as numbers. Pure.
// A cycle is the New Game Plus run being played (1 to NG_MAX; 0 is the normal story). Each cycle's
// rules make the goons tougher (see src/combat/hardness.js). The gold suit, every gadget and every
// WayneTech upgrade come along.
import { newGameProgress } from '../core/save.js';
import { GADGET_IDS } from '../gadgets/gadgetDefs.js';
import { NORMAL_RULES } from '../combat/hardness.js';

export const NG_MAX = 3;
const CYCLES = [
  NORMAL_RULES,
  Object.freeze({ health: 1.5, damage: 1.35, windup: 0.8, gap: 0.8, maxWindups: 1, extraPerWave: 1 }),
  Object.freeze({ health: 1.75, damage: 1.5, windup: 0.72, gap: 0.72, maxWindups: 1, extraPerWave: 1 }),
  Object.freeze({ health: 2, damage: 1.65, windup: 0.65, gap: 0.65, maxWindups: 2, extraPerWave: 2 }),
];

export function ngRules(cycle) {
  const c = Number.isFinite(cycle) ? Math.max(0, Math.min(NG_MAX, Math.floor(cycle))) : 0;
  return CYCLES[c];
}

// New Game Plus is on while its story is being played (the credits end it).
export const ngActive = (p) => (p.postgame?.ngCycle ?? 0) > 0 && p.finished !== true;

// The title screen's two ways back into the story. Both keep everything found, every upgrade and
// every gadget ever unlocked (newGameProgress keeps them). New Game Plus also wears the gold
// suit, unlocks every gadget and turns the goons up one cycle past the best one cleared.
export function startNewGame(old, { plus = false } = {}) {
  const p = newGameProgress(old);
  // Plan 6D saves the story step's id too; a new game starts at the intro, not at the old step.
  if ('stepId' in p) p.stepId = null;
  p.postgame = { ...p.postgame, ngCycle: plus ? Math.min(NG_MAX, p.postgame.ngCleared + 1) : 0 };
  if (plus) {
    p.suit = 'gold';
    if (p.gadgets) p.gadgets = { ...p.gadgets, unlocked: [...GADGET_IDS] };
  }
  return p;
}

// The title button for the next run, given the best cycle cleared so far.
export const ngLabel = (cleared) => (cleared >= 1 ? `New Game Plus ${Math.min(NG_MAX, cleared + 1)}` : 'New Game Plus');
```

- [ ] **Step 5: Write `src/postgame/postSave.js`**

```js
// Saved state for After the Party, first half (Plan 7H-1): progress.postgame, progress.crates and
// progress.guests. Registers the fields at load, so game.js imports this module (through
// partyRegistry.js) before loadProgress runs. Pure.
//   postgame: { cleared: the credits have rolled at least once, introSeen, hatOn,
//               ngCycle: the New Game Plus run being played (0 = none), ngCleared: best cycle finished }
//   crates:   opened crate ids          guests: rescued guest ids
import { registerProgressField } from '../core/save.js';
import { CRATE_IDS } from './crateSpots.js';
import { GUEST_IDS } from './guests.js';
import { NG_MAX } from './ngPlus.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v) => (Number.isInteger(v) ? Math.max(0, Math.min(NG_MAX, v)) : 0);

export function sanitizePostgame(raw) {
  const r = isObj(raw) ? raw : {};
  return { cleared: r.cleared === true, introSeen: r.introSeen === true, hatOn: r.hatOn !== false, ngCycle: count(r.ngCycle), ngCleared: count(r.ngCleared) };
}

export function idsFrom(raw, allowed) {
  return Array.isArray(raw) ? [...new Set(raw.filter((s) => allowed.includes(s)))] : [];
}

registerProgressField('postgame', { sanitize: sanitizePostgame });
registerProgressField('crates', { sanitize: (raw) => idsFrom(raw, CRATE_IDS) });
registerProgressField('guests', { sanitize: (raw) => idsFrom(raw, GUEST_IDS) });
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/ngPlus.test.js tests/unit/postSave.test.js tests/unit/saveContent.test.js`
Expected: PASS. (3C's `saveContent.test.js` compares `sanitizeProgress({})` with `DEFAULT_PROGRESS`; it does not import `postSave.js`, so the new fields don't appear there.)

- [ ] **Step 7: Commit**

```bash
git add src/combat/hardness.js src/postgame/ngPlus.js src/postgame/postSave.js tests/unit/ngPlus.test.js tests/unit/postSave.test.js
git commit -m "Post-game save fields, goon hardness rules and New Game Plus cycles"
```

---

### Task 4: The After the Party model, Progress categories and activities (pure)

**Files:**
- Create: `src/postgame/afterPartyModel.js`, `src/postgame/partyRegistry.js`
- Test: `tests/unit/afterParty.test.js` (new)

**Interfaces:**
- Consumes: `tracker`, `BASE_CATEGORIES`, `storyCount`, `chapterOf` (3C `progressTracker.js`); `districtAt` (`mapData.js`); Tasks 1 to 3.
- Produces: everything listed for `afterPartyModel.js` and `partyRegistry.js` in Shared interfaces. Categories: `crates` (weight 8), `guests` (6), `ngPlus` (4), all `active` once `postgame.cleared`. The `story` category is re-registered under the same id so it reads as complete once the credits have rolled, even during a New Game Plus run (3C's registry replaces a category with the same id in place).

- [ ] **Step 1: Write the failing test.** Create `tests/unit/afterParty.test.js`:

```js
import { describe, it, expect } from 'vitest';
import '../../src/postgame/partyRegistry.js';
import MANSI from '../../src/mansi.config.js';
import { sanitizeProgress } from '../../src/core/save.js';
import { STEPS } from '../../src/game/story.js';
import { tracker } from '../../src/game/progressTracker.js';
import { CRATE_IDS } from '../../src/postgame/crateSpots.js';
import { GUEST_IDS, guestById } from '../../src/postgame/guests.js';
import {
  registerActivity, activityList, afterPartyRows, allTargets, nearestTarget, objectiveLine, mapExtras, targetPos, MARKER_KINDS,
} from '../../src/postgame/afterPartyModel.js';

const done = (o = {}) => sanitizeProgress({ step: STEPS.length - 1, finished: true, postgame: { cleared: true }, ...o });
const part = (p, id) => tracker.score(p).parts.find((x) => x.id === id);

describe('Progress tracker', () => {
  it('post-game categories stay out until the credits roll', () => {
    const ids = tracker.score(sanitizeProgress({ step: 5 })).parts.map((x) => x.id);
    for (const id of ['crates', 'guests', 'ngPlus']) expect(ids).not.toContain(id);
    const after = tracker.score(done()).parts.map((x) => x.id);
    for (const id of ['crates', 'guests', 'ngPlus']) expect(after).toContain(id);
  });
  it('counts crates, guests and New Game Plus', () => {
    const p = done({ crates: ['crateHotel', 'crateJazz'], guests: ['dj'], postgame: { cleared: true, ngCleared: 1 } });
    expect(part(p, 'crates')).toMatchObject({ done: 2, total: 20, weight: 8, detail: '2 of 20 opened' });
    expect(part(p, 'guests')).toMatchObject({ done: 1, total: 6, weight: 6, detail: '1 of 6 at the rooftop party' });
    expect(part(p, 'ngPlus')).toMatchObject({ done: 1, total: 1, weight: 4, detail: 'Finished in gold' });
    expect(part(done({ crates: CRATE_IDS, unlocks: ['partyHat'] }), 'crates').detail).toBe("All 20 opened. Harley's Party Hat is yours.");
  });
  it('the story row stays complete during New Game Plus', () => {
    const p = sanitizeProgress({ step: 5, postgame: { cleared: true, ngCycle: 1 } });
    expect(part(p, 'story')).toMatchObject({ fraction: 1, detail: 'New Game Plus, chapter 2: The Docks' });
    expect(part(sanitizeProgress({ step: 5 }), 'story').fraction).toBeLessThan(1);
  });
});

describe('activities', () => {
  it('rows in order with their status', () => {
    const rows = afterPartyRows(done({ crates: ['crateHotel'] }));
    expect(rows.map((r) => r.id).slice(0, 2)).toEqual(['crates', 'guests']);
    expect(rows.at(-1).id).toBe('ngPlus');
    expect(rows[0]).toEqual({ id: 'crates', label: 'Joker crates', done: 1, total: 20, complete: false, status: '1 of 20 opened' });
    expect(rows.at(-1).status).toBe('Start it from the title screen');
  });
  it('crate targets only in visited districts, races from their clock crate, every missing guest', () => {
    const t = allTargets(done({ districts: ['neon'], crates: ['crateHotel'] }), []);
    const ids = t.map((x) => x.id);
    expect(ids).toContain('crateJazz');
    expect(ids).not.toContain('crateHotel');
    expect(ids).not.toContain('crateDocksZip');
    expect(t.find((x) => x.id === 'raceNeonSprint')).toMatchObject({ kind: 'race', x: 150, y: 0, z: -60, near: 60 });
    expect(t.find((x) => x.id === 'crateJazz')).toMatchObject({ kind: 'crate', near: 40 });
    expect(ids.filter((id) => id.startsWith('guest:'))).toHaveLength(6);
    expect(allTargets(done({ districts: ['gcpd'] }), []).map((x) => x.id)).toContain('raceGcpdDrop');
    for (const x of t) expect(MARKER_KINDS).toContain(x.kind);
  });
  it('the objective line names the nearest target', () => {
    const p = done({ districts: ['neon'], crates: ['crateHotel'] });
    const g = guestById('grandma');
    expect(objectiveLine(p, { x: 150, y: 0, z: 0 }, allTargets(p, []))).toBe(`After the Party. Nearest: ${g.name}, ${MANSI.name}'s biggest fan, 39 m.`);
  });
  it('a live position wins over the data', () => {
    const t = { id: 'crateDocksZip', x: 0, y: 0, z: 0 };
    expect(targetPos(t, (id) => (id === 'crateDocksZip' ? { x: 5, y: 6, z: 7 } : null))).toEqual({ x: 5, y: 6, z: 7 });
    expect(targetPos(t, null)).toBe(t);
    expect(nearestTarget([], { x: 0, y: 0, z: 0 })).toBe(null);
  });
  it('complete, and nothing left to point at', () => {
    const all = done({ crates: CRATE_IDS, guests: GUEST_IDS, unlocks: ['partyHat'], postgame: { cleared: true, ngCleared: 1 } });
    expect(objectiveLine(all, { x: 0, y: 0, z: 0 }, allTargets(all, []))).toBe(`After the Party is complete. Thank you for playing, ${MANSI.name}!`);
    const none = done({ guests: GUEST_IDS });
    expect(objectiveLine(none, { x: 0, y: 0, z: 0 }, allTargets(none, []))).toBe('After the Party: explore Gotham. Detective vision helps.');
  });
  it('map pins', () => {
    expect(mapExtras(done({ districts: ['neon'], crates: ['crateHotel'] }))[0]).toEqual({ id: 'crateJazz', kind: 'crate', x: 131, z: 76 });
  });
  it('the registry validates, replaces by id and undoes', () => {
    expect(() => registerActivity({})).toThrow();
    expect(() => registerActivity({ id: 'x' })).toThrow();
    const undo = registerActivity({ id: 'test', label: 'Test', order: 50, count: () => ({ done: 0, total: 1 }) });
    expect(activityList().map((a) => a.id)).toContain('test');
    expect(afterPartyRows(done()).find((r) => r.id === 'test').status).toBe('0 of 1');
    undo();
    expect(activityList().map((a) => a.id)).not.toContain('test');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/afterParty.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/postgame/afterPartyModel.js`**

```js
// After the Party's objective list and map markers, as a registry of activities. Pure.
// Each post-game feature registers one activity at load (partyRegistry.js in Plan 7H-1,
// showdownRegistry.js in Plan 7H-2), so nothing here changes when a feature arrives.
// Activity: { id, label, order, count(p) -> { done, total }, status?(p) -> string, targets?(p) -> Target[] }
// Target:   { id, kind, label, x, y, z, near }   near: on-screen marker range in meters
import MANSI from '../mansi.config.js';

export const MARKER_KINDS = ['crate', 'race', 'guest', 'bomb', 'army', 'encore', 'crashers'];
const acts = [];

export function registerActivity(a) {
  if (!a || typeof a.id !== 'string' || !a.id) throw new Error('activity needs an id');
  if (typeof a.count !== 'function') throw new Error(`activity ${a.id} needs count(progress)`);
  const i = acts.findIndex((x) => x.id === a.id);
  if (i >= 0) acts[i] = a; else acts.push(a);
  acts.sort((x, y) => (x.order ?? 99) - (y.order ?? 99));
  return () => { const j = acts.indexOf(a); if (j >= 0) acts.splice(j, 1); };
}
export const activityList = () => acts.slice();

export function afterPartyRows(p) {
  return acts.map((a) => {
    const { done, total } = a.count(p);
    return { id: a.id, label: a.label, done, total, complete: done >= total, status: a.status ? a.status(p) : `${done} of ${total}` };
  });
}

// Every open target, written into `out` (reused by the caller).
export function allTargets(p, out = []) {
  out.length = 0;
  for (const a of acts) if (a.targets) for (const t of a.targets(p)) out.push(t);
  return out;
}

// `live(id)` may give a better position than the data (a zip crate under its real cable).
export const targetPos = (t, live = null) => (live && live(t.id)) || t;

export function nearestTarget(targets, pos, live = null) {
  let best = null, bd = Infinity;
  for (const t of targets) {
    const q = targetPos(t, live);
    const d = Math.hypot(q.x - pos.x, q.y - pos.y, q.z - pos.z);
    if (d < bd) { bd = d; best = t; }
  }
  return best ? { target: best, dist: bd } : null;
}

export function objectiveLine(p, pos, targets, live = null) {
  if (afterPartyRows(p).every((r) => r.complete)) return `After the Party is complete. Thank you for playing, ${MANSI.name}!`;
  const n = nearestTarget(targets, pos, live);
  if (!n) return 'After the Party: explore Gotham. Detective vision helps.';
  return `After the Party. Nearest: ${n.target.label}, ${Math.round(n.dist)} m.`;
}

// Pins for the Progress map and the After the Party page.
export const mapExtras = (p) => allTargets(p, []).map((t) => ({ id: t.id, kind: t.kind, x: t.x, z: t.z }));
```

- [ ] **Step 4: Write `src/postgame/partyRegistry.js`**

```js
// Registers the first half of After the Party (Plan 7H-1) at load: its saved fields (through
// postSave.js), its Progress tracker categories, and its objective-list activities. game.js
// imports this before loadProgress. Also keeps the tracker's story row complete once the credits
// have rolled, so starting New Game Plus doesn't knock the percentage down. Pure.
import './postSave.js';
import { tracker, BASE_CATEGORIES, storyCount, chapterOf } from '../game/progressTracker.js';
import { districtAt } from '../world/mapData.js';
import { registerActivity } from './afterPartyModel.js';
import { CRATES, CRATE_IDS, HAT_UNLOCK } from './crateSpots.js';
import { GUESTS, GUEST_IDS, partyStatus } from './guests.js';
import { ngActive } from './ngPlus.js';

export const POST_WEIGHTS = { crates: 8, guests: 6, ngPlus: 4 };
const cleared = (p) => p.postgame.cleared;
const crateTarget = (c) => (c.kind === 'race'
  ? { id: c.id, kind: 'race', label: 'A race crate', x: c.race.from.x, y: c.race.from.y, z: c.race.from.z, near: 60 }
  : { id: c.id, kind: 'crate', label: 'A Joker crate', x: c.x, y: c.y, z: c.z, near: 40 });

const story = BASE_CATEGORIES.find((c) => c.id === 'story');
tracker.register({
  ...story,
  count: (p) => (cleared(p) ? storyCount({ ...p, finished: true }) : story.count(p)),
  detail: (p) => (ngActive(p) ? `New Game Plus, chapter ${chapterOf(p.step).number}: ${chapterOf(p.step).name}` : cleared(p) ? 'Complete' : story.detail(p)),
});

tracker.register({
  id: 'crates', label: 'Joker crates', weight: POST_WEIGHTS.crates, active: cleared,
  count: (p) => ({ done: p.crates.length, total: CRATE_IDS.length }),
  detail: (p) => (p.unlocks.includes(HAT_UNLOCK) ? "All 20 opened. Harley's Party Hat is yours." : `${p.crates.length} of ${CRATE_IDS.length} opened`),
});
tracker.register({
  id: 'guests', label: 'Missing guests', weight: POST_WEIGHTS.guests, active: cleared,
  count: (p) => ({ done: p.guests.length, total: GUEST_IDS.length }),
  detail: (p) => partyStatus(p.guests.length),
});
tracker.register({
  id: 'ngPlus', label: 'New Game Plus', weight: POST_WEIGHTS.ngPlus, active: cleared,
  count: (p) => ({ done: p.postgame.ngCleared > 0 ? 1 : 0, total: 1 }),
  detail: (p) => (p.postgame.ngCleared > 0 ? 'Finished in gold' : 'Start it from the title screen'),
});

registerActivity({
  id: 'crates', label: 'Joker crates', order: 10,
  count: (p) => ({ done: p.crates.length, total: CRATE_IDS.length }),
  status: (p) => (p.unlocks.includes(HAT_UNLOCK) ? 'All opened. Party hat unlocked!' : `${p.crates.length} of ${CRATE_IDS.length} opened`),
  // Crates stay a hunt: only districts already visited show theirs (a race shows at its clock crate).
  targets: (p) => CRATES.filter((c) => !p.crates.includes(c.id)).map(crateTarget).filter((t) => p.districts.includes(districtAt(t.x, t.z))),
});
registerActivity({
  id: 'guests', label: 'Missing guests', order: 20,
  count: (p) => ({ done: p.guests.length, total: GUEST_IDS.length }),
  status: (p) => partyStatus(p.guests.length),
  targets: (p) => GUESTS.filter((g) => !p.guests.includes(g.id)).map((g) => ({
    id: `guest:${g.id}`, kind: 'guest', label: `${g.name}, ${g.role}`, x: g.captive.x, y: g.captive.y, z: g.captive.z, near: 600,
  })),
});
registerActivity({
  id: 'ngPlus', label: 'New Game Plus', order: 90,
  count: (p) => ({ done: p.postgame.ngCleared > 0 ? 1 : 0, total: 1 }),
  status: (p) => (p.postgame.ngCleared > 0 ? 'Finished in gold' : 'Start it from the title screen'),
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/afterParty.test.js tests/unit/progressTracker.test.js`
Expected: PASS. 3C's tracker tests don't import the registry, so they still see six base categories.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/afterPartyModel.js src/postgame/partyRegistry.js tests/unit/afterParty.test.js
git commit -m "After the Party model: objective list registry, targets, map pins and Progress categories"
```

---
### Task 5: Harder goons in combat, and extra goons through encounters

**Files:**
- Modify: `src/combat/combatSystem.js`, `src/game/encounters.js`
- Test: `tests/unit/encounters.test.js` (3C, modify)

**Interfaces:**
- Consumes: `NORMAL_RULES`, `scaleDifficulty` (Task 3); 5FG's `damageFactor(kind, effects)` line and `effects.counterWindow` in `combatSystem.js`; 3C's `createEncounters` (with Plan 6D's `stealth` option, which this task leaves alone).
- Produces: `combat.setHardness(rules)`, `combat.hardness`; `createEncounters({ shape })`, where `shape(def, id)` rewrites a fight definition every time `begin` runs.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/encounters.test.js` (3C; it already defines `def` and imports `createEvents` and `createEncounters`):

```js
describe('shaping fights (New Game Plus)', () => {
  it('shape rewrites the definition at begin and again on restart', () => {
    const events = createEvents();
    const made = [];
    const spawn = (type, p) => { const e = { type, pos: { ...p }, alive: true, aware: false, wake() { this.aware = true; } }; made.push(e); return e; };
    const seen = [];
    const shape = (d, id) => { seen.push(id); return { ...d, waves: [[...d.waves[0], { type: 'knife', dx: 0, dz: 2 }]] }; };
    const enc = createEncounters({ spawn, despawn: () => {}, combat: { setEnemies() {} }, events, collision: { groundBelow: () => 0 }, shape });
    enc.begin('guest:dj', def);
    expect(made.map((e) => e.type)).toEqual(['grunt', 'knife']);
    enc.restart();
    expect(made.map((e) => e.type)).toEqual(['grunt', 'knife', 'grunt', 'knife']);
    expect(seen).toEqual(['guest:dj', 'guest:dj']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/encounters.test.js`
Expected: FAIL (`shape` is ignored, so only the grunt is made).

- [ ] **Step 3: Shaping in `src/game/encounters.js`.** Add `shape = null` to `createEncounters`'s options (next to 6D's `stealth = null`). In `begin`, replace `fight = fightDef;` with:

```js
      // New Game Plus adds goons to every wave (src/combat/hardness.js hardenFight).
      fight = shape ? shape(fightDef, fightId) : fightDef;
```
`def` keeps the unshaped definition, so `restart()` shapes it again rather than twice. A 6D `stealth` fight passes through `shape` too; `hardenFight` only appends entries to its one wave, which 6D spawns like the others.

- [ ] **Step 4: Hardness in `src/combat/combatSystem.js`.** Import `import { NORMAL_RULES, scaleDifficulty } from './hardness.js';`. Replace the two lines that pick the difficulty and build the director:

```js
  let difficulty = getDifficulty();
  const director = createDirector({ ...DIFFICULTY[difficulty], rng });
```
with:
```js
  let difficulty = getDifficulty();
  // Harder goons (New Game Plus, the survival arena): one rules object scales the difficulty row.
  let hard = NORMAL_RULES;
  let tuned = scaleDifficulty(DIFFICULTY[difficulty], hard);
  const director = createDirector({ ...tuned, rng });
  const retune = () => { tuned = scaleDifficulty(DIFFICULTY[difficulty], hard); director.configure(tuned); };
```
Then:
- `setDifficulty(d) { difficulty = d; director.configure(DIFFICULTY[d]); },` becomes `setDifficulty(d) { difficulty = d; retune(); },`
- in `update`, `if (d !== difficulty) { difficulty = d; director.configure(DIFFICULTY[d]); }` becomes `if (d !== difficulty) { difficulty = d; retune(); }`
- in `onAttackLand`, 5FG's damage line becomes:
```js
    const dmg = Math.round(damageToHero(kind, { difficulty, blocking }) * damageFactor(kind, effects) * hard.damage * 100) / 100;
```
- in the director loop, 5FG's wind-up line becomes:
```js
        if (e) e.startWindup(tuned.windup + (e.def.counterable ? effects.counterWindow : 0), hero);
```
- add to the returned object, next to `setDifficulty`:
```js
    // rules: src/combat/hardness.js. Health is scaled at spawn (game.js), extra goons by encounters.
    setHardness(r) { hard = r ?? NORMAL_RULES; retune(); },
    get hardness() { return hard; },
```
`tuned` is rebuilt only when the difficulty or the rules change, never per frame. (6D's rifle shot damage goes through `onAttackLand` with kind `rifle`, so it scales too.) If a quoted line reads differently after 4E, 5FG and 6D, find the line with the same job and make the same change there.

- [ ] **Step 5: Run all unit tests**

Run: `npx vitest run`
Expected: PASS, including every older combat, encounters and stealth test (the rules default to `NORMAL_RULES`, so nothing changes until something calls `setHardness`).

- [ ] **Step 6: Commit**

```bash
git add src/game/encounters.js src/combat/combatSystem.js tests/unit/encounters.test.js
git commit -m "Harder goons: a hardness rules object in combat and a fight shaping hook in encounters"
```

---

### Task 6: Flow and side-content hooks: comic pages in free roam, busy, merged flow hooks

**Files:**
- Create: `src/game/flowHooks.js`
- Modify: `src/game/flow.js`, `src/game/sideContent.js`
- Test: `tests/unit/flowHooks.test.js` (new)

**Interfaces:**
- Consumes: 3C's `createFlow({ side })` and `createSideContent`.
- Produces: `mergeFlowHooks(...providers)`; `flow.playPages(pages)`; `createSideContent({ busy })`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/flowHooks.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { mergeFlowHooks } from '../../src/game/flowHooks.js';

describe('mergeFlowHooks', () => {
  it('holds the story if any provider does', () => {
    const h = mergeFlowHooks({ holdStory: () => false }, { holdStory: () => true });
    expect(h.holdStory()).toBe(true);
    expect(mergeFlowHooks({ holdStory: () => false }, {}).holdStory()).toBe(false);
  });
  it('the first marker wins', () => {
    const a = { x: 1, y: 2, z: 3 };
    expect(mergeFlowHooks({ marker: () => null }, { marker: () => a }, { marker: () => ({ x: 9 }) }).marker()).toBe(a);
    expect(mergeFlowHooks({}, {}).marker()).toBe(null);
  });
  it('every provider hears a respawn; the first spot wins', () => {
    const one = vi.fn(() => null), two = vi.fn(() => ({ x: 5 })), three = vi.fn(() => ({ x: 7 }));
    expect(mergeFlowHooks({ onRespawn: one }, { onRespawn: two }, { onRespawn: three }).onRespawn()).toEqual({ x: 5 });
    expect([one, two, three].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
    expect(mergeFlowHooks({}).onRespawn()).toBe(null);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/flowHooks.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/game/flowHooks.js`**

```js
// Several providers of the story flow's side hooks (3C's side content, After the Party) as one.
// Called every frame, so plain loops: no closures or arrays per call. Pure.
export function mergeFlowHooks(...list) {
  return {
    holdStory() {
      for (let i = 0; i < list.length; i++) if (list[i].holdStory?.()) return true;
      return false;
    },
    marker() {
      for (let i = 0; i < list.length; i++) { const m = list[i].marker?.(); if (m) return m; }
      return null;
    },
    // Every provider cleans up after a knockout; the first one with a place to stand wins.
    onRespawn() {
      let spot = null;
      for (let i = 0; i < list.length; i++) { const r = list[i].onRespawn?.(); if (r && !spot) spot = r; }
      return spot;
    },
  };
}
```

- [ ] **Step 4: Comic pages over free roam in `src/game/flow.js`.** Add to the returned object, after `freeRoam()`:

```js
    // A comic over free roam (After the Party's intro and reward pages): play pauses like a cutscene.
    async playPages(pages) {
      if (mode !== 'play' || !pages.length) return;
      mode = 'cutscene';
      document.exitPointerLock?.();
      hud.setVisible(false);
      events.emit('cutscene', { name: 'pages', on: true });
      await comic.play(pages);
      hud.setVisible(true);
      events.emit('cutscene', { name: 'pages', on: false });
      mode = 'play';
    },
```

- [ ] **Step 5: `busy` in `src/game/sideContent.js`.** Destructure `busy = () => false` from `deps`. In the challenge runner's `canStart`, append `&& !busy()` to the condition. In the crime director's `blocked`, make it:

```js
      blocked: () => busy() || crimeBlocked({ mode: flow.mode, stepType: stepType(), challenge: challenges.active, fightId: encounters.id }),
```
While a post-game race, rescue or (Plan 7H-2) bomb is running, pillars show "Not now" and no street crime starts.

- [ ] **Step 6: Run all unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/flowHooks.js src/game/flow.js src/game/sideContent.js tests/unit/flowHooks.test.js
git commit -m "Flow hooks for the post-game: comic pages in free roam, busy side content, merged side hooks"
```

---

### Task 7: Code-drawn props, party hats and the warm-up

**Files:**
- Create: `src/postgame/postProps.js`
- Modify: `src/game/warmCast.js`

**Interfaces:**
- Consumes: `toonMaterial`, `addHullOutline` (`src/render/toon.js`), `LAYER_FX`, `LAYER_XRAY`, `PALETTE`, `attachRigid` (`src/actors/rig.js`), `createCake` (`src/world/storyProps.js`), a character's `lm` and `body` (`makeCharacter`).
- Produces: `HARLEY`, `GUEST_HATS`, `HAT_LIFT`, `HAT_FORWARD`, `HAT_TILT`, `createJokerCrate(face, { hang })`, `createPartyHat(colors)`, `attachHat(ch, hat)`, `createRopeRing()`, `createRoofPartyKit()`, `createPostWarm()`.

- [ ] **Step 1: Write `src/postgame/postProps.js`**

```js
// Code-drawn props for After the Party: the Joker crate (a "?" face or a clock face), party hats
// (Harley's red and black one for the cowl, one per guest), the captive's rope, the rooftop party
// kit on GCPD, and a warm-up group with one of each. Materials, geometries and canvas textures are
// made once and shared, so the warm copies drawn at boot compile and upload exactly what the run
// uses.
import * as THREE from 'three';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { LAYER_FX, LAYER_XRAY } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';
import { attachRigid } from '../actors/rig.js';
import { createCake } from '../world/storyProps.js';

export const HARLEY = { a: '#c8323c', b: '#15151c', pom: '#f4f0e6' };
export const GUEST_HATS = [
  { a: '#f2d24b', b: '#6c3fa3', pom: '#ff4fa3' },
  { a: '#ff9ec8', b: '#f4f0e6', pom: '#c8323c' },
  { a: '#4fe3ff', b: '#15151c', pom: '#f2d24b' },
  { a: '#62c141', b: '#f2d24b', pom: '#6c3fa3' },
  { a: '#ff4fa3', b: '#4fe3ff', pom: '#f4f0e6' },
  { a: '#6c3fa3', b: '#62c141', pom: '#f2d24b' },
];
// Where a hat sits, in the head's bind space: relative to the top of the head, a little back,
// tipped back and to one side like it was put on in a hurry.
export const HAT_LIFT = -0.02, HAT_FORWARD = -0.015, HAT_TILT = 0.22;

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function crateFace(g, w, h, face) {
  g.fillStyle = '#6c3fa3';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#62c141';
  for (let i = 0; i < 6; i++) {
    const x = (i + 0.5) * (w / 6);
    for (const y of [14, h - 14]) {
      g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.closePath(); g.fill();
    }
  }
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeRect(4, 4, w - 8, h - 8);
  if (face === 'clock') {
    g.fillStyle = '#f4f0e6';
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.28, 0, Math.PI * 2); g.fill();
    g.lineWidth = 6;
    g.stroke();
    g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2, h / 2 - w * 0.2); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + w * 0.14, h / 2 + 4); g.stroke();
  } else {
    g.font = `${Math.round(h * 0.62)}px Bangers, Impact, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 10;
    g.strokeText('?', w / 2, h / 2 + 6);
    g.fillStyle = '#62c141';
    g.fillText('?', w / 2, h / 2 + 6);
  }
}
function stripes(g, w, h, c) {
  g.fillStyle = c.a;
  g.fillRect(0, 0, w, h);
  g.fillStyle = c.b;
  for (let x = -h; x < w; x += 24) {
    g.beginPath(); g.moveTo(x, h); g.lineTo(x + 12, h); g.lineTo(x + 12 + h, 0); g.lineTo(x + h, 0); g.closePath(); g.fill();
  }
}
function speakerFace(g, w, h) {
  g.fillStyle = '#1d2230';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f4f0e6';
  g.lineWidth = 4;
  for (const [y, r] of [[h * 0.3, w * 0.28], [h * 0.72, w * 0.36]]) { g.beginPath(); g.arc(w / 2, y, r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = '#0b0b12';
  g.lineWidth = 6;
  g.strokeRect(3, 3, w - 6, h - 6);
}

const inkLine = () => once('inkLine', () => new THREE.LineBasicMaterial({ color: PALETTE.ink }));
const crateMat = (face) => once(`crate:${face}`, () => toonMaterial({ map: canvasTex(128, 128, (g, w, h) => crateFace(g, w, h, face)), emissive: 0x1c0c2c }));
const crateGeo = () => once('crateGeo', () => new THREE.BoxGeometry(0.9, 0.9, 0.9).translate(0, 0.45, 0));
const xrayMat = () => once('crateXray', () => new THREE.MeshBasicMaterial({ color: PALETTE.jokerPurple, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false }));

// A purple Joker crate, 0.9 m, sitting on its origin. hang > 0 adds a rope that far up (zip crates).
export function createJokerCrate(face = 'plain', { hang = 0 } = {}) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(crateGeo(), crateMat(face));
  box.castShadow = true;
  addHullOutline(box, 0.03);
  const xray = new THREE.Mesh(crateGeo(), xrayMat());
  xray.layers.set(LAYER_XRAY);
  g.add(box, xray);
  if (hang > 0) {
    const geo = once(`rope:${hang}`, () => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 0.9 + hang, 0)]));
    const rope = new THREE.LineSegments(geo, inkLine());
    rope.layers.set(LAYER_FX);
    g.add(rope);
  }
  g.userData.box = box;
  return g;
}

export function createPartyHat(c) {
  const g = new THREE.Group();
  const coneGeo = once('hatGeo', () => new THREE.ConeGeometry(0.075, 0.2, 18, 1, true).translate(0, 0.1, 0));
  const cone = new THREE.Mesh(coneGeo, once(`hat:${c.a}${c.b}`, () => toonMaterial({ map: canvasTex(64, 64, (x, w, h) => stripes(x, w, h, c)), side: THREE.DoubleSide })));
  cone.castShadow = true;
  addHullOutline(cone, 0.006);
  const pom = new THREE.Mesh(once('pomGeo', () => new THREE.SphereGeometry(0.028, 10, 8).translate(0, 0.205, 0)), once(`pom:${c.pom}`, () => toonMaterial({ color: c.pom })));
  g.add(cone, pom);
  return g;
}

// Puts a hat on a character's head bone (hero.bat or a guest). Positioned in bind space, like the
// cowl's ears, so it follows every animation.
export function attachHat(ch, hat) {
  const { lm, body } = ch;
  hat.position.set(lm.headCenter.x, lm.headTop + HAT_LIFT, lm.headCenter.z + HAT_FORWARD * lm.fwd);
  hat.rotation.set(-HAT_TILT * lm.fwd, 0, 0.18);
  attachRigid(body, 'Head', hat);
  return hat;
}

export function createRopeRing() {
  const m = new THREE.Mesh(
    once('ropeGeo', () => new THREE.TorusGeometry(0.42, 0.045, 6, 22).rotateX(Math.PI / 2)),
    once('ropeMat', () => toonMaterial({ color: 0xc9a86a })),
  );
  addHullOutline(m, 0.015);
  return m;
}

// The rooftop party on GCPD, built around its own origin (put it at PARTY_CENTER): four bunting
// posts on a 12 m square with flags strung between them (one mesh, colored per vertex), a DJ
// table between two speakers, and a birthday cake on a little table. `lights` are string-light
// spots (relative to the origin) for the halo sprites.
export function createRoofPartyKit() {
  const group = new THREE.Group();
  const posts = [[-6, -6], [6, -6], [6, 6], [-6, 6]];
  const postGeo = once('postGeo', () => new THREE.CylinderGeometry(0.06, 0.08, 3.2, 6).translate(0, 1.6, 0));
  const postMat = once('postMat', () => toonMaterial({ color: PALETTE.steel }));
  for (const [x, z] of posts) { const m = new THREE.Mesh(postGeo, postMat); m.position.set(x, 0, z); group.add(m); }
  const colors = [PALETTE.balloon, PALETTE.signal, PALETTE.neonCyan, PALETTE.jokerPurple, PALETTE.neonPink, PALETTE.jokerGreen].map((c) => new THREE.Color(c));
  const pos = [], col = [], lights = [];
  for (let s = 0; s < 4; s++) {
    const [ax, az] = posts[s], [bx, bz] = posts[(s + 1) % 4];
    for (let k = 1; k < 12; k++) {
      const t = k / 12, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = 3.1 - Math.sin(t * Math.PI) * 0.7;
      const dx = ((bx - ax) / 12) * 0.35, dz = ((bz - az) / 12) * 0.35;
      pos.push(x - dx, y, z - dz, x + dx, y, z + dz, x, y - 0.55, z);
      const c = colors[(k + s) % colors.length];
      for (let v = 0; v < 3; v++) col.push(c.r, c.g, c.b);
      if (k % 4 === 2) lights.push([x, y + 0.1, z]);
    }
  }
  const flags = new THREE.BufferGeometry();
  flags.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  flags.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  group.add(new THREE.Mesh(flags, once('buntingMat', () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }))));
  const table = new THREE.Mesh(once('djGeo', () => new THREE.BoxGeometry(1.8, 0.9, 0.8).translate(0, 0.45, 0)), once('djMat', () => toonMaterial({ color: PALETTE.jokerPurple })));
  table.position.set(0, 0, -5);
  addHullOutline(table, 0.02);
  group.add(table);
  const spkGeo = once('spkGeo', () => new THREE.BoxGeometry(0.7, 1.3, 0.6).translate(0, 0.65, 0));
  const spkMat = once('spkMat', () => toonMaterial({ map: canvasTex(64, 128, speakerFace) }));
  for (const sx of [-1.5, 1.5]) {
    const s = new THREE.Mesh(spkGeo, spkMat);
    s.position.set(sx, 0, -5);
    addHullOutline(s, 0.02);
    group.add(s);
  }
  const stand = new THREE.Mesh(once('standGeo', () => new THREE.BoxGeometry(1.2, 0.9, 1.2).translate(0, 0.45, 0)), once('djMat', () => toonMaterial({ color: PALETTE.jokerPurple })));
  stand.position.set(4.2, 0, 3.5);
  addHullOutline(stand, 0.02);
  const cake = createCake();
  cake.scale.setScalar(0.6);
  cake.position.set(4.2, 0.9, 3.5);
  group.add(stand, cake);
  return { group, lights };
}

// One of everything above, parked below the city for the boot warm-up.
export function createPostWarm() {
  const g = new THREE.Group();
  const add = (o, x) => { o.position.set(60 + x, -50, 0); g.add(o); };
  add(createJokerCrate('plain', { hang: 1.1 }), 0);
  add(createJokerCrate('clock'), 2);
  add(createPartyHat(HARLEY), 4);
  GUEST_HATS.forEach((c, i) => add(createPartyHat(c), 5 + i));
  add(createRopeRing(), 12);
  add(createRoofPartyKit().group, 20);
  return g;
}
```

- [ ] **Step 2: Put them in the warm-up.** In `src/game/warmCast.js`, import `import { createPostWarm } from '../postgame/postProps.js';` and add, right before `return group;`:

```js
  // After the Party: Joker crates, party hats, the captive's rope and the rooftop party kit.
  group.add(createPostWarm());
```
Update the file's header comment to mention "the post-game props".

- [ ] **Step 3: Boot check.** Run `npx vitest run` (PASS; no node test imports the new module). Build, preview, and boot to the title screen and into a run:

```bash
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1" "$TEMP/g7a" '[
 {"eval":"new Promise((r) => { const f = () => (window.__game?.hero ? r(1) : setTimeout(f, 100)); f(); })"},
 {"wait":1500},{"shot":"t7-boot"}
]'
node scripts/load-time.mjs http://localhost:5212/ 40 1
```
Expected: `no console errors` (a typo in a canvas drawing or a bad material option shows up here, at boot, where the warm cast draws every prop once); `firstFrame` under 3.2 s and `compiled` within 30 ms of the last run before this task. The props themselves are looked at in Tasks 10 and 12, where they stand in the city.

- [ ] **Step 4: Commit**

```bash
git add src/postgame/postProps.js src/game/warmCast.js
git commit -m "Post-game props drawn in code: Joker crates, party hats, rope, rooftop party kit, warmed at boot"
```

---

### Task 8: Post HUD: world markers and the objective list

**Files:**
- Create: `src/ui/postHud.js`
- Modify: `src/ui/style.css`
- Test: `tests/unit/postHud.test.js` (new)

**Interfaces:**
- Consumes: `batSvgPath` (`src/config/batShape.js`), `MARKER_KINDS` (Task 4).
- Produces: `KIND_ICON`, `listCode(rows)`, `createPostHud(root)` -> `{ marker(id, x, y, visible, kind), hideMarkers(), list(rows), showList(on) }`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/postHud.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { KIND_ICON, listCode } from '../../src/ui/postHud.js';
import { MARKER_KINDS } from '../../src/postgame/afterPartyModel.js';

describe('post HUD', () => {
  it('has an icon for every marker kind', () => {
    for (const k of MARKER_KINDS) expect(KIND_ICON[k], k).toMatch(/<(path|rect|circle|ellipse)/);
  });
  it('the list code changes only when a count does', () => {
    const rows = [{ id: 'crates', done: 1, total: 20 }, { id: 'guests', done: 0, total: 6 }];
    const a = listCode(rows);
    expect(listCode(rows.map((r) => ({ ...r })))).toBe(a);
    expect(listCode([{ ...rows[0], done: 2 }, rows[1]])).not.toBe(a);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/postHud.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/ui/postHud.js`**

```js
// HUD for After the Party: ink markers over post-game targets (one code-drawn icon per kind) and
// a small objective list under the objective line. The DOM is touched only when something
// changes: a marker's transform when it moves a whole pixel, the list when a count changes.
import { batSvgPath } from '../config/batShape.js';

export const KIND_ICON = {
  crate: '<rect x="-8" y="-8" width="16" height="16" rx="2"/><path class="ln" d="M-3 -3 Q-3 -7 0 -7 Q3 -7 3 -4 Q3 -2 0 -1 V1.5"/><circle class="dot" cx="0" cy="5" r="1.4"/>',
  race: '<circle cx="0" cy="2" r="8"/><path class="ln" d="M0 2 V-3 M-2.5 -9 H2.5 M0 -9 V-6"/>',
  guest: '<path d="M-7 8 L0 -8 L7 8 Z"/><circle cx="0" cy="-9" r="2.2"/>',
  bomb: '<rect x="-8" y="0" width="16" height="7"/><rect x="-5" y="-5" width="10" height="5"/><path class="ln" d="M0 -5 V-9"/><circle cx="0" cy="-10.5" r="1.6"/>',
  army: '<ellipse cx="0" cy="-3" rx="6" ry="7"/><path class="ln" d="M0 4 Q-2 7 0 10"/>',
  encore: '<rect x="-6" y="-9" width="12" height="18" rx="1.5"/><path class="ln" d="M-3 -1 Q0 3 3 -1"/>',
  crashers: `<path d="${batSvgPath(0.18, 0, 0)}"/>`,
};

export const listCode = (rows) => rows.map((r) => `${r.id}:${r.done}/${r.total}`).join('|');

export function createPostHud(root) {
  const el = document.createElement('div');
  el.className = 'post-hud';
  el.innerHTML = '<div class="ph-list"><div class="ph-title">After the Party</div><div class="ph-rows"></div></div><div class="ph-markers"></div>';
  root.appendChild(el);
  const listEl = el.querySelector('.ph-list'), rowsEl = el.querySelector('.ph-rows'), marksEl = el.querySelector('.ph-markers');
  const marks = new Map();
  let code = '', listOn = false;
  return {
    marker(id, x, y, visible, kind) {
      let m = marks.get(id);
      if (!visible) {
        if (m?.shown) { m.el.style.display = 'none'; m.shown = false; }
        return;
      }
      if (!m) {
        const d = document.createElement('div');
        d.className = `ph-marker kind-${kind}`;
        d.innerHTML = `<svg viewBox="-12 -12 24 24">${KIND_ICON[kind] ?? KIND_ICON.crate}</svg>`;
        marksEl.appendChild(d);
        m = { el: d, x: -1e9, y: -1e9, shown: true };
        marks.set(id, m);
      }
      if (!m.shown) { m.el.style.display = ''; m.shown = true; }
      const rx = Math.round(x), ry = Math.round(y);
      if (rx !== m.x || ry !== m.y) { m.x = rx; m.y = ry; m.el.style.transform = `translate(${rx}px, ${ry}px)`; }
    },
    hideMarkers() { for (const m of marks.values()) if (m.shown) { m.el.style.display = 'none'; m.shown = false; } },
    list(rows) {
      const c = listCode(rows);
      if (c === code) return;
      code = c;
      rowsEl.textContent = '';
      for (const r of rows) {
        const row = document.createElement('div');
        row.className = `ph-row${r.complete ? ' done' : ''}`;
        const label = document.createElement('span');
        label.textContent = r.label;
        const n = document.createElement('b');
        n.textContent = `${r.done}/${r.total}`;
        row.append(label, n);
        rowsEl.appendChild(row);
      }
    },
    showList(on) {
      if (on === listOn) return;
      listOn = on;
      listEl.classList.toggle('show', on);
    },
  };
}
```

- [ ] **Step 4: Styles.** Append to `src/ui/style.css`:

```css
.post-hud .ph-list { position: absolute; left: 18px; top: 122px; display: none; min-width: 200px; padding: 6px 10px 8px; background: #fff8e6; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); transform: rotate(-0.6deg); }
.post-hud .ph-list.show { display: block; }
.ph-title { font: 400 18px Bangers, Impact, sans-serif; letter-spacing: 1px; color: var(--ink); }
.ph-row { display: flex; justify-content: space-between; gap: 12px; font: 15px 'Patrick Hand SC', cursive; color: var(--ink); }
.ph-row.done { text-decoration: line-through; opacity: 0.6; }
.ph-markers { position: absolute; inset: 0; pointer-events: none; }
.ph-marker { position: absolute; left: -14px; top: -14px; width: 28px; height: 28px; will-change: transform; }
.ph-marker svg { width: 28px; height: 28px; overflow: visible; }
.ph-marker svg * { fill: var(--c, #6c3fa3); stroke: var(--ink); stroke-width: 1.6; }
.ph-marker svg .ln { fill: none; stroke: #fff8e6; stroke-width: 1.8; }
.ph-marker svg .dot { fill: #fff8e6; stroke: none; }
.ph-marker.kind-crate, .ph-marker.kind-race { --c: #6c3fa3; }
.ph-marker.kind-guest { --c: #f2d24b; }
.ph-marker.kind-bomb { --c: #ff9ec8; }
.ph-marker.kind-army { --c: #62c141; }
.ph-marker.kind-encore { --c: #c8323c; }
.ph-marker.kind-crashers { --c: #4fe3ff; }
```
The list sits under the objective caption (`.hud-caption`). In Task 9's screenshot, check that it clears the objective line and the balloon counter; if not, change `top` only.

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/postHud.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/postHud.js src/ui/style.css tests/unit/postHud.test.js
git commit -m "Post HUD: code-drawn marker icons and the After the Party objective list"
```

---

### Task 9: After the Party glue: activation, the intro comic, objective line, list, markers

**Files:**
- Create: `src/postgame/afterParty.js`, `src/postgame/postPages.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Tasks 4, 6, 7, 8; `flow.playPages`, `flow.mode`; `side.challenges.active`, `side.ui`; `titleCard` (`src/ui/comicArt.js`); `stage.shot`; `hud.setObjective`; `combat.active`.
- Produces: `createAfterParty(deps)` (see Shared interfaces), `introPages(stage)`, `POST_RADIO`; `?post=1`; `window.__game.post`. On-screen markers at 30 Hz within each target's `near` range; the objective line every second in free roam; the list whenever nothing else is going on.

- [ ] **Step 1: Write `src/postgame/postPages.js`**

```js
// After the Party's comic page and the Joker's radio call that opens it (Plan 7H-2 adds the
// encore's reward page here).
import MANSI from '../mansi.config.js';
import { titleCard } from '../ui/comicArt.js';

export const POST_RADIO = {
  title: 'JOKER RADIO',
  text: 'Did you think the party was over, birthday bat? I hid twenty crates of surprises all over town and borrowed six of your guests. Find them before the cake goes stale! Ha ha ha!',
};

export function introPages(stage) {
  return [{
    layout: 'duo',
    panels: [
      { img: titleCard('AFTER THE PARTY', `The night isn't over yet, ${MANSI.name}.`) },
      {
        img: stage.shot({ cam: [2, 45.5, 22], look: [-8, 43, 8], fov: 50, hero: { at: [-6, 42, 12], yaw: 2.4, anim: 'Idle_Loop' } }),
        caption: 'Up on the GCPD roof, a radio crackles. It is laughing.', captionPos: 'bottom',
      },
    ],
  }];
}
```

- [ ] **Step 2: Write `src/postgame/afterParty.js`**

```js
// After the Party: the post-game world. It is on exactly when the credits have rolled
// (progress.finished). This glue owns the post-game systems (crates and guests here, Plan 7H-2's
// bombs, balloon army, encore and survival arena later), the objective line, the objective list,
// the world markers, the flow hooks and the pause page data. A system is a plain object with any
// of: update(dt, real, on), busy(), holdStory(), marker(), onRespawn(), music(), livePos(id).
import * as THREE from 'three';
import { saveProgress } from '../core/save.js';
import { allTargets, afterPartyRows, objectiveLine, targetPos } from './afterPartyModel.js';
import { HAT_UNLOCK } from './crateSpots.js';
import { createPostHud } from '../ui/postHud.js';
import { introPages, POST_RADIO } from './postPages.js';

const REFRESH_ON = ['crateOpened', 'guestRescued', 'districtVisited', 'unlock', 'afterPartyChanged'];
const RELINE_ON = ['balloon', 'challengeDone', 'challengeFail', 'crimeEnd', 'fightDone', 'cutscene'];

export function createAfterParty(deps) {
  const { hero, events, flow, hud, progress, storage, camera, comic, stage, side, combat, hudRoot } = deps;
  const save = () => saveProgress(storage, progress);
  const ui = createPostHud(hudRoot);
  const systems = [];
  const targets = [];
  const pages = [{ id: 'intro', title: 'After the Party', make: introPages }];
  const v = new THREE.Vector3();
  let dirty = true, lineT = 0, markT = 0, lastLine = '', introPlaying = false, wasOn = false;

  // A save from before this plan that already finished the story counts as cleared.
  if (progress.finished && !progress.postgame.cleared) { progress.postgame.cleared = true; save(); }

  const on = () => progress.finished === true;
  const busy = () => { for (let i = 0; i < systems.length; i++) if (systems[i].busy?.()) return true; return false; };
  const live = (id) => { for (let i = 0; i < systems.length; i++) { const p = systems[i].livePos?.(id); if (p) return p; } return null; };

  for (const ev of REFRESH_ON) events.on(ev, () => { dirty = true; lastLine = ''; });
  for (const ev of RELINE_ON) events.on(ev, () => { lastLine = ''; });
  events.on('step', ({ step }) => {
    if (step.type !== 'credits' || progress.postgame.cleared) return;
    progress.postgame.cleared = true;
    save();
  });

  function refresh() {
    dirty = false;
    ui.hideMarkers();
    allTargets(progress, targets);
    ui.list(afterPartyRows(progress));
  }

  // Markers at 30 Hz: each target within its `near` range, not the one Batman is standing at.
  function markers(real, show) {
    markT -= real;
    if (markT > 0) return;
    markT = 1 / 30;
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i];
      const q = targetPos(t, live);
      const d = Math.hypot(q.x - hero.pos.x, q.z - hero.pos.z);
      if (!show || d > t.near || d < 4) { ui.marker(t.id, 0, 0, false, t.kind); continue; }
      v.set(q.x, q.y + 2.2, q.z).project(camera);
      ui.marker(t.id, (v.x * 0.5 + 0.5) * innerWidth, (-v.y * 0.5 + 0.5) * innerHeight, v.z < 1, t.kind);
    }
  }

  function objective(real, calm) {
    lineT -= real;
    if (lineT > 0) return;
    lineT = 1;
    if (!calm) return;
    const text = objectiveLine(progress, hero.pos, targets, live);
    if (text !== lastLine) { lastLine = text; hud.setObjective(text); }
  }

  return {
    ui,
    get active() { return on(); },
    add(system) { systems.push(system); dirty = true; return system; },
    busy,
    livePos: live,
    refresh() { dirty = true; },
    music() { for (let i = 0; i < systems.length; i++) { const m = systems[i].music?.(); if (m) return m; } return null; },
    // Runs in the playing branch of game.js's update (dt is game time, real is wall time).
    update(dt, real) {
      const isOn = on();
      for (let i = 0; i < systems.length; i++) systems[i].update?.(dt, real, isOn);
      if (!isOn) {
        if (wasOn) { ui.hideMarkers(); ui.showList(false); }
        wasOn = false;
        return;
      }
      if (!wasOn) { wasOn = true; dirty = true; lastLine = ''; }
      if (dirty) refresh();
      const calm = flow.mode === 'play' && !busy() && !side.challenges.active && !combat.active && !hero.dead;
      markers(real, flow.mode === 'play' && !side.challenges.active);
      objective(real, calm);
      ui.showList(calm);
    },
    // After the credits close (and on every run that starts in free roam): the first time only,
    // the After the Party comic and the Joker's radio call.
    async start() {
      if (!on()) return;
      dirty = true;
      lastLine = '';
      if (progress.postgame.introSeen || introPlaying) return;
      introPlaying = true;
      const p = camera.position.clone(), q = camera.quaternion.clone();
      const list = introPages(stage);
      camera.position.copy(p);
      camera.quaternion.copy(q);
      await flow.playPages(list);
      progress.postgame.introSeen = true;
      save();
      side.ui.radio(POST_RADIO.title, POST_RADIO.text, 11000);
      events.emit('afterPartyOpen');
      introPlaying = false;
    },
    flowHooks: {
      holdStory() { for (let i = 0; i < systems.length; i++) if (systems[i].holdStory?.()) return true; return false; },
      marker() { for (let i = 0; i < systems.length; i++) { const m = systems[i].marker?.(); if (m) return m; } return null; },
      onRespawn() {
        let spot = null;
        for (let i = 0; i < systems.length; i++) { const r = systems[i].onRespawn?.(); if (r && !spot) spot = r; }
        return spot;
      },
    },
    // Reward and story pages readable again from the After the Party page (7H-2 adds the encore).
    pages,
    addPage(entry) { pages.push(entry); },
    // Data for the pause menu's After the Party page (Task 14 adds the map).
    page() {
      return {
        rows: afterPartyRows(progress),
        hat: { unlocked: progress.unlocks.includes(HAT_UNLOCK), on: progress.postgame.hatOn },
        pages: pages.map((x) => ({ id: x.id, title: x.title })),
      };
    },
    get debug() {
      return { on: on(), busy: busy(), targets: targets.length, line: lastLine, rows: afterPartyRows(progress).map((r) => `${r.id} ${r.done}/${r.total}`) };
    },
  };
}
```

- [ ] **Step 3: Wire it in `src/game/game.js`.**
  - Imports. `partyRegistry.js` registers saved fields and must load before `loadProgress`, so put it next to 5FG's `import '../gadgets/gadgetSave.js';` and `import '../progress/wayneSave.js';`:

```js
import '../postgame/partyRegistry.js';
import { createAfterParty } from '../postgame/afterParty.js';
import { mergeFlowHooks } from './flowHooks.js';
```
  - Right after the `if (params.has('at')) { ... }` block that picks the start step, add:

```js
  // ?post=1: the credits have rolled for this run (After the Party is on, its intro already seen).
  if (params.get('post') === '1') progress = { ...progress, finished: true, postgame: { ...progress.postgame, cleared: true, introSeen: true } };
```
  - In `buildRun`, just before `const side = createSideContent({`, add `let post = null;` and pass `busy: () => post?.busy() ?? false,` into `createSideContent({...})`.
  - Replace `Object.assign(sideHooks, side.flowHooks);` with:

```js
    post = createAfterParty({
      hero, events, flow, hud, progress, storage, camera, comic, stage, side, combat, encounters,
      hudRoot: hudRoot.querySelector('.hud') ?? hudRoot,
    });
    Object.assign(sideHooks, mergeFlowHooks(post.flowHooks, side.flowHooks));
```
  - In `update`, right after `side.update(dt, real, { toScreen });` add `post.update(dt, real);`.
  - In `onCredits`, the credits `onClose` (5FG made it `() => { menus.hide(); input.setEnabled(true); flow.freeRoam(); gadgets.unlockCheck(); }`) gains `post.start();` at the end.
  - In `begin()`, right after `game.flow.start();` add `game.post.start();` (a save that lands straight in free roam gets the intro the first time).
  - Add `post` to the `api` object.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Scripted check.** Build, preview, then:

```bash
cat > "$TEMP/g7a-t9.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"wait": 2500},
 {"eval": "const G = window.__game; [G.post.active, JSON.stringify(G.post.debug.rows), G.post.debug.targets, document.querySelector('.hud-caption .obj').textContent]"},
 {"eval": "document.querySelector('.ph-list').classList.contains('show')"},
 {"eval": "document.querySelectorAll('.ph-marker.kind-guest').length"},
 {"shot": "t9-after-party"},
 {"eval": "const G = window.__game; G.progress.postgame.introSeen = false; G.post.start(); 'intro'", "wait": 1500},
 {"eval": "window.__game.comic.playing"},
 {"shot": "t9-intro"},
 {"eval": "window.__game.comic.skip()", "wait": 1200},
 {"eval": "[window.__game.flow.mode, window.__game.progress.postgame.introSeen, document.querySelector('.radio.show .radio-title')?.textContent ?? null]"},
 {"shot": "t9-radio"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1" "$TEMP/g7a" "$(cat "$TEMP/g7a-t9.json")"
```

Expected:
- `[true, "[\"crates 0/20\",\"guests 0/6\",\"ngPlus 0/1\"]", 6, "After the Party. Nearest: ..."]` (6 targets: the six guests; no crates yet because `?new=1` has no visited districts, and the GCPD district is added within a second of standing on its roof, which raises the target count on the next refresh).
- The list is showing (`true`) and at least one guest marker exists.
- `t9-after-party.png`: the "After the Party" list under the objective caption, clear of the objective line and the balloon counter (if it overlaps, change `.post-hud .ph-list { top }` and rebuild), and yellow party-hat markers toward the guests.
- The comic is playing (`true`) and `t9-intro.png` shows the AFTER THE PARTY title card and the GCPD roof panel with its caption.
- After skipping: `["play", true, "JOKER RADIO"]` and `t9-radio.png` shows the radio caption.
- `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/afterParty.js src/postgame/postPages.js src/game/game.js
git commit -m "After the Party: the post-game switches on after the credits, with its intro comic, objective list and markers"
```

---
### Task 10: Joker crates at run time, races, and Harley's party hat on the cowl

**Files:**
- Create: `src/postgame/crates.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Task 1 (`CRATES`, `CRATE_PRIZES`, `NOTE`, `HAT_UNLOCK`, `crateOpenable`, `createRace`, `findZipLine`, `zipCrateSpot`, `touchRadius`), Task 7 (`createJokerCrate`, `createPartyHat`, `attachHat`, `HARLEY`), Task 9 (`post.add`), `formatTime` (3C `challenges.js`), 3C's side HUD (`ui.hint`, `ui.toast`, `ui.challenge`, `ui.timer`, `ui.countdown`, `ui.clearChallenge`), 5FG's `gfx.confetti.burst(center, count)` and `progress.gadgets.broken`, `world.climbables.ziplines`, `hero.control.name` (`'zip'` while riding), events `ladderOn`, `wallRun`, `splash`, `heroDown`.
- Produces: `createCrates(deps)` (see Shared interfaces); events `crateOpened { id, count }` (5FG pays 200 XP), `raceStart`, `raceFail`, `raceNear` (once, the first time Batman is within 8 m of a clock crate), `unlock { id: 'partyHat' }`; `window.__game.post.crates`.

- [ ] **Step 1: Write `src/postgame/crates.js`**

```js
// Joker crates at run time (data and rules in crateSpots.js). Shed and duct crates open once their
// 5FG breakable is broken; ladder and wall-run crates want that move in the last 4 s; zip crates
// hang under their cable and open while riding; race crates start from a clock crate and must be
// reached before the clock runs out. Close to a crate that won't open yet, the Joker's note says
// why. Each crate pays XP (5FG's crateOpened); all twenty put Harley's party hat on the cowl.
import * as THREE from 'three';
import MANSI from '../mansi.config.js';
import { CRATES, CRATE_PRIZES, NOTE, HAT_UNLOCK, crateOpenable, createRace, findZipLine, zipCrateSpot, touchRadius } from './crateSpots.js';
import { formatTime } from '../game/challenges.js';
import { createJokerCrate, createPartyHat, attachHat, HARLEY } from './postProps.js';

const MOVE_EVENTS = { ladderOn: 'ladder', wallRun: 'wallrun' };
const VIEW = 90, START_R = 1.8, REARM = 4, NOTE_R = 1.5, POP = 0.25, NEAR = 8;

export function createCrates({ scene, hero, events, progress, save, ui, hud, climbables, gfx, canRace }) {
  let now = 0, race = null, raceItem = null, shown = -1, toldNear = false;
  const lastMove = { ladder: null, wallrun: null };
  for (const [ev, id] of Object.entries(MOVE_EVENTS)) events.on(ev, () => { lastMove[id] = now; });
  const state = { broken: progress.gadgets.broken, lastMove, now: 0, riding: null, racing: null };
  const zipSpots = new Map();

  const items = CRATES.map((c, i) => {
    let at = c, hang = 0;
    if (c.kind === 'zipline') {
      const line = findZipLine(climbables.ziplines, c.zip);
      if (line) { at = zipCrateSpot(line); hang = 0.65; }
    }
    // Floor crates are measured from their base; a zip crate's spot is its middle (chest height).
    const center = new THREE.Vector3(at.x, c.kind === 'zipline' ? at.y : at.y + 0.45, at.z);
    const mesh = createJokerCrate('plain', { hang });
    mesh.position.set(center.x, center.y - 0.45, center.z);
    scene.add(mesh);
    let starter = null;
    if (c.race) {
      starter = createJokerCrate('clock');
      starter.position.set(c.race.from.x, c.race.from.y, c.race.from.z);
      scene.add(starter);
    }
    if (c.kind === 'zipline') zipSpots.set(c.id, center);
    return { c, center, mesh, starter, opened: progress.crates.includes(c.id), noted: false, armed: true, popT: 0, r: touchRadius(c), turn: i * 0.7 };
  });

  const hat = attachHat(hero.bat, createPartyHat(HARLEY));
  const hatOn = () => progress.unlocks.includes(HAT_UNLOCK) && progress.postgame.hatOn;
  hat.visible = hatOn();

  function unlockHat() {
    progress.unlocks.push(HAT_UNLOCK);
    progress.postgame.hatOn = true;
    save();
    hat.visible = true;
    events.emit('unlock', { id: HAT_UNLOCK });
    setTimeout(() => hud.card("HARLEY'S PARTY HAT", `All twenty Joker crates, ${MANSI.name}! Harley sent a party hat for the cowl. It lives on the After the Party page if you ever want it off.`, 9000), 2500);
  }

  function open(it) {
    it.opened = true;
    it.popT = 1e-3;
    if (!progress.crates.includes(it.c.id)) progress.crates.push(it.c.id);
    const n = progress.crates.length;
    save();
    gfx.confetti.burst(it.center, 140);
    events.emit('word', { text: n >= CRATES.length ? 'TA-DAAA!' : 'SURPRISE!', pos: it.center.clone(), big: true });
    ui.toast(`Joker crate ${n} of ${CRATES.length}`, CRATE_PRIZES[Math.min(n, CRATE_PRIZES.length) - 1], 6000);
    if (raceItem === it) endRace(true);
    events.emit('crateOpened', { id: it.c.id, count: n });
    if (n >= CRATES.length && !progress.unlocks.includes(HAT_UNLOCK)) unlockHat();
  }

  function startRace(it) {
    race = createRace(it.c);
    raceItem = it;
    it.armed = false;
    shown = -1;
    ui.challenge(`Race: ${it.c.where}`);
    ui.countdown('GO!');
    events.emit('raceStart', { id: it.c.id });
  }
  function endRace(won) {
    const it = raceItem;
    ui.clearChallenge();
    race = null;
    raceItem = null;
    shown = -1;
    if (won || !it) return;
    it.mesh.visible = false;
    ui.toast('Too slow!', 'The prize crate popped back into the clock crate. Step away and touch the clock to try again.', 4500);
    events.emit('raceFail', { id: it.c.id });
  }
  events.on('splash', () => { if (race) endRace(false); });
  events.on('heroDown', () => { if (race) endRace(false); });

  function update(dt, real, on) {
    now += dt;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const racingThis = raceItem === it;
      if (it.popT > 0) {
        it.popT += dt;
        it.mesh.scale.setScalar(1 + it.popT * 3);
        if (it.popT >= POP) { it.popT = 0; it.mesh.visible = false; it.mesh.scale.setScalar(1); }
      } else it.mesh.visible = on && !it.opened && (it.c.kind !== 'race' || racingThis);
      if (it.starter) it.starter.visible = on && !it.opened && !racingThis;
      if (it.mesh.visible && Math.abs(it.center.x - hero.pos.x) + Math.abs(it.center.z - hero.pos.z) < VIEW) it.mesh.rotation.y = it.turn + now * 0.8;
    }
    if (race) {
      if (race.update(dt) === 'timeout') endRace(false);
      else {
        const t = Math.ceil(race.left * 10);
        if (t !== shown) { shown = t; ui.timer(formatTime(race.left), 'Reach the prize crate!'); }
      }
    }
    if (!on || hero.dead) return;
    state.now = now;
    state.riding = hero.control?.name ?? null;
    state.racing = race ? race.id : null;
    const hx = hero.pos.x, hy = hero.pos.y + 1, hz = hero.pos.z;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.opened) continue;
      if (it.starter && !race) {
        const s = it.starter.position;
        const ds = Math.hypot(s.x - hx, s.y + 0.45 - hy, s.z - hz);
        if (!toldNear && ds < NEAR) { toldNear = true; events.emit('raceNear'); }
        if (ds > REARM) it.armed = true;
        else if (it.armed && ds < START_R && canRace()) { startRace(it); continue; }
      }
      if (it.c.kind === 'race' && raceItem !== it) continue;
      const d = Math.hypot(it.center.x - hx, it.center.y - hy, it.center.z - hz);
      if (d > it.r + NOTE_R) { if (it.noted && d > 6) it.noted = false; continue; }
      const ok = d <= it.r && crateOpenable(it.c, state).ok;
      if (ok) open(it);
      else if (!it.noted) { it.noted = true; ui.hint(NOTE[it.c.kind], 3800); }
    }
  }

  return {
    items,
    update,
    busy: () => !!race,
    marker: () => (raceItem ? raceItem.center : null),
    onRespawn() { if (race) endRace(false); return null; },
    livePos: (id) => zipSpots.get(id) ?? null,
    setHat(on) { progress.postgame.hatOn = !!on; save(); hat.visible = hatOn(); },
    get hatUnlocked() { return progress.unlocks.includes(HAT_UNLOCK); },
    // Dev hook and scripted play: open a crate as if its puzzle were solved.
    open(id) { const it = items.find((x) => x.c.id === id); if (it && !it.opened) open(it); return !!it; },
    get debug() {
      return { opened: progress.crates.length, race: race ? { id: race.id, left: +race.left.toFixed(1) } : null, hat: hat.visible, now: +now.toFixed(1), lastMove: { ...lastMove } };
    },
  };
}
```

A locked crate you walk up to shows its note from 1.5 m further out than its touch radius, so a crate sealed in a shed still explains itself from outside the wall.

- [ ] **Step 2: Wire it in `src/game/game.js`.** Import `import { createCrates } from '../postgame/crates.js';`. Right after the `Object.assign(sideHooks, mergeFlowHooks(...))` line from Task 9:

```js
    post.crates = post.add(createCrates({
      scene, hero, events, progress, ui: side.ui, hud, climbables: world.climbables, gfx,
      save: () => saveProgress(storage, progress),
      canRace: () => flow.mode === 'play' && !side.challenges.active && !combat.active && !post.busy(),
    }));
```

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7a-t10.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.crates ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['crateOpened', 'raceStart', 'raceFail', 'unlock']) G.events.on(n, (d) => G.__log.push([n, d?.id ?? ''])); G.__xp0 = G.wayne.xp; 'armed'"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 64, y: 14, z: -110.1 }, Math.PI); G.follow.snapBehind(Math.PI, 0.1); 'outside the lab shed'", "wait": 900},
 {"eval": "document.querySelector('.ch-hint.show')?.textContent ?? null"},
 {"shot": "t10-shed-note"},
 {"eval": "const G = window.__game; G.breakables.smash(G.breakables.items.find((i) => i.id === 'wallCrateAceLab'), G.hero.pos); G.hero.teleport({ x: 64, y: 14, z: -111.3 }, Math.PI); 'in'", "wait": 800},
 {"shot": "t10-surprise"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 136.3, y: 26, z: -48 }, Math.PI / 2); 'pawn roof, no ladder'", "wait": 700},
 {"eval": "window.__game.progress.crates.includes('cratePawnLadder')"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 130, y: 26, z: -48 }, Math.PI / 2); G.events.emit('ladderOn'); G.hero.teleport({ x: 136.3, y: 26, z: -48 }, Math.PI / 2); 'after a ladder'", "wait": 700},
 {"eval": "window.__game.progress.crates.includes('cratePawnLadder')"},
 {"eval": "const G = window.__game, c = G.post.livePos('crateDocksZip'); G.hero.teleport({ x: c.x, y: c.y - 1, z: c.z }, 0); G.hero.control = { name: 'zip', combat: false, canChain: () => false, update: () => true }; [c.x.toFixed(1), c.y.toFixed(1), c.z.toFixed(1)]", "wait": 500},
 {"eval": "const G = window.__game; G.hero.control = null; G.progress.crates.includes('crateDocksZip')"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: -12, y: 42, z: 14 }, 0.6); 'clock crate'", "wait": 600},
 {"eval": "JSON.stringify(window.__game.post.crates.debug.race)"},
 {"shot": "t10-race"},
 {"eval": "const G = window.__game; G.teleport({ x: 0, y: 0.15, z: 32 }); 'prize'", "wait": 700},
 {"eval": "window.__game.progress.crates.includes('raceGcpdDrop')"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 150, y: 0, z: -60 }, 0); 'neon clock'", "wait": 21500},
 {"eval": "[JSON.stringify(window.__game.post.crates.debug.race), document.querySelector('.side-toast.show .toast-title')?.textContent ?? null]"},
 {"eval": "const G = window.__game; for (const it of G.post.crates.items) G.post.crates.open(it.c.id); G.hero.teleport({ x: 6, y: 42, z: 10 }, 2.6); G.follow.snapBehind(2.6 + Math.PI, 0.05); [G.progress.crates.length, G.progress.unlocks.includes('partyHat'), G.post.crates.debug.hat]", "wait": 3500},
 {"shot": "t10-hat-card"},
 {"eval": "const G = window.__game; [G.wayne.xp - G.__xp0 >= 4000, JSON.stringify(G.__log.slice(0, 6))]"},
 {"wait": 6000},
 {"shot": "t10-hat"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1&gadgets=all" "$TEMP/g7a" "$(cat "$TEMP/g7a-t10.json")"
```

Expected, in order:
- The shed note: `A Joker crate, bricked in. The note says: "Bring something with a bang."`; `t10-shed-note.png` shows the purple crate's hint and the cracked wall.
- `t10-surprise.png`: confetti, `SURPRISE!` and the toast "Joker crate 1 of 20" with the rubber chicken prize.
- The ladder crate stays shut without a ladder (`false`), then opens after `ladderOn` (`true`).
- The zip crate's hanging spot prints near `-90, 14.4, 181` (the real cable decides), and it opens while "riding" (`true`).
- Standing on the GCPD clock crate starts the race: `{"id":"raceGcpdDrop","left":8.x}`; `t10-race.png` shows the race panel with the timer and the prize crate down on the street with the waypoint on it. The prize opens (`true`).
- After 21.5 s on the Neon Row clock crate: `[null, "Too slow!"]` (the race timed out and did not restart while Batman stood still).
- Opening the rest: `[20, true, true]`; `t10-hat-card.png` shows the HARLEY'S PARTY HAT card; `t10-hat.png` shows Batman from the front with the red and black striped hat on the cowl, between or just behind the ears, tilted, not floating and not sunk into the head. If it floats or sinks, change `HAT_LIFT` (and `HAT_FORWARD` for front to back) in `postProps.js`, rebuild and rerun only the last three steps.
- XP rose by at least 4,000 (`true`) and the log starts with `crateOpened` entries.
- `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/postgame/crates.js src/game/game.js
git commit -m "Joker crates at run time: sheds, vents, ladders, wall runs, zip crates, races and Harley's party hat"
```

---

### Task 11: The placement check for every post-game spot

**Files:**
- Create: `scripts/postgame-check.mjs`
- Modify: `src/game/game.js` (expose the data), and the data files if a spot is off (`src/postgame/crateSpots.js`, `src/postgame/guests.js`, `src/world/breakableSpots.js`)

**Interfaces:**
- Consumes: `window.__game.post`, `world.collision` (`groundBelow(x, fromY, z, r)`, `query(minX, minZ, maxX, maxZ)`), `CRATES`, `GUESTS`, `PARTY_CENTER`.
- Produces: `window.__game.post.data = { CRATES, GUESTS, PARTY_CENTER }`; a check that prints `ok` or `FAIL` per spot.

- [ ] **Step 1: Expose the data.** In `src/game/game.js`, import `import { CRATES } from '../postgame/crateSpots.js';` and `import { GUESTS, PARTY_CENTER } from '../postgame/guests.js';`, and after `post.crates = ...` add:

```js
    post.data = { CRATES, GUESTS, PARTY_CENTER };
```

- [ ] **Step 2: Write `scripts/postgame-check.mjs`**

```js
// Checks every After the Party spot against the live city, in a frozen build: each crate stands on
// a floor (zip crates: a real cable was found for them), each race clock crate stands on a floor
// with nothing solid in it, each guest's captive spot and fight site are on their roof, each
// party slot is on the GCPD roof with nothing solid in the way. One line per spot: ok, or FAIL
// with the floor height it found.
// Usage: node scripts/postgame-check.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5212/';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?at=credits&post=1&new=1&god=1`);
await page.waitForFunction(() => window.__game?.post?.data, null, { timeout: 90000 });
const rows = await page.evaluate(() => {
  const G = window.__game, c = G.world.collision, { CRATES, GUESTS, PARTY_CENTER } = G.post.data;
  const out = [];
  const onFloor = (id, x, y, z, tol = 0.6) => {
    const g = c.groundBelow(x, y + 0.5, z, 0.3);
    out.push(g > -Infinity && Math.abs(g - y) <= tol ? `ok   ${id}` : `FAIL ${id}: floor at ${g === -Infinity ? 'none' : g.toFixed(2)}, data says ${y}`);
  };
  const clear = (id, x, y, z) => {
    const hit = c.query(x - 0.4, z - 0.4, x + 0.4, z + 0.4).filter((b) => !b.removed && b.minY < y + 1.8 && b.maxY > y + 0.3);
    if (hit.length) out.push(`FAIL ${id}: something solid in the way (${hit.map((b) => b.tag ?? 'box').join(', ')})`);
  };
  for (const k of CRATES) {
    if (k.kind === 'zipline') {
      const at = G.post.livePos(k.id);
      out.push(at ? `ok   ${k.id} hangs at ${at.x.toFixed(1)}, ${at.y.toFixed(1)}, ${at.z.toFixed(1)}` : `FAIL ${k.id}: no cable near its route`);
      continue;
    }
    onFloor(k.id, k.x, k.y, k.z);
    if (k.race) {
      onFloor(`${k.id} clock`, k.race.from.x, k.race.from.y, k.race.from.z);
      clear(`${k.id} clock`, k.race.from.x, k.race.from.y, k.race.from.z);
    }
  }
  for (const g of GUESTS) {
    onFloor(`guest ${g.id} site`, g.site.x, g.site.y, g.site.z);
    onFloor(`guest ${g.id} captive`, g.captive.x, g.captive.y, g.captive.z);
    clear(`guest ${g.id} captive`, g.captive.x, g.captive.y, g.captive.z);
    onFloor(`guest ${g.id} party slot`, g.slot.x, g.slot.y, g.slot.z, 0.3);
    clear(`guest ${g.id} party slot`, g.slot.x, g.slot.y, g.slot.z);
  }
  onFloor('party center', PARTY_CENTER.x, PARTY_CENTER.y, PARTY_CENTER.z, 0.3);
  return out;
});
console.log(rows.join('\n'));
const bad = rows.filter((r) => r.startsWith('FAIL')).length;
console.log(bad ? `${bad} problem(s)` : 'every post-game spot is ok');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
```

- [ ] **Step 3: Run it.** Build, preview, then `node scripts/postgame-check.mjs http://localhost:5212/`. Also rerun 5FG's breakables check, which now covers the seven crate sheds and ducts: `node scripts/breakables-check.mjs http://localhost:5212/` (22 `ok` lines).

Expected: `every post-game spot is ok` and `no console errors`. For each `FAIL`:
- A floor mismatch under 3 m: the roof is a little higher or lower than its building height. Set the spot's `y` to the printed floor. For a gel or vent crate, change the crate in `crateSpots.js` **and** its room in `breakableSpots.js` together (the Task 1 test keeps them equal).
- `none`, or a mismatch over 3 m: the spot is off its roof. Move it toward the building's center (see `landmarks()` in `src/world/mapData.js` for each building's `x, z, w, d, h`) and rerun.
- Something solid in a party slot or at a captive spot: move that spot 1 m away from the object (for party slots, change `PARTY_CENTER` so the whole ring moves; keep it within 12 m of `{ x: -8, z: 10 }` and at least 6 m from the Batsignal at `{ x: -12, z: -12 }`).
- A zip crate with no cable: print `window.__game.climbables.ziplines.map((l) => [l.a, l.b])` in the browser console, and correct that crate's `zip` roofs to the nearest route in `src/world/ziplines.js`.

If any race's spots moved, rerun `npx vitest run tests/unit/crateSpots.test.js`, and if a race limit changed, update the expected limits in that test with the new numbers it prints. Rerun the check until it prints no `FAIL`.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/postgame-check.mjs src/game/game.js src/postgame/crateSpots.js src/postgame/guests.js src/world/breakableSpots.js tests/unit/crateSpots.test.js
git commit -m "Placement check for every crate, race, guest and party slot, and the spots it corrected"
```

---

### Task 12: Missing guests at run time, and the rooftop party

**Files:**
- Create: `src/postgame/guestMissions.js`, `src/postgame/roofParty.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Task 2 (`GUESTS`, `PARTY_CENTER`, `guestFight` (a 6D stealth fight for the magician), `guestFightId`, `rescueCard`, `timedFailText`, `createRescueTimer`), Task 7 (`createPartyHat`, `attachHat`, `createRopeRing`, `createRoofPartyKit`, `GUEST_HATS`), `createGoon(assets, { type: 'civilian', rng })` (3C look), `readyObjects` (`src/render/prewarm.js`), `world.halos` (`add`, `setSize`), `encounters.begin/end/id/trigger`, events `fightStart`, `fightDone`, `formatTime`, the side HUD, `hud.card`.
- Produces: `createRoofParty({ scene, halos })`, `createGuestMissions(deps)` (see Shared interfaces); events `guestPlaced`, `guestRescued { id, count }`, `guestFailed`, `missionDone { id: 'guest:<id>' }` (5FG pays 500 XP); `window.__game.post.guests`.

- [ ] **Step 1: Write `src/postgame/roofParty.js`**

```js
// The rooftop party on GCPD: the kit (bunting, DJ table, speakers, a birthday cake) and its string
// lights appear with the first rescued guest. The guests themselves dance in guestMissions.js.
import { PARTY_CENTER } from './guests.js';
import { createRoofPartyKit } from './postProps.js';
import { PALETTE } from '../config/palette.js';

const COLORS = [PALETTE.balloon, PALETTE.signal, PALETTE.neonCyan, PALETTE.neonPink];

export function createRoofParty({ scene, halos }) {
  const kit = createRoofPartyKit();
  kit.group.position.set(PARTY_CENTER.x, PARTY_CENTER.y, PARTY_CENTER.z);
  kit.group.visible = false;
  scene.add(kit.group);
  const ids = kit.lights.map(([x, y, z], i) => halos.add(PARTY_CENTER.x + x, PARTY_CENTER.y + y, PARTY_CENTER.z + z, COLORS[i % COLORS.length], 0));
  let lit = false;
  return {
    group: kit.group,
    // Called every frame: only a change of state touches anything.
    set(count, on = true) {
      const want = on && count > 0;
      if (want === lit) return;
      lit = want;
      kit.group.visible = want;
      for (const id of ids) if (id >= 0) halos.setSize(id, want ? 5 : 0);
    },
  };
}
```

- [ ] **Step 2: Write `src/postgame/guestMissions.js`**

```js
// Missing guests at run time (data in guests.js). Each guest waits, tied up and sitting, at their
// captive spot in a party hat. Their squad (or, for the magician, Plan 6D's catwalk predator room
// with its encore squad) is set up through the encounter system only when Batman is within 80 m
// and nothing else holds it, and taken down past
// 120 m if the fight never started, so street crimes and challenges keep working. The timed rescue
// counts down once its fight starts. A rescued guest cheers, then joins the dance party on the
// GCPD roof (Dance_Loop), where the party kit and lights switch on with the first guest.
import * as THREE from 'three';
import { GUESTS, PARTY_CENTER, guestFight, guestFightId, rescueCard, timedFailText, createRescueTimer } from './guests.js';
import { createPartyHat, attachHat, createRopeRing, GUEST_HATS } from './postProps.js';
import { createGoon } from '../actors/characters.js';
import { formatTime } from '../game/challenges.js';

const PLACE = 80, DROP = 120, VIEW = 110, ANIM = 90, CHEER = 2.6, PARTY_MUSIC = 30;

export function createGuestMissions({ scene, assets, hero, events, encounters, progress, save, ui, hud, readyObjects, party, canPlace, canHold }) {
  const fixed = (v) => ({ next: () => v });
  const flat = (p) => Math.hypot(p.x - hero.pos.x, p.z - hero.pos.z);
  let cur = null, cool = 0, shown = -1;

  function pose(s) {
    const p = s.rescued ? s.g.slot : s.g.captive;
    s.ch.root.position.set(p.x, p.y, p.z);
    s.ch.face(s.rescued ? s.g.slot.yaw : Math.atan2(s.g.site.x - p.x, s.g.site.z - p.z));
    s.ch.animator.play(s.rescued ? 'Dance_Loop' : 'Sitting_Idle_Loop', { fade: 0 });
    // Each dancer starts at a different point of the loop, so the floor doesn't move in unison.
    s.ch.animator.update(0.37 * s.i);
    s.rope.visible = !s.rescued;
  }

  const guests = GUESTS.map((g, i) => {
    const ch = createGoon(assets, { type: 'civilian', rng: fixed(i / 6) });
    attachHat(ch, createPartyHat(GUEST_HATS[i]));
    readyObjects(ch.root);
    scene.add(ch.root);
    const rope = createRopeRing();
    rope.position.set(g.captive.x, g.captive.y + 0.55, g.captive.z);
    scene.add(rope);
    const s = { g, i, ch, rope, rescued: progress.guests.includes(g.id), cheerT: 0, pleaded: false };
    pose(s);
    return s;
  });

  function place(s) {
    const id = guestFightId(s.g.id);
    cur = { s, id, live: false, timer: null };
    // Squads, the timed rescue and the magician's predator room (6D) all run through encounters.
    encounters.begin(id, guestFight(s.g));
    if (!s.pleaded) { s.pleaded = true; ui.radio(s.g.name.toUpperCase(), s.g.plea, 6500); }
    events.emit('guestPlaced', { id: s.g.id });
  }
  function unplace() {
    if (!cur) return;
    if (encounters.id === cur.id) encounters.end();
    if (cur.timer) ui.clearChallenge();
    cur = null;
  }
  function rescue() {
    const s = cur.s;
    if (cur.timer) ui.clearChallenge();
    cur = null;
    s.rescued = true;
    if (!progress.guests.includes(s.g.id)) progress.guests.push(s.g.id);
    save();
    const n = progress.guests.length;
    const card = rescueCard(s.g, n);
    hud.card(card.title, card.text, 7500);
    s.rope.visible = false;
    const p = s.ch.root.position;
    s.ch.face(Math.atan2(hero.pos.x - p.x, hero.pos.z - p.z));
    s.ch.animator.play('Yes', { once: true, fade: 0.15 });
    s.cheerT = CHEER;
    events.emit('word', { text: 'HOORAY!', pos: new THREE.Vector3(p.x, p.y + 2.2, p.z), big: false });
    events.emit('guestRescued', { id: s.g.id, count: n });
    events.emit('missionDone', { id: `guest:${s.g.id}` });
  }
  function failTimed() {
    const s = cur.s;
    unplace();
    cool = 5;
    ui.toast(s.g.name, timedFailText(s.g), 5500);
    events.emit('word', { text: 'FIZZ... POP.', pos: new THREE.Vector3(s.g.captive.x, s.g.captive.y + 2.2, s.g.captive.z), big: false });
    events.emit('guestFailed', { id: s.g.id });
  }

  events.on('fightStart', ({ id }) => {
    if (!cur || id !== cur.id) return;
    cur.live = true;
    if (cur.s.g.kind === 'timed') { cur.timer = createRescueTimer(cur.s.g.limit); shown = -1; ui.challenge(`Save ${cur.s.g.name}`); }
  });
  events.on('fightDone', ({ id }) => { if (cur && id === cur.id) rescue(); });

  function update(dt, real, on) {
    party.set(progress.guests.length, on);
    for (let k = 0; k < guests.length; k++) {
      const s = guests[k];
      const p = s.ch.root.position;
      const d = flat(p);
      const vis = on && d < VIEW;
      s.ch.root.visible = vis;
      s.rope.visible = vis && !s.rescued;
      if (s.cheerT > 0) { s.cheerT -= dt; if (s.cheerT <= 0) pose(s); }
      if (vis && d < ANIM) s.ch.animator.update(dt);
    }
    if (!on) { if (cur && !cur.live) unplace(); return; }
    if (cur) {
      if (cur.timer) {
        if (cur.timer.update(dt) === 'expired') { failTimed(); return; }
        const t = Math.ceil(cur.timer.left * 10);
        if (t !== shown) { shown = t; ui.timer(formatTime(cur.timer.left), 'Clear the deck before the firework goes!'); }
      }
      if (!cur.live && (flat(cur.s.g.site) > DROP || !canHold())) unplace();
      return;
    }
    cool -= dt;
    if (cool > 0 || !canPlace()) return;
    let best = null, bd = PLACE;
    for (let k = 0; k < guests.length; k++) {
      const s = guests[k];
      if (s.rescued) continue;
      const d = flat(s.g.site);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) place(best);
  }

  const find = (id) => guests.find((x) => x.g.id === id) ?? null;
  return {
    guests,
    update,
    busy: () => !!cur && cur.live,
    // Knocked out mid-rescue: the squad goes, and comes back when Batman returns.
    onRespawn() { if (cur) { unplace(); cool = 3; } return null; },
    music: () => (progress.guests.length > 0 && Math.hypot(hero.pos.x - PARTY_CENTER.x, hero.pos.z - PARTY_CENTER.z) < PARTY_MUSIC
      && Math.abs(hero.pos.y - PARTY_CENTER.y) < 8 ? 'finale' : null),
    // Dev hooks and scripted play.
    forceRescue(id) {
      const s = find(id);
      if (!s || s.rescued) return false;
      if (cur) unplace();
      cur = { s, id: guestFightId(id), live: true, timer: null };
      rescue();
      return true;
    },
    placeNow(id) { const s = find(id); if (!s || s.rescued) return false; if (cur) unplace(); place(s); return true; },
    setTimer(sec) { if (cur?.timer && sec > 0.05 && sec < cur.timer.left) cur.timer.update(cur.timer.left - sec); },
    get debug() {
      return { current: cur?.id ?? null, live: cur?.live ?? false, left: cur?.timer ? +cur.timer.left.toFixed(1) : null, rescued: progress.guests.length };
    },
  };
}
```

- [ ] **Step 3: Wire it in `src/game/game.js`.** Imports:

```js
import { createGuestMissions } from '../postgame/guestMissions.js';
import { createRoofParty } from '../postgame/roofParty.js';
```
After `post.data = ...` (Task 11), add:

```js
    post.guests = post.add(createGuestMissions({
      scene, assets, hero, events, encounters, progress, ui: side.ui, hud, readyObjects,
      save: () => saveProgress(storage, progress),
      party: createRoofParty({ scene, halos: world.halos }),
      canPlace: () => flow.mode === 'play' && !hero.dead && !encounters.id && !side.challenges.active && !post.busy(),
      canHold: () => !side.challenges.active && !post.busy(),
    }));
```
(`readyObjects` is already imported from `../render/prewarm.js` for goon spawning.)

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7a-t12.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.guests ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['guestPlaced', 'guestRescued', 'guestFailed', 'missionDone']) G.events.on(n, (d) => G.__log.push([n, d?.id ?? ''])); G.__xp0 = G.wayne.xp; G.teleport({ x: -60, y: 22, z: 132 }); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.1); 'cold storage'", "wait": 1500},
 {"eval": "const G = window.__game; [G.encounters.id, JSON.stringify(G.post.guests.debug), document.querySelector('.radio.show .radio-title')?.textContent ?? null]"},
 {"shot": "t12-captive"},
 {"eval": "(async () => { const G = window.__game; G.encounters.trigger(); for (let i = 0; i < 20 && !G.progress.guests.includes('dj'); i++) { G.winFight(); await new Promise((r) => setTimeout(r, 700)); } return [G.progress.guests, document.querySelector('.hud-card .card-title')?.textContent ?? null]; })()"},
 {"shot": "t12-hooray"},
 {"wait": 3000},
 {"eval": "const G = window.__game; G.hero.teleport({ x: -8, y: 42, z: 19 }, Math.PI); G.follow.snapBehind(Math.PI, 0.2); const s = G.post.guests.guests[0]; [s.ch.root.position.x.toFixed(1), s.ch.root.position.z.toFixed(1), s.ch.animator.currentName]", "wait": 1500},
 {"shot": "t12-party-1"},
 {"eval": "const G = window.__game; G.post.guests.placeNow('photographer'); G.teleport({ x: -44, y: 9, z: 226 }); 'freighter'", "wait": 1200},
 {"eval": "const G = window.__game; G.encounters.trigger(); 'go'", "wait": 600},
 {"eval": "JSON.stringify(window.__game.post.guests.debug)"},
 {"shot": "t12-timed"},
 {"eval": "window.__game.post.guests.setTimer(1); 'one second'", "wait": 1800},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.guests.debug), document.querySelector('.side-toast.show .toast-text')?.textContent ?? null, G.encounters.id]"},
 {"wait": 5500},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 10 && !G.encounters.id; i++) await new Promise((r) => setTimeout(r, 300)); G.encounters.trigger(); for (let i = 0; i < 20 && !G.progress.guests.includes('photographer'); i++) { G.winFight(); await new Promise((r) => setTimeout(r, 700)); } return G.progress.guests; })()"},
 {"eval": "const G = window.__game; G.post.guests.placeNow('magician'); G.teleport('aceCatwalksEntry'); G.hero.bat.face(-Math.PI / 2); G.follow.snapBehind(-Math.PI / 2, 0.15); [JSON.stringify(G.post.guests.debug), G.stealth.active, G.enemies.map((e) => e.type)]", "wait": 2500},
 {"shot": "t12-stealth"},
 {"eval": "(async () => { const G = window.__game; G.encounters.trigger(); for (let i = 0; i < 20 && !G.progress.guests.includes('magician'); i++) { G.winFight(); await new Promise((r) => setTimeout(r, 700)); } return [G.progress.guests.includes('magician'), G.stealth.active]; })()"},
 {"eval": "const G = window.__game; for (const id of ['baker', 'balloonArtist', 'grandma']) G.post.guests.forceRescue(id); [G.progress.guests.length, document.querySelector('.hud-card .card-title')?.textContent ?? null]", "wait": 3200},
 {"eval": "const G = window.__game; G.hero.teleport({ x: -8, y: 42, z: 19.5 }, Math.PI); G.follow.snapBehind(Math.PI, 0.25); [G.post.guests.guests.filter((s) => s.ch.root.visible).length, G.post.music()]", "wait": 2500},
 {"shot": "t12-party-6"},
 {"eval": "const G = window.__game; [G.wayne.xp - G.__xp0 >= 3000, JSON.stringify(G.__log.filter((x) => x[0] !== 'guestPlaced'))]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1" "$TEMP/g7a" "$(cat "$TEMP/g7a-t12.json")"
```

Expected, in order:
- Near cold storage the DJ's squad is set up: `["guest:dj", {"current":"guest:dj","live":false,...}, "DJ SPINZ"]`; `t12-captive.png` shows the DJ sitting in a rope ring in a yellow and purple party hat, goons around him, and his radio plea.
- The fight is won: `[["dj"], "DJ SPINZ IS FREE!"]`; `t12-hooray.png` shows him cheering with `HOORAY!` and the rescue card.
- On the GCPD roof the DJ stands at his party slot (`-8.0`, `13.2`) playing `Dance_Loop`, and `t12-party-1.png` shows the bunting, DJ table, speakers, the cake and lights, with the DJ dancing.
- The timed rescue starts its clock: debug `left` near `50`; `t12-timed.png` shows "Save Flash Freddie" and the timer. After setting it to 1 s: `current: null`, the toast "FIZZ... pop. The firework fizzled out. ...", and `null` for the encounter. After the 5 s cooldown the squad comes back, and winning it rescues him.
- The magician's room is set up through 6D: `current` is `guest:magician`, `G.stealth.active` is `true`, and the goons are four `rifle` and one `knife` (the encore squad); `t12-stealth.png` shows the catwalks from the entry deck with the rifle goons on patrol and the magician sitting inside the east loop. Winning it rescues him and ends the room: `[true, false]`.
- After the last three: `[6, "EVERYONE IS SAFE!"]`, then 6 visible dancers and music `"finale"`. `t12-party-6.png` shows all six in different hats, dancing out of step with each other, none standing inside a speaker or a post.
- XP rose by at least 3,000 (6 rescues at 500), and the log has one `guestRescued` and one `missionDone` per guest plus one `guestFailed`.
- `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/guestMissions.js src/postgame/roofParty.js src/game/game.js
git commit -m "Missing guests at run time: squads on demand, the stealth room, the timed rescue, and the GCPD rooftop party"
```

---

### Task 13: New Game Plus at run time

**Files:**
- Create: `src/postgame/ngPlusRun.js`
- Modify: `src/ui/menus.js`, `src/game/game.js`
- Test: `tests/unit/ngPlusRun.test.js` (new)

**Interfaces:**
- Consumes: Task 3 (`ngActive`, `ngRules`, `ngLabel`, `startNewGame`, `NORMAL_RULES`, `hardenFight`, `scaledHealth`), Task 5 (`combat.setHardness`, `combat.hardness`, encounters' `shape`), `hud.card`, the `step` event (flow emits it for the credits step before it sets `progress.finished`).
- Produces: `createNgPlus({ events, progress, save, combat, hud })` -> `{ active, rules(), shape(def), announce(), cleared() }`; the title's New Game Plus button; `begin(suit, fresh, { plus })`; `window.__game.ng`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/ngPlusRun.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createEvents } from '../../src/core/events.js';
import { createNgPlus } from '../../src/postgame/ngPlusRun.js';
import { ngRules } from '../../src/postgame/ngPlus.js';
import { NORMAL_RULES } from '../../src/combat/hardness.js';
import { FIGHTS } from '../../src/game/fights.js';

function setup(pg, o = {}) {
  const events = createEvents();
  const progress = { step: 0, finished: false, postgame: { cleared: true, introSeen: true, hatOn: true, ngCycle: 0, ngCleared: 0, ...pg }, ...o };
  const combat = { setHardness: vi.fn() };
  const hud = { card: vi.fn() };
  const save = vi.fn();
  return { events, progress, combat, hud, save, ng: createNgPlus({ events, progress, save, combat, hud }) };
}

describe('New Game Plus at run time', () => {
  it('sets the hardness for the cycle being played', () => {
    expect(setup({ ngCycle: 2 }).combat.setHardness).toHaveBeenCalledWith(ngRules(2));
    expect(setup({ ngCycle: 0 }).combat.setHardness).toHaveBeenCalledWith(NORMAL_RULES);
    expect(setup({ ngCycle: 2 }, { finished: true }).combat.setHardness).toHaveBeenCalledWith(NORMAL_RULES);
  });
  it('adds goons only while New Game Plus is on', () => {
    expect(setup({ ngCycle: 1 }).ng.shape(FIGHTS.yard).waves[0]).toHaveLength(4);
    expect(setup({ ngCycle: 0 }).ng.shape(FIGHTS.yard)).toBe(FIGHTS.yard);
  });
  it('announces itself at the start of the story only', () => {
    const t = setup({ ngCycle: 1 });
    t.ng.announce();
    expect(t.hud.card.mock.calls[0][0]).toBe('NEW GAME PLUS');
    expect(t.hud.card.mock.calls[0][1]).not.toMatch(/[\u2013\u2014]/);
    const later = setup({ ngCycle: 2 }, { step: 12 });
    later.ng.announce();
    expect(later.hud.card).not.toHaveBeenCalled();
  });
  it('the credits clear the cycle once, pay XP and turn the goons back down', () => {
    const t = setup({ ngCycle: 1 });
    const paid = [];
    t.events.on('missionDone', (d) => paid.push(d.id));
    t.events.emit('step', { step: { type: 'credits' } });
    expect(t.progress.postgame.ngCleared).toBe(1);
    expect(t.save).toHaveBeenCalled();
    expect(t.combat.setHardness).toHaveBeenLastCalledWith(NORMAL_RULES);
    expect(paid).toEqual(['ngPlus:1']);
    t.ng.cleared();
    expect(t.hud.card).toHaveBeenCalledWith('NEW GAME PLUS CLEARED', expect.any(String), 8000);
    t.events.emit('step', { step: { type: 'credits' } });
    expect(paid).toEqual(['ngPlus:1']);
  });
  it('a normal story finishing pays nothing extra', () => {
    const t = setup({ ngCycle: 0 });
    const paid = [];
    t.events.on('missionDone', (d) => paid.push(d.id));
    t.events.emit('step', { step: { type: 'credits' } });
    t.ng.cleared();
    expect([paid, t.hud.card.mock.calls.length]).toEqual([[], 0]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/ngPlusRun.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/postgame/ngPlusRun.js`**

```js
// New Game Plus at run time: turns the goons up while an NG+ story is played (combat hardness;
// encounters' shape hook adds goons to every wave; game.js's spawn scales goon health), shows a
// caption when it starts, and marks the cycle cleared (500 XP through missionDone) when its
// credits roll. Pure apart from the objects it is handed.
import MANSI from '../mansi.config.js';
import { NORMAL_RULES, hardenFight } from '../combat/hardness.js';
import { ngActive, ngRules, ngLabel } from './ngPlus.js';

export function createNgPlus({ events, progress, save, combat, hud }) {
  const rules = () => (ngActive(progress) ? ngRules(progress.postgame.ngCycle) : NORMAL_RULES);
  combat.setHardness(rules());
  let pending = 0;
  // flow emits 'step' for the credits before it sets progress.finished.
  events.on('step', ({ step }) => {
    if (step.type !== 'credits') return;
    combat.setHardness(NORMAL_RULES);
    const pg = progress.postgame;
    if (pg.ngCycle > 0 && pg.ngCleared < pg.ngCycle) {
      pg.ngCleared = pg.ngCycle;
      save();
      pending = pg.ngCycle;
      events.emit('missionDone', { id: `ngPlus:${pg.ngCycle}` });
    }
  });
  return {
    get active() { return ngActive(progress); },
    rules,
    shape: (def) => (ngActive(progress) ? hardenFight(def, ngRules(progress.postgame.ngCycle)) : def),
    announce() {
      if (!ngActive(progress) || progress.step > 1) return;
      hud.card(ngLabel(progress.postgame.ngCycle - 1).toUpperCase(), `Gold suit, every gadget, every upgrade. The goons have been training too. Good luck, ${MANSI.name}.`, 8000);
    },
    // After the New Game Plus credits close.
    cleared() {
      if (!pending) return;
      hud.card('NEW GAME PLUS CLEARED', `Gotham, saved in gold. Take a bow, ${MANSI.name}.`, 8000);
      pending = 0;
    },
  };
}
```

- [ ] **Step 4: The title button in `src/ui/menus.js`.** In Plan 3C's `title(opts)`, destructure `onNewPlus = null, plusLabel = 'New Game Plus'` from `opts`, and right after the New game button add:

```js
    if (onNewPlus) list.appendChild(button(plusLabel, onNewPlus));
```

- [ ] **Step 5: Wire it in `src/game/game.js`.**
  - Imports: `import { createNgPlus } from '../postgame/ngPlusRun.js';`, `import { startNewGame, ngLabel } from '../postgame/ngPlus.js';`, `import { scaledHealth } from '../combat/hardness.js';` (drop `newGameProgress` from the `save.js` import if nothing else uses it).
  - `showTitle()`: pass two more options to `menus.title({...})`:

```js
      onNewPlus: progress.postgame.cleared ? () => begin('gold', true, { plus: true }) : null,
      plusLabel: ngLabel(progress.postgame.ngCleared),
```
  - `function begin(suit, fresh) {` becomes `function begin(suit, fresh, { plus = false } = {}) {`. Plan 6D made the new-game line `if (fresh) { progress = newGameProgress(progress); progress.stepId = null; }`; make it `if (fresh) progress = startNewGame(progress, { plus });` (`startNewGame` clears `stepId` itself). After `game.post.start();` add `game.ng.announce();`.
  - In `buildRun`, right after `hero.combat = combat;`:

```js
    const ng = createNgPlus({ events, progress, combat, hud, save: () => saveProgress(storage, progress) });
```
  - In `spawn`, right after `const e = createEnemy({...});` add `e.health = scaledHealth(e.health, combat.hardness);`.
  - `createEncounters({ spawn, despawn, combat, events, collision: world.collision })` gains `shape: (def) => ng.shape(def)`.
  - In the credits `onClose`, after `post.start();` add `ng.cleared();`.
  - After `post = createAfterParty(...)`, add `post.ng = ng;`, and add `ng` to the `api` object.

- [ ] **Step 6: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Scripted play.** Build, preview, then (a fresh browser profile boots to the title; the first step writes a finished save and reloads):

```bash
cat > "$TEMP/g7a-t13.json" <<'EOF'
[
 {"eval": "localStorage.setItem('gotham-mansi-progress-v1', JSON.stringify({ step: 30, finished: true, seenIntro: true, suit: 'f', postgame: { cleared: true, introSeen: true }, wayne: { xp: 3000, owned: ['plating1'] }, gadgets: { unlocked: ['gel'] }, crates: ['crateJazz'] })); location.reload(); 'reloading'", "wait": 6000},
 {"eval": "new Promise((r) => { const f = () => (window.__game?.state?.frame > 30 ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "[...document.querySelectorAll('.title-menu .mbtn')].map((b) => b.textContent)"},
 {"shot": "t13-title"},
 {"eval": "[...document.querySelectorAll('.title-menu .mbtn')].find((b) => b.textContent === 'New Game Plus').click(); 'plus'", "wait": 3000},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 8; i++) { if (G.comic.playing) G.comic.skip(); await new Promise((r) => setTimeout(r, 500)); } return 'skipped'; })()"},
 {"eval": "const G = window.__game; [G.progress.suit, G.progress.postgame.ngCycle, G.progress.gadgets.unlocked.length, G.combat.hardness.health, G.progress.wayne.owned, G.progress.crates, G.hero.maxHealth]"},
 {"shot": "t13-ng-card"},
 {"eval": "const G = window.__game; G.jump('f2'); 'yard'", "wait": 2500},
 {"eval": "const G = window.__game; [G.enemies.length, G.enemies.map((e) => e.health)]"},
 {"eval": "const G = window.__game; G.encounters.trigger(); 'fight'", "wait": 6000},
 {"shot": "t13-ng-fight"},
 {"eval": "const G = window.__game; G.jump('credits'); 'credits'", "wait": 1500},
 {"eval": "const G = window.__game; [G.progress.postgame.ngCleared, G.progress.finished, G.combat.hardness.health]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5212/?dynres=0&god=1" "$TEMP/g7a" "$(cat "$TEMP/g7a-t13.json")"
```

Expected, in order:
- The title lists `Continue`, `New game`, `New Game Plus`, and the rest; `t13-title.png` shows the button.
- After clicking it and skipping the intro comic: `["gold", 1, 8, 1.5, ["plating1"], ["crateJazz"], 125]` (gold suit, cycle 1, all eight gadgets, 1.5x goon health, the upgrade and the crate kept, max health with Reinforced Plating). `t13-ng-card.png` shows the gold suit and the "NEW GAME PLUS" caption.
- The container yard fight has 4 goons in its first wave (3 plus 1) with health `[6, 6, 6, 6]`; `t13-ng-fight.png` shows the fight.
- After jumping to the credits: `[1, true, 1]` (cycle cleared, goons back to normal).
- `no console errors`.

- [ ] **Step 8: Commit**

```bash
git add src/postgame/ngPlusRun.js src/ui/menus.js src/game/game.js tests/unit/ngPlusRun.test.js
git commit -m "New Game Plus: title button, gold suit, every gadget, tougher goons and extra waves, cleared at the credits"
```

---
### Task 14: The After the Party page in the pause menu, and post-game pins on the map

**Files:**
- Modify: `src/game/mapModel.js`, `src/ui/progressMap.js`, `src/game/sideContent.js`, `src/postgame/afterParty.js`, `src/ui/menus.js`, `src/ui/style.css`, `src/game/game.js`
- Test: `tests/unit/mapModel.test.js` (3C, modify)

**Interfaces:**
- Consumes: `mapExtras(progress)` (Task 4), `post.page()`, `post.pages`, `post.crates.setHat` (Tasks 9, 10), 3C's `mapModel`, `drawProgressMap`, `side.progressPage()`, `menus.pause(opts)`, `pauseOptions()`, and the pattern of 3C's `readPage`.
- Produces: `mapModel({ ..., extras })` -> `extras: [{ id, kind, u, v }]`; `drawProgressMap` draws them; `createSideContent({ extras })`; `post.page().map`; `menus.afterPartyPage(data, { onBack, onHat, onRead })`; the pause button `After the Party`.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/mapModel.test.js`:

```js
describe('post-game pins', () => {
  it('maps extras and keeps their kind', () => {
    const base = { buildings: [], balloons: [], challenges: [], progress: sanitizeProgress({}) };
    expect(mapModel({ ...base, extras: [{ id: 'crateJazz', kind: 'crate', x: 131, z: 76 }] }).extras)
      .toEqual([{ id: 'crateJazz', kind: 'crate', ...toMap(131, 76, 360) }]);
    expect(mapModel(base).extras).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/mapModel.test.js`
Expected: FAIL (`extras` is undefined).

- [ ] **Step 3: Pins in the model and the drawing.** In `src/game/mapModel.js`, change the signature to `export function mapModel({ buildings, balloons, challenges, progress, size = 360, extras = [] }) {` and the return to:

```js
  const marks = extras.map((e) => ({ id: e.id, kind: e.kind, ...toMap(e.x, e.z, size) }));
  return { size, water: toMap(0, WORLD.waterZ, size).v, blocks, balloons: pins, challenges: medals, extras: marks };
```
In `src/ui/progressMap.js`, add after the `MEDAL` constant:

```js
// After the Party pins (src/postgame/afterPartyModel.js MARKER_KINDS), matching the HUD markers.
const PIN = { crate: '#6c3fa3', race: '#6c3fa3', guest: '#f2d24b', bomb: '#ff9ec8', army: '#62c141', encore: '#c8323c', crashers: '#4fe3ff' };
function drawPin(g, e) {
  g.fillStyle = PIN[e.kind] ?? INK;
  g.strokeStyle = INK;
  g.lineWidth = 1.1;
  g.beginPath();
  if (e.kind === 'guest') { g.moveTo(e.u, e.v - 5); g.lineTo(e.u + 4, e.v + 3); g.lineTo(e.u - 4, e.v + 3); g.closePath(); }
  else if (e.kind === 'crate' || e.kind === 'bomb') g.rect(e.u - 3, e.v - 3, 6, 6);
  else if (e.kind === 'encore') g.rect(e.u - 2.5, e.v - 4, 5, 8);
  else g.arc(e.u, e.v, 3.4, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}
```
and in `drawProgressMap`, right after the balloon loop: `for (const e of m.extras ?? []) drawPin(g, e);`.

- [ ] **Step 4: Page data.** In `src/game/sideContent.js`, destructure `extras = () => []` from `deps` and pass `extras: extras()` into the `mapModel({...})` call in `progressPage`. In `src/postgame/afterParty.js`, add `map: side.progressPage().map,` to the object `page()` returns. In `src/game/game.js`, import `mapExtras` (`import { mapExtras } from '../postgame/afterPartyModel.js';`) and pass into `createSideContent({...})`:

```js
      extras: () => (progress.postgame.cleared ? mapExtras(progress) : []),
```

- [ ] **Step 5: The page in `src/ui/menus.js`.** Add next to 3C's `progressPage` (text through `textContent`, never `innerHTML`):

```js
  // ---------- after the party ----------
  function afterPartyPage(data, { onBack, onHat, onRead }) {
    const node = el('div', 'menu progress-menu afterparty-menu');
    node.appendChild(el('h2', '', 'After the Party'));
    const wrap = el('div', 'pg-wrap');
    const map = el('canvas', 'pg-map');
    map.width = 540;
    map.height = 540;
    drawProgressMap(map, data.map);
    const parts = el('div', 'pg-parts');
    for (const r of data.rows) {
      const row = el('div', `pg-row${r.complete ? ' done' : ''}`, '<div class="pg-head"><span class="pg-label"></span><span class="pg-count"></span></div><div class="pg-bar"><i></i></div><div class="pg-detail"></div>');
      row.querySelector('.pg-label').textContent = r.label;
      row.querySelector('.pg-count').textContent = `${r.done}/${r.total}`;
      row.querySelector('.pg-bar i').style.width = `${Math.round((r.total ? r.done / r.total : 1) * 100)}%`;
      row.querySelector('.pg-detail').textContent = r.status;
      parts.appendChild(row);
    }
    wrap.append(map, parts);
    node.appendChild(wrap);
    node.appendChild(el('p', 'note', 'Purple boxes are Joker crates in districts you have visited, yellow hats are missing guests. Markers show in the city too.'));
    const list = el('div', 'mlist');
    if (data.hat.unlocked) list.appendChild(button(data.hat.on ? "Harley's party hat: on" : "Harley's party hat: off", () => onHat(!data.hat.on)));
    for (const p of data.pages) list.appendChild(button(`Read: ${p.title}`, () => onRead(p.id)));
    list.appendChild(button('Back', onBack, 'small'));
    node.appendChild(list);
    show(node);
  }
```
Add `afterPartyPage` to the returned object. In `pause(opts)`, destructure `onAfterParty` and add, right after the Progress button:

```js
    if (onAfterParty) list.appendChild(button('After the Party', onAfterParty));
```
Update the `pause` comment's option list to include `onAfterParty?`. Append to `src/ui/style.css`:

```css
.afterparty-menu .pg-row.done .pg-label { text-decoration: line-through; }
.afterparty-menu .mlist { margin-top: 10px; }
```

- [ ] **Step 6: Wire it in `src/game/game.js`.** In `pauseOptions()` add, next to 3C's `onProgress`:

```js
      onAfterParty: game.post.active ? () => openAfterParty(() => menus.pause(opts)) : undefined,
```
and next to 3C's `readPage`:

```js
  // The pause menu's After the Party page. The hat toggle redraws the page in place.
  function openAfterParty(back) {
    menus.afterPartyPage(game.post.page(), {
      onBack: back,
      onHat: (on) => { game.post.crates.setHat(on); openAfterParty(back); },
      onRead: (id) => readPost(id, () => openAfterParty(back)),
    });
  }
  // A post-game comic page, read again. stage.shot moves the camera, so the paused view is put back.
  function readPost(id, back) {
    const entry = game.post.pages.find((x) => x.id === id);
    if (!entry) { back(); return; }
    menus.hide();
    const p = camera.position.clone(), q = camera.quaternion.clone();
    const pages = entry.make(game.stage);
    camera.position.copy(p);
    camera.quaternion.copy(q);
    game.comic.play(pages).then(back);
  }
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Scripted check.** Build, preview, then:

```bash
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1" "$TEMP/g7a" '[
 {"eval":"new Promise((r) => { const f = () => (window.__game?.post?.crates ? r(1) : setTimeout(f, 100)); f(); })"},
 {"eval":"const G = window.__game; G.progress.districts.push(\"neon\", \"docks\"); for (const id of G.post.data.CRATES.map((c) => c.id)) G.post.crates.open(id); G.post.guests.forceRescue(\"dj\"); G.post.refresh(); \"set up\"","wait":4000},
 {"press":"Escape"},{"wait":400},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].map((b) => b.textContent)"},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find((b) => b.textContent === \"After the Party\").click()"},{"wait":400},
 {"eval":"[...document.querySelectorAll(\".afterparty-menu .pg-row\")].map((r) => r.textContent)"},
 {"shot":"t14-page"},
 {"eval":"[...document.querySelectorAll(\".afterparty-menu .mbtn\")].find((b) => b.textContent.startsWith(\"Harley\")).click()"},{"wait":300},
 {"eval":"[window.__game.progress.postgame.hatOn, window.__game.post.crates.debug.hat, [...document.querySelectorAll(\".afterparty-menu .mbtn\")].map((b) => b.textContent)]"},
 {"eval":"[...document.querySelectorAll(\".afterparty-menu .mbtn\")].find((b) => b.textContent === \"Read: After the Party\").click()"},{"wait":1200},
 {"shot":"t14-reread"},
 {"eval":"window.__game.comic.skip()"},{"wait":800},
 {"shot":"t14-back"},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find((b) => b.textContent.startsWith(\"Progress\")).click()"},{"wait":400},
 {"shot":"t14-progress"}
]'
```

Expected: the pause menu lists `After the Party` after `Progress, NN%`; the page shows three rows (`Joker crates 20/20` crossed out, `Missing guests 1/6`, `New Game Plus 0/1`) and the map with yellow guest hats for the five still missing (no crate pins, all open); `t14-page.png` shows it. The hat button flips it off (`[false, false, [..."Harley's party hat: off"...]]`). Reading the page again shows the AFTER THE PARTY comic (`t14-reread.png`), and closing it returns to the After the Party page (`t14-back.png`). The Progress page (`t14-progress.png`) now lists Joker crates, Missing guests and New Game Plus with the base categories, and its map has the guest pins too. `no console errors`.

- [ ] **Step 9: Commit**

```bash
git add src/game/mapModel.js src/ui/progressMap.js src/game/sideContent.js src/postgame/afterParty.js src/ui/menus.js src/ui/style.css src/game/game.js tests/unit/mapModel.test.js
git commit -m "After the Party page in the pause menu, the hat toggle, rereading the comic, and post-game pins on the map"
```

---

### Task 15: Sounds, the party waltz, and prompts

**Files:**
- Modify: `src/game/sound.js`, `src/ui/prompts.js`, `src/game/game.js`
- Test: `tests/unit/prompts.test.js` (modify)

**Interfaces:**
- Consumes: events `crateOpened`, `raceStart`, `raceFail`, `raceNear`, `guestRescued`, `guestFailed`, `unlock`, `afterPartyOpen`; `post.active`, `post.music()`; existing sounds `pop`, `pickup`, `signal`, `buzzer`, `balloon`, `firework` and stingers `objective`, `districtClear`.
- Produces: `wireAudio({ ..., post })`; prompts `afterParty` and `crateRace`.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: After the Party', () => {
  it('afterParty points at the pause key, crateRace explains the clock crate, no dashes', () => {
    const a = promptText('afterParty', DEFAULT_BINDINGS);
    expect(a).toContain(keyLabel(DEFAULT_BINDINGS.pause[0]));
    const r = promptText('crateRace', DEFAULT_BINDINGS);
    expect(r).toContain('clock crate');
    for (const s of [a, r]) expect(s).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/prompts.test.js`
Expected: FAIL (unknown prompt ids).

- [ ] **Step 3: Prompts.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['afterParty', (k) => `After the Party! Press ${k('pause')} for the list and the map. Markers show the missing guests, and Joker crates once you are close.`],
  ['crateRace', () => 'A race crate: touch the clock crate to start, then reach the prize crate before the timer runs out.'],
```

- [ ] **Step 4: Sounds and music in `src/game/sound.js`.** Add `post = null` to `wireAudio`'s parameters. Add, with the other `on(...)` lines:

```js
  // After the Party (Plan 7H-1).
  on('crateOpened', () => { audio.play('pop', { pitch: 0.9 }); audio.play('pickup'); });
  on('raceStart', () => audio.play('signal', { gain: 0.7, pitch: 1.3 }));
  on('raceFail', () => audio.play('buzzer', { pitch: 1.4 }));
  on('guestRescued', () => { audio.stinger('objective'); setTimeout(() => audio.play('balloon'), 200); });
  on('guestFailed', () => audio.play('firework', { pitch: 0.6, gain: 0.6 }));
  on('unlock', ({ id }) => { if (id === 'partyHat') audio.stinger('districtClear'); });
```
and replace the `want` computation in `update()` with:

```js
      // After the credits the birthday waltz keeps playing in free roam, but a post-game fight gets
      // the fight music, and a post-game system can ask for its own (the rooftop party asks for the
      // waltz; Plan 7H-2's encore asks for the boss music).
      const pm = post?.active ? post.music() : null;
      const fight = fighting || combat.active;
      const want = trackPlaying ? 'none'
        : step?.type === 'boss' ? 'boss'
        : pm ? pm
        : step?.scene === 'finale' || step?.type === 'credits' ? (post?.active && fight ? 'combat' : 'finale')
        : flow.mode === 'cutscene' ? 'title'
        : fight ? 'combat' : 'explore';
```

- [ ] **Step 5: Wire it in `src/game/game.js`.** Pass `post` into `wireAudio({ ... })`. Add:

```js
    events.on('afterPartyOpen', () => prompts.show(['afterParty']));
    events.on('raceNear', () => prompts.show(['crateRace']));
```
and add `raceStart: 'crateRace'` to `PROMPT_DONE`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Listen.** Build, preview, open `http://localhost:5212/?at=credits&post=1&new=1&god=1` with sound on, and in the console: `__game.post.crates.open('crateJazz')` (a pop and the pickup chime), `__game.post.guests.forceRescue('dj')` (the objective stinger and a balloon squeak), then `__game.hero.teleport({ x: -8, y: 42, z: 16 })` (the waltz), then `__game.teleport('yard'); __game.post.guests.placeNow('photographer'); __game.teleport({ x: -44, y: 9, z: 226 }); __game.encounters.trigger()` (the fight music comes in). Nothing clips or repeats every frame.

- [ ] **Step 8: Commit**

```bash
git add src/game/sound.js src/ui/prompts.js src/game/game.js tests/unit/prompts.test.js
git commit -m "Post-game sounds, fight music after the credits, the rooftop waltz, and two prompts"
```

---

### Task 16: Scripted runs and browser tests for the first half of After the Party

**Files:**
- Create: `scripts/runs/post-crates.json`, `scripts/runs/post-guests.json`, `scripts/runs/post-ngplus.json`, `tests/e2e/postgame.spec.js`

**Interfaces:**
- Consumes: everything above.
- Produces: three replayable runs (the Task 10, 12 and 13 scripts, kept in the repo) and three Playwright tests.

- [ ] **Step 1: Keep the runs.** Copy the three scripted runs written for Tasks 10, 12 and 13 into the repo:

```bash
cp "$TEMP/g7a-t10.json" scripts/runs/post-crates.json
cp "$TEMP/g7a-t12.json" scripts/runs/post-guests.json
cp "$TEMP/g7a-t13.json" scripts/runs/post-ngplus.json
```
Replay all three against a fresh build (they must still give the results listed in those tasks):

```bash
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1&gadgets=all" "$TEMP/g7a-r" "$(cat scripts/runs/post-crates.json)"
node scripts/dev-play.mjs "http://localhost:5212/?at=credits&post=1&new=1&god=1" "$TEMP/g7a-r" "$(cat scripts/runs/post-guests.json)"
node scripts/dev-play.mjs "http://localhost:5212/?dynres=0&god=1" "$TEMP/g7a-r" "$(cat scripts/runs/post-ngplus.json)"
```

- [ ] **Step 2: Write `tests/e2e/postgame.spec.js`**

```js
import { test, expect } from '@playwright/test';

async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function boot(page, query) {
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__game?.post?.guests, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await page.waitForTimeout(1500);
}

test('After the Party shows its list, the objective line, and its pause page', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=credits&post=1&new=1&god=1');
  await expect(page.locator('.ph-list.show')).toBeVisible();
  await expect(page.locator('.ph-row')).toHaveCount(3);
  await expect(page.locator('.hud-caption .obj')).toContainText('After the Party');
  await page.keyboard.press('Escape');
  await page.locator('.pause-menu .mbtn', { hasText: 'After the Party' }).click();
  await expect(page.locator('.afterparty-menu')).toBeVisible();
  await expect(page.locator('.afterparty-menu .pg-row')).toHaveCount(3);
  expect(errors).toEqual([]);
});

test('a Joker crate opens behind its gel wall, pays XP, and stays open after a reload', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=credits&post=1&new=1&god=1&gadgets=all');
  const xp0 = await page.evaluate(() => window.__game.wayne.xp);
  await page.evaluate(() => {
    const G = window.__game;
    G.breakables.smash(G.breakables.items.find((i) => i.id === 'wallCrateAceLab'), G.hero.pos);
    G.hero.teleport({ x: 64, y: 14, z: -111.3 }, Math.PI);
  });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__game.progress.crates)).toEqual(['crateAceLab']);
  expect(await page.evaluate(() => window.__game.wayne.xp)).toBeGreaterThanOrEqual(xp0 + 200);
  await boot(page, 'at=credits&post=1&god=1');
  expect(await page.evaluate(() => window.__game.progress.crates)).toEqual(['crateAceLab']);
  expect(await page.evaluate(() => window.__game.post.crates.items.find((i) => i.c.id === 'crateAceLab').mesh.visible)).toBe(false);
  expect(errors).toEqual([]);
});

test('New Game Plus appears on the title after the credits and starts in gold', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?dynres=0');
  await page.waitForFunction(() => window.__game?.state?.frame > 30, null, { timeout: 90000 });
  await page.evaluate(() => localStorage.setItem('gotham-mansi-progress-v1', JSON.stringify({ step: 30, finished: true, seenIntro: true, postgame: { cleared: true, introSeen: true } })));
  await page.reload();
  await page.waitForFunction(() => window.__game?.state?.frame > 30, null, { timeout: 90000 });
  await page.locator('.title-menu .mbtn', { hasText: 'New Game Plus' }).click();
  await page.waitForFunction(() => window.__game?.hero && window.__game?.ng, null, { timeout: 60000 });
  for (let i = 0; i < 6; i++) { await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip()); await page.waitForTimeout(400); }
  expect(await page.evaluate(() => [window.__game.progress.suit, window.__game.progress.postgame.ngCycle, window.__game.combat.hardness.health])).toEqual(['gold', 1, 1.5]);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Run the browser tests** against the frozen build:

```bash
BASE_URL=http://localhost:5212 npx playwright test tests/e2e/postgame.spec.js
```
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/runs/post-crates.json scripts/runs/post-guests.json scripts/runs/post-ngplus.json tests/e2e/postgame.spec.js
git commit -m "Replayable post-game runs and browser tests: the list and page, a crate that persists, New Game Plus from the title"
```

---

### Task 17: Performance: a post-game page in the fps sweep, and load time

**Files:**
- Modify: `scripts/fps-sweep.mjs`

**Interfaces:**
- Consumes: everything above; `window.__game.post`, `ng`, `encounters`, `combat`.
- Produces: a `post` page (`ONLY=post`) with rows `p:crates`, `p:race`, `p:guestFight`, `p:party`, `p:ngFight`.

- [ ] **Step 1: Add the page.** In `scripts/fps-sweep.mjs`, add `post` to the header comment's scenario list, and before `await b.close();` add:

```js
if (!only || only === 'post') {
  const { p, errors } = await openGame('at=credits&post=1&new=1&god=1&gadgets=all');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  // Crates: a Neon Row roof with several crates and sheds in view, then one opens (confetti, toast).
  await label(p, 'p:crates');
  await p.evaluate(() => { const g = window.__game; g.progress.districts.push('neon'); g.post.refresh(); g.teleport({ x: 128, y: 34, z: 70 }); g.hero.bat.face(0); g.follow.snapBehind(0, 0.1); });
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.post.crates.open('crateJazz'));
  await p.waitForTimeout(3000);
  // A race: the Neon Row clock crate, the prize showing down the street, the timer running.
  await label(p, 'p:race');
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 150, y: 0, z: -60 }, 0); g.follow.snapBehind(0, 0.1); });
  await p.waitForTimeout(4000);
  // A guest squad: the DJ's two waves on cold storage, the captive, the radio plea.
  await label(p, 'p:guestFight');
  await p.evaluate(() => { const g = window.__game; g.teleport({ x: -60, y: 22, z: 128 }); g.hero.bat.face(Math.PI); g.follow.snapBehind(Math.PI, 0.1); });
  await p.waitForTimeout(1500);
  await p.evaluate(() => window.__game.encounters.trigger());
  for (let i = 0; i < 10; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(450); }
  await p.evaluate(() => window.__game.winFight());
  await p.waitForTimeout(2000);
  await p.evaluate(() => window.__game.winFight());
  await p.waitForTimeout(2500);
  // The rooftop party with all six guests dancing, the kit and the lights.
  await label(p, 'p:party');
  await p.evaluate(() => {
    const g = window.__game;
    for (const id of ['dj', 'baker', 'magician', 'balloonArtist', 'photographer', 'grandma']) g.post.guests.forceRescue(id);
  });
  await p.waitForTimeout(3000);
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: -8, y: 42, z: 20 }, Math.PI); g.follow.snapBehind(Math.PI, 0.15); });
  await p.waitForTimeout(6000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/post-party.png` }); }
  all.push(...await collect(p, 'post'));
  meta.errorsPost = errors;
  await p.close();
}
if (!only || only === 'post') {
  // New Game Plus: the container yard with an extra goon per wave and tougher goons.
  const { p, errors } = await openGame('at=toYard&new=1&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  await p.evaluate(() => { const g = window.__game; g.progress.postgame.ngCycle = 1; g.combat.setHardness(g.ng.rules()); g.jump('f2'); });
  await p.waitForTimeout(1500);
  await label(p, 'p:ngFight');
  await p.evaluate(() => window.__game.encounters.trigger());
  for (let i = 0; i < 16; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(400); }
  all.push(...await collect(p, 'post'));
  meta.errorsNg = errors;
  await p.close();
}
```

- [ ] **Step 2: Run the sweep on the owner's laptop.** Build to `$TEMP/g7adist`, preview on 5212, then:

```bash
OUT="$TEMP/sweep-g7a.json" node scripts/fps-sweep.mjs http://localhost:5212/ high
```
Expected: every `p:*` row has p95 at or under 6.9 ms; `hitches >25ms after warmup: 0`; no older row is worse than in the last sweep before this plan. If a hitch lands in a `p:*` row:
- A first-sight hitch (one long frame when something first appears): a crate face, hat or party-kit texture uploading, or a guest's skinned mesh being bound. Check that the object was in the scene (even hidden) before `begin()` ran `drawEverything`, that `createPostWarm()` has a copy of its material, and that each guest went through `readyObjects`.
- A steady high p95 in `p:party`: six guests animating. Drop `ANIM` in `guestMissions.js` (animate only within 60 m) or update every other guest per frame (alternate halves with a frame counter, passing `dt * 2`), and rerun.
- A steady high p95 anywhere else: look for allocation in `update` (a `filter`, `map`, closure or `clone` per frame) and DOM writes every frame (`postHud` must only write on change).
Rerun until clean.

- [ ] **Step 3: Load time.**

```bash
node scripts/load-time.mjs http://localhost:5212/ 40 1
```
Expected: `firstFrame` under 3.2 s, and `compiled` no more than 30 ms later than before this plan (the warm cast grew by a few small props).

- [ ] **Step 4: Commit**

```bash
git add scripts/fps-sweep.mjs
git commit -m "fps sweep: a post-game page for crates, a race, a guest fight, the rooftop party and a New Game Plus fight"
```

---

### Task 18: Full verification (the coordinator runs this)

**Files:**
- Modify: `scripts/playthrough.mjs` (post-game report), `scripts/webkit-check.mjs` (post-game shots)

- [ ] **Step 1: Unit tests.** `npx vitest run`. Every test passes, including the eight new test files (`crateSpots`, `guests`, `ngPlus`, `postSave`, `afterParty`, `flowHooks`, `postHud`, `ngPlusRun`) and the changed `breakableSpots`, `encounters`, `mapModel` and `prompts` tests.

- [ ] **Step 2: Browser tests.** Build to `$TEMP/g7adist`, preview on 5212, then `BASE_URL=http://localhost:5212 npx playwright test`. All pass: smoke, 3C's content tests, 5FG's gadget tests, 6D's tests and `postgame.spec.js`.

- [ ] **Step 3: No dashes in player-visible text.**

```bash
grep -nP "[\x{2013}\x{2014}]" src/postgame/*.js src/ui/postHud.js src/ui/menus.js src/ui/prompts.js src/mansi.config.js src/game/game.js src/game/sound.js
```
Expected: no output.

- [ ] **Step 4: Placements.** `node scripts/postgame-check.mjs http://localhost:5212/` prints `every post-game spot is ok`; `node scripts/breakables-check.mjs http://localhost:5212/` prints 22 `ok` lines.

- [ ] **Step 5: The full playthrough reaches After the Party.** In `scripts/playthrough.mjs`, before `await browser.close();`, add:

```js
const post = await page.evaluate(async () => {
  const G = window.__game;
  await new Promise((r) => setTimeout(r, 1500));
  return { on: G.post.active, cleared: G.progress.postgame.cleared, rows: G.post.debug.rows };
});
console.log('after the party:', JSON.stringify(post));
```
Run: `BASE=http://localhost:5212/ OUT="$TEMP/pt7a" node scripts/playthrough.mjs`
Expected: it ends at `credits` with no console errors, and prints `after the party: {"on":true,"cleared":true,"rows":["crates 0/20","guests 0/6","ngPlus 0/1"]}`.

- [ ] **Step 6: fps sweep, all pages.** On the owner's laptop: `OUT="$TEMP/sweep-final-7a.json" node scripts/fps-sweep.mjs http://localhost:5212/ high`. Every row (main, fight, boss, 3C's side page, 5FG's gadgets page, 6D's stealth rows and this plan's post page) has p95 at or under 6.9 ms and no hitch over 25 ms after warmup. Repeat once with `low`.

- [ ] **Step 7: Load time.** `node scripts/load-time.mjs http://localhost:5212/ 40 1`: `firstFrame` under 3.2 s.

- [ ] **Step 8: WebKit.** In `scripts/webkit-check.mjs`, after its last screenshot, add (using the script's page `p`, its base URL argument and its output folder `out`):

```js
  await p.goto(`${base}?at=credits&post=1&new=1&god=1`);
  await p.waitForFunction(() => window.__game?.post?.guests, null, { timeout: 120000 });
  await p.waitForTimeout(3000);
  console.log('post', JSON.stringify(await p.evaluate(() => [window.__game.post.active, !!document.querySelector('.ph-list.show'), document.querySelectorAll('.ph-marker').length > 0])));
  await p.screenshot({ path: `${out}/post.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(400);
  await p.evaluate(() => [...document.querySelectorAll('.pause-menu .mbtn')].find((b) => b.textContent === 'After the Party')?.click());
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}/post-page.png` });
```
Run: `node scripts/webkit-check.mjs http://localhost:5212/ "$TEMP/wk7a"`
Expected: `post [true,true,true]`; `post.png` shows the list and the SVG markers drawn correctly in Safari's engine (ink strokes, fills); `post-page.png` shows the After the Party page with the map pins; no console errors.

- [ ] **Step 9: Look at every screenshot** from Tasks 9 to 17 in `$TEMP/g7a`. The crates read at a glance in the comic look (purple, inked, a clear "?"), the hats sit on heads (Batman's and all six guests'), the rooftop party has no z-fighting or floating props, the dancers are out of step with each other, no marker or list overlaps the objective line or the combo counter. Copy the best to `docs/screens/g7a-*.png`: `t10-surprise`, `t10-hat`, `t12-captive`, `t12-party-6`, `t13-title`, `t14-page`.

- [ ] **Step 10: Commit**

```bash
git add scripts/playthrough.mjs scripts/webkit-check.mjs docs/screens/g7a-*.png
git commit -m "Playthrough reports After the Party, WebKit checks its HUD and page, post-game screenshots"
```

- [ ] **Step 11:** The coordinator reviews the screenshots, the sweep and the playthrough report, then merges and pushes `main`. No task pushes. Plan 7H-2 starts from that `main`.
