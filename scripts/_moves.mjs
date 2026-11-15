// Throwaway: performs every movement-combo row with real key presses and logs the clip played.
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'http://localhost:5202/';
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'], headless: true });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(url + '?at=f1&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
await p.mouse.click(640, 360);
await p.evaluate(() => window.__game.teleport('wh3Roof'));
await p.waitForFunction(() => window.__game.enemies.some((e) => e.aware), null, { timeout: 10000 });
await p.waitForTimeout(400);
await p.evaluate(() => { const h = window.__game.hero; window.__roof = { x: h.pos.x, y: h.pos.y, z: h.pos.z }; });

// Puts the hero `d` m from a standing goon, the camera behind the hero, everyone else far away.
const setup = (d = 2.5, down = false) => p.evaluate(([d, down]) => {
  const G = window.__game, h = G.hero;
  let live = G.enemies.filter((e) => e.alive && e.type !== 'joker');
  if (!live.length) { const c0 = window.__roof; const g = G.spawn('grunt', { x: c0.x, y: c0.y, z: c0.z + 3 }); G.combat.setEnemies([g]); g.wake?.(); live = [g]; }
  const e = live[0];
  if (!e) return 'no goon';
  const c = window.__roof;
  e.health = 99;
  e.down = false; e.air = false; e.stunned = false;
  e.vel?.set(0, 0, 0); e.knock?.set(0, 0, 0);
  e.place({ x: c.x, y: c.y, z: c.z + 3 }, Math.PI);
  e.state = 'engage';
  e.wake?.();
  for (const o of live.slice(1)) { o.place({ x: window.__roof.x + 8, y: window.__roof.y, z: window.__roof.z - 8 }, 0); o.state = 'idle'; o.aware = false; }
  h.control = null;
  h.state = 'ground';
  h.vel.set(0, 0, 0);
  h.pos.set(e.pos.x, e.pos.y, e.pos.z - d);
  h.bat.face(0);
  if (down) e.applyHit({ outcome: 'knockdown' }, h.pos, { power: 0.2 });
  return e.id + ' ' + e.state;
}, [d, down]);
// The WASD key whose camera direction is `want` (toward / away / left / right) relative to the goon.
const keyFor = (want) => p.evaluate((want) => {
  const G = window.__game, h = G.hero;
  const e = G.enemies.find((x) => x.alive && x.type !== 'joker' && x.pos.distanceTo(h.pos) < 15);
  const f = G.follow.forward(h.pos.clone()), r = G.follow.right(h.pos.clone());
  const dirs = { KeyW: [f.x, f.z], KeyS: [-f.x, -f.z], KeyD: [r.x, r.z], KeyA: [-r.x, -r.z] };
  const tx = e.pos.x - h.pos.x, tz = e.pos.z - h.pos.z, tl = Math.hypot(tx, tz);
  let best = null, bestScore = -9;
  for (const [k, [x, z]] of Object.entries(dirs)) {
    const l = Math.hypot(x, z), dot = (x * tx + z * tz) / (l * tl), side = tz * x - tx * z;
    const score = want === 'away' ? -dot : want === 'toward' ? dot : (1 - Math.abs(dot)) + (want === 'right' ? (side < 0 ? 1 : -1) : (side > 0 ? 1 : -1));
    if (score > bestScore) { best = k; bestScore = score; }
  }
  return best;
}, want);
const clipNow = () => p.evaluate(() => [window.__game.hero.bat.animator.currentName, window.__game.hero.control?.name ?? null]);
const watch = async (ms = 700) => { const seen = new Set(); const t0 = Date.now(); while (Date.now() - t0 < ms) { const [c] = await clipNow(); seen.add(c); await p.waitForTimeout(40); } return [...seen]; };

const rows = [
  ['rotation kick', 'Kick_', async () => { await setup(); await p.keyboard.press('KeyE'); }],
  ['flying knee (Shift+E)', 'Knee_Flying', async () => { await setup(4); await p.keyboard.down('ShiftLeft'); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await p.keyboard.up('ShiftLeft'); }],
  ['running uppercut (Shift+LMB)', 'Punch_RunUppercut', async () => { await setup(4); await p.keyboard.down('ShiftLeft'); await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.keyboard.up('ShiftLeft'); }],
  ['spin back kick (away+E)', 'Kick_SpinBack', async () => { await setup(); const k = await keyFor('away'); await p.keyboard.down(k); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await p.keyboard.up(k); }],
  ['spin backfist (away+LMB)', 'Punch_Backfist', async () => { await setup(); const k = await keyFor('away'); await p.keyboard.down(k); await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.keyboard.up(k); }],
  ['side roundhouse (left+E)', 'Kick_SideRound_M', async () => { await setup(); const k = await keyFor('left'); await p.keyboard.down(k); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await p.keyboard.up(k); }],
  ['side hook (right+LMB)', 'Punch_SideHook', async () => { await setup(); const k = await keyFor('right'); await p.keyboard.down(k); await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.keyboard.up(k); }],
  ['axe kick (Space, E)', 'Kick_AirAxe', async () => { await setup(4); await p.keyboard.press('Space'); await p.waitForTimeout(200); await p.keyboard.press('KeyE'); }],
  ['backflip kick (Space, away+E)', 'Kick_BackFlip', async () => { await setup(4); await p.keyboard.press('Space'); await p.waitForTimeout(200); const k = await keyFor('away'); await p.keyboard.down(k); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await p.keyboard.up(k); }],
  ['hurricane (sprint, Space, E)', 'Kick_Hurricane', async () => { await setup(12); await p.evaluate(() => { const h = window.__game.hero; h.speed = 11; }); await p.keyboard.down('ShiftLeft'); await p.keyboard.press('Space'); await p.waitForTimeout(150); await p.keyboard.press('KeyE'); await p.waitForTimeout(200); await p.keyboard.up('ShiftLeft'); }],
  ['leaping smash (sprint, Space, LMB)', 'Smash_Leap', async () => { await setup(12); await p.evaluate(() => { window.__game.hero.speed = 11; }); await p.keyboard.down('ShiftLeft'); await p.keyboard.press('Space'); await p.waitForTimeout(150); await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.keyboard.up('ShiftLeft'); }],
  ['stomp (E on downed)', 'Stomp', async () => { await setup(2, true); await p.waitForTimeout(150); await p.keyboard.press('KeyE'); }],
  ['auto-attach at 12 m (LMB)', 'Punch_', async () => { await setup(12); await p.mouse.click(640, 360); }],
];
await p.evaluate(() => {
  const c = window.__game.combat.combo;
  for (const k of ['damaged', 'spend', 'miss', 'take']) { const f = c[k]; c[k] = (...a) => { console.log('COMBO ' + k + ' at ' + c.value + ' ' + (new Error().stack.split(String.fromCharCode(10))[2] ?? '').trim()); return f(...a); }; }
});
p.on('console', (m) => { if (m.text().startsWith('COMBO')) console.log('   ' + m.text().slice(0, 160)); });
const only = process.env.ROW;
if (only) rows.splice(0, rows.length, ...rows.filter((r) => r[0].includes(only)));
let fails = 0;
for (const [name, want, act] of rows) {
  let got = [];
  for (let tries = 0; tries < 3; tries++) {
    const c0 = await p.evaluate(() => window.__game.combat.combo.value);
    await act();
    got = await watch(300);
    if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/${want}.jpg`, quality: 70 });
    got = [...new Set([...got, ...(await watch(500))])];
    got.push('combo+' + ((await p.evaluate(() => window.__game.combat.combo.value)) - c0));
    if (got.some((c) => c?.startsWith(want))) break;
    await p.waitForTimeout(500);
  }
  const ok = got.some((c) => c?.startsWith(want));
  if (!ok) fails++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(36)} ${got.join(', ')}`);
  await p.waitForTimeout(600);
}
console.log(errs.length ? errs.join('\n') : 'no console errors');
console.log(fails ? `${fails} rows failed` : 'all rows fired');
await b.close();
process.exit(fails ? 1 : 0);
