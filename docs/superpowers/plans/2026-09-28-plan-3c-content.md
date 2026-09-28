# Plan 3C: Side Content Implementation Plan (challenges, street crimes, photo mode, progress)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Part C of the traversal and comic spec to the game: bat-pillar challenges (3 glide-ring courses, a rooftop parkour run, a combat arena) with medals, street crimes between story steps, a photo mode with comic filters and frames that saves a PNG, and a weighted Progress tracker with a city map, a stats line, milestone captions and a 100% reward page. The tracker's scoring is a registry, so the post-game categories of Part H register themselves later without edits to it.

**Architecture:**
- **Pure rules, thin runtime.** Every rule lives in a pure, unit-tested module with no three.js and no DOM: `progressTracker.js`, `playStats.js`, `challenges.js`, `crimes.js`, `photoMath.js`, `mapModel.js`, plus the save sanitizer in `save.js`. Runtime modules (`challengeRunner.js`, `arenaChallenge.js`, `crimeDirector.js`, `photoMode.js`) only move meshes, read input and call the pure functions.
- **One glue object.** `src/game/sideContent.js` owns the challenge runner, the crime director, the play stats and the milestone captions. The story flow sees side content only through three hooks (`holdStory`, `marker`, `onRespawn`), so `flow.js` barely grows.
- **Fights reuse the encounter system.** `encounters.begin(id, def)` now also takes an inline fight definition (site object or site key). Crimes use ids `crime:<n>`, the arena uses `challenge:bash`. The story ignores both because `objectives.handle` only matches its own fight ids.
- **Photo filters ride the ink pass.** One new uniform (`uFilter`) in the existing ink shader; no new program, no new pass.
- **Everything new is drawn once before play.** New character looks and props join `warmCast.js`, and every run-time prop is created in `buildRun` before `begin()` calls `drawEverything`.

**Tech Stack:** Three.js 0.186, plain ES modules, Vitest 5 (node environment), Playwright 1.63 (`tests/e2e`), playwright-core scripted play (`scripts/dev-play.mjs`, `scripts/fps-sweep.mjs`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-traversal-comic-content-design.md`, Part C. Post-game hooks: `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`, Part H.
- **Base tree.** Work on the merge of branch `kicks` (traversal plus mocap kicks) and branch `perf` (comic look plus performance), for example a worktree at `C:\Users\awsom\Documents\Projects\gotham-content` on branch `content`. Every path below is relative to that tree. The personal config file is `src/mansi.config.js` (not `src/config/`).
- **No em dashes** (U+2014) or en dashes in any player-visible text: captions, toasts, radio lines, menu labels, prompts, comic pages, file names. Use commas, colons or full stops. Task 19 greps for them.
- **Commits** are authored by Krishn Gohel only (the repo's `user.name` is already `Krishn Gohel`; check with `git config user.name` before the first commit). Never add a `Co-Authored-By` or any other trailer.
- **Never push.** Pushing `main` redeploys the live site. The lead pushes after Task 19.
- **Art is authored in code**: hoops, pillars, the van, loot bags, photo frames, the map. All copy in this plan is Fable-authored. No AI image tools, no downloaded art.
- **Performance.** Every new visual is pre-warmed: character looks and props in `src/game/warmCast.js`, and every run prop is created inside `buildRun` (so `begin()`'s `drawEverything` uploads it). The fps sweep (`scripts/fps-sweep.mjs`, High, `dynres=0`) must show p95 at or under 6.9 ms in every row and no frame over 25 ms after the first 5 s. First frame stays near 3 s.
- **Pure modules** import nothing from three.js, the DOM or `src/ui/`. They may import other pure data modules (`story.js`, `mapData.js`, `fights.js`, `save.js`, `mansi.config.js`, `balloonSpots.js`).
- **Browser checks run against a frozen production build only** (the dev server reloads on every edit):
  ```bash
  npx vite build --outDir "$TEMP/c3dist"
  npx vite preview --outDir "$TEMP/c3dist" --port 5206 --strictPort
  ```
  Rebuild after each code change you want to check. URL flags: `?at=<stepId>`, `?god=1`, `?new=1`, `?fight=test`, `?q=low`, `?dynres=0`.
- `window.__game` already exposes `hero`, `follow`, `combat`, `enemies`, `camera`, `world`, `ink`, `events`, `progress`, `state`, `climbables`, `teleport(site|{x,y,z})`, `spawn(type,p)`, `winFight()`, `comic`. This plan adds `side`, `photo` and `stage`.

## File Structure

| File | Responsibility |
|---|---|
| `src/core/save.js` (modify) | New progress fields and their sanitizers, `newGameProgress`, `registerProgressField` |
| `src/config/balloonSpots.js` (new) | Balloon positions and hints as plain data |
| `src/game/balloons.js` (modify) | Import `BALLOONS` from `balloonSpots.js` |
| `src/mansi.config.js` (modify) | `completionMessage` placeholder |
| `src/game/progressTracker.js` (new) | Category registry, weighted percentage, milestones, chapters, move list |
| `src/game/playStats.js` (new) | Stat counters and the stats line text |
| `src/game/challenges.js` (new) | Courses, ring and checkpoint logic, arena score, medals, threshold suggestions |
| `src/game/crimes.js` (new) | Crime spots, scheduler, blocked rule, squads, radio titles |
| `src/game/photoMath.js` (new) | Photo camera, filters and frames lists, frame layout, captions, file names |
| `src/game/mapModel.js` (new) | City map model for the Progress page |
| `src/game/encounters.js` (modify) | Inline fight definitions; clear `id` when a fight is won |
| `src/game/flow.js` (modify) | `side` hooks; story `fightStart` guard |
| `src/core/bindings.js`, `src/core/input.js` (modify) | `photo` action (KeyO, D-pad up), raw pad queries, text-field passthrough |
| `src/world/sideProps.js` (new) | Pillar, ink hoop, van and loot-bag meshes |
| `src/actors/characters.js` (modify) | `civilian` look in `createGoon` |
| `src/game/warmCast.js` (modify) | Civilian and side props in the warm-up |
| `src/ui/sideHud.js` (new) | Challenge panel, 3-2-1 panels, hints, radio, toasts, pillar markers |
| `src/game/sideContent.js` (new) | Glue: stats, districts, moves, milestones, runner, arena, crimes, menu data |
| `src/game/challengeRunner.js` (new) | Pillars, countdown, rings and checkpoints, results, fail and quit |
| `src/game/arenaChallenge.js` (new) | Arena waves and scoring on top of the runner |
| `src/game/crimeDirector.js` (new) | Spawns and clears crimes, radio, marker, counter |
| `src/render/inkPipeline.js` (modify) | `uFilter` and `uAccent` uniforms, `setFilter(name)` |
| `src/ui/photoFrame.js` (new) | Canvas drawing of frames, masthead and caption |
| `src/ui/photoMode.js` (new) | Photo mode UI, controls, preview overlay, PNG save |
| `src/ui/progressMap.js` (new) | Inked map drawing on a canvas |
| `src/game/rewardPages.js` (new) | "Mansi's Gold Standard" and "From Krishn" comic pages |
| `src/ui/menus.js` (modify) | Pause options, Challenges page, Progress page, title percentage, help lines |
| `src/ui/prompts.js` (modify) | `challenges` and `photo` prompts |
| `src/game/sound.js` (modify) | Audio for the new events |
| `src/game/game.js` (modify) | Wiring, photo freeze, pause options, pad and key guards |
| `src/ui/style.css` (modify) | Styles for everything above |
| `scripts/course-check.mjs` (new) | Validates courses and crime spots against the live collision |
| `scripts/challenge-tune.mjs` (new) | Scripted pilots that complete every challenge and print thresholds |
| `scripts/dev-play.mjs` (modify) | `type` step and download saving |
| `scripts/runs/crime.json`, `scripts/runs/photo.json` (new) | Scripted runs |
| `scripts/fps-sweep.mjs` (modify) | `side` page: challenge, crime, photo mode |
| `tests/unit/saveContent.test.js`, `progressTracker.test.js`, `playStats.test.js`, `challenges.test.js`, `crimes.test.js`, `photoMath.test.js`, `mapModel.test.js`, `encounters.test.js` (new) | Unit tests |
| `tests/e2e/content.spec.js` (new) | Browser smoke tests for all four features |

## Shared interfaces (every task relies on these exact names)

```js
// src/core/save.js
DISTRICT_IDS = ['gcpd', 'docks', 'neon', 'ace', 'clock']
MEDALS = ['bronze', 'silver', 'gold']
STAT_KEYS = ['playTime', 'kos', 'longestCombo', 'topGlideSpeed', 'distanceGlided', 'photos']
// progress gains:
//   challenges: { [challengeId]: { best: number, medal: 'bronze'|'silver'|'gold'|null } }
//   stats:      { playTime s, kos, longestCombo, topGlideSpeed m/s, distanceGlided m, photos }
//   crimes:     { stopped: int }
//   moves:      string[]   (move ids learned, see progressTracker)
//   districts:  string[]   (subset of DISTRICT_IDS)
//   milestone:  0|25|50|75|100   (highest milestone caption already shown)
//   unlocks:    string[]   ('goldStandard', 'fromKrishn'; Part H adds its own)
newGameProgress(old) -> progress        // story restarts, everything found stays
registerProgressField(key, { sanitize(raw) -> value }) -> undo   // for Part H

// src/config/balloonSpots.js
BALLOONS: { x, y, z, where }[]           // 12 entries, easiest first

// src/game/progressTracker.js
// Category: { id, label, weight > 0, count(progress) -> { done, total }, detail?(progress) -> string, active?(progress) -> boolean }
createProgressRegistry() -> { register(cat) -> undo, categories, score(progress) -> Score }
scoreProgress(progress, cats) -> Score   // Score: { percent 0..100, parts: [{ id, label, weight, done, total, fraction, detail }] }
tracker                                  // the game's registry, base categories registered
BASE_CATEGORIES, MILESTONES = [25, 50, 75, 100], CRIME_TARGET = 10, MEDAL_POINTS, CHAPTERS, BASE_MOVES, MOVE_NAMES
registerMoves(ids) -> undo, moveList() -> string[]
milestonesCrossed(from, to) -> number[]
storyCount(progress, steps?), chapterOf(stepIndex, steps?) -> { number, of, name }, nextBalloonHint(progress) -> string|null

// src/game/playStats.js
createPlayStats(stats) -> { tick(dt), glide(speed, dist), ko(n?), combo(n), photo() }
formatPlayTime(sec), formatDistance(m), formatStatsLine(stats, { crimes }) -> string

// src/game/challenges.js
// Challenge: { id, name, kind: 'rings'|'parkour'|'arena', blurb, start: { x, y, z, yaw }, limit?, medals: { gold, silver, bronze },
//              rings?: Ring[], checkpoints?: Checkpoint[] }
// Ring: { x, y, z, r, nx, ny, nz }   center is where the hero's chest (feet + 1 m) passes
// Checkpoint: { x, y, z, r, h, label, needs: 'ladder'|'ledge'|'zipline'|'wallrun'|null, nx, ny, nz }
CHALLENGES, ARENA_ID = 'challenge:bash', ARENA_FIGHT, MEDAL_NAME, MOVE_LABEL, MOVE_KIND, FINISHERS, ARENA_POINTS
withNormals(points, start, flat?) -> points with unit normals
pillarPos(ch) -> { x, y, z }
ringPass(ring, a, b) -> boolean
createRingRun(ch) -> { next, time, done, total, update(dt, a, b) -> 'ring'|'finish'|null }
createCheckpointRun(ch) -> { next, time, done, total, noteMove(id), update(dt, pos) -> 'checkpoint'|'needs'|'finish'|null }
createArenaScore(points?) -> { score, streak, multiplier, variety, hit(move) -> pts, hurt(), tick(dt) }
medalFor(ch, value), isBetter(ch, value, best), recordResult(entries, ch, value) -> { entry, newBest, medal }
allGold(entries, list?), suggestThresholds(kind, samples), formatTime(sec), formatResult(ch, value)

// src/game/crimes.js
// Spot: { id, district, x, y, z, yaw }   Crime: { id, fightId, kind, spot, age, engaged }
CRIME_KINDS = ['robbery', 'mugging', 'van'], CRIME_SPOTS, DISTRICT_LABEL, DISTRICT_PHRASE
createCrimeScheduler({ rng, minGap = 120, maxGap = 240, expiry = 180, retry = 20, spots, minDist = 35, maxDist = 260, avoidDist = 60 })
  -> { active, timer, update(dt, { blocked, visited, heroPos, avoid }) -> { type: 'spawn'|'expire', crime }|null,
       engage(), resolve() -> crime, force({ kind, spotId }) }
pickSpot(spots, visited, heroPos, rng, opts), crimeBlocked({ mode, stepType, challenge, fightId, photo }) -> boolean
crimeFight(kind, spot, rng) -> { site: { x, y, z }, radius, waves }, crimeTitle(kind, district), isCrimeId(id)

// src/game/photoMath.js
FILTERS = ['ink', 'noir', 'pop', 'sepia'], FRAMES = ['none', 'panel', 'cover'], FILTER_LABEL, FRAME_LABEL
DEFAULT_CAPTION = 'HAPPY BIRTHDAY MANSI' (from MANSI.name), CAPTION_PRESETS, PHOTO_LIMITS
cycle(list, cur, dir?), createPhotoCam({ position, target, fov }), setPhotoMode(cam, mode, anchor)
stepPhotoCam(cam, cmd, dt, anchor) -> cam    // cmd: { moveX, moveY, up, lookX, lookY, roll, zoom, fovDelta }
photoView(cam) -> { position, target, roll, fov }
frameLayout(frame, w, h) -> { u, inset, border, masthead, issue, caption }
sanitizeCaption(text) -> string, photoFileName(date) -> 'gotham-for-mansi-YYYYMMDD-HHMMSS.png'

// src/game/mapModel.js
MAP_BOUNDS, toMap(x, z, size, bounds?) -> { u, v }
mapModel({ buildings, balloons, challenges: [{ id, x, z }], progress, size = 360 })
  -> { size, water, blocks: [{ u, v, w, h, district, landmark }], balloons: [{ u, v, found }], challenges: [{ id, u, v, medal }] }

// src/game/encounters.js
begin(fightId, def = FIGHTS[fightId])   // def.site: SITES key or { x, y, z }
// id becomes null as soon as a fight is won (before 'fightDone' is emitted)

// src/game/flow.js: createFlow({ ..., side })
// side: { holdStory() -> boolean, marker() -> {x,y,z}|null, onRespawn() -> {x,y,z,yaw?}|null }

// src/core/input.js: input.padButtonHeld(i) -> boolean, input.stick -> { mx, my, lx, ly }
// src/core/bindings.js: action 'photo' (default KeyO); pad D-pad up (button 12)
// src/render/inkPipeline.js: ink.setFilter('ink'|'noir'|'pop'|'sepia'); uniforms.uFilter 0..3

// src/world/sideProps.js
createPillar() -> Group (userData.bat, userData.xray), createRingMesh() -> Group (userData.setState('next'|'later'|'done'), userData.base)
createVan() -> Group, createLootBags() -> Group

// src/ui/sideHud.js
createSideHud(root) -> { challenge(name), timer(main, sub), countdown(text), clearChallenge(), hint(text, ms),
                         radio(title, text, ms), toast(title, text, ms), marker(id, x, y, visible, medal), hideMarkers() }

// src/game/challengeRunner.js
createChallengeRunner({ scene, hero, follow, events, ui, progress, save, canStart(ch), hidden() })
  -> { active, running, current, pillars: [{ ch, at, mesh }], update(dt), start(id), quit(), takeRespawn(), nextMarker(),
       registerKind(kind, { ownsFight(id), begin(run), update(run, dt), end(run) }), finish(value), fail(reason), debug }

// src/game/crimeDirector.js
createCrimeDirector({ scene, assets, rng, events, encounters, ui, progress, save, collision, blocked(), avoid() })
  -> { active, update(dt, heroPos, visited), marker(), holdStory(), onRespawn(), force(opts) }

// src/game/sideContent.js
createSideContent({ scene, assets, hero, follow, combat, encounters, events, flow, hudRoot, prompts, progress, storage, rng, collision, buildings })
  -> { ui, stats, challenges, crimes, data, score(), update(dt, real, { toScreen }), flowHooks, photoTaken(),
       pauseInfo(), challengesPage(), progressPage() }

// src/ui/photoMode.js
createPhotoMode({ root, camera, renderer, ink, scene, hero, input, sound, getTime, getIssue, onOpen, onClose, onSaved })
  -> { active, open(), close(), update(real), save() }

// New events: challengeStart {id}, countdown {beat}, ringPass {index}, checkpoint {index},
// challengeDone {id, value, medal, newBest}, challengeFail {id, reason}, crimeSpawn {id, kind, district},
// crimeStopped {count}, crimeEnd {id, outcome}, districtVisited {id}, milestone {percent}, unlock {id},
// photoOpen, photoClose, photoSaved.
```

## Extending the tracker (for Part D and Part H)

Nothing in `progressTracker.js` changes when a new category arrives. A post-game module registers itself at load time and adds its saved field through `save.js`:

```js
// src/game/jokerCrates.js (Part H), at module load
import { tracker } from './progressTracker.js';
import { registerProgressField } from '../core/save.js';
registerProgressField('crates', { sanitize: (raw) => (Array.isArray(raw) ? [...new Set(raw.filter(Number.isInteger))].slice(0, 20) : []) });
tracker.register({
  id: 'crates', label: 'Joker crates', weight: 10, active: (p) => p.finished,
  count: (p) => ({ done: p.crates.length, total: 20 }),
  detail: (p) => `${p.crates.length} of 20 opened`,
});
```

- The percentage is the weighted mean over the **active** categories. A category with `active: (p) => p.finished` only counts after the credits, and then the total rescales to its weight plus 100.
- Milestone captions and the 100% page are sticky: `progress.milestone` and `progress.unlocks` stop them firing twice or locking again when a new category lowers the percentage.
- Part D adds its two moves with `registerMoves(['silentTakedown', 'perchDrop'])` and emits `moveLearned` for them.
- A module that registers must be imported by `game.js` before `loadProgress` runs, so its field survives the first load.

---

### Task 1: Save schema for side content

**Files:**
- Modify: `src/core/save.js`
- Test: `tests/unit/saveContent.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `DEFAULT_PROGRESS` with the new fields, `sanitizeProgress`, `newGameProgress`, `registerProgressField`, `DISTRICT_IDS`, `MEDALS`, `STAT_KEYS`, `MILESTONE_STEPS`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/saveContent.test.js
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROGRESS, sanitizeProgress, loadProgress, saveProgress, newGameProgress, registerProgressField } from '../../src/core/save.js';

const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

describe('side content progress fields', () => {
  it('defaults every new field', () => {
    const p = sanitizeProgress({});
    expect(p.challenges).toEqual({});
    expect(p.stats).toEqual({ playTime: 0, kos: 0, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 });
    expect(p.crimes).toEqual({ stopped: 0 });
    expect(p.moves).toEqual([]);
    expect(p.districts).toEqual([]);
    expect(p.milestone).toBe(0);
    expect(p.unlocks).toEqual([]);
  });
  it('matches DEFAULT_PROGRESS and hands out fresh objects', () => {
    expect(sanitizeProgress({})).toEqual(DEFAULT_PROGRESS);
    const p = sanitizeProgress(DEFAULT_PROGRESS);
    p.stats.kos = 9;
    p.moves.push('ladder');
    expect(DEFAULT_PROGRESS.stats.kos).toBe(0);
    expect(DEFAULT_PROGRESS.moves).toEqual([]);
  });
  it('keeps valid challenge bests and drops junk', () => {
    const p = sanitizeProgress({ challenges: {
      signalToSea: { best: 12.5, medal: 'gold' },
      bad: 'x',
      'no spaces': { best: 1, medal: 'gold' },
      neonSlalom: { best: -1, medal: 'gold' },
      bellTowerDive: { best: 20, medal: 'platinum' },
      birthdayBash: { best: Infinity },
    } });
    expect(p.challenges).toEqual({ signalToSea: { best: 12.5, medal: 'gold' }, bellTowerDive: { best: 20, medal: null } });
    expect(sanitizeProgress({ challenges: [1, 2] }).challenges).toEqual({});
  });
  it('clamps stats to finite, non-negative numbers, whole where counted', () => {
    const p = sanitizeProgress({ stats: { playTime: 'x', kos: 3.7, longestCombo: -2, topGlideSpeed: 41.5, distanceGlided: NaN, photos: 2 } });
    expect(p.stats).toEqual({ playTime: 0, kos: 3, longestCombo: 0, topGlideSpeed: 41.5, distanceGlided: 0, photos: 2 });
  });
  it('sanitizes crimes, moves, districts, milestone and unlocks', () => {
    const p = sanitizeProgress({
      crimes: { stopped: 12.9 }, moves: ['ladder', 'ladder', 7, 'x y', 'counter'],
      districts: ['neon', 'neon', 'moon', 'docks'], milestone: 60, unlocks: ['goldStandard', 'goldStandard', 3],
    });
    expect(p.crimes.stopped).toBe(12);
    expect(p.moves).toEqual(['ladder', 'counter']);
    expect(p.districts).toEqual(['neon', 'docks']);
    expect(p.milestone).toBe(0);
    expect(p.unlocks).toEqual(['goldStandard']);
    expect(sanitizeProgress({ crimes: 'x' }).crimes.stopped).toBe(0);
    expect(sanitizeProgress({ crimes: { stopped: -3 } }).crimes.stopped).toBe(0);
    expect(sanitizeProgress({ milestone: 50 }).milestone).toBe(50);
  });
  it('round-trips every new field through storage', () => {
    const st = memoryStorage();
    const p = sanitizeProgress({
      step: 4, challenges: { neonSlalom: { best: 9.5, medal: 'silver' } }, stats: { playTime: 100, kos: 4, longestCombo: 12, topGlideSpeed: 30, distanceGlided: 900, photos: 1 },
      crimes: { stopped: 3 }, moves: ['zipline'], districts: ['gcpd'], milestone: 25, unlocks: ['fromKrishn'],
    });
    saveProgress(st, p);
    expect(loadProgress(st)).toEqual(p);
  });
  it('new game restarts the story and keeps everything found', () => {
    const old = sanitizeProgress({
      step: 20, finished: true, seenIntro: true, suit: 'f', balloons: [1, 2], goldUnlocked: true,
      challenges: { neonSlalom: { best: 9.5, medal: 'gold' } }, crimes: { stopped: 5 }, moves: ['ladder'], districts: ['neon'], milestone: 50, unlocks: ['goldStandard'],
      stats: { kos: 40 },
    });
    const p = newGameProgress(old);
    expect(p.step).toBe(0);
    expect(p.finished).toBe(false);
    expect(p.seenIntro).toBe(false);
    expect(p.suit).toBe(null);
    expect(p.balloons).toEqual([1, 2]);
    expect(p.goldUnlocked).toBe(true);
    expect(p.challenges.neonSlalom.medal).toBe('gold');
    expect(p.crimes.stopped).toBe(5);
    expect(p.moves).toEqual(['ladder']);
    expect(p.districts).toEqual(['neon']);
    expect(p.milestone).toBe(50);
    expect(p.unlocks).toEqual(['goldStandard']);
    expect(p.stats.kos).toBe(40);
  });
  it('lets later parts register their own saved fields', () => {
    const undo = registerProgressField('crates', { sanitize: (raw) => (Array.isArray(raw) ? raw.filter(Number.isInteger) : []) });
    expect(sanitizeProgress({ crates: [1, 'x', 3] }).crates).toEqual([1, 3]);
    expect(sanitizeProgress({}).crates).toEqual([]);
    expect(() => registerProgressField('stats', { sanitize: () => 0 })).toThrow();
    undo();
    expect('crates' in sanitizeProgress({})).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/unit/saveContent.test.js`
Expected: FAIL (`newGameProgress` and `registerProgressField` are not exported; new fields missing).

- [ ] **Step 3: Replace `src/core/save.js`**

```js
const KEY = 'gotham-mansi-progress-v1';
export const BALLOON_COUNT = 12;
export const DISTRICT_IDS = ['gcpd', 'docks', 'neon', 'ace', 'clock'];
export const MEDALS = ['bronze', 'silver', 'gold'];
export const MILESTONE_STEPS = [0, 25, 50, 75, 100];
export const STAT_KEYS = ['playTime', 'kos', 'longestCombo', 'topGlideSpeed', 'distanceGlided', 'photos'];
const WHOLE_STATS = new Set(['kos', 'longestCombo', 'photos']);
const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;

export const DEFAULT_PROGRESS = {
  step: 0,
  balloons: [],
  suit: null,
  goldUnlocked: false,
  seenIntro: false,
  finished: false,
  challenges: {},
  stats: { playTime: 0, kos: 0, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 },
  crimes: { stopped: 0 },
  moves: [],
  districts: [],
  milestone: 0,
  unlocks: [],
};

// Later parts (the post-game in Part H) add saved fields here instead of editing
// sanitizeProgress. Returns an undo, mainly for tests.
const extraFields = new Map();
export function registerProgressField(key, { sanitize }) {
  if (key in DEFAULT_PROGRESS || extraFields.has(key)) throw new Error(`progress field "${key}" already exists`);
  extraFields.set(key, sanitize);
  return () => extraFields.delete(key);
}

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const amount = (v, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, v) : 0);
function idList(v, allowed = null, max = 32) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((s) => typeof s === 'string' && ID.test(s) && (!allowed || allowed.includes(s))))].slice(0, max);
}
function sanitizeChallenges(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const [id, r] of Object.entries(raw).slice(0, 32)) {
    if (!ID.test(id) || !isObj(r)) continue;
    if (typeof r.best !== 'number' || !Number.isFinite(r.best) || r.best < 0) continue;
    out[id] = { best: r.best, medal: MEDALS.includes(r.medal) ? r.medal : null };
  }
  return out;
}
function sanitizeStats(raw) {
  const r = isObj(raw) ? raw : {};
  const out = {};
  for (const k of STAT_KEYS) out[k] = WHOLE_STATS.has(k) ? Math.floor(amount(r[k])) : amount(r[k]);
  return out;
}

export function sanitizeProgress(raw = {}) {
  const r = isObj(raw) ? raw : {};
  const balloons = Array.isArray(r.balloons)
    ? [...new Set(r.balloons.filter((b) => Number.isInteger(b) && b >= 0 && b < BALLOON_COUNT))]
    : [];
  const out = {
    step: Number.isInteger(r.step) && r.step >= 0 ? r.step : 0,
    balloons,
    suit: ['m', 'f', 'gold'].includes(r.suit) ? r.suit : null,
    goldUnlocked: r.goldUnlocked === true,
    seenIntro: r.seenIntro === true,
    finished: r.finished === true,
    challenges: sanitizeChallenges(r.challenges),
    stats: sanitizeStats(r.stats),
    crimes: { stopped: Math.floor(amount(isObj(r.crimes) ? r.crimes.stopped : 0, 1e6)) },
    moves: idList(r.moves),
    districts: idList(r.districts, DISTRICT_IDS),
    milestone: MILESTONE_STEPS.includes(r.milestone) ? r.milestone : 0,
    unlocks: idList(r.unlocks),
  };
  for (const [key, sanitize] of extraFields) out[key] = sanitize(r[key]);
  return out;
}

// A new game restarts the story. Balloons, medals, stats and everything else found stay.
export function newGameProgress(old) {
  return { ...sanitizeProgress(old), step: 0, suit: null, seenIntro: false, finished: false };
}

export function loadProgress(storage) {
  try {
    const raw = storage?.getItem(KEY);
    return sanitizeProgress(raw ? JSON.parse(raw) : {});
  } catch {
    return sanitizeProgress({});
  }
}

export function saveProgress(storage, progress) {
  try { storage?.setItem(KEY, JSON.stringify(progress)); } catch { /* storage unavailable */ }
}

export function clearProgress(storage) {
  try { storage?.setItem(KEY, JSON.stringify(DEFAULT_PROGRESS)); } catch { /* storage unavailable */ }
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/saveContent.test.js tests/unit/persistence.test.js`
Expected: PASS, including the old persistence tests.

- [ ] **Step 5: Commit**

```bash
git config user.name   # must print: Krishn Gohel
git add src/core/save.js tests/unit/saveContent.test.js
git commit -m "Save schema for challenges, crimes, stats, moves and districts"
```

---

### Task 2: Balloon spots, completion message and the progress tracker

**Files:**
- Create: `src/config/balloonSpots.js`
- Modify: `src/game/balloons.js` (import the list)
- Modify: `src/mansi.config.js` (add `completionMessage`)
- Create: `src/game/progressTracker.js`
- Test: `tests/unit/progressTracker.test.js`

This task imports `CHALLENGES` from `src/game/challenges.js` and `DISTRICT_LABEL` from `src/game/crimes.js`. Tasks 4 and 5 fill those files. To keep this task green on its own, create both files now with a stub, and Tasks 4 and 5 replace them:

```js
// src/game/challenges.js (stub, replaced in Task 4)
export const CHALLENGES = [];
```
```js
// src/game/crimes.js (stub, replaced in Task 5)
export const DISTRICT_LABEL = { gcpd: 'GCPD', docks: 'The Docks', neon: 'Neon Row', ace: 'Ace Chemicals', clock: 'The Clock Plaza' };
```

**Interfaces:**
- Consumes: `sanitizeProgress`, `BALLOON_COUNT`, `DISTRICT_IDS` (Task 1); `STEPS`; `CHALLENGES` (Task 4); `DISTRICT_LABEL` (Task 5).
- Produces: `BALLOONS`, `MANSI.completionMessage`, and everything under `progressTracker.js` in Shared interfaces.

- [ ] **Step 1: Move the balloon data.** Create `src/config/balloonSpots.js` with the 12 entries cut from `src/game/balloons.js`, unchanged:

```js
// The 12 birthday balloon spots, easiest first. Plain data, so the progress tracker and the
// Progress map read it without loading three.js.
export const BALLOONS = [
  { x: 12, y: 46.2, z: 12, where: 'On the GCPD stair hut' },
  { x: -52, y: 24.6, z: 172, where: 'On a docks water tower' },
  { x: -20, y: 33.8, z: 215, where: 'At the end of a crane boom' },
  { x: -44, y: 33.8, z: 221.5, where: 'On the freighter funnel' },
  { x: 140, y: 31.4, z: 270, where: 'On top of the lighthouse' },
  { x: 120, y: 40, z: 19, where: 'On the Gazette billboard' },
  { x: 158.7, y: 2.2, z: -60, where: 'Under the Monarch marquee' },
  { x: 186, y: 24, z: -52, where: 'Behind the Monarch stage' },
  { x: 112, y: 57.8, z: -191, where: 'On an Ace Chemicals smokestack' },
  { x: 135, y: 11.2, z: -118, where: 'Over the chemical vats' },
  { x: -129, y: 49.4, z: -125.6, where: 'On a cathedral tower' },
  { x: -120, y: 38.8, z: -165, where: 'On the cathedral roof ridge' },
];
```

In `src/game/balloons.js`, delete the `export const BALLOONS = [...]` block and add under the other imports:

```js
import { BALLOONS } from '../config/balloonSpots.js';
export { BALLOONS };
```

- [ ] **Step 2: Add the completion message** to `src/mansi.config.js`, after `finalMessage`:

```js
  // Shown on the closing comic page, "From Krishn", once the Progress page reaches 100%.
  // PLACEHOLDER: Krishn writes the real message before sharing.
  completionMessage: 'One hundred percent. Every balloon found, every medal won, every street kept safe. Gotham is yours, Mansi. Happy birthday.',
```

- [ ] **Step 3: Write the failing tests**

```js
// tests/unit/progressTracker.test.js
import { describe, it, expect } from 'vitest';
import { sanitizeProgress, DISTRICT_IDS, BALLOON_COUNT } from '../../src/core/save.js';
import { STEPS } from '../../src/game/story.js';
import { CHALLENGES } from '../../src/game/challenges.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';
import {
  tracker, createProgressRegistry, scoreProgress, BASE_CATEGORIES, BASE_MOVES, registerMoves, moveList,
  milestonesCrossed, chapterOf, nextBalloonHint, storyCount,
} from '../../src/game/progressTracker.js';

const allGold = () => Object.fromEntries(CHALLENGES.map((c) => [c.id, { best: 1, medal: 'gold' }]));
const finished = () => sanitizeProgress({
  step: STEPS.length - 1, finished: true, balloons: [...Array(BALLOON_COUNT).keys()], challenges: allGold(),
  crimes: { stopped: 10 }, moves: BASE_MOVES, districts: DISTRICT_IDS,
});
const part = (s, id) => s.parts.find((p) => p.id === id);

describe('progress percentage', () => {
  it('uses the spec weights', () => {
    expect(BASE_CATEGORIES.map((c) => [c.id, c.weight])).toEqual([
      ['story', 40], ['balloons', 20], ['challenges', 20], ['crimes', 10], ['moves', 5], ['districts', 5],
    ]);
  });
  it('is 0 for an empty save', () => {
    const s = tracker.score(sanitizeProgress({}));
    expect(s.percent).toBe(0);
    expect(s.parts).toHaveLength(6);
  });
  it('is 100 for a finished save', () => {
    expect(tracker.score(finished()).percent).toBe(100);
  });
  it('gives 40 for the story alone and 20 at the halfway step', () => {
    expect(tracker.score(sanitizeProgress({ finished: true, step: STEPS.length - 1 })).percent).toBe(40);
    expect(tracker.score(sanitizeProgress({ step: (STEPS.length - 1) / 2 })).percent).toBe(20);
  });
  it('counts balloons and medal points', () => {
    expect(tracker.score(sanitizeProgress({ balloons: [0, 1, 2, 3, 4, 5] })).percent).toBe(10);
    const one = sanitizeProgress({ challenges: { [CHALLENGES[0].id]: { best: 1, medal: 'gold' } } });
    expect(part(tracker.score(one), 'challenges').done).toBe(3);
    expect(part(tracker.score(one), 'challenges').total).toBe(CHALLENGES.length * 3);
  });
  it('caps crimes at 10 for the percentage but reports every one stopped', () => {
    const s = tracker.score(sanitizeProgress({ crimes: { stopped: 25 } }));
    expect(part(s, 'crimes').fraction).toBe(1);
    expect(part(s, 'crimes').done).toBe(10);
    expect(part(s, 'crimes').detail).toContain('25');
    expect(s.percent).toBe(10);
  });
  it('never shows 100 until every category is complete', () => {
    const p = finished();
    p.districts = DISTRICT_IDS.slice(1);
    expect(tracker.score(p).percent).toBe(99);
    const q = finished();
    q.moves = BASE_MOVES.slice(1);
    expect(tracker.score(q).percent).toBe(99);
  });
  it('ignores medals for unknown challenge ids', () => {
    expect(part(tracker.score(sanitizeProgress({ challenges: { retired: { best: 1, medal: 'gold' } } })), 'challenges').done).toBe(0);
  });
});

describe('category registry', () => {
  const cat = (id, weight, done, total, extra = {}) => ({ id, label: id, weight, count: () => ({ done, total }), ...extra });
  it('weights and normalizes over active categories', () => {
    const r = createProgressRegistry();
    r.register(cat('a', 50, 1, 2));
    r.register(cat('b', 50, 3, 3));
    expect(r.score({}).percent).toBe(75);
    r.register(cat('post', 100, 0, 5, { active: (p) => p.finished }));
    expect(r.score({ finished: false }).percent).toBe(75);
    expect(r.score({ finished: true }).percent).toBe(37);
  });
  it('replaces a category with the same id and can unregister', () => {
    const r = createProgressRegistry();
    const undo = r.register(cat('a', 10, 0, 1));
    r.register(cat('a', 10, 1, 1));
    expect(r.categories).toHaveLength(1);
    expect(r.score({}).percent).toBe(100);
    r.register(cat('b', 10, 0, 1));
    undo();
    // The undo belonged to the replaced object, so it removes nothing.
    expect(r.categories.map((c) => c.id)).toEqual(['a', 'b']);
    const undoB = r.register(cat('c', 10, 0, 1));
    undoB();
    expect(r.categories.map((c) => c.id)).toEqual(['a', 'b']);
  });
  it('rejects bad categories', () => {
    const r = createProgressRegistry();
    expect(() => r.register({ label: 'x', weight: 1, count: () => ({ done: 0, total: 1 }) })).toThrow();
    expect(() => r.register(cat('x', 0, 0, 1))).toThrow();
    expect(() => r.register({ id: 'x', weight: 1 })).toThrow();
  });
  it('treats an empty category as complete and an empty registry as 0', () => {
    expect(scoreProgress({}, [cat('a', 10, 0, 0)]).percent).toBe(100);
    expect(scoreProgress({}, []).percent).toBe(0);
  });
});

describe('helpers', () => {
  it('lists the milestones crossed', () => {
    expect(milestonesCrossed(0, 24)).toEqual([]);
    expect(milestonesCrossed(0, 25)).toEqual([25]);
    expect(milestonesCrossed(20, 80)).toEqual([25, 50, 75]);
    expect(milestonesCrossed(75, 99)).toEqual([]);
    expect(milestonesCrossed(75, 100)).toEqual([100]);
    expect(milestonesCrossed(100, 100)).toEqual([]);
  });
  it('names the chapter of a step', () => {
    expect(chapterOf(0)).toEqual({ number: 1, of: 5, name: 'The Signal' });
    expect(chapterOf(STEPS.findIndex((s) => s.id === 'toNeon'))).toMatchObject({ number: 3, name: 'Neon Row' });
    expect(chapterOf(STEPS.findIndex((s) => s.id === 'boss'))).toMatchObject({ number: 5, name: 'The Clock Tower' });
  });
  it('counts story steps up to the credits', () => {
    expect(storyCount(sanitizeProgress({ step: 3 }))).toEqual({ done: 3, total: STEPS.length - 1 });
    expect(storyCount(sanitizeProgress({ step: 999 })).done).toBe(STEPS.length - 1);
  });
  it('hints at the next unfound balloon', () => {
    expect(nextBalloonHint(sanitizeProgress({ balloons: [0, 1] }))).toBe(BALLOONS[2].where);
    expect(nextBalloonHint(sanitizeProgress({ balloons: [...Array(12).keys()] }))).toBe(null);
  });
  it('lets Part D register more moves', () => {
    const undo = registerMoves(['silentTakedown', 'perchDrop', 'ladder']);
    expect(moveList()).toEqual([...BASE_MOVES, 'silentTakedown', 'perchDrop']);
    expect(part(tracker.score(sanitizeProgress({ moves: BASE_MOVES })), 'moves').total).toBe(10);
    undo();
    expect(moveList()).toEqual(BASE_MOVES);
  });
  it('writes no em or en dashes in any detail text', () => {
    for (const p of [sanitizeProgress({}), finished()]) for (const x of tracker.score(p).parts) expect(x.detail).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 4: Run to see it fail**

Run: `npx vitest run tests/unit/progressTracker.test.js`
Expected: FAIL (module missing).

- [ ] **Step 5: Write `src/game/progressTracker.js`**

```js
// Weighted completion for the Progress page, the title screen and the milestone captions. Pure.
// Categories register themselves, so later parts (Part D moves, the Part H post-game) add their
// own without editing this file. See "Extending the tracker" in docs/superpowers/plans/2026-09-28-plan-3c-content.md.
import { STEPS } from './story.js';
import { BALLOON_COUNT, DISTRICT_IDS } from '../core/save.js';
import { BALLOONS } from '../config/balloonSpots.js';
import { CHALLENGES } from './challenges.js';
import { DISTRICT_LABEL } from './crimes.js';

export const MILESTONES = [25, 50, 75, 100];
export const CRIME_TARGET = 10;
export const MEDAL_POINTS = { bronze: 1, silver: 2, gold: 3 };
export const CHAPTERS = [
  { name: 'The Signal', first: 'intro' },
  { name: 'The Docks', first: 'toDocks' },
  { name: 'Neon Row', first: 'toNeon' },
  { name: 'Ace Chemicals', first: 'toAce' },
  { name: 'The Clock Tower', first: 'toTower' },
];
export const BASE_MOVES = ['ladder', 'ledge', 'zipline', 'wallrun', 'divebomb', 'throw', 'slam', 'counter'];
export const MOVE_NAMES = {
  ladder: 'ladder', ledge: 'ledge grab', zipline: 'zipline', wallrun: 'wall run', divebomb: 'dive bomb',
  throw: 'throw', slam: 'ground slam', counter: 'counter', silentTakedown: 'silent takedown', perchDrop: 'perch drop',
};

const moves = [...BASE_MOVES];
// Part D adds 'silentTakedown' and 'perchDrop' when stealth ships. Returns an undo.
export function registerMoves(ids) {
  const added = ids.filter((id, i) => !moves.includes(id) && ids.indexOf(id) === i);
  moves.push(...added);
  return () => { for (const id of added) { const i = moves.indexOf(id); if (i >= 0) moves.splice(i, 1); } };
}
export const moveList = () => [...moves];

export function createProgressRegistry() {
  const cats = [];
  return {
    register(cat) {
      if (!cat || typeof cat.id !== 'string' || !cat.id) throw new Error('progress category needs an id');
      if (!(typeof cat.weight === 'number' && cat.weight > 0)) throw new Error(`progress category ${cat.id} needs a positive weight`);
      if (typeof cat.count !== 'function') throw new Error(`progress category ${cat.id} needs count(progress)`);
      const i = cats.findIndex((c) => c.id === cat.id);
      if (i >= 0) cats[i] = cat; else cats.push(cat);
      return () => { const j = cats.indexOf(cat); if (j >= 0) cats.splice(j, 1); };
    },
    get categories() { return cats.slice(); },
    score(progress) { return scoreProgress(progress, cats); },
  };
}

// Weighted mean of each active category's done/total. Shows 100 only when everything is done.
export function scoreProgress(progress, cats) {
  const parts = [];
  let weights = 0, earned = 0, complete = true;
  for (const c of cats) {
    if (c.active && !c.active(progress)) continue;
    const { done, total } = c.count(progress);
    const fraction = total > 0 ? Math.min(1, Math.max(0, done) / total) : 1;
    weights += c.weight;
    earned += c.weight * fraction;
    if (fraction < 1) complete = false;
    parts.push({ id: c.id, label: c.label, weight: c.weight, done, total, fraction, detail: c.detail ? c.detail(progress) : '' });
  }
  const percent = !weights ? 0 : complete ? 100 : Math.min(99, Math.floor((100 * earned) / weights + 1e-9));
  return { percent, parts };
}

export const milestonesCrossed = (from, to) => MILESTONES.filter((m) => m > from && m <= to);

export function storyCount(p, steps = STEPS) {
  const total = steps.length - 1; // reaching the credits step finishes the story
  return { done: p.finished ? total : Math.min(Math.max(0, p.step), total), total };
}

export function chapterOf(stepIndex, steps = STEPS) {
  let index = 0;
  CHAPTERS.forEach((c, i) => {
    const at = steps.findIndex((s) => s.id === c.first);
    if (at >= 0 && at <= stepIndex) index = i;
  });
  return { number: index + 1, of: CHAPTERS.length, name: CHAPTERS[index].name };
}

export function nextBalloonHint(p) {
  const i = BALLOONS.findIndex((_, k) => !p.balloons.includes(k));
  return i < 0 ? null : BALLOONS[i].where;
}

const medalPoints = (p) => CHALLENGES.reduce((n, ch) => n + (MEDAL_POINTS[p.challenges[ch.id]?.medal] ?? 0), 0);

export const BASE_CATEGORIES = [
  {
    id: 'story', label: 'Story', weight: 40, count: (p) => storyCount(p),
    detail: (p) => {
      if (p.finished) return 'Complete';
      const c = chapterOf(p.step);
      return `Chapter ${c.number} of ${c.of}: ${c.name}`;
    },
  },
  {
    id: 'balloons', label: 'Balloons', weight: 20, count: (p) => ({ done: p.balloons.length, total: BALLOON_COUNT }),
    detail: (p) => { const h = nextBalloonHint(p); return h ? `Next: ${h}` : 'All twelve found'; },
  },
  {
    id: 'challenges', label: 'Challenge medals', weight: 20, count: (p) => ({ done: medalPoints(p), total: CHALLENGES.length * 3 }),
    detail: (p) => `${CHALLENGES.filter((ch) => p.challenges[ch.id]?.medal === 'gold').length} of ${CHALLENGES.length} gold`,
  },
  {
    id: 'crimes', label: 'Street crimes', weight: 10, count: (p) => ({ done: Math.min(p.crimes.stopped, CRIME_TARGET), total: CRIME_TARGET }),
    detail: (p) => `Stopped ${p.crimes.stopped}`,
  },
  {
    id: 'moves', label: 'Moves learned', weight: 5, count: (p) => ({ done: moves.filter((m) => p.moves.includes(m)).length, total: moves.length }),
    detail: (p) => {
      const left = moves.filter((m) => !p.moves.includes(m));
      return left.length ? `Still to try: ${left.map((m) => MOVE_NAMES[m] ?? m).join(', ')}` : 'All learned';
    },
  },
  {
    id: 'districts', label: 'Districts visited', weight: 5, count: (p) => ({ done: p.districts.length, total: DISTRICT_IDS.length }),
    detail: (p) => {
      const left = DISTRICT_IDS.filter((d) => !p.districts.includes(d));
      return left.length ? `Not yet: ${left.map((d) => DISTRICT_LABEL[d]).join(', ')}` : 'All five visited';
    },
  },
];

export const tracker = createProgressRegistry();
for (const c of BASE_CATEGORIES) tracker.register(c);
```

- [ ] **Step 6: Run the tests.** With the Task 2 stub (`CHALLENGES = []`) the challenge category has a total of 0, which counts as complete, so the percentage tests can't pass yet. Run the registry and helper tests now:

Run: `npx vitest run tests/unit/progressTracker.test.js -t "category registry|helpers"`
Expected: PASS. The "progress percentage" tests pass once Task 4 lands (Task 4, Step 6 reruns the whole file).

- [ ] **Step 7: Commit**

```bash
git add src/config/balloonSpots.js src/game/balloons.js src/mansi.config.js src/game/progressTracker.js src/game/challenges.js src/game/crimes.js tests/unit/progressTracker.test.js
git commit -m "Progress tracker: weighted categories, milestones and a registry for later parts"
```

---

### Task 3: Play stats

**Files:**
- Create: `src/game/playStats.js`
- Test: `tests/unit/playStats.test.js`

**Interfaces:**
- Consumes: the `stats` object shape from Task 1.
- Produces: `createPlayStats`, `formatPlayTime`, `formatDistance`, `formatStatsLine`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/playStats.test.js
import { describe, it, expect } from 'vitest';
import { sanitizeProgress } from '../../src/core/save.js';
import { createPlayStats, formatPlayTime, formatDistance, formatStatsLine } from '../../src/game/playStats.js';

describe('play stats', () => {
  it('accumulates time, KOs, glide distance and keeps the bests', () => {
    const { stats } = sanitizeProgress({});
    const s = createPlayStats(stats);
    s.tick(1.5); s.tick(0.5);
    s.ko(); s.ko(2);
    s.combo(5); s.combo(12); s.combo(3);
    s.glide(20, 1); s.glide(35, 2.5); s.glide(18, 0.5);
    s.photo();
    expect(stats).toEqual({ playTime: 2, kos: 3, longestCombo: 12, topGlideSpeed: 35, distanceGlided: 4, photos: 1 });
  });
  it('formats play time', () => {
    expect(formatPlayTime(45)).toBe('45 s');
    expect(formatPlayTime(600)).toBe('10 min');
    expect(formatPlayTime(3725)).toBe('1 h 02 min');
  });
  it('formats distance', () => {
    expect(formatDistance(640.4)).toBe('640 m');
    expect(formatDistance(3400)).toBe('3.4 km');
  });
  it('builds the stats line with singular and plural forms and no dashes', () => {
    const line = formatStatsLine({ playTime: 4330, kos: 1, longestCombo: 37, topGlideSpeed: 47.8, distanceGlided: 3400, photos: 0 }, { crimes: 12 });
    expect(line).toBe('Play time 1 h 12 min · 1 goon knocked out · 12 crimes stopped · Longest combo 37 · Top glide speed 172 km/h · 3.4 km glided');
    expect(formatStatsLine({ playTime: 0, kos: 2, longestCombo: 0, topGlideSpeed: 0, distanceGlided: 0, photos: 0 }, { crimes: 1 })).toContain('1 crime stopped');
    expect(line).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/playStats.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/game/playStats.js`**

```js
// Counters for the Progress page stats line. Pure: the game feeds it, save.js keeps it.
export function createPlayStats(stats) {
  return {
    tick(dt) { stats.playTime += dt; },
    glide(speed, dist) {
      if (speed > stats.topGlideSpeed) stats.topGlideSpeed = speed;
      stats.distanceGlided += dist;
    },
    ko(n = 1) { stats.kos += n; },
    combo(n) { if (n > stats.longestCombo) stats.longestCombo = n; },
    photo() { stats.photos += 1; },
  };
}

export function formatPlayTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const formatDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function formatStatsLine(s, { crimes = 0 } = {}) {
  return [
    `Play time ${formatPlayTime(s.playTime)}`,
    `${plural(s.kos, 'goon', 'goons')} knocked out`,
    `${plural(crimes, 'crime', 'crimes')} stopped`,
    `Longest combo ${s.longestCombo}`,
    `Top glide speed ${Math.round(s.topGlideSpeed * 3.6)} km/h`,
    `${formatDistance(s.distanceGlided)} glided`,
  ].join(' · ');
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/playStats.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/playStats.js tests/unit/playStats.test.js
git commit -m "Play stats counters and the stats line"
```

---

### Task 4: Challenge courses and maths

**Files:**
- Replace: `src/game/challenges.js` (the Task 2 stub)
- Test: `tests/unit/challenges.test.js`

The course coordinates below are first drafts. They follow streets (x = 30, x = 150) and open plazas so nothing blocks the hoops, and descend at about 1:5 to 1:7 to match the glide (17 m/s cruise, 2.4 m/s sink). Task 16's `course-check.mjs` validates them against the live collision and `challenge-tune.mjs` sets the medal times.

**Interfaces:**
- Consumes: `SITES` from `src/world/mapData.js`.
- Produces: everything under `challenges.js` in Shared interfaces.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/challenges.test.js
import { describe, it, expect } from 'vitest';
import {
  CHALLENGES, ARENA_FIGHT, withNormals, pillarPos, ringPass, createRingRun, createCheckpointRun, createArenaScore,
  medalFor, isBetter, recordResult, allGold, suggestThresholds, formatTime, formatResult,
} from '../../src/game/challenges.js';

const ring = (z, extra = {}) => ({ x: 0, y: 1, z, r: 4, ...extra });

describe('courses', () => {
  it('has three ring courses, a parkour run and an arena, with valid medals', () => {
    expect(CHALLENGES.map((c) => c.kind)).toEqual(['rings', 'rings', 'rings', 'parkour', 'arena']);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      const m = c.medals;
      if (c.kind === 'arena') expect(m.gold > m.silver && m.silver > m.bronze).toBe(true);
      else { expect(m.gold < m.silver && m.silver < m.bronze && m.bronze < c.limit).toBe(true); }
      expect(c.name).not.toMatch(/[\u2013\u2014]/);
      expect(c.blurb).not.toMatch(/[\u2013\u2014]/);
    }
  });
  it('gives every ring and checkpoint a unit normal', () => {
    for (const c of CHALLENGES) for (const p of [...(c.rings ?? []), ...(c.checkpoints ?? [])]) {
      expect(Math.hypot(p.nx, p.ny, p.nz)).toBeCloseTo(1, 6);
    }
    for (const p of CHALLENGES.find((c) => c.kind === 'parkour').checkpoints) expect(p.ny).toBe(0);
  });
  it('needs a ladder, a ledge, a zipline and a wall run on the parkour run', () => {
    const needs = CHALLENGES.find((c) => c.kind === 'parkour').checkpoints.map((c) => c.needs).filter(Boolean);
    expect(needs.sort()).toEqual(['ladder', 'ledge', 'wallrun', 'zipline']);
  });
  it('puts the pillar 2 m behind the start pose', () => {
    const p = pillarPos({ start: { x: 10, y: 5, z: 10, yaw: 0 } });
    expect(p).toEqual({ x: 10, y: 5, z: 8 });
  });
  it('fights the arena in three waves', () => {
    expect(ARENA_FIGHT.waves).toHaveLength(3);
  });
});

describe('ring pass', () => {
  const [r] = withNormals([ring(0)], { x: 0, y: 1, z: -10 });
  it('passes through the middle and near the edge, either way', () => {
    expect(ringPass(r, { x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: 1 })).toBe(true);
    expect(ringPass(r, { x: 3.5, y: 1, z: -1 }, { x: 3.5, y: 1, z: 1 })).toBe(true);
    expect(ringPass(r, { x: 0, y: 1, z: 1 }, { x: 0, y: 1, z: -1 })).toBe(true);
  });
  it('misses outside the radius, short of the plane, or parallel to it', () => {
    expect(ringPass(r, { x: 4.5, y: 1, z: -1 }, { x: 4.5, y: 1, z: 1 })).toBe(false);
    expect(ringPass(r, { x: 0, y: 1, z: -3 }, { x: 0, y: 1, z: -1 })).toBe(false);
    expect(ringPass(r, { x: -1, y: 1, z: 0 }, { x: 1, y: 1, z: 0 })).toBe(false);
  });
  it('counts a segment ending on the plane once, not again from the plane', () => {
    expect(ringPass(r, { x: 0, y: 1, z: -1 }, { x: 0, y: 1, z: 0 })).toBe(true);
    expect(ringPass(r, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 1 })).toBe(false);
  });
});

describe('ring run', () => {
  const course = { rings: withNormals([ring(10), ring(20), ring(30)], { x: 0, y: 1, z: 0 }) };
  it('finishes after every ring in order and times it', () => {
    const run = createRingRun(course);
    const out = [];
    for (let z = 0; z < 30; z++) out.push(run.update(0.1, { x: 0, y: 1, z }, { x: 0, y: 1, z: z + 1 }));
    expect(out.filter(Boolean)).toEqual(['ring', 'ring', 'finish']);
    expect(run.time).toBeCloseTo(3, 6);
    expect(run.done).toBe(true);
  });
  it('ignores a later ring out of order', () => {
    const run = createRingRun(course);
    expect(run.update(0.1, { x: 0, y: 1, z: 19.5 }, { x: 0, y: 1, z: 20.5 })).toBe(null);
    expect(run.next).toBe(0);
  });
  it('re-arms a missed ring until you fly back through it', () => {
    const run = createRingRun(course);
    expect(run.update(0.1, { x: 10, y: 1, z: 9 }, { x: 10, y: 1, z: 11 })).toBe(null);
    expect(run.update(0.1, { x: 0, y: 1, z: 11 }, { x: 0, y: 1, z: 9 })).toBe('ring');
    expect(run.next).toBe(1);
  });
});

describe('checkpoint run', () => {
  const course = { checkpoints: [
    { x: 10, y: 0, z: 0, r: 3, h: 4, needs: null },
    { x: 20, y: 0, z: 0, r: 3, h: 4, needs: 'ladder' },
  ] };
  const A = { x: 10, y: 0, z: 0 }, B = { x: 20, y: 0, z: 0 }, out = { x: 50, y: 0, z: 0 };
  it('needs the move after the previous checkpoint, and says so once per visit', () => {
    const run = createCheckpointRun(course);
    expect(run.update(1, A)).toBe('checkpoint');
    expect(run.update(1, B)).toBe('needs');
    expect(run.update(1, B)).toBe(null);
    run.noteMove('ladder');
    expect(run.update(1, B)).toBe('finish');
    expect(run.time).toBe(4);
  });
  it('does not count a move made before the previous checkpoint', () => {
    const run = createCheckpointRun(course);
    run.noteMove('ladder');
    expect(run.update(1, A)).toBe('checkpoint');
    expect(run.update(1, B)).toBe('needs');
    expect(run.update(1, out)).toBe(null);
    expect(run.update(1, B)).toBe('needs');
  });
  it('ignores checkpoints far above or below', () => {
    const run = createCheckpointRun(course);
    expect(run.update(1, { x: 10, y: 9, z: 0 })).toBe(null);
  });
});

describe('arena score', () => {
  it('scores hits times the multiplier, variety, finishers and counters', () => {
    const s = createArenaScore();
    expect(s.hit('punch')).toBe(60);
    expect(s.hit('punch')).toBe(10);
    expect(s.hit('kick')).toBe(60);
    expect(s.hit('punch')).toBe(20);
    expect(s.multiplier).toBe(2);
    expect(s.hit('heavy')).toBe(120);
    expect(s.hit('counter')).toBe(145);
    expect(s.score).toBe(415);
    expect(s.variety).toBe(3);
  });
  it('resets the multiplier and variety when hit, and after a pause', () => {
    const s = createArenaScore();
    for (let i = 0; i < 8; i++) s.hit('punch');
    s.hurt();
    expect(s.multiplier).toBe(1);
    expect(s.hit('punch')).toBe(60);
    s.tick(1.9);
    expect(s.streak).toBe(1);
    s.tick(0.2);
    expect(s.streak).toBe(0);
    expect(s.hit('kick')).toBe(60);
  });
  it('ignores unknown moves and caps the multiplier at 8', () => {
    const s = createArenaScore();
    expect(s.hit('wave')).toBe(0);
    expect(s.streak).toBe(0);
    for (let i = 0; i < 40; i++) s.hit('punch');
    expect(s.multiplier).toBe(8);
  });
});

describe('medals and results', () => {
  const timed = { id: 't', kind: 'rings', medals: { gold: 10, silver: 12, bronze: 15 } };
  const arena = { id: 'a', kind: 'arena', medals: { gold: 6000, silver: 4000, bronze: 2000 } };
  it('awards medals, lower is better for times and higher for scores', () => {
    expect([9.9, 10, 11, 14.9, 15.1].map((v) => medalFor(timed, v))).toEqual(['gold', 'gold', 'silver', 'bronze', null]);
    expect([6000, 3999, 1999].map((v) => medalFor(arena, v))).toEqual(['gold', 'bronze', null]);
    expect(isBetter(timed, 9, 10)).toBe(true);
    expect(isBetter(arena, 9, 10)).toBe(false);
    expect(isBetter(arena, 1, null)).toBe(true);
  });
  it('records bests and never takes a medal away', () => {
    let r = recordResult({}, timed, 11);
    expect(r).toEqual({ entry: { best: 11, medal: 'silver' }, newBest: true, medal: 'silver' });
    r = recordResult({ t: r.entry }, timed, 13);
    expect(r).toEqual({ entry: { best: 11, medal: 'silver' }, newBest: false, medal: 'bronze' });
    r = recordResult({ t: { best: 11, medal: 'gold' } }, timed, 11.5);
    expect(r.entry).toEqual({ best: 11, medal: 'gold' });
    expect(recordResult({}, arena, 6500).entry).toEqual({ best: 6500, medal: 'gold' });
  });
  it('knows when every challenge is gold', () => {
    const list = [timed, arena];
    expect(allGold({ t: { best: 1, medal: 'gold' } }, list)).toBe(false);
    expect(allGold({ t: { best: 1, medal: 'gold' }, a: { best: 1, medal: 'gold' } }, list)).toBe(true);
  });
  it('suggests thresholds from scripted runs', () => {
    expect(suggestThresholds('rings', [10, 12, 11])).toEqual({ gold: 11, silver: 13, bronze: 16, limit: 30 });
    expect(suggestThresholds('arena', [4000, 5000, 4600])).toEqual({ gold: 5750, silver: 3900, bronze: 2300 });
  });
  it('formats times and scores', () => {
    expect(formatTime(41.23)).toBe('41.2 s');
    expect(formatTime(75.3)).toBe('1:15.3');
    expect(formatTime(62.5)).toBe('1:02.5');
    expect(formatTime(119.97)).toBe('2:00.0');
    expect(formatResult(arena, 5750.4)).toBe('5,750 pts');
    expect(formatResult(timed, 9.04)).toBe('9.0 s');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/challenges.test.js`
Expected: FAIL (stub has no exports beyond `CHALLENGES`).

- [ ] **Step 3: Replace `src/game/challenges.js`**

```js
// Challenge courses and their maths: ring passes, checkpoints, the arena score and medals.
// Pure: no three.js, no DOM. Medal times come from scripts/challenge-tune.mjs (Task 16).
import { SITES } from '../world/mapData.js';

export const MEDAL_ORDER = [null, 'bronze', 'silver', 'gold'];
export const MEDAL_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
export const MOVE_LABEL = { ladder: 'ladder', ledge: 'ledge', zipline: 'zipline', wallrun: 'wall run' };
export const ARENA_ID = 'challenge:bash';

const ring = (x, y, z, r = 4, n = null) => ({ x, y, z, r, n });
const cp = (x, y, z, r, label, needs = null, h = 4) => ({ x, y, z, r, h, label, needs });

// Unit normals from each point back to the previous one (the direction you fly through it),
// or the point's own `n`. `flat` keeps checkpoint hoops upright.
export function withNormals(points, start, flat = false) {
  let prev = start;
  return points.map((p) => {
    let [nx, ny, nz] = p.n ?? [p.x - prev.x, p.y - prev.y, p.z - prev.z];
    if (flat) ny = 0;
    const len = Math.hypot(nx, ny, nz) || 1;
    prev = p;
    const { n, ...rest } = p;
    return { ...rest, nx: nx / len, ny: ny / len, nz: nz / len };
  });
}

const g = (dx, dz) => ({ type: 'grunt', dx, dz });
const k = (dx, dz) => ({ type: 'knife', dx, dz });
const b = (dx, dz) => ({ type: 'brute', dx, dz });
export const ARENA_FIGHT = {
  site: 'monarchRoof', radius: 16,
  waves: [
    [g(-5, -5), g(5, -5), g(0, 6), k(-6, 4)],
    [k(-6, -4), k(6, -4), g(-3, 7), g(3, 7), g(0, -8)],
    [b(0, -6), k(-6, 3), k(6, 3), g(-4, -9), g(4, -9)],
  ],
};

const RAW = [
  {
    id: 'signalToSea', name: 'Signal to Sea', kind: 'rings',
    blurb: 'Leap off the GCPD roof and glide south to the container yard.',
    start: { x: 14, y: 42, z: 17, yaw: 0 }, limit: 45, medals: { gold: 13, silver: 16, bronze: 20 },
    rings: [ring(28, 37, 45), ring(30, 31, 80), ring(30, 25, 115), ring(26, 19, 145), ring(12, 12, 172, 5)],
  },
  {
    id: 'neonSlalom', name: 'Neon Slalom', kind: 'rings',
    blurb: 'Weave between the signs of Neon Row, low and fast.',
    start: { x: 163, y: 30, z: 100, yaw: Math.PI }, limit: 40, medals: { gold: 11, silver: 14, bronze: 18 },
    rings: [ring(150, 26.5, 85, 3.5), ring(145, 22.5, 60, 3.5), ring(155, 18.5, 35, 3.5), ring(145, 14.5, 10, 3.5), ring(155, 10.5, -15, 3.5), ring(145, 7, -40, 3.5), ring(150, 4.5, -65, 4)],
  },
  {
    id: 'bellTowerDive', name: 'Bell Tower Dive', kind: 'rings',
    blurb: 'Dive between the cathedral towers, run the ridge and loop back to the plaza.',
    start: { x: -78, y: 58, z: -146, yaw: -Math.PI / 2 }, limit: 60, medals: { gold: 16, silver: 20, bronze: 26 },
    rings: [ring(-100, 52, -108), ring(-120, 46, -122, 3.5, [0, 0, -1]), ring(-120, 44, -145, 3.5), ring(-120, 41, -170, 3.5), ring(-120, 32, -195), ring(-95, 24, -192), ring(-92, 14, -160, 5)],
  },
  {
    id: 'gothamParkour', name: 'Gotham Parkour', kind: 'parkour',
    blurb: 'Neon Row to the clock plaza. You will need a ladder, a ledge, a zipline and a wall run.',
    start: { x: 147, y: 0, z: 50, yaw: -Math.PI / 2 }, limit: 240, medals: { gold: 55, silver: 70, bronze: 95 },
    checkpoints: [
      cp(128, 22, 48, 9, 'Up the fire escape', 'ladder'),
      cp(125, 30, -5, 10, 'Hang off the Gazette', 'ledge'),
      cp(122, 26, -48, 8, 'Ride the wire', 'zipline'),
      cp(150, 0, -90, 10, 'Run the wall', 'wallrun', 6),
      cp(-75, 0.15, -112, 9, 'The clock plaza', null, 5),
    ],
  },
  {
    id: 'birthdayBash', name: "Joker's Birthday Bash", kind: 'arena',
    blurb: 'Three waves on the Monarch roof. Mix your moves, keep the combo, do not get hit.',
    start: { x: 190, y: SITES.monarchRoof.y, z: -48, yaw: Math.atan2(-10, -12) }, medals: { gold: 6000, silver: 4000, bronze: 2000 },
  },
];

export const CHALLENGES = RAW.map((c) => ({
  ...c,
  ...(c.rings ? { rings: withNormals(c.rings, c.start) } : {}),
  ...(c.checkpoints ? { checkpoints: withNormals(c.checkpoints, c.start, true) } : {}),
}));

// The glowing bat pillar stands 2 m behind the start pose; walking into it starts the challenge.
export function pillarPos(ch) {
  const { x, y, z, yaw } = ch.start;
  return { x: x - Math.round(Math.sin(yaw) * 2e6) / 1e6, y, z: z - Math.round(Math.cos(yaw) * 2e6) / 1e6 };
}

// Did the segment a -> b pass through the ring's disc? Either direction counts. A segment that
// starts on the plane does not count again, so one crossing never scores twice.
export function ringPass(ring, a, b) {
  const da = (a.x - ring.x) * ring.nx + (a.y - ring.y) * ring.ny + (a.z - ring.z) * ring.nz;
  const db = (b.x - ring.x) * ring.nx + (b.y - ring.y) * ring.ny + (b.z - ring.z) * ring.nz;
  if (!((da < 0 && db >= 0) || (da > 0 && db <= 0))) return false;
  const t = da / (da - db);
  const px = a.x + (b.x - a.x) * t - ring.x, py = a.y + (b.y - a.y) * t - ring.y, pz = a.z + (b.z - a.z) * t - ring.z;
  return px * px + py * py + pz * pz <= ring.r * ring.r;
}

// Only the next ring counts. A missed ring stays the target until you fly back through it.
export function createRingRun(ch) {
  const rings = ch.rings;
  let next = 0, time = 0, done = false;
  return {
    get next() { return next; }, get time() { return time; }, get done() { return done; }, get total() { return rings.length; },
    update(dt, a, b) {
      if (done) return null;
      time += dt;
      if (!ringPass(rings[next], a, b)) return null;
      next += 1;
      if (next >= rings.length) { done = true; return 'finish'; }
      return 'ring';
    },
  };
}

// A checkpoint with `needs` only counts once that move was used since the previous checkpoint.
export function createCheckpointRun(ch) {
  const cps = ch.checkpoints;
  const used = new Set();
  let next = 0, time = 0, done = false, waiting = false;
  return {
    get next() { return next; }, get time() { return time; }, get done() { return done; }, get total() { return cps.length; },
    noteMove(id) { used.add(id); },
    update(dt, p) {
      if (done) return null;
      time += dt;
      const c = cps[next];
      const inside = Math.hypot(p.x - c.x, p.z - c.z) <= c.r && Math.abs(p.y - c.y) <= c.h;
      if (!inside) { waiting = false; return null; }
      if (c.needs && !used.has(c.needs)) {
        if (waiting) return null;
        waiting = true;
        return 'needs';
      }
      used.clear();
      waiting = false;
      next += 1;
      if (next >= cps.length) { done = true; return 'finish'; }
      return 'checkpoint';
    },
  };
}

// Arena scoring. Move names are the `move` field of combat's 'impact' events.
export const MOVE_KIND = {
  punch: 'punch', heavy: 'punch', kick: 'kick', spinKick: 'kick', counter: 'counter', cape: 'cape', batarang: 'batarang',
  special: 'special', jumpKick: 'aerial', diveBomb: 'aerial', slam: 'slam', throw: 'throw', thrownInto: 'throw',
  beatdown: 'beatdown', takedown: 'takedown',
};
export const FINISHERS = new Set(['heavy', 'spinKick', 'special', 'slam', 'takedown']);
export const ARENA_POINTS = { hit: 10, variety: 50, finisher: 100, counter: 75, streakStep: 4, maxMult: 8, streakTimeout: 2 };

export function createArenaScore(P = ARENA_POINTS) {
  let score = 0, streak = 0, idle = 0;
  const kinds = new Set();
  const mult = () => Math.min(P.maxMult, 1 + Math.floor(streak / P.streakStep));
  const breakCombo = () => { streak = 0; idle = 0; kinds.clear(); };
  return {
    get score() { return score; }, get streak() { return streak; }, get multiplier() { return mult(); }, get variety() { return kinds.size; },
    hit(move) {
      const kind = MOVE_KIND[move];
      if (!kind) return 0;
      streak += 1;
      idle = 0;
      let pts = P.hit * mult();
      if (!kinds.has(kind)) { kinds.add(kind); pts += P.variety; }
      if (FINISHERS.has(move)) pts += P.finisher;
      if (move === 'counter') pts += P.counter;
      score += pts;
      return pts;
    },
    hurt: breakCombo,
    tick(dt) {
      if (!streak) return;
      idle += dt;
      if (idle >= P.streakTimeout) breakCombo();
    },
  };
}

export function medalFor(ch, value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const m = ch.medals;
  if (ch.kind === 'arena') return value >= m.gold ? 'gold' : value >= m.silver ? 'silver' : value >= m.bronze ? 'bronze' : null;
  return value <= m.gold ? 'gold' : value <= m.silver ? 'silver' : value <= m.bronze ? 'bronze' : null;
}
export const isBetter = (ch, value, best) => best == null || (ch.kind === 'arena' ? value > best : value < best);
const rank = (medal) => MEDAL_ORDER.indexOf(medal ?? null);

// New bests replace old ones; medals only ever go up (thresholds can be retuned later).
export function recordResult(entries, ch, value) {
  const old = entries[ch.id] ?? null;
  const medal = medalFor(ch, value);
  const newBest = isBetter(ch, value, old?.best ?? null);
  const best = newBest ? value : old.best;
  const kept = rank(old?.medal) >= rank(medal) ? old?.medal ?? null : medal;
  return { entry: { best, medal: kept }, newBest, medal };
}

export const allGold = (entries, list = CHALLENGES) => list.every((c) => entries[c.id]?.medal === 'gold');

const ceilTo = (v, step) => Math.ceil(v / step - 1e-9) * step;
const roundTo = (v, step) => Math.round(v / step) * step;
// Timed: from the scripted pilot's best run (it flies a clean line, so gold is hard but
// reachable). Arena: from the bot's median score (it never plays for variety, a person can).
export function suggestThresholds(kind, samples) {
  const s = [...samples].sort((x, y) => x - y);
  if (kind === 'arena') {
    const med = s[Math.floor(s.length / 2)];
    return { gold: roundTo(med * 1.25, 50), silver: roundTo(med * 0.85, 50), bronze: roundTo(med * 0.5, 50) };
  }
  const best = s[0];
  return { gold: ceilTo(best * 1.08, 0.5), silver: ceilTo(best * 1.3, 0.5), bronze: ceilTo(best * 1.6, 0.5), limit: ceilTo(best * 3, 5) };
}

export function formatTime(sec) {
  const t = Math.round(sec * 10) / 10;
  if (t < 60) return `${t.toFixed(1)} s`;
  const m = Math.floor(t / 60);
  return `${m}:${(t - m * 60).toFixed(1).padStart(4, '0')}`;
}
export const formatResult = (ch, v) => (ch.kind === 'arena' ? `${Math.round(v).toLocaleString('en-US')} pts` : formatTime(v));
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/challenges.test.js`
Expected: PASS.

- [ ] **Step 5: Check the pillar test's rounding.** `pillarPos` rounds the offset to 6 decimals so `yaw = 0` gives exactly `z - 2` and `x - 0`. If `toEqual` fails on `-0`, compare with `toMatchObject` and `toBeCloseTo` instead; do not change the formula.

- [ ] **Step 6: Rerun the tracker tests** (now with real challenges)

Run: `npx vitest run tests/unit/progressTracker.test.js tests/unit/challenges.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/challenges.js tests/unit/challenges.test.js
git commit -m "Challenge courses, ring and checkpoint logic, arena score and medals"
```

---

### Task 5: Street crime rules

**Files:**
- Replace: `src/game/crimes.js` (the Task 2 stub)
- Test: `tests/unit/crimes.test.js`

**Interfaces:**
- Consumes: nothing at runtime (tests use `districtAt` and `createRng`).
- Produces: everything under `crimes.js` in Shared interfaces.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/crimes.test.js
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';
import { districtAt } from '../../src/world/mapData.js';
import {
  CRIME_SPOTS, CRIME_KINDS, createCrimeScheduler, pickSpot, crimeBlocked, crimeFight, crimeTitle, isCrimeId,
} from '../../src/game/crimes.js';

const fixed = (v) => ({ next: () => v });
// 60 to 180 m from every spot except the two GCPD ones (the GCPD steps are 31 m away, inside minDist).
const far = { x: 30, z: 20 };
const ctx = (extra = {}) => ({ blocked: false, visited: ['neon'], heroPos: far, avoid: null, ...extra });

describe('crime spots', () => {
  it('sit in the district they claim, two per district', () => {
    for (const s of CRIME_SPOTS) expect(districtAt(s.x, s.z), s.id).toBe(s.district);
    for (const d of ['gcpd', 'docks', 'neon', 'ace', 'clock']) expect(CRIME_SPOTS.filter((s) => s.district === d)).toHaveLength(2);
  });
});

describe('crime scheduler', () => {
  it('waits at least 2 minutes before the first crime', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(119, ctx())).toBe(null);
    const r = s.update(1, ctx());
    expect(r.type).toBe('spawn');
    expect(r.crime.spot.district).toBe('neon');
    expect(r.crime.fightId).toBe(`crime:${r.crime.id.slice(5)}`);
  });
  it('spawns by 4 minutes at the latest', () => {
    const s = createCrimeScheduler({ rng: fixed(0.999) });
    expect(s.update(239, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
  });
  it('only uses visited districts, and retries when none fit', () => {
    const s = createCrimeScheduler({ rng: createRng(3) });
    const r = s.update(300, ctx({ visited: ['docks'] }));
    expect(r.crime.spot.district).toBe('docks');
    const t = createCrimeScheduler({ rng: fixed(0) });
    expect(t.update(300, ctx({ visited: [] }))).toBe(null);
    expect(t.timer).toBe(20);
  });
  it('skips spots too close to the hero or to the current objective', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(300, ctx({ visited: ['gcpd'], heroPos: { x: 0, z: 0 } }))).toBe(null);
    const spot = pickSpot(CRIME_SPOTS, ['neon'], far, fixed(0), { avoid: { x: 150, z: -20 } });
    expect(spot.id).toBe('neonDiner');
  });
  it('runs one crime at a time and expires it after 3 minutes', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    s.update(120, ctx());
    for (let i = 0; i < 179; i++) expect(s.update(1, ctx())).toBe(null);
    const r = s.update(1, ctx());
    expect(r.type).toBe('expire');
    expect(s.active).toBe(null);
    expect(s.update(119, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
  });
  it('never expires a crime you are fighting', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    s.update(120, ctx());
    s.engage();
    expect(s.update(1000, ctx())).toBe(null);
    expect(s.active.engaged).toBe(true);
  });
  it('pauses both clocks while blocked', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    expect(s.update(500, ctx({ blocked: true }))).toBe(null);
    expect(s.update(119, ctx())).toBe(null);
    expect(s.update(1, ctx())?.type).toBe('spawn');
    expect(s.update(500, ctx({ blocked: true }))).toBe(null);
    expect(s.active.age).toBe(0);
  });
  it('spaces the next crime 2 to 4 minutes after one ends', () => {
    const s = createCrimeScheduler({ rng: createRng(8) });
    s.update(300, ctx());
    s.resolve();
    expect(s.timer).toBeGreaterThanOrEqual(120);
    expect(s.timer).toBeLessThanOrEqual(240);
  });
  it('can be forced for scripted runs', () => {
    const s = createCrimeScheduler({ rng: fixed(0) });
    s.force({ kind: 'van', spotId: 'aceGate' });
    const r = s.update(0.016, ctx({ visited: [] }));
    expect(r.crime.kind).toBe('van');
    expect(r.crime.spot.id).toBe('aceGate');
  });
});

describe('blocked modes', () => {
  const base = { mode: 'play', stepType: 'reach', challenge: false, fightId: null, photo: false };
  it('allows free roam and reach or collect steps', () => {
    expect(crimeBlocked(base)).toBe(false);
    expect(crimeBlocked({ ...base, stepType: 'collect' })).toBe(false);
    expect(crimeBlocked({ ...base, stepType: 'credits' })).toBe(false);
    expect(crimeBlocked({ ...base, fightId: 'crime:4' })).toBe(false);
  });
  it('blocks the boss, the finale, fights, cutscenes, challenges and photo mode', () => {
    expect(crimeBlocked({ ...base, stepType: 'boss' })).toBe(true);
    expect(crimeBlocked({ ...base, stepType: 'fight' })).toBe(true);
    expect(crimeBlocked({ ...base, stepType: 'cutscene' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'finale' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'cutscene' })).toBe(true);
    expect(crimeBlocked({ ...base, mode: 'dead' })).toBe(true);
    expect(crimeBlocked({ ...base, challenge: true })).toBe(true);
    expect(crimeBlocked({ ...base, fightId: 'challenge:bash' })).toBe(true);
    expect(crimeBlocked({ ...base, photo: true })).toBe(true);
  });
  it('recognises crime fight ids', () => {
    expect(isCrimeId('crime:1')).toBe(true);
    expect(isCrimeId('monarch')).toBe(false);
    expect(isCrimeId(null)).toBe(false);
  });
});

describe('squads', () => {
  it('sends 3 to 5 goons in a ring around the spot', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const rng = createRng(seed);
      const kind = CRIME_KINDS[seed % 3];
      const f = crimeFight(kind, { x: 10, y: 0, z: 20 }, rng);
      const goons = f.waves.flat();
      seen.add(goons.length);
      expect(goons.length).toBeGreaterThanOrEqual(3);
      expect(goons.length).toBeLessThanOrEqual(5);
      expect(f.site).toEqual({ x: 10, y: 0, z: 20 });
      for (const q of goons) expect(Math.hypot(q.dx, q.dz)).toBeLessThanOrEqual(5.01);
      if (goons.length === 5) expect(f.waves.map((w) => w.length)).toEqual([3, 2]);
      else expect(f.waves).toHaveLength(1);
      if (kind === 'mugging') expect(goons.some((q) => q.type === 'knife')).toBe(false);
      if (kind === 'van' && goons.length === 5) expect(goons.some((q) => q.type === 'brute')).toBe(true);
    }
    expect([...seen].sort()).toEqual([3, 4, 5]);
  });
  it('names the crime for the radio', () => {
    expect(crimeTitle('robbery', 'neon')).toBe('Robbery on Neon Row');
    expect(crimeTitle('mugging', 'docks')).toBe('Civilian cornered at the Docks');
    expect(crimeTitle('van', 'gcpd')).toBe('Van break-in outside GCPD');
    for (const k of CRIME_KINDS) for (const d of ['gcpd', 'docks', 'neon', 'ace', 'clock']) expect(crimeTitle(k, d)).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/crimes.test.js`
Expected: FAIL.

- [ ] **Step 3: Replace `src/game/crimes.js`**

```js
// Street crimes: where and when they happen, who shows up, and what the radio says. Pure.
export const CRIME_KINDS = ['robbery', 'mugging', 'van'];
export const DISTRICT_LABEL = { gcpd: 'GCPD', docks: 'The Docks', neon: 'Neon Row', ace: 'Ace Chemicals', clock: 'The Clock Plaza' };
export const DISTRICT_PHRASE = { gcpd: 'outside GCPD', docks: 'at the Docks', neon: 'on Neon Row', ace: 'at Ace Chemicals', clock: 'in the Clock Plaza' };
const KIND_TITLE = { robbery: 'Robbery', mugging: 'Civilian cornered', van: 'Van break-in' };

// Street-level spots, two per district. y is the street; the director snaps it to the ground.
export const CRIME_SPOTS = [
  { id: 'gcpdSteps', district: 'gcpd', x: 0, y: 0, z: 27, yaw: 0 },
  { id: 'gcpdWest', district: 'gcpd', x: -27, y: 0, z: 0, yaw: Math.PI / 2 },
  { id: 'dockYard', district: 'docks', x: 0, y: 0.15, z: 178, yaw: 0 },
  { id: 'dockRoad', district: 'docks', x: -90, y: 0, z: 150, yaw: Math.PI / 2 },
  { id: 'neonNorth', district: 'neon', x: 150, y: 0, z: -20, yaw: 0 },
  { id: 'neonDiner', district: 'neon', x: 150, y: 0, z: 70, yaw: 0 },
  { id: 'aceGate', district: 'ace', x: 95, y: 0, z: -140, yaw: 0 },
  { id: 'aceLab', district: 'ace', x: 72, y: 0, z: -100, yaw: Math.PI / 2 },
  { id: 'plazaFountain', district: 'clock', x: -92, y: 0.15, z: -108, yaw: 0 },
  { id: 'plazaHall', district: 'clock', x: -50, y: 0.15, z: -122, yaw: 0 },
];

export const isCrimeId = (id) => typeof id === 'string' && id.startsWith('crime:');
export const crimeTitle = (kind, district) => `${KIND_TITLE[kind]} ${DISTRICT_PHRASE[district]}`;

// Crimes happen in free roam and between story steps only: never during a fight step, the
// boss, the finale, a cutscene, a challenge or photo mode. A crime's own fight doesn't block.
export function crimeBlocked({ mode, stepType, challenge = false, fightId = null, photo = false }) {
  if (mode !== 'play' || challenge || photo) return true;
  if (['fight', 'boss', 'cutscene'].includes(stepType)) return true;
  return !!fightId && !isCrimeId(fightId);
}

// A visited-district spot, not on top of the hero (minDist), not across the city (maxDist),
// and well away from the current objective (avoid) so a crime never sits on the story's path.
export function pickSpot(spots, visited, heroPos, rng, { minDist = 35, maxDist = 260, avoid = null, avoidDist = 60 } = {}) {
  const ok = spots.filter((s) => {
    if (!visited.includes(s.district)) return false;
    const d = Math.hypot(s.x - heroPos.x, s.z - heroPos.z);
    if (d < minDist || d > maxDist) return false;
    return !avoid || Math.hypot(s.x - avoid.x, s.z - avoid.z) >= avoidDist;
  });
  return ok.length ? ok[Math.floor(rng.next() * ok.length)] : null;
}

export function createCrimeScheduler({ rng, minGap = 120, maxGap = 240, expiry = 180, retry = 20, spots = CRIME_SPOTS, minDist = 35, maxDist = 260, avoidDist = 60 } = {}) {
  const gap = () => minGap + rng.next() * (maxGap - minGap);
  let timer = gap();
  let active = null;
  let serial = 0;
  let forced = null;
  return {
    get active() { return active; },
    get timer() { return timer; },
    update(dt, { blocked = false, visited = [], heroPos = { x: 0, z: 0 }, avoid = null } = {}) {
      if (active) {
        if (active.engaged || blocked) return null;
        active.age += dt;
        if (active.age < expiry) return null;
        const crime = active;
        active = null;
        timer = gap();
        return { type: 'expire', crime };
      }
      if (blocked) return null;
      timer -= dt;
      if (timer > 0) return null;
      const spot = forced?.spotId
        ? spots.find((s) => s.id === forced.spotId) ?? null
        : pickSpot(spots, visited, heroPos, rng, { minDist, maxDist, avoid, avoidDist });
      const kind = forced?.kind ?? CRIME_KINDS[Math.floor(rng.next() * CRIME_KINDS.length)];
      forced = null;
      if (!spot) { timer = retry; return null; }
      serial += 1;
      active = { id: `crime${serial}`, fightId: `crime:${serial}`, kind, spot, age: 0, engaged: false };
      return { type: 'spawn', crime: active };
    },
    engage() { if (active) active.engaged = true; },
    resolve() { const c = active; active = null; timer = gap(); return c; },
    force({ kind = null, spotId = null } = {}) { forced = { kind, spotId }; timer = 0; },
  };
}

// 3 to 5 goons in a ring 3.5 to 5 m around the spot. Five come in two waves (3 then 2).
export function crimeFight(kind, spot, rng) {
  const n = 3 + Math.floor(rng.next() * 3);
  const turn = rng.next() * Math.PI * 2;
  const goons = Array.from({ length: n }, (_, i) => {
    const type = i === 1 && kind !== 'mugging' ? 'knife' : i === 4 && kind === 'van' ? 'brute' : 'grunt';
    const a = turn + (i / n) * Math.PI * 2;
    const r = 3.5 + (i % 2) * 1.5;
    return { type, dx: Math.sin(a) * r, dz: Math.cos(a) * r };
  });
  return { site: { x: spot.x, y: spot.y, z: spot.z }, radius: 16, waves: n === 5 ? [goons.slice(0, 3), goons.slice(3)] : [goons] };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/crimes.test.js tests/unit/progressTracker.test.js`
Expected: PASS. If Task 16 later moves a crime spot, recheck that `far` still sits 35 to 260 m from every non-GCPD spot.

- [ ] **Step 5: Commit**

```bash
git add src/game/crimes.js tests/unit/crimes.test.js
git commit -m "Street crime rules: spots, scheduler, blocked modes and squads"
```

---

### Task 6: Photo mode maths

**Files:**
- Create: `src/game/photoMath.js`
- Test: `tests/unit/photoMath.test.js`

**Interfaces:**
- Consumes: `MANSI.name`.
- Produces: everything under `photoMath.js` in Shared interfaces.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/photoMath.test.js
import { describe, it, expect } from 'vitest';
import {
  FILTERS, FRAMES, DEFAULT_CAPTION, PHOTO_LIMITS, cycle, createPhotoCam, setPhotoMode, stepPhotoCam, photoView,
  frameLayout, sanitizeCaption, photoFileName,
} from '../../src/game/photoMath.js';

const anchor = { x: 0, y: 0, z: 0 };
const pivot = { x: 0, y: PHOTO_LIMITS.pivotY, z: 0 };
const cam0 = () => createPhotoCam({ position: { x: 0, y: 1.2, z: 0 }, target: { x: 0, y: 1.2, z: 5 }, fov: 60 });
const dist = (c) => Math.hypot(c.x - pivot.x, c.y - pivot.y, c.z - pivot.z);

describe('photo camera', () => {
  it('starts from the live camera direction', () => {
    const c = cam0();
    expect(c.yaw).toBeCloseTo(0);
    expect(c.pitch).toBeCloseTo(0);
    expect(createPhotoCam({ position: { x: 0, y: 0, z: 0 }, target: { x: 3, y: 0, z: 0 }, fov: 60 }).yaw).toBeCloseTo(Math.PI / 2);
    expect(DEFAULT_CAPTION).toBe('HAPPY BIRTHDAY MANSI');
  });
  it('flies but stays within 20 m of Batman', () => {
    const c = stepPhotoCam(cam0(), { moveY: 1 }, 10, anchor);
    expect(dist(c)).toBeCloseTo(20, 6);
    expect(c.z).toBeCloseTo(20, 6);
  });
  it('never goes below the street', () => {
    const c = stepPhotoCam({ ...cam0(), z: 5 }, { up: -1 }, 10, anchor);
    expect(c.y).toBe(0.3);
  });
  it('clamps FOV and roll', () => {
    expect(stepPhotoCam(cam0(), { zoom: 1 }, 10, anchor).fov).toBe(100);
    expect(stepPhotoCam(cam0(), { zoom: -1 }, 10, anchor).fov).toBe(20);
    expect(stepPhotoCam(cam0(), { fovDelta: -100 }, 0.016, anchor).fov).toBe(20);
    expect(stepPhotoCam(cam0(), { roll: 1 }, 10, anchor).roll).toBeCloseTo(Math.PI / 4);
    expect(stepPhotoCam(cam0(), { roll: -1 }, 10, anchor).roll).toBeCloseTo(-Math.PI / 4);
  });
  it('switches to orbit without jumping, and orbits within limits', () => {
    const free = createPhotoCam({ position: { x: 0, y: 1.2, z: -4 }, target: { x: 0, y: 1.2, z: 0 }, fov: 60 });
    const orbit = stepPhotoCam(setPhotoMode(free, 'orbit', anchor), {}, 0.016, anchor);
    expect(orbit.x).toBeCloseTo(0, 6);
    expect(orbit.y).toBeCloseTo(1.2, 6);
    expect(orbit.z).toBeCloseTo(-4, 6);
    expect(stepPhotoCam(orbit, { moveY: 1 }, 100, anchor).orbitDist).toBe(PHOTO_LIMITS.minOrbit);
    expect(stepPhotoCam(orbit, { moveY: -1 }, 100, anchor).orbitDist).toBe(PHOTO_LIMITS.maxDist - 0.5);
  });
  it('points the orbit camera at Batman', () => {
    const o = stepPhotoCam(setPhotoMode(cam0(), 'orbit', anchor), { lookX: 300, lookY: 60 }, 0.016, anchor);
    const v = photoView(o);
    const f = [v.target.x - v.position.x, v.target.y - v.position.y, v.target.z - v.position.z];
    const p = [pivot.x - v.position.x, pivot.y - v.position.y, pivot.z - v.position.z];
    const n = (a) => { const l = Math.hypot(...a); return a.map((q) => q / l); };
    n(f).forEach((q, i) => expect(q).toBeCloseTo(n(p)[i], 5));
  });
});

describe('filters, frames and captions', () => {
  it('cycles both ways and recovers from unknown values', () => {
    expect(cycle(FILTERS, 'ink')).toBe('noir');
    expect(cycle(FILTERS, 'sepia')).toBe('ink');
    expect(cycle(FILTERS, 'ink', -1)).toBe('sepia');
    expect(cycle(FRAMES, 'mystery')).toBe('none');
  });
  it('lays out frames inside the picture at any size', () => {
    for (const [w, h] of [[1280, 720], [720, 1280], [3840, 2160]]) {
      const none = frameLayout('none', w, h);
      expect(none.inset).toBe(0);
      expect(none.border).toBe(0);
      expect(none.masthead).toBe(null);
      const panel = frameLayout('panel', w, h);
      expect(panel.inset).toBeGreaterThan(0);
      expect(panel.border).toBeGreaterThan(0);
      const cover = frameLayout('cover', w, h);
      expect(cover.masthead.h).toBeGreaterThan(0);
      expect(cover.masthead.x + cover.masthead.w).toBeLessThanOrEqual(w);
      expect(cover.issue.x).toBeGreaterThan(cover.masthead.x);
      expect(cover.issue.x + cover.issue.w).toBeLessThanOrEqual(cover.masthead.x + cover.masthead.w);
      for (const L of [none, panel, cover]) {
        expect(L.caption.x).toBeGreaterThanOrEqual(0);
        expect(L.caption.y).toBeGreaterThanOrEqual(0);
        expect(L.caption.x + L.caption.maxW).toBeLessThanOrEqual(w);
        expect(L.caption.y + L.caption.h).toBeLessThanOrEqual(h);
      }
    }
  });
  it('cleans captions', () => {
    expect(sanitizeCaption('  happy   birthday \u2014 mansi  ')).toBe('HAPPY BIRTHDAY - MANSI');
    expect(sanitizeCaption('x'.repeat(60))).toHaveLength(48);
    expect(sanitizeCaption(null)).toBe('');
  });
  it('names the file with the date and time', () => {
    expect(photoFileName(new Date(2026, 8, 28, 21, 5, 9))).toBe('gotham-for-mansi-20260928-210509.png');
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/photoMath.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `src/game/photoMath.js`**

```js
// Photo mode maths: the free and orbit camera, filters and frames, caption text and file names.
// Pure. Pitch is positive looking up; forward = (sin yaw cos pitch, sin pitch, cos yaw cos pitch).
import MANSI from '../mansi.config.js';

export const FILTERS = ['ink', 'noir', 'pop', 'sepia'];
export const FRAMES = ['none', 'panel', 'cover'];
export const FILTER_LABEL = { ink: 'Ink', noir: 'Noir', pop: 'Pop', sepia: 'Sepia' };
export const FRAME_LABEL = { none: 'None', panel: 'Panel border', cover: 'Cover' };
export const DEFAULT_CAPTION = `HAPPY BIRTHDAY ${MANSI.name.toUpperCase()}`;
export const CAPTION_PRESETS = [DEFAULT_CAPTION, 'MEANWHILE, IN GOTHAM...', 'THE NIGHT BELONGS TO US', ''];
export const PHOTO_LIMITS = {
  maxDist: 20, minFov: 20, maxFov: 100, maxRoll: Math.PI / 4, maxPitch: 1.45, speed: 6, lookRate: 0.0035,
  rollRate: 1.2, fovRate: 35, minOrbit: 1.5, pivotY: 1.2,
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

export function cycle(list, cur, dir = 1) {
  const i = list.indexOf(cur);
  return i < 0 ? list[0] : list[(i + dir + list.length) % list.length];
}

export function createPhotoCam({ position, target, fov }) {
  const dx = target.x - position.x, dy = target.y - position.y, dz = target.z - position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return {
    mode: 'free', x: position.x, y: position.y, z: position.z,
    yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / len, -1, 1)), roll: 0, fov,
    orbitYaw: 0, orbitPitch: 0.25, orbitDist: 4,
  };
}

// Switching to orbit keeps the camera where it is and orbits the point above Batman's feet.
export function setPhotoMode(cam, mode, anchor, L = PHOTO_LIMITS) {
  if (mode === cam.mode) return cam;
  if (mode === 'free') return { ...cam, mode };
  const ox = cam.x - anchor.x, oy = cam.y - (anchor.y + L.pivotY), oz = cam.z - anchor.z;
  const d = Math.hypot(ox, oy, oz) || 1;
  return {
    ...cam, mode,
    orbitDist: clamp(d, L.minOrbit, L.maxDist - 0.5),
    orbitPitch: clamp(Math.asin(clamp(oy / d, -1, 1)), -0.3, 1.35),
    orbitYaw: Math.atan2(-ox, -oz),
  };
}

export function stepPhotoCam(cam, cmd, dt, anchor, L = PHOTO_LIMITS) {
  const c = { ...cam };
  const { moveX = 0, moveY = 0, up = 0, lookX = 0, lookY = 0, roll = 0, zoom = 0, fovDelta = 0 } = cmd;
  c.roll = clamp(c.roll + roll * L.rollRate * dt, -L.maxRoll, L.maxRoll);
  c.fov = clamp(c.fov + zoom * L.fovRate * dt + fovDelta, L.minFov, L.maxFov);
  const py = anchor.y + L.pivotY;
  if (c.mode === 'orbit') {
    c.orbitYaw += -lookX * L.lookRate + moveX * 1.5 * dt;
    c.orbitPitch = clamp(c.orbitPitch + lookY * L.lookRate + up * dt, -0.3, 1.35);
    c.orbitDist = clamp(c.orbitDist - moveY * L.speed * dt, L.minOrbit, L.maxDist - 0.5);
    const cp = Math.cos(c.orbitPitch);
    c.x = anchor.x - Math.sin(c.orbitYaw) * cp * c.orbitDist;
    c.y = py + Math.sin(c.orbitPitch) * c.orbitDist;
    c.z = anchor.z - Math.cos(c.orbitYaw) * cp * c.orbitDist;
    c.yaw = c.orbitYaw;
    c.pitch = -c.orbitPitch;
  } else {
    c.yaw -= lookX * L.lookRate;
    c.pitch = clamp(c.pitch - lookY * L.lookRate, -L.maxPitch, L.maxPitch);
    const cp = Math.cos(c.pitch), k = L.speed * dt;
    const fx = Math.sin(c.yaw) * cp, fy = Math.sin(c.pitch), fz = Math.cos(c.yaw) * cp;
    const rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
    c.x += (fx * moveY + rx * moveX) * k;
    c.y += (fy * moveY + up) * k;
    c.z += (fz * moveY + rz * moveX) * k;
  }
  const ox = c.x - anchor.x, oy = c.y - py, oz = c.z - anchor.z;
  const d = Math.hypot(ox, oy, oz);
  if (d > L.maxDist) { const s = L.maxDist / d; c.x = anchor.x + ox * s; c.y = py + oy * s; c.z = anchor.z + oz * s; }
  c.y = Math.max(c.y, 0.3);
  return c;
}

export function photoView(cam) {
  const cp = Math.cos(cam.pitch);
  return {
    position: { x: cam.x, y: cam.y, z: cam.z },
    target: { x: cam.x + Math.sin(cam.yaw) * cp, y: cam.y + Math.sin(cam.pitch), z: cam.z + Math.cos(cam.yaw) * cp },
    roll: cam.roll, fov: cam.fov,
  };
}

// Sizes in units of 1% of the picture's short side, so the preview and the saved PNG match.
export function frameLayout(frame, w, h) {
  const u = Math.min(w, h) / 100;
  const inset = frame === 'panel' ? u * 3 : frame === 'cover' ? u * 2.4 : 0;
  const border = frame === 'none' ? 0 : Math.max(2, Math.round(u * (frame === 'panel' ? 1.1 : 0.8)));
  const masthead = frame === 'cover' ? { x: inset, y: inset, w: w - inset * 2, h: u * 15 } : null;
  const issue = masthead ? { x: masthead.x + masthead.w - u * 16, y: masthead.y + u * 2, w: u * 13, h: u * 11 } : null;
  const capH = u * 8;
  const left = inset + u * 3;
  const caption = { x: left, y: h - inset - u * 3 - capH, maxW: Math.min(w * 0.62, w - left * 2), h: capH, font: u * 4 };
  return { u, inset, border, masthead, issue, caption };
}

export function sanitizeCaption(text) {
  return String(text ?? '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 48);
}

const two = (n) => String(n).padStart(2, '0');
export function photoFileName(d) {
  return `gotham-for-mansi-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}${two(d.getSeconds())}.png`;
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/photoMath.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/photoMath.js tests/unit/photoMath.test.js
git commit -m "Photo mode camera, frame layout and caption maths"
```

---

### Task 7: City map model

**Files:**
- Create: `src/game/mapModel.js`
- Test: `tests/unit/mapModel.test.js`

**Interfaces:**
- Consumes: `districtAt`, `WORLD` (mapData), a sanitized progress.
- Produces: `MAP_BOUNDS`, `toMap`, `mapModel`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/mapModel.test.js
import { describe, it, expect } from 'vitest';
import { sanitizeProgress } from '../../src/core/save.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';
import { MAP_BOUNDS, toMap, mapModel } from '../../src/game/mapModel.js';

describe('map model', () => {
  it('maps the city into a square, north up', () => {
    expect(toMap(MAP_BOUNDS.minX, MAP_BOUNDS.minZ, 360)).toEqual({ u: 0, v: 0 });
    expect(toMap(MAP_BOUNDS.minX + 258, MAP_BOUNDS.minZ + 258, 360)).toEqual({ u: 180, v: 180 });
  });
  it('draws blocks, shows found balloons and unfound ones only in visited districts', () => {
    const progress = sanitizeProgress({ balloons: [5], districts: ['gcpd'], challenges: { a: { best: 1, medal: 'silver' } } });
    const m = mapModel({
      buildings: [{ x: 0, z: 0, w: 40, d: 40, district: 'gcpd', landmark: true }],
      balloons: BALLOONS, challenges: [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 10, z: 10 }], progress, size: 360,
    });
    expect(m.blocks).toHaveLength(1);
    expect(m.blocks[0].u).toBeCloseTo(((-20 + 236) / 516) * 360, 6);
    expect(m.blocks[0].w).toBeCloseTo((40 / 516) * 360, 6);
    expect(m.balloons.map((b) => b.found)).toEqual([false, true]);
    expect(m.challenges.map((c) => c.medal)).toEqual(['silver', null]);
    expect(m.water).toBeCloseTo(((205 + 236) / 516) * 360, 6);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run tests/unit/mapModel.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `src/game/mapModel.js`**

```js
// The Progress page's city map as plain shapes: blocks, water, balloon pins and challenge
// medals. Pure; src/ui/progressMap.js inks it onto a canvas.
import { districtAt, WORLD } from '../world/mapData.js';

// Includes the harbour south of the city so the lighthouse balloon (z 270) fits.
export const MAP_BOUNDS = { minX: WORLD.minX, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: 280 };
const span = (b) => Math.max(b.maxX - b.minX, b.maxZ - b.minZ);

export function toMap(x, z, size, b = MAP_BOUNDS) {
  const s = size / span(b);
  return { u: (x - b.minX) * s, v: (z - b.minZ) * s };
}

export function mapModel({ buildings, balloons, challenges, progress, size = 360 }) {
  const s = size / span(MAP_BOUNDS);
  const blocks = buildings.map((b) => {
    const c = toMap(b.x - b.w / 2, b.z - b.d / 2, size);
    return { u: c.u, v: c.v, w: b.w * s, h: b.d * s, district: b.district, landmark: !!b.landmark };
  });
  const pins = balloons
    .map((bl, i) => ({ ...toMap(bl.x, bl.z, size), found: progress.balloons.includes(i), district: districtAt(bl.x, bl.z) }))
    .filter((p) => p.found || progress.districts.includes(p.district))
    .map(({ u, v, found }) => ({ u, v, found }));
  const medals = challenges.map((c) => ({ id: c.id, ...toMap(c.x, c.z, size), medal: progress.challenges[c.id]?.medal ?? null }));
  return { size, water: toMap(0, WORLD.waterZ, size).v, blocks, balloons: pins, challenges: medals };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/mapModel.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/mapModel.js tests/unit/mapModel.test.js
git commit -m "City map model for the Progress page"
```

---

### Task 8: Engine hooks: encounters, flow, input and bindings

**Files:**
- Modify: `src/game/encounters.js`
- Modify: `src/game/flow.js`
- Modify: `src/core/bindings.js`, `src/core/input.js`
- Modify: `src/game/game.js` (splash order, pad and key guards)
- Test: `tests/unit/encounters.test.js`, `tests/unit/bindings.test.js` (one new case)

**Interfaces:**
- Consumes: `FIGHTS`, `SITES`.
- Produces: `encounters.begin(id, def)`, `encounters.id` cleared on a win, `createFlow({ side })`, the `photo` action, `input.padButtonHeld(i)`, `input.stick`.

- [ ] **Step 1: Write the failing encounter tests**

```js
// tests/unit/encounters.test.js
import { describe, it, expect } from 'vitest';
import { createEvents } from '../../src/core/events.js';
import { createEncounters } from '../../src/game/encounters.js';

function setup() {
  const events = createEvents();
  const made = [];
  const spawn = (type, p) => { const e = { type, pos: { ...p }, alive: true, aware: false, wake() { this.aware = true; } }; made.push(e); return e; };
  const combat = { list: [], setEnemies(l) { this.list = l; } };
  const enc = createEncounters({ spawn, despawn: () => {}, combat, events, collision: { groundBelow: () => 0 } });
  return { events, made, enc };
}
const def = { site: { x: 10, y: 0, z: 10 }, radius: 8, waves: [[{ type: 'grunt', dx: 1, dz: 0 }], [{ type: 'knife', dx: 0, dz: 1 }]] };

describe('encounters with inline fights', () => {
  it('places an inline fight at its site object and runs its waves', () => {
    const { events, made, enc } = setup();
    const seen = [];
    events.on('fightStart', ({ id }) => seen.push(['start', id]));
    events.on('fightDone', ({ id }) => seen.push(['done', id, enc.id]));
    enc.begin('crime:1', def);
    expect(made[0].pos).toEqual({ x: 11, y: 0, z: 10 });
    enc.update(0.1, { pos: { x: 100, y: 0, z: 100 } });
    expect(enc.active).toBe(false);
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(seen).toEqual([['start', 'crime:1']]);
    made[0].alive = false;
    enc.update(1.5, { pos: { x: 10, y: 0, z: 12 } });
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(made).toHaveLength(2);
    made[1].alive = false;
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    enc.update(0.1, { pos: { x: 10, y: 0, z: 12 } });
    expect(seen[1]).toEqual(['done', 'crime:1', null]);
    expect(enc.id).toBe(null);
  });
  it('restarts an inline fight with the same definition', () => {
    const { made, enc } = setup();
    enc.begin('challenge:bash', def);
    enc.restart();
    expect(made.map((e) => e.pos)).toEqual([{ x: 11, y: 0, z: 10 }, { x: 11, y: 0, z: 10 }]);
  });
  it('still runs story fights by id', () => {
    const { made, enc } = setup();
    enc.begin('docksRoof');
    expect(made[0].pos).toEqual({ x: -64, y: 0, z: 175 });
    expect(enc.id).toBe('docksRoof');
  });
});
```

The wave logic: after the first KO the next update moves the goon to `dead`, then `nextWaveT` must pass 1.4 s. If the exact update count differs, adjust only the number of `update` calls in the test, never the encounter timing.

Add to `tests/unit/bindings.test.js`:

```js
  it('binds photo mode to O by default', () => {
    expect(DEFAULT_BINDINGS.photo).toEqual(['KeyO']);
    expect(ACTIONS.find((a) => a.id === 'photo').label).toBe('Photo mode');
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/unit/encounters.test.js tests/unit/bindings.test.js`
Expected: FAIL.

- [ ] **Step 3: Encounters.** In `src/game/encounters.js`:
  - Add below the imports: `const siteOf = (f) => (typeof f.site === 'string' ? SITES[f.site] : f.site);`
  - Add `let def = null;` next to `let fight = null;`.
  - In `placeWave` and `update`, replace `const site = SITES[fight.site];` with `const site = siteOf(fight);`.
  - Replace `begin`, `restart` and the win branch:

```js
    // Sets up a fight: goons wait at their spots until the hero shows up. `fightDef` defaults to
    // the story fight of that id; side content passes its own ({ site: key or {x,y,z}, radius, waves }).
    begin(fightId, fightDef = FIGHTS[fightId]) {
      clear();
      id = fightId;
      def = fightDef;
      fight = fightDef;
      wave = 0;
      triggered = false;
      placeWave(0, false);
    },
    restart() {
      if (!id) return;
      this.begin(id, def);
    },
```

```js
        } else {
          // Clear the id before announcing the win: listeners may begin the next fight.
          const done = id;
          fight = null;
          id = null;
          triggered = false;
          events.emit('fightDone', { id: done });
        }
```

  Also set `def = null;` inside `end()`.

- [ ] **Step 4: Flow.** In `src/game/flow.js`:

```js
// after the destructuring line at the top of createFlow
  const side = d.side ?? { holdStory: () => false, marker: () => null, onRespawn: () => null };
```

Replace the `fightStart` listener so side fights never touch the story beacon:

```js
  events.on('fightStart', ({ id }) => {
    if (objectives.step?.fight !== id) return;
    fightStarted = true;
    beacon.set(null);
  });
```

In `respawn()`, replace the lines from `const finished = ...` through `hero.teleport(p, yaw);` with:

```js
    const finished = objectives.done || STEPS[objectives.index]?.type === 'credits';
    // Side content first: it clears a crime fight or a challenge and may want the hero back at a
    // challenge marker instead of the story checkpoint.
    const over = side.onRespawn();
    const p = over ?? (finished ? { ...SITES.start } : respawnPoint());
    // Face the objective, not whatever wall we happened to be looking at.
    const aim = over || finished ? null : target;
    const yaw = over?.yaw ?? (aim ? Math.atan2(aim.x - p.x, aim.z - p.z) : hero.bat.yaw);
    hero.teleport(p, yaw);
```

In `update()`, gate the reach check and let side content take the marker:

```js
      if (s && target && !side.holdStory() && s.type !== 'fight' && s.type !== 'boss' && s.type !== 'cutscene') {
```
```js
      waypoint.update(side.marker() ?? (showMarker ? target : null), camera, hero.pos);
```

- [ ] **Step 5: Bindings and input.** In `src/core/bindings.js` add to `ACTIONS` (after `help`) and to `DEFAULT_BINDINGS`:

```js
  { id: 'photo', label: 'Photo mode', group: 'Other' },
```
```js
  photo: ['KeyO'],
```

In `src/core/input.js`:

```js
const PAD_BUTTONS = {
  jump: [0], kick: [1], punch: [2], block: [3], grapple: [4], cape: [5], dodge: [6], batarang: [7],
  detective: [8], pause: [9], sprint: [10], special: [11], photo: [12], help: [13], throw: [15],
};
```
```js
  // Typing in a text field (the photo caption) never drives the game.
  const typing = (e) => !!e.target?.closest?.('input[type="text"], textarea');
  const onKeyDown = (e) => { if (typing(e)) return; if (!e.repeat) codeDown(e.code, e); else if (codeToActions.has(e.code)) e.preventDefault(); };
```
and in the returned object:
```js
    // Raw pad state for screens with their own controls (photo mode). Works while disabled.
    padButtonHeld: (i) => rawHeld.has(i),
    get stick() { return stick; },
```

- [ ] **Step 6: game.js guards.**
  - Water: make the teleport happen before the event, so a challenge can move the hero back to its marker:
    ```js
        if (hero.pos.y < -0.8) { hero.teleport(hero.lastSafe); events.emit('splash'); }
    ```
  - `padControls()`: move the comic handling to the top so comic pages opened from the pause menu (Task 15) work on a pad, and delete the old comic block further down:
    ```js
    function padControls() {
      if (game?.comic.playing) {
        if (input.padButton(0)) game.comic.advance();
        if (input.padButton(1)) game.comic.skip();
        return;
      }
      if (state.phase === 'title' || state.paused || menus.open) {
    ```
  - The `keydown` listener: first line after the phase check, `if (e.target?.closest?.('input[type="text"], textarea')) return;`

- [ ] **Step 7: Run all unit tests**

Run: `npx vitest run`
Expected: PASS, including `prompts.test.js` and `persistence.test.js`.

- [ ] **Step 8: Smoke-check the story still works** (build frozen, then):

```bash
npx vite build --outDir "$TEMP/c3dist" && (npx vite preview --outDir "$TEMP/c3dist" --port 5206 --strictPort &) && sleep 3
BASE_URL=http://localhost:5206 npx playwright test tests/e2e/smoke.spec.js
```
Expected: all smoke tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/game/encounters.js src/game/flow.js src/core/bindings.js src/core/input.js src/game/game.js tests/unit/encounters.test.js tests/unit/bindings.test.js
git commit -m "Engine hooks for side content: inline fights, flow side hooks, photo action"
```

---

### Task 9: Side props, the civilian and the warm-up

**Files:**
- Create: `src/world/sideProps.js`
- Modify: `src/actors/characters.js` (`civilian` look)
- Modify: `src/game/warmCast.js`

**Interfaces:**
- Consumes: `toonMaterial`, `addHullOutline`, `batOutline`, `LAYER_XRAY`, `PALETTE`.
- Produces: `createPillar`, `createRingMesh`, `createVan`, `createLootBags`; `createGoon(assets, { type: 'civilian' })`.

- [ ] **Step 1: Write `src/world/sideProps.js`**

```js
// Side content props, all authored in code: the glowing bat pillars that start challenges, the
// ink hoops of the ring courses, the crime van and the robbery loot.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_XRAY } from '../render/layers.js';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { batOutline } from '../config/batShape.js';

let batGeo = null, torusGeo = null, wheelGeo = null, sackGeo = null;
function batGeometry() {
  if (!batGeo) {
    const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x / 100, y / 100)));
    batGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }).translate(0, 0, -0.04);
  }
  return batGeo;
}

// A dark post with a yellow band and a spinning bat on top. The x-ray bat shows through walls
// in detective vision.
export function createPillar() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 2.4, 10).translate(0, 1.2, 0), toonMaterial({ color: 0x2a2f3d }));
  addHullOutline(post, 0.03);
  const glow = new THREE.MeshBasicMaterial({ color: PALETTE.signal });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10, 1, true).translate(0, 2.25, 0), glow);
  const bat = new THREE.Mesh(batGeometry(), glow);
  bat.position.y = 3.1;
  bat.scale.setScalar(1.5);
  const xray = new THREE.Mesh(batGeometry(), new THREE.MeshBasicMaterial({ color: PALETTE.signal, transparent: true, opacity: 0.85, depthTest: false }));
  xray.position.y = 3.1;
  xray.scale.setScalar(1.8);
  xray.layers.set(LAYER_XRAY);
  g.add(post, band, bat, xray);
  g.userData.bat = bat;
  g.userData.xray = xray;
  return g;
}

// A unit-radius inked hoop; the runner scales it to the ring's radius. 'next' is signal
// yellow, 'later' paper white, 'done' hidden.
export function createRingMesh() {
  torusGeo ??= new THREE.TorusGeometry(1, 0.09, 8, 48);
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.signal });
  const hoop = new THREE.Mesh(torusGeo, mat);
  addHullOutline(hoop, 0.035);
  const g = new THREE.Group();
  g.add(hoop);
  g.userData.base = 1;
  g.userData.setState = (s) => {
    g.visible = s !== 'done';
    mat.color.setHex(s === 'next' ? PALETTE.signal : PALETTE.paper);
  };
  return g;
}

// A purple delivery van with its back doors hanging open. Length runs along local z.
export function createVan() {
  const g = new THREE.Group();
  const paint = toonMaterial({ color: 0x6b5b95 });
  const dark = toonMaterial({ color: PALETTE.ink });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.2, 3.6).translate(0, 1.5, -0.6), paint);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 1.5).translate(0, 1.2, 1.9), paint);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 0.05).translate(0, 1.65, 2.66), new THREE.MeshBasicMaterial({ color: 0x1c2433 }));
  for (const m of [body, cab]) addHullOutline(m, 0.03);
  wheelGeo ??= new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12).rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1, -1.7], [1, -1.7], [-1, 1.8], [1, 1.8]]) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  for (const s of [-1, 1]) {
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.9, 0.06).translate(s * 0.51, 0, 0), paint);
    door.position.set(-s * 1.05, 1.5, -2.42);
    door.rotation.y = s * 1.9;
    g.add(door);
  }
  g.add(body, cab, glass);
  return g;
}

// Three swag sacks and a split crate by a shop door.
export function createLootBags() {
  const g = new THREE.Group();
  const sack = toonMaterial({ color: 0xb59a6a });
  sackGeo ??= new THREE.SphereGeometry(0.4, 12, 10).scale(1, 1.2, 1);
  for (const [x, z, s] of [[0.6, 0.2, 1], [-0.5, 0.5, 0.8], [0.1, -0.6, 0.9]]) {
    const m = new THREE.Mesh(sackGeo, sack);
    m.position.set(x, 0.45 * s, z);
    m.scale.setScalar(s);
    addHullOutline(m, 0.02);
    g.add(m);
  }
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8).translate(0, 0.3, 0), toonMaterial({ color: 0x7a5a3a }));
  crate.position.set(-0.9, 0, -0.5);
  crate.rotation.y = 0.5;
  addHullOutline(crate, 0.02);
  g.add(crate);
  return g;
}
```

- [ ] **Step 2: The civilian look.** In `src/actors/characters.js`:
  - Add to `GOON_LOOKS`: `civilian: { parts: ['Male_Peasant_Body', 'Male_Peasant_Legs', 'Male_Peasant_Feet', 'Male_Peasant_Arms'], hat: null },`
  - Add after `GOON_SCHEMES`: `const CIVILIAN_SCHEME = { a: [0x5a4a3a, 0x8a7a64], b: [0x33303a, 0xcfc6b0] };`
  - In `createGoon`, add `const civilian = type === 'civilian';` after `const brute = ...`, then:
    ```js
    const look = GOON_LOOKS[civilian ? 'civilian' : brute ? 'brute' : type === 'knife' ? 'knife' : pick(['striped', 'striped', 'hoodie'])];
    const scheme = civilian ? CIVILIAN_SCHEME : type === 'knife' ? GOON_SCHEMES[1] : brute ? GOON_SCHEMES[3] : pick(GOON_SCHEMES);
    ```
  - Replace `eyes.visible = false; brows.visible = false;` with `eyes.visible = civilian; brows.visible = civilian;`
  - Wrap the mask block (from `const maskGeo = ...` through `addHullOutline(mask, 0.005);`) in `if (!civilian) { ... }`. Keep `const r = lm.headRadius * 1.12;` outside the block, since the hats use `r`.
  - Update the type comment: `// type: 'grunt' | 'knife' | 'brute' | 'civilian' (a bystander for street crimes, never an enemy)`.
  - The civilian path calls no `pick()`, so the combat RNG sequence is unchanged.

- [ ] **Step 3: Warm-up.** In `src/game/warmCast.js`:

```js
import { createPillar, createRingMesh, createVan, createLootBags } from '../world/sideProps.js';
```
After the brute/knife loop:
```js
  add(createGoon(assets, { type: 'civilian', rng: fixed(0) }), (x += 2));
```
Before `add(createJoker(...))`:
```js
  // Side content props share the city's programs, but drawing them once here keeps a first
  // sighting (a new hoop, the crime van) from uploading anything mid-play.
  [createPillar(), createRingMesh(), createVan(), createLootBags()].forEach((m, i) => { m.position.set(40 + i * 5, -50, 0); group.add(m); });
```
Update the file's header comment to mention the civilian and the side props.

- [ ] **Step 4: Check the build and the boot** (frozen build on 5206, then):

```bash
node scripts/dev-play.mjs "http://localhost:5206/?play=1" "$TEMP/c3-t9" '[{"wait":1500},{"eval":"performance.getEntriesByType(\"mark\").map(m=>m.name+\":\"+Math.round(m.startTime)).join(\" \")"}]'
```
Expected: `no console errors`; `boot:firstFrame` within 0.3 s of the value before this task (run the same command on the Task 8 build for the reference).

- [ ] **Step 5: Commit**

```bash
git add src/world/sideProps.js src/actors/characters.js src/game/warmCast.js
git commit -m "Side content props and the civilian look, pre-warmed with the cast"
```

---

### Task 10: Side content glue: stats, districts, moves and milestones

**Files:**
- Create: `src/ui/sideHud.js`
- Create: `src/game/sideContent.js`
- Modify: `src/game/game.js`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `tracker`, `milestonesCrossed` (Task 2), `createPlayStats` (Task 3), `newGameProgress`, `DISTRICT_IDS` (Task 1), `districtAt`, `side` hooks on flow (Task 8), the `moveLearned` event from Plan 3B.
- Produces: `createSideHud`, `createSideContent` (base), `events`: `districtVisited`, `milestone`, `unlock`.

- [ ] **Step 1: Write `src/ui/sideHud.js`**

```js
// HUD pieces for side content: the challenge panel and timer, the 3-2-1 comic panels, short
// hints, police radio captions, milestone toasts and the bat markers over challenge pillars.
import { batSvgPath } from '../config/batShape.js';

export function createSideHud(root) {
  const el = document.createElement('div');
  el.className = 'side-hud';
  el.innerHTML = `
    <div class="ch-panel"><div class="ch-name"></div><div class="ch-time"></div><div class="ch-sub"></div></div>
    <div class="ch-count"></div>
    <div class="ch-hint"></div>
    <div class="radio"><div class="radio-title"></div><div class="radio-text"></div></div>
    <div class="side-toast"><div class="toast-title"></div><div class="toast-text"></div></div>
    <div class="ch-markers"></div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const panel = q('.ch-panel'), nameEl = q('.ch-name'), timeEl = q('.ch-time'), subEl = q('.ch-sub');
  const count = q('.ch-count'), hintEl = q('.ch-hint'), radio = q('.radio'), toast = q('.side-toast'), markers = q('.ch-markers');
  const marks = new Map();
  const timers = new Map();
  const set = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const flash = (node, key, ms) => {
    node.classList.add('show');
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => node.classList.remove('show'), ms));
  };
  const pop = (node) => { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); };

  return {
    challenge(title) { set(nameEl, title); set(timeEl, ''); set(subEl, ''); panel.classList.add('show'); },
    timer(main, sub = '') { set(timeEl, main); set(subEl, sub); },
    countdown(text) { count.textContent = text; pop(count); },
    clearChallenge() { panel.classList.remove('show'); },
    hint(text, ms = 3000) { set(hintEl, text); flash(hintEl, 'hint', ms); },
    radio(title, text, ms = 6000) { set(q('.radio-title'), title); set(q('.radio-text'), text); flash(radio, 'radio', ms); },
    toast(title, text, ms = 6000) { set(q('.toast-title'), title); set(q('.toast-text'), text); flash(toast, 'toast', ms); },
    marker(id, x, y, visible, medal = null) {
      let m = marks.get(id);
      if (!visible) { if (m && m.style.display !== 'none') m.style.display = 'none'; return; }
      if (!m) {
        m = document.createElement('div');
        m.className = 'ch-marker';
        m.innerHTML = `<svg viewBox="-52 -26 104 52"><path d="${batSvgPath(1, 0, 0)}"/></svg>`;
        markers.appendChild(m);
        marks.set(id, m);
      }
      m.style.display = '';
      m.dataset.medal = medal ?? 'none';
      m.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },
    hideMarkers() { for (const m of marks.values()) m.style.display = 'none'; },
  };
}
```

- [ ] **Step 2: Write `src/game/sideContent.js` (base)**

```js
// Side content glue: play stats, districts and moves for the Progress page, milestone captions,
// and (Tasks 11 to 15) challenges, street crimes and the menu pages. The story flow sees side
// content only through flowHooks.
import * as THREE from 'three';
import { districtAt } from '../world/mapData.js';
import { DISTRICT_IDS, saveProgress } from '../core/save.js';
import { tracker, milestonesCrossed } from './progressTracker.js';
import { createPlayStats } from './playStats.js';
import { createSideHud } from '../ui/sideHud.js';

export const MILESTONE_TEXT = {
  25: 'A quarter of Gotham, handled. The Joker has started to notice.',
  50: 'Halfway there. Gotham is sleeping a little easier tonight.',
  75: 'Three quarters done. This city owes you a very large cake.',
  100: 'One hundred percent. A page has been left for you in the Progress menu.',
};

export function createSideContent(deps) {
  const { hero, combat, events, hudRoot, progress, storage } = deps;
  const save = () => saveProgress(storage, progress);
  const ui = createSideHud(hudRoot);
  const stats = createPlayStats(progress.stats);
  const last = new THREE.Vector3().copy(hero.pos);
  let dirty = true, districtT = 0, saveT = 0;

  events.on('ko', () => stats.ko());
  events.on('takedown', () => stats.ko());
  events.on('moveLearned', ({ id }) => {
    if (progress.moves.includes(id)) return;
    progress.moves.push(id);
    save();
    dirty = true;
  });
  for (const ev of ['balloon', 'objectiveDone', 'challengeDone', 'crimeStopped']) events.on(ev, () => { dirty = true; });

  // Captions at 25, 50, 75 and 100%. progress.milestone remembers the highest one shown, so a
  // new post-game category that lowers the percentage never replays them.
  function checkMilestones() {
    dirty = false;
    const crossed = milestonesCrossed(progress.milestone, tracker.score(progress).percent);
    if (!crossed.length) return;
    const top = crossed[crossed.length - 1];
    progress.milestone = top;
    if (top === 100 && !progress.unlocks.includes('fromKrishn')) {
      progress.unlocks.push('fromKrishn');
      events.emit('unlock', { id: 'fromKrishn' });
    }
    save();
    ui.toast(`${top}% complete`, MILESTONE_TEXT[top], 7000);
    events.emit('milestone', { percent: top });
  }

  function visitDistrict() {
    const d = districtAt(hero.pos.x, hero.pos.z);
    if (!DISTRICT_IDS.includes(d) || progress.districts.includes(d)) return;
    progress.districts.push(d);
    save();
    dirty = true;
    events.emit('districtVisited', { id: d });
  }

  return {
    ui,
    stats,
    score: () => tracker.score(progress),
    // dt is game time (slow motion and hit-stop included), real is wall time.
    update(dt, real) {
      stats.tick(real);
      stats.combo(combat.combo.value);
      if (hero.state === 'glide') stats.glide(hero.glide.speed, Math.hypot(hero.pos.x - last.x, hero.pos.z - last.z));
      last.copy(hero.pos);
      districtT -= real;
      if (districtT <= 0) { districtT = 0.5; visitDistrict(); }
      if (dirty) checkMilestones();
      saveT += real;
      if (saveT > 20) { saveT = 0; save(); }
    },
    flowHooks: { holdStory: () => false, marker: () => null, onRespawn: () => null },
    photoTaken() { stats.photo(); save(); },
  };
}
```

- [ ] **Step 3: Wire it into `src/game/game.js`**
  - Imports: `import { loadProgress, saveProgress, sanitizeProgress, DEFAULT_PROGRESS, newGameProgress } from '../core/save.js';` and `import { createSideContent } from './sideContent.js';`
  - In `begin(suit, fresh)`: `if (fresh) progress = newGameProgress(progress);`
  - In `buildRun`, replace the `createFlow({...})` call's argument object by adding `side: sideHooks`, and create the glue right after it:

```js
    // Late-bound: side content needs the flow, and the flow asks side content three questions.
    const sideHooks = { holdStory: () => false, marker: () => null, onRespawn: () => null };
    const flow = createFlow({
      hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups,
      collision: world.collision, follow, boss, finale, neonParty, side: sideHooks,
      onCredits: () => { /* unchanged */ },
    });
    const side = createSideContent({
      scene, assets, hero, follow, combat, encounters, events, flow, prompts, progress, storage, rng,
      hudRoot: hudRoot.querySelector('.hud') ?? hudRoot, collision: world.collision, buildings: world.data.buildings,
    });
    Object.assign(sideHooks, side.flowHooks);
```
  - Extend the move ids (Plan 3B's line): `const MOVE_IDS = { ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zipline', wallRun: 'wallrun', diveImpact: 'divebomb', throwRelease: 'throw', slam: 'slam', counter: 'counter' };`
  - In `update(real)`, inside `if (playing && !state.paused) { ... }`, right after `hero.update(dt, ctx);`: `side.update(dt, real, { toScreen });`
  - Add `side, stage` to the `api` object.

- [ ] **Step 4: Styles.** Append to `src/ui/style.css`:

```css
/* ---- side content (Plan 3C) ---- */
.ch-panel { position: absolute; left: 28px; top: 24px; min-width: 220px; padding: 8px 14px 10px; background: var(--paper); color: var(--ink); border: 3px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); transform: rotate(-1deg); display: none; }
.ch-panel.show { display: block; }
.ch-name { font: 22px 'Bangers', cursive; letter-spacing: 1px; color: var(--balloon); -webkit-text-stroke: 1px var(--ink); }
.ch-time { font: 700 34px/1 'Barlow Condensed', sans-serif; }
.ch-sub { font: 18px 'Patrick Hand SC', cursive; }
.ch-count { position: absolute; left: 50%; top: 38%; padding: 6px 34px; font: 120px/1 'Bangers', cursive; color: var(--signal); -webkit-text-stroke: 4px var(--ink); paint-order: stroke fill; background: var(--paper); border: 5px solid var(--ink); box-shadow: 10px 10px 0 var(--ink); opacity: 0; transform: translate(-50%, -50%) rotate(-4deg); pointer-events: none; }
.ch-count.pop { animation: chcount 0.8s ease-out forwards; }
@keyframes chcount {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-4deg) scale(0.4); }
  20% { opacity: 1; transform: translate(-50%, -50%) rotate(-4deg) scale(1.1); }
  35% { transform: translate(-50%, -50%) rotate(-4deg) scale(1); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(-4deg) scale(1); }
}
.ch-hint { position: absolute; left: 50%; bottom: 150px; transform: translateX(-50%) rotate(-1deg); padding: 8px 16px; background: var(--signal); color: var(--ink); border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); font: 22px 'Patrick Hand SC', cursive; opacity: 0; transition: opacity 0.3s; }
.ch-hint.show { opacity: 1; }
.radio, .side-toast { position: absolute; left: 28px; max-width: 360px; padding: 8px 14px 10px; color: var(--ink); border: 3px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); transform: translateX(-16px) rotate(-1.5deg); opacity: 0; transition: opacity 0.3s, transform 0.3s; }
.radio { top: 150px; background: var(--signal); }
.side-toast { top: 250px; background: #fffdf5; }
.radio.show, .side-toast.show { opacity: 1; transform: translateX(0) rotate(-1.5deg); }
.radio-title, .toast-title { font: 20px 'Bangers', cursive; letter-spacing: 1.5px; color: var(--balloon); -webkit-text-stroke: 1px var(--ink); }
.radio-text, .toast-text { font: 21px/1.2 'Patrick Hand SC', cursive; }
.ch-markers { position: absolute; inset: 0; pointer-events: none; }
.ch-marker { position: absolute; left: 0; top: 0; width: 44px; height: 22px; margin: -11px 0 0 -22px; filter: drop-shadow(2px 2px 0 var(--ink)); }
.ch-marker path { fill: var(--paper); stroke: var(--ink); stroke-width: 5; }
.ch-marker[data-medal="bronze"] path { fill: #c07a3c; }
.ch-marker[data-medal="silver"] path { fill: #c9ccd6; }
.ch-marker[data-medal="gold"] path { fill: var(--signal); }
```

- [ ] **Step 5: Scripted check.** Frozen build, then:

```bash
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-t10" '[{"wait":1200},{"eval":"window.__game.teleport(\"neonStreet\")"},{"wait":1500},{"eval":"JSON.stringify(window.__game.progress.districts)"},{"eval":"window.__game.side.score().percent"},{"eval":"(window.__game.events.emit(\"counter\",{count:1}), window.__game.progress.moves)"},{"eval":"window.__game.progress.stats.playTime > 1"}]'
```
Expected: districts are `["docks","neon"]` (`?at=toNeon` respawns at its checkpoint, the presents on the freighter, so the Docks count first); the percentage is a number; moves include `counter`; `true`; `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/ui/sideHud.js src/game/sideContent.js src/game/game.js src/ui/style.css
git commit -m "Side content glue: play stats, districts, moves and milestone captions"
```

---

### Task 11: Challenge runner: pillars, countdown, rings and parkour

**Files:**
- Create: `src/game/challengeRunner.js`
- Modify: `src/game/sideContent.js`, `src/game/game.js`, `src/ui/menus.js` (pause options), `src/ui/prompts.js`

**Interfaces:**
- Consumes: `CHALLENGES`, `pillarPos`, `createRingRun`, `createCheckpointRun`, `recordResult`, `allGold`, `formatResult`, `formatTime`, `MEDAL_NAME`, `MOVE_LABEL` (Task 4); `createPillar`, `createRingMesh` (Task 9); `createSideHud` (Task 10); `isCrimeId` (Task 5).
- Produces: `createChallengeRunner` (Shared interfaces), events `challengeStart`, `countdown`, `ringPass`, `checkpoint`, `challengeDone`, `challengeFail`, `unlock {id:'goldStandard'}`; `side.challenges`, `side.data`, `side.pauseInfo()`; `menus.pause(opts)` with optional buttons.

- [ ] **Step 1: Write `src/game/challengeRunner.js`**

```js
// Runs one challenge at a time: the start pillars, the 3-2-1 countdown, rings or checkpoints,
// results and medals. The arena (arenaChallenge.js) plugs in through registerKind.
import * as THREE from 'three';
import MANSI from '../mansi.config.js';
import {
  CHALLENGES, MEDAL_NAME, MOVE_LABEL, pillarPos, createRingRun, createCheckpointRun, recordResult, allGold, formatResult, formatTime,
} from './challenges.js';
import { createPillar, createRingMesh } from '../world/sideProps.js';

const START_RADIUS = 2.2;
const BEAT = 0.8;
const COUNT = ['3', '2', '1', 'GO!'];
const MOVE_EVENTS = { ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zipline', wallRun: 'wallrun' };
const FAIL_TEXT = {
  quit: 'Challenge quit.',
  water: 'Into the water. Challenge failed.',
  down: 'Knocked out. Challenge failed.',
  time: 'Out of time. Challenge failed.',
  fight: 'A fight broke out. Challenge called off.',
};
const pointsOf = (ch) => (ch.kind === 'rings' ? ch.rings : ch.kind === 'parkour' ? ch.checkpoints : []);

export function createChallengeRunner({ scene, hero, follow, events, ui, progress, save, canStart, hidden = () => false }) {
  const pillars = CHALLENGES.map((ch) => {
    const at = pillarPos(ch);
    const mesh = createPillar();
    mesh.position.set(at.x, at.y, at.z);
    scene.add(mesh);
    return { ch, at, mesh };
  });
  // Every hoop exists from the start (hidden) so begin()'s warm-up draw uploads it.
  const hoops = [];
  const most = Math.max(...CHALLENGES.map((c) => pointsOf(c).length));
  for (let i = 0; i < most; i++) { const m = createRingMesh(); m.visible = false; scene.add(m); hoops.push(m); }

  const kinds = {};
  const prev = new THREE.Vector3();
  const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
  let run = null;
  let armed = true;
  let blockedHint = false;
  let respawnAt = null;
  let t = 0;

  function layout(ch) {
    const lift = ch.kind === 'parkour' ? 1.6 : 0;
    pointsOf(ch).forEach((p, i) => {
      const m = hoops[i];
      m.userData.base = ch.kind === 'parkour' ? 1.6 : p.r;
      m.scale.setScalar(m.userData.base);
      m.position.set(p.x, p.y + lift, p.z);
      m.lookAt(p.x + p.nx, p.y + lift + p.ny, p.z + p.nz);
    });
  }
  function tint(next) {
    for (let i = 0; i < run.count; i++) hoops[i].userData.setState(i < next ? 'done' : i === next ? 'next' : 'later');
  }
  function hideHoops() { for (const m of hoops) m.visible = false; }

  function start(ch) {
    events.emit('challengeStart', { id: ch.id });
    respawnAt = null;
    run = { ch, phase: 'countdown', t: 0, beat: -1, logic: null, count: pointsOf(ch).length };
    hero.teleport(ch.start, ch.start.yaw);
    follow.snapBehind(ch.start.yaw);
    // Holds the hero still until GO.
    hero.control = { name: 'countdown', update: () => !run || run.phase !== 'countdown' };
    if (run.count) { layout(ch); tint(0); }
    ui.challenge(ch.name);
    ui.timer(ch.kind === 'arena' ? '0' : formatTime(0), ch.blurb);
    kinds[ch.kind]?.prepare?.(run);
  }

  function beginRunning() {
    run.phase = 'running';
    prev.copy(hero.pos);
    if (run.ch.kind === 'rings') run.logic = createRingRun(run.ch);
    else if (run.ch.kind === 'parkour') run.logic = createCheckpointRun(run.ch);
    kinds[run.ch.kind]?.begin?.(run);
  }

  function end() {
    if (!run) return;
    kinds[run.ch.kind]?.end?.(run);
    if (hero.control?.name === 'countdown') hero.control = null;
    hideHoops();
    ui.clearChallenge();
    run = null;
    armed = false;
  }

  function finish(value) {
    if (!run) return;
    const ch = run.ch;
    const res = recordResult(progress.challenges, ch, value);
    progress.challenges[ch.id] = res.entry;
    let unlocked = false;
    if (!progress.unlocks.includes('goldStandard') && allGold(progress.challenges)) { progress.unlocks.push('goldStandard'); unlocked = true; }
    save();
    const medal = res.medal ? `${MEDAL_NAME[res.medal]}!` : 'No medal this time.';
    ui.toast(ch.name, `${medal} ${formatResult(ch, value)}.${res.newBest ? ' New best!' : ''}`, 6500);
    events.emit('challengeDone', { id: ch.id, value, medal: res.medal, newBest: res.newBest });
    if (unlocked) {
      events.emit('unlock', { id: 'goldStandard' });
      setTimeout(() => ui.toast(`${MANSI.name}'s Gold Standard`, 'Gold in every challenge. A new comic page is waiting in the Challenges menu.', 8000), 7000);
    }
    end();
  }

  function fail(reason) {
    if (!run) return;
    const ch = run.ch;
    ui.toast(ch.name, FAIL_TEXT[reason] ?? FAIL_TEXT.quit, 4000);
    events.emit('challengeFail', { id: ch.id, reason });
    end();
    // Knocked out: the death comic plays first, then flow.respawn asks takeRespawn(). A story
    // fight that woke up: stay and fight it. Anything else: straight back to the marker.
    if (reason === 'down') respawnAt = { ...ch.start };
    else if (reason !== 'fight') { hero.teleport(ch.start, ch.start.yaw); follow.snapBehind(ch.start.yaw); }
  }

  events.on('splash', () => { if (run) fail('water'); });
  events.on('heroDown', () => { if (run) fail('down'); });
  events.on('fightStart', ({ id }) => { if (run && !kinds[run.ch.kind]?.ownsFight?.(id)) fail('fight'); });
  for (const [ev, id] of Object.entries(MOVE_EVENTS)) events.on(ev, () => run?.logic?.noteMove?.(id));

  function checkPillars(dt) {
    const hide = hidden();
    let near = null;
    for (const p of pillars) {
      p.mesh.visible = !hide;
      p.mesh.userData.bat.rotation.y += dt * 1.5;
      p.mesh.userData.xray.rotation.y = p.mesh.userData.bat.rotation.y;
      if (!hide && Math.hypot(hero.pos.x - p.at.x, hero.pos.z - p.at.z) < START_RADIUS && Math.abs(hero.pos.y - p.at.y) < 2.5) near = p;
    }
    if (!near) { armed = true; blockedHint = false; return; }
    if (!armed) return;
    if (canStart(near.ch)) { armed = false; start(near.ch); }
    else if (!blockedHint) { blockedHint = true; ui.hint('Not now. Finish what you are doing first.', 2500); }
  }

  function update(dt) {
    t += dt;
    if (!run) { checkPillars(dt); return; }
    if (run.phase === 'countdown') {
      run.t += dt;
      const beat = Math.min(COUNT.length - 1, Math.floor(run.t / BEAT));
      if (beat !== run.beat) { run.beat = beat; ui.countdown(COUNT[beat]); events.emit('countdown', { beat }); }
      if (run.t >= BEAT * (COUNT.length - 1)) beginRunning();
      return;
    }
    const ch = run.ch;
    if (ch.kind === 'rings') {
      a.x = prev.x; a.y = prev.y + 1; a.z = prev.z;
      b.x = hero.pos.x; b.y = hero.pos.y + 1; b.z = hero.pos.z;
      prev.copy(hero.pos);
      const r = run.logic.update(dt, a, b);
      if (r) { tint(run.logic.next); events.emit('ringPass', { index: run.logic.next - 1 }); }
      if (r === 'finish') { finish(run.logic.time); return; }
      ui.timer(formatTime(run.logic.time), `Ring ${run.logic.next + 1} of ${run.logic.total}`);
    } else if (ch.kind === 'parkour') {
      const cp = ch.checkpoints[run.logic.next];
      const r = run.logic.update(dt, hero.pos);
      if (r === 'needs') ui.hint(`Use a ${MOVE_LABEL[cp.needs]} to reach this checkpoint.`, 3500);
      if (r === 'checkpoint') { tint(run.logic.next); events.emit('checkpoint', { index: run.logic.next - 1 }); }
      if (r === 'finish') { finish(run.logic.time); return; }
      const nextCp = ch.checkpoints[run.logic.next];
      ui.timer(formatTime(run.logic.time), `${run.logic.next + 1} of ${run.logic.total}: ${nextCp.label}`);
    } else {
      kinds[ch.kind]?.update?.(run, dt);
    }
    if (!run) return;
    if (ch.limit && run.logic && run.logic.time > ch.limit) { fail('time'); return; }
    const m = run.logic ? hoops[run.logic.next] : null;
    if (m?.visible) m.scale.setScalar(m.userData.base * (1 + 0.05 * Math.sin(t * 6)));
  }

  return {
    pillars,
    get active() { return !!run; },
    get running() { return run?.phase === 'running'; },
    get current() { return run?.ch ?? null; },
    get debug() { return run ? { id: run.ch.id, phase: run.phase, next: run.logic?.next ?? 0, time: run.logic?.time ?? run.t } : null; },
    update,
    // Dev hook and scripted runs: starts without walking into the pillar or checking canStart.
    start(id) { const ch = CHALLENGES.find((c) => c.id === id); if (ch && !run) start(ch); return !!ch; },
    quit() { fail('quit'); },
    // flow.respawn asks this after a knockout or a "Restart from checkpoint".
    takeRespawn() {
      if (run) { const ch = run.ch; end(); return { ...ch.start }; }
      const r = respawnAt;
      respawnAt = null;
      return r;
    },
    // The objective marker points at the next hoop during a run (waypoint adds 1.5 m).
    nextMarker() {
      if (!run?.logic) return null;
      const p = pointsOf(run.ch)[run.logic.next];
      return p ? { x: p.x, y: p.y - 1.5, z: p.z } : null;
    },
    registerKind(kind, hooks) { kinds[kind] = hooks; },
    finish,
    fail,
  };
}
```

- [ ] **Step 2: Add the runner to `src/game/sideContent.js`**
  - Imports:
    ```js
    import { CHALLENGES, pillarPos } from './challenges.js';
    import { createChallengeRunner } from './challengeRunner.js';
    import { CRIME_SPOTS, isCrimeId } from './crimes.js';
    ```
  - Destructure more deps: `const { scene, hero, follow, combat, encounters, events, flow, hudRoot, prompts, progress, storage } = deps;`
  - After `const stats = ...`:
    ```js
    const stepType = () => flow.objectives.step?.type ?? null;
    const offLimits = () => ['boss', 'cutscene'].includes(stepType());
    const challenges = createChallengeRunner({
      scene, hero, follow, events, ui, progress, save,
      hidden: offLimits,
      // Not in a fight or cutscene, including mid-story. The arena also needs the encounter
      // system free (a waiting crime squad is fine: the crime is called off at the start).
      canStart: (ch) => flow.mode === 'play' && !hero.dead && !offLimits() && !combat.active && !encounters.active
        && (ch.kind !== 'arena' || !encounters.id || isCrimeId(encounters.id)),
    });
    const MARKER_RANGE = 60;
    const tmp = new THREE.Vector3();
    let pillarHint = false;
    // Bat markers over pillars within 60 m (the spec's "HUD shows them when you're within 60 m").
    function markers(toScreen) {
      for (const p of challenges.pillars) {
        const far = Math.hypot(hero.pos.x - p.at.x, hero.pos.z - p.at.z) > MARKER_RANGE;
        if (challenges.active || far || !p.mesh.visible) { ui.marker(p.ch.id, 0, 0, false); continue; }
        const s = toScreen(tmp.set(p.at.x, p.at.y + 3.6, p.at.z));
        ui.marker(p.ch.id, s.x, s.y, !s.behind, progress.challenges[p.ch.id]?.medal ?? null);
        if (!s.behind && !pillarHint) { pillarHint = true; prompts.show(['challenges']); }
      }
    }
    ```
  - Change the signature to `update(dt, real, view)` (game.js already passes `{ toScreen }`), and before `if (dirty)` add `challenges.update(dt); markers(view.toScreen);`
  - Replace `flowHooks` and add to the returned object:
    ```js
    challenges,
    data: { CHALLENGES, CRIME_SPOTS, pillarPos },
    flowHooks: {
      holdStory: () => challenges.active,
      marker: () => (challenges.active ? challenges.nextMarker() : null),
      onRespawn: () => challenges.takeRespawn(),
    },
    pauseInfo: () => ({ challenge: challenges.current?.name ?? null, crimesStopped: progress.crimes.stopped, percent: tracker.score(progress).percent }),
    ```

- [ ] **Step 3: Pause menu with optional buttons.** In `src/ui/menus.js`, replace `pause`:

```js
  // ---------- pause ----------
  // opts: { onResume, onRestart, onTitle, info?: { challenge, crimesStopped, percent },
  //         onQuitChallenge?, onChallenges?, onProgress?, onPhoto? }
  function pause(opts) {
    const { onResume, onRestart, onTitle, info = {}, onQuitChallenge, onChallenges, onProgress, onPhoto } = opts;
    const again = () => pause(opts);
    const node = el('div', 'menu pause-menu');
    node.appendChild(el('h2', '', 'Paused'));
    const list = el('div', 'mlist');
    list.appendChild(button('Resume', onResume, 'primary'));
    if (info.challenge && onQuitChallenge) list.appendChild(button('Quit challenge', onQuitChallenge));
    if (onChallenges) list.appendChild(button('Challenges', onChallenges));
    if (onProgress) list.appendChild(button(info.percent != null ? `Progress, ${info.percent}%` : 'Progress', onProgress));
    if (onPhoto) list.appendChild(button('Photo mode', onPhoto));
    list.appendChild(button('Controls', () => help(again)));
    list.appendChild(button('Settings', () => openSettings(again)));
    list.appendChild(button('Restart from checkpoint', onRestart));
    list.appendChild(button('Quit to title', onTitle));
    node.appendChild(list);
    if (info.crimesStopped != null) node.appendChild(el('p', 'note', `Crimes stopped: ${info.crimesStopped}`));
    show(node);
  }
```

- [ ] **Step 4: Pause options in `src/game/game.js`.** Replace the `menus.pause({...})` call inside `pause()` with `menus.pause(pauseOptions());` and add:

```js
  // Built fresh on every pause so the info line and the challenge button are current.
  function pauseOptions() {
    const side = game.side;
    const opts = {
      onResume: resume,
      onRestart: () => { resume(); game.flow.respawn(); },
      onTitle: () => { location.search = ''; },
      info: side.pauseInfo(),
      onQuitChallenge: () => { side.challenges.quit(); resume(); },
    };
    return opts;
  }
```

- [ ] **Step 5: Prompt.** In `src/ui/prompts.js`, add to `ENTRIES`:

```js
  ['challenges', () => `Glowing bat pillars start challenges: glide rings, a rooftop run and an arena fight. Walk into one to begin.`],
```

- [ ] **Step 6: Styles for pause notes** need nothing new (`.note` exists). Run the unit tests:

Run: `npx vitest run`
Expected: PASS (the prompts duplicate-id test covers the new entry).

- [ ] **Step 7: Scripted check of rings, parkour gating and quit** (frozen build):

```bash
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-t11" '[
 {"wait":1200},
 {"eval":"window.__game.teleport({x:163,y:30,z:100})"},{"wait":600},
 {"eval":"window.__game.hero.teleport({x:163,y:30,z:102.2}, Math.PI)"},{"wait":300},
 {"shot":"pillar"},
 {"eval":"window.__game.side.challenges.debug"},{"wait":900},{"shot":"countdown"},{"wait":1800},
 {"eval":"window.__game.side.challenges.debug"},
 {"press":"Escape"},{"wait":300},{"shot":"pause-quit"},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find(b=>b.textContent===\"Quit challenge\").click()"},{"wait":400},
 {"eval":"({active: window.__game.side.challenges.active, d: Math.hypot(window.__game.hero.pos.x-163, window.__game.hero.pos.z-100)})"},
 {"eval":"window.__game.side.challenges.start(\"gothamParkour\")"},{"wait":2600},
 {"eval":"window.__game.teleport({x:128,y:22,z:48})"},{"wait":400},{"shot":"parkour-needs"},
 {"eval":"window.__game.side.challenges.debug"}
]'
```
Expected: the first `debug` after walking in shows `phase: "countdown"` for `neonSlalom` (the hero was put 2.2 m from the pillar, inside the start radius); the second shows `phase: "running"`; after the quit `active: false` and `d < 1`; the parkour `debug` stays at `next: 0` with the "Use a ladder" hint on the `parkour-needs` shot; `no console errors`. Look at `pillar.png` and `countdown.png` and confirm the bat pillar and the lettered 3-2-1 panel.

- [ ] **Step 8: Commit**

```bash
git add src/game/challengeRunner.js src/game/sideContent.js src/game/game.js src/ui/menus.js src/ui/prompts.js
git commit -m "Challenges: bat pillars, 3-2-1 countdown, ring courses, parkour checkpoints, quit"
```

---

### Task 12: Combat arena challenge

**Files:**
- Create: `src/game/arenaChallenge.js`
- Modify: `src/game/sideContent.js`

**Interfaces:**
- Consumes: `ARENA_ID`, `ARENA_FIGHT`, `createArenaScore` (Task 4); `runner.registerKind`, `runner.finish` (Task 11); `encounters.begin(id, def)` (Task 8); combat events `impact`, `takedown`, `diveImpact`, `heroHurt`, `wave`, `fightDone`.
- Produces: the `arena` kind for the runner.

- [ ] **Step 1: Write `src/game/arenaChallenge.js`**

```js
// Joker's Birthday Bash: three waves on the Monarch roof through the encounter system, scored
// by createArenaScore (hits times the multiplier, a bonus per new move type in a combo,
// finishers and counters; getting hit resets the multiplier).
import { ARENA_ID, ARENA_FIGHT, createArenaScore } from './challenges.js';

export function attachArena(runner, { events, encounters, ui }) {
  let score = null;
  let wave = 0;
  const live = () => !!score && runner.running && runner.current?.kind === 'arena';
  const show = () => ui.timer(Math.round(score.score).toLocaleString('en-US'), `x${score.multiplier} · Wave ${wave + 1} of ${ARENA_FIGHT.waves.length}`);

  runner.registerKind('arena', {
    ownsFight: (id) => id === ARENA_ID,
    begin() {
      score = createArenaScore();
      wave = 0;
      encounters.begin(ARENA_ID, ARENA_FIGHT);
      encounters.trigger();
      show();
    },
    update(run, dt) { score.tick(dt); show(); },
    end() {
      if (encounters.id === ARENA_ID) encounters.end();
      score = null;
    },
  });

  events.on('impact', ({ move, outcome }) => { if (live() && outcome !== 'parried' && outcome !== 'immune') score.hit(move); });
  events.on('takedown', () => { if (live()) score.hit('takedown'); });
  events.on('diveImpact', ({ count }) => { if (live()) for (let i = 0; i < count; i++) score.hit('diveBomb'); });
  events.on('heroHurt', ({ blocking }) => { if (live() && !blocking) score.hurt(); });
  events.on('wave', ({ id, wave: w }) => { if (id === ARENA_ID && live()) { wave = w; ui.countdown(`WAVE ${w + 1}`); } });
  events.on('fightDone', ({ id }) => { if (id === ARENA_ID && live()) runner.finish(Math.round(score.score)); });
}
```

- [ ] **Step 2: Attach it** in `src/game/sideContent.js`: `import { attachArena } from './arenaChallenge.js';` and right after the runner is created: `attachArena(challenges, { events, encounters, ui });`

- [ ] **Step 3: Scripted check** (frozen build):

```bash
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-t12" '[
 {"wait":1200},
 {"eval":"window.__game.side.challenges.start(\"birthdayBash\")"},{"wait":3000},{"shot":"arena-wave1"},
 {"click":0},{"wait":300},{"press":"KeyE"},{"wait":400},{"click":0},{"wait":400},{"press":"KeyG"},{"wait":600},
 {"eval":"document.querySelector(\".ch-time\").textContent"},
 {"eval":"(async () => { const g = window.__game; for (let i = 0; i < 40 && g.side.challenges.active; i++) { g.winFight(); await new Promise((r) => setTimeout(r, 700)); } return g.progress.challenges.birthdayBash; })()"},
 {"shot":"arena-result"}
]'
```
Expected: the score text is a number above 0 after the strikes; the last eval prints `{ best: <score>, medal: <null or a medal> }`; `arena-wave1.png` shows goons on the Monarch roof; `no console errors`. (`winFight` KOs through `applyHit`, which emits no `impact`, so the saved score is only the hand-thrown hits: that is expected here.)

- [ ] **Step 4: Commit**

```bash
git add src/game/arenaChallenge.js src/game/sideContent.js
git commit -m "Joker's Birthday Bash: three-wave arena with variety scoring"
```

---

### Task 13: Street crimes at runtime

**Files:**
- Create: `src/game/crimeDirector.js`
- Modify: `src/game/sideContent.js`

**Interfaces:**
- Consumes: `createCrimeScheduler`, `crimeFight`, `crimeTitle`, `crimeBlocked`, `DISTRICT_LABEL` (Task 5); `createVan`, `createLootBags` (Task 9); `createGoon(..., { type: 'civilian' })`; `readyObjects`; `encounters`; `SITES`.
- Produces: `createCrimeDirector` (Shared interfaces); events `crimeSpawn`, `crimeStopped`, `crimeEnd`.

- [ ] **Step 1: Write `src/game/crimeDirector.js`**

```js
// Street crimes at runtime: spawns the squad (through the encounter system) and the scene props,
// calls it in over the police radio, points the objective marker at it, expires it after 3
// minutes and counts the ones you stop.
import { SITES } from '../world/mapData.js';
import { createCrimeScheduler, crimeFight, crimeTitle, DISTRICT_LABEL } from './crimes.js';
import { createVan, createLootBags } from '../world/sideProps.js';
import { createGoon } from '../actors/characters.js';
import { readyObjects } from '../render/prewarm.js';

const RADIO = 'POLICE RADIO';

export function createCrimeDirector({ scene, assets, rng, events, encounters, ui, progress, save, collision, blocked, avoid = () => null }) {
  const scheduler = createCrimeScheduler({ rng });
  // Props and the civilian are built once, hidden, and reused, so begin()'s warm-up draw covers them.
  const van = createVan();
  const loot = createLootBags();
  const civilian = createGoon(assets, { type: 'civilian', rng });
  readyObjects(civilian.root);
  for (const o of [van, loot, civilian.root]) { o.visible = false; scene.add(o); }
  let civilianT = 0;

  const groundAt = (s) => {
    const y = collision.groundBelow(s.x, s.y + 3, s.z, 0.3);
    return y > -Infinity ? y : s.y;
  };

  function place(c) {
    const s = c.spot, y = groundAt(s);
    encounters.begin(c.fightId, crimeFight(c.kind, { ...s, y }, rng));
    if (c.kind === 'van') {
      van.position.set(s.x + Math.cos(s.yaw) * 3, y, s.z - Math.sin(s.yaw) * 3);
      van.rotation.y = s.yaw;
      van.visible = true;
    } else if (c.kind === 'robbery') {
      loot.position.set(s.x, y, s.z);
      loot.visible = true;
    } else {
      civilian.root.position.set(s.x, y, s.z);
      civilian.root.visible = true;
      civilian.animator.play('Crouch_Idle_Loop', { fade: 0 });
    }
    ui.radio(RADIO, crimeTitle(c.kind, s.district), 6500);
    events.emit('crimeSpawn', { id: c.id, kind: c.kind, district: s.district });
  }

  function clearProps(civilianDelay = 0) {
    van.visible = false;
    loot.visible = false;
    if (civilianDelay > 0) civilianT = civilianDelay;
    else civilian.root.visible = false;
  }

  function drop(outcome, caption) {
    const c = scheduler.active;
    if (!c) return;
    if (encounters.id === c.fightId) encounters.end();
    clearProps();
    scheduler.resolve();
    if (caption) ui.radio(RADIO, caption, 4500);
    events.emit('crimeEnd', { id: c.id, outcome });
  }

  events.on('fightStart', ({ id }) => { if (scheduler.active?.fightId === id) scheduler.engage(); });
  events.on('fightDone', ({ id }) => {
    const c = scheduler.active;
    if (!c || c.fightId !== id) return;
    scheduler.resolve();
    progress.crimes.stopped += 1;
    save();
    if (c.kind === 'mugging') civilian.animator.play('Yes', { once: true, fade: 0.2 });
    clearProps(c.kind === 'mugging' ? 4 : 0);
    ui.toast('Crime stopped', `${DISTRICT_LABEL[c.spot.district]} is a little safer. Crimes stopped: ${progress.crimes.stopped}.`, 5000);
    events.emit('crimeStopped', { count: progress.crimes.stopped });
    events.emit('crimeEnd', { id: c.id, outcome: 'stopped' });
  });
  // A story fight, the boss or a cutscene calls the crime off, and so does a new objective that
  // lands on top of it (the story path must never run through a waiting squad).
  events.on('step', ({ step }) => {
    const c = scheduler.active;
    if (!c) return;
    const site = step.site ? SITES[step.site] : null;
    const close = site && Math.hypot(site.x - c.spot.x, site.z - c.spot.z) < 60;
    if (['fight', 'boss', 'cutscene'].includes(step.type) || close) drop('cancelled', null);
  });
  events.on('challengeStart', () => drop('cancelled', null));

  return {
    get active() { return scheduler.active; },
    update(dt, heroPos, visited) {
      const r = scheduler.update(dt, { blocked: blocked(), visited, heroPos, avoid: avoid() });
      if (r?.type === 'spawn') place(r.crime);
      else if (r?.type === 'expire') {
        if (encounters.id === r.crime.fightId) encounters.end();
        clearProps();
        ui.radio(RADIO, 'Too late. The goons got away.', 4500);
        events.emit('crimeEnd', { id: r.crime.id, outcome: 'expired' });
      }
      if (civilian.root.visible) {
        civilian.animator.update(dt);
        if (civilianT > 0 && (civilianT -= dt) <= 0) civilian.root.visible = false;
      }
    },
    marker() { const c = scheduler.active; return c && !c.engaged ? c.spot : null; },
    holdStory() { return !!scheduler.active?.engaged; },
    onRespawn() { if (scheduler.active?.engaged) drop('failed', 'The goons got away while you were down.'); },
    force(opts) { scheduler.force(opts); },
  };
}
```

- [ ] **Step 2: Add crimes to `src/game/sideContent.js`**
  - Imports: `import { createCrimeDirector } from './crimeDirector.js';` and extend the crimes import to `import { CRIME_SPOTS, isCrimeId, crimeBlocked } from './crimes.js';`
  - Destructure `assets, rng, collision` from `deps`.
  - After `attachArena(...)`:
    ```js
    const crimes = createCrimeDirector({
      scene, assets, rng, events, encounters, ui, progress, save, collision,
      blocked: () => crimeBlocked({ mode: flow.mode, stepType: stepType(), challenge: challenges.active, fightId: encounters.id }),
      avoid: () => flow.target,
    });
    ```
  - In `update`: after `challenges.update(dt);` add `crimes.update(dt, hero.pos, progress.districts);`
  - Replace `flowHooks` and add `crimes` to the returned object:
    ```js
    crimes,
    flowHooks: {
      holdStory: () => challenges.active || crimes.holdStory(),
      marker: () => (challenges.active ? challenges.nextMarker() : crimes.marker()),
      onRespawn: () => { crimes.onRespawn(); return challenges.takeRespawn(); },
    },
    ```

- [ ] **Step 3: Unit tests stay green**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted check** (frozen build) with all three kinds:

```bash
for KIND in robbery mugging van; do
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-t13-$KIND" "[
 {\"wait\":1200},
 {\"eval\":\"window.__game.side.crimes.force({ kind: '$KIND', spotId: 'neonNorth' })\"},{\"wait\":500},
 {\"eval\":\"document.querySelector('.radio.show .radio-text')?.textContent\"},{\"shot\":\"radio\"},
 {\"eval\":\"window.__game.teleport({ x: 150, y: 0, z: -6 })\"},{\"wait\":1500},{\"shot\":\"squad\"},
 {\"eval\":\"(async () => { const g = window.__game; for (let i = 0; i < 30 && g.side.crimes.active; i++) { g.winFight(); await new Promise((r) => setTimeout(r, 600)); } return g.progress.crimes.stopped; })()\"},
 {\"wait\":600},{\"shot\":\"stopped\"}
]"
done
```
Expected, for each kind: the radio text (`Robbery on Neon Row`, `Civilian cornered on Neon Row`, `Van break-in on Neon Row`), a squad of 3 to 5 goons plus the loot, the cowering civilian or the van in `squad.png`, the final eval prints `1`, and `no console errors`.

- [ ] **Step 5: Check expiry and blocking** in the browser console of the preview (or with one more dev-play eval):

```js
const g = window.__game; g.side.crimes.force({ kind: 'van', spotId: 'neonDiner' });
// wait one frame, then fast-forward the crime clock:
setTimeout(() => { g.side.crimes.active.age = 179.9; }, 200);
// within a second: radio says "Too late. The goons got away." and g.enemies is empty
```
Then `window.__game.jump('n1')` while a crime is up: the crime must be called off (no crime goons among `__game.enemies`, only the Gazette fight's).

- [ ] **Step 6: Commit**

```bash
git add src/game/crimeDirector.js src/game/sideContent.js
git commit -m "Street crimes: radio call-outs, squads, props, expiry and the stopped counter"
```

---

### Task 14: Ink filters and photo mode

**Files:**
- Modify: `src/render/inkPipeline.js`
- Create: `src/ui/photoFrame.js`, `src/ui/photoMode.js`
- Modify: `src/game/game.js`, `src/ui/style.css`, `src/ui/prompts.js`, `src/ui/menus.js` (help and pad map)

**Interfaces:**
- Consumes: everything in `photoMath.js` (Task 6); `input.padButtonHeld`, `input.stick`, the `photo` action (Task 8); `side.photoTaken()` (Task 10).
- Produces: `ink.setFilter(name)`, `createPhotoMode`, `drawPhotoFrame`, events `photoOpen`, `photoClose`, `photoSaved`; `api.photo`.

- [ ] **Step 1: Filters in the ink shader.** In `src/render/inkPipeline.js`:
  - Uniform declarations: add `uFilter` to the `uniform float uWobble, ...` line and change `uniform vec3 uInk, uPaper, uDetectiveTint;` to `uniform vec3 uInk, uPaper, uDetectiveTint, uAccent;`
  - Insert right after the impact-frame block (`if (uImpact > 0.0) { ... }`) and before `// Paper:`:

```glsl
  // Photo-mode filters (0 = the normal ink look). Uniform-driven, so no new shader program.
  if (uFilter > 0.5) {
    float Lf = pow(max(luma(col), 0.0), 1.0 / 2.2);
    if (uFilter < 1.5) {
      // Noir: black, white and one accent colour (the balloon red).
      float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
      float red = smoothstep(0.35, 0.6, (mx - mn) / max(mx, 1e-3)) * step(max(col.g, col.b), col.r * 0.7);
      vec3 bw = mix(uInk, uPaper, smoothstep(0.18, 0.42, Lf));
      col = mix(mix(bw, uAccent * (0.35 + 0.9 * Lf), red), uInk, edge);
    } else if (uFilter < 2.5) {
      // Pop: loud colour and big dots.
      vec3 gl = vec3(luma(col));
      col = clamp(gl + (col - gl) * 1.9, 0.0, 1.0) * 1.12;
      vec2 pc = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / (uHalftone * 2.2);
      float pr = 0.34 * smoothstep(0.15, 0.7, Lf);
      float pd = 1.0 - smoothstep(pr - 0.05, pr + 0.05, length(fract(pc) - 0.5));
      col = mix(col, col * 0.45, pd * 0.8);
    } else {
      // Sepia.
      vec3 s = vec3(dot(col, vec3(0.393, 0.769, 0.189)), dot(col, vec3(0.349, 0.686, 0.168)), dot(col, vec3(0.272, 0.534, 0.131)));
      col = mix(col, s, 0.92);
    }
  }
```
  - In `uniforms`, add `uFilter: { value: 0 }, uAccent: { value: new THREE.Color(PALETTE.balloon) },`
  - Add the setter and return it:

```js
  const FILTER_INDEX = { ink: 0, noir: 1, pop: 2, sepia: 3 };
  function setFilter(name) { uniforms.uFilter.value = FILTER_INDEX[name] ?? 0; }
```
```js
  return { uniforms, setSize, render, setComic, setPalette, impact, setFilter, compileAsync, get gpuMs() { return gpuMs; } };
```

- [ ] **Step 2: Write `src/ui/photoFrame.js`**

```js
// Draws a photo's frame, cover masthead and caption onto a 2D canvas. The same function draws
// the on-screen preview and the saved PNG, so what you frame is what you save.
import { frameLayout } from '../game/photoMath.js';
import MANSI from '../mansi.config.js';

const INK = '#0b0b12', PAPER = '#efe6cf', SIGNAL = '#f2d24b', RED = '#c8323c';

function wrap(g, text, max) {
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && g.measureText(t).width > max) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function fitFont(g, text, family, size, maxW) {
  let s = size;
  g.font = `${s}px ${family}`;
  while (s > 8 && g.measureText(text).width > maxW) { s *= 0.92; g.font = `${s}px ${family}`; }
  return s;
}

export function drawPhotoFrame(g, w, h, { frame = 'none', caption = '', issue = '' } = {}) {
  const L = frameLayout(frame, w, h);
  g.save();
  g.lineJoin = 'round';
  if (L.inset > 0) {
    g.fillStyle = PAPER;
    g.fillRect(0, 0, w, L.inset);
    g.fillRect(0, h - L.inset, w, L.inset);
    g.fillRect(0, 0, L.inset, h);
    g.fillRect(w - L.inset, 0, L.inset, h);
    g.lineWidth = L.border;
    g.strokeStyle = INK;
    g.strokeRect(L.inset + L.border / 2, L.inset + L.border / 2, w - 2 * L.inset - L.border, h - 2 * L.inset - L.border);
  }
  if (L.masthead) {
    const m = L.masthead, s = L.issue;
    g.fillStyle = RED;
    g.fillRect(m.x, m.y, m.w, m.h);
    g.lineWidth = L.border;
    g.strokeStyle = INK;
    g.strokeRect(m.x, m.y, m.w, m.h);
    const title = `GOTHAM FOR ${MANSI.name.toUpperCase()}`;
    const size = fitFont(g, title, 'Bangers, Impact, sans-serif', m.h * 0.66, s.x - m.x - L.u * 6);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.lineWidth = size * 0.14;
    g.strokeText(title, m.x + L.u * 3, m.y + m.h * 0.54);
    g.fillStyle = SIGNAL;
    g.fillText(title, m.x + L.u * 3, m.y + m.h * 0.54);
    g.fillStyle = PAPER;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.lineWidth = L.border;
    g.strokeRect(s.x, s.y, s.w, s.h);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.font = `700 ${s.h * 0.26}px "Barlow Condensed", sans-serif`;
    g.fillText('ISSUE', s.x + s.w / 2, s.y + s.h * 0.3);
    g.font = `${s.h * 0.42}px Bangers, Impact, sans-serif`;
    g.fillText(issue, s.x + s.w / 2, s.y + s.h * 0.68);
  }
  const text = caption.trim();
  if (text) {
    const c = L.caption, pad = L.u * 2;
    g.font = `${c.font}px "Patrick Hand SC", cursive`;
    const lines = wrap(g, text, c.maxW - pad * 2);
    const lh = c.font * 1.15;
    const bw = Math.min(c.maxW, Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2);
    const bh = lines.length * lh + L.u * 2.4;
    g.translate(c.x, c.y + c.h - bh);
    g.rotate(-0.02);
    g.fillStyle = INK;
    g.fillRect(L.u * 0.8, L.u * 0.8, bw, bh);
    g.fillStyle = SIGNAL;
    g.fillRect(0, 0, bw, bh);
    g.lineWidth = Math.max(2, L.u * 0.5);
    g.strokeStyle = INK;
    g.strokeRect(0, 0, bw, bh);
    g.fillStyle = INK;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    lines.forEach((l, i) => g.fillText(l, pad, L.u * 1.2 + i * lh));
  }
  g.restore();
}
```

- [ ] **Step 3: Write `src/ui/photoMode.js`**

```js
// Photo mode: frozen time, a free or orbiting camera within 20 m of Batman, comic filters,
// frames, an editable caption, Batman hidden or shown, and a PNG saved with a browser download.
// Everything stays in the browser. Keys inside photo mode are fixed (only the key that opens it
// is rebindable), listed on the panel; the pad uses its raw buttons.
import * as THREE from 'three';
import {
  FILTERS, FRAMES, FILTER_LABEL, FRAME_LABEL, DEFAULT_CAPTION, CAPTION_PRESETS, cycle, createPhotoCam, setPhotoMode, stepPhotoCam,
  photoView, sanitizeCaption, photoFileName,
} from '../game/photoMath.js';
import { drawPhotoFrame } from './photoFrame.js';

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, L3: 10, R3: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export function createPhotoMode({ root, camera, renderer, ink, scene, hero, input, sound = () => {}, getTime, getIssue, onOpen = () => {}, onClose = () => {}, onSaved = () => {} }) {
  const overlay = document.createElement('canvas');
  overlay.className = 'photo-overlay';
  const flash = document.createElement('div');
  flash.className = 'photo-flash';
  const panel = document.createElement('div');
  panel.className = 'menu photo-panel';
  panel.innerHTML = `
    <h2>Photo mode</h2>
    <div class="ph-row"><span>Filter</span><button class="mbtn small ph-filter"></button></div>
    <div class="ph-row"><span>Frame</span><button class="mbtn small ph-frame"></button></div>
    <div class="ph-row"><span>Camera</span><button class="mbtn small ph-mode"></button></div>
    <div class="ph-row"><span>Batman</span><button class="mbtn small ph-bat"></button></div>
    <label class="ph-row ph-cap"><span>Caption</span><input type="text" maxlength="48" spellcheck="false"></label>
    <div class="ph-actions"><button class="mbtn primary ph-save">Save photo</button><button class="mbtn small ph-exit">Exit</button></div>
    <p class="note ph-keys">WASD move · Arrows or drag to look · R and F up and down · Q and E roll · Z and X or the wheel zoom · 1 filter · 2 frame · 3 Batman · G orbit · T caption · H hide panel · Enter save · Esc exit</p>
    <p class="note ph-keys">Pad: sticks move and look · LT and RT down and up · LB and RB roll · D-pad up and down zoom · D-pad left and right caption · X filter · Y frame · View Batman · L3 orbit · R3 hide panel · A save · B exit</p>`;
  const q = (s) => panel.querySelector(s);
  const capInput = q('input');

  const held = new Set();
  let active = false;
  let cam = null;
  let anchor = { x: 0, y: 0, z: 0 };
  let filter = 'ink', frame = 'none', caption = DEFAULT_CAPTION, hideBat = false, panelHidden = false;
  let drag = null, lookX = 0, lookY = 0, wheel = 0;
  capInput.value = caption;

  function drawOverlay() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    overlay.width = Math.round(innerWidth * dpr);
    overlay.height = Math.round(innerHeight * dpr);
    const g = overlay.getContext('2d');
    g.clearRect(0, 0, overlay.width, overlay.height);
    drawPhotoFrame(g, overlay.width, overlay.height, { frame, caption, issue: getIssue() });
  }
  function refresh() {
    q('.ph-filter').textContent = FILTER_LABEL[filter];
    q('.ph-frame').textContent = FRAME_LABEL[frame];
    q('.ph-mode').textContent = cam?.mode === 'orbit' ? 'Orbit' : 'Free';
    q('.ph-bat').textContent = hideBat ? 'Hidden' : 'Shown';
    panel.classList.toggle('hidden', panelHidden);
    ink.setFilter(filter);
    hero.bat.root.visible = !hideBat;
    hero.cape.mesh.visible = !hideBat;
    drawOverlay();
  }
  const act = {
    filter: (d = 1) => { filter = cycle(FILTERS, filter, d); sound('uiMove'); refresh(); },
    frame: (d = 1) => { frame = cycle(FRAMES, frame, d); sound('uiMove'); refresh(); },
    bat: () => { hideBat = !hideBat; sound('uiMove'); refresh(); },
    mode: () => { cam = setPhotoMode(cam, cam.mode === 'orbit' ? 'free' : 'orbit', anchor); sound('uiMove'); refresh(); },
    panel: () => { panelHidden = !panelHidden; refresh(); },
    caption: (d) => { caption = cycle(CAPTION_PRESETS, caption, d); capInput.value = caption; refresh(); },
  };
  q('.ph-filter').addEventListener('click', () => act.filter());
  q('.ph-frame').addEventListener('click', () => act.frame());
  q('.ph-mode').addEventListener('click', () => act.mode());
  q('.ph-bat').addEventListener('click', () => act.bat());
  q('.ph-save').addEventListener('click', () => save());
  q('.ph-exit').addEventListener('click', () => close());
  capInput.addEventListener('input', () => { caption = sanitizeCaption(capInput.value); drawOverlay(); });
  capInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); capInput.blur(); }
  });

  const onKey = (e) => {
    if (e.target === capInput) return;
    if (e.type === 'keyup') { held.delete(e.code); return; }
    if (e.repeat) return;
    held.add(e.code);
    switch (e.code) {
      case 'Digit1': act.filter(); break;
      case 'Digit2': act.frame(); break;
      case 'Digit3': act.bat(); break;
      case 'KeyG': act.mode(); break;
      case 'KeyH': act.panel(); break;
      case 'KeyT': e.preventDefault(); capInput.focus(); capInput.select(); break;
      case 'Enter': case 'Space': e.preventDefault(); save(); break;
      default: return;
    }
  };
  const onDown = (e) => { if (!e.target.closest?.('.photo-panel')) drag = { x: e.clientX, y: e.clientY }; };
  const onMove = (e) => {
    if (!drag) return;
    lookX += e.clientX - drag.x;
    lookY += e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
  };
  const onUp = () => { drag = null; };
  const onWheel = (e) => { if (!e.target.closest?.('.photo-panel')) { wheel += Math.sign(e.deltaY) * 3; e.preventDefault(); } };
  const listeners = [['keydown', onKey], ['keyup', onKey], ['mousedown', onDown], ['mousemove', onMove], ['mouseup', onUp]];

  function apply() {
    const v = photoView(cam);
    camera.position.set(v.position.x, v.position.y, v.position.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(v.target.x, v.target.y, v.target.z);
    camera.rotateZ(v.roll);
    if (Math.abs(camera.fov - v.fov) > 0.01) { camera.fov = v.fov; camera.updateProjectionMatrix(); }
  }

  function open() {
    if (active) return;
    active = true;
    anchor = { x: hero.pos.x, y: hero.pos.y, z: hero.pos.z };
    const dir = camera.getWorldDirection(new THREE.Vector3());
    cam = createPhotoCam({ position: camera.position, target: camera.position.clone().add(dir), fov: camera.fov });
    held.clear();
    root.append(overlay, flash, panel);
    for (const [ev, fn] of listeners) window.addEventListener(ev, fn);
    window.addEventListener('wheel', onWheel, { passive: false });
    onOpen();
    refresh();
  }

  function close() {
    if (!active) return;
    active = false;
    capInput.blur();
    for (const [ev, fn] of listeners) window.removeEventListener(ev, fn);
    window.removeEventListener('wheel', onWheel);
    ink.setFilter('ink');
    hero.bat.root.visible = true;
    hero.cape.mesh.visible = true;
    overlay.remove();
    flash.remove();
    panel.remove();
    onClose();
  }

  // Renders a fresh frame and reads it back in the same task (no preserveDrawingBuffer needed),
  // then adds the frame and caption and downloads a PNG.
  function save() {
    if (!active) return;
    const w = renderer.domElement.width, h = renderer.domElement.height;
    ink.render(scene, camera, getTime());
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const g = out.getContext('2d');
    g.drawImage(renderer.domElement, 0, 0, w, h);
    drawPhotoFrame(g, w, h, { frame, caption, issue: getIssue() });
    sound('uiSelect');
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = photoFileName(new Date());
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      onSaved();
      drawOverlay();
    }, 'image/png');
  }

  function update(real) {
    if (!active) return;
    const k = (c) => (held.has(c) ? 1 : 0);
    const st = input.stick, ph = (i) => (input.padButtonHeld(i) ? 1 : 0);
    cam = stepPhotoCam(cam, {
      moveX: k('KeyD') - k('KeyA') + st.mx,
      moveY: k('KeyW') - k('KeyS') - st.my,
      up: k('KeyR') - k('KeyF') + ph(PAD.RT) - ph(PAD.LT),
      lookX: lookX + (k('ArrowRight') - k('ArrowLeft')) * 500 * real + st.lx * 700 * real,
      lookY: lookY + (k('ArrowDown') - k('ArrowUp')) * 400 * real + st.ly * 500 * real,
      roll: k('KeyE') - k('KeyQ') + ph(PAD.RB) - ph(PAD.LB),
      zoom: k('KeyX') - k('KeyZ') + ph(PAD.DOWN) - ph(PAD.UP),
      fovDelta: wheel,
    }, real, anchor);
    lookX = 0; lookY = 0; wheel = 0;
    apply();
    if (input.padButton(PAD.X)) act.filter();
    if (input.padButton(PAD.Y)) act.frame();
    if (input.padButton(PAD.VIEW)) act.bat();
    if (input.padButton(PAD.L3)) act.mode();
    if (input.padButton(PAD.R3)) act.panel();
    if (input.padButton(PAD.LEFT)) act.caption(-1);
    if (input.padButton(PAD.RIGHT)) act.caption(1);
    if (input.padButton(PAD.A)) save();
    if (input.padButton(PAD.B)) close();
  }

  return { get active() { return active; }, open, close, update, save };
}
```

- [ ] **Step 4: Wire photo mode into `src/game/game.js`**
  - Import: `import { createPhotoMode } from '../ui/photoMode.js';`
  - In `buildRun`, after `side` is created:

```js
    const photo = createPhotoMode({
      root: document.body, camera, renderer, ink, scene, hero, input,
      sound: (n) => audio.play(n),
      getTime: () => state.t,
      getIssue: () => `No. ${progress.stats.photos + 1}`,
      onOpen: () => {
        state.paused = true;
        state.pauseMenu = false;
        input.setEnabled(false);
        document.exitPointerLock?.();
        document.body.classList.add('photo-on');
        events.emit('photoOpen');
      },
      onClose: () => { document.body.classList.remove('photo-on'); events.emit('photoClose'); resume(); },
      onSaved: () => { side.photoTaken(); events.emit('photoSaved'); },
    });
```
  - In `update(real)`, first line inside `if (playing && !state.paused) {`:
    ```js
        if (input.pressed('photo') && flow.mode === 'play' && !hero.dead) { photo.open(); return; }
    ```
    (a `return` there skips one frame of gameplay; the next frame is paused.)
  - Add `photo` to `api`.
  - Pause options (`pauseOptions()` from Task 11): add `onPhoto: () => { menus.hide(); game.photo.open(); },`
  - `padControls()`: first line `if (game?.photo.active) return;`
  - `keydown` listener, after the typing guard:
    ```js
    if (game.photo.active) {
      if (settings.bindings.pause.includes(e.code) || settings.bindings.photo.includes(e.code)) { e.preventDefault(); game.photo.close(); }
      return;
    }
    ```
  - Frozen time in `step(now)`:

```js
  function step(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const photoOn = !!game?.photo.active;
    // Photo mode freezes time: rain, lightning, traffic and the ink's boiling line all hold still.
    if (!photoOn) state.t += real;
    input.update(real);
    let focus = camera.position;
    if (state.phase === 'title') {
      /* unchanged */
    } else if (game) {
      if (state.pauseMenu && !['play', 'dead'].includes(game.flow.mode)) resume({ lock: false });
      game.update(real);
      if (photoOn) game.photo.update(real);
      focus = game.hero.pos;
    }
    padControls();
    if (!photoOn) lightning(real);
    world.update(state.t, photoOn ? 0 : real, focus, camera, game?.hero ?? null);
    /* rest unchanged */
```
  - The first-time photo hint: in the `step` listener that shows `['detective', 'balloons']` 30 s after `toDocks`, add `setTimeout(() => prompts.show(['photo']), 120000);` inside the same `if`.

- [ ] **Step 5: Prompt, help and pad map.** In `src/ui/prompts.js` add:

```js
  ['photo', (k) => `Press ${k('photo')} for photo mode. Frame a shot, add a caption and save it as a picture.`],
```
In `src/ui/menus.js`: add `['Photo mode', 'D-pad up']` to `PAD_LAYOUT` (before `['Pause', 'Menu']`), and in `help()` after the "Moving around" lines:

```js
    node.appendChild(el('h3', '', 'Extras'));
    for (const id of ['challenges', 'photo']) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
```

- [ ] **Step 6: Styles.** Append to `src/ui/style.css`:

```css
.photo-overlay { position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 21; }
.photo-flash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 23; }
.photo-flash.on { animation: phflash 0.45s ease-out; }
@keyframes phflash { 0% { opacity: 0.85; } 100% { opacity: 0; } }
.menu.photo-panel { position: fixed; right: 20px; top: 20px; width: 340px; max-height: calc(100vh - 40px); padding: 16px 18px; z-index: 22; transform: rotate(0.6deg); }
.menu.photo-panel.hidden { display: none; }
.photo-panel h2 { margin: 0 0 8px; }
.ph-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 6px 0; font: 20px 'Patrick Hand SC', cursive; }
.ph-row input { width: 180px; font: 18px 'Patrick Hand SC', cursive; padding: 4px 6px; border: 3px solid var(--ink); background: #fffdf5; text-transform: uppercase; }
.ph-actions { display: flex; gap: 10px; margin-top: 10px; }
.ph-keys { font-size: 14px; line-height: 1.25; }
.photo-on .hud, .photo-on .speed-lines, .photo-on .action-panel, .photo-on .fps { display: none !important; }
```

- [ ] **Step 7: Unit tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/render/inkPipeline.js src/ui/photoFrame.js src/ui/photoMode.js src/game/game.js src/ui/style.css src/ui/prompts.js src/ui/menus.js
git commit -m "Photo mode: frozen time, free and orbit camera, comic filters, frames, caption, PNG save"
```

The browser run for photo mode is `scripts/runs/photo.json` in Task 17.

---

### Task 15: Challenges and Progress pages, title percentage, reward comics

**Files:**
- Create: `src/ui/progressMap.js`, `src/game/rewardPages.js`
- Modify: `src/ui/menus.js`, `src/game/sideContent.js`, `src/game/game.js`, `src/ui/style.css`

**Interfaces:**
- Consumes: `tracker` (Task 2), `formatStatsLine` (Task 3), `mapModel` (Task 7), `CHALLENGES`, `formatResult`, `pillarPos` (Task 4), `BALLOONS`, `titleCard`, `stage.shot`, `comic.play`.
- Produces: `menus.challengesPage(data, cbs)`, `menus.progressPage(data, cbs)`, `menus.title({ percent })`, `side.challengesPage()`, `side.progressPage()`, `goldStandardPages(stage)`, `fromKrishnPages(stage)`, `drawProgressMap(canvas, model)`.

- [ ] **Step 1: Write `src/ui/progressMap.js`**

```js
// Inks the Progress page map: paper, hatched harbour, district-tinted blocks, balloon pins
// (filled when found, outlined once their district is visited) and bat medals for challenges.
import { batOutline } from '../config/batShape.js';

const INK = '#0b0b12', PAPER = '#efe6cf', RED = '#c8323c';
const TINT = { gcpd: '#9fb2d6', docks: '#8fb3a8', neon: '#d99ac8', ace: '#a7c47a', clock: '#c9b48a', city: '#d8cfb8' };
const MEDAL = { gold: '#f2d24b', silver: '#c9ccd6', bronze: '#c07a3c' };
const BAT = batOutline();

export function drawProgressMap(canvas, m) {
  const g = canvas.getContext('2d');
  g.save();
  g.scale(canvas.width / m.size, canvas.height / m.size);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, m.size, m.size);
  g.fillStyle = '#b9c7cf';
  g.fillRect(0, m.water, m.size, m.size - m.water);
  g.strokeStyle = 'rgba(11,11,18,0.35)';
  g.lineWidth = 0.6;
  const depth = m.size - m.water;
  for (let x = -depth; x < m.size; x += 6) { g.beginPath(); g.moveTo(x, m.size); g.lineTo(x + depth, m.water); g.stroke(); }
  g.strokeStyle = INK;
  for (const b of m.blocks) {
    g.fillStyle = TINT[b.district] ?? TINT.city;
    g.fillRect(b.u, b.v, b.w, b.h);
    g.lineWidth = b.landmark ? 1.4 : 0.7;
    g.strokeRect(b.u, b.v, b.w, b.h);
  }
  for (const c of m.challenges) {
    g.beginPath();
    BAT.forEach(([x, y], i) => (i ? g.lineTo(c.u + x * 0.12, c.v - y * 0.12) : g.moveTo(c.u + x * 0.12, c.v - y * 0.12)));
    g.closePath();
    g.fillStyle = MEDAL[c.medal] ?? PAPER;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = INK;
    g.stroke();
  }
  for (const p of m.balloons) {
    g.beginPath();
    g.arc(p.u, p.v, 3.2, 0, Math.PI * 2);
    if (p.found) { g.fillStyle = RED; g.fill(); }
    g.lineWidth = 1.3;
    g.strokeStyle = p.found ? INK : RED;
    g.stroke();
  }
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.strokeRect(1.5, 1.5, m.size - 3, m.size - 3);
  g.restore();
}
```

- [ ] **Step 2: Write `src/game/rewardPages.js`**

```js
// The two reward comic pages: gold in every challenge, and 100% on the Progress page.
import MANSI from '../mansi.config.js';
import { titleCard } from '../ui/comicArt.js';

export function goldStandardPages(stage) {
  return [{
    layout: 'duo',
    panels: [
      { img: titleCard(`${MANSI.name.toUpperCase()}'S GOLD STANDARD`, 'Every challenge. Every gold.') },
      {
        img: stage.shot({ cam: [3.2, 42.8, 23], look: [-4, 47, 8], fov: 50, hero: { at: [0.5, 42, 17.5], yaw: -2.7, anim: 'Yes' } }),
        caption: 'Fastest wings in Gotham. Hardest hands, too. Nobody else comes close.', captionPos: 'bottom',
      },
    ],
  }];
}

export function fromKrishnPages(stage) {
  return [
    { layout: 'single', panels: [{ span: 'full', img: titleCard(`FROM ${MANSI.fromName.toUpperCase()}`, 'One hundred percent.') }] },
    {
      layout: 'single',
      panels: [{ span: 'full', img: stage.shot({ cam: [34, 74, 70], look: [-30, 30, -70] }), caption: MANSI.completionMessage, captionPos: 'bottom' }],
    },
  ];
}
```

- [ ] **Step 3: Page data in `src/game/sideContent.js`.** Imports:

```js
import { BALLOONS } from '../config/balloonSpots.js';
import { formatStatsLine } from './playStats.js';
import { mapModel } from './mapModel.js';
import { formatResult } from './challenges.js';   // merge with the existing challenges import
```
Destructure `buildings` from `deps`, and add to the returned object:

```js
    challengesPage: () => ({
      list: CHALLENGES.map((ch) => {
        const e = progress.challenges[ch.id];
        return { id: ch.id, name: ch.name, blurb: ch.blurb, medal: e?.medal ?? null, best: e ? formatResult(ch, e.best) : null, goal: `Gold: ${formatResult(ch, ch.medals.gold)}` };
      }),
      goldStandard: progress.unlocks.includes('goldStandard'),
    }),
    progressPage: () => {
      const s = tracker.score(progress);
      return {
        percent: s.percent,
        parts: s.parts,
        statsLine: formatStatsLine(progress.stats, { crimes: progress.crimes.stopped }),
        fromKrishn: progress.unlocks.includes('fromKrishn'),
        map: mapModel({ buildings, balloons: BALLOONS, challenges: CHALLENGES.map((ch) => ({ id: ch.id, ...pillarPos(ch) })), progress }),
      };
    },
```

- [ ] **Step 4: Pages and title in `src/ui/menus.js`.** Import `import { drawProgressMap } from './progressMap.js';`. Replace `title`:

```js
  // ---------- title ----------
  function title(opts) {
    const { canContinue, percent = null, onContinue, onNew } = opts;
    const again = () => title(opts);
    const node = el('div', 'menu title-menu');
    node.appendChild(el('div', 'logo', `<span class="kicker">A birthday special</span><span class="l1">Gotham needs you,</span><span class="l2">${MANSI.name}</span>`));
    const list = el('div', 'mlist');
    if (canContinue) list.appendChild(button(percent == null ? 'Continue' : `Continue, ${percent}%`, onContinue, 'primary'));
    list.appendChild(button(canContinue ? 'New game' : 'Start', onNew, canContinue ? '' : 'primary'));
    list.appendChild(button('Settings', () => openSettings(again)));
    list.appendChild(button('Controls', () => help(again)));
    list.appendChild(button('Credits', () => credits({ onClose: again })));
    node.appendChild(list);
    node.appendChild(el('div', 'foot', 'Best with a mouse and headphones.'));
    show(node);
  }
```

Add the two pages (text goes in with `textContent`, never `innerHTML`, so a caption or name can't inject markup):

```js
  // ---------- challenges ----------
  function challengesPage(data, { onBack, onRead }) {
    const node = el('div', 'menu challenges-menu');
    node.appendChild(el('h2', '', 'Challenges'));
    const list = el('div', 'cr-list');
    for (const c of data.list) {
      const row = el('div', `cr-row medal-${c.medal ?? 'none'}`, '<span class="cr-medal"></span><span class="cr-title"></span><span class="cr-best"></span><span class="cr-blurb"></span><span class="cr-goal"></span>');
      row.querySelector('.cr-title').textContent = c.name;
      row.querySelector('.cr-best').textContent = c.best ?? 'Not tried yet';
      row.querySelector('.cr-blurb').textContent = c.blurb;
      row.querySelector('.cr-goal').textContent = c.goal;
      list.appendChild(row);
    }
    node.appendChild(list);
    node.appendChild(el('p', 'note', 'Walk into a glowing bat pillar to start. Detective vision shows every pillar through walls.'));
    if (data.goldStandard) node.appendChild(button(`Read: ${MANSI.name}'s Gold Standard`, onRead, 'primary'));
    else node.appendChild(el('p', 'note', `Gold in every challenge unlocks a comic page: ${MANSI.name}'s Gold Standard.`));
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }

  // ---------- progress ----------
  function progressPage(data, { onBack, onRead }) {
    const node = el('div', 'menu progress-menu');
    node.appendChild(el('h2', '', `Progress: ${data.percent}%`));
    const wrap = el('div', 'pg-wrap');
    const map = el('canvas', 'pg-map');
    map.width = 540;
    map.height = 540;
    drawProgressMap(map, data.map);
    const parts = el('div', 'pg-parts');
    for (const p of data.parts) {
      const row = el('div', 'pg-row', '<div class="pg-head"><span class="pg-label"></span><span class="pg-count"></span></div><div class="pg-bar"><i></i></div><div class="pg-detail"></div>');
      row.querySelector('.pg-label').textContent = p.label;
      row.querySelector('.pg-count').textContent = `${p.done}/${p.total}`;
      row.querySelector('.pg-bar i').style.width = `${Math.round(p.fraction * 100)}%`;
      row.querySelector('.pg-detail').textContent = p.detail;
      parts.appendChild(row);
    }
    wrap.append(map, parts);
    node.appendChild(wrap);
    const stats = el('p', 'pg-stats');
    stats.textContent = data.statsLine;
    node.appendChild(stats);
    if (data.fromKrishn) node.appendChild(button(`Read: From ${MANSI.fromName}`, onRead, 'primary'));
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }
```
Add `challengesPage, progressPage` to the returned object.

- [ ] **Step 5: Wire it in `src/game/game.js`**
  - Imports: `import { tracker } from './progressTracker.js';` and `import { goldStandardPages, fromKrishnPages } from './rewardPages.js';`
  - `showTitle()`: pass `percent: tracker.score(progress).percent` to `menus.title`.
  - `pauseOptions()` gains:

```js
      onChallenges: () => menus.challengesPage(side.challengesPage(), { onBack: () => menus.pause(opts), onRead: () => readPage('goldStandard', () => menus.pause(opts)) }),
      onProgress: () => menus.progressPage(side.progressPage(), { onBack: () => menus.pause(opts), onRead: () => readPage('fromKrishn', () => menus.pause(opts)) }),
```
  - Add next to `pauseOptions`:

```js
  // Reward comics open from the pause menu. stage.shot moves the camera for its panels, so the
  // paused view is put back before the comic shows.
  function readPage(kind, back) {
    menus.hide();
    const p = camera.position.clone(), q = camera.quaternion.clone();
    const pages = kind === 'goldStandard' ? goldStandardPages(game.stage) : fromKrishnPages(game.stage);
    camera.position.copy(p);
    camera.quaternion.copy(q);
    game.comic.play(pages).then(back);
  }
```

- [ ] **Step 6: Styles.** Append to `src/ui/style.css`:

```css
.challenges-menu, .progress-menu { width: min(900px, 94vw); }
.cr-list { display: grid; gap: 8px; margin: 10px 0; }
.cr-row { display: grid; grid-template-columns: 36px 1fr auto; column-gap: 12px; align-items: center; padding: 8px 12px; background: #fff8e6; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); }
.cr-medal { grid-row: span 2; width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--ink); background: var(--paper); }
.cr-row.medal-bronze .cr-medal { background: #c07a3c; }
.cr-row.medal-silver .cr-medal { background: #c9ccd6; }
.cr-row.medal-gold .cr-medal { background: var(--signal); }
.cr-title, .cr-best { font: 700 22px 'Barlow Condensed', sans-serif; text-transform: uppercase; }
.cr-best { text-align: right; }
.cr-blurb, .cr-goal { font: 16px 'Patrick Hand SC', cursive; }
.cr-goal { text-align: right; }
.pg-wrap { display: flex; gap: 18px; align-items: flex-start; flex-wrap: wrap; }
.pg-map { width: min(320px, 80vw); height: auto; aspect-ratio: 1; border: 4px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); transform: rotate(-1deg); background: var(--paper); }
.pg-parts { flex: 1; min-width: 260px; display: grid; gap: 8px; }
.pg-head { display: flex; justify-content: space-between; font: 700 20px 'Barlow Condensed', sans-serif; text-transform: uppercase; }
.pg-bar { height: 12px; border: 2px solid var(--ink); background: #fff8e6; }
.pg-bar i { display: block; height: 100%; background: var(--balloon); }
.pg-detail { font: 16px 'Patrick Hand SC', cursive; }
.pg-stats { font: 18px 'Patrick Hand SC', cursive; margin: 14px 0 8px; }
```

- [ ] **Step 7: Scripted check** (frozen build):

```bash
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1" "$TEMP/c3-t15" '[
 {"wait":1200},{"press":"Escape"},{"wait":300},{"shot":"pause"},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find(b=>b.textContent===\"Challenges\").click()"},{"wait":300},{"shot":"challenges"},
 {"eval":"[...document.querySelectorAll(\".menu .mbtn\")].find(b=>b.textContent===\"Back\").click()"},{"wait":200},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find(b=>b.textContent.startsWith(\"Progress\")).click()"},{"wait":300},{"shot":"progress"},
 {"eval":"document.querySelectorAll(\".pg-row\").length"},
 {"eval":"(()=>{const g=window.__game;g.progress.unlocks.push(\"fromKrishn\",\"goldStandard\");return true})()"},
 {"eval":"[...document.querySelectorAll(\".menu .mbtn\")].find(b=>b.textContent===\"Back\").click()"},{"wait":200},
 {"eval":"[...document.querySelectorAll(\".pause-menu .mbtn\")].find(b=>b.textContent.startsWith(\"Progress\")).click()"},{"wait":300},
 {"eval":"[...document.querySelectorAll(\".menu .mbtn\")].find(b=>b.textContent.startsWith(\"Read\")).click()"},{"wait":900},{"shot":"from-krishn"},
 {"press":"Escape"},{"wait":500},{"shot":"back-to-pause"}
]'
```
Expected: 6 progress rows; `progress.png` shows the inked map with the Neon Row balloons as outlines and the five bat medals; `from-krishn.png` shows the title card page; `back-to-pause.png` shows the pause menu again; `no console errors`. Load `http://localhost:5206/` with a saved game and check the title's first button reads `Continue, NN%`.

- [ ] **Step 8: Commit**

```bash
git add src/ui/progressMap.js src/game/rewardPages.js src/ui/menus.js src/game/sideContent.js src/game/game.js src/ui/style.css
git commit -m "Challenges and Progress pages, inked map, reward comics and Continue percentage"
```

---

### Task 16: Course check and threshold tuning

**Files:**
- Create: `scripts/course-check.mjs`, `scripts/challenge-tune.mjs`
- Modify: `src/game/challenges.js` (course coordinates and medal numbers only)

**Interfaces:**
- Consumes: `window.__game.side.data`, `side.challenges` (`start`, `running`, `nextMarker`, `debug`), `world.collision` (`raycast(origin, dir, maxDist) -> { t, box } | null`, `groundBelow(x, y, z, r)`), `climbables`, `world.grapplePoints`; `suggestThresholds` (imported from source by node).
- Produces: validated courses and tuned `medals` / `limit` values.

**The tuning method.** Medal thresholds come from scripted pilots, not guesses:
1. **Glide courses:** an in-page autopilot steers the camera yaw at the next hoop each frame and sets the camera pitch to dive when the hoop is well below the needed glide slope, swoop when above, and fly level otherwise. Three runs per course. The best time is the clean line: gold is 1.08 times it, silver 1.3, bronze 1.6, and the time limit 3 times (all rounded up to 0.5 s, the limit to 5 s). A person who flies as cleanly as the pilot gets gold; a good first attempt gets silver.
2. **Parkour:** a leg-by-leg pilot performs the real move in each leg (climbs the drop ladder, grapples to the Gazette ledge with back held and pulls up, grapples onto the zipline, drops to the street and wall-runs along the hotel, sprints to the plaza). If a leg fails its timeout it is "assisted" (teleport into the checkpoint with the move noted) and the run's time is thrown away: fix that leg's script or the checkpoint, then rerun. Thresholds use the same timed formula.
3. **Arena:** a bot counters every blue bolt, dodges red ones, uses the special when the combo is ready and otherwise cycles punch, punch, kick, punch, throw, kick, punch, cape. It never plays for variety. Three runs; gold is 1.25 times the median score, silver 0.85, bronze 0.5 (rounded to 50).
4. The lead then plays each challenge by hand at least once. If gold takes more than about ten tries, loosen that gold by 10%; if gold comes on the first try, tighten it by 10%.

- [ ] **Step 1: Write `scripts/course-check.mjs`**

```js
// Checks every challenge course and crime spot against the real city collision: pillars and
// starts on solid ground, hoops clear of buildings with open lines between them and room above
// the roofs, checkpoints on walkable ground, the parkour's ladder and zipline present, and crime
// squads standing on open street. Prints a report; exits 1 on any problem.
// usage: node scripts/course-check.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5206/';
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}?at=toNeon&god=1&new=1`);
await page.waitForFunction(() => window.__game?.side && window.__game.state.frame > 20, null, { timeout: 90000 });

const report = await page.evaluate(() => {
  const g = window.__game, C = g.world.collision, { CHALLENGES, CRIME_SPOTS, pillarPos } = g.side.data;
  const issues = [], info = [];
  const ground = (x, y, z) => C.groundBelow(x, y + 3, z, 0.3);
  const blocked = (a, b) => {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = C.raycast(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
    return hit ? `${hit.box?.tag ?? 'box'} at ${hit.t.toFixed(1)} m` : null;
  };
  const onGround = (label, p, tol = 0.35) => {
    const y = ground(p.x, p.y, p.z);
    if (!(Math.abs(y - p.y) <= tol)) issues.push(`${label}: ground is ${y.toFixed(2)}, expected ${p.y}`);
  };
  for (const ch of CHALLENGES) {
    onGround(`${ch.id} pillar`, pillarPos(ch));
    onGround(`${ch.id} start`, ch.start);
    let prev = { x: ch.start.x, y: ch.start.y + 1, z: ch.start.z };
    for (const [i, r] of (ch.rings ?? []).entries()) {
      // Eight spokes in the hoop's plane must be clear out to its radius plus 0.4 m.
      const n = [r.nx, r.ny, r.nz];
      const u0 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [n[1] * u0[2] - n[2] * u0[1], n[2] * u0[0] - n[0] * u0[2], n[0] * u0[1] - n[1] * u0[0]];
      const ul = Math.hypot(...u); u.forEach((v, k) => { u[k] = v / ul; });
      const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        const d = { x: u[0] * Math.cos(a) + v[0] * Math.sin(a), y: u[1] * Math.cos(a) + v[1] * Math.sin(a), z: u[2] * Math.cos(a) + v[2] * Math.sin(a) };
        const hit = C.raycast(r, d, r.r + 0.4);
        if (hit) { issues.push(`${ch.id} ring ${i}: hoop touches ${hit.box?.tag ?? 'box'}`); break; }
      }
      const roof = C.groundBelow(r.x, r.y, r.z, 0.3);
      if (r.y - roof < r.r + 0.6) issues.push(`${ch.id} ring ${i}: only ${(r.y - roof).toFixed(1)} m above the surface below`);
      const wall = blocked(prev, r);
      if (wall) issues.push(`${ch.id} leg to ring ${i}: blocked by ${wall}`);
      const h = Math.hypot(r.x - prev.x, r.z - prev.z), drop = prev.y - r.y;
      info.push(`${ch.id} leg ${i}: ${h.toFixed(0)} m, drop ${drop.toFixed(1)} m, slope 1:${(h / Math.max(drop, 0.01)).toFixed(1)}`);
      if (drop < -1) issues.push(`${ch.id} leg to ring ${i}: climbs ${(-drop).toFixed(1)} m`);
      prev = r;
    }
    for (const [i, c] of (ch.checkpoints ?? []).entries()) onGround(`${ch.id} checkpoint ${i}`, c, 0.8);
  }
  const park = CHALLENGES.find((c) => c.kind === 'parkour');
  if (park) {
    const [c1, c2, c3] = park.checkpoints;
    const ladder = g.climbables.ladders.find((l) => l.bottom < 1 && Math.hypot(l.x - c1.x, l.z - c1.z) < 20);
    if (!ladder) issues.push('parkour: no street ladder within 20 m of checkpoint 1');
    else info.push(`parkour ladder at ${ladder.x.toFixed(1)}, ${ladder.z.toFixed(1)}`);
    const zip = g.climbables.ziplines.find((z) => Math.hypot(z.a.x - c2.x, z.a.z - c2.z) < 30 && Math.hypot(z.b.x - c3.x, z.b.z - c3.z) < 30);
    if (!zip) issues.push('parkour: no zipline from checkpoint 2 down to checkpoint 3');
    else info.push(`parkour zipline ${zip.a.x.toFixed(0)},${zip.a.z.toFixed(0)} -> ${zip.b.x.toFixed(0)},${zip.b.z.toFixed(0)}`);
  }
  for (const s of CRIME_SPOTS) {
    const y = ground(s.x, s.y, s.z);
    if (Math.abs(y - s.y) > 0.4) issues.push(`crime ${s.id}: ground ${y.toFixed(2)}, expected ${s.y}`);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, r = k % 2 ? 5 : 3.5;
      const gy = ground(s.x + Math.sin(a) * r, y, s.z + Math.cos(a) * r);
      if (Math.abs(gy - y) > 0.6) { issues.push(`crime ${s.id}: goon slot ${k} stands at ${gy.toFixed(2)}`); break; }
    }
  }
  return { issues, info };
});

for (const l of report.info) console.log('  ' + l);
console.log(report.issues.length ? `\n${report.issues.length} problem(s):\n` + report.issues.join('\n') : '\nall courses and crime spots clear');
await browser.close();
process.exit(report.issues.length ? 1 : 0);
```

- [ ] **Step 2: Run it and fix the data.** Frozen build, then `node scripts/course-check.mjs`. For each problem, edit only the numbers in `src/game/challenges.js` or `src/game/crimes.js`:
  - Hoop touching a wall or a sign: move it toward the street centre (x = 30 or x = 150 for the first two courses) or raise it.
  - Too low over a roof: raise the hoop, then lower the following hoops so no leg climbs.
  - Start or pillar off the ground: set `y` to the printed ground height.
  - Missing zipline: read the printed zipline list (`window.__game.climbables.ziplines`) and move checkpoints 2 and 3 to the ends of a Neon Row line that runs downhill; keep the labels.
  - Crime slot off the street: move the spot a few metres along the street.
  Rebuild and rerun until it prints `all courses and crime spots clear`. Run `npx vitest run tests/unit/challenges.test.js tests/unit/crimes.test.js` after each edit.

- [ ] **Step 3: Write `scripts/challenge-tune.mjs`**

```js
// Completes every challenge with a scripted pilot and prints medal thresholds for
// src/game/challenges.js (see suggestThresholds). Glide courses and the arena run three times.
// usage: node scripts/challenge-tune.mjs [baseUrl] [challengeId ...]
// env: SHOTS=<dir> saves a screenshot mid-run and at the result of each run.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { CHALLENGES, suggestThresholds } from '../src/game/challenges.js';

const base = process.argv[2] ?? 'http://localhost:5206/';
const only = process.argv.slice(3);
const shots = process.env.SHOTS ?? '';
if (shots) mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

async function fresh(id) {
  await page.goto(`${base}?at=toNeon&god=1&new=1`);
  await page.waitForFunction(() => window.__game?.side && window.__game.state.frame > 30, null, { timeout: 90000 });
  await page.evaluate(() => {
    const g = window.__game;
    window.__done = null;
    g.events.on('challengeDone', (e) => { window.__done = e; });
    g.events.on('challengeFail', (e) => { window.__done = { ...e, failed: true }; });
    window.__aim = (x, y, z) => {
      const c = g.camera.position, dx = x - c.x, dz = z - c.z;
      g.follow.state.yaw = Math.atan2(dx, dz);
      g.follow.state.pitch = Math.max(-1, Math.min(1.2, Math.atan2(c.y - y, Math.hypot(dx, dz))));
    };
    window.__face = (x, z) => { const h = g.hero.pos; g.follow.state.yaw = Math.atan2(x - h.x, z - h.z); };
  });
  await page.evaluate((id) => window.__game.side.challenges.start(id), id);
  await page.waitForFunction(() => window.__game.side.challenges.running, null, { timeout: 8000 });
}
const done = () => page.evaluate(() => window.__done);
const shot = async (name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };

async function glideRun(id, n) {
  await fresh(id);
  await page.evaluate(() => {
    const g = window.__game;
    const tick = () => {
      if (!g.side.challenges.running) return;
      const t = g.side.challenges.nextMarker();
      if (t) {
        const h = g.hero.pos, ty = t.y + 1.5;
        const d = Math.max(1, Math.hypot(t.x - h.x, t.z - h.z));
        g.follow.state.yaw = Math.atan2(t.x - h.x, t.z - h.z);
        const slope = (h.y + 1 - ty) / d;   // the level glide sinks about 0.14 m per metre
        g.follow.state.pitch = slope > 0.3 ? 0.7 : slope < 0.04 ? -0.25 : 0.25;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.down('Space');
  await page.waitForTimeout(3000);
  await shot(`${id}-${n}-mid`);
  await page.waitForFunction(() => window.__done, null, { timeout: 120000 });
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await shot(`${id}-${n}-result`);
  return done();
}

async function arenaRun(n) {
  await fresh('birthdayBash');
  await page.mouse.click(640, 360);
  const pattern = ['Mouse0', 'Mouse0', 'KeyE', 'Mouse0', 'KeyG', 'KeyE', 'Mouse0', 'KeyQ'];
  for (let i = 0; i < 1500 && !(await done()); i++) {
    const s = await page.evaluate(() => {
      const g = window.__game, h = g.hero.pos;
      const es = g.combat.enemies.filter((e) => e.alive);
      let near = null, nd = Infinity;
      for (const e of es) { const d = Math.hypot(e.pos.x - h.x, e.pos.z - h.z); if (d < nd) { nd = d; near = e; } }
      if (near) g.hero.bat.face(Math.atan2(near.pos.x - h.x, near.pos.z - h.z));
      return {
        blue: es.some((e) => e.glyph === 'blue' && e.state === 'windup'),
        red: es.some((e) => e.glyph === 'red' && e.state === 'windup'),
        ready: g.combat.combo.ready,
      };
    });
    if (s.blue) await page.mouse.click(640, 360, { button: 'right' });
    else if (s.red) await page.keyboard.press('KeyC');
    else if (s.ready) await page.keyboard.press('KeyX');
    else {
      const k = pattern[i % pattern.length];
      if (k === 'Mouse0') await page.mouse.click(640, 360); else await page.keyboard.press(k);
    }
    if (i === 60) await shot(`birthdayBash-${n}-mid`);
    await page.waitForTimeout(140);
  }
  await shot(`birthdayBash-${n}-result`);
  return done();
}

// Parkour: one leg per checkpoint, each doing its real move. A leg that times out is assisted
// (teleport into the checkpoint with the move noted) and marks the whole run as unusable.
async function parkourRun() {
  await fresh('gothamParkour');
  const legs = [];
  const next = () => page.evaluate(() => window.__game.side.challenges.debug?.next ?? 99);
  const reach = async (n, ms) => {
    try { await page.waitForFunction((n) => (window.__game.side.challenges.debug?.next ?? 99) >= n || window.__done, n, { timeout: ms }); return true; } catch { return false; }
  };
  const assist = async (n, move) => {
    await page.evaluate(({ n, move }) => {
      const g = window.__game;
      const cp = g.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints[n - 1];
      const ev = { ladder: 'ladderOn', ledge: 'ledgeGrab', zipline: 'zipOn', wallrun: 'wallRun' }[move];
      if (ev) g.events.emit(ev);
      g.hero.teleport({ x: cp.x, y: cp.y, z: cp.z });
    }, { n, move });
    await reach(n, 2000);
    return 'assisted';
  };
  const walkTo = async (x, z, ms, sprint = false) => {
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    if (sprint) await page.keyboard.down('ShiftLeft');
    let last = null;
    while (Date.now() - t0 < ms) {
      const p = await page.evaluate(([x, z]) => { window.__face(x, z); const h = window.__game.hero.pos; return [h.x, h.z]; }, [x, z]);
      if (Math.hypot(p[0] - x, p[1] - z) < 2) break;
      if (last && Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.3) await page.keyboard.press('Space');
      last = p;
      await page.waitForTimeout(250);
    }
    await page.keyboard.up('KeyW');
    if (sprint) await page.keyboard.up('ShiftLeft');
  };
  const cps = await page.evaluate(() => window.__game.side.data.CHALLENGES.find((c) => c.id === 'gothamParkour').checkpoints);

  // Leg 1, ladder: walk into the fire escape's drop ladder, climb to the landing, grapple up.
  const ladder = await page.evaluate(([x, z]) => window.__game.climbables.ladders.find((l) => l.bottom < 1 && Math.hypot(l.x - x, l.z - z) < 20) ?? null, [cps[0].x, cps[0].z]);
  if (ladder) {
    await walkTo(ladder.x + ladder.nx * 0.6, ladder.z + ladder.nz * 0.6, 6000);
    await page.evaluate((l) => window.__face(l.x, l.z), ladder);
    await page.keyboard.down('KeyW');
    await page.waitForFunction(() => window.__game.hero.control?.name === 'ladder', null, { timeout: 4000 }).catch(() => {});
    await page.waitForFunction(() => !window.__game.hero.control, null, { timeout: 12000 }).catch(() => {});
    await page.keyboard.up('KeyW');
  }
  await page.evaluate((c) => window.__aim(c.x, c.y + 1, c.z), cps[0]);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyF');
  legs.push((await reach(1, 8000)) ? 'ok' : await assist(1, 'ladder'));

  // Leg 2, ledge: grapple at the Gazette's north edge with back held, hang, pull up, walk in.
  await page.evaluate((c) => window.__aim(c.x, c.y - 0.5, c.z + 24), cps[1]);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(300);
  await page.keyboard.press('KeyF');
  await page.keyboard.up('KeyS');
  await page.waitForFunction(() => window.__game.hero.control?.name === 'ledge', null, { timeout: 6000 }).catch(() => {});
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await walkTo(cps[1].x, cps[1].z, 6000);
  legs.push((await reach(2, 4000)) ? 'ok' : await assist(2, 'ledge'));

  // Leg 3, zipline: grapple to the top post of the Gazette line, ride it to the pawn shop roof.
  const zip = await page.evaluate(([a, b]) => window.__game.climbables.ziplines.find((z) => Math.hypot(z.a.x - a.x, z.a.z - a.z) < 30 && Math.hypot(z.b.x - b.x, z.b.z - b.z) < 30) ?? null, [cps[1], cps[2]]);
  if (zip) {
    await walkTo(zip.a.x, zip.a.z, 6000);
    await page.evaluate((z) => window.__aim(z.b.x, z.b.y, z.b.z), zip);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    await page.evaluate((z) => window.__aim(z.a.x, z.a.y - 1.2, z.a.z), zip);
    await page.keyboard.press('KeyF');
  }
  if (!(await reach(3, 9000))) { await walkTo(cps[2].x, cps[2].z, 4000); }
  legs.push((await reach(3, 1000)) ? 'ok' : await assist(3, 'zipline'));

  // Leg 4, wall run: step off the pawn roof into the street, sprint along the hotel's east
  // face at about 20 degrees into it, jump to run the wall, then run to the checkpoint.
  await walkTo(cps[2].x + 22, cps[2].z, 5000);
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__game.follow.state.yaw = Math.atan2(-0.34, -0.94); });
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(900);
  await page.keyboard.press('Space');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await walkTo(cps[3].x, cps[3].z, 8000, true);
  legs.push((await reach(4, 3000)) ? 'ok' : await assist(4, 'wallrun'));

  // Leg 5: sprint west along the z = -90 street, then into the plaza.
  await walkTo(-40, cps[3].z, 30000, true);
  await walkTo(cps[4].x, cps[4].z, 12000, true);
  legs.push((await reach(5, 3000)) ? 'ok' : await assist(5, null));
  await shot('gothamParkour-result');
  return { ...(await done()), legs };
}

const out = {};
for (const ch of CHALLENGES) {
  if (only.length && !only.includes(ch.id)) continue;
  const samples = [];
  if (ch.kind === 'rings') {
    for (let n = 0; n < 3; n++) { const r = await glideRun(ch.id, n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else if (ch.kind === 'arena') {
    for (let n = 0; n < 3; n++) { const r = await arenaRun(n); if (r && !r.failed) samples.push(r.value); console.log(ch.id, n, r); }
  } else {
    const r = await parkourRun();
    console.log(ch.id, r);
    if (r && !r.failed && r.legs.every((l) => l === 'ok')) samples.push(r.value);
    else console.log(`${ch.id}: legs ${r?.legs?.join(', ')}. Fix the assisted legs (script or checkpoints) and rerun.`);
  }
  out[ch.id] = samples.length ? { samples, suggested: suggestThresholds(ch.kind, samples) } : { samples, suggested: null };
}
console.log('\n' + JSON.stringify(out, null, 1));
console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
```

- [ ] **Step 4: Tune.** Frozen build, then:

```bash
SHOTS="$TEMP/c3-tune" node scripts/challenge-tune.mjs http://localhost:5206/
```
  - A glide course where the pilot fails (missed hoop loop, water, time) means the course is not flyable as drawn: check the leg slopes printed by `course-check.mjs`, make the failing leg steeper (lower the hoop) or shorter, and rerun both scripts.
  - Copy each `suggested` object into that challenge's `medals` (and `limit` for timed ones) in `src/game/challenges.js`.
  - Parkour: rerun `node scripts/challenge-tune.mjs http://localhost:5206/ gothamParkour` until every leg says `ok`.
  - Save the screenshots of one result per challenge as `docs/screens/challenge-<id>.png`.

- [ ] **Step 5: Hand check (the lead).** Play each challenge from its pillar. Adjust gold by 10% either way per the method above. Record the final numbers in the commit message.

- [ ] **Step 6: Commit**

```bash
npx vitest run tests/unit/challenges.test.js tests/unit/crimes.test.js
git add scripts/course-check.mjs scripts/challenge-tune.mjs src/game/challenges.js src/game/crimes.js docs/screens/challenge-*.png
git commit -m "Validate courses against the city and tune medal times by scripted runs"
```

---

### Task 17: Scripted runs for crimes and photo mode, and browser tests

**Files:**
- Modify: `scripts/dev-play.mjs`
- Create: `scripts/runs/crime.json`, `scripts/runs/photo.json`
- Create: `tests/e2e/content.spec.js`

**Interfaces:**
- Consumes: `side.crimes.force`, `side.challenges`, `photo`, `ink.uniforms.uFilter`, `progress`.
- Produces: repeatable runs and CI-style browser tests.

- [ ] **Step 1: Two small additions to `scripts/dev-play.mjs`.** After `const page = ...`:

```js
// Photo mode saves go to the output folder.
page.on('download', async (d) => { const f = `${outDir}/${d.suggestedFilename()}`; await d.saveAs(f); console.log('download:', f); });
```
and in the step loop, after the `press` line:

```js
  if (s.type) await page.keyboard.type(s.type, { delay: 20 });
```
Update the usage comment: `{ "type": "text" }` types text into the focused field. Also let the third argument be a file: replace `const steps = JSON.parse(stepsJson);` with

```js
const steps = JSON.parse(stepsJson.trim().startsWith('[') ? stepsJson : (await import('node:fs')).readFileSync(stepsJson, 'utf8'));
```

- [ ] **Step 2: `scripts/runs/crime.json`**

```json
[
  { "wait": 1200 },
  { "eval": "window.__game.side.crimes.force({ kind: 'van', spotId: 'neonNorth' })" },
  { "wait": 800 },
  { "eval": "document.querySelector('.radio.show .radio-text')?.textContent" },
  { "shot": "crime-radio" },
  { "eval": "window.__game.teleport({ x: 150, y: 0, z: -6 })" },
  { "wait": 1500 },
  { "shot": "crime-squad" },
  { "press": "KeyE" }, { "wait": 400 }, { "click": 0 }, { "wait": 400 }, { "press": "KeyE" }, { "wait": 400 }, { "click": 0 }, { "wait": 400 },
  { "eval": "(async () => { const g = window.__game; for (let i = 0; i < 30 && g.side.crimes.active; i++) { g.winFight(); await new Promise((r) => setTimeout(r, 600)); } return g.progress.crimes.stopped; })()" },
  { "wait": 800 },
  { "shot": "crime-stopped" },
  { "press": "Escape" }, { "wait": 300 },
  { "eval": "document.querySelector('.pause-menu .note')?.textContent" }
]
```

- [ ] **Step 3: `scripts/runs/photo.json`**

```json
[
  { "wait": 1200 },
  { "click": 0 }, { "wait": 400 },
  { "press": "KeyO" }, { "wait": 600 }, { "shot": "photo-ink" },
  { "eval": "window.__game.state.paused" },
  { "press": "Digit1" }, { "wait": 300 }, { "shot": "photo-noir" },
  { "press": "Digit1" }, { "wait": 300 }, { "shot": "photo-pop" },
  { "press": "Digit1" }, { "wait": 300 }, { "shot": "photo-sepia" },
  { "press": "Digit1" }, { "press": "Digit2" }, { "wait": 300 }, { "shot": "photo-panel" },
  { "press": "Digit2" }, { "wait": 300 }, { "shot": "photo-cover" },
  { "press": "KeyT" }, { "type": "gotham loves mansi" }, { "press": "Enter" }, { "wait": 200 },
  { "hold": ["KeyW"], "ms": 4000 },
  { "eval": "(() => { const g = window.__game; const c = g.camera.position, h = g.hero.pos; return +Math.hypot(c.x - h.x, c.y - h.y - 1.2, c.z - h.z).toFixed(2); })()" },
  { "hold": ["KeyE"], "ms": 600 }, { "hold": ["KeyZ"], "ms": 800 },
  { "press": "Digit3" }, { "wait": 300 }, { "shot": "photo-no-batman" },
  { "press": "Enter" }, { "wait": 1500 },
  { "eval": "window.__game.progress.stats.photos" },
  { "press": "Escape" }, { "wait": 500 },
  { "eval": "[window.__game.ink.uniforms.uFilter.value, window.__game.state.paused, window.__game.hero.bat.root.visible]" }
]
```

- [ ] **Step 4: Run both** (frozen build):

```bash
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-crime" scripts/runs/crime.json
node scripts/dev-play.mjs "http://localhost:5206/?at=toNeon&god=1&new=1" "$TEMP/c3-photo" scripts/runs/photo.json
```
Expected, crime: radio text `Van break-in on Neon Row`, stopped count `1`, pause note `Crimes stopped: 1`, no console errors. Photo: `true` for paused, the camera distance at or under `20`, photos `1`, a `download: .../gotham-for-mansi-*.png` line, the final eval `[0, false, true]`, no console errors. Open the PNG: cover frame, masthead `GOTHAM FOR MANSI`, `ISSUE No. 1`, the caption `GOTHAM LOVES MANSI`, no Batman, no HUD, no panel. Copy the filter and frame shots and the PNG to `docs/screens/photo-*.png` and the crime shots to `docs/screens/crime-*.png`.

- [ ] **Step 5: `tests/e2e/content.spec.js`**

```js
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const ready = () => window.__game?.state?.ready && window.__game.state.frame > 20;
async function collectErrors(page) {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
const pauseButton = (page, text) => page.locator('.pause-menu .mbtn', { hasText: text });

test('a glide challenge counts down, runs and can be quit from the pause menu', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.side.challenges.start('neonSlalom'));
  await expect(page.locator('.ch-panel.show')).toBeVisible();
  await page.waitForFunction(() => window.__game.side.challenges.running, null, { timeout: 10000 });
  await page.keyboard.press('Escape');
  await pauseButton(page, 'Quit challenge').click();
  await page.waitForFunction(() => !window.__game.side.challenges.active, null, { timeout: 5000 });
  const d = await page.evaluate(() => { const h = window.__game.hero.pos; return Math.hypot(h.x - 163, h.z - 100); });
  expect(d).toBeLessThan(1);
  expect(errors).toEqual([]);
});

test('a street crime spawns, is won and counted', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.side.crimes.force({ kind: 'robbery', spotId: 'neonNorth' }));
  await page.waitForFunction(() => !!window.__game.side.crimes.active, null, { timeout: 5000 });
  await expect(page.locator('.radio.show')).toContainText('Robbery on Neon Row');
  await page.evaluate(() => window.__game.teleport({ x: 150, y: 0, z: -14 }));
  await page.waitForFunction(() => window.__game.enemies.some((e) => e.aware), null, { timeout: 10000 });
  await page.waitForFunction(() => { window.__game.winFight(); return window.__game.progress.crimes.stopped === 1; }, null, { timeout: 20000, polling: 500 });
  expect(errors).toEqual([]);
});

test('photo mode opens with O, cycles filters and saves a PNG', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.keyboard.press('KeyO');
  await expect(page.locator('.photo-panel')).toBeVisible();
  expect(await page.evaluate(() => window.__game.state.paused)).toBe(true);
  await page.keyboard.press('Digit1');
  expect(await page.evaluate(() => window.__game.ink.uniforms.uFilter.value)).toBe(1);
  const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
  expect(download.suggestedFilename()).toMatch(/^gotham-for-mansi-\d{8}-\d{6}\.png$/);
  expect([...readFileSync(await download.path()).subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.photo-panel')).toHaveCount(0);
  expect(await page.evaluate(() => [window.__game.ink.uniforms.uFilter.value, window.__game.state.paused])).toEqual([0, false]);
  expect(errors).toEqual([]);
});

test('the progress page shows the percentage, every part and the map', async ({ page }) => {
  const errors = await collectErrors(page);
  await page.goto('/?at=toNeon&god=1&new=1');
  await page.waitForFunction(ready, null, { timeout: 90000 });
  await page.keyboard.press('Escape');
  await pauseButton(page, 'Progress').click();
  await expect(page.locator('.progress-menu h2')).toContainText('%');
  expect(await page.locator('.progress-menu .pg-row').count()).toBe(6);
  await expect(page.locator('.progress-menu canvas.pg-map')).toBeVisible();
  await page.locator('.progress-menu .mbtn', { hasText: 'Back' }).click();
  await pauseButton(page, 'Challenges').click();
  expect(await page.locator('.challenges-menu .cr-row').count()).toBe(5);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 6: Run the browser tests**

```bash
BASE_URL=http://localhost:5206 npx playwright test
```
Expected: the old smoke tests and the four new ones pass.

- [ ] **Step 7: Commit**

```bash
git add scripts/dev-play.mjs scripts/runs/crime.json scripts/runs/photo.json tests/e2e/content.spec.js docs/screens/photo-*.png docs/screens/crime-*.png
git commit -m "Scripted runs and browser tests for crimes, photo mode, challenges and progress"
```

---

### Task 18: Performance: fps sweep and load time

**Files:**
- Modify: `scripts/fps-sweep.mjs` (a `side` page)
- Modify: any Plan 3C file a hitch points at

**Interfaces:**
- Consumes: `side.challenges.start/quit`, `side.crimes.force`, `photo.open/close`.
- Produces: the `side` rows in the sweep.

- [ ] **Step 1: Add the `side` page** to `scripts/fps-sweep.mjs`, before `await b.close();`, and mention `side` in the `ONLY=` help line:

```js
if (!only || only === 'side') {
  const { p, errors } = await openGame('at=toNeon&god=1&new=1');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  // A glide challenge with its hoops up.
  await label(p, 'challenge');
  await p.evaluate(() => window.__game.side.challenges.start('neonSlalom'));
  await p.waitForTimeout(2600);
  await p.keyboard.down('KeyW');
  await p.waitForTimeout(350);
  await p.keyboard.down('Space');
  await p.waitForTimeout(6000);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/side-challenge.png` }); await label(p, 'challenge'); }
  await p.keyboard.up('Space');
  await p.keyboard.up('KeyW');
  await p.evaluate(() => window.__game.side.challenges.quit());
  // A street crime: the squad arrives, the civilian cowers, the fight.
  await label(p, 'arrive:crime');
  await p.evaluate(() => window.__game.side.crimes.force({ kind: 'mugging', spotId: 'neonNorth' }));
  await p.waitForTimeout(500);
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: 150, y: 0, z: -8 }, Math.PI); g.follow.snapBehind(Math.PI); });
  await p.waitForTimeout(1500);
  await label(p, 'crime');
  for (let i = 0; i < 12; i++) { await p.keyboard.press(i % 3 ? 'KeyE' : 'KeyW'); await p.waitForTimeout(400); }
  // Photo mode: every filter and frame.
  await label(p, 'photo');
  await p.evaluate(() => window.__game.photo.open());
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Digit1'); await p.waitForTimeout(700); }
  for (let i = 0; i < 3; i++) { await p.keyboard.press('Digit2'); await p.waitForTimeout(700); }
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/side-photo.png` }); await label(p, 'photo'); }
  await p.evaluate(() => window.__game.photo.close());
  all.push(...await collect(p, 'side'));
  meta.errorsSide = errors;
  await p.close();
}
```

- [ ] **Step 2: Run the sweep on High and Low** (frozen build on 5206; this opens a visible Edge window, so run it on the owner's laptop with nothing else busy):

```bash
OUT="$TEMP/c3-sweep-high.json" node scripts/fps-sweep.mjs http://localhost:5206/ high
OUT="$TEMP/c3-sweep-low.json" node scripts/fps-sweep.mjs http://localhost:5206/ low
```
Pass: every row's `p95` at or under 6.9 ms on High (the owner's 144 fps target), `hitches >25ms after warmup: 0` on both, and no page errors in `meta.errors*`. Compare the `main`, `fight` and `boss` rows with a sweep of the Task 8 commit (`git stash` is not needed: build that commit to another folder with `git worktree add "$TEMP/c3-base" <sha>` and preview it on 5207): no row may be more than 5% slower.

- [ ] **Step 3: If there is a hitch,** read its label and time, then:
  - `arrive:crime` or `crime`: first draw of a prop or the civilian. Confirm they were created in `buildRun` (not on spawn), and that `warmCast.js` has the civilian.
  - `challenge`: the hoops. Confirm all hoops are created hidden in `createChallengeRunner`, and nothing calls `new THREE.*Geometry` per frame.
  - `photo`: the overlay canvas. It must redraw only on option changes (never per frame), and the filter must stay a uniform change.
  - A DOM reflow in any row: HUD writes must go through `set()` in `sideHud.js` (unchanged text is not written) and markers only write `transform`.
  Fix, rebuild, rerun until it passes.

- [ ] **Step 4: Load time**

```bash
node scripts/load-time.mjs http://localhost:5206/ 40 1
```
Expected: `firstFrame` within 0.2 s of the Task 8 build and near 3 s.

- [ ] **Step 5: Commit**

```bash
git add scripts/fps-sweep.mjs
git commit -m "fps sweep: challenge, street crime and photo mode scenario"
```
(plus any fixed files, with a message naming the hitch that was fixed)

---

### Task 19: Full verification (the lead runs this)

- [ ] **Step 1: Unit tests.** `npx vitest run`. Everything passes, including the eight new test files.
- [ ] **Step 2: No dashes in player text.**
  ```bash
  grep -nP "[\x{2013}\x{2014}]" src/game/challenges.js src/game/crimes.js src/game/sideContent.js src/game/challengeRunner.js src/game/crimeDirector.js src/game/arenaChallenge.js src/game/rewardPages.js src/game/progressTracker.js src/game/playStats.js src/game/photoMath.js src/ui/sideHud.js src/ui/photoMode.js src/ui/photoFrame.js src/ui/menus.js src/ui/prompts.js src/mansi.config.js
  ```
  Expected: no output.
- [ ] **Step 3: Browser tests.** Frozen build on 5206, then `BASE_URL=http://localhost:5206 npx playwright test`. All pass.
- [ ] **Step 4: Scripted runs.** `node scripts/course-check.mjs` prints `all courses and crime spots clear`. `SHOTS="$TEMP/c3-final" node scripts/challenge-tune.mjs` completes all five challenges (every parkour leg `ok`, every glide and arena run without `failed`). Both `scripts/runs/*.json` runs pass as in Task 17.
- [ ] **Step 5: Full playthrough.** `BASE=http://localhost:5206/ OUT="$TEMP/c3-pt" node scripts/playthrough.mjs`. It must end at `credits` with no console errors. Crimes may spawn during it; the run must not stall on one (crimes avoid the current objective and are called off by fight, boss and cutscene steps). If it stalls, fix the director, not the playthrough.
- [ ] **Step 6: A crime between story steps, by hand.** Play from `?at=toNeon&new=1` for 5 minutes of free movement: a radio call-out must come between 2 and 4 minutes, the marker points at it, and fighting it adds 1 to `Crimes stopped` in the pause menu.
- [ ] **Step 7: Photo mode on a gamepad.** With a pad: D-pad up opens photo mode, both sticks move and look, X and Y cycle filter and frame, A saves, B exits.
- [ ] **Step 8: Performance.** Task 18's sweep passes on the final build (High and Low), and load time is unchanged.
- [ ] **Step 9: WebKit.** `node scripts/webkit-check.mjs http://localhost:5206/ "$TEMP/wk"`. No console errors. In the shots, the Progress map and a photo-mode frame render.
- [ ] **Step 10: Review the screenshots** in `docs/screens/` (challenges, crimes, photo filters and frames, the Progress page) with the owner. The completion message in `src/mansi.config.js` is still a placeholder; remind Krishn to write it.
- [ ] **Step 11:** The lead pushes to `main` after the review. Never before.
