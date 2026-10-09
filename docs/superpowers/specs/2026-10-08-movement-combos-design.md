# Movement Combos: how you move picks the strike

Owner request (2026-10-08): "spamming LMB shouldn't be all ... combos based on which keys are being
pressed ... intuitive", "just the movement keys ... WASD + Shift + Space with the combat buttons",
"Shift + Space + E should be a run and jump roundhouse kick", more punch styles, more kick styles
with a focus on brutal. Approved scheme: the table below.

## Input model

Only movement keys and the two attack buttons. No new bindings.

- **Direction** is read relative to the goon being attacked (not the camera), from the move input
  at the moment of the press:
  - `none`: no move input.
  - `toward`: within 50 degrees of the line to the target (also what freeflow steering produces).
  - `away`: more than 130 degrees from it.
  - `left` / `right`: anything between, split by the sign of the cross product.
  `toward` and `none` behave the same (WASD steering keeps working: pushing at a goon still leaps
  to him with the normal rotation).
- **Shift** counts when sprint is held at the press, or the hero is moving faster than 8 m/s.
- **Space** is not read as a key. It counts when the hero is airborne at the press (a jump, then
  the attack). "Shift + Space" = airborne from a sprinting takeoff (`h.airFromSprint`, set when
  she leaves the ground at sprint speed).
- A **downed goon** as the target overrides everything (stomp / hammer).
- Precedence when several apply: downed goon, then air (Shift + Space, then Space + away, then
  Space), then Shift, then direction (away, left/right), then the rotation.

## Move table

| Input | Move | Mixamo source (name [description]) | Effect |
|---|---|---|---|
| LMB, none/toward | Punch rotation (11) | existing 6 + Hook [Mid Hook Punch To The Body], Hook [Short Hook Punch To The Head], Lead Jab [Mid Body Jab], Boxing [Boxing Lead Hand Uppercut], Illegal Elbow Punch [Illegal Elbow To The Head] | As now; never the same clip twice running; 4th = punch finisher |
| E, none/toward | Kick rotation | Kick_Front, Kicking [Male Thrust Kick With The Rear Foot] (push kick), Kick_Low (leg kick, sweeps grunts), Illegal Knee [Muay Thai Illegal Knee] | Push kick shoves the goon 3 m; 3rd = kick finisher |
| LMB, left/right | Hook from that side | Hook [Long Hook Punch To The Head] (mirrored for left) | `spin` reaction |
| E, left/right | Roundhouse from that side | Roundhouse Kick [Roundhouse Kick With Front Foot Advancing] (mirrored for left) | `spin` reaction, power 1.4 |
| LMB, away | Spinning backfist | Punch_Backfist (code-posed, kept) | heavy, launch 4.5 |
| E, away | Spinning back kick | Kicking [Spinning Back Kick Advancing] | crit + impact frame, launch 5 |
| Shift + LMB | Running uppercut | Surprise Uppercut [Attacker Chase Down Give Surprise Uppercut] | pops the goon up for a juggle |
| Shift + E | Flying knee | Flying Knee Punch Combo [Jumping Knee Followed By A Punch] (trimmed to the knee) | launch 6, crit |
| Space + E | Aerial crescent (axe) kick | Inside Crescent Kick [Aerial 360 Degree Front Side Rotation Kick With Rear Foot] | floors the goon (knockdown), crit |
| Space + LMB | Hammer drop | existing airSlam | unchanged |
| Shift + Space + E | Running jump roundhouse | Hurricane Kick [Flying Hurricane Kick] | launch 7, crit, biggest kick |
| Shift + Space + LMB | Leaping double-fist smash | Mutant Jump Attack [Mutant Jump Attack To Idle] | knockdown, crit |
| Space + away + E | Backflip kick | Flip Kick [Flipping Backwards To Kick] | launch 8 |
| E, downed goon | Stomp | Stomp [Hard Floor Stomp] | ground finisher (`BADOOM!` family word) |
| LMB, downed goon | Hammer fist | existing Punch_Hammer | unchanged |

Kept as they are: counter (RMB), dodge, grab/throw (G), chain takedowns (1-4), gadgets, beatdowns,
the 4-punch and 3-kick finisher counts, impact frames, hit-stop table (new moves map onto the
existing STOP kinds: rotation = punch/kick, side = kick, away/running/air = heavy or finisher).

## Architecture

- **`src/combat/moveSelect.js` (new, pure):** `classifyDir(moveVec, toTarget)` returns
  `none|toward|away|left|right`. `selectMove({ action, dir, sprint, air, airFromSprint,
  targetDown, has })` returns `{ id, clip, mirror, kind, power, launch, crit, react, word, stop }`
  or `null` (fall through to today's rotation). One table (`MOVES`) holds every row above, so the
  Help page reads the same data. `has(clip)` skips a move whose clip the build lacks.
- **`src/combat/strikeChoice.js`:** bigger `PUNCH_TIERS` (the 5 new punches) and `KICKS` (push
  kick, knee).
- **`src/combat/combatSystem.js`:** the strike path asks `selectMove` first; a hit uses the move's
  numbers through the existing `landHit`. Air kicks get an `airKick()` control alongside `airSlam()`
  (lunge to the target from the air, land with the clip's contact frame on the hit, then drop).
  Running moves reuse `approach()` with a longer reach. Mirrored clips are separate `_L` clips
  baked by `retarget-mocap.mjs ~mirror` (no runtime mirroring).
- **`src/actors/hero.js`:** records `h.airFromSprint` at takeoff.
- **`src/actors/enemy.js`:** `stomped` reaction on a downed goon (short bounce, stays down); push kick
  knockback.
- **HUD:** the first time each special move lands, its name pops in comic letters ("FLYING KNEE!",
  "HURRICANE!"). Help (H) gets a Moves page built from `MOVES`.
- **Assets:** new entries in `MIXAMO_CLIPS` (scripts/mixamo-fetch.mjs), then fbx2glb and
  retarget-mocap as before; `MOCAP_SPEED` / `MOCAP_START` per clip so each lands about 0.15-0.3 s
  after the press (air and running moves up to 0.4 s).

## Testing

- Unit: `classifyDir` angles and edges; `selectMove` for every table row plus the `has()` fallback;
  strikeChoice rotation still never repeats; assets test covers the new clips.
- Clip sheets (`scripts/clip-sheet.mjs`) of every new clip, contact frame checked by eye.
- A scripted fight (headless, muted) that performs each row with real key presses and logs the clip
  played and the move id: every row must fire.
- Release gates as usual: vitest, e2e, playthrough to credits, WebKit, live smoke after deploy.

## Out of scope

Story-flow work (separate design next). Named multi-press strings (dropped in favour of the
movement scheme). New bindings.
