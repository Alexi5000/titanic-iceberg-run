# Titanic Cinematic Upgrade — Asset and License Register

**Checked:** 2026-07-09  
**Scope:** water-rendering references, candidate ship/ice assets, and the rules for adding files to this repository. This is a production record, not legal advice. The licence bundled with a downloaded file and the vendor terms in force at purchase are controlling.

## Reading this register

- **Confirmed** means the linked first-party page or repository exposed the stated information on the check date.
- **Technical interpretation** is an engineering reading of a reference, not a claim about its internals beyond what its author publishes.
- **Recommendation** is the project decision. It does not grant a licence.
- **Asset gate** means a file must not enter the public asset directory until its source URL, creator, licence snapshot, attribution text, checksum, and any receipt/permission are recorded.

The game may recreate publicly known rendering principles from first principles. It must not copy proprietary shaders, marketplace meshes, copied CodePen snippets, game assets, textures, or compiled source without the relevant permission.

## Water references

| Reference and creator | Direct links | Confirmed technology / visual value | Licence and reuse assessment | Project decision |
| --- | --- | --- | --- | --- |
| Three.js Water Pro V3 — Dan Greenheck | [product](https://threejsroadmap.com/assets/threejs-water-pro) · [demo](https://www.threejswaterpro.com/) · [terms](https://docs.threejswaterpro.com/license.html) | Vendor material describes a Three.js TSL/WebGPU ocean with FFT cascades, Gerstner swells, clipmap LOD, reflections, refraction, foam, wakes, spray, rain, and caustics. | **Confirmed operational status:** commercial product. The terms endpoint returned 403 to this automated check, so its exact wording must be captured manually before purchase. Treat all source, shaders, and bundled assets as proprietary unless a purchased licence expressly says otherwise. | **Visual benchmark only** unless the project purchases and records a suitable licence. Recreate principles; do not copy code or assets. |
| Tidewater v1.1 — Dwayne Charrington | [product / demo / docs](https://gettidewater.com/) | The vendor documents WebGPU with WebGL2 fallback, three FFT bands plus Gerstner swell, a CPU mirror, persistent 512² wake canvas, Fresnel, Beer–Lambert absorption, foam, rain, and quality tiers. | **Confirmed:** vendor says use in commercial games/sites is allowed per developer but source redistribution is prohibited; see the [licence route](https://gettidewater.com/#faq) before purchase. | Useful architectural benchmark. Do not copy or commit source/bundled assets without a purchased licence and a source-distribution review. |
| Threejs-WebGPU-IFFT-Ocean — Attila Schroeder / Spiri0 | [source](https://github.com/Spiri0/Threejs-WebGPU-IFFT-Ocean) · [demo](https://spiri0.github.io/Threejs-WebGPU-IFFT-Ocean/index.html) · [MIT licence](https://github.com/Spiri0/Threejs-WebGPU-IFFT-Ocean/blob/main/LICENSE) | Three.js WebGPURenderer / TSL JONSWAP IFFT ocean. The README reports moving to storage buffers and three 512² cascades, with a significant performance improvement. | **Confirmed:** repository declares MIT. Code may be reused with the required copyright/licence notice. The resources folder is not automatically covered by a code licence; audit each asset separately. | Strongest reusable spectral reference for an optional WebGPU Ultra tier. The shipping WebGL2 path is independently implemented. |
| OceanDemo — Popov72, port of Ivan Pensionerov's FFT-Ocean | [source](https://github.com/Popov72/OceanDemo) · [demo](https://popov72.github.io/OceanDemo/dist/index.html) · [MIT licence](https://github.com/Popov72/OceanDemo/blob/main/LICENSE.md) | Babylon.js WebGPU port. Its README confirms WebGPU support is required. It is a useful reference for cascaded spectral displacement, derivative/Jacobian foam, contact foam, and clipmap organization. | **Confirmed:** repository declares MIT. Third-party and demo assets still need their own provenance review. | Use as a research reference or port concepts under MIT attribution; do not assume its Babylon assets are cleared for this Three.js game. |
| Official Three.js Water / Water2 / WebGPU examples — Three.js contributors | [Water](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water.js) · [Water2](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/objects/Water2.js) · [WebGPU ocean](https://threejs.org/examples/#webgpu_ocean) · [compute water](https://threejs.org/examples/#webgpu_compute_water) · [MIT licence](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | Reference implementations for planar reflection, refraction/flow maps, Fresnel, sun glitter, and an interactive compute heightfield. | **Confirmed:** Three.js is MIT; retain the licence notice for copied substantial portions. Any external normal map or texture is a separate asset decision. | Safe source for narrowly reused helper patterns. Use the reflection idea, not a flat-water drop-in as the final ocean. |
| ThreeJS Water — Yong Su / jeantimex | [source](https://github.com/jeantimex/threejs-water) · [demo](https://jeantimex.github.io/threejs-water/) · [MIT licence](https://github.com/jeantimex/threejs-water/blob/main/LICENSE) | Public project describes real-time interactive water with local height simulation, reflections, refraction, caustics, and buoyancy. | **Confirmed:** repository declares MIT. Textures and any upstream resources require a separate check. | Good reference for local hull/iceberg interaction, not a full-scene ocean dependency. |
| Gerstner Water Shader — Sean Bradley | [source](https://github.com/Sean-Bradley/three.js/blob/gerstner-waves/examples/webgl_shaders_ocean_gerstner.html) · [tutorial / demo](https://sbcode.net/threejs/gerstnerwater/) · [MIT licence](https://github.com/Sean-Bradley/three.js/blob/gerstner-waves/LICENSE) | Gerstner displacement, normal detail, and reflector integration in a Three.js fork. | **Confirmed:** fork keeps the MIT licence. Retain notice if source is incorporated. | Appropriate fallback/foundation reference; the project implementation uses an original multi-band spectrum and CPU mirror. |
| fft-ocean — Jérémy Bouny | [source](https://github.com/jbouny/fft-ocean) · [demo](https://jbouny.github.io/fft-ocean/) · [MIT licence](https://github.com/jbouny/fft-ocean/blob/master/LICENSE) | Legacy Three.js/WebGL FFT ocean with GPU displacement/normal textures and projected-grid thinking. | **Confirmed:** repository declares MIT. Its included BlackPearl model, sound, images, and other non-code files need separate licences. | Study only; do not lift legacy renderer code into r182+ without an intentional port and tests. |
| Very Fast Procedural Ocean — afl_ext | [Shadertoy](https://www.shadertoy.com/view/MdXyzX) | Full-screen procedural/raymarched ocean, derivatives, sky, and sun glitter. | **Unverified in this check:** Shadertoy did not return the shader body to the crawler. The reported MIT header must be manually checked and captured before any source reuse. Shadertoy hosting alone is not a reuse grant. | Visual/theory reference only until manual licence verification. It is not a direct fit for gameplay geometry. |
| Seascape — Alexander Alekseev / TDM | [Shadertoy](https://www.shadertoy.com/view/Ms2SD1) | Influential raymarched seascape with octave waves, atmospheric horizon treatment, and glints. | **Unverified in this check:** the shader page was not retrievable. Existing research notes identify a non-commercial/share-alike licence; treat it as non-reusable until the original page is manually verified and captured. | Do not copy its GLSL or use it as a dependency. Discuss only its high-level rendering ideas. |

### Reuse summary

**Confirmed facts**

- The MIT sources above allow code reuse if their notices are retained.
- Tidewater is offered as paid software and explicitly says source redistribution is prohibited.
- The Three.js MIT licence permits use, modification, and distribution while preserving the notice.

**Technical interpretation**

- A planar reflector adds at least one relevant offscreen scene render; its resolution/update rate is the principal cost control.
- WebGPU FFT references are valuable for a later Ultra tier but are not the compatibility baseline for this project.

**Recommendation**

Ship the original WebGL2 hybrid ocean: CPU-mirrored Gerstner swell, procedural micro detail, Fresnel, depth coloring, crest/interaction foam, and quality-gated reflection. Keep spectral WebGPU work isolated behind an optional tier.

## Asset candidates and permitted use

| Candidate / creator | Direct link | Confirmed facts | Licence / reuse assessment | Project status |
| --- | --- | --- | --- | --- |
| Titanic MKVI — JohnBachoferIV | [Sketchfab](https://sketchfab.com/3d-models/titanic-mkvi-054d2bca80bb43a9b2fa0afa2d91f382) | 105.4k triangles; author asks users to credit them. | **Confirmed:** Sketchfab marks it CC Attribution (CC BY). It can be used and modified if the final distribution supplies the required attribution and licence link. | Permitted **temporary integration prototype** only. Do not present it as the final cinematic asset; perform accuracy, scale, texture, and source-file audit first. |
| RMS Titanic Ship PBR — Anumasa-3D | [CGTrader](https://www.cgtrader.com/3d-models/watercraft/historic-watercraft/rms-titanic-ship-pbr) | Product page lists 49,852 polygons, PBR maps, 2K day/night textures, and separate propellers/rudder. | **Confirmed:** product is marked CGTrader Royalty Free. **Recommendation:** do not assume that alone permits a publicly retrievable GLB, derivative redistribution, or texture repackaging. Obtain written seller/platform permission specific to browser delivery before use. | Candidate only; not cleared for repository or build output. |
| RMS Titanic Cinematic Filming Model — TitanicAnimations | [CGTrader](https://www.cgtrader.com/3d-models/watercraft/historic-watercraft/rms-titanic-cinematic-filming-model) | Page states 269.1 m × 28.2 m, exterior-only, and very high source-file sizes. Its licence text grants online video/tutorial/documentary use. | **Confirmed:** listed as a Custom License, not a general game licence. The published permitted uses do not grant this game's asset-distribution rights. | **Rejected** unless the creator grants a new written game/browser/derivative licence. Do not extract references, geometry, or textures. |
| 1911 White Star Line Olympic/Titanic brochure — White Star Line, held by Library of Congress / World Digital Library | [Library of Congress](https://www.loc.gov/item/2021666878/) | The item has downloadable historical illustrations/deck material. The rights page says the Library is unaware of copyright or other restrictions and says the material is free to use and reuse, subject to reviewing source information. | Suitable historical reference material. Credit the item as requested by the institution; preserve the source URL in art records. | Preferred visual-reference source for an original, commissioned Titanic. It is not a ready-made 3D model. |
| Recent iceberg in Magdalenefjorden, Svalbard — Erik Schytt Mannerfelt | [Sketchfab](https://sketchfab.com/3d-models/recent-iceberg-in-magdalenefjorden-svalbard-2cd12687125b40debad99cb25174b332) | 350k triangles; author describes a 46-photo drone photogrammetry capture and its above-water volume. | **Confirmed:** Sketchfab marks it CC BY. Reuse is possible with attribution, but the model's unknown underwater volume and high topology make it inappropriate as a direct runtime asset. | Morphology/retopology reference. Build original icebergs with original underwater mass and collision meshes. |
| Iceberg — P3POLYGON | [Sketchfab](https://sketchfab.com/3d-models/iceberg-3952ffbc1f49480b82323bb7d2138178) | 5.1k triangles; described as low-poly and hand-painted. | **Confirmed:** Sketchfab marks it CC BY. Attribution would be required for redistribution. | Legally usable only if the style/product fit is approved; not suitable as the high-end hero iceberg. Do not use it as an uncredited template. |
| Ice 002 — ambientCG | [asset](https://ambientcg.com/view?id=Ice002) · [licence](https://docs.ambientcg.com/general-usage/license/) | PBR map set; ambientCG states that all assets are CC0 and usable commercially without attribution. | **Confirmed:** CC0 according to ambientCG. Keep the source record even though attribution is not required. | Safe texture input after size/resolution review and KTX2/Basis compression. |
| Snow 002 — ambientCG | [asset](https://ambientcg.com/view?id=Snow002) · [licence](https://docs.ambientcg.com/general-usage/license/) | Snow PBR material from the same CC0 library. | **Confirmed at library level:** ambientCG states all assets are CC0. Recheck the individual page when downloading. | Safe texture input for snow masks after compression and visual QA. |
| Snow 02 — Rob Tuytel / Poly Haven | [asset](https://polyhaven.com/a/snow_02) · [CC0 licence](https://polyhaven.com/license) | Page identifies Rob Tuytel as author, exposes PBR maps, and states CC0. | **Confirmed:** CC0. Record the exact downloaded derivatives and source URL. | Safe for snow detail, but reduce/compress texture resolution for the 25 MB first-load budget. |

## Required credits and provenance records

For every downloaded or incorporated asset, create a machine-readable manifest entry before it becomes a production dependency:

~~~text
id, path, sha256, source_url, creator, licence_spdx_or_url,
downloaded_at, attribution, modifications, approval_owner, receipt_or_permission
~~~

Store licence snapshots, purchase receipts, written grants, and source-file hashes outside the public build if they contain private information. Retain a public third-party notices file for MIT/CC BY attributions and any distribution-required notices.

## Project asset decision

**Confirmed fact:** the current game has a procedural ship fallback and procedural iceberg implementation; no cleared cinematic GLB is present in the repository.

**Recommendation:** commission or create an original Titanic from the accompanying brief, using public-domain/historically reusable references and written browser-distribution rights. Use original procedural iceberg geometry; use CC0 material inputs where useful. The final art gate requires:

1. a signed rights assignment or an unambiguous CC0/CC-BY chain;
2. an auditable source file and export;
3. GLB, texture, compression, scale, pivot, and performance validation;
4. required public attribution; and
5. no content copied from Titanic: Honor & Glory, a commercial game, an unlicensed marketplace product, or an AI output with unclear asset provenance.
