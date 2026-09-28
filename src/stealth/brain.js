// Predator stealth: how each goon's awareness moves between patrol, suspicious, search, hunt and
// engage, the squad alarm and its fall-back to searching, smoke, hit reactions, fear, the lines
// goons call out, and what the HUD glyph shows. Pure: no three.js, no allocation per call.
import { STEALTH, fillRate } from './vision.js';

export const HOSTILE = new Set(['hunt', 'engage']);

export function createSquad() {
  return { alarm: false, unseenT: 0, lastKnown: { x: 0, y: 0, z: 0 }, fear: 0, kos: 0 };
}

export function createMind() {
  return { alert: 'patrol', meter: 0, target: { x: 0, y: 0, z: 0 }, rev: 0, searchLeft: 0, t: 0 };
}

const setP = (o, p) => { o.x = p.x; o.y = p.y; o.z = p.z; return o; };
// A new place to go: the runtime notices the bumped rev.
const aim = (m, p) => { setP(m.target, p); m.rev += 1; };

function startSearch(m, at, rules) {
  const was = m.alert;
  m.alert = 'search';
  m.meter = Math.max(m.meter, rules.searchAt);
  m.searchLeft = rules.searchTime;
  m.t = 0;
  aim(m, at);
  return was === 'search' ? null : 'search';
}

export function goHostile(m, squad, at) {
  m.alert = 'engage';
  m.meter = 1;
  m.t = 0;
  squad.alarm = true;
  squad.unseenT = 0;
  setP(squad.lastKnown, at);
  return 'shout';
}

// One goon, one frame. Returns what changed (for the lines and sounds), or null.
export function thinkGoon(m, squad, sense, dt, rules = STEALTH) {
  m.t += dt;
  const sees = sense.seesAt >= 0;
  if (HOSTILE.has(m.alert)) {
    if (sees) { m.alert = 'engage'; squad.unseenT = 0; setP(squad.lastKnown, sense.hero); }
    else if (squad.unseenT < rules.huntAfter) m.alert = 'engage';
    else if (m.alert === 'engage') { m.alert = 'hunt'; aim(m, squad.lastKnown); }
    return null;
  }
  if (sees) {
    if (sense.seesAt <= rules.instant) m.meter = 1;
    else m.meter = Math.min(1, m.meter + fillRate(sense.seesAt, sense.range, rules) * dt * (m.alert === 'search' ? 1.5 : 1));
    aim(m, sense.hero);
    if (m.meter >= 1) return goHostile(m, squad, sense.hero);
  }
  if (m.alert === 'patrol') {
    if (sense.noise) return startSearch(m, sense.noise, rules) && 'hear';
    if (sees && m.meter > 0) { m.alert = 'suspicious'; m.t = 0; return 'suspect'; }
    return null;
  }
  if (m.alert === 'suspicious') {
    if (m.meter >= rules.searchAt) return startSearch(m, m.target, rules);
    if (sense.noise) return startSearch(m, sense.noise, rules) && 'hear';
    if (!sees) {
      m.meter = Math.max(0, m.meter - rules.decay * dt);
      if (m.meter === 0) { m.alert = 'patrol'; m.t = 0; return 'calm'; }
    }
    return null;
  }
  // Searching: stays yellow, follows new noises, and gives up after searchTime.
  if (sense.noise) aim(m, sense.noise);
  if (!sees) m.meter = Math.max(rules.searchAt, m.meter - rules.decay * 0.5 * dt);
  m.searchLeft -= dt;
  if (m.searchLeft <= 0) { m.alert = 'patrol'; m.meter = 0; m.t = 0; return 'giveUp'; }
  return null;
}

// A shout: every goon that isn't hostile yet goes hunting at the last known spot.
export function alarmAll(minds, squad) {
  let n = 0;
  for (const m of minds) {
    if (!m || HOSTILE.has(m.alert)) continue;
    m.alert = 'hunt';
    m.meter = 1;
    m.t = 0;
    aim(m, squad.lastKnown);
    n += 1;
  }
  return n;
}

// The squad clock: while the alarm is up and nobody sees Batman it counts, and after loseTime
// every hostile goon falls back to searching around the last known spot.
export function thinkSquad(squad, minds, anySees, dt, rules = STEALTH) {
  if (!squad.alarm) return null;
  squad.unseenT = anySees ? 0 : squad.unseenT + dt;
  if (squad.unseenT < rules.loseTime) return null;
  squad.alarm = false;
  for (const m of minds) {
    if (!m || !HOSTILE.has(m.alert)) continue;
    m.alert = 'search';
    m.meter = 0.75;
    m.searchLeft = rules.searchTime;
    m.t = 0;
    aim(m, squad.lastKnown);
  }
  return 'lost';
}

// Smoke pellet in stealth: every goon's alert resets to searching around the cloud.
export function smokeReset(minds, squad, at, rules = STEALTH) {
  squad.alarm = false;
  squad.unseenT = 0;
  setP(squad.lastKnown, at);
  for (const m of minds) {
    if (!m) continue;
    m.alert = 'search';
    m.meter = rules.searchAt;
    m.searchLeft = rules.searchTime;
    m.t = 0;
    aim(m, at);
  }
}

// A goon hit by something that didn't knock it out. A stun (batarang, remote, cape) sends it to
// look where Batman is; a blow that lands or is parried means it has found him.
export function struck(m, squad, at, outcome, rules = STEALTH) {
  if (outcome === 'ko') return null;
  if (HOSTILE.has(m.alert)) { setP(squad.lastKnown, at); squad.unseenT = 0; return null; }
  if (outcome === 'stun') return startSearch(m, at, rules);
  return goHostile(m, squad, at);
}

export function noteTakedown(squad) {
  squad.kos += 1;
  squad.fear = Math.min(3, squad.kos);
  return squad.fear;
}
export const fearSpeed = (fear) => 1 + 0.12 * fear;
export const huddles = (fear, alive) => fear >= 2 || alive <= 2;

// Lettered as speech balloons over the goon who says them.
export const LINES = {
  spot: ['THERE HE IS!', "IT'S THE BAT!", 'OVER HERE! GET HIM!'],
  hear: ['What was that?', 'Who is there?', 'Hello...?'],
  suspect: ['Huh?', 'Did something move?'],
  lost: ['Where did he go?!', 'Spread out! Find him!', 'He was right here!'],
  calm: ['Must have been a rat.', 'Nothing. Back to it.'],
  fear1: ['Hey, where did Vinnie go?', 'Anybody else hear that?'],
  fear2: ['Where is it?!', 'Stick together!'],
  fear3: ["It's just me now, isn't it?", 'I want my mom!'],
};
export function pickLine(kind, n) {
  const list = LINES[kind] ?? LINES.hear;
  return list[((n % list.length) + list.length) % list.length];
}

// What the awareness glyph over a goon shows: 0 = nothing, else colour * 32 + fill step (0..31),
// colour 1 white (noticing), 2 yellow (searching), 3 red (hostile).
export function glyphCode(m) {
  if (!m) return 0;
  if (HOSTILE.has(m.alert)) return 3 * 32 + 31;
  const step = Math.round(Math.min(1, Math.max(0, m.meter)) * 31);
  if (m.alert === 'search') return 2 * 32 + step;
  if (m.meter > 0) return 32 + step;
  return 0;
}
export const glyphColor = (code) => ['', 'white', 'yellow', 'red'][code >> 5] ?? '';
export const glyphFill = (code) => (code & 31) / 31;

// Detective vision colour index: 0 patrolling (or only noticing), 1 searching, 2 hostile.
export const stateColor = (m) => (!m ? 0 : HOSTILE.has(m.alert) ? 2 : m.alert === 'search' ? 1 : 0);
