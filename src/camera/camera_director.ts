// file: src/camera/camera_director.ts
// description: Camera director - chase and bridge gameplay views, cycling cinematic shots, title orbit, and sinking sequence camera
// reference: src/main.ts, src/ship/ship_physics.ts, src/core/game_state.ts

import * as THREE from 'three';
import { ShipPhysics } from '../ship/ship_physics';
import { GamePhase } from '../core/game_state';

export enum CameraMode {
  Chase = 'chase',
  Bridge = 'bridge',
  Cinematic = 'cinematic',
}

const CINEMATIC_SHOT_DURATION = 9;
const CINEMATIC_SHOT_COUNT = 3;

export class CameraDirector {
  mode: CameraMode = CameraMode.Chase;

  private readonly desired_position = new THREE.Vector3();
  private readonly desired_target = new THREE.Vector3();
  private readonly current_target = new THREE.Vector3(0, 14, 0);
  private cinematic_clock = 0;
  private cinematic_shot = 0;
  private snap_next = true;

  cycle_gameplay_view(): void {
    this.mode = this.mode === CameraMode.Chase ? CameraMode.Bridge : CameraMode.Chase;
    this.snap_next = this.mode === CameraMode.Bridge;
  }

  toggle_cinematic(): void {
    if (this.mode === CameraMode.Cinematic) {
      this.mode = CameraMode.Chase;
    } else {
      this.mode = CameraMode.Cinematic;
      this.cinematic_clock = 0;
      this.cinematic_shot = 0;
    }
  }

  update(
    delta: number,
    elapsed: number,
    camera: THREE.PerspectiveCamera,
    physics: ShipPhysics,
    ship_y: number,
    phase: GamePhase,
    sink_progress: number,
  ): void {
    const fwd_x = Math.sin(physics.heading);
    const fwd_z = Math.cos(physics.heading);
    const right_x = Math.cos(physics.heading);
    const right_z = -Math.sin(physics.heading);

    let smoothing = 2.5;

    if (phase === GamePhase.Title) {
      // Slow hero orbit around the anchored ship.
      const angle = elapsed * 0.07;
      this.desired_position.set(
        physics.x + Math.sin(angle) * 380,
        58 + Math.sin(elapsed * 0.18) * 14,
        physics.z + Math.cos(angle) * 380,
      );
      this.desired_target.set(physics.x, 18, physics.z);
      smoothing = 1.6;
    } else if (phase === GamePhase.Sinking || phase === GamePhase.GameOver) {
      // Pull back and slowly circle the stricken liner.
      const angle = elapsed * 0.05 + 1.2;
      const dist = 300 + sink_progress * 160;
      this.desired_position.set(
        physics.x + Math.sin(angle) * dist,
        46 + sink_progress * 30,
        physics.z + Math.cos(angle) * dist,
      );
      this.desired_target.set(physics.x, Math.max(ship_y + 16, 0), physics.z);
      smoothing = 1.2;
    } else if (this.mode === CameraMode.Bridge) {
      // First person from the navigating bridge, slightly above the wheelhouse.
      this.desired_position.set(
        physics.x + fwd_x * 58 + right_x * 0,
        ship_y + 40,
        physics.z + fwd_z * 58 + right_z * 0,
      );
      this.desired_target.set(
        physics.x + fwd_x * 600,
        ship_y + 18,
        physics.z + fwd_z * 600,
      );
      smoothing = this.snap_next ? 1000 : 14;
      this.snap_next = false;
    } else if (this.mode === CameraMode.Cinematic) {
      this.cinematic_clock += delta;
      if (this.cinematic_clock >= CINEMATIC_SHOT_DURATION) {
        this.cinematic_clock = 0;
        this.cinematic_shot = (this.cinematic_shot + 1) % CINEMATIC_SHOT_COUNT;
      }
      const t = this.cinematic_clock / CINEMATIC_SHOT_DURATION;

      if (this.cinematic_shot === 0) {
        // Slow orbit.
        const angle = elapsed * 0.12;
        this.desired_position.set(
          physics.x + Math.sin(angle) * 330,
          70 + Math.sin(elapsed * 0.3) * 10,
          physics.z + Math.cos(angle) * 330,
        );
        this.desired_target.set(physics.x, 20, physics.z);
      } else if (this.cinematic_shot === 1) {
        // Low water-level shot leading the bow, drifting alongside.
        const side = this.cinematic_shot % 2 === 0 ? 1 : -1;
        this.desired_position.set(
          physics.x + fwd_x * (220 - t * 120) + right_x * side * 120,
          8 + t * 6,
          physics.z + fwd_z * (220 - t * 120) + right_z * side * 120,
        );
        this.desired_target.set(physics.x + fwd_x * 80, 22, physics.z + fwd_z * 80);
      } else {
        // High stern fly-over looking forward past the funnels.
        this.desired_position.set(
          physics.x - fwd_x * (260 - t * 140),
          120 - t * 40,
          physics.z - fwd_z * (260 - t * 140),
        );
        this.desired_target.set(physics.x + fwd_x * 200, 26, physics.z + fwd_z * 200);
      }
      smoothing = 2.0;
    } else {
      // Chase camera: behind and above, leaning into the turn.
      const lead = physics.rudder * -140;
      this.desired_position.set(
        physics.x - fwd_x * 230 + right_x * lead,
        72,
        physics.z - fwd_z * 230 + right_z * lead,
      );
      this.desired_target.set(physics.x + fwd_x * 60, 16, physics.z + fwd_z * 60);
      smoothing = 2.8;
    }

    const alpha = 1 - Math.exp(-smoothing * delta);
    camera.position.lerp(this.desired_position, Math.min(alpha, 1));
    this.current_target.lerp(this.desired_target, Math.min(alpha * 1.4, 1));
    camera.lookAt(this.current_target);
  }
}
