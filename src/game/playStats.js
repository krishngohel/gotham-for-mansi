// Counters for the Progress page stats line. Pure: the game feeds it, save.js keeps it.
export function createPlayStats(stats) {
  return {
    tick(dt) { stats.playTime += dt; },
    glide(speed, dist) {
      if (speed > stats.topGlideSpeed) stats.topGlideSpeed = speed;
      stats.distanceGlided += dist;
    },
    ko(n = 1) { stats.kos += n; },
    combo(n) { if (n > stats.longestCombo) stats.longestCombo = n; },
    photo() { stats.photos += 1; },
  };
}

export function formatPlayTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

export const formatDistance = (m) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`);

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
