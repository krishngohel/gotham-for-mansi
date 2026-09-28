// Tutorial prompts. Every key shown is read from the live bindings.
import { bindingLabel } from '../core/bindings.js';

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
  ['punch', (k) => `Click ${k('punch')} to punch. You leap to whichever goon you steer toward.`],
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
  ['special', (k) => `Chain 8 hits and the combo turns yellow. Press ${k('special')} for a special takedown.`],
  ['brute', (k) => `Brutes can't be countered: their bolt is red. Dodge with ${k('dodge')}, stun with ${k('cape')}, then pile on.`],
  ['detective', (k) => `Press ${k('detective')} for detective vision. It reveals goons, your objective and hidden balloons.`],
  ['balloons', () => `Twelve birthday balloons are hidden around Gotham. Each one holds a message.`],
  ['ladder', (k) => `Walk into a ladder to climb it. ${k('forward')} and ${k('back')} climb, ${k('sprint')} slides down, ${k('jump')} kicks off.`],
  ['ledge', (k) => `You grab ledges when you fall short. ${k('left')} ${k('right')} shimmy, ${k('forward')} pulls up, ${k('back')} lets go. ${k('jump')} while holding ${k('back')} backflips off.`],
  ['zip', (k) => `Grapple to a zipline post with ${k('grapple')} or glide into the cable. ${k('jump')} lets go at full speed.`],
  ['wallrun', (k) => `Sprint along a wall and press ${k('jump')} to run on it. ${k('jump')} again to kick off.`],
  ['divebomb', (k) => `Gliding high? Press ${k('kick')} to dive bomb and flatten everyone where you land.`],
  ['takedown', (k) => `Hanging under an unaware goon? ${k('punch')} pulls them over the edge. Landing on one from above works too.`],
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
];

export const PROMPT_IDS = ENTRIES.map(([id]) => id);

// `equipped`: the gadget on the fire key, for prompts that need a particular one (null: unknown).
export function promptText(id, bindings, equipped = null) {
  const k = (a) => `<kbd>${bindingLabel(bindings, a)}</kbd>`;
  const move = ['forward', 'left', 'back', 'right'].map((a) => bindingLabel(bindings, a)).join(' ');
  const entry = ENTRIES.find(([eid]) => eid === id);
  return entry ? entry[1](k, move, equipped) : '';
}

// Queues prompts so they don't talk over each other. While isBusy() (a takedown or an action
// camera shot is on screen) nothing new appears, and a card already up is taken down and shown
// again, in full, once the moment is over.
export function createPromptQueue(hud, getBindings, isEnabled, isBusy = () => false, getEquipped = () => null) {
  const queue = [];
  const seen = new Set();
  let current = null;
  let t = 0;
  return {
    show(ids) {
      for (const id of ids) if (!seen.has(id) && !queue.includes(id)) queue.push(id);
    },
    // Marks a prompt as done early (the player already did the thing).
    done(id) {
      seen.add(id);
      const i = queue.indexOf(id);
      if (i >= 0) queue.splice(i, 1);
      if (current === id) { current = null; hud.hideHint(); }
    },
    update(dt) {
      if (!isEnabled()) { if (current) { current = null; hud.hideHint(); } return; }
      if (isBusy()) { if (current) { queue.unshift(current); current = null; hud.hideHint(); } return; }
      t -= dt;
      if (current && t > 0) return;
      if (current) { seen.add(current); current = null; }
      const next = queue.shift();
      if (!next) return;
      current = next;
      t = 6.5;
      hud.hint(promptText(next, getBindings(), getEquipped()), 6200);
    },
    reset() { queue.length = 0; seen.clear(); current = null; },
  };
}
