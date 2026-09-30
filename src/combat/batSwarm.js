// Bat Swarm: the fourth chain takedown (the last WayneTech Combat upgrade). At combo 15 (13 with
// Efficient Chains) Batman calls a swarm of bats down on up to six goons within 10 m: each is held
// and battered, then every one is knocked out (brutes knocked down). Pure rules and timeline, and
// the hero control that plays them through Plan 4E's chain api.
import { chainEligible, chainCost } from './chains.js';

export const SWARM = { n: 4, id: 'swarm', name: 'Bat Swarm', cost: 15, action: 'chain4', reach: 10, maxTargets: 6, minTargets: 2, maxRise: 2 };

const flat = (a, o) => Math.hypot(a.pos.x - o.x, a.pos.z - o.z);

export function swarmTargets(origin, enemies, { canSee = () => true, reach = SWARM.reach, max = SWARM.maxTargets, min = SWARM.minTargets, maxRise = SWARM.maxRise } = {}) {
  const list = enemies
    .filter((e) => chainEligible(e) && Math.abs(e.pos.y - origin.y) <= maxRise && flat(e, origin) <= reach && canSee(e))
    .sort((a, b) => flat(a, origin) - flat(b, origin))
    .slice(0, max);
  return list.length >= min ? list : null;
}

// Refreshed with Plan 4E's chain availability (every 0.1 s or on a combo change), never per frame.
export function swarmAvailability({ owned, combo, origin, enemies, discount = 0 }) {
  const cost = chainCost(SWARM, discount);
  if (!owned) return { show: false, affordable: false, cost };
  const affordable = combo >= cost && !!swarmTargets(origin, enemies);
  return { show: combo >= 6, affordable, cost };
}

// Seconds of game time. Batman is locked in the swarm for its whole length, so it stays brisk:
// the bats land a blow every STAGGER, and control comes back AFTER s past the finisher (itself
// slowed by FINISH_SLOW real seconds at FINISH_SCALE, plus the impact panel), not a long stall.
export const SWARM_BEATS = { DIVE: 0.45, STAGGER: 0.14, WINDUP: 0.35, AFTER: 0.35, FINISH_SLOW: 0.6, FINISH_SCALE: 0.3 };

export function swarmTimeline(count) {
  const B = SWARM_BEATS;
  const steps = [{ at: 0, kind: 'hold', index: -1 }];
  for (let i = 0; i < count; i++) steps.push({ at: B.DIVE + i * B.STAGGER, kind: 'stagger', index: i });
  const fin = B.DIVE + count * B.STAGGER + B.WINDUP;
  steps.push({ at: fin, kind: 'finish', index: -1 });
  steps.push({ at: fin + B.AFTER, kind: 'end', index: -1 });
  return { steps, duration: fin + B.AFTER };
}

export function createSwarmControl(hero, api, { targets, timeline, fx = null }) {
  let t = 0, next = 0;
  hero.vel?.set(0, 0, 0);
  // Batman faces the middle of the squad and throws his arm up to call the bats down.
  let cx = 0, cz = 0;
  for (const e of targets) { cx += e.pos.x; cz += e.pos.z; }
  hero.bat.face?.(Math.atan2(cx / targets.length - hero.pos.x, cz / targets.length - hero.pos.z));
  hero.bat.animator.play('Spell_Simple_Shoot', { once: true, timeScale: 0.8, fade: 0.08 });
  return {
    name: 'swarm', camera: 'chain', combat: true, targets, fx,
    canChain: () => false,
    update(dt) {
      t += dt;
      while (next < timeline.steps.length && timeline.steps[next].at <= t) {
        const s = timeline.steps[next++];
        if (s.kind === 'hold') {
          for (const e of targets) api.hold(e);
          fx?.start(targets, hero.pos);
          api.word('SKREEEE!', hero.pos, true);
        } else if (s.kind === 'stagger') {
          const e = targets[s.index];
          if (e.alive) api.stagger(e);
        } else if (s.kind === 'finish') {
          fx?.rise();
          // One critical, on the finishing contact: the action shot frames the first goon still up.
          const focus = targets.find((e) => e.alive) ?? targets[0];
          api.critical(focus, { slow: SWARM_BEATS.FINISH_SLOW, scale: SWARM_BEATS.FINISH_SCALE, variant: 'swarm', impact: 2 });
          for (const e of targets) { api.release(e); api.finish(e, { power: 1.6, launch: 3 }); }
          api.word('FLAP FLAP KRAKOOM!', focus.pos, true);
          // Done as soon as the goons are down, in the same step that lets them go (as chainDone
          // is): control taken away in the last moments can't lose the XP.
          api.events.emit('swarmDone', { count: targets.length });
        } else {
          fx?.stop();
          return true;
        }
      }
      return false;
    },
  };
}
