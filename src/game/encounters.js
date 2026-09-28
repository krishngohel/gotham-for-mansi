// Runs one fight at a time: spawns the goons where they wait, wakes them when the hero arrives,
// brings in later waves, and reports when the fight is won.
import { FIGHTS } from './fights.js';
import { SITES } from '../world/mapData.js';

const siteOf = (f) => (typeof f.site === 'string' ? SITES[f.site] : f.site);

export function createEncounters({ spawn, despawn, combat, events, collision, stealth = null }) {
  let fight = null;
  let def = null;
  let id = null;
  let wave = 0;
  let live = [];
  let dead = [];
  let triggered = false;
  let nextWaveT = 0;

  function placeWave(index, awake) {
    const site = siteOf(fight);
    const made = fight.waves[index].map(({ type, dx, dz, y: wy }) => {
      const x = site.x + dx, z = site.z + dz;
      // Stealth squads start on catwalks and balconies: look for the floor from their own height.
      const y = collision.groundBelow(x, (wy ?? site.y) + 3, z, 0.3);
      return spawn(type, { x, y: y > -Infinity ? y : wy ?? site.y, z }, site);
    });
    live.push(...made);
    combat.setEnemies([...live]);
    if (awake) for (const e of made) e.wake();
    return made;
  }

  function clear() {
    stealth?.end();
    for (const e of [...live, ...dead]) despawn(e);
    live = []; dead = [];
    combat.setEnemies([]);
  }

  return {
    get id() { return id; },
    get active() { return triggered && !!fight; },
    get enemies() { return live; },
    // Sets up a fight: goons wait at their spots until the hero shows up. `fightDef` defaults to
    // the story fight of that id; side content passes its own ({ site: key or {x,y,z}, radius, waves }).
    begin(fightId, fightDef = FIGHTS[fightId]) {
      clear();
      id = fightId;
      def = fightDef;
      fight = fightDef;
      wave = 0;
      triggered = false;
      const made = placeWave(0, false);
      // A predator room: the stealth runtime drives this squad (src/stealth/stealthSystem.js).
      if (fight.stealth) stealth?.begin(fight, made);
    },
    restart() {
      if (!id) return;
      this.begin(id, def);
    },
    end() { clear(); fight = null; id = null; def = null; triggered = false; },
    trigger() {
      if (!fight || triggered) return;
      triggered = true;
      if (!fight.stealth) for (const e of live) e.wake();
      events.emit('fightStart', { id });
    },
    update(dt, hero) {
      if (!fight) return;
      const site = siteOf(fight);
      if (!triggered) {
        const d = Math.hypot(hero.pos.x - site.x, hero.pos.z - site.z);
        if (d < fight.radius && Math.abs(hero.pos.y - site.y) < 7) this.trigger();
        // Getting hit (or hitting someone) also starts the fight. In a predator room a silent
        // takedown or perch drop from the room's edge (or from a gargoyle above) counts too.
        if (live.some((e) => e.aware || (fight.stealth && !e.alive))) this.trigger();
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
          // Clear the id before announcing the win: listeners may begin the next fight.
          const done = id;
          if (fight.stealth) stealth?.end();
          fight = null;
          id = null;
          triggered = false;
          events.emit('fightDone', { id: done });
        }
      }
    },
    cleanupBodies() { for (const e of dead) despawn(e); dead = []; },
  };
}
