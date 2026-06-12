// file: src/world/iceberg_field.ts
// description: Procedural iceberg pool - noisy displaced icosahedron bergs spawned in a corridor ahead of the ship, recycled behind it
// reference: src/main.ts, src/ship/collision.ts, src/gameplay/difficulty.ts

import * as THREE from 'three';
import { wave_height } from './ocean';
import { Palette } from './palette';

export interface Iceberg {
  mesh: THREE.Mesh;
  radius: number;
  active: boolean;
  near_miss_armed: boolean;
}

const POOL_SIZE = 26;
const SPAWN_AHEAD_MIN = 520;
const SPAWN_AHEAD_MAX = 1050;
const SPAWN_HALF_WIDTH = 420;
const DESPAWN_BEHIND = 320;

function create_iceberg_geometry(rng: () => number): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const jitter = 0.62 + rng() * 0.75;
    // Stretch tall spires upward, flatten the waterline area.
    const vertical = y > 0 ? 1.0 + rng() * 0.9 : 0.55;
    positions.setXYZ(i, x * jitter, y * jitter * vertical, z * jitter);
  }

  geometry.computeVertexNormals();
  return geometry;
}

export class IcebergField {
  readonly group: THREE.Group;
  readonly bergs: Iceberg[] = [];
  /** Spawn probability scalar raised by the difficulty ramp. */
  density = 1;

  private readonly material: THREE.MeshStandardMaterial;
  private spawn_cooldown = 0;

  constructor() {
    this.group = new THREE.Group();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xd7e6f2,
      roughness: 0.55,
      metalness: 0.05,
      flatShading: true,
      emissive: 0x16222e,
    });

    for (let i = 0; i < POOL_SIZE; i++) {
      const mesh = new THREE.Mesh(create_iceberg_geometry(Math.random), this.material);
      mesh.visible = false;
      this.group.add(mesh);
      this.bergs.push({ mesh, radius: 1, active: false, near_miss_armed: true });
    }
  }

  set_palette(palette: Palette): void {
    this.material.color.setHex(palette.berg_color);
    this.material.emissive.setHex(palette.berg_emissive);
  }

  /** Place initial scatter so the field is not empty at run start, kept well clear of the ship. */
  seed_initial(ship_x: number, ship_z: number, heading: number): void {
    for (const berg of this.bergs) this.deactivate(berg);
    for (let i = 0; i < 10; i++) {
      this.spawn(ship_x, ship_z, heading, 680 + Math.random() * (SPAWN_AHEAD_MAX - 680));
    }
  }

  private deactivate(berg: Iceberg): void {
    berg.active = false;
    berg.mesh.visible = false;
  }

  private spawn(ship_x: number, ship_z: number, heading: number, ahead_override?: number): boolean {
    const berg = this.bergs.find((b) => !b.active);
    if (!berg) return false;

    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);
    const right_x = Math.cos(heading);
    const right_z = -Math.sin(heading);

    const ahead = ahead_override ?? SPAWN_AHEAD_MIN + Math.random() * (SPAWN_AHEAD_MAX - SPAWN_AHEAD_MIN);
    const lateral = (Math.random() * 2 - 1) * SPAWN_HALF_WIDTH;

    const size = 18 + Math.random() * 46;
    berg.radius = size * 0.82;
    berg.mesh.scale.setScalar(size);
    berg.mesh.position.set(
      ship_x + fwd_x * ahead + right_x * lateral,
      0,
      ship_z + fwd_z * ahead + right_z * lateral,
    );
    berg.mesh.rotation.y = Math.random() * Math.PI * 2;
    berg.mesh.visible = true;
    berg.active = true;
    berg.near_miss_armed = true;
    return true;
  }

  update(delta: number, time: number, ship_x: number, ship_z: number, heading: number, ship_speed: number): void {
    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);

    for (const berg of this.bergs) {
      if (!berg.active) continue;

      // Gentle bob on the same wave field, mostly submerged mass keeps it subtle.
      const p = berg.mesh.position;
      p.y = wave_height(p.x, p.z, time) * 0.3 - berg.radius * 0.18;

      // Recycle bergs left far behind the ship's direction of travel.
      const rel_x = p.x - ship_x;
      const rel_z = p.z - ship_z;
      const along = rel_x * fwd_x + rel_z * fwd_z;
      if (along < -DESPAWN_BEHIND || Math.abs(along) > SPAWN_AHEAD_MAX * 1.8) {
        this.deactivate(berg);
      }
    }

    // Spawn rate scales with forward speed and difficulty density.
    this.spawn_cooldown -= delta;
    if (this.spawn_cooldown <= 0 && ship_speed > 2) {
      if (this.spawn(ship_x, ship_z, heading)) {
        const base_interval = 2.6 / this.density;
        const speed_factor = Math.max(ship_speed / 38, 0.3);
        this.spawn_cooldown = base_interval / speed_factor;
      } else {
        this.spawn_cooldown = 1;
      }
    }
  }
}
