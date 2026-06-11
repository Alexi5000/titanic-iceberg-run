// file: src/main.ts
// description: Application entry point - creates the renderer, scene bootstrap, and the requestAnimationFrame game loop
// reference: index.html, GAME_PLAN.md

import * as THREE from 'three';

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050d);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 5000);
camera.position.set(0, 30, 80);
camera.lookAt(0, 0, 0);

const placeholder = new THREE.Mesh(
  new THREE.BoxGeometry(10, 10, 10),
  new THREE.MeshStandardMaterial({ color: 0x88aaff }),
);
scene.add(placeholder);
scene.add(new THREE.AmbientLight(0x445566, 1.2));

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function frame(): void {
  const delta = clock.getDelta();
  placeholder.rotation.y += delta * 0.5;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
