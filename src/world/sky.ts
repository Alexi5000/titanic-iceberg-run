// file: src/world/sky.ts
// description: Night sky dome with procedural star field, moon disc, and ambient/moon lighting rig
// reference: src/main.ts, src/world/ocean.ts

import * as THREE from 'three';

export interface SkyRig {
  group: THREE.Group;
  moon_dir: THREE.Vector3;
  moon_light: THREE.DirectionalLight;
}

function create_stars(): THREE.Points {
  const star_count = 1600;
  const positions = new Float32Array(star_count * 3);
  const sizes = new Float32Array(star_count);

  for (let i = 0; i < star_count; i++) {
    // Random point on the upper hemisphere of a large dome.
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.95);
    const radius = 3400;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi) + 40;
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    sizes[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xcfe0f5,
    size: 2.4,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.85,
    fog: false,
    depthWrite: false,
  });

  return new THREE.Points(geometry, material);
}

export function create_sky(): SkyRig {
  const group = new THREE.Group();
  const moon_dir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();

  group.add(create_stars());

  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(72, 40),
    new THREE.MeshBasicMaterial({ color: 0xe8f0fa, fog: false }),
  );
  moon.position.copy(moon_dir).multiplyScalar(3200);
  moon.lookAt(0, 0, 0);
  group.add(moon);

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(160, 40),
    new THREE.MeshBasicMaterial({ color: 0x96b4d2, transparent: true, opacity: 0.16, fog: false, depthWrite: false }),
  );
  halo.position.copy(moon_dir).multiplyScalar(3180);
  halo.lookAt(0, 0, 0);
  group.add(halo);

  const moon_light = new THREE.DirectionalLight(0x9db8d6, 1.35);
  moon_light.position.copy(moon_dir).multiplyScalar(500);
  group.add(moon_light);

  const ambient = new THREE.AmbientLight(0x2a3a52, 0.85);
  group.add(ambient);

  const hemi = new THREE.HemisphereLight(0x1c2c44, 0x050a12, 0.6);
  group.add(hemi);

  return { group, moon_dir, moon_light };
}
