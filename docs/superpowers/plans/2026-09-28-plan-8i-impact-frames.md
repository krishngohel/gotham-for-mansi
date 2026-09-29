# Impact Frames (Part I) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make impact frames visible and scaled. Tier 1 is a two-beat black-and-white flash on criticals. Tier 2 is the flash plus a 300 ms freeze inside a tilted comic panel for the biggest blows. Everything runs on a real-time clock and has a Full, Soft or Off setting.

**Architecture:** A pure timeline module owns the beat table, the tier priority and the rate limits, and fills one reused sample object each frame. game.js maps game events to tiers, samples the timeline on real time, and drives three outputs:
- the ink shader's existing `uImpact` branch, plus one new `uImpactSoft` uniform;
- a DOM panel overlay built once at boot;
- a `time.hold('impact')` for the freeze.

**Tech Stack:** Three.js 0.186 (ShaderMaterial uniforms), plain DOM and CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-impact-frames-design.md`

## Global Constraints

- Every impact frame is timed in **real milliseconds**, never rendered frames or game time.
- Tier 1: beat 1, 45 ms at strength 1. Beat 2, 45 ms at 0.5.
- Tier 2: beats 1 and 2, then a 300 ms freeze (impact look at 0.35, panel on), then a 120 ms release (look eases to 0, panel fades).
- Tier 2 triggers:
  - a chain takedown finisher;
  - the Bat Swarm finisher;
  - the tied-bundle KAPOW;
  - the special takedown;
  - the final blow of a story fight;
  - the Joker's phase change.
- Silent stealth takedowns never trigger either tier.
- Rate limits: a tier 1 flash starts at most once every 400 ms. A tier 2 freeze starts at most once every 1500 ms, and a tier 2 request inside that window plays as tier 1 when tier 1 is allowed. A bigger or equal sequence already playing ignores the new request.
- Never in menus, pause, photo mode, comics or cutscenes. A running sequence is cancelled and the hold released.
- Setting "Impact frames" is `'full' | 'soft' | 'off'`.
  - Soft: no inversion. Speed lines and a pale vignette at 0.6. Tier 2 freezes with the panel, with no flash beats.
  - Off: nothing.
  - `SETTINGS_REV` becomes 3. Old `true` maps to `'full'`, old `false` to `'off'`, anything else to `'full'`.
- No new shader program (uniforms only). No per-frame allocation. The panel touches the DOM only when its state code changes. No new asset files.
- No em or en dashes in player-visible text.
- Commits are authored by Krishn Gohel only, with no trailers. Never push. main redeploys the live site.
- Every test browser launches muted (`--mute-audio`; WebKit through saved volume 0). The owner uses this laptop.
- Browser checks run against a frozen production build only: `npx vite build --outDir "$TEMP/idist"`, then `npx vite preview --outDir "$TEMP/idist" --port 5271 --strictPort`.

## File Structure

| File | Responsibility |
|---|---|
| `src/render/impactTimeline.js` (new) | Pure: `IMPACT` numbers, `createImpactTimeline()`: trigger, sample, cancel, active |
| `src/ui/impactPanel.js` (new) | The tier 2 panel overlay: built once, `show(x, y)` on a trigger, `set(state)` per frame (DOM only on change) |
| `src/ui/style.css` | Panel styles |
| `src/render/inkPipeline.js` | `uImpactSoft` uniform and the Soft branch; `setImpact(strength, soft, cx, cy)` replaces `impact(cx, cy)` and its frame counter |
| `src/core/settings.js`, `src/ui/menus.js` | The three-way setting and the rev 3 migration |
| `src/combat/combatSystem.js`, `src/combat/chainControl.js`, `src/combat/batSwarm.js` | `critical()` passes an `impact` field; finishers pass `impact: 2` |
| `src/game/game.js` | Event-to-tier mapping, the per-frame sample, the hold, cancellation, and a `__game.impact` test hook |
| `tests/unit/impactTimeline.test.js` (new), `tests/unit/persistence.test.js` | Unit tests |

---

### Task 1: The impact timeline (pure)

**Files:**
- Create: `src/render/impactTimeline.js`
- Test: `tests/unit/impactTimeline.test.js`

**Interfaces:**
- Produces: `IMPACT` and `createImpactTimeline(P = IMPACT)`, which returns:
  - `trigger(tier, now, mode) -> 0 | 1 | 2`: the tier that started, or 0.
  - `sample(now, out) -> out`, filling `{ impact, soft, freeze, panel, panelT }`. `panel` is 0 (hidden), 1 (freeze) or 2 (release).
  - `cancel()`
  - a getter `active`

- [ ] **Step 1: Write the failing test.** Create `tests/unit/impactTimeline.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createImpactTimeline, IMPACT } from '../../src/render/impactTimeline.js';

const out = () => ({ impact: 0, soft: false, freeze: false, panel: 0, panelT: 0 });

describe('impact timeline', () => {
  it('tier 1 is two beats, then nothing', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(1, 1000, 'full')).toBe(1);
    expect(tl.sample(1010, o).impact).toBe(1);
    expect(tl.sample(1060, o).impact).toBe(0.5);
    expect(o.freeze).toBe(false);
    expect(tl.sample(1100, o).impact).toBe(0);
    expect(tl.active).toBe(false);
  });
  it('tier 2 flashes, freezes inside the panel, then releases', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(2, 0, 'full')).toBe(2);
    expect(tl.sample(20, o)).toMatchObject({ impact: 1, freeze: false, panel: 0 });
    expect(tl.sample(200, o)).toMatchObject({ impact: IMPACT.freezeLook, freeze: true, panel: 1 });
    tl.sample(450, o);
    expect(o.panel).toBe(2);
    expect(o.freeze).toBe(false);
    expect(o.impact).toBeGreaterThan(0);
    expect(o.impact).toBeLessThan(IMPACT.freezeLook);
    expect(tl.sample(520, o)).toMatchObject({ impact: 0, panel: 0, freeze: false });
    expect(tl.active).toBe(false);
  });
  it('rate limits: tier 1 at most every 400 ms', () => {
    const tl = createImpactTimeline();
    expect(tl.trigger(1, 0, 'full')).toBe(1);
    tl.sample(200, out());
    expect(tl.trigger(1, 200, 'full')).toBe(0);
    expect(tl.trigger(1, 450, 'full')).toBe(1);
  });
  it('a tier 2 inside 1.5 s of the last one plays as tier 1', () => {
    const tl = createImpactTimeline();
    expect(tl.trigger(2, 0, 'full')).toBe(2);
    tl.sample(600, out());
    expect(tl.trigger(2, 600, 'full')).toBe(1);
    tl.sample(2000, out());
    expect(tl.trigger(2, 2000, 'full')).toBe(2);
  });
  it('the bigger tier wins: tier 2 replaces a running tier 1, tier 1 never interrupts tier 2', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(1, 0, 'full')).toBe(1);
    expect(tl.trigger(2, 20, 'full')).toBe(2);
    expect(tl.sample(20 + 200, o).freeze).toBe(true);
    expect(tl.trigger(1, 250, 'full')).toBe(0);
  });
  it('soft: no inversion beats, softer strength, tier 2 goes straight to the freeze', () => {
    const tl = createImpactTimeline(); const o = out();
    tl.trigger(1, 0, 'soft');
    expect(tl.sample(10, o)).toMatchObject({ impact: IMPACT.soft, soft: true });
    const t2 = createImpactTimeline();
    t2.trigger(2, 0, 'soft');
    expect(t2.sample(10, o)).toMatchObject({ freeze: true, panel: 1, soft: true });
  });
  it('off starts nothing, and cancel stops a running sequence', () => {
    const tl = createImpactTimeline(); const o = out();
    expect(tl.trigger(2, 0, 'off')).toBe(0);
    expect(tl.sample(10, o).impact).toBe(0);
    tl.trigger(2, 0, 'full');
    tl.cancel();
    expect(tl.sample(200, o)).toMatchObject({ impact: 0, freeze: false, panel: 0 });
  });
  it('reset forgets the rate limits (test hook)', () => {
    const tl = createImpactTimeline();
    tl.trigger(2, 0, 'full');
    tl.reset();
    expect(tl.trigger(2, 100, 'full')).toBe(2);
  });
});
```

- [ ] **Step 2: Run it.** `npx vitest run tests/unit/impactTimeline.test.js`. Expected: FAIL, because the module does not exist.

- [ ] **Step 3: Implement.** Create `src/render/impactTimeline.js`:

```js
// Impact frames on a real-time clock (milliseconds), so hit-stop and slow motion never stretch
// them. Tier 1: a two-beat black and white flash. Tier 2: the flash, then a freeze inside a comic
// panel, then a short release. Pure: the caller passes the time and owns what the numbers drive.
export const IMPACT = {
  beat: 45, freeze: 300, release: 120,
  gap1: 400, gap2: 1500,
  freezeLook: 0.35, soft: 0.6,
};

export function createImpactTimeline(P = IMPACT) {
  let tier = 0, start = 0, mode = 'full';
  let last1 = -Infinity, last2 = -Infinity;
  // Soft mode drops the flash beats from tier 2 (it goes straight to the freeze).
  const flashLen = () => (mode === 'full' || tier === 1 ? P.beat * 2 : 0);
  const total = () => (tier === 2 ? flashLen() + P.freeze + P.release : flashLen());
  return {
    get active() { return tier > 0; },
    trigger(want, now, m = 'full') {
      if (m === 'off' || !(want >= 1)) return 0;
      const t = want >= 2 && now - last2 >= P.gap2 ? 2 : 1;
      if (tier && now - start < total()) {
        if (tier >= t) return 0;
      } else if (t === 1 && now - last1 < P.gap1) return 0;
      mode = m; tier = t; start = now; last1 = now;
      if (t === 2) last2 = now;
      return t;
    },
    sample(now, out) {
      out.impact = 0; out.freeze = false; out.panel = 0; out.panelT = 0; out.soft = mode === 'soft';
      if (!tier) return out;
      const e = now - start;
      const flash = flashLen();
      if (e < flash) {
        out.impact = mode === 'full' ? (e < P.beat ? 1 : 0.5) : P.soft;
        return out;
      }
      if (tier === 1) { tier = 0; return out; }
      const f = e - flash;
      if (f < P.freeze) {
        out.impact = P.freezeLook; out.freeze = true; out.panel = 1; out.panelT = f / P.freeze;
        return out;
      }
      const r = f - P.freeze;
      if (r < P.release) {
        out.impact = P.freezeLook * (1 - r / P.release); out.panel = 2; out.panelT = r / P.release;
        return out;
      }
      tier = 0;
      return out;
    },
    cancel() { tier = 0; },
    // Test hook only (window.__game.impact.pin): forget the rate limits as well.
    reset() { tier = 0; last1 = -Infinity; last2 = -Infinity; },
  };
}
```

- [ ] **Step 4: Run it.** `npx vitest run tests/unit/impactTimeline.test.js`. Expected: PASS, 8 tests.

- [ ] **Step 5: Commit.**

```bash
git add src/render/impactTimeline.js tests/unit/impactTimeline.test.js
git commit -m "Impact timeline: real-time beats, tiers and rate limits"
```

---

### Task 2: The three-way setting and its migration

**Files:**
- Modify: `src/core/settings.js` (`SETTINGS_REV`, the default, sanitize), `src/ui/menus.js` (the camera tab)
- Test: `tests/unit/persistence.test.js` (lines 37-39 today)

**Interfaces:**
- Produces: `settings.impactFrames` in `'full' | 'soft' | 'off'`, default `'full'`.

- [ ] **Step 1: Update the tests.** In `tests/unit/persistence.test.js`, replace the three `impactFrames` expectations (today: default `true`, `false` stays `false`, `3` falls back to `true`) with:

```js
    expect(s.impactFrames).toBe('full');
    expect(sanitizeSettings({ lineWobble: false, impactFrames: false }).lineWobble).toBe(false);
    expect(sanitizeSettings({ impactFrames: false }).impactFrames).toBe('off');
    expect(sanitizeSettings({ impactFrames: true }).impactFrames).toBe('full');
    expect(sanitizeSettings({ impactFrames: 'soft' }).impactFrames).toBe('soft');
    expect(sanitizeSettings({ impactFrames: 3 }).impactFrames).toBe('full');
    expect(sanitizeSettings({}).rev).toBe(3);
```

Run `npx vitest run tests/unit/persistence.test.js`. Expected: FAIL.

- [ ] **Step 2: Implement.** In `src/core/settings.js`:
  - `export const SETTINGS_REV = 3;`
  - In the defaults, `impactFrames: 'full',`
  - In `sanitizeSettings`, replace the `impactFrames` line with:

```js
    // Rev 3: the old on/off became Full, Soft or Off. A saved true is Full, false is Off.
    impactFrames: r.impactFrames === true ? 'full' : r.impactFrames === false ? 'off' : oneOf(r.impactFrames, ['full', 'soft', 'off'], d.impactFrames),
```

  In `src/ui/menus.js`, replace the `toggle('Impact frames (flashing)', ...)` line in the camera tab with:

```js
      body.appendChild(choice('Impact frames', settings.impactFrames, [['full', 'Full'], ['soft', 'Soft (no flashing)'], ['off', 'Off']], (v) => { settings.impactFrames = v; }));
```

  Grep `src` for every other read of `settings.impactFrames` and list them. game.js ~439 is replaced in Task 4. Any other reader that treats it as a boolean must compare against `'off'` instead.

- [ ] **Step 3: Run.** `npx vitest run`. Expected: all pass. Any test asserting `rev: 2` is updated to 3, and the fps-counter migration (`rev >= 2`) is unchanged.

- [ ] **Step 4: Commit.**

```bash
git add src/core/settings.js src/ui/menus.js tests/unit/persistence.test.js
git commit -m "Impact frames setting: Full, Soft or Off (settings rev 3)"
```

---

### Task 3: Shader strength and Soft mode, and the panel overlay

**Files:**
- Modify: `src/render/inkPipeline.js` (uniform list line ~17, the impact branch ~148-156, uniforms ~234, `impact()` and its frame counter ~273-286)
- Create: `src/ui/impactPanel.js`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `ink.setImpact(strength, soft, cx, cy)`. `cx` and `cy` are optional, 0 to 1 in UV with y up. It replaces `ink.impact(cx, cy)`, which is deleted along with `impactFrames`.
  - `createImpactPanel(root, rng)`, which returns `{ show(x, y), set(state), state }`.

- [ ] **Step 1: The shader.** Add `uImpactSoft` to the uniform declaration line (`uniform float ... uImpact, uImpactSoft, uPaperTex, uFilter;`) and to the uniforms object (`uImpactSoft: { value: 0 },`). Replace the impact branch with:

```glsl
  // Impact frame: black and white ink with radial speed lines out from the hit. Soft mode keeps
  // the lines over a pale paper vignette and never inverts (no flashing).
  if (uImpact > 0.0) {
    vec2 d = (vUv - uImpactCenter) * vec2(uTexel.y / uTexel.x, 1.0);
    float ang = atan(d.y, d.x);
    float rays = step(0.8, fract(ang * 9.549 + hash(vec2(floor(ang * 30.0), 1.0)) * 0.5)) * smoothstep(0.1, 0.45, length(d));
    if (uImpactSoft > 0.5) {
      vec3 pale = mix(col, uPaper, smoothstep(0.35, 0.95, length(d)) * 0.55);
      col = mix(col, mix(pale, uInk, rays * 0.6), uImpact);
    } else {
      vec3 bw = mix(uInk, uPaper, step(0.22, L));
      bw = mix(bw, uInk, edge);
      col = mix(col, mix(bw, uInk, rays * 0.9), uImpact);
    }
  }
```

(`L` and `edge` are the variables the existing branch already uses in that scope.)

- [ ] **Step 2: The pipeline API.** Delete `let impactFrames = 0;`, the `impact(cx, cy)` function, and the two `impactFrames` lines at the top of `render()`. Add:

```js
  // Driven every frame by the impact timeline (game.js). Uniform writes only: no new program.
  function setImpact(strength, soft, cx, cy) {
    uniforms.uImpact.value = strength;
    uniforms.uImpactSoft.value = soft ? 1 : 0;
    if (cx !== undefined) uniforms.uImpactCenter.value.set(cx, cy);
  }
```

Export `setImpact` in the returned object in place of `impact`. Grep `src` for `ink.impact(` and `.impact(` on the pipeline object. game.js ~441 is the only known caller, and Task 4 replaces it.

- [ ] **Step 3: The panel.** Create `src/ui/impactPanel.js`:

```js
// The tier 2 comic panel: a tilted ink border on a paper gutter, and a halftone burst behind the
// hit, built once at boot. show() places it (once per trigger); set() runs every frame but only
// touches the DOM when the state code changes (0 hidden, 1 frozen, 2 releasing).
export function createImpactPanel(root, rng = Math.random) {
  const el = document.createElement('div');
  el.className = 'impact-panel';
  el.innerHTML = '<div class="ip-burst"></div><div class="ip-frame"></div>';
  // First child of the HUD root, so sound words and the HUD draw on top of it.
  root.insertBefore(el, root.firstChild);
  let state = 0;
  return {
    get state() { return state; },
    show(x, y) {
      el.style.setProperty('--ix', `${Math.round(x)}px`);
      el.style.setProperty('--iy', `${Math.round(y)}px`);
      el.style.setProperty('--tilt', `${((2 + rng() * 2) * (rng() < 0.5 ? -1 : 1)).toFixed(2)}deg`);
    },
    set(next) {
      if (next === state) return;
      state = next;
      el.className = next === 1 ? 'impact-panel on' : next === 2 ? 'impact-panel on out' : 'impact-panel';
    },
  };
}
```

Append to `src/ui/style.css`:

```css
/* Impact frames, tier 2: the moment framed as a tilted comic panel. */
.impact-panel { position: fixed; inset: 0; pointer-events: none; opacity: 0; }
.impact-panel.on { opacity: 1; }
.impact-panel.out { opacity: 0; transform: scale(0.97); transition: opacity 0.12s linear, transform 0.12s ease-out; }
.impact-panel .ip-frame { position: absolute; inset: 3.5vmin; border: 1.3vmin solid #111; box-shadow: 0 0 0 100vmax rgba(240, 232, 210, 0.92); transform: rotate(var(--tilt, 3deg)); }
.impact-panel .ip-burst { position: absolute; left: var(--ix, 50%); top: var(--iy, 50%); width: 62vmin; height: 62vmin; transform: translate(-50%, -50%); opacity: 0.5;
  background: radial-gradient(circle, #111 1.3px, transparent 1.8px) 0 0 / 9px 9px;
  -webkit-mask-image: radial-gradient(circle, #000 18%, transparent 70%); mask-image: radial-gradient(circle, #000 18%, transparent 70%); }
```

- [ ] **Step 4: Check.** Run `npx vitest run`: all pass. Run `node --check src/ui/impactPanel.js`. There's no browser check yet; Task 4 wires everything.

- [ ] **Step 5: Commit.**

```bash
git add src/render/inkPipeline.js src/ui/impactPanel.js src/ui/style.css
git commit -m "Ink impact strength and Soft mode; the tier 2 comic panel overlay"
```

---

### Task 4: Wire the tiers, the clock, the freeze and the cancellations

**Files:**
- Modify: `src/combat/combatSystem.js` (`critical()` ~94; the tied-bundle KAPOW ~156)
- Modify: `src/combat/chainControl.js` (the finisher critical ~224)
- Modify: `src/combat/batSwarm.js` (the finisher critical ~62)
- Modify: `src/game/game.js` (the critical listener ~438-443; `update(real)` ~596; the `__game` api)

**Interfaces:**
- Consumes:
  - `createImpactTimeline` (Task 1);
  - `settings.impactFrames` (Task 2);
  - `ink.setImpact` and `createImpactPanel` (Task 3);
  - events `critical { target, variant, impact }`, `special`, `lastHit`, `bossPhase`;
  - `flow.objectives.step?.type`, `boss.joker`, `time.hold` and `time.release`, `photo.active`, `comic.playing`, `state.paused`.
- Produces: `window.__game.impact = { fire(tier, target), pin(ms | null), sample }`, a test hook.

- [ ] **Step 1: Carry the tier on critical.** In `combatSystem.js`, change `critical` to take and emit `impact`:

```js
  function critical(target, { slow = 0.55, scale = 0.28, shot, variant, impact } = {}) {
    time.slowMo(slow, scale);
    target.ch.headWorld(chest, -0.4);
    follow.actionShot?.(chest.clone(), hero.pos.clone(), slow + 0.35, shot);
    events.emit('critical', { target, variant, impact });
  }
```

Add `impact: 2` to the options of three calls:
- the tied-bundle KAPOW critical (~156);
- the chain finisher in `chainControl.js` (`if (s.finisher) api.critical(focus, { ..., variant: chain.id, impact: 2 })`, not the heel critical on the next line);
- the Bat Swarm finisher in `batSwarm.js` (`api.critical(focus, { slow: 1, scale: 0.25, variant: 'swarm', impact: 2 })`).

Check that `chainApi`'s `critical` passes its options object through unchanged.

- [ ] **Step 2: Map events to tiers.** In `game.js`, add the imports:

```js
import { createImpactTimeline } from '../render/impactTimeline.js';
import { createImpactPanel } from '../ui/impactPanel.js';
```

Replace the existing `events.on('critical', ({ target } = {}) => { if (!settings.impactFrames) return; ... ink.impact(...) })` listener. Keep the `hud.critical(variant)` listener. Use:

```js
    // Impact frames (Part I). Tier 1: every critical. Tier 2: chain and swarm finishers, the
    // tied-bundle KAPOW (critical `impact: 2`), the special takedown and a story fight's last blow
    // (they upgrade the critical that follows within 150 ms), and the Joker's phase change.
    const impactTl = createImpactTimeline();
    const impactOut = { impact: 0, soft: false, freeze: false, panel: 0, panelT: 0 };
    const impactPanel = createImpactPanel(hudRoot);
    let bigUntil = -Infinity, impactPin = null, impactPinBase = 0;
    function fireImpact(tier, target) {
      const mode = settings.impactFrames;
      const p = target ? toScreen(target.pos.clone().setY(target.pos.y + 1)) : null;
      const at = p && !p.behind ? p : { x: innerWidth / 2, y: innerHeight / 2 };
      const got = impactTl.trigger(tier, performance.now(), mode);
      if (!got) return 0;
      ink.setImpact(0, mode === 'soft', at.x / innerWidth, 1 - at.y / innerHeight);
      if (got === 2) impactPanel.show(at.x, at.y);
      return got;
    }
    events.on('special', () => { bigUntil = performance.now() + 150; });
    events.on('lastHit', () => { if (flow.objectives.step?.type === 'fight') bigUntil = performance.now() + 150; });
    events.on('critical', ({ target, impact } = {}) => {
      const big = impact === 2 || performance.now() < bigUntil;
      bigUntil = -Infinity;
      fireImpact(big ? 2 : 1, target);
    });
    events.on('bossPhase', () => fireImpact(2, boss.joker));
```

If `hudRoot`, `flow`, `boss` or `toScreen` aren't in scope at that point, move the block to where they are (they all exist inside the same game setup today) and say where in the commit message. Grep for how the HUD root is named in scope; it is the root passed to `createHud`.

- [ ] **Step 3: Sample on real time, drive the freeze, cancel where it must not play.** In `update(real)`, right after `const playing = ...` and before `const dt = ...` (the freeze must apply this frame), add:

```js
      // Impact frames run on real time, sampled before hit-stop and slow motion apply. Menus,
      // pause, photo mode and comics cancel a sequence (and its hold) outright.
      if (impactTl.active && (!playing || state.paused || comic.playing || photo.active)) impactTl.cancel();
      impactTl.sample(impactPin === null ? performance.now() : impactPinBase + impactPin, impactOut);
      ink.setImpact(impactOut.impact, impactOut.soft);
      impactPanel.set(impactOut.panel);
      if (impactOut.freeze) time.hold('impact', 0.01); else time.release('impact');
```

(`time.hold` clamps to a 0.01 minimum and is a no-op when unchanged, and `time.release` is a no-op when absent, so nothing allocates per frame.)

- [ ] **Step 4: The test hook.** Add to the object merged into `window.__game`, next to `spawn` and `despawn`:

```js
      impact: {
        fire: (tier, target) => fireImpact(tier, target),
        // Pins the sampled time `ms` into the sequence started by the next fire(), for screenshots.
        pin(ms) { impactPin = ms; impactPinBase = performance.now(); impactTl.reset(); },
        get sample() { return { ...impactOut }; },
      },
```

For `pin` to work, `fireImpact` must use the pinned base when pinned. In `fireImpact`, replace `performance.now()` with `(impactPin === null ? performance.now() : impactPinBase)`.

- [ ] **Step 5: Unit tests.** `npx vitest run`. All pass. Fix any test stub whose `critical` or `emit` shape changed.

- [ ] **Step 6: Browser check** on the frozen build (see Global Constraints), with `scripts/dev-play.mjs` on `?fight=test&god=1&gadgets=all`. Screenshots go to `C:\Users\awsom\AppData\Local\Temp\claude\C--Users-awsom\fef038a3-be2d-4c1b-a5ee-7e84708fbc24\scratchpad\impact\`.
  1. Skip the comic. Spend one click during settle, because an unlocked pointer swallows its first click.
  2. For each pin value, 20 (beat 1), 70 (beat 2), 200 (tier 2 freeze) and 450 (release):
     - set `window.__game.impact.pin(<ms>)`;
     - fire it: `window.__game.impact.fire(2, window.__game.combat.enemies[0])`;
     - wait 100 ms, then screenshot.
  3. Unpin with `pin(null)`.
  4. Real play: spawn 3 goons in front, give combo 12, press Digit1, and screenshot at about 1.3 s (the finisher). The panel shows during the finisher.
  5. Set Soft in settings (`window.__game.settings.impactFrames = 'soft'`) and repeat a pinned tier 1 at 20 ms and a tier 2 at 200 ms. Set Off and check `impact.sample` stays all zero after a fire.
  6. Pause mid-freeze. Pin 200 and fire tier 2, then set `window.__game.state.paused = true` and unpin. On the next frames, `time` holds must be released: `window.__game.time.scale(0.016) > 0.001` after unpausing.
  7. Look at every screenshot:
     - beat 1: stark black and white with radial lines from the goon;
     - freeze: the tilted ink panel on a paper gutter, the halftone burst behind the hit, and the sound word on top;
     - Soft: lines and a pale vignette with no inversion;
     - nothing left on screen after the release.

- [ ] **Step 7: Commit.**

```bash
git add src/combat/combatSystem.js src/combat/chainControl.js src/combat/batSwarm.js src/game/game.js
git commit -m "Impact frames: tiers from game events, real-time sampling, the freeze hold and cancellations"
```

---

### Task 5: Release verification (the coordinator runs this)

- [ ] **Step 1:** `npx vitest run`. All pass.
- [ ] **Step 2:** On the frozen build, `BASE_URL=http://localhost:5271 npx playwright test`. All specs pass.
- [ ] **Step 3:** The full playthrough, `BASE=http://localhost:5271/ OUT="$TEMP/pti" node scripts/playthrough.mjs`. It ends at `credits` with no console errors.
- [ ] **Step 4:** fps sweep, `ONLY=fight` and `ONLY=gadgets`, then a full sweep. The fight, chain and g:swarm rows stay at p95 ≤ 6.9 ms with no frame over 25 ms after warmup. A tier 2 freeze is deliberate stillness, so the sweep measures frame time, which it does. The machine is noisy: rerun a failing page alone twice before calling it.
- [ ] **Step 5:** `node scripts/webkit-check.mjs http://localhost:5271/ "$TEMP/wki"`. No console errors. Also check one pinned tier 2 screenshot in WebKit: `mask-image` with the `-webkit-` prefix, and the panel draws correctly.
- [ ] **Step 6:** Dash check on the touched source files, using `LC_ALL=C.UTF-8 grep -nP '[\x{2013}\x{2014}]'`. No hits in player-visible text.
- [ ] **Step 7:** Copy the best beat 1, freeze and Soft shots to `docs/screens/impact-*.png` and commit. The coordinator reviews, merges to main and pushes.
