// file: src/ui/records_ui.ts
// description: Records overlay - top-10 table per mode, plus the NEW BEST confetti celebration
// reference: src/gameplay/records.ts, src/main.ts, src/ui/ui_styles.ts

import { RecordsBoard, GameMode } from '../gameplay/records';
import { nautical_miles } from '../gameplay/scoring';
import { inject_ui_styles } from './ui_styles';

export class RecordsOverlay {
  private readonly root: HTMLDivElement;
  private readonly table: HTMLDivElement;
  private readonly tabs = new Map<GameMode, HTMLButtonElement>();
  private active_mode: GameMode = 'endless';
  private readonly board: RecordsBoard;
  is_open = false;

  constructor(parent: HTMLElement, board: RecordsBoard) {
    inject_ui_styles();
    this.board = board;

    this.root = document.createElement('div');
    this.root.className = 'gallery hidden';

    const close = document.createElement('button');
    close.className = 'gallery-close';
    close.textContent = 'X';
    close.addEventListener('click', () => this.close());
    this.root.appendChild(close);

    const title = document.createElement('h2');
    title.className = 'gallery-title';
    title.textContent = 'SHIP\'S RECORDS';
    this.root.appendChild(title);

    const tabs = document.createElement('div');
    tabs.className = 'gallery-tabs';
    for (const mode of ['endless', 'daily'] as GameMode[]) {
      const tab = document.createElement('button');
      tab.className = 'gallery-tab';
      tab.textContent = mode === 'endless' ? 'Endless' : 'Daily Voyage';
      tab.addEventListener('click', () => {
        this.active_mode = mode;
        this.refresh();
      });
      tabs.appendChild(tab);
      this.tabs.set(mode, tab);
    }
    this.root.appendChild(tabs);

    this.table = document.createElement('div');
    this.table.className = 'records-table';
    this.root.appendChild(this.table);

    parent.appendChild(this.root);
  }

  open(): void {
    this.is_open = true;
    this.root.classList.remove('hidden');
    this.refresh();
  }

  close(): void {
    this.is_open = false;
    this.root.classList.add('hidden');
  }

  private refresh(): void {
    for (const [mode, tab] of this.tabs) {
      tab.classList.toggle('active', mode === this.active_mode);
    }

    const records = this.board.top(this.active_mode);
    if (records.length === 0) {
      this.table.innerHTML = '<div class="records-empty">No crossings logged yet, Captain.</div>';
      return;
    }

    let html = `
      <div class="records-row records-head">
        <span>#</span><span>Score</span><span>Distance</span><span>Near misses</span><span>Cards</span><span>Date</span>
      </div>`;
    records.forEach((record, i) => {
      const minutes = Math.floor(record.run_time / 60);
      const seconds = Math.floor(record.run_time % 60).toString().padStart(2, '0');
      html += `
      <div class="records-row${i === 0 ? ' records-best' : ''}">
        <span>${i + 1}</span>
        <span>${record.score.toLocaleString()}</span>
        <span>${nautical_miles(record.distance).toFixed(2)} nm</span>
        <span>${record.near_misses} (${minutes}:${seconds})</span>
        <span>${record.cards_earned}</span>
        <span>${new Date(record.date).toLocaleDateString()}</span>
      </div>`;
    });
    this.table.innerHTML = html;
  }
}

const CONFETTI_COLORS = ['#e2574c', '#e9b44c', '#5ec98a', '#5a8fd9', '#c478d9', '#46c2b8'];

/** Full-screen confetti burst for NEW BEST celebrations. Self-cleans after 4s. */
export function celebrate_confetti(parent: HTMLElement): void {
  const container = document.createElement('div');
  container.className = 'confetti-layer';
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.animationDelay = `${Math.random() * 0.7}s`;
    piece.style.animationDuration = `${2.2 + Math.random() * 1.4}s`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
  }
  parent.appendChild(container);
  window.setTimeout(() => container.remove(), 4500);
}
