import * as THREE from 'three';
import MANSI from './mansi.config.js';
import { getQuality } from './render/quality.js';
import { createRenderer } from './render/renderer.js';
import { createInkPipeline } from './render/inkPipeline.js';
import { createRain } from './render/rain.js';
import { createLookTestSet } from './world/lookTestSet.js';
import { loadAssets } from './actors/assets.js';
import { createBat, createGoon } from './actors/characters.js';
import { createCape } from './actors/cape.js';
import { createHud } from './ui/hud.js';
import { createInput } from './core/input.js';
import { createTimeControl } from './core/time.js';
import { createRng } from './core/rng.js';

const SFX_WORDS = ['THWACK!', 'KRAK!', 'WHUMP!', 'POW!'];
const STRIKES = ['Punch_Cross', 'Punch_Jab', 'Melee_Hook'];
const SIGNAL_YAW = Math.atan2(-0.35, -0.6);
// Fixed cameras for screenshots. hero/goon: [x, z, yaw].
const CAMS = {
  hero: { pos: [4.38, 0.6, -8.92], look: [-1.03, 6.5, -16.18], hero: [2, -11, SIGNAL_YAW], goon: [10, 10, 0] },
  face: { pos: [0.55, 1.6, 1.7], look: [0, 1.45, 0], hero: [0, 0, 0], goon: [-2.6, -2.2, 0.87] },
  fight: { pos: [3.2, 1.45, 1.0], look: [0, 1.15, 1.0], hero: [0, 0, 0], goon: [0, 2, Math.PI] },
  wide: { pos: [7, 5, 10], look: [-5, 11, -14], hero: [0, 0, SIGNAL_YAW], goon: [1.2, -2, 0.5] },
  signal: { pos: [2, 1.6, 4], look: [-8, 14, -22], hero: [-1, -2, SIGNAL_YAW], goon: [10, 10, 0] },
};
const ROOF = 14;

export async function startLookTest({ canvas, hudRoot, params, onProgress = () => {} }) {
  const quality = getQuality(params.get('q') ?? 'high');
  const renderer = createRenderer(canvas, quality);
  const ink = createInkPipeline(renderer, quality);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
  const rng = createRng(7);
  const set = createLookTestSet(scene, quality, rng);
  const rain = createRain(quality.rainCount);
  scene.add(rain.mesh);

  const assets = await loadAssets('./assets/', onProgress);
  const suit = params.get('suit') === 'f' ? 'f' : 'm';
  const bat = createBat(assets, suit);
  scene.add(bat.root);
  bat.face(Math.PI / 4);
  const cape = createCape(bat, bat.colors.cape);
  scene.add(cape.mesh);
  const goon = createGoon(assets);
  scene.add(goon.root);
  goon.root.position.set(1.6, 0, 1.6);
  goon.face(Math.atan2(-1.6, -1.6));
  const preset = CAMS[params.get('cam')];
  if (preset) {
    bat.root.position.set(preset.hero[0], 0, preset.hero[1]);
    bat.face(preset.hero[2]);
    goon.root.position.set(preset.goon[0], 0, preset.goon[1]);
    goon.face(preset.goon[2]);
  }

  const hud = createHud(hudRoot);
  hud.setHealth(1);
  hud.setObjective(`Gotham needs you, ${MANSI.name}. Find the stolen presents.`);
  hud.setBalloons(0, 12);

  const input = createInput(window);
  const time = createTimeControl();
  const vec = (s) => s.split(',').map(Number);
  const fixedCam = params.has('cp')
    ? { pos: vec(params.get('cp')), look: vec(params.get('cl') ?? '0,1.4,0') }
    : CAMS[params.get('cam')] ?? null;
  const orbit = { yaw: bat.yaw, pitch: 0.2, dist: 3.4 };
  const state = {
    combo: 0, comboClock: 0, shake: 0, detective: params.get('detective') === '1' ? 1 : 0,
    detectiveOn: params.get('detective') === '1', flashT: 0, nextLightning: 5, health: 1, healClock: 0,
    strike: null, heroBusy: 0, goonBusy: 0, goonQueue: null, windup: 0, nextWindup: 3,
  };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), look = new THREE.Vector3();

  canvas.addEventListener('click', () => { if (!fixedCam) canvas.requestPointerLock?.(); });

  function toScreen(v) {
    tmp2.copy(v).project(camera);
    return { x: (tmp2.x * 0.5 + 0.5) * innerWidth, y: (-tmp2.y * 0.5 + 0.5) * innerHeight };
  }

  function goonPlay(name, then = null) {
    const a = goon.animator.play(name, { once: true, fade: 0.06 });
    state.goonBusy = a.getClip().duration / a.timeScale;
    state.goonQueue = then;
  }

  function addCombo() {
    state.combo += 1;
    state.comboClock = 1.5;
    hud.setCombo(state.combo);
  }

  function popWord(word) {
    const p = toScreen(goon.headWorld(tmp, 0.3));
    hud.sfx(word ?? rng.pick(SFX_WORDS), p.x, p.y);
  }

  function strike() {
    if (state.strike || state.heroBusy > 0) return;
    const from = bat.root.position.clone();
    const dist = from.distanceTo(goon.root.position);
    if (dist > 8) {
      bat.animator.play('Punch_Jab', { once: true, timeScale: 1.5 });
      state.strike = { t: 0, from, to: from.clone(), hit: true, dur: 0.45 };
      state.combo = 0;
      hud.setCombo(0);
      return;
    }
    const dir = tmp.copy(goon.root.position).sub(from).setY(0).normalize();
    bat.face(Math.atan2(dir.x, dir.z));
    const to = goon.root.position.clone().addScaledVector(dir, -0.85);
    bat.animator.play(rng.pick(STRIKES), { once: true, timeScale: 1.6, fade: 0.05 });
    state.strike = { t: 0, from, to, hit: false, dur: 0.55 };
  }

  function impact() {
    state.strike.hit = true;
    time.hitStop(0.06);
    state.shake = 0.12;
    addCombo();
    goonPlay(rng.chance(0.5) ? 'Hit_Chest' : 'Hit_Head');
    popWord();
  }

  function counter() {
    if (state.windup <= 0) return;
    state.windup = 0;
    hud.glyph('goon', 0, 0, false);
    const dir = tmp.copy(goon.root.position).sub(bat.root.position).setY(0).normalize();
    bat.face(Math.atan2(dir.x, dir.z));
    bat.animator.play('Melee_Hook', { once: true, timeScale: 1.4, fade: 0.05 });
    state.heroBusy = 0.6;
    time.hitStop(0.12);
    state.shake = 0.2;
    addCombo();
    goonPlay('Hit_Knockback', 'LayToIdle');
    popWord('KRAK!');
  }

  function goonAttack() {
    goonPlay('Punch_Jab');
    bat.animator.play('Hit_Chest', { once: true, fade: 0.05 });
    state.heroBusy = 0.5;
    state.health = Math.max(0.1, state.health - 0.1);
    state.healClock = 3;
    hud.setHealth(state.health);
    state.combo = 0;
    hud.setCombo(0);
  }

  function updateHero(dt) {
    if (state.strike) {
      const s = state.strike;
      s.t += dt;
      const k = Math.min(1, s.t / 0.15);
      bat.root.position.lerpVectors(s.from, s.to, 1 - (1 - k) * (1 - k));
      if (!s.hit && s.t >= 0.2) impact();
      if (s.t >= s.dur) state.strike = null;
      return;
    }
    if (state.heroBusy > 0) { state.heroBusy -= dt; return; }
    const ix = (input.held('KeyD') ? 1 : 0) - (input.held('KeyA') ? 1 : 0);
    const iz = (input.held('KeyW') ? 1 : 0) - (input.held('KeyS') ? 1 : 0);
    if (ix || iz) {
      const fx = Math.sin(orbit.yaw), fz = Math.cos(orbit.yaw);
      tmp.set(fx * iz - fz * ix, 0, fz * iz + fx * ix).normalize();
      const sprint = input.held('ShiftLeft');
      bat.root.position.addScaledVector(tmp, (sprint ? 8 : 5) * dt);
      bat.root.position.x = THREE.MathUtils.clamp(bat.root.position.x, -ROOF, ROOF);
      bat.root.position.z = THREE.MathUtils.clamp(bat.root.position.z, -ROOF, ROOF);
      const target = Math.atan2(tmp.x, tmp.z);
      const delta = Math.atan2(Math.sin(target - bat.yaw), Math.cos(target - bat.yaw));
      bat.face(bat.yaw + delta * Math.min(1, dt * 12));
      bat.animator.play(sprint ? 'Sprint_Loop' : 'Jog_Fwd_Loop');
    } else {
      bat.animator.play('Idle_Loop');
    }
  }

  function updateGoon(dt) {
    if (state.goonBusy > 0) {
      state.goonBusy -= dt;
      if (state.goonBusy <= 0) {
        const next = state.goonQueue;
        state.goonQueue = null;
        if (next) goonPlay(next); else goon.animator.play('Idle_Loop');
      }
      return;
    }
    if (state.windup > 0) {
      state.windup -= dt;
      const p = toScreen(goon.headWorld(tmp, 0.35));
      hud.glyph('goon', p.x, p.y, state.windup > 0);
      if (state.windup <= 0) goonAttack();
      return;
    }
    state.nextWindup -= dt;
    if (state.nextWindup <= 0 && !state.strike) {
      state.windup = 0.6;
      state.nextWindup = 3.5;
    }
  }

  function updateCamera(dt) {
    if (fixedCam) {
      camera.position.set(...fixedCam.pos);
      look.set(...fixedCam.look);
    } else {
      orbit.yaw -= input.mouse.dx * 0.0025;
      orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + input.mouse.dy * 0.0025, -0.15, 0.9);
      const p = bat.root.position;
      const cp = Math.cos(orbit.pitch);
      camera.position.set(
        p.x - Math.sin(orbit.yaw) * cp * orbit.dist - Math.cos(orbit.yaw) * 0.45,
        p.y + 1.55 + Math.sin(orbit.pitch) * orbit.dist,
        p.z - Math.cos(orbit.yaw) * cp * orbit.dist + Math.sin(orbit.yaw) * 0.45,
      );
      look.set(p.x - Math.cos(orbit.yaw) * 0.45, p.y + 1.35, p.z + Math.sin(orbit.yaw) * 0.45);
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt);
      const s = state.shake * 0.25;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(look);
  }

  function updateWeather(dt) {
    state.nextLightning -= dt;
    if (state.nextLightning <= 0 || input.pressed('KeyL')) {
      state.flashT = 0.26;
      state.nextLightning = rng.range(7, 14);
    }
    if (state.flashT > 0) state.flashT -= dt;
    const t = state.flashT;
    const flash = (t > 0.2 && t <= 0.26) || (t > 0.06 && t <= 0.1) ? 1 : 0;
    ink.uniforms.uFlash.value = flash;
    set.setFlash(flash);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    ink.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);
  resize();

  const look_ = (window.__look = { ready: false, frame: 0, fps: 0, punch: strike, counter, debug: { bat, goon, camera, scene, ink } });
  let last = performance.now();
  let elapsed = 0;
  let fpsTime = 0, fpsFrames = 0;
  const fpsEl = params.get('fps') === '1' ? Object.assign(document.body.appendChild(document.createElement('div')), { style: 'position:fixed;right:8px;bottom:8px;color:#efe6cf;font:14px monospace;z-index:9' }) : null;

  function frame(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = time.scale(real);
    elapsed += real;

    if (input.clicked(0) && (document.pointerLockElement || fixedCam)) strike();
    if (input.clicked(2)) counter();
    if (input.pressed('KeyV')) state.detectiveOn = !state.detectiveOn;
    if (input.pressed('Digit1') || input.pressed('Digit2')) {
      params.set('suit', input.pressed('Digit2') ? 'f' : 'm');
      location.search = params.toString();
    }

    updateHero(dt);
    updateGoon(dt);
    if (state.comboClock > 0) { state.comboClock -= dt; if (state.comboClock <= 0) { state.combo = 0; hud.setCombo(0); } }
    if (state.healClock > 0) { state.healClock -= real; if (state.healClock <= 0) { state.health = 1; hud.setHealth(1); } }
    bat.animator.update(dt);
    goon.animator.update(dt);
    updateCamera(real);
    cape.update(dt);
    state.detective += ((state.detectiveOn ? 1 : 0) - state.detective) * Math.min(1, real * 6);
    ink.uniforms.uDetective.value = state.detective;
    updateWeather(real);
    rain.update(elapsed, camera.position);
    set.update(elapsed, camera.position);
    ink.render(scene, camera, elapsed);
    input.endFrame();

    look_.frame += 1;
    fpsTime += real; fpsFrames += 1;
    if (fpsTime >= 1) {
      look_.fps = Math.round(fpsFrames / fpsTime);
      if (fpsEl) fpsEl.textContent = `${look_.fps} fps`;
      fpsTime = 0; fpsFrames = 0;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  look_.ready = true;
}
