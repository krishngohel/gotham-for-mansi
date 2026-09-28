// Relief on the facades: belt courses, corner piers, deco crowns, window air conditioners, small
// balconies and real storefront awnings. Window-aligned pieces read the same grid the facade
// texture was painted with, so they sit on the painted sills. All of it is merged through buckets.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { box } from './buckets.js';
import { FACADE_METERS, FLOOR_METERS } from './materials.js';
import { FACADE_GRID, STOREFRONT } from './textures.js';

const FLOOR = FLOOR_METERS / 16;

// The four walls of a w x d footprint and how texture u runs along each (BoxGeometry face UVs).
function walls(x, z, w, d, inset = 0) {
  const hw = w / 2 + inset, hd = d / 2 + inset;
  return [
    { nx: 1, nz: 0, span: d, at: (t) => [x + hw, z + d / 2 - t * d] },
    { nx: -1, nz: 0, span: d, at: (t) => [x - hw, z - d / 2 + t * d] },
    { nx: 0, nz: 1, span: w, at: (t) => [x - w / 2 + t * w, z + hd] },
    { nx: 0, nz: -1, span: w, at: (t) => [x + w / 2 - t * w, z - hd] },
  ];
}

// Positions along a wall where the texture's u lands on n + frac, keeping `margin` from the corners.
function slots(wall, uOffset, metersPerU, frac, margin) {
  const out = [];
  const u0 = uOffset, u1 = uOffset + wall.span / metersPerU;
  for (let n = Math.floor(u0) - 1; n <= Math.ceil(u1); n++) {
    const t = ((n + frac - uOffset) * metersPerU) / wall.span;
    if (t * wall.span > margin && (1 - t) * wall.span > margin) out.push(t);
  }
  return out;
}

// A box in wall space (along, up, out) placed against a wall at parameter t.
function onWall(wall, t, along, up, out, y, outOffset) {
  const [px, pz] = wall.at(t);
  const g = new THREE.BoxGeometry(along, up, out);
  g.rotateY(Math.atan2(wall.nx, wall.nz));
  return g.translate(px + wall.nx * outOffset, y, pz + wall.nz * outOffset);
}

function ringAt(ctx, key, x, z, w, d, y, hgt, over, color) {
  const t = over + 0.25;
  ctx.buckets.add(key, box(w + 2 * over, hgt, t, x, y, z - d / 2 - over + t / 2), color);
  ctx.buckets.add(key, box(w + 2 * over, hgt, t, x, y, z + d / 2 + over - t / 2), color);
  ctx.buckets.add(key, box(t, hgt, d, x - w / 2 - over + t / 2, y, z), color);
  ctx.buckets.add(key, box(t, hgt, d, x + w / 2 + over - t / 2, y, z), color);
}

const shadeHex = (n, k) => new THREE.Color().setHex(n, THREE.LinearSRGBColorSpace).offsetHSL(0, 0, k).getHex(THREE.LinearSRGBColorSpace);

export function facadeRelief(ctx, b, uOffset) {
  const { x, z, w, d, h, style } = b;
  const rng = ctx.rng;
  const grid = FACADE_GRID[style];
  // Belt courses where the stone texture paints them (every fourth floor), so relief and paint agree.
  if (style === 'stone' || (style === 'brick' && rng.chance(0.6))) {
    for (const y of [4 * FLOOR, 8 * FLOOR, 12 * FLOOR]) {
      if (y < h - 3 && y > 6) ringAt(ctx, 'trim', x, z, w, d, y - 0.1, 0.32, 0.18);
    }
  }
  // Corner piers: stone and deco get strong vertical edges that catch the ink line.
  if ((style === 'stone' || style === 'deco') && h > 12) {
    const key = style === 'stone' ? 'trim' : 'painted';
    const color = style === 'deco' ? shadeHex(PALETTE.deco, 0.06) : null;
    const y0 = b.storefront ? 4.7 : 0, y1 = h - (b.cornice ? 0.6 : 0.1);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      ctx.buckets.add(key, box(1.1, y1 - y0, 1.1, x + sx * (w / 2 - 0.37), (y0 + y1) / 2, z + sz * (d / 2 - 0.37)), color);
    }
  }
  if (!grid || !['brick', 'stone', 'concrete'].includes(style)) return;
  // Window units: air conditioners (most), small iron balconies (stone and brick).
  const su = FACADE_METERS[style];
  const winH = FLOOR * grid.win[1];
  for (const wall of walls(x, z, w, d)) {
    for (let k = 0; k < grid.cols; k++) {
      for (const t of slots(wall, uOffset, su, (k + 0.5) / grid.cols, 1.6)) {
        for (let r = 0; r < 16; r++) {
          const yc = FLOOR * r + FLOOR / 2;
          if (yc < 6.5 || yc > h - 2.5) continue;
          const sill = yc - winH / 2 - (style === 'concrete' ? 0.2 : 0.25);
          const roll = rng.next();
          if (roll < 0.045) {
            ctx.buckets.add('painted', onWall(wall, t, 0.78, 0.5, 0.6, sill + 0.28, 0.3), 0x565c66);
            ctx.buckets.add('painted', onWall(wall, t, 0.62, 0.34, 0.04, sill + 0.28, 0.61), 0x23262d);
          } else if (roll < 0.058 && style !== 'concrete') {
            const bw = su / grid.cols * 0.8;
            ctx.buckets.add('steel', onWall(wall, t, bw, 0.12, 0.85, sill - 0.06, 0.42));
            ctx.buckets.add('steel', onWall(wall, t, bw, 0.9, 0.05, sill + 0.45, 0.84));
            ctx.buckets.add('steel', onWall(wall, t, bw, 0.05, 0.85, sill + 0.9, 0.42));
          }
        }
      }
    }
  }
}

// Art deco crown: stepped pylons on the corners of the top roof, lit from below.
export function decoCrown(ctx, x, z, w, d, y, solidFn) {
  const s = Math.min(w, d);
  const p = Math.max(1.3, s * 0.06);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const px = x + sx * (w / 2 - p / 2), pz = z + sz * (d / 2 - p / 2);
    solidFn(ctx, 'painted', box(p, 2.6, p, px, y + 1.3, pz), { color: shadeHex(PALETTE.deco, 0.05) });
    ctx.buckets.add('painted', box(p * 0.64, 1.4, p * 0.64, px, y + 3.3, pz), shadeHex(PALETTE.deco, 0.1));
    ctx.buckets.add('painted', new THREE.ConeGeometry(p * 0.22, 1.6, 4).rotateY(Math.PI / 4).translate(px, y + 4.8, pz), PALETTE.trim);
  }
}

// Real awnings over the storefront shops, colored like the painted valances in the texture.
export function awnings(ctx, x, z, w, d, uOffset, shops) {
  const su = STOREFRONT.meters, n = STOREFRONT.shops;
  const width = su / n - 1.2;
  const slope = 0.42, depth = 1.35;
  for (const wall of walls(x, z, w + 0.3, d + 0.3)) {
    for (let s = 0; s < n; s++) {
      const color = shops[s].awning;
      for (const t of slots(wall, uOffset, su, (s + 0.5) / n, width / 2 + 0.6)) {
        const [px, pz] = wall.at(t);
        // Lit shop windows spill onto the wet sidewalk and street.
        if (shops[s].open) ctx.reflect.push({ x: px + wall.nx * 0.4, y: 0.16, z: pz + wall.nz * 0.4, h: 1.6, color: shops[s].glow, w: 1.3, len: 5, k: 0.14 });
        if (!ctx.rng.chance(0.75)) continue;
        const rot = Math.atan2(wall.nx, wall.nz);
        const top = 3.55;
        const g = new THREE.BoxGeometry(width, 0.07, depth / Math.cos(slope)).rotateX(slope)
          .translate(0, top - Math.tan(slope) * depth / 2, depth / 2).rotateY(rot).translate(px, 0, pz);
        ctx.buckets.add('painted', g, color);
        const front = top - Math.tan(slope) * depth;
        const val = new THREE.BoxGeometry(width, 0.34, 0.05).translate(0, front - 0.15, depth).rotateY(rot).translate(px, 0, pz);
        ctx.buckets.add('painted', val, shadeHex(color, 0.08));
        // Two thin iron arms.
        for (const a of [-1, 1]) {
          const arm = new THREE.BoxGeometry(0.04, 0.04, depth).rotateX(slope * 0.4)
            .translate(a * (width / 2 - 0.2), front + 0.1, depth / 2).rotateY(rot).translate(px, 0, pz);
          ctx.buckets.add('steel', arm);
        }
      }
    }
  }
}
