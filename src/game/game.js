// Game shell: boot, title screen, the frame loop and the wiring between systems.
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadSettings } from '../core/settings.js';
import { loadProgress, saveProgress, sanitizeProgress, DEFAULT_PROGRESS } from '../core/save.js';
import { createInput } from '../core/input.js';
import { createEvents } from '../core/events.js';
import { createTimeControl } from '../core/time.js';
import { createRng } from '../core/rng.js';
import { bindingLabel } from '../core/bindings.js';
import { getQuality } from '../render/quality.js';
import { createRenderer } from '../render/renderer.js';
import { createInkPipeline } from '../render/inkPipeline.js';
import { paletteAt } from '../render/comicPalette.js';
import { loadAssets } from '../actors/assets.js';
import { createHero } from '../actors/hero.js';
import { buildKickClips } from '../actors/kicks.js';
import { createEnemy } from '../actors/enemy.js';
import { SITES } from '../world/mapData.js';
import { pickGrapplePoint } from '../world/grapple.js';
import { createPickups, createNeonParty } from '../world/storyProps.js';
import { createCombat } from '../combat/combatSystem.js';
import { createHud } from '../ui/hud.js';
import { createComic } from '../ui/comic.js';
import { createMenus } from '../ui/menus.js';
import { createPromptQueue } from '../ui/prompts.js';
import { createWaypoint, createBeacon } from '../ui/waypoint.js';
import { createAudio } from '../audio/audio.js';
import { createVoice } from '../audio/voice.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';
import { createFx } from './fx.js';
import { createEncounters } from './encounters.js';
import { createBalloons } from './balloons.js';
import { createFlow } from './flow.js';
import { STEPS } from './story.js';
import { wireAudio } from './sound.js';
import { createBoss } from './boss.js';
import { createFinale } from './finale.js';

async function loadFonts() {
  try {
    const all = Promise.all(['64px Bangers', '32px "Patrick Hand SC"', '700 32px "Barlow Condensed"'].map((f) => document.fonts.load(f)));
    // Never hold the game hostage to a slow font server.
    await Promise.race([all, new Promise((r) => setTimeout(r, 4000))]);
  } catch { /* fonts are a nicety; canvases fall back to Impact */ }
}

export async function startGame({ canvas, hudRoot, params, onProgress = () => {} }) {
  const storage = (() => { try { return window.localStorage; } catch { return null; } })();
  const settings = loadSettings(storage);
  const quality = getQuality(params.get('q') ?? settings.quality);
  const renderer = createRenderer(canvas, quality);
  const ink = createInkPipeline(renderer, quality);
  ink.setComic(quality.comic);
  ink.setPalette(paletteAt(0, 0));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 1500);
  const input = createInput({ target: window, bindings: settings.bindings });
  const events = createEvents();
  const time = createTimeControl();
  const audio = createAudio();

  // Boot timing marks (read with performance.getEntriesByType('mark')).
  const mark = (n) => performance.mark?.(`boot:${n}`);
  // Models download while the fonts load (the city's painted signs need the fonts first).
  const assetsPromise = loadAssets('./assets/', (f) => onProgress(0.1 + f * 0.6)).then((a) => { mark('assets'); return a; });
  await loadFonts();
  mark('fonts');
  onProgress(0.1);
  const world = createWorld(scene, quality);
  mark('world');
  const assets = await assetsPromise;
  for (const c of buildKickClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  mark('clips');
  onProgress(0.9);
  // Compile the city's shaders behind the loading bar instead of freezing the first frame.
  try { await renderer.compileAsync(scene, camera); } catch { /* compiles on first draw instead */ }
  mark('compiled');
  onProgress(0.97);

  let progress = params.has('new') ? sanitizeProgress(DEFAULT_PROGRESS) : loadProgress(storage);
  if (params.has('at')) {
    const i = STEPS.findIndex((s) => s.id === params.get('at'));
    if (i >= 0) progress = { ...progress, step: i };
  }

  // Recorded Joker lines; the music ducks while he talks.
  const voice = createVoice({
    getVolume: () => settings.volume,
    duck: (on) => audio.setVolumes(on ? { ...settings.volume, music: settings.volume.music * 0.35 } : settings.volume),
  });
  const menus = createMenus({ root: document.body, settings, storage, input, sound: (n) => audio.play(n), onChange: () => applySettings() });
  const fpsEl = Object.assign(document.createElement('div'), { className: 'fps' });
  document.body.appendChild(fpsEl);

  const state = { frame: 0, fps: 0, ready: false, t: 0, phase: 'title', paused: false };
  let game = null; // everything that exists once a run has begun

  function applySettings() {
    input.setBindings(settings.bindings);
    audio.setVolumes(settings.volume);
    ink.uniforms.uHalftoneAmount.value = settings.halftone;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap) * settings.renderScale);
    fpsEl.style.display = settings.showFps ? '' : 'none';
    game?.follow.configure(settings);
    if (game) {
      game.combat.setDifficulty(settings.difficulty);
      const max = settings.difficulty === 'story' ? 150 : 100;
      if (game.hero.maxHealth !== max) {
        game.hero.health = Math.round((game.hero.health / game.hero.maxHealth) * max);
        game.hero.maxHealth = max;
        game.hud.setHealth(game.hero.health / max);
      }
    }
    resize();
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ink.setSize(w, h);
    world.resize(h * renderer.getPixelRatio(), camera.fov);
    game?.finale.resize(h * renderer.getPixelRatio(), camera.fov);
  }
  addEventListener('resize', resize);

  // ---------------- title screen ----------------
  function showTitle() {
    state.phase = 'title';
    input.setEnabled(false);
    audio.music('title');
    menus.title({
      canContinue: progress.step > 0,
      onContinue: () => begin(progress.suit ?? 'm', false),
      onNew: () => menus.suitSelect({ gold: progress.goldUnlocked, onPick: (s) => begin(s, true), onBack: showTitle }),
    });
  }

  // ---------------- a run ----------------
  function begin(suit, fresh) {
    menus.hide();
    audio.unlock();
    if (fresh) progress = { ...sanitizeProgress(DEFAULT_PROGRESS), balloons: progress.balloons, goldUnlocked: progress.goldUnlocked };
    progress.suit = suit;
    saveProgress(storage, progress);
    game = buildRun(suit);
    input.setEnabled(true);
    state.phase = 'play';
    applySettings();
    game.flow.start();
  }

  function buildRun(suit) {
    const hero = createHero({ assets, suit, scene, collision: world.collision, events });
    hero.teleport(SITES.start, Math.PI * 1.2);
    if (settings.difficulty === 'story') { hero.maxHealth = 150; hero.health = 150; }
    const follow = createFollowCamera(camera, world.collision);
    follow.configure(settings);
    follow.snapBehind(hero.bat.yaw);
    const fill = new THREE.DirectionalLight(0x9fb2d6, 1.25);
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
    const neonParty = createNeonParty(scene, world.halos);
    const comic = createComic(document.body, { onSound: (n) => audio.play(n), onVoice: (id) => voice.say(id) });
    const prompts = createPromptQueue(hud, () => settings.bindings, () => settings.hints);
    const waypoint = createWaypoint(hudRoot.querySelector('.hud') ?? hudRoot);
    const beacon = createBeacon(scene);
    const boss = createBoss({ assets, scene, rng, combat, events, hud, spawn, despawn, hero, time, getDifficulty: () => settings.difficulty });
    boss.joker.health = 999;
    const finale = createFinale({ scene, world, hero, boss, camera, events, rng });

    // Renders the live city from a posed camera into an image for comic panels.
    const stage = {
      boss,
      shot({ cam, look, fov = 55, hero: pose, setup }) {
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
        setup?.(stage);
        camera.position.set(...cam);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        camera.lookAt(...look);
        fill.position.copy(camera.position);
        fill.target.position.set(...look);
        world.update(state.t, 0.016, camera.position, camera);
        ink.render(scene, camera, state.t);
        const url = renderer.domElement.toDataURL('image/jpeg', 0.88);
        hero.pos.copy(saved.pos);
        hero.bat.face(saved.yaw);
        hero.bat.root.visible = true;
        hero.cape.mesh.visible = true;
        hero.cape.reset();
        if (setup && !boss.active) boss.hide();
        camera.fov = settings.fov;
        camera.updateProjectionMatrix();
        return url;
      },
    };

    const flow = createFlow({
      hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups,
      collision: world.collision, follow, boss, finale, neonParty,
      onCredits: () => {
        document.exitPointerLock?.();
        input.setEnabled(false);
        menus.credits({ final: true, onClose: () => { menus.hide(); input.setEnabled(true); flow.freeRoam(); } });
      },
    });

    // ---- HUD reactions ----
    events.on('impact', ({ pos, outcome }) => fx.impact(pos, outcome === 'hit' ? 0.7 : 1.1));
    events.on('word', ({ text, pos, big }) => { const p = toScreen(pos); if (!p.behind) hud.sfx(text, p.x, p.y, big); });
    events.on('critical', () => hud.critical());
    events.on('heroHurt', ({ damage }) => { hud.damage(damage); hud.setHealth(hero.health / hero.maxHealth); });
    const HINTS = {
      parried: () => `Knife goons parry punches. ${key('kick')} kick or ${key('cape')} cape-stun them first.`,
      immune: () => `Brutes shrug off hits. ${key('cape')} cape-stun first, then punch away.`,
      'brute-counter': () => `A red bolt can't be countered. ${key('dodge')} dodge out of the way!`,
      'special-locked': () => 'Special takedowns unlock at an 8 hit combo.',
      joker: () => `The Joker slips every punch. Hit him with a batarang ${key('batarang')} while he winds up a throw!`,
      'joker-throw': () => `A yellow bolt means he is throwing. ${key('batarang')} batarang him now!`,
      gas: () => 'Laughing gas! Get out of the green cloud.',
      finish: () => `He is reeling! ${key('special')} Finish him!`,
    };
    events.on('blocked', ({ outcome, target }) => hud.hint((target?.type === 'joker' ? HINTS.joker : HINTS[outcome])(), 3500));
    events.on('hint', ({ id }) => HINTS[id] && hud.hint(HINTS[id](), 3000));
    events.on('bossStaggered', () => hud.hint(HINTS.finish(), 3500));
    const PROMPT_DONE = { throwRelease: 'throw', slam: 'slam', glideStart: 'glide', grapple: 'grapple', grappleBoost: 'grappleBoost', counter: 'counter', cape: 'cape', batarangThrow: 'batarang', dodge: 'dodge', special: 'special', jumpKick: 'kick' };
    for (const [ev, id] of Object.entries(PROMPT_DONE)) events.on(ev, () => prompts.done(id));
    events.on('swing', ({ kind, finisher }) => { prompts.done(kind === 'kick' ? 'kick' : 'punch'); if (finisher) prompts.done('finisher'); });
    events.on('step', ({ step }) => { if (step.id === 'toDocks') setTimeout(() => prompts.show(['detective', 'balloons']), 30000); });

    const sound = wireAudio({ audio, events, hero, combat, flow, settings, voice });
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

    const ctx = { input, cam: follow, grappleTarget: null, fx };
    let lastCombo = -1;
    let detective = 0;

    function update(real) {
      const playing = flow.mode === 'play' || flow.mode === 'dead';
      const dt = playing && !state.paused ? time.scale(real) : 0;
      if (playing && !state.paused) {
        if (input.pressed('detective')) state.detectiveOn = !state.detectiveOn;
        pickGrapple(real);
        // Grapple is only locked while a fight is actually around you.
        const busy = combat.enemies.some((e) => e.alive && e.aware && e.pos.distanceTo(hero.pos) < 12 && Math.abs(e.pos.y - hero.pos.y) < 4);
        ctx.grappleTarget = busy ? null : grapple.target;
        combat.update(dt, ctx);
        hero.update(dt, ctx);
        fx.update(dt);
        if (hero.pos.y < -0.8) { events.emit('splash'); hero.teleport(hero.lastSafe); }
        follow.update(real, hero.pos, input.look, combat.cameraMode ?? hero.cameraMode(), hero.speed);
        hero.updateCape(dt);
        boss.update(dt);
        if (boss.speech) { const p = toScreen(boss.headWorld(new THREE.Vector3())); hud.speechPos(p.x, p.y - 20, !p.behind); }
        if (combat.combo.value !== lastCombo) { lastCombo = combat.combo.value; hud.setCombo(lastCombo); }
        marker.visible = !!ctx.grappleTarget && !hero.control;
        if (marker.visible) { marker.position.set(ctx.grappleTarget.x, ctx.grappleTarget.y + 1, ctx.grappleTarget.z); marker.rotation.y += real * 3; }
        fill.position.copy(camera.position);
        fill.target.position.copy(hero.pos);
        const glyphIds = new Set();
        for (const e of combat.enemies) {
          glyphIds.add(e.id);
          e.ch.root.visible = e.pos.distanceTo(camera.position) > 2.4;
          const show = !!e.glyph && (e.state === 'windup' || e.state === 'throw');
          if (show) { const p = toScreen(e.ch.headWorld(new THREE.Vector3(), 0.45)); hud.glyph(e.id, p.x, p.y, !p.behind, e.glyph); }
          else hud.glyph(e.id, 0, 0, false);
        }
        hud.pruneGlyphs(glyphIds);
      }
      detective += ((state.detectiveOn && playing ? 1 : 0) - detective) * Math.min(1, real * 6);
      ink.uniforms.uDetective.value = detective;
      if (flow.mode === 'finale') finale.update(real);
      else finale.update(state.paused ? 0 : real);
      flow.update(state.paused ? 0 : real, camera);
      sound.update(real);
    }

    const api = {
      hero, follow, combat, hud, flow, encounters, balloons, boss, finale, comic, grapple, update, spawn,
      winFight: () => { for (const e of combat.enemies) if (e.alive && e.type !== 'joker') { e.health = 0; e.applyHit({ outcome: 'ko' }, hero.pos); } },
    };
    if (params.get('god') === '1') events.on('heroHurt', () => { hero.health = hero.maxHealth; hud.setHealth(1); });
    // ?fight=test drops a mixed squad on the GCPD roof (combat sandbox).
    if (params.get('fight') === 'test') {
      const b = SITES.start;
      combat.setEnemies([
        spawn('grunt', { x: b.x - 4, y: b.y, z: b.z - 6 }), spawn('grunt', { x: b.x + 4, y: b.y, z: b.z - 6 }),
        spawn('grunt', { x: b.x, y: b.y, z: b.z - 9 }), spawn('knife', { x: b.x - 6, y: b.y, z: b.z - 2 }),
        spawn('brute', { x: b.x + 6, y: b.y, z: b.z - 12 }),
      ]);
      for (const e of combat.enemies) e.wake();
    }
    Object.assign(window.__game, api, { teleport: (site) => {
        const p = { ...(SITES[site] ?? site) };
        const g = world.collision.groundBelow(p.x, p.y + 4, p.z, 0.3);
        if (g > -Infinity) p.y = g;
        hero.teleport(p);
      }, jump: (id) => flow.jumpTo(STEPS.findIndex((s) => s.id === id)) });
    Object.defineProperty(window.__game, 'enemies', { get: () => combat.enemies, configurable: true });
    return api;
  }

  // ---------------- pause ----------------
  function pause() {
    if (state.phase !== 'play' || state.paused || !game || game.flow.mode !== 'play') return;
    state.paused = true;
    state.pauseMenu = true;
    input.setEnabled(false);
    document.exitPointerLock?.();
    menus.pause({
      onResume: resume,
      onRestart: () => { resume(); game.flow.respawn(); },
      onTitle: () => { location.search = ''; },
    });
  }
  function resume({ lock = true } = {}) {
    menus.hide();
    state.paused = false;
    state.pauseMenu = false;
    input.setEnabled(true);
    if (lock) canvas.requestPointerLock?.();
  }

  // Gamepad: pause and help, comic pages, and menu navigation (D-pad to move, A to press, B to go back).
  function padControls() {
    if (state.phase === 'title' || state.paused || menus.open) {
      const buttons = [...document.querySelectorAll('.menu-layer.show button')];
      if (!buttons.length) return;
      const i = buttons.indexOf(document.activeElement);
      if (input.padButton(12) || input.padButton(14)) buttons[(i - 1 + buttons.length) % buttons.length].focus();
      if (input.padButton(13) || input.padButton(15)) buttons[(i + 1) % buttons.length].focus();
      if (input.padButton(0)) (buttons[i] ?? buttons[0]).click();
      if (input.padButton(1) || input.padButton(9)) {
        const back = buttons.find((b) => /^(Back|Resume)$/i.test(b.textContent));
        if (back) back.click();
        else if (state.pauseMenu) resume({ lock: false });
      }
      return;
    }
    if (!game) return;
    if (game.comic.playing) {
      if (input.padButton(0)) game.comic.advance();
      if (input.padButton(1)) game.comic.skip();
      return;
    }
    if (input.padButton(9)) pause();
    else if (input.padButton(13) && game.flow.mode === 'play') {
      state.paused = true;
      state.pauseMenu = true;
      input.setEnabled(false);
      menus.help(() => resume({ lock: false }));
    }
  }
  document.addEventListener('pointerlockchange', () => {
    // Losing the mouse mid-game (Esc) pauses, like any PC game.
    if (!document.pointerLockElement && state.phase === 'play' && !state.paused && game?.flow.mode === 'play' && !menus.open) pause();
  });
  window.addEventListener('keydown', (e) => {
    if (state.phase !== 'play' || !game) return;
    const pauseKeys = settings.bindings.pause, helpKeys = settings.bindings.help;
    if (pauseKeys.includes(e.code) && !input.capturing && !game.comic.playing) { e.preventDefault(); state.paused ? (menus.open ? resume() : null) : pause(); }
    else if (helpKeys.includes(e.code) && !state.paused && game.flow.mode === 'play') {
      state.paused = true;
      state.pauseMenu = true;
      input.setEnabled(false);
      document.exitPointerLock?.();
      menus.help(resume);
    }
  });
  canvas.addEventListener('click', () => { audio.unlock(); if (state.phase === 'play' && !state.paused) canvas.requestPointerLock?.(); });
  window.addEventListener('mousedown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });

  window.__game = { state, camera, scene, world, input, events, audio, voice, settings, time, get progress() { return progress; }, begin };

  // ---------------- frame loop ----------------
  let last = performance.now(), fpsT = 0, fpsN = 0, errors = 0;
  let orbit = 0;
  const weather = { next: 6, flashT: 0 };
  function lightning(real) {
    weather.next -= real;
    if (weather.next <= 0) {
      weather.next = 9 + Math.random() * 12;
      weather.flashT = 0.26;
      setTimeout(() => events.emit('thunder'), 300 + Math.random() * 900);
    }
    if (weather.flashT > 0) weather.flashT -= real;
    const t = weather.flashT;
    const k = (t > 0.2 && t <= 0.26) || (t > 0.06 && t <= 0.1) ? 1 : 0;
    ink.uniforms.uFlash.value = k;
    world.setFlash(k);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (err) { if (errors++ < 5) console.error(err); }
    if (state.frame === 1) mark('firstFrame');
  }
  function step(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    state.t += real;
    input.update(real);
    let focus = camera.position;
    if (state.phase === 'title') {
      // A slow orbit over the GCPD roof with the signal overhead.
      orbit += real * 0.05;
      camera.position.set(Math.sin(orbit) * 95, 82, Math.cos(orbit) * 95 + 10);
      camera.lookAt(-20, 60, -60);
    } else if (game) {
      // A cutscene, the finale or the credits never run under a pause menu.
      if (state.pauseMenu && !['play', 'dead'].includes(game.flow.mode)) resume({ lock: false });
      game.update(real);
      focus = game.hero.pos;
    }
    padControls();
    lightning(real);
    world.update(state.t, real, focus, camera, game?.hero ?? null);
    ink.render(scene, camera, state.t);
    input.endFrame();
    audio.update(real);
    state.frame += 1;
    fpsT += real; fpsN += 1;
    if (fpsT >= 1) { state.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0; fpsEl.textContent = `${state.fps} fps`; }
  }

  applySettings();
  onProgress(1);
  // One hidden frame of the title view: texture uploads and post-process setup happen under the
  // loading screen instead of stalling the first visible frame.
  camera.position.set(Math.sin(orbit) * 95, 82, Math.cos(orbit) * 95 + 10);
  camera.lookAt(-20, 60, -60);
  try { world.update(0, 0, camera.position, camera, null); ink.render(scene, camera, 0); } catch (err) { console.error(err); }
  mark('prewarm');
  requestAnimationFrame(frame);
  state.ready = true;
  // The Joker's lines download while the title screen is up.
  setTimeout(() => voice.warm(), 1500);
  // Dev and test shortcuts skip the title: ?at=<step>, ?play=1, ?fight=test.
  if (params.has('at') || params.has('play') || params.has('fight') || params.has('new') && params.has('skip')) begin(params.get('suit') ?? progress.suit ?? 'm', false);
  else showTitle();
}
