// file: src/gameplay/skins.ts
// description: Card-set-gated cosmetic ship skins - unlock requirements against the card collection and persisted equip state
// reference: src/gameplay/card_collection.ts, src/ship/titanic_model.ts, src/ui/card_ui.ts

import { CARD_DEFS, CardSuit } from './cards';
import { CardCollection } from './card_collection';

export interface SkinDef {
  id: string;
  title: string;
  description: string;
  requirement: { suit: CardSuit; count: number } | { total: number };
}

export const SKINS: SkinDef[] = [
  {
    id: 'royal_mail',
    title: 'Royal Mail Red',
    description: 'Crimson hull with a cream boot-top',
    requirement: { suit: 'moments', count: 6 },
  },
  {
    id: 'brass_teak',
    title: 'Brass & Teak',
    description: 'Warm teak decks and gleaming brass funnels',
    requirement: { suit: 'ships', count: 5 },
  },
  {
    id: 'ghost',
    title: 'Ghost Ship',
    description: 'A pale translucent legend of the North Atlantic',
    requirement: { suit: 'feats', count: 4 },
  },
  {
    id: 'rainbow',
    title: 'Rainbow Funnels',
    description: 'Four funnels, four colors, one complete collection',
    requirement: { total: CARD_DEFS.length },
  },
];

const EQUIP_KEY = 'tir.skin.v1';

export function requirement_text(def: SkinDef): string {
  if ('total' in def.requirement) return `Collect all ${def.requirement.total} cards`;
  const suit_name = def.requirement.suit.charAt(0).toUpperCase() + def.requirement.suit.slice(1);
  return `Collect ${def.requirement.count} ${suit_name} cards`;
}

export class SkinSystem {
  private readonly collection: CardCollection;
  private equipped_id: string | null = null;

  constructor(collection: CardCollection) {
    this.collection = collection;
    try {
      this.equipped_id = localStorage.getItem(EQUIP_KEY);
    } catch {
      this.equipped_id = null;
    }
  }

  is_unlocked(def: SkinDef): boolean {
    if ('total' in def.requirement) return this.collection.owned_count >= def.requirement.total;
    return this.collection.suit_progress(def.requirement.suit).owned >= def.requirement.count;
  }

  get equipped(): string | null {
    if (!this.equipped_id) return null;
    const def = SKINS.find((s) => s.id === this.equipped_id);
    if (!def || !this.is_unlocked(def)) return null;
    return this.equipped_id;
  }

  equip(id: string | null): void {
    this.equipped_id = id;
    try {
      if (id) localStorage.setItem(EQUIP_KEY, id);
      else localStorage.removeItem(EQUIP_KEY);
    } catch {
      // No persistence available.
    }
  }
}
