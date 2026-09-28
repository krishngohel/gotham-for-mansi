// Checks the predator rooms against a collision world (the live city in the game, or a small
// world in the tests): every patrol point stands on the floor it claims, every leg is walkable
// (no hole, nothing in the way for a goon's body at knee and chest height), every gargoyle is a
// grapple perch that can be seen from somewhere in the room, the entry, the huddle and the vent
// have floor, and no set piece sits inside another box. Pure: only the collision API.
import { huddleSpot } from './patrol.js';

const EPS = 0.02;
const overlaps = (a, b) => a.minX < b.maxX - EPS && a.maxX > b.minX + EPS && a.minY < b.maxY - EPS && a.maxY > b.minY + EPS
  && a.minZ < b.maxZ - EPS && a.maxZ > b.minZ + EPS;
const inBounds = (bd, b) => b.maxX >= bd.minX && b.minX <= bd.maxX && b.maxZ >= bd.minZ && b.minZ <= bd.maxZ;
// Pieces that sit on or in the stealth set by design.
const ALLOWED = new Set(['gargoyle', 'plinth']);

function legsOf(route) {
  const pts = route.points, out = [];
  for (let i = 1; i < pts.length; i++) out.push([pts[i - 1], pts[i]]);
  if (route.mode === 'loop' && pts.length > 2) out.push([pts[pts.length - 1], pts[0]]);
  return out;
}

export function checkRooms(collision, grapplePoints, rooms, sites) {
  const out = [];
  const ground = (p) => collision.groundBelow(p.x, p.y + 1, p.z, 0.3);
  for (const room of Object.values(rooms)) {
    const bad = (kind, detail) => out.push({ room: room.id, kind, detail });
    const entry = sites[room.entry];
    if (!entry) bad('entry', 'missing site');
    else if (Math.abs(ground(entry) - entry.y) > 0.3) bad('entry', `floor at ${ground(entry)} not ${entry.y}`);

    const routes = [...room.squad, ...room.encore].map((g) => g.route);
    for (const r of routes) {
      for (const p of r.points) {
        const g = ground(p);
        if (Math.abs(g - p.y) > 0.12) bad('point', `${p.x},${p.y},${p.z} floor ${g}`);
      }
      for (const [a, b] of legsOf(r)) checkLeg(bad, a, b);
    }

    const views = [...routes.flatMap((r) => r.points), entry].filter(Boolean);
    for (const p of room.perches) {
      const stand = p.y + 0.9;
      const gp = grapplePoints.find((q) => q.perch && Math.abs(q.x - p.x) < 0.25 && Math.abs(q.z - p.z) < 0.25 && Math.abs(q.y - stand) < 0.25);
      if (!gp) { bad('perch-missing', `${p.x},${p.z}`); continue; }
      if (!views.some((v) => sees(v, gp))) bad('perch-hidden', `${p.x},${p.z}`);
    }

    const h = { x: 0, y: 0, z: 0, face: 0 };
    for (let k = 0; k < 4; k++) {
      huddleSpot(room.huddle, k, 4, h);
      if (Math.abs(ground(h) - h.y) > 0.12) bad('huddle', `${h.x.toFixed(1)},${h.z.toFixed(1)}`);
    }
    if (room.vent && Math.abs(ground(room.vent) - room.vent.y) > 0.2) bad('vent', 'no floor under the vent');

    for (const b of collision.boxes) {
      if (!b.tag?.startsWith('stealth') || !inBounds(room.bounds, b)) continue;
      for (const o of collision.query(b.minX, b.minZ, b.maxX, b.maxZ)) {
        if (o === b || o.tag?.startsWith('stealth') || ALLOWED.has(o.tag)) continue;
        if (overlaps(b, o)) bad('overlap', `${b.tag} inside ${o.tag || 'box'} ${o.id}`);
      }
    }
  }
  return out;

  function checkLeg(bad, a, b) {
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 1e-6) return;
    const n = Math.max(1, Math.ceil(len / 0.5));
    for (let i = 1; i < n; i++) {
      const k = i / n, p = { x: a.x + (b.x - a.x) * k, y: a.y, z: a.z + (b.z - a.z) * k };
      const g = ground(p);
      if (Math.abs(g - a.y) > 0.2) { bad('gap', `${p.x.toFixed(1)},${p.z.toFixed(1)} floor ${g}`); return; }
    }
    // A goon is 0.84 m wide: cast three parallel rays (centre and both shoulders) at two heights.
    const d = { x: (b.x - a.x) / len, y: 0, z: (b.z - a.z) / len };
    for (const h of [0.5, 1.4]) {
      for (const side of [-0.4, 0, 0.4]) {
        const o = { x: a.x - d.z * side, y: a.y + h, z: a.z + d.x * side };
        const hit = collision.raycast(o, d, len);
        if (hit && hit.t < len - 0.3) { bad('blocked', `${a.x},${a.z} to ${b.x},${b.z} by ${hit.box.tag || 'box'} at ${hit.t.toFixed(1)}`); return; }
      }
    }
  }
  function sees(v, gp) {
    const o = { x: v.x, y: v.y + 1.6, z: v.z };
    const t = { x: gp.x - o.x, y: gp.y + 0.3 - o.y, z: gp.z - o.z };
    const dist = Math.hypot(t.x, t.y, t.z);
    const hit = collision.raycast(o, { x: t.x / dist, y: t.y / dist, z: t.z / dist }, dist);
    return !hit || hit.t > dist - 1.2;
  }
}
