# Gotham Needs You, Mansi: Design Spec

Date: 2026-09-27
Status: Approved. Look test signed off 2026-09-27 ("love the vibe"); revision 2 below adds the user's feedback

## Purpose

A browser-playable Batman game made as a birthday gift for Mansi. Arkham-style freeflow combat and traversal, told as a living graphic novel, ending in a Batsignal birthday finale. Played from a GitHub Pages link on a desktop browser. Success means Mansi plays it start to finish in one sitting (20 to 30 minutes), the combat feels good, and the ending lands.

## Story

It is Mansi's birthday. The Joker crashed the party, stole the cake, the presents, and the party itself (decorations, music, balloons), and stashed them across three rooftop districts of Gotham. He waits on top of the clock tower. Mansi suits up.

- Opening: comic-panel intro in the rain. The Batsignal hits the clouds. Caption: "Gotham needs you, Mansi."
- Each cleared district returns one stolen thing, shown in a short comic-panel beat.
- Finale: the Joker is beaten, the Batsignal swings up and burns HAPPY BIRTHDAY MANSI into the clouds, fireworks over Gotham, the recovered cake lit on the rooftop, then the user's message rolls as credits.

In-game text addresses Mansi by name and as "you". No gendered wording anywhere.

## Art direction: living graphic novel

Stylized on purpose, never "almost real". Everything below is shader and code work, no AI-generated imagery.

- **Shading:** 3-band toon ramp with hard terminators. The darkest band gets a screen-space halftone dot pattern.
- **Ink:** post-process edge detection on depth and normals (Sobel) for consistent ink outlines, thickness scaled by distance. Characters get a slightly heavier line than the city.
- **Palette:** ink black, Gotham blue-grey, sodium-lamp orange, Batsignal yellow, Joker green and purple as accents only. Nothing else saturated.
- **Weather:** rain drawn as slanted ink streaks, puddle highlights as flat white shapes, lightning flashes that invert to a white panel for 2 frames.
- **Onomatopoeia:** hand-lettered SFX words (THWACK, KRAK, WHUMP) pop on heavy hits, counters and takedowns only, not on every punch.
- **Cutscenes:** comic pages. The 3D scene is rendered from posed cameras into panels laid out on a page, with caption boxes and speech balloons in DOM/CSS over them. Panels slide in one by one; click to advance.
- **Fonts (Google Fonts):** Bangers for SFX words only; Patrick Hand SC for captions and speech; Barlow Condensed for HUD and menus. Final picks confirmed at the look test.

## HUD and menus

Arkham-inspired, thin and sleek, drawn in ink style.

- Health: a bat-emblem arc, bottom left.
- Combo counter: slanted condensed numerals that punch-scale on each hit, top left. At x8 it glows yellow to show a special takedown is ready.
- Counter prompt: a blue lightning glyph above the attacking goon.
- Detective vision: world desaturates to blue ink wash with scan lines; enemies and balloons glow through walls.
- Balloon count and current objective: small caption box, top right.
- Title screen: live 3D rainy rooftop with the Batsignal, logo, Start / Settings / Credits.
- Settings (Esc): tabs for Controls (rebinding), Camera (sensitivity, invert Y, field of view, camera shake), Video (quality High / Low, render scale, halftone strength, show FPS), Audio (master, music, effects), Gameplay (difficulty, tutorial prompts).

## Characters and animation

- **Source:** Quaternius Universal Base Characters (Superhero male and female bodies) and Universal Animation Library 1 and 2, all CC0 and downloadable without an account. Bodies and clips share one 65-bone skeleton, so every clip plays on every character with no retargeting. Credited in the credits.
- **Hero:** on first launch the player picks a Batman-style suit (male body) or a Batgirl-style suit (female body, long red hair). Suits are painted per vertex region at load time (cowl, face, suit, belt, gloves, boots), plus cowl ears and a chest emblem attached to bones.
- **Cape:** simulated verlet cloth pinned below the shoulders, with a pointed bottom edge, colliding with the body.
- **Goons:** male body painted with a striped shirt, dark pants and boots, a clown mask and a beanie built as geometry on the head bone. Three types:
  - Grunt: basic melee.
  - Knife goon: cannot be punched until stunned with the cape; a punch attempt gets blocked.
  - Brute: the same body scaled up 1.2x, cannot be countered; cape stun, then a beatdown of rapid hits.
- **Joker:** male body painted in a purple suit with green hair and a white face.
- **Animation:** Quaternius clips for locomotion, jumps, punches, hook, hit reactions, knockback, get-up, throw, climb and glide pose. Kicks are authored in code as keyframe clips on the same skeleton.

Assets are built by `scripts/build-assets.mjs` into `public/assets/` (stripped attributes, 1K WebP normal maps, resampled clips).

## Controls

Mouse and keyboard, plus gamepad via the Gamepad API (Xbox layout). Desktop only; phones show a "play on a computer" screen. Every keyboard and mouse binding can be rebound in Settings > Controls (click an action, press a key or mouse button; Esc cancels; "Reset to defaults"). Bindings are saved.

| Action | Default key | Gamepad |
|---|---|---|
| Move | W A S D | Left stick |
| Camera | Mouse | Right stick |
| Jump / glide (hold in air) | Space | A |
| Sprint | Shift | L3 |
| Punch | Left mouse | X |
| Kick (in the air: jump-kick) | E | B |
| Block (hold) / counter (tap on the blue glyph) | Right mouse | Y |
| Cape stun | Q | RB |
| Batarang | R | RT |
| Grapple | F (when the prompt shows) | LB |
| Dodge roll | C | LT |
| Special takedown (combo 8+) | X | R3 |
| Detective vision | V | View |
| Controls help | H | D-pad down |
| Pause and settings | Esc or P | Menu |

## Traversal

- Run, jump, and glide (hold jump in the air). Glide trades height for speed; diving (look down while gliding) builds speed, pulling up converts it back into lift.
- Grapple: ledges within range and view show a grapple prompt; the hero zips up and vaults onto the ledge.
- Dive-bomb: attack while gliding over an enemy slams into them and starts combat with a combo of 1.
- Streets are walkable. There is no fall damage: long falls end in a landing roll. Falling into the harbor respawns at the last checkpoint.
- Grapple boost: pressing jump during a grapple zip launches the hero up over the ledge and straight into a glide.

## Freeflow combat

The core of the game. Rules:

- **Targeting:** on strike, pick the enemy within 8 m that best matches the move-input direction (or camera forward if no input), weighted by angle then distance. The hero lunges to it (warp up to 8 m over ~0.15 s) and plays a strike from a pool of 6 punches and kicks.
- **Combo:** each landed hit adds 1. Taking damage, missing (striking with no target), or 1.5 s without a hit resets it to 0.
- **Counter:** an enemy winds up for 0.6 s before an attack, showing the blue glyph. Pressing counter during the wind-up does a counter animation, knocks the enemy down, and adds 1 to the combo. Pressing counter with nothing incoming does nothing and does not reset the combo.
- **Enemy attack pacing:** at most 2 enemies can be in wind-up at once; the rest circle at 4 to 6 m and taunt. This keeps fights readable.
- **Punch and kick:** punches deal 1 damage and chain jab, cross, hook. Kicks deal 2, lunge farther (up to 9 m), and knock a knife goon's guard aside. Grunts have 4 health, knife goons 4, brutes 10.
- **Jump-kick:** kicking while airborne (jump or glide) at an enemy up to 10 m away does a flying kick that knocks them down.
- **Block:** holding block raises a guard. It cuts grunt damage by 80% and knife damage by 50%; it does not stop a brute's charge. You move at walking pace while guarding.
- **Counter:** tapping block while an enemy's blue glyph is up counters instead (see below). Two enemies winding up at once get a double counter.
- **Cape stun:** stuns enemies in a short cone for 1.5 s. Required for brutes.
- **Brute beatdown:** after a cape stun, repeated strikes on a brute do a rapid flurry; 6 flurry hits knocks it down.
- **Dodge roll:** short invulnerable roll; hopping over an enemy if rolling toward one.
- **Batarang:** quick throw at the targeted enemy, stuns 1 s, adds 1 to combo.
- **Special takedown:** at combo 8 or more, instantly takes down one enemy (not the Joker) with a slow-motion camera, and spends the combo back to 0.
- **Knockdowns and KOs:** counters, dive-bombs and jump-kicks knock enemies down for 2.5 s; a punch on a downed enemy is a ground takedown (instant KO). An enemy whose health reaches 0 is KO'd and stays down.
- **Knife goons** parry punches with their knife until stunned by a kick, cape or batarang. **Brutes** cannot be countered (their glyph is red: dodge instead) and can only be hurt while stunned.
- **Feel:** 60 ms hit-stop on every hit, 120 ms on counters and knockdowns, small camera shake, ink-splat particle, SFX word on heavy hits, and a short slow-motion on the last enemy of each fight with a close camera.
- **Health:** hero has 100; grunt hits do 10, knife 15, brute 20, brute charge 25. Health refills after each fight. Death shows a comic panel and restarts the current fight.
- **Difficulty** (Settings > Gameplay): Story (enemy damage x0.5, wind-ups 0.9 s), Normal (x1, 0.6 s), Hard (x1.5, 0.45 s). Defaults to Normal.

## Levels

Gotham is one connected rooftop map with three districts and the clock tower. Districts unlock in order; the next district's gate is a rooftop edge with a glide path that opens after the previous one is cleared.

1. **The Docks** (tutorial district). Waterfront warehouses and cranes. Teaches move, grapple, glide, strike, counter across two small fights, then a larger fight of 8 grunts. Reward: the presents.
2. **Neon Row.** Tight streets under neon signs. Introduces knife goons and the batarang. Two fights, the last with grunts and knife goons, 10 enemies in two waves. Reward: the party, shown by streamers, a disco ball and bunting reappearing over the district.
3. **Ace Chemicals roof.** Pipes, vats and green glow. Introduces brutes and the special takedown. Three fights, the last a 12-enemy mixed wave. Reward: the cake.
4. **Clock tower: Joker boss.** Three phases:
   1. The Joker taunts from a balcony while two waves of goons attack; joy-buzzer floor traps light up in a pattern and shock anyone standing on them (goons included).
   2. The Joker drops in and throws laughing-gas grenades; green gas pools spread over the arena and slowly drain health; batarang him mid-throw to stun him, then strike him 5 times. Repeat 3 times.
   3. One-on-one melee. The Joker attacks with fast 3-hit combos that each need a counter. After 3 successful counter chains he is staggered; a special takedown prompt ends the fight with a scripted comic-panel beat.

Estimated playtime: 20 to 30 minutes.

## Knowing where to go

- **Objective caption** (top right) always says what to do next in plain words.
- **Waypoint:** a diamond marker with the distance in meters over the current objective; when it is off screen it sticks to the screen edge as an arrow.
- **Beacon:** a tall yellow ink column of light rises from the objective so it can be spotted across the city.
- **Tutorial prompts:** comic captions at the bottom of the screen introduce each move the first time it is needed, showing the player's actual bound key ("Hold [Space] in the air to glide"). Can be turned off in Settings > Gameplay.
- **Controls help** (H): a full list of moves and current bindings over the paused game.
- **Detective vision** also highlights the objective, grapple points and birthday balloons.

## The city

One connected, fully walkable map about 450 m across, framed by the harbor and the distant skyline.

- **GCPD rooftop** (start, center): the Batsignal itself stands here.
- **The Docks** (south): warehouses with sawtooth roofs, gantry cranes, stacked shipping containers, a moored freighter, a lighthouse sweeping the harbor, water with ink reflections of the lights.
- **Neon Row** (east): narrow streets under neon signs and billboards, a theater marquee, a diner, fire escapes, magenta and cyan light.
- **Ace Chemicals** (north-west): vats glowing green, pipes, catwalks, smokestacks, the giant ACE sign.
- **Clock tower** (north): a gothic tower with a glowing clock face, gargoyles and a cathedral beside it; the boss arena is its upper platform.
- **Everywhere:** varied facades (brick, stone, art deco setbacks, gothic spires), cornices, water towers, antennas with blinking lights, wires strung between roofs, steam from vents and manholes, streetlamps with light pools, parked and moving cars with headlights, a police blimp with a searchlight, searchlights sweeping the clouds, lightning.
- Real dynamic lights are limited to the few nearest the player; everything else glows with emissive color and ink halo sprites so it stays fast.

## Browser support

Runs from the production build in the latest Chrome, Edge and Firefox on Windows and macOS. Requires WebGL2; without it the loading cover shows a clear message. Tested on the production build (`vite build` + `vite preview`), not only the dev server.

## Collectibles: birthday balloons

12 glowing balloons hidden across the map (4 per district), placed on hard-to-reach ledges, under glide paths, and behind detective-vision-only walls. Popping one shows a comic caption card with a message from `mansi.config.js`. The balloon count shows in the HUD. Finding all 12 unlocks a gold suit variant, selectable from the title screen.

## Personal content: `src/mansi.config.js`

Single file, edited by the user before sharing:

```js
export default {
  name: "Mansi",
  finaleSignal: "HAPPY BIRTHDAY MANSI",
  balloonMessages: [ /* 12 strings, shown in order found */ ],
  finalMessage: "…",        // rolls as the credits
  fromName: "Krishn",
};
```

I will write 12 warm default balloon messages and a default final message so the game is complete as shipped; the user replaces them with real memories and inside jokes. A test enforces exactly 12 non-empty messages.

## Audio

All synthesized in the browser with Web Audio, no downloaded or AI-generated audio.

- Score: dark orchestral-style pulse (low string ostinato, brass swells, timpani hits) that intensifies during fights and drops out in the slow-motion final hit.
- Ambience: rain noise, distant thunder with lightning, city hum.
- SFX: punch and kick impacts (layered noise + pitched thump), counter whoosh, cape snap, grapple zip, glide wind, balloon pop, Joker laugh (synthesized, pitched), fireworks.

## Technical architecture

- **Stack:** Vite + Three.js, plain JavaScript modules, no framework. Vitest for unit tests, Playwright for browser smoke tests.
- **Location:** `Documents\projects\gotham-for-mansi`.
- **Modules (one clear job each):**
  - `core/` game loop (fixed 60 Hz simulation step, variable render), input (keyboard, mouse, gamepad unified into actions), save (localStorage: settings, balloons found, district progress, wrapped in try/catch).
  - `render/` renderer setup, toon material, ink outline and halftone post-process passes, rain, quality presets.
  - `world/` city generation (buildings, rooftops, props, neon), district definitions (spawns, checkpoints, balloon spots, grapple points), collision (simple capsule vs box colliders, no physics engine).
  - `actors/` hero controller (traversal state machine), cape verlet sim, enemy AI (state machine per type), Joker boss.
  - `combat/` targeting, combo, counter window scheduling, hit resolution. Pure logic with no Three.js dependency, so it is unit-testable.
  - `ui/` HUD, menus, comic-panel cutscene system, balloon message cards.
  - `audio/` synth score and SFX.
  - `mansi.config.js` personal content.
- **Debug:** URL params `?district=2`, `?boss=1`, `?god=1` to jump straight to any part for testing.
- **Performance target:** 60 fps at 1080p on an RTX 4060 laptop on High; Low preset (half-res outline pass, no shadows, fewer rain streaks) for integrated graphics at 30 fps or better.
- **Load:** a comic-cover loading screen while GLBs load; total download under 40 MB.

## Delivery

- Git repo `krishngohel/gotham-for-mansi`, **public** (free GitHub Pages requires it, which means the balloon messages and final message are readable by anyone who finds the repo).
- GitHub Actions workflow builds with Vite and deploys to Pages at `https://krishngohel.github.io/gotham-for-mansi/`.
- Nothing is pushed until the user approves the push.
- Commits authored solely by Krishn Gohel.

## Testing

- **Unit (Vitest):** targeting selection, combo increment/reset rules, counter window timing, enemy wind-up concurrency cap, brute beatdown count, damage values, save/load round-trip, config validation (12 messages, non-empty strings).
- **Browser smoke (Playwright):** title screen renders with no console errors; `?district=1` loads and the hero moves; `?boss=1` loads the boss arena; finale reached with `?god=1` and scripted input.
- **Performance check:** frame time sampled in the browser on High and Low presets.
- **Manual playthrough:** I play from title to credits and fix whatever feels wrong before calling it done.

## Build order and gates

1. **Look test (gate).** One rainy rooftop, the hero (idle, run, one punch) and one goon under the full graphic-novel pipeline, plus the HUD. Screenshots shown to the user. Nothing else is built until the user signs off on the look.
2. Traversal: hero controller, cape, grapple, glide, collision, camera.
3. Combat system and the three goon types.
4. City and the three districts, checkpoints, balloons.
5. Joker boss.
6. Comic-panel cutscenes, intro, finale, credits.
7. Audio.
8. Polish, performance, full playthrough.
9. Deploy (after user approval).

## Out of scope

Mobile and touch controls, online features, voice acting, open-world side content beyond balloons, save slots (one progress save only), gamepad rebinding.
