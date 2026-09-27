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
import { buildKickClips } from '../actors/kicks.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { SITES } from '../world/mapData.js';
import { pickGrapplePoint } from '../world/grapple.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';
import { createFx } from './fx.js';
import { createHud } from '../ui/hud.js';
import { createCombat } from '../combat/combatSystem.js';
import { createEnemy } from '../actors/enemy.js';
import { createRng } from '../core/rng.js';
import { bindingLabel } from '../core/bindings.js';

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
  for (const c of buildKickClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  onProgress(0.8);

  const hero = createHero({ assets, suit: params.get('suit') ?? 'm', scene, collision: world.collision, events });
  hero.teleport(SITES.start, Math.PI * 1.2);
  const follow = createFollowCamera(camera, world.collision);
  // Soft fill from the camera so characters read as more than silhouettes.
  const fill = new THREE.DirectionalLight(0x9fb2d6, 0.9);
  scene.add(fill, fill.target);
  follow.configure(settings);
  follow.snapBehind(hero.bat.yaw);

  const hud = createHud(hudRoot);
  hud.setHealth(1);
  hud.setObjective('Gotham needs you. Find out what the Joker is planning.');
  hud.setBalloons(0, 12);
  const fx = createFx(scene);
  const rng = createRng(99);
  const combat = createCombat({ hero, follow, time, events, rng, getDifficulty: () => settings.difficulty });
  const key = (a) => `<kbd>${bindingLabel(settings.bindings, a)}</kbd>`;
  const screen = new THREE.Vector3();
  const toScreen = (v) => { screen.copy(v).project(camera); return { x: (screen.x * 0.5 + 0.5) * innerWidth, y: (-screen.y * 0.5 + 0.5) * innerHeight, behind: screen.z > 1 }; };

  let enemies = [];
  let nextId = 0;
  function spawnFight(list) {
    for (const e of enemies) e.remove();
    enemies = list.map(({ type, x, y, z }) => {
      const e = createEnemy({ id: `e${nextId++}`, type, assets, scene, collision: world.collision, rng });
      e.place({ x, y, z }, Math.atan2(hero.pos.x - x, hero.pos.z - z));
      return e;
    });
    combat.setEnemies(enemies);
    for (const e of enemies) e.wake();
    hero.health = hero.maxHealth;
  }
  if (params.get('fight') === 'test') {
    const b = SITES.start;
    spawnFight([
      { type: 'grunt', x: b.x - 4, y: b.y, z: b.z - 6 }, { type: 'grunt', x: b.x + 4, y: b.y, z: b.z - 6 },
      { type: 'grunt', x: b.x, y: b.y, z: b.z - 9 }, { type: 'knife', x: b.x - 6, y: b.y, z: b.z - 2 },
      { type: 'brute', x: b.x + 6, y: b.y, z: b.z - 12 },
    ]);
  }

  events.on('impact', ({ pos, outcome }) => fx.impact(pos, outcome === 'hit' ? 0.7 : 1.1));
  events.on('word', ({ text, pos }) => { const p = toScreen(pos); if (!p.behind) hud.sfx(text, p.x, p.y); });
  events.on('heroHurt', ({ damage }) => { hud.damage(damage); hud.setHealth(hero.health / hero.maxHealth); });
  const HINTS = {
    parried: () => `Knife goons parry punches. ${key('kick')} kick or ${key('cape')} cape-stun them first.`,
    immune: () => `Brutes shrug off hits. ${key('cape')} cape-stun first, then punch away.`,
    'brute-counter': () => `A red glyph can't be countered. ${key('dodge')} dodge out of the way!`,
    'special-locked': () => `Special takedowns unlock at an 8 hit combo.`,
  };
  events.on('blocked', ({ outcome }) => hud.hint(HINTS[outcome](), 3500));
  events.on('hint', ({ id }) => HINTS[id] && hud.hint(HINTS[id](), 3000));

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
  const ctx = { input, cam: follow, grappleTarget: null, fx };
  let lastCombo = -1;
  window.__game = { state, camera, scene, world, fly, hero, follow, grapple, input, events, combat, hud, get enemies() { return enemies; }, spawnFight };
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

  let errors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (err) { if (errors++ < 5) console.error(err); }
  }
  function step(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const dt = time.scale(real);
    state.t += real;
    input.update(real);

    if (flyMode) flyUpdate(real);
    else {
      pickGrapple(real);
      ctx.grappleTarget = combat.active ? null : grapple.target;
      combat.update(dt, ctx);
      hero.update(dt, ctx);
      fx.update(dt);
      if (hero.pos.y < -0.8) hero.teleport(hero.lastSafe);
      follow.update(real, hero.pos, input.look, combat.cameraMode ?? hero.cameraMode(), hero.speed);
      hero.updateCape(dt);
      if (combat.combo.value !== lastCombo) { lastCombo = combat.combo.value; hud.setCombo(lastCombo); }
      fill.position.copy(camera.position);
      fill.target.position.copy(hero.pos);
      for (const e of enemies) {
        // Fade out anyone standing right in front of the lens.
        e.ch.root.visible = e.pos.distanceTo(camera.position) > 2.4;
        const show = e.state === 'windup' && e.glyph;
        if (show) { const p = toScreen(e.ch.headWorld(new THREE.Vector3(), 0.45)); hud.glyph(e.id, p.x, p.y, !p.behind, e.glyph); }
        else hud.glyph(e.id, 0, 0, false);
      }
      marker.visible = !!grapple.target && !hero.control;
      if (grapple.target) { marker.position.set(grapple.target.x, grapple.target.y + 0.9, grapple.target.z); marker.rotation.y += real * 3; }
    }

    world.update(state.t, real, flyMode ? fly.pos : hero.pos, camera);
    ink.render(scene, camera, state.t);
    input.endFrame();

    state.frame += 1;
    fpsT += real; fpsN += 1;
    if (fpsT >= 1) { state.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  }
  onProgress(1);
  requestAnimationFrame(frame);
  state.ready = true;
}
