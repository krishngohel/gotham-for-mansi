// The big centre card (a balloon message, LEVEL UP, a new gadget, a news flash) shows one at a
// time. A card that arrives while another has been up less than minRead waits its turn instead
// of replacing it: popping a balloon pays XP, and a level-up card used to wipe the balloon's
// message before it could be read. Pure, with the clock and timers passed in, so it is testable.
export function createCardQueue({ render, hide, now = () => performance.now(), after = setTimeout, cancel = clearTimeout, minRead = 3500 }) {
  const waiting = [];
  let showing = false, shownAt = 0, timer = null;
  const same = (a, b) => a.title === b.title && a.text === b.text;

  function show(card) {
    render(card.title, card.text);
    showing = true;
    shownAt = now();
    cancel(timer);
    timer = after(next, card.ms);
  }
  // The current card's time is up (or it was cut short): the next one in line, if any.
  function next() {
    cancel(timer);
    timer = null;
    if (waiting.length) { show(waiting.shift()); return; }
    showing = false;
    hide();
  }

  return {
    push(title, text, ms = 7000) {
      const card = { title, text, ms };
      if (!showing) { show(card); return; }
      if (waiting.some((c) => same(c, card))) return;
      waiting.push(card);
      // The one on screen gets minRead in all, then gives way.
      cancel(timer);
      timer = after(next, Math.max(0, minRead - (now() - shownAt)));
    },
    // The action is starting (a fight, getting into a vehicle): the card on screen has its
    // minMs and comes down, and nothing queued pops up over the action afterwards.
    dismiss(minMs = 1500) {
      waiting.length = 0;
      if (!showing) return;
      cancel(timer);
      timer = after(next, Math.max(0, minMs - (now() - shownAt)));
    },
    get showing() { return showing; },
    get waiting() { return waiting.length; },
  };
}
