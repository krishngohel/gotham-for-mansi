// The gadget HUD's Bat Swarm icon: the DOM is written only when what it shows changes. The test
// environment has no DOM, so a tiny stand-in records every write.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createGadgetHud } from '../../src/ui/gadgetHud.js';

let writes;
function fakeEl() {
  const classes = new Set();
  const kids = {};
  let text = '';
  return {
    className: '', innerHTML: '', style: {}, children: [],
    classList: {
      toggle(c, on) { writes.push(['class', c, !!on]); if (on) classes.add(c); else classes.delete(c); },
      add(c) { classes.add(c); }, remove(c) { classes.delete(c); }, contains: (c) => classes.has(c),
    },
    get textContent() { return text; },
    set textContent(v) { writes.push(['text', v]); text = v; },
    querySelector(sel) { return (kids[sel] ??= fakeEl()); },
    appendChild() {},
  };
}

describe('gadgetHud.setSwarm', () => {
  let saved, made;
  beforeEach(() => {
    writes = [];
    made = [];
    saved = globalThis.document;
    globalThis.document = { createElement: () => { const e = fakeEl(); made.push(e); return e; } };
  });
  afterEach(() => { globalThis.document = saved; });

  it('touches the DOM only when shown, lit or the key label changes', () => {
    const hud = createGadgetHud(fakeEl());
    const swarm = made[1];
    writes = [];
    hud.setSwarm({ show: false, affordable: false, cost: 13 }, '4');
    expect(writes.length).toBeGreaterThan(0);
    // combat.swarm is a fresh object on every 0.1 s refresh: same state, no writes.
    writes = [];
    for (let i = 0; i < 20; i++) hud.setSwarm({ show: false, affordable: false, cost: 13 }, '4');
    expect(writes).toEqual([]);
    hud.setSwarm({ show: true, affordable: true, cost: 13 }, '4');
    expect(swarm.classList.contains('lit')).toBe(true);
    expect(swarm.classList.contains('hidden')).toBe(false);
    expect(writes.some((w) => w[0] === 'text')).toBe(false);
    writes = [];
    for (let i = 0; i < 20; i++) hud.setSwarm({ show: true, affordable: true, cost: 13 }, '4');
    expect(writes).toEqual([]);
    hud.setSwarm({ show: true, affordable: true, cost: 13 }, 'F');
    expect(writes).toEqual([['text', 'F']]);
    expect(swarm.querySelector('b').textContent).toBe('F');
  });
});
