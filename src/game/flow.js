// Drives the story: objectives, fights, pickups, cutscenes, balloons, checkpoints, death.
import { STEPS } from './story.js';
import { FIGHTS } from './fights.js';
import { SCENES } from './scenes.js';
import { createObjectives, checkpointFor } from './objectives.js';
import { SITES } from '../world/mapData.js';
import { saveProgress, BALLOON_COUNT } from '../core/save.js';
import MANSI from '../mansi.config.js';

export function createFlow(d) {
  const { hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups, collision } = d;
  const objectives = createObjectives(STEPS, progress.step);
  let mode = 'play';
  let target = null;
  let fightStarted = false;
  let t = 0;

  const save = () => saveProgress(storage, progress);

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

  async function playScene(name) {
    mode = 'cutscene';
    document.exitPointerLock?.();
    hud.setVisible(false);
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
    save();
    if (!s) return;
    hud.setObjective(s.text ?? '');
    target = siteOf(s);
    fightStarted = false;
    waypoint.update(null);
    beacon.set(target);
    if (s.tutorial) prompts.show(s.tutorial);
    events.emit('step', { step: s, index: objectives.index });
    if (s.type === 'fight') encounters.begin(s.fight);
    if (s.type === 'cutscene') {
      playScene(s.scene).then(() => advance({ type: 'cutsceneDone', scene: s.scene }));
    }
    if (s.type === 'boss') d.boss?.begin();
    if (s.type === 'credits') { mode = 'credits'; d.onCredits?.(); }
  }

  function advance(ev) {
    if (!objectives.handle(ev)) return false;
    events.emit('objectiveDone', ev);
    enterStep();
    return true;
  }

  events.on('fightStart', () => { fightStarted = true; beacon.set(null); });
  events.on('fightDone', ({ id }) => {
    hero.health = hero.maxHealth;
    hud.setHealth(1);
    setTimeout(() => encounters.cleanupBodies(), 5000);
    advance({ type: 'fightDone', id });
  });
  events.on('bossDone', () => advance({ type: 'bossDone' }));
  events.on('heroDown', () => {
    if (mode !== 'play') return;
    mode = 'dead';
    setTimeout(async () => {
      await playScene('death');
      respawn();
    }, 1500);
  });

  function respawn() {
    hero.dead = false;
    hero.health = hero.maxHealth;
    hud.setHealth(1);
    const p = respawnPoint();
    hero.teleport(p, hero.bat.yaw);
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
      if (objectives.index > 0) hero.teleport(respawnPoint(), hero.bat.yaw);
      pickups.restore(STEPS.slice(0, objectives.index).filter((s) => s.type === 'collect').map((s) => s.item));
      hud.setBalloons(progress.balloons.length, BALLOON_COUNT);
      enterStep();
    },
    update(dt, camera) {
      t += dt;
      if (mode !== 'play') return;
      const s = objectives.step;
      encounters.update(dt, hero);
      if (s && target && s.type !== 'fight' && s.type !== 'boss' && s.type !== 'cutscene') {
        const dxz = Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z);
        const dy = Math.abs(hero.pos.y - target.y);
        if (dxz < (s.radius ?? 8) && dy < 6) {
          if (s.type === 'collect') { pickups.take(s.item); events.emit('pickup', { item: s.item }); advance({ type: 'collected', item: s.item }); }
          else advance({ type: 'reached', step: s.id });
        }
      }
      const showMarker = target && !(s?.type === 'fight' && fightStarted) && s?.type !== 'cutscene';
      waypoint.update(showMarker ? target : null, camera, hero.pos);
      beacon.update(t, hero.pos);
      const b = balloons.update(t, hero.pos);
      if (b >= 0) collectBalloon(b);
      pickups.update(t);
      prompts.update(dt);
    },
    jumpTo(index) { objectives.jump(index); encounters.end(); enterStep(); hero.teleport(respawnPoint(), hero.bat.yaw); },
    respawn,
  };
}
