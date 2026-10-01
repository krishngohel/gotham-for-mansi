// Free-roam Joker van chase glue: ties the pure scheduler (src/game/sideVanChase.js) to the real
// spawn/ram/despawn mechanics in src/vehicles/vehicles.js and the side HUD, counts a win into
// progress.vanChases and pays its XP. Follows the same split src/game/crimeDirector.js uses for
// street crimes: this file is the only one that touches progress, save() or the HUD for it.
import { createVanChaseScheduler } from './sideVanChase.js';

const RADIO = 'GCPD RADIO';
// A story type that needs the Batmobile for real, a fight, the boss or a cutscene always wins: a
// free-roam side chase never gets to hold the story hostage, so it's dropped at once rather than
// left to expire on its own (two Joker vans competing for one ram counter would just be confusing).
const STORY_STOP_TYPES = new Set(['fight', 'boss', 'cutscene', 'board', 'chase', 'battle', 'armada']);

export function createVanChaseDirector({ vehicles, events, ui, progress, save, rng }) {
  const scheduler = createVanChaseScheduler({ rng });

  const offs = [
    events.on('sideChaseStart', () => {
      ui.radio(RADIO, "Joker van on the move nearby. Ram it three times if you're driving.", 6000);
    }),
    events.on('sideChaseHit', ({ hits, hitsNeeded }) => {
      if (hits < hitsNeeded) ui.hint(`Van chase: ${hits}/${hitsNeeded}`, 1400);
    }),
    events.on('sideChaseDone', ({ ok }) => {
      if (ok) {
        progress.vanChases.stopped += 1;
        save();
        ui.toast('Van chase won', `Another one off the street. Van chases stopped: ${progress.vanChases.stopped}.`, 5000);
        events.emit('vanChaseStopped', { count: progress.vanChases.stopped });
      } else {
        ui.radio(RADIO, 'The van got away. There will be another.', 4000);
      }
    }),
    events.on('step', ({ step }) => { if (STORY_STOP_TYPES.has(step.type)) vehicles.cancelSideChase(); }),
    events.on('challengeStart', () => vehicles.cancelSideChase()),
  ];

  return {
    update(dt, heroPos, blocked) {
      if (!scheduler.update(dt, { blocked: blocked() })) return;
      const ok = vehicles.trySpawnSideChase(heroPos);
      scheduler.spawned(ok);
    },
    destroy() { for (const off of offs) off(); },
  };
}
