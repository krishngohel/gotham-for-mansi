// Runs one fight at a time: spawns the goons where they wait, wakes them when the hero arrives,
// brings in later waves, and reports when the fight is won.
import { FIGHTS } from './fights.js';
import { SITES } from '../world/mapData.js';

export function createEncounters({ spawn, despawn, combat, events, collision }) {
  let fight = null;
  let id = null;
  let wave = 0;
  let live = [];
  let dead = [];
  let triggered = false;
  let nextWaveT = 0;

  function placeWave(index, awake) {
    const site = SITES[fight.site];
    const made = fight.waves[index].map(({ type, dx, dz }) => {
      const x = site.x + dx, z = site.z + dz;
      const y = collision.groundBelow(x, site.y + 3, z, 0.3);
      return spawn(type, { x, y: y > -Infinity ? y : site.y, z }, site);
    });
    live.push(...made);
    combat.setEnemies([...live]);
    if (awake) for (const e of made) e.wake();
    return made;
  }

  function clear() {
    for (const e of [...live, ...dead]) despawn(e);
    live = []; dead = [];
    combat.setEnemies([]);
  }

  return {
    get id() { return id; },
    get active() { return triggered && !!fight; },
    get enemies() { return live; },
    // Sets up a fight: goons wait at their spots until the hero shows up.
    begin(fightId) {
      clear();
      id = fightId;
      fight = FIGHTS[fightId];
      wave = 0;
      triggered = false;
      placeWave(0, false);
    },
    restart() {
      if (!id) return;
      const f = id;
      this.begin(f);
    },
    end() { clear(); fight = null; id = null; triggered = false; },
    trigger() {
      if (!fight || triggered) return;
      triggered = true;
      for (const e of live) e.wake();
      events.emit('fightStart', { id });
    },
    update(dt, hero) {
      if (!fight) return;
      const site = SITES[fight.site];
      if (!triggered) {
        const d = Math.hypot(hero.pos.x - site.x, hero.pos.z - site.z);
        if (d < fight.radius && Math.abs(hero.pos.y - site.y) < 7) this.trigger();
        // Getting hit (or hitting someone) also starts the fight.
        if (live.some((e) => e.aware)) this.trigger();
        return;
      }
      // Move KO'd goons out of the active list.
      for (const e of live) if (!e.alive) dead.push(e);
      const before = live.length;
      live = live.filter((e) => e.alive);
      if (live.length !== before) combat.setEnemies([...live, ...dead]);
      if (live.length === 0) {
        if (wave + 1 < fight.waves.length) {
          nextWaveT += dt;
          if (nextWaveT > 1.4) {
            nextWaveT = 0;
            wave += 1;
            const made = placeWave(wave, true);
            combat.setEnemies([...live, ...dead]);
            events.emit('wave', { id, wave, count: made.length });
          }
        } else {
          const done = id;
          fight = null;
          triggered = false;
          events.emit('fightDone', { id: done });
        }
      }
    },
    cleanupBodies() { for (const e of dead) despawn(e); dead = []; },
  };
}
