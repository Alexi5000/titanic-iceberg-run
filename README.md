# Titanic: Iceberg Run

Captain the RMS Titanic across the North Atlantic at night. Avoid colliding with icebergs. Built with Three.js.

## Gameplay

- **Goal:** survive the crossing - dodge procedurally spawned icebergs that get denser the further you sail
- **Grazes** damage the hull; a **head-on hit at speed** sinks her instantly with a cinematic sinking sequence
- **Missions** (travel distance, near misses, full-steam endurance) award points
- **Rewards** persist across runs via localStorage: career points unlock the bow searchlight and golden funnels
- Realistic inertia: she is slow to turn and slow to stop - manage the engine telegraph carefully

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` (or arrows) | Engine telegraph up / down (Full Astern to Full Ahead) |
| `A` / `D` (or arrows) | Rudder port / starboard |
| `V` | Toggle bridge / chase camera |
| `C` | Cinematic camera (cycling shots) |
| `Enter` or click | Start / restart |

## Tech

- Three.js + TypeScript + Vite, fully procedural (no external assets)
- Shader ocean with a CPU wave mirror for ship bobbing
- Procedural WebAudio: ambience, engine hum, horn, collision crunch
- No backend - static site, persistence via localStorage

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
