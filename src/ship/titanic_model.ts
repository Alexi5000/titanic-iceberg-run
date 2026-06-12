// file: src/ship/titanic_model.ts
// description: Procedural low-poly RMS Titanic - hull, superstructure, four funnels, masts, deck lights, and funnel smoke particles
// reference: src/main.ts, src/world/ocean.ts, src/ship/ship_physics.ts

import * as THREE from 'three';
import { wave_height } from '../world/ocean';
import { make_toon_material } from '../world/toon_shading';

export const SHIP_LENGTH = 269;
export const SHIP_BEAM = 28;

const HULL_COLOR = 0x14171c;
const HULL_BAND_COLOR = 0x6e1e14;
const SUPERSTRUCTURE_COLOR = 0xcdd3da;
const FUNNEL_COLOR = 0xb98c4f;
const FUNNEL_TOP_COLOR = 0x191919;

interface SmokeParticle {
  life: number;
  max_life: number;
  velocity: THREE.Vector3;
}

class FunnelSmoke {
  readonly points: THREE.Points;
  private readonly particles: SmokeParticle[] = [];
  private readonly positions: Float32Array;
  private readonly origin: THREE.Vector3;
  private readonly count = 36;

  constructor(origin: THREE.Vector3) {
    this.origin = origin;
    this.positions = new Float32Array(this.count * 3);

    for (let i = 0; i < this.count; i++) {
      this.particles.push(this.spawn(Math.random() * 6));
      this.positions[i * 3] = origin.x;
      this.positions[i * 3 + 1] = origin.y;
      this.positions[i * 3 + 2] = origin.z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x4a505a,
      size: 7,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
  }

  private spawn(initial_life: number): SmokeParticle {
    return {
      life: initial_life,
      max_life: 5 + Math.random() * 3,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        4.5 + Math.random() * 2.0,
        -(6 + Math.random() * 4),
      ),
    };
  }

  update(delta: number): void {
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.max_life) {
        this.particles[i] = this.spawn(0);
        this.positions[i * 3] = this.origin.x + (Math.random() - 0.5) * 2;
        this.positions[i * 3 + 1] = this.origin.y;
        this.positions[i * 3 + 2] = this.origin.z;
        continue;
      }
      this.positions[i * 3] += this.particles[i].velocity.x * delta;
      this.positions[i * 3 + 1] += this.particles[i].velocity.y * delta;
      this.positions[i * 3 + 2] += this.particles[i].velocity.z * delta;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

interface HullParts {
  group: THREE.Group;
  hull_material: THREE.MeshToonMaterial;
  band_material: THREE.MeshToonMaterial;
}

function create_hull(): HullParts {
  const hull = new THREE.Group();
  const hull_material = make_toon_material({ color: HULL_COLOR });

  const mid = new THREE.Mesh(new THREE.BoxGeometry(SHIP_BEAM, 20, 210), hull_material);
  mid.position.set(0, 4, 0);
  hull.add(mid);

  // Bow wedge built from an extruded triangle, pointing +Z.
  const bow_shape = new THREE.Shape();
  bow_shape.moveTo(-SHIP_BEAM / 2, 0);
  bow_shape.lineTo(SHIP_BEAM / 2, 0);
  bow_shape.lineTo(0, 32);
  bow_shape.closePath();
  const bow_geometry = new THREE.ExtrudeGeometry(bow_shape, { depth: 20, bevelEnabled: false });
  bow_geometry.rotateX(Math.PI / 2);
  bow_geometry.translate(0, 14, 104);
  const bow = new THREE.Mesh(bow_geometry, hull_material);
  hull.add(bow);

  const stern = new THREE.Mesh(new THREE.CylinderGeometry(SHIP_BEAM / 2, SHIP_BEAM / 2, 20, 18, 1, false, 0, Math.PI), hull_material);
  stern.rotation.y = Math.PI / 2;
  stern.position.set(0, 4, -105);
  hull.add(stern);

  // Red-brown boot-top band near the waterline.
  const band_material = make_toon_material({ color: HULL_BAND_COLOR });
  const band = new THREE.Mesh(new THREE.BoxGeometry(SHIP_BEAM + 0.4, 2.2, 210), band_material);
  band.position.set(0, -4.4, 0);
  hull.add(band);

  return { group: hull, hull_material, band_material };
}

function create_superstructure(): { group: THREE.Group; material: THREE.MeshToonMaterial } {
  const group = new THREE.Group();
  const material = make_toon_material({ color: SUPERSTRUCTURE_COLOR });

  const deck_a = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 150), material);
  deck_a.position.set(0, 17.5, -4);
  group.add(deck_a);

  const deck_b = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 118), material);
  deck_b.position.set(0, 24, -2);
  group.add(deck_b);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(22, 5, 16), material);
  bridge.position.set(0, 29.5, 58);
  group.add(bridge);

  return { group, material };
}

function create_funnels(): { group: THREE.Group; smoke_origins: THREE.Vector3[]; funnel_materials: THREE.MeshToonMaterial[] } {
  const group = new THREE.Group();
  const top_material = make_toon_material({ color: FUNNEL_TOP_COLOR });
  const smoke_origins: THREE.Vector3[] = [];
  const funnel_materials: THREE.MeshToonMaterial[] = [];

  const funnel_z = [52, 17, -18, -53];
  for (let i = 0; i < 4; i++) {
    const funnel = new THREE.Group();

    // Separate material per funnel so skins can color them individually.
    const funnel_material = make_toon_material({ color: FUNNEL_COLOR });
    funnel_materials.push(funnel_material);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.2, 24, 14), funnel_material);
    body.position.y = 12;
    funnel.add(body);

    const top = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 3.4, 14), top_material);
    top.position.y = 24.5;
    funnel.add(top);

    funnel.position.set(0, 27, funnel_z[i]);
    funnel.rotation.x = 0.12; // raked aft
    group.add(funnel);

    // Historically the 4th funnel was a dummy - only the first three smoke.
    if (i < 3) smoke_origins.push(new THREE.Vector3(0, 54, funnel_z[i] - 4));
  }

  return { group, smoke_origins, funnel_materials };
}

function create_masts(): THREE.Group {
  const group = new THREE.Group();
  const material = make_toon_material({ color: 0x2a2620 });

  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 46, 6), material);
  fore.position.set(0, 38, 88);
  fore.rotation.x = 0.1;
  group.add(fore);

  const aft = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 40, 6), material);
  aft.position.set(0, 35, -88);
  aft.rotation.x = 0.08;
  group.add(aft);

  return group;
}

function create_deck_lights(): THREE.Points {
  const positions: number[] = [];

  // Two rows of portholes along each side of the hull.
  for (let z = -100; z <= 95; z += 6) {
    for (const y of [8, 12]) {
      positions.push(SHIP_BEAM / 2 + 0.3, y, z);
      positions.push(-SHIP_BEAM / 2 - 0.3, y, z);
    }
  }
  // Promenade deck lights on the superstructure.
  for (let z = -76; z <= 68; z += 8) {
    positions.push(12.4, 18.5, z);
    positions.push(-12.4, 18.5, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffd98a,
    size: 1.6,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export class TitanicShip {
  readonly group: THREE.Group;
  private readonly smoke_systems: FunnelSmoke[] = [];
  private readonly inner: THREE.Group;
  private readonly hull_material: THREE.MeshToonMaterial;
  private readonly band_material: THREE.MeshToonMaterial;
  private readonly superstructure_material: THREE.MeshToonMaterial;
  private readonly funnel_materials: THREE.MeshToonMaterial[];
  private searchlight: THREE.SpotLight | null = null;

  constructor() {
    this.group = new THREE.Group();
    this.inner = new THREE.Group();

    const hull = create_hull();
    this.hull_material = hull.hull_material;
    this.band_material = hull.band_material;
    this.inner.add(hull.group);

    const superstructure = create_superstructure();
    this.superstructure_material = superstructure.material;
    this.inner.add(superstructure.group);

    const { group: funnels, smoke_origins, funnel_materials } = create_funnels();
    this.funnel_materials = funnel_materials;
    this.inner.add(funnels);

    for (const origin of smoke_origins) {
      const smoke = new FunnelSmoke(origin);
      this.smoke_systems.push(smoke);
      this.inner.add(smoke.points);
    }

    this.inner.add(create_masts());
    this.inner.add(create_deck_lights());

    this.group.add(this.inner);
  }

  /** Cosmetic unlock: forward searchlight mounted on the foremast. */
  set_searchlight(enabled: boolean): void {
    if (enabled && !this.searchlight) {
      const light = new THREE.SpotLight(0xfff4d6, 900, 700, 0.22, 0.45, 1.2);
      light.position.set(0, 52, 90);
      light.target.position.set(0, 4, 600);
      this.inner.add(light);
      this.inner.add(light.target);
      this.searchlight = light;
    }
    if (this.searchlight) this.searchlight.visible = enabled;
  }

  /**
   * Apply a cosmetic skin. Pass null for the classic livery; golden_funnels only
   * shows on the classic livery (skins define their own funnel treatment).
   */
  apply_skin(skin_id: string | null, golden_funnels: boolean): void {
    const all = [this.hull_material, this.band_material, this.superstructure_material, ...this.funnel_materials];
    for (const material of all) {
      material.transparent = false;
      material.opacity = 1;
      material.emissive.setHex(0x000000);
      material.needsUpdate = true;
    }
    this.hull_material.color.setHex(HULL_COLOR);
    this.band_material.color.setHex(HULL_BAND_COLOR);
    this.superstructure_material.color.setHex(SUPERSTRUCTURE_COLOR);
    for (const funnel of this.funnel_materials) funnel.color.setHex(FUNNEL_COLOR);

    if (skin_id === 'royal_mail') {
      this.hull_material.color.setHex(0x9e2b25);
      this.band_material.color.setHex(0xe8dcc0);
    } else if (skin_id === 'brass_teak') {
      this.hull_material.color.setHex(0x2c2118);
      this.superstructure_material.color.setHex(0xc8a878);
      for (const funnel of this.funnel_materials) {
        funnel.color.setHex(0xd9b25f);
        funnel.emissive.setHex(0x33240a);
      }
    } else if (skin_id === 'ghost') {
      for (const material of all) {
        material.color.setHex(0xdfe9f2);
        material.emissive.setHex(0x3a5a72);
        material.transparent = true;
        material.opacity = 0.55;
      }
    } else if (skin_id === 'rainbow') {
      const rainbow = [0xe2574c, 0xe9b44c, 0x5ec98a, 0x5a8fd9];
      this.funnel_materials.forEach((funnel, i) => {
        funnel.color.setHex(rainbow[i]);
        funnel.emissive.setHex(0x111111);
      });
    } else if (golden_funnels) {
      for (const funnel of this.funnel_materials) {
        funnel.color.setHex(0xd4a747);
        funnel.emissive.setHex(0x4a3408);
      }
    }
  }

  /** Bob and pitch the ship on the CPU wave mirror. Position/heading are owned by ship physics. */
  update(time: number, delta: number, turn_heel = 0): void {
    const x = this.group.position.x;
    const z = this.group.position.z;
    const yaw = this.group.rotation.y;

    const fwd_x = Math.sin(yaw);
    const fwd_z = Math.cos(yaw);
    const half = SHIP_LENGTH * 0.38;

    const h_bow = wave_height(x + fwd_x * half, z + fwd_z * half, time);
    const h_stern = wave_height(x - fwd_x * half, z - fwd_z * half, time);
    const h_port = wave_height(x - fwd_z * 12, z + fwd_x * 12, time);
    const h_starboard = wave_height(x + fwd_z * 12, z - fwd_x * 12, time);

    this.group.position.y = (h_bow + h_stern) * 0.5 - 6;
    this.inner.rotation.x = Math.atan2(h_stern - h_bow, SHIP_LENGTH * 0.76) * 0.8;
    this.inner.rotation.z = Math.atan2(h_port - h_starboard, 24) * 0.45 + turn_heel;

    for (const smoke of this.smoke_systems) smoke.update(delta);
  }
}
