# Plan 7H-2: After the Party, part 2 (Cake Bombs, Balloon Army, Joker's Encore, Endless Party Crashers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Part H on top of Plan 7H-1's post-game world: 5 Joker cake bombs on timers (reach each by a glide and a zipline, then beat its guard or time counters on a dial), a Balloon Army of 16 hostile Joker balloons with spray cans over Neon Row (popped with the batarang and the remote batarang), Joker's Encore (a harder boss rematch with new patterns, unlocked by the five bombs, giving a gold medal and a new comic page), and Endless Party Crashers (a survival arena on the Monarch roof with a best-wave record and medals at waves 5, 10 and 20). Each joins the objective list, the map, the markers and the Progress tracker.

**Architecture:**
- **Pure rules first, thin runtime.** Bomb routes, fuses and the defuse dial (`bombSpots.js`), the balloon paths (`balloonArmy.js`), sky targets for gadgets (`src/gadgets/skyTargets.js`), the boss fight's numbers as a pattern object (`src/game/bossPatterns.js`), survival waves and their hardness (`crasherWaves.js`), and the encore's rules (`encoreRules.js`) are pure and unit-tested.
- **Reuse, not parallel systems.** The encore is the existing boss (`boss.js`) running a second pattern: every hard-coded number in `boss.js` becomes a field of `STORY_BOSS` (unchanged values) or `ENCORE_BOSS`. The survival arena is a new challenge kind (`survival`) on 3C's challenge runner (pillar, 3-2-1, results, medals, the Challenges page), fighting through `encounters.begin` one wave at a time and scaling goons with 7H-1's `combat.setHardness`. Guard fights are ordinary encounters. Balloons are gadget targets through a small registry the batarang and the remote batarang consult. Everything plugs into 7H-1's `post.add(system)`, `registerActivity`, `tracker.register`, `registerProgressField`, 5FG's `missionDone` XP and the challenge runner's medal XP.
- **Everything visual is built once and pre-warmed.** Cards, cake bombs and the instanced balloon army are created in `buildRun`; a copy of each goes into 7H-1's `createPostWarm()`.

**Tech Stack:** Three.js 0.186, plain ES modules, Vite 8, Vitest (node environment), Playwright (`tests/e2e`), playwright-core scripted play (`scripts/dev-play.mjs`, `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`, `scripts/webkit-check.mjs`, `scripts/load-time.mjs`).

**Base:** Branch `postgame2`, cut from `main` **after** Plan 7H-1 (`docs/superpowers/plans/2026-09-28-plan-7h1-post-game.md`) has been merged, so 4E, 3C, 5FG, 6D and 7H-1 are all in. Names like "7H-1's `post.add`" refer to exactly what that plan built.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`, Part H, items 3 (Cake Bombs), 4 (Balloon Army), 5 (Joker's Encore) and 6 (Endless Party Crashers), each tracked in the Progress tracker. Keep it a birthday gift: warm, funny, Joker-party tone, `MANSI.name` where it fits.
- **No em dashes** (U+2014) or en dashes (U+2013) in any player-visible text: cards, toasts, hints, radio lines, Joker lines, prompts, menu labels, comic pages. Use commas, colons or full stops. Task 18 greps for them.
- **Commits** are authored by Krishn Gohel only (check `git config user.name` prints `Krishn Gohel`). Never add `Co-Authored-By` or any other trailer.
- **Never push.** Pushing `main` redeploys the live site. The coordinator reviews and pushes after Task 18.
- **Art is authored in code.** Card faces, the cake bomb's clock band, the balloons' grins and the defuse dial are canvases or SVG written in this plan. No image files, no downloads, no AI image or model generators. All player-facing copy is written out here; implementers transcribe it and don't invent new lines.
- **Performance.** Keep 144 fps or better on the owner's laptop: fps sweep (`scripts/fps-sweep.mjs`, High, `dynres=0`) p95 at or under 6.9 ms in every row, no frame over 25 ms after the first 5 s. Every new material and geometry has a warm copy (7H-1's `createPostWarm()` in `src/postgame/postProps.js`), every run object is created in `buildRun` before `begin()` calls `drawEverything`. No per-frame allocation in hot paths: the balloon army writes 32 instance matrices from scratch objects, sky targets reuse one result object, bomb and survival HUDs touch the DOM only when a shown value changes (the dial's needle is the one element that moves every frame, through one attribute).
- **Load time.** First frame near 3 s. No asset files are added.
- **Pure modules** import nothing from three.js, the DOM or `src/ui/`; they may import other pure modules (`save.js`, `mapData.js`, `challenges.js`, `progressTracker.js`, `mansi.config.js`, 7H-1's pure post-game modules).
- **Keys.** No new bindings. The defuse dial uses the counter action (`block`, right mouse by default), which already means "counter".
- **Browser checks run against a frozen production build only:**
  ```bash
  npx vite build --outDir "$TEMP/g7bdist"
  npx vite preview --outDir "$TEMP/g7bdist" --port 5213 --strictPort
  ```
  Rebuild after each code change you want to check. URL flags as in 7H-1, including `?post=1` and `?gadgets=all`.
- **WebKit.** `scripts/webkit-check.mjs` runs against the frozen build (Task 18).
- `window.__game` already exposes everything 7H-1 listed plus `post` (with `crates`, `guests`, `ng`, `data`) and `ng`. This plan adds `post.bombs`, `post.army`, `post.encore`, `post.crashers`, `skyTargets`, and `side.challenges.extras`.

## File Structure

| File | Responsibility |
|---|---|
| `src/postgame/bombSpots.js` (new) | Pure: five bombs, routes, fuses, route waypoints, the defuse dial, copy |
| `src/postgame/balloonArmy.js` (new) | Pure: sixteen balloon paths, spray timing, copy |
| `src/gadgets/skyTargets.js` (new) | Pure: a registry of non-goon targets for gadgets |
| `src/game/bossPatterns.js` (new) | Pure: `STORY_BOSS`, `ENCORE_BOSS`, encore lines, floor tile patterns |
| `src/postgame/crasherWaves.js` (new) | Pure: the survival challenge, its waves, hardness, cake breaks |
| `src/game/challenges.js` (modify) | The `survival` kind: more is better, "7 waves" |
| `src/postgame/encoreRules.js` (new) | Pure: the encore card, unlock rule, copy |
| `src/postgame/showdownRegistry.js` (new) | Pure: fields `bombs`, `army`, `encore`; four tracker categories and four activities |
| `src/game/boss.js` (modify) | Runs a pattern: `begin(pattern)`, `stop()`, `bossDefeated { encore }` |
| `src/game/flow.js`, `src/game/flowHooks.js`, `src/postgame/afterParty.js` (modify) | Encore-aware boss ending; `keepHealth` hook; pages shown when unlocked |
| `src/game/challengeRunner.js`, `src/game/sideContent.js` (modify) | Extra pillars (`addChallenge`), the `stop` hook, `finish(value, { respawn })`; survival on the Challenges page |
| `src/gadgets/gadgetSystem.js`, `src/gadgets/g/batarang.js`, `src/gadgets/g/remote.js` (modify) | Sky targets |
| `src/postgame/postProps.js` (modify) | Joker cards, the cake bomb, the instanced balloon army, their warm copies |
| `src/ui/defuseHud.js` (new) | The fuse timer and the counter dial |
| `src/postgame/cakeBombs.js` (new) | Bombs at run time |
| `src/postgame/armyRun.js` (new) | The balloon army at run time |
| `src/postgame/postPages.js` (modify) | The encore's intro and reward comic pages |
| `src/postgame/encore.js` (new) | Joker's Encore at run time |
| `src/postgame/crashers.js` (new) | Endless Party Crashers at run time |
| `src/ui/menus.js`, `src/ui/prompts.js`, `src/game/sound.js`, `src/game/game.js`, `src/ui/style.css` (modify) | Pause option, prompts, sounds, music, wiring, styles |
| `scripts/postgame-check.mjs` (modify) | Bomb routes (floors, glide ratios, ziplines, clear glide lines), cards, the encore card, the survival pillar |
| `scripts/runs/post-bombs.json`, `post-army.json`, `post-encore.json`, `post-crashers.json` (new) | Replayable scripted runs |
| `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`, `scripts/webkit-check.mjs` (modify) | Sweep rows, report, WebKit shots |
| `tests/unit/bombSpots.test.js`, `balloonArmy.test.js`, `bossPatterns.test.js`, `crasherWaves.test.js`, `showdown.test.js`, `defuseHud.test.js` (new) | Unit tests |
| `tests/unit/flowHooks.test.js`, `prompts.test.js` (modify) | Unit tests |
| `tests/e2e/postgame2.spec.js` (new) | Browser tests |

## Shared interfaces (every task relies on these exact names)

```js
// src/postgame/bombSpots.js (pure)
LEG_SPEED = { glide: 19, zip: 18, run: 7 }, FUSE_SLACK = 1.35, FUSE_BASE = 8, NEAR = 6, NEAR_RATE = 0.25, MISS_PENALTY = 5, GLIDE_RATIO = 7
BOMBS, BOMB_IDS, bombById(id), bombFightId(id) -> 'bomb:<id>', isBombFight(id), guardFight(bomb) -> encounter def
// Bomb: { id, name, where, start: {x,y,z,yaw}, at: {x,y,z}, defuse: 'guard'|'counter', guard?: waves, fuse,
//         legs: [{ kind: 'glide'|'zip'|'run', to: {x,y,z}, zip?: { a:{x,z}, b:{x,z} } }] }
legTime(from, leg), routeTime(bomb), fuseFor(bomb), glideRatio(from, to), nextLeg(bomb, i, pos, reach = 8) -> index
createFuse(sec) -> { left, done, update(dt, rate = 1) -> 'boom'|null, cut(sec), stop() }
createDefuse({ hits = 4, window = 0.18, period = 1.3, speedUp = 0.85, rng }) -> { needle, mark, window, got, need, done, update(dt), press() -> 'hit'|'miss'|'done' }
fuseText(sec) -> 'm:ss', BOMB_RADIO(bomb), DEFUSED(bomb, n) -> { title, text }, SPLAT { title, text }, bombStatus(n)

// src/postgame/balloonArmy.js (pure)
ARMY_SIZE = 16, ARMY_CENTER = { x: 150, y: 20, z: 10 }, ARMY_RANGE = 220, POP_RADIUS = 1.1
ARMY: [{ i, x, y, z, ax, az, w, phase, spray }], armyPos(b, t, out) -> out, sprays(b, t, dt) -> boolean
armyStatus(popped), ARMY_RADIO { title, text }, ARMY_DONE { title, text }

// src/gadgets/skyTargets.js (pure)
createSkyTargets() -> { add(provider) -> undo, count, aimed(eye, dir, { range = 40, maxAngle = 0.3 }) -> { provider, item } | null,
                        forNear(pos, r, fn(provider, item)) }
// provider: { items: [{ pos: {x,y,z}, alive }], hit(item, how: 'batarang'|'remote') }

// src/game/bossPatterns.js (pure)
TILE_COLS = 4, TILE_ROWS = 3, STORY_BOSS, ENCORE_BOSS, ENCORE_LINES, progressSteps(P)
tilePattern(name: 'checker'|'rows'|'ring'|'random', n, rng) -> tile indices, between([a, b], rng), pickPattern(P, rng)
// Pattern: { id, waves, buzzFirst, buzzEvery, tileCount, warn, shock, patterns, cyclesToWin, hitsToKnock, throwGap, firstThrow,
//            stunTime, doubleThrow, chainHits, chainsToWin, windupScale, tilesInPhase3, phase3BuzzEvery, lines }

// src/postgame/crasherWaves.js (pure)
CRASHERS_ID = 'partyCrashers', CRASHERS (a challenge of kind 'survival'), MAX_GOONS = 9, REST = 2.5, CAKE_EVERY = 5, CAKE_HEAL = 35
crasherFightId(n) -> 'crashers:<n>', isCrasherFight(id), waveOf(id), crasherCount(n), crasherWave(n, rng) -> encounter def,
crasherRules(n) -> hardness rules, isCakeBreak(n), crasherMedalNote(n)
// src/game/challenges.js: medalFor/isBetter treat 'survival' like 'arena' (higher is better); formatResult -> '7 waves'

// src/postgame/encoreRules.js (pure)
ENCORE_CARD, ENCORE_START, ENCORE_PAGE = 'encorePage', encoreUnlocked(p), encoreStatus(p), formatClock(sec),
ENCORE_UNLOCKED { title, text }, encoreWon(sec, best) -> { title, text }, ENCORE_QUIT

// src/postgame/showdownRegistry.js (pure; import before loadProgress)
// progress.bombs: id[]   progress.army: number[]   progress.encore: { won, best }
sanitizeBombs, sanitizeArmy, sanitizeEncore, SHOWDOWN_WEIGHTS = { bombs: 5, army: 3, encore: 4, crashers: 5 }

// src/game/boss.js: boss.begin(pattern = STORY_BOSS), boss.stop(), boss.pattern; 'bossDefeated' { encore: boolean }
// src/game/flowHooks.js: mergeFlowHooks adds keepHealth(fightId) -> boolean (any provider)
// src/game/flow.js: a fightDone whose id a side hook keeps (keepHealth) doesn't refill health; bossDefeated { encore } is ignored
// src/postgame/afterParty.js: system.keepHealth?(id); post.addPage({ id, title, make, shown?(progress) })

// src/game/challengeRunner.js
runner.addChallenge(ch, { shown = () => true }) -> pillar, runner.extras -> ch[], runner.finish(value, { respawn = false })
// registerKind hooks gain stop(run, reason: 'down'|'quit') -> true when the kind ended the run itself

// src/gadgets/gadgetSystem.js: createGadgetSystem({ ..., targets = null }); sys.targets; gadgets.targets

// src/postgame/postProps.js (additions)
createJokerCard(face = 'bomb'|'encore') -> Group, createCakeBomb() -> Group (userData.spark), createArmyMeshes(n) -> { group, bodies, cans }

// src/ui/defuseHud.js
arcPath(mark, window, r) -> SVG path string
createDefuseHud(root) -> { fuse(text, urgent), hideFuse(), dial(needle, mark, window, got, need), hideDial(), flash('hit'|'miss') }

// src/postgame/cakeBombs.js
createCakeBombs({ scene, hero, events, encounters, combat, input, progress, save, ui, hud, gfx, defuseHud, rng, canStart })
  -> { items, update, busy, marker, onRespawn, light(id), setFuse(sec), debug }
// src/postgame/armyRun.js
createBalloonArmy({ scene, hero, events, progress, save, ui, hud, gfx, targets }) -> { items, update, pop(i), popAll(), debug }
// src/postgame/postPages.js: encoreIntroPages(stage), encorePages(stage)
// src/postgame/encore.js
createEncore({ scene, hero, follow, events, boss, combat, progress, save, ui, hud, flow, stage, camera, canStart })
  -> { update, busy, music, onRespawn, quit(), startNow(), running, debug }
// src/postgame/crashers.js
attachCrashers(runner, { events, encounters, combat, hero, hud, ui, rng, progress, shown }) -> { jumpTo(n), debug }
// src/ui/menus.js: pause opts.onQuitEncore ('Leave the encore')

// New events: bombLit { id, fuse }, defuseStart { id, kind }, defuseHit { got }, defuseMiss, fuseTick, bombDefused { id, count },
// bombSplat { id }, encoreUnlocked, armyNear, armyPop { index, count, how }, armyCleared, encoreStart, encoreWon { time, best },
// encoreQuit, crasherWave { wave }, cakeBreak { wave }; and 5FG's missionDone { id } for each bomb, the army and the encore.
```

### The five cake bombs at a glance

| Bomb | Start (Joker card) | Route | Defuse | Fuse |
|---|---|---|---|---|
| The Docks Delight | GCPD roof | glide to cold storage, zip to warehouse 5, a few steps | beat a brute and two grunts | 23 s |
| The Neon Sprinkle Special | the 24 hour building's roof | zip to the Gazette, glide to the bar roof | counter dial | 17 s |
| The Toxic Tiramisu | the hotel roof | glide to the factory, zip to the vat deck, a few steps | beat two knives and a brute | 21 s |
| The Harbour Candle Cake | the Iceberg roof | zip to the noodle bar, glide to the container yard | counter dial | 22 s |
| The Double Doughnut Deluxe | the tall tower west of GCPD | zip down to GCPD, a long glide to the diner | beat two waves | 27 s |

Fuses are the route's time at easy speeds, times 1.35, plus 8 s. Close to the bomb (6 m) the fuse runs at a quarter speed. The dial: 4 hits, a miss costs 5 s of fuse. Each bomb pays 500 XP (`missionDone`). All five unlock Joker's Encore.

### Joker's Encore at a glance

| | Story fight | Encore |
|---|---|---|
| Phase 1 goon waves | 2 | 3 (two brutes in the last) |
| Floor buzz | every 6 to 8 s, 4 to 6 random tiles, 1.4 s warning | every 4 to 5.5 s, checker, row, ring or random, 1.1 s warning |
| Phase 2 | 3 gas cycles, one gag per throw | 4 cycles, half the throws are doubled (one where you are heading) |
| Phase 3 | 3 chains of 3 counters | 4 chains of 4 counters, faster wind-ups, the floor keeps buzzing |
| Reward | the story goes on | gold medal, best time, a new comic page, 500 XP |

---
### Task 1: Cake bomb routes, fuses and the defuse dial (pure)

**Files:**
- Create: `src/postgame/bombSpots.js`
- Test: `tests/unit/bombSpots.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: everything listed for `bombSpots.js` in Shared interfaces.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/bombSpots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  BOMBS, BOMB_IDS, bombById, bombFightId, isBombFight, guardFight, LEG_SPEED, FUSE_SLACK, FUSE_BASE, NEAR_RATE, MISS_PENALTY, GLIDE_RATIO,
  legTime, routeTime, fuseFor, glideRatio, nextLeg, createFuse, createDefuse, fuseText, BOMB_RADIO, DEFUSED, SPLAT, bombStatus,
} from '../../src/postgame/bombSpots.js';

const DASH = /[\u2013\u2014]/;
const seq = (...v) => { let i = 0; return { next: () => v[Math.min(i++, v.length - 1)] } };

describe('cake bomb data', () => {
  it('five bombs, each route with a glide and a zipline, three guards and two dials', () => {
    expect(BOMB_IDS).toEqual(['bombDocks', 'bombNeon', 'bombAce', 'bombHarbour', 'bombDiner']);
    for (const b of BOMBS) {
      expect(b.legs.some((l) => l.kind === 'glide'), b.id).toBe(true);
      expect(b.legs.some((l) => l.kind === 'zip' && l.zip), b.id).toBe(true);
      expect(b.legs.at(-1).to).toEqual(b.at);
      if (b.defuse === 'guard') expect(b.guard.length).toBeGreaterThan(0);
    }
    expect(BOMBS.map((b) => b.defuse)).toEqual(['guard', 'counter', 'guard', 'counter', 'guard']);
    expect(bombById('bombAce').name).toBe('The Toxic Tiramisu');
    expect(bombById('nope')).toBe(null);
  });
  it('every glide leg is flat enough to make without diving', () => {
    for (const b of BOMBS) {
      let from = b.start;
      for (const l of b.legs) {
        if (l.kind === 'glide') expect(glideRatio(from, l.to), b.id).toBeLessThanOrEqual(GLIDE_RATIO);
        from = l.to;
      }
    }
    expect(glideRatio({ x: 0, y: 10, z: 0 }, { x: 70, y: 0, z: 0 })).toBe(7);
    expect(glideRatio({ x: 0, y: 0, z: 0 }, { x: 5, y: 1, z: 0 })).toBe(Infinity);
  });
  it('fuses come from the route at easy speeds', () => {
    expect([LEG_SPEED, FUSE_SLACK, FUSE_BASE]).toEqual([{ glide: 19, zip: 18, run: 7 }, 1.35, 8]);
    expect(legTime({ x: 0, y: 0, z: 0 }, { kind: 'run', to: { x: 14, y: 0, z: 0 } })).toBe(2);
    const b = { start: { x: 0, y: 0, z: 0 }, legs: [{ kind: 'glide', to: { x: 38, y: 0, z: 0 } }, { kind: 'run', to: { x: 38, y: 0, z: 7 } }] };
    expect(routeTime(b)).toBe(3);
    expect(fuseFor(b)).toBe(13);
    expect(BOMBS.map((x) => x.fuse)).toEqual([23, 17, 21, 22, 27]);
  });
  it('fight ids and the guard fight', () => {
    expect(bombFightId('bombDocks')).toBe('bomb:bombDocks');
    expect([isBombFight('bomb:bombDocks'), isBombFight('guest:dj'), isBombFight(undefined)]).toEqual([true, false, false]);
    const b = bombById('bombDocks');
    expect(guardFight(b)).toEqual({ site: b.at, radius: 10, waves: b.guard });
  });
  it('copy has no dashes', () => {
    const b = bombById('bombNeon');
    for (const s of [BOMB_RADIO(b), DEFUSED(b, 2).text, DEFUSED(b, 5).text, SPLAT.title, SPLAT.text, bombStatus(1), bombStatus(5), ...BOMBS.map((x) => `${x.name} ${x.where}`)]) expect(s).not.toMatch(DASH);
    expect(DEFUSED(b, 2).text).toBe('The Neon Sprinkle Special, defused and delicious. 2 of 5 cake bombs.');
    expect(bombStatus(5)).toBe('All five defused');
  });
});

describe('the route waypoint', () => {
  it('moves on as each leg end is reached, then points at the bomb', () => {
    const b = bombById('bombDocks');
    expect(nextLeg(b, 0, b.start)).toBe(0);
    expect(nextLeg(b, 0, { x: -55, y: 22, z: 110 })).toBe(1);
    expect(nextLeg(b, 1, { x: -110, y: 15, z: 121 })).toBe(2);
    expect(nextLeg(b, 2, b.at)).toBe(3);
    expect(nextLeg(b, 0, { x: -56, y: 40, z: 114 })).toBe(0);
  });
});

describe('fuses', () => {
  it('burn at their rate, slow near the bomb, and go off once', () => {
    const f = createFuse(10);
    expect(f.update(4)).toBe(null);
    expect(f.update(8, NEAR_RATE)).toBe(null);
    expect(f.left).toBeCloseTo(4);
    f.cut(MISS_PENALTY);
    expect(f.update(0)).toBe('boom');
    expect(f.update(1)).toBe(null);
    expect(f.left).toBe(0);
  });
  it('reads as minutes and seconds', () => {
    expect([fuseText(23), fuseText(59.2), fuseText(61), fuseText(-3)]).toEqual(['0:23', '1:00', '1:01', '0:00']);
  });
});

describe('the counter dial', () => {
  it('a press in the window hits, moves the mark and speeds up; outside it misses', () => {
    const d = createDefuse({ hits: 2, window: 0.2, period: 1, speedUp: 0.5, rng: seq(0.5, 0) });
    expect(d.mark).toBeCloseTo(0.5);
    d.update(0.2);
    expect(d.needle).toBeCloseTo(0.2);
    expect(d.press()).toBe('miss');
    d.update(0.25);
    expect(d.press()).toBe('hit');
    expect([d.got, d.mark, d.needle]).toEqual([1, 0.2, 0]);
    d.update(0.1);
    expect(d.needle).toBeCloseTo(0.2);
    expect(d.press()).toBe('done');
    expect(d.done).toBe(true);
  });
  it('the window wraps around the top of the dial', () => {
    const d = createDefuse({ hits: 3, window: 0.2, period: 1, rng: seq(0) });
    expect(d.mark).toBeCloseTo(0.2);
    d.update(0.95);
    expect(d.press()).toBe('miss');
    const e = createDefuse({ hits: 3, window: 0.5, period: 1, rng: seq(0) });
    e.update(0.98);
    expect(e.press()).toBe('hit');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/bombSpots.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/postgame/bombSpots.js`**

```js
// The five Joker cake bombs of After the Party, as data, and their rules. Pure.
// Touching a bomb's Joker card lights its fuse. The route (legs) is the way the Joker expects you
// to come: a glide and a zipline (a zip leg names the ZIP_ROUTES pair it rides). The fuse is the
// route's time at easy speeds, times FUSE_SLACK, plus FUSE_BASE seconds. Within NEAR m of the bomb
// the fuse slows to NEAR_RATE (the Joker's clockwork jams when Batman is close), and the defuse
// starts: beat the goon guarding it ('guard'), or time counters on a dial ('counter').
// scripts/postgame-check.mjs checks every spot, each glide leg's ratio and each zip against the city.
export const LEG_SPEED = { glide: 19, zip: 18, run: 7 };
export const FUSE_SLACK = 1.35, FUSE_BASE = 8, NEAR = 6, NEAR_RATE = 0.25, MISS_PENALTY = 5, GLIDE_RATIO = 7;

const g = (dx, dz) => ({ type: 'grunt', dx, dz });
const k = (dx, dz) => ({ type: 'knife', dx, dz });
const b = (dx, dz) => ({ type: 'brute', dx, dz });
const P = (x, y, z) => ({ x, y, z });

const RAW = [
  {
    id: 'bombDocks', name: 'The Docks Delight', where: 'Warehouse roof, the Docks',
    start: { ...P(-10, 42, 18), yaw: -0.45 }, at: P(-126, 15, 124), defuse: 'guard',
    legs: [
      { kind: 'glide', to: P(-56, 22, 114) },
      { kind: 'zip', to: P(-112, 15, 120), zip: { a: { x: -60, z: 120 }, b: { x: -120, z: 120 } } },
      { kind: 'run', to: P(-126, 15, 124) },
    ],
    guard: [[b(0, -4), g(-3, 3), g(3, 3)]],
  },
  {
    id: 'bombNeon', name: 'The Neon Sprinkle Special', where: 'Bar roof, Neon Row',
    start: { ...P(184, 38, -14), yaw: -1.4 }, at: P(126, 22, 52), defuse: 'counter',
    legs: [
      { kind: 'zip', to: P(130, 30, -2), zip: { a: { x: 120, z: 0 }, b: { x: 180, z: -9 } } },
      { kind: 'glide', to: P(126, 22, 52) },
    ],
  },
  {
    id: 'bombAce', name: 'The Toxic Tiramisu', where: 'The vat deck, Ace Chemicals',
    start: { ...P(116, 45, -80), yaw: 2.9 }, at: P(188, 10, -126), defuse: 'guard',
    legs: [
      { kind: 'glide', to: P(138, 25.1, -160) },
      { kind: 'zip', to: P(176, 10, -122), zip: { a: { x: 140, z: -172 }, b: { x: 180, z: -118 } } },
      { kind: 'run', to: P(188, 10, -126) },
    ],
    guard: [[k(-3, -3), k(3, -3), b(0, 4)]],
  },
  {
    id: 'bombHarbour', name: 'The Harbour Candle Cake', where: 'The container yard',
    start: { ...P(186, 30, 122), yaw: -1.6 }, at: P(18, 0.15, 162), defuse: 'counter',
    legs: [
      { kind: 'zip', to: P(126, 20, 112), zip: { a: { x: 120, z: 112 }, b: { x: 180, z: 115 } } },
      { kind: 'glide', to: P(18, 0.15, 162) },
    ],
  },
  {
    id: 'bombDiner', name: 'The Double Doughnut Deluxe', where: 'Diner roof, Neon Row',
    start: { ...P(-64, 53, 4), yaw: 1.57 }, at: P(176, 9, 66), defuse: 'guard',
    legs: [
      { kind: 'zip', to: P(-4, 42, 0), zip: { a: { x: 0, z: 0 }, b: { x: -60, z: 0 } } },
      { kind: 'glide', to: P(176, 9, 66) },
    ],
    guard: [[k(-3, -2), k(3, -2), b(0, 3)], [g(-4, 0), g(4, 0)]],
  },
];

const dist = (a, c) => Math.hypot(c.x - a.x, c.y - a.y, c.z - a.z);
// How long a leg takes at easy speeds (a glide or a zip covers its straight line).
export const legTime = (from, leg) => dist(from, leg.to) / LEG_SPEED[leg.kind];
export function routeTime(bomb) {
  let t = 0, from = bomb.start;
  for (const leg of bomb.legs) { t += legTime(from, leg); from = leg.to; }
  return t;
}
export const fuseFor = (bomb) => Math.ceil(routeTime(bomb) * FUSE_SLACK + FUSE_BASE);
// Metres forward per metre down. A flat glide in this game does about 7.
export function glideRatio(from, to) {
  const drop = from.y - to.y;
  return drop <= 0 ? Infinity : Math.hypot(to.x - from.x, to.z - from.z) / drop;
}

export const BOMBS = RAW.map((x) => ({ ...x, fuse: fuseFor(x) }));
export const BOMB_IDS = BOMBS.map((x) => x.id);
export const bombById = (id) => BOMBS.find((x) => x.id === id) ?? null;
export const bombFightId = (id) => `bomb:${id}`;
export const isBombFight = (id) => typeof id === 'string' && id.startsWith('bomb:');
export const guardFight = (bomb) => ({ site: bomb.at, radius: 10, waves: bomb.guard });

// The waypoint for a running bomb: the end of the first leg not yet reached (within `reach` m),
// or the bomb itself. Returns the leg index (legs.length means the bomb).
export function nextLeg(bomb, i, pos, reach = 8) {
  while (i < bomb.legs.length && Math.hypot(bomb.legs[i].to.x - pos.x, bomb.legs[i].to.z - pos.z) < reach && Math.abs(bomb.legs[i].to.y - pos.y) < 6) i += 1;
  return i;
}

// A fuse: counts down in game time at `rate` (1, or NEAR_RATE by the bomb). 'boom' once.
export function createFuse(sec) {
  let left = sec, done = false;
  return {
    get left() { return Math.max(0, left); },
    get done() { return done; },
    update(dt, rate = 1) {
      if (done) return null;
      left -= dt * rate;
      if (left > 0) return null;
      done = true;
      return 'boom';
    },
    cut(sec2) { left -= sec2; },
    stop() { done = true; },
  };
}

// The counter-timing defuse: a needle sweeps the dial every `period` seconds; press counter
// while it is inside the window (width `window`, a fraction of the dial) around `mark`. Each hit
// moves the mark and speeds the needle up; a miss costs MISS_PENALTY seconds of fuse (the caller
// cuts it) and the needle keeps going. `hits` hits in total defuse it.
export function createDefuse({ hits = 4, window = 0.18, period = 1.3, speedUp = 0.85, rng }) {
  let t = 0, got = 0, per = period;
  const pick = () => 0.2 + rng.next() * 0.6;
  let mark = pick();
  const needle = () => (t % per) / per;
  return {
    get needle() { return needle(); },
    get mark() { return mark; },
    get window() { return window; },
    get got() { return got; },
    get need() { return hits; },
    get done() { return got >= hits; },
    update(dt) { t += dt; },
    press() {
      if (got >= hits) return 'done';
      const d = Math.abs(needle() - mark);
      if (Math.min(d, 1 - d) > window / 2) return 'miss';
      got += 1;
      if (got >= hits) return 'done';
      mark = pick();
      per *= speedUp;
      t = 0;
      return 'hit';
    },
  };
}

export const fuseText = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Copy.
export const BOMB_RADIO = (bomb) => `A Joker cake bomb, ${bomb.where.toLowerCase()}. The fuse is lit! Glide, grab the zipline, get there!`;
export const DEFUSED = (bomb, n, total = BOMBS.length) => ({
  title: 'DEFUSED!',
  text: n >= total ? 'All five cake bombs, defused. The Joker is furious. He is waiting at the clock tower for an encore.' : `${bomb.name}, defused and delicious. ${n} of ${total} cake bombs.`,
});
export const SPLAT = { title: 'SPLAT!', text: 'The cake bomb went off. Batman is covered in pink frosting. It smells amazing. Touch the Joker card to try again.' };
export const bombStatus = (n, total = BOMBS.length) => (n >= total ? 'All five defused' : `${n} of ${total} defused`);
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/bombSpots.test.js`
Expected: PASS. The fuse numbers `[23, 17, 21, 22, 27]` come from the formula; if Task 15's placement check moves a spot, rerun and update that one expectation with the printed numbers.

- [ ] **Step 5: Commit**

```bash
git config user.name   # must print: Krishn Gohel
git add src/postgame/bombSpots.js tests/unit/bombSpots.test.js
git commit -m "Cake bombs: five routes with a glide and a zipline, fuses, route waypoints and the counter dial"
```

---

### Task 2: Balloon army paths and sky targets for gadgets (pure)

**Files:**
- Create: `src/postgame/balloonArmy.js`, `src/gadgets/skyTargets.js`
- Test: `tests/unit/balloonArmy.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: everything listed for `balloonArmy.js` and `skyTargets.js` in Shared interfaces.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/balloonArmy.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { ARMY, ARMY_SIZE, ARMY_CENTER, POP_RADIUS, armyPos, sprays, armyStatus, ARMY_RADIO, ARMY_DONE } from '../../src/postgame/balloonArmy.js';
import { createSkyTargets } from '../../src/gadgets/skyTargets.js';

const DASH = /[\u2013\u2014]/;

describe('the balloon army', () => {
  it('sixteen balloons over the Neon Row avenue, clear of both rows of buildings and the bunting', () => {
    expect(ARMY).toHaveLength(ARMY_SIZE);
    expect(ARMY_SIZE).toBe(16);
    for (const b of ARMY) {
      expect(b.x - b.ax).toBeGreaterThan(141);
      expect(b.x + b.ax).toBeLessThan(159);
      expect(b.y - 1.2).toBeGreaterThan(13);
      expect(b.z).toBeGreaterThanOrEqual(-80);
      expect(b.z).toBeLessThanOrEqual(110);
    }
    expect(ARMY_CENTER).toEqual({ x: 150, y: 20, z: 10 });
    expect(POP_RADIUS).toBe(1.1);
  });
  it('paths are ellipses around each anchor and write into the given object', () => {
    const b = ARMY[0], out = {};
    expect(armyPos(b, 0, out)).toBe(out);
    expect(out).toEqual({ x: 146, y: 15, z: -73 });
    armyPos(b, Math.PI / (2 * b.w), out);
    expect(out.x).toBeCloseTo(148);
    expect(out.z).toBeCloseTo(-76);
  });
  it('each can sprays once per its period', () => {
    const b = ARMY[0];
    let n = 0;
    for (let k = 1; k <= 1300; k++) if (sprays(b, k / 100, 0.01)) n += 1;
    expect(n).toBe(4);
  });
  it('copy', () => {
    expect(armyStatus(3)).toBe('3 of 16 popped');
    expect(armyStatus(16)).toBe('Neon Row is balloon free');
    for (const s of [ARMY_RADIO.text, ARMY_DONE.title, ARMY_DONE.text]) expect(s).not.toMatch(DASH);
  });
});

describe('sky targets', () => {
  const item = (x, y, z, alive = true) => ({ pos: { x, y, z }, alive });
  it('aims at the live item nearest the line of sight, inside range and angle', () => {
    const sky = createSkyTargets();
    const p = { items: [item(0, 0, 10), item(1.5, 0, 10), item(0, 0, 50), item(0.2, 0, 5, false)], hit: vi.fn() };
    sky.add(p);
    const eye = { x: 0, y: 0, z: 0 }, dir = { x: 0, y: 0, z: 1 };
    expect(sky.aimed(eye, dir).item).toBe(p.items[0]);
    expect(sky.aimed(eye, { x: 1, y: 0, z: 0 })).toBe(null);
    expect(sky.aimed(eye, dir, { range: 5 })).toBe(null);
    expect(sky.count).toBe(3);
  });
  it('reuses one result object, and undo removes the provider', () => {
    const sky = createSkyTargets();
    const undo = sky.add({ items: [item(0, 0, 10)], hit() {} });
    const a = sky.aimed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const b = sky.aimed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    expect(a).toBe(b);
    undo();
    expect(sky.aimed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })).toBe(null);
  });
  it('forNear visits every live item in range', () => {
    const sky = createSkyTargets();
    const p = { items: [item(0, 0, 0), item(0.5, 0.5, 0), item(3, 0, 0), item(0, 0, 0.2, false)], hit() {} };
    sky.add(p);
    const seen = [];
    sky.forNear({ x: 0, y: 0, z: 0 }, 1.1, (prov, it) => seen.push(p.items.indexOf(it)));
    expect(seen).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/balloonArmy.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/postgame/balloonArmy.js`**

```js
// The Balloon Army of After the Party: sixteen hostile Joker balloons drifting over Neon Row,
// each carrying a spray can. Their paths, their spray timing and the copy. Pure.
// Each balloon circles an anchor on its own slow ellipse and bobs; every few seconds its can
// sprays a puff of green paint. Pop them all with batarangs or the remote batarang.
export const ARMY_SIZE = 16;
export const ARMY_CENTER = { x: 150, y: 20, z: 10 };
export const ARMY_RANGE = 220;
export const POP_RADIUS = 1.1;

const r2 = (v) => Math.round(v * 100) / 100;
// Two lines over the Neon Row avenue (the street between x 140 and 160, clear of both rows of
// buildings), eight balloons each from the hotel to the noodle bar, 15 to 25 m up (above the
// party bunting strung over the street at 12 m).
export const ARMY = Array.from({ length: ARMY_SIZE }, (_, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  return {
    i,
    x: col ? 154 : 146, y: 15 + ((i * 5) % 15), z: -76 + row * 26,
    ax: 2 + (i % 2), az: 3 + (i % 3) * 1.5,
    w: r2(0.2 + (i % 5) * 0.035), phase: r2(i * 1.37),
    spray: 3 + (i % 4),
  };
});

// Where balloon `b` is at time t (written into `out`, no allocation).
export function armyPos(b, t, out) {
  const a = b.w * t + b.phase;
  out.x = b.x + Math.sin(a) * b.ax;
  out.y = b.y + Math.sin(2 * a) * 1.2;
  out.z = b.z + Math.cos(a) * b.az;
  return out;
}

// True in the frame a balloon's can sprays: once every `spray` seconds, offset by its phase.
export function sprays(b, t, dt) {
  const n1 = Math.floor((t + b.phase) / b.spray), n0 = Math.floor((t - dt + b.phase) / b.spray);
  return n1 > n0;
}

export const armyStatus = (popped, total = ARMY_SIZE) => (popped >= total ? 'Neon Row is balloon free' : `${popped} of ${total} popped`);
export const ARMY_RADIO = {
  title: 'JOKER RADIO',
  text: 'Look up, birthday bat! My balloon army is redecorating Neon Row. Spray paint for everyone! Ha ha ha!',
};
export const ARMY_DONE = {
  title: 'NEON ROW IS CLEAN!',
  text: 'Sixteen balloons, sixteen pops. The Joker is sulking. Gotham thanks you, and so does the paint.',
};
```

- [ ] **Step 4: Write `src/gadgets/skyTargets.js`**

```js
// Things in the air that gadgets can hit besides goons (Plan 7H-2's Joker balloons). A provider
// is { items: [{ pos: {x,y,z}, alive }], hit(item, how) }. The batarang aims at the item nearest
// its line of sight when no goon is in range; the remote batarang pops whatever it flies through.
// Pure; loops only, and aimed() reuses one result object.
export function createSkyTargets() {
  const providers = [];
  const result = { provider: null, item: null };
  return {
    add(p) {
      providers.push(p);
      return () => { const i = providers.indexOf(p); if (i >= 0) providers.splice(i, 1); };
    },
    get count() {
      let n = 0;
      for (const p of providers) for (const it of p.items) if (it.alive) n += 1;
      return n;
    },
    // The live item closest to the ray from `eye` along unit `dir`, within `range` and `maxAngle`.
    aimed(eye, dir, { range = 40, maxAngle = 0.3 } = {}) {
      let best = Infinity;
      result.provider = null;
      result.item = null;
      for (const p of providers) {
        for (const it of p.items) {
          if (!it.alive) continue;
          const dx = it.pos.x - eye.x, dy = it.pos.y - eye.y, dz = it.pos.z - eye.z;
          const d = Math.hypot(dx, dy, dz);
          if (d > range || d < 1e-6) continue;
          const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
          const ang = Math.acos(Math.min(1, Math.max(-1, cos)));
          if (ang <= maxAngle && ang < best) { best = ang; result.provider = p; result.item = it; }
        }
      }
      return result.item ? result : null;
    },
    // Calls fn(provider, item) for every live item within r of pos.
    forNear(pos, r, fn) {
      for (const p of providers) {
        for (const it of p.items) {
          if (!it.alive) continue;
          if (Math.hypot(it.pos.x - pos.x, it.pos.y - pos.y, it.pos.z - pos.z) <= r) fn(p, it);
        }
      }
    },
  };
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/balloonArmy.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/balloonArmy.js src/gadgets/skyTargets.js tests/unit/balloonArmy.test.js
git commit -m "Balloon army paths over Neon Row, and a sky target registry for gadgets"
```

---

### Task 3: The boss fight as a pattern: the story numbers and Joker's Encore (pure)

**Files:**
- Create: `src/game/bossPatterns.js`
- Test: `tests/unit/bossPatterns.test.js` (new)

**Interfaces:**
- Consumes: nothing (every number is copied from `src/game/boss.js` as it stands on `main`: `WAVES`, the buzz timer `5` then `rng.range(6, 8)`, `rng.int(4, 6)` tiles, the `1.4` s warning and `0.7` s shock, `cycles >= 3`, `hits >= 5`, `rng.range(2.4, 3.4)` between throws, `throwT = 2`, the `3.6` s stun, `chainHits >= 3`, `chains >= 3`, the wind-up `* 0.85`).
- Produces: everything listed for `bossPatterns.js` in Shared interfaces. Task 6 makes `boss.js` read these.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/bossPatterns.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STORY_BOSS, ENCORE_BOSS, ENCORE_LINES, TILE_COLS, TILE_ROWS, progressSteps, tilePattern, between, pickPattern } from '../../src/game/bossPatterns.js';

const DASH = /[\u2013\u2014]/;
const seq = (...v) => { let i = 0; return { next: () => v[Math.min(i++, v.length - 1)] } };

describe('boss patterns', () => {
  it('the story pattern keeps every number the fight always had', () => {
    expect(STORY_BOSS).toMatchObject({
      buzzFirst: 5, buzzEvery: [6, 8], tileCount: [4, 6], warn: 1.4, shock: 0.7, patterns: ['random'],
      cyclesToWin: 3, hitsToKnock: 5, throwGap: [2.4, 3.4], firstThrow: 2, stunTime: 3.6, doubleThrow: 0,
      chainHits: 3, chainsToWin: 3, windupScale: 0.85, tilesInPhase3: false, lines: null,
    });
    expect(STORY_BOSS.waves).toEqual([
      [['grunt', -8, 6], ['grunt', 8, 6], ['grunt', 0, 10], ['knife', -12, 2]],
      [['grunt', -10, 4], ['knife', 10, 4], ['knife', 0, 9], ['brute', 0, 0]],
    ]);
    expect(progressSteps(STORY_BOSS)).toBe(7);
  });
  it('the encore is harder on every axis and keeps the floor live in phase 3', () => {
    const E = ENCORE_BOSS, S = STORY_BOSS;
    expect(E.waves.length).toBeGreaterThan(S.waves.length);
    expect(E.buzzEvery[1]).toBeLessThan(S.buzzEvery[0]);
    expect(E.warn).toBeLessThan(S.warn);
    expect(E.cyclesToWin).toBeGreaterThan(S.cyclesToWin);
    expect(E.chainHits).toBeGreaterThan(S.chainHits);
    expect(E.windupScale).toBeLessThan(S.windupScale);
    expect(E.doubleThrow).toBeGreaterThan(0);
    expect(E.tilesInPhase3).toBe(true);
    expect(E.patterns).toEqual(['checker', 'rows', 'ring', 'random']);
    expect(progressSteps(E)).toBe(9);
  });
  it('encore lines have no dashes', () => {
    const all = [...ENCORE_LINES.phase1, ENCORE_LINES.drop, ...ENCORE_LINES.phase2, ...ENCORE_LINES.stunned, ENCORE_LINES.phase3, ...ENCORE_LINES.chain, ...ENCORE_LINES.hurt];
    for (const s of all) expect(s).not.toMatch(DASH);
  });
});

describe('tile patterns', () => {
  it('a 4 by 3 floor', () => {
    expect([TILE_COLS, TILE_ROWS]).toEqual([4, 3]);
  });
  it('checker, rows, ring and random', () => {
    expect(tilePattern('checker', 0, seq(0.2))).toEqual([0, 2, 5, 7, 8, 10]);
    expect(tilePattern('checker', 0, seq(0.7))).toEqual([1, 3, 4, 6, 9, 11]);
    expect(tilePattern('rows', 0, seq(0.9))).toEqual([8, 9, 10, 11]);
    expect(tilePattern('ring', 0, seq(0))).toEqual([0, 1, 2, 3, 4, 7, 8, 9, 10, 11]);
    const r = tilePattern('random', 5, seq(0.3, 0.9, 0.1, 0.5, 0.7, 0.2, 0.8, 0.4, 0.6, 0, 0.35));
    expect(r).toHaveLength(5);
    expect(new Set(r).size).toBe(5);
    for (const i of r) expect(i >= 0 && i < 12).toBe(true);
  });
  it('ranges and pattern picks', () => {
    expect(between([4, 6], seq(0.5))).toBe(5);
    expect(pickPattern(ENCORE_BOSS, seq(0.99))).toBe('random');
    expect(pickPattern(ENCORE_BOSS, seq(0))).toBe('checker');
    expect(pickPattern(STORY_BOSS, seq(0.7))).toBe('random');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/bossPatterns.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/game/bossPatterns.js`**

```js
// The Joker boss fight's numbers as a pattern object: the story fight (every number boss.js used
// before Plan 7H-2, unchanged) and Joker's Encore, the harder post-game rematch. Pure.
// waves: phase 1 goon waves [type, dx, dz]; buzzEvery/tileCount/warn/shock: the joy-buzzer floor;
// patterns: which tile shapes phase 1 draws from; cyclesToWin/hitsToKnock/throwGap/firstThrow/
// stunTime/doubleThrow: phase 2's gas and batarang cycles; chainHits/chainsToWin/windupScale:
// phase 3's counter chains; tilesInPhase3 (and phase3BuzzEvery): the floor stays live in phase 3.
export const TILE_COLS = 4, TILE_ROWS = 3;

export const STORY_BOSS = Object.freeze({
  id: 'story',
  waves: [
    [['grunt', -8, 6], ['grunt', 8, 6], ['grunt', 0, 10], ['knife', -12, 2]],
    [['grunt', -10, 4], ['knife', 10, 4], ['knife', 0, 9], ['brute', 0, 0]],
  ],
  buzzFirst: 5, buzzEvery: [6, 8], tileCount: [4, 6], warn: 1.4, shock: 0.7, patterns: ['random'],
  cyclesToWin: 3, hitsToKnock: 5, throwGap: [2.4, 3.4], firstThrow: 2, stunTime: 3.6, doubleThrow: 0,
  chainHits: 3, chainsToWin: 3, windupScale: 0.85, tilesInPhase3: false, phase3BuzzEvery: [8, 10],
  lines: null,
});

export const ENCORE_LINES = {
  phase1: [
    'You came back! I knew you missed me, birthday bat!',
    'Encore! ENCORE! Louder, boys!',
    'New floor. Same jokes. Better jokes!',
    'Mind the tiles. I had them waxed.',
    'Round two! I brought friends and extra batteries!',
  ],
  drop: 'Nobody leaves before the encore!',
  phase2: ['Two for you! Party favors!', 'Catch! Catch again!', 'Double gas, double laughs!', 'Breathe in the fun!'],
  stunned: ['Ow! Right in the encore!', 'Rude! I was mid bow!', 'That one tickled. Do not do it again.'],
  phase3: 'Last dance, birthday bat. Keep up!',
  chain: ['Okay, okay! You are good!', 'Four in a row? Show off!', 'Stop being so heroic, it is my show!'],
  hurt: ['Still got it!', 'The crowd loves me!'],
};

export const ENCORE_BOSS = Object.freeze({
  id: 'encore',
  waves: [
    [['grunt', -8, 6], ['knife', 8, 6], ['grunt', 0, 10], ['knife', -12, 2], ['grunt', 12, 2]],
    [['knife', -10, 4], ['knife', 10, 4], ['brute', 0, 9], ['grunt', -4, 0], ['grunt', 4, 0]],
    [['brute', -6, 5], ['brute', 6, 5], ['knife', 0, 10], ['knife', 0, 0]],
  ],
  buzzFirst: 3, buzzEvery: [4, 5.5], tileCount: [5, 7], warn: 1.1, shock: 0.7, patterns: ['checker', 'rows', 'ring', 'random'],
  cyclesToWin: 4, hitsToKnock: 5, throwGap: [1.7, 2.5], firstThrow: 1.5, stunTime: 3, doubleThrow: 0.5,
  chainHits: 4, chainsToWin: 4, windupScale: 0.7, tilesInPhase3: true, phase3BuzzEvery: [7, 9],
  lines: ENCORE_LINES,
});

// The boss bar: 1 for the goon phase, one per gas cycle, one per counter chain.
export const progressSteps = (P) => 1 + P.cyclesToWin + P.chainsToWin;

// Which floor tiles light up next. Tiles are numbered row by row (index = row * cols + col).
// 'checker': every other tile; 'rows': one whole row; 'ring': every edge tile (only the middle is
// safe); 'random': n shuffled tiles.
export function tilePattern(name, n, rng, cols = TILE_COLS, rows = TILE_ROWS) {
  const out = [];
  if (name === 'checker') {
    const k = rng.next() < 0.5 ? 0 : 1;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if ((r + c) % 2 === k) out.push(r * cols + c);
  } else if (name === 'rows') {
    const r = Math.min(rows - 1, Math.floor(rng.next() * rows));
    for (let c = 0; c < cols; c++) out.push(r * cols + c);
  } else if (name === 'ring') {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) out.push(r * cols + c);
  } else {
    const all = Array.from({ length: cols * rows }, (_, i) => i);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    out.push(...all.slice(0, Math.min(n, all.length)));
  }
  return out;
}

// A number in [a, b] from the pattern's range.
export const between = ([a, b], rng) => a + rng.next() * (b - a);
export const pickPattern = (P, rng) => P.patterns[Math.min(P.patterns.length - 1, Math.floor(rng.next() * P.patterns.length))];
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/bossPatterns.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/bossPatterns.js tests/unit/bossPatterns.test.js
git commit -m "Boss patterns: the story fight's numbers as data, and Joker's Encore with new floor patterns"
```

---

### Task 4: Survival waves, their hardness, and survival medals (pure)

**Files:**
- Create: `src/postgame/crasherWaves.js`
- Modify: `src/game/challenges.js` (3C)
- Test: `tests/unit/crasherWaves.test.js` (new)

**Interfaces:**
- Consumes: `SITES` (`mapData.js`); 3C's `medalFor`, `isBetter`, `recordResult`, `formatResult`, `allGold`, `pillarPos`, `CHALLENGES`.
- Produces: everything listed for `crasherWaves.js`; the `survival` challenge kind in `challenges.js`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/crasherWaves.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  CRASHERS, CRASHERS_ID, MAX_GOONS, REST, CAKE_HEAL, crasherFightId, isCrasherFight, waveOf, crasherCount, crasherWave, crasherRules,
  isCakeBreak, crasherMedalNote,
} from '../../src/postgame/crasherWaves.js';
import { medalFor, isBetter, recordResult, formatResult, allGold, pillarPos, CHALLENGES } from '../../src/game/challenges.js';
import { SITES } from '../../src/world/mapData.js';

const DASH = /[\u2013\u2014]/;
const seq = (v) => ({ next: () => v });
const kinds = (w) => w.waves[0].reduce((o, g) => ({ ...o, [g.type]: (o[g.type] ?? 0) + 1 }), {});

describe('survival waves', () => {
  it('ids', () => {
    expect(CRASHERS_ID).toBe('partyCrashers');
    expect(crasherFightId(7)).toBe('crashers:7');
    expect([isCrasherFight('crashers:7'), isCrasherFight('challenge:bash'), isCrasherFight(null)]).toEqual([true, false, false]);
    expect([waveOf('crashers:12'), waveOf('guest:dj')]).toEqual([12, 0]);
  });
  it('grow from 3 goons to 9 and stay there', () => {
    expect([1, 2, 3, 4, 5, 8, 10, 11, 30].map(crasherCount)).toEqual([3, 3, 4, 5, 5, 7, 9, 9, 9]);
    expect(MAX_GOONS).toBe(9);
  });
  it('knives from wave 2, a brute every fourth wave, two from wave 12', () => {
    expect(kinds(crasherWave(1, seq(0)))).toEqual({ grunt: 3 });
    expect(kinds(crasherWave(2, seq(0)))).toEqual({ knife: 1, grunt: 2 });
    expect(kinds(crasherWave(4, seq(0)))).toEqual({ brute: 1, knife: 2, grunt: 2 });
    expect(kinds(crasherWave(12, seq(0)))).toEqual({ brute: 2, knife: 5, grunt: 2 });
    expect(kinds(crasherWave(13, seq(0))).brute).toBeUndefined();
  });
  it('stand in a ring on the Monarch roof, well inside its edges', () => {
    const w = crasherWave(20, seq(0.99));
    expect(w).toMatchObject({ site: 'monarchRoof', radius: 16 });
    for (const g of w.waves[0]) expect(Math.hypot(g.dx, g.dz)).toBeLessThan(10);
    expect(crasherWave(1, seq(0)).waves[0][0]).toEqual({ type: 'grunt', dx: 0, dz: 5.5 });
  });
  it('get tougher every wave, capped', () => {
    expect(crasherRules(1)).toEqual({ health: 1, damage: 1, windup: 1, gap: 1, maxWindups: 0, extraPerWave: 0 });
    expect(crasherRules(8)).toEqual({ health: 1.42, damage: 1.28, windup: 0.825, gap: 0.79, maxWindups: 1, extraPerWave: 0 });
    expect(crasherRules(40)).toEqual({ health: 2.2, damage: 1.8, windup: 0.65, gap: 0.6, maxWindups: 1, extraPerWave: 0 });
  });
  it('cake breaks every fifth wave, and medal notes', () => {
    expect([4, 5, 10, 0].map(isCakeBreak)).toEqual([false, true, true, false]);
    expect([REST, CAKE_HEAL]).toEqual([2.5, 35]);
    expect([crasherMedalNote(5), crasherMedalNote(6), crasherMedalNote(20)]).toEqual(['Bronze! Five waves!', null, 'Gold! Twenty waves!']);
    expect(CRASHERS.blurb).not.toMatch(DASH);
  });
});

describe('survival medals (challenges.js)', () => {
  it('more waves is better, medals at 5, 10 and 20', () => {
    expect([4, 5, 9, 10, 19, 20, 33].map((v) => medalFor(CRASHERS, v))).toEqual([null, 'bronze', 'bronze', 'silver', 'silver', 'gold', 'gold']);
    expect(isBetter(CRASHERS, 6, 5)).toBe(true);
    expect(isBetter(CRASHERS, 4, 5)).toBe(false);
    expect(recordResult({ partyCrashers: { best: 12, medal: 'silver' } }, CRASHERS, 8)).toEqual({ entry: { best: 12, medal: 'silver' }, newBest: false, medal: 'bronze' });
    expect([formatResult(CRASHERS, 1), formatResult(CRASHERS, 7)]).toEqual(['1 wave', '7 waves']);
  });
  it('stays out of the story challenges and the Gold Standard', () => {
    expect(CHALLENGES.map((c) => c.id)).not.toContain(CRASHERS_ID);
    expect(allGold(Object.fromEntries(CHALLENGES.map((c) => [c.id, { best: 1, medal: 'gold' }])))).toBe(true);
  });
  it('its pillar stands on the Monarch roof, away from the Birthday Bash pillar', () => {
    const p = pillarPos(CRASHERS);
    expect(p.y).toBe(SITES.monarchRoof.y);
    const bash = pillarPos(CHALLENGES.find((c) => c.kind === 'arena'));
    expect(Math.hypot(p.x - bash.x, p.z - bash.z)).toBeGreaterThan(15);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/crasherWaves.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/postgame/crasherWaves.js`**

```js
// Endless Party Crashers: a survival arena on the Monarch roof. Waves grow without limit; the
// result is the number of waves cleared, with medals at 5, 10 and 20. Pure.
// Wave n: 3 goons, one more roughly every 1.4 waves up to 9; knives from wave 2, a brute every
// fourth wave (two from wave 12); goons get tougher every wave through the same hardness rules
// New Game Plus uses (src/combat/hardness.js). Every fifth wave is a cake break: health back.
import { SITES } from '../world/mapData.js';

export const CRASHERS_ID = 'partyCrashers';
export const CRASHERS = {
  id: CRASHERS_ID, name: 'Endless Party Crashers', kind: 'survival',
  blurb: 'Wave after wave on the Monarch roof. How long can you keep the party going?',
  start: { x: 170, y: SITES.monarchRoof.y, z: -72, yaw: 0.69 },
  medals: { gold: 20, silver: 10, bronze: 5 },
};
export const MAX_GOONS = 9, REST = 2.5, CAKE_EVERY = 5, CAKE_HEAL = 35, RING = [5.5, 9];

export const crasherFightId = (n) => `crashers:${n}`;
export const isCrasherFight = (id) => typeof id === 'string' && id.startsWith('crashers:');
export const waveOf = (id) => (isCrasherFight(id) ? Number(id.slice(9)) : 0);

export function crasherCount(n) {
  return Math.min(MAX_GOONS, 3 + Math.floor((n - 1) * 0.7));
}

// Wave n as an encounter definition. rng gives the ring's turn and the spacing wobble.
export function crasherWave(n, rng) {
  const count = crasherCount(n);
  const brutes = n >= 12 && n % 4 === 0 ? 2 : n % 4 === 0 ? 1 : 0;
  const knives = n < 2 ? 0 : Math.min(count - brutes, Math.floor(count * Math.min(0.5, 0.1 + n * 0.03)) + 1);
  const turn = rng.next() * Math.PI * 2;
  const goons = [];
  for (let i = 0; i < count; i++) {
    const type = i < brutes ? 'brute' : i < brutes + knives ? 'knife' : 'grunt';
    const a = turn + (i / count) * Math.PI * 2;
    const r = RING[0] + (i % 2) * (RING[1] - RING[0]) * 0.6 + rng.next() * 0.8;
    goons.push({ type, dx: Math.round(Math.sin(a) * r * 10) / 10, dz: Math.round(Math.cos(a) * r * 10) / 10 });
  }
  return { site: 'monarchRoof', radius: 16, waves: [goons] };
}

// The hardness rules for wave n (the same shape as New Game Plus's).
const r2 = (v) => Math.round(v * 1000) / 1000;
export function crasherRules(n) {
  const k = Math.max(0, n - 1);
  return {
    health: r2(Math.min(2.2, 1 + 0.06 * k)),
    damage: r2(Math.min(1.8, 1 + 0.04 * k)),
    windup: r2(Math.max(0.65, 1 - 0.025 * k)),
    gap: r2(Math.max(0.6, 1 - 0.03 * k)),
    maxWindups: n >= 8 ? 1 : 0,
    extraPerWave: 0,
  };
}

export const isCakeBreak = (n) => n > 0 && n % CAKE_EVERY === 0;
export const crasherMedalNote = (n) => (n === 20 ? 'Gold! Twenty waves!' : n === 10 ? 'Silver! Ten waves!' : n === 5 ? 'Bronze! Five waves!' : null);
```

- [ ] **Step 4: The survival kind in `src/game/challenges.js`.** Right above `export function medalFor(ch, value) {` add:

```js
// Arena points and survival waves: higher is better. Everything else is a time: lower is better.
const HIGHER = new Set(['arena', 'survival']);
```
In `medalFor`, change `if (ch.kind === 'arena') return value >= m.gold ...` to `if (HIGHER.has(ch.kind)) return value >= m.gold ...` (the rest of the line unchanged). Replace `isBetter` and `formatResult` with:

```js
export const isBetter = (ch, value, best) => best == null || (HIGHER.has(ch.kind) ? value > best : value < best);
```
```js
export const formatResult = (ch, v) => (ch.kind === 'arena' ? `${Math.round(v).toLocaleString('en-US')} pts`
  : ch.kind === 'survival' ? `${v} ${v === 1 ? 'wave' : 'waves'}` : formatTime(v));
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/crasherWaves.test.js tests/unit/challenges.test.js`
Expected: PASS, including every 3C challenge test.

- [ ] **Step 6: Commit**

```bash
git add src/postgame/crasherWaves.js src/game/challenges.js tests/unit/crasherWaves.test.js
git commit -m "Endless Party Crashers rules: growing waves, per-wave hardness, cake breaks, survival medals"
```

---

### Task 5: Saved fields, encore rules, Progress categories and activities (pure)

**Files:**
- Create: `src/postgame/encoreRules.js`, `src/postgame/showdownRegistry.js`
- Test: `tests/unit/showdown.test.js` (new)

**Interfaces:**
- Consumes: 7H-1's `registerActivity` (`afterPartyModel.js`), `partyRegistry.js`; 3C's `registerProgressField`, `tracker`, `MEDAL_POINTS`, `pillarPos`; Tasks 1, 2 and 4.
- Produces: everything listed for `encoreRules.js` and `showdownRegistry.js` in Shared interfaces. Categories `bombs` (weight 5), `army` (3), `encore` (4), `crashers` (5, medal points out of 3), all active once the credits have rolled. Activities with orders 30 to 60, so the list reads crates, guests, bombs, army, encore, crashers, New Game Plus.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/showdown.test.js`:

```js
import { describe, it, expect } from 'vitest';
import '../../src/postgame/partyRegistry.js';
import '../../src/postgame/showdownRegistry.js';
import MANSI from '../../src/mansi.config.js';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { tracker } from '../../src/game/progressTracker.js';
import { afterPartyRows, allTargets } from '../../src/postgame/afterPartyModel.js';
import { BOMB_IDS } from '../../src/postgame/bombSpots.js';
import { sanitizeEncore, sanitizeArmy, sanitizeBombs } from '../../src/postgame/showdownRegistry.js';
import { ENCORE_CARD, encoreUnlocked, encoreStatus, formatClock, encoreWon, ENCORE_UNLOCKED, ENCORE_QUIT } from '../../src/postgame/encoreRules.js';

const DASH = /[\u2013\u2014]/;
const done = (o = {}) => sanitizeProgress({ finished: true, postgame: { cleared: true }, ...o });
const part = (p, id) => tracker.score(p).parts.find((x) => x.id === id);

describe('saved fields', () => {
  it('defaults and junk', () => {
    const p = sanitizeProgress({});
    expect([p.bombs, p.army, p.encore]).toEqual([[], [], { won: false, best: 0 }]);
    expect(sanitizeBombs(['bombDocks', 'x', 'bombDocks'])).toEqual(['bombDocks']);
    expect(sanitizeArmy([0, 1, 1, 16, -1, 2.5, 'a'])).toEqual([0, 1]);
    expect(sanitizeEncore({ won: true, best: 192.4 })).toEqual({ won: true, best: 192.4 });
    expect(sanitizeEncore({ won: false, best: 50 })).toEqual({ won: false, best: 0 });
    expect(sanitizeEncore({ won: true, best: -1 })).toEqual({ won: true, best: 0 });
    expect(sanitizeEncore('x')).toEqual({ won: false, best: 0 });
  });
  it('a new game keeps them', () => {
    const p = sanitizeProgress({ step: 30, bombs: ['bombAce'], army: [3], encore: { won: true, best: 200 } });
    const n = newGameProgress(p);
    expect([n.bombs, n.army, n.encore]).toEqual([p.bombs, p.army, p.encore]);
  });
});

describe('Progress tracker and activities', () => {
  it('four more categories once the credits roll', () => {
    const ids = tracker.score(sanitizeProgress({ step: 3 })).parts.map((x) => x.id);
    for (const id of ['bombs', 'army', 'encore', 'crashers']) expect(ids).not.toContain(id);
    const p = done({ bombs: BOMB_IDS, army: [0, 1], encore: { won: true, best: 192.4 }, challenges: { partyCrashers: { best: 12, medal: 'silver' } } });
    expect(part(p, 'bombs')).toMatchObject({ done: 5, total: 5, weight: 5, detail: 'All five defused' });
    expect(part(p, 'army')).toMatchObject({ done: 2, total: 16, weight: 3, detail: '2 of 16 popped' });
    expect(part(p, 'encore')).toMatchObject({ done: 1, total: 1, weight: 4, detail: 'Gold medal, best 3:12' });
    expect(part(p, 'crashers')).toMatchObject({ done: 2, total: 3, weight: 5, detail: 'Best: 12 waves, silver' });
  });
  it('rows sit between the guests and New Game Plus', () => {
    expect(afterPartyRows(done()).map((r) => r.id)).toEqual(['crates', 'guests', 'bombs', 'army', 'encore', 'crashers', 'ngPlus']);
  });
  it('targets: bomb cards, the army, the encore once unlocked, the survival pillar until gold', () => {
    const t = (p) => allTargets(p, []).filter((x) => ['bomb', 'army', 'encore', 'crashers'].includes(x.kind)).map((x) => x.id);
    expect(t(done({ bombs: ['bombDocks'] }))).toEqual(['bombNeon', 'bombAce', 'bombHarbour', 'bombDiner', 'army', 'crashers']);
    expect(t(done({ bombs: BOMB_IDS, army: [...Array(16).keys()], challenges: { partyCrashers: { best: 22, medal: 'gold' } } }))).toEqual(['encore']);
    expect(allTargets(done({ bombs: BOMB_IDS }), []).find((x) => x.id === 'encore')).toMatchObject({ kind: 'encore', ...ENCORE_CARD });
  });
});

describe('encore rules', () => {
  it('unlocks with all five bombs', () => {
    expect(encoreUnlocked(done({ bombs: BOMB_IDS.slice(0, 4) }))).toBe(false);
    expect(encoreUnlocked(done({ bombs: BOMB_IDS }))).toBe(true);
    expect(encoreStatus(done())).toBe('Defuse all five cake bombs to unlock');
    expect(encoreStatus(done({ bombs: BOMB_IDS }))).toBe('Waiting at the clock tower');
  });
  it('copy', () => {
    expect([formatClock(192.4), formatClock(59.6), formatClock(3600)]).toEqual(['3:12', '1:00', '60:00']);
    expect(encoreWon(125, true)).toEqual({ title: 'GOLD MEDAL!', text: `Joker's Encore, beaten in 2:05, a new best. A new comic page is waiting on the After the Party page, ${MANSI.name}.` });
    for (const s of [encoreWon(125, false).text, ENCORE_UNLOCKED.title, ENCORE_UNLOCKED.text, ENCORE_QUIT]) expect(s).not.toMatch(DASH);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/showdown.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/postgame/encoreRules.js`**

```js
// Joker's Encore: where its card stands on the clock tower roof, when it unlocks (every cake bomb
// defused), and its copy. The fight's own numbers are ENCORE_BOSS in src/game/bossPatterns.js. Pure.
import MANSI from '../mansi.config.js';
import { BOMB_IDS } from './bombSpots.js';

export const ENCORE_CARD = { x: -62, y: 58, z: -144 };
export const ENCORE_START = { x: -62, y: 58, z: -147, yaw: Math.PI };
export const ENCORE_PAGE = 'encorePage';

export const encoreUnlocked = (p) => BOMB_IDS.every((id) => p.bombs.includes(id));
export function encoreStatus(p) {
  if (p.encore.won) return p.encore.best > 0 ? `Gold medal, best ${formatClock(p.encore.best)}` : 'Gold medal';
  return encoreUnlocked(p) ? 'Waiting at the clock tower' : 'Defuse all five cake bombs to unlock';
}
export function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
export const ENCORE_UNLOCKED = {
  title: "JOKER'S ENCORE",
  text: 'Every cake bomb defused. The Joker wants a rematch on the clock tower roof, and he has new tricks.',
};
export const encoreWon = (sec, best) => ({
  title: 'GOLD MEDAL!',
  text: `Joker's Encore, beaten in ${formatClock(sec)}${best ? ', a new best' : ''}. A new comic page is waiting on the After the Party page, ${MANSI.name}.`,
});
export const ENCORE_QUIT = 'The Joker takes a bow anyway. Touch his card to try the encore again.';
```

- [ ] **Step 4: Write `src/postgame/showdownRegistry.js`**

```js
// Registers the second half of After the Party (Plan 7H-2) at load: its saved fields, its
// Progress tracker categories and its objective-list activities. game.js imports this before
// loadProgress, next to partyRegistry.js. Pure.
//   progress.bombs:  defused bomb ids      progress.army: popped balloon indices (0 to 15)
//   progress.encore: { won, best }          (seconds; the survival arena lives in progress.challenges)
import { registerProgressField } from '../core/save.js';
import { tracker, MEDAL_POINTS } from '../game/progressTracker.js';
import { pillarPos } from '../game/challenges.js';
import { registerActivity } from './afterPartyModel.js';
import { BOMBS, BOMB_IDS, bombStatus } from './bombSpots.js';
import { ARMY_SIZE, ARMY_CENTER, armyStatus } from './balloonArmy.js';
import { CRASHERS, CRASHERS_ID } from './crasherWaves.js';
import { ENCORE_CARD, encoreUnlocked, encoreStatus } from './encoreRules.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export function sanitizeEncore(raw) {
  const r = isObj(raw) ? raw : {};
  const best = typeof r.best === 'number' && Number.isFinite(r.best) && r.best > 0 ? Math.min(r.best, 36000) : 0;
  return { won: r.won === true, best: r.won === true ? best : 0 };
}
export const sanitizeArmy = (raw) => (Array.isArray(raw) ? [...new Set(raw.filter((i) => Number.isInteger(i) && i >= 0 && i < ARMY_SIZE))] : []);
export const sanitizeBombs = (raw) => (Array.isArray(raw) ? [...new Set(raw.filter((s) => BOMB_IDS.includes(s)))] : []);

registerProgressField('bombs', { sanitize: sanitizeBombs });
registerProgressField('army', { sanitize: sanitizeArmy });
registerProgressField('encore', { sanitize: sanitizeEncore });

export const SHOWDOWN_WEIGHTS = { bombs: 5, army: 3, encore: 4, crashers: 5 };
const cleared = (p) => p.postgame.cleared;
const crasherEntry = (p) => p.challenges[CRASHERS_ID] ?? null;
const crasherPoints = (p) => MEDAL_POINTS[crasherEntry(p)?.medal] ?? 0;
const crasherStatus = (p) => {
  const e = crasherEntry(p);
  if (!e) return 'Not tried yet';
  return `Best: ${e.best} ${e.best === 1 ? 'wave' : 'waves'}${e.medal ? `, ${e.medal}` : ''}`;
};

tracker.register({
  id: 'bombs', label: 'Cake bombs', weight: SHOWDOWN_WEIGHTS.bombs, active: cleared,
  count: (p) => ({ done: p.bombs.length, total: BOMB_IDS.length }), detail: (p) => bombStatus(p.bombs.length),
});
tracker.register({
  id: 'army', label: 'Balloon army', weight: SHOWDOWN_WEIGHTS.army, active: cleared,
  count: (p) => ({ done: p.army.length, total: ARMY_SIZE }), detail: (p) => armyStatus(p.army.length),
});
tracker.register({
  id: 'encore', label: "Joker's Encore", weight: SHOWDOWN_WEIGHTS.encore, active: cleared,
  count: (p) => ({ done: p.encore.won ? 1 : 0, total: 1 }), detail: encoreStatus,
});
tracker.register({
  id: 'crashers', label: 'Party Crashers medal', weight: SHOWDOWN_WEIGHTS.crashers, active: cleared,
  count: (p) => ({ done: crasherPoints(p), total: 3 }), detail: crasherStatus,
});

registerActivity({
  id: 'bombs', label: 'Cake bombs', order: 30,
  count: (p) => ({ done: p.bombs.length, total: BOMB_IDS.length }),
  status: (p) => bombStatus(p.bombs.length),
  targets: (p) => BOMBS.filter((b) => !p.bombs.includes(b.id)).map((b) => ({
    id: b.id, kind: 'bomb', label: `A cake bomb card, ${b.where}`, x: b.start.x, y: b.start.y, z: b.start.z, near: 300,
  })),
});
registerActivity({
  id: 'army', label: 'Balloon army', order: 40,
  count: (p) => ({ done: p.army.length, total: ARMY_SIZE }),
  status: (p) => armyStatus(p.army.length),
  targets: (p) => (p.army.length < ARMY_SIZE ? [{ id: 'army', kind: 'army', label: 'The Joker balloon army over Neon Row', ...ARMY_CENTER, near: 400 }] : []),
});
registerActivity({
  id: 'encore', label: "Joker's Encore", order: 50,
  count: (p) => ({ done: p.encore.won ? 1 : 0, total: 1 }),
  status: encoreStatus,
  targets: (p) => (encoreUnlocked(p) && !p.encore.won ? [{ id: 'encore', kind: 'encore', label: "Joker's Encore at the clock tower", ...ENCORE_CARD, near: 600 }] : []),
});
registerActivity({
  id: 'crashers', label: 'Party Crashers', order: 60,
  count: (p) => ({ done: crasherPoints(p), total: 3 }),
  status: crasherStatus,
  targets: (p) => (crasherEntry(p)?.medal === 'gold' ? [] : [{ id: 'crashers', kind: 'crashers', label: 'Endless Party Crashers on the Monarch roof', ...pillarPos(CRASHERS), near: 200 }]),
});
```

- [ ] **Step 5: Import it before the save loads.** In `src/game/game.js`, right after 7H-1's `import '../postgame/partyRegistry.js';` add `import '../postgame/showdownRegistry.js';`.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/postgame/encoreRules.js src/postgame/showdownRegistry.js src/game/game.js tests/unit/showdown.test.js
git commit -m "Post-game part 2 saves, encore rules, and Progress rows for bombs, the army, the encore and the survival arena"
```

---
### Task 6: The boss runs a pattern; an encore-aware flow; health kept between survival waves

**Files:**
- Modify: `src/game/boss.js`, `src/game/flow.js`, `src/game/flowHooks.js`, `src/postgame/afterParty.js`, `src/game/game.js`
- Test: `tests/unit/flowHooks.test.js` (modify)

**Interfaces:**
- Consumes: Task 3 (`STORY_BOSS`, `TILE_COLS`, `TILE_ROWS`, `progressSteps`, `tilePattern`, `between`, `pickPattern`); 7H-1's `mergeFlowHooks`, `createAfterParty`.
- Produces: `boss.begin(pattern = STORY_BOSS)`, `boss.stop()`, `boss.pattern`; `bossDefeated { encore }`; `keepHealth(id)` in `mergeFlowHooks` and in After the Party's flow hooks (from any system's `keepHealth`); `post.addPage` entries may carry `shown(progress)`; `window.__game.bossPatterns`.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/flowHooks.test.js`:

```js
describe('keepHealth', () => {
  it('any provider can keep health after a fight', () => {
    const h = mergeFlowHooks({}, { keepHealth: (id) => id === 'crashers:3' });
    expect([h.keepHealth('crashers:3'), h.keepHealth('guest:dj')]).toEqual([true, false]);
    expect(mergeFlowHooks({}).keepHealth('x')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/flowHooks.test.js`
Expected: FAIL (`keepHealth` is not a function).

- [ ] **Step 3: `keepHealth` in `src/game/flowHooks.js`.** Add to the returned object:

```js
    // The survival arena (Plan 7H-2) keeps Batman's health between its waves.
    keepHealth(id) {
      for (let i = 0; i < list.length; i++) if (list[i].keepHealth?.(id)) return true;
      return false;
    },
```
In `src/postgame/afterParty.js`, add the same to its `flowHooks` object, over its systems:

```js
      keepHealth(id) { for (let i = 0; i < systems.length; i++) if (systems[i].keepHealth?.(id)) return true; return false; },
```
and in `page()`, list only the pages a save has unlocked:

```js
        pages: pages.filter((x) => !x.shown || x.shown(progress)).map((x) => ({ id: x.id, title: x.title })),
```

- [ ] **Step 4: The flow.** In `src/game/flow.js`:
  - the default side hooks gain `keepHealth: () => false` (3C's line becomes `const side = d.side ?? { holdStory: () => false, marker: () => null, onRespawn: () => null, keepHealth: () => false };`);
  - in the `fightDone` listener, replace `hero.health = hero.maxHealth;` and `hud.setHealth(1);` with:
```js
    if (!side.keepHealth?.(id)) { hero.health = hero.maxHealth; hud.setHealth(1); }
```
  - the `bossDefeated` listener becomes `events.on('bossDefeated', async ({ encore = false } = {}) => {` with `if (encore) return; // Joker's Encore (Plan 7H-2) ends itself` as its first line.

- [ ] **Step 5: The boss on patterns, `src/game/boss.js`.** Every number the fight used becomes a field of the pattern `P` (the story's values are exactly the old ones). Make these edits; if a quoted line reads differently after 4E, 5FG and 6D, find the line with the same job and make the same change there.
  - Imports: add `import { STORY_BOSS, TILE_COLS, TILE_ROWS, progressSteps, tilePattern, between, pickPattern } from './bossPatterns.js';` and delete the local `const TILE_COLS = 4, TILE_ROWS = 3;` and the `const WAVES = [ ... ];` block.
  - Inside `createBoss`, right after `const tmp = new THREE.Vector3();`:
```js
  // The fight's numbers (src/game/bossPatterns.js): the story fight, or Joker's Encore.
  let P = STORY_BOSS;
  let L = LINES;
  const lead = new THREE.Vector3();
```
  - Inside `createBoss`, every `LINES.` becomes `L.` (in `applyHit`, `startPhase`, `updateTiles`, the `throw` and `swing` cases and `update`). Leave the `VOICED` map on `LINES` (the recorded voice lines belong to the story fight).
  - `applyHit`: `if (hits >= 5) {` becomes `if (hits >= P.hitsToKnock) {`; `if (chains >= 3) finish();` becomes `if (chains >= P.chainsToWin) finish();`; `if (chainHits >= 3) {` becomes `if (chainHits >= P.chainHits) {`.
  - Replace `progress`:
```js
  const progress = () => {
    // 1 for the goon phase, one per gas cycle, one per counter chain.
    const p1 = phase > 1 ? 1 : wave / P.waves.length;
    return 1 - Math.min(1, (p1 + cycles + chains) / progressSteps(P));
  };
```
  - `spawnWave`: `WAVES[i]` becomes `P.waves[i]`.
  - `startPhase`: in phase 1, `buzzT = 5;` becomes `buzzT = P.buzzFirst;`; in phase 2, `throwT = 2;` becomes `throwT = P.firstThrow;`; in phase 3, after `chainHits = 0;` add `buzzT = between(P.phase3BuzzEvery, rng);`.
  - `updateTiles`: replace its first line (`if (phase !== 1) { ... return; }`) and its buzz block with:
```js
    const live = phase === 1 || (phase === 3 && P.tilesInPhase3);
    if (!live) { for (const t of tiles) { t.state = 'off'; t.m.visible = t.edge.visible = false; } return; }
    buzzT -= dt;
    if (buzzT <= 0) {
      buzzT = between(phase === 3 ? P.phase3BuzzEvery : P.buzzEvery, rng);
      const n = Math.round(between(P.tileCount, rng));
      for (const i of tilePattern(pickPattern(P, rng), n, rng)) { tiles[i].state = 'warn'; tiles[i].t = 0; }
      if (phase === 1) say(pick(L.phase1), 2.4);
    }
```
    and in the tile loop `if (t.t > 1.4)` becomes `if (t.t > P.warn)`, `if (t.t > 0.7)` becomes `if (t.t > P.shock)`. (Tiles were pushed row by row, so tile index `r * TILE_COLS + c` is what `tilePattern` returns.)
  - The `throw` case: `throwT = rng.range(2.4, 3.4);` becomes `throwT = between(P.throwGap, rng);`, and right after `throwGrenade(hero.pos);` add:
```js
          // Encore: sometimes a second gag lands where Batman is heading.
          if (P.doubleThrow && rng.chance(P.doubleThrow)) throwGrenade(lead.copy(hero.pos).addScaledVector(hero.vel, 0.9));
```
  - The `stunned` case: `if (joker.t > 3.6)` becomes `if (joker.t > P.stunTime)`.
  - `startSwing`: `* 0.85` becomes `* P.windupScale`.
  - In `update`: `if (defeatT > 0) { defeatT -= dt; if (defeatT <= 0) events.emit('bossDefeated'); }` becomes `if (defeatT > 0) { defeatT -= dt; if (defeatT <= 0) events.emit('bossDefeated', { encore: P.id !== 'story' }); }`; `if (waveT <= 0 && phase === 1) spawnWave(1);` becomes `if (waveT <= 0 && phase === 1) spawnWave(wave);`; the phase 1 wave step becomes:
```js
        if (left === 0 && goons.length) {
          if (wave + 1 < P.waves.length) { wave += 1; waveT = 1.2; goons = []; }
          else { wave = P.waves.length; startPhase(2); }
        }
```
    and `if (phase === 1 || phase === 2) updateTiles(dt);` becomes `if (phase >= 1 && phase <= 3) updateTiles(dt);`.
  - `begin()` becomes `begin(pattern = STORY_BOSS) {` with `P = pattern; L = pattern.lines ?? LINES;` as its first line.
  - `restart()`: `chains = Math.min(chains, 2);` becomes `chains = Math.min(chains, P.chainsToWin - 1);`.
  - Add to the returned object:
```js
    get pattern() { return P.id; },
    // Ends a fight without a winner (leaving Joker's Encore): goons, gas, tiles and the Joker go.
    stop() {
      phase = 0; defeatT = 0; waveT = 0;
      for (const g of spawned) despawn(g);
      spawned.length = 0;
      goons = [];
      for (const c of clouds) scene.remove(c.g);
      clouds.length = 0;
      for (const g of grenades) scene.remove(g.m);
      grenades.length = 0;
      for (const t of tiles) { t.state = 'off'; t.m.visible = t.edge.visible = false; }
      combat.setEnemies([]);
      speech = null;
      hud.speech(null);
      ch.root.visible = coat.mesh.visible = false;
      hud.bossBar(false);
    },
```
  The story fight draws its random tiles with a shuffle now instead of a sort, so the order of lit tiles differs; the counts and timings are the same.

- [ ] **Step 6: A dev handle.** In `src/game/game.js`, import `import { STORY_BOSS, ENCORE_BOSS } from './bossPatterns.js';` and add `bossPatterns: { STORY_BOSS, ENCORE_BOSS }` to the `api` object.

- [ ] **Step 7: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Scripted check: the story fight is unchanged, and the encore pattern runs.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t6.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.boss ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 8; i++) { if (G.comic.playing) G.comic.skip(); await new Promise((r) => setTimeout(r, 500)); } return [G.boss.pattern, G.boss.debug().phase, G.boss.debug().goons]; })()"},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 12 && G.boss.phase === 1; i++) { G.winFight(); await new Promise((r) => setTimeout(r, 800)); } return G.boss.phase; })()"},
 {"eval": "const G = window.__game; G.boss.debugFinish(); 'finish'", "wait": 2600},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 8; i++) { if (G.comic.playing) G.comic.skip(); await new Promise((r) => setTimeout(r, 500)); } return G.flow.objectives.step?.id; })()"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=boss&god=1&new=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t6.json")"
cat > "$TEMP/g7b-t6e.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: -62, y: 58, z: -147 }, Math.PI); G.follow.snapBehind(Math.PI, 0.2); G.boss.begin(G.bossPatterns.ENCORE_BOSS); 'encore'", "wait": 5500},
 {"eval": "const G = window.__game; [G.boss.pattern, G.boss.phase, G.boss.debug().goons, document.querySelector('.hud-speech')?.textContent ?? null]"},
 {"shot": "t6-encore-floor"},
 {"eval": "const G = window.__game; G.boss.stop(); [G.boss.active, G.enemies.length]"},
 {"eval": "const G = window.__game; G.__def = []; G.events.on('bossDefeated', (d) => G.__def.push(d)); G.boss.begin(G.bossPatterns.ENCORE_BOSS); G.boss.debugFinish(); 'finish'", "wait": 2600},
 {"eval": "const G = window.__game; [JSON.stringify(G.__def), G.flow.mode, G.flow.objectives.step?.id, G.comic.playing]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t6e.json")"
```

Expected: the story fight starts as `["story", 1, 4]`, the two goon waves clear into phase 2, and after the finish the flow moves on to `finale` exactly as before. The encore starts with 5 goons and an encore line in the speech balloon (`["encore", 1, 5, "You came back! ..."]`); `t6-encore-floor.png` (5.5 s in, past the 3 s first buzz) shows lit tiles in one of the new shapes. `stop()` leaves `[false, 0]`. Finishing the encore sends `[{"encore":true}]`, and the flow stays in free roam: `play`, `credits`, no comic. `no console errors` in both runs.

- [ ] **Step 9: Commit**

```bash
git add src/game/boss.js src/game/flow.js src/game/flowHooks.js src/postgame/afterParty.js src/game/game.js tests/unit/flowHooks.test.js
git commit -m "The boss fight runs a pattern (story unchanged, encore ready), ends itself for the encore, and survival keeps health"
```

---

### Task 7: The challenge runner: extra pillars and the stop hook

**Files:**
- Modify: `src/game/challengeRunner.js`, `src/game/sideContent.js` (3C)

**Interfaces:**
- Consumes: 3C's `createChallengeRunner` internals (`pillars`, `kinds`, `respawnAt`, `finish`, `fail`, `end`, `checkPillars`), `pillarPos`, `createPillar`.
- Produces: `runner.addChallenge(ch, { shown })`, `runner.extras`, `runner.finish(value, { respawn })`, the kind hook `stop(run, reason)`; survival challenges on the Challenges page and gated like the arena.

- [ ] **Step 1: The runner, `src/game/challengeRunner.js`.**
  - After `const pillars = CHALLENGES.map(...)` add `const extras = [];`.
  - In `checkPillars`, replace `p.mesh.visible = !hide;` with:
```js
      const vis = !hide && (!p.shown || p.shown());
      p.mesh.visible = vis;
```
    and in the same loop change the start test's `if (!hide && Math.hypot(` to `if (vis && Math.hypot(`.
  - `function finish(value) {` becomes `function finish(value, { respawn = false } = {}) {`, and after its `end();` add `if (respawn) respawnAt = { ...ch.start };` (a survival run that ended with a knockout sends Batman back to its pillar after the death comic).
  - The knockout listener becomes:
```js
  events.on('heroDown', () => { if (run && !kinds[run.ch.kind]?.stop?.(run, 'down')) fail('down'); });
```
  - In the returned object: `start(id)` looks in both lists (`const ch = CHALLENGES.find((c) => c.id === id) ?? extras.find((c) => c.id === id);`), `quit()` becomes `quit() { if (run && kinds[run.ch.kind]?.stop?.(run, 'quit')) return; fail('quit'); },`, and add:
```js
    // Plan 7H-2: a challenge that isn't in CHALLENGES (the survival arena), with its own pillar.
    addChallenge(ch, { shown = () => true } = {}) {
      const at = pillarPos(ch);
      const mesh = createPillar();
      mesh.position.set(at.x, at.y, at.z);
      scene.add(mesh);
      const p = { ch, at, mesh, shown };
      pillars.push(p);
      extras.push(ch);
      return p;
    },
    get extras() { return extras; },
```
  Extra challenges stay out of `CHALLENGES`, so `allGold` (the Gold Standard page) and the base "Challenge medals" row are unchanged.

- [ ] **Step 2: Side content, `src/game/sideContent.js`.**
  - In the runner's `canStart`, the arena's rule also covers survival: `(ch.kind !== 'arena' || !encounters.id || isCrimeId(encounters.id))` becomes `((ch.kind !== 'arena' && ch.kind !== 'survival') || !encounters.id || isCrimeId(encounters.id))`.
  - In `challengesPage`, list the extras whose pillar is showing after the story challenges: `list: CHALLENGES.map(...)` becomes `list: [...CHALLENGES, ...challenges.pillars.filter((p) => p.shown && p.shown()).map((p) => p.ch)].map(...)` (same row function).

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted check with a throwaway survival challenge.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t7.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.side?.challenges ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "const R = window.__game.side.challenges; R.addChallenge({ id: 'testSurvival', name: 'Test Survival', kind: 'survival', blurb: 'Test.', start: { x: 6, y: 42, z: 16, yaw: 0 }, medals: { gold: 3, silver: 2, bronze: 1 } }); R.registerKind('survival', { begin() {}, update() {}, end() {}, stop(run, reason) { R.finish(2, { respawn: reason === 'down' }); return true; } }); [R.extras.length, R.pillars.length]", "wait": 600},
 {"shot": "t7-pillar"},
 {"eval": "const R = window.__game.side.challenges; R.start('testSurvival'); 'started'", "wait": 3000},
 {"eval": "const R = window.__game.side.challenges; [R.running, R.current?.kind]"},
 {"eval": "window.__game.side.challenges.quit(); 'quit'", "wait": 500},
 {"eval": "const G = window.__game; [G.side.challenges.active, JSON.stringify(G.progress.challenges.testSurvival), document.querySelector('.side-toast.show .toast-text')?.textContent ?? null]"},
 {"eval": "const G = window.__game; G.side.challenges.start('testSurvival'); 'again'", "wait": 3000},
 {"eval": "const G = window.__game; G.hero.health = 1; G.combat.killHero(); 'down'", "wait": 200},
 {"eval": "JSON.stringify(window.__game.side.challenges.takeRespawn())"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t7.json")"
```

Expected: `[1, 6]` (one extra, five story pillars plus it) and `t7-pillar.png` shows a second bat pillar on the GCPD roof; after the countdown `[true, "survival"]`; quitting records the result through the kind's `stop`: `[false, "{\"best\":2,\"medal\":\"silver\"}", "Silver! 2 waves. New best!"]`; a knockout mid-run also finishes it, and `takeRespawn()` returns the pillar's start `{"x":6,"y":42,"z":16,"yaw":0}`. `no console errors`. (The test entry stays in this throwaway save only; `?new=1` starts clean next time.)

- [ ] **Step 5: Commit**

```bash
git add src/game/challengeRunner.js src/game/sideContent.js
git commit -m "Challenge runner: extra pillars for post-game challenges, a stop hook, and finishing with a respawn"
```

---

### Task 8: Sky targets in the batarang and the remote batarang

**Files:**
- Modify: `src/gadgets/gadgetSystem.js`, `src/gadgets/g/batarang.js`, `src/gadgets/g/remote.js` (5FG, and 6D's change to the batarang), `src/game/game.js`

**Interfaces:**
- Consumes: Task 2's `createSkyTargets`; 5FG's `sys.follow.lookDir(out)`, `sys.fx.batarang(from, getTarget(out) -> out, onHit)` (pooled), `sys.pose(clip, dur, timeScale)`, the remote handler's `pos` and `update`.
- Produces: `createGadgetSystem({ targets })`, `sys.targets`, `gadgets.targets`; the batarang throws at a sky target when no goon is in range; the remote batarang hits every sky target within 1.3 m of its flight; `window.__game.skyTargets`.

- [ ] **Step 1: The gadget system.** In `src/gadgets/gadgetSystem.js`, add `targets = null` to `createGadgetSystem`'s options, add `targets` to the `sys` object handlers receive, and add `targets` to the returned object.

- [ ] **Step 2: The batarang, `src/gadgets/g/batarang.js`.** Add at the top:

```js
import * as THREE from 'three';

const eye = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();

// No goon to throw at: a sky target (Plan 7H-2's Joker balloons) near the line of sight, if any.
function throwAtSky(sys) {
  const { hero } = sys;
  sys.follow.lookDir(dir);
  dir.normalize();
  eye.set(hero.pos.x, hero.pos.y + 1.6, hero.pos.z);
  const hit = sys.targets.aimed(eye, dir, { range: 40, maxAngle: 0.3 });
  if (!hit) return false;
  const { provider, item } = hit;
  hero.bat.face(Math.atan2(item.pos.x - hero.pos.x, item.pos.z - hero.pos.z));
  hero.bat.bone('hand_r').getWorldPosition(hand);
  sys.fx.batarang(hand, (out) => out.set(item.pos.x, item.pos.y, item.pos.z), () => { if (item.alive) provider.hit(item, 'batarang'); });
  sys.pose('OverhandThrow', 0.45, 1.9);
  sys.events.emit('batarangThrow', { count: 1, sky: true });
  return true;
}
```
and in `fire`, right after the line that picks `first` with `selectTarget(...)`, add:

```js
      if (!first && sys.targets && throwAtSky(sys)) return true;
```
(before 6D's wall throw and before the handler's `if (!first) return false;`, so a balloon in view wins over a wall clang, and goons always win over balloons).

- [ ] **Step 3: The remote batarang, `src/gadgets/g/remote.js`.** Inside `createRemoteHandler`, next to `const smashGlass = ...`, add `const popSky = (p, it) => p.hit(it, 'remote');`, and in `update`, right after `sys.breakables.forNear(pos, 0.9, 'glass', smashGlass);`, add:

```js
      sys.targets?.forNear(pos, 1.3, popSky);
```

- [ ] **Step 4: Wire it in `src/game/game.js`.** Import `import { createSkyTargets } from '../gadgets/skyTargets.js';`. Early in `buildRun`, right after `const fx = createFx(scene);`, add `const skyTargets = createSkyTargets();` (early, so every later part of `buildRun` can use it whatever order the merges left the gadget and side-content blocks in), and pass `targets: skyTargets` into `createGadgetSystem({...})`. Add `skyTargets` to the `api` object.

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run`
Expected: PASS, including 5FG's `gadgetSystem.test.js` (the new option defaults to `null`) and 6D's `batarangWall.test.js`.

- [ ] **Step 6: Scripted check with a test target.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t8.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.skyTargets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"wait": 1200},
 {"eval": "const G = window.__game, h = G.hero.pos; G.__hits = []; G.__it = { pos: { x: h.x, y: h.y + 6, z: h.z - 14 }, alive: true }; G.skyTargets.add({ items: [G.__it], hit: (i, how) => { i.alive = false; G.__hits.push(how); } }); G.gadgets.equip('batarang'); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, -0.4); 'up and ahead'", "wait": 500},
 {"press": "KeyR", "wait": 1500},
 {"eval": "JSON.stringify(window.__game.__hits)"},
 {"eval": "const G = window.__game, h = G.hero.pos; G.__it2 = { pos: { x: h.x, y: h.y + 1.4, z: h.z - 9 }, alive: true }; G.skyTargets.add({ items: [G.__it2], hit: (i, how) => { i.alive = false; G.__hits.push(how); } }); G.gadgets.equip('remote'); G.gadgets.state.tick(10); G.follow.snapBehind(Math.PI, 0.05); 'level'", "wait": 500},
 {"press": "KeyR", "wait": 2500},
 {"eval": "JSON.stringify(window.__game.__hits)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1&gadgets=all" "$TEMP/g7b" "$(cat "$TEMP/g7b-t8.json")"
```

Expected: `["batarang"]` (the batarang flew up to the target), then `["batarang","remote"]` (the remote batarang flew through the second). `no console errors`. If the first throw misses, print the camera's look direction (`G.follow.lookDir(new G.hero.pos.constructor())`) and flip the pitch's sign as 5FG's Task 14 describes.

- [ ] **Step 7: Commit**

```bash
git add src/gadgets/gadgetSystem.js src/gadgets/g/batarang.js src/gadgets/g/remote.js src/game/game.js
git commit -m "Gadgets can hit sky targets: the batarang aims at them with no goon in range, the remote batarang pops what it passes"
```

---

### Task 9: Props: Joker cards, cake bombs, the balloon army, and their warm-up

**Files:**
- Modify: `src/postgame/postProps.js` (7H-1)

**Interfaces:**
- Consumes: 7H-1's `once`, `canvasTex`, `addHullOutline`, `toonMaterial`, `createCake`, `LAYER_XRAY`, `PALETTE`, `createPostWarm`.
- Produces: `createJokerCard(face)`, `createCakeBomb()` (with `userData.spark`), `createArmyMeshes(n)` -> `{ group, bodies, cans }`; `createPostWarm()` gains one of each.

- [ ] **Step 1: Add to `src/postgame/postProps.js`** (after `createRoofPartyKit`):

```js
function cardFace(g, w, h, face) {
  g.fillStyle = '#f4f0e6';
  g.fillRect(0, 0, w, h);
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#6c3fa3';
  g.font = `${Math.round(w * 0.24)}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('J', w * 0.17, h * 0.1);
  g.save(); g.translate(w * 0.83, h * 0.9); g.rotate(Math.PI); g.fillText('J', 0, 0); g.restore();
  g.lineWidth = 4;
  if (face === 'bomb') {
    // A two layer cake with a lit fuse.
    g.fillStyle = '#ff9ec8';
    g.fillRect(w * 0.3, h * 0.42, w * 0.4, h * 0.12); g.strokeRect(w * 0.3, h * 0.42, w * 0.4, h * 0.12);
    g.fillStyle = '#f1d9c0';
    g.fillRect(w * 0.22, h * 0.54, w * 0.56, h * 0.16); g.strokeRect(w * 0.22, h * 0.54, w * 0.56, h * 0.16);
    g.beginPath(); g.moveTo(w * 0.5, h * 0.42); g.quadraticCurveTo(w * 0.56, h * 0.33, w * 0.63, h * 0.3); g.stroke();
    g.fillStyle = '#f2d24b';
    g.beginPath(); g.arc(w * 0.65, h * 0.28, w * 0.06, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#c8323c';
    g.font = `${Math.round(w * 0.16)}px Bangers, Impact, sans-serif`;
    g.fillText('BOOM?', w * 0.5, h * 0.82);
  } else {
    // The Joker's grin, and ENCORE.
    g.fillStyle = '#62c141';
    g.beginPath(); g.arc(w * 0.5, h * 0.38, w * 0.26, Math.PI, 0); g.fill(); g.stroke();
    g.fillStyle = '#f4f0e6';
    g.beginPath(); g.ellipse(w * 0.5, h * 0.44, w * 0.2, h * 0.14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.strokeStyle = '#c8323c';
    g.lineWidth = 6;
    g.beginPath(); g.arc(w * 0.5, h * 0.44, w * 0.13, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#6c3fa3';
    g.font = `${Math.round(w * 0.15)}px Bangers, Impact, sans-serif`;
    g.fillText('ENCORE!', w * 0.5, h * 0.8);
  }
}
function bandFace(g, w, h) {
  g.fillStyle = '#15151c';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#c8323c';
  g.font = `${Math.round(h * 0.8)}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let k = 0; k < 2; k++) g.fillText('TICK TOCK', w * (0.25 + k * 0.5), h * 0.55);
}
function grin(g, w, h) {
  g.fillStyle = '#6c3fa3';
  g.fillRect(0, 0, w, h);
  // Two faces, half a turn apart, so a slowly turning balloon always shows one.
  for (const cx of [w * 0.25, w * 0.75]) {
    g.fillStyle = '#f4f0e6';
    g.beginPath(); g.arc(cx - 7, h * 0.42, 4, 0, Math.PI * 2); g.arc(cx + 7, h * 0.42, 4, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#62c141';
    g.lineWidth = 4;
    g.beginPath(); g.arc(cx, h * 0.5, 12, 0.25, Math.PI - 0.25); g.stroke();
  }
}

// A giant Joker playing card standing on its origin (the start of a cake bomb run, or the encore).
export function createJokerCard(face = 'bomb') {
  const g = new THREE.Group();
  const geo = once('cardGeo', () => new THREE.BoxGeometry(1.3, 2, 0.06).translate(0, 1.15, 0));
  const card = new THREE.Mesh(geo, once(`card:${face}`, () => toonMaterial({ map: canvasTex(128, 192, (x, w, h) => cardFace(x, w, h, face)), emissive: 0x201430 })));
  card.castShadow = true;
  addHullOutline(card, 0.02);
  const xray = new THREE.Mesh(geo, xrayMat());
  xray.layers.set(LAYER_XRAY);
  g.add(card, xray);
  return g;
}

// A birthday cake with a black TICK TOCK band and a fuse; userData.spark flickers while it burns.
export function createCakeBomb() {
  const g = new THREE.Group();
  const cake = createCake();
  cake.scale.setScalar(0.75);
  const top = cake.userData.top * 0.75;
  const band = new THREE.Mesh(
    once('bandGeo', () => new THREE.CylinderGeometry(0.93, 0.93, 0.2, 32, 1, true).translate(0, 0.35, 0)),
    once('bandMat', () => toonMaterial({ map: canvasTex(256, 32, bandFace), side: THREE.DoubleSide })),
  );
  const fuse = new THREE.Mesh(once('fuseGeo', () => new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6).translate(0, 0.25, 0)), once('fuseMat', () => toonMaterial({ color: PALETTE.ink })));
  fuse.position.y = top;
  fuse.rotation.z = 0.35;
  const spark = new THREE.Mesh(once('sparkGeo', () => new THREE.SphereGeometry(0.08, 8, 6)), once('sparkMat', () => new THREE.MeshBasicMaterial({ color: 0xffc36a })));
  spark.position.set(-Math.sin(0.35) * 0.5, top + Math.cos(0.35) * 0.5, 0);
  spark.visible = false;
  g.add(cake, band, fuse, spark);
  g.userData.spark = spark;
  return g;
}

// The balloon army as two instanced meshes: purple grinning balloons and green spray cans.
export function createArmyMeshes(n) {
  const group = new THREE.Group();
  const bodyGeo = once('armyBody', () => new THREE.SphereGeometry(0.75, 16, 12).scale(1, 1.2, 1));
  const canGeo = once('armyCan', () => new THREE.CylinderGeometry(0.14, 0.14, 0.42, 10));
  const bodies = new THREE.InstancedMesh(bodyGeo, once('armyBodyMat', () => toonMaterial({ map: canvasTex(128, 64, grin), emissive: 0x1c0c2c })), n);
  const cans = new THREE.InstancedMesh(canGeo, once('armyCanMat', () => toonMaterial({ color: PALETTE.jokerGreen })), n);
  for (const m of [bodies, cans]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
  group.add(bodies, cans);
  return { group, bodies, cans };
}
```
In `createPostWarm()`, before `return g;`, add:

```js
  add(createJokerCard('bomb'), 24);
  add(createJokerCard('encore'), 26);
  add(createCakeBomb(), 28);
  // A new InstancedMesh starts with identity matrices, so both copies draw here and the instanced
  // shader variant compiles at boot.
  const army = createArmyMeshes(2);
  army.group.position.set(90, -50, 0);
  g.add(army.group);
```

- [ ] **Step 2: Boot check.** Run `npx vitest run` (PASS). Build, preview, and:

```bash
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b" '[{"wait":2500},{"shot":"t9-boot"}]'
node scripts/load-time.mjs http://localhost:5213/ 40 1
```
Expected: `no console errors`; `firstFrame` under 3.2 s, `compiled` within 30 ms of 7H-1's last run.

- [ ] **Step 3: Commit**

```bash
git add src/postgame/postProps.js
git commit -m "Post-game props: Joker cards, the cake bomb, the instanced balloon army, warmed at boot"
```

---

### Task 10: The defuse HUD: fuse timer and counter dial

**Files:**
- Create: `src/ui/defuseHud.js`
- Modify: `src/ui/style.css`
- Test: `tests/unit/defuseHud.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: `arcPath(mark, window, r)`, `createDefuseHud(root)` (see Shared interfaces).

- [ ] **Step 1: Write the failing test.** Create `tests/unit/defuseHud.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { arcPath } from '../../src/ui/defuseHud.js';

describe('the defuse dial', () => {
  it('draws the green window as a wedge around the mark, clockwise from the top', () => {
    expect(arcPath(0.25, 0.5, 10)).toBe('M 0 0 L 0.00 -10.00 A 10 10 0 0 1 0.00 10.00 Z');
    expect(arcPath(0, 0.2, 44)).toBe('M 0 0 L -25.86 -35.60 A 44 44 0 0 1 25.86 -35.60 Z');
    expect(arcPath(0.5, 0.1)).toBe('M 0 0 L 13.60 41.85 A 44 44 0 0 1 -13.60 41.85 Z');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/defuseHud.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/ui/defuseHud.js`**

```js
// The cake bomb HUD: a big comic fuse timer while a bomb is lit, and the counter dial for the
// defuse (a green window, a sweeping needle, one pip per hit). Everything is written only when it
// changes, except the needle, which is one transform attribute per frame while the dial is up.
const R = 44;

// An SVG wedge from the dial's center covering `window` of a turn around `mark` (0 is the top,
// clockwise, like the needle).
export function arcPath(mark, window, r = R) {
  const a0 = (mark - window / 2) * Math.PI * 2 - Math.PI / 2;
  const a1 = (mark + window / 2) * Math.PI * 2 - Math.PI / 2;
  const f = (v) => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);
  return `M 0 0 L ${f(Math.cos(a0) * r)} ${f(Math.sin(a0) * r)} A ${r} ${r} 0 0 1 ${f(Math.cos(a1) * r)} ${f(Math.sin(a1) * r)} Z`;
}

export function createDefuseHud(root) {
  const el = document.createElement('div');
  el.className = 'defuse-hud';
  el.innerHTML = `
    <div class="dh-fuse"><svg viewBox="-12 -12 24 24"><circle cx="-2" cy="3" r="7"/><path class="wick" d="M3 -2 Q6 -8 9 -9"/></svg><span class="dh-time"></span></div>
    <div class="dh-dial">
      <svg viewBox="-52 -52 104 104"><circle class="face" r="${R}"/><path class="win"/><line class="needle" x1="0" y1="0" x2="0" y2="-40"/><circle class="hub" r="4"/></svg>
      <div class="dh-pips"></div><div class="dh-tip">Counter in the green!</div>
    </div>`;
  root.appendChild(el);
  const fuseEl = el.querySelector('.dh-fuse'), timeEl = el.querySelector('.dh-time');
  const dialEl = el.querySelector('.dh-dial'), winEl = el.querySelector('.win'), needleEl = el.querySelector('.needle'), pipsEl = el.querySelector('.dh-pips');
  let text = '', urgent = false, fuseOn = false, dialOn = false, markShown = -1, gotShown = -1, needShown = -1, deg = -1, flashT = 0;
  return {
    fuse(t, u) {
      if (!fuseOn) { fuseOn = true; fuseEl.classList.add('show'); }
      if (t !== text) { text = t; timeEl.textContent = t; }
      if (u !== urgent) { urgent = u; fuseEl.classList.toggle('urgent', u); }
    },
    hideFuse() { if (fuseOn) { fuseOn = false; fuseEl.classList.remove('show'); } text = ''; },
    dial(needle, mark, window, got, need) {
      if (!dialOn) { dialOn = true; dialEl.classList.add('show'); }
      if (mark !== markShown) { markShown = mark; winEl.setAttribute('d', arcPath(mark, window)); }
      if (got !== gotShown || need !== needShown) {
        gotShown = got;
        needShown = need;
        pipsEl.innerHTML = Array.from({ length: need }, (_, i) => `<i class="${i < got ? 'on' : ''}"></i>`).join('');
      }
      const d = Math.round(needle * 720) / 2;
      if (d !== deg) { deg = d; needleEl.setAttribute('transform', `rotate(${d})`); }
    },
    hideDial() { if (dialOn) { dialOn = false; dialEl.classList.remove('show'); } markShown = -1; gotShown = -1; },
    flash(kind) {
      dialEl.classList.remove('hit', 'miss');
      void dialEl.offsetWidth;
      dialEl.classList.add(kind);
      clearTimeout(flashT);
      flashT = setTimeout(() => dialEl.classList.remove(kind), 260);
    },
  };
}
```

- [ ] **Step 4: Styles.** Append to `src/ui/style.css`:

```css
.defuse-hud .dh-fuse { position: absolute; top: 18px; left: 50%; transform: translateX(-50%) rotate(-1deg); display: none; align-items: center; gap: 8px; padding: 4px 14px; background: #fff8e6; border: 4px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); }
.defuse-hud .dh-fuse.show { display: flex; }
.dh-fuse svg { width: 34px; height: 34px; overflow: visible; }
.dh-fuse svg circle { fill: #ff9ec8; stroke: var(--ink); stroke-width: 1.6; }
.dh-fuse svg .wick { fill: none; stroke: var(--ink); stroke-width: 1.6; }
.dh-time { font: 400 40px Bangers, Impact, sans-serif; letter-spacing: 2px; color: var(--ink); }
.dh-fuse.urgent { animation: dh-pulse 0.5s steps(2) infinite; }
.dh-fuse.urgent .dh-time { color: #c8323c; }
@keyframes dh-pulse { 50% { transform: translateX(-50%) rotate(1deg) scale(1.06); } }
.defuse-hud .dh-dial { position: absolute; left: 50%; top: 58%; width: 190px; transform: translate(-50%, -50%); display: none; text-align: center; }
.defuse-hud .dh-dial.show { display: block; }
.dh-dial svg { width: 190px; height: 190px; overflow: visible; }
.dh-dial .face { fill: #fff8e6; stroke: var(--ink); stroke-width: 5; }
.dh-dial .win { fill: #62c141; stroke: var(--ink); stroke-width: 2; }
.dh-dial .needle { stroke: #c8323c; stroke-width: 5; stroke-linecap: round; }
.dh-dial .hub { fill: var(--ink); }
.dh-dial.hit .face { fill: #d9f5c9; }
.dh-dial.miss .face { fill: #f7c4c4; }
.dh-pips { display: flex; justify-content: center; gap: 6px; margin-top: 4px; }
.dh-pips i { width: 16px; height: 16px; border: 3px solid var(--ink); border-radius: 50%; background: #fff8e6; }
.dh-pips i.on { background: #f2d24b; }
.dh-tip { font: 18px 'Patrick Hand SC', cursive; color: #fff8e6; text-shadow: 2px 2px 0 var(--ink); }
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/defuseHud.test.js`
Expected: PASS. (The HUD itself is looked at in Task 11, where a bomb drives it.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/defuseHud.js src/ui/style.css tests/unit/defuseHud.test.js
git commit -m "Defuse HUD: a comic fuse timer and the counter dial"
```

---
### Task 11: Cake bombs at run time

**Files:**
- Create: `src/postgame/cakeBombs.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Task 1 (`BOMBS`, `BOMB_IDS`, `NEAR`, `NEAR_RATE`, `MISS_PENALTY`, `bombFightId`, `guardFight`, `nextLeg`, `createFuse`, `createDefuse`, `fuseText`, copy), Task 5 (`ENCORE_UNLOCKED`), Task 9 (`createJokerCard`, `createCakeBomb`), Task 10 (`createDefuseHud`); 7H-1's `post.add`, `isGuestFight`; `encounters.begin/trigger/end/id`, `combat.consumeInput`, `input.pressed('block')`, 5FG's `gfx.confetti.burst`, 3C's side HUD.
- Produces: `createCakeBombs(deps)` (see Shared interfaces); events `bombLit`, `defuseStart`, `defuseHit`, `defuseMiss`, `fuseTick`, `bombDefused`, `bombSplat`, `encoreUnlocked`, `missionDone { id: 'bomb:<id>' }` (500 XP); `window.__game.post.bombs`.

- [ ] **Step 1: Write `src/postgame/cakeBombs.js`**

```js
// Cake bombs at run time (data and rules in bombSpots.js). A Joker card stands where each bomb's
// run starts; touching it lights the fuse, and the waypoint follows the route (a glide and a
// zipline). Within 6 m of the bomb the fuse slows to a quarter and the defuse begins: beat the
// goons guarding it (an encounter), or time counters on the dial while Batman holds still. If the
// fuse runs out it is a big pink SPLAT and a retry from the card. All five unlock Joker's Encore.
import {
  BOMBS, BOMB_IDS, NEAR, NEAR_RATE, MISS_PENALTY, bombFightId, guardFight, nextLeg, createFuse, createDefuse, fuseText,
  BOMB_RADIO, DEFUSED, SPLAT,
} from './bombSpots.js';
import { ENCORE_UNLOCKED } from './encoreRules.js';
import { createJokerCard, createCakeBomb } from './postProps.js';

const CARD_R = 1.8, REARM = 4, URGENT = 6;

export function createCakeBombs({ scene, hero, events, encounters, combat, input, progress, save, ui, hud, gfx, defuseHud, rng, canStart }) {
  const items = BOMBS.map((b) => {
    const card = createJokerCard('bomb');
    card.position.set(b.start.x, b.start.y, b.start.z);
    card.rotation.y = b.start.yaw;
    scene.add(card);
    const cake = createCakeBomb();
    cake.position.set(b.at.x, b.at.y, b.at.z);
    scene.add(cake);
    return { b, card, cake, done: progress.bombs.includes(b.id), armed: true, hinted: false };
  });
  let run = null, shown = '', t = 0;
  // While the dial is up Batman stands still, and combat ignores the counter presses the dial reads.
  const hold = { name: 'defuse', combat: false, canChain: () => false, update: () => !!run && run.phase === 'counter' };

  function start(it) {
    it.armed = false;
    run = { it, b: it.b, fuse: createFuse(it.b.fuse), leg: 0, phase: 'run', game: null };
    shown = '';
    ui.radio('JOKER RADIO', BOMB_RADIO(it.b), 5500);
    ui.countdown('GO!');
    events.emit('bombLit', { id: it.b.id, fuse: it.b.fuse });
  }
  function cleanup() {
    if (!run) return;
    if (hero.control === hold) hero.control = null;
    if (encounters.id === bombFightId(run.b.id)) encounters.end();
    defuseHud.hideFuse();
    defuseHud.hideDial();
    run = null;
  }
  function beginDefuse() {
    if (run.b.defuse === 'counter') {
      run.phase = 'counter';
      run.game = createDefuse({ rng });
      hero.control = hold;
      events.emit('defuseStart', { id: run.b.id, kind: 'counter' });
    } else {
      run.phase = 'guard';
      encounters.begin(bombFightId(run.b.id), guardFight(run.b));
      encounters.trigger();
      ui.hint('A guard! Knock him out to defuse the cake.', 3000);
      events.emit('defuseStart', { id: run.b.id, kind: 'guard' });
    }
  }
  function defused() {
    const { it, b } = run;
    cleanup();
    it.done = true;
    if (!progress.bombs.includes(b.id)) progress.bombs.push(b.id);
    save();
    const n = progress.bombs.length;
    const c = DEFUSED(b, n);
    hud.card(c.title, c.text, 7000);
    gfx.confetti.burst(it.cake.position, 160);
    events.emit('word', { text: 'DEFUSED!', pos: it.cake.position.clone().setY(it.cake.position.y + 2), big: true });
    events.emit('bombDefused', { id: b.id, count: n });
    events.emit('missionDone', { id: bombFightId(b.id) });
    if (n >= BOMB_IDS.length) {
      events.emit('encoreUnlocked');
      setTimeout(() => hud.card(ENCORE_UNLOCKED.title, ENCORE_UNLOCKED.text, 8000), 7500);
    }
  }
  function boom() {
    const { it, b } = run;
    cleanup();
    gfx.confetti.burst(it.cake.position, 320);
    events.emit('word', { text: 'SPLAT!', pos: it.cake.position.clone().setY(it.cake.position.y + 1.5), big: true });
    ui.toast(SPLAT.title, SPLAT.text, 6000);
    events.emit('bombSplat', { id: b.id });
  }
  events.on('fightDone', ({ id }) => { if (run?.phase === 'guard' && id === bombFightId(run.b.id)) defused(); });

  function update(dt, real, on) {
    t += dt;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const lit = run?.it === it;
      it.card.visible = on && !it.done && !lit;
      it.cake.visible = on && !it.done;
      if (it.card.visible) it.card.rotation.y = it.b.start.yaw + Math.sin(t * 0.8 + i) * 0.35;
      it.cake.userData.spark.visible = lit && Math.sin(t * 40) > -0.3;
    }
    if (!on) { if (run) cleanup(); return; }
    if (hero.dead) return;
    if (!run) {
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.done) continue;
        const d = Math.hypot(it.b.start.x - hero.pos.x, it.b.start.y - hero.pos.y, it.b.start.z - hero.pos.z);
        if (d > REARM) { it.armed = true; it.hinted = false; }
        else if (it.armed && d < CARD_R) {
          if (canStart()) { start(it); break; }
          if (!it.hinted) { it.hinted = true; ui.hint('Not now. Finish what you are doing first.', 2500); }
        }
      }
      return;
    }
    const b = run.b;
    const near = Math.hypot(b.at.x - hero.pos.x, b.at.z - hero.pos.z) < NEAR && Math.abs(b.at.y - hero.pos.y) < 4;
    if (run.fuse.update(dt, near ? NEAR_RATE : 1) === 'boom') { boom(); return; }
    if (run.phase === 'run') {
      run.leg = nextLeg(b, run.leg, hero.pos);
      if (near) beginDefuse();
    } else if (run.phase === 'counter') {
      run.game.update(dt);
      if (input.pressed('block')) {
        combat.consumeInput('block');
        const r = run.game.press();
        if (r === 'miss') { run.fuse.cut(MISS_PENALTY); defuseHud.flash('miss'); events.emit('defuseMiss'); }
        else { defuseHud.flash('hit'); events.emit('defuseHit', { got: run.game.got }); }
        if (r === 'done') { defused(); return; }
      }
      defuseHud.dial(run.game.needle, run.game.mark, run.game.window, run.game.got, run.game.need);
    }
    const text = fuseText(run.fuse.left);
    if (text !== shown) {
      shown = text;
      const urgent = run.fuse.left < URGENT;
      defuseHud.fuse(text, urgent);
      if (urgent) events.emit('fuseTick');
    }
  }

  return {
    items,
    update,
    busy: () => !!run,
    // The waypoint follows the route while the fuse burns, then the bomb.
    marker() {
      if (!run || run.phase !== 'run') return null;
      return run.leg < run.b.legs.length ? run.b.legs[run.leg].to : run.b.at;
    },
    onRespawn() { if (run) cleanup(); return null; },
    // Dev hooks and scripted play.
    light(id) { const it = items.find((x) => x.b.id === id); if (!it || it.done || run) return false; start(it); return true; },
    setFuse(sec) { if (run) run.fuse.cut(run.fuse.left - sec); },
    get debug() {
      return run ? { id: run.b.id, phase: run.phase, leg: run.leg, left: +run.fuse.left.toFixed(1), got: run.game?.got ?? 0 } : null;
    },
  };
}
```

- [ ] **Step 2: Wire it in `src/game/game.js`.** Imports:

```js
import { createCakeBombs } from '../postgame/cakeBombs.js';
import { createDefuseHud } from '../ui/defuseHud.js';
import { isGuestFight } from '../postgame/guests.js';
```
After 7H-1's `post.guests = ...` add:

```js
    const defuseHud = createDefuseHud(hudRoot.querySelector('.hud') ?? hudRoot);
    // A waiting guest squad nearby is fine (it steps aside while a bomb runs); a crime or a fight is not.
    const postCanStart = () => flow.mode === 'play' && !hero.dead && !combat.active && !side.challenges.active && !post.busy()
      && (!encounters.id || isGuestFight(encounters.id));
    post.bombs = post.add(createCakeBombs({
      scene, hero, events, encounters, combat, input, progress, ui: side.ui, hud, gfx, defuseHud, rng,
      save: () => saveProgress(storage, progress), canStart: postCanStart,
    }));
```
(7H-1's guests already step aside: their `canHold` is `!side.challenges.active && !post.busy()`, so a squad waiting near a card is taken down the moment a bomb is lit.)

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t11.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.bombs ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"wait": 1200},
 {"eval": "const G = window.__game; G.__log = []; for (const n of ['bombLit', 'defuseStart', 'defuseHit', 'defuseMiss', 'bombDefused', 'bombSplat', 'missionDone', 'encoreUnlocked']) G.events.on(n, (d) => G.__log.push([n, d?.id ?? d?.kind ?? d?.got ?? ''])); G.hero.teleport({ x: -10, y: 42, z: 18 }, -0.45); G.follow.snapBehind(-0.45, 0.1); 'card'", "wait": 900},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.bombs.debug), JSON.stringify(G.post.bombs.marker())]"},
 {"shot": "t11-lit"},
 {"eval": "const G = window.__game; G.teleport({ x: -56, y: 22, z: 114 }); 'first leg'", "wait": 600},
 {"eval": "window.__game.post.bombs.debug.leg"},
 {"eval": "const G = window.__game; G.teleport({ x: -123, y: 15, z: 124 }); 'at the bomb'", "wait": 1200},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.bombs.debug), G.enemies.filter((e) => e.alive).map((e) => e.type)]"},
 {"shot": "t11-guard"},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 12 && G.post.bombs.debug; i++) { G.winFight(); await new Promise((r) => setTimeout(r, 700)); } return [G.progress.bombs, document.querySelector('.hud-card .card-title')?.textContent ?? null]; })()"},
 {"shot": "t11-defused"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 184, y: 38, z: -14 }, -1.4); 'neon card'", "wait": 800},
 {"eval": "const G = window.__game; G.teleport({ x: 126, y: 22, z: 50 }); 'at the bar bomb'", "wait": 1200},
 {"eval": "JSON.stringify(window.__game.post.bombs.debug)"},
 {"shot": "t11-dial"},
 {"click": 2, "wait": 150},
 {"eval": "JSON.stringify(window.__game.post.bombs.debug)"},
 {"eval": "const G = window.__game; G.post.bombs.setFuse(1); 'let the Neon fuse run out'", "wait": 5500},
 {"eval": "const G = window.__game; [G.post.bombs.debug, G.hero.control?.name ?? null]"},
 {"eval": "const G = window.__game; G.post.bombs.light('bombAce'); G.post.bombs.setFuse(1); 'short fuse'", "wait": 1800},
 {"eval": "const G = window.__game; [G.post.bombs.debug, document.querySelector('.side-toast.show .toast-title')?.textContent ?? null, G.progress.bombs.includes('bombAce')]"},
 {"shot": "t11-splat"},
 {"eval": "JSON.stringify(window.__game.__log)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t11.json")"
```

Expected, in order:
- Standing on the GCPD card lights the Docks bomb: `{"id":"bombDocks","phase":"run","leg":0,"left":2x.x,...}` and the waypoint points at the cold storage roof (`{"x":-56,"y":22,"z":114}`); `t11-lit.png` shows the fuse timer at the top of the screen, the radio line and the waypoint.
- Reaching the first leg's end moves the waypoint on (`1`).
- At the bomb the guard fight starts: phase `guard`, a brute and two grunts; `t11-guard.png` shows them around the cake bomb with its spark.
- Winning defuses it: `[["bombDocks"], "DEFUSED!"]`, and `t11-defused.png` shows confetti and the card.
- At the Neon bomb the dial opens: phase `counter`; `t11-dial.png` shows the dial with its green window and four empty pips over the scene. One right-click lands a `defuseHit` or a `defuseMiss` (the debug `got` or `left` changes accordingly). (Timing a real defuse is left to a person at the keys; the dial's logic is covered by Task 1's tests.)
- Cutting the Neon fuse to 1 s at the dial (where it burns at a quarter speed, so about 4 s) ends in a SPLAT and hands Batman back: `[null, null]`.
- The Ace bomb lit from anywhere with a 1 s fuse goes off: `[null, "SPLAT!", false]`, and `t11-splat.png` shows the pink burst and the SPLAT toast.
- The log shows `bombLit`, `defuseStart guard`, `bombDefused bombDocks`, `missionDone bomb:bombDocks`, `bombLit bombNeon`, `defuseStart counter`, a hit or miss, `bombSplat bombNeon`, `bombLit bombAce`, `bombSplat bombAce`.
- `no console errors`.


- [ ] **Step 5: Commit**

```bash
git add src/postgame/cakeBombs.js src/game/game.js
git commit -m "Cake bombs at run time: Joker cards, fuses, the route waypoint, guard fights, the counter dial and the SPLAT"
```

---

### Task 12: The balloon army at run time

**Files:**
- Create: `src/postgame/armyRun.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Task 2 (`ARMY`, `ARMY_SIZE`, `ARMY_CENTER`, `ARMY_RANGE`, `armyPos`, `sprays`, copy, `skyTargets`), Task 8 (the gadgets read `skyTargets`), Task 9 (`createArmyMeshes`); 5FG's `gfx.confetti.burst`, `gfx.debris.burst(center, color, count, speed)`.
- Produces: `createBalloonArmy(deps)` (see Shared interfaces); events `armyNear`, `armyPop`, `armyCleared`, `missionDone { id: 'army' }`; `window.__game.post.army`.

- [ ] **Step 1: Write `src/postgame/armyRun.js`**

```js
// The Balloon Army at run time (paths in balloonArmy.js): sixteen instanced Joker balloons with
// spray cans over Neon Row, animated only while Batman is within 220 m. They are sky targets
// (src/gadgets/skyTargets.js), so the batarang aims at them when no goon is in range and the
// remote batarang pops every one it flies through. Popped balloons are saved.
import * as THREE from 'three';
import { ARMY, ARMY_SIZE, ARMY_CENTER, ARMY_RANGE, armyPos, sprays, ARMY_RADIO, ARMY_DONE } from './balloonArmy.js';
import { createArmyMeshes } from './postProps.js';
import { PALETTE } from '../config/palette.js';

const RADIO_R = 160, SPRAY_R = 120, CAN_DROP = 1.35;

export function createBalloonArmy({ scene, hero, events, progress, save, ui, hud, gfx, targets }) {
  const meshes = createArmyMeshes(ARMY_SIZE);
  meshes.group.visible = false;
  scene.add(meshes.group);
  // `alive` is what the gadgets see: a balloon is a target only while the army is showing.
  const items = ARMY.map((b) => ({ b, pos: { x: b.x, y: b.y, z: b.z }, popped: progress.army.includes(b.i), alive: false }));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  const gone = new THREE.Vector3(0, 0, 0), up = new THREE.Vector3(0, 1, 0), drip = new THREE.Vector3();
  let t = 0, told = false, shown = false;

  function write(i) {
    const it = items[i];
    if (it.popped) {
      m4.compose(p.set(0, -1000, 0), q.identity(), gone);
      meshes.bodies.setMatrixAt(i, m4);
      meshes.cans.setMatrixAt(i, m4);
      return;
    }
    q.setFromAxisAngle(up, Math.sin(t * 0.9 + it.b.phase) * 0.6);
    meshes.bodies.setMatrixAt(i, m4.compose(p.set(it.pos.x, it.pos.y, it.pos.z), q, one));
    meshes.cans.setMatrixAt(i, m4.compose(p.set(it.pos.x, it.pos.y - CAN_DROP, it.pos.z), q, one));
  }
  for (let i = 0; i < items.length; i++) { armyPos(items[i].b, 0, items[i].pos); write(i); }

  function pop(it, how) {
    if (it.popped) return;
    it.popped = true;
    it.alive = false;
    write(items.indexOf(it));
    meshes.bodies.instanceMatrix.needsUpdate = true;
    meshes.cans.instanceMatrix.needsUpdate = true;
    if (!progress.army.includes(it.b.i)) progress.army.push(it.b.i);
    save();
    const n = progress.army.length;
    const at = new THREE.Vector3(it.pos.x, it.pos.y, it.pos.z);
    gfx.confetti.burst(at, 60);
    gfx.debris.burst(drip.set(it.pos.x, it.pos.y - CAN_DROP, it.pos.z), PALETTE.jokerGreen, 6, 3);
    events.emit('word', { text: 'POP!', pos: at.setY(at.y + 1), big: false });
    events.emit('armyPop', { index: it.b.i, count: n, how });
    if (n >= ARMY_SIZE) {
      hud.card(ARMY_DONE.title, ARMY_DONE.text, 7500);
      events.emit('armyCleared');
      events.emit('missionDone', { id: 'army' });
    }
  }
  targets.add({ items, hit: pop });

  function update(dt, real, on) {
    const d = Math.hypot(hero.pos.x - ARMY_CENTER.x, hero.pos.z - ARMY_CENTER.z);
    const show = on && d < ARMY_RANGE && progress.army.length < ARMY_SIZE;
    if (show !== shown) {
      shown = show;
      meshes.group.visible = show;
      for (const it of items) it.alive = show && !it.popped;
    }
    if (!show) return;
    t += dt;
    if (!told && d < RADIO_R) { told = true; ui.radio(ARMY_RADIO.title, ARMY_RADIO.text, 7000); events.emit('armyNear'); }
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.popped) continue;
      armyPos(it.b, t, it.pos);
      if (d < SPRAY_R && sprays(it.b, t, dt)) gfx.debris.burst(drip.set(it.pos.x, it.pos.y - CAN_DROP - 0.3, it.pos.z), PALETTE.jokerGreen, 4, 1.5);
      write(i);
    }
    meshes.bodies.instanceMatrix.needsUpdate = true;
    meshes.cans.instanceMatrix.needsUpdate = true;
  }

  return {
    items,
    update,
    // Dev hooks and scripted play.
    pop(i) { const it = items[i]; if (it && !it.popped) pop(it, 'dev'); return !!it; },
    popAll() { for (const it of items) if (!it.popped) pop(it, 'dev'); },
    get debug() { let left = 0; for (const it of items) if (!it.popped) left += 1; return { shown, left, t: +t.toFixed(1) }; },
  };
}
```

- [ ] **Step 2: Wire it in `src/game/game.js`.** Import `import { createBalloonArmy } from '../postgame/armyRun.js';` and after `post.bombs = ...` add:

```js
    post.army = post.add(createBalloonArmy({
      scene, hero, events, progress, ui: side.ui, hud, gfx, targets: skyTargets,
      save: () => saveProgress(storage, progress),
    }));
```

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t12.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.army ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "const G = window.__game; G.__pops = []; G.events.on('armyPop', (d) => G.__pops.push(d.how)); G.gadgets.equip('batarang'); G.teleport({ x: 150, y: 0, z: -40 }); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, -0.45); 'under the army'", "wait": 2500},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.army.debug), G.skyTargets.count, document.querySelector('.radio.show .radio-title')?.textContent ?? null]"},
 {"shot": "t12-army"},
 {"eval": "const G = window.__game, d = new G.hero.pos.constructor(); G.follow.lookDir(d); d.normalize(); const e = { x: G.hero.pos.x, y: G.hero.pos.y + 1.6, z: G.hero.pos.z }; const h = G.skyTargets.aimed(e, d); h ? G.post.army.items.indexOf(h.item) : null"},
 {"press": "KeyR", "wait": 1600},
 {"press": "KeyR", "wait": 1600},
 {"eval": "const G = window.__game; [JSON.stringify(G.__pops), G.progress.army.length]"},
 {"shot": "t12-pop"},
 {"eval": "const G = window.__game; G.post.army.popAll(); [G.progress.army.length, document.querySelector('.hud-card .card-title')?.textContent ?? null, G.post.army.debug.shown, G.skyTargets.count]", "wait": 600},
 {"shot": "t12-clean"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1&gadgets=all" "$TEMP/g7b" "$(cat "$TEMP/g7b-t12.json")"
```

Expected:
- Under the army: `{"shown":true,"left":16,...}`, `16` sky targets, and the `JOKER RADIO` call; `t12-army.png` shows purple grinning balloons with green cans drifting over Neon Row, above the bunting, with green drips now and then.
- The aim check prints a balloon index (a balloon is within 17 degrees of the camera's view). If it prints `null`, the pitch sign is the other way or too shallow: try `snapBehind(Math.PI, 0.45)` or `-0.6` until it prints an index, and use that in the run.
- Two batarang throws pop two balloons (`["batarang","batarang"]`, `2`); `t12-pop.png` shows confetti and `POP!`. (The remote batarang popping sky targets was checked in Task 8; flying it through a balloon by hand is part of Task 16's person-at-the-keys pass.)
- `popAll` brings the count to 16, shows "NEON ROW IS CLEAN!", hides the army and leaves no sky targets (`[16, "NEON ROW IS CLEAN!", false, 0]`).
- `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/postgame/armyRun.js src/game/game.js
git commit -m "Balloon army at run time: sixteen instanced Joker balloons over Neon Row, popped by batarangs"
```

---

### Task 13: Joker's Encore at run time, and its comic pages

**Files:**
- Create: `src/postgame/encore.js`
- Modify: `src/postgame/postPages.js`, `src/ui/menus.js`, `src/game/game.js`

**Interfaces:**
- Consumes: Task 3 (`ENCORE_BOSS`), Task 5 (`ENCORE_CARD`, `ENCORE_START`, `ENCORE_PAGE`, `encoreUnlocked`, `encoreWon`, `ENCORE_QUIT`), Task 6 (`boss.begin(pattern)`, `boss.stop()`, `bossDefeated { encore }`), Task 9 (`createJokerCard`); 7H-1's `flow.playPages`, `post.addPage`, `titleCard`, `stage.shot` (with `setup` and `stage.boss.pose`).
- Produces: `createEncore(deps)` (see Shared interfaces), `encoreIntroPages(stage)`, `encorePages(stage)`; pause option `Leave the encore`; events `encoreStart`, `encoreWon`, `encoreQuit`, `missionDone { id: 'encore' }`; `window.__game.post.encore`.

- [ ] **Step 1: The pages.** Add to `src/postgame/postPages.js`:

```js
export function encoreIntroPages(stage) {
  return [{
    layout: 'duo',
    panels: [
      { img: titleCard("JOKER'S ENCORE", 'He saved his best tricks for last.') },
      {
        img: stage.shot({
          cam: [-54, 61.5, -136], look: [-62, 64, -160], fov: 52,
          hero: { at: [-62, 58, -147], yaw: Math.PI, anim: 'Idle_Loop' },
          setup: (s) => s.boss.pose([-62, 68, -161.7], 0, 'Idle_Rail_Call'),
        }),
        caption: '"You came back! Nobody leaves before the encore!"', captionPos: 'bottom',
      },
    ],
  }];
}

export function encorePages(stage) {
  return [{
    layout: 'duo',
    panels: [
      { img: titleCard('ENCORE! ENCORE!', `A gold medal for ${MANSI.name}.`) },
      {
        img: stage.shot({ cam: [-55, 60.5, -140], look: [-62, 59.2, -152], fov: 48, hero: { at: [-62, 58, -150], yaw: 0.4, anim: 'Yes' } }),
        caption: 'The Joker never got his bow. The crowd went home happy anyway.', captionPos: 'bottom',
      },
    ],
  }];
}
```

- [ ] **Step 2: Write `src/postgame/encore.js`**

```js
// Joker's Encore at run time. Once every cake bomb is defused, the Joker's card stands on the
// clock tower roof. Touching it plays the encore comic, puts Batman on the arena and starts the
// boss fight on ENCORE_BOSS (src/game/bossPatterns.js). A knockout restarts the current phase at
// the arena, like the story fight. Winning gives a gold medal, a best time, 500 XP and a new comic
// page (played right away, and readable again on the After the Party page).
import { ENCORE_BOSS } from '../game/bossPatterns.js';
import { ENCORE_CARD, ENCORE_START, ENCORE_PAGE, encoreUnlocked, encoreWon, ENCORE_QUIT } from './encoreRules.js';
import { encoreIntroPages, encorePages } from './postPages.js';
import { createJokerCard } from './postProps.js';

const CARD_R = 2, REARM = 5;

export function createEncore({ scene, hero, follow, events, boss, combat, encounters, progress, save, ui, hud, flow, stage, camera, canStart }) {
  const card = createJokerCard('encore');
  card.position.set(ENCORE_CARD.x, ENCORE_CARD.y, ENCORE_CARD.z);
  card.visible = false;
  scene.add(card);
  let running = false, starting = false, armed = true, hinted = false, t = 0, clock = 0;

  // stage.shot moves the camera for its panels; put the live view back before the comic shows.
  function pages(make) {
    const p = camera.position.clone(), q = camera.quaternion.clone();
    const list = make(stage);
    camera.position.copy(p);
    camera.quaternion.copy(q);
    return list;
  }
  async function start() {
    starting = true;
    armed = false;
    await flow.playPages(pages(encoreIntroPages));
    hero.teleport(ENCORE_START, ENCORE_START.yaw);
    follow.snapBehind(ENCORE_START.yaw);
    hero.health = hero.maxHealth;
    // A guest squad waiting nearby would take combat's enemy list back from the boss: clear it.
    if (encounters.id) encounters.end();
    boss.begin(ENCORE_BOSS);
    running = true;
    starting = false;
    clock = 0;
    events.emit('encoreStart');
  }

  events.on('bossDefeated', ({ encore = false } = {}) => {
    if (!encore || !running) return;
    running = false;
    boss.hide();
    combat.setEnemies([]);
    hero.health = hero.maxHealth;
    const best = !progress.encore.won || clock < progress.encore.best;
    progress.encore.won = true;
    if (best) progress.encore.best = Math.round(clock * 10) / 10;
    if (!progress.unlocks.includes(ENCORE_PAGE)) progress.unlocks.push(ENCORE_PAGE);
    save();
    const c = encoreWon(clock, best);
    hud.card(c.title, c.text, 8000);
    events.emit('encoreWon', { time: clock, best });
    events.emit('missionDone', { id: 'encore' });
    setTimeout(() => flow.playPages(pages(encorePages)), 3500);
  });

  function update(dt, real, on) {
    t += dt;
    card.visible = on && encoreUnlocked(progress) && !running && !starting;
    if (card.visible) card.rotation.y = Math.PI + Math.sin(t) * 0.3;
    if (running) clock += dt;
    if (!card.visible || hero.dead) return;
    const d = Math.hypot(ENCORE_CARD.x - hero.pos.x, ENCORE_CARD.z - hero.pos.z) + Math.abs(ENCORE_CARD.y - hero.pos.y);
    if (d > REARM) { armed = true; hinted = false; }
    else if (armed && d < CARD_R) {
      if (canStart()) start();
      else if (!hinted) { hinted = true; ui.hint('Not now. Finish what you are doing first.', 2500); }
    }
  }

  return {
    update,
    busy: () => running || starting,
    music: () => (running ? 'boss' : null),
    // Knocked out: back to the arena, the current phase starts over (the boss keeps its progress).
    onRespawn() {
      if (!running) return null;
      boss.restart();
      hero.health = hero.maxHealth;
      return { ...ENCORE_START };
    },
    // The pause menu's "Leave the encore".
    quit() {
      if (!running) return false;
      running = false;
      boss.stop();
      hero.teleport({ x: ENCORE_CARD.x, y: ENCORE_CARD.y, z: ENCORE_CARD.z + 3 }, Math.PI);
      ui.toast("Joker's Encore", ENCORE_QUIT, 5000);
      events.emit('encoreQuit');
      return true;
    },
    // Dev hook and scripted play: start without walking into the card.
    startNow() { if (running || starting) return false; start(); return true; },
    get running() { return running; },
    get debug() { return { running, starting, phase: boss.phase, clock: +clock.toFixed(1), unlocked: encoreUnlocked(progress), won: progress.encore.won }; },
  };
}
```

- [ ] **Step 3: Leaving the encore from the pause menu.** In `src/ui/menus.js`, `pause(opts)` destructures `onQuitEncore` and adds, right after the `Quit challenge` button line:

```js
    if (onQuitEncore) list.appendChild(button('Leave the encore', onQuitEncore));
```

- [ ] **Step 4: Wire it in `src/game/game.js`.** Imports:

```js
import { createEncore } from '../postgame/encore.js';
import { encorePages } from '../postgame/postPages.js';
import { ENCORE_PAGE } from '../postgame/encoreRules.js';
```
After `post.army = ...` add:

```js
    post.encore = post.add(createEncore({
      scene, hero, follow, events, boss, combat, encounters, progress, ui: side.ui, hud, flow, stage, camera,
      save: () => saveProgress(storage, progress), canStart: postCanStart,
    }));
    post.addPage({ id: 'encore', title: "Joker's Encore", make: encorePages, shown: (p) => p.unlocks.includes(ENCORE_PAGE) });
```
In `pauseOptions()` add:

```js
      onQuitEncore: game.post.encore.running ? () => { game.post.encore.quit(); opts.onResume(); } : undefined,
```

- [ ] **Step 5: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t13.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.encore ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "const G = window.__game; G.progress.bombs.push('bombDocks', 'bombNeon', 'bombAce', 'bombHarbour', 'bombDiner'); G.post.refresh(); G.hero.teleport({ x: -62, y: 58, z: -140 }, Math.PI); G.follow.snapBehind(Math.PI, 0.15); 'arena'", "wait": 1500},
 {"eval": "JSON.stringify(window.__game.post.encore.debug)"},
 {"shot": "t13-card"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: -62, y: 58, z: -144.5 }, Math.PI); 'touch'", "wait": 1500},
 {"eval": "window.__game.comic.playing"},
 {"shot": "t13-intro"},
 {"eval": "window.__game.comic.skip()", "wait": 5000},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.encore.debug), G.boss.pattern, G.enemies.length]"},
 {"shot": "t13-encore"},
 {"press": "Escape", "wait": 400},
 {"eval": "[...document.querySelectorAll('.pause-menu .mbtn')].map((b) => b.textContent)"},
 {"eval": "[...document.querySelectorAll('.pause-menu .mbtn')].find((b) => b.textContent === 'Leave the encore').click(); 'left'", "wait": 800},
 {"eval": "const G = window.__game; [G.post.encore.running, G.boss.active, G.enemies.length, document.querySelector('.side-toast.show .toast-title')?.textContent ?? null]"},
 {"eval": "const G = window.__game; G.post.encore.startNow(); 'again'", "wait": 1200},
 {"eval": "(async () => { const G = window.__game; if (G.comic.playing) G.comic.skip(); await new Promise((r) => setTimeout(r, 2000)); G.boss.debugFinish(); await new Promise((r) => setTimeout(r, 2600)); return [G.progress.encore.won, G.progress.encore.best > 0, G.progress.unlocks.includes('encorePage'), document.querySelector('.hud-card .card-title')?.textContent ?? null]; })()"},
 {"wait": 4000},
 {"eval": "window.__game.comic.playing"},
 {"shot": "t13-reward"},
 {"eval": "window.__game.comic.skip()", "wait": 800},
 {"eval": "JSON.stringify(window.__game.post.page().pages)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t13.json")"
```

Expected:
- With all five bombs marked, the card shows: `{"running":false,"starting":false,"phase":0,"clock":0,"unlocked":true,"won":false}`; `t13-card.png` shows the ENCORE! Joker card standing on the arena roof.
- Touching it plays the comic (`true`); `t13-intro.png` shows the JOKER'S ENCORE title and the Joker on his balcony with his line.
- After the comic the fight runs on the encore pattern: `running` true, phase 1, pattern `encore`, 5 goons plus nobody else; `t13-encore.png` shows the arena and the boss bar.
- The pause menu lists `Leave the encore`; leaving ends it cleanly: `[false, false, 0, "Joker's Encore"]`.
- Starting again and finishing: `[true, true, true, "GOLD MEDAL!"]`, then the reward comic plays (`true`); `t13-reward.png` shows ENCORE! ENCORE! with the gold medal line and Batman cheering.
- The After the Party page lists both pages: `[{"id":"intro",...},{"id":"encore","title":"Joker's Encore"}]`.
- `no console errors`.

A knockout during the encore (try it by hand with `?god=1` off): the death comic plays, Batman comes back at the arena, and the current phase starts over.

- [ ] **Step 7: Commit**

```bash
git add src/postgame/encore.js src/postgame/postPages.js src/ui/menus.js src/game/game.js
git commit -m "Joker's Encore: the card on the clock tower, the harder rematch, leaving it, the gold medal and a new comic page"
```

---

### Task 14: Endless Party Crashers at run time

**Files:**
- Create: `src/postgame/crashers.js`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: Task 4 (`CRASHERS`, `REST`, `CAKE_HEAL`, `crasherFightId`, `isCrasherFight`, `waveOf`, `crasherWave`, `crasherRules`, `isCakeBreak`, `crasherMedalNote`), Task 6 (`keepHealth`), Task 7 (`runner.addChallenge`, `registerKind` with `stop`, `finish(value, { respawn })`); 7H-1's `combat.setHardness`, `combat.hardness`.
- Produces: `attachCrashers(runner, deps)` -> `{ jumpTo(n), debug }`; events `crasherWave`, `cakeBreak`; the survival pillar on the Monarch roof after the credits; `window.__game.post.crashers`.

- [ ] **Step 1: Write `src/postgame/crashers.js`**

```js
// Endless Party Crashers at run time: a survival challenge on 3C's challenge runner (its pillar,
// 3-2-1, results toast, medals, the Challenges page, medal XP). One wave at a time runs through
// the encounter system; each wave gets tougher through combat's hardness rules. Every fifth wave
// is a cake break (health back). A knockout or quitting ends the run and records the waves cleared.
import {
  CRASHERS, REST, CAKE_HEAL, crasherFightId, isCrasherFight, waveOf, crasherWave, crasherRules, isCakeBreak, crasherMedalNote,
} from './crasherWaves.js';

export function attachCrashers(runner, { events, encounters, combat, hero, hud, ui, rng, progress, shown }) {
  runner.addChallenge(CRASHERS, { shown });
  let wave = 0, cleared = 0, restT = 0, prev = null, code = -1;
  const live = () => runner.running && runner.current?.kind === 'survival';
  const best = () => progress.challenges[CRASHERS.id]?.best ?? 0;

  function beginWave(n) {
    wave = n;
    combat.setHardness(crasherRules(n));
    encounters.begin(crasherFightId(n), crasherWave(n, rng));
    encounters.trigger();
    ui.countdown(`WAVE ${n}`);
    events.emit('crasherWave', { wave: n });
  }
  function show() {
    const c = wave * 1000 + cleared * 10 + (restT > 0 ? 1 : 0);
    if (c === code) return;
    code = c;
    ui.timer(`Wave ${wave}`, restT > 0 ? `Cleared ${cleared}. Next wave coming!` : `Cleared ${cleared}. Best ${best()}.`);
  }

  runner.registerKind('survival', {
    ownsFight: isCrasherFight,
    begin() {
      cleared = 0;
      restT = 0;
      code = -1;
      prev = combat.hardness;
      beginWave(1);
      show();
    },
    update(run, dt) {
      if (restT > 0) { restT -= dt; if (restT <= 0) beginWave(wave + 1); }
      show();
    },
    end() {
      if (isCrasherFight(encounters.id)) encounters.end();
      combat.setHardness(prev);
      restT = 0;
    },
    // A knockout or "Quit challenge" ends a survival run with its score, not a fail.
    stop(run, reason) {
      runner.finish(cleared, { respawn: reason === 'down' });
      return true;
    },
  });

  events.on('fightDone', ({ id }) => {
    if (!live() || !isCrasherFight(id)) return;
    cleared = waveOf(id);
    const note = crasherMedalNote(cleared);
    if (note) ui.toast(CRASHERS.name, note, 3500);
    if (isCakeBreak(cleared)) {
      hero.health = Math.min(hero.maxHealth, hero.health + CAKE_HEAL);
      hud.setHealth(hero.health / hero.maxHealth);
      events.emit('cakeBreak', { wave: cleared });
      setTimeout(() => ui.countdown('CAKE BREAK!'), 400);
    }
    restT = REST;
  });

  return {
    // Dev hook and sweeps: skip ahead to wave n of a running survival.
    jumpTo(n) {
      if (!live()) return false;
      if (isCrasherFight(encounters.id)) encounters.end();
      cleared = n - 1;
      restT = 0;
      beginWave(n);
      return true;
    },
    get debug() { return { live: live(), wave, cleared, rest: +restT.toFixed(1), best: best(), health: combat.hardness.health }; },
  };
}
```

- [ ] **Step 2: Wire it in `src/game/game.js`.** Imports: `import { attachCrashers } from '../postgame/crashers.js';` and `import { isCrasherFight } from '../postgame/crasherWaves.js';`. After `post.encore = ...` add:

```js
    post.crashers = attachCrashers(side.challenges, {
      events, encounters, combat, hero, hud, ui: side.ui, rng, progress, shown: () => post.active,
    });
    // Health carries over between survival waves (the flow refills it after every other fight).
    post.add({ keepHealth: (id) => isCrasherFight(id) });
```

- [ ] **Step 3: Run the unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.** Build, preview, then:

```bash
cat > "$TEMP/g7b-t14.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game?.post?.crashers ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "const G = window.__game; G.teleport('monarchRoof'); G.hero.bat.face(-2.4); G.follow.snapBehind(-2.4, 0.15); 'roof'", "wait": 1500},
 {"eval": "const G = window.__game; [G.side.challenges.extras.map((c) => c.id), G.side.challenges.pillars.at(-1).mesh.visible]"},
 {"shot": "t14-pillar"},
 {"eval": "const G = window.__game; G.side.challenges.start('partyCrashers'); 'go'", "wait": 3600},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.crashers.debug), G.enemies.filter((e) => e.alive).length]"},
 {"shot": "t14-wave1"},
 {"eval": "(async () => { const G = window.__game; for (let i = 0; i < 5; i++) { G.hero.health = 60; G.winFight(); await new Promise((r) => setTimeout(r, 3400)); } return [JSON.stringify(G.post.crashers.debug), Math.round(G.hero.health)]; })()"},
 {"shot": "t14-cake-break"},
 {"eval": "const G = window.__game; G.post.crashers.jumpTo(12); 'wave 12'", "wait": 1500},
 {"eval": "const G = window.__game; [JSON.stringify(G.post.crashers.debug), G.enemies.filter((e) => e.alive).map((e) => e.type).sort().join(','), G.enemies.find((e) => e.alive && e.type === 'grunt')?.health]"},
 {"shot": "t14-wave12"},
 {"eval": "const G = window.__game; G.side.challenges.quit(); 'quit'", "wait": 800},
 {"eval": "const G = window.__game; [JSON.stringify(G.progress.challenges.partyCrashers), document.querySelector('.side-toast.show .toast-text')?.textContent ?? null, G.combat.hardness.health, G.encounters.id]"},
 {"eval": "const G = window.__game; G.side.challenges.start('partyCrashers'); 'again'", "wait": 3600},
 {"eval": "const G = window.__game; G.hero.health = 1; G.combat.killHero(); 'down'", "wait": 300},
 {"eval": "const G = window.__game; [JSON.stringify(G.progress.challenges.partyCrashers), JSON.stringify(G.side.challenges.takeRespawn())]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b" "$(cat "$TEMP/g7b-t14.json")"
```

Expected:
- The survival pillar stands on the Monarch roof after the credits: `[["partyCrashers"], true]`; `t14-pillar.png` shows it (and the Birthday Bash pillar elsewhere on the roof).
- Wave 1: `{"live":true,"wave":1,"cleared":0,...,"health":1}` with 3 goons; `t14-wave1.png` shows "WAVE 1" and the panel "Wave 1, Cleared 0. Best 0.".
- After five waves: cleared `5` and health well above 60 (the wave 5 cake break added 35; winning a wave never refills to full); `t14-cake-break.png` shows the Bronze note or CAKE BREAK!.
- Wave 12: two brutes, five knives and two grunts, a grunt with health `7` (4 x 1.66, rounded up), and hardness `1.66`; `t14-wave12.png` shows the crowd.
- Quitting records `{"best":11,"medal":"silver"}` with the toast "Silver! 11 waves. New best!", puts hardness back to `1` and ends the fight (`null`).
- A knockout in a fresh run records its result through `stop` (the best stays 11) and the respawn point is the pillar's start.
- `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/postgame/crashers.js src/game/game.js
git commit -m "Endless Party Crashers: a survival challenge on the Monarch roof with growing waves, cake breaks and medals"
```

---
### Task 15: Placement check for the routes, sounds, and prompts

**Files:**
- Modify: `scripts/postgame-check.mjs` (7H-1), `src/game/game.js`, `src/game/sound.js`, `src/ui/prompts.js`, and the data files if a spot is off (`src/postgame/bombSpots.js`, `src/postgame/encoreRules.js`, `src/postgame/crasherWaves.js`, `src/postgame/balloonArmy.js`)
- Test: `tests/unit/prompts.test.js` (modify)

**Interfaces:**
- Consumes: 7H-1's `post.data`, `postgame-check.mjs`; `world.collision` (`groundBelow`, `query`, `raycast(o, dir, len) -> { box, t } | null`), `climbables.ziplines` (each built downhill: `a` is the high end); Tasks 1, 2, 4, 5; events from Tasks 11 to 14.
- Produces: `post.data.BOMBS`, `ENCORE_CARD`, `CRASHERS_PILLAR`; check lines for every card, bomb, leg, glide line, cable direction, the encore card, the survival pillar and every balloon path; sounds; prompts `cakeBomb`, `defuse`, `balloonArmy`, `encore`.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: After the Party, part 2', () => {
  it('the four prompts exist, name their keys and have no dashes', () => {
    const t = (id) => promptText(id, DEFAULT_BINDINGS);
    expect(t('defuse')).toContain(keyLabel(DEFAULT_BINDINGS.block[0]));
    expect(t('balloonArmy')).toContain(keyLabel(DEFAULT_BINDINGS.batarang[0]));
    for (const id of ['cakeBomb', 'defuse', 'balloonArmy', 'encore']) expect(t(id)).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/prompts.test.js`
Expected: FAIL (unknown prompt ids).

- [ ] **Step 3: Prompts.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['cakeBomb', () => 'A cake bomb! Follow the marker: glide, then ride the zipline. Reach it before the fuse burns out.'],
  ['defuse', (k) => `Defuse it: press ${k('block')} when the needle is in the green. Four hits. A miss burns five seconds of fuse.`],
  ['balloonArmy', (k) => `Joker balloons! Look at one and throw a batarang ${k('batarang')}. The remote batarang can pop a whole line of them.`],
  ['encore', () => "Joker's Encore is waiting on the clock tower roof. Touch his card when you are ready for a rematch."],
```

- [ ] **Step 4: Sounds in `src/game/sound.js`.** Add with the other `on(...)` lines:

```js
  // After the Party, part 2 (Plan 7H-2).
  on('bombLit', () => { audio.play('signal', { pitch: 0.8 }); audio.play('buzzer', { gain: 0.4, pitch: 1.6 }); });
  on('fuseTick', () => audio.play('uiMove', { gain: 0.8, pitch: 1.6 }));
  on('defuseHit', () => audio.play('counter', { pitch: 1.2 }));
  on('defuseMiss', () => audio.play('buzzer', { pitch: 1.3 }));
  on('bombDefused', () => { audio.stinger('objective'); audio.play('pop'); });
  on('bombSplat', () => { audio.play('land', { gain: 1.4 }); audio.play('pop', { pitch: 0.6 }); audio.play('laugh'); });
  on('armyPop', () => audio.play('pop', { pitch: vary(0.3) }));
  on('armyCleared', () => audio.stinger('districtClear'));
  on('encoreStart', () => audio.stinger('bossPhase'));
  on('encoreWon', () => audio.stinger('districtClear'));
  on('crasherWave', () => audio.play('signal', { gain: 0.6, pitch: 1.2 }));
  on('cakeBreak', () => audio.play('pickup'));
```
(The encore's music is 7H-1's `post.music()` hook: `createEncore` returns `'boss'` while it runs.)

- [ ] **Step 5: Wire the prompts and the check data in `src/game/game.js`.**

```js
    events.on('bombLit', () => prompts.show(['cakeBomb']));
    events.on('defuseStart', ({ kind }) => { if (kind === 'counter') prompts.show(['defuse']); });
    events.on('armyNear', () => prompts.show(['balloonArmy']));
    events.on('encoreUnlocked', () => prompts.show(['encore']));
```
Add to `PROMPT_DONE`: `bombDefused: 'cakeBomb', defuseHit: 'defuse', armyPop: 'balloonArmy', encoreStart: 'encore'`. Import `BOMBS` (`../postgame/bombSpots.js`), `ENCORE_CARD` (`../postgame/encoreRules.js`), `CRASHERS` (`../postgame/crasherWaves.js`) and `pillarPos` (`./challenges.js`, already imported by 3C's wiring if present), and after `post.crashers = ...` add:

```js
    post.data = { ...post.data, BOMBS, ENCORE_CARD, CRASHERS_PILLAR: pillarPos(CRASHERS) };
```

- [ ] **Step 6: The check.** In `scripts/postgame-check.mjs`, inside `page.evaluate`, before `return out;`, add:

```js
  const { BOMBS = [], ENCORE_CARD = null, CRASHERS_PILLAR = null } = G.post.data;
  const lines = G.climbables.ziplines;
  const nearLine = (zip) => {
    let best = null, bd = Infinity;
    for (const l of lines) {
      const d = Math.min(
        Math.hypot(l.a.x - zip.a.x, l.a.z - zip.a.z) + Math.hypot(l.b.x - zip.b.x, l.b.z - zip.b.z),
        Math.hypot(l.a.x - zip.b.x, l.a.z - zip.b.z) + Math.hypot(l.b.x - zip.a.x, l.b.z - zip.a.z),
      );
      if (d < bd) { bd = d; best = l; }
    }
    return bd <= 60 ? best : null;
  };
  for (const b of BOMBS) {
    onFloor(`${b.id} card`, b.start.x, b.start.y, b.start.z);
    clear(`${b.id} card`, b.start.x, b.start.y, b.start.z);
    onFloor(`${b.id} bomb`, b.at.x, b.at.y, b.at.z);
    let from = b.start;
    b.legs.forEach((l, i) => {
      const id = `${b.id} leg ${i + 1} (${l.kind})`;
      if (l.kind === 'zip') {
        const line = nearLine(l.zip);
        if (!line) out.push(`FAIL ${id}: no cable near its route`);
        else {
          // Cables are built downhill: a is the high end, and the leg must start near it.
          const right = Math.hypot(line.a.x - from.x, line.a.z - from.z) < Math.hypot(line.b.x - from.x, line.b.z - from.z);
          out.push(right ? `ok   ${id}` : `FAIL ${id}: the cable rides the other way, from ${line.a.x.toFixed(0)}, ${line.a.z.toFixed(0)}`);
        }
      } else if (l.kind === 'glide') {
        const drop = from.y - l.to.y, flat = Math.hypot(l.to.x - from.x, l.to.z - from.z);
        const ratio = drop > 0 ? flat / drop : Infinity;
        const d = { x: l.to.x - from.x, y: l.to.y - from.y, z: l.to.z - from.z };
        const len = Math.hypot(d.x, d.y, d.z);
        d.x /= len; d.y /= len; d.z /= len;
        const o = { x: from.x + d.x * 4, y: from.y + 1.5 + d.y * 4, z: from.z + d.z * 4 };
        const hit = c.raycast(o, d, len - 8);
        if (ratio > 7) out.push(`FAIL ${id}: glide ratio ${ratio.toFixed(1)} (over 7)`);
        else if (hit) out.push(`FAIL ${id}: something solid in the glide line (${hit.box?.tag ?? 'box'} ${hit.t.toFixed(0)} m along)`);
        else out.push(`ok   ${id} (ratio ${ratio.toFixed(1)})`);
      }
      onFloor(`${id} end`, l.to.x, l.to.y, l.to.z);
      from = l.to;
    });
  }
  if (ENCORE_CARD) onFloor('encore card', ENCORE_CARD.x, ENCORE_CARD.y, ENCORE_CARD.z);
  if (CRASHERS_PILLAR) onFloor('survival pillar', CRASHERS_PILLAR.x, CRASHERS_PILLAR.y, CRASHERS_PILLAR.z);
  for (const it of G.post.army.items) {
    const b = it.b;
    const hits = c.query(b.x - b.ax - 1, b.z - b.az - 1, b.x + b.ax + 1, b.z + b.az + 1).filter((x) => !x.removed && x.maxY > b.y - 2.5 && x.minY < b.y + 2);
    out.push(hits.length ? `FAIL balloon ${b.i}: its path passes through ${hits[0].tag ?? 'a box'}` : `ok   balloon ${b.i}`);
  }
```

- [ ] **Step 7: Run it and fix what it finds.** Run `npx vitest run` (PASS), build, preview, then `node scripts/postgame-check.mjs http://localhost:5213/`.

Expected: `every post-game spot is ok` and `no console errors`. For each `FAIL`:
- A floor mismatch under 3 m: set that spot's `y` to the printed floor (for a leg end, change the leg's `to`; if it is the last leg, `at` too, because the test requires them equal).
- A glide ratio over 7, or something solid in a glide line: move that leg's start higher (a taller roof nearby, see `landmarks()` in `src/world/mapData.js`, or a filler roof from `buildMapData(11)`) or its end closer, keeping the leg a glide.
- A cable that rides the other way: swap the order of that bomb's legs so the zip comes where its high end is (as `bombNeon` and `bombHarbour` do), or pick the route pair from `ZIP_ROUTES` whose high end is on the way.
- A card or pillar with something solid in it: move it 1 m clear.
- A balloon path through a box: move that balloon's `x` toward 150 or raise its `y` in `balloonArmy.js`.
After moving anything, rerun `npx vitest run` and update the fuse numbers in Task 1's test (and any other expectation that names a moved number) with the values it prints. Rerun the check until clean. Then fly each route once by hand in the dev server with a person at the keys: the fuse should feel tight but fair (you arrive with 5 to 10 s to spare flying the intended route cleanly). If a route is too tight, raise `FUSE_SLACK` for everyone rather than one bomb, and update Task 1's test.

- [ ] **Step 8: Commit**

```bash
git add scripts/postgame-check.mjs src/game/game.js src/game/sound.js src/ui/prompts.js tests/unit/prompts.test.js src/postgame/bombSpots.js src/postgame/encoreRules.js src/postgame/crasherWaves.js src/postgame/balloonArmy.js tests/unit/bombSpots.test.js
git commit -m "Route, card and balloon placement checks, part 2 sounds, and four prompts"
```

---

### Task 16: Scripted runs and browser tests for the second half

**Files:**
- Create: `scripts/runs/post-bombs.json`, `scripts/runs/post-army.json`, `scripts/runs/post-encore.json`, `scripts/runs/post-crashers.json`, `tests/e2e/postgame2.spec.js`

**Interfaces:**
- Consumes: everything above.
- Produces: four replayable runs and three Playwright tests; a person-at-the-keys pass.

- [ ] **Step 1: Keep the runs.** Copy the scripted runs from Tasks 11 to 14 into the repo and replay them on a fresh build (they must give the results listed in those tasks):

```bash
cp "$TEMP/g7b-t11.json" scripts/runs/post-bombs.json
cp "$TEMP/g7b-t12.json" scripts/runs/post-army.json
cp "$TEMP/g7b-t13.json" scripts/runs/post-encore.json
cp "$TEMP/g7b-t14.json" scripts/runs/post-crashers.json
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b-r" "$(cat scripts/runs/post-bombs.json)"
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1&gadgets=all" "$TEMP/g7b-r" "$(cat scripts/runs/post-army.json)"
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b-r" "$(cat scripts/runs/post-encore.json)"
node scripts/dev-play.mjs "http://localhost:5213/?at=credits&post=1&new=1&god=1" "$TEMP/g7b-r" "$(cat scripts/runs/post-crashers.json)"
```

- [ ] **Step 2: Write `tests/e2e/postgame2.spec.js`**

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
  await page.waitForFunction(() => window.__game?.post?.crashers, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await page.waitForTimeout(1500);
}

test('a cake bomb lights at its card, its guard falls, and it stays defused after a reload', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=credits&post=1&new=1&god=1');
  await page.evaluate(() => window.__game.hero.teleport({ x: -10, y: 42, z: 18 }, -0.45));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__game.post.bombs.debug?.id)).toBe('bombDocks');
  await expect(page.locator('.dh-fuse.show')).toBeVisible();
  await page.evaluate(() => window.__game.teleport({ x: -123, y: 15, z: 124 }));
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    const G = window.__game;
    for (let i = 0; i < 12 && G.post.bombs.debug; i++) { G.winFight(); await new Promise((r) => setTimeout(r, 700)); }
  });
  expect(await page.evaluate(() => window.__game.progress.bombs)).toEqual(['bombDocks']);
  await boot(page, 'at=credits&post=1&god=1');
  expect(await page.evaluate(() => window.__game.post.bombs.items.find((i) => i.b.id === 'bombDocks').done)).toBe(true);
  expect(errors).toEqual([]);
});

test('a popped Joker balloon stays popped after a reload', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=credits&post=1&new=1&god=1');
  await page.evaluate(() => { window.__game.teleport({ x: 150, y: 0, z: -40 }); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__game.post.army.pop(3));
  expect(await page.evaluate(() => window.__game.progress.army)).toEqual([3]);
  await boot(page, 'at=credits&post=1&god=1');
  expect(await page.evaluate(() => window.__game.post.army.items[3].popped)).toBe(true);
  expect(errors).toEqual([]);
});

test('five bombs unlock the encore card, and the survival pillar records a result', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?dynres=0');
  await page.waitForFunction(() => window.__game?.state?.frame > 30, null, { timeout: 90000 });
  await page.evaluate(() => localStorage.setItem('gotham-mansi-progress-v1', JSON.stringify({
    step: 30, finished: true, seenIntro: true, postgame: { cleared: true, introSeen: true },
    bombs: ['bombDocks', 'bombNeon', 'bombAce', 'bombHarbour', 'bombDiner'],
  })));
  await boot(page, 'at=credits&god=1');
  expect(await page.evaluate(() => window.__game.post.encore.debug.unlocked)).toBe(true);
  await page.evaluate(() => { const G = window.__game; G.teleport('monarchRoof'); G.side.challenges.start('partyCrashers'); });
  await page.waitForTimeout(3600);
  expect(await page.evaluate(() => window.__game.post.crashers.debug.wave)).toBe(1);
  await page.evaluate(() => window.__game.side.challenges.quit());
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.progress.challenges.partyCrashers)).toEqual({ best: 0, medal: null });
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Run the browser tests** against the frozen build:

```bash
BASE_URL=http://localhost:5213 npx playwright test tests/e2e/postgame2.spec.js
```
Expected: 3 passed.

- [ ] **Step 4: A person at the keys.** With the dev server and a gamepad or mouse, once each: fly a real bomb route and defuse the Neon bomb by timing the dial (four hits, a miss costs five seconds); pop a line of balloons by steering the remote batarang through them; play Joker's Encore start to finish (it should feel clearly harder than the story fight but fair: the floor shapes readable, the double gags dodgeable, the four-counter chains learnable); survive to wave 5 of Party Crashers. Note anything unfair in the PR notes, and tune the pattern or wave numbers (then update the matching unit test expectations).

- [ ] **Step 5: Commit**

```bash
git add scripts/runs/post-bombs.json scripts/runs/post-army.json scripts/runs/post-encore.json scripts/runs/post-crashers.json tests/e2e/postgame2.spec.js
git commit -m "Replayable runs and browser tests for cake bombs, the balloon army, the encore and the survival arena"
```

---

### Task 17: Performance: part 2 rows in the fps sweep, and load time

**Files:**
- Modify: `scripts/fps-sweep.mjs`

**Interfaces:**
- Consumes: everything above; `window.__game.post`, `boss`, `side.challenges`.
- Produces: a `post2` page (`ONLY=post2`) with rows `p2:bombRun`, `p2:guard`, `p2:dial`, `p2:splat`, `p2:army`, `p2:encore1`, `p2:encore2`, `p2:crashers`.

- [ ] **Step 1: Add the page.** In `scripts/fps-sweep.mjs`, add `post2` to the header comment's scenario list, and before `await b.close();` add:

```js
if (!only || only === 'post2') {
  const { p, errors } = await openGame('at=credits&post=1&new=1&god=1&gadgets=all');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  const ev = (fn) => p.evaluate(fn);
  // A bomb run: the card, the fuse HUD ticking, the spark on the far cake.
  await label(p, 'p2:bombRun');
  await ev(() => { const g = window.__game; g.hero.teleport({ x: -10, y: 42, z: 18 }, -0.45); g.follow.snapBehind(-0.45, 0.1); });
  await p.waitForTimeout(4000);
  // The guard fight at the Docks bomb.
  await label(p, 'p2:guard');
  await ev(() => { const g = window.__game; g.teleport({ x: -123, y: 15, z: 124 }); });
  for (let i = 0; i < 10; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(400); }
  await ev(() => window.__game.winFight());
  await p.waitForTimeout(2500);
  // The dial: the Neon bomb, counters pressed now and then.
  await label(p, 'p2:dial');
  await ev(() => { const g = window.__game; g.hero.teleport({ x: 184, y: 38, z: -14 }, -1.4); });
  await p.waitForTimeout(600);
  await ev(() => window.__game.teleport({ x: 126, y: 22, z: 50 }));
  for (let i = 0; i < 8; i++) { await p.mouse.click(640, 360, { button: 'right' }); await p.waitForTimeout(450); }
  // The SPLAT: a big confetti burst and the toast.
  await label(p, 'p2:splat');
  await ev(() => window.__game.post.bombs.setFuse(0.3));
  await p.waitForTimeout(3000);
  // The balloon army overhead, with batarangs popping a few.
  await label(p, 'p2:army');
  await ev(() => { const g = window.__game; g.gadgets.equip('batarang'); g.teleport({ x: 150, y: 0, z: -40 }); g.hero.bat.face(Math.PI); g.follow.snapBehind(Math.PI, -0.45); });
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) { await p.keyboard.press('KeyR'); await p.waitForTimeout(900); }
  await p.waitForTimeout(2000);
  // Joker's Encore: phase 1 (five goons, the new floor shapes), then phase 2 (doubled gags).
  await ev(() => { const g = window.__game; g.progress.bombs.push('bombDocks', 'bombNeon', 'bombAce', 'bombHarbour', 'bombDiner'); g.post.encore.startNow(); });
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'p2:encore1');
  await p.waitForTimeout(6000);
  await ev(async () => { const g = window.__game; for (let i = 0; i < 12 && g.boss.phase === 1; i++) { g.winFight(); await new Promise((r) => setTimeout(r, 1600)); } });
  await label(p, 'p2:encore2');
  await p.waitForTimeout(7000);
  await ev(() => window.__game.post.encore.quit());
  // Party Crashers at wave 12: nine goons, two brutes.
  await ev(() => { const g = window.__game; g.teleport('monarchRoof'); g.side.challenges.start('partyCrashers'); });
  await p.waitForTimeout(3600);
  await ev(() => window.__game.post.crashers.jumpTo(12));
  await label(p, 'p2:crashers');
  for (let i = 0; i < 16; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(400); }
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/post2-crashers.png` }); }
  all.push(...await collect(p, 'post2'));
  meta.errorsPost2 = errors;
  await p.close();
}
```

- [ ] **Step 2: Run the sweep on the owner's laptop.** Build to `$TEMP/g7bdist`, preview on 5213, then:

```bash
OUT="$TEMP/sweep-g7b.json" node scripts/fps-sweep.mjs http://localhost:5213/ high
```
Expected: every `p2:*` row has p95 at or under 6.9 ms; `hitches >25ms after warmup: 0`; 7H-1's `p:*` rows and every older row are no worse than in 7H-1's last sweep. If a hitch lands in a `p2:*` row:
- A first-sight hitch (the first card, the cake bomb's band texture, the balloon army's first draw, the dial's first layout): check that the object exists (even hidden) before `begin()`, and that `createPostWarm()` has its material. The dial's DOM is built at boot by `createDefuseHud`; its first `show` is a class change only.
- The `p2:splat` row: 320 confetti in one burst is 5FG's pooled confetti; if it hitches, drop the SPLAT burst to 200.
- A steady high p95 in `p2:crashers`: nine goons plus two brutes is the heaviest fight in the game; if it is over budget, lower `MAX_GOONS` to 8 (update Task 4's test) rather than touching the renderer.
- A steady high p95 anywhere else: allocation in an `update` or a DOM write every frame.
Rerun until clean.

- [ ] **Step 3: Load time.**

```bash
node scripts/load-time.mjs http://localhost:5213/ 40 1
```
Expected: `firstFrame` under 3.2 s; `compiled` no more than 30 ms later than 7H-1's last run.

- [ ] **Step 4: Commit**

```bash
git add scripts/fps-sweep.mjs
git commit -m "fps sweep: a part 2 page for bomb runs, guards, the dial, the SPLAT, the balloon army, the encore and wave 12"
```

---

### Task 18: Full verification of Part H (the coordinator runs this)

**Files:**
- Modify: `scripts/playthrough.mjs`, `scripts/webkit-check.mjs`

- [ ] **Step 1: Unit tests.** `npx vitest run`. Every test passes, including the six new test files (`bombSpots`, `balloonArmy`, `bossPatterns`, `crasherWaves`, `showdown`, `defuseHud`), the changed `flowHooks`, `prompts` and `challenges` tests, and all of 7H-1's.

- [ ] **Step 2: Browser tests.** Build to `$TEMP/g7bdist`, preview on 5213, then `BASE_URL=http://localhost:5213 npx playwright test`. All pass, including `postgame.spec.js` (7H-1) and `postgame2.spec.js`.

- [ ] **Step 3: No dashes in player-visible text.**

```bash
grep -nP "[\x{2013}\x{2014}]" src/postgame/*.js src/game/bossPatterns.js src/game/boss.js src/ui/defuseHud.js src/ui/postHud.js src/ui/menus.js src/ui/prompts.js src/game/game.js src/game/sound.js
```
Expected: no output.

- [ ] **Step 4: Placements.** `node scripts/postgame-check.mjs http://localhost:5213/` prints `every post-game spot is ok` (crates, guests, party slots, bomb cards, bombs, every leg, the encore card, the survival pillar, all sixteen balloons).

- [ ] **Step 5: The full playthrough reaches the whole After the Party.** 7H-1 added a report before `await browser.close();` in `scripts/playthrough.mjs`. Run: `BASE=http://localhost:5213/ OUT="$TEMP/pt7b" node scripts/playthrough.mjs`
Expected: it ends at `credits` with no console errors, and prints `after the party: {"on":true,"cleared":true,"rows":["crates 0/20","guests 0/6","bombs 0/5","army 0/16","encore 0/1","crashers 0/3","ngPlus 0/1"]}`. The story boss (run by the playthrough on `STORY_BOSS`) must behave exactly as before this plan: same phases, same finale.

- [ ] **Step 6: fps sweep, all pages.** On the owner's laptop: `OUT="$TEMP/sweep-final-7b.json" node scripts/fps-sweep.mjs http://localhost:5213/ high`. Every row (main, fight, boss, 3C's side page, 5FG's gadgets page, 6D's stealth rows, 7H-1's `post` rows and this plan's `post2` rows) has p95 at or under 6.9 ms and no hitch over 25 ms after warmup. Repeat once with `low`.

- [ ] **Step 7: Load time.** `node scripts/load-time.mjs http://localhost:5213/ 40 1`: `firstFrame` under 3.2 s.

- [ ] **Step 8: WebKit.** In `scripts/webkit-check.mjs`, after 7H-1's post-game shots, add:

```js
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  await p.evaluate(() => { const G = window.__game; G.hero.teleport({ x: 184, y: 38, z: -14 }, -1.4); });
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__game.teleport({ x: 126, y: 22, z: 50 }));
  await p.waitForTimeout(1200);
  console.log('dial', JSON.stringify(await p.evaluate(() => [window.__game.post.bombs.debug?.phase ?? null, !!document.querySelector('.dh-dial.show'), !!document.querySelector('.dh-fuse.show')])));
  await p.screenshot({ path: `${out}/dial.png` });
  await p.evaluate(() => { const G = window.__game; G.post.bombs.setFuse(0.2); G.teleport({ x: 150, y: 0, z: -40 }); G.follow.snapBehind(Math.PI, -0.45); });
  await p.waitForTimeout(2000);
  await p.screenshot({ path: `${out}/army.png` });
```
Run: `node scripts/webkit-check.mjs http://localhost:5213/ "$TEMP/wk7b"`
Expected: `dial ["counter",true,true]`; `dial.png` shows the dial (the SVG wedge, the needle, the pips) and the fuse timer drawn correctly in Safari's engine; `army.png` shows the balloon army; no console errors.

- [ ] **Step 9: Look at every screenshot** from Tasks 6 to 17 in `$TEMP/g7b`. The cards read as giant playing cards in the comic look, the cake bombs as cakes (not grey cylinders) with a visible spark, the balloons as grinning purple balloons (not spheres with a seam), the dial and fuse clear and on brand, the encore's floor shapes readable, the survival crowd not clipping through the roof. Copy the best to `docs/screens/g7b-*.png`: `t11-lit`, `t11-dial`, `t11-splat`, `t12-army`, `t13-intro`, `t13-reward`, `t14-wave12`.

- [ ] **Step 10: Commit**

```bash
git add scripts/playthrough.mjs scripts/webkit-check.mjs docs/screens/g7b-*.png
git commit -m "WebKit checks the dial and the balloon army, part 2 screenshots"
```

- [ ] **Step 11:** The coordinator reviews the screenshots, the sweeps and the playthrough report, then merges and pushes `main`. No task pushes.
