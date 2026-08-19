# Titanic: Iceberg Run

[![Quality](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/quality.yml/badge.svg)](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/quality.yml)
[![Deploy to GitHub Pages](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/deploy.yml/badge.svg)](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/deploy.yml)

**Titanic: Iceberg Run** is a browser-based cinematic navigation game. Captain the RMS Titanic through a procedurally generated North Atlantic crossing, manage momentum and rudder response, avoid icebergs, collect commemorative cards, and preserve a daily-voyage streak. It is built with TypeScript, Three.js, Vite, WebGL2, and original procedural runtime art.

> This project is a fictional interactive experience. It does not depict historical events as a simulation and is not affiliated with any Titanic estate or organization.

## Alexi5000 Project Purpose

This is **Alexi5000’s applied real-time interaction and visual-systems reference implementation** for agent-building and automation work. Alex Cinovoj brings more than a year of hands-on experience building agents, integrations, and AI-assisted software with Cursor, Claude, Codex-class tools, MCP patterns, and practical automation systems. The repository demonstrates how that workflow translates into a focused, inspectable front-end project: explicit architecture, reproducible checks, accessible interaction surfaces, and a small quality contract that can be extended by human or AI contributors.

The goal is not merely to preserve a playable prototype. It is to maintain an auditable reference for coordinating a complex client-side system—rendering, input, physics, state, persistence, and UI—while keeping contribution and verification paths clear.

## Experience

The crossing gets progressively denser as the iceberg field grows. Grazes damage the hull, a high-speed head-on collision triggers the sinking sequence, and near misses build a score streak with slow-motion feedback. Players can collect deterministic cards, unlock cosmetic liveries, use daily voyages, and retain local records in the browser.

| Area | Included capabilities |
| --- | --- |
| Navigation | Telegraph, rudder, turning radius, momentum, collision, and sinking systems intended to convey the mass of the ship. |
| Cinematic rendering | Procedural Gerstner ocean, foam, wake, spray, reflection, clouds, haze, stars, moonlight, lightning, mist, rain, bloom, and grading. |
| Progression | Twenty-six deterministic cards, cosmetic liveries, daily-voyage streaks, missions, scoring, records, and local persistence. |
| Accessibility and diagnostics | Touch controls, reduced motion, camera controls, quality tiers, a performance overlay, and debug views. |

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` or arrow keys | Move the engine telegraph up or down, from Full Astern to Full Ahead. |
| `A` / `D` or arrow keys | Steer port or starboard. |
| `V` | Toggle bridge and chase cameras. |
| `C` | Cycle cinematic cameras. |
| `P` | Cycle Day, Dusk, Night, Aurora, and Storm weather. |
| `G` / `D` / `R` | Open the card gallery, Daily Voyage, or records. |
| `Q` / `M` / `N` | Toggle post effects, reduced motion, or music. |
| `F2` / `F3` | Change quality tier or toggle the performance overlay. |
| `Enter` or canvas click | Start or restart a voyage. |

Touch devices use the on-screen telegraph controls, rudder drag, and camera button.

## Verified Setup

The project is pinned to **Bun 1.3.3** through the committed lockfile. Node.js 22 is also supported for local quality checks and continuous integration. A WebGL2-capable browser is required to play the game.

```bash
# Clone your fork and enter the repository.
git clone https://github.com/Alexi5000/titanic-iceberg-run.git
cd titanic-iceberg-run

# Install exact dependency versions and start local development.
bun install --frozen-lockfile
bun run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`. Build and preview the production bundle with the following commands.

```bash
bun run build
bun run preview
```

The application has no backend and stores progression only in browser `localStorage`. No credentials are required for ordinary development.

## Environment

Copy `.env.example` only when you need to point cinematic browser validation at a non-default local or preview URL. The `QA_URL` variable is consumed by the validation script; it is not used by the game bundle and must never contain a secret.

```bash
cp .env.example .env
# Start a preview server in another terminal, then run the browser check.
bun run preview
QA_URL=http://127.0.0.1:4173 bun run qa:cinematic
```

## Quality Contract

The repository keeps fast structural checks separate from a browser-level rendering check. `quality` performs deterministic checks suitable for pull requests; `qa:cinematic` exercises the launched application and therefore requires a running dev or preview server.

| Command | Purpose |
| --- | --- |
| `bun run lint` | Detect unresolved merge markers, unexpected debug logging, missing repository boundaries, and missing source modules. |
| `bun run typecheck` | Type-check the TypeScript codebase without emitting files. |
| `bun run test` | Run dependency-free repository contract smoke tests with Node’s built-in test runner. |
| `bun run build` | Create a production Vite bundle. |
| `bun run qa:cinematic` | Run Playwright smoke coverage for the canvas, performance overlay, and ocean authoring controls. Requires `QA_URL` or a local server. |
| `bun run quality` | Run lint, type-check, contract tests, and build in sequence. |

### Browser Diagnostics

The game offers opt-in diagnostic modes that do not require code changes:

```text
?debug=metrics  # gameplay metrics panel
?debug=perf     # rendering-performance overlay
?debug=ocean    # ocean authoring controls
```

## Use Cases

This repository is suitable for validating a browser-only gameplay loop, studying a TypeScript and Three.js project organized by runtime responsibility, testing agent-assisted changes against explicit repository contracts, and evaluating low-dependency continuous integration patterns for visual client applications. It is also a constrained reference for maintaining local-first browser state without introducing a backend or handling user credentials.

## Project Structure

```text
src/
├── camera/        # chase, bridge, and cinematic camera direction
├── core/          # game state, input, audio, onboarding, metrics, post processing
├── environment/   # rain and mist
├── gameplay/      # scoring, difficulty, cards, rewards, records, and daily voyages
├── ocean/         # Gerstner spectrum, water material, reflection, authoring controls
├── rendering/     # quality policy and performance overlay
├── ship/          # procedural ship, physics, collision, wake, and sinking
├── ui/            # HUD, menus, cards, records, touch controls, and UI styles
└── world/         # sky, palette, iceberg field, ocean facade, and shading
scripts/           # browser and repository-quality utilities
tests/             # dependency-free repository contract smoke tests
docs/              # cinematic design and asset-governance material
```

Before adding third-party visual assets, read the [cinematic architecture and validation guide](docs/CINEMATIC_UPGRADE.md), [asset and licence register](docs/ASSET_AND_LICENSES.md), and [art-production brief](docs/ASSET_GENERATION_BRIEFS.md).

## Contributing

Contributions should preserve deterministic behavior, maintain the browser-only privacy model, and keep the quality contract green. Please begin with [CONTRIBUTING.md](CONTRIBUTING.md), follow the [Code of Conduct](CODE_OF_CONDUCT.md), run `bun run quality`, and run `bun run qa:cinematic` for rendering, interaction, or visual-system changes.

## Security and Support

Please report suspected security vulnerabilities privately according to [SECURITY.md](SECURITY.md). For usage questions, bug triage, and contribution support, start with [SUPPORT.md](SUPPORT.md). General project policy, intent, and maintenance boundaries are described in [FORK_POLICY.md](FORK_POLICY.md).

## Origin and Attribution

`Alexi5000/titanic-iceberg-run` is an independent Alexi5000 repository rather than a GitHub fork. The project’s source, game design, validation material, and asset provenance are maintained in this repository. Asset rules and third-party attribution requirements are documented in the [asset and licence register](docs/ASSET_AND_LICENSES.md).
