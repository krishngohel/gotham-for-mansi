// Joker paste-ups drawn in code: the rooftop birthday billboard and the WANTED posters. One grin
// drawing serves both, so the city's villain has one recognisable mark.
import * as THREE from 'three';
import { PALETTE, hex } from '../config/palette.js';
import { LAYER_FX } from '../render/layers.js';
import { toonMaterial } from '../render/toon.js';
import { box } from './buckets.js';
import { solid, glow } from './cityBuilder.js';

const INK = hex(PALETTE.ink);
const PAPER = hex(PALETTE.paper);
const GREEN = hex(PALETTE.jokerGreen);
const PURPLE = hex(PALETTE.jokerPurple);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// The grin: a wide crescent (arc below, shallow curve above) full of teeth. r is the arc radius;
// the mouth's corners sit at 0.12 pi either side, so it spans about 1.9 r wide and 0.9 r tall.
export function drawGrin(g, cx, cy, r, ink = r * 0.05) {
  const a0 = Math.PI * 0.12, a1 = Math.PI * 0.88;
  const path = () => {
    g.beginPath();
    g.arc(cx, cy, r, a0, a1);
    g.quadraticCurveTo(cx, cy + r * 0.28, cx + Math.cos(a0) * r, cy + Math.sin(a0) * r);
    g.closePath();
  };
  path();
  g.fillStyle = GREEN;
  g.fill();
  // Teeth: a paper band clipped to the mouth, cut by ink gaps and a gum line.
  g.save();
  path();
  g.clip();
  const top = cy + r * 0.34, bottom = cy + r * 0.78;
  g.fillStyle = PAPER;
  g.fillRect(cx - r, top, r * 2, bottom - top);
  g.fillStyle = INK;
  const tw = r * 0.16;
  for (let t = -4.5; t <= 4.5; t++) g.fillRect(cx + t * tw * 1.35 - ink * 0.35, top - 2, ink * 0.7, bottom - top + 4);
  g.fillRect(cx - r, (top + bottom) / 2 - ink * 0.3, r * 2, ink * 0.6);
  g.restore();
  path();
  g.strokeStyle = INK;
  g.lineWidth = ink;
  g.lineJoin = 'round';
  g.stroke();
}

function benDay(g, w, h, alpha = 0.16) {
  g.fillStyle = `rgba(11,11,18,${alpha})`;
  for (let y = 4; y < h; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < w; x += 14) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
}

function letter(g, text, x, y, font, fill, stroke = INK, width = 8) {
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.strokeText(text, x, y);
  g.fillStyle = fill;
  g.fillText(text, x, y);
}

export function jokerBillboardTexture() {
  const [c, g] = canvas(1024, 512);
  g.fillStyle = PURPLE;
  g.fillRect(0, 0, 1024, 512);
  benDay(g, 1024, 512, 0.14);
  drawGrin(g, 512, 40, 340, 16);
  // The birthday line in 64px Bangers, doubled up by the transform so it reads from the street.
  g.save();
  g.translate(512, 440);
  g.scale(2, 2);
  letter(g, 'HA HA HAPPY BIRTHDAY', 0, 0, '64px Bangers, Impact, sans-serif', PAPER, INK, 7);
  g.restore();
  g.strokeStyle = INK;
  g.lineWidth = 18;
  g.strokeRect(9, 9, 1006, 494);
  return tex(c);
}

let posterTex = null;
export function wantedPosterTexture() {
  if (posterTex) return posterTex;
  const [c, g] = canvas(256, 384);
  // Torn paper edge, so the sheet reads as pasted rather than printed on the wall.
  g.beginPath();
  g.moveTo(6, 6); g.lineTo(250, 4); g.lineTo(252, 340);
  for (let x = 252; x > 4; x -= 22) g.lineTo(x - 11, 378 - ((x / 22) % 3) * 9), g.lineTo(x - 22, 366);
  g.closePath();
  g.fillStyle = '#d9cfae';
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.stroke();
  g.strokeRect(20, 20, 216, 300);
  letter(g, 'WANTED', 128, 58, '58px Bangers, Impact, sans-serif', INK, INK, 2);
  g.fillStyle = PURPLE;
  g.fillRect(34, 88, 188, 130);
  g.save();
  g.beginPath(); g.rect(34, 88, 188, 130); g.clip();
  drawGrin(g, 128, 78, 100, 6);
  g.restore();
  g.strokeStyle = INK; g.lineWidth = 5; g.strokeRect(34, 88, 188, 130);
  letter(g, 'FOR CAKE THEFT', 128, 252, '34px Bangers, Impact, sans-serif', INK, INK, 1);
  letter(g, 'reward: one slice', 128, 298, '26px "Patrick Hand SC", sans-serif', INK, INK, 0.5);
  posterTex = tex(c);
  return posterTex;
}

// A 1.2 x 1.8 m paste-up on a wall. (x, z) is on the wall, (nx, nz) its outward normal. out is
// how far it stands off the wall: storefront walls carry a 0.15 m shop shell, so use 0.22 there.
export function wantedPoster(ctx, x, y, z, nx, nz, tilt = 0, out = 0.06) {
  const mat = toonMaterial({ map: wantedPosterTexture(), side: THREE.DoubleSide });
  mat.transparent = true;
  mat.depthWrite = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), mat);
  m.position.set(x + nx * out, y, z + nz * out);
  m.rotation.y = Math.atan2(nx, nz);
  m.rotation.z = tilt;
  m.layers.set(LAYER_FX);
  ctx.scene.add(m);
}

// The rooftop billboard: a 12 m panel on a steel frame. (x, z) is the panel centre on a roof at
// height y; the panel faces (nx, nz).
export function jokerBillboard(ctx, x, y, z, nx, nz) {
  const width = 12, height = 6, base = y + 2.4;
  const map = jokerBillboardTexture();
  const mat = toonMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.3 });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  panel.position.set(x + nx * 0.2, base + height / 2, z + nz * 0.2);
  panel.rotation.y = Math.atan2(nx, nz);
  panel.castShadow = true;
  ctx.scene.add(panel);
  const along = { x: -nz, z: nx };
  const bw = Math.abs(along.x) ? width : 0.3, bd = Math.abs(along.z) ? width : 0.3;
  solid(ctx, 'steel', box(bw, height, bd, x, base + height / 2, z));
  for (const s of [-0.4, 0.4]) solid(ctx, 'steel', box(0.25, base - y, 0.25, x + along.x * s * width, y + (base - y) / 2, z + along.z * s * width));
  // Diagonal stays and a catwalk lip under the panel.
  for (const s of [-0.4, 0.4]) {
    const stay = new THREE.BoxGeometry(0.1, base - y + 1.5, 0.1).rotateX(0.5).rotateY(Math.atan2(nx, nz))
      .translate(x + along.x * s * width - nx * 0.8, y + (base - y) / 2 + 0.5, z + along.z * s * width - nz * 0.8);
    ctx.buckets.add('steel', stay);
  }
  ctx.buckets.add('steel', box(bw + 0.2, 0.1, bd + (Math.abs(nz) ? 1.2 : 0.2), x + nx * 0.6, base - 0.05, z + nz * 0.6));
  for (const s of [-0.33, 0, 0.33]) {
    const lx = x + along.x * s * width + nx * 1.4, lz = z + along.z * s * width + nz * 1.4;
    glow(ctx, box(0.4, 0.2, 0.4, lx, base - 0.2, lz), PALETTE.jokerGreen);
    ctx.halos.add(lx, base - 0.1, lz, PALETTE.jokerGreen, 1.8);
  }
  ctx.grapple.push({ x, y: base + height, z, nx, nz, perch: true });
}
