// file: src/gameplay/records.ts
// description: Local records board - top-10 runs per mode persisted to localStorage with rank detection for celebrations
// reference: src/main.ts, src/ui/records_ui.ts

export type GameMode = 'endless' | 'daily';

export interface RunRecord {
  score: number;
  distance: number;
  near_misses: number;
  run_time: number;
  cards_earned: number;
  date: string;
}

interface RecordsSave {
  version: number;
  endless: RunRecord[];
  daily: RunRecord[];
}

const KEY = 'tir.records.v1';
const MAX_RECORDS = 10;

export class RecordsBoard {
  private data: RecordsSave = { version: 1, endless: [], daily: [] };

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RecordsSave>;
        this.data = {
          version: 1,
          endless: Array.isArray(parsed.endless) ? parsed.endless : [],
          daily: Array.isArray(parsed.daily) ? parsed.daily : [],
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

  top(mode: GameMode): RunRecord[] {
    return this.data[mode];
  }

  /** Insert a run; returns its rank (0-based) within the top 10, or -1 if it did not place. */
  submit(mode: GameMode, record: RunRecord): number {
    const list = this.data[mode];
    list.push(record);
    list.sort((a, b) => b.score - a.score);
    if (list.length > MAX_RECORDS) list.length = MAX_RECORDS;
    this.save();
    return list.indexOf(record);
  }
}
