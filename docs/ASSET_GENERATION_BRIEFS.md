# Titanic Cinematic Upgrade — Asset Generation Briefs

**Checked:** 2026-07-09  
**Purpose:** an artist-ready, licence-safe brief for the final Titanic and modular iceberg kit. This document specifies production targets; it is not evidence that a final GLB has already been created or cleared.

## Non-negotiable legal and delivery gate

**Confirmed facts**

- The current runtime retains a procedural Titanic fallback and procedural icebergs.
- The [Library of Congress White Star Line brochure](https://www.loc.gov/item/2021666878/) is a suitable historical reference source: its rights page says the Library is unaware of restrictions and says the material is free to use and reuse, subject to source review.
- The candidate marketplace/cinematic models listed in [ASSET_AND_LICENSES.md](ASSET_AND_LICENSES.md) are not a cleared final browser asset.

**Recommendation**

Commission or build the final Titanic independently. The artist must deliver source files, a written IP assignment or explicit browser-distribution licence, a declaration of every reference/texture/tool used, and a source/export checksum. Do not trace, bake, retopologize, texture-project, or use geometry from commercial games, Titanic: Honor & Glory, unlicensed marketplace products, or a source with uncertain AI-training provenance.

AI may help with mood boards or generic noise/roughness exploration only when its terms permit the intended use. It is not an authoritative source for engineering dimensions, topology, UVs, or historical details, and no third-party reference image or mesh may be uploaded to it without an appropriate licence.

## Final Titanic brief

### Target and coordinate contract

| Item | Production target |
| --- | --- |
| Overall silhouette | Recognizable 1912 Olympic-class liner: long black/red hull, white superstructure, four buff funnels with black caps, masts, lifeboats, and stern machinery silhouette. |
| Scale | Metric. Recommended target is 269.1 m overall length × 28.2 m beam; verify the final plan against licensed/public-domain reference before sign-off. |
| Origin | Amidships at the waterline: (0, 0, 0). This keeps buoyancy and wake probes numerically stable. |
| Axes | +Y up; +Z forward/bow; +X starboard. Apply transforms before export. |
| Waterline | A named Waterline marker at Y=0. Hull geometry must include visually plausible underwater volume, but a simplified hull collider is delivered separately. |
| Required views | Orthographic port, starboard, bow, stern, plan/top, and one waterline/underwater silhouette sheet. Include a metric grid and the root origin in each review render. |
| Required nodes | Root, Hull, Superstructure, Funnels, Decks, Lifeboats, Rigging, Windows_Emissive, Rudder, Propellers, Collision, and separate LOD groups. |

### What to model

Build the exterior that drives readability from the game cameras, not an inaccessible cinematic interior:

- fine sheer and bow profile; stern contour; red antifouling and black upper hull separated at the waterline;
- four distinct funnels, two masts, ventilators, deckhouses, cranes/davits, lifeboats, bridge/superstructure, railings, portholes, and visible stern propeller/rudder region;
- asymmetric/varied small details only where they read at normal chase-camera distance;
- separate, name-stable propellers and rudder for movement/lighting; and
- a separate low-poly closed collision hull that never contains high-detail rails, lifeboats, or propellers.

Avoid a museum-diorama interior, full modeled rivet coverage, dense rigging cylinders, and per-window geometry. These produce poor browser cost-to-pixel value.

### Visual and material specification

| Material family | PBR treatment | Required details |
| --- | --- | --- |
| Hull paint | Metalness 0; medium roughness with subtle per-panel variation. | Near-black above water, muted antifouling red below water, slightly wetter/darker band at the waterline, restrained salt streaks and cold-weather grime. |
| White superstructure | Off-white painted steel, roughness 0.45–0.65. | Edge dirt and slight tonal breakup; no pure-white clipping under bloom. |
| Funnels | Buff/yellow painted steel with black caps. | Vertical heat/soot staining, seam-line normal detail, not a procedural copy of any commercial texture. |
| Decks and woodwork | Teak-toned non-metallic material. | Directional grain, reduced specular at night, small repeated tiling scale hidden with macro variation. |
| Metal and rails | Galvanized/painted steel, not chrome. | Shared trim sheets and instanced railing modules; leave high-frequency filigree to normal/alpha detail where it will not silhouette. |
| Glass / windows | Opaque-to-dark glass plus emissive card/texture. | Use an emissive window atlas with a few deterministic warm-intensity variants. Do not make every pane a transparent draw call. |
| Weathering | Mask-driven, restrained. | Salt run-off, wetness around the waterline, soot near funnel tops, and no rust that contradicts a recently commissioned liner. |

### Triangle, material, texture, and draw-call targets

| Deliverable | Triangle target | Materials / texture budget | Use |
| --- | ---: | --- | --- |
| LOD0 hero | 180k–250k | Maximum 8 shared material families; 2K PBR sets, with up to two 4K hero atlases only if download analysis passes. | Close cinematic cards and near gameplay. |
| LOD1 | 60k–90k | Same atlas layout where possible; delete small silhouette-insignificant hardware. | Default gameplay distance. |
| LOD2 | 15k–25k | Bake/merge detail, remove railings/rigging into textures or alpha cards. | Far camera / reduced quality. |
| Collision hull | 1k–3k | No texture requirement. Convex or small compound primitives only. | Collision and coarse buoyancy support. |
| Optional shadow proxy | 2k–5k | Opaque single material. | Low quality or distant shadow path. |

Texture sets should use the glTF metallic-roughness workflow. Pack ambient occlusion, roughness, and metalness where practical; retain a normal map and a small emissive atlas. Export 2K as the default maximum and KTX2/BasisU-compress production textures. A full 4K set is a review source, not automatically a web build input.

### Blender procedure

1. Create an in-house blockout from reviewed orthographic references at real metric scale. Lock the root transform and waterline marker.
2. Establish LOD1 first. It must carry the complete readable silhouette and game-facing details.
3. Derive LOD0 only where the camera benefits: bow, bridge, funnels, lifeboats, stern machinery, and close rail sections. Keep instanced repeated modules linked until export preparation.
4. Derive LOD2 by controlled reduction, then manually restore the bow, four funnels, deck outline, and mast silhouette. Do not rely solely on automatic decimation.
5. Create a closed underwater hull and a separate simplified collision proxy. Check it in a waterline cutaway render.
6. UV unwrap with non-overlapping islands for unique hero surfaces; use trim/tiling sheets for repeating railings, vents, and deck hardware. Maintain texel density within each material family.
7. Bake original normal, AO, curvature, and weather masks from only rights-cleared source geometry. Author PBR textures from original or CC0 inputs.
8. Validate each LOD in Three.js before final texture polish: scale, root, forward axis, node names, draw-call count, and night emissives.

### glTF/GLB export contract

~~~text
Format: glTF 2.0 binary GLB
Units: meters
Root: Titanic_Root at (0, 0, 0), transform applied
Axes: Y up, +Z bow/forward, +X starboard
Required extras: asset version, source checksum, license id, LOD id
Compression: EXT_meshopt_compression preferred; Draco only if loader and decode timing justify it
Textures: KTX2/BasisU, power-of-two dimensions, mipmaps, SRGB only for color/emissive
Meshes: indexed triangles, generated tangents where normal maps require them
Materials: glTF metallic-roughness; no Blender-only node dependencies
Lights/cameras: do not export runtime lights or cameras
~~~

Run a GLB validator and record the result. Test missing-texture, low-quality, and WebGL2 paths. The procedural fallback must remain selectable if the GLB cannot load.

### AI-assisted concept prompt

Use this only for an original concept sheet, never for direct mesh extraction:

> Original exterior concept for a 1912 North Atlantic passenger liner at night, historically plausible four-funnel silhouette and proportions, black and muted red hull, buff funnels with dark caps, lifeboats and deckhouses, cinematic moonlit fog, orthographic port/starboard/bow/stern/top sheets, clean neutral background, no logos, no named commercial game, no reference to existing 3D models, no copyrighted game asset styling.

The final model must still be built from vetted dimensions and the in-house topology/material process above.

### Titanic acceptance checklist

- [ ] Written rights chain and provenance register approved.
- [ ] Scale, origin, +Z forward, and waterline are verified in a test scene.
- [ ] LOD0/1/2 and collision mesh meet budget and remain visually coherent.
- [ ] Four funnels, lifeboats, windows, propellers, rudder, and night emissives are present.
- [ ] Materials work under day, sunset, moonlit night, and storm palettes.
- [ ] Textures are KTX2/BasisU, source files retained, and no proprietary material maps are embedded.
- [ ] GLB loads through the project's asset manager with the procedural fallback intact.

## Modular iceberg kit brief

### Shared rules

**Confirmed fact:** the Svalbard reference author reports that glacier ice commonly protrudes roughly 10% of its mass/volume above water, but that does not provide a collision model for every procedural iceberg.

**Recommendation:** start with a visually credible submerged keel whose volume is roughly 8–10× the visible above-water volume, then tune it for collision readability and wave interaction. It is a visual/gameplay approximation, not a buoyancy simulation claim.

Every ice asset needs:

- independent above-water and underwater mass, with a continuous waterline seam;
- original fracture planes, shelves, calving notches, and asymmetric silhouette;
- a snow mask driven by slope, height, and sheltered cavities, not a uniform white paint layer;
- wetness/darkening at the waterline and lower faces;
- blue internal absorption/thickness approximation, controlled by vertex colors or a mask;
- a separate simple collider, conservative in XZ for fair gameplay; and
- matching LODs with a stable material layout so far-field pieces can be instanced.

### Ice material direction

| Layer | Treatment | Runtime note |
| --- | --- | --- |
| Structural ice | Pale blue-grey base color, moderate roughness, blue thickness/absorption mask, strong normal breakup. | Use a MeshPhysical or custom water/ice material approximation; do not rely on expensive true subsurface scattering. |
| Wet ice | Darker, smoother band at and just below waterline. | Vertex color/mask, shared material, no extra mesh where avoidable. |
| Snow | Cool off-white, rough, slope/height/cavity masked. | CC0 snow texture detail may be used after compression; avoid a separate material if a mask can do it. |
| Interior blue | Concentrated in crevices, thin edges, and submerged depth. | Prefer vertex color / packed mask rather than transparent layered geometry. |
| Micro detail | Cracks, wind-sculpted grain, small chips. | Baked normal/roughness variation; not individual geometry. |

### Variant matrix

| Variant | Approximate waterline footprint / height | LOD0 / LOD1 / LOD2 triangles | Collision target | Gameplay role |
| --- | --- | ---: | ---: | --- |
| Small iceberg | 8–18 m / 2–8 m visible | 4k–10k / 1.5k–3k / 300–800 | 200–400 tris | Frequent obstacle and instanced far-field candidate. |
| Medium iceberg | 20–45 m / 6–18 m visible | 12k–25k / 4k–7k / 1k–2k | 400–800 tris | Primary readable obstacle. |
| Large iceberg | 50–100 m / 12–30 m visible | 30k–50k / 10k–16k / 2k–4k | 800–1.5k tris | Rare landmark and navigation hazard. |
| Hero collision iceberg | 100–150 m / 20–45 m visible | 60k–100k / 20k–35k / 5k–8k | 1.5k–3k tris | Curated near-miss/collision set piece. |
| Ice-field cluster | 6–20 small/medium forms | Per-piece far LOD 300–1k, instanced | Per-piece simple proxy | Density escalation; no hidden uncollidable hero silhouette. |

### Blender procedure for each base form

1. Start from an original low-resolution convex volume with 12–24 radial/silhouette control points, stretched on a few principal axes.
2. Establish the waterline and duplicate/extrude a deeper, broader, irregular underwater keel. Keep the visible and submerged masses continuous but not mirror-symmetric.
3. Add large calving planes, shelves, overhangs, and one or two protected blue crevices. Use sculpt/remesh only as a temporary high-resolution source.
4. Retopologize or controlled-decimate to the LOD0 target; preserve large planes and the skyline. Bake high-resolution fracture/noise into normal, AO, curvature, thickness, and snow/wet masks.
5. Make LOD1 and LOD2 deliberately: remove small chips first, then internal recesses, then narrow shelves. Retain a stable collision silhouette.
6. Build the collision proxy separately from a simplified waterline footprint and underwater keel. Test a conservative envelope against the visible mesh.
7. Author three to five shape seeds per class. Apply only scale, rotation, color-mask, and snow-coverage variation at runtime; do not create dozens of nearly duplicate exported meshes.

### Variant-specific direction and prompts

| Asset | Shape direction | Safe concept / artist prompt |
| --- | --- | --- |
| Small | Low, broken bergy bit; one dominant sloped plane and a narrow blue fracture; largely underwater. | Original Arctic bergy bit, asymmetrical low profile, natural calving planes and wet blue waterline, physically plausible submerged keel, no stock-model silhouette, neutral orthographic reference sheet. |
| Medium | Uneven wedge or tabular fragment with a readable cliff face and snow pockets. | Original medium North Atlantic iceberg, fractured tabular wedge, one steep face, blue internal crevice, wind-packed snow only on upward shelves, full underwater mass and collision proxy, orthographic views. |
| Large | Broad tabular/eroded mass with multiple shelves and deep waterline recesses; keep the most threatening face readable from the ship path. | Original large iceberg with asymmetric shelves and eroded vertical walls, pale blue ice, subtle snow caps, broad submerged keel, no ship or copyrighted reference asset, orthographic port/starboard/top/waterline views. |
| Hero | Strong narrative silhouette, one navigable side and one collision face; controlled blue glow/absorption, not neon. | Original hero North Atlantic iceberg for a cinematic near miss, towering asymmetric calving face, deep blue crevices, wet waterline, restrained snow, complete submerged keel and simplified collision shape, neutral studio/orthographic presentation. |
| Ice field | A family, not duplicated hero assets; include low chunks, ridges, and sparse tall accents. | Original modular Arctic ice field collection: varied small and medium iceberg fragments, consistent material family, distinct silhouettes, far-LOD friendly topology, no repeated stock assets, top and waterline layout sheet. |

### Iceberg GLB export contract

~~~text
Format: glTF 2.0 binary GLB, metric, transforms applied
Root naming: Iceberg_[class]_[seed]
Children: Visible_LOD0, Visible_LOD1, Visible_LOD2, Collision
Masks: packed snow / wetness / thickness in a documented texture or vertex-color contract
Compression: EXT_meshopt_compression preferred; KTX2/BasisU texture payloads
Instancing: matching far LOD geometry and material layouts across compatible small/medium seeds
Collision: separate, no material, no dense concavities, origin at waterline center
~~~

### Iceberg acceptance checklist

- [ ] Original geometry and auditable material provenance.
- [ ] Above-water and underwater masses read as one continuous iceberg.
- [ ] Snow, wetness, absorption, and normal detail remain believable at day/night/storm exposure.
- [ ] Collider is conservative, stable, and never depends on visual LOD.
- [ ] LOD switch does not pop in the primary gameplay camera.
- [ ] Far ice field instances share materials/geometry and respect the draw-call budget.
- [ ] GLB/texture compression, missing-asset fallback, and WebGL2 rendering are validated.

## Handoff package required from art

1. Blender source file(s), applied-transform GLB exports, and a release manifest.
2. Orthographic review sheet and waterline/collision overlay.
3. Texture source files plus KTX2 build outputs and map-packing document.
4. Per-LOD triangle/material/draw-call report.
5. Licence/provenance report with public attribution text where required.
6. Screen captures in Day, Sunset, Moonlit Night, and Storm presets.

No asset enters the game simply because it looks good in a DCC viewer. It must pass the legal gate, the visual gate, and the browser-performance gate.
