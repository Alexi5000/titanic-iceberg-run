// file: src/world/toon_shading.ts
// description: Stylized gradient-ramp (toon) shading helpers - shared gradient map and material factory for the Bruno-style flat look
// reference: src/ship/titanic_model.ts, src/world/iceberg_field.ts, src/world/palette.ts

import * as THREE from 'three';

let gradient_map: THREE.DataTexture | null = null;

/** Shared 5-step gradient ramp used by all toon materials. */
export function get_gradient_map(): THREE.DataTexture {
  if (gradient_map) return gradient_map;
  const steps = new Uint8Array([70, 110, 165, 215, 255]);
  gradient_map = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  gradient_map.minFilter = THREE.NearestFilter;
  gradient_map.magFilter = THREE.NearestFilter;
  gradient_map.needsUpdate = true;
  return gradient_map;
}

export interface ToonOptions {
  color: number;
  emissive?: number;
  emissive_intensity?: number;
}

export function make_toon_material(options: ToonOptions): THREE.MeshToonMaterial {
  const material = new THREE.MeshToonMaterial({
    color: options.color,
    gradientMap: get_gradient_map(),
  });
  if (options.emissive !== undefined) {
    material.emissive = new THREE.Color(options.emissive);
    material.emissiveIntensity = options.emissive_intensity ?? 1;
  }
  return material;
}
