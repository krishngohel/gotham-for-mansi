// Free-roam Joker van chases: optional, repeatable side content. A van appears on a real street
// within a few hundred metres every so often; Mansi can chase it down (ram it 3 times, same rule
// as the story's own Batmobile chases) for XP, or ignore it and it drives off on its own. This
// file only decides *when* to try spawning one (pure timing, like src/game/crimes.js's
// createCrimeScheduler); src/vehicles/vehicles.js owns *where* (a real street, via its own
// pickSideVanRoute) and the actual van/ramming/despawn mechanics. The glue between the two lives
// in src/game/sideContent.js, the same split crimes.js/crimeDirector.js already use.

// Blocked exactly when a street crime would be (never mid-story-critical beat, never in a menu or
// photo mode), plus every story type that puts her in a vehicle on purpose or asks her to find one
// herself: a second van competing for attention during the real mission would just be confusing.
const STORY_VEHICLE_TYPES = ['board', 'chase', 'battle', 'armada'];
export function vanChaseBlocked({ mode, stepType, vehicleBusy = false, challenge = false, photo = false }) {
  if (mode !== 'play' || challenge || photo || vehicleBusy) return true;
  return ['fight', 'boss', 'cutscene', ...STORY_VEHICLE_TYPES].includes(stepType);
}

// `minGap`/`maxGap`: how long between one side chase ending (or being ignored) and the next
// becoming available to try. `retry`: how soon to try again after a spawn attempt found no clear
// nearby street (should be rare, but Gotham's compounds make a few spots unsafe to pick).
export function createVanChaseScheduler({ rng, minGap = 90, maxGap = 210, retry = 20 } = {}) {
  const gap = () => minGap + rng.next() * (maxGap - minGap);
  let timer = gap();
  return {
    get timer() { return timer; },
    // True on the one frame a spawn should be attempted. The caller does the actual spawning
    // (it owns the streets and the van) and must report back through spawned(ok).
    update(dt, { blocked = false } = {}) {
      if (blocked) return false;
      timer -= dt;
      return timer <= 0;
    },
    spawned(ok) { timer = ok ? gap() : retry; },
  };
}
