// file: src/core/post_processing.ts
// description: Cinematic post-processing pipeline with quality profiles, restrained color grading,
//              HDR bloom, vignette, and a direct-render fallback.
// reference: src/main.ts, src/rendering/quality_manager.ts, src/gameplay/juice.ts

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import type { QualityLevel, QualityPreset } from '../rendering/quality_manager';

const QUALITY_KEY = 'tir.quality.v1';

/**
 * Low is deliberately still a valid profile. QualityManager decides whether the composer should
 * be active for that tier; keeping the profile available is useful for screenshots and debugging.
 */
export type PostProcessingQuality = QualityLevel;

/** Palette-oriented looks shared by the day, dusk, night, aurora, and storm world presets. */
export type CinematicLook = 'day' | 'dusk' | 'night' | 'aurora' | 'storm';

type Rgb = readonly [number, number, number];

/**
 * Values are applied as uniforms, never as shader defines. Switching profiles therefore avoids
 * shader recompilation and can safely happen while a run is active.
 */
export interface PostProcessingProfile {
  readonly id: PostProcessingQuality;
  /** Internal composer resolution relative to the renderer's pixel ratio. */
  readonly render_scale: number;
  readonly bloom_strength: number;
  readonly bloom_radius: number;
  readonly bloom_threshold: number;
  readonly vignette_strength: number;
  readonly contrast: number;
  readonly saturation: number;
  readonly grain_amount: number;
}

interface CinematicLookDefinition {
  readonly exposure: number;
  readonly temperature: number;
  readonly shadow_tint: Rgb;
  readonly highlight_tint: Rgb;
  readonly look_contrast: number;
  readonly look_saturation: number;
  readonly grain_multiplier: number;
}

/**
 * The only quality-dependent cost is render-target resolution and bloom's existing mip chain.
 * Ultra keeps full resolution because it is intended for a desktop GPU; it does not add
 * expensive depth of field or motion blur that would harm ship-control readability.
 */
export const POST_PROCESSING_PROFILES: Readonly<Record<PostProcessingQuality, PostProcessingProfile>> = Object.freeze({
  low: Object.freeze({
    id: 'low',
    render_scale: 0.72,
    bloom_strength: 0.16,
    bloom_radius: 0.42,
    bloom_threshold: 1.08,
    vignette_strength: 0.22,
    contrast: 1.01,
    saturation: 0.94,
    grain_amount: 0,
  }),
  medium: Object.freeze({
    id: 'medium',
    render_scale: 0.8,
    bloom_strength: 0.42,
    bloom_radius: 0.58,
    bloom_threshold: 0.9,
    vignette_strength: 0.31,
    contrast: 1.035,
    saturation: 0.99,
    grain_amount: 0.006,
  }),
  high: Object.freeze({
    id: 'high',
    render_scale: 1,
    bloom_strength: 0.68,
    bloom_radius: 0.72,
    bloom_threshold: 0.76,
    vignette_strength: 0.39,
    contrast: 1.055,
    saturation: 1.035,
    grain_amount: 0.009,
  }),
  ultra: Object.freeze({
    id: 'ultra',
    render_scale: 1,
    bloom_strength: 0.78,
    bloom_radius: 0.8,
    bloom_threshold: 0.68,
    vignette_strength: 0.43,
    contrast: 1.07,
    saturation: 1.055,
    grain_amount: 0.011,
  }),
});

/**
 * Grading occurs in the linear HDR buffer before OutputPass applies the renderer's ACES tone
 * mapping and output color space. Tints are intentionally subtle; the ocean remains legible.
 */
export const CINEMATIC_LOOKS: Readonly<Record<CinematicLook, CinematicLookDefinition>> = Object.freeze({
  day: Object.freeze({
    exposure: 1.01,
    temperature: 0.08,
    shadow_tint: [0.0, 0.018, 0.032] as Rgb,
    highlight_tint: [0.025, 0.015, -0.01] as Rgb,
    look_contrast: 1.0,
    look_saturation: 1.01,
    grain_multiplier: 0.55,
  }),
  dusk: Object.freeze({
    exposure: 0.98,
    temperature: 0.25,
    shadow_tint: [0.012, 0.0, 0.026] as Rgb,
    highlight_tint: [0.052, 0.012, -0.018] as Rgb,
    look_contrast: 1.025,
    look_saturation: 1.035,
    grain_multiplier: 0.7,
  }),
  night: Object.freeze({
    exposure: 0.86,
    temperature: -0.06,
    shadow_tint: [-0.005, 0.014, 0.048] as Rgb,
    highlight_tint: [0.012, 0.022, 0.052] as Rgb,
    look_contrast: 1.04,
    look_saturation: 0.94,
    grain_multiplier: 1.1,
  }),
  aurora: Object.freeze({
    exposure: 0.93,
    temperature: -0.04,
    shadow_tint: [-0.004, 0.022, 0.03] as Rgb,
    highlight_tint: [0.0, 0.05, 0.023] as Rgb,
    look_contrast: 1.035,
    look_saturation: 1.08,
    grain_multiplier: 0.85,
  }),
  storm: Object.freeze({
    exposure: 0.84,
    temperature: -0.12,
    shadow_tint: [-0.012, 0.01, 0.038] as Rgb,
    highlight_tint: [-0.012, 0.015, 0.04] as Rgb,
    look_contrast: 1.095,
    look_saturation: 0.83,
    grain_multiplier: 0.9,
  }),
});

export function is_cinematic_look(value: string): value is CinematicLook {
  return value === 'day' || value === 'dusk' || value === 'night' || value === 'aurora' || value === 'storm';
}

const COLOR_GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    u_exposure: { value: 1 },
    u_contrast: { value: 1 },
    u_saturation: { value: 1 },
    u_temperature: { value: 0 },
    u_shadow_tint: { value: new THREE.Vector3() },
    u_highlight_tint: { value: new THREE.Vector3() },
    u_grain_amount: { value: 0 },
    u_time: { value: 0 },
  },
  vertexShader: [
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform float u_exposure;',
    'uniform float u_contrast;',
    'uniform float u_saturation;',
    'uniform float u_temperature;',
    'uniform vec3 u_shadow_tint;',
    'uniform vec3 u_highlight_tint;',
    'uniform float u_grain_amount;',
    'uniform float u_time;',
    'varying vec2 v_uv;',
    '',
    // Three.js injects its own luminance helper into ShaderPass programs; use a
    // namespaced function so the generated GLSL has no duplicate declaration.
    'float cinematic_luminance(vec3 color) {',
    '  return dot(color, vec3(0.2126, 0.7152, 0.0722));',
    '}',
    '',
    'float interleaved_gradient_noise(vec2 pixel, float frame) {',
    '  vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);',
    '  return fract(magic.z * fract(dot(pixel + frame, magic.xy)));',
    '}',
    '',
    'void main() {',
    '  vec4 source = texture2D(tDiffuse, v_uv);',
    '  vec3 color = max(source.rgb * u_exposure, vec3(0.0));',
    '  float luma = cinematic_luminance(color);',
    '  color = mix(vec3(luma), color, u_saturation);',
    '  color = (color - 0.18) * u_contrast + 0.18;',
    '',
    '  // A small white-balance shift: positive values are warmer, negative values cooler.',
    '  color.r *= 1.0 + u_temperature * 0.085;',
    '  color.b *= 1.0 - u_temperature * 0.085;',
    '',
    '  luma = cinematic_luminance(max(color, vec3(0.0)));',
    '  float shadows = 1.0 - smoothstep(0.03, 0.42, luma);',
    '  float highlights = smoothstep(0.42, 1.45, luma);',
    '  color += u_shadow_tint * shadows + u_highlight_tint * highlights;',
    '',
    '  float grain = interleaved_gradient_noise(gl_FragCoord.xy, u_time) - 0.5;',
    '  color += grain * u_grain_amount;',
    '  gl_FragColor = vec4(max(color, vec3(0.0)), source.a);',
    '}',
  ].join('\n'),
};

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    u_strength: { value: 0.38 },
    u_pulse: { value: 0 },
    u_aspect: { value: 1 },
  },
  vertexShader: [
    'varying vec2 v_uv;',
    'void main() {',
    '  v_uv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}',
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform float u_strength;',
    'uniform float u_pulse;',
    'uniform float u_aspect;',
    'varying vec2 v_uv;',
    'void main() {',
    '  vec4 color = texture2D(tDiffuse, v_uv);',
    '  vec2 centered = (v_uv - 0.5) * vec2(u_aspect, 1.0);',
    '  float edge = smoothstep(0.31, 0.78, length(centered));',
    '  float strength = clamp(u_strength + u_pulse * 0.17, 0.0, 0.9);',
    '  color.rgb *= 1.0 - edge * strength;',
    '  gl_FragColor = color;',
    '}',
  ].join('\n'),
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function initial_viewport_width(): number {
  return typeof window === 'undefined' ? 1 : Math.max(1, Math.floor(window.innerWidth));
}

function initial_viewport_height(): number {
  return typeof window === 'undefined' ? 1 : Math.max(1, Math.floor(window.innerHeight));
}

function copy_rgb(target: THREE.Vector3, source: Rgb): void {
  target.set(source[0], source[1], source[2]);
}

/**
 * A stable EffectComposer pipeline. Its public legacy methods remain available:
 * render(), set_size(), toggle(), and set_quality(boolean). Camel-case aliases are provided for
 * new code and dispose() cleans every pass and its render targets.
 */
export class PostProcessing {
  enabled: boolean;

  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly color_grade: ShaderPass;
  private readonly vignette: ShaderPass;
  private readonly output: OutputPass;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly previous_tone_mapping: THREE.ToneMapping;
  private readonly previous_tone_mapping_exposure: number;

  private profile: PostProcessingProfile = POST_PROCESSING_PROFILES.high;
  private look: CinematicLook = 'dusk';
  private pulse = 0;
  private elapsed_seconds = 0;
  private width = initial_viewport_width();
  private height = initial_viewport_height();
  private renderer_pixel_ratio: number;
  private composer_pixel_ratio = 0;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.renderer_pixel_ratio = Math.max(0.5, renderer.getPixelRatio());

    // ACES is applied by OutputPass in the composer path and by WebGLRenderer in the direct path.
    // Set it once to avoid OutputPass material recompiles while the game is running.
    this.previous_tone_mapping = renderer.toneMapping;
    this.previous_tone_mapping_exposure = renderer.toneMappingExposure;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(this.width, this.height),
      this.profile.bloom_strength,
      this.profile.bloom_radius,
      this.profile.bloom_threshold,
    );
    this.composer.addPass(this.bloom);

    this.color_grade = new ShaderPass(COLOR_GRADE_SHADER);
    this.composer.addPass(this.color_grade);

    this.vignette = new ShaderPass(VIGNETTE_SHADER);
    this.composer.addPass(this.vignette);

    this.output = new OutputPass();
    this.composer.addPass(this.output);

    this.enabled = this.load_quality();
    this.apply_profile_uniforms();
    this.apply_look_uniforms();
    this.refresh_composer_pixel_ratio();
    this.set_size(this.width, this.height);
  }

  /** Current immutable profile data; callers should not mutate it. */
  get current_profile(): Readonly<PostProcessingProfile> {
    return this.profile;
  }

  get current_look(): CinematicLook {
    return this.look;
  }

  private load_quality(): boolean {
    try {
      return localStorage.getItem(QUALITY_KEY) !== 'low';
    } catch {
      return true;
    }
  }

  private refresh_composer_pixel_ratio(): void {
    const requested = clamp(this.renderer_pixel_ratio * this.profile.render_scale, 0.5, 2);
    if (Math.abs(requested - this.composer_pixel_ratio) < 0.001) return;
    this.composer_pixel_ratio = requested;
    this.composer.setPixelRatio(requested);
  }

  private apply_profile_uniforms(): void {
    this.bloom.strength = this.profile.bloom_strength + this.pulse * 0.45;
    this.bloom.radius = this.profile.bloom_radius;
    this.bloom.threshold = this.profile.bloom_threshold;
    this.bloom.enabled = this.bloom.strength > 0.001;

    const uniforms = this.color_grade.uniforms as typeof COLOR_GRADE_SHADER.uniforms;
    uniforms.u_contrast.value = this.profile.contrast;
    uniforms.u_saturation.value = this.profile.saturation;
    uniforms.u_grain_amount.value = this.profile.grain_amount * CINEMATIC_LOOKS[this.look].grain_multiplier;

    const vignette_uniforms = this.vignette.uniforms as typeof VIGNETTE_SHADER.uniforms;
    vignette_uniforms.u_strength.value = this.profile.vignette_strength;
    vignette_uniforms.u_pulse.value = this.pulse;
  }

  private apply_look_uniforms(): void {
    const look = CINEMATIC_LOOKS[this.look];
    const uniforms = this.color_grade.uniforms as typeof COLOR_GRADE_SHADER.uniforms;
    uniforms.u_exposure.value = look.exposure;
    uniforms.u_temperature.value = look.temperature;
    uniforms.u_contrast.value = this.profile.contrast * look.look_contrast;
    uniforms.u_saturation.value = this.profile.saturation * look.look_saturation;
    uniforms.u_grain_amount.value = this.profile.grain_amount * look.grain_multiplier;
    copy_rgb(uniforms.u_shadow_tint.value, look.shadow_tint);
    copy_rgb(uniforms.u_highlight_tint.value, look.highlight_tint);
  }

  /** Legacy toggle used by the in-game Q shortcut. */
  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      // Retain the existing storage contract so old quality choices continue to work.
      localStorage.setItem(QUALITY_KEY, this.enabled ? 'high' : 'low');
    } catch {
      // No persistence available.
    }
    return this.enabled;
  }

  /**
   * Legacy boolean input is preserved. New code can also pass a typed quality level to switch
   * pass parameters without compiling a different shader program.
   */
  set_quality(enabled: boolean): void;
  set_quality(profile: PostProcessingQuality): void;
  set_quality(value: boolean | PostProcessingQuality): void {
    if (typeof value === 'boolean') {
      this.enabled = value;
      return;
    }
    this.set_profile(value);
  }

  set_enabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Applies a profile while keeping the player's explicit post-enabled preference intact. */
  set_profile(profile: PostProcessingQuality | Readonly<PostProcessingProfile>): void {
    const next_profile = typeof profile === 'string' ? POST_PROCESSING_PROFILES[profile] : profile;
    if (this.profile === next_profile) return;
    this.profile = next_profile;
    this.apply_profile_uniforms();
    this.apply_look_uniforms();
    this.refresh_composer_pixel_ratio();
  }

  /**
   * Convenience bridge for QualityManager. A low preset bypasses the composer completely, while
   * medium+ select matching pass settings. Call after QualityManager changes state.
   */
  apply_quality_preset(preset: Pick<QualityPreset, 'id' | 'post_processing'>): void {
    this.set_profile(preset.id);
    this.enabled = preset.post_processing;
  }

  /** Selects a palette-oriented grade; this is an inexpensive uniform update. */
  set_look(look: CinematicLook): void {
    if (this.look === look) return;
    this.look = look;
    this.apply_look_uniforms();
  }

  /** Pulse 0..1 used by slow-mo juice to deepen the vignette and make emissives bloom. */
  set_pulse(pulse: number): void {
    this.pulse = clamp(pulse, 0, 1);
    this.apply_profile_uniforms();
  }

  /**
   * Supplies the renderer DPR after adaptive-quality changes. It changes only composer target
   * size; renderer.setPixelRatio remains owned by the quality manager/main loop.
   */
  set_renderer_pixel_ratio(pixel_ratio: number): void {
    if (!Number.isFinite(pixel_ratio)) return;
    const next_ratio = clamp(pixel_ratio, 0.5, 4);
    if (Math.abs(next_ratio - this.renderer_pixel_ratio) < 0.001) return;
    this.renderer_pixel_ratio = next_ratio;
    this.refresh_composer_pixel_ratio();
  }

  /** Legacy snake-case resize API. */
  set_size(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.composer.setSize(this.width, this.height);
    const uniforms = this.vignette.uniforms as typeof VIGNETTE_SHADER.uniforms;
    uniforms.u_aspect.value = this.width / this.height;
  }

  /** Camel-case resize API for new integrations. */
  setSize(width: number, height: number): void {
    this.set_size(width, height);
  }

  /** Advances optional temporal grain without relying on a new clock or per-frame allocations. */
  update(delta_seconds: number): void {
    if (!Number.isFinite(delta_seconds) || delta_seconds <= 0) return;
    this.elapsed_seconds += Math.min(delta_seconds, 0.1);
  }

  render(delta_seconds = 1 / 60): void {
    this.update(delta_seconds);
    const uniforms = this.color_grade.uniforms as typeof COLOR_GRADE_SHADER.uniforms;
    uniforms.u_time.value = this.elapsed_seconds;

    if (this.enabled) {
      this.composer.render(delta_seconds);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  dispose(): void {
    this.bloom.dispose();
    this.color_grade.dispose();
    this.vignette.dispose();
    this.output.dispose();
    this.composer.dispose();
    this.renderer.toneMapping = this.previous_tone_mapping;
    this.renderer.toneMappingExposure = this.previous_tone_mapping_exposure;
  }
}
