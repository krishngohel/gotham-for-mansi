// The whole game, in order. Steps without a type are "reach" steps: get to the site.
// tutorial: prompt ids introduced when the step begins (see ui/prompts.js).
//
// NEVER remove or rename a step id. Saves store the id (progress.stepId) and storyMigrate.js finds
// the step by it; an id that disappears makes that save fall back to its index read against the
// pre-Part D list, which lands it on the wrong step. Add new steps with new ids; retire one by
// keeping its id on a step that stands in its place.
export const STEPS = [
  { id: 'intro', type: 'cutscene', scene: 'intro' },
  { id: 'signal', text: 'Something is stuck to the Batsignal. Go and look.', site: 'signal', radius: 4.5, tutorial: ['move', 'look'], checkpoint: 'start' },
  { id: 'card', type: 'cutscene', scene: 'card' },
  { id: 'toDocks', text: 'The presents are at the Docks. Glide there.', site: 'wh3Roof', radius: 16, tutorial: ['glide', 'dive', 'grapple'], checkpoint: 'signal' },
  { id: 'f1', type: 'fight', fight: 'docksRoof', text: 'Take down the goons on the warehouse roof.', tutorial: ['punch', 'kick', 'counter'] },
  { id: 'toYard', text: 'More goons in the container yard below. Drop down.', site: 'yard', radius: 14, checkpoint: 'wh3Roof' },
  { id: 'f2', type: 'fight', fight: 'yard', text: 'Clear the container yard.', tutorial: ['block', 'dodge', 'throw'] },
  { id: 'toShip', text: 'The presents are on the freighter. Grapple aboard.', site: 'freighter', radius: 12, tutorial: ['grappleBoost'], checkpoint: 'yard' },
  { id: 'f3', type: 'fight', fight: 'freighter', text: 'Take back the ship.', tutorial: ['finisher', 'slam'] },
  { id: 'presents', type: 'collect', item: 'presents', site: 'presents', radius: 3, text: 'Grab the presents.', checkpoint: 'freighter' },
  { id: 'rewardPresents', type: 'cutscene', scene: 'presents' },
  { id: 'toNeon', text: 'The party was hauled to Neon Row. Head east to the Gazette building.', site: 'gazetteRoof', radius: 16, checkpoint: 'presents' },
  { id: 'n1', type: 'fight', fight: 'gazette', text: 'Knife goons. Break their guard with a kick or your cape.', tutorial: ['knife', 'cape'] },
  { id: 'toStreet', text: 'Follow the music down to the street.', site: 'neonStreet', radius: 14, checkpoint: 'gazetteRoof' },
  { id: 'n2', type: 'fight', fight: 'street', text: 'Clear the street.', tutorial: ['batarang'] },
  { id: 'toMonarch', text: 'The party is on the Monarch Theater roof.', site: 'monarchRoof', radius: 14, checkpoint: 'neonStreet' },
  { id: 'n3', type: 'fight', fight: 'monarch', text: 'Crash the party crashers.', tutorial: ['special'] },
  { id: 'monarchBalcony', type: 'fight', fight: 'monarchBalcony', text: 'Rifle goons guard the balcony below the roof. Stay in the shadows and take them down one at a time.', tutorial: ['crouch', 'silent', 'perch', 'perchDrop'], checkpoint: 'monarchBalconyEntry' },
  { id: 'party', type: 'collect', item: 'party', site: 'party', radius: 3, text: 'Take the party back.', checkpoint: 'monarchRoof' },
  { id: 'rewardParty', type: 'cutscene', scene: 'party' },
  { id: 'toAce', text: 'Something smells like frosting at Ace Chemicals. Go north.', site: 'aceYard', radius: 16, checkpoint: 'party' },
  { id: 'a1', type: 'fight', fight: 'aceYard', text: 'A brute. Stun it with your cape, then pile on.', tutorial: ['brute'] },
  { id: 'toFactory', text: 'Get up onto the factory roof.', site: 'factoryRoof', radius: 18, checkpoint: 'aceYard' },
  { id: 'a2', type: 'fight', fight: 'factory', text: 'Clear the factory roof.' },
  { id: 'toVat', text: 'The cake is on the deck over the vats.', site: 'vatDeck', radius: 11, checkpoint: 'factoryRoof' },
  { id: 'a3', type: 'fight', fight: 'vats', text: 'Protect the cake!' },
  { id: 'aceCatwalks', type: 'fight', fight: 'aceCatwalks', text: 'Rifle goons on the vat hall catwalks have the cake in their sights. Take them out quietly.', tutorial: ['distract', 'vent', 'ledgeStealth'], checkpoint: 'aceCatwalksEntry' },
  { id: 'cake', type: 'collect', item: 'cake', site: 'cake', radius: 3, text: 'Save the cake.', checkpoint: 'vatDeck' },
  { id: 'rewardCake', type: 'cutscene', scene: 'cake' },
  { id: 'toTower', text: 'The Joker is waiting at the clock tower. End this.', site: 'arena', radius: 18, checkpoint: 'cake' },
  { id: 'boss', type: 'boss', text: 'Defeat the Joker.', checkpoint: 'arena' },
  { id: 'finale', type: 'cutscene', scene: 'finale' },
  { id: 'credits', type: 'credits' },
];

// Lessons a later step repeats for a save that skipped the step teaching them. A save from before
// Part D jumps straight past Monarch Balcony, so its first predator room is the catwalks: there the
// basics come first, unless the move that proves them is already in progress.moves.
export const CATCH_UP = {
  aceCatwalks: [
    { move: 'silentTakedown', tips: ['crouch', 'silent'] },
    { move: 'perchDrop', tips: ['perch', 'perchDrop'] },
  ],
};

// The tip cards to show when `step` begins: its own, after any basics this save hasn't learned.
export function tutorialFor(step, moves = [], catchUp = CATCH_UP) {
  if (!step?.tutorial) return null;
  const extra = (catchUp[step.id] ?? []).filter((c) => !moves.includes(c.move)).flatMap((c) => c.tips);
  return extra.length ? [...extra, ...step.tutorial] : step.tutorial;
}
