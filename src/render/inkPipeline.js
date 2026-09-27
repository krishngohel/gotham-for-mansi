import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { LAYER_FX, LAYER_XRAY } from './layers.js';

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const fragmentShader = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform vec2 uTexel;
uniform float uNear, uFar, uTime, uFlash, uDetective, uHalftone, uHalftoneAmount;
uniform vec3 uInk, uPaper, uDetectiveTint;
varying vec2 vUv;

float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  // Depth edges from the Laplacian of inverse depth: 1/z is linear across any plane in screen
  // space, so flat floors seen at grazing angles produce no false lines.
  float dc = viewDepth(vUv);
  float ic = 1.0 / dc;
  float lap = 0.0;
  vec3 gxN = vec3(0.0), gyN = vec3(0.0);
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 uv = vUv + vec2(float(i), float(j)) * uTexel;
      float kx = float(i) * (j == 0 ? 2.0 : 1.0);
      float ky = float(j) * (i == 0 ? 2.0 : 1.0);
      lap += 1.0 / viewDepth(uv);
      vec3 n = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      gxN += n * kx; gyN += n * ky;
    }
  }
  lap -= 9.0 * ic;
  float depthEdge = smoothstep(0.12, 0.3, abs(lap) / ic);
  float normalEdge = smoothstep(0.6, 1.2, length(gxN) + length(gyN));
  float edge = max(depthEdge, normalEdge) * (1.0 - smoothstep(70.0, 180.0, dc));

  vec3 col = texture2D(tColor, vUv).rgb;
  float L = pow(max(luma(col), 0.0), 1.0 / 2.2);

  // Halftone: dots grow as the tone darkens.
  vec2 frag = gl_FragCoord.xy;
  vec2 cell = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / uHalftone;
  float r = smoothstep(0.2, 0.03, L) * 0.6 * step(dc, 400.0) * uHalftoneAmount;
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.06, length(fract(cell) - 0.5));
  col = mix(col, uInk, dotMask * step(0.001, r) * 0.9);

  vec3 line = uInk;
  if (uDetective > 0.0) {
    vec3 det = uDetectiveTint * (0.08 + 0.9 * L);
    det *= 0.88 + 0.12 * sin(frag.y * 1.2 + uTime * 6.0);
    col = mix(col, det, uDetective);
    line = mix(line, uDetectiveTint * 1.6, uDetective);
  }
  col = mix(col, line, edge);
  if (uFlash > 0.0) col = mix(col, (L > 0.08 && edge < 0.5) ? uPaper : uInk, uFlash);

  col *= 0.95 + 0.05 * hash(floor(frag / 2.0) + floor(uTime * 12.0));
  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.72 * dot(v, v);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createInkPipeline(renderer, quality) {
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  colorRT.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
  const normalRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const normalMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });

  const uniforms = {
    tColor: { value: colorRT.texture },
    tDepth: { value: colorRT.depthTexture },
    tNormal: { value: normalRT.texture },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 },
    uFar: { value: 1000 },
    uTime: { value: 0 },
    uFlash: { value: 0 },
    uDetective: { value: 0 },
    uHalftone: { value: 5 },
    uHalftoneAmount: { value: 1 },
    uInk: { value: new THREE.Color(PALETTE.ink) },
    uPaper: { value: new THREE.Color(PALETTE.paper) },
    uDetectiveTint: { value: new THREE.Color(PALETTE.detective) },
  };
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, depthTest: false, depthWrite: false }),
  );
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function setSize(width, height) {
    const pr = renderer.getPixelRatio();
    const w = Math.max(1, Math.floor(width * pr));
    const h = Math.max(1, Math.floor(height * pr));
    colorRT.setSize(w, h);
    normalRT.setSize(Math.max(1, Math.floor(w * quality.normalScale)), Math.max(1, Math.floor(h * quality.normalScale)));
    uniforms.uTexel.value.set(1 / w, 1 / h).multiplyScalar(Math.max(1, pr * 0.75));
    uniforms.uHalftone.value = 7 * pr;
  }

  function render(scene, camera, time) {
    uniforms.uNear.value = camera.near;
    uniforms.uFar.value = camera.far;
    uniforms.uTime.value = time;

    camera.layers.set(0);
    camera.layers.enable(LAYER_FX);
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(colorRT);
    renderer.render(scene, camera);

    camera.layers.set(0);
    const { background, fog } = scene;
    scene.background = null;
    scene.fog = null;
    scene.overrideMaterial = normalMat;
    renderer.setRenderTarget(normalRT);
    renderer.render(scene, camera);
    scene.overrideMaterial = null;
    scene.background = background;
    scene.fog = fog;

    renderer.setRenderTarget(null);
    renderer.render(quadScene, quadCam);

    if (uniforms.uDetective.value > 0.01) {
      camera.layers.set(LAYER_XRAY);
      scene.background = null;
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(scene, camera);
      renderer.autoClear = true;
      scene.background = background;
    }
    camera.layers.set(0);
    camera.layers.enable(LAYER_FX);
  }

  return { uniforms, setSize, render };
}
