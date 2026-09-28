// The beats of each chain takedown, as data. Pure: no three.js. chainControl.js plays them.
//
// A step:
//   target    index into the chain's targets, or 'pile' (the middle of all of them)
//   at        where Batman goes: 'strike' (stop short of the target), 'between' (midway between
//             targets 0 and 1), 'head' (on top of the target's head), 'back' (step back from the
//             pile), 'apex' (high above the pile), 'pile' (down onto it), 'stay'
//   lunge     seconds to get there (0 = no move); arc: metres of hop at the middle of the lunge
//   stop      metres short of the target ('strike'), from the pile ('back'), or apex height
//   ease      'out' for lunges, 'in' for dives
//   clip      Batman's clip for the step (null keeps the current one), speed: its playback rate
//   clipStart seconds into the step the clip starts, so its contact frame lands on `contact`
//   contact   seconds into the step the effect lands; hitStop: the freeze at contact
//   effect    see EFFECTS, or null for a pure move; word: sound word at contact
//   finisher  the one step that gets the slow-motion action shot
//   thenClip  a clip to play at contact (the landing after the dive)
//   dur       seconds from this step's start to the next one's; start: offset in the chain

export const EFFECTS = ['stagger', 'tether', 'yank', 'tie', 'grab', 'headSmash', 'heel', 'stomp', 'diveBomb'];

// Contact frames of the stock clips the chains use, in clip seconds at speed 1 (read off the
// contact sheets; the kicks' own beats come from kicks.js and mocap.js through `beats`).
export const STOCK_BEATS = {
  Punch_Cross: { contact: 0.2 },
  Melee_Hook: { contact: 0.24 },
  OverhandThrow: { contact: 0.36 },
};

// The code-authored chain clips (src/actors/chainAnims.js builds them to these beats).
export const CHAIN_BEATS = {
  Chain_GrabHeads: { duration: 0.8, grab: 0.16, contact: 0.4 },
  Chain_Yank: { duration: 0.7, contact: 0.2 },
  // heel: the left ankle on the contact frame, from the root (+x his left, +z forward): chainControl
  // lands it on a goon's head.
  Chain_Stomp: { duration: 0.45, contact: 0.16, heel: { x: 0.24, y: 0.05, z: 0.14 } },
};

const DEFAULTS = {
  target: 0, at: 'stay', lunge: 0, arc: 0, stop: 0, ease: 'out', clip: null, speed: 1, beat: null,
  hitStop: 0, effect: null, word: null, finisher: false, thenClip: null, after: 0,
};

function step(beats, spec) {
  const s = { ...DEFAULTS, ...spec };
  const b = s.clip ? beats[s.clip] : null;
  const clipContact = b ? (s.beat ? b[s.beat] : b.contact) / s.speed : 0;
  const contact = spec.contact ?? Math.max(s.lunge + 0.02, clipContact);
  // Clips without a beat just start with the step.
  const clipStart = b ? Math.max(0, contact - clipContact) : 0;
  return { ...s, contact, clipStart, dur: contact + s.after };
}

const ROPE_STRIKES = [['Punch_Cross', 1.8], ['Kick_Front', 2.0], ['Melee_Hook', 1.9]];

function rope(n, beats) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    const [clip, speed] = ROPE_STRIKES[i];
    steps.push(step(beats, { target: i, at: 'strike', lunge: 0.14, stop: 1.0, clip, speed, effect: 'stagger', hitStop: 0.05, after: 0.1 }));
  }
  steps.push(step(beats, { target: 'pile', at: 'back', lunge: 0.2, stop: 3.2, clip: 'OverhandThrow', speed: 1.7, effect: 'tether', word: 'THWIP!', after: 0.28 }));
  steps.push(step(beats, { target: 'pile', clip: 'Chain_Yank', effect: 'yank', after: 0.18 }));
  steps.push(step(beats, { target: 'pile', contact: 0, effect: 'tie', hitStop: 0.14, word: 'TANGLED!', finisher: true, after: 0.55 }));
  return steps;
}

function head(n, beats) {
  const g = CHAIN_BEATS.Chain_GrabHeads;
  const steps = [
    step(beats, { target: 0, at: 'strike', lunge: 0.14, stop: 1.0, clip: 'Punch_Cross', speed: 1.9, effect: 'stagger', hitStop: 0.05, after: 0.08 }),
    step(beats, { target: 1, at: 'between', lunge: 0.16, clip: 'Chain_GrabHeads', beat: 'grab', effect: 'grab' }),
    // The grab clip keeps playing: the smash lands on its own contact frame.
    step(beats, { target: 1, contact: g.contact - g.grab, effect: 'headSmash', hitStop: 0.16, word: 'KONK!', finisher: true, after: n >= 3 ? 0.22 : 0.5 }),
  ];
  if (n >= 3) {
    steps.push(step(beats, { target: 2, at: 'strike', lunge: 0.34, arc: 1.5, stop: 0.9, clip: 'Kick_Flying', speed: 1.2, contact: 0.34, effect: 'heel', hitStop: 0.12, word: 'THWACK!', after: 0.45 }));
  }
  return steps;
}

function domino(n, beats) {
  const steps = [];
  for (let i = 0; i < n; i++) {
    const lunge = i === 0 ? 0.3 : 0.26;
    steps.push(step(beats, { target: i, at: 'head', lunge, arc: 1.4, clip: 'Chain_Stomp', contact: lunge, effect: 'stomp', hitStop: 0.07, word: i % 2 ? 'KLONK!' : 'BONK!', after: 0.04 }));
  }
  steps.push(step(beats, { target: 'pile', at: 'apex', lunge: 0.38, stop: 5.5, clip: 'NinjaJump_Start', speed: 1.3, contact: 0.38, after: 0.08 }));
  steps.push(step(beats, { target: 'pile', at: 'pile', lunge: 0.2, ease: 'in', clip: 'Dive', contact: 0.2, effect: 'diveBomb', hitStop: 0.16, word: 'KA-BLAM!', finisher: true, thenClip: 'NinjaJump_Land', after: 0.5 }));
  return steps;
}

const BUILDERS = { rope, head, domino };

export function buildChainTimeline(id, count, beats = {}) {
  if (!BUILDERS[id]) throw new Error(`Unknown chain ${id}`);
  if (count < 2) throw new Error('A chain needs at least 2 targets');
  const n = Math.min(3, count);
  const steps = BUILDERS[id](n, { ...STOCK_BEATS, ...CHAIN_BEATS, ...beats });
  let t = 0;
  for (const s of steps) { s.start = t; t += s.dur; }
  return { id, count: n, steps, duration: t };
}

// Every clip a chain plays on Batman (primed on his mixer at run start).
export function chainClipNames() {
  const names = new Set();
  for (const id of Object.keys(BUILDERS)) {
    for (const s of buildChainTimeline(id, 3).steps) {
      if (s.clip) names.add(s.clip);
      if (s.thenClip) names.add(s.thenClip);
    }
  }
  return [...names];
}
