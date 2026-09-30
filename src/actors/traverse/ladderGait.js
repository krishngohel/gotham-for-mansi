// Where each hand and foot grips a ladder for a given body height: pure numbers, no three.js.
//
// Rungs sit every RUNG metres above the ladder's foot (src/world/cityBuilder.js rungs()). The
// climb is a two-beat gait: the right hand and left foot move together, then the left hand and
// right foot. A limb holds its rung while the body rises half a stride past it, then swings up a
// whole stride (D, a whole number of rungs) to the next one while its partner pair holds. So the
// body is always hanging from one pair, every plant lands on a real rung, and the whole motion
// follows the body's height: climbing faster or slower, or back down, just plays it at that rate.

export const RUNG = 0.3;
export const GAIT = {
  D: 1.2, // stride: how far a limb moves per reach (four rungs)
  // A hand's height above the body's feet the moment it grips (it is then pulled down to
  // HAND_R - D/2), and a foot's the moment it steps on. They differ by exactly one stride so a
  // hand and the opposite foot always move together.
  HAND_R: 1.85,
  FOOT_R: 0.65,
};

const smooth = (x) => x * x * (3 - 2 * x);

// One limb: its grip height for body height cy, and how far through a swing it is (0 while
// planted, peaking at 1 mid-swing). y0 is one rung this limb ever plants on.
export function limbGrip(cy, reach, y0, D = GAIT.D, out = { y: 0, swing: 0 }) {
  const v = (cy + reach - y0) / D;
  const n = Math.floor(v), f = v - n;
  if (f < 0.5) { out.y = y0 + D * n; out.swing = 0; }
  else { const k = (f - 0.5) * 2; out.y = y0 + D * (n + smooth(k)); out.swing = Math.sin(Math.PI * k); }
  return out;
}

// All four limbs for body height cy on ladder { bottom, top }. Pair A (right hand, left foot)
// plants on the first rung's stride grid, pair B half a stride (two rungs) above it. Hands stop
// at the top of the ladder (the landing's edge or roof lip); feet never go below its foot.
export function ladderGrips(cy, ladder, out = { handR: {}, handL: {}, footR: {}, footL: {} }) {
  const a = ladder.bottom + RUNG, b = a + GAIT.D / 2;
  limbGrip(cy, GAIT.HAND_R, a, GAIT.D, out.handR);
  limbGrip(cy, GAIT.FOOT_R, a, GAIT.D, out.footL);
  limbGrip(cy, GAIT.HAND_R, b, GAIT.D, out.handL);
  limbGrip(cy, GAIT.FOOT_R, b, GAIT.D, out.footR);
  for (const k of ['handR', 'handL', 'footR', 'footL']) {
    const g = out[k];
    if (g.y > ladder.top) { g.y = ladder.top; g.swing = 0; }
    if (g.y < ladder.bottom) g.y = ladder.bottom;
  }
  return out;
}
