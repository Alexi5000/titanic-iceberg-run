# Titanic Cinematic Upgrade

**Implementation status:** first production-oriented WebGL2 pass complete as of 2026-07-09.  
**Scope:** preserve the original iceberg-avoidance game while replacing its visual foundation incrementally.  
**Not legal advice:** use the accompanying asset register and the licence attached to every downloaded file.

## 1. Research report and reference decision

### Confirmed facts

| Reference | Creator / technology | Link | Licence and safe use |
| --- | --- | --- | --- |
| Water Pro V3 | Dan Greenheck; TSL/WebGPU, FFT cascades, Gerstner swell, clipmaps, wakes | [product](https://threejsroadmap.com/assets/threejs-water-pro) | Commercial/proprietary benchmark. Do not copy source or bundled assets without a purchased, reviewed licence. |
| Threejs-WebGPU-IFFT-Ocean | Spiri0 / Attila Schroeder; Three.js WebGPU, JONSWAP IFFT | [source](https://github.com/Spiri0/Threejs-WebGPU-IFFT-Ocean) | MIT code reference for a future optional spectral tier; audit non-code resources separately. |
| OceanDemo | Popov72; Babylon.js WebGPU FFT ocean | [source](https://github.com/Popov72/OceanDemo) | MIT code reference. Useful for Jacobian foam and clipmap concepts, not a drop-in Three.js dependency. |
| Three.js Water / Water2 / WebGPU ocean examples | Three.js contributors | [Water](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water.js), [Water2](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2.js), [WebGPU ocean](https://threejs.org/examples/#webgpu_ocean) | MIT. Reuse substantial source only with the notice; external textures have separate provenance. |
| Gerstner Water Shader | Sean Bradley | [source](https://github.com/Sean-Bradley/three.js/blob/gerstner-waves/examples/webgl_shaders_ocean_gerstner.html) | MIT reference for Gerstner/reflector concepts. |
| ThreeJS Water | Yong Su / jeantimex | [source](https://github.com/jeantimex/threejs-water) | MIT reference for localized interaction, buoyancy, reflection and refraction ideas. |
| fft-ocean | Jeremy Bouny | [source](https://github.com/jbouny/fft-ocean) | MIT code, but legacy renderer and included assets require individual review. |

The full current licence register, source links, asset candidates, and reuse gates are in [ASSET_AND_LICENSES.md](ASSET_AND_LICENSES.md). Unretrievable Water Pro and Shadertoy licence pages are intentionally not treated as reuse permission.

### Technical interpretation

Water Pro V3 is the strongest *visual* reference: it combines a modern spectral base, cascaded detail, wake/foam, sky integration, and tiered cost controls. It is not the codebase to clone because it is commercial. Spiri0's MIT WebGPU IFFT project is the strongest reusable technical reference for a later spectral implementation, but WebGPU is not the compatibility baseline for this game.

### Recommendation implemented here

Ship an original, WebGL2-first hybrid ocean:

1. Multi-octave Gerstner displacement for readable long swell and a matching CPU sampler for gameplay.
2. Procedural small-scale normal detail in the material rather than a runtime dependency on unlicensed normal textures.
3. Quality-gated planar reflection, Fresnel, depth-color absorption proxy, sun/moon glitter, crest foam, iceberg foam rings, and a ship wake field.
4. Pooled particle wake/spray and camera-relative precipitation.
5. Optional future WebGPU IFFT/FFT behind an Ultra capability gate, not required to play.

This avoids proprietary source while reproducing the underlying rendering principles from first principles.

## 2. Architecture recommendation

### Runtime choice

- **Keep vanilla Three.js + TypeScript for this game.** The existing game is imperative, compact, and already has a healthy update loop; moving it to React Three Fiber would add migration risk without improving ocean quality.
- **Use WebGL2 as the shipping baseline.** Three r182 is WebGL2-only, so it already targets modern browsers. The code has Low through Ultra quality tiers and falls back to direct rendering for Low.
- **Treat WebGPU as an additive future path.** A WebGPU IFFT ocean can replace the Gerstner surface only after a capability-gated prototype matches the existing CPU buoyancy/collision contract. Do not make the game depend on it today.

### Current rendering graph

```text
Simulation
  ShipPhysics / Collision / Difficulty
       |                         |
       +--> WaveSpectrum CPU ----+--> hull pitch/roll, berg/flotsam/wake height

Scene
  Sky + precipitation + PBR ship + iceberg LOD/instances + OceanSurface
       |
       +--> scheduled planar ReflectionPass (Medium+)
       |
       +--> PostProcessing (Medium+): bloom -> grade -> vignette -> OutputPass
       |
       +--> direct renderer (Low)

Telemetry
  QualityManager -> adaptive DPR / quality budgets
  PerformanceOverlay -> FPS, frame time, draws, triangles, estimated texture memory,
                        reflection and ocean GPU timing where EXT_disjoint_timer_query_webgl2 exists
```

### Ocean approach comparison

| Approach | Visual ceiling | Complexity | Compatibility | Recommended role |
| --- | --- | --- | --- | --- |
| Three.js Water / Water2 | Moderate; good flat planar reflection/flow | Low | WebGL2 | Useful reference/helper, not enough wave/interaction fidelity alone. |
| Pure Gerstner shader | High for gameplay-scale ocean | Medium | WebGL2 | Core shipping displacement and deterministic CPU mirror. |
| FFT / spectral ocean | Very high large-scale realism | High | WebGL2 or WebGPU depending implementation | Future optional Ultra path after profile/QA work. |
| Vertex displacement plus animated normal detail | High perceived detail per cost | Medium | WebGL2 | Combined with Gerstner in the shipping hybrid. |
| WebGPU compute ocean | Highest flexible simulation ceiling | High | WebGPU only | Research/Ultra option; never the only playable path. |

### Weather, light, and post

- Palette presets now include Day, Dusk, Night, Aurora, and Storm.
- The camera-relative sky supplies procedural cloud banks, horizon haze, stars, moon/halo, restrained deterministic lightning, and directional/ambient/hemisphere lighting.
- Voyage distance gradually increases a *partial* visual storm (cloud, mist, reflection breakup) while the explicit Storm palette remains the full wave/rain/lightning preset.
- ACES tone mapping, bloom, color grading, film grain, and vignette use uniform/profile updates instead of shader recompilation. Motion blur and gameplay DOF are deliberately omitted; they hurt readability at the target frame budget.

## 3. Delivered implementation

### Ocean prototype

| File | Responsibility |
| --- | --- |
| `src/ocean/wave_spectrum.ts` | Allocation-free CPU Gerstner sampler, North Atlantic spectrum, weather and quality presets, shader upload buffers. |
| `src/ocean/water_material.ts` | Original GLSL Gerstner surface, micro normal detail, Fresnel/absorption/glitter, crest/ship/iceberg foam, planar-reflection bindings. |
| `src/ocean/reflection_pass.ts` | Mirrored-camera, cadence-controlled offscreen planar reflection target. |
| `src/ocean/ocean_surface.ts` | Camera-centered grid, shared active CPU spectrum, quality/weather/tuning API, reflection scheduling, timer hooks. |
| `src/ocean/ocean_debug_gui.ts` | Query-gated authoring controls under `?debug=ocean` or `?debug=all`. |
| `src/world/ocean.ts` | Compatibility facade so existing gameplay code keeps calling `wave_height()`. |

Important shader behavior:

- Vertex displacement accumulates horizontal and vertical Gerstner terms and analytic tangents; the cross product produces the macro normal.
- The CPU sampler uses the same packed `u_wave_a` / `u_wave_b` layout, keeping ship pitch/roll, iceberg waterline, and particles visually coherent.
- Crest foam is driven by the high side of each trochoid. Nearby berg radii and the live ship state write local foam/wake fields without a per-frame texture allocation.
- “Depth absorption” is a view/slope optical-depth proxy, not true screen-depth refraction. True opaque-scene refraction remains a future enhancement because it needs a robust color/depth prepass and has readability cost.

### Titanic integration

`src/ship/titanic_model.ts` is now an original procedural PBR hero fallback: shaped hull, decks, four funnels, lifeboats/davits, portholes and promenade windows, railings/rigging, deck lights, smoke, rudder, and three propellers. It preserves the 269 m by 28 m gameplay contract, +Z bow direction, skin/searchlight APIs, and wave-driven pitch/roll.

It also has quality/distance visual LOD bands: core silhouette always stays active, medium detail retains lifeboats/railings/rigging/lamps, and high detail restores instanced windows/portholes. Collision and physics do not change with visual LOD.

This is **not yet a cleared artist-authored GLB**. The final GLB/KTX2/Meshopt delivery gate and a legally safe modelling brief are in [ASSET_GENERATION_BRIEFS.md](ASSET_GENERATION_BRIEFS.md).

### Iceberg system

`src/world/iceberg_field.ts` now provides small, medium, large, hero, and field variants with complete underwater mass, wet waterline/blue absorption/snow vertex masks, PBR ice, collision radius, and three visible LODs. A 72-instance far field improves scale without creating collision entities or new draw calls. The hero pool entry remains the readable collision set piece.

### Atmosphere, particles, and gameplay

- `src/world/sky.ts`: camera-relative sky, clouds, haze, stars, moonlight, lightning, palette lighting.
- `src/environment/precipitation.ts`: pooled, camera-anchored rain and ocean mist with tier-scaled counts.
- `src/ship/wake_effects.ts`: typed-array, dynamic-buffer V wake, bow spray, collision shards, and quality-scaled budgets.
- Existing heavy steering, throttle, near misses, hull damage, sinking sequence, camera shake, sound, and dynamic music were retained. The visual work does not replace the working gameplay loop.

### Quality and diagnostics

`src/rendering/quality_manager.ts` selects a conservative device tier, persists manual choices, and adaptively lowers/raises DPR with hysteresis. `src/rendering/performance_overlay.ts` is enabled with `?debug=perf` or `?debug=all`; F2 cycles quality and F3 toggles the overlay.

## 4. Performance budget and fallback policy

| Tier | DPR cap | Waves | Ocean grid | Reflection | Post | Particle budget |
| --- | ---: | ---: | ---: | --- | --- | ---: |
| Low | 1.0 | 3 | 96 | Off | Direct | 96 |
| Medium | 1.25 | 4 | 144 | 0.5x every 4 frames | On, 0.8x internal | 300 |
| High | 1.5 | 6 | 192 | 0.5x every 2 frames | On, full internal | 700 |
| Ultra | 1.5 | 8 | 256 | 0.75x every frame | On, full internal | 1400 |

Target policy:

- 60 FPS at 1440p on a modern mid/high desktop GPU with High selected.
- 30-60 FPS on integrated GPUs through automatic Medium/Low selection and adaptive DPR.
- Initial JavaScript bundle from the current build is about 195 KB gzip; the agreed 25 MB compressed first-load budget is reserved for future cleared GLB/KTX2/audio assets.
- Use Meshopt before Draco for final GLB where decode profiling supports it, KTX2/BasisU for artist textures, stable material variants, instancing, LOD, frustum culling, and no per-frame container allocation.

Known performance limitation: `preserveDrawingBuffer` is still enabled for collectible card frame captures. It should be replaced with an on-demand capture render target before a final 1440p performance sign-off.

## 5. Roadmap and art gate

1. **Complete (this change):** WebGL2 hybrid ocean, PBR procedural ship fallback, PBR/LOD/instanced icebergs, sky/weather, post, quality management, instrumentation, browser smoke validation.
2. **Art production gate:** commission/create original Titanic and iceberg GLBs under the documented rights chain; validate pivot, LOD, collision, Meshopt/KTX2 payload, nights lights, and attribution before integration.
3. **Interaction polish:** optional persistent low-resolution wake/foam render target, opaque depth/color prepass for true refraction, ice-contact splash masks, and audio-source mixing.
4. **Optional Ultra research:** WebGPU spectral/IFFT prototype behind runtime capability detection; match existing CPU wave samples or provide a bounded gameplay proxy before adoption.
5. **Release gate:** GPU/CPU profiling on target desktop and integrated devices, WebGL context-loss test, Chrome/Firefox/Safari visual QA, accessibility/reduced-motion audit, and asset provenance review.

## 6. Folder structure

```text
src/
  ocean/                 reusable ocean renderer, spectrum, reflection, debug controls
  environment/           rain and mist
  rendering/             quality policy and performance overlay
  ship/                  procedural PBR ship, physics, collision, wake, sinking
  world/                 facade ocean, sky, palettes, iceberg LOD/instances, flotsam
  core/                  renderer-adjacent game systems and post processing
  gameplay/, camera/, ui/
docs/
  ASSET_AND_LICENSES.md
  ASSET_GENERATION_BRIEFS.md
  CINEMATIC_UPGRADE.md
public/
  favicon.svg
```

## 7. Testing checklist

Run `bun run build` first. Then test a production-like serve, not only Vite HMR. With a dev or preview server running, `bun run qa:cinematic` performs the short Chromium smoke for the performance overlay and High/Storm ocean control path.

- [ ] Title and desktop run at Low, Medium, High, and Ultra; F2 and F3 do not create console errors.
- [ ] `?debug=ocean` changes quality/weather/wave/foam/reflection/refraction controls and the reset path without starting a game from a panel click.
- [ ] `?debug=perf` reports sane frame, draw, triangle, texture-estimate, and timer values; timer fields may be unavailable when the browser lacks `EXT_disjoint_timer_query_webgl2`.
- [ ] Start, throttle, turn, near miss, graze, fatal collision, sinking, restart, daily run, cards, skins, keyboard and touch controls all retain their prior behavior.
- [ ] Inspect Day, Dusk, Night, Aurora, and Storm at bridge/chase/cinematic cameras; ensure storm effects remain readable.
- [ ] Verify no shader compile messages in Chrome, Firefox, and Safari/WebKit; check WebGL2 context-loss/recovery.
- [ ] Profile 1440p High and target integrated hardware. Record median/1% frame times, draw calls, triangles, render-target memory, and reflection cost.
- [ ] Before final GLB integration, validate asset rights, glTF validator output, texture compression, missing-asset fallback, LOD pop, and collision envelope.

## 8. Deployment instructions

### GitHub Pages

```powershell
bun install --frozen-lockfile
bun run build
```

The existing workflow deploys `dist/` on a push to `main` and now pins Bun 1.3.3 to match `package.json`. Vite uses a relative base, so the result is suitable for a Pages project subpath.

### Vercel

```powershell
vercel pull
vercel build
vercel deploy --prebuilt
```

`vercel.json` sets immutable caching for hashed `/assets/*`. Keep deploy secrets in Vercel environment variables if any future service is added; do not use `NEXT_PUBLIC_*` for secrets. This is currently a static Vite game, so no Vercel Function, durable state, or background process is required.

### Before publishing art

Do not deploy a marketplace or commissioned GLB until the provenance record, licence/receipt, public attribution, compression report, and browser test evidence are complete. The procedural fallback and original generated geometry may ship independently.

## 9. Known limitations

- No cleared final GLB/KTX2 asset is bundled yet; procedural PBR assets are the legal fallback.
- Planar reflection is an amortized mirrored scene capture, not SSR. It may miss or simplify some below-water geometry and does not use an oblique clip plane yet.
- Water “refraction” is currently a controlled absorption/horizon approximation, not a sampled opaque-scene transmission buffer.
- No WebGPU FFT is enabled in the shipping baseline.
- GPU timings are optional extension data; do not equate unavailable timings with zero cost.
- Automated browser QA is Chromium-first; Safari/WebKit and physical-device performance still require release testing.
