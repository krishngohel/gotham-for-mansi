// Assembles the whole city: geometry, collision, sky, weather, the Batsignal and lighting.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { createRng } from '../core/rng.js';
import { createCollision } from '../world/collision.js';
import { buildMapData, WORLD, SITES } from '../world/mapData.js';
import { createCityContext, buildCity, finishCity } from '../world/cityBuilder.js';
import { buildDistricts } from '../world/districts.js';
import { createSkyDome } from '../world/sky.js';
import { createSkyline } from '../world/skyline.js';
import { createBatsignal } from '../world/batsignal.js';
import { createWater } from '../world/water.js';
import { createLightPool } from '../world/lightPool.js';
import { createRain } from '../render/rain.js';

export const SIGNAL_LAMP = new THREE.Vector3(SITES.signal.x, SITES.signal.y + 1.3, SITES.signal.z);
export const SIGNAL_POINT = new THREE.Vector3(-110, 210, -215);

export function createWorld(scene, quality) {
  const rng = createRng(11);
  scene.background = new THREE.Color(PALETTE.fog);
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.0062);

  const collision = createCollision({ floor: (x, z) => (z > WORLD.waterZ ? -Infinity : 0) });
  // Invisible walls at the edge of the playable city.
  const H = 400;
  collision.addBox(WORLD.minX - 10, -5, WORLD.minZ - 10, WORLD.maxX + 10, H, WORLD.minZ, 'bound');
  collision.addBox(WORLD.minX - 10, -5, WORLD.minZ, WORLD.minX, H, 320, 'bound');
  collision.addBox(WORLD.maxX, -5, WORLD.minZ, WORLD.maxX + 10, H, 320, 'bound');
  collision.addBox(WORLD.minX - 10, -5, 320, WORLD.maxX + 10, H, 330, 'bound');

  const data = buildMapData(11);
  const ctx = createCityContext(scene, rng, collision);
  ctx.compounds = data.compounds;
  buildCity(ctx, data);
  buildDistricts(ctx);
  finishCity(ctx);

  // Lighting: sky fill, a moon that casts shadows near the player, a cool rim from behind.
  scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 1.05));
  const moon = new THREE.DirectionalLight(0xa9bde0, 2.1);
  const moonOffset = new THREE.Vector3(-30, 60, 22);
  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 20, far: 150 });
    moon.shadow.bias = -0.0012;
    moon.shadow.normalBias = 0.06;
  }
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.9);
  rim.position.set(20, 30, -60);
  scene.add(rim);

  const sky = createSkyDome();
  sky.setSignalPoint(SIGNAL_POINT, 34);
  scene.add(sky.mesh);
  scene.add(createSkyline(rng, { count: 260, minDist: 330, maxDist: 620, backdrop: true }));
  const signal = createBatsignal(SIGNAL_LAMP, SIGNAL_POINT);
  scene.add(signal.group);
  const water = createWater();
  scene.add(water.mesh);
  const rain = createRain(quality.rainCount);
  scene.add(rain.mesh);
  const pool = createLightPool(scene, ctx.lights, 4);

  const snap = new THREE.Vector3();
  return {
    collision,
    grapplePoints: ctx.grapple,
    roofs: ctx.roofs,
    halos: ctx.halos,
    sky,
    signal,
    rain,
    moon,
    data,
    setFlash(k) { moon.intensity = 2.1 + 9 * k; },
    update(t, dt, focus, camera) {
      for (const u of ctx.updaters) u(t);
      sky.update(t, camera.position);
      water.update(t, camera.position);
      rain.update(t, camera.position);
      signal.update(t);
      pool.update(dt, focus);
      // Keep the shadow box centered on the player, snapped to texels to stop shimmering.
      const step = 64 / (quality.shadowMapSize || 1024);
      snap.set(Math.round(focus.x / step) * step, Math.round(focus.y / step) * step, Math.round(focus.z / step) * step);
      moon.target.position.copy(snap);
      moon.position.copy(snap).add(moonOffset);
    },
    resize(height, fov) { ctx.halos.resize(height, fov); },
  };
}
