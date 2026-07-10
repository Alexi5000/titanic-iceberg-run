# Titanic: Iceberg Run

Captain the RMS Titanic through a cinematic North Atlantic crossing. Avoid colliding with icebergs, collect commemorative cards, and chase your daily streak. Built with Three.js and original procedural runtime art.

## Gameplay

- Survive the crossing as the procedurally spawned iceberg field grows denser.
- Grazes damage the hull; a high-speed head-on hit triggers the cinematic sinking sequence.
- Near misses build a score streak with slow-motion feedback.
- Collect 26 deterministic cards, unlock cosmetic liveries, play the daily voyage, and save local records.
- Day, Dusk, Night, Aurora, and Storm presets repaint the world; a long voyage also gathers restrained cloud, mist, and reflection breakup.
- The telegraph, turning radius, momentum, and collision rules intentionally make the ship feel heavy.

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` (or arrows) | Engine telegraph up / down (Full Astern to Full Ahead) |
| `A` / `D` (or arrows) | Rudder port / starboard |
| `V` | Toggle bridge / chase camera |
| `C` | Cycle cinematic cameras |
| `P` | Weather: Day / Dusk / Night / Aurora / Storm |
| `G` / `D` / `R` | Card gallery / Daily Voyage / Records |
| `Q` / `M` / `N` | Post effects / reduced motion / music |
| `F2` / `F3` | Render quality tier / performance overlay |
| `Enter` or canvas click | Start / restart |

Touch devices use the telegraph controls, rudder drag, and CAM button.

## Rendering

- Three.js r182, TypeScript, Vite, WebGL2 baseline, adaptive Low/Medium/High/Ultra quality.
- Original hybrid Gerstner ocean with a shared CPU/GPU spectrum, procedural small-wave detail, Fresnel, optical-depth color proxy, cadence-controlled planar reflection, crest/ship/ice foam, wake, and spray.
- Camera-relative clouds/haze/stars/moon/lightning, rain/mist, cinematic color grading, bloom, and a procedural PBR Titanic/iceberg fallback.
- No backend. Local progression uses `localStorage`. Use `?debug=metrics`, `?debug=perf`, or `?debug=ocean` for diagnostics.

Before adding external art, read:

- [Cinematic architecture and validation guide](docs/CINEMATIC_UPGRADE.md)
- [Asset and licence register](docs/ASSET_AND_LICENSES.md)
- [Titanic and iceberg art-production brief](docs/ASSET_GENERATION_BRIEFS.md)

## Development

```powershell
bun install
bun run dev
bun run build
bun run preview
# with a dev/preview server running:
bun run qa:cinematic
```

## Project structure

```text
src/
|- main.ts        # bootstrap and game loop
|- ocean/         # Gerstner spectrum, water material, reflection, authoring controls
|- environment/   # rain and mist
|- rendering/     # quality policy and performance overlay
|- core/          # game state, input, audio, post processing
|- world/         # sky, palette, iceberg field, ocean facade
|- ship/          # PBR procedural ship, physics, collision, wake, sinking
|- camera/        # chase, bridge, and cinematic camera director
|- gameplay/      # scoring, difficulty, cards, rewards
`- ui/            # HUD and menus
```
