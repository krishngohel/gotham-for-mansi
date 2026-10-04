// tests/unit/cardQueue.test.js
import { describe, it, expect } from 'vitest';
import { createCardQueue } from '../../src/ui/cardQueue.js';

// A fake clock: timers fire when advance() passes them.
function clock() {
  let t = 0, id = 0;
  const timers = new Map();
  return {
    now: () => t,
    after: (fn, ms) => { timers.set(++id, { at: t + ms, fn }); return id; },
    cancel: (i) => timers.delete(i),
    advance(ms) {
      const end = t + ms;
      for (;;) {
        const due = [...timers.entries()].filter(([, v]) => v.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!due) break;
        timers.delete(due[0]);
        t = due[1].at;
        due[1].fn();
      }
      t = end;
    },
  };
}
function setup() {
  const c = clock(), shown = [];
  let visible = null;
  const q = createCardQueue({ render: (title) => { visible = title; shown.push(title); }, hide: () => { visible = null; }, now: c.now, after: c.after, cancel: c.cancel });
  return { c, q, shown, visible: () => visible };
}

describe('createCardQueue', () => {
  it('shows a card and takes it down when its time is up', () => {
    const { c, q, visible } = setup();
    q.push('Balloon 1 of 12', 'Found one!', 7000);
    expect(visible()).toBe('Balloon 1 of 12');
    c.advance(6999);
    expect(visible()).toBe('Balloon 1 of 12');
    c.advance(2);
    expect(visible()).toBeNull();
  });
  it('a level-up on the same frame waits until the balloon message has been up long enough to read', () => {
    const { c, q, visible, shown } = setup();
    q.push('Balloon 7 of 12', 'Seven.', 7000);
    q.push('LEVEL 2!', 'WayneTech sent an upgrade.', 6500);
    expect(visible()).toBe('Balloon 7 of 12');
    c.advance(3400);
    expect(visible()).toBe('Balloon 7 of 12');
    c.advance(200);
    expect(visible()).toBe('LEVEL 2!');
    c.advance(6500);
    expect(visible()).toBeNull();
    expect(shown).toEqual(['Balloon 7 of 12', 'LEVEL 2!']);
  });
  it('a card that has already been read gives way at once', () => {
    const { c, q, visible } = setup();
    q.push('A', 'a', 7000);
    c.advance(5000);
    q.push('B', 'b', 3000);
    c.advance(1);
    expect(visible()).toBe('B');
  });
  it('drops a duplicate of a card already waiting', () => {
    const { q } = setup();
    q.push('A', 'a');
    q.push('B', 'b');
    q.push('B', 'b');
    expect(q.waiting).toBe(1);
  });
  it('dismiss: the card on screen gets its minimum, then nothing queued pops up over the action', () => {
    const { c, q, visible } = setup();
    q.push('A', 'a', 7000);
    q.push('B', 'b', 7000);
    q.dismiss(1500);
    c.advance(1500);
    expect(visible()).toBeNull();
    c.advance(10000);
    expect(visible()).toBeNull();
  });
});
