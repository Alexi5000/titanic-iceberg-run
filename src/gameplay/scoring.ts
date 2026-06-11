// file: src/gameplay/scoring.ts
// description: Run scoring - distance score accrual, near-miss bonuses with a streak multiplier, and nautical mile conversion
// reference: src/main.ts, src/core/game_state.ts, src/gameplay/missions.ts

import { GameState } from '../core/game_state';
import { ShipPhysics } from '../ship/ship_physics';

/** World units per (arcade) nautical mile. */
export const UNITS_PER_NAUTICAL_MILE = 600;
const NEAR_MISS_BONUS = 250;
const DISTANCE_SCORE_RATE = 0.14; // points per world unit travelled

export class Scoring {
  multiplier = 1;

  constructor(state: GameState) {
    state.on('near_miss', () => {
      state.score += NEAR_MISS_BONUS * this.multiplier;
      this.multiplier = Math.min(this.multiplier + 0.5, 5);
    });
    state.on('graze', () => {
      this.multiplier = 1;
    });
  }

  update(delta: number, state: GameState, physics: ShipPhysics): void {
    state.score += Math.max(physics.speed, 0) * delta * DISTANCE_SCORE_RATE * this.multiplier;
  }

  reset(): void {
    this.multiplier = 1;
  }
}

export function nautical_miles(distance_units: number): number {
  return distance_units / UNITS_PER_NAUTICAL_MILE;
}
