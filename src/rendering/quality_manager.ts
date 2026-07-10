// file: src/rendering/quality_manager.ts
// description: Typed rendering-quality policy, conservative device heuristics, and allocation-free adaptive DPR.
// reference: GAME_PLAN_V2.md, src/core/post_processing.ts

/** Ordered from the most conservative to the most expensive renderer configuration. */
export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

/** A persisted choice may also delegate the initial quality to the device heuristic. */
export type QualityOverride = QualityLevel | 'auto';

export const QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const;

/**
 * A renderer-facing quality description. The values deliberately describe capability,
 * rather than any specific Three.js implementation, so subsystems can adopt it independently.
 */
export interface QualityPreset {
  readonly id: QualityLevel;
  readonly label: string;
  readonly ocean_segments: number;
  readonly ocean_ring_count: number;
  readonly wave_count: number;
  readonly normal_detail_layers: number;
  readonly reflection_scale: number;
  readonly reflection_update_interval: number;
  readonly interaction_resolution: number;
  readonly particle_count: number;
  readonly max_pixel_ratio: number;
  readonly min_pixel_ratio: number;
  readonly target_frame_ms: number;
  readonly post_processing: boolean;
  readonly planar_reflections: boolean;
  readonly refraction: boolean;
  readonly screen_space_reflections: boolean;
  readonly gpu_spectral_ocean: boolean;
}

/**
 * Frozen, shared presets. They are safe to pass by reference: callers must treat them as readonly.
 * Pixel-ratio bounds are absolute renderer pixel ratios, not multipliers of devicePixelRatio.
 */
export const QUALITY_PRESETS: Readonly<Record<QualityLevel, QualityPreset>> = Object.freeze({
  low: Object.freeze({
    id: 'low',
    label: 'Low',
    ocean_segments: 96,
    ocean_ring_count: 2,
    wave_count: 3,
    normal_detail_layers: 1,
    reflection_scale: 0,
    reflection_update_interval: 0,
    interaction_resolution: 0,
    particle_count: 96,
    max_pixel_ratio: 1,
    min_pixel_ratio: 0.75,
    target_frame_ms: 33.333,
    post_processing: false,
    planar_reflections: false,
    refraction: false,
    screen_space_reflections: false,
    gpu_spectral_ocean: false,
  }),
  medium: Object.freeze({
    id: 'medium',
    label: 'Medium',
    ocean_segments: 144,
    ocean_ring_count: 3,
    wave_count: 4,
    normal_detail_layers: 2,
    reflection_scale: 0.5,
    reflection_update_interval: 4,
    interaction_resolution: 256,
    particle_count: 300,
    max_pixel_ratio: 1.25,
    min_pixel_ratio: 0.75,
    target_frame_ms: 25,
    post_processing: true,
    planar_reflections: true,
    refraction: false,
    screen_space_reflections: false,
    gpu_spectral_ocean: false,
  }),
  high: Object.freeze({
    id: 'high',
    label: 'High',
    ocean_segments: 192,
    ocean_ring_count: 4,
    wave_count: 6,
    normal_detail_layers: 2,
    reflection_scale: 0.5,
    reflection_update_interval: 2,
    interaction_resolution: 512,
    particle_count: 700,
    max_pixel_ratio: 1.5,
    min_pixel_ratio: 0.75,
    target_frame_ms: 16.667,
    post_processing: true,
    planar_reflections: true,
    refraction: true,
    screen_space_reflections: false,
    gpu_spectral_ocean: false,
  }),
  ultra: Object.freeze({
    id: 'ultra',
    label: 'Ultra',
    ocean_segments: 256,
    ocean_ring_count: 5,
    wave_count: 8,
    normal_detail_layers: 2,
    reflection_scale: 0.75,
    reflection_update_interval: 1,
    interaction_resolution: 512,
    particle_count: 1400,
    max_pixel_ratio: 1.5,
    min_pixel_ratio: 0.85,
    target_frame_ms: 16.667,
    post_processing: true,
    planar_reflections: true,
    refraction: true,
    screen_space_reflections: true,
    gpu_spectral_ocean: true,
  }),
});

export interface QualityCapabilities {
  /** 0 means no supplied context was available to inspect, rather than WebGL being unsupported. */
  readonly webgl_version: 0 | 1 | 2;
  readonly max_texture_size: number;
  readonly max_renderbuffer_size: number;
  readonly max_samples: number;
  readonly hardware_concurrency: number;
  /** Device Memory API value in GiB, or null when the browser withholds it. */
  readonly device_memory_gb: number | null;
  readonly native_pixel_ratio: number;
  readonly screen_pixels: number;
  readonly is_mobile: boolean;
  readonly prefers_reduced_motion: boolean;
  readonly prefers_reduced_data: boolean;
  readonly renderer: string | null;
  readonly is_integrated_gpu: boolean;
  readonly is_discrete_gpu: boolean;
  readonly supports_timer_query: boolean;
}

export interface QualityState {
  readonly level: QualityLevel;
  readonly override: QualityOverride;
  readonly preset: QualityPreset;
  readonly pixel_ratio: number;
  readonly adaptive_pixel_ratio: boolean;
  readonly average_frame_ms: number;
}

interface MutableQualityState {
  level: QualityLevel;
  override: QualityOverride;
  preset: QualityPreset;
  pixel_ratio: number;
  adaptive_pixel_ratio: boolean;
  average_frame_ms: number;
}

export interface PixelRatioTarget {
  setPixelRatio(pixel_ratio: number): void;
}

export interface QualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface QualityManagerOptions {
  /** Defaults to the existing quality preference key so current low/high choices remain valid. */
  readonly storage_key?: string;
  readonly storage?: QualityStorage | null;
  readonly capabilities?: QualityCapabilities;
  readonly gl?: WebGLRenderingContext | WebGL2RenderingContext | null;
  readonly native_pixel_ratio?: number;
  readonly adaptive_pixel_ratio?: boolean;
  /** Used only when there is no persisted manual override. */
  readonly initial_quality?: QualityLevel;
  /** Receives the stable state object; do not retain it as a historical snapshot. */
  readonly on_change?: (state: Readonly<QualityState>) => void;
}

interface DeviceMemoryNavigator extends Navigator {
  readonly deviceMemory?: number;
}

interface DebugRendererInfo {
  readonly UNMASKED_VENDOR_WEBGL: number;
  readonly UNMASKED_RENDERER_WEBGL: number;
}

const DEFAULT_STORAGE_KEY = 'tir.quality.v1';
const DPR_STEP = 0.05;
const ADAPTIVE_COOLDOWN_MS = 1250;
const SLOW_HYSTERESIS_MS = 1400;
const FAST_HYSTERESIS_MS = 4800;
const SLOW_THRESHOLD = 1.12;
const FAST_THRESHOLD = 0.78;

function browser_window(): Window | null {
  return typeof window === 'undefined' ? null : window;
}

function browser_navigator(): Navigator | null {
  return typeof navigator === 'undefined' ? null : navigator;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function finite_or(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function media_matches(query: string): boolean {
  const current_window = browser_window();
  if (current_window === null || typeof current_window.matchMedia !== 'function') return false;
  try {
    return current_window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

function is_webgl2_context(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) return true;
  try {
    return String(gl.getParameter(gl.VERSION)).includes('WebGL 2');
  } catch {
    return false;
  }
}

function inspect_renderer(gl: WebGLRenderingContext | WebGL2RenderingContext | null): string | null {
  if (gl === null) return null;
  try {
    const extension = gl.getExtension('WEBGL_debug_renderer_info') as unknown as DebugRendererInfo | null;
    if (extension === null) return null;
    const renderer = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && renderer.length > 0 ? renderer : null;
  } catch {
    return null;
  }
}

/**
 * Collects only broadly available, privacy-preserving browser hints. Pass the app's rendering
 * context when available for a more accurate recommendation; this function never creates one.
 */
export function detect_quality_capabilities(
  gl: WebGLRenderingContext | WebGL2RenderingContext | null = null,
): QualityCapabilities {
  const current_window = browser_window();
  const current_navigator = browser_navigator();
  const navigator_with_memory = current_navigator as DeviceMemoryNavigator | null;
  const user_agent = current_navigator?.userAgent ?? '';
  const max_touch_points = current_navigator?.maxTouchPoints ?? 0;
  const screen_width = current_window?.screen?.width ?? 0;
  const screen_height = current_window?.screen?.height ?? 0;
  const renderer = inspect_renderer(gl);
  const renderer_lower = renderer?.toLowerCase() ?? '';
  const mobile_user_agent = /android|iphone|ipad|ipod|mobile|silk|kindle/i.test(user_agent);
  const touch_small_screen = max_touch_points > 1 && Math.min(screen_width, screen_height) > 0 && Math.min(screen_width, screen_height) < 900;
  const is_mobile = mobile_user_agent || touch_small_screen;
  const is_integrated_gpu = /intel|apple gpu|mali|adreno|powervr|swiftshader|llvmpipe/i.test(renderer_lower);
  const is_discrete_gpu = /nvidia|geforce|radeon|amd|arc/i.test(renderer_lower) && !is_integrated_gpu;

  let webgl_version: 0 | 1 | 2 = 0;
  let max_texture_size = 0;
  let max_renderbuffer_size = 0;
  let max_samples = 0;
  let supports_timer_query = false;

  if (gl !== null) {
    const webgl2 = is_webgl2_context(gl);
    webgl_version = webgl2 ? 2 : 1;
    try {
      max_texture_size = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
      max_renderbuffer_size = Number(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)) || 0;
      max_samples = webgl2 ? Number((gl as WebGL2RenderingContext).getParameter((gl as WebGL2RenderingContext).MAX_SAMPLES)) || 0 : 0;
      supports_timer_query = webgl2 && (gl as WebGL2RenderingContext).getExtension('EXT_disjoint_timer_query_webgl2') !== null;
    } catch {
      // Driver information is optional. The remaining browser hints are still useful.
    }
  }

  const reported_memory = navigator_with_memory?.deviceMemory;
  const device_memory_gb = reported_memory !== undefined && Number.isFinite(reported_memory) ? reported_memory : null;
  const native_pixel_ratio = clamp(finite_or(current_window?.devicePixelRatio, 1), 0.5, 4);

  return {
    webgl_version,
    max_texture_size,
    max_renderbuffer_size,
    max_samples,
    hardware_concurrency: Math.max(1, current_navigator?.hardwareConcurrency ?? 4),
    device_memory_gb,
    native_pixel_ratio,
    screen_pixels: Math.max(0, screen_width * screen_height),
    is_mobile,
    prefers_reduced_motion: media_matches('(prefers-reduced-motion: reduce)'),
    prefers_reduced_data: media_matches('(prefers-reduced-data: reduce)'),
    renderer,
    is_integrated_gpu,
    is_discrete_gpu,
    supports_timer_query,
  };
}

/** Returns the deterministic automatic starting level for the supplied hardware profile. */
export function recommend_quality(capabilities: QualityCapabilities): QualityLevel {
  if (capabilities.prefers_reduced_motion || capabilities.prefers_reduced_data || capabilities.is_mobile) return 'low';

  let score = 0;
  if (capabilities.webgl_version === 2) score += 2;
  else if (capabilities.webgl_version === 1) score += 1;

  if (capabilities.hardware_concurrency >= 8) score += 2;
  else if (capabilities.hardware_concurrency >= 6) score += 1;
  else if (capabilities.hardware_concurrency <= 4) score -= 2;

  if (capabilities.device_memory_gb !== null) {
    if (capabilities.device_memory_gb >= 8) score += 2;
    else if (capabilities.device_memory_gb >= 4) score += 1;
    else if (capabilities.device_memory_gb <= 2) score -= 2;
  }

  if (capabilities.max_texture_size >= 8192) score += 1;
  else if (capabilities.max_texture_size > 0 && capabilities.max_texture_size < 4096) score -= 2;

  if (capabilities.max_samples >= 4) score += 1;
  if (capabilities.is_discrete_gpu) score += 2;
  if (capabilities.is_integrated_gpu) score -= 1;
  if (capabilities.screen_pixels > 7_000_000) score -= 1;

  const can_use_ultra =
    capabilities.webgl_version === 2 &&
    capabilities.is_discrete_gpu &&
    capabilities.hardware_concurrency >= 8 &&
    (capabilities.device_memory_gb === null || capabilities.device_memory_gb >= 8) &&
    score >= 7;

  if (can_use_ultra) return 'ultra';
  if (score >= 3) return 'high';
  if (score <= -1) return 'low';
  return 'medium';
}

export function is_quality_level(value: string): value is QualityLevel {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'ultra';
}

function get_default_storage(): QualityStorage | null {
  const current_window = browser_window();
  if (current_window === null) return null;
  try {
    return current_window.localStorage;
  } catch {
    return null;
  }
}

function read_override(storage: QualityStorage | null, key: string): QualityOverride {
  if (storage === null) return 'auto';
  try {
    const value = storage.getItem(key);
    return value === 'auto' || (value !== null && is_quality_level(value)) ? value : 'auto';
  } catch {
    return 'auto';
  }
}

/**
 * Coordinates renderer-independent quality choices. Call update(frame_ms) once each frame, then
 * apply_pixel_ratio(renderer) only when it returns true. No object or array is allocated per frame.
 */
export class QualityManager {
  readonly capabilities: QualityCapabilities;
  readonly state: QualityState;

  private readonly storage_key: string;
  private readonly storage: QualityStorage | null;
  private readonly on_change: ((state: Readonly<QualityState>) => void) | null;
  private readonly native_pixel_ratio: number;
  private level: QualityLevel;
  private override: QualityOverride;
  private adaptive_pixel_ratio: boolean;
  private pixel_ratio: number;
  private average_frame_ms = 0;
  private slow_frame_time_ms = 0;
  private fast_frame_time_ms = 0;
  private cooldown_ms = 0;
  private readonly mutable_state: MutableQualityState;

  constructor(options: QualityManagerOptions = {}) {
    this.storage_key = options.storage_key ?? DEFAULT_STORAGE_KEY;
    this.storage = options.storage === undefined ? get_default_storage() : options.storage;
    this.capabilities = options.capabilities ?? detect_quality_capabilities(options.gl ?? null);
    this.native_pixel_ratio = clamp(
      finite_or(options.native_pixel_ratio, this.capabilities.native_pixel_ratio),
      0.5,
      4,
    );
    this.override = read_override(this.storage, this.storage_key);
    this.level = this.override === 'auto' ? options.initial_quality ?? recommend_quality(this.capabilities) : this.override;
    this.adaptive_pixel_ratio = options.adaptive_pixel_ratio ?? true;
    this.pixel_ratio = this.maximum_pixel_ratio_for(QUALITY_PRESETS[this.level]);
    this.on_change = options.on_change ?? null;
    this.mutable_state = {
      level: this.level,
      override: this.override,
      preset: QUALITY_PRESETS[this.level],
      pixel_ratio: this.pixel_ratio,
      adaptive_pixel_ratio: this.adaptive_pixel_ratio,
      average_frame_ms: this.average_frame_ms,
    };
    this.state = this.mutable_state;
  }

  get preset(): QualityPreset {
    return QUALITY_PRESETS[this.level];
  }

  get current_level(): QualityLevel {
    return this.level;
  }

  get current_override(): QualityOverride {
    return this.override;
  }

  get current_pixel_ratio(): number {
    return this.pixel_ratio;
  }

  /** Applies the current ratio without assuming a Three.js renderer at compile time. */
  apply_pixel_ratio(target: PixelRatioTarget): void {
    target.setPixelRatio(this.pixel_ratio);
  }

  /** Selects a manual level, or auto to use the current capability recommendation. */
  set_override(next_override: QualityOverride, persist = true): boolean {
    const next_level = next_override === 'auto' ? recommend_quality(this.capabilities) : next_override;
    const override_changed = next_override !== this.override;
    const level_changed = next_level !== this.level;
    if (!override_changed && !level_changed) return false;

    this.override = next_override;
    this.level = next_level;
    this.reset_adaptive_pixel_ratio();
    if (persist) this.persist_override();
    this.sync_state();
    this.notify_change();
    return true;
  }

  set_quality(level: QualityLevel, persist = true): boolean {
    return this.set_override(level, persist);
  }

  /** Removes a manual choice and reverts to automatic selection. */
  clear_override(): boolean {
    const changed = this.set_override('auto', false);
    if (this.storage !== null) {
      try {
        if (this.storage.removeItem !== undefined) this.storage.removeItem(this.storage_key);
        else this.storage.setItem(this.storage_key, 'auto');
      } catch {
        // Storage may be disabled by the browser or embedding page.
      }
    }
    return changed;
  }

  set_adaptive_pixel_ratio(enabled: boolean): boolean {
    if (enabled === this.adaptive_pixel_ratio) return false;
    this.adaptive_pixel_ratio = enabled;
    this.reset_adaptive_counters();
    this.sync_state();
    this.notify_change();
    return true;
  }

  /**
   * Feeds one real frame duration into the DPR controller. It returns true only when the renderer
   * needs setPixelRatio called. A sustained 12% budget miss drops DPR after 1.4s; sustained 22%
   * headroom raises it after 4.8s, with a cooldown to prevent visible oscillation.
   */
  update(frame_ms: number): boolean {
    if (!this.adaptive_pixel_ratio || !Number.isFinite(frame_ms) || frame_ms <= 0) return false;

    const bounded_frame_ms = clamp(frame_ms, 0.25, 250);
    this.average_frame_ms = this.average_frame_ms === 0
      ? bounded_frame_ms
      : this.average_frame_ms + (bounded_frame_ms - this.average_frame_ms) * 0.075;

    if (this.cooldown_ms > 0) {
      this.cooldown_ms = Math.max(0, this.cooldown_ms - bounded_frame_ms);
      this.sync_state();
      return false;
    }

    const target_frame_ms = this.preset.target_frame_ms;
    if (this.average_frame_ms > target_frame_ms * SLOW_THRESHOLD) {
      this.slow_frame_time_ms += bounded_frame_ms;
      this.fast_frame_time_ms = Math.max(0, this.fast_frame_time_ms - bounded_frame_ms * 2);
    } else if (this.average_frame_ms < target_frame_ms * FAST_THRESHOLD) {
      this.fast_frame_time_ms += bounded_frame_ms;
      this.slow_frame_time_ms = Math.max(0, this.slow_frame_time_ms - bounded_frame_ms * 2);
    } else {
      this.slow_frame_time_ms = Math.max(0, this.slow_frame_time_ms - bounded_frame_ms);
      this.fast_frame_time_ms = Math.max(0, this.fast_frame_time_ms - bounded_frame_ms);
    }

    let changed = false;
    if (this.slow_frame_time_ms >= SLOW_HYSTERESIS_MS) {
      changed = this.set_pixel_ratio(this.pixel_ratio - DPR_STEP);
    } else if (this.fast_frame_time_ms >= FAST_HYSTERESIS_MS) {
      changed = this.set_pixel_ratio(this.pixel_ratio + DPR_STEP);
    }

    this.sync_state();
    if (changed) this.notify_change();
    return changed;
  }

  /** Resets to the highest DPR allowed by the selected quality level. */
  reset_adaptive_pixel_ratio(): void {
    this.pixel_ratio = this.maximum_pixel_ratio_for(this.preset);
    this.reset_adaptive_counters();
  }

  private set_pixel_ratio(next_ratio: number): boolean {
    const preset = this.preset;
    const minimum = Math.min(preset.min_pixel_ratio, this.maximum_pixel_ratio_for(preset));
    const maximum = this.maximum_pixel_ratio_for(preset);
    const rounded = Math.round(clamp(next_ratio, minimum, maximum) * 100) / 100;
    if (Math.abs(rounded - this.pixel_ratio) < 0.001) {
      this.reset_adaptive_counters();
      return false;
    }
    this.pixel_ratio = rounded;
    this.reset_adaptive_counters();
    this.cooldown_ms = ADAPTIVE_COOLDOWN_MS;
    return true;
  }

  private maximum_pixel_ratio_for(preset: QualityPreset): number {
    return Math.min(preset.max_pixel_ratio, this.native_pixel_ratio);
  }

  private reset_adaptive_counters(): void {
    this.slow_frame_time_ms = 0;
    this.fast_frame_time_ms = 0;
    this.cooldown_ms = 0;
  }

  private persist_override(): void {
    if (this.storage === null) return;
    try {
      this.storage.setItem(this.storage_key, this.override);
    } catch {
      // Storage may be disabled by the browser or embedding page.
    }
  }

  private sync_state(): void {
    this.mutable_state.level = this.level;
    this.mutable_state.override = this.override;
    this.mutable_state.preset = this.preset;
    this.mutable_state.pixel_ratio = this.pixel_ratio;
    this.mutable_state.adaptive_pixel_ratio = this.adaptive_pixel_ratio;
    this.mutable_state.average_frame_ms = this.average_frame_ms;
  }

  private notify_change(): void {
    if (this.on_change !== null) this.on_change(this.state);
  }
}
