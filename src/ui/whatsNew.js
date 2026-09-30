// The "What's new" page: what changed for Mansi's Birthday Night, the story reset. Pure content
// (bindings in, a list of short lines out) so it can be unit tested without a DOM, and so the two
// key call outs (the Batmobile, the Batwing) always show the real, live binding rather than a
// hardcoded key name.
import { bindingLabel } from '../core/bindings.js';
import MANSI from '../mansi.config.js';

export function whatsNewItems(bindings) {
  const t = bindingLabel(bindings, 'vehicle');
  const y = bindingLabel(bindings, 'batwing');
  return [
    'A brand new story, in three acts, with the Party Crasher mystery running right through them.',
    `Summon the Batmobile with ${t}, or just steal a car off the street and drive that instead.`,
    `Call the Batwing with ${y} and take the fight to the sky.`,
    'Nightwing fights at your side for the last act, and Harley Quinn has strong opinions about her invitation.',
    'Walk right in this time: the Joker funhouse and the Ace Chemicals halls both have real doors now.',
    'New in engine cinematic camera shots for the biggest moments, letterbox bars and all.',
    'A full birthday party finale on the GCPD roof, guests, dancing and all.',
    'Two new vehicle challenges: the Gotham Grand Prix and Wing Walk.',
    'Impact frames freeze the biggest hits for a beat, like a comic panel come to life.',
  ];
}

export function whatsNewHeadline() { return `New tonight, just for you, ${MANSI.name}:`; }
