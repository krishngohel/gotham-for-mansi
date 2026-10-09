// FBX to GLB without Blender: three's FBXLoader and GLTFExporter in muted headless Chromium,
// served by a dev server of this repo (it serves node_modules). Mixamo only exports FBX.
//   node scripts/fbx2glb.mjs in.fbx [out.glb] [more.fbx ...]
// With several inputs each becomes the same name with .glb beside it. DEV_URL picks the server
// (default http://localhost:5210: `npx vite --port 5210 --strictPort` in this worktree).
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const pairs = [];
if (args.length === 2 && args[1].endsWith('.glb')) pairs.push([args[0], args[1]]);
else for (const a of args) pairs.push([a, a.replace(/\.fbx$/i, '.glb')]);
if (!pairs.length) { console.error('usage: node scripts/fbx2glb.mjs in.fbx [out.glb]'); process.exit(1); }

const base = process.env.DEV_URL ?? 'http://localhost:5210';
const b = await chromium.launch({ args: ['--mute-audio'], headless: true });
const p = await b.newPage();
// A blank page on the dev server's origin, so its module imports resolve.
// An import map, so the three addons' bare "three" imports resolve without the dev server's rewrite.
const page = '<!doctype html><title>fbx</title><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>';
await p.route(base + '/__fbx.html', (r) => r.fulfill({ contentType: 'text/html', body: page }));
await p.goto(base + '/__fbx.html');
for (const [inp, outp] of pairs) {
  const b64 = readFileSync(inp).toString('base64');
  const res = await p.evaluate(async (data) => {
    const { FBXLoader } = await import('/node_modules/three/examples/jsm/loaders/FBXLoader.js');
    const { GLTFExporter } = await import('/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0)).buffer;
    const root = new FBXLoader().parse(bin, '');
    const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: root.animations, onlyVisible: false });
    let s = '';
    const u = new Uint8Array(glb);
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return { glb: btoa(s), clips: root.animations.map((a) => `${a.name} ${a.duration.toFixed(2)}s`) };
  }, b64);
  writeFileSync(outp, Buffer.from(res.glb, 'base64'));
  console.log(`${inp} -> ${outp} (${res.clips.join(', ')})`);
}
await b.close();
