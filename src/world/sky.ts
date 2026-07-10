// file: src/world/sky.ts
// description: Camera-relative cinematic sky, cloud/haze shader, celestial lighting, and reusable weather controls
// reference: src/world/palette.ts, src/world/ocean.ts, src/main.ts

import * as THREE from 'three';
import { Palette } from './palette';

const DOME_VERTEX = /* glsl */ `
  varying vec3 v_dir;
  void main() {
    v_dir = normalize(position);
    vec4 pos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = pos.xyww;
  }
`;

const DOME_FRAGMENT = /* glsl */ `
  uniform vec3 u_top;
  uniform vec3 u_horizon;
  uniform vec3 u_bottom;
  uniform float u_time;
  uniform float u_aurora;
  uniform float u_cloud_coverage;
  uniform float u_storm;
  uniform float u_lightning;
  varying vec3 v_dir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 4; i++) {
      value += noise(p) * amplitude;
      p = mat2(1.65, -1.2, 1.2, 1.65) * p;
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    float horizon_height = clamp(v_dir.y, -0.16, 1.0);
    vec3 color = mix(u_bottom, u_horizon, smoothstep(-0.16, 0.07, horizon_height));
    color = mix(color, u_top, smoothstep(0.05, 0.72, horizon_height));

    // Thin low cloud bank plus a slower, larger storm layer. It is deliberately
    // inexpensive: atmospheric depth comes from fog and the water reflection.
    vec2 cloud_uv = v_dir.xz * (2.5 + max(v_dir.y, 0.0) * 3.5);
    float cloud_a = fbm(cloud_uv + vec2(u_time * 0.004, -u_time * 0.002));
    float cloud_b = fbm(cloud_uv * 0.48 + vec2(-u_time * 0.0015, u_time * 0.001));
    float clouds = mix(cloud_a, cloud_b, u_storm * 0.75);
    float cloud_threshold = mix(0.82, 0.42, u_cloud_coverage);
    float cloud_mask = smoothstep(cloud_threshold, cloud_threshold + 0.18, clouds);
    cloud_mask *= smoothstep(-0.08, 0.18, v_dir.y) * (1.0 - smoothstep(0.65, 0.95, v_dir.y));
    vec3 cloud_color = mix(vec3(0.72, 0.77, 0.82), vec3(0.04, 0.07, 0.11), u_storm);
    color = mix(color, cloud_color, cloud_mask * mix(0.42, 0.88, u_storm));

    // A soft horizon haze keeps the ocean/sky seam cinematic without a costly
    // volumetric pass. Scene fog provides the matching depth on geometry.
    float haze = exp(-abs(v_dir.y) * mix(26.0, 12.0, u_storm));
    color = mix(color, u_horizon, haze * mix(0.16, 0.42, u_storm));

    if (u_aurora > 0.5 && v_dir.y > 0.1) {
      float band_a = sin(v_dir.x * 6.0 + u_time * 0.21 + sin(v_dir.y * 9.0) * 1.4);
      float band_b = sin(v_dir.x * 11.0 - u_time * 0.13 + v_dir.z * 5.0);
      float ribbon = smoothstep(0.58, 0.96, band_a) + smoothstep(0.68, 0.99, band_b) * 0.6;
      float height_mask = smoothstep(0.1, 0.28, v_dir.y) * (1.0 - smoothstep(0.52, 0.9, v_dir.y));
      vec3 aurora = mix(vec3(0.22, 0.92, 0.53), vec3(0.31, 0.53, 0.96), 0.5 + 0.5 * sin(v_dir.x * 3.0 + u_time * 0.1));
      color += aurora * ribbon * height_mask * 0.34;
    }

    color += vec3(0.55, 0.69, 0.84) * u_lightning * (0.3 + 0.7 * haze);
    gl_FragColor = vec4(color, 1.0);
  }
`;

interface StarField {
  points: THREE.Points;
  material: THREE.PointsMaterial;
}

function create_stars(opacity: number): StarField {
  const star_count = 1800;
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
    color: 0xd9e9f7,
    size: 2.1,
    sizeAttenuation: false,
    transparent: true,
    opacity,
    fog: false,
    depthWrite: false,
  });

  return { points: new THREE.Points(geometry, material), material };
}

/**
 * Sky owns only visual/environment light state. Gameplay controls weather via
 * palettes so swapping a preset never reallocates the scene graph.
 */
export class Sky {
  readonly group: THREE.Group;
  readonly moon_dir: THREE.Vector3;

  private readonly dome_material: THREE.ShaderMaterial;
  private readonly stars_material: THREE.PointsMaterial;
  private readonly moon_material: THREE.MeshBasicMaterial;
  private readonly halo_material: THREE.MeshBasicMaterial;
  private readonly key_light: THREE.DirectionalLight;
  private readonly rim_light: THREE.DirectionalLight;
  private readonly ambient: THREE.AmbientLight;
  private readonly hemi: THREE.HemisphereLight;
  private storm_intensity = 0;
  private cloud_coverage = 0;
  private key_light_intensity = 1;

  constructor(palette: Palette) {
    this.group = new THREE.Group();
    this.group.name = 'CinematicSky';
    this.moon_dir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();

    const dome_geometry = new THREE.SphereGeometry(4000, 36, 22);
    this.dome_material = new THREE.ShaderMaterial({
      vertexShader: DOME_VERTEX,
      fragmentShader: DOME_FRAGMENT,
      uniforms: {
        u_top: { value: new THREE.Color(palette.sky_top) },
        u_horizon: { value: new THREE.Color(palette.sky_horizon) },
        u_bottom: { value: new THREE.Color(palette.sky_bottom) },
        u_time: { value: 0 },
        u_aurora: { value: palette.has_aurora ? 1 : 0 },
        u_cloud_coverage: { value: palette.cloud_coverage },
        u_storm: { value: palette.storm_intensity },
        u_lightning: { value: 0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new THREE.Mesh(dome_geometry, this.dome_material);
    dome.frustumCulled = false;
    dome.renderOrder = -10;
    this.group.add(dome);

    const stars = create_stars(palette.star_opacity);
    this.stars_material = stars.material;
    this.group.add(stars.points);

    this.moon_material = new THREE.MeshBasicMaterial({ color: palette.moon_color, fog: false });
    const moon = new THREE.Mesh(new THREE.CircleGeometry(72, 40), this.moon_material);
    moon.position.copy(this.moon_dir).multiplyScalar(3200);
    moon.lookAt(0, 0, 0);
    this.group.add(moon);

    this.halo_material = new THREE.MeshBasicMaterial({
      color: palette.moon_glow,
      transparent: true,
      opacity: 0.2,
      fog: false,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(new THREE.CircleGeometry(160, 40), this.halo_material);
    halo.position.copy(this.moon_dir).multiplyScalar(3180);
    halo.lookAt(0, 0, 0);
    this.group.add(halo);

    this.key_light = new THREE.DirectionalLight(palette.key_light_color, palette.key_light_intensity);
    this.key_light.position.copy(this.moon_dir).multiplyScalar(500);
    this.group.add(this.key_light);

    this.rim_light = new THREE.DirectionalLight(palette.rim_light_color, 0.8);
    this.rim_light.position.set(300, 120, 420);
    this.group.add(this.rim_light);

    this.ambient = new THREE.AmbientLight(palette.ambient_color, palette.ambient_intensity);
    this.group.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(palette.sky_horizon, palette.ocean_deep, 0.55);
    this.group.add(this.hemi);

    this.set_palette(palette);
  }

  set_palette(palette: Palette): void {
    (this.dome_material.uniforms.u_top.value as THREE.Color).setHex(palette.sky_top);
    (this.dome_material.uniforms.u_horizon.value as THREE.Color).setHex(palette.sky_horizon);
    (this.dome_material.uniforms.u_bottom.value as THREE.Color).setHex(palette.sky_bottom);
    this.dome_material.uniforms.u_aurora.value = palette.has_aurora ? 1 : 0;
    this.stars_material.opacity = palette.star_opacity;
    this.moon_material.color.setHex(palette.moon_color);
    this.halo_material.color.setHex(palette.moon_glow);
    this.key_light.color.setHex(palette.key_light_color);
    this.key_light_intensity = palette.key_light_intensity;
    this.key_light.intensity = this.key_light_intensity;
    this.rim_light.color.setHex(palette.rim_light_color);
    this.ambient.color.setHex(palette.ambient_color);
    this.ambient.intensity = palette.ambient_intensity;
    this.hemi.color.setHex(palette.sky_horizon);
    this.hemi.groundColor.setHex(palette.ocean_deep);
    this.set_weather(palette.cloud_coverage, palette.storm_intensity);
  }

  set_weather(cloud_coverage: number, storm_intensity: number): void {
    this.cloud_coverage = THREE.MathUtils.clamp(cloud_coverage, 0, 1);
    this.storm_intensity = THREE.MathUtils.clamp(storm_intensity, 0, 1);
    this.dome_material.uniforms.u_cloud_coverage.value = this.cloud_coverage;
    this.dome_material.uniforms.u_storm.value = this.storm_intensity;
  }

  /** Keep a finite sky sphere centered on the active gameplay camera. */
  update(time: number, anchor_x = 0, anchor_y = 0, anchor_z = 0): void {
    this.group.position.set(anchor_x, anchor_y, anchor_z);
    this.dome_material.uniforms.u_time.value = time;

    // Sparse procedural lightning flashes only in the storm preset. The pulse is
    // deterministic from elapsed time, avoiding random allocations or timers.
    const beat = Math.sin(time * 0.73 + Math.sin(time * 0.19) * 3.0);
    const flash = Math.max(beat - 0.972, 0) * 34.0 * this.storm_intensity;
    this.dome_material.uniforms.u_lightning.value = Math.min(flash, 1);
    this.key_light.intensity = this.key_light_intensity + flash * 0.85;
  }

  dispose(): void {
    this.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    this.dome_material.dispose();
    this.stars_material.dispose();
    this.moon_material.dispose();
    this.halo_material.dispose();
  }
}
