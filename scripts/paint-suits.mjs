// Paints the comic suit textures for the hero bodies: public/assets/tex/bat_m.webp and bat_f.webp.
//
// Every texel of the body's UV layout gets the bind-pose position, normal and tangent frame of the
// surface under it (dilated past the island edges), and the paint is a pure function of that 3D
// point: region colours, ink contours where regions meet, hand-authored anatomy lines, the chest
// emblem, the belt and cross-hatching away from the key light. Because nothing is drawn in UV
// space, lines run across seams unbroken. Deterministic; run by hand like build-assets:
//   node scripts/paint-suits.mjs [--preview <dir>] [--size 1024] [--only m|f]
// --preview renders the painted bodies front/back/side to PNGs for look development.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import * as THREE from 'three';
import sharp from 'sharp';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { measureBody } from '../src/actors/rig.js';
import { classifySuitVertex, SUIT_COLORS } from '../src/actors/outfits.js';
import { PALETTE } from '../src/config/palette.js';
import { batOutline } from '../src/config/batShape.js';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const SIZE = Number(opt('--size', 1024));
const PREVIEW = opt('--preview', null);
const ONLY = opt('--only', null);
const OUT = 'public/assets/tex';
const IN = process.env.ASSETS_DIR ?? 'public/assets';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// ---------------------------------------------------------------- geometry

async function loadBody(key) {
  const doc = await io.read(path.join(IN, `hero_${key}.glb`));
  const root = doc.getRoot();
  const prim = (name) => root.listNodes().find((n) => n.getMesh() && (name ? n.getName() === name : !['Eyes', 'Eyebrows'].includes(n.getName()))).getMesh().listPrimitives()[0];
  const toGeo = (p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(p.getAttribute('POSITION').getArray()), 3));
    const uv = p.getAttribute('TEXCOORD_0');
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv.getArray()), 2));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(p.getIndices().getArray()), 1));
    g.computeVertexNormals();
    return g;
  };
  const skin = root.listSkins()[0];
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  // Enough of a SkinnedMesh for rig.js: bone names, inverse bind matrices, identity bind matrix.
  const body = {
    geometry: toGeo(prim()),
    bindMatrixInverse: new THREE.Matrix4(),
    skeleton: { bones: joints.map((j) => ({ name: j.getName() })), boneInverses: joints.map((_, i) => new THREE.Matrix4().fromArray(ibm.getElement(i, []))) },
  };
  const lm = measureBody(body, { geometry: toGeo(prim('Eyes')) });
  const bone = (n) => new THREE.Vector3().setFromMatrixPosition(body.skeleton.boneInverses[joints.findIndex((j) => j.getName() === n)].clone().invert());
  return { body, lm, bone };
}

// Rasterizes the mesh into UV space. For each texel: position, normal, the tangent step per texel
// (dP/du, dP/dv in metres) and the texel's size in metres. Texels no triangle covers are filled
// from the nearest covered one (dilation), so bilinear filtering and mipmaps never pull in a seam.
function rasterize(geometry, S, dilate = 10) {
  const N = S * S;
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal, uv = geometry.attributes.uv, idx = geometry.index;
  const P = new Float32Array(N * 3), Nn = new Float32Array(N * 3), Tu = new Float32Array(N * 3), Tv = new Float32Array(N * 3);
  const score = new Float32Array(N).fill(-Infinity);
  const covered = new Uint8Array(N);
  const A = [0, 0, 0], B = [0, 0, 0], C = [0, 0, 0];
  for (let t = 0; t < idx.count; t += 3) {
    const ia = idx.getX(t), ib = idx.getX(t + 1), ic = idx.getX(t + 2);
    const ax = uv.getX(ia) * S, ay = uv.getY(ia) * S, bx = uv.getX(ib) * S, by = uv.getY(ib) * S, cx = uv.getX(ic) * S, cy = uv.getY(ic) * S;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-6) continue;
    const sgn = Math.sign(area);
    // Tangent frame: d(position)/d(texel) from the affine UV -> 3D map of this triangle.
    for (let k = 0; k < 3; k++) { A[k] = pos.getComponent(ia, k); B[k] = pos.getComponent(ib, k); C[k] = pos.getComponent(ic, k); }
    const du = [0, 0, 0], dv = [0, 0, 0];
    for (let k = 0; k < 3; k++) {
      const e1 = B[k] - A[k], e2 = C[k] - A[k];
      du[k] = (e1 * (cy - ay) - e2 * (by - ay)) / area;
      dv[k] = (e2 * (bx - ax) - e1 * (cx - ax)) / area;
    }
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)) - 1), x1 = Math.min(S - 1, Math.ceil(Math.max(ax, bx, cx)) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)) - 1), y1 = Math.min(S - 1, Math.ceil(Math.max(ay, by, cy)) + 1);
    const l0 = Math.hypot(cx - bx, cy - by), l1 = Math.hypot(ax - cx, ay - cy), l2 = Math.hypot(bx - ax, by - ay);
    for (let y = y0; y <= y1; y++) {
      const py = y + 0.5;
      for (let x = x0; x <= x1; x++) {
        const px = x + 0.5;
        // Edge distances in texels (positive inside); accept up to 0.75 texels outside so islands
        // are drawn conservatively and no texel along an edge stays empty.
        let w0 = sgn * ((cx - bx) * (py - by) - (cy - by) * (px - bx)) / l0;
        let w1 = sgn * ((ax - cx) * (py - cy) - (ay - cy) * (px - cx)) / l1;
        let w2 = sgn * ((bx - ax) * (py - ay) - (by - ay) * (px - ax)) / l2;
        const m = Math.min(w0, w1, w2);
        if (m < -0.75) continue;
        const i = y * S + x;
        if (m <= score[i]) continue;
        score[i] = m;
        covered[i] = 1;
        // Barycentrics from the clamped edge distances, so texels just outside interpolate sanely.
        let b0 = Math.max(0, w0) * l0, b1 = Math.max(0, w1) * l1, b2 = Math.max(0, w2) * l2;
        const sum = b0 + b1 + b2 || 1;
        b0 /= sum; b1 /= sum; b2 /= sum;
        for (let k = 0; k < 3; k++) {
          P[i * 3 + k] = b0 * A[k] + b1 * B[k] + b2 * C[k];
          Nn[i * 3 + k] = b0 * nrm.getComponent(ia, k) + b1 * nrm.getComponent(ib, k) + b2 * nrm.getComponent(ic, k);
          Tu[i * 3 + k] = du[k]; Tv[i * 3 + k] = dv[k];
        }
      }
    }
  }
  // Dilation: unfilled texels copy their nearest filled neighbour, ring by ring.
  const src = new Int32Array(N).fill(-1);
  for (let i = 0; i < N; i++) if (covered[i]) src[i] = i;
  let frontier = [];
  for (let i = 0; i < N; i++) if (covered[i]) frontier.push(i);
  for (let ring = 0; ring < dilate && frontier.length; ring++) {
    const next = [];
    for (const i of frontier) {
      const x = i % S, y = (i / S) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= S || ny >= S) continue;
        const j = ny * S + nx;
        if (src[j] >= 0) continue;
        src[j] = src[i];
        next.push(j);
      }
    }
    frontier = next;
  }
  for (let i = 0; i < N; i++) {
    const s = src[i];
    if (s < 0 || s === i) continue;
    for (let k = 0; k < 3; k++) { P[i * 3 + k] = P[s * 3 + k]; Nn[i * 3 + k] = Nn[s * 3 + k]; Tu[i * 3 + k] = Tu[s * 3 + k]; Tv[i * 3 + k] = Tv[s * 3 + k]; }
  }
  return { P, N: Nn, Tu, Tv, filled: src };
}

// ---------------------------------------------------------------- 2D strokes

// Catmull-Rom through [x, y, width] control points -> dense polyline.
function curve(pts, segs = 8) {
  const out = [];
  const get = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < segs; s++) {
      const t = s / segs, t2 = t * t, t3 = t2 * t;
      const pt = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        pt[k] = 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      }
      out.push(pt);
    }
  }
  out.push([...pts[pts.length - 1]]);
  return out;
}

// Signed distance from q to a stroked polyline (negative inside the stroke).
function strokeDist(qx, qy, line) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay, aw] = line[i], [bx, by, bw] = line[i + 1];
    const ex = bx - ax, ey = by - ay;
    const ll = ex * ex + ey * ey || 1e-12;
    const t = Math.max(0, Math.min(1, ((qx - ax) * ex + (qy - ay) * ey) / ll));
    const d = Math.hypot(qx - ax - ex * t, qy - ay - ey * t) - (aw + (bw - aw) * t) * 0.5;
    if (d < best) best = d;
  }
  return best;
}

// A stroke lives on one face of the body. proj picks the drawing plane, face the normal window.
//   proj 'xy': drawn in the frontal plane; face > 0 needs n.z*fwd >= face, face < 0 the back.
//   proj 'zy': drawn on a side; sideSign picks the side by n.x.
//   kind 'ink' fills the stroke with ink, 'light' with the suit highlight, 'hatch' with hatch lines.
function makeStroke({ pts, proj = 'xy', face = 0.1, side = 0, mirror = true, region = 'suit', bbox = null, kind = 'ink' }) {
  const line = curve(pts);
  const xs = line.map((p) => p[0]), ys = line.map((p) => p[1]);
  const pad = Math.max(...line.map((p) => p[2])) + 0.004;
  const box = bbox ?? [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad];
  return { line, proj, face, side, mirror, region, box, kind };
}

function polygonDist(qx, qy, poly) {
  // Signed distance to a closed polygon (negative inside).
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > qy) !== (yj > qy) && qx < ((xj - xi) * (qy - yi)) / (yj - yi) + xi) inside = !inside;
    const ex = xj - xi, ey = yj - yi;
    const t = Math.max(0, Math.min(1, ((qx - xi) * ex + (qy - yi) * ey) / (ex * ex + ey * ey)));
    best = Math.min(best, Math.hypot(qx - xi - ex * t, qy - yi - ey * t));
  }
  return inside ? -best : best;
}

// ---------------------------------------------------------------- the paint

const rgb = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const fract = (v) => v - Math.floor(v);

// Anatomy strokes in body space (metres, T-pose) built from the landmarks. Points are
// [x, y, width]; strokes start thick and taper.
function anatomy(key, lm, bone) {
  const S = [];
  const f = key === 'f';
  // Batwoman's suit is near-black, so her anatomy is drawn in a lighter highlight like the reference.
  const add = (o) => S.push(makeStroke({ kind: f ? 'light' : 'ink', ...o }));
  const hatch = (o) => S.push(makeStroke({ kind: 'hatch', ...o }));
  const cy = lm.chestY, by = lm.beltY, ny = lm.neckY;
  const sx = lm.shoulderX, ex = lm.elbowX;
  const armY = bone('upperarm_l').y;
  const thighX = Math.abs(bone('thigh_l').x), ky = lm.kneeY, hipY = bone('pelvis').y;
  const W = f ? 0.007 : 0.009, w = f ? 0.0042 : 0.0052, t = 0.0016;

  // --- torso, front
  if (!f) {
    // pec undersides, sweeping from the sternum out and up to the armpit
    add({ pts: [[0.018, cy - 0.075, W], [0.07, cy - 0.095, W], [0.13, cy - 0.08, w], [0.175, cy - 0.045, t]], face: 0.05 });
    // sternum below the emblem and the linea alba
    add({ pts: [[0, cy - 0.072, W], [0, cy - 0.14, w], [0, by + 0.065, t]], face: 0.2, mirror: false });
    // ab rows
    for (const [dy, len] of [[0.16, 0.06], [0.225, 0.062], [0.29, 0.058]]) {
      add({ pts: [[0.012, cy - dy, w], [len * 0.55, cy - dy - 0.004, w * 0.8], [len, cy - dy - 0.014, t]], face: 0.25 });
    }
    // serratus / oblique ticks under the pec
    add({ pts: [[0.135, cy - 0.125, w * 0.8], [0.17, cy - 0.145, t]], face: 0.0 });
    add({ pts: [[0.125, cy - 0.16, w * 0.8], [0.16, cy - 0.18, t]], face: 0.0 });
    // hatched shadow under each pec and down the obliques
    hatch({ pts: [[0.03, cy - 0.103, 0.018], [0.09, cy - 0.118, 0.026], [0.15, cy - 0.095, 0.012]], face: 0.05 });
    hatch({ pts: [[0.165, cy - 0.11, 0.028], [0.155, cy - 0.2, 0.024], [0.135, by + 0.07, 0.014]], face: -0.35 });
  } else {
    // bust: curves under each breast and the cleavage line
    add({ pts: [[0.02, cy - 0.055, w], [0.065, cy - 0.075, W], [0.11, cy - 0.06, w], [0.135, cy - 0.03, t]], face: 0.05 });
    add({ pts: [[0, cy + 0.02, w * 0.8], [0, cy - 0.03, t]], face: 0.3, mirror: false });
    add({ pts: [[0, cy - 0.11, w], [0, by + 0.06, t]], face: 0.2, mirror: false });
    add({ pts: [[0.012, cy - 0.2, w * 0.8], [0.045, cy - 0.212, t]], face: 0.25 });
    hatch({ pts: [[0.03, cy - 0.088, 0.016], [0.075, cy - 0.102, 0.022], [0.125, cy - 0.078, 0.01]], face: 0.05 });
    hatch({ pts: [[0.13, cy - 0.09, 0.024], [0.12, cy - 0.18, 0.02], [0.105, by + 0.07, 0.012]], face: -0.35 });
  }
  // lat / oblique sweep down the side of the torso (wraps from front to side)
  add({ pts: [[f ? 0.13 : 0.17, cy - 0.03, w], [f ? 0.12 : 0.155, cy - 0.15, w], [f ? 0.1 : 0.12, by + 0.06, t]], face: -0.35 });

  // --- torso, back
  // trapezius V and the spine furrow
  add({ pts: [[0.06, ny - 0.005, w], [0.025, ny - 0.07, w * 0.8], [0, cy + 0.01, t]], face: -0.1 });
  add({ pts: [[0, cy - 0.02, W], [0, cy - 0.2, w], [0, by + 0.07, t]], face: -0.2, mirror: false });
  // shoulder blades
  add({ pts: [[0.045, cy + 0.06, w], [0.085, cy + 0.01, w], [0.11, cy - 0.06, t]], face: -0.15 });
  // lats
  add({ pts: [[0.16, cy - 0.01, w], [0.13, cy - 0.12, w * 0.8], [0.075, by + 0.06, t]], face: -0.1 });
  // glutes: the cleft and the fold under each
  add({ pts: [[0, by - 0.075, w], [0, hipY - 0.12, t]], face: -0.2, mirror: false });
  add({ pts: [[0.03, hipY - 0.13, w], [0.085, hipY - 0.145, w], [0.14, hipY - 0.11, t]], face: -0.15 });
  hatch({ pts: [[0.03, hipY - 0.158, 0.018], [0.085, hipY - 0.172, 0.024], [0.14, hipY - 0.135, 0.01]], face: -0.15 });

  // --- arms (T-pose: along x). Deltoid cap and the bicep on the front, tricep on the back.
  add({ pts: [[sx - 0.01, armY - 0.055, w], [sx + 0.045, armY - 0.07, w], [sx + 0.1, armY - 0.035, w * 0.7], [sx + 0.11, armY + 0.02, t]], face: 0.0 });
  add({ pts: [[sx + 0.12, armY - 0.045, w], [sx + 0.19, armY - 0.05, w * 0.8], [ex - 0.03, armY - 0.03, t]], face: 0.2 });
  add({ pts: [[sx + 0.11, armY + 0.03, w * 0.8], [sx + 0.2, armY + 0.035, t]], face: 0.2 });
  add({ pts: [[sx + 0.05, armY + 0.01, w], [sx + 0.13, armY - 0.02, w * 0.8], [ex - 0.04, armY - 0.01, t]], face: -0.2 });
  add({ pts: [[sx + 0.02, armY - 0.05, w], [sx + 0.07, armY - 0.06, t]], face: -0.1 });

  // --- legs, front: quad separation, knee
  add({ pts: [[thighX + 0.045, hipY - 0.1, w], [thighX + 0.02, ky + 0.18, w], [thighX - 0.005, ky + 0.06, t]], face: 0.15 });
  add({ pts: [[thighX - 0.04, hipY - 0.09, w], [thighX - 0.055, hipY - 0.2, t]], face: 0.1 });
  hatch({ pts: [[thighX - 0.055, hipY - 0.1, 0.018], [thighX - 0.065, hipY - 0.24, 0.016], [thighX - 0.05, ky + 0.12, 0.008]], face: 0.1 });
  add({ pts: [[thighX - 0.03, ky + 0.035, w * 0.8], [thighX, ky + 0.02, w * 0.8], [thighX + 0.03, ky + 0.035, t]], face: 0.2 });
  add({ pts: [[thighX - 0.025, ky - 0.015, t], [thighX, ky - 0.025, w * 0.7], [thighX + 0.025, ky - 0.015, t]], face: 0.2 });
  // legs, back: hamstring line and the calf
  add({ pts: [[thighX + 0.01, hipY - 0.17, w], [thighX + 0.005, ky + 0.2, w * 0.8], [thighX - 0.01, ky + 0.07, t]], face: -0.15 });
  add({ pts: [[thighX - 0.045, hipY - 0.12, w * 0.8], [thighX - 0.05, hipY - 0.22, t]], face: -0.1 });
  add({ pts: [[thighX + 0.01, ky - 0.03, w], [thighX + 0.03, ky - 0.09, w * 0.8], [thighX + 0.015, ky - 0.14, t]], face: -0.15 });
  // outer thigh (side)
  add({ pts: [[-0.02, hipY - 0.06, w], [0.005, hipY - 0.2, w * 0.8], [0.0, ky + 0.09, t]], proj: 'zy', side: 1, face: 0.4 });
  return S;
}

function makePainter(key, lm, bone) {
  const colors = SUIT_COLORS[key];
  const f = key === 'f';
  const C = {
    // Batman's grey is lifted a little in the paint only: under the game's night lighting the flat
    // suit colour reads near-black, and the reference is a medium grey.
    suit: f ? rgb(colors.suit) : mix(rgb(colors.suit), [255, 255, 255], 0.14), cowl: rgb(colors.cowl), skin: rgb(colors.skin), belt: rgb(colors.belt),
    glove: rgb(colors.glove), boot: rgb(colors.boot), emblem: rgb(colors.emblem), ink: rgb(PALETTE.ink),
  };
  const fwd = lm.fwd;
  const strokes = anatomy(key, lm, bone);
  // The face stays flat skin: one short, thin mouth line is the only mark on it.
  const mouthY = lm.eyeY - (f ? 0.072 : 0.078);
  strokes.push(makeStroke({ pts: [[-0.015, mouthY + 0.0015, 0.001], [-0.006, mouthY, 0.0018], [0.006, mouthY, 0.0018], [0.015, mouthY + 0.0015, 0.001]], face: 0.4, mirror: false, region: 'skin' }));

  // Emblem: the batOutline polygon at the size and place of the old flat mesh (a touch larger,
  // since paint follows the curve of the chest).
  // Batwoman's sits on the upper chest above the bust, under a shallower cowl V so the head and
  // upper wings are not cut off.
  const emScale = f ? 0.0026 : 0.0031;
  const emblemY = lm.chestY + (f ? 0.06 : 0);
  const emblem = batOutline().map(([x, y]) => [x * emScale, emblemY + y * emScale]);
  const emblemBox = [-0.2, 0.2, emblemY - 0.09, emblemY + 0.1];
  const chestBack = lm.chestFrontZ - 0.1;

  // Belt: the gold band at the belt height, the buckle in front and pouch backings where the 3D
  // pouches sit (same angles as createBat).
  const hipZ = bone('pelvis').z;
  const pouchR = lm.hipHalfWidth * 0.78;
  const pouchAngles = [];
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; if (!(Math.abs(Math.cos(a)) > 0.9 && Math.cos(a) * fwd > 0)) pouchAngles.push(a); }

  // Cowl edge: a V down the chest in front, a shallower V behind, the head above.
  const cowlLine = (x, z) => {
    const front = (z - lm.headCenter.z) * fwd;
    const ax = Math.abs(x);
    if (front > 0) return f ? lm.neckY - 0.005 + ax * 0.6 : lm.neckY - 0.045 + ax * 0.75;
    return lm.neckY - 0.015 + ax * 0.5;
  };
  // Face: the lower face below the nose, framed by the cowl, whose edge is one smooth curve
  // dipping under the nose and rising over the cheeks.
  const faceEdge = (x) => { const t = clamp01((Math.abs(x) - 0.004) / 0.046); return lm.eyeY - (f ? 0.052 : 0.058) + 0.022 * t * t * (3 - 2 * t); };

  function classify(p, n) {
    const ax = Math.abs(p.x);
    if (p.y > lm.neckY - 0.06 && ax < 0.16) {
      if (p.y > cowlLine(p.x, p.z)) {
        const front = (p.z - lm.headCenter.z) * fwd;
        const face = p.y < faceEdge(p.x) && p.y > lm.eyeY - 0.135 && ax < 0.08 && front > lm.headRadius * 0.08 && n.z * fwd > -0.1;
        return face ? 'skin' : 'cowl';
      }
    }
    const base = classifySuitVertex(p, lm);
    if (base === 'cowl' || base === 'skin') return 'suit';
    if (base === 'belt') {
      if (n.z * fwd > 0.35 && ax < 0.037 && Math.abs(p.y - lm.beltY) < 0.027) return 'buckle';
      const ang = Math.atan2(p.x, (p.z - hipZ) / 0.72);
      for (const a of pouchAngles) {
        let d = ang - a; d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) * pouchR < 0.028 && Math.abs(p.y - (lm.beltY - 0.005)) < 0.036) return 'pouch';
      }
      return 'belt';
    }
    if (base === 'suit' && n.z * fwd > 0.05 && p.z * fwd > chestBack && ax < 0.2 && p.y > emblemBox[2] && p.y < emblemBox[3]) {
      if (polygonDist(p.x, p.y, emblem) < 0) return 'emblem';
    }
    return base;
  }

  const baseColor = { suit: C.suit, cowl: C.cowl, skin: C.skin, belt: C.belt, glove: C.glove, boot: C.boot, emblem: C.emblem, buckle: shade(C.belt, 1.08), pouch: shade(C.belt, 0.92) };
  // Regions whose meeting gets an ink contour.
  const inkEdge = (a, b) => a !== b && !(a === 'emblem' && !f) && !((a === 'buckle' || a === 'pouch') && (b === 'buckle' || b === 'pouch'));

  const hatchDir1 = new THREE.Vector3(0.62, 0.72, 0.32 * fwd).normalize();
  const hatchDir2 = new THREE.Vector3(-0.55, 0.72, 0.42 * fwd).normalize();
  const light = mix(C.suit, [159, 178, 214], 0.32);
  const hatchPeriod = 0.014;
  const onHatch = (p, w) => Math.abs(fract(p.dot(hatchDir1) / hatchPeriod) - 0.5) * hatchPeriod < w * 0.5;

  const q = new THREE.Vector3();
  // paint(p, n, tu, tv, edgeW): colour of the surface point p with normal n. tu/tv are unit
  // tangents used to probe for region boundaries edgeW metres away.
  return function paint(p, n, tu, tv, edgeW) {
    const region = classify(p, n);
    const nz = n.z * fwd;
    // Ink contour where regions meet, probed in the tangent plane.
    for (const [dir, s] of [[tu, 1], [tu, -1], [tv, 1], [tv, -1]]) {
      q.set(p.x + dir.x * edgeW * s, p.y + dir.y * edgeW * s, p.z + dir.z * edgeW * s);
      const other = classify(q, n);
      if (other !== region && inkEdge(region, other) && inkEdge(other, region)) {
        // On the near-black suit the cowl's edge is a light seam, as in the reference.
        const cowlSeam = f && (region === 'cowl' || other === 'cowl') && (region === 'suit' || other === 'suit');
        return cowlSeam ? light : C.ink;
      }
    }
    // Hand-drawn anatomy.
    if (region === 'suit' || region === 'skin') {
      for (const s of strokes) {
        if (s.region !== region) continue;
        let qx, qy;
        if (s.proj === 'xy') {
          if (s.face >= 0 ? nz < s.face : nz > s.face) continue;
          qx = s.mirror ? Math.abs(p.x) : p.x; qy = p.y;
        } else {
          if (Math.abs(n.x) < s.face) continue;
          const sideSign = Math.sign(p.x) || 1;
          if (s.side && Math.sign(n.x) !== sideSign * s.side) continue;
          qx = (p.z - hipZ) * fwd; qy = p.y;
        }
        if (qx < s.box[0] || qx > s.box[1] || qy < s.box[2] || qy > s.box[3]) continue;
        if (strokeDist(qx, qy, s.line) < 0) {
          if (s.kind === 'ink') return C.ink;
          if (s.kind === 'light') return light;
          if (onHatch(p, 0.0024)) return C.ink;
        }
      }
    }
    let col = baseColor[region] ?? C.suit;
    if (region === 'suit') {
      // Comic key light: from above, a little from the character's left, and symmetric front to
      // back so each view gets its own shadow side. Hatching where the surface turns away.
      const lit = 0.8 * n.y + 0.5 * Math.abs(n.z) + 0.3 * n.x;
      const dark = clamp01((-0.02 - lit) / 0.4);
      if (dark > 0) {
        const w1 = 0.0016 + 0.0014 * dark;
        if (onHatch(p, w1)) return C.ink;
        if (dark > 0.7) {
          const d2 = Math.abs(fract(p.dot(hatchDir2) / hatchPeriod) - 0.5) * hatchPeriod;
          if (d2 < w1 * 0.4) return C.ink;
        }
      }
    }
    return col;
  };
}

// ---------------------------------------------------------------- main

async function paintBody(key) {
  const { body, lm, bone } = await loadBody(key);
  const t0 = Date.now();
  const G = rasterize(body.geometry, SIZE);
  const paint = makePainter(key, lm, bone);
  const img = Buffer.alloc(SIZE * SIZE * 3);
  const p = new THREE.Vector3(), n = new THREE.Vector3(), tu = new THREE.Vector3(), tv = new THREE.Vector3(), q = new THREE.Vector3();
  const edgeW = 0.0024;
  const bg = rgb(SUIT_COLORS[key].suit);
  // 2x2 supersampling in the tangent plane for clean edges.
  const offs = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]];
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (G.filled[i] < 0) { img[i * 3] = bg[0]; img[i * 3 + 1] = bg[1]; img[i * 3 + 2] = bg[2]; continue; }
    p.fromArray(G.P, i * 3); n.fromArray(G.N, i * 3).normalize(); tu.fromArray(G.Tu, i * 3); tv.fromArray(G.Tv, i * 3);
    const du = tu.clone(), dv = tv.clone();
    tu.normalize(); tv.normalize();
    let r = 0, g = 0, b = 0;
    for (const [ou, ov] of offs) {
      q.set(p.x + du.x * ou + dv.x * ov, p.y + du.y * ou + dv.y * ov, p.z + du.z * ou + dv.z * ov);
      const c = paint(q, n, tu, tv, edgeW);
      r += c[0]; g += c[1]; b += c[2];
    }
    img[i * 3] = r * 0.25; img[i * 3 + 1] = g * 0.25; img[i * 3 + 2] = b * 0.25;
  }
  await mkdir(OUT, { recursive: true });
  const file = path.join(OUT, `bat_${key}.webp`);
  await sharp(img, { raw: { width: SIZE, height: SIZE, channels: 3 } }).webp({ quality: 88 }).toFile(file);
  console.log(file, ((await stat(file)).size / 1024).toFixed(0), 'KB', ((Date.now() - t0) / 1000).toFixed(1), 's');
  if (PREVIEW) await preview(key, body.geometry, img, lm);
}

// Software preview: orthographic renders with toon bands and depth outlines, no game needed.
async function preview(key, geometry, tex, lm) {
  await mkdir(PREVIEW, { recursive: true });
  const H = 1100, Wd = 640;
  const pos = geometry.attributes.position, nrm = geometry.attributes.normal, uv = geometry.attributes.uv, idx = geometry.index;
  const views = { front: [0, 0], back: [Math.PI, 0], side: [Math.PI / 2, 0], threeq: [Math.PI / 4, 0], backq: [Math.PI * 0.75, 0] };
  const L = new THREE.Vector3(0.45, 0.75, 0.55).normalize();
  for (const [name, [yaw]] of Object.entries(views)) {
    const rot = new THREE.Matrix4().makeRotationY(yaw);
    const rgbBuf = Buffer.alloc(Wd * H * 3, 0xff);
    const depth = new Float32Array(Wd * H).fill(-Infinity);
    const scale = H / 1.95, ox = Wd / 2, oy = H - 20;
    const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const nn = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const Lv = L.clone().applyMatrix4(new THREE.Matrix4().makeRotationY(-yaw));
    for (let t = 0; t < idx.count; t += 3) {
      const ids = [idx.getX(t), idx.getX(t + 1), idx.getX(t + 2)];
      for (let k = 0; k < 3; k++) { v[k].fromBufferAttribute(pos, ids[k]).applyMatrix4(rot); nn[k].fromBufferAttribute(nrm, ids[k]); }
      const sx = v.map((p) => ox + p.x * scale), sy = v.map((p) => oy - p.y * scale);
      const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sy[1] - sy[0]) * (sx[2] - sx[0]);
      if (Math.abs(area) < 1e-6) continue;
      const x0 = Math.max(0, Math.floor(Math.min(...sx))), x1 = Math.min(Wd - 1, Math.ceil(Math.max(...sx)));
      const y0 = Math.max(0, Math.floor(Math.min(...sy))), y1 = Math.min(H - 1, Math.ceil(Math.max(...sy)));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        let w0 = ((sx[1] - px) * (sy[2] - py) - (sy[1] - py) * (sx[2] - px)) / area;
        let w1 = ((sx[2] - px) * (sy[0] - py) - (sy[2] - py) * (sx[0] - px)) / area;
        let w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * v[0].z + w1 * v[1].z + w2 * v[2].z;
        const i = y * Wd + x;
        if (z <= depth[i]) continue;
        depth[i] = z;
        const u = w0 * uv.getX(ids[0]) + w1 * uv.getX(ids[1]) + w2 * uv.getX(ids[2]);
        const vv = w0 * uv.getY(ids[0]) + w1 * uv.getY(ids[1]) + w2 * uv.getY(ids[2]);
        const tx = Math.min(SIZE - 1, Math.max(0, Math.round(u * SIZE - 0.5))), ty = Math.min(SIZE - 1, Math.max(0, Math.round(vv * SIZE - 0.5)));
        const ti = (ty * SIZE + tx) * 3;
        const nx = w0 * nn[0].x + w1 * nn[1].x + w2 * nn[2].x, ny = w0 * nn[0].y + w1 * nn[1].y + w2 * nn[2].y, nz = w0 * nn[0].z + w1 * nn[1].z + w2 * nn[2].z;
        const lit = (nx * Lv.x + ny * Lv.y + nz * Lv.z) / Math.hypot(nx, ny, nz);
        const band = lit > 0.35 ? 1 : lit > -0.05 ? 0.72 : 0.5;
        rgbBuf[i * 3] = tex[ti] * band; rgbBuf[i * 3 + 1] = tex[ti + 1] * band; rgbBuf[i * 3 + 2] = tex[ti + 2] * band;
      }
    }
    // Depth-edge ink.
    const out = Buffer.from(rgbBuf);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < Wd - 1; x++) {
      const i = y * Wd + x;
      const d = depth[i];
      let edge = false;
      for (const j of [i - 1, i + 1, i - Wd, i + Wd]) {
        const e = depth[j];
        if ((d === -Infinity) !== (e === -Infinity) || Math.abs(d - e) > 0.03) edge = true;
      }
      if (edge && d !== -Infinity) { out[i * 3] = 11; out[i * 3 + 1] = 11; out[i * 3 + 2] = 18; }
    }
    await sharp(out, { raw: { width: Wd, height: H, channels: 3 } }).png().toFile(path.join(PREVIEW, `${key}_${name}.png`));
  }
  await sharp(tex, { raw: { width: SIZE, height: SIZE, channels: 3 } }).png().toFile(path.join(PREVIEW, `${key}_tex.png`));
}

for (const key of ['m', 'f']) if (!ONLY || ONLY === key) await paintBody(key);
