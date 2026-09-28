// HUD pieces for side content: the challenge panel and timer, the 3-2-1 comic panels, short
// hints, police radio captions, milestone toasts and the bat markers over challenge pillars.
import { batSvgPath } from '../config/batShape.js';

export function createSideHud(root) {
  const el = document.createElement('div');
  el.className = 'side-hud';
  el.innerHTML = `
    <div class="ch-panel"><div class="ch-name"></div><div class="ch-time"></div><div class="ch-sub"></div></div>
    <div class="ch-count"></div>
    <div class="ch-hint"></div>
    <div class="radio"><div class="radio-title"></div><div class="radio-text"></div></div>
    <div class="side-toast"><div class="toast-title"></div><div class="toast-text"></div></div>
    <div class="ch-markers"></div>`;
  root.appendChild(el);
  const q = (s) => el.querySelector(s);
  const panel = q('.ch-panel'), nameEl = q('.ch-name'), timeEl = q('.ch-time'), subEl = q('.ch-sub');
  const count = q('.ch-count'), hintEl = q('.ch-hint'), radio = q('.radio'), toast = q('.side-toast'), markers = q('.ch-markers');
  const marks = new Map();
  const timers = new Map();
  const set = (node, text) => { if (node.textContent !== text) node.textContent = text; };
  const flash = (node, key, ms) => {
    node.classList.add('show');
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => node.classList.remove('show'), ms));
  };
  const pop = (node) => { node.classList.remove('pop'); void node.offsetWidth; node.classList.add('pop'); };

  return {
    challenge(title) { set(nameEl, title); set(timeEl, ''); set(subEl, ''); panel.classList.add('show'); },
    timer(main, sub = '') { set(timeEl, main); set(subEl, sub); },
    countdown(text) { count.textContent = text; pop(count); },
    clearChallenge() { panel.classList.remove('show'); },
    hint(text, ms = 3000) { set(hintEl, text); flash(hintEl, 'hint', ms); },
    radio(title, text, ms = 6000) { set(q('.radio-title'), title); set(q('.radio-text'), text); flash(radio, 'radio', ms); },
    toast(title, text, ms = 6000) { set(q('.toast-title'), title); set(q('.toast-text'), text); flash(toast, 'toast', ms); },
    marker(id, x, y, visible, medal = null) {
      let m = marks.get(id);
      if (!visible) { if (m && m.style.display !== 'none') m.style.display = 'none'; return; }
      if (!m) {
        m = document.createElement('div');
        m.className = 'ch-marker';
        m.innerHTML = `<svg viewBox="-52 -26 104 52"><path d="${batSvgPath(1, 0, 0)}"/></svg>`;
        markers.appendChild(m);
        marks.set(id, m);
      }
      m.style.display = '';
      m.dataset.medal = medal ?? 'none';
      m.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },
    hideMarkers() { for (const m of marks.values()) m.style.display = 'none'; },
  };
}
