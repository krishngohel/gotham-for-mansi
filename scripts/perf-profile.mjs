// CPU and allocation hot spots during play (visible Edge, vsync off): samples 4 s of a glide
// and 4 s of the ?fight=test sandbox with the CDP profiler and the sampling heap profiler.
// Usage: node scripts/perf-profile.mjs [baseUrl] [glide|fight]
import { chromium } from 'playwright-core';
const base = process.argv[2] ?? 'http://localhost:5208/';
const mode = process.argv[3] ?? 'glide';
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--mute-audio', '--start-maximized', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await (await b.newContext({ viewport: null })).newPage();
await p.goto(`${base}?${mode === 'fight' ? 'fight=test' : 'at=start'}&god=1`);
await p.waitForFunction(() => window.__game?.comic, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__game.comic.skip());
await p.waitForTimeout(3000);
if (mode === 'glide') {
  await p.evaluate(() => { const g = window.__game; g.hero.teleport({ x: -170, y: 125, z: 190 }, 2.4); g.follow.snapBehind(2.4); });
  await p.keyboard.down('Space');
  await p.waitForTimeout(1500);
}
const cdp = await p.context().newCDPSession(p);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('HeapProfiler.enable');
await cdp.send('HeapProfiler.startSampling', { samplingInterval: 4096 });
await cdp.send('Profiler.start');
const frames0 = await p.evaluate(() => window.__game.state.frame);
if (mode === 'fight') for (let i = 0; i < 10; i++) { await p.keyboard.press('KeyE'); await p.waitForTimeout(400); }
else await p.waitForTimeout(4000);
const frames = (await p.evaluate(() => window.__game.state.frame)) - frames0;
const { profile } = await cdp.send('Profiler.stop');
const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n])); const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`; self.set(k, (self.get(k) ?? 0) + (dt[i] ?? 0)); });
const total = [...self.values()].reduce((a, v) => a + v, 0);
console.log(`frames ${frames}, sampled ${(total / 1000).toFixed(0)} ms; per frame self ms:`);
for (const [k, us] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((us / 1000 / frames).toFixed(3).padStart(7), k);
// allocations by allocating function
const alloc = new Map();
const walk = (n) => { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`; alloc.set(k, (alloc.get(k) ?? 0) + n.selfSize); for (const c of n.children) walk(c); };
walk(heap.head);
const at = [...alloc.values()].reduce((a, v) => a + v, 0);
console.log(`sampled allocations ${(at / 1024).toFixed(0)} KB, ~${(at / frames).toFixed(0)} B/frame; top:`);
for (const [k, bytes] of [...alloc].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(String(Math.round(bytes / frames)).padStart(7), 'B/f', k);
await b.close();
