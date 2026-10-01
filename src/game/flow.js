// Drives the story: objectives, fights, pickups, cutscenes, balloons, checkpoints, death.
import { STEPS, tutorialFor } from './story.js';
import { FIGHTS } from './fights.js';
import { SCENES } from './scenes.js';
import { createObjectives, checkpointFor } from './objectives.js';
import { SITES } from '../world/mapData.js';
import { saveProgress, BALLOON_COUNT } from '../core/save.js';
import MANSI from '../mansi.config.js';

// Part S mission types: async beats that finish on their own event instead of a site radius. Each
// tries the real system first (through window.__game, never captured at creation so it still works
// however late that part attaches itself) and falls back to a short timer, so the story always
// reaches credits with any subset of Vehicles, Batwing or Nightwing missing.
const ASYNC_TYPES = new Set(['radio', 'chase', 'battle', 'armada', 'crasher', 'ally', 'board']);
const DEGRADE_MS = 2200;
// A plain travel step may still finish while Mansi is driving or flying (that is the point of
// getting there). Every other kind of beat needs her on foot first (coordinator guidance,
// 2026-09-30): a cutscene, fight, boss, collect or any of these async ones except the three that
// put her IN a vehicle on purpose (chase, battle, armada) or ask her to get into one herself
// (board; forcing an exit here would fight its own "already driving? finish at once" check below).
const EXIT_VEHICLE_TYPES = new Set(['cutscene', 'fight', 'boss', 'radio', 'crasher', 'ally', 'interior', 'collect']);

export function createFlow(d) {
  const { hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups, collision, radio } = d;
  const side = d.side ?? { holdStory: () => false, marker: () => null, onRespawn: () => null };
  const objectives = createObjectives(STEPS, progress.step);
  let mode = 'play';
  let target = null;
  let fightStarted = false;
  let t = 0;

  const save = () => saveProgress(storage, progress);
  const theGame = () => (typeof window !== 'undefined' ? window.__game : null);

  function siteOf(s) {
    if (!s) return null;
    if (s.type === 'fight') return SITES[FIGHTS[s.fight].site];
    if (s.type === 'boss') return SITES.arena;
    return s.site ? SITES[s.site] : null;
  }

  // Where to put the hero when loading or after going down.
  function respawnPoint() {
    const s = objectives.step;
    if (s?.type === 'fight') {
      // Predator rooms respawn at their entry, above the room and out of sight.
      if (FIGHTS[s.fight].entry) return { ...SITES[FIGHTS[s.fight].entry] };
      const site = SITES[FIGHTS[s.fight].site];
      const r = FIGHTS[s.fight].radius + 3;
      const x = site.x, z = site.z + r;
      const y = collision.groundBelow(x, site.y + 4, z, 0.3);
      if (y > -Infinity && Math.abs(y - site.y) < 3) return { x, y, z };
      return { ...site };
    }
    const cp = checkpointFor(STEPS, objectives.index) ?? 'start';
    return { ...SITES[cp] };
  }

  // One synthetic "done" event per async step, whether the real system finished it or it degraded
  // to a timer. objectives.js matches these the same way either way. Deferred a tick: a real part
  // that reports done() synchronously (as 'ally' does below) must never re-enter enterStep() while
  // the step that triggered it is still being entered.
  function finishAsync(step, ok = true) { setTimeout(() => advance({ type: `${step.type}Done`, id: step.id, ok }), 0); }

  // Hands an async step to the real part if window.__game has it, wired to call `done` when that
  // part reports finished. Returns false (never having called anything) when the part, or the one
  // method this step needs, is not there yet.
  function tryReal(step, done) {
    const G = theGame();
    if (!G) return false;
    switch (step.type) {
      case 'chase':
        if (!G.vehicles?.startChase) return false;
        // Normal play: a 'board' step always runs first (see below), so Mansi is already driving
        // the Batmobile by the time this fires and startChase never has to place her at all. The
        // teleport-and-summon inside startChase only fires as a last-resort fallback (an old save
        // resuming mid-mission, say), never on the path a player actually takes.
        G.vehicles.startChase({ path: step.path ?? null, onDone: (r) => done(r?.ok !== false) });
        return true;
      case 'battle':
        // Same as chase: the 'board' step ahead of this one gets her into the Batmobile for real,
        // so startBattle's own teleport-and-summon is a fallback, not the normal path.
        if (!G.vehicles?.startBattle) return false;
        G.vehicles.startBattle({ site: siteOf(step), drones: step.drones ?? 6, onDone: (r) => done(r?.ok !== false) });
        return true;
      case 'armada':
        if (!G.batwing?.startArmada) return false;
        G.batwing.call?.();
        G.batwing.startArmada({ balloons: step.balloons ?? 12, onDone: (r) => done(r?.ok !== false) });
        return true;
      case 'crasher': {
        if (!G.nightwing?.spawn || !G.nightwing?.crasherFlee) return false;
        const p = SITES[step.at] ?? target ?? hero.pos;
        G.nightwing.spawn(p, 'crasher');
        const off = events.on('crasherEscaped', () => { off(); done(true); });
        setTimeout(() => G.nightwing?.crasherFlee(SITES[step.to] ?? p), 1200);
        return true;
      }
      case 'ally':
        if (!G.nightwing?.spawn) return false;
        G.nightwing.spawn(SITES[step.at] ?? hero.pos, 'ally');
        done(true);
        return true;
      // A real, player-driven "get in the car" beat (no teleport): the Batmobile parks itself at
      // the step's own site (vehicles.park, a short slide-in for drama), and the step only
      // completes once Mansi actually gets in it herself, at whatever pace she likes. Already
      // driving it (a save resumed mid-mission, or she never got out after the last mission):
      // finish at once, nothing to walk up to.
      case 'board': {
        if (!G.vehicles?.park) return false;
        if (G.vehicles.active === G.vehicles.batmobile) { done(true); return true; }
        const spot = siteOf(step);
        if (spot) G.vehicles.park(spot);
        const off = events.on('vehicleEnter', ({ kind }) => { if (kind === 'batmobile') { off(); done(true); } });
        return true;
      }
      default:
        return false;
    }
  }

  // A letterboxed in-engine camera moment (window.__game.cinematic, from the night branch) before
  // a step's own comic or dialogue. `step.cinematic` is either { shots, lines } (played as-is) or
  // { orbit: { center, radius, height, dur, opts }, lines } (an establishing arc). Degrades to an
  // already-resolved promise when the step has none, or the part isn't there.
  function playCinematicFor(step) {
    const spec = step.cinematic;
    if (!spec) return Promise.resolve();
    return new Promise((resolve) => {
      const C = theGame()?.cinematic;
      if (!C) { resolve(); return; }
      const opts = { lines: spec.lines ?? [], onDone: resolve };
      const shots = spec.reveal === 'nightwing' ? revealShots() : spec.shots;
      const started = spec.orbit
        ? C.orbit(spec.orbit.center, spec.orbit.radius, spec.orbit.height, spec.orbit.dur, { ...(spec.orbit.opts ?? {}), ...opts })
        : shots ? C.play(shots, opts) : false;
      if (!started) resolve();
    });
  }

  // The reveal: Nightwing steps out in front of her, unmasked, on ground at her own height (tried
  // ahead, then to either side, then behind, so never off the edge of a deck), and the camera
  // frames the pair over her right shoulder, with the follow camera already behind her, so the
  // hand-back never sweeps through her. Returns the shots, or null if he can't appear.
  function revealShots() {
    const G = theGame();
    if (!G?.nightwing?.spawn) return null;
    const h = hero.pos;
    let spot = null, yaw = hero.bat.yaw;
    for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const a = hero.bat.yaw + turn;
      const x = h.x + Math.sin(a) * 4.5, z = h.z + Math.cos(a) * 4.5;
      const gy = collision.groundBelow(x, h.y + 1.5, z, 0.3);
      if (gy > -Infinity && Math.abs(gy - h.y) < 0.6) { spot = { x, y: gy, z }; yaw = a; break; }
    }
    if (!spot) return null;
    hero.bat.face(yaw);
    d.follow?.snapBehind(yaw, 0.22);
    G.nightwing.spawn(spot, 'pose');
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -fz, rz = fx;
    const at = (back, side, up) => ({ x: h.x - fx * back + rx * side, y: h.y + up, z: h.z - fz * back + rz * side });
    return [{ from: at(2.6, 1.7, 2.1), to: at(1.5, 1.2, 1.8), look: { x: spot.x, y: spot.y + 1.45, z: spot.z }, dur: 5 }];
  }

  // Plays a step's radio lines (if any), then either lets the real part run or, when it (or the
  // whole module) is missing, completes on a short timer. A pure 'radio' beat is done as soon as
  // its lines finish: the dialogue was the whole mission.
  function startAsync(step) {
    const done = (ok = true) => finishAsync(step, ok);
    const afterCinematic = () => {
      const proceed = () => {
        if (step.type === 'radio') {
          // He walks off with the reveal: Act 3's title card covers it, and the plaza beat spawns him
          // again as an ally where he is needed.
          if (step.cinematic?.reveal === 'nightwing') theGame()?.nightwing?.despawn?.();
          done(true);
          return;
        }
        if (tryReal(step, done)) return;
        setTimeout(() => done(true), DEGRADE_MS);
      };
      if (step.lines?.length && radio) radio.say(step.lines).then(proceed);
      else proceed();
    };
    playCinematicFor(step).then(afterCinematic);
  }

  async function playScene(name) {
    mode = 'cutscene';
    document.exitPointerLock?.();
    hud.setVisible(false);
    radio?.skip(); // a comic page takes the whole screen; any dialogue beat still up steps aside
    events.emit('cutscene', { name, on: true });
    const pages = SCENES[name] ? SCENES[name](stage) : [];
    if (pages.length) await comic.play(pages);
    hud.setVisible(true);
    events.emit('cutscene', { name, on: false });
    mode = 'play';
  }

  function enterStep() {
    const s = objectives.step;
    progress.step = objectives.index;
    progress.stepId = s?.id ?? null;
    save();
    if (!s) return;
    if (EXIT_VEHICLE_TYPES.has(s.type)) {
      const G = theGame();
      if (G?.vehicles?.active) G.vehicles.exit();
      if (G?.batwing?.active) G.batwing.exit();
    }
    hud.setObjective(s.text ?? '');
    target = siteOf(s);
    fightStarted = false;
    waypoint.update(null);
    beacon.set(target);
    // A step's own tips go to the front, and anything queued two steps ago is dropped: a tip
    // should arrive while it still applies (see createPromptQueue).
    // face: turn her (and the camera behind her) toward a site as the step begins, e.g. away
    // from the Batsignal lamp she walked up to and toward the Docks she is about to head for.
    if (s.face && SITES[s.face]) {
      const p = SITES[s.face];
      const yaw = Math.atan2(p.x - hero.pos.x, p.z - hero.pos.z);
      hero.bat.face(yaw);
      d.follow?.snapBehind(yaw, 0.22);
    }
    // faceAwayFrom: step her back from something she walked right up to (the Batsignal lamp) and
    // turn her to the open view beyond it, so it isn't looming over the camera for the next beats.
    if (s.faceAwayFrom && SITES[s.faceAwayFrom]) {
      const p = SITES[s.faceAwayFrom];
      let dx = hero.pos.x - p.x, dz = hero.pos.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len; dz /= len;
      const back = s.stepBack ?? 0;
      if (back > 0) {
        const x = hero.pos.x + dx * back, z = hero.pos.z + dz * back;
        const gy = collision.groundBelow(x, hero.pos.y + 1.5, z, 0.3);
        if (gy > -Infinity && Math.abs(gy - hero.pos.y) < 0.6) hero.teleport({ x, y: gy, z });
      }
      const yaw = Math.atan2(dx, dz);
      hero.bat.face(yaw);
      d.follow?.snapBehind(yaw, 0.22);
    }
    prompts.newStep?.();
    const tips = tutorialFor(s, progress.moves);
    if (tips) prompts.show(tips, { first: true });
    events.emit('step', { step: s, index: objectives.index });
    if (s.type === 'fight') encounters.begin(s.fight);
    if (s.type === 'cutscene' && s.scene === 'finale') {
      radio?.skip();
      // mode stays 'play' through any cinematic first (same reason as the general cutscene branch
      // below): cinematic.update() only ticks under mode 'play'. Switch to 'finale' only once the
      // cinematic (if any) has handed off to the fireworks sequence itself.
      playCinematicFor(s).then(() => {
        mode = 'finale';
        document.exitPointerLock?.();
        hud.setVisible(false);
        return d.finale.play();
      }).then(() => { hud.setVisible(true); mode = 'play'; advance({ type: 'cutsceneDone', scene: 'finale' }); });
    } else if (s.type === 'cutscene') {
      const REWARD = { presents: 'presents', party: 'party', cake: 'cake' };
      if (s.scene === 'party') d.neonParty?.show();
      // mode stays 'play' while any cinematic plays first: cinematic.update() (src/game/game.js)
      // only ticks under mode 'play', since it manages its own pause (hero.frozen) rather than
      // needing flow's own cutscene mode. playScene() below still sets mode to 'cutscene' itself,
      // once the comic actually starts.
      playCinematicFor(s).then(() => playScene(s.scene)).then(() => {
        if (REWARD[s.scene]) pickups.hide(REWARD[s.scene]);
        advance({ type: 'cutsceneDone', scene: s.scene });
      });
    }
    if (s.type === 'boss') playScene('bossIntro').then(() => d.boss?.begin());
    if (ASYNC_TYPES.has(s.type)) startAsync(s);
    if (s.type === 'interior' && s.lines?.length) radio?.say(s.lines);
    if (s.type === 'credits') {
      progress.finished = true;
      save();
      mode = 'credits';
      d.onCredits?.();
    }
  }

  function advance(ev) {
    if (!objectives.handle(ev)) return false;
    events.emit('objectiveDone', ev);
    enterStep();
    return true;
  }

  events.on('fightStart', ({ id }) => {
    if (objectives.step?.fight !== id) return;
    fightStarted = true;
    beacon.set(null);
  });
  events.on('fightDone', ({ id }) => {
    hero.health = hero.maxHealth;
    hud.setHealth(1);
    setTimeout(() => encounters.cleanupBodies(), 5000);
    advance({ type: 'fightDone', id });
  });
  events.on('bossDefeated', async () => {
    hero.health = hero.maxHealth;
    await playScene('bossEnd');
    d.boss?.hide();
    advance({ type: 'bossDone' });
  });
  events.on('heroDown', () => {
    if (mode !== 'play') return;
    mode = 'dead';
    setTimeout(async () => {
      await playScene('death');
      respawn();
    }, 1500);
  });

  function respawn({ manual = false } = {}) {
    hero.dead = false;
    hero.health = hero.maxHealth;
    hud.setHealth(1);
    hud.clearGlyphs();
    const finished = objectives.done || STEPS[objectives.index]?.type === 'credits';
    // Side content first: it clears a crime fight or a challenge and may want the hero back at a
    // challenge marker instead of the story checkpoint. `manual` distinguishes a pause-menu
    // "Restart from checkpoint" (the hero was never actually knocked down) from a real death.
    const over = side.onRespawn({ manual });
    const p = over ?? (finished ? { ...SITES.start } : respawnPoint());
    // Face the objective, not whatever wall we happened to be looking at.
    const aim = over || finished ? null : target;
    const yaw = over?.yaw ?? (aim ? Math.atan2(aim.x - p.x, aim.z - p.z) : hero.bat.yaw);
    hero.teleport(p, yaw);
    const s = objectives.step;
    if (s?.type === 'fight') encounters.restart();
    if (s?.type === 'boss') d.boss?.restart();
    d.follow.snapBehind(hero.bat.yaw);
    mode = 'play';
  }

  function collectBalloon(index) {
    if (!progress.balloons.includes(index)) progress.balloons.push(index);
    const n = progress.balloons.length;
    const text = MANSI.balloonMessages[Math.min(n, BALLOON_COUNT) - 1];
    hud.setBalloons(n, BALLOON_COUNT);
    if (objectives.done || STEPS[objectives.index]?.type === 'credits') {
      const left = BALLOON_COUNT - n;
      hud.setObjective(left > 0 ? `Explore Gotham. ${left} birthday balloon${left === 1 ? '' : 's'} still hidden.` : 'All twelve found! The gold suit is waiting on the title screen.');
    }
    hud.card(`Balloon ${n} of ${BALLOON_COUNT}`, text);
    if (n >= BALLOON_COUNT) progress.goldUnlocked = true;
    save();
    events.emit('balloon', { index, count: n });
  }

  return {
    get mode() { return mode; },
    get objectives() { return objectives; },
    get target() { return target; },
    start() {
      if (objectives.done || STEPS[objectives.index]?.type === 'credits') {
        hud.setBalloons(progress.balloons.length, BALLOON_COUNT);
        pickups.restore(['presents', 'party', 'cake']);
        hero.teleport(SITES.start, hero.bat.yaw);
        this.freeRoam();
        return;
      }
      if (objectives.index > 0) hero.teleport(respawnPoint(), hero.bat.yaw);
      const got = STEPS.slice(0, objectives.index).filter((s) => s.type === 'collect').map((s) => s.item);
      pickups.restore(got);
      if (got.includes('party')) d.neonParty?.show();
      hud.setBalloons(progress.balloons.length, BALLOON_COUNT);
      enterStep();
    },
    update(dt, camera) {
      t += dt;
      if (mode !== 'play') return;
      const s = objectives.step;
      encounters.update(dt, hero);
      if (s && target && !side.holdStory() && s.type !== 'fight' && s.type !== 'boss' && s.type !== 'cutscene' && !ASYNC_TYPES.has(s.type)) {
        const dxz = Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z);
        const dy = Math.abs(hero.pos.y - target.y);
        // onFoot: only done once she is out of the car or plane ("get clear of the Batmobile").
        const G = s.onFoot ? theGame() : null;
        const mounted = !!(G?.vehicles?.active || G?.batwing?.active);
        if (dxz < (s.radius ?? 8) && dy < 6 && !mounted) {
          if (s.type === 'collect') { pickups.take(s.item); encounters.cleanupBodies(); events.emit('pickup', { item: s.item }); advance({ type: 'collected', item: s.item }); }
          else {
            if (s.type === 'interior') theGame()?.interiors?.enter?.(s.room);
            advance({ type: 'reached', step: s.id });
          }
        }
      }
      const near = target && Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z) < 7 && Math.abs(hero.pos.y - target.y) < 5;
      const showMarker = target && !near && !(s?.type === 'fight' && fightStarted) && s?.type !== 'cutscene' && s?.type !== 'boss';
      waypoint.update(side.marker() ?? (showMarker ? target : null), camera, hero.pos);
      beacon.update(t, hero.pos);
      const b = balloons.update(t, hero.pos);
      if (b >= 0) collectBalloon(b);
      pickups.update(t);
      prompts.update(dt);
      radio?.update(dt);
    },
    // After the credits: roam the city, finish the balloon hunt, watch the fireworks.
    freeRoam() {
      mode = 'play';
      target = null;
      beacon.set(null);
      const left = BALLOON_COUNT - progress.balloons.length;
      hud.setObjective(left > 0 ? `Explore Gotham. ${left} birthday balloon${left === 1 ? '' : 's'} still hidden.` : 'Gotham is safe. Enjoy the fireworks!');
      if (left > 0) prompts.show(['detective']);
      d.finale.freeRoam();
    },
    jumpTo(index) { objectives.jump(index); encounters.end(); enterStep(); hero.teleport(respawnPoint(), hero.bat.yaw); },
    respawn,
  };
}
