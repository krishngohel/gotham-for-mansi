// Tutorial prompts. Every key shown is read from the live bindings.
import { bindingLabel } from '../core/bindings.js';
import { CHAINS } from '../combat/chains.js';

// The stealth clause (CHAIN_RULES in src/combat/chains.js: stealthMin 2 unaware goons within
// stealthRadius 6 m; hearRadius 8 m). Spelled out in words: no digits in the chain copy.
export const CHAIN_STEALTH_CLAUSE = "Sneak within six meters of two goons who haven't seen you and a chain is free and silent: only goons within eight meters hear it.";

// [id, textFn] pairs, not an object literal: two entries sharing an id used to silently
// overwrite one another (the divebomb hint clobbered the glide-dive tutorial this way).
// An array makes that a checkable bug instead, via the "no duplicate ids" test in
// tests/unit/prompts.test.js, which walks PROMPT_IDS below.
const ENTRIES = [
  ['move', (k, move) => `Move with <kbd>${move}</kbd>. Click the screen to aim the camera with your mouse.`],
  ['look', (k) => `Follow the yellow beacon and the marker to your next objective. ${k('help')} shows every control.`],
  ['glide', (k) => `Run off the edge and hold ${k('jump')} in the air to glide.`],
  ['dive', (k) => `Gliding: hold ${k('sprint')} to dive and build speed, then hold ${k('back')} to swoop back up. Speed buys height.`],
  ['grapple', (k) => `Look at a ledge until the blue marker appears, then press ${k('grapple')} to grapple up.`],
  ['grappleBoost', (k) => `Tap ${k('jump')} during a grapple to launch over the ledge and keep gliding.`],
  ['punch', (k) => `Click ${k('punch')} to punch. Attacks leap to the goon you steer toward, or the nearest one, so keep swinging.`],
  ['combo', () => `Every hit builds your combo. It lasts three seconds between hits, survives one hit taken, and a miss never resets it.`],
  // Movement combos (src/combat/moveSelect.js): how she moves picks the strike.
  ['movesDirection', (k) => `How you move picks the strike. Hold away from a goon and press ${k('kick')} for a spinning back kick, or ${k('punch')} for a spinning backfist. Hold to his side for a roundhouse or a hook.`],
  ['movesSprint', (k) => `Hold ${k('sprint')} and press ${k('kick')} for a flying knee, or ${k('punch')} for a running uppercut.`],
  ['movesAir', (k) => `Jump with ${k('jump')}, then ${k('kick')} for an axe kick, or hold away from him for a backflip kick. Hold ${k('sprint')}, jump, then ${k('kick')} for a hurricane kick, or ${k('punch')} for a leaping smash.`],
  ['stomp', (k) => `He's down! Press ${k('kick')} to stomp him, or ${k('punch')} to hammer him.`],
  ['kick', (k) => `Press ${k('kick')} to kick. Kicks hit harder and reach farther. In the air it is a jump-kick.`],
  ['counter', (k) => `A blue bolt over a goon means an attack is coming. Tap ${k('block')} to counter it.`],
  ['block', (k) => `Hold ${k('block')} to block when a counter is too late.`],
  ['throw', (k) => `Press ${k('throw')} next to a goon to grab and hurl them. Aim at their friends to bowl them over.`],
  ['slam', (k) => `Jump and press ${k('punch')} in the air to slam down and knock over everyone around you.`],
  ['finisher', () => `Keep hitting the same goon: every 4th punch is a haymaker and every 3rd kick a spinning heel kick.`],
  ['dodge', (k) => `Press ${k('dodge')} to dodge roll. Rolling toward a goon vaults right over them.`],
  ['knife', () => `Knife goons parry punches. Kick them or stun them with your cape first.`],
  ['cape', (k) => `Press ${k('cape')} to swirl your cape and stun everyone in front of you.`],
  ['batarang', (k) => `Press ${k('batarang')} to throw a batarang. It stuns goons and interrupts attacks from far away.`],
  ['special', (k) => `Build a big combo until it turns yellow. Press ${k('special')} for a special takedown.`],
  ['brute', (k) => `Brutes can't be countered: their bolt is red. Dodge with ${k('dodge')}, stun with ${k('cape')}, then pile on.`],
  ['detective', (k) => `Press ${k('detective')} for detective vision. It reveals goons, your objective and hidden balloons.`],
  ['balloons', () => `Twelve birthday balloons are hidden around Gotham. Each one holds a message.`],
  ['lowPower', () => (/Mac/.test(globalThis.navigator?.platform || globalThis.navigator?.userAgent || '')
    ? 'Your Mac is holding the game to 30 frames a second, which usually means Low Power Mode is on. Plug in, or turn it off in System Settings, Battery, for smoother play.'
    : 'Your browser is holding the game to 30 frames a second, usually a battery or energy saver mode. Plug in or turn it off for smoother play.')],
  ['callBatwing', (k) => `Press ${k('batwing')} to call the Batwing. It swoops in for you on a rooftop or in the middle of a glide.`],
  ['exitVehicle', (k) => `Press ${k('vehicle')} to get out of the car.`],
  ['drive', (k) => `Driving: ${k('forward')} gas, ${k('back')} brake and reverse, ${k('left')} ${k('right')} steer. Hold ${k('jump')} to drift round corners, ${k('sprint')} to boost. ${k('vehicle')} gets out, and at speed it launches you into a glide.`],
  ['fly', (k) => `Flying: steer with the mouse or ${k('left')} ${k('right')}, ${k('forward')} climbs and ${k('back')} dives. ${k('sprint')} boosts, ${k('jump')} brakes, ${k('punch')} fires. ${k('batwing')} bails out.`],
  ['ladder', (k) => `Walk into a ladder to climb it. ${k('forward')} and ${k('back')} climb, ${k('sprint')} slides down, ${k('jump')} kicks off.`],
  ['ledge', (k) => `You grab ledges when you fall short. ${k('left')} ${k('right')} shimmy, ${k('forward')} pulls up, ${k('back')} lets go. ${k('jump')} while holding ${k('back')} backflips off.`],
  ['zip', (k) => `Grapple to a zipline post with ${k('grapple')} or glide into the cable. ${k('jump')} lets go at full speed.`],
  ['wallrun', (k) => `Sprint along a wall and press ${k('jump')} to run on it. ${k('jump')} again to kick off.`],
  ['divebomb', (k) => `Gliding high? Press ${k('kick')} to dive bomb and flatten everyone where you land.`],
  ['takedown', (k) => `Hanging under an unaware goon? ${k('punch')} pulls them over the edge. Landing on one from above works too.`],
  // No combo number: WayneTech's Efficient Chains lowers the threshold (6 to 4), and prompts take
  // no live arguments, so it points at the chain icons, which light at the live cost.
  ['chain', (k) => `When your combo lights a chain icon, press ${k('chain1')}, ${k('chain2')} or ${k('chain3')} for a chain takedown that goes goon to goon. ${CHAIN_STEALTH_CLAUSE}`],
  ['chainTied', (k) => `Tied up! They can't get up for a few seconds. One more hit, ${k('punch')} or ${k('kick')}, knocks the whole bundle out.`],
  ['challenges', () => `Glowing bat pillars start challenges: glide rings, a rooftop run and an arena fight. Walk into one to begin.`],
  ['photo', (k) => `Press ${k('photo')} for photo mode. Frame a shot, add a caption and save it as a picture.`],
  ['gadgetWheel', (k) => `Hold ${k('gadgetWheel')} for the gadget wheel. Time slows while it is open. Point the mouse at a gadget or press 1 to 8, then let go to equip it. ${k('batarang')} uses it.`],
  ['gadgetRemote', (k) => `Remote batarang: press ${k('batarang')}, then steer it with the mouse for 3 seconds. It stuns every goon it passes and smashes glass signs. ${k('batarang')} again drops it.`],
  ['gadgetGel', (k) => `Explosive gel: tap ${k('batarang')} to spray up to three blobs on floors or walls, then hold ${k('batarang')} to set them all off. Cracked walls with a yellow ring break open.`],
  ['gadgetSmoke', (k) => `Smoke pellet: ${k('batarang')} drops a cloud five meters across. Goons inside are stunned and lose track of you.`],
  ['gadgetLauncher', (k) => `Line launcher: ${k('batarang')} fires a line to the wall ahead, up to 40 m, and you ride it across. It works mid-glide too. ${k('jump')} lets go.`],
  ['gadgetClaw', (k) => `Batclaw: ${k('batarang')} yanks the goon you aim at right to you for a free punch. It rips brute armor off and tears down vent covers and weak railings.`],
  ['gadgetFreeze', (k) => `Freeze blast: ${k('batarang')} traps a goon in ice. One hit shatters it and knocks them out.`],
  ['gadgetPopper', (k) => `Party popper: ${k('batarang')} throws a confetti bomb. Goons nearby forget the fight and dance.`],
  ['crouch', (k) => `Press ${k('crouch')} to crouch. You move slower, your footsteps go quiet, and goons have to be much closer to spot you. Stay out of the lamplight.`],
  ['silent', (k) => `Sneak up behind a goon who hasn't seen you and press ${k('punch')} for a silent takedown. It takes two seconds, and anyone within three meters hears it.`],
  ['perch', (k) => `Grapple ${k('grapple')} to a gargoyle to watch from above. Goons never look up unless they are hunting you.`],
  ['perchDrop', (k) => `On a gargoyle, press ${k('kick')} over a goon to drop on him and knock him out.`],
  // The fire key uses whatever gadget is equipped, and only the batarang clangs off a wall.
  ['distract', (k, move, equipped) => (!equipped || equipped === 'batarang'
    ? `Throw a batarang ${k('batarang')} at a wall to make a noise. Goons within twelve meters walk over to look.`
    : `Pick the batarang on the gadget wheel (hold ${k('gadgetWheel')}), then throw it ${k('batarang')} at a wall to make a noise. Goons within twelve meters walk over to look.`)],
  ['vent', (k) => `Crouch ${k('crouch')} in the steam over the floor vent and nobody can see you. Let a goon walk past, then take him from behind.`],
  ['ledgeStealth', (k) => `Hang under a catwalk edge and press ${k('punch')} when a goon walks over you to pull him down.`],
  ['spotted', (k) => `Spotted! Rifles hurt. Grapple ${k('grapple')} to a gargoyle to break their line of sight. They give up the hunt after eight seconds.`],
  ['rifle', (k) => `Rifle goons parry punches and aim with a red laser. ${k('dodge')} dodge when it locks on, and kick or stun them first.`],
  ['swarm', (k) => `Bat Swarm is ready. When your combo lights the bat icon, press ${k('chain4')} to call the bats down on up to six goons.`],
  ['wayneTech', (k) => `Level up! Press ${k('pause')} and open WayneTech to spend your upgrade point.`],
  ['vehicle', (k) => `The Batmobile is waiting. Walk up and press ${k('vehicle')} to get in.`],
];

export const PROMPT_IDS = ENTRIES.map(([id]) => id);

// The card that teaches each movement move (MOVE_TABLE ids): landing the move skips its card.
export const PROMPT_FOR_MOVE = {
  spinBackKick: 'movesDirection', spinBackfist: 'movesDirection', sideRound: 'movesDirection', sideHook: 'movesDirection',
  flyingKnee: 'movesSprint', runUppercut: 'movesSprint',
  airAxe: 'movesAir', backflipKick: 'movesAir', hurricane: 'movesAir', leapSmash: 'movesAir',
  stomp: 'stomp',
};

// `equipped`: the gadget on the fire key, for prompts that need a particular one (null: unknown).
export function promptText(id, bindings, equipped = null) {
  const k = (a) => `<kbd>${bindingLabel(bindings, a)}</kbd>`;
  const move = ['forward', 'left', 'back', 'right'].map((a) => bindingLabel(bindings, a)).join(' ');
  const entry = ENTRIES.find(([eid]) => eid === id);
  return entry ? entry[1](k, move, equipped) : '';
}

// The chain hints (game.js's HINTS). combatSystem.js's startChain emits the costs it actually
// charged against with the hint, so Efficient Chains (2 off each) shows here too. The base costs
// are only a fallback for a caller that sends none.
const BASE_CHAIN_COSTS = CHAINS.map((c) => c.cost);
// "a 4", "a 6", "an 8", "an 11", "an 18".
const article = (n) => (n === 8 || n === 11 || n === 18 ? 'an' : 'a');

export function chainLockedText(costs = BASE_CHAIN_COSTS) {
  const n = Math.min(...costs);
  return `Chain takedowns unlock at ${article(n)} ${n} hit combo. ${CHAIN_STEALTH_CLAUSE}`;
}

export function chainCostText(costs = BASE_CHAIN_COSTS) {
  return `Not enough combo. ${CHAINS[0].name} costs ${costs[0]}, ${CHAINS[1].name} ${costs[1]}, ${CHAINS[2].name} ${costs[2]}.`;
}

// Hero controls a tip card never covers: the silent takedown and the perch drop, and the chain
// takedowns and the Bat Swarm (their camera is the 'chain' mode, not the action camera, so
// follow.actionActive alone misses most of them). game.js's isBusy reads this.
// 'boarding' and 'fly': the Batwing (Part V2) swoop-in and flight, where the glide tip and every
// other traversal tutorial card would be talking over a different vehicle entirely.
export const QUIET_CONTROLS = new Set(['silent', 'perchDrop', 'chain', 'swarm', 'boarding', 'fly']);

// Queues prompts so they don't talk over each other. While isBusy() (a takedown, a chain, the
// Bat Swarm or an action camera shot is on screen) nothing new appears, and a card already up is
// taken down and shown again, in full, once the moment is over.
//
// Cards must arrive while they still mean something. A step's own tips used to wait behind every
// earlier card, six seconds each, and turned up whole steps later (the grapple-boost tip from the
// freighter showing at Ace Chemicals). So: newStep() marks a story step change, and a card queued
// more than one step ago is dropped rather than shown out of context (the controls page still has
// everything); a step's own tips go to the front with { first: true }; and relevance(id) (optional)
// can answer 'wait' (keep it queued, show it later: an on-foot tip while she drives) or 'drop' (it
// can no longer apply: the driving card once she is out of the car). A card on screen that stops
// applying comes down at once.
export function createPromptQueue(hud, getBindings, isEnabled, isBusy = () => false, getEquipped = () => null, relevance = () => true) {
  const queue = []; // { id, gen }
  const seen = new Set();
  let current = null;
  let t = 0, gen = 0;
  const has = (id) => queue.some((q) => q.id === id);
  const hide = () => { current = null; hud.hideHint(); };
  return {
    // `first`: jump the queue (this step's own tips; a vehicle's controls the moment she gets in).
    show(ids, { first = false } = {}) {
      for (const id of first ? [...ids].reverse() : ids) {
        if (seen.has(id) || has(id) || current === id) continue;
        if (first) queue.unshift({ id, gen }); else queue.push({ id, gen });
      }
    },
    // A new story step began: anything queued two or more steps ago is now stale.
    newStep() { gen += 1; },
    // She did the thing a card teaches: a queued card is skipped, one on screen stays to be read.
    learned(id) { if (current !== id) this.done(id); },
    // Marks a prompt as done early (the player already did the thing).
    done(id) {
      seen.add(id);
      const i = queue.findIndex((q) => q.id === id);
      if (i >= 0) queue.splice(i, 1);
      if (current === id) hide();
    },
    update(dt) {
      if (!isEnabled()) { if (current) hide(); return; }
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (gen - q.gen > 1 || relevance(q.id) === 'drop') queue.splice(i, 1);
      }
      if (current) {
        const r = relevance(current);
        if (r === 'drop') hide();
        else if (r === 'wait') { queue.unshift({ id: current, gen }); hide(); }
      }
      // The next card that applies right now; 'wait' ones stay queued for later.
      const nextIdx = current ? -1 : queue.findIndex((q) => relevance(q.id) === true);
      const candidate = current ?? (nextIdx >= 0 ? queue[nextIdx].id : undefined);
      // isBusy is asked about the prompt that would be on screen: a vehicle's own controls card may
      // show while that vehicle is in use, when everything else waits.
      if (isBusy(candidate)) { if (current) { queue.unshift({ id: current, gen }); hide(); } return; }
      t -= dt;
      if (current && t > 0) return;
      if (current) { seen.add(current); current = null; }
      const i = queue.findIndex((q) => relevance(q.id) === true);
      if (i < 0) return;
      const next = queue.splice(i, 1)[0].id;
      current = next;
      t = 6.5;
      hud.hint(promptText(next, getBindings(), getEquipped()), 6200);
    },
    reset() { queue.length = 0; seen.clear(); current = null; gen = 0; },
  };
}
