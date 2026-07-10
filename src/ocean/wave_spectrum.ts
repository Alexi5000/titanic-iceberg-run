// file: src/ocean/wave_spectrum.ts
// description: Allocation-free CPU Gerstner spectrum sampler and shared ocean presets.
// reference: planned src/ocean/ocean_surface.ts, src/ocean/water_material.ts

/**
 * A single authoring wave. Directions are normalized while compiling the spectrum.
 *
 * `steepness` is a 0..1 contribution to the non-looping Gerstner steepness budget,
 * rather than a raw horizontal displacement multiplier. This keeps a spectrum stable
 * as quality changes the active wave count.
 */
export interface GerstnerWaveDefinition {
  readonly amplitude: number;
  readonly wavelength: number;
  readonly direction_x: number;
  readonly direction_z: number;
  readonly steepness: number;
  readonly speed_multiplier: number;
  readonly phase_offset: number;
}

/** Immutable source data used to compile a `WaveSpectrum`. */
export interface WaveSpectrumDefinition {
  readonly id: string;
  readonly gravity: number;
  readonly waves: readonly GerstnerWaveDefinition[];
}

/**
 * Construction-time controls. Rebuild a spectrum when one changes; sampling itself
 * is allocation-free and should stay on the hot path.
 */
export interface WaveSpectrumOptions {
  readonly wave_count?: number;
  readonly gravity?: number;
  readonly amplitude_scale?: number;
  readonly speed_scale?: number;
  readonly steepness_scale?: number;
  readonly direction_offset_radians?: number;
}

/** Caller-owned output object for `WaveSpectrum.sample` and `sample_surface`. */
export interface OceanSample {
  /** Vertical displacement from the undisplaced water plane. */
  height: number;
  /** Horizontal Gerstner displacement at the rest-space query coordinate. */
  displacement_x: number;
  displacement_z: number;
  /** Unit surface normal. */
  normal_x: number;
  normal_y: number;
  normal_z: number;
  /** Lagrangian surface velocity, useful for wakes and buoyancy damping. */
  velocity_x: number;
  velocity_y: number;
  velocity_z: number;
}

/** Allocate one output sample during setup, then reuse it for every frame. */
export function create_ocean_sample(): OceanSample {
  return {
    height: 0,
    displacement_x: 0,
    displacement_z: 0,
    normal_x: 0,
    normal_y: 1,
    normal_z: 0,
    velocity_x: 0,
    velocity_y: 0,
    velocity_z: 0,
  };
}

export type OceanQualityId = 'low' | 'medium' | 'high' | 'ultra';

/** Quality switches consumed by the ocean, reflection and particle systems. */
export interface OceanQualityPreset {
  readonly id: OceanQualityId;
  readonly label: string;
  readonly wave_count: number;
  readonly near_grid_segments: number;
  readonly far_grid_segments: number;
  readonly normal_octaves: number;
  /** 0 disables planar reflection; otherwise this is a render-target scale. */
  readonly reflection_scale: number;
  /** Number of frames between planar reflection updates. */
  readonly reflection_update_interval: number;
  readonly interaction_resolution: number;
  readonly max_particles: number;
  readonly max_pixel_ratio: number;
}

export const OCEAN_QUALITY_PRESETS: Readonly<Record<OceanQualityId, OceanQualityPreset>> = Object.freeze({
  low: {
    id: 'low',
    label: 'Low',
    wave_count: 3,
    near_grid_segments: 96,
    far_grid_segments: 80,
    normal_octaves: 1,
    reflection_scale: 0,
    reflection_update_interval: 0,
    interaction_resolution: 128,
    max_particles: 80,
    max_pixel_ratio: 1,
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    wave_count: 4,
    near_grid_segments: 144,
    far_grid_segments: 112,
    normal_octaves: 2,
    reflection_scale: 0.35,
    reflection_update_interval: 3,
    interaction_resolution: 192,
    max_particles: 180,
    max_pixel_ratio: 1.25,
  },
  high: {
    id: 'high',
    label: 'High',
    wave_count: 6,
    near_grid_segments: 208,
    far_grid_segments: 160,
    normal_octaves: 2,
    reflection_scale: 0.5,
    reflection_update_interval: 2,
    interaction_resolution: 256,
    max_particles: 360,
    max_pixel_ratio: 1.5,
  },
  ultra: {
    id: 'ultra',
    label: 'Ultra',
    wave_count: 8,
    near_grid_segments: 288,
    far_grid_segments: 224,
    normal_octaves: 3,
    reflection_scale: 0.75,
    reflection_update_interval: 1,
    interaction_resolution: 384,
    max_particles: 640,
    max_pixel_ratio: 1.5,
  },
});

export type OceanWeatherId = 'day' | 'sunset' | 'moonlit_night' | 'storm';

export type OceanColor = readonly [red: number, green: number, blue: number];

/**
 * Shared weather controls. Rendering systems may consume the atmospheric fields,
 * while `create_north_atlantic_wave_spectrum` uses the wave controls directly.
 */
export interface OceanWeatherPreset {
  readonly id: OceanWeatherId;
  readonly label: string;
  readonly wind_speed_mps: number;
  readonly wind_direction_offset_radians: number;
  readonly wave_amplitude_scale: number;
  readonly wave_speed_scale: number;
  readonly wave_steepness_scale: number;
  readonly foam_intensity: number;
  readonly fog_density: number;
  readonly cloud_coverage: number;
  readonly precipitation_intensity: number;
  readonly lightning_per_minute: number;
  readonly sun_elevation_radians: number;
  readonly exposure: number;
  readonly sky_top_color: OceanColor;
  readonly sky_horizon_color: OceanColor;
  readonly water_absorption_color: OceanColor;
}

export const OCEAN_WEATHER_PRESETS: Readonly<Record<OceanWeatherId, OceanWeatherPreset>> = Object.freeze({
  day: {
    id: 'day',
    label: 'Day',
    wind_speed_mps: 7,
    wind_direction_offset_radians: 0,
    wave_amplitude_scale: 0.78,
    wave_speed_scale: 0.9,
    wave_steepness_scale: 0.72,
    foam_intensity: 0.38,
    fog_density: 0.0024,
    cloud_coverage: 0.22,
    precipitation_intensity: 0,
    lightning_per_minute: 0,
    sun_elevation_radians: 0.82,
    exposure: 1.06,
    sky_top_color: [0.12, 0.32, 0.55],
    sky_horizon_color: [0.62, 0.76, 0.86],
    water_absorption_color: [0.015, 0.105, 0.14],
  },
  sunset: {
    id: 'sunset',
    label: 'Sunset',
    wind_speed_mps: 9,
    wind_direction_offset_radians: 0.12,
    wave_amplitude_scale: 0.92,
    wave_speed_scale: 0.98,
    wave_steepness_scale: 0.88,
    foam_intensity: 0.5,
    fog_density: 0.0036,
    cloud_coverage: 0.42,
    precipitation_intensity: 0,
    lightning_per_minute: 0,
    sun_elevation_radians: 0.13,
    exposure: 0.98,
    sky_top_color: [0.16, 0.13, 0.28],
    sky_horizon_color: [0.98, 0.39, 0.19],
    water_absorption_color: [0.018, 0.07, 0.11],
  },
  moonlit_night: {
    id: 'moonlit_night',
    label: 'Moonlit Night',
    wind_speed_mps: 10,
    wind_direction_offset_radians: -0.08,
    wave_amplitude_scale: 0.96,
    wave_speed_scale: 1,
    wave_steepness_scale: 0.94,
    foam_intensity: 0.58,
    fog_density: 0.0052,
    cloud_coverage: 0.34,
    precipitation_intensity: 0,
    lightning_per_minute: 0,
    sun_elevation_radians: -0.48,
    exposure: 0.76,
    sky_top_color: [0.006, 0.014, 0.04],
    sky_horizon_color: [0.055, 0.09, 0.16],
    water_absorption_color: [0.004, 0.026, 0.052],
  },
  storm: {
    id: 'storm',
    label: 'Storm',
    wind_speed_mps: 19,
    wind_direction_offset_radians: 0.26,
    wave_amplitude_scale: 1.35,
    wave_speed_scale: 1.18,
    wave_steepness_scale: 1.35,
    foam_intensity: 1,
    fog_density: 0.0095,
    cloud_coverage: 0.94,
    precipitation_intensity: 0.86,
    lightning_per_minute: 3,
    sun_elevation_radians: 0.24,
    exposure: 0.68,
    sky_top_color: [0.008, 0.018, 0.028],
    sky_horizon_color: [0.13, 0.18, 0.22],
    water_absorption_color: [0.004, 0.035, 0.055],
  },
});

/**
 * Layout uploaded to two GLSL `vec4` arrays. Index `i` describes one wave:
 *
 * `u_wave_a[i] = vec4(direction_x, direction_z, amplitude, wave_number)`
 * `u_wave_b[i] = vec4(angular_frequency, horizontal_amplitude, phase_offset, slope_strength)`
 *
 * The shared phase convention is:
 * `phase = wave_number * dot(direction, rest_xz) - angular_frequency * time + phase_offset`.
 * A crest therefore travels in the positive direction vector.
 */
export const GERSTNER_SHADER_VEC4_STRIDE = 4;

export const GERSTNER_SHADER_WAVE_A_OFFSETS = Object.freeze({
  direction_x: 0,
  direction_z: 1,
  amplitude: 2,
  wave_number: 3,
});

export const GERSTNER_SHADER_WAVE_B_OFFSETS = Object.freeze({
  angular_frequency: 0,
  horizontal_amplitude: 1,
  phase_offset: 2,
  slope_strength: 3,
});

const TAU = Math.PI * 2;
const MIN_DIRECTION_LENGTH_SQUARED = 1e-12;
const MAX_TOTAL_STEEPNESS = 0.9;
const EMPTY_WAVE_SPECTRUM_OPTIONS: Readonly<WaveSpectrumOptions> = Object.freeze({});

/**
 * Compile a stable, shader-ready multi-octave Gerstner spectrum.
 *
 * The packed `Float32Array` values are the source of truth for both CPU sampling and
 * shader uploads. Using the same rounded coefficients avoids configuration drift.
 */
export class WaveSpectrum {
  readonly id: string;
  readonly gravity: number;
  readonly wave_count: number;

  private readonly wave_a_data: Float32Array;
  private readonly wave_b_data: Float32Array;

  constructor(definition: WaveSpectrumDefinition, options?: WaveSpectrumOptions) {
    const resolved_options = options ?? EMPTY_WAVE_SPECTRUM_OPTIONS;
    validate_non_empty_id(definition.id);

    const gravity = resolved_options.gravity ?? definition.gravity;
    const amplitude_scale = resolved_options.amplitude_scale ?? 1;
    const speed_scale = resolved_options.speed_scale ?? 1;
    const steepness_scale = resolved_options.steepness_scale ?? 1;
    const direction_offset_radians = resolved_options.direction_offset_radians ?? 0;
    const wave_count = resolved_options.wave_count ?? definition.waves.length;

    validate_positive('gravity', gravity);
    validate_non_negative('amplitude_scale', amplitude_scale);
    validate_non_negative('speed_scale', speed_scale);
    validate_non_negative('steepness_scale', steepness_scale);
    validate_finite('direction_offset_radians', direction_offset_radians);
    validate_wave_count(wave_count, definition.waves.length);

    this.id = definition.id;
    this.gravity = gravity;
    this.wave_count = wave_count;
    this.wave_a_data = new Float32Array(wave_count * GERSTNER_SHADER_VEC4_STRIDE);
    this.wave_b_data = new Float32Array(wave_count * GERSTNER_SHADER_VEC4_STRIDE);

    const direction_cosine = Math.cos(direction_offset_radians);
    const direction_sine = Math.sin(direction_offset_radians);
    const maximum_wave_slope = wave_count === 0 ? 0 : MAX_TOTAL_STEEPNESS / wave_count;

    for (let wave_index = 0; wave_index < wave_count; wave_index += 1) {
      const source = definition.waves[wave_index];
      validate_wave_definition(source, wave_index);

      const direction_length = Math.sqrt(
        source.direction_x * source.direction_x + source.direction_z * source.direction_z,
      );
      const normalized_x = source.direction_x / direction_length;
      const normalized_z = source.direction_z / direction_length;
      const direction_x = normalized_x * direction_cosine - normalized_z * direction_sine;
      const direction_z = normalized_x * direction_sine + normalized_z * direction_cosine;
      const wave_number = TAU / source.wavelength;
      const amplitude = source.amplitude * amplitude_scale;
      const angular_frequency = Math.sqrt(gravity * wave_number) * source.speed_multiplier * speed_scale;
      const raw_slope_strength = amplitude === 0
        ? 0
        : (source.steepness * amplitude_scale * steepness_scale) / wave_count;
      const slope_strength = Math.min(raw_slope_strength, maximum_wave_slope);
      const horizontal_amplitude = slope_strength / wave_number;
      const data_offset = wave_index * GERSTNER_SHADER_VEC4_STRIDE;

      this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_x] = direction_x;
      this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_z] = direction_z;
      this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.amplitude] = amplitude;
      this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.wave_number] = wave_number;
      this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.angular_frequency] = angular_frequency;
      this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.horizontal_amplitude] = horizontal_amplitude;
      this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.phase_offset] = source.phase_offset;
      this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.slope_strength] = slope_strength;
    }
  }

  /** Number of float entries required by either shader upload buffer. */
  get shader_data_length(): number {
    return this.wave_a_data.length;
  }

  /**
   * Copy the shader-ready `u_wave_a` data into a caller-owned uniform buffer.
   * This never allocates; allocate the target once when creating the material.
   */
  write_shader_wave_a(target: Float32Array, target_offset = 0): void {
    validate_shader_target(target, target_offset, this.wave_a_data.length, 'u_wave_a');
    target.set(this.wave_a_data, target_offset);
  }

  /** Copy the shader-ready `u_wave_b` data into a caller-owned uniform buffer. */
  write_shader_wave_b(target: Float32Array, target_offset = 0): void {
    validate_shader_target(target, target_offset, this.wave_b_data.length, 'u_wave_b');
    target.set(this.wave_b_data, target_offset);
  }

  /**
   * Sample the complete Gerstner surface at a rest-space X/Z coordinate.
   *
   * The returned object is exactly `out`; callers should allocate it once with
   * `create_ocean_sample` and reuse it every frame.
   */
  sample(x: number, z: number, time: number, out: OceanSample): OceanSample {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(time)) {
      return write_flat_sample(out);
    }

    let height = 0;
    let displacement_x = 0;
    let displacement_z = 0;
    let velocity_x = 0;
    let velocity_y = 0;
    let velocity_z = 0;

    // Tangents of P(rest_x, rest_z), accumulated analytically alongside displacement.
    let tangent_x_x = 1;
    let tangent_x_y = 0;
    let tangent_x_z = 0;
    let tangent_z_x = 0;
    let tangent_z_y = 0;
    let tangent_z_z = 1;

    for (let data_offset = 0; data_offset < this.wave_a_data.length; data_offset += GERSTNER_SHADER_VEC4_STRIDE) {
      const direction_x = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_x];
      const direction_z = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_z];
      const amplitude = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.amplitude];
      const wave_number = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.wave_number];
      const angular_frequency = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.angular_frequency];
      const horizontal_amplitude = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.horizontal_amplitude];
      const phase_offset = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.phase_offset];
      const slope_strength = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.slope_strength];
      const phase = wave_number * (direction_x * x + direction_z * z) - angular_frequency * time + phase_offset;
      const sine = Math.sin(phase);
      const cosine = Math.cos(phase);
      const slope_sine = slope_strength * sine;
      const vertical_slope_cosine = amplitude * wave_number * cosine;
      const horizontal_velocity = horizontal_amplitude * angular_frequency * sine;

      height += amplitude * sine;
      displacement_x += horizontal_amplitude * direction_x * cosine;
      displacement_z += horizontal_amplitude * direction_z * cosine;
      velocity_x += direction_x * horizontal_velocity;
      velocity_y -= amplitude * angular_frequency * cosine;
      velocity_z += direction_z * horizontal_velocity;

      tangent_x_x -= slope_sine * direction_x * direction_x;
      tangent_x_y += vertical_slope_cosine * direction_x;
      tangent_x_z -= slope_sine * direction_x * direction_z;
      tangent_z_x -= slope_sine * direction_x * direction_z;
      tangent_z_y += vertical_slope_cosine * direction_z;
      tangent_z_z -= slope_sine * direction_z * direction_z;
    }

    // cross(tangent_z, tangent_x) points upward for the undisplaced X/Z plane.
    const normal_x = tangent_z_y * tangent_x_z - tangent_z_z * tangent_x_y;
    const normal_y = tangent_z_z * tangent_x_x - tangent_z_x * tangent_x_z;
    const normal_z = tangent_z_x * tangent_x_y - tangent_z_y * tangent_x_x;
    const normal_length_squared = normal_x * normal_x + normal_y * normal_y + normal_z * normal_z;

    out.height = height;
    out.displacement_x = displacement_x;
    out.displacement_z = displacement_z;
    out.velocity_x = velocity_x;
    out.velocity_y = velocity_y;
    out.velocity_z = velocity_z;

    if (normal_length_squared > MIN_DIRECTION_LENGTH_SQUARED && Number.isFinite(normal_length_squared)) {
      const inverse_normal_length = 1 / Math.sqrt(normal_length_squared);
      out.normal_x = normal_x * inverse_normal_length;
      out.normal_y = normal_y * inverse_normal_length;
      out.normal_z = normal_z * inverse_normal_length;
    } else {
      out.normal_x = 0;
      out.normal_y = 1;
      out.normal_z = 0;
    }

    return out;
  }

  /** Alias matching the planned `OceanSurface.sample_surface` naming. */
  sample_surface(x: number, z: number, time: number, out: OceanSample): OceanSample {
    return this.sample(x, z, time, out);
  }

  /** Fast vertical-only query for far objects that do not need a normal or velocity. */
  sample_height(x: number, z: number, time: number): number {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(time)) return 0;

    let height = 0;
    for (let data_offset = 0; data_offset < this.wave_a_data.length; data_offset += GERSTNER_SHADER_VEC4_STRIDE) {
      const direction_x = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_x];
      const direction_z = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.direction_z];
      const amplitude = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.amplitude];
      const wave_number = this.wave_a_data[data_offset + GERSTNER_SHADER_WAVE_A_OFFSETS.wave_number];
      const angular_frequency = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.angular_frequency];
      const phase_offset = this.wave_b_data[data_offset + GERSTNER_SHADER_WAVE_B_OFFSETS.phase_offset];
      const phase = wave_number * (direction_x * x + direction_z * z) - angular_frequency * time + phase_offset;
      height += amplitude * Math.sin(phase);
    }
    return height;
  }
}

/**
 * North Atlantic swell plus progressively smaller, wind-driven octaves. Entries are
 * deliberately ordered from longest to shortest wavelength so quality can take a
 * deterministic prefix without changing the large-scale sea state.
 */
const NORTH_ATLANTIC_WAVES: readonly GerstnerWaveDefinition[] = Object.freeze([
  Object.freeze({ amplitude: 1.3, wavelength: 185, direction_x: 0.91, direction_z: 0.42, steepness: 0.66, speed_multiplier: 0.9, phase_offset: 0.37 }),
  Object.freeze({ amplitude: 0.95, wavelength: 116, direction_x: 0.83, direction_z: 0.56, steepness: 0.61, speed_multiplier: 0.98, phase_offset: 1.81 }),
  Object.freeze({ amplitude: 0.64, wavelength: 72, direction_x: 0.96, direction_z: 0.29, steepness: 0.58, speed_multiplier: 1.08, phase_offset: 3.04 }),
  Object.freeze({ amplitude: 0.39, wavelength: 43, direction_x: 0.69, direction_z: 0.72, steepness: 0.5, speed_multiplier: 1.17, phase_offset: 4.42 }),
  Object.freeze({ amplitude: 0.24, wavelength: 27, direction_x: 0.99, direction_z: 0.12, steepness: 0.43, speed_multiplier: 1.29, phase_offset: 5.24 }),
  Object.freeze({ amplitude: 0.15, wavelength: 16, direction_x: 0.57, direction_z: 0.82, steepness: 0.36, speed_multiplier: 1.42, phase_offset: 2.36 }),
  Object.freeze({ amplitude: 0.085, wavelength: 9.5, direction_x: 0.88, direction_z: -0.48, steepness: 0.28, speed_multiplier: 1.58, phase_offset: 0.94 }),
  Object.freeze({ amplitude: 0.045, wavelength: 5.7, direction_x: 0.36, direction_z: 0.93, steepness: 0.2, speed_multiplier: 1.76, phase_offset: 3.67 }),
]);

export const NORTH_ATLANTIC_WAVE_SPECTRUM: WaveSpectrumDefinition = Object.freeze({
  id: 'north_atlantic',
  gravity: 9.81,
  waves: NORTH_ATLANTIC_WAVES,
});

/**
 * Create the production default spectrum. This is intentionally a setup operation;
 * keep the returned instance and update shader uniforms only when quality/weather changes.
 */
export function create_north_atlantic_wave_spectrum(
  quality: OceanQualityPreset = OCEAN_QUALITY_PRESETS.high,
  weather: OceanWeatherPreset = OCEAN_WEATHER_PRESETS.moonlit_night,
): WaveSpectrum {
  return new WaveSpectrum(NORTH_ATLANTIC_WAVE_SPECTRUM, {
    wave_count: quality.wave_count,
    amplitude_scale: weather.wave_amplitude_scale,
    speed_scale: weather.wave_speed_scale,
    steepness_scale: weather.wave_steepness_scale,
    direction_offset_radians: weather.wind_direction_offset_radians,
  });
}

function write_flat_sample(out: OceanSample): OceanSample {
  out.height = 0;
  out.displacement_x = 0;
  out.displacement_z = 0;
  out.normal_x = 0;
  out.normal_y = 1;
  out.normal_z = 0;
  out.velocity_x = 0;
  out.velocity_y = 0;
  out.velocity_z = 0;
  return out;
}

function validate_non_empty_id(id: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new RangeError('WaveSpectrumDefinition.id must be a non-empty string.');
  }
}

function validate_finite(name: string, value: number): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} must be finite.`);
  }
}

function validate_positive(name: string, value: number): void {
  validate_finite(name, value);
  if (value <= 0) throw new RangeError(`${name} must be greater than zero.`);
}

function validate_non_negative(name: string, value: number): void {
  validate_finite(name, value);
  if (value < 0) throw new RangeError(`${name} must not be negative.`);
}

function validate_wave_count(wave_count: number, source_count: number): void {
  if (!Number.isInteger(wave_count) || wave_count < 0 || wave_count > source_count) {
    throw new RangeError(`wave_count must be an integer between 0 and ${source_count}.`);
  }
}

function validate_wave_definition(wave: GerstnerWaveDefinition, wave_index: number): void {
  validate_non_negative(`waves[${wave_index}].amplitude`, wave.amplitude);
  validate_positive(`waves[${wave_index}].wavelength`, wave.wavelength);
  validate_finite(`waves[${wave_index}].direction_x`, wave.direction_x);
  validate_finite(`waves[${wave_index}].direction_z`, wave.direction_z);
  validate_non_negative(`waves[${wave_index}].steepness`, wave.steepness);
  validate_non_negative(`waves[${wave_index}].speed_multiplier`, wave.speed_multiplier);
  validate_finite(`waves[${wave_index}].phase_offset`, wave.phase_offset);

  if (wave.steepness > 1) {
    throw new RangeError(`waves[${wave_index}].steepness must be in the 0..1 range.`);
  }

  const direction_length_squared = wave.direction_x * wave.direction_x + wave.direction_z * wave.direction_z;
  if (direction_length_squared <= MIN_DIRECTION_LENGTH_SQUARED) {
    throw new RangeError(`waves[${wave_index}] requires a non-zero X/Z direction.`);
  }
}

function validate_shader_target(
  target: Float32Array,
  target_offset: number,
  source_length: number,
  uniform_name: string,
): void {
  if (!Number.isInteger(target_offset) || target_offset < 0) {
    throw new RangeError(`${uniform_name} target_offset must be a non-negative integer.`);
  }
  if (target_offset + source_length > target.length) {
    throw new RangeError(`${uniform_name} target needs ${source_length} floats from offset ${target_offset}.`);
  }
}
