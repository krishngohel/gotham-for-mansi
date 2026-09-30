# Part N: Nightwing — report

Branch `nightwing`, worktree `C:\Users\awsom\Documents\Projects\gotham-nightwing`, based on main `b13c946`.

## What works

- **Nightwing's look** (`src/actors/nightwingChar.js`): the male hero body (`hero_m.glb`) painted
  in code, black suit with a bright-blue chevron running from the collar down the chest and the
  whole of both arms to the fingers, a blue domino mask, black short hair, and two thin
  blue-glowing escrima sticks rigidly held in his hands. Verified in the browser: unmistakable at
  gameplay distance (screenshots below).
- **Ally mode** (`nightwing.spawn(p, 'ally')`): picks a goon nobody else is fighting, runs to it
  on the existing `Walk_Loop`/`Jog_Fwd_Loop` clips, strikes with `Punch_Jab`/`Punch_Cross`/
  `Kick_Front` and lands the hit through `combat.gadgetApi.landHit`, so it gets a real sound word,
  hit-stop, screen shake and KO check exactly like Batman's own hits. Dodges (`Roll`) when a goon
  winds up within reach, and staggers instead of taking real damage when one attacks close to him
  (he cannot die: there is no health field on him at all). Never takes Batman's own target unless
  it is the last goon standing (approximated: Batman's "current target" is his nearest aware,
  standing enemy).
- **Team takedown**: while both fighters are within 3 m of the same goon and the combo is 5+,
  pressing Special (KeyX) plays `critical(target, { impact: 2 })` (the impact-frame camera shot),
  then instantly KOs the goon and emits `teamTakedown`. The press is swallowed for that one frame
  via `ctx.lockInput` so Batman's own special move doesn't also fire from the same key press.
  Verified live in the browser: the `TEAM UP!` word and the impact-shot both fire
  (`nw-team-takedown.png`).
- **Crasher mode** (`nightwing.spawn(p, 'crasher')`): a dark hooded cloak and purple party mask
  over the same suit, holding a wrapped gift box. He is not in `combat.enemies`, so Batman
  structurally cannot target or hit him — "dodges any attack" falls out for free. `crasherFlee(to)`
  plays an eased run-and-rise (a simple arc, no cable mesh — the hero's own grapple cable belongs
  to `hero.js` and wasn't safe to reuse from here under tonight's clock) that ends by emitting
  `crasherEscaped` and despawning. A taunt card ("Too slow, birthday girl!") is shown via
  `hud.card()` from a `crasherTaunt` event.

## API as built

- `src/allies/nightwing.js`: `createNightwing({ assets, scene, collision, events, combat, hero, rng, ctx })`
  returns `{ spawn(p, mode), despawn(), actor, update(dt), crasherFlee(to) }`, exactly the Part N
  contract. `actor` is the live character object (`ch`) or `null` when not spawned. `ctx` is
  optional: pass the same frame `ctx` object `combat.update(dt, ctx)` receives so a team takedown
  can read `ctx.input.pressed('special')` and set `ctx.lockInput` for one frame; without it, ally
  mode still works but the team takedown key is simply never checked.
- Events: `teamTakedown { target }`, `crasherEscaped`, plus `crasherTaunt { text }` (consumed in
  game.js to show the caption card; not part of the Part N contract but harmless to ignore).
- `src/allies/nightwingLogic.js`: pure helpers — `pickAllyTarget`, `canTeamTakedown`,
  `nearestThreat`, `fleeStep` — all plain numbers/records, no three.js, no allocation beyond a
  single manual loop.
- `src/actors/nightwingChar.js`: `createNightwingCharacter(assets, mode)` — the visual. Exported
  `classifyNightwingVertex`/`NIGHTWING_COLORS` for reuse/tests if another part wants them.
- `src/actors/characters.js`: additive-only change — exported `makeCharacter`, `paintRegions`,
  `rigidMesh` (previously private) so nightwingChar.js can reuse the hero rig/foot-planting/
  vertex-paint machinery without duplicating it. No existing behavior changed.
- `src/game/game.js`: one marked hook block (`---- Part N: Nightwing ----`) creates `nightwing`
  right after `ctx` is built, wires the two event listeners, and calls `nightwing.update(dt)` in
  the frame loop between `stealth.update(dt)` and `combat.update(dt, ctx)` (so a team-takedown
  lock lands before combat reads `ctx.lockInput` that same frame). `window.__game.nightwing` is
  exposed via the existing `api` object.
- `src/game/warmCast.js`: both looks (`ally` and `crasher`) are drawn once off-screen at boot
  alongside the rest of the throwaway cast, so materials/shaders are warmed before first spawn.

## Scope-down decisions (read this)

- **Paint approach**: the spec offered two options — a runtime canvas texture on the body's UVs,
  or a `paint-suits.mjs`-style script writing a baked `.webp`. I used neither directly; I used the
  *third* code-painting path already live in this codebase for the gold suit: per-vertex region
  classification baked into vertex colors (`paintRegions`, in `characters.js`), posterized by the
  toon material. It is exactly "the code-painting approach used for the hero suits" (one of the
  two the hero suits actually use today), just the simpler variant. Given the clock, building a
  full UV rasterizer pass for a brand-new body paint (the `paint-suits.mjs` path) was out of
  scope; this reads clearly as Nightwing at gameplay distance in every screenshot taken tonight.
- **"If damaged he just staggers"**: goon AI (`enemy.js`) only ever targets `ctx.hero`, i.e.
  Batman — it has no notion of Nightwing at all, and I did not touch `enemy.js` (shared by every
  other part; editing it risked the other four worktrees). So there is no real hit registration
  on him. What ships: a proximity-based simulation — if an enemy is in its `'attack'` state within
  1.3 m of him, he plays a stagger reaction — which delivers the visible behavior asked for
  without a health system or a shared-file change. He cannot die because he has no health field at
  all, not because damage is capped at zero.
- **Batman's "current target"**: the hero has no such field (freeflow combat is a per-swing
  target pick). Approximated as his nearest aware, standing enemy within melee reach; good enough
  to keep Nightwing off whoever Batman is actually trading blows with.
- **Grapple cable for the flee**: the spec allowed "a simple line" if the hero's cable wasn't easy
  to reuse. I went simpler still: an eased arc (ease-out lerp plus a sine rise) with no visible
  cable mesh at all, since there wasn't time to build and warm a second line renderer safely. The
  flee itself, the taunt, and the despawn-on-arrival all work.

## Tests

- `npx vitest run`: **885 passed** (866+ requirement met), including the 19 new tests in
  `tests/unit/nightwingLogic.test.js`:
  - `pickAllyTarget`: nearest live/standing/non-boss goon; skips downed/dead; never the Joker;
    never a `def.boss`; avoids Batman's current target; shares it when it's the last goon; `null`
    with nothing to fight.
  - `canTeamTakedown`: radius and combo-threshold gating, both directions, custom
    radius/threshold.
  - `nearestThreat`: nearest match in the given state set, radius cutoff, dead/wrong-state
    exclusion (backs the dodge/stagger checks).
  - `fleeStep`: starts at the origin, ends exactly at the target, monotonic progress, arcs above a
    straight line partway through.
- No full-integration Vitest harness for `createNightwing` itself: it needs a real skinned
  `hero_m.glb` body (bones, skin weights) for `createNightwingCharacter`, which isn't something a
  Vitest harness can fake cheaply — the spec's own scoping ("unit tests for the pure parts")
  matches what's here.

## Browser verification (frozen build)

Build: `npx vite build --outDir "$TEMP/ndist"` — clean, 181 modules, no errors. Preview:
`npx vite preview --outDir "$TEMP/ndist" --port 5285 --strictPort`, stopped by PID afterward.
Driven with `scripts/dev-play.mjs` against `?fight=test&god=1` (first canvas click spent only on
re-locking the pointer, per instructions). All runs: **no console errors**.

Screenshots (saved to
`C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\n\`):

- `nw-ally-fight.png` — Nightwing (center, blue chevron/mask/black hair clearly readable) engaged
  with the fight=test squad alongside Batman.
- `nw-team-takedown.png` — the team takedown firing: the `TEAM UP!` word, the critical
  impact-frame shot, Nightwing following through his strike on the goon Batman is also next to.
  `window.__nwEvents` confirmed `teamTakedown` fired.
- `nw-crasher-close.png` — the Party Crasher disguise (hooded cloak, purple mask) standing apart
  from Batman on the GCPD roof, gift box in front.
- `nw-crasher-flee-a.png` — mid-flee, rising past the taunt card (`PARTY CRASHER / Too slow,
  birthday girl!`).
- `nw-crasher-gone.png` / a later frame — he's gone; `window.__nwEvents` confirmed `escaped`
  (`crasherEscaped`) fired and `nightwing.actor` is `null` after.

One framing gap: my scripted camera (`follow.snapBehind`) put the standing Crasher a bit into
shadow against a dark building in the "close" shot, and the flee arc moves him out of the fixed
test camera's frame quickly (only his legs are visible over the taunt card in `nw-crasher-flee-a`).
The mechanism (position, taunt, despawn, event) is confirmed correct by both the screenshots and
the captured event log; a real player's own follow camera (which reacts to input, unlike my
scripted one) will track him far better than my fixed test rig did.

## fps sweep

`ONLY=fight NW=1 node scripts/fps-sweep.mjs http://localhost:5285/ high` (added a `NW=1`-gated,
off-by-default hook in `scripts/fps-sweep.mjs` that spawns Nightwing as an ally into the existing
fight scenario — every other scenario/part is untouched):

```
fight    med  3.3  p95  4.6  max  12.9  fps 303  calls 467  tris 956098
hitches >25ms after warmup: 1 [{"page":"fight","l":"chain","ms":70.6,"at":18.9}]
```

p95 4.6 ms, inside the 6.9 ms budget. The one >25 ms hitch is in the `chain` phase (a fresh set of
goons despawned/respawned for each chain takedown test, which is the existing "first draw builds
bone textures" cost already documented in `enemy.js`/`game.js`'s spawn comments) — unrelated to
Nightwing, who isn't touched during that phase.

## Gaps / what I'd do with more time

- No baked UV suit texture (`nightwing_m.webp`) — the vertex-paint suit is a deliberate,
  documented scope-down, not an oversight.
- No real damage/stagger hookup from actual enemy attacks (proximity-simulated only), since that
  would mean editing the shared `enemy.js`.
- No dedicated grapple-cable mesh for the flee, just a positional arc.
- Camera framing in my own scripted verification wasn't great for the Crasher; not a game bug.
