# Gotham for Mansi: traversal, comic look, and side content

Date: 2026-09-28. Status: design approved in chat, spec awaiting review.

Extends the shipped game (spec revision 2, `2026-09-27-gotham-for-mansi-design.md`). The live site
redeploys on every push to `main`, so each part ships only after its own tests, scripted runs,
playthrough and perf check pass.

The work ships in three parts, in this order:

- **Part A. Comic city.** A stronger living-graphic-novel look across the whole city.
- **Part B. Traversal.** Ladders, ledge grab and shimmy, ziplines, wall runs and the dive bomb.
- **Part C. Content.** Challenges, street crimes, photo mode and a progress tracker.
- **Part D. Predator stealth.** Armed goons, vision cones, perches and silent takedowns, plus
  two stealth rooms added to the story.

Parts C and D both depend on B, because the rooftop run needs the new moves and the stealth rooms
use perches and ledges. A and B don't depend on each other.

## Part A. Comic city

The goal is that any screenshot reads as a panel from a printed comic, not a toon-shaded 3D game.
Almost all of it lives in the ink post-process and the sky, so the cost is a few texture reads per
pixel, not more geometry.

### A1. Ink line quality (`inkPipeline.js`)
- **Variable line weight.** Silhouette and depth edges get a thick brush line that tapers with
  distance. Interior crease lines (normal edges) get a thin pen line. This is two thresholds on the
  existing edge terms, blended by type.
- **Hand-drawn wobble.** The edge sample UVs are offset by low-frequency noise, fixed in screen space
  and re-rolled every few frames ("boiling line", like animated comics). There's a Settings toggle,
  on by default and off on Low.
- **Ink on colour boundaries.** A luma Sobel on the colour pass adds thin lines where flat colours
  meet, such as window frames, signs and road markings, so painted detail gets inked too.

### A2. Shading like a colourist (`inkPipeline.js`, `toon.js`)
- **Cross-hatching.** In the darkest toon band, diagonal hatch lines are drawn. In the deepest
  shadow they turn into cross-hatch. Lines are anchored to screen space with a slight wobble and fade
  out with distance so they never shimmer into grey.
- **Ben-Day dots in the mid tones as well as shadow.** Mid-tone surfaces get a light dot tint of
  their own hue, shadows keep the current dark dots, and the sky gets big dots that grade toward
  the horizon.
- **Flat colour.** A stronger posterize pass: each district gets a limited palette of five or six
  swatches in `palette.js` (GCPD steel blue, Docks rust and teal, Neon Row magenta and acid green,
  Ace sick green and purple, cathedral stone and candle amber). Colours snap to the nearest swatch
  with a soft blend, so districts look inked by different colourists.
- **Print misregistration.** A subtle one-pixel cyan and magenta offset at colour edges. Off on Low.
- **Paper.** A faint paper-fibre texture and a slightly warm paper white in the lightest tones.

### A3. Comic sky and weather (`sky.js`, `skyline.js`, `rain.js`)
- **Painted clouds.** Bold flat cloud shapes with inked outlines drift slowly, lit from below by the
  city glow. The moon becomes a big flat disc with concentric halo rings.
- **Light as flat shapes.** The Batsignal beam and searchlights become flat graphic wedges with hard
  edges and a dot fill, not soft additive glow.
- **Ink rain.** Rain streaks are drawn as short slanted ink dashes, denser in the foreground.
  Splashes become little comic splash marks.
- **Lightning.** A flash turns the frame to black and white ink for two frames, and a "KRAKOOM"
  lettered word appears in the sky.

### A4. Comic storytelling on screen (`hud.js`, `camera.js`, new `src/ui/fx.js`)
- **Impact frames.** On critical hits and finishers, a single frame inverts to black and white ink
  with radial speed lines, then play snaps back.
- **Action panels.** When the action camera fires, the view gets a jagged, tilted panel border and
  a thin white gutter, as if cut into a new panel.
- **Speed lines.** Streaks at the edge of the screen while gliding fast, diving, zipping or wall
  running. They grow with speed.
- **World lettering.** Hand-lettered sound words for traversal and the world: "THUD" on hard
  landings, "ZZZIP" on ziplines, "FWOOSH" on dive bombs, "KRAK" when glass breaks. They use the
  existing `hud.sfx` and are placed at the world position.
- **Caption boxes.** Objective updates and radio call-outs use yellow comic caption boxes with a
  slight tilt, matching the current objective card.

### A5. City art (`textures.js`, `cityBuilder.js`, `districts.js`)
- **Hatched facades.** Facade textures get hatching baked into the faces turned away from the moon,
  and flat black cast-shadow shapes under ledges, cornices, awnings and fire escapes.
- **Inked details.** Brick and stone courses are drawn as sparse ink ticks, not full grids (the
  comic shorthand for brick).
- **Signature silhouettes.** Each district gets 2 to 3 bold landmark shapes on the skyline so it
  reads at a glance, with gargoyles on the cathedral and deco towers. Gargoyles are also grapple
  perches.
- **Posters and graffiti.** More Joker graffiti and posters that tell the story ("WHERE'S THE CAKE,
  BAT?"). All of it is lettered by Fable, in the game font.

### A6. Performance and settings
- Everything in A1 and A2 stays in the one ink pass. Low turns off wobble, misregistration,
  mid-tone dots and hatching distance, and falls back to today's look.
- New Settings toggles: "Line wobble" and "Impact frames". Both are on by default; the second is a
  comfort option.
- Target: no scene drops more than 10% fps on High against the current build, measured A/B on
  production builds.

## Part B. Traversal

Each move lives in its own module under `src/actors/traverse/` (`ladder.js`, `ledge.js`,
`zipline.js`, `wallrun.js`, `divebomb.js`). Each exports `canEnter(ctx)`, `enter(ctx)`,
`update(ctx, dt)` and `exit(ctx)`. `hero.js` only routes to the active module, so it doesn't grow.
Ladders and ziplines come from a list in `src/world/climbables.js` that the city builder fills.
Ledges are detected on the fly from the collision boxes. Traversal adds no new keys. The only new
actions in this spec are Crouch (D2) and Photo mode (C3).

### B1. Ladders
- **Where:** every fire escape gets a drop ladder from the street to the first landing and a roof
  ladder from the top landing. Fire-escape landings become solid platforms; landings between them
  are connected by short ladders at alternating ends instead of walkable stair step boxes (a
  45-degree stair of step boxes jittered underfoot and blocked the landing, so the visual stairs
  stay as scenery). The ladders on water towers and dock cranes become climbable.
- **Getting on:** walk into the bottom of a ladder facing it, or walk off the top toward it. You
  also catch a ladder if you drift into it while falling.
- **Controls:**
  - Forward and back climb up and down, at a speed synced to the animation.
  - Sprint slides down fast.
  - Jump kicks off backward, and you can glide from there.
  - Reaching the top pulls you onto the roof or landing (`ClimbUp_1m`).
- **Rules:**
  - The camera eases back to show the wall.
  - Being hit knocks you off.
  - Enemies don't start fights with you while you're on a ladder.

### B2. Ledge grab and shimmy
- **Grab:** while falling or gliding slowly, a probe checks for a collision box top between 1.2 m
  and 2.2 m above the feet, directly ahead, with 1.9 m of headroom above it. If all of that holds,
  you snap to hang.
- **Setting:** "Auto ledge grab", on by default.
- **Controls:**
  - Left and right shimmy along the edge. At an outside corner of the box, holding the direction
    wraps you around it onto the next face. At an inside corner, you stop.
  - Forward or Jump pulls up.
  - Back or Sprint drops.
  - Jump while holding back kicks off into a backflip.
- **Grapple:** aiming the grapple at a roof edge with no perch now shows a "Ledge" point. Grappling
  to it leaves you hanging.

### B3. Ziplines
- **Where:** about 8 hand-placed cables across the longest roof gaps:
  - two in the Docks (crane to warehouse, freighter to pier roof)
  - two in Neon Row
  - GCPD to the clock plaza
  - Neon Row to Ace Chemicals
  - the cathedral to a deco tower
  - the Ace chimney to the tank farm

  Each is an inked cable between two posts, with collision posts at both ends.
- **Getting on:** a zipline start is a grapple target with its own icon. Grapple to hook on.
  Jumping or gliding into the cable also hooks on.
- **Riding:**
  - Speed builds with the slope and caps at about 30 m/s.
  - Jump lets go and keeps your velocity, so you flow into a fast glide.
  - At the end of the cable you get a forward launch.
- **Look:** speed lines, the cape streams back, and "ZZZIP" on hook-on.

### B4. Wall run
- **Starting:** sprint toward a wall at under 35 degrees and press Jump within 0.8 m of it.
- **Which walls:** only building walls taller than 4 m (tag `building`).
- **The run:** up to 1.2 s along the wall on a gentle arc.
- **Leaving:** Jump kicks off away from the wall with a boost. If the run times out, you drop.
- **Limit:** one run until you touch the ground again.

### B5. Dive bomb
- **Starting:** while gliding at least 6 m above the ground, press Kick.
- **The dive:** Batman dives straight down, fast, toward the aimed spot.
- **Landing:** a shockwave knocks down goons within 4 m (they go airborne, using the existing
  `launch`) and shows "FWOOSH" then "KA-THOOM". There's a small camera shake and it counts as a
  critical hit for the action camera.
- **Hitting a goon directly** during the dive is an instant knockdown.

### B6. Ledge and drop takedowns
- **Ledge takedown:** while hanging below a goon who stands within 1.5 m of the edge and hasn't
  seen you, pressing Punch pulls them over the edge. It's an instant knockout.
- **Drop takedown:** landing on a goon from a ladder, a ledge or a glide (not a dive bomb) is an
  instant knockdown.
- **Look:** both use an action-camera shot.

### B7. Animations, prompts and controls
- **New clips:** authored in code in `src/actors/climbAnims.js`, the same way `kicks.js` is:
  `Ladder_Climb` (loop), `Ladder_Idle`, `Hang_Idle`, `Shimmy` (loop), `Zip_Hang`, `WallRun_Loop`,
  `Dive`, `Crouch_Sneak`, `Takedown_Choke` and `Ledge_Yank`.
- **Prompts:** a first-time hint for each move (stored in `progress.hints`, like the others).
- **Updated:** the help page, the controls list and the gamepad map.

## Part D. Predator stealth

This builds on B, because perches and ledges are the hiding spots.

### D1. Armed goons and awareness
- **The rifle goon.** A new enemy type, `rifle`, with a rifle modelled in code. It can't be punched safely
  head-on: it shoots in a readable windup with a red laser, taking 25 damage each time.
- **Patrols.** Rifle goons patrol waypoint routes.
- **Detection.** Each goon has a vision cone: 70 degrees and 25 m, shorter in shadow and while you
  crouch. An awareness meter above the goon fills (white, then yellow for searching, then red for
  hostile) and shows as a glyph.
- **Searching.** A hostile goon shouts. The others go to your last known spot, and after 8 s
  without seeing you they go back to searching, then to patrolling.
- **Fear.** Each takedown makes the survivors more nervous: they move faster, stick together more,
  and call out lines ("Where is it?!"). The lines are lettered as speech balloons.

### D2. Stealth moves
- **Crouch.** A new action, "Crouch" (default `KeyZ`, a toggle; left stick click on a gamepad).
  In a crouch you're quiet and harder to see.
- **Silent takedown.** Reach a goon from behind while they're unaware and press Punch. It's a
  2-second takedown that makes noise if another goon is within 6 m.
- **Gargoyle perches.** Grapple to a gargoyle to hang out of sight above the room. Goons don't look
  up unless they're hostile.
- **Perch drop.** From a gargoyle, press Kick over a goon to drop-knock them out.
- **Ledge takedown** (from B6), used from the room's walkways.
- **Distraction.** A batarang that hits a wall makes a noise that pulls goons within 12 m to
  investigate.
- **Escape.** Grappling to a perch while hostile breaks line of sight. The goons lose you after 8 s.

### D3. Predator rooms in the story
Two new story steps, with checkpoints:

- **"Ace Chemicals Catwalks"** comes before the cake step. Four rifle goons patrol a vat hall that
  has 4 gargoyles, catwalk ledges and a floor vent.
- **"Monarch Balcony"** comes before the party step. Three rifle goons and one thug guard the
  balcony level.

Both use the existing encounter module, with a `stealth: true` flag. When all the goons are down,
the step completes. If the player gets spotted, the room turns into a fight where rifles hurt a
lot, but it can still be won, so nobody gets stuck.

### D4. Detective vision in stealth rooms
Goons show their state colour through walls (patrolling, searching, hostile), their vision cones as
flat shapes on the floor, and a counter of armed goons.

## Part C. Content

### C1. Challenges
- **Where:** start markers are glowing bat-glyph pillars with a comic caption naming the
  challenge. Detective vision shows them through walls, and the HUD shows them when you're within
  60 m.
- **Starting:** walk in to start: a 3-2-1 countdown lettered as comic panels, then go.
- **When:** available whenever you're not in a fight or cutscene, including mid-story.
- **Quitting:** the pause menu gets "Quit challenge". Dying or falling in the water fails the
  challenge and puts you back at the marker.
- **Glide rings (3 courses):**
  - "Signal to Sea": GCPD to the Docks.
  - "Neon Slalom": through Neon Row.
  - "Bell Tower Dive": around the cathedral.

  Rings are inked hoops you must fly through in order. A missed ring re-arms. There's a timer.
- **Rooftop run (1 course):** "Gotham Parkour", a checkpoint race from Neon Row to the clock plaza
  that needs a ladder, a ledge, a zipline and a wall run.
- **Combat arena (1 rooftop):** "Joker's Birthday Bash" on the Monarch roof. Three waves using the
  existing encounter system. The score is built from these, with the multiplier reset when you're
  hit:
  - hits times the combo multiplier
  - a variety bonus for each distinct move type in a combo
  - finishers and counters
- **Ranks:** bronze, silver and gold for each challenge. Thresholds are in
  `src/game/challenges.js` and tuned by scripted runs so gold is hard but reachable.
- **Saving:** bests are kept in `progress.challenges`. A new "Challenges" page in the pause menu
  lists all six with their best result and medal.
- **Reward:** getting a gold in every challenge unlocks a comic page, "Mansi's Gold Standard",
  shown from the Challenges page.

### C2. Street crimes
- **When:** in free roam and between story steps, a crime spawns every 2 to 4 minutes in a district
  you've already visited:
  - goons robbing a shop
  - goons cornering a civilian
  - goons breaking into a van
- **Call-out:** a radio caption box names it ("Robbery on Neon Row"), the objective marker points
  to it, and the crime expires after 3 minutes.
- **Fights:** these use the existing encounter and wave system, with 3 to 5 goons.
- **Completing one:** a short reward caption and a counter in the pause menu ("Crimes stopped: 7").
- **Never:** during the boss, the finale, challenges or cutscenes. At most one crime is active at
  a time.

### C3. Photo mode
- **Opening:** from the pause menu, or a key (default `KeyO`; a new action, "Photo mode",
  which can be rebound).
- **Camera:** time freezes. A free camera orbits and flies within 20 m of Batman, with FOV and roll
  controls.
- **Options:**
  - Filter: Ink (default), Noir (black, white and one accent colour), Pop (loud colour and big
    dots), Sepia.
  - Frame: none, panel border, cover (masthead "GOTHAM FOR MANSI" and an issue number).
  - A caption box with editable text, defaulting to "HAPPY BIRTHDAY MANSI".
  - Hide Batman.
- **Save:** saves a PNG through a browser download of the canvas. This is all client-side and
  nothing is uploaded.
- **Controls:** full keyboard and gamepad support.

### C4. Progress tracker
- **Where:** a "Progress" page in the pause menu. The title screen's Continue button shows the
  overall percentage ("Continue, 64%").
- **What it tracks,** with a weight toward 100%:

  | Item | Detail | Weight |
  |---|---|---|
  | Story | chapter steps done, with the chapter names | 40% |
  | Balloons | found out of 12, with a "where" hint for the next one | 20% |
  | Challenges | medals out of 18 (6 challenges times 3 medals) | 20% |
  | Street crimes | stopped out of 10; any past 10 still count on the stats line | 10% |
  | Moves learned | ladder, ledge, zipline, wall run, dive bomb, throw, slam, counter, silent takedown, perch drop | 5% |
  | Districts visited | 5 | 5% |

- **Map:** a small inked city map drawn from the district layout. It shows found balloons as
  filled, unfound ones as outlines (only once their district is visited), and challenge markers
  with their medal colour.
- **Stats line:** play time, goons knocked out, longest combo, highest glide speed and total
  distance glided. The counters live in `progress.stats`.
- **Toasts:** reaching 25%, 50%, 75% and 100% shows a comic caption.
- **Reward:** 100% unlocks a closing comic page, "From Krishn", with a message set in
  `mansi.config.js` (`completionMessage`). It's a placeholder until the user writes it.
- **Code:** pure scoring lives in `src/game/progressTracker.js`, is unit tested, and is read by
  the menu and the title screen.

## Testing

- **Unit (Vitest):**
  - ladder attach, climb and exit maths
  - the ledge probe (grab, no headroom, too high, too low, corner stop)
  - zipline position and speed along the cable
  - wall-run eligibility (angle, height, one per airtime)
  - the dive-bomb radius
  - ring pass detection and order
  - challenge timing, scoring and ranks
  - the crime scheduler rules (spacing, never during blocked modes, one at a time)
  - the district palette snap
  - the vision-cone and awareness maths, and patrol, search and hostile state changes
  - progress percentage weights and edge cases (empty save, finished save, crimes past 10)
- **Scripted runs** (`dev-play` on a frozen production build): one per move with screenshots. Each
  challenge is completed by a scripted run. A street crime spawns, is fought and completes. Photo
  mode opens, cycles filters and saves a PNG.
- **Regression:** Vitest, Playwright smoke tests, the title-to-credits playthrough, and the perf
  A/B on High and Low. All must pass before each part is pushed.
- **Visual review:** before and after screenshots of every district for Part A.

## Not included

- Climbing arbitrary walls, because it would undercut the grapple and glide.
- Online leaderboards, because GitHub Pages has no server.

## Constraints carried over

- CC0 or code-authored assets only. Any lettering or art is authored by Fable.
- No em dashes in game copy.
- Commits are authored by Krishn Gohel only.
- Pushing to `main` redeploys the live site, so push only verified work.
