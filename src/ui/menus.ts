// file: src/ui/menus.ts
// description: Title and game-over screens with run stats, best score, career points, and controls reference
// reference: src/main.ts, src/ui/ui_styles.ts, src/gameplay/rewards.ts

import { GameState } from '../core/game_state';
import { ShipPhysics } from '../ship/ship_physics';
import { RewardSystem } from '../gameplay/rewards';
import { nautical_miles } from '../gameplay/scoring';
import { inject_ui_styles } from './ui_styles';

export class Menus {
  private readonly title_screen: HTMLDivElement;
  private readonly gameover_screen: HTMLDivElement;
  private readonly title_career: HTMLDivElement;
  private readonly gameover_stats: HTMLDivElement;

  constructor(parent: HTMLElement) {
    inject_ui_styles();

    // Title screen.
    this.title_screen = document.createElement('div');
    this.title_screen.className = 'screen';

    const title = document.createElement('h1');
    title.className = 'game-title';
    title.textContent = 'TITANIC';
    const subtitle = document.createElement('div');
    subtitle.className = 'game-subtitle';
    subtitle.textContent = 'Iceberg Run';

    const controls = document.createElement('div');
    controls.className = 'controls-card';
    controls.innerHTML = [
      '<b>W / S</b> &nbsp;Engine telegraph up / down',
      '<b>A / D</b> &nbsp;Rudder port / starboard',
      '<b>V</b> &nbsp;Toggle bridge / chase view',
      '<b>C</b> &nbsp;Cinematic camera',
      '<b>P</b> &nbsp;Mood: Dusk / Night / Aurora',
      '<b>Q</b> &nbsp;Quality: effects on / off',
      '',
      'Avoid the icebergs. She does not turn quickly.',
    ].join('<br>');

    this.title_career = document.createElement('div');
    this.title_career.className = 'career-line';

    const press = document.createElement('div');
    press.className = 'press-start';
    press.textContent = 'PRESS ENTER TO SET SAIL';

    this.title_screen.append(title, subtitle, controls, this.title_career, press);
    parent.appendChild(this.title_screen);

    // Game over screen.
    this.gameover_screen = document.createElement('div');
    this.gameover_screen.className = 'screen hidden';

    const go_title = document.createElement('h2');
    go_title.className = 'gameover-title';
    go_title.textContent = 'SHE IS GONE';

    this.gameover_stats = document.createElement('div');
    this.gameover_stats.className = 'stats-card';

    const go_press = document.createElement('div');
    go_press.className = 'press-start';
    go_press.textContent = 'PRESS ENTER FOR ANOTHER CROSSING';

    this.gameover_screen.append(go_title, this.gameover_stats, go_press);
    parent.appendChild(this.gameover_screen);
  }

  show_title(rewards: RewardSystem): void {
    this.title_career.textContent =
      rewards.best_score > 0
        ? `Best score ${rewards.best_score.toLocaleString()} | Career points ${rewards.career_points.toLocaleString()}`
        : 'Maiden voyage - good luck, Captain';
    this.title_screen.classList.remove('hidden');
    this.gameover_screen.classList.add('hidden');
  }

  show_game_over(state: GameState, physics: ShipPhysics, rewards: RewardSystem): void {
    const minutes = Math.floor(state.run_time / 60);
    const seconds = Math.floor(state.run_time % 60);
    this.gameover_stats.innerHTML = [
      `Score <span class="stat-value">${Math.round(state.score).toLocaleString()}</span>`,
      `Distance <span class="stat-value">${nautical_miles(physics.distance_travelled).toFixed(2)} nm</span>`,
      `Near misses <span class="stat-value">${state.near_misses}</span>`,
      `Time afloat <span class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</span>`,
      `Best score <span class="stat-value">${rewards.best_score.toLocaleString()}</span>`,
    ].join('<br>');
    this.gameover_screen.classList.remove('hidden');
    this.title_screen.classList.add('hidden');
  }

  hide_all(): void {
    this.title_screen.classList.add('hidden');
    this.gameover_screen.classList.add('hidden');
  }
}
