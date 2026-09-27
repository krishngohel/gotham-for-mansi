// Game shell: boot, the frame loop and the wiring between systems.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadSettings } from '../core/settings.js';
import { loadProgress, sanitizeProgress, DEFAULT_PROGRESS } from '../core/save.js';
import { createInput } from '../core/input.js';
import { createEvents } from '../core/events.js';
import { createTimeControl } from '../core/time.js';
import { createRng } from '../core/rng.js';
import { bindingLabel } from '../core/bindings.js';
import { getQuality } from '../render/quality.js';
import { createRenderer } from '../render/renderer.js';
import { createInkPipeline } from '../render/inkPipeline.js';
import { loadAssets } from '../actors/assets.js';
import { createHero } from '../actors/hero.js';
import { buildKickClips } from '../actors/kicks.js';
import { createEnemy } from '../actors/enemy.js';
import { SITES } from '../world/mapData.js';
import { pickGrapplePoint } from '../world/grapple.js';
import { createPickups } from '../world/storyProps.js';
import { createCombat } from '../combat/combatSystem.js';
import { createHud } from '../ui/hud.js';
import { createComic } from '../ui/comic.js';
import { createPromptQueue } from '../ui/prompts.js';
import { createWaypoint, createBeacon } from '../ui/waypoint.js';
import { createAudio } from '../audio/audio.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';
import { createFx } from './fx.js';
import { createEncounters } from './encounters.js';
import { createBalloons } from './balloons.js';
import { createFlow } from './flow.js';
import { STEPS } from './story.js';
import { wireAudio } from './sound.js';

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
  ink.uniforms.uHalftoneAmount.value = settings.halftone;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 1500);
  const input = createInput({ target: window, bindings: settings.bindings });
  const events = createEvents();
  const time = createTimeControl();
  const audio = createAudio();
  audio.setVolumes(settings.volume);

  await loadFonts();
  onProgress(0.1);
  const assetsPromise = loadAssets('./assets/', (f) => onProgress(0.1 + f * 0.5));
  const world = createWorld(scene, quality);
  const assets = await assetsPromise;
  for (const c of buildKickClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  onProgress(0.8);

  // Progress: ?new=1 starts fresh, ?at=<stepId> jumps to a step (dev and testing).
  let progress = params.has('new') ? sanitizeProgress(DEFAULT_PROGRESS) : loadProgress(storage);
  if (params.has('at')) {
    const i = STEPS.findIndex((s) => s.id === params.get('at'));
    if (i >= 0) progress = { ...progress, step: i };
  }
  const suit = params.get('suit') ?? progress.suit ?? 'm';

  const hero = createHero({ assets, suit, scene, collision: world.collision, events });
  hero.teleport(SITES.start, Math.PI * 1.2);
  const follow = createFollowCamera(camera, world.collision);
  follow.configure(settings);
  follow.snapBehind(hero.bat.yaw);
  const fill = new THREE.DirectionalLight(0x9fb2d6, 0.9);
  scene.add(fill, fill.target);

  const hud = createHud(hudRoot);
  hud.setHealth(1);
  const fx = createFx(scene);
  const rng = createRng(99);
  const combat = createCombat({ hero, follow, time, events, rng, getDifficulty: () => settings.difficulty });
  const key = (a) => `<kbd>${bindingLabel(settings.bindings, a)}</kbd>`;
  const screen = new THREE.Vector3();
  const toScreen = (v) => { screen.copy(v).project(camera); return { x: (screen.x * 0.5 + 0.5) * innerWidth, y: (-screen.y * 0.5 + 0.5) * innerHeight, behind: screen.z > 1 }; };

  let nextId = 0;
  const spawn = (type, p) => {
    const e = createEnemy({ id: `e${nextId++}`, type, assets, scene, collision: world.collision, rng });
    e.place(p, Math.atan2(hero.pos.x - p.x, hero.pos.z - p.z) + rng.range(-1, 1));
    return e;
  };
  const despawn = (e) => e.remove();
  const encounters = createEncounters({ spawn, despawn, combat, events, collision: world.collision });
  const balloons = createBalloons(scene, progress.balloons);
  const pickups = createPickups(scene, world.halos, SITES);
  const comic = createComic(document.body, { onSound: (n) => audio.play(n) });
  const prompts = createPromptQueue(hud, () => settings.bindings, () => settings.hints);
  const waypoint = createWaypoint(hudRoot.querySelector('.hud') ?? hudRoot);
  const beacon = createBeacon(scene);

  const state = { frame: 0, fps: 0, ready: false, t: 0 };

  // Renders the live city from a posed camera into an image for comic panels.
  const stage = {
    shot({ cam, look, fov = 55, hero: pose }) {
      const saved = { pos: hero.pos.clone(), yaw: hero.bat.yaw };
      if (pose === null) { hero.bat.root.visible = false; hero.cape.mesh.visible = false; }
      else if (pose) {
        hero.pos.set(...pose.at);
        hero.bat.face(pose.yaw);
        hero.bat.tilt.rotation.set(0, 0, 0);
        hero.bat.animator.play(pose.anim ?? 'Idle_Loop', { fade: 0 });
        hero.bat.animator.update(pose.time ?? 0.6);
        hero.cape.reset();
        for (let i = 0; i < 90; i++) hero.cape.update(1 / 60);
      }
      camera.position.set(...cam);
      camera.fov = fov;
      camera.updateProjectionMatrix();
      camera.lookAt(...look);
      world.update(state.t, 0.016, camera.position, camera);
      ink.render(scene, camera, state.t);
      const url = renderer.domElement.toDataURL('image/jpeg', 0.88);
      hero.pos.copy(saved.pos);
      hero.bat.face(saved.yaw);
      hero.bat.root.visible = true;
      hero.cape.mesh.visible = true;
      hero.cape.reset();
      camera.fov = settings.fov;
      camera.updateProjectionMatrix();
      return url;
    },
  };

  const flow = createFlow({
    hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups,
    collision: world.collision, follow,
    onCredits: () => events.emit('credits'),
  });

  // ---- HUD reactions ----
  events.on('impact', ({ pos, outcome }) => fx.impact(pos, outcome === 'hit' ? 0.7 : 1.1));
  events.on('word', ({ text, pos }) => { const p = toScreen(pos); if (!p.behind) hud.sfx(text, p.x, p.y); });
  events.on('heroHurt', ({ damage }) => { hud.damage(damage); hud.setHealth(hero.health / hero.maxHealth); });
  const HINTS = {
    parried: () => `Knife goons parry punches. ${key('kick')} kick or ${key('cape')} cape-stun them first.`,
    immune: () => `Brutes shrug off hits. ${key('cape')} cape-stun first, then punch away.`,
    'brute-counter': () => `A red bolt can't be countered. ${key('dodge')} dodge out of the way!`,
    'special-locked': () => 'Special takedowns unlock at an 8 hit combo.',
  };
  events.on('blocked', ({ outcome }) => hud.hint(HINTS[outcome](), 3500));
  events.on('hint', ({ id }) => HINTS[id] && hud.hint(HINTS[id](), 3000));
  // Tutorial prompts disappear once the player has done the thing.
  const PROMPT_DONE = { glideStart: 'glide', grapple: 'grapple', grappleBoost: 'grappleBoost', counter: 'counter', cape: 'cape', batarangThrow: 'batarang', dodge: 'dodge', special: 'special', jumpKick: 'kick' };
  for (const [ev, id] of Object.entries(PROMPT_DONE)) events.on(ev, () => prompts.done(id));
  events.on('swing', ({ kind }) => prompts.done(kind === 'kick' ? 'kick' : 'punch'));
  events.on('step', ({ step }) => { if (step.id === 'toDocks') setTimeout(() => prompts.show(['detective', 'balloons']), 30000); });

  const sound = wireAudio({ audio, events, hero, combat, flow, settings });
  sound.start();

  // ---- grapple targeting ----
  const grapple = { target: null, timer: 0 };
  const eye = new THREE.Vector3(), camDir = new THREE.Vector3(), toPt = new THREE.Vector3();
  function pickGrapple(dt) {
    grapple.timer -= dt;
    if (grapple.timer > 0) return;
    grapple.timer = 0.1;
    if (hero.control) { grapple.target = null; return; }
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
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), new THREE.MeshBasicMaterial({ color: 0x49b4ff }));
  marker.layers.set(1);
  scene.add(marker);

  canvas.addEventListener('click', () => { audio.unlock(); canvas.requestPointerLock?.(); });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  window.addEventListener('mousedown', () => audio.unlock(), { once: true });

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

  // ---- dev hooks ----
  if (params.get('god') === '1') events.on('heroHurt', () => { hero.health = hero.maxHealth; });
  if (params.get('fight') === 'test') {
    const b = SITES.start;
    combat.setEnemies([
      spawn('grunt', { x: b.x - 4, y: b.y, z: b.z - 6 }), spawn('grunt', { x: b.x + 4, y: b.y, z: b.z - 6 }),
      spawn('grunt', { x: b.x, y: b.y, z: b.z - 9 }), spawn('knife', { x: b.x - 6, y: b.y, z: b.z - 2 }),
      spawn('brute', { x: b.x + 6, y: b.y, z: b.z - 12 }),
    ]);
    for (const e of combat.enemies) e.wake();
  }

  const ctx = { input, cam: follow, grappleTarget: null, fx };
  let lastCombo = -1;
  window.__game = {
    state, camera, scene, world, hero, follow, grapple, input, events, combat, hud, flow, encounters, balloons, audio, settings, progress, comic,
    get enemies() { return combat.enemies; },
    teleport: (site) => hero.teleport(SITES[site] ?? site),
    winFight: () => { for (const e of combat.enemies) if (e.alive) { e.health = 0; e.applyHit({ outcome: 'ko' }, hero.pos); } },
    jump: (id) => flow.jumpTo(STEPS.findIndex((s) => s.id === id)),
  };

  let last = performance.now(), fpsT = 0, fpsN = 0, errors = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (err) { if (errors++ < 5) console.error(err); }
  }
  function step(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const playing = flow.mode === 'play' || flow.mode === 'dead';
    const dt = playing ? time.scale(real) : 0;
    state.t += real;
    input.update(real);

    if (playing) {
      pickGrapple(real);
      ctx.grappleTarget = combat.active ? null : grapple.target;
      combat.update(dt, ctx);
      hero.update(dt, ctx);
      fx.update(dt);
      if (hero.pos.y < -0.8) { events.emit('splash'); hero.teleport(hero.lastSafe); }
      follow.update(real, hero.pos, input.look, combat.cameraMode ?? hero.cameraMode(), hero.speed);
      hero.updateCape(dt);
      if (combat.combo.value !== lastCombo) { lastCombo = combat.combo.value; hud.setCombo(lastCombo); }
      marker.visible = !!ctx.grappleTarget && !hero.control;
      if (marker.visible) { marker.position.set(ctx.grappleTarget.x, ctx.grappleTarget.y + 1, ctx.grappleTarget.z); marker.rotation.y += real * 3; }
      fill.position.copy(camera.position);
      fill.target.position.copy(hero.pos);
      for (const e of combat.enemies) {
        e.ch.root.visible = e.pos.distanceTo(camera.position) > 2.4;
        const show = e.state === 'windup' && e.glyph;
        if (show) { const p = toScreen(e.ch.headWorld(new THREE.Vector3(), 0.45)); hud.glyph(e.id, p.x, p.y, !p.behind, e.glyph); }
        else hud.glyph(e.id, 0, 0, false);
      }
    }
    flow.update(real, camera);
    world.update(state.t, real, hero.pos, camera);
    ink.render(scene, camera, state.t);
    input.endFrame();
    audio.update(real);
    sound.update(real);

    state.frame += 1;
    fpsT += real; fpsN += 1;
    if (fpsT >= 1) { state.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; }
  }
  onProgress(1);
  requestAnimationFrame(frame);
  state.ready = true;
  flow.start();
}
