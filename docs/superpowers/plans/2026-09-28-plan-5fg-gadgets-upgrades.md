# Plan 5FG: Gadgets, the Gadget Wheel and WayneTech Upgrades

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Part F (eight gadgets, a hold-to-open gadget wheel, a HUD gadget panel, marked breakables in the city) and Part G (XP from play, a level every 1,000 XP, four WayneTech trees of five upgrades with real numeric effects, a comic WayneTech page in the pause menu, and the Bat Swarm fourth chain takedown) of the full-game expansion spec.

**Architecture:**
- **Pure rules first, thin runtime.** Every number and rule lives in a pure, unit-tested module with no three.js and no DOM: the gadget registry and its charge and cooldown state (`gadgetDefs.js`, `gadgetState.js`), wheel picking (`wheelMath.js`), aiming maths (`aim.js`), sky lettering (`skyLetters.js`), breakable placements (`breakableSpots.js`), XP (`xp.js`), upgrade trees and their effects (`upgrades.js`), the Bat Swarm rules (`batSwarm.js`) and both save sanitizers.
- **One effects object.** `upgradeEffects(owned)` fills a single live object (`BASE_EFFECTS` shaped). Combat, the hero, the gadgets and the WayneTech runtime all read that same object, so buying an upgrade is `upgradeEffects(owned, effects)` plus one `apply()` call. The hooks into existing systems are small and named: `damageFactor`, `counterWindow`, the combo's `shield` and `ready`, Plan 4E's `getChainDiscount`, `hero.tuning` for traversal.
- **Gadgets are handlers.** `gadgetSystem.js` owns the wheel, the equipped gadget and firing. Each gadget is a small handler in `src/gadgets/g/` with `fire(sys, ctx)` and an optional `update(sys, real, dt, ctx)`. The fire key (the old batarang binding, now "Use gadget") still goes through combat's input buffer: `tryStart('batarang')` calls the `useGadget` hook, so gadgets fire the moment Batman is free, exactly like the batarang did.
- **Everything visual is pooled and pre-warmed.** `gadgetFx.js` builds every gadget visual once per run (gel blobs, smoke puffs, ice, confetti, lines, trail, debris) and never adds to the scene afterwards. `createGadgetWarm()` and `createSwarmWarm()` put one copy of each material and geometry into the boot warm cast (`warmCast.js`). The wheel DOM is laid out once while hidden.
- **Breakables are data.** Cracked walls (gel), glass signs (remote batarang), vent covers and weak railings (batclaw) are placed in `breakableSpots.js`, built by `src/world/breakables.js` with real collision boxes, and removed from collision with the new `collision.removeBox`. Broken ones and found caches save through Plan 3C's `registerProgressField`.

**Tech Stack:** Three.js 0.186, plain ES modules, Vitest 5 (node environment), Playwright 1.63 (`tests/e2e`), playwright-core scripted play (`scripts/dev-play.mjs`, `scripts/fps-sweep.mjs`, `scripts/playthrough.mjs`, `scripts/webkit-check.mjs`).

**Base:** Branch `gadgets`, cut from `main` **after** `perf` (comic look, `warmCast.js`, prewarm, dynamic resolution), `kicks` (mocap kicks, `approach()`, reach table, hit-stop), Plan 4E (`chains`) and Plan 3C (`content`) are all merged. Every file and line referenced below is as it stands after those merges. Where this plan says "after 4E" or "after 3C" it names the exact function or line those plans add.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-full-game-expansion-design.md`, Part F and Part G.
- **No em dashes** (U+2014) or en dashes (U+2013) in any player-visible text: prompts, hints, help, labels, sound words, captions, card text, the WayneTech page, upgrade names and effects. Use commas, colons or full stops. Task 27 greps for them.
- **Commits** are authored by Krishn Gohel only (check `git config user.name` prints `Krishn Gohel` before the first commit). Never add `Co-Authored-By` or any other trailer.
- **Never push.** Pushing `main` redeploys the live site. The coordinator reviews and pushes after Task 27.
- **Art is authored in code**: gadget icons are SVG paths written in `gadgetIcons.js`; brick, crack, grille, glass-sign and cache textures are drawn on canvases at run start; confetti lettering uses a 5x7 bitmap font written in `skyLetters.js`. No AI image tools, no downloaded art. All copy in this plan is Fable-authored.
- **Performance.** Keep 144 fps or better on the owner's laptop. In the fps sweep (`scripts/fps-sweep.mjs`, High, `dynres=0`), every row's p95 is at or under 6.9 ms and no frame is over 25 ms after the first 5 s. Every new material and geometry is in the warm cast (`src/game/warmCast.js`); every run object is created in `buildRun` before `begin()` calls `drawEverything`. No per-frame allocation in hot paths: the gadget system iterates `combat.enemies` directly (never `alive()`, which filters into a new array), writes into preallocated typed arrays and scratch vectors, and the HUD touches the DOM only when a numeric state code changes.
- **Load time.** The first frame stays near 3 s. This plan adds no asset files. Textures are drawn on canvases in code: the two the warm cast needs (a 128 px smoke puff and a 4 px stand-in) at boot, every other one (bricks, cracks, grilles, the glass sign, the cache crate) in `buildRun`.
- **Pure modules** import nothing from three.js, the DOM or `src/ui/`. They may import other pure data modules (`story.js`, `save.js`, `mapData.js`, `balloonSpots.js`, `mansi.config.js`, `chains.js`, `progressTracker.js`).
- **Keys.** Plan 4E owns `Digit1`, `Digit2`, `Digit3` (chains) and Y plus D-pad left, up, right (pad chords). Plan 3C owns `KeyO` and D-pad up alone (photo). This plan adds `Tab` (gadget wheel), `Digit4` (Bat Swarm, `chain4`), RB hold (wheel) and Y plus LB (Bat Swarm on the pad). Keys 1 to 8 pick wheel slots only while the wheel is open, and the wheel swallows those presses so no chain fires.
- **Browser checks run against a frozen production build only** (the dev server reloads on every edit):
  ```bash
  npx vite build --outDir "$TEMP/g5dist"
  npx vite preview --outDir "$TEMP/g5dist" --port 5208 --strictPort
  ```
  Rebuild after each code change you want to check. URL flags: `?at=<stepId>`, `?god=1`, `?new=1`, `?fight=test`, `?dynres=0`, and the new `?gadgets=all` (unlocks every gadget for this run only, never saved).
- `window.__game` already exposes `hero`, `follow`, `combat`, `enemies`, `camera`, `world`, `ink`, `events`, `progress`, `state`, `time`, `climbables`, `teleport(site|{x,y,z})`, `spawn(type, p)`, `winFight()`, `comic`, `side`, `photo`. This plan adds `gadgets`, `wayne`, `breakables`, `gfx`.

## File Structure

| File | Responsibility |
|---|---|
| `src/core/time.js` (modify) | `hold(id, scale)` and `release(id)`: sustained slow time for the wheel and remote steering |
| `src/world/collision.js` (modify) | `removeBox(box)` for broken walls |
| `src/combat/combo.js` (modify) | `shield` (hits a combo survives), `setReady`, `setShield`, `readyAt`; `damaged()` returns whether it broke |
| `src/world/climbables.js` (modify) | Per-line `sag` (launcher lines are taut) |
| `src/gadgets/gadgetDefs.js` (new) | Pure: the eight gadgets, wheel order, unlock rules and copy |
| `src/gadgets/gadgetState.js` (new) | Pure: equip, unlock, charges, cooldowns, HUD state code |
| `src/gadgets/gadgetSave.js` (new) | Pure: `progress.gadgets` sanitizer and registration; tracker category `caches` |
| `src/gadgets/wheelMath.js` (new) | Pure: slot from a direction, a key, or a mouse cursor; hold logic |
| `src/gadgets/aim.js` (new) | Pure: aimed picks, launcher line, gel spot, steering, yank arc |
| `src/gadgets/skyLetters.js` (new) | Pure: 5x7 bitmap font and the birthday line as points |
| `src/world/breakableSpots.js` (new) | Pure: the 15 breakables and 6 caches, room, cage and rail maths |
| `src/progress/xp.js` (new) | Pure: XP table, levels, points, combo and medal XP, combo runs |
| `src/progress/upgrades.js` (new) | Pure: four trees of five, prerequisites, `upgradeEffects`, damage factor, regen |
| `src/progress/wayneSave.js` (new) | Pure: `progress.wayne` sanitizer and registration; tracker category `wayneTech` |
| `src/core/bindings.js` (modify) | Actions `gadgetWheel` (Tab) and `chain4` (Digit4); batarang labelled "Use gadget" |
| `src/core/input.js` (modify) | RB tap and hold, `PAD_CHORDS.chain4`, `codePressed`, `swallow` |
| `src/combat/rules.js` (modify) | Moves `gel`, `remote`, `claw`, `smoke`, `popper`, `shatter` |
| `src/actors/enemy.js` (modify) | `freeze`, `thaw`, `dance`, `lose`, `yank`; states `frozen`, `dance`; any hit shatters ice |
| `src/combat/chains.js` (modify) | A frozen goon can't be chained |
| `src/combat/combatSystem.js` (modify) | Effects hooks, `useGadget`, `gadgetApi`, `areaBlast`, `shatter`, multi-target batarang, `ctx.lockInput`, Bat Swarm start |
| `src/game/fx.js` (modify) | Pooled batarangs, `getTarget(out)` |
| `src/ui/hud.js` (modify) | `setCombo(n, readyAt)` |
| `src/actors/hero.js`, `src/actors/traverse/{wallrun,ladder,divebomb,zipline}.js` (modify) | `hero.tuning` hooks, `wallRunVy`, zip options `minSpeed`, `onEvent`, `offEvent`, `line` |
| `src/gadgets/gadgetFx.js` (new) | Pooled gadget visuals and `createGadgetWarm()` |
| `src/game/warmCast.js` (modify) | Gadget and swarm warm copies |
| `src/world/breakables.js` (new) | Builds breakables and caches, collision, smashing, pickups, placement check |
| `src/gadgets/gadgetSystem.js` (new) | Wheel, equip, fire, handler updates, unlock announcements, help list |
| `src/gadgets/g/index.js`, `batarang.js`, `remote.js`, `gel.js`, `smoke.js`, `launcher.js`, `claw.js`, `freeze.js`, `popper.js` (new) | The handler registry and one handler per gadget |
| `src/ui/gadgetIcons.js` (new) | Code-drawn ink icons |
| `src/ui/gadgetWheel.js` (new) | The radial comic-panel wheel |
| `src/ui/gadgetHud.js` (new) | Equipped gadget panel, charges and cooldown, the Bat Swarm icon |
| `src/game/camera.js` (modify) | Camera mode `remote` |
| `src/progress/wayneTech.js` (new) | XP wiring, level-ups, buying, applying effects, regen |
| `src/combat/batSwarm.js` (new) | Pure Bat Swarm rules and timeline, plus its hero control |
| `src/game/swarmFx.js` (new) | Instanced bats and `createSwarmWarm()` |
| `src/ui/menus.js`, `src/ui/prompts.js`, `src/ui/style.css` (modify) | WayneTech page, pause button, gadget help, prompts, styles |
| `src/audio/sfx.js`, `src/game/sound.js` (modify) | Gadget, upgrade and swarm sounds |
| `src/game/game.js` (modify) | Wiring, camera focus, wheel look lock, hints, cards, pause, `?gadgets=all` |
| `scripts/breakables-check.mjs` (new) | Validates every breakable against the live city |
| `scripts/fps-sweep.mjs` (modify) | `gadgets` page: a row per gadget and the wheel |
| `tests/unit/timeHolds.test.js`, `gadgetState.test.js`, `wheelMath.test.js`, `aim.test.js`, `skyLetters.test.js`, `breakableSpots.test.js`, `saveGadgets.test.js`, `xp.test.js`, `upgrades.test.js`, `combatHooks.test.js`, `traverseTuning.test.js`, `gadgetSystem.test.js`, `wayneTech.test.js`, `batSwarm.test.js` (new) | Unit tests |
| `tests/unit/collision.test.js`, `combat.test.js`, `climbables.test.js`, `bindings.test.js`, `input.test.js`, `chains.test.js`, `prompts.test.js` (modify) | Unit tests |
| `tests/e2e/gadgets.spec.js` (new) | Browser tests: wheel, gel wall, WayneTech purchase survives a reload |

## Shared interfaces (every task relies on these exact names)

```js
// src/core/time.js
time.hold(id, scale)          // sustained slow-down until released; the slowest hold wins; stacks with slowMo
time.release(id)
time.held -> number           // current hold scale (1 when none)

// src/world/collision.js
collision.removeBox(box) -> boolean   // box.removed = true; gone from query, groundBelow, resolveCylinder, raycast

// src/combat/combo.js
createCombo({ timeout = 1.5, ready = 8, shield = 0 })
combo.damaged() -> boolean    // true when the hit broke the combo; a shield absorbs `shield` hits per combo run
combo.setReady(n), combo.setShield(n), combo.readyAt, combo.take(n) (Plan 4E)

// src/world/climbables.js
zipSag(line, s)               // uses line.sag when set, else ZIP_SAG

// src/gadgets/gadgetDefs.js (pure)
GADGETS                       // wheel order: batarang, remote, gel, smoke, launcher, claw, freeze, popper
// def: { id, slot, name, kind: 'free'|'cooldown'|'charges', cooldown?, max?, recharge?, unlock: null|{ step }|{ finished: true },
//        unlockText, promptId, cardText }
GADGET_IDS, gadgetById(id), isUnlocked(def, progress, steps), unlockedIds(progress, steps, sticky = [])

// src/gadgets/gadgetState.js (pure)
createGadgetState({ equipped = 'batarang', unlocked = ['batarang'], tune = {} })
  -> { equipped, unlocked (Set), equip(id) -> boolean, unlock(ids) -> newIds[], isUnlocked(id), ready(id), use(id) -> boolean,
       tick(dt), status(id, out = {}) -> Status, hudCode(id) -> number }
// Status: { id, name, kind, ready, charges, max, cool, total, frac, text }
// tune: the live effects object; `${id}Cooldown` overrides a cooldown (smokeCooldown)

// src/gadgets/gadgetSave.js (pure; registers progress field 'gadgets' and tracker category 'caches' at load)
sanitizeGadgetSave(raw) -> { equipped, unlocked: id[], broken: id[], caches: id[] }

// src/gadgets/wheelMath.js (pure)
WHEEL_SLOTS = 8, WHEEL_DIGITS = ['Digit1', ..., 'Digit8']
slotFromDir(x, y, { slots = 8, dead = 0.35 } = {}) -> 0..7 | null   // 0 at the top, clockwise, screen y down
slotFromCode(code) -> 0..7 | null
slotCenter(i, radius, slots = 8) -> { x, y }
createWheelCursor({ pxPerUnit = 110 } = {}) -> { x, y, reset(), move(dx, dy), slot(opts) }
createWheelLogic() -> { open, pick, press(current), choose(i), release(isUnlocked) -> slot|null, cancel() }

// src/gadgets/aim.js (pure; points are { x, y, z }; collision is the createCollision API)
pickAimedMany(items, eye, dir, n, { range = 20, maxAngle = 0.35, lift = 1.1, filter = () => true } = {}) -> item[]
pickAimed(items, eye, dir, opts) -> item | null
lineBetween(a, b, sag = 0) -> line      // zipline-shaped: { id: -1, a, b, length, dir, sag }
launcherLine(collision, pos, yaw, { range = 40, min = 6, heights = [0.3, 1.2, 2.1], hang = 2.05, back = 0.6 } = {})
  -> { ok: true, line, dist } | { ok: false, reason: 'none'|'short' }
gelSpot(collision, eye, dir, { range = 14 } = {}) -> { x, y, z, nx, ny, nz } | null
inRadius(c, p, r, dy = 2.5) -> boolean
steerDir(cur, want, dt, rate, out) -> out
yankVelocity(from, to, g = 24) -> { vx, vy, vz, t }

// src/gadgets/skyLetters.js (pure)
GLYPHS, textLines(text, maxPerLine = 14) -> string[], birthdayLine(name) -> 'HAPPY BIRTHDAY NAME!'
letterPoints(text, { cell = 0.5, maxPerLine = 14, lineGap = 2 } = {}) -> { points: [{ x, y }], width, height }

// src/world/breakableSpots.js (pure)
FACES, faceFromNormal(nx, nz), BREAKABLES, BREAKABLE_IDS, CACHES, CACHE_IDS, cacheById(id)
roomWalls(room, t = 0.3) -> { weak: Box, solid: Box[], roof: Box | null }
cageRoom(ladder, opts) -> room
nearestLadder(ladders, x, z, { maxBottom = 0.5, within = 12 } = {}) -> ladder | null
roofEdgeRail(box, sx, sz, len = 6, opts) -> Box & { nx, nz, face }
boxDistance(box, p) -> number
// Box: { minX, minY, minZ, maxX, maxY, maxZ }

// src/progress/xp.js (pure)
XP_PER_LEVEL = 1000, XP, MEDAL_XP, levelOf(xp), pointsEarned(xp), pointsFree(xp, spent), toNext(xp) -> { into, need, fraction }
comboXp(peak, variety), chainXp(count, stealth), medalXp(prev, next), levelsCrossed(before, after) -> number[]
createComboRun() -> { note(move, value), close() -> { peak, variety }, peak }

// src/progress/upgrades.js (pure)
TREES, UPGRADES, UPGRADE_IDS, BASE_EFFECTS, upgradeEffects(owned, out = {}) -> effects
canBuy(owned, id, free) -> { ok, reason: null|'unknown'|'owned'|'locked'|'points' }
upgradeStatus(owned, id, free) -> 'owned'|'buyable'|'poor'|'locked'
damageFactor(kind, effects) -> number
regenStep(health, max, { calm, sinceHurt }, effects, dt) -> number

// src/progress/wayneSave.js (pure; registers progress field 'wayne' and tracker category 'wayneTech' at load)
sanitizeWayneSave(raw) -> { xp, owned: id[], medals: { [challengeId]: medal } }

// src/core/bindings.js: actions 'gadgetWheel' (Tab) and 'chain4' (Digit4); 'batarang' is labelled 'Use gadget'
// src/core/input.js
PAD_WHEEL = 5, PAD_TAP = 0.22, createHoldTap(holdTime) -> { holding, update(isDown, dt) -> 'tap'|'hold'|'release'|null }
PAD_CHORDS.chain4 = 4           // Y plus LB
input.codePressed(code) -> boolean, input.swallow(code)

// src/combat/rules.js: MOVES.gel, remote, claw, smoke, popper, shatter

// src/actors/enemy.js
e.freeze(sec) -> wasAttacking, e.thaw(), e.dance(sec) -> wasAttacking, e.lose(sec, from), e.yank(to) -> wasAttacking
e.frozenT, e.danceT, e.lostT, e.shattered   // states 'frozen' and 'dance'

// src/combat/combatSystem.js
createCombat({ ..., getChainDiscount = () => effects.chainDiscount, effects = BASE_EFFECTS, useGadget = null })
combat.gadgetApi -> { landHit(move, target, opts), areaBlast(center, radius, move, opts) -> count, canSee(e), inputDir(ctx, ranged),
                      alive(), director, critical(target, opts), batarang(targets, fx) -> control }
combat.applyEffects(), combat.swarm -> { show, affordable, cost }
ctx.lockInput (true while the wheel is open: combat buffers nothing), ctx.swarmFx
// events: iceShatter { target, pos }, swarmStart { count }, swarmDone { count }

// src/game/fx.js: fx.batarang(from, getTarget(out) -> out, onHit)   (pooled)
// src/ui/hud.js: hud.setCombo(n, readyAt = 8)

// src/actors/hero.js: hero.tuning (defaults below; game.js points it at the effects object)
//   { boostUp: 15, boostOut: 9, diveGain: 1, glideMax: 48, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4 }
// src/actors/traverse/wallrun.js: wallRunVy(t, dur = 1.2)
// src/actors/traverse/zipline.js
createZipControl(h, { events }, { line, s = 0, minSpeed = 0, onEvent = 'zipOn', offEvent = 'zipOff' }) -> { name: 'zip', line, ... }

// src/gadgets/gadgetFx.js
GFX_LIMITS, gadgetMaterials(), createGadgetWarm() -> Group
createGadgetFx(scene) -> {
  gel: { place(spot) -> slot|-1, clear(slot), clearAll() },
  smoke: { burst(center, radius, life = 6) },
  ice: { attach(enemy) -> slot|-1, release(slot, shatter), throw(from, getTarget, onHit) },
  confetti: { burst(center, count), letters(from, anchor, right, points) },
  lines: { set(name, a, b), hide(name) },          // names: 'launcher', 'claw'
  trail: { start(p), push(p), stop() },
  debris: { burst(center, color, count, speed) },
  update(dt, real),
}

// src/world/breakables.js
createBreakables({ scene, collision, climbables, progress, save, events, gfx })
  -> { items, caches, smash(item, from) -> boolean, forNear(pos, r, kind, fn), aimed(eye, dir, range, kinds) -> item|null,
       update(t, heroPos), check(sites) -> report[] }
// item: { id, kind, spot, box, mesh, broken, center: Vector3, normal: { nx, nz } }

// src/gadgets/gadgetSystem.js
createGadgetSystem({ hero, combat, follow, time, events, input, fx, gfx, breakables, progress, save, collision, camera,
                     effects, wheelUi, gadgetHud, getBindings, isPlaying, devAll = false, factories = HANDLER_FACTORIES })
  -> { state, fire(ctx, { inAir }) -> boolean, update(real, dt, ctx), equip(id) -> boolean, openWheel(), closeWheel(apply = true),
       interrupt(), refresh(), wheelOpen, cameraFocus, cameraMode, unlockCheck(), helpList(bindings) -> [{ name, html }], handler(id), debug }
// src/gadgets/g/index.js: HANDLER_FACTORIES { [id]: () => handler }   (each gadget task adds its line)
// handler: { id, retry?: boolean, manualSpend?: boolean, fire(sys, ctx, opts) -> boolean, update?(sys, real, dt, ctx), cancel?(sys) }
// sys (what handlers get): { hero, combat, api, follow, time, events, input, fx, gfx, breakables, collision, camera, state, effects,
//                            progress, cameraFocus, cameraMode, wheelOpen, hint(id, arg), pose(clip, dur, timeScale) }

// src/ui/gadgetIcons.js: GADGET_ICONS { [id]: svgInner }, LOCK_ICON
// src/ui/gadgetWheel.js: createGadgetWheel(root) -> { show(unlocked: boolean[8], pick, info), setPick(i, info), setInfo(info), hide(), warm() }
//   info: { name, text }
// src/ui/gadgetHud.js: createGadgetHud(root) -> { set(code, status, keyLabel), setSwarm(state, keyLabel), setVisible(v) }

// src/progress/wayneTech.js
createWayneTech({ events, progress, save, hero, combat, hud, effects, baseHealth })
  -> { effects, xp, level, free, award(amount, source), buy(id) -> result, page() -> PageData, apply(), update(dt) }
// PageData: { level, xp, into, need, fraction, free, allOwned, trees: [{ id, name, upgrades: [{ id, name, text, tier, state }] }] }

// src/ui/menus.js
menus.wayneTechPage(data, { onBuy(id), onBack, focus }), menus.setGadgetHelp(fn), pause opts.onWayneTech, opts.info.wayneFree

// src/combat/batSwarm.js
SWARM, swarmTargets(origin, enemies, opts) -> enemy[]|null, swarmAvailability({ owned, combo, origin, enemies, discount }),
swarmTimeline(count) -> { steps: [{ at, kind: 'hold'|'stagger'|'finish'|'end', index }], duration },
createSwarmControl(hero, api, { targets, timeline, fx })
// src/game/swarmFx.js: createSwarmFx(scene) -> { start(targets), rise(), stop(), update(dt), active }, createSwarmWarm() -> Group

// New events
// gadgetUnlocked {id}, gadgetEquip {id}, wheelOpen, wheelClose, wheelPick {slot}, remoteStart, remoteWhirr, remoteHit {target},
// remoteEnd {why}, gelSpray {pos}, gelBlast {pos, count}, smoke {pos, radius, count}, launcherFire {pos}, launcherOn, launcherOff,
// clawYank {count}, clawRip {target}, freeze {target}, iceShatter {target, pos}, popper {pos, count}, glassBroken {id, pos},
// wallBroken {id, pos}, ventOpen {id, pos}, railingDown {id, pos}, cacheFound {id, xp}, xp {amount, source, xp},
// levelUp {level, points}, upgradeBought {id}, swarmStart {count}, swarmDone {count}
// Hint ids (hint event now carries an optional `arg`): gadget-cooldown, gadget-empty, gadget-boss, remote-ground, gel-aim, gel-none,
// gel-full, launcher-none, launcher-short, claw-none, claw-ground, freeze-none, popper-ground, swarm-locked, swarm-cost, swarm-targets
```

### The eight gadgets at a glance

| Slot | Gadget | Use | Numbers | Unlocks |
|---|---|---|---|---|
| 1 | Batarang | R throws at the goon you steer toward (as today) | free; Triple Batarang throws up to 3 | always |
| 2 | Remote batarang | R, then steer with the mouse (camera) | 3 s flight at 24 m/s, world at 30%, cooldown 4 s | `toMonarch` |
| 3 | Explosive gel | tap R sprays a blob (floor or wall, up to 14 m), hold R 0.35 s sets all off | 3 charges, 1 back every 5 s, 4 m knockdown (5.5 m upgraded), breaks cracked walls within 1.6 m | `toNeon` |
| 4 | Smoke pellet | R drops a cloud at Batman's feet | 5 m across, stun 3 s and lose track 5 s, cooldown 12 s (7 s upgraded) | `toStreet` |
| 5 | Line launcher | R fires a level line to the wall ahead and rides it | 6 to 40 m, rides at 18 m/s or more, cooldown 1.5 s, works mid-glide | `toAce` |
| 6 | Batclaw | R yanks the aimed goon (2 upgraded) or tears down a vent or railing | 20 m, brutes lose their armor for 4 s, cooldown 2 s | `toYard` |
| 7 | Freeze blast | R throws an ice grenade at the aimed goon | 5 s ice (8 s upgraded), any hit shatters and KOs, 2 charges, 1 back every 10 s | `toVat` |
| 8 | Party popper | R throws confetti 5 m ahead | goons in 6 m dance, stunned, for 3 s; sky lettering; cooldown 20 s | after the credits |

### The four WayneTech trees (each needs the one above it; 1 point each)

| Tier | Armor | Combat | Gadgets | Traversal |
|---|---|---|---|---|
| 1 | Reinforced Plating: max health +25 | Quick Reflexes: counter window 0.15 s longer | Triple Batarang: up to 3 batarangs, one per goon | Grapple Accelerator: boost 15 to 19 m/s up, 9 to 11 out |
| 2 | Kevlar Weave: knives and thrown gags hurt 30% less | Steady Flow: the first hit you take in a combo doesn't break it | Bigger Bang: gel blast 4 m to 5.5 m | Aerodynamic Cape: glide dives build speed 30% faster, top speed 48 to 56 m/s |
| 3 | Titanium Plating: max health +25 more | Efficient Chains: chain takedowns cost 2 less | Quick Smoke: smoke cooldown 12 s to 7 s | Wall Grip Boots: wall runs 1.2 s to 1.8 s |
| 4 | Field Medic: out of a fight, health returns after 2.5 s instead of 6 s at 12 instead of 4 per second | Fast Finish: special takedown at combo 6 instead of 8 | Double Claw: the batclaw pulls two goons | Slide Rails: ladder slides 9 to 14 m/s |
| 5 | Impact Dampers: every hit hurts 15% less | Bat Swarm: chain takedown 4 at combo 15 | Deep Freeze: ice lasts 5 s to 8 s | Seismic Landing: dive-bomb shockwave 4 m to 6 m |

---

### Task 1: Time holds, collision removal, combo shield and taut lines

**Files:**
- Modify: `src/core/time.js`, `src/world/collision.js`, `src/combat/combo.js`, `src/world/climbables.js`
- Test: `tests/unit/timeHolds.test.js` (new), `tests/unit/collision.test.js`, `tests/unit/combat.test.js`, `tests/unit/climbables.test.js`

**Interfaces:**
- Consumes: Plan 4E's `combo.take(n)` (kept as is).
- Produces: `time.hold`, `time.release`, `time.held`; `collision.removeBox`; `createCombo({ shield })`, `combo.damaged() -> boolean`, `combo.setReady`, `combo.setShield`, `combo.readyAt`; `line.sag`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/timeHolds.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createTimeControl } from '../../src/core/time.js';

describe('time holds', () => {
  it('a hold scales game time until it is released', () => {
    const t = createTimeControl();
    t.hold('wheel', 0.2);
    expect(t.scale(0.1)).toBeCloseTo(0.02);
    expect(t.held).toBeCloseTo(0.2);
    t.release('wheel');
    expect(t.scale(0.1)).toBeCloseTo(0.1);
    expect(t.held).toBe(1);
  });
  it('the slowest hold wins, and it stacks with slow motion', () => {
    const t = createTimeControl();
    t.hold('a', 0.5);
    t.hold('b', 0.2);
    expect(t.scale(0.1)).toBeCloseTo(0.02);
    t.slowMo(1, 0.5);
    expect(t.scale(0.1)).toBeCloseTo(0.01);
    t.release('b');
    expect(t.scale(0.1)).toBeCloseTo(0.025);
  });
  it('hit-stop still freezes time under a hold', () => {
    const t = createTimeControl();
    t.hold('wheel', 0.2);
    t.hitStop(0.05);
    expect(t.scale(0.03)).toBe(0);
    expect(t.scale(0.1)).toBeCloseTo(0.08 * 0.2);
  });
  it('releasing an unknown hold is harmless, and scales are clamped', () => {
    const t = createTimeControl();
    t.release('nope');
    t.hold('x', 5);
    expect(t.held).toBe(1);
    t.hold('x', -1);
    expect(t.held).toBeCloseTo(0.01);
  });
});
```

Append to `tests/unit/collision.test.js`:

```js
describe('removeBox', () => {
  it('takes a box out of every query', () => {
    const c = createCollision();
    const wall = c.addBox(-1, 0, 4, 1, 3, 4.3, 'breakable');
    const o = { x: 0, y: 1, z: 0 }, d = { x: 0, y: 0, z: 1 };
    expect(c.raycast(o, d, 10)?.box).toBe(wall);
    expect(c.removeBox(wall)).toBe(true);
    expect(wall.removed).toBe(true);
    expect(c.raycast(o, d, 10)).toBe(null);
    expect(c.query(-2, 3, 2, 5)).not.toContain(wall);
    const p = { x: 0, y: 0, z: 4.15 };
    expect(c.resolveCylinder(p, 0.35, 1.8).hitWall).toBe(false);
    expect(c.removeBox(wall)).toBe(false);
  });
  it('a removed floor box is no longer ground', () => {
    const c = createCollision({ floor: () => 0 });
    const slab = c.addBox(-2, 0, -2, 2, 3, 2, 'shed');
    expect(c.groundBelow(0, 5, 0)).toBe(3);
    c.removeBox(slab);
    expect(c.groundBelow(0, 5, 0)).toBe(0);
  });
});
```

(If `createCollision` isn't imported at the top of that file yet, add `import { createCollision } from '../../src/world/collision.js';`.)

Append to `tests/unit/combat.test.js` (it already imports `createCombo`):

```js
describe('combo shield and threshold (WayneTech)', () => {
  it('damaged() breaks a combo and says so', () => {
    const c = createCombo();
    for (let i = 0; i < 4; i++) c.hit();
    expect(c.damaged()).toBe(true);
    expect(c.value).toBe(0);
  });
  it('a shield absorbs one hit per combo run', () => {
    const c = createCombo({ shield: 1 });
    for (let i = 0; i < 5; i++) c.hit();
    expect(c.damaged()).toBe(false);
    expect(c.value).toBe(5);
    expect(c.damaged()).toBe(true);
    expect(c.value).toBe(0);
    c.hit();
    expect(c.damaged()).toBe(false);
    expect(c.value).toBe(1);
  });
  it('an absorbed hit restarts the timeout', () => {
    const c = createCombo({ timeout: 1.5, shield: 1 });
    c.hit();
    c.tick(1.4);
    c.damaged();
    c.tick(1.4);
    expect(c.value).toBe(1);
  });
  it('setShield and setReady change the rules live', () => {
    const c = createCombo();
    c.setShield(1);
    c.hit();
    expect(c.damaged()).toBe(false);
    for (let i = 0; i < 5; i++) c.hit();
    expect(c.ready).toBe(false);
    c.setReady(6);
    expect(c.ready).toBe(true);
    expect(c.readyAt).toBe(6);
  });
  it('an empty combo takes damage without using the shield', () => {
    const c = createCombo({ shield: 1 });
    expect(c.damaged()).toBe(true);
    c.hit();
    expect(c.damaged()).toBe(false);
  });
});
```

Append to `tests/unit/climbables.test.js` (it imports `addZipline`, `zipSag`, `createClimbables`; add any that are missing):

```js
describe('line sag', () => {
  it('a line with sag 0 is taut, others sag by ZIP_SAG', () => {
    const c = createClimbables();
    const a = addZipline(c, { x: 0, y: 10, z: 0 }, { x: 40, y: 10, z: 0 });
    expect(zipSag(a, 20)).toBeCloseTo(40 * 0.03);
    expect(zipSag({ ...a, sag: 0 }, 20)).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/timeHolds.test.js tests/unit/collision.test.js tests/unit/combat.test.js tests/unit/climbables.test.js`
Expected: FAIL (`hold`, `removeBox`, the shield and `sag` don't exist yet).

- [ ] **Step 3: Replace `src/core/time.js`**

```js
// Converts real frame time into game time, applying hit-stop freezes, slow motion and holds.
// A hold is a sustained slow-down that lasts until released (the gadget wheel, remote batarang
// steering). Several holds at once: the slowest wins. Holds stack with slow motion.
export function createTimeControl() {
  let stop = 0;
  let slow = 0;
  let slowScale = 1;
  const holds = new Map();
  let holdScale = 1;
  const refresh = () => {
    holdScale = 1;
    for (const s of holds.values()) holdScale = Math.min(holdScale, s);
  };
  return {
    hitStop(sec) { stop = Math.max(stop, sec); },
    slowMo(sec, scale) { slow = Math.max(slow, sec); slowScale = scale; },
    hold(id, scale) { holds.set(id, Math.min(1, Math.max(0.01, scale))); refresh(); },
    release(id) { if (holds.delete(id)) refresh(); },
    scale(dt) {
      if (stop > 0) {
        const used = Math.min(stop, dt);
        stop -= used;
        dt -= used;
        if (dt <= 1e-9) return 0;
      }
      let out = dt;
      if (slow > 0) { slow -= dt; out = dt * slowScale; }
      return out * holdScale;
    },
    get held() { return holdScale; },
    get stopped() { return stop > 0; },
    get debug() { return { stop, slow, slowScale, holdScale }; },
  };
}
```

- [ ] **Step 4: `removeBox` in `src/world/collision.js`.** Add after `addBox`:

```js
  // Takes a box out of the world (a cracked wall blown open, a railing torn down). Its id stays
  // reserved so the query stamps stay valid.
  function removeBox(box) {
    if (!box || box.removed) return false;
    box.removed = true;
    for (let i = Math.floor(box.minX / cell); i <= Math.floor(box.maxX / cell); i++) {
      for (let j = Math.floor(box.minZ / cell); j <= Math.floor(box.maxZ / cell); j++) {
        const list = grid.get(key(i, j));
        const at = list ? list.indexOf(box) : -1;
        if (at >= 0) list.splice(at, 1);
      }
    }
    return true;
  }
```

In `queryAll`, change the condition to `if (!b.removed && b.maxX >= minX && ...)`. Change the returned object to include it: `return { addBox, removeBox, query: ..., groundBelow, resolveCylinder, raycast, boxes };`.

- [ ] **Step 5: Replace `src/combat/combo.js`.** This keeps Plan 4E's `take(n)` exactly:

```js
// Freeflow combo counter. Pure.
// ready: combo needed for a special takedown (8; WayneTech "Fast Finish" makes it 6).
// shield: hits taken that a combo run survives (WayneTech "Steady Flow" gives 1).
export function createCombo({ timeout = 1.5, ready = 8, shield = 0 } = {}) {
  let value = 0, clock = 0, best = 0, shieldLeft = 0;
  const reset = () => { value = 0; clock = 0; };
  return {
    hit() {
      if (value === 0) shieldLeft = shield;
      value += 1;
      clock = timeout;
      best = Math.max(best, value);
    },
    miss: reset,
    // Batman took a hit. Returns true when that broke the combo.
    damaged() {
      if (value > 0 && shieldLeft > 0) { shieldLeft -= 1; clock = timeout; return false; }
      reset();
      return true;
    },
    spend: reset,
    // Chain takedowns (Plan 4E): spend part of the combo and keep the rest.
    take(n) { value = Math.max(0, value - n); clock = timeout; },
    tick(dt) {
      if (value === 0) return;
      clock -= dt;
      if (clock <= 0) reset();
    },
    setReady(n) { ready = n; },
    setShield(n) { shield = n; },
    get value() { return value; },
    get ready() { return value >= ready; },
    get readyAt() { return ready; },
    get best() { return best; },
  };
}
```

- [ ] **Step 6: Per-line sag in `src/world/climbables.js`.** Change the body of `zipSag` to:

```js
  return Math.sin((Math.PI * s) / line.length) * line.length * (line.sag ?? ZIP_SAG);
```

- [ ] **Step 7: Run all unit tests**

Run: `npx vitest run`
Expected: PASS, including Plan 4E's `combo.take` tests and every older combo test (`damaged()` still resets an unshielded combo).

- [ ] **Step 8: Commit**

```bash
git config user.name   # must print: Krishn Gohel
git add src/core/time.js src/world/collision.js src/combat/combo.js src/world/climbables.js tests/unit/timeHolds.test.js tests/unit/collision.test.js tests/unit/combat.test.js tests/unit/climbables.test.js
git commit -m "Time holds, removable collision boxes, combo shield and taut lines"
```

---

### Task 2: Gadget registry and gadget state

**Files:**
- Create: `src/gadgets/gadgetDefs.js`, `src/gadgets/gadgetState.js`
- Test: `tests/unit/gadgetState.test.js`

**Interfaces:**
- Consumes: `STEPS` (`src/game/story.js`).
- Produces: everything listed for `gadgetDefs.js` and `gadgetState.js`. (The `progress.gadgets` save field comes in Task 4, because it validates breakable and cache ids.)

- [ ] **Step 1: Write the failing test.** Create `tests/unit/gadgetState.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { GADGETS, GADGET_IDS, gadgetById, isUnlocked, unlockedIds } from '../../src/gadgets/gadgetDefs.js';
import { createGadgetState } from '../../src/gadgets/gadgetState.js';
import { STEPS } from '../../src/game/story.js';

const stepOf = (id) => STEPS.findIndex((s) => s.id === id);
const prog = (o = {}) => ({ step: 0, finished: false, ...o });

describe('gadget registry', () => {
  it('has the eight gadgets in wheel order', () => {
    expect(GADGET_IDS).toEqual(['batarang', 'remote', 'gel', 'smoke', 'launcher', 'claw', 'freeze', 'popper']);
    GADGETS.forEach((g, i) => expect(g.slot).toBe(i));
    expect(gadgetById('gel').name).toBe('Explosive Gel');
    expect(gadgetById('nope')).toBe(null);
  });
  it('every unlock step exists in the story, and the copy has no dashes', () => {
    for (const g of GADGETS) {
      if (g.unlock?.step) expect(stepOf(g.unlock.step), g.id).toBeGreaterThan(0);
      for (const s of [g.name, g.unlockText, g.cardText]) expect(s).not.toMatch(/[\u2013\u2014]/);
    }
  });
  it('unlocks follow the story, the popper waits for the credits', () => {
    expect(unlockedIds(prog(), STEPS)).toEqual(['batarang']);
    expect(unlockedIds(prog({ step: stepOf('toYard') }), STEPS)).toEqual(['batarang', 'claw']);
    expect(unlockedIds(prog({ step: stepOf('toVat') }), STEPS)).toEqual(['batarang', 'remote', 'gel', 'smoke', 'launcher', 'claw', 'freeze']);
    expect(isUnlocked(gadgetById('popper'), prog({ step: STEPS.length - 1 }), STEPS)).toBe(false);
    expect(unlockedIds(prog({ finished: true }), STEPS)).toEqual(GADGET_IDS);
  });
  it('sticky unlocks survive a new game (step back to 0)', () => {
    expect(unlockedIds(prog(), STEPS, ['gel', 'popper'])).toEqual(['batarang', 'gel', 'popper']);
  });
});

describe('gadget state', () => {
  it('starts on the batarang and only equips unlocked gadgets', () => {
    const s = createGadgetState();
    expect(s.equipped).toBe('batarang');
    expect(s.equip('gel')).toBe(false);
    expect(s.unlock(['gel', 'batarang'])).toEqual(['gel']);
    expect(s.equip('gel')).toBe(true);
    expect(s.equipped).toBe('gel');
  });
  it('a saved equip of a locked gadget falls back to the batarang', () => {
    expect(createGadgetState({ equipped: 'popper', unlocked: ['batarang'] }).equipped).toBe('batarang');
  });
  it('the batarang is free', () => {
    const s = createGadgetState();
    for (let i = 0; i < 5; i++) expect(s.use('batarang')).toBe(true);
    expect(s.ready('batarang')).toBe(true);
  });
  it('cooldowns count down in game time', () => {
    const s = createGadgetState({ unlocked: ['batarang', 'smoke'] });
    expect(s.use('smoke')).toBe(true);
    expect(s.ready('smoke')).toBe(false);
    expect(s.use('smoke')).toBe(false);
    s.tick(11.9);
    expect(s.ready('smoke')).toBe(false);
    s.tick(0.2);
    expect(s.ready('smoke')).toBe(true);
  });
  it('the live effects object overrides a cooldown (Quick Smoke)', () => {
    const tune = { smokeCooldown: 12 };
    const s = createGadgetState({ unlocked: ['smoke'], tune });
    tune.smokeCooldown = 7;
    s.use('smoke');
    s.tick(7.01);
    expect(s.ready('smoke')).toBe(true);
  });
  it('charges refill one at a time', () => {
    const s = createGadgetState({ unlocked: ['gel'] });
    for (let i = 0; i < 3; i++) expect(s.use('gel')).toBe(true);
    expect(s.ready('gel')).toBe(false);
    s.tick(5.01);
    expect(s.status('gel').charges).toBe(1);
    s.tick(10.02);
    expect(s.status('gel').charges).toBe(3);
    s.tick(30);
    expect(s.status('gel').charges).toBe(3);
  });
  it('status reads for the wheel and the HUD', () => {
    const s = createGadgetState({ unlocked: ['gel', 'smoke'] });
    expect(s.status('gel')).toMatchObject({ id: 'gel', kind: 'charges', ready: true, charges: 3, max: 3, text: '3 of 3 charges' });
    s.use('smoke');
    s.tick(4.5);
    expect(s.status('smoke')).toMatchObject({ ready: false, text: 'Ready in 8 s' });
    expect(s.status('smoke').frac).toBeCloseTo(7.5 / 12);
    expect(s.status('batarang').text).toBe('Ready');
  });
  it('the HUD code only changes when the display would', () => {
    const s = createGadgetState({ unlocked: ['smoke'] });
    const a = s.hudCode('smoke');
    s.use('smoke');
    const b = s.hudCode('smoke');
    expect(b).not.toBe(a);
    s.tick(0.1);
    expect(s.hudCode('smoke')).toBe(b);
    s.tick(0.2);
    expect(s.hudCode('smoke')).not.toBe(b);
  });
  it('status reuses the object it is given', () => {
    const s = createGadgetState();
    const out = {};
    expect(s.status('batarang', out)).toBe(out);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/gadgetState.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/gadgets/gadgetDefs.js`**

```js
// The eight gadgets, in wheel order (slot 0 at the top of the wheel, then clockwise). Pure data.
// kind: 'free' (no limit), 'cooldown' (seconds after each use), 'charges' (max; one refills every
// `recharge` seconds). unlock: null (always), { step } (once the story reaches that step id), or
// { finished: true } (after the credits). promptId is the tutorial prompt in src/ui/prompts.js.
export const GADGETS = [
  { id: 'batarang', slot: 0, name: 'Batarang', kind: 'free', unlock: null, promptId: 'batarang',
    unlockText: 'Always with you.', cardText: 'Stuns goons and interrupts attacks from far away.' },
  { id: 'remote', slot: 1, name: 'Remote Batarang', kind: 'cooldown', cooldown: 4, unlock: { step: 'toMonarch' }, promptId: 'gadgetRemote',
    unlockText: 'Unlocks after the street fight on Neon Row.', cardText: 'Steer it with the mouse. It stuns every goon it passes and smashes glass signs.' },
  { id: 'gel', slot: 2, name: 'Explosive Gel', kind: 'charges', max: 3, recharge: 5, unlock: { step: 'toNeon' }, promptId: 'gadgetGel',
    unlockText: 'Unlocks once the presents are safe.', cardText: 'Spray it, then set it off. Cracked walls hide secrets.' },
  { id: 'smoke', slot: 3, name: 'Smoke Pellet', kind: 'cooldown', cooldown: 12, unlock: { step: 'toStreet' }, promptId: 'gadgetSmoke',
    unlockText: 'Unlocks after the Gazette rooftop fight.', cardText: 'A cloud five meters across. Goons inside lose you.' },
  { id: 'launcher', slot: 4, name: 'Line Launcher', kind: 'cooldown', cooldown: 1.5, unlock: { step: 'toAce' }, promptId: 'gadgetLauncher',
    unlockText: 'Unlocks once the party is back.', cardText: 'A line to the wall ahead, and a free ride across. Even mid-glide.' },
  { id: 'claw', slot: 5, name: 'Batclaw', kind: 'cooldown', cooldown: 2, unlock: { step: 'toYard' }, promptId: 'gadgetClaw',
    unlockText: 'Unlocks after the first fight at the Docks.', cardText: 'Yank a goon to you for a free punch. Tears down vents and weak railings.' },
  { id: 'freeze', slot: 6, name: 'Freeze Blast', kind: 'charges', max: 2, recharge: 10, unlock: { step: 'toVat' }, promptId: 'gadgetFreeze',
    unlockText: 'Unlocks after the Ace Chemicals roof.', cardText: 'Ice for one goon. One hit shatters it and knocks them out.' },
  { id: 'popper', slot: 7, name: 'Party Popper', kind: 'cooldown', cooldown: 20, unlock: { finished: true }, promptId: 'gadgetPopper',
    unlockText: 'A birthday surprise, after the story.', cardText: 'Confetti for everyone. Goons nearby stop fighting and dance.' },
];

export const GADGET_IDS = GADGETS.map((g) => g.id);

export function gadgetById(id) {
  return GADGETS.find((g) => g.id === id) ?? null;
}

export function isUnlocked(def, progress, steps) {
  if (!def.unlock) return true;
  if (progress.finished === true) return true;
  if (def.unlock.finished) return false;
  const i = steps.findIndex((s) => s.id === def.unlock.step);
  return i >= 0 && progress.step >= i;
}

// Unlocked by the story so far, plus `sticky` (every gadget ever unlocked, kept by a new game).
export function unlockedIds(progress, steps, sticky = []) {
  return GADGETS.filter((g) => sticky.includes(g.id) || isUnlocked(g, progress, steps)).map((g) => g.id);
}
```

- [ ] **Step 4: Write `src/gadgets/gadgetState.js`**

```js
// Equip, unlocks, charges and cooldowns for the gadgets. Pure.
// `tune` is the live WayneTech effects object: `${id}Cooldown` (smokeCooldown) overrides a cooldown.
import { GADGETS, GADGET_IDS, gadgetById } from './gadgetDefs.js';

export function createGadgetState({ equipped = 'batarang', unlocked = ['batarang'], tune = {} } = {}) {
  const slots = new Map();
  for (const g of GADGETS) slots.set(g.id, { charges: g.max ?? 0, cool: 0, refill: 0 });
  const open = new Set(['batarang', ...unlocked.filter((id) => GADGET_IDS.includes(id))]);
  let eq = open.has(equipped) ? equipped : 'batarang';
  const cooldownOf = (g) => tune[`${g.id}Cooldown`] ?? g.cooldown;

  function ready(id) {
    const g = gadgetById(id), s = slots.get(id);
    if (!g || !open.has(id)) return false;
    if (g.kind === 'free') return true;
    if (g.kind === 'cooldown') return s.cool <= 0;
    return s.charges > 0;
  }

  return {
    get equipped() { return eq; },
    get unlocked() { return open; },
    isUnlocked: (id) => open.has(id),
    equip(id) {
      if (!open.has(id)) return false;
      eq = id;
      return true;
    },
    // Returns the ids that were newly unlocked.
    unlock(ids) {
      const fresh = [];
      for (const id of ids) if (GADGET_IDS.includes(id) && !open.has(id)) { open.add(id); fresh.push(id); }
      return fresh;
    },
    ready,
    use(id) {
      if (!ready(id)) return false;
      const g = gadgetById(id), s = slots.get(id);
      if (g.kind === 'cooldown') s.cool = cooldownOf(g);
      else if (g.kind === 'charges') {
        s.charges -= 1;
        if (s.refill <= 0) s.refill = g.recharge;
      }
      return true;
    },
    tick(dt) {
      for (const g of GADGETS) {
        const s = slots.get(g.id);
        if (s.cool > 0) s.cool = Math.max(0, s.cool - dt);
        if (g.kind === 'charges' && s.charges < g.max) {
          s.refill -= dt;
          while (s.refill <= 0 && s.charges < g.max) {
            s.charges += 1;
            s.refill = s.charges < g.max ? s.refill + g.recharge : 0;
          }
        }
      }
    },
    status(id, out = {}) {
      const g = gadgetById(id), s = slots.get(id);
      out.id = id;
      out.name = g.name;
      out.kind = g.kind;
      out.ready = ready(id);
      out.charges = s.charges;
      out.max = g.max ?? 0;
      out.cool = g.kind === 'charges' ? (s.charges < g.max ? s.refill : 0) : s.cool;
      out.total = g.kind === 'charges' ? g.recharge : g.kind === 'cooldown' ? cooldownOf(g) : 0;
      out.frac = out.total ? out.cool / out.total : 0;
      out.text = g.kind === 'charges' ? `${s.charges} of ${g.max} charges`
        : out.ready ? 'Ready' : `Ready in ${Math.ceil(s.cool)} s`;
      return out;
    },
    // A number that changes only when the HUD would show something different (quarter seconds).
    hudCode(id) {
      const s = slots.get(id);
      const g = gadgetById(id);
      const t = g.kind === 'charges' ? (s.charges < g.max ? s.refill : 0) : s.cool;
      return GADGET_IDS.indexOf(id) * 1e6 + s.charges * 1e4 + Math.ceil(t * 4);
    },
  };
}
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run tests/unit/gadgetState.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/gadgets/gadgetDefs.js src/gadgets/gadgetState.js tests/unit/gadgetState.test.js
git commit -m "Gadget registry, charges and cooldowns"
```

---

### Task 3: Wheel maths, aiming maths and sky letters

**Files:**
- Create: `src/gadgets/wheelMath.js`, `src/gadgets/aim.js`, `src/gadgets/skyLetters.js`
- Test: `tests/unit/wheelMath.test.js`, `tests/unit/aim.test.js`, `tests/unit/skyLetters.test.js`

**Interfaces:**
- Consumes: `createCollision` (tests only).
- Produces: everything listed for these three modules.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/wheelMath.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { slotFromDir, slotFromCode, slotCenter, createWheelCursor, createWheelLogic, WHEEL_DIGITS } from '../../src/gadgets/wheelMath.js';

describe('slotFromDir', () => {
  it('slot 0 is up, then clockwise (screen y points down)', () => {
    expect(slotFromDir(0, -1)).toBe(0);
    expect(slotFromDir(0.7, -0.7)).toBe(1);
    expect(slotFromDir(1, 0)).toBe(2);
    expect(slotFromDir(0, 1)).toBe(4);
    expect(slotFromDir(-1, 0)).toBe(6);
    expect(slotFromDir(-0.7, -0.7)).toBe(7);
  });
  it('rounds to the nearest slot and ignores the dead zone', () => {
    expect(slotFromDir(0.2, -1)).toBe(0);
    expect(slotFromDir(0.1, 0.1)).toBe(null);
    expect(slotFromDir(0.3, 0, { dead: 0.2 })).toBe(2);
  });
});

describe('keys and layout', () => {
  it('Digit1 to Digit8 pick slots 0 to 7, nothing else does', () => {
    expect(WHEEL_DIGITS).toHaveLength(8);
    expect(slotFromCode('Digit1')).toBe(0);
    expect(slotFromCode('Digit8')).toBe(7);
    expect(slotFromCode('Digit9')).toBe(null);
    expect(slotFromCode('KeyR')).toBe(null);
  });
  it('slot centers sit on the ring', () => {
    const c = slotCenter(2, 100);
    expect(c.x).toBeCloseTo(100);
    expect(c.y).toBeCloseTo(0);
    expect(slotCenter(0, 100).y).toBeCloseTo(-100);
  });
});

describe('wheel cursor', () => {
  it('follows the mouse and stays inside the unit circle', () => {
    const c = createWheelCursor({ pxPerUnit: 100 });
    c.move(0, -50);
    expect(c.slot()).toBe(0);
    c.move(400, 50);
    expect(Math.hypot(c.x, c.y)).toBeCloseTo(1);
    expect(c.slot()).toBe(2);
    c.reset();
    expect(c.slot()).toBe(null);
  });
});

describe('wheel hold logic', () => {
  it('opens on the current gadget, picks while open, equips on release', () => {
    const w = createWheelLogic();
    w.press(0);
    expect(w.open).toBe(true);
    expect(w.pick).toBe(0);
    w.choose(3);
    w.choose(null);
    expect(w.pick).toBe(3);
    expect(w.release(() => true)).toBe(3);
    expect(w.open).toBe(false);
  });
  it('a locked pick equips nothing', () => {
    const w = createWheelLogic();
    w.press(0);
    w.choose(7);
    expect(w.release((i) => i !== 7)).toBe(null);
  });
  it('choosing while closed and releasing twice do nothing', () => {
    const w = createWheelLogic();
    w.choose(4);
    expect(w.pick).toBe(null);
    expect(w.release(() => true)).toBe(null);
    w.press(1);
    w.cancel();
    expect(w.open).toBe(false);
    expect(w.release(() => true)).toBe(null);
  });
});
```

Create `tests/unit/aim.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createCollision } from '../../src/world/collision.js';
import { pickAimed, pickAimedMany, launcherLine, lineBetween, gelSpot, inRadius, steerDir, yankVelocity } from '../../src/gadgets/aim.js';

const goon = (id, x, z, y = 0) => ({ id, pos: { x, y, z } });
const eye = { x: 0, y: 1.1, z: 0 };
const ahead = { x: 0, y: 0, z: 1 };

describe('pickAimed', () => {
  it('takes the goon nearest the aim line, inside range and the cone', () => {
    const list = [goon('left', -3, 6), goon('ahead', 0.2, 9), goon('behind', 0, -5), goon('far', 0, 30)];
    expect(pickAimed(list, eye, ahead).id).toBe('ahead');
    expect(pickAimed([goon('far', 0, 30)], eye, ahead)).toBe(null);
    expect(pickAimed([goon('left', -3, 6)], eye, ahead)).toBe(null);
  });
  it('picks several in order and respects the filter', () => {
    const list = [goon('a', 0, 5), goon('b', 0.5, 8), goon('c', -0.4, 12), goon('d', 0, 7)];
    expect(pickAimedMany(list, eye, ahead, 2).map((g) => g.id)).toEqual(['a', 'd']);
    expect(pickAimedMany(list, eye, ahead, 2, { filter: (g) => g.id !== 'a' }).map((g) => g.id)).toEqual(['d', 'c']);
  });
});

describe('launcherLine', () => {
  const city = () => { const c = createCollision(); c.addBox(-10, 0, 25, 10, 30, 30, 'building'); return c; };
  it('runs level to the wall ahead, hanging at hand height', () => {
    const r = launcherLine(city(), { x: 0, y: 0, z: 0 }, 0);
    expect(r.ok).toBe(true);
    expect(r.dist).toBeCloseTo(25);
    expect(r.line.a).toEqual({ x: 0, y: 2.05, z: 0 });
    expect(r.line.b.z).toBeCloseTo(24.4);
    expect(r.line.b.y).toBeCloseTo(2.05);
    expect(r.line.sag).toBe(0);
    expect(r.line.dir.z).toBeCloseTo(1);
  });
  it('fails with no wall in 40 m, or a wall closer than 6 m', () => {
    expect(launcherLine(city(), { x: 0, y: 0, z: 0 }, Math.PI).reason).toBe('none');
    const c = createCollision();
    c.addBox(-2, 0, 4, 2, 3, 5, 'crate');
    expect(launcherLine(c, { x: 0, y: 0, z: 0 }, 0).reason).toBe('short');
  });
  it('a low obstacle shortens the line (the rider must pass over nothing)', () => {
    const c = city();
    c.addBox(-2, 0, 15, 2, 0.8, 16, 'crate');
    expect(launcherLine(c, { x: 0, y: 0, z: 0 }, 0).dist).toBeCloseTo(15);
  });
});

describe('lineBetween', () => {
  it('builds a zipline-shaped line', () => {
    const l = lineBetween({ x: 0, y: 5, z: 0 }, { x: 3, y: 5, z: 4 });
    expect(l.length).toBeCloseTo(5);
    expect(l.dir).toEqual({ x: 0.6, y: 0, z: 0.8 });
    expect(l.id).toBe(-1);
  });
});

describe('gelSpot', () => {
  it('sticks to the wall it hits, with the wall normal', () => {
    const c = createCollision();
    c.addBox(-5, 0, 8, 5, 10, 9, 'breakable');
    const s = gelSpot(c, { x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 });
    expect(s).toMatchObject({ z: 8, nz: -1, ny: 0 });
  });
  it('lands on the floor when aimed down at open ground', () => {
    const c = createCollision({ floor: () => 0 });
    const d = { x: 0, y: -Math.SQRT1_2, z: Math.SQRT1_2 };
    const s = gelSpot(c, { x: 0, y: 3, z: 0 }, d);
    expect(s.y).toBe(0);
    expect(s.z).toBeCloseTo(3);
    expect(s.ny).toBe(1);
  });
  it('gives up aimed at the sky', () => {
    expect(gelSpot(createCollision({ floor: () => 0 }), { x: 0, y: 3, z: 0 }, { x: 0, y: 1, z: 0 })).toBe(null);
  });
});

describe('small helpers', () => {
  it('inRadius is flat distance plus a height band', () => {
    expect(inRadius({ x: 0, y: 0, z: 0 }, { x: 2, y: 1, z: 0 }, 2.5)).toBe(true);
    expect(inRadius({ x: 0, y: 0, z: 0 }, { x: 2, y: 3, z: 0 }, 2.5)).toBe(false);
  });
  it('steerDir turns toward the wanted direction at a limited rate and stays unit length', () => {
    const out = { x: 0, y: 0, z: 0 };
    steerDir({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 0 }, 0.05, 5, out);
    expect(out.x).toBeGreaterThan(0);
    expect(out.z).toBeGreaterThan(out.x);
    expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(1);
  });
  it('yankVelocity lands the goon at the target point', () => {
    const from = { x: 0, y: 4, z: 10 }, to = { x: 0, y: 0, z: 1.3 };
    const v = yankVelocity(from, to);
    const x = from.z + v.vz * v.t;
    const y = from.y + v.vy * v.t - 12 * v.t * v.t;
    expect(x).toBeCloseTo(to.z);
    expect(y).toBeCloseTo(to.y);
    expect(v.t).toBeGreaterThanOrEqual(0.3);
    expect(v.t).toBeLessThanOrEqual(0.6);
  });
});
```

Create `tests/unit/skyLetters.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { GLYPHS, textLines, letterPoints, birthdayLine } from '../../src/gadgets/skyLetters.js';

const inked = (ch) => GLYPHS[ch].join('').split('').filter((c) => c === '#').length;

describe('sky letters', () => {
  it('every glyph is 5 by 7', () => {
    for (const [ch, rows] of Object.entries(GLYPHS)) {
      expect(rows, ch).toHaveLength(7);
      for (const r of rows) expect(r, ch).toMatch(/^[#.]{5}$/);
    }
    expect(Object.keys(GLYPHS).filter((k) => /[A-Z]/.test(k))).toHaveLength(26);
  });
  it('one point per inked cell, centered on the origin', () => {
    const { points, width, height } = letterPoints('HI', { cell: 1 });
    expect(points).toHaveLength(inked('H') + inked('I'));
    expect(width).toBe(11);
    expect(height).toBe(7);
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(-Math.max(...xs));
    expect(Math.min(...ys)).toBeCloseTo(-Math.max(...ys));
  });
  it('wraps the birthday line into two lines', () => {
    expect(birthdayLine('Mansi')).toBe('HAPPY BIRTHDAY MANSI!');
    expect(textLines('HAPPY BIRTHDAY MANSI!')).toEqual(['HAPPY BIRTHDAY', 'MANSI!']);
    expect(letterPoints('HAPPY BIRTHDAY MANSI!', { cell: 1 }).height).toBe(16);
  });
  it('unknown characters are blank, and the total stays under the confetti budget', () => {
    expect(letterPoints('A~A', { cell: 1 }).points).toHaveLength(inked('A') * 2);
    expect(letterPoints(birthdayLine('Mansi')).points.length).toBeLessThan(560);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/wheelMath.test.js tests/unit/aim.test.js tests/unit/skyLetters.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/gadgets/wheelMath.js`**

```js
// Gadget wheel picking. Pure. Slot 0 is at the top of the wheel, then clockwise; directions are
// in screen space (x right, y down), like mouse deltas and the gamepad's right stick.
export const WHEEL_SLOTS = 8;
export const WHEEL_DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'];

export function slotFromDir(x, y, { slots = WHEEL_SLOTS, dead = 0.35 } = {}) {
  if (Math.hypot(x, y) < dead) return null;
  const a = Math.atan2(x, -y);
  const step = (Math.PI * 2) / slots;
  return ((Math.round(a / step) % slots) + slots) % slots;
}

export function slotFromCode(code) {
  const i = WHEEL_DIGITS.indexOf(code);
  return i >= 0 ? i : null;
}

export function slotCenter(i, radius, slots = WHEEL_SLOTS) {
  const a = (i / slots) * Math.PI * 2;
  return { x: Math.sin(a) * radius, y: -Math.cos(a) * radius };
}

// A virtual cursor moved by mouse deltas (pointer lock), kept inside the unit circle.
export function createWheelCursor({ pxPerUnit = 110 } = {}) {
  let x = 0, y = 0;
  return {
    get x() { return x; },
    get y() { return y; },
    reset() { x = 0; y = 0; },
    move(dx, dy) {
      x += dx / pxPerUnit;
      y += dy / pxPerUnit;
      const l = Math.hypot(x, y);
      if (l > 1) { x /= l; y /= l; }
    },
    slot(opts) { return slotFromDir(x, y, opts); },
  };
}

// Hold to open on the equipped slot, pick while open, equip the pick on release if unlocked.
export function createWheelLogic() {
  let open = false, pick = null;
  return {
    get open() { return open; },
    get pick() { return pick; },
    press(current) { open = true; pick = current; },
    choose(i) { if (open && i !== null && i !== undefined) pick = i; },
    release(isUnlocked) {
      if (!open) return null;
      open = false;
      const p = pick;
      pick = null;
      return p !== null && isUnlocked(p) ? p : null;
    },
    cancel() { open = false; pick = null; },
  };
}
```

- [ ] **Step 4: Write `src/gadgets/aim.js`**

```js
// Aiming maths for gadgets. Pure: points are plain { x, y, z }; `collision` is the
// createCollision API (raycast, groundBelow). Called when a gadget fires, not every frame.

// Items nearest the aim line first, inside `range` and a cone of `maxAngle` radians around `dir`
// (unit length). `lift` is added to each item's y (aim at the chest, not the feet).
export function pickAimedMany(items, eye, dir, n, { range = 20, maxAngle = 0.35, lift = 1.1, filter = () => true, getPos = (e) => e.pos } = {}) {
  const scored = [];
  for (const it of items) {
    if (!filter(it)) continue;
    const p = getPos(it);
    const dx = p.x - eye.x, dy = p.y + lift - eye.y, dz = p.z - eye.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > range || d < 0.3) continue;
    const cos = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > maxAngle) continue;
    scored.push({ it, score: angle * 8 + d * 0.05 });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, n).map((s) => s.it);
}

export function pickAimed(items, eye, dir, opts) {
  return pickAimedMany(items, eye, dir, 1, opts)[0] ?? null;
}

// A straight line shaped like a zipline (src/world/climbables.js addZipline), not registered
// anywhere. sag 0 = taut.
export function lineBetween(a, b, sag = 0) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const length = Math.hypot(dx, dy, dz);
  return { id: -1, a: { ...a }, b: { ...b }, length, dir: { x: dx / length, y: dy / length, z: dz / length }, sag };
}

// The line launcher: a level line from Batman's hand to the first wall ahead along `yaw`. Three
// rays (shins, chest, the line itself) so the rider hanging under it passes over nothing.
export function launcherLine(collision, pos, yaw, { range = 40, min = 6, heights = [0.3, 1.2, 2.1], hang = 2.05, back = 0.6 } = {}) {
  const dir = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  let dist = Infinity;
  for (const h of heights) {
    const hit = collision.raycast({ x: pos.x, y: pos.y + h, z: pos.z }, dir, range);
    if (hit && hit.t < dist) dist = hit.t;
  }
  if (dist === Infinity) return { ok: false, reason: 'none' };
  if (dist < min) return { ok: false, reason: 'short' };
  const y = pos.y + hang;
  const a = { x: pos.x, y, z: pos.z };
  const b = { x: pos.x + dir.x * (dist - back), y, z: pos.z + dir.z * (dist - back) };
  return { ok: true, line: lineBetween(a, b, 0), dist };
}

// Where a gel blob sticks: the first box the aim ray hits (floor or wall, with its normal), or
// the ground where a downward ray meets it.
export function gelSpot(collision, eye, dir, { range = 14 } = {}) {
  const hit = collision.raycast(eye, dir, range);
  if (hit) {
    return { x: eye.x + dir.x * hit.t, y: eye.y + dir.y * hit.t, z: eye.z + dir.z * hit.t, nx: hit.normal.x, ny: hit.normal.y, nz: hit.normal.z };
  }
  if (dir.y > -0.05) return null;
  const floorY = collision.groundBelow(eye.x, eye.y, eye.z, 0.1);
  if (floorY === -Infinity) return null;
  const t = (eye.y - floorY) / -dir.y;
  if (t > range) return null;
  const x = eye.x + dir.x * t, z = eye.z + dir.z * t;
  const y = collision.groundBelow(x, eye.y, z, 0.1);
  if (y === -Infinity) return null;
  return { x, y, z, nx: 0, ny: 1, nz: 0 };
}

export function inRadius(c, p, r, dy = 2.5) {
  return Math.hypot(p.x - c.x, p.z - c.z) <= r && Math.abs(p.y - c.y) <= dy;
}

// Turn `cur` toward `want` (both unit length) at up to `rate` per second; writes `out`.
export function steerDir(cur, want, dt, rate, out) {
  const k = Math.min(1, rate * dt);
  const x = cur.x + (want.x - cur.x) * k, y = cur.y + (want.y - cur.y) * k, z = cur.z + (want.z - cur.z) * k;
  const l = Math.hypot(x, y, z) || 1;
  out.x = x / l; out.y = y / l; out.z = z / l;
  return out;
}

// The batclaw's arc: launch speeds that land a goon at `to` under gravity g (the enemy's own
// ballistic flight in enemy.js uses 24).
export function yankVelocity(from, to, g = 24) {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const t = Math.min(0.6, Math.max(0.3, Math.hypot(dx, dz) / 18));
  return { vx: dx / t, vy: dy / t + 0.5 * g * t, vz: dz / t, t };
}
```

- [ ] **Step 5: Write `src/gadgets/skyLetters.js`**

```js
// Confetti lettering for the party popper: a 5x7 bitmap font and a layout that turns a line of
// text into points (one per inked cell), centered on the origin, y up. Pure.
export const GLYPHS = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  J: ['..###', '...#.', '...#.', '...#.', '#..#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
};

export function birthdayLine(name) {
  return `HAPPY BIRTHDAY ${String(name).toUpperCase()}!`;
}

// Greedy word wrap at `maxPerLine` characters.
export function textLines(text, maxPerLine = 14) {
  const lines = [];
  let cur = '';
  for (const w of String(text).toUpperCase().split(/\s+/).filter(Boolean)) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxPerLine) cur += ` ${w}`;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}

// One point per inked cell. Characters advance 6 cells (5 plus a gap); lines are 7 cells tall
// with `lineGap` cells between them. Unknown characters are blank.
export function letterPoints(text, { cell = 0.5, maxPerLine = 14, lineGap = 2 } = {}) {
  const lines = textLines(text, maxPerLine);
  const widthCells = Math.max(...lines.map((l) => l.length * 6 - 1));
  const heightCells = lines.length * 7 + (lines.length - 1) * lineGap;
  const points = [];
  lines.forEach((line, li) => {
    const lineW = line.length * 6 - 1;
    const x0 = -lineW / 2;
    const y0 = heightCells / 2 - li * (7 + lineGap);
    [...line].forEach((ch, ci) => {
      const g = GLYPHS[ch];
      if (!g) return;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) {
        if (g[r][c] !== '#') continue;
        points.push({ x: (x0 + ci * 6 + c + 0.5) * cell, y: (y0 - r - 0.5) * cell });
      }
    });
  });
  return { points, width: widthCells * cell, height: heightCells * cell };
}
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/wheelMath.test.js tests/unit/aim.test.js tests/unit/skyLetters.test.js`
Expected: PASS. If the centering test on `HI` fails by half a cell, the line width formula is off: a line is `length * 6 - 1` cells wide and the first cell's center is at `x0 + 0.5`.

- [ ] **Step 7: Commit**

```bash
git add src/gadgets/wheelMath.js src/gadgets/aim.js src/gadgets/skyLetters.js tests/unit/wheelMath.test.js tests/unit/aim.test.js tests/unit/skyLetters.test.js
git commit -m "Gadget wheel picking, aiming maths and confetti sky letters"
```

---

### Task 4: Breakable placements and the gadgets save field (pure)

**Files:**
- Create: `src/world/breakableSpots.js`, `src/gadgets/gadgetSave.js`
- Test: `tests/unit/breakableSpots.test.js`, `tests/unit/saveGadgets.test.js`

**Interfaces:**
- Consumes: `BALLOONS` (Plan 3C, `src/config/balloonSpots.js`) in the test only; `GADGET_IDS` (Task 2); `registerProgressField`, `sanitizeProgress`, `newGameProgress` (Plan 3C, `src/core/save.js`); `tracker` (Plan 3C, `src/game/progressTracker.js`).
- Produces: everything listed for `breakableSpots.js` and `gadgetSave.js`. Six cracked walls (one hides balloon 7, "Under the Monarch marquee"; three hide WayneTech caches; two board up street-level fire-escape ladders as shortcuts), four glass signs, three vents (each hiding a small cache) and two weak railings.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/breakableSpots.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { BREAKABLES, BREAKABLE_IDS, CACHES, CACHE_IDS, cacheById, roomWalls, cageRoom, nearestLadder, roofEdgeRail, boxDistance, faceFromNormal } from '../../src/world/breakableSpots.js';
import { BALLOONS } from '../../src/config/balloonSpots.js';

describe('breakable data', () => {
  it('has unique ids and the promised mix', () => {
    expect(new Set(BREAKABLE_IDS).size).toBe(BREAKABLES.length);
    const count = (k) => BREAKABLES.filter((b) => b.kind === k).length;
    expect([count('weakWall'), count('glass'), count('vent'), count('railing')]).toEqual([6, 4, 3, 2]);
    const hides = (t) => BREAKABLES.filter((b) => b.hides?.type === t).length;
    expect(hides('balloon')).toBe(1);
    expect(hides('shortcut')).toBe(2);
    expect(hides('cache')).toBe(6);
  });
  it('every cache is hidden behind exactly one breakable', () => {
    for (const c of CACHES) expect(BREAKABLES.filter((b) => b.hides?.id === c.id), c.id).toHaveLength(1);
    expect(CACHE_IDS).toHaveLength(6);
    expect(cacheById('cacheColdStore').xp).toBe(250);
    expect(cacheById('cacheVentGcpd').xp).toBe(100);
  });
});

describe('roomWalls', () => {
  const room = { x: 0, y: 0, z: 0, w: 3, d: 3, h: 3, open: 'w' };
  it('builds the open face as the weak wall and three solid walls', () => {
    const r = roomWalls(room);
    expect(r.weak).toEqual({ minX: -1.5, maxX: -1.2, minZ: -1.5, maxZ: 1.5, minY: 0, maxY: 3 });
    expect(r.solid).toHaveLength(3);
    expect(r.roof).toMatchObject({ minY: 3, maxY: 3.3 });
  });
  it('leaves out the face against a building, and the roof when asked', () => {
    const r = roomWalls({ ...room, against: 'e', noRoof: true });
    expect(r.solid).toHaveLength(2);
    expect(r.solid.some((b) => b.maxX === 1.5 && b.minX === 1.2)).toBe(false);
    expect(r.roof).toBe(null);
  });
  it('the Monarch booth encloses balloon 7 and keeps it out of reach through the wall', () => {
    const booth = BREAKABLES.find((b) => b.hides?.type === 'balloon');
    const bal = BALLOONS[booth.hides.index];
    const { weak } = roomWalls(booth.room);
    const r = booth.room;
    expect(bal.x).toBeGreaterThan(weak.maxX);
    expect(bal.x).toBeLessThan(r.x + r.w / 2);
    expect(Math.abs(bal.z - r.z)).toBeLessThan(r.d / 2 - 0.3);
    expect(bal.y).toBeLessThan(r.y + r.h);
    // Balloons pop inside 2.2 m (balloons.js); a hero pressed against the wall (radius 0.35)
    // standing on the sidewalk must stay outside that.
    const hx = weak.minX - 0.35, dy = r.y + 1 - bal.y;
    expect((hx - bal.x) ** 2 + dy * dy * 0.5).toBeGreaterThan(2.2 * 2.2);
  });
});

describe('cages, ladders and rails', () => {
  const ladder = { id: 3, x: 140, z: 48, nx: 1, nz: 0, bottom: 0, top: 12 };
  it('a cage stands out from the wall with its weak face toward the street', () => {
    const c = cageRoom(ladder);
    expect(c).toMatchObject({ open: 'e', against: 'w', noRoof: true, y: 0 });
    expect(c.x).toBeCloseTo(140.9);
    expect(c.w).toBeCloseTo(1.8);
    expect(c.d).toBeCloseTo(2.2);
  });
  it('nearestLadder takes the closest street-level ladder in range', () => {
    const list = [{ ...ladder, id: 1, z: 60 }, { ...ladder, id: 2, z: 50 }, { ...ladder, id: 4, z: 49, bottom: 6 }];
    expect(nearestLadder(list, 140, 48).id).toBe(2);
    expect(nearestLadder(list, 140, 90)).toBe(null);
  });
  it('faceFromNormal', () => {
    expect([faceFromNormal(1, 0), faceFromNormal(-1, 0), faceFromNormal(0, 1), faceFromNormal(0, -1)]).toEqual(['e', 'w', 's', 'n']);
  });
  it('roofEdgeRail runs along the roof edge nearest the site', () => {
    const roof = { minX: 40, maxX: 80, minZ: 162, maxZ: 198, minY: 0, maxY: 13 };
    const r = roofEdgeRail(roof, 60, 166, 6);
    expect(r).toMatchObject({ face: 'n', nx: 0, nz: -1, minY: 13 });
    expect(r.maxY).toBeCloseTo(14.1);
    expect(r.minX).toBeCloseTo(57);
    expect(r.maxX).toBeCloseTo(63);
    expect(r.minZ).toBeCloseTo(162.025);
  });
  it('boxDistance is 0 inside and the gap outside', () => {
    const b = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
    expect(boxDistance(b, { x: 0.5, y: 0.5, z: 0.5 })).toBe(0);
    expect(boxDistance(b, { x: 3, y: 0.5, z: 0.5 })).toBeCloseTo(2);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/breakableSpots.test.js`
Expected: FAIL (module missing).

- [ ] **Step 3: Write `src/world/breakableSpots.js`**

```js
// Gadget breakables around the city, as data, and the maths to build them. Pure.
// Faces: 'e' is +x, 'w' is -x, 's' is +z, 'n' is -z (north is -z). A room is a little brick shed:
// center x, z; floor y; w along x, d along z; h tall. Its `open` face is the cracked wall;
// `against` is left out because a building wall is already there; `noRoof` leaves the roof off.
// Coordinates are checked against the live city by scripts/breakables-check.mjs (Task 11).
export const FACES = { e: { nx: 1, nz: 0 }, w: { nx: -1, nz: 0 }, s: { nx: 0, nz: 1 }, n: { nx: 0, nz: -1 } };

export function faceFromNormal(nx, nz) {
  return Math.abs(nx) >= Math.abs(nz) ? (nx >= 0 ? 'e' : 'w') : (nz >= 0 ? 's' : 'n');
}

export const BREAKABLES = [
  // Explosive gel: cracked walls.
  { id: 'wallMonarchBooth', kind: 'weakWall', room: { x: 158.2, y: 0.15, z: -60, w: 3.6, d: 3, h: 3.2, open: 'w', against: 'e' }, hides: { type: 'balloon', index: 6 } },
  { id: 'wallColdStore', kind: 'weakWall', room: { x: -70, y: 22, z: 128, w: 3, d: 3, h: 2.6, open: 'e' }, hides: { type: 'cache', id: 'cacheColdStore' } },
  { id: 'wallDinerRoof', kind: 'weakWall', room: { x: 192, y: 9, z: 66, w: 3, d: 3, h: 2.6, open: 'w' }, hides: { type: 'cache', id: 'cacheDinerRoof' } },
  { id: 'wallDockBrick', kind: 'weakWall', room: { x: -190, y: 26, z: 108, w: 3, d: 3, h: 2.6, open: 'e' }, hides: { type: 'cache', id: 'cacheDockBrick' } },
  { id: 'wallBarEscape', kind: 'weakWall', ladderNear: { x: 140, z: 48 }, hides: { type: 'shortcut' } },
  { id: 'wallIcebergEscape', kind: 'weakWall', ladderNear: { x: 160, z: 115 }, hides: { type: 'shortcut' } },
  // Remote batarang: the Joker's glass party signs hung over the street.
  { id: 'glassNeonNorth', kind: 'glass', box: { x: 150, y: 6.5, z: -30, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassNeonMid', kind: 'glass', box: { x: 150, y: 6.5, z: 30, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassNeonSouth', kind: 'glass', box: { x: 150, y: 6.5, z: 90, w: 6, h: 1.6, d: 0.12 } },
  { id: 'glassAceGate', kind: 'glass', box: { x: 95, y: 6, z: -99, w: 6, h: 1.6, d: 0.12 } },
  // Batclaw: vent covers on rooftop ducts, each hiding a small cache.
  { id: 'ventGcpd', kind: 'vent', room: { x: 14, y: 42, z: -10, w: 1.4, d: 1.4, h: 1.2, open: 's' }, hides: { type: 'cache', id: 'cacheVentGcpd' } },
  { id: 'ventWarehouse', kind: 'vent', room: { x: 66, y: 13, z: 186, w: 1.4, d: 1.4, h: 1.2, open: 'w' }, hides: { type: 'cache', id: 'cacheVentWarehouse' } },
  { id: 'ventJazz', kind: 'vent', room: { x: 110, y: 34, z: 76, w: 1.4, d: 1.4, h: 1.2, open: 'n' }, hides: { type: 'cache', id: 'cacheVentJazz' } },
  // Batclaw: weak railings on roof edges where goons stand. `site` finds the roof and its edge.
  { id: 'railWarehouse', kind: 'railing', site: { x: 60, y: 13, z: 166 }, len: 6 },
  { id: 'railFactory', kind: 'railing', site: { x: 140, y: 25.1, z: -172 }, len: 6 },
];
export const BREAKABLE_IDS = BREAKABLES.map((b) => b.id);

export const CACHES = [
  { id: 'cacheColdStore', xp: 250 }, { id: 'cacheDinerRoof', xp: 250 }, { id: 'cacheDockBrick', xp: 250 },
  { id: 'cacheVentGcpd', xp: 100 }, { id: 'cacheVentWarehouse', xp: 100 }, { id: 'cacheVentJazz', xp: 100 },
];
export const CACHE_IDS = CACHES.map((c) => c.id);
export const cacheById = (id) => CACHES.find((c) => c.id === id) ?? null;

export function roomWalls(r, t = 0.3) {
  const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2, y0 = r.y, y1 = r.y + r.h;
  const faces = {
    w: { minX: x0, maxX: x0 + t, minZ: z0, maxZ: z1 },
    e: { minX: x1 - t, maxX: x1, minZ: z0, maxZ: z1 },
    n: { minX: x0, maxX: x1, minZ: z0, maxZ: z0 + t },
    s: { minX: x0, maxX: x1, minZ: z1 - t, maxZ: z1 },
  };
  const box = (f) => ({ ...f, minY: y0, maxY: y1 });
  const solid = [];
  for (const f of ['n', 's', 'e', 'w']) if (f !== r.open && f !== r.against) solid.push(box(faces[f]));
  return {
    weak: box(faces[r.open]),
    solid,
    roof: r.noRoof ? null : { minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: y1, maxY: y1 + t },
  };
}

// A boarded cage around the foot of a street-level fire-escape ladder: the ladder's wall is the
// back, the weak face looks out along the ladder's normal. No roof, so climbing is untouched.
export function cageRoom(l, { depth = 1.8, width = 2.2, h = 3 } = {}) {
  const alongX = Math.abs(l.nx) >= Math.abs(l.nz);
  return {
    x: l.x + (l.nx * depth) / 2, y: l.bottom, z: l.z + (l.nz * depth) / 2,
    w: alongX ? depth : width, d: alongX ? width : depth, h,
    open: faceFromNormal(l.nx, l.nz), against: faceFromNormal(-l.nx, -l.nz), noRoof: true,
  };
}

export function nearestLadder(ladders, x, z, { maxBottom = 0.5, within = 12 } = {}) {
  let best = null, bd = within;
  for (const l of ladders) {
    if (l.bottom > maxBottom) continue;
    const d = Math.hypot(l.x - x, l.z - z);
    if (d <= bd) { best = l; bd = d; }
  }
  return best;
}

// A rail along the edge of roof box `b` nearest the site (sx, sz), `len` long, just inside the edge.
export function roofEdgeRail(b, sx, sz, len = 6, { inset = 0.1, t = 0.15, h = 1.1 } = {}) {
  const d = { w: sx - b.minX, e: b.maxX - sx, n: sz - b.minZ, s: b.maxZ - sz };
  const face = Object.keys(d).reduce((a, k) => (d[k] < d[a] ? k : a), 'w');
  const { nx, nz } = FACES[face];
  const half = len / 2;
  const cx = Math.min(Math.max(sx, b.minX + half), b.maxX - half);
  const cz = Math.min(Math.max(sz, b.minZ + half), b.maxZ - half);
  const y = b.maxY;
  if (nx) {
    const x = nx > 0 ? b.maxX - inset : b.minX + inset;
    return { minX: x - t / 2, maxX: x + t / 2, minZ: cz - half, maxZ: cz + half, minY: y, maxY: y + h, nx, nz, face };
  }
  const z = nz > 0 ? b.maxZ - inset : b.minZ + inset;
  return { minX: cx - half, maxX: cx + half, minZ: z - t / 2, maxZ: z + t / 2, minY: y, maxY: y + h, nx, nz, face };
}

export function boxDistance(b, p) {
  const dx = Math.max(b.minX - p.x, 0, p.x - b.maxX);
  const dy = Math.max(b.minY - p.y, 0, p.y - b.maxY);
  const dz = Math.max(b.minZ - p.z, 0, p.z - b.maxZ);
  return Math.hypot(dx, dy, dz);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/unit/breakableSpots.test.js`
Expected: PASS. The booth's through-the-wall check is the one that matters: if it fails, widen the booth toward the street (lower `room.x`, raise `room.w` by the same amount) until it passes.

- [ ] **Step 5: The gadgets save field.** Create `tests/unit/saveGadgets.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeGadgetSave } from '../../src/gadgets/gadgetSave.js';

describe('gadgets save field', () => {
  it('defaults', () => {
    expect(sanitizeProgress({}).gadgets).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [] });
  });
  it('drops junk and duplicates', () => {
    expect(sanitizeGadgetSave({ equipped: 'laser', unlocked: ['gel', 'gel', 'laser', 3], broken: ['wallMonarchBooth', 'x', 'wallMonarchBooth'], caches: ['cacheColdStore', 9] }))
      .toEqual({ equipped: 'batarang', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'] });
    expect(sanitizeGadgetSave('x')).toEqual({ equipped: 'batarang', unlocked: [], broken: [], caches: [] });
  });
  it('a new game keeps gadgets, broken walls and caches', () => {
    const p = sanitizeProgress({ step: 12, gadgets: { equipped: 'gel', unlocked: ['gel'], broken: ['wallMonarchBooth'], caches: ['cacheColdStore'] } });
    expect(newGameProgress(p).gadgets).toEqual(p.gadgets);
  });
});
```

Run: `npx vitest run tests/unit/saveGadgets.test.js`
Expected: FAIL (`gadgetSave.js` is missing).

- [ ] **Step 6: Write `src/gadgets/gadgetSave.js`**

```js
// The saved gadget state (progress.gadgets): what's equipped, every gadget ever unlocked (a new
// game keeps them), broken breakables and found caches. Registers itself at load, so game.js
// must import this module before loadProgress runs. Pure.
import { registerProgressField } from '../core/save.js';
import { tracker } from '../game/progressTracker.js';
import { GADGET_IDS } from './gadgetDefs.js';
import { BREAKABLE_IDS, CACHE_IDS } from '../world/breakableSpots.js';

const ids = (v, allowed) => (Array.isArray(v) ? [...new Set(v.filter((s) => allowed.includes(s)))] : []);

export function sanitizeGadgetSave(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    equipped: GADGET_IDS.includes(r.equipped) ? r.equipped : 'batarang',
    unlocked: ids(r.unlocked, GADGET_IDS),
    broken: ids(r.broken, BREAKABLE_IDS),
    caches: ids(r.caches, CACHE_IDS),
  };
}

registerProgressField('gadgets', { sanitize: sanitizeGadgetSave });

tracker.register({
  id: 'caches', label: 'WayneTech caches', weight: 3,
  count: (p) => ({ done: p.gadgets.caches.length, total: CACHE_IDS.length }),
  detail: (p) => `${p.gadgets.caches.length} of ${CACHE_IDS.length} found behind cracked walls and vents`,
});
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/unit/breakableSpots.test.js tests/unit/saveGadgets.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/world/breakableSpots.js src/gadgets/gadgetSave.js tests/unit/breakableSpots.test.js tests/unit/saveGadgets.test.js
git commit -m "Breakable placements, caches, and the gadgets save field"
```

---

### Task 5: XP, upgrade trees and the WayneTech save field

**Files:**
- Create: `src/progress/xp.js`, `src/progress/upgrades.js`, `src/progress/wayneSave.js`
- Test: `tests/unit/xp.test.js`, `tests/unit/upgrades.test.js`

**Interfaces:**
- Consumes: `registerProgressField`, `sanitizeProgress`, `newGameProgress`, `MEDALS` (Plan 3C `save.js`), `tracker` (Plan 3C).
- Produces: everything listed for `xp.js`, `upgrades.js` and `wayneSave.js`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/xp.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { XP, MEDAL_XP, XP_PER_LEVEL, levelOf, pointsEarned, pointsFree, toNext, comboXp, chainXp, medalXp, levelsCrossed, createComboRun } from '../../src/progress/xp.js';

describe('levels and points', () => {
  it('a level and a point every 1000 XP', () => {
    expect(XP_PER_LEVEL).toBe(1000);
    expect([levelOf(0), levelOf(999), levelOf(1000), levelOf(4321)]).toEqual([1, 1, 2, 5]);
    expect(pointsEarned(4321)).toBe(4);
    expect(pointsFree(4321, 3)).toBe(1);
    expect(pointsFree(1000, 5)).toBe(0);
    expect(levelOf(-50)).toBe(1);
  });
  it('toNext', () => {
    expect(toNext(4321)).toEqual({ into: 321, need: 679, fraction: 0.321 });
  });
  it('levelsCrossed lists every level gained', () => {
    expect(levelsCrossed(900, 1100)).toEqual([2]);
    expect(levelsCrossed(900, 3100)).toEqual([2, 3, 4]);
    expect(levelsCrossed(1100, 1900)).toEqual([]);
  });
});

describe('sources', () => {
  it('combos pay from 5 hits, with a bonus for variety', () => {
    expect(comboXp(4, 4)).toBe(0);
    expect(comboXp(5, 1)).toBe(20);
    expect(comboXp(10, 4)).toBe(80);
    expect(comboXp(20, 6)).toBe(160);
  });
  it('chains pay per goon, half again from stealth', () => {
    expect(chainXp(3, false)).toBe(150);
    expect(chainXp(2, true)).toBe(150);
  });
  it('medals pay only the improvement', () => {
    expect(medalXp(null, 'bronze')).toBe(MEDAL_XP.bronze);
    expect(medalXp('bronze', 'gold')).toBe(MEDAL_XP.gold - MEDAL_XP.bronze);
    expect(medalXp('gold', 'silver')).toBe(0);
    expect(medalXp('gold', null)).toBe(0);
  });
  it('a combo run tracks its peak and how many different moves', () => {
    const r = createComboRun();
    r.note('punch', 1); r.note('punch', 2); r.note('kick', 3); r.note('counter', 4);
    expect(r.peak).toBe(4);
    expect(r.close()).toEqual({ peak: 4, variety: 3 });
    expect(r.close()).toEqual({ peak: 0, variety: 0 });
  });
  it('the story alone earns 6 to 12 points (pacing guard)', () => {
    const fights = 12 * (XP.fightDone + 5 * XP.ko + 2 * comboXp(12, 4) + 3 * XP.counter);
    const story = fights + 12 * XP.balloon + 3 * 250 + 3 * 100 + 5 * chainXp(2, false) + 20 * XP.objectiveDone + 6 * XP.glassBroken;
    expect(pointsEarned(story)).toBeGreaterThanOrEqual(6);
    expect(pointsEarned(story)).toBeLessThanOrEqual(12);
  });
});
```

Create `tests/unit/upgrades.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TREES, UPGRADES, UPGRADE_IDS, BASE_EFFECTS, upgradeEffects, canBuy, upgradeStatus, damageFactor, regenStep } from '../../src/progress/upgrades.js';
import { sanitizeProgress, newGameProgress } from '../../src/core/save.js';
import { sanitizeWayneSave } from '../../src/progress/wayneSave.js';

const tree = (id) => TREES.find((t) => t.id === id).upgrades.map((u) => u.id);

describe('trees', () => {
  it('four trees of five, unique ids, one point each, no dashes in the copy', () => {
    expect(TREES.map((t) => t.id)).toEqual(['armor', 'combat', 'gadgets', 'traversal']);
    for (const t of TREES) expect(t.upgrades).toHaveLength(5);
    expect(new Set(UPGRADE_IDS).size).toBe(20);
    for (const u of UPGRADES) {
      expect(u.cost).toBe(1);
      expect(`${u.name} ${u.text}`).not.toMatch(/[\u2013\u2014]/);
    }
    expect(tree('combat')[4]).toBe('swarm');
  });
  it('each upgrade needs the one above it in its tree', () => {
    expect(canBuy([], 'plating1', 1)).toEqual({ ok: true, reason: null });
    expect(canBuy([], 'kevlar', 1)).toEqual({ ok: false, reason: 'locked' });
    expect(canBuy(['plating1'], 'kevlar', 0)).toEqual({ ok: false, reason: 'points' });
    expect(canBuy(['plating1'], 'plating1', 3)).toEqual({ ok: false, reason: 'owned' });
    expect(canBuy([], 'laser', 3)).toEqual({ ok: false, reason: 'unknown' });
    expect(upgradeStatus(['plating1'], 'kevlar', 1)).toBe('buyable');
    expect(upgradeStatus(['plating1'], 'kevlar', 0)).toBe('poor');
    expect(upgradeStatus([], 'kevlar', 5)).toBe('locked');
    expect(upgradeStatus(['plating1'], 'plating1', 0)).toBe('owned');
  });
});

describe('effects', () => {
  it('no upgrades: the game as it was', () => {
    expect(upgradeEffects([])).toEqual({ ...BASE_EFFECTS });
    expect(BASE_EFFECTS).toMatchObject({ specialAt: 8, gelRadius: 4, smokeCooldown: 12, freezeTime: 5, clawTargets: 1, batarangCount: 1, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4, boostUp: 15, glideMax: 48 });
  });
  it('every tree applies its numbers', () => {
    const e = upgradeEffects(UPGRADE_IDS);
    expect(e).toMatchObject({
      maxHealthBonus: 50, knifeMult: 0.7, rangedMult: 0.7, damageMult: 0.85, regenDelay: 2.5, regenRate: 12,
      counterWindow: 0.15, comboShield: 1, chainDiscount: 2, specialAt: 6, batSwarm: true,
      batarangCount: 3, gelRadius: 5.5, smokeCooldown: 7, clawTargets: 2, freezeTime: 8,
      boostUp: 19, boostOut: 11, diveGain: 1.3, glideMax: 56, wallRunTime: 1.8, ladderSlide: 14, diveRadius: 6,
    });
  });
  it('fills the object it is given (the live effects object)', () => {
    const live = upgradeEffects([]);
    const same = upgradeEffects(['plating1'], live);
    expect(same).toBe(live);
    expect(live.maxHealthBonus).toBe(25);
    upgradeEffects([], live);
    expect(live.maxHealthBonus).toBe(0);
  });
  it('damageFactor', () => {
    const e = upgradeEffects(tree('armor'));
    expect(damageFactor('knife', e)).toBeCloseTo(0.595);
    expect(damageFactor('buzzer', e)).toBeCloseTo(0.595);
    expect(damageFactor('grunt', e)).toBeCloseTo(0.85);
    expect(damageFactor('grunt', BASE_EFFECTS)).toBe(1);
  });
  it('regen waits for calm, then climbs at the rate, capped at max', () => {
    expect(regenStep(50, 100, { calm: false, sinceHurt: 99 }, BASE_EFFECTS, 1)).toBe(50);
    expect(regenStep(50, 100, { calm: true, sinceHurt: 5 }, BASE_EFFECTS, 1)).toBe(50);
    expect(regenStep(50, 100, { calm: true, sinceHurt: 7 }, BASE_EFFECTS, 1)).toBe(54);
    const medic = upgradeEffects(tree('armor').slice(0, 4));
    expect(regenStep(50, 100, { calm: true, sinceHurt: 3 }, medic, 1)).toBe(62);
    expect(regenStep(99, 100, { calm: true, sinceHurt: 9 }, BASE_EFFECTS, 1)).toBe(100);
  });
});

describe('wayne save field', () => {
  it('defaults, and keeps valid purchases', () => {
    expect(sanitizeProgress({}).wayne).toEqual({ xp: 0, owned: [], medals: {} });
    expect(sanitizeWayneSave({ xp: 3500.7, owned: ['plating1', 'reflexes'], medals: { neonSlalom: 'gold', bad: 'tin', 'x y': 'gold' } }))
      .toEqual({ xp: 3500, owned: ['plating1', 'reflexes'], medals: { neonSlalom: 'gold' } });
  });
  it('drops purchases whose prerequisite is missing, unknown ids and duplicates', () => {
    expect(sanitizeWayneSave({ xp: 9000, owned: ['kevlar', 'plating1', 'plating1', 'laser'] }).owned).toEqual(['plating1', 'kevlar']);
    expect(sanitizeWayneSave({ xp: 9000, owned: ['kevlar'] }).owned).toEqual([]);
  });
  it('never owns more than the XP paid for', () => {
    expect(sanitizeWayneSave({ xp: 1999, owned: ['plating1', 'kevlar', 'reflexes'] }).owned).toEqual(['plating1']);
  });
  it('rejects junk', () => {
    expect(sanitizeWayneSave({ xp: -5, owned: 'x', medals: [] })).toEqual({ xp: 0, owned: [], medals: {} });
    expect(sanitizeWayneSave({ xp: Infinity }).xp).toBe(0);
  });
  it('a new game keeps XP and upgrades', () => {
    const p = sanitizeProgress({ step: 20, wayne: { xp: 5000, owned: ['plating1'] } });
    expect(newGameProgress(p).wayne).toEqual(p.wayne);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/xp.test.js tests/unit/upgrades.test.js`
Expected: FAIL (modules missing).

- [ ] **Step 3: Write `src/progress/xp.js`**

```js
// Experience points: what play pays, levels and upgrade points. Pure.
export const XP_PER_LEVEL = 1000;

// Flat amounts per event. Part H events (crateOpened, missionDone) are listed now so its modules
// only emit them.
export const XP = {
  ko: 10, takedown: 40, special: 25, counter: 5, fightDone: 100, objectiveDone: 25,
  balloon: 150, crimeStopped: 200, glassBroken: 50, wallBroken: 50,
  chainPerGoon: 50, swarmPerGoon: 60, crateOpened: 200, missionDone: 500,
};
// A medal's worth; a better medal pays the difference.
export const MEDAL_XP = { bronze: 150, silver: 300, gold: 500 };

export const pointsEarned = (xp) => Math.floor(Math.max(0, xp) / XP_PER_LEVEL);
export const levelOf = (xp) => pointsEarned(xp) + 1;
export const pointsFree = (xp, spent) => Math.max(0, pointsEarned(xp) - spent);

export function toNext(xp) {
  const into = Math.max(0, xp) % XP_PER_LEVEL;
  return { into, need: XP_PER_LEVEL - into, fraction: into / XP_PER_LEVEL };
}

// A finished combo: 4 per hit from 5 hits up, plus 20 per different move beyond two.
export function comboXp(peak, variety) {
  if (peak < 5) return 0;
  return 4 * peak + 20 * Math.max(0, variety - 2);
}

export function chainXp(count, stealth) {
  return Math.round(XP.chainPerGoon * count * (stealth ? 1.5 : 1));
}

export function medalXp(prev, next) {
  return Math.max(0, (MEDAL_XP[next] ?? 0) - (MEDAL_XP[prev] ?? 0));
}

export function levelsCrossed(before, after) {
  const a = levelOf(before), b = levelOf(after);
  const out = [];
  for (let l = a + 1; l <= b; l++) out.push(l);
  return out;
}

// One combo run: the highest count and the set of moves used, closed when the combo ends.
export function createComboRun() {
  let peak = 0;
  const moves = new Set();
  return {
    get peak() { return peak; },
    note(move, value) { if (value > peak) peak = value; if (move) moves.add(move); },
    close() {
      const r = { peak, variety: moves.size };
      peak = 0;
      moves.clear();
      return r;
    },
  };
}
```

- [ ] **Step 4: Write `src/progress/upgrades.js`**

```js
// WayneTech: four trees of five upgrades, one point each, each needing the one above it. Every
// effect is a number in one shared effects object that combat, the hero and the gadgets read. Pure.
export const TREES = [
  { id: 'armor', name: 'Armor', upgrades: [
    { id: 'plating1', name: 'Reinforced Plating', text: 'Max health +25.' },
    { id: 'kevlar', name: 'Kevlar Weave', text: "Knife slashes and the Joker's thrown gags hurt 30% less." },
    { id: 'plating2', name: 'Titanium Plating', text: 'Max health +25 more.' },
    { id: 'medic', name: 'Field Medic', text: 'Out of a fight, health comes back after 2.5 s instead of 6 s, three times as fast.' },
    { id: 'dampers', name: 'Impact Dampers', text: 'Every hit hurts 15% less.' },
  ] },
  { id: 'combat', name: 'Combat', upgrades: [
    { id: 'reflexes', name: 'Quick Reflexes', text: 'Blue bolts stay up 0.15 s longer: more time to counter.' },
    { id: 'flow', name: 'Steady Flow', text: 'The first hit you take in a combo does not break it.' },
    { id: 'efficient', name: 'Efficient Chains', text: 'Chain takedowns cost 2 less combo.' },
    { id: 'fastFinish', name: 'Fast Finish', text: 'Special takedowns unlock at combo 6 instead of 8.' },
    { id: 'swarm', name: 'Bat Swarm', text: 'A fourth chain takedown at combo 15: a swarm of bats takes down up to six goons.' },
  ] },
  { id: 'gadgets', name: 'Gadgets', upgrades: [
    { id: 'triple', name: 'Triple Batarang', text: 'The batarang throws up to three at once, one per goon.' },
    { id: 'bigBang', name: 'Bigger Bang', text: 'Explosive gel blast grows from 4 m to 5.5 m.' },
    { id: 'quickSmoke', name: 'Quick Smoke', text: 'Smoke pellet cooldown drops from 12 s to 7 s.' },
    { id: 'doubleClaw', name: 'Double Claw', text: 'The batclaw pulls two goons at once.' },
    { id: 'deepFreeze', name: 'Deep Freeze', text: 'Freeze blast ice lasts 8 s instead of 5 s.' },
  ] },
  { id: 'traversal', name: 'Traversal', upgrades: [
    { id: 'accelerator', name: 'Grapple Accelerator', text: 'Grapple boost launches you about 25% higher and farther.' },
    { id: 'aero', name: 'Aerodynamic Cape', text: 'Glide dives build speed 30% faster, top speed 56 m/s instead of 48.' },
    { id: 'grip', name: 'Wall Grip Boots', text: 'Wall runs last 1.8 s instead of 1.2 s.' },
    { id: 'rails', name: 'Slide Rails', text: 'Slide down ladders at 14 m/s instead of 9.' },
    { id: 'seismic', name: 'Seismic Landing', text: 'Dive bomb shockwave reaches 6 m instead of 4 m.' },
  ] },
];

export const UPGRADES = TREES.flatMap((t) => t.upgrades.map((u, tier) => ({
  ...u, tree: t.id, tier, cost: 1, requires: tier ? t.upgrades[tier - 1].id : null,
})));
export const UPGRADE_IDS = UPGRADES.map((u) => u.id);
const byId = new Map(UPGRADES.map((u) => [u.id, u]));

export const BASE_EFFECTS = Object.freeze({
  // Armor
  maxHealthBonus: 0, knifeMult: 1, rangedMult: 1, damageMult: 1, regenDelay: 6, regenRate: 4,
  // Combat
  counterWindow: 0, comboShield: 0, chainDiscount: 0, specialAt: 8, batSwarm: false,
  // Gadgets
  batarangCount: 1, gelRadius: 4, smokeCooldown: 12, clawTargets: 1, freezeTime: 5,
  // Traversal (hero.tuning reads these names)
  boostUp: 15, boostOut: 9, diveGain: 1, glideMax: 48, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4,
});

const APPLY = {
  plating1: (e) => { e.maxHealthBonus += 25; },
  kevlar: (e) => { e.knifeMult = 0.7; e.rangedMult = 0.7; },
  plating2: (e) => { e.maxHealthBonus += 25; },
  medic: (e) => { e.regenDelay = 2.5; e.regenRate = 12; },
  dampers: (e) => { e.damageMult = 0.85; },
  reflexes: (e) => { e.counterWindow = 0.15; },
  flow: (e) => { e.comboShield = 1; },
  efficient: (e) => { e.chainDiscount = 2; },
  fastFinish: (e) => { e.specialAt = 6; },
  swarm: (e) => { e.batSwarm = true; },
  triple: (e) => { e.batarangCount = 3; },
  bigBang: (e) => { e.gelRadius = 5.5; },
  quickSmoke: (e) => { e.smokeCooldown = 7; },
  doubleClaw: (e) => { e.clawTargets = 2; },
  deepFreeze: (e) => { e.freezeTime = 8; },
  accelerator: (e) => { e.boostUp = 19; e.boostOut = 11; },
  aero: (e) => { e.diveGain = 1.3; e.glideMax = 56; },
  grip: (e) => { e.wallRunTime = 1.8; },
  rails: (e) => { e.ladderSlide = 14; },
  seismic: (e) => { e.diveRadius = 6; },
};

// Rebuilds `out` (the live effects object) from the owned upgrades.
export function upgradeEffects(owned, out = {}) {
  Object.assign(out, BASE_EFFECTS);
  for (const u of UPGRADES) if (owned.includes(u.id)) APPLY[u.id](out);
  return out;
}

export function canBuy(owned, id, free) {
  const u = byId.get(id);
  if (!u) return { ok: false, reason: 'unknown' };
  if (owned.includes(id)) return { ok: false, reason: 'owned' };
  if (u.requires && !owned.includes(u.requires)) return { ok: false, reason: 'locked' };
  if (free < u.cost) return { ok: false, reason: 'points' };
  return { ok: true, reason: null };
}

export function upgradeStatus(owned, id, free) {
  const r = canBuy(owned, id, free);
  if (r.ok) return 'buyable';
  return r.reason === 'owned' ? 'owned' : r.reason === 'points' ? 'poor' : 'locked';
}

// How much of an attack's damage lands. `buzzer` is the Joker's thrown gag.
export function damageFactor(kind, e) {
  const k = kind === 'knife' ? e.knifeMult : kind === 'buzzer' ? e.rangedMult : 1;
  return k * e.damageMult;
}

// Health recovery out of combat: after `regenDelay` seconds calm and unhurt, `regenRate` per second.
export function regenStep(health, max, { calm, sinceHurt }, e, dt) {
  if (!calm || sinceHurt < e.regenDelay || health >= max) return health;
  return Math.min(max, health + e.regenRate * dt);
}
```

- [ ] **Step 5: Write `src/progress/wayneSave.js`**

```js
// The saved WayneTech state (progress.wayne): XP, owned upgrades, and the best medal already paid
// for per challenge. Registers itself at load (import before loadProgress). Pure.
import { registerProgressField, MEDALS } from '../core/save.js';
import { tracker } from '../game/progressTracker.js';
import { UPGRADES, UPGRADE_IDS } from './upgrades.js';
import { pointsEarned, levelOf } from './xp.js';

const ID = /^[a-zA-Z][a-zA-Z0-9]{0,31}$/;

export function sanitizeWayneSave(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const xp = typeof r.xp === 'number' && Number.isFinite(r.xp) && r.xp > 0 ? Math.floor(Math.min(r.xp, 1e7)) : 0;
  const want = Array.isArray(r.owned) ? r.owned : [];
  // In tree order, so a prerequisite is always seen before what needs it.
  const owned = [];
  for (const u of UPGRADES) {
    if (!want.includes(u.id) || (u.requires && !owned.includes(u.requires))) continue;
    owned.push(u.id);
  }
  // Never more than the XP paid for: drop from the end of the purchase order.
  const keep = want.filter((id, i) => UPGRADE_IDS.includes(id) && want.indexOf(id) === i && owned.includes(id));
  while (keep.length > pointsEarned(xp)) keep.pop();
  const final = UPGRADES.filter((u) => keep.includes(u.id) && (!u.requires || keep.includes(u.requires))).map((u) => u.id);
  const medals = {};
  if (r.medals && typeof r.medals === 'object' && !Array.isArray(r.medals)) {
    for (const [id, m] of Object.entries(r.medals).slice(0, 32)) if (ID.test(id) && MEDALS.includes(m)) medals[id] = m;
  }
  return { xp, owned: final, medals };
}

registerProgressField('wayne', { sanitize: sanitizeWayneSave });

tracker.register({
  id: 'wayneTech', label: 'WayneTech upgrades', weight: 5,
  count: (p) => ({ done: p.wayne.owned.length, total: UPGRADE_IDS.length }),
  detail: (p) => `Level ${levelOf(p.wayne.xp)}, ${p.wayne.owned.length} of ${UPGRADE_IDS.length} upgrades`,
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/unit/xp.test.js tests/unit/upgrades.test.js`
Expected: PASS. In the "never owns more than the XP paid for" case the purchase order is `plating1, kevlar, reflexes` with 1 point, so only `plating1` stays. If the pacing test fails, tune the `XP` table (not the test's play counts) and say so in the commit message.

- [ ] **Step 7: Commit**

```bash
git add src/progress/xp.js src/progress/upgrades.js src/progress/wayneSave.js tests/unit/xp.test.js tests/unit/upgrades.test.js
git commit -m "XP, levels, four WayneTech trees and the wayne save field"
```

---
### Task 6: Input: the wheel action, "Use gadget", RB tap and hold, the Bat Swarm key

**Files:**
- Modify: `src/core/bindings.js`, `src/core/input.js`
- Test: `tests/unit/bindings.test.js`, `tests/unit/input.test.js` (Plan 4E created it)

**Interfaces:**
- Consumes: Plan 4E's `PAD_BUTTONS`, `PAD_CHORD_HOLD`, `PAD_CHORDS`, `padActions`; Plan 3C's `photo` action on D-pad up, `input.stick`, `input.padButtonHeld`.
- Produces: actions `gadgetWheel` (default `Tab`) and `chain4` (default `Digit4`); the `batarang` action labelled `Use gadget` (its id stays, so saved bindings and every prompt that shows `k('batarang')` keep working); `PAD_WHEEL`, `PAD_TAP`, `createHoldTap`; `PAD_CHORDS.chain4 = 4`; `input.codePressed(code)`, `input.swallow(code)`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/bindings.test.js`:

```js
import { sanitizeSettings } from '../../src/core/settings.js';

describe('gadget bindings', () => {
  it('Tab holds the wheel, R uses the gadget, 4 calls the Bat Swarm', () => {
    expect(DEFAULT_BINDINGS.gadgetWheel).toEqual(['Tab']);
    expect(DEFAULT_BINDINGS.batarang).toEqual(['KeyR']);
    expect(DEFAULT_BINDINGS.chain4).toEqual(['Digit4']);
    expect(ACTIONS.find((a) => a.id === 'batarang').label).toBe('Use gadget');
    expect(keyLabel('Tab')).toBe('Tab');
    for (const id of ['gadgetWheel', 'chain4']) {
      const a = ACTIONS.find((x) => x.id === id);
      expect(a.group).toBe('Fight');
      expect(a.label).not.toMatch(/[\u2013\u2014]/);
    }
  });
  it('old saved bindings keep working and pick up the new defaults', () => {
    const s = sanitizeSettings({ bindings: { batarang: ['KeyT'] } });
    expect(s.bindings.batarang).toEqual(['KeyT']);
    expect(s.bindings.gadgetWheel).toEqual(['Tab']);
    expect(s.bindings.chain4).toEqual(['Digit4']);
  });
});
```

Append to `tests/unit/input.test.js` (keep its `pad` and `acts` helpers):

```js
import { createHoldTap, PAD_TAP, PAD_WHEEL } from '../../src/core/input.js';

describe('right bumper: tap for the cape, hold for the gadget wheel', () => {
  it('RB alone is no longer a plain pad action', () => {
    expect(acts(PAD_WHEEL)).toEqual([]);
  });
  it('a tap reports on release', () => {
    const h = createHoldTap(PAD_TAP);
    expect(h.update(true, 0.016)).toBe(null);
    expect(h.update(true, 0.1)).toBe(null);
    expect(h.update(false, 0.016)).toBe('tap');
    expect(h.holding).toBe(false);
  });
  it('holding past 0.22 s opens, letting go closes, and no tap fires', () => {
    const h = createHoldTap(0.22);
    h.update(true, 0.016);
    expect(h.update(true, 0.15)).toBe(null);
    expect(h.update(true, 0.1)).toBe('hold');
    expect(h.holding).toBe(true);
    expect(h.update(true, 0.5)).toBe(null);
    expect(h.update(false, 0.016)).toBe('release');
    expect(h.holding).toBe(false);
    expect(h.update(false, 0.016)).toBe(null);
  });
  it('Y plus LB is the Bat Swarm, LB alone still grapples', () => {
    expect(acts(3, 4)).toEqual(['block', 'chain4']);
    expect(acts(4)).toEqual(['grapple']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/bindings.test.js tests/unit/input.test.js`
Expected: FAIL. (If Plan 4E's `expect(acts(12)).toEqual([])` also fails, that line predates Plan 3C's photo button on D-pad up: change it to `toEqual(['photo'])`. It is a merge leftover, not part of this plan's change.)

- [ ] **Step 3: Bindings.** In `src/core/bindings.js`:
  - Change the batarang action to `{ id: 'batarang', label: 'Use gadget', group: 'Fight' },` and add right after it `{ id: 'gadgetWheel', label: 'Gadget wheel (hold, then pick with the mouse or 1 to 8)', group: 'Fight' },`.
  - After Plan 4E's `chain3` action add `{ id: 'chain4', label: 'Chain takedown 4: Bat Swarm (combo 15, WayneTech)', group: 'Fight' },`.
  - In `DEFAULT_BINDINGS` add `gadgetWheel: ['Tab'],` after `batarang: ['KeyR'],` and `chain4: ['Digit4'],` after `chain3: ['Digit3'],`.

- [ ] **Step 4: Input.** In `src/core/input.js`:
  - Remove `cape: [5]` from `PAD_BUTTONS` and put this comment above it: `// RB (5) is not here: a tap is the cape stun and a hold opens the gadget wheel (createHoldTap).`
  - Change `PAD_CHORDS` to `{ chain1: 14, chain2: 12, chain3: 15, chain4: 4 }` and extend its comment: `Y plus LB is the Bat Swarm (chain 4).`
  - Add below `padActions`:

```js
// The right bumper: a tap is the cape stun (it fires on release), holding it past PAD_TAP
// opens the gadget wheel until it is let go. Pure.
export const PAD_WHEEL = 5;
export const PAD_TAP = 0.22;
export function createHoldTap(holdTime = PAD_TAP) {
  let down = false, t = 0, holding = false;
  return {
    get holding() { return holding; },
    update(isDown, dt) {
      if (isDown) {
        if (!down) { down = true; t = 0; holding = false; return null; }
        t += dt;
        if (!holding && t >= holdTime) { holding = true; return 'hold'; }
        return null;
      }
      if (!down) return null;
      down = false;
      const was = holding;
      holding = false;
      return was ? 'release' : 'tap';
    },
  };
}
```

  - Inside `createInput`, next to the other state, add `const rbHold = createHoldTap(PAD_TAP); let capeTap = false;`.
  - Change `function pollPad()` to `function pollPad(dt = 0)`. Right after the `padActions((i) => !!pad.buttons[i]?.pressed, now);` line (Plan 4E), add:

```js
      if (rbHold.update(!!pad.buttons[PAD_WHEEL]?.pressed, dt) === 'tap') capeTap = true;
      if (rbHold.holding) now.add('gadgetWheel');
```

  In the `else` (no pad) branch add `rbHold.update(false, dt);`. After the line `for (const a of now) if (!padHeld.has(a)) padPressed.add(a);` add:

```js
    if (capeTap) { padPressed.add('cape'); capeTap = false; device = 'pad'; }
```

  - In `update(dt)`, change `pollPad();` to `pollPad(dt);`.
  - Add to the returned object:

```js
    // Raw key presses this frame, for the gadget wheel's 1 to 8 (whatever they are bound to).
    codePressed: (code) => pressedCodes.has(code),
    // Hides a key press from every action for the rest of this frame (the open wheel eats 1 to 8,
    // so chain takedowns on 1 to 3 never fire from a wheel pick).
    swallow(code) { pressedCodes.delete(code); },
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run`
Expected: PASS, including "never binds one code to two actions by default".

- [ ] **Step 6: Commit**

```bash
git add src/core/bindings.js src/core/input.js tests/unit/bindings.test.js tests/unit/input.test.js
git commit -m "Gadget wheel on Tab and RB hold, Use gadget on R, Bat Swarm on 4 and Y plus LB"
```

---

### Task 7: Gadget moves and enemy states (frozen, dancing, lost, yanked)

**Files:**
- Modify: `src/combat/rules.js`, `src/actors/enemy.js`, `src/combat/chains.js` (Plan 4E)
- Test: `tests/unit/combat.test.js`, `tests/unit/chains.test.js`

**Interfaces:**
- Consumes: `yankVelocity` (Task 3); Plan 4E's enemy states and its `e.update` layout.
- Produces: `MOVES.gel`, `remote`, `claw`, `smoke`, `popper`, `shatter`; `e.freeze`, `e.thaw`, `e.dance`, `e.lose`, `e.yank`; states `frozen` and `dance`; `e.frozenT`, `e.danceT`, `e.lostT`, `e.shattered`; any hit on a frozen goon knocks it out (`applyHit`).

- [ ] **Step 1: Write the failing tests.** Append to `tests/unit/combat.test.js` (add `ENEMY` to its `rules.js` import if missing):

```js
describe('gadget moves', () => {
  const e = (type, o = {}) => ({ type, health: ENEMY[type].health, stunned: false, down: false, ...o });
  it('gel knocks goons down and breaks a knife guard; brutes shrug it off unless stunned', () => {
    expect(resolveHit('gel', e('grunt')).outcome).toBe('knockdown');
    expect(resolveHit('gel', e('knife')).outcome).toBe('knockdown');
    expect(resolveHit('gel', e('brute')).outcome).toBe('immune');
    expect(resolveHit('gel', e('brute', { stunned: true })).outcome).toBe('knockdown');
  });
  it('remote, claw, smoke and popper only stun, even brutes', () => {
    for (const m of ['remote', 'claw', 'smoke', 'popper']) expect(resolveHit(m, e('brute')).outcome, m).toBe('stun');
    expect(resolveHit('smoke', e('grunt')).stun).toBe(3);
    expect(resolveHit('popper', e('grunt')).stun).toBe(3);
  });
  it('shatter knocks anyone out', () => {
    expect(resolveHit('shatter', e('brute')).outcome).toBe('ko');
  });
});
```

Append to `tests/unit/chains.test.js` (it has the `goon` helper):

```js
describe('gadget states and chains', () => {
  it('a goon in ice cannot be chained; a dancing one can', () => {
    expect(chainEligible(goon('f', 1, 1, { state: 'frozen' }))).toBe(false);
    expect(chainEligible(goon('d', 1, 1, { state: 'dance' }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/combat.test.js tests/unit/chains.test.js`
Expected: FAIL.

- [ ] **Step 3: Moves** in `src/combat/rules.js`, at the end of `MOVES`:

```js
  // Gadgets.
  gel: { damage: 1, knockdown: true, breaksGuard: true },
  remote: { damage: 0, stun: 1.5, stunOnly: true },
  claw: { damage: 0, stun: 1.2, stunOnly: true },
  smoke: { damage: 0, stun: 3, stunOnly: true },
  popper: { damage: 0, stun: 3, stunOnly: true },
  shatter: { ko: true },
```

- [ ] **Step 4: Chains.** In `src/combat/chains.js`, change the last line of `chainEligible` to:

```js
  return e.state !== 'grabbed' && e.state !== 'chained' && e.state !== 'tied' && e.state !== 'frozen';
```

- [ ] **Step 5: Enemy states** in `src/actors/enemy.js`.
  - Import: `import { yankVelocity } from '../gadgets/aim.js';`
  - In the `e` literal, after Plan 4E's `tiedWith: null, tiedT: 0,` add `frozenT: 0, danceT: 0, lostT: 0, shattered: false,`.
  - Change `e.ready` to also need `e.lostT <= 0`:

```js
  e.ready = (hero) => e.state === 'engage' && e.alive && !e.down && e.lostT <= 0 && tmp.set(hero.pos.x - pos.x, 0, hero.pos.z - pos.z).length() < 6.5;
```

  - After Plan 4E's `e.tie`, add:

```js
  // Freeze blast: stuck in ice for `sec`. No AI and no animation (the pose stays in the ice).
  // Any hit shatters it (applyHit). Returns whether it was mid-attack.
  e.freeze = (sec) => {
    if (!e.alive || e.def.boss) return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    e.knock.set(0, 0, 0);
    e.frozenT = sec;
    e.shattered = false;
    setState('frozen');
    return was;
  };
  e.thaw = () => {
    if (e.state !== 'frozen') return;
    e.frozenT = 0;
    setState(e.aware ? 'engage' : 'idle');
  };

  // Party popper: stunned and dancing for `sec`. A hit ends the dance early.
  e.dance = (sec) => {
    if (!e.alive || e.down || e.air || e.def.boss) return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.stunned = true;
    e.stunT = Math.max(e.stunT, sec);
    e.danceT = sec;
    setState('dance');
    play('Dance_Loop', { fade: 0.15 });
    return was;
  };

  // Smoke: loses track of Batman for `sec`: no wind-ups, and the goon drifts off its ring.
  // Part D's stealth can define e.search(from) to send it looking instead.
  e.lose = (sec, from) => {
    if (e.lostT <= 0) e.ringDist += 3;
    e.lostT = Math.max(e.lostT, sec);
    e.ringAngle += Math.PI * (0.5 + rng.next());
    e.search?.(from);
  };

  // Batclaw: yanked on an arc to `to` (in front of Batman). It lands down, so the next punch is a
  // free knockout; yanked off a ledge, it falls and onLanded knocks it out.
  e.yank = (to) => {
    if (!e.alive || e.def.boss || e.state === 'frozen') return false;
    const was = e.state === 'windup' || e.state === 'attack';
    e.glyph = null;
    e.countered = false;
    const v = yankVelocity(pos, to);
    e.launch(v.vx, v.vy, v.vz);
    e.down = true;
    e.downT = Math.max(e.downT, 1.8);
    setState('down');
    play('Hit_Knockback', { once: true, timeScale: 1.3, fade: 0.05 });
    return was;
  };
```

  - First line of `e.applyHit`, before `e.countered = false;`:

```js
    // A hit on ice shatters it: out cold, whatever the move was.
    if (e.state === 'frozen') { e.shattered = true; e.frozenT = 0; e.health = 0; result = { outcome: 'ko', damage: 0, stun: 0 }; }
```

  (`result` is the function's first parameter; reassigning it is intended.)
  - In `e.update`, right after Plan 4E's `grabbed`/`chained` early return, add:

```js
    if (e.state === 'frozen') {
      e.frozenT -= dt;
      if (e.frozenT <= 0) e.thaw();
      return;
    }
    if (e.lostT > 0) { e.lostT -= dt; if (e.lostT <= 0) e.ringDist = Math.max(3.6, e.ringDist - 3); }
```

  - In the `engage`/`recover` case, change `if (dist < 8) faceHero(hero, 8, dt);` to `if (dist < 8 && e.lostT <= 0) faceHero(hero, 8, dt);`.
  - Add a case before `case 'ko':`:

```js
      case 'dance':
        e.danceT -= dt;
        if (e.danceT <= 0) { e.stunned = false; e.stunT = 0; setState(e.aware ? 'engage' : 'idle'); }
        break;
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Check the states in the game.** Build and preview (see Global Constraints), then:

```bash
cat > "$TEMP/g5-t7.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.combat ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const [a, b] = window.__game.enemies; [a.freeze(1.5), a.state, b.dance(1), b.state, b.stunned]", "wait": 400},
 {"shot": "t7-states"},
 {"eval": "const G = window.__game, a = G.enemies[0]; a.applyHit({ outcome: 'hit' }, G.hero.pos); [a.state, a.alive, a.shattered]"},
 {"eval": "const e = window.__game.enemies[2]; e.freeze(1); 'frozen c'", "wait": 1300},
 {"eval": "const G = window.__game; [G.enemies[1].state, G.enemies[2].state]"},
 {"eval": "const G = window.__game, e = G.enemies[3], h = G.hero.pos; e.yank({ x: h.x, y: h.y, z: h.z + 1.3 }); e.state", "wait": 800},
 {"eval": "const G = window.__game, e = G.enemies[3]; [e.state, e.down, Math.hypot(e.pos.x - G.hero.pos.x, e.pos.z - G.hero.pos.z).toFixed(2)]"},
 {"eval": "const e = window.__game.enemies[4]; e.lose(2, e.pos); [e.lostT, e.ready(window.__game.hero)]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1" "$TEMP/g5" "$(cat "$TEMP/g5-t7.json")"
```

Expected: the first eval prints `[false,"frozen",false,"dance",true]`; after the hit on the frozen goon `["ko",false,true]`; after 1.3 s the dancer is back to `engage` and the second frozen goon has thawed to `engage`; the yanked goon is `down` within about 1.5 m of Batman; the lost brute prints `[2,false]`; `t7-states.png` shows one goon standing rigid and one dancing; `no console errors`.

- [ ] **Step 8: Commit**

```bash
git add src/combat/rules.js src/actors/enemy.js src/combat/chains.js tests/unit/combat.test.js tests/unit/chains.test.js
git commit -m "Gadget moves; frozen, dancing, lost and yanked goons"
```

---

### Task 8: Combat hooks: effects, the gadget key, the gadget API, pooled batarangs

**Files:**
- Modify: `src/combat/combatSystem.js`, `src/game/fx.js`, `src/ui/hud.js`, `src/game/game.js` (the `setCombo` call and the special hint only)
- Test: `tests/unit/combatHooks.test.js` (new)

**Interfaces:**
- Consumes: `BASE_EFFECTS`, `damageFactor`, `upgradeEffects` (Task 5); `createCombo` (Task 1); Plan 4E's `getChainDiscount`, `landHit` tied hook, `critical(target, opts)`, `chainAvailability`.
- Produces: `createCombat({ ..., effects, useGadget })` with `getChainDiscount` defaulting to `() => effects.chainDiscount`; `combat.gadgetApi`; `combat.applyEffects()`; `ctx.lockInput`; event `iceShatter`; `fx.batarang(from, getTarget(out), onHit)` pooled; `hud.setCombo(n, readyAt)`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/combatHooks.test.js`. It drives the real combat system with stub heroes and goons. If the merged `combatSystem.js` reads a hero field the stub lacks, add that field to `makeHero`; never change the system to suit the test.

```js
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { createCombat } from '../../src/combat/combatSystem.js';
import { createEvents } from '../../src/core/events.js';
import { createTimeControl } from '../../src/core/time.js';
import { createRng } from '../../src/core/rng.js';
import { ENEMY } from '../../src/combat/rules.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';

function makeHero() {
  return {
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), state: 'ground', grounded: true, control: null, dead: false,
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
      else if (r.outcome === 'knockdown') { this.down = true; this.state = 'down'; }
      return false;
    },
    update(dt, ctx) { if (this.attack) { const k = this.attack; this.attack = null; ctx.onAttackLand(this, k); } },
    ready() { return this.state === 'engage'; },
    startWindup(w) { this.windups.push(w); this.state = 'windup'; },
    ...o,
  };
}
const follow = { forward: (v = new THREE.Vector3()) => v.set(0, 0, 1), right: (v = new THREE.Vector3()) => v.set(-1, 0, 0), addShake() {}, actionShot() {} };
const ctxWith = (pressed = []) => ({ input: { move: { x: 0, y: 0 }, pressed: (a) => pressed.includes(a), down: () => false }, fx: {} });
function setup({ owned = [], useGadget = null } = {}) {
  const hero = makeHero();
  const events = createEvents();
  const effects = upgradeEffects(owned);
  const combat = createCombat({ hero, follow, time: createTimeControl(), events, rng: createRng(3), getDifficulty: () => 'normal', effects, useGadget });
  hero.combat = combat;
  return { hero, events, combat, effects };
}
const tree = { armor: ['plating1', 'kevlar', 'plating2', 'medic', 'dampers'], combat: ['reflexes', 'flow', 'efficient', 'fastFinish', 'swarm'] };

describe('armor hooks', () => {
  it('knife damage without and with Kevlar Weave', () => {
    for (const [owned, left] of [[[], 85], [tree.armor.slice(0, 2), 89.5]]) {
      const { hero, combat } = setup({ owned });
      combat.setEnemies([makeGoon('k', 'knife', 0, 1.5, { attack: 'knife' })]);
      combat.update(0.016, ctxWith());
      expect(hero.health).toBeCloseTo(left);
    }
  });
  it('Impact Dampers stack with Kevlar', () => {
    const { hero, combat } = setup({ owned: tree.armor });
    combat.setEnemies([makeGoon('k', 'knife', 0, 1.5, { attack: 'knife' })]);
    combat.update(0.016, ctxWith());
    expect(hero.health).toBeCloseTo(100 - 15 * 0.7 * 0.85, 1);
  });
});

describe('combat hooks', () => {
  it('Steady Flow keeps the combo through the first hit taken', () => {
    const { combat } = setup({ owned: tree.combat.slice(0, 2) });
    const g = makeGoon('g', 'grunt', 0, 1.5);
    combat.setEnemies([g]);
    for (let i = 0; i < 5; i++) combat.combo.hit();
    g.attack = 'grunt';
    combat.update(0.016, ctxWith());
    expect(combat.combo.value).toBe(5);
    g.attack = 'grunt';
    combat.update(0.016, ctxWith());
    expect(combat.combo.value).toBe(0);
  });
  it('Quick Reflexes lengthens counterable wind-ups only', () => {
    const { combat } = setup({ owned: ['reflexes'] });
    const g = makeGoon('g', 'grunt', 0, 3), b = makeGoon('b', 'brute', 1, 4);
    combat.setEnemies([g, b]);
    combat.update(3, ctxWith());
    combat.update(0.5, ctxWith());
    expect(g.windups[0]).toBeCloseTo(0.75);
    expect(b.windups[0]).toBeCloseTo(0.6);
  });
  it('Fast Finish readies the special at combo 6', () => {
    for (const [owned, ready] of [[[], false], [tree.combat.slice(0, 4), true]]) {
      const { combat } = setup({ owned });
      for (let i = 0; i < 6; i++) combat.combo.hit();
      expect(combat.combo.ready).toBe(ready);
    }
  });
  it('Efficient Chains lowers every chain cost by 2 through the 4E hook', () => {
    const { combat } = setup({ owned: tree.combat.slice(0, 3) });
    combat.setEnemies([makeGoon('a', 'grunt', 1, 2), makeGoon('b', 'grunt', -1, 2)]);
    for (let i = 0; i < 4; i++) combat.combo.hit();
    combat.update(0.016, ctxWith());
    expect(combat.chains.costs).toEqual([4, 7, 10]);
  });
  it('applyEffects picks up a purchase made mid-run', () => {
    const { combat, effects } = setup();
    upgradeEffects(tree.combat.slice(0, 4), effects);
    combat.applyEffects();
    for (let i = 0; i < 6; i++) combat.combo.hit();
    expect(combat.combo.ready).toBe(true);
  });
});

describe('gadget hooks', () => {
  it('the fire key goes to the gadget system through the input buffer', () => {
    const useGadget = vi.fn(() => true);
    const { combat } = setup({ useGadget });
    combat.update(0.016, ctxWith(['batarang']));
    combat.update(0.016, ctxWith());
    expect(useGadget).toHaveBeenCalledTimes(1);
    expect(useGadget.mock.calls[0][1]).toEqual({ inAir: false });
  });
  it('nothing is buffered while the wheel is open', () => {
    const useGadget = vi.fn(() => true);
    const { combat } = setup({ useGadget });
    const ctx = ctxWith(['batarang']);
    ctx.lockInput = true;
    combat.update(0.016, ctx);
    combat.update(0.016, ctxWith());
    expect(useGadget).not.toHaveBeenCalled();
  });
  it('areaBlast knocks down goons in reach; brutes shrug it off; far goons are safe', () => {
    const { combat } = setup();
    const near = makeGoon('n', 'grunt', 0, 2), far = makeGoon('f', 'grunt', 0, 6), brute = makeGoon('b', 'brute', 1, 0);
    combat.setEnemies([near, far, brute]);
    expect(combat.gadgetApi.areaBlast({ x: 0, y: 0, z: 0 }, 4, 'gel')).toBe(1);
    expect(near.outcomes).toEqual(['knockdown']);
    expect(brute.outcomes).toEqual(['immune']);
    expect(far.outcomes).toEqual([]);
  });
  it('any hit on a frozen goon shatters the ice and knocks it out', () => {
    const { combat, events } = setup();
    const g = makeGoon('g', 'grunt', 0, 2, { state: 'frozen' });
    combat.setEnemies([g]);
    const seen = [];
    events.on('iceShatter', () => seen.push('shatter'));
    events.on('ko', () => seen.push('ko'));
    expect(combat.gadgetApi.landHit('punch', g).outcome).toBe('ko');
    expect(g.alive).toBe(false);
    expect(seen).toEqual(['shatter', 'ko']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/combatHooks.test.js`
Expected: FAIL (`effects`, `useGadget`, `gadgetApi` don't exist).

- [ ] **Step 3: Effects in `src/combat/combatSystem.js`.**
  - Import: `import { BASE_EFFECTS, damageFactor } from '../progress/upgrades.js';`
  - Signature (keeps the `reach` option from `kicks` and Plan 4E's hook, now defaulting to the effects object), and the combo built from the effects (replacing `const combo = createCombo({ timeout: 1.5, ready: 8 });`):

```js
export function createCombat({ hero, follow, time, events, rng, getDifficulty, reach = {}, effects = BASE_EFFECTS, getChainDiscount = () => effects.chainDiscount, useGadget = null }) {
  const combo = createCombo({ timeout: 1.5, ready: effects.specialAt, shield: effects.comboShield });
```

  - In `onAttackLand`, replace the `const dmg = ...` line with:

```js
    const dmg = Math.round(damageToHero(kind, { difficulty, blocking }) * damageFactor(kind, effects) * 100) / 100;
```

  - In `update`, change the director line to:

```js
        if (e) e.startWindup(DIFFICULTY[difficulty].windup + (e.def.counterable ? effects.counterWindow : 0), hero);
```

- [ ] **Step 4: Shatter, area blast and the multi-target batarang.** Make the second line of `landHit` (right after Plan 4E's tied check):

```js
    if (target.state === 'frozen') return shatter(target);
```

Add after Plan 4E's `breakTied`:

```js
  // Freeze blast: any hit on the ice knocks the goon out (enemy.applyHit does the same for hits
  // that don't come through landHit, like the dive-bomb shockwave).
  function shatter(target) {
    target.applyHit({ outcome: 'ko', damage: 0, stun: 0 }, hero.pos, { power: 1.2, launch: 2 });
    director.release(target.id);
    combo.hit();
    time.hitStop(0.12);
    follow.addShake(0.16);
    target.ch.headWorld(chest, -0.3);
    events.emit('impact', { pos: chest.clone(), move: 'shatter', outcome: 'ko', target, crit: true });
    events.emit('iceShatter', { target, pos: chest.clone() });
    events.emit('word', { text: 'KRSSSH!', pos: chest.clone(), big: true });
    events.emit('ko', { target });
    if (engaged().length === 0) { events.emit('lastHit', { target }); critical(target, { slow: 0.9, scale: 0.22 }); }
    return { outcome: 'ko', damage: 0, stun: 0 };
  }

  // Knocks down every goon in reach of `center` with `move` (explosive gel). Brutes shrug it off
  // unless stunned (resolveHit), the Joker is never touched, ice shatters. Returns how many went down.
  function areaBlast(center, radius, move, { power = 1.6, launch = 6, dy = 2.5 } = {}) {
    let n = 0;
    for (const e of enemies) {
      if (!e.alive || e.def.boss) continue;
      if (Math.hypot(e.pos.x - center.x, e.pos.z - center.z) > radius || Math.abs(e.pos.y - center.y) > dy) continue;
      if (e.state === 'frozen') { shatter(e); n += 1; continue; }
      if (e.down) continue;
      const r = landHit(move, e, { power, launch });
      if (r.outcome !== 'immune' && r.outcome !== 'parried') n += 1;
    }
    return n;
  }
```

Replace `function batarang(target, fx)` with a version that throws one batarang per target (WayneTech's Triple Batarang passes up to three):

```js
  function batarang(targets, fx) {
    let t = 0, thrown = 0;
    faceTo(targets[0]);
    hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
    const end = 0.35 + (targets.length - 1) * 0.05;
    return {
      name: 'batarang', combat: true,
      canChain: () => t > 0.25 + (targets.length - 1) * 0.05,
      update(dt) {
        t += dt;
        while (thrown < targets.length && t > 0.14 + thrown * 0.05) {
          const target = targets[thrown++];
          hero.bat.bone('hand_r').getWorldPosition(chest);
          if (thrown === 1) events.emit('batarangThrow', { count: targets.length });
          fx.batarang(chest.clone(), (out) => target.ch.headWorld(out, -0.25), () => {
            if (!target.alive) return;
            const r = landHit('batarang', target);
            if (target.state === 'windup' || target.state === 'attack') director.release(target.id);
            events.emit('batarangHit', { target, result: r });
          });
        }
        return t > end;
      },
    };
  }
```

- [ ] **Step 5: Route the fire key and lock input under the wheel.**
  - In `tryStart`, right after Plan 4E's chain check (`if (chain) return startChain(chain, ctx);`), add:

```js
    // The fire key uses whatever gadget is equipped (src/gadgets/gadgetSystem.js).
    if (action === 'batarang' && useGadget) return useGadget(ctx, { inAir: hero.state === 'air' || hero.state === 'glide' });
```

  - Change the old batarang branch (used only without a gadget system, as in tests) to `if (target) { hero.control = batarang([target], ctx.fx); return true; }`.
  - In `update`, change the buffer loop to `if (!ctx.lockInput) for (const a of ACTIONS) if (ctx.input.pressed(a)) inputBuffer.press(a);` and add `!ctx.lockInput &&` to the condition that calls `tryStart(buffer, ctx)`.

- [ ] **Step 6: Expose it.** Next to `consumeInput` in the returned object add:

```js
    // What gadgets land their hits through: the same bookkeeping as every other move.
    gadgetApi: { landHit, areaBlast, canSee, inputDir, alive, director, critical, batarang, faceTo },
    // Re-read the WayneTech effects after a purchase.
    applyEffects() { combo.setReady(effects.specialAt); combo.setShield(effects.comboShield); },
```

- [ ] **Step 7: Pool the batarangs** in `src/game/fx.js`. Replace the `rangs` array, the `batarang()` method and the batarang loop in `update()` with:

```js
  // Six batarangs, built once and reused (a Triple Batarang throws three at a time).
  const rangs = [];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(batGeo, batMat);
    m.visible = false;
    scene.add(m);
    rangs.push({ m, getTarget: null, onHit: null, t: 0, live: false, aim: new THREE.Vector3() });
  }
  const to = new THREE.Vector3();
```

```js
    // Throws a batarang from `from` at a moving target: getTarget(out) writes the aim point into
    // `out`. Calls onHit when it arrives. With all six in the air, the oldest lands early.
    batarang(from, getTarget, onHit) {
      let r = rangs.find((x) => !x.live);
      if (!r) { r = rangs[0]; r.onHit(); }
      r.m.position.copy(from);
      r.m.visible = true;
      r.getTarget = getTarget;
      r.onHit = onHit;
      r.t = 0;
      r.live = true;
    },
```

```js
      for (const r of rangs) {
        if (!r.live) continue;
        r.t += dt;
        r.getTarget(r.aim);
        to.copy(r.aim).sub(r.m.position);
        const d = to.length();
        const step = 38 * dt;
        r.m.rotation.y += dt * 30;
        if (d <= step || r.t > 1.5) {
          r.live = false;
          r.m.visible = false;
          if (d <= step + 0.5) r.onHit();
          continue;
        }
        r.m.position.addScaledVector(to, step / d);
      }
```

- [ ] **Step 8: The combo threshold on the HUD and in the hint.** In `src/ui/hud.js` change `setCombo(n)` to `setCombo(n, readyAt = 8)` and its `ready` line to `combo.classList.toggle('ready', n >= readyAt);`. In `src/game/game.js`, change the call to `hud.setCombo(lastCombo, combat.combo.readyAt);`, and the `special-locked` hint to:

```js
      'special-locked': () => `Special takedowns unlock at a ${combat.combo.readyAt} hit combo.`,
```

- [ ] **Step 9: Run the tests**

Run: `npx vitest run`
Expected: PASS, including `combatHooks.test.js` and every older combat test.

- [ ] **Step 10: Commit**

```bash
git add src/combat/combatSystem.js src/game/fx.js src/ui/hud.js src/game/game.js tests/unit/combatHooks.test.js
git commit -m "Combat hooks for WayneTech effects and gadgets; pooled batarangs"
```

---

### Task 9: Traversal tuning hooks and the launcher-ready zip control

**Files:**
- Modify: `src/actors/hero.js`, `src/actors/traverse/wallrun.js`, `src/actors/traverse/ladder.js`, `src/actors/traverse/divebomb.js`, `src/actors/traverse/zipline.js`
- Test: `tests/unit/traverseTuning.test.js` (new)

**Interfaces:**
- Consumes: `lineBetween` (Task 3), `line.sag` (Task 1).
- Produces: `hero.tuning` with defaults; `wallRunVy(t, dur)`; `createZipControl(h, { events }, { line, s, minSpeed, onEvent, offEvent })` returning `line`.

- [ ] **Step 1: Write the failing test.** Create `tests/unit/traverseTuning.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { wallRunVy } from '../../src/actors/traverse/wallrun.js';
import { createZipControl } from '../../src/actors/traverse/zipline.js';
import { lineBetween } from '../../src/gadgets/aim.js';

describe('wall run arc', () => {
  const rise = (dur, steps = 1200) => {
    let y = 0, peak = 0;
    const dt = dur / steps;
    for (let i = 0; i < steps; i++) { y += wallRunVy(i * dt, dur) * dt; peak = Math.max(peak, y); }
    return { y, peak };
  };
  it('matches the old 1.2 s arc', () => {
    for (const t of [0, 0.3, 0.6, 0.9, 1.2]) expect(Math.abs(wallRunVy(t, 1.2) - (4.6 - 7.7 * t))).toBeLessThan(0.05);
  });
  it('a longer run (Wall Grip Boots) keeps the same height and ends level', () => {
    const a = rise(1.2), b = rise(1.8);
    expect(b.peak).toBeCloseTo(a.peak, 1);
    expect(Math.abs(b.y)).toBeLessThan(0.05);
  });
});

describe('zip control options (line launcher)', () => {
  const vec = () => ({ x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } });
  const stubHero = () => ({
    pos: vec(), vel: vec(), grounded: true, setState() {},
    cape: { setWings() {} }, bat: { face() {}, tilt: { rotation: { set() {} } }, animator: { play() {} } },
  });
  it('rides a taut line at its minimum speed and uses its own events', () => {
    const seen = [];
    const h = stubHero();
    const line = lineBetween({ x: 0, y: 2.05, z: 0 }, { x: 0, y: 2.05, z: 30 });
    const z = createZipControl(h, { events: { emit: (n) => seen.push(n) } }, { line, minSpeed: 18, onEvent: 'launcherOn', offEvent: 'launcherOff' });
    expect(z.line).toBe(line);
    const ctx = { input: { pressed: () => false } };
    z.update(0.1, ctx);
    expect(z.speed).toBeGreaterThanOrEqual(18);
    expect(h.pos.y).toBeCloseTo(0);
    let done = false;
    for (let i = 0; i < 40 && !done; i++) done = z.update(0.1, ctx);
    expect(done).toBe(true);
    expect(seen).toEqual(['launcherOn', 'launcherOff']);
  });
  it('city ziplines still announce zipOn and zipOff', () => {
    const seen = [];
    const line = lineBetween({ x: 0, y: 12, z: 0 }, { x: 0, y: 8, z: 20 }, 0.03);
    const z = createZipControl(stubHero(), { events: { emit: (n) => seen.push(n) } }, { line });
    for (let i = 0; i < 60; i++) if (z.update(0.1, { input: { pressed: () => false } })) break;
    expect(seen).toEqual(['zipOn', 'zipOff']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/unit/traverseTuning.test.js`
Expected: FAIL.

- [ ] **Step 3: Hero.** In `src/actors/hero.js`:
  - Add to the `h` literal, after `lastClimbT: 99,`:

```js
    // Traversal numbers WayneTech upgrades (game.js points this at the live effects object).
    tuning: { boostUp: 15, boostOut: 9, diveGain: 1, glideMax: 48, wallRunTime: 1.2, ladderSlide: 9, diveRadius: 4 },
```

  - In the glide dive branch replace the `g.speed = Math.min(GLIDE_MAX, ...)` line with:

```js
        g.speed = Math.min(h.tuning.glideMax, g.speed + (GLIDE_G * 1.35 * h.tuning.diveGain * Math.sin(angle) - g.speed * 0.02) * dt);
```

  - In `grappleControl`'s boost, replace `vel.set(-n.x * 9, 15, -n.z * 9);` with `vel.set(-n.x * h.tuning.boostOut, h.tuning.boostUp, -n.z * h.tuning.boostOut);`.

- [ ] **Step 4: Wall run.** In `src/actors/traverse/wallrun.js` add above `createWallRunControl`:

```js
// Vertical speed along a wall run of `dur` seconds: up then down, peaking about 1.4 m above the
// start and ending level, whatever the length (Wall Grip Boots makes it 1.8 s).
export function wallRunVy(t, dur = DUR) {
  return ((4.6 * 1.2) / dur) * (1 - (2 * t) / dur);
}
```

Inside the control add `const dur = h.tuning?.wallRunTime ?? DUR;` after `let t = 0;`, replace `const vy = 4.6 - 7.7 * t;` with `const vy = wallRunVy(t, dur);`, and change `if (t > DUR || ...` to `if (t > dur || ...`. Update the file's header comment to say "for up to 1.2 s (1.8 s with Wall Grip Boots)".

- [ ] **Step 5: Ladder and dive bomb.** In `src/actors/traverse/ladder.js` change `const v = slide ? -SLIDE : input.move.y * CLIMB;` to `const v = slide ? -(h.tuning?.ladderSlide ?? SLIDE) : input.move.y * CLIMB;`. In `src/actors/traverse/divebomb.js` change `combat.shockwave(h.pos, 4);` to `combat.shockwave(h.pos, h.tuning?.diveRadius ?? 4);`.

- [ ] **Step 6: Zip control options.** In `src/actors/traverse/zipline.js`:
  - Change the signature to `export function createZipControl(h, { events }, { line, s = 0, minSpeed = 0, onEvent = 'zipOn', offEvent = 'zipOff' })`.
  - Replace `events.emit('zipOn');` with `events.emit(onEvent);` and, in `release`, `events.emit('zipOff');` with `events.emit(offEvent);`.
  - Change `speed = zipSpeed(line, speed, dt);` to `speed = Math.max(minSpeed, zipSpeed(line, speed, dt));`.
  - Add `line,` to the returned object after `camera: 'zip',`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS, including Plan 3B's traversal tests.

- [ ] **Step 8: Commit**

```bash
git add src/actors/hero.js src/actors/traverse/wallrun.js src/actors/traverse/ladder.js src/actors/traverse/divebomb.js src/actors/traverse/zipline.js tests/unit/traverseTuning.test.js
git commit -m "Traversal tuning hooks, wall run arc by length, zip control options"
```

---

### Task 10: Pooled gadget visuals and their warm-up

**Files:**
- Create: `src/gadgets/gadgetFx.js`
- Modify: `src/game/warmCast.js`, `src/game/game.js`

**Interfaces:**
- Consumes: `toonMaterial`, `LAYER_FX`, `PALETTE`.
- Produces: `GFX_LIMITS`, `gadgetMaterials()`, `createGadgetWarm()`, `createGadgetFx(scene)` (see Shared interfaces); `window.__game.gfx`.

- [ ] **Step 1: Write `src/gadgets/gadgetFx.js`**

```js
// Pooled gadget visuals: gel blobs, smoke puffs, ice blocks and ice grenades, confetti (and its
// sky lettering), the launcher and batclaw lines, the remote batarang's trail, and debris.
// Everything is built once per run and hidden; nothing is created or added to the scene after
// that, and the per-frame paths only write into preallocated arrays and scratch objects.
// gadgetMaterials() also builds the warm-up copies (createGadgetWarm, drawn at boot by
// warmCast.js), so every shader program here is compiled before play.
import * as THREE from 'three';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';

export const GFX_LIMITS = { gel: 3, puffs: 14, ice: 6, iceShots: 2, confetti: 900, trail: 32, debris: 40 };
const CONFETTI = [PALETTE.signal, PALETTE.balloon, PALETTE.detective, PALETTE.jokerGreen, PALETTE.jokerPurple, PALETTE.paper];
const UP = new THREE.Vector3(0, 1, 0);

let smokeTex = null;
function smokeTexture() {
  if (smokeTex) return smokeTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const blobs = [[64, 72, 32], [40, 64, 22], [88, 62, 24], [58, 44, 22], [80, 86, 20]];
  g.fillStyle = '#0b0b12';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r + 4, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#bdb9b0';
  for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  // Halftone shading on the lower half, only where there is cloud.
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = 'rgba(11,11,18,0.22)';
  for (let y = 60, row = 0; y < 128; y += 6, row++) {
    for (let x = row % 2 ? 3 : 6; x < 128; x += 6) { g.beginPath(); g.arc(x, y, 1.1 + (y - 60) / 60, 0, Math.PI * 2); g.fill(); }
  }
  smokeTex = new THREE.CanvasTexture(c);
  smokeTex.colorSpace = THREE.SRGBColorSpace;
  return smokeTex;
}

let tinyTex = null;
function tinyTexture() {
  if (!tinyTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 4;
    tinyTex = new THREE.CanvasTexture(c);
    tinyTex.colorSpace = THREE.SRGBColorSpace;
  }
  return tinyTex;
}

export function gadgetMaterials() {
  const ice = toonMaterial({ color: 0xcdefff, emissive: 0x24506e });
  ice.transparent = true;
  ice.opacity = 0.72;
  ice.depthWrite = false;
  return {
    gel: toonMaterial({ color: 0x9fe3ff, emissive: 0x1d5f80 }),
    ice,
    smoke: new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, depthWrite: false }),
    confetti: new THREE.PointsMaterial({ size: 0.42, vertexColors: true, sizeAttenuation: true }),
    line: new THREE.LineBasicMaterial({ color: PALETTE.ink }),
    trail: new THREE.LineBasicMaterial({ color: PALETTE.signal }),
    debris: toonMaterial({ color: 0xffffff }),
    // Breakables (src/world/breakables.js) use textured toon materials: one warm copy each of the
    // plain and the instanced variant.
    textured: toonMaterial({ color: 0xffffff, map: tinyTexture(), emissive: 0x111111 }),
  };
}

let GEO = null;
function geos() {
  if (!GEO) GEO = {
    gel: new THREE.SphereGeometry(0.34, 12, 8).scale(1, 0.4, 1),
    ice: new THREE.IcosahedronGeometry(0.72, 1).scale(1, 1.5, 1).translate(0, 0.95, 0),
    shot: new THREE.IcosahedronGeometry(0.16, 0),
    debris: new THREE.BoxGeometry(0.32, 0.22, 0.28),
    box: new THREE.BoxGeometry(1, 1, 1),
  };
  return GEO;
}

function lineOf(n, mat) {
  const g = new THREE.BufferGeometry();
  const a = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('position', a);
  const l = new THREE.Line(g, mat);
  l.layers.set(LAYER_FX);
  l.frustumCulled = false;
  return l;
}

// One of everything, for the boot warm cast.
export function createGadgetWarm() {
  const m = gadgetMaterials(), g = geos();
  const group = new THREE.Group();
  group.name = 'gadgetWarm';
  group.position.y = -50;
  const puff = new THREE.Sprite(m.smoke);
  puff.layers.set(LAYER_FX);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9).fill(1), 3));
  const confetti = new THREE.Points(pg, m.confetti);
  confetti.layers.set(LAYER_FX);
  const debris = new THREE.InstancedMesh(g.debris, m.debris, 1);
  debris.setColorAt(0, new THREE.Color(1, 1, 1));
  const texturedInst = new THREE.InstancedMesh(g.box, m.textured, 1);
  group.add(
    new THREE.Mesh(g.gel, m.gel), new THREE.Mesh(g.ice, m.ice), new THREE.Mesh(g.shot, m.ice), puff, confetti,
    lineOf(2, m.line), lineOf(GFX_LIMITS.trail, m.trail), debris, new THREE.Mesh(g.box, m.textured), texturedInst,
  );
  return group;
}

export function createGadgetFx(scene) {
  const m = gadgetMaterials(), g = geos();
  const tmp = new THREE.Vector3(), to = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const m4 = new THREE.Matrix4(), eul = new THREE.Euler(), col = new THREE.Color();

  // ---- debris (instanced chunks: wall bricks, glass, ice) ----
  const D = GFX_LIMITS.debris;
  const dmesh = new THREE.InstancedMesh(g.debris, m.debris, D);
  dmesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dmesh.frustumCulled = false;
  const dp = new Float32Array(D * 3), dv = new Float32Array(D * 3), dr = new Float32Array(D * 3), dl = new Float32Array(D), df = new Float32Array(D);
  let dnext = 0, dlive = 0;
  m4.compose(tmp.set(0, -1000, 0), q.identity(), sc.set(0, 0, 0));
  for (let i = 0; i < D; i++) { dmesh.setMatrixAt(i, m4); dmesh.setColorAt(i, col.set(0xffffff)); }
  scene.add(dmesh);
  const debris = {
    burst(center, color, count, speed, floorY = center.y - 1.2) {
      col.setHex(color);
      for (let k = 0; k < count; k++) {
        const i = dnext;
        dnext = (dnext + 1) % D;
        if (dl[i] <= 0) dlive += 1;
        const j = i * 3;
        dp[j] = center.x; dp[j + 1] = center.y; dp[j + 2] = center.z;
        const a = Math.random() * Math.PI * 2, out = speed * (0.4 + Math.random() * 0.8);
        dv[j] = Math.cos(a) * out; dv[j + 1] = speed * (0.3 + Math.random() * 0.8); dv[j + 2] = Math.sin(a) * out;
        dr[j] = Math.random() * 6; dr[j + 1] = Math.random() * 6; dr[j + 2] = Math.random() * 6;
        dl[i] = 1.4 + Math.random() * 0.6;
        df[i] = floorY;
        dmesh.setColorAt(i, col);
      }
      dmesh.instanceColor.needsUpdate = true;
    },
  };
  function updateDebris(dt) {
    if (!dlive) return;
    for (let i = 0; i < D; i++) {
      if (dl[i] <= 0) continue;
      const j = i * 3;
      dl[i] -= dt;
      dv[j + 1] -= 20 * dt;
      dp[j] += dv[j] * dt; dp[j + 1] += dv[j + 1] * dt; dp[j + 2] += dv[j + 2] * dt;
      if (dp[j + 1] < df[i]) { dp[j + 1] = df[i]; dv[j] *= 0.3; dv[j + 2] *= 0.3; dv[j + 1] = Math.abs(dv[j + 1]) * 0.2; }
      if (dl[i] <= 0) { dlive -= 1; tmp.set(0, -1000, 0); q.identity(); sc.set(0, 0, 0); }
      else {
        eul.set(dr[j] * dl[i], dr[j + 1] * dl[i], dr[j + 2] * dl[i]);
        q.setFromEuler(eul);
        tmp.set(dp[j], dp[j + 1], dp[j + 2]);
        sc.setScalar(Math.min(1, dl[i] * 2));
      }
      m4.compose(tmp, q, sc);
      dmesh.setMatrixAt(i, m4);
    }
    dmesh.instanceMatrix.needsUpdate = true;
  }

  // ---- gel blobs ----
  const gels = [];
  for (let i = 0; i < GFX_LIMITS.gel; i++) {
    const mesh = new THREE.Mesh(g.gel, m.gel);
    mesh.visible = false;
    scene.add(mesh);
    gels.push({ mesh, t: 0, live: false });
  }
  const gel = {
    place(spot) {
      const i = gels.findIndex((b) => !b.live);
      if (i < 0) return -1;
      const b = gels[i];
      b.mesh.quaternion.setFromUnitVectors(UP, tmp.set(spot.nx, spot.ny, spot.nz));
      b.mesh.position.set(spot.x + spot.nx * 0.03, spot.y + spot.ny * 0.03, spot.z + spot.nz * 0.03);
      b.mesh.visible = true;
      b.live = true;
      b.t = 0;
      return i;
    },
    clear(i) { const b = gels[i]; if (b) { b.live = false; b.mesh.visible = false; } },
    clearAll() { for (let i = 0; i < gels.length; i++) gel.clear(i); },
  };

  // ---- smoke ----
  const puffs = [];
  for (let i = 0; i < GFX_LIMITS.puffs; i++) {
    const sp = new THREE.Sprite(m.smoke.clone());
    sp.layers.set(LAYER_FX);
    sp.visible = false;
    scene.add(sp);
    puffs.push({ sp, ox: 0, oy: 0, oz: 0, size: 1, t: 0, life: 0, spin: 0 });
  }
  const smokeAt = new THREE.Vector3();
  const smoke = {
    burst(center, radius, life = 6) {
      smokeAt.copy(center);
      puffs.forEach((p, i) => {
        const a = (i / puffs.length) * Math.PI * 2 + Math.random() * 0.4;
        const d = i === 0 ? 0 : radius * (0.35 + Math.random() * 0.55);
        p.ox = Math.cos(a) * d; p.oz = Math.sin(a) * d; p.oy = 0.6 + Math.random() * 1.8;
        p.size = radius * (0.9 + Math.random() * 0.5);
        p.t = 0;
        p.life = life * (0.8 + Math.random() * 0.3);
        p.spin = (Math.random() - 0.5) * 0.6;
        p.sp.material.rotation = Math.random() * Math.PI;
        p.sp.material.opacity = 1;
        p.sp.visible = true;
      });
    },
  };
  function updateSmoke(dt) {
    for (const p of puffs) {
      if (!p.sp.visible) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.sp.visible = false; continue; }
      const grow = Math.min(1, p.t / 0.45);
      p.sp.scale.setScalar(p.size * (0.35 + 0.65 * grow) * (1 + k * 0.25));
      p.sp.position.set(smokeAt.x + p.ox, smokeAt.y + p.oy + k * 0.8, smokeAt.z + p.oz);
      p.sp.material.rotation += p.spin * dt;
      p.sp.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
    }
  }

  // ---- ice blocks and ice grenades ----
  const ices = [];
  for (let i = 0; i < GFX_LIMITS.ice; i++) {
    const mesh = new THREE.Mesh(g.ice, m.ice);
    mesh.visible = false;
    scene.add(mesh);
    ices.push({ mesh, enemy: null, t: 0 });
  }
  const shots = [];
  for (let i = 0; i < GFX_LIMITS.iceShots; i++) {
    const mesh = new THREE.Mesh(g.shot, m.ice);
    mesh.visible = false;
    scene.add(mesh);
    shots.push({ mesh, live: false, getTarget: null, onHit: null, aim: new THREE.Vector3(), t: 0 });
  }
  const ice = {
    attach(enemy) {
      const i = ices.findIndex((c) => !c.enemy);
      if (i < 0) return -1;
      const c = ices[i];
      c.enemy = enemy;
      c.t = 0;
      c.mesh.position.copy(enemy.pos);
      c.mesh.rotation.y = Math.random() * Math.PI;
      c.mesh.visible = true;
      return i;
    },
    release(i, shatter) {
      const c = ices[i];
      if (!c?.enemy) return;
      if (shatter) debris.burst(tmp.copy(c.mesh.position).setY(c.mesh.position.y + 1), 0xcdefff, 14, 6, c.mesh.position.y);
      c.enemy = null;
      c.mesh.visible = false;
    },
    // An ice grenade flying at a moving target: getTarget(out) writes the aim point.
    throw(from, getTarget, onHit) {
      let s = shots.find((x) => !x.live);
      if (!s) { s = shots[0]; s.onHit(); }
      s.mesh.position.copy(from);
      s.mesh.visible = true;
      s.getTarget = getTarget;
      s.onHit = onHit;
      s.live = true;
      s.t = 0;
    },
  };
  function updateIce(dt) {
    for (const c of ices) {
      if (!c.enemy) continue;
      c.t += dt;
      c.mesh.position.copy(c.enemy.pos);
      c.mesh.scale.setScalar((c.enemy.scale ?? 1) * (0.6 + 0.4 * Math.min(1, c.t / 0.12)));
    }
    for (const s of shots) {
      if (!s.live) continue;
      s.t += dt;
      s.getTarget(s.aim);
      to.copy(s.aim).sub(s.mesh.position);
      const d = to.length(), step = 32 * dt;
      s.mesh.rotation.x += dt * 12;
      if (d <= step || s.t > 1.5) {
        s.live = false;
        s.mesh.visible = false;
        if (d <= step + 0.5) s.onHit();
        continue;
      }
      s.mesh.position.addScaledVector(to, step / d);
    }
  }

  // ---- confetti: one Points cloud. Each particle is parked (mode 0), flying (1), homing to a
  // letter cell (2), holding the letter (3) or fluttering down (4). ----
  const N = GFX_LIMITS.confetti;
  const cpos = new Float32Array(N * 3), ccol = new Float32Array(N * 3), cvel = new Float32Array(N * 3), cgoal = new Float32Array(N * 3);
  const cmode = new Uint8Array(N), clife = new Float32Array(N);
  for (let i = 0; i < N; i++) cpos[i * 3 + 1] = -1000;
  const cgeo = new THREE.BufferGeometry();
  const cposAttr = new THREE.BufferAttribute(cpos, 3).setUsage(THREE.DynamicDrawUsage);
  const ccolAttr = new THREE.BufferAttribute(ccol, 3).setUsage(THREE.DynamicDrawUsage);
  cgeo.setAttribute('position', cposAttr);
  cgeo.setAttribute('color', ccolAttr);
  const points = new THREE.Points(cgeo, m.confetti);
  points.layers.set(LAYER_FX);
  points.frustumCulled = false;
  scene.add(points);
  let cnext = 0, clive = 0;
  const take = () => { const i = cnext; cnext = (cnext + 1) % N; if (!cmode[i]) clive += 1; return i; };
  const paint = (i) => {
    col.setHex(CONFETTI[(Math.random() * CONFETTI.length) | 0]);
    ccol[i * 3] = col.r; ccol[i * 3 + 1] = col.g; ccol[i * 3 + 2] = col.b;
  };
  const confetti = {
    burst(center, count) {
      for (let k = 0; k < count; k++) {
        const i = take(), j = i * 3;
        cpos[j] = center.x; cpos[j + 1] = center.y + 0.5; cpos[j + 2] = center.z;
        const a = Math.random() * Math.PI * 2, out = 2 + Math.random() * 6;
        cvel[j] = Math.cos(a) * out; cvel[j + 1] = 5 + Math.random() * 7; cvel[j + 2] = Math.sin(a) * out;
        cmode[i] = 1;
        clife[i] = 2.5 + Math.random() * 1.5;
        paint(i);
      }
      ccolAttr.needsUpdate = true;
    },
    // Confetti flies from `from` to spell `pts` (skyLetters.js) on an upright plane through
    // `anchor`, running along the horizontal unit vector `right`; holds 5 s, then flutters down.
    letters(from, anchor, right, pts) {
      for (const p of pts) {
        const i = take(), j = i * 3;
        cpos[j] = from.x + Math.random() - 0.5; cpos[j + 1] = from.y + 0.5; cpos[j + 2] = from.z + Math.random() - 0.5;
        cgoal[j] = anchor.x + right.x * p.x; cgoal[j + 1] = anchor.y + p.y; cgoal[j + 2] = anchor.z + right.z * p.x;
        cmode[i] = 2;
        clife[i] = 1.1 + Math.random() * 0.5;
        paint(i);
      }
      ccolAttr.needsUpdate = true;
    },
    get live() { return clive; },
  };
  function updateConfetti(dt) {
    if (!clive) return;
    const damp = Math.max(0, 1 - dt * 1.6), home = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < N; i++) {
      const md = cmode[i];
      if (!md) continue;
      const j = i * 3;
      clife[i] -= dt;
      if (md === 1 || md === 4) {
        cvel[j + 1] -= (md === 1 ? 9 : 2) * dt;
        if (md === 4) cvel[j + 1] = Math.max(cvel[j + 1], -2.2);
        cvel[j] *= damp; cvel[j + 2] *= damp;
        cpos[j] += cvel[j] * dt + (md === 4 ? Math.sin(clife[i] * 6 + i) * 0.6 * dt : 0);
        cpos[j + 1] += cvel[j + 1] * dt;
        cpos[j + 2] += cvel[j + 2] * dt;
        if (clife[i] <= 0) { cmode[i] = 0; cpos[j + 1] = -1000; clive -= 1; }
      } else if (md === 2) {
        cpos[j] += (cgoal[j] - cpos[j]) * home; cpos[j + 1] += (cgoal[j + 1] - cpos[j + 1]) * home; cpos[j + 2] += (cgoal[j + 2] - cpos[j + 2]) * home;
        if (clife[i] <= 0) { cmode[i] = 3; clife[i] = 5; cpos[j] = cgoal[j]; cpos[j + 1] = cgoal[j + 1]; cpos[j + 2] = cgoal[j + 2]; }
      } else if (md === 3) {
        cpos[j + 1] = cgoal[j + 1] + Math.sin(clife[i] * 3 + i) * 0.04;
        if (clife[i] <= 0) {
          cmode[i] = 4;
          clife[i] = 3 + Math.random();
          cvel[j] = (Math.random() - 0.5) * 0.6; cvel[j + 1] = -0.5; cvel[j + 2] = (Math.random() - 0.5) * 0.6;
        }
      }
    }
    cposAttr.needsUpdate = true;
  }

  // ---- lines (launcher, batclaw) and the remote batarang trail ----
  const lineObjs = { launcher: lineOf(2, m.line), claw: lineOf(2, m.line) };
  for (const l of Object.values(lineObjs)) { l.visible = false; scene.add(l); }
  const lines = {
    set(name, a, b) {
      const l = lineObjs[name], p = l.geometry.attributes.position;
      p.setXYZ(0, a.x, a.y, a.z);
      p.setXYZ(1, b.x, b.y, b.z);
      p.needsUpdate = true;
      l.visible = true;
    },
    hide(name) { lineObjs[name].visible = false; },
  };
  const T = GFX_LIMITS.trail;
  const trailLine = lineOf(T, m.trail);
  trailLine.visible = false;
  scene.add(trailLine);
  const ring = new Float32Array(T * 3);
  let head = 0;
  function writeTrail() {
    const a = trailLine.geometry.attributes.position;
    for (let k = 0; k < T; k++) {
      const i = (((head - k) % T) + T) % T;
      a.array[k * 3] = ring[i * 3]; a.array[k * 3 + 1] = ring[i * 3 + 1]; a.array[k * 3 + 2] = ring[i * 3 + 2];
    }
    a.needsUpdate = true;
  }
  const trail = {
    start(p) {
      for (let i = 0; i < T; i++) { ring[i * 3] = p.x; ring[i * 3 + 1] = p.y; ring[i * 3 + 2] = p.z; }
      head = 0;
      trailLine.visible = true;
      writeTrail();
    },
    push(p) {
      head = (head + 1) % T;
      ring[head * 3] = p.x; ring[head * 3 + 1] = p.y; ring[head * 3 + 2] = p.z;
      writeTrail();
    },
    stop() { trailLine.visible = false; },
  };

  return {
    gel, smoke, ice, confetti, lines, trail, debris,
    update(dt) {
      for (const b of gels) if (b.live) { b.t += dt; const k = 1 + Math.sin(b.t * 6) * 0.06; b.mesh.scale.set(k, 1, k); }
      updateSmoke(dt);
      updateIce(dt);
      updateConfetti(dt);
      updateDebris(dt);
    },
  };
}
```

- [ ] **Step 2: Warm it.** In `src/game/warmCast.js`, import `import { createGadgetWarm } from '../gadgets/gadgetFx.js';` and add before `return group;`:

```js
  // Every gadget material and geometry (gel, ice, smoke, confetti, lines, debris, textured
  // breakables): drawn once here so no gadget compiles a shader on first use.
  group.add(createGadgetWarm());
```

Also extend the file's header comment: "...every goon look, the Joker, and one of every gadget visual."

- [ ] **Step 3: Wire it in `src/game/game.js`.**
  - Import `import { createGadgetFx } from '../gadgets/gadgetFx.js';`
  - In `buildRun`, right after `const fx = createFx(scene);`: `const gfx = createGadgetFx(scene);`
  - In `update`, right after `fx.update(dt);`: `gfx.update(dt);`
  - Add `gfx` to the `api` object.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS (nothing unit-tests the three.js pools; this checks nothing else broke).

- [ ] **Step 5: Look at every visual.** Build and preview, then:

```bash
cat > "$TEMP/g5-t10.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gfx ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, F = G.gfx; F.gel.place({ x: h.x + 1, y: h.y, z: h.z + 3, nx: 0, ny: 1, nz: 0 }); F.gel.place({ x: h.x - 1, y: h.y, z: h.z + 3, nx: 0, ny: 1, nz: 0 }); F.smoke.burst({ x: h.x + 4, y: h.y, z: h.z + 8 }, 2.5, 6); F.ice.attach(G.enemies[0]); F.lines.set('launcher', { x: h.x, y: h.y + 1.5, z: h.z }, { x: h.x + 6, y: h.y + 1.5, z: h.z + 12 }); F.trail.start({ x: h.x, y: h.y + 1, z: h.z }); for (let i = 1; i < 20; i++) F.trail.push({ x: h.x + i * 0.3, y: h.y + 1 + Math.sin(i) * 0.3, z: h.z + i * 0.5 }); F.debris.burst({ x: h.x - 3, y: h.y + 1.5, z: h.z + 5 }, 0x8a5a44, 20, 7, h.y); F.confetti.burst({ x: h.x, y: h.y, z: h.z + 6 }, 300); 'placed'", "wait": 700},
 {"shot": "t10-gadget-fx"},
 {"eval": "window.__game.gfx.confetti.live"},
 {"wait": 4500},
 {"eval": "window.__game.gfx.confetti.live"},
 {"eval": "window.__game.renderer.info.render.calls"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1" "$TEMP/g5" "$(cat "$TEMP/g5-t10.json")"
```

Expected: `t10-gadget-fx.png` shows two flat pale-blue gel blobs, an inked grey smoke cloud with halftone dots, a translucent ice block around the first goon, a black line, a yellow trail, flying brick chunks and a confetti burst; the first `live` count is 300, the second 0; `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/gadgets/gadgetFx.js src/game/warmCast.js src/game/game.js
git commit -m "Pooled gadget visuals: gel, smoke, ice, confetti, lines, trail, debris; warmed at boot"
```

---

### Task 11: Breakables in the city, their caches, and the placement check

**Files:**
- Create: `src/world/breakables.js`, `scripts/breakables-check.mjs`
- Modify: `src/game/game.js`

**Interfaces:**
- Consumes: everything in `breakableSpots.js` (Task 4), `collision.removeBox` (Task 1), `gfx.debris` (Task 10), `progress.gadgets` (Task 2), `world.climbables`, `SITES`, `batSvgPath`.
- Produces: `createBreakables(...)` (see Shared interfaces); events `wallBroken`, `glassBroken`, `ventOpen`, `railingDown`, `cacheFound`; `window.__game.breakables`.

- [ ] **Step 1: Write `src/world/breakables.js`**

```js
// Gadget breakables in the city (src/world/breakableSpots.js): cracked walls (explosive gel),
// glass signs (remote batarang), vent covers and weak railings (batclaw), and the WayneTech
// caches behind them. Built once per run. The solid parts of every shed merge into one mesh;
// each breakable part is its own mesh with its own collision box, taken out of the world when
// it breaks. Broken parts and found caches are saved in progress.gadgets.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { PALETTE } from '../config/palette.js';
import { batSvgPath } from '../config/batShape.js';
import { BREAKABLES, CACHES, FACES, roomWalls, cageRoom, nearestLadder, roofEdgeRail, boxDistance } from './breakableSpots.js';

const COLORS = { weakWall: 0x8a5a44, glass: 0x9fd8e8, vent: 0x8a8f98, railing: 0x6d737c };
const WORD = { weakWall: 'KA-CHUNK!', glass: 'KSSSSH!', vent: 'KLANG!', railing: 'SKREEK!' };
const EVENT = { weakWall: 'wallBroken', glass: 'glassBroken', vent: 'ventOpen', railing: 'railingDown' };

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function bricks(g, w, h, cracked) {
  g.fillStyle = '#6b3f33';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#0b0b12';
  g.lineWidth = 3;
  for (let y = 0, row = 0; y < h; y += 32, row++) {
    g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
    for (let x = row % 2 ? 32 : 0; x < w; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); }
  }
  if (!cracked) return;
  // Cracks from the middle and a yellow chalk ring: the mark for "gel works here".
  g.lineWidth = 5;
  const cx = w / 2, cy = h / 2;
  for (let i = 0; i < 9; i++) {
    let x = cx, y = cy;
    const a = (i / 9) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { const b = a + (k % 2 ? 0.35 : -0.35); x += Math.cos(b) * 26; y += Math.sin(b) * 26; g.lineTo(x, y); }
    g.stroke();
  }
  g.strokeStyle = '#f2d24b';
  g.lineWidth = 7;
  g.beginPath(); g.arc(cx, cy, w * 0.36, 0, Math.PI * 2); g.stroke();
}
function signTex(g, w, h) {
  g.fillStyle = '#bfe6ef';
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath(); g.moveTo(40, 0); g.lineTo(90, 0); g.lineTo(30, h); g.lineTo(-20, h); g.fill();
  g.font = "84px Bangers, Impact, sans-serif";
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeText("JOKER'S PARTY!", w / 2, h / 2 + 4);
  g.fillStyle = '#6c3fa3';
  g.fillText("JOKER'S PARTY!", w / 2, h / 2 + 4);
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
}
function grilleTex(g, w, h) {
  g.fillStyle = '#8a8f98';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#0b0b12';
  for (let y = 12; y < h - 8; y += 20) g.fillRect(10, y, w - 20, 8);
  g.lineWidth = 8;
  g.strokeStyle = '#0b0b12';
  g.strokeRect(4, 4, w - 8, h - 8);
}
function cacheTex(g, w, h) {
  g.fillStyle = '#1d2230';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f2d24b';
  g.fill(new Path2D(batSvgPath(0.9, w / 2, h / 2)));
  g.lineWidth = 8;
  g.strokeStyle = '#f2d24b';
  g.strokeRect(6, 6, w - 12, h - 12);
}

const boxGeo = (b) => new THREE.BoxGeometry(b.maxX - b.minX, b.maxY - b.minY, b.maxZ - b.minZ)
  .translate((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2, (b.minZ + b.maxZ) / 2);

export function createBreakables({ scene, collision, climbables, progress, save, events, gfx }) {
  const mats = {
    shed: toonMaterial({ color: 0xffffff, map: canvasTex(256, 256, (g, w, h) => bricks(g, w, h, false)) }),
    weakWall: toonMaterial({ color: 0xffffff, map: canvasTex(256, 256, (g, w, h) => bricks(g, w, h, true)) }),
    glass: toonMaterial({ color: 0xffffff, map: canvasTex(512, 128, signTex), emissive: 0x16323a }),
    vent: toonMaterial({ color: 0xffffff, map: canvasTex(128, 128, grilleTex) }),
    railing: toonMaterial({ color: PALETTE.slate }),
    cache: toonMaterial({ color: 0xffffff, map: canvasTex(128, 128, cacheTex), emissive: 0x3a3000 }),
  };
  const broken = new Set(progress.gadgets.broken);
  const solid = [], wires = [], items = [], byBox = new Map(), problems = [];

  function addPart(spot, box, mat, extra = {}) {
    const mesh = new THREE.Mesh(boxGeo(box), mat);
    mesh.receiveShadow = true;
    const item = {
      id: spot.id, kind: spot.kind, spot, bounds: box, box: null, mesh, broken: broken.has(spot.id),
      center: new THREE.Vector3((box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2, (box.minZ + box.maxZ) / 2),
      normal: extra.normal ?? { nx: 0, nz: 0 }, cachePos: extra.cachePos ?? null, room: extra.room ?? null,
    };
    mesh.visible = !item.broken;
    scene.add(mesh);
    if (!item.broken) {
      item.box = collision.addBox(box.minX, box.minY, box.minZ, box.maxX, box.maxY, box.maxZ, 'breakable');
      byBox.set(item.box, item);
    }
    items.push(item);
  }
  function addSolid(b) {
    solid.push(boxGeo(b));
    collision.addBox(b.minX, b.minY, b.minZ, b.maxX, b.maxY, b.maxZ, 'shed');
  }

  for (const spot of BREAKABLES) {
    if (spot.kind === 'weakWall' || spot.kind === 'vent') {
      let room = spot.room;
      if (spot.ladderNear) {
        const l = nearestLadder(climbables.ladders, spot.ladderNear.x, spot.ladderNear.z);
        if (!l) { problems.push({ id: spot.id, problem: 'no street-level ladder within 12 m' }); continue; }
        room = cageRoom(l);
      }
      const walls = roomWalls(room, spot.kind === 'vent' ? 0.12 : 0.3);
      for (const b of walls.solid) addSolid(b);
      if (walls.roof) addSolid(walls.roof);
      addPart(spot, walls.weak, spot.kind === 'vent' ? mats.vent : mats.weakWall, {
        normal: FACES[room.open], cachePos: { x: room.x, y: room.y, z: room.z }, room,
      });
    } else if (spot.kind === 'glass') {
      const b = spot.box;
      const box = { minX: b.x - b.w / 2, maxX: b.x + b.w / 2, minY: b.y, maxY: b.y + b.h, minZ: b.z - b.d / 2, maxZ: b.z + b.d / 2 };
      // Strung on wires that run 7 m past each end and up 1.5 m, like a banner across the street.
      const alongX = b.w >= b.d, half = (alongX ? b.w : b.d) / 2, top = b.y + b.h;
      for (const s of [-1, 1]) {
        const ex = alongX ? b.x + s * half : b.x, ez = alongX ? b.z : b.z + s * half;
        wires.push(ex, top, ez, alongX ? ex + s * 7 : ex, top + 1.5, alongX ? ez : ez + s * 7);
      }
      addPart(spot, box, mats.glass);
    } else if (spot.kind === 'railing') {
      const { x, y, z } = spot.site;
      const roof = collision.query(x - 0.2, z - 0.2, x + 0.2, z + 0.2)
        .filter((o) => Math.abs(o.maxY - y) < 0.4 && o.tag !== 'bound')
        .sort((a, b) => (b.maxX - b.minX) * (b.maxZ - b.minZ) - (a.maxX - a.minX) * (a.maxZ - a.minZ))[0];
      if (!roof) { problems.push({ id: spot.id, problem: `no roof at y ${y}` }); continue; }
      const rail = roofEdgeRail(roof, x, z, spot.len);
      addPart(spot, rail, mats.railing, { normal: { nx: rail.nx, nz: rail.nz } });
    }
  }
  if (solid.length) {
    const sheds = new THREE.Mesh(mergeGeometries(solid), mats.shed);
    sheds.receiveShadow = true;
    sheds.castShadow = true;
    scene.add(sheds);
    for (const g of solid) g.dispose();
  }
  if (wires.length) {
    const wg = new THREE.BufferGeometry();
    wg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(wires), 3));
    const w = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: PALETTE.ink }));
    w.layers.set(LAYER_FX);
    scene.add(w);
  }

  // Caches: one instanced mesh, each crate hidden (scale 0) until its wall or vent is open.
  const cacheGeo = new THREE.BoxGeometry(0.7, 0.5, 0.7).translate(0, 0.25, 0);
  const cacheMesh = new THREE.InstancedMesh(cacheGeo, mats.cache, CACHES.length);
  cacheMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const caches = CACHES.map((c, index) => {
    const owner = items.find((it) => it.spot.hides?.id === c.id) ?? null;
    return {
      id: c.id, xp: c.xp, index, owner, taken: progress.gadgets.caches.includes(c.id),
      pos: owner?.cachePos ? new THREE.Vector3(owner.cachePos.x, owner.cachePos.y, owner.cachePos.z) : null,
    };
  });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  function writeCache(c, t) {
    const show = c.pos && !c.taken;
    q.setFromAxisAngle(up, show ? t * 1.5 + c.index : 0);
    pos.copy(c.pos ?? up).setY(show ? c.pos.y + 0.1 + Math.sin(t * 2 + c.index) * 0.08 : -1000);
    sc.setScalar(show ? 1 : 0);
    cacheMesh.setMatrixAt(c.index, m4.compose(pos, q, sc));
  }
  for (const c of caches) writeCache(c, 0);
  scene.add(cacheMesh);

  function smash(item, from) {
    if (!item || item.broken) return false;
    item.broken = true;
    if (item.box) { collision.removeBox(item.box); byBox.delete(item.box); item.box = null; }
    item.mesh.visible = false;
    const floor = collision.groundBelow(item.center.x, item.center.y, item.center.z, 0.3);
    gfx.debris.burst(item.center, COLORS[item.kind], item.kind === 'glass' ? 16 : 22, item.kind === 'glass' ? 5 : 7, floor > -Infinity ? floor : item.center.y - 1.2);
    if (!progress.gadgets.broken.includes(item.id)) progress.gadgets.broken.push(item.id);
    save();
    events.emit(EVENT[item.kind], { id: item.id, pos: item.center.clone(), item, from });
    events.emit('word', { text: WORD[item.kind], pos: item.center.clone(), big: item.kind === 'weakWall' });
    return true;
  }

  return {
    items,
    caches,
    smash,
    // Calls fn(item) for every unbroken breakable of `kind` within r of pos (no allocation).
    forNear(p, r, kind, fn) {
      for (const it of items) if (!it.broken && it.kind === kind && boxDistance(it.bounds, p) <= r) fn(it);
    },
    // The breakable the ray hits first, if it is one of `kinds` and nothing solid is in front.
    aimed(eye, dir, range, kinds) {
      const hit = collision.raycast(eye, dir, range);
      const it = hit ? byBox.get(hit.box) : null;
      return it && kinds.includes(it.kind) ? it : null;
    },
    update(t, heroPos) {
      let dirty = false;
      for (const c of caches) {
        if (c.taken || !c.pos || !c.owner?.broken) continue;
        writeCache(c, t);
        dirty = true;
        if (Math.hypot(heroPos.x - c.pos.x, heroPos.z - c.pos.z) < 1.4 && Math.abs(heroPos.y - c.pos.y) < 1.5) {
          c.taken = true;
          writeCache(c, t);
          if (!progress.gadgets.caches.includes(c.id)) progress.gadgets.caches.push(c.id);
          save();
          events.emit('cacheFound', { id: c.id, xp: c.xp, pos: c.pos.clone() });
        }
      }
      if (dirty) cacheMesh.instanceMatrix.needsUpdate = true;
    },
    // Placement report for scripts/breakables-check.mjs. `sites` is a list of { name, x, y, z }.
    check(sites = []) {
      const out = problems.map((p) => ({ id: p.id, ok: false, problems: [p.problem] }));
      const ours = new Set(['shed', 'breakable']);
      for (const it of items) {
        const list = [];
        const b = it.room ? { minX: it.room.x - it.room.w / 2, maxX: it.room.x + it.room.w / 2, minZ: it.room.z - it.room.d / 2, maxZ: it.room.z + it.room.d / 2, minY: it.room.y, maxY: it.room.y + it.room.h } : it.bounds;
        for (const o of collision.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
          if (ours.has(o.tag) || o.tag === 'bound' || o.removed) continue;
          const inside = o.minX < b.maxX - 0.05 && o.maxX > b.minX + 0.05 && o.minZ < b.maxZ - 0.05 && o.maxZ > b.minZ + 0.05 && o.minY < b.maxY - 0.05 && o.maxY > b.minY + 0.05;
          if (inside) list.push(`overlaps a ${o.tag || 'box'} (${o.minX.toFixed(1)}..${o.maxX.toFixed(1)}, ${o.minZ.toFixed(1)}..${o.maxZ.toFixed(1)}, top ${o.maxY.toFixed(1)})`);
        }
        const cx = (b.minX + b.maxX) / 2, cz = (b.minZ + b.maxZ) / 2;
        const ground = collision.groundBelow(cx, b.minY + 0.3, cz, 0.3);
        if (it.room && Math.abs(ground - b.minY) > 0.3) list.push(`floor is at ${ground.toFixed(2)}, room at ${b.minY}`);
        if (it.kind === 'glass' && b.minY - collision.groundBelow(cx, b.minY - 0.1, cz, 0.3) < 3.5) list.push('less than 3.5 m of clearance under the sign');
        if (it.kind === 'railing') {
          const ox = cx + it.normal.nx * 1.2, oz = cz + it.normal.nz * 1.2;
          if (b.minY - collision.groundBelow(ox, b.minY + 0.5, oz, 0.2) < 4) list.push('no 4 m drop behind the railing');
        }
        if (it.room && it.kind === 'weakWall') {
          for (const s of sites) if (Math.hypot(s.x - cx, s.z - cz) < 6 && Math.abs(s.y - b.minY) < 3) list.push(`within 6 m of site ${s.name}`);
        }
        out.push({ id: it.id, ok: list.length === 0, problems: list });
      }
      return out;
    },
  };
}
```

- [ ] **Step 2: Wire it in `src/game/game.js`.**
  - Import `import '../gadgets/gadgetSave.js';` at the top of the import list (it registers `progress.gadgets` before `loadProgress` runs), and `import { createBreakables } from '../world/breakables.js';`.
  - In `buildRun`, after `const gfx = createGadgetFx(scene);` add:

```js
    const breakables = createBreakables({
      scene, collision: world.collision, climbables: world.climbables, progress, events, gfx,
      save: () => saveProgress(storage, progress),
    });
```

  - In `update`, after `gfx.update(dt);`: `breakables.update(state.t, hero.pos);`
  - Add `breakables` to the `api` object.

- [ ] **Step 3: Write `scripts/breakables-check.mjs`**

```js
// Checks every gadget breakable against the live city: floors under rooms, nothing built through
// them, a drop behind each railing, clearance under glass signs, and walls kept clear of story
// sites. Lists the street-level ladders near each boarded fire escape, for tuning.
// Usage: node scripts/breakables-check.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5208/';
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${base}?at=toNeon&god=1&new=1`);
await p.waitForFunction(() => window.__game?.breakables, null, { timeout: 120000 });
const result = await p.evaluate(() => {
  const G = window.__game;
  const sites = Object.entries(G.sites).map(([name, s]) => ({ name, ...s }));
  const report = G.breakables.check(sites);
  const ladders = G.climbables.ladders.filter((l) => l.bottom < 0.5).map((l) => ({ id: l.id, x: +l.x.toFixed(1), z: +l.z.toFixed(1), nx: l.nx, nz: l.nz }));
  return { report, ladders };
});
let bad = 0;
for (const r of result.report) {
  console.log(`${r.ok ? 'ok ' : 'BAD'} ${r.id}${r.problems.length ? ': ' + r.problems.join('; ') : ''}`);
  if (!r.ok) bad += 1;
}
console.log('street-level ladders:', JSON.stringify(result.ladders));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await b.close();
process.exit(bad ? 1 : 0);
```

The script reads the story sites from the page: in `game.js`, add `sites: SITES` to the `window.__game` object literal (next to `settings`).

- [ ] **Step 4: Run the check and tune the placements.** Build, preview, then:

```bash
node scripts/breakables-check.mjs http://localhost:5208/
```

Expected: 15 `ok` lines and exit code 0. For every `BAD` line, move that entry in `src/world/breakableSpots.js` and rerun:
- `no street-level ladder within 12 m`: pick the closest entry from the printed ladder list and set `ladderNear` to its `x`, `z`.
- `overlaps a ...`: move the room or sign away from the printed box by at least the overlap; keep rooftop sheds 2 m in from roof edges.
- `floor is at ...`: set the room's `y` to the printed floor.
- `no 4 m drop behind the railing`: move the railing `site` toward a roof edge with no parapet, next to where goons stand in that fight.
- `within 6 m of site ...`: move the wall at least 6 m from that site.
After any change, rerun `npx vitest run tests/unit/breakableSpots.test.js` (the Monarch booth test guards the balloon).

- [ ] **Step 5: Look at them and break them.** With the check passing:

```bash
cat > "$TEMP/g5-t11.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.breakables ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, w = G.breakables.items.find((i) => i.id === 'wallMonarchBooth'); G.hero.teleport({ x: w.center.x - 4, y: 0.15, z: w.center.z }, Math.PI / 2); G.follow.snapBehind(Math.PI / 2); 'at the booth'", "wait": 900},
 {"shot": "t11-booth"},
 {"eval": "const G = window.__game, w = G.breakables.items.find((i) => i.id === 'wallMonarchBooth'); [G.breakables.smash(w, G.hero.pos), G.progress.gadgets.broken]", "wait": 600},
 {"shot": "t11-booth-open"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 158.3, y: 0.15, z: -60 }, Math.PI / 2); 'inside'", "wait": 600},
 {"eval": "window.__game.progress.balloons.includes(6)"},
 {"eval": "const G = window.__game, v = G.breakables.items.find((i) => i.id === 'ventGcpd'); G.hero.teleport({ x: v.center.x, y: v.room.y, z: v.center.z + 3 }, Math.PI); G.follow.snapBehind(Math.PI); G.breakables.smash(v, G.hero.pos); 'vent open'", "wait": 700},
 {"shot": "t11-vent-cache"},
 {"eval": "const G = window.__game, v = G.breakables.items.find((i) => i.id === 'ventGcpd'); G.hero.teleport({ x: v.room.x, y: v.room.y, z: v.room.z + 0.8 }, Math.PI); 'at the crate'", "wait": 500},
 {"eval": "window.__game.progress.gadgets.caches"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=toNeon&god=1&new=1" "$TEMP/g5" "$(cat "$TEMP/g5-t11.json")"
```

Expected: `t11-booth.png` shows a brick booth against the Monarch with a cracked, yellow-ringed front; `smash` prints `[true,["wallMonarchBooth"]]`; `t11-booth-open.png` shows the booth open with brick debris and `KA-CHUNK!`; walking in pops balloon 7 (`true`); `t11-vent-cache.png` shows the open duct with the bat-logo crate bobbing inside; the last eval prints `["cacheVentGcpd"]`; `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/world/breakables.js scripts/breakables-check.mjs src/world/breakableSpots.js src/game/game.js
git commit -m "Breakables in the city: cracked walls, glass signs, vents, railings, caches, placement check"
```

---

### Task 12: Gadget icons, the wheel and the HUD panel (DOM)

**Files:**
- Create: `src/ui/gadgetIcons.js`, `src/ui/gadgetWheel.js`, `src/ui/gadgetHud.js`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `GADGETS` (Task 2), `slotCenter` (Task 3), `batSvgPath`.
- Produces: `GADGET_ICONS`, `LOCK_ICON`, `createGadgetWheel(root)`, `createGadgetHud(root)` (see Shared interfaces). The Bat Swarm icon (`setSwarm`) is added in Task 24.

- [ ] **Step 1: Write `src/ui/gadgetIcons.js`**

```js
// Code-drawn ink icons for the gadgets: inner SVG for a 48 by 48 viewBox. Strokes and fills come
// from CSS (.g-ico), so the HUD panel and the wheel draw them the same way.
import { batSvgPath } from '../config/batShape.js';

export const GADGET_ICONS = {
  batarang: `<path class="fill" d="${batSvgPath(0.42, 24, 25)}"/>`,
  remote: `<path class="dash" d="M5 42 C12 34 8 26 18 22"/><path class="fill" d="${batSvgPath(0.3, 31, 16)}"/>`,
  gel: '<rect class="fill" x="6" y="18" width="12" height="24" rx="3"/><path d="M12 18 V11 H19"/>'
    + '<path class="fill gel" d="M25 31 C27 23 35 23 37 29 C45 29 45 39 37 39 C35 45 25 45 25 39 C19 37 21 31 25 31 Z"/>',
  smoke: '<circle class="fill" cx="13" cy="36" r="6"/>'
    + '<path class="fill smoke" d="M21 28 C19 19 27 13 33 17 C37 9 47 15 43 23 C48 27 44 35 37 33 C35 39 25 38 24 32 Z"/>',
  launcher: '<rect class="fill" x="4" y="19" width="14" height="11" rx="2"/><path d="M18 24.5 H40"/><path class="fill" d="M36 18 L45 24.5 L36 31 Z"/>',
  claw: '<path d="M5 42 L21 26"/><path class="fill" d="M21 26 L27 11 L30 13 L25 26 L37 17 L39 20 L27 29 L41 30 L40 33 L24 32 Z"/>',
  freeze: '<path d="M24 5 V43 M7.5 14.5 L40.5 33.5 M7.5 33.5 L40.5 14.5"/><path d="M19 8 L24 13 L29 8 M19 40 L24 35 L29 40"/>',
  popper: '<path class="fill" d="M7 43 L17 17 L31 31 Z"/><path d="M24 13 L26 6 M33 19 L42 15 M35 28 L44 30"/>'
    + '<circle class="fill pop" cx="39" cy="7" r="2.6"/><circle class="fill pop" cx="30" cy="4" r="1.8"/>',
};

export const LOCK_ICON = '<rect class="fill" x="12" y="22" width="24" height="18" rx="3"/><path d="M17 22 V16 C17 9 31 9 31 16 V22"/>';
```

- [ ] **Step 2: Write `src/ui/gadgetWheel.js`**

```js
// The gadget wheel: eight comic panels in a ring around a caption box. Built once and hidden.
// Opening it sets the locked panels once; moving the pick swaps one class and the caption text.
import { GADGETS } from '../gadgets/gadgetDefs.js';
import { GADGET_ICONS, LOCK_ICON } from './gadgetIcons.js';
import { slotCenter } from '../gadgets/wheelMath.js';

export function createGadgetWheel(root) {
  const el = document.createElement('div');
  el.className = 'gwheel';
  el.innerHTML = `<div class="gw-ring">${GADGETS.map((g, i) => {
    const c = slotCenter(i, 190);
    return `<div class="gw-panel" style="--x:${c.x.toFixed(1)}px;--y:${c.y.toFixed(1)}px;--r:${i % 2 ? 2 : -2}deg">`
      + `<svg class="g-ico gw-icon" viewBox="0 0 48 48">${GADGET_ICONS[g.id]}</svg>`
      + `<svg class="g-ico gw-lock" viewBox="0 0 48 48">${LOCK_ICON}</svg><b>${i + 1}</b></div>`;
  }).join('')}<div class="gw-center"><div class="gw-name"></div><div class="gw-text"></div></div></div>`;
  root.appendChild(el);
  const panels = [...el.querySelectorAll('.gw-panel')];
  const nameEl = el.querySelector('.gw-name'), textEl = el.querySelector('.gw-text');
  let pick = -1;
  const setInfo = (info) => {
    if (nameEl.textContent !== info.name) nameEl.textContent = info.name;
    if (textEl.textContent !== info.text) textEl.textContent = info.text;
  };
  const setPick = (i, info) => {
    if (i !== pick) {
      panels[pick]?.classList.remove('on');
      panels[i]?.classList.add('on');
      pick = i;
    }
    setInfo(info);
  };
  return {
    // unlocked: booleans per slot.
    show(unlocked, i, info) {
      panels.forEach((p, k) => p.classList.toggle('locked', !unlocked[k]));
      setPick(i, info);
      el.classList.add('show');
    },
    setPick,
    setInfo,
    hide() { el.classList.remove('show'); },
    // Lays the wheel out and paints it once while invisible, so the first real open costs nothing.
    warm() { el.classList.add('warm'); void el.offsetWidth; el.getBoundingClientRect(); el.classList.remove('warm'); },
  };
}
```

- [ ] **Step 3: Write `src/ui/gadgetHud.js`**

```js
// The equipped gadget, bottom left beside the health ring: an inked comic panel with its icon,
// charge pips or a cooldown sweep, and the fire key. The gadget system calls set() only when what
// it shows has changed.
import { GADGET_ICONS } from './gadgetIcons.js';

export function createGadgetHud(root) {
  const el = document.createElement('div');
  el.className = 'ghud';
  el.innerHTML = '<div class="gh-panel"><svg class="g-ico" viewBox="0 0 48 48"></svg><div class="gh-cd"></div><div class="gh-pips"></div><b class="gh-key"></b></div><div class="gh-name"></div>';
  root.appendChild(el);
  const panel = el.querySelector('.gh-panel'), icon = el.querySelector('.gh-panel svg'), cd = el.querySelector('.gh-cd');
  const pips = el.querySelector('.gh-pips'), key = el.querySelector('.gh-key'), name = el.querySelector('.gh-name');
  let shownId = '', shownMax = -1, shownKey = '';
  return {
    set(s, keyLabel) {
      if (s.id !== shownId) {
        icon.innerHTML = GADGET_ICONS[s.id];
        name.textContent = s.name;
        shownId = s.id;
        panel.classList.remove('pop');
        void panel.offsetWidth;
        panel.classList.add('pop');
      }
      if (s.max !== shownMax) { pips.innerHTML = '<i></i>'.repeat(s.max); shownMax = s.max; }
      for (let i = 0; i < pips.children.length; i++) pips.children[i].classList.toggle('on', i < s.charges);
      cd.style.setProperty('--cd', s.ready && s.kind !== 'charges' ? '0' : s.frac.toFixed(3));
      panel.classList.toggle('cooling', !s.ready);
      if (keyLabel !== shownKey) { key.textContent = keyLabel; shownKey = keyLabel; }
    },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
  };
}
```

- [ ] **Step 4: Styles.** Append to `src/ui/style.css`:

```css
/* Gadget icons (HUD panel and wheel). */
.g-ico path, .g-ico rect, .g-ico circle { fill: none; stroke: var(--ink); stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
.g-ico .fill { fill: var(--paper); }
.g-ico .gel { fill: #9fe3ff; }
.g-ico .smoke { fill: #bdb9b0; }
.g-ico .pop { fill: var(--balloon); }
.g-ico .dash { stroke-dasharray: 3 4; }

/* Equipped gadget, beside the health ring. */
.ghud { position: absolute; left: 162px; bottom: 34px; }
.gh-panel { position: relative; width: 70px; height: 70px; background: var(--paper); border: 4px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); transform: rotate(-3deg); }
.gh-panel svg { width: 100%; height: 100%; }
.gh-panel.pop { animation: pop 0.2s ease-out; }
.gh-panel.cooling svg { opacity: 0.55; }
.gh-cd { position: absolute; inset: 0; pointer-events: none; background: conic-gradient(rgba(11, 11, 18, 0.55) calc(var(--cd, 0) * 360deg), transparent 0); }
.gh-pips { position: absolute; left: 0; right: 0; bottom: -15px; display: flex; gap: 5px; justify-content: center; }
.gh-pips i { width: 11px; height: 11px; border: 2px solid var(--ink); background: #3a3a44; transform: rotate(45deg); }
.gh-pips i.on { background: #9fe3ff; }
.gh-key { position: absolute; right: -12px; top: -14px; font: 24px 'Bangers', cursive; color: var(--signal); -webkit-text-stroke: 1.5px var(--ink); paint-order: stroke fill; }
.gh-name { margin-top: 18px; font: 700 16px 'Barlow Condensed', sans-serif; letter-spacing: 1px; text-transform: uppercase; text-shadow: 2px 2px 0 var(--ink); }

/* The gadget wheel: comic panels in a ring over a halftone wash. */
.gwheel { position: fixed; inset: 0; z-index: 6; display: none; pointer-events: none;
  background: radial-gradient(circle, rgba(11, 11, 18, 0.25) 0 35%, rgba(11, 11, 18, 0.6) 70%),
    radial-gradient(rgba(11, 11, 18, 0.35) 1.2px, transparent 1.6px) 0 0 / 7px 7px; }
.gwheel.show { display: block; }
.gwheel.warm { display: block; visibility: hidden; }
.gw-ring { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
.gw-panel { position: absolute; width: 104px; height: 104px; background: var(--paper); border: 4px solid var(--ink); box-shadow: 5px 5px 0 var(--ink);
  transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--r)); transition: transform 0.08s, background 0.08s; }
.gw-panel svg { position: absolute; inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); }
.gw-panel .gw-lock { display: none; }
.gw-panel b { position: absolute; left: -10px; top: -14px; font: 28px 'Bangers', cursive; color: var(--paper); -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill; }
.gw-panel.on { background: var(--signal); transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y))) rotate(var(--r)) scale(1.16); }
.gw-panel.locked { background: #3a3a44; }
.gw-panel.locked .gw-icon { display: none; }
.gw-panel.locked .gw-lock { display: block; }
.gw-panel.locked.on { background: #5a5a66; }
.gw-center { position: absolute; left: 0; top: 0; width: 230px; transform: translate(-50%, -50%) rotate(-1.5deg); padding: 10px 14px 12px; background: #fffdf5; border: 4px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); text-align: center; color: var(--ink); }
.gw-name { font: 30px/1 'Bangers', cursive; letter-spacing: 1px; color: var(--balloon); -webkit-text-stroke: 1px var(--ink); }
.gw-text { margin-top: 4px; font: 18px/1.2 'Patrick Hand SC', cursive; }
```

- [ ] **Step 5: Build.** Nothing uses these modules until Task 13, which checks the wheel and the panel live in the game (its Step 8). Here, check they parse and the styles build:

Run: `npx vitest run` and `npx vite build --outDir "$TEMP/g5dist"`
Expected: tests PASS and the build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/ui/gadgetIcons.js src/ui/gadgetWheel.js src/ui/gadgetHud.js src/ui/style.css
git commit -m "Inked gadget icons, the comic-panel gadget wheel and the HUD gadget panel"
```

---

### Task 13: The gadget system, the batarang as gadget 1, and the wheel in the game

**Files:**
- Create: `src/gadgets/gadgetSystem.js`, `src/gadgets/g/index.js`, `src/gadgets/g/batarang.js`
- Modify: `src/ui/prompts.js`, `src/game/game.js`
- Test: `tests/unit/gadgetSystem.test.js` (new), `tests/unit/prompts.test.js`

**Interfaces:**
- Consumes: Tasks 2, 3, 6, 8, 10, 11, 12; `upgradeEffects` (Task 5); `STEPS`; `bindingLabel`, `promptText`; Plan 4E's `getChainDiscount` wiring; Plan 3C's `input.stick`.
- Produces: `createGadgetSystem(deps)` (see Shared interfaces, plus `interrupt()`, `refresh()`, and a `factories` option for tests), `sys.pose(clip, dur, timeScale)`, `HANDLER_FACTORIES`, the batarang handler; prompts `gadgetWheel`, `gadgetRemote`, `gadgetGel`, `gadgetSmoke`, `gadgetLauncher`, `gadgetClaw`, `gadgetFreeze`, `gadgetPopper`; gadget hints; unlock cards; `?gadgets=all`; `window.__game.gadgets`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/gadgetSystem.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createGadgetSystem } from '../../src/gadgets/gadgetSystem.js';
import { createTimeControl } from '../../src/core/time.js';
import { createEvents } from '../../src/core/events.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';
import { DEFAULT_BINDINGS } from '../../src/core/bindings.js';
import { STEPS } from '../../src/game/story.js';

function fakeInput() {
  const down = new Set(), pressed = new Set(), released = new Set(), codes = new Set();
  return {
    look: { dx: 0, dy: 0 }, stick: { lx: 0, ly: 0 }, codes,
    down: (a) => down.has(a), pressed: (a) => pressed.has(a), released: (a) => released.has(a),
    codePressed: (c) => codes.has(c), swallow: (c) => codes.delete(c),
    hold(a) { down.add(a); pressed.add(a); }, letGo(a) { down.delete(a); released.add(a); }, key(c) { codes.add(c); },
    endFrame() { pressed.clear(); released.clear(); codes.clear(); this.look.dx = 0; this.look.dy = 0; },
  };
}
function setup({ unlocked = [], step = 0 } = {}) {
  const events = createEvents(), time = createTimeControl(), input = fakeInput();
  const wheelUi = { show: vi.fn(), setPick: vi.fn(), setInfo: vi.fn(), hide: vi.fn(), warm() {} };
  const gadgetHud = { set: vi.fn() };
  const fired = [];
  const stub = (id) => () => ({ id, fire: () => { fired.push(id); return true; } });
  const factories = { batarang: stub('batarang'), gel: stub('gel'), smoke: stub('smoke') };
  const progress = { step, finished: false, gadgets: { equipped: 'batarang', unlocked, broken: [], caches: [] } };
  const save = vi.fn();
  const sys = createGadgetSystem({
    hero: { dead: false, state: 'ground', grounded: true, control: null, pos: { x: 0, y: 0, z: 0 }, bat: { animator: { play() {} } } },
    combat: { gadgetApi: {}, enemies: [], consumeInput() {} }, follow: {}, time, events, input, fx: {}, gfx: {}, breakables: {},
    progress, save, collision: {}, camera: {}, effects: upgradeEffects([]), wheelUi, gadgetHud,
    getBindings: () => DEFAULT_BINDINGS, isPlaying: () => true, factories,
  });
  const frame = (dt = 0.016) => { const ctx = {}; sys.update(dt, time.scale(dt), ctx); input.endFrame(); return ctx; };
  return { sys, input, time, events, wheelUi, gadgetHud, fired, progress, save, frame };
}

describe('gadget wheel', () => {
  it('holding the wheel key opens it, slows time to 20% and locks combat input', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel');
    const ctx = t.frame();
    expect(t.sys.wheelOpen).toBe(true);
    expect(ctx.lockInput).toBe(true);
    expect(t.time.held).toBeCloseTo(0.2);
    expect(t.wheelUi.show).toHaveBeenCalledTimes(1);
  });
  it('1 to 8 pick while open and are swallowed; letting go equips and saves', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel');
    t.frame();
    t.input.key('Digit3');
    t.sys.update(0.016, 0.003, {});
    expect(t.input.codes.has('Digit3')).toBe(false);
    t.input.endFrame();
    t.input.letGo('gadgetWheel');
    t.frame();
    expect(t.sys.wheelOpen).toBe(false);
    expect(t.time.held).toBe(1);
    expect(t.sys.state.equipped).toBe('gel');
    expect(t.progress.gadgets.equipped).toBe('gel');
    expect(t.save).toHaveBeenCalled();
  });
  it('a locked pick keeps the current gadget', () => {
    const t = setup();
    t.input.hold('gadgetWheel'); t.frame();
    t.input.key('Digit8'); t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('batarang');
  });
  it('the mouse picks by direction', () => {
    const t = setup({ unlocked: ['gel'] });
    t.input.hold('gadgetWheel'); t.frame();
    t.input.look.dx = 120; t.frame();
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('gel');
  });
  it('the right stick picks too', () => {
    const t = setup({ unlocked: ['smoke'] });
    t.input.hold('gadgetWheel'); t.frame();
    t.input.stick.lx = 0.7; t.input.stick.ly = 0.7; t.frame();
    t.input.stick.lx = 0; t.input.stick.ly = 0;
    t.input.letGo('gadgetWheel'); t.frame();
    expect(t.sys.state.equipped).toBe('smoke');
  });
});

describe('firing and unlocks', () => {
  it('fires the equipped gadget and spends it; a cooling gadget hints instead', () => {
    const t = setup({ unlocked: ['smoke'] });
    const hints = [];
    t.events.on('hint', (h) => hints.push(h));
    t.sys.equip('smoke');
    expect(t.sys.fire({}, { inAir: false })).toBe(true);
    expect(t.sys.fire({}, { inAir: false })).toBe(true);
    expect(t.fired).toEqual(['smoke']);
    expect(hints).toEqual([{ id: 'gadget-cooldown', arg: 'Smoke Pellet' }]);
  });
  it('announces each gadget once as the story reaches it, and keeps it for a new game', () => {
    const t = setup();
    const seen = [];
    t.events.on('gadgetUnlocked', ({ id }) => seen.push(id));
    t.progress.step = STEPS.findIndex((s) => s.id === 'toYard');
    t.events.emit('step', {});
    t.events.emit('step', {});
    expect(seen).toEqual(['claw']);
    expect(t.progress.gadgets.unlocked).toContain('claw');
  });
  it('the HUD panel is only redrawn when it changes', () => {
    const t = setup();
    t.frame(); t.frame(); t.frame();
    expect(t.gadgetHud.set).toHaveBeenCalledTimes(1);
  });
});
```

Append to `tests/unit/prompts.test.js`:

```js
import { GADGETS } from '../../src/gadgets/gadgetDefs.js';

describe('promptText: gadgets', () => {
  const IDS = {
    gadgetWheel: ['gadgetWheel', 'batarang'], gadgetRemote: ['batarang'], gadgetGel: ['batarang'], gadgetSmoke: ['batarang'],
    gadgetLauncher: ['batarang', 'jump'], gadgetClaw: ['batarang'], gadgetFreeze: ['batarang'], gadgetPopper: ['batarang'],
  };
  for (const [id, actions] of Object.entries(IDS)) {
    it(`${id} shows its keys and has no dashes`, () => {
      const text = promptText(id, DEFAULT_BINDINGS);
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/[\u2013\u2014]/);
      for (const a of actions) expect(text).toContain(keyLabel(DEFAULT_BINDINGS[a][0]));
    });
  }
  it('every gadget has a prompt', () => {
    for (const g of GADGETS) expect(PROMPT_IDS).toContain(g.promptId);
  });
});
```

(`promptText`, `PROMPT_IDS`, `DEFAULT_BINDINGS` and `keyLabel` are already imported by that file for Plan 4E's tests; add any that are missing.)

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/gadgetSystem.test.js tests/unit/prompts.test.js`
Expected: FAIL.

- [ ] **Step 3: Handler registry and the batarang.** Create `src/gadgets/g/index.js`:

```js
// Gadget handlers by id. Each gadget task adds its line; the system builds one handler per entry.
import { createBatarangHandler } from './batarang.js';

export const HANDLER_FACTORIES = {
  batarang: createBatarangHandler,
};
```

Create `src/gadgets/g/batarang.js`:

```js
// Gadget 1, the batarang, as it always was: it stuns and interrupts the goon you steer toward, up
// to 26 m away. With WayneTech's Triple Batarang it throws one at each of up to three goons.
import { selectTarget } from '../../combat/targeting.js';

export function createBatarangHandler() {
  return {
    id: 'batarang',
    // No goon in range yet: the buffered press tries again for a moment, as before.
    retry: true,
    fire(sys, ctx) {
      const { api, hero, effects } = sys;
      const list = api.alive().filter((e) => e.state !== 'grabbed' && api.canSee(e));
      const first = selectTarget(hero.pos, api.inputDir(ctx, true), list, { range: 26, maxAngle: 1.2 });
      if (!first) return false;
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

- [ ] **Step 4: Write `src/gadgets/gadgetSystem.js`**

```js
// Gadgets at run time: the wheel (hold to open with time at 20%, pick with the mouse, the right
// stick or 1 to 8, let go to equip), the equipped gadget and its HUD panel, firing through
// combat's input buffer (the useGadget hook), each gadget's live effects (handlers in ./g/),
// unlock announcements and the help list.
import { GADGETS, GADGET_IDS, gadgetById, unlockedIds } from './gadgetDefs.js';
import { createGadgetState } from './gadgetState.js';
import { createWheelLogic, createWheelCursor, slotFromDir, WHEEL_DIGITS } from './wheelMath.js';
import { HANDLER_FACTORIES } from './g/index.js';
import { STEPS } from '../game/story.js';
import { bindingLabel } from '../core/bindings.js';
import { promptText } from '../ui/prompts.js';

export function createGadgetSystem(deps) {
  const {
    hero, combat, follow, time, events, input, fx, gfx, breakables, progress, save, collision, camera, effects,
    wheelUi, gadgetHud, getBindings, isPlaying, devAll = false, factories = HANDLER_FACTORIES,
  } = deps;
  const saved = progress.gadgets;
  const state = createGadgetState({ equipped: saved.equipped, unlocked: unlockedIds(progress, STEPS, saved.unlocked), tune: effects });
  if (devAll) state.unlock(GADGET_IDS);
  const handlers = GADGETS.filter((g) => factories[g.id]).map((g) => factories[g.id]());
  const byId = new Map(handlers.map((h) => [h.id, h]));
  const wheel = createWheelLogic();
  const cursor = createWheelCursor();
  const st = {};
  let hudCode = -1, pickCode = -1;

  const sys = {
    hero, combat, api: combat.gadgetApi, follow, time, events, input, fx, gfx, breakables, collision, camera, state, effects, progress,
    cameraFocus: null, cameraMode: null, wheelOpen: false,
    hint(id, arg) { events.emit('hint', { id, arg }); },
    // A short gadget pose (throw, spray, fire). On the ground it holds locomotion off for `dur`, so
    // the clip isn't cut by the idle; otherwise it just plays.
    pose(clip, dur = 0.3, timeScale = 2) {
      hero.bat.animator.play(clip, { once: true, timeScale, fade: 0.05 });
      if (hero.control || hero.state !== 'ground') return;
      let t = 0;
      hero.control = { name: 'gadgetPose', combat: true, canChain: () => t > dur * 0.7, update(dt) { t += dt; return t > dur; } };
    },
  };

  // Every gadget the story has unlocked is remembered in the save, so a new game keeps it.
  function remember() {
    if (devAll) return;
    let dirty = false;
    for (const id of state.unlocked) if (id !== 'batarang' && !saved.unlocked.includes(id)) { saved.unlocked.push(id); dirty = true; }
    if (dirty) save();
  }
  remember();

  function unlockCheck() {
    if (devAll) return;
    const fresh = state.unlock(unlockedIds(progress, STEPS, saved.unlocked));
    remember();
    for (const id of fresh) events.emit('gadgetUnlocked', { id });
  }
  events.on('step', unlockCheck);

  function equip(id) {
    if (!state.equip(id)) return false;
    if (saved.equipped !== id) { saved.equipped = id; save(); }
    hudCode = -1;
    events.emit('gadgetEquip', { id });
    return true;
  }

  function info(i) {
    const id = GADGET_IDS[i];
    if (!state.isUnlocked(id)) return { name: '???', text: gadgetById(id).unlockText };
    state.status(id, st);
    return { name: st.name, text: st.text };
  }
  function openWheel() {
    if (wheel.open || !isPlaying() || hero.dead || byId.get('remote')?.active) return;
    wheel.press(GADGET_IDS.indexOf(state.equipped));
    cursor.reset();
    sys.wheelOpen = true;
    time.hold('wheel', 0.2);
    pickCode = state.hudCode(GADGET_IDS[wheel.pick]);
    wheelUi.show(GADGET_IDS.map((id) => state.isUnlocked(id)), wheel.pick, info(wheel.pick));
    events.emit('wheelOpen');
  }
  function closeWheel(apply = true) {
    if (!wheel.open) return;
    const slot = wheel.release((i) => apply && state.isUnlocked(GADGET_IDS[i]));
    sys.wheelOpen = false;
    time.release('wheel');
    wheelUi.hide();
    events.emit('wheelClose');
    if (slot !== null && GADGET_IDS[slot] !== state.equipped) equip(GADGET_IDS[slot]);
  }
  function updateWheel() {
    if (input.pressed('gadgetWheel')) openWheel();
    if (!wheel.open) return;
    const before = wheel.pick;
    cursor.move(input.look.dx, input.look.dy);
    wheel.choose(cursor.slot());
    wheel.choose(slotFromDir(input.stick?.lx ?? 0, input.stick?.ly ?? 0, { dead: 0.5 }));
    for (let i = 0; i < WHEEL_DIGITS.length; i++) {
      if (!input.codePressed(WHEEL_DIGITS[i])) continue;
      wheel.choose(i);
      input.swallow(WHEEL_DIGITS[i]);
    }
    const code = state.hudCode(GADGET_IDS[wheel.pick]);
    if (wheel.pick !== before) {
      pickCode = code;
      wheelUi.setPick(wheel.pick, info(wheel.pick));
      events.emit('wheelPick', { slot: wheel.pick });
    } else if (code !== pickCode) {
      pickCode = code;
      wheelUi.setInfo(info(wheel.pick));
    }
    if (!input.down('gadgetWheel')) closeWheel(true);
  }

  // combat's useGadget hook. Returns true when the buffered press is used up.
  function fire(ctx, opts = {}) {
    const id = state.equipped;
    const h = byId.get(id);
    if (!h || wheel.open) return true;
    if (!h.manualSpend && !state.ready(id)) {
      const g = gadgetById(id);
      sys.hint(g.kind === 'charges' ? 'gadget-empty' : 'gadget-cooldown', g.name);
      return true;
    }
    const ok = h.fire(sys, ctx, opts);
    if (ok && !h.manualSpend) { state.use(id); events.emit('gadgetUse', { id }); }
    return ok || !h.retry;
  }

  function update(real, dt, ctx) {
    state.tick(dt);
    updateWheel();
    ctx.lockInput = wheel.open;
    sys.wheelOpen = wheel.open;
    for (const h of handlers) h.update?.(sys, real, dt, ctx);
    const id = state.equipped;
    const code = state.hudCode(id) + (state.ready(id) ? 0.5 : 0);
    if (code !== hudCode) {
      hudCode = code;
      gadgetHud.set(state.status(id, st), bindingLabel(getBindings(), 'batarang'));
    }
  }

  return {
    state, fire, update, equip, openWheel, closeWheel, unlockCheck,
    // Play stopped (a cutscene, the finale): close the wheel, drop anything in flight.
    interrupt() { closeWheel(false); for (const h of handlers) h.cancel?.(sys); },
    helpList(bindings) {
      return GADGETS.map((g) => (state.isUnlocked(g.id)
        ? { name: g.name, html: promptText(g.promptId, bindings) }
        : { name: '???', html: g.unlockText }));
    },
    handler: (id) => byId.get(id) ?? null,
    refresh() { hudCode = -1; },
    get wheelOpen() { return wheel.open; },
    get cameraFocus() { return sys.cameraFocus; },
    get cameraMode() { return sys.cameraMode; },
    get debug() {
      return { equipped: state.equipped, wheel: wheel.open, pick: wheel.pick, unlocked: [...state.unlocked], held: time.held, status: GADGET_IDS.map((id) => ({ ...state.status(id) })) };
    },
  };
}
```

- [ ] **Step 5: Prompts.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['gadgetWheel', (k) => `Hold ${k('gadgetWheel')} for the gadget wheel. Time slows while it is open. Point the mouse at a gadget or press 1 to 8, then let go to equip it. ${k('batarang')} uses it.`],
  ['gadgetRemote', (k) => `Remote batarang: press ${k('batarang')}, then steer it with the mouse for 3 seconds. It stuns every goon it passes and smashes glass signs. ${k('batarang')} again drops it.`],
  ['gadgetGel', (k) => `Explosive gel: tap ${k('batarang')} to spray up to three blobs on floors or walls, then hold ${k('batarang')} to set them all off. Cracked walls with a yellow ring break open.`],
  ['gadgetSmoke', (k) => `Smoke pellet: ${k('batarang')} drops a cloud five meters across. Goons inside are stunned and lose track of you.`],
  ['gadgetLauncher', (k) => `Line launcher: ${k('batarang')} fires a line to the wall ahead, up to 40 m, and you ride it across. It works mid-glide too. ${k('jump')} lets go.`],
  ['gadgetClaw', (k) => `Batclaw: ${k('batarang')} yanks the goon you aim at right to you for a free punch. It rips brute armor off and tears down vent covers and weak railings.`],
  ['gadgetFreeze', (k) => `Freeze blast: ${k('batarang')} traps a goon in ice. One hit shatters it and knocks them out.`],
  ['gadgetPopper', (k) => `Party popper: ${k('batarang')} throws a confetti bomb. Goons nearby forget the fight and dance.`],
```

- [ ] **Step 6: Wire it in `src/game/game.js`.**
  - Imports. `wayneSave.js` registers `progress.wayne` and must load before `loadProgress`, so put it next to Task 11's `import '../gadgets/gadgetSave.js';` at the top:

```js
import '../progress/wayneSave.js';
import { upgradeEffects } from '../progress/upgrades.js';
import { gadgetById } from '../gadgets/gadgetDefs.js';
import { createGadgetSystem } from '../gadgets/gadgetSystem.js';
import { createGadgetWheel } from '../ui/gadgetWheel.js';
import { createGadgetHud } from '../ui/gadgetHud.js';
```

  - In `buildRun`, replace the `createCombat(...)` call (after `kicks` and Plan 4E it passes `reach` and `getChainDiscount: () => 0`) with:

```js
    // The live WayneTech effects (src/progress/upgrades.js): combat, the hero and the gadgets all
    // read this one object; buying an upgrade refills it (Task 22).
    const effects = upgradeEffects(progress.wayne.owned);
    hero.tuning = effects;
    let gadgets = null;
    const combat = createCombat({
      hero, follow, time, events, rng, reach, getDifficulty: () => settings.difficulty,
      effects, getChainDiscount: () => effects.chainDiscount, useGadget: (ctx, o) => gadgets.fire(ctx, o),
    });
```

  - After `const flow = createFlow({...});` add:

```js
    const gadgetHud = createGadgetHud(hudRoot.querySelector('.hud') ?? hudRoot);
    const wheelUi = createGadgetWheel(document.body);
    wheelUi.warm();
    gadgets = createGadgetSystem({
      hero, combat, follow, time, events, input, fx, gfx, breakables, progress, camera, effects, wheelUi, gadgetHud,
      collision: world.collision, save: () => saveProgress(storage, progress), getBindings: () => settings.bindings,
      isPlaying: () => flow.mode === 'play' && !state.paused, devAll: params.get('gadgets') === 'all',
    });
    const NO_LOOK = { dx: 0, dy: 0 };
```

  - In `onCredits`, change the credits `onClose` to `() => { menus.hide(); input.setEnabled(true); flow.freeRoam(); gadgets.unlockCheck(); }` (the party popper unlocks as free roam begins).
  - In `update`, in the playing branch, right before `combat.update(dt, ctx);` add `gadgets.update(real, dt, ctx);`, and change the `follow.update(...)` call to:

```js
        follow.update(real, gadgets.cameraFocus ?? hero.pos, gadgets.wheelOpen ? NO_LOOK : input.look, gadgets.cameraMode ?? combat.cameraMode ?? hero.cameraMode(), hero.speed);
```

  In the `else` branch (play stopped) add `if (!playing) gadgets.interrupt();`.
  - Add these to `HINTS`, and change the two Joker hints so they point at the wheel when another gadget is equipped:

```js
      joker: () => (gadgets.state.equipped === 'batarang'
        ? `The Joker slips every punch. Hit him with a batarang ${key('batarang')} while he winds up a throw!`
        : `The Joker slips every punch. Pick the batarang on the gadget wheel (hold ${key('gadgetWheel')}) and hit him while he winds up a throw!`),
      'joker-throw': () => (gadgets.state.equipped === 'batarang'
        ? `A yellow bolt means he is throwing. ${key('batarang')} batarang him now!`
        : `A yellow bolt means he is throwing. Hold ${key('gadgetWheel')}, pick the batarang, and hit him!`),
      'gadget-cooldown': (name) => `${name} is recharging.`,
      'gadget-empty': (name) => `${name} is out of charges. They come back on their own.`,
      'gadget-boss': () => 'The Joker is too slippery for that. Use the batarang while he winds up a throw.',
      'remote-ground': () => 'Stand still on solid ground to steer the remote batarang.',
      'gel-aim': () => 'Aim at a floor or a wall within 14 m to spray gel.',
      'gel-none': () => `No gel down yet. Tap ${key('batarang')} to spray some first.`,
      'gel-full': () => `Three blobs is the limit. Hold ${key('batarang')} to set them off.`,
      'launcher-none': () => 'No wall within 40 m ahead for the line launcher.',
      'launcher-short': () => 'Too close. The line launcher needs a wall at least 6 m away.',
      'claw-none': () => 'Aim the batclaw at a goon, a vent cover or a weak railing.',
      'claw-ground': () => 'Plant your feet to fire the batclaw.',
      'freeze-none': () => 'No goon in sight to freeze.',
      'popper-ground': () => 'Plant your feet to throw the party popper.',
```

  and change the hint listener to pass the argument: `events.on('hint', ({ id, arg }) => HINTS[id] && hud.hint(HINTS[id](arg), 3000));`.
  - Unlock cards: add after the `PROMPT_DONE` wiring:

```js
    events.on('gadgetUnlocked', ({ id }) => {
      const g = gadgetById(id);
      hud.card(`NEW GADGET: ${g.name.toUpperCase()}`, g.cardText, 7000);
      prompts.show(['gadgetWheel', g.promptId]);
    });
```

  and add `wheelOpen: 'gadgetWheel'` to `PROMPT_DONE`.
  - Close the wheel whenever a menu opens: in `pause()` right after its guard line, and in both help branches (the `keydown` listener and `padControls`) before `state.paused = true;`, add `game.gadgets.closeWheel(false);`.
  - In `applySettings`, after `input.setBindings(settings.bindings);` add `game?.gadgets.refresh();`.
  - Add `gadgets, wheelUi` to the `api` object.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 8: The wheel, the HUD panel and the batarang in the game.** Build, preview, then:

```bash
cat > "$TEMP/g5-t13.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const d = window.__game.gadgets.debug; [d.equipped, d.unlocked.length]"},
 {"shot": "t13-hud"},
 {"down": ["Tab"], "wait": 400},
 {"eval": "const G = window.__game; [G.gadgets.wheelOpen, G.time.held, document.querySelector('.gwheel').classList.contains('show')]"},
 {"shot": "t13-wheel-open"},
 {"press": "Digit3", "wait": 200},
 {"eval": "const G = window.__game; [G.gadgets.debug.pick, G.hero.control?.name ?? null]"},
 {"shot": "t13-wheel-gel"},
 {"up": ["Tab"], "wait": 300},
 {"eval": "const G = window.__game; [G.gadgets.state.equipped, G.gadgets.wheelOpen, G.time.held, G.progress.gadgets.equipped]"},
 {"shot": "t13-hud-gel"},
 {"eval": "const G = window.__game; for (let i = 0; i < 6; i++) G.combat.combo.hit(); 'six hits'", "wait": 150},
 {"press": "Digit1", "wait": 200},
 {"eval": "window.__game.hero.control?.name ?? null", "wait": 2600},
 {"eval": "const G = window.__game; G.gadgets.equip('batarang'); G.__log = []; G.events.on('batarangThrow', (d) => G.__log.push(['throw', d.count])); G.events.on('batarangHit', (d) => G.__log.push(['hit', d.target.id, d.result.outcome])); 'armed'"},
 {"press": "KeyR", "wait": 1200},
 {"eval": "JSON.stringify(window.__game.__log)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t13.json")"
```

Expected:
- `["batarang",8]`, then `[true,0.2,true]` with the wheel open.
- The pick after `Digit3` is `2` and `hero.control` is `null`: the key picked a slot and started no chain.
- After letting go of Tab: `["gel",false,1,"gel"]`.
- With the wheel closed, `Digit1` at combo 6 starts Plan 4E's chain (`"chain"`).
- The batarang log reads `[["throw",1],["hit","e?","stun"]]` (existing behaviour kept).
- `t13-wheel-open.png`: eight inked comic panels in a ring over a halftone wash, the batarang panel yellow and enlarged, the caption box reading "Batarang / Ready". `t13-wheel-gel.png`: the gel panel lit, "Explosive Gel / 3 of 3 charges". `t13-hud.png` and `t13-hud-gel.png`: the tilted gadget panel beside the health ring with the `R` key, three blue pips under the gel.
- `no console errors`.

- [ ] **Step 9: Commit**

```bash
git add src/gadgets/gadgetSystem.js src/gadgets/g/index.js src/gadgets/g/batarang.js src/ui/prompts.js src/game/game.js tests/unit/gadgetSystem.test.js tests/unit/prompts.test.js
git commit -m "Gadget system: the wheel in the game, equip and fire, HUD panel, batarang as gadget 1"
```

---

### Task 14: Remote batarang

**Files:**
- Create: `src/gadgets/g/remote.js`
- Modify: `src/gadgets/g/index.js`, `src/game/camera.js`

**Interfaces:**
- Consumes: `steerDir` (Task 3), `time.hold` (Task 1), `gfx.trail` (Task 10), `breakables.forNear`, `breakables.aimed`, `breakables.smash` (Task 11), `api.landHit`, `MOVES.remote`, `sys.cameraFocus`/`cameraMode` (Task 13).
- Produces: handler `remote` (`active`, `position`); camera mode `remote`; events `remoteStart`, `remoteWhirr`, `remoteHit`, `remoteEnd`.

- [ ] **Step 1: Write `src/gadgets/g/remote.js`**

```js
// Remote batarang: Batman holds still and steers it by moving the camera, for up to 3 s, while the
// world runs at 30%. It stuns every goon it passes (not the Joker), smashes glass signs and flies
// on, and stops at anything else solid. The fire key again drops it early.
import * as THREE from 'three';
import { steerDir } from '../aim.js';

const SPEED = 24, LIFE = 3, HIT_R = 1.3, WHIRR = 1.1;

export function createRemoteHandler() {
  const pos = new THREE.Vector3(), dir = new THREE.Vector3(), want = new THREE.Vector3();
  const hit = new Set();
  let active = false, t = 0, whirr = 0, S = null;
  const smashGlass = (b) => S.breakables.smash(b, pos);

  function end(sys, why) {
    active = false;
    sys.time.release('remote');
    sys.gfx.trail.stop();
    sys.fx.impact(pos, 0.6);
    sys.cameraFocus = null;
    sys.cameraMode = null;
    sys.events.emit('remoteEnd', { why });
  }

  return {
    id: 'remote',
    get active() { return active; },
    get position() { return pos; },
    fire(sys) {
      const { hero } = sys;
      if (active) return false;
      if (hero.state !== 'ground' || !hero.grounded || hero.control) { sys.hint('remote-ground'); return false; }
      S = sys;
      active = true;
      t = 0;
      whirr = 0;
      hit.clear();
      hero.bat.bone('hand_r').getWorldPosition(pos);
      sys.follow.lookDir(dir);
      dir.normalize();
      hero.bat.face(Math.atan2(dir.x, dir.z));
      hero.bat.animator.play('OverhandThrow', { once: true, timeScale: 1.9, fade: 0.05 });
      // Batman stands still until it lands.
      hero.control = { name: 'remoteSteer', combat: false, canChain: () => false, update: () => !active };
      sys.time.hold('remote', 0.3);
      sys.gfx.trail.start(pos);
      sys.cameraFocus = pos;
      sys.cameraMode = 'remote';
      sys.events.emit('remoteStart');
      sys.events.emit('word', { text: 'WHIRRR!', pos: pos.clone(), big: false });
      return true;
    },
    update(sys, real, dt, ctx) {
      if (!active) return;
      t += real;
      whirr -= real;
      if (whirr <= 0) { whirr = WHIRR; sys.events.emit('remoteWhirr'); }
      if (sys.hero.dead || sys.hero.control?.name !== 'remoteSteer') { end(sys, 'interrupted'); return; }
      if (t > 0.15 && ctx.input.pressed('batarang')) { sys.combat.consumeInput('batarang'); end(sys, 'drop'); return; }
      sys.follow.lookDir(want);
      steerDir(dir, want, real, 5, dir);
      const step = SPEED * real;
      const wall = sys.collision.raycast(pos, dir, step + 0.2);
      if (wall) {
        const glass = sys.breakables.aimed(pos, dir, step + 0.2, ['glass']);
        if (glass) sys.breakables.smash(glass, pos);
        else {
          pos.addScaledVector(dir, Math.max(0, wall.t - 0.1));
          sys.gfx.trail.push(pos);
          end(sys, 'wall');
          return;
        }
      }
      pos.addScaledVector(dir, step);
      sys.gfx.trail.push(pos);
      for (const e of sys.combat.enemies) {
        if (!e.alive || e.def.boss || hit.has(e.id)) continue;
        if (Math.hypot(e.pos.x - pos.x, e.pos.y + 1.2 - pos.y, e.pos.z - pos.z) > HIT_R) continue;
        hit.add(e.id);
        sys.api.landHit('remote', e);
        sys.events.emit('remoteHit', { target: e });
      }
      sys.breakables.forNear(pos, 0.9, 'glass', smashGlass);
      if (t >= LIFE) end(sys, 'time');
    },
    cancel(sys) { if (active) end(sys, 'cancel'); },
  };
}
```

- [ ] **Step 2: Register it and give it a camera.** In `src/gadgets/g/index.js` add `import { createRemoteHandler } from './remote.js';` and `remote: createRemoteHandler,`. In `src/game/camera.js` add to `MODES`:

```js
  remote: { dist: 2.4, height: 0.35, side: 0, fov: 8 },
```

The follow camera then orbits the batarang (`gadgets.cameraFocus`), and the mouse steers it because it flies where the camera looks.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.** Build, preview, then (a squad on the GCPD roof, then a glass sign on Neon Row):

```bash
cat > "$TEMP/g5-t14.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.gadgets.equip('remote'); G.__log = []; for (const n of ['remoteStart', 'remoteEnd', 'remoteHit']) G.events.on(n, (d) => G.__log.push([n, d?.why ?? d?.target?.id ?? ''])); const e = G.enemies, h = G.hero.pos; e[0].pos.set(h.x - 0.4, h.y, h.z - 5); e[1].pos.set(h.x + 0.4, h.y, h.z - 9); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.05); 'lined up'", "wait": 400},
 {"press": "KeyR", "wait": 350},
 {"eval": "const G = window.__game; [G.gadgets.handler('remote').active, G.time.held, G.gadgets.cameraMode, G.hero.control?.name]"},
 {"shot": "t14-remote-fly"},
 {"wait": 3200},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.time.held, G.gadgets.cameraMode, G.enemies.slice(0, 2).map((e) => e.state)]"},
 {"eval": "const G = window.__game; G.teleport({ x: 150, y: 0.15, z: 44 }); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, -0.45); 'under the sign'", "wait": 5000},
 {"eval": "const G = window.__game, v = G.camera.getWorldDirection(G.camera.position.clone()); v.y.toFixed(2)"},
 {"press": "KeyR", "wait": 1600},
 {"eval": "window.__game.progress.gadgets.broken"},
 {"shot": "t14-glass"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t14.json")"
```

Expected:
- Right after the press: `[true,0.3,"remote","remoteSteer"]`.
- `t14-remote-fly.png`: the camera tight behind a spinning batarang with a yellow trail.
- After 3.2 s: the log has `remoteStart`, a `remoteHit` for both lined-up goons, then `remoteEnd` (`time` or `wall`); `held` is back to `1`, `cameraMode` `null`, and both goons are `stunned`.
- The printed camera direction `y` is positive (looking up). If it prints negative, the pitch sign is the other way: use `0.45` in `snapBehind` and rerun.
- `broken` includes `glassNeonMid`, and `t14-glass.png` shows glass shards and `KSSSSH!`.
- `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/remote.js src/gadgets/g/index.js src/game/camera.js
git commit -m "Remote batarang: steered by the camera in slow time, stuns goons, smashes glass signs"
```

---

### Task 15: Explosive gel

**Files:**
- Create: `src/gadgets/g/gel.js`
- Modify: `src/gadgets/g/index.js`

**Interfaces:**
- Consumes: `gelSpot` (Task 3), `gfx.gel`, `gfx.debris` (Task 10), `api.areaBlast` (Task 8), `breakables.forNear`/`smash` (Task 11), `effects.gelRadius`.
- Produces: handler `gel` (`manualSpend: true`, `placed`); events `gelSpray`, `gelBlast`.

- [ ] **Step 1: Write `src/gadgets/g/gel.js`**

```js
// Explosive gel: tap the fire key to spray a blob where you aim (a floor or a wall, up to 14 m), up
// to three at once; hold it for 0.35 s to set them all off. Each blast knocks down goons within
// 4 m (5.5 m with Bigger Bang) and breaks cracked walls within 1.6 m. Three charges, one back
// every 5 s. The key is read here directly, so a tap and a hold can differ.
import * as THREE from 'three';
import { gelSpot } from '../aim.js';

const HOLD = 0.35, RANGE = 14, WALL_REACH = 1.6;

export function createGelHandler() {
  const blobs = [];
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), c = new THREE.Vector3();
  let holdT = -1, S = null;
  const smashWall = (w) => S.breakables.smash(w, c);

  function spray(sys) {
    const { hero } = sys;
    if (blobs.length >= 3) { sys.hint('gel-full'); return; }
    if (!sys.state.ready('gel')) { sys.hint('gadget-empty', 'Explosive Gel'); return; }
    eye.copy(sys.camera.position);
    sys.follow.lookDir(dir);
    const spot = gelSpot(sys.collision, eye, dir, { range: RANGE + eye.distanceTo(hero.pos) });
    if (!spot || Math.hypot(spot.x - hero.pos.x, spot.y - hero.pos.y, spot.z - hero.pos.z) > RANGE) { sys.hint('gel-aim'); return; }
    const slot = sys.gfx.gel.place(spot);
    if (slot < 0) return;
    blobs.push({ x: spot.x, y: spot.y, z: spot.z, slot });
    sys.state.use('gel');
    sys.pose('Spell_Simple_Shoot', 0.25, 2.2);
    c.set(spot.x, spot.y, spot.z);
    sys.events.emit('gelSpray', { pos: c.clone() });
    sys.events.emit('word', { text: 'SPLUT!', pos: c.clone(), big: false });
    sys.events.emit('gadgetUse', { id: 'gel' });
  }

  function detonate(sys) {
    if (!blobs.length) { sys.hint('gel-none'); return; }
    S = sys;
    let n = 0;
    for (const b of blobs) {
      c.set(b.x, b.y, b.z);
      n += sys.api.areaBlast(c, sys.effects.gelRadius, 'gel');
      sys.breakables.forNear(c, WALL_REACH, 'weakWall', smashWall);
      sys.gfx.gel.clear(b.slot);
      sys.fx.impact(c, 1.6);
      sys.gfx.debris.burst(c, 0x9fe3ff, 8, 6, b.y);
      sys.events.emit('gelBlast', { pos: c.clone(), count: n });
    }
    sys.follow.addShake(0.35);
    sys.events.emit('word', { text: 'KA-BLOOEY!', pos: c.clone(), big: true });
    blobs.length = 0;
  }

  return {
    id: 'gel',
    manualSpend: true,
    get placed() { return blobs.length; },
    // The buffered press only needs using up; update() reads the key.
    fire() { return true; },
    update(sys, real, dt, ctx) {
      const armed = sys.state.equipped === 'gel' && !sys.wheelOpen && !sys.hero.dead && sys.hero.control?.name !== 'remoteSteer';
      if (armed && ctx.input.pressed('batarang') && holdT < 0) holdT = 0;
      if (holdT < 0) return;
      if (armed && ctx.input.down('batarang')) {
        const before = holdT;
        holdT += real;
        if (before < HOLD && holdT >= HOLD) detonate(sys);
      } else {
        if (holdT < HOLD) spray(sys);
        holdT = -1;
      }
    },
    cancel(sys) {
      if (!blobs.length && holdT < 0) return;
      for (const b of blobs) sys.gfx.gel.clear(b.slot);
      blobs.length = 0;
      holdT = -1;
    },
  };
}
```

A tap whose key-down and key-up land in the same frame still sprays: `pressed` starts the hold and `down` is already false, so it resolves as a tap at once.

- [ ] **Step 2: Register it.** In `src/gadgets/g/index.js` add `import { createGelHandler } from './gel.js';` and `gel: createGelHandler,`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play: the Monarch booth and a knockdown.** Build, preview, then:

```bash
cat > "$TEMP/g5-t15.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.gadgets.equip('gel'); G.teleport({ x: 152.5, y: 0.15, z: -60 }); G.hero.bat.face(Math.PI / 2); G.follow.snapBehind(Math.PI / 2, 0.15); const a = G.spawn('grunt', { x: 155, y: 0.15, z: -58.5 }), b = G.spawn('grunt', { x: 155, y: 0.15, z: -61.5 }); G.combat.setEnemies([a, b]); G.__log = []; for (const n of ['gelSpray', 'gelBlast', 'wallBroken']) G.events.on(n, (d) => G.__log.push([n, d.count ?? d.id ?? ''])); 'at the booth'", "wait": 800},
 {"press": "KeyR", "wait": 400},
 {"eval": "const G = window.__game; [G.gadgets.handler('gel').placed, G.gadgets.state.status('gel').charges]"},
 {"shot": "t15-gel-on-wall"},
 {"hold": ["KeyR"], "ms": 600},
 {"wait": 500},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.enemies.map((e) => [e.state, e.down]), G.progress.gadgets.broken.includes('wallMonarchBooth')]"},
 {"shot": "t15-kablooey"},
 {"hold": ["KeyR"], "ms": 600},
 {"eval": "window.__game.gadgets.handler('gel').placed"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=toMonarch&god=1&new=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t15.json")"
```

Expected: after the tap `[1,2]` and `t15-gel-on-wall.png` shows a blob on the cracked booth front; after the hold the log reads `gelSpray`, `gelBlast` (count 2) and `wallBroken wallMonarchBooth`, both goons are `down`, the wall is saved as broken, and `t15-kablooey.png` shows the blast, brick debris and `KA-BLOOEY!`; a hold with nothing placed leaves `placed` at 0 (the "No gel down yet" hint shows); `no console errors`. If the tap doesn't place a blob, print `G.camera.getWorldDirection(...)` and lower the snap pitch until the camera ray meets the wall.

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/gel.js src/gadgets/g/index.js
git commit -m "Explosive gel: tap to spray, hold to blow, knocks goons down and opens cracked walls"
```

---

### Task 16: Smoke pellet

**Files:**
- Create: `src/gadgets/g/smoke.js`
- Modify: `src/gadgets/g/index.js`

**Interfaces:**
- Consumes: `inRadius` (Task 3), `gfx.smoke` (Task 10), `api.landHit`, `MOVES.smoke`, `e.lose` (Task 7), `effects.smokeCooldown` (through `gadgetState`'s `tune`).
- Produces: handler `smoke`; event `smoke { pos, radius, count }`.

- [ ] **Step 1: Write `src/gadgets/g/smoke.js`**

```js
// Smoke pellet: a cloud 5 m across at Batman's feet. Goons inside are stunned for 3 s and lose
// track of him for 5 s; the rest of the fight within 10 m loses him for 2 s. Batman slips the
// next hit. Cooldown 12 s (7 s with Quick Smoke). Part D's stealth hooks e.search(from).
import * as THREE from 'three';
import { inRadius } from '../aim.js';

const R = 2.5;

export function createSmokeHandler() {
  const c = new THREE.Vector3();
  return {
    id: 'smoke',
    fire(sys) {
      const { hero, api } = sys;
      c.copy(hero.pos);
      sys.gfx.smoke.burst(c, R, 6);
      sys.pose('Sword_Regular_B', 0.35, 1.7);
      let n = 0;
      for (const e of sys.combat.enemies) {
        if (!e.alive || e.def.boss) continue;
        if (inRadius(c, e.pos, R + 0.3)) {
          if (!e.down && e.state !== 'frozen') api.landHit('smoke', e);
          e.lose(5, c);
          n += 1;
        } else if (e.aware && inRadius(c, e.pos, 10, 4)) e.lose(2, c);
      }
      hero.invulnerable = Math.max(hero.invulnerable, 0.6);
      sys.events.emit('smoke', { pos: c.clone(), radius: R, count: n });
      sys.events.emit('word', { text: 'FSSSHH!', pos: c.clone().setY(c.y + 1.6), big: false });
      return true;
    },
  };
}
```

- [ ] **Step 2: Register it.** In `src/gadgets/g/index.js` add `import { createSmokeHandler } from './smoke.js';` and `smoke: createSmokeHandler,`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.**

```bash
cat > "$TEMP/g5-t16.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, e = G.enemies; G.gadgets.equip('smoke'); e[0].pos.set(h.x + 1.5, h.y, h.z); e[1].pos.set(h.x - 1.2, h.y, h.z + 1); e[2].pos.set(h.x, h.y, h.z - 7); G.__hints = []; G.events.on('hint', (d) => G.__hints.push(d.id)); 'close'", "wait": 300},
 {"press": "KeyR", "wait": 500},
 {"eval": "const G = window.__game; G.enemies.slice(0, 3).map((e) => [e.state, e.stunned, +e.lostT.toFixed(1), e.ready(G.hero)])"},
 {"shot": "t16-smoke"},
 {"eval": "window.__game.gadgets.state.status('smoke').text"},
 {"press": "KeyR", "wait": 300},
 {"eval": "window.__game.__hints"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t16.json")"
```

Expected: the two close goons are `stunned` (`true`) with `lostT` near 5 and `ready` `false`; the third (7 m away) has `lostT` near 2; `t16-smoke.png` shows the inked halftone cloud around Batman and `FSSSHH!`; the status reads `Ready in 12 s` (or 11); the second press adds `gadget-cooldown` to the hints; `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/smoke.js src/gadgets/g/index.js
git commit -m "Smoke pellet: stun and lose track inside a five meter cloud"
```

---

### Task 17: Line launcher

**Files:**
- Create: `src/gadgets/g/launcher.js`
- Modify: `src/gadgets/g/index.js`, `src/game/game.js` (the `launcherOn` word)

**Interfaces:**
- Consumes: `launcherLine` (Task 3), `createZipControl` with `minSpeed`, `onEvent`, `offEvent`, `line` (Task 9), `gfx.lines` (Task 10).
- Produces: handler `launcher`; events `launcherFire`, `launcherOn`, `launcherOff`.

- [ ] **Step 1: Write `src/gadgets/g/launcher.js`**

```js
// Line launcher: a level line to the wall ahead (6 to 40 m along the camera's heading), ridden
// like a zipline at 18 m/s or more. It works from the ground, a jump or a glide, so it can cross
// a street mid-glide. Jump lets go; the end of the line pops Batman up toward the ledge.
import * as THREE from 'three';
import { launcherLine } from '../aim.js';
import { createZipControl } from '../../actors/traverse/zipline.js';

export function createLauncherHandler() {
  let riding = null;
  const hand = new THREE.Vector3(), fwd = new THREE.Vector3();
  return {
    id: 'launcher',
    fire(sys) {
      const { hero } = sys;
      if (hero.control || hero.dead) return false;
      sys.follow.forward(fwd);
      const r = launcherLine(sys.collision, hero.pos, Math.atan2(fwd.x, fwd.z));
      if (!r.ok) { sys.hint(r.reason === 'short' ? 'launcher-short' : 'launcher-none'); return false; }
      hero.cape.setWings(false);
      riding = createZipControl(hero, { events: sys.events }, { line: r.line, s: 0.3, minSpeed: 18, onEvent: 'launcherOn', offEvent: 'launcherOff' });
      hero.control = riding;
      const anchor = new THREE.Vector3(r.line.b.x, r.line.b.y, r.line.b.z);
      sys.events.emit('launcherFire', { pos: anchor });
      sys.events.emit('word', { text: 'THUNK!', pos: anchor.clone(), big: false });
      return true;
    },
    update(sys) {
      if (!riding) return;
      if (sys.hero.control !== riding) { riding = null; sys.gfx.lines.hide('launcher'); return; }
      sys.hero.bat.bone('hand_r').getWorldPosition(hand);
      sys.gfx.lines.set('launcher', hand, riding.line.b);
    },
    cancel(sys) {
      if (!riding) return;
      if (sys.hero.control === riding) sys.hero.control = null;
      riding = null;
      sys.gfx.lines.hide('launcher');
    },
  };
}
```

- [ ] **Step 2: Register it and give it its word.** In `src/gadgets/g/index.js` add `import { createLauncherHandler } from './launcher.js';` and `launcher: createLauncherHandler,`. In `src/game/game.js`, next to the `zipOn` word listener, add:

```js
    events.on('launcherOn', () => events.emit('word', { text: 'ZZZIP!', pos: hero.pos.clone().setY(hero.pos.y + 2), big: false }));
```

(The launcher emits its own events, so it never counts as learning the city zipline move in Plan 3C's tracker.)

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play: from the street, then mid-glide.**

```bash
cat > "$TEMP/g5-t17.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.gadgets.equip('launcher'); G.__log = []; for (const n of ['launcherFire', 'launcherOn', 'launcherOff', 'hint']) G.events.on(n, (d) => G.__log.push([n, d?.id ?? ''])); G.teleport({ x: 152, y: 0.15, z: 72 }); G.hero.bat.face(-Math.PI / 2); G.follow.snapBehind(-Math.PI / 2, 0.1); 'facing the jazz club'", "wait": 900},
 {"press": "KeyR", "wait": 250},
 {"eval": "const G = window.__game; [G.hero.control?.name, +G.hero.control?.line?.length.toFixed(1)]"},
 {"shot": "t17-line"},
 {"wait": 1500},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.hero.control?.name ?? null, +G.hero.pos.x.toFixed(1)]"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 152, y: 26, z: 60 }, Math.PI); G.follow.snapBehind(Math.PI, 0.1); G.hero.vel.set(0, 0, -16); G.hero.startGlide(); 'gliding north'", "down": ["Space"], "wait": 300},
 {"eval": "const G = window.__game; G.hero.bat.face(-Math.PI / 2); G.follow.snapBehind(-Math.PI / 2, 0.1); G.hero.state"},
 {"press": "KeyR", "wait": 250},
 {"eval": "window.__game.hero.control?.name ?? null"},
 {"up": ["Space"]},
 {"shot": "t17-glide-line"},
 {"eval": "const G = window.__game; G.hero.teleport({ x: 150, y: 60, z: 10 }, Math.PI); G.follow.snapBehind(Math.PI, -0.3); 'open sky'", "wait": 200},
 {"press": "KeyR", "wait": 200},
 {"eval": "JSON.stringify(window.__game.__log.slice(-1))"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=toNeon&god=1&new=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t17.json")"
```

Expected: after the press `["zip", n]` with `n` between 6 and 40; `t17-line.png` shows Batman hanging from a taut ink line to the building face; 1.5 s later the log has `launcherFire`, `launcherOn`, `launcherOff`, control is `null` or a ledge control, and `x` is within 3 m of 140.6; mid-glide the press starts a `zip` control too (`t17-glide-line.png`); aimed at open sky the last log entry is a `hint`; `no console errors`. If the glide step starts below the roofs' reach, raise its `y`, keeping `z` on the jazz club (63 to 81).

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/launcher.js src/gadgets/g/index.js src/game/game.js
git commit -m "Line launcher: a level line to the wall ahead, ridden with the zip control, mid-glide too"
```

---

### Task 18: Batclaw

**Files:**
- Create: `src/gadgets/g/claw.js`
- Modify: `src/gadgets/g/index.js`

**Interfaces:**
- Consumes: `pickAimedMany` (Task 3), `boxDistance` (Task 4), `e.yank` (Task 7), `api.landHit`, `api.canSee`, `api.director`, `breakables.aimed`/`smash` (Task 11), `gfx.lines` (Task 10), `effects.clawTargets`.
- Produces: handler `claw`; events `clawYank`, `clawRip`.

- [ ] **Step 1: Write `src/gadgets/g/claw.js`**

```js
// Batclaw: yanks the goon you aim at (two with Double Claw) right to Batman, down for a free punch.
// A brute loses its armor instead (stunned for 4 s). With no goon in the sights it tears down the
// vent cover or weak railing you aim at; goons standing at a torn railing go over the edge.
import * as THREE from 'three';
import { pickAimedMany } from '../aim.js';
import { boxDistance } from '../../world/breakableSpots.js';

const RANGE = 20, LINE_TIME = 0.35;
const HELD = ['grabbed', 'chained', 'tied', 'frozen'];

export function createClawHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), to = new THREE.Vector3(), hand = new THREE.Vector3(), tip = new THREE.Vector3();
  let lineT = 0, lineTarget = null, lineLift = 0;
  const clawable = (e) => e.alive && !e.def.boss && !e.down && !e.air && !HELD.includes(e.state);

  return {
    id: 'claw',
    fire(sys) {
      const { hero, api, effects } = sys;
      if (hero.state !== 'ground' || hero.control) { sys.hint('claw-ground'); return false; }
      eye.set(hero.pos.x, hero.pos.y + 1.4, hero.pos.z);
      sys.follow.lookDir(dir);
      const goons = pickAimedMany(sys.combat.enemies, eye, dir, effects.clawTargets, {
        range: RANGE, maxAngle: 0.3, filter: (e) => clawable(e) && api.canSee(e),
      });
      if (goons.length) {
        sys.pose('Spell_Simple_Shoot', 0.3, 2.2);
        for (const e of goons) {
          if (e.def.armored && !e.stunned) {
            api.landHit('claw', e);
            e.stunned = true;
            e.stunT = Math.max(e.stunT, 4);
            sys.events.emit('clawRip', { target: e });
            sys.events.emit('word', { text: 'RIIIP!', pos: e.pos.clone().setY(e.pos.y + 1.6), big: true });
            continue;
          }
          const dx = e.pos.x - hero.pos.x, dz = e.pos.z - hero.pos.z, d = Math.hypot(dx, dz) || 1;
          to.set(hero.pos.x + (dx / d) * 1.3, hero.pos.y, hero.pos.z + (dz / d) * 1.3);
          if (e.yank(to)) api.director.release(e.id);
        }
        hero.bat.face(Math.atan2(goons[0].pos.x - hero.pos.x, goons[0].pos.z - hero.pos.z));
        lineTarget = goons[0].pos;
        lineLift = 1.1;
        lineT = LINE_TIME;
        sys.events.emit('clawYank', { count: goons.length });
        sys.events.emit('word', { text: 'YOINK!', pos: goons[0].pos.clone().setY(goons[0].pos.y + 1.8), big: false });
        return true;
      }
      const b = sys.breakables.aimed(eye, dir, RANGE, ['vent', 'railing']);
      if (b) {
        sys.pose('Spell_Simple_Shoot', 0.3, 2.2);
        if (b.kind === 'railing') {
          for (const e of sys.combat.enemies) {
            if (!e.alive || e.def.boss || boxDistance(b.bounds, e.pos) > 2.5) continue;
            e.launch(b.normal.nx * 5, 3, b.normal.nz * 5);
            api.director.release(e.id);
          }
        }
        sys.breakables.smash(b, hero.pos);
        lineTarget = b.center;
        lineLift = 0;
        lineT = LINE_TIME;
        return true;
      }
      sys.hint(sys.combat.enemies.some((e) => e.alive && e.def.boss) ? 'gadget-boss' : 'claw-none');
      return false;
    },
    update(sys, real) {
      if (lineT <= 0) return;
      lineT -= real;
      if (lineT <= 0) { sys.gfx.lines.hide('claw'); return; }
      sys.hero.bat.bone('hand_r').getWorldPosition(hand);
      tip.copy(lineTarget);
      tip.y += lineLift;
      sys.gfx.lines.set('claw', hand, tip);
    },
  };
}
```

- [ ] **Step 2: Register it.** In `src/gadgets/g/index.js` add `import { createClawHandler } from './claw.js';` and `claw: createClawHandler,`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play: yank and punch, a brute, a vent, a railing.**

```bash
cat > "$TEMP/g5-t18.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, e = G.enemies; G.gadgets.equip('claw'); e[0].pos.set(h.x, h.y, h.z - 9); for (const o of e.slice(1)) o.pos.x += 12; G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.12); 'one goon ahead'", "wait": 500},
 {"press": "KeyR", "wait": 250},
 {"shot": "t18-yank"},
 {"wait": 500},
 {"eval": "const G = window.__game, e = G.enemies[0]; [e.state, e.down, +Math.hypot(e.pos.x - G.hero.pos.x, e.pos.z - G.hero.pos.z).toFixed(1)]"},
 {"click": 0, "wait": 700},
 {"eval": "const e = window.__game.enemies[0]; [e.state, e.alive]"},
 {"eval": "const G = window.__game, h = G.hero.pos, b = G.enemies.find((x) => x.type === 'brute'); b.pos.set(h.x, h.y, h.z - 7); G.gadgets.state.tick(3); 'brute ahead'", "wait": 400},
 {"press": "KeyR", "wait": 400},
 {"eval": "const b = window.__game.enemies.find((x) => x.type === 'brute'); [b.stunned, +b.stunT.toFixed(1)]"},
 {"shot": "t18-rip"},
 {"eval": "const G = window.__game, v = G.breakables.items.find((i) => i.id === 'ventGcpd'); G.hero.teleport({ x: v.room.x, y: v.room.y, z: v.room.z + 6 }, Math.PI); G.follow.snapBehind(Math.PI, 0.1); G.gadgets.state.tick(3); 'facing the vent'", "wait": 600},
 {"press": "KeyR", "wait": 500},
 {"eval": "window.__game.progress.gadgets.broken"},
 {"shot": "t18-vent"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t18.json")"
```

Expected: `t18-yank.png` shows the ink line from Batman's hand to the flying goon and `YOINK!`; the goon lands `down` within about 1.5 m; one punch leaves it `["ko",false]`; the brute prints `[true, ~4]` and `t18-rip.png` shows `RIIIP!`; the vent test adds `ventGcpd` to `broken` and `t18-vent.png` shows the open duct with its crate; `no console errors`.

Then the railing (a goon on the warehouse roof edge):

```bash
cat > "$TEMP/g5-t18b.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, r = G.breakables.items.find((i) => i.id === 'railWarehouse'), c = r.center; G.gadgets.equip('claw'); const g = G.spawn('grunt', { x: c.x + 1, y: r.bounds.minY, z: c.z - r.normal.nz * 1.2 - r.normal.nx * 0 }); G.combat.setEnemies([g]); G.hero.teleport({ x: c.x, y: r.bounds.minY, z: c.z - r.normal.nz * 8 }, Math.atan2(r.normal.nx, r.normal.nz)); G.follow.snapBehind(Math.atan2(r.normal.nx, r.normal.nz), 0.2); 'rail ahead'", "wait": 800},
 {"eval": "const G = window.__game; G.enemies[0].pos.x += 3; 'goon beside the aim line'", "wait": 200},
 {"press": "KeyR", "wait": 2500},
 {"eval": "const G = window.__game; [G.progress.gadgets.broken.includes('railWarehouse'), G.enemies[0].state, G.enemies[0].alive]"},
 {"shot": "t18-rail"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=toYard&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t18b.json")"
```

The goon is left unaware, so it stays by the rail. Expected: the railing is broken and the goon standing at it fell off the roof and is `["ko", false]` (the drop knocks it out); `no console errors`. If the claw picks the goon instead of the rail, move the goon further off the aim line (it must be outside the 0.3 rad cone but within 2.5 m of the rail).

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/claw.js src/gadgets/g/index.js
git commit -m "Batclaw: yank goons for a free punch, rip brute armor, tear down vents and railings"
```

---

### Task 19: Freeze blast

**Files:**
- Create: `src/gadgets/g/freeze.js`
- Modify: `src/gadgets/g/index.js`

**Interfaces:**
- Consumes: `pickAimed` (Task 3), `selectTarget`, `e.freeze`, `e.shattered` (Task 7), the landHit shatter (Task 8), `gfx.ice` (Task 10), `effects.freezeTime`.
- Produces: handler `freeze`; event `freeze { target }` (`iceShatter` comes from combat, Task 8).

- [ ] **Step 1: Write `src/gadgets/g/freeze.js`**

```js
// Freeze blast: an ice grenade at the goon you aim at (or steer toward). The goon is frozen for
// 5 s (8 s with Deep Freeze); any hit shatters the ice and knocks it out. Two charges, one back
// every 10 s. Never the Joker.
import * as THREE from 'three';
import { pickAimed } from '../aim.js';
import { selectTarget } from '../../combat/targeting.js';

export function createFreezeHandler() {
  const eye = new THREE.Vector3(), dir = new THREE.Vector3(), hand = new THREE.Vector3();
  const frozen = [];
  const freezable = (e) => e.alive && !e.def.boss && !e.air && !['frozen', 'grabbed', 'chained'].includes(e.state);

  return {
    id: 'freeze',
    fire(sys, ctx) {
      const { hero, api, effects } = sys;
      const list = sys.combat.enemies;
      eye.set(hero.pos.x, hero.pos.y + 1.4, hero.pos.z);
      sys.follow.lookDir(dir);
      const ok = (e) => freezable(e) && api.canSee(e);
      const target = pickAimed(list, eye, dir, { range: 22, maxAngle: 0.35, filter: ok })
        ?? selectTarget(hero.pos, api.inputDir(ctx, true), list.filter(ok), { range: 22, maxAngle: 1 });
      if (!target) { sys.hint(list.some((e) => e.alive && e.def.boss) ? 'gadget-boss' : 'freeze-none'); return false; }
      api.faceTo(target);
      sys.pose('OverhandThrow', 0.3, 1.9);
      hero.bat.bone('hand_r').getWorldPosition(hand);
      sys.gfx.ice.throw(hand, (out) => target.ch.headWorld(out, -0.3), () => {
        if (!freezable(target)) return;
        if (target.freeze(effects.freezeTime)) api.director.release(target.id);
        const slot = sys.gfx.ice.attach(target);
        if (slot >= 0) frozen.push({ e: target, slot });
        sys.events.emit('freeze', { target });
        sys.events.emit('word', { text: 'KRZZT!', pos: target.pos.clone().setY(target.pos.y + 1.8), big: false });
      });
      return true;
    },
    // Ice goes when the goon leaves the frozen state: shattered into shards, or melted.
    update(sys) {
      for (let i = frozen.length - 1; i >= 0; i--) {
        const f = frozen[i];
        if (f.e.state === 'frozen') continue;
        sys.gfx.ice.release(f.slot, f.e.shattered);
        frozen.splice(i, 1);
      }
    },
  };
}
```

- [ ] **Step 2: Register it.** In `src/gadgets/g/index.js` add `import { createFreezeHandler } from './freeze.js';` and `freeze: createFreezeHandler,`.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play.**

```bash
cat > "$TEMP/g5-t19.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, e = G.enemies; G.gadgets.equip('freeze'); e[0].pos.set(h.x, h.y, h.z - 6); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.12); G.__log = []; for (const n of ['freeze', 'iceShatter']) G.events.on(n, (d) => G.__log.push([n, d.target.id])); 'aim'", "wait": 400},
 {"press": "KeyR", "wait": 700},
 {"eval": "const e = window.__game.enemies[0]; [e.state, +e.frozenT.toFixed(1)]"},
 {"shot": "t19-ice"},
 {"eval": "const G = window.__game, e = G.enemies[0]; G.hero.teleport({ x: e.pos.x, y: e.pos.y, z: e.pos.z + 1.6 }, Math.PI); 'beside the ice'", "wait": 200},
 {"click": 0, "wait": 700},
 {"eval": "const G = window.__game, e = G.enemies[0]; [e.state, e.alive, e.shattered, JSON.stringify(G.__log)]"},
 {"shot": "t19-shatter"},
 {"eval": "const G = window.__game; G.__hints = []; G.events.on('hint', (d) => G.__hints.push(d.id)); G.gadgets.state.status('freeze').charges"},
 {"press": "KeyR", "wait": 600},
 {"press": "KeyR", "wait": 400},
 {"eval": "window.__game.__hints"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t19.json")"
```

Expected: `["frozen", ~4.4]` and `t19-ice.png` shows a translucent ice block around the goon and `KRZZT!`; one punch leaves `["ko",false,true,...]` with the log `freeze` then `iceShatter`, and `t19-shatter.png` shows ice shards and `KRSSSH!`; one charge is left, the next press uses it, the one after hints `gadget-empty`; `no console errors`.

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/freeze.js src/gadgets/g/index.js
git commit -m "Freeze blast: ice grenade, frozen goons shatter on any hit"
```

---

### Task 20: Party popper and the sky lettering

**Files:**
- Create: `src/gadgets/g/popper.js`
- Modify: `src/gadgets/g/index.js`

**Interfaces:**
- Consumes: `letterPoints`, `birthdayLine` (Task 3), `MANSI.name`, `gfx.confetti` (Task 10), `e.dance` (Task 7), `api.landHit`, `MOVES.popper`, `follow.right`, `follow.state.pitch`.
- Produces: handler `popper`; event `popper { pos, count }`.

- [ ] **Step 1: Write `src/gadgets/g/popper.js`**

```js
// Party popper (unlocked after the credits): a confetti bomb thrown 5 m ahead. Every goon within
// 6 m dances, stunned, for 3 s, and the confetti flies up to spell HAPPY BIRTHDAY <NAME>! across
// the sky 30 m ahead, holds for five seconds, then flutters down. The letters are baked once.
import * as THREE from 'three';
import MANSI from '../../mansi.config.js';
import { letterPoints, birthdayLine } from '../skyLetters.js';

const R = 6, DELAY = 0.35;

export function createPopperHandler() {
  const letters = letterPoints(birthdayLine(MANSI.name), { cell: 0.5 }).points;
  const at = new THREE.Vector3(), anchor = new THREE.Vector3(), fwd = new THREE.Vector3(), right = new THREE.Vector3();
  let pending = -1;

  function pop(sys) {
    const { api, hero } = sys;
    sys.gfx.confetti.burst(at, 320);
    anchor.copy(hero.pos).addScaledVector(fwd, 30);
    anchor.y = hero.pos.y + 12;
    sys.gfx.confetti.letters(at, anchor, right, letters);
    let n = 0;
    for (const e of sys.combat.enemies) {
      if (!e.alive || e.def.boss || e.down || Math.hypot(e.pos.x - at.x, e.pos.z - at.z) > R || Math.abs(e.pos.y - at.y) > 3) continue;
      api.landHit('popper', e);
      if (e.dance(3)) api.director.release(e.id);
      n += 1;
    }
    // Level the view so the lettering is in the sky, not above the frame.
    sys.follow.state.pitch = Math.min(sys.follow.state.pitch, 0.02);
    sys.fx.impact(at, 1.4);
    sys.events.emit('popper', { pos: at.clone(), count: n });
    sys.events.emit('word', { text: 'POP! POP! POP!', pos: at.clone().setY(at.y + 1.5), big: true });
  }

  return {
    id: 'popper',
    fire(sys) {
      const { hero } = sys;
      if (hero.state !== 'ground' || hero.control) { sys.hint('popper-ground'); return false; }
      sys.follow.forward(fwd);
      sys.follow.right(right);
      at.copy(hero.pos).addScaledVector(fwd, 5);
      const g = sys.collision.groundBelow(at.x, hero.pos.y + 2, at.z, 0.3);
      at.y = g > -Infinity ? g : hero.pos.y;
      sys.pose('OverhandThrow', 0.4, 1.6);
      pending = DELAY;
      return true;
    },
    update(sys, real, dt) {
      if (pending < 0) return;
      pending -= dt;
      if (pending < 0) pop(sys);
    },
    cancel() { pending = -1; },
  };
}
```

- [ ] **Step 2: Register it.** In `src/gadgets/g/index.js` add `import { createPopperHandler } from './popper.js';` and `popper: createPopperHandler,`. All eight handlers are now registered.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 4: Scripted play: the lettering, the dance, and the real unlock.**

```bash
cat > "$TEMP/g5-t20.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game, h = G.hero.pos, e = G.enemies; G.gadgets.equip('popper'); e[0].pos.set(h.x + 1, h.y, h.z - 5); e[1].pos.set(h.x - 1.5, h.y, h.z - 6); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.2); 'party'", "wait": 400},
 {"press": "KeyR", "wait": 900},
 {"eval": "const G = window.__game; [G.enemies.slice(0, 2).map((e) => e.state), G.gfx.confetti.live]"},
 {"shot": "t20-dance"},
 {"wait": 1100},
 {"shot": "t20-sky-letters"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t20.json")"

cat > "$TEMP/g5-t20b.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; [G.gadgets.state.isUnlocked('popper'), G.gadgets.equip('popper')]"},
 {"eval": "const G = window.__game; G.__seen = []; G.events.on('gadgetUnlocked', (d) => G.__seen.push(d.id)); G.progress.finished = true; G.gadgets.unlockCheck(); [G.__seen, G.progress.gadgets.unlocked.includes('popper')]", "wait": 600},
 {"shot": "t20-card"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=boss&god=1&new=1" "$TEMP/g5" "$(cat "$TEMP/g5-t20b.json")"
```

Expected: both goons are `dance` and confetti `live` is several hundred; `t20-dance.png` shows them dancing in a confetti burst with `POP! POP! POP!`; `t20-sky-letters.png` shows HAPPY BIRTHDAY on one line and MANSI! under it in confetti across the sky, readable left to right; before the credits the popper is locked (`[false,false]`); setting `finished` and checking unlocks announces it once (`[["popper"],true]`) and `t20-card.png` shows the "NEW GADGET: PARTY POPPER" card; `no console errors`. If the letters read mirrored, the camera's right vector is the other way: negate `right` after `follow.right(right)` and rerun.

- [ ] **Step 5: Commit**

```bash
git add src/gadgets/g/popper.js src/gadgets/g/index.js
git commit -m "Party popper: dancing goons and HAPPY BIRTHDAY in confetti across the sky"
```

---

### Task 21: Gadget sounds, the help page and the pad layout

**Files:**
- Modify: `src/audio/sfx.js`, `src/game/sound.js`, `src/ui/menus.js`, `src/game/game.js`

**Interfaces:**
- Consumes: every gadget event (Tasks 11 to 20), `gadgets.helpList` (Task 13).
- Produces: SFX `remote`, `gelSpray`, `gelBoom`, `smoke`, `launcher`, `claw`, `freeze`, `shatter`, `glass`, `wallBreak`, `popper`, `levelUp`, `upgrade`, `wheelOpen`, `swarm`; `menus.setGadgetHelp(fn)`; a Gadgets section on the help page; pad layout lines for the wheel, the RB tap, "Use gadget" and the Bat Swarm chord.

- [ ] **Step 1: Sounds** in `src/audio/sfx.js`. Add to `SFX` (the `levelUp`, `upgrade` and `swarm` sounds are used by Tasks 22 to 24):

```js
  // Remote batarang: a fast whirring spin, re-triggered every 1.1 s while it flies.
  remote: { wet: 0.1, max: 2, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 1.1, rate: 46, freq: 2600, to: 2200, gain: 0.2, Q: 2.2, a: 0.04 });
    return t + 1.15;
  } },

  // Gel spray: a wet hiss and a squelch.
  gelSpray: { wet: 0.06, max: 2, fn(ctx, out, t, p) {
    noise(ctx, out, t, { type: 'bandpass', freq: 1800 * p, Q: 1.2, d: 0.2, gain: 0.35 });
    tone(ctx, out, t + 0.05, { type: 'sine', freq: 320 * p, to: 110 * p, d: 0.14, gain: 0.3 });
    return t + 0.24;
  } },

  // Gel blast: a deep boom with a crackle of debris.
  gelBoom: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 120, to: 32, d: 0.55, gain: 1 });
    noise(ctx, out, t, { type: 'lowpass', freq: 700 * p, d: 0.6, gain: 0.9 });
    crackle(ctx, out, t + 0.05, { dur: 0.5, count: 26, freq: 2500, gain: 0.3 });
    return t + 0.7;
  } },

  // Smoke pellet: a pop, then a long hiss swelling out.
  smoke: { wet: 0.2, max: 1, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 260, to: 90, d: 0.08, gain: 0.5 });
    swish(ctx, out, t + 0.03, p, { from: 300, peak: 1400, to: 500, dur: 0.9, gain: 0.5, Q: 0.8 });
    noise(ctx, out, t + 0.05, { type: 'highpass', freq: 3000, d: 1.1, gain: 0.12 });
    return t + 1.2;
  } },

  // Line launcher: a gas-powered thunk and the line whipping out.
  launcher: { wet: 0.15, max: 2, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 210, to: 90, d: 0.1, gain: 0.6 });
    metal(ctx, out, t, { base: 1200 * p, ratios: [1, 2.3], d: 0.14, gain: 0.14 });
    swish(ctx, out, t + 0.04, p, { from: 800, peak: 3600, to: 1500, dur: 0.3, gain: 0.35, Q: 3 });
    return t + 0.36;
  } },

  // Batclaw: the claw flies out and clamps shut.
  claw: { wet: 0.12, max: 2, fn(ctx, out, t, p) {
    swish(ctx, out, t, p, { from: 600, peak: 2800, to: 900, dur: 0.18, gain: 0.35, Q: 2.5 });
    metal(ctx, out, t + 0.16, { base: 900 * p, ratios: [1, 1.6, 2.7], d: 0.2, gain: 0.2 });
    thump(ctx, out, t + 0.18, p, { from: 180, to: 70, d: 0.12, gain: 0.5 });
    return t + 0.4;
  } },

  // Freeze blast: a crackling freeze under a falling whistle.
  freeze: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.5, count: 36, freq: 6000, gain: 0.3 });
    tone(ctx, out, t, { type: 'sine', freq: 2400 * p, to: 900 * p, d: 0.4, gain: 0.18 });
    return t + 0.55;
  } },

  // Ice shatter: a bright crackle over a glassy ring.
  shatter: { wet: 0.35, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.35, count: 44, freq: 5000, gain: 0.5 });
    bell(ctx, out, t, 100 + 12 * Math.log2(p), { gain: 0.12, d: 0.5, ratio: 2.7, index: 1.4 });
    return t + 0.6;
  } },

  // A glass sign coming down.
  glass: { wet: 0.3, max: 2, fn(ctx, out, t, p) {
    crackle(ctx, out, t, { dur: 0.45, count: 50, freq: 7000, gain: 0.45 });
    tone(ctx, out, t, { type: 'triangle', freq: 3200 * p, to: 2000 * p, d: 0.1, gain: 0.2 });
    return t + 0.5;
  } },

  // A cracked wall giving way: a heavy crunch and tumbling bricks.
  wallBreak: { wet: 0.3, max: 1, fn(ctx, out, t, p) {
    thump(ctx, out, t, p, { from: 90, to: 30, d: 0.45, gain: 0.9 });
    noise(ctx, out, t, { type: 'lowpass', freq: 500 * p, d: 0.5, gain: 0.7 });
    crackle(ctx, out, t + 0.1, { dur: 0.7, count: 22, freq: 900, gain: 0.35, type: 'lowpass' });
    return t + 0.85;
  } },

  // Party popper: three pops, a crackle of confetti and a little fanfare.
  popper: { wet: 0.3, max: 1, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    for (const at of [0, 0.09, 0.2]) {
      noise(ctx, out, t + at, { type: 'highpass', freq: 1500, d: 0.05, gain: 0.6 });
      thump(ctx, out, t + at, p, { from: 320, to: 120, d: 0.06, gain: 0.4 });
    }
    crackle(ctx, out, t + 0.2, { dur: 0.8, count: 30, freq: 6500, gain: 0.2 });
    [72, 76, 79, 84].forEach((m, i) => bell(ctx, out, t + 0.28 + i * 0.07, m + semi, { gain: 0.14, d: 0.5, ratio: 2, index: 1 }));
    return t + 1.1;
  } },

  // Level up: a rising bell arpeggio over brass.
  levelUp: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    const semi = 12 * Math.log2(p);
    [67, 72, 76, 79, 84].forEach((m, i) => bell(ctx, out, t + i * 0.08, m + semi, { gain: 0.16, d: 0.8, ratio: 2.01, index: 1.2 }));
    brass(ctx, out, t + 0.32, 72 + semi, 0.5, { gain: 0.14, a: 0.03, r: 0.4, bright: 1 });
    brass(ctx, out, t + 0.32, 79 + semi, 0.5, { gain: 0.1, a: 0.03, r: 0.4, bright: 1 });
    return t + 1.3;
  } },

  // Buying an upgrade: a mechanical clunk and a chime.
  upgrade: { wet: 0.2, max: 1, fn(ctx, out, t, p) {
    metal(ctx, out, t, { base: 700 * p, ratios: [1, 1.5, 2.2], d: 0.18, gain: 0.18 });
    bell(ctx, out, t + 0.1, 88 + 12 * Math.log2(p), { gain: 0.16, d: 0.7, ratio: 3.01, index: 1.5 });
    return t + 0.8;
  } },

  // The gadget wheel opening: a soft paper swish.
  wheelOpen: { wet: 0.05, max: 1, fn(ctx, out, t, p) {
    return swish(ctx, out, t, p, { from: 800, peak: 2400, to: 1200, dur: 0.16, gain: 0.2, Q: 1.2 });
  } },

  // Bat Swarm: two layers of wing flutter, swelling and fading.
  swarm: { wet: 0.35, max: 1, fn(ctx, out, t, p) {
    flutter(ctx, out, t, p, { dur: 1.8, rate: 30, freq: 3200, to: 1800, gain: 0.35, Q: 0.9, a: 0.3 });
    flutter(ctx, out, t + 0.15, p, { dur: 1.6, rate: 22, freq: 1500, to: 900, gain: 0.25, Q: 0.9, a: 0.3 });
    return t + 2;
  } },
```

- [ ] **Step 2: Event wiring** in `src/game/sound.js`, after the existing `on(...)` lines:

```js
  on('wheelOpen', () => audio.play('wheelOpen'));
  on('wheelPick', () => audio.play('uiMove'));
  on('gadgetEquip', () => audio.play('uiSelect', { gain: 0.7 }));
  on('remoteStart', () => audio.play('batarangThrow'));
  on('remoteWhirr', () => audio.play('remote'));
  on('remoteHit', () => audio.play('batarangHit'));
  on('gelSpray', () => audio.play('gelSpray', { pitch: vary() }));
  on('gelBlast', () => audio.play('gelBoom', { pitch: vary(0.1) }));
  on('smoke', () => audio.play('smoke'));
  on('launcherFire', () => audio.play('launcher'));
  on('launcherOn', () => audio.play('grapple'));
  on('clawYank', () => audio.play('claw'));
  on('clawRip', () => audio.play('block', { pitch: 0.6 }));
  on('freeze', () => audio.play('freeze'));
  on('iceShatter', () => audio.play('shatter'));
  on('popper', () => audio.play('popper'));
  on('glassBroken', () => audio.play('glass'));
  on('wallBroken', () => audio.play('wallBreak'));
  on('ventOpen', () => audio.play('block', { pitch: 1.3 }));
  on('railingDown', () => audio.play('block', { pitch: 0.8 }));
  on('cacheFound', () => audio.play('pickup'));
  on('levelUp', () => audio.play('levelUp'));
  on('upgradeBought', () => audio.play('upgrade'));
  on('swarmStart', () => audio.play('swarm'));
```

Hits already sound through `impact` (a `stun` plays the soft batarang hit, a gel knockdown plays `heavy`, a shatter plays `heavy` and `ko` on top of `shatter`).

- [ ] **Step 3: Help page** in `src/ui/menus.js`.
  - In `PAD_LAYOUT`, change `['Cape stun', 'RB']` to `['Cape stun', 'RB (tap)']` and `['Batarang', 'RT']` to `['Use gadget', 'RT']`, and add `['Gadget wheel', 'Hold RB, pick with the right stick']` and `['Chain takedown 4 (Bat Swarm)', 'Hold Y, then LB']`.
  - Inside `createMenus`, add `let gadgetHelp = () => [];`.
  - In `help()`, after the chain takedown section (Plan 4E), add:

```js
    const gadgets = gadgetHelp();
    if (gadgets.length) {
      node.appendChild(el('h3', '', 'Gadgets'));
      node.appendChild(el('p', 'tip', promptText('gadgetWheel', settings.bindings)));
      for (const g of gadgets) {
        const p = el('p', 'tip', g.html);
        p.prepend(el('b', '', `${g.name}: `));
        node.appendChild(p);
      }
    }
```

  - Add to the returned object: `setGadgetHelp(fn) { gadgetHelp = fn; },`.
  - In `src/game/game.js`, after `gadgets = createGadgetSystem(...)`: `menus.setGadgetHelp(() => gadgets.helpList(settings.bindings));`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Listen and look.** Open the audio lab (`src/audio/lab.js` lists `SFX_NAMES`, so the new sounds appear on their own) in the dev server and play each new sound once: none clips, `gelBoom` and `wallBreak` are the heaviest, `remote` whirs, `popper` is festive. Then build, preview, and:

```bash
node scripts/dev-play.mjs "http://localhost:5208/?at=toVat&god=1&new=1" "$TEMP/g5" '[
 {"eval": "new Promise((r) => { const f = () => (window.__game.gadgets ? r(1) : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"press": "KeyH", "wait": 500},
 {"eval": "[...document.querySelectorAll(\".help-menu h3\")].map((h) => h.textContent)"},
 {"shot": "t21-help"}
]'
```

Expected: the headings include `Gadgets`; `t21-help.png` shows seven gadgets with their key-labelled help and the party popper as `???: A birthday surprise, after the story.`; the pad column lists `Use gadget RT`, `Cape stun RB (tap)` and the wheel line; `no console errors`.

- [ ] **Step 6: Commit**

```bash
git add src/audio/sfx.js src/game/sound.js src/ui/menus.js src/game/game.js
git commit -m "Gadget sounds, a Gadgets section in the help page, pad layout for the wheel"
```

---

### Task 22: WayneTech at run time: XP, levels, buying, effects, recovery

**Files:**
- Create: `src/progress/wayneTech.js`
- Modify: `src/ui/prompts.js`, `src/game/game.js`
- Test: `tests/unit/wayneTech.test.js` (new), `tests/unit/prompts.test.js`

**Interfaces:**
- Consumes: `xp.js`, `upgrades.js` (Task 5), `combat.applyEffects`, `combat.combo`, `combat.active` (Task 8), `hud.card`, `hud.setHealth`; events `ko`, `takedown`, `special`, `counter`, `fightDone`, `objectiveDone`, `balloon`, `impact`, `heroHurt`, Plan 4E's `chainDone`, Plan 3C's `challengeDone` and `crimeStopped`, Task 11's `cacheFound`, `glassBroken`, `wallBroken`, Task 24's `swarmDone`, and Part H's future `crateOpened` and `missionDone`.
- Produces: `createWayneTech(...)` (see Shared interfaces); events `xp`, `levelUp`, `upgradeBought`; prompt `wayneTech`; the level-up caption; `window.__game.wayne`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/wayneTech.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { createEvents } from '../../src/core/events.js';
import { createWayneTech } from '../../src/progress/wayneTech.js';
import { upgradeEffects } from '../../src/progress/upgrades.js';

function setup({ xp = 0, owned = [] } = {}) {
  const events = createEvents();
  const progress = { wayne: { xp, owned: [...owned], medals: {} } };
  const hero = { health: 100, maxHealth: 100, dead: false };
  const combat = { combo: { value: 0 }, active: false, applyEffects: vi.fn() };
  const hud = { setHealth: vi.fn(), card: vi.fn() };
  const effects = upgradeEffects(owned);
  const save = vi.fn();
  const w = createWayneTech({ events, progress, save, hero, combat, hud, effects, baseHealth: () => 100 });
  return { events, progress, hero, combat, hud, effects, save, w };
}

describe('XP from play', () => {
  it('knockouts, balloons and chains pay', () => {
    const t = setup();
    for (let i = 0; i < 3; i++) t.events.emit('ko', {});
    t.events.emit('balloon', { index: 0 });
    t.events.emit('chainDone', { chain: 'rope', count: 3, stealth: false });
    expect(t.w.xp).toBe(30 + 150 + 150);
  });
  it('a combo pays when it ends, with a bonus for variety', () => {
    const t = setup();
    for (const move of ['punch', 'kick', 'counter']) t.events.emit('impact', { move, outcome: 'hit' });
    t.combat.combo.value = 10;
    t.w.update(0.016);
    t.combat.combo.value = 0;
    t.w.update(0.016);
    expect(t.w.xp).toBe(60);
  });
  it('medals pay the improvement once', () => {
    const t = setup();
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'bronze' });
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'bronze' });
    expect(t.w.xp).toBe(150);
    t.events.emit('challengeDone', { id: 'neonSlalom', medal: 'gold' });
    expect(t.w.xp).toBe(500);
    expect(t.progress.wayne.medals).toEqual({ neonSlalom: 'gold' });
  });
  it('caches and later side content pay what they say', () => {
    const t = setup();
    t.events.emit('cacheFound', { id: 'cacheColdStore', xp: 250 });
    t.events.emit('crateOpened', {});
    t.events.emit('missionDone', {});
    expect(t.w.xp).toBe(950);
  });
  it('announces every level crossed', () => {
    const t = setup({ xp: 950 });
    const seen = [];
    t.events.on('levelUp', (d) => seen.push(d));
    t.w.award(100, 'test');
    t.w.award(2000, 'test');
    expect(seen).toEqual([{ level: 2, points: 1 }, { level: 3, points: 2 }, { level: 4, points: 3 }]);
  });
});

describe('buying', () => {
  it('spends a point, applies the effects and raises max health', () => {
    const t = setup({ xp: 1000 });
    expect(t.w.buy('plating1')).toEqual({ ok: true, reason: null });
    expect(t.hero.maxHealth).toBe(125);
    expect(t.hero.health).toBe(125);
    expect(t.effects.maxHealthBonus).toBe(25);
    expect(t.combat.applyEffects).toHaveBeenCalled();
    expect(t.save).toHaveBeenCalled();
    expect(t.w.buy('plating2').reason).toBe('locked');
    expect(t.w.buy('kevlar').reason).toBe('points');
    expect(t.w.free).toBe(0);
  });
  it('the page lists every tree with states and the XP bar', () => {
    const t = setup({ xp: 2300, owned: ['plating1'] });
    const p = t.w.page();
    expect(p).toMatchObject({ level: 3, xp: 2300, into: 300, need: 700, free: 1, allOwned: false });
    expect(p.trees.map((x) => x.upgrades.length)).toEqual([5, 5, 5, 5]);
    expect(p.trees[0].upgrades.map((u) => u.state)).toEqual(['owned', 'buyable', 'locked', 'locked', 'locked']);
    expect(p.trees[1].upgrades[0]).toMatchObject({ id: 'reflexes', tier: 1, state: 'buyable' });
  });
});

describe('recovery out of combat', () => {
  it('waits 6 s after a hit, then 4 per second', () => {
    const t = setup();
    t.hero.health = 50;
    t.events.emit('heroHurt', { damage: 10 });
    t.w.update(3);
    expect(t.hero.health).toBe(50);
    t.w.update(4);
    expect(t.hero.health).toBe(66);
  });
  it('not while a fight is on', () => {
    const t = setup();
    t.hero.health = 50;
    t.combat.active = true;
    t.w.update(10);
    expect(t.hero.health).toBe(50);
  });
  it('Field Medic starts sooner and runs faster', () => {
    const t = setup({ xp: 5000, owned: ['plating1', 'kevlar', 'plating2', 'medic'] });
    t.hero.health = 50;
    t.events.emit('heroHurt', { damage: 10 });
    t.w.update(3);
    expect(t.hero.health).toBe(86);
  });
});
```

Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: WayneTech', () => {
  it('wayneTech points at the pause key and has no dashes', () => {
    const text = promptText('wayneTech', DEFAULT_BINDINGS);
    expect(text).toContain(keyLabel(DEFAULT_BINDINGS.pause[0]));
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/wayneTech.test.js tests/unit/prompts.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `src/progress/wayneTech.js`**

```js
// WayneTech at run time: XP from play (fights, takedowns, chains, balloons, medals, crimes,
// caches, and Part H's crates and side missions), a level and an upgrade point every 1,000 XP,
// buying upgrades, and applying their effects through the one effects object that combat, the
// hero and the gadgets read. Also health recovery out of combat (Field Medic speeds it up).
import { XP, comboXp, chainXp, medalXp, levelOf, pointsFree, toNext, levelsCrossed, createComboRun } from './xp.js';
import { TREES, UPGRADE_IDS, upgradeEffects, canBuy, upgradeStatus, regenStep } from './upgrades.js';

// Events that pay a flat XP amount (the XP table key is the event name).
const FLAT = ['ko', 'takedown', 'special', 'fightDone', 'objectiveDone', 'balloon', 'crimeStopped', 'glassBroken', 'wallBroken', 'crateOpened', 'missionDone'];

export function createWayneTech({ events, progress, save, hero, combat, hud, effects, baseHealth }) {
  const w = progress.wayne;
  const run = createComboRun();
  let lastCombo = 0, sinceHurt = 99, dirty = false, saveT = 0, shownHealth = -1;

  function award(amount, source) {
    const a = Math.round(amount);
    if (!(a > 0)) return;
    const before = w.xp;
    w.xp += a;
    dirty = true;
    events.emit('xp', { amount: a, source, xp: w.xp });
    const levels = levelsCrossed(before, w.xp);
    levels.forEach((level, i) => events.emit('levelUp', { level, points: pointsFree(w.xp, w.owned.length) - (levels.length - 1 - i) }));
    if (levels.length) { dirty = false; save(); }
  }

  for (const ev of FLAT) events.on(ev, () => award(XP[ev], ev));
  events.on('counter', ({ count = 1 } = {}) => award(XP.counter * count, 'counter'));
  events.on('chainDone', ({ count, stealth }) => award(chainXp(count, stealth), 'chain'));
  events.on('swarmDone', ({ count }) => award(XP.swarmPerGoon * count, 'swarm'));
  events.on('cacheFound', ({ xp }) => award(xp, 'cache'));
  events.on('challengeDone', ({ id, medal }) => {
    const gain = medalXp(w.medals[id] ?? null, medal);
    if (!gain) return;
    w.medals[id] = medal;
    award(gain, 'medal');
  });
  events.on('impact', ({ move, outcome }) => { if (outcome !== 'parried' && outcome !== 'immune') run.note(move, 0); });
  events.on('heroHurt', () => { sinceHurt = 0; });

  function apply() {
    upgradeEffects(w.owned, effects);
    combat.applyEffects();
    const max = baseHealth() + effects.maxHealthBonus;
    if (hero.maxHealth !== max) {
      hero.health = Math.min(max, hero.health + Math.max(0, max - hero.maxHealth));
      hero.maxHealth = max;
      hud.setHealth(hero.health / max);
    }
  }

  return {
    effects,
    get xp() { return w.xp; },
    get level() { return levelOf(w.xp); },
    get free() { return pointsFree(w.xp, w.owned.length); },
    award,
    apply,
    buy(id) {
      const r = canBuy(w.owned, id, pointsFree(w.xp, w.owned.length));
      if (!r.ok) return r;
      w.owned.push(id);
      apply();
      save();
      events.emit('upgradeBought', { id });
      return r;
    },
    page() {
      const free = pointsFree(w.xp, w.owned.length);
      const n = toNext(w.xp);
      return {
        level: levelOf(w.xp), xp: w.xp, into: n.into, need: n.need, fraction: n.fraction, free,
        allOwned: w.owned.length === UPGRADE_IDS.length,
        trees: TREES.map((t) => ({
          id: t.id, name: t.name,
          upgrades: t.upgrades.map((u, i) => ({ id: u.id, name: u.name, text: u.text, tier: i + 1, state: upgradeStatus(w.owned, u.id, free) })),
        })),
      };
    },
    update(dt) {
      // A combo run closes when the counter drops back to 0.
      const v = combat.combo.value;
      if (v > 0) run.note(null, v);
      if (lastCombo > 0 && v === 0) { const r = run.close(); award(comboXp(r.peak, r.variety), 'combo'); }
      lastCombo = v;
      sinceHurt += dt;
      if (!hero.dead) {
        const h = regenStep(hero.health, hero.maxHealth, { calm: !combat.active, sinceHurt }, effects, dt);
        if (h !== hero.health) {
          hero.health = h;
          if (Math.abs(h - shownHealth) >= 1 || h >= hero.maxHealth) { shownHealth = h; hud.setHealth(h / hero.maxHealth); }
        }
      }
      saveT -= dt;
      if (dirty && saveT <= 0) { saveT = 2; dirty = false; save(); }
    },
  };
}
```

Recovery checks the delay once per frame, after adding that frame's time, so in the Field Medic test a single 3 s update (past the 2.5 s delay) adds 12 x 3 = 36 and the goon-free hero reads 86. Real frames are about 7 ms, so in play the difference is one frame.

- [ ] **Step 4: Prompt.** Add to `ENTRIES` in `src/ui/prompts.js`:

```js
  ['wayneTech', (k) => `Level up! Press ${k('pause')} and open WayneTech to spend your upgrade point.`],
```

- [ ] **Step 5: Wire it in `src/game/game.js`.**
  - Import `import { createWayneTech } from '../progress/wayneTech.js';`
  - In `buildRun`, after `gadgets = createGadgetSystem(...)` (and the help line), add:

```js
    const wayne = createWayneTech({
      events, progress, hero, combat, hud, effects, save: () => saveProgress(storage, progress),
      baseHealth: () => (settings.difficulty === 'story' ? 150 : 100),
    });
    wayne.apply();
    hero.health = hero.maxHealth;
    hud.setHealth(1);
    events.on('levelUp', ({ level, points }) => {
      hud.card(`LEVEL ${level}!`, `WayneTech sent an upgrade. ${points === 1 ? 'One point' : `${points} points`} to spend in the pause menu.`, 6500);
      events.emit('word', { text: 'LEVEL UP!', pos: hero.pos.clone().setY(hero.pos.y + 2.4), big: true });
      prompts.show(['wayneTech']);
    });
```

  - Add `upgradeBought: 'wayneTech'` to `PROMPT_DONE`.
  - In `update`, in the playing branch after `gfx.update(dt);`: `wayne.update(dt);`
  - In `applySettings`, change `const max = settings.difficulty === 'story' ? 150 : 100;` to `const max = (settings.difficulty === 'story' ? 150 : 100) + (game.wayne?.effects.maxHealthBonus ?? 0);`
  - Add `wayne` to the `api` object.

- [ ] **Step 6: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 7: Scripted play.**

```bash
cat > "$TEMP/g5-t22.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.wayne ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__xp = []; G.events.on('xp', (d) => G.__xp.push([d.source, d.amount])); G.winFight(); 'won'", "wait": 2500},
 {"eval": "const G = window.__game; [G.wayne.xp, JSON.stringify(G.__xp.slice(0, 8))]"},
 {"eval": "const G = window.__game; G.wayne.award(1000 - (G.wayne.xp % 1000), 'test'); [G.wayne.level, G.wayne.free]", "wait": 400},
 {"shot": "t22-level-up"},
 {"eval": "const G = window.__game; G.wayne.buy('plating1'); [G.hero.maxHealth, G.progress.wayne.owned]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&new=1" "$TEMP/g5" "$(cat "$TEMP/g5-t22.json")"
```

Expected: winning the test fight pays `ko` entries (10 each) and a combo if one ran; the award reaches level 2 with 1 point; `t22-level-up.png` shows the "LEVEL 2!" comic caption and `LEVEL UP!` over Batman; buying gives `[125,["plating1"]]`; `no console errors`.

- [ ] **Step 8: Commit**

```bash
git add src/progress/wayneTech.js src/ui/prompts.js src/game/game.js tests/unit/wayneTech.test.js tests/unit/prompts.test.js
git commit -m "WayneTech: XP from play, level-ups every 1000, buying and applying upgrades, recovery"
```

---

### Task 23: The WayneTech page in the pause menu

**Files:**
- Modify: `src/ui/menus.js`, `src/ui/style.css`, `src/game/game.js`

**Interfaces:**
- Consumes: `wayne.page()`, `wayne.buy()`, `wayne.free` (Task 22); Plan 3C's `menus.pause(opts)` with optional buttons and `pauseOptions()`.
- Produces: `menus.wayneTechPage(data, { onBuy, onBack, focus })`; the pause button `WayneTech` (with the points to spend); `opts.onWayneTech`, `opts.info.wayneFree`.

- [ ] **Step 1: The page** in `src/ui/menus.js`. Add next to Plan 3C's pages:

```js
  // ---------- WayneTech ----------
  // data: wayne.page(). Every card is a button so a gamepad can browse them; only buyable ones buy.
  // Text goes in with textContent.
  const WT_STATE = { owned: 'Built', buyable: 'Build it: 1 point', poor: 'Needs 1 point', locked: 'Needs the one above' };
  function wayneTechPage(data, { onBuy, onBack, focus = null }) {
    const node = el('div', 'menu wt-menu');
    node.appendChild(el('div', 'wt-head', '<span class="wt-logo">WAYNETECH</span><span class="wt-sub">Applied Sciences Division</span>'));
    const bar = el('div', 'wt-xp', '<div class="wt-level"></div><div class="wt-bar"><i></i></div><div class="wt-points"></div><div class="wt-next"></div>');
    bar.querySelector('.wt-level').textContent = `Level ${data.level}`;
    bar.querySelector('.wt-bar i').style.width = `${Math.round(data.fraction * 100)}%`;
    bar.querySelector('.wt-points').textContent = data.allOwned ? 'Every upgrade built' : data.free === 1 ? '1 point to spend' : `${data.free} points to spend`;
    bar.querySelector('.wt-next').textContent = `${data.xp.toLocaleString('en-US')} XP. ${data.need.toLocaleString('en-US')} more to level ${data.level + 1}.`;
    node.appendChild(bar);
    const trees = el('div', 'wt-trees');
    for (const t of data.trees) {
      const col = el('div', `wt-tree wt-${t.id}`);
      col.appendChild(el('h3', '', t.name));
      for (const u of t.upgrades) {
        const card = el('button', `mbtn wt-card ${u.state}`, '<span class="wt-tier"></span><span class="wt-name"></span><span class="wt-text"></span><span class="wt-state"></span>');
        card.dataset.id = u.id;
        card.querySelector('.wt-tier').textContent = String(u.tier);
        card.querySelector('.wt-name').textContent = u.name;
        card.querySelector('.wt-text').textContent = u.text;
        card.querySelector('.wt-state').textContent = WT_STATE[u.state];
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          if (u.state === 'buyable') onBuy(u.id);
          else sound('uiBack');
        });
        card.addEventListener('mouseenter', () => sound('uiMove'));
        col.appendChild(card);
      }
      trees.appendChild(col);
    }
    node.appendChild(trees);
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
    if (focus) node.querySelector(`[data-id="${focus}"]`)?.focus({ preventScroll: true });
  }
```

Add `wayneTechPage` to the returned object. In Plan 3C's `pause(opts)`, add `onWayneTech` to the destructuring and, right after the Progress button:

```js
    if (onWayneTech) list.appendChild(button(info.wayneFree ? `WayneTech, ${info.wayneFree} to spend` : 'WayneTech', onWayneTech, info.wayneFree ? 'glow' : ''));
```

- [ ] **Step 2: Styles.** Append to `src/ui/style.css`:

```css
/* WayneTech: a comic-book tech catalogue. */
.wt-menu { width: min(1080px, 96vw); }
.wt-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 6px; transform: rotate(-1deg); }
.wt-logo { font: 58px/1 'Bangers', cursive; letter-spacing: 3px; color: var(--signal); -webkit-text-stroke: 2px var(--ink); paint-order: stroke fill; text-shadow: 5px 5px 0 var(--ink); }
.wt-sub { font: 700 18px 'Barlow Condensed', sans-serif; letter-spacing: 2px; text-transform: uppercase; }
.wt-xp { display: grid; grid-template-columns: auto 1fr auto; gap: 4px 14px; align-items: center; margin: 6px 0 12px; }
.wt-level { font: 30px 'Bangers', cursive; }
.wt-bar { height: 16px; border: 3px solid var(--ink); background: #fff8e6; box-shadow: 3px 3px 0 var(--ink); }
.wt-bar i { display: block; height: 100%; background: var(--detective); }
.wt-points { font: 26px 'Bangers', cursive; color: var(--balloon); -webkit-text-stroke: 1px var(--ink); }
.wt-next { grid-column: 1 / -1; font: 18px 'Patrick Hand SC', cursive; }
.wt-trees { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.wt-tree h3 { margin: 0 0 6px; font: 28px 'Bangers', cursive; letter-spacing: 1px; }
.wt-card { position: relative; display: grid; width: 100%; gap: 2px; margin: 0 0 12px; padding: 8px 10px 8px 34px; text-align: left; color: var(--ink); background: #fffdf5; border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); }
.wt-card + .wt-card::before { content: ''; position: absolute; left: 50%; top: -15px; width: 3px; height: 12px; background: var(--ink); }
.wt-tier { position: absolute; left: 7px; top: 6px; font: 24px 'Bangers', cursive; }
.wt-name { font: 700 18px 'Barlow Condensed', sans-serif; text-transform: uppercase; }
.wt-text { font: 15px/1.2 'Patrick Hand SC', cursive; }
.wt-state { font: 700 13px 'Barlow Condensed', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
.wt-card.owned { background: var(--signal); }
.wt-card.buyable { animation: wtPulse 1.1s ease-in-out infinite alternate; }
.wt-card.poor { opacity: 0.85; }
.wt-card.locked { background: #d9d3c2; opacity: 0.6; }
@keyframes wtPulse { from { box-shadow: 3px 3px 0 var(--ink); } to { box-shadow: 3px 3px 0 var(--ink), 0 0 0 4px var(--detective); } }
@media (max-width: 760px) { .wt-trees { grid-template-columns: repeat(2, 1fr); } }
.pause-menu .mbtn.glow { background: var(--signal); }
```

- [ ] **Step 3: Pause options** in `src/game/game.js`. In Plan 3C's `pauseOptions()`, add `wayneFree: game.wayne.free` to the `info` object (`info: { ...side.pauseInfo(), wayneFree: game.wayne.free }`) and add `onWayneTech: openWayneTech,`. Next to `pauseOptions`, add:

```js
  // The WayneTech page stays open while buying; Back returns to a pause menu with fresh numbers.
  function openWayneTech() {
    const cbs = {
      onBuy: (id) => { game.wayne.buy(id); menus.wayneTechPage(game.wayne.page(), { ...cbs, focus: id }); },
      onBack: () => menus.pause(pauseOptions()),
    };
    menus.wayneTechPage(game.wayne.page(), cbs);
  }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Scripted check: buy from the page, and it persists.**

```bash
cat > "$TEMP/g5-t23.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.wayne ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "window.__game.wayne.award(2000, 'test'); window.__game.wayne.free", "wait": 300},
 {"press": "Escape", "wait": 400},
 {"eval": "[...document.querySelectorAll('.pause-menu .mbtn')].map((b) => b.textContent)"},
 {"eval": "[...document.querySelectorAll('.pause-menu .mbtn')].find((b) => b.textContent.startsWith('WayneTech')).click()", "wait": 400},
 {"shot": "t23-waynetech"},
 {"eval": "document.querySelector('.wt-card.buyable[data-id=\"accelerator\"]').click()", "wait": 300},
 {"eval": "document.querySelector('.wt-card.buyable[data-id=\"reflexes\"]').click()", "wait": 300},
 {"eval": "[document.querySelectorAll('.wt-card.owned').length, document.querySelector('.wt-points').textContent, window.__game.hero.tuning.boostUp, document.activeElement?.dataset.id]"},
 {"shot": "t23-bought"},
 {"eval": "[...document.querySelectorAll('.menu .mbtn')].find((b) => b.textContent === 'Back').click()", "wait": 300},
 {"eval": "[...document.querySelectorAll('.pause-menu .mbtn')].map((b) => b.textContent)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?at=toNeon&god=1&new=1" "$TEMP/g5" "$(cat "$TEMP/g5-t23.json")"
node scripts/dev-play.mjs "http://localhost:5208/?at=toNeon&god=1" "$TEMP/g5" '[{"eval": "new Promise((r) => { const f = () => (window.__game.wayne ? r(1) : setTimeout(f, 100)); f(); })"},{"eval": "[window.__game.progress.wayne.owned, window.__game.hero.tuning.boostUp, window.__game.wayne.xp]"}]'
```

Expected: the pause menu lists `WayneTech, 2 to spend` (highlighted); `t23-waynetech.png` shows the WAYNETECH masthead, the level bar, and four columns of five inked cards joined by ink ticks, the first card of each tree pulsing blue; after two purchases `[2,"0 points to spend",19,"reflexes"]` (focus stays on the card just bought); `t23-bought.png` shows the two cards yellow; Back returns to a pause menu reading plain `WayneTech`; after a reload the second run prints `[["accelerator","reflexes"],19,2000]`; `no console errors`. Check with a gamepad too if one is connected: the D-pad moves through the cards and A buys.

- [ ] **Step 6: Commit**

```bash
git add src/ui/menus.js src/ui/style.css src/game/game.js
git commit -m "WayneTech page in the pause menu: four trees, XP bar, buy in place"
```

---

### Task 24: Bat Swarm, the fourth chain takedown

**Files:**
- Create: `src/combat/batSwarm.js`, `src/game/swarmFx.js`
- Modify: `src/combat/combatSystem.js`, `src/game/warmCast.js`, `src/ui/gadgetIcons.js`, `src/ui/gadgetHud.js`, `src/ui/style.css`, `src/ui/prompts.js`, `src/game/game.js`
- Test: `tests/unit/batSwarm.test.js` (new), `tests/unit/prompts.test.js`

**Interfaces:**
- Consumes: Plan 4E's `chainEligible`, `chainCost`, `chainApi(ctx)` (`hold`, `release`, `stagger`, `finish`, `critical`, `word`, `events`), `combo.take`, the `chain` camera mode and `hud.critical(variant)`; `effects.batSwarm`, `effects.chainDiscount`.
- Produces: everything listed for `batSwarm.js` and `swarmFx.js`; `combat.swarm`; the `chain4` action routed to `startSwarm`; events `swarmStart`, `swarmDone`; hints `swarm-locked`, `swarm-cost`, `swarm-targets`; prompt `swarm`; `gadgetHud.setSwarm(state, keyLabel)`; speed-line variant `swarm`.

- [ ] **Step 1: Write the failing tests.** Create `tests/unit/batSwarm.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { SWARM, swarmTargets, swarmAvailability, swarmTimeline, createSwarmControl } from '../../src/combat/batSwarm.js';
import { createEvents } from '../../src/core/events.js';

const goon = (id, x, z, o = {}) => ({ id, type: 'grunt', def: {}, alive: true, down: false, air: false, aware: true, state: 'engage', pos: { x, y: 0, z }, ...o });
const O = { x: 0, y: 0, z: 0 };

describe('Bat Swarm rules', () => {
  it('is chain 4 on its own key, costing 15', () => {
    expect(SWARM).toMatchObject({ n: 4, id: 'swarm', cost: 15, action: 'chain4', reach: 10, maxTargets: 6, minTargets: 2 });
  });
  it('takes up to six eligible goons in 10 m, nearest first', () => {
    const list = [goon('far', 12, 0), goon('b', 3, 0), goon('a', 1, 0), goon('j', 2, 0, { type: 'joker', def: { boss: true } }), goon('ice', 2, 1, { state: 'frozen' }),
      ...[4, 5, 6, 7, 8].map((x) => goon(`g${x}`, x, 0.5))];
    expect(swarmTargets(O, list).map((e) => e.id)).toEqual(['a', 'b', 'g4', 'g5', 'g6', 'g7']);
    expect(swarmTargets(O, [goon('a', 1, 0)])).toBe(null);
    expect(swarmTargets(O, [goon('a', 1, 0), goon('b', 2, 0)], { canSee: (e) => e.id !== 'b' })).toBe(null);
  });
  it('hidden until owned; affordable at 15, or 13 with Efficient Chains', () => {
    const squad = [goon('a', 1, 0), goon('b', 2, 0)];
    expect(swarmAvailability({ owned: false, combo: 30, origin: O, enemies: squad })).toMatchObject({ show: false, affordable: false });
    expect(swarmAvailability({ owned: true, combo: 14, origin: O, enemies: squad })).toMatchObject({ show: true, affordable: false, cost: 15 });
    expect(swarmAvailability({ owned: true, combo: 15, origin: O, enemies: squad }).affordable).toBe(true);
    expect(swarmAvailability({ owned: true, combo: 13, origin: O, enemies: squad, discount: 2 })).toMatchObject({ affordable: true, cost: 13 });
    expect(swarmAvailability({ owned: true, combo: 3, origin: O, enemies: squad }).show).toBe(false);
  });
  it('the timeline holds, staggers each goon once, finishes, then ends', () => {
    const tl = swarmTimeline(3);
    expect(tl.steps.map((s) => s.kind)).toEqual(['hold', 'stagger', 'stagger', 'stagger', 'finish', 'end']);
    expect(tl.steps.filter((s) => s.kind === 'stagger').map((s) => s.index)).toEqual([0, 1, 2]);
    const at = tl.steps.map((s) => s.at);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(tl.duration).toBeCloseTo(1.94);
  });
});

describe('Bat Swarm control', () => {
  it('plays the timeline through the chain api and reports when done', () => {
    const calls = [];
    const events = createEvents();
    events.on('swarmDone', ({ count }) => calls.push(['done', count]));
    const api = {
      events,
      hold: (e) => calls.push(['hold', e.id]), release: (e) => calls.push(['release', e.id]),
      stagger: (e) => calls.push(['stagger', e.id]), finish: (e) => calls.push(['finish', e.id]),
      critical: () => calls.push(['critical']), word: (text) => calls.push(['word', text]),
    };
    const hero = { pos: { x: 0, y: 0, z: 0, clone() { return { ...this }; } }, bat: { animator: { play() {} } } };
    const targets = [goon('a', 1, 0), goon('b', 2, 0)];
    const ctl = createSwarmControl(hero, api, { targets, timeline: swarmTimeline(2), fx: null });
    expect(ctl).toMatchObject({ name: 'swarm', camera: 'chain', combat: true });
    let done = false;
    for (let i = 0; i < 200 && !done; i++) done = ctl.update(0.02);
    expect(done).toBe(true);
    const kinds = calls.map((c) => c[0]);
    expect(kinds.slice(0, 2)).toEqual(['hold', 'hold']);
    expect(kinds.filter((k) => k === 'stagger')).toHaveLength(2);
    expect(kinds.indexOf('release')).toBeLessThan(kinds.indexOf('finish'));
    expect(calls.at(-1)).toEqual(['done', 2]);
  });
});
```

Append to `tests/unit/prompts.test.js`:

```js
describe('promptText: Bat Swarm', () => {
  it('swarm shows its key', () => {
    const text = promptText('swarm', DEFAULT_BINDINGS);
    expect(text).toContain(keyLabel(DEFAULT_BINDINGS.chain4[0]));
    expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run tests/unit/batSwarm.test.js tests/unit/prompts.test.js`
Expected: FAIL.

- [ ] **Step 3: Write `src/combat/batSwarm.js`**

```js
// Bat Swarm: the fourth chain takedown (the last WayneTech Combat upgrade). At combo 15 (13 with
// Efficient Chains) Batman calls a swarm of bats down on up to six goons within 10 m: each is held
// and battered, then every one is knocked out (brutes knocked down). Pure rules and timeline, and
// the hero control that plays them through Plan 4E's chain api.
import { chainEligible, chainCost } from './chains.js';

export const SWARM = { n: 4, id: 'swarm', name: 'Bat Swarm', cost: 15, action: 'chain4', reach: 10, maxTargets: 6, minTargets: 2, maxRise: 2 };

const flat = (a, o) => Math.hypot(a.pos.x - o.x, a.pos.z - o.z);

export function swarmTargets(origin, enemies, { canSee = () => true, reach = SWARM.reach, max = SWARM.maxTargets, min = SWARM.minTargets, maxRise = SWARM.maxRise } = {}) {
  const list = enemies
    .filter((e) => chainEligible(e) && Math.abs(e.pos.y - origin.y) <= maxRise && flat(e, origin) <= reach && canSee(e))
    .sort((a, b) => flat(a, origin) - flat(b, origin))
    .slice(0, max);
  return list.length >= min ? list : null;
}

// Refreshed with Plan 4E's chain availability (every 0.1 s or on a combo change), never per frame.
export function swarmAvailability({ owned, combo, origin, enemies, discount = 0 }) {
  const cost = chainCost(SWARM, discount);
  if (!owned) return { show: false, affordable: false, cost };
  const affordable = combo >= cost && !!swarmTargets(origin, enemies);
  return { show: combo >= 6, affordable, cost };
}

export function swarmTimeline(count) {
  const steps = [{ at: 0, kind: 'hold', index: -1 }];
  for (let i = 0; i < count; i++) steps.push({ at: 0.45 + i * 0.18, kind: 'stagger', index: i });
  const fin = 0.45 + count * 0.18 + 0.35;
  steps.push({ at: fin, kind: 'finish', index: -1 });
  steps.push({ at: fin + 0.6, kind: 'end', index: -1 });
  return { steps, duration: fin + 0.6 };
}

export function createSwarmControl(hero, api, { targets, timeline, fx = null }) {
  let t = 0, next = 0;
  hero.bat.animator.play('Spell_Simple_Shoot', { once: true, timeScale: 0.8, fade: 0.08 });
  return {
    name: 'swarm', camera: 'chain', combat: true, targets,
    canChain: () => false,
    update(dt) {
      t += dt;
      while (next < timeline.steps.length && timeline.steps[next].at <= t) {
        const s = timeline.steps[next++];
        if (s.kind === 'hold') {
          for (const e of targets) api.hold(e);
          fx?.start(targets);
          api.word('SKREEEE!', hero.pos, true);
        } else if (s.kind === 'stagger') {
          const e = targets[s.index];
          if (e.alive) api.stagger(e);
        } else if (s.kind === 'finish') {
          fx?.rise();
          api.critical(targets[0], { slow: 1, scale: 0.25, variant: 'swarm' });
          for (const e of targets) { api.release(e); api.finish(e, { power: 1.6, launch: 3 }); }
          api.word('FLAP FLAP KRAKOOM!', targets[0].pos, true);
        } else {
          fx?.stop();
          api.events.emit('swarmDone', { count: targets.length });
          return true;
        }
      }
      return false;
    },
  };
}
```

- [ ] **Step 4: Write `src/game/swarmFx.js`**

```js
// The Bat Swarm: 60 inked bats in one instanced mesh, orbiting the held goons, then bursting up
// and away. Matrices are written from preallocated arrays; nothing is created after the build.
import * as THREE from 'three';
import { batOutline } from '../config/batShape.js';
import { PALETTE } from '../config/palette.js';

const N = 60;
let GEO = null;
function batGeo() {
  if (!GEO) GEO = new THREE.ShapeGeometry(new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x * 0.006, y * 0.006)))).rotateX(-Math.PI / 2);
  return GEO;
}
const batMaterial = () => new THREE.MeshBasicMaterial({ color: PALETTE.ink, side: THREE.DoubleSide });

export function createSwarmWarm() {
  const m = new THREE.InstancedMesh(batGeo(), batMaterial(), 1);
  m.name = 'swarmWarm';
  m.position.y = -50;
  return m;
}

export function createSwarmFx(scene) {
  const mesh = new THREE.InstancedMesh(batGeo(), batMaterial(), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), eul = new THREE.Euler();
  const phase = new Float32Array(N), radius = new Float32Array(N), height = new Float32Array(N), speed = new Float32Array(N);
  const owner = new Uint8Array(N), pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    phase[i] = Math.random() * Math.PI * 2;
    radius[i] = 0.7 + Math.random() * 0.8;
    height[i] = 0.4 + Math.random() * 1.8;
    speed[i] = (5 + Math.random() * 4) * (i % 2 ? 1 : -1);
  }
  let targets = [], mode = 0, t = 0;
  function hideAll() {
    m4.compose(p.set(0, -1000, 0), q.identity(), s.set(0, 0, 0));
    for (let i = 0; i < N; i++) mesh.setMatrixAt(i, m4);
    mesh.instanceMatrix.needsUpdate = true;
  }
  hideAll();
  scene.add(mesh);
  return {
    get active() { return mode !== 0; },
    start(list) { targets = list; mode = 1; t = 0; for (let i = 0; i < N; i++) owner[i] = i % list.length; },
    rise() {
      if (mode !== 1) return;
      mode = 2;
      for (let i = 0; i < N; i++) { vel[i * 3] = (Math.random() - 0.5) * 8; vel[i * 3 + 1] = 10 + Math.random() * 8; vel[i * 3 + 2] = (Math.random() - 0.5) * 8; }
    },
    stop() { mode = 0; targets = []; hideAll(); },
    update(dt) {
      if (!mode) return;
      t += dt;
      for (let i = 0; i < N; i++) {
        const j = i * 3;
        if (mode === 1) {
          const g = targets[owner[i]].pos, a = phase[i] + t * speed[i];
          pos[j] = g.x + Math.cos(a) * radius[i];
          pos[j + 1] = g.y + height[i] + Math.sin(t * 7 + i) * 0.15;
          pos[j + 2] = g.z + Math.sin(a) * radius[i];
          eul.set(0, -a, Math.sin(t * 20 + i) * 0.6);
        } else {
          vel[j + 1] += 6 * dt;
          pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
          eul.set(0, Math.atan2(vel[j], vel[j + 2]), Math.sin(t * 20 + i) * 0.6);
        }
        q.setFromEuler(eul);
        s.setScalar(mode === 2 ? Math.max(0.2, 1 - t * 0.2) : 1);
        mesh.setMatrixAt(i, m4.compose(p.set(pos[j], pos[j + 1], pos[j + 2]), q, s));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
```

- [ ] **Step 5: Combat.** In `src/combat/combatSystem.js`:
  - Import `import { SWARM, swarmTargets, swarmAvailability, swarmTimeline, createSwarmControl } from './batSwarm.js';`
  - Next to Plan 4E's `chainAvail`, add `let swarmAvail = { show: false, affordable: false, cost: SWARM.cost };`.
  - Add after Plan 4E's `startChain`:

```js
  // The Bat Swarm (chain 4, WayneTech). Returns true when the press is used up.
  function startSwarm(ctx) {
    if (!effects.batSwarm) { events.emit('hint', { id: 'swarm-locked' }); return true; }
    if (hero.state !== 'ground' || !hero.grounded) return false;
    const cost = chainCost(SWARM, getChainDiscount());
    if (combo.value < cost) { events.emit('hint', { id: 'swarm-cost', arg: cost }); return true; }
    const targets = swarmTargets(hero.pos, enemies, { canSee });
    if (!targets) { events.emit('hint', { id: 'swarm-targets' }); return true; }
    combo.take(cost);
    const timeline = swarmTimeline(targets.length);
    for (const e of alive()) {
      if (targets.includes(e)) continue;
      if (e.state === 'windup') { director.release(e.id); e.glyph = null; e.state = 'engage'; }
      director.hold(e.id, timeline.duration + 0.6);
    }
    hero.invulnerable = Math.max(hero.invulnerable, timeline.duration + 0.2);
    hero.control = createSwarmControl(hero, chainApi(ctx), { targets, timeline, fx: ctx.swarmFx ?? null });
    events.emit('swarmStart', { count: targets.length });
    return true;
  }
```

  - In `tryStart`, right after Plan 4E's chain check, add `if (action === 'chain4') return startSwarm(ctx);`.
  - Add `'chain4'` to `ACTIONS`.
  - In Plan 4E's availability refresh block in `update`, after the `chainAvail = ...` line, add:

```js
        swarmAvail = swarmAvailability({ owned: effects.batSwarm, combo: combo.value, origin: hero.pos, enemies, discount: getChainDiscount() });
```

  - Add to the returned object: `get swarm() { return swarmAvail; },`.

- [ ] **Step 6: Warm, HUD, prompts, hints and wiring.**
  - `src/game/warmCast.js`: import `import { createSwarmWarm } from './swarmFx.js';` and add `group.add(createSwarmWarm());` next to the gadget warm set.
  - `src/ui/gadgetIcons.js`: add

```js
export const SWARM_ICON = `<path class="fill" d="${batSvgPath(0.17, 14, 16)}"/><path class="fill" d="${batSvgPath(0.22, 31, 22)}"/><path class="fill" d="${batSvgPath(0.15, 17, 35)}"/>`;
```

  - `src/ui/gadgetHud.js`: import `SWARM_ICON`, and inside `createGadgetHud` add after `root.appendChild(el);`:

```js
  const swarm = document.createElement('div');
  swarm.className = 'gh-swarm hidden';
  swarm.innerHTML = `<svg class="g-ico" viewBox="0 0 48 48">${SWARM_ICON}</svg><b></b>`;
  root.appendChild(swarm);
  let lastSwarm = null, lastSwarmKey = '';
```

  and add to the returned object:

```js
    // The Bat Swarm icon beside Plan 4E's chain icons: shown once owned and the combo is up, lit
    // when affordable. combat.swarm is a new object only when it was refreshed.
    setSwarm(s, keyLabel) {
      if (s === lastSwarm && keyLabel === lastSwarmKey) return;
      lastSwarm = s;
      lastSwarmKey = keyLabel;
      swarm.classList.toggle('hidden', !s.show);
      swarm.classList.toggle('lit', s.affordable);
      swarm.querySelector('b').textContent = keyLabel;
    },
```

  - `src/ui/style.css`:

```css
.gh-swarm { position: absolute; left: 204px; top: 112px; width: 44px; height: 44px; background: var(--paper); border: 3px solid var(--ink); box-shadow: 3px 3px 0 var(--ink); transform: skewX(-12deg); opacity: 0.35; transition: opacity 0.3s; }
.gh-swarm.hidden { opacity: 0; }
.gh-swarm.lit { opacity: 1; background: var(--signal); animation: pop 0.18s ease-out; }
.gh-swarm svg { width: 100%; height: 100%; }
.gh-swarm .fill { fill: var(--ink); }
.gh-swarm b { position: absolute; right: -8px; bottom: -10px; font: 22px 'Bangers', cursive; color: var(--paper); -webkit-text-stroke: 1.5px var(--ink); paint-order: stroke fill; }
/* Bat Swarm finisher: dense ink speed lines, held longer. */
.hud-speed.swarm { background: repeating-conic-gradient(from 0deg at 50% 50%, rgba(11, 11, 18, 0) 0deg 2deg, rgba(11, 11, 18, 0.75) 2deg 3deg, rgba(11, 11, 18, 0) 3deg 6deg); }
.hud-speed.swarm.on { animation-duration: 1.3s; }
```

  The swarm element is appended to `root` (the `.hud` layer), not to `.ghud`, so `.gh-swarm` sits in the same box as Plan 4E's chain icons, right after the third.
  - `src/ui/prompts.js`: add to `ENTRIES`:

```js
  ['swarm', (k) => `Bat Swarm is ready: at a 15 hit combo, press ${k('chain4')} to call the bats down on up to six goons.`],
```

  - `src/game/game.js`:
    - Import `import { createSwarmFx } from './swarmFx.js';`; in `buildRun` after `gfx`: `const swarmFx = createSwarmFx(scene);`; add `swarmFx` to the `ctx` object (next to Plan 4E's `chainFx`); in `update` after `gfx.update(dt);`: `swarmFx.update(dt);`.
    - Add to `HINTS`:

```js
      'swarm-locked': () => 'The Bat Swarm is the last Combat upgrade in WayneTech, in the pause menu.',
      'swarm-cost': (cost) => `Not enough combo. The Bat Swarm needs ${cost}.`,
      'swarm-targets': () => 'The Bat Swarm needs two goons close by and in sight.',
```

    - Next to Plan 4E's `chainLabels`, add `let swarmLabel = '4';`; in the throttled hint block, `swarmLabel = bindingLabel(settings.bindings, 'chain4');`; right after Plan 4E's `hud.setChains(...)`: `gadgetHud.setSwarm(combat.swarm, swarmLabel);`.
    - `events.on('upgradeBought', ({ id }) => { if (id === 'swarm') prompts.show(['swarm']); });` and add `swarmStart: 'swarm'` to `PROMPT_DONE`.

- [ ] **Step 7: Run the tests**

Run: `npx vitest run`
Expected: PASS, including Plan 4E's chain tests (`CHAINS` still has three entries; the swarm is separate).

- [ ] **Step 8: Scripted play.**

```bash
cat > "$TEMP/g5-t24.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.wayne ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.__hints = []; G.events.on('hint', (d) => G.__hints.push(d.id)); 'hooked'"},
 {"press": "Digit4", "wait": 300},
 {"eval": "window.__game.__hints"},
 {"eval": "const G = window.__game; G.wayne.award(5000, 'test'); for (const id of ['reflexes', 'flow', 'efficient', 'fastFinish', 'swarm']) G.wayne.buy(id); const h = G.hero.pos; G.enemies.slice(0, 4).forEach((e, i) => e.pos.set(h.x - 3 + i * 2, h.y, h.z - 4)); for (let i = 0; i < 13; i++) G.combat.combo.hit(); 'ready'", "wait": 250},
 {"eval": "const G = window.__game; [G.combat.swarm.affordable, G.combat.swarm.cost, document.querySelector('.gh-swarm').className]"},
 {"shot": "t24-icon"},
 {"eval": "const G = window.__game; G.__log = []; G.events.on('swarmStart', (d) => G.__log.push(['start', d.count])); G.events.on('swarmDone', (d) => G.__log.push(['done', d.count])); 'armed'"},
 {"press": "Digit4", "wait": 600},
 {"shot": "t24-swarm"},
 {"eval": "window.__game.hero.control?.name ?? null", "wait": 2200},
 {"shot": "t24-finish"},
 {"eval": "const G = window.__game; [JSON.stringify(G.__log), G.enemies.map((e) => [e.type, e.state, e.alive])]"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1" "$TEMP/g5" "$(cat "$TEMP/g5-t24.json")"
```

Expected: before the upgrade, `Digit4` hints `swarm-locked`; after it, `[true,13,"gh-swarm lit"]` (Efficient Chains makes it 13) and `t24-icon.png` shows a yellow bat icon with `4` beside the chain icons; `t24-swarm.png` shows a cloud of ink bats circling the goons and `SKREEEE!`; `hero.control` is `swarm` during it; `t24-finish.png` shows the bats bursting up, the action camera and dense speed lines; the log reads `start n` then `done n`, and every chained goon is `ko`/`false` (a brute `down`/`true`); `no console errors`.

- [ ] **Step 9: Commit**

```bash
git add src/combat/batSwarm.js src/game/swarmFx.js src/combat/combatSystem.js src/game/warmCast.js src/ui/gadgetIcons.js src/ui/gadgetHud.js src/ui/style.css src/ui/prompts.js src/game/game.js tests/unit/batSwarm.test.js tests/unit/prompts.test.js
git commit -m "Bat Swarm: the fourth chain takedown, unlocked by WayneTech"
```

---

### Task 25: Performance: a gadgets page in the fps sweep, and load time

**Files:**
- Modify: `scripts/fps-sweep.mjs`

**Interfaces:**
- Consumes: everything above; `?gadgets=all`; `window.__game.gadgets`, `wayne`, `breakables`.
- Produces: a `gadgets` page (`ONLY=gadgets`) with rows `g:wheel`, `g:batarang`, `g:remote`, `g:gel`, `g:smoke`, `g:launcher`, `g:claw`, `g:freeze`, `g:popper`, `g:swarm`, `g:breakables`.

- [ ] **Step 1: Add the page.** In `scripts/fps-sweep.mjs`, add `gadgets` to the header comment's scenario list, and before `await b.close();` add:

```js
if (!only || only === 'gadgets') {
  const { p, errors } = await openGame('fight=test&god=1&gadgets=all');
  await p.waitForTimeout(1500);
  await skipComic(p);
  await label(p, 'warmup');
  await p.waitForTimeout(5000);
  // Fresh goons in front of Batman on the GCPD roof, every gadget ready.
  const fresh = (id) => p.evaluate((id) => {
    const g = window.__game, h = g.hero.pos;
    g.hero.teleport({ x: 6, y: 42, z: 10 }, Math.PI);
    g.follow.snapBehind(Math.PI, 0.15);
    const list = ['grunt', 'grunt', 'knife'].map((t, i) => g.spawn(t, { x: 4 + i * 2, y: 42, z: 5 }));
    g.combat.setEnemies([...g.combat.enemies.filter((e) => e.alive), ...list]);
    for (const e of list) e.wake();
    g.gadgets.equip(id);
    g.gadgets.state.tick(30);
  }, id);
  const row = async (id, name, act, hold = 3000) => {
    await fresh(id);
    await p.waitForTimeout(300);
    await label(p, name);
    await act();
    await p.waitForTimeout(hold);
  };
  // The wheel: open it, walk the pick through all eight slots, close.
  await label(p, 'g:wheel');
  await p.keyboard.down('Tab');
  for (const k of ['Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit1']) { await p.keyboard.press(k); await p.waitForTimeout(250); }
  await p.keyboard.up('Tab');
  await p.waitForTimeout(1000);
  await row('batarang', 'g:batarang', () => p.keyboard.press('KeyR'));
  await row('remote', 'g:remote', () => p.keyboard.press('KeyR'), 3800);
  await row('gel', 'g:gel', async () => {
    for (let i = 0; i < 3; i++) { await p.keyboard.press('KeyR'); await p.waitForTimeout(250); }
    await p.keyboard.down('KeyR'); await p.waitForTimeout(500); await p.keyboard.up('KeyR');
  });
  await row('smoke', 'g:smoke', () => p.keyboard.press('KeyR'), 6500);
  await row('launcher', 'g:launcher', async () => {
    await p.evaluate(() => { const g = window.__game; g.teleport({ x: 152, y: 0.15, z: 72 }); g.hero.bat.face(-Math.PI / 2); g.follow.snapBehind(-Math.PI / 2, 0.1); });
    await p.waitForTimeout(600);
    await p.keyboard.press('KeyR');
  });
  await row('claw', 'g:claw', () => p.keyboard.press('KeyR'));
  await row('freeze', 'g:freeze', async () => { await p.keyboard.press('KeyR'); await p.waitForTimeout(700); await p.mouse.click(640, 360); });
  await row('popper', 'g:popper', () => p.keyboard.press('KeyR'), 7000);
  await row('batarang', 'g:swarm', async () => {
    await p.evaluate(() => {
      const g = window.__game;
      g.wayne.award(20000, 'sweep');
      for (const id of ['reflexes', 'flow', 'efficient', 'fastFinish', 'swarm']) g.wayne.buy(id);
      for (let i = 0; i < 15; i++) g.combat.combo.hit();
    });
    await p.waitForTimeout(200);
    await p.keyboard.press('Digit4');
  }, 3500);
  // Breakables: a cracked wall and a glass sign go (first debris, first collision removal).
  await label(p, 'g:breakables');
  await p.evaluate(() => {
    const g = window.__game, w = g.breakables.items.find((i) => i.id === 'wallMonarchBooth');
    g.teleport({ x: w.center.x - 5, y: 0.15, z: w.center.z }); g.hero.bat.face(Math.PI / 2); g.follow.snapBehind(Math.PI / 2, 0.15);
  });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const g = window.__game; for (const id of ['wallMonarchBooth', 'glassNeonNorth']) g.breakables.smash(g.breakables.items.find((i) => i.id === id), g.hero.pos); });
  await p.waitForTimeout(2500);
  if (shots) { await label(p, 'shot'); await p.screenshot({ path: `${shots}/gadgets.png` }); }
  all.push(...await collect(p, 'gadgets'));
  meta.errorsGadgets = errors;
  await p.close();
}
```

- [ ] **Step 2: Run the sweep on the owner's laptop.** Build to `$TEMP/g5dist`, preview on 5208 (vsync-free Edge is launched by the script), then:

```bash
OUT="$TEMP/sweep-g5.json" node scripts/fps-sweep.mjs http://localhost:5208/ high
```

Expected: every `g:*` row has p95 at or under 6.9 ms; `hitches >25ms after warmup: 0`; no older row is worse than before this plan (compare with the previous sweep in the PR notes). If a hitch lands in a `g:*` row:
  - Look at its `at` time and the row. A first-use hitch means something compiled or uploaded: find which material, geometry or texture was drawn for the first time (the popper's Points, the swarm's instanced bats, a breakable's canvas texture) and put a copy in `createGadgetWarm()` or `createSwarmWarm()`, or make sure `begin()`'s `drawEverything` sees it (it must be in the scene, even if hidden, before `begin()`).
  - A steady high p95 means per-frame work: check the row's handler for allocation in `update` (a closure, `filter`, `map`, `clone`) and for DOM writes every frame.
  Rerun until clean.

- [ ] **Step 3: Load time.**

```bash
node scripts/load-time.mjs http://localhost:5208/ 40 1
```

Expected: `firstFrame` under 3.2 s, and `compiled` no more than 60 ms later than before this plan (the warm cast grew by about ten small draws). The smoke texture (128 px) and the tiny warm texture are the only canvases drawn at boot; if `compiled` grew more, measure `createGadgetWarm()` alone and cut what is slow.

- [ ] **Step 4: Commit**

```bash
git add scripts/fps-sweep.mjs
git commit -m "fps sweep: a gadgets page with a row per gadget, the wheel, the swarm and breakables"
```

---

### Task 26: Scripted play for the upgrades, and browser tests

**Files:**
- Create: `tests/e2e/gadgets.spec.js`

**Interfaces:**
- Consumes: everything above.
- Produces: an in-game check of every upgrade's number; three Playwright tests.

- [ ] **Step 1: Every upgrade, in the game.** Build, preview, then:

```bash
cat > "$TEMP/g5-t26.json" <<'EOF'
[
 {"eval": "new Promise((r) => { const f = () => (window.__game.wayne ? r('ok') : setTimeout(f, 100)); f(); })"},
 {"eval": "window.__game.comic.playing && window.__game.comic.skip()", "wait": 1500},
 {"eval": "const G = window.__game; G.wayne.award(20000, 'test'); const all = ['plating1','kevlar','plating2','medic','dampers','reflexes','flow','efficient','fastFinish','swarm','triple','bigBang','quickSmoke','doubleClaw','deepFreeze','accelerator','aero','grip','rails','seismic']; for (const id of all) G.wayne.buy(id); [G.progress.wayne.owned.length, G.hero.maxHealth, G.combat.combo.readyAt]", "wait": 300},
 {"eval": "const G = window.__game, t = G.hero.tuning; [t.boostUp, t.boostOut, t.diveGain, t.glideMax, t.wallRunTime, t.ladderSlide, t.diveRadius]"},
 {"eval": "const G = window.__game; for (let i = 0; i < 4; i++) G.combat.combo.hit(); 'combo 4'", "wait": 250},
 {"eval": "JSON.stringify(window.__game.combat.chains.costs)"},
 {"eval": "const G = window.__game; G.gadgets.equip('smoke'); G.gadgets.state.use('smoke'); G.gadgets.state.status('smoke').total"},
 {"eval": "const G = window.__game, h = G.hero.pos; G.gadgets.equip('batarang'); G.enemies.slice(0, 3).forEach((e, i) => e.pos.set(h.x - 2 + i * 2, h.y, h.z - 8)); G.hero.bat.face(Math.PI); G.follow.snapBehind(Math.PI, 0.1); G.__n = 0; G.events.on('batarangThrow', (d) => { G.__n = d.count; }); 'three ahead'", "wait": 300},
 {"press": "KeyR", "wait": 900},
 {"eval": "window.__game.__n"},
 {"eval": "const G = window.__game, h = G.hero.pos; G.gadgets.equip('claw'); G.gadgets.state.tick(5); const [a, b] = G.enemies.filter((e) => e.alive && e.type !== 'brute'); a.pos.set(h.x - 0.5, h.y, h.z - 8); b.pos.set(h.x + 0.5, h.y, h.z - 10); G.__claw = 0; G.events.on('clawYank', (d) => { G.__claw = d.count; }); 'two in line'", "wait": 300},
 {"press": "KeyR", "wait": 900},
 {"eval": "window.__game.__claw"},
 {"eval": "const G = window.__game, h = G.hero.pos, e = G.enemies.find((x) => x.alive && !x.down && x.type !== 'brute'); G.gadgets.equip('freeze'); G.gadgets.state.tick(30); e.pos.set(h.x, h.y, h.z - 6); 'aim'", "wait": 300},
 {"press": "KeyR", "wait": 700},
 {"eval": "const e = window.__game.enemies.find((x) => x.state === 'frozen'); e ? +e.frozenT.toFixed(1) : null"},
 {"eval": "window.__game.winFight(); 'won'", "wait": 2500},
 {"eval": "const G = window.__game; G.events.emit('heroHurt', { damage: 0 }); G.hero.health = 50; 'hurt'", "wait": 4000},
 {"eval": "Math.round(window.__game.hero.health)"}
]
EOF
node scripts/dev-play.mjs "http://localhost:5208/?fight=test&god=1&gadgets=all" "$TEMP/g5" "$(cat "$TEMP/g5-t26.json")"
```

Expected, in order: `[20,150,6]`; `[19,11,1.3,56,1.8,14,6]`; `"[4,7,10]"`; smoke total `7`; the batarang throws `3`; the batclaw yanks `2`; the frozen goon reads about `7.4` (8 s minus the flight); after 4 s calm, health is at least `68` (Field Medic: 2.5 s wait, then 12 per second; the hurt event is sent before health is set, because `?god=1` refills health on every hurt). The armor numbers (Kevlar, Dampers), the counter window, Steady Flow and the wall-run arc are covered by `combatHooks.test.js` and `traverseTuning.test.js`; the gel radius by the Task 15 run (both goons at 3 m go down, with 4 m or 5.5 m). No console errors.

Then the traversal upgrades by feel, with the dev server and a person at the keys (not scriptable in a useful way): with all traversal upgrades bought, a grapple boost clears a roof edge about a storey higher, a wall run carries visibly further, and a ladder slide is fast. With none bought, nothing differs from before this plan.

- [ ] **Step 2: Write `tests/e2e/gadgets.spec.js`**

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
  await page.waitForFunction(() => window.__game?.gadgets && window.__game?.wayne, null, { timeout: 90000 });
  await page.evaluate(() => window.__game.comic.playing && window.__game.comic.skip());
  await page.waitForTimeout(800);
}

test('the gadget wheel opens on Tab, 3 picks gel, and no chain fires', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'fight=test&god=1&gadgets=all');
  await page.keyboard.down('Tab');
  await page.waitForTimeout(300);
  await expect(page.locator('.gwheel.show')).toBeVisible();
  expect(await page.evaluate(() => window.__game.time.held)).toBeCloseTo(0.2);
  await page.keyboard.press('Digit3');
  await page.keyboard.up('Tab');
  await page.waitForTimeout(300);
  await expect(page.locator('.gwheel.show')).toHaveCount(0);
  expect(await page.evaluate(() => [window.__game.gadgets.state.equipped, window.__game.hero.control?.name ?? null])).toEqual(['gel', null]);
  await expect(page.locator('.ghud .gh-name')).toHaveText(/Explosive Gel/i);
  expect(errors).toEqual([]);
});

test('explosive gel opens the Monarch booth and the balloon inside', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=toMonarch&god=1&new=1&gadgets=all');
  await page.evaluate(() => {
    const G = window.__game;
    G.gadgets.equip('gel');
    G.teleport({ x: 152.5, y: 0.15, z: -60 });
    G.hero.bat.face(Math.PI / 2);
    G.follow.snapBehind(Math.PI / 2, 0.15);
  });
  await page.waitForTimeout(800);
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyR');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyR');
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__game.progress.gadgets.broken)).toContain('wallMonarchBooth');
  await page.evaluate(() => window.__game.hero.teleport({ x: 158.3, y: 0.15, z: -60 }, Math.PI / 2));
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.progress.balloons)).toContain(6);
  expect(errors).toEqual([]);
});

test('a WayneTech purchase shows on the page and survives a reload', async ({ page }) => {
  const errors = await collectErrors(page);
  await boot(page, 'at=toNeon&god=1&new=1');
  await page.evaluate(() => window.__game.wayne.award(1000, 'test'));
  await expect(page.locator('.hud-card.show')).toContainText('LEVEL 2');
  await page.keyboard.press('Escape');
  await page.locator('.pause-menu .mbtn', { hasText: 'WayneTech' }).click();
  await expect(page.locator('.wt-menu')).toBeVisible();
  await page.locator('.wt-card.buyable', { hasText: 'Reinforced Plating' }).click();
  await expect(page.locator('.wt-card.owned', { hasText: 'Reinforced Plating' })).toBeVisible();
  expect(await page.evaluate(() => window.__game.hero.maxHealth)).toBe(125);
  await boot(page, 'at=toNeon&god=1');
  expect(await page.evaluate(() => [window.__game.wayne.xp, window.__game.progress.wayne.owned, window.__game.hero.maxHealth])).toEqual([1000, ['plating1'], 125]);
  expect(errors).toEqual([]);
});
```

- [ ] **Step 3: Run the browser tests** against the frozen build:

```bash
BASE_URL=http://localhost:5208 npx playwright test tests/e2e/gadgets.spec.js
```

Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/gadgets.spec.js
git commit -m "Browser tests: gadget wheel, gel on the Monarch booth, WayneTech purchase persists"
```

---

### Task 27: Full verification (the coordinator runs this)

**Files:**
- Modify: `scripts/playthrough.mjs` (gadget and XP report), `scripts/webkit-check.mjs` (the wheel)

- [ ] **Step 1: Unit tests.** `npx vitest run`. Every test passes, including the fourteen new test files.

- [ ] **Step 2: Browser tests.** Build to `$TEMP/g5dist`, preview on 5208, then `BASE_URL=http://localhost:5208 npx playwright test`. All tests pass: smoke, Plan 3C's content tests and `gadgets.spec.js`.

- [ ] **Step 3: No dashes in player-visible text.**

```bash
grep -nP "[\x{2013}\x{2014}]" src/gadgets/*.js src/gadgets/g/*.js src/progress/*.js src/world/breakableSpots.js src/world/breakables.js src/combat/batSwarm.js src/ui/gadgetWheel.js src/ui/gadgetHud.js src/ui/gadgetIcons.js src/ui/menus.js src/ui/prompts.js src/core/bindings.js src/game/game.js
```

Expected: no output.

- [ ] **Step 4: Placements.** `node scripts/breakables-check.mjs http://localhost:5208/` prints 15 `ok` lines.

- [ ] **Step 5: The full playthrough, with gadgets.** In `scripts/playthrough.mjs`, right after the suit is picked (after the `if (!start) ...click()` line), add:

```js
await page.waitForFunction(() => window.__game?.gadgets, null, { timeout: 60000 });
await page.evaluate(() => {
  const G = window.__game;
  G.__unlocked = [];
  G.events.on('gadgetUnlocked', ({ id }) => G.__unlocked.push(id));
});
```

and before `await browser.close();`:

```js
const report = await page.evaluate(() => ({ unlocked: window.__game.__unlocked, wayne: { xp: window.__game.wayne.xp, level: window.__game.wayne.level }, gadgets: window.__game.progress.gadgets.unlocked }));
console.log('gadgets unlocked in order:', JSON.stringify(report.unlocked));
console.log('saved gadget unlocks:', JSON.stringify(report.gadgets), 'wayne:', JSON.stringify(report.wayne));
```

Run: `BASE=http://localhost:5208/ OUT="$TEMP/pt5" node scripts/playthrough.mjs`
Expected: it ends at `credits` with no console errors; the unlock order is `["claw","gel","smoke","remote","launcher","freeze","popper"]` (the popper when the credits close); the saved list holds all seven; WayneTech XP is above 3,000 (the scripted run wins fights with `winFight`, so it earns KOs, fights, objectives and cutscene steps but no combos or balloons).

- [ ] **Step 6: fps sweep, all pages.** On the owner's laptop: `OUT="$TEMP/sweep-final.json" node scripts/fps-sweep.mjs http://localhost:5208/ high`. Every row (main, fight with Plan 4E's chain row, boss, Plan 3C's side page and this plan's gadgets page) has p95 at or under 6.9 ms and there are no hitches over 25 ms after warmup. Repeat once with `low`.

- [ ] **Step 7: Load time.** `node scripts/load-time.mjs http://localhost:5208/ 40 1`: `firstFrame` under 3.2 s.

- [ ] **Step 8: WebKit.** In `scripts/webkit-check.mjs`, after the `play.png` screenshot, add:

```js
  await p.keyboard.down('Tab');
  await p.waitForTimeout(600);
  const wheel = await p.evaluate(() => [window.__game.gadgets.wheelOpen, !!document.querySelector('.gwheel.show')]);
  console.log('wheel', JSON.stringify(wheel));
  await p.screenshot({ path: `${out}/wheel.png` });
  await p.keyboard.up('Tab');
```

Run: `node scripts/webkit-check.mjs http://localhost:5208/ "$TEMP/wk5"`
Expected: `wheel [true,true]`, `wheel.png` shows the comic-panel wheel drawn correctly (Safari renders the conic-gradient cooldown and the text strokes), and no console errors.

- [ ] **Step 9: Look at every screenshot** from Tasks 7 to 26 in `$TEMP/g5`. Every gadget reads at a glance in the comic look: ink outlines, no untextured grey boxes, no z-fighting on the sheds, no debris sinking through floors, sky lettering readable left to right. Copy the best of each (`t13-wheel-gel`, `t14-remote-fly`, `t15-kablooey`, `t16-smoke`, `t17-line`, `t18-yank`, `t19-shatter`, `t20-sky-letters`, `t23-waynetech`, `t24-finish`) to `docs/screens/g5-*.png`.

- [ ] **Step 10: Commit**

```bash
git add scripts/playthrough.mjs scripts/webkit-check.mjs docs/screens/g5-*.png
git commit -m "Playthrough reports gadget unlocks and XP; WebKit checks the wheel; gadget screenshots"
```

- [ ] **Step 11:** The coordinator reviews the screenshots, the sweep and the playthrough report, then merges and pushes `main`. No task pushes.
