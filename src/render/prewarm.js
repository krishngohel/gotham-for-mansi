// First-sight hitch removal, and less per-frame shader churn (see readyObjects). The first time
// three.js draws an object it compiles any new shader variant (colour, the normal pass override, shadow depth, x-ray), uploads its textures and
// vertex buffers, and for a skinned mesh walks every vertex through its bones to find a culling
// sphere. Mid-play that shows up as a 50 to 700 ms freeze when a district, a goon type or the
// Joker first comes into view. These helpers move all of it under the loading screen.
import * as THREE from 'three';

const _sphere = new THREE.Sphere();

// SkinnedMesh.computeBoundingSphere() applies the bone transforms to every vertex (about 40 ms
// for one goon body). A loose sphere around the bind pose is plenty for frustum culling: twice
// the bind-pose radius covers any clip, including rolls and lunges.
export function looseSkinBounds(root) {
  root.traverse((o) => {
    if (!o.isSkinnedMesh || o.boundingSphere !== null) return;
    const g = o.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    _sphere.copy(g.boundingSphere);
    _sphere.radius *= 2;
    o.boundingSphere = _sphere.clone();
  });
}

// three.js re-derives a material's shader parameters (about 40 us each, 18 times a frame here)
// whenever one material is drawn on objects of different kinds. Two cases hit every frame:
// - the shadow pass shares one depth material between plain, skinned and instanced casters, so
//   each switch between them recomputes it; giving each kind its own depth material stops that;
// - three draws a transparent double-sided material twice (back faces, then front) and marks it
//   changed between the two. Everything that uses one here is a flat plane, a single-colour cone
//   or an additive or single-colour effect, where the two-pass order makes no visible difference,
//   so one pass draws the same picture.
const depthFor = new Map();
function depthMaterial(kind) {
  if (!depthFor.has(kind)) depthFor.set(kind, new THREE.MeshDepthMaterial());
  return depthFor.get(kind);
}
export function readyObjects(root) {
  looseSkinBounds(root);
  root.traverse((o) => {
    if (o.castShadow && o.customDepthMaterial === undefined) {
      if (o.isSkinnedMesh) o.customDepthMaterial = depthMaterial('skinned');
      else if (o.isInstancedMesh) o.customDepthMaterial = depthMaterial(o.instanceColor ? 'instancedColor' : 'instanced');
    }
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true;
  });
}

// Uploads every texture a material in `root` references (maps, uniforms) that is not on the GPU
// yet. Canvas textures are the big ones: a 1024x2048 facade costs 10 to 30 ms on first sight.
export function uploadTextures(renderer, root) {
  const seen = new Set();
  const visit = (t) => {
    if (!t?.isTexture || seen.has(t)) return;
    seen.add(t);
    if (t.image && !renderer.properties.get(t).__webglTexture) renderer.initTexture(t);
  };
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) visit(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) Array.isArray(u.value) ? u.value.forEach(visit) : visit(u.value);
    }
  });
  return seen.size;
}

// Draws the whole scene once through the ink pipeline (shadow, colour, normal, x-ray and the
// ink quad) with every object shown and culling off, then puts visibility back. Synchronous, so
// the frame loop never sees the forced state. The final quad lands on the canvas, but the next
// animation frame overwrites it before the browser paints.
export function drawEverything(renderer, ink, scene, camera) {
  const saved = [];
  scene.traverse((o) => { saved.push(o, o.visible, o.frustumCulled); o.visible = true; o.frustumCulled = false; });
  const det = ink.uniforms.uDetective.value;
  readyObjects(scene);
  try {
    ink.uniforms.uDetective.value = 1;
    ink.render(scene, camera, 0);
  } finally {
    ink.uniforms.uDetective.value = det;
    for (let i = 0; i < saved.length; i += 3) { saved[i].visible = saved[i + 1]; saved[i].frustumCulled = saved[i + 2]; }
  }
}
