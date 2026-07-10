// file: src/ocean/ocean_surface.ts
// description: Camera-centered ocean surface facade joining Gerstner sampling, water shading, reflection capture, and interaction foam.
// reference: src/world/ocean.ts, src/ocean/water_material.ts, src/ocean/reflection_pass.ts

import * as THREE from 'three';
import { Palette } from '../world/palette';
import { ReflectionPass, ReflectionPassTimer } from './reflection_pass';
import {
  create_north_atlantic_wave_spectrum,
  create_ocean_sample,
  OceanQualityId,
  OceanQualityPreset,
  OceanSample,
  OceanWeatherId,
  OceanWeatherPreset,
  OCEAN_QUALITY_PRESETS,
  OCEAN_WEATHER_PRESETS,
  WaveSpectrum,
} from './wave_spectrum';
import { OceanInteractionSource, WaterMaterial } from './water_material';

const OCEAN_SIZE = 3000;
const FOLLOW_SNAP = 24;

/** Structural timer type avoids a hard dependency on development-only overlay code. */
export interface OceanDrawTimer {
  begin_ocean(): boolean;
  end_ocean(): void;
}

export interface OceanGpuTimer extends OceanDrawTimer, ReflectionPassTimer {}

/** Runtime-safe controls exposed by the optional ocean debug panel. */
export interface OceanTuning {
  /** Additional rotation relative to the selected weather preset's swell direction. */
  wind_direction_offset_radians: number;
  /** Multiplies the selected preset's Gerstner amplitudes. */
  wave_amplitude_multiplier: number;
  /** Multiplies phase velocity without changing authored wavelengths. */
  wave_speed_multiplier: number;
  /** Multiplies crest, ship, and iceberg foam. */
  foam_multiplier: number;
  /** Visual storminess for micro-normal roughness and reflection breakup. */
  storm_intensity: number;
}

let active_spectrum = create_north_atlantic_wave_spectrum(
  OCEAN_QUALITY_PRESETS.high,
  OCEAN_WEATHER_PRESETS.moonlit_night,
);

/** CPU mirror used by ship buoyancy, iceberg placement, flotsam, and particles. */
export function wave_height(x: number, z: number, time: number): number {
  return active_spectrum.sample_height(x, z, time);
}

/** Allocate `out` once with `create_ocean_sample`, then reuse it for detailed buoyancy queries. */
export function sample_ocean_surface(x: number, z: number, time: number, out: OceanSample): OceanSample {
  return active_spectrum.sample_surface(x, z, time, out);
}

export { create_ocean_sample };

function weather_id_for_palette(palette: Palette): OceanWeatherId {
  if (palette.id === 'day') return 'day';
  if (palette.id === 'dusk') return 'sunset';
  if (palette.id === 'storm') return 'storm';
  return 'moonlit_night';
}

function create_surface_geometry(segments: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(OCEAN_SIZE, OCEAN_SIZE, segments, segments);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Reusable high-end WebGL ocean. The surface is camera/ship centered so a finite
 * grid reads as visually infinite, while the CPU spectrum stays in world space for
 * gameplay. Quality or weather rebuilds happen only on explicit user/preset changes.
 */
export class OceanSurface {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  readonly reflection_pass: ReflectionPass;
  readonly water_material: WaterMaterial;

  private readonly camera_position = new THREE.Vector3();
  private readonly light_direction: THREE.Vector3;
  private quality: OceanQualityPreset;
  private base_weather: OceanWeatherPreset;
  private weather: OceanWeatherPreset;
  private spectrum: WaveSpectrum;
  private readonly tuning: OceanTuning;
  private reflection_scale_override: number | null = null;
  private refraction_enabled_override: boolean | null = null;
  private gpu_timer: OceanGpuTimer | null = null;
  private ocean_draw_timed = false;

  constructor(palette: Palette, light_direction: THREE.Vector3) {
    this.light_direction = light_direction.clone().normalize();
    this.quality = OCEAN_QUALITY_PRESETS.high;
    this.base_weather = OCEAN_WEATHER_PRESETS[weather_id_for_palette(palette)];
    this.tuning = {
      wind_direction_offset_radians: 0,
      wave_amplitude_multiplier: 1,
      wave_speed_multiplier: 1,
      foam_multiplier: 1,
      storm_intensity: this.base_weather.id === 'storm' ? 1 : 0,
    };
    this.weather = this.create_effective_weather();
    this.spectrum = create_north_atlantic_wave_spectrum(this.quality, this.weather);
    active_spectrum = this.spectrum;

    this.water_material = new WaterMaterial(palette, this.light_direction);
    this.water_material.set_spectrum(this.spectrum);
    this.water_material.set_weather(this.weather);
    this.water_material.set_storm_intensity(this.tuning.storm_intensity);
    this.water_material.set_quality(this.quality.normal_octaves, this.quality.id !== 'low');

    this.mesh = new THREE.Mesh(create_surface_geometry(this.quality.near_grid_segments), this.water_material.material);
    this.mesh.name = 'OceanSurface';
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.mesh.onBeforeRender = () => {
      this.ocean_draw_timed = this.gpu_timer?.begin_ocean() ?? false;
    };
    this.mesh.onAfterRender = () => {
      if (this.ocean_draw_timed) this.gpu_timer?.end_ocean();
      this.ocean_draw_timed = false;
    };

    this.reflection_pass = new ReflectionPass();
    this.apply_render_feature_overrides();
  }

  get current_quality(): OceanQualityPreset {
    return this.quality;
  }

  get current_weather(): OceanWeatherPreset {
    return this.weather;
  }

  get current_tuning(): Readonly<OceanTuning> {
    return this.tuning;
  }

  get current_reflection_scale(): number {
    return this.reflection_scale_override ?? this.quality.reflection_scale;
  }

  get current_refraction_enabled(): boolean {
    return this.refraction_enabled_override ?? this.quality.id !== 'low';
  }

  set_quality(next_quality: OceanQualityPreset | OceanQualityId): void {
    const quality = typeof next_quality === 'string' ? OCEAN_QUALITY_PRESETS[next_quality] : next_quality;
    const geometry_needs_rebuild = quality.near_grid_segments !== this.quality.near_grid_segments;
    this.quality = quality;
    if (geometry_needs_rebuild) {
      const previous_geometry = this.mesh.geometry;
      this.mesh.geometry = create_surface_geometry(quality.near_grid_segments);
      previous_geometry.dispose();
    }
    this.rebuild_spectrum();
    this.apply_render_feature_overrides();
    this.water_material.set_reflection(null, null, false);
  }

  set_weather(next_weather: OceanWeatherPreset | OceanWeatherId): void {
    this.base_weather = typeof next_weather === 'string' ? OCEAN_WEATHER_PRESETS[next_weather] : next_weather;
    this.tuning.wind_direction_offset_radians = 0;
    this.tuning.wave_amplitude_multiplier = 1;
    this.tuning.wave_speed_multiplier = 1;
    this.tuning.foam_multiplier = 1;
    this.tuning.storm_intensity = this.base_weather.id === 'storm' ? 1 : 0;
    this.apply_tuning();
  }

  set_palette(palette: Palette): void {
    this.water_material.set_palette(palette);
    this.set_weather(weather_id_for_palette(palette));
  }

  set_fog_density(density: number): void {
    this.water_material.set_fog_density(density);
  }

  /** Cheap visual-only storm ramp used by voyage weather progression; it never rebuilds the spectrum. */
  set_visual_storm_intensity(intensity: number): void {
    this.water_material.set_storm_intensity(intensity);
  }

  /** Applies a partial debug/UI tuning update; this is deliberately never called per frame. */
  set_tuning(next: Partial<OceanTuning>): void {
    if (next.wind_direction_offset_radians !== undefined) {
      this.tuning.wind_direction_offset_radians = THREE.MathUtils.clamp(next.wind_direction_offset_radians, -Math.PI, Math.PI);
    }
    if (next.wave_amplitude_multiplier !== undefined) {
      this.tuning.wave_amplitude_multiplier = THREE.MathUtils.clamp(next.wave_amplitude_multiplier, 0.2, 2.4);
    }
    if (next.wave_speed_multiplier !== undefined) {
      this.tuning.wave_speed_multiplier = THREE.MathUtils.clamp(next.wave_speed_multiplier, 0.4, 2.2);
    }
    if (next.foam_multiplier !== undefined) {
      this.tuning.foam_multiplier = THREE.MathUtils.clamp(next.foam_multiplier, 0, 2);
    }
    if (next.storm_intensity !== undefined) {
      this.tuning.storm_intensity = THREE.MathUtils.clamp(next.storm_intensity, 0, 1);
    }
    this.apply_tuning();
  }

  /** Set a temporary planar-target scale; null restores the active quality preset. */
  set_reflection_scale(scale: number | null): void {
    this.reflection_scale_override = scale === null ? null : THREE.MathUtils.clamp(scale, 0, 1);
    this.apply_render_feature_overrides();
    this.water_material.set_reflection(null, null, false);
  }

  /** Toggle pseudo-refraction in the shader; null follows the selected quality tier. */
  set_refraction_enabled(enabled: boolean | null): void {
    this.refraction_enabled_override = enabled;
    this.apply_render_feature_overrides();
  }

  set_iceberg_interactions(sources: readonly OceanInteractionSource[], count: number): void {
    this.water_material.set_iceberg_interactions(sources, count);
  }

  set_gpu_timer(timer: OceanGpuTimer | null): void {
    this.gpu_timer = timer;
  }

  update(
    time: number,
    camera: THREE.Camera,
    follow_x: number,
    follow_z: number,
    ship_heading = 0,
    ship_speed = 0,
  ): void {
    camera.getWorldPosition(this.camera_position);
    this.mesh.position.set(
      Math.floor(follow_x / FOLLOW_SNAP) * FOLLOW_SNAP,
      0,
      Math.floor(follow_z / FOLLOW_SNAP) * FOLLOW_SNAP,
    );
    this.water_material.set_frame(time, this.camera_position);
    this.water_material.set_ship_interaction(follow_x, follow_z, ship_heading, ship_speed);
  }

  /** Update the scheduled planar target before the main render. */
  render_reflections(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    this.reflection_pass.render(renderer, scene, camera, this.mesh, this.gpu_timer);
    const valid = this.reflection_pass.is_enabled && this.reflection_pass.has_valid_capture;
    this.water_material.set_reflection(
      valid ? this.reflection_pass.render_target.texture : null,
      valid ? this.reflection_pass.reflection_matrix : null,
      valid,
    );
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.water_material.dispose();
    this.reflection_pass.dispose();
  }

  private rebuild_spectrum(): void {
    this.spectrum = create_north_atlantic_wave_spectrum(this.quality, this.weather);
    active_spectrum = this.spectrum;
    this.water_material.set_spectrum(this.spectrum);
  }

  private apply_tuning(): void {
    this.weather = this.create_effective_weather();
    this.rebuild_spectrum();
    this.water_material.set_weather(this.weather);
    this.water_material.set_foam_intensity(this.weather.foam_intensity);
    this.water_material.set_storm_intensity(this.tuning.storm_intensity);
  }

  private create_effective_weather(): OceanWeatherPreset {
    return {
      ...this.base_weather,
      wind_direction_offset_radians:
        this.base_weather.wind_direction_offset_radians + this.tuning.wind_direction_offset_radians,
      wave_amplitude_scale: this.base_weather.wave_amplitude_scale * this.tuning.wave_amplitude_multiplier,
      wave_speed_scale: this.base_weather.wave_speed_scale * this.tuning.wave_speed_multiplier,
      foam_intensity: this.base_weather.foam_intensity * this.tuning.foam_multiplier,
    };
  }

  private apply_render_feature_overrides(): void {
    const reflection_scale = this.reflection_scale_override ?? this.quality.reflection_scale;
    const reflection_interval = reflection_scale > 0 ? this.quality.reflection_update_interval : 0;
    const refraction_enabled = this.refraction_enabled_override ?? this.quality.id !== 'low';
    this.reflection_pass.set_settings(reflection_scale, reflection_interval);
    this.water_material.set_quality(this.quality.normal_octaves, refraction_enabled);
  }
}
