// file: src/gameplay/cards.ts
// description: Collectible card definitions and deterministic trigger detection - 24 cards across Moments, Ships, and Feats suits with 4 rarities
// reference: src/gameplay/card_collection.ts, src/ui/card_ui.ts, src/main.ts

export type CardSuit = 'moments' | 'ships' | 'feats';
export type CardRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface CardDef {
  id: string;
  suit: CardSuit;
  rarity: CardRarity;
  title: string;
  flavor: string;
  hint: string;
}

export const CARD_DEFS: CardDef[] = [
  // Moments - dramatic things that happened mid-run.
  { id: 'close_shave', suit: 'moments', rarity: 'common', title: 'Close Shave', flavor: 'The ice waved as it went by.', hint: 'Skim past your first iceberg' },
  { id: 'double_trouble', suit: 'moments', rarity: 'uncommon', title: 'Double Trouble', flavor: 'Two for the price of one heartbeat.', hint: 'Two near misses within 3 seconds' },
  { id: 'hat_trick', suit: 'moments', rarity: 'uncommon', title: 'Hat Trick', flavor: 'Three growlers, zero scratches.', hint: 'Three near misses within 10 seconds' },
  { id: 'ghost_graze', suit: 'moments', rarity: 'uncommon', title: 'Mountain Passing', flavor: 'It blotted out the stars.', hint: 'Near-miss a truly massive berg' },
  { id: 'full_stop', suit: 'moments', rarity: 'common', title: 'All Stop', flavor: 'Forty thousand tons, parked.', hint: 'Come to a complete stop from full speed' },
  { id: 'midnight_runner', suit: 'moments', rarity: 'uncommon', title: 'Midnight Runner', flavor: 'The stokers earned their pay tonight.', hint: 'Hold Full Ahead for a full minute' },
  { id: 'kiss_of_frost', suit: 'moments', rarity: 'rare', title: 'Kiss of Frost', flavor: 'She shrugged it off. Barely.', hint: 'Survive a graze with under 10% hull' },
  { id: 'last_breath', suit: 'moments', rarity: 'rare', title: 'On Her Last Breath', flavor: 'Held together by paint and prayers.', hint: 'Sail over a mile below 25% hull' },
  { id: 'storm_pilot', suit: 'moments', rarity: 'rare', title: 'Storm Pilot', flavor: 'The ice started avoiding her.', hint: 'Five near misses in a single run' },
  { id: 'the_turn', suit: 'moments', rarity: 'legendary', title: 'The Turn', flavor: 'Hard a-starboard, full ahead, and a whisper of ice.', hint: 'Near-miss at Full Ahead with the rudder hard over' },

  // Ships - states of your vessel and nods to history.
  { id: 'maiden_voyage', suit: 'ships', rarity: 'common', title: 'Maiden Voyage', flavor: 'Every legend starts somewhere.', hint: 'Complete your first crossing attempt' },
  { id: 'dusk_dancer', suit: 'ships', rarity: 'common', title: 'Dusk Dancer', flavor: 'Painted by the last light.', hint: 'Sail a true distance under the Dusk sky' },
  { id: 'aurora_chaser', suit: 'ships', rarity: 'uncommon', title: 'Aurora Chaser', flavor: 'Green fire overhead, black ice below.', hint: 'Sail a true distance under the Aurora' },
  { id: 'searchlight_sailor', suit: 'ships', rarity: 'uncommon', title: 'Night Lighter', flavor: 'A blade of light through the dark.', hint: 'Sail far with the searchlight fitted' },
  { id: 'golden_lady', suit: 'ships', rarity: 'uncommon', title: 'Golden Lady', flavor: 'Four gilded crowns on the skyline.', hint: 'Sail far with golden funnels fitted' },
  { id: 'night_watch', suit: 'ships', rarity: 'rare', title: 'Night Watch', flavor: 'Eyes forward. Always forward.', hint: 'Spend a long watch on the bridge cam in one run' },
  { id: 'old_salt', suit: 'ships', rarity: 'rare', title: 'Old Salt', flavor: 'The sea knows her name now.', hint: 'Complete ten career crossings' },
  { id: 'the_unsinkable', suit: 'ships', rarity: 'legendary', title: 'The Unsinkable', flavor: 'God himself could not sink this ship. Tonight, he did not try.', hint: 'Sail over 4 miles without a single scratch' },

  // Feats - career milestones.
  { id: 'survivor', suit: 'feats', rarity: 'common', title: 'Survivor', flavor: 'Two minutes longer than the odds.', hint: 'Stay afloat for two minutes in one run' },
  { id: 'long_haul', suit: 'feats', rarity: 'uncommon', title: 'The Long Haul', flavor: 'Miles in the wake, miles to go.', hint: 'Accumulate 10 nautical miles across your career' },
  { id: 'centurion', suit: 'feats', rarity: 'uncommon', title: 'Centurion', flavor: 'A hundred icy handshakes.', hint: 'Reach 100 career near misses' },
  { id: 'pea_souper', suit: 'feats', rarity: 'rare', title: 'Pea Souper', flavor: 'Sailing by sound and superstition.', hint: 'Sail a mile through the deepest fog' },
  { id: 'collector', suit: 'feats', rarity: 'rare', title: 'The Collector', flavor: 'A pocket full of frozen memories.', hint: 'Own 12 cards' },
  { id: 'iceberg_whisperer', suit: 'feats', rarity: 'legendary', title: 'Iceberg Whisperer', flavor: 'The North Atlantic filed a complaint.', hint: 'Complete all 5 missions in a single run' },

  // Daily Voyage exclusives.
  { id: 'first_light', suit: 'feats', rarity: 'uncommon', title: 'First Light', flavor: 'Same ocean as everyone. Better captain.', hint: 'Complete a Daily Voyage' },
  { id: 'streak_keeper', suit: 'feats', rarity: 'rare', title: 'Streak Keeper', flavor: 'Three dawns, three crossings, zero excuses.', hint: 'Reach a 3-day Daily Voyage streak' },
];

export function card_def(id: string): CardDef | undefined {
  return CARD_DEFS.find((c) => c.id === id);
}

/** Per-frame context the detector evaluates trigger conditions against. */
export interface CardContext {
  run_time: number;
  distance: number;
  hull: number;
  speed: number;
  rudder: number;
  telegraph_is_full_ahead: boolean;
  near_misses_run: number;
  grazes_run: number;
  palette_id: string;
  fog_density: number;
  base_fog_density: number;
  bridge_cam_active: boolean;
  searchlight_unlocked: boolean;
  golden_funnels_unlocked: boolean;
  missions_complete_run: number;
  career_runs: number;
  career_distance: number;
  career_near_misses: number;
  cards_owned: number;
}

export type CardEarnHandler = (def: CardDef) => void;

export class CardDetector {
  private readonly earn: CardEarnHandler;
  private readonly is_owned: (id: string) => boolean;
  private near_miss_times: number[] = [];
  private was_full_speed = false;
  private bridge_time = 0;
  private fog_distance = 0;
  private last_distance = 0;
  private last_near_miss_was_big = false;

  constructor(earn: CardEarnHandler, is_owned: (id: string) => boolean) {
    this.earn = earn;
    this.is_owned = is_owned;
  }

  private try_earn(id: string): void {
    if (this.is_owned(id)) return;
    const def = card_def(id);
    if (def) this.earn(def);
  }

  /** Call when a near miss happens. */
  on_near_miss(ctx: CardContext, berg_radius: number): void {
    this.near_miss_times.push(ctx.run_time);
    this.near_miss_times = this.near_miss_times.filter((t) => ctx.run_time - t <= 10);
    this.last_near_miss_was_big = berg_radius > 42;

    this.try_earn('close_shave');
    if (this.near_miss_times.filter((t) => ctx.run_time - t <= 3).length >= 2) this.try_earn('double_trouble');
    if (this.near_miss_times.length >= 3) this.try_earn('hat_trick');
    if (this.last_near_miss_was_big) this.try_earn('ghost_graze');
    if (ctx.near_misses_run >= 5) this.try_earn('storm_pilot');
    if (ctx.telegraph_is_full_ahead && Math.abs(ctx.rudder) > 0.5) this.try_earn('the_turn');
    if (ctx.career_near_misses >= 100) this.try_earn('centurion');
  }

  /** Call when a graze happens (after damage applied). */
  on_graze(ctx: CardContext): void {
    if (ctx.hull > 0 && ctx.hull <= 10) this.try_earn('kiss_of_frost');
  }

  /** Call when a mission completes. */
  on_mission_complete(ctx: CardContext): void {
    if (ctx.missions_complete_run >= 5) this.try_earn('iceberg_whisperer');
  }

  /** Call every frame while playing. */
  update(delta: number, ctx: CardContext): void {
    // All Stop: was at full speed, now stationary.
    if (Math.abs(ctx.speed) > 30) this.was_full_speed = true;
    if (this.was_full_speed && Math.abs(ctx.speed) < 0.5) {
      this.try_earn('full_stop');
      this.was_full_speed = false;
    }

    if (ctx.bridge_cam_active) {
      this.bridge_time += delta;
      if (this.bridge_time >= 60) this.try_earn('night_watch');
    }

    const travelled = Math.max(ctx.distance - this.last_distance, 0);
    this.last_distance = ctx.distance;
    if (ctx.fog_density > ctx.base_fog_density + 0.0008) {
      this.fog_distance += travelled;
      if (this.fog_distance >= 600) this.try_earn('pea_souper');
    }

    if (ctx.run_time >= 120) this.try_earn('survivor');
    if (ctx.hull <= 25 && ctx.hull > 0 && ctx.distance >= 600 && ctx.grazes_run > 0) this.try_earn('last_breath');
    if (ctx.grazes_run === 0 && ctx.distance >= 2400) this.try_earn('the_unsinkable');
    if (ctx.career_distance + ctx.distance >= 6000) this.try_earn('long_haul');
    if (ctx.cards_owned >= 12) this.try_earn('collector');
  }

  /** Call when a daily voyage attempt is scored. */
  on_daily_scored(streak: number): void {
    this.try_earn('first_light');
    if (streak >= 3) this.try_earn('streak_keeper');
  }

  /** Call once at game over. */
  on_run_end(ctx: CardContext): void {
    this.try_earn('maiden_voyage');
    if (ctx.distance >= 600) {
      if (ctx.palette_id === 'dusk') this.try_earn('dusk_dancer');
      if (ctx.palette_id === 'aurora') this.try_earn('aurora_chaser');
      if (ctx.searchlight_unlocked) this.try_earn('searchlight_sailor');
      if (ctx.golden_funnels_unlocked) this.try_earn('golden_lady');
    }
    if (ctx.career_runs >= 10) this.try_earn('old_salt');
  }

  reset_run(): void {
    this.near_miss_times = [];
    this.was_full_speed = false;
    this.bridge_time = 0;
    this.fog_distance = 0;
    this.last_distance = 0;
  }
}
