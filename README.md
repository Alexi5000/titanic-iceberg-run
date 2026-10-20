# Titanic: Iceberg Run

[![Quality](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/quality.yml/badge.svg)](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/quality.yml)
[![Deploy to GitHub Pages](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/deploy.yml/badge.svg)](https://github.com/Alexi5000/titanic-iceberg-run/actions/workflows/deploy.yml)

**Titanic: Iceberg Run** is a browser-based cinematic navigation game. Captain the RMS Titanic through a procedurally generated North Atlantic crossing, manage momentum and rudder response, avoid icebergs, collect commemorative cards, and preserve a daily-voyage streak. It is built with TypeScript, Three.js, Vite, WebGL2, and original procedural runtime art.

> This project is a fictional interactive experience. It does not depict historical events as a simulation and is not affiliated with any Titanic estate or organization.

## Why this exists

**What it does.** Titanic: Iceberg Run is a browser game built with TypeScript, Three.js, Vite, and WebGL2. You steer a procedurally rendered RMS Titanic through a generated North Atlantic ice field with an engine telegraph and a rudder that carry momentum, collect 26 deterministic cards, and keep a daily-voyage streak. There is no backend: progression and records persist only in browser `localStorage`, and no credentials are involved.

**Who it serves.** Players who want a short, replayable arcade-style crossing in a desktop or mobile browser, including players who rely on operating-system reduced-motion settings; and developers who want a readable reference for a client-only Three.js game with explicit lint, type, test, and build checks.

**Why Alex built it.** The repository's policy document records the purpose (`FORK_POLICY.md`, added in commit `be54a97`, 2026-08-19, "chore: establish professional quality baseline"): make a complex client-side experience (rendering, ocean and environmental effects, physics, input, gameplay state, local persistence, and UI) inspectable and reproducible without a backend or account system, as a practical companion to Alex Cinovoj's agent-building and AI-assisted engineering work. The game itself was built in a two-day burst: the scaffold landed on 2026-06-11 (first commit `18df24d`, "feat(scaffold): bootstrap vite + typescript + three.js project with game plan"), GitHub Pages deployment the same day (`401fa6b`), and the v2 release with cards, daily voyages, mobile controls, and an automated Playwright QA pass on 2026-06-12 (`eaa6036`, `2da9b75`). A cinematic ocean upgrade followed on 2026-07-09 (`134ee16`). October 2026 maintenance removed vulnerable build dependencies (PR #1) and stopped the start-screen pulse under reduced motion (PR #2).

**Real-world use case (2025-2026 evidence).** **Verified in this repository.** A player who has "Reduce motion" enabled in their operating system opens the deployed game at <https://alexi5000.github.io/titanic-iceberg-run/>, which `.github/workflows/deploy.yml` publishes from `main`. The game reads `prefers-reduced-motion: reduce` in `src/gameplay/juice.ts` and `src/rendering/quality_manager.ts`, and `src/ui/ui_styles.ts` disables the start-screen pulse and other UI animation under that media query (PR #2, merged 2026-10-20); the `M` key toggles reduced motion in-game for players whose platform does not expose the setting. This follows current guidance: MDN documents the media feature and the OS settings that drive it (page updated 2026-06-10)[^1], and 2026 practitioner guidance stresses reducing rather than removing motion and cites WCAG 2.3.3, Animation from Interactions[^2]. The deployment workflow, the live page, and the preference checks are in this repository; no automated test exercises the reduced-motion path, and `bun run qa:cinematic` requires a running browser server.

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

Open the local URL printed by Vite, usually `http://localhost:5173`. The `main` branch is published to GitHub Pages at <https://alexi5000.github.io/titanic-iceberg-run/> by `.github/workflows/deploy.yml`. Build and preview the production bundle with the following commands.

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

Please report suspected security vulnerabilities privately according to [SECURITY.md](SECURITY.md). Dependency and code-scanning status: 0 open Dependabot alerts and 0 open CodeQL alerts as of 2026-10-20. The `Quality` workflow runs on pushes to `main` and on pull requests, and GitHub CodeQL default setup is enabled with the extended query suite on a weekly schedule. For usage questions, bug triage, and contribution support, start with [SUPPORT.md](SUPPORT.md). General project policy, intent, and maintenance boundaries are described in [FORK_POLICY.md](FORK_POLICY.md).

## Origin and Attribution

`Alexi5000/titanic-iceberg-run` is an independent Alexi5000 repository rather than a GitHub fork. The project's source, game design, validation material, and asset provenance are maintained in this repository. Asset rules and third-party attribution requirements are documented in the [asset and licence register](docs/ASSET_AND_LICENSES.md).

## License

MIT. See [LICENSE](LICENSE).

[^1]: MDN Web Docs, "prefers-reduced-motion CSS media feature", last modified 2026-06-10. https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-reduced-motion
[^2]: OpenReplay blog, "Using prefers-reduced-motion for Accessible Animation", 2026-05-27. https://blog.openreplay.com/prefers-reduced-motion-accessible-animation
