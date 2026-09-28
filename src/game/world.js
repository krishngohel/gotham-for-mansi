// Assembles the whole city: geometry, collision, sky, weather, the Batsignal and lighting.
import * as THREE from 'three';
import { PALETTE } from '../config/palette.js';
import { createRng } from '../core/rng.js';
import { createCollision } from '../world/collision.js';
import { buildMapData, WORLD, SITES } from '../world/mapData.js';
import { createCityContext, buildCity, finishCity } from '../world/cityBuilder.js';
import { buildDistricts } from '../world/districts.js';
import { createSkyDome } from '../world/sky.js';
import { createBackdrop } from '../world/skyline.js';
import { createBatsignal } from '../world/batsignal.js';
import { createWater } from '../world/water.js';
import { createLightPool } from '../world/lightPool.js';
import { createRain } from '../render/rain.js';
import { createCityLife } from '../world/cityLife.js';
import { createWetStreaks } from '../world/wetStreaks.js';
import { createSteam } from '../world/steam.js';

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
  ctx.quality = quality;
  buildCity(ctx, data);
  buildDistricts(ctx);
  finishCity(ctx);

  // Lighting: a low sky fill so walls turned from the moon fall into shadow, a moon that casts
  // shadows near the player, and a cool rim from behind that mostly shows on silhouettes.
  scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 0.75));
  const MOON = 2.4;
  const moon = new THREE.DirectionalLight(0xa9bde0, MOON);
  const moonOffset = new THREE.Vector3(-30, 60, 22);
  if (quality.shadows) {
    moon.castShadow = true;
    moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 20, far: 150 });
    moon.shadow.bias = -0.0012;
    moon.shadow.normalBias = 0.06;
  }
  scene.add(moon, moon.target);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.1);
  rim.position.set(20, 30, -60);
  scene.add(rim);

  const sky = createSkyDome();
  sky.setSignalPoint(SIGNAL_POINT, 34);
  scene.add(sky.mesh);
  const backdrop = createBackdrop(rng);
  backdrop.name = 'backdrop';
  scene.add(backdrop);
  for (const [x, y, z] of backdrop.userData.beacons) {
    const i = ctx.halos.add(x, y, z, PALETTE.balloon, 7);
    ctx.blinkers.push({ i, size: 7, phase: x * 0.01 + z });
  }
  for (const [x, y, z] of backdrop.userData.bridgeLamps) ctx.halos.add(x, y, z, PALETTE.sodium, 9);
  const signal = createBatsignal(SIGNAL_LAMP, SIGNAL_POINT);
  scene.add(signal.group);
  const water = createWater();
  scene.add(water.mesh);
  const rain = createRain(quality.rainCount);
  scene.add(rain.mesh);
  const pool = createLightPool(scene, ctx.lights, 4);
  // The finale's firework flash, dark until then. It lives here so the number of lights (part of
  // every lit shader's compile key) never changes after boot.
  const fireworkLight = new THREE.PointLight(0xfff0d0, 0, 400, 1.2);
  scene.add(fireworkLight);
  const streaks = createWetStreaks(ctx.reflect, { fogDensity: scene.fog.density });
  streaks.name = 'wetStreaks';
  scene.add(streaks);
  const low = quality.name === 'low';
  const steam = createSteam(low ? ctx.steam.filter((s) => s.y < 1) : ctx.steam, { perSource: low ? 3 : 5, fogDensity: scene.fog.density });
  steam.mesh.name = 'steam';
  scene.add(steam.mesh);
  for (const o of [backdrop, streaks, steam.mesh]) { o.updateMatrix(); o.matrixAutoUpdate = false; }
  const life = createCityLife(scene, ctx.halos, rng);

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
    fireworkLight,
    data,
    setFlash(k) { moon.intensity = MOON + 9 * k; backdrop.userData.setFlash(k); },
    update(t, dt, focus, camera, hero = null) {
      for (const u of ctx.updaters) u(t);
      life.update(t, dt, hero);
      sky.update(t, camera.position);
      water.update(t, camera.position);
      // Splashes on whatever the player stands on, hidden while gliding or falling.
      const ground = hero ? collision.groundBelow(hero.pos.x, hero.pos.y + 0.5, hero.pos.z, 0.3) : -Infinity;
      rain.update(t, camera.position, hero && hero.pos.y - ground < 1.5 && ground > -5 ? ground : null);
      steam.update(t);
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
