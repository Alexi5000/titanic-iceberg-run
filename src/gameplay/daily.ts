// file: src/gameplay/daily.ts
// description: Daily Voyage mode - date-seeded deterministic RNG, one scored attempt per day, and streak tracking
// reference: src/main.ts, src/world/iceberg_field.ts, src/gameplay/cards.ts

const KEY = 'tir.daily.v1';

export function today_string(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Deterministic RNG from a string seed (xmur3 hash + mulberry32). */
export function seeded_rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = (h ^= h >>> 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DailySave {
  version: number;
  last_scored_date: string | null;
  last_score: number;
  streak: number;
  daily_runs_total: number;
}

export class DailySystem {
  private data: DailySave = {
    version: 1,
    last_scored_date: null,
    last_score: 0,
    streak: 0,
    daily_runs_total: 0,
  };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<DailySave>;
        this.data = {
          version: 1,
          last_scored_date: parsed.last_scored_date ?? null,
          last_score: parsed.last_score ?? 0,
          streak: parsed.streak ?? 0,
          daily_runs_total: parsed.daily_runs_total ?? 0,
        };
      }
    } catch {
      // defaults stand
    }
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // No persistence available.
    }
  }

  played_today(): boolean {
    return this.data.last_scored_date === today_string();
  }

  get streak(): number {
    // A streak only counts if it is still alive (today or yesterday was scored).
    if (!this.data.last_scored_date) return 0;
    const last = new Date(this.data.last_scored_date + 'T12:00:00');
    const today = new Date(today_string() + 'T12:00:00');
    const gap_days = Math.round((today.getTime() - last.getTime()) / 86400000);
    return gap_days <= 1 ? this.data.streak : 0;
  }

  get total_dailies(): number {
    return this.data.daily_runs_total;
  }

  get last_score(): number {
    return this.data.last_score;
  }

  /** Record today's one scored attempt. Returns the updated streak, or null if already scored. */
  record_scored_run(score: number): number | null {
    if (this.played_today()) return null;
    const alive_streak = this.streak;
    this.data.streak = alive_streak + 1;
    this.data.last_scored_date = today_string();
    this.data.last_score = Math.round(score);
    this.data.daily_runs_total += 1;
    this.save();
    return this.data.streak;
  }
}
