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
uniform float uWobble, uHatch, uMidDots, uSkyDots, uColorEdges, uMisreg, uPaletteAmt, uImpact, uPaperTex;
uniform vec2 uImpactCenter;
uniform vec3 uPalette[6];
uniform vec3 uInk, uPaper, uDetectiveTint;
varying vec2 vUv;

float viewDepth(vec2 uv) { return -perspectiveDepthToViewZ(texture2D(tDepth, uv).x, uNear, uFar); }
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Mirrors snapColor() in src/render/comicPalette.js.
vec3 snapPalette(vec3 c, float amount) {
  float L = luma(c);
  if (amount <= 0.0 || L < 0.02) return c;
  vec3 cn = c / max(L, 1e-3);
  vec3 best = cn; float bd = 1e9;
  for (int i = 0; i < 6; i++) {
    vec3 pn = uPalette[i] / max(luma(uPalette[i]), 1e-3);
    vec3 d = cn - pn;
    float dd = dot(d, d);
    if (dd < bd) { bd = dd; best = pn; }
  }
  // Saturated accents (signs, the Joker's suit, balloons) keep their own colour.
  float sat = (max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))) / max(max(c.r, max(c.g, c.b)), 1e-3);
  float k = amount * clamp((L - 0.02) / 0.06, 0.0, 1.0) * (1.0 - smoothstep(0.45, 0.7, sat));
  return mix(c, best * L, k);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Boiling line: sample positions drift a little and re-roll 8 times a second.
  vec2 uvE = vUv;
  if (uWobble > 0.0) {
    vec2 bp = frag / 90.0 + floor(uTime * 8.0) * 17.13;
    uvE += (vec2(vnoise(bp), vnoise(bp + 31.7)) - 0.5) * uTexel * 2.2 * uWobble;
  }

  // Depth edges from the Laplacian of inverse depth: 1/z is linear across any plane in screen
  // space, so flat floors seen at grazing angles produce no false lines.
  float dc = viewDepth(uvE);
  float ic = 1.0 / dc;
  float lap = 0.0;
  vec3 gxN = vec3(0.0), gyN = vec3(0.0);
  // A wider kernel close to the camera gives near silhouettes a bolder brush line.
  vec2 texel = uTexel * mix(1.6, 1.0, smoothstep(6.0, 28.0, dc));
  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 uv = uvE + vec2(float(i), float(j)) * texel;
      float kx = float(i) * (j == 0 ? 2.0 : 1.0);
      float ky = float(j) * (i == 0 ? 2.0 : 1.0);
      lap += 1.0 / viewDepth(uv);
      vec3 n = texture2D(tNormal, uv).xyz * 2.0 - 1.0;
      gxN += n * kx; gyN += n * ky;
    }
  }
  lap -= 9.0 * ic;
  // Brush weight: near silhouettes also test a ring twice as wide, so outlines swell.
  float thick = 0.0;
  if (dc < 35.0) {
    vec2 t2 = texel * 2.0;
    float m = max(max(abs(1.0 / viewDepth(uvE + vec2(t2.x, 0.0)) - ic), abs(1.0 / viewDepth(uvE - vec2(t2.x, 0.0)) - ic)),
                  max(abs(1.0 / viewDepth(uvE + vec2(0.0, t2.y)) - ic), abs(1.0 / viewDepth(uvE - vec2(0.0, t2.y)) - ic)));
    thick = smoothstep(0.25, 0.5, m / ic) * (1.0 - smoothstep(20.0, 35.0, dc));
  }
  float depthEdge = max(smoothstep(0.12, 0.3, abs(lap) / ic), thick);
  // Creases are a thinner pen line.
  float normalEdge = smoothstep(0.7, 1.3, length(gxN) + length(gyN)) * 0.8;
  float edge = max(depthEdge, normalEdge) * (1.0 - smoothstep(70.0, 180.0, dc));

  // Colour, with a hair of print misregistration.
  vec3 col = texture2D(tColor, vUv).rgb;
  if (uMisreg > 0.0) {
    vec2 o = uTexel * 1.1 * uMisreg;
    col.r = mix(col.r, texture2D(tColor, vUv + vec2(o.x, o.y * 0.5)).r, 0.6);
    col.b = mix(col.b, texture2D(tColor, vUv - vec2(o.x, o.y * 0.5)).b, 0.6);
  }
  // Ink where flat colours meet (window frames, signs, road paint), close to the camera.
  if (uColorEdges > 0.0 && dc < 90.0) {
    float lx = luma(texture2D(tColor, vUv + vec2(uTexel.x, 0.0)).rgb) - luma(texture2D(tColor, vUv - vec2(uTexel.x, 0.0)).rgb);
    float ly = luma(texture2D(tColor, vUv + vec2(0.0, uTexel.y)).rgb) - luma(texture2D(tColor, vUv - vec2(0.0, uTexel.y)).rgb);
    float ce = smoothstep(0.16, 0.32, abs(lx) + abs(ly)) * (1.0 - smoothstep(30.0, 90.0, dc)) * 0.6 * uColorEdges;
    edge = max(edge, ce);
  }
  col = snapPalette(col, uPaletteAmt);
  float L = pow(max(luma(col), 0.0), 1.0 / 2.2);

  vec2 cell = mat2(0.7071, -0.7071, 0.7071, 0.7071) * frag / uHalftone;
  bool sky = dc > uFar * 0.9;
  float nearK = 1.0 - smoothstep(25.0, 80.0, dc);
  // Shadows: cross-hatching up close, Ben-Day dots further out (never both at full strength).
  float hatchZone = smoothstep(0.2, 0.1, L) * nearK * uHatch;
  float r = (0.3 * smoothstep(0.24, 0.15, L) + 0.12 * smoothstep(0.1, 0.04, L)) * (1.0 - smoothstep(60.0, 150.0, dc)) * uHalftoneAmount * (1.0 - hatchZone * 0.8);
  float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.06, length(fract(cell) - 0.5));
  col = mix(col, uInk, dotMask * step(0.001, r) * 0.9);
  if (hatchZone > 0.0) {
    vec2 hp = frag + (uWobble > 0.0 ? vec2(vnoise(frag / 40.0 + floor(uTime * 8.0)) * 1.5, 0.0) : vec2(0.0));
    float s = uHalftone * 0.9;
    float h1 = 1.0 - smoothstep(0.12, 0.28, abs(fract((hp.x + hp.y) / s) - 0.5));
    float h2 = 1.0 - smoothstep(0.12, 0.28, abs(fract((hp.x - hp.y) / s) - 0.5));
    float hatch = max(h1, h2 * smoothstep(0.1, 0.05, L)) * hatchZone;
    col = mix(col, uInk, hatch * 0.75);
  }
  // Mid tones: a light dot tint of the surface's own hue.
  float mid = smoothstep(0.18, 0.26, L) * (1.0 - smoothstep(0.42, 0.55, L)) * (1.0 - smoothstep(50.0, 120.0, dc)) * uMidDots;
  if (mid > 0.0 && !sky) {
    float rm = 0.22 * mid;
    float mm = 1.0 - smoothstep(rm - 0.06, rm + 0.06, length(fract(cell) - 0.5));
    col = mix(col, col * 0.62, mm);
  }
  // Sky: big dots grading toward the horizon.
  if (sky && uSkyDots > 0.0) {
    float rs = 0.3 * clamp(1.2 - vUv.y * 1.4, 0.0, 1.0) * uSkyDots;
    float sm = 1.0 - smoothstep(rs - 0.06, rs + 0.06, length(fract(cell / 2.6) - 0.5));
    col = mix(col, col * 0.72, sm * step(0.001, rs));
  }

  vec3 line = uInk;
  if (uDetective > 0.0) {
    vec3 det = uDetectiveTint * (0.08 + 0.9 * L);
    det *= 0.88 + 0.12 * sin(frag.y * 1.2 + uTime * 6.0);
    col = mix(col, det, uDetective);
    line = mix(line, uDetectiveTint * 1.6, uDetective);
  }
  col = mix(col, line, edge);
  if (uFlash > 0.0) col = mix(col, (L > 0.08 && edge < 0.5) ? uPaper : uInk, uFlash);

  // Impact frame: black and white ink with radial speed lines out from the hit.
  if (uImpact > 0.0) {
    vec3 bw = mix(uInk, uPaper, step(0.22, L));
    bw = mix(bw, uInk, edge);
    vec2 d = (vUv - uImpactCenter) * vec2(uTexel.y / uTexel.x, 1.0);
    float ang = atan(d.y, d.x);
    float rays = step(0.8, fract(ang * 9.549 + hash(vec2(floor(ang * 30.0), 1.0)) * 0.5)) * smoothstep(0.1, 0.45, length(d));
    col = mix(col, mix(bw, uInk, rays * 0.9), uImpact);
  }

  // Paper: fibres, a slow grain, and warm paper white in the highlights.
  if (uPaperTex > 0.0) {
    float fib = vnoise(frag * vec2(0.9, 0.12)) * 0.5 + vnoise(frag * 0.35) * 0.5;
    col *= 0.965 + 0.05 * fib;
    col = mix(col, uPaper, smoothstep(0.8, 1.0, L) * 0.35);
  }
  col *= 0.96 + 0.04 * hash(floor(frag / 2.0) + floor(uTime * 6.0));
  vec2 v = vUv - 0.5;
  col *= 1.0 - 0.72 * dot(v, v);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

export function createInkPipeline(renderer, quality) {
  // Half-float targets need EXT_color_buffer_float; fall back to 8-bit where it's missing.
  const floatOK = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
  const type = floatOK ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const colorRT = new THREE.WebGLRenderTarget(1, 1, { type });
  colorRT.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
  const normalRT = new THREE.WebGLRenderTarget(1, 1, { type });
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
    uWobble: { value: 0 }, uHatch: { value: 0 }, uMidDots: { value: 0 }, uSkyDots: { value: 0 },
    uColorEdges: { value: 0 }, uMisreg: { value: 0 }, uPaletteAmt: { value: 0 }, uPaperTex: { value: 0 },
    uImpact: { value: 0 }, uImpactCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uPalette: { value: Array.from({ length: 6 }, () => new THREE.Color(0.5, 0.5, 0.5)) },
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

  let impactFrames = 0;
  function setComic(c) {
    uniforms.uWobble.value = c.wobble; uniforms.uHatch.value = c.hatch; uniforms.uMidDots.value = c.midDots;
    uniforms.uSkyDots.value = c.skyDots; uniforms.uColorEdges.value = c.colorEdges; uniforms.uMisreg.value = c.misreg;
    uniforms.uPaletteAmt.value = c.palette; uniforms.uPaperTex.value = c.paper;
  }
  function setPalette(a) { for (let i = 0; i < 6; i++) uniforms.uPalette.value[i].setRGB(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); }
  function impact(cx, cy) { uniforms.uImpactCenter.value.set(cx, cy); impactFrames = 2; }

  function render(scene, camera, time) {
    uniforms.uImpact.value = impactFrames > 0 ? 1 : 0;
    if (impactFrames > 0) impactFrames -= 1;
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

  return { uniforms, setSize, render, setComic, setPalette, impact };
}
