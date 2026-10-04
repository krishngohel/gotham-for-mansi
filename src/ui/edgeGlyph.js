// Where an attack glyph goes when its goon is off screen: pinned to the screen edge on the line
// from the centre toward him, with the angle a pointer should face. A goon behind the camera
// projects mirrored, so his point is flipped back, and he always reads as below (behind her).
// x, y: his projected pixel position; behind: projected from behind the camera; w, h: the view.
// padTop: the over-the-head bolt is drawn above its point, so a head this close to the top edge
// would push it off screen; it goes to the edge instead.
export function edgeGlyph(x, y, behind, w, h, pad = 56, padTop = pad) {
  const cx = w / 2, cy = h / 2;
  if (!behind && x >= pad && x <= w - pad && y >= padTop && y <= h - pad) return { x, y, edge: false, angle: 0 };
  let dx = x - cx, dy = y - cy;
  if (behind) { dx = -dx; dy = Math.abs(dy); if (dy < 1 && Math.abs(dx) < 1) dy = 1; }
  const s = Math.min(Math.abs(dx) > 1e-6 ? (cx - pad) / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? (cy - pad) / Math.abs(dy) : Infinity);
  return { x: cx + dx * s, y: cy + dy * s, edge: true, angle: Math.atan2(dy, dx) };
}
