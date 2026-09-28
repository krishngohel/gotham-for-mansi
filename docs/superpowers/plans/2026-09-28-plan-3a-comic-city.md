# Plan 3A: Comic City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every frame read as a printed comic panel. That means brush-weight ink lines that boil, cross-hatched shadows, Ben-Day dots in the mid tones and the sky, district colour palettes, a painted sky, ink rain, impact frames, action panels, speed lines and more city lettering.

**Architecture:**
- **One ink shader.** Almost everything happens in the single full-screen ink shader (`src/render/inkPipeline.js`), which reads the colour, depth and normal buffers it already has. New effects are uniforms that each switch off on the Low preset.
- **District colours.** They come from a small pure module (`src/render/comicPalette.js`) that blends palettes by camera position. It has a JS twin of the shader's snap function, so it's unit-tested.
- **Screen effects.** Screen-space comic effects that aren't per-pixel colour live in `src/ui/comicFx.js`: speed lines, the action-panel border and the impact trigger.

**Tech Stack:** Three.js 0.186 (`ShaderMaterial`, GLSL ES 3 via three's WebGL2 path), plain ES modules, Vitest 5, playwright-core scripts.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-28-traversal-comic-content-design.md` (Part A).
- Performance: no scene may be more than 10% slower on High than the current build. Measure A/B with production builds using `scripts/perf.mjs`. Low must stay the old look and old speed.
- Load time: `scripts/load-time.mjs http://localhost:5202/ 40 1` must keep `firstFrame` under 3.2 s. No new downloaded assets. Everything is procedural or GLSL.
- Lettering and art are authored in code, with no AI image tools. No em dashes in any text shown to the player.
- Commits are authored by Krishn Gohel only, with no `Co-Authored-By` trailer. Never push. The lead pushes after Task 9.
- Plan 3B runs at the same time. Don't touch `src/actors/*`, `src/world/climbables.js`, `src/world/ziplines.js`, `src/combat/*`, `src/game/story.js` or `src/game/flow.js`.
  - In `src/world/cityBuilder.js`, don't edit `fireEscape()`, `waterTower()`, `finishCity()` or `createCityContext()`. 3B owns those.
  - Both plans add a toggle to `src/core/settings.js` and `src/ui/menus.js`. Re-read those files just before editing them.
- Verify in a browser only against a frozen build: `npx vite build --outDir "$TEMP/a3dist"` and `npx vite preview --outDir "$TEMP/a3dist" --port 5203 --strictPort`.
- Baseline screenshots before any change: run `node scripts/shots.mjs` against a build of the current `main` with `BASE=http://localhost:5203/ OUT="$TEMP/a3-before"`. Keep them for the before and after review.

## File Structure

| File | Responsibility |
|---|---|
| `src/render/comicPalette.js` (new) | District palettes, `paletteAt(x, z)` blend, `snapColor()` (the JS twin of the shader) |
| `src/render/inkPipeline.js` (modify) | New ink shader: brush weight, boil, colour edges, hatching, mid and sky dots, palette snap, misregistration, paper, impact frame |
| `src/render/quality.js` (modify) | The `comic` block of per-preset effect amounts |
| `src/world/sky.js` (modify) | Inked flat clouds, moon disc with halo rings, flat signal beam |
| `src/world/batsignal.js` (modify) | Flat, hard-edged beam wedge |
| `src/render/rain.js` (modify) | Short, thick slanted dashes and comic splash marks |
| `src/ui/comicFx.js` (new) | Speed-line canvas, action-panel border, impact trigger |
| `src/ui/style.css` (modify) | Panel border, speed-line layer, tilted caption boxes |
| `src/game/game.js` (modify) | Wire the palette, impact frames, speed lines, KRAKOOM and settings |
| `src/game/camera.js` (modify) | `get actionActive()` |
| `src/core/settings.js`, `src/ui/menus.js` (modify) | `lineWobble` and `impactFrames` toggles |
| `src/world/gargoyles.js` (new) | Gargoyle meshes plus perch grapple points |
| `src/world/districts.js` (modify) | Gargoyles, landmarks, graffiti and posters |
| `src/world/cityBuilder.js` (modify `ring()` only) | Flat ink cast-shadow band under cornices |
| `tests/unit/comicPalette.test.js` (new) | Palette tests |

---

### Task 1: District palettes

**Files:**
- Create: `src/render/comicPalette.js`
- Test: `tests/unit/comicPalette.test.js`

**Interfaces:**
- Produces:
  - `DISTRICT_PALETTES` (object: district id to 6 hex numbers `[shadow, wall, wallAlt, roof, accent, light]`)
  - `DISTRICT_CENTERS` (id to `{x, z}`)
  - `paletteAt(x, z) -> number[18]` (6 linear-ish RGB triples in 0..1, blended by inverse square distance)
  - `snapColor([r, g, b], palette18, amount) -> [r, g, b]`

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/comicPalette.test.js
import { describe, it, expect } from 'vitest';
import { DISTRICT_PALETTES, DISTRICT_CENTERS, paletteAt, snapColor } from '../../src/render/comicPalette.js';

const rgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

describe('comic palettes', () => {
  it('has six swatches per district', () => {
    for (const p of Object.values(DISTRICT_PALETTES)) expect(p).toHaveLength(6);
    expect(Object.keys(DISTRICT_CENTERS).sort()).toEqual(Object.keys(DISTRICT_PALETTES).sort());
  });
  it('returns a district palette at its center', () => {
    const c = DISTRICT_CENTERS.neon;
    const p = paletteAt(c.x, c.z);
    expect(p).toHaveLength(18);
    const want = rgb(DISTRICT_PALETTES.neon[1]);
    expect(p[3]).toBeCloseTo(want[0], 2);
    expect(p[4]).toBeCloseTo(want[1], 2);
  });
  it('blends between districts', () => {
    const a = DISTRICT_CENTERS.gcpd, b = DISTRICT_CENTERS.neon;
    const p = paletteAt((a.x + b.x) / 2, (a.z + b.z) / 2);
    const ga = rgb(DISTRICT_PALETTES.gcpd[1])[0], nb = rgb(DISTRICT_PALETTES.neon[1])[0];
    expect(p[3]).toBeGreaterThan(Math.min(ga, nb) - 1e-6);
    expect(p[3]).toBeLessThan(Math.max(ga, nb) + 1e-6);
  });
  it('snaps hue toward the nearest swatch but keeps luminance', () => {
    const pal = paletteAt(DISTRICT_CENTERS.docks.x, DISTRICT_CENTERS.docks.z);
    const c = [0.5, 0.3, 0.25]; // a rusty brown
    const s = snapColor(c, pal, 1);
    expect(luma(s)).toBeCloseTo(luma(c), 3);
    expect(snapColor(c, pal, 0)).toEqual(c);
  });
  it('leaves near-black alone', () => {
    const pal = paletteAt(0, 0);
    expect(snapColor([0.01, 0.01, 0.02], pal, 1)).toEqual([0.01, 0.01, 0.02]);
  });
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run tests/unit/comicPalette.test.js`
Expected: FAIL, "Failed to resolve import".

- [ ] **Step 3: Implement**

```js
// src/render/comicPalette.js
// Each district is "coloured" by a different colourist: six swatches, blended by where the
// camera is. snapColor mirrors the ink shader's snap so it can be tested.
export const DISTRICT_PALETTES = {
  gcpd: [0x1c2433, 0x3a4a66, 0x5b6f8e, 0x2e3a4f, 0xc9a54a, 0xd9dfe9],
  docks: [0x1d2426, 0x8a4a2e, 0x2f6b6e, 0x3b3531, 0xd98c3a, 0xe6d8c0],
  neon: [0x1b1426, 0x8a2f6e, 0x3d2a5c, 0x2a2433, 0x9be23c, 0xf2c6e6],
  ace: [0x161c16, 0x4f6b2e, 0x5a3a78, 0x2d3326, 0xb9e04a, 0xdfe8c8],
  cathedral: [0x1e1c1c, 0x6e675e, 0x4f4a44, 0x34302c, 0xe8a23f, 0xefe1c4],
};
export const DISTRICT_CENTERS = {
  gcpd: { x: 0, z: 0 },
  docks: { x: -20, z: 200 },
  neon: { x: 150, z: 0 },
  ace: { x: 130, z: -160 },
  cathedral: { x: -90, z: -150 },
};

const toRgb = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const RGB = Object.fromEntries(Object.entries(DISTRICT_PALETTES).map(([k, v]) => [k, v.map(toRgb)]));

export function paletteAt(x, z, out = new Array(18).fill(0)) {
  let wsum = 0;
  out.fill(0);
  for (const [id, c] of Object.entries(DISTRICT_CENTERS)) {
    const d2 = (x - c.x) ** 2 + (z - c.z) ** 2;
    const w = 1 / (d2 + 400) ** 1.5; // sharp near a center, smooth between
    wsum += w;
    RGB[id].forEach((s, i) => { out[i * 3] += s[0] * w; out[i * 3 + 1] += s[1] * w; out[i * 3 + 2] += s[2] * w; });
  }
  for (let i = 0; i < 18; i++) out[i] /= wsum;
  return out;
}

const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Same maths as snapPalette() in the ink shader: compare chroma (colour / luminance), take
// the nearest swatch's chroma, keep the pixel's luminance.
export function snapColor(c, pal, amount) {
  const L = luma(c[0], c[1], c[2]);
  if (amount <= 0 || L < 0.02) return c;
  const cn = c.map((v) => v / Math.max(L, 1e-3));
  let best = null, bd = Infinity;
  for (let i = 0; i < 6; i++) {
    const p = [pal[i * 3], pal[i * 3 + 1], pal[i * 3 + 2]];
    const pl = Math.max(luma(p[0], p[1], p[2]), 1e-3);
    const pn = p.map((v) => v / pl);
    const d = (cn[0] - pn[0]) ** 2 + (cn[1] - pn[1]) ** 2 + (cn[2] - pn[2]) ** 2;
    if (d < bd) { bd = d; best = pn; }
  }
  const k = amount * Math.min(1, Math.max(0, (L - 0.02) / 0.06));
  return c.map((v, i) => v + (best[i] * L - v) * k);
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run tests/unit/comicPalette.test.js`
Expected: PASS (5 tests). If the luminance test fails by more than 3 decimals, the error comes from the normalised chroma. `best * L` has luminance exactly `L`, because `luma(best) == 1` by construction. Check that `pn` divides by the swatch's own luminance.

- [ ] **Step 5: Commit**

```bash
git add src/render/comicPalette.js tests/unit/comicPalette.test.js
git commit -m "District comic palettes with a tested colour snap"
```

---

### Task 2: The new ink shader

**Files:**
- Modify: `src/render/inkPipeline.js` (replace `fragmentShader`, extend `uniforms`, add `setComic()`)
- Modify: `src/render/quality.js` (add a `comic` block per preset)

**Interfaces:**
- Consumes: `paletteAt` (Task 1, called by `game.js` in Task 4).
- Produces:
  - New uniforms: `uWobble`, `uHatch`, `uMidDots`, `uSkyDots`, `uColorEdges`, `uMisreg`, `uPaletteAmt`, `uPalette` (a `vec3[6]` as 6 `THREE.Color`), `uImpact`, `uImpactCenter` and `uPaperTex`.
  - `ink.setComic(amounts)` sets the float uniforms from a `{ wobble, hatch, midDots, skyDots, colorEdges, misreg, palette, paper }` object.
  - `ink.setPalette(arr18)` copies the palette into `uPalette`.
  - `ink.impact(cx, cy)` starts a 2-frame impact.

- [ ] **Step 1: Add the quality amounts.** In `src/render/quality.js`:

```js
const PRESETS = {
  high: { name: 'high', pixelRatioCap: 2, normalScale: 1, shadows: true, shadowMapSize: 2048, rainCount: 6000,
    comic: { wobble: 1, hatch: 1, midDots: 1, skyDots: 1, colorEdges: 1, misreg: 1, palette: 0.35, paper: 1 } },
  low: { name: 'low', pixelRatioCap: 1, normalScale: 0.5, shadows: false, shadowMapSize: 0, rainCount: 2000,
    comic: { wobble: 0, hatch: 0, midDots: 0, skyDots: 0, colorEdges: 0, misreg: 0, palette: 0.35, paper: 0 } },
};
```

- [ ] **Step 2: Replace the fragment shader.** Replace the whole `fragmentShader` constant with:

```js
const fragmentShader = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uTexel;
uniform float uNear, uFar, uTime, uFlash, uDetective, uHalftone, uHalftoneAmount;
uniform float uWobble, uHatch, uMidDots, uSkyDots, uColorEdges, uMisreg, uPaletteAmt, uImpact, uPaperTex;
uniform vec2 uImpactCenter;
uniform vec3 uPalette[6];
uniform vec3 uInk, uPaper, uDetectiveTint;
varying vec2 vUv;

float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Mirrors snapColor() in src/render/comicPalette.js.
vec3 snapPalette(vec3 c, float amount) {
  float L = luma(c);
  if (amount <= 0.0 || L < 0.02) return c;
  vec3 cn = c / max(L, 1e-3);
  vec3 best = cn; float bd = 1e9;
  for (int i = 0; i < 6; i++) {
    vec3 pn = uPalette[i] / max(luma(uPalette[i]), 1e-3);
    vec3 d = cn - pn;
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = pn; }
  }
  // Saturated accents (signs, the Joker's suit, balloons) keep their own colour.
  float sat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / max(max(c.r, max(c.g, c.b)), 1e-3);
  float k = amount * clamp((L - 0.02) / 0.06, 0.0, 1.0) * (1.0 - smoothstep(0.45, 0.7, sat));
  return mix(c, best * L, k);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Boiling line: sample positions drift a little and re-roll 8 times a second.
  vec2 uvE = vUv;
  if (uWobble > 0.0) {
    vec2 bp = frag / 90.0 + floor(uTime * 8.0) * 17.13;
    uvE += (vec2(vnoise(bp), vnoise(bp + 31.7)) - 0.5) * uTexel * 2.2 * uWobble;
  }

  float dc = viewDepth(uvE);
  float ic = 1.0 / dc;
  float lap = 0.0;
  vec3 gxN = vec3(0.0), gyN = vec3(0.0);
  vec2 texel = uTexel * mix(1.6, 1.0, smoothstep(6.0, 28.0, dc));
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 uv = uvE + vec2(float(i), float(j)) * texel;
      float kx = float(i) * (j == 0 ? 2.0 : 1.0);
      float ky = float(j) * (i == 0 ? 2.0 : 1.0);
      lap += 1.0 / viewDepth(uv);
      vec3 n = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      gxN += n * kx; gyN += n * ky;
    }
  }
  lap -= 9.0 * ic;
  // Brush weight: near silhouettes also test a ring twice as wide, so outlines swell.
  float thick = 0.0;
  if (dc < 35.0) {
    vec2 t2 = texel * 2.0;
    float m = max(max(abs(1.0 / viewDepth(uvE + vec2(t2.x, 0.0)) - ic), abs(1.0 / viewDepth(uvE - vec2(t2.x, 0.0)) - ic)),
                  max(abs(1.0 / viewDepth(uvE + vec2(0.0, t2.y)) - ic), abs(1.0 / viewDepth(uvE - vec2(0.0, t2.y)) - ic)));
    thick = smoothstep(0.25, 0.5, m / ic) * (1.0 - smoothstep(20.0, 35.0, dc));
  }
  float depthEdge = max(smoothstep(0.12, 0.3, abs(lap) / ic), thick);
  // Creases are a thinner pen line.
  float normalEdge = smoothstep(0.7, 1.3, length(gxN) + length(gyN)) * 0.8;
  float edge = max(depthEdge, normalEdge) * (1.0 - smoothstep(70.0, 180.0, dc));

  // Colour, with a hair of print misregistration.
  vec3 col = texture2D(tColor, vUv).rgb;
  if (uMisreg > 0.0) {
    vec2 o = uTexel * 1.1 * uMisreg;
    col.r = mix(col.r, texture2D(tColor, vUv + vec2(o.x, o.y * 0.5)).r, 0.6);
    col.b = mix(col.b, texture2D(tColor, vUv - vec2(o.x, o.y * 0.5)).b, 0.6);
  }
  // Ink where flat colours meet (window frames, signs, road paint), close to the camera.
  if (uColorEdges > 0.0 && dc < 90.0) {
    float lx = luma(texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb) - luma(texture2D(tColor, vUv - vec2(uTexel.x, 0.0)).rgb);
    float ly = luma(texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb) - luma(texture2D(tColor, vUv - vec2(0.0, uTexel.y)).rgb);
    float ce = smoothstep(0.16, 0.32, abs(lx) + abs(ly)) * (1.0 - smoothstep(30.0, 90.0, dc)) * 0.6 * uColorEdges;
    edge = max(edge, ce);
  }
  col = snapPalette(col, uPaletteAmt);
  float L = pow(max(luma(col), 0.0), 1.0 / 2.2);

  vec2 cell = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / uHalftone;
  bool sky = dc > uFar * 0.9;
  float nearK = 1.0 - smoothstep(25.0, 80.0, dc);
  // Shadows: cross-hatching up close, Ben-Day dots further out (never both at full strength).
  float hatchZone = smoothstep(0.2, 0.1, L) * nearK * uHatch;
  float r = (0.3 * smoothstep(0.24, 0.15, L) + 0.12 * smoothstep(0.1, 0.04, L)) * (1.0 - smoothstep(60.0, 150.0, dc)) * uHalftoneAmount * (1.0 - hatchZone * 0.8);
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.06, length(fract(cell) - 0.5));
  col = mix(col, uInk, dotMask * step(0.001, r) * 0.9);
  if (hatchZone > 0.0) {
    vec2 hp = frag + (uWobble > 0.0 ? vec2(vnoise(frag / 40.0 + floor(uTime * 8.0)) * 1.5, 0.0) : vec2(0.0));
    float s = uHalftone * 0.9;
    float h1 = 1.0 - smoothstep(0.12, 0.28, abs(fract((hp.x + hp.y) / s) - 0.5));
    float h2 = 1.0 - smoothstep(0.12, 0.28, abs(fract((hp.x - hp.y) / s) - 0.5));
    float hatch = max(h1, h2 * smoothstep(0.1, 0.05, L)) * hatchZone;
    col = mix(col, uInk, hatch * 0.75);
  }
  // Mid tones: a light dot tint of the surface's own hue.
  float mid = smoothstep(0.18, 0.26, L) * (1.0 - smoothstep(0.42, 0.55, L)) * (1.0 - smoothstep(50.0, 120.0, dc)) * uMidDots;
  if (mid > 0.0 && !sky) {
    float rm = 0.22 * mid;
    float mm = 1.0 - smoothstep(rm - 0.06, rm + 0.06, length(fract(cell) - 0.5));
    col = mix(col, col * 0.62, mm);
  }
  // Sky: big dots grading toward the horizon.
  if (sky && uSkyDots > 0.0) {
    float rs = 0.3 * clamp(1.2 - vUv.y * 1.4, 0.0, 1.0) * uSkyDots;
    float sm = 1.0 - smoothstep(rs - 0.06, rs + 0.06, length(fract(cell / 2.6) - 0.5));
    col = mix(col, col * 0.72, sm * step(0.001, rs));
  }

  vec3 line = uInk;
  if (uDetective > 0.0) {
    vec3 det = uDetectiveTint * (0.08 + 0.9 * L);
    det *= 0.88 + 0.12 * sin(frag.y * 1.2 + uTime * 6.0);
    col = mix(col, det, uDetective);
    line = mix(line, uDetectiveTint * 1.6, uDetective);
  }
  col = mix(col, line, edge);
  if (uFlash > 0.0) col = mix(col, (L > 0.08 && edge < 0.5) ? uPaper : uInk, uFlash);

  // Impact frame: black and white ink with radial speed lines out from the hit.
  if (uImpact > 0.0) {
    vec3 bw = mix(uInk, uPaper, step(0.22, L));
    bw = mix(bw, uInk, edge);
    vec2 d = (vUv - uImpactCenter) * vec2(uTexel.y / uTexel.x, 1.0);
    float ang = atan(d.y, d.x);
    float rays = step(0.8, fract(ang * 9.549 + hash(vec2(floor(ang * 30.0), 1.0)) * 0.5)) * smoothstep(0.1, 0.45, length(d));
    col = mix(col, mix(bw, uInk, rays * 0.9), uImpact);
  }

  // Paper: fibres, a slow grain, and warm paper white in the highlights.
  if (uPaperTex > 0.0) {
    float fib = vnoise(frag * vec2(0.9, 0.12)) * 0.5 + vnoise(frag * 0.35) * 0.5;
    col *= 0.965 + 0.05 * fib;
    col = mix(col, uPaper, smoothstep(0.8, 1.0, L) * 0.35);
  }
  col *= 0.96 + 0.04 * hash(floor(frag / 2.0) + floor(uTime * 6.0));
  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.72 * dot(v, v);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
```

The sky test (`dc > uFar * 0.9`) works because the sky dome is on `LAYER_FX` with `depthWrite: false`, so sky pixels keep the cleared far depth.

- [ ] **Step 3: Extend the uniforms and add the API.** In `createInkPipeline`, add to `uniforms`:

```js
    uWobble: { value: 0 }, uHatch: { value: 0 }, uMidDots: { value: 0 }, uSkyDots: { value: 0 },
    uColorEdges: { value: 0 }, uMisreg: { value: 0 }, uPaletteAmt: { value: 0 }, uPaperTex: { value: 0 },
    uImpact: { value: 0 }, uImpactCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uPalette: { value: Array.from({ length: 6 }, () => new THREE.Color(0.5, 0.5, 0.5)) },
```

Before `return`, add:

```js
  let impactFrames = 0;
  function setComic(c) {
    uniforms.uWobble.value = c.wobble; uniforms.uHatch.value = c.hatch; uniforms.uMidDots.value = c.midDots;
    uniforms.uSkyDots.value = c.skyDots; uniforms.uColorEdges.value = c.colorEdges; uniforms.uMisreg.value = c.misreg;
    uniforms.uPaletteAmt.value = c.palette; uniforms.uPaperTex.value = c.paper;
  }
  function setPalette(a) { for (let i = 0; i < 6; i++) uniforms.uPalette.value[i].setRGB(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); }
  function impact(cx, cy) { uniforms.uImpactCenter.value.set(cx, cy); impactFrames = 2; }
```

In `render()`, as the first line, add:

```js
    uniforms.uImpact.value = impactFrames > 0 ? 1 : 0;
    if (impactFrames > 0) impactFrames -= 1;
```

Change the return to `return { uniforms, setSize, render, setComic, setPalette, impact };`. Call `ink.setComic(quality.comic)` right after `createInkPipeline` in `game.js`, so everything else keeps working before Task 4. Until Task 4 wires `setPalette`, the palette uniform stays grey with `uPaletteAmt` set, which washes out colour. So in this task, also add `ink.setPalette(paletteAt(0, 0))` after `setComic` (import `paletteAt`).

- [ ] **Step 4: Look at it.** Build and preview on 5203. Then run:

```bash
node scripts/shots.mjs
```

with `BASE=http://localhost:5203/ OUT="$TEMP/a3-after2"`. Compare with `$TEMP/a3-before` by reading the PNGs. Check each of these:
- Silhouettes are bolder close up.
- Creases are thin.
- Shadows show hatching near and dots far, not both.
- Mid tones show faint dots.
- The sky shows big dots near the horizon.
- There's no noisy shimmer on distant buildings.

Tune the numbers only. The structure stays.

- [ ] **Step 5: Check performance.** Build the before (`git stash` is not allowed, because other work is in progress). Use the saved build `$TEMP/gdist` of `main` as "old", and this build as "new". Run `BASE=http://localhost:5202/ node scripts/perf.mjs` and `BASE=http://localhost:5203/ node scripts/perf.mjs` back to back, twice. Expected: High within 10% at every spot. If it's over, do these in order until it passes:
  1. Skip the colour-edge samples when `dc > 60`.
  2. Drop misregistration.
  3. Use half-rate wobble.

- [ ] **Step 6: Commit**

```bash
git add src/render/inkPipeline.js src/render/quality.js src/game/game.js
git commit -m "Comic ink shader: brush weight, boiling line, hatching, mid and sky dots, palette snap, paper"
```

---

### Task 3: Settings toggles for line wobble and impact frames

**Files:**
- Modify: `src/core/settings.js`, `src/ui/menus.js`, `src/game/game.js` (`applySettings`)
- Test: `tests/unit/persistence.test.js`

**Interfaces:**
- Produces: `settings.lineWobble` and `settings.impactFrames` (booleans, both default `true`).

- [ ] **Step 1: Write the failing test**

```js
it('keeps the comic toggles as booleans, on by default', () => {
  const s = sanitizeSettings({});
  expect(s.lineWobble).toBe(true);
  expect(s.impactFrames).toBe(true);
  expect(sanitizeSettings({ lineWobble: false, impactFrames: false }).lineWobble).toBe(false);
  expect(sanitizeSettings({ impactFrames: 3 }).impactFrames).toBe(true);
});
```

Run `npx vitest run tests/unit/persistence.test.js`. Expected: FAIL.

- [ ] **Step 2: Implement.**
  - Add `lineWobble: true, impactFrames: true,` to `DEFAULT_SETTINGS`.
  - In `sanitizeSettings`, add `lineWobble: bool(r.lineWobble, d.lineWobble), impactFrames: bool(r.impactFrames, d.impactFrames),`.
  - In `menus.js`, add two toggle rows beside "Action camera" (copy that row's markup): "Line wobble" and "Impact frames (flashing)".
  - In `applySettings()` in `game.js`, add:

```js
    ink.setComic({ ...quality.comic, wobble: settings.lineWobble ? quality.comic.wobble : 0 });
```

Re-read `settings.js` and `menus.js` right before editing. Plan 3B edits them too.

- [ ] **Step 3: Run the tests and commit**

```bash
npx vitest run
git add src/core/settings.js src/ui/menus.js src/game/game.js tests/unit/persistence.test.js
git commit -m "Settings: line wobble and impact frames toggles"
```

---

### Task 4: Palette by location, impact frames, speed lines and action panels

**Files:**
- Create: `src/ui/comicFx.js`
- Modify: `src/ui/style.css`, `src/game/camera.js`, `src/game/game.js`

**Interfaces:**
- Consumes: `ink.setPalette`, `ink.impact` (Task 2), `paletteAt` (Task 1), the `critical` event (already emitted by combat), and `follow.actionShot`.
- Produces:
  - `createComicFx(root) -> { update(dt, { speed, actionActive }), panel(on) }`
  - `camera.js`: `get actionActive()` is true while an action shot runs.

- [ ] **Step 1: Add `actionActive` to the camera.** In `src/game/camera.js`, find the variable that holds the running action shot's timer in `actionShot` (read the function body). Expose it on the returned object:

```js
    get actionActive() { return actionT > 0; },
```

Use the real variable name in place of `actionT`.

- [ ] **Step 2: Write `src/ui/comicFx.js`**

```js
// Screen-space comic effects over the canvas: speed lines at the frame edge when moving fast,
// and a jagged panel border while the action camera holds a shot.
export function createComicFx(root) {
  const canvas = document.createElement('canvas');
  canvas.className = 'speed-lines';
  const panel = document.createElement('div');
  panel.className = 'action-panel';
  root.append(canvas, panel);
  const g = canvas.getContext('2d');
  const lines = Array.from({ length: 44 }, (_, i) => ({ a: (i / 44) * Math.PI * 2 + Math.random() * 0.1, len: 0.3 + Math.random() * 0.4, w: 1 + Math.random() * 2.5, ph: Math.random() }));
  let k = 0, t = 0;
  function resize() { canvas.width = Math.round(innerWidth / 2); canvas.height = Math.round(innerHeight / 2); }
  resize();
  addEventListener('resize', resize);
  return {
    update(dt, { speed = 0, actionActive = false }) {
      t += dt;
      const want = Math.min(1, Math.max(0, (speed - 16) / 20));
      k += (want - k) * Math.min(1, dt * 6);
      panel.classList.toggle('on', actionActive);
      g.clearRect(0, 0, canvas.width, canvas.height);
      if (k < 0.02) return;
      const cx = canvas.width / 2, cy = canvas.height / 2, R = Math.hypot(cx, cy);
      g.strokeStyle = 'rgba(11,11,18,0.85)';
      for (const l of lines) {
        const flick = Math.floor(t * 14 + l.ph * 10) % 3 !== 0;
        if (!flick) continue;
        const r0 = R * (1 - l.len * k), r1 = R * 1.05;
        g.lineWidth = l.w;
        g.beginPath();
        g.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
        g.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
        g.stroke();
      }
    },
    panel(on) { panel.classList.toggle('on', on); },
  };
}
```

- [ ] **Step 3: Add the CSS** to `src/ui/style.css`:

```css
.speed-lines { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 5; }
.action-panel { position: fixed; inset: 0; pointer-events: none; z-index: 6; opacity: 0; transition: opacity 0.12s; }
.action-panel.on { opacity: 1; }
.action-panel::before {
  content: ''; position: absolute; inset: -2vmin;
  /* A white gutter and a tilted, jagged ink border, as if the moment were cut into its own panel. */
  border: 3.2vmin solid #efe6cf;
  outline: 0.9vmin solid #0b0b12; outline-offset: -3.2vmin;
  transform: rotate(-1.4deg) scale(1.02);
  clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, 4% 6%, 3% 93%, 96% 95%, 97% 4%, 4% 6%);
}
```

- [ ] **Step 4: Wire it up in `game.js`.**
  - Import `createComicFx` and `paletteAt`. Create `const comicFx = createComicFx(document.body);` next to `hud` in `buildRun`, and return it in the run object.
  - In `game.update`, after the camera update, add:

```js
        comicFx.update(real, { speed: hero.control?.speed ?? Math.hypot(hero.vel.x, hero.vel.y, hero.vel.z), actionActive: follow.actionActive });
```

  - Palette follows the camera. Do this every 0.25 s, not every frame, using a module-level `palT` timer:

```js
        palT -= real;
        if (palT <= 0) { palT = 0.25; ink.setPalette(paletteAt(camera.position.x, camera.position.z, palBuf)); }
```

Declare `let palT = 0; const palBuf = new Array(18).fill(0);` near the top of `buildRun`. On the title screen, set the palette once to `paletteAt(0, 0)` (Task 2 already does this).

  - Impact frames. Next to the existing `events.on('critical', ...)`, add:

```js
    events.on('critical', () => {
      if (!settings.impactFrames) return;
      const t = combat.enemies.find((e) => e.alive) ?? null;
      const p = t ? toScreen(t.pos.clone().setY(t.pos.y + 1)) : { x: innerWidth / 2, y: innerHeight / 2 };
      ink.impact(p.x / innerWidth, 1 - p.y / innerHeight);
    });
```

- [ ] **Step 5: Verify in game.** Use `?fight=test&god=1`. Fight until a critical lands, taking a screenshot every 50 ms around it with the `dev-play` eval step `window.__game.combat` plus the existing critical path. Expected: one screenshot shows the black-and-white impact frame with rays, and one shows the panel border. For speed lines, glide off the GCPD roof while holding Sprint, then take a screenshot: lines appear at the frame edges.

- [ ] **Step 6: Run the tests and commit**

```bash
npx vitest run
git add src/ui/comicFx.js src/ui/style.css src/game/camera.js src/game/game.js
git commit -m "Impact frames, speed lines, action panels and palette by district"
```

---

### Task 5: Painted sky, flat light beams, KRAKOOM

**Files:**
- Modify: `src/world/sky.js` (fragment shader), `src/world/batsignal.js`, `src/game/game.js` (`lightning()`)

**Interfaces:**
- Consumes: `hud.sfx(word, x, y, big)` (it exists).
- Produces: no new API.

- [ ] **Step 1: Inked flat clouds.** In the sky fragment shader, replace the cloud block (from `float c = fbm(cp);` through `col = mix(col, cloudCol, cloud * 0.85);`) with:

```glsl
  float c = fbm(cp);
  float fade = smoothstep(0.02, 0.2, h);
  // Two flat tones per cloud and an inked rim where the cloud shape ends.
  float body = step(0.52, c), core = step(0.64, c);
  float rim = (1.0 - smoothstep(0.0, 0.018, abs(c - 0.52))) * fade;
  float cloud = (body * 0.6 + core * 0.4) * fade;
  vec3 lit = mix(uHorizon * 1.6, uGlow * 1.2, 1.0 - smoothstep(0.05, 0.45, h)); // lit from below by the city
  vec3 cloudCol = mix(lit * 0.75, lit, core);
  col = mix(col, cloudCol, cloud * 0.9);
  col = mix(col, uInk, rim * 0.85);
```

- [ ] **Step 2: Moon disc with halo rings.** Replace the two moon lines with:

```glsl
  float md = acos(clamp(dot(d, normalize(uMoonDir)), -1.0, 1.0));
  float disc = smoothstep(0.062, 0.058, md);
  float ring = step(0.5, fract(md * 38.0)) * smoothstep(0.26, 0.07, md) * (1.0 - disc) * 0.18;
  float moonRim = (1.0 - smoothstep(0.0, 0.004, abs(md - 0.06)));
  col = mix(col, uPaper * 0.92, disc * (1.0 - cloud * 0.6));
  col = mix(col, uPaper, ring * (1.0 - cloud));
  col = mix(col, uInk, moonRim * (1.0 - cloud * 0.6));
```

- [ ] **Step 3: Flat signal haze.** Replace `col = mix(col, uSignal * 0.55, haze * 0.3 * (0.4 + cloud));` with a hard-edged flat wedge:

```glsl
  float wedge = step(rad, 1.5) * front * uSignalOn;
  col = mix(col, uSignal * 0.6, wedge * 0.22 * (0.5 + cloud));
```

- [ ] **Step 4: The beam from the lamp.** Open `src/world/batsignal.js` and find the beam material. Make it a flat `MeshBasicMaterial` (colour `PALETTE.signal`, opacity 0.18, `transparent: true`, `depthWrite: false`, no additive blending, no gradient texture), so it reads as a flat graphic wedge. The ink shader's mid-tone dots will dot it. Keep its geometry.

- [ ] **Step 5: KRAKOOM.** In `lightning(real)` in `game.js`, right after `weather.flashT = 0.26;`, add:

```js
      if (game) game.hud.sfx('KRAKOOM!', innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.12 + Math.random() * 0.15), true);
```

- [ ] **Step 6: Look at it.** Build and preview. Take screenshots from the title orbit and from the GCPD roof looking at the moon (yaw about 2.4 rad), and force a flash with `window.__game`. Expose `lightningNow()` in the `__game` assign: it sets `weather.next = 0`. Expected: flat inked cloud shapes, a moon disc with rings, a flat signal wedge, and KRAKOOM lettered in the sky on a flash.

- [ ] **Step 7: Commit**

```bash
git add src/world/sky.js src/world/batsignal.js src/game/game.js
git commit -m "Painted comic sky: inked clouds, ringed moon, flat beams, KRAKOOM"
```

---

### Task 6: Ink rain and splash marks

**Files:**
- Modify: `src/render/rain.js`

**Interfaces:** none new.

- [ ] **Step 1: Read `src/render/rain.js` to see how the streaks and splashes are drawn.** It already has foreground streaks and, from the environment pass, splashes on whatever the player stands on.

- [ ] **Step 2: Change the streaks to comic dashes.**
  - Make streaks 40% shorter and 1.6 times thicker, with a fixed 18 degree slant in screen space. Use `uPaper` at 0.55 opacity, so they're paper-white dashes against the night.
  - Make foreground density (within 10 m) 1.5 times higher than today and background density 0.7 times, keeping the total count the same.
  - Stop the per-streak alpha gradient. Dashes are flat.

- [ ] **Step 3: Change the splashes to marks.** Replace the splash sprite or shape with a 3-stroke "crown" mark: three short lines fanning up, in paper colour, living 0.18 s. If splashes are points, draw the mark in the point shader using `gl_PointCoord`:

```glsl
  vec2 q = gl_PointCoord * 2.0 - 1.0; q.y = -q.y;
  float a = atan(q.x, q.y);
  float r = length(q);
  float stroke = (1.0 - smoothstep(0.06, 0.12, abs(fract((a + 0.9) / 0.6) - 0.5) * r)) * step(0.35, r) * step(r, 0.95) * step(abs(a), 0.95);
  if (stroke < 0.5) discard;
```

- [ ] **Step 4: Look at it and commit.** Take a screenshot from the neon street and the GCPD roof. The rain should read as drawn dashes, and splashes as small crown marks.

```bash
git add src/render/rain.js
git commit -m "Ink rain dashes and comic splash marks"
```

---

### Task 7: Tilted caption boxes

**Files:**
- Modify: `src/ui/style.css`

- [ ] **Step 1: Tilt the captions.** Find the objective card rule (the yellow box at the top right; search for the class used by `hud.card`) and the hint rule. Add:

```css
/* Comic caption boxes sit a little crooked, as if lettered and pasted onto the page. */
.card { transform: rotate(-1.2deg); box-shadow: 4px 4px 0 #0b0b12; }
.hint { transform: rotate(0.6deg); box-shadow: 3px 3px 0 #0b0b12; }
```

Use the real class names. Keep the existing borders and fonts.

- [ ] **Step 2: Take a screenshot and commit.** Check that the tilt doesn't clip text at 1280x720 or 1440x900.

```bash
git add src/ui/style.css
git commit -m "Tilted comic caption boxes"
```

---

### Task 8: City art (cast-shadow bands, gargoyles, landmarks, graffiti and posters)

**Files:**
- Modify: `src/world/cityBuilder.js` (`ring()` only)
- Create: `src/world/gargoyles.js`
- Modify: `src/world/districts.js`

**Interfaces:**
- Consumes: `solid`, `glow` and `graffiti(ctx, x, y, z, nx, nz, size, text)` from `cityBuilder.js`, and `ctx.grapple`.
- Produces: `addGargoyle(ctx, x, y, z, yaw)`, which adds its mesh plus a perch grapple point `{ x, y: y + 0.9, z, nx, nz, perch: true, gargoyle: true }`. Plan 3D uses `gargoyle: true`.

- [ ] **Step 1: Cast-shadow bands.** In `ring(ctx, key, x, z, w, d, y, hgt, over)`, after the existing geometry, add a flat ink band just under each trim ring. It sits 0.02 m proud of the wall, is 0.35 m tall, and uses the painted bucket in the ink colour:

```js
  // Comic cast shadow: a flat black band under every cornice and belt course.
  const sh = 0.35, o = 0.02;
  ctx.buckets.add('painted', box(w + o * 2, sh, 0.02, x, y - sh / 2, z - d / 2 - o), 0x0b0b12);
  ctx.buckets.add('painted', box(w + o * 2, sh, 0.02, x, y - sh / 2, z + d / 2 + o), 0x0b0b12);
  ctx.buckets.add('painted', box(0.02, sh, d + o * 2, x - w / 2 - o, y - sh / 2, z), 0x0b0b12);
  ctx.buckets.add('painted', box(0.02, sh, d + o * 2, x + w / 2 + o, y - sh / 2, z), 0x0b0b12);
```

`box` is already imported in `cityBuilder.js`. Check the signature by reading how `fireEscape` calls it. Check that `painted` accepts a per-geometry colour, as `buckets.add('painted', pane, 0x1c2331)` does.

- [ ] **Step 2: Gargoyles.**

```js
// src/world/gargoyles.js
// Crouching stone gargoyles on cathedral and deco tower corners. Each is a perch to grapple to.
import * as THREE from 'three';
import { solid } from './cityBuilder.js';

export function addGargoyle(ctx, x, y, z, yaw) {
  const stone = (geo, px, py, pz, rx = 0) => geo.rotateX(rx).translate(px, py, pz);
  const parts = [
    stone(new THREE.BoxGeometry(0.9, 0.5, 1.2), 0, 0.25, 0),               // haunches
    stone(new THREE.BoxGeometry(0.7, 0.6, 0.7), 0, 0.75, 0.35, -0.3),       // chest
    stone(new THREE.BoxGeometry(0.5, 0.45, 0.55), 0, 1.15, 0.7, 0.2),       // head
    stone(new THREE.ConeGeometry(0.09, 0.35, 5), -0.18, 1.45, 0.6, -0.4),   // horns
    stone(new THREE.ConeGeometry(0.09, 0.35, 5), 0.18, 1.45, 0.6, -0.4),
    stone(new THREE.BoxGeometry(1.4, 0.06, 0.6), 0, 0.95, -0.2, 0.5),       // folded wings
  ];
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const turn = new THREE.Matrix4().makeRotationY(yaw);
  for (const p of parts) {
    p.applyMatrix4(turn).translate(x, y, z);
    ctx.buckets.add('stone', p);
  }
  solid(ctx, 'stone', new THREE.BoxGeometry(0.9, 0.9, 1.2).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw)).translate(x, y + 0.45, z), {});
  ctx.grapple.push({ x, y: y + 0.9, z, nx: s, nz: c, perch: true, gargoyle: true });
}
```

Check that a `stone` bucket exists with `grep -n "stone" src/world/materials.js`. If it doesn't, use the bucket the cathedral uses (read `districts.js`).

In `districts.js`, place about 10 gargoyles:
- 4 on the cathedral towers' rim corners. Use the tower centres from the tower code in `districts.js`, the rim height, and yaw facing outward.
- 4 on the two tallest deco towers' corners, at their cornice height.
- 2 on the clock tower.

Each gargoyle must face outward over the street, so a grapple from the street reaches it.

- [ ] **Step 3: Landmarks.** In `districts.js`, add one bold skyline landmark each where the district lacks one:
  - **GCPD:** a lattice radio mast (4 thin legs plus cross braces, 22 m) on the tallest nearby roof, with a blinking red top light. Use `ctx.halos.add` plus `ctx.blinkers`, following how `world.js` handles `backdrop.userData.beacons`.
  - **Neon Row:** a rooftop Joker billboard. Draw a canvas texture in code: a purple background, a big green grin shape drawn with `g.arc` and teeth rectangles, and "HA HA HAPPY BIRTHDAY" in `64px Bangers`. Put it on a steel frame 12 m wide.
  - **Docks:** the lighthouse gets a flat rotating beam wedge. It's a `PlaneGeometry` in the signal colour at opacity 0.16, rotated in a `ctx.updaters` callback.

- [ ] **Step 4: Graffiti and posters.** Using the existing `graffiti()` helper, add these texts on street-level walls near story sites. Walls are found by the building faces nearest to `SITES` (from `mapData.js`); use a face's `px, pz, nx, nz` via the same `faceFrame` logic the file uses.
  - "WHERE'S THE CAKE, BAT?" near the Docks yard.
  - "PARTY'S OVER!" near Neon Row.
  - "HA HA HA" three times along the Ace yard.
  - "BIRTHDAY? WHAT BIRTHDAY?" near the cathedral plaza.
  - Paste-up posters: a 1.2 x 1.8 m canvas texture of a "WANTED" poster showing the Joker's grin shape (the same drawing function as the billboard) and "WANTED FOR CAKE THEFT". Place 6 of them around the districts.

- [ ] **Step 5: Look at it and commit.** Take screenshots at every district using `scripts/shots.mjs`, plus a close-up of a gargoyle and the billboard.

```bash
git add src/world/cityBuilder.js src/world/gargoyles.js src/world/districts.js
git commit -m "City art: ink cast-shadow bands, gargoyle perches, landmarks, story graffiti and posters"
```

---

### Task 9: Full verification (the lead runs this)

- [ ] `npx vitest run`: all pass.
- [ ] `npx playwright test`: 4 pass.
- [ ] Build to `$TEMP/gdist`, then run the playthrough (`BASE=http://localhost:5202/ node scripts/playthrough.mjs`). It must end at credits with no console errors.
- [ ] Performance A/B against the previous `main` build. On High, every spot must be within 10%. Low must be unchanged within noise.
- [ ] `node scripts/load-time.mjs http://localhost:5202/ 40 1`: `firstFrame` under 3.2 s.
- [ ] `node scripts/webkit-check.mjs http://localhost:5202/ "$TEMP/wk"`: no errors, and the screenshots look right in WebKit too (GLSL differences show up there first).
- [ ] Before and after screenshots of every district go in `docs/screens/comic-*.png`. The lead reviews them, then pushes.
