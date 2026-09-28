// Live loop of a kick clip on the hero bodies with orbit controls, for judging motion by eye.
// Uses the game's own character setup (createBat, foot lift) and clip loading; the mocap pack
// wins over code-authored kicks exactly as in game.js, and the code-authored version stays
// available as <name>_keyed. Rendering is capped at 30 fps.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadAssets } from '../src/actors/assets.js';
import { createBat } from '../src/actors/characters.js';
import { buildKickClips, KICK_BEATS } from '../src/actors/kicks.js';
import { MOCAP_BEATS } from '../src/config/mocap.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0xdfe3ea, 1);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xffffff, 0x8890a0, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(2, 4, 3);
scene.add(sun);
const rim = new THREE.DirectionalLight(0xcfe0ff, 0.8);
rim.position.set(-3, 2, -2);
scene.add(rim);
scene.add(new THREE.GridHelper(6, 24, 0x9aa1ad, 0xb4bac6));
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.MeshBasicMaterial({ color: 0xc5cad4 }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
scene.add(floor);
// A target dummy at the kick's stop distance so reach and height read against something.
const dummy = new THREE.Group();
const dummyMat = new THREE.MeshToonMaterial({ color: 0x7a8aa8 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.9, 4, 12), dummyMat);
body.position.y = 1.0;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), dummyMat);
head.position.y = 1.62;
dummy.add(body, head);
dummy.position.set(0, 0, 1.35);
scene.add(dummy);

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
camera.position.set(-3.2, 1.6, 2.6);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.95, 0.4);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 10;
controls.update();

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const status = document.getElementById('status');
const assets = await loadAssets('/assets/');
for (const c of buildKickClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) {
  assets.clips.set(c.name + '_keyed', c);
  if (!assets.clips.has(c.name)) assets.clips.set(c.name, c);
}
const bats = { m: createBat(assets, 'm'), f: createBat(assets, 'f') };
for (const b of Object.values(bats)) { b.face(0); b.root.visible = false; scene.add(b.root); }

const state = { clip: params.get('clip') ?? 'Kick_Round', suit: params.get('suit') ?? 'm', speed: 1, paused: false };
const beatsOf = (name) => MOCAP_BEATS[name] ?? KICK_BEATS[name.replace(/_keyed$/, '')];

function apply() {
  for (const [k, b] of Object.entries(bats)) b.root.visible = k === state.suit;
  const b = bats[state.suit];
  const clip = assets.clips.get(state.clip);
  b.animator.mixer.stopAllAction();
  const action = b.animator.play(state.clip, { once: false, timeScale: state.speed, fade: 0 });
  action.paused = state.paused;
  const beats = beatsOf(state.clip);
  status.textContent = `${state.clip}  ${clip.duration.toFixed(2)} s  contact ${beats?.contact ?? '?'} s\n${clip.tracks.length} tracks  suit ${state.suit}`;
  for (const id of ['mocap', 'keyed']) document.getElementById(id).classList.toggle('on', (id === 'keyed') === state.clip.endsWith('_keyed'));
  for (const s of ['m', 'f']) document.getElementById('suit-' + s).classList.toggle('on', s === state.suit);
}
document.getElementById('mocap').onclick = () => { state.clip = 'Kick_Round'; apply(); };
document.getElementById('keyed').onclick = () => { state.clip = 'Kick_Round_keyed'; apply(); };
document.getElementById('suit-m').onclick = () => { state.suit = 'm'; apply(); };
document.getElementById('suit-f').onclick = () => { state.suit = 'f'; apply(); };
const speed = document.getElementById('speed');
speed.oninput = () => { state.speed = Number(speed.value); document.getElementById('speedv').textContent = state.speed.toFixed(2) + 'x'; apply(); };
document.getElementById('orbit').onchange = (e) => { controls.autoRotate = e.target.checked; };
document.getElementById('pause').onchange = (e) => { state.paused = e.target.checked; apply(); };
apply();

let last = performance.now(), acc = 0;
const FRAME = 1 / 30;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  acc += dt;
  if (acc < FRAME) return;
  const step = acc;
  acc = 0;
  bats[state.suit].animator.update(step);
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(loop);
window.__live = { state, apply, assets };
