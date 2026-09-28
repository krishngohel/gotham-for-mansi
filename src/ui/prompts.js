// Tutorial prompts. Every key shown is read from the live bindings.
import { bindingLabel } from '../core/bindings.js';

export function promptText(id, bindings) {
  const k = (a) => `<kbd>${bindingLabel(bindings, a)}</kbd>`;
  const move = ['forward', 'left', 'back', 'right'].map((a) => bindingLabel(bindings, a)).join(' ');
  const P = {
    move: `Move with <kbd>${move}</kbd>. Click the screen to aim the camera with your mouse.`,
    look: `Follow the yellow beacon and the marker to your next objective. ${k('help')} shows every control.`,
    glide: `Run off the edge and hold ${k('jump')} in the air to glide.`,
    dive: `Gliding: hold ${k('sprint')} to dive and build speed, then hold ${k('back')} to swoop back up. Speed buys height.`,
    grapple: `Look at a ledge until the blue marker appears, then press ${k('grapple')} to grapple up.`,
    grappleBoost: `Tap ${k('jump')} during a grapple to launch over the ledge and keep gliding.`,
    punch: `Click ${k('punch')} to punch. You leap to whichever goon you steer toward.`,
    kick: `Press ${k('kick')} to kick. Kicks hit harder and reach farther. In the air it is a jump-kick.`,
    counter: `A blue bolt over a goon means an attack is coming. Tap ${k('block')} to counter it.`,
    block: `Hold ${k('block')} to block when a counter is too late.`,
    throw: `Press ${k('throw')} next to a goon to grab and hurl them. Aim at their friends to bowl them over.`,
    slam: `Jump and press ${k('punch')} in the air to slam down and knock over everyone around you.`,
    finisher: `Keep hitting the same goon: every 4th punch is a haymaker and every 3rd kick a spinning heel kick.`,
    dodge: `Press ${k('dodge')} to dodge roll. Rolling toward a goon vaults right over them.`,
    knife: `Knife goons parry punches. Kick them or stun them with your cape first.`,
    cape: `Press ${k('cape')} to swirl your cape and stun everyone in front of you.`,
    batarang: `Press ${k('batarang')} to throw a batarang. It stuns goons and interrupts attacks from far away.`,
    special: `Chain 8 hits and the combo turns yellow. Press ${k('special')} for a special takedown.`,
    brute: `Brutes can't be countered: their bolt is red. Dodge with ${k('dodge')}, stun with ${k('cape')}, then pile on.`,
    detective: `Press ${k('detective')} for detective vision. It reveals goons, your objective and hidden balloons.`,
    balloons: `Twelve birthday balloons are hidden around Gotham. Each one holds a message.`,
    ladder: `Walk into a ladder to climb it. ${k('forward')} and ${k('back')} climb, ${k('sprint')} slides down, ${k('jump')} kicks off.`,
    ledge: `You grab ledges when you fall short. ${k('left')} ${k('right')} shimmy, ${k('forward')} pulls up, ${k('back')} lets go. ${k('jump')} while holding ${k('back')} backflips off.`,
    zip: `Grapple to a zipline post with ${k('grapple')} or glide into the cable. ${k('jump')} lets go at full speed.`,
    wallrun: `Sprint along a wall and press ${k('jump')} to run on it. ${k('jump')} again to kick off.`,
    dive: `Gliding high? Press ${k('kick')} to dive bomb and flatten everyone where you land.`,
    takedown: `Hanging under an unaware goon? ${k('punch')} pulls them over the edge. Landing on one from above works too.`,
  };
  return P[id] ?? '';
}

// Queues prompts so they don't talk over each other.
export function createPromptQueue(hud, getBindings, isEnabled) {
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
      t -= dt;
      if (current && t > 0) return;
      if (current) { seen.add(current); current = null; }
      const next = queue.shift();
      if (!next) return;
      current = next;
      t = 6.5;
      hud.hint(promptText(next, getBindings()), 6200);
    },
    reset() { queue.length = 0; seen.clear(); current = null; },
  };
}
