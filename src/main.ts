// file: src/main.ts
// description: Application entry point - renderer setup, world composition, and the requestAnimationFrame game loop
// reference: src/world/ocean.ts, src/world/sky.ts, GAME_PLAN.md

import * as THREE from 'three';
import { Ocean } from './world/ocean';
import { Sky } from './world/sky';
import { load_palette, save_palette, next_palette, Palette } from './world/palette';
import { TitanicShip } from './ship/titanic_model';
import { ShipPhysics, TelegraphOrder } from './ship/ship_physics';
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
import { PostProcessing } from './core/post_processing';
import { JuiceSystem } from './gameplay/juice';
import { WakeEffects } from './ship/wake_effects';
import { Flotsam } from './world/flotsam';
import { CardDetector, CardDef, CardContext } from './gameplay/cards';

import { CardCollection, EarnedCard } from './gameplay/card_collection';
import { CardGallery, build_reveal_block } from './ui/card_ui';
import { card_art_for } from './ui/card_art';
import { CameraMode } from './camera/camera_director';
import { Onboarding } from './core/onboarding';
import { SkinSystem } from './gameplay/skins';
import { TouchControls, is_touch_device } from './ui/touch_controls';
import { DailySystem, seeded_rng, today_string } from './gameplay/daily';
import { RecordsBoard } from './gameplay/records';
import { RecordsOverlay, celebrate_confetti } from './ui/records_ui';
import { CARD_DEFS } from './gameplay/cards';

let palette: Palette = load_palette();

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  preserveDrawingBuffer: true, // needed for freeze-frame card art capture
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(palette.fog_color, palette.fog_density_base);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 8000);
camera.position.set(120, 60, -200);
camera.lookAt(0, 15, 0);

let sky = new Sky(palette);
scene.add(sky.group);

const ocean = new Ocean(palette, sky.moon_dir);
scene.add(ocean.mesh);

function apply_palette(next: Palette): void {
  palette = next;
  save_palette(palette);
  scene.remove(sky.group);
  sky = new Sky(palette);
  scene.add(sky.group);
  ocean.set_palette(palette);
  field.set_palette(palette);
  flotsam.set_palette(palette);
  (scene.fog as THREE.FogExp2).color.setHex(palette.fog_color);
  (scene.fog as THREE.FogExp2).density = palette.fog_density_base;
}

const ship = new TitanicShip();
scene.add(ship.group);

const physics = new ShipPhysics();
const input = new InputManager();

const state = new GameState();
const field = new IcebergField();
field.set_palette(palette);
scene.add(field.group);
const collision = new CollisionSystem();

const director = new CameraDirector();
const sinking = new SinkingSequence();
const juice = new JuiceSystem();

const wake = new WakeEffects();
scene.add(wake.group);

const flotsam = new Flotsam();
flotsam.set_palette(palette);
flotsam.scatter(0, 0);
scene.add(flotsam.group);

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
  on_mission_complete_for_cards();
}, rewards.career_near_misses);

/** Indirection because the card detector is constructed after the mission tracker. */
let on_mission_complete_for_cards: () => void = () => undefined;
missions.attach(state);

const scoring = new Scoring(state);

let skins: SkinSystem | undefined;

function apply_unlocks(): void {
  ship.set_searchlight(rewards.is_unlocked('searchlight'));
  ship.apply_skin(skins ? skins.equipped : null, rewards.is_unlocked('golden_funnels'));
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

// ---------- Collectible cards ----------
const collection = new CardCollection();
skins = new SkinSystem(collection);
const gallery = new CardGallery(document.body, collection, skins);
gallery.on_skin_change = apply_unlocks;
apply_unlocks();
let run_new_cards: { def: CardDef; earned: EarnedCard }[] = [];
let current_fog_density = palette.fog_density_base;

const detector = new CardDetector(
  (def) => {
    const art = card_art_for(def, renderer.domElement);
    const earned = collection.add(def, physics.distance_travelled, state.score, art);
    if (!earned) return;
    run_new_cards.push({ def, earned });
    toast_queue.push({ title: `CARD EARNED: ${def.title}`, body: def.flavor });
    audio.card_sting(def.rarity);
    if (def.rarity === 'legendary') juice.trigger_near_miss();
  },
  (id) => collection.is_owned(id),
);

function card_context(): CardContext {
  return {
    run_time: state.run_time,
    distance: physics.distance_travelled,
    hull: state.hull,
    speed: physics.speed,
    rudder: physics.rudder,
    telegraph_is_full_ahead: physics.telegraph === TelegraphOrder.FullAhead,
    near_misses_run: state.near_misses,
    grazes_run: state.grazes,
    palette_id: palette.id,
    fog_density: current_fog_density,
    base_fog_density: palette.fog_density_base,
    bridge_cam_active: director.mode === CameraMode.Bridge,
    searchlight_unlocked: rewards.is_unlocked('searchlight'),
    golden_funnels_unlocked: rewards.is_unlocked('golden_funnels'),
    missions_complete_run: missions.missions.filter((m) => m.complete).length,
    career_runs: collection.career_runs,
    career_distance: collection.career_distance,
    career_near_misses: missions.get_near_miss_career_total(),
    cards_owned: collection.owned_count,
  };
}

const daily = new DailySystem();
let game_mode: 'endless' | 'daily' = 'endless';
const records = new RecordsBoard();
const records_overlay = new RecordsOverlay(document.body, records);

const gallery_button = document.createElement('button');
gallery_button.className = 'menu-button';
gallery_button.addEventListener('click', () => gallery.open());

const daily_button = document.createElement('button');
daily_button.className = 'menu-button';
daily_button.style.marginLeft = '10px';
daily_button.addEventListener('click', () => start_run('daily'));

const records_button = document.createElement('button');
records_button.className = 'menu-button';
records_button.style.marginLeft = '10px';
records_button.textContent = 'Records  [R]';
records_button.addEventListener('click', () => records_overlay.open());
menus.title_extra.append(gallery_button, daily_button, records_button);

function refresh_gallery_button(): void {
  gallery_button.textContent = `Cards ${collection.owned_count}/${CARD_DEFS.length}  [G]`;
  const streak = daily.streak;
  daily_button.textContent = daily.played_today()
    ? `Daily done - streak ${streak}  [D: practice]`
    : `Daily Voyage${streak > 0 ? ` - streak ${streak}` : ''}  [D]`;
}
refresh_gallery_button();

on_mission_complete_for_cards = () => detector.on_mission_complete(card_context());

const onboarding = new Onboarding(document.body);

// ---------- Touch controls + auto quality-down ----------
const touch_active = is_touch_device();
const touch = new TouchControls(document.body);
touch.bind(
  (order) => physics.set_telegraph(order),
  () => director.cycle_gameplay_view(),
);


function start_run(mode: 'endless' | 'daily' = 'endless'): void {
  game_mode = mode;
  audio.init();
  audio.horn();
  physics.reset();
  state.reset_run();
  missions.reset_run();
  scoring.reset();
  collision.reset();
  juice.reset();
  sinking.reset(ship.group);
  field.set_rng(mode === 'daily' ? seeded_rng(today_string()) : Math.random);
  field.seed_initial(physics.x, physics.z, physics.heading);
  flotsam.scatter(physics.x, physics.z);
  detector.reset_run();
  run_new_cards = [];
  menus.gameover_extra.replaceChildren();
  gallery.close();
  run_finalized = false;
  menus.hide_all();
  hud.set_visible(true);
  state.set_phase(GamePhase.Playing);
  if (touch_active) {
    touch.set_visible(true);
    touch.sync_telegraph(physics.telegraph);
  }
  if (Onboarding.needed()) onboarding.begin();
}

state.on('graze', () => {
  audio.collision_crunch(false);
  juice.trigger_graze();
  detector.on_graze(card_context());
});
state.on('near_miss', () => {
  juice.trigger_near_miss();
  detector.on_near_miss(card_context(), collision.last_near_miss_radius);
  onboarding.on_near_miss();
});
state.on('fatal', () => {
  sinking.begin();
  audio.collision_crunch(true);
  audio.horn();
  juice.trigger_fatal();
});
state.on('phase_change', () => {
  if (state.phase === GamePhase.GameOver) {
    detector.on_run_end(card_context());
    collection.record_run(physics.distance_travelled);
    let daily_note = '';
    if (game_mode === 'daily') {
      const streak = daily.record_scored_run(state.score);
      if (streak !== null) {
        daily_note = `DAILY VOYAGE LOGGED - streak ${streak} day${streak === 1 ? '' : 's'}`;
        detector.on_daily_scored(streak);
      } else {
        daily_note = 'PRACTICE RUN - today\'s daily was already scored';
      }
    }
    const rank = records.submit(game_mode, {
      score: Math.round(state.score),
      distance: Math.round(physics.distance_travelled),
      near_misses: state.near_misses,
      run_time: state.run_time,
      cards_earned: run_new_cards.length,
      date: new Date().toISOString(),
    });

    finalize_run();
    hud.set_visible(false);
    menus.show_game_over(state, physics, rewards);
    menus.gameover_extra.replaceChildren(build_reveal_block(run_new_cards));

    if (rank === 0 && state.score > 100) {
      const best = document.createElement('div');
      best.className = 'gameover-cards-label';
      best.textContent = 'NEW BEST CROSSING';
      menus.gameover_extra.prepend(best);
      if (!juice.reduced_motion) celebrate_confetti(document.body);
      audio.horn();
      audio.card_sting('legendary');
    }
    if (daily_note) {
      const note = document.createElement('div');
      note.className = 'gameover-cards-label';
      note.textContent = daily_note;
      menus.gameover_extra.prepend(note);
    }
    refresh_gallery_button();
  }
});

hud.set_visible(false);
menus.show_title(rewards);
field.seed_initial(physics.x, physics.z, physics.heading);
juice.begin_intro();

const post = new PostProcessing(renderer, scene, camera);

if (touch_active) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  try {
    // Default mobile to low quality unless the player explicitly chose otherwise.
    if (localStorage.getItem('tir.quality.v1') === null) post.set_quality(false);
  } catch {
    post.set_quality(false);
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.set_size(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
let elapsed = 0;

/** Mouse fallback so the run can start without keyboard focus. */
let click_to_start = false;
window.addEventListener('pointerdown', () => {
  click_to_start = true;
});

function frame(): void {
  const raw_delta = Math.min(clock.getDelta(), 0.1);
  juice.update(raw_delta);
  const delta = raw_delta * juice.time_scale;
  elapsed += delta;

  if (state.phase === GamePhase.Title || state.phase === GamePhase.GameOver) {
    if (input.was_pressed('KeyG')) {
      if (gallery.is_open) gallery.close();
      else gallery.open();
    }
    if (input.was_pressed('KeyR')) {
      if (records_overlay.is_open) records_overlay.close();
      else records_overlay.open();
    }
    if (input.was_pressed('Escape')) {
      if (gallery.is_open) gallery.close();
      if (records_overlay.is_open) records_overlay.close();
    }
    const overlay_open = gallery.is_open || records_overlay.is_open;
    if (input.was_pressed('KeyD') && !overlay_open) start_run('daily');
    else if ((input.was_pressed('Enter') || click_to_start) && !overlay_open) start_run();
  }
  click_to_start = false;

  if (input.was_pressed('KeyP')) apply_palette(next_palette(palette));
  if (input.was_pressed('KeyQ')) post.toggle();
  if (input.was_pressed('KeyM')) juice.toggle_reduced_motion();

  if (state.phase === GamePhase.Playing) {
    physics.read_input(input);
    physics.touch_rudder = touch_active ? touch.rudder_value : null;
    if (touch_active) touch.sync_telegraph(physics.telegraph);
    state.run_time += delta;

    if (input.was_pressed('KeyV')) director.cycle_gameplay_view();
    if (input.was_pressed('KeyC')) director.toggle_cinematic();

    scoring.update(delta, state, physics);
    missions.update(delta, state, physics);
    detector.update(delta, card_context());

    onboarding.update(delta, physics, state, input.was_pressed('KeyX'));

    const difficulty = compute_difficulty(physics.distance_travelled, palette.fog_density_base);
    const cap = onboarding.density_cap;
    field.density = cap !== null ? Math.min(difficulty.iceberg_density, cap) : difficulty.iceberg_density;
    current_fog_density = difficulty.fog_density;
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
  const collision_result = collision.update(delta, physics, field, state);
  if (collision_result.hit && collision_result.berg) {
    wake.burst_shards(
      collision_result.berg.mesh.position.x,
      collision_result.berg.mesh.position.z,
      collision_result.fatal,
    );
  }

  wake.update(delta, elapsed, physics.x, physics.z, physics.heading, physics.speed);
  flotsam.update(delta, elapsed, physics.x, physics.z, physics.heading, physics.speed);

  ship.group.position.x = physics.x;
  ship.group.position.z = physics.z;
  ship.group.rotation.y = physics.heading;

  sky.update(elapsed);
  ocean.update(elapsed, camera, physics.x, physics.z);
  ship.update(elapsed, delta, physics.turn_heel);
  ship.group.position.y += juice.intro_offset_y;

  const sink_progress = sinking.update(delta, ship.group);
  if (sinking.finished && state.phase === GamePhase.Sinking) {
    state.set_phase(GamePhase.GameOver);
    touch.set_visible(false);
  }

  director.update(raw_delta, elapsed, camera, physics, ship.group.position.y, state.phase, sink_progress);

  // Juice: FOV punch, camera shake, slow-mo pulse on post and audio.
  const target_fov = 60 + juice.fov_offset;
  if (Math.abs(camera.fov - target_fov) > 0.01) {
    camera.fov = target_fov;
    camera.updateProjectionMatrix();
  }
  if (juice.shake_magnitude > 0) {
    const shake = juice.shake_offset();
    camera.position.x += shake.x;
    camera.position.y += shake.y;
    camera.position.z += shake.z;
  }
  post.set_pulse(juice.pulse);
  audio.set_slowmo(juice.pulse);

  while (toast_queue.length > 0) {
    const toast = toast_queue.shift();
    if (toast) hud.show_toast(toast);
  }

  if (state.phase === GamePhase.Playing || state.phase === GamePhase.Sinking) {
    hud.update(state, physics, missions, scoring);
  }

  input.end_frame();

  post.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
