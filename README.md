# Titanic: Iceberg Run

Captain the RMS Titanic across a hand-painted "Toy Atlantic". Avoid colliding with icebergs, collect commemorative cards, and chase your daily streak. Built with Three.js, 100% procedural.

## Gameplay

- **Goal:** survive the crossing - dodge procedurally spawned icebergs that get denser the further you sail
- **Grazes** damage the hull; a **head-on hit at speed** sinks her instantly with a cinematic sinking sequence
- **Near misses** build a score streak with slow-mo flair - skim the ice, don't touch it
- **26 collectible cards** across Moments / Ships / Feats suits with 4 rarities, earned deterministically from things that actually happen in your runs; freeze-frame art is captured at the earn moment
- **4 unlockable ship liveries** (Royal Mail Red, Brass & Teak, Ghost Ship, Rainbow Funnels) gated by card-set completion
- **Daily Voyage:** a date-seeded iceberg field, one scored attempt per day, streak tracking and exclusive cards
- **Records board:** local top-10 per mode with a confetti NEW BEST celebration
- **3 moods:** Dusk, Night, Aurora - each repaints the whole world
- Realistic inertia: she is slow to turn and slow to stop - manage the engine telegraph carefully
- First-run guided onboarding; full touch controls on mobile

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` (or arrows) | Engine telegraph up / down (Full Astern to Full Ahead) |
| `A` / `D` (or arrows) | Rudder port / starboard |
| `V` | Toggle bridge / chase camera |
| `C` | Cinematic camera (cycling shots) |
| `P` | Mood: Dusk / Night / Aurora |
| `G` | Card gallery |
| `D` | Daily Voyage |
| `R` | Records board |
| `Q` / `M` / `N` | Quality / reduced motion / music toggles |
| `Enter` or click | Start / restart |

On touch devices: left-thumb telegraph slider, right-thumb rudder drag, CAM button.

## Tech

- Three.js + TypeScript + Vite, fully procedural (no external assets)
- Toon gradient-ramp shading, palette-driven gradient sky dome with animated aurora, bloom + vignette post-processing
- Shader ocean with a CPU wave mirror for ship bobbing; wake foam, bow spray, ice shards, bumpable flotsam
- Procedural WebAudio: ambience, engine hum, horn, collision crunch, rarity stings, and an intensity-following pentatonic music layer
- No backend - static site, persistence via localStorage (`?debug=metrics` shows local engagement stats)

## Development

```bash
bun install
bun run dev      # dev server at http://localhost:5173
bun run build    # typecheck + production build to dist/
bun run preview  # preview the production build
```

## Project Structure

```
src/
├── main.ts        # bootstrap + game loop
├── core/          # game state, input, audio
├── world/         # ocean, sky, iceberg field
├── ship/          # titanic model, physics, collision, sinking
├── camera/        # camera director (chase / bridge / cinematic)
├── gameplay/      # missions, rewards, scoring, difficulty
└── ui/            # HUD, menus, styles
```

`GAME_PLAN.md` tracks the milestone checklist the build loop executed against.
