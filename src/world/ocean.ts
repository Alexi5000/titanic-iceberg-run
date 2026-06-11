// file: src/world/ocean.ts
// description: Animated dark North Atlantic ocean with shader-driven waves and a CPU wave mirror for ship bobbing
// reference: src/main.ts, src/ship/titanic_model.ts

import * as THREE from 'three';

interface WaveDef {
  amplitude: number;
  dir_x: number;
  dir_z: number;
  frequency: number;
  speed: number;
}

const WAVES: WaveDef[] = [
  { amplitude: 0.55, dir_x: 1.0, dir_z: 0.25, frequency: 0.045, speed: 0.9 },
  { amplitude: 0.3, dir_x: -0.55, dir_z: 1.0, frequency: 0.085, speed: 1.3 },
  { amplitude: 0.16, dir_x: 0.3, dir_z: -0.8, frequency: 0.16, speed: 1.9 },
];

/** CPU mirror of the vertex shader wave function, used to bob the ship and icebergs. */
export function wave_height(x: number, z: number, time: number): number {
  let h = 0;
  for (const w of WAVES) {
    const phase = (x * w.dir_x + z * w.dir_z) * w.frequency + time * w.speed;
    h += w.amplitude * Math.sin(phase);
  }
  return h;
}

const VERTEX_SHADER = /* glsl */ `
  uniform float u_time;
  varying vec3 v_world_pos;
  varying vec3 v_normal;

  vec3 wave(vec3 p) {
    float h = 0.0;
    float dhx = 0.0;
    float dhz = 0.0;
    ${WAVES.map(
      (w) => `
    {
      float phase = (p.x * ${w.dir_x.toFixed(3)} + p.z * ${w.dir_z.toFixed(3)}) * ${w.frequency.toFixed(4)} + u_time * ${w.speed.toFixed(3)};
      h += ${w.amplitude.toFixed(3)} * sin(phase);
      float d = ${w.amplitude.toFixed(3)} * cos(phase) * ${w.frequency.toFixed(4)};
      dhx += d * ${w.dir_x.toFixed(3)};
      dhz += d * ${w.dir_z.toFixed(3)};
    }`,
    ).join('')}
    v_normal = normalize(vec3(-dhx, 1.0, -dhz));
    return vec3(p.x, h, p.z);
  }

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 displaced = wave(world.xyz);
    v_world_pos = displaced;
    gl_Position = projectionMatrix * viewMatrix * vec4(displaced, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 u_deep_color;
  uniform vec3 u_surface_color;
  uniform vec3 u_moon_dir;
  uniform vec3 u_moon_color;
  uniform vec3 u_camera_pos;
  uniform vec3 u_fog_color;
  uniform float u_fog_density;
  varying vec3 v_world_pos;
  varying vec3 v_normal;

  void main() {
    vec3 normal = normalize(v_normal);
    vec3 view_dir = normalize(u_camera_pos - v_world_pos);

    float fresnel = pow(1.0 - max(dot(normal, view_dir), 0.0), 3.0);
    vec3 color = mix(u_deep_color, u_surface_color, fresnel * 0.9);

    float diffuse = max(dot(normal, u_moon_dir), 0.0);
    color += u_moon_color * diffuse * 0.06;

    vec3 reflected = reflect(-view_dir, normal);
    float spec = pow(max(dot(reflected, u_moon_dir), 0.0), 220.0);
    color += u_moon_color * spec * 0.9;

    float dist = length(u_camera_pos - v_world_pos);
    float fog = 1.0 - exp(-u_fog_density * u_fog_density * dist * dist);
    color = mix(color, u_fog_color, clamp(fog, 0.0, 1.0));

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Ocean {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;

  constructor(fog_color: THREE.Color, fog_density: number, moon_dir: THREE.Vector3) {
    const geometry = new THREE.PlaneGeometry(2600, 2600, 180, 180);
    geometry.rotateX(-Math.PI / 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        u_time: { value: 0 },
        u_deep_color: { value: new THREE.Color(0x02101e) },
        u_surface_color: { value: new THREE.Color(0x0c2a44) },
        u_moon_dir: { value: moon_dir.clone().normalize() },
        u_moon_color: { value: new THREE.Color(0xbcd2e8) },
        u_camera_pos: { value: new THREE.Vector3() },
        u_fog_color: { value: fog_color },
        u_fog_density: { value: fog_density },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  set_fog_density(density: number): void {
    this.material.uniforms.u_fog_density.value = density;
  }

  update(time: number, camera: THREE.Camera, follow_x: number, follow_z: number): void {
    this.material.uniforms.u_time.value = time;
    this.material.uniforms.u_camera_pos.value.copy(camera.getWorldPosition(new THREE.Vector3()));
    this.mesh.position.set(follow_x, 0, follow_z);
  }
}
