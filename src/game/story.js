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
// New mission types (see flow.js): 'radio' (a dialogue beat), 'board' (walk up and get in the
// Batmobile, no teleport), 'chase' / 'battle' (ground vehicles, always preceded by a 'board' step
// in normal play), 'armada' (the Batwing), 'crasher' / 'ally' (Nightwing), 'interior' (a room
// site). Every one of them is read against window.__game at run time; when the part that provides
// it is missing, flow.js plays the step's `lines` and completes it on a short timer, so the whole
// story always reaches credits even with none of Vehicles, Batwing, Nightwing or Interiors merged
// in yet.
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
  // Built around wherever she stands when the step begins (flow.js revealShots): Nightwing appears
  // in front of her, unmasked, framed over her shoulder.
  crasherReveal: { reveal: 'nightwing', lines: [c('nightwing', 'Surprise. Sort of.')] },
  // The finale: a push over the GCPD roof party before the fireworks take it from here.
  finale: { shots: [{ from: { x: -6, y: 50, z: 26 }, to: { x: 6, y: 43.5, z: 12 }, look: { x: 6, y: 42, z: 6 }, dur: 5 }], lines: [c('gordon', 'Happy birthday, Mansi. Gotham owes you one.')] },
};

export const STEPS = [
  // ---------------------------------------------------------------- Prologue: GCPD roof
  { id: 'intro', type: 'cutscene', scene: 'intro', cinematic: CINEMATIC.intro },
  { id: 'signal', text: 'Walk to the Batsignal and see what is stuck to it.', nudge: g('alfred', 'The Batsignal, Mansi. The large lamp behind you with something taped to it.'), site: 'signal', radius: 4.5, tutorial: ['move', 'look'], checkpoint: 'start' },
  { id: 'card', type: 'cutscene', scene: 'card' },
  {
    // After the card: out from under the Batsignal lamp, facing the city and the Docks.
    id: 'gordonRadio', type: 'radio', text: 'Gordon is on the radio.', checkpoint: 'signal', placeAt: 'signalView',
    lines: [
      g('gordon', 'Gordon here. Sorry to spoil the surprise, but the surprise is already spoiled.'),
      g('gordon', 'We had a whole night planned for Mansi. Gifts, the band, a cake the size of a squad car.'),
      g('gordon', 'A man in a mask grabbed the first gift off the truck and ran before my officers blinked.'),
      g('gordon', 'Whoever he is, he was headed for the Docks. Happy birthday, by the way. Some night for it.'),
    ],
  },
  {
    id: 'crasherIntro', type: 'crasher', text: 'Follow the masked man as he runs for the Docks.', at: 'signal', to: 'wh3Roof',
    lines: [g('crasher', 'Nothing personal, birthday girl. Catch me if you can.')],
  },
  { id: 'actOneTitle', type: 'cutscene', scene: 'actOne', cinematic: CINEMATIC.actOne },

  // ---------------------------------------------------------------- Act 1: Docks and Neon Row
  { id: 'toDocks', text: 'Glide to the Docks and land on the warehouse roof.', nudge: g('alfred', "The Docks are the other way, I'm afraid. Follow the marker and the smell of fish."), site: 'wh3Roof', radius: 16, tutorial: ['glide', 'dive', 'grapple'], checkpoint: 'signal' },
  {
    id: 'alfredRadio', type: 'radio', text: 'Alfred is on the radio.', checkpoint: 'wh3Roof',
    lines: [
      g('alfred', 'Alfred here, Mansi. I have brought the car around. Try not to enjoy it too much.'),
      g('alfred', "It rather suits a birthday: entirely too much power for anyone's own good."),
    ],
  },
  {
    // SITES.dockBoard: the dock road at x = -90, a real street the city builder always leaves
    // clear (src/vehicles/vehicles.js's LINES), a short climb down from wh3Roof. The Batmobile
    // parks itself there (src/vehicles/vehicles.js's park(), called from flow.js's 'board'
    // handling) and waits; this step only ends once Mansi actually walks up and gets in.
    id: 'boardBatmobile', type: 'board', text: 'Climb down to the dock road and get in the Batmobile.', nudge: g('alfred', 'The car is on the dock road below you. It will not come up the stairs.'), site: 'dockBoard', tutorial: ['vehicle'],
  },
  {
    // The same dock road, running north from here up toward the warehouses at wh3Roof (x -60,
    // z 180). She is already driving by the time this starts (the board step above put her in
    // the car herself), so the van simply appears further down the road and comes to her. Ramming
    // it 3 times ends the chase before it gets in among the warehouses.
    id: 'batmobileChase', type: 'chase', text: 'Ram the Joker van 3 times before it reaches the warehouses.', site: 'wh3Roof',
    path: [{ x: -90, z: 40 }, { x: -90, z: 100 }, { x: -90, z: 165 }, { x: -90, z: 100 }, { x: -90, z: 40 }],
    lines: [g('alfred', 'A van just peeled off the dock road with your gift wrap sticking out the back. After it.')],
  },
  {
    id: 'toRoofAfterChase', text: 'Leave the car. Climb back up to the warehouse roof.', site: 'wh3Roof', radius: 16, checkpoint: 'wh3Roof',
    nudge: g('gordon', 'The driver went up to the warehouse roof. Nothing in the car worth staying for.'),
    lines: [
      g('alfred', "Van's done. Its driver bolted up to the warehouse roof, and your gift wrap went with him."),
      g('gordon', 'The goons up there loaded that van. They know where the rest of your presents went. Go and ask.'),
    ],
  },
  { id: 'f1', type: 'fight', fight: 'docksRoof', text: 'Take down the goons on the warehouse roof. Punch, kick, counter.', tutorial: ['punch', 'kick', 'counter'] },
  {
    id: 'toYard', text: 'Drop into the container yard below the warehouse.', site: 'yard', radius: 14, checkpoint: 'wh3Roof',
    nudge: g('alfred', 'The container yard is directly below you. One step off the edge will do it.'),
    lines: [
      g('alfred', 'One of them dropped a shipping manifest. Your presents went through the container yard below you.'),
      g('gordon', "The yard crew is Joker's. Clear them and the gifts are one fence away."),
    ],
  },
  { id: 'f2', type: 'fight', fight: 'yard', text: 'Clear the container yard. Dodge, block and throw.', tutorial: ['movesDirection', 'combo', 'dodge', 'throw', 'block'] },
  {
    id: 'toShip', text: 'Grapple onto the freighter at the end of the dock.', site: 'freighter', radius: 12, tutorial: ['grappleBoost'], checkpoint: 'yard',
    nudge: g('gordon', "Freighter's at the end of the dock, Mansi. Big grey thing. Hard to miss."),
    lines: [
      g('alfred', 'The manifest ends at the freighter. Every gift with your name on it is in that hold.'),
      g('gordon', "Harbor patrol has the mouth blocked, so it isn't sailing. Get aboard before they find another way out."),
    ],
  },
  { id: 'f3', type: 'fight', fight: 'freighter', text: 'Clear the freighter deck. Finish them before the next wave lands.', tutorial: ['movesSprint', 'movesAir', 'finisher', 'slam'] },
  {
    id: 'presents', type: 'collect', item: 'presents', site: 'presents', radius: 3, text: 'Pick up the presents at the marker on deck.', checkpoint: 'freighter',
    nudge: g('alfred', 'The presents are right there on the deck. One does traditionally pick them up.'),
    lines: [
      g('alfred', "Deck's clear. The crates by the marker are yours, ribbons and all."),
      g('gordon', "Grab them, Mansi. That's one piece of your party back. The rest is still out there."),
    ],
  },
  { id: 'rewardPresents', type: 'cutscene', scene: 'presents' },
  {
    id: 'toNeon', text: 'Head east to the Gazette building roof in Neon Row.', site: 'gazetteRoof', radius: 16, checkpoint: 'presents',
    nudge: g('oracle', "Neon Row is east, Mansi. Look for the Gazette sign. It's the loud one."),
    lines: [
      g('gordon', "Presents are safe. Now the music. A truck with the DJ's rig and the band's gear went east into Neon Row."),
      g('oracle', 'Oracle here. Traffic cameras caught your masked friend on the Gazette roof, gift still under his arm.'),
      g('alfred', 'The Gazette building, then. Follow the lights east. The whole party seems to have moved there without you.'),
    ],
  },
  { id: 'n1', type: 'fight', fight: 'gazette', text: 'Knife goons on the Gazette roof. Kick or cape to break their guard.', tutorial: ['knife', 'cape'] },
  {
    id: 'toStreet', text: 'Drop down to the Neon Row street, toward the music.', site: 'neonStreet', radius: 14, checkpoint: 'gazetteRoof',
    nudge: g('alfred', 'The music is below you, not above. Down to the street.'),
    lines: [
      g('alfred', "Hear that? Someone is playing your band's set list in the street below. Badly."),
      g('gordon', "That's the DJ's rig. Whoever has it is drawing a crowd of goons. Get down there and thin them out."),
    ],
  },
  { id: 'n2', type: 'fight', fight: 'street', text: 'Clear the street. Batarang the ones hanging back.', tutorial: ['batarang'] },
  {
    id: 'toMonarch', text: 'Climb to the Monarch Theater roof.', site: 'monarchRoof', radius: 14, checkpoint: 'neonStreet',
    nudge: g('gordon', 'Monarch Theater, Mansi. The roof with the party on it. Your party, technically.'),
    lines: [
      g('oracle', 'The music is coming from the Monarch Theater roof. They set up your whole party up there.'),
      g('gordon', 'And the mask just went up the Monarch fire escape. Two birds, Mansi. Get up there.'),
    ],
  },
  { id: 'n3', type: 'fight', fight: 'monarch', text: 'Clear the Monarch roof. Fill your meter and use a special.', tutorial: ['special'] },
  {
    id: 'crasherRooftop', type: 'crasher', text: 'Chase the masked man down to the theater balcony.', at: 'monarchRoof', to: 'monarchBalconyEntry', checkpoint: 'monarchRoof',
    lines: [
      g('mansi', 'Nowhere left to run, and I would like my present back.'),
      g('crasher', 'Wrong again. Happy birthday, for what it is worth.'),
    ],
  },
  { id: 'monarchBalcony', type: 'fight', fight: 'monarchBalcony', text: 'Rifle goons on the balcony. Crouch, stay hidden, take them one by one.', tutorial: ['crouch', 'silent', 'perch', 'perchDrop'], checkpoint: 'monarchBalconyEntry' },
  {
    id: 'party', type: 'collect', item: 'party', site: 'party', radius: 3, text: "Grab the DJ's rig and the band's gear on the balcony stage.", checkpoint: 'monarchRoof',
    nudge: g('alfred', 'The rig and the gear are on the stage. Do collect them before the encore.'),
    lines: [
      g('alfred', "Balcony's quiet. The DJ's rig and the band's gear are on the stage behind you, untouched."),
      g('gordon', 'Take them back before anyone else comes up those stairs.'),
    ],
  },
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
  { id: 'toAce', text: 'Go north to the Ace Chemicals gate.', nudge: g('gordon', 'Ace Chemicals is north. Follow the marker, or just follow the smell.'), site: 'aceGate', radius: 16, checkpoint: 'party' },
  {
    // SITES.aceGate: the real street just south of the Ace Chemicals compound, where the
    // Batmobile parks and waits (the compound itself is a merged super-block with no streets
    // inside). Ends the moment she gets in, same as boardBatmobile in Act 1.
    id: 'boardBatmobileAce', type: 'board', text: 'Get in the Batmobile waiting at the Ace Chemicals gate.', nudge: g('alfred', 'The car is by the gate, Mansi, and it is getting impatient.'), site: 'aceGateCar', tutorial: ['vehicle'], checkpoint: 'aceGate',
  },
  {
    // She drives herself in from the gate; startBattle no longer has to place her (she is already
    // in the Batmobile from the board step above).
    id: 'aceBattle', type: 'battle', text: 'Drive into the yard. Cannon the drone tanks.', site: 'aceYard',
    lines: [g('alfred', 'Motion in the yard, and none of it is friendly. Batmobile cannon, if you would.')],
  },
  {
    id: 'toBruteFight', text: 'Get out of the Batmobile. Face the brute in the yard on foot.', site: 'aceYard', radius: 16, checkpoint: 'aceYard', onFoot: true, tutorial: ['exitVehicle'],
    nudge: g('alfred', 'Out of the car. The gentleman in the yard would like a word, on foot.'),
    lines: [
      g('alfred', 'The tanks are scrap. One large gentleman in the yard did not get the message.'),
      g('gordon', "He's standing between you and the factory. Out of the car, Mansi. The cannon won't help on foot."),
    ],
  },
  { id: 'a1', type: 'fight', fight: 'aceYard', text: 'A brute. Cape to stun him, then hit him while he is dazed.', tutorial: ['brute'] },
  {
    id: 'toFactory', text: 'Climb to the factory roof inside Ace Chemicals.', site: 'factoryRoof', radius: 18, checkpoint: 'aceYard',
    nudge: g('oracle', 'Factory roof, Mansi. The tall one in the compound. Grapple will get you there.'),
    lines: [
      g('oracle', 'Oracle here. The factory roof is their lookout post. Every goon in the compound gets called from up there.'),
      g('gordon', "Take the lookouts down and the hall below goes blind. That's how you reach the cake without a full alarm."),
      g('alfred', 'Grapple up. The roof is the tall one in the middle of the compound.'),
    ],
  },
  { id: 'a2', type: 'fight', fight: 'factory', text: 'Take out the lookouts on the factory roof.' },
  {
    id: 'aceVanRadio', type: 'radio', text: 'Alfred is on the radio.', checkpoint: 'factoryRoof', face: 'aceGate',
    lines: [
      g('alfred', "One of Harley's crew just peeled out of the yard with the fireworks case for tonight's finale."),
      g('gordon', 'Cannot have midnight without the big finish. Get the Batmobile and run them down.'),
    ],
  },
  {
    // SITES.aceGate: the same real street just south of the compound the first Ace Chemicals
    // board step used. The Batmobile slides back in and waits (src/vehicles/vehicles.js's park(),
    // called from flow.js's 'board' handling); the step only ends once she walks up and gets in.
    id: 'boardBatmobileAce2', type: 'board', text: 'Get back in the Batmobile at the Ace gate.', nudge: g('alfred', 'The van is getting away and the car is at the gate. One of those is closer.'), site: 'aceGate', checkpoint: 'factoryRoof',
  },
  {
    // The real street outside the Ace Chemicals gate (z -90, clear of the compound's own merged
    // super-block, the same line SITES.aceGate sits on), running east past Neon Row's edge. She is
    // already driving by the time this starts (the board step above put her in the car herself),
    // so the van simply appears on the street and comes to her.
    id: 'aceVanChase', type: 'chase', text: "Ram Harley's van 3 times before it leaves the block.", site: 'aceHallDoor', checkpoint: 'factoryRoof',
    path: [{ x: 95, z: -90 }, { x: 150, z: -90 }, { x: 195, z: -90 }, { x: 150, z: -90 }, { x: 95, z: -90 }],
    lines: [g('alfred', 'There it goes, past the gate and east along the block. After it.')],
  },
  {
    id: 'harleyRadio', type: 'radio', text: 'Someone is on the Joker\'s open channel.', checkpoint: 'factoryRoof',
    lines: [
      g('harley', "Aw, is it somebody's birthday? Puddin' never lets ME have a party."),
      g('harley', 'The cake stays right where it is, birthday bat. Come say hi to my crew.'),
    ],
  },
  {
    id: 'toHarleyDoor', type: 'interior', text: 'Enter the chemical hall through the open loading dock door.', nudge: g('alfred', 'The loading dock door, on the hall. Still open, still probably a trap.'), site: 'aceHallDoor', room: 'aceHall', radius: 10, checkpoint: 'aceHallDoor',
    lines: [g('alfred', 'The loading dock is open. That is either careless or a trap. Mind the difference.')],
  },
  { id: 'harleyFight', type: 'fight', fight: HARLEY_FIGHT, text: 'Beat Harley and her crew in the chemical hall.' },
  // Harley's crew first (the hall), then out to the vat deck for the cake: Act 2 runs one way.
  {
    id: 'toVat', text: 'Go out to the deck over the vats. The cake is there.', site: 'vatDeck', radius: 11, checkpoint: 'aceHallDoor',
    nudge: g('harley', "Cake's on the vat deck, birthday bat. I'm not gonna wait all night."),
    lines: [
      g('alfred', 'Her crew is down and Harley has slipped out the back. The cake is on the deck over the vats.'),
      g('harley', "Fine, birthday bat. Come get it. It's right over the acid, where I left it."),
    ],
  },
  { id: 'a3', type: 'fight', fight: 'vats', text: 'Protect the cake on the vat deck. Keep every goon off it.' },
  // Off the vat deck to the hall's catwalk entrance: the stealth room is 57 m away, and its fight
  // otherwise began with no marker leading there.
  {
    id: 'toCatwalks', text: 'Reach the catwalk entrance along the hall wall. Crouch.', site: 'aceCatwalksEntry', radius: 8, checkpoint: 'vatDeck',
    nudge: g('oracle', 'The catwalk entrance is along the hall wall from the deck. Crouch before you go in.'),
    lines: [
      g('alfred', 'The cake is still standing, which is more than I can say for her crew.'),
      g('oracle', "Don't touch it yet. Rifles on the catwalks above have the deck covered. You can't rush rifles."),
      g('alfred', 'The catwalk entrance is off the deck, along the hall wall. Quietly, Mansi.'),
    ],
  },
  { id: 'aceCatwalks', type: 'fight', fight: 'aceCatwalks', text: 'Rifle goons on the catwalks. Stay hidden and take them silently.', tutorial: ['distract', 'vent', 'ledgeStealth'], checkpoint: 'aceCatwalksEntry' },
  {
    id: 'cake', type: 'collect', item: 'cake', site: 'cake', radius: 3, text: 'Pick up the cake on the vat deck.', checkpoint: 'vatDeck',
    nudge: g('alfred', 'The cake, Mansi. On the deck. It will not pick itself up.'),
    lines: [
      g('alfred', 'Catwalks are clear. Nobody is looking at that cake but you.'),
      g('gordon', 'Get it out of there. The baker has called my desk every five minutes since nine.'),
    ],
  },
  { id: 'rewardCake', type: 'cutscene', scene: 'cake' },
  {
    id: 'crasherReveal', type: 'radio', text: 'The masked man has caught up with you, mask in hand.', checkpoint: 'cake', cinematic: CINEMATIC.crasherReveal,
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
    id: 'nightwingTagRadio', type: 'radio', text: 'Gordon and Nightwing are both on the line.', checkpoint: 'arena',
    lines: [
      g('nightwing', 'Gift from the family, a little early: the Batwing is yours. Call it whenever you like. Just not for this bit.'),
      g('gordon', 'GCPD has the plaza sealed. Every goon the Joker has left is inside it, and your guests are past them.'),
      g('nightwing', "I'm going in the front. Come down and join me. Let's finish this together."),
    ],
  },
  { id: 'nightwingAlly', type: 'ally', text: 'Nightwing is with you. Head for the clock plaza.', at: 'plaza' },
  {
    id: 'toPlaza', text: 'Get down to the clock plaza and back Nightwing up.', site: 'plaza', radius: 14, checkpoint: 'plaza', tutorial: ['callBatwing'],
    nudge: g('nightwing', 'Still in the plaza, still outnumbered. Not a complaint. Well, a small one.'),
    lines: [
      g('nightwing', "I'm in the middle of the plaza and they just noticed me. Any time now, birthday girl."),
      g('alfred', 'Down the steps, past the fountain. He is cocky, not invincible. Go and stand next to him.'),
    ],
  },
  { id: 'plazaFight', type: 'fight', fight: 'plaza', text: 'Clear the plaza with Nightwing at your side.' },
  {
    id: 'toFunhouse', type: 'interior', text: 'Enter the funhouse door in the old cathedral.', nudge: g('nightwing', "Funhouse door is in the cathedral, down the side. Can't miss it."), site: 'funhouseDoor', room: 'funhouse', radius: 10, checkpoint: 'arena',
    lines: [g('nightwing', 'Funhouse door, dead ahead. This is exactly as safe as it sounds, which is to say, not very.')],
  },
  { id: 'funhouseFight', type: 'fight', fight: 'funhouseFight', text: 'Fight through the funhouse floor to reach the guests.' },
  {
    id: 'rescueGuestsRadio', type: 'radio', text: 'The last guests are found.', checkpoint: 'funhouse',
    lines: [
      g('nightwing', 'Found the band, tied up but tuning their instruments out of spite. Found the rest of the guest list too.'),
      g('gordon', "Everyone's accounted for, Mansi. Every guest, every gift, the cake, the band, all of it."),
      g('oracle', "One more thing before you go, and happy birthday, by the way. The clock tower's cameras just lit up. He's waiting for you."),
    ],
  },
  {
    id: 'toTower', text: 'Go to the clock tower. The Joker is waiting.', site: 'arena', radius: 18, checkpoint: 'funhouse',
    nudge: g('gordon', "The clock tower, Mansi. He's waited all night and he is not patient."),
    lines: [
      g('nightwing', "Go. We've got the guests. The tower is yours, and so is he."),
    ],
  },
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
