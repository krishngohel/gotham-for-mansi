// Standalone pose viewer for code-authored clips. Loads the hero bodies and animation packs,
// builds the kick clips exactly as game.js does, and renders contact sheets (rows = views,
// columns = evenly spaced frames) into a 2D canvas that tools/kick-sheets.mjs saves as PNG.
// Renders only on demand (no animation loop) so it costs nothing while idle.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadAssets } from '../src/actors/assets.js';
import { createBat, createGoon } from '../src/actors/characters.js';
import { LAYER_FX } from '../src/render/layers.js';
import { buildClimbClips } from '../src/actors/climbAnims.js';
import { buildChainClips } from '../src/actors/chainAnims.js';
import { CHAIN_BEATS } from '../src/combat/chainTimeline.js';
import { buildStealthClips, STEALTH_BEATS, CHOKE_OFFSET } from '../src/actors/stealthAnims.js';
import { MOCAP_BEATS } from '../src/config/mocap.js';

const params = new URLSearchParams(location.search);
// ?kicks=<module path relative to this page> swaps in another kicks module (e.g. a copy of an
// older version) for before/after comparisons.
const kicksModule = params.get('kicks') || '../src/actors/kicks.js';
const { buildKickClips, KICK_BEATS: KEYED_BEATS = {} } = await import(/* @vite-ignore */ kicksModule);
// Contact frames: mocap clips override the code-authored ones; <name>_keyed keeps its own.
const KICK_BEATS = { ...KEYED_BEATS, ...MOCAP_BEATS, ...CHAIN_BEATS, ...STEALTH_BEATS, ...Object.fromEntries(Object.entries(KEYED_BEATS).map(([k, v]) => [k + '_keyed', v])) };

const CELL = { w: 190, h: 300 };
const gl = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(CELL.w, CELL.h, false);
renderer.setClearColor(0xdfe3ea, 1);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(2, 4, 3);
scene.add(sun);
const rim = new THREE.DirectionalLight(0xcfe0ff, 0.8);
rim.position.set(-3, 2, -2);
scene.add(rim);
// Floor: a dark line where the ground is, plus a faint grid for foot sliding checks.
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xc5cad4 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
scene.add(floor);
const grid = new THREE.GridHelper(4, 16, 0x9aa1ad, 0xb4bac6);
scene.add(grid);

const assets = await loadAssets('/assets/');
// Like game.js, mocap clips win; the code-authored version stays reachable as <name>_keyed.
for (const c of buildKickClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) {
  assets.clips.set(c.name + '_keyed', c);
  if (!assets.clips.has(c.name)) assets.clips.set(c.name, c);
}
for (const c of buildClimbClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
for (const c of buildChainClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
for (const c of buildStealthClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);

const bats = {};
// suit='goon' or suit='rifle' renders on a goon body (grunt, or a rifle goon with its rifle mesh)
// instead of a bat suit.
function bat(suit) {
  if (!bats[suit]) {
    const b = suit === 'goon' ? createGoon(assets, { type: 'grunt' })
      : suit === 'rifle' ? createGoon(assets, { type: 'rifle' })
      : createBat(assets, suit);
    bats[suit] = b;
  }
  return bats[suit];
}

const camera = new THREE.PerspectiveCamera(32, CELL.w / CELL.h, 0.1, 50);
// Worn gear (boots, gauntlets, goon clothes) and hull outlines render on LAYER_FX in the real
// game's multi-pass ink pipeline; this single-pass viewer needs it enabled directly, or a goon's
// clothed body is invisible below the neck (only the base body shows on the default layer).
camera.layers.enable(LAYER_FX);
const LOOK = new THREE.Vector3(0, 0.95, 0);
// Camera positions per view. The kicking leg is the right one (character's -X), so "side"
// looks from -X to keep it in front.
const VIEWS = {
  side: [-4.2, 1.15, 0],
  front: [0, 1.15, 4.2],
  quarter: [-3.0, 1.35, 3.0],
  back: [0, 1.4, -4.2],
  backq: [3.0, 1.35, -3.0],
  top: [0.001, 5.2, 0.001],
};

function setView(name) {
  const p = VIEWS[name];
  camera.position.set(p[0], p[1], p[2]);
  camera.lookAt(LOOK);
  camera.updateMatrixWorld(true);
}

// Step the character to time t of `clip` from a fresh start, with the game's own foot lift.
function pose(b, clip, t, { speed = 1 } = {}) {
  // Drop whatever played before so a zero-length fade can't blend it into the t=0 frame.
  b.animator.mixer.stopAllAction();
  b.animator.play(clip, { once: true, timeScale: speed, fade: 0 });
  const dur = t / speed;
  const steps = Math.max(1, Math.ceil(dur / (1 / 120)));
  for (let i = 0; i < steps; i++) b.animator.update(dur / steps);
  // One settled lift frame so the foot planting has converged.
  b.animator.update(0);
  b.root.updateMatrixWorld(true);
}

function label(ctx, x, y, text, color = '#223') {
  ctx.fillStyle = color;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(text, x + 6, y + 16);
}

// Contact sheet: rows of views, columns of frames. Returns a PNG data URL.
function sheet({ clip, suit = 'm', views = ['side', 'front', 'quarter'], frames = 9, speed = 1, from = 0, to = null, title = '' } = {}) {
  const b = bat(suit);
  scene.add(b.root);
  b.root.position.set(0, 0, 0);
  b.face(0);
  const c = assets.clips.get(clip);
  if (!c) throw new Error(`no clip ${clip}`);
  const end = to ?? c.duration;
  const out = document.getElementById('sheet');
  out.width = CELL.w * frames;
  out.height = CELL.h * views.length + 22;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#dfe3ea';
  ctx.fillRect(0, 0, out.width, out.height);
  label(ctx, 0, 0, `${title || clip}  suit=${suit}  dur=${c.duration.toFixed(2)}s  speed=${speed}  contact=${KICK_BEATS[clip]?.contact ?? '?'}`);
  const beats = KICK_BEATS[clip];
  for (let r = 0; r < views.length; r++) {
    setView(views[r]);
    for (let i = 0; i < frames; i++) {
      const t = from + (end - from) * (frames === 1 ? 0 : i / (frames - 1));
      pose(b, clip, Math.min(t, c.duration - 1e-4));
      renderer.render(scene, camera);
      const x = i * CELL.w, y = 22 + r * CELL.h;
      ctx.drawImage(gl, x, y);
      ctx.strokeStyle = '#b8bec8';
      ctx.strokeRect(x + 0.5, y + 0.5, CELL.w - 1, CELL.h - 1);
      const atContact = beats && Math.abs(t - beats.contact) <= (end - from) / (frames - 1) / 2;
      label(ctx, x, y, `${views[r]} t=${t.toFixed(2)}${atContact ? ' HIT' : ''}`, atContact ? '#c0202a' : '#223');
    }
  }
  scene.remove(b.root);
  return out.toDataURL('image/png');
}

// Two actors at once, placed the way gameplay places them for the silent takedown: the goon at
// the origin facing +Z, Batman `offset` behind it on the same yaw (createSilentTakedown's spot,
// src/stealth/takedowns.js Task 10). Rows = views, columns = evenly spaced frames of `batClip` and
// `goonClip` played together. Returns a PNG data URL.
function pairSheet({ batClip, goonClip, batSuit = 'm', goonSuit = 'goon', offset = CHOKE_OFFSET, views = ['side', 'quarter'], frames = 9, title = '' } = {}) {
  const goon = bat(goonSuit), batman = bat(batSuit);
  scene.add(goon.root, batman.root);
  goon.root.position.set(0, 0, 0);
  goon.face(0);
  batman.root.position.set(0, 0, -offset);
  batman.face(0);
  const bc = assets.clips.get(batClip), gc = assets.clips.get(goonClip);
  if (!bc) throw new Error(`no clip ${batClip}`);
  if (!gc) throw new Error(`no clip ${goonClip}`);
  const dur = Math.max(bc.duration, gc.duration);
  const out = document.getElementById('sheet');
  out.width = CELL.w * frames;
  out.height = CELL.h * views.length + 22;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#dfe3ea';
  ctx.fillRect(0, 0, out.width, out.height);
  label(ctx, 0, 0, `${title || `${batClip} + ${goonClip}`}  offset=${offset}m  dur=${dur.toFixed(2)}s`);
  for (let r = 0; r < views.length; r++) {
    setView(views[r]);
    for (let i = 0; i < frames; i++) {
      const t = dur * (frames === 1 ? 0 : i / (frames - 1));
      pose(batman, batClip, Math.min(t, bc.duration - 1e-4));
      pose(goon, goonClip, Math.min(t, gc.duration - 1e-4));
      renderer.render(scene, camera);
      const x = i * CELL.w, y = 22 + r * CELL.h;
      ctx.drawImage(gl, x, y);
      ctx.strokeStyle = '#b8bec8';
      ctx.strokeRect(x + 0.5, y + 0.5, CELL.w - 1, CELL.h - 1);
      label(ctx, x, y, `${views[r]} t=${t.toFixed(2)}`);
    }
  }
  scene.remove(goon.root, batman.root);
  return out.toDataURL('image/png');
}

// Numbers for the authoring loop: per frame, where the support foot balls, hips, head and the
// kicking foot are (root space, metres), plus knee angles, so drift and hyperextension can be
// checked without eyeballing.
function measure({ clip, suit = 'm', frames = 24 } = {}) {
  const b = bat(suit);
  scene.add(b.root);
  b.face(0);
  const c = assets.clips.get(clip);
  const rows = [];
  const v = new THREE.Vector3();
  const local = (name) => { b.bone(name).getWorldPosition(v); b.root.worldToLocal(v); return [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)]; };
  const angle = (a, bn, cn) => {
    const A = b.bone(a).getWorldPosition(new THREE.Vector3()), B = b.bone(bn).getWorldPosition(new THREE.Vector3()), C = b.bone(cn).getWorldPosition(new THREE.Vector3());
    return +THREE.MathUtils.radToDeg(A.sub(B).angleTo(C.sub(B))).toFixed(0);
  };
  for (let i = 0; i < frames; i++) {
    const t = c.duration * i / (frames - 1);
    pose(b, clip, Math.min(t, c.duration - 1e-4));
    rows.push({
      t: +t.toFixed(3), ballL: local('ball_l'), ballR: local('ball_r'), footL: local('foot_l'), footR: local('foot_r'), pelvis: local('pelvis'), head: local('Head'),
      handL: local('hand_l'), handR: local('hand_r'), kneeL: angle('thigh_l', 'calf_l', 'foot_l'), kneeR: angle('thigh_r', 'calf_r', 'foot_r'), lift: b.model.position.y + 1,
    });
  }
  scene.remove(b.root);
  return rows;
}

window.__viewer = { ready: true, sheet, pairSheet, measure, clips: [...assets.clips.keys()], beats: KICK_BEATS };
// Manual use: ?clip=Kick_Front&suit=m renders one sheet into the page.
if (params.get('clip')) sheet({ clip: params.get('clip'), suit: params.get('suit') ?? 'm' });
