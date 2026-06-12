// file: src/ui/card_ui.ts
// description: Card UI - DOM card elements, game-over flip reveals, and the full-screen gallery with suit tabs, silhouettes, and tilt inspect
// reference: src/gameplay/cards.ts, src/gameplay/card_collection.ts, src/ui/menus.ts

import { CARD_DEFS, CardDef, CardSuit } from '../gameplay/cards';
import { CardCollection, EarnedCard } from '../gameplay/card_collection';
import { SKINS, SkinSystem, requirement_text } from '../gameplay/skins';
import { inject_ui_styles } from './ui_styles';

const SUIT_LABELS: Record<CardSuit, string> = {
  moments: 'Moments',
  ships: 'Ships',
  feats: 'Feats',
};

export function build_card_element(def: CardDef, earned: EarnedCard | null): HTMLDivElement {
  const card = document.createElement('div');
  card.className = `card rarity-${def.rarity}${earned ? '' : ' silhouette'}`;

  const art = document.createElement('img');
  art.className = 'card-art';
  art.alt = def.title;
  if (earned && earned.art) art.src = earned.art;
  card.appendChild(art);

  const suit_tag = document.createElement('div');
  suit_tag.className = 'card-suit-tag';
  suit_tag.textContent = `${SUIT_LABELS[def.suit]} | ${def.rarity}`;
  card.appendChild(suit_tag);

  if (!earned) {
    const mark = document.createElement('div');
    mark.className = 'card-hint-mark';
    mark.textContent = '?';
    card.appendChild(mark);
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = earned ? def.title : '???';

  const flavor = document.createElement('div');
  flavor.className = 'card-flavor';
  flavor.textContent = earned ? def.flavor : def.hint;

  body.append(title, flavor);

  if (earned) {
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    const date = new Date(earned.earned_at);
    meta.textContent = `Earned ${date.toLocaleDateString()} | ${earned.distance}m | ${earned.score.toLocaleString()} pts`;
    body.appendChild(meta);
  }

  card.appendChild(body);
  return card;
}

type GalleryTab = CardSuit | 'skins';

export class CardGallery {
  private readonly root: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly sub: HTMLDivElement;
  private readonly tabs = new Map<GalleryTab, HTMLButtonElement>();
  private readonly inspect_backdrop: HTMLDivElement;
  private active_suit: GalleryTab = 'moments';
  private readonly collection: CardCollection;
  private readonly skins: SkinSystem;
  /** Called when the equipped skin changes so the 3D ship can update. */
  on_skin_change: () => void = () => undefined;
  is_open = false;

  constructor(parent: HTMLElement, collection: CardCollection, skins: SkinSystem) {
    inject_ui_styles();
    this.collection = collection;
    this.skins = skins;

    this.root = document.createElement('div');
    this.root.className = 'gallery hidden';

    const close = document.createElement('button');
    close.className = 'gallery-close';
    close.textContent = 'X';
    close.addEventListener('click', () => this.close());
    this.root.appendChild(close);

    const title = document.createElement('h2');
    title.className = 'gallery-title';
    title.textContent = 'CARD COLLECTION';
    this.root.appendChild(title);

    this.sub = document.createElement('div');
    this.sub.className = 'gallery-sub';
    this.root.appendChild(this.sub);

    const tabs = document.createElement('div');
    tabs.className = 'gallery-tabs';
    for (const suit of ['moments', 'ships', 'feats', 'skins'] as GalleryTab[]) {
      const tab = document.createElement('button');
      tab.className = 'gallery-tab';
      tab.addEventListener('click', () => {
        this.active_suit = suit;
        this.refresh();
      });
      tabs.appendChild(tab);
      this.tabs.set(suit, tab);
    }
    this.root.appendChild(tabs);

    this.grid = document.createElement('div');
    this.grid.className = 'gallery-grid';
    this.root.appendChild(this.grid);

    this.inspect_backdrop = document.createElement('div');
    this.inspect_backdrop.className = 'card-inspect-backdrop hidden';
    this.inspect_backdrop.addEventListener('click', () => {
      this.inspect_backdrop.classList.add('hidden');
      this.inspect_backdrop.replaceChildren();
    });
    parent.appendChild(this.inspect_backdrop);

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
    this.inspect_backdrop.classList.add('hidden');
    this.inspect_backdrop.replaceChildren();
  }

  private inspect(def: CardDef, earned: EarnedCard): void {
    this.inspect_backdrop.replaceChildren();
    const card = build_card_element(def, earned);
    card.classList.add('card-reveal');
    this.inspect_backdrop.appendChild(card);
    this.inspect_backdrop.classList.remove('hidden');

    // Parallax tilt following the pointer.
    this.inspect_backdrop.onpointermove = (event) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      card.style.transform = `perspective(900px) rotateY(${nx * 14}deg) rotateX(${-ny * 12}deg)`;
    };
  }

  refresh(): void {
    for (const [tab_id, tab] of this.tabs) {
      if (tab_id === 'skins') {
        const unlocked = SKINS.filter((s) => this.skins.is_unlocked(s)).length;
        tab.textContent = `Skins ${unlocked}/${SKINS.length}`;
      } else {
        const progress = this.collection.suit_progress(tab_id);
        tab.textContent = `${SUIT_LABELS[tab_id]} ${progress.owned}/${progress.total}`;
      }
      tab.classList.toggle('active', tab_id === this.active_suit);
    }

    this.sub.textContent = `${this.collection.owned_count} of ${CARD_DEFS.length} collected`;

    this.grid.replaceChildren();

    if (this.active_suit === 'skins') {
      this.render_skins();
      return;
    }

    for (const def of CARD_DEFS.filter((d) => d.suit === this.active_suit)) {
      const earned = this.collection.get_earned(def.id) ?? null;
      const el = build_card_element(def, earned);
      if (earned) {
        el.addEventListener('click', () => this.inspect(def, earned));
      }
      this.grid.appendChild(el);
    }
  }

  private render_skins(): void {
    const equipped = this.skins.equipped;

    const make_tile = (
      title: string,
      description: string,
      unlocked: boolean,
      is_equipped: boolean,
      on_equip: () => void,
    ) => {
      const tile = document.createElement('div');
      tile.className = `card${unlocked ? '' : ' silhouette'}`;
      tile.style.width = '200px';

      const body = document.createElement('div');
      body.className = 'card-body';

      const title_el = document.createElement('div');
      title_el.className = 'card-title';
      title_el.textContent = title;

      const desc_el = document.createElement('div');
      desc_el.className = 'card-flavor';
      desc_el.textContent = description;

      body.append(title_el, desc_el);

      const button = document.createElement('button');
      button.className = 'menu-button';
      button.style.marginTop = '10px';
      button.style.padding = '5px 14px';
      button.style.fontSize = '11px';
      if (!unlocked) {
        button.textContent = 'Locked';
        button.disabled = true;
      } else if (is_equipped) {
        button.textContent = 'Equipped';
        button.disabled = true;
      } else {
        button.textContent = 'Equip';
        button.addEventListener('click', on_equip);
      }
      body.appendChild(button);
      tile.appendChild(body);
      this.grid.appendChild(tile);
    };

    make_tile('Classic Livery', 'The original White Star colors', true, equipped === null, () => {
      this.skins.equip(null);
      this.on_skin_change();
      this.refresh();
    });

    for (const def of SKINS) {
      const unlocked = this.skins.is_unlocked(def);
      make_tile(
        def.title,
        unlocked ? def.description : requirement_text(def),
        unlocked,
        equipped === def.id,
        () => {
          this.skins.equip(def.id);
          this.on_skin_change();
          this.refresh();
        },
      );
    }
  }
}

/** Builds the staggered flip-reveal block for the game-over screen. */
export function build_reveal_block(new_cards: { def: CardDef; earned: EarnedCard }[]): HTMLDivElement {
  const wrap = document.createElement('div');
  if (new_cards.length === 0) return wrap;

  const label = document.createElement('div');
  label.className = 'gameover-cards-label';
  label.textContent = new_cards.length === 1 ? 'NEW CARD EARNED' : `${new_cards.length} NEW CARDS EARNED`;
  wrap.appendChild(label);

  const row = document.createElement('div');
  row.className = 'gameover-cards';
  new_cards.forEach((item, index) => {
    const el = build_card_element(item.def, item.earned);
    el.classList.add('card-reveal');
    el.style.animationDelay = `${0.5 + index * 0.6}s`;
    row.appendChild(el);
  });
  wrap.appendChild(row);
  return wrap;
}
