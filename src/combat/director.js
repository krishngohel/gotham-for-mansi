// Decides which enemies may start an attack wind-up, so fights stay readable: a cap on
// simultaneous wind-ups, a cooldown per enemy after it attacks, and spacing between starts. Pure.
export function createDirector({ maxWindups = 2, gap = [2.2, 4], minSpacing = 0.35, rng }) {
  const active = new Set();
  const cooldown = new Map();
  let sinceStart = Infinity;
  const rand = () => (rng ? rng.next() : Math.random());

  return {
    get active() { return active; },
    configure(o) { if (o.maxWindups) maxWindups = o.maxWindups; if (o.gap) gap = o.gap; },
    // candidates: [{ id, ready }]. Returns ids that should begin winding up now.
    tick(dt, candidates) {
      sinceStart += dt;
      for (const [id, t] of cooldown) cooldown.set(id, t - dt);
      const started = [];
      const order = candidates.filter((c) => c.ready && !active.has(c.id) && (cooldown.get(c.id) ?? 0) <= 0);
      // Shuffle so the same enemy doesn't always go first.
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (const c of order) {
        if (active.size >= maxWindups || sinceStart < minSpacing) break;
        active.add(c.id);
        started.push(c.id);
        sinceStart = 0;
        if (minSpacing > 0) break;
      }
      return started;
    },
    // Called when the attack lands, whiffs, is countered or the enemy is interrupted.
    release(id) {
      if (!active.delete(id)) return;
      cooldown.set(id, gap[0] + rand() * (gap[1] - gap[0]));
    },
    // Keep an enemy from attacking for a while (fresh arrivals get a grace period).
    hold(id, seconds) { cooldown.set(id, Math.max(cooldown.get(id) ?? 0, seconds)); },
    remove(id) { active.delete(id); cooldown.delete(id); },
    clear() { active.clear(); cooldown.clear(); sinceStart = Infinity; },
  };
}
