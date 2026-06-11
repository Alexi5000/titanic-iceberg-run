// file: src/ship/ship_physics.ts
// description: Ship movement model - engine telegraph speed states, rudder steering with turning inertia, heading and position integration
// reference: src/main.ts, src/core/input_manager.ts, src/ship/titanic_model.ts

import { InputManager } from '../core/input_manager';

export enum TelegraphOrder {
  FullAstern = 0,
  HalfAstern = 1,
  Stop = 2,
  SlowAhead = 3,
  HalfAhead = 4,
  FullAhead = 5,
}

export const TELEGRAPH_LABELS: Record<TelegraphOrder, string> = {
  [TelegraphOrder.FullAstern]: 'FULL ASTERN',
  [TelegraphOrder.HalfAstern]: 'HALF ASTERN',
  [TelegraphOrder.Stop]: 'STOP',
  [TelegraphOrder.SlowAhead]: 'SLOW AHEAD',
  [TelegraphOrder.HalfAhead]: 'HALF AHEAD',
  [TelegraphOrder.FullAhead]: 'FULL AHEAD',
};

/** Target speed in world units per second for each telegraph order (arcade-scaled knots). */
const TELEGRAPH_SPEEDS: Record<TelegraphOrder, number> = {
  [TelegraphOrder.FullAstern]: -14,
  [TelegraphOrder.HalfAstern]: -7,
  [TelegraphOrder.Stop]: 0,
  [TelegraphOrder.SlowAhead]: 12,
  [TelegraphOrder.HalfAhead]: 24,
  [TelegraphOrder.FullAhead]: 38,
};

const ACCELERATION = 2.2;
const DECELERATION = 3.4;
const MAX_RUDDER_ANGLE = 0.6; // radians of rudder deflection
const RUDDER_RATE = 0.55; // how fast the wheel turns the rudder
const RUDDER_RETURN_RATE = 0.35; // rudder self-centering when no input
const TURN_RESPONSE = 0.022; // yaw rate per rudder angle per speed unit

export class ShipPhysics {
  x = 0;
  z = 0;
  heading = 0; // yaw radians, forward = (sin(heading), cos(heading))
  speed = 0; // world units per second, negative = astern
  rudder = 0; // -MAX..+MAX, positive = port turn
  telegraph: TelegraphOrder = TelegraphOrder.Stop;
  distance_travelled = 0;
  /** Visual heel induced by turning, consumed by the ship model. */
  turn_heel = 0;

  telegraph_up(): void {
    if (this.telegraph < TelegraphOrder.FullAhead) this.telegraph += 1;
  }

  telegraph_down(): void {
    if (this.telegraph > TelegraphOrder.FullAstern) this.telegraph -= 1;
  }

  read_input(input: InputManager): void {
    if (input.was_pressed('KeyW') || input.was_pressed('ArrowUp')) this.telegraph_up();
    if (input.was_pressed('KeyS') || input.was_pressed('ArrowDown')) this.telegraph_down();

    const steer_left = input.is_held('KeyA') || input.is_held('ArrowLeft');
    const steer_right = input.is_held('KeyD') || input.is_held('ArrowRight');
    this.steer_input = (steer_left ? 1 : 0) - (steer_right ? 1 : 0);
  }

  private steer_input = 0;

  update(delta: number): void {
    // Engine: ease current speed toward the telegraph target. Big ships do not stop quickly.
    const target = TELEGRAPH_SPEEDS[this.telegraph];
    const rate = Math.abs(target) > Math.abs(this.speed) ? ACCELERATION : DECELERATION;
    if (this.speed < target) this.speed = Math.min(this.speed + rate * delta, target);
    else if (this.speed > target) this.speed = Math.max(this.speed - rate * delta, target);

    // Rudder: deflect with input, self-center without.
    if (this.steer_input !== 0) {
      this.rudder += this.steer_input * RUDDER_RATE * delta;
      this.rudder = Math.max(-MAX_RUDDER_ANGLE, Math.min(MAX_RUDDER_ANGLE, this.rudder));
    } else if (this.rudder !== 0) {
      const sign = Math.sign(this.rudder);
      this.rudder -= sign * RUDDER_RETURN_RATE * delta;
      if (Math.sign(this.rudder) !== sign) this.rudder = 0;
    }

    // Turning authority scales with water flow over the rudder.
    const flow = Math.abs(this.speed);
    const yaw_rate = this.rudder * TURN_RESPONSE * flow * (this.speed >= 0 ? 1 : -1);
    this.heading += yaw_rate * delta;

    this.turn_heel = -yaw_rate * 2.4;

    const fwd_x = Math.sin(this.heading);
    const fwd_z = Math.cos(this.heading);
    this.x += fwd_x * this.speed * delta;
    this.z += fwd_z * this.speed * delta;
    this.distance_travelled += Math.max(this.speed, 0) * delta;
  }

  /** Approximate speed in knots for HUD display (world units scaled). */
  get knots(): number {
    return this.speed * 0.58;
  }

  reset(): void {
    this.x = 0;
    this.z = 0;
    this.heading = 0;
    this.speed = 0;
    this.rudder = 0;
    this.telegraph = TelegraphOrder.Stop;
    this.distance_travelled = 0;
    this.turn_heel = 0;
    this.steer_input = 0;
  }
}
