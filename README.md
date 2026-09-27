# Gotham Needs You, Mansi

A comic-book Batman game that runs in the browser, made as a birthday gift. Glide over a rainy
Gotham, brawl through the Joker's goons at the Docks, Neon Row and Ace Chemicals, take back the
presents, the party and the cake, then settle things with the Joker on the clock tower.

Everything is built in code: the city, the comic panels, the music and the sound effects. The only
downloaded art is the CC0 character and animation set by Quaternius.

## Play

```
npm install
npm run dev        # http://localhost:5200
```

Desktop browser with a mouse (a gamepad works too). Click the screen to capture the mouse.
Every key can be rebound in Settings > Controls.

| Action | Default |
|---|---|
| Move | W A S D |
| Jump, glide (hold in the air) | Space |
| Sprint | Shift |
| Punch | Left mouse |
| Kick (in the air: jump-kick) | E |
| Block (hold) / counter (tap on the blue bolt) | Right mouse |
| Cape stun | Q |
| Batarang | R |
| Grapple | F |
| Dodge roll | C |
| Special takedown (8+ combo) | X |
| Detective vision | V |
| Controls help | H |
| Pause | Esc or P |

## Make it personal

Edit `src/mansi.config.js`:

- `name`: shown everywhere in the story.
- `finaleSignal`: what the Batsignal writes across the clouds at the end.
- `balloonMessages`: twelve messages, one per hidden birthday balloon, in the order they are found.
  The current ones are placeholders: swap in real memories and inside jokes.
- `finalMessage`: rolls with the credits.
- `fromName`: who it is from.

`npm test` checks that there are exactly twelve non-empty messages.

## Build and deploy

```
npm run build      # static site in dist/
npm run preview    # serve dist/ on http://localhost:5201
```

`dist/` is a plain static site (about 11 MB) and works from any static host, including GitHub
Pages. Note that a public repo makes the messages in `mansi.config.js` readable by anyone who
finds it.

## Checks

```
npm test                    # unit tests (Vitest)
npm run test:e2e            # browser smoke tests (Playwright, real GPU)
node scripts/playthrough.mjs   # automated run from title to credits, saves every comic page
node scripts/perf.mjs          # frame rate in each district on High and Low (Edge)
node scripts/browsers.mjs      # boots the production build in Chromium, Edge and Firefox
```

Dev URL parameters: `?new=1` (fresh save), `?at=<stepId>` (jump to a story step, see
`src/game/story.js`), `?god=1` (no damage), `?q=low` (Low preset), `?suit=f|m|gold`.

## Where things live

- `src/game/`: the game shell, story steps, fights, boss, finale, cutscene scripts.
- `src/world/`: map data, city builder, districts, sky, water, traffic, collision, grapple points.
- `src/actors/`: hero, goons, the Joker, cape cloth, kick animations.
- `src/combat/`: pure combat rules, targeting, combo, attack director, and the combat system.
- `src/render/`: toon materials and the ink pipeline (outlines, halftone, detective vision).
- `src/ui/`: HUD, menus and settings, comic pages, prompts, waypoint.
- `src/audio/`: synthesized music and sound (`audio-lab.html` previews it in dev).
- `scripts/build-assets.mjs`: rebuilds `public/assets/` from the Quaternius packs (see `scripts/ASSETS.md`).

See `CREDITS.md` for licenses.
