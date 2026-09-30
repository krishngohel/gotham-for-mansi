// The whole game, in order: Mansi's Birthday Night. Steps without a type are "reach" steps: get
// to the site. tutorial: prompt ids introduced when the step begins (see ui/prompts.js).
//
// This is Part S's full-reset rework (see docs/superpowers/specs/2026-09-30-birthday-night-design.md).
// Saves now live under a new key (src/core/save.js, src/game/storyMigrate.js) and are placed purely
// by stepId, so ids here are free to change between reworks. They stay stable *within* this story
// only so that gadget unlocks (src/gadgets/gadgetDefs.js) and the chapter list
// (src/game/progressTracker.js CHAPTERS) keep pointing at the right beat: 'intro', 'toDocks',
// 'toYard', 'toNeon', 'toStreet', 'toMonarch', 'toAce', 'toVat', 'toTower' must not move to a
// different place in the story than the one they already mark.
//
// New mission types (see flow.js): 'radio' (a dialogue beat), 'chase' / 'battle' (ground vehicles),
// 'armada' (the Batwing), 'crasher' / 'ally' (Nightwing), 'interior' (a room site). Every one of
// them is read against window.__game at run time; when the part that provides it is missing, flow.js
// plays the step's `lines` and completes it on a short timer, so the whole story always reaches
// credits even with none of Vehicles, Batwing, Nightwing or Interiors merged in yet.
import { HARLEY_FIGHT } from './fights.js';

const g = (speaker, text) => ({ speaker, portrait: speaker, text });
const c = (who, text) => ({ who, text });

// Cinematic camera moments (window.__game.cinematic, from the 'night' integration branch): a
// letterboxed in-engine shot layered before the matching comic/radio beat. Optional by design
// (flow.js's playCinematicFor degrades to nothing when the part isn't there), so these four moments
// still play their existing comic pages or dialogue either way.
const CINEMATIC = {
  // Prologue: a slow push toward the Batsignal as it turns into a cake.
  intro: { shots: [{ from: { x: -26, y: 52, z: 8 }, to: { x: -7, y: 44.4, z: -7 }, look: { x: -12, y: 43.6, z: -12 }, dur: 5 }], lines: [c('joker', 'Good evening, Gotham. Try to keep up, birthday bat.')] },
  // Act openers: an establishing orbit over the act's district.
  actOne: { orbit: { center: { x: -30, y: 24, z: 185 }, radius: 62, height: 26, dur: 6 }, lines: [c('alfred', 'The Docks, and Neon Row beyond them. Rather a lot of city for one birthday.')] },
  actTwo: { orbit: { center: { x: 140, y: 20, z: -150 }, radius: 58, height: 28, dur: 6 }, lines: [c('gordon', 'Ace Chemicals. Whatever he is cooking up in there, it will not be subtle.')] },
  actThree: { orbit: { center: { x: -95, y: 24, z: -155 }, radius: 68, height: 32, dur: 6 }, lines: [c('gordon', 'The clock plaza. Midnight is close, and so is he.')] },
  // The Crasher's mask comes off: a push toward Nightwing by the Ace Chemicals gate.
  crasherReveal: { shots: [{ from: { x: 194, y: 15, z: -102 }, to: { x: 183, y: 11, z: -113 }, look: { x: 184, y: 10.5, z: -112 }, dur: 5 }], lines: [c('nightwing', 'Surprise. Sort of.')] },
  // The finale: a push over the GCPD roof party before the fireworks take it from here.
  finale: { shots: [{ from: { x: -6, y: 50, z: 26 }, to: { x: 6, y: 43.5, z: 12 }, look: { x: 6, y: 42, z: 6 }, dur: 5 }], lines: [c('gordon', 'Happy birthday, Mansi. Gotham owes you one.')] },
};

export const STEPS = [
  // ---------------------------------------------------------------- Prologue: GCPD roof
  { id: 'intro', type: 'cutscene', scene: 'intro', cinematic: CINEMATIC.intro },
  { id: 'signal', text: 'Something is stuck to the Batsignal. Go and look.', site: 'signal', radius: 4.5, tutorial: ['move', 'look'], checkpoint: 'start' },
  { id: 'card', type: 'cutscene', scene: 'card' },
  {
    id: 'gordonRadio', type: 'radio', text: 'Gordon is on the radio.', checkpoint: 'signal',
    lines: [
      g('gordon', 'Gordon here. Sorry to spoil the surprise, but the surprise is already spoiled.'),
      g('gordon', 'We had a whole night planned for Mansi. Gifts, the band, a cake the size of a squad car.'),
      g('gordon', 'A man in a mask grabbed the first gift off the truck and ran before my officers blinked.'),
      g('gordon', 'Whoever he is, he was headed for the Docks. Happy birthday, by the way. Some night for it.'),
    ],
  },
  {
    id: 'crasherIntro', type: 'crasher', text: 'A masked figure is getting away with the first gift.', at: 'signal', to: 'wh3Roof',
    lines: [g('crasher', 'Nothing personal, birthday girl. Catch me if you can.')],
  },
  { id: 'actOneTitle', type: 'cutscene', scene: 'actOne', cinematic: CINEMATIC.actOne },

  // ---------------------------------------------------------------- Act 1: Docks and Neon Row
  { id: 'toDocks', text: 'The presents are at the Docks. Glide there.', site: 'wh3Roof', radius: 16, tutorial: ['glide', 'dive', 'grapple'], checkpoint: 'signal' },
  {
    id: 'alfredRadio', type: 'radio', text: 'Alfred is on the radio.', checkpoint: 'wh3Roof',
    lines: [
      g('alfred', 'Alfred here, Mansi. I have brought the car around. Try not to enjoy it too much.'),
      g('alfred', "It rather suits a birthday: entirely too much power for anyone's own good."),
    ],
  },
  {
    // The dock road running north along x = -90, from the yard up toward the warehouses at
    // wh3Roof (x -60, z 180): a real street the city builder always leaves clear (see
    // src/vehicles/vehicles.js's LINES). Ramming the van 3 times ends the chase before it gets in
    // among the warehouses.
    id: 'batmobileChase', type: 'chase', text: 'Run down the Joker van before it reaches the warehouses. Ram it 3 times.', site: 'wh3Roof',
    path: [{ x: -90, z: 40 }, { x: -90, z: 100 }, { x: -90, z: 165 }, { x: -90, z: 100 }, { x: -90, z: 40 }],
    lines: [g('alfred', 'A van just peeled off the dock road with your gift wrap sticking out the back. After it.')],
  },
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
  {
    id: 'crasherRooftop', type: 'crasher', text: 'The masked man is right there.', at: 'monarchRoof', to: 'monarchBalconyEntry', checkpoint: 'monarchRoof',
    lines: [
      g('mansi', 'Nowhere left to run, and I would like my present back.'),
      g('crasher', 'Wrong again. Happy birthday, for what it is worth.'),
    ],
  },
  { id: 'monarchBalcony', type: 'fight', fight: 'monarchBalcony', text: 'Rifle goons guard the balcony below the roof. Stay in the shadows and take them down one at a time.', tutorial: ['crouch', 'silent', 'perch', 'perchDrop'], checkpoint: 'monarchBalconyEntry' },
  { id: 'party', type: 'collect', item: 'party', site: 'party', radius: 3, text: "Take back the DJ's rig and the band's gear.", checkpoint: 'monarchRoof' },
  { id: 'rewardParty', type: 'cutscene', scene: 'party' },
  {
    id: 'aceClueRadio', type: 'radio', text: 'Gordon is on the radio.', checkpoint: 'party',
    lines: [
      g('gordon', 'The DJ says thank you, by the way. Never seen a rescue with a better beat drop.'),
      g('gordon', "Forensics found the Joker's next clue. It smells like burnt sugar and industrial solvent."),
      g('gordon', 'Ace Chemicals. Of course it is Ace Chemicals. Head north.'),
    ],
  },

  // ---------------------------------------------------------------- Act 2: Ace Chemicals
  { id: 'actTwoTitle', type: 'cutscene', scene: 'actTwo', cinematic: CINEMATIC.actTwo },
  { id: 'toAce', text: 'Something smells like frosting at Ace Chemicals. Go north.', site: 'aceYard', radius: 16, checkpoint: 'party' },
  {
    id: 'aceBattle', type: 'battle', text: 'Drone tanks are dug in across the yard. Use the cannon.', site: 'aceYard',
    lines: [g('alfred', 'Motion in the yard, and none of it is friendly. Batmobile cannon, if you would.')],
  },
  { id: 'a1', type: 'fight', fight: 'aceYard', text: 'A brute. Stun it with your cape, then pile on.', tutorial: ['brute'] },
  { id: 'toFactory', text: 'Get up onto the factory roof.', site: 'factoryRoof', radius: 18, checkpoint: 'aceYard' },
  { id: 'a2', type: 'fight', fight: 'factory', text: 'Clear the factory roof.' },
  { id: 'toVat', text: 'The cake is on the deck over the vats.', site: 'vatDeck', radius: 11, checkpoint: 'factoryRoof' },
  {
    id: 'harleyRadio', type: 'radio', text: 'Someone is on the Joker\'s open channel.', checkpoint: 'factoryRoof',
    lines: [
      g('harley', "Aw, is it somebody's birthday? Puddin' never lets ME have a party."),
      g('harley', 'The cake stays right where it is, birthday bat. Come say hi to my crew.'),
    ],
  },
  {
    id: 'toHarleyDoor', type: 'interior', text: "Harley's crew is in the chemical hall. The loading dock door is open.", site: 'aceHallDoor', room: 'aceHall', radius: 10, checkpoint: 'aceHallDoor',
    lines: [g('alfred', 'The loading dock is open. That is either careless or a trap. Mind the difference.')],
  },
  { id: 'harleyFight', type: 'fight', fight: HARLEY_FIGHT, text: "Fight through Harley's crew." },
  { id: 'a3', type: 'fight', fight: 'vats', text: 'Protect the cake, no matter what she throws at you!' },
  { id: 'aceCatwalks', type: 'fight', fight: 'aceCatwalks', text: 'Rifle goons on the vat hall catwalks have the cake in their sights. Take them out quietly.', tutorial: ['distract', 'vent', 'ledgeStealth'], checkpoint: 'aceCatwalksEntry' },
  { id: 'cake', type: 'collect', item: 'cake', site: 'cake', radius: 3, text: "Save the baker's cake.", checkpoint: 'vatDeck' },
  { id: 'rewardCake', type: 'cutscene', scene: 'cake' },
  {
    id: 'crasherReveal', type: 'radio', text: 'The masked man is waiting by the gate, mask in hand.', checkpoint: 'cake', cinematic: CINEMATIC.crasherReveal,
    lines: [
      g('crasher', 'Before you swing at me again, you should probably see who you have been chasing.'),
      g('nightwing', "Nightwing. Surprise. Well, it WAS supposed to be a surprise, before I kept grabbing your gifts on camera."),
      g('nightwing', "The Bat-family planned a whole reveal for later tonight. The Joker rather ruined the timing."),
      g('mansi', 'You have been running from me across two rooftops in what I can only assume were very uncomfortable boots.'),
      g('nightwing', 'In my defence, that part was extremely fun. Come on, birthday girl. Let us go get the rest of your party back.'),
    ],
  },

  // ---------------------------------------------------------------- Act 3: The Clock Plaza
  { id: 'actThreeTitle', type: 'cutscene', scene: 'actThree', cinematic: CINEMATIC.actThree },
  {
    id: 'armadaRun', type: 'armada', text: 'The Joker has balloons rigged over the clock plaza. Take the Batwing through them.', site: 'balcony', balloons: 14, checkpoint: 'arena',
    lines: [
      g('nightwing', "Batwing's yours whenever you call it. I will meet you on the ground."),
      g('joker', 'Up, up and away! Try not to pop too many of my party balloons, party girl!'),
    ],
  },
  {
    id: 'nightwingTagRadio', type: 'radio', text: 'Gordon and Nightwing are both on the line.', checkpoint: 'arena',
    lines: [
      g('gordon', "GCPD is holding the plaza perimeter. Nobody else gets in or out until you're done."),
      g('nightwing', "And I am holding the middle of it. Let's finish this together."),
    ],
  },
  { id: 'nightwingAlly', type: 'ally', text: 'Nightwing has your back for this one.', at: 'plaza' },
  { id: 'toPlaza', text: 'Get down to the plaza and back Nightwing up.', site: 'plaza', radius: 14, checkpoint: 'plaza' },
  { id: 'plazaFight', type: 'fight', fight: 'plaza', text: 'Clear the plaza with Nightwing at your side.' },
  {
    id: 'toFunhouse', type: 'interior', text: 'The last of the party is behind the funhouse door in the old cathedral.', site: 'funhouseDoor', room: 'funhouse', radius: 10, checkpoint: 'arena',
    lines: [g('nightwing', 'Funhouse door, dead ahead. This is exactly as safe as it sounds, which is to say, not very.')],
  },
  { id: 'funhouseFight', type: 'fight', fight: 'funhouseFight', text: "Fight through the Joker's funhouse floor." },
  {
    id: 'rescueGuestsRadio', type: 'radio', text: 'The last guests are found.', checkpoint: 'funhouse',
    lines: [
      g('nightwing', 'Found the band, tied up but tuning their instruments out of spite. Found the rest of the guest list too.'),
      g('gordon', "Everyone's accounted for, Mansi. Every guest, every gift, the cake, the band, all of it."),
      g('oracle', "One more thing before you go, and happy birthday, by the way. The clock tower's cameras just lit up. He's waiting for you."),
    ],
  },
  { id: 'toTower', text: 'The Joker is waiting at the clock tower. End this.', site: 'arena', radius: 18, checkpoint: 'funhouse' },
  { id: 'boss', type: 'boss', text: 'Defeat the Joker.', checkpoint: 'arena' },
  { id: 'finale', type: 'cutscene', scene: 'finale', cinematic: CINEMATIC.finale },
  { id: 'credits', type: 'credits' },
];

// Lessons a later step repeats for a save that skipped the step teaching them.
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
