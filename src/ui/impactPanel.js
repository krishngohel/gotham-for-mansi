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
