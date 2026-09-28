// usage: node shot.mjs <url> <out.png> [waitExpr] [delayMs] [headed]
import { chromium } from 'playwright-core';
const [url, out, waitExpr = 'true', delay = '800', headed] = process.argv.slice(2);
const browser = await chromium.launch({ headless: !headed, args: ['--ignore-gpu-blocklist', '--use-angle=d3d11', '--enable-gpu', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url);
try { await page.waitForFunction(waitExpr, null, { timeout: 90000 }); } catch (e) { logs.push('WAIT TIMEOUT ' + waitExpr); }
await page.waitForTimeout(Number(delay));
const gpu = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g?.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
const extra = await page.evaluate(() => window.__look ? { fps: window.__look.fps, frame: window.__look.frame } : null);
await page.screenshot({ path: out });
console.log('gpu:', gpu, 'look:', JSON.stringify(extra));
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
