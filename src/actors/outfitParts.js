// Clothing from Quaternius's Modular Character Outfits (CC0), worn on our characters.
// Parts are rebound to the wearer's skeleton by bone name; their painted textures are kept only
// for shading detail and repainted into palette colors (a two-region duotone).
import * as THREE from 'three';
import { toonMaterial, addHullOutline } from '../render/toon.js';
import { LAYER_FX } from '../render/layers.js';

// Adds a hard comic rim light to any toon material, chaining onto an existing onBeforeCompile.
export function addRim(mat, color = 0x9fc3ff, strength = 0.8, width = [0.5, 0.62], lift = 0.32) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey?.bind(mat);
  const rim = { value: new THREE.Color(color).multiplyScalar(strength) };
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uRimColor = rim;
    shader.fragmentShader = 'uniform vec3 uRimColor;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', `
	float rimF = 1.0 - max(dot(normal, normalize(vViewPosition)), 0.0);
	// A floor of light on the figure so costumes read in the dark, plus a hard rim.
	outgoingLight = max(outgoingLight, diffuseColor.rgb * ${lift.toFixed(2)});
	outgoingLight += uRimColor * smoothstep(${width[0].toFixed(2)}, ${width[1].toFixed(2)}, rimF);
	#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `${prevKey ? prevKey() : ''}|rim${width.join(',')}|${lift}`;
  mat.needsUpdate = true;
  return mat;
}

// Toon material that keeps a texture's shading but recolors it. Greenish texels use `a`,
// everything else `b`; each is [shadowColor, lightColor]. `lift` is the shadow floor (see addRim).
export function duotone(map, normalMap, { a, b, skin = null }, lift = 0.32) {
  const mat = toonMaterial({ map, normalMap, normalScale: 0.6 });
  const A = a.map((c) => new THREE.Color(c)), B = b.map((c) => new THREE.Color(c));
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uA0 = { value: A[0] }; shader.uniforms.uA1 = { value: A[1] };
    shader.uniforms.uB0 = { value: B[0] }; shader.uniforms.uB1 = { value: B[1] };
    shader.fragmentShader = 'uniform vec3 uA0, uA1, uB0, uB1;\n' + shader.fragmentShader.replace('#include <map_fragment>', `
	vec4 texel = texture2D(map, vMapUv);
	// Perceptual brightness, stretched so the dark painted cloth still spans the full ramp.
	float lum = pow(max(dot(texel.rgb, vec3(0.299, 0.587, 0.114)), 0.0), 1.0 / 2.2);
	float green = smoothstep(0.01, 0.06, texel.g - max(texel.r, texel.b));
	// Two flat inks per region (dark cloth / light cloth), keeping the painted folds as shading.
	float k = smoothstep(0.34, 0.4, lum);
	float fold = 0.62 + 0.75 * smoothstep(0.05, 0.7, lum);
	diffuseColor.rgb *= mix(mix(uB0, uB1, k), mix(uA0, uA1, k), green) * fold;`);
  };
  mat.customProgramCacheKey = () => `duo`;
  return addRim(mat, 0x9fc3ff, 0.8, [0.5, 0.62], lift);
}

function partMeshes(outfits, name) {
  const node = outfits.getObjectByName(name);
  if (!node) throw new Error(`Missing outfit part ${name}`);
  const out = [];
  node.traverse((o) => { if (o.isSkinnedMesh) out.push(o); });
  return out;
}

// materialFor(sourceMaterial) -> the material to wear. Returns the new meshes.
export function wear(ch, outfits, name, materialFor, { outline = 0.009 } = {}) {
  const made = [];
  for (const src of partMeshes(outfits, name)) {
    // The loader suffixes duplicate node names (pelvis_3), so fall back to the base name.
    const find = (n) => ch.model.getObjectByName(n) ?? ch.model.getObjectByName(n.replace(/_\d+$/, ''));
    const bones = src.skeleton.bones.map((b) => find(b.name));
    if (bones.some((b) => !b)) throw new Error(`Skeleton mismatch for ${name}`);
    const mesh = new THREE.SkinnedMesh(src.geometry, materialFor(src.material));
    mesh.bind(new THREE.Skeleton(bones, src.skeleton.boneInverses), src.bindMatrix);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    // Folds, straps and buckles would fill the crease-detection pass with ink, so clothes skip it:
    // their silhouettes still ink from depth and the hull outline.
    mesh.layers.set(LAYER_FX);
    ch.body.parent.add(mesh);
    if (outline) addHullOutline(mesh, outline);
    made.push(mesh);
  }
  return made;
}

// Drops body triangles whose three vertices all satisfy hide(p), so skin can't poke through clothes.
export function hideBody(body, hide) {
  const g = body.geometry;
  const pos = g.attributes.position;
  const idx = g.index.array;
  const keep = [];
  const p = new THREE.Vector3();
  const hidden = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); hidden[i] = hide(p) ? 1 : 0; }
  for (let t = 0; t < idx.length; t += 3) {
    if (hidden[idx[t]] && hidden[idx[t + 1]] && hidden[idx[t + 2]]) continue;
    keep.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  g.setIndex(keep);
}

// Skin/glove material for the bare-hand material that ships inside the arm parts.
export const isSkinMaterial = (m) => /Regular/i.test(m?.name ?? '');
