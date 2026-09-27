import { batSvgPath } from '../config/batShape.js';

const R = 50;
const C = 2 * Math.PI * R;
const BOLT = 'M22 2 L6 30 L17 30 L12 52 L32 20 L20 20 L26 2 Z';
const BALLOON = '<svg width="16" height="22" viewBox="0 0 16 22"><ellipse cx="8" cy="8" rx="7" ry="8" fill="#c8323c" stroke="#0b0b12" stroke-width="1.5"/><path d="M8 16 q-2 3 0 6" stroke="#0b0b12" fill="none"/></svg>';

export function arcDash(fraction, circumference = C, span = 0.75) {
  const f = Math.min(1, Math.max(0, fraction));
  return `${(f * span * circumference).toFixed(2)} ${circumference.toFixed(2)}`;
}

export function createHud(root) {
  const el = document.createElement('div');
  el.className = 'hud';
  el.innerHTML = `
    <div class="hud-combo hidden"><span class="x">x</span><span class="n">0</span></div>
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
    <div class="hud-flash"></div>`;
  root.appendChild(el);
  const combo = el.querySelector('.hud-combo');
  const comboN = combo.querySelector('.n');
  const bar = el.querySelector('.bar');
  const obj = el.querySelector('.obj');
  const balloons = el.querySelector('.balloons span');
  const layer = el.querySelector('.hud-layer');
  const glyphs = new Map();
  const hintEl = el.querySelector('.hud-hint');
  const flashEl = el.querySelector('.hud-flash');
  let hintTimer = null;
  const cardEl = el.querySelector('.hud-card');
  const bossEl = el.querySelector('.hud-boss');
  const bossFill = el.querySelector('.boss-fill');
  const speechEl = el.querySelector('.hud-speech');
  let cardTimer = null;

  return {
    setHealth(f) { bar.setAttribute('stroke-dasharray', arcDash(f)); },
    setCombo(n) {
      comboN.textContent = n;
      combo.classList.toggle('hidden', n === 0);
      combo.classList.toggle('ready', n >= 8);
      combo.classList.remove('pop');
      void combo.offsetWidth;
      if (n > 0) combo.classList.add('pop');
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
    sfx(word, x, y) {
      const s = document.createElement('div');
      s.className = 'sfx';
      s.textContent = word;
      s.style.left = `${x}px`;
      s.style.top = `${y}px`;
      s.style.setProperty('--r', `${(Math.random() * 24 - 12).toFixed(1)}deg`);
      s.addEventListener('animationend', () => s.remove());
      layer.appendChild(s);
    },
  };
}
