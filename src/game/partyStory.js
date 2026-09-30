// src/game/partyStory.js
// Pure mapping from a story step id (src/game/story.js STEPS) to the guest(s) who join the
// rooftop party once that step is reached, plus the finale trigger for celebrate(). No
// three.js, no DOM, no import of story.js itself (steps are passed in): src/game/game.js's party
// hook is the only place that actually touches window.__game.party or window.__game.events.
//
// Each id is the step whose START confirms a guest's rescue is done (the radio or cutscene beat
// right after the collect/reveal step, the same pattern as story.js's own rescueGuestsRadio):
//   party        (Act 1, DJ's rig + band's gear recovered) -> confirmed next at aceClueRadio -> dj
//   cake         (Act 2, the cake saved) -> confirmed next at rewardCake -> baker
//   crasherReveal (the mask comes off) -> nightwing
//   rescueGuestsRadio (Act 3, "found the band... the rest of the guest list") -> band, kids
//   finale (the finale cutscene) -> gordon, alfred, and celebrate()
export const STEP_GUESTS = {
  aceClueRadio: ['dj'],
  rewardCake: ['baker'],
  crasherReveal: ['nightwing'],
  rescueGuestsRadio: ['band', 'kids'],
  finale: ['gordon', 'alfred'],
};

export const FINALE_STEP_ID = 'finale';

const indexOf = (steps, id) => steps.findIndex((s) => s.id === id);

// Every guest whose join step is at or before `stepIndex` in `steps`, in STEP_GUESTS' own order.
// Used both for a live 'step' event (stepIndex is the step just entered) and for a resumed save's
// catch-up (stepIndex is wherever it left off): addGuest is idempotent, so calling this on every
// step and adding the whole list back is harmless, not just on the one step that just unlocked.
export function guestsUpTo(stepIndex, steps, stepGuests = STEP_GUESTS) {
  const out = [];
  for (const [id, guests] of Object.entries(stepGuests)) {
    const at = indexOf(steps, id);
    if (at !== -1 && at <= stepIndex) out.push(...guests);
  }
  return out;
}

// True once `stepIndex` has reached the finale step (live, or a save resumed past it).
export function celebrateAt(stepIndex, steps, finaleId = FINALE_STEP_ID) {
  const at = indexOf(steps, finaleId);
  return at !== -1 && stepIndex >= at;
}
