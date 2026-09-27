// Panel art drawn with canvas: the Joker on a hijacked TV, his calling card, halftone skies.
import MANSI from '../mansi.config.js';

const INK = '#0b0b12';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function halftone(g, x0, y0, w, h, color, max = 5, step = 12, dir = 1) {
  g.fillStyle = color;
  for (let y = y0; y < y0 + h; y += step) {
    for (let x = x0 + ((y / step) % 2 ? step / 2 : 0); x < x0 + w; x += step) {
      const k = dir > 0 ? (x - x0) / w : 1 - (x - x0) / w;
      const r = max * k;
      if (r < 0.4) continue;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  }
}

// mood: 'grin' | 'smug' | 'angry'
export function drawJoker(g, cx, cy, s, mood = 'grin') {
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // Suit shoulders, green lapels, orange shirt, purple tie.
  g.fillStyle = '#6c3fa3';
  g.strokeStyle = INK;
  g.lineWidth = s * 0.03;
  g.beginPath();
  g.moveTo(cx - s * 1.1, cy + s * 1.6);
  g.quadraticCurveTo(cx - s * 1.05, cy + s * 0.75, cx - s * 0.35, cy + s * 0.62);
  g.lineTo(cx + s * 0.35, cy + s * 0.62);
  g.quadraticCurveTo(cx + s * 1.05, cy + s * 0.75, cx + s * 1.1, cy + s * 1.6);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#62c141';
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sd * s * 0.12, cy + s * 0.64);
    g.lineTo(cx + sd * s * 0.42, cy + s * 0.64);
    g.lineTo(cx + sd * s * 0.22, cy + s * 1.35);
    g.closePath(); g.fill(); g.stroke();
  }
  g.fillStyle = '#e8923a';
  g.beginPath(); g.moveTo(cx - s * 0.12, cy + s * 0.64); g.lineTo(cx + s * 0.12, cy + s * 0.64); g.lineTo(cx, cy + s * 1.3); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#6c3fa3';
  g.beginPath(); g.moveTo(cx - s * 0.06, cy + s * 0.7); g.lineTo(cx + s * 0.06, cy + s * 0.7); g.lineTo(cx + s * 0.05, cy + s * 1.2); g.lineTo(cx, cy + s * 1.28); g.lineTo(cx - s * 0.05, cy + s * 1.2); g.closePath(); g.fill(); g.stroke();
  // Neck.
  g.fillStyle = '#f4f1e8';
  g.fillRect(cx - s * 0.16, cy + s * 0.35, s * 0.32, s * 0.32);
  g.strokeRect(cx - s * 0.16, cy + s * 0.35, s * 0.32, s * 0.32);
  // Hair: green spikes.
  g.fillStyle = '#3f9e34';
  g.beginPath();
  const spikes = 13;
  for (let i = 0; i <= spikes; i++) {
    const a = Math.PI + (i / spikes) * Math.PI;
    const r = s * (i % 2 ? 0.66 : 0.86);
    const x = cx + Math.cos(a) * r * 0.95, y = cy - s * 0.05 + Math.sin(a) * r;
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.closePath(); g.fill(); g.stroke();
  // Face.
  g.fillStyle = '#f4f1e8';
  g.beginPath(); g.ellipse(cx, cy + s * 0.02, s * 0.46, s * 0.58, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  halftone(g, cx + s * 0.05, cy - s * 0.5, s * 0.4, s * 1.1, 'rgba(108,63,163,0.35)', s * 0.03, s * 0.06, 1);
  // Brows and eyes.
  const browTilt = mood === 'angry' ? 0.3 : mood === 'smug' ? -0.1 : -0.2;
  g.lineWidth = s * 0.045;
  for (const sd of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx + sd * s * 0.08, cy - s * 0.2 + browTilt * s * 0.12);
    g.quadraticCurveTo(cx + sd * s * 0.22, cy - s * 0.34, cx + sd * s * 0.36, cy - s * 0.24 - browTilt * s * 0.1);
    g.stroke();
    g.fillStyle = 'rgba(80,40,110,0.55)';
    g.beginPath(); g.ellipse(cx + sd * s * 0.2, cy - s * 0.1, s * 0.13, s * 0.08, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fffbe8';
    g.beginPath(); g.ellipse(cx + sd * s * 0.2, cy - s * 0.1, s * 0.085, mood === 'smug' ? s * 0.03 : s * 0.05, 0, 0, Math.PI * 2); g.fill();
    g.lineWidth = s * 0.02; g.stroke();
    g.fillStyle = INK;
    g.beginPath(); g.arc(cx + sd * s * 0.2 + s * 0.02, cy - s * 0.1, s * 0.025, 0, Math.PI * 2); g.fill();
  }
  // Nose.
  g.lineWidth = s * 0.025;
  g.beginPath(); g.moveTo(cx, cy - s * 0.02); g.quadraticCurveTo(cx + s * 0.07, cy + s * 0.1, cx - s * 0.02, cy + s * 0.12); g.stroke();
  // The grin.
  const w = mood === 'angry' ? 0.36 : 0.44;
  g.fillStyle = '#c8323c';
  g.lineWidth = s * 0.035;
  g.beginPath();
  g.moveTo(cx - s * w, cy + s * 0.12);
  g.quadraticCurveTo(cx, cy + s * (mood === 'angry' ? 0.35 : 0.52), cx + s * w, cy + s * 0.12);
  g.quadraticCurveTo(cx, cy + s * (mood === 'angry' ? 0.3 : 0.3), cx - s * w, cy + s * 0.12);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fffbe8';
  g.beginPath();
  g.moveTo(cx - s * w * 0.85, cy + s * 0.17);
  g.quadraticCurveTo(cx, cy + s * 0.36, cx + s * w * 0.85, cy + s * 0.17);
  g.quadraticCurveTo(cx, cy + s * 0.3, cx - s * w * 0.85, cy + s * 0.17);
  g.fill();
  g.lineWidth = s * 0.012;
  for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(cx + i * s * 0.07, cy + s * 0.22); g.lineTo(cx + i * s * 0.07, cy + s * 0.31); g.stroke(); }
  g.lineWidth = s * 0.02;
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(cx + sd * s * (w + 0.02), cy + s * 0.08); g.quadraticCurveTo(cx + sd * s * (w + 0.06), cy + s * 0.14, cx + sd * s * (w + 0.01), cy + s * 0.2); g.stroke(); }
  g.restore();
}

export function jokerTV(mood = 'grin', { w = 900, h = 520 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#23262d';
  g.fillRect(0, 0, w, h);
  halftone(g, 0, 0, w, h, 'rgba(0,0,0,0.3)', 4, 14, -1);
  // TV set.
  const tx = w * 0.12, ty = h * 0.08, tw = w * 0.76, th = h * 0.84;
  g.fillStyle = '#3b3530';
  g.strokeStyle = INK;
  g.lineWidth = 10;
  g.beginPath(); g.roundRect(tx, ty, tw, th, 34); g.fill(); g.stroke();
  const sx = tx + 34, sy = ty + 30, sw = tw - 150, sh = th - 60;
  const grad = g.createRadialGradient(sx + sw / 2, sy + sh / 2, 10, sx + sw / 2, sy + sh / 2, sw * 0.7);
  grad.addColorStop(0, '#6f8a78');
  grad.addColorStop(1, '#27352c');
  g.fillStyle = grad;
  g.beginPath(); g.roundRect(sx, sy, sw, sh, 26); g.fill();
  g.save();
  g.beginPath(); g.roundRect(sx, sy, sw, sh, 26); g.clip();
  drawJoker(g, sx + sw / 2, sy + sh * 0.44, sh * 0.42, mood);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  for (let y = sy; y < sy + sh; y += 5) g.fillRect(sx, y, sw, 2);
  g.fillStyle = '#c8323c';
  g.fillRect(sx + 16, sy + 16, 78, 30);
  g.fillStyle = '#fff';
  g.font = '26px Bangers, Impact, sans-serif';
  g.fillText('LIVE', sx + 28, sy + 40);
  g.restore();
  g.lineWidth = 8;
  g.beginPath(); g.roundRect(sx, sy, sw, sh, 26); g.stroke();
  // Knobs and grille.
  for (const ky of [0.3, 0.52]) { g.fillStyle = '#1b1c22'; g.beginPath(); g.arc(tx + tw - 58, ty + th * ky, 20, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = '#1b1c22';
  for (let k = 0; k < 6; k++) g.fillRect(tx + tw - 84, ty + th * 0.68 + k * 12, 52, 5);
  // Rabbit ears.
  g.lineWidth = 6;
  g.beginPath(); g.moveTo(tx + tw * 0.45, ty); g.lineTo(tx + tw * 0.32, ty - h * 0.08); g.moveTo(tx + tw * 0.5, ty); g.lineTo(tx + tw * 0.62, ty - h * 0.08); g.stroke();
  return c;
}

export function jokerCard({ w = 700, h = 520 } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = '#2b3a55';
  g.fillRect(0, 0, w, h);
  halftone(g, 0, 0, w, h, 'rgba(11,11,18,0.35)', 5, 14, 1);
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.08);
  const cw = h * 0.62, ch = h * 0.86;
  g.fillStyle = '#fffbee';
  g.strokeStyle = INK;
  g.lineWidth = 8;
  g.beginPath(); g.roundRect(-cw / 2, -ch / 2, cw, ch, 24); g.fill(); g.stroke();
  g.fillStyle = '#c8323c';
  g.font = '44px Bangers, Impact, sans-serif';
  g.fillText('J', -cw / 2 + 16, -ch / 2 + 48);
  g.save(); g.rotate(Math.PI); g.fillText('J', -cw / 2 + 16, -ch / 2 + 48); g.restore();
  g.save();
  g.beginPath(); g.rect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch * 0.62); g.clip();
  drawJoker(g, 0, -ch * 0.2, ch * 0.17, 'grin');
  g.restore();
  g.fillStyle = '#6c3fa3';
  g.font = '40px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.fillText('JOKER', 0, ch * 0.2);
  g.fillStyle = INK;
  g.font = '22px "Patrick Hand SC", sans-serif';
  const lines = [`Happy birthday, ${MANSI.name}!`, 'Your presents are on a boat', 'at the Docks. Hurry up!', 'XOXO, J'];
  lines.forEach((l, i) => g.fillText(l, 0, ch * 0.31 + i * 24 - 8 + (i === 3 ? 6 : 0)));
  g.restore();
  return c;
}

// Big text panel, for the title card moments.
export function titleCard(text, sub = '', { w = 900, h = 500, bg = '#1a2436' } = {}) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  halftone(g, 0, 0, w, h, 'rgba(242,210,75,0.25)', 6, 16, -1);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  const size = Math.min(130, (w * 1.6) / Math.max(8, text.length));
  g.font = `${size}px Bangers, Impact, sans-serif`;
  g.lineWidth = 16;
  g.strokeStyle = INK;
  g.strokeText(text, w / 2, h * 0.45);
  g.fillStyle = '#f2d24b';
  g.fillText(text, w / 2, h * 0.45);
  if (sub) {
    g.font = '40px "Patrick Hand SC", sans-serif';
    g.lineWidth = 8;
    g.strokeText(sub, w / 2, h * 0.72);
    g.fillStyle = '#efe6cf';
    g.fillText(sub, w / 2, h * 0.72);
  }
  return c;
}
