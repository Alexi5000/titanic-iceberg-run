// file: src/main.ts
// description: Application entry point - renderer setup, world composition, and the requestAnimationFrame game loop
// reference: src/world/ocean.ts, src/world/sky.ts, GAME_PLAN.md

import * as THREE from 'three';
import { Ocean } from './world/ocean';
import { create_sky } from './world/sky';
import { TitanicShip } from './ship/titanic_model';

const FOG_COLOR = new THREE.Color(0x060d18);
const FOG_DENSITY = 0.0016;

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = FOG_COLOR.clone();
scene.fog = new THREE.FogExp2(FOG_COLOR.getHex(), FOG_DENSITY);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 8000);
camera.position.set(120, 60, -200);
camera.lookAt(0, 15, 0);

const sky = create_sky();
scene.add(sky.group);

const ocean = new Ocean(FOG_COLOR, FOG_DENSITY, sky.moon_dir);
scene.add(ocean.mesh);

const ship = new TitanicShip();
scene.add(ship.group);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let elapsed = 0;

function frame(): void {
  const delta = Math.min(clock.getDelta(), 0.1);
  elapsed += delta;

  ocean.update(elapsed, camera, ship.group.position.x, ship.group.position.z);
  ship.update(elapsed, delta);

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
