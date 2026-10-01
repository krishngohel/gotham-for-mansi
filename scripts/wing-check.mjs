// Batwing handling with real input: mouse steering, the full-bank turning circle, flying into
// buildings and at the world edge, recorded every frame (largest move and heading change per
// frame, heading reversals). usage: node scripts/wing-check.mjs <url>   (muted)
import { chromium } from 'playwright-core';
const b = await chromium.launch({ args: ['--mute-audio', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(process.argv[2] + '?at=toDocks&god=1');
await p.waitForFunction(() => window.__game?.state?.ready && window.__game.state.frame > 30, null, { timeout: 90000 });
for (let i = 0; i < 25; i++) { await p.evaluate(() => { const G = window.__game; G.cinematic?.active && G.cinematic.skip(); G.comic.playing && G.comic.skip(); G.radio?.playing && G.radio.skip(); }); await p.waitForTimeout(150); }
await p.mouse.click(640, 360); await p.waitForTimeout(200); await p.mouse.click(640, 360); await p.waitForTimeout(300);
const fly = async (x, y, z, yaw) => {
  await p.evaluate(() => { const G = window.__game; if (G.batwing.active) G.batwing.exit(); });
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.__game.hero.teleport({ x: 6, y: 42.2, z: 10 }, 0));
  await p.waitForTimeout(800);
  await p.evaluate(() => window.__game.batwing.call());
  await p.waitForFunction(() => window.__game.hero.control?.name === 'fly', null, { timeout: 20000 });
  await p.waitForTimeout(800);
  await p.evaluate(([x, y, z, yaw]) => { const s = window.__game.batwing.state; s.x = x; s.y = y; s.z = z; s.yaw = yaw; s.pitch = 0; s.roll = 0; s.speed = 38; }, [x, y + 25, z, yaw]);
};
// Records the plane every frame for `ms`.
const record = (ms) => p.evaluate((ms) => new Promise((res) => {
  const s = window.__game.batwing.state, out = []; const t0 = performance.now();
  const f = () => { out.push([s.x, s.y, s.z, s.yaw]); if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(out); };
  requestAnimationFrame(f);
}), ms);
const where = (rec) => { for (let i = 1; i < rec.length; i++) { const d = Math.atan2(Math.sin(rec[i][3] - rec[i - 1][3]), Math.cos(rec[i][3] - rec[i - 1][3])); if (Math.abs(d) > 0.5) return { frame: i, of: rec.length, from: rec[i - 1].map((v) => +v.toFixed(1)), to: rec[i].map((v) => +v.toFixed(1)) }; } return null; };
const jumps = (rec) => { let maxMove = 0, maxTurn = 0, flips = 0, lastD = 0; for (let i = 1; i < rec.length; i++) { const [x0, , z0, y0] = rec[i - 1], [x1, , z1, y1] = rec[i]; maxMove = Math.max(maxMove, Math.hypot(x1 - x0, z1 - z0)); const d = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0)); maxTurn = Math.max(maxTurn, Math.abs(d)); if (Math.abs(d) > 0.02 && Math.sign(d) !== Math.sign(lastD) && lastD !== 0) flips++; if (Math.abs(d) > 0.02) lastD = d; } return { maxMovePerFrame: +maxMove.toFixed(2), maxTurnPerFrame: +maxTurn.toFixed(3), headingFlips: flips }; };

// 1. Mouse steering: drag right steadily for one second.
await fly(6, 42, 10, 0);
const y0 = await p.evaluate(() => window.__game.batwing.state.yaw);
for (let i = 0; i < 30; i++) { await p.mouse.move(640 + 15, 360); await p.waitForTimeout(33); await p.mouse.move(640, 360, { steps: 1 }); }
const y1 = await p.evaluate(() => window.__game.batwing.state.yaw);
const turned = Math.atan2(Math.sin(y1 - y0), Math.cos(y1 - y0));
console.log('mouse drag right: heading change', turned.toFixed(2), 'rad (negative = right turn)');
// 2. Full-bank turn diameter with D.
await fly(0, 60, 0, 0);
await p.keyboard.down('KeyD');
const ring = await record(3000);
await p.keyboard.up('KeyD');
const xs = ring.map((r) => r[0]), zs = ring.map((r) => r[2]);
console.log('full-bank turn: across', (Math.max(...xs) - Math.min(...xs)).toFixed(0), 'x', (Math.max(...zs) - Math.min(...zs)).toFixed(0), 'm');
// 3. Into a building: from the GCPD roof area head at the nearest tall building.
await fly(6, 42, 10, Math.PI);
await p.evaluate(() => { const s = window.__game.batwing.state; s.y = 30; });
const wall = await record(4000);
console.log('into buildings:', JSON.stringify(jumps(wall)), JSON.stringify(where(wall)), 'shakes seen:', await p.evaluate(() => window.__game.batwing.state.shakeT));
// 4. At the world edge: heading east to x = 236.
await fly(150, 105, 0, Math.PI / 2); // above every building, so only the edge is in the way
const edge = await record(6000);
const maxX = Math.max(...edge.map((r) => r[0]));
console.log('world edge: max x', maxX.toFixed(1), JSON.stringify(jumps(edge)), JSON.stringify(where(edge)), 'final heading sin', Math.sin(edge.at(-1)[3]).toFixed(2));
await b.close();
