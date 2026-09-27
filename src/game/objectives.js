// Walks the story step list. Pure: the game reports events, the runner decides when a step is done.

function matches(step, ev) {
  switch (step.type) {
    case 'cutscene': return ev.type === 'cutsceneDone' && ev.scene === step.scene;
    case 'fight': return ev.type === 'fightDone' && ev.id === step.fight;
    case 'collect': return ev.type === 'collected' && ev.item === step.item;
    case 'boss': return ev.type === 'bossDone';
    case 'credits': return false;
    default: return ev.type === 'reached' && ev.step === step.id;
  }
}

export function createObjectives(steps, startIndex = 0) {
  let index = Math.max(0, Math.min(steps.length, Number.isInteger(startIndex) ? startIndex : 0));
  return {
    get index() { return index; },
    get step() { return steps[index] ?? null; },
    get done() { return index >= steps.length; },
    handle(event) {
      const s = steps[index];
      if (!s || !matches(s, event)) return false;
      index += 1;
      return true;
    },
    jump(i) { index = Math.max(0, Math.min(steps.length, i)); },
  };
}

// The respawn point for a step: its own checkpoint, or the nearest earlier one.
export function checkpointFor(steps, index) {
  for (let i = Math.min(index, steps.length - 1); i >= 0; i--) if (steps[i].checkpoint) return steps[i].checkpoint;
  return null;
}
