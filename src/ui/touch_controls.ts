// file: src/ui/touch_controls.ts
// description: Mobile touch controls - left-thumb telegraph slider, right-thumb rudder drag pad, and camera toggle button
// reference: src/main.ts, src/ship/ship_physics.ts, src/ui/ui_styles.ts

import { TelegraphOrder, TELEGRAPH_LABELS } from '../ship/ship_physics';
import { inject_ui_styles } from './ui_styles';

export function is_touch_device(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

const ORDERS: TelegraphOrder[] = [
  TelegraphOrder.FullAhead,
  TelegraphOrder.HalfAhead,
  TelegraphOrder.SlowAhead,
  TelegraphOrder.Stop,
  TelegraphOrder.HalfAstern,
  TelegraphOrder.FullAstern,
];

export class TouchControls {
  /** Current rudder value -1..1, or null when the pad is not touched. */
  rudder_value: number | null = null;

  private readonly root: HTMLDivElement;
  private readonly telegraph_steps: HTMLDivElement[] = [];
  private readonly rudder_handle: HTMLDivElement;
  private readonly rudder_pad: HTMLDivElement;
  private on_telegraph: (order: TelegraphOrder) => void = () => undefined;
  private on_camera: () => void = () => undefined;
  private rudder_pointer_id: number | null = null;

  constructor(parent: HTMLElement) {
    inject_ui_styles();

    this.root = document.createElement('div');
    this.root.className = 'touch-controls hidden';

    // Left: vertical telegraph slider (Full Ahead at top).
    const telegraph = document.createElement('div');
    telegraph.className = 'touch-telegraph';
    for (const order of ORDERS) {
      const step = document.createElement('div');
      step.className = 'touch-telegraph-step';
      step.textContent = TELEGRAPH_LABELS[order].replace(' AHEAD', '+').replace(' ASTERN', '-');
      step.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
        this.set_active_step(order);
        this.on_telegraph(order);
      });
      telegraph.appendChild(step);
      this.telegraph_steps.push(step);
    }
    this.root.appendChild(telegraph);

    // Right: rudder drag pad.
    this.rudder_pad = document.createElement('div');
    this.rudder_pad.className = 'touch-rudder-pad';
    const rudder_track = document.createElement('div');
    rudder_track.className = 'touch-rudder-track';
    this.rudder_handle = document.createElement('div');
    this.rudder_handle.className = 'touch-rudder-handle';
    rudder_track.appendChild(this.rudder_handle);
    this.rudder_pad.appendChild(rudder_track);

    this.rudder_pad.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.rudder_pointer_id = event.pointerId;
      this.rudder_pad.setPointerCapture(event.pointerId);
      this.update_rudder_from_event(event);
    });
    this.rudder_pad.addEventListener('pointermove', (event) => {
      if (event.pointerId !== this.rudder_pointer_id) return;
      this.update_rudder_from_event(event);
    });
    const release = (event: PointerEvent) => {
      if (event.pointerId !== this.rudder_pointer_id) return;
      this.rudder_pointer_id = null;
      this.rudder_value = null;
      this.rudder_handle.style.left = '50%';
    };
    this.rudder_pad.addEventListener('pointerup', release);
    this.rudder_pad.addEventListener('pointercancel', release);
    this.root.appendChild(this.rudder_pad);

    // Camera toggle button.
    const camera_button = document.createElement('button');
    camera_button.className = 'touch-camera-button';
    camera_button.textContent = 'CAM';
    camera_button.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
      this.on_camera();
    });
    this.root.appendChild(camera_button);

    parent.appendChild(this.root);
  }

  private update_rudder_from_event(event: PointerEvent): void {
    const rect = this.rudder_pad.getBoundingClientRect();
    const normalized = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    // Pad-right = turn starboard = negative rudder in the physics convention.
    const clamped = Math.max(-1, Math.min(1, normalized));
    this.rudder_value = -clamped;
    this.rudder_handle.style.left = `${50 + clamped * 44}%`;
  }

  private set_active_step(order: TelegraphOrder): void {
    ORDERS.forEach((o, i) => {
      this.telegraph_steps[i].classList.toggle('active', o === order);
    });
  }

  bind(on_telegraph: (order: TelegraphOrder) => void, on_camera: () => void): void {
    this.on_telegraph = on_telegraph;
    this.on_camera = on_camera;
  }

  sync_telegraph(order: TelegraphOrder): void {
    this.set_active_step(order);
  }

  set_visible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }
}
