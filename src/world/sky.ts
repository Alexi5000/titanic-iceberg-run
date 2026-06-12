// file: src/world/sky.ts
// description: Palette-driven sky - gradient dome shader, star field, moon with halo, optional animated aurora ribbons, and the scene lighting rig
// reference: src/main.ts, src/world/palette.ts, src/world/ocean.ts

import * as THREE from 'three';
import { Palette } from './palette';

const DOME_VERTEX = /* glsl */ `
  varying vec3 v_dir;
  void main() {
    v_dir = normalize(position);
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos.xyww; // push to far plane
  }
`;

const DOME_FRAGMENT = /* glsl */ `
  uniform vec3 u_top;
  uniform vec3 u_horizon;
  uniform vec3 u_bottom;
  uniform float u_time;
  uniform float u_aurora;
  varying vec3 v_dir;

  void main() {
    float h = clamp(v_dir.y, -0.12, 1.0);
    vec3 color;
    if (h < 0.06) {
      color = mix(u_bottom, u_horizon, smoothstep(-0.12, 0.06, h));
    } else {
      color = mix(u_horizon, u_top, smoothstep(0.06, 0.65, h));
    }

    if (u_aurora > 0.5 && v_dir.y > 0.12) {
      float band1 = sin(v_dir.x * 6.0 + u_time * 0.21 + sin(v_dir.y * 9.0) * 1.4);
      float band2 = sin(v_dir.x * 11.0 - u_time * 0.13 + v_dir.z * 5.0);
      float ribbon = smoothstep(0.55, 0.95, band1) + smoothstep(0.65, 0.98, band2) * 0.6;
      float height_mask = smoothstep(0.12, 0.3, v_dir.y) * (1.0 - smoothstep(0.55, 0.9, v_dir.y));
      vec3 aurora_a = vec3(0.25, 0.95, 0.55);
      vec3 aurora_b = vec3(0.35, 0.55, 0.95);
      vec3 aurora_color = mix(aurora_a, aurora_b, 0.5 + 0.5 * sin(v_dir.x * 3.0 + u_time * 0.1));
      color += aurora_color * ribbon * height_mask * 0.35;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

function create_stars(opacity: number): THREE.Points {
  const star_count = 1600;
  const positions = new Float32Array(star_count * 3);

  for (let i = 0; i < star_count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const radius = 3400;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) + 40;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xcfe0f5,
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    fog: false,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export class Sky {
  readonly group: THREE.Group;
  readonly moon_dir: THREE.Vector3;
  private readonly dome_material: THREE.ShaderMaterial;

  constructor(palette: Palette) {
    this.group = new THREE.Group();
    this.moon_dir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();

    const dome_geometry = new THREE.SphereGeometry(4000, 32, 18);
    this.dome_material = new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: {
        u_top: { value: new THREE.Color(palette.sky_top) },
        u_horizon: { value: new THREE.Color(palette.sky_horizon) },
        u_bottom: { value: new THREE.Color(palette.sky_bottom) },
        u_time: { value: 0 },
        u_aurora: { value: palette.has_aurora ? 1 : 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(dome_geometry, this.dome_material);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.group.add(dome);

    this.group.add(create_stars(palette.star_opacity));

    const moon = new THREE.Mesh(
      new THREE.CircleGeometry(72, 40),
      new THREE.MeshBasicMaterial({ color: palette.moon_color, fog: false }),
    );
    moon.position.copy(this.moon_dir).multiplyScalar(3200);
    moon.lookAt(0, 0, 0);
    this.group.add(moon);

    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(160, 40),
      new THREE.MeshBasicMaterial({
        color: palette.moon_glow,
        transparent: true,
        opacity: 0.2,
        fog: false,
        depthWrite: false,
      }),
    );
    halo.position.copy(this.moon_dir).multiplyScalar(3180);
    halo.lookAt(0, 0, 0);
    this.group.add(halo);

    const key_light = new THREE.DirectionalLight(palette.key_light_color, palette.key_light_intensity);
    key_light.position.copy(this.moon_dir).multiplyScalar(500);
    this.group.add(key_light);

    // Rim light from behind-left for the warm silhouette edge.
    const rim = new THREE.DirectionalLight(palette.rim_light_color, 0.8);
    rim.position.set(300, 120, 420);
    this.group.add(rim);

    const ambient = new THREE.AmbientLight(palette.ambient_color, palette.ambient_intensity);
    this.group.add(ambient);

    const hemi = new THREE.HemisphereLight(palette.sky_horizon, palette.ocean_deep, 0.55);
    this.group.add(hemi);
  }

  update(time: number): void {
    this.dome_material.uniforms.u_time.value = time;
  }
}
