// file: src/ship/collision.ts
// description: Ship-vs-iceberg collision detection - capsule of spheres along the hull, graze vs fatal classification, near-miss detection
// reference: src/main.ts, src/world/iceberg_field.ts, src/core/game_state.ts

import { IcebergField, Iceberg } from '../world/iceberg_field';
import { ShipPhysics } from './ship_physics';
import { GameState, GamePhase } from '../core/game_state';
import { SHIP_LENGTH, SHIP_BEAM } from './titanic_model';

const HULL_SAMPLE_OFFSETS = [-0.42, -0.21, 0, 0.21, 0.42]; // fractions of ship length along the keel
const HULL_SPHERE_RADIUS = SHIP_BEAM * 0.75;
const NEAR_MISS_DISTANCE = 70;
const FATAL_SPEED = 26; // hitting faster than this with the bow is catastrophic
const GRAZE_BASE_DAMAGE = 14;
const COLLISION_COOLDOWN = 1.2;

export interface CollisionResult {
  hit: boolean;
  fatal: boolean;
  berg: Iceberg | null;
}

export class CollisionSystem {
  private cooldown = 0;
  /** Radius of the berg involved in the most recent near miss (for card triggers). */
  last_near_miss_radius = 0;

  update(
    delta: number,
    physics: ShipPhysics,
    field: IcebergField,
    state: GameState,
  ): CollisionResult {
    this.cooldown = Math.max(0, this.cooldown - delta);
    const result: CollisionResult = { hit: false, fatal: false, berg: null };
    if (state.phase !== GamePhase.Playing) return result;

    const fwd_x = Math.sin(physics.heading);
    const fwd_z = Math.cos(physics.heading);

    for (const berg of field.bergs) {
      if (!berg.active) continue;

      const bx = berg.mesh.position.x;
      const bz = berg.mesh.position.z;

      // Near-miss bookkeeping uses center distance.
      const center_dx = bx - physics.x;
      const center_dz = bz - physics.z;
      const center_dist = Math.hypot(center_dx, center_dz) - berg.radius;

      let min_dist = Infinity;
      let closest_offset = 0;
      for (const offset of HULL_SAMPLE_OFFSETS) {
        const sx = physics.x + fwd_x * offset * SHIP_LENGTH;
        const sz = physics.z + fwd_z * offset * SHIP_LENGTH;
        const d = Math.hypot(bx - sx, bz - sz) - berg.radius - HULL_SPHERE_RADIUS;
        if (d < min_dist) {
          min_dist = d;
          closest_offset = offset;
        }
      }

      if (min_dist <= 0 && this.cooldown <= 0) {
        const bow_hit = closest_offset > 0.3;
        const fatal = bow_hit && Math.abs(physics.speed) >= FATAL_SPEED;

        result.hit = true;
        result.berg = berg;

        if (fatal) {
          result.fatal = true;
          state.apply_fatal();
          return result;
        }

        const speed_scale = Math.max(Math.abs(physics.speed) / 38, 0.25);
        state.apply_graze(GRAZE_BASE_DAMAGE * (bow_hit ? 1.6 : 1.0) * speed_scale + 6);

        // Scrubbing ice bleeds speed and shoves the bow away.
        physics.speed *= 0.55;
        const push = Math.sign(
          (bx - physics.x) * fwd_z - (bz - physics.z) * fwd_x,
        );
        physics.heading += push * 0.035;

        this.cooldown = COLLISION_COOLDOWN;
        berg.near_miss_armed = false;
        return result;
      }

      // Near miss: passed close alongside without touching, while moving fast.
      if (
        berg.near_miss_armed &&
        center_dist < NEAR_MISS_DISTANCE &&
        physics.speed > 16
      ) {
        const along = center_dx * fwd_x + center_dz * fwd_z;
        if (along < 0) {
          berg.near_miss_armed = false;
          this.last_near_miss_radius = berg.radius;
          state.register_near_miss();
        }
      }
    }

    return result;
  }

  reset(): void {
    this.cooldown = 0;
  }
}
