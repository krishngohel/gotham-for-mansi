# Gotham for Mansi: impact frames (Part I)

Date: 2026-09-28. Status: design approved by the owner in chat ("Both, scaled by hit"; "Yes, go").

The owner asked for impact frames. The game already has one: on every `critical` event, `inkPipeline.impact(cx, cy)` turns on the ink shader's `uImpact` branch (black and white ink, radial speed lines from the hit) for **2 rendered frames**. On the owner's laptop at 144 fps that is about 14 ms, which is effectively invisible. This part makes impact frames time-based and scales them with the size of the hit.

It is the first of three new parts: I (impact frames), J (sidekicks: Nightwing as a tag-team partner, Commissioner Gordon on the radio with GCPD backup), and K (the Batmobile: ride, chases, races, then battle mode). J and K get their own specs. The birthday theme stays.

## I1. Two tiers

Every impact frame is timed in **real milliseconds**, not rendered frames or game time. Hit-stop and slow motion never stretch it.

**Tier 1, flash.** Triggers:
- every `critical` event
- a critical counter
- the last hit of any fight (`lastHit`)

What it looks like:
- **Beat 1 (45 ms):** full impact look, `uImpact = 1`: inverted black and white, heavy ink edges, radial speed lines centred on the target's chest.
- **Beat 2 (45 ms):** half strength, `uImpact = 0.5`, then back to normal.

**Tier 2, panel freeze.** Triggers:
- a chain takedown's finisher (Plan 4E)
- the Bat Swarm's finisher (Plan 5FG)
- the special takedown
- the final blow of a story fight
- a Joker phase-ending hit

Silent stealth takedowns never trigger either tier. They stay quiet.

A tier 2 moment runs in this order:
- **Beat 1 and beat 2**, as in tier 1.
- **Freeze, 300 ms real time.** Game time holds at scale 0 through the existing `time.hold` / `time.release`, and the impact look sits at 0.35. A comic panel overlay appears:
  - a thick ink border inset from the screen edge and rotated 2 to 4 degrees (random sign);
  - a halftone burst centred on the target;
  - the moment's sound word, already placed by `placeWord`, stays on top.
- **Release, 120 ms.** The overlay scales down slightly and fades out, and the impact look eases to 0. The existing action camera and slow motion then continue as they do today.

If a tier 2 trigger and a tier 1 trigger arrive for the same hit (for example `critical` plus a chain finisher), tier 2 wins and only one sequence plays.

## I2. Safety and settings

- **Rate limits.**
  - A tier 1 flash can start at most once every 0.4 s.
  - A tier 2 freeze can start at most once every 1.5 s. A tier 2 trigger inside that window plays as tier 1, if tier 1 is allowed.
  - These limits keep full-screen flashing under 3 per second.
- **Where it never plays.** Menus, pause, photo mode, comics and cutscenes. A pending sequence is cancelled and any hold released when the game pauses or photo mode opens.
- **The setting.** "Impact frames" becomes a three-way choice:
  - **Full:** as above.
  - **Soft:** no inversion. The speed lines and a pale paper vignette appear at 0.6 strength. Tier 2 still freezes and shows the panel, but without the flash beats.
  - **Off:** nothing. Tier 2 still gets the existing slow-motion camera, with no freeze or panel.
- **Migration.** `SETTINGS_REV` goes from 2 to 3. The old boolean maps `true` to `'full'` and `false` to `'off'`. A missing value defaults to `'full'`.

## I3. Architecture

- **`src/render/impactTimeline.js` (new, pure).** `createImpactTimeline({ now })` provides:
  - `trigger(tier, at)`: returns false when rate-limited.
  - `sample(tMs)`: returns `{ impact, freeze, panel }`, the shader strength, whether game time is held, and the panel progress from 0 to 1.
  - `cancel()`.

  It owns the beat table, the tier priority and the rate limits. Tests cover beat timings, tier priority, rate limits, cancel, and the Soft and Off modes.
- **`src/render/inkPipeline.js`.** The `impactFrames` frame counter is replaced by a uniform value set from the timeline each frame. The shader branch already takes a strength, since it mixes by `uImpact`. There is no new shader program.
- **`src/ui/impactPanel.js` (new).** Builds one pre-built DOM overlay at boot: the border and the halftone burst, in CSS. Its class and transform change only when the panel state code changes.
- **`src/game/game.js` wiring.**
  - Maps events to tiers: `critical`, `lastHit` and crit counters to tier 1; `chainFinish`, `swarmFinish`, `special`, story-fight `lastHit` and `bossPhaseHit` to tier 2. Where an event doesn't exist yet on main, the plan names the branch that adds it and wires it at that merge.
  - Samples the timeline in the frame loop with real time.
  - Drives `time.hold('impact', 0)` and releases it.
  - Cancels on pause and photo mode.
- **`src/core/settings.js` and `src/ui/menus.js`.** The three-way setting and the rev 3 migration.
- **Performance.**
  - No per-frame allocation: the timeline writes into one reused sample object.
  - The overlay is built at boot and warmed with the rest of the HUD.
  - The fps sweep's fight and chain rows stay at p95 ≤ 6.9 ms with no frame over 25 ms after 5 s. A freeze is deliberate stillness, so the sweep measures frame time, not game progress.

## I4. Testing

- **Unit tests:** the timeline module and the settings migration.
- **Browser checks on a frozen build:**
  - A scripted critical, with screenshots at beat 1, beat 2 and 60 ms after the flash.
  - A scripted special takedown, with screenshots mid-freeze (panel visible) and after release.
  - Soft and Off captured the same way.
  - Pause during a freeze must release the hold.
  - The Safari engine check.
- **Regression:** the full playthrough to the credits, the fps sweep, and the load-time check (first frame near 3 s).

## Constraints (carried over)

- Art is authored in code, and there are no new asset files.
- No em dashes or en dashes in player-visible text.
- Commits are authored by Krishn Gohel only, with no trailers.
- Push only verified work. Main redeploys the live site.
- Order: this ships after the queued releases (4E, then 5FG, then 6D). The tier 2 triggers from 4E and 5FG are wired when this branch is cut from a main that contains them, or at their merge.
