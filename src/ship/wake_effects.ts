// file: src/ship/wake_effects.ts
// description: Pooled water interaction effects for the Titanic: a surface-following stern wake,
//              bow spray, and collision shards. The system is texture-free and keeps all
//              simulation buffers resident on the GPU-facing geometry.
// reference: src/main.ts, src/ship/ship_physics.ts, src/world/ocean.ts

import * as THREE from 'three';
import { wave_height } from '../world/ocean';

/**
 * Rendering budgets for the non-critical water interaction effects. These names deliberately
 * mirror the renderer quality tiers so the caller can switch the whole scene coherently.
 */
export type WakeQuality = 'low' | 'medium' | 'high' | 'ultra';

interface WakeQualityProfile {
  readonly foam_capacity: number;
  readonly spray_capacity: number;
  readonly shard_capacity: number;
  readonly foam_rate_scale: number;
  readonly spray_rate_scale: number;
}

const WAKE_QUALITY_PROFILES: Readonly<Record<WakeQuality, WakeQualityProfile>> = {
  low: {
    foam_capacity: 72,
    spray_capacity: 36,
    shard_capacity: 36,
    foam_rate_scale: 0.42,
    spray_rate_scale: 0.36,
  },
  medium: {
    foam_capacity: 132,
    spray_capacity: 72,
    shard_capacity: 72,
    foam_rate_scale: 0.68,
    spray_rate_scale: 0.64,
  },
  high: {
    foam_capacity: 220,
    spray_capacity: 120,
    shard_capacity: 108,
    foam_rate_scale: 1,
    spray_rate_scale: 1,
  },
  ultra: {
    foam_capacity: 300,
    spray_capacity: 180,
    shard_capacity: 144,
    foam_rate_scale: 1.22,
    spray_rate_scale: 1.18,
  },
};

interface ParticlePoolOptions {
  readonly color: number;
  readonly size: number;
  readonly opacity: number;
  readonly point_softness: number;
}

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  attribute float a_alpha;
  attribute float a_size;

  uniform float u_size;

  varying float v_alpha;

  void main() {
    vec4 model_view_position = modelViewMatrix * vec4(position, 1.0);
    float distance_scale = 260.0 / max(1.0, -model_view_position.z);
    gl_PointSize = clamp(u_size * a_size * distance_scale, 1.0, 80.0);
    gl_Position = projectionMatrix * model_view_position;
    v_alpha = a_alpha;
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 u_color;
  uniform float u_opacity;
  uniform float u_point_softness;

  varying float v_alpha;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float radius = length(point) * 2.0;
    float edge = 1.0 - smoothstep(u_point_softness, 1.0, radius);
    float alpha = v_alpha * u_opacity * edge;
    if (alpha < 0.006) discard;
    gl_FragColor = vec4(u_color, alpha);
  }
`;

/**
 * Struct-of-arrays particle storage avoids the per-frame object lookups and garbage produced by
 * short lived spray objects. The visual fade is handled through a small custom point shader.
 */
class ParticlePool {
  readonly points: THREE.Points;
  readonly positions: Float32Array;
  readonly velocities: Float32Array;
  readonly lives: Float32Array;
  readonly max_lives: Float32Array;
  readonly active: Uint8Array;
  readonly alpha: Float32Array;
  readonly sizes: Float32Array;

  readonly count: number;
  private active_count: number;
  private cursor = 0;
  private readonly geometry: THREE.BufferGeometry;
  private readonly position_attribute: THREE.BufferAttribute;
  private readonly alpha_attribute: THREE.BufferAttribute;
  private readonly size_attribute: THREE.BufferAttribute;

  constructor(count: number, options: ParticlePoolOptions) {
    this.count = count;
    this.active_count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.lives = new Float32Array(count);
    this.max_lives = new Float32Array(count);
    this.active = new Uint8Array(count);
    this.alpha = new Float32Array(count);
    this.sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      this.positions[i * 3 + 1] = -9999;
      this.sizes[i] = 1;
    }

    this.geometry = new THREE.BufferGeometry();
    this.position_attribute = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.alpha_attribute = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.size_attribute = new THREE.BufferAttribute(this.sizes, 1).setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('position', this.position_attribute);
    this.geometry.setAttribute('a_alpha', this.alpha_attribute);
    this.geometry.setAttribute('a_size', this.size_attribute);
    this.geometry.setDrawRange(0, count);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        u_color: { value: new THREE.Color(options.color) },
        u_size: { value: options.size },
        u_opacity: { value: options.opacity },
        u_point_softness: { value: options.point_softness },
      },
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    this.points = new THREE.Points(this.geometry, material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }

  set_capacity(capacity: number): void {
    const next_count = THREE.MathUtils.clamp(Math.floor(capacity), 1, this.count);
    if (next_count === this.active_count) return;

    if (next_count < this.active_count) {
      for (let i = next_count; i < this.active_count; i++) this.deactivate(i);
    }

    this.active_count = next_count;
    this.cursor %= next_count;
    this.geometry.setDrawRange(0, next_count);
    this.position_attribute.needsUpdate = true;
    this.alpha_attribute.needsUpdate = true;
  }

  emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size = 1,
  ): void {
    const index = this.cursor;
    const position_index = index * 3;
    this.active[index] = 1;
    this.lives[index] = 0;
    this.max_lives[index] = Math.max(0.01, life);
    this.velocities[position_index] = vx;
    this.velocities[position_index + 1] = vy;
    this.velocities[position_index + 2] = vz;
    this.positions[position_index] = x;
    this.positions[position_index + 1] = y;
    this.positions[position_index + 2] = z;
    this.alpha[index] = 0;
    this.sizes[index] = size;
    this.cursor = (index + 1) % this.active_count;
  }

  update(delta: number, gravity: number, drag: number): void {
    const damping = Math.exp(-drag * delta);
    let changed = false;

    for (let i = 0; i < this.active_count; i++) {
      if (this.active[i] === 0) continue;

      const next_life = this.lives[i] + delta;
      if (next_life >= this.max_lives[i]) {
        this.deactivate(i);
        changed = true;
        continue;
      }

      const position_index = i * 3;
      const age = next_life / this.max_lives[i];
      this.lives[i] = next_life;
      this.velocities[position_index + 1] -= gravity * delta;
      this.velocities[position_index] *= damping;
      this.velocities[position_index + 2] *= damping;
      this.positions[position_index] += this.velocities[position_index] * delta;
      this.positions[position_index + 1] += this.velocities[position_index + 1] * delta;
      this.positions[position_index + 2] += this.velocities[position_index + 2] * delta;

      // A quick bloom followed by a slow fade sells aerated foam and keeps old particles subtle.
      this.alpha[i] = Math.min(age * 7, 1) * Math.min((1 - age) * 2.4, 1);
      changed = true;
    }

    if (!changed) return;
    this.position_attribute.needsUpdate = true;
    this.alpha_attribute.needsUpdate = true;
  }

  /** Keep foam stuck to the animated water instead of letting it hover as waves pass below. */
  follow_surface(time: number, lift: number, bob_amplitude: number): void {
    let changed = false;
    for (let i = 0; i < this.active_count; i++) {
      if (this.active[i] === 0) continue;
      const position_index = i * 3;
      const life_ratio = this.lives[i] / this.max_lives[i];
      this.positions[position_index + 1] =
        wave_height(this.positions[position_index], this.positions[position_index + 2], time) +
        lift +
        Math.sin((i + 1) * 12.31 + time * 3.4) * bob_amplitude * (1 - life_ratio);
      changed = true;
    }

    if (changed) this.position_attribute.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }

  private deactivate(index: number): void {
    this.active[index] = 0;
    this.alpha[index] = 0;
    this.positions[index * 3 + 1] = -9999;
  }
}

export class WakeEffects {
  readonly group: THREE.Group;
  private readonly foam: ParticlePool;
  private readonly spray: ParticlePool;
  private readonly shards: ParticlePool;
  private foam_accumulator = 0;
  private spray_accumulator = 0;
  private random_state = 0x4d595df4;
  private quality_profile = WAKE_QUALITY_PROFILES.high;

  constructor() {
    this.group = new THREE.Group();
    this.foam = new ParticlePool(300, {
      color: 0xeaf8ff,
      size: 8.2,
      opacity: 0.58,
      point_softness: 0.28,
    });
    this.spray = new ParticlePool(180, {
      color: 0xd7efff,
      size: 4.3,
      opacity: 0.68,
      point_softness: 0.12,
    });
    this.shards = new ParticlePool(144, {
      color: 0xf1fbff,
      size: 5.1,
      opacity: 0.94,
      point_softness: 0.06,
    });
    this.group.add(this.foam.points, this.spray.points, this.shards.points);
    this.set_quality('high');
  }

  /**
   * Adjusts particle budgets and emission density without reallocating geometry or materials.
   * It is safe to call on a renderer quality change or in response to a performance governor.
   */
  set_quality(quality: WakeQuality): void {
    this.quality_profile = WAKE_QUALITY_PROFILES[quality];
    this.foam.set_capacity(this.quality_profile.foam_capacity);
    this.spray.set_capacity(this.quality_profile.spray_capacity);
    this.shards.set_capacity(this.quality_profile.shard_capacity);
  }

  /** Compatibility-friendly alias for UI code that calls scene quality tiers "presets". */
  set_preset(quality: WakeQuality): void {
    this.set_quality(quality);
  }

  /** Burst of ice shards at a collision point. */
  burst_shards(x: number, z: number, intense: boolean): void {
    const count = intense ? 46 : 24;
    for (let i = 0; i < count; i++) {
      const angle = this.next_random() * Math.PI * 2;
      const speed = 14 + this.next_random() * (intense ? 40 : 24);
      this.shards.emit(
        x + (this.next_random() - 0.5) * 8,
        4 + this.next_random() * 10,
        z + (this.next_random() - 0.5) * 8,
        Math.cos(angle) * speed,
        16 + this.next_random() * 22,
        Math.sin(angle) * speed,
        0.9 + this.next_random() * 0.8,
        0.72 + this.next_random() * 0.85,
      );
    }
  }

  update(
    delta: number,
    time: number,
    ship_x: number,
    ship_z: number,
    heading: number,
    speed: number,
  ): void {
    const clamped_delta = Math.min(delta, 0.05);
    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);
    const right_x = Math.cos(heading);
    const right_z = -Math.sin(heading);
    const speed_t = Math.min(Math.abs(speed) / 38, 1);

    if (speed_t > 0.055) {
      this.emit_foam(
        clamped_delta,
        time,
        ship_x,
        ship_z,
        fwd_x,
        fwd_z,
        right_x,
        right_z,
        speed,
        speed_t,
      );

      if (speed_t > 0.24) {
        this.emit_bow_spray(
          clamped_delta,
          time,
          ship_x,
          ship_z,
          fwd_x,
          fwd_z,
          right_x,
          right_z,
          speed,
          speed_t,
        );
      }
    }

    this.foam.update(clamped_delta, 0, 0.44);
    this.foam.follow_surface(time, 0.5, 0.16);
    this.spray.update(clamped_delta, 30, 0.32);
    this.shards.update(clamped_delta, 42, 0.8);
  }

  dispose(): void {
    this.foam.dispose();
    this.spray.dispose();
    this.shards.dispose();
  }

  private emit_foam(
    delta: number,
    time: number,
    ship_x: number,
    ship_z: number,
    fwd_x: number,
    fwd_z: number,
    right_x: number,
    right_z: number,
    speed: number,
    speed_t: number,
  ): void {
    // A stern fan produces the persistent, V-shaped signature while intermittent side beads
    // stitch it into the hull and prevent a detached particle ribbon.
    this.foam_accumulator += delta * (8 + speed_t * 48) * this.quality_profile.foam_rate_scale;
    let emitted = 0;
    while (this.foam_accumulator >= 1 && emitted < 14) {
      this.foam_accumulator -= 1;
      emitted++;

      const stern_bias = this.next_random();
      const side = this.next_random() < 0.5 ? -1 : 1;
      const use_stern = stern_bias < 0.72;
      const longitudinal = use_stern ? -120 - this.next_random() * 26 : -92 + this.next_random() * 162;
      const wake_width = use_stern ? 6 + this.next_random() * 24 : 17 + this.next_random() * 6;
      const px = ship_x + fwd_x * longitudinal + right_x * side * wake_width;
      const pz = ship_z + fwd_z * longitudinal + right_z * side * wake_width;
      const lateral_drift = (use_stern ? 1.8 : 0.65) * side;
      const life = use_stern ? 3.2 + this.next_random() * 2.7 : 1.9 + this.next_random() * 1.7;

      this.foam.emit(
        px + (this.next_random() - 0.5) * 7,
        wave_height(px, pz, time) + 0.5,
        pz + (this.next_random() - 0.5) * 7,
        -fwd_x * (speed * (0.075 + this.next_random() * 0.045)) + right_x * lateral_drift,
        0,
        -fwd_z * (speed * (0.075 + this.next_random() * 0.045)) + right_z * lateral_drift,
        life,
        use_stern ? 0.78 + this.next_random() * 0.95 : 0.58 + this.next_random() * 0.54,
      );
    }

    // Avoid a permanent backlog after a tab resumes; the capped emission budget deliberately
    // sacrifices old particles instead of producing an expensive catch-up burst.
    this.foam_accumulator = Math.min(this.foam_accumulator, 3);
  }

  private emit_bow_spray(
    delta: number,
    time: number,
    ship_x: number,
    ship_z: number,
    fwd_x: number,
    fwd_z: number,
    right_x: number,
    right_z: number,
    speed: number,
    speed_t: number,
  ): void {
    this.spray_accumulator +=
      delta * speed_t * (22 + speed_t * 22) * this.quality_profile.spray_rate_scale;
    let emitted = 0;
    while (this.spray_accumulator >= 1 && emitted < 12) {
      this.spray_accumulator -= 1;
      emitted++;

      const side = this.next_random() < 0.5 ? -1 : 1;
      const bow_x = ship_x + fwd_x * (124 + this.next_random() * 9) + right_x * side * 3;
      const bow_z = ship_z + fwd_z * (124 + this.next_random() * 9) + right_z * side * 3;
      const spread = 8 + this.next_random() * 12;

      this.spray.emit(
        bow_x,
        wave_height(bow_x, bow_z, time) + 1.5 + this.next_random() * 1.3,
        bow_z,
        right_x * side * spread + fwd_x * speed * (0.18 + this.next_random() * 0.08),
        8 + this.next_random() * (7 + 7 * speed_t),
        right_z * side * spread + fwd_z * speed * (0.18 + this.next_random() * 0.08),
        0.72 + this.next_random() * 0.72,
        0.45 + this.next_random() * 0.62,
      );
    }
    this.spray_accumulator = Math.min(this.spray_accumulator, 2);
  }

  /** Cheap deterministic PRNG: stable visuals, no temporary vectors, and no Math.random coupling. */
  private next_random(): number {
    this.random_state = (Math.imul(1664525, this.random_state) + 1013904223) >>> 0;
    return this.random_state / 0x1_0000_0000;
  }
}
