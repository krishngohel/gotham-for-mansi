// Checks every gadget breakable against the live city: floors under rooms, nothing built through
// them, a drop behind each railing, clearance under glass signs, and walls kept clear of story
// sites. Lists the street-level ladders near each boarded fire escape, for tuning.
// Usage: node scripts/breakables-check.mjs [baseUrl]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5208/';
const b = await chromium.launch({ args: ['--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`${base}?at=toNeon&god=1&new=1`);
await p.waitForFunction(() => window.__game?.breakables, null, { timeout: 120000 });
const result = await p.evaluate(() => {
  const G = window.__game;
  const sites = Object.entries(G.sites).map(([name, s]) => ({ name, ...s }));
  const report = G.breakables.check(sites);
  const ladders = G.climbables.ladders.filter((l) => l.bottom < 0.5).map((l) => ({ id: l.id, x: +l.x.toFixed(1), z: +l.z.toFixed(1), nx: l.nx, nz: l.nz }));
  return { report, ladders };
});
let bad = 0;
for (const r of result.report) {
  console.log(`${r.ok ? 'ok ' : 'BAD'} ${r.id}${r.problems.length ? ': ' + r.problems.join('; ') : ''}`);
  if (!r.ok) bad += 1;
}
console.log('street-level ladders:', JSON.stringify(result.ladders));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
await b.close();
process.exit(bad ? 1 : 0);
