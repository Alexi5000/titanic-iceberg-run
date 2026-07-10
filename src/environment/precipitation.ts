// file: src/environment/precipitation.ts
// description: Camera-anchored pooled rain and sea-mist particle system with quality-scalable counts
// reference: src/world/sky.ts, src/main.ts

import * as THREE from 'three';

interface RainParticle {
  fall_speed: number;
  drift: number;
}

const RAIN_RADIUS = 170;
const RAIN_HEIGHT = 150;

const PARTICLE_VERTEX_SHADER = /* glsl */ `
  uniform float u_size;
  void main() {
    vec4 model_view_position = modelViewMatrix * vec4(position, 1.0);
    float distance_scale = 230.0 / max(1.0, -model_view_position.z);
    gl_PointSize = clamp(u_size * distance_scale, 1.0, 52.0);
    gl_Position = projectionMatrix * model_view_position;
  }
`;

const PARTICLE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 u_color;
  uniform float u_opacity;
  uniform float u_streak;
  void main() {
    vec2 point = gl_PointCoord - 0.5;
    vec2 shape_point = mix(point, vec2(point.x * 2.8, point.y * 0.42), u_streak);
    float radius = length(shape_point) * 2.0;
    float alpha = (1.0 - smoothstep(0.52, 1.0, radius)) * u_opacity;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(u_color, alpha);
  }
`;

function create_particle_material(color: number, size: number, streak: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      u_color: { value: new THREE.Color(color) },
      u_size: { value: size },
      u_opacity: { value: 0 },
      u_streak: { value: streak },
    },
    vertexShader: PARTICLE_VERTEX_SHADER,
    fragmentShader: PARTICLE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}

/**
 * The system intentionally uses point sprites without external textures. It is
 * cheap enough for rain to remain readable in gameplay while bloom turns the
 * closest drops into a restrained cinematic layer.
 */
export class Precipitation {
  readonly group = new THREE.Group();

  private rain!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private mist!: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private rain_positions!: Float32Array;
  private mist_positions!: Float32Array;
  private rain_particles: RainParticle[] = [];
  private intensity = 0;
  private rain_count: number;
  private mist_count: number;

  constructor(rain_count = 1100, mist_count = 140) {
    this.rain_count = rain_count;
    this.mist_count = mist_count;
    this.rain = this.create_rain();
    this.mist = this.create_mist();
    this.group.name = 'Precipitation';
    this.group.add(this.rain, this.mist);
    this.group.visible = false;
  }

  private create_rain(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    this.rain_positions = new Float32Array(this.rain_count * 3);
    this.rain_particles = new Array<RainParticle>(this.rain_count);
    for (let i = 0; i < this.rain_count; i++) {
      this.reset_rain(i, true);
      this.rain_particles[i] = {
        fall_speed: 52 + Math.random() * 54,
        drift: Math.random() * 2 - 1,
      };
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.rain_positions, 3));
    const material = create_particle_material(0xb9d6e6, 1.9, 1);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private create_mist(): THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial> {
    this.mist_positions = new Float32Array(this.mist_count * 3);
    for (let i = 0; i < this.mist_count; i++) this.reset_mist(i, true);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.mist_positions, 3));
    const material = create_particle_material(0xd9edf1, 7, 0);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    return points;
  }

  private reset_rain(index: number, initial: boolean): void {
    const offset = index * 3;
    this.rain_positions[offset] = (Math.random() * 2 - 1) * RAIN_RADIUS;
    this.rain_positions[offset + 1] = initial ? Math.random() * RAIN_HEIGHT : RAIN_HEIGHT * (0.86 + Math.random() * 0.14);
    this.rain_positions[offset + 2] = (Math.random() * 2 - 1) * RAIN_RADIUS;
  }

  private reset_mist(index: number, initial: boolean): void {
    const offset = index * 3;
    const distance = 35 + Math.random() * 200;
    const angle = Math.random() * Math.PI * 2;
    this.mist_positions[offset] = Math.cos(angle) * distance;
    this.mist_positions[offset + 1] = initial ? 1 + Math.random() * 14 : 2 + Math.random() * 8;
    this.mist_positions[offset + 2] = Math.sin(angle) * distance;
  }

  set_intensity(intensity: number): void {
    this.intensity = THREE.MathUtils.clamp(intensity, 0, 1);
    this.group.visible = this.intensity > 0.01;
    this.rain.material.uniforms.u_opacity.value = this.intensity * 0.46;
    this.mist.material.uniforms.u_opacity.value = this.intensity * 0.08;
  }

  /** Quality changes occur outside gameplay hot paths and may recreate buffers. */
  set_quality(rain_count: number, mist_count: number): void {
    if (rain_count === this.rain_count && mist_count === this.mist_count) return;
    this.group.remove(this.rain, this.mist);
    this.rain.geometry.dispose();
    this.rain.material.dispose();
    this.mist.geometry.dispose();
    this.mist.material.dispose();
    this.rain_count = rain_count;
    this.mist_count = mist_count;
    this.rain = this.create_rain();
    this.mist = this.create_mist();
    this.group.add(this.rain, this.mist);
    this.set_intensity(this.intensity);
  }

  update(
    delta: number,
    anchor_x: number,
    anchor_y: number,
    anchor_z: number,
    wind_x: number,
    wind_z: number,
    time: number,
  ): void {
    if (this.intensity <= 0.01) return;
    this.group.position.set(anchor_x, anchor_y - 12, anchor_z);

    const rain_step = delta * (0.55 + this.intensity * 0.75);
    for (let i = 0; i < this.rain_count; i++) {
      const offset = i * 3;
      const particle = this.rain_particles[i];
      this.rain_positions[offset] += (wind_x * 18 + particle.drift * 4) * rain_step;
      this.rain_positions[offset + 1] -= particle.fall_speed * rain_step;
      this.rain_positions[offset + 2] += (wind_z * 18 + particle.drift * 3) * rain_step;
      if (
        this.rain_positions[offset + 1] < -8 ||
        Math.abs(this.rain_positions[offset]) > RAIN_RADIUS ||
        Math.abs(this.rain_positions[offset + 2]) > RAIN_RADIUS
      ) {
        this.reset_rain(i, false);
      }
    }

    const mist_step = delta * (2.2 + this.intensity * 3.6);
    for (let i = 0; i < this.mist_count; i++) {
      const offset = i * 3;
      this.mist_positions[offset] += (wind_x * 7 + Math.sin(time * 0.23 + i) * 0.7) * mist_step;
      this.mist_positions[offset + 2] += (wind_z * 7 + Math.cos(time * 0.19 + i) * 0.7) * mist_step;
      if (Math.hypot(this.mist_positions[offset], this.mist_positions[offset + 2]) > 230) {
        this.reset_mist(i, false);
      }
    }

    (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.mist.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }

  dispose(): void {
    this.rain.geometry.dispose();
    this.rain.material.dispose();
    this.mist.geometry.dispose();
    this.mist.material.dispose();
  }
}
