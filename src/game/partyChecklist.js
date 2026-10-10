// The party she is getting back, item by item (shown as a card when one comes back, and on the
// pause menu's Party page). Pure: an item is back once the story reaches the step that ticks it,
// so a save shows the right ticks with no field of its own. In story order: the fireworks come
// back (Harley's van) before the cake.
export const CHECKLIST_TITLE = 'PARTY CHECKLIST';
export const CHECKLIST = [
  { id: 'gifts', step: 'toNeon', label: 'Birthday gifts', got: 'Gifts, back in one piece. Still missing: the music, the cake, the fireworks, and everyone who was invited.' },
  { id: 'gear', step: 'aceClueRadio', label: 'DJ rig and band gear', got: 'The music is coming home. Still no cake, no fireworks, and nobody to dance to it yet.' },
  { id: 'fireworks', step: 'harleyRadio', label: 'Fireworks', got: 'Midnight has its big finish again. Still missing: the cake, and everyone who was invited.' },
  { id: 'cake', step: 'crasherReveal', label: 'The cake', got: 'Cake, saved. Only the guests and the band are still out there. Go and get them.' },
  { id: 'guests', step: 'rescueGuestsRadio', label: 'Guests and the band', got: "Everyone's here. Every gift, the music, the cake, the fireworks, and the people. The whole party is back." },
];

export function checklistAt(stepIndex, steps) {
  return CHECKLIST.map((c) => {
    const at = steps.findIndex((s) => s.id === c.step);
    return { id: c.id, label: c.label, done: at !== -1 && stepIndex >= at };
  });
}

export const tickedBy = (stepId) => CHECKLIST.find((c) => c.step === stepId) ?? null;
