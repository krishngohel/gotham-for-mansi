// Street crimes at runtime: spawns the squad (through the encounter system) and the scene props,
// calls it in over the police radio, points the objective marker at it, expires it after 3
// minutes and counts the ones you stop.
import { SITES } from '../world/mapData.js';
import { createCrimeScheduler, crimeFight, crimeTitle, DISTRICT_LABEL } from './crimes.js';
import { createVan, createLootBags } from '../world/sideProps.js';
import { createGoon } from '../actors/characters.js';
import { readyObjects } from '../render/prewarm.js';

const RADIO = 'POLICE RADIO';

export function createCrimeDirector({ scene, assets, rng, events, encounters, ui, progress, save, collision, blocked, avoid = () => null }) {
  const scheduler = createCrimeScheduler({ rng });
  // Props and the civilian are built once, hidden, and reused, so begin()'s warm-up draw covers them.
  const van = createVan();
  const loot = createLootBags();
  const civilian = createGoon(assets, { type: 'civilian', rng });
  readyObjects(civilian.root);
  for (const o of [van, loot, civilian.root]) { o.visible = false; scene.add(o); }
  let civilianT = 0;

  const groundAt = (s) => {
    const y = collision.groundBelow(s.x, s.y + 3, s.z, 0.3);
    return y > -Infinity ? y : s.y;
  };

  function place(c) {
    const s = c.spot, y = groundAt(s);
    encounters.begin(c.fightId, crimeFight(c.kind, { ...s, y }, rng));
    if (c.kind === 'van') {
      van.position.set(s.x + Math.cos(s.yaw) * 3, y, s.z - Math.sin(s.yaw) * 3);
      van.rotation.y = s.yaw;
      van.visible = true;
    } else if (c.kind === 'robbery') {
      loot.position.set(s.x, y, s.z);
      loot.visible = true;
    } else {
      civilian.root.position.set(s.x, y, s.z);
      civilian.root.visible = true;
      civilian.animator.play('Crouch_Idle_Loop', { fade: 0 });
    }
    ui.radio(RADIO, crimeTitle(c.kind, s.district), 6500);
    events.emit('crimeSpawn', { id: c.id, kind: c.kind, district: s.district });
  }

  function clearProps(civilianDelay = 0) {
    van.visible = false;
    loot.visible = false;
    if (civilianDelay > 0) civilianT = civilianDelay;
    else civilian.root.visible = false;
  }

  function drop(outcome, caption) {
    const c = scheduler.active;
    if (!c) return;
    if (encounters.id === c.fightId) encounters.end();
    clearProps();
    scheduler.resolve();
    if (caption) ui.radio(RADIO, caption, 4500);
    events.emit('crimeEnd', { id: c.id, outcome });
  }

  events.on('fightStart', ({ id }) => { if (scheduler.active?.fightId === id) scheduler.engage(); });
  events.on('fightDone', ({ id }) => {
    const c = scheduler.active;
    if (!c || c.fightId !== id) return;
    scheduler.resolve();
    progress.crimes.stopped += 1;
    save();
    if (c.kind === 'mugging') civilian.animator.play('Yes', { once: true, fade: 0.2 });
    clearProps(c.kind === 'mugging' ? 4 : 0);
    ui.toast('Crime stopped', `${DISTRICT_LABEL[c.spot.district]} is a little safer. Crimes stopped: ${progress.crimes.stopped}.`, 5000);
    events.emit('crimeStopped', { count: progress.crimes.stopped });
    events.emit('crimeEnd', { id: c.id, outcome: 'stopped' });
  });
  // A story fight, the boss or a cutscene calls the crime off, and so does a new objective that
  // lands on top of it (the story path must never run through a waiting squad).
  events.on('step', ({ step }) => {
    const c = scheduler.active;
    if (!c) return;
    const site = step.site ? SITES[step.site] : null;
    const close = site && Math.hypot(site.x - c.spot.x, site.z - c.spot.z) < 60;
    if (['fight', 'boss', 'cutscene'].includes(step.type) || close) drop('cancelled', null);
  });
  events.on('challengeStart', () => drop('cancelled', null));

  return {
    get active() { return scheduler.active; },
    update(dt, heroPos, visited) {
      const r = scheduler.update(dt, { blocked: blocked(), visited, heroPos, avoid: avoid() });
      if (r?.type === 'spawn') place(r.crime);
      else if (r?.type === 'expire') {
        if (encounters.id === r.crime.fightId) encounters.end();
        clearProps();
        ui.radio(RADIO, 'Too late. The goons got away.', 4500);
        events.emit('crimeEnd', { id: r.crime.id, outcome: 'expired' });
      }
      if (civilian.root.visible) {
        civilian.animator.update(dt);
        if (civilianT > 0 && (civilianT -= dt) <= 0) civilian.root.visible = false;
      }
    },
    marker() { const c = scheduler.active; return c && !c.engaged ? c.spot : null; },
    holdStory() { return !!scheduler.active?.engaged; },
    onRespawn() { if (scheduler.active?.engaged) drop('failed', 'The goons got away while you were down.'); },
    force(opts) { scheduler.force(opts); },
  };
}
