// src/ui/cinematicShots.js
// Pure shot sampler for the in-engine cinematic camera: no three.js, no DOM, so it is cheap to
// unit test. A shot is { from:{x,y,z}, to:{x,y,z}, look:{x,y,z}, lookTo?:{x,y,z}, dur, fov? }:
// the camera eases from `from` to `to` over `dur` seconds, looking at `look` (lerping to
// `lookTo` if given).

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Same smoothstep ease the rest of the game uses for a scripted move (hero.js's zip, the
// Batwing's boarding swoop in src/vehicles/batwing.js).
export function ease(k) { const c = clamp01(k); return c * c * (3 - 2 * c); }

const lerp = (a, b, k) => a + (b - a) * k;

// Samples one shot at local time `t` (seconds since the shot started, clamped to its own
// duration). Fills and returns `out` instead of allocating: { x, y, z, lx, ly, lz, fov }.
export function sampleShot(shot, t, out = {}) {
  const k = ease(shot.dur > 0 ? t / shot.dur : 1);
  out.x = lerp(shot.from.x, shot.to.x, k);
  out.y = lerp(shot.from.y, shot.to.y, k);
  out.z = lerp(shot.from.z, shot.to.z, k);
  const lookTo = shot.lookTo ?? shot.look;
  out.lx = lerp(shot.look.x, lookTo.x, k);
  out.ly = lerp(shot.look.y, lookTo.y, k);
  out.lz = lerp(shot.look.z, lookTo.z, k);
  out.fov = shot.fov ?? 50;
  return out;
}

export function totalDuration(shots) {
  let t = 0;
  for (const s of shots) t += s.dur;
  return t;
}

// Samples a whole sequence at global time `t` (seconds since the sequence started). `out` gets
// an extra `index` (the active shot) and `done` (true once `t` is at or past the total; the pose
// then stays clamped to the last shot's final frame, so a caller can always read a valid pose).
export function sampleSequence(shots, t, out = {}, total = totalDuration(shots)) {
  let acc = 0;
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i];
    if (t < acc + s.dur || i === shots.length - 1) {
      sampleShot(s, Math.min(s.dur, Math.max(0, t - acc)), out);
      out.index = i;
      out.done = t >= total;
      return out;
    }
    acc += s.dur;
  }
  out.index = -1;
  out.done = true;
  return out;
}

// A quick establishing shot: an arc around `center` at `radius`/`height`, split into `segments`
// shots totalling `dur` seconds, always looking at `center`. Pure data; src/ui/cinematic.js's
// orbit() plays it.
export function orbitShots(center, radius, height, dur, segments = 3, opts = {}) {
  const { startAngle = 0, sweep = Math.PI * 1.2, fov = 42 } = opts;
  const n = Math.max(1, segments | 0);
  const shots = [];
  const per = dur / n;
  for (let i = 0; i < n; i++) {
    const a0 = startAngle + (sweep * i) / n;
    const a1 = startAngle + (sweep * (i + 1)) / n;
    shots.push({
      from: { x: center.x + Math.sin(a0) * radius, y: center.y + height, z: center.z + Math.cos(a0) * radius },
      to: { x: center.x + Math.sin(a1) * radius, y: center.y + height, z: center.z + Math.cos(a1) * radius },
      look: { x: center.x, y: center.y, z: center.z },
      dur: per,
      fov,
    });
  }
  return shots;
}
