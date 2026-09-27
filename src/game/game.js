// Game shell: boot, the frame loop and the top-level state machine.
import * as THREE from 'three';
import { loadSettings } from '../core/settings.js';
import { createInput } from '../core/input.js';
import { createEvents } from '../core/events.js';
import { createTimeControl } from '../core/time.js';
import { getQuality } from '../render/quality.js';
import { createRenderer } from '../render/renderer.js';
import { createInkPipeline } from '../render/inkPipeline.js';
import { loadAssets } from '../actors/assets.js';
import { createHero } from '../actors/hero.js';
import { SITES } from '../world/mapData.js';
import { pickGrapplePoint } from '../world/grapple.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';

async function loadFonts() {
  try {
    await Promise.all(['64px Bangers', '32px "Patrick Hand SC"', '700 32px "Barlow Condensed"'].map((f) => document.fonts.load(f)));
  } catch { /* fonts are a nicety; canvases fall back to Impact */ }
}

export async function startGame({ canvas, hudRoot, params, onProgress = () => {} }) {
  const storage = (() => { try { return window.localStorage; } catch { return null; } })();
  const settings = loadSettings(storage);
  const quality = getQuality(params.get('q') ?? settings.quality);
  const renderer = createRenderer(canvas, quality);
  const ink = createInkPipeline(renderer, quality);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 1500);
  const input = createInput({ target: window, bindings: settings.bindings });
  const events = createEvents();
  const time = createTimeControl();

  await loadFonts();
  onProgress(0.1);
  const assetsPromise = loadAssets('./assets/', (f) => onProgress(0.1 + f * 0.5));
  const world = createWorld(scene, quality);
  const assets = await assetsPromise;
  onProgress(0.8);

  const hero = createHero({ assets, suit: params.get('suit') ?? 'm', scene, collision: world.collision, events });
  hero.teleport(SITES.start, Math.PI * 1.2);
  const follow = createFollowCamera(camera, world.collision);
  follow.configure(settings);
  follow.snapBehind(hero.bat.yaw);

  // Grapple target: re-picked ten times a second, with a line-of-sight check.
  const grapple = { target: null, timer: 0 };
  const eye = new THREE.Vector3(), camDir = new THREE.Vector3(), toPt = new THREE.Vector3();
  function pickGrapple(dt) {
    grapple.timer -= dt;
    if (grapple.timer > 0) return;
    grapple.timer = 0.1;
    if (hero.control) return;
    follow.lookDir(camDir);
    eye.copy(hero.pos); eye.y += 1.6;
    grapple.target = pickGrapplePoint(world.grapplePoints, camera.position, camDir, hero.pos, {
      visible: (p) => {
        toPt.set(p.x + (p.nx ?? 0) * 0.4 - eye.x, p.y + 0.3 - eye.y, p.z + (p.nz ?? 0) * 0.4 - eye.z);
        const d = toPt.length();
        const hit = world.collision.raycast(eye, toPt.divideScalar(d), d);
        return !hit || hit.t > d - 1.2;
      },
    });
  }

  // Temporary grapple marker until the HUD lands.
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), new THREE.MeshBasicMaterial({ color: 0x49b4ff }));
  marker.layers.set(1);
  scene.add(marker);

  // Dev fly camera: ?fly=x,y,z,yawDeg,pitchDeg
  const vec = (s) => s.split(',').map(Number);
  const flyMode = params.has('fly');
  const fly = { pos: new THREE.Vector3(0, 60, 80), yaw: Math.PI, pitch: -0.3 };
  if (flyMode) {
    const [x, y, z, yaw = 180, pitch = -15] = vec(params.get('fly'));
    fly.pos.set(x, y, z);
    fly.yaw = (yaw * Math.PI) / 180;
    fly.pitch = (pitch * Math.PI) / 180;
  }
  canvas.addEventListener('click', () => canvas.requestPointerLock?.());

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ink.setSize(w, h);
    world.resize(h * renderer.getPixelRatio(), camera.fov);
  }
  addEventListener('resize', resize);
  resize();

  const state = { frame: 0, fps: 0, ready: false, t: 0 };
  const ctx = { input, cam: follow, grappleTarget: null };
  window.__game = { state, camera, scene, world, fly, hero, follow, grapple, input, events };
  let last = performance.now(), fpsT = 0, fpsN = 0;
  const fwd = new THREE.Vector3(), right = new THREE.Vector3();

  function flyUpdate(dt) {
    fly.yaw -= input.look.dx * 0.0025;
    fly.pitch = THREE.MathUtils.clamp(fly.pitch - input.look.dy * 0.0025, -1.5, 1.5);
    fwd.set(Math.sin(fly.yaw) * Math.cos(fly.pitch), Math.sin(fly.pitch), Math.cos(fly.yaw) * Math.cos(fly.pitch));
    right.set(-Math.cos(fly.yaw), 0, Math.sin(fly.yaw));
    const speed = input.down('sprint') ? 90 : 30;
    fly.pos.addScaledVector(fwd, input.move.y * speed * dt).addScaledVector(right, input.move.x * speed * dt);
    if (input.down('jump')) fly.pos.y += speed * dt;
    if (input.down('dodge')) fly.pos.y -= speed * dt;
    camera.position.copy(fly.pos);
    camera.lookAt(fly.pos.clone().add(fwd));
  }

  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = time.scale(real);
    state.t += real;
    input.update(real);

    if (flyMode) flyUpdate(real);
    else {
      pickGrapple(real);
      ctx.grappleTarget = grapple.target;
      hero.update(dt, ctx);
      if (hero.pos.y < -0.8) hero.teleport(hero.lastSafe);
      follow.update(real, hero.pos, input.look, hero.cameraMode(), hero.speed);
      hero.updateCape(dt);
      marker.visible = !!grapple.target && !hero.control;
      if (grapple.target) { marker.position.set(grapple.target.x, grapple.target.y + 0.9, grapple.target.z); marker.rotation.y += real * 3; }
    }

    world.update(state.t, real, flyMode ? fly.pos : hero.pos, camera);
    ink.render(scene, camera, state.t);
    input.endFrame();

    state.frame += 1;
    fpsT += real; fpsN += 1;
    if (fpsT >= 1) { state.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
    requestAnimationFrame(frame);
  }
  onProgress(1);
  requestAnimationFrame(frame);
  state.ready = true;
}
