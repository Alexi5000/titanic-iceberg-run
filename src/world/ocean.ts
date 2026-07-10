// file: src/world/ocean.ts
// description: Backward-compatible game-facing ocean facade.
// reference: src/ocean/ocean_surface.ts

import * as THREE from 'three';
import { Palette } from './palette';
import {
  create_ocean_sample,
  OceanSurface,
  sample_ocean_surface,
  wave_height,
} from '../ocean/ocean_surface';

export { create_ocean_sample, sample_ocean_surface, wave_height };

/**
 * `Ocean` preserves the original game API while the reusable implementation
 * lives under `src/ocean/`. Existing gameplay callers can keep using wave_height.
 */
export class Ocean extends OceanSurface {
  constructor(palette: Palette, light_direction: THREE.Vector3) {
    super(palette, light_direction);
  }
}
