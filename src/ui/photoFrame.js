// Draws a photo's frame, cover masthead and caption onto a 2D canvas. The same function draws
// the on-screen preview and the saved PNG, so what you frame is what you save.
import { frameLayout } from '../game/photoMath.js';
import MANSI from '../mansi.config.js';

const INK = '#0b0b12', PAPER = '#efe6cf', SIGNAL = '#f2d24b', RED = '#c8323c';

function wrap(g, text, max) {
  const lines = [];
  let cur = '';
  for (const word of text.split(' ')) {
    const t = cur ? `${cur} ${word}` : word;
    if (cur && g.measureText(t).width > max) { lines.push(cur); cur = word; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

function fitFont(g, text, family, size, maxW) {
  let s = size;
  g.font = `${s}px ${family}`;
  while (s > 8 && g.measureText(text).width > maxW) { s *= 0.92; g.font = `${s}px ${family}`; }
  return s;
}

export function drawPhotoFrame(g, w, h, { frame = 'none', caption = '', issue = '' } = {}) {
  const L = frameLayout(frame, w, h);
  g.save();
  g.lineJoin = 'round';
  if (L.inset > 0) {
    g.fillStyle = PAPER;
    g.fillRect(0, 0, w, L.inset);
    g.fillRect(0, h - L.inset, w, L.inset);
    g.fillRect(0, 0, L.inset, h);
    g.fillRect(w - L.inset, 0, L.inset, h);
    g.lineWidth = L.border;
    g.strokeStyle = INK;
    g.strokeRect(L.inset + L.border / 2, L.inset + L.border / 2, w - 2 * L.inset - L.border, h - 2 * L.inset - L.border);
  }
  if (L.masthead) {
    const m = L.masthead, s = L.issue;
    g.fillStyle = RED;
    g.fillRect(m.x, m.y, m.w, m.h);
    g.lineWidth = L.border;
    g.strokeStyle = INK;
    g.strokeRect(m.x, m.y, m.w, m.h);
    const title = `GOTHAM FOR ${MANSI.name.toUpperCase()}`;
    const size = fitFont(g, title, 'Bangers, Impact, sans-serif', m.h * 0.66, s.x - m.x - L.u * 6);
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    g.lineWidth = size * 0.14;
    g.strokeText(title, m.x + L.u * 3, m.y + m.h * 0.54);
    g.fillStyle = SIGNAL;
    g.fillText(title, m.x + L.u * 3, m.y + m.h * 0.54);
    g.fillStyle = PAPER;
    g.fillRect(s.x, s.y, s.w, s.h);
    g.lineWidth = L.border;
    g.strokeRect(s.x, s.y, s.w, s.h);
    g.fillStyle = INK;
    g.textAlign = 'center';
    g.font = `700 ${s.h * 0.26}px "Barlow Condensed", sans-serif`;
    g.fillText('ISSUE', s.x + s.w / 2, s.y + s.h * 0.3);
    g.font = `${s.h * 0.42}px Bangers, Impact, sans-serif`;
    g.fillText(issue, s.x + s.w / 2, s.y + s.h * 0.68);
  }
  const text = caption.trim();
  if (text) {
    const c = L.caption, pad = L.u * 2;
    g.font = `${c.font}px "Patrick Hand SC", cursive`;
    const lines = wrap(g, text, c.maxW - pad * 2);
    const lh = c.font * 1.15;
    const bw = Math.min(c.maxW, Math.max(...lines.map((l) => g.measureText(l).width)) + pad * 2);
    const bh = lines.length * lh + L.u * 2.4;
    g.translate(c.x, c.y + c.h - bh);
    g.rotate(-0.02);
    g.fillStyle = INK;
    g.fillRect(L.u * 0.8, L.u * 0.8, bw, bh);
    g.fillStyle = SIGNAL;
    g.fillRect(0, 0, bw, bh);
    g.lineWidth = Math.max(2, L.u * 0.5);
    g.strokeStyle = INK;
    g.strokeRect(0, 0, bw, bh);
    g.fillStyle = INK;
    g.textBaseline = 'top';
    g.textAlign = 'left';
    lines.forEach((l, i) => g.fillText(l, pad, L.u * 1.2 + i * lh));
  }
  g.restore();
}
