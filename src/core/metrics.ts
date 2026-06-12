// file: src/core/metrics.ts
// description: Local engagement metrics - runs per session, play days, gallery opens, persisted to localStorage with a ?debug=metrics inspector panel
// reference: src/main.ts, GAME_PLAN_V2.md

const KEY = 'tir.metrics.v1';

interface MetricsSave {
  version: number;
  sessions: number;
  runs_total: number;
  play_days: string[];
  runs_per_session: number[];
  gallery_opens_total: number;
}

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export class Metrics {
  private data: MetricsSave = {
    version: 1,
    sessions: 0,
    runs_total: 0,
    play_days: [],
    runs_per_session: [],
    gallery_opens_total: 0,
  };
  private runs_this_session = 0;
  private gallery_opens_session = 0;

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<MetricsSave>;
        this.data = {
          version: 1,
          sessions: parsed.sessions ?? 0,
          runs_total: parsed.runs_total ?? 0,
          play_days: Array.isArray(parsed.play_days) ? parsed.play_days : [],
          runs_per_session: Array.isArray(parsed.runs_per_session) ? parsed.runs_per_session : [],
          gallery_opens_total: parsed.gallery_opens_total ?? 0,
        };
      }
    } catch {
      // defaults stand
    }

    this.data.sessions += 1;
    if (!this.data.play_days.includes(today())) {
      this.data.play_days.push(today());
      if (this.data.play_days.length > 366) this.data.play_days.shift();
    }
    this.save();

    // Flush the session run count when the tab closes.
    window.addEventListener('beforeunload', () => {
      this.data.runs_per_session.push(this.runs_this_session);
      if (this.data.runs_per_session.length > 200) this.data.runs_per_session.shift();
      this.save();
    });
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // No persistence available.
    }
  }

  record_run(): void {
    this.runs_this_session += 1;
    this.data.runs_total += 1;
    this.save();
  }

  record_gallery_open(): void {
    this.gallery_opens_session += 1;
    this.data.gallery_opens_total += 1;
    this.save();
  }

  private median_runs_per_session(): number {
    const all = [...this.data.runs_per_session, this.runs_this_session].sort((a, b) => a - b);
    if (all.length === 0) return 0;
    return all[Math.floor(all.length / 2)];
  }

  private play_days_last_7(): number {
    const now = Date.now();
    return this.data.play_days.filter((d) => {
      const t = new Date(d + 'T12:00:00').getTime();
      return now - t <= 7 * 86400000;
    }).length;
  }

  /** Renders the hidden inspector when the page is opened with ?debug=metrics. */
  maybe_show_debug_panel(extra: () => Record<string, string | number>): void {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    if (new URLSearchParams(window.location.search).get('debug') !== 'metrics') return;

    const panel = document.createElement('div');
    panel.style.cssText =
      'position:fixed;top:10px;left:10px;z-index:99;background:rgba(4,10,18,0.92);color:#9fe8c8;' +
      'font:11.5px/1.7 Consolas,monospace;padding:12px 16px;border:1px solid #2a4a44;border-radius:8px;max-width:340px;pointer-events:none;';
    document.body.appendChild(panel);

    const render = () => {
      const stats: Record<string, string | number> = {
        sessions: this.data.sessions,
        runs_total: this.data.runs_total,
        runs_this_session: this.runs_this_session,
        median_runs_per_session: this.median_runs_per_session(),
        play_days_total: this.data.play_days.length,
        play_days_last_7: this.play_days_last_7(),
        gallery_opens_total: this.data.gallery_opens_total,
        gallery_opens_session: this.gallery_opens_session,
        ...extra(),
      };
      panel.innerHTML =
        '<b>tir.metrics.v1</b><br>' +
        Object.entries(stats)
          .map(([k, v]) => `${k}: ${v}`)
          .join('<br>');
    };
    render();
    window.setInterval(render, 2000);
  }
}
