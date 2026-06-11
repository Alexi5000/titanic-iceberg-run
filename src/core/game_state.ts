// file: src/core/game_state.ts
// description: Central game state - phase machine, hull integrity, score counters, and lightweight event callbacks
// reference: src/main.ts, src/ship/collision.ts, src/gameplay/scoring.ts

export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  Sinking = 'sinking',
  GameOver = 'gameover',
}

export type GameEvent = 'graze' | 'fatal' | 'near_miss' | 'phase_change';

type EventHandler = () => void;

export class GameState {
  phase: GamePhase = GamePhase.Title;
  hull = 100;
  score = 0;
  near_misses = 0;
  grazes = 0;
  run_time = 0;

  private readonly handlers = new Map<GameEvent, EventHandler[]>();

  on(event: GameEvent, handler: EventHandler): void {
    const list = this.handlers.get(event) ?? [];
    list.push(handler);
    this.handlers.set(event, list);
  }

  emit(event: GameEvent): void {
    for (const handler of this.handlers.get(event) ?? []) handler();
  }

  set_phase(phase: GamePhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.emit('phase_change');
  }

  apply_graze(damage: number): void {
    this.hull = Math.max(0, this.hull - damage);
    this.grazes += 1;
    this.emit('graze');
    if (this.hull <= 0) this.apply_fatal();
  }

  apply_fatal(): void {
    this.hull = 0;
    this.set_phase(GamePhase.Sinking);
    this.emit('fatal');
  }

  register_near_miss(): void {
    this.near_misses += 1;
    this.emit('near_miss');
  }

  reset_run(): void {
    this.hull = 100;
    this.score = 0;
    this.near_misses = 0;
    this.grazes = 0;
    this.run_time = 0;
  }
}
