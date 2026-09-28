// Gadget 1, the batarang, as it always was: it stuns and interrupts the goon you steer toward, up
// to 26 m away. With WayneTech's Triple Batarang it throws one at each of up to three goons.
import { selectTarget } from '../../combat/targeting.js';

export function createBatarangHandler() {
  return {
    id: 'batarang',
    // No goon in range yet: the buffered press tries again for a moment, as before.
    retry: true,
    fire(sys, ctx) {
      const { api, hero, effects } = sys;
      const list = api.alive().filter((e) => e.state !== 'grabbed' && api.canSee(e));
      const first = selectTarget(hero.pos, api.inputDir(ctx, true), list, { range: 26, maxAngle: 1.2 });
      if (!first) return false;
      const targets = [first];
      if (effects.batarangCount > 1) {
        const rest = list.filter((e) => e !== first && !e.down && e.pos.distanceTo(hero.pos) < 26)
          .sort((a, b) => a.pos.distanceTo(first.pos) - b.pos.distanceTo(first.pos));
        targets.push(...rest.slice(0, effects.batarangCount - 1));
      }
      hero.control = api.batarang(targets, sys.fx);
      return true;
    },
  };
}
