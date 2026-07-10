// file: src/ocean/ocean_debug_gui.ts
// description: Dependency-free, query-gated authoring panel for the reusable ocean component.
// reference: src/ocean/ocean_surface.ts, src/main.ts

import { OceanSurface } from './ocean_surface';
import { OceanQualityId, OceanWeatherId, OCEAN_QUALITY_PRESETS, OCEAN_WEATHER_PRESETS } from './wave_spectrum';

export interface OceanDebugGuiOptions {
  readonly parent: HTMLElement;
  readonly ocean: OceanSurface;
  readonly quality_id: OceanQualityId;
  readonly weather_id: OceanWeatherId;
  readonly on_quality_change: (quality: OceanQualityId) => void;
  readonly on_weather_change: (weather: OceanWeatherId) => void;
}

interface RangeControl {
  readonly input: HTMLInputElement;
  readonly value: Text;
}

function debug_gui_requested(): boolean {
  try {
    const value = new URLSearchParams(window.location.search).get('debug');
    return value === 'ocean' || value === 'all';
  } catch {
    return false;
  }
}

function create_row(document_ref: Document, parent: HTMLElement, label: string): HTMLElement {
  const row = document_ref.createElement('label');
  row.style.cssText = 'display:grid;grid-template-columns:74px 1fr 42px;gap:6px;align-items:center;margin:5px 0;color:#c8e8f1;';
  const caption = document_ref.createElement('span');
  caption.textContent = label;
  caption.style.color = '#7ebbc9';
  row.appendChild(caption);
  parent.appendChild(row);
  return row;
}

function create_range(
  document_ref: Document,
  parent: HTMLElement,
  label: string,
  minimum: number,
  maximum: number,
  step: number,
  initial: number,
  on_change: (value: number) => void,
): RangeControl {
  const row = create_row(document_ref, parent, label);
  const input = document_ref.createElement('input');
  input.type = 'range';
  input.min = String(minimum);
  input.max = String(maximum);
  input.step = String(step);
  input.value = String(initial);
  input.style.width = '100%';
  const value = document_ref.createTextNode(initial.toFixed(step < 1 ? 2 : 0));
  input.addEventListener('input', () => {
    const next = Number(input.value);
    value.data = next.toFixed(step < 1 ? 2 : 0);
    on_change(next);
  });
  row.append(input, value);
  return { input, value };
}

function set_range(control: RangeControl, value: number, decimals = 2): void {
  control.input.value = String(value);
  control.value.data = value.toFixed(decimals);
}

/**
 * Opens only with ?debug=ocean or ?debug=all. It deliberately has no dependency
 * on a GUI package, so production users pay neither a bundle nor frame-time cost.
 */
export class OceanDebugGui {
  readonly element: HTMLDivElement;

  private readonly ocean: OceanSurface;
  private readonly quality_select: HTMLSelectElement;
  private readonly weather_select: HTMLSelectElement;
  private readonly wind: RangeControl;
  private readonly amplitude: RangeControl;
  private readonly speed: RangeControl;
  private readonly foam: RangeControl;
  private readonly storm: RangeControl;
  private readonly reflection: RangeControl;
  private readonly refraction: HTMLInputElement;

  static get requested(): boolean {
    return typeof window !== 'undefined' && debug_gui_requested();
  }

  constructor(options: OceanDebugGuiOptions) {
    const document_ref = options.parent.ownerDocument;
    this.ocean = options.ocean;

    const panel = document_ref.createElement('div');
    panel.setAttribute('aria-label', 'Ocean authoring controls');
    panel.style.cssText =
      'position:fixed;right:10px;bottom:10px;z-index:1001;width:246px;padding:10px 11px;' +
      'background:rgba(3,12,20,.9);border:1px solid rgba(88,192,220,.52);border-radius:8px;' +
      'box-shadow:0 8px 28px rgba(0,0,0,.42);font:11px/1.35 ui-monospace,SFMono-Regular,Consolas,monospace;';
    this.element = panel;

    const title = document_ref.createElement('div');
    title.textContent = 'OCEAN AUTHORING';
    title.style.cssText = 'margin-bottom:6px;color:#d7f7ff;font-weight:700;letter-spacing:.08em;';
    panel.appendChild(title);

    this.quality_select = document_ref.createElement('select');
    this.weather_select = document_ref.createElement('select');
    this.add_select_row(document_ref, panel, 'Quality', this.quality_select);
    this.add_select_row(document_ref, panel, 'Weather', this.weather_select);
    for (const id of Object.keys(OCEAN_QUALITY_PRESETS) as OceanQualityId[]) {
      const option = document_ref.createElement('option');
      option.value = id;
      option.textContent = OCEAN_QUALITY_PRESETS[id].label;
      this.quality_select.appendChild(option);
    }
    for (const id of Object.keys(OCEAN_WEATHER_PRESETS) as OceanWeatherId[]) {
      const option = document_ref.createElement('option');
      option.value = id;
      option.textContent = OCEAN_WEATHER_PRESETS[id].label;
      this.weather_select.appendChild(option);
    }
    this.quality_select.addEventListener('change', () => options.on_quality_change(this.quality_select.value as OceanQualityId));
    this.weather_select.addEventListener('change', () => options.on_weather_change(this.weather_select.value as OceanWeatherId));

    const tuning = this.ocean.current_tuning;
    this.wind = create_range(document_ref, panel, 'Wind deg', -180, 180, 1, 0, (degrees) => {
      this.ocean.set_tuning({ wind_direction_offset_radians: degrees * Math.PI / 180 });
    });
    this.amplitude = create_range(document_ref, panel, 'Wave amp', 0.2, 2.4, 0.05, tuning.wave_amplitude_multiplier, (value) => {
      this.ocean.set_tuning({ wave_amplitude_multiplier: value });
    });
    this.speed = create_range(document_ref, panel, 'Wave speed', 0.4, 2.2, 0.05, tuning.wave_speed_multiplier, (value) => {
      this.ocean.set_tuning({ wave_speed_multiplier: value });
    });
    this.foam = create_range(document_ref, panel, 'Foam', 0, 2, 0.05, tuning.foam_multiplier, (value) => {
      this.ocean.set_tuning({ foam_multiplier: value });
    });
    this.storm = create_range(document_ref, panel, 'Storm', 0, 1, 0.05, tuning.storm_intensity, (value) => {
      this.ocean.set_tuning({ storm_intensity: value });
    });
    this.reflection = create_range(
      document_ref,
      panel,
      'Reflection',
      0,
      1,
      0.05,
      this.ocean.current_reflection_scale,
      (value) => this.ocean.set_reflection_scale(value),
    );

    const refraction_row = create_row(document_ref, panel, 'Refraction');
    this.refraction = document_ref.createElement('input');
    this.refraction.type = 'checkbox';
    this.refraction.checked = this.ocean.current_refraction_enabled;
    this.refraction.addEventListener('change', () => this.ocean.set_refraction_enabled(this.refraction.checked));
    const refraction_note = document_ref.createTextNode('enabled');
    refraction_row.append(this.refraction, refraction_note);

    const reset = document_ref.createElement('button');
    reset.type = 'button';
    reset.textContent = 'Reset ocean tuning';
    reset.style.cssText = 'width:100%;margin-top:8px;padding:5px;border:1px solid #467d8c;border-radius:4px;background:#102b38;color:#d8f4fa;cursor:pointer;';
    reset.addEventListener('click', () => {
      options.on_weather_change(this.weather_select.value as OceanWeatherId);
      this.ocean.set_reflection_scale(null);
      this.ocean.set_refraction_enabled(null);
      this.sync(this.quality_select.value as OceanQualityId, this.weather_select.value as OceanWeatherId);
    });
    panel.appendChild(reset);
    options.parent.appendChild(panel);
    this.sync(options.quality_id, options.weather_id);
  }

  sync(quality_id: OceanQualityId, weather_id: OceanWeatherId): void {
    this.quality_select.value = quality_id;
    this.weather_select.value = weather_id;
    const tuning = this.ocean.current_tuning;
    set_range(this.wind, tuning.wind_direction_offset_radians * 180 / Math.PI, 0);
    set_range(this.amplitude, tuning.wave_amplitude_multiplier);
    set_range(this.speed, tuning.wave_speed_multiplier);
    set_range(this.foam, tuning.foam_multiplier);
    set_range(this.storm, tuning.storm_intensity);
    set_range(this.reflection, this.ocean.current_reflection_scale);
    this.refraction.checked = this.ocean.current_refraction_enabled;
  }

  dispose(): void {
    this.element.remove();
  }

  private add_select_row(document_ref: Document, parent: HTMLElement, label: string, select: HTMLSelectElement): void {
    const row = create_row(document_ref, parent, label);
    select.style.cssText = 'grid-column:2 / 4;width:100%;background:#102833;color:#e5f7fb;border:1px solid #467d8c;border-radius:3px;padding:2px;';
    row.appendChild(select);
  }
}
