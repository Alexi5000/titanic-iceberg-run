// file: src/ship/sinking_sequence.ts
// description: Sinking animation - pitches the liner down by the bow and settles her under over a timed sequence after a fatal collision
// reference: src/main.ts, src/ship/titanic_model.ts, src/core/game_state.ts

import * as THREE from 'three';

const SINK_DURATION = 14;

export class SinkingSequence {
  private timer = 0;
  active = false;

  begin(): void {
    this.active = true;
    this.timer = 0;
  }

  /** Progress 0..1 through the sinking. */
  get progress(): number {
    return Math.min(this.timer / SINK_DURATION, 1);
  }

  get finished(): boolean {
    return this.active && this.timer >= SINK_DURATION;
  }

  /** Applies sinking pose on top of the ship group transform. Returns current progress. */
  update(delta: number, ship_group: THREE.Group): number {
    if (!this.active) return 0;
    this.timer += delta;
    const t = this.progress;
    const ease = t * t;

    // Bow-first plunge: pitch grows, ship slides down and slightly forward.
    ship_group.rotation.x = ease * 0.38;
    ship_group.position.y -= ease * 46;

    return t;
  }

  reset(ship_group: THREE.Group): void {
    this.active = false;
    this.timer = 0;
    ship_group.rotation.x = 0;
  }
}
