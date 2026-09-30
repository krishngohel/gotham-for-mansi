// src/game/vehicleChallenges.js
// Plugs the two vehicle challenges (Gotham Grand Prix, kind 'parkour'; Wing Walk, kind 'rings')
// into the existing challenge system (src/game/challengeRunner.js) through registerKind, the
// same extension point src/game/arenaChallenge.js uses for the arena. Both hooks are guarded to
// their own challenge id, since 'parkour' and 'rings' are shared with the existing on-foot and
// glide/dive courses, which need no vehicle handling at all.
import { CHALLENGES } from './challenges.js';

export function attachVehicleChallenges(runner, { vehicles, batwing, hero }) {
  runner.registerKind('parkour', {
    prepare(run) {
      if (run.ch.id !== 'gothamGrandPrix') return;
      // vehicles.enter() sets hero.control itself, overwriting the runner's own countdown hold.
      vehicles.summon('batmobile', { instant: true });
      vehicles.enter(vehicles.batmobile);
    },
    end(run) {
      if (run.ch.id !== 'gothamGrandPrix') return;
      if (vehicles.active) vehicles.exit();
    },
  });

  runner.registerKind('rings', {
    prepare(run) {
      if (run.ch.id !== 'wingWalk') return;
      // batwing.call() refuses while hero.control is set (the runner's countdown hold), so it is
      // cleared here first; call() replaces it with its own 'boarding' control immediately.
      hero.control = null;
      batwing.call();
    },
    end(run) {
      if (run.ch.id !== 'wingWalk') return;
      if (batwing.active) batwing.exit();
    },
  });
}

// Debug win / test skip: starts the challenge (bypassing the pillar walk-up and canStart check,
// same as runner.start() already does for every challenge) and finishes it at its own gold time,
// guaranteeing a medal. runner.start(id) + runner.finish(value) are themselves already generic
// and public; this just saves a caller from having to know each challenge's own gold value.
export function debugWinVehicleChallenge(runner, id) {
  const ch = CHALLENGES.find((c) => c.id === id);
  if (!ch || !runner.start(id)) return false;
  runner.finish(ch.medals.gold);
  return true;
}
