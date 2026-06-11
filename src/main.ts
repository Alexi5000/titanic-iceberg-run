// file: src/main.ts
// description: Application entry point - renderer setup, world composition, and the requestAnimationFrame game loop
// reference: src/world/ocean.ts, src/world/sky.ts, GAME_PLAN.md

import * as THREE from 'three';
import { Ocean } from './world/ocean';
import { create_sky } from './world/sky';
import { TitanicShip } from './ship/titanic_model';
import { ShipPhysics } from './ship/ship_physics';
import { InputManager } from './core/input_manager';

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

const physics = new ShipPhysics();
const input = new InputManager();

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

  physics.read_input(input);
  physics.update(delta);

  ship.group.position.x = physics.x;
  ship.group.position.z = physics.z;
  ship.group.rotation.y = physics.heading;

  ocean.update(elapsed, camera, physics.x, physics.z);
  ship.update(elapsed, delta, physics.turn_heel);

  // Temporary chase camera until the camera director lands (M5).
  const cam_dist = 220;
  const cam_x = physics.x - Math.sin(physics.heading) * cam_dist;
  const cam_z = physics.z - Math.cos(physics.heading) * cam_dist;
  camera.position.lerp(new THREE.Vector3(cam_x, 70, cam_z), 1 - Math.exp(-2.5 * delta));
  camera.lookAt(physics.x, 14, physics.z);

  input.end_frame();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
