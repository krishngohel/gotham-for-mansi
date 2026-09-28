// Drives the story: objectives, fights, pickups, cutscenes, balloons, checkpoints, death.
import { STEPS, tutorialFor } from './story.js';
import { FIGHTS } from './fights.js';
import { SCENES } from './scenes.js';
import { createObjectives, checkpointFor } from './objectives.js';
import { SITES } from '../world/mapData.js';
import { saveProgress, BALLOON_COUNT } from '../core/save.js';
import MANSI from '../mansi.config.js';

export function createFlow(d) {
  const { hero, encounters, hud, events, progress, storage, comic, stage, prompts, waypoint, beacon, balloons, pickups, collision } = d;
  const side = d.side ?? { holdStory: () => false, marker: () => null, onRespawn: () => null };
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
    progress.stepId = s?.id ?? null;
    save();
    if (!s) return;
    hud.setObjective(s.text ?? '');
    target = siteOf(s);
    fightStarted = false;
    waypoint.update(null);
    beacon.set(target);
    const tips = tutorialFor(s, progress.moves);
    if (tips) prompts.show(tips);
    events.emit('step', { step: s, index: objectives.index });
    if (s.type === 'fight') encounters.begin(s.fight);
    if (s.type === 'cutscene' && s.scene === 'finale') {
      mode = 'finale';
      document.exitPointerLock?.();
      hud.setVisible(false);
      d.finale.play().then(() => { hud.setVisible(true); mode = 'play'; advance({ type: 'cutsceneDone', scene: 'finale' }); });
    } else if (s.type === 'cutscene') {
      const REWARD = { presents: 'presents', party: 'party', cake: 'cake' };
      if (s.scene === 'party') d.neonParty?.show();
      playScene(s.scene).then(() => {
        if (REWARD[s.scene]) pickups.hide(REWARD[s.scene]);
        advance({ type: 'cutsceneDone', scene: s.scene });
      });
    }
    if (s.type === 'boss') playScene('bossIntro').then(() => d.boss?.begin());
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
      if (s && target && !side.holdStory() && s.type !== 'fight' && s.type !== 'boss' && s.type !== 'cutscene') {
        const dxz = Math.hypot(hero.pos.x - target.x, hero.pos.z - target.z);
        const dy = Math.abs(hero.pos.y - target.y);
        if (dxz < (s.radius ?? 8) && dy < 6) {
          if (s.type === 'collect') { pickups.take(s.item); encounters.cleanupBodies(); events.emit('pickup', { item: s.item }); advance({ type: 'collected', item: s.item }); }
          else advance({ type: 'reached', step: s.id });
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
