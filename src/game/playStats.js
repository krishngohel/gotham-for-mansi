// Counters for the Progress page stats line. Pure: the game feeds it, save.js keeps it.
export function createPlayStats(stats) {
  return {
    tick(dt) { if (Number.isFinite(dt) && dt > 0) stats.playTime += dt; },
    glide(speed, dist) {
      if (Number.isFinite(speed) && speed > 0 && speed > stats.topGlideSpeed) stats.topGlideSpeed = speed;
      if (Number.isFinite(dist) && dist > 0) stats.distanceGlided += dist;
    },
    ko(n = 1) { if (Number.isFinite(n) && n > 0) stats.kos += n; },
    combo(n) { if (n > stats.longestCombo) stats.longestCombo = n; },
    photo() { stats.photos += 1; },
  };
}

export function formatPlayTime(sec) {
  const s = Number.isFinite(sec) && sec > 0 ? Math.floor(sec) : 0;
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const formatDistance = (m) => {
  const v = Number.isFinite(m) && m > 0 ? m : 0;
  return v < 1000 ? `${Math.round(v)} m` : `${(v / 1000).toFixed(1)} km`;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function formatStatsLine(s, { crimes = 0 } = {}) {
  return [
    `Play time ${formatPlayTime(s.playTime)}`,
    `${plural(s.kos, 'goon', 'goons')} knocked out`,
    `${plural(crimes, 'crime', 'crimes')} stopped`,
    `Longest combo ${s.longestCombo}`,
    `Top glide speed ${Math.round(s.topGlideSpeed * 3.6)} km/h`,
    `${formatDistance(s.distanceGlided)} glided`,
  ].join(' · ');
}
