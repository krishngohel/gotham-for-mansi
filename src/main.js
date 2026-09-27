import * as THREE from 'three';
import './ui/style.css';
import { getQuality } from './render/quality.js';
import { createRenderer } from './render/renderer.js';
import { createInkPipeline } from './render/inkPipeline.js';
import { toonMaterial, addHullOutline } from './render/toon.js';

const quality = getQuality('high');
const renderer = createRenderer(document.getElementById('game'), quality);
const ink = createInkPipeline(renderer, quality);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a2436);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(0, 1.5, 5);
scene.add(new THREE.HemisphereLight(0x6a7fa8, 0x14171f, 1.2));
const sun = new THREE.DirectionalLight(0xa9bde0, 2.5);
sun.position.set(-3, 5, 4);
scene.add(sun);
const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.35, 160, 24), toonMaterial({ color: 0x5b6474 }));
knot.position.y = 1.5;
addHullOutline(knot, 0.03);
scene.add(knot);
const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 10), toonMaterial({ color: 0x4b586e }));
scene.add(floor);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  ink.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();
document.getElementById('loading').remove();
renderer.setAnimationLoop((t) => {
  knot.rotation.y = t / 2000;
  ink.render(scene, camera, t / 1000);
});
