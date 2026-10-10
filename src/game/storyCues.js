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
