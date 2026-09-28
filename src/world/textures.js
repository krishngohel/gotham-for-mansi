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

// Lightens or darkens a hex color in sRGB (canvas) space. THREE.Color would do the HSL math in
// linear space, where a small negative offset crushes dark colors to pure black.
const shade = (n, k) => {
  const c = new THREE.Color().setHex(n, THREE.LinearSRGBColorSpace);
  c.offsetHSL(0, 0, k);
  return '#' + c.getHexString(THREE.LinearSRGBColorSpace);
};

// Facade styles: wall color, window grid, window shape, how many are lit and the ornament kit.
// The texture spans FACADE_METERS across and 54.4 m (16 floors of 3.4 m) up; row 15 is the ground floor.
const FACADES = {
  brick: { wall: PALETTE.brick, cols: 8, rows: 16, win: [0.44, 0.56], lit: 0.28, frame: 0x2b2427, sill: PALETTE.trim, kit: 'brick', panes: 'sash' },
  stone: { wall: 0x66625c, cols: 6, rows: 16, win: [0.38, 0.54], lit: 0.24, frame: 0x34322e, sill: 0x9a948a, kit: 'stone', arch: true, panes: 'cross' },
  deco: { wall: PALETTE.deco, cols: 10, rows: 16, win: [0.5, 0.6], lit: 0.28, frame: 0x222733, sill: 0x7a8296, kit: 'deco', panes: 'single' },
  concrete: { wall: PALETTE.concrete, cols: 8, rows: 16, win: [1, 0.42], lit: 0.24, frame: 0x2a2d33, sill: 0x6e7178, kit: 'concrete', panes: 'ribbon' },
  warehouse: { wall: 0x5b5448, cols: 8, rows: 16, win: [0.6, 0.3], lit: 0.16, frame: 0x2f2c28, sill: 0x6c655a, kit: 'warehouse', sparse: true, panes: 'grid' },
  factory: { wall: 0x4f4a44, cols: 6, rows: 16, win: [0.7, 0.62], lit: 0.22, frame: 0x24221f, sill: 0x625c55, kit: 'factory', panes: 'grid' },
  steel: { wall: PALETTE.steel, cols: 4, rows: 16, win: [0.2, 0.1], lit: 0, frame: 0x2a2f38, sill: 0x4b586e, kit: 'steel', panes: 'none' },
};
export const FACADE_GRID = Object.fromEntries(Object.entries(FACADES).map(([k, f]) => [k, { cols: f.cols, rows: f.rows, win: f.win, sparse: !!f.sparse }]));

const INK = 'rgba(11,11,18,';

// A soft rain stain running down from (x, y).
function streak(g, x, y, w, len, alpha) {
  const grad = g.createLinearGradient(0, y, 0, y + len);
  grad.addColorStop(0, `${INK}${alpha})`);
  grad.addColorStop(1, `${INK}0)`);
  g.fillStyle = grad;
  g.fillRect(x, y, w, len);
}

function windowPath(g, x, y, w, h, arch) {
  g.beginPath();
  if (arch) {
    const r = w / 2;
    g.moveTo(x, y + h);
    g.lineTo(x, y + r);
    g.arc(x + r, y + r, r, Math.PI, 0);
    g.lineTo(x + w, y + h);
    g.closePath();
  } else g.rect(x, y, w, h);
}

// Paints the glass of one window into the albedo (a) and emissive (e) canvases.
function paintGlass(a, e, rng, x, y, w, h, u, lit) {
  if (!lit) {
    a.fillStyle = '#141923';
    a.fillRect(x, y, w, h);
    if (rng.chance(0.25)) {
      // Drawn curtains in a dark room.
      a.fillStyle = rng.pick(['#2a2230', '#2b2a24', '#1f2733']);
      a.fillRect(x, y, w, h);
      a.fillStyle = `${INK}0.35)`;
      for (let k = 1; k < 4; k++) a.fillRect(x + (w * k) / 4, y, u, h);
    } else if (rng.chance(0.8)) {
      // Cold sky glint: two clean diagonal strokes, the comic shorthand for glass.
      const k = rng.range(0.2, 0.7);
      a.fillStyle = 'rgba(120,146,176,0.22)';
      a.beginPath();
      a.moveTo(x + w * k, y); a.lineTo(x + w * (k + 0.24), y); a.lineTo(x + w * (k - 0.18), y + h); a.lineTo(x + w * (k - 0.42), y + h);
      a.fill();
      a.fillStyle = 'rgba(120,146,176,0.12)';
      a.beginPath();
      a.moveTo(x + w * (k + 0.32), y); a.lineTo(x + w * (k + 0.4), y); a.lineTo(x + w * (k - 0.02), y + h); a.lineTo(x + w * (k - 0.1), y + h);
      a.fill();
    }
    return;
  }
  const warm = rng.chance(0.7);
  const tv = !warm && rng.chance(0.35);
  const col = warm ? rng.pick([PALETTE.window, PALETTE.window, 0xd9b36a, 0xe0a060]) : PALETTE.windowCool;
  const light = shade(col, 0.08), dark = shade(col, -0.2);
  // A lamp somewhere in the room: bright near it, falling off to the corners.
  const lx = x + w * rng.range(0.2, 0.8), ly = y + h * rng.range(0.25, 0.6);
  for (const [g, alpha] of [[a, 1], [e, rng.range(0.6, 1)]]) {
    const grad = g.createRadialGradient(lx, ly, 0, lx, ly, Math.max(w, h) * 0.9);
    grad.addColorStop(0, tv ? hex(0xdfe8ff) : light);
    grad.addColorStop(0.45, hex(col));
    grad.addColorStop(1, dark);
    g.globalAlpha = alpha;
    g.fillStyle = grad;
    g.fillRect(x, y, w, h);
    g.globalAlpha = 1;
  }
  const kind = rng.next();
  const both = (fn) => { fn(a, false); fn(e, true); };
  if (tv) {
    // Someone in an armchair facing the set.
    both((g, em) => {
      g.fillStyle = em ? '#000' : hex(PALETTE.ink);
      g.beginPath(); g.arc(x + w * 0.5, y + h * 0.62, w * 0.12, 0, Math.PI * 2); g.fill();
      g.fillRect(x + w * 0.2, y + h * 0.74, w * 0.6, h * 0.3);
    });
  } else if (kind < 0.22) {
    // Curtains tied back.
    const drape = shade(col, -0.32);
    both((g, em) => {
      g.fillStyle = em ? 'rgba(0,0,0,0.85)' : drape;
      for (const s of [0, 1]) {
        const ox = s ? x + w : x, dir = s ? -1 : 1;
        g.beginPath();
        g.moveTo(ox, y); g.lineTo(ox + dir * w * 0.34, y);
        g.quadraticCurveTo(ox + dir * w * 0.08, y + h * 0.5, ox + dir * w * 0.2, y + h);
        g.lineTo(ox, y + h); g.closePath(); g.fill();
      }
    });
  } else if (kind < 0.42) {
    // Venetian blinds, part way down.
    const down = rng.range(0.25, 0.8);
    both((g, em) => {
      g.fillStyle = em ? 'rgba(0,0,0,0.55)' : shade(col, -0.18);
      g.fillRect(x, y, w, h * down);
      g.fillStyle = em ? 'rgba(0,0,0,0.9)' : `${INK}0.55)`;
      for (let yy = y + 3 * u; yy < y + h * down; yy += 4 * u) g.fillRect(x, yy, w, u);
    });
  } else if (kind < 0.54) {
    // A figure at the window.
    const px = x + w * rng.range(0.3, 0.7);
    both((g, em) => {
      g.fillStyle = em ? '#000' : hex(PALETTE.ink);
      g.beginPath(); g.arc(px, y + h * 0.36, w * 0.11, 0, Math.PI * 2); g.fill();
      g.beginPath();
      g.moveTo(px - w * 0.22, y + h); g.quadraticCurveTo(px - w * 0.2, y + h * 0.5, px, y + h * 0.48);
      g.quadraticCurveTo(px + w * 0.2, y + h * 0.5, px + w * 0.22, y + h); g.fill();
    });
  } else if (kind < 0.64) {
    // A plant on the sill.
    const px = x + w * rng.range(0.15, 0.85);
    both((g, em) => {
      g.fillStyle = em ? '#000' : hex(PALETTE.ink);
      g.fillRect(px - w * 0.08, y + h * 0.82, w * 0.16, h * 0.18);
      for (let k = 0; k < 5; k++) {
        const ang = -Math.PI / 2 + (k - 2) * 0.45;
        g.beginPath();
        g.ellipse(px + Math.cos(ang) * w * 0.12, y + h * 0.8 + Math.sin(ang) * h * 0.12, w * 0.05, h * 0.09, ang + Math.PI / 2, 0, Math.PI * 2);
        g.fill();
      }
    });
  }
}

function mullions(a, e, f, x, y, w, h, u) {
  const bars = [];
  if (f.panes === 'sash') bars.push([x, y + h * 0.48, w, 2 * u], [x + w / 2 - u, y, 2 * u, h]);
  if (f.panes === 'cross') bars.push([x, y + h * 0.3, w, 2 * u], [x + w / 2 - u, y, 2 * u, h]);
  if (f.panes === 'single') bars.push([x + w / 2 - u, y, 2 * u, h]);
  if (f.panes === 'ribbon') bars.push([x, y, 3 * u, h], [x + w * 0.5 - u, y + h * 0.15, 2 * u, h]);
  if (f.panes === 'grid') for (let k = 1; k < 4; k++) bars.push([x + (w * k) / 4 - u, y, 2 * u, h], [x, y + (h * k) / 4 - u, w, 2 * u]);
  a.fillStyle = hex(f.frame);
  e.fillStyle = '#000';
  for (const [bx, by, bw, bh] of bars) { a.fillRect(bx, by, bw, bh); e.fillRect(bx, by, bw, bh); }
}

export function facadeTextures(style, rng) {
  const f = FACADES[style] ?? FACADES.brick;
  const W = style === 'steel' ? 512 : 1024, H = W * 2, u = W / 512;
  const [ca, a] = canvas(W, H);
  const [ce, e] = canvas(W / 2, H / 2);
  e.scale(0.5, 0.5);
  a.fillStyle = hex(f.wall);
  a.fillRect(0, 0, W, H);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H);
  const cw = W / f.cols, rh = H / f.rows;
  const ww = cw * f.win[0], wh = rh * f.win[1];
  const wallDark = shade(f.wall, -0.06), wallLight = shade(f.wall, 0.05);

  // ---- wall surface: a few clean hints instead of noise ----
  if (f.kit === 'brick' || f.kit === 'factory') {
    // Brick clusters, the comic-book way: a handful of outlined bricks here and there.
    a.strokeStyle = shade(f.wall, -0.09);
    a.lineWidth = 1.2 * u;
    const bw = 14 * u, bh = 5 * u;
    for (let i = 0; i < 70; i++) {
      const cx = rng.range(0, W), cy = rng.range(0, H), rowsN = rng.int(2, 4);
      for (let r = 0; r < rowsN; r++) {
        const n = rng.int(1, 3), off = (r % 2) * bw * 0.5;
        for (let k = 0; k < n; k++) a.strokeRect(cx + off + k * bw, cy + r * bh, bw, bh);
      }
    }
    a.fillStyle = wallDark;
    for (let y = 0; y < H; y += rh) a.fillRect(0, y + rh - 2 * u, W, u);
  }
  if (f.kit === 'stone') {
    // Ashlar joints: two courses per floor, staggered.
    a.fillStyle = shade(f.wall, -0.07);
    for (let y = 0, r = 0; y < H; y += rh / 2, r++) {
      a.fillRect(0, y, W, u);
      for (let x = (r % 2) * cw * 0.25; x < W; x += cw * 0.5) a.fillRect(x, y, u, rh / 2);
    }
  }
  if (f.kit === 'concrete') {
    a.fillStyle = shade(f.wall, -0.07);
    for (let x = 0; x < W; x += cw) a.fillRect(x, 0, u, H);
  }
  if (f.kit === 'warehouse') {
    for (let x = 0; x < W; x += 6 * u) { a.fillStyle = (x / u) % 12 ? shade(f.wall, 0.025) : shade(f.wall, -0.04); a.fillRect(x, 0, 3 * u, H); }
  }
  if (f.kit === 'steel') {
    a.strokeStyle = shade(f.wall, -0.08);
    a.lineWidth = 3 * u;
    for (let y = 0; y < H; y += 64 * u) for (let x = 0; x < W; x += 128 * u) a.strokeRect(x + 2 * u, y + 2 * u, 124 * u, 60 * u);
    a.fillStyle = shade(f.wall, 0.06);
    for (let y = 0; y < H; y += 64 * u) for (let x = 0; x < W; x += 128 * u) for (const [dx, dy] of [[8, 8], [120, 8], [8, 56], [120, 56]]) a.fillRect(x + dx * u, y + dy * u, 2 * u, 2 * u);
  }
  // Long stains from gutters and downpipes.
  for (let i = 0; i < 10; i++) streak(a, rng.range(0, W), rng.range(0, H * 0.8), rng.range(4, 18) * u, rng.range(H * 0.1, H * 0.4), rng.range(0.05, 0.12));

  // ---- deco: pilasters and dark spandrels make vertical ribbons of windows ----
  if (f.kit === 'deco') {
    for (let k = 0; k <= f.cols; k++) {
      const x = k * cw;
      a.fillStyle = wallLight;
      a.fillRect(x - cw * 0.08, 0, cw * 0.16, H);
      a.fillStyle = `${INK}0.35)`;
      a.fillRect(x + cw * 0.08, 0, 2 * u, H);
      if (k < f.cols) {
        a.fillStyle = shade(f.wall, -0.1);
        a.fillRect(x + (cw - ww) / 2, 0, ww, H);
      }
    }
  }
  // Stone: a belt course every fourth floor.
  if (f.kit === 'stone') {
    for (let r = 0; r < f.rows; r += 4) {
      const y = r * rh;
      a.fillStyle = hex(f.sill);
      a.fillRect(0, y, W, 7 * u);
      a.fillStyle = `${INK}0.4)`;
      a.fillRect(0, y + 7 * u, W, 3 * u);
    }
  }
  // Concrete: ribbon windows run the full width of each floor.
  if (f.kit === 'concrete') {
    for (let r = 0; r < f.rows; r++) {
      const y = r * rh + (rh - wh) / 2;
      a.fillStyle = hex(f.frame);
      a.fillRect(0, y - 4 * u, W, wh + 8 * u);
    }
  }
  // Warehouse: a faded painted sign high on the wall (about 10-11.5 m up).
  if (f.kit === 'warehouse') {
    const y0 = H * (1 - 11.6 / 54.4), y1 = H * (1 - 9.8 / 54.4);
    a.save();
    a.font = `bold ${Math.round((y1 - y0) * 0.9)}px "Barlow Condensed", Impact, sans-serif`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    a.globalAlpha = 0.3;
    a.fillStyle = hex(PALETTE.paper);
    a.fillText('HARBOR STORAGE CO.', W / 2, (y0 + y1) / 2);
    a.restore();
  }

  // ---- windows ----
  for (let r = 0; r < f.rows; r++) {
    if (f.sparse && r % 4 !== 1) continue;
    if (f.kit === 'steel') continue;
    for (let k = 0; k < f.cols; k++) {
      const x = k * cw + (cw - ww) / 2, y = r * rh + (rh - wh) / 2;
      const fw = 3 * u;
      const lit = rng.chance(f.lit);
      // Frame and outer reveal.
      if (f.kit !== 'concrete') {
        a.fillStyle = hex(f.frame);
        windowPath(a, x - fw, y - fw, ww + 2 * fw, wh + 2 * fw, f.arch);
        a.fill();
      }
      for (const g of [a, e]) { g.save(); windowPath(g, x, y, ww, wh, f.arch); g.clip(); }
      paintGlass(a, e, rng, x, y, ww, wh, u, lit);
      mullions(a, e, f, x, y, ww, wh, u);
      // Inner reveal: the recess throws a hard shadow from the top and left.
      for (const g of [a, e]) {
        g.fillStyle = `${INK}0.55)`;
        g.fillRect(x, y, ww, wh * 0.12);
        g.fillStyle = `${INK}0.3)`;
        g.fillRect(x, y, ww * 0.07, wh);
        g.restore();
      }
      if (f.kit === 'concrete') continue;
      // Sill with its shadow, then the rain stain under it.
      const sy = y + wh + fw;
      a.fillStyle = hex(f.sill);
      a.fillRect(x - 5 * u, sy, ww + 10 * u, 5 * u);
      a.fillStyle = `${INK}0.5)`;
      a.fillRect(x - 5 * u, sy + 5 * u, ww + 10 * u, 2.5 * u);
      if (rng.chance(0.5)) streak(a, x + ww * rng.range(0.1, 0.5), sy + 7 * u, ww * rng.range(0.2, 0.5), rh * rng.range(0.25, 0.6), rng.range(0.08, 0.2));
      // Heads: arches get voussoirs and a keystone, brick gets a stone lintel.
      if (f.arch) {
        const cx = x + ww / 2, cy = y + ww / 2, r0 = ww / 2 + fw, r1 = r0 + 7 * u;
        a.fillStyle = hex(f.sill);
        a.beginPath(); a.arc(cx, cy, r1, Math.PI, 0); a.arc(cx, cy, r0, 0, Math.PI, true); a.closePath(); a.fill();
        a.strokeStyle = `${INK}0.45)`;
        a.lineWidth = u;
        for (let t = 1; t < 7; t++) {
          const ang = Math.PI + (t / 7) * Math.PI;
          a.beginPath(); a.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0); a.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1); a.stroke();
        }
        a.fillStyle = shade(f.sill, 0.05);
        a.fillRect(cx - 5 * u, cy - r1 - 2 * u, 10 * u, 11 * u);
        a.fillStyle = `${INK}0.4)`;
        a.fillRect(cx + 5 * u, cy - r1 - 2 * u, 2 * u, 11 * u);
      } else if (f.kit === 'brick') {
        a.fillStyle = hex(f.sill);
        a.fillRect(x - 5 * u, y - fw - 8 * u, ww + 10 * u, 8 * u);
        a.fillRect(x + ww / 2 - 5 * u, y - fw - 10 * u, 10 * u, 11 * u);
        a.fillStyle = `${INK}0.4)`;
        a.fillRect(x - 5 * u, y - fw, ww + 10 * u, 2 * u);
      } else if (f.kit === 'deco' && r % 2 === 0) {
        // Chevron ornament in the spandrel above.
        a.strokeStyle = hex(f.sill);
        a.lineWidth = 2 * u;
        const top = y - (rh - wh) / 2 + 4 * u;
        a.beginPath();
        for (let t = 0; t <= 4; t++) a.lineTo(x + (ww * t) / 4, top + (t % 2 ? 8 * u : 0));
        a.stroke();
      }
    }
  }
  // Concrete spandrels: a slab edge under each ribbon.
  if (f.kit === 'concrete') {
    for (let r = 0; r < f.rows; r++) {
      const y = r * rh + (rh + wh) / 2 + 4 * u;
      a.fillStyle = shade(f.wall, 0.06);
      a.fillRect(0, y, W, 4 * u);
      a.fillStyle = `${INK}0.45)`;
      a.fillRect(0, y + 4 * u, W, 3 * u);
      for (let i = 0; i < 6; i++) streak(a, rng.range(0, W), y + 7 * u, rng.range(10, 60) * u, rh * rng.range(0.2, 0.5), rng.range(0.06, 0.14));
    }
  }
  return { map: tex(ca), emissive: tex(ce) };
}

const SHOP_NAMES = ['DELI', 'BOOKS', 'DRUGS', 'HARDWARE', 'LAUNDRY', 'BAKERY', 'FLOWERS', 'RADIO', 'TAILOR', 'SHOES', 'DINER', 'GROCERY', 'BARBER', 'PAWN'];
export const STOREFRONT = { meters: 39, height: 4.2, shops: 6, rows: 2 };

// Two strips of six shops each (the top half of the texture is row 0). Returns each shop's awning
// color and whether it is open, so the builder can add real awnings and window reflections.
export function storefrontTextures(rng) {
  const W = 2048, H = 256, u = 2, R = STOREFRONT.rows;
  const [ca, a] = canvas(W, H * R);
  const [ce, e] = canvas(W, H * R);
  a.fillStyle = '#26272d';
  a.fillRect(0, 0, W, H * R);
  e.fillStyle = '#000';
  e.fillRect(0, 0, W, H * R);
  const shops = STOREFRONT.shops, sw = W / shops;
  const awnings = [PALETTE.balloon, PALETTE.containerBlue, PALETTE.containerGreen, PALETTE.jokerPurple, PALETTE.rust, 0x2f5a5a];
  const names = [...SHOP_NAMES].sort(() => rng.next() - 0.5);
  const info = [];
  for (let s = 0; s < shops * R; s++) {
    if (s % shops === 0) {
      if (s) { a.restore(); e.restore(); }
      a.save(); e.save();
      a.translate(0, (s / shops) * H); e.translate(0, (s / shops) * H);
    }
    const x = (s % shops) * sw;
    const open = rng.chance(0.72);
    const glowCol = rng.pick([PALETTE.window, PALETTE.window, 0xd9b36a, PALETTE.windowCool]);
    const glow = hex(glowCol);
    const winX = x + 20 * u, winW = sw - 70 * u, winY = 50 * u, winH = 60 * u;
    // Piers between shops.
    a.fillStyle = '#34302e';
    a.fillRect(x, 0, 10 * u, H);
    a.fillStyle = `${INK}0.5)`;
    a.fillRect(x + 10 * u, 0, 2 * u, H);
    if (open) {
      for (const [g, al] of [[a, 1], [e, 0.5]]) {
        const grad = g.createLinearGradient(0, winY, 0, winY + winH);
        grad.addColorStop(0, shade(glowCol, 0.04));
        grad.addColorStop(0.6, glow);
        grad.addColorStop(1, shade(glowCol, -0.25));
        g.globalAlpha = al;
        g.fillStyle = grad;
        g.fillRect(winX, winY, winW, winH);
        g.globalAlpha = 1;
      }
      // Shelves, goods and the odd customer, in ink.
      const goods = Array.from({ length: 9 }, () => [rng.range(0, winW - 16 * u), rng.int(0, 1), rng.range(4, 10) * u, rng.range(8, 12) * u]);
      const px = rng.chance(0.55) ? winX + rng.range(20, winW / u - 20) * u : null;
      for (const [g, em] of [[a, false], [e, true]]) {
        g.fillStyle = em ? 'rgba(0,0,0,0.7)' : `${INK}0.6)`;
        for (let k = 0; k < 2; k++) g.fillRect(winX + 4 * u, winY + 24 * u + k * 20 * u, winW - 8 * u, 3 * u);
        for (const [gx, row, gw, gh] of goods) g.fillRect(winX + 6 * u + gx, winY + 12 * u + row * 20 * u, gw, gh);
        g.fillStyle = em ? '#000' : hex(PALETTE.ink);
        g.fillRect(winX, winY + winH - 10 * u, winW, 10 * u);
        if (px !== null) {
          g.beginPath(); g.arc(px, winY + 22 * u, 6 * u, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.moveTo(px - 10 * u, winY + winH); g.quadraticCurveTo(px - 9 * u, winY + 30 * u, px, winY + 29 * u); g.quadraticCurveTo(px + 9 * u, winY + 30 * u, px + 10 * u, winY + winH); g.fill();
        }
      }
    } else {
      // Roller shutter, sometimes tagged.
      a.fillStyle = '#3a3d44';
      a.fillRect(winX, winY, winW, winH);
      a.fillStyle = '#2a2d33';
      for (let y = winY + 2 * u; y < winY + winH; y += 5 * u) a.fillRect(winX, y, winW, 2 * u);
      if (rng.chance(0.5)) {
        a.save();
        a.globalAlpha = 0.7;
        a.font = `${22 * u}px Bangers, Impact, sans-serif`;
        a.textAlign = 'center'; a.textBaseline = 'middle';
        a.fillStyle = hex(rng.pick([PALETTE.jokerGreen, PALETTE.jokerPurple, PALETTE.paper]));
        a.fillText(rng.pick(['HA HA', 'J', 'NO', 'X']), winX + winW / 2 + rng.range(-40, 40), winY + winH / 2);
        a.restore();
      }
    }
    // Mullions and frame.
    a.fillStyle = '#15161b';
    e.fillStyle = '#000';
    a.fillRect(winX - 4 * u, winY - 4 * u, winW + 8 * u, 4 * u);
    a.fillRect(winX - 4 * u, winY + winH, winW + 8 * u, 6 * u);
    a.fillRect(winX - 4 * u, winY, 4 * u, winH);
    for (let k = 1; k <= 3; k++) { a.fillRect(winX - u + (k * winW) / 3, winY, 3 * u, winH); e.fillRect(winX - u + (k * winW) / 3, winY, 3 * u, winH); }
    // Door with a lit transom.
    const dx = x + sw - 44 * u;
    a.fillStyle = '#121419';
    a.fillRect(dx, winY - 6 * u, 30 * u, H - winY + 6 * u);
    if (open) {
      for (const [g, al] of [[a, 1], [e, 0.55]]) { g.globalAlpha = al; g.fillStyle = shade(glowCol, -0.1); g.fillRect(dx + 4 * u, winY - 2 * u, 22 * u, 8 * u); g.fillRect(dx + 4 * u, winY + 10 * u, 22 * u, 36 * u); g.globalAlpha = 1; }
    }
    // Sign board with a painted valance (the real awning is geometry above it).
    const aw = awnings[(s + rng.int(0, 5)) % awnings.length];
    for (let k = 0; k < sw; k += 14 * u) { a.fillStyle = (k / (14 * u)) % 2 ? hex(aw) : shade(aw, 0.1); a.fillRect(x + k, 28 * u, 14 * u, 14 * u); }
    a.fillStyle = hex(PALETTE.ink);
    a.fillRect(x, 42 * u, sw, 3 * u);
    a.fillStyle = '#1b1c22';
    a.fillRect(x + 6 * u, 3 * u, sw - 12 * u, 22 * u);
    a.fillStyle = `${INK}0.6)`;
    a.fillRect(x + 6 * u, 25 * u, sw - 12 * u, 3 * u);
    a.font = `${18 * u}px "Barlow Condensed", sans-serif`;
    a.textAlign = 'center';
    a.textBaseline = 'middle';
    const name = names[s % names.length];
    a.fillStyle = open ? hex(PALETTE.paper) : '#6a6d74';
    a.fillText(name, x + sw / 2, 14 * u);
    if (open) { e.font = a.font; e.textAlign = 'center'; e.textBaseline = 'middle'; e.fillStyle = hex(PALETTE.paper); e.globalAlpha = 0.7; e.fillText(name, x + sw / 2, 14 * u); e.globalAlpha = 1; }
    // Grime at the foot of the wall.
    const foot = a.createLinearGradient(0, H - 20 * u, 0, H);
    foot.addColorStop(0, `${INK}0)`);
    foot.addColorStop(1, `${INK}0.5)`);
    a.fillStyle = foot;
    a.fillRect(x, H - 20 * u, sw, 20 * u);
    info.push({ awning: aw, open, glow: glowCol });
  }
  a.restore(); e.restore();
  return { map: tex(ca), emissive: tex(ce), shops: info };
}

// ---- ground and roofs: clean shapes, very little noise ----

// Wet asphalt: dark, with repair patches, tar-sealed cracks and a few oil sheens.
export function asphaltTexture(rng) {
  const S = 1024;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(PALETTE.asphalt);
  g.fillRect(0, 0, S, S);
  // Big soft tonal variation.
  for (let i = 0; i < 14; i++) {
    const x = rng.range(0, S), y = rng.range(0, S), r = rng.range(80, 260);
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    const k = rng.chance(0.5) ? '255,255,255' : '0,0,0';
    grad.addColorStop(0, `rgba(${k},0.035)`);
    grad.addColorStop(1, `rgba(${k},0)`);
    g.fillStyle = grad;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { g.save(); g.translate(ox, oy); g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore(); }
  }
  // Repair patches.
  for (let i = 0; i < 5; i++) {
    const w = rng.range(60, 220), h = rng.range(40, 160), x = rng.range(0, S - w), y = rng.range(0, S - h);
    g.fillStyle = shade(PALETTE.asphalt, rng.chance(0.5) ? -0.025 : 0.02);
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(8,8,12,0.35)';
    g.lineWidth = 2;
    g.strokeRect(x, y, w, h);
  }
  // Cracks sealed with tar: wandering ink lines.
  g.strokeStyle = 'rgba(8,8,12,0.55)';
  g.lineCap = 'round';
  for (let i = 0; i < 16; i++) {
    let x = rng.range(0, S), y = rng.range(0, S), a = rng.range(0, Math.PI * 2);
    g.lineWidth = rng.range(1.5, 3);
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0, n = rng.int(4, 10); k < n; k++) {
      a += rng.range(-0.8, 0.8);
      x += Math.cos(a) * rng.range(10, 30); y += Math.sin(a) * rng.range(10, 30);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  // Sparse aggregate, low contrast.
  for (let i = 0; i < 1500; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
    g.fillRect(rng.range(0, S), rng.range(0, S), 2, 2);
  }
  return tex(c);
}

// Tar-and-gravel roof: rolled membrane with lapped seams, a few patches and drains.
export function roofTexture(rng) {
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(PALETTE.roof);
  g.fillRect(0, 0, S, S);
  const roll = S / 6;
  for (let k = 0; k < 6; k++) {
    g.fillStyle = shade(PALETTE.roof, rng.range(-0.02, 0.02));
    g.fillRect(0, k * roll + 3, S, roll - 3);
    g.fillStyle = 'rgba(8,8,12,0.45)';
    g.fillRect(0, k * roll, S, 2);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, k * roll + 2, S, 2);
  }
  for (let i = 0; i < 6; i++) {
    const w = rng.range(30, 110), h = rng.range(20, 70), x = rng.range(0, S - w), y = rng.range(0, S - h);
    g.fillStyle = shade(PALETTE.roof, -0.04);
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(8,8,12,0.4)';
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, h);
  }
  // Standing water: flat dark shapes with a paper-white highlight sliver.
  for (let i = 0; i < 3; i++) {
    const x = rng.range(40, S - 40), y = rng.range(40, S - 40), rx = rng.range(18, 50), ry = rng.range(8, 22);
    g.fillStyle = '#1b2230';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(239,230,207,0.35)';
    g.beginPath(); g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.12, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 700; i++) {
    g.fillStyle = rng.chance(0.5) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.07)';
    g.fillRect(rng.range(0, S), rng.range(0, S), 2, 2);
  }
  return tex(c);
}

// Sidewalk slabs with dark joints and the odd stain.
export function sidewalkTexture(rng) {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = hex(PALETTE.sidewalk);
  g.fillRect(0, 0, S, S);
  const slab = S / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = shade(PALETTE.sidewalk, rng.range(-0.025, 0.02));
    g.fillRect(x * slab + 2, y * slab + 2, slab - 3, slab - 3);
  }
  g.fillStyle = 'rgba(11,11,18,0.5)';
  for (let i = 0; i <= 4; i++) { g.fillRect(i * slab - 1, 0, 2, S); g.fillRect(0, i * slab - 1, S, 2); }
  for (let i = 0; i < 4; i++) {
    const x = rng.range(10, S - 10), y = rng.range(10, S - 10), r = rng.range(6, 18);
    g.fillStyle = 'rgba(11,11,18,0.12)';
    g.beginPath(); g.ellipse(x, y, r, r * 0.7, rng.range(0, 3), 0, Math.PI * 2); g.fill();
  }
  return tex(c);
}

// Weathered planks: dark gaps, a little tone change per board, nail heads.
export function woodTexture(rng) {
  const S = 256, n = 8, bh = S / n;
  const [c, g] = canvas(S, S);
  for (let k = 0; k < n; k++) {
    g.fillStyle = shade(0x4f3e31, rng.range(-0.03, 0.02));
    g.fillRect(0, k * bh, S, bh);
    g.fillStyle = 'rgba(11,11,18,0.6)';
    g.fillRect(0, k * bh, S, 2);
    const joint = rng.range(20, S - 20);
    g.fillRect(joint, k * bh, 2, bh);
    g.fillStyle = 'rgba(11,11,18,0.45)';
    for (const x of [joint - 6, joint + 6]) { g.fillRect(x, k * bh + 6, 2, 2); g.fillRect(x, k * bh + bh - 8, 2, 2); }
  }
  return tex(c);
}

// Industrial yard slab: dark concrete, expansion joints, oil and chemical stains, safety paint.
export function yardTexture(rng) {
  const S = 512;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#34373d';
  g.fillRect(0, 0, S, S);
  const slab = S / 4;
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    g.fillStyle = shade(0x34373d, rng.range(-0.02, 0.015));
    g.fillRect(x * slab + 2, y * slab + 2, slab - 3, slab - 3);
  }
  g.fillStyle = 'rgba(11,11,18,0.55)';
  for (let i = 0; i <= 4; i++) { g.fillRect(i * slab - 1, 0, 2, S); g.fillRect(0, i * slab - 1, S, 2); }
  const blot = (x, y, r, color) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(0.7, color.replace(/[\d.]+\)$/, (m) => `${parseFloat(m) * 0.6})`));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(x, y, r, r * rng.range(0.5, 0.9), rng.range(0, 3), 0, Math.PI * 2); g.fill();
  };
  for (let i = 0; i < 9; i++) blot(rng.range(0, S), rng.range(0, S), rng.range(14, 50), 'rgba(8,8,12,0.4)');
  for (let i = 0; i < 4; i++) blot(rng.range(0, S), rng.range(0, S), rng.range(10, 34), 'rgba(98,193,65,0.22)');
  return tex(c);
}

// Flat puddle decals: dark water with hard paper-white highlight slivers (spec: "puddle highlights
// as flat white shapes"). Four variants in a 2x2 atlas.
export function puddleTexture(rng) {
  const S = 512, h = S / 2;
  const [c, g] = canvas(S, S);
  g.clearRect(0, 0, S, S);
  for (let v = 0; v < 4; v++) {
    const ox = (v % 2) * h, oy = Math.floor(v / 2) * h, cx = ox + h / 2, cy = oy + h / 2;
    g.fillStyle = 'rgba(14,20,32,0.92)';
    g.beginPath();
    const n = 14;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, r = h * 0.36 * (0.7 + rng.range(0, 0.3)) * (0.9 + 0.3 * Math.cos(a * 2 + v));
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.62]);
    }
    pts.forEach(([x, y], k) => {
      const [nx, ny] = pts[(k + 1) % n];
      if (k === 0) g.moveTo((x + nx) / 2, (y + ny) / 2);
      else g.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2);
    });
    g.quadraticCurveTo(pts[0][0], pts[0][1], (pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2);
    g.fill();
    g.fillStyle = 'rgba(239,230,207,0.7)';
    for (let k = 0; k < 3; k++) {
      const x = cx + rng.range(-h * 0.18, h * 0.12), y = cy + rng.range(-h * 0.12, h * 0.1), w = rng.range(h * 0.06, h * 0.2);
      g.beginPath(); g.ellipse(x, y, w, w * 0.1, -0.12, 0, Math.PI * 2); g.fill();
    }
  }
  const t = tex(c, { repeat: false });
  return t;
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
