// Pure dialogue queue for the radio and cutscene speech panels (src/ui/radio.js draws it).
// No DOM, no audio, no wall-clock timers: the caller ticks it every frame with tick(dt) and reads
// `current` / `revealed` to draw the typewriter text. This file only decides what shows and when
// a beat is done; radio.js is the only place that touches the page.
const CHARS_PER_S = 38;
const HOLD_S = 1.1; // a fully-typed line stays up at least this long before auto-advancing
const HOLD_PER_CHAR = 0.045; // plus a bit more for longer lines, so nobody has to speed-read

export function typeDuration(text) { return text.length / CHARS_PER_S; }
export function holdDuration(text) { return HOLD_S + text.length * HOLD_PER_CHAR; }

// `lines`: [{ speaker, text, portrait }]. speaker/portrait are free-form ids radio.js looks up;
// this module never inspects them.
export function createRadioQueue() {
  let queue = [];
  let current = null; // { line, t }
  let resolvers = [];

  function settle() {
    const rs = resolvers;
    resolvers = [];
    for (const r of rs) r();
  }

  function startNext() {
    if (current || !queue.length) return;
    current = { line: queue.shift(), t: 0 };
  }

  const api = {
    get current() { return current?.line ?? null; },
    get revealed() {
      if (!current) return '';
      const n = Math.min(current.line.text.length, Math.floor(current.t * CHARS_PER_S));
      return current.line.text.slice(0, n);
    },
    get typing() { return !!current && api.revealed.length < current.line.text.length; },
    get pending() { return queue.length; },
    get active() { return !!current || queue.length > 0; },
    // Queues a beat (one or more lines) and returns a promise the caller can await; it resolves
    // once every line in the whole queue (this beat and any still ahead of it) has been shown.
    say(lines) {
      queue.push(...lines);
      startNext();
      return new Promise((resolve) => resolvers.push(resolve));
    },
    tick(dt) {
      if (!current) { startNext(); return; }
      current.t += dt;
      if (current.t >= typeDuration(current.line.text) + holdDuration(current.line.text)) {
        current = null;
        startNext();
        if (!current) settle();
      }
    },
    // A click or the advance key: finish the typewriter early, or if it is already full, jump to
    // the next line right away.
    advance() {
      if (!current) return;
      if (api.revealed.length < current.line.text.length) { current.t = typeDuration(current.line.text); return; }
      current = null;
      startNext();
      if (!current) settle();
    },
    // Esc: drop everything queued. The promise still resolves, so a waiting mission step still
    // completes instead of hanging forever.
    skipAll() {
      queue = [];
      current = null;
      settle();
    },
  };
  return api;
}
