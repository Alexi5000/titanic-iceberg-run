// file: src/core/onboarding.ts
// description: First-run guided onboarding - sequential contextual prompts that dismiss on use, forgiving ice density, and a celebrated first near miss
// reference: src/main.ts, src/core/input_manager.ts, src/ui/ui_styles.ts

import { ShipPhysics, TelegraphOrder } from '../ship/ship_physics';
import { GameState } from './game_state';
import { inject_ui_styles } from '../ui/ui_styles';

const KEY = 'tir.onboarding.v1';

type Step = 'telegraph' | 'steer' | 'near_miss' | 'done';

const STEP_TEXT: Record<Exclude<Step, 'done'>, string> = {
  telegraph: 'Press W twice - ring up HALF AHEAD',
  steer: 'Steer with A and D - she answers slowly',
  near_miss: 'Ice ahead. Pass CLOSE for bonus points - just do not touch it',
};

export class Onboarding {
  private step: Step = 'done';
  private readonly prompt: HTMLDivElement;
  private near_miss_timer = 0;

  constructor(parent: HTMLElement) {
    inject_ui_styles();
    this.prompt = document.createElement('div');
    this.prompt.className = 'onboarding-prompt hidden';
    parent.appendChild(this.prompt);
  }

  static needed(): boolean {
    try {
      return localStorage.getItem(KEY) === null;
    } catch {
      return false;
    }
  }

  get active(): boolean {
    return this.step !== 'done';
  }

  /** Caps iceberg density while the player is learning. */
  get density_cap(): number | null {
    return this.active ? 0.45 : null;
  }

  begin(): void {
    this.step = 'telegraph';
    this.near_miss_timer = 0;
    this.show(STEP_TEXT.telegraph);
  }

  complete(): void {
    this.step = 'done';
    this.prompt.classList.add('hidden');
    try {
      localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // No persistence available.
    }
  }

  private show(text: string): void {
    this.prompt.textContent = `${text}   (X to skip tutorial)`;
    this.prompt.classList.remove('hidden');
    this.prompt.classList.remove('pulse-once');
    void this.prompt.offsetWidth;
    this.prompt.classList.add('pulse-once');
  }

  on_near_miss(): void {
    if (this.step === 'near_miss') {
      this.show('CLOSE SHAVE! Near misses build your score streak. You are ready, Captain.');
      this.step = 'done';
      window.setTimeout(() => this.complete(), 3500);
    }
  }

  update(delta: number, physics: ShipPhysics, state: GameState, skip_pressed: boolean): void {
    if (!this.active) return;

    if (skip_pressed) {
      this.complete();
      return;
    }

    if (this.step === 'telegraph' && physics.telegraph >= TelegraphOrder.HalfAhead) {
      this.step = 'steer';
      this.show(STEP_TEXT.steer);
    } else if (this.step === 'steer' && Math.abs(physics.rudder) > 0.22) {
      this.step = 'near_miss';
      this.show(STEP_TEXT.near_miss);
    } else if (this.step === 'near_miss') {
      this.near_miss_timer += delta;
      // Player either gets the celebrated near miss or graduates by time/experience.
      if (this.near_miss_timer > 45 || state.near_misses > 0 || state.grazes > 0) {
        this.complete();
      }
    }
  }
}
