// file: src/ship/titanic_model.ts
// description: Asset-independent, PBR RMS Titanic hero ship. The hull dimensions and
// forward axis are deliberately shared with collision.ts and ship_physics.ts.

import * as THREE from 'three';
import { wave_height } from '../world/ocean';

/** Real RMS Titanic overall length in the game's world-space metres. Bow is +Z. */
export const SHIP_LENGTH = 269;
/** Real RMS Titanic beam in the game's world-space metres. */
export const SHIP_BEAM = 28;

/** Visual-only LOD budget; gameplay hull dimensions and collision never change. */
export type ShipQuality = 'low' | 'medium' | 'high' | 'ultra';

const HULL_COLOR = 0x10161d;
const HULL_BAND_COLOR = 0x6f211b;
const SUPERSTRUCTURE_COLOR = 0xd8d3c7;
const FUNNEL_COLOR = 0xb98f52;
const FUNNEL_TOP_COLOR = 0x151515;

type ShipMaterial = THREE.MeshStandardMaterial;

interface HullParts {
  group: THREE.Group;
  hull_material: ShipMaterial;
  band_material: ShipMaterial;
}

interface SuperstructureParts {
  group: THREE.Group;
  material: ShipMaterial;
}

interface FunnelParts {
  group: THREE.Group;
  smoke_origins: THREE.Vector3[];
  funnel_materials: ShipMaterial[];
}

interface PropulsionParts {
  group: THREE.Group;
  propellers: THREE.Group[];
}

interface HullSection {
  z: number;
  half_beam: number;
  deck_y: number;
}

/**
 * Lightweight particle smoke. All simulation state lives in typed arrays so the
 * ship's per-frame update does not allocate garbage during a long run.
 */
class FunnelSmoke {
  readonly points: THREE.Points;

  private readonly positions: Float32Array;
  private readonly colors: Float32Array;
  private readonly velocities: Float32Array;
  private readonly ages: Float32Array;
  private readonly lifetimes: Float32Array;
  private readonly position_attribute: THREE.BufferAttribute;
  private readonly color_attribute: THREE.BufferAttribute;
  private readonly origin: THREE.Vector3;
  private readonly count: number;

  constructor(origin: THREE.Vector3, count = 42) {
    this.count = count;
    this.origin = origin.clone();
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.ages = new Float32Array(count);
    this.lifetimes = new Float32Array(count);

    for (let i = 0; i < count; i++) this.respawn(i, Math.random() * 5);

    const geometry = new THREE.BufferGeometry();
    this.position_attribute = new THREE.BufferAttribute(this.positions, 3);
    this.color_attribute = new THREE.BufferAttribute(this.colors, 3);
    geometry.setAttribute('position', this.position_attribute);
    geometry.setAttribute('color', this.color_attribute);

    const material = new THREE.PointsMaterial({
      size: 7.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.name = 'Funnel smoke';
    this.points.frustumCulled = false;
  }

  private respawn(index: number, initial_age = 0): void {
    const offset = index * 3;
    const lifetime = 5.4 + Math.random() * 3.5;
    this.ages[index] = initial_age;
    this.lifetimes[index] = lifetime;

    this.positions[offset] = this.origin.x + (Math.random() - 0.5) * 1.5;
    this.positions[offset + 1] = this.origin.y + Math.random() * 1.6;
    this.positions[offset + 2] = this.origin.z + (Math.random() - 0.5) * 1.5;

    this.velocities[offset] = (Math.random() - 0.5) * 1.7;
    this.velocities[offset + 1] = 4.2 + Math.random() * 2.4;
    // Titanic's forward direction is +Z, so smoke trails naturally aft.
    this.velocities[offset + 2] = -(5.5 + Math.random() * 4.2);

    this.set_color(index, 1 - initial_age / lifetime);
  }

  private set_color(index: number, remaining: number): void {
    const offset = index * 3;
    const density = THREE.MathUtils.clamp(remaining, 0, 1);
    this.colors[offset] = 0.16 + density * 0.14;
    this.colors[offset + 1] = 0.18 + density * 0.16;
    this.colors[offset + 2] = 0.21 + density * 0.18;
  }

  update(delta: number): void {
    for (let i = 0; i < this.count; i++) {
      const age = this.ages[i] + delta;
      if (age >= this.lifetimes[i]) {
        this.respawn(i);
        continue;
      }

      this.ages[i] = age;
      const offset = i * 3;
      this.velocities[offset] *= 1 - Math.min(delta * 0.18, 0.04);
      this.velocities[offset + 2] -= delta * 0.12;
      this.positions[offset] += this.velocities[offset] * delta;
      this.positions[offset + 1] += this.velocities[offset + 1] * delta;
      this.positions[offset + 2] += this.velocities[offset + 2] * delta;
      this.set_color(i, 1 - age / this.lifetimes[i]);
    }

    this.position_attribute.needsUpdate = true;
    this.color_attribute.needsUpdate = true;
  }
}

function make_pbr_material(name: string, parameters: THREE.MeshStandardMaterialParameters): ShipMaterial {
  const material = new THREE.MeshStandardMaterial(parameters);
  material.name = name;
  return material;
}

function create_mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function create_hull_shell(): THREE.BufferGeometry {
  // These sections create a real hull volume rather than a rectangular barge:
  // stern counter -> broad mid-body -> curved run -> high, narrow clipper bow.
  const sections: HullSection[] = [
    { z: -134, half_beam: 8.5, deck_y: 13.5 },
    { z: -124, half_beam: 12.7, deck_y: 14.2 },
    { z: -94, half_beam: SHIP_BEAM / 2, deck_y: 15 },
    { z: 62, half_beam: SHIP_BEAM / 2, deck_y: 15 },
    { z: 98, half_beam: 12.8, deck_y: 16.2 },
    { z: 121, half_beam: 7.6, deck_y: 18.8 },
    { z: 134, half_beam: 0.55, deck_y: 22.5 },
  ];
  const vertices_per_section = 7;
  const positions: number[] = [];
  const indices: number[] = [];

  for (const section of sections) {
    const w = section.half_beam;
    const deck_y = section.deck_y;
    // Clockwise around the hull when viewed from the bow. The deck edge, chine,
    // and keel profile are all deliberately visible at typical chase-camera angles.
    const profile: ReadonlyArray<readonly [number, number]> = [
      [-w, deck_y],
      [w, deck_y],
      [w * 0.985, 5.8],
      [w * 0.58, -6.8],
      [0, -10.4],
      [-w * 0.58, -6.8],
      [-w * 0.985, 5.8],
    ];
    for (const [x, y] of profile) positions.push(x, y, section.z);
  }

  for (let section = 0; section < sections.length - 1; section++) {
    const current = section * vertices_per_section;
    const next = (section + 1) * vertices_per_section;
    for (let edge = 0; edge < vertices_per_section; edge++) {
      const following = (edge + 1) % vertices_per_section;
      indices.push(current + edge, next + edge, next + following);
      indices.push(current + edge, next + following, current + following);
    }
  }

  // Close stern and bow with triangle fans. Double-sided rendering prevents any
  // rare camera-under-hull culling artefacts in storm waves.
  for (let edge = 1; edge < vertices_per_section - 1; edge++) {
    indices.push(0, edge + 1, edge);
    const bow = (sections.length - 1) * vertices_per_section;
    indices.push(bow, bow + edge, bow + edge + 1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function create_boot_top_geometry(): THREE.BufferGeometry {
  const sections: ReadonlyArray<readonly [number, number]> = [
    [-130, 8.4],
    [-120, 12.5],
    [-94, SHIP_BEAM / 2 - 0.1],
    [65, SHIP_BEAM / 2 - 0.1],
    [100, 12.6],
    [122, 7.3],
  ];
  const positions: number[] = [];
  const indices: number[] = [];

  for (const side of [-1, 1]) {
    const offset = positions.length / 3;
    for (const [z, width] of sections) {
      positions.push(side * width, 6.7, z);
      positions.push(side * width * 0.985, 4.8, z);
    }
    for (let section = 0; section < sections.length - 1; section++) {
      const a = offset + section * 2;
      const b = a + 1;
      const c = a + 3;
      const d = a + 2;
      indices.push(a, b, c, a, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function create_hull(): HullParts {
  const group = new THREE.Group();
  group.name = 'RMS Titanic hull';

  const hull_material = make_pbr_material('Riveted black hull paint', {
    color: HULL_COLOR,
    roughness: 0.42,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });
  const shell = create_mesh(create_hull_shell(), hull_material, 'Hull shell');
  group.add(shell);

  const band_material = make_pbr_material('Antifouling boot top', {
    color: HULL_BAND_COLOR,
    roughness: 0.58,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const band = create_mesh(create_boot_top_geometry(), band_material, 'Red boot top');
  group.add(band);

  const cap_material = make_pbr_material('Hull cap rail', {
    color: 0x282a29,
    roughness: 0.3,
    metalness: 0.78,
  });
  const cap = create_mesh(new THREE.BoxGeometry(27.7, 0.42, 181), cap_material, 'Hull cap rail');
  cap.position.set(0, 15.25, -13);
  group.add(cap);

  const stern_cap = create_mesh(new THREE.CylinderGeometry(13.8, 13.8, 1.1, 24, 1, false, 0, Math.PI), cap_material, 'Stern cap rail');
  stern_cap.rotation.set(Math.PI / 2, 0, 0);
  stern_cap.position.set(0, 15.28, -124);
  stern_cap.scale.set(1, 0.18, 1);
  group.add(stern_cap);

  return { group, hull_material, band_material };
}

function add_deck_box(group: THREE.Group, material: ShipMaterial, name: string, size: readonly [number, number, number], position: readonly [number, number, number]): void {
  const deck = create_mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material, name);
  deck.position.set(position[0], position[1], position[2]);
  group.add(deck);
}

function create_superstructure(): SuperstructureParts {
  const group = new THREE.Group();
  group.name = 'Deckhouses and bridge';

  const material = make_pbr_material('Painted ivory superstructure', {
    color: SUPERSTRUCTURE_COLOR,
    roughness: 0.55,
    metalness: 0.04,
  });
  const deck_material = make_pbr_material('Weathered teak decking', {
    color: 0x765139,
    roughness: 0.74,
    metalness: 0.02,
  });
  const roof_material = make_pbr_material('Canvas deck roofs', {
    color: 0xd4cfbf,
    roughness: 0.82,
    metalness: 0,
  });
  const dark_trim = make_pbr_material('Bridge trim', {
    color: 0x272723,
    roughness: 0.36,
    metalness: 0.45,
  });
  const bridge_glass = make_pbr_material('Bridge glass and night windows', {
    color: 0x1c2530,
    emissive: 0xffaf4a,
    emissiveIntensity: 1.15,
    roughness: 0.2,
    metalness: 0.12,
  });

  // Deck planes are separate from cabin volumes so the teak can remain visible
  // around the deckhouses and lifeboats.
  add_deck_box(group, deck_material, 'Main teak deck', [26.4, 0.55, 188], [0, 15.65, -8]);
  add_deck_box(group, deck_material, 'Promenade deck', [24.2, 0.5, 148], [0, 22.45, -4]);
  add_deck_box(group, deck_material, 'Boat deck', [21.7, 0.5, 132], [0, 28.45, -5]);

  // The cabins are broken into historically legible forward, central and aft
  // masses instead of one uninterrupted rectangular superstructure.
  add_deck_box(group, material, 'Forward deckhouse', [21.4, 5.4, 37], [0, 18.6, 74]);
  add_deck_box(group, material, 'Central deckhouse', [20.7, 5.5, 76], [0, 18.7, -2]);
  add_deck_box(group, material, 'Aft deckhouse', [19.7, 4.7, 45], [0, 18.25, -76]);
  add_deck_box(group, material, 'Promenade saloon', [18.9, 4.35, 104], [0, 25.0, -7]);
  add_deck_box(group, roof_material, 'Promenade roof', [20.4, 0.52, 112], [0, 27.38, -7]);

  add_deck_box(group, material, 'Wheelhouse', [21.4, 4.25, 15], [0, 31.0, 68]);
  add_deck_box(group, roof_material, 'Bridge roof', [22.2, 0.45, 17.5], [0, 33.3, 68]);
  add_deck_box(group, material, 'Chart room', [11.5, 3.7, 12], [0, 30.5, 51]);

  const bridge_windows = create_mesh(new THREE.BoxGeometry(20.7, 1.25, 0.18), bridge_glass, 'Bridge window ribbon');
  bridge_windows.position.set(0, 31.35, 75.57);
  group.add(bridge_windows);

  const bridge_brow = create_mesh(new THREE.BoxGeometry(22, 0.42, 0.8), dark_trim, 'Bridge sun brow');
  bridge_brow.position.set(0, 32.2, 75.75);
  group.add(bridge_brow);

  // Aft stern cabins, the raised forecastle, and two cargo hatches give the
  // silhouette enough asymmetry to read as the Olympic-class liner at distance.
  add_deck_box(group, roof_material, 'Raised forecastle', [22.8, 1.2, 27], [0, 17.3, 106]);
  add_deck_box(group, roof_material, 'Aft cargo hatch', [10.5, 0.7, 9], [0, 16.5, -105]);
  add_deck_box(group, roof_material, 'Forward cargo hatch', [9.5, 0.7, 8], [0, 16.5, 96]);

  return { group, material };
}

function create_funnels(): FunnelParts {
  const group = new THREE.Group();
  group.name = 'Four Titanic funnels';

  const cap_material = make_pbr_material('Funnel caps', {
    color: FUNNEL_TOP_COLOR,
    roughness: 0.32,
    metalness: 0.28,
  });
  const collar_material = make_pbr_material('Funnel collars', {
    color: 0x6b5131,
    roughness: 0.38,
    metalness: 0.45,
  });
  const smoke_origins: THREE.Vector3[] = [];
  const funnel_materials: ShipMaterial[] = [];
  const funnel_z = [48, 16, -17, -49];

  for (let i = 0; i < funnel_z.length; i++) {
    const funnel = new THREE.Group();
    funnel.name = `Funnel ${i + 1}`;

    // Materials stay independent for cosmetics such as the rainbow and gold unlocks.
    const funnel_material = make_pbr_material(`Buff funnel ${i + 1}`, {
      color: FUNNEL_COLOR,
      roughness: 0.46,
      metalness: 0.12,
    });
    funnel_materials.push(funnel_material);

    const lower_collar = create_mesh(new THREE.CylinderGeometry(5.42, 5.42, 1.25, 20), collar_material, 'Funnel lower collar');
    lower_collar.position.y = 1.1;
    funnel.add(lower_collar);

    const body = create_mesh(new THREE.CylinderGeometry(4.45, 5.25, 24.5, 20), funnel_material, 'Funnel body');
    body.position.y = 13;
    funnel.add(body);

    const cap = create_mesh(new THREE.CylinderGeometry(4.62, 4.52, 3.2, 20), cap_material, 'Funnel black top');
    cap.position.y = 26.65;
    funnel.add(cap);

    const rim = create_mesh(new THREE.TorusGeometry(4.6, 0.2, 6, 20), cap_material, 'Funnel rim');
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 28.25;
    funnel.add(rim);

    funnel.position.set(0, 27.8, funnel_z[i]);
    // In the game's axis convention, negative X rotation rakes the top toward stern (-Z).
    funnel.rotation.x = -0.115;
    group.add(funnel);

    // The fourth funnel was primarily ventilating equipment, so it remains smoke-free.
    if (i < 3) smoke_origins.push(new THREE.Vector3(0, 54.8, funnel_z[i] - 2.8));
  }

  return { group, smoke_origins, funnel_materials };
}

function create_instanced_portholes(): THREE.InstancedMesh {
  const geometry = new THREE.CircleGeometry(0.35, 10);
  const material = make_pbr_material('Warm porthole glass', {
    color: 0x30251a,
    emissive: 0xffa644,
    emissiveIntensity: 1.1,
    roughness: 0.18,
    metalness: 0.18,
    side: THREE.DoubleSide,
  });

  const z_positions: number[] = [];
  for (let z = -116; z <= 109; z += 7) z_positions.push(z);
  const count = z_positions.length * 2 * 2;
  const portholes = new THREE.InstancedMesh(geometry, material, count);
  portholes.name = 'Hull portholes';
  portholes.castShadow = false;
  portholes.receiveShadow = false;

  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const side of [-1, 1]) {
    for (const y of [8.5, 11.3]) {
      for (const z of z_positions) {
        matrix.makeRotationY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
        matrix.setPosition(side * (SHIP_BEAM / 2 + 0.08), y, z);
        portholes.setMatrixAt(index++, matrix);
      }
    }
  }
  portholes.instanceMatrix.needsUpdate = true;
  portholes.computeBoundingSphere();
  return portholes;
}

function create_instanced_promenade_windows(): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(0.18, 1.15, 1.85);
  const material = make_pbr_material('Promenade window glass', {
    color: 0x18222b,
    emissive: 0xffb85d,
    emissiveIntensity: 0.95,
    roughness: 0.16,
    metalness: 0.08,
  });
  const z_positions: number[] = [];
  for (let z = -55; z <= 51; z += 4.4) z_positions.push(z);
  const count = z_positions.length * 2 * 2;
  const windows = new THREE.InstancedMesh(geometry, material, count);
  windows.name = 'Promenade windows';
  windows.castShadow = false;
  windows.receiveShadow = false;

  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const side of [-1, 1]) {
    for (const y of [20.4, 25.0]) {
      for (const z of z_positions) {
        matrix.makeTranslation(side * 10.56, y, z);
        windows.setMatrixAt(index++, matrix);
      }
    }
  }
  windows.instanceMatrix.needsUpdate = true;
  windows.computeBoundingSphere();
  return windows;
}

function create_lifeboats(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Lifeboats and davits';

  const boat_material = make_pbr_material('Lifeboat painted canvas', {
    color: 0xe4ded1,
    roughness: 0.72,
    metalness: 0,
  });
  const gunwale_material = make_pbr_material('Lifeboat gunwales', {
    color: 0x5e3927,
    roughness: 0.62,
    metalness: 0.04,
  });
  const boat_z = [-54, -39, -24, -9, 6, 21, 36, 51];
  const count = boat_z.length * 2;
  const hulls = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 7), boat_material, count);
  hulls.name = 'Sixteen lifeboats';
  hulls.castShadow = true;
  hulls.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  let index = 0;
  for (const side of [-1, 1]) {
    for (const z of boat_z) {
      matrix.makeScale(1.2, 0.45, 3.15);
      matrix.setPosition(side * 14.35, 29.6, z);
      hulls.setMatrixAt(index++, matrix);
    }
  }
  hulls.instanceMatrix.needsUpdate = true;
  hulls.computeBoundingSphere();
  group.add(hulls);

  // One batched line mesh supplies both lifeboat gunwales and their davits.
  const lines: number[] = [];
  const add_line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    lines.push(ax, ay, az, bx, by, bz);
  };
  for (const side of [-1, 1]) {
    for (const z of boat_z) {
      const x = side * 14.35;
      add_line(x - 0.8, 29.7, z - 2.7, x - 0.8, 29.7, z + 2.7);
      add_line(x + 0.8, 29.7, z - 2.7, x + 0.8, 29.7, z + 2.7);
      add_line(side * 12.05, 27.1, z - 2.7, side * 14.95, 32.6, z - 2.7);
      add_line(side * 12.05, 27.1, z + 2.7, side * 14.95, 32.6, z + 2.7);
    }
  }
  const davit_geometry = new THREE.BufferGeometry();
  davit_geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const davits = new THREE.LineSegments(davit_geometry, new THREE.LineBasicMaterial({ color: gunwale_material.color.getHex() }));
  davits.name = 'Lifeboat davits';
  group.add(davits);

  return group;
}

function create_railings(): THREE.LineSegments {
  const vertices: number[] = [];
  const add_line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    vertices.push(ax, ay, az, bx, by, bz);
  };
  const add_side_railing = (side: number, x: number, y: number, from_z: number, to_z: number, spacing: number): void => {
    add_line(side * x, y, from_z, side * x, y, to_z);
    add_line(side * x, y + 1.1, from_z, side * x, y + 1.1, to_z);
    for (let z = from_z; z <= to_z; z += spacing) add_line(side * x, y - 0.1, z, side * x, y + 1.2, z);
  };

  for (const side of [-1, 1]) {
    add_side_railing(side, 13.2, 16.1, -117, 111, 7.5);
    add_side_railing(side, 11.85, 22.85, -69, 69, 8);
    add_side_railing(side, 10.65, 28.8, -62, 62, 9);
  }
  // Bow rails complete the characteristic pointed forecastle outline.
  for (const y of [16.15, 17.25]) {
    add_line(-13.2, y, 111, 0, y + 0.75, 130);
    add_line(13.2, y, 111, 0, y + 0.75, 130);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const railings = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x353632, transparent: true, opacity: 0.84 }));
  railings.name = 'Deck railings';
  return railings;
}

function create_masts_and_rigging(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Masts and rigging';
  const mast_material = make_pbr_material('Mast and rigging metal', {
    color: 0x302e2a,
    roughness: 0.35,
    metalness: 0.8,
  });

  const fore_mast = create_mesh(new THREE.CylinderGeometry(0.55, 1.05, 48, 8), mast_material, 'Fore mast');
  fore_mast.position.set(0, 42.5, 95);
  fore_mast.rotation.x = -0.08;
  group.add(fore_mast);

  const aft_mast = create_mesh(new THREE.CylinderGeometry(0.48, 0.9, 40, 8), mast_material, 'Aft mast');
  aft_mast.position.set(0, 39.5, -93);
  aft_mast.rotation.x = -0.06;
  group.add(aft_mast);

  const crow_nest = create_mesh(new THREE.CylinderGeometry(2.15, 1.8, 0.7, 12), mast_material, 'Crows nest');
  crow_nest.position.set(0, 56.3, 95);
  group.add(crow_nest);

  const lines: number[] = [];
  const add_line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    lines.push(ax, ay, az, bx, by, bz);
  };
  for (const side of [-1, 1]) {
    add_line(0, 64, 95, side * 12.5, 16, 128);
    add_line(0, 64, 95, side * 11.5, 23, 54);
    add_line(0, 59, -93, side * 11.5, 22, -122);
    add_line(0, 59, -93, side * 10.5, 24, -48);
  }
  add_line(0, 64, 95, 0, 59, -93);
  const rigging_geometry = new THREE.BufferGeometry();
  rigging_geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const rigging = new THREE.LineSegments(rigging_geometry, new THREE.LineBasicMaterial({ color: 0x262522, transparent: true, opacity: 0.62 }));
  rigging.name = 'Rigging';
  group.add(rigging);

  const flag_shape = new THREE.Shape();
  flag_shape.moveTo(0, 0);
  flag_shape.lineTo(6.2, -1.6);
  flag_shape.lineTo(0, -3.2);
  flag_shape.closePath();
  const ensign = create_mesh(new THREE.ShapeGeometry(flag_shape), new THREE.MeshBasicMaterial({ color: 0xa92731, side: THREE.DoubleSide }), 'Stern ensign');
  ensign.position.set(0.1, 57.4, -93);
  group.add(ensign);

  return group;
}

function create_propulsion(): PropulsionParts {
  const group = new THREE.Group();
  group.name = 'Rudder and propellers';
  const bronze = make_pbr_material('Bronze propellers', {
    color: 0x8b6330,
    roughness: 0.3,
    metalness: 0.86,
  });
  const rudder_material = make_pbr_material('Rudder steel', {
    color: 0x24292c,
    roughness: 0.38,
    metalness: 0.68,
  });
  const propellers: THREE.Group[] = [];

  for (const x of [-7.1, 0, 7.1]) {
    const propeller = new THREE.Group();
    propeller.name = x === 0 ? 'Centre propeller' : 'Wing propeller';
    propeller.position.set(x, -4.8, -133.8);

    const hub = create_mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.7, 12), bronze, 'Propeller hub');
    hub.rotation.x = Math.PI / 2;
    propeller.add(hub);
    for (let blade = 0; blade < 3; blade++) {
      const blade_mesh = create_mesh(new THREE.BoxGeometry(0.72, 3.8, 0.22), bronze, 'Propeller blade');
      blade_mesh.position.y = 2.05;
      blade_mesh.rotation.z = (blade / 3) * Math.PI * 2 + 0.28;
      propeller.add(blade_mesh);
    }
    group.add(propeller);
    propellers.push(propeller);
  }

  const rudder = create_mesh(new THREE.BoxGeometry(2.2, 6.5, 0.55), rudder_material, 'Stern rudder');
  rudder.position.set(0, -2.2, -135.2);
  group.add(rudder);
  return { group, propellers };
}

function create_deck_lamps(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Deck lamps';
  const lamp_material = make_pbr_material('Deck lamp glass', {
    color: 0xffd291,
    emissive: 0xffad55,
    emissiveIntensity: 2.2,
    roughness: 0.25,
    metalness: 0.05,
  });
  const positions: ReadonlyArray<readonly [number, number, number]> = [
    [-10.8, 19.7, 62], [10.8, 19.7, 62], [-10.8, 19.7, 25], [10.8, 19.7, 25],
    [-10.8, 19.7, -28], [10.8, 19.7, -28], [-10.8, 19.7, -67], [10.8, 19.7, -67],
  ];
  const lamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6), lamp_material, positions.length);
  lamps.name = 'Emissive deck lamps';
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < positions.length; i++) {
    const [x, y, z] = positions[i];
    matrix.makeTranslation(x, y, z);
    lamps.setMatrixAt(i, matrix);
  }
  lamps.instanceMatrix.needsUpdate = true;
  group.add(lamps);

  // A few real lights provide local PBR illumination without turning the liner
  // into a shader-expensive collection of one light per porthole.
  for (const z of [54, -4, -62]) {
    const light = new THREE.PointLight(0xffc36f, 45, 34, 2);
    light.position.set(0, 25, z);
    group.add(light);
  }
  return group;
}

export class TitanicShip {
  readonly group: THREE.Group;

  private readonly smoke_systems: FunnelSmoke[] = [];
  private readonly inner: THREE.Group;
  private readonly hull_material: ShipMaterial;
  private readonly band_material: ShipMaterial;
  private readonly superstructure_material: ShipMaterial;
  private readonly funnel_materials: ShipMaterial[];
  private readonly propellers: THREE.Group[];
  private readonly medium_detail_groups: THREE.Object3D[] = [];
  private readonly high_detail_groups: THREE.Object3D[] = [];
  private searchlight: THREE.SpotLight | null = null;
  private quality_lod_cap = 2;
  private distance_lod = 2;
  private active_lod = -1;
  private disposed = false;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'RMS Titanic';
    this.inner = new THREE.Group();
    this.inner.name = 'RMS Titanic visual rig';

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

    const portholes = create_instanced_portholes();
    const promenade_windows = create_instanced_promenade_windows();
    const lifeboats = create_lifeboats();
    const railings = create_railings();
    const masts_and_rigging = create_masts_and_rigging();
    const deck_lamps = create_deck_lamps();
    this.high_detail_groups.push(portholes, promenade_windows);
    this.medium_detail_groups.push(lifeboats, railings, masts_and_rigging, deck_lamps);
    this.inner.add(portholes, promenade_windows, lifeboats, railings, masts_and_rigging, deck_lamps);

    const propulsion = create_propulsion();
    this.propellers = propulsion.propellers;
    this.inner.add(propulsion.group);

    this.group.add(this.inner);
    this.apply_lod_visibility();
  }

  /** Caps procedural-detail cost for the renderer quality tier without changing collision or movement. */
  set_quality(quality: ShipQuality): void {
    this.quality_lod_cap = quality === 'low' ? 0 : quality === 'medium' ? 1 : 2;
    this.apply_lod_visibility();
  }

  /** Distance LOD is cheap enough to evaluate from the active gameplay camera every frame. */
  set_lod_distance(camera_distance: number): void {
    const next_distance_lod = camera_distance > 780 ? 0 : camera_distance > 330 ? 1 : 2;
    if (next_distance_lod === this.distance_lod) return;
    this.distance_lod = next_distance_lod;
    this.apply_lod_visibility();
  }

  /** Cosmetic unlock: forward searchlight mounted on the foremast. */
  set_searchlight(enabled: boolean): void {
    if (enabled && !this.searchlight) {
      const light = new THREE.SpotLight(0xfff4d6, 900, 700, 0.22, 0.45, 1.2);
      light.name = 'Foremast searchlight';
      light.position.set(0, 53, 90);
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
      material.depthWrite = true;
      material.emissive.setHex(0x000000);
      material.needsUpdate = true;
    }
    this.hull_material.color.setHex(HULL_COLOR);
    this.hull_material.roughness = 0.42;
    this.hull_material.metalness = 0.18;
    this.band_material.color.setHex(HULL_BAND_COLOR);
    this.superstructure_material.color.setHex(SUPERSTRUCTURE_COLOR);
    for (const funnel of this.funnel_materials) {
      funnel.color.setHex(FUNNEL_COLOR);
      funnel.roughness = 0.46;
      funnel.metalness = 0.12;
    }

    if (skin_id === 'royal_mail') {
      this.hull_material.color.setHex(0x9e2b25);
      this.band_material.color.setHex(0xe8dcc0);
    } else if (skin_id === 'brass_teak') {
      this.hull_material.color.setHex(0x2c2118);
      this.hull_material.roughness = 0.33;
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
        material.depthWrite = false;
      }
    } else if (skin_id === 'rainbow') {
      const rainbow = [0xe2574c, 0xe9b44c, 0x5ec98a, 0x5a8fd9];
      this.funnel_materials.forEach((funnel, index) => {
        funnel.color.setHex(rainbow[index]);
        funnel.emissive.setHex(0x111111);
      });
    } else if (golden_funnels) {
      for (const funnel of this.funnel_materials) {
        funnel.color.setHex(0xd4a747);
        funnel.emissive.setHex(0x4a3408);
        funnel.metalness = 0.28;
      }
    }
  }

  /** Bob, pitch, roll, animate smoke, and turn the submerged propellers. */
  update(time: number, delta: number, turn_heel = 0): void {
    if (this.disposed) return;

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

    if (this.active_lod >= 1) {
      for (const smoke of this.smoke_systems) smoke.update(delta);
    }
    for (const propeller of this.propellers) propeller.rotation.z += delta * 8;
  }

  /** Release all procedural GPU resources when a game instance is permanently discarded. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      const renderable = object as THREE.Mesh | THREE.Points | THREE.LineSegments;
      if (renderable.geometry instanceof THREE.BufferGeometry) geometries.add(renderable.geometry);
      const material = renderable.material;
      if (Array.isArray(material)) {
        for (const entry of material) materials.add(entry);
      } else if (material instanceof THREE.Material) {
        materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.group.removeFromParent();
    this.group.clear();
    this.searchlight = null;
  }

  private apply_lod_visibility(): void {
    const next_lod = Math.min(this.distance_lod, this.quality_lod_cap);
    if (next_lod === this.active_lod) return;
    this.active_lod = next_lod;
    for (const detail of this.medium_detail_groups) detail.visible = next_lod >= 1;
    for (const detail of this.high_detail_groups) detail.visible = next_lod >= 2;
    for (const smoke of this.smoke_systems) smoke.points.visible = next_lod >= 1;
  }
}
