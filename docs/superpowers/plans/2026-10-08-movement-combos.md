# Movement Combos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** How Batman moves (direction relative to the goon, sprint, airborne, sprint-jump) picks the strike; combos are easy to keep and every press auto-attaches to a goon.

**Architecture:** A pure `src/combat/moveSelect.js` (direction classifier + one move table) decides the move; `combatSystem.strike()` / `airKick()` play whatever it returns, falling back to today's rotation. Targeting gains a focus goon and a nearest-goon fallback. New clips come from Mixamo through the existing pipeline.

**Tech Stack:** three r17x, vitest, playwright-core scripts, Mixamo (CDP Chrome on :9555), gltf-transform.

Spec: `docs/superpowers/specs/2026-10-08-movement-combos-design.md`.

## Global Constraints

- Work in worktree `gotham-night` (branch `night`); release = fast-forward main + push (redeploys live), only after every gate passes.
- Commits authored by Krishn Gohel only, no AI trailers.
- No em dashes in player-facing copy (move names, help text).
- Test browsers headless and muted (`--mute-audio`, never grab the mouse).
- Every new clip lands its contact frame 0.15-0.3 s after the press (air/running up to 0.4 s).
- Never `rm` a worktree node_modules junction.

---

### Task 1: moveSelect.js (pure)

**Files:**
- Create: `src/combat/moveSelect.js`
- Test: `tests/unit/moveSelect.test.js`

**Interfaces:**
- Produces: `classifyDir(move, toTarget) -> 'none'|'toward'|'away'|'left'|'right'`; `selectMove({ action, dir, sprint, air, airFromSprint, targetDown, has }) -> Move|null`; `MOVE_TABLE: Move[]` where `Move = { id, name, input, action, clip, kind, power, launch, crit, react, word, stop, air }`. `kind` is an existing rules.js move (`punch|kick|heavy|spinKick|jumpKick`). `stop` is a key of combatSystem's STOP table.

- [ ] **Step 1: failing tests**

```js
import { describe, it, expect } from 'vitest';
import { classifyDir, selectMove, MOVE_TABLE } from '../../src/combat/moveSelect.js';

const v = (x, z) => ({ x, z });
const all = () => true;
const sel = (o) => selectMove({ action: 'kick', dir: 'none', sprint: false, air: false, airFromSprint: false, targetDown: false, has: all, ...o });

describe('classifyDir', () => {
  it('no input is none', () => expect(classifyDir(v(0.05, 0.05), v(0, 1))).toBe('none'));
  it('splits toward, away and the sides (target straight ahead, +z)', () => {
    expect(classifyDir(v(0.2, 1), v(0, 1))).toBe('toward');
    expect(classifyDir(v(0, -1), v(0, 1))).toBe('away');
    expect(classifyDir(v(-1, 0), v(0, 1))).toBe('right'); // facing +z, right is -x
    expect(classifyDir(v(1, 0), v(0, 1))).toBe('left');
  });
  it('edges: 45 degrees is toward, 140 is away, 90 is a side', () => {
    expect(classifyDir(v(1, 1), v(0, 1))).toBe('toward');
    expect(classifyDir(v(Math.sin(2.44), Math.cos(2.44)), v(0, 1))).toBe('away');
    expect(classifyDir(v(1, 0.01), v(0, 1))).toBe('left');
  });
});

describe('selectMove', () => {
  it('plain presses fall through to the rotation', () => {
    expect(sel({ action: 'punch' })).toBeNull();
    expect(sel({ dir: 'toward' })).toBeNull();
  });
  it('every table row is reachable', () => {
    expect(sel({ targetDown: true }).id).toBe('stomp');
    expect(sel({ air: true, airFromSprint: true }).id).toBe('hurricane');
    expect(sel({ action: 'punch', air: true, airFromSprint: true }).id).toBe('leapSmash');
    expect(sel({ air: true, dir: 'away' }).id).toBe('backflipKick');
    expect(sel({ air: true }).id).toBe('airAxe');
    expect(sel({ action: 'punch', air: true })).toBeNull(); // the hammer drop stays
    expect(sel({ sprint: true }).id).toBe('flyingKnee');
    expect(sel({ action: 'punch', sprint: true }).id).toBe('runUppercut');
    expect(sel({ dir: 'away' }).id).toBe('spinBackKick');
    expect(sel({ action: 'punch', dir: 'away' }).id).toBe('spinBackfist');
    expect(sel({ dir: 'left' }).clip).toBe('Kick_SideRound_L');
    expect(sel({ dir: 'right' }).clip).toBe('Kick_SideRound');
    expect(sel({ action: 'punch', dir: 'left' }).clip).toBe('Punch_SideHook_L');
    expect(sel({ action: 'punch', dir: 'right' }).clip).toBe('Punch_SideHook');
  });
  it('a downed goon wins over everything; punching him keeps the hammer', () => {
    expect(sel({ targetDown: true, sprint: true, dir: 'away' }).id).toBe('stomp');
    expect(sel({ action: 'punch', targetDown: true })).toBeNull();
  });
  it('a move whose clip the build lacks falls through', () => {
    expect(sel({ dir: 'away', has: (c) => c !== 'Kick_SpinBack' })).toBeNull();
  });
  it('air moves are flagged, ground moves are not', () => {
    expect(sel({ air: true }).air).toBe(true);
    expect(sel({ sprint: true }).air).toBe(false);
  });
  it('every row has a name and input text without dashes', () => {
    const dash = new RegExp(String.fromCharCode(0x2014) + '|' + String.fromCharCode(0x2013));
    for (const m of MOVE_TABLE) { expect(m.name).toBeTruthy(); expect(m.input).toBeTruthy(); expect(dash.test(m.name + m.input)).toBe(false); }
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/moveSelect.test.js` → FAIL (module missing).
- [ ] **Step 3: implement**

```js
// How Batman moves picks the strike (docs/superpowers/specs/2026-10-08-movement-combos-design.md).
// Pure: combatSystem passes the held direction (relative to the goon), sprint, airborne and
// sprint-jump state; null means "use the normal punch / kick rotation".
const TOWARD = (50 * Math.PI) / 180, AWAY = (130 * Math.PI) / 180;

export function classifyDir(move, toTarget) {
  const ml = Math.hypot(move.x, move.z), tl = Math.hypot(toTarget.x, toTarget.z);
  if (ml < 0.2 || tl < 1e-6) return 'none';
  const dot = (move.x * toTarget.x + move.z * toTarget.z) / (ml * tl);
  const a = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (a <= TOWARD) return 'toward';
  if (a >= AWAY) return 'away';
  // Facing +z, right is -x: a move to the right gives a negative side value.
  const side = toTarget.z * move.x - toTarget.x * move.z;
  return side < 0 ? 'right' : 'left';
}

const M = (o) => ({ power: 1.4, launch: 2, crit: false, react: null, word: null, stop: 'kick', air: false, ...o });
export const MOVE_TABLE = [
  M({ id: 'stomp', name: 'Stomp', input: 'Kick a goon on the floor', action: 'kick', clip: 'Stomp', kind: 'heavy', power: 1.8, launch: 0.3, word: 'STOMP!', stop: 'heavy' }),
  M({ id: 'hurricane', name: 'Hurricane Kick', input: 'Sprint, jump, kick', action: 'kick', clip: 'Kick_Hurricane', kind: 'spinKick', power: 2.4, launch: 7, crit: true, word: 'HURRICANE!', stop: 'finisher', air: true }),
  M({ id: 'leapSmash', name: 'Leaping Smash', input: 'Sprint, jump, punch', action: 'punch', clip: 'Smash_Leap', kind: 'heavy', power: 2.2, launch: 0.5, crit: true, word: 'SMASH!', stop: 'finisher', air: true }),
  M({ id: 'backflipKick', name: 'Backflip Kick', input: 'Jump, hold back, kick', action: 'kick', clip: 'Kick_BackFlip', kind: 'spinKick', power: 2.4, launch: 8, crit: true, word: 'WHAM!', stop: 'finisher', air: true }),
  M({ id: 'airAxe', name: 'Axe Kick', input: 'Jump, kick', action: 'kick', clip: 'Kick_AirAxe', kind: 'spinKick', power: 2.2, launch: 0.5, crit: true, word: 'KRUNCH!', stop: 'finisher', air: true }),
  M({ id: 'flyingKnee', name: 'Flying Knee', input: 'Sprint, kick', action: 'kick', clip: 'Knee_Flying', kind: 'spinKick', power: 2.2, launch: 6, crit: true, word: 'KNEE!', stop: 'finisher' }),
  M({ id: 'runUppercut', name: 'Running Uppercut', input: 'Sprint, punch', action: 'punch', clip: 'Punch_RunUppercut', kind: 'heavy', power: 1.8, launch: 3.4, word: 'UPPERCUT!', stop: 'heavy', react: 'head' }),
  M({ id: 'spinBackKick', name: 'Spinning Back Kick', input: 'Hold back from a goon, kick', action: 'kick', clip: 'Kick_SpinBack', kind: 'spinKick', power: 2.2, launch: 5, crit: true, word: 'THWACK!', stop: 'finisher' }),
  M({ id: 'spinBackfist', name: 'Spinning Backfist', input: 'Hold back from a goon, punch', action: 'punch', clip: 'Punch_Backfist', kind: 'heavy', power: 1.8, launch: 4.5, stop: 'heavy', react: 'spin' }),
  M({ id: 'sideRound', name: 'Roundhouse', input: 'Hold left or right of a goon, kick', action: 'kick', clip: 'Kick_SideRound', kind: 'kick', power: 1.6, launch: 2.5, react: 'spin' }),
  M({ id: 'sideHook', name: 'Hook', input: 'Hold left or right of a goon, punch', action: 'punch', clip: 'Punch_SideHook', kind: 'punch', power: 1.3, launch: 0, stop: 'punch', react: 'spin' }),
];
const byId = Object.fromEntries(MOVE_TABLE.map((m) => [m.id, m]));

export function selectMove({ action, dir = 'none', sprint = false, air = false, airFromSprint = false, targetDown = false, has = () => true }) {
  const pick = (id, clip) => {
    const m = byId[id];
    const c = clip ?? m.clip;
    return has(c) ? { ...m, clip: c } : null;
  };
  const kick = action === 'kick';
  if (targetDown) return kick ? pick('stomp') : null;
  if (air) {
    if (airFromSprint) return pick(kick ? 'hurricane' : 'leapSmash');
    if (!kick) return null;
    return dir === 'away' ? pick('backflipKick') : pick('airAxe');
  }
  if (sprint) return pick(kick ? 'flyingKnee' : 'runUppercut');
  if (dir === 'away') return pick(kick ? 'spinBackKick' : 'spinBackfist');
  if (dir === 'left' || dir === 'right') {
    const id = kick ? 'sideRound' : 'sideHook';
    return pick(id, byId[id].clip + (dir === 'left' ? '_L' : ''));
  }
  return null;
}
```

- [ ] **Step 4:** run the test → PASS. Run full `npx vitest run` → all pass.
- [ ] **Step 5:** commit `Move table: how Batman moves picks the strike (pure, tested)`.

### Task 2: Easier combos and auto-attach

**Files:**
- Modify: `src/combat/targeting.js` (new `selectAttackTarget`), `src/combat/combatSystem.js` (combo timeout/shield, chainT, input buffer, whiff, focus), `src/combat/combo.js` (unchanged API)
- Test: `tests/unit/targeting.test.js` (new cases)

**Interfaces:**
- Produces: `selectAttackTarget(origin, dir, enemies, { range, focus, focusRange = 6, allowDown, retargetAngle = 1.22 }) -> enemy|null`. Order: a goon within `retargetAngle` of a held `dir` (scored like selectTarget); else `focus` if alive and within `focusRange`; else the nearest within `range`. Never returns null while a valid goon is within range.

- [ ] **Step 1: failing tests** (enemies are `{ x, z, alive, down }` like the existing targeting tests)

```js
import { selectAttackTarget } from '../../src/combat/targeting.js';
const g = (x, z, o = {}) => ({ x, z, alive: true, down: false, ...o });
describe('selectAttackTarget', () => {
  it('auto-attaches to the nearest goon up to the range when nothing is in the held direction', () => {
    const far = g(0, -12);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, [far], { range: 14 })).toBe(far);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: 1 }, [g(0, -15)], { range: 14 })).toBeNull();
  });
  it('a held direction pointing at another goon retargets', () => {
    const a = g(0, 3), b = g(4, 0);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 1, z: 0 }, [a, b], { range: 14, focus: a })).toBe(b);
  });
  it('holding away from the focus keeps the focus', () => {
    const a = g(0, 3);
    expect(selectAttackTarget({ x: 0, z: 0 }, { x: 0, z: -1 }, [a], { range: 14, focus: a })).toBe(a);
  });
  it('a dead or distant focus is dropped for the nearest', () => {
    const a = g(0, 9), b = g(2, 0);
    expect(selectAttackTarget({ x: 0, z: 0 }, null, [a, b], { range: 14, focus: a })).toBe(b);
  });
});
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement** in targeting.js:

```js
// Attacks auto-attach: the goon in the held direction, else the focus (the one being fought),
// else the nearest in range. A press never whiffs while a goon is in range.
export function selectAttackTarget(origin, dir, enemies, { range = 14, focus = null, focusRange = 6, allowDown = false, retargetAngle = 1.22 } = {}) {
  const hasDir = dir && Math.hypot(dir.x, dir.z) > 0.2;
  if (hasDir) {
    const t = selectTarget(origin, dir, enemies, { range, allowDown, maxAngle: retargetAngle, closeRange: 0 });
    if (t && t !== focus) return t;
  }
  const ok = (e) => e && e.alive && (allowDown || !e.down) && enemies.includes(e);
  if (ok(focus) && Math.hypot(focus.x - origin.x, focus.z - origin.z) <= focusRange) return focus;
  return selectTarget(origin, null, enemies, { range, allowDown });
}
```

Note: when the held direction points at the focus itself, `t === focus` falls through to the focus branch (same goon).

In combatSystem.js:
- `createCombo({ timeout: 3.0, ready: effects.specialAt, shield: effects.comboShield + 1 })` and `applyEffects` → `combo.setShield(effects.comboShield + 1)`.
- `createInputBuffer(0.45)`.
- `chainT = 2.0` in strike().
- `let focus = null;` set `focus = target` in strike()/airKick() starts.
- tryStart punch/kick (ground): `selectAttackTarget(hero.pos, inputDir(ctx), list, { range: 14, focus, allowDown: true })`; air: `{ range: 16, focus }`.
- whiff(): remove `combo.miss()` (whiffs no longer reset the meter); keep `punchChain = kickChain = 0`.
- approach default `maxLunge = 14`.

- [ ] **Step 4:** targeting tests pass; full vitest passes (update any test asserting timeout 1.5 or whiff reset to the new rules, and say so in the commit).
- [ ] **Step 5:** commit `Combos are easy to keep and every attack auto-attaches to a goon`.

### Task 3: New clips (Mixamo to game)

**Files:**
- Modify: `scripts/mixamo-fetch.mjs` (MIXAMO_CLIPS), `src/config/mocap.js` (speed/start), `src/combat/strikeChoice.js` (bigger rotation), `src/config/mocapData.js` + `public/assets/anims_mocap.glb` (generated)
- Test: `tests/unit/assets.test.js`, `tests/unit/strikeChoice.test.js`

- [ ] **Step 1:** add to MIXAMO_CLIPS:

```js
  Punch_BodyHook: ['Hook', 'Mid Hook Punch To The Body'],
  Punch_ShortHook: ['Hook', 'Short Hook Punch To The Head'],
  Punch_BodyJab: ['Lead Jab', 'Mid Body Jab'],
  Punch_LeadUppercut: ['Boxing', 'Boxing Lead Hand Uppercut'],
  Elbow_Head: ['Illegal Elbow Punch', 'Illegal Elbow To The Head'],
  Punch_SideHook: ['Hook', 'Long Hook Punch To The Head'],
  Punch_RunUppercut: ['Surprise Uppercut', 'Attacker Chase Down Give Surprise Uppercut'],
  Kick_Push: ['Kicking', 'Male Thrust Kick With The Rear Foot'],
  Knee_Muay: ['Illegal Knee', 'Muay Thai Illegal Knee'],
  Kick_SideRound: ['Roundhouse Kick', 'Roundhouse Kick With Front Foot Advancing'],
  Kick_SpinBack: ['Kicking', 'Spinning Back Kick Advancing'],
  Knee_Flying: ['Flying Knee Punch Combo', 'Jumping Knee Followed By A Punch'],
  Kick_AirAxe: ['Inside Crescent Kick', 'Aerial 360 Degree Front Side Rotation Kick With Rear Foot'],
  Kick_Hurricane: ['Hurricane Kick', 'Flying Hurricane Kick'],
  Smash_Leap: ['Mutant Jump Attack', 'Mutant Jump Attack To Idle'],
  Kick_BackFlip: ['Flip Kick', 'Flipping Backwards To Kick'],
  Stomp: ['Stomp', 'Hard Floor Stomp'],
```

- [ ] **Step 2:** `node scripts/mixamo-fetch.mjs <those 17 names>` (needs the Mixamo Chrome on :9555), then `node scripts/fbx2glb.mjs assets-src/mixamo/<each>.fbx`.
- [ ] **Step 3:** append to the pack with `node scripts/retarget-mocap.mjs --map mixamo --append ...`: punches with `:hands`; kicks default limb; `Knee_Flying` with `@<knee contact>` (the jumping knee, not the follow-up punch) and `%end` trimmed there plus 0.5 s; `Punch_SideHook_L=...Punch_SideHook.glb:hands~mirror`, `Kick_SideRound_L=...Kick_SideRound.glb~mirror`; air moves `!noaim` off (aimed). Re-run once per clip that looks wrong on its sheet.
- [ ] **Step 4:** clip sheets: `node scripts/clip-sheet.mjs http://localhost:5202/ <out> <all 19 names>` on a fresh build; check each contact frame (red) is the blow landing; fix `@contact` where not.
- [ ] **Step 5:** `MOCAP_SPEED`/`MOCAP_START` per new clip so `(contact - start) / speed` is 0.15-0.3 s (punches/kicks), up to 0.4 s (air/running). Add to strikeChoice: `PUNCH_TIERS` tier 1 `+ 'Punch_BodyJab'`, tier 2 `+ 'Punch_ShortHook', 'Punch_BodyHook'`, tier 3 `+ 'Punch_LeadUppercut', 'Elbow_Head'`; `KICKS = ['Kick_Front', 'Kick_Push', 'Kick_Round', 'Kick_Low', 'Kick_Side', 'Knee_Muay']`. Update the strikeChoice "uses ... across a long fight" test to include the new punches; REACT entries: body hits `gut`, `Kick_Push` `gut`, `Knee_Muay` `gut`, `Elbow_Head` `head`.
- [ ] **Step 6:** full vitest passes; commit `Seventeen new mocap strikes: body shots, hooks, knees, push kick, spinning, flying and air kicks, stomp`.

### Task 4: Wire moves into combat

**Files:**
- Modify: `src/actors/hero.js` (`h.airFromSprint`), `src/combat/combatSystem.js` (strike/airKick use selectMove), `src/actors/enemy.js` (stomp bounce, push knockback)
- Test: `tests/unit/combatHarness.test.js` (new cases using the existing harness)

- [ ] **Step 1: hero.** In `h` add `airFromSprint: false`. At every takeoff into `setState('air')` from the ground jump (hero.js jump branch) set `h.airFromSprint = h.speed > 9`; on landing (where `h.airRuns = 0`) set it false.
- [ ] **Step 2: combat.** In tryStart (punch/kick):

```js
const dirV = inputDir(ctx);
const moveV = ctx.input.move.x || ctx.input.move.y ? dirV : { x: 0, z: 0 };
// ... target = selectAttackTarget(...)
const to = { x: target.pos.x - hero.pos.x, z: target.pos.z - hero.pos.z };
const mv = selectMove({
  action, dir: classifyDir(moveV, to), air: inAir && hero.state === 'air',
  airFromSprint: hero.airFromSprint, sprint: !inAir && (ctx.input.down('sprint') || hero.speed > 8),
  targetDown: target.down && target.alive && !target.air, has: (c) => hero.bat.animator.has(c),
});
```

  Air with `mv?.air` → `hero.control = airKick(target, 'jumpKick', mv)`; ground with `mv` → `hero.control = strike(action, target, mv)`; `null` → today's paths unchanged. `airKick(target, kind, mv)` plays `mv.clip` instead of `Kick_Flying` (contact from `reach[mv.clip]`), lands `landHit(mv.kind, target, { word: mv.word, power: mv.power, launch: mv.launch, crit: mv.crit, stopTime: STOP[mv.stop], react: mv.react })`. `strike(kind, target, mv)`: when `mv` is set, `clip = mv.clip`, `speed = strikeSpeed(clip, 1.3)`, `move = mv.kind`, counts toward the punch/kick chain like a normal press, and the hit uses mv's numbers in place of the clip if/else ladder. Movement moves emit `events.emit('moveLanded', { id: mv.id, name: mv.name })` on contact.
- [ ] **Step 3: enemy.** `react === 'stomp'` on a downed goon: stays down, `downT = Math.max(downT, 1.2)`, a 0.15 m bounce. Push kick: `Kick_Push` knock power x2.2 (combatSystem passes `power: 2.2` for it in REACT/landHit).
- [ ] **Step 4: tests** with the combat harness: sprinting + kick plays `Knee_Flying`; holding away + kick plays `Kick_SpinBack`; airborne + kick plays `Kick_AirAxe`; airborne from sprint + kick plays `Kick_Hurricane`; kick on a downed goon plays `Stomp`; a press with the only goon 12 m away still strikes it (auto-attach). Run → FAIL, implement, run → PASS; full vitest.
- [ ] **Step 5:** commit `Movement picks the strike: sprint, jump, sprint-jump, away and side moves, stomp`.

### Task 5: Names and help

**Files:**
- Modify: `src/ui/hud.js` or `src/game/game.js` (listener), `src/ui/menus.js` (Moves section)
- Test: `tests/unit/menus*.test.js` if one exists for help, else e2e in Task 6

- [ ] **Step 1:** on `moveLanded`, the first time per session each id lands, `events.emit('word', { text: name.toUpperCase() + '!', pos, big: true })` (reuse the existing comic word path; a `Set` of seen ids in game.js).
- [ ] **Step 2:** Help: a "Moves" section before "Moving around": one `<p class="tip"><b>name:</b> input</p>` per MOVE_TABLE row (dedupe the side rows), plus a first line "Hold a direction, sprint or jump while you punch or kick. Attacks find the nearest goon on their own."
- [ ] **Step 3:** commit `Move names pop the first time they land; Help lists every move`.

### Task 6: Verify and ship

- [ ] Clip sheets of all new clips reviewed.
- [ ] Scripted fight (`scripts/_moves.mjs`, headless, muted, `?fight=test&god=1` after the opening cinematic ends): performs every row with real keys (Shift+E, Space then E, Shift+Space then E, S+E, A+E, D+LMB, E on a downed goon) and logs `hero.bat.animator.currentName` at contact; every row must show its clip; a lone goon 12 m away is still struck.
- [ ] vitest, `npx playwright test`, `BASE=http://localhost:5202/ node scripts/playthrough.mjs`, `node scripts/webkit-check.mjs`, fight + main fps sweep A/B against the pre-change build (no p95 regression beyond noise).
- [ ] Fast-forward main, push, poll the deploy, live smoke (served GLB size, scripted fight on live).
- [ ] Update the project memory.
