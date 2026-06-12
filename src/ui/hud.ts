// file: src/ui/hud.ts
// description: In-run HUD - score, multiplier, hull bar, telegraph and rudder indicators, mission panel, toast notifications, damage vignette
// reference: src/main.ts, src/ui/ui_styles.ts, src/gameplay/missions.ts, src/ship/ship_physics.ts

import { GameState } from '../core/game_state';
import { ShipPhysics, TelegraphOrder, TELEGRAPH_LABELS } from '../ship/ship_physics';
import { MissionTracker } from '../gameplay/missions';
import { nautical_miles, Scoring } from '../gameplay/scoring';
import { inject_ui_styles } from './ui_styles';

export interface ToastMessage {
  title: string;
  body: string;
}

const TELEGRAPH_ORDER_SEQUENCE: TelegraphOrder[] = [
  TelegraphOrder.FullAstern,
  TelegraphOrder.HalfAstern,
  TelegraphOrder.Stop,
  TelegraphOrder.SlowAhead,
  TelegraphOrder.HalfAhead,
  TelegraphOrder.FullAhead,
];

export class Hud {
  private readonly root: HTMLDivElement;
  private readonly score_el: HTMLDivElement;
  private readonly distance_el: HTMLDivElement;
  private readonly mult_el: HTMLDivElement;
  private readonly hull_fill: HTMLDivElement;
  private readonly hull_label: HTMLDivElement;
  private hull_shell!: HTMLDivElement;
  private last_telegraph: TelegraphOrder | null = null;
  private readonly telegraph_steps: HTMLDivElement[] = [];
  private readonly telegraph_label: HTMLDivElement;
  private readonly speed_el: HTMLDivElement;
  private readonly rudder_needle: HTMLDivElement;
  private readonly missions_el: HTMLDivElement;
  private readonly toasts_el: HTMLDivElement;
  private readonly vignette: HTMLDivElement;

  constructor(parent: HTMLElement, state: GameState) {
    inject_ui_styles();

    this.root = document.createElement('div');
    this.root.className = 'overlay';

    this.vignette = document.createElement('div');
    this.vignette.className = 'vignette';
    this.root.appendChild(this.vignette);

    // Top left: score block.
    const top_left = document.createElement('div');
    top_left.className = 'hud-corner hud-top-left';
    this.score_el = document.createElement('div');
    this.score_el.className = 'hud-score';
    this.distance_el = document.createElement('div');
    this.distance_el.className = 'hud-sub';
    this.mult_el = document.createElement('div');
    this.mult_el.className = 'hud-sub hud-mult';
    top_left.append(this.score_el, this.distance_el, this.mult_el);
    this.root.appendChild(top_left);

    // Top right: missions.
    const top_right = document.createElement('div');
    top_right.className = 'hud-corner hud-top-right';
    this.missions_el = document.createElement('div');
    this.missions_el.className = 'missions';
    top_right.appendChild(this.missions_el);
    this.root.appendChild(top_right);

    // Bottom left: telegraph + speed.
    const bottom_left = document.createElement('div');
    bottom_left.className = 'hud-corner hud-bottom-left';
    this.telegraph_label = document.createElement('div');
    this.telegraph_label.className = 'telegraph-label';
    const telegraph = document.createElement('div');
    telegraph.className = 'telegraph';
    for (const order of TELEGRAPH_ORDER_SEQUENCE) {
      const step = document.createElement('div');
      step.className = `telegraph-step${order <= TelegraphOrder.HalfAstern ? ' astern' : ''}`;
      telegraph.appendChild(step);
      this.telegraph_steps.push(step);
    }
    this.speed_el = document.createElement('div');
    this.speed_el.className = 'hud-sub';
    bottom_left.append(this.telegraph_label, telegraph, this.speed_el);
    this.root.appendChild(bottom_left);

    // Bottom right: hull + rudder.
    const bottom_right = document.createElement('div');
    bottom_right.className = 'hud-corner hud-bottom-right';
    this.hull_label = document.createElement('div');
    this.hull_label.className = 'hud-sub';
    this.hull_shell = document.createElement('div');
    const hull_shell = this.hull_shell;
    hull_shell.className = 'bar-shell';
    this.hull_fill = document.createElement('div');
    this.hull_fill.className = 'bar-fill';
    hull_shell.appendChild(this.hull_fill);
    const rudder_label = document.createElement('div');
    rudder_label.className = 'hud-sub';
    rudder_label.textContent = 'Rudder';
    const rudder_shell = document.createElement('div');
    rudder_shell.className = 'rudder-shell';
    const rudder_center = document.createElement('div');
    rudder_center.className = 'rudder-center';
    this.rudder_needle = document.createElement('div');
    this.rudder_needle.className = 'rudder-needle';
    rudder_shell.append(rudder_center, this.rudder_needle);
    bottom_right.append(this.hull_label, hull_shell, rudder_label, rudder_shell);
    this.root.appendChild(bottom_right);

    // Center: toasts.
    this.toasts_el = document.createElement('div');
    this.toasts_el.className = 'toasts';
    this.root.appendChild(this.toasts_el);

    parent.appendChild(this.root);

    state.on('graze', () => this.flash_damage());
    state.on('fatal', () => this.flash_damage());
  }

  set_visible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  show_toast(toast: ToastMessage): void {
    const el = document.createElement('div');
    el.className = 'toast';
    const title = document.createElement('div');
    title.className = 'toast-title';
    title.textContent = toast.title;
    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = toast.body;
    el.append(title, body);
    this.toasts_el.appendChild(el);
    window.setTimeout(() => el.remove(), 4000);
  }

  private flash_damage(): void {
    this.vignette.classList.add('flash');
    window.setTimeout(() => this.vignette.classList.remove('flash'), 120);
    this.hull_shell.classList.remove('wobble');
    void this.hull_shell.offsetWidth; // restart animation
    this.hull_shell.classList.add('wobble');
  }

  update(state: GameState, physics: ShipPhysics, missions: MissionTracker, scoring: Scoring): void {
    this.score_el.textContent = `${Math.round(state.score).toLocaleString()} pts`;
    this.distance_el.textContent = `${nautical_miles(physics.distance_travelled).toFixed(2)} nm travelled`;
    this.mult_el.textContent = scoring.multiplier > 1 ? `x${scoring.multiplier.toFixed(1)} streak` : '';

    if (this.last_telegraph !== physics.telegraph) {
      this.last_telegraph = physics.telegraph;
      this.telegraph_label.classList.remove('pop');
      void this.telegraph_label.offsetWidth;
      this.telegraph_label.classList.add('pop');
    }
    this.telegraph_label.textContent = TELEGRAPH_LABELS[physics.telegraph];
    for (let i = 0; i < this.telegraph_steps.length; i++) {
      this.telegraph_steps[i].classList.toggle('active', TELEGRAPH_ORDER_SEQUENCE[i] === physics.telegraph);
    }
    this.speed_el.textContent = `${Math.abs(physics.knots).toFixed(1)} knots${physics.speed < -0.5 ? ' astern' : ''}`;

    this.hull_label.textContent = `Hull ${Math.round(state.hull)}%`;
    this.hull_fill.style.width = `${state.hull}%`;
    this.hull_fill.className = `bar-fill${state.hull < 30 ? ' danger' : state.hull < 60 ? ' warn' : ''}`;

    // Rudder needle: physics rudder is positive-to-port; map onto the bar.
    const rudder_pct = 50 - (physics.rudder / 0.6) * 46;
    this.rudder_needle.style.left = `${rudder_pct}%`;

    // Missions panel.
    let html = '';
    for (const mission of missions.missions) {
      const pct = Math.min((mission.progress / mission.def.target) * 100, 100);
      html += `<div class="mission-row${mission.complete ? ' done' : ''}">${mission.complete ? '&#10003; ' : ''}${mission.def.title}<span class="mission-progress">${mission.complete ? 'DONE' : `${Math.floor(pct)}%`}</span></div>`;
    }
    this.missions_el.innerHTML = html;
  }
}
