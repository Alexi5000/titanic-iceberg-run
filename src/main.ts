// file: src/main.ts
// description: Application entry point - renderer setup, world composition, and the requestAnimationFrame game loop
// reference: src/world/ocean.ts, src/world/sky.ts, GAME_PLAN.md

import * as THREE from 'three';
import { Ocean } from './world/ocean';
import { create_sky } from './world/sky';
import { TitanicShip } from './ship/titanic_model';
import { ShipPhysics } from './ship/ship_physics';
import { InputManager } from './core/input_manager';
import { GameState, GamePhase } from './core/game_state';
import { IcebergField } from './world/iceberg_field';
import { CollisionSystem } from './ship/collision';
import { CameraDirector } from './camera/camera_director';
import { SinkingSequence } from './ship/sinking_sequence';

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

const state = new GameState();
const field = new IcebergField();
scene.add(field.group);
const collision = new CollisionSystem();

const director = new CameraDirector();
const sinking = new SinkingSequence();

state.on('fatal', () => sinking.begin());

// Until the title menu lands (M7) the run starts immediately.
state.set_phase(GamePhase.Playing);
field.seed_initial(physics.x, physics.z, physics.heading);

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

  if (state.phase === GamePhase.Playing) {
    physics.read_input(input);
    state.run_time += delta;

    if (input.was_pressed('KeyV')) director.cycle_gameplay_view();
    if (input.was_pressed('KeyC')) director.toggle_cinematic();
  }

  if (state.phase === GamePhase.Sinking) {
    // Engines are gone - she drifts to a stop while going down.
    physics.speed *= Math.exp(-0.6 * delta);
  }
  physics.update(delta);

  field.update(delta, elapsed, physics.x, physics.z, physics.heading, physics.speed);
  collision.update(delta, physics, field, state);

  ship.group.position.x = physics.x;
  ship.group.position.z = physics.z;
  ship.group.rotation.y = physics.heading;

  ocean.update(elapsed, camera, physics.x, physics.z);
  ship.update(elapsed, delta, physics.turn_heel);

  const sink_progress = sinking.update(delta, ship.group);
  if (sinking.finished && state.phase === GamePhase.Sinking) {
    state.set_phase(GamePhase.GameOver);
  }

  director.update(delta, elapsed, camera, physics, ship.group.position.y, state.phase, sink_progress);

  input.end_frame();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
