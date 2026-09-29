// Impact frames on a real-time clock (milliseconds), so hit-stop and slow motion never stretch
// them. Tier 1: a two-beat black and white flash. Tier 2: the flash, then a freeze inside a comic
// panel, then a short release. Pure: the caller passes the time and owns what the numbers drive.
export const IMPACT = {
  beat: 45, freeze: 300, release: 120,
  gap1: 400, gap2: 1500,
  freezeLook: 0.35, soft: 0.6,
};

export function createImpactTimeline(P = IMPACT) {
  let tier = 0, start = 0, mode = 'full';
  let last1 = -Infinity, last2 = -Infinity;
  // Soft mode drops the flash beats from tier 2 (it goes straight to the freeze).
  const flashLen = () => (mode === 'full' || tier === 1 ? P.beat * 2 : 0);
  const total = () => (tier === 2 ? flashLen() + P.freeze + P.release : flashLen());
  return {
    get active() { return tier > 0; },
    trigger(want, now, m = 'full') {
      if (m === 'off' || !(want >= 1)) return 0;
      const t = want >= 2 && now - last2 >= P.gap2 ? 2 : 1;
      if (tier && now - start < total()) {
        if (tier >= t) return 0;
      } else if (t === 1 && now - last1 < P.gap1) return 0;
      mode = m; tier = t; start = now; last1 = now;
      if (t === 2) last2 = now;
      return t;
    },
    sample(now, out) {
      out.impact = 0; out.freeze = false; out.panel = 0; out.panelT = 0; out.soft = mode === 'soft';
      if (!tier) return out;
      const e = now - start;
      const flash = flashLen();
      if (e < flash) {
        out.impact = mode === 'full' ? (e < P.beat ? 1 : 0.5) : P.soft;
        return out;
      }
      if (tier === 1) { tier = 0; return out; }
      const f = e - flash;
      if (f < P.freeze) {
        out.impact = P.freezeLook; out.freeze = true; out.panel = 1; out.panelT = f / P.freeze;
        return out;
      }
      const r = f - P.freeze;
      if (r < P.release) {
        out.impact = P.freezeLook * (1 - r / P.release); out.panel = 2; out.panelT = r / P.release;
        return out;
      }
      tier = 0;
      return out;
    },
    cancel() { tier = 0; },
    // Test hook only (window.__game.impact.pin): forget the rate limits as well.
    reset() { tier = 0; last1 = -Infinity; last2 = -Infinity; },
  };
}
