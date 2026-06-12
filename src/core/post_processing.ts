// file: src/core/post_processing.ts
// description: Post-processing pipeline - bloom + animated vignette via EffectComposer, with a persisted quality toggle that falls back to direct rendering
// reference: src/main.ts, src/gameplay/juice.ts

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const QUALITY_KEY = 'tir.quality.v1';

const VIGNETTE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    u_strength: { value: 0.55 },
    u_pulse: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 v_uv;
    void main() {
      v_uv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float u_strength;
    uniform float u_pulse;
    varying vec2 v_uv;
    void main() {
      vec4 color = texture2D(tDiffuse, v_uv);
      vec2 centered = v_uv - 0.5;
      float dist = length(centered);
      float vignette = smoothstep(0.85, 0.32, dist * (u_strength + u_pulse * 0.5));
      vignette = mix(1.0, vignette, 0.55 + u_pulse * 0.3);
      gl_FragColor = vec4(color.rgb * vignette, color.a);
    }
  `,
};

export class PostProcessing {
  enabled: boolean;

  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly vignette: ShaderPass;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,
      0.7,
      0.85,
    );
    this.composer.addPass(this.bloom);

    this.vignette = new ShaderPass(VIGNETTE_SHADER);
    this.composer.addPass(this.vignette);
    this.composer.addPass(new OutputPass());

    this.enabled = this.load_quality();
  }

  private load_quality(): boolean {
    try {
      return localStorage.getItem(QUALITY_KEY) !== 'low';
    } catch {
      return true;
    }
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(QUALITY_KEY, this.enabled ? 'high' : 'low');
    } catch {
      // No persistence available.
    }
    return this.enabled;
  }

  set_quality(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Pulse 0..1 used by slow-mo juice to deepen the vignette and bloom. */
  set_pulse(pulse: number): void {
    (this.vignette.uniforms as typeof VIGNETTE_SHADER.uniforms).u_pulse.value = pulse;
    this.bloom.strength = 0.35 + pulse * 0.5;
  }

  set_size(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  render(): void {
    if (this.enabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
