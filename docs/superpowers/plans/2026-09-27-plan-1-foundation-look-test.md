# Plan 1: Foundation and Look Test

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A running Vite + Three.js project that renders one rainy Gotham rooftop in the living-graphic-novel style, with the hero (idle, run, punch, cape) and one goon, plus the HUD, ready for the user's look sign-off.

**Architecture:** Plain ES modules. Rendering is a three-pass pipeline: a color pass into a half-float target with a depth texture, a view-normal pass, and a fullscreen ink shader (Sobel edges on depth and normals, halftone, grain, detective mode, lightning flash). Characters are Quaternius CC0 base bodies painted by vertex region at load time, animated with Quaternius CC0 clips that share the exact same 65-bone skeleton. Pure logic (verlet cloth, suit classification, HUD math, time control, RNG, clip sanitizing) has no DOM dependency and is unit-tested with Vitest.

**Tech Stack:** three 0.186, vite 8, vitest 5, @playwright/test 1.63, @gltf-transform 4.5 + sharp (asset build only).

## Global Constraints

- Project root: `C:\Users\awsom\Documents\Projects\gotham-for-mansi`.
- No AI-generated assets. Models and animations come from Quaternius CC0 packs; everything else is code.
- Colors only from `src/config/palette.js`.
- In-game text addresses Mansi by name and as "you"; no gendered wording.
- User-facing copy has no em dashes.
- Commits authored solely by Krishn Gohel, no co-author trailers.
- Desktop only; coarse-pointer devices get a "play on a computer" screen.
- Dev server port 5200.

## Spec change carried by this plan

The spec named Mixamo and Sketchfab as the character source. Both need logins and retargeting. Quaternius's Universal Base Characters (Superhero male and female bodies) and Universal Animation Library 1 and 2 are CC0, downloadable without an account, and share one skeleton, so they replace Mixamo and Sketchfab. The Batman-style and Batgirl-style suits are built by painting the body by region plus cowl ears, chest emblem, hair and a cloth cape. Task 1 updates the spec to say this.

## File map

| File | Responsibility |
|---|---|
| `package.json`, `vite.config.js`, `playwright.config.js`, `.gitignore` | tooling |
| `index.html` | canvas, loading cover, fonts |
| `CREDITS.md` | asset and font credits |
| `scripts/build-assets.mjs` | source packs in `assets-src/` to slim GLBs in `public/assets/` |
| `scripts/shots.mjs` | captures look-test screenshots into `docs/look-test/` |
| `src/config/palette.js` | the only color constants |
| `src/config/clips.js` | which animation clips ship |
| `src/config/batShape.js` | one bat outline used by sky, HUD and chest emblem |
| `src/mansi.config.js` | personal content (name, signal text, from) |
| `src/core/rng.js` | seeded PRNG |
| `src/core/time.js` | hit-stop and slow motion |
| `src/core/input.js` | keyboard and mouse state |
| `src/render/quality.js` | High and Low presets |
| `src/render/layers.js` | render layer ids |
| `src/render/renderer.js` | WebGLRenderer setup |
| `src/render/inkPipeline.js` | color, normal and ink passes, x-ray overlay |
| `src/render/toon.js` | toon material, hull outline, x-ray clone |
| `src/render/rain.js` | ink-streak rain |
| `src/world/sky.js` | sky dome, clouds, Batsignal emblem |
| `src/world/skyline.js` | merged Gotham skyline with window texture |
| `src/world/batsignal.js` | lamp and beam |
| `src/world/lookTestSet.js` | rooftop, props, lights, fog, puddles |
| `src/actors/animator.js` | clip sanitizing, mixer wrapper |
| `src/actors/assets.js` | GLB loading |
| `src/actors/rig.js` | bind-pose helpers, body landmarks, rigid attach |
| `src/actors/outfits.js` | pure per-vertex region rules and suit colors |
| `src/actors/characters.js` | assembles the Bat and the goon |
| `src/actors/verlet.js` | pure cloth simulation |
| `src/actors/cape.js` | cape mesh driven by the cloth |
| `src/ui/style.css` | HUD, SFX words, loading cover |
| `src/ui/hud.js` | HUD DOM and updates |
| `src/lookTest.js` | the look-test scene controller |
| `src/main.js` | entry |
| `tests/unit/*.test.js`, `tests/e2e/smoke.spec.js` | tests |

---

### Task 1: Scaffold, asset pipeline, spec update

**Files:**
- Create: `package.json`, `vite.config.js`, `.gitignore`, `CREDITS.md`, `src/config/clips.js`, `scripts/build-assets.mjs`, `scripts/ASSETS.md`, `tests/unit/assets.test.js`
- Modify: `docs/superpowers/specs/2026-09-27-gotham-for-mansi-design.md` (Characters and animation section)

**Interfaces:**
- Produces: `public/assets/hero_m.glb`, `hero_f.glb`, `hair_long.glb`, `anims1.glb`, `anims2.glb`; `CLIP_SET` from `src/config/clips.js` (`{ anims1: string[], anims2: string[] }`).

- [ ] **Step 1: Create package.json and install**

```json
{
  "name": "gotham-for-mansi",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 5200 --strictPort",
    "build": "vite build",
    "preview": "vite preview --port 5201 --strictPort",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "assets": "node scripts/build-assets.mjs",
    "shots": "node scripts/shots.mjs"
  }
}
```

Run: `npm i three@0.186.1 && npm i -D vite@8 vitest@5 @playwright/test@1.63 @gltf-transform/core@4.5 @gltf-transform/functions@4.5 @gltf-transform/extensions@4.5 sharp && npx playwright install chromium`

- [ ] **Step 2: Tooling files**

`vite.config.js`:
```js
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});
```

`.gitignore`:
```
node_modules/
dist/
assets-src/
test-results/
playwright-report/
.playwright-mcp/
```

`CREDITS.md`:
```markdown
# Credits

- Universal Base Characters, Universal Animation Library and Universal Animation Library 2 by Quaternius. CC0 1.0. https://quaternius.com
- Fonts via Google Fonts under the SIL Open Font License: Bangers (Vernon Adams), Patrick Hand SC (Patrick Wagesreiter), Barlow Condensed (Jeremy Tribby).
- Batman, Batgirl, the Joker and Gotham City belong to DC. This is a non-commercial, fan-made birthday gift.
```

- [ ] **Step 3: Copy source packs into `assets-src/`**

The three Standard zips are already downloaded to `%TEMP%\quat` (itch.io, free, no account). Flatten the needed files:

```bash
SRC="$TEMP/quat"
mkdir -p assets-src
cp "$SRC/x_ubc__U/Universal Base Characters[Standard]/Base Characters/Godot - UE/"* assets-src/
cp -n "$SRC/x_ubc__U/Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/"Hair_Long.* assets-src/
cp -n "$SRC/x_ubc__U/Universal Base Characters[Standard]/Hairstyles/Origin at 0/glTF (Godot)/"T_Hair_2* assets-src/ 2>/dev/null || true
cp "$SRC/x_univer/Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb" assets-src/
cp "$SRC/x_univer/Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb" assets-src/
ls assets-src
```

Expected: `Superhero_Male_FullBody.gltf/.bin`, `Superhero_Female_FullBody.gltf/.bin`, `Hair_Long.gltf/.bin`, textures, `UAL1_Standard.glb`, `UAL2_Standard.glb`.

`scripts/ASSETS.md`:
```markdown
# Rebuilding assets

`assets-src/` is not committed. To rebuild `public/assets/`:

1. Download the Standard zips (free, no account) from
   - https://quaternius.itch.io/universal-base-characters
   - https://quaternius.itch.io/universal-animation-library
   - https://quaternius.itch.io/universal-animation-library-2
2. Copy into `assets-src/`: everything in `Base Characters/Godot - UE/`, `Hairstyles/Origin at 0/glTF (Godot)/Hair_Long.*` and its textures, `UAL1_Standard.glb`, `UAL2_Standard.glb`.
3. `npm run assets`
```

- [ ] **Step 4: Clip list**

`src/config/clips.js`:
```js
// Animation clips shipped in public/assets/anims1.glb and anims2.glb.
export const CLIP_SET = {
  anims1: [
    'Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
    'Punch_Jab', 'Punch_Cross', 'Roll', 'Hit_Chest', 'Hit_Head', 'Death01', 'Crouch_Idle_Loop',
    'Interact', 'Dance_Loop', 'Idle_Talking_Loop', 'Sword_Attack', 'Spell_Simple_Shoot',
  ],
  anims2: [
    'Melee_Hook', 'Melee_Hook_Rec', 'Hit_Knockback', 'LayToIdle', 'ClimbUp_1m',
    'NinjaJump_Start', 'NinjaJump_Idle_Loop', 'NinjaJump_Land', 'OverhandThrow', 'Idle_FoldArms_Loop',
    'Idle_No_Loop', 'Sword_Regular_A', 'Sword_Regular_B', 'Sword_Regular_C', 'Sword_Dash',
    'Slide_Start', 'Slide_Loop', 'Slide_Exit', 'Idle_Shield_Break', 'Yes', 'Zombie_Scratch',
  ],
};
```

- [ ] **Step 5: Write the failing asset test**

`tests/unit/assets.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { CLIP_SET } from '../../src/config/clips.js';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const LEAN = ['JOINTS_0', 'NORMAL', 'POSITION', 'TEXCOORD_0', 'WEIGHTS_0'];

describe('built assets', () => {
  it.each(['anims1', 'anims2'])('%s.glb holds exactly the listed clips and no meshes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    const clips = doc.getRoot().listAnimations().map((a) => a.getName()).sort();
    expect(clips).toEqual([...CLIP_SET[name]].sort());
    expect(doc.getRoot().listMeshes()).toHaveLength(0);
  });

  it.each(['hero_m', 'hero_f'])('%s.glb is skinned with 65 joints and lean attributes', async (name) => {
    const doc = await io.read(`public/assets/${name}.glb`);
    expect(doc.getRoot().listSkins()[0].listJoints()).toHaveLength(65);
    for (const mesh of doc.getRoot().listMeshes())
      for (const prim of mesh.listPrimitives()) expect(prim.listSemantics().sort()).toEqual(LEAN);
  });
});
```

Run: `npx vitest run tests/unit/assets.test.js`
Expected: FAIL, files not found.

- [ ] **Step 6: Asset build script**

`scripts/build-assets.mjs`:
```js
// Converts the Quaternius CC0 source packs in assets-src/ into slim GLBs in public/assets/.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { CLIP_SET } from '../src/config/clips.js';

const SRC = process.env.ASSETS_SRC ?? 'assets-src';
const OUT = 'public/assets';
const KEEP = new Set(['POSITION', 'NORMAL', 'TEXCOORD_0', 'JOINTS_0', 'WEIGHTS_0']);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

function stripAttributes(doc) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics()) if (!KEEP.has(sem)) prim.setAttribute(sem, null);
}

async function character(src, out, { keepBaseColor = false } = {}) {
  const doc = await io.read(path.join(SRC, src));
  stripAttributes(doc);
  for (const mat of doc.getRoot().listMaterials()) {
    mat.setMetallicRoughnessTexture(null);
    if (!keepBaseColor) mat.setBaseColorTexture(null);
  }
  await doc.transform(dedup(), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }));
  await io.write(path.join(OUT, out), doc);
}

async function anims(src, out, keep) {
  const doc = await io.read(path.join(SRC, src));
  for (const anim of doc.getRoot().listAnimations()) if (!keep.includes(anim.getName())) anim.dispose();
  for (const node of doc.getRoot().listNodes()) { node.setMesh(null); node.setSkin(null); }
  await doc.transform(prune());
  await io.write(path.join(OUT, out), doc);
}

await mkdir(OUT, { recursive: true });
await character('Superhero_Male_FullBody.gltf', 'hero_m.glb');
await character('Superhero_Female_FullBody.gltf', 'hero_f.glb');
await character('Hair_Long.gltf', 'hair_long.glb', { keepBaseColor: true });
await anims('UAL1_Standard.glb', 'anims1.glb', CLIP_SET.anims1);
await anims('UAL2_Standard.glb', 'anims2.glb', CLIP_SET.anims2);
for (const f of ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb'])
  console.log(f, ((await stat(path.join(OUT, f))).size / 1e6).toFixed(2), 'MB');
```

Run: `npm run assets`
Expected: five files listed, total under 15 MB.

- [ ] **Step 7: Run the asset test**

Run: `npx vitest run tests/unit/assets.test.js`
Expected: PASS (4 tests).

- [ ] **Step 8: Update the spec's Characters section**

Replace the "Hero", "Goons", "Joker", "Animation", "Fallback" bullets and the asset-sourcing paragraph with:

```markdown
- **Source:** Quaternius Universal Base Characters (Superhero male and female bodies) and Universal Animation Library 1 and 2, all CC0 and downloadable without an account. Bodies and clips share one 65-bone skeleton, so every clip plays on every character with no retargeting. Credited in the credits.
- **Hero:** on first launch the player picks a Batman-style suit (male body) or a Batgirl-style suit (female body, long red hair). Suits are painted per vertex region at load time (cowl, face, suit, belt, gloves, boots), plus cowl ears and a chest emblem attached to bones.
- **Cape:** simulated verlet cloth pinned below the shoulders, with pointed bottom edge, colliding with the body.
- **Goons:** male body painted with striped shirt, dark pants and boots, a clown mask and a beanie built as geometry on the head bone. Grunt, knife goon and brute (brute is the same body scaled up 1.2x).
- **Joker:** male body painted in a purple suit with green hair and a white face.
- **Animation:** Quaternius clips for locomotion, jumps, punches, hook, counters, hit reactions, knockback, get-up, throw, climb, glide pose. Kicks are authored in code as keyframe clips on the same skeleton.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold project and build CC0 character and animation assets"
```

---

### Task 2: Core utilities (palette, RNG, time control, quality, bat shape, input)

**Files:**
- Create: `src/config/palette.js`, `src/core/rng.js`, `src/core/time.js`, `src/render/quality.js`, `src/config/batShape.js`, `src/core/input.js`, `src/mansi.config.js`
- Test: `tests/unit/core.test.js`

**Interfaces:**
- Produces:
  - `PALETTE` object of hex numbers; `hex(n) -> '#rrggbb'`
  - `createRng(seed) -> { next(), range(min,max), int(min,max), pick(arr), chance(p) }`
  - `createTimeControl() -> { hitStop(sec), slowMo(sec, scale), scale(dt) -> gameDt, stopped }`
  - `getQuality(name) -> { name, pixelRatioCap, normalScale, shadows, shadowMapSize, rainCount }`
  - `BAT_RIGHT_HALF`, `batOutline() -> [x,y][]` (closed, symmetric), `batSvgPath(scale, cx, cy) -> string`
  - `createInput(target) -> { held(code), pressed(code), clicked(button), mouse: {dx, dy}, endFrame() }`
  - default export of `mansi.config.js`: `{ name, finaleSignal, fromName }`

- [ ] **Step 1: Write failing tests**

`tests/unit/core.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createRng } from '../../src/core/rng.js';
import { createTimeControl } from '../../src/core/time.js';
import { getQuality } from '../../src/render/quality.js';
import { batOutline, batSvgPath, BAT_RIGHT_HALF } from '../../src/config/batShape.js';
import { hex, PALETTE } from '../../src/config/palette.js';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(7), b = createRng(7);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('stays in range', () => {
    const r = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = r.next(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1);
      const n = r.int(2, 4); expect(n).toBeGreaterThanOrEqual(2); expect(n).toBeLessThanOrEqual(4);
    }
  });
});

describe('time control', () => {
  it('freezes game time during hit-stop, then resumes with the leftover', () => {
    const t = createTimeControl();
    t.hitStop(0.06);
    expect(t.scale(0.05)).toBe(0);
    expect(t.scale(0.05)).toBeCloseTo(0.04, 6);
    expect(t.scale(0.05)).toBeCloseTo(0.05, 6);
  });
  it('keeps the longer of overlapping hit-stops', () => {
    const t = createTimeControl();
    t.hitStop(0.12); t.hitStop(0.06);
    expect(t.scale(0.1)).toBe(0);
    expect(t.stopped).toBe(true);
  });
  it('slows time for the slow-mo window', () => {
    const t = createTimeControl();
    t.slowMo(0.5, 0.25);
    expect(t.scale(0.1)).toBeCloseTo(0.025, 6);
  });
});

describe('quality', () => {
  it('falls back to high and has a cheaper low preset', () => {
    expect(getQuality('nope').name).toBe('high');
    const low = getQuality('low');
    expect(low.shadows).toBe(false);
    expect(low.normalScale).toBe(0.5);
    expect(low.rainCount).toBeLessThan(getQuality('high').rainCount);
  });
});

describe('bat shape', () => {
  it('mirrors the right half into a symmetric closed outline', () => {
    const pts = batOutline();
    expect(pts).toHaveLength(BAT_RIGHT_HALF.length * 2 - 2);
    const xs = pts.map(([x]) => x);
    expect(Math.max(...xs)).toBeCloseTo(-Math.min(...xs));
  });
  it('produces an SVG path', () => {
    const d = batSvgPath(1, 50, 50);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });
});

describe('palette', () => {
  it('formats hex', () => {
    expect(hex(PALETTE.ink)).toMatch(/^#[0-9a-f]{6}$/);
  });
});
```

Run: `npx vitest run tests/unit/core.test.js`
Expected: FAIL, modules missing.

- [ ] **Step 2: Implement**

`src/config/palette.js`:
```js
// The only color constants in the game. Everything else derives from these.
export const PALETTE = {
  ink: 0x0b0b12,
  paper: 0xefe6cf,
  gotham: 0x243248,
  slate: 0x4b586e,
  fog: 0x1a2436,
  sodium: 0xe8923a,
  signal: 0xf2d24b,
  jokerGreen: 0x62c141,
  jokerPurple: 0x6c3fa3,
  detective: 0x49b4ff,
  skin: 0xc99a7c,
  skinGoon: 0xb88a6d,
  suitGrey: 0x5b6474,
  suitDark: 0x2c2b3a,
  cowl: 0x17181e,
  belt: 0xd9a92c,
  hairRed: 0x8e2a1f,
  pants: 0x2a2436,
  stripe: 0xb9b2a0,
  wood: 0x5a4636,
  window: 0xe8a653,
  windowCool: 0xcfd7e6,
  balloon: 0xc8323c,
};

export const hex = (n) => '#' + n.toString(16).padStart(6, '0');
```

`src/core/rng.js`:
```js
// Seeded PRNG (mulberry32) so the city is identical on every load.
export function createRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}
```

`src/core/time.js`:
```js
// Converts real frame time into game time, applying hit-stop freezes and slow motion.
export function createTimeControl() {
  let stop = 0;
  let slow = 0;
  let slowScale = 1;
  return {
    hitStop(sec) { stop = Math.max(stop, sec); },
    slowMo(sec, scale) { slow = Math.max(slow, sec); slowScale = scale; },
    scale(dt) {
      if (stop > 0) {
        const used = Math.min(stop, dt);
        stop -= used;
        dt -= used;
        if (dt <= 1e-9) return 0;
      }
      if (slow > 0) { slow -= dt; return dt * slowScale; }
      return dt;
    },
    get stopped() { return stop > 0; },
  };
}
```

`src/render/quality.js`:
```js
const PRESETS = {
  high: { name: 'high', pixelRatioCap: 2, normalScale: 1, shadows: true, shadowMapSize: 2048, rainCount: 6000 },
  low: { name: 'low', pixelRatioCap: 1, normalScale: 0.5, shadows: false, shadowMapSize: 0, rainCount: 2000 },
};

export function getQuality(name) {
  return PRESETS[name] ?? PRESETS.high;
}
```

`src/config/batShape.js`:
```js
// Right half of the bat emblem, clockwise from the top center. 100 units wide, y up.
export const BAT_RIGHT_HALF = [
  [0, 12], [3, 13], [5.5, 22], [8, 12], [13, 11], [20, 15], [31, 21], [49, 23],
  [45, 14], [45, 5], [39, 9], [34, 1], [28, 5], [21, -5], [15, -1], [7, -10], [0, -21],
];

export function batOutline(half = BAT_RIGHT_HALF) {
  const left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
  return [...half, ...left];
}

export function batSvgPath(scale = 1, cx = 0, cy = 0) {
  return batOutline()
    .map(([x, y], i) => `${i ? 'L' : 'M'}${(cx + x * scale).toFixed(2)} ${(cy - y * scale).toFixed(2)}`)
    .join(' ') + ' Z';
}
```

`src/core/input.js`:
```js
// Keyboard and mouse state, polled once per frame. Mouse deltas count only while pointer-locked.
export function createInput(target = window) {
  const held = new Set();
  const pressed = new Set();
  const clicked = new Set();
  const mouse = { dx: 0, dy: 0 };
  target.addEventListener('keydown', (e) => { if (!held.has(e.code)) pressed.add(e.code); held.add(e.code); });
  target.addEventListener('keyup', (e) => held.delete(e.code));
  target.addEventListener('mousedown', (e) => clicked.add(e.button));
  target.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement) { mouse.dx += e.movementX; mouse.dy += e.movementY; }
  });
  target.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('blur', () => held.clear());
  return {
    held: (code) => held.has(code),
    pressed: (code) => pressed.has(code),
    clicked: (button) => clicked.has(button),
    mouse,
    endFrame() { pressed.clear(); clicked.clear(); mouse.dx = 0; mouse.dy = 0; },
  };
}
```

`src/mansi.config.js`:
```js
// Personal content. Edit this file before sharing the game.
export default {
  name: 'Mansi',
  finaleSignal: 'HAPPY BIRTHDAY MANSI',
  fromName: 'Krishn',
};
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/core.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add palette, RNG, time control, quality presets, bat shape, input"
```

---

### Task 3: Ink render pipeline and toon materials

**Files:**
- Create: `src/render/layers.js`, `src/render/renderer.js`, `src/render/inkPipeline.js`, `src/render/toon.js`, `index.html`, `src/ui/style.css`, `src/main.js` (temporary pipeline check scene)

**Interfaces:**
- Consumes: `PALETTE`, `getQuality`.
- Produces:
  - `LAYER_FX = 1` (color pass only), `LAYER_XRAY = 2` (drawn over the final image)
  - `createRenderer(canvas, quality) -> THREE.WebGLRenderer`
  - `createInkPipeline(renderer, quality) -> { uniforms, setSize(w, h), render(scene, camera, time) }` with `uniforms.uFlash`, `uniforms.uDetective`
  - `toonMaterial({ color, map, normalMap, vertexColors, emissive, emissiveMap, emissiveIntensity, side }) -> MeshToonMaterial`
  - `addHullOutline(mesh, width) -> Mesh`, `addXray(skinnedMesh, color) -> SkinnedMesh`

- [ ] **Step 1: Layers, renderer, toon**

`src/render/layers.js`:
```js
export const LAYER_FX = 1;   // color pass only: sky, rain, beams, hull outlines, puddles
export const LAYER_XRAY = 2; // detective-vision silhouettes, drawn over the finished frame
```

`src/render/renderer.js`:
```js
import * as THREE from 'three';

export function createRenderer(canvas, quality) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  return renderer;
}
```

`src/render/toon.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX, LAYER_XRAY } from './layers.js';

let gradient = null;

// Three hard bands: shadow, mid, lit.
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([34, 34, 34, 255, 120, 120, 120, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial({
  color = 0xffffff, map = null, normalMap = null, vertexColors = false,
  emissive = 0x000000, emissiveMap = null, emissiveIntensity = 1, side = THREE.FrontSide,
} = {}) {
  return new THREE.MeshToonMaterial({
    color, map, normalMap, vertexColors, emissive, emissiveMap, emissiveIntensity, side,
    gradientMap: toonGradient(),
  });
}

// Inverted-hull ink line. Lives on LAYER_FX so it never reaches the normal pass.
export function addHullOutline(mesh, width = 0.011, color = PALETTE.ink) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.userData.outline = { value: width };
  const skinned = mesh.isSkinnedMesh;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = mat.userData.outline;
    shader.vertexShader = 'uniform float uOutline;\n' + (skinned
      ? shader.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n\ttransformed += normalize(objectNormal) * uOutline;')
      : shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normalize(normal) * uOutline;'));
  };
  mat.customProgramCacheKey = () => (skinned ? 'hull-skinned' : 'hull-static');
  const hull = skinned ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat);
  if (skinned) hull.bind(mesh.skeleton, mesh.bindMatrix);
  hull.layers.set(LAYER_FX);
  hull.frustumCulled = false;
  hull.castShadow = false;
  mesh.add(hull);
  return hull;
}

// Flat silhouette that shows through walls in detective vision.
export function addXray(mesh, color = PALETTE.sodium) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false });
  const xray = new THREE.SkinnedMesh(mesh.geometry, mat);
  xray.bind(mesh.skeleton, mesh.bindMatrix);
  xray.layers.set(LAYER_XRAY);
  xray.frustumCulled = false;
  mesh.add(xray);
  return xray;
}
```

- [ ] **Step 2: Ink pipeline**

`src/render/inkPipeline.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX, LAYER_XRAY } from './layers.js';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uTexel;
uniform float uNear, uFar, uTime, uFlash, uDetective, uHalftone;
uniform vec3 uInk, uPaper, uDetectiveTint;
varying vec2 vUv;

float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  float dc = viewDepth(vUv);
  float gxD = 0.0, gyD = 0.0;
  vec3 gxN = vec3(0.0), gyN = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 uv = vUv + vec2(float(i), float(j)) * uTexel;
      float kx = float(i) * (j == 0 ? 2.0 : 1.0);
      float ky = float(j) * (i == 0 ? 2.0 : 1.0);
      float d = viewDepth(uv);
      vec3 n = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      gxD += d * kx; gyD += d * ky;
      gxN += n * kx; gyN += n * ky;
    }
  }
  float depthEdge = smoothstep(0.35, 0.8, length(vec2(gxD, gyD)) / max(dc, 0.1));
  float normalEdge = smoothstep(0.6, 1.2, length(gxN) + length(gyN));
  float edge = max(depthEdge, normalEdge) * (1.0 - smoothstep(70.0, 180.0, dc));

  vec3 col = texture2D(tColor, vUv).rgb;
  float L = pow(max(luma(col), 0.0), 1.0 / 2.2);

  // Halftone: dots grow as the tone darkens.
  vec2 frag = gl_FragCoord.xy;
  vec2 cell = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / uHalftone;
  float r = smoothstep(0.42, 0.10, L) * 0.62;
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.06, length(fract(cell) - 0.5));
  col = mix(col, uInk, dotMask * step(0.001, r) * 0.9);

  vec3 line = uInk;
  if (uDetective > 0.0) {
    vec3 det = uDetectiveTint * (0.08 + 0.9 * L);
    det *= 0.88 + 0.12 * sin(frag.y * 1.2 + uTime * 6.0);
    col = mix(col, det, uDetective);
    line = mix(line, uDetectiveTint * 1.6, uDetective);
  }
  col = mix(col, line, edge);
  if (uFlash > 0.0) col = mix(col, (L > 0.08 && edge < 0.5) ? uPaper : uInk, uFlash);

  col *= 0.95 + 0.05 * hash(floor(frag / 2.0) + floor(uTime * 12.0));
  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.72 * dot(v, v);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createInkPipeline(renderer, quality) {
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  colorRT.depthTexture = new THREE.DepthTexture(1, 1);
  const normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

  const uniforms = {
    tColor: { value: colorRT.texture },
    tDepth: { value: colorRT.depthTexture },
    tNormal: { value: normalRT.texture },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uDetective: { value: 0 },
    uHalftone: { value: 5 },
    uInk: { value: new THREE.Color(PALETTE.ink) },
    uPaper: { value: new THREE.Color(PALETTE.paper) },
    uDetectiveTint: { value: new THREE.Color(PALETTE.detective) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false }),
  );
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function setSize(width, height) {
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    colorRT.setSize(w, h);
    normalRT.setSize(Math.max(1, Math.floor(w * quality.normalScale)), Math.max(1, Math.floor(h * quality.normalScale)));
    uniforms.uTexel.value.set(1 / w, 1 / h).multiplyScalar(Math.max(1, pr * 0.75));
    uniforms.uHalftone.value = 5 * pr;
  }

  function render(scene, camera, time) {
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    uniforms.uTime.value = time;

    camera.layers.set(0);
    camera.layers.enable(LAYER_FX);
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);

    camera.layers.set(0);
    const { background, fog } = scene;
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = normalMat;
    renderer.setRenderTarget(normalRT);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = background;
    scene.fog = fog;

    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);

    if (uniforms.uDetective.value > 0.01) {
      camera.layers.set(LAYER_XRAY);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = true;
    }
    camera.layers.set(0);
    camera.layers.enable(LAYER_FX);
  }

  return { uniforms, setSize, render };
}
```

- [ ] **Step 3: index.html, style.css, temporary check scene**

`index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gotham Needs You</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bangers&family=Barlow+Condensed:ital,wght@0,600;1,700;1,800&family=Patrick+Hand+SC&display=swap" rel="stylesheet" />
</head>
<body>
  <canvas id="game"></canvas>
  <div id="loading" class="loading">
    <div class="cover">
      <div class="kicker">A birthday special</div>
      <h1>Gotham needs you, <span id="loading-name">Mansi</span></h1>
      <div class="bar"><i></i></div>
      <p class="mobile-note">This one needs a computer with a keyboard and mouse. Open the link on a laptop.</p>
    </div>
  </div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
```

`src/ui/style.css` (loading cover only for now; HUD styles are added in Task 7):
```css
:root { --ink: #0b0b12; --paper: #efe6cf; --signal: #f2d24b; --detective: #49b4ff; --balloon: #c8323c; }
html, body { margin: 0; height: 100%; background: var(--ink); overflow: hidden; }
canvas#game { display: block; width: 100vw; height: 100vh; }

.loading { position: fixed; inset: 0; display: grid; place-items: center; background: var(--ink); z-index: 10; }
.loading .cover { width: min(560px, 86vw); padding: 36px 32px; background: var(--paper); color: var(--ink); border: 4px solid var(--ink); box-shadow: 10px 10px 0 var(--signal); transform: rotate(-1.2deg); }
.loading .kicker { font: 600 18px 'Barlow Condensed', sans-serif; letter-spacing: 3px; text-transform: uppercase; }
.loading h1 { margin: 8px 0 22px; font: 64px/0.95 'Bangers', cursive; letter-spacing: 2px; text-transform: uppercase; }
.loading .bar { height: 10px; border: 3px solid var(--ink); }
.loading .bar i { display: block; height: 100%; width: 40%; background: var(--ink); animation: load 1.2s ease-in-out infinite alternate; }
.loading .mobile-note { display: none; font: 22px 'Patrick Hand SC', cursive; margin: 18px 0 0; }
.loading.mobile .bar { display: none; }
.loading.mobile .mobile-note { display: block; }
.loading.error .bar i { background: var(--balloon); animation: none; width: 100%; }
@keyframes load { to { width: 100%; } }
```

`src/main.js` (temporary; replaced in Task 8):
```js
import * as THREE from 'three';
import './ui/style.css';
import { getQuality } from './render/quality.js';
import { createRenderer } from './render/renderer.js';
import { createInkPipeline } from './render/inkPipeline.js';
import { toonMaterial, addHullOutline } from './render/toon.js';

const quality = getQuality('high');
const renderer = createRenderer(document.getElementById('game'), quality);
const ink = createInkPipeline(renderer, quality);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2436);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 1.5, 5);
scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 1.2));
const sun = new THREE.DirectionalLight(0xa9bde0, 2.5);
sun.position.set(-3, 5, 4);
scene.add(sun);
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 160, 24), toonMaterial({ color: 0x5b6474 }));
knot.position.y = 1.5;
addHullOutline(knot, 0.03);
scene.add(knot);
const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), toonMaterial({ color: 0x4b586e }));
scene.add(floor);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  ink.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();
document.getElementById('loading').remove();
renderer.setAnimationLoop((t) => {
  knot.rotation.y = t / 2000;
  ink.render(scene, camera, t / 1000);
});
```

- [ ] **Step 4: Verify visually**

Run: `npm run dev`, open `http://localhost:5200/` (Playwright `browser_navigate`), take a screenshot.
Expected: the knot and floor show three hard light bands, black ink contours on silhouettes and creases, halftone dots in the shadow band, subtle grain, no console errors.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add ink render pipeline and toon materials"
```

---

### Task 4: The look-test set (sky, Batsignal, skyline, rooftop, rain)

**Files:**
- Create: `src/world/sky.js`, `src/world/skyline.js`, `src/world/batsignal.js`, `src/world/lookTestSet.js`, `src/render/rain.js`

**Interfaces:**
- Consumes: `PALETTE`, `toonMaterial`, `LAYER_FX`, `createRng`, `batOutline`.
- Produces:
  - `SIGNAL_DIR` (normalized `THREE.Vector3`) exported by `sky.js`
  - `createSkyDome() -> { mesh, update(t) }`
  - `createSkyline(rng) -> THREE.Mesh`
  - `createBatsignal(lampPos, targetDir) -> { group, update(t) }`
  - `createRain(count) -> { mesh, update(t, center: Vector3) }`
  - `createLookTestSet(scene, quality, rng) -> { update(t), setFlash(k) }`

- [ ] **Step 1: Sky dome with clouds and the Batsignal emblem**

`src/world/sky.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { LAYER_FX } from '../render/layers.js';

export const SIGNAL_DIR = new THREE.Vector3(-0.35, 0.72, -0.6).normalize();

function batTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#fff';
  g.beginPath();
  batOutline().forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, 128 + x * 2.05, 128 - y * 2.05));
  g.closePath();
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const vertexShader = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform vec3 uTop, uHorizon, uGlow, uSignal, uInk, uSignalDir;
uniform sampler2D tBat;
uniform float uTime;
varying vec3 vDir;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, -0.1, 1.0);
  vec3 col = mix(uGlow, uHorizon, smoothstep(0.0, 0.12, h));
  col = mix(col, uTop, smoothstep(0.12, 0.6, h));

  vec2 cp = d.xz / max(d.y, 0.05) * 1.1 + vec2(uTime * 0.012, uTime * 0.005);
  float c = fbm(cp);
  float cloud = floor(smoothstep(0.42, 0.78, c) * 3.0) / 3.0 * smoothstep(0.02, 0.2, h);
  vec3 cloudCol = mix(uHorizon * 1.5, uGlow, 1.0 - smoothstep(0.05, 0.45, h));
  col = mix(col, cloudCol, cloud * 0.85);

  vec3 sd = normalize(uSignalDir);
  float cosA = dot(d, sd);
  vec3 right = normalize(cross(sd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, sd);
  vec2 q = vec2(dot(d, right), dot(d, up)) / max(cosA, 0.001);
  vec2 e = q / 0.17 * vec2(1.0, 1.3);
  float rad = length(e);
  float front = step(0.0, cosA);
  float inside = step(rad, 1.0) * front;
  float bat = texture2D(tBat, e * 0.5 + 0.5).r;
  float haze = smoothstep(1.6, 0.9, rad) * front;
  col = mix(col, uSignal * 0.55, haze * 0.3 * (0.4 + cloud));
  col = mix(col, mix(uSignal, uInk, bat), inside * (0.6 + 0.4 * cloud));

  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createSkyDome() {
  const uniforms = {
    uTop: { value: new THREE.Color(0x0e1422) },
    uHorizon: { value: new THREE.Color(PALETTE.gotham) },
    uGlow: { value: new THREE.Color(0x6b4a3a) },
    uSignal: { value: new THREE.Color(PALETTE.signal) },
    uInk: { value: new THREE.Color(PALETTE.ink) },
    uSignalDir: { value: SIGNAL_DIR.clone() },
    tBat: { value: batTexture() },
    uTime: { value: 0 },
  };
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(450, 48, 24),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = -1;
  mesh.frustumCulled = false;
  return { mesh, update(t, cameraPos) { uniforms.uTime.value = t; mesh.position.copy(cameraPos); } };
}
```

- [ ] **Step 2: Skyline**

`src/world/skyline.js`:
```js
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, hex } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';

const ROOF_UV = [0.5, 0.97];

function windowTexture(rng) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#10141d';
  g.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 480 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const lit = rng.chance(0.3);
      g.globalAlpha = lit ? rng.range(0.55, 1) : 1;
      g.fillStyle = lit ? hex(rng.chance(0.7) ? PALETTE.window : PALETTE.windowCool) : '#1b2230';
      g.fillRect(k * cw + 8, 32 + r * rh + 8, cw - 16, rh - 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function tower(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, ...ROOF_UV); continue; }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 16, uv.getY(i) * h / 24);
    }
  }
  return g;
}

function flatUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ...ROOF_UV);
  return g;
}

export function createSkyline(rng) {
  const geos = [];
  for (let i = 0; i < 150; i++) {
    const a = rng.range(0, Math.PI * 2);
    const dist = rng.range(28, 170);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    if (Math.abs(x) < 22 && Math.abs(z) < 22) continue;
    const w = rng.range(6, 16), d = rng.range(6, 16);
    const top = rng.range(-12, 45) * (dist > 90 ? 1.3 : 1);
    const h = top + 40;
    geos.push(tower(w, h, d).translate(x, top - h / 2, z));
    if (rng.chance(0.3)) {
      const h2 = rng.range(6, 18);
      geos.push(tower(w * 0.6, h2, d * 0.6).translate(x, top + h2 / 2, z));
      if (rng.chance(0.5)) geos.push(flatUV(new THREE.ConeGeometry(w * 0.35, 10, 4)).rotateY(Math.PI / 4).translate(x, top + h2 + 5, z));
    }
  }
  const tex = windowTexture(rng);
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    toonMaterial({ color: 0x2a3446, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }),
  );
  mesh.receiveShadow = false;
  return mesh;
}
```

- [ ] **Step 3: Batsignal lamp and beam**

`src/world/batsignal.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

const beamVertex = /* glsl */ `
varying float vAlong;
varying float vEdge;
void main() {
  vAlong = uv.y;
  vec3 n = normalize(normalMatrix * normal);
  vec3 v = normalize(-(modelViewMatrix * vec4(position, 1.0)).xyz);
  vEdge = abs(dot(n, v));
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const beamFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
varying float vAlong;
varying float vEdge;
void main() {
  float a = pow(vEdge, 1.5) * (1.0 - vAlong) * 0.32;
  a *= 0.9 + 0.1 * sin(uTime * 3.0 + vAlong * 40.0);
  gl_FragColor = vec4(uColor * a, a);
}
`;

export function createBatsignal(lampPos, target) {
  const group = new THREE.Group();
  const dir = target.clone().sub(lampPos).normalize();
  const length = target.distanceTo(lampPos) * 0.9;

  const mount = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 1.4), toonMaterial({ color: PALETTE.slate }));
  mount.position.copy(lampPos).add(new THREE.Vector3(0, -0.6, 0));
  const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.9, 1.3, 20), toonMaterial({ color: 0x3a4150 }));
  housing.position.copy(lampPos);
  housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24), new THREE.MeshBasicMaterial({ color: PALETTE.signal }));
  lens.position.copy(lampPos).addScaledVector(dir, 0.66);
  lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const uniforms = { uColor: { value: new THREE.Color(PALETTE.signal) }, uTime: { value: 0 } };
  const beamGeo = new THREE.CylinderGeometry(22, 0.7, length, 32, 1, true).translate(0, length / 2, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    uniforms, vertexShader: beamVertex, fragmentShader: beamFragment,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  }));
  beam.position.copy(lampPos);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  beam.layers.set(LAYER_FX);
  beam.frustumCulled = false;

  group.add(mount, housing, lens, beam);
  return { group, update(t) { uniforms.uTime.value = t; } };
}
```

The cylinder's `uv.y` runs 0 at the bottom (lamp) to 1 at the top, so the beam fades toward the clouds.

- [ ] **Step 4: Rain**

`src/render/rain.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX } from './layers.js';

const vertexShader = /* glsl */ `
attribute float aEnd;
attribute float aSeed;
uniform float uTime, uArea, uHeight, uSpeed, uLen;
uniform vec3 uCenter;
uniform vec2 uSlant;
varying float vA;
void main() {
  float speed = uSpeed * (0.8 + 0.4 * aSeed);
  float y = mod(position.y - uTime * speed, uHeight);
  vec3 p;
  p.x = uCenter.x + mod(position.x - uCenter.x, uArea) - uArea * 0.5 + uSlant.x * y;
  p.z = uCenter.z + mod(position.z - uCenter.z, uArea) - uArea * 0.5 + uSlant.y * y;
  p.y = uCenter.y - uHeight * 0.45 + y;
  p += vec3(uSlant.x, 1.0, uSlant.y) * uLen * aEnd;
  vA = 1.0 - aEnd;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
varying float vA;
void main() { gl_FragColor = vec4(uColor, uOpacity * vA); }
`;

export function createRain(count, { area = 36, height = 24 } = {}) {
  const pos = new Float32Array(count * 6);
  const end = new Float32Array(count * 2);
  const seed = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * area, y = Math.random() * height, z = Math.random() * area, s = Math.random();
    pos.set([x, y, z, x, y, z], i * 6);
    end.set([0, 1], i * 2);
    seed.set([s, s], i * 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uniforms = {
    uTime: { value: 0 }, uArea: { value: area }, uHeight: { value: height }, uSpeed: { value: 22 }, uLen: { value: 0.7 },
    uCenter: { value: new THREE.Vector3() }, uSlant: { value: new THREE.Vector2(0.18, 0.06) },
    uColor: { value: new THREE.Color(PALETTE.paper) }, uOpacity: { value: 0.35 },
  };
  const mesh = new THREE.LineSegments(geo, new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false }));
  mesh.frustumCulled = false;
  mesh.layers.set(LAYER_FX);
  mesh.renderOrder = 10;
  return { mesh, update(t, center) { uniforms.uTime.value = t; uniforms.uCenter.value.copy(center); } };
}
```

- [ ] **Step 5: Rooftop set**

`src/world/lookTestSet.js`:
```js
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';
import { createSkyDome, SIGNAL_DIR } from './sky.js';
import { createSkyline } from './skyline.js';
import { createBatsignal } from './batsignal.js';

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), toonMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function cylinder(rt, rb, h, color, x, y, z, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), toonMaterial({ color }));
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function puddle(rng, x, z) {
  const shape = new THREE.Shape();
  const n = 10, r0 = rng.range(0.5, 1.2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, r = r0 * rng.range(0.6, 1.1);
    const px = Math.cos(a) * r * 1.4, py = Math.sin(a) * r;
    i ? shape.lineTo(px, py) : shape.moveTo(px, py);
  }
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: PALETTE.paper, transparent: true, opacity: 0.2, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.01, z);
  m.layers.set(LAYER_FX);
  return m;
}

export function createLookTestSet(scene, quality, rng) {
  scene.background = new THREE.Color(PALETTE.fog);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.011);

  scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 1.1));
  const moon = new THREE.DirectionalLight(0xa9bde0, 2.2);
  moon.position.set(-20, 35, 12);
  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 90 });
    moon.shadow.bias = -0.0005;
    moon.shadow.normalBias = 0.02;
  }
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 2.6);
  rim.position.set(6, 8, -14);
  scene.add(rim);

  const roof = new THREE.Group();
  scene.add(roof);
  roof.add(box(30, 1, 30, PALETTE.slate, 0, -0.5, 0));
  for (const s of [-1, 1]) {
    roof.add(box(30.8, 0.9, 0.4, 0x3d4759, 0, 0.45, s * 15.2), box(31.2, 0.12, 0.7, 0x6a7489, 0, 0.96, s * 15.2));
    roof.add(box(0.4, 0.9, 30.8, 0x3d4759, s * 15.2, 0.45, 0), box(0.7, 0.12, 31.2, 0x6a7489, s * 15.2, 0.96, 0));
  }
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) roof.add(cylinder(0.12, 0.12, 3, 0x2d3340, -9 + lx * 1.2, 1.5, -9 + lz * 1.2, 8));
  roof.add(cylinder(1.8, 1.8, 3, PALETTE.wood, -9, 4.5, -9, 24), cylinder(0, 1.95, 1.1, 0x3a3f4a, -9, 6.55, -9, 24));
  roof.add(box(2, 1.2, 1.4, 0x6a7489, 7, 0.6, -6), box(2, 1.2, 1.4, 0x6a7489, 9.5, 0.6, -6));
  roof.add(cylinder(0.5, 0.5, 0.12, PALETTE.ink, 7, 1.26, -6, 16), cylinder(0.5, 0.5, 0.12, PALETTE.ink, 9.5, 1.26, -6, 16));
  roof.add(box(3.5, 3, 3, 0x3d4759, -10, 1.5, 7), box(1.1, 2.1, 0.05, PALETTE.ink, -10, 1.05, 8.53));
  roof.add(cylinder(0.05, 0.05, 7, 0x2d3340, 11, 3.5, 9, 6));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshBasicMaterial({ color: PALETTE.balloon }));
  beacon.position.set(11, 7.05, 9);
  roof.add(beacon);

  roof.add(cylinder(0.06, 0.08, 3.6, 0x2d3340, 5, 1.8, 4, 8), box(1.2, 0.08, 0.08, 0x2d3340, 5.5, 3.55, 4));
  const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), new THREE.MeshBasicMaterial({ color: PALETTE.sodium }));
  lampHead.position.set(6, 3.45, 4);
  roof.add(lampHead);
  const sodium = new THREE.PointLight(PALETTE.sodium, 30, 16, 2);
  sodium.position.set(6, 3.3, 4);
  roof.add(sodium);

  for (let i = 0; i < 6; i++) roof.add(puddle(rng, rng.range(-12, 12), rng.range(-12, 12)));

  scene.add(createSkyline(rng));
  const signalRoof = box(12, 40, 12, 0x2a3446, -18, -26, -30);
  scene.add(signalRoof);
  const signal = createBatsignal(new THREE.Vector3(-18, -4.6, -30), SIGNAL_DIR.clone().multiplyScalar(420));
  scene.add(signal.group);
  const sky = createSkyDome();
  scene.add(sky.mesh);

  return {
    update(t, cameraPos) {
      beacon.visible = Math.floor(t * 1.2) % 2 === 0;
      signal.update(t);
      sky.update(t, cameraPos);
    },
    setFlash(k) { moon.intensity = 2.2 + 10 * k; },
  };
}
```

- [ ] **Step 6: Commit** (visual check happens in Task 8 once the controller exists)

```bash
git add -A && git commit -m "Add rooftop set, skyline, sky dome with Batsignal, rain"
```

---

### Task 5: Characters (loading, animator, suit painting, goon)

**Files:**
- Create: `src/actors/animator.js`, `src/actors/assets.js`, `src/actors/rig.js`, `src/actors/outfits.js`, `src/actors/characters.js`
- Test: `tests/unit/actors.test.js`

**Interfaces:**
- Consumes: `PALETTE`, `toonMaterial`, `addHullOutline`, `addXray`, `batOutline`.
- Produces:
  - `sanitizeClip(clip) -> AnimationClip` (keeps rotations and `pelvis.position` only)
  - `createAnimator(root, clips: Map) -> { play(name, { fade, once, timeScale }) -> AnimationAction, update(dt), mixer }`
  - `loadAssets(base) -> Promise<{ bodies: { m, f }, hair, clips: Map<string, AnimationClip> }>`
  - `bindPosition(skinnedMesh, boneName) -> Vector3`, `attachRigid(skinnedMesh, boneName, object)`, `measureBody(body, eyes) -> Landmarks`
  - `Landmarks = { fwd, neckY, headCenter, headRadius, headTop, eyeY, shoulderX, elbowX, kneeY, ankleY, beltY, hipHalfWidth, chestY, chestFrontZ }`
  - `classifySuitVertex(p, lm) -> 'cowl'|'skin'|'suit'|'belt'|'glove'|'boot'`, `classifyGoonVertex(p, lm) -> 'skin'|'stripeA'|'stripeB'|'pants'|'boot'`, `SUIT_COLORS`, `GOON_COLORS`
  - `createBat(assets, suit) -> Character`, `createGoon(assets) -> Character`
  - `Character = { root: Group, model, body, lm, animator, bone(name), yaw, face(yaw), headWorld(out, lift) }`

- [ ] **Step 1: Write failing tests**

`tests/unit/actors.test.js`:
```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { sanitizeClip } from '../../src/actors/animator.js';
import { classifySuitVertex, classifyGoonVertex } from '../../src/actors/outfits.js';

const lm = {
  fwd: 1, neckY: 1.5, headCenter: { x: 0, y: 1.66, z: 0.02 }, headRadius: 0.1, headTop: 1.8, eyeY: 1.68,
  shoulderX: 0.2, elbowX: 0.5, kneeY: 0.5, ankleY: 0.1, beltY: 1.0, hipHalfWidth: 0.22, chestY: 1.35, chestFrontZ: 0.12,
};

describe('sanitizeClip', () => {
  it('keeps rotations and pelvis translation only', () => {
    const q = [0, 0, 0, 1, 0, 0, 0, 1];
    const v = [0, 0, 0, 0, 1, 0];
    const clip = new THREE.AnimationClip('T', 1, [
      new THREE.QuaternionKeyframeTrack('pelvis.quaternion', [0, 1], q),
      new THREE.VectorKeyframeTrack('pelvis.position', [0, 1], v),
      new THREE.VectorKeyframeTrack('spine_01.position', [0, 1], v),
      new THREE.VectorKeyframeTrack('spine_01.scale', [0, 1], [1, 1, 1, 1, 1, 1]),
      new THREE.QuaternionKeyframeTrack('spine_01.quaternion', [0, 1], q),
    ]);
    expect(sanitizeClip(clip).tracks.map((t) => t.name)).toEqual(['pelvis.quaternion', 'pelvis.position', 'spine_01.quaternion']);
  });
});

describe('suit regions', () => {
  it('paints the head as cowl except the lower front face', () => {
    expect(classifySuitVertex({ x: 0, y: 1.75, z: -0.05 }, lm)).toBe('cowl');
    expect(classifySuitVertex({ x: 0, y: 1.62, z: 0.1 }, lm)).toBe('skin');
    expect(classifySuitVertex({ x: 0, y: 1.62, z: -0.1 }, lm)).toBe('cowl');
  });
  it('flips the face test when the model faces -Z', () => {
    expect(classifySuitVertex({ x: 0, y: 1.62, z: -0.1 }, { ...lm, fwd: -1, headCenter: { x: 0, y: 1.66, z: -0.02 } })).toBe('skin');
  });
  it('paints forearms as gloves, shins as boots, and a belt band', () => {
    expect(classifySuitVertex({ x: 0.7, y: 1.45, z: 0 }, lm)).toBe('glove');
    expect(classifySuitVertex({ x: 0.1, y: 0.3, z: 0 }, lm)).toBe('boot');
    expect(classifySuitVertex({ x: 0.1, y: 1.0, z: 0.1 }, lm)).toBe('belt');
    expect(classifySuitVertex({ x: 0.1, y: 1.3, z: 0.1 }, lm)).toBe('suit');
  });
});

describe('goon regions', () => {
  it('stripes the shirt and leaves forearms bare', () => {
    const a = classifyGoonVertex({ x: 0, y: 1.2, z: 0 }, lm);
    const b = classifyGoonVertex({ x: 0, y: 1.27, z: 0 }, lm);
    expect(new Set([a, b])).toEqual(new Set(['stripeA', 'stripeB']));
    expect(classifyGoonVertex({ x: 0.6, y: 1.45, z: 0 }, lm)).toBe('skin');
    expect(classifyGoonVertex({ x: 0.1, y: 0.7, z: 0 }, lm)).toBe('pants');
    expect(classifyGoonVertex({ x: 0.1, y: 0.05, z: 0 }, lm)).toBe('boot');
  });
});
```

Run: `npx vitest run tests/unit/actors.test.js`
Expected: FAIL, modules missing.

- [ ] **Step 2: Animator and outfits**

`src/actors/animator.js`:
```js
import * as THREE from 'three';

// The shared skeleton has matching bone lengths, but only rotations and the pelvis
// translation are safe to apply across bodies. Scale tracks are identity noise.
export function sanitizeClip(clip) {
  const tracks = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf('.');
    const node = t.name.slice(0, dot), prop = t.name.slice(dot + 1);
    if (prop === 'scale') return false;
    if (prop === 'position') return node === 'pelvis';
    return true;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

export function createAnimator(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const actions = new Map();
  let current = null;
  const action = (name) => {
    if (!actions.has(name)) {
      const clip = clips.get(name);
      if (!clip) throw new Error(`Missing animation clip ${name}`);
      actions.set(name, mixer.clipAction(clip));
    }
    return actions.get(name);
  };
  return {
    mixer,
    play(name, { fade = 0.15, once = false, timeScale = 1 } = {}) {
      const next = action(name);
      if (next === current && !once) return next;
      next.reset();
      next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = once;
      next.timeScale = timeScale;
      next.enabled = true;
      next.setEffectiveWeight(1);
      if (current && current !== next) next.crossFadeFrom(current, fade, false);
      next.play();
      current = next;
      return next;
    },
    get currentName() { return current?.getClip().name ?? null; },
    update(dt) { mixer.update(dt); },
  };
}
```

`src/actors/outfits.js`:
```js
import { PALETTE } from '../config/palette.js';

// Per-vertex region rules, evaluated on bind-pose (T-pose) positions in meters, Y up.
export function classifySuitVertex(p, lm) {
  if (p.y > lm.neckY) {
    const front = (p.z - lm.headCenter.z) * lm.fwd;
    const face = front > lm.headRadius * 0.45 && p.y < lm.eyeY - 0.02 && p.y > lm.eyeY - 0.13;
    return face ? 'skin' : 'cowl';
  }
  const ax = Math.abs(p.x);
  if (ax > lm.elbowX) return 'glove';
  if (p.y < lm.kneeY - 0.05) return 'boot';
  if (Math.abs(p.y - lm.beltY) < 0.045 && ax < lm.hipHalfWidth + 0.06) return 'belt';
  return 'suit';
}

export function classifyGoonVertex(p, lm) {
  if (p.y > lm.neckY) return 'skin';
  if (Math.abs(p.x) > lm.shoulderX + 0.14) return 'skin';
  if (p.y < lm.ankleY + 0.06) return 'boot';
  if (p.y < lm.beltY) return 'pants';
  return Math.floor(p.y / 0.07) % 2 === 0 ? 'stripeA' : 'stripeB';
}

export const SUIT_COLORS = {
  m: { suit: PALETTE.suitGrey, cowl: PALETTE.cowl, skin: PALETTE.skin, belt: PALETTE.belt, glove: PALETTE.cowl, boot: PALETTE.cowl, emblem: PALETTE.ink, cape: PALETTE.cowl },
  f: { suit: PALETTE.suitDark, cowl: PALETTE.cowl, skin: PALETTE.skin, belt: PALETTE.belt, glove: PALETTE.belt, boot: PALETTE.cowl, emblem: PALETTE.signal, cape: PALETTE.cowl },
};

export const GOON_COLORS = {
  skin: PALETTE.skinGoon, stripeA: PALETTE.stripe, stripeB: PALETTE.jokerPurple, pants: PALETTE.pants, boot: PALETTE.ink,
};
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/actors.test.js`
Expected: PASS.

- [ ] **Step 4: Rig helpers and loading**

`src/actors/rig.js`:
```js
import * as THREE from 'three';

function boneIndex(mesh, name) {
  const i = mesh.skeleton.bones.findIndex((b) => b.name === name);
  if (i < 0) throw new Error(`No bone named ${name}`);
  return i;
}

// Bone origin in the mesh's bind space, valid in any current pose.
export function bindPosition(mesh, name) {
  const inv = mesh.skeleton.boneInverses[boneIndex(mesh, name)];
  return new THREE.Vector3().setFromMatrixPosition(inv.clone().invert()).applyMatrix4(mesh.bindMatrixInverse);
}

// Parent an object placed in bind space to a bone so it follows the animation rigidly.
export function attachRigid(mesh, name, object) {
  const i = boneIndex(mesh, name);
  object.updateMatrix();
  object.matrix.premultiply(mesh.bindMatrix).premultiply(mesh.skeleton.boneInverses[i]);
  object.matrix.decompose(object.position, object.quaternion, object.scale);
  mesh.skeleton.bones[i].add(object);
  return object;
}

export function measureBody(body, eyes) {
  const bp = (n) => bindPosition(body, n);
  const pos = body.geometry.attributes.position;
  const head = bp('Head');
  const headBox = new THREE.Box3();
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > head.y && Math.abs(v.x) < 0.15) headBox.expandByPoint(v);
  }
  const headCenter = headBox.getCenter(new THREE.Vector3());
  const headSize = headBox.getSize(new THREE.Vector3());
  eyes.geometry.computeBoundingBox();
  const eye = eyes.geometry.boundingBox.getCenter(new THREE.Vector3());
  const fwd = Math.sign(eye.z - headCenter.z) || 1;
  const chestY = bp('spine_03').y + 0.06;
  let front = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (Math.abs(v.x) < 0.03 && Math.abs(v.y - chestY) < 0.03) front = Math.max(front, v.z * fwd);
  }
  return {
    fwd,
    neckY: bp('neck_01').y,
    headCenter,
    headRadius: Math.max(headSize.x, headSize.z) / 2,
    headTop: headBox.max.y,
    eyeY: eye.y,
    shoulderX: Math.abs(bp('upperarm_l').x),
    elbowX: Math.abs(bp('lowerarm_l').x) + 0.04,
    kneeY: bp('calf_l').y,
    ankleY: bp('foot_l').y,
    beltY: bp('pelvis').y + 0.09,
    hipHalfWidth: Math.abs(bp('thigh_l').x) + 0.12,
    chestY,
    chestFrontZ: front * fwd,
  };
}
```

`src/actors/assets.js`:
```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sanitizeClip } from './animator.js';

export async function loadAssets(base = './assets/', onProgress = () => {}) {
  const loader = new GLTFLoader();
  const names = ['hero_m.glb', 'hero_f.glb', 'hair_long.glb', 'anims1.glb', 'anims2.glb'];
  let done = 0;
  const [m, f, hair, a1, a2] = await Promise.all(names.map((n) => loader.loadAsync(base + n).then((g) => { onProgress(++done / names.length); return g; })));
  const clips = new Map();
  for (const clip of [...a1.animations, ...a2.animations]) clips.set(clip.name, sanitizeClip(clip));
  return { bodies: { m: m.scene, f: f.scene }, hair: hair.scene, clips };
}
```

- [ ] **Step 5: Character assembly**

`src/actors/characters.js`:
```js
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { PALETTE } from '../config/palette.js';
import { batOutline } from '../config/batShape.js';
import { toonMaterial, addHullOutline, addXray } from '../render/toon.js';
import { createAnimator } from './animator.js';
import { attachRigid, measureBody } from './rig.js';
import { classifySuitVertex, classifyGoonVertex, SUIT_COLORS, GOON_COLORS } from './outfits.js';

function splitMeshes(model) {
  const meshes = [];
  model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  const eyes = meshes.find((m) => m.name === 'Eyes');
  const brows = meshes.find((m) => m.name === 'Eyebrows');
  const body = meshes.find((m) => m !== eyes && m !== brows);
  return { body, eyes, brows };
}

function paintRegions(mesh, classify, colors, lm) {
  mesh.geometry = mesh.geometry.clone();
  const pos = mesh.geometry.attributes.position;
  const out = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const p = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < pos.count; i++) {
    p.x = pos.getX(i); p.y = pos.getY(i); p.z = pos.getZ(i);
    c.setHex(colors[classify(p, lm)]);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  mesh.geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
}

function makeCharacter(assets, bodyKey) {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(assets.bodies[bodyKey]);
  root.add(model);
  const parts = splitMeshes(model);
  const lm = measureBody(parts.body, parts.eyes);
  const animator = createAnimator(model, assets.clips);
  const ch = {
    root, model, lm, animator, ...parts, yaw: 0,
    bone: (name) => model.getObjectByName(name),
    face(yaw) { ch.yaw = yaw; root.rotation.y = yaw + (lm.fwd < 0 ? Math.PI : 0); },
    forward: (out = new THREE.Vector3()) => out.set(Math.sin(ch.yaw), 0, Math.cos(ch.yaw)),
    headWorld(out, lift = 0) { ch.bone('Head').getWorldPosition(out); out.y += lift; return out; },
  };
  return ch;
}

function rigidMesh(geometry, material, pos, rotation = new THREE.Euler()) {
  const m = new THREE.Mesh(geometry, material);
  m.position.copy(pos);
  m.rotation.copy(rotation);
  m.castShadow = true;
  return m;
}

export function createBat(assets, suit = 'm') {
  const ch = makeCharacter(assets, suit);
  const { body, eyes, brows, lm } = ch;
  const colors = SUIT_COLORS[suit];
  paintRegions(body, classifySuitVertex, colors, lm);
  body.material = toonMaterial({ vertexColors: true, normalMap: body.material.normalMap });
  body.castShadow = true;
  eyes.material = new THREE.MeshBasicMaterial({ color: PALETTE.paper });
  brows.visible = false;
  addHullOutline(body, 0.011);

  const cowlMat = toonMaterial({ color: colors.cowl });
  for (const side of [-1, 1]) {
    const ear = rigidMesh(
      new THREE.ConeGeometry(0.022, 0.11, 10), cowlMat,
      new THREE.Vector3(side * lm.headRadius * 0.55, lm.headTop + 0.035, lm.headCenter.z),
      new THREE.Euler(0, 0, -side * 0.12),
    );
    attachRigid(body, 'Head', ear);
    addHullOutline(ear, 0.006);
  }

  const shape = new THREE.Shape(batOutline().map(([x, y]) => new THREE.Vector2(x, y)));
  const emblemGeo = new THREE.ShapeGeometry(shape).scale(0.0026, 0.0026, 1);
  const emblem = rigidMesh(
    emblemGeo,
    new THREE.MeshBasicMaterial({ color: colors.emblem, polygonOffset: true, polygonOffsetFactor: -2 }),
    new THREE.Vector3(0, lm.chestY, lm.chestFrontZ + 0.012 * lm.fwd),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  emblem.castShadow = false;
  attachRigid(body, 'spine_03', emblem);

  if (suit === 'f') {
    const src = [];
    assets.hair.traverse((o) => { if (o.isMesh) src.push(o); });
    for (const h of src) {
      const hair = rigidMesh(h.geometry, toonMaterial({ color: PALETTE.hairRed }), new THREE.Vector3());
      attachRigid(body, 'Head', hair);
      addHullOutline(hair, 0.006);
    }
  }

  ch.suit = suit;
  ch.colors = colors;
  ch.animator.play('Idle_Loop');
  return ch;
}

function clownMaskTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#efe6cf';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#0b0b12';
  for (const x of [88, 168]) {
    g.beginPath();
    g.moveTo(x, 70); g.lineTo(x + 20, 104); g.lineTo(x, 138); g.lineTo(x - 20, 104);
    g.closePath(); g.fill();
  }
  g.lineWidth = 10;
  g.strokeStyle = '#0b0b12';
  g.fillStyle = '#c8323c';
  g.beginPath();
  g.moveTo(64, 160);
  g.quadraticCurveTo(128, 238, 192, 160);
  g.quadraticCurveTo(128, 196, 64, 160);
  g.fill(); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGoon(assets) {
  const ch = makeCharacter(assets, 'm');
  const { body, eyes, brows, lm } = ch;
  paintRegions(body, classifyGoonVertex, GOON_COLORS, lm);
  body.material = toonMaterial({ vertexColors: true, normalMap: body.material.normalMap });
  body.castShadow = true;
  eyes.visible = false;
  brows.visible = false;
  addHullOutline(body, 0.011);
  ch.xray = addXray(body);

  const r = lm.headRadius * 1.12;
  const maskGeo = new THREE.SphereGeometry(r, 24, 16, Math.PI * 0.025, Math.PI * 0.95, Math.PI * 0.2, Math.PI * 0.55);
  const mask = rigidMesh(
    maskGeo, toonMaterial({ map: clownMaskTexture() }),
    lm.headCenter.clone().add(new THREE.Vector3(0, -0.01, 0.012 * lm.fwd)),
    new THREE.Euler(0, lm.fwd < 0 ? Math.PI : 0, 0),
  );
  attachRigid(body, 'Head', mask);
  addHullOutline(mask, 0.005);

  const beanie = rigidMesh(
    new THREE.SphereGeometry(r * 1.02, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42),
    toonMaterial({ color: PALETTE.pants }),
    lm.headCenter.clone().add(new THREE.Vector3(0, 0.03, 0)),
  );
  attachRigid(body, 'Head', beanie);
  addHullOutline(beanie, 0.006);

  ch.animator.play('Idle_Loop');
  return ch;
}
```

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add character loading, animator, suit and goon outfits"
```

---

### Task 6: Verlet cape

**Files:**
- Create: `src/actors/verlet.js`, `src/actors/cape.js`
- Test: `tests/unit/verlet.test.js`

**Interfaces:**
- Consumes: `Character` from Task 5 (`bone(name)`, `root`, `lm.fwd`, `forward()`), `toonMaterial`.
- Produces:
  - `createCloth({ cols, rows, topWidth, bottomWidth, length, pointDrop }) -> Cloth` (`{ cols, rows, n, pos, prev, layout, pinned, cons, rest }`)
  - `hangFrom(cloth, pins: Float32Array)`, `stepCloth(cloth, dt, { gravity, wind, damping, iterations, colliders, pins })`
  - `createCape(character, color) -> { mesh, update(dt, wind) }`

- [ ] **Step 1: Write failing tests**

`tests/unit/verlet.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createCloth, hangFrom, stepCloth } from '../../src/actors/verlet.js';

const make = () => createCloth({ cols: 5, rows: 6, topWidth: 0.3, bottomWidth: 0.9, length: 1.0, pointDrop: 0.08 });
const pinsAt = (cloth, y = 1.5) => {
  const pins = new Float32Array(cloth.cols * 3);
  for (let c = 0; c < cloth.cols; c++) pins.set([(c / (cloth.cols - 1) - 0.5) * 0.3, y, 0], c * 3);
  return pins;
};

describe('cloth', () => {
  it('pins the top row and links neighbors plus shear diagonals', () => {
    const cloth = createCloth({ cols: 3, rows: 4, topWidth: 1, bottomWidth: 1, length: 1 });
    expect(Array.from(cloth.pinned).filter(Boolean)).toHaveLength(3);
    expect(cloth.rest.length).toBe(8 + 9 + 12);
  });

  it('keeps pinned particles on their pins and stays near rest length', () => {
    const cloth = make();
    const pins = pinsAt(cloth);
    hangFrom(cloth, pins);
    for (let i = 0; i < 600; i++) stepCloth(cloth, 1 / 120, { pins });
    for (let c = 0; c < cloth.cols; c++) {
      expect(cloth.pos[c * 3]).toBeCloseTo(pins[c * 3], 5);
      expect(cloth.pos[c * 3 + 1]).toBeCloseTo(pins[c * 3 + 1], 5);
    }
    let worst = 0;
    for (let k = 0; k < cloth.rest.length; k++) {
      const a = cloth.cons[2 * k] * 3, b = cloth.cons[2 * k + 1] * 3;
      const d = Math.hypot(cloth.pos[b] - cloth.pos[a], cloth.pos[b + 1] - cloth.pos[a + 1], cloth.pos[b + 2] - cloth.pos[a + 2]);
      worst = Math.max(worst, d / cloth.rest[k]);
    }
    expect(worst).toBeLessThan(1.1);
  });

  it('pushes particles out of sphere colliders', () => {
    const cloth = make();
    const pins = pinsAt(cloth);
    hangFrom(cloth, pins);
    const sphere = { x: 0, y: 1.0, z: 0.05, r: 0.2 };
    for (let i = 0; i < 300; i++) stepCloth(cloth, 1 / 120, { pins, colliders: [sphere] });
    for (let i = cloth.cols; i < cloth.n; i++) {
      const d = Math.hypot(cloth.pos[i * 3] - sphere.x, cloth.pos[i * 3 + 1] - sphere.y, cloth.pos[i * 3 + 2] - sphere.z);
      expect(d).toBeGreaterThanOrEqual(sphere.r - 1e-3);
    }
  });
});
```

Run: `npx vitest run tests/unit/verlet.test.js`
Expected: FAIL.

- [ ] **Step 2: Implement the cloth**

`src/actors/verlet.js`:
```js
// Position-based verlet cloth. Plain arrays, no three.js, so it is unit-testable.
// Row 0 is pinned. The bottom row's even columns hang lower to make the cape's points.
export function createCloth({ cols, rows, topWidth, bottomWidth, length, pointDrop = 0 }) {
  const n = cols * rows;
  const layout = new Float32Array(n * 3);
  const pinned = new Uint8Array(n);
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1);
    const w = topWidth + (bottomWidth - topWidth) * t;
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      layout[i * 3] = (c / (cols - 1) - 0.5) * w;
      layout[i * 3 + 1] = -length * t - (r === rows - 1 && c % 2 === 0 ? pointDrop : 0);
      if (r === 0) pinned[i] = 1;
    }
  }
  const pairs = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols) pairs.push(i, i + 1);
      if (r + 1 < rows) pairs.push(i, i + cols);
      if (c + 1 < cols && r + 1 < rows) pairs.push(i, i + cols + 1, i + 1, i + cols);
    }
  }
  const cons = Int32Array.from(pairs);
  const rest = new Float32Array(cons.length / 2);
  for (let k = 0; k < rest.length; k++) {
    const a = cons[2 * k] * 3, b = cons[2 * k + 1] * 3;
    rest[k] = Math.hypot(layout[b] - layout[a], layout[b + 1] - layout[a + 1], layout[b + 2] - layout[a + 2]);
  }
  const pos = Float32Array.from(layout);
  return { cols, rows, n, pos, prev: Float32Array.from(layout), layout, pinned, cons, rest };
}

export function hangFrom(cloth, pins) {
  const { cols, n, pos, prev, layout } = cloth;
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    pos[i * 3] = pins[c * 3] + layout[i * 3] - layout[c * 3];
    pos[i * 3 + 1] = pins[c * 3 + 1] + layout[i * 3 + 1] - layout[c * 3 + 1];
    pos[i * 3 + 2] = pins[c * 3 + 2];
  }
  prev.set(pos);
}

function applyPins(cloth, pins) {
  for (let c = 0; c < cloth.cols; c++) {
    if (!cloth.pinned[c]) continue;
    cloth.pos[c * 3] = cloth.prev[c * 3] = pins[c * 3];
    cloth.pos[c * 3 + 1] = cloth.prev[c * 3 + 1] = pins[c * 3 + 1];
    cloth.pos[c * 3 + 2] = cloth.prev[c * 3 + 2] = pins[c * 3 + 2];
  }
}

export function stepCloth(cloth, dt, {
  gravity = [0, -9.8, 0], wind = [0, 0, 0], damping = 0.03, iterations = 6, colliders = [], pins = null,
} = {}) {
  const { n, pos, prev, pinned, cons, rest } = cloth;
  const dt2 = dt * dt;
  const acc = [(gravity[0] + wind[0]) * dt2, (gravity[1] + wind[1]) * dt2, (gravity[2] + wind[2]) * dt2];
  const keep = 1 - damping;
  for (let i = 0; i < n; i++) {
    if (pinned[i]) continue;
    for (let d = 0; d < 3; d++) {
      const k = i * 3 + d;
      const p = pos[k];
      pos[k] = p + (p - prev[k]) * keep + acc[d];
      prev[k] = p;
    }
  }
  for (let it = 0; it < iterations; it++) {
    if (pins) applyPins(cloth, pins);
    for (let k = 0; k < rest.length; k++) {
      const ia = cons[2 * k], ib = cons[2 * k + 1];
      const wa = pinned[ia] ? 0 : 1, wb = pinned[ib] ? 0 : 1;
      if (!(wa + wb)) continue;
      const a = ia * 3, b = ib * 3;
      const dx = pos[b] - pos[a], dy = pos[b + 1] - pos[a + 1], dz = pos[b + 2] - pos[a + 2];
      const d = Math.hypot(dx, dy, dz) || 1e-6;
      const s = (d - rest[k]) / d / (wa + wb);
      pos[a] += dx * s * wa; pos[a + 1] += dy * s * wa; pos[a + 2] += dz * s * wa;
      pos[b] -= dx * s * wb; pos[b + 1] -= dy * s * wb; pos[b + 2] -= dz * s * wb;
    }
    for (const s of colliders) {
      for (let i = 0; i < n; i++) {
        if (pinned[i]) continue;
        const k = i * 3;
        const dx = pos[k] - s.x, dy = pos[k + 1] - s.y, dz = pos[k + 2] - s.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < s.r * s.r) {
          const m = s.r / (Math.sqrt(d2) || 1e-6);
          pos[k] = s.x + dx * m; pos[k + 1] = s.y + dy * m; pos[k + 2] = s.z + dz * m;
        }
      }
    }
  }
  if (pins) applyPins(cloth, pins);
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/verlet.test.js`
Expected: PASS.

- [ ] **Step 4: Cape mesh**

`src/actors/cape.js`:
```js
import * as THREE from 'three';
import { createCloth, hangFrom, stepCloth } from './verlet.js';
import { toonMaterial } from '../render/toon.js';

const COLS = 9, ROWS = 12;

function gridIndex(cols, rows) {
  const idx = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      idx.push(i, i + cols, i + 1, i + 1, i + cols, i + cols + 1);
    }
  }
  return idx;
}

export function createCape(ch, color) {
  const cloth = createCloth({ cols: COLS, rows: ROWS, topWidth: 0.34, bottomWidth: 1.05, length: 1.18, pointDrop: 0.12 });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(cloth.pos, 3));
  geo.setIndex(gridIndex(COLS, ROWS));
  const mesh = new THREE.Mesh(geo, toonMaterial({ color, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.castShadow = true;

  const b = {
    s2: ch.bone('spine_02'), s3: ch.bone('spine_03'), pelvis: ch.bone('pelvis'),
    tl: ch.bone('thigh_l'), tr: ch.bone('thigh_r'), cl: ch.bone('calf_l'), cr: ch.bone('calf_r'), fl: ch.bone('foot_l'), fr: ch.bone('foot_r'),
  };
  const pins = new Float32Array(COLS * 3);
  const colliders = Array.from({ length: 7 }, () => ({ x: 0, y: 0, z: 0, r: 0 }));
  const fwd = new THREE.Vector3(), right = new THREE.Vector3(), anchor = new THREE.Vector3();
  const va = new THREE.Vector3(), vb = new THREE.Vector3();
  let placed = false;

  const setSphere = (s, v, r, push = 0) => { s.x = v.x + fwd.x * push; s.y = v.y; s.z = v.z + fwd.z * push; s.r = r; };
  const mid = (a, bb) => a.getWorldPosition(va).add(bb.getWorldPosition(vb)).multiplyScalar(0.5);

  function update(dt, wind = [0.6, 0, 0.3]) {
    ch.root.updateMatrixWorld(true);
    ch.forward(fwd);
    right.set(fwd.z, 0, -fwd.x);
    b.s3.getWorldPosition(anchor).addScaledVector(fwd, -0.11);
    anchor.y += 0.14;
    for (let c = 0; c < COLS; c++) {
      const t = c / (COLS - 1) - 0.5;
      pins[c * 3] = anchor.x + right.x * t * 0.34;
      pins[c * 3 + 1] = anchor.y;
      pins[c * 3 + 2] = anchor.z + right.z * t * 0.34;
    }
    if (!placed) { hangFrom(cloth, pins); placed = true; }
    setSphere(colliders[0], b.s2.getWorldPosition(va), 0.16, 0.03);
    setSphere(colliders[1], b.s3.getWorldPosition(va), 0.17, 0.03);
    setSphere(colliders[2], b.pelvis.getWorldPosition(va), 0.16, 0.02);
    setSphere(colliders[3], mid(b.tl, b.cl), 0.1);
    setSphere(colliders[4], mid(b.tr, b.cr), 0.1);
    setSphere(colliders[5], mid(b.cl, b.fl), 0.075);
    setSphere(colliders[6], mid(b.cr, b.fr), 0.075);
    if (dt <= 0) return;
    const steps = Math.min(4, Math.ceil(dt / (1 / 120)));
    for (let s = 0; s < steps; s++) stepCloth(cloth, dt / steps, { wind, damping: 0.04, iterations: 8, colliders, pins });
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  return { mesh, update };
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add verlet cloth and cape"
```

---

### Task 7: HUD and SFX words

**Files:**
- Create: `src/ui/hud.js`
- Modify: `src/ui/style.css` (append HUD styles)
- Test: `tests/unit/hud.test.js`

**Interfaces:**
- Consumes: `batSvgPath`.
- Produces: `arcDash(fraction, circumference?, span?) -> string`; `createHud(root) -> { setHealth(f), setCombo(n), setObjective(text), setBalloons(n, total), glyph(id, x, y, visible), sfx(word, x, y) }`

- [ ] **Step 1: Failing test**

`tests/unit/hud.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { arcDash } from '../../src/ui/hud.js';

describe('arcDash', () => {
  const C = 2 * Math.PI * 50;
  it('draws three quarters of the ring at full health', () => {
    expect(arcDash(1)).toBe(`${(0.75 * C).toFixed(2)} ${C.toFixed(2)}`);
  });
  it('scales and clamps', () => {
    expect(arcDash(0.5)).toBe(`${(0.375 * C).toFixed(2)} ${C.toFixed(2)}`);
    expect(arcDash(-1)).toBe(`0.00 ${C.toFixed(2)}`);
    expect(arcDash(2)).toBe(arcDash(1));
  });
});
```

Run: `npx vitest run tests/unit/hud.test.js`
Expected: FAIL.

- [ ] **Step 2: Implement**

`src/ui/hud.js`:
```js
import { batSvgPath } from '../config/batShape.js';

const R = 50;
const C = 2 * Math.PI * R;
const BOLT = 'M22 2 L6 30 L17 30 L12 52 L32 20 L20 20 L26 2 Z';
const BALLOON = '<svg width="16" height="22" viewBox="0 0 16 22"><ellipse cx="8" cy="8" rx="7" ry="8" fill="#c8323c" stroke="#0b0b12" stroke-width="1.5"/><path d="M8 16 q-2 3 0 6" stroke="#0b0b12" fill="none"/></svg>';

export function arcDash(fraction, circumference = C, span = 0.75) {
  const f = Math.min(1, Math.max(0, fraction));
  return `${(f * span * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
}

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-combo hidden"><span class="x">x</span><span class="n">0</span></div>
    <div class="hud-caption"><div class="obj"></div><div class="balloons">${BALLOON}<span>0/12</span></div></div>
    <svg class="hud-health" viewBox="0 0 120 120">
      <circle class="track" cx="60" cy="60" r="${R}" stroke-dasharray="${arcDash(1)}" transform="rotate(135 60 60)"/>
      <circle class="bar" cx="60" cy="60" r="${R}" stroke-dasharray="${arcDash(1)}" transform="rotate(135 60 60)"/>
      <path class="bat" d="${batSvgPath(0.62, 60, 62)}"/>
    </svg>
    <div class="hud-layer"></div>`;
  root.appendChild(el);
  const combo = el.querySelector('.hud-combo');
  const comboN = combo.querySelector('.n');
  const bar = el.querySelector('.bar');
  const obj = el.querySelector('.obj');
  const balloons = el.querySelector('.balloons span');
  const layer = el.querySelector('.hud-layer');
  const glyphs = new Map();

  return {
    setHealth(f) { bar.setAttribute('stroke-dasharray', arcDash(f)); },
    setCombo(n) {
      comboN.textContent = n;
      combo.classList.toggle('hidden', n === 0);
      combo.classList.toggle('ready', n >= 8);
      combo.classList.remove('pop');
      void combo.offsetWidth;
      if (n > 0) combo.classList.add('pop');
    },
    setObjective(text) { obj.textContent = text; },
    setBalloons(n, total) { balloons.textContent = `${n}/${total}`; },
    glyph(id, x, y, visible) {
      let g = glyphs.get(id);
      if (!visible) { if (g) { g.remove(); glyphs.delete(id); } return; }
      if (!g) {
        g = document.createElement('div');
        g.className = 'glyph';
        g.innerHTML = `<svg viewBox="0 0 38 54"><path d="${BOLT}"/></svg>`;
        layer.appendChild(g);
        glyphs.set(id, g);
      }
      g.style.left = `${x}px`;
      g.style.top = `${y}px`;
    },
    sfx(word, x, y) {
      const s = document.createElement('div');
      s.className = 'sfx';
      s.textContent = word;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--r', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
      s.addEventListener('animationend', () => s.remove());
      layer.appendChild(s);
    },
  };
}
```

Append to `src/ui/style.css`:
```css
.hud { position: fixed; inset: 0; pointer-events: none; font-family: 'Barlow Condensed', sans-serif; color: var(--paper); z-index: 5; }
.hud-health { position: absolute; left: 28px; bottom: 24px; width: 120px; height: 120px; filter: drop-shadow(3px 3px 0 var(--ink)); }
.hud-health .track { fill: none; stroke: rgba(11, 11, 18, 0.85); stroke-width: 12; }
.hud-health .bar { fill: none; stroke: var(--paper); stroke-width: 7; transition: stroke-dasharray 0.25s; }
.hud-health .bat { fill: var(--paper); stroke: var(--ink); stroke-width: 2; }
.hud-combo { position: absolute; left: 34px; top: 22px; transform: skewX(-12deg); font-weight: 800; font-style: italic; line-height: 0.8; text-shadow: 3px 3px 0 var(--ink); transition: opacity 0.4s; }
.hud-combo .x { font-size: 34px; opacity: 0.8; }
.hud-combo .n { display: inline-block; font-size: 88px; }
.hud-combo.hidden { opacity: 0; }
.hud-combo.pop .n { animation: pop 0.18s ease-out; }
.hud-combo.ready .n { color: var(--signal); }
@keyframes pop { from { transform: scale(1.45); } to { transform: scale(1); } }
.hud-caption { position: absolute; right: 28px; top: 24px; max-width: 320px; padding: 10px 14px; background: var(--signal); color: var(--ink); border: 3px solid var(--ink); box-shadow: 5px 5px 0 var(--ink); font: 22px/1.1 'Patrick Hand SC', cursive; transform: rotate(-1deg); }
.hud-caption .balloons { display: flex; align-items: center; gap: 6px; margin-top: 6px; font-size: 18px; }
.glyph { position: absolute; width: 38px; height: 54px; margin: -60px 0 0 -19px; filter: drop-shadow(0 0 8px var(--detective)) drop-shadow(2px 2px 0 var(--ink)); animation: glyph 0.6s linear; }
.glyph path { fill: var(--detective); stroke: var(--ink); stroke-width: 3; }
@keyframes glyph { 0% { transform: scale(1.6); opacity: 0; } 15% { transform: scale(1); opacity: 1; } }
.sfx { position: absolute; font: 64px 'Bangers', cursive; letter-spacing: 2px; color: var(--signal); -webkit-text-stroke: 3px var(--ink); paint-order: stroke fill; text-shadow: 5px 5px 0 var(--ink); white-space: nowrap; animation: sfx 0.7s ease-out forwards; }
@keyframes sfx {
  0% { transform: translate(-50%, -50%) rotate(var(--r)) scale(0.3); }
  18% { transform: translate(-50%, -50%) rotate(var(--r)) scale(1.15); }
  30% { transform: translate(-50%, -50%) rotate(var(--r)) scale(1); }
  80% { opacity: 1; }
  100% { transform: translate(-50%, -62%) rotate(var(--r)) scale(1.05); opacity: 0; }
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/unit/hud.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "Add HUD, counter glyph and SFX words"
```

---

### Task 8: Look-test controller

**Files:**
- Create: `src/lookTest.js`
- Modify: `src/main.js` (replace the temporary scene)

**Interfaces:**
- Consumes: everything above.
- Produces: `startLookTest({ canvas, hudRoot, params, onProgress }) -> Promise<void>`; `window.__look = { ready, frame, fps, punch(), counter() }`.
- URL params: `cam=hero|fight|wide|signal` (fixed camera), `suit=m|f`, `q=high|low`, `detective=1`, `fps=1`, `force=1` (skip the mobile gate).
- Controls: WASD move, mouse look after clicking the canvas (pointer lock), left click strike, right click counter, V detective vision, L lightning, 1 and 2 swap suits.

- [ ] **Step 1: Controller**

`src/lookTest.js`:
```js
import * as THREE from 'three';
import MANSI from './mansi.config.js';
import { getQuality } from './render/quality.js';
import { createRenderer } from './render/renderer.js';
import { createInkPipeline } from './render/inkPipeline.js';
import { createRain } from './render/rain.js';
import { createLookTestSet } from './world/lookTestSet.js';
import { loadAssets } from './actors/assets.js';
import { createBat, createGoon } from './actors/characters.js';
import { createCape } from './actors/cape.js';
import { createHud } from './ui/hud.js';
import { createInput } from './core/input.js';
import { createTimeControl } from './core/time.js';
import { createRng } from './core/rng.js';

const SFX_WORDS = ['THWACK!', 'KRAK!', 'WHUMP!', 'POW!'];
const STRIKES = ['Punch_Cross', 'Punch_Jab', 'Melee_Hook'];
const CAMS = {
  hero: { pos: [-1.5, 1.0, 2.7], look: [0, 1.4, 0] },
  fight: { pos: [3.4, 1.5, -1.0], look: [0.7, 1.1, 0.8] },
  wide: { pos: [9, 6, 11], look: [0, 3, -10] },
  signal: { pos: [4, 1.6, 6], look: [-6, 12, -30] },
};
const ROOF = 14;

export async function startLookTest({ canvas, hudRoot, params, onProgress = () => {} }) {
  const quality = getQuality(params.get('q') ?? 'high');
  const renderer = createRenderer(canvas, quality);
  const ink = createInkPipeline(renderer, quality);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  const rng = createRng(7);
  const set = createLookTestSet(scene, quality, rng);
  const rain = createRain(quality.rainCount);
  scene.add(rain.mesh);

  const assets = await loadAssets('./assets/', onProgress);
  const suit = params.get('suit') === 'f' ? 'f' : 'm';
  const bat = createBat(assets, suit);
  scene.add(bat.root);
  bat.face(Math.PI / 4);
  const cape = createCape(bat, bat.colors.cape);
  scene.add(cape.mesh);
  const goon = createGoon(assets);
  scene.add(goon.root);
  goon.root.position.set(1.6, 0, 1.6);
  goon.face(Math.atan2(-1.6, -1.6));

  const hud = createHud(hudRoot);
  hud.setHealth(1);
  hud.setObjective(`Gotham needs you, ${MANSI.name}. Find the stolen presents.`);
  hud.setBalloons(0, 12);

  const input = createInput(window);
  const time = createTimeControl();
  const fixedCam = CAMS[params.get('cam')] ?? null;
  const orbit = { yaw: Math.PI / 4, pitch: 0.2, dist: 3.4 };
  const state = {
    combo: 0, comboClock: 0, shake: 0, detective: params.get('detective') === '1' ? 1 : 0,
    detectiveOn: params.get('detective') === '1', flashT: 0, nextLightning: 5, health: 1, healClock: 0,
    strike: null, heroBusy: 0, goonBusy: 0, goonQueue: null, windup: 0, nextWindup: 3,
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), look = new THREE.Vector3();

  canvas.addEventListener('click', () => { if (!fixedCam) canvas.requestPointerLock?.(); });

  function toScreen(v) {
    tmp2.copy(v).project(camera);
    return { x: (tmp2.x * 0.5 + 0.5) * innerWidth, y: (-tmp2.y * 0.5 + 0.5) * innerHeight };
  }

  function goonPlay(name, then = null) {
    const a = goon.animator.play(name, { once: true, fade: 0.06 });
    state.goonBusy = a.getClip().duration / a.timeScale;
    state.goonQueue = then;
  }

  function addCombo() {
    state.combo += 1;
    state.comboClock = 1.5;
    hud.setCombo(state.combo);
  }

  function popWord(word) {
    const p = toScreen(goon.headWorld(tmp, 0.3));
    hud.sfx(word ?? rng.pick(SFX_WORDS), p.x, p.y);
  }

  function strike() {
    if (state.strike || state.heroBusy > 0) return;
    const from = bat.root.position.clone();
    const dist = from.distanceTo(goon.root.position);
    if (dist > 8) {
      bat.animator.play('Punch_Jab', { once: true, timeScale: 1.5 });
      state.strike = { t: 0, from, to: from.clone(), hit: true, dur: 0.45 };
      state.combo = 0;
      hud.setCombo(0);
      return;
    }
    const dir = tmp.copy(goon.root.position).sub(from).setY(0).normalize();
    bat.face(Math.atan2(dir.x, dir.z));
    const to = goon.root.position.clone().addScaledVector(dir, -0.85);
    bat.animator.play(rng.pick(STRIKES), { once: true, timeScale: 1.6, fade: 0.05 });
    state.strike = { t: 0, from, to, hit: false, dur: 0.55 };
  }

  function impact() {
    state.strike.hit = true;
    time.hitStop(0.06);
    state.shake = 0.12;
    addCombo();
    goonPlay(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head');
    popWord();
  }

  function counter() {
    if (state.windup <= 0) return;
    state.windup = 0;
    hud.glyph('goon', 0, 0, false);
    const dir = tmp.copy(goon.root.position).sub(bat.root.position).setY(0).normalize();
    bat.face(Math.atan2(dir.x, dir.z));
    bat.animator.play('Melee_Hook', { once: true, timeScale: 1.4, fade: 0.05 });
    state.heroBusy = 0.6;
    time.hitStop(0.12);
    state.shake = 0.2;
    addCombo();
    goonPlay('Hit_Knockback', 'LayToIdle');
    popWord('KRAK!');
  }

  function goonAttack() {
    goonPlay('Punch_Jab');
    bat.animator.play('Hit_Chest', { once: true, fade: 0.05 });
    state.heroBusy = 0.5;
    state.health = Math.max(0.1, state.health - 0.1);
    state.healClock = 3;
    hud.setHealth(state.health);
    state.combo = 0;
    hud.setCombo(0);
  }

  function updateHero(dt) {
    if (state.strike) {
      const s = state.strike;
      s.t += dt;
      const k = Math.min(1, s.t / 0.15);
      bat.root.position.lerpVectors(s.from, s.to, 1 - (1 - k) * (1 - k));
      if (!s.hit && s.t >= 0.2) impact();
      if (s.t >= s.dur) state.strike = null;
      return;
    }
    if (state.heroBusy > 0) { state.heroBusy -= dt; return; }
    const ix = (input.held('KeyD') ? 1 : 0) - (input.held('KeyA') ? 1 : 0);
    const iz = (input.held('KeyW') ? 1 : 0) - (input.held('KeyS') ? 1 : 0);
    if (ix || iz) {
      const fx = Math.sin(orbit.yaw), fz = Math.cos(orbit.yaw);
      tmp.set(fx * iz - fz * ix, 0, fz * iz + fx * ix).normalize();
      const sprint = input.held('ShiftLeft');
      bat.root.position.addScaledVector(tmp, (sprint ? 8 : 5) * dt);
      bat.root.position.x = THREE.MathUtils.clamp(bat.root.position.x, -ROOF, ROOF);
      bat.root.position.z = THREE.MathUtils.clamp(bat.root.position.z, -ROOF, ROOF);
      const target = Math.atan2(tmp.x, tmp.z);
      const delta = Math.atan2(Math.sin(target - bat.yaw), Math.cos(target - bat.yaw));
      bat.face(bat.yaw + delta * Math.min(1, dt * 12));
      bat.animator.play(sprint ? 'Sprint_Loop' : 'Jog_Fwd_Loop');
    } else {
      bat.animator.play('Idle_Loop');
    }
  }

  function updateGoon(dt) {
    if (state.goonBusy > 0) {
      state.goonBusy -= dt;
      if (state.goonBusy <= 0) {
        const next = state.goonQueue;
        state.goonQueue = null;
        if (next) goonPlay(next); else goon.animator.play('Idle_Loop');
      }
      return;
    }
    if (state.windup > 0) {
      state.windup -= dt;
      const p = toScreen(goon.headWorld(tmp, 0.35));
      hud.glyph('goon', p.x, p.y, state.windup > 0);
      if (state.windup <= 0) goonAttack();
      return;
    }
    state.nextWindup -= dt;
    if (state.nextWindup <= 0 && !state.strike) {
      state.windup = 0.6;
      state.nextWindup = 3.5;
    }
  }

  function updateCamera(dt) {
    if (fixedCam) {
      camera.position.set(...fixedCam.pos);
      look.set(...fixedCam.look);
    } else {
      orbit.yaw -= input.mouse.dx * 0.0025;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + input.mouse.dy * 0.0025, -0.15, 0.9);
      const p = bat.root.position;
      const cp = Math.cos(orbit.pitch);
      camera.position.set(
        p.x - Math.sin(orbit.yaw) * cp * orbit.dist - Math.cos(orbit.yaw) * 0.45,
        p.y + 1.55 + Math.sin(orbit.pitch) * orbit.dist,
        p.z - Math.cos(orbit.yaw) * cp * orbit.dist + Math.sin(orbit.yaw) * 0.45,
      );
      look.set(p.x - Math.cos(orbit.yaw) * 0.45, p.y + 1.35, p.z + Math.sin(orbit.yaw) * 0.45);
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt);
      const s = state.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(look);
  }

  function updateWeather(dt) {
    state.nextLightning -= dt;
    if (state.nextLightning <= 0 || input.pressed('KeyL')) {
      state.flashT = 0.26;
      state.nextLightning = rng.range(7, 14);
    }
    if (state.flashT > 0) state.flashT -= dt;
    const t = state.flashT;
    const flash = (t > 0.2 && t <= 0.26) || (t > 0.06 && t <= 0.1) ? 1 : 0;
    ink.uniforms.uFlash.value = flash;
    set.setFlash(flash);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    ink.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  const look_ = (window.__look = { ready: false, frame: 0, fps: 0, punch: strike, counter });
  let last = performance.now();
  let elapsed = 0;
  let fpsTime = 0, fpsFrames = 0;
  const fpsEl = params.get('fps') === '1' ? Object.assign(document.body.appendChild(document.createElement('div')), { style: 'position:fixed;right:8px;bottom:8px;color:#efe6cf;font:14px monospace;z-index:9' }) : null;

  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = time.scale(real);
    elapsed += real;

    if (input.clicked(0) && (document.pointerLockElement || fixedCam)) strike();
    if (input.clicked(2)) counter();
    if (input.pressed('KeyV')) state.detectiveOn = !state.detectiveOn;
    if (input.pressed('Digit1') || input.pressed('Digit2')) {
      params.set('suit', input.pressed('Digit2') ? 'f' : 'm');
      location.search = params.toString();
    }

    updateHero(dt);
    updateGoon(dt);
    if (state.comboClock > 0) { state.comboClock -= dt; if (state.comboClock <= 0) { state.combo = 0; hud.setCombo(0); } }
    if (state.healClock > 0) { state.healClock -= real; if (state.healClock <= 0) { state.health = 1; hud.setHealth(1); } }
    bat.animator.update(dt);
    goon.animator.update(dt);
    updateCamera(real);
    cape.update(dt);
    state.detective += ((state.detectiveOn ? 1 : 0) - state.detective) * Math.min(1, real * 6);
    ink.uniforms.uDetective.value = state.detective;
    updateWeather(real);
    rain.update(elapsed, camera.position);
    set.update(elapsed, camera.position);
    ink.render(scene, camera, elapsed);
    input.endFrame();

    look_.frame += 1;
    fpsTime += real; fpsFrames += 1;
    if (fpsTime >= 1) {
      look_.fps = Math.round(fpsFrames / fpsTime);
      if (fpsEl) fpsEl.textContent = `${look_.fps} fps`;
      fpsTime = 0; fpsFrames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  look_.ready = true;
}
```

- [ ] **Step 2: Entry**

`src/main.js`:
```js
import './ui/style.css';
import MANSI from './mansi.config.js';
import { startLookTest } from './lookTest.js';

const params = new URLSearchParams(location.search);
const loading = document.getElementById('loading');
document.getElementById('loading-name').textContent = MANSI.name;

if (matchMedia('(pointer: coarse)').matches && !params.has('force')) {
  loading.classList.add('mobile');
} else {
  const bar = loading.querySelector('.bar i');
  startLookTest({
    canvas: document.getElementById('game'),
    hudRoot: document.body,
    params,
    onProgress: (f) => { bar.style.animation = 'none'; bar.style.width = `${Math.round(f * 100)}%`; },
  })
    .then(() => loading.remove())
    .catch((err) => { console.error(err); loading.classList.add('error'); });
}
```

- [ ] **Step 3: Visual verification loop**

Run `npm run dev`. With Playwright, open each of `?cam=hero`, `?cam=fight`, `?cam=wide`, `?cam=signal`, `?cam=hero&suit=f`, `?cam=fight&detective=1`, and the free camera. For each: screenshot, read console errors.

Check against this list and fix any failures in the module that owns them:
- The hero reads as Batman-style: dark cowl with ears, white lenses, visible jaw, grey suit, black chest bat, yellow belt, dark gloves and boots, cape hanging behind with pointed hem. If the face skin shows at the back of the head, `lm.fwd` is wrong: check the eye bounding box in `measureBody`.
- If muscle shading looks inside-out, the normal map is DirectX-style: set `body.material.normalScale.y = -1` in `characters.js`.
- The goon reads as a Joker goon: striped shirt, clown mask facing forward, beanie.
- Ink lines on all silhouettes; no line noise across the flat roof. If the roof shows speckled lines, raise the depth-edge thresholds in `inkPipeline.js`.
- Halftone dots show in the mid-to-dark tones and do not swamp the sky. If the sky is covered in dots, gate the halftone with `* step(dc, 400.0)`.
- The Batsignal emblem is visible in the clouds, with the beam leading up to it.
- Rain streaks are visible but do not wash out the image.
- Punching (`__look.punch()` in the console) lunges, hit-stops, pops an SFX word and bumps the combo counter.
- The counter glyph appears above the goon every 3.5 s; right click during it triggers the hook and knockback.
- Detective vision turns the frame blue and shows the goon through the water tower.
- `L` fires a two-beat lightning flash.

- [ ] **Step 4: Run all unit tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "Add look-test scene controller"
```

---

### Task 9: Smoke test, screenshots, performance, sign-off

**Files:**
- Create: `playwright.config.js`, `tests/e2e/smoke.spec.js`, `scripts/shots.mjs`, `docs/look-test/*.png`

**Interfaces:**
- Consumes: `window.__look` from Task 8.

- [ ] **Step 1: Playwright config and smoke test**

`playwright.config.js`:
```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120000,
  use: {
    baseURL: 'http://localhost:5200',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] },
  },
  webServer: { command: 'npm run dev', port: 5200, reuseExistingServer: true, timeout: 60000 },
});
```

`tests/e2e/smoke.spec.js`:
```js
import { test, expect } from '@playwright/test';
import sharp from 'sharp';

for (const url of ['/?cam=fight', '/?cam=face&suit=f&q=low']) {
  test(`look test renders ${url}`, async ({ page }) => {
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.__look?.ready && window.__look.frame > 20, null, { timeout: 90000 });
    await page.evaluate(() => window.__look.punch());
    await page.waitForTimeout(400);
    const stats = await sharp(await page.screenshot()).stats();
    expect(stats.channels[0].stdev).toBeGreaterThan(8);
    expect(await page.locator('.hud-combo .n').textContent()).toBe('1');
    expect(errors).toEqual([]);
  });
}
```

Run: `npx playwright test`
Expected: 2 passed.

- [ ] **Step 2: Screenshot script**

`scripts/shots.mjs`:
```js
// Captures look-test frames on the real GPU (headed Chromium) into docs/look-test/.
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const shots = [
  ['hero-m', '?cam=hero'],
  ['hero-f', '?cam=hero&suit=f'],
  ['fight', '?cam=fight', true],
  ['wide', '?cam=wide'],
  ['signal', '?cam=signal'],
  ['detective', '?cam=fight&detective=1'],
];
await mkdir('docs/look-test', { recursive: true });
const browser = await chromium.launch({ headless: false, args: ['--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
for (const [name, query, punch] of shots) {
  await page.goto(`http://localhost:5200/${query}&fps=1`);
  await page.waitForFunction(() => window.__look?.ready && window.__look.frame > 120, null, { timeout: 90000 });
  if (punch) { await page.evaluate(() => window.__look.punch()); await page.waitForTimeout(240); }
  await page.screenshot({ path: `docs/look-test/${name}.png` });
  console.log(name, await page.evaluate(() => window.__look.fps), 'fps');
}
await browser.close();
```

Run (dev server running): `npm run shots`
Expected: six PNGs; High preset at or above 60 fps at 1600x900 on the RTX 4060 laptop.

- [ ] **Step 3: Low preset performance**

Open `http://localhost:5200/?q=low&fps=1` and note the fps. Expected: noticeably higher than High.

- [ ] **Step 4: Commit and gate**

```bash
git add -A && git commit -m "Add smoke tests and look-test screenshots"
```

Show the user all six screenshots and the fps numbers. Stop. The next plan (traversal) is written only after the user approves the look or lists changes.

---

## Later plans (written after the look sign-off)

2. Traversal: third-person controller with fixed 60 Hz step, jump, glide, dive, grapple, dive-bomb, box collision, checkpoints, camera collision.
3. Combat: targeting, combo, counter scheduler with the 2-attacker cap, cape stun, dodge, batarang, special takedown, knockdowns, grunt, knife goon and brute AI, code-authored kick clips.
4. Gotham: the connected rooftop map, three districts, glide gates, the 12 balloons and their messages.
5. The Joker boss in three phases.
6. Comic-panel cutscenes, intro, district rewards, finale, credits, title screen, settings, suit select.
7. Synthesized score and SFX.
8. Polish, performance, full playthrough, GitHub Pages deploy after user approval.
