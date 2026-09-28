# Plan 4E: Chain Takedowns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three chain takedowns (1 Rope-a-Dope, 2 Headbanger, 3 Domino Drop) that carry Batman from goon to goon and end on a signature finisher. They open up at a high enough combo or from stealth, and come with a new `tied` enemy state, new keys and pad chords, HUD chain icons, a first-time prompt, a help section, sound words, sounds and slow-motion action shots.

**Architecture:**
- **Pure rules and data first.** `src/combat/chains.js` decides availability (combo costs, the stealth rule), picks targets (up to 3, line of sight through a passed-in predicate, never the Joker, never a brute first, a nearest-neighbour path) and holds the lunge maths. `src/combat/chainTimeline.js` describes each chain as a list of steps: target, where Batman goes, lunge time, arc, clip, contact time, hit-stop, effect, word. Both files have no three.js and are fully unit-tested.
- **One control plays any timeline.** `src/combat/chainControl.js` is a hero control (`{ name: 'chain', camera: 'chain', combat: true, update(dt) -> done }`) like the traversal controls in `src/actors/traverse/`. It moves Batman with collision-resolved lunges, starts each clip so its contact frame lands on the step's contact time, and applies effects through an `api` object that `combatSystem.js` builds. That way chains reuse the existing hit bookkeeping (director slots, combo, `impact`/`ko` events, `time.hitStop`, `critical()`, `shockwave()`).
- **Enemies gain two states.** `chained` (held by a chain: no AI, no physics) and `tied` (Rope-a-Dope: down for 6 s; any hit knocks the whole bundle out, routed through `landHit`).
- **The rest is wiring:** a code-authored clip module, an ink-line FX module on `LAYER_FX`, input actions and pad chords, HUD icons, prompts, help, sounds and words.

**Tech Stack:** Three.js 0.186, plain ES modules, Vitest 5, playwright-core scripted play (`scripts/dev-play.mjs`), `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`.

**Base:** Branch `chains`, cut from `main` **after** `kicks` (traversal + mocap kicks, `inputBuffer`, `takedown()`, `shockwave()`, `critical()`, hit-stop) and `perf` (comic look, `warmCast.js`, prewarm, dynamic resolution) are merged. Every file and line referenced below is as it stands after those merges.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`, Part E.
- Art and lettering are authored in code or taken from CC0 sources. The new clips are code-authored (like `src/actors/kicks.js`). No Higgsfield or other AI-generated assets.
- No em dashes in game copy: prompts, hints, help, labels, sound words, captions.
- Commits are authored by Krishn Gohel only, with no trailers. Never add `Co-Authored-By`.
- Never push. Pushing `main` redeploys the live site. The coordinator reviews and pushes.
- Frame rate: keep 144 fps or better on the owner's laptop. In the fps sweep, the worst 5% of frames stay at or under 6.9 ms, with no frame over 25 ms after the first 5 s. Every new effect goes into the warm-up pre-compile (`src/game/warmCast.js`). New clips are primed on the hero's mixer at run start. No per-frame allocations in hot paths (the chain FX writes into a preallocated buffer, and the HUD touches the DOM only when its state key changes).
- Load time: the first frame stays near 3 s. This plan adds no asset files. The three new clips are baked at boot, next to the kick clips, and are small.
- The Safari engine (WebKit) is checked before release.
- Verify in a browser only against a frozen production build: `npx vite build --outDir "$TEMP/chaindist"` then `npx vite preview --outDir "$TEMP/chaindist" --port 5204 --strictPort`.
- `window.__game` exposes `hero`, `combat`, `enemies`, `events`, `state`, `time`, `follow`, `spawn(type, p)`, `teleport(site|{x,y,z})` and `comic.skip()`. URL flags: `?fight=test` (a squad on the GCPD roof: 3 grunts, 1 knife, 1 brute) and `?god=1`.

## File Structure

| File | Responsibility |
|---|---|
| `src/combat/chains.js` (new) | Pure: chain table, costs, availability, stealth rule, target selection, hearers, tied groups, outcomes, HUD key, lunge maths |
| `src/combat/chainTimeline.js` (new) | Pure: per-chain step timelines, stock and chain clip beats, `chainClipNames()` |
| `src/combat/chainControl.js` (new) | Hero control `chain` that plays a timeline |
| `src/combat/combo.js` (modify) | `take(n)`: spend part of the combo and keep the rest |
| `src/combat/combatSystem.js` (modify) | Tied-break in `landHit`, `finishTarget`, `critical` and `shockwave` options, `startChain`, `chainApi`, chain actions, `combat.chains` |
| `src/actors/enemy.js` (modify) | `chained` and `tied` states: `chainHold`, `chainRelease`, `tie`, failsafe, wake on getup |
| `src/actors/chainAnims.js` (new) | Code-authored clips `Chain_GrabHeads`, `Chain_Yank`, `Chain_Stomp` |
| `src/actors/animator.js` (modify) | `prime(names)`: build actions up front |
| `src/game/chainFx.js` (new) | Ink tether and bundle wraps: one `LineSegments` on `LAYER_FX` |
| `src/game/warmCast.js` (modify) | A tether line in the warm cast |
| `src/game/camera.js` (modify) | `actionShot` framing options, `chain` camera mode |
| `src/game/game.js` (modify) | Register clips, prime them, chain FX, HUD chains, hints, prompt triggers, words, critical variant |
| `src/core/bindings.js` (modify) | Actions `chain1`, `chain2`, `chain3` on `Digit1`, `Digit2`, `Digit3` |
| `src/core/input.js` (modify) | `padActions()`: block plus D-pad chords |
| `src/ui/hud.js`, `src/ui/style.css` (modify) | Chain icons, speed-line variants |
| `src/ui/prompts.js`, `src/ui/menus.js` (modify) | `chain` and `chainTied` prompts, help section, pad layout line |
| `src/audio/sfx.js`, `src/game/sound.js` (modify) | Sounds `konk` and `tether`; event wiring |
| `tools/pose-viewer.js` (modify) | Build the chain clips so contact sheets can show them |
| `scripts/fps-sweep.mjs` (modify) | A `chain` scenario in the fight page |
| `tests/unit/chains.test.js`, `tests/unit/chainTimeline.test.js`, `tests/unit/chainControl.test.js`, `tests/unit/chainAnims.test.js`, `tests/unit/chainFx.test.js`, `tests/unit/input.test.js` (new) | Unit tests |
| `tests/unit/actors.test.js`, `tests/unit/prompts.test.js`, `tests/unit/bindings.test.js` (modify) | Unit tests |

## Shared interfaces (every task relies on these exact names)

```js
// src/combat/chains.js (pure; positions are plain { x, y, z })
CHAINS            // [{ n: 1, id: 'rope', name: 'Rope-a-Dope', cost: 6, action: 'chain1' },
                  //  { n: 2, id: 'head', name: 'Headbanger', cost: 9, action: 'chain2' },
                  //  { n: 3, id: 'domino', name: 'Domino Drop', cost: 12, action: 'chain3' }]
CHAIN_RULES       // { stealthRadius: 6, stealthMin: 2, reach: 9, maxRise: 1.2, maxTargets: 3, minTargets: 2, hearRadius: 8, tiedTime: 6 }
chainForAction(action) -> chain | null
chainCost(chain, discount = 0) -> number               // never below 1
chainEligible(enemy) -> boolean                        // alive, standing, not flying, not held/tied, not the boss
stealthChainReady(origin, enemies, opts?) -> boolean   // 2+ unaware eligible goons within 6 m, same floor
chainAvailability({ combo, origin, enemies, discount = 0 }) -> { show, stealth, affordable: [b, b, b], costs: [n, n, n] }
comboAfter(combo, chain, { stealth = false, discount = 0 } = {}) -> number
selectChainTargets(origin, facing, enemies, { canSee, reach, max, min, maxRise, onlyUnaware } = {}) -> enemy[] | null
chainHearers(origin, enemies, chained, radius = 8) -> enemy[]   // unaware, not chained, within 8 m
tiedGroup(enemy) -> enemy[]                            // enemy plus its still-tied partners
chainOutcome(enemy) -> 'ko' | 'knockdown'              // brutes only go down
chainHudKey(state) -> string                           // 'off' | 'c100' | 's111' ...
strikeSpot(from, target, stop) -> {x,y,z}
midSpot(a, b) -> {x,y,z}
pileCenter(points) -> {x,y,z}
backSpot(center, from, dist) -> {x,y,z}
lungePoint(from, to, k, arc = 0, out?, ease = 'out') -> {x,y,z}

// src/combat/chainTimeline.js (pure)
EFFECTS           // ['stagger', 'tether', 'yank', 'tie', 'grab', 'headSmash', 'heel', 'stomp', 'diveBomb']
STOCK_BEATS       // { Punch_Cross: { contact }, Melee_Hook: { contact }, OverhandThrow: { contact } }
CHAIN_BEATS       // { Chain_GrabHeads: { duration: 0.8, grab: 0.16, contact: 0.4 }, Chain_Yank: { duration: 0.7, contact: 0.2 }, Chain_Stomp: { duration: 0.45, contact: 0.16 } }
buildChainTimeline(id, count, beats = {}) -> { id, count, steps: Step[], duration }
chainClipNames() -> string[]                           // every hero clip any chain plays
// Step: { target: 0|1|2|'pile', at: 'strike'|'between'|'head'|'back'|'apex'|'pile'|'stay',
//         lunge, arc, stop, ease: 'out'|'in', clip: string|null, speed, clipStart, contact,
//         hitStop, effect: EFFECTS[i]|null, word: string|null, finisher: boolean, thenClip: string|null,
//         dur, start }

// src/combat/chainControl.js
createChainControl(hero, api, { chain, targets, stealth, timeline })
  -> { name: 'chain', camera: 'chain', combat: true, chain: id, targets, canChain: () => false, update(dt) -> boolean }
CHAIN_SHOTS       // { rope: {dist, lift, back}, head: {...}, domino: {...} } for follow.actionShot
// api (built by combatSystem.chainApi(ctx)):
//   { events, time, collision, fx, enemies(), hold(e), release(e), stagger(e),
//     finish(e, { power, launch }) -> outcome, tie(list), critical(target, opts),
//     shockwave(center, radius, opts), word(text, pos, big) }

// src/actors/enemy.js additions
e.chainHold() -> wasAttacking      // state 'chained'
e.chainRelease()                   // 'chained' -> 'engage' (aware) or 'idle' (unaware)
e.tie(partners, seconds = 6) -> wasAttacking   // state 'tied', down, tiedWith, tiedT
e.tiedWith: enemy[] | null, e.tiedT: number

// src/combat/combo.js
combo.take(n)                      // value -= n (min 0), timeout restarts

// src/combat/combatSystem.js
createCombat({ ..., getChainDiscount = () => 0 })
combat.chains -> { show, stealth, affordable, costs }   // refreshed at most every 0.1 s or on combo change
critical(target, { slow, scale, shot, variant })        // internal; 'critical' event carries { target, variant }
shockwave(center, radius = 4, { crit = true, word } = {}) // 'diveImpact' carries { pos, count, word }

// src/game/chainFx.js
createChainFx(scene) -> { fire(fromFn, targets, dur), bind(members), clear(), update(dt), active }
CHAIN_FX_MAX = 256

// src/actors/chainAnims.js
CHAIN_CLIPS = ['Chain_GrabHeads', 'Chain_Yank', 'Chain_Stomp']
buildChainClips(model, clips, fwd = 1) -> AnimationClip[]

// src/actors/animator.js
animator.prime(names)              // throws on a missing clip

// src/core/input.js
PAD_BUTTONS, PAD_CHORD_HOLD = 3, PAD_CHORDS = { chain1: 14, chain2: 12, chain3: 15 }
padActions(isDown, out = new Set()) -> Set<action>

// src/ui/hud.js
hud.setChains(state, keyLabels)    // state = combat.chains; keyLabels = ['1', '2', '3']
hud.critical(variant = '')         // '', 'rope', 'head', 'domino'

// src/game/camera.js
follow.actionShot(focus, attacker, duration, { dist = 3.2, lift = -0.55, back = 1.2 } = {})

// Events
chainStart { chain, count, stealth, ids }   chainContact { chain, effect, index }
chainTether   chainYank   chainTied { count }   chainGrab   chainSmash { pos }   chainStomp
chainDone { chain, count, stealth }         tiedBreak { count }
```

---

### Task 1: Chain rules (pure)

**Files:**
- Create: `src/combat/chains.js`
- Modify: `src/combat/combo.js`
- Test: `tests/unit/chains.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: everything listed under `src/combat/chains.js` above, and `combo.take(n)`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/chains.test.js
import { describe, it, expect } from 'vitest';
import {
  CHAINS, chainForAction, chainCost, chainEligible, stealthChainReady, chainAvailability, comboAfter,
  selectChainTargets, chainHearers, tiedGroup, chainOutcome, chainHudKey, strikeSpot, midSpot, pileCenter, backSpot, lungePoint,
} from '../../src/combat/chains.js';
import { createCombo } from '../../src/combat/combo.js';

const goon = (id, x, z, o = {}) => ({ id, type: 'grunt', def: {}, alive: true, down: false, air: false, aware: true, state: 'engage', pos: { x, y: 0, z }, ...o });
const brute = (id, x, z, o = {}) => goon(id, x, z, { type: 'brute', def: { armored: true }, ...o });
const joker = (id, x, z, o = {}) => goon(id, x, z, { type: 'joker', def: { boss: true }, ...o });
const unaware = (id, x, z) => goon(id, x, z, { aware: false, state: 'idle' });
const O = { x: 0, y: 0, z: 0 };
const AHEAD = { x: 0, z: 1 };
const see = () => true;

describe('chain table', () => {
  it('has the three chains on keys 1 to 3 costing 6, 9 and 12', () => {
    expect(CHAINS.map((c) => [c.n, c.id, c.cost, c.action])).toEqual([[1, 'rope', 6, 'chain1'], [2, 'head', 9, 'chain2'], [3, 'domino', 12, 'chain3']]);
    expect(chainForAction('chain2').id).toBe('head');
    expect(chainForAction('punch')).toBe(null);
  });
  it('a discount lowers the cost but never below 1', () => {
    expect(chainCost(CHAINS[0], 2)).toBe(4);
    expect(chainCost(CHAINS[0], 99)).toBe(1);
  });
});

describe('chainEligible', () => {
  it('takes standing goons and brutes, never the Joker or anyone down, flying, held or tied', () => {
    expect(chainEligible(goon('a', 1, 1))).toBe(true);
    expect(chainEligible(brute('b', 1, 1))).toBe(true);
    expect(chainEligible(joker('j', 1, 1))).toBe(false);
    for (const o of [{ alive: false }, { down: true }, { air: true }, { state: 'grabbed' }, { state: 'chained' }, { state: 'tied' }]) {
      expect(chainEligible(goon('x', 1, 1, o)), JSON.stringify(o)).toBe(false);
    }
  });
});

describe('chainAvailability in a fight', () => {
  const squad = [goon('a', 2, 0), goon('b', 4, 0), goon('c', -3, 2)];
  it('stays hidden below combo 6', () => {
    const a = chainAvailability({ combo: 5, origin: O, enemies: squad });
    expect(a.show).toBe(false);
    expect(a.affordable).toEqual([false, false, false]);
  });
  it('lights each chain as the combo reaches its cost', () => {
    expect(chainAvailability({ combo: 6, origin: O, enemies: squad }).affordable).toEqual([true, false, false]);
    expect(chainAvailability({ combo: 9, origin: O, enemies: squad }).affordable).toEqual([true, true, false]);
    expect(chainAvailability({ combo: 12, origin: O, enemies: squad }).affordable).toEqual([true, true, true]);
  });
  it('shows the icons but lights none with fewer than 2 goons in reach', () => {
    const a = chainAvailability({ combo: 12, origin: O, enemies: [goon('a', 2, 0), goon('far', 20, 0)] });
    expect(a.show).toBe(true);
    expect(a.affordable).toEqual([false, false, false]);
  });
  it('needs a goon that can go first: two brutes are not enough', () => {
    expect(chainAvailability({ combo: 12, origin: O, enemies: [brute('a', 2, 0), brute('b', 3, 0)] }).affordable).toEqual([false, false, false]);
  });
  it('ignores goons on another floor', () => {
    const upstairs = goon('b', 3, 0, { pos: { x: 3, y: 4, z: 0 } });
    expect(chainAvailability({ combo: 12, origin: O, enemies: [goon('a', 2, 0), upstairs] }).affordable[0]).toBe(false);
  });
  it('a discount lowers the thresholds', () => {
    const a = chainAvailability({ combo: 4, origin: O, enemies: squad, discount: 2 });
    expect(a.show).toBe(true);
    expect(a.affordable).toEqual([true, false, false]);
  });
});

describe('chainAvailability from stealth', () => {
  it('two unaware goons within 6 m make every chain free', () => {
    const a = chainAvailability({ combo: 0, origin: O, enemies: [unaware('a', 3, 0), unaware('b', 0, 5)] });
    expect(a).toMatchObject({ show: true, stealth: true, affordable: [true, true, true] });
  });
  it('one of them at 7 m does not count', () => {
    expect(stealthChainReady(O, [unaware('a', 3, 0), unaware('b', 7, 0)])).toBe(false);
  });
  it('aware goons, the Joker and downed goons do not count', () => {
    expect(stealthChainReady(O, [unaware('a', 3, 0), goon('b', 2, 0)])).toBe(false);
    expect(stealthChainReady(O, [unaware('a', 3, 0), joker('j', 2, 0, { aware: false })])).toBe(false);
    expect(stealthChainReady(O, [unaware('a', 3, 0), { ...unaware('b', 2, 0), down: true }])).toBe(false);
  });
});

describe('spending combo', () => {
  it('comboAfter spends the cost in a fight and keeps the rest', () => {
    expect(comboAfter(10, CHAINS[0])).toBe(4);
    expect(comboAfter(12, CHAINS[2])).toBe(0);
  });
  it('comboAfter is free from stealth', () => {
    expect(comboAfter(3, CHAINS[2], { stealth: true })).toBe(3);
  });
  it('combo.take removes that many hits, keeps the rest and restarts the timeout', () => {
    const c = createCombo({ timeout: 1.5 });
    for (let i = 0; i < 10; i++) c.hit();
    c.tick(1.4);
    c.take(6);
    expect(c.value).toBe(4);
    c.tick(1.4);
    expect(c.value).toBe(4);
    c.take(9);
    expect(c.value).toBe(0);
  });
});

describe('selectChainTargets', () => {
  it('needs at least 2 goons', () => {
    expect(selectChainTargets(O, AHEAD, [goon('a', 2, 0)], { canSee: see })).toBe(null);
  });
  it('takes up to 3: the best first target, then hops to the nearest remaining', () => {
    const list = [goon('far', 8, 0), goon('near', 2, 0), goon('mid', 4, 0), goon('x', -7, 0), goon('y', 0, 8.5)];
    expect(selectChainTargets(O, { x: 1, z: 0 }, list, { canSee: see }).map((e) => e.id)).toEqual(['near', 'mid', 'far']);
  });
  it('never picks anyone beyond 9 m, out of sight, or the Joker', () => {
    const list = [goon('a', 2, 0), goon('hidden', 3, 0), goon('far', 9.5, 0), joker('j', 1, 0), goon('b', 0, 3)];
    const got = selectChainTargets(O, AHEAD, list, { canSee: (e) => e.id !== 'hidden' }).map((e) => e.id);
    expect(got.sort()).toEqual(['a', 'b']);
  });
  it('can chain a brute but never starts on one', () => {
    expect(selectChainTargets(O, AHEAD, [brute('br', 0, 1), goon('g', 0, 3)], { canSee: see }).map((e) => e.id)).toEqual(['g', 'br']);
  });
  it('gives up when only brutes could go first', () => {
    expect(selectChainTargets(O, AHEAD, [brute('a', 1, 0), brute('b', 2, 0)], { canSee: see })).toBe(null);
  });
  it('prefers the goon Batman faces when two are equally close', () => {
    expect(selectChainTargets(O, AHEAD, [goon('behind', 0, -3), goon('front', 0, 3)], { canSee: see })[0].id).toBe('front');
  });
  it('from stealth takes only goons that have not noticed Batman', () => {
    const list = [goon('aw', 1, 0), goon('u1', 2, 0, { aware: false }), goon('u2', 3, 0, { aware: false })];
    expect(selectChainTargets(O, AHEAD, list, { canSee: see, onlyUnaware: true }).map((e) => e.id)).toEqual(['u1', 'u2']);
  });
  it('only checks line of sight for goons already in reach', () => {
    const seen = [];
    selectChainTargets(O, AHEAD, [goon('a', 1, 0), goon('b', 2, 0), goon('far', 30, 0)], { canSee: (e) => { seen.push(e.id); return true; } });
    expect(seen).not.toContain('far');
  });
});

describe('after the chain', () => {
  it('chainHearers wakes unaware goons within 8 m that were not in the chain', () => {
    const a = goon('a', 1, 0, { aware: false }), b = goon('b', 7, 0, { aware: false }), c = goon('c', 9, 0, { aware: false }), d = goon('d', 2, 0);
    expect(chainHearers(O, [a, b, c, d], [a]).map((e) => e.id)).toEqual(['b']);
  });
  it('tiedGroup is everyone still tied with the goon that was hit', () => {
    const a = goon('a', 0, 0, { state: 'tied', down: true }), b = goon('b', 1, 0, { state: 'tied', down: true }), c = goon('c', 2, 0, { state: 'ko', alive: false });
    a.tiedWith = [b, c]; b.tiedWith = [a, c];
    expect(tiedGroup(a).map((e) => e.id)).toEqual(['a', 'b']);
    expect(tiedGroup(goon('free', 0, 0))).toEqual([]);
  });
  it('chainOutcome knocks out goons and only knocks down brutes', () => {
    expect(chainOutcome(goon('g', 0, 0))).toBe('ko');
    expect(chainOutcome(brute('b', 0, 0))).toBe('knockdown');
  });
  it('chainHudKey changes only when what the icons show changes', () => {
    expect(chainHudKey({ show: false, stealth: false, affordable: [true, false, false] })).toBe('off');
    expect(chainHudKey({ show: true, stealth: false, affordable: [true, false, false] })).toBe('c100');
    expect(chainHudKey({ show: true, stealth: true, affordable: [true, true, true] })).toBe('s111');
  });
});

describe('lunge maths', () => {
  it('strikeSpot stops short on the line to the target, or stays put when already close', () => {
    expect(strikeSpot(O, { x: 5, y: 0, z: 0 }, 1)).toEqual({ x: 4, y: 0, z: 0 });
    expect(strikeSpot(O, { x: 0.5, y: 0, z: 0 }, 1)).toEqual({ x: 0, y: 0, z: 0 });
  });
  it('midSpot, pileCenter and backSpot', () => {
    expect(midSpot({ x: 0, y: 0, z: 0 }, { x: 4, y: 1, z: 2 })).toEqual({ x: 2, y: 0, z: 1 });
    expect(pileCenter([{ x: 0, y: 1, z: 0 }, { x: 3, y: 0, z: 3 }, { x: 0, y: 0, z: 3 }])).toEqual({ x: 1, y: 0, z: 2 });
    const b = backSpot(O, { x: 0, y: 0, z: 10 }, 3);
    expect(b.x).toBeCloseTo(0);
    expect(b.z).toBeCloseTo(3);
  });
  it('lungePoint runs from start to end with the arc at the middle', () => {
    const a = { x: 0, y: 0, z: 0 }, b = { x: 4, y: 0, z: 0 };
    expect(lungePoint(a, b, 0, 2)).toEqual({ x: 0, y: 0, z: 0 });
    expect(lungePoint(a, b, 1, 2)).toMatchObject({ x: 4, z: 0 });
    expect(lungePoint(a, b, 1, 2).y).toBeCloseTo(0);
    expect(lungePoint(a, b, 0.5, 2).y).toBeCloseTo(2);
    expect(lungePoint(a, b, 0.5, 0).x).toBeCloseTo(3);                  // eases out
    expect(lungePoint(a, b, 0.5, 0, undefined, 'in').x).toBeCloseTo(1); // dives ease in
    expect(lungePoint(a, b, 2, 0).x).toBe(4);                           // clamped
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/chains.test.js`
Expected: FAIL. `src/combat/chains.js` does not exist yet.

- [ ] **Step 3: Add `take` to the combo.** In `src/combat/combo.js`, add this next to `spend: reset,`:

```js
    // A chain takedown spends part of the combo and keeps the rest (the timeout restarts).
    take(n) { value = Math.max(0, value - n); if (value === 0) reset(); else clock = timeout; },
```

- [ ] **Step 4: Write `src/combat/chains.js`**

```js
// Chain takedowns: which chains are available, who gets chained, what they cost, and the lunge
// maths the chain control moves Batman with. Pure: no three.js, positions are plain { x, y, z }.

export const CHAINS = [
  { n: 1, id: 'rope', name: 'Rope-a-Dope', cost: 6, action: 'chain1' },
  { n: 2, id: 'head', name: 'Headbanger', cost: 9, action: 'chain2' },
  { n: 3, id: 'domino', name: 'Domino Drop', cost: 12, action: 'chain3' },
];

export const CHAIN_RULES = {
  stealthRadius: 6, // two unaware goons this close make every chain free and silent
  stealthMin: 2,
  reach: 9,         // chain targets are within this distance
  maxRise: 1.2,     // and on the same floor
  maxTargets: 3,
  minTargets: 2,
  hearRadius: 8,    // a silent chain still wakes unaware goons this close
  tiedTime: 6,      // seconds a Rope-a-Dope bundle stays tied
};

export const chainForAction = (action) => CHAINS.find((c) => c.action === action) ?? null;
export const chainCost = (chain, discount = 0) => Math.max(1, chain.cost - discount);

const planar = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const byId = (a, b) => String(a.id).localeCompare(String(b.id));
const inRange = (origin, e, radius, maxRise) => Math.abs(e.pos.y - origin.y) <= maxRise && planar(origin, e.pos) <= radius;

// A goon that can be pulled into a chain: standing, not flying, not already held, not the boss.
export function chainEligible(e) {
  if (!e || !e.alive || e.down || e.air) return false;
  if (e.def?.boss || e.type === 'joker') return false;
  return e.state !== 'grabbed' && e.state !== 'chained' && e.state !== 'tied';
}

export function stealthChainReady(origin, enemies, { radius = CHAIN_RULES.stealthRadius, min = CHAIN_RULES.stealthMin, maxRise = CHAIN_RULES.maxRise } = {}) {
  let n = 0;
  for (const e of enemies) if (chainEligible(e) && !e.aware && inRange(origin, e, radius, maxRise)) n += 1;
  return n >= min;
}

// What the HUD shows and what the keys can start. No raycasts here: line of sight is checked
// only when a chain actually starts (selectChainTargets).
export function chainAvailability({ combo, origin, enemies, discount = 0 }) {
  const stealth = stealthChainReady(origin, enemies);
  let near = 0, leaders = 0;
  for (const e of enemies) {
    if (!chainEligible(e) || (stealth && e.aware) || !inRange(origin, e, CHAIN_RULES.reach, CHAIN_RULES.maxRise)) continue;
    near += 1;
    if (!e.def?.armored) leaders += 1;
  }
  const enough = near >= CHAIN_RULES.minTargets && leaders >= 1;
  const costs = CHAINS.map((c) => chainCost(c, discount));
  return {
    show: stealth || combo >= Math.min(...costs),
    stealth,
    affordable: costs.map((cost) => enough && (stealth || combo >= cost)),
    costs,
  };
}

// Combo left after starting `chain`: stealth chains are free, fight chains spend their cost.
export function comboAfter(combo, chain, { stealth = false, discount = 0 } = {}) {
  return stealth ? combo : Math.max(0, combo - chainCost(chain, discount));
}

// Up to 3 goons within reach and in sight. The first is the closest non-brute, favouring the
// direction Batman faces (or the stick). Each next one is the closest to the previous, so the
// path hops goon to goon instead of zigzagging. Returns null with fewer than 2.
export function selectChainTargets(origin, facing, enemies, {
  canSee = () => true, reach = CHAIN_RULES.reach, max = CHAIN_RULES.maxTargets, min = CHAIN_RULES.minTargets,
  maxRise = CHAIN_RULES.maxRise, onlyUnaware = false,
} = {}) {
  const pool = enemies.filter((e) => chainEligible(e) && (!onlyUnaware || !e.aware) && inRange(origin, e, reach, maxRise) && canSee(e));
  if (pool.length < min) return null;
  const fl = Math.hypot(facing?.x ?? 0, facing?.z ?? 0);
  const score = (e) => {
    const dx = e.pos.x - origin.x, dz = e.pos.z - origin.z, d = Math.hypot(dx, dz);
    const cos = fl > 0.2 && d > 1e-6 ? (dx * facing.x + dz * facing.z) / (d * fl) : 0;
    return d - cos * 1.5;
  };
  const leaders = pool.filter((e) => !e.def?.armored).sort((a, b) => score(a) - score(b) || byId(a, b));
  if (!leaders.length) return null;
  const path = [leaders[0]];
  const rest = pool.filter((e) => e !== leaders[0]);
  while (path.length < max && rest.length) {
    const last = path[path.length - 1].pos;
    rest.sort((a, b) => planar(last, a.pos) - planar(last, b.pos) || byId(a, b));
    path.push(rest.shift());
  }
  return path.length >= min ? path : null;
}

// Unaware goons close enough to hear a silent chain (the ones in the chain don't count).
export function chainHearers(origin, enemies, chained, radius = CHAIN_RULES.hearRadius) {
  return enemies.filter((e) => e.alive && !e.aware && !chained.includes(e) && planar(origin, e.pos) <= radius && Math.abs(e.pos.y - origin.y) <= 4);
}

// Everyone tied up with `e` who is still tied, e included: one hit knocks them all out.
export function tiedGroup(e) {
  if (!e || e.state !== 'tied') return [];
  return [e, ...(e.tiedWith ?? [])].filter((p, i, all) => p.alive && p.state === 'tied' && all.indexOf(p) === i);
}

// How a chain (or a hit on a tied bundle) ends for one goon: knocked out, or only knocked down
// for an armored brute. The Joker is never chained, so never gets here.
export const chainOutcome = (e) => (e.def?.armored ? 'knockdown' : 'ko');

export function chainHudKey({ show, stealth, affordable }) {
  return show ? `${stealth ? 's' : 'c'}${affordable.map((a) => (a ? 1 : 0)).join('')}` : 'off';
}

// ---- lunge maths ----

// Where Batman stands to strike `target` from `from`: on the line between them, `stop` short.
export function strikeSpot(from, target, stop) {
  const dx = target.x - from.x, dz = target.z - from.z;
  const d = Math.hypot(dx, dz);
  if (d <= stop || d < 1e-6) return { x: from.x, y: from.y, z: from.z };
  const k = (d - stop) / d;
  return { x: from.x + dx * k, y: from.y, z: from.z + dz * k };
}

export const midSpot = (a, b) => ({ x: (a.x + b.x) / 2, y: Math.min(a.y, b.y), z: (a.z + b.z) / 2 });

export function pileCenter(points) {
  let x = 0, z = 0, y = Infinity;
  for (const p of points) { x += p.x; z += p.z; y = Math.min(y, p.y); }
  return { x: x / points.length, y, z: z / points.length };
}

// A spot `dist` from `center` on the side `from` is on (where Batman steps back to throw a line).
export function backSpot(center, from, dist) {
  const dx = from.x - center.x, dz = from.z - center.z, d = Math.hypot(dx, dz);
  const ux = d > 1e-6 ? dx / d : 0, uz = d > 1e-6 ? dz / d : 1;
  return { x: center.x + ux * dist, y: from.y, z: center.z + uz * dist };
}

// A point along a lunge: eased across the ground ('out' for lunges, 'in' for dives) plus an arc
// of `arc` metres at the middle.
export function lungePoint(from, to, k, arc = 0, out = { x: 0, y: 0, z: 0 }, ease = 'out') {
  const c = Math.min(1, Math.max(0, k));
  const e = ease === 'in' ? c * c : 1 - (1 - c) * (1 - c);
  out.x = from.x + (to.x - from.x) * e;
  out.z = from.z + (to.z - from.z) * e;
  out.y = from.y + (to.y - from.y) * (ease === 'in' ? e : c) + arc * Math.sin(c * Math.PI);
  return out;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/chains.test.js tests/unit/combat.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/combat/chains.js src/combat/combo.js tests/unit/chains.test.js
git commit -m "Chain takedown rules: availability, costs, targets, lunge maths"
```

---

### Task 2: Chain step timelines (pure)

**Files:**
- Create: `src/combat/chainTimeline.js`
- Test: `tests/unit/chainTimeline.test.js`

**Interfaces:**
- Consumes: nothing. Kick beats (`KICK_BEATS`, `MOCAP_BEATS`) are passed in by the caller.
- Produces: `EFFECTS`, `STOCK_BEATS`, `CHAIN_BEATS`, `buildChainTimeline(id, count, beats)`, `chainClipNames()`, and the Step shape (see Shared interfaces).

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/chainTimeline.test.js
import { describe, it, expect } from 'vitest';
import { buildChainTimeline, chainClipNames, CHAIN_BEATS, STOCK_BEATS, EFFECTS } from '../../src/combat/chainTimeline.js';

const BEATS = { Kick_Front: { duration: 0.66, contact: 0.29 }, Kick_Flying: { duration: 0.7, contact: 0.3 } };
const ALL = { ...STOCK_BEATS, ...CHAIN_BEATS, ...BEATS };
const build = (id, n) => buildChainTimeline(id, n, BEATS);

describe('every chain timeline', () => {
  for (const id of ['rope', 'head', 'domino']) for (const n of [2, 3]) {
    it(`${id} with ${n} targets is well formed`, () => {
      const tl = build(id, n);
      expect(tl.count).toBe(n);
      let start = 0;
      for (const s of tl.steps) {
        expect(s.start).toBeCloseTo(start);
        expect(s.target === 'pile' || (Number.isInteger(s.target) && s.target < n)).toBe(true);
        expect(s.contact).toBeGreaterThanOrEqual(s.lunge);
        expect(s.clipStart).toBeGreaterThanOrEqual(0);
        expect(s.clipStart).toBeLessThanOrEqual(s.contact + 1e-9);
        expect(s.dur).toBeGreaterThanOrEqual(s.contact);
        expect(s.effect === null || EFFECTS.includes(s.effect)).toBe(true);
        expect(s.word ?? '').not.toContain('—');
        start += s.dur;
      }
      expect(tl.duration).toBeCloseTo(start);
      expect(tl.duration).toBeGreaterThan(1);
      expect(tl.duration).toBeLessThan(3);
      const fin = tl.steps.filter((s) => s.finisher);
      expect(fin.length).toBe(1);
      expect(fin[0].hitStop).toBeGreaterThanOrEqual(0.12);
      expect(fin[0].word).toBeTruthy();
    });
  }

  it('starts each authored clip so its contact frame lands on the step contact', () => {
    for (const id of ['rope', 'head', 'domino']) for (const s of build(id, 3).steps) {
      const b = s.clip && ALL[s.clip];
      if (!b || !s.effect) continue;
      const beat = s.beat ? b[s.beat] : b.contact;
      expect(s.clipStart + beat / s.speed, `${id} ${s.clip}`).toBeCloseTo(s.contact, 6);
    }
  });
});

describe('Rope-a-Dope', () => {
  it('strikes each goon in order, fires the line, yanks, then ties them as the finisher', () => {
    const tl = build('rope', 3);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stagger', 'stagger', 'stagger', 'tether', 'yank', 'tie']);
    expect(tl.steps.slice(0, 3).map((s) => s.target)).toEqual([0, 1, 2]);
    expect(tl.steps[3]).toMatchObject({ clip: 'OverhandThrow', at: 'back', target: 'pile' });
    expect(tl.steps.at(-1)).toMatchObject({ effect: 'tie', finisher: true, word: 'TANGLED!' });
  });
  it('uses only as many strikes as there are goons', () => {
    expect(build('rope', 2).steps.filter((s) => s.effect === 'stagger').length).toBe(2);
  });
});

describe('Headbanger', () => {
  it('grabs between the first two and smashes their heads together as the finisher', () => {
    const tl = build('head', 2);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stagger', 'grab', 'headSmash']);
    expect(tl.steps[1]).toMatchObject({ target: 1, at: 'between', clip: 'Chain_GrabHeads' });
    expect(tl.steps[2]).toMatchObject({ word: 'KONK!', finisher: true, clip: null });
  });
  it('the smash lands on the grab clip contact frame', () => {
    const [, grab, smash] = build('head', 2).steps;
    expect(grab.dur - grab.clipStart + smash.contact).toBeCloseTo(CHAIN_BEATS.Chain_GrabHeads.contact, 6);
  });
  it('flips over the pile into a heel strike on a third goon', () => {
    const tl = build('head', 3);
    const heel = tl.steps.at(-1);
    expect(heel).toMatchObject({ target: 2, effect: 'heel', clip: 'Kick_Flying', finisher: false });
    expect(heel.arc).toBeGreaterThan(1);
    expect(heel.contact).toBeCloseTo(heel.lunge);
    expect(tl.steps.find((s) => s.finisher).effect).toBe('headSmash');
  });
});

describe('Domino Drop', () => {
  it('stomps every head in order, bounces high, then dive-bombs the pile', () => {
    const tl = build('domino', 3);
    expect(tl.steps.map((s) => s.effect)).toEqual(['stomp', 'stomp', 'stomp', null, 'diveBomb']);
    expect(tl.steps.slice(0, 3).map((s) => [s.target, s.at])).toEqual([[0, 'head'], [1, 'head'], [2, 'head']]);
    for (const s of tl.steps.slice(0, 3)) expect(s.contact).toBeCloseTo(s.lunge);
    expect(tl.steps[3]).toMatchObject({ at: 'apex', target: 'pile' });
    expect(tl.steps[3].stop).toBeGreaterThan(4);
    expect(tl.steps[4]).toMatchObject({ at: 'pile', ease: 'in', word: 'KA-BLAM!', finisher: true, thenClip: 'NinjaJump_Land' });
  });
});

describe('limits and clip list', () => {
  it('uses at most 3 targets and refuses fewer than 2 or an unknown chain', () => {
    expect(build('rope', 5).count).toBe(3);
    expect(() => build('rope', 1)).toThrow();
    expect(() => build('swarm', 3)).toThrow();
  });
  it('chainClipNames lists every hero clip any chain plays', () => {
    const names = chainClipNames();
    for (const n of ['Chain_GrabHeads', 'Chain_Yank', 'Chain_Stomp', 'OverhandThrow', 'Kick_Flying', 'NinjaJump_Land', 'Dive']) expect(names).toContain(n);
    expect(new Set(names).size).toBe(names.length);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/chainTimeline.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/combat/chainTimeline.js`**

```js
// The beats of each chain takedown, as data. Pure: no three.js. chainControl.js plays them.
//
// A step:
//   target    index into the chain's targets, or 'pile' (the middle of all of them)
//   at        where Batman goes: 'strike' (stop short of the target), 'between' (midway between
//             targets 0 and 1), 'head' (on top of the target's head), 'back' (step back from the
//             pile), 'apex' (high above the pile), 'pile' (down onto it), 'stay'
//   lunge     seconds to get there (0 = no move); arc: metres of hop at the middle of the lunge
//   stop      metres short of the target ('strike'), from the pile ('back'), or apex height
//   ease      'out' for lunges, 'in' for dives
//   clip      Batman's clip for the step (null keeps the current one), speed: its playback rate
//   clipStart seconds into the step the clip starts, so its contact frame lands on `contact`
//   contact   seconds into the step the effect lands; hitStop: the freeze at contact
//   effect    see EFFECTS, or null for a pure move; word: sound word at contact
//   finisher  the one step that gets the slow-motion action shot
//   thenClip  a clip to play at contact (the landing after the dive)
//   dur       seconds from this step's start to the next one's; start: offset in the chain

export const EFFECTS = ['stagger', 'tether', 'yank', 'tie', 'grab', 'headSmash', 'heel', 'stomp', 'diveBomb'];

// Contact frames of the stock clips the chains use, in clip seconds at speed 1 (read off the
// contact sheets; the kicks' own beats come from kicks.js and mocap.js through `beats`).
export const STOCK_BEATS = {
  Punch_Cross: { contact: 0.2 },
  Melee_Hook: { contact: 0.24 },
  OverhandThrow: { contact: 0.27 },
};

// The code-authored chain clips (src/actors/chainAnims.js builds them to these beats).
export const CHAIN_BEATS = {
  Chain_GrabHeads: { duration: 0.8, grab: 0.16, contact: 0.4 },
  Chain_Yank: { duration: 0.7, contact: 0.2 },
  Chain_Stomp: { duration: 0.45, contact: 0.16 },
};

const DEFAULTS = {
  target: 0, at: 'stay', lunge: 0, arc: 0, stop: 0, ease: 'out', clip: null, speed: 1, beat: null,
  hitStop: 0, effect: null, word: null, finisher: false, thenClip: null, after: 0,
};

function step(beats, spec) {
  const s = { ...DEFAULTS, ...spec };
  const b = s.clip ? beats[s.clip] : null;
  const clipContact = b ? (s.beat ? b[s.beat] : b.contact) / s.speed : 0;
  const contact = spec.contact ?? Math.max(s.lunge + 0.02, clipContact);
  // Clips without a beat just start with the step.
  const clipStart = b ? Math.max(0, contact - clipContact) : 0;
  return { ...s, contact, clipStart, dur: contact + s.after };
}

const ROPE_STRIKES = [['Punch_Cross', 1.8], ['Kick_Front', 2.0], ['Melee_Hook', 1.9]];

function rope(n, beats) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    const [clip, speed] = ROPE_STRIKES[i];
    steps.push(step(beats, { target: i, at: 'strike', lunge: 0.14, stop: 1.0, clip, speed, effect: 'stagger', hitStop: 0.05, after: 0.1 }));
  }
  steps.push(step(beats, { target: 'pile', at: 'back', lunge: 0.2, stop: 3.2, clip: 'OverhandThrow', speed: 1.7, effect: 'tether', word: 'THWIP!', after: 0.28 }));
  steps.push(step(beats, { target: 'pile', clip: 'Chain_Yank', effect: 'yank', after: 0.18 }));
  steps.push(step(beats, { target: 'pile', contact: 0, effect: 'tie', hitStop: 0.14, word: 'TANGLED!', finisher: true, after: 0.55 }));
  return steps;
}

function head(n, beats) {
  const g = CHAIN_BEATS.Chain_GrabHeads;
  const steps = [
    step(beats, { target: 0, at: 'strike', lunge: 0.14, stop: 1.0, clip: 'Punch_Cross', speed: 1.9, effect: 'stagger', hitStop: 0.05, after: 0.08 }),
    step(beats, { target: 1, at: 'between', lunge: 0.16, clip: 'Chain_GrabHeads', beat: 'grab', effect: 'grab' }),
    // The grab clip keeps playing: the smash lands on its own contact frame.
    step(beats, { target: 1, contact: g.contact - g.grab, effect: 'headSmash', hitStop: 0.16, word: 'KONK!', finisher: true, after: n >= 3 ? 0.22 : 0.5 }),
  ];
  if (n >= 3) {
    steps.push(step(beats, { target: 2, at: 'strike', lunge: 0.34, arc: 1.5, stop: 0.9, clip: 'Kick_Flying', speed: 1.2, contact: 0.34, effect: 'heel', hitStop: 0.12, word: 'THWACK!', after: 0.45 }));
  }
  return steps;
}

function domino(n, beats) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    const lunge = i === 0 ? 0.3 : 0.26;
    steps.push(step(beats, { target: i, at: 'head', lunge, arc: 1.4, clip: 'Chain_Stomp', contact: lunge, effect: 'stomp', hitStop: 0.07, word: i % 2 ? 'KLONK!' : 'BONK!', after: 0.04 }));
  }
  steps.push(step(beats, { target: 'pile', at: 'apex', lunge: 0.38, stop: 5.5, clip: 'NinjaJump_Start', speed: 1.3, contact: 0.38, after: 0.08 }));
  steps.push(step(beats, { target: 'pile', at: 'pile', lunge: 0.2, ease: 'in', clip: 'Dive', contact: 0.2, effect: 'diveBomb', hitStop: 0.16, word: 'KA-BLAM!', finisher: true, thenClip: 'NinjaJump_Land', after: 0.5 }));
  return steps;
}

const BUILDERS = { rope, head, domino };

export function buildChainTimeline(id, count, beats = {}) {
  if (!BUILDERS[id]) throw new Error(`Unknown chain ${id}`);
  if (count < 2) throw new Error('A chain needs at least 2 targets');
  const n = Math.min(3, count);
  const steps = BUILDERS[id](n, { ...STOCK_BEATS, ...CHAIN_BEATS, ...beats });
  let t = 0;
  for (const s of steps) { s.start = t; t += s.dur; }
  return { id, count: n, steps, duration: t };
}

// Every clip a chain plays on Batman (primed on his mixer at run start).
export function chainClipNames() {
  const names = new Set();
  for (const id of Object.keys(BUILDERS)) {
    for (const s of buildChainTimeline(id, 3).steps) {
      if (s.clip) names.add(s.clip);
      if (s.thenClip) names.add(s.thenClip);
    }
  }
  return [...names];
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/chainTimeline.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/combat/chainTimeline.js tests/unit/chainTimeline.test.js
git commit -m "Chain takedown timelines as data"
```

---

### Task 3: Enemy states `chained` and `tied`, and the tied bundle knockout

**Files:**
- Modify: `src/actors/enemy.js`
- Modify: `src/combat/combatSystem.js` (`finishTarget`, `breakTied`, the `landHit` hook)

**Interfaces:**
- Consumes: `tiedGroup` and `chainOutcome` (Task 1).
- Produces: `e.chainHold()`, `e.chainRelease()`, `e.tie(partners, seconds)`, `e.tiedWith`, `e.tiedT`, the `chained` and `tied` states, and `finishTarget(e, { power, launch }) -> outcome | null` inside combatSystem (Task 9 hands it to the chain `api`). Event `tiedBreak { count }`.

- [ ] **Step 1: Add the fields and methods in `src/actors/enemy.js`.** In the `e` object literal, after `glyph: null,`, add:

```js
    tiedWith: null, tiedT: 0,
```

After `e.wake = ...`, add:

```js
  // Chain takedowns (src/combat/chainControl.js) hold a goon in place: no AI, no physics; the
  // chain moves and animates it. Returns whether it was mid-attack (the caller frees its
  // director slot).
  e.chainHold = () => {
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.knock.set(0, 0, 0);
    e.vel.set(0, 0, 0);
    setState('chained');
    return was;
  };
  e.chainRelease = () => { if (e.state === 'chained') setState(e.aware ? 'engage' : 'idle'); };

  // Rope-a-Dope: tied up with `partners` for `seconds`. Down and helpless; any hit on one of
  // them knocks the whole bundle out (combatSystem's landHit). Returns whether it was mid-attack.
  e.tie = (partners, seconds = 6) => {
    if (!e.alive) return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.stunned = false;
    e.down = true;
    e.tiedWith = partners.filter((p) => p !== e);
    e.tiedT = seconds;
    setState('tied');
    play('Hit_Knockback', { once: true, timeScale: 1.3, fade: 0.05 });
    return was;
  };
```

- [ ] **Step 2: States in `e.update`.** Replace the line `if (e.state === 'grabbed') { ch.animator.update(dt); return; }` with:

```js
    if (e.state === 'grabbed' || e.state === 'chained') {
      // Failsafe: a chain that never finished (a teleport, a restart) lets go after 5 s.
      if (e.state === 'chained' && e.t > 5) e.chainRelease();
      ch.animator.update(dt);
      return;
    }
```

In the `switch`, add a case before `case 'ko':`:

```js
      case 'tied':
        e.tiedT -= dt;
        if (e.tiedT <= 0) { e.tiedWith = null; setState('getup'); play('LayToIdle', { once: true, timeScale: 1.4, fade: 0.1 }); }
        break;
```

Change the `getup` case, so a goon that was taken down unaware comes up alert:

```js
      case 'getup':
        if (e.t > 1.0) { e.down = false; if (e.aware) setState('engage'); else e.wake(); }
        break;
```

In the air branch's landing, keep a tied goon tied. Change `if (e.alive && e.state !== 'ko') {` to:

```js
        if (e.alive && e.state !== 'ko' && e.state !== 'tied') { e.down = true; e.downT = Math.max(e.downT, 1.6); setState('down'); }
```

- [ ] **Step 3: Knock out a tied bundle in `src/combat/combatSystem.js`.** Add to the imports:

```js
import { tiedGroup, chainOutcome } from './chains.js';
```

Add these two functions right after `landHit`:

```js
  // One goon's part in a chain (or a tied bundle) ends: knocked out, or only knocked down for a
  // brute. Same bookkeeping as landHit: director slot, combo, impact and ko events.
  function finishTarget(e, { power = 1, launch = 0 } = {}) {
    if (!e.alive) return null;
    const outcome = chainOutcome(e);
    if (outcome === 'ko') e.health = 0;
    e.tiedWith = null;
    e.applyHit({ outcome, damage: 0, stun: 0 }, hero.pos, { power, launch });
    director.release(e.id);
    combo.hit();
    e.ch.headWorld(chest, -0.3);
    events.emit('impact', { pos: chest.clone(), move: 'chain', outcome, target: e, crit: false });
    if (outcome === 'ko') events.emit('ko', { target: e });
    return outcome;
  }

  // Any hit on a tied goon knocks the whole bundle out (brutes only go down).
  function breakTied(target) {
    const group = tiedGroup(target);
    let kos = 0;
    for (const e of group) if (finishTarget(e, { power: 1.4, launch: 2.5 }) === 'ko') kos += 1;
    time.hitStop(0.12);
    follow.addShake(0.18);
    target.ch.headWorld(chest, 0.2);
    events.emit('word', { text: 'KAPOW!', pos: chest.clone(), big: true });
    events.emit('tiedBreak', { count: group.length });
    critical(target, { slow: 0.6, scale: 0.3, variant: 'rope' });
    if (kos && engaged().length === 0) events.emit('lastHit', { target });
    return { outcome: kos ? 'ko' : 'knockdown', damage: 0, stun: 0 };
  }
```

Make the first line of `landHit`:

```js
    if (target.state === 'tied') return breakTied(target);
```

This one hook covers punches and kicks (`selectTarget` with `allowDown` already reaches downed goons), the cape, a thrown goon and the special. The shockwave and the dive skip downed goons, so they never reach it.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS (no test touches these paths yet; this checks nothing broke).

- [ ] **Step 5: Check it in the game.** Build and preview (see Global Constraints), then run:

```bash
cat > "$TEMP/chain-t3.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.combat ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, [a, b] = G.enemies; a.tie([a, b], 6); b.tie([a, b], 6); [a.state, b.state]", "wait": 800},
 {"eval": "const G = window.__game, a = G.enemies[0]; G.hero.teleport({ x: a.pos.x, y: a.pos.y, z: a.pos.z + 1.5 }, Math.PI); 'beside a'", "wait": 300},
 {"shot": "t3-tied"},
 {"click": 0, "wait": 1200},
 {"eval": "window.__game.enemies.slice(0, 2).map((e) => [e.id, e.state, e.alive])"},
 {"eval": "const G = window.__game, [, , c, d] = G.enemies; c.tie([c, d], 1); d.tie([c, d], 1); 'short tie'", "wait": 2600},
 {"eval": "window.__game.enemies.slice(2, 4).map((e) => [e.id, e.state, e.down])"},
 {"eval": "const e = window.__game.enemies[4]; e.chainHold(); e.state", "wait": 5600},
 {"eval": "window.__game.enemies[4].state"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-t3.json")"
```

Expected:
- The first eval prints `["tied","tied"]`.
- The teleport puts Batman 1.5 m from the first goon, facing it. After the click, both are `["ko", false]`: one punch knocked out the pair.
- The short tie ends in `getup` or `engage` with `down` false.
- The held brute prints `chained`, and then `engage` after the 5 s failsafe.
- The output ends with `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/actors/enemy.js src/combat/combatSystem.js
git commit -m "Tied and chained enemy states; one hit knocks out a tied bundle"
```

---

### Task 4: Code-authored chain clips

**Files:**
- Create: `src/actors/chainAnims.js`
- Modify: `src/actors/animator.js` (`prime`)
- Modify: `src/game/game.js` (register the clips at boot, prime at run start)
- Modify: `tools/pose-viewer.js` (build the chain clips for contact sheets)
- Test: `tests/unit/chainAnims.test.js`, `tests/unit/actors.test.js`

**Interfaces:**
- Consumes: `CHAIN_BEATS` and `chainClipNames()` (Task 2), and `sampleRest`, `discoverFrames` and `compileClip` from `src/actors/poseAuthor.js`. That's the kicks' toolkit, built on the same numeric-axis idea as `rigTools.js`. The grab and the yank need forward and sideways swings on the same bone, which `rigTools.track` (one axis per bone) can't express.
- Produces: `CHAIN_CLIPS`, `buildChainClips(model, clips, fwd = 1)`, `animator.prime(names)`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/chainAnims.test.js
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { loadGlb } from '../../tools/rigNode.mjs';
import { sanitizeClip } from '../../src/actors/animator.js';
import { buildChainClips, CHAIN_CLIPS } from '../../src/actors/chainAnims.js';
import { CHAIN_BEATS } from '../../src/combat/chainTimeline.js';

describe('buildChainClips', () => {
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
    built = new Map(buildChainClips(model, clips).map((c) => [c.name, c]));
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

  it('builds every clip at its beat length', () => {
    expect([...built.keys()]).toEqual(CHAIN_CLIPS);
    for (const [name, c] of built) expect(c.duration).toBeCloseTo(CHAIN_BEATS[name].duration, 6);
  });

  it('has no NaN and only unit quaternions', () => {
    for (const c of built.values()) for (const t of c.tracks) {
      expect(Array.from(t.values).some(Number.isNaN), `${c.name} ${t.name}`).toBe(false);
      if (t instanceof THREE.QuaternionKeyframeTrack) {
        for (let i = 0; i < t.values.length; i += 4) expect(Math.abs(Math.hypot(t.values[i], t.values[i + 1], t.values[i + 2], t.values[i + 3]) - 1)).toBeLessThan(1e-3);
      }
    }
  });

  it('Chain_GrabHeads opens wide at the grab and claps the hands together in front at contact', () => {
    const c = built.get('Chain_GrabHeads'), b = CHAIN_BEATS.Chain_GrabHeads;
    const open = at(c, b.grab, 'hand_l').distanceTo(at(c, b.grab, 'hand_r'));
    const l = at(c, b.contact, 'hand_l'), r = at(c, b.contact, 'hand_r'), chest = at(c, b.contact, 'spine_03');
    expect(open).toBeGreaterThan(1.0);
    expect(l.distanceTo(r)).toBeLessThan(0.3);
    expect((l.z + r.z) / 2 - chest.z).toBeGreaterThan(0.25);
  });

  it('Chain_Yank rips both hands back from the reach', () => {
    const c = built.get('Chain_Yank');
    for (const hand of ['hand_l', 'hand_r']) expect(at(c, 0.08, hand).z - at(c, CHAIN_BEATS.Chain_Yank.contact, hand).z).toBeGreaterThan(0.2);
  });

  it('Chain_Stomp drives both feet down from the tuck', () => {
    const c = built.get('Chain_Stomp');
    const drop = (t, foot) => at(c, t, 'pelvis').y - at(c, t, foot).y;
    for (const foot of ['foot_l', 'foot_r']) expect(drop(CHAIN_BEATS.Chain_Stomp.contact, foot) - drop(0.07, foot)).toBeGreaterThan(0.25);
  });

  it('starts and ends every clip on the idle pose', () => {
    const idle = clips.get('Idle_Loop');
    const idleQ = new Map(idle.tracks.filter((t) => t.name.endsWith('.quaternion')).map((t) => [t.name, Array.from(t.values.slice(0, 4))]));
    for (const c of built.values()) for (const t of c.tracks) {
      if (!idleQ.has(t.name)) continue;
      const q0 = new THREE.Quaternion(...idleQ.get(t.name));
      expect(Math.abs(new THREE.Quaternion(...t.values.slice(0, 4)).dot(q0)), `${c.name} ${t.name} start`).toBeGreaterThan(0.999);
      expect(Math.abs(new THREE.Quaternion(...t.values.slice(-4)).dot(q0)), `${c.name} ${t.name} end`).toBeGreaterThan(0.999);
    }
  });
});
```

Append to `tests/unit/actors.test.js` (add `createAnimator` to its animator import):

```js
describe('animator.prime', () => {
  it('builds actions up front and rejects unknown clips', () => {
    const root = new THREE.Object3D();
    const bone = new THREE.Bone();
    bone.name = 'pelvis';
    root.add(bone);
    const clip = new THREE.AnimationClip('A', 1, [new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
    const anim = createAnimator(root, new Map([['A', clip]]));
    anim.prime(['A']);
    expect(anim.mixer.existingAction(clip)).toBeTruthy();
    expect(() => anim.prime(['nope'])).toThrow();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/chainAnims.test.js tests/unit/actors.test.js`
Expected: FAIL (module and `prime` missing).

- [ ] **Step 3: Add `prime` to `src/actors/animator.js`**, next to `play` in the returned object:

```js
    // Creates the actions up front, so a clip's first play mid-fight doesn't build its bindings.
    prime(names) { for (const n of names) action(n); },
```

- [ ] **Step 4: Write `src/actors/chainAnims.js`**

```js
// Chain takedown clips authored in code on the shared skeleton, with the kicks' pose toolkit
// (poseAuthor.js: f = forward swing, s = sideways, tw = twist; +X is the character's left).
// Lengths and beats live in CHAIN_BEATS so the timelines and the clips can't drift apart.
import { sampleRest, discoverFrames, compileClip } from './poseAuthor.js';
import { CHAIN_BEATS } from '../combat/chainTimeline.js';

export const CHAIN_CLIPS = ['Chain_GrabHeads', 'Chain_Yank', 'Chain_Stomp'];

export function buildChainClips(model, clips, fwd = 1) {
  const rest = sampleRest(model, clips.get('Idle_Loop'), 0);
  const frames = discoverFrames(model, fwd);
  const make = (name, keys, plant = null) => compileClip(name, CHAIN_BEATS[name].duration, keys, { model, frames, rest, plant });
  const G = CHAIN_BEATS.Chain_GrabHeads;

  // Headbanger: arms fling out wide to both heads, close on them at the grab beat, pull apart a
  // touch, then drive both hands together in front of the chest for the smash.
  const grab = make('Chain_GrabHeads', [
    { t: 0.1, ease: 'out', spine_02: { f: -0.08 },
      upperarm_l: { f: 0.3, s: 1.35 }, lowerarm_l: { f: 0.25 }, upperarm_r: { f: 0.3, s: 1.35 }, lowerarm_r: { f: 0.25 } },
    { t: G.grab, ease: 'io',
      upperarm_l: { f: 0.55, s: 1.3 }, lowerarm_l: { f: 0.45 }, upperarm_r: { f: 0.55, s: 1.3 }, lowerarm_r: { f: 0.45 } },
    { t: 0.3, ease: 'in', spine_02: { f: -0.12 },
      upperarm_l: { f: 0.5, s: 1.45 }, lowerarm_l: { f: 0.35 }, upperarm_r: { f: 0.5, s: 1.45 }, lowerarm_r: { f: 0.35 } },
    { t: G.contact, ease: 'snap', spine_02: { f: 0.22 }, neck_01: { f: 0.1 },
      upperarm_l: { f: 1.35, s: -0.3 }, lowerarm_l: { f: 0.4 }, upperarm_r: { f: 1.35, s: -0.3 }, lowerarm_r: { f: 0.4 } },
    { t: G.contact + 0.08, hold: true, ease: 'lin' },
    { t: G.duration, ease: 'io' },
  ], 'ball_l');

  // Rope-a-Dope: both hands out in front on the line, then a two-handed heave back to the hips
  // with the torso leaning away and the weight sinking onto the front leg.
  const Y = CHAIN_BEATS.Chain_Yank;
  const yank = make('Chain_Yank', [
    { t: 0.08, ease: 'out', spine_02: { f: 0.15 },
      upperarm_l: { f: 1.3, s: -0.1 }, lowerarm_l: { f: 0.2 }, upperarm_r: { f: 1.3, s: -0.1 }, lowerarm_r: { f: 0.2 },
      thigh_l: { f: 0.3 }, calf_l: { f: 0.5 } },
    { t: Y.contact, ease: 'snap', pelvis: { f: -0.1 }, spine_01: { f: -0.2 }, spine_02: { f: -0.3 }, neck_01: { f: 0.15 },
      upperarm_l: { f: -0.2, s: 0.1 }, lowerarm_l: { f: 1.5 }, upperarm_r: { f: -0.2, s: 0.1 }, lowerarm_r: { f: 1.5 },
      thigh_l: { f: 0.5 }, calf_l: { f: 0.8 }, thigh_r: { f: 0.2 }, calf_r: { f: 0.5 } },
    { t: Y.contact + 0.1, hold: true, ease: 'lin' },
    { t: Y.duration, ease: 'io' },
  ], 'ball_l');

  // Domino Drop: knees tucked to the chest in the air, then both legs drive straight down onto
  // the head with the toes pointed, then fold again for the rebound. Airborne, so nothing planted.
  const S = CHAIN_BEATS.Chain_Stomp;
  const stomp = make('Chain_Stomp', [
    { t: 0.07, ease: 'out', spine_02: { f: 0.25 },
      thigh_l: { f: 1.7 }, calf_l: { f: 2.1 }, thigh_r: { f: 1.6 }, calf_r: { f: 2.0 },
      upperarm_l: { f: 0.4, s: 1.2 }, lowerarm_l: { f: 0.6 }, upperarm_r: { f: 0.4, s: 1.2 }, lowerarm_r: { f: 0.6 } },
    { t: S.contact, ease: 'snap', spine_02: { f: 0.05 },
      thigh_l: { f: 0.15 }, calf_l: { f: 0.1 }, foot_l: { f: 0.5 }, thigh_r: { f: 0.1 }, calf_r: { f: 0.1 }, foot_r: { f: 0.5 },
      upperarm_l: { f: 0.2, s: 1.4 }, upperarm_r: { f: 0.2, s: 1.4 } },
    { t: S.contact + 0.04, hold: true, ease: 'lin' },
    { t: 0.32, ease: 'io', thigh_l: { f: 1.1 }, calf_l: { f: 1.5 }, thigh_r: { f: 1.0 }, calf_r: { f: 1.4 }, foot_l: { f: 0.1 }, foot_r: { f: 0.1 } },
    { t: S.duration, ease: 'io' },
  ]);

  return [grab, yank, stomp];
}
```

- [ ] **Step 5: Run the tests. Tune the keys, not the thresholds.**

Run: `npx vitest run tests/unit/chainAnims.test.js tests/unit/actors.test.js`

If a pose check fails (for example, the hands are 0.34 m apart at the clap), change the key angles in `chainAnims.js`, such as more negative `s` on the upper arms, until it passes. The thresholds describe what the move must look like.

- [ ] **Step 6: Register and prime.** In `src/game/game.js`, add these imports:

```js
import { buildChainClips } from '../actors/chainAnims.js';
import { chainClipNames } from '../combat/chainTimeline.js';
```

Right after the `buildClimbClips` line, add:

```js
  for (const c of buildChainClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
```

In `buildRun`, right after `hero.teleport(SITES.start, ...)`, add:

```js
    // Every clip a chain takedown plays gets its mixer action now, not on the first chain.
    hero.bat.animator.prime(chainClipNames());
```

- [ ] **Step 7: Contact sheets.**
  - In `tools/pose-viewer.js`, import `buildChainClips` and `CHAIN_BEATS`.
  - After the `buildClimbClips` line, add `for (const c of buildChainClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);`.
  - Merge `...CHAIN_BEATS` into its `KICK_BEATS` object so the sheets mark the contact frame.

Then run:

```bash
node tools/kick-sheets.mjs "$TEMP/chain-sheets" --suits=m,f --views=side,front,quarter --frames=9 Chain_GrabHeads Chain_Yank Chain_Stomp
```

Look at the sheets. The grab must read as reaching for two heads and clapping, the yank as a two-handed heave, and the stomp as a tuck then a straight-legged drop. Also check the contact frames of `Punch_Cross`, `Melee_Hook` and `OverhandThrow`, and correct `STOCK_BEATS` in `chainTimeline.js` if the marked frame is off by more than 0.03 s:

```bash
node tools/kick-sheets.mjs "$TEMP/chain-sheets" --suits=m --views=side --frames=12 Punch_Cross Melee_Hook OverhandThrow
```

- [ ] **Step 8: Commit**

```bash
npx vitest run
git add src/actors/chainAnims.js src/actors/animator.js src/game/game.js tools/pose-viewer.js tests/unit/chainAnims.test.js tests/unit/actors.test.js src/combat/chainTimeline.js
git commit -m "Code-authored chain clips: grab heads, yank, stomp"
```

---

### Task 5: Ink tether FX and its warm-up

**Files:**
- Create: `src/game/chainFx.js`
- Modify: `src/game/warmCast.js`
- Modify: `src/game/game.js` (create it, put it on `ctx`, update it)
- Test: `tests/unit/chainFx.test.js`

**Interfaces:**
- Consumes: `PALETTE.ink`, `LAYER_FX`, and each goon's `ch.headWorld(out, lift)` and `ch.root.parent`.
- Produces: `createChainFx(scene)` returning `{ fire(fromFn, targets, dur), bind(members), clear(), update(dt), active }`, and `CHAIN_FX_MAX`. `ctx.chainFx` is available to combat moves.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/chainFx.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createChainFx, CHAIN_FX_MAX } from '../../src/game/chainFx.js';

const goon = (x, o = {}) => {
  const pos = new THREE.Vector3(x, 0, 0);
  return { pos, alive: true, state: 'chained', down: false, ch: { root: { parent: {} }, headWorld: (out, l = 0) => out.set(pos.x, 1.7 + l, pos.z) }, ...o };
};
const setup = () => { const scene = new THREE.Scene(); const fx = createChainFx(scene); return { fx, lines: scene.getObjectByName('chainTether') }; };
const hand = (o) => o.set(0, 1.4, 0);

describe('chainFx', () => {
  it('draws nothing until fired, then the line reaches every goon in turn', () => {
    const { fx, lines } = setup();
    fx.update(0.016);
    expect(lines.visible).toBe(false);
    fx.fire(hand, [goon(1), goon(3), goon(5)], 0.2);
    fx.update(0.05);
    const early = lines.geometry.drawRange.count;
    fx.update(0.3);
    const full = lines.geometry.drawRange.count;
    expect(lines.visible).toBe(true);
    expect(early).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(early);
  });
  it('keeps a tied bundle wrapped until its goons are knocked out', () => {
    const { fx, lines } = setup();
    const gs = [goon(1, { state: 'tied' }), goon(2, { state: 'tied' })];
    fx.bind(gs);
    fx.update(0.016);
    expect(lines.visible).toBe(true);
    for (const g of gs) { g.alive = false; g.state = 'ko'; }
    fx.update(0.016);
    expect(lines.visible).toBe(false);
    expect(fx.active).toBe(false);
  });
  it('drops goons that were despawned', () => {
    const { fx, lines } = setup();
    const gs = [goon(1, { state: 'tied' }), goon(2, { state: 'tied' })];
    fx.bind(gs);
    for (const g of gs) g.ch.root.parent = null;
    fx.update(0.016);
    expect(lines.visible).toBe(false);
  });
  it('lets a fired line fade when nothing gets tied', () => {
    const { fx, lines } = setup();
    fx.fire(hand, [goon(1), goon(2)], 0.2);
    fx.update(0.1);
    fx.update(2);
    expect(lines.visible).toBe(false);
  });
  it('never writes past its buffer', () => {
    const { fx, lines } = setup();
    for (let b = 0; b < 5; b++) fx.bind([goon(b, { state: 'tied' }), goon(b + 0.5, { state: 'tied' }), goon(b + 1, { state: 'tied' })]);
    fx.fire(hand, [goon(1), goon(2), goon(3)], 0.1);
    fx.update(0.5);
    expect(lines.geometry.drawRange.count).toBeLessThanOrEqual(CHAIN_FX_MAX);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/chainFx.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/game/chainFx.js`**

```js
// Ink lines for Rope-a-Dope: the grapple line flying from Batman's hand through each goon, then
// the wraps that hold a tied bundle together. One LineSegments on the FX layer (one draw call);
// the preallocated buffer is rewritten only while something shows.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';

export const CHAIN_FX_MAX = 256; // vertices
const LOOP = 8;                  // segments per wrap loop
const LINGER = 1.5;              // a fired line that never gets tied fades after this

export function createChainFx(scene) {
  const pos = new Float32Array(CHAIN_FX_MAX * 3);
  const attr = new THREE.BufferAttribute(pos, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', attr);
  // A zero-length segment at the origin, so the run-start prewarm draw compiles the program.
  geo.setDrawRange(0, 2);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
  lines.name = 'chainTether';
  lines.layers.set(LAYER_FX);
  lines.frustumCulled = false;
  lines.visible = false;
  scene.add(lines);

  const pa = new THREE.Vector3(), pb = new THREE.Vector3(), pc = new THREE.Vector3();
  const q0 = new THREE.Vector3(), q1 = new THREE.Vector3();
  let n = 0;
  let flying = null; // { from, targets, dur, t }
  const bundles = []; // { members }

  function seg(a, b) {
    if (n + 2 > CHAIN_FX_MAX) return;
    const i = n * 3;
    pos[i] = a.x; pos[i + 1] = a.y; pos[i + 2] = a.z;
    pos[i + 3] = b.x; pos[i + 4] = b.y; pos[i + 5] = b.z;
    n += 2;
  }
  // WebGL lines are 1 px; a second pass 3 cm higher reads as an inked stroke.
  function ink(a, b) {
    seg(a, b);
    q0.set(a.x, a.y + 0.03, a.z);
    q1.set(b.x, b.y + 0.03, b.z);
    seg(q0, q1);
  }
  function loop(c, r) {
    for (let k = 0; k < LOOP; k++) {
      const a0 = (k / LOOP) * Math.PI * 2, a1 = ((k + 1) / LOOP) * Math.PI * 2;
      q0.set(c.x + Math.cos(a0) * r, c.y + Math.sin(a0 * 2) * 0.06, c.z + Math.sin(a0) * r);
      q1.set(c.x + Math.cos(a1) * r, c.y + Math.sin(a1 * 2) * 0.06, c.z + Math.sin(a1) * r);
      seg(q0, q1);
    }
  }
  // The middle of the body, standing or lying: halfway between the feet and the head.
  function mid(e, out) {
    e.ch.headWorld(out, 0);
    return out.set((out.x + e.pos.x) / 2, Math.max(e.pos.y + 0.25, (out.y + e.pos.y) / 2), (out.z + e.pos.z) / 2);
  }
  const bound = (m) => m.alive && m.state === 'tied' && !!m.ch.root.parent;

  return {
    // The line flies from fromFn(out) through each target in turn over `dur` seconds.
    fire(from, targets, dur = 0.22) { flying = { from, targets, dur, t: 0 }; },
    // Wraps a tied bundle until every member is knocked out, gets up or is despawned.
    bind(members) { flying = null; bundles.push({ members }); if (bundles.length > 3) bundles.shift(); },
    clear() { flying = null; bundles.length = 0; n = 0; lines.visible = false; },
    get active() { return !!flying || bundles.length > 0; },
    update(dt) {
      if (!flying && !bundles.length) { if (lines.visible) lines.visible = false; return; }
      n = 0;
      if (flying) {
        flying.t += dt;
        if (flying.t > flying.dur + LINGER) flying = null;
        else {
          const legs = flying.targets.length;
          const reach = Math.min(1, flying.t / flying.dur) * legs;
          flying.from(pa);
          for (let j = 0; j < legs && reach > j; j++) {
            mid(flying.targets[j], pb);
            if (reach < j + 1) pb.lerpVectors(pa, pb, reach - j);
            else loop(pb, 0.3);
            ink(pa, pb);
            pa.copy(pb);
          }
        }
      }
      for (let b = bundles.length - 1; b >= 0; b--) {
        let have = false;
        for (const m of bundles[b].members) {
          if (!bound(m)) continue;
          mid(m, pb);
          loop(pb, 0.34);
          if (have) {
            ink(pc, pb);
            q0.set(pc.x, pc.y + 0.14, pc.z); q1.set(pb.x, pb.y - 0.1, pb.z); seg(q0, q1);
            q0.set(pc.x, pc.y - 0.1, pc.z); q1.set(pb.x, pb.y + 0.14, pb.z); seg(q0, q1);
          }
          pc.copy(pb);
          have = true;
        }
        if (!have) bundles.splice(b, 1);
      }
      geo.setDrawRange(0, n);
      attr.needsUpdate = true;
      lines.visible = n > 0;
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/chainFx.test.js`
Expected: PASS.

- [ ] **Step 5: Warm cast.** In `src/game/warmCast.js`, import `PALETTE` from `../config/palette.js` and `LAYER_FX` from `../render/layers.js`. Before `return group;`, add:

```js
  // The chain takedown's ink tether (src/game/chainFx.js): an FX-layer LineSegments in ink,
  // compiled here with everything else so the first Rope-a-Dope doesn't build a program.
  const tether = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0.5, 0)]),
    new THREE.LineBasicMaterial({ color: PALETTE.ink }),
  );
  tether.position.set((x += 2), -50, 0);
  tether.layers.set(LAYER_FX);
  group.add(tether);
```

- [ ] **Step 6: Wire it in `src/game/game.js`.**
  - Import `createChainFx`.
  - In `buildRun`, after `const fx = createFx(scene);`, add `const chainFx = createChainFx(scene);`.
  - Change the combat context to `const ctx = { input, cam: follow, grappleTarget: null, fx, chainFx };`.
  - In `update`, after `fx.update(dt);`, add `chainFx.update(dt);`.
  - Add `chainFx` to `api`.

- [ ] **Step 7: Commit**

```bash
npx vitest run
git add src/game/chainFx.js src/game/warmCast.js src/game/game.js tests/unit/chainFx.test.js
git commit -m "Ink tether lines for chain takedowns, pre-warmed"
```

---

### Task 6: Action camera framing, critical variants and shockwave options

**Files:**
- Modify: `src/game/camera.js`
- Modify: `src/combat/combatSystem.js` (`critical`, `shockwave`)
- Modify: `src/ui/hud.js`, `src/ui/style.css` (`hud.critical(variant)`)
- Modify: `src/game/game.js` (the `critical` and `diveImpact` listeners)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `follow.actionShot(focus, attacker, duration, { dist, lift, back })`
  - camera mode `chain`
  - `critical(target, { slow, scale, shot, variant })` emitting `critical { target, variant }`
  - `shockwave(center, radius, { crit = true, word })` emitting `diveImpact { pos, count, word }`
  - `hud.critical(variant)`

- [ ] **Step 1: Camera.** In `src/game/camera.js`, add a mode to `MODES`:

```js
  chain: { dist: 4.8, height: 1.6, side: 0.2, fov: 2 },
```

Replace the head of `actionShot` and its `action.pos.set(...)` line. The defaults keep today's framing:

```js
    actionShot(focus, attacker, duration = 0.9, { dist = 3.2, lift = -0.55, back = 1.2 } = {}) {
      ...
      action.pos.set(action.focus.x + px * side * dist - (dx / len) * back, focus.y + lift, action.focus.z + pz * side * dist - (dz / len) * back);
```

- [ ] **Step 2: `critical` and `shockwave`** in `src/combat/combatSystem.js`:

```js
  // A critical hit: slow motion, a big word, and an action camera shot from the side. `shot`
  // frames the camera (see follow.actionShot); `variant` picks the speed lines.
  function critical(target, { slow = 0.55, scale = 0.28, shot, variant } = {}) {
    time.slowMo(slow, scale);
    target.ch.headWorld(chest, -0.4);
    follow.actionShot?.(chest.clone(), hero.pos.clone(), slow + 0.35, shot);
    events.emit('critical', { target, variant });
  }
```

Change the `shockwave` signature to `function shockwave(center, radius = 4, { crit = true, word } = {})`. Change its two last statements to:

```js
    events.emit('diveImpact', { pos: center.clone(), count: n, word });
    if (first && crit) critical(first);
```

- [ ] **Step 3: HUD.** In `src/ui/hud.js`, replace `critical()` with:

```js
    // Comic speed lines burst on a critical hit; chain finishers pick their own ('rope', 'head', 'domino').
    critical(variant = '') {
      speedEl.className = 'hud-speed';
      void speedEl.offsetWidth;
      speedEl.className = `hud-speed on ${variant}`.trim();
    },
```

Add to `src/ui/style.css`, after `.hud-speed.on`:

```css
/* Chain finisher speed lines: ink for Rope-a-Dope, yellow for Headbanger, a longer burst for Domino Drop. */
.hud-speed.rope { background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(11,11,18,0) 0deg 3deg, rgba(11,11,18,0.6) 3deg 4.5deg, rgba(11,11,18,0) 4.5deg 9deg); }
.hud-speed.head { background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(242,210,75,0) 0deg 2deg, rgba(242,210,75,0.7) 2deg 4deg, rgba(242,210,75,0) 4deg 7deg); }
.hud-speed.domino.on { animation-duration: 1.1s; }
```

- [ ] **Step 4: Listeners in `src/game/game.js`.** Replace `events.on('critical', () => hud.critical());` with:

```js
    events.on('critical', ({ variant } = {}) => hud.critical(variant));
```

Replace the `diveImpact` word listener. A shockwave with `word: null` stays silent, because its caller shouts its own word:

```js
    events.on('diveImpact', ({ pos, word }) => { if (word !== null) events.emit('word', { text: word ?? 'KA-THOOM!', pos, big: true }); });
```

- [ ] **Step 5: Regression check.** Run `npx vitest run`. Then build and preview, and run the Plan 3B dive-bomb check: in `?fight=test&god=1`, teleport 25 m above the squad, start a glide, press `KeyE`, and take a screenshot at impact. Expected:
  - The goons are knocked down.
  - `KA-THOOM!` still appears.
  - The action camera fires with today's framing.
  - There are no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/camera.js src/combat/combatSystem.js src/ui/hud.js src/ui/style.css src/game/game.js
git commit -m "Action shot framing, critical speed-line variants, shockwave options"
```

---

### Task 7: The chain control

**Files:**
- Create: `src/combat/chainControl.js`
- Test: `tests/unit/chainControl.test.js`

**Interfaces:**
- Consumes:
  - From Task 1: `strikeSpot`, `midSpot`, `pileCenter`, `backSpot`, `lungePoint`, `chainHearers`.
  - From Task 2: timelines.
  - Hero: `hero.pos`, `vel`, `invulnerable`, `grounded`, `setState`, `cape.setWings`, `bat.face`, `bat.yaw`, `bat.tilt`, `bat.bone`, `bat.animator.play`.
  - Enemies: `pos`, `scale`, `radius`, `alive`, `ch.face`, `ch.headWorld`, `ch.animator.play`, `wake()`.
  - The `api` (see Shared interfaces). The real one is built in Task 9.
- Produces: `createChainControl(hero, api, { chain, targets, stealth, timeline })`, `CHAIN_SHOTS`. Events `chainContact`, `chainTether`, `chainYank`, `chainGrab`, `chainSmash`, `chainStomp`, `chainDone`.

- [ ] **Step 1: Write the failing tests** (fake hero, goons and api; no browser)

```js
// tests/unit/chainControl.test.js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createChainControl } from '../../src/combat/chainControl.js';
import { buildChainTimeline } from '../../src/combat/chainTimeline.js';
import { CHAINS } from '../../src/combat/chains.js';

function fakeGoon(id, x, z, o = {}) {
  const pos = new THREE.Vector3(x, 0, z);
  const g = {
    id, type: 'grunt', def: {}, alive: true, down: false, aware: true, state: 'engage', scale: 1, radius: 0.42, pos,
    ch: { face() {}, headWorld: (out, lift = 0) => out.set(pos.x, pos.y + 1.7 + lift, pos.z), animator: { play() {} } },
    wake() { g.aware = true; },
    ...o,
  };
  return g;
}
function fakeHero() {
  const bat = {
    yaw: 0, face(y) { bat.yaw = y; }, tilt: { rotation: { set() {} } },
    bone: () => ({ getWorldPosition: (o) => o.set(0, 1.4, 0) }),
    animator: { played: [], play(n) { bat.animator.played.push(n); } },
  };
  return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), invulnerable: 0, grounded: true, state: 'ground', cape: { setWings() {} }, bat, setState(s) { this.state = s; } };
}
function fakeApi(log, enemies) {
  const emitted = [];
  return {
    emitted,
    events: { emit: (n, d) => emitted.push([n, d]) },
    collision: { resolveCylinder: () => ({ groundY: 0, hitWall: false }), groundBelow: () => 0 },
    time: { hitStop: (s) => log.push(['hitStop', s]) },
    fx: null,
    enemies: () => enemies,
    hold: (e) => { e.state = 'chained'; log.push(['hold', e.id]); },
    release: (e) => { if (e.state === 'chained') e.state = 'engage'; },
    stagger: (e) => log.push(['stagger', e.id]),
    finish: (e) => { log.push(['finish', e.id, e.pos.clone()]); e.alive = false; e.state = 'ko'; return 'ko'; },
    tie: (list) => { for (const e of list) { e.state = 'tied'; e.down = true; } log.push(['tie', list.map((e) => e.id)]); },
    critical: (e, o) => log.push(['critical', e.id, o.variant, !!o.shot]),
    shockwave: (c, r, o) => { log.push(['shockwave', r, o]); return 0; },
    word: (text) => log.push(['word', text]),
  };
}
function run(id, targets, { stealth = false, others = [] } = {}) {
  const log = [];
  const hero = fakeHero();
  const api = fakeApi(log, [...targets, ...others]);
  const chain = CHAINS.find((c) => c.id === id);
  const ctl = createChainControl(hero, api, { chain, targets, stealth, timeline: buildChainTimeline(id, targets.length) });
  let frames = 0, maxY = 0, maxDist = 0, done = false;
  while (!done && frames++ < 600) {
    done = ctl.update(1 / 60);
    maxY = Math.max(maxY, hero.pos.y);
    maxDist = Math.max(maxDist, Math.hypot(hero.pos.x, hero.pos.z));
  }
  return { log, hero, api, ctl, done, maxY, maxDist };
}
const squad = () => [fakeGoon('g0', 0, 2), fakeGoon('g1', 1.5, 3.5), fakeGoon('g2', -1, 4.5)];
const of = (log, kind) => log.filter((l) => l[0] === kind);

describe('chain control', () => {
  it('is the hero control named chain with the chain camera', () => {
    const ctl = createChainControl(fakeHero(), fakeApi([], []), { chain: CHAINS[0], targets: squad(), stealth: false, timeline: buildChainTimeline('rope', 3) });
    expect(ctl).toMatchObject({ name: 'chain', camera: 'chain', combat: true, chain: 'rope' });
    expect(ctl.canChain()).toBe(false);
  });

  it('Rope-a-Dope holds, strikes each goon in order, then ties them all', () => {
    const { log, done, hero, api } = run('rope', squad());
    expect(done).toBe(true);
    expect(of(log, 'hold').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'stagger').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'tie')[0][1]).toEqual(['g0', 'g1', 'g2']);
    expect(of(log, 'critical')).toEqual([['critical', 'g0', 'rope', true]]);
    expect(of(log, 'word').map((l) => l[1])).toEqual(['THWIP!', 'TANGLED!']);
    expect(api.emitted.filter(([n]) => n === 'chainContact').map(([, d]) => d.effect)).toEqual(['stagger', 'stagger', 'stagger', 'tether', 'yank', 'tie']);
    expect(api.emitted.at(-1)[0]).toBe('chainDone');
    expect(hero.state).toBe('ground');
    expect(hero.invulnerable).toBeLessThanOrEqual(0.3);
  });

  it('Rope-a-Dope pulls the goons together before tying them', () => {
    const targets = squad();
    run('rope', targets);
    const spread = Math.max(...targets.map((a) => Math.max(...targets.map((b) => a.pos.distanceTo(b.pos)))));
    expect(spread).toBeLessThan(1);
  });

  it('Headbanger smashes the first two heads together, then heels the third', () => {
    const { log } = run('head', squad());
    const fin = of(log, 'finish');
    expect(fin.map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    expect(fin[0][2].distanceTo(fin[1][2])).toBeLessThan(0.6);
    expect(of(log, 'critical').map((l) => l[2])).toEqual(['head', 'head']);
    expect(of(log, 'word').map((l) => l[1])).toEqual(['KONK!', 'THWACK!']);
  });

  it('Domino Drop stomps each head, bounces high and dive-bombs the pile', () => {
    const { log, maxY, hero } = run('domino', squad());
    expect(of(log, 'finish').map((l) => l[1])).toEqual(['g0', 'g1', 'g2']);
    const sw = of(log, 'shockwave')[0];
    expect(sw[1]).toBe(4.5);
    expect(sw[2]).toMatchObject({ crit: false, word: null });
    expect(maxY).toBeGreaterThan(5);
    expect(hero.pos.y).toBeCloseTo(0);
    expect(hero.bat.animator.played).toContain('NinjaJump_Land');
  });

  it('keeps Batman near the fight', () => {
    for (const id of ['rope', 'head', 'domino']) expect(run(id, squad()).maxDist).toBeLessThan(9);
  });

  it('skips a goon knocked out by something else mid-chain and still finishes', () => {
    const targets = squad();
    targets[1].alive = false;
    const { log, done } = run('domino', targets);
    expect(done).toBe(true);
    expect(of(log, 'finish').map((l) => l[1])).toEqual(['g0', 'g2']);
  });

  it('a stealth chain wakes only unaware goons within 8 m of where it ends', () => {
    const near = fakeGoon('near', 0, 9, { aware: false, state: 'idle' });
    const far = fakeGoon('far', 0, 40, { aware: false, state: 'idle' });
    run('domino', squad(), { stealth: true, others: [near, far] });
    expect(near.aware).toBe(true);
    expect(far.aware).toBe(false);
  });
});
```

(Domino ends at the pile centre, about (0.17, 3.3). `near` at (0, 9) is about 5.7 m away and `far` is about 37 m away.)

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/chainControl.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/combat/chainControl.js`**

```js
// A chain takedown in progress, as hero.control (name 'chain'). It plays a timeline from
// chainTimeline.js: Batman lunges between the chained goons (collision-resolved, and a ground
// lunge never carries him off an edge), each clip starts so its contact frame lands on the
// step's contact, and each effect lands through `api` (built by combatSystem.js) so chains share
// the normal hit bookkeeping. The finisher gets the slow-motion action shot.
import * as THREE from 'three';
import { strikeSpot, midSpot, pileCenter, backSpot, lungePoint, chainHearers } from './chains.js';

const HERO_R = 0.35, HERO_H = 1.8;
const GRIP_OPEN = 0.62, GRIP_SHUT = 0.24, SNAP_TIME = 0.08, PULL_TIME = 0.18;
// The action camera per chain: wide over the tangled heap, tight on the heads, high over the crater.
export const CHAIN_SHOTS = {
  rope: { dist: 4.6, lift: 0.9, back: 1.6 },
  head: { dist: 2.4, lift: -0.25, back: 0.5 },
  domino: { dist: 3.8, lift: 2.6, back: 1.0 },
};
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

export function createChainControl(hero, api, { chain, targets, stealth, timeline }) {
  const { events, collision } = api;
  const steps = timeline.steps;
  const floorY = hero.pos.y;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), center = new THREE.Vector3(), at = new THREE.Vector3();
  const lp = { x: 0, y: 0, z: 0 };
  let i = 0, t = 0, entered = false, clipOn = false, landed = false, done = false;
  let grip = null; // Headbanger: { ux, uz, t, starts: [Vector3, Vector3] }
  let pull = null; // Rope-a-Dope yank: { t, starts: Vector3[], ends: Vector3[] }

  for (const e of targets) api.hold(e);
  hero.invulnerable = Math.max(hero.invulnerable, timeline.duration + 0.4);
  hero.vel.set(0, 0, 0);
  hero.cape.setWings(false);
  hero.bat.tilt.rotation.set(0, 0, 0);

  const live = (e) => !!e && e.alive;
  const targetOf = (s) => (s.target === 'pile' ? null : targets[s.target]);
  const faceTo = (x, z) => hero.bat.face(Math.atan2(x - hero.pos.x, z - hero.pos.z));
  const hand = (out) => hero.bat.bone('hand_r').getWorldPosition(out);
  function updateCenter() {
    const c = pileCenter(targets.map((e) => e.pos));
    center.set(c.x, floorY, c.z);
  }

  function enter(s) {
    entered = true; clipOn = false; landed = false;
    from.copy(hero.pos);
    updateCenter();
    const e = targetOf(s);
    switch (s.at) {
      case 'strike': to.copy(live(e) ? strikeSpot(hero.pos, e.pos, s.stop * e.scale) : hero.pos); to.y = floorY; break;
      case 'between': to.copy(midSpot(targets[0].pos, targets[1].pos)); to.y = floorY; break;
      case 'head': to.set(e.pos.x, e.pos.y + 1.85 * e.scale, e.pos.z); break;
      case 'back': to.copy(backSpot(center, hero.pos, s.stop)); to.y = floorY; break;
      case 'apex': to.set(center.x, floorY + s.stop, center.z); break;
      case 'pile': to.copy(center); break;
      default: to.copy(hero.pos);
    }
    if (s.at === 'between') {
      // Arms span the two goons: face across the line between them, whichever way is nearer.
      const a = targets[0].pos, b = targets[1].pos;
      const yaw = Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
      hero.bat.face(Math.abs(angleDiff(yaw, hero.bat.yaw)) < Math.PI / 2 ? yaw : yaw + Math.PI);
    } else if (e) faceTo(e.pos.x, e.pos.z);
    else if (s.at !== 'stay') faceTo(center.x, center.z);
  }

  function move(s) {
    lungePoint(from, to, t / s.lunge, s.arc, lp, s.ease);
    const px = hero.pos.x, pz = hero.pos.z, prevY = hero.pos.y;
    hero.pos.set(lp.x, lp.y, lp.z);
    const r = collision.resolveCylinder(hero.pos, HERO_R, HERO_H, { prevY });
    // A ground lunge never carries Batman off an edge: where the floor drops away, he stops.
    if (s.arc === 0 && lp.y <= floorY + 0.01 && r.groundY < floorY - 0.6) hero.pos.set(px, floorY, pz);
  }

  function startGrip() {
    const [a, b] = targets;
    const ux = b.pos.x - a.pos.x, uz = b.pos.z - a.pos.z, d = Math.hypot(ux, uz) || 1;
    grip = { ux: ux / d, uz: uz / d, t: 0, starts: [a.pos.clone(), b.pos.clone()] };
    for (const e of [a, b]) if (live(e)) e.ch.animator.play('Hit_Head', { once: true, timeScale: 0.45, fade: 0.05 });
  }
  // Both goons snap to Batman's hands, then squeeze in as the smash reaches its contact frame.
  function holdGrip(dt, s) {
    if (!grip) return;
    grip.t += dt;
    const squeeze = s.effect === 'headSmash' ? Math.min(1, t / Math.max(1e-6, s.contact)) : 0;
    const gap = GRIP_OPEN + (GRIP_SHUT - GRIP_OPEN) * squeeze * squeeze;
    const snap = Math.min(1, grip.t / SNAP_TIME);
    for (let j = 0; j < 2; j++) {
      const e = targets[j];
      if (!live(e)) continue;
      const side = j === 0 ? -1 : 1;
      const x = hero.pos.x + grip.ux * gap * side, z = hero.pos.z + grip.uz * gap * side;
      e.pos.x = grip.starts[j].x + (x - grip.starts[j].x) * snap;
      e.pos.z = grip.starts[j].z + (z - grip.starts[j].z) * snap;
      e.ch.face(Math.atan2(-side * grip.ux, -side * grip.uz));
    }
  }

  function startPull() {
    updateCenter();
    const n = targets.length;
    pull = {
      t: 0,
      starts: targets.map((e) => e.pos.clone()),
      ends: targets.map((e, j) => new THREE.Vector3(center.x + Math.sin((j / n) * Math.PI * 2) * 0.35, e.pos.y, center.z + Math.cos((j / n) * Math.PI * 2) * 0.35)),
    };
    for (const e of targets) if (live(e)) e.ch.animator.play('Hit_Chest', { once: true, timeScale: 1.6, fade: 0.05 });
  }
  // The yank: they accelerate into each other.
  function stepPull(dt) {
    if (!pull) return;
    pull.t += dt;
    const k = Math.min(1, pull.t / PULL_TIME);
    targets.forEach((e, j) => { if (live(e)) e.pos.lerpVectors(pull.starts[j], pull.ends[j], k * k); });
    if (k >= 1) pull = null;
  }

  function land(s) {
    const e = targetOf(s);
    // A step aimed at a goon that something else already knocked out lands nothing (no word).
    const hit = !e || live(e);
    if (s.hitStop && hit) api.time.hitStop(s.hitStop);
    if (e) e.ch.headWorld(at, 0.3); else at.copy(center).setY(center.y + 1.6);
    switch (s.effect) {
      case 'stagger': if (live(e)) api.stagger(e); break;
      case 'tether': api.fx?.fire(hand, targets, 0.22); events.emit('chainTether'); break;
      case 'yank': startPull(); events.emit('chainYank'); break;
      case 'tie': {
        // Finish the yank exactly (frame timing can leave it a hair short), then tie them.
        if (pull) { pull.t = PULL_TIME; stepPull(0); }
        const list = targets.filter(live);
        api.tie(list);
        api.fx?.bind(list);
        break;
      }
      case 'grab': startGrip(); events.emit('chainGrab'); break;
      case 'headSmash':
        grip = null;
        for (let j = 0; j < 2; j++) if (live(targets[j])) api.finish(targets[j], { power: 0.5 });
        events.emit('chainSmash', { pos: at.clone() });
        break;
      case 'heel': if (live(e)) api.finish(e, { power: 1.8, launch: 4 }); break;
      case 'stomp': if (live(e)) api.finish(e, { power: 0.3 }); events.emit('chainStomp'); break;
      case 'diveBomb': api.shockwave(center, 4.5, { crit: false, word: null }); break;
      default: break;
    }
    if (s.thenClip) hero.bat.animator.play(s.thenClip, { once: true, timeScale: 0.9, fade: 0.04 });
    if (s.word && hit) api.word(s.word, at, s.finisher);
    const focus = e ?? targets.find(live) ?? targets[0];
    if (s.finisher) api.critical(focus, { slow: 0.9, scale: 0.25, shot: CHAIN_SHOTS[chain.id], variant: chain.id });
    else if (s.effect === 'heel') api.critical(focus, { slow: 0.35, scale: 0.4, variant: chain.id });
    events.emit('chainContact', { chain: chain.id, effect: s.effect, index: i });
  }

  function finish() {
    done = true;
    grip = null;
    pull = null;
    const g = collision.groundBelow(hero.pos.x, hero.pos.y + 0.5, hero.pos.z, 0.3);
    const airborne = g === -Infinity || hero.pos.y - g > 0.3;
    if (!airborne) hero.pos.y = g;
    hero.vel.set(0, 0, 0);
    hero.grounded = !airborne;
    hero.setState(airborne ? 'air' : 'ground');
    hero.invulnerable = Math.min(hero.invulnerable, 0.3);
    for (const e of targets) api.release(e);
    // Silent from stealth: only unaware goons close to where it ended hear it.
    if (stealth) for (const e of chainHearers(hero.pos, api.enemies(), targets)) e.wake();
    events.emit('chainDone', { chain: chain.id, count: targets.length, stealth });
  }

  return {
    name: 'chain', camera: 'chain', combat: true, chain: chain.id, targets,
    // A chain isn't cut short by another move; it hands control back when it's over.
    canChain: () => false,
    update(dt) {
      if (done) return true;
      t += dt;
      const s = steps[i];
      if (!entered) enter(s);
      if (s.clip && !clipOn && t >= s.clipStart) { clipOn = true; hero.bat.animator.play(s.clip, { once: true, timeScale: s.speed, fade: 0.05 }); }
      if (s.lunge > 0 && s.at !== 'stay') move(s);
      holdGrip(dt, s);
      stepPull(dt);
      if (!landed && t >= s.contact) { landed = true; land(s); }
      if (t >= s.dur) {
        t -= s.dur;
        i += 1;
        entered = false;
        if (i >= steps.length) { finish(); return true; }
      }
      return false;
    },
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/unit/chainControl.test.js`
Expected: PASS. If "keeps Batman near the fight" fails, the `back` step's `stop` is too large for the geometry; lower it in `chainTimeline.js`, not the test's 9 m bound.

- [ ] **Step 5: Commit**

```bash
git add src/combat/chainControl.js tests/unit/chainControl.test.js
git commit -m "Chain takedown control: plays a timeline goon to goon"
```

---

### Task 8: Input: chain actions, keys and pad chords

**Files:**
- Modify: `src/core/bindings.js`
- Modify: `src/core/input.js`
- Test: `tests/unit/bindings.test.js`, `tests/unit/input.test.js` (new)

**Interfaces:**
- Consumes: nothing.
- Produces: actions `chain1`, `chain2` and `chain3` (defaults `Digit1`, `Digit2`, `Digit3`; rebindable). Pad chords: hold Y (button 3) plus D-pad left (14), up (12) or right (15). Exports `PAD_BUTTONS`, `PAD_CHORD_HOLD`, `PAD_CHORDS` and `padActions(isDown, out)`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/bindings.test.js`:

```js
describe('chain takedown bindings', () => {
  it('binds chains 1 to 3 to the number keys in the Fight group', () => {
    expect(DEFAULT_BINDINGS.chain1).toEqual(['Digit1']);
    expect(DEFAULT_BINDINGS.chain2).toEqual(['Digit2']);
    expect(DEFAULT_BINDINGS.chain3).toEqual(['Digit3']);
    for (const id of ['chain1', 'chain2', 'chain3']) {
      const a = ACTIONS.find((x) => x.id === id);
      expect(a.group).toBe('Fight');
      expect(a.label).toMatch(/^Chain takedown [123]: /);
      expect(a.label).not.toContain('—');
    }
  });
});
```

Create `tests/unit/input.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { padActions } from '../../src/core/input.js';

const pad = (...down) => (i) => down.includes(i);
const acts = (...down) => [...padActions(pad(...down))].sort();

describe('padActions', () => {
  it('maps plain buttons as before', () => {
    expect(acts(2)).toEqual(['punch']);
    expect(acts(15)).toEqual(['throw']);
    expect(acts(12)).toEqual([]);
    expect(acts(14)).toEqual([]);
  });
  it('with block held, the D-pad fires the chains instead', () => {
    expect(acts(3, 14)).toEqual(['block', 'chain1']);
    expect(acts(3, 12)).toEqual(['block', 'chain2']);
    expect(acts(3, 15)).toEqual(['block', 'chain3']);
  });
  it('help on D-pad down still works while blocking', () => {
    expect(acts(3, 13)).toEqual(['block', 'help']);
  });
  it('reuses the output set', () => {
    const out = new Set(['stale']);
    expect(padActions(pad(0), out)).toBe(out);
    expect([...out]).toEqual(['jump']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/bindings.test.js tests/unit/input.test.js`
Expected: FAIL.

- [ ] **Step 3: Bindings.** In `src/core/bindings.js`, add after the `special` action:

```js
  { id: 'chain1', label: 'Chain takedown 1: Rope-a-Dope (combo 6)', group: 'Fight' },
  { id: 'chain2', label: 'Chain takedown 2: Headbanger (combo 9)', group: 'Fight' },
  { id: 'chain3', label: 'Chain takedown 3: Domino Drop (combo 12)', group: 'Fight' },
```

Add after `special: ['KeyX'],`:

```js
  chain1: ['Digit1'],
  chain2: ['Digit2'],
  chain3: ['Digit3'],
```

Saved settings from before this change get the new defaults through `sanitizeBindings` in `src/core/settings.js`, which fills missing actions and resolves code clashes. No change there.

- [ ] **Step 4: Pad chords.** In `src/core/input.js`, export `PAD_BUTTONS` (change `const PAD_BUTTONS` to `export const PAD_BUTTONS`) and add below it:

```js
// Chain takedowns: D-pad left, up and right while block (Y) is held. With block held, D-pad
// right belongs to chain 3, not grab and throw.
export const PAD_CHORD_HOLD = 3;
export const PAD_CHORDS = { chain1: 14, chain2: 12, chain3: 15 };
const CHORD_BUTTONS = new Set(Object.values(PAD_CHORDS));

// Actions held on the pad this frame, from a button-state lookup. Pure.
export function padActions(isDown, out = new Set()) {
  out.clear();
  const chord = isDown(PAD_CHORD_HOLD);
  for (const [action, idx] of Object.entries(PAD_BUTTONS)) {
    if (idx.some((i) => isDown(i) && !(chord && CHORD_BUTTONS.has(i)))) out.add(action);
  }
  if (chord) for (const [action, i] of Object.entries(PAD_CHORDS)) if (isDown(i)) out.add(action);
  return out;
}
```

In `pollPad`, replace the line `for (const [action, idx] of Object.entries(PAD_BUTTONS)) if (idx.some((i) => pad.buttons[i]?.pressed)) now.add(action);` with:

```js
      padActions((i) => !!pad.buttons[i]?.pressed, now);
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS, including the existing "never binds one code to two actions by default" test.

- [ ] **Step 6: Commit**

```bash
git add src/core/bindings.js src/core/input.js tests/unit/bindings.test.js tests/unit/input.test.js
git commit -m "Chain takedown actions on 1, 2, 3 and block plus D-pad"
```

---

### Task 9: Combat integration: starting a chain

**Files:**
- Modify: `src/combat/combatSystem.js`
- Modify: `src/game/game.js` (pass `getChainDiscount`; nothing else)

**Interfaces:**
- Consumes:
  - Tasks 1 to 8.
  - `inputBuffer` (the chain actions are buffered like any other).
  - `canSee`, `inputDir`, `director`, `combo.take`, `finishTarget`, `critical`, `shockwave`.
- Produces: `createCombat({ ..., getChainDiscount })`, `combat.chains`, `startChain` inside `tryStart`, `chainApi(ctx)`. Events `chainStart`, `chainTied`, and `hint` ids `chain-locked`, `chain-cost` and `chain-targets`.

- [ ] **Step 1: Imports and state.** At the top of `src/combat/combatSystem.js`, extend the chains import and add:

```js
import { CHAIN_RULES, chainForAction, chainAvailability, selectChainTargets, chainCost, tiedGroup, chainOutcome } from './chains.js';
import { buildChainTimeline } from './chainTimeline.js';
import { createChainControl } from './chainControl.js';
```

Change the signature to `export function createCombat({ hero, follow, time, events, rng, getDifficulty, getChainDiscount = () => 0 })`. Next to the other temporaries, add:

```js
  const push = new THREE.Vector3();
  // What the chain icons show; refreshed every 0.1 s of game time or when the combo changes.
  let chainAvail = chainAvailability({ combo: 0, origin: hero.pos, enemies: [] });
  let availT = 0, availCombo = -1;
```

- [ ] **Step 2: `startChain` and `chainApi`.** Add after `takedown`:

```js
  // ---- chain takedowns ----

  // The hooks a chain lands its steps through (chainControl.js), so chains share this file's hit
  // bookkeeping: director slots, combo, impact events, hit-stop, critical and shockwave.
  function chainApi(ctx) {
    return {
      events, time, collision: hero.collision, fx: ctx.chainFx ?? null,
      enemies: () => enemies,
      hold(e) { e.chainHold(); director.release(e.id); },
      release(e) { e.chainRelease(); },
      stagger(e) {
        push.set(e.pos.x - hero.pos.x, 0, e.pos.z - hero.pos.z);
        if (push.lengthSq() > 1e-6) e.pos.addScaledVector(push.normalize(), 0.25);
        hero.collision.resolveCylinder(e.pos, e.radius, 1.8 * e.scale);
        e.ch.animator.play(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head', { once: true, timeScale: 1.4, fade: 0.05 });
        combo.hit();
        follow.addShake(0.08);
        e.ch.headWorld(chest, -0.3);
        events.emit('impact', { pos: chest.clone(), move: 'chain', outcome: 'hit', target: e, crit: false });
      },
      finish: finishTarget,
      tie(list) {
        for (const e of list) { e.tie(list, CHAIN_RULES.tiedTime); director.release(e.id); combo.hit(); }
        events.emit('chainTied', { count: list.length });
      },
      critical,
      shockwave,
      word(text, pos, big = false) { events.emit('word', { text, pos: pos.clone(), big }); },
    };
  }

  // Returns true when the press is used up: a chain started, or a hint said why not.
  function startChain(chain, ctx) {
    if (hero.state !== 'ground' || !hero.grounded) return false;
    const discount = getChainDiscount();
    const k = chain.n - 1;
    const avail = chainAvailability({ combo: combo.value, origin: hero.pos, enemies, discount });
    if (!avail.affordable[k]) {
      const why = !avail.show ? 'chain-locked' : !avail.stealth && combo.value < avail.costs[k] ? 'chain-cost' : 'chain-targets';
      events.emit('hint', { id: why });
      return true;
    }
    const targets = selectChainTargets(hero.pos, inputDir(ctx), enemies, { canSee, onlyUnaware: avail.stealth });
    if (!targets) { events.emit('hint', { id: 'chain-targets' }); return true; }
    if (!avail.stealth) combo.take(chainCost(chain, discount));
    const timeline = buildChainTimeline(chain.id, targets.length, BEATS);
    // Everyone else waits: wind-ups in progress are called off and nobody starts one mid-chain.
    for (const e of alive()) {
      if (targets.includes(e)) continue;
      if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; }
      director.hold(e.id, timeline.duration + 0.6);
    }
    hero.control = createChainControl(hero, chainApi(ctx), { chain, targets, stealth: avail.stealth, timeline });
    events.emit('chainStart', { chain: chain.id, count: targets.length, stealth: avail.stealth, ids: targets.map((e) => e.id) });
    return true;
  }
```

- [ ] **Step 3: Route the actions.**
  - Make the first lines of `tryStart` check for a chain before the line-of-sight list is built, so a chain press doesn't raycast every goon twice:

```js
    const chain = chainForAction(action);
    if (chain) return startChain(chain, ctx);
```

  - Change `const ACTIONS = [...]` to add `'chain1', 'chain2', 'chain3'`. The existing buffer loop in `update` then records and retries them.
  - In `update`, right after `combo.tick(dt);`, add:

```js
      availT -= dt;
      if (availT <= 0 || combo.value !== availCombo) {
        availT = 0.1;
        availCombo = combo.value;
        chainAvail = chainAvailability({ combo: combo.value, origin: hero.pos, enemies, discount: getChainDiscount() });
      }
```

  - Add to the returned object: `get chains() { return chainAvail; },`.

- [ ] **Step 4: Game.** In `src/game/game.js`, change the `createCombat` call to pass `getChainDiscount: () => 0`. This is the hook for Part G's "chain takedowns cost 2 less".

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 6: Smoke check in the game.** Build, preview, and run:

```bash
cat > "$TEMP/chain-t9.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.combat ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__log = []; G.events.on('chainStart', (d) => G.__log.push(['start', d.chain, G.combat.combo.value])); G.events.on('chainDone', (d) => G.__log.push(['done', d.chain])); G.events.on('hint', (d) => G.__log.push(['hint', d.id])); 'hooked'"},
 {"press": "Digit1", "wait": 300},
 {"eval": "const G = window.__game; for (let i = 0; i < 6; i++) G.combat.combo.hit(); 'six hits'", "wait": 150},
 {"eval": "[window.__game.combat.chains.affordable, window.__game.combat.combo.value]"},
 {"press": "Digit1", "wait": 300},
 {"eval": "window.__game.hero.control?.name", "wait": 2600},
 {"eval": "JSON.stringify(window.__game.__log)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-t9.json")"
```

Expected:
- After six hits (read one frame later, when `combat.chains` has refreshed), `chains.affordable` is `[true,false,false]` and the combo is 6.
- Right after the second press, `hero.control.name` is `chain`.
- The log reads `[["hint","chain-locked"],["start","rope",0],["done","rope"]]`. The `0` is the combo right after the chain spent its 6. Other hint lines from the fight may appear in between.
- No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/combat/combatSystem.js src/game/game.js
git commit -m "Start chain takedowns from combat: costs, targets, stealth, api"
```

---

### Task 10: HUD chain icons and the first-time trigger

**Files:**
- Modify: `src/ui/hud.js`, `src/ui/style.css`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: `combat.chains`, `chainHudKey` (Task 1), `bindingLabel`.
- Produces: `hud.setChains(state, keyLabels)`. Prompt `chain` is queued the first time any chain is affordable (its text comes in Task 11).

- [ ] **Step 1: Markup and API** in `src/ui/hud.js`. Import `chainHudKey` from `../combat/chains.js`. Add the icon paths near `BOLT`:

```js
// Chain icons, inked: a looped rope, two heads meeting, a boot coming down on a crater.
const CHAIN_ICON = [
  '<path d="M8 30 C8 14 30 14 30 24 C30 34 14 34 14 24 C14 14 36 12 40 22"/>',
  '<circle cx="14" cy="26" r="9"/><circle cx="34" cy="26" r="9"/><path d="M24 6 L24 13 M17 9 L21 15 M31 9 L27 15"/>',
  '<path d="M24 5 L24 29 M16 21 L24 31 L32 21 M8 41 L40 41 M12 37 L7 32 M36 37 L41 32"/>',
];
```

In the template, right after the `.hud-combo` div, add:

```js
    <div class="hud-chains hidden">${CHAIN_ICON.map((p, i) => `<div class="chain-ico" data-n="${i + 1}"><svg viewBox="0 0 48 48">${p}</svg><b>${i + 1}</b></div>`).join('')}</div>
```

After the other element lookups, add:

```js
  const chainsEl = el.querySelector('.hud-chains');
  const chainIcons = [...chainsEl.querySelectorAll('.chain-ico')];
  let chainKey = '', lastChainState = null, lastChainKeys = null;
```

Add this method to the returned object:

```js
    // Chain takedown icons under the combo counter (lit = affordable, blue = free from stealth).
    // state is combat.chains; keys are the bound key labels. Most frames pass the same two objects
    // and return at once; the DOM is touched only when what the icons show changed.
    setChains(state, keys) {
      if (state === lastChainState && keys === lastChainKeys) return;
      lastChainState = state;
      lastChainKeys = keys;
      const k = chainHudKey(state) + keys.join('');
      if (k === chainKey) return;
      chainKey = k;
      chainsEl.classList.toggle('hidden', !state.show);
      chainsEl.classList.toggle('stealth', !!state.stealth);
      chainIcons.forEach((ic, i) => { ic.classList.toggle('lit', !!state.affordable[i]); ic.querySelector('b').textContent = keys[i]; });
    },
```

- [ ] **Step 2: Style** in `src/ui/style.css`, after the `.hud-combo` rules:

```css
.hud-chains { position: absolute; left: 38px; top: 112px; display: flex; gap: 10px; transform: skewX(-12deg); transition: opacity 0.3s; }
.hud-chains.hidden { opacity: 0; }
.chain-ico { position: relative; width: 44px; height: 44px; background: var(--paper); border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); opacity: 0.35; }
.chain-ico svg { width: 100%; height: 100%; }
.chain-ico path, .chain-ico circle { fill: none; stroke: var(--ink); stroke-width: 3.5; stroke-linecap: round; stroke-linejoin: round; }
.chain-ico b { position: absolute; right: -8px; bottom: -10px; font: 22px 'Bangers', cursive; color: var(--paper); -webkit-text-stroke: 1.5px var(--ink); paint-order: stroke fill; }
.chain-ico.lit { opacity: 1; background: var(--signal); animation: pop 0.18s ease-out; }
.hud-chains.stealth .chain-ico.lit { background: var(--detective); }
```

- [ ] **Step 3: Wire it in `src/game/game.js`.**
  - Near the other `update` state, add `let chainLabels = ['1', '2', '3'];` and `let chainPromptShown = false;`.
  - Inside the throttled `hintCheckT` block, add:

```js
          chainLabels = ['chain1', 'chain2', 'chain3'].map((a) => bindingLabel(settings.bindings, a));
```

  - Right after the `hud.setCombo` line in `update`, add:

```js
        hud.setChains(combat.chains, chainLabels);
        if (!chainPromptShown && combat.chains.affordable.some(Boolean)) { chainPromptShown = true; prompts.show(['chain']); }
```

- [ ] **Step 4: Screenshot check.** Build, preview, and run dev-play with these steps:
  - In `?fight=test&god=1`, eval `for (let i = 0; i < 9; i++) window.__game.combat.combo.hit()`, wait 300, then take shot `hud-chains-fight`.
  - Eval: `const G = window.__game; for (const e of G.enemies) { e.aware = false; e.state = 'idle'; e.glyph = null; } G.enemies[0].pos.set(G.hero.pos.x + 2, G.hero.pos.y, G.hero.pos.z - 3); G.enemies[1].pos.set(G.hero.pos.x - 2, G.hero.pos.y, G.hero.pos.z - 3);`, wait 2000 (let the combo lapse), then take shot `hud-chains-stealth`.

Expected: the first shot shows icons 1 and 2 lit in yellow and 3 dim. The second shows all three lit in blue with the combo counter hidden.

- [ ] **Step 5: Commit**

```bash
npx vitest run
git add src/ui/hud.js src/ui/style.css src/game/game.js
git commit -m "HUD chain icons with affordability and stealth colour"
```

---

### Task 11: Teaching, hints, help, sounds

**Files:**
- Modify: `src/ui/prompts.js`, `src/ui/menus.js`, `src/game/game.js`, `src/game/sound.js`, `src/audio/sfx.js`
- Test: `tests/unit/prompts.test.js`

**Interfaces:**
- Consumes: events `chainStart`, `chainTether`, `chainYank`, `chainTied`, `chainGrab`, `chainSmash`, `chainStomp`, `tiedBreak`, and the hint ids from Task 9.
- Produces: prompts `chain` and `chainTied`, a help section and a pad layout line, and SFX `konk` and `tether`.

- [ ] **Step 1: Write the failing test.** Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: chain takedowns', () => {
  const CHAIN_IDS = { chain: ['chain1', 'chain2', 'chain3'], chainTied: ['punch', 'kick'] };
  for (const [id, actions] of Object.entries(CHAIN_IDS)) {
    it(`${id} shows its keys and has no em dash`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toContain('—');
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
});
```

Run: `npx vitest run tests/unit/prompts.test.js`. Expected: FAIL.

- [ ] **Step 2: Prompts.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['chain', (k) => `Combo at 6 or more, or two goons nearby who haven't seen you? Press ${k('chain1')}, ${k('chain2')} or ${k('chain3')} for a chain takedown that goes goon to goon.`],
  ['chainTied', (k) => `Tied up! They can't get up for a few seconds. One more hit, ${k('punch')} or ${k('kick')}, knocks the whole bundle out.`],
```

Run the test again. Expected: PASS, including "has no duplicate prompt ids".

- [ ] **Step 3: Hints, prompt triggers and done-marks** in `src/game/game.js`. Add to `HINTS`:

```js
      'chain-locked': () => "Chain takedowns unlock at a 6 hit combo, or when two goons nearby haven't seen you.",
      'chain-cost': () => 'Not enough combo. Rope-a-Dope costs 6, Headbanger 9, Domino Drop 12.',
      'chain-targets': () => 'A chain takedown needs two goons close by and in sight.',
```

Add `chainStart: 'chain', tiedBreak: 'chainTied'` to `PROMPT_DONE`, and add:

```js
    events.on('chainTied', () => prompts.show(['chainTied']));
```

- [ ] **Step 4: Help page** in `src/ui/menus.js`. Add `const CHAIN_TIPS = ['chain', 'chainTied'];` next to `MOVING_AROUND`. Add this to `PAD_LAYOUT`:

```js
  ['Chain takedowns', 'Hold Y, then D-pad left, up or right'],
```

In `help()`, after the Moving around tips, add:

```js
    node.appendChild(el('h3', '', 'Chain takedowns'));
    for (const id of CHAIN_TIPS) node.appendChild(el('p', 'tip', promptText(id, settings.bindings)));
    node.appendChild(el('p', 'tip', 'Rope-a-Dope (6) ties up to three goons together. Headbanger (9) smashes two heads together. Domino Drop (12) bounces off every head into a dive-bomb. From stealth they are free and silent.'));
```

The three chain actions already appear in the Fight column, because it lists `ACTIONS`.

- [ ] **Step 5: Sounds** in `src/audio/sfx.js`. Add to `SFX`:

```js
  // Two heads meeting: a hollow wood-block knock over a short skull thud.
  konk: { wet: 0.2, max: 2, fn(ctx, out, t, p) {
    tone(ctx, out, t, { type: 'triangle', freq: 720 * p, to: 540 * p, d: 0.09, gain: 0.45 });
    tone(ctx, out, t + 0.012, { type: 'triangle', freq: 1080 * p, to: 820 * p, d: 0.06, gain: 0.25 });
    noise(ctx, out, t, { type: 'bandpass', freq: 1500 * p, Q: 3, d: 0.05, gain: 0.5 });
    thump(ctx, out, t, p, { from: 150, to: 60, d: 0.14, gain: 0.6 });
    return t + 0.18;
  } },

  // The grapple line whipping out and cinching tight.
  tether: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    swish(ctx, out, t, p, { from: 600, peak: 3400, to: 1200, dur: 0.22, gain: 0.35, Q: 3 });
    metal(ctx, out, t + 0.2, { base: 1600 * p, ratios: [1, 2.4], d: 0.12, gain: 0.12 });
    return t + 0.34;
  } },
```

In `src/game/sound.js`, add:

```js
  on('chainStart', ({ stealth }) => audio.play('whoosh', { gain: stealth ? 0.5 : 0.8, pitch: 0.85 }));
  on('chainTether', () => audio.play('tether'));
  on('chainYank', () => audio.play('whoosh', { gain: 0.8, pitch: 0.7 }));
  on('chainTied', () => { audio.play('heavy', { pitch: 1.1 }); audio.play('tether', { gain: 0.7, pitch: 0.7 }); });
  on('chainGrab', () => audio.play('cape', { pitch: 0.7 }));
  on('chainSmash', () => audio.play('konk'));
  on('chainStomp', () => audio.play('kick', { pitch: 1.35 }));
  on('tiedBreak', () => audio.play('konk', { pitch: 0.8 }));
```

The impacts themselves already sound through the `impact` event (`move: 'chain'` plays `punch`, a KO plays `heavy` and `ko`). The finisher's `critical` adds `heavy` and `takedown`, and the Domino Drop's shockwave `diveImpact` adds `land`.

- [ ] **Step 6: Listen.** Open `src/audio/lab.js`'s page if it lists `SFX_NAMES` (it picks the new ones up automatically). Play `konk` and `tether`, check that they sound like a knock and a line zip, and check for no clipping.

- [ ] **Step 7: Commit**

```bash
npx vitest run
git add src/ui/prompts.js src/ui/menus.js src/game/game.js src/game/sound.js src/audio/sfx.js tests/unit/prompts.test.js
git commit -m "Chain takedown prompts, hints, help, sounds"
```

---

### Task 12: Scripted play for every chain (contact frames and outcomes)

**Files:** none changed. This task verifies on the frozen build and saves screenshots to `$TEMP/chains`.

**Interfaces:**
- Consumes: everything above, plus `window.__game.state.paused`. Setting it freezes gameplay while the page keeps rendering, which is how these scripts hold a contact frame for a screenshot.

- [ ] **Step 1: Build and preview** (see Global Constraints). Then write the shared setup step:

```bash
cat > "$TEMP/chain-setup.js" <<'EOF'
(async () => {
  const G = window.__game;
  await new Promise((r) => { const f = () => (G.combat ? r() : setTimeout(f, 100)); f(); });
  if (G.comic?.playing) G.comic.skip();
  G.__log = []; G.__freeze = [];
  G.events.on('chainStart', (d) => G.__log.push(['start', d.chain, d.ids, d.stealth]));
  G.events.on('chainContact', (d) => { G.__log.push([d.effect, d.index]); if (G.__freeze[0] === d.effect) { G.__freeze.shift(); G.state.paused = true; } });
  G.events.on('chainDone', (d) => G.__log.push(['done', d.chain]));
  return 'ready';
})()
EOF
SETUP=$(node -e "process.stdout.write(JSON.stringify(require('fs').readFileSync(process.env.TEMP + '/chain-setup.js', 'utf8')))")
```

- [ ] **Step 2: Rope-a-Dope.**

```bash
cat > "$TEMP/chain-rope.json" <<EOF
[
 {"eval": $SETUP, "wait": 1500},
 {"eval": "const G = window.__game; G.__freeze = ['tether', 'tie']; for (let i = 0; i < 6; i++) G.combat.combo.hit(); G.combat.combo.value"},
 {"press": "Digit1", "wait": 1600},
 {"shot": "rope-1-tether"},
 {"eval": "window.__game.state.paused = false", "wait": 1600},
 {"shot": "rope-2-tie"},
 {"eval": "const G = window.__game; G.state.paused = false; JSON.stringify(G.__log)", "wait": 900},
 {"eval": "window.__game.enemies.map((e) => [e.id, e.type, e.state, e.alive])"},
 {"shot": "rope-3-bundle"},
 {"click": 0, "wait": 1200},
 {"eval": "window.__game.enemies.map((e) => [e.id, e.type, e.state, e.alive])"},
 {"shot": "rope-4-kapow"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-rope.json")"
```

Expected:
- The log shows `start rope` with 2 or 3 ids, then `stagger` for each, then `tether`, `yank`, `tie` and `done`.
- `rope-1-tether` shows the ink line reaching the goons.
- `rope-2-tie` shows the heap with `TANGLED!`, the action camera and ink speed lines.
- After the chain, every chained id is `tied`.
- After the click, every one of them is `ko`/`false`. A chained brute is `down`/`true` instead.
- `rope-4-kapow` shows `KAPOW!`.
- No console errors.

- [ ] **Step 3: Headbanger.**

```bash
cat > "$TEMP/chain-head.json" <<EOF
[
 {"eval": $SETUP, "wait": 1500},
 {"eval": "const G = window.__game; G.__freeze = ['grab', 'headSmash']; for (let i = 0; i < 9; i++) G.combat.combo.hit(); G.combat.combo.value"},
 {"press": "Digit2", "wait": 1200},
 {"shot": "head-1-grab"},
 {"eval": "window.__game.state.paused = false", "wait": 1200},
 {"shot": "head-2-konk"},
 {"eval": "const G = window.__game; G.state.paused = false; JSON.stringify(G.__log)", "wait": 1500},
 {"eval": "window.__game.enemies.map((e) => [e.id, e.type, e.state, e.alive])"},
 {"shot": "head-3-after"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-head.json")"
```

Expected:
  - `head-1-grab` shows both goons held at Batman's hands.
  - `head-2-konk` shows their heads together, `KONK!`, a tight action shot and yellow speed lines.
  - The first two ids end `ko` (a brute can't be first; a brute second ends `down`).
  - With 3 targets, the third ends `ko` after a heel strike with `THWACK!`.

- [ ] **Step 4: Domino Drop.**

```bash
cat > "$TEMP/chain-domino.json" <<EOF
[
 {"eval": $SETUP, "wait": 1500},
 {"eval": "const G = window.__game; G.__freeze = ['stomp', 'diveBomb']; for (let i = 0; i < 12; i++) G.combat.combo.hit(); G.combat.combo.value"},
 {"press": "Digit3", "wait": 1200},
 {"shot": "domino-1-stomp"},
 {"eval": "window.__game.state.paused = false", "wait": 2000},
 {"shot": "domino-2-blam"},
 {"eval": "const G = window.__game; G.state.paused = false; JSON.stringify(G.__log)", "wait": 1200},
 {"eval": "window.__game.enemies.map((e) => [e.id, e.type, e.state, e.alive, e.down])"},
 {"shot": "domino-3-after"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-domino.json")"
```

Expected:
  - `domino-1-stomp` shows Batman on the first goon's head.
  - `domino-2-blam` shows the landing with `KA-BLAM!` (and no `KA-THOOM!`), a high action shot and the long speed-line burst.
  - Every chained id is `ko` (a brute `down`).
  - Non-brute goons within 4.5 m of the pile that weren't chained are `down`.

- [ ] **Step 5: Stealth (free and silent).**

```bash
cat > "$TEMP/chain-stealth.json" <<EOF
[
 {"eval": $SETUP, "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, es = G.enemies; for (const e of es) { e.aware = false; e.state = 'idle'; e.glyph = null; } es[0].pos.set(h.x + 2, h.y, h.z - 3); es[1].pos.set(h.x - 2, h.y, h.z - 3); es[2].pos.set(h.x, h.y, h.z - 6); es[3].pos.set(h.x, h.y, h.z - 11.5); es[4].pos.set(h.x - 20, h.y, h.z); G.hero.bat.face(Math.PI); 'placed'", "wait": 400},
 {"eval": "const G = window.__game; [G.combat.combo.value, G.combat.chains.stealth, G.combat.chains.affordable]"},
 {"shot": "stealth-1-icons"},
 {"press": "Digit3", "wait": 3500},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.enemies.map((e) => [e.id, e.type, e.state, e.aware])]"},
 {"shot": "stealth-2-after"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5204/?fight=test&god=1" "$TEMP/chains" "$(cat "$TEMP/chain-stealth.json")"
```

The `?fight=test` squad is placed on the GCPD roof. If a position lands off the roof edge, move the whole layout toward the roof centre and keep the relative spacing. Expected:
- The second eval (read after the icons refreshed) prints `[0, true, [true,true,true]]`.
- The log shows `start domino [...] true` with the three near goons.
- The knife goon (index 3, about 7 m from the pile) is `aware: true` afterwards (it heard).
- The brute (index 4, 20 m away) is still `aware: false`.
- `stealth-1-icons` shows three blue icons.

Until Part D, a woken goon still triggers the whole encounter through `encounters.js`. That isn't in play in `?fight=test`.

- [ ] **Step 6: Tie expiry and director slots.** In a fresh `?fight=test&god=1`:
  - Run Rope-a-Dope, then do nothing for 7 s. Expected: the chained goons go `getup` then `engage`, and the ink wraps disappear.
  - During the 6 s, eval `[...window.__game.combat.director.active]`. Expected: no tied id in it.

- [ ] **Step 7: Look at every screenshot** in `$TEMP/chains`. Each contact frame must show the blow landing: fist or foot on the goon, heads meeting, boot on head. Nothing may clip through a wall, and no chain may leave Batman off the roof. If a contact frame is visibly early or late, fix `STOCK_BEATS` or `CHAIN_BEATS` (and the matching clip keys), re-run Tasks 2 and 4's tests, and redo this task.

---

### Task 13: Full verification (the coordinator runs this)

- [ ] **Step 1:** Run `npx vitest run`. Every test passes, including the six new test files.
- [ ] **Step 2:** Run `npx playwright test`. All smoke tests pass.
- [ ] **Step 3: fps sweep with a chain.** In `scripts/fps-sweep.mjs`, inside the `fight` block and after the kick loop (before `if (shots)`), add:

```js
  // Chain takedowns: each chain once on fresh goons (first use of every chain clip, the tether
  // line, the tie wraps and each finisher's slow motion).
  for (const key of ['Digit1', 'Digit2', 'Digit3']) {
    await p.evaluate(() => {
      const g = window.__game, h = g.hero.pos;
      const list = ['grunt', 'grunt', 'knife'].map((t, i) => g.spawn(t, { x: h.x - 2 + i * 2, y: h.y, z: h.z + 4 }));
      g.combat.setEnemies([...g.combat.enemies.filter((e) => e.alive), ...list]);
      for (const e of list) e.wake();
      for (let i = 0; i < 12; i++) g.combat.combo.hit();
    });
    await p.waitForTimeout(200);
    await label(p, 'chain');
    await p.keyboard.press(key);
    await p.waitForTimeout(3500);
  }
```

Then build to `$TEMP/gdist`, preview on 5202, and run `OUT="$TEMP/sweep.json" node scripts/fps-sweep.mjs http://localhost:5202/ high` on the owner's laptop. Expected:
- The `chain` row's p95 is at or under 6.9 ms.
- `hitches >25ms after warmup: 0`. If a hitch lands in `chain`, find what compiled or uploaded on first use and move it into `warmCast.js` or `animator.prime`, then re-run.
- No other row is worse than before this plan.

- [ ] **Step 4:** Run the full playthrough: `BASE=http://localhost:5202/ OUT="$TEMP/pt4e" node scripts/playthrough.mjs`. It ends at `credits` with no console errors.
- [ ] **Step 5:** Load time: run `node scripts/load-time.mjs http://localhost:5202/ 40 1`. `firstFrame` stays under 3.2 s. The chain clips bake at boot; if `clips` grew by more than 60 ms, move `buildChainClips` after the first frame.
- [ ] **Step 6:** WebKit: run `node scripts/webkit-check.mjs http://localhost:5202/ "$TEMP/wk"`. No console errors.
- [ ] **Step 7: Copy the best contact frames and commit.** Copy the Task 12 shots `rope-2-tie`, `head-2-konk` and `domino-2-blam` to `docs/screens/chain-*.png`, then:

```bash
git add scripts/fps-sweep.mjs docs/screens/chain-*.png
git commit -m "Chain takedowns in the fps sweep; contact-frame screenshots"
```

- [ ] **Step 8:** The coordinator reviews the screenshots and the sweep, then merges and pushes `main`. No task pushes.
