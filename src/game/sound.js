// Maps game events to the synthesized audio: effects, stingers and which music plays when.
export function wireAudio({ audio, events, hero, combat, flow, voice = null, settings, stealth = null }) {
  // The recorded orchestral Happy Birthday (CC0, VOLE.wtf) plays over the finale; the synth
  // birthday waltz carries on afterwards.
  const track = new Audio('./assets/music/birthday-orchestral.mp3');
  // Fetched after the first minute of play, long before the finale needs it.
  track.preload = 'none';
  setTimeout(() => { track.preload = 'auto'; track.load(); }, 60000);
  let trackPlaying = false;
  track.addEventListener('ended', () => { trackPlaying = false; });
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
  on('critical', () => { audio.play('heavy', { gain: 1.1, pitch: 0.8 }); audio.play('takedown', { gain: 0.6 }); });
  on('grab', () => audio.play('cape', { pitch: 0.8 }));
  on('throwRelease', () => audio.play('whoosh', { gain: 0.9, pitch: 0.7 }));
  on('slamStart', () => audio.play('whoosh', { gain: 0.7, pitch: 0.6 }));
  on('slam', () => { audio.play('land'); audio.play('heavy', { pitch: 0.7 }); });
  on('counter', () => audio.play('counter'));
  on('ladderOn', () => audio.play('grappleLand'));
  on('ledgeGrab', () => audio.play('grappleLand'));
  on('zipOn', () => audio.play('grapple'));
  on('wallRun', () => audio.play('whoosh'));
  on('wallKick', () => audio.play('whoosh'));
  on('diveStart', () => audio.play('glideStart'));
  on('diveImpact', () => audio.play('land', { gain: 1.4 }));
  // No separate 'takedown' wiring: combat.takedown() (combatSystem.js) already calls critical(),
  // which emits 'critical', already handled above (heavy + takedown stinger). Wiring 'takedown'
  // too would double-play that pair on every hanging/drop takedown.
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
  on('chainStart', ({ stealth }) => audio.play('whoosh', { gain: stealth ? 0.5 : 0.8, pitch: 0.85 }));
  on('chainTether', () => audio.play('tether'));
  on('chainYank', () => audio.play('whoosh', { gain: 0.8, pitch: 0.7 }));
  on('chainTied', () => { audio.play('heavy', { pitch: 1.1 }); audio.play('tether', { gain: 0.7, pitch: 0.7 }); });
  on('chainGrab', () => audio.play('cape', { pitch: 0.7 }));
  on('chainSmash', () => audio.play('konk'));
  on('chainStomp', () => audio.play('kick', { pitch: 1.35 }));
  on('tiedBreak', () => audio.play('konk', { pitch: 0.8 }));
  on('finaleStart', () => {
    const v = settings?.volume ?? { master: 0.8, music: 0.6 };
    track.volume = Math.min(1, v.master * v.music * 1.4);
    track.currentTime = 0;
    trackPlaying = true;
    audio.music('none');
    track.play().catch(() => { trackPlaying = false; });
  });
  on('thunder', () => audio.play('thunder', { gain: 0.8 }));
  on('bossPhase', () => audio.stinger('bossPhase'));
  on('laugh', () => { if (!voice || voice.speaking || !voice.say('laugh', { interrupt: false })) audio.play('laugh'); });
  on('jokerVoice', ({ id }) => voice?.say(id));
  on('gas', () => audio.play('gas'));
  on('buzzer', () => audio.play('buzzer'));
  on('firework', () => audio.play('firework', { pitch: vary(0.3) }));
  on('rifleShot', () => audio.play('rifleShot', { pitch: vary(0.1) }));
  on('rifleAim', () => audio.play('laser'));
  on('silentStart', () => audio.play('choke'));
  on('stealthAlarm', () => audio.play('alarm'));
  on('batarangWall', () => audio.play('tink'));
  on('perchDropStart', () => audio.play('whoosh', { gain: 0.7, pitch: 0.75 }));

  on('wheelOpen', () => audio.play('wheelOpen'));
  on('wheelPick', () => audio.play('uiMove'));
  on('gadgetEquip', () => audio.play('uiSelect', { gain: 0.7 }));
  on('remoteStart', () => audio.play('batarangThrow'));
  on('remoteWhirr', () => audio.play('remote'));
  on('remoteHit', () => audio.play('batarangHit'));
  on('gelSpray', () => audio.play('gelSpray', { pitch: vary() }));
  on('gelBlast', () => audio.play('gelBoom', { pitch: vary(0.1) }));
  on('smoke', () => audio.play('smoke'));
  on('launcherFire', () => audio.play('launcher'));
  on('launcherOn', () => audio.play('grapple'));
  on('clawYank', () => audio.play('claw'));
  on('clawRip', () => audio.play('block', { pitch: 0.6 }));
  on('freeze', () => audio.play('freeze'));
  on('iceShatter', () => audio.play('shatter'));
  on('popper', () => audio.play('popper'));
  on('glassBroken', () => audio.play('glass'));
  on('wallBroken', () => audio.play('wallBreak'));
  on('ventOpen', () => audio.play('block', { pitch: 1.3 }));
  on('railingDown', () => audio.play('block', { pitch: 0.8 }));
  on('cacheFound', () => audio.play('pickup'));
  on('levelUp', () => audio.play('levelUp'));
  on('upgradeBought', () => audio.play('upgrade'));
  on('swarmStart', () => audio.play('swarm'));

  audio.setRain(0.8);

  return {
    update() {
      const step = flow.objectives.step;
      const want = trackPlaying ? 'none'
        : step?.type === 'boss' ? 'boss'
        : step?.scene === 'finale' || step?.type === 'credits' ? 'finale'
        : flow.mode === 'cutscene' ? 'title'
        : (fighting || combat.active) && !(stealth?.active && !stealth.alarm) ? 'combat' : 'explore';
      if (want !== mode) { mode = want; audio.music(want); }
      audio.setGlide(hero.state === 'glide' ? Math.min(1, 0.35 + hero.speed / 40) : 0);
      const heat = combat.active ? Math.min(1, combat.enemies.filter((e) => e.alive && e.aware).length / 6 + combat.combo.value / 16) : 0;
      audio.setCombatIntensity(heat);
    },
    start() { audio.music(mode); },
  };
}
