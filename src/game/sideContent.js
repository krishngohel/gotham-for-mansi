// Side content glue: play stats, districts and moves for the Progress page, milestone captions,
// and (Tasks 11 to 15) challenges, street crimes and the menu pages. The story flow sees side
// content only through flowHooks.
import * as THREE from 'three';
import { districtAt } from '../world/mapData.js';
import { DISTRICT_IDS, saveProgress } from '../core/save.js';
import { tracker, milestonesCrossed } from './progressTracker.js';
import { createPlayStats } from './playStats.js';
import { createSideHud } from '../ui/sideHud.js';
import { CHALLENGES, pillarPos } from './challenges.js';
import { createChallengeRunner } from './challengeRunner.js';
import { attachArena } from './arenaChallenge.js';
import { CRIME_SPOTS, isCrimeId } from './crimes.js';

export const MILESTONE_TEXT = {
  25: 'A quarter of Gotham, handled. The Joker has started to notice.',
  50: 'Halfway there. Gotham is sleeping a little easier tonight.',
  75: 'Three quarters done. This city owes you a very large cake.',
  100: 'One hundred percent. A page has been left for you in the Progress menu.',
};

export function createSideContent(deps) {
  const { scene, hero, follow, combat, encounters, events, flow, hudRoot, prompts, progress, storage } = deps;
  const save = () => saveProgress(storage, progress);
  const ui = createSideHud(hudRoot);
  const stats = createPlayStats(progress.stats);
  const last = new THREE.Vector3().copy(hero.pos);
  let dirty = true, districtT = 0, saveT = 0;

  const stepType = () => flow.objectives.step?.type ?? null;
  const offLimits = () => ['boss', 'cutscene'].includes(stepType());
  const challenges = createChallengeRunner({
    scene, hero, follow, events, ui, progress, save,
    hidden: offLimits,
    // Not in a fight or cutscene, including mid-story. The arena also needs the encounter
    // system free (a waiting crime squad is fine: the crime is called off at the start).
    canStart: (ch) => flow.mode === 'play' && !hero.dead && !offLimits() && !combat.active && !encounters.active
      && (ch.kind !== 'arena' || !encounters.id || isCrimeId(encounters.id)),
  });
  attachArena(challenges, { events, encounters, ui });
  const MARKER_RANGE = 60;
  const tmp = new THREE.Vector3();
  let pillarHint = false;
  // Bat markers over pillars within 60 m (the spec's "HUD shows them when you're within 60 m").
  function markers(toScreen) {
    for (const p of challenges.pillars) {
      const far = Math.hypot(hero.pos.x - p.at.x, hero.pos.z - p.at.z) > MARKER_RANGE;
      if (challenges.active || far || !p.mesh.visible) { ui.marker(p.ch.id, 0, 0, false); continue; }
      const s = toScreen(tmp.set(p.at.x, p.at.y + 3.6, p.at.z));
      ui.marker(p.ch.id, s.x, s.y, !s.behind, progress.challenges[p.ch.id]?.medal ?? null);
      if (!s.behind && !pillarHint) { pillarHint = true; prompts.show(['challenges']); }
    }
  }

  events.on('ko', () => stats.ko());
  events.on('takedown', () => stats.ko());
  events.on('moveLearned', ({ id }) => {
    if (progress.moves.includes(id)) return;
    progress.moves.push(id);
    save();
    dirty = true;
  });
  for (const ev of ['balloon', 'objectiveDone', 'challengeDone', 'crimeStopped']) events.on(ev, () => { dirty = true; });

  // Captions at 25, 50, 75 and 100%. progress.milestone remembers the highest one shown, so a
  // new post-game category that lowers the percentage never replays them.
  function checkMilestones() {
    dirty = false;
    const crossed = milestonesCrossed(progress.milestone, tracker.score(progress).percent);
    if (!crossed.length) return;
    const top = crossed[crossed.length - 1];
    progress.milestone = top;
    if (top === 100 && !progress.unlocks.includes('fromKrishn')) {
      progress.unlocks.push('fromKrishn');
      events.emit('unlock', { id: 'fromKrishn' });
    }
    save();
    ui.toast(`${top}% complete`, MILESTONE_TEXT[top], 7000);
    events.emit('milestone', { percent: top });
  }

  function visitDistrict() {
    const d = districtAt(hero.pos.x, hero.pos.z);
    if (!DISTRICT_IDS.includes(d) || progress.districts.includes(d)) return;
    progress.districts.push(d);
    save();
    dirty = true;
    events.emit('districtVisited', { id: d });
  }

  return {
    ui,
    stats,
    score: () => tracker.score(progress),
    // dt is game time (slow motion and hit-stop included), real is wall time.
    update(dt, real, view) {
      stats.tick(real);
      stats.combo(combat.combo.value);
      if (hero.state === 'glide') stats.glide(hero.glide.speed, Math.hypot(hero.pos.x - last.x, hero.pos.z - last.z));
      last.copy(hero.pos);
      districtT -= real;
      if (districtT <= 0) { districtT = 0.5; visitDistrict(); }
      challenges.update(dt); markers(view.toScreen);
      if (dirty) checkMilestones();
      saveT += real;
      if (saveT > 20) { saveT = 0; save(); }
    },
    challenges,
    data: { CHALLENGES, CRIME_SPOTS, pillarPos },
    flowHooks: {
      holdStory: () => challenges.active,
      marker: () => (challenges.active ? challenges.nextMarker() : null),
      onRespawn: () => challenges.takeRespawn(),
    },
    pauseInfo: () => ({ challenge: challenges.current?.name ?? null, crimesStopped: progress.crimes.stopped, percent: tracker.score(progress).percent }),
    photoTaken() { stats.photo(); save(); },
  };
}
