// file: src/gameplay/rewards.ts
// description: Reward and unlock system - career points, best score, cosmetic unlocks, persisted to localStorage
// reference: src/main.ts, src/gameplay/missions.ts, src/ship/titanic_model.ts

export interface UnlockDef {
  id: string;
  title: string;
  description: string;
  cost_points: number;
}

export const UNLOCKS: UnlockDef[] = [
  {
    id: 'searchlight',
    title: 'Bow Searchlight',
    description: 'A forward searchlight pierces the dark',
    cost_points: 400,
  },
  {
    id: 'golden_funnels',
    title: 'Golden Funnels',
    description: 'Gilded funnels for a ship of legends',
    cost_points: 1200,
  },
];

interface SaveData {
  best_score: number;
  career_points: number;
  career_near_misses: number;
  unlocked: string[];
}

const STORAGE_KEY = 'titanic_iceberg_run_save_v1';

const DEFAULT_SAVE: SaveData = {
  best_score: 0,
  career_points: 0,
  career_near_misses: 0,
  unlocked: [],
};

export type UnlockNotify = (unlock: UnlockDef) => void;

export class RewardSystem {
  private data: SaveData;
  private readonly notify: UnlockNotify;

  constructor(notify: UnlockNotify) {
    this.notify = notify;
    this.data = this.load();
  }

  private load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAVE };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return {
        best_score: parsed.best_score ?? 0,
        career_points: parsed.career_points ?? 0,
        career_near_misses: parsed.career_near_misses ?? 0,
        unlocked: Array.isArray(parsed.unlocked) ? parsed.unlocked : [],
      };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage unavailable (private mode) - rewards simply do not persist.
    }
  }

  get best_score(): number {
    return this.data.best_score;
  }

  get career_points(): number {
    return this.data.career_points;
  }

  get career_near_misses(): number {
    return this.data.career_near_misses;
  }

  is_unlocked(id: string): boolean {
    return this.data.unlocked.includes(id);
  }

  add_points(points: number): void {
    this.data.career_points += Math.round(points);
    this.check_unlocks();
    this.save();
  }

  record_near_misses(count: number): void {
    this.data.career_near_misses = Math.max(this.data.career_near_misses, count);
    this.save();
  }

  submit_score(score: number): boolean {
    const is_best = score > this.data.best_score;
    if (is_best) this.data.best_score = Math.round(score);
    this.save();
    return is_best;
  }

  private check_unlocks(): void {
    for (const unlock of UNLOCKS) {
      if (this.data.career_points >= unlock.cost_points && !this.is_unlocked(unlock.id)) {
        this.data.unlocked.push(unlock.id);
        this.notify(unlock);
      }
    }
  }
}
