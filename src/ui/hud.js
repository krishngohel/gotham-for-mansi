import { batSvgPath } from '../config/batShape.js';
import { chainHudKey } from '../combat/chains.js';

const R = 50;
const C = 2 * Math.PI * R;
const BOLT = 'M22 2 L6 30 L17 30 L12 52 L32 20 L20 20 L26 2 Z';
const BALLOON = '<svg width="16" height="22" viewBox="0 0 16 22"><ellipse cx="8" cy="8" rx="7" ry="8" fill="#c8323c" stroke="#0b0b12" stroke-width="1.5"/><path d="M8 16 q-2 3 0 6" stroke="#0b0b12" fill="none"/></svg>';

// Chain icons, inked: a looped rope, two heads meeting, a boot coming down on a crater.
const CHAIN_ICON = [
  '<path d="M8 30 C8 14 30 14 30 24 C30 34 14 34 14 24 C14 14 36 12 40 22"/>',
  '<circle cx="14" cy="26" r="9"/><circle cx="34" cy="26" r="9"/><path d="M24 6 L24 13 M17 9 L21 15 M31 9 L27 15"/>',
  '<path d="M24 5 L24 29 M16 21 L24 31 L32 21 M8 41 L40 41 M12 37 L7 32 M36 37 L41 32"/>',
];

// Where a sound word's centre goes so the whole word stays on screen: w x h is its laid-out
// size, rotDeg its tilt, and the pop animation scales it to 1.15. m keeps it clear of the
// comic frame. Each box in `avoid` (DOMRect-like: the objective card, a showing hint) the word
// would cover is stepped out of by the shortest move that stays on screen. A word wider than
// the screen is centred.
const POP = 1.15;
export function placeWord(x, y, w, h, rotDeg, view, avoid = [], m = 24) {
  const r = (Math.abs(rotDeg) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const hw = (POP * (w * c + h * s)) / 2, hh = (POP * (w * s + h * c)) / 2;
  const x0 = hw + m, x1 = view.w - hw - m, y0 = hh + m, y1 = view.h - hh - m;
  const fit = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
  let px = fit(x, x0, x1), py = fit(y, y0, y1);
  for (const b of avoid) {
    if (!b || !(b.width > 0) || px + hw <= b.left || px - hw >= b.right || py + hh <= b.top || py - hh >= b.bottom) continue;
    const up = b.top - hh - m, down = b.bottom + hh + m, left = b.left - hw - m, right = b.right + hw + m;
    let best = Infinity, bx = px, by = py;
    if (up >= y0 && py - up < best) { best = py - up; bx = px; by = up; }
    if (down <= y1 && down - py < best) { best = down - py; bx = px; by = down; }
    if (left >= x0 && px - left < best) { best = px - left; bx = left; by = py; }
    if (right <= x1 && right - px < best) { best = right - px; bx = right; by = py; }
    px = bx; py = by;
  }
  return { x: px, y: py };
}

export function arcDash(fraction, circumference = C, span = 0.75) {
  const f = Math.min(1, Math.max(0, fraction));
  return `${(f * span * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
}

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-combo hidden"><span class="x">x</span><span class="n">0</span></div>
    <div class="hud-chains hidden">${CHAIN_ICON.map((p, i) => `<div class="chain-ico" data-n="${i + 1}"><svg viewBox="0 0 48 48">${p}</svg><b>${i + 1}</b></div>`).join('')}</div>
    <div class="hud-caption"><div class="obj"></div><div class="balloons">${BALLOON}<span>0/12</span></div></div>
    <svg class="hud-health" viewBox="0 0 120 120">
      <circle class="track" cx="60" cy="60" r="${R}" stroke-dasharray="${arcDash(1)}" transform="rotate(135 60 60)"/>
      <circle class="bar" cx="60" cy="60" r="${R}" stroke-dasharray="${arcDash(1)}" transform="rotate(135 60 60)"/>
      <path class="bat" d="${batSvgPath(0.62, 60, 62)}"/>
    </svg>
    <div class="hud-layer"></div>
    <div class="hud-hint"></div>
    <div class="hud-card"><div class="card-title"></div><div class="card-text"></div></div>
    <div class="hud-boss"><div class="boss-name">THE JOKER</div><div class="boss-track"><div class="boss-fill"></div></div></div>
    <div class="hud-speech"></div>
    <div class="hud-flash"></div>
    <div class="hud-speed"></div>`;
  root.appendChild(el);
  const combo = el.querySelector('.hud-combo');
  const comboN = combo.querySelector('.n');
  const chainsEl = el.querySelector('.hud-chains');
  const chainIcons = [...chainsEl.querySelectorAll('.chain-ico')];
  let chainKey = '', lastChainState = null, lastChainKeys = null;
  const bar = el.querySelector('.bar');
  const obj = el.querySelector('.obj');
  const captionEl = el.querySelector('.hud-caption');
  const balloons = el.querySelector('.balloons span');
  const layer = el.querySelector('.hud-layer');
  const glyphs = new Map();
  const hintEl = el.querySelector('.hud-hint');
  const flashEl = el.querySelector('.hud-flash');
  const speedEl = el.querySelector('.hud-speed');
  let hintTimer = null;
  const cardEl = el.querySelector('.hud-card');
  const bossEl = el.querySelector('.hud-boss');
  const bossFill = el.querySelector('.boss-fill');
  const speechEl = el.querySelector('.hud-speech');
  let cardTimer = null;

  return {
    setHealth(f) { bar.setAttribute('stroke-dasharray', arcDash(f)); },
    setCombo(n, readyAt = 8) {
      comboN.textContent = n;
      combo.classList.toggle('hidden', n === 0);
      combo.classList.toggle('ready', n >= readyAt);
      combo.classList.remove('pop');
      void combo.offsetWidth;
      if (n > 0) combo.classList.add('pop');
    },
    // Chain takedown icons under the combo counter (lit = affordable, blue = free from stealth).
    // state is combat.chains; keys are the bound key labels. Most frames pass the same two objects
    // and return at once; the DOM is touched only when what the icons show changed.
    setChains(state, keys) {
      if (state === lastChainState && keys === lastChainKeys) return;
      lastChainState = state;
      lastChainKeys = keys;
      const k = chainHudKey(state) + keys.join('');
      if (k === chainKey) return;
      chainKey = k;
      chainsEl.classList.toggle('hidden', !state.show);
      chainsEl.classList.toggle('stealth', !!state.stealth);
      chainIcons.forEach((ic, i) => { ic.classList.toggle('lit', !!state.affordable[i]); ic.querySelector('b').textContent = keys[i]; });
    },
    setObjective(text) {
      if (obj.textContent === text) return;
      obj.textContent = text;
      const cap = el.querySelector('.hud-caption');
      cap.style.display = text ? '' : 'none';
      cap.classList.remove('new');
      void cap.offsetWidth;
      cap.classList.add('new');
    },
    card(title, text, ms = 7000) {
      cardEl.querySelector('.card-title').textContent = title;
      cardEl.querySelector('.card-text').textContent = text;
      cardEl.classList.add('show');
      clearTimeout(cardTimer);
      cardTimer = setTimeout(() => cardEl.classList.remove('show'), ms);
    },
    setBalloons(n, total) { balloons.textContent = `${n}/${total}`; },
    glyph(id, x, y, visible, color = 'blue') {
      let g = glyphs.get(id);
      if (!visible) { if (g) { g.remove(); glyphs.delete(id); } return; }
      if (g && g.dataset.color !== color) { g.remove(); glyphs.delete(id); g = null; }
      if (!g) {
        g = document.createElement('div');
        g.className = `glyph ${color}`;
        g.dataset.color = color;
        g.innerHTML = `<svg viewBox="0 0 38 54"><path d="${BOLT}"/></svg>`;
        layer.appendChild(g);
        glyphs.set(id, g);
      }
      g.style.left = `${x}px`;
      g.style.top = `${y}px`;
    },
    clearGlyphs() { for (const g of glyphs.values()) g.remove(); glyphs.clear(); },
    // Removes glyphs for enemies that no longer exist (restarts, new waves).
    pruneGlyphs(keep) { for (const [id, g] of glyphs) if (!keep.has(id)) { g.remove(); glyphs.delete(id); } },
    // A caption at the bottom of the screen. html may contain <kbd> key labels.
    hint(html, ms = 3500) {
      hintEl.innerHTML = html;
      hintEl.classList.add('show');
      clearTimeout(hintTimer);
      if (ms > 0) hintTimer = setTimeout(() => hintEl.classList.remove('show'), ms);
    },
    hideHint() { hintEl.classList.remove('show'); },
    damage(amount) {
      flashEl.style.opacity = String(Math.min(0.75, 0.25 + amount / 40));
      flashEl.classList.remove('fade');
      void flashEl.offsetWidth;
      flashEl.classList.add('fade');
    },
    setVisible(v) { el.style.display = v ? '' : 'none'; },
    bossBar(visible, fraction = 1) {
      bossEl.classList.toggle('show', visible);
      if (visible) bossFill.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    },
    speech(text) {
      if (!text) { speechEl.classList.remove('show'); return; }
      speechEl.textContent = text;
      speechEl.classList.add('show');
    },
    speechPos(x, y, visible = true) {
      speechEl.style.left = `${x}px`;
      speechEl.style.top = `${y}px`;
      speechEl.style.visibility = visible ? 'visible' : 'hidden';
    },
    // Comic speed lines burst on a critical hit; chain finishers pick their own ('rope', 'head', 'domino').
    critical(variant = '') {
      speedEl.className = 'hud-speed';
      void speedEl.offsetWidth;
      speedEl.className = `hud-speed on ${variant}`.trim();
    },
    sfx(word, x, y, big = false) {
      const s = document.createElement('div');
      s.className = big ? 'sfx big' : 'sfx';
      s.textContent = word;
      const rot = Math.random() * 24 - 12;
      s.style.setProperty('--r', `${rot.toFixed(1)}deg`);
      s.addEventListener('animationend', () => s.remove());
      layer.appendChild(s);
      // Measured once per word, now it's laid out: keep it on screen, off the objective card and off a showing hint.
      const avoid = [captionEl.getBoundingClientRect(), hintEl.classList.contains('show') ? hintEl.getBoundingClientRect() : null];
      const p = placeWord(x, y, s.offsetWidth, s.offsetHeight, rot, { w: innerWidth, h: innerHeight }, avoid);
      s.style.left = `${p.x}px`;
      s.style.top = `${p.y}px`;
    },
  };
}
