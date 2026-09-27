// The Joker's recorded lines. One line at a time; music dips underneath while he talks.
const LINES = ['intro1', 'intro2', 'presents', 'party', 'cake', 'bossIntro', 'drop', 'gas', 'stunned', 'dance', 'bossEnd', 'laugh'];

export function createVoice({ base = './assets/voice/', getVolume, duck = () => {} }) {
  const clips = new Map();
  for (const id of LINES) {
    const a = new Audio(`${base}${id}.mp3`);
    a.preload = 'auto';
    a.addEventListener('ended', () => { if (current === a) { current = null; duck(false); } });
    clips.set(id, a);
  }
  let current = null;
  return {
    LINES,
    has: (id) => clips.has(id),
    // interrupt: stop whatever he was saying. Otherwise a new line waits its turn by being skipped.
    say(id, { interrupt = true } = {}) {
      const a = clips.get(id);
      if (!a) return false;
      if (current && !current.ended && !current.paused) {
        if (!interrupt) return false;
        current.pause();
      }
      const v = getVolume();
      a.volume = Math.max(0, Math.min(1, v.master * Math.max(v.sfx, 0.001) * 1.1));
      a.currentTime = 0;
      current = a;
      duck(true);
      a.play().catch(() => { current = null; duck(false); });
      return true;
    },
    stop() { if (current) { current.pause(); current = null; duck(false); } },
    get speaking() { return !!current && !current.paused && !current.ended; },
  };
}
