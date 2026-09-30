// Vehicle controls, checked with real key presses (not the vehicle APIs) and measured in each
// vehicle's own frame, so a mirrored control can't hide behind a camera facing another way.
// Checks: D turns the Batmobile right, the chase camera settles behind it, a Space tap at speed
// does not eject, the vehicle key at speed ejects into the air, D turns the Batwing right.
// usage: node scripts/steer-check.mjs <url>   (muted; exits 1 on any failure; SHOTS=<dir> saves views)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5202/';
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(url + (url.includes('?') ? '&' : '?') + 'at=toDocks&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const G = window.__game; G.cinematic?.active && G.cinematic.skip(); G.comic.playing && G.comic.skip(); G.radio?.playing && G.radio.skip(); }); await p.waitForTimeout(150); }
// With the pointer unlocked the first canvas click only re-locks it.
await p.mouse.click(640, 360); await p.waitForTimeout(300);
const keyOf = (id) => p.evaluate((id) => window.__game.settings?.bindings?.[id]?.[0], id);
const vehicleKey = (await keyOf('vehicle')) ?? 'KeyT';
const results = [];
const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const shot = async (name) => { if (shots) await p.screenshot({ path: `${shots}/${name}.png` }); };
const check = (name, ok, detail) => results.push({ name, ok, detail });

// Heading from the path over a short stretch of straight travel.
async function heading() {
  const a = await p.evaluate(() => ({ x: window.__game.hero.pos.x, z: window.__game.hero.pos.z }));
  await p.waitForTimeout(300);
  return p.evaluate((a) => { const G = window.__game, dx = G.hero.pos.x - a.x, dz = G.hero.pos.z - a.z, l = Math.hypot(dx, dz) || 1; return { x: G.hero.pos.x, z: G.hero.pos.z, fx: dx / l, fz: dz / l }; }, a);
}
// Sideways travel since `h`, positive to the right of the heading (right = (-fz, fx)).
const rightOf = (h) => p.evaluate((h) => { const G = window.__game; return (G.hero.pos.x - h.x) * -h.fz + (G.hero.pos.z - h.z) * h.fx; }, h);

// The Batmobile on the dock road, heading north.
await p.evaluate(() => { const G = window.__game; G.hero.teleport({ x: -90, y: 0.2, z: 40 }, 0); G.vehicles.summon('batmobile', { instant: true }); G.vehicles.enter(G.vehicles.batmobile); });
await p.waitForTimeout(300);
await p.evaluate(() => { const v = window.__game.vehicles.batmobile; v.group.position.set(-90, 0, 45); v.v.yaw = 0; v.v.speed = 12; });
await p.keyboard.down('KeyW');
const h0 = await heading();
await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
const carRight = await rightOf(h0);
check('D turns the Batmobile right', carRight > 1, `${carRight.toFixed(1)} m right of its heading`);
await p.waitForTimeout(1600);
const camErr = await p.evaluate(() => { const G = window.__game, f = G.follow.forward(), yaw = G.vehicles.batmobile.v.yaw; const d = Math.atan2(f.x, f.z) - yaw; return Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); });
check('the chase camera settles behind the car', camErr < 0.2, `${camErr.toFixed(2)} rad off`);
await shot('drive');
await p.evaluate(() => { const v = window.__game.vehicles.batmobile; v.group.position.set(-90, 0, 45); v.v.yaw = 0; v.v.speed = 22; });
await p.keyboard.press('Space'); await p.waitForTimeout(250);
const afterTap = await p.evaluate(() => window.__game.vehicles.active?.kind ?? null);
check('a Space tap at speed does not eject', afterTap === 'batmobile', `in: ${afterTap}`);
await p.evaluate(() => { const v = window.__game.vehicles.batmobile; v.v.speed = 22; });
await p.keyboard.press(vehicleKey); await p.waitForTimeout(200);
await p.keyboard.up('KeyW');
const ej = await p.evaluate(() => ({ active: window.__game.vehicles.active?.kind ?? null, state: window.__game.hero.state, y: window.__game.hero.pos.y }));
check('the vehicle key at speed ejects into the air', ej.active === null && ej.y > 1.5, JSON.stringify(ej));
await p.waitForTimeout(2500);

// The Batwing, called from the GCPD roof.
await p.evaluate(() => window.__game.hero.teleport({ x: 6, y: 42.2, z: 10 }, 0));
await p.waitForTimeout(800);
await p.evaluate(() => window.__game.batwing.call());
await p.waitForFunction(() => window.__game.hero.control?.name === 'fly', null, { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(1500);
const w0 = await heading();
await p.keyboard.down('KeyD'); await p.waitForTimeout(1500); await p.keyboard.up('KeyD');
const wingRight = await rightOf(w0);
await shot('fly');
check('D turns the Batwing right', wingRight > 3, `${wingRight.toFixed(1)} m right of its heading`);

for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name} (${r.detail})`);
console.log(errors.length ? 'errors:\n' + errors.join('\n') : 'no page errors');
await b.close();
process.exit(results.every((r) => r.ok) && !errors.length ? 0 : 1);
