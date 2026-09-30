// Checks every challenge course and crime spot against the real city collision: pillars and
// starts on solid ground, hoops clear of buildings with open lines between them and room above
// the roofs, checkpoints on walkable ground, the parkour's ladder and zipline present, and crime
// squads standing on open street. Prints a report; exits 1 on any problem.
// usage: node scripts/course-check.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5206/';
const browser = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`${base}?at=toNeon&god=1&new=1`);
await page.waitForFunction(() => window.__game?.side && window.__game.state.frame > 20, null, { timeout: 90000 });

const report = await page.evaluate(() => {
  const g = window.__game, C = g.world.collision, { CHALLENGES, CRIME_SPOTS, pillarPos } = g.side.data;
  const issues = [], info = [];
  const ground = (x, y, z) => C.groundBelow(x, y + 3, z, 0.3);
  const blocked = (a, b) => {
    const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const len = Math.hypot(d.x, d.y, d.z);
    const hit = C.raycast(a, { x: d.x / len, y: d.y / len, z: d.z / len }, len);
    return hit ? `${hit.box?.tag ?? 'box'} at ${hit.t.toFixed(1)} m` : null;
  };
  const onGround = (label, p, tol = 0.35) => {
    const y = ground(p.x, p.y, p.z);
    if (!(Math.abs(y - p.y) <= tol)) issues.push(`${label}: ground is ${y.toFixed(2)}, expected ${p.y}`);
  };
  for (const ch of CHALLENGES) {
    onGround(`${ch.id} pillar`, pillarPos(ch));
    onGround(`${ch.id} start`, ch.start);
    let prev = { x: ch.start.x, y: ch.start.y + 1, z: ch.start.z };
    for (const [i, r] of (ch.rings ?? []).entries()) {
      // Eight spokes in the hoop's plane must be clear out to its radius plus 0.4 m.
      const n = [r.nx, r.ny, r.nz];
      const u0 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const u = [n[1] * u0[2] - n[2] * u0[1], n[2] * u0[0] - n[0] * u0[2], n[0] * u0[1] - n[1] * u0[0]];
      const ul = Math.hypot(...u); u.forEach((v, k) => { u[k] = v / ul; });
      const v = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
      for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2;
        const d = { x: u[0] * Math.cos(a) + v[0] * Math.sin(a), y: u[1] * Math.cos(a) + v[1] * Math.sin(a), z: u[2] * Math.cos(a) + v[2] * Math.sin(a) };
        const hit = C.raycast(r, d, r.r + 0.4);
        if (hit) { issues.push(`${ch.id} ring ${i}: hoop touches ${hit.box?.tag ?? 'box'}`); break; }
      }
      const roof = C.groundBelow(r.x, r.y, r.z, 0.3);
      if (r.y - roof < r.r + 0.6) issues.push(`${ch.id} ring ${i}: only ${(r.y - roof).toFixed(1)} m above the surface below`);
      const wall = blocked(prev, r);
      if (wall) issues.push(`${ch.id} leg to ring ${i}: blocked by ${wall}`);
      const h = Math.hypot(r.x - prev.x, r.z - prev.z), drop = prev.y - r.y;
      info.push(`${ch.id} leg ${i}: ${h.toFixed(0)} m, drop ${drop.toFixed(1)} m, slope 1:${(h / Math.max(drop, 0.01)).toFixed(1)}`);
      // Only a glide-only course cannot climb: powered flight (the Batwing's Wing Walk) can.
      if (drop < -1 && !ch.poweredFlight) issues.push(`${ch.id} leg to ring ${i}: climbs ${(-drop).toFixed(1)} m`);
      prev = r;
    }
    for (const [i, c] of (ch.checkpoints ?? []).entries()) onGround(`${ch.id} checkpoint ${i}`, c, 0.8);
  }
  const park = CHALLENGES.find((c) => c.kind === 'parkour');
  if (park) {
    const [c1, c2, c3] = park.checkpoints;
    const ladder = g.climbables.ladders.find((l) => l.bottom < 1 && Math.hypot(l.x - c1.x, l.z - c1.z) < 20);
    if (!ladder) issues.push('parkour: no street ladder within 20 m of checkpoint 1');
    else info.push(`parkour ladder at ${ladder.x.toFixed(1)}, ${ladder.z.toFixed(1)}`);
    const zip = g.climbables.ziplines.find((z) => Math.hypot(z.a.x - c2.x, z.a.z - c2.z) < 30 && Math.hypot(z.b.x - c3.x, z.b.z - c3.z) < 30);
    if (!zip) issues.push('parkour: no zipline from checkpoint 2 down to checkpoint 3');
    else info.push(`parkour zipline ${zip.a.x.toFixed(0)},${zip.a.z.toFixed(0)} -> ${zip.b.x.toFixed(0)},${zip.b.z.toFixed(0)}`);
  }
  for (const s of CRIME_SPOTS) {
    const y = ground(s.x, s.y, s.z);
    if (Math.abs(y - s.y) > 0.4) issues.push(`crime ${s.id}: ground ${y.toFixed(2)}, expected ${s.y}`);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2, r = k % 2 ? 5 : 3.5;
      const gy = ground(s.x + Math.sin(a) * r, y, s.z + Math.cos(a) * r);
      if (Math.abs(gy - y) > 0.6) { issues.push(`crime ${s.id}: goon slot ${k} stands at ${gy.toFixed(2)}`); break; }
    }
  }
  return { issues, info };
});

for (const l of report.info) console.log('  ' + l);
console.log(report.issues.length ? `\n${report.issues.length} problem(s):\n` + report.issues.join('\n') : '\nall courses and crime spots clear');
await browser.close();
process.exit(report.issues.length ? 1 : 0);
