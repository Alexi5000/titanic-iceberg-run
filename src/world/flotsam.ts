// file: src/world/flotsam.ts
// description: Bumpable floating debris - small ice chunks and crates the bow shoves aside with fake impulse physics
// reference: src/main.ts, src/ship/ship_physics.ts, src/world/ocean.ts

import * as THREE from 'three';
import { wave_height } from './ocean';
import { make_toon_material } from './toon_shading';
import { Palette } from './palette';

interface FlotsamPiece {
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  spin: number;
  radius: number;
}

const PIECE_COUNT = 16;
const SCATTER_RADIUS = 520;
const PUSH_RADIUS = 36;

export class Flotsam {
  readonly group: THREE.Group;
  private readonly pieces: FlotsamPiece[] = [];
  private readonly ice_material: THREE.MeshToonMaterial;
  private readonly crate_material: THREE.MeshToonMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.ice_material = make_toon_material({ color: 0xe2f2fc, emissive: 0x1c3340 });
    this.crate_material = make_toon_material({ color: 0x8a6840 });

    for (let i = 0; i < PIECE_COUNT; i++) {
      const is_crate = i % 4 === 3;
      const size = is_crate ? 3 + Math.random() * 2.5 : 4 + Math.random() * 5;
      const geometry = is_crate
        ? new THREE.BoxGeometry(size, size * 0.8, size)
        : new THREE.DodecahedronGeometry(size, 0);
      const mesh = new THREE.Mesh(geometry, is_crate ? this.crate_material : this.ice_material);
      mesh.rotation.set(Math.random() * 0.6, Math.random() * Math.PI * 2, Math.random() * 0.6);
      this.group.add(mesh);
      this.pieces.push({ mesh, vx: 0, vz: 0, spin: 0, radius: size });
    }
  }

  set_palette(palette: Palette): void {
    this.ice_material.color.setHex(palette.berg_color);
    this.ice_material.emissive.setHex(palette.berg_emissive);
  }

  scatter(ship_x: number, ship_z: number): void {
    for (const piece of this.pieces) {
      this.respawn(piece, ship_x, ship_z, true);
    }
  }

  private respawn(piece: FlotsamPiece, ship_x: number, ship_z: number, anywhere: boolean): void {
    const angle = Math.random() * Math.PI * 2;
    const dist = anywhere ? 80 + Math.random() * SCATTER_RADIUS : SCATTER_RADIUS * (0.7 + Math.random() * 0.3);
    piece.mesh.position.set(ship_x + Math.cos(angle) * dist, 0, ship_z + Math.sin(angle) * dist);
    piece.vx = 0;
    piece.vz = 0;
    piece.spin = 0;
  }

  update(delta: number, time: number, ship_x: number, ship_z: number, heading: number, speed: number): void {
    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);

    for (const piece of this.pieces) {
      const p = piece.mesh.position;

      // Bow push: pieces near the front third of the hull get an impulse outward.
      for (const along of [60, 100, 130]) {
        const hx = ship_x + fwd_x * along;
        const hz = ship_z + fwd_z * along;
        const dx = p.x - hx;
        const dz = p.z - hz;
        const dist = Math.hypot(dx, dz);
        const reach = PUSH_RADIUS + piece.radius;
        if (dist < reach && dist > 0.01) {
          const strength = ((reach - dist) / reach) * (6 + Math.abs(speed) * 0.7);
          piece.vx += (dx / dist) * strength;
          piece.vz += (dz / dist) * strength;
          piece.spin += (Math.random() - 0.5) * strength * 0.25;
        }
      }

      const damp = Math.exp(-0.9 * delta);
      piece.vx *= damp;
      piece.vz *= damp;
      piece.spin *= damp;
      p.x += piece.vx * delta;
      p.z += piece.vz * delta;
      piece.mesh.rotation.y += piece.spin * delta;

      p.y = wave_height(p.x, p.z, time) * 0.7 - piece.radius * 0.3;
      piece.mesh.rotation.x = Math.sin(time * 0.8 + p.x * 0.1) * 0.12;
      piece.mesh.rotation.z = Math.cos(time * 0.7 + p.z * 0.1) * 0.12;

      // Recycle pieces left far behind.
      const rel_x = p.x - ship_x;
      const rel_z = p.z - ship_z;
      if (Math.hypot(rel_x, rel_z) > SCATTER_RADIUS * 1.6) {
        const ahead = rel_x * fwd_x + rel_z * fwd_z < 0;
        if (ahead || Math.abs(speed) < 1) {
          // Respawn loosely ahead of the direction of travel.
          const lateral = (Math.random() * 2 - 1) * SCATTER_RADIUS * 0.8;
          const right_x = Math.cos(heading);
          const right_z = -Math.sin(heading);
          const dist = SCATTER_RADIUS * (0.8 + Math.random() * 0.6);
          p.x = ship_x + fwd_x * dist + right_x * lateral;
          p.z = ship_z + fwd_z * dist + right_z * lateral;
          piece.vx = 0;
          piece.vz = 0;
        }
      }
    }
  }
}
