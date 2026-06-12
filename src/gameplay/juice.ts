// file: src/gameplay/juice.ts
// description: Game-feel orchestrator - near-miss slow-mo with FOV punch, graze screen shake, intro drop bounce, and reduced-motion handling
// reference: src/main.ts, src/core/post_processing.ts, src/core/audio_manager.ts

const SLOWMO_DURATION = 0.55;
const SLOWMO_SCALE = 0.3;
const SHAKE_DECAY = 4.5;
const INTRO_DURATION = 2.4;
const REDUCED_MOTION_KEY = 'tir.reduced_motion.v1';

export class JuiceSystem {
  /** Multiplier applied to the simulation delta. */
  time_scale = 1;
  /** Camera FOV offset, negative = punch-in. */
  fov_offset = 0;
  /** 0..1 used to drive vignette/bloom pulse. */
  pulse = 0;
  /** World-space camera shake offset magnitude. */
  shake_magnitude = 0;
  reduced_motion: boolean;

  private slowmo_timer = 0;
  private intro_timer = -1;

  constructor() {
    this.reduced_motion = this.load_reduced_motion();
  }

  private load_reduced_motion(): boolean {
    try {
      const stored = localStorage.getItem(REDUCED_MOTION_KEY);
      if (stored !== null) return stored === 'true';
    } catch {
      // fall through to media query
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  toggle_reduced_motion(): boolean {
    this.reduced_motion = !this.reduced_motion;
    try {
      localStorage.setItem(REDUCED_MOTION_KEY, String(this.reduced_motion));
    } catch {
      // No persistence available.
    }
    return this.reduced_motion;
  }

  trigger_near_miss(): void {
    if (this.reduced_motion) return;
    this.slowmo_timer = SLOWMO_DURATION;
  }

  trigger_graze(): void {
    if (this.reduced_motion) return;
    this.shake_magnitude = Math.min(this.shake_magnitude + 7, 11);
  }

  trigger_fatal(): void {
    if (this.reduced_motion) return;
    this.shake_magnitude = 16;
    this.slowmo_timer = SLOWMO_DURATION * 1.6;
  }

  begin_intro(): void {
    if (this.reduced_motion) return;
    this.intro_timer = 0;
  }

  /** Extra Y offset for the ship during the intro drop (bounce-out easing). */
  get intro_offset_y(): number {
    if (this.intro_timer < 0 || this.intro_timer >= INTRO_DURATION) return 0;
    const t = this.intro_timer / INTRO_DURATION;
    return (1 - bounce_out(t)) * 160;
  }

  get intro_active(): boolean {
    return this.intro_timer >= 0 && this.intro_timer < INTRO_DURATION;
  }

  update(raw_delta: number): void {
    if (this.intro_timer >= 0 && this.intro_timer < INTRO_DURATION) {
      this.intro_timer += raw_delta;
    }

    if (this.slowmo_timer > 0) {
      this.slowmo_timer = Math.max(0, this.slowmo_timer - raw_delta);
      const t = this.slowmo_timer / SLOWMO_DURATION;
      const envelope = Math.min(t * 3, 1) * Math.min((1 - t) * 6 + 0.4, 1);
      this.time_scale = 1 - (1 - SLOWMO_SCALE) * Math.min(envelope, 1);
      this.pulse = Math.min(envelope, 1);
      this.fov_offset = -7 * Math.min(envelope, 1);
    } else {
      this.time_scale += (1 - this.time_scale) * Math.min(raw_delta * 8, 1);
      this.pulse *= Math.exp(-6 * raw_delta);
      this.fov_offset *= Math.exp(-6 * raw_delta);
    }

    this.shake_magnitude *= Math.exp(-SHAKE_DECAY * raw_delta);
    if (this.shake_magnitude < 0.05) this.shake_magnitude = 0;
  }

  shake_offset(): { x: number; y: number; z: number } {
    if (this.shake_magnitude <= 0) return { x: 0, y: 0, z: 0 };
    const m = this.shake_magnitude;
    return {
      x: (Math.random() - 0.5) * m,
      y: (Math.random() - 0.5) * m * 0.6,
      z: (Math.random() - 0.5) * m,
    };
  }

  reset(): void {
    this.time_scale = 1;
    this.slowmo_timer = 0;
    this.shake_magnitude = 0;
    this.pulse = 0;
    this.fov_offset = 0;
  }
}

function bounce_out(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) {
    const u = t - 1.5 / d1;
    return n1 * u * u + 0.75;
  }
  if (t < 2.5 / d1) {
    const u = t - 2.25 / d1;
    return n1 * u * u + 0.9375;
  }
  const u = t - 2.625 / d1;
  return n1 * u * u + 0.984375;
}
