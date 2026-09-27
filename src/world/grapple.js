// Picks the grapple point the player means: inside a cone around the camera's view direction,
// in range, above the hero, favoring the center of the screen. Pure.
export function pickGrapplePoint(points, camPos, camDir, heroPos, {
  maxDist = 52, minRise = 1.5, maxAngle = 0.5, visible = () => true,
} = {}) {
  let best = null;
  let bestScore = Infinity;
  const cosMax = Math.cos(maxAngle);
  for (const p of points) {
    const rise = p.y - heroPos.y;
    if (rise < (p.perch ? 1 : minRise)) continue;
    const hx = p.x - heroPos.x, hy = rise, hz = p.z - heroPos.z;
    const dist = Math.hypot(hx, hy, hz);
    if (dist > maxDist || dist < 2) continue;
    const cx = p.x - camPos.x, cy = p.y - camPos.y, cz = p.z - camPos.z;
    const cl = Math.hypot(cx, cy, cz) || 1;
    const cos = (cx * camDir.x + cy * camDir.y + cz * camDir.z) / cl;
    if (cos < cosMax) continue;
    const angle = Math.acos(Math.min(1, cos));
    const score = angle * 60 + dist * 0.08;
    if (score < bestScore && visible(p)) { best = p; bestScore = score; }
  }
  return best;
}
