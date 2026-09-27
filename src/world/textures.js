// Canvas-painted textures for the city. Each facade gets an albedo map and a matching emissive
// map that holds only the lit windows, so walls still take toon lighting.
import * as THREE from 'three';
import { PALETTE, hex } from '../config/palette.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

const shade = (n, k) => {
  const c = new THREE.Color(n);
  c.offsetHSL(0, 0, k);
  return '#' + c.getHexString();
};

// Facade styles: wall color, window grid, window shape and how many are lit.
const FACADES = {
  brick: { wall: PALETTE.brick, cols: 8, rows: 16, win: [0.5, 0.55], lit: 0.24, frame: PALETTE.trim, mortar: true },
  stone: { wall: PALETTE.stone, cols: 6, rows: 16, win: [0.42, 0.66], lit: 0.2, frame: 0x55524d, arch: true },
  deco: { wall: PALETTE.deco, cols: 10, rows: 16, win: [0.44, 0.6], lit: 0.26, frame: 0x7a8296, pilasters: true },
  concrete: { wall: PALETTE.concrete, cols: 8, rows: 16, win: [0.8, 0.42], lit: 0.22, frame: 0x3d4046 },
  warehouse: { wall: 0x5b5448, cols: 8, rows: 16, win: [0.6, 0.28], lit: 0.12, frame: 0x3d3a34, sparse: true, corrugated: true },
  factory: { wall: 0x4f4a44, cols: 6, rows: 16, win: [0.7, 0.7], lit: 0.18, frame: 0x2f2d2a, grid: true },
  steel: { wall: PALETTE.steel, cols: 4, rows: 16, win: [0.2, 0.1], lit: 0, frame: 0x2a2f38, panels: true },
};

export function facadeTextures(style, rng) {
  const f = FACADES[style] ?? FACADES.brick;
  const W = 512, H = 1024;
  const [ca, a] = canvas(W, H);
  const [ce, e] = canvas(W, H);
  a.fillStyle = hex(f.wall);
  a.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);

  // Wall texture detail.
  if (f.mortar) {
    a.fillStyle = shade(f.wall, -0.05);
    for (let y = 0; y < H; y += 8) a.fillRect(0, y, W, 1);
  }
  if (f.corrugated) {
    for (let x = 0; x < W; x += 6) { a.fillStyle = x % 12 ? shade(f.wall, 0.03) : shade(f.wall, -0.05); a.fillRect(x, 0, 3, H); }
  }
  if (f.panels) {
    a.strokeStyle = shade(f.wall, -0.08);
    a.lineWidth = 3;
    for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 128) a.strokeRect(x + 2, y + 2, 124, 60);
  }
  if (f.pilasters) {
    a.fillStyle = shade(f.wall, 0.06);
    for (let x = 0; x < W; x += W / f.cols) a.fillRect(x, 0, 6, H);
  }
  for (let i = 0; i < 900; i++) {
    a.fillStyle = `rgba(0,0,0,${rng.range(0.03, 0.1)})`;
    a.fillRect(rng.range(0, W), rng.range(0, H), rng.range(1, 3), rng.range(4, 30));
  }

  const cw = W / f.cols, rh = H / f.rows;
  const ww = cw * f.win[0], wh = rh * f.win[1];
  for (let r = 0; r < f.rows; r++) {
    for (let k = 0; k < f.cols; k++) {
      if (f.sparse && r % 4 !== 1) continue;
      const x = k * cw + (cw - ww) / 2, y = r * rh + (rh - wh) / 2;
      a.fillStyle = hex(f.frame);
      a.fillRect(x - 3, y - 3, ww + 6, wh + 6);
      const lit = rng.chance(f.lit);
      if (lit) {
        const warm = rng.chance(0.72);
        const col = warm ? hex(PALETTE.window) : hex(PALETTE.windowCool);
        const blind = rng.chance(0.3) ? rng.range(0.2, 0.7) : 0;
        a.fillStyle = col;
        a.fillRect(x, y, ww, wh);
        e.globalAlpha = rng.range(0.55, 1);
        e.fillStyle = col;
        e.fillRect(x, y + wh * blind, ww, wh * (1 - blind));
        e.globalAlpha = 1;
        if (blind) { a.fillStyle = shade(PALETTE.window, -0.25); a.fillRect(x, y, ww, wh * blind); }
        // Now and then someone is home.
        if (rng.chance(0.08)) {
          e.fillStyle = '#000';
          a.fillStyle = '#0b0b12';
          const sx = x + ww * rng.range(0.25, 0.6), sy = y + wh * 0.35;
          for (const ctx of [a, e]) {
            ctx.beginPath();
            ctx.arc(sx, sy, ww * 0.12, 0, Math.PI * 2);
            ctx.fillRect(sx - ww * 0.16, sy + ww * 0.1, ww * 0.32, wh);
            ctx.fill();
          }
        }
      } else {
        a.fillStyle = '#161b25';
        a.fillRect(x, y, ww, wh);
        a.fillStyle = 'rgba(111,138,166,0.18)';
        a.fillRect(x, y, ww * 0.35, wh);
      }
      if (f.arch) {
        a.fillStyle = hex(f.frame);
        a.beginPath();
        a.arc(x + ww / 2, y, ww / 2 + 3, Math.PI, 0);
        a.fill();
      }
      if (f.grid) {
        a.fillStyle = hex(f.frame);
        for (let g = 1; g < 3; g++) { a.fillRect(x + (ww * g) / 3, y, 2, wh); a.fillRect(x, y + (wh * g) / 3, ww, 2); }
      }
    }
  }
  return { map: tex(ca), emissive: tex(ce) };
}

const SHOP_NAMES = ['DELI', 'BOOKS', 'DRUGS', 'HARDWARE', 'LAUNDRY', 'BAKERY', 'FLOWERS', 'RADIO', 'TAILOR', 'SHOES', 'DINER', 'GROCERY', 'BARBER', 'PAWN'];

export function storefrontTextures(rng) {
  const W = 1024, H = 128;
  const [ca, a] = canvas(W, H);
  const [ce, e] = canvas(W, H);
  a.fillStyle = '#2a2b31';
  a.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const shops = 6, sw = W / shops;
  const awnings = [PALETTE.balloon, PALETTE.containerBlue, PALETTE.containerGreen, PALETTE.jokerPurple, PALETTE.rust, 0x2f5a5a];
  for (let s = 0; s < shops; s++) {
    const x = s * sw;
    const open = rng.chance(0.7);
    const glowCol = rng.pick([PALETTE.window, PALETTE.window, PALETTE.windowCool, 0xd8c890]);
    const glow = hex(glowCol);
    const winX = x + 10, winW = sw - 54, winY = 48, winH = 64;
    if (open) {
      const grad = a.createLinearGradient(0, winY, 0, winY + winH);
      grad.addColorStop(0, glow);
      grad.addColorStop(1, shade(glowCol, -0.18));
      a.fillStyle = grad;
      a.fillRect(winX, winY, winW, winH);
      e.globalAlpha = 0.6;
      e.fillStyle = glow;
      e.fillRect(winX, winY, winW, winH);
      e.globalAlpha = 1;
      // Goods on shelves and the odd customer, in ink.
      a.fillStyle = 'rgba(11,11,18,0.5)';
      for (let k = 0; k < 2; k++) a.fillRect(winX + 4, winY + 22 + k * 20, winW - 8, 3);
      for (let k = 0; k < 7; k++) a.fillRect(winX + 6 + rng.range(0, winW - 14), winY + 10 + rng.int(0, 1) * 20, rng.range(4, 9), 10);
      if (rng.chance(0.5)) {
        const px = winX + rng.range(15, winW - 15);
        a.fillStyle = 'rgba(11,11,18,0.8)';
        a.beginPath(); a.arc(px, winY + 24, 6, 0, Math.PI * 2); a.fill();
        a.fillRect(px - 8, winY + 30, 16, winH - 30);
      }
    } else {
      a.fillStyle = '#3a3d44';
      a.fillRect(winX, winY, winW, winH);
      a.fillStyle = '#2c2f35';
      for (let y = winY + 2; y < winY + winH; y += 5) a.fillRect(winX, y, winW, 2);
    }
    // Mullions and frame.
    a.fillStyle = '#15161b';
    a.fillRect(winX - 3, winY - 3, winW + 6, 3);
    a.fillRect(winX - 3, winY + winH, winW + 6, 4);
    for (let k = 0; k <= 3; k++) a.fillRect(winX - 2 + (k * winW) / 3, winY, 3, winH);
    // Door.
    a.fillStyle = '#121419';
    a.fillRect(x + sw - 38, winY - 4, 26, H - winY + 4);
    if (open) { a.fillStyle = shade(glowCol, -0.1); a.fillRect(x + sw - 34, winY + 2, 18, 30); e.fillStyle = glow; e.globalAlpha = 0.5; e.fillRect(x + sw - 34, winY + 2, 18, 30); e.globalAlpha = 1; }
    // Awning and sign board.
    const aw = awnings[(s + rng.int(0, 5)) % awnings.length];
    for (let k = 0; k < sw; k += 14) { a.fillStyle = k % 28 ? hex(aw) : shade(aw, 0.12); a.fillRect(x + k, 26, 14, 18); }
    a.fillStyle = '#0b0b12';
    a.fillRect(x, 43, sw, 3);
    a.fillStyle = '#1b1c22';
    a.fillRect(x + 4, 2, sw - 8, 22);
    a.font = '18px "Barlow Condensed", sans-serif';
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    const name = rng.pick(SHOP_NAMES);
    a.fillStyle = open ? hex(PALETTE.paper) : '#6a6d74';
    a.fillText(name, x + sw / 2, 13);
    if (open) { e.font = a.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = hex(PALETTE.paper); e.globalAlpha = 0.7; e.fillText(name, x + sw / 2, 13); e.globalAlpha = 1; }
  }
  return { map: tex(ca), emissive: tex(ce) };
}

export function noiseTexture(rng, base, spread = 0.05, size = 256, dots = 4000) {
  const [c, g] = canvas(size, size);
  g.fillStyle = hex(base);
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < dots; i++) {
    g.fillStyle = shade(base, rng.range(-spread, spread));
    g.fillRect(rng.range(0, size), rng.range(0, size), rng.range(1, 3), rng.range(1, 3));
  }
  return tex(c);
}

export function neonTexture(text, color, { vertical = false } = {}) {
  const chars = [...text];
  const fs = 96;
  const w = vertical ? 160 : Math.max(256, chars.length * fs * 0.62 + 80);
  const h = vertical ? chars.length * fs * 1.02 + 60 : 180;
  const [c, g] = canvas(Math.ceil(w), Math.ceil(h));
  g.font = `${fs}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const draw = (blur, stroke, fill) => {
    g.shadowColor = color;
    g.shadowBlur = blur;
    g.lineWidth = stroke;
    g.strokeStyle = color;
    g.fillStyle = fill;
    if (vertical) chars.forEach((ch, i) => { g.strokeText(ch, w / 2, 60 + i * fs * 1.02); g.fillText(ch, w / 2, 60 + i * fs * 1.02); });
    else { g.strokeText(text, w / 2, h / 2); g.fillText(text, w / 2, h / 2); }
  };
  draw(40, 10, color);
  draw(12, 4, '#ffffff');
  const t = tex(c, { repeat: false });
  return { texture: t, aspect: w / h };
}

export function billboardTexture(text, sub, bg) {
  const [c, g] = canvas(1024, 400);
  g.fillStyle = hex(bg);
  g.fillRect(0, 0, 1024, 400);
  // Ben-Day dots in the corner, very comic.
  g.fillStyle = 'rgba(11,11,18,0.18)';
  for (let y = 0; y < 400; y += 14) for (let x = (y / 14) % 2 ? 7 : 0; x < 1024; x += 14) { g.beginPath(); g.arc(x, y, 3.2 * (1 - x / 1024), 0, Math.PI * 2); g.fill(); }
  g.fillStyle = hex(PALETTE.paper);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 14;
  g.font = '150px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const size = Math.min(150, 1900 / Math.max(6, text.length));
  g.font = `${size}px Bangers, Impact, sans-serif`;
  g.strokeText(text, 512, 170);
  g.fillText(text, 512, 170);
  g.font = '56px "Patrick Hand SC", sans-serif';
  g.lineWidth = 8;
  g.strokeText(sub, 512, 305);
  g.fillText(sub, 512, 305);
  g.strokeStyle = hex(PALETTE.ink);
  g.lineWidth = 16;
  g.strokeRect(8, 8, 1008, 384);
  return tex(c, { repeat: false });
}

export function graffitiTexture(rng, text = 'HA HA HA') {
  const [c, g] = canvas(512, 256);
  g.clearRect(0, 0, 512, 256);
  g.translate(256, 128);
  g.rotate(rng.range(-0.18, 0.18));
  g.font = '120px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = hex(PALETTE.jokerPurple);
  g.lineWidth = 18;
  g.strokeText(text, 0, 0);
  g.fillStyle = hex(PALETTE.jokerGreen);
  g.fillText(text, 0, 0);
  // Drips.
  g.fillStyle = hex(PALETTE.jokerGreen);
  for (let i = 0; i < 9; i++) g.fillRect(rng.range(-200, 200), rng.range(10, 40), 4, rng.range(20, 70));
  return tex(c, { repeat: false });
}
