# QA: Prologue, Act 1, Act 2 (playtest of the merged `night` build)

Worktree `gotham-interior`, branch `interior`, after `git merge --no-ff night` (clean, no
conflicts). Frozen build served on port 5287, every test browser muted
(`--mute-audio --ignore-gpu-blocklist --use-angle=d3d11`).

Method: every step below was loaded directly with `?at=<stepId>&god=1&new=1` (one canvas click
first to lock the pointer, per the playtest convention), then checked by hand and by script:
objective text, waypoint distance/site, the site's own ground clearance vs. its declared `y`
(`collision.groundBelow`), the hero's ground clearance at the checkpoint it respawned at, radio/
dialogue text, console errors, and a screenshot. All 41 steps: **zero console errors**, and every
site and every respawn point sits on solid ground within the same tolerance `course-check.mjs`
uses (no floating, no sinking). `npx vitest run` after the merge: 988/988 green. `course-check.mjs`,
`breakables-check.mjs`, `stealth-check.mjs`: all green against the merged, frozen build.

A note on reading this list: `?at=<id>` respawns the hero at that step's own checkpoint (or the
nearest earlier one), the same logic a real death/reload uses. For a few steps with no checkpoint
of their own (`crasherRooftop`, `n3`, `aceBattle`), that puts the test hero well behind the actual
action (see notes) — a real player passing through normally is already there. That is a property of
the checkpoint chain, not a per-step bug, and is called out once below rather than on every line.

## Prologue

- `intro` — ok. Comic cutscene reads well, no dashes, Joker's lines land.
- `signal` — ok. Objective and waypoint (site `signal`) both sound and correct.
- `card` — ok. Short, clear beat.
- `gordonRadio` — ok. Radio panel (portrait + name + text) shows and reads well.
- `crasherIntro` — ok. Crasher line lands; radio panel readable.
- `actOneTitle` — ok (cutscene). My test script's setup click also dismissed the title card before
  the screenshot, so the captured frame is already `toDocks`; the title card itself was not missed,
  it is a test-script artifact, not a game bug.

## Act 1: Docks and Neon Row

- `toDocks` — ok. Waypoint to `wh3Roof` (200 m), glide tutorial shown, readable.
- `alfredRadio` — ok. Radio panel readable.
- `batmobileChase` — ok to load (no errors, Alfred's line plays); full chase completion not
  re-verified here (per the coordinator, the Batmobile builder is already on `aceBattle`; this one
  was not flagged as broken and loads/plays cleanly).
- `f1` — ok. Goons visible, waypoint diamond at 17 m, punch tutorial shown, nothing clipped.
- `toYard` — ok. Site `yard` grounds correctly (0.15, matches).
- `f2` — ok. 3 goons, fps dipped to ~52 in combat (expected, not a hitch).
- `toShip` — ok. Waypoint to `freighter` (9), reachable.
- `f3` — ok. 3 goons on the freighter deck, readable, no clipping.
- `presents` — ok. Collect radius correct, pickup reachable.
- `rewardPresents` — ok. Cutscene text reads well ("Lucky break, birthday bat!...").
- `toNeon` — ok. Waypoint to `gazetteRoof`.
- `n1` — ok. 3 goons, cape/kick tutorial shown.
- `toStreet` — ok. Waypoint to `neonStreet` (ground level, matches).
- `n2` — ok. 4 goons on the neon street; fps ~48-49 in combat (busy scene, still fine); readable
  despite the neon reflections.
- `toMonarch` — ok. Waypoint to `monarchRoof`.
- `n3` — ok. 4 goons, special-move tutorial shown.
- `crasherRooftop` — ok, with a note. Neither `crasherRooftop` nor `n3` declares its own
  `checkpoint`, so the checkpoint chain falls back to `toMonarch`'s (`neonStreet`). A player who
  goes down during this beat (unlikely — it is a few seconds of narration) respawns at street level
  and has to re-climb and re-clear `n3`. Not a blocker, worth a `checkpoint: 'monarchRoof'` on one
  of these two someday. Story-owned file (`src/game/story.js`); reported, not changed.
- `monarchBalcony` — ok. Predator-room stealth prompt reads well, crates/lamp visible, waypoint 14 m.
- `party` — ok. Collect site correct, reachable from `monarchRoof`.
- `rewardParty` — ok. Cutscene reads well.
- `aceClueRadio` — ok. Gordon's lines read well, correct next-step tease ("Ace Chemicals. Of
  course it is Ace Chemicals.").

## Act 2: Ace Chemicals

- `actTwoTitle` — ok (cutscene; same test-script click artifact as `actOneTitle` above).
- `toAce` — ok. Waypoint to `aceYard`, ground matches.
- `aceBattle` — loads clean (Alfred's line plays, no errors). Per the coordinator, its completion
  is a known issue already being fixed by the Batmobile builder; not tested further here.
- `a1` — ok. Brute + 2 grunts, cape-stun tutorial shown.
- `toFactory` — ok. Waypoint to `factoryRoof` (61 m), reachable from the yard.
- `a2` — ok. 4 goons on the factory's sawtooth roof deck; the deck (from the earlier sawtooth fix)
  is intact and walkable, nothing sank into the teeth.
- `toVat` — ok. Waypoint to `vatDeck`.
- `harleyRadio` — ok. Harley's lines read well and are clearly her voice.
- `harleyFight` — ok, and a nice surprise: `HARLEY_FIGHT` resolves to `harleyHall` at
  `SITES.aceHall`, which now exists (this worktree's own room), so the fight plays inside the real
  Ace Hall interior — posts, green vat glow and all — instead of the flat yard. No entry step walks
  the player through the hall's actual loading-dock door first (the fight's respawn point places
  the hero straight inside via the same offset logic every fight uses), so the room is reached by
  teleport, not by walking through the door. Not broken — the room's own collision and lighting are
  live either way — just a missed opportunity for a "the hall door's dead ahead" beat, and it
  touches `src/game/fights.js`/`story.js` (Story-owned). Reported, not changed.
- `a3` — ok. Cake-defense wave (brute + 2 goons), readable.
- `aceCatwalks` — ok. Stealth prompt reads well, rifle-goon waypoint correct.
- `cake` — ok. Collect site correct, 7 m from the checkpoint.
- `rewardCake` — ok. Cutscene reads well, sets up the boss.
- `crasherReveal` — ok. Nightwing reveal lines read well and land the joke.

## One real (minor) UI bug found

- **The dialogue panel (`.dlg-panel`, bottom-left radio/crasher lines) can overlap the "N% Complete"
  progress card**, also bottom-left. Seen on `crasherReveal`'s and `aceCatwalks`'s screenshots: the
  Crasher's name tag and first line sit half behind the progress card. `hud.js` already has an
  "avoid" system that keeps some elements off the objective card; the dialogue panel and the
  progress card do not currently dodge each other. This is in `src/ui/hud.js` / `src/ui/radio.js`
  (not this worktree's files) — reported rather than fixed, since it needs a real layout decision
  (which one yields) rather than a one-line change.

## Fixes made

None needed. No wrong site ids, no typos, no placement bugs (floating/sinking/clipping) were found
in the 41 steps covered. This worktree's own files (`src/world/interiors.js`, `mapData.js`,
`cityBuilder.js`, `cityLife.js`, `src/game/world.js`) came through the merge byte-for-byte
unchanged (`git diff` against the pre-merge commit is empty), and the merge itself had no
conflicts, so there was nothing here to repair.

## Commits

- `Merge night into interior` — the merge itself (no conflicts, no manual resolution needed).
- This file.
