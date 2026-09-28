// Inks the Progress page map: paper, hatched harbour, district-tinted blocks, balloon pins
// (filled when found, outlined once their district is visited) and bat medals for challenges.
import { batOutline } from '../config/batShape.js';

const INK = '#0b0b12', PAPER = '#efe6cf', RED = '#c8323c';
const TINT = { gcpd: '#9fb2d6', docks: '#8fb3a8', neon: '#d99ac8', ace: '#a7c47a', clock: '#c9b48a', city: '#d8cfb8' };
const MEDAL = { gold: '#f2d24b', silver: '#c9ccd6', bronze: '#c07a3c' };
const BAT = batOutline();

export function drawProgressMap(canvas, m) {
  const g = canvas.getContext('2d');
  g.save();
  g.scale(canvas.width / m.size, canvas.height / m.size);
  g.fillStyle = PAPER;
  g.fillRect(0, 0, m.size, m.size);
  g.fillStyle = '#b9c7cf';
  g.fillRect(0, m.water, m.size, m.size - m.water);
  g.strokeStyle = 'rgba(11,11,18,0.35)';
  g.lineWidth = 0.6;
  const depth = m.size - m.water;
  for (let x = -depth; x < m.size; x += 6) { g.beginPath(); g.moveTo(x, m.size); g.lineTo(x + depth, m.water); g.stroke(); }
  g.strokeStyle = INK;
  for (const b of m.blocks) {
    g.fillStyle = TINT[b.district] ?? TINT.city;
    g.fillRect(b.u, b.v, b.w, b.h);
    g.lineWidth = b.landmark ? 1.4 : 0.7;
    g.strokeRect(b.u, b.v, b.w, b.h);
  }
  for (const c of m.challenges) {
    g.beginPath();
    BAT.forEach(([x, y], i) => (i ? g.lineTo(c.u + x * 0.12, c.v - y * 0.12) : g.moveTo(c.u + x * 0.12, c.v - y * 0.12)));
    g.closePath();
    g.fillStyle = MEDAL[c.medal] ?? PAPER;
    g.fill();
    g.lineWidth = 1;
    g.strokeStyle = INK;
    g.stroke();
  }
  for (const p of m.balloons) {
    g.beginPath();
    g.arc(p.u, p.v, 3.2, 0, Math.PI * 2);
    if (p.found) { g.fillStyle = RED; g.fill(); }
    g.lineWidth = 1.3;
    g.strokeStyle = p.found ? INK : RED;
    g.stroke();
  }
  g.lineWidth = 3;
  g.strokeStyle = INK;
  g.strokeRect(1.5, 1.5, m.size - 3, m.size - 3);
  g.restore();
}
