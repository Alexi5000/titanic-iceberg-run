// file: src/rendering/performance_overlay.ts
// description: Dependency-free DOM rendering telemetry, texture-memory estimates, and optional WebGL2 pass timing.
// reference: src/rendering/quality_manager.ts, GAME_PLAN_V2.md

export interface RendererMetricsSource {
  readonly info?: {
    readonly render?: {
      readonly calls?: number;
      readonly triangles?: number;
    };
    readonly memory?: {
      readonly textures?: number;
    };
  };
}

export interface TextureMemoryDescription {
  readonly width: number;
  readonly height: number;
  readonly depth?: number;
  readonly layers?: number;
  readonly bytes_per_pixel?: number;
  readonly mipmaps?: boolean;
}

export interface PerformanceMetrics {
  fps: number;
  frame_ms: number;
  draw_calls: number;
  triangles: number;
  texture_count: number;
  texture_memory_bytes: number;
  reflection_ms: number;
  ocean_ms: number;
}

export interface GpuPassTimings {
  supported: boolean;
  reflection_ms: number;
  ocean_ms: number;
}

export interface PerformanceOverlayOptions {
  readonly parent?: HTMLElement;
  readonly document?: Document;
  readonly renderer?: RendererMetricsSource | null;
  readonly gpu_timer?: GpuPassTimer | null;
  readonly visible?: boolean;
  /** Display refresh cadence; sampling remains per-frame. */
  readonly update_interval_ms?: number;
}

interface TimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

interface QuerySlot {
  readonly query: WebGLQuery;
  pending: boolean;
}

interface PassTimerState {
  readonly slots: QuerySlot[];
  write_index: number;
  active_index: number;
}

const QUERY_RING_SIZE = 4;
const UNKNOWN_TIME = Number.NaN;

function clamp_non_negative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function browser_document(): Document | null {
  return typeof document === 'undefined' ? null : document;
}

function debug_overlay_requested(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const debug = new URLSearchParams(window.location.search).get('debug');
    return debug === 'perf' || debug === 'performance' || debug === 'all';
  } catch {
    return false;
  }
}

function format_number(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : '--';
}

function format_decimal(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '--';
}

/** Estimates complete texture allocation, including the 4/3 mip chain when requested. */
export function estimate_texture_memory_bytes(description: TextureMemoryDescription): number {
  const width = Math.max(1, Math.floor(description.width));
  const height = Math.max(1, Math.floor(description.height));
  const depth = Math.max(1, Math.floor(description.depth ?? 1));
  const layers = Math.max(1, Math.floor(description.layers ?? 1));
  const bytes_per_pixel = Math.max(1, description.bytes_per_pixel ?? 4);
  const mip_multiplier = description.mipmaps === false ? 1 : 4 / 3;
  return Math.ceil(width * height * depth * layers * bytes_per_pixel * mip_multiplier);
}

/**
 * Lightweight WebGL2 elapsed-time query ring. It never blocks for results and returns NaN until
 * the driver makes a sample available. Instrument non-overlapping passes with begin/end methods.
 */
export class GpuPassTimer {
  readonly timings: GpuPassTimings;

  private readonly gl: WebGL2RenderingContext;
  private readonly extension: TimerQueryExtension;
  private readonly reflection: PassTimerState;
  private readonly ocean: PassTimerState;
  private active_pass = 0;

  constructor(gl: WebGL2RenderingContext) {
    const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2') as unknown as TimerQueryExtension | null;
    if (extension === null) throw new Error('EXT_disjoint_timer_query_webgl2 is not available');

    this.gl = gl;
    this.extension = extension;
    this.reflection = this.create_pass_state();
    this.ocean = this.create_pass_state();
    this.timings = {
      supported: true,
      reflection_ms: UNKNOWN_TIME,
      ocean_ms: UNKNOWN_TIME,
    };
  }

  begin_reflection(): boolean {
    return this.begin_pass(this.reflection, 1);
  }

  end_reflection(): void {
    this.end_pass(this.reflection, 1);
  }

  begin_ocean(): boolean {
    return this.begin_pass(this.ocean, 2);
  }

  end_ocean(): void {
    this.end_pass(this.ocean, 2);
  }

  /** Poll once per frame after rendering. Query results are delayed but never stall the CPU. */
  poll(): void {
    let disjoint = false;
    try {
      disjoint = Boolean(this.gl.getParameter(this.extension.GPU_DISJOINT_EXT));
    } catch {
      return;
    }

    if (disjoint) {
      this.clear_pending(this.reflection);
      this.clear_pending(this.ocean);
      this.timings.reflection_ms = UNKNOWN_TIME;
      this.timings.ocean_ms = UNKNOWN_TIME;
      return;
    }

    this.poll_pass(this.reflection, true);
    this.poll_pass(this.ocean, false);
  }

  dispose(): void {
    this.dispose_pass(this.reflection);
    this.dispose_pass(this.ocean);
    this.timings.supported = false;
  }

  private create_pass_state(): PassTimerState {
    const slots: QuerySlot[] = new Array(QUERY_RING_SIZE);
    for (let index = 0; index < QUERY_RING_SIZE; index += 1) {
      const query = this.gl.createQuery();
      if (query === null) {
        for (let previous = 0; previous < index; previous += 1) this.gl.deleteQuery(slots[previous].query);
        throw new Error('Unable to create a WebGL timer query');
      }
      slots[index] = { query, pending: false };
    }
    return { slots, write_index: 0, active_index: -1 };
  }

  private begin_pass(state: PassTimerState, pass_id: number): boolean {
    if (this.active_pass !== 0 || state.active_index !== -1) return false;
    const index = state.write_index;
    const slot = state.slots[index];
    if (slot.pending) return false;
    try {
      this.gl.beginQuery(this.extension.TIME_ELAPSED_EXT, slot.query);
      state.active_index = index;
      this.active_pass = pass_id;
      return true;
    } catch {
      return false;
    }
  }

  private end_pass(state: PassTimerState, pass_id: number): void {
    if (this.active_pass !== pass_id || state.active_index === -1) return;
    try {
      this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);
      state.slots[state.active_index].pending = true;
      state.write_index = (state.active_index + 1) % QUERY_RING_SIZE;
    } catch {
      // A lost context cannot produce a useful timing sample.
    }
    state.active_index = -1;
    this.active_pass = 0;
  }

  private poll_pass(state: PassTimerState, reflection: boolean): void {
    for (let index = 0; index < QUERY_RING_SIZE; index += 1) {
      const slot = state.slots[index];
      if (!slot.pending) continue;
      let available = false;
      try {
        available = Boolean(this.gl.getQueryParameter(slot.query, this.gl.QUERY_RESULT_AVAILABLE));
      } catch {
        slot.pending = false;
        continue;
      }
      if (!available) continue;
      try {
        const elapsed_ns = Number(this.gl.getQueryParameter(slot.query, this.gl.QUERY_RESULT));
        const elapsed_ms = Number.isFinite(elapsed_ns) ? elapsed_ns / 1_000_000 : UNKNOWN_TIME;
        if (reflection) this.timings.reflection_ms = elapsed_ms;
        else this.timings.ocean_ms = elapsed_ms;
      } catch {
        if (reflection) this.timings.reflection_ms = UNKNOWN_TIME;
        else this.timings.ocean_ms = UNKNOWN_TIME;
      }
      slot.pending = false;
    }
  }

  private clear_pending(state: PassTimerState): void {
    for (let index = 0; index < QUERY_RING_SIZE; index += 1) state.slots[index].pending = false;
  }

  private dispose_pass(state: PassTimerState): void {
    for (let index = 0; index < QUERY_RING_SIZE; index += 1) this.gl.deleteQuery(state.slots[index].query);
  }
}

/**
 * A compact DOM overlay. It keeps a stable metrics object and only formats DOM strings at the
 * configured display cadence, so calling update(frame_ms) each frame creates no JS containers.
 */
export class PerformanceOverlay {
  readonly element: HTMLDivElement;
  readonly metrics: PerformanceMetrics = {
    fps: 0,
    frame_ms: 0,
    draw_calls: 0,
    triangles: 0,
    texture_count: 0,
    texture_memory_bytes: -1,
    reflection_ms: UNKNOWN_TIME,
    ocean_ms: UNKNOWN_TIME,
  };

  private readonly fps_value: Text;
  private readonly frame_value: Text;
  private readonly draws_value: Text;
  private readonly triangles_value: Text;
  private readonly textures_value: Text;
  private readonly reflection_value: Text;
  private readonly ocean_value: Text;
  private readonly update_interval_ms: number;
  private renderer: RendererMetricsSource | null;
  private gpu_timer: GpuPassTimer | null;
  private visible: boolean;
  private frame_count = 0;
  private accumulated_frame_ms = 0;

  constructor(options: PerformanceOverlayOptions = {}) {
    const current_document = options.document ?? browser_document();
    const parent = options.parent ?? current_document?.body;
    if (current_document === null || parent === null || parent === undefined) {
      throw new Error('PerformanceOverlay requires a browser document and parent element');
    }

    this.renderer = options.renderer ?? null;
    this.gpu_timer = options.gpu_timer ?? null;
    this.visible = options.visible ?? debug_overlay_requested();
    this.update_interval_ms = Math.max(100, options.update_interval_ms ?? 250);

    const panel = current_document.createElement('div');
    panel.setAttribute('aria-live', 'off');
    panel.setAttribute('aria-label', 'Rendering performance');
    panel.style.cssText =
      'position:fixed;top:10px;right:10px;z-index:1000;min-width:174px;padding:9px 11px;' +
      'background:rgba(3,10,17,.84);border:1px solid rgba(116,196,219,.45);border-radius:7px;' +
      'box-shadow:0 5px 20px rgba(0,0,0,.35);color:#d9f2f9;font:11px/1.55 ui-monospace,SFMono-Regular,Consolas,monospace;' +
      'letter-spacing:.01em;pointer-events:none;user-select:none;white-space:nowrap;';
    panel.hidden = !this.visible;
    this.element = panel;

    this.fps_value = this.append_row(current_document, panel, 'FPS', '--');
    this.frame_value = this.append_row(current_document, panel, 'Frame', '-- ms');
    this.draws_value = this.append_row(current_document, panel, 'Draws', '--');
    this.triangles_value = this.append_row(current_document, panel, 'Triangles', '--');
    this.textures_value = this.append_row(current_document, panel, 'Textures', '--');
    this.reflection_value = this.append_row(current_document, panel, 'Reflection', '-- ms');
    this.ocean_value = this.append_row(current_document, panel, 'Ocean', '-- ms');
    parent.appendChild(panel);
  }

  set_visible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.element.hidden = !visible;
    if (visible) this.refresh_display();
  }

  get is_visible(): boolean {
    return this.visible;
  }

  set_renderer(renderer: RendererMetricsSource | null): void {
    this.renderer = renderer;
  }

  set_gpu_timer(timer: GpuPassTimer | null): void {
    this.gpu_timer = timer;
  }

  set_texture_memory_bytes(bytes: number, texture_count = -1): void {
    this.metrics.texture_memory_bytes = clamp_non_negative(bytes, -1);
    if (texture_count >= 0) this.metrics.texture_count = Math.floor(texture_count);
  }

  set_pass_times(reflection_ms: number, ocean_ms: number): void {
    this.metrics.reflection_ms = clamp_non_negative(reflection_ms, UNKNOWN_TIME);
    this.metrics.ocean_ms = clamp_non_negative(ocean_ms, UNKNOWN_TIME);
  }

  /** Call after the renderer has completed a frame. */
  update(frame_ms: number): void {
    const bounded_frame_ms = clamp_non_negative(frame_ms, 0);
    if (bounded_frame_ms <= 0) return;

    this.frame_count += 1;
    this.accumulated_frame_ms += Math.min(bounded_frame_ms, 250);
    this.sample_renderer();
    this.sample_gpu_timer();

    if (this.accumulated_frame_ms < this.update_interval_ms) return;
    this.metrics.frame_ms = this.accumulated_frame_ms / this.frame_count;
    this.metrics.fps = 1000 / this.metrics.frame_ms;
    this.frame_count = 0;
    this.accumulated_frame_ms = 0;
    if (this.visible) this.refresh_display();
  }

  /** Removes the overlay from the DOM. The caller owns an attached GpuPassTimer. */
  dispose(): void {
    this.element.remove();
    this.renderer = null;
    this.gpu_timer = null;
  }

  private append_row(current_document: Document, panel: HTMLElement, label: string, initial_value: string): Text {
    const row = current_document.createElement('div');
    const name = current_document.createElement('span');
    const value = current_document.createTextNode(initial_value);
    name.textContent = `${label}: `;
    name.style.color = '#83bac9';
    row.append(name, value);
    panel.appendChild(row);
    return value;
  }

  private sample_renderer(): void {
    const info = this.renderer?.info;
    if (info === undefined) return;
    const render = info.render;
    if (render !== undefined) {
      if (render.calls !== undefined) this.metrics.draw_calls = clamp_non_negative(render.calls, 0);
      if (render.triangles !== undefined) this.metrics.triangles = clamp_non_negative(render.triangles, 0);
    }
    const memory = info.memory;
    if (memory?.textures !== undefined) this.metrics.texture_count = clamp_non_negative(memory.textures, 0);
  }

  private sample_gpu_timer(): void {
    if (this.gpu_timer === null) return;
    this.gpu_timer.poll();
    this.metrics.reflection_ms = this.gpu_timer.timings.reflection_ms;
    this.metrics.ocean_ms = this.gpu_timer.timings.ocean_ms;
  }

  private refresh_display(): void {
    this.fps_value.data = format_decimal(this.metrics.fps);
    this.frame_value.data = `${format_decimal(this.metrics.frame_ms)} ms`;
    this.draws_value.data = format_number(this.metrics.draw_calls);
    this.triangles_value.data = format_number(this.metrics.triangles);
    this.textures_value.data = this.format_texture_memory();
    this.reflection_value.data = `${format_decimal(this.metrics.reflection_ms)} ms`;
    this.ocean_value.data = `${format_decimal(this.metrics.ocean_ms)} ms`;
  }

  private format_texture_memory(): string {
    const bytes = this.metrics.texture_memory_bytes;
    const count = this.metrics.texture_count;
    if (!Number.isFinite(bytes) || bytes < 0) return count > 0 ? `-- (${format_number(count)})` : '--';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB (${format_number(count)})`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB (${format_number(count)})`;
  }
}
