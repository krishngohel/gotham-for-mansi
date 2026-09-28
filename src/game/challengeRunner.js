// Runs one challenge at a time: the start pillars, the 3-2-1 countdown, rings or checkpoints,
// results and medals. The arena (arenaChallenge.js) plugs in through registerKind.
import * as THREE from 'three';
import MANSI from '../mansi.config.js';
import {
  CHALLENGES, MEDAL_NAME, MOVE_LABEL, pillarPos, createRingRun, createCheckpointRun, recordResult, allGold, formatResult, formatTime,
} from './challenges.js';
import { createPillar, createRingMesh } from '../world/sideProps.js';

const START_RADIUS = 2.2;
const BEAT = 0.8;
const COUNT = ['3', '2', '1', 'GO!'];
const MOVE_EVENTS = { ladderOn: 'ladder', ledgeGrab: 'ledge', zipOn: 'zipline', wallRun: 'wallrun' };
const FAIL_TEXT = {
  quit: 'Challenge quit.',
  water: 'Into the water. Challenge failed.',
  down: 'Knocked out. Challenge failed.',
  time: 'Out of time. Challenge failed.',
  fight: 'A fight broke out. Challenge called off.',
};
const pointsOf = (ch) => (ch.kind === 'rings' ? ch.rings : ch.kind === 'parkour' ? ch.checkpoints : []);

export function createChallengeRunner({ scene, hero, follow, events, ui, progress, save, canStart, hidden = () => false }) {
  const pillars = CHALLENGES.map((ch) => {
    const at = pillarPos(ch);
    const mesh = createPillar();
    mesh.position.set(at.x, at.y, at.z);
    scene.add(mesh);
    return { ch, at, mesh };
  });
  // Every hoop exists from the start (hidden) so begin()'s warm-up draw uploads it.
  const hoops = [];
  const most = Math.max(...CHALLENGES.map((c) => pointsOf(c).length));
  for (let i = 0; i < most; i++) { const m = createRingMesh(); m.visible = false; scene.add(m); hoops.push(m); }

  const kinds = {};
  const prev = new THREE.Vector3();
  const a = { x: 0, y: 0, z: 0 }, b = { x: 0, y: 0, z: 0 };
  let run = null;
  let armed = true;
  let blockedHint = false;
  let respawnAt = null;
  let t = 0;

  function layout(ch) {
    const lift = ch.kind === 'parkour' ? 1.6 : 0;
    pointsOf(ch).forEach((p, i) => {
      const m = hoops[i];
      m.userData.base = ch.kind === 'parkour' ? 1.6 : p.r;
      m.scale.setScalar(m.userData.base);
      m.position.set(p.x, p.y + lift, p.z);
      m.lookAt(p.x + p.nx, p.y + lift + p.ny, p.z + p.nz);
    });
  }
  function tint(next) {
    for (let i = 0; i < run.count; i++) hoops[i].userData.setState(i < next ? 'done' : i === next ? 'next' : 'later');
  }
  function hideHoops() { for (const m of hoops) m.visible = false; }

  function start(ch) {
    events.emit('challengeStart', { id: ch.id });
    respawnAt = null;
    run = { ch, phase: 'countdown', t: 0, beat: -1, logic: null, count: pointsOf(ch).length };
    hero.teleport(ch.start, ch.start.yaw);
    follow.snapBehind(ch.start.yaw);
    // Holds the hero still until GO.
    hero.control = { name: 'countdown', update: () => !run || run.phase !== 'countdown' };
    if (run.count) { layout(ch); tint(0); }
    ui.challenge(ch.name);
    ui.timer(ch.kind === 'arena' ? '0' : formatTime(0), ch.blurb);
    kinds[ch.kind]?.prepare?.(run);
  }

  function beginRunning() {
    run.phase = 'running';
    prev.copy(hero.pos);
    if (run.ch.kind === 'rings') run.logic = createRingRun(run.ch);
    else if (run.ch.kind === 'parkour') run.logic = createCheckpointRun(run.ch);
    kinds[run.ch.kind]?.begin?.(run);
  }

  function end() {
    if (!run) return;
    kinds[run.ch.kind]?.end?.(run);
    if (hero.control?.name === 'countdown') hero.control = null;
    hideHoops();
    ui.clearChallenge();
    run = null;
    armed = false;
  }

  function finish(value) {
    if (!run) return;
    const ch = run.ch;
    const res = recordResult(progress.challenges, ch, value);
    progress.challenges[ch.id] = res.entry;
    let unlocked = false;
    if (!progress.unlocks.includes('goldStandard') && allGold(progress.challenges)) { progress.unlocks.push('goldStandard'); unlocked = true; }
    save();
    const medal = res.medal ? `${MEDAL_NAME[res.medal]}!` : 'No medal this time.';
    ui.toast(ch.name, `${medal} ${formatResult(ch, value)}.${res.newBest ? ' New best!' : ''}`, 6500);
    events.emit('challengeDone', { id: ch.id, value, medal: res.medal, newBest: res.newBest });
    if (unlocked) {
      events.emit('unlock', { id: 'goldStandard' });
      setTimeout(() => ui.toast(`${MANSI.name}'s Gold Standard`, 'Gold in every challenge. A new comic page is waiting in the Challenges menu.', 8000), 7000);
    }
    end();
  }

  function fail(reason) {
    if (!run) return;
    const ch = run.ch;
    ui.toast(ch.name, FAIL_TEXT[reason] ?? FAIL_TEXT.quit, 4000);
    events.emit('challengeFail', { id: ch.id, reason });
    end();
    // Knocked out: the death comic plays first, then flow.respawn asks takeRespawn(). A story
    // fight that woke up: stay and fight it. Anything else: straight back to the marker.
    if (reason === 'down') respawnAt = { ...ch.start };
    else if (reason !== 'fight') { hero.teleport(ch.start, ch.start.yaw); follow.snapBehind(ch.start.yaw); }
  }

  events.on('splash', () => { if (run) fail('water'); });
  events.on('heroDown', () => { if (run) fail('down'); });
  events.on('fightStart', ({ id }) => { if (run && !kinds[run.ch.kind]?.ownsFight?.(id)) fail('fight'); });
  for (const [ev, id] of Object.entries(MOVE_EVENTS)) events.on(ev, () => run?.logic?.noteMove?.(id));

  function checkPillars(dt) {
    const hide = hidden();
    let near = null;
    for (const p of pillars) {
      p.mesh.visible = !hide;
      p.mesh.userData.bat.rotation.y += dt * 1.5;
      p.mesh.userData.xray.rotation.y = p.mesh.userData.bat.rotation.y;
      if (!hide && Math.hypot(hero.pos.x - p.at.x, hero.pos.z - p.at.z) < START_RADIUS && Math.abs(hero.pos.y - p.at.y) < 2.5) near = p;
    }
    if (!near) { armed = true; blockedHint = false; return; }
    if (!armed) return;
    if (canStart(near.ch)) { armed = false; start(near.ch); }
    else if (!blockedHint) { blockedHint = true; ui.hint('Not now. Finish what you are doing first.', 2500); }
  }

  function update(dt) {
    t += dt;
    if (!run) { checkPillars(dt); return; }
    if (run.phase === 'countdown') {
      run.t += dt;
      const beat = Math.min(COUNT.length - 1, Math.floor(run.t / BEAT));
      if (beat !== run.beat) { run.beat = beat; ui.countdown(COUNT[beat]); events.emit('countdown', { beat }); }
      if (run.t >= BEAT * (COUNT.length - 1)) beginRunning();
      return;
    }
    const ch = run.ch;
    if (ch.kind === 'rings') {
      a.x = prev.x; a.y = prev.y + 1; a.z = prev.z;
      b.x = hero.pos.x; b.y = hero.pos.y + 1; b.z = hero.pos.z;
      prev.copy(hero.pos);
      const r = run.logic.update(dt, a, b);
      if (r) { tint(run.logic.next); events.emit('ringPass', { index: run.logic.next - 1 }); }
      if (r === 'finish') { finish(run.logic.time); return; }
      ui.timer(formatTime(run.logic.time), `Ring ${run.logic.next + 1} of ${run.logic.total}`);
    } else if (ch.kind === 'parkour') {
      const cp = ch.checkpoints[run.logic.next];
      const r = run.logic.update(dt, hero.pos);
      if (r === 'needs') ui.hint(`Use a ${MOVE_LABEL[cp.needs]} to reach this checkpoint.`, 3500);
      if (r === 'checkpoint') { tint(run.logic.next); events.emit('checkpoint', { index: run.logic.next - 1 }); }
      if (r === 'finish') { finish(run.logic.time); return; }
      const nextCp = ch.checkpoints[run.logic.next];
      ui.timer(formatTime(run.logic.time), `${run.logic.next + 1} of ${run.logic.total}: ${nextCp.label}`);
    } else {
      kinds[ch.kind]?.update?.(run, dt);
    }
    if (!run) return;
    if (ch.limit && run.logic && run.logic.time > ch.limit) { fail('time'); return; }
    const m = run.logic ? hoops[run.logic.next] : null;
    if (m?.visible) m.scale.setScalar(m.userData.base * (1 + 0.05 * Math.sin(t * 6)));
  }

  return {
    pillars,
    get active() { return !!run; },
    get running() { return run?.phase === 'running'; },
    get current() { return run?.ch ?? null; },
    get debug() { return run ? { id: run.ch.id, phase: run.phase, next: run.logic?.next ?? 0, time: run.logic?.time ?? run.t } : null; },
    update,
    // Dev hook and scripted runs: starts without walking into the pillar or checking canStart.
    start(id) { const ch = CHALLENGES.find((c) => c.id === id); if (ch && !run) start(ch); return !!ch; },
    quit() { fail('quit'); },
    // flow.respawn asks this after a knockout or a "Restart from checkpoint". A checkpoint
    // restart mid-run counts as quitting the challenge, so it gets the same toast/event as the
    // pause menu's "Quit challenge" button instead of silently vanishing.
    takeRespawn() {
      if (run) { const ch = run.ch; fail('quit'); return { ...ch.start }; }
      const r = respawnAt;
      respawnAt = null;
      return r;
    },
    // The objective marker points at the next hoop during a run (waypoint adds 1.5 m).
    nextMarker() {
      if (!run?.logic) return null;
      const p = pointsOf(run.ch)[run.logic.next];
      return p ? { x: p.x, y: p.y - 1.5, z: p.z } : null;
    },
    registerKind(kind, hooks) { kinds[kind] = hooks; },
    finish,
    fail,
  };
}
