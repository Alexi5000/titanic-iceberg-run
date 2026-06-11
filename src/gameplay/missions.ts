// file: src/gameplay/missions.ts
// description: Mission system - per-run objectives tracked against ship state with completion notifications and point rewards
// reference: src/main.ts, src/core/game_state.ts, src/gameplay/rewards.ts

import { GameState } from '../core/game_state';
import { ShipPhysics, TelegraphOrder } from '../ship/ship_physics';
import { UNITS_PER_NAUTICAL_MILE } from './scoring';

export interface MissionDef {
  id: string;
  title: string;
  description: string;
  reward_points: number;
  target: number;
}

export interface MissionProgress {
  def: MissionDef;
  progress: number;
  complete: boolean;
}

export type MissionNotify = (mission: MissionDef) => void;

const MISSIONS: MissionDef[] = [
  {
    id: 'steady_ahead',
    title: 'Steady Ahead',
    description: 'Travel 2 nautical miles',
    reward_points: 200,
    target: 2 * UNITS_PER_NAUTICAL_MILE,
  },
  {
    id: 'iron_nerves',
    title: 'Iron Nerves',
    description: 'Skim past 3 icebergs without touching',
    reward_points: 350,
    target: 3,
  },
  {
    id: 'full_steam',
    title: 'Full Steam',
    description: 'Hold FULL AHEAD for 60 seconds',
    reward_points: 300,
    target: 60,
  },
  {
    id: 'untouchable',
    title: 'Untouchable',
    description: 'Travel 4 nautical miles with zero hull damage',
    reward_points: 600,
    target: 4 * UNITS_PER_NAUTICAL_MILE,
  },
  {
    id: 'hard_about',
    title: 'Hard About!',
    description: 'Survive 12 near misses across your career',
    reward_points: 500,
    target: 12,
  },
];

export class MissionTracker {
  readonly missions: MissionProgress[] = [];
  private full_steam_timer = 0;
  private career_near_misses: number;
  private readonly notify: MissionNotify;

  constructor(notify: MissionNotify, career_near_misses: number) {
    this.notify = notify;
    this.career_near_misses = career_near_misses;
    for (const def of MISSIONS) this.missions.push({ def, progress: 0, complete: false });
  }

  attach(state: GameState): void {
    state.on('near_miss', () => {
      this.career_near_misses += 1;
      this.bump('iron_nerves', 1);
      this.set_progress('hard_about', this.career_near_misses);
    });
  }

  update(delta: number, state: GameState, physics: ShipPhysics): void {
    this.set_progress('steady_ahead', physics.distance_travelled);

    if (physics.telegraph === TelegraphOrder.FullAhead && Math.abs(physics.speed) > 30) {
      this.full_steam_timer += delta;
    } else {
      this.full_steam_timer = 0;
    }
    this.set_progress('full_steam', this.full_steam_timer);

    if (state.grazes === 0) {
      this.set_progress('untouchable', physics.distance_travelled);
    }
  }

  get_near_miss_career_total(): number {
    return this.career_near_misses;
  }

  private find(id: string): MissionProgress | undefined {
    return this.missions.find((m) => m.def.id === id);
  }

  private bump(id: string, amount: number): void {
    const mission = this.find(id);
    if (!mission || mission.complete) return;
    this.set_progress(id, mission.progress + amount);
  }

  private set_progress(id: string, value: number): void {
    const mission = this.find(id);
    if (!mission || mission.complete) return;
    mission.progress = value;
    if (mission.progress >= mission.def.target) {
      mission.complete = true;
      mission.progress = mission.def.target;
      this.notify(mission.def);
    }
  }

  reset_run(): void {
    this.full_steam_timer = 0;
    for (const mission of this.missions) {
      if (mission.def.id === 'hard_about') continue; // career mission persists
      mission.progress = 0;
      mission.complete = false;
    }
  }
}
