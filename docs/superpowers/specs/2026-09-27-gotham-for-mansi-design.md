# Gotham Needs You, Mansi: Design Spec

Date: 2026-09-27
Status: Draft, awaiting user review

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
- Settings: quality preset (High / Low), mouse sensitivity, invert Y, volume.

## Characters and animation

- **Hero:** on first launch the player picks one of two suits, a Batman-style suit or a Batgirl-style suit, each from a downloadable Sketchfab fan model (CC-BY or similar permissive licence, credited in the credits). Both are auto-rigged through Mixamo so they share one animation set.
- **Cape:** verlet-simulated cloth chain attached to the shoulder bones, so it flows when running and spreads when gliding.
- **Goons:** Mixamo characters recoloured in toon palette with clown masks built as simple geometry on the head bone. Three types:
  - Grunt: basic melee.
  - Knife goon: cannot be punched until stunned with the cape; a punch attempt gets blocked.
  - Brute: large, cannot be countered; cape stun, then a beatdown of rapid hits.
- **Joker:** Sketchfab fan model, auto-rigged via Mixamo.
- **Animation:** Mixamo mocap for locomotion, jumps, punches, kicks, counters, hit reactions, knockdowns, takedowns and taunts. Retargeting is handled by Mixamo's shared skeleton.
- **Fallback:** if a Sketchfab model cannot be rigged cleanly, the hero uses a Mixamo base body with a cowl, ears, chest emblem and belt built as geometry on the bones. The cel shading and ink make this read well.

Asset sourcing requires the user to be logged into Adobe (Mixamo) and optionally Sketchfab in Chrome. Assets are downloaded once into `public/assets/`, compressed to GLB with Draco, and credited.

## Controls

Mouse and keyboard, plus gamepad via the Gamepad API (Xbox layout). Desktop only; phones show a "play on a computer" screen.

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move | WASD | Left stick |
| Camera | Mouse | Right stick |
| Jump / glide (hold in air) | Space | A |
| Strike | Left click | X |
| Counter | Right click | Y |
| Cape stun | Q | B |
| Dodge roll | Shift (while moving) | A x2 |
| Batarang | E | RB |
| Grapple | F (when prompt shows) | LB |
| Detective vision | V | LT |
| Special takedown (combo 8+) | Left + right click together | X + Y |

## Traversal

- Run, jump, and glide (hold jump in the air). Glide trades height for speed; diving (look down while gliding) builds speed, pulling up converts it back into lift.
- Grapple: ledges within range and view show a grapple prompt; the hero zips up and vaults onto the ledge.
- Dive-bomb: attack while gliding over an enemy slams into them and starts combat with a combo of 1.
- Falling off the map respawns at the last rooftop checkpoint with no damage.

## Freeflow combat

The core of the game. Rules:

- **Targeting:** on strike, pick the enemy within 8 m that best matches the move-input direction (or camera forward if no input), weighted by angle then distance. The hero lunges to it (warp up to 8 m over ~0.15 s) and plays a strike from a pool of 6 punches and kicks.
- **Combo:** each landed hit adds 1. Taking damage, missing (striking with no target), or 1.5 s without a hit resets it to 0.
- **Counter:** an enemy winds up for 0.6 s before an attack, showing the blue glyph. Pressing counter during the wind-up does a counter animation, knocks the enemy down, and adds 1 to the combo. Pressing counter with nothing incoming does nothing and does not reset the combo.
- **Enemy attack pacing:** at most 2 enemies can be in wind-up at once; the rest circle at 4 to 6 m and taunt. This keeps fights readable.
- **Cape stun:** stuns enemies in a short cone for 1.5 s. Required for knife goons and brutes.
- **Brute beatdown:** after a cape stun, repeated strikes on a brute do a rapid flurry; 6 flurry hits knocks it down.
- **Dodge roll:** short invulnerable roll; hopping over an enemy if rolling toward one.
- **Batarang:** quick throw at the targeted enemy, stuns 1 s, adds 1 to combo.
- **Special takedown:** at combo 8 or more, instantly takes down one enemy (not the Joker) with a slow-motion camera, and spends the combo back to 0.
- **Knockdowns:** grunts take 3 hits to knock down (fewer if countered or dive-bombed); knocked-down enemies get back up after 3 s unless hit on the ground (ground takedown, 1 hit).
- **Feel:** 60 ms hit-stop on every hit, 120 ms on counters and knockdowns, small camera shake, ink-splat particle, SFX word on heavy hits, and a short slow-motion on the last enemy of each fight with a close camera.
- **Health:** hero has 100; grunt hits do 10, knife 15, brute 20. Health refills after each fight. Death restarts the current fight.

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

Mobile and touch controls, online features, voice acting, open-world side content beyond balloons, save slots (one progress save only), difficulty settings.
