// file: src/ocean/water_material.ts
// description: Reusable WebGL2-friendly Gerstner water shader, interaction foam, and planar-reflection bindings.
// reference: src/ocean/ocean_surface.ts, src/ocean/reflection_pass.ts, src/ocean/wave_spectrum.ts

import * as THREE from 'three';
import { OceanWeatherPreset, WaveSpectrum } from './wave_spectrum';
import { Palette } from '../world/palette';

/** Maximum authoring capacity compiled into the shader. Quality selects a prefix at runtime. */
export const MAX_GERSTNER_WAVES = 8;
/** Nearby collision objects that can write localized shoreline/ice foam into the water shader. */
export const MAX_OCEAN_INTERACTIONS = 12;

export interface OceanInteractionSource {
  x: number;
  z: number;
  radius: number;
  intensity: number;
}

/** Allocate once during setup; update the returned entries in place each frame. */
export function create_ocean_interaction_sources(count = MAX_OCEAN_INTERACTIONS): OceanInteractionSource[] {
  const sources: OceanInteractionSource[] = [];
  for (let index = 0; index < count; index += 1) {
    sources.push({ x: 0, z: 0, radius: 0, intensity: 0 });
  }
  return sources;
}

const WATER_VERTEX_SHADER = /* glsl */ `
  #define MAX_GERSTNER_WAVES ${MAX_GERSTNER_WAVES}

  uniform float u_time;
  uniform int u_wave_count;
  uniform vec4 u_wave_a[MAX_GERSTNER_WAVES];
  uniform vec4 u_wave_b[MAX_GERSTNER_WAVES];
  uniform mat4 u_reflection_matrix;

  varying vec3 v_world_position;
  varying vec3 v_surface_normal;
  varying vec2 v_rest_position;
  varying vec4 v_reflection_clip;
  varying float v_crest;

  void main() {
    vec4 rest_world = modelMatrix * vec4(position, 1.0);
    vec2 rest = rest_world.xz;
    vec3 displaced = vec3(rest.x, 0.0, rest.y);
    vec3 tangent_x = vec3(1.0, 0.0, 0.0);
    vec3 tangent_z = vec3(0.0, 0.0, 1.0);
    float crest = 0.0;

    for (int wave_index = 0; wave_index < MAX_GERSTNER_WAVES; wave_index += 1) {
      if (wave_index >= u_wave_count) break;
      vec4 wave_a = u_wave_a[wave_index];
      vec4 wave_b = u_wave_b[wave_index];
      vec2 direction = wave_a.xy;
      float amplitude = wave_a.z;
      float wave_number = wave_a.w;
      float angular_frequency = wave_b.x;
      float horizontal_amplitude = wave_b.y;
      float phase = wave_number * dot(direction, rest) - angular_frequency * u_time + wave_b.z;
      float sine_phase = sin(phase);
      float cosine_phase = cos(phase);
      float slope_strength = wave_b.w;
      float horizontal_slope = slope_strength * sine_phase;
      float vertical_slope = amplitude * wave_number * cosine_phase;

      displaced.xz += direction * horizontal_amplitude * cosine_phase;
      displaced.y += amplitude * sine_phase;

      tangent_x.x -= horizontal_slope * direction.x * direction.x;
      tangent_x.y += vertical_slope * direction.x;
      tangent_x.z -= horizontal_slope * direction.x * direction.y;
      tangent_z.x -= horizontal_slope * direction.x * direction.y;
      tangent_z.y += vertical_slope * direction.y;
      tangent_z.z -= horizontal_slope * direction.y * direction.y;

      // A stable crest signal for foam; it intentionally follows the high-side
      // of each trochoid instead of relying on noisy normal-map thresholding.
      crest += max(sine_phase, 0.0) * (0.35 + slope_strength * 2.4);
    }

    v_world_position = displaced;
    v_surface_normal = normalize(cross(tangent_z, tangent_x));
    v_rest_position = rest;
    v_crest = crest / max(float(u_wave_count), 1.0);
    v_reflection_clip = u_reflection_matrix * vec4(displaced, 1.0);
    gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
  }
`;

const WATER_FRAGMENT_SHADER = /* glsl */ `
  #define MAX_OCEAN_INTERACTIONS ${MAX_OCEAN_INTERACTIONS}

  uniform vec3 u_camera_position;
  uniform vec3 u_deep_color;
  uniform vec3 u_surface_color;
  uniform vec3 u_horizon_color;
  uniform vec3 u_sky_color;
  uniform vec3 u_foam_color;
  uniform vec3 u_light_direction;
  uniform vec3 u_light_color;
  uniform vec3 u_fog_color;
  uniform float u_fog_density;
  uniform float u_normal_layers;
  uniform float u_foam_intensity;
  uniform float u_storm_intensity;
  uniform float u_reflection_enabled;
  uniform float u_refraction_enabled;
  uniform float u_time;
  uniform sampler2D u_planar_reflection;
  uniform vec4 u_ship_state;
  uniform vec4 u_iceberg_interactions[MAX_OCEAN_INTERACTIONS];

  varying vec3 v_world_position;
  varying vec3 v_surface_normal;
  varying vec2 v_rest_position;
  varying vec4 v_reflection_clip;
  varying float v_crest;

  // Three.js injects a saturate macro into ShaderMaterial programs, so this
  // helper intentionally uses a local name to avoid macro substitution.
  float clamp01_water(float value) {
    return clamp(value, 0.0, 1.0);
  }

  float ripple_height(vec2 point) {
    float first = sin(dot(point, vec2(1.62, 0.88)) + u_time * 2.1) * 0.54;
    float second = sin(dot(point, vec2(-0.71, 1.93)) - u_time * 2.8 + first) * 0.31;
    float third = sin(dot(point, vec2(3.4, -2.1)) + u_time * 4.3) * 0.15;
    return first + second + third;
  }

  vec3 small_scale_normal(vec2 point) {
    float epsilon = 0.055;
    float left = ripple_height(point - vec2(epsilon, 0.0));
    float right = ripple_height(point + vec2(epsilon, 0.0));
    float down = ripple_height(point - vec2(0.0, epsilon));
    float up = ripple_height(point + vec2(0.0, epsilon));
    return normalize(vec3((left - right) * 0.9, 1.0, (down - up) * 0.9));
  }

  float ship_wake_foam(vec2 world_xz) {
    vec2 ship_position = u_ship_state.xy;
    float heading = u_ship_state.z;
    float speed = max(u_ship_state.w, 0.0);
    vec2 forward = vec2(sin(heading), cos(heading));
    vec2 right = vec2(forward.y, -forward.x);
    vec2 relative = world_xz - ship_position;
    float along = dot(relative, forward);
    float side = abs(dot(relative, right));
    float stern_distance = max(-along, 0.0);
    float speed_mask = smoothstep(2.0, 9.0, speed);
    float widening = 13.0 + stern_distance * 0.22;
    float stern_mask = smoothstep(10.0, 44.0, stern_distance) * (1.0 - smoothstep(120.0, 245.0, stern_distance));
    float v_wake = stern_mask * (1.0 - smoothstep(widening * 0.45, widening, side));
    vec2 bow = ship_position + forward * 129.0;
    float bow_spray = 1.0 - smoothstep(8.0, 31.0, length(world_xz - bow));
    return max(v_wake, bow_spray * 0.76) * speed_mask;
  }

  float iceberg_foam(vec2 world_xz) {
    float result = 0.0;
    for (int interaction_index = 0; interaction_index < MAX_OCEAN_INTERACTIONS; interaction_index += 1) {
      vec4 interaction = u_iceberg_interactions[interaction_index];
      float radius = interaction.z;
      float distance_to_ice = length(world_xz - interaction.xy);
      float edge_width = max(7.0, radius * 0.28);
      float ring = (1.0 - smoothstep(radius, radius + edge_width, distance_to_ice))
        * smoothstep(max(radius * 0.45, 0.1), radius + edge_width * 0.35, distance_to_ice);
      result = max(result, ring * interaction.w);
    }
    return result;
  }

  void main() {
    vec3 view_direction = normalize(u_camera_position - v_world_position);
    vec3 detail_normal = small_scale_normal(v_rest_position * 0.19);
    if (u_normal_layers > 1.5) {
      detail_normal += small_scale_normal(v_rest_position * 0.43 + vec2(17.2, -8.1)) * 0.48;
    }
    if (u_normal_layers > 2.5) {
      detail_normal += small_scale_normal(v_rest_position * 0.88 + vec2(-29.4, 12.7)) * 0.24;
    }
    vec3 normal = normalize(v_surface_normal + vec3(detail_normal.x, 0.0, detail_normal.z) * (0.22 + u_storm_intensity * 0.12));

    float distance_to_camera = length(u_camera_position - v_world_position);
    float water_depth_proxy = clamp(5.0 + distance_to_camera * 0.018 + (1.0 - normal.y) * 18.0, 4.0, 42.0);
    float transmission = exp(-water_depth_proxy * mix(0.052, 0.082, u_storm_intensity));
    vec3 refracted_color = mix(u_deep_color, u_surface_color, transmission * (0.42 + normal.y * 0.52));
    if (u_refraction_enabled > 0.5) {
      refracted_color += u_horizon_color * (0.025 + (1.0 - normal.y) * 0.035);
    }

    vec3 reflected_direction = reflect(-view_direction, normal);
    vec3 sky_reflection = mix(u_horizon_color, u_sky_color, clamp01_water(reflected_direction.y * 0.65 + 0.35));
    vec2 reflection_uv = v_reflection_clip.xy / max(v_reflection_clip.w, 0.0001) * 0.5 + 0.5;
    reflection_uv += normal.xz * (0.010 + u_storm_intensity * 0.012);
    float reflection_in_bounds = step(0.002, reflection_uv.x) * step(0.002, reflection_uv.y)
      * step(reflection_uv.x, 0.998) * step(reflection_uv.y, 0.998);
    vec3 planar_reflection = texture2D(u_planar_reflection, clamp(reflection_uv, 0.002, 0.998)).rgb;
    vec3 reflection = mix(sky_reflection, planar_reflection, u_reflection_enabled * reflection_in_bounds);

    float fresnel = 0.025 + 0.975 * pow(1.0 - max(dot(normal, view_direction), 0.0), 4.35);
    vec3 half_vector = normalize(u_light_direction + view_direction);
    float gloss = pow(max(dot(normal, half_vector), 0.0), mix(520.0, 120.0, u_storm_intensity));
    float glitter = gloss * (0.25 + 0.75 * pow(max(dot(normal, u_light_direction), 0.0), 0.5));
    vec3 color = mix(refracted_color, reflection, fresnel * (0.56 + u_storm_intensity * 0.18));
    color += u_light_color * glitter * (0.48 + fresnel * 1.1);

    float crest_foam = smoothstep(0.14, 0.46, v_crest) * (0.45 + (1.0 - normal.y) * 0.8);
    float interaction_foam = max(ship_wake_foam(v_world_position.xz), iceberg_foam(v_world_position.xz));
    float foam = clamp01_water(max(crest_foam, interaction_foam) * u_foam_intensity);
    color = mix(color, u_foam_color, foam * (0.54 + fresnel * 0.36));

    float fog = 1.0 - exp(-u_fog_density * u_fog_density * distance_to_camera * distance_to_camera);
    color = mix(color, u_fog_color, clamp01_water(fog));
    gl_FragColor = vec4(color, 1.0);
  }
`;

function map_palette_to_weather_colors(palette: Palette): { horizon: number; sky: number } {
  return { horizon: palette.sky_horizon, sky: palette.sky_top };
}

/**
 * Owns the shader uniform state only. Geometry, CPU buoyancy and the reflection
 * render pass stay in separate modules so the material is reusable in another scene.
 */
export class WaterMaterial {
  readonly material: THREE.ShaderMaterial;

  private readonly wave_a = Array.from({ length: MAX_GERSTNER_WAVES }, () => new THREE.Vector4());
  private readonly wave_b = Array.from({ length: MAX_GERSTNER_WAVES }, () => new THREE.Vector4());
  private readonly wave_a_data = new Float32Array(MAX_GERSTNER_WAVES * 4);
  private readonly wave_b_data = new Float32Array(MAX_GERSTNER_WAVES * 4);
  private readonly interactions = Array.from({ length: MAX_OCEAN_INTERACTIONS }, () => new THREE.Vector4());
  private readonly fallback_reflection: THREE.DataTexture;

  constructor(palette: Palette, light_direction: THREE.Vector3) {
    this.fallback_reflection = new THREE.DataTexture(
      new Uint8Array([16, 30, 44, 255]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    this.fallback_reflection.colorSpace = THREE.SRGBColorSpace;
    this.fallback_reflection.needsUpdate = true;

    const weather_colors = map_palette_to_weather_colors(palette);
    this.material = new THREE.ShaderMaterial({
      name: 'CinematicGerstnerWater',
      vertexShader: WATER_VERTEX_SHADER,
      fragmentShader: WATER_FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0 },
        u_wave_count: { value: 0 },
        u_wave_a: { value: this.wave_a },
        u_wave_b: { value: this.wave_b },
        u_camera_position: { value: new THREE.Vector3() },
        u_deep_color: { value: new THREE.Color(palette.ocean_deep) },
        u_surface_color: { value: new THREE.Color(palette.ocean_surface) },
        u_horizon_color: { value: new THREE.Color(weather_colors.horizon) },
        u_sky_color: { value: new THREE.Color(weather_colors.sky) },
        u_foam_color: { value: new THREE.Color(0xe6f5f7) },
        u_light_direction: { value: light_direction.clone().normalize() },
        u_light_color: { value: new THREE.Color(palette.moon_color) },
        u_fog_color: { value: new THREE.Color(palette.fog_color) },
        u_fog_density: { value: palette.fog_density_base },
        u_normal_layers: { value: 2 },
        u_foam_intensity: { value: 0.58 },
        u_storm_intensity: { value: palette.storm_intensity },
        u_reflection_enabled: { value: 0 },
        u_refraction_enabled: { value: 1 },
        u_planar_reflection: { value: this.fallback_reflection },
        u_reflection_matrix: { value: new THREE.Matrix4() },
        u_ship_state: { value: new THREE.Vector4(0, 0, 0, 0) },
        u_iceberg_interactions: { value: this.interactions },
      },
      depthWrite: true,
      depthTest: true,
      transparent: false,
      fog: false,
    });
  }

  set_palette(palette: Palette): void {
    const colors = map_palette_to_weather_colors(palette);
    (this.material.uniforms.u_deep_color.value as THREE.Color).setHex(palette.ocean_deep);
    (this.material.uniforms.u_surface_color.value as THREE.Color).setHex(palette.ocean_surface);
    (this.material.uniforms.u_horizon_color.value as THREE.Color).setHex(colors.horizon);
    (this.material.uniforms.u_sky_color.value as THREE.Color).setHex(colors.sky);
    (this.material.uniforms.u_light_color.value as THREE.Color).setHex(palette.moon_color);
    (this.material.uniforms.u_fog_color.value as THREE.Color).setHex(palette.fog_color);
    this.material.uniforms.u_fog_density.value = palette.fog_density_base;
    this.material.uniforms.u_storm_intensity.value = palette.storm_intensity;
  }

  set_spectrum(spectrum: WaveSpectrum): void {
    this.wave_a_data.fill(0);
    this.wave_b_data.fill(0);
    spectrum.write_shader_wave_a(this.wave_a_data);
    spectrum.write_shader_wave_b(this.wave_b_data);
    for (let index = 0; index < MAX_GERSTNER_WAVES; index += 1) {
      const offset = index * 4;
      this.wave_a[index].set(
        this.wave_a_data[offset],
        this.wave_a_data[offset + 1],
        this.wave_a_data[offset + 2],
        this.wave_a_data[offset + 3],
      );
      this.wave_b[index].set(
        this.wave_b_data[offset],
        this.wave_b_data[offset + 1],
        this.wave_b_data[offset + 2],
        this.wave_b_data[offset + 3],
      );
    }
    this.material.uniforms.u_wave_count.value = spectrum.wave_count;
  }

  set_weather(weather: OceanWeatherPreset): void {
    this.material.uniforms.u_foam_intensity.value = weather.foam_intensity;
    this.material.uniforms.u_storm_intensity.value = weather.id === 'storm' ? 1 : 0;
  }

  set_foam_intensity(intensity: number): void {
    this.material.uniforms.u_foam_intensity.value = THREE.MathUtils.clamp(intensity, 0, 2);
  }

  set_storm_intensity(intensity: number): void {
    this.material.uniforms.u_storm_intensity.value = THREE.MathUtils.clamp(intensity, 0, 1);
  }

  set_refraction_enabled(enabled: boolean): void {
    this.material.uniforms.u_refraction_enabled.value = enabled ? 1 : 0;
  }

  set_quality(normal_layers: number, refraction_enabled: boolean): void {
    this.material.uniforms.u_normal_layers.value = Math.max(1, Math.min(3, normal_layers));
    this.material.uniforms.u_refraction_enabled.value = refraction_enabled ? 1 : 0;
  }

  set_fog_density(density: number): void {
    this.material.uniforms.u_fog_density.value = Math.max(0, density);
  }

  set_frame(time: number, camera_position: THREE.Vector3): void {
    this.material.uniforms.u_time.value = time;
    (this.material.uniforms.u_camera_position.value as THREE.Vector3).copy(camera_position);
  }

  set_ship_interaction(x: number, z: number, heading: number, speed: number): void {
    (this.material.uniforms.u_ship_state.value as THREE.Vector4).set(x, z, heading, Math.abs(speed));
  }

  set_iceberg_interactions(sources: readonly OceanInteractionSource[], count: number): void {
    const limited_count = Math.min(Math.max(0, count), MAX_OCEAN_INTERACTIONS, sources.length);
    for (let index = 0; index < MAX_OCEAN_INTERACTIONS; index += 1) {
      const source = index < limited_count ? sources[index] : undefined;
      this.interactions[index].set(
        source?.x ?? 0,
        source?.z ?? 0,
        Math.max(0, source?.radius ?? 0),
        Math.max(0, source?.intensity ?? 0),
      );
    }
  }

  set_reflection(texture: THREE.Texture | null, reflection_matrix: THREE.Matrix4 | null, enabled: boolean): void {
    this.material.uniforms.u_planar_reflection.value = texture ?? this.fallback_reflection;
    this.material.uniforms.u_reflection_enabled.value = enabled && texture !== null ? 1 : 0;
    if (reflection_matrix !== null) {
      (this.material.uniforms.u_reflection_matrix.value as THREE.Matrix4).copy(reflection_matrix);
    }
  }

  dispose(): void {
    this.material.dispose();
    this.fallback_reflection.dispose();
  }
}
