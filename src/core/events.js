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
