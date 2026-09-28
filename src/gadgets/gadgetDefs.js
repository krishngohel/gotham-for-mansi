// The eight gadgets, in wheel order (slot 0 at the top of the wheel, then clockwise). Pure data.
// kind: 'free' (no limit), 'cooldown' (seconds after each use), 'charges' (max; one refills every
// `recharge` seconds). unlock: null (always), { step } (once the story reaches that step id), or
// { finished: true } (after the credits). promptId is the tutorial prompt in src/ui/prompts.js.
export const GADGETS = [
  { id: 'batarang', slot: 0, name: 'Batarang', kind: 'free', unlock: null, promptId: 'batarang',
    unlockText: 'Always with you.', cardText: 'Stuns goons and interrupts attacks from far away.' },
  { id: 'remote', slot: 1, name: 'Remote Batarang', kind: 'cooldown', cooldown: 4, unlock: { step: 'toMonarch' }, promptId: 'gadgetRemote',
    unlockText: 'Unlocks after the street fight on Neon Row.', cardText: 'Steer it with the mouse. It stuns every goon it passes and smashes glass signs.' },
  { id: 'gel', slot: 2, name: 'Explosive Gel', kind: 'charges', max: 3, recharge: 5, unlock: { step: 'toNeon' }, promptId: 'gadgetGel',
    unlockText: 'Unlocks once the presents are safe.', cardText: 'Spray it, then set it off. Cracked walls hide secrets.' },
  { id: 'smoke', slot: 3, name: 'Smoke Pellet', kind: 'cooldown', cooldown: 12, unlock: { step: 'toStreet' }, promptId: 'gadgetSmoke',
    unlockText: 'Unlocks after the Gazette rooftop fight.', cardText: 'A cloud five meters across. Goons inside lose you.' },
  { id: 'launcher', slot: 4, name: 'Line Launcher', kind: 'cooldown', cooldown: 1.5, unlock: { step: 'toAce' }, promptId: 'gadgetLauncher',
    unlockText: 'Unlocks once the party is back.', cardText: 'A line to the wall ahead, and a free ride across. Even mid-glide.' },
  { id: 'claw', slot: 5, name: 'Batclaw', kind: 'cooldown', cooldown: 2, unlock: { step: 'toYard' }, promptId: 'gadgetClaw',
    unlockText: 'Unlocks after the first fight at the Docks.', cardText: 'Yank a goon to you for a free punch. Tears down vents and weak railings.' },
  { id: 'freeze', slot: 6, name: 'Freeze Blast', kind: 'charges', max: 2, recharge: 10, unlock: { step: 'toVat' }, promptId: 'gadgetFreeze',
    unlockText: 'Unlocks after the Ace Chemicals roof.', cardText: 'Ice for one goon. One hit shatters it and knocks them out.' },
  { id: 'popper', slot: 7, name: 'Party Popper', kind: 'cooldown', cooldown: 20, unlock: { finished: true }, promptId: 'gadgetPopper',
    unlockText: 'A birthday surprise, after the story.', cardText: 'Confetti for everyone. Goons nearby stop fighting and dance.' },
];

export const GADGET_IDS = GADGETS.map((g) => g.id);

export function gadgetById(id) {
  return GADGETS.find((g) => g.id === id) ?? null;
}

export function isUnlocked(def, progress, steps) {
  if (!def.unlock) return true;
  if (progress.finished === true) return true;
  if (def.unlock.finished) return false;
  const i = steps.findIndex((s) => s.id === def.unlock.step);
  return i >= 0 && progress.step >= i;
}

// Unlocked by the story so far, plus `sticky` (every gadget ever unlocked, kept by a new game).
export function unlockedIds(progress, steps, sticky = []) {
  return GADGETS.filter((g) => sticky.includes(g.id) || isUnlocked(g, progress, steps)).map((g) => g.id);
}
