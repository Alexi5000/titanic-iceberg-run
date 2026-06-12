// file: src/ship/wake_effects.ts
// description: Speed-scaled water effects - foam wake trail behind the stern and bow spray particles, plus ice-shard bursts on collisions
// reference: src/main.ts, src/ship/ship_physics.ts, src/world/ocean.ts

import * as THREE from 'three';
import { wave_height } from '../world/ocean';

interface Particle {
  life: number;
  max_life: number;
  vx: number;
  vy: number;
  vz: number;
  active: boolean;
}

class ParticlePool {
  readonly points: THREE.Points;
  readonly particles: Particle[] = [];
  readonly positions: Float32Array;
  readonly count: number;
  private cursor = 0;

  constructor(count: number, color: number, size: number, opacity: number) {
    this.count = count;
    this.positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      this.particles.push({ life: 0, max_life: 1, vx: 0, vy: 0, vz: 0, active: false });
      this.positions[i * 3 + 1] = -9999;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color,
      size,
      transparent: true,
      opacity,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number): void {
    const p = this.particles[this.cursor];
    p.active = true;
    p.life = 0;
    p.max_life = life;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    this.positions[this.cursor * 3] = x;
    this.positions[this.cursor * 3 + 1] = y;
    this.positions[this.cursor * 3 + 2] = z;
    this.cursor = (this.cursor + 1) % this.count;
  }

  update(delta: number, gravity: number, drag: number): void {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += delta;
      if (p.life >= p.max_life) {
        p.active = false;
        this.positions[i * 3 + 1] = -9999;
        continue;
      }
      p.vy -= gravity * delta;
      const damp = Math.exp(-drag * delta);
      p.vx *= damp;
      p.vz *= damp;
      this.positions[i * 3] += p.vx * delta;
      this.positions[i * 3 + 1] += p.vy * delta;
      this.positions[i * 3 + 2] += p.vz * delta;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class WakeEffects {
  readonly group: THREE.Group;
  private readonly foam: ParticlePool;
  private readonly spray: ParticlePool;
  private readonly shards: ParticlePool;
  private foam_accumulator = 0;
  private spray_accumulator = 0;

  constructor() {
    this.group = new THREE.Group();
    this.foam = new ParticlePool(240, 0xdcecf4, 6.5, 0.4);
    this.spray = new ParticlePool(160, 0xcfe6f2, 3.4, 0.55);
    this.shards = new ParticlePool(120, 0xeaf6ff, 4.2, 0.9);
    this.group.add(this.foam.points, this.spray.points, this.shards.points);
  }

  /** Burst of ice shards at a collision point. */
  burst_shards(x: number, z: number, intense: boolean): void {
    const count = intense ? 46 : 24;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 14 + Math.random() * (intense ? 40 : 24);
      this.shards.emit(
        x + (Math.random() - 0.5) * 8,
        4 + Math.random() * 10,
        z + (Math.random() - 0.5) * 8,
        Math.cos(angle) * speed,
        16 + Math.random() * 22,
        Math.sin(angle) * speed,
        0.9 + Math.random() * 0.8,
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
    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);
    const right_x = Math.cos(heading);
    const right_z = -Math.sin(heading);
    const speed_t = Math.min(Math.abs(speed) / 38, 1);

    if (speed_t > 0.08) {
      // Foam: shed from the stern and along the hull sides.
      this.foam_accumulator += delta * (10 + speed_t * 42);
      while (this.foam_accumulator >= 1) {
        this.foam_accumulator -= 1;
        const stern_x = ship_x - fwd_x * 130;
        const stern_z = ship_z - fwd_z * 130;
        const side = Math.random() < 0.5 ? -1 : 1;
        const along = Math.random();
        const px = along < 0.6 ? stern_x : ship_x + fwd_x * (along * 200 - 100) + right_x * side * 16;
        const pz = along < 0.6 ? stern_z : ship_z + fwd_z * (along * 200 - 100) + right_z * side * 16;
        this.foam.emit(
          px + (Math.random() - 0.5) * 14,
          wave_height(px, pz, time) + 0.8,
          pz + (Math.random() - 0.5) * 14,
          -fwd_x * speed * 0.12 + (Math.random() - 0.5) * 3,
          0.4,
          -fwd_z * speed * 0.12 + (Math.random() - 0.5) * 3,
          2.6 + Math.random() * 2.2,
        );
      }

      // Bow spray: arcs thrown out from the stem, only at real speed.
      if (speed_t > 0.35) {
        this.spray_accumulator += delta * speed_t * 34;
        while (this.spray_accumulator >= 1) {
          this.spray_accumulator -= 1;
          const bow_x = ship_x + fwd_x * 128;
          const bow_z = ship_z + fwd_z * 128;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.spray.emit(
            bow_x,
            wave_height(bow_x, bow_z, time) + 2,
            bow_z,
            right_x * side * (8 + Math.random() * 10) + fwd_x * speed * 0.25,
            9 + Math.random() * 9 * speed_t,
            right_z * side * (8 + Math.random() * 10) + fwd_z * speed * 0.25,
            0.9 + Math.random() * 0.7,
          );
        }
      }
    }

    this.foam.update(delta, 0.4, 0.6);
    this.spray.update(delta, 32, 0.4);
    this.shards.update(delta, 42, 0.8);
  }
}
