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
import { Scoring } from './gameplay/scoring';
import { MissionTracker } from './gameplay/missions';
import { RewardSystem } from './gameplay/rewards';
import { Hud, ToastMessage } from './ui/hud';
import { Menus } from './ui/menus';
import { compute_difficulty } from './gameplay/difficulty';
import { AudioManager } from './core/audio_manager';

const FOG_COLOR = new THREE.Color(0x060d18);
const FOG_DENSITY = 0.0016;

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
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

/** Notification queue drained into the HUD each frame. */
const toast_queue: ToastMessage[] = [];

const rewards = new RewardSystem((unlock) => {
  toast_queue.push({ title: `UNLOCKED: ${unlock.title}`, body: unlock.description });
  apply_unlocks();
});

const missions = new MissionTracker((mission) => {
  toast_queue.push({ title: `MISSION COMPLETE: ${mission.title}`, body: `+${mission.reward_points} pts` });
  state.score += mission.reward_points;
  rewards.add_points(mission.reward_points);
  audio.chime();
}, rewards.career_near_misses);
missions.attach(state);

const scoring = new Scoring(state);

function apply_unlocks(): void {
  ship.set_searchlight(rewards.is_unlocked('searchlight'));
  ship.set_golden_funnels(rewards.is_unlocked('golden_funnels'));
}
apply_unlocks();

let run_finalized = false;
function finalize_run(): void {
  if (run_finalized) return;
  run_finalized = true;
  rewards.record_near_misses(missions.get_near_miss_career_total());
  rewards.add_points(state.score * 0.1);
  const is_best = rewards.submit_score(state.score);
  if (is_best) toast_queue.push({ title: 'NEW BEST SCORE', body: `${Math.round(state.score)} points` });
}

const hud = new Hud(document.body, state);
const menus = new Menus(document.body);
const audio = new AudioManager();

function start_run(): void {
  audio.init();
  audio.horn();
  physics.reset();
  state.reset_run();
  missions.reset_run();
  scoring.reset();
  collision.reset();
  sinking.reset(ship.group);
  field.seed_initial(physics.x, physics.z, physics.heading);
  run_finalized = false;
  menus.hide_all();
  hud.set_visible(true);
  state.set_phase(GamePhase.Playing);
}

state.on('graze', () => audio.collision_crunch(false));
state.on('fatal', () => {
  sinking.begin();
  audio.collision_crunch(true);
  audio.horn();
});
state.on('phase_change', () => {
  if (state.phase === GamePhase.GameOver) {
    finalize_run();
    hud.set_visible(false);
    menus.show_game_over(state, physics, rewards);
  }
});

hud.set_visible(false);
menus.show_title(rewards);
field.seed_initial(physics.x, physics.z, physics.heading);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let elapsed = 0;

/** Mouse fallback so the run can start without keyboard focus. */
let click_to_start = false;
window.addEventListener('pointerdown', () => {
  click_to_start = true;
});

function frame(): void {
  const delta = Math.min(clock.getDelta(), 0.1);
  elapsed += delta;

  if (state.phase === GamePhase.Title || state.phase === GamePhase.GameOver) {
    if (input.was_pressed('Enter') || click_to_start) start_run();
  }
  click_to_start = false;

  if (state.phase === GamePhase.Playing) {
    physics.read_input(input);
    state.run_time += delta;

    if (input.was_pressed('KeyV')) director.cycle_gameplay_view();
    if (input.was_pressed('KeyC')) director.toggle_cinematic();

    scoring.update(delta, state, physics);
    missions.update(delta, state, physics);

    const difficulty = compute_difficulty(physics.distance_travelled);
    field.density = difficulty.iceberg_density;
    (scene.fog as THREE.FogExp2).density = difficulty.fog_density;
    ocean.set_fog_density(difficulty.fog_density);
  }

  audio.update_engine(physics.speed);

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

  while (toast_queue.length > 0) {
    const toast = toast_queue.shift();
    if (toast) hud.show_toast(toast);
  }

  if (state.phase === GamePhase.Playing || state.phase === GamePhase.Sinking) {
    hud.update(state, physics, missions, scoring);
  }

  input.end_frame();

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
