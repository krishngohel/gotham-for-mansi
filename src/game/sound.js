// Maps game events to the synthesized audio: effects, stingers and which music plays when.
export function wireAudio({ audio, events, hero, combat, flow }) {
  const on = (ev, fn) => events.on(ev, fn);
  const vary = (p = 0.12) => 1 - p / 2 + Math.random() * p;
  let fighting = false;
  let mode = 'explore';

  on('footstep', () => audio.play('footstep', { gain: 0.55, pitch: vary(0.2) }));
  on('jump', () => audio.play('whoosh', { gain: 0.35, pitch: 1.2 }));
  on('vault', () => audio.play('whoosh', { gain: 0.35, pitch: 1.3 }));
  on('land', ({ hard }) => (hard ? audio.play('land') : audio.play('footstep', { gain: 0.8, pitch: 0.8 })));
  on('glideStart', () => audio.play('glideStart'));
  on('grapple', () => audio.play('grapple'));
  on('grappleLand', () => audio.play('grappleLand'));
  on('grappleBoost', () => audio.play('whoosh', { gain: 0.6, pitch: 0.8 }));
  on('swing', () => audio.play('whoosh', { gain: 0.3, pitch: vary() }));
  on('whiff', () => audio.play('whoosh', { gain: 0.45, pitch: 0.9 }));
  on('cape', () => audio.play('cape'));
  on('batarangThrow', () => audio.play('batarangThrow'));
  on('batarangHit', () => audio.play('batarangHit'));
  on('dodge', () => audio.play('roll'));
  on('special', () => audio.play('takedown'));
  on('counter', () => audio.play('counter'));
  on('impact', ({ move, outcome }) => {
    if (outcome === 'parried' || outcome === 'immune') { audio.play('block', { pitch: outcome === 'immune' ? 0.7 : 1.1 }); return; }
    if (outcome === 'stun') { audio.play('batarangHit', { gain: 0.5, pitch: 0.8 }); return; }
    if (outcome === 'ko') { audio.play('heavy', { pitch: vary() }); audio.play('ko', { gain: 0.8 }); return; }
    if (outcome === 'knockdown') { audio.play('heavy', { pitch: vary() }); return; }
    audio.play(move === 'kick' || move === 'jumpKick' || move === 'diveBomb' ? 'kick' : 'punch', { pitch: vary(0.25) });
  });
  on('heroHurt', ({ blocking }) => audio.play(blocking ? 'block' : 'hurt', { pitch: vary() }));
  on('heroDown', () => audio.stinger('death'));
  on('balloon', () => { audio.play('pop'); setTimeout(() => audio.play('balloon'), 120); });
  on('pickup', () => audio.play('pickup'));
  on('objectiveDone', ({ type }) => { if (type === 'reached' || type === 'fightDone') audio.stinger('objective'); });
  on('fightStart', () => { fighting = true; });
  on('fightDone', () => { fighting = false; });
  on('cutscene', ({ name, on: starting }) => {
    if (starting && ['presents', 'party', 'cake'].includes(name)) audio.stinger('districtClear');
  });
  on('signal', () => audio.play('signal'));
  on('thunder', () => audio.play('thunder', { gain: 0.8 }));
  on('bossPhase', () => audio.stinger('bossPhase'));
  on('laugh', () => audio.play('laugh'));
  on('gas', () => audio.play('gas'));
  on('buzzer', () => audio.play('buzzer'));
  on('firework', () => audio.play('firework', { pitch: vary(0.3) }));

  audio.setRain(0.8);

  return {
    update() {
      const step = flow.objectives.step;
      const want = step?.type === 'boss' ? 'boss'
        : step?.scene === 'finale' || step?.type === 'credits' ? 'finale'
        : flow.mode === 'cutscene' ? 'title'
        : fighting || combat.active ? 'combat' : 'explore';
      if (want !== mode) { mode = want; audio.music(want); }
      audio.setGlide(hero.state === 'glide' ? Math.min(1, 0.35 + hero.speed / 40) : 0);
      const heat = combat.active ? Math.min(1, combat.enemies.filter((e) => e.alive && e.aware).length / 6 + combat.combo.value / 16) : 0;
      audio.setCombatIntensity(heat);
    },
    start() { audio.music(mode); },
  };
}
