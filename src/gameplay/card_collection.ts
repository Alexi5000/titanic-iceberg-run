// file: src/gameplay/card_collection.ts
// description: Card collection and career-stat persistence - earned cards with freeze-frame art and run stamps, plus career runs/distance tracking
// reference: src/gameplay/cards.ts, src/ui/card_ui.ts, src/main.ts

import { CARD_DEFS, CardDef, CardSuit } from './cards';

export interface EarnedCard {
  id: string;
  earned_at: string;
  distance: number;
  score: number;
  /** Downscaled freeze-frame data URL captured at the earn moment (may be empty for feats). */
  art: string;
}

interface CardsSave {
  version: number;
  cards: EarnedCard[];
}

interface CareerSave {
  version: number;
  runs: number;
  distance: number;
}

const CARDS_KEY = 'tir.cards.v1';
const CAREER_KEY = 'tir.career.v1';

export class CardCollection {
  private cards: EarnedCard[] = [];
  private career: CareerSave = { version: 1, runs: 0, distance: 0 };

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(CARDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CardsSave>;
        if (Array.isArray(parsed.cards)) this.cards = parsed.cards;
      }
      const career_raw = localStorage.getItem(CAREER_KEY);
      if (career_raw) {
        const parsed = JSON.parse(career_raw) as Partial<CareerSave>;
        this.career = {
          version: 1,
          runs: parsed.runs ?? 0,
          distance: parsed.distance ?? 0,
        };
      }
    } catch {
      this.cards = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(CARDS_KEY, JSON.stringify({ version: 1, cards: this.cards } satisfies CardsSave));
      localStorage.setItem(CAREER_KEY, JSON.stringify(this.career));
    } catch {
      // Quota exceeded or private mode: drop oldest art payloads and retry once.
      for (const card of this.cards) card.art = '';
      try {
        localStorage.setItem(CARDS_KEY, JSON.stringify({ version: 1, cards: this.cards } satisfies CardsSave));
      } catch {
        // Persistence unavailable.
      }
    }
  }

  is_owned(id: string): boolean {
    return this.cards.some((c) => c.id === id);
  }

  get owned_count(): number {
    return this.cards.length;
  }

  get_earned(id: string): EarnedCard | undefined {
    return this.cards.find((c) => c.id === id);
  }

  suit_progress(suit: CardSuit): { owned: number; total: number } {
    const suit_defs = CARD_DEFS.filter((d) => d.suit === suit);
    const owned = suit_defs.filter((d) => this.is_owned(d.id)).length;
    return { owned, total: suit_defs.length };
  }

  add(def: CardDef, distance: number, score: number, art: string): EarnedCard | null {
    if (this.is_owned(def.id)) return null;
    const earned: EarnedCard = {
      id: def.id,
      earned_at: new Date().toISOString(),
      distance: Math.round(distance),
      score: Math.round(score),
      art,
    };
    this.cards.push(earned);
    this.save();
    return earned;
  }

  get career_runs(): number {
    return this.career.runs;
  }

  get career_distance(): number {
    return this.career.distance;
  }

  record_run(distance: number): void {
    this.career.runs += 1;
    this.career.distance += Math.round(distance);
    this.save();
  }
}
