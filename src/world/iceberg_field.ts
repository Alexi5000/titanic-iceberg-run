// file: src/world/iceberg_field.ts
// description: Procedural iceberg pool with underwater mass, PBR ice/snow masks, silhouette variants, and distance LODs
// reference: src/ship/collision.ts, src/world/ocean.ts, src/gameplay/difficulty.ts

import * as THREE from 'three';
import { wave_height } from './ocean';
import { Palette } from './palette';
import type { OceanInteractionSource } from '../ocean/water_material';

export type IcebergKind = 'small' | 'medium' | 'large' | 'hero' | 'field';

export interface Iceberg {
  mesh: THREE.Group;
  radius: number;
  active: boolean;
  near_miss_armed: boolean;
  kind: IcebergKind;
  /** Collision remains intentionally inexpensive: a conservative XZ radius. */
  collision_radius: number;
  /** High/medium/low children are toggled by gameplay distance. */
  lods: THREE.Mesh[];
}

const POOL_SIZE = 30;
const SPAWN_AHEAD_MIN = 520;
const SPAWN_AHEAD_MAX = 1120;
const SPAWN_HALF_WIDTH = 460;
const DESPAWN_BEHIND = 340;
const FAR_FIELD_COUNT = 72;
const FAR_FIELD_SPACING = 720;

const KIND_SCALE: Record<IcebergKind, [number, number]> = {
  small: [10, 22],
  medium: [24, 44],
  large: [46, 70],
  hero: [72, 96],
  field: [8, 17],
};

function seeded_noise(seed: number, x: number, y: number, z: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed * 19.19) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Builds a complete berg volume, not only an above-water rock. Vertex colors
 * encode snow (white), wet ice (cyan), and deep absorbed ice (blue) so a single
 * material remains cheap across the whole pooled field.
 */
function create_iceberg_geometry(seed: number, detail: number, kind: IcebergKind): THREE.BufferGeometry {
  // IcosahedronGeometry is already non-indexed in current Three.js. Keeping it
  // as-is avoids noisy toNonIndexed warnings during the pooled LOD build.
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const vertical_stretch = kind === 'hero' ? 1.72 : kind === 'large' ? 1.46 : kind === 'small' || kind === 'field' ? 0.9 : 1.16;
  const waterline_flatten = kind === 'hero' ? 0.38 : 0.5;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const broad = seeded_noise(seed, x * 0.7, y, z * 0.7);
    const chip = seeded_noise(seed + 3.7, x * 2.8, y * 2.8, z * 2.8);
    const face_bias = 0.66 + broad * 0.52 + chip * 0.16;
    const asymmetric = 0.78 + seeded_noise(seed + 9.1, x + 1.3, 0, z - 0.8) * 0.44;
    const above = y > 0 ? 1.0 + broad * 0.78 : waterline_flatten + broad * 0.28;

    positions.setXYZ(i, x * face_bias * asymmetric, y * face_bias * vertical_stretch * above, z * face_bias);

    const displaced_y = y * above;
    const color_offset = i * 3;
    if (displaced_y > 0.38) {
      // Snow cap, with a slightly blue shadow variation in leeward facets.
      const shade = 0.83 + chip * 0.17;
      colors[color_offset] = shade;
      colors[color_offset + 1] = shade * 1.01;
      colors[color_offset + 2] = 1;
    } else if (displaced_y < -0.12) {
      // Underwater volume: blue absorption grows with depth.
      const depth = Math.min((-displaced_y - 0.12) * 0.85, 0.62);
      colors[color_offset] = 0.36 - depth * 0.16;
      colors[color_offset + 1] = 0.7 - depth * 0.18;
      colors[color_offset + 2] = 0.9 - depth * 0.06;
    } else {
      // Wet waterline catches light without relying on a separate transparent mesh.
      colors[color_offset] = 0.48 + chip * 0.09;
      colors[color_offset + 1] = 0.82 + chip * 0.1;
      colors[color_offset + 2] = 0.96;
    }
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function create_ice_material(): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xcfeaf7,
    vertexColors: true,
    roughness: 0.25,
    metalness: 0,
    transmission: 0.055,
    thickness: 0.8,
    ior: 1.31,
    clearcoat: 0.2,
    clearcoatRoughness: 0.28,
    emissive: 0x092334,
    emissiveIntensity: 0.16,
  });
  material.name = 'IcebergPBR';
  return material;
}

function kind_for_pool_index(index: number): IcebergKind {
  if (index === 0) return 'hero';
  if (index % 9 === 0) return 'large';
  if (index % 5 === 0) return 'field';
  if (index % 3 === 0) return 'small';
  return 'medium';
}

export class IcebergField {
  readonly group: THREE.Group;
  readonly bergs: Iceberg[] = [];
  /** Spawn probability scalar raised by the difficulty ramp. */
  density = 1;

  private readonly material: THREE.MeshPhysicalMaterial;
  private readonly far_field: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  private readonly far_anchor = new THREE.Vector2(Number.NaN, Number.NaN);
  private spawn_cooldown = 0;
  private rng: () => number = Math.random;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'IcebergField';
    this.material = create_ice_material();

    // A non-colliding far ice field adds convincing scale without multiplying
    // gameplay entities or draw calls. Near/hero bergs remain the pooled LOD
    // meshes below, with their existing conservative collision radii.
    const far_geometry = create_iceberg_geometry(741.4, 0, 'field');
    this.far_field = new THREE.InstancedMesh(far_geometry, this.material, FAR_FIELD_COUNT);
    this.far_field.name = 'InstancedFarIceField';
    this.far_field.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.far_field.frustumCulled = false;
    const far_transform = new THREE.Object3D();
    for (let index = 0; index < FAR_FIELD_COUNT; index += 1) {
      const angle = index * 2.399963229728653 + seeded_noise(3.1, index, 0, 0) * 0.9;
      const radius = 430 + seeded_noise(7.7, index, 1, 0) * 980;
      const scale = 6 + seeded_noise(11.4, index, 2, 0) * 16;
      far_transform.position.set(Math.cos(angle) * radius, -scale * 0.18, Math.sin(angle) * radius);
      far_transform.rotation.set(
        (seeded_noise(19.8, index, 3, 0) - 0.5) * 0.08,
        seeded_noise(23.2, index, 4, 0) * Math.PI * 2,
        (seeded_noise(29.6, index, 5, 0) - 0.5) * 0.08,
      );
      far_transform.scale.setScalar(scale);
      far_transform.updateMatrix();
      this.far_field.setMatrixAt(index, far_transform.matrix);
    }
    this.far_field.instanceMatrix.needsUpdate = true;
    this.group.add(this.far_field);

    for (let i = 0; i < POOL_SIZE; i++) {
      const kind = kind_for_pool_index(i);
      const seed = Math.random() * 1000;
      const mesh = new THREE.Group();
      mesh.name = `Iceberg_${kind}_${i}`;

      const high = new THREE.Mesh(create_iceberg_geometry(seed, 2, kind), this.material);
      const medium = new THREE.Mesh(create_iceberg_geometry(seed, 1, kind), this.material);
      const low = new THREE.Mesh(create_iceberg_geometry(seed, 0, kind), this.material);
      high.castShadow = true;
      high.receiveShadow = true;
      medium.castShadow = true;
      medium.receiveShadow = true;
      low.castShadow = true;
      low.receiveShadow = true;
      medium.visible = false;
      low.visible = false;
      mesh.add(high, medium, low);
      mesh.visible = false;
      this.group.add(mesh);
      this.bergs.push({
        mesh,
        radius: 1,
        collision_radius: 1,
        active: false,
        near_miss_armed: true,
        kind,
        lods: [high, medium, low],
      });
    }
  }

  set_rng(rng: () => number): void {
    this.rng = rng;
  }

  set_palette(palette: Palette): void {
    this.material.color.setHex(palette.berg_color);
    this.material.emissive.setHex(palette.berg_emissive);
    this.material.emissiveIntensity = palette.storm_intensity > 0.5 ? 0.08 : 0.16;
  }

  /** Place initial scatter so the field is not empty at run start, kept clear of the ship. */
  seed_initial(ship_x: number, ship_z: number, heading: number): void {
    for (const berg of this.bergs) this.deactivate(berg);
    for (let i = 0; i < 11; i++) {
      this.spawn(ship_x, ship_z, heading, 680 + this.rng() * (SPAWN_AHEAD_MAX - 680));
    }
  }

  private deactivate(berg: Iceberg): void {
    berg.active = false;
    berg.mesh.visible = false;
  }

  private spawn(ship_x: number, ship_z: number, heading: number, ahead_override?: number): boolean {
    const berg = this.bergs.find((candidate) => !candidate.active);
    if (!berg) return false;

    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);
    const right_x = Math.cos(heading);
    const right_z = -Math.sin(heading);
    const kind = berg.kind;
    const [min_size, max_size] = KIND_SCALE[kind];
    const size = min_size + this.rng() * (max_size - min_size);
    const ahead_base = ahead_override ?? SPAWN_AHEAD_MIN + this.rng() * (SPAWN_AHEAD_MAX - SPAWN_AHEAD_MIN);
    const ahead = kind === 'hero' ? Math.max(ahead_base, 900) : ahead_base;
    const lateral = (this.rng() * 2 - 1) * SPAWN_HALF_WIDTH;

    berg.radius = size * (kind === 'hero' ? 0.88 : 0.78);
    berg.collision_radius = berg.radius;
    berg.mesh.scale.setScalar(size);
    berg.mesh.position.set(
      ship_x + fwd_x * ahead + right_x * lateral,
      0,
      ship_z + fwd_z * ahead + right_z * lateral,
    );
    berg.mesh.rotation.set((this.rng() - 0.5) * 0.08, this.rng() * Math.PI * 2, (this.rng() - 0.5) * 0.08);
    berg.mesh.visible = true;
    berg.active = true;
    berg.near_miss_armed = true;
    return true;
  }

  private update_lod(berg: Iceberg, distance: number): void {
    const index = distance < 430 ? 0 : distance < 860 ? 1 : 2;
    for (let i = 0; i < berg.lods.length; i++) berg.lods[i].visible = i === index;
  }

  update(delta: number, time: number, ship_x: number, ship_z: number, heading: number, ship_speed: number): void {
    const fwd_x = Math.sin(heading);
    const fwd_z = Math.cos(heading);

    const next_anchor_x = Math.floor(ship_x / FAR_FIELD_SPACING) * FAR_FIELD_SPACING;
    const next_anchor_z = Math.floor(ship_z / FAR_FIELD_SPACING) * FAR_FIELD_SPACING;
    if (next_anchor_x !== this.far_anchor.x || next_anchor_z !== this.far_anchor.y) {
      this.far_anchor.set(next_anchor_x, next_anchor_z);
      this.far_field.position.set(next_anchor_x, 0, next_anchor_z);
    }

    for (const berg of this.bergs) {
      if (!berg.active) continue;
      const p = berg.mesh.position;
      // Roughly 85–90% of a natural iceberg sits below water. The visual volume
      // is complete, while gameplay collision intentionally remains a stable XZ proxy.
      p.y = wave_height(p.x, p.z, time) * 0.32 - berg.radius * 0.2;

      const rel_x = p.x - ship_x;
      const rel_z = p.z - ship_z;
      const along = rel_x * fwd_x + rel_z * fwd_z;
      const distance = Math.hypot(rel_x, rel_z);
      this.update_lod(berg, distance);
      if (along < -DESPAWN_BEHIND || Math.abs(along) > SPAWN_AHEAD_MAX * 1.9) this.deactivate(berg);
    }

    this.spawn_cooldown -= delta;
    if (this.spawn_cooldown <= 0 && ship_speed > 2) {
      if (this.spawn(ship_x, ship_z, heading)) {
        const base_interval = 2.9 / this.density;
        const speed_factor = Math.max(ship_speed / 38, 0.3);
        this.spawn_cooldown = base_interval / speed_factor;
      } else {
        this.spawn_cooldown = 1;
      }
    }
  }

  /**
   * Writes the nearby active bergs into a caller-owned ocean interaction buffer.
   * The shader turns these conservative collision radii into small waterline foam
   * rings. This does not allocate or sort on the gameplay hot path.
   */
  write_foam_interactions(
    target: OceanInteractionSource[],
    ship_x: number,
    ship_z: number,
  ): number {
    let written = 0;
    for (const berg of this.bergs) {
      if (!berg.active || written >= target.length) continue;
      const x = berg.mesh.position.x;
      const z = berg.mesh.position.z;
      const distance = Math.hypot(x - ship_x, z - ship_z);
      if (distance > 900) continue;

      const interaction = target[written];
      interaction.x = x;
      interaction.z = z;
      interaction.radius = berg.radius;
      interaction.intensity = berg.kind === 'hero' ? 1 : berg.kind === 'large' ? 0.86 : 0.64;
      written += 1;
    }
    return written;
  }
}
