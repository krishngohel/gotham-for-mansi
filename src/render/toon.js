import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX, LAYER_XRAY } from './layers.js';

let gradient = null;

// Three hard bands: shadow, mid, lit.
export function toonGradient() {
  if (gradient) return gradient;
  const data = new Uint8Array([34, 34, 34, 255, 120, 120, 120, 255, 255, 255, 255, 255]);
  gradient = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial({
  color = 0xffffff, map = null, normalMap = null, vertexColors = false,
  emissive = 0x000000, emissiveMap = null, emissiveIntensity = 1, side = THREE.FrontSide,
} = {}) {
  return new THREE.MeshToonMaterial({
    color, map, normalMap, vertexColors, emissive, emissiveMap, emissiveIntensity, side,
    gradientMap: toonGradient(),
  });
}

// Inverted-hull ink line. Lives on LAYER_FX so it never reaches the normal pass.
export function addHullOutline(mesh, width = 0.011, color = PALETTE.ink) {
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  mat.userData.outline = { value: width };
  const skinned = mesh.isSkinnedMesh;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uOutline = mat.userData.outline;
    shader.vertexShader = 'uniform float uOutline;\n' + (skinned
      ? shader.vertexShader.replace('#include <skinning_vertex>', '#include <skinning_vertex>\n\ttransformed += normalize(objectNormal) * uOutline;')
      : shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n\ttransformed += normalize(normal) * uOutline;'));
  };
  mat.customProgramCacheKey = () => (skinned ? 'hull-skinned' : 'hull-static');
  const hull = skinned ? new THREE.SkinnedMesh(mesh.geometry, mat) : new THREE.Mesh(mesh.geometry, mat);
  if (skinned) hull.bind(mesh.skeleton, mesh.bindMatrix);
  hull.layers.set(LAYER_FX);
  hull.frustumCulled = false;
  hull.castShadow = false;
  mesh.add(hull);
  return hull;
}

// Flat silhouette that shows through walls in detective vision.
export function addXray(mesh, color = PALETTE.sodium) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false });
  const xray = new THREE.SkinnedMesh(mesh.geometry, mat);
  xray.bind(mesh.skeleton, mesh.bindMatrix);
  xray.layers.set(LAYER_XRAY);
  xray.frustumCulled = false;
  mesh.add(xray);
  return xray;
}
