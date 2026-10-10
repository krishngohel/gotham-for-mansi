# Story Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every jump in the story is explained on the radio, the goal is always obvious, the party checklist ties the acts together, and the broken Batwing balloon run is gone.

**Architecture:** Story data (`src/game/story.js`) carries the copy (`lines`, `text`, `nudge`). Three small pure modules hold the logic: `partyChecklist.js` (which items are back at a step), `storyCues.js` (when an objective banner fires, and a gate that holds a cue until no comic, cinematic or radio is up), `nudge.js` (the idle timer). `flow.js` wires them each frame; `hud.js` gets a banner element; `prompts.js` learns to drop a fight's own tips and to hold side tips while it is quiet.

**Tech Stack:** Vite, three.js, vitest, Playwright scripts (muted, headless).

## Global Constraints

- No em or en dashes in any player-facing copy (tests build the regex from char codes 0x2013, 0x2014).
- All new copy is Fable 5.1's, taken verbatim from `story-copy.md` (scratchpad) after the owner has seen it in chat.
- Commits authored solely by Krishn Gohel, no AI co-author trailers.
- Every test browser runs muted and headless.
- Push to main only after every release gate passes (main redeploys the live site).
- Keep all 15 fights. Only `armadaRun` is removed.

---

### Task 1: Lines on any step, the balloon run removed, retired save ids

**Files:**
- Modify: `src/game/flow.js` (enterStep, near `if (s.type === 'interior' && s.lines?.length)`)
- Modify: `src/game/story.js` (delete `armadaRun`; `toPlaza` gets `tutorial: ['callBatwing']`)
- Modify: `src/game/storyMigrate.js`
- Test: `tests/unit/storyMigrate.test.js`, `tests/unit/story.test.js`

**Interfaces:**
- Produces: `RETIRED` (exported from storyMigrate.js) `{ armadaRun: 'nightwingTagRadio' }`; any reach/fight/collect/interior step's `lines` play on entry.

- [ ] **Step 1: Failing tests.** In storyMigrate.test.js:

```js
it('a save on a retired step lands on the step that replaced it', () => {
  expect(resolveStep({ stepId: 'armadaRun' })).toBe(idx('nightwingTagRadio'));
});
```

In story.test.js (`story data` block):

```js
it('the balloon run is gone and its Batwing tip moved to the plaza walk', () => {
  expect(STEPS.some((s) => s.id === 'armadaRun')).toBe(false);
  expect(STEPS.find((s) => s.id === 'toPlaza').tutorial).toContain('callBatwing');
});
```

- [ ] **Step 2:** `npx vitest run tests/unit/storyMigrate.test.js tests/unit/story.test.js` fails on both.
- [ ] **Step 3: Implement.** storyMigrate.js:

```js
// Steps taken out of the story, and where a save sitting on one carries on.
export const RETIRED = { armadaRun: 'nightwingTagRadio' };

export function resolveStep(progress, steps = STEPS) {
  const id = RETIRED[progress?.stepId] ?? progress?.stepId;
  if (id) {
    const i = steps.findIndex((s) => s.id === id);
    if (i >= 0) return i;
  }
  return 0;
}
```

story.js: delete the `armadaRun` object; `toPlaza` gains `tutorial: ['callBatwing']`.
flow.js enterStep: replace `if (s.type === 'interior' && s.lines?.length) radio?.say(s.lines);` with

```js
    // Hand-off lines on a plain step (reach, fight, collect, interior): what just happened and
    // why she is going where she is going. Async beats play their own lines in startAsync().
    if (!ASYNC_TYPES.has(s.type) && s.type !== 'cutscene' && s.lines?.length) radio?.say(s.lines);
```

- [ ] **Step 4:** Tests pass; full `npx vitest run` passes.
- [ ] **Step 5:** Commit "Balloon run removed; any story step can carry radio lines".

### Task 2: Party checklist

**Files:**
- Create: `src/game/partyChecklist.js`; Test: `tests/unit/partyChecklist.test.js`
- Modify: `src/ui/menus.js` (pause button + `partyPage`), `src/game/game.js` (pause opts), `src/ui/style.css`

**Interfaces:**
- Produces: `CHECKLIST` (array of `{ id, label, got, step }`), `CHECKLIST_TITLE`, `checklistAt(stepIndex, steps) -> [{ id, label, done }]`, `tickedBy(stepId) -> item | null`.

- [ ] **Step 1: Failing test** `tests/unit/partyChecklist.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STEPS } from '../../src/game/story.js';
import { CHECKLIST, checklistAt, tickedBy } from '../../src/game/partyChecklist.js';

const idx = (id) => STEPS.findIndex((s) => s.id === id);
const DASH = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

describe('party checklist', () => {
  it('has five items in story order, each ticked by a real step', () => {
    expect(CHECKLIST.map((c) => c.id)).toEqual(['gifts', 'gear', 'fireworks', 'cake', 'guests']);
    const at = CHECKLIST.map((c) => idx(c.step));
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });
  it('nothing is back at the start, everything by the boss', () => {
    expect(checklistAt(0, STEPS).every((c) => !c.done)).toBe(true);
    expect(checklistAt(idx('boss'), STEPS).every((c) => c.done)).toBe(true);
  });
  it('an item is done from its own step on, not before', () => {
    for (const c of CHECKLIST) {
      expect(checklistAt(idx(c.step) - 1, STEPS).find((x) => x.id === c.id).done).toBe(false);
      expect(checklistAt(idx(c.step), STEPS).find((x) => x.id === c.id).done).toBe(true);
    }
  });
  it('tickedBy finds the item for its step only', () => {
    expect(tickedBy('toNeon').id).toBe('gifts');
    expect(tickedBy('f1')).toBe(null);
  });
  it('copy is filled in and has no dashes', () => {
    for (const c of CHECKLIST) for (const s of [c.label, c.got]) { expect(s.length).toBeGreaterThan(2); expect(s).not.toMatch(DASH); }
  });
});
```

- [ ] **Step 2:** Run it: fails (module missing).
- [ ] **Step 3: Implement** `src/game/partyChecklist.js` (labels, `got` lines and title verbatim from story-copy.md section D):

```js
// The party she is getting back, item by item. Pure: an item is back once the story reaches the
// step that ticks it, so a save shows the right ticks with no field of its own.
export const CHECKLIST_TITLE = '<section D title>';
export const CHECKLIST = [
  { id: 'gifts', step: 'toNeon', label: '<D>', got: '<D>' },
  { id: 'gear', step: 'aceClueRadio', label: '<D>', got: '<D>' },
  { id: 'fireworks', step: 'harleyRadio', label: '<D>', got: '<D>' },
  { id: 'cake', step: 'crasherReveal', label: '<D>', got: '<D>' },
  { id: 'guests', step: 'rescueGuestsRadio', label: '<D>', got: '<D>' },
];

export function checklistAt(stepIndex, steps) {
  return CHECKLIST.map((c) => {
    const at = steps.findIndex((s) => s.id === c.step);
    return { id: c.id, label: c.label, done: at !== -1 && stepIndex >= at };
  });
}

export const tickedBy = (stepId) => CHECKLIST.find((c) => c.step === stepId) ?? null;
```

(`<D>` marks the exact strings from story-copy.md section D, owner-approved, copied in this step. No other placeholder.)

- [ ] **Step 4: Pause page.** menus.js pause(): after the Progress button,

```js
    if (onParty) list.appendChild(button(info.party ? `Party, ${info.party}` : 'Party', onParty));
```

(add `onParty` to the destructured opts) and a new page exported with the others:

```js
  // ---------- party checklist ----------
  function partyPage(data, { onBack }) {
    const node = el('div', 'menu party-menu');
    node.appendChild(el('h2', '', data.title));
    const list = el('ul', 'party-list');
    for (const c of data.items) {
      const li = el('li', c.done ? 'done' : '');
      li.textContent = c.label;
      list.appendChild(li);
    }
    node.appendChild(list);
    node.appendChild(button('Back', onBack, 'small'));
    show(node);
  }
```

game.js pauseOptions(): `info.party = \`${items.filter((c) => c.done).length}/${items.length}\`` and `onParty: () => menus.partyPage({ title: CHECKLIST_TITLE, items }, { onBack: () => menus.pause(opts) })`, with `const items = checklistAt(progress.step ?? 0, STEPS);` computed at the top of pauseOptions.
style.css:

```css
.party-list { list-style: none; margin: 10px 0 18px; padding: 0; font: 26px/1.5 'Patrick Hand SC', cursive; }
.party-list li::before { content: ''; display: inline-block; width: 18px; height: 18px; margin-right: 12px; border: 3px solid var(--ink); background: var(--paper); vertical-align: -2px; }
.party-list li.done::before { background: var(--signal); box-shadow: inset 0 0 0 3px var(--paper); }
.party-list li.done { text-decoration: line-through; text-decoration-thickness: 2px; }
```

- [ ] **Step 5:** Tests pass. Commit "Party checklist: pause page".

### Task 3: Cue gate, objective banner and checklist card

**Files:**
- Create: `src/game/storyCues.js`; Test: `tests/unit/storyCues.test.js`
- Modify: `src/ui/hud.js` (banner element + `banner(text)` + `bannerShowing`), `src/ui/style.css`, `src/game/flow.js`

**Interfaces:**
- Consumes: `tickedBy`, `CHECKLIST_TITLE`, `CHECKLIST` (Task 2).
- Produces: `bannerText(step, lastText) -> string | null`, `createGate({ canShow, show }) -> { set(item), update(), clear(), get pending }`; `hud.banner(text)`, `hud.bannerShowing`; `flow.quiet()` (true while the banner or radio is up or in a step's first 8 s; used by Task 5).

- [ ] **Step 1: Failing test** `tests/unit/storyCues.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { bannerText, createGate } from '../../src/game/storyCues.js';

describe('bannerText', () => {
  it('fires for goals, not for radio, cutscene, crasher or ally beats', () => {
    expect(bannerText({ text: 'Go' }, null)).toBe('Go');
    for (const type of ['fight', 'collect', 'board', 'chase', 'battle', 'interior', 'boss']) expect(bannerText({ type, text: 'X' }, null)).toBe('X');
    for (const type of ['radio', 'cutscene', 'crasher', 'ally', 'credits']) expect(bannerText({ type, text: 'X' }, null)).toBe(null);
  });
  it('does not repeat the goal already shown, and needs text', () => {
    expect(bannerText({ text: 'Same' }, 'Same')).toBe(null);
    expect(bannerText({ type: 'fight' }, null)).toBe(null);
  });
});

describe('createGate', () => {
  it('holds a cue until it can show, then shows it once', () => {
    let ok = false; const shown = [];
    const g = createGate({ canShow: () => ok, show: (x) => shown.push(x) });
    g.set('a'); g.update(); expect(shown).toEqual([]);
    ok = true; g.update(); g.update(); expect(shown).toEqual(['a']);
  });
  it('a newer cue replaces one still waiting; clear drops it', () => {
    const shown = [];
    const g = createGate({ canShow: () => false, show: (x) => shown.push(x) });
    g.set('a'); g.set('b'); expect(g.pending).toBe('b');
    g.clear(); expect(g.pending).toBe(null);
  });
});
```

- [ ] **Step 2:** Fails (module missing).
- [ ] **Step 3: Implement** `src/game/storyCues.js`:

```js
// When a new goal deserves the big centre banner, and a gate that holds a cue (the banner, a
// checklist card) until nothing else owns the screen: no comic page, cinematic or radio line.
const NO_BANNER = new Set(['radio', 'cutscene', 'crasher', 'ally', 'credits']);

export function bannerText(step, lastText) {
  if (!step?.text || NO_BANNER.has(step.type)) return null;
  return step.text === lastText ? null : step.text;
}

export function createGate({ canShow, show }) {
  let pending = null;
  return {
    set(item) { pending = item; },
    clear() { pending = null; },
    update() {
      if (pending == null || !canShow()) return;
      const item = pending;
      pending = null;
      show(item);
    },
    get pending() { return pending; },
  };
}
```

- [ ] **Step 4: HUD banner.** hud.js template: add `<div class="hud-banner"></div>` after `hud-caption`; in the API:

```js
    // A new goal, big in the middle for a moment before the corner caption carries it.
    banner(text) {
      bannerEl.textContent = text;
      bannerEl.classList.remove('show');
      void bannerEl.offsetWidth;
      bannerEl.classList.add('show');
      bannerUntil = performance.now() + BANNER_MS;
    },
    get bannerShowing() { return performance.now() < bannerUntil; },
```

with `const bannerEl = el.querySelector('.hud-banner'); let bannerUntil = 0; const BANNER_MS = 2300;` near the other element lookups. style.css:

```css
.hud-banner { position: absolute; left: 50%; top: 34%; max-width: min(760px, 86vw); transform: translate(-50%, -50%) rotate(-1.5deg); padding: 14px 26px; background: var(--signal); color: var(--ink); border: 4px solid var(--ink); box-shadow: 7px 7px 0 var(--ink); font: 38px/1.1 'Bangers', cursive; letter-spacing: 1px; text-align: center; opacity: 0; pointer-events: none; }
.hud-banner.show { animation: objbanner 2.3s ease-out forwards; }
@keyframes objbanner { 0% { opacity: 0; transform: translate(-50%, -50%) rotate(-1.5deg) scale(1.3); } 12% { opacity: 1; transform: translate(-50%, -50%) rotate(-1.5deg) scale(1); } 80% { opacity: 1; transform: translate(-50%, -50%) rotate(-1.5deg) scale(1); } 100% { opacity: 0; transform: translate(-30%, -260%) rotate(-1deg) scale(0.4); } }
```

- [ ] **Step 5: Flow wiring.** flow.js imports `bannerText, createGate` and `tickedBy, CHECKLIST, CHECKLIST_TITLE`. In createFlow:

```js
  // Cues wait until the screen is hers: no comic, cinematic or radio line up.
  const clearScreen = () => mode === 'play' && !comic.playing && !theGame()?.cinematic?.active;
  let lastBanner = null, stepAge = 0;
  const bannerGate = createGate({ canShow: clearScreen, show: (text) => hud.banner?.(text) });
  const checklistGate = createGate({
    canShow: () => clearScreen() && !radio?.playing && !hud.bannerShowing,
    show: (item) => hud.card(CHECKLIST_TITLE, `${item.got} (${CHECKLIST.indexOf(item) + 1}/${CHECKLIST.length})`, 6500),
  });
```

In enterStep after `hud.setObjective(s.text ?? '')`:

```js
    stepAge = 0;
    const b = bannerText(s, lastBanner);
    if (b) { lastBanner = b; bannerGate.set(b); }
    const item = tickedBy(s.id);
    if (item) checklistGate.set(item);
```

In update(), before `if (mode !== 'play') return;` keep as is; after it add `stepAge += dt; bannerGate.update(); checklistGate.update();`. Expose on the returned object:

```js
    // Side tips hold off while a goal is being announced or someone is talking.
    quiet() { return stepAge < 8 || !!hud.bannerShowing || !!radio?.playing; },
```

- [ ] **Step 6:** `npx vitest run` passes. Commit "Objective banner and checklist card, held until the screen is clear".

### Task 4: Idle nudge

**Files:**
- Create: `src/game/nudge.js`; Test: `tests/unit/nudge.test.js`
- Modify: `src/game/flow.js`, `src/ui/waypoint.js`, `src/ui/style.css`

**Interfaces:**
- Produces: `createNudge({ wait = 45, gain = 5, max = 3 }) -> { reset(), update(dt, dist, running) -> boolean }`; `waypoint.pulse()`.

- [ ] **Step 1: Failing test** `tests/unit/nudge.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createNudge } from '../../src/game/nudge.js';

const run = (n, secs, dist, running = true) => { let fired = 0; for (let t = 0; t < secs; t += 0.5) if (n.update(0.5, typeof dist === 'function' ? dist(t) : dist, running)) fired++; return fired; };

describe('idle nudge', () => {
  it('fires after 45 s without getting 5 m closer', () => {
    const n = createNudge();
    expect(run(n, 44.5, 100)).toBe(0);
    expect(run(n, 1, 100)).toBe(1);
  });
  it('heading for the marker keeps resetting it', () => {
    const n = createNudge();
    expect(run(n, 200, (t) => 300 - t)).toBe(0); // 1 m/s closer
  });
  it('a few metres of shuffling does not count as progress', () => {
    const n = createNudge();
    expect(run(n, 46, (t) => 100 - (t % 4))).toBe(1);
  });
  it('stops after 3 nudges and starts over on reset', () => {
    const n = createNudge();
    expect(run(n, 500, 100)).toBe(3);
    n.reset();
    expect(run(n, 46, 100)).toBe(1);
  });
  it('does not count time while not running', () => {
    const n = createNudge();
    expect(run(n, 100, 100, false)).toBe(0);
    expect(run(n, 44, 100)).toBe(0);
  });
});
```

- [ ] **Step 2:** Fails (module missing).
- [ ] **Step 3: Implement** `src/game/nudge.js`:

```js
// The idle nudge: on a travel step, 45 s without getting 5 m closer to the marker is a sign she
// has lost the thread, so the radio says the goal again. At most `max` times a step.
export function createNudge({ wait = 45, gain = 5, max = 3 } = {}) {
  let best = null, t = 0, fired = 0;
  return {
    reset() { best = null; t = 0; fired = 0; },
    update(dt, dist, running) {
      if (!running || fired >= max) return false;
      if (best == null || dist <= best - gain) { best = Math.min(best ?? dist, dist); t = 0; return false; }
      t += dt;
      if (t < wait) return false;
      fired += 1;
      t = 0;
      best = dist;
      return true;
    },
  };
}
```

- [ ] **Step 4: Wire.** waypoint.js API: `pulse() { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); },`. style.css: `.waypoint.pulse { animation: wppulse 0.5s ease-in-out 3; } @keyframes wppulse { 50% { transform: translate(-50%, -50%) scale(1.8); } }`.
flow.js: `import { createNudge } from './nudge.js';`, `const nudge = createNudge(); const NUDGE_TYPES = new Set([undefined, 'reach', 'board', 'interior', 'collect']);`. enterStep: `nudge.reset();`. update(), after the cue gates:

```js
      if (s && target && NUDGE_TYPES.has(s.type)) {
        const running = !side.holdStory() && !radio?.playing && !comic.playing && !theGame()?.cinematic?.active;
        const dist = Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z);
        if (nudge.update(dt, dist, running)) {
          radio?.say([s.nudge ?? { speaker: 'alfred', portrait: 'alfred', text: s.text }]);
          waypoint.pulse?.();
        }
      }
```

- [ ] **Step 5:** Tests pass. Commit "Idle nudge: the radio restates the goal".

### Task 5: Calmer tip cards

**Files:**
- Modify: `src/ui/prompts.js` (createPromptQueue), `src/game/flow.js` (advance), `src/game/game.js` (queue construction)
- Test: `tests/unit/prompts.test.js`

**Interfaces:**
- Consumes: `flow.quiet()` (Task 3).
- Produces: `createPromptQueue(hud, getBindings, isEnabled, isBusy, getEquipped, relevance, quiet = () => false)`; `prompts.dropStepTips()`.

- [ ] **Step 1: Failing tests** in prompts.test.js:

```js
describe('prompt queue: step tips and quiet moments', () => {
  const fakeHud = () => ({ shown: [], hint(t) { this.shown.push(t); }, hideHint() { this.hidden = true; } });
  const B = () => DEFAULT_BINDINGS;
  it("a fight's own tips go when the fight is over", () => {
    const hud = fakeHud();
    const q = createPromptQueue(hud, B, () => true);
    q.show(['punch', 'kick'], { first: true });
    q.update(0.1);
    expect(hud.shown.length).toBe(1);
    q.dropStepTips();
    expect(hud.hidden).toBe(true);
    for (let i = 0; i < 20; i++) q.update(1);
    expect(hud.shown.length).toBe(1);
  });
  it('side tips wait while it is quiet; step tips do not', () => {
    const hud = fakeHud();
    let quiet = true;
    const q = createPromptQueue(hud, B, () => true, () => false, () => null, () => true, () => quiet);
    q.show(['photo']);
    q.update(0.1);
    expect(hud.shown.length).toBe(0);
    q.show(['glide'], { first: true });
    q.update(0.1);
    expect(hud.shown.length).toBe(1);
    quiet = false;
    for (let i = 0; i < 8; i++) q.update(1);
    expect(hud.shown.length).toBe(2);
  });
});
```

- [ ] **Step 2:** Fails (`dropStepTips` is not a function; photo shows while quiet).
- [ ] **Step 3: Implement.** In createPromptQueue: add the `quiet = () => false` parameter; queue entries become `{ id, gen, own }` with `own: first` in `show()`; track `let currentOwn = false;`. Add:

```js
    // The fight these tips were for is over: its cards go, on screen or queued.
    dropStepTips() {
      for (let i = queue.length - 1; i >= 0; i--) if (queue[i].own) queue.splice(i, 1);
      if (current && currentOwn) hide();
    },
```

In update(), the pick of the next card skips side tips while quiet: replace both `queue.findIndex((q) => relevance(q.id) === true)` with `queue.findIndex((q) => relevance(q.id) === true && (q.own || !quiet()))`, and when a card is taken set `currentOwn = picked.own`. Re-queues keep `own: currentOwn`.
flow.js advance(): capture `const prev = objectives.step;` before `objectives.handle(ev)`; after it succeeds, `if (prev?.type === 'fight') prompts.dropStepTips?.();` before `enterStep()`.
game.js: pass `() => game?.flow?.quiet?.() ?? false` as the 7th argument of createPromptQueue (flow is created later; the closure reads it lazily: use whichever variable holds flow at that point, `flow` is declared with const below, so reference it through `window.__game?.flow` to avoid the TDZ).

- [ ] **Step 4:** `npx vitest run` passes. Commit "Tip cards: a fight's tips leave with it, side tips wait for a quiet moment".

### Task 6: The copy

**Files:**
- Modify: `src/game/story.js`, `src/game/partyChecklist.js` (if Task 2 ran before the copy was approved)
- Test: `tests/unit/story.test.js`

- [ ] **Step 1: Failing tests** in story.test.js `story data`:

```js
  it('every fight that hands over to a travel step says why on the radio', () => {
    const TRAVEL = new Set([undefined, 'reach', 'collect', 'interior']);
    for (let i = 0; i < STEPS.length - 1; i++) {
      if (STEPS[i].type !== 'fight' || !TRAVEL.has(STEPS[i + 1].type)) continue;
      expect(STEPS[i + 1].lines?.length, STEPS[i + 1].id).toBeGreaterThan(0);
    }
  });
  it('every travel step has a nudge line, and no line uses a dash', () => {
    for (const s of STEPS) {
      if ([undefined, 'reach', 'board', 'interior', 'collect'].includes(s.type) && s.type !== 'credits') {
        expect(s.nudge?.text, s.id).toBeTruthy();
      }
      for (const l of [...(s.lines ?? []), ...(s.nudge ? [s.nudge] : [])]) expect(l.text, s.id).not.toMatch(DASH);
    }
  });
```

- [ ] **Step 2:** Fails.
- [ ] **Step 3:** Paste the approved copy from story-copy.md: section A as `lines: [g(speaker, text), ...]` on each listed step (and the new `nightwingTagRadio` lines); section B as each step's `text`; section C as `nudge: g(speaker, text)` on each travel step; section D into partyChecklist.js.
- [ ] **Step 4:** `npx vitest run` passes. Commit "Story copy: hand-offs, clearer goals, nudges".

### Task 7: Verify and release

- [ ] Fresh frozen build: `npx vite build --outDir "$TEMP/gdist" --emptyOutDir`, `npx vite preview --outDir "$TEMP/gdist" --port 5202`.
- [ ] `node scripts/story-walk.mjs http://localhost:5202/ "$TEMP/storywalk2"`: ends at credits, no console errors, no new cuts; look at the go-step shots (banner, radio hand-off), a checklist card, Act 3 opening without the balloon run.
- [ ] A scripted idle check: `?at=toYard&god=1`, stand still 47 s, the radio shows the nudge line.
- [ ] `npx playwright test` (17/17), `BASE=http://localhost:5202/ OUT=playthrough node scripts/playthrough.mjs` to credits, `node scripts/webkit-check.mjs`, `node scripts/_moves.mjs` all rows fire.
- [ ] Fast-forward main in `C:\Users\awsom\Documents\Projects\gotham-for-mansi`, push, wait for the Pages run, smoke the live build (served bundle hash changed, `?at=toYard` shows the hand-off).
