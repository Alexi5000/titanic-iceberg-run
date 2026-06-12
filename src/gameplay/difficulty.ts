// file: src/gameplay/difficulty.ts
// description: Difficulty ramp - iceberg density waves and thickening fog as the crossing progresses
// reference: src/main.ts, src/world/iceberg_field.ts, src/gameplay/scoring.ts

import { nautical_miles } from './scoring';

const FOG_RAMP = 0.0011;

export interface DifficultyOutput {
  iceberg_density: number;
  fog_density: number;
}

/**
 * Difficulty grows with distance and arrives in waves - dense pack ice
 * alternates with brief stretches of open water.
 */
export function compute_difficulty(distance_units: number, base_fog_density: number): DifficultyOutput {
  const nm = nautical_miles(distance_units);

  const ramp = Math.min(1 + nm * 0.32, 3.2);
  const wave = 1 + Math.sin(nm * 1.7) * 0.45;
  const iceberg_density = Math.max(ramp * wave, 0.6);

  const fog_t = Math.min(nm / 10, 1);
  const fog_density = base_fog_density + FOG_RAMP * fog_t;

  return { iceberg_density, fog_density };
}
