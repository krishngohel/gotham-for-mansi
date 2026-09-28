// The Progress page's city map as plain shapes: blocks, water, balloon pins and challenge
// medals. Pure; src/ui/progressMap.js inks it onto a canvas.
import { districtAt, WORLD } from '../world/mapData.js';

// Includes the harbour south of the city so the lighthouse balloon (z 270) fits.
export const MAP_BOUNDS = { minX: WORLD.minX, maxX: WORLD.maxX, minZ: WORLD.minZ, maxZ: 280 };
const span = (b) => Math.max(b.maxX - b.minX, b.maxZ - b.minZ);

export function toMap(x, z, size, b = MAP_BOUNDS) {
  const s = size / span(b);
  return { u: (x - b.minX) * s, v: (z - b.minZ) * s };
}

export function mapModel({ buildings, balloons, challenges, progress, size = 360 }) {
  const s = size / span(MAP_BOUNDS);
  const blocks = buildings.map((b) => {
    const c = toMap(b.x - b.w / 2, b.z - b.d / 2, size);
    return { u: c.u, v: c.v, w: b.w * s, h: b.d * s, district: b.district, landmark: !!b.landmark };
  });
  const pins = balloons
    .map((bl, i) => ({ ...toMap(bl.x, bl.z, size), found: progress.balloons.includes(i), district: districtAt(bl.x, bl.z) }))
    .filter((p) => p.found || progress.districts.includes(p.district))
    .map(({ u, v, found }) => ({ u, v, found }));
  const medals = challenges.map((c) => ({ id: c.id, ...toMap(c.x, c.z, size), medal: progress.challenges[c.id]?.medal ?? null }));
  return { size, water: toMap(0, WORLD.waterZ, size).v, blocks, balloons: pins, challenges: medals };
}
