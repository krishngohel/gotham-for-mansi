// Game shell: boot, title screen, the frame loop and the wiring between systems.
import '../gadgets/gadgetSave.js';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { loadSettings } from '../core/settings.js';
import { loadProgress, saveProgress, sanitizeProgress, DEFAULT_PROGRESS, newGameProgress } from '../core/save.js';
import { createInput } from '../core/input.js';
import { createEvents, onceEachId } from '../core/events.js';
import { createTimeControl } from '../core/time.js';
import { createRng } from '../core/rng.js';
import { bindingLabel } from '../core/bindings.js';
import { getQuality } from '../render/quality.js';
import { createRenderer } from '../render/renderer.js';
import { createInkPipeline } from '../render/inkPipeline.js';
import { paletteAt } from '../render/comicPalette.js';
import { loadAssets } from '../actors/assets.js';
import { createHero } from '../actors/hero.js';
import { buildReachTable } from '../combat/reach.js';
import { buildClimbClips } from '../actors/climbAnims.js';
import { buildChainClips } from '../actors/chainAnims.js';
import { chainClipNames } from '../combat/chainTimeline.js';
import { buildStealthClips } from '../actors/stealthAnims.js';
import { createEnemy } from '../actors/enemy.js';
import { SITES } from '../world/mapData.js';
import { pickGrapplePoint } from '../world/grapple.js';
import { createPickups, createNeonParty } from '../world/storyProps.js';
import { createCombat } from '../combat/combatSystem.js';
import { createHud } from '../ui/hud.js';
import { createComicFx } from '../ui/comicFx.js';
import { createComic } from '../ui/comic.js';
import { createMenus } from '../ui/menus.js';
import { createPromptQueue } from '../ui/prompts.js';
import { createWaypoint, createBeacon } from '../ui/waypoint.js';
import { createAudio } from '../audio/audio.js';
import { createVoice } from '../audio/voice.js';
import { createWorld } from './world.js';
import { createFollowCamera } from './camera.js';
import { createFx } from './fx.js';
import { createGadgetFx } from '../gadgets/gadgetFx.js';
import { createBreakables } from '../world/breakables.js';
import { createChainFx } from './chainFx.js';
import { createEncounters } from './encounters.js';
import { createBalloons } from './balloons.js';
import { createFlow } from './flow.js';
import { STEPS } from './story.js';
import { migrateProgress } from './storyMigrate.js';
import { wireAudio } from './sound.js';
import { createBoss } from './boss.js';
import { tracker } from './progressTracker.js';
import { goldStandardPages, fromKrishnPages } from './rewardPages.js';
import { createFinale } from './finale.js';
import { createSideContent } from './sideContent.js';
import { createPhotoMode } from '../ui/photoMode.js';
import { createWarmCast } from './warmCast.js';
import { drawEverything, uploadTextures, readyObjects } from '../render/prewarm.js';
import { createDynamicRes, sanitizeResScale } from '../render/dynamicRes.js';
import { gpuRenderer, gpuShortName, maybeShowGpuHint } from '../ui/gpuInfo.js';

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
  const ink = createInkPipeline(renderer, quality, { gpuTime: params.get('gputime') === '1' });
  ink.setComic(quality.comic);
  ink.setPalette(paletteAt(0, 0));
  const scene = new THREE.Scene();
  // The camera fill light exists from boot (dark until a run starts) so the light count never
  // changes: a new light would recompile every lit shader the first time each one is drawn.
  const fill = new THREE.DirectionalLight(0x9fb2d6, 0);
  scene.add(fill, fill.target);
  const camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.1, 1500);
  const input = createInput({ target: window, bindings: settings.bindings });
  const events = createEvents();
  const time = createTimeControl();
  const audio = createAudio();

  // Boot timing marks (read with performance.getEntriesByType('mark')).
  const mark = (n) => performance.mark?.(`boot:${n}`);
  // Models download while the fonts load (the city's painted signs need the fonts first).
  const assetsPromise = loadAssets('./assets/', (f) => onProgress(0.1 + f * 0.6)).then((a) => { mark('assets'); return a; });
  const DEV_TOOLS = import.meta.env.DEV || params.get('god') === '1';
  await loadFonts();
  mark('fonts');
  onProgress(0.1);
  const world = createWorld(scene, quality);
  mark('world');
  const assets = await assetsPromise;
  for (const c of buildClimbClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  for (const c of buildChainClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  for (const c of buildStealthClips(SkeletonUtils.clone(assets.bodies.m), assets.clips)) assets.clips.set(c.name, c);
  // Where each strike's fist or foot is on its contact frame, so lunges connect.
  const reach = buildReachTable(SkeletonUtils.clone(assets.bodies.m), assets.clips);
  mark('clips');
  onProgress(0.9);
  // Characters that only appear later (goons, the Joker, every suit) join the city for the
  // compile and the prewarm draw below, then leave again.
  const warmCast = createWarmCast(assets);
  scene.add(warmCast);
  // Compile the city's shaders behind the loading bar instead of freezing the first frame.
  try { await ink.compileAsync(scene, camera); } catch { /* compiles on first draw instead */ }
  mark('compiled');
  onProgress(0.97);

  let progress = params.has('new') ? sanitizeProgress(DEFAULT_PROGRESS) : loadProgress(storage);
  // Put the save on the story by step id (saves from before Part D only have an old index).
  progress = migrateProgress(progress);
  if (params.has('at')) {
    const i = STEPS.findIndex((s) => s.id === params.get('at'));
    if (i >= 0) progress = { ...progress, step: i, stepId: STEPS[i].id };
  }

  // Recorded Joker lines; the music ducks while he talks.
  const voice = createVoice({
    getVolume: () => settings.volume,
    duck: (on) => audio.setVolumes(on ? { ...settings.volume, music: settings.volume.music * 0.35 } : settings.volume),
  });
  const menus = createMenus({ root: document.body, settings, storage, input, sound: (n) => audio.play(n), onChange: () => applySettings() });
  // Comic-style frame counter in the corner (Settings > Video hides it, or adds the GPU line).
  const fpsEl = Object.assign(document.createElement('div'), { className: 'fps' });
  fpsEl.innerHTML = '<span class="n">--</span><span class="u">fps</span><span class="d"></span>';
  document.body.appendChild(fpsEl);
  const fpsNum = fpsEl.querySelector('.n'), fpsD = fpsEl.querySelector('.d');
  const gpu = gpuRenderer(renderer.getContext());
  const gpuName = gpuShortName(gpu);
  let gpuHintBox = maybeShowGpuHint(document.body, gpu, storage);
  // Dynamic resolution rides on top of the Render scale setting (?dynres=0 turns it off, for
  // benchmarks run with vsync off, where there is no refresh budget to aim for).
  const dynRes = createDynamicRes({ min: 0.6, onChange: () => applyResolution() });
  function applyResolution() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap) * sanitizeResScale(settings.renderScale, dynRes.scale));
    resize();
  }

  const state = { frame: 0, fps: 0, ready: false, t: 0, phase: 'title', paused: false };
  let game = null; // everything that exists once a run has begun

  function applySettings() {
    input.setBindings(settings.bindings);
    audio.setVolumes(settings.volume);
    ink.uniforms.uHalftoneAmount.value = settings.halftone;
    ink.setComic({ ...quality.comic, wobble: settings.lineWobble ? quality.comic.wobble : 0 });
    dynRes.setEnabled(settings.dynamicRes && params.get('dynres') !== '0');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality.pixelRatioCap) * sanitizeResScale(settings.renderScale, dynRes.scale));
    fpsEl.style.display = settings.showFps ? '' : 'none';
    fpsEl.classList.toggle('detail', settings.fpsDetails);
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
      percent: tracker.score(progress).percent,
      onContinue: () => begin(progress.suit ?? 'm', false),
      onNew: () => menus.suitSelect({ gold: progress.goldUnlocked, onPick: (s) => begin(s, true), onBack: showTitle }),
    });
  }

  // ---------------- a run ----------------
  function begin(suit, fresh) {
    menus.hide();
    audio.unlock();
    // Don't let the integrated-GPU hint sit over the boss bar once a run is under way.
    if (gpuHintBox) { gpuHintBox.remove(); gpuHintBox = null; }
    if (fresh) { progress = newGameProgress(progress); progress.stepId = null; }
    progress.suit = suit;
    saveProgress(storage, progress);
    game = buildRun(suit);
    input.setEnabled(true);
    state.phase = 'play';
    applySettings();
    // The run's own objects (hero, boss, pickups, effects) get the same treatment as the city at
    // boot; programs are mostly cached by now, so this is a short, one-off stall on the click.
    try { uploadTextures(renderer, scene); drawEverything(renderer, ink, scene, camera); } catch (err) { console.error(err); }
    mark('runWarm');
    game.flow.start();
  }

  function buildRun(suit) {
    const hero = createHero({ assets, suit, scene, collision: world.collision, events, climbables: world.climbables, settings });
    hero.teleport(SITES.start, Math.PI * 1.2);
    // Every clip a chain takedown plays gets its mixer action now, not on the first chain.
    hero.bat.animator.prime(chainClipNames());
    // The choke and the crouch get their mixer actions now, not on the first silent takedown.
    hero.bat.animator.prime(['Takedown_Choke', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop']);
    if (settings.difficulty === 'story') { hero.maxHealth = 150; hero.health = 150; }
    const follow = createFollowCamera(camera, world.collision);
    follow.configure(settings);
    follow.snapBehind(hero.bat.yaw);
    fill.intensity = 1.25;

    const hud = createHud(hudRoot);
    hud.setHealth(1);
    const comicFx = createComicFx(document.body);
    const fx = createFx(scene);
    const gfx = createGadgetFx(scene);
    const breakables = createBreakables({
      scene, collision: world.collision, climbables: world.climbables, progress, events, gfx,
      save: () => saveProgress(storage, progress),
    });
    const chainFx = createChainFx(scene);
    const rng = createRng(99);
    const combat = createCombat({ hero, follow, time, events, rng, reach, getDifficulty: () => settings.difficulty, getChainDiscount: () => 0 });
    hero.combat = combat;
    const key = (a) => `<kbd>${bindingLabel(settings.bindings, a)}</kbd>`;
    const screen = new THREE.Vector3();
    const toScreen = (v) => { screen.copy(v).project(camera); return { x: (screen.x * 0.5 + 0.5) * innerWidth, y: (-screen.y * 0.5 + 0.5) * innerHeight, behind: screen.z > 1 }; };

    let nextId = 0;
    const spawn = (type, p) => {
      const e = createEnemy({ id: `e${nextId++}`, type, assets, scene, collision: world.collision, rng });
      readyObjects(e.ch.root);
      e.place(p, Math.atan2(hero.pos.x - p.x, hero.pos.z - p.z) + rng.range(-1, 1));
      // A goon's first draw builds its bone textures and vertex bindings (~8 ms). A wave of four
      // in one frame is a visible hitch, so new goons join the scene one per frame instead.
      scene.remove(e.ch.root);
      toReveal.push(e);
      return e;
    };
    const toReveal = [];
    const despawn = (e) => {
      const i = toReveal.indexOf(e);
      if (i >= 0) toReveal.splice(i, 1);
      e.remove();
    };
    const encounters = createEncounters({ spawn, despawn, combat, events, collision: world.collision });
    const balloons = createBalloons(scene, progress.balloons);
    const pickups = createPickups(scene, world.halos, SITES);
    const neonParty = createNeonParty(scene, world.halos);
    const comic = createComic(document.body, { onSound: (n) => audio.play(n), onVoice: (id) => voice.say(id) });
    const prompts = createPromptQueue(hud, () => settings.bindings, () => settings.hints);
    const waypoint = createWaypoint(hudRoot.querySelector('.hud') ?? hudRoot);
    const beacon = createBeacon(scene);
    const boss = createBoss({ assets, scene, rng, combat, events, hud, spawn, despawn, hero, time, getDifficulty: () => settings.difficulty, collision: world.collision });
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

    // Late-bound: side content needs the flow, and the flow asks side content three questions.
    const sideHooks = { holdStory: () => false, marker: () => null, onRespawn: () => null };
    const flow = createFlow({
      hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups,
      collision: world.collision, follow, boss, finale, neonParty, side: sideHooks,
      onCredits: () => {
        document.exitPointerLock?.();
        input.setEnabled(false);
        menus.credits({ final: true, onClose: () => { menus.hide(); input.setEnabled(true); flow.freeRoam(); } });
      },
    });
    const side = createSideContent({
      scene, assets, hero, follow, combat, encounters, events, flow, prompts, progress, storage, rng,
      hudRoot: hudRoot.querySelector('.hud') ?? hudRoot, collision: world.collision, buildings: world.data.buildings,
    });
    Object.assign(sideHooks, side.flowHooks);
    const photo = createPhotoMode({
      root: document.body, camera, renderer, ink, scene, hero, input,
      sound: (n) => audio.play(n),
      getTime: () => state.t,
      getIssue: () => `No. ${progress.stats.photos + 1}`,
      onOpen: () => {
        state.paused = true;
        state.pauseMenu = false;
        input.setEnabled(false);
        document.exitPointerLock?.();
        document.body.classList.add('photo-on');
        events.emit('photoOpen');
      },
      onClose: () => { document.body.classList.remove('photo-on'); events.emit('photoClose'); resume(); },
      onSaved: () => { side.photoTaken(); events.emit('photoSaved'); },
    });

    // ---- HUD reactions ----
    events.on('impact', ({ pos, outcome }) => fx.impact(pos, outcome === 'hit' ? 0.7 : 1.1));
    // Dev only (dev server or ?god=1): contact-frame bookkeeping for tools/contact-shots.mjs,
    // and ?hitstop=<s> stretches every hit-stop so a screenshot lands inside the freeze.
    if (DEV_TOOLS) {
      events.on('impact', ({ move, outcome, target }) => { window.__impacts = (window.__impacts ?? 0) + 1; window.__lastImpact = { n: window.__impacts, move, outcome, target: target?.type ?? null, at: performance.now() }; });
      if (params.get('hitstop')) { const floor = Number(params.get('hitstop')), orig = time.hitStop; time.hitStop = (sec) => orig(Math.max(sec, floor)); }
    }
    events.on('word', ({ text, pos, big }) => { const p = toScreen(pos); if (!p.behind) hud.sfx(text, p.x, p.y, big); });
    events.on('zipOn', () => events.emit('word', { text: 'ZZZIP!', pos: hero.pos.clone().setY(hero.pos.y + 2), big: false }));
    events.on('diveStart', () => events.emit('word', { text: 'FWOOSH!', pos: hero.pos.clone(), big: false }));
    events.on('diveImpact', ({ pos, word }) => { if (word !== null) events.emit('word', { text: word ?? 'KA-THOOM!', pos, big: true }); });
    // hard THUD is the hero's own landing only; the boss emits 'land' too (boss.js) but has no `who`.
    events.on('land', ({ hard, who }) => { if (hard && who === 'hero') events.emit('word', { text: 'THUD', pos: hero.pos.clone(), big: false }); });
    events.on('critical', ({ variant } = {}) => hud.critical(variant));
    events.on('critical', ({ target } = {}) => {
      if (!settings.impactFrames) return;
      const p = target ? toScreen(target.pos.clone().setY(target.pos.y + 1)) : null;
      const at = p && !p.behind ? p : { x: innerWidth / 2, y: innerHeight / 2 };
      ink.impact(at.x / innerWidth, 1 - at.y / innerHeight);
    });
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
    const PROMPT_DONE = {
      throwRelease: 'throw', slam: 'slam', glideStart: 'glide', grapple: 'grapple', grappleBoost: 'grappleBoost', counter: 'counter', cape: 'cape',
      batarangThrow: 'batarang', dodge: 'dodge', special: 'special', jumpKick: 'kick',
      ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zip', wallRun: 'wallrun', diveStart: 'divebomb', takedown: 'takedown',
    };
    for (const [ev, id] of Object.entries(PROMPT_DONE)) events.on(ev, () => prompts.done(id));
    events.on('swing', ({ kind, finisher }) => { prompts.done(kind === 'kick' ? 'kick' : 'punch'); if (finisher) prompts.done('finisher'); });
    events.on('step', ({ step }) => {
      if (step.id === 'toDocks') {
        setTimeout(() => prompts.show(['detective', 'balloons']), 30000);
        setTimeout(() => prompts.show(['photo']), 120000);
      }
    });

    // Progress tracking (Plan 3C): one moveLearned event the first time each traversal move happens.
    const MOVE_IDS = { ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zipline', wallRun: 'wallrun', diveImpact: 'divebomb', throwRelease: 'throw', slam: 'slam', counter: 'counter' };
    onceEachId(events, MOVE_IDS, 'moveLearned');

    const sound = wireAudio({ audio, events, hero, combat, flow, settings, voice });
    sound.start();

    // ---- grapple targeting ----
    // Ledge-variant grapple points: every non-perch grapple point, dropped 0.1m so the vault
    // lands slightly short and finds a ledge to hang from instead of standing on top. Only
    // offered while the player holds `back` when the target is picked, so they don't crowd
    // out the normal landing points.
    const ledgeGrapplePoints = world.grapplePoints.filter((p) => !p.perch).map((p) => ({ ...p, y: p.y - 0.1, ledge: true }));
    const grapple = { target: null, timer: 0 };
    const eye = new THREE.Vector3(), camDir = new THREE.Vector3(), toPt = new THREE.Vector3();
    function pickGrapple(dt) {
      grapple.timer -= dt;
      if (grapple.timer > 0) return;
      grapple.timer = 0.1;
      if (hero.control) { grapple.target = null; return; }
      follow.lookDir(camDir);
      eye.copy(hero.pos); eye.y += 1.6;
      const points = input.down('back') ? ledgeGrapplePoints : world.grapplePoints;
      grapple.target = pickGrapplePoint(points, camera.position, camDir, hero.pos, {
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

    const ctx = { input, cam: follow, grappleTarget: null, fx, chainFx };
    let lastCombo = -1;
    let chainLabels = ['1', '2', '3'];
    let chainPromptShown = false;
    let detective = 0;
    let palT = 0;
    const palBuf = new Array(18).fill(0);
    // First-time traversal hints (ladder, zip, divebomb). Kept to one cheap pass every 0.5s
    // (including the divebomb altitude check, which calls hero.heightAboveGround(), a raycast,
    // so it must not run every frame), and each one stops checking once it has shown.
    let hintCheckT = 0;
    let glideHighT = 0;
    const hintShown = { ladder: false, zip: false, divebomb: false };

    function update(real) {
      if (toReveal.length) scene.add(toReveal.shift().ch.root);
      const playing = flow.mode === 'play' || flow.mode === 'dead';
      const dt = playing && !state.paused ? time.scale(real) : 0;
      if (playing && !state.paused) {
        if (input.pressed('photo') && flow.mode === 'play' && !hero.dead) { photo.open(); return; }
        if (input.pressed('detective')) state.detectiveOn = !state.detectiveOn;
        pickGrapple(real);
        // Grapple is only locked while a fight is actually around you.
        const busy = combat.enemies.some((e) => e.alive && e.aware && e.pos.distanceTo(hero.pos) < 12 && Math.abs(e.pos.y - hero.pos.y) < 4);
        ctx.grappleTarget = busy ? null : grapple.target;
        hintCheckT -= real;
        if (hintCheckT <= 0) {
          hintCheckT = 0.5;
          if (!hintShown.ladder) {
            for (const l of world.climbables.ladders) {
              const lx = l.x + l.nx * 0.45, lz = l.z + l.nz * 0.45;
              if (Math.hypot(hero.pos.x - lx, hero.pos.z - lz) < 6 && Math.abs(hero.pos.y - l.bottom) < 6) { prompts.show(['ladder']); hintShown.ladder = true; break; }
            }
          }
          if (!hintShown.zip && ctx.grappleTarget?.zip) { prompts.show(['zip']); hintShown.zip = true; }
          if (!hintShown.divebomb) {
            // Sampled once per throttle tick, not every frame: the timer advances by the
            // tick length instead of by `real`, so it still reads as "~3s continuously high".
            if (hero.state === 'glide' && hero.heightAboveGround() > 10) glideHighT += 0.5; else glideHighT = 0;
            if (glideHighT > 3) { prompts.show(['divebomb']); hintShown.divebomb = true; }
          }
          chainLabels = ['chain1', 'chain2', 'chain3'].map((a) => bindingLabel(settings.bindings, a));
        }
        combat.update(dt, ctx);
        hero.update(dt, ctx);
        side.update(dt, real, { toScreen });
        fx.update(dt);
        gfx.update(dt);
        chainFx.update(dt);
        breakables.update(state.t, hero.pos);
        if (hero.pos.y < -0.8) { hero.teleport(hero.lastSafe); events.emit('splash'); }
        follow.update(real, hero.pos, input.look, combat.cameraMode ?? hero.cameraMode(), hero.speed);
        comicFx.update(real, { speed: hero.control?.speed ?? Math.hypot(hero.vel.x, hero.vel.y, hero.vel.z), actionActive: follow.actionActive });
        palT -= real;
        if (palT <= 0) { palT = 0.25; ink.setPalette(paletteAt(camera.position.x, camera.position.z, palBuf)); }
        hero.updateCape(dt);
        boss.update(dt);
        if (boss.speech) { const p = toScreen(boss.headWorld(new THREE.Vector3())); hud.speechPos(p.x, p.y - 20, !p.behind); }
        if (combat.combo.value !== lastCombo) { lastCombo = combat.combo.value; hud.setCombo(lastCombo); }
        hud.setChains(combat.chains, chainLabels);
        if (!chainPromptShown && combat.chains.affordable.some(Boolean)) { chainPromptShown = true; prompts.show(['chain']); }
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
      } else {
        // Play stopped (paused, a cutscene, the finale) mid-effect: without this, speed lines or
        // the action panel border can freeze on screen instead of easing out.
        comicFx?.update(real, { speed: 0, actionActive: false });
      }
      detective += ((state.detectiveOn && playing ? 1 : 0) - detective) * Math.min(1, real * 6);
      ink.uniforms.uDetective.value = detective;
      if (flow.mode === 'finale') finale.update(real);
      else finale.update(state.paused ? 0 : real);
      flow.update(state.paused ? 0 : real, camera);
      sound.update(real);
    }

    const api = {
      hero, follow, combat, hud, comicFx, flow, encounters, balloons, boss, finale, comic, grapple, update, spawn, side, stage, gfx, breakables, chainFx, photo,
      winFight: () => { for (const e of combat.enemies) if (e.alive && e.type !== 'joker') { e.health = 0; e.applyHit({ outcome: 'ko' }, hero.pos); } },
    };
    if (params.get('god') === '1') events.on('heroHurt', () => { hero.health = hero.maxHealth; hud.setHealth(1); });
    if (DEV_TOOLS) window.__game.reach = reach;
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
    Object.assign(window.__game, api, { climbables: world.climbables, teleport: (site) => {
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
    menus.pause(pauseOptions());
  }
  // Built fresh on every pause so the info line and the challenge button are current.
  function pauseOptions() {
    const side = game.side;
    const opts = {
      onResume: resume,
      onRestart: () => { resume(); game.flow.respawn(); },
      onTitle: () => { location.search = ''; },
      info: side.pauseInfo(),
      onQuitChallenge: () => { side.challenges.quit(); resume(); },
      onChallenges: () => menus.challengesPage(side.challengesPage(), { onBack: () => menus.pause(opts), onRead: () => readPage('goldStandard', () => menus.pause(opts)) }),
      onProgress: () => menus.progressPage(side.progressPage(), { onBack: () => menus.pause(opts), onRead: () => readPage('fromKrishn', () => menus.pause(opts)) }),
      onPhoto: () => { menus.hide(); game.photo.open(); },
    };
    return opts;
  }
  // Reward comics open from the pause menu. stage.shot moves the camera for its panels, so the
  // paused view is put back before the comic shows.
  function readPage(kind, back) {
    menus.hide();
    const p = camera.position.clone(), q = camera.quaternion.clone();
    const pages = kind === 'goldStandard' ? goldStandardPages(game.stage) : fromKrishnPages(game.stage);
    camera.position.copy(p);
    camera.quaternion.copy(q);
    game.comic.play(pages).then(back);
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
    if (game?.photo.active) return;
    if (game?.comic.playing) {
      if (input.padButton(0)) game.comic.advance();
      if (input.padButton(1)) game.comic.skip();
      return;
    }
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
    if (e.target?.closest?.('input[type="text"], textarea')) return;
    if (game.photo.active) {
      if (settings.bindings.pause.includes(e.code) || settings.bindings.photo.includes(e.code)) { e.preventDefault(); game.photo.close(); }
      return;
    }
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

  window.__game = { state, renderer, ink, dynRes, camera, scene, world, input, events, audio, voice, settings, sites: SITES, time, get progress() { return progress; }, begin, lightningNow: () => { weather.next = 0; } };

  // ---------------- frame loop ----------------
  let last = performance.now(), fpsT = 0, fpsN = 0, errors = 0;
  let orbit = 0;
  const weather = { next: 6, flashT: 0 };
  function lightning(real) {
    weather.next -= real;
    if (weather.next <= 0) {
      weather.next = 9 + Math.random() * 12;
      weather.flashT = 0.26;
      if (game) game.hud.sfx('KRAKOOM!', innerWidth * (0.2 + Math.random() * 0.6), innerHeight * (0.12 + Math.random() * 0.15), true);
      setTimeout(() => events.emit('thunder'), 300 + Math.random() * 900);
    }
    if (weather.flashT > 0) weather.flashT -= real;
    const t = weather.flashT;
    const k = (t > 0.2 && t <= 0.26) || (t > 0.06 && t <= 0.1) ? 1 : 0;
    ink.uniforms.uFlash.value = k;
    world.setFlash(k);
  }
  let prevNow = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    try { step(now); } catch (err) { if (errors++ < 5) console.error(err); }
    dynRes.update(now - prevNow);
    prevNow = now;
    if (state.frame === 1) mark('firstFrame');
  }
  function step(now) {
    const real = Math.min(0.05, (now - last) / 1000);
    last = now;
    const photoOn = !!game?.photo.active;
    // Photo mode freezes time: rain, lightning, traffic and the ink's boiling line all hold still.
    if (!photoOn) state.t += real;
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
      if (photoOn) game.photo.update(real);
      focus = game.hero.pos;
    }
    padControls();
    if (!photoOn) lightning(real);
    world.update(state.t, photoOn ? 0 : real, focus, camera, game?.hero ?? null);
    ink.render(scene, camera, state.t);
    input.endFrame();
    audio.update(real);
    state.frame += 1;
    fpsT += real; fpsN += 1;
    // Refreshed four times a second: quick enough to see a stutter, slow enough to read.
    if (fpsT >= 0.25) {
      state.fps = Math.round(fpsN / fpsT); fpsT = 0; fpsN = 0;
      fpsNum.textContent = String(state.fps);
      if (settings.fpsDetails) fpsD.textContent = `${Math.round(settings.renderScale * dynRes.scale * 100)}% · ${gpuName}`;
    }
  }

  applySettings();
  onProgress(1);
  // Hidden frames under the loading screen: every texture and buffer uploaded and every shader
  // variant (shadow, normal pass, x-ray) built for the whole city and the warm cast, then one
  // real frame of the title view, so nothing compiles or uploads on first sight mid-play.
  camera.position.set(Math.sin(orbit) * 95, 82, Math.cos(orbit) * 95 + 10);
  camera.lookAt(-20, 60, -60);
  try {
    world.update(0, 0, camera.position, camera, null);
    uploadTextures(renderer, scene);
    drawEverything(renderer, ink, scene, camera);
    scene.remove(warmCast);
    ink.render(scene, camera, 0);
  } catch (err) { console.error(err); }
  scene.remove(warmCast);
  mark('prewarm');
  requestAnimationFrame(frame);
  state.ready = true;
  // The Joker's lines download while the title screen is up.
  setTimeout(() => voice.warm(), 1500);
  // Dev and test shortcuts skip the title: ?at=<step>, ?play=1, ?fight=test.
  if (params.has('at') || params.has('play') || params.has('fight') || params.has('new') && params.has('skip')) begin(params.get('suit') ?? progress.suit ?? 'm', false);
  else showTitle();
}
