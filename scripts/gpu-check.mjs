// Opens the game in a visible Edge or Chrome window (same exe, so same Windows GPU choice as the
// user's browser) and reports the GPU in use, canvas resolution and real frame rate.
// Usage: node scripts/gpu-check.mjs [url] [msedge|chrome]
import { chromium } from 'playwright-core';
const url = process.argv[2] ?? 'https://krishngohel.github.io/gotham-for-mansi/?at=start&god=1';
const channel = process.argv[3] ?? 'msedge';
const b = await chromium.launch({ channel, headless: false, args: ['--start-maximized'] });
const ctx = await b.newContext({ viewport: null });
const p = await ctx.newPage();
await p.goto(url);
await p.waitForFunction(() => window.__game?.comic, null, { timeout: 120000 });
await p.waitForTimeout(1500);
await p.evaluate(() => window.__game.comic.skip());
await p.waitForTimeout(4000);
const r = await p.evaluate(async () => {
  const c = document.querySelector('canvas');
  const gl = c.getContext('webgl2');
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown';
  const frames = [];
  let last = performance.now();
  await new Promise((res) => { const t0 = last; const f = (n) => { frames.push(n - last); last = n; if (n - t0 < 4000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  frames.sort((a, b) => a - b);
  const med = frames[frames.length >> 1];
  return { gpu, dpr: devicePixelRatio, css: [innerWidth, innerHeight], canvas: [c.width, c.height], fpsMedian: Math.round(1000 / med), p95ms: +frames[Math.floor(frames.length * 0.95)].toFixed(1), screen: [screen.width, screen.height] };
});
console.log(channel, JSON.stringify(r));
await b.close();
