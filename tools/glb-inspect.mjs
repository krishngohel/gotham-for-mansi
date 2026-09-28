// Prints a GLB's node tree (TRS, mesh/skin flags), skins and animations: node tools/glb-inspect.mjs file.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(process.argv[2]);
const root = doc.getRoot();
console.log('scenes', root.listScenes().map(s => s.getName()), 'nodes', root.listNodes().length, 'skins', root.listSkins().length, 'meshes', root.listMeshes().map(m => m.getName() + ':' + m.listPrimitives().map(p => p.listSemantics().join('/')).join('|')));
const depth = (n) => { let d = 0; let p = n.getParentNode?.(); while (p) { d++; p = p.getParentNode?.(); } return d; };
const print = (n, d) => {
  const t = n.getTranslation(), r = n.getRotation(), s = n.getScale();
  console.log('  '.repeat(d) + n.getName(), 'T', t.map(v => v.toFixed(3)).join(','), 'R', r.map(v => v.toFixed(3)).join(','), 'S', s.map(v => v.toFixed(2)).join(','), n.getMesh() ? 'MESH' : '', n.getSkin() ? 'SKIN' : '');
  for (const c of n.listChildren()) print(c, d + 1);
};
for (const s of root.listScenes()) for (const n of s.listChildren()) print(n, 0);
for (const skin of root.listSkins()) {
  console.log('skin joints', skin.listJoints().length, 'skeleton', skin.getSkeleton()?.getName());
  const ibm = skin.getInverseBindMatrices();
  console.log('ibm count', ibm?.getCount());
}
for (const a of root.listAnimations()) {
  const chans = a.listChannels();
  let maxT = 0;
  for (const c of chans) { const t = c.getSampler().getInput().getMax([0]); maxT = Math.max(maxT, t[0]); }
  console.log('anim', a.getName(), 'channels', chans.length, 'dur', maxT.toFixed(3), 'keys', chans[0].getSampler().getInput().getCount(), 'interp', [...new Set(chans.map(c => c.getSampler().getInterpolation()))]);
  console.log(' targets', [...new Set(chans.map(c => c.getTargetNode().getName() + '.' + c.getTargetPath()))].join(', '));
}
const mesh = root.listMeshes()[0];
if (mesh) { const p = mesh.listPrimitives()[0]; const pos = p.getAttribute('POSITION'); console.log('mesh bounds', pos.getMin([0,0,0]).map(v=>v.toFixed(3)), pos.getMax([0,0,0]).map(v=>v.toFixed(3)), 'verts', pos.getCount()); }
