// A one-link benchmark for the player's own machine (?bench=1): stands Batman on the GCPD roof,
// then measures a few seconds of frames in each of several setups, dropping one piece of the
// frame at a time (per-frame shadow redraw, the outline pass, the comic effects, resolution),
// and shows a table to screenshot. Frame time against JavaScript time tells a GPU-bound machine
// (frame much longer than the script) from a CPU-bound one; draw calls show Safari's per-call
// overhead. Nothing here runs unless the URL asks for it.

const SETTLE = 1500, MEASURE = 4000;

export function runPerfBench({ renderer, ink, dynRes, quality, applyResolution, state, getGame, gpuName }) {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:99;background:#f4ecd8;color:#0b0b12;border:3px solid #0b0b12;box-shadow:4px 4px 0 #0b0b12;padding:16px 20px;font:15px/1.4 ui-monospace,Menlo,Consolas,monospace;white-space:pre;max-width:92vw;overflow:auto';
  panel.textContent = 'Benchmark: getting ready...';
  document.body.appendChild(panel);

  const comicOn = { ...quality.comic };
  const comicOff = Object.fromEntries(Object.keys(quality.comic).map((k) => [k, 0]));
  const dpr = window.devicePixelRatio || 1;
  const setRes = (cap) => { quality.pixelRatioCap = cap; applyResolution(); };
  const baseCap = quality.pixelRatioCap;
  const reset = () => { ink.debug.cachedShadows = false; ink.debug.skipNormals = false; ink.setComic(comicOn); setRes(baseCap); };
  const configs = [
    ['As shipped', () => {}],
    ['Shadows cached', () => { ink.debug.cachedShadows = true; }],
    ['No outline pass', () => { ink.debug.skipNormals = true; }],
    ['Comic effects off', () => { ink.setComic(comicOff); }],
    ['Resolution 1x', () => { setRes(1); }],
    ['Resolution 1.5x', () => { setRes(1.5); }],
    ['1x + cached + no outline', () => { setRes(1); ink.debug.cachedShadows = true; ink.debug.skipNormals = true; }],
  ];

  // Draw calls and triangles summed over every pass of a frame.
  let calls = 0, tris = 0;
  const orig = renderer.render.bind(renderer);
  renderer.render = (s, c) => { orig(s, c); calls += renderer.info.render.calls; tris += renderer.info.render.triangles; };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frames = (ms) => new Promise((resolve) => {
    const ft = [], js = [], dc = [], tr = [];
    let last = performance.now(), end = last + ms;
    const tick = (now) => {
      ft.push(now - last); js.push(state.stepMs ?? 0); dc.push(calls); tr.push(tris);
      calls = 0; tris = 0; last = now;
      if (now < end) requestAnimationFrame(tick); else resolve({ ft, js, dc, tr });
    };
    calls = 0; tris = 0;
    requestAnimationFrame(tick);
  });
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
  const p95 = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length * 0.95)] ?? 0; };

  async function run() {
    // Into play, past every comic, cinematic and radio line: a comic can start a moment after a
    // cinematic ends, so play has to stay clear for a full second before measuring starts.
    for (let i = 0, clear = 0; i < 400 && clear < 7; i++) {
      const G = getGame();
      const busy = !G || state.phase !== 'play' || G.flow.mode !== 'play' || G.comic?.playing || G.cinematic?.active;
      if (G) { G.cinematic?.active && G.cinematic.skip(); G.comic?.playing && G.comic.skip(); G.radio?.playing && G.radio.skip?.(); }
      clear = busy ? 0 : clear + 1;
      await wait(150);
    }
    const G = getGame();
    const place = () => { G.hero.teleport({ x: 6, y: 42, z: 10 }, 2.6); G.follow.snapBehind(2.6, 0.15); };
    const wasDyn = dynRes.enabled;
    dynRes.setEnabled(false);
    applyResolution();
    const rows = [];
    for (const [name, apply] of configs) {
      reset();
      apply();
      place();
      panel.textContent = `Benchmark running (${rows.length + 1} of ${configs.length}): ${name}\nKeep this tab in front and don't touch anything.`;
      await wait(SETTLE);
      if (G.comic?.playing) G.comic.skip();
      const r = await frames(MEASURE);
      const fm = med(r.ft);
      rows.push({ name, fps: Math.round(1000 / fm), frame: fm, p95: p95(r.ft), js: med(r.js), calls: med(r.dc), tris: med(r.tr), px: `${renderer.domElement.width}x${renderer.domElement.height}` });
    }
    reset();
    renderer.render = orig;
    dynRes.setEnabled(wasDyn);
    applyResolution();

    const pad = (s, n) => String(s).padEnd(n);
    const lines = [
      'GOTHAM BENCHMARK  (screenshot this and send it)',
      `${navigator.userAgent.match(/(Version\/[\d.]+ Safari|Chrome\/[\d.]+|Firefox\/[\d.]+|Edg\/[\d.]+)/)?.[0] ?? 'browser?'}  GPU: ${gpuName || '?'}`,
      `screen ${innerWidth}x${innerHeight} at ${dpr}x, refresh about ${dynRes.refreshHz} Hz, quality ${quality.name}`,
      '',
      `${pad('setup', 27)}${pad('fps', 6)}${pad('frame ms', 10)}${pad('p95 ms', 9)}${pad('script ms', 11)}${pad('draws', 7)}pixels`,
      ...rows.map((r) => `${pad(r.name, 27)}${pad(r.fps, 6)}${pad(r.frame.toFixed(1), 10)}${pad(r.p95.toFixed(1), 9)}${pad(r.js.toFixed(1), 11)}${pad(r.calls, 7)}${r.px}`),
      '',
      'Click anywhere to close.',
    ];
    panel.textContent = lines.join('\n');
    console.log(lines.join('\n'));
    window.__bench = rows;
    panel.addEventListener('click', () => panel.remove());
  }
  run().catch((err) => { panel.textContent = 'Benchmark failed: ' + err.message; console.error(err); });
}
