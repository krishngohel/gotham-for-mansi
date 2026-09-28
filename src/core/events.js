// Minimal event emitter used to decouple gameplay from audio, HUD and story.
export function createEvents() {
  const map = new Map();
  return {
    on(name, fn) {
      if (!map.has(name)) map.set(name, new Set());
      map.get(name).add(fn);
      return () => map.get(name)?.delete(fn);
    },
    emit(name, data) {
      for (const fn of map.get(name) ?? []) fn(data);
      for (const fn of map.get('*') ?? []) fn(name, data);
    },
  };
}

// Wires `sourceToId` (source event name -> id) onto `events`, emitting `emitName` with `{ id }`
// the first time each id's source event fires (later fires of the same or another source event
// mapped to the same id are ignored). Used for progress-tracking events like `moveLearned`,
// where several distinct triggers (ladderOn, ledgeGrab, ...) should each count once per run.
// Returns the Set of ids already seen, mainly so tests can inspect it.
export function onceEachId(events, sourceToId, emitName) {
  const seen = new Set();
  for (const [source, id] of Object.entries(sourceToId)) {
    events.on(source, () => { if (!seen.has(id)) { seen.add(id); events.emit(emitName, { id }); } });
  }
  return seen;
}
