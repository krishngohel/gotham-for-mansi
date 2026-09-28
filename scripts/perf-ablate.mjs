// What each part of a frame costs: at a few fixed views, measures the uncapped median/p95 frame
// time with one feature switched off at a time (visible maximized Edge, vsync off).
// Usage: node scripts/perf-ablate.mjs [baseUrl] [high|low]
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:5208/';
const q = process.argv[3] ?? 'high';
const views = [
  ['gcpd roof', { x: 6, y: 42, z: 10 }, 2.6],
  ['neon street', { x: 150, y: 0, z: 10 }, 0],
  ['high vista', { x: -170, y: 125, z: 190 }, 2.4],
];
// Each toggle returns an undo function.
const toggles = {
  base: '() => () => {}',
  rainOff: '() => { const m = window.__game.world.rain.mesh; m.visible = false; return () => { m.visible = true; }; }',
  shadowFrozen: `() => { const s = window.__game.renderer.shadowMap; const d = Object.getOwnPropertyDescriptor(s, 'needsUpdate');
    Object.defineProperty(s, 'needsUpdate', { configurable: true, get: () => false, set: () => {} });
    return () => { delete s.needsUpdate; s.needsUpdate = true; }; }`,
  normalOff: `() => { const r = window.__game.renderer; const orig = r.render; r.render = function (sc, c) { if (sc.overrideMaterial) return; return orig.call(this, sc, c); };
    return () => { r.render = orig; }; }`,
  fxLayerOff: `() => { const g = window.__game; const names = ['steam', 'wetStreaks']; const hidden = []; g.scene.traverse((o) => { if (o.isPoints || names.includes(o.name)) { hidden.push(o); o.visible = false; } }); return () => hidden.forEach((o) => { o.visible = true; }); }`,
  inkCheap: `() => { const u = window.__game.ink.uniforms; const keep = { c: u.uColorEdges.value, m: u.uMisreg.value, p: u.uPaperTex.value, w: u.uWobble.value };
    u.uColorEdges.value = 0; u.uMisreg.value = 0; u.uPaperTex.value = 0; u.uWobble.value = 0;
    return () => { u.uColorEdges.value = keep.c; u.uMisreg.value = keep.m; u.uPaperTex.value = keep.p; u.uWobble.value = keep.w; }; }`,
};
const only = process.env.TOGGLES ? process.env.TOGGLES.split(',') : Object.keys(toggles);

const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--start-maximized', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const p = await (await b.newContext({ viewport: null })).newPage();
await p.goto(`${base}?at=start&god=1&dynres=0&q=${q}`);
await p.waitForFunction(() => window.__game?.comic, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__game.comic.skip());
await p.waitForTimeout(4000);
// GPU time of the whole ink.render (all passes, from the pipeline's timer query), the CPU time
// spent inside it, and the CPU time of the whole frame callback (rAF start to end of render).
await p.evaluate(() => {
  const g = window.__game;
  const st = window.__gpu = { gpu: [], cpuRender: [], cpuFrame: [] };
  const orig = g.ink.render;
  g.ink.render = function (...a) {
    const t0 = performance.now();
    const r = orig.apply(this, a);
    const t1 = performance.now();
    st.cpuRender.push(t1 - t0);
    st.cpuFrame.push(t1 - document.timeline.currentTime);
    if (g.ink.gpuMs !== null) st.gpu.push(g.ink.gpuMs); // the pipeline's own timer query
    return r;
  };
});
const measure = () => p.evaluate(async () => {
  const st = window.__gpu; st.gpu.length = 0; st.cpuRender.length = 0; st.cpuFrame.length = 0;
  const frames = []; let last = performance.now();
  await new Promise((res) => { const t0 = last; const f = (n) => { frames.push(n - last); last = n; if (n - t0 < 2500) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return +(s[s.length >> 1] ?? NaN).toFixed(2); };
  frames.sort((a, b) => a - b);
  return [+frames[frames.length >> 1].toFixed(2), +frames[Math.floor(frames.length * 0.95)].toFixed(2), med(st.gpu), med(st.cpuRender), med(st.cpuFrame)];
});
console.log(JSON.stringify({ quality: q, canvas: await p.evaluate(() => [innerWidth, innerHeight]) }));
for (const [name, pos, yaw] of views) {
  // Freeze the hero in place (a high vista would otherwise fall) by re-teleporting every frame.
  await p.evaluate(([pos, yaw]) => {
    const g = window.__game; cancelAnimationFrame(window.__pin);
    const pin = () => { g.hero.teleport(pos, yaw); window.__pin = requestAnimationFrame(pin); };
    pin(); g.follow.snapBehind(yaw);
  }, [pos, yaw]);
  await p.waitForTimeout(1500);
  const row = [];
  for (const t of only) {
    await p.evaluate(`window.__undo = (${toggles[t]})()`);
    await p.waitForTimeout(400);
    const [med, p95, gpu, cpuR, cpuF] = await measure();
    await p.evaluate('window.__undo()');
    row.push(`${t} ${med}/${p95} gpu ${gpu} cpu ${cpuR}/${cpuF}`);
  }
  console.log(name);
  for (const r of row) console.log('   ', r);
}
await b.close();
