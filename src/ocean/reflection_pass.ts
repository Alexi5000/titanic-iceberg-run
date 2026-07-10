// file: src/ocean/reflection_pass.ts
// description: Scheduled planar reflection capture for the Gerstner ocean without a second post-processing pipeline.
// reference: src/ocean/ocean_surface.ts, src/ocean/water_material.ts

import * as THREE from 'three';
import { OceanQualityPreset } from './wave_spectrum';

/** Structural type keeps the ocean independent from the optional performance-overlay module. */
export interface ReflectionPassTimer {
  begin_reflection(): boolean;
  end_reflection(): void;
}

/**
 * Captures the scene from a camera mirrored around the mean sea level. The water
 * mesh is hidden only for the offscreen render, preventing recursive sampling.
 * This is intentionally a bounded, cadence-controlled pass rather than SSR: it
 * works on all visible geometry and degrades by lowering target scale/frequency.
 */
export class ReflectionPass {
  readonly reflection_matrix = new THREE.Matrix4();
  readonly render_target: THREE.WebGLRenderTarget;

  private readonly virtual_camera = new THREE.PerspectiveCamera();
  private readonly source_direction = new THREE.Vector3();
  private readonly source_target = new THREE.Vector3();
  private readonly drawing_buffer_size = new THREE.Vector2();
  private enabled = false;
  private scale = 0;
  private update_interval = 0;
  private frame_index = 0;
  private target_width = 1;
  private target_height = 1;
  private has_capture = false;

  constructor() {
    this.render_target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
    });
    this.render_target.texture.name = 'OceanPlanarReflection';
    this.render_target.texture.generateMipmaps = false;
    this.render_target.texture.minFilter = THREE.LinearFilter;
    this.render_target.texture.magFilter = THREE.LinearFilter;
  }

  set_quality(quality: OceanQualityPreset): void {
    this.set_settings(quality.reflection_scale, quality.reflection_update_interval);
  }

  /** Debug/UI override hook. A lower cadence amortizes the reflection cost safely. */
  set_settings(scale: number, update_interval: number): void {
    this.scale = THREE.MathUtils.clamp(scale, 0, 1);
    this.update_interval = Math.max(0, Math.floor(update_interval));
    this.enabled = this.scale > 0 && this.update_interval > 0;
    this.frame_index = 0;
    this.has_capture = false;
  }

  get is_enabled(): boolean {
    return this.enabled;
  }

  get has_valid_capture(): boolean {
    return this.has_capture;
  }

  /**
   * Invoke immediately before the main render, after the gameplay camera has
   * settled. Returning false means the previous target remains valid this frame.
   */
  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    source_camera: THREE.PerspectiveCamera,
    water_mesh: THREE.Object3D,
    timer: ReflectionPassTimer | null = null,
  ): boolean {
    if (!this.enabled) return false;
    this.frame_index += 1;
    if (this.frame_index % this.update_interval !== 0) return false;

    renderer.getDrawingBufferSize(this.drawing_buffer_size);
    const width = Math.max(1, Math.round(this.drawing_buffer_size.x * this.scale));
    const height = Math.max(1, Math.round(this.drawing_buffer_size.y * this.scale));
    if (width !== this.target_width || height !== this.target_height) {
      this.target_width = width;
      this.target_height = height;
      this.render_target.setSize(width, height);
    }

    this.copy_reflected_camera(source_camera);

    const previous_target = renderer.getRenderTarget();
    const previous_auto_clear = renderer.autoClear;
    const previous_visibility = water_mesh.visible;
    water_mesh.visible = false;
    const timed = timer?.begin_reflection() ?? false;

    try {
      renderer.autoClear = true;
      renderer.setRenderTarget(this.render_target);
      renderer.clear();
      renderer.render(scene, this.virtual_camera);
    } finally {
      if (timed) timer?.end_reflection();
      water_mesh.visible = previous_visibility;
      renderer.setRenderTarget(previous_target);
      renderer.autoClear = previous_auto_clear;
    }

    this.reflection_matrix.multiplyMatrices(
      this.virtual_camera.projectionMatrix,
      this.virtual_camera.matrixWorldInverse,
    );
    this.has_capture = true;
    return true;
  }

  private copy_reflected_camera(source: THREE.PerspectiveCamera): void {
    source.updateMatrixWorld();
    source.getWorldDirection(this.source_direction);
    this.source_target.copy(source.position).add(this.source_direction);

    this.virtual_camera.fov = source.fov;
    this.virtual_camera.aspect = source.aspect;
    this.virtual_camera.near = source.near;
    this.virtual_camera.far = source.far;
    this.virtual_camera.zoom = source.zoom;
    this.virtual_camera.filmGauge = source.filmGauge;
    this.virtual_camera.filmOffset = source.filmOffset;
    this.virtual_camera.layers.mask = source.layers.mask;
    this.virtual_camera.position.set(source.position.x, -source.position.y, source.position.z);
    this.source_target.y *= -1;
    // Mirroring the up vector preserves the correct reflected orientation.
    this.virtual_camera.up.set(source.up.x, -source.up.y, source.up.z);
    this.virtual_camera.lookAt(this.source_target);
    this.virtual_camera.updateProjectionMatrix();
    this.virtual_camera.updateMatrixWorld();
    this.virtual_camera.matrixWorldInverse.copy(this.virtual_camera.matrixWorld).invert();
  }

  dispose(): void {
    this.render_target.dispose();
  }
}
