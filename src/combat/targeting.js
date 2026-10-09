// Freeflow target selection: the enemy that best matches the stick direction, then distance. Pure.
export function selectTarget(origin, dir, enemies, { range = 8, allowDown = false, maxAngle = 1.25, closeRange = 2.4 } = {}) {
  let best = null, bestScore = Infinity;
  let nearest = null, nearestD = Infinity;
  const hasDir = dir && Math.hypot(dir.x, dir.z) > 0.2;
  const dl = hasDir ? Math.hypot(dir.x, dir.z) : 1;
  for (const e of enemies) {
    if (!e.alive || (e.down && !allowDown)) continue;
    const dx = e.x - origin.x, dz = e.z - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range) continue;
    if (d < nearestD) { nearest = e; nearestD = d; }
    if (!hasDir) continue;
    const cos = (dx * dir.x + dz * dir.z) / ((d || 1) * dl);
    const angle = Math.acos(Math.max(-1, Math.min(1, cos)));
    if (angle > maxAngle) continue;
    const score = angle * 4 + d * 0.18;
    if (score < bestScore) { best = e; bestScore = score; }
  }
  if (!hasDir) return nearest;
  if (best) return best;
  return nearestD <= closeRange ? nearest : null;
}

// Attacks auto-attach: the goon in the held direction, else the focus (the one being fought),
// else the nearest in range. A press never whiffs while a goon is in range.
export function selectAttackTarget(origin, dir, enemies, { range = 14, focus = null, focusRange = 6, allowDown = false, retargetAngle = 1.22 } = {}) {
  const hasDir = dir && Math.hypot(dir.x, dir.z) > 0.2;
  if (hasDir) {
    const t = selectTarget(origin, dir, enemies, { range, allowDown, maxAngle: retargetAngle, closeRange: 0 });
    if (t && t !== focus) return t;
  }
  const ok = (e) => e && e.alive && (allowDown || !e.down) && enemies.includes(e);
  if (ok(focus) && Math.hypot(focus.x - origin.x, focus.z - origin.z) <= focusRange) return focus;
  return selectTarget(origin, null, enemies, { range, allowDown });
}
