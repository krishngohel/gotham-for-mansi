# Plan 6D: Predator Stealth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Part D of the traversal and comic spec: armed rifle goons that patrol waypoint routes, see with 70 degree vision cones and hear noises, an awareness glyph that fills white, yellow and red, searching and a squad alarm that falls back to searching after 8 s, fear that grows with every takedown, crouch, the silent takedown from behind, gargoyle perches and the perch drop, the batarang distraction, a floor vent to hide in, detective vision that shows each goon's state colour and vision cone and an armed-goon counter, and two predator rooms in the story ("Monarch Balcony" before the party step, "Ace Chemicals Catwalks" before the cake step), with checkpoints, a fallback fight when spotted, and a reusable room API for the post-game "Missing Guests" stealth rescue.

**Architecture:**
- **Pure rules first.** `src/stealth/vision.js` holds every number and every geometric test: the cone, the range with shadow and crouch, perches and the vent, hearing, fill rates, and where a silent takedown or a perch drop can start. `src/stealth/brain.js` is the per-goon awareness state machine (patrol, suspicious, search, hunt, engage), the squad alarm and its 8 s fall-back, fear, the lines goons call out and the HUD glyph code. `src/stealth/patrol.js` walks routes and picks huddle and search spots. `src/stealth/stealthRooms.js` describes both rooms as data. None of them import three.js, and all are unit-tested.
- **Goons keep their fight AI.** `enemy.js` gains a few movement states (`patrol`, `search`, `hunt`, `suspicious`, `look`) that only move a goon to a point or turn it toward one, with an edge guard so nobody walks off a catwalk. The stealth runtime (`src/stealth/stealthSystem.js`) decides where each goon goes and flips `e.aware` only while the squad is hostile, so the existing combat system, director, chains and gadgets work on room goons unchanged. The rifle goon is a new enemy type with a code-modelled rifle, a long readable wind-up with a red laser and a 25 damage shot.
- **Rooms are data and scenery.** Both sets (catwalks, columns, gargoyles, crates, lamps, the vent, the balcony deck) are built into the city at boot from the same room data the runtime reads (`src/world/stealthSets.js`), so a lamp in the set is a light pool in the rules. A pure checker (`src/stealth/roomCheck.js`) validates every patrol leg, perch and entry against the live collision.
- **Story rooms reuse the encounter module.** A fight definition with `stealth: <roomId>` spawns the squad on its routes and hands it to the stealth runtime instead of waking it. The fight completes when every goon is down, exactly like any fight. Saves now also store the step id, so inserting the two new steps never moves a player's save.

**Tech Stack:** Three.js 0.186, plain ES modules, Vitest 5 (node environment), Playwright 1.63 (`tests/e2e`), playwright-core scripted play (`scripts/dev-play.mjs`, `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`, `scripts/webkit-check.mjs`, `scripts/load-time.mjs`).

**Base:** Branch `stealth`, cut from `main` **after** Plan 4E (`chains`), Plan 3C (`content`) and Plan 5FG (`gadgets`) are merged (so traversal, the comic look, `warmCast.js`, kicks, chains, side content and gadgets are all in). For example a worktree at `C:\Users\awsom\Documents\Projects\gotham-stealth`. Every file and line referenced below is as it stands after those merges. Where this plan says "4E's", "3C's" or "5FG's" it names the exact function or line that plan added. If a named anchor line is not exactly as quoted (a later fix reworded it), find the line with the same job and make the same change there.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-traversal-comic-content-design.md`, Part D. Hooks from `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`: Part E (a stealth chain is free and silent with 2+ unaware goons within 6 m), Part F (the smoke pellet in stealth resets every goon's alert to searching), Part H (a Missing Guests rescue is a stealth room).
- Ledge takedowns, drop takedowns and corner shimmy already shipped in Plan 3B. This plan does not re-plan them; it only teaches the ledge takedown in the catwalk room and keeps it working with the new awareness.
- **No em dashes** (U+2014) or en dashes (U+2013) in any player-visible text: prompts, hints, help, labels, lines goons shout, sound words, story text, room names. Use commas, colons or full stops. Task 18 greps for them.
- **Commits** are authored by Krishn Gohel only (check `git config user.name` prints `Krishn Gohel` before the first commit). Never add `Co-Authored-By` or any other trailer.
- **Never push.** Pushing `main` redeploys the live site. The coordinator reviews and pushes after Task 18.
- **Art is authored in code**: the rifle, the stealth clips, the catwalks, columns, crates, planters, lamps, the vent grate, the balcony, the HUD glyphs and icons. All copy (goon lines, prompts, help, story text) is Fable-authored in this plan. No AI image tools, no downloaded art, no new asset files.
- **Performance.** Keep 144 fps or better on the owner's laptop. In the fps sweep (`scripts/fps-sweep.mjs`, High, `dynres=0`), every row's p95 is at or under 6.9 ms and no frame is over 25 ms after the first 5 s. Every new material and geometry is in the warm cast (`src/game/warmCast.js`); every run object is created in `buildRun` before `begin()` calls `drawEverything`. No per-frame allocation in hot paths: the stealth runtime builds every goon record, sense object and goal vector in `begin()`, line-of-sight rays run at 10 Hz per goon, the takedown prompt is recomputed at 10 Hz, and the HUD touches class names and attributes only when a numeric state code changes.
- **Load time.** The first frame stays near 3 s. The six stealth clips bake at boot next to the kick and chain clips; if the `clips` boot mark grows by more than 60 ms, move `buildStealthClips` into `begin()` (Task 17 checks).
- **Safari engine** (WebKit) is checked before release (Task 18).
- **Pure modules** (`vision.js`, `brain.js`, `patrol.js`, `stealthRooms.js`, `roomCheck.js`, `storyMigrate.js`) import nothing from three.js, the DOM or `src/ui/`. They may import other pure modules (`mapData.js`, `story.js`, `save.js`, `chains.js`).
- **Keys.** 4E owns `Digit1` to `Digit3`, 5FG owns `Tab` and `Digit4`, 3C owns `KeyO`. This plan adds `KeyZ` (Crouch, toggle). On the pad, L3 (left stick click) is split with 5FG's `createHoldTap`: a tap toggles crouch, holding it past 0.22 s is sprint (as the spec asks for crouch on the left stick click, which sprint already used).
- **Browser checks run against a frozen production build only** (the dev server reloads on every edit):
  ```bash
  npx vite build --outDir "$TEMP/s6dist"
  npx vite preview --outDir "$TEMP/s6dist" --port 5210 --strictPort
  ```
  Rebuild after each code change you want to check. URL flags: `?at=<stepId>`, `?god=1`, `?new=1`, `?fight=test`, `?dynres=0`, `?gadgets=all`. `?at=monarchBalcony` and `?at=aceCatwalks` start in each predator room.
- `window.__game` already exposes `hero`, `follow`, `combat`, `enemies`, `camera`, `world`, `ink`, `events`, `progress`, `state`, `time`, `climbables`, `teleport(site|{x,y,z})`, `spawn(type, p)`, `winFight()`, `comic`, `side`, `photo`, `gadgets`, `wayne`, `breakables`, `gfx`. This plan adds `stealth`, `stealthFx`, `stealthHud` and `checkStealthRooms()`.

## File Structure

| File | Responsibility |
|---|---|
| `src/stealth/vision.js` (new) | Pure: `STEALTH` numbers, cone, range, shadow, vent, perches, hearing, fill rate, silent takedown and perch drop eligibility |
| `src/stealth/brain.js` (new) | Pure: goon awareness states, squad alarm and fall-back, smoke reset, hit reactions, fear, lines, HUD glyph code, state colour |
| `src/stealth/patrol.js` (new) | Pure: route walking (loop, pingpong, waits, facing), huddle spots, search spots, segment-versus-rectangle test |
| `src/stealth/stealthRooms.js` (new) | Pure data: the two rooms, their squads and encore squads, `stealthFight()` |
| `src/stealth/roomCheck.js` (new) | Pure: validates rooms against a collision world (floors, legs, walls, perches, entry, overlaps) |
| `src/world/mapData.js` (modify) | Four new `SITES` |
| `src/game/story.js`, `src/game/fights.js` (modify) | Two stealth steps and their fights |
| `src/game/storyMigrate.js` (new) | Pure: `stepId` save field, `LEGACY_STEP_IDS`, `resolveStep()` |
| `src/game/flow.js` (modify) | Save `stepId`; predator rooms respawn at their entry |
| `src/actors/stealthAnims.js` (new) | Code-authored clips: `Rifle_Idle`, `Rifle_Walk`, `Rifle_Aim`, `Rifle_Search`, `Takedown_Choke`, `Choked` |
| `src/combat/rules.js`, `src/combat/chains.js`, `src/progress/upgrades.js` (modify) | The `rifle` enemy, rifle damage, Kevlar covers rifles |
| `src/actors/characters.js`, `src/game/warmCast.js` (modify) | The rifle goon look and code-modelled rifle, `ch.muzzle`, `ch.xrays`; warm copies |
| `src/actors/enemy.js` (modify) | Movement states, edge guard, `goTo`, `lookAt`, `engageNow`, `calm`, rifle aim and fire, `yaw`, `aiming` |
| `src/core/bindings.js`, `src/core/input.js`, `src/actors/hero.js` (modify) | Crouch action, L3 tap and hold, `hero.crouched`, `hero.perched`, quiet footsteps |
| `src/world/stealthSets.js` (new), `src/world/districts.js` (modify) | Both room sets built into the city |
| `scripts/stealth-check.mjs` (new) | Runs `roomCheck` against the live city |
| `src/game/encounters.js` (modify) | `stealth` fights: spawn on routes, never wake, hand to the runtime |
| `src/combat/combatSystem.js` (modify) | `stealthStart` hook, quiet `takedown`, rifle fire and aim events |
| `src/stealth/takedowns.js` (new) | Hero controls `silent` and `perchDrop` |
| `src/stealth/stealthSystem.js` (new) | Runtime: senses, brains, movement, noise, alarm, fear, lines, prompts, hooks |
| `src/gadgets/g/batarang.js`, `src/gadgets/gadgetSystem.js` (modify) | The batarang flies to a wall in a predator room |
| `src/stealth/stealthFx.js` (new) | Vision cones, laser sights, tracers and muzzle flashes, x-ray tints; warm copy |
| `src/ui/stealthHud.js` (new), `src/ui/style.css` (modify) | Awareness glyphs, speech balloons, armed counter, takedown prompt, crouch badge |
| `src/ui/prompts.js`, `src/ui/menus.js`, `src/audio/sfx.js`, `src/game/sound.js`, `src/game/game.js` (modify) | Teaching, hints, help, sounds, music, wiring |
| `scripts/fps-sweep.mjs` (modify) | A `stealth` page |
| `tests/unit/vision.test.js`, `brain.test.js`, `patrol.test.js`, `stealthRooms.test.js`, `roomCheck.test.js`, `storyMigrate.test.js`, `stealthAnims.test.js`, `stealthEncounters.test.js`, `stealthCombat.test.js`, `takedowns.test.js`, `stealthSystem.test.js`, `batarangWall.test.js`, `stealthFx.test.js` (new) | Unit tests |
| `tests/unit/story.test.js`, `combat.test.js`, `upgrades.test.js`, `bindings.test.js`, `input.test.js`, `prompts.test.js` (modify) | Unit tests |
| `tests/e2e/stealth.spec.js` (new) | Browser tests: a room patrols, a silent takedown lands, the step completes |

## Shared interfaces (every task relies on these exact names)

```js
// src/stealth/vision.js (pure; points are plain { x, y, z }, yaw is radians and 0 faces +z like ch.face)
STEALTH   // { fov, hostileFov, range: 25, shadow: 0.55, crouch: 0.6, instant: 3, fill, minFill, decay, searchAt: 0.5,
          //   searchTime: 20, loseTime: 8, huntAfter: 1, lookUp: 3, perchSpot: 6, eye: 1.6, chest: 1.1, crouchChest: 0.7,
          //   hearDy: 5, noise: { step: 5, sprint: 9, land: 10, batarang: 12, takedown: 3, perch: 8 },
          //   silentReach: 1.6, silentBehind: -0.2, silentTime: 2, perchOn: 0.9, perchReach: 5, perchMinDrop: 1.5, perchMaxDrop: 14 }
BLIND, HELD                                         // Sets of enemy states
planar(a, b), inCone(from, yaw, p, fov), inShadow(p, lights), inRect(p, rect), sightRange({ crouched, shadow }, rules)
canLook(e) -> boolean
spotCheck(goon, hero, lights, rules) -> distance | -1    // goon: { pos, yaw, hostile }; hero: { pos, crouched, perched, hidden, flying }
fillRate(d, range, rules) -> meter per second
hears(listener, at, radius, rules) -> boolean
footstepNoise({ sprint, crouched }, rules) -> radius
perchedOn(pos, perches, rules) -> perch | null
canSilentTakedown(e, heroPos, rules), pickSilentTarget(heroPos, enemies, rules) -> e | null, pickPerchDrop(heroPos, enemies, rules) -> e | null

// src/stealth/brain.js (pure)
HOSTILE                                             // Set: 'hunt', 'engage'
createSquad() -> { alarm, unseenT, lastKnown: {x,y,z}, fear, kos }
createMind() -> { alert: 'patrol'|'suspicious'|'search'|'hunt'|'engage', meter, target: {x,y,z}, rev, searchLeft, t }
thinkGoon(m, squad, sense, dt, rules) -> 'suspect'|'search'|'hear'|'shout'|'calm'|'giveUp'|null
    // sense: { seesAt: distance | -1, range, hero: {x,y,z}, noise: {x,y,z} | null }
goHostile(m, squad, at) -> 'shout'
alarmAll(minds, squad) -> count
thinkSquad(squad, minds, anySees, dt, rules) -> 'lost' | null
smokeReset(minds, squad, at, rules)
struck(m, squad, at, outcome, rules) -> 'shout' | 'search' | null
noteTakedown(squad) -> fear, fearSpeed(fear), huddles(fear, alive)
LINES, pickLine(kind, n) -> string
glyphCode(m) -> 0 | colour * 32 + fill (colour 1 white, 2 yellow, 3 red), glyphColor(code), glyphFill(code)
stateColor(m) -> 0 patrolling | 1 searching | 2 hostile

// src/stealth/patrol.js (pure)
createPatrol(start = 0) -> { i, dir, waitT }
stepPatrol(p, route, pos, dt, out) -> waiting        // route: { mode: 'loop'|'pingpong', points: [{ x, y, z, wait, face }] }; out: { x, y, z, face }
huddleSpot(center, k, n, out, radius = 1.6) -> out
pickSpot(spots, center, y, k, out, within = 12) -> out | null
segmentHitsRect(a, b, rect, pad = 0) -> boolean      // rect: { x, z, w, d }

// src/stealth/stealthRooms.js (pure data)
ROOMS { monarchBalcony, aceCatwalks }, ROOM_IDS
// room: { id, name, site, entry (SITES keys), radius, bounds, decks, posts, columns, perches, cover, rails, lights, doors,
//         vent, huddle, squad: [{ type, route }], encore: [{ type, route }] }
roomSquad(room, kind = 'main') -> squad list
roomSpots(room) -> every route point of the room (walkable spots)
stealthFight(roomId, { squad = 'main' } = {}) -> { site, radius, entry, stealth: roomId, squad, waves: [[{ type, dx, dz, y }]] }

// src/stealth/roomCheck.js (pure)
checkRooms(collision, grapplePoints, rooms, sites) -> [{ room, kind, detail }]   // [] means every room is sound

// src/game/storyMigrate.js
LEGACY_STEP_IDS, resolveStep(progress, steps = STEPS, legacy = LEGACY_STEP_IDS) -> index   // registers progress field 'stepId'

// src/actors/stealthAnims.js
STEALTH_CLIPS, STEALTH_BEATS, overlayClip(name, base, top, bones), buildStealthClips(model, clips, fwd = 1)

// src/actors/enemy.js additions
e.yaw (getter), e.aiming (getter), e.nav { x, y, z, speed, face, lookX, lookZ, arrived, px, pz, stuckT }, e.room, e.seesHero
e.canNav(), e.goTo(x, y, z, speed, state = 'patrol', face = null), e.lookAt(x, z, state = 'suspicious'), e.engageNow(), e.calm()
// states 'patrol', 'search', 'hunt', 'suspicious', 'look'; attackKind 'rifle'; enemy ctx hook onRifleFire(e)
// src/actors/characters.js: ch.muzzle (Object3D at the barrel tip, rifle goons only), ch.xrays (every x-ray mesh)
// src/combat/rules.js: ENEMY.rifle { health: 4, damage: 25, counterable: false, parry: true, ranged: true }

// src/actors/hero.js: h.crouched, h.perched; events crouchOn, crouchOff; 'footstep' now carries { sprint }
// src/core/bindings.js: action 'crouch' on KeyZ; src/core/input.js: PAD_L3 = 10 (tap crouch, hold sprint)

// src/world/stealthSets.js: buildStealthSets(ctx, rooms = ROOMS)

// src/game/encounters.js: createEncounters({ ..., stealth = null }); wave entries may carry y; stealth.begin(fight, made), stealth.end()
// src/combat/combatSystem.js: createCombat({ ..., stealthStart = null }); takedown(e, kind, { crit = true } = {});
//   events 'takedown' { kind, pos, target }, 'rifleShot' { from, to, target, hit } (shared vectors: copy them), 'rifleAim' { target }

// src/stealth/takedowns.js
createSilentTakedown(hero, api, { target }) -> control { name: 'silent', camera: 'takedown', combat: true, keepCrouch: true, knockOff() }
createPerchDrop(hero, api, { target }) -> control { name: 'perchDrop', camera: 'dive', combat: true, knockOff() }
// api: { events, noise(pos, radius, kind), takedown(e, kind, opts) }

// src/stealth/stealthSystem.js
createStealth({ hero, combat, events, collision, perches, rng, rules = STEALTH })
  -> { active, room, alarm, goons, squad, prompt: 'silent'|'perch'|null, begin(fight, made, room?), end(), update(dt),
       noise(pos, radius, kind) -> count, start(action, ctx) -> boolean, armed() -> count }
// goon record: { e, spec, route, mind, patrol, goal, look, view, seesAt, range, losT, lookT, rev, slot, noise, noiseAt, out, color, baseWake }

// src/stealth/stealthFx.js
STEALTH_FX_MAX = 8, STATE_COLORS, stealthMaterials(), createStealthWarm() -> Group
createStealthFx(scene) -> { update(dt, goons, { detective, hero }), shot(from, to), clear(), parts }

// src/ui/stealthHud.js
createStealthHud(root) -> { glyph(i, x, y, visible, code), say(target, text), updateLines(dt, place), armed(n, visible), prompt(html), crouch(on), clear() }

// New events
// stealthStart { room }, stealthEnd, stealthAlarm { target, count }, stealthLost, stealthNoise { pos, radius, kind, count },
// stealthLine { target, text }, stealthFear { fear, left }, perched, ventHide, crouchOn, crouchOff,
// silentStart { target }, silentTakedown { target }, silentBroken { target }, perchDropStart { target }, perchDrop { target },
// batarangWall { pos }, rifleAim { target }, rifleShot { from, to, target, hit }
// New hint ids: perch-none, rifle. New prompt ids: crouch, silent, perch, perchDrop, distract, vent, ledgeStealth, spotted, rifle.
```

### How a goon's awareness works (the rules every task implements)

| Alert | Glyph | `e.aware` | What it does | Leaves when |
|---|---|---|---|---|
| `patrol` | none (white ring while the meter is above 0) | false | Walks its route (or huddles at fear 2) | Sees Batman (suspicious) or hears a noise (search) |
| `suspicious` | white, filling | false | Stops and stares at where it saw him | Meter 0.5 (search), meter 0 (patrol), meter 1 (shout) |
| `search` | yellow | false | Walks to the spot, looks round, tries nearby route spots for 20 s | Meter 1 (shout), 20 s (patrol) |
| `hunt` | red | true | Walks to the last known spot, no attacks | Anyone sees Batman (engage), 8 s unseen (search) |
| `engage` | red | true | The normal fight AI; rifles aim and fire while they can see him | 1 s unseen (hunt), 8 s unseen (search) |

- Seeing: within the cone (70 degrees, 110 when hostile) and the range (25 m, times 0.55 out of every light pool, times 0.6 crouched), not above 3 m unless hostile, never while Batman is in the vent steam crouched or mid-grapple, a perched Batman only by a hostile goon within 6 m, and a clear line from the goon's eyes to Batman's chest (10 Hz ray).
- Within 3 m inside the cone: spotted at once. The shout brings every goon in the room to `hunt`, and anyone who sees Batman makes all of them `engage`.
- Noises within their radius (step 5 m, sprint 9 m, hard landing 10 m, batarang clang 12 m, silent takedown 3 m, perch drop 8 m) send non-hostile goons to `search` at the noise.
- Every takedown raises fear (cap 3): goons move 12% faster per level, huddle back to back at fear 2 (or with 2 left), and one of them calls out a line.

---

### Task 1: Vision, hearing and takedown rules (pure)

**Files:**
- Create: `src/stealth/vision.js`
- Test: `tests/unit/vision.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: everything listed under `src/stealth/vision.js` in Shared interfaces.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/vision.test.js
import { describe, it, expect } from 'vitest';
import {
  STEALTH, inCone, inShadow, inRect, sightRange, canLook, spotCheck, fillRate, hears, footstepNoise, perchedOn,
  canSilentTakedown, pickSilentTarget, pickPerchDrop,
} from '../../src/stealth/vision.js';

const P = (x, y, z) => ({ x, y, z });
const goonAt = (x, z, yaw = 0, o = {}) => ({ pos: P(x, 0, z), yaw, hostile: false, ...o });
const heroAt = (x, z, o = {}) => ({ pos: P(x, o.y ?? 0, z), crouched: false, perched: false, hidden: false, flying: false, ...o });
const LIT = [{ x: 0, z: 10, r: 30 }];
const enemy = (id, x, z, yaw = 0, o = {}) => ({ id, alive: true, down: false, air: false, aware: false, stunned: false, state: 'patrol', def: {}, pos: P(x, o.y ?? 0, z), yaw, ...o });

describe('the vision cone', () => {
  it('is 70 degrees wide around the facing (yaw 0 faces +z)', () => {
    expect(inCone(P(0, 0, 0), 0, P(6.7, 0, 10))).toBe(true);   // 33.8 degrees off
    expect(inCone(P(0, 0, 0), 0, P(7.4, 0, 10))).toBe(false);  // 36.5 degrees off
    expect(inCone(P(0, 0, 0), Math.PI, P(0, 0, -5))).toBe(true);
    expect(inCone(P(0, 0, 0), 0, P(0, 0, -5))).toBe(false);
  });
});

describe('range, light and hiding', () => {
  it('25 m standing in the light, shorter in shadow and crouched', () => {
    expect(sightRange({})).toBe(25);
    expect(sightRange({ shadow: true })).toBeCloseTo(13.75);
    expect(sightRange({ crouched: true })).toBeCloseTo(15);
    expect(sightRange({ crouched: true, shadow: true })).toBeCloseTo(8.25);
  });
  it('shadow is outside every light pool', () => {
    const lights = [{ x: 0, z: 0, r: 4 }];
    expect(inShadow(P(3, 0, 0), lights)).toBe(false);
    expect(inShadow(P(5, 0, 0), lights)).toBe(true);
    expect(inShadow(P(5, 0, 0), [])).toBe(true);
  });
  it('inRect is the vent footprint at floor height', () => {
    const vent = { x: 10, y: 0, z: 10, w: 3, d: 3 };
    expect(inRect(P(11, 0.1, 9), vent)).toBe(true);
    expect(inRect(P(12, 0, 10), vent)).toBe(false);
    expect(inRect(P(10, 2, 10), vent)).toBe(false);
    expect(inRect(P(10, 0, 10), null)).toBe(false);
  });
});

describe('spotCheck', () => {
  it('sees Batman ahead in the light at 20 m but not at 26 m', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 20), LIT)).toBeCloseTo(20);
    expect(spotCheck(goonAt(0, 0), heroAt(0, 26), [{ x: 0, z: 26, r: 5 }])).toBe(-1);
  });
  it('shadow and crouching shorten the range', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 12), [])).toBeCloseTo(12);
    expect(spotCheck(goonAt(0, 0), heroAt(0, 12, { crouched: true }), [])).toBe(-1);
  });
  it('never sees behind itself', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, -5), LIT)).toBe(-1);
  });
  it('a hostile goon looks wider', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(8, 10), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(8, 10), LIT)).toBeGreaterThan(0);
  });
  it('goons that are not hostile never look up; hostile ones spot a perched Batman only right below him', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 6, { y: 4 }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0), heroAt(1, 4, { y: 9, perched: true }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(1, 4, { y: 9, perched: true }), LIT)).toBeGreaterThan(0);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(1, 10, { y: 9, perched: true }), LIT)).toBe(-1);
  });
  it('the vent steam and a grapple in flight hide him completely', () => {
    expect(spotCheck(goonAt(0, 0), heroAt(0, 2, { hidden: true }), LIT)).toBe(-1);
    expect(spotCheck(goonAt(0, 0, 0, { hostile: true }), heroAt(0, 2, { flying: true }), LIT)).toBe(-1);
  });
});

describe('the awareness meter fill rate', () => {
  it('fills fast close up and slowly at the edge of the range', () => {
    expect(fillRate(0, 25)).toBeCloseTo(STEALTH.fill);
    expect(fillRate(25, 25)).toBeCloseTo(STEALTH.minFill);
    expect(fillRate(50, 25)).toBeCloseTo(STEALTH.minFill);
    expect(fillRate(5, 25)).toBeGreaterThan(fillRate(15, 25));
  });
});

describe('noise', () => {
  it('carries its radius across and 5 m up or down', () => {
    expect(hears(P(0, 0, 0), P(4, 0, 0), 5)).toBe(true);
    expect(hears(P(0, 0, 0), P(6, 0, 0), 5)).toBe(false);
    expect(hears(P(0, 0, 0), P(0, 6, 0), 5)).toBe(false);
  });
  it('footsteps: silent crouched, 5 m walking, 9 m sprinting', () => {
    expect(footstepNoise({ crouched: true, sprint: true })).toBe(0);
    expect(footstepNoise({})).toBe(5);
    expect(footstepNoise({ sprint: true })).toBe(9);
  });
});

describe('perches', () => {
  const perches = [{ x: 0, y: 10, z: 0, perch: true }, { x: 5, y: 10, z: 0 }];
  it('finds the perch Batman stands on', () => {
    expect(perchedOn(P(0.5, 10, 0), perches)).toBe(perches[0]);
    expect(perchedOn(P(5, 10, 0), perches)).toBe(null);
    expect(perchedOn(P(0.5, 11, 0), perches)).toBe(null);
    expect(perchedOn(P(2, 10, 0), perches)).toBe(null);
  });
});

describe('canLook', () => {
  it('is false while a goon is hit, down, held, frozen, dancing or out', () => {
    expect(canLook(enemy('a', 0, 0))).toBe(true);
    for (const state of ['hit', 'stunned', 'down', 'getup', 'grabbed', 'chained', 'tied', 'frozen', 'dance', 'ko']) {
      expect(canLook(enemy('a', 0, 0, 0, { state })), state).toBe(false);
    }
    expect(canLook(enemy('a', 0, 0, 0, { stunned: true }))).toBe(false);
    expect(canLook(enemy('a', 0, 0, 0, { alive: false }))).toBe(false);
  });
});

describe('the silent takedown', () => {
  const H = P(0, 0, 0);
  it('works within 1.6 m from behind on a goon that has not noticed Batman', () => {
    expect(canSilentTakedown(enemy('g', 0, 1), H)).toBe(true);
    expect(canSilentTakedown(enemy('g', 0, 1, Math.PI), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, Math.PI / 2), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 2), H)).toBe(false);
  });
  it('not on aware goons, the boss, another floor, or anyone held', () => {
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { aware: true }), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { def: { boss: true } }), H)).toBe(false);
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { y: 1 }), H)).toBe(false);
    for (const state of ['grabbed', 'chained', 'tied', 'frozen']) expect(canSilentTakedown(enemy('g', 0, 1, 0, { state }), H), state).toBe(false);
  });
  it('a searching goon (yellow, not aware) can still be taken from behind', () => {
    expect(canSilentTakedown(enemy('g', 0, 1, 0, { state: 'search' }), H)).toBe(true);
  });
  it('picks the closest one', () => {
    const list = [enemy('far', 0, 1.5), enemy('near', 0, 0.9), enemy('facing', 0.2, 0.8, Math.PI)];
    expect(pickSilentTarget(H, list).id).toBe('near');
    expect(pickSilentTarget(H, [enemy('x', 0, 3)])).toBe(null);
  });
});

describe('the perch drop', () => {
  const perch = P(0, 9, 0);
  it('drops on the nearest goon within 5 m across and 1.5 to 14 m below', () => {
    const list = [enemy('a', 3, 1), enemy('b', 1, 1), enemy('c', 6, 0), enemy('high', 0.5, 0, 0, { y: 8 }), enemy('deep', 0.5, 0.5, 0, { y: -6 })];
    expect(pickPerchDrop(perch, list).id).toBe('b');
    expect(pickPerchDrop(perch, [list[2], list[3], list[4]])).toBe(null);
  });
  it('works on hostile goons too, but never the boss or a held goon', () => {
    expect(pickPerchDrop(perch, [enemy('a', 1, 0, 0, { aware: true })]).id).toBe('a');
    expect(pickPerchDrop(perch, [enemy('j', 1, 0, 0, { def: { boss: true } })])).toBe(null);
    expect(pickPerchDrop(perch, [enemy('t', 1, 0, 0, { state: 'tied' })])).toBe(null);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/vision.test.js`
Expected: FAIL. `src/stealth/vision.js` does not exist yet.

- [ ] **Step 3: Write `src/stealth/vision.js`**

```js
// Predator stealth: what a goon can see and hear, and where Batman can take one down from.
// Pure: no three.js. Points are plain { x, y, z }; yaw is radians and 0 faces +z (like ch.face).

export const STEALTH = {
  fov: (70 * Math.PI) / 180,         // full width of a goon's vision cone
  hostileFov: (110 * Math.PI) / 180, // a hostile goon looks around more
  range: 25,        // metres, Batman standing in the light
  shadow: 0.55,     // range factor when he is outside every light pool
  crouch: 0.6,      // range factor when he crouches
  instant: 3,       // this close inside the cone: spotted at once
  fill: 1.6,        // meter per second at point blank
  minFill: 0.3,     // meter per second at the edge of the range
  decay: 0.25,      // meter per second a suspicious goon loses while it sees nothing
  searchAt: 0.5,    // meter level that sends a goon to look (the glyph turns yellow)
  searchTime: 20,   // seconds a search lasts before the goon goes back to its patrol
  loseTime: 8,      // seconds unseen before a hostile squad falls back to searching
  huntAfter: 1,     // seconds unseen before engaged goons walk to the last known spot
  lookUp: 3,        // goons that aren't hostile never look higher than this above their feet
  perchSpot: 6,     // hostile goons spot a perched Batman only this close (planar)
  eye: 1.6, chest: 1.1, crouchChest: 0.7,
  hearDy: 5,        // noises carry this far up or down
  noise: { step: 5, sprint: 9, land: 10, batarang: 12, takedown: 3, perch: 8 },
  silentReach: 1.6,  // metres between Batman and the goon's back
  silentBehind: -0.2, // cos of the angle between the goon's facing and the way to Batman
  silentTime: 2,     // seconds a silent takedown takes
  perchOn: 0.9,      // metres from a perch point that count as standing on it
  perchReach: 5, perchMinDrop: 1.5, perchMaxDrop: 14,
};

// States in which a goon can't look around or react: being hit, held, tied, frozen, dancing or out.
export const BLIND = new Set(['hit', 'stunned', 'down', 'getup', 'grabbed', 'chained', 'tied', 'frozen', 'dance', 'ko']);
// States in which a goon can't be grabbed for a takedown.
export const HELD = new Set(['grabbed', 'chained', 'tied', 'frozen', 'ko']);

export const planar = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

// Whether p is inside a cone of full width fov around yaw, seen from `from` (planar).
export function inCone(from, yaw, p, fov = STEALTH.fov) {
  const dx = p.x - from.x, dz = p.z - from.z, d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  return (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / d >= Math.cos(fov / 2);
}

export function inShadow(p, lights = []) {
  for (const l of lights) if (Math.hypot(p.x - l.x, p.z - l.z) <= l.r) return false;
  return true;
}

export const inRect = (p, r) => !!r && Math.abs(p.x - r.x) <= r.w / 2 && Math.abs(p.z - r.z) <= r.d / 2 && Math.abs(p.y - r.y) < 0.8;

export function sightRange({ crouched = false, shadow = false } = {}, rules = STEALTH) {
  return rules.range * (crouched ? rules.crouch : 1) * (shadow ? rules.shadow : 1);
}

export const canLook = (e) => !!e && e.alive && !e.down && !e.air && !e.stunned && !BLIND.has(e.state);

// How far away the goon sees Batman, or -1. Everything except the line of sight, which the
// runtime casts afterwards (and only when this says yes).
// goon: { pos, yaw, hostile }; hero: { pos, crouched, perched, hidden, flying }
export function spotCheck(goon, hero, lights = [], rules = STEALTH) {
  if (hero.hidden || hero.flying) return -1;
  const d = planar(goon.pos, hero.pos);
  const rise = hero.pos.y - goon.pos.y;
  if (hero.perched) { if (!goon.hostile || d > rules.perchSpot) return -1; }
  else if (rise > rules.lookUp && !goon.hostile) return -1;
  if (d > sightRange({ crouched: hero.crouched, shadow: inShadow(hero.pos, lights) }, rules)) return -1;
  if (!inCone(goon.pos, goon.yaw, hero.pos, goon.hostile ? rules.hostileFov : rules.fov)) return -1;
  return d;
}

// Meter per second while a goon sees Batman at distance d with this sight range.
export function fillRate(d, range, rules = STEALTH) {
  const k = Math.min(1, Math.max(0, d / Math.max(1e-6, range)));
  return rules.minFill + (rules.fill - rules.minFill) * (1 - k) * (1 - k);
}

export const hears = (listener, at, radius, rules = STEALTH) => planar(listener, at) <= radius && Math.abs(listener.y - at.y) <= rules.hearDy;

export function footstepNoise({ sprint = false, crouched = false } = {}, rules = STEALTH) {
  if (crouched) return 0;
  return sprint ? rules.noise.sprint : rules.noise.step;
}

// The perch Batman stands on (a grapple point marked perch), or null.
export function perchedOn(pos, perches, rules = STEALTH) {
  for (const p of perches) {
    if (!p.perch || Math.abs(pos.y - p.y) > 0.5) continue;
    if (planar(pos, p) <= rules.perchOn) return p;
  }
  return null;
}

// Batman can choke out a goon from behind: close, same floor, behind its shoulders, and it
// hasn't noticed him (hunting and fighting goons are aware).
export function canSilentTakedown(e, heroPos, rules = STEALTH) {
  if (!e || !e.alive || e.down || e.air || e.aware || e.def?.boss) return false;
  if (HELD.has(e.state)) return false;
  if (Math.abs(e.pos.y - heroPos.y) > 0.6) return false;
  const dx = heroPos.x - e.pos.x, dz = heroPos.z - e.pos.z, d = Math.hypot(dx, dz);
  if (d > rules.silentReach || d < 1e-6) return false;
  return (dx * Math.sin(e.yaw) + dz * Math.cos(e.yaw)) / d <= rules.silentBehind;
}

export function pickSilentTarget(heroPos, enemies, rules = STEALTH) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (!canSilentTakedown(e, heroPos, rules)) continue;
    const d = planar(heroPos, e.pos);
    if (d < bestD) { best = e; bestD = d; }
  }
  return best;
}

// From a perch: the nearest goon below, close enough across and neither too shallow nor too deep.
export function pickPerchDrop(heroPos, enemies, rules = STEALTH) {
  let best = null, bestD = Infinity;
  for (const e of enemies) {
    if (!e || !e.alive || e.down || e.air || e.def?.boss || HELD.has(e.state)) continue;
    const drop = heroPos.y - e.pos.y;
    if (drop < rules.perchMinDrop || drop > rules.perchMaxDrop) continue;
    const d = planar(heroPos, e.pos);
    if (d <= rules.perchReach && d < bestD) { best = e; bestD = d; }
  }
  return best;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/vision.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stealth/vision.js tests/unit/vision.test.js
git commit -m "Stealth vision, hearing and takedown rules"
```

---

### Task 2: Awareness brain, squad alarm, fear and lines (pure)

**Files:**
- Create: `src/stealth/brain.js`
- Test: `tests/unit/brain.test.js`

**Interfaces:**
- Consumes: `STEALTH`, `fillRate` (Task 1).
- Produces: everything listed under `src/stealth/brain.js` in Shared interfaces. `m.rev` increases every time the brain gives a goon a new place to go, so the runtime can tell a fresh target from an old one without comparing floats.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/brain.test.js
import { describe, it, expect } from 'vitest';
import { STEALTH } from '../../src/stealth/vision.js';
import {
  HOSTILE, createSquad, createMind, thinkGoon, alarmAll, thinkSquad, smokeReset, struck, noteTakedown, fearSpeed, huddles,
  LINES, pickLine, glyphCode, glyphColor, glyphFill, stateColor,
} from '../../src/stealth/brain.js';

const P = (x, y, z) => ({ x, y, z });
const see = (d, hero = P(0, 0, d)) => ({ seesAt: d, range: 25, hero, noise: null });
const blind = (noise = null) => ({ seesAt: -1, range: 25, hero: P(0, 0, 0), noise });
function run(m, squad, sense, secs, dt = 0.05) {
  const evs = [];
  for (let t = 0; t < secs - 1e-9; t += dt) { const e = thinkGoon(m, squad, sense, dt); if (e) evs.push(e); }
  return evs;
}

describe('a goon noticing Batman', () => {
  it('turns suspicious (white), then searches (yellow), then shouts (red)', () => {
    const m = createMind(), s = createSquad();
    const evs = run(m, s, see(15), 3);
    expect(evs[0]).toBe('suspect');
    expect(evs).toContain('search');
    expect(evs.at(-1)).toBe('shout');
    expect(m.alert).toBe('engage');
    expect(s.alarm).toBe(true);
    expect(s.lastKnown).toEqual(P(0, 0, 15));
  });
  it('inside 3 m of the cone it is spotted at once', () => {
    const m = createMind(), s = createSquad();
    expect(run(m, s, see(2.5), 0.05)).toEqual(['shout']);
  });
  it('a glimpse that ends fades back to patrol', () => {
    const m = createMind(), s = createSquad();
    run(m, s, see(20), 0.4);
    expect(m.alert).toBe('suspicious');
    expect(m.meter).toBeGreaterThan(0);
    expect(run(m, s, blind(), 2)).toEqual(['calm']);
    expect(m.alert).toBe('patrol');
    expect(m.meter).toBe(0);
  });
});

describe('noises and searching', () => {
  it('a noise sends a patrolling goon to search where it came from', () => {
    const m = createMind(), s = createSquad();
    const rev = m.rev;
    expect(run(m, s, blind(P(4, 0, 2)), 0.05)).toEqual(['hear']);
    expect(m.alert).toBe('search');
    expect(m.target).toEqual(P(4, 0, 2));
    expect(m.rev).toBeGreaterThan(rev);
    expect(m.searchLeft).toBe(STEALTH.searchTime);
  });
  it('a new noise while searching moves the search', () => {
    const m = createMind(), s = createSquad();
    run(m, s, blind(P(4, 0, 2)), 0.05);
    run(m, s, blind(P(-3, 0, 1)), 0.05);
    expect(m.target).toEqual(P(-3, 0, 1));
  });
  it('a search gives up after 20 s and the goon goes back to its patrol', () => {
    const m = createMind(), s = createSquad();
    run(m, s, blind(P(4, 0, 2)), 0.05);
    const evs = run(m, s, blind(), 21);
    expect(evs).toEqual(['giveUp']);
    expect(m.alert).toBe('patrol');
  });
  it('a searching goon fills faster when it sees him', () => {
    const a = createMind(), b = createMind(), s = createSquad();
    run(a, s, blind(P(0, 0, 10)), 0.05);
    a.meter = 0.5; b.meter = 0.5; b.alert = 'suspicious';
    run(a, createSquad(), see(20), 0.2);
    run(b, createSquad(), see(20), 0.2);
    expect(a.meter).toBeGreaterThan(b.meter);
  });
});

describe('the squad alarm', () => {
  it('the shout brings every other goon hunting to the last known spot', () => {
    const s = createSquad(), a = createMind(), b = createMind(), c = createMind();
    run(a, s, see(2), 0.05);
    expect(alarmAll([a, b, c], s)).toBe(2);
    for (const m of [b, c]) { expect(m.alert).toBe('hunt'); expect(m.target).toEqual(s.lastKnown); }
    expect([...HOSTILE].sort()).toEqual(['engage', 'hunt']);
  });
  it('a hunting goon engages while anyone in the squad sees Batman, and hunts again a second after', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    thinkGoon(b, s, blind(), 0.05);
    expect(b.alert).toBe('engage');
    s.unseenT = 1.2;
    thinkGoon(b, s, blind(), 0.05);
    expect(b.alert).toBe('hunt');
    expect(b.target).toEqual(s.lastKnown);
  });
  it('after 8 s with nobody seeing him, everyone falls back to searching', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    for (let i = 0; i < 79; i++) expect(thinkSquad(s, [a, b], false, 0.1)).toBe(null);
    expect(thinkSquad(s, [a, b], false, 0.2)).toBe('lost');
    expect(s.alarm).toBe(false);
    for (const m of [a, b]) { expect(m.alert).toBe('search'); expect(m.searchLeft).toBe(STEALTH.searchTime); }
  });
  it('seeing him again restarts the 8 s', () => {
    const s = createSquad(), a = createMind();
    run(a, s, see(2), 0.05);
    thinkSquad(s, [a], false, 7);
    thinkSquad(s, [a], true, 0.1);
    expect(thinkSquad(s, [a], false, 7)).toBe(null);
  });
  it('smoke resets every goon to searching around the cloud', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    run(a, s, see(2), 0.05);
    alarmAll([a, b], s);
    smokeReset([a, b], s, P(9, 0, 9));
    expect(s.alarm).toBe(false);
    for (const m of [a, b]) { expect(m.alert).toBe('search'); expect(m.target).toEqual(P(9, 0, 9)); }
  });
  it('a stun sends a goon to search; a punch that lands makes it hostile', () => {
    const s = createSquad(), a = createMind(), b = createMind();
    expect(struck(a, s, P(1, 0, 1), 'stun')).toBe('search');
    expect(a.alert).toBe('search');
    expect(struck(b, s, P(1, 0, 1), 'parried')).toBe('shout');
    expect(b.alert).toBe('engage');
    expect(struck(b, s, P(1, 0, 1), 'hit')).toBe(null);
  });
});

describe('fear', () => {
  it('rises with each takedown and stops at 3', () => {
    const s = createSquad();
    expect([noteTakedown(s), noteTakedown(s), noteTakedown(s), noteTakedown(s)]).toEqual([1, 2, 3, 3]);
    expect(s.kos).toBe(4);
  });
  it('makes goons faster and huddle together at fear 2 or with two left', () => {
    expect(fearSpeed(0)).toBe(1);
    expect(fearSpeed(3)).toBeCloseTo(1.36);
    expect(huddles(1, 3)).toBe(false);
    expect(huddles(2, 3)).toBe(true);
    expect(huddles(1, 2)).toBe(true);
  });
});

describe('lines and the HUD', () => {
  it('every line is short, lettered and free of dashes', () => {
    for (const [kind, list] of Object.entries(LINES)) {
      expect(list.length, kind).toBeGreaterThan(0);
      for (const l of list) { expect(l).not.toMatch(/[\u2013\u2014]/); expect(l.length).toBeLessThan(40); }
    }
    expect(pickLine('fear2', 0)).toBe(LINES.fear2[0]);
    expect(pickLine('fear2', LINES.fear2.length)).toBe(LINES.fear2[0]);
    expect(LINES.fear2).toContain('Where is it?!');
  });
  it('glyph codes: nothing on a calm patrol, white while noticing, yellow searching, red hostile', () => {
    const m = createMind();
    expect(glyphCode(m)).toBe(0);
    m.alert = 'suspicious'; m.meter = 0.25;
    expect(glyphColor(glyphCode(m))).toBe('white');
    expect(glyphFill(glyphCode(m))).toBeCloseTo(8 / 31, 2);
    m.alert = 'search'; m.meter = 0.6;
    expect(glyphColor(glyphCode(m))).toBe('yellow');
    m.alert = 'hunt';
    expect(glyphColor(glyphCode(m))).toBe('red');
    expect(glyphFill(glyphCode(m))).toBe(1);
  });
  it('detective vision colours: patrolling, searching, hostile', () => {
    const m = createMind();
    expect(stateColor(m)).toBe(0);
    m.alert = 'suspicious'; expect(stateColor(m)).toBe(0);
    m.alert = 'search'; expect(stateColor(m)).toBe(1);
    m.alert = 'engage'; expect(stateColor(m)).toBe(2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/brain.test.js`
Expected: FAIL. `src/stealth/brain.js` does not exist yet.

- [ ] **Step 3: Write `src/stealth/brain.js`**

```js
// Predator stealth: how each goon's awareness moves between patrol, suspicious, search, hunt and
// engage, the squad alarm and its fall-back to searching, smoke, hit reactions, fear, the lines
// goons call out, and what the HUD glyph shows. Pure: no three.js, no allocation per call.
import { STEALTH, fillRate } from './vision.js';

export const HOSTILE = new Set(['hunt', 'engage']);

export function createSquad() {
  return { alarm: false, unseenT: 0, lastKnown: { x: 0, y: 0, z: 0 }, fear: 0, kos: 0 };
}

export function createMind() {
  return { alert: 'patrol', meter: 0, target: { x: 0, y: 0, z: 0 }, rev: 0, searchLeft: 0, t: 0 };
}

const setP = (o, p) => { o.x = p.x; o.y = p.y; o.z = p.z; return o; };
// A new place to go: the runtime notices the bumped rev.
const aim = (m, p) => { setP(m.target, p); m.rev += 1; };

function startSearch(m, at, rules) {
  const was = m.alert;
  m.alert = 'search';
  m.meter = Math.max(m.meter, rules.searchAt);
  m.searchLeft = rules.searchTime;
  m.t = 0;
  aim(m, at);
  return was === 'search' ? null : 'search';
}

export function goHostile(m, squad, at) {
  m.alert = 'engage';
  m.meter = 1;
  m.t = 0;
  squad.alarm = true;
  squad.unseenT = 0;
  setP(squad.lastKnown, at);
  return 'shout';
}

// One goon, one frame. Returns what changed (for the lines and sounds), or null.
export function thinkGoon(m, squad, sense, dt, rules = STEALTH) {
  m.t += dt;
  const sees = sense.seesAt >= 0;
  if (HOSTILE.has(m.alert)) {
    if (sees) { m.alert = 'engage'; squad.unseenT = 0; setP(squad.lastKnown, sense.hero); }
    else if (squad.unseenT < rules.huntAfter) m.alert = 'engage';
    else if (m.alert === 'engage') { m.alert = 'hunt'; aim(m, squad.lastKnown); }
    return null;
  }
  if (sees) {
    if (sense.seesAt <= rules.instant) m.meter = 1;
    else m.meter = Math.min(1, m.meter + fillRate(sense.seesAt, sense.range, rules) * dt * (m.alert === 'search' ? 1.5 : 1));
    aim(m, sense.hero);
    if (m.meter >= 1) return goHostile(m, squad, sense.hero);
  }
  if (m.alert === 'patrol') {
    if (sense.noise) return startSearch(m, sense.noise, rules) && 'hear';
    if (sees && m.meter > 0) { m.alert = 'suspicious'; m.t = 0; return 'suspect'; }
    return null;
  }
  if (m.alert === 'suspicious') {
    if (m.meter >= rules.searchAt) return startSearch(m, m.target, rules);
    if (sense.noise) return startSearch(m, sense.noise, rules) && 'hear';
    if (!sees) {
      m.meter = Math.max(0, m.meter - rules.decay * dt);
      if (m.meter === 0) { m.alert = 'patrol'; m.t = 0; return 'calm'; }
    }
    return null;
  }
  // Searching: stays yellow, follows new noises, and gives up after searchTime.
  if (sense.noise) aim(m, sense.noise);
  if (!sees) m.meter = Math.max(rules.searchAt, m.meter - rules.decay * 0.5 * dt);
  m.searchLeft -= dt;
  if (m.searchLeft <= 0) { m.alert = 'patrol'; m.meter = 0; m.t = 0; return 'giveUp'; }
  return null;
}

// A shout: every goon that isn't hostile yet goes hunting at the last known spot.
export function alarmAll(minds, squad) {
  let n = 0;
  for (const m of minds) {
    if (!m || HOSTILE.has(m.alert)) continue;
    m.alert = 'hunt';
    m.meter = 1;
    m.t = 0;
    aim(m, squad.lastKnown);
    n += 1;
  }
  return n;
}

// The squad clock: while the alarm is up and nobody sees Batman it counts, and after loseTime
// every hostile goon falls back to searching around the last known spot.
export function thinkSquad(squad, minds, anySees, dt, rules = STEALTH) {
  if (!squad.alarm) return null;
  squad.unseenT = anySees ? 0 : squad.unseenT + dt;
  if (squad.unseenT < rules.loseTime) return null;
  squad.alarm = false;
  for (const m of minds) {
    if (!m || !HOSTILE.has(m.alert)) continue;
    m.alert = 'search';
    m.meter = 0.75;
    m.searchLeft = rules.searchTime;
    m.t = 0;
    aim(m, squad.lastKnown);
  }
  return 'lost';
}

// Smoke pellet in stealth: every goon's alert resets to searching around the cloud.
export function smokeReset(minds, squad, at, rules = STEALTH) {
  squad.alarm = false;
  squad.unseenT = 0;
  setP(squad.lastKnown, at);
  for (const m of minds) {
    if (!m) continue;
    m.alert = 'search';
    m.meter = rules.searchAt;
    m.searchLeft = rules.searchTime;
    m.t = 0;
    aim(m, at);
  }
}

// A goon hit by something that didn't knock it out. A stun (batarang, remote, cape) sends it to
// look where Batman is; a blow that lands or is parried means it has found him.
export function struck(m, squad, at, outcome, rules = STEALTH) {
  if (outcome === 'ko') return null;
  if (HOSTILE.has(m.alert)) { setP(squad.lastKnown, at); squad.unseenT = 0; return null; }
  if (outcome === 'stun') return startSearch(m, at, rules);
  return goHostile(m, squad, at);
}

export function noteTakedown(squad) {
  squad.kos += 1;
  squad.fear = Math.min(3, squad.kos);
  return squad.fear;
}
export const fearSpeed = (fear) => 1 + 0.12 * fear;
export const huddles = (fear, alive) => fear >= 2 || alive <= 2;

// Lettered as speech balloons over the goon who says them.
export const LINES = {
  spot: ['THERE HE IS!', "IT'S THE BAT!", 'OVER HERE! GET HIM!'],
  hear: ['What was that?', 'Who is there?', 'Hello...?'],
  suspect: ['Huh?', 'Did something move?'],
  lost: ['Where did he go?!', 'Spread out! Find him!', 'He was right here!'],
  calm: ['Must have been a rat.', 'Nothing. Back to it.'],
  fear1: ['Hey, where did Vinnie go?', 'Anybody else hear that?'],
  fear2: ['Where is it?!', 'Stick together!'],
  fear3: ["It's just me now, isn't it?", 'I want my mom!'],
};
export function pickLine(kind, n) {
  const list = LINES[kind] ?? LINES.hear;
  return list[((n % list.length) + list.length) % list.length];
}

// What the awareness glyph over a goon shows: 0 = nothing, else colour * 32 + fill step (0..31),
// colour 1 white (noticing), 2 yellow (searching), 3 red (hostile).
export function glyphCode(m) {
  if (!m) return 0;
  if (HOSTILE.has(m.alert)) return 3 * 32 + 31;
  const step = Math.round(Math.min(1, Math.max(0, m.meter)) * 31);
  if (m.alert === 'search') return 2 * 32 + step;
  if (m.meter > 0) return 32 + step;
  return 0;
}
export const glyphColor = (code) => ['', 'white', 'yellow', 'red'][code >> 5] ?? '';
export const glyphFill = (code) => (code & 31) / 31;

// Detective vision colour index: 0 patrolling (or only noticing), 1 searching, 2 hostile.
export const stateColor = (m) => (!m ? 0 : HOSTILE.has(m.alert) ? 2 : m.alert === 'search' ? 1 : 0);
```

`startSearch(...) && 'hear'` returns `'hear'` when the goon just started searching because of a noise, and `null` when it was already searching.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/brain.test.js`
Expected: PASS. If a timing test fails, fix the rule in `brain.js`, not the numbers in the test: they follow `STEALTH`.

- [ ] **Step 5: Commit**

```bash
git add src/stealth/brain.js tests/unit/brain.test.js
git commit -m "Stealth awareness brain: alerts, squad alarm, smoke, fear, lines, glyph codes"
```

---

### Task 3: Patrol routes and the two rooms as data (pure)

**Files:**
- Create: `src/stealth/patrol.js`, `src/stealth/stealthRooms.js`
- Modify: `src/world/mapData.js` (four `SITES`)
- Test: `tests/unit/patrol.test.js`, `tests/unit/stealthRooms.test.js`

**Interfaces:**
- Consumes: `SITES` from `src/world/mapData.js`.
- Produces: everything listed under `patrol.js` and `stealthRooms.js` in Shared interfaces; `SITES.monarchBalcony`, `SITES.monarchBalconyEntry`, `SITES.aceCatwalks`, `SITES.aceCatwalksEntry`.

The map's axes: x is east, z is south (north is -z), y is up. A yaw of 0 faces +z (south), `Math.PI / 2` faces east, `Math.PI` faces north, `-Math.PI / 2` faces west.

Where the rooms are, in the city as it stands:
- **Monarch Balcony.** The Monarch Theater is the landmark at x 160 to 200, z -80 to -40, 22 m tall, with its marquee and fire escape on the west (street) face. The balcony is a new 6 m deep deck on the quiet east face at 13 m, from z -78 to -42, with three lit doorways, two stone planters for cover and four gargoyles on the roof's east parapet 10 m above it. You arrive on the roof after the "Crash the party crashers" fight.
- **Ace Chemicals Catwalks.** The vat hall is the open yard around the two existing vats at (112, -112) and (128, -126), west of the vat deck and its existing 10 m catwalk. It gets a 7 m catwalk "H" (two long walkways joined by a spine that runs between the vats), four steel columns with a gargoyle on each, six crates, three lamp posts (the vats already glow), and a steaming floor vent under the spine. You arrive on the vat deck roof after "Protect the cake!".

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/patrol.test.js
import { describe, it, expect } from 'vitest';
import { createPatrol, stepPatrol, huddleSpot, pickSpot, segmentHitsRect } from '../../src/stealth/patrol.js';

const P = (x, y, z) => ({ x, y, z });
const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });

describe('stepPatrol', () => {
  const route = { mode: 'pingpong', points: [W(0, 0, 0, 1, Math.PI), W(10, 0, 0), W(10, 0, 10, 2)] };
  it('walks toward the current point', () => {
    const p = createPatrol(), out = {};
    expect(stepPatrol(p, route, P(5, 0, 5), 0.1, out)).toBe(false);
    expect(out).toMatchObject({ x: 0, y: 0, z: 0, face: null });
  });
  it('waits at a point facing its yaw, then heads for the next one', () => {
    const p = createPatrol(), out = {};
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(true);
    expect(out.face).toBe(Math.PI);
    for (let i = 0; i < 9; i++) expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(true);
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.11, out)).toBe(true);
    expect(stepPatrol(p, route, P(0.1, 0, 0), 0.1, out)).toBe(false);
    expect(out).toMatchObject({ x: 10, z: 0 });
  });
  it('pingpong turns round at the ends; loop wraps', () => {
    const seq = (mode, n) => {
      const r = { mode, points: [W(0, 0, 0), W(10, 0, 0), W(10, 0, 10)] };
      const q = createPatrol(), out = {}, s = [];
      for (let k = 0; k < n; k++) { s.push(q.i); stepPatrol(q, r, r.points[q.i], 0.1, out); }
      return s;
    };
    expect(seq('pingpong', 6)).toEqual([0, 1, 2, 1, 0, 1]);
    expect(seq('loop', 5)).toEqual([0, 1, 2, 0, 1]);
  });
  it('a single point with a wait is a guard that never leaves', () => {
    const r = { mode: 'pingpong', points: [W(5, 0, 5, 4, 0.5)] };
    const p = createPatrol(), out = {};
    for (let i = 0; i < 100; i++) expect(stepPatrol(p, r, P(5, 0, 5), 0.1, out)).toBe(true);
    expect(out).toMatchObject({ x: 5, z: 5, face: 0.5 });
  });
});

describe('huddle and search spots', () => {
  it('huddleSpot spreads goons round the centre, back to back', () => {
    const out = {};
    expect(huddleSpot(P(10, 0, 10), 0, 2, out)).toMatchObject({ x: 10, z: 11.6, face: 0 });
    huddleSpot(P(10, 0, 10), 1, 2, out);
    expect(out.x).toBeCloseTo(10);
    expect(out.z).toBeCloseTo(8.4);
    expect(out.face).toBeCloseTo(Math.PI);
  });
  it('pickSpot cycles through walkable spots on the same level near the centre', () => {
    const spots = [P(0, 0, 0), P(5, 0, 0), P(0, 7, 0), P(30, 0, 0)];
    const out = {};
    expect(pickSpot(spots, P(0, 0, 0), 0, 0, out)).toMatchObject({ x: 0, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 0, 1, out)).toMatchObject({ x: 5, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 0, 2, out)).toMatchObject({ x: 0, z: 0 });
    expect(pickSpot(spots, P(0, 0, 0), 7, 0, out)).toMatchObject({ x: 0, y: 7, z: 0 });
    expect(pickSpot(spots, P(100, 0, 0), 0, 0, out)).toBe(null);
  });
});

describe('segmentHitsRect', () => {
  it('finds a leg that crosses a box, with a clearance pad', () => {
    const a = P(0, 0, 0), b = P(10, 0, 0);
    expect(segmentHitsRect(a, b, { x: 5, z: 0, w: 1, d: 1 })).toBe(true);
    expect(segmentHitsRect(a, b, { x: 5, z: 0.5, w: 1, d: 0.4 })).toBe(false);
    expect(segmentHitsRect(a, b, { x: 5, z: 0.5, w: 1, d: 0.4 }, 0.5)).toBe(true);
    expect(segmentHitsRect(a, b, { x: 12, z: 0, w: 1, d: 1 })).toBe(false);
  });
});
```

```js
// tests/unit/stealthRooms.test.js
import { describe, it, expect } from 'vitest';
import { ROOMS, ROOM_IDS, roomSquad, roomSpots, stealthFight } from '../../src/stealth/stealthRooms.js';
import { segmentHitsRect } from '../../src/stealth/patrol.js';
import { SITES } from '../../src/world/mapData.js';

const inside = (b, p) => p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ && p.y >= b.minY && p.y <= b.maxY;
function legs(route) {
  const pts = route.points, out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  if (route.mode === 'loop' && pts.length > 2) out.push([pts.at(-1), pts[0]]);
  return out;
}
// Everything a goon could walk into: cover, perch columns, catwalk posts and lamp posts, with their heights.
function obstacles(room) {
  return [
    ...room.cover.map((c) => ({ x: c.x, z: c.z, w: c.w, d: c.d, y0: c.y, y1: c.y + c.h })),
    ...room.columns.map((c) => ({ x: c.x, z: c.z, w: 1, d: 1, y0: c.y0, y1: c.top })),
    ...room.posts.map((p) => ({ x: p.x, z: p.z, w: 0.2, d: 0.2, y0: p.y0, y1: p.y1 })),
    ...room.lights.filter((l) => l.lamp === 'post').map((l) => ({ x: l.x, z: l.z, w: 0.3, d: 0.3, y0: l.base, y1: l.y })),
  ];
}

describe('the predator rooms', () => {
  it('has the two story rooms', () => {
    expect(ROOM_IDS).toEqual(['monarchBalcony', 'aceCatwalks']);
  });
  it('each room points at real sites and has four perches, lights, a huddle and a squad of four', () => {
    for (const r of Object.values(ROOMS)) {
      expect(SITES[r.site], r.id).toBeDefined();
      expect(SITES[r.entry], r.id).toBeDefined();
      expect(r.perches).toHaveLength(4);
      expect(r.lights.length).toBeGreaterThan(2);
      expect(r.huddle).toBeTruthy();
      expect(r.squad).toHaveLength(4);
      expect(r.name).not.toMatch(/[\u2013\u2014]/);
    }
  });
  it('the balcony has three rifles and one thug; the catwalks four rifles, a vent and catwalk decks', () => {
    const count = (r, t) => r.squad.filter((g) => g.type === t).length;
    expect([count(ROOMS.monarchBalcony, 'rifle'), count(ROOMS.monarchBalcony, 'grunt')]).toEqual([3, 1]);
    expect(count(ROOMS.aceCatwalks, 'rifle')).toBe(4);
    expect(ROOMS.aceCatwalks.vent).toMatchObject({ w: 3, d: 3 });
    expect(ROOMS.aceCatwalks.decks.every((d) => d.kind === 'catwalk')).toBe(true);
  });
  it('every route point, perch, light and the huddle sit inside the room bounds', () => {
    for (const r of Object.values(ROOMS)) {
      for (const g of [...r.squad, ...r.encore]) for (const p of g.route.points) expect(inside(r.bounds, p), `${r.id} ${JSON.stringify(p)}`).toBe(true);
      for (const p of r.perches) expect(inside(r.bounds, p), `${r.id} perch`).toBe(true);
      for (const l of r.lights) expect(inside(r.bounds, { ...l, y: r.bounds.minY }), `${r.id} light`).toBe(true);
      expect(inside(r.bounds, r.huddle)).toBe(true);
    }
  });
  it('every leg stays on one level and keeps half a metre clear of cover, columns and posts', () => {
    for (const r of Object.values(ROOMS)) {
      const obs = obstacles(r);
      for (const g of [...r.squad, ...r.encore]) {
        for (const [a, b] of legs(g.route)) {
          expect(a.y, `${r.id} leg height`).toBe(b.y);
          for (const o of obs) {
            if (o.y1 < a.y || o.y0 > a.y + 1.8) continue;
            expect(segmentHitsRect(a, b, o, 0.5), `${r.id} ${JSON.stringify([a, b, o])}`).toBe(false);
          }
        }
      }
    }
  });
  it('roomSpots lists every walkable route point once', () => {
    const spots = roomSpots(ROOMS.aceCatwalks);
    expect(spots.length).toBeGreaterThan(8);
    expect(new Set(spots.map((s) => `${s.x},${s.y},${s.z}`)).size).toBe(spots.length);
  });
  it('stealthFight spawns the squad on its route starts', () => {
    const f = stealthFight('aceCatwalks');
    const site = SITES.aceCatwalks;
    expect(f).toMatchObject({ site: 'aceCatwalks', entry: 'aceCatwalksEntry', stealth: 'aceCatwalks', squad: 'main', radius: 24 });
    expect(f.waves).toHaveLength(1);
    f.waves[0].forEach((w, i) => {
      const p = ROOMS.aceCatwalks.squad[i].route.points[0];
      expect(w).toEqual({ type: ROOMS.aceCatwalks.squad[i].type, dx: p.x - site.x, dz: p.z - site.z, y: p.y });
    });
    expect(() => stealthFight('nope')).toThrow();
  });
  it('the encore squads (post-game) are at least as armed and one bigger on the catwalks', () => {
    for (const r of Object.values(ROOMS)) {
      const rifles = (l) => l.filter((g) => g.type === 'rifle').length;
      expect(rifles(roomSquad(r, 'encore'))).toBeGreaterThanOrEqual(rifles(roomSquad(r)));
    }
    expect(roomSquad(ROOMS.aceCatwalks, 'encore')).toHaveLength(5);
    expect(stealthFight('monarchBalcony', { squad: 'encore' }).waves[0].every((w) => w.type === 'rifle')).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/patrol.test.js tests/unit/stealthRooms.test.js`
Expected: FAIL. The modules and sites do not exist yet.

- [ ] **Step 3: Sites.** In `src/world/mapData.js`, add to `SITES` after `balcony`:

```js
  // Predator rooms (src/stealth/stealthRooms.js): each room's centre and where Batman arrives.
  monarchBalcony: { x: 203, y: 13, z: -60 },
  monarchBalconyEntry: { x: 192, y: 22, z: -60 },
  aceCatwalks: { x: 124, y: 0.15, z: -118 },
  aceCatwalksEntry: { x: 172, y: 10, z: -124 },
```

- [ ] **Step 4: Write `src/stealth/patrol.js`**

```js
// Predator patrols: walking a route (in a loop or back and forth, waiting and facing a way at
// some points), where scared goons huddle, and which walkable spot a searching goon tries next.
// Pure: writes into the caller's objects, so the runtime allocates nothing per frame.

export function createPatrol(start = 0) {
  return { i: start, dir: 1, waitT: 0 };
}

function advance(p, route) {
  const n = route.points.length;
  if (n < 2) return;
  if (route.mode === 'loop') { p.i = (p.i + 1) % n; return; }
  if (p.i + p.dir >= n || p.i + p.dir < 0) p.dir = -p.dir;
  p.i += p.dir;
}

const put = (out, pt, face) => { out.x = pt.x; out.y = pt.y; out.z = pt.z; out.face = face; return out; };

// Writes where to walk (or stand) into out { x, y, z, face }. Returns true while waiting at a point.
export function stepPatrol(p, route, pos, dt, out) {
  const pt = route.points[p.i];
  if (p.waitT > 0) {
    p.waitT -= dt;
    put(out, pt, pt.face ?? null);
    if (p.waitT <= 0) advance(p, route);
    return true;
  }
  if (Math.hypot(pos.x - pt.x, pos.z - pt.z) < 0.4) {
    if ((pt.wait ?? 0) > 0) { p.waitT = pt.wait; put(out, pt, pt.face ?? null); return true; }
    advance(p, route);
  }
  put(out, route.points[p.i], null);
  return false;
}

// Goon k of n stands on a ring round the centre, facing out (back to back).
export function huddleSpot(center, k, n, out, radius = 1.6) {
  const a = (k / Math.max(1, n)) * Math.PI * 2;
  out.x = center.x + Math.sin(a) * radius;
  out.y = center.y;
  out.z = center.z + Math.cos(a) * radius;
  out.face = a;
  return out;
}

// The k-th walkable spot (cycling) on the same level as y and within `within` of the centre.
const near = (s, center, y, within) => Math.abs(s.y - y) < 1 && Math.hypot(s.x - center.x, s.z - center.z) <= within;
export function pickSpot(spots, center, y, k, out, within = 12) {
  let n = 0;
  for (const s of spots) if (near(s, center, y, within)) n += 1;
  if (!n) return null;
  let i = ((k % n) + n) % n;
  for (const s of spots) {
    if (!near(s, center, y, within)) continue;
    if (i === 0) return put(out, s, null);
    i -= 1;
  }
  return null;
}

// Whether the leg a to b passes through the box rect { x, z, w, d } grown by pad (planar).
export function segmentHitsRect(a, b, rect, pad = 0) {
  const lo = [rect.x - rect.w / 2 - pad, rect.z - rect.d / 2 - pad];
  const hi = [rect.x + rect.w / 2 + pad, rect.z + rect.d / 2 + pad];
  const o = [a.x, a.z], d = [b.x - a.x, b.z - a.z];
  let t0 = 0, t1 = 1;
  for (let k = 0; k < 2; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < lo[k] || o[k] > hi[k]) return false; continue; }
    let u0 = (lo[k] - o[k]) / d[k], u1 = (hi[k] - o[k]) / d[k];
    if (u0 > u1) [u0, u1] = [u1, u0];
    t0 = Math.max(t0, u0);
    t1 = Math.min(t1, u1);
    if (t0 > t1) return false;
  }
  return true;
}
```

- [ ] **Step 5: Write `src/stealth/stealthRooms.js`**

```js
// The two predator rooms as data. src/world/stealthSets.js builds the scenery from this, the
// runtime (src/stealth/stealthSystem.js) reads the lights, perches, vent, huddle and routes, and
// roomCheck.js validates all of it against the live city. Every y is a walkable surface.
// Axes: x east, z south, y up; yaw 0 faces +z (south), PI / 2 east, PI north, -PI / 2 west.
import { SITES } from '../world/mapData.js';

const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });
const route = (mode, ...points) => ({ mode, points });
const toward = (x, z, cx, cz) => Math.atan2(cx - x, cz - z);
const SOUTH = 0, EAST = Math.PI / 2, NORTH = Math.PI, WEST = -Math.PI / 2;

// ---- Monarch Balcony: a deck on the theater's quiet east face, 9 m below the roof. ----
const monarchBalcony = {
  id: 'monarchBalcony', name: 'Monarch Balcony', site: 'monarchBalcony', entry: 'monarchBalconyEntry', radius: 14,
  bounds: { minX: 199, maxX: 207.5, minY: 11, maxY: 26, minZ: -79.5, maxZ: -40.5 },
  decks: [{ minX: 200, maxX: 206, minZ: -78, maxZ: -42, y: 13, t: 0.3, kind: 'balcony', grapples: 'x+' }],
  posts: [],
  columns: [],
  // Gargoyles on plinths on the roof's east parapet (roof at 22), looking out over the balcony.
  perches: [-74, -64, -56, -46].map((z) => ({ x: 200.32, y: 22.9, z, yaw: EAST, plinth: 22 })),
  cover: [
    { x: 203, y: 13, z: -66, w: 1.4, d: 1.4, h: 1.1, kind: 'planter' },
    { x: 203, y: 13, z: -54, w: 1.4, d: 1.4, h: 1.1, kind: 'planter' },
  ],
  rails: [
    { x1: 206, z1: -78, x2: 206, z2: -42, y: 13 },
    { x1: 200, z1: -78, x2: 206, z2: -78, y: 13 },
    { x1: 200, z1: -42, x2: 206, z2: -42, y: 13 },
  ],
  // Lamps over the three doorways: pools of light against the wall, shadow at the rail.
  lights: [-70, -60, -50].map((z) => ({ x: 200.6, y: 15.6, z, r: 3.5, lamp: 'wall' })),
  doors: [-70, -60, -50].map((z) => ({ x: 200, y: 13, z })),
  vent: null,
  huddle: { x: 203, y: 13, z: -60 },
  squad: [
    { type: 'rifle', route: route('pingpong', W(201.2, 13, -76, 2, NORTH), W(201.2, 13, -44, 2, SOUTH)) },
    { type: 'rifle', route: route('pingpong', W(204.8, 13, -62, 1.5, EAST), W(204.8, 13, -44, 1.5, EAST)) },
    { type: 'rifle', route: route('pingpong', W(204.8, 13, -76, 3, EAST), W(204.8, 13, -65, 3, EAST)) },
    { type: 'grunt', route: route('pingpong', W(202.8, 13, -47, 5, EAST), W(202.8, 13, -50, 5, EAST)) },
  ],
};
monarchBalcony.encore = monarchBalcony.squad.map((g) => ({ ...g, type: 'rifle' }));

// ---- Ace Chemicals Catwalks: the vat hall round the two vats, with a 7 m catwalk "H". ----
const CX = 124, CZ = -118;
const columns = [[101, -101], [139, -101], [101, -138], [139, -138]].map(([x, z]) => ({ x, z, y0: 0.15, top: 11 }));
const aceCatwalks = {
  id: 'aceCatwalks', name: 'Ace Chemicals Catwalks', site: 'aceCatwalks', entry: 'aceCatwalksEntry', radius: 24,
  bounds: { minX: 98, maxX: 168, minY: -1, maxY: 14, minZ: -141, maxZ: -98 },
  decks: [
    { minX: 101, maxX: 137, minZ: -105, maxZ: -103.4, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
    { minX: 101, maxX: 137, minZ: -134.6, maxZ: -133, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
    { minX: 119.2, maxX: 120.8, minZ: -133, maxZ: -105, y: 7, t: 0.2, kind: 'catwalk', grapples: 'all' },
  ],
  posts: [
    ...[102, 108, 114, 126, 132, 136.4].flatMap((x) => [{ x, z: -104.2 }, { x, z: -133.8 }]),
    { x: 120, z: -110 }, { x: 120, z: -126 },
  ].map((p) => ({ ...p, y0: 0.15, y1: 6.8 })),
  columns,
  perches: columns.map((c) => ({ x: c.x, y: c.top, z: c.z, yaw: toward(c.x, c.z, CX, CZ) })),
  cover: [[146, -112], [145, -128], [150, -104], [156, -134], [109.5, -124], [134.5, -113]]
    .map(([x, z]) => ({ x, y: 0.15, z, w: 1.6, d: 1.6, h: 1.4, kind: 'crate' })),
  // Rails along both edges of each walkway, with gaps where the spine joins.
  rails: [
    { x1: 101, z1: -103.4, x2: 137, z2: -103.4, y: 7 },
    { x1: 101, z1: -105, x2: 119.2, z2: -105, y: 7 }, { x1: 120.8, z1: -105, x2: 137, z2: -105, y: 7 },
    { x1: 101, z1: -134.6, x2: 137, z2: -134.6, y: 7 },
    { x1: 101, z1: -133, x2: 119.2, z2: -133, y: 7 }, { x1: 120.8, z1: -133, x2: 137, z2: -133, y: 7 },
    { x1: 119.2, z1: -133, x2: 119.2, z2: -105, y: 7 }, { x1: 120.8, z1: -133, x2: 120.8, z2: -105, y: 7 },
  ],
  // The vats already glow (districts.js); three lamp posts light the rest, leaving dark lanes.
  lights: [
    { x: 112, y: 6.6, z: -112, r: 7, lamp: null },
    { x: 128, y: 6.6, z: -126, r: 7, lamp: null },
    { x: 146, y: 6, z: -104, r: 5, lamp: 'post', base: 0.15 },
    { x: 146, y: 6, z: -132, r: 5, lamp: 'post', base: 0.15 },
    { x: 104, y: 5, z: -137, r: 4, lamp: 'post', base: 0.15 },
  ],
  doors: [],
  vent: { x: 120, y: 0.15, z: -118, w: 3, d: 3 },
  huddle: { x: 145, y: 0.15, z: -121 },
  squad: [
    { type: 'rifle', route: route('pingpong', W(102.5, 7, -104.2, 2, NORTH), W(135.5, 7, -104.2, 2, NORTH)) },
    { type: 'rifle', route: route('pingpong', W(120, 7, -106.5, 1, NORTH), W(120, 7, -133.8, 1), W(103, 7, -133.8, 2, SOUTH)) },
    { type: 'rifle', route: route('pingpong', W(104, 0.15, -108, 2, EAST), W(104, 0.15, -130, 2, EAST)) },
    { type: 'rifle', route: route('loop', W(140, 0.15, -106), W(158, 0.15, -106, 1.5, WEST), W(158, 0.15, -130), W(140, 0.15, -130, 1.5, WEST)) },
  ],
};
aceCatwalks.encore = [
  ...aceCatwalks.squad,
  { type: 'knife', route: route('pingpong', W(126, 0.15, -100.5, 4, NORTH), W(114, 0.15, -100.5, 4, NORTH)) },
];

export const ROOMS = { monarchBalcony, aceCatwalks };
export const ROOM_IDS = Object.keys(ROOMS);

export const roomSquad = (room, kind = 'main') => (kind === 'encore' ? room.encore : room.squad);

// Every route point in the room, once: the walkable spots searching goons try.
export function roomSpots(room) {
  const seen = new Set(), out = [];
  for (const g of [...room.squad, ...room.encore]) {
    for (const p of g.route.points) {
      const k = `${p.x},${p.y},${p.z}`;
      if (!seen.has(k)) { seen.add(k); out.push(p); }
    }
  }
  return out;
}

// An encounter definition (src/game/encounters.js) for a room: one wave on the route starts.
// The story uses the main squad; the post-game (Part H, Missing Guests) can pass squad: 'encore'.
export function stealthFight(roomId, { squad = 'main' } = {}) {
  const room = ROOMS[roomId];
  if (!room) throw new Error(`Unknown stealth room ${roomId}`);
  const site = SITES[room.site];
  return {
    site: room.site, radius: room.radius, entry: room.entry, stealth: room.id, squad,
    waves: [roomSquad(room, squad).map((g) => {
      const p = g.route.points[0];
      return { type: g.type, dx: p.x - site.x, dz: p.z - site.z, y: p.y };
    })],
  };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/patrol.test.js tests/unit/stealthRooms.test.js`
Expected: PASS. If a clearance test fails, move the offending crate, post or lamp (never a route point onto a different level), and keep it inside the room bounds.

- [ ] **Step 7: Commit**

```bash
git add src/stealth/patrol.js src/stealth/stealthRooms.js src/world/mapData.js tests/unit/patrol.test.js tests/unit/stealthRooms.test.js
git commit -m "Patrol routes and the Monarch Balcony and Ace Catwalks rooms as data"
```

---

### Task 4: Two stealth steps in the story, and saves that survive them

**Files:**
- Modify: `src/game/story.js`, `src/game/fights.js`, `src/game/flow.js` (`enterStep` only), `src/game/game.js` (progress load and new game only)
- Create: `src/game/storyMigrate.js`
- Test: `tests/unit/storyMigrate.test.js`, `tests/unit/story.test.js`

**Interfaces:**
- Consumes: `stealthFight` (Task 3); 3C's `registerProgressField` and `newGameProgress` in `src/core/save.js`.
- Produces: steps `monarchBalcony` (right after `n3`, before `party`) and `aceCatwalks` (right after `a3`, before `cake`); fights of the same ids; the saved field `progress.stepId`; `LEGACY_STEP_IDS`, `resolveStep()`.

Saves store the story position as an index into `STEPS`. Inserting two steps would move every save past the Monarch fight onto the wrong step (Mansi's own save included). From now on the save also stores the step's id; a save without one is read against the step list as it was before this task. Players already past a stealth step simply skip it.

The steps get their tutorial prompts in Task 15 (the prompt texts don't exist yet).

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/storyMigrate.test.js
import { describe, it, expect } from 'vitest';
import { STEPS } from '../../src/game/story.js';
import { LEGACY_STEP_IDS, resolveStep } from '../../src/game/storyMigrate.js';
import { sanitizeProgress } from '../../src/core/save.js';

const idx = (id) => STEPS.findIndex((s) => s.id === id);

describe('story steps', () => {
  it('the balcony comes right before the party and the catwalks right before the cake', () => {
    expect(STEPS[idx('monarchBalcony') - 1].id).toBe('n3');
    expect(STEPS[idx('monarchBalcony') + 1].id).toBe('party');
    expect(STEPS[idx('aceCatwalks') - 1].id).toBe('a3');
    expect(STEPS[idx('aceCatwalks') + 1].id).toBe('cake');
    for (const id of ['monarchBalcony', 'aceCatwalks']) expect(STEPS[idx(id)]).toMatchObject({ type: 'fight', fight: id, checkpoint: `${id}Entry` });
  });
  it('LEGACY_STEP_IDS is the story as it was before Part D', () => {
    expect(STEPS.map((s) => s.id).filter((id) => id !== 'monarchBalcony' && id !== 'aceCatwalks')).toEqual(LEGACY_STEP_IDS);
  });
});

describe('resolveStep', () => {
  it('uses the saved step id when there is one', () => {
    expect(resolveStep({ step: 3, stepId: 'party' })).toBe(idx('party'));
    expect(resolveStep({ step: 0, stepId: 'aceCatwalks' })).toBe(idx('aceCatwalks'));
  });
  it('reads an old save (no id) against the old step list', () => {
    const old = (id) => LEGACY_STEP_IDS.indexOf(id);
    expect(resolveStep({ step: old('toDocks') })).toBe(idx('toDocks'));
    expect(resolveStep({ step: old('party') })).toBe(idx('party'));
    expect(resolveStep({ step: old('cake') })).toBe(idx('cake'));
    expect(resolveStep({ step: old('credits') })).toBe(idx('credits'));
    expect(resolveStep({ step: 999 })).toBe(STEPS.length);
  });
  it('an unknown id falls back to the old index', () => {
    expect(resolveStep({ step: LEGACY_STEP_IDS.indexOf('boss'), stepId: 'gone' })).toBe(idx('boss'));
  });
  it('stepId is a saved field that survives sanitizing and rejects junk', () => {
    expect(sanitizeProgress({ stepId: 'party' }).stepId).toBe('party');
    expect(sanitizeProgress({ stepId: 42 }).stepId).toBe(null);
    expect(sanitizeProgress({ stepId: '<script>' }).stepId).toBe(null);
    expect(sanitizeProgress({}).stepId).toBe(null);
  });
});
```

In `tests/unit/story.test.js`, change the known enemy types line in "fights have waves of known enemy types" to:

```js
      for (const w of f.waves) for (const e of w) expect(['grunt', 'knife', 'brute', 'rifle']).toContain(e.type);
```

and add this test to the `story data` describe:

```js
  it('stealth fights name their room and an entry site', () => {
    for (const [id, f] of Object.entries(FIGHTS)) {
      if (!f.stealth) continue;
      expect(f.stealth, id).toBe(id);
      expect(SITES[f.entry], id).toBeDefined();
      expect(SITES[f.site], id).toBeDefined();
    }
    expect(Object.values(FIGHTS).filter((f) => f.stealth)).toHaveLength(2);
  });
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/storyMigrate.test.js tests/unit/story.test.js`
Expected: FAIL (no steps, no fights, no module).

- [ ] **Step 3: Record the old step list.** Before editing `story.js`, print its ids:

```bash
node -e "import('./src/game/story.js').then((m) => console.log(JSON.stringify(m.STEPS.map((s) => s.id))))"
```

Expected on the base: `["intro","signal","card","toDocks","f1","toYard","f2","toShip","f3","presents","rewardPresents","toNeon","n1","toStreet","n2","toMonarch","n3","party","rewardParty","toAce","a1","toFactory","a2","toVat","a3","cake","rewardCake","toTower","boss","finale","credits"]`. If it differs (a merged plan added a step), use the printed list in Step 4.

- [ ] **Step 4: Write `src/game/storyMigrate.js`**

```js
// Saves store the story position as an index into STEPS. Part D inserted two stealth steps, so an
// index saved before that points at the wrong step now. Saves now also store the step's id
// (flow.js writes it on every step); a save without one is read against the old list below.
import { STEPS } from './story.js';
import { registerProgressField } from '../core/save.js';

// The story before Part D, in order. Never edit this list: it describes saves already out there.
export const LEGACY_STEP_IDS = [
  'intro', 'signal', 'card', 'toDocks', 'f1', 'toYard', 'f2', 'toShip', 'f3', 'presents', 'rewardPresents',
  'toNeon', 'n1', 'toStreet', 'n2', 'toMonarch', 'n3', 'party', 'rewardParty',
  'toAce', 'a1', 'toFactory', 'a2', 'toVat', 'a3', 'cake', 'rewardCake', 'toTower', 'boss', 'finale', 'credits',
];

const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;
registerProgressField('stepId', { sanitize: (v) => (typeof v === 'string' && ID.test(v) ? v : null) });

export function resolveStep(progress, steps = STEPS, legacy = LEGACY_STEP_IDS) {
  const byId = (id) => steps.findIndex((s) => s.id === id);
  if (progress.stepId) {
    const i = byId(progress.stepId);
    if (i >= 0) return i;
  }
  const old = Number.isInteger(progress.step) && progress.step > 0 ? progress.step : 0;
  if (old >= legacy.length) return steps.length;
  const i = byId(legacy[old]);
  return i >= 0 ? i : Math.min(old, steps.length);
}
```

- [ ] **Step 5: The steps and fights.** In `src/game/story.js`, insert right after the `n3` step:

```js
  { id: 'monarchBalcony', type: 'fight', fight: 'monarchBalcony', text: 'Rifle goons guard the balcony below the roof. Stay in the shadows and take them down one at a time.', checkpoint: 'monarchBalconyEntry' },
```

and right after the `a3` step:

```js
  { id: 'aceCatwalks', type: 'fight', fight: 'aceCatwalks', text: 'Rifle goons on the vat hall catwalks have the cake in their sights. Take them out quietly.', checkpoint: 'aceCatwalksEntry' },
```

In `src/game/fights.js`, add at the top `import { stealthFight } from '../stealth/stealthRooms.js';` and at the end of `FIGHTS`:

```js
  // Predator rooms (Part D): a squad on patrol routes that the stealth runtime drives.
  monarchBalcony: stealthFight('monarchBalcony'),
  aceCatwalks: stealthFight('aceCatwalks'),
```

- [ ] **Step 6: Save the id.** In `src/game/flow.js`'s `enterStep`, change `progress.step = objectives.index;` to:

```js
    progress.step = objectives.index;
    progress.stepId = s?.id ?? null;
```

In `src/game/game.js`:
  - Import `import { resolveStep } from './storyMigrate.js';` with the other game imports. The import registers the `stepId` field, so it must stay a top-level import (3C's rule: a module that registers a field is imported before `loadProgress` runs).
  - Right after the `let progress = params.has('new') ? ... : loadProgress(storage);` line, add `progress.step = resolveStep(progress);`.
  - In `begin`, change `if (fresh) progress = newGameProgress(progress);` to `if (fresh) { progress = newGameProgress(progress); progress.stepId = null; }` (a new game starts at the intro, not at the old save's step).

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS, including 3C's progress tracker tests (the story weight counts steps, which now number two more) and 5FG's gadget unlocks (they look steps up by id).

- [ ] **Step 8: Check an old save in the game.** Build and preview (see Global Constraints), then:

```bash
cat > "$TEMP/s6-t4.json" <<'EOF'
[
 {"eval": "localStorage.setItem('gotham-mansi-progress-v1', JSON.stringify({ step: 17, balloons: [], suit: 'm' })); location.reload(); 'old save at party'", "wait": 9000},
 {"eval": "new Promise((r) => { const f = () => (window.__game?.state?.ready ? r(window.__game.progress.step) : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.begin('m', false); 'continue'", "wait": 3000},
 {"eval": "[window.__game.flow.objectives.step.id, JSON.parse(localStorage.getItem('gotham-mansi-progress-v1')).stepId]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/" "$TEMP/stealth" "$(cat "$TEMP/s6-t4.json")"
```

Expected: the first eval may print an `eval error` about a destroyed context (the page reloads under it); the second prints `18` (the old index 17, `party`, now sits at 18); the last prints `["party","party"]`; `no console errors`.

- [ ] **Step 9: Commit**

```bash
git add src/game/story.js src/game/fights.js src/game/flow.js src/game/game.js src/game/storyMigrate.js tests/unit/storyMigrate.test.js tests/unit/story.test.js
git commit -m "Monarch Balcony and Ace Catwalks story steps; saves keep their step by id"
```

---

### Task 5: Code-authored stealth clips

**Files:**
- Create: `src/actors/stealthAnims.js`
- Modify: `src/game/game.js` (register the clips at boot, prime the hero's), `tools/pose-viewer.js`
- Test: `tests/unit/stealthAnims.test.js`

**Interfaces:**
- Consumes: `sampleRest`, `discoverFrames`, `compileClip` from `src/actors/poseAuthor.js` (keys are `{ t, ease, hold, <bone>: { f, s, tw } }`; a channel missing from a key eases between its neighbours and is 0 at the clip's ends unless keyed there); 4E's `animator.prime(names)`.
- Produces: `STEALTH_CLIPS`, `STEALTH_BEATS`, `overlayClip`, `buildStealthClips`. Clip names: `Rifle_Idle` and `Rifle_Walk` (the stock idle and walk with the arms holding a rifle across the body), `Rifle_Aim` (rifle at the shoulder), `Rifle_Search` (rifle held, torso and head sweeping side to side), `Takedown_Choke` (Batman's 2 s choke hold), `Choked` (the goon clawing at the arm, then sinking at the knees). Crouching uses the stock `Crouch_Idle_Loop` and `Crouch_Fwd_Loop` (the spec's `Crouch_Sneak` is not needed).

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/stealthAnims.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { loadGlb } from '../../tools/rigNode.mjs';
import { sanitizeClip } from '../../src/actors/animator.js';
import { buildStealthClips, STEALTH_CLIPS, STEALTH_BEATS } from '../../src/actors/stealthAnims.js';

describe('buildStealthClips', () => {
  let model, clips, built;
  beforeAll(async () => {
    const [m, a1, a2] = await Promise.all([
      loadGlb('public/assets/hero_m.glb'),
      loadGlb('public/assets/anims1.glb', { stripTextures: false }),
      loadGlb('public/assets/anims2.glb', { stripTextures: false }),
    ]);
    model = m.scene;
    clips = new Map();
    for (const c of [...a1.animations, ...a2.animations]) clips.set(c.name, sanitizeClip(c));
    built = new Map(buildStealthClips(model, clips).map((c) => [c.name, c]));
  });

  // Model-space position of a bone at time t of a clip (+Z is forward, +X is the character's left).
  function at(clip, t, bone) {
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(t);
    model.updateMatrixWorld(true);
    const p = model.worldToLocal(model.getObjectByName(bone).getWorldPosition(new THREE.Vector3()));
    action.stop();
    mixer.uncacheClip(clip);
    return p;
  }
  const track = (c, n) => c.tracks.find((t) => t.name === n);

  it('builds every clip at its length', () => {
    expect([...built.keys()]).toEqual(STEALTH_CLIPS);
    for (const n of ['Rifle_Aim', 'Rifle_Search', 'Takedown_Choke', 'Choked']) expect(built.get(n).duration).toBeCloseTo(STEALTH_BEATS[n].duration, 6);
    expect(built.get('Rifle_Walk').duration).toBeCloseTo(clips.get('Walk_Loop').duration, 6);
    expect(built.get('Rifle_Idle').duration).toBeCloseTo(clips.get('Idle_Loop').duration, 6);
  });

  it('has no NaN and only unit quaternions', () => {
    for (const c of built.values()) for (const t of c.tracks) {
      expect(Array.from(t.values).some(Number.isNaN), `${c.name} ${t.name}`).toBe(false);
      if (t instanceof THREE.QuaternionKeyframeTrack) {
        for (let i = 0; i < t.values.length; i += 4) expect(Math.abs(Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]) - 1)).toBeLessThan(1e-3);
      }
    }
  });

  it('the rifle walk keeps the walk legs and only replaces the arms', () => {
    const walk = clips.get('Walk_Loop'), rw = built.get('Rifle_Walk');
    expect(track(rw, 'thigh_l.quaternion')).toBe(track(walk, 'thigh_l.quaternion'));
    expect(track(rw, 'pelvis.position')).toBe(track(walk, 'pelvis.position'));
    expect(track(rw, 'upperarm_r.quaternion')).not.toBe(track(walk, 'upperarm_r.quaternion'));
  });

  it('the rifle hold carries both hands in front of the chest, the left one further out', () => {
    const c = built.get('Rifle_Idle');
    const l = at(c, 0.5, 'hand_l'), r = at(c, 0.5, 'hand_r'), chest = at(c, 0.5, 'spine_03');
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.15);
    expect(l.z).toBeGreaterThan(r.z);
    expect(l.distanceTo(r)).toBeLessThan(0.6);
  });

  it('the aim raises the rifle to the shoulder', () => {
    const c = built.get('Rifle_Aim');
    const l = at(c, 0.5, 'hand_l'), r = at(c, 0.5, 'hand_r'), chest = at(c, 0.5, 'spine_03');
    expect(r.y).toBeGreaterThan(chest.y - 0.1);
    expect(l.z - chest.z).toBeGreaterThan(0.35);
  });

  it('the search swings the rifle from side to side', () => {
    const c = built.get('Rifle_Search');
    expect(Math.abs(at(c, 0.75, 'hand_l').x - at(c, 2.25, 'hand_l').x)).toBeGreaterThan(0.15);
  });

  it('the choke locks both arms round a neck in front of the chest', () => {
    const c = built.get('Takedown_Choke');
    const l = at(c, 1, 'hand_l'), r = at(c, 1, 'hand_r'), chest = at(c, 1, 'spine_03');
    expect(l.distanceTo(r)).toBeLessThan(0.3);
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.2);
    expect(Math.abs((l.y + r.y) / 2 - chest.y)).toBeLessThan(0.3);
  });

  it('the choked goon claws at its throat and sinks at the knees', () => {
    const c = built.get('Choked');
    const neck = at(c, 1, 'neck_01');
    for (const hand of ['hand_l', 'hand_r']) expect(at(c, 1, hand).distanceTo(neck)).toBeLessThan(0.3);
    expect(at(c, 0, 'pelvis').y - at(c, 1.95, 'pelvis').y).toBeGreaterThan(0.2);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/stealthAnims.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/actors/stealthAnims.js`**

```js
// Stealth clips authored in code on the shared skeleton with the kicks' pose toolkit
// (poseAuthor.js: f = forward swing, s = sideways, tw = twist; +X is the character's left).
// The rifle idle and walk only change the arms: they are laid over the stock idle and walk, so
// the legs keep their motion capture. The aim, the search and both halves of the choke are
// whole-body clips.
import * as THREE from 'three';
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';

export const STEALTH_CLIPS = ['Rifle_Idle', 'Rifle_Walk', 'Rifle_Aim', 'Rifle_Search', 'Takedown_Choke', 'Choked'];
export const STEALTH_BEATS = {
  Rifle_Aim: { duration: 1 },
  Rifle_Search: { duration: 3 },
  Takedown_Choke: { duration: 2 }, // matches STEALTH.silentTime
  Choked: { duration: 2 },
};
const ARMS = ['clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r'];
const boneOf = (t) => t.name.slice(0, t.name.lastIndexOf('.'));

// `base` with the rotations of `bones` taken from `top` instead (same length as base).
export function overlayClip(name, base, top, bones) {
  const set = new Set(bones);
  const keep = base.tracks.filter((t) => !set.has(boneOf(t)));
  const add = top.tracks.filter((t) => set.has(boneOf(t)) && t.name.endsWith('.quaternion'));
  return new THREE.AnimationClip(name, base.duration, [...keep, ...add]);
}

export function buildStealthClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, duration, keys, plant = null) => compileClip(name, duration, keys, { model, frames, rest, plant });

  // Port arms: rifle across the body, right hand on the grip at the hip, left hand forward under the barrel.
  const HOLD = {
    upperarm_r: { f: 0.35, s: 0.2 }, lowerarm_r: { f: 1.35 },
    upperarm_l: { f: 0.95, s: -0.45 }, lowerarm_l: { f: 0.55 },
  };
  // Aiming: stock in the right shoulder, cheek down, left arm out along the barrel.
  const AIM = {
    spine_02: { tw: 0.25 }, neck_01: { tw: -0.2, f: 0.1 },
    upperarm_r: { f: 1.05, s: 0.55 }, lowerarm_r: { f: 1.6 },
    upperarm_l: { f: 1.35, s: -0.35 }, lowerarm_l: { f: 0.35 },
  };
  const walk = clips.get('Walk_Loop'), idle = clips.get('Idle_Loop');
  const hold = (dur) => make('hold', dur, [{ t: 0, ...HOLD }, { t: dur, ...HOLD }]);
  const rifleIdle = overlayClip('Rifle_Idle', idle, hold(idle.duration), ARMS);
  const rifleWalk = overlayClip('Rifle_Walk', walk, hold(walk.duration), ARMS);

  const aimDur = STEALTH_BEATS.Rifle_Aim.duration;
  const rifleAim = make('Rifle_Aim', aimDur, [{ t: 0, ...AIM }, { t: aimDur, ...AIM }]);

  // Search: rifle held, torso and head turning left, then right, then back.
  const searchDur = STEALTH_BEATS.Rifle_Search.duration;
  const rifleSearch = make('Rifle_Search', searchDur, [
    { t: 0, ...HOLD },
    { t: 0.75, ease: 'io', ...HOLD, spine_02: { tw: 0.45 }, neck_01: { tw: 0.3 } },
    { t: 2.25, ease: 'io', ...HOLD, spine_02: { tw: -0.45 }, neck_01: { tw: -0.3 } },
    { t: searchDur, ease: 'io', ...HOLD },
  ]);

  // Batman's choke: step in, lock the arm round the neck, lean back and squeeze, rock, then lower
  // the goon and let go. The left foot stays planted.
  const LOCK = {
    upperarm_r: { f: 1.25, s: -0.35 }, lowerarm_r: { f: 2.1 },
    upperarm_l: { f: 1.1, s: -0.3 }, lowerarm_l: { f: 1.9 },
  };
  const choke = make('Takedown_Choke', STEALTH_BEATS.Takedown_Choke.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: 0.1 },
      upperarm_r: { f: 1.3, s: -0.2 }, lowerarm_r: { f: 1.9 }, upperarm_l: { f: 1.2, s: -0.1 }, lowerarm_l: { f: 1.7 },
      thigh_l: { f: 0.35 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.3 } },
    { t: 0.35, ease: 'io', spine_02: { f: -0.18 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.45 }, calf_l: { f: 0.7 }, thigh_r: { f: 0.15 }, calf_r: { f: 0.4 } },
    { t: 1.0, ease: 'io', spine_02: { f: -0.24, s: 0.06 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.45 }, calf_l: { f: 0.7 }, thigh_r: { f: 0.15 }, calf_r: { f: 0.4 } },
    { t: 1.5, ease: 'io', spine_02: { f: -0.12, s: -0.06 }, neck_01: { f: 0.1 }, ...LOCK,
      thigh_l: { f: 0.5 }, calf_l: { f: 0.8 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.5 } },
    { t: 1.8, ease: 'io', spine_02: { f: 0.25 }, ...LOCK,
      thigh_l: { f: 0.9 }, calf_l: { f: 1.3 }, thigh_r: { f: 0.6 }, calf_r: { f: 1.1 } },
    { t: STEALTH_BEATS.Takedown_Choke.duration, ease: 'io' },
  ], 'ball_l');

  // The goon: hands up to the arm at its throat, kicking and twisting, then the knees go and it
  // slumps. It ends slumped (held), and the knockout clip takes over from there.
  const choked = make('Choked', STEALTH_BEATS.Choked.duration, [
    { t: 0.15, ease: 'out', spine_02: { f: -0.2 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.1, s: 0.3 }, lowerarm_l: { f: 2.0 }, upperarm_r: { f: 1.1, s: 0.3 }, lowerarm_r: { f: 2.0 } },
    { t: 0.7, ease: 'io', spine_02: { f: -0.25, s: 0.1 }, neck_01: { f: -0.35 },
      upperarm_l: { f: 1.2, s: 0.25 }, lowerarm_l: { f: 2.1 }, upperarm_r: { f: 1.0, s: 0.35 }, lowerarm_r: { f: 1.9 },
      thigh_l: { f: 0.3 }, calf_l: { f: 0.5 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.4 } },
    { t: 1.3, ease: 'io', spine_02: { f: -0.2, s: -0.1 }, neck_01: { f: -0.3 },
      upperarm_l: { f: 1.0, s: 0.35 }, lowerarm_l: { f: 1.9 }, upperarm_r: { f: 1.2, s: 0.25 }, lowerarm_r: { f: 2.1 },
      thigh_l: { f: 0.6 }, calf_l: { f: 1.0 }, thigh_r: { f: 0.5 }, calf_r: { f: 0.9 } },
    { t: 1.85, ease: 'in', spine_02: { f: 0.2 }, neck_01: { f: 0.4 },
      upperarm_l: { f: 0.3, s: 0.2 }, lowerarm_l: { f: 0.4 }, upperarm_r: { f: 0.3, s: 0.2 }, lowerarm_r: { f: 0.4 },
      thigh_l: { f: 1.2 }, calf_l: { f: 1.9 }, thigh_r: { f: 1.1 }, calf_r: { f: 1.8 } },
    { t: STEALTH_BEATS.Choked.duration, hold: true, ease: 'lin' },
  ], 'ball_l');

  return [rifleIdle, rifleWalk, rifleAim, rifleSearch, choke, choked];
}
```

- [ ] **Step 4: Run the tests. Tune the keys, not the thresholds.**

Run: `npx vitest run tests/unit/stealthAnims.test.js`

If a pose check fails (say the choke's hands are 0.34 m apart), change the key angles in `stealthAnims.js` (more negative `s` on the upper arms brings the hands together; more `f` on the lower arms folds them in) until it passes. The thresholds describe what the move must look like.

- [ ] **Step 5: Register and prime.** In `src/game/game.js`:
  - Import `import { buildStealthClips } from '../actors/stealthAnims.js';`.
  - Right after 4E's `buildChainClips` line, add:

```js
  for (const c of buildStealthClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
```

  - In `buildRun`, right after 4E's `hero.bat.animator.prime(chainClipNames());`, add:

```js
    // The choke and the crouch get their mixer actions now, not on the first silent takedown.
    hero.bat.animator.prime(['Takedown_Choke', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop']);
```

- [ ] **Step 6: Contact sheets.** In `tools/pose-viewer.js`, import `buildStealthClips` and `STEALTH_BEATS`, add the same `for (const c of buildStealthClips(...)) assets.clips.set(c.name, c);` line after its `buildClimbClips` line, and merge `...STEALTH_BEATS` into its beats object. Then run:

```bash
node tools/kick-sheets.mjs "$TEMP/stealth-sheets" --suits=m --views=side,front,quarter --frames=9 Rifle_Idle Rifle_Aim Rifle_Search Takedown_Choke Choked
```

Look at the sheets. The idle must read as a rifle held across the body, the aim as a shouldered rifle, the search as a scan left then right, the choke as an arm locked round a neck with a lean back, and the choked pose as hands at the throat, then a slump.

- [ ] **Step 7: Commit**

```bash
npx vitest run
git add src/actors/stealthAnims.js src/game/game.js tools/pose-viewer.js tests/unit/stealthAnims.test.js
git commit -m "Code-authored stealth clips: rifle idle, walk, aim, search; choke and choked"
```

---

### Task 6: The rifle goon: rules, model, movement states, aim and fire

**Files:**
- Modify: `src/combat/rules.js`, `src/progress/upgrades.js` (5FG), `src/actors/characters.js`, `src/game/warmCast.js`, `src/actors/enemy.js`, `src/game/game.js` (spawn only)
- Test: `tests/unit/combat.test.js`, `tests/unit/upgrades.test.js`

**Interfaces:**
- Consumes: the Task 5 clips; 4E's `chainHold`/`chainRelease` and `chained` state; 5FG's `lostT`, `lose`, `e.search?.(from)` hook, and its `e.ready` line.
- Produces: `ENEMY.rifle`, rifle damage 25 (no block reduction, Kevlar Weave reduces it), `GOON_LOOKS.rifle`, `ch.muzzle`, `ch.xrays`, a rifle goon in the warm cast, and in `enemy.js`: `e.yaw`, `e.aiming`, `e.nav`, `e.room`, `e.seesHero`, `e.canNav()`, `e.goTo()`, `e.lookAt()`, `e.engageNow()`, `e.calm()`, states `patrol`, `search`, `hunt`, `suspicious`, `look`, the edge guard for room goons, stuck detection, the rifle wind-up (red glyph, `Rifle_Aim`, 0.55 s longer than a punch) and shot (`ctx.onRifleFire(e)` then `ctx.onAttackLand(e, 'rifle')` when it can see Batman).

"It can't be punched safely head-on" is modelled as a guard: like the knife goon, a rifle goon parries punches unless stunned, and kicks, the cape, gadgets and every takedown work. Its shot can't be countered or blocked (red glyph): dodge it.

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/combat.test.js` (add `ENEMY`, `resolveHit` and `damageToHero` to its `rules.js` import if missing):

```js
describe('the rifle goon', () => {
  const rifle = (o = {}) => ({ type: 'rifle', health: ENEMY.rifle.health, stunned: false, down: false, ...o });
  it('parries punches head-on; a kick breaks the guard; a stun opens it', () => {
    expect(resolveHit('punch', rifle()).outcome).toBe('parried');
    expect(resolveHit('kick', rifle()).outcome).toBe('hit');
    expect(resolveHit('punch', rifle({ stunned: true })).outcome).toBe('hit');
  });
  it('cannot be countered, and its shot hurts 25 whether blocked or not', () => {
    expect(ENEMY.rifle).toMatchObject({ counterable: false, parry: true, ranged: true, damage: 25 });
    expect(damageToHero('rifle')).toBe(25);
    expect(damageToHero('rifle', { blocking: true })).toBe(25);
    expect(damageToHero('rifle', { difficulty: 'story' })).toBe(12.5);
  });
});
```

Append to `tests/unit/upgrades.test.js` (add `damageFactor` and `upgradeEffects` to its import if missing):

```js
describe('rifles and armor', () => {
  it('Kevlar Weave covers rifle shots like thrown gags', () => {
    const base = upgradeEffects([]), kev = upgradeEffects(['plating1', 'kevlar']);
    expect(damageFactor('rifle', base)).toBe(1);
    expect(damageFactor('rifle', kev)).toBeLessThan(1);
    expect(damageFactor('rifle', kev)).toBeCloseTo(damageFactor('buzzer', kev));
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/combat.test.js tests/unit/upgrades.test.js`
Expected: FAIL.

- [ ] **Step 3: Rules.** In `src/combat/rules.js`:
  - Add to `ENEMY`: `rifle: { health: 4, damage: 25, counterable: false, parry: true, armored: false, speed: 3.2, scale: 1, ranged: true },`
  - Add `rifle: 0` to `BLOCK_REDUCTION` and `rifle: 25` to `ATTACK_DAMAGE`.

In `src/progress/upgrades.js` (5FG), change the first line of `damageFactor` to:

```js
  const k = kind === 'knife' ? e.knifeMult : kind === 'buzzer' || kind === 'rifle' ? e.rangedMult : 1;
```

and in the Kevlar Weave upgrade's `text`, replace `knives and thrown gags` with `knives, thrown gags and rifle shots`.

Run: `npx vitest run tests/unit/combat.test.js tests/unit/upgrades.test.js`. Expected: PASS.

- [ ] **Step 4: The rifle goon's look and rifle.** In `src/actors/characters.js`:
  - Add to `GOON_LOOKS`: `rifle: { parts: ['Male_Ranger_Body', 'Male_Ranger_Legs', 'Male_Ranger_Feet_Boots', 'Male_Ranger_Arms'], hat: 'beanie' },`
  - Update the type comment above `createGoon` to `// type: 'grunt' | 'knife' | 'brute' | 'rifle'`.
  - In `createGoon`, change the look and scheme picks to:

```js
  const look = GOON_LOOKS[brute ? 'brute' : type === 'knife' ? 'knife' : type === 'rifle' ? 'rifle' : pick(['striped', 'striped', 'hoodie'])];
  const scheme = type === 'knife' ? GOON_SCHEMES[1] : type === 'rifle' ? GOON_SCHEMES[2] : brute ? GOON_SCHEMES[3] : pick(GOON_SCHEMES);
```

  - Keep every x-ray mesh, so detective vision can tint the whole goon by its stealth state. Change `for (const m of clothes) addXray(m);` to:

```js
  ch.xrays = [ch.xray];
  for (const m of clothes) ch.xrays.push(addXray(m));
```

  - Right after the `if (type === 'knife') { ... }` block, add:

```js
  if (type === 'rifle') {
    // A rifle built from blocks: receiver, barrel, wooden stock, magazine and a short scope, held
    // in the right hand along +z like the knife. ch.muzzle marks the barrel tip for the laser sight
    // and the tracer.
    const hand = ch.bone('hand_r');
    const handPos = new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[body.skeleton.bones.indexOf(hand)].clone().invert());
    const gun = new THREE.Group();
    const dark = toonMaterial({ color: PALETTE.ink }), steel = toonMaterial({ color: 0x6d737c }), wood = toonMaterial({ color: 0x5a3a24 });
    const parts = [
      new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.34).translate(0, 0, 0.1), dark),
      new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 8).rotateX(Math.PI / 2).translate(0, 0.02, 0.5), steel),
      new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.12, 0.24).translate(0, -0.03, -0.16), wood),
      new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.05).translate(0, -0.09, 0.16), dark),
      new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0.07, 0.12), dark),
    ];
    for (const m of parts) { gun.add(m); addHullOutline(m, 0.004); }
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, 0.76);
    gun.add(muzzle);
    gun.position.copy(handPos).add(new THREE.Vector3(-0.04 * lm.fwd, -0.02, 0.02 * lm.fwd));
    if (lm.fwd < 0) gun.rotation.y = Math.PI;
    attachRigid(body, 'hand_r', gun);
    ch.muzzle = muzzle;
  }
```

In `src/game/warmCast.js`, change `for (const type of ['knife', 'brute'])` to `for (const type of ['knife', 'brute', 'rifle'])`.

- [ ] **Step 5: Enemy fields and methods.** In `src/actors/enemy.js`:
  - In the `e` literal, after 5FG's `frozenT: 0, danceT: 0, lostT: 0, shattered: false,`, add:

```js
    // Predator stealth (src/stealth/stealthSystem.js): where the goon walks or looks, which room it
    // belongs to, and whether it can see Batman right now (a rifle only fires when it can).
    nav: { x: 0, y: 0, z: 0, speed: 0, face: null, lookX: 0, lookZ: 0, arrived: false, px: 0, pz: 0, stuckT: 0 },
    room: null, seesHero: undefined,
    get yaw() { return ch.yaw; },
    get aiming() { return e.state === 'windup' && e.attackKind === 'rifle'; },
```

  - Right after the literal, add:

```js
  // Rifle goons fight from range and carry their rifle in every pose.
  const RIFLE = type === 'rifle';
  const WALK = RIFLE ? 'Rifle_Walk' : 'Walk_Loop', IDLE = RIFLE ? 'Rifle_Idle' : 'Idle_Loop', LOOK = RIFLE ? 'Rifle_Search' : 'Idle_No_Loop';
  if (RIFLE) { e.ringDist = rng.range(9, 14); e.idlePose = 'Rifle_Idle'; }
```

  - After the `faceHero` helper, add:

```js
  const turnTo = (yaw, rate, dt) => {
    const d = Math.atan2(Math.sin(yaw - ch.yaw), Math.cos(yaw - ch.yaw));
    ch.face(ch.yaw + d * Math.min(1, rate * dt));
  };
  // States the stealth runtime may steer a goon out of.
  const NAV = new Set(['idle', 'alert', 'patrol', 'search', 'hunt', 'suspicious', 'look', 'engage', 'recover']);
  const WALKING = new Set(['patrol', 'search', 'hunt']);
```

  - After 5FG's `e.yank`, add:

```js
  // Stealth steering. The runtime calls these every frame; they only change state when the state
  // changes, so the state timer and animations don't restart.
  e.canNav = () => e.alive && !e.down && !e.air && !e.countered && NAV.has(e.state);
  e.goTo = (x, y, z, speed, state = 'patrol', face = null) => {
    if (Math.hypot(x - e.nav.x, z - e.nav.z) > 0.3) { e.nav.arrived = false; e.nav.stuckT = 0; }
    e.nav.x = x; e.nav.y = y; e.nav.z = z; e.nav.speed = speed; e.nav.face = face;
    if (e.state !== state) { setState(state); e.nav.arrived = false; }
  };
  e.lookAt = (x, z, state = 'suspicious') => {
    e.nav.lookX = x; e.nav.lookZ = z;
    if (e.state !== state) setState(state);
  };
  // Hostile and seen: the fight AI takes over.
  e.engageNow = () => {
    e.aware = true;
    if (e.state !== 'engage' && NAV.has(e.state)) setState('engage');
  };
  // The squad lost Batman: back under stealth control.
  e.calm = () => {
    e.aware = false;
    e.glyph = null;
    if (NAV.has(e.state) || e.state === 'windup' || e.state === 'attack') setState('look');
  };
```

  - Replace 5FG's `e.ready = ...` line with:

```js
  e.ready = (hero) => {
    if (e.state !== 'engage' || !e.alive || e.down || e.lostT > 0) return false;
    const d = tmp.set(hero.pos.x - pos.x, 0, hero.pos.z - pos.z).length();
    return def.ranged ? e.seesHero !== false && d < 30 : d < 6.5;
  };
```

- [ ] **Step 6: The rifle wind-up and shot.** In `e.startWindup`, add a branch before the final `} else {`:

```js
    } else if (def.ranged) {
      // A long, readable aim: the red laser holds on Batman, then one shot.
      e.attackKind = 'rifle';
      e.windupDur = windup + 0.55;
      e.glyph = 'red';
      play('Rifle_Aim', { fade: 0.1 });
```

In `e.update`'s `windup` case, change the approach line to `if (!def.ranged && dist > want + 0.3) { speed = 2.2; moveX = dx / dist; moveZ = dz / dist; }` and make the start of the `if (e.t >= e.windupDur) {` block:

```js
        if (e.t >= e.windupDur) {
          if (def.ranged) { setState('attack'); e.glyph = null; break; }
```

At the top of the `attack` case, before `if (e.attackKind === 'charge') {`, add:

```js
        if (e.attackKind === 'rifle') {
          faceHero(hero, 10, dt);
          if (!e.hitDone) {
            e.hitDone = true;
            ctx.onRifleFire?.(e);
            if (e.seesHero !== false && dist < 32) ctx.onAttackLand(e, 'rifle');
          }
          if (e.t > 0.45) { setState('recover'); ctx.onAttackEnd(e); }
          break;
        }
```

In the `engage`/`recover` case: change 5FG's `if (dist < 8 && e.lostT <= 0) faceHero(hero, 8, dt);` to `if ((dist < 8 || def.ranged) && e.lostT <= 0) faceHero(hero, 8, dt);`, change the walk line to `else if (speed > 0) play(type === 'brute' ? 'Zombie_Walk_Fwd_Loop' : WALK, { fade: 0.2 });` and the idle line to `else play(type === 'knife' ? 'Sword_Idle' : type === 'brute' ? 'Idle_FoldArms_Loop' : IDLE, { fade: 0.25 });`.

- [ ] **Step 7: The movement states.** In `e.update`'s `switch`, add these cases before `case 'ko':`:

```js
      case 'patrol':
      case 'search':
      case 'hunt': {
        e.nav.px = pos.x; e.nav.pz = pos.z;
        const gx = e.nav.x - pos.x, gz = e.nav.z - pos.z, gd = Math.hypot(gx, gz);
        if (gd < 0.35) e.nav.arrived = true;
        if (!e.nav.arrived) {
          speed = e.nav.speed;
          moveX = gx / gd; moveZ = gz / gd;
          turnTo(Math.atan2(moveX, moveZ), 8, dt);
        } else if (e.nav.face !== null) turnTo(e.nav.face, 4, dt);
        if (speed > 2.6) play('Jog_Fwd_Loop', { fade: 0.2 });
        else if (speed > 0) play(WALK, { fade: 0.2, timeScale: Math.max(0.8, speed / 1.7) });
        else play(IDLE, { fade: 0.25 });
        break;
      }
      case 'suspicious':
      case 'look':
        turnTo(Math.atan2(e.nav.lookX - pos.x, e.nav.lookZ - pos.z), e.state === 'look' ? 2.5 : 5, dt);
        play(e.state === 'look' ? LOOK : IDLE, { fade: 0.25 });
        break;
```

Right before the line `if (speed) { pos.x += moveX * speed * dt; pos.z += moveZ * speed * dt; }`, add the edge guard:

```js
    // Room goons never walk off a catwalk or the balcony: they stop at the edge instead.
    if (speed && e.room && !e.air) {
      const ahead = collision.groundBelow(pos.x + moveX * 0.6, pos.y + 0.5, pos.z + moveZ * 0.6, 0.15);
      if (ahead < pos.y - 0.6) { speed = 0; e.nav.arrived = true; }
    }
```

Right after the `const r = collision.resolveCylinder(pos, e.radius, 1.8 * scale);` line near the end of `e.update`, add stuck detection:

```js
    // Walking into a wall or a crate: count it as arrived after a second, so the runtime moves on.
    if (WALKING.has(e.state)) {
      const moved = Math.hypot(pos.x - e.nav.px, pos.z - e.nav.pz);
      e.nav.stuckT = !e.nav.arrived && e.nav.speed > 0 && moved < e.nav.speed * dt * 0.25 ? e.nav.stuckT + dt : 0;
      if (e.nav.stuckT > 1) { e.nav.arrived = true; e.nav.stuckT = 0; }
    }
```

- [ ] **Step 8: Prime the goon clips at spawn.** In `src/game/game.js`'s `spawn`, right after `const e = createEnemy(...)`, add:

```js
      // Stealth clips get their mixer actions now, not on the first patrol step or choke.
      e.ch.animator.prime(type === 'rifle' ? ['Rifle_Idle', 'Rifle_Walk', 'Rifle_Aim', 'Rifle_Search', 'Choked'] : ['Choked']);
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 10: Check the rifle goon in the game.** Build and preview, then:

```bash
cat > "$TEMP/s6-t6.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.combat ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos; for (const e of G.enemies) { e.health = 0; e.applyHit({ outcome: 'ko' }, h); } const r = G.spawn('rifle', { x: h.x, y: h.y, z: h.z - 10 }); G.combat.setEnemies([...G.combat.enemies, r]); G.__r = r; G.__hurt = []; G.events.on('heroHurt', (d) => G.__hurt.push([d.kind, d.damage])); 'rifle'", "wait": 600},
 {"shot": "t6-rifle-idle"},
 {"eval": "const r = window.__game.__r; r.goTo(r.pos.x + 5, r.pos.y, r.pos.z, 1.6, 'patrol'); r.state", "wait": 4000},
 {"eval": "const r = window.__game.__r; [r.state, r.nav.arrived, +(r.pos.x - window.__game.hero.pos.x).toFixed(1)]"},
 {"eval": "const r = window.__game.__r; r.room = 'test'; r.goTo(r.pos.x + 60, r.pos.y, r.pos.z, 3.4, 'hunt'); 'toward the roof edge'", "wait": 6000},
 {"eval": "const r = window.__game.__r; [r.state, r.nav.arrived, r.air, +r.pos.y.toFixed(1)]"},
 {"eval": "const r = window.__game.__r; r.room = null; r.lookAt(window.__game.hero.pos.x, window.__game.hero.pos.z, 'look'); r.state", "wait": 1500},
 {"shot": "t6-rifle-search"},
 {"eval": "const r = window.__game.__r; r.engageNow(); [r.state, r.aware, +r.ringDist.toFixed(1)]"},
 {"eval": "new Promise((res) => { const r = window.__game.__r; const f = () => (r.aiming ? res('aiming') : setTimeout(f, 30)); f(); })", "wait": 500},
 {"shot": "t6-rifle-aim"},
 {"wait": 2500},
 {"eval": "window.__game.__hurt"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?fight=test&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t6.json")"
```

Expected:
- After the walk: `["patrol",true,5]` (within 0.4 of 5).
- Sent toward the roof edge as a room goon: `["hunt",true,false,42]`: it stopped at the parapet or the edge (the roof is at 42) instead of falling.
- After `engageNow`: `["engage",true,<9 to 14>]`.
- `t6-rifle-idle.png` shows a red-scheme goon with a beanie holding a dark rifle across its body; `t6-rifle-search.png` the rifle held and the torso turned; `t6-rifle-aim.png` the rifle at the shoulder with a red bolt glyph over the head. If the rifle points the wrong way in the hand, adjust `gun.rotation` (try `rotation.x` in quarter turns) until it lies along the forearm, and look again.
- `__hurt` holds at least one `["rifle",25]`.
- `no console errors`.

- [ ] **Step 11: Commit**

```bash
git add src/combat/rules.js src/progress/upgrades.js src/actors/characters.js src/game/warmCast.js src/actors/enemy.js src/game/game.js tests/unit/combat.test.js tests/unit/upgrades.test.js
git commit -m "Rifle goon: code-modelled rifle, laser-length wind-up, 25 damage shot; stealth movement states"
```

---

### Task 7: Crouch

**Files:**
- Modify: `src/core/bindings.js`, `src/core/input.js`, `src/actors/hero.js`
- Test: `tests/unit/bindings.test.js`, `tests/unit/input.test.js`

**Interfaces:**
- Consumes: 5FG's `createHoldTap` and `PAD_TAP` in `src/core/input.js`; 4E's `padActions`.
- Produces: action `crouch` (default `KeyZ`, group Move, a toggle); pad L3 (`PAD_L3 = 10`) tap is crouch and hold is sprint; `hero.crouched`, `hero.perched` (set by the stealth runtime in Task 11); events `crouchOn`, `crouchOff`; `footstep` now carries `{ sprint }` and is not emitted while crouched; a hero control can set `keepCrouch: true` to stay crouched.

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/bindings.test.js` (add `sanitizeSettings` from `../../src/core/settings.js` to the imports if 5FG's block didn't already):

```js
describe('crouch binding', () => {
  it('Z toggles crouch, in the Move group', () => {
    expect(DEFAULT_BINDINGS.crouch).toEqual(['KeyZ']);
    const a = ACTIONS.find((x) => x.id === 'crouch');
    expect(a.group).toBe('Move');
    expect(a.label).not.toMatch(/[\u2013\u2014]/);
  });
  it('old saved bindings pick up the new default', () => {
    expect(sanitizeSettings({ bindings: { jump: ['Space'] } }).bindings.crouch).toEqual(['KeyZ']);
  });
});
```

Append to `tests/unit/input.test.js` (it has 4E's `pad` and `acts` helpers):

```js
import { PAD_L3 } from '../../src/core/input.js';

describe('left stick click: tap to crouch, hold to sprint', () => {
  it('L3 is no longer a plain pad action (createHoldTap decides)', () => {
    expect(PAD_L3).toBe(10);
    expect(acts(PAD_L3)).toEqual([]);
  });
});
```

If an older test in `input.test.js` expects `acts(10)` to be `['sprint']`, change it to `[]`: that is this task's change.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/bindings.test.js tests/unit/input.test.js`
Expected: FAIL.

- [ ] **Step 3: Bindings.** In `src/core/bindings.js`, add after the `sprint` action `{ id: 'crouch', label: 'Crouch (toggle): quiet and harder to see', group: 'Move' },` and after `sprint: ['ShiftLeft'],` add `crouch: ['KeyZ'],`.

- [ ] **Step 4: Input.** In `src/core/input.js`:
  - Remove `sprint: [10]` from `PAD_BUTTONS`, and put this comment above `PAD_BUTTONS`: `// L3 (10) is not here: a tap toggles crouch and holding it sprints (createHoldTap).`
  - Below 5FG's `createHoldTap`, add `export const PAD_L3 = 10;`.
  - Inside `createInput`, next to 5FG's `rbHold`, add `const l3Hold = createHoldTap(PAD_TAP); let crouchTap = false;`.
  - In `pollPad`, right after 5FG's two RB lines, add:

```js
      if (l3Hold.update(!!pad.buttons[PAD_L3]?.pressed, dt) === 'tap') crouchTap = true;
      if (l3Hold.holding) now.add('sprint');
```

  In the `else` (no pad) branch add `l3Hold.update(false, dt);`. After 5FG's `if (capeTap) { ... }` line add:

```js
    if (crouchTap) { padPressed.add('crouch'); crouchTap = false; device = 'pad'; }
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/bindings.test.js tests/unit/input.test.js`
Expected: PASS, including "never binds one code to two actions by default".

- [ ] **Step 6: The hero.** In `src/actors/hero.js`:
  - Add `const CROUCH = 3.2;       // m/s crouched` after `const SPRINT = 11.5;`.
  - In the `h` literal, after `lastClimbT: 99,`, add:

```js
    crouched: false, // crouch toggle: slow, silent, harder to see (Part D)
    perched: false,  // standing on a gargoyle or other perch (set by src/stealth/stealthSystem.js)
```

  - After `function setState(s) { ... }`, add:

```js
  function setCrouch(v) {
    if (h.crouched === v) return;
    h.crouched = v;
    events.emit(v ? 'crouchOn' : 'crouchOff');
  }
```

  - In `locomotion`, replace the two lines `const sprint = ...` and `const max = ...` with:

```js
    if (h.state === 'ground' && input.pressed('crouch')) setCrouch(!h.crouched);
    const sprint = input.down('sprint') && mag > 0.5 && !h.blocking;
    if (h.crouched && (sprint || h.blocking)) setCrouch(false);
    const max = h.blocking ? 2.2 : sprint ? SPRINT : h.crouched ? CROUCH : RUN;
```

  - In the ground branch, make the first line inside `if (h.jumpBuffer > 0 && h.state === 'ground') {` be `setCrouch(false);`.
  - In the ground animation block, change `else if (h.blocking) bat.animator.play('Idle_Shield_Loop', { fade: 0.1 });` to:

```js
      else if (h.blocking) bat.animator.play('Idle_Shield_Loop', { fade: 0.1 });
      else if (h.crouched || h.perched) bat.animator.play(h.speed < 0.3 ? 'Crouch_Idle_Loop' : 'Crouch_Fwd_Loop', { fade: 0.2, timeScale: h.speed < 0.3 ? 1 : Math.max(0.7, h.speed / 2.4) });
```

  - Change the footstep line to make crouched steps silent and tell listeners how loud a step is:

```js
      if (!h.crouched && h.speed > 0.5 && h.stride > (h.speed > 8 ? 2.3 : 1.7)) { h.stride = 0; events.emit('footstep', { sprint: h.speed > 8 }); }
```

  - In `h.update`, right after `h.lastClimbT += dt;`, add:

```js
    // Leaving the ground (or starting a move that isn't a quiet takedown) stands Batman up.
    if (h.crouched && (h.state !== 'ground' || (h.control && !h.control.keepCrouch))) setCrouch(false);
```

  - In `h.teleport`, add `h.crouched = false; h.perched = false;` next to `h.control = null;`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Check it in the game.** Build and preview, then:

```bash
cat > "$TEMP/s6-t7.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.hero ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__steps = 0; G.__crouch = []; G.events.on('footstep', () => G.__steps++); G.events.on('crouchOn', () => G.__crouch.push('on')); G.events.on('crouchOff', () => G.__crouch.push('off')); 'hooked'"},
 {"press": "KeyZ", "wait": 400},
 {"eval": "[window.__game.hero.crouched, window.__game.hero.bat.animator.currentName]"},
 {"shot": "t7-crouch"},
 {"hold": ["KeyW"], "ms": 1500},
 {"eval": "const G = window.__game; [G.__steps, +G.hero.speed.toFixed(1), G.hero.bat.animator.currentName]"},
 {"down": ["ShiftLeft", "KeyW"], "wait": 800},
 {"up": ["ShiftLeft", "KeyW"]},
 {"eval": "const G = window.__game; [G.hero.crouched, G.__steps > 0, G.__crouch]"},
 {"press": "KeyZ", "wait": 200},
 {"press": "Space", "wait": 300},
 {"eval": "const G = window.__game; [G.hero.crouched, G.__crouch]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=signal&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t7.json")"
```

Expected: `[true,"Crouch_Idle_Loop"]`; `t7-crouch.png` shows Batman crouched; while creeping forward `[0, <= 3.2, "Crouch_Fwd_Loop"]` (no footsteps); sprinting stands him up with footsteps: `[false,true,["on","off"]]`; crouching again and jumping ends `[false,["on","off","on","off"]]`; `no console errors`. If the creep looks like it slides, change the `h.speed / 2.4` divisor until the feet match the ground.

- [ ] **Step 9: Commit**

```bash
git add src/core/bindings.js src/core/input.js src/actors/hero.js tests/unit/bindings.test.js tests/unit/input.test.js
git commit -m "Crouch on Z and a left stick tap: slow, silent, harder to see"
```

---

### Task 8: The room sets in the city, and the room check

**Files:**
- Create: `src/stealth/roomCheck.js`, `src/world/stealthSets.js`, `scripts/stealth-check.mjs`
- Modify: `src/world/districts.js` (one call), `src/game/game.js` (`window.__game.checkStealthRooms`)
- Test: `tests/unit/roomCheck.test.js`

**Interfaces:**
- Consumes: `ROOMS` (Task 3), `huddleSpot` (Task 3); `solid`, `glow`, `lightSpot`, `edgeGrapples` from `src/world/cityBuilder.js`; `box` from `src/world/buckets.js`; `addGargoyle`, `plinth` from `src/world/gargoyles.js`; the collision API (`groundBelow`, `raycast`, `query`, `boxes`).
- Produces: `buildStealthSets(ctx, rooms)`, `checkRooms(collision, grapplePoints, rooms, sites)`, `window.__game.checkStealthRooms()`, and `scripts/stealth-check.mjs`. Collision tags `stealthDeck`, `stealthPost`, `stealthColumn`, `stealthCover`, `stealthLamp`. Gargoyles add `perch: true, gargoyle: true` grapple points as they already do; decks add ledge-able edges and grapple points.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/roomCheck.test.js
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
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/roomCheck.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/stealth/roomCheck.js`**

```js
// Checks the predator rooms against a collision world (the live city in the game, or a small
// world in the tests): every patrol point stands on the floor it claims, every leg is walkable
// (no hole, nothing in the way for a goon's body at knee and chest height), every gargoyle is a
// grapple perch that can be seen from somewhere in the room, the entry, the huddle and the vent
// have floor, and no set piece sits inside another box. Pure: only the collision API.
import { huddleSpot } from './patrol.js';

const EPS = 0.02;
const overlaps = (a, b) => a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minY < b.maxY - EPS && a.maxY > b.minY + EPS
  && a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS;
const inBounds = (bd, b) => b.maxX >= bd.minX && b.minX <= bd.maxX && b.maxZ >= bd.minZ && b.minZ <= bd.maxZ;
// Pieces that sit on or in the stealth set by design.
const ALLOWED = new Set(['gargoyle', 'plinth']);

function legsOf(route) {
  const pts = route.points, out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  if (route.mode === 'loop' && pts.length > 2) out.push([pts[pts.length - 1], pts[0]]);
  return out;
}

export function checkRooms(collision, grapplePoints, rooms, sites) {
  const out = [];
  const ground = (p) => collision.groundBelow(p.x, p.y + 1, p.z, 0.3);
  for (const room of Object.values(rooms)) {
    const bad = (kind, detail) => out.push({ room: room.id, kind, detail });
    const entry = sites[room.entry];
    if (!entry) bad('entry', 'missing site');
    else if (Math.abs(ground(entry) - entry.y) > 0.3) bad('entry', `floor at ${ground(entry)} not ${entry.y}`);

    const routes = [...room.squad, ...room.encore].map((g) => g.route);
    for (const r of routes) {
      for (const p of r.points) {
        const g = ground(p);
        if (Math.abs(g - p.y) > 0.12) bad('point', `${p.x},${p.y},${p.z} floor ${g}`);
      }
      for (const [a, b] of legsOf(r)) checkLeg(bad, a, b);
    }

    const views = [...routes.flatMap((r) => r.points), entry].filter(Boolean);
    for (const p of room.perches) {
      const stand = p.y + 0.9;
      const gp = grapplePoints.find((q) => q.perch && Math.abs(q.x - p.x) < 0.25 && Math.abs(q.z - p.z) < 0.25 && Math.abs(q.y - stand) < 0.25);
      if (!gp) { bad('perch-missing', `${p.x},${p.z}`); continue; }
      if (!views.some((v) => sees(v, gp))) bad('perch-hidden', `${p.x},${p.z}`);
    }

    const h = { x: 0, y: 0, z: 0, face: 0 };
    for (let k = 0; k < 4; k++) {
      huddleSpot(room.huddle, k, 4, h);
      if (Math.abs(ground(h) - h.y) > 0.12) bad('huddle', `${h.x.toFixed(1)},${h.z.toFixed(1)}`);
    }
    if (room.vent && Math.abs(ground(room.vent) - room.vent.y) > 0.2) bad('vent', 'no floor under the vent');

    for (const b of collision.boxes) {
      if (!b.tag?.startsWith('stealth') || !inBounds(room.bounds, b)) continue;
      for (const o of collision.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
        if (o === b || o.tag?.startsWith('stealth') || ALLOWED.has(o.tag)) continue;
        if (overlaps(b, o)) bad('overlap', `${b.tag} inside ${o.tag || 'box'} ${o.id}`);
      }
    }
  }
  return out;

  function checkLeg(bad, a, b) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) return;
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 1; i < n; i++) {
      const k = i / n, p = { x: a.x + (b.x - a.x) * k, y: a.y, z: a.z + (b.z - a.z) * k };
      const g = ground(p);
      if (Math.abs(g - a.y) > 0.2) { bad('gap', `${p.x.toFixed(1)},${p.z.toFixed(1)} floor ${g}`); return; }
    }
    // A goon is 0.84 m wide: cast three parallel rays (centre and both shoulders) at two heights.
    const d = { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len };
    for (const h of [0.5, 1.4]) {
      for (const side of [-0.4, 0, 0.4]) {
        const o = { x: a.x - d.z * side, y: a.y + h, z: a.z + d.x * side };
        const hit = collision.raycast(o, d, len);
        if (hit && hit.t < len - 0.3) { bad('blocked', `${a.x},${a.z} to ${b.x},${b.z} by ${hit.box.tag || 'box'} at ${hit.t.toFixed(1)}`); return; }
      }
    }
  }
  function sees(v, gp) {
    const o = { x: v.x, y: v.y + 1.6, z: v.z };
    const t = { x: gp.x - o.x, y: gp.y + 0.3 - o.y, z: gp.z - o.z };
    const dist = Math.hypot(t.x, t.y, t.z);
    const hit = collision.raycast(o, { x: t.x / dist, y: t.y / dist, z: t.z / dist }, dist);
    return !hit || hit.t > dist - 1.2;
  }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/roomCheck.test.js`
Expected: PASS.

- [ ] **Step 5: Write `src/world/stealthSets.js`**

```js
// The predator rooms' scenery, built into the city at boot from src/stealth/stealthRooms.js (the
// same data the stealth runtime reads, so a lamp here is a light pool there): catwalk decks and
// posts, perch columns with gargoyles, crates and planters, rails, lamps, doorways and the
// steaming floor vent. Everything goes into the city buckets, so it batches and warms with the city.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { box } from './buckets.js';
import { solid, glow, lightSpot, edgeGrapples } from './cityBuilder.js';
import { addGargoyle, plinth } from './gargoyles.js';
import { ROOMS } from '../stealth/stealthRooms.js';

const CRATE = 0x6b4a2e, CRATE_BAND = 0x3a2616, PLANTER = 0x6a655d, LEAVES = 0x1f3a26;
const DOOR = 0x241c2c, TRANSOM = 0xffd58a, COLUMN = 0x3d4148, LAMP = 0x2b2b30;

export function buildStealthSets(ctx, rooms = ROOMS) {
  for (const room of Object.values(rooms)) {
    for (const d of room.decks) deck(ctx, d);
    for (const p of room.posts) solid(ctx, 'steel', box(0.2, p.y1 - p.y0, 0.2, p.x, (p.y0 + p.y1) / 2, p.z), { tag: 'stealthPost' });
    for (const c of room.columns) column(ctx, c);
    for (const p of room.perches) {
      if (p.plinth !== undefined) plinth(ctx, p.x, p.plinth, p.z);
      addGargoyle(ctx, p.x, p.y, p.z, p.yaw);
    }
    for (const c of room.cover) (c.kind === 'planter' ? planter : crate)(ctx, c);
    for (const r of room.rails) rail(ctx, r);
    for (const l of room.lights) if (l.lamp) lamp(ctx, l);
    for (const d of room.doors) door(ctx, d);
    if (room.vent) vent(ctx, room.vent);
  }
}

function deck(ctx, d) {
  const w = d.maxX - d.minX, dd = d.maxZ - d.minZ, cx = (d.minX + d.maxX) / 2, cz = (d.minZ + d.maxZ) / 2;
  solid(ctx, 'steel', box(w, d.t, dd, cx, d.y - d.t / 2, cz), { tag: 'stealthDeck' });
  if (d.kind === 'balcony') {
    // A stone lip along the outer edge, and corbels against the wall every 4 m.
    ctx.buckets.add('trim', box(0.3, 0.35, dd, d.maxX - 0.15, d.y - d.t - 0.1, cz));
    for (let z = d.minZ + 2; z < d.maxZ; z += 4) ctx.buckets.add('trim', box(0.5, 0.9, 0.4, d.minX + 0.25, d.y - d.t - 0.45, z));
  } else {
    // Catwalk grating: inked slats across the walk (paint only).
    const along = w > dd, span = along ? w : dd;
    for (let t = -span / 2 + 0.3; t < span / 2; t += 0.6) {
      ctx.buckets.add('painted', box(along ? 0.06 : w, 0.01, along ? dd : 0.06, along ? cx + t : cx, d.y + 0.006, along ? cz : cz + t), PALETTE.ink);
    }
  }
  // Grapple points to land on (or, holding back, hang from) the edge.
  if (d.grapples === 'x+') for (let z = d.minZ + 3; z < d.maxZ; z += 6) ctx.grapple.push({ x: d.maxX, y: d.y, z, nx: 1, nz: 0 });
  else edgeGrapples(ctx, cx, cz, w, dd, d.y, 6);
}

function column(ctx, c) {
  solid(ctx, 'painted', box(1, c.top - c.y0, 1, c.x, (c.top + c.y0) / 2, c.z), { color: COLUMN, tag: 'stealthColumn' });
  for (let y = c.y0 + 2; y < c.top; y += 2) ctx.buckets.add('steel', box(1.08, 0.12, 1.08, c.x, y, c.z));
}

function crate(ctx, c) {
  solid(ctx, 'painted', box(c.w, c.h, c.d, c.x, c.y + c.h / 2, c.z), { color: CRATE, tag: 'stealthCover' });
  for (const k of [0.25, 0.75]) ctx.buckets.add('painted', box(c.w + 0.03, 0.1, c.d + 0.03, c.x, c.y + c.h * k, c.z), CRATE_BAND);
}

function planter(ctx, c) {
  solid(ctx, 'painted', box(c.w, c.h, c.d, c.x, c.y + c.h / 2, c.z), { color: PLANTER, tag: 'stealthCover' });
  ctx.buckets.add('painted', new THREE.IcosahedronGeometry(c.w * 0.55, 0).scale(1, 0.7, 1).translate(c.x, c.y + c.h + 0.25, c.z), LEAVES);
}

// Rails are paint only: goons keep to their routes, and Batman may vault or drop over the edge.
function rail(ctx, r) {
  const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1), yaw = Math.atan2(r.x2 - r.x1, r.z2 - r.z1);
  const mx = (r.x1 + r.x2) / 2, mz = (r.z1 + r.z2) / 2;
  ctx.buckets.add('steel', new THREE.BoxGeometry(0.06, 0.06, len).rotateY(yaw).translate(mx, r.y + 1.0, mz));
  ctx.buckets.add('steel', new THREE.BoxGeometry(0.04, 0.04, len).rotateY(yaw).translate(mx, r.y + 0.5, mz));
  const n = Math.max(1, Math.round(len / 1.5));
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    ctx.buckets.add('steel', box(0.05, 1.0, 0.05, r.x1 + (r.x2 - r.x1) * k, r.y + 0.5, r.z1 + (r.z2 - r.z1) * k));
  }
}

function lamp(ctx, l) {
  let bx = l.x;
  if (l.lamp === 'post') {
    solid(ctx, 'painted', box(0.3, l.y - l.base, 0.3, l.x, (l.y + l.base) / 2, l.z), { color: LAMP, tag: 'stealthLamp' });
    ctx.buckets.add('painted', new THREE.ConeGeometry(0.55, 0.35, 12, 1, true).translate(l.x, l.y + 0.1, l.z), LAMP);
  } else {
    // A wall lamp: a bracket off the facade and a hood.
    bx = l.x + 0.3;
    ctx.buckets.add('painted', box(0.6, 0.08, 0.08, l.x, l.y + 0.2, l.z), LAMP);
    ctx.buckets.add('painted', new THREE.ConeGeometry(0.35, 0.3, 10, 1, true).translate(bx, l.y + 0.1, l.z), LAMP);
  }
  glow(ctx, new THREE.SphereGeometry(0.16, 10, 6).translate(bx, l.y - 0.05, l.z), PALETTE.sodium);
  ctx.halos.add(bx, l.y - 0.05, l.z, PALETTE.sodium, 5);
  lightSpot(ctx, bx, l.y - 0.2, l.z, PALETTE.sodium, 22, l.r * 2.6);
}

// Double doors painted flush on an east-facing facade (x = d.x), a warm transom, a stone frame.
function door(ctx, d) {
  ctx.buckets.add('painted', new THREE.PlaneGeometry(1.8, 2.7).rotateY(Math.PI / 2).translate(d.x + 0.03, d.y + 1.35, d.z), DOOR);
  glow(ctx, new THREE.PlaneGeometry(1.8, 0.35).rotateY(Math.PI / 2).translate(d.x + 0.035, d.y + 2.95, d.z), TRANSOM);
  for (const s of [-1, 1]) ctx.buckets.add('trim', box(0.12, 3.25, 0.15, d.x + 0.06, d.y + 1.62, d.z + s * 1.0));
  ctx.buckets.add('trim', box(0.12, 0.15, 2.15, d.x + 0.06, d.y + 3.25, d.z));
}

// A floor grate breathing chemical steam: Batman crouched in it can't be seen (vision.js).
function vent(ctx, v) {
  ctx.buckets.add('steel', box(v.w + 0.3, 0.05, v.d + 0.3, v.x, v.y + 0.02, v.z));
  for (let i = 0; i < 9; i++) ctx.buckets.add('painted', box(v.w, 0.02, 0.1, v.x, v.y + 0.055, v.z - v.d / 2 + 0.15 + i * ((v.d - 0.3) / 8)), PALETTE.ink);
  for (const [dx, dz, s] of [[0, 0, 1.3], [-0.8, 0.6, 1.0], [0.8, -0.6, 1.0], [0.5, 0.9, 0.8]]) ctx.steam.push({ x: v.x + dx, y: v.y + 0.1, z: v.z + dz, s });
}
```

- [ ] **Step 6: Build them with the city.** In `src/world/districts.js`, import `import { buildStealthSets } from './stealthSets.js';` and in `buildDistricts`, add `buildStealthSets(ctx);` right after `aceChemicals(ctx);`.

- [ ] **Step 7: Expose the check.** In `src/game/game.js`, import `import { checkRooms } from '../stealth/roomCheck.js';` and `import { ROOMS } from '../stealth/stealthRooms.js';`, and add to the boot `window.__game = { ... }` object:

```js
    checkStealthRooms: () => checkRooms(world.collision, world.grapplePoints, ROOMS, SITES),
```

- [ ] **Step 8: Write `scripts/stealth-check.mjs`**

```js
// Checks both predator rooms against the live city (src/stealth/roomCheck.js): patrol floors and
// legs, perches, the entry, the huddle, the vent and overlapping set pieces.
// Usage: node scripts/stealth-check.mjs [url]   (point it at a frozen build: vite preview)
import { chromium } from 'playwright-core';

const url = process.argv[2] ?? 'http://localhost:5210/';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(url);
await page.waitForFunction(() => window.__game?.state?.ready, null, { timeout: 120000 });
const report = await page.evaluate(() => window.__game.checkStealthRooms());
for (const r of report) console.log(`${r.room.padEnd(16)} ${r.kind.padEnd(14)} ${r.detail}`);
console.log(report.length ? `${report.length} problems` : 'all rooms sound');
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
process.exit(report.length || errors.length ? 1 : 0);
```

- [ ] **Step 9: Run the check against the city.** Build and preview, then run `node scripts/stealth-check.mjs http://localhost:5210/`.

Expected: `all rooms sound` and `no console errors`. If it reports problems, fix the data in `src/stealth/stealthRooms.js` (never the checker), rerun `npx vitest run tests/unit/stealthRooms.test.js`, rebuild and rerun the check:
- `point` or `gap` on the balcony: the Monarch's east face or a cornice sits differently than expected; move the deck's `y` (and every balcony `y`, the planters' `y`, the lights' `y` and `SITES.monarchBalcony.y`) by up to 0.5 m, or narrow the deck's `maxX` and shift the outer route (`204.8`) to stay 1.2 m inside it.
- `blocked` on a leg: move the named crate, post or lamp at least 1 m off the leg.
- `overlap`: move the stealth piece clear of the named box (a street lamp, an awning, the existing catwalk posts at z -118).
- `perch-hidden`: turn the gargoyle (`yaw`) or move its column 1 m toward the room centre.
- `entry`: nudge the entry site onto the roof.

- [ ] **Step 10: Look at the sets.** With the preview running:

```bash
cat > "$TEMP/s6-t8.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.hero ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.teleport({ x: 214, y: 0, z: -60 }); 'street'", "wait": 1500},
 {"eval": "const G = window.__game; G.state.paused = true; G.camera.position.set(222, 18, -60); G.camera.lookAt(203, 14, -60); 'framed'", "wait": 600},
 {"shot": "t8-balcony"},
 {"eval": "const G = window.__game; G.state.paused = false; G.teleport({ x: 150, y: 0.15, z: -96 }); 'yard'", "wait": 1500},
 {"eval": "const G = window.__game; G.state.paused = true; G.camera.position.set(152, 16, -94); G.camera.lookAt(120, 4, -120); 'framed'", "wait": 600},
 {"shot": "t8-catwalks"},
 {"eval": "const G = window.__game; G.state.paused = false; G.state.detectiveOn = true; 'detective'", "wait": 900},
 {"eval": "const G = window.__game; G.state.paused = true; G.camera.position.set(152, 16, -94); G.camera.lookAt(120, 4, -120); 'framed'", "wait": 600},
 {"shot": "t8-catwalks-detective"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=signal&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t8.json")"
```

Expected: `t8-balcony.png` shows the deck along the theater's east face with the stone lip and corbels, three doors with warm transoms and lamps, two planters, the rail, and four gargoyles on the roof edge above. `t8-catwalks.png` shows the catwalk "H" over and between the vats, the four columns with gargoyles, the crates, the lamp posts and steam rising from the grate. Everything is inked and reads as part of the comic city. `no console errors`.

- [ ] **Step 11: Commit**

```bash
npx vitest run
git add src/stealth/roomCheck.js src/world/stealthSets.js src/world/districts.js src/game/game.js scripts/stealth-check.mjs tests/unit/roomCheck.test.js src/stealth/stealthRooms.js src/world/mapData.js
git commit -m "Monarch Balcony and Ace Catwalks sets in the city, and a room check against the live collision"
```

---

### Task 9: Engine hooks: stealth encounters, entry respawn, combat hooks, grapple in rooms

**Files:**
- Modify: `src/game/encounters.js`, `src/game/flow.js` (`respawnPoint` only), `src/combat/combatSystem.js`, `src/game/game.js` (the grapple lock only)
- Test: `tests/unit/stealthEncounters.test.js`, `tests/unit/stealthCombat.test.js` (new)

**Interfaces:**
- Consumes: `stealthFight` (Task 3); 3C's `encounters.begin(id, def)`, `siteOf`, and the win branch that clears `id`; 4E's `critical(target, opts)`; 5FG's `createCombat` signature and its `useGadget` line in `tryStart`; `ENEMY.rifle` (Task 6).
- Produces:
  - `createEncounters({ ..., stealth })`: a fight with `stealth` set spawns each goon on the height its wave entry names (`y`), calls `stealth.begin(fight, made)`, never wakes its goons (entering the radius only emits `fightStart`), and calls `stealth.end()` when it is won or cleared.
  - Predator rooms respawn at `SITES[fight.entry]`.
  - `createCombat({ ..., stealthStart })`: a buffered punch or kick asks `stealthStart(action, ctx)` first; `true` means it was used.
  - `combat.takedown(e, kind, { crit = true } = {})`; the `takedown` event now carries `target`.
  - Enemy ctx hook `onRifleFire(e)`, which emits `rifleShot { from, to, target, hit }` (shared vectors: listeners copy them); the director emits `rifleAim { target }` when a rifle goon starts to aim.
  - Room goons never lock the grapple (`e.room`), so grappling to a perch is always an escape.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/stealthEncounters.test.js
import { describe, it, expect, vi } from 'vitest';
import { createEncounters } from '../../src/game/encounters.js';
import { createEvents } from '../../src/core/events.js';
import { stealthFight } from '../../src/stealth/stealthRooms.js';
import { SITES } from '../../src/world/mapData.js';

function setup() {
  const events = createEvents();
  const spawned = [];
  const spawn = (type, p) => {
    const e = { type, pos: { ...p }, alive: true, aware: false, woke: 0, wake() { this.woke += 1; this.aware = true; } };
    spawned.push(e);
    return e;
  };
  const stealth = { begin: vi.fn(), end: vi.fn() };
  // groundBelow(x, from) = from - 3: every spawn lands where its wave entry says.
  const collision = { groundBelow: (x, y) => y - 3 };
  const enc = createEncounters({ spawn, despawn: () => {}, combat: { setEnemies() {} }, events, collision, stealth });
  return { enc, events, spawned, stealth };
}
const heroAt = (p) => ({ pos: { x: p.x, y: p.y, z: p.z } });

describe('stealth encounters', () => {
  it('spawn the squad at each route start height and hand it to the stealth runtime', () => {
    const { enc, spawned, stealth } = setup();
    const def = stealthFight('aceCatwalks');
    enc.begin('aceCatwalks', def);
    expect(spawned.map((e) => e.type)).toEqual(['rifle', 'rifle', 'rifle', 'rifle']);
    [7, 7, 0.15, 0.15].forEach((y, i) => expect(spawned[i].pos.y).toBeCloseTo(y, 6));
    expect(stealth.begin).toHaveBeenCalledWith(def, spawned);
  });
  it('entering the room starts the fight but wakes nobody', () => {
    const { enc, events, spawned } = setup();
    enc.begin('aceCatwalks', stealthFight('aceCatwalks'));
    const seen = [];
    events.on('fightStart', (d) => seen.push(d.id));
    enc.update(0.016, heroAt(SITES.aceCatwalks));
    expect(seen).toEqual(['aceCatwalks']);
    expect(spawned.every((e) => e.woke === 0)).toBe(true);
  });
  it('winning or ending the room ends the stealth runtime', () => {
    const { enc, events, spawned, stealth } = setup();
    enc.begin('monarchBalcony', stealthFight('monarchBalcony'));
    enc.update(0.016, heroAt(SITES.monarchBalcony));
    stealth.end.mockClear();
    const done = [];
    events.on('fightDone', (d) => done.push(d.id));
    for (const e of spawned) e.alive = false;
    enc.update(0.016, heroAt(SITES.monarchBalcony));
    expect(done).toEqual(['monarchBalcony']);
    expect(stealth.end).toHaveBeenCalled();
    enc.begin('monarchBalcony', stealthFight('monarchBalcony'));
    stealth.end.mockClear();
    enc.end();
    expect(stealth.end).toHaveBeenCalled();
  });
  it('story fights still wake everyone and never touch the stealth runtime', () => {
    const { enc, spawned, stealth } = setup();
    enc.begin('docksRoof');
    enc.update(0.016, heroAt(SITES.wh3Roof));
    expect(spawned.every((e) => e.woke === 1)).toBe(true);
    expect(stealth.begin).not.toHaveBeenCalled();
  });
});
```

```js
// tests/unit/stealthCombat.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createTimeControl } from '../../src/core/time.js';
import { createRng } from '../../src/core/rng.js';
import { ENEMY } from '../../src/combat/rules.js';

function makeHero() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false, crouched: false,
    invulnerable: 0, health: 100, maxHealth: 100, blocking: false, heightAboveGround: () => 0,
    collision: { raycast: () => null, resolveCylinder: () => ({ groundY: 0 }), groundBelow: () => 0 },
    bat: {
      yaw: 0, face() {}, tilt: { rotation: { set() {} } },
      animator: { play: () => ({ time: 0, getClip: () => ({ duration: 1 }) }), update() {} },
      bone: () => ({ getWorldPosition: (v) => v.set(0, 1.4, 0) }),
    },
    cape: { setWings() {} },
  };
}
function makeGoon(id, type, x, z, o = {}) {
  return {
    id, type, def: ENEMY[type], scale: ENEMY[type].scale, radius: 0.42, alive: true, down: false, air: false, aware: true,
    state: 'engage', health: ENEMY[type].health, stunned: false, glyph: null, pos: new THREE.Vector3(x, 0, z),
    get x() { return this.pos.x; }, get z() { return this.pos.z; },
    ch: { headWorld: (v) => v.set(x, 1.6, z), animator: { play() {} } },
    outcomes: [], windups: [], attack: null,
    applyHit(r) {
      this.outcomes.push(r.outcome);
      if (r.outcome === 'ko') { this.alive = false; this.down = true; this.state = 'ko'; }
      return false;
    },
    update(dt, ctx) { if (this.attack) { const k = this.attack; this.attack = null; if (k === 'rifle') ctx.onRifleFire?.(this); ctx.onAttackLand(this, k); } },
    ready() { return this.state === 'engage'; },
    startWindup(w) { this.windups.push(w); this.state = 'windup'; },
    ...o,
  };
}
const follow = { forward: (v = new THREE.Vector3()) => v.set(0, 0, 1), right: (v = new THREE.Vector3()) => v.set(-1, 0, 0), addShake() {}, actionShot() {} };
const ctxWith = (pressed = []) => ({ input: { move: { x: 0, y: 0 }, pressed: (a) => pressed.includes(a), down: () => false }, fx: {} });
function setup(stealthStart = null) {
  const hero = makeHero();
  const events = createEvents();
  const combat = createCombat({ hero, follow, time: createTimeControl(), events, rng: createRng(3), getDifficulty: () => 'normal', stealthStart });
  hero.combat = combat;
  return { hero, events, combat };
}

describe('the stealth hook in combat', () => {
  it('a punch or a kick asks the stealth runtime first', () => {
    const calls = [];
    const { combat, hero } = setup((a) => { calls.push(a); return true; });
    combat.setEnemies([makeGoon('g', 'grunt', 0, 1.2, { aware: false, state: 'idle' })]);
    combat.update(0.016, ctxWith(['punch']));
    combat.update(0.016, ctxWith(['kick']));
    expect(calls).toEqual(['punch', 'kick']);
    expect(hero.control).toBe(null);
  });
  it('when it declines, the punch lands as usual', () => {
    const { combat, hero } = setup(() => false);
    combat.setEnemies([makeGoon('g', 'grunt', 0, 1.5)]);
    combat.update(0.016, ctxWith(['punch']));
    expect(hero.control?.name).toBe('strike');
  });
  it('blocks and dodges never reach it', () => {
    const calls = [];
    const { combat } = setup((a) => { calls.push(a); return true; });
    combat.setEnemies([makeGoon('g', 'grunt', 0, 3)]);
    combat.update(0.016, ctxWith(['block']));
    combat.update(0.016, ctxWith(['dodge']));
    expect(calls).toEqual([]);
  });
});

describe('takedowns and rifles', () => {
  it('a takedown can be quiet (no critical) and names its target', () => {
    const { combat, events } = setup();
    const g = makeGoon('g', 'grunt', 0, 2), h = makeGoon('h', 'grunt', 1, 2);
    combat.setEnemies([g, h]);
    const seen = [];
    events.on('critical', () => seen.push('critical'));
    events.on('takedown', (d) => seen.push([d.kind, d.target.id]));
    expect(combat.takedown(g, 'silent', { crit: false })).toBe(true);
    expect(g.alive).toBe(false);
    expect(seen).toEqual([['silent', 'g']]);
    combat.takedown(h, 'perch');
    expect(seen).toEqual([['silent', 'g'], 'critical', ['perch', 'h']]);
  });
  it('a rifle shot emits rifleShot at Batman chest height and lands 25 damage', () => {
    const { combat, events, hero } = setup();
    const r = makeGoon('r', 'rifle', 0, 12, { attack: 'rifle' });
    combat.setEnemies([r]);
    const shots = [];
    events.on('rifleShot', (d) => shots.push([d.target.id, d.hit, +d.to.y.toFixed(1)]));
    combat.update(0.016, ctxWith());
    expect(shots).toEqual([['r', true, 1.1]]);
    expect(hero.health).toBe(75);
  });
  it('the director announces a rifle wind-up', () => {
    const { combat, events } = setup();
    combat.setEnemies([makeGoon('r', 'rifle', 0, 8)]);
    const aims = [];
    events.on('rifleAim', (d) => aims.push(d.target.id));
    for (let i = 0; i < 300 && !aims.length; i++) combat.update(0.05, ctxWith());
    expect(aims).toEqual(['r']);
  });
});
```

If the merged `combatSystem.js` reads a hero field the stub lacks, add that field to `makeHero`; never change the system to suit the test.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/stealthEncounters.test.js tests/unit/stealthCombat.test.js`
Expected: FAIL.

- [ ] **Step 3: Encounters.** In `src/game/encounters.js` (3C's version):
  - Change the signature to `export function createEncounters({ spawn, despawn, combat, events, collision, stealth = null }) {`.
  - In `placeWave`, change the wave map to read an optional height:

```js
    const made = fight.waves[index].map(({ type, dx, dz, y: wy }) => {
      const x = site.x + dx, z = site.z + dz;
      // Stealth squads start on catwalks and balconies: look for the floor from their own height.
      const y = collision.groundBelow(x, (wy ?? site.y) + 3, z, 0.3);
      return spawn(type, { x, y: y > -Infinity ? y : wy ?? site.y, z }, site);
    });
```

  - Make the first line of `clear()` be `stealth?.end();`.
  - In `begin`, replace `placeWave(0, false);` with:

```js
      const made = placeWave(0, false);
      // A predator room: the stealth runtime drives this squad (src/stealth/stealthSystem.js).
      if (fight.stealth) stealth?.begin(fight, made);
```

  - In `trigger`, replace `for (const e of live) e.wake();` with `if (!fight.stealth) for (const e of live) e.wake();`.
  - In `update`'s win branch, right before `fight = null;`, add `if (fight.stealth) stealth?.end();`.

- [ ] **Step 4: Respawn at the room's entry.** In `src/game/flow.js`'s `respawnPoint`, make the first line inside `if (s?.type === 'fight') {`:

```js
      // Predator rooms respawn at their entry, above the room and out of sight.
      if (FIGHTS[s.fight].entry) return { ...SITES[FIGHTS[s.fight].entry] };
```

`respawn()` already turns Batman to face the step's target (the room).

- [ ] **Step 5: Combat.** In `src/combat/combatSystem.js`:
  - Add `stealthStart = null` to `createCombat`'s options (after 5FG's `useGadget = null`).
  - In `tryStart`, right after 5FG's `if (action === 'batarang' && useGadget) return useGadget(...);` line, add:

```js
    // Predator stealth (src/stealth/stealthSystem.js): a silent takedown from behind, or a perch drop.
    if (stealthStart && (action === 'punch' || action === 'kick') && stealthStart(action, ctx)) return true;
```

  - Replace `takedown` with:

```js
  // An instant KO from a ledge, drop, perch or silent takedown: no fight, just (unless it is a
  // quiet one) an action shot. Same wasAttacking/director.release bookkeeping as landHit.
  function takedown(e, kind, { crit = true } = {}) {
    if (!e?.alive) return false;
    e.health = 0;
    const wasAttacking = e.applyHit({ outcome: 'ko' }, hero.pos);
    if (wasAttacking) director.release(e.id);
    if (crit) critical(e, { slow: 0.7 });
    events.emit('takedown', { kind, pos: e.pos.clone(), target: e });
    return true;
  }
```

  - After `onAttackEnd`, add:

```js
  // A rifle goon fires (enemy.js): muzzle and aim point for the tracer and the crack. The vectors
  // are reused on every shot, so listeners copy them.
  const shotFrom = new THREE.Vector3(), shotTo = new THREE.Vector3();
  const shot = { from: shotFrom, to: shotTo, target: null, hit: false };
  function onRifleFire(e) {
    if (e.ch.muzzle) e.ch.muzzle.getWorldPosition(shotFrom);
    else e.ch.headWorld(shotFrom, -0.2);
    shotTo.set(hero.pos.x, hero.pos.y + (hero.crouched ? 0.7 : 1.1), hero.pos.z);
    shot.target = e;
    shot.hit = e.seesHero !== false && hero.invulnerable <= 0;
    events.emit('rifleShot', shot);
  }
```

  - In `update`, add `onRifleFire` to the enemy context: `const ectx = { hero, others: enemies, onAttackLand, onAttackEnd, onThrownFly, onLanded, onRifleFire };`.
  - In the director loop, change `if (e) e.startWindup(...);` (5FG's version, with the counter window) to a block that also announces a rifle's aim:

```js
        if (e) {
          e.startWindup(DIFFICULTY[difficulty].windup + (e.def.counterable ? effects.counterWindow : 0), hero);
          if (e.def.ranged) events.emit('rifleAim', { target: e });
        }
```

- [ ] **Step 6: Room goons never lock the grapple.** In `src/game/game.js`, change the `busy` line to:

```js
        const busy = combat.enemies.some((e) => e.alive && e.aware && !e.room && e.pos.distanceTo(hero.pos) < 12 && Math.abs(e.pos.y - hero.pos.y) < 4);
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS, including 3C's `encounters.test.js` and 5FG's `combatHooks.test.js`.

- [ ] **Step 8: Commit**

```bash
git add src/game/encounters.js src/game/flow.js src/combat/combatSystem.js src/game/game.js tests/unit/stealthEncounters.test.js tests/unit/stealthCombat.test.js
git commit -m "Stealth encounters, entry respawn, the stealth hook, quiet takedowns and rifle fire events"
```

---

### Task 10: The silent takedown and the perch drop

**Files:**
- Create: `src/stealth/takedowns.js`
- Test: `tests/unit/takedowns.test.js`

**Interfaces:**
- Consumes: `STEALTH` (Task 1); 4E's `lungePoint(from, to, k, arc, out, ease)` from `src/combat/chains.js` and `e.chainHold()`/`e.chainRelease()` (a held goon has no AI and no physics); `combat.takedown(e, kind, { crit })` (Task 9) through `api.takedown`; the clips `Takedown_Choke` and `Choked` (Task 5).
- Produces: `createSilentTakedown(hero, api, { target })` and `createPerchDrop(hero, api, { target })`, hero controls named `silent` and `perchDrop`. Events `silentStart`, `silentTakedown`, `silentBroken`, `perchDropStart`, `perchDrop`, and `word` for `HRKK!` and `KRUNCH!`. `api` is `{ events, noise(pos, radius, kind), takedown(e, kind, opts) }`.

- The **silent takedown** snaps Batman 0.55 m behind the goon, holds the goon (`chainHold`) and plays the choke on both for 2 s. At the start it makes a 6 m noise (goons within 6 m hear it and come to look). At 2 s the goon is out (a quiet takedown, no slow motion). If Batman is hit first, he lets go and the goon wakes up hostile.
- The **perch drop** leaps from the perch in a short arc onto the goon (0.4 to 0.75 s, longer for a longer drop), knocks it out with an action shot, lands Batman beside it and makes an 8 m noise.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/takedowns.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createSilentTakedown, createPerchDrop } from '../../src/stealth/takedowns.js';
import { createEvents } from '../../src/core/events.js';

function fakeHero(x = 0, y = 0, z = 0) {
  const h = {
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), state: 'ground', grounded: true, clips: [],
    collision: { resolveCylinder: () => ({ groundY: 0 }) },
    bat: { yaw: 0, face(y2) { h.bat.yaw = y2; }, animator: { play: (n) => h.clips.push(n) } },
    setState(s) { h.state = s; },
  };
  return h;
}
function fakeGoon(x, y, z, yaw = 0) {
  const e = {
    id: 'g', pos: new THREE.Vector3(x, y, z), yaw, alive: true, state: 'patrol', woke: 0, clips: [],
    ch: { animator: { play: (n) => e.clips.push(n) }, headWorld: (v, lift = 0) => v.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z) },
    chainHold() { e.state = 'chained'; }, chainRelease() { if (e.state === 'chained') e.state = 'patrol'; },
    wake() { e.woke += 1; },
  };
  return e;
}
function fakeApi() {
  const events = createEvents(), log = [];
  for (const n of ['silentStart', 'silentTakedown', 'silentBroken', 'perchDropStart', 'perchDrop']) events.on(n, () => log.push(n));
  events.on('word', (d) => log.push(d.text));
  const api = {
    events, log, noises: [], takedowns: [],
    noise: (pos, radius, kind) => api.noises.push([kind, radius]),
    takedown: (e, kind, opts) => { api.takedowns.push([kind, opts?.crit ?? true]); e.alive = false; e.state = 'ko'; return true; },
  };
  return api;
}
const run = (ctl, secs, dt = 1 / 60) => { let done = false; for (let t = 0; t < secs && !done; t += dt) done = ctl.update(dt); return done; };

describe('the silent takedown', () => {
  it('snaps behind the goon, chokes for 2 s, then knocks it out quietly', () => {
    const h = fakeHero(0, 0, -1.2), e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    expect(ctl).toMatchObject({ name: 'silent', camera: 'takedown', combat: true, keepCrouch: true });
    expect(e.state).toBe('chained');
    expect(h.clips).toEqual(['Takedown_Choke']);
    expect(e.clips).toEqual(['Choked']);
    expect(api.noises).toEqual([['takedown', 6]]);
    run(ctl, 0.3);
    expect(h.pos.z).toBeCloseTo(-0.55, 2);
    expect(e.alive).toBe(true);
    expect(run(ctl, 2.2)).toBe(true);
    expect(api.takedowns).toEqual([['silent', false]]);
    expect(api.log).toEqual(['silentStart', 'HRKK!', 'silentTakedown']);
  });
  it('lets go if Batman is hit, and the goon wakes up', () => {
    const h = fakeHero(0, 0, -1.2), e = fakeGoon(0, 0, 0), api = fakeApi();
    const ctl = createSilentTakedown(h, api, { target: e });
    run(ctl, 1);
    ctl.knockOff();
    expect(e.state).toBe('patrol');
    expect(e.woke).toBe(1);
    expect(api.takedowns).toEqual([]);
    expect(api.log).toContain('silentBroken');
  });
});

describe('the perch drop', () => {
  it('arcs onto the goon, knocks it out with an action shot and lands beside it', () => {
    const h = fakeHero(0, 10, 0), e = fakeGoon(2, 0, 1), api = fakeApi();
    const ctl = createPerchDrop(h, api, { target: e });
    expect(ctl).toMatchObject({ name: 'perchDrop', camera: 'dive', combat: true });
    expect(e.state).toBe('chained');
    expect(h.state).toBe('air');
    let peak = 0;
    for (let i = 0; i < 20; i++) { ctl.update(1 / 60); peak = Math.max(peak, h.pos.y); }
    expect(peak).toBeGreaterThan(10);
    expect(run(ctl, 1.5)).toBe(true);
    expect(api.takedowns).toEqual([['perch', true]]);
    expect(api.noises).toEqual([['perch', 8]]);
    expect(api.log).toEqual(['perchDropStart', 'KRUNCH!', 'perchDrop']);
    expect(h.state).toBe('ground');
    expect(h.pos.y).toBeCloseTo(0);
    expect(Math.hypot(h.pos.x - 2, h.pos.z - 1)).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/takedowns.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/stealth/takedowns.js`**

```js
// The two stealth takedowns, as hero controls (like the traversal controls in src/actors/traverse/).
// - silent: Batman steps in behind a goon that hasn't noticed him and chokes it out over 2 s.
//   Goons within 6 m hear it. If he is hit first he lets go, and the goon wakes up hostile.
// - perchDrop: from a gargoyle, Batman leaps down onto a goon and knocks it out.
// Both hold the goon with 4E's chainHold (no AI, no physics) until it is taken down.
import * as THREE from 'three';
import { STEALTH } from './vision.js';
import { lungePoint } from '../combat/chains.js';

export function createSilentTakedown(h, api, { target, rules = STEALTH }) {
  const dur = rules.silentTime;
  const from = h.pos.clone();
  const spot = new THREE.Vector3(target.pos.x - Math.sin(target.yaw) * 0.55, from.y, target.pos.z - Math.cos(target.yaw) * 0.55);
  const head = new THREE.Vector3();
  let t = 0, done = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.bat.face(target.yaw);
  h.bat.animator.play('Takedown_Choke', { once: true, fade: 0.1 });
  target.ch.animator.play('Choked', { once: true, fade: 0.1 });
  api.events.emit('silentStart', { target });
  api.noise(target.pos, rules.noise.takedown, 'takedown');
  return {
    name: 'silent', camera: 'takedown', combat: true, keepCrouch: true, target,
    canChain: () => done && t >= dur + 0.15,
    update(dt) {
      t += dt;
      if (!done) {
        const k = Math.min(1, t / 0.2);
        h.pos.set(from.x + (spot.x - from.x) * k, from.y, from.z + (spot.z - from.z) * k);
        h.collision.resolveCylinder(h.pos, 0.35, 1.8, { prevY: from.y });
        if (!target.alive) { done = true; return true; }
        if (t >= dur) {
          done = true;
          target.chainRelease();
          target.ch.headWorld(head, 0.2);
          api.takedown(target, 'silent', { crit: false });
          api.events.emit('word', { text: 'HRKK!', pos: head, big: false });
          api.events.emit('silentTakedown', { target });
        }
      }
      return done && t >= dur + 0.3;
    },
    // Hit mid-choke (combatSystem's onAttackLand): let go, and the goon knows Batman is here.
    knockOff() {
      if (done) return;
      done = true;
      target.chainRelease();
      target.wake();
      api.events.emit('silentBroken', { target });
    },
  };
}

export function createPerchDrop(h, api, { target, rules = STEALTH }) {
  const from = h.pos.clone();
  const land = { x: target.pos.x, y: target.pos.y + 1.0, z: target.pos.z };
  const drop = from.y - target.pos.y;
  const dur = Math.min(0.75, Math.max(0.4, 0.3 + drop * 0.035));
  const at = { x: 0, y: 0, z: 0 };
  const head = new THREE.Vector3();
  let t = 0, hit = false;
  target.chainHold();
  h.vel.set(0, 0, 0);
  h.setState('air');
  h.grounded = false;
  h.bat.face(Math.atan2(target.pos.x - from.x, target.pos.z - from.z));
  h.bat.animator.play('NinjaJump_Start', { once: true, fade: 0.05 });
  api.events.emit('perchDropStart', { target });
  return {
    name: 'perchDrop', camera: 'dive', combat: true, target,
    canChain: () => hit && t > dur + 0.2,
    update(dt) {
      t += dt;
      if (!hit) {
        lungePoint(from, land, t / dur, 1.2, at, 'in');
        h.pos.set(at.x, at.y, at.z);
        if (t >= dur) {
          hit = true;
          const gx = target.pos.x, gy = target.pos.y, gz = target.pos.z;
          target.chainRelease();
          target.ch.headWorld(head, 0);
          api.takedown(target, 'perch', { crit: true });
          h.pos.set(gx - Math.sin(h.bat.yaw) * 0.6, gy, gz - Math.cos(h.bat.yaw) * 0.6);
          h.vel.set(0, 0, 0);
          h.grounded = true;
          h.setState('ground');
          h.bat.animator.play('NinjaJump_Land', { once: true, fade: 0.05 });
          api.noise(target.pos, rules.noise.perch, 'perch');
          api.events.emit('word', { text: 'KRUNCH!', pos: head, big: true });
          api.events.emit('perchDrop', { target });
        }
      }
      return hit && t > dur + 0.35;
    },
    knockOff() { if (!hit) { hit = true; target.chainRelease(); } },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/takedowns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stealth/takedowns.js tests/unit/takedowns.test.js
git commit -m "Silent takedown and perch drop controls"
```

---

### Task 11: The stealth runtime, wired into the game

**Files:**
- Create: `src/stealth/stealthSystem.js`
- Modify: `src/game/game.js`
- Test: `tests/unit/stealthSystem.test.js`

**Interfaces:**
- Consumes: Tasks 1 to 3 and 10; the enemy steering from Task 6 (`canNav`, `goTo`, `lookAt`, `engageNow`, `calm`, `yaw`, `room`, `seesHero`); `combat.takedown` and `combat.enemies`; the hero's `crouched`, `perched`, `control`, `state`, `grounded`, `dead`; 3C's `registerMoves`; events `footstep { sprint }`, `land { hard, who }`, `batarangWall { pos }` (Task 12 emits it), 5FG's `smoke { pos }`, and `impact { target, outcome }`.
- Produces: `createStealth(...)` (see Shared interfaces), `window.__game.stealth`, the `stealthStart` hook wired into combat and the `stealth` option into encounters. Events `stealthStart`, `stealthEnd`, `stealthAlarm`, `stealthLost`, `stealthNoise`, `stealthLine`, `stealthFear`, `perched`, `ventHide`, and hint `perch-none`. Registers the moves `silentTakedown` and `perchDrop` with 3C's tracker. Sets 5FG's `e.search(from)` hook on room goons.

How the runtime treats a goon each frame, in order: skip it if it's knocked out (count the takedown once: fear, a line), or if it can't look (hit, held, down); every 0.1 s check what it sees (`spotCheck`, then one ray from its eyes to Batman's chest) and set `e.seesHero`; run its brain; then steer it: `engage` hands it to the fight AI, `suspicious` stands and stares, `patrol` walks the route (or the huddle at fear 2), `search` and `hunt` walk to the target, look round for 2.5 s (1.5 s hunting), then try the room's walkable spots near the target, one after another. A 4E chain's hearers and a goon getting up call `e.wake()`, which the runtime turns into "go and look where Batman is".

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/stealthSystem.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStealth } from '../../src/stealth/stealthSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createRng } from '../../src/core/rng.js';
import { LINES } from '../../src/stealth/brain.js';

const W = (x, y, z, wait = 0, face = null) => ({ x, y, z, wait, face });
const ROOM = {
  id: 'test', site: 's', entry: 'e', radius: 20,
  bounds: { minX: -50, maxX: 50, minY: -5, maxY: 20, minZ: -50, maxZ: 50 },
  lights: [{ x: 0, z: 10, r: 6 }],
  perches: [], cover: [], columns: [], posts: [], rails: [], doors: [], decks: [],
  vent: { x: 0, y: 0, z: 5, w: 3, d: 3 },
  huddle: { x: 0, y: 0, z: -10 },
  squad: [
    { type: 'rifle', route: { mode: 'pingpong', points: [W(0, 0, 0), W(0, 0, -8)] } },
    { type: 'rifle', route: { mode: 'pingpong', points: [W(10, 0, 0), W(10, 0, -8)] } },
    { type: 'grunt', route: { mode: 'pingpong', points: [W(-10, 0, 0, 3, 0)] } },
  ],
  encore: [],
};

function fakeHero(x, y, z) {
  const h = {
    pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false,
    crouched: false, perched: false, collision: { resolveCylinder: () => ({}) },
    bat: { yaw: 0, face(v) { h.bat.yaw = v; }, animator: { play() {} } },
    setState(s) { h.state = s; },
  };
  return h;
}
function fakeGoon(id, type, p, yaw = 0) {
  const e = {
    id, type, def: { ranged: type === 'rifle' }, alive: true, down: false, air: false, stunned: false, aware: false, state: 'idle',
    pos: new THREE.Vector3(p.x, p.y, p.z), yaw, room: null, seesHero: undefined, woke: 0, calls: [],
    nav: { x: p.x, y: p.y, z: p.z, speed: 0, face: null, lookX: 0, lookZ: 0, arrived: false },
    ch: { animator: { play() {} }, headWorld: (v, lift = 0) => v.set(e.pos.x, e.pos.y + 1.7 + lift, e.pos.z) },
    wake() { e.woke += 1; },
    canNav() { return e.alive && !e.down && e.state !== 'chained'; },
    goTo(x, y, z, speed, state = 'patrol', face = null) {
      if (Math.hypot(x - e.nav.x, z - e.nav.z) > 0.3) e.nav.arrived = false;
      Object.assign(e.nav, { x, y, z, speed, face });
      e.state = state;
      e.calls.push([state, x, z]);
    },
    lookAt(x, z, state = 'suspicious') { e.nav.lookX = x; e.nav.lookZ = z; e.state = state; },
    engageNow() { e.aware = true; e.state = 'engage'; },
    calm() { e.aware = false; e.state = 'look'; },
    chainHold() { e.state = 'chained'; }, chainRelease() { e.state = 'idle'; },
  };
  return e;
}
function setup({ room = ROOM, perches = [], hero = [0, 0, 10] } = {}) {
  const events = createEvents();
  const h = fakeHero(...hero);
  const goons = room.squad.map((g, i) => fakeGoon(`g${i}`, g.type, g.route.points[0]));
  const takedowns = [];
  const combat = { enemies: goons, takedown: (e, kind, opts) => { e.alive = false; e.state = 'ko'; takedowns.push([kind, opts?.crit ?? true]); return true; } };
  const world = { blocker: null };
  const collision = { raycast: () => world.blocker };
  const stealth = createStealth({ hero: h, combat, events, collision, perches, rng: createRng(1) });
  const seen = [];
  for (const n of ['stealthAlarm', 'stealthLost', 'stealthLine', 'stealthFear', 'stealthNoise', 'ventHide', 'perched', 'hint', 'stealthStart', 'stealthEnd']) {
    events.on(n, (d) => seen.push([n, d?.text ?? d?.id ?? d?.fear ?? d?.room ?? d?.kind ?? '']));
  }
  stealth.begin({ stealth: 'test', squad: 'main' }, goons, room);
  const step = (secs, dt = 0.05) => { for (let i = 0; i < Math.round(secs / dt); i++) stealth.update(dt); };
  const mind = (i) => stealth.goons[i].mind;
  return { events, hero: h, goons, stealth, seen, takedowns, world, step, mind };
}
const names = (seen, n) => seen.filter(([k]) => k === n);

describe('a predator room at run time', () => {
  it('marks its goons and walks them along their routes', () => {
    const t = setup({ hero: [0, 0, -30] });
    expect(t.seen[0]).toEqual(['stealthStart', 'test']);
    t.step(0.1);
    expect(t.goons.every((e) => e.room === 'test' && !e.aware)).toBe(true);
    expect(t.goons[0].calls.at(-1)).toEqual(['patrol', 0, -8]);
    expect(t.goons[2].calls.at(-1)).toEqual(['patrol', -10, 0]);
    expect(t.goons[2].nav.face).toBe(0);
    expect(t.stealth.armed()).toBe(2);
  });
  it('a goon that sees Batman in the light notices, searches, then shouts, and the squad comes for him', () => {
    const t = setup();
    t.step(0.3);
    expect(t.mind(0).alert).toBe('suspicious');
    t.step(3);
    expect(names(t.seen, 'stealthAlarm')).toHaveLength(1);
    expect(LINES.spot).toContain(names(t.seen, 'stealthLine').at(-1)[1]);
    expect(t.goons.every((e) => e.aware && e.state === 'engage')).toBe(true);
    expect(t.goons[0].seesHero).toBe(true);
    expect(t.stealth.alarm).toBe(true);
  });
  it('in the dark he is seen at 12 m standing, but not crouched', () => {
    const dark = { ...ROOM, lights: [], vent: null };
    const a = setup({ room: dark, hero: [0, 0, 12] });
    a.step(1);
    expect(a.mind(0).meter).toBeGreaterThan(0);
    const b = setup({ room: dark, hero: [0, 0, 12] });
    b.hero.crouched = true;
    b.step(3);
    expect(b.mind(0).meter).toBe(0);
  });
  it('crouched in the vent steam he is invisible even 5 m away', () => {
    const t = setup({ room: { ...ROOM, lights: [] }, hero: [0, 0, 5] });
    t.hero.crouched = true;
    t.step(2);
    expect(t.mind(0).meter).toBe(0);
    expect(names(t.seen, 'ventHide')).toHaveLength(1);
    t.hero.crouched = false;
    t.step(1);
    expect(t.mind(0).meter).toBeGreaterThan(0);
  });
  it('a wall in the way hides him', () => {
    const t = setup();
    t.world.blocker = { t: 2, box: { tag: 'wall' } };
    t.step(2);
    expect(t.mind(0).meter).toBe(0);
  });
  it('perched on a gargoyle he is invisible to goons that are not hostile', () => {
    const t = setup({ perches: [{ x: 0, y: 6, z: 3, perch: true }], hero: [0, 6, 3] });
    t.step(2);
    expect(t.hero.perched).toBe(true);
    expect(names(t.seen, 'perched')).toHaveLength(1);
    expect(t.mind(0).meter).toBe(0);
  });
  it('once nobody has seen him for 8 s, the squad falls back to searching', () => {
    const t = setup();
    t.step(3);
    t.hero.pos.set(0, 0, -40);
    t.step(1.5);
    expect(t.goons[1].state).toBe('hunt');
    expect(t.goons[1].aware).toBe(true);
    t.step(8);
    expect(names(t.seen, 'stealthLost')).toHaveLength(1);
    expect(t.goons.every((e) => !e.aware)).toBe(true);
    expect([0, 1, 2].map((i) => t.mind(i).alert)).toEqual(['search', 'search', 'search']);
  });
  it('footsteps and a batarang clang draw goons that are not hostile', () => {
    const t = setup({ hero: [-10, 0, -4] });
    t.events.emit('footstep', { sprint: false });
    t.step(0.05);
    expect(t.mind(2).alert).toBe('search');
    expect(t.mind(2).target).toMatchObject({ x: -10, z: -4 });
    expect(t.mind(0).alert).toBe('patrol');
    t.events.emit('batarangWall', { pos: { x: 10, y: 0, z: -4 } });
    t.step(0.05);
    expect(t.mind(1).target).toMatchObject({ x: 10, z: -4 });
    expect(t.mind(0).alert).toBe('search');
    expect(names(t.seen, 'stealthNoise').map(([, k]) => k)).toEqual(['step', 'batarang']);
  });
  it('smoke sends every goon back to searching around the cloud', () => {
    const t = setup();
    t.step(3);
    t.events.emit('smoke', { pos: { x: 1, y: 0, z: 1 } });
    expect(t.stealth.alarm).toBe(false);
    for (const i of [0, 1, 2]) { expect(t.mind(i).alert).toBe('search'); expect(t.mind(i).target).toMatchObject({ x: 1, z: 1 }); }
    expect(t.goons.every((e) => !e.aware)).toBe(true);
  });
  it('a stunned goon goes looking; one that parried a punch raises the alarm', () => {
    const t = setup({ hero: [0, 0, -30] });
    t.events.emit('impact', { target: t.goons[0], outcome: 'stun' });
    expect(t.mind(0).alert).toBe('search');
    t.events.emit('impact', { target: t.goons[1], outcome: 'parried' });
    expect(names(t.seen, 'stealthAlarm')).toHaveLength(1);
  });
  it('a woken goon (a chain heard, or getting up) goes to look where Batman is', () => {
    const t = setup({ hero: [0, 0, -5] });
    t.goons[0].wake();
    t.step(0.05);
    expect(t.mind(0).alert).toBe('search');
    expect(t.mind(0).target).toMatchObject({ x: 0, z: -5 });
  });
  it('each takedown raises fear and a survivor says so; with two left they huddle', () => {
    const t = setup({ hero: [0, 0, -30] });
    t.step(0.1);
    t.goons[0].alive = false;
    t.step(0.1);
    expect(names(t.seen, 'stealthFear')).toEqual([['stealthFear', 1]]);
    expect(LINES.fear1).toContain(names(t.seen, 'stealthLine').at(-1)[1]);
    const [, x, z] = t.goons[1].calls.at(-1);
    expect(Math.hypot(x - 0, z + 10)).toBeCloseTo(1.6, 1);
  });
  it('a punch from behind an unaware goon starts the silent takedown; from the front it does not', () => {
    const t = setup({ hero: [0, 0, -1.2] });
    expect(t.stealth.start('punch')).toBe(true);
    expect(t.hero.control.name).toBe('silent');
    const f = setup({ hero: [0, 0, 1.2] });
    expect(f.stealth.start('punch')).toBe(false);
    expect(f.stealth.start('kick')).toBe(false);
  });
  it('perched, a kick drops on the goon below; with nobody below it only hints', () => {
    const t = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    t.step(0.1);
    expect(t.stealth.prompt).toBe('perch');
    expect(t.stealth.start('kick')).toBe(true);
    expect(t.hero.control.name).toBe('perchDrop');
    const u = setup({ perches: [{ x: 0, y: 6, z: 2, perch: true }], hero: [0, 6, 2] });
    for (const e of u.goons) e.pos.x += 40;
    u.step(0.1);
    expect(u.stealth.start('punch')).toBe(true);
    expect(u.hero.control).toBe(null);
    expect(names(u.seen, 'hint')).toEqual([['hint', 'perch-none']]);
  });
  it('end hands the goons back', () => {
    const t = setup();
    t.stealth.end();
    expect(t.goons.every((e) => e.room === null)).toBe(true);
    t.goons[0].wake();
    expect(t.goons[0].woke).toBe(1);
    expect(t.stealth.active).toBe(false);
    expect(t.seen.at(-1)[0]).toBe('stealthEnd');
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/stealthSystem.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/stealth/stealthSystem.js`**

```js
// Predator stealth at run time. Inside a predator room it drives the room's goons on top of the
// normal enemy AI: their patrols, what each one sees (vision.js) and how it reacts (brain.js),
// noises, the alarm and its fall-back, fear, and the lines they call out. Anywhere in the city it
// hands combat the silent takedown and the perch drop (combatSystem's stealthStart hook) and keeps
// hero.perched up to date. Allocation-free per frame: every goon record, sense and goal is built
// in begin(), and line-of-sight rays run at 10 Hz per goon.
import { STEALTH, spotCheck, sightRange, inShadow, inRect, canLook, hears, perchedOn, pickSilentTarget, pickPerchDrop } from './vision.js';
import { HOSTILE, createSquad, createMind, thinkGoon, thinkSquad, alarmAll, smokeReset, struck, noteTakedown, fearSpeed, huddles, pickLine } from './brain.js';
import { createPatrol, stepPatrol, huddleSpot, pickSpot } from './patrol.js';
import { ROOMS, roomSquad, roomSpots } from './stealthRooms.js';
import { createSilentTakedown, createPerchDrop } from './takedowns.js';
import { registerMoves } from '../game/progressTracker.js';

// Plan 3C's progress tracker: the two stealth moves count toward "Moves learned".
registerMoves(['silentTakedown', 'perchDrop']);

const WALK = 1.6, SEARCH = 2.2, HUNT = 3.6;   // m/s before fear
const LOOK_SEARCH = 2.5, LOOK_HUNT = 1.5;     // seconds spent looking round at each spot
const LINE_GAP = 2.2;                         // seconds between two lines called out
const HELD_BY_CHAIN = new Set(['chained', 'tied']);

export function createStealth({ hero, combat, events, collision, perches = [], rng, rules = STEALTH }) {
  let room = null, spots = [];
  let squad = createSquad();
  const goons = [], minds = [];
  const eye = { x: 0, y: 0, z: 0 }, ray = { x: 0, y: 0, z: 0 };
  const view = { pos: hero.pos, crouched: false, perched: false, hidden: false, flying: false };
  const sense = { seesAt: -1, range: rules.range, hero: hero.pos, noise: null };
  let perchT = 0, lineT = 0, lineN = 0, alive = 0, lastAlive = -1;
  let prompt = null, wasPerched = false, wasHidden = false;
  const api = { events, noise, takedown: (e, kind, opts) => combat.takedown(e, kind, opts) };

  function hearAt(g, at) {
    g.noiseAt.x = at.x; g.noiseAt.y = at.y; g.noiseAt.z = at.z;
    g.noise = g.noiseAt;
  }

  function begin(fight, made, def = ROOMS[fight.stealth]) {
    end();
    room = def;
    spots = roomSpots(def);
    squad = createSquad();
    const list = roomSquad(def, fight.squad);
    made.forEach((e, i) => {
      const spec = list[i] ?? list[list.length - 1];
      const g = {
        e, spec, route: spec.route, mind: createMind(), patrol: createPatrol(0),
        goal: { x: e.pos.x, y: e.pos.y, z: e.pos.z, face: null }, look: { x: 0, z: 0 },
        view: { pos: e.pos, yaw: 0, hostile: false },
        seesAt: -1, range: rules.range, losT: (i * 0.1) / Math.max(1, made.length), lookT: 0, rev: -1, slot: i, k: i,
        noise: null, noiseAt: { x: 0, y: 0, z: 0 }, out: false, color: -1, baseWake: e.wake,
      };
      e.room = def.id;
      e.aware = false;
      e.seesHero = false;
      // 4E's chain hearers and a goon getting up call wake(): here that means "go and look".
      e.wake = () => hearAt(g, hero.pos);
      // 5FG's smoke calls e.lose(), which calls e.search(from).
      e.search = (from) => hearAt(g, from);
      goons.push(g);
      minds.push(g.mind);
    });
    lastAlive = -1;
    events.emit('stealthStart', { room: def.id });
  }

  function end() {
    if (!room) return;
    for (const g of goons) { g.e.room = null; g.e.wake = g.baseWake; g.e.search = undefined; g.e.seesHero = undefined; }
    goons.length = 0;
    minds.length = 0;
    room = null;
    spots = [];
    events.emit('stealthEnd');
  }

  function noise(pos, radius, kind = 'noise') {
    if (!room || !radius) return 0;
    let n = 0;
    for (const g of goons) {
      if (!canLook(g.e) || HOSTILE.has(g.mind.alert) || !hears(g.e.pos, pos, radius, rules)) continue;
      hearAt(g, pos);
      n += 1;
    }
    if (n) events.emit('stealthNoise', { pos, radius, kind, count: n });
    return n;
  }

  // How far away this goon sees Batman right now, or -1: the pure checks, then one ray.
  function look(g) {
    const e = g.e;
    g.view.yaw = e.yaw;
    g.view.hostile = HOSTILE.has(g.mind.alert);
    g.range = sightRange({ crouched: view.crouched, shadow: inShadow(hero.pos, room.lights) }, rules);
    const d = spotCheck(g.view, view, room.lights, rules);
    if (d < 0) return -1;
    eye.x = e.pos.x; eye.y = e.pos.y + rules.eye; eye.z = e.pos.z;
    ray.x = hero.pos.x - eye.x;
    ray.y = hero.pos.y + (view.crouched ? rules.crouchChest : rules.chest) - eye.y;
    ray.z = hero.pos.z - eye.z;
    const len = Math.hypot(ray.x, ray.y, ray.z);
    if (len < 0.5) return d;
    ray.x /= len; ray.y /= len; ray.z /= len;
    const hit = collision.raycast(eye, ray, len);
    return hit && hit.t < len - 0.3 ? -1 : d;
  }

  function say(g, kind, force = false) {
    if (!kind || (!force && lineT > 0)) return;
    lineT = LINE_GAP;
    events.emit('stealthLine', { target: g.e, text: pickLine(kind, lineN++) });
  }

  function shout(g) {
    const n = alarmAll(minds, squad);
    for (const o of goons) if (o.e.alive && HOSTILE.has(o.mind.alert)) o.e.aware = true;
    say(g, 'spot', true);
    events.emit('stealthAlarm', { target: g.e, count: n + 1 });
  }

  function lost() {
    let first = null;
    for (const g of goons) {
      if (!g.e.alive || g.mind.alert !== 'search') continue;
      g.e.calm();
      if (!first) first = g;
    }
    if (first) say(first, 'lost', true);
    events.emit('stealthLost');
  }

  function knockedOut(g) {
    g.out = true;
    const fear = noteTakedown(squad);
    let left = 0, speaker = null;
    for (const o of goons) {
      if (!o.e.alive) continue;
      left += 1;
      if (!speaker && canLook(o.e)) speaker = o;
    }
    if (speaker) say(speaker, `fear${fear}`, true);
    events.emit('stealthFear', { fear, left });
  }

  // Steer one goon from its mind: fight, stare, patrol (or huddle), or search and hunt.
  function drive(g, dt) {
    const e = g.e, m = g.mind;
    if (m.alert === 'engage') { e.engageNow(); return; }
    if (!e.canNav()) return;
    const k = fearSpeed(squad.fear);
    if (m.alert === 'suspicious') {
      if (e.aware) e.calm();
      e.lookAt(m.target.x, m.target.z, 'suspicious');
      return;
    }
    if (m.alert === 'patrol') {
      if (e.aware) e.calm();
      if (room.huddle && huddles(squad.fear, alive)) huddleSpot(room.huddle, g.slot, alive, g.goal);
      else stepPatrol(g.patrol, g.route, e.pos, dt, g.goal);
      e.goTo(g.goal.x, g.goal.y, g.goal.z, WALK * k, 'patrol', g.goal.face);
      return;
    }
    const hunt = m.alert === 'hunt';
    if (hunt) e.aware = true;
    else if (e.aware) e.calm();
    if (g.rev !== m.rev) {
      g.rev = m.rev;
      g.goal.x = m.target.x; g.goal.y = m.target.y; g.goal.z = m.target.z;
      g.lookT = 0;
    }
    if (g.lookT > 0) {
      g.lookT -= dt;
      e.lookAt(g.look.x, g.look.z, 'look');
      if (g.lookT <= 0) { g.k += 1; pickSpot(spots, hunt ? squad.lastKnown : m.target, e.pos.y, g.k, g.goal); }
      return;
    }
    const state = hunt ? 'hunt' : 'search';
    if (e.state === state && e.nav.arrived) {
      g.lookT = hunt ? LOOK_HUNT : LOOK_SEARCH;
      const a = rng.next() * Math.PI * 2;
      g.look.x = e.pos.x + Math.sin(a) * 5;
      g.look.z = e.pos.z + Math.cos(a) * 5;
      e.lookAt(g.look.x, g.look.z, 'look');
      return;
    }
    e.goTo(g.goal.x, g.goal.y, g.goal.z, (hunt ? HUNT : SEARCH) * k, state);
  }

  function promptFor() {
    if (hero.dead || hero.control || hero.state !== 'ground' || !hero.grounded) return null;
    if (hero.perched) return pickPerchDrop(hero.pos, combat.enemies, rules) ? 'perch' : null;
    return pickSilentTarget(hero.pos, combat.enemies, rules) ? 'silent' : null;
  }

  function update(dt) {
    if (!dt) return;
    perchT -= dt;
    if (perchT <= 0) {
      perchT = 0.1;
      const on = !hero.dead && hero.grounded && hero.state === 'ground' && !hero.control ? perchedOn(hero.pos, perches, rules) : null;
      hero.perched = !!on;
      if (hero.perched && !wasPerched) events.emit('perched');
      wasPerched = hero.perched;
      prompt = promptFor();
    }
    if (!room) return;
    view.crouched = !!hero.crouched;
    view.perched = hero.perched;
    view.hidden = !!room.vent && !!hero.crouched && inRect(hero.pos, room.vent);
    view.flying = hero.dead || hero.control?.name === 'grapple';
    if (view.hidden && !wasHidden) events.emit('ventHide');
    wasHidden = view.hidden;

    let anySees = false;
    alive = 0;
    for (const g of goons) {
      const e = g.e;
      if (!e.alive) { if (!g.out) knockedOut(g); continue; }
      alive += 1;
      if (!canLook(e)) { g.seesAt = -1; e.seesHero = false; continue; }
      g.losT -= dt;
      if (g.losT <= 0) { g.losT = 0.1; g.seesAt = look(g); e.seesHero = g.seesAt >= 0; }
      if (g.seesAt >= 0) anySees = true;
    }
    if (alive !== lastAlive) {
      let k = 0;
      for (const g of goons) if (g.e.alive) g.slot = k++;
      lastAlive = alive;
    }
    for (const g of goons) {
      const e = g.e;
      if (!e.alive || !canLook(e)) continue;
      sense.seesAt = g.seesAt;
      sense.range = g.range;
      sense.noise = g.noise;
      g.noise = null;
      const ev = thinkGoon(g.mind, squad, sense, dt, rules);
      if (ev === 'shout') shout(g);
      else if (ev) say(g, ev === 'giveUp' ? 'calm' : ev === 'search' ? 'suspect' : ev);
      drive(g, dt);
    }
    if (thinkSquad(squad, minds, anySees, dt, rules) === 'lost') lost();
    lineT = Math.max(0, lineT - dt);
  }

  // combatSystem's stealthStart hook: true when the press was used.
  function start(action) {
    if (hero.dead || hero.state !== 'ground' || !hero.grounded) return false;
    if (action !== 'punch' && action !== 'kick') return false;
    if (hero.perched) {
      const t = pickPerchDrop(hero.pos, combat.enemies, rules);
      if (!t) { events.emit('hint', { id: 'perch-none' }); return true; }
      hero.control = createPerchDrop(hero, api, { target: t, rules });
      return true;
    }
    if (action !== 'punch') return false;
    const t = pickSilentTarget(hero.pos, combat.enemies, rules);
    if (!t) return false;
    hero.control = createSilentTakedown(hero, api, { target: t, rules });
    return true;
  }

  events.on('footstep', (d) => { if (room) noise(hero.pos, d?.sprint ? rules.noise.sprint : rules.noise.step, 'step'); });
  events.on('land', (d) => { if (room && d?.hard && d.who === 'hero') noise(hero.pos, rules.noise.land, 'land'); });
  events.on('batarangWall', (d) => { if (room) noise(d.pos, rules.noise.batarang, 'batarang'); });
  events.on('smoke', (d) => {
    if (!room) return;
    smokeReset(minds, squad, d.pos, rules);
    for (const g of goons) if (g.e.alive) g.e.calm();
    events.emit('stealthLost');
  });
  events.on('impact', (d) => {
    const target = d?.target;
    if (!room || !target?.alive || target.room !== room.id || HELD_BY_CHAIN.has(target.state)) return;
    const g = goons.find((x) => x.e === target);
    if (g && struck(g.mind, squad, hero.pos, d.outcome, rules) === 'shout') shout(g);
  });

  return {
    get active() { return !!room; },
    get room() { return room; },
    get alarm() { return squad.alarm; },
    get squad() { return squad; },
    get prompt() { return prompt; },
    goons, rules,
    begin, end, update, noise, start,
    armed() { let n = 0; for (const g of goons) if (g.e.alive && g.e.def?.ranged) n += 1; return n; },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/stealthSystem.test.js`
Expected: PASS.

- [ ] **Step 5: Wire it into the game.** In `src/game/game.js`:
  - Import `import { createStealth } from '../stealth/stealthSystem.js';`.
  - In `buildRun`, right before the `createCombat(...)` call, add `let stealth = null;` and add this option to the `createCombat` call: `stealthStart: (action, c) => stealth?.start(action, c) ?? false,`.
  - Right after `hero.combat = combat;`, add:

```js
    // Predator stealth: room goons, perches, silent takedowns and perch drops (Part D).
    stealth = createStealth({ hero, combat, events, collision: world.collision, perches: world.grapplePoints.filter((p) => p.perch), rng });
```

  - Pass it to the encounters: `const encounters = createEncounters({ spawn, despawn, combat, events, collision: world.collision, stealth });`.
  - In `update`, right before `combat.update(dt, ctx);`, add `stealth.update(dt);`.
  - Add `stealth` to the `api` object.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Play a room.** Build and preview, then:

```bash
cat > "$TEMP/s6-t11.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['stealthAlarm', 'stealthLost', 'stealthLine', 'stealthFear', 'silentTakedown', 'fightDone', 'heroHurt']) G.events.on(n, (d) => G.__log.push([n, d?.text ?? d?.kind ?? d?.id ?? d?.fear ?? ''])); [G.flow.objectives.step.id, G.stealth.goons.map((g) => [g.e.type, g.mind.alert, g.e.state])]"},
 {"wait": 3000},
 {"eval": "window.__game.stealth.goons.map((g) => [g.e.state, +g.e.pos.x.toFixed(1), +g.e.pos.z.toFixed(1)])"},
 {"eval": "const G = window.__game, e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); 'behind goon 0'", "wait": 250},
 {"eval": "window.__game.stealth.prompt"},
 {"click": 0, "wait": 2800},
 {"eval": "const G = window.__game; [G.stealth.goons[0].e.alive, G.stealth.goons.map((g) => g.mind.alert), G.stealth.squad.fear]"},
 {"eval": "const G = window.__game, e = G.stealth.goons[1].e; G.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 6, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 6 }, e.yaw + Math.PI); 'in front of goon 1'", "wait": 3000},
 {"eval": "const G = window.__game; [G.stealth.alarm, G.stealth.goons.map((g) => [g.mind.alert, g.e.aware])]"},
 {"wait": 3000},
 {"eval": "const G = window.__game, p = G.world.grapplePoints.find((q) => q.perch && q.gargoyle && Math.abs(q.x - 200.32) < 0.1); G.hero.teleport({ x: p.x, y: p.y, z: p.z }, Math.PI / 2); 'escaped to a perch'", "wait": 9500},
 {"eval": "const G = window.__game; [G.hero.perched, G.stealth.alarm, G.stealth.goons.map((g) => [g.mind.alert, g.e.aware])]"},
 {"eval": "window.__game.winFight(); 'win'", "wait": 2500},
 {"eval": "const G = window.__game; [G.flow.objectives.step.id, G.stealth.active, JSON.stringify(G.__log)]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=monarchBalcony&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t11.json")"
```

Expected:
- The first eval prints `room`; then `["monarchBalcony",[["rifle","patrol","idle"],...]]`.
- After 3 s the goons' states are `patrol` (or `idle` at a wait) and their positions have moved along their routes.
- Behind goon 0 the prompt is `silent`; after the click, goon 0 is out (`false`), the others are still `patrol` or `search` (a goon within 6 m heard it), and fear is 1.
- In front of goon 1, within 3 s the alarm is up (`true`) and every goon is `engage` or `hunt` with `aware` true; the log has `stealthAlarm` and, within the next 3 s, `["heroHurt","rifle"]` entries (god mode refills health).
- After 9.5 s on the perch: `[true,false,[...]]` with every goon `search` and `aware` false, and `stealthLost` in the log.
- After `winFight`, the step is `party`, the room is inactive and the log ends with `fightDone`.
- `no console errors`.

- [ ] **Step 8: Commit**

```bash
git add src/stealth/stealthSystem.js src/game/game.js tests/unit/stealthSystem.test.js
git commit -m "Stealth runtime: senses, awareness, patrols, noise, alarm, fear, takedown hooks"
```

---

### Task 12: The batarang distraction

**Files:**
- Modify: `src/gadgets/g/batarang.js` (5FG), `src/gadgets/gadgetSystem.js` (5FG: one dependency), `src/game/game.js` (pass `stealth` to the gadget system)
- Test: `tests/unit/batarangWall.test.js` (new)

**Interfaces:**
- Consumes: 5FG's handler contract (`fire(sys, ctx) -> boolean`, `retry: true`), `sys.api.alive/canSee/inputDir/batarang`, `sys.fx.batarang(from, getTarget(out), onHit)` (pooled), `sys.follow.lookDir(out)`, `sys.collision.raycast`, `sys.events`, `sys.effects.batarangCount`; `stealth.active` (Task 11).
- Produces: `sys.stealth`; in a predator room the batarang locks onto a goon only within 0.3 rad of the aim, and otherwise flies to the wall (or floor) under the crosshair, 2 to 30 m away, emitting `batarangWall { pos }` and `TINK!` on arrival. The stealth runtime (Task 11) turns `batarangWall` into a 12 m noise. Outside a room nothing changes.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/batarangWall.test.js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createBatarangHandler } from '../../src/gadgets/g/batarang.js';
import { createEvents } from '../../src/core/events.js';

function goonAt(id, x, z) {
  return { id, alive: true, down: false, state: 'patrol', pos: new THREE.Vector3(x, 0, z), get x() { return this.pos.x; }, get z() { return this.pos.z; } };
}
function sysWith({ goons = [], wallAt = 10, stealth = true } = {}) {
  const events = createEvents(), seen = [];
  events.on('batarangWall', (d) => seen.push(['wall', +d.pos.x.toFixed(2), +d.pos.z.toFixed(2)]));
  events.on('batarangThrow', () => seen.push(['throw']));
  events.on('word', (d) => seen.push(['word', d.text]));
  const fx = { batarang: vi.fn((from, getTarget, onHit) => { getTarget(new THREE.Vector3()); onHit(); }) };
  const hero = {
    pos: new THREE.Vector3(0, 0, 0), control: null,
    bat: { face() {}, animator: { play() {} }, bone: () => ({ getWorldPosition: (v) => v.set(0, 1.4, 0) }) },
  };
  const api = { alive: () => goons, canSee: () => true, inputDir: () => new THREE.Vector3(0, 0, 1), batarang: vi.fn(() => ({ name: 'batarang' })) };
  const sys = {
    hero, events, fx, api, effects: { batarangCount: 1 }, stealth: { active: stealth },
    follow: { lookDir: (v) => v.set(0, 0, 1) },
    collision: { raycast: (o, d, max) => (wallAt !== null && wallAt <= max ? { t: wallAt, box: { tag: 'wall' } } : null) },
  };
  return { sys, seen, fx, hero, api };
}
const run = (ctl, secs) => { for (let t = 0; t < secs; t += 1 / 60) if (ctl.update(1 / 60)) break; };

describe('the batarang in a predator room', () => {
  it('with no goon under the crosshair it flies to the wall, and the clang goes out', () => {
    const t = sysWith();
    expect(createBatarangHandler().fire(t.sys, {})).toBe(true);
    expect(t.hero.control.name).toBe('batarang');
    run(t.hero.control, 0.5);
    expect(t.fx.batarang).toHaveBeenCalledTimes(1);
    expect(t.seen).toEqual([['throw'], ['wall', 0, 9.85], ['word', 'TINK!']]);
  });
  it('only locks onto a goon right under the crosshair', () => {
    const off = sysWith({ goons: [goonAt('side', 6, 6)] });
    createBatarangHandler().fire(off.sys, {});
    expect(off.api.batarang).not.toHaveBeenCalled();
    expect(off.hero.control.name).toBe('batarang');
    const on = sysWith({ goons: [goonAt('ahead', 0.5, 8)] });
    createBatarangHandler().fire(on.sys, {});
    expect(on.api.batarang).toHaveBeenCalledTimes(1);
  });
  it('needs a wall between 2 and 30 m', () => {
    expect(createBatarangHandler().fire(sysWith({ wallAt: null }).sys, {})).toBe(false);
    expect(createBatarangHandler().fire(sysWith({ wallAt: 1 }).sys, {})).toBe(false);
  });
  it('outside a predator room nothing changes: no goon, no throw', () => {
    const t = sysWith({ stealth: false });
    expect(createBatarangHandler().fire(t.sys, {})).toBe(false);
    expect(t.hero.control).toBe(null);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/batarangWall.test.js`
Expected: FAIL.

- [ ] **Step 3: Rewrite `src/gadgets/g/batarang.js`**

```js
// Gadget 1, the batarang, as it always was: it stuns and interrupts the goon you steer toward, up
// to 26 m away. With WayneTech's Triple Batarang it throws one at each of up to three goons.
// In a predator room (Part D) it only locks onto a goon right under the crosshair; otherwise it
// flies to the wall you are looking at, and the clang pulls goons within 12 m over to look.
import * as THREE from 'three';
import { selectTarget } from '../../combat/targeting.js';

const WALL_RANGE = 30, WALL_MIN = 2;

export function createBatarangHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();

  function throwAtWall(sys) {
    const { hero, follow, collision, events, fx } = sys;
    follow.lookDir(dir);
    eye.set(hero.pos.x, hero.pos.y + 1.5, hero.pos.z);
    const hit = collision.raycast(eye, dir, WALL_RANGE);
    if (!hit || hit.t < WALL_MIN) return false;
    const at = eye.clone().addScaledVector(dir, hit.t - 0.15);
    hero.bat.face(Math.atan2(dir.x, dir.z));
    hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
    events.emit('batarangThrow', { count: 1 });
    let t = 0, thrown = false;
    hero.control = {
      name: 'batarang', combat: true,
      canChain: () => t > 0.25,
      update(dt) {
        t += dt;
        if (!thrown && t > 0.14) {
          thrown = true;
          hero.bat.bone('hand_r').getWorldPosition(hand);
          fx.batarang(hand.clone(), (out) => out.copy(at), () => {
            events.emit('batarangWall', { pos: at });
            events.emit('word', { text: 'TINK!', pos: at, big: false });
          });
        }
        return t > 0.35;
      },
    };
    return true;
  }

  return {
    id: 'batarang',
    // No goon in range yet: the buffered press tries again for a moment, as before.
    retry: true,
    fire(sys, ctx) {
      const { api, hero, effects } = sys;
      const quiet = !!sys.stealth?.active;
      const list = api.alive().filter((e) => e.state !== 'grabbed' && api.canSee(e));
      const first = selectTarget(hero.pos, api.inputDir(ctx, true), list, { range: 26, maxAngle: quiet ? 0.3 : 1.2 });
      if (!first) return quiet ? throwAtWall(sys) : false;
      const targets = [first];
      if (effects.batarangCount > 1) {
        const rest = list.filter((e) => e !== first && !e.down && e.pos.distanceTo(hero.pos) < 26)
          .sort((a, b) => a.pos.distanceTo(first.pos) - b.pos.distanceTo(first.pos));
        targets.push(...rest.slice(0, effects.batarangCount - 1));
      }
      hero.control = api.batarang(targets, sys.fx);
      return true;
    },
  };
}
```

- [ ] **Step 4: Give gadgets the stealth runtime.** In `src/gadgets/gadgetSystem.js`, add `stealth = null` to the destructured `deps` and `stealth,` to the `sys` object. In `src/game/game.js`, add `stealth,` to the `createGadgetSystem({ ... })` call (the gadget system is created after `stealth` in `buildRun`; if it is created earlier, move the `createStealth` call above it).

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS, including 5FG's `gadgetSystem.test.js`.

- [ ] **Step 6: Throw one in the vat hall.** Build and preview, then:

```bash
cat > "$TEMP/s6-t12.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active && window.__game.gadgets ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.gadgets.equip('batarang'); G.__log = []; G.events.on('batarangWall', (d) => G.__log.push(['wall', Math.round(d.pos.x), Math.round(d.pos.z)])); G.events.on('stealthNoise', (d) => G.__log.push(['noise', d.kind, d.count])); G.hero.teleport({ x: 150, y: 0.15, z: -118 }, -Math.PI / 2); G.follow.snapBehind(-Math.PI / 2); 'aimed west'", "wait": 600},
 {"press": "KeyR", "wait": 1500},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.stealth.goons.map((g) => [g.mind.alert, +g.mind.target.x.toFixed(0), +g.mind.target.z.toFixed(0)])]"},
 {"shot": "t12-distraction"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=aceCatwalks&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t12.json")"
```

Expected: the log holds one `wall` entry within 30 m west of Batman (the floor, a crate or a vat) and, if any goon was within 12 m of it, a `noise` of kind `batarang`; those goons are `search` with their target at the clang. `TINK!` shows in `t12-distraction.png`. `no console errors`. If no goon was near, move Batman so a patrol passes within 12 m of the aim point and throw again.

- [ ] **Step 7: Commit**

```bash
git add src/gadgets/g/batarang.js src/gadgets/gadgetSystem.js src/game/game.js tests/unit/batarangWall.test.js
git commit -m "Batarang distraction: in a predator room it clangs off the wall you aim at"
```

---

### Task 13: Vision cones, laser sights, shots and x-ray state colours

**Files:**
- Create: `src/stealth/stealthFx.js`
- Modify: `src/game/warmCast.js`, `src/game/game.js`
- Test: `tests/unit/stealthFx.test.js`

**Interfaces:**
- Consumes: `LAYER_FX`, `LAYER_XRAY` (`src/render/layers.js`; the x-ray layer is drawn over the frame only in detective vision), `STEALTH.fov`, `stateColor` (Task 2), goon records from Task 11 (`e`, `mind`, `range`, `color`), `e.aiming`, `ch.muzzle`, `ch.xrays` (Task 6), event `rifleShot` (Task 9).
- Produces: `STEALTH_FX_MAX`, `STATE_COLORS`, `stealthMaterials()`, `createStealthWarm()`, `createStealthFx(scene) -> { update(dt, goons, { detective, hero }), shot(from, to), clear(goons), parts }`, `window.__game.stealthFx`.

Detective vision in a predator room (spec D4): each goon's silhouette through walls turns white while it patrols, yellow while it searches and red when hostile, and a flat fan the size of its current sight range lies on the floor in front of it. The armed-goon counter is Task 14's.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/stealthFx.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createStealthFx, createStealthWarm, STEALTH_FX_MAX, STATE_COLORS } from '../../src/stealth/stealthFx.js';
import { createMind } from '../../src/stealth/brain.js';
import { LAYER_XRAY, LAYER_FX } from '../../src/render/layers.js';
import { PALETTE } from '../../src/config/palette.js';

function goon(x, z, alert = 'patrol', aiming = false) {
  const muzzle = new THREE.Object3D();
  muzzle.position.set(x, 1.4, z + 0.7);
  const e = { alive: true, down: false, pos: new THREE.Vector3(x, 0, z), yaw: 0.5, aiming, ch: { muzzle, xrays: [{ material: { color: new THREE.Color(PALETTE.sodium) } }] } };
  const mind = createMind();
  mind.alert = alert;
  return { e, mind, range: 15, color: -1 };
}
const hero = { pos: new THREE.Vector3(0, 0, 10), crouched: false };
function setup() {
  const scene = new THREE.Scene();
  const fx = createStealthFx(scene);
  const goons = [goon(0, 0, 'patrol', true), goon(5, 0, 'search'), goon(9, 0, 'hunt')];
  return { scene, fx, goons, cones: fx.parts.cones };
}

describe('stealth visuals', () => {
  it('are built up front: nothing is added to the scene afterwards', () => {
    const { scene, fx, goons } = setup();
    const n = scene.children.length;
    for (let i = 0; i < 100; i++) fx.update(0.016, goons, { detective: true, hero });
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10));
    fx.update(0.016, goons, { detective: true, hero });
    fx.clear(goons);
    expect(scene.children.length).toBe(n);
    expect(fx.parts.cones).toHaveLength(STEALTH_FX_MAX);
  });
  it('in detective vision each goon has a cone in its state colour, sized to its sight range', () => {
    const { fx, goons, cones } = setup();
    fx.update(0.016, goons, { detective: true, hero });
    expect(cones.slice(0, 4).map((c) => c.visible)).toEqual([true, true, true, false]);
    expect(cones.map((c) => c.material.color.getHex()).slice(0, 3)).toEqual(STATE_COLORS);
    expect(cones.every((c) => c.layers.mask === 1 << LAYER_XRAY)).toBe(true);
    expect(cones[1].position.toArray()).toEqual([5, 0.06, 0]);
    expect(cones[1].rotation.y).toBeCloseTo(0.5);
    expect(cones[1].scale.x).toBe(15);
  });
  it('cones hide outside detective vision; x-ray tints follow the state and clear() restores them', () => {
    const { fx, goons, cones } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    expect(cones.some((c) => c.visible)).toBe(false);
    expect(goons[1].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[1]);
    expect(goons[2].e.ch.xrays[0].material.color.getHex()).toBe(STATE_COLORS[2]);
    fx.clear(goons);
    expect(goons[2].e.ch.xrays[0].material.color.getHex()).toBe(PALETTE.sodium);
  });
  it('draws a laser from each aiming muzzle to Batman chest', () => {
    const { fx, goons } = setup();
    fx.update(0.016, goons, { detective: false, hero });
    const { lasers } = fx.parts;
    expect(lasers.visible).toBe(true);
    expect(lasers.layers.mask).toBe(1 << LAYER_FX);
    expect(lasers.geometry.drawRange.count).toBe(2);
    const p = lasers.geometry.attributes.position.array;
    expect(Array.from(p.slice(0, 6)).map((v) => +v.toFixed(2))).toEqual([0, 1.4, 0.7, 0, 1.1, 10]);
    goons[0].e.aiming = false;
    fx.update(0.016, goons, { detective: false, hero });
    expect(lasers.visible).toBe(false);
  });
  it('a shot flashes for a moment', () => {
    const { fx, goons } = setup();
    fx.shot(new THREE.Vector3(0, 1.4, 0), new THREE.Vector3(0, 1.1, 10));
    fx.update(0.016, goons, { detective: false, hero });
    expect(fx.parts.tracers.visible).toBe(true);
    expect(fx.parts.flashes.some((f) => f.visible)).toBe(true);
    for (let i = 0; i < 20; i++) fx.update(0.016, goons, { detective: false, hero });
    expect(fx.parts.tracers.visible).toBe(false);
    expect(fx.parts.flashes.some((f) => f.visible)).toBe(false);
  });
  it('the warm-up copy holds one of every material', () => {
    const g = createStealthWarm();
    const mats = new Set();
    g.traverse((o) => { if (o.material) mats.add(o.material); });
    expect(mats.size).toBe(STATE_COLORS.length + 3);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/stealthFx.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/stealth/stealthFx.js`**

```js
// Predator visuals, built once per run and only moved afterwards:
// - vision cones: a flat fan on the floor in front of each room goon, the size of its current
//   sight range, drawn only in detective vision (LAYER_XRAY): white patrolling, yellow searching,
//   red hostile. The goon's x-ray silhouette gets the same colour;
// - laser sights: a red line from the muzzle to Batman while a rifle goon aims (one LineSegments);
// - shots: a pale tracer and a muzzle flash for a moment when a rifle fires.
// createStealthWarm() puts one of each material in the boot warm cast (warmCast.js).
import * as THREE from 'three';
import { LAYER_FX, LAYER_XRAY } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';
import { STEALTH } from './vision.js';
import { stateColor } from './brain.js';

export const STEALTH_FX_MAX = 8;
export const STATE_COLORS = [0xe8f0ff, 0xffd23a, 0xff3b3b]; // patrolling, searching, hostile
const SHOTS = 4, SHOT_LIFE = 0.12;

// A unit-radius fan in the XZ plane, apex at the origin, opening toward +z (a goon's yaw 0).
function coneGeometry(fov = STEALTH.fov, seg = 16) {
  const pos = [0, 0, 0];
  for (let i = 0; i <= seg; i++) {
    const a = -fov / 2 + (fov * i) / seg;
    pos.push(Math.sin(a), 0, Math.cos(a));
  }
  const idx = [];
  for (let i = 1; i <= seg; i++) idx.push(0, i + 1, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const segments = (n) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  return g;
};

let shared = null;
export function stealthMaterials() {
  if (shared) return shared;
  shared = {
    cones: STATE_COLORS.map((color) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, depthTest: false, depthWrite: false, side: THREE.DoubleSide })),
    laser: new THREE.LineBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.9 }),
    tracer: new THREE.LineBasicMaterial({ color: 0xfff1b8 }),
    flash: new THREE.MeshBasicMaterial({ color: 0xffd86a }),
  };
  return shared;
}

// One of each, below the city, drawn once under the loading screen.
export function createStealthWarm() {
  const m = stealthMaterials();
  const group = new THREE.Group();
  group.name = 'stealthWarm';
  const geo = coneGeometry();
  m.cones.forEach((mat, i) => { const c = new THREE.Mesh(geo, mat); c.position.set(20 + i * 2, -50, 0); group.add(c); });
  const line = segments(1);
  line.attributes.position.array.set([30, -50, 0, 31, -49, 0]);
  group.add(new THREE.LineSegments(line, m.laser), new THREE.LineSegments(line, m.tracer));
  const flash = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), m.flash);
  flash.position.set(32, -50, 0);
  group.add(flash);
  return group;
}

export function createStealthFx(scene) {
  const m = stealthMaterials();
  const geo = coneGeometry();
  const cones = [];
  for (let i = 0; i < STEALTH_FX_MAX; i++) {
    const c = new THREE.Mesh(geo, m.cones[0]);
    c.layers.set(LAYER_XRAY);
    c.visible = false;
    c.frustumCulled = false;
    c.renderOrder = 2;
    scene.add(c);
    cones.push(c);
  }
  const laserGeo = segments(STEALTH_FX_MAX);
  const laserPos = laserGeo.attributes.position.array;
  laserGeo.setDrawRange(0, 0);
  const lasers = new THREE.LineSegments(laserGeo, m.laser);
  const tracerGeo = segments(SHOTS);
  const tracerPos = tracerGeo.attributes.position.array;
  const tracers = new THREE.LineSegments(tracerGeo, m.tracer);
  for (const o of [lasers, tracers]) { o.layers.set(LAYER_FX); o.frustumCulled = false; o.visible = false; scene.add(o); }
  const flashGeo = new THREE.OctahedronGeometry(0.18);
  const flashes = [];
  for (let i = 0; i < SHOTS; i++) {
    const f = new THREE.Mesh(flashGeo, m.flash);
    f.layers.set(LAYER_FX);
    f.visible = false;
    f.frustumCulled = false;
    scene.add(f);
    flashes.push(f);
  }
  const life = new Float32Array(SHOTS);
  const tmp = new THREE.Vector3();
  let next = 0;
  const tint = (e, hex) => { for (const x of e.ch.xrays ?? []) x.material.color.setHex(hex); };

  return {
    parts: { cones, lasers, tracers, flashes },
    update(dt, goons, { detective = false, hero = null } = {}) {
      let n = 0;
      for (let i = 0; i < cones.length; i++) {
        const g = goons[i], c = cones[i];
        if (!g || !g.e.alive) { c.visible = false; continue; }
        const s = stateColor(g.mind);
        if (s !== g.color) { g.color = s; c.material = m.cones[s]; tint(g.e, STATE_COLORS[s]); }
        c.visible = detective && !g.e.down;
        if (c.visible) {
          c.position.set(g.e.pos.x, g.e.pos.y + 0.06, g.e.pos.z);
          c.rotation.y = g.e.yaw;
          c.scale.setScalar(g.range);
        }
        if (hero && g.e.aiming && g.e.ch.muzzle) {
          g.e.ch.muzzle.getWorldPosition(tmp);
          const o = n * 6;
          laserPos[o] = tmp.x; laserPos[o + 1] = tmp.y; laserPos[o + 2] = tmp.z;
          laserPos[o + 3] = hero.pos.x; laserPos[o + 4] = hero.pos.y + (hero.crouched ? 0.7 : 1.1); laserPos[o + 5] = hero.pos.z;
          n += 1;
        }
      }
      laserGeo.setDrawRange(0, n * 2);
      if (n) laserGeo.attributes.position.needsUpdate = true;
      lasers.visible = n > 0;
      let live = 0;
      for (let i = 0; i < SHOTS; i++) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        if (life[i] > 0) { live += 1; continue; }
        flashes[i].visible = false;
        tracerPos.fill(0, i * 6, i * 6 + 6);
        tracerGeo.attributes.position.needsUpdate = true;
      }
      tracers.visible = live > 0;
    },
    // A rifle fired: from the muzzle to where it aimed (copied; the caller reuses its vectors).
    shot(from, to) {
      const i = next;
      next = (next + 1) % SHOTS;
      const o = i * 6;
      tracerPos[o] = from.x; tracerPos[o + 1] = from.y; tracerPos[o + 2] = from.z;
      tracerPos[o + 3] = to.x; tracerPos[o + 4] = to.y; tracerPos[o + 5] = to.z;
      tracerGeo.attributes.position.needsUpdate = true;
      flashes[i].position.copy(from);
      flashes[i].visible = true;
      life[i] = SHOT_LIFE;
      tracers.visible = true;
    },
    // The room ended: hide everything and hand back the goons' usual x-ray colour.
    clear(goons = []) {
      for (const c of cones) c.visible = false;
      lasers.visible = false;
      laserGeo.setDrawRange(0, 0);
      life.fill(0);
      for (const f of flashes) f.visible = false;
      tracerPos.fill(0);
      tracerGeo.attributes.position.needsUpdate = true;
      tracers.visible = false;
      for (const g of goons) { tint(g.e, PALETTE.sodium); g.color = -1; }
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/stealthFx.test.js`
Expected: PASS.

- [ ] **Step 5: Warm and wire it.**
  - In `src/game/warmCast.js`, import `import { createStealthWarm } from '../stealth/stealthFx.js';` and add `group.add(createStealthWarm());` next to 5FG's gadget warm set.
  - In `src/game/game.js`, import `import { createStealthFx } from '../stealth/stealthFx.js';`. In `buildRun`, right after `const fx = createFx(scene);`, add `const stealthFx = createStealthFx(scene);`. After the stealth runtime is created, add:

```js
    events.on('rifleShot', ({ from, to }) => stealthFx.shot(from, to));
    events.on('stealthEnd', () => stealthFx.clear());
```

  - In `update`, right after `fx.update(dt);`, add `stealthFx.update(dt, stealth.goons, { detective: !!state.detectiveOn, hero });`.
  - Add `stealthFx` to the `api` object.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Look at them.** Build and preview, then:

```bash
cat > "$TEMP/s6-t13.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 150, y: 0.15, z: -96 }, Math.PI * 1.25); G.follow.snapBehind(Math.PI * 1.25); 'overlook'", "wait": 800},
 {"press": "KeyV", "wait": 1200},
 {"shot": "t13-cones"},
 {"press": "KeyV", "wait": 300},
 {"eval": "const G = window.__game; G.__shot = false; G.events.on('rifleShot', () => { if (!G.__shot) { G.__shot = true; G.state.paused = true; } }); const e = G.stealth.goons[3].e; G.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 7, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 7 }, e.yaw + Math.PI); 'in front of goon 3'"},
 {"eval": "new Promise((res) => { const G = window.__game; const f = () => (G.stealth.goons.some((g) => g.e.aiming) ? res('aiming') : setTimeout(f, 30)); f(); })", "wait": 200},
 {"shot": "t13-laser"},
 {"eval": "new Promise((res) => { const G = window.__game; const f = () => (G.__shot ? res('shot') : setTimeout(f, 30)); f(); })"},
 {"shot": "t13-shot"},
 {"eval": "const G = window.__game; G.state.paused = false; G.stealth.goons.map((g) => g.e.ch.xrays[0].material.color.getHexString())"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=aceCatwalks&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t13.json")"
```

Expected: `t13-cones.png` shows detective vision with a pale fan on the floor or catwalk in front of each goon and the goons' silhouettes pale through the catwalks. `t13-laser.png` shows a thin red line from a rifle to Batman. `t13-shot.png` shows a pale tracer and a yellow flash at the muzzle. The last eval shows the x-ray colours `ff3b3b` for hostile goons (and `e8f0ff` or `ffd23a` for any that aren't). `no console errors`.

- [ ] **Step 8: Commit**

```bash
git add src/stealth/stealthFx.js src/game/warmCast.js src/game/game.js tests/unit/stealthFx.test.js
git commit -m "Detective vision cones and state colours, laser sights, tracers and muzzle flashes"
```

---

### Task 14: The predator HUD

**Files:**
- Create: `src/ui/stealthHud.js`
- Modify: `src/ui/style.css`, `src/game/game.js`

**Interfaces:**
- Consumes: `glyphCode`, `glyphColor`, `glyphFill` (Task 2); `stealth.goons`, `stealth.prompt`, `stealth.armed()`, `stealth.active` (Task 11); event `stealthLine { target, text }`, `stealthEnd`; `hero.crouched`; the HUD's CSS variables (`--paper`, `--ink`, `--signal`).
- Produces: `createStealthHud(root)` (see Shared interfaces, plus `hideFrom(n)`), `window.__game.stealthHud`.

What it shows:
- **Awareness glyph** over each room goon's head: a ring that fills white while it notices Batman, yellow while it searches, red with `!` once hostile (`?` otherwise). Nothing over a calm patrol.
- **Speech balloons**: the lines goons call out, lettered in the comic hand font, over the goon for 2.6 s.
- **Armed counter** in detective vision: a rifle icon and how many armed goons are still up.
- **Takedown prompt**: `LMB Silent takedown` behind an unaware goon, `E Perch drop` on a perch over one (with the live key labels).
- **Crouch badge** while crouched.

- [ ] **Step 1: Write `src/ui/stealthHud.js`**

```js
// Predator HUD: an awareness ring over each room goon (it fills white while he notices Batman,
// turns yellow while he searches and red once he has found him), speech balloons for the lines
// goons call out, the armed-goon counter for detective vision, the takedown prompt and a crouch
// badge. Pooled DOM: every element is made once; classes and attributes change only when a code
// changes, and only positions are written every frame.
import { glyphColor, glyphFill } from '../stealth/brain.js';

const MAX = 8, LINES = 3, LINE_TIME = 2.6;
const RING = 2 * Math.PI * 12;
const RIFLE = '<path d="M3 21 L29 21 L33 17 L45 17 L45 21 L41 23 L31 23 L27 29 L21 29 L23 23 L3 23 Z"/>';
const CROUCH = '<circle cx="21" cy="9" r="4.5"/><path d="M13 30 L17 20 L27 18 L31 27 L25 34 M17 20 L11 27"/>';

export function createStealthHud(root) {
  const el = document.createElement('div');
  el.className = 'stealth-hud';
  el.innerHTML = `
    <div class="st-armed hidden"><svg viewBox="0 0 48 40">${RIFLE}</svg><b>0</b><span>ARMED</span></div>
    <div class="st-prompt hidden"></div>
    <div class="st-crouch hidden"><svg viewBox="0 0 40 40">${CROUCH}</svg></div>`;
  root.appendChild(el);
  const armedEl = el.querySelector('.st-armed'), armedN = armedEl.querySelector('b');
  const promptEl = el.querySelector('.st-prompt'), crouchEl = el.querySelector('.st-crouch');
  const glyphs = [];
  for (let i = 0; i < MAX; i++) {
    const g = document.createElement('div');
    g.className = 'st-aware hidden';
    g.innerHTML = `<svg viewBox="0 0 32 32"><circle class="bg" cx="16" cy="16" r="12"/><circle class="fill" cx="16" cy="16" r="12" stroke-dasharray="0 ${RING.toFixed(1)}" transform="rotate(-90 16 16)"/></svg><b></b>`;
    el.appendChild(g);
    glyphs.push({ el: g, fill: g.querySelector('.fill'), mark: g.querySelector('b'), code: -1, shown: false });
  }
  const lines = [];
  for (let i = 0; i < LINES; i++) {
    const b = document.createElement('div');
    b.className = 'st-line hidden';
    el.appendChild(b);
    lines.push({ el: b, target: null, t: 0, shown: false });
  }
  let next = 0, armedCount = -1, armedShown = null, promptHtml = null, crouchOn = false;
  const show = (o, v) => { if (o.shown !== v) { o.shown = v; o.el.classList.toggle('hidden', !v); } };

  const hud = {
    // code from brain.glyphCode(mind); x, y: the goon's head on screen.
    glyph(i, x, y, visible, code) {
      const g = glyphs[i];
      if (!g) return;
      show(g, visible && code > 0);
      if (!g.shown) return;
      if (code !== g.code) {
        g.code = code;
        g.el.dataset.c = glyphColor(code);
        g.fill.setAttribute('stroke-dasharray', `${(glyphFill(code) * RING).toFixed(1)} ${RING.toFixed(1)}`);
        g.mark.textContent = code >> 5 === 3 ? '!' : '?';
      }
      g.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },
    hideFrom(n) { for (let i = n; i < MAX; i++) show(glyphs[i], false); },
    // A line over `target` for a moment (the same goon's new line replaces its old one).
    say(target, text) {
      let l = null;
      for (const x of lines) if (x.target === target) l = x;
      if (!l) { l = lines[next]; next = (next + 1) % LINES; }
      l.target = target;
      l.t = LINE_TIME;
      l.el.textContent = text;
    },
    // place(e) -> { x, y, behind }: where the goon's head is on screen (a shared object is fine).
    updateLines(dt, place) {
      for (const l of lines) {
        if (!l.target) continue;
        l.t -= dt;
        if (l.t <= 0 || !l.target.alive) { l.target = null; show(l, false); continue; }
        const p = place(l.target);
        show(l, !p.behind);
        if (l.shown) l.el.style.transform = `translate(${Math.round(p.x + 14)}px, ${Math.round(p.y - 70)}px)`;
      }
    },
    armed(n, visible) {
      if (n === armedCount && visible === armedShown) return;
      armedCount = n;
      armedShown = visible;
      armedEl.classList.toggle('hidden', !visible);
      armedN.textContent = String(n);
    },
    prompt(html) {
      if (html === promptHtml) return;
      promptHtml = html;
      promptEl.classList.toggle('hidden', !html);
      if (html) promptEl.innerHTML = html;
    },
    crouch(on) {
      if (on === crouchOn) return;
      crouchOn = on;
      crouchEl.classList.toggle('hidden', !on);
    },
    clear() {
      for (const g of glyphs) { show(g, false); g.code = -1; }
      for (const l of lines) { l.target = null; show(l, false); }
      hud.armed(0, false);
      hud.prompt(null);
    },
  };
  return hud;
}
```

- [ ] **Step 2: Styles.** Append to `src/ui/style.css`:

```css
/* ---- predator stealth HUD ---- */
.stealth-hud { position: absolute; inset: 0; pointer-events: none; }
.st-aware.hidden, .st-line.hidden, .st-armed.hidden, .st-prompt.hidden, .st-crouch.hidden { display: none; }
.st-aware { position: absolute; left: -16px; top: -48px; width: 32px; height: 32px; will-change: transform; }
.st-aware svg { width: 100%; height: 100%; overflow: visible; }
.st-aware .bg { fill: var(--paper); stroke: var(--ink); stroke-width: 3; }
.st-aware .fill { fill: none; stroke: #f4f4f4; stroke-width: 6; stroke-linecap: butt; }
.st-aware[data-c="yellow"] .fill { stroke: var(--signal); }
.st-aware[data-c="red"] .fill { stroke: #e0282e; }
.st-aware[data-c="red"] { animation: pop 0.18s ease-out; }
.st-aware b { position: absolute; inset: 0; display: grid; place-items: center; font: 18px 'Bangers', cursive; color: var(--ink); }
.st-line { position: absolute; left: 0; top: 0; max-width: 230px; padding: 6px 12px; background: var(--paper); border: 3px solid var(--ink);
  border-radius: 20px; box-shadow: 3px 3px 0 var(--ink); font: 19px 'Patrick Hand SC', cursive; color: var(--ink); white-space: nowrap; will-change: transform; }
.st-line::after { content: ''; position: absolute; left: 16px; bottom: -15px; border: 8px solid transparent; border-top: 12px solid var(--ink); }
.st-armed { position: absolute; right: 36px; top: 150px; display: flex; align-items: center; gap: 8px; padding: 4px 12px; background: var(--paper);
  border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); transform: skewX(-10deg); }
.st-armed svg { width: 40px; height: 34px; }
.st-armed path { fill: var(--ink); }
.st-armed b { font: 30px 'Bangers', cursive; color: #e0282e; }
.st-armed span { font: 16px 'Bangers', cursive; letter-spacing: 1px; color: var(--ink); }
.st-prompt { position: absolute; left: 50%; bottom: 170px; transform: translateX(-50%) skewX(-8deg); padding: 6px 14px; background: var(--signal);
  border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); font: 22px 'Bangers', cursive; letter-spacing: 1px; color: var(--ink); }
.st-crouch { position: absolute; left: 150px; bottom: 36px; width: 44px; height: 44px; background: var(--paper); border: 3px solid var(--ink); border-radius: 50%; box-shadow: 2px 2px 0 var(--ink); }
.st-crouch svg { width: 100%; height: 100%; }
.st-crouch circle, .st-crouch path { fill: none; stroke: var(--ink); stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
```

- [ ] **Step 3: Wire it in `src/game/game.js`.**
  - Import `import { createStealthHud } from '../ui/stealthHud.js';` and `import { glyphCode } from '../stealth/brain.js';`.
  - In `buildRun`, after the HUD and the stealth runtime exist, add:

```js
    const stealthHud = createStealthHud(hudRoot.querySelector('.hud') ?? hudRoot);
    events.on('stealthLine', ({ target, text }) => stealthHud.say(target, text));
    events.on('stealthEnd', () => stealthHud.clear());
    // A goon's head on screen, written into one shared object (no allocation per goon per frame).
    const headAt = new THREE.Vector3(), headScr = { x: 0, y: 0, behind: false };
    const headOnScreen = (e) => {
      e.ch.headWorld(headAt, 0.75).project(camera);
      headScr.x = (headAt.x * 0.5 + 0.5) * innerWidth;
      headScr.y = (-headAt.y * 0.5 + 0.5) * innerHeight;
      headScr.behind = headAt.z > 1;
      return headScr;
    };
    let promptKind = null;
```

  - In `update`, right after `hud.pruneGlyphs(glyphIds);`, add:

```js
        // Predator HUD: awareness rings, lines, the armed counter, the takedown prompt, crouch.
        const room = stealth.active ? stealth.goons : null;
        if (room) {
          for (let i = 0; i < room.length; i++) {
            const g = room[i], code = g.e.alive ? glyphCode(g.mind) : 0;
            if (!code) { stealthHud.glyph(i, 0, 0, false, 0); continue; }
            const p = headOnScreen(g.e);
            stealthHud.glyph(i, p.x, p.y, !p.behind, code);
          }
        }
        stealthHud.hideFrom(room ? room.length : 0);
        stealthHud.updateLines(real, headOnScreen);
        stealthHud.armed(stealth.armed(), !!room && !!state.detectiveOn);
        stealthHud.crouch(!!hero.crouched);
        if (stealth.prompt !== promptKind) {
          promptKind = stealth.prompt;
          stealthHud.prompt(promptKind === 'silent' ? `${key('punch')} Silent takedown` : promptKind === 'perch' ? `${key('kick')} Perch drop` : null);
        }
```

  - Add `stealthHud` to the `api` object.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Check it on screen.** Build and preview, then:

```bash
cat > "$TEMP/s6-t14.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, e = G.stealth.goons[1].e; G.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 14, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 14 }, e.yaw + Math.PI); 'far in front'", "wait": 900},
 {"eval": "[document.querySelectorAll('.st-aware:not(.hidden)').length, [...document.querySelectorAll('.st-aware:not(.hidden)')].map((g) => g.dataset.c)]"},
 {"shot": "t14-noticing"},
 {"wait": 2500},
 {"eval": "[[...document.querySelectorAll('.st-aware:not(.hidden)')].map((g) => g.dataset.c), [...document.querySelectorAll('.st-line:not(.hidden)')].map((l) => l.textContent)]"},
 {"shot": "t14-spotted"},
 {"press": "KeyV", "wait": 500},
 {"eval": "[document.querySelector('.st-armed').classList.contains('hidden'), document.querySelector('.st-armed b').textContent]"},
 {"shot": "t14-armed"},
 {"press": "KeyV", "wait": 300},
 {"eval": "const G = window.__game; G.stealth.goons.forEach((g) => { g.e.state = 'look'; g.e.aware = false; }); G.stealth.squad.alarm = false; for (const g of G.stealth.goons) { g.mind.alert = 'patrol'; g.mind.meter = 0; } const e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); 'behind goon 0'", "wait": 300},
 {"press": "KeyZ", "wait": 300},
 {"eval": "[document.querySelector('.st-prompt').textContent, document.querySelector('.st-crouch').classList.contains('hidden')]"},
 {"shot": "t14-prompt"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5210/?at=monarchBalcony&god=1" "$TEMP/stealth" "$(cat "$TEMP/s6-t14.json")"
```

Expected: at 14 m the goon that sees Batman shows a white ring filling (`[1,["white"]]` or already `yellow`); after 2.5 s the rings are `red` and a balloon reads a spot line (`THERE HE IS!` or similar); in detective vision the armed counter shows (`[false,"3"]`); behind goon 0 crouched, the prompt reads `LMB Silent takedown` and the crouch badge shows (`["LMB Silent takedown",false]`). The screenshots show the ring over the head, the balloon with its tail, the counter under the combo area and the prompt card. If a ring or balloon covers the goon's face, raise `top` in `.st-aware` or the `- 70` offset in `updateLines`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/stealthHud.js src/ui/style.css src/game/game.js
git commit -m "Predator HUD: awareness rings, speech balloons, armed counter, takedown prompt, crouch badge"
```

---

### Task 15: Teaching, hints, help, sounds, music and progress moves

**Files:**
- Modify: `src/ui/prompts.js`, `src/game/story.js` (tutorial lists), `src/ui/menus.js`, `src/audio/sfx.js`, `src/game/sound.js`, `src/game/game.js`
- Test: `tests/unit/prompts.test.js`, `tests/unit/story.test.js`

**Interfaces:**
- Consumes: events from Tasks 7 to 14 (`crouchOn`, `silentStart`, `silentTakedown`, `perched`, `perchDropStart`, `perchDrop`, `batarangWall`, `ventHide`, `stealthAlarm`, `stealthLost`, `rifleAim`, `rifleShot`, `takedown { kind }`, hint `perch-none`); 3C's `MOVE_IDS` map and `moveLearned`; `stealth.active`, `stealth.alarm`.
- Produces: prompts `crouch`, `silent`, `perch`, `perchDrop`, `distract`, `vent`, `ledgeStealth`, `spotted`, `rifle`; the tutorial lists on both stealth steps; hints `perch-none` and `rifle`; a Predator section in the help page and the pad layout lines; SFX `rifleShot`, `laser`, `choke`, `alarm`, `tink`; calm music in a predator room until the alarm; `moveLearned` for `silentTakedown` and `perchDrop`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: predator stealth', () => {
  const IDS = {
    crouch: ['crouch'], silent: ['punch'], perch: ['grapple'], perchDrop: ['kick'], distract: ['batarang'],
    vent: ['crouch'], ledgeStealth: ['punch'], spotted: ['grapple'], rifle: ['dodge'],
  };
  for (const [id, actions] of Object.entries(IDS)) {
    it(`${id} shows its keys and has no dashes`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[\u2013\u2014]/);
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
});
```

Append to the `story data` describe in `tests/unit/story.test.js` (import `PROMPT_IDS` from `../../src/ui/prompts.js`):

```js
  it('every tutorial prompt in the story exists', () => {
    for (const s of STEPS) for (const id of s.tutorial ?? []) expect(PROMPT_IDS, `${s.id} ${id}`).toContain(id);
    expect(STEPS.find((s) => s.id === 'monarchBalcony').tutorial).toEqual(['crouch', 'silent', 'perch', 'perchDrop']);
    expect(STEPS.find((s) => s.id === 'aceCatwalks').tutorial).toEqual(['distract', 'vent', 'ledgeStealth']);
  });
```

Run: `npx vitest run tests/unit/prompts.test.js tests/unit/story.test.js`. Expected: FAIL.

- [ ] **Step 2: Prompts.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['crouch', (k) => `Press ${k('crouch')} to crouch. You move slower, your footsteps go quiet, and goons have to be much closer to spot you. Stay out of the lamplight.`],
  ['silent', (k) => `Sneak up behind a goon who hasn't seen you and press ${k('punch')} for a silent takedown. It takes two seconds, and anyone within three meters hears it.`],
  ['perch', (k) => `Grapple ${k('grapple')} to a gargoyle to watch from above. Goons never look up unless they are hunting you.`],
  ['perchDrop', (k) => `On a gargoyle, press ${k('kick')} over a goon to drop on him and knock him out.`],
  ['distract', (k) => `Throw a batarang ${k('batarang')} at a wall to make a noise. Goons within twelve meters walk over to look.`],
  ['vent', (k) => `Crouch ${k('crouch')} in the steam over the floor vent and nobody can see you. Let a goon walk past, then take him from behind.`],
  ['ledgeStealth', (k) => `Hang under a catwalk edge and press ${k('punch')} when a goon walks over you to pull him down.`],
  ['spotted', (k) => `Spotted! Rifles hurt. Grapple ${k('grapple')} to a gargoyle to break their line of sight. They give up the hunt after eight seconds.`],
  ['rifle', (k) => `Rifle goons parry punches and aim with a red laser. ${k('dodge')} dodge when it locks on, and kick or stun them first.`],
```

- [ ] **Step 3: The story teaches it.** In `src/game/story.js`, add `tutorial: ['crouch', 'silent', 'perch', 'perchDrop'],` to the `monarchBalcony` step and `tutorial: ['distract', 'vent', 'ledgeStealth'],` to the `aceCatwalks` step (before `checkpoint`).

Run: `npx vitest run tests/unit/prompts.test.js tests/unit/story.test.js`. Expected: PASS, including "has no duplicate prompt ids".

- [ ] **Step 4: Hints, first-time prompts, done-marks and moves** in `src/game/game.js`:
  - Add to `HINTS`:

```js
      'perch-none': () => `Get right above a goon first. ${key('kick')} drops on him from the gargoyle.`,
      rifle: () => `Rifle goons parry punches. ${key('kick')} kick them, ${key('cape')} cape-stun them, or take them from behind.`,
```

  - Change the `blocked` handler's hint choice to `(target?.type === 'joker' ? HINTS.joker : target?.type === 'rifle' ? HINTS.rifle : HINTS[outcome])()` (keep 5FG's gadget-aware Joker hint if it replaced `HINTS.joker`).
  - Add to `PROMPT_DONE`: `crouchOn: 'crouch', silentTakedown: 'silent', perched: 'perch', perchDrop: 'perchDrop', batarangWall: 'distract', ventHide: 'vent', stealthLost: 'spotted',`.
  - After the `PROMPT_DONE` loop, add:

```js
    events.on('stealthAlarm', () => prompts.show(['spotted']));
    events.on('rifleAim', () => prompts.show(['rifle']));
    events.on('takedown', ({ kind }) => { if (kind === 'ledge') prompts.done('ledgeStealth'); });
```

  - Add `silentTakedown: 'silentTakedown', perchDrop: 'perchDrop'` to 3C's `MOVE_IDS` map (the events carry the same names as the move ids).
  - Pass the runtime to the audio wiring: add `stealth` to the `wireAudio({ ... })` call.

- [ ] **Step 5: Help page** in `src/ui/menus.js`:
  - Add `const PREDATOR = ['crouch', 'silent', 'perch', 'perchDrop', 'distract', 'vent', 'ledgeStealth', 'spotted', 'rifle'];` next to `MOVING_AROUND`.
  - In `PAD_LAYOUT`, change `['Sprint', 'L3']` to `['Sprint', 'Hold L3']` and add `['Crouch', 'Tap L3']` after it.
  - In `help()`, after 4E's chain takedown section, add:

```js
    node.appendChild(el('h3', '', 'Predator'));
    for (const id of PREDATOR) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
    node.appendChild(el('p', 'tip', 'The ring over a goon fills white while he notices you, turns yellow while he searches and red once he has found you. Detective vision shows every goon in his state colour through walls, his vision cone on the floor, and how many rifles are left.'));
```

- [ ] **Step 6: Sounds** in `src/audio/sfx.js`. Add to `SFX`:

```js
  // A rifle crack: a sharp transient, a low body and a short echo off the walls.
  rifleShot: { wet: 0.35, max: 3, fn(ctx, out, t, p) {
    noise(ctx, out, t, { type: 'highpass', freq: 1800 * p, d: 0.05, gain: 0.9 });
    thump(ctx, out, t, p, { from: 220, to: 60, d: 0.18, gain: 0.8 });
    noise(ctx, out, t + 0.01, { type: 'bandpass', freq: 900 * p, Q: 0.8, d: 0.35, gain: 0.25 });
    return t + 0.4;
  } },

  // A laser sight locking on: a thin rising beep.
  laser: { wet: 0.05, max: 2, fn(ctx, out, t, p) {
    tone(ctx, out, t, { type: 'sine', freq: 1800 * p, to: 2600 * p, d: 0.12, gain: 0.18 });
    return t + 0.14;
  } },

  // A choke hold: cloth squeezing and a muffled struggle that fades.
  choke: { wet: 0.1, max: 1, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 0.5, rate: 18, freq: 700, gain: 0.35 });
    thump(ctx, out, t + 0.4, p, { from: 120, to: 70, d: 0.3, gain: 0.35 });
    flutter(ctx, out, t + 0.9, p, { dur: 0.6, rate: 12, freq: 500, gain: 0.25 });
    return t + 1.6;
  } },

  // The alarm when a goon spots Batman: two quick rising stabs.
  alarm: { wet: 0.2, max: 1, fn(ctx, out, t, p) {
    tone(ctx, out, t, { type: 'sawtooth', freq: 440 * p, to: 660 * p, d: 0.14, gain: 0.3 });
    tone(ctx, out, t + 0.16, { type: 'sawtooth', freq: 523 * p, to: 784 * p, d: 0.2, gain: 0.3 });
    return t + 0.4;
  } },

  // A batarang ringing off a wall.
  tink: { wet: 0.25, max: 2, fn(ctx, out, t, p) {
    metal(ctx, out, t, { base: 2600 * p, ratios: [1, 1.5, 2.2], d: 0.4, gain: 0.25 });
    noise(ctx, out, t, { type: 'highpass', freq: 6000, d: 0.01, gain: 0.5 });
    return t + 0.42;
  } },
```

- [ ] **Step 7: Wire the sounds and keep the music calm while hidden** in `src/game/sound.js`:
  - Change the signature to `export function wireAudio({ audio, events, hero, combat, flow, voice = null, settings, stealth = null })`.
  - Add with the other `on(...)` lines:

```js
  on('rifleShot', () => audio.play('rifleShot', { pitch: vary(0.1) }));
  on('rifleAim', () => audio.play('laser'));
  on('silentStart', () => audio.play('choke'));
  on('stealthAlarm', () => audio.play('alarm'));
  on('batarangWall', () => audio.play('tink'));
  on('perchDropStart', () => audio.play('whoosh', { gain: 0.7, pitch: 0.75 }));
```

  - In `update`, change the fight part of the music choice to `: (fighting || combat.active) && !(stealth?.active && !stealth.alarm) ? 'combat' : 'explore';` so a predator room plays the calm score until the goons raise the alarm.

- [ ] **Step 8: Listen.** Open `src/audio/lab.js`'s page (it lists `SFX_NAMES`). Play `rifleShot`, `laser`, `choke`, `alarm` and `tink`: a crack, a beep, a muffled struggle, a two-note alarm and a metal clink, none of them clipping.

- [ ] **Step 9: Run the tests and check the help page**

Run: `npx vitest run`
Expected: PASS.

Build and preview, open `http://localhost:5210/?at=monarchBalcony&god=1`, skip the comic, press `H`: the help page has a Predator section with nine tips and the ring sentence, and the pad column shows `Sprint: Hold L3` and `Crouch: Tap L3`. The first prompt on arrival is the crouch one.

- [ ] **Step 10: Commit**

```bash
git add src/ui/prompts.js src/game/story.js src/ui/menus.js src/audio/sfx.js src/game/sound.js src/game/game.js tests/unit/prompts.test.js tests/unit/story.test.js
git commit -m "Predator teaching, hints, help, sounds and calm music until the alarm"
```

---

### Task 16: Scripted play for both rooms, browser tests and the playthrough

**Files:**
- Create: `tests/e2e/stealth.spec.js`, `scripts/runs/stealth-balcony.json`, `scripts/runs/stealth-catwalks.json`

**Interfaces:**
- Consumes: everything above, plus `window.__game.state.paused` (setting it freezes play while the page keeps rendering).

Each run takes down every goon a different way and checks what the spec promises. Positions are set from the goons' live positions, so the runs don't depend on patrol timing.

- [ ] **Step 1: Monarch Balcony: silent takedown, perch drop, ledge takedown, distraction.** Create `scripts/runs/stealth-balcony.json`:

```json
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['silentTakedown', 'perchDrop', 'takedown', 'stealthAlarm', 'stealthNoise', 'stealthFear', 'fightDone']) G.events.on(n, (d) => G.__log.push([n, d?.kind ?? d?.fear ?? d?.id ?? ''])); 'hooked'"},
 {"shot": "balcony-1-arrive"},
 {"eval": "const G = window.__game, e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); 'behind rifle 0'", "wait": 250},
 {"press": "KeyZ", "wait": 150},
 {"click": 0, "wait": 1000},
 {"shot": "balcony-2-choke"},
 {"wait": 1600},
 {"eval": "const G = window.__game; [G.stealth.goons[0].e.alive, G.stealth.squad.fear]"},
 {"eval": "const G = window.__game, e = G.stealth.goons[1].e, p = G.world.grapplePoints.find((q) => q.perch && q.gargoyle && Math.abs(q.x - 200.32) < 0.1 && Math.abs(q.z + 56) < 0.1); e.pos.set(203, 13, -56.5); G.hero.teleport({ x: p.x, y: p.y, z: p.z }, Math.PI / 2); 'perched over rifle 1'", "wait": 300},
 {"eval": "[window.__game.hero.perched, window.__game.stealth.prompt]"},
 {"shot": "balcony-3-perched"},
 {"press": "KeyE", "wait": 450},
 {"shot": "balcony-4-perch-drop"},
 {"wait": 900},
 {"eval": "const G = window.__game; [G.stealth.goons[1].e.alive, +G.hero.pos.y.toFixed(1), G.stealth.squad.fear]"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 206.45, y: 11.4, z: -70 }, -Math.PI / 2); G.hero.state = 'air'; G.hero.grounded = false; G.hero.vel.set(0, -1, 0); 'dropping to the balcony edge'", "wait": 400},
 {"eval": "window.__game.hero.control?.name"},
 {"eval": "const G = window.__game, e = G.stealth.goons[2].e; e.pos.set(205.3, 13, -70); 'rifle 2 over the edge'", "wait": 150},
 {"click": 0, "wait": 1200},
 {"shot": "balcony-5-ledge"},
 {"eval": "const G = window.__game; [G.stealth.goons[2].e.alive, G.stealth.squad.fear]"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 201.2, y: 13, z: -60 }, 0); G.events.emit('batarangWall', { pos: { x: 203, y: 13, z: -53 } }); 'clang near the thug'", "wait": 300},
 {"eval": "const G = window.__game, m = G.stealth.goons[3].mind; [m.alert, +m.target.x.toFixed(0), +m.target.z.toFixed(0)]"},
 {"wait": 1500},
 {"eval": "const G = window.__game, e = G.stealth.goons[3].e; G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); 'behind the thug'", "wait": 200},
 {"click": 0, "wait": 2800},
 {"eval": "const G = window.__game; [G.stealth.goons.map((g) => g.e.alive), G.flow.objectives.step.id]", "wait": 1500},
 {"eval": "const G = window.__game; [G.flow.objectives.step.id, JSON.stringify(G.__log)]"}
]
```

Build and preview, then run:

```bash
node scripts/dev-play.mjs "http://localhost:5210/?at=monarchBalcony&god=1" "$TEMP/stealth" "$(cat scripts/runs/stealth-balcony.json)"
```

Expected:
- Rifle 0 goes down to the silent takedown: `[false,1]`.
- On the perch: `[true,"perch"]`; after the drop `[false,13,2]` (Batman landed on the balcony).
- Dropping at the edge catches it: `"ledge"`; after the click rifle 2 is out: `[false,3]`.
- The clang sends the thug to look: `["search",203,-53]`.
- After the last silent takedown every goon is out and the step becomes `party`; the log holds `silentTakedown` twice, `perchDrop`, a `takedown` of kind `ledge`, `stealthFear` 1 to 3, no `stealthAlarm`, and ends with `fightDone`.
- `balcony-2-choke.png` shows the choke from the low takedown camera; `balcony-4-perch-drop.png` Batman dropping onto the goon with `KRUNCH!`; `balcony-5-ledge.png` the goon pulled over the rail.
- `no console errors`.

If a step prints a different takedown than expected (say rifle 1 walked out of reach before the drop), move the pinned position closer (`e.pos.set`) and rerun; never loosen the rules in `vision.js`.

- [ ] **Step 2: Ace Catwalks: the vent, a stealth chain, the alarm, smoke and the escape.** Create `scripts/runs/stealth-catwalks.json`:

```json
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.stealth?.active && window.__game.gadgets ? r('room') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['stealthAlarm', 'stealthLost', 'chainStart', 'chainDone', 'smoke', 'ventHide', 'fightDone']) G.events.on(n, (d) => G.__log.push([n, d?.stealth ?? d?.chain ?? ''])); G.hero.teleport({ x: 120, y: 0.15, z: -118 }, 0); 'in the vent'", "wait": 200},
 {"press": "KeyZ", "wait": 300},
 {"eval": "const G = window.__game, g = G.stealth.goons[2]; g.e.pos.set(116, 0.15, -118); g.mind.alert = 'suspicious'; g.mind.meter = 0.4; g.mind.target.x = 120; g.mind.target.z = -118; 'rifle 2 stares straight at the vent from 4 m'", "wait": 1200},
 {"eval": "const m = window.__game.stealth.goons[2].mind; [+m.meter.toFixed(2), m.alert]"},
 {"shot": "catwalks-1-vent"},
 {"press": "KeyZ", "wait": 600},
 {"eval": "const m = window.__game.stealth.goons[2].mind; [+m.meter.toFixed(2), m.alert]"},
 {"eval": "const G = window.__game; for (const g of G.stealth.goons) { g.mind.alert = 'patrol'; g.mind.meter = 0; g.e.calm(); } const [a, b] = [G.stealth.goons[2].e, G.stealth.goons[3].e]; a.pos.set(150, 0.15, -110); b.pos.set(152, 0.15, -112); G.hero.teleport({ x: 147, y: 0.15, z: -113 }, Math.PI / 2); 'two goons close, unaware'", "wait": 300},
 {"eval": "window.__game.combat.chains"},
 {"press": "Digit2", "wait": 3500},
 {"shot": "catwalks-2-chain"},
 {"eval": "const G = window.__game; G.stealth.goons.map((g) => [g.e.alive, g.mind.alert])"},
 {"eval": "const G = window.__game; G.gadgets.equip('smoke'); const e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 5, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 5 }, e.yaw + Math.PI); 'on the catwalk in front of rifle 0'", "wait": 2500},
 {"eval": "const G = window.__game; [G.stealth.alarm, G.stealth.goons.map((g) => g.mind.alert)]"},
 {"press": "KeyR", "wait": 400},
 {"eval": "const G = window.__game; [G.stealth.alarm, G.stealth.goons.map((g) => [g.mind.alert, g.e.aware])]"},
 {"shot": "catwalks-3-smoke"},
 {"eval": "const G = window.__game, e = G.stealth.goons[0].e; G.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 5, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 5 }, e.yaw + Math.PI); 'spotted again'", "wait": 2500},
 {"eval": "const G = window.__game, p = G.world.grapplePoints.find((q) => q.perch && q.gargoyle && Math.abs(q.x - 139) < 0.1 && Math.abs(q.z + 138) < 0.1); G.hero.teleport({ x: p.x, y: p.y, z: p.z }, 0); 'escape to the south-east gargoyle'", "wait": 9500},
 {"eval": "const G = window.__game; [G.stealth.alarm, G.stealth.goons.map((g) => [g.mind.alert, g.e.aware])]"},
 {"eval": "window.__game.winFight(); 'finish'", "wait": 2500},
 {"eval": "const G = window.__game; [G.flow.objectives.step.id, JSON.stringify(G.__log)]"}
]
```

Run:

```bash
node scripts/dev-play.mjs "http://localhost:5210/?at=aceCatwalks&god=1&gadgets=all" "$TEMP/stealth" "$(cat scripts/runs/stealth-catwalks.json)"
```

Expected:
- Crouched in the vent with rifle 2 staring at it from 4 m, its meter only falls: about `[0.1,"suspicious"]`, and `ventHide` is in the log. Standing up, it sees Batman at once: the meter rises above the first reading, `"suspicious"` or `"search"`.
- With two unaware goons within 6 m, `combat.chains` shows `stealth: true` and all three affordable; the Headbanger knocks both out (`chainStart` then `chainDone` with `stealth` true) and the other goons are at most `search` (never an alarm from the chain).
- In front of rifle 0 on the catwalk the alarm goes up (`true`); the smoke pellet resets it: `[false, [["search",false],...]]` for every goon still up.
- Spotted again, then on the gargoyle for 9.5 s: `[false, [...]]` with every goon `search` and not aware, and `stealthLost` in the log.
- After `winFight` the step is `cake`; `no console errors`.
- `catwalks-1-vent.png` shows Batman crouched in the steam; `catwalks-2-chain.png` the Headbanger; `catwalks-3-smoke.png` the cloud with the goons' rings yellow.

- [ ] **Step 3: Browser tests.** Create `tests/e2e/stealth.spec.js`:

```js
import { test, expect } from '@playwright/test';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;
async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
async function enterRoom(page, step) {
  await page.goto(`/?at=${step}&god=1`);
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__game.stealth?.active, null, { timeout: 30000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await page.waitForTimeout(1000);
}

test('a predator room patrols, and a silent takedown from behind lands', async ({ page }) => {
  const errors = await collectErrors(page);
  await enterRoom(page, 'monarchBalcony');
  const before = await page.evaluate(() => window.__game.stealth.goons.map((g) => [g.e.pos.x, g.e.pos.z]));
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => window.__game.stealth.goons.map((g) => [g.e.pos.x, g.e.pos.z]));
  expect(after.some((p, i) => Math.hypot(p[0] - before[i][0], p[1] - before[i][1]) > 1)).toBe(true);
  await page.evaluate(() => {
    const G = window.__game, e = G.stealth.goons[0].e;
    G.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw);
  });
  await page.waitForTimeout(250);
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => !window.__game.stealth.goons[0].e.alive, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__game.stealth.alarm)).toBe(false);
  expect(errors).toEqual([]);
});

test('clearing a predator room moves the story on', async ({ page }) => {
  const errors = await collectErrors(page);
  await enterRoom(page, 'aceCatwalks');
  await page.evaluate(() => window.__game.winFight());
  await page.waitForFunction(() => window.__game.flow.objectives.step?.id === 'cake', null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__game.stealth.active)).toBe(false);
  expect(errors).toEqual([]);
});

test('a save from before the stealth steps resumes on the same step', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => localStorage.setItem('gotham-mansi-progress-v1', JSON.stringify({ step: 25, balloons: [], suit: 'm' })));
  await page.reload();
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.begin('m', false));
  await page.waitForFunction(() => window.__game.flow?.objectives?.step, null, { timeout: 10000 });
  expect(await page.evaluate(() => window.__game.flow.objectives.step.id)).toBe('cake');
  expect(errors).toEqual([]);
});
```

Run against the frozen build: `BASE_URL=http://localhost:5210 npx playwright test tests/e2e/stealth.spec.js`. Expected: 3 passed.

- [ ] **Step 4: The playthrough goes through both rooms.** Run `BASE=http://localhost:5210/ OUT="$TEMP/pt6d" node scripts/playthrough.mjs`. It already teleports to each fight's site and wins it, so no change is needed. Expected: it ends at `credits` with `no console errors`. If it stalls on `monarchBalcony` or `aceCatwalks`, check that `flow.target` is the room site (the waypoint must point at the room), not the entry.

- [ ] **Step 5: Look at every screenshot** in `$TEMP/stealth`. Every takedown frame must show the blow landing (arm round the neck, boot on the goon, the goon going over the edge). No goon may stand inside a crate or a column, walk off a catwalk, or float. The awareness rings and balloons must sit above the heads.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/stealth.spec.js scripts/runs/stealth-balcony.json scripts/runs/stealth-catwalks.json
git commit -m "Scripted runs through both predator rooms and browser tests"
```

---

### Task 17: Performance: a stealth page in the fps sweep, and load time

**Files:**
- Modify: `scripts/fps-sweep.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: fps sweep rows `stealth`, `stealth-detective`, `stealth-takedown` and `stealth-alarm` (`ONLY=stealth` runs only them), and a rifle goon in the `spawn` row.

- [ ] **Step 1: The rifle goon in the spawn row.** In `scripts/fps-sweep.mjs`'s main page, change the spawned list `['grunt', 'knife', 'brute', 'grunt']` to `['grunt', 'knife', 'brute', 'rifle']` (the first rifle goon mid-play: its rifle, clips and outline).

- [ ] **Step 2: The stealth page.** Update the header comment's scenario list and the `ONLY` line to include `stealth`, and add before `await b.close();`:

```js
if (!only || only === 'stealth') {
  const { p, errors } = await openGame('at=aceCatwalks&god=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  // Patrols, line-of-sight rays, awareness rings and the steam vent, from the catwalk overlook.
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 150, y: 0.15, z: -96 }, Math.PI * 1.25); g.follow.snapBehind(Math.PI * 1.25); });
  await label(p, 'stealth');
  await p.waitForTimeout(4000);
  // Detective vision: cones, x-ray state colours, the armed counter.
  await label(p, 'stealth-detective');
  await p.keyboard.press('KeyV');
  await p.waitForTimeout(3000);
  await p.keyboard.press('KeyV');
  // A silent takedown: both choke clips, the takedown camera, a balloon.
  await p.evaluate(() => { const g = window.__game, e = g.stealth.goons[2].e; g.hero.teleport({ x: e.pos.x - Math.sin(e.yaw) * 1.1, y: e.pos.y, z: e.pos.z - Math.cos(e.yaw) * 1.1 }, e.yaw); });
  await p.waitForTimeout(200);
  await label(p, 'stealth-takedown');
  await p.mouse.click(640, 360);
  await p.waitForTimeout(3000);
  // Spotted: the alarm, rifles aiming and firing, lasers, tracers and flashes.
  await p.evaluate(() => { const g = window.__game, e = g.stealth.goons[3].e; g.hero.teleport({ x: e.pos.x + Math.sin(e.yaw) * 7, y: e.pos.y, z: e.pos.z + Math.cos(e.yaw) * 7 }, e.yaw + Math.PI); });
  await label(p, 'stealth-alarm');
  await p.waitForTimeout(6000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/stealth.png` }); }
  all.push(...await collect(p, 'stealth'));
  meta.errorsStealth = errors;
  await p.close();
}
```

- [ ] **Step 3: Run the sweep on the owner's laptop.** Build to `$TEMP/gdist`, preview on 5202 (`npx vite preview --outDir "$TEMP/gdist" --port 5202 --strictPort`), then:

```bash
OUT="$TEMP/sweep-stealth.json" ONLY=stealth node scripts/fps-sweep.mjs http://localhost:5202/ high
OUT="$TEMP/sweep-main.json" ONLY=main node scripts/fps-sweep.mjs http://localhost:5202/ high
```

Expected: every `stealth*` row's p95 is at or under 6.9 ms, the `spawn` row stays at or under 6.9 ms with the rifle goon, and `hitches >25ms after warmup: 0`. If a hitch lands in a stealth row, find what compiled or uploaded on first use (a rifle part, a cone or laser material, a clip action) and move it into `warmCast.js`, `createStealthWarm()` or an `animator.prime` list, then rerun. If a row is slow rather than hitchy, profile it (`scripts/perf-profile.mjs`); the usual suspects are the line-of-sight rays (they must stay at 10 Hz per goon) and HUD writes (they must only happen on a code change).

- [ ] **Step 4: Load time.** Run `node scripts/load-time.mjs http://localhost:5202/ 40 1` on this build and on a build of `main`. Expected: `firstFrame` stays under 3.2 s, and the `clips` mark grows by no more than 60 ms. If it grows more, move the `buildStealthClips` line from boot into `begin()` (guarded so it runs once), before `buildRun`, and measure again.

- [ ] **Step 5: Commit**

```bash
git add scripts/fps-sweep.mjs
git commit -m "Stealth rows in the fps sweep and a rifle goon in the spawn row"
```

---

### Task 18: Full verification (the coordinator runs this)

- [ ] **Step 1:** Run `npx vitest run`. Every test passes, including the thirteen new test files.
- [ ] **Step 2:** Build to `$TEMP/gdist`, preview on 5202, and run `BASE_URL=http://localhost:5202 npx playwright test`. All browser tests pass, the old smoke tests and `stealth.spec.js` included.
- [ ] **Step 3:** Run `node scripts/stealth-check.mjs http://localhost:5202/`. It prints `all rooms sound`.
- [ ] **Step 4:** Run the full fps sweep: `OUT="$TEMP/sweep.json" node scripts/fps-sweep.mjs http://localhost:5202/ high`. Every row's p95 is at or under 6.9 ms, `hitches >25ms after warmup: 0`, and no row is worse than before this plan.
- [ ] **Step 5:** Run the playthrough: `BASE=http://localhost:5202/ OUT="$TEMP/pt6d" node scripts/playthrough.mjs`. It ends at `credits` with no console errors, passing `monarchBalcony` and `aceCatwalks`.
- [ ] **Step 6:** Load time: `node scripts/load-time.mjs http://localhost:5202/ 40 1`. `firstFrame` stays under 3.2 s.
- [ ] **Step 7:** WebKit: `node scripts/webkit-check.mjs http://localhost:5202/ "$TEMP/wk"`. No console errors.
- [ ] **Step 8:** No dashes in player-visible text:

```bash
node -e "const fs=require('fs');const files=['src/stealth/brain.js','src/stealth/stealthRooms.js','src/stealth/takedowns.js','src/ui/prompts.js','src/ui/menus.js','src/ui/stealthHud.js','src/game/story.js','src/game/game.js','src/core/bindings.js','src/progress/upgrades.js','src/gadgets/g/batarang.js'];let bad=0;for(const f of files){fs.readFileSync(f,'utf8').split('\n').forEach((l,i)=>{if(/[\u2013\u2014]/.test(l)){bad++;console.log(f+':'+(i+1)+': '+l.trim())}})}console.log(bad?bad+' lines with dashes':'no dashes')"
```

Expected: `no dashes`. A hit in player-visible text must be fixed; a hit inside a code comment that predates this plan may stay.

- [ ] **Step 9: Copy the best frames and commit.** Copy `balcony-2-choke`, `balcony-4-perch-drop`, `balcony-5-ledge`, `catwalks-1-vent`, `catwalks-2-chain`, `t13-cones` and `t14-spotted` from `$TEMP/stealth` to `docs/screens/stealth-*.png`, then:

```bash
git add docs/screens/stealth-*.png
git commit -m "Predator stealth screenshots"
```

- [ ] **Step 10:** The coordinator reviews the screenshots, the sweep and a hand-played run of both rooms (sneak, get spotted, escape, finish), then merges and pushes `main`. No task pushes.

---

## Post-game hook (for Part H, Missing Guests)

The stealth rescue in Part H needs no new runtime. A post-game module starts a room like any inline fight (3C's `encounters.begin(id, def)`), with the harder encore squad:

```js
import { stealthFight } from '../stealth/stealthRooms.js';
// A Missing Guests rescue: the vat hall with five goons (four rifles and a knife).
encounters.begin('guest:3', stealthFight('aceCatwalks', { squad: 'encore' }));
```

The encounter hands the squad to the stealth runtime, the story ignores the fight id (3C: `objectives.handle` only matches its own fight ids), and `fightDone { id: 'guest:3' }` fires when every goon is down. A new room for Part H is one more entry in `ROOMS` (with its `SITES`), built by `buildStealthSets` and checked by `scripts/stealth-check.mjs`, with no runtime change.

