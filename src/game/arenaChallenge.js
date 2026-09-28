// Joker's Birthday Bash: three waves on the Monarch roof through the encounter system, scored
// by createArenaScore (hits times the multiplier, a bonus per new move type in a combo,
// finishers and counters; getting hit resets the multiplier).
import { ARENA_ID, ARENA_FIGHT, createArenaScore } from './challenges.js';

export function attachArena(runner, { events, encounters, ui }) {
  let score = null;
  let wave = 0;
  const live = () => !!score && runner.running && runner.current?.kind === 'arena';
  const show = () => ui.timer(Math.round(score.score).toLocaleString('en-US'), `x${score.multiplier} · Wave ${wave + 1} of ${ARENA_FIGHT.waves.length}`);

  runner.registerKind('arena', {
    ownsFight: (id) => id === ARENA_ID,
    begin() {
      score = createArenaScore();
      wave = 0;
      encounters.begin(ARENA_ID, ARENA_FIGHT);
      encounters.trigger();
      show();
    },
    update(run, dt) { score.tick(dt); show(); },
    end() {
      if (encounters.id === ARENA_ID) encounters.end();
      score = null;
    },
  });

  events.on('impact', ({ move, outcome }) => { if (live() && outcome !== 'parried' && outcome !== 'immune') score.hit(move); });
  events.on('takedown', () => { if (live()) score.hit('takedown'); });
  events.on('diveImpact', ({ count }) => { if (live()) for (let i = 0; i < count; i++) score.hit('diveBomb'); });
  events.on('heroHurt', ({ blocking }) => { if (live() && !blocking) score.hurt(); });
  events.on('wave', ({ id, wave: w }) => { if (id === ARENA_ID && live()) { wave = w; ui.countdown(`WAVE ${w + 1}`); } });
  events.on('fightDone', ({ id }) => { if (id === ARENA_ID && live()) runner.finish(Math.round(score.score)); });
}
