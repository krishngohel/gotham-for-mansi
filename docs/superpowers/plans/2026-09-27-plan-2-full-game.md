# Plan 2: The Full Game

> **For agentic workers:** executed inline with superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. Pure modules are test-first (Vitest); visual modules are verified with `scripts/dev-shot.mjs` / `dev-action.mjs` screenshots on the real GPU.

**Goal:** Turn the approved look test into the complete game in the spec (revision 2): title to credits, three districts plus the Joker boss, full traversal and freeflow combat with block/counter/kick/jump-kick, settings with key rebinding, clear guidance, a rich city, synthesized audio, verified on the production build in Chrome, Edge and Firefox.

**Architecture:** `src/game/game.js` replaces the look-test controller and owns the frame loop and a small state machine (`title`, `play`, `cutscene`, `paused`, `credits`). Systems talk through plain objects passed in a per-frame `ctx`, not globals. All rules that can be pure are pure and tested: bindings, settings, save, collision, grapple picking, targeting, combo, attack director, damage rules, objectives. The map is data (`src/world/mapData.js`) turned into merged meshes and collision boxes by `cityBuilder.js`. Audio is built in parallel in `src/audio/` against a fixed API.

**Tech Stack:** unchanged (three 0.186, vite 8, vitest 5, playwright-core).

## Global Constraints

- Everything from Plan 1's constraints still applies (palette-only colors, no AI assets, no em dashes in player-facing copy, commits solely by Krishn Gohel, desktop only).
- 60 fps at 1080p on the RTX 4060 on High; Low preset playable on integrated graphics.
- At most 4 real point lights near the player at once; everything else is emissive + halo sprites.
- Every player-facing key hint reads the live bindings (never hard-coded key names).
- Debug URL params: `?at=<checkpointId>`, `?god=1`, `?skipIntro=1`, `?cam=...` (look-test presets keep working on the title scene), `?fight=<id>`.
- `window.__game` exposes state for automated checks (`state`, `objective`, `hero`, `enemies`, `fps`, helpers `teleport(id)`, `winFight()`, `setObjective(i)`).

## Phases

### Phase A: Foundations
- [ ] **A1 Bindings** `src/core/bindings.js`: `ACTIONS` (`{ id, label, group }` for move/jump/sprint/punch/kick/block/cape/batarang/grapple/dodge/special/detective/help/pause), `DEFAULT_BINDINGS` (`{ [action]: string[] }`, codes like `KeyE`, `Space`, `Mouse0`), `keyLabel(code)`, `rebind(bindings, action, code)` (moves the code off any other action). Tests: defaults cover every action, rebind removes duplicates, labels (`Mouse0` -> `LMB`, `KeyE` -> `E`, `ShiftLeft` -> `Shift`).
- [ ] **A2 Settings and save** `src/core/settings.js` (`DEFAULT_SETTINGS`, `sanitizeSettings(raw)`, `loadSettings(storage)`, `saveSettings(storage, s)`) and `src/core/save.js` (`DEFAULT_PROGRESS`, `sanitizeProgress`, `loadProgress`, `saveProgress`). Storage access wrapped in try/catch. Tests: round-trip, junk input falls back to defaults field by field, out-of-range numbers are clamped.
- [ ] **A3 Input rewrite** `src/core/input.js`: action-based over keyboard, mouse (pointer lock), and Gamepad API. `createInput({ target, bindings })` -> `{ down(a), pressed(a), released(a), move: {x, y}, look: {dx, dy}, setBindings(b), captureNext(cb), endFrame(), device }`. `captureNext` powers the rebinding screen.
- [ ] **A4 Collision** `src/world/collision.js` (pure): axis-aligned boxes in a spatial hash; `addBox`, `resolveCylinder(pos, radius, height, vel)` -> `{ grounded, groundY, hitWall }` (step-up 0.45 m), `groundBelow(x, y, z, r)`, `raycast(origin, dir, maxDist)`. Tests: stands on a box top, slides along a wall, steps up a curb, falls off an edge, ray hits the nearest box.
- [ ] **A5 Game shell** `src/game/game.js` + `src/main.js`: boot, asset load with progress, state machine, resize, fixed-step simulation (`createFixedStep` in `src/core/loop.js`, tested), render. Look-test presets keep working on the title scene.

### Phase B: The city
- [ ] **B1 Map data** `src/world/mapData.js`: hand-placed hero buildings for each district plus seeded filler; streets; harbor; checkpoints; fight zones; balloon spots; district bounds. District layout per the spec (GCPD center, Docks south, Neon Row east, Ace Chemicals north-west, clock tower north).
- [ ] **B2 City builder** `src/world/cityBuilder.js`: merged facade meshes per material (brick, stone, deco, dark) with window textures, cornices, setbacks and spires; roofs with parapets; streets with lane marks and sidewalks; collision boxes; auto grapple points along roof edges.
- [ ] **B3 Props** `src/world/props/`: water tower, AC, vents, chimneys, skylights, antennas (blinking), billboards and neon signs (canvas-painted, glowing), fire escapes, wires between roofs, streetlamps, parked cars, cranes, containers, freighter, lighthouse, vats and pipes, smokestacks, gargoyles, clock tower with clock face, cathedral.
- [ ] **B4 Living city** `water.js` (ink-ripple harbor with light streaks), `traffic.js` (moving cars along streets), `particles.js` (steam, rain splashes, sparks, fireworks), `lightPool.js` (nearest-4 real lights), blimp with searchlight, sky searchlights.
- [ ] **B5 Verify** screenshots from each district; 60 fps on High.

### Phase C: Traversal
- [ ] **C1 Hero controller** `src/actors/hero.js`: states idle/run/sprint/jump/fall/glide/dive/land-roll/grapple/zip/vault/climb plus combat states driven by the combat system. Camera-relative movement, coyote time, jump buffer.
- [ ] **C2 Glide** hold jump in the air; pitch from camera (look down to dive and gain speed, up to slow); cape spreads (cape wind input); dive-bomb when attacking over an enemy.
- [ ] **C3 Grapple** `src/world/grapple.js` (pure `pickGrapplePoint(points, camPos, camDir, heroPos, opts)`, tested): prompt icon at the chosen point, fire pose, zip, vault or grapple boost into a glide.
- [ ] **C4 Camera** `src/game/camera.js`: orbit with collision pull-in (raycast), sprint/glide FOV kick, combat framing, shake scaled by the setting.
- [ ] **C5 Verify** scripted run: GCPD roof -> glide to a Docks roof -> grapple up a warehouse.

### Phase D: Combat
- [ ] **D1 Pure rules** `src/combat/rules.js` (damage, health, windup by difficulty, block reduction, which moves each enemy type ignores), `targeting.js` (`selectTarget`), `combo.js` (`createCombo`), `director.js` (`createDirector({ maxWindups: 2 })`). All tested.
- [ ] **D2 Kick clips** `src/actors/kicks.js`: front kick, roundhouse, flying kick authored as keyframe clips from the idle rest pose; verified visually.
- [ ] **D3 Enemies** `src/actors/enemy.js`: grunt, knife goon (knife mesh, parry), brute (1.25x, hockey mask, charge, red glyph); states idle/alert/approach/circle/windup/attack/recover/hit/stunned/down/getup/ko; separation; variety in masks and colors.
- [ ] **D4 Combat system** `src/combat/combatSystem.js`: punch chains, kick, jump-kick, block, counter and double counter, cape stun, batarang, dodge vault, special takedown, ground takedown, beatdown, hit-stop, slow-mo last hit, SFX words, damage and death.
- [ ] **D5 Verify** arena fight via `?fight=test`: screenshots of block, counter, kick, jump-kick, takedown.

### Phase E: Game flow and guidance
- [ ] **E1 Objectives** `src/game/objectives.js` (pure runner over step data, tested) + `src/game/story.js` (the full step list and cutscene scripts).
- [ ] **E2 Encounters** `src/game/encounters.js`: spawn on zone entry, waves, completion, refill, restart on death, reward beats.
- [ ] **E3 Guidance UI**: waypoint marker with distance and edge arrow, beacon column, tutorial prompts with live key labels, controls help overlay, grapple prompt, detective highlights.
- [ ] **E4 Balloons** `src/game/balloons.js` + message cards; 12 placed; gold suit unlock. `mansi.config.js` gains 12 default messages + final message; test enforces 12 non-empty.
- [ ] **E5 Checkpoints and save** progress saved at checkpoints and fight ends; Continue on the title screen.

### Phase F: Joker boss
- [ ] **F1 Joker** character: purple suit, green hair, white face, red grin, coat tails (verlet); taunts in speech balloons.
- [ ] **F2 Phases** balcony + goon waves + joy-buzzer tiles; gas grenades + batarang stun + 5 strikes x3; counter chains x3 + finishing takedown. Boss health bar.

### Phase G: Menus, cutscenes, finale
- [ ] **G1 Menus** `src/ui/menus.js`: title (Continue / New game / Settings / Credits), suit select, pause, settings tabs (Controls rebinding, Camera, Video, Audio, Gameplay), controls help, credits.
- [ ] **G2 Comic cutscenes** `src/ui/comic.js`: panel pages from posed 3D shots + canvas art, captions, speech balloons; intro, three district rewards, boss intro, boss end, death panel.
- [ ] **G3 Finale** signal text swap to HAPPY BIRTHDAY MANSI, fireworks, cake with candles, balloons released, dance, Happy Birthday music, credits roll with the final message.

### Phase H: Audio integration
- [ ] **H1** Wire `src/audio` (built in parallel) into every event: moves, hits, UI, weather, music modes per state, combat intensity.

### Phase I: Ship quality
- [ ] **I1 Performance** High/Low presets measured in each district; render-scale setting.
- [ ] **I2 Browsers** production build served by `vite preview`, smoke-tested in Chromium, Firefox and Edge via Playwright; WebGL2-missing message.
- [ ] **I3 Full playthrough** automated route through every objective with `window.__game` helpers, then manual-feel fixes.
- [ ] **I4 Docs** README with how to play, how to edit `mansi.config.js`, how to deploy (deploy itself waits for the user).
