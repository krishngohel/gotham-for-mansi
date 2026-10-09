// Removes clips from public/assets/anims_mocap.glb and their entries from src/config/mocapData.js
// (trial clips that lost a comparison, say).
//   node scripts/drop-clips.mjs Clip [Clip ...]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune } from '@gltf-transform/functions';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const glbPath = path.join(ROOT, 'public/assets/anims_mocap.glb');
const dataPath = path.join(ROOT, 'src/config/mocapData.js');
const drop = new Set(process.argv.slice(2));
if (!drop.size) { console.error('usage: node scripts/drop-clips.mjs Clip [Clip ...]'); process.exit(1); }

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(glbPath);
for (const a of doc.getRoot().listAnimations()) if (drop.has(a.getName())) a.dispose();
await doc.transform(prune());
await io.write(glbPath, doc);

const { MOCAP_DATA } = await import(pathToFileURL(dataPath).href);
const kept = Object.fromEntries(Object.entries(MOCAP_DATA).filter(([k]) => !drop.has(k)));
const src = readFileSync(dataPath, 'utf8');
const header = src.slice(0, src.indexOf('export const MOCAP_DATA'));
writeFileSync(dataPath, header + 'export const MOCAP_DATA = ' + JSON.stringify(kept, null, 1).replace(/\n\s*(-?\d)/g, ' $1').replace(/\n\s*\]/g, ' ]') + ';\n');
console.log(`dropped ${[...drop].join(', ')}; ${Object.keys(kept).length} clips left: ${Object.keys(kept).join(', ')}`);
