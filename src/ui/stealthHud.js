// Predator HUD: an awareness ring over each room goon (it fills white while he notices Batman,
// turns yellow while he searches and red once he has found him), speech balloons for the lines
// goons call out, the armed-goon counter for detective vision, the takedown prompt and a crouch
// badge. Pooled DOM: every element is made once; classes and attributes change only when a code
// changes, and only positions are written every frame.
import { glyphColor, glyphFill } from '../stealth/brain.js';

const MAX = 8, LINES = 3, LINE_TIME = 2.6;
const RING = 2 * Math.PI * 12;
const RIFLE = '<path d="M3 21 L29 21 L33 17 L45 17 L45 21 L41 23 L31 23 L27 29 L21 29 L23 23 L3 23 Z"/>';
const CROUCH = '<circle cx="21" cy="9" r="4.5"/><path d="M13 30 L17 20 L27 18 L31 27 L25 34 M17 20 L11 27"/>';

export function createStealthHud(root) {
  const el = document.createElement('div');
  el.className = 'stealth-hud';
  el.innerHTML = `
    <div class="st-armed hidden"><svg viewBox="0 0 48 40">${RIFLE}</svg><b>0</b><span>ARMED</span></div>
    <div class="st-prompt hidden"></div>
    <div class="st-crouch hidden"><svg viewBox="0 0 40 40">${CROUCH}</svg></div>`;
  root.appendChild(el);
  const armedEl = el.querySelector('.st-armed'), armedN = armedEl.querySelector('b');
  const promptEl = el.querySelector('.st-prompt'), crouchEl = el.querySelector('.st-crouch');
  const glyphs = [];
  for (let i = 0; i < MAX; i++) {
    const g = document.createElement('div');
    g.className = 'st-aware hidden';
    g.innerHTML = `<svg viewBox="0 0 32 32"><circle class="bg" cx="16" cy="16" r="12"/><circle class="fill" cx="16" cy="16" r="12" stroke-dasharray="0 ${RING.toFixed(1)}" transform="rotate(-90 16 16)"/></svg><b></b>`;
    el.appendChild(g);
    glyphs.push({ el: g, fill: g.querySelector('.fill'), mark: g.querySelector('b'), code: -1, shown: false });
  }
  const lines = [];
  for (let i = 0; i < LINES; i++) {
    const b = document.createElement('div');
    b.className = 'st-line hidden';
    el.appendChild(b);
    lines.push({ el: b, target: null, t: 0, shown: false });
  }
  let next = 0, armedCount = -1, armedShown = null, promptHtml = null, crouchOn = false;
  const show = (o, v) => { if (o.shown !== v) { o.shown = v; o.el.classList.toggle('hidden', !v); } };

  const hud = {
    // code from brain.glyphCode(mind); x, y: the goon's head on screen.
    glyph(i, x, y, visible, code) {
      const g = glyphs[i];
      if (!g) return;
      show(g, visible && code > 0);
      if (!g.shown) return;
      if (code !== g.code) {
        g.code = code;
        g.el.dataset.c = glyphColor(code);
        g.fill.setAttribute('stroke-dasharray', `${(glyphFill(code) * RING).toFixed(1)} ${RING.toFixed(1)}`);
        g.mark.textContent = code >> 5 === 3 ? '!' : '?';
      }
      g.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },
    hideFrom(n) { for (let i = n; i < MAX; i++) show(glyphs[i], false); },
    // A line over `target` for a moment (the same goon's new line replaces its old one).
    say(target, text) {
      let l = null;
      for (const x of lines) if (x.target === target) l = x;
      if (!l) { l = lines[next]; next = (next + 1) % LINES; }
      l.target = target;
      l.t = LINE_TIME;
      l.el.textContent = text;
    },
    // place(e) -> { x, y, behind }: where the goon's head is on screen (a shared object is fine).
    updateLines(dt, place) {
      for (const l of lines) {
        if (!l.target) continue;
        l.t -= dt;
        if (l.t <= 0 || !l.target.alive) { l.target = null; show(l, false); continue; }
        const p = place(l.target);
        show(l, !p.behind);
        if (l.shown) l.el.style.transform = `translate(${Math.round(p.x + 14)}px, ${Math.round(p.y - 70)}px)`;
      }
    },
    armed(n, visible) {
      if (n === armedCount && visible === armedShown) return;
      armedCount = n;
      armedShown = visible;
      armedEl.classList.toggle('hidden', !visible);
      armedN.textContent = String(n);
    },
    prompt(html) {
      if (html === promptHtml) return;
      promptHtml = html;
      promptEl.classList.toggle('hidden', !html);
      if (html) promptEl.innerHTML = html;
    },
    crouch(on) {
      if (on === crouchOn) return;
      crouchOn = on;
      crouchEl.classList.toggle('hidden', !on);
    },
    clear() {
      for (const g of glyphs) { show(g, false); g.code = -1; }
      for (const l of lines) { l.target = null; show(l, false); }
      hud.armed(0, false);
      hud.prompt(null);
    },
  };
  return hud;
}
