import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE, hex } from '../config/palette.js';
import { toonMaterial } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

const ROOF_UV = [0.5, 0.97];

function windowTexture(rng, litChance = 0.2) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#10141d';
  g.fillRect(0, 0, 256, 512);
  const cols = 8, rows = 16, cw = 256 / cols, rh = 480 / rows;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      const lit = rng.chance(litChance);
      g.globalAlpha = lit ? rng.range(0.55, 1) : 1;
      g.fillStyle = lit ? hex(rng.chance(0.7) ? PALETTE.window : PALETTE.windowCool) : '#1b2230';
      g.fillRect(k * cw + 8, 32 + r * rh + 8, cw - 16, rh - 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function tower(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      if (f === 2 || f === 3) { uv.setXY(i, ...ROOF_UV); continue; }
      const span = f < 2 ? d : w;
      uv.setXY(i, uv.getX(i) * span / 11, uv.getY(i) * h / 17);
    }
  }
  return g;
}

function flatUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, ...ROOF_UV);
  return g;
}

export function createSkyline(rng, { count = 190, minDist = 40, maxDist = 230, backdrop = false } = {}) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const a = rng.range(0, Math.PI * 2);
    // As a backdrop, buildings to the south stand on the far shore across the bay.
    const dist = backdrop && Math.sin(a) > 0.25 ? rng.range(720, 950) : rng.range(minDist, maxDist);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    const scale = backdrop ? 2.2 : 1;
    const w = rng.range(7, 18) * scale, d = rng.range(7, 18) * scale;
    // Mostly at or below the roof so the sky stays open; a few landmark towers.
    const top = backdrop
      ? (rng.chance(0.12) ? rng.range(70, 140) : rng.range(15, 70))
      : rng.chance(0.08) ? rng.range(35, 75) : rng.range(-26, dist < 80 ? 8 : 22);
    const h = top + 40;
    geos.push(tower(w, h, d).translate(x, top - h / 2, z));
    if (rng.chance(0.3)) {
      const h2 = rng.range(6, 18);
      geos.push(tower(w * 0.6, h2, d * 0.6).translate(x, top + h2 / 2, z));
      if (rng.chance(0.5)) geos.push(flatUV(new THREE.ConeGeometry(w * 0.35, 10, 4)).rotateY(Math.PI / 4).translate(x, top + h2 + 5, z));
    }
  }
  const tex = windowTexture(rng);
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    toonMaterial({ color: 0x2a3446, map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.9 }),
  );
  mesh.receiveShadow = false;
  return mesh;
}

// ---------------- the backdrop: layered silhouettes, like a painted noir background ----------------
// Each ring of towers is a flat tone that gets lighter with distance, with fewer and dimmer lit
// windows, and a band of low mist sits between the rings. A lit suspension bridge crosses the bay.

const layerVertex = /* glsl */ `
attribute float aLit;
attribute vec3 aColor;
attribute vec3 aMist;
varying vec2 vUv;
varying float vSide;
varying float vY;
varying float vLit;
varying vec3 vColor;
varying vec3 vMist;
void main() {
  vUv = uv;
  vLit = aLit;
  vColor = aColor;
  vMist = aMist;
  vSide = abs(normal.x) > 0.5 ? 1.0 : 0.0;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vY = w.y;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const layerFragment = /* glsl */ `
uniform vec3 uInk;
uniform float uFlash;
uniform sampler2D tWin;
varying vec2 vUv;
varying float vSide;
varying float vY;
varying float vLit;
varying vec3 vColor;
varying vec3 vMist;
void main() {
  vec3 t = texture2D(tWin, vUv).rgb;
  float lit = step(0.3, max(t.r, t.b)) * vLit;
  vec3 col = vColor * (1.0 - 0.12 * vSide);
  col = mix(col, t, lit);
  // Ground mist swallows the feet of every tower.
  col = mix(col, vMist, (1.0 - smoothstep(-5.0, 35.0, vY)) * 0.8);
  // Lightning: the whole skyline drops to a flat ink silhouette against the white sky.
  col = mix(col, uInk, uFlash);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;
const mistVertex = /* glsl */ `
attribute vec4 aTint; // rgb, alpha
varying float vV;
varying vec4 vTint;
void main() { vV = uv.y; vTint = aTint; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const mistFragment = /* glsl */ `
uniform float uFlash;
varying float vV;
varying vec4 vTint;
void main() {
  float a = pow(1.0 - vV, 1.8) * vTint.a * (1.0 - uFlash);
  gl_FragColor = vec4(vTint.rgb, a);
  #include <colorspace_fragment>
}
`;

const FLASH = { value: 0 };
const INK = { value: new THREE.Color(PALETTE.ink) };

function towerLayer(rng, tex, { count, minDist, maxDist, color, lit, mist, sector = null, tall = 0.12, scale = 2.2, low = [18, 70], high = [80, 150] }) {
  const geos = [];
  const beacons = [];
  for (let i = 0; i < count; i++) {
    let a = rng.range(0, Math.PI * 2);
    if (sector) a = rng.range(sector[0], sector[1]);
    else if (Math.sin(a) > 0.25) a = -a; // keep the bay open to the south
    const dist = rng.range(minDist, maxDist);
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    const w = rng.range(7, 18) * scale, d = rng.range(7, 18) * scale;
    const isTall = rng.chance(tall);
    const first = geos.length;
    // Only some towers are awake: lit windows cluster instead of dusting every wall.
    const awake = rng.chance(isTall ? 0.75 : 0.35) ? 1 : 0;
    const top = isTall ? rng.range(high[0], high[1]) : rng.range(low[0], low[1]);
    const h = top + 40;
    geos.push(tower(w, h, d).translate(x, top - h / 2, z));
    let peak = top;
    if (rng.chance(isTall ? 0.8 : 0.3)) {
      const h2 = rng.range(6, 18);
      geos.push(tower(w * 0.6, h2, d * 0.6).translate(x, top + h2 / 2, z));
      peak = top + h2;
      if (rng.chance(0.4)) { geos.push(tower(w * 0.35, h2 * 0.6, d * 0.35).translate(x, peak + h2 * 0.3, z)); peak += h2 * 0.6; }
      if (rng.chance(0.5)) { geos.push(flatUV(new THREE.ConeGeometry(w * 0.2, 14, 4)).rotateY(Math.PI / 4).translate(x, peak + 7, z)); peak += 14; }
    } else if (rng.chance(0.35)) {
      // Water tower on a low roof.
      geos.push(flatUV(new THREE.CylinderGeometry(3, 3, 5, 8)).translate(x + w * 0.2, top + 4.5, z));
      geos.push(flatUV(new THREE.ConeGeometry(3.3, 2.5, 8)).translate(x + w * 0.2, top + 8.2, z));
    }
    if (isTall) beacons.push([x, peak + 1, z]);
    for (let k = first; k < geos.length; k++) geos[k].setAttribute('aLit', new THREE.BufferAttribute(new Float32Array(geos[k].attributes.position.count).fill(awake * lit), 1));
  }
  const geo = mergeGeometries(geos);
  const n = geo.attributes.position.count;
  const c = new THREE.Color(color), m = new THREE.Color(mist);
  const col = new Float32Array(n * 3), mis = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col.set([c.r, c.g, c.b], i * 3); mis.set([m.r, m.g, m.b], i * 3); }
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aMist', new THREE.BufferAttribute(mis, 3));
  return { geo, beacons };
}

// All four rings of towers share one material and one draw call.
function towerLayers(rng, tex, layers) {
  const geos = [], beacons = [];
  for (const L of layers) { const r = towerLayer(rng, tex, L); geos.push(r.geo); beacons.push(...r.beacons); }
  const uniforms = { tWin: { value: tex }, uFlash: FLASH, uInk: INK };
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.ShaderMaterial({ uniforms, vertexShader: layerVertex, fragmentShader: layerFragment }));
  mesh.matrixAutoUpdate = false;
  return { mesh, beacons };
}

// Bands of low mist between the rings of towers, merged into one draw call.
function mistRings(rings) {
  const geos = rings.map(([radius, height, color, alpha]) => {
    const g = new THREE.CylinderGeometry(radius, radius, height, 72, 1, true).translate(0, height / 2 - 4, 0);
    const c = new THREE.Color(color);
    const tint = new Float32Array(g.attributes.position.count * 4);
    for (let i = 0; i < g.attributes.position.count; i++) tint.set([c.r, c.g, c.b, alpha], i * 4);
    g.setAttribute('aTint', new THREE.BufferAttribute(tint, 4));
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.ShaderMaterial({
    uniforms: { uFlash: FLASH },
    vertexShader: mistVertex, fragmentShader: mistFragment,
    transparent: true, depthWrite: false, side: THREE.BackSide,
  }));
  mesh.renderOrder = 1;
  mesh.matrixAutoUpdate = false;
  return mesh;
}

// A suspension bridge across the bay: deck, two gothic towers, cables and a string of lamps.
function bridge(color) {
  const z = 620, y = 34, span = 1400;
  const geos = [];
  geos.push(tower(span, 5, 16).translate(0, y, z));
  for (const x of [-230, 230]) {
    for (const s of [-1, 1]) geos.push(tower(9, 150, 9).translate(x, 75 - 20, z + s * 9));
    geos.push(tower(9, 8, 26).translate(x, y + 40, z));
    geos.push(tower(9, 10, 26).translate(x, y + 95, z));
    for (const s of [-1, 1]) geos.push(flatUV(new THREE.ConeGeometry(5, 18, 4)).rotateY(Math.PI / 4).translate(x, 139, z + s * 9));
  }
  const mesh = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshBasicMaterial({ color, fog: false }));
  mesh.matrixAutoUpdate = false;
  // Main cables: catenaries between the towers and down to the far anchorages, drawn as ink lines.
  const pts = [];
  const cable = (x0, y0, x1, y1, sag) => {
    let prev = null;
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const p = [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t - sag * 4 * t * (1 - t), z];
      if (prev) pts.push(...prev, ...p);
      prev = p;
    }
  };
  cable(-230, 128, 230, 128, 88);
  cable(-230, 128, -700, y + 3, -8);
  cable(230, 128, 700, y + 3, -8);
  for (let x = -220; x <= 220; x += 20) {
    const t = (x + 230) / 460;
    pts.push(x, y + 2, z, x, 128 - 88 * 4 * t * (1 - t), z);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color, fog: false }));
  const lamps = [];
  for (let x = -680; x <= 680; x += 28) lamps.push([x, y + 4, z - 8]);
  for (const x of [-230, 230]) lamps.push([x, 150, z]);
  return { mesh, lines, lamps };
}

export function createBackdrop(rng) {
  const group = new THREE.Group();
  const tex = windowTexture(rng, 0.14);
  const mist = PALETTE.fog;
  const layers = [
    { count: 120, minDist: 340, maxDist: 430, color: 0x192233, lit: 0.8, mist, tall: 0.1, low: [10, 50], high: [60, 105] },
    { count: 110, minDist: 470, maxDist: 590, color: 0x202a3e, lit: 0.55, mist: 0x243048, tall: 0.12 },
    { count: 100, minDist: 640, maxDist: 780, color: 0x283349, lit: 0.3, mist: 0x2b3650, tall: 0.1 },
    // The far shore, across the bay to the south.
    { count: 90, minDist: 820, maxDist: 980, color: 0x2e3a50, lit: 0.25, mist: 0x303b52, tall: 0.1, sector: [0.35, Math.PI - 0.35] },
  ];
  const { mesh: towers, beacons } = towerLayers(rng, tex, layers);
  group.add(towers);
  group.add(mistRings([[450, 70, PALETTE.fog, 0.75], [610, 90, 0x243048, 0.7], [800, 110, 0x2b3650, 0.65]]));
  const br = bridge(0x1c2638);
  group.add(br.mesh, br.lines);
  // Too far for ink lines anyway: keep the backdrop out of the normal pass.
  group.traverse((o) => o.layers.set(LAYER_FX));
  const bridgeColor = new THREE.Color(0x1c2638);
  group.userData = {
    beacons,
    bridgeLamps: br.lamps,
    setFlash(k) {
      FLASH.value = k;
      br.mesh.material.color.copy(bridgeColor).lerp(INK.value, k);
      br.lines.material.color.copy(br.mesh.material.color);
    },
  };
  return group;
}
