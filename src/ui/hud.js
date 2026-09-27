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
    <div class="hud-layer"></div>`;
  root.appendChild(el);
  const combo = el.querySelector('.hud-combo');
  const comboN = combo.querySelector('.n');
  const bar = el.querySelector('.bar');
  const obj = el.querySelector('.obj');
  const balloons = el.querySelector('.balloons span');
  const layer = el.querySelector('.hud-layer');
  const glyphs = new Map();

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
    setObjective(text) { obj.textContent = text; },
    setBalloons(n, total) { balloons.textContent = `${n}/${total}`; },
    glyph(id, x, y, visible) {
      let g = glyphs.get(id);
      if (!visible) { if (g) { g.remove(); glyphs.delete(id); } return; }
      if (!g) {
        g = document.createElement('div');
        g.className = 'glyph';
        g.innerHTML = `<svg viewBox="0 0 38 54"><path d="${BOLT}"/></svg>`;
        layer.appendChild(g);
        glyphs.set(id, g);
      }
      g.style.left = `${x}px`;
      g.style.top = `${y}px`;
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
