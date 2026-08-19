# Contributing to Titanic: Iceberg Run

Thank you for improving **Titanic: Iceberg Run**. Contributions should make the game more reliable, accessible, legible, or maintainable without weakening its browser-only privacy model or cinematic performance budget.

## Working Agreement

Treat this repository as an applied reference for agent-assisted software engineering. Small, well-scoped changes with an explicit validation plan are preferred over broad rewrites. Keep gameplay behavior deterministic where feasible, preserve the keyboard and touch paths, and avoid adding services, telemetry, credentials, or third-party assets unless the change has an approved need and clear provenance.

All participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md). Security-sensitive findings must be handled through the private reporting process in [SECURITY.md](SECURITY.md), not public issues.

## Local Development

Use Bun 1.3.3 and a WebGL2-capable browser. The committed lockfile is authoritative.

```bash
bun install --frozen-lockfile
bun run dev
```

Create a focused branch from `main`. Make one logical change set, explain the player or maintainer impact, and avoid unrelated formatting or generated-file churn.

## Required Validation

Run the quality contract before opening a pull request.

```bash
bun run quality
```

For changes to rendering, interaction, assets, camera behavior, quality tiers, UI, or game state, also run the browser check against a running local server.

```bash
# Terminal 1
bun run preview

# Terminal 2
QA_URL=http://127.0.0.1:4173 bun run qa:cinematic
```

| Change area | Expected evidence |
| --- | --- |
| Documentation or policies | `bun run lint`, `bun run test`, and clear link validation. |
| TypeScript or runtime logic | `bun run quality`, plus a concise note on the affected gameplay path. |
| Rendering, UI, input, camera, or effects | `bun run quality`, `bun run qa:cinematic`, and before/after visual evidence when it clarifies the review. |
| Assets | Asset source, license status, and updates to `docs/ASSET_AND_LICENSES.md` as applicable. |

## Pull Requests

Use the pull-request template. Describe the problem, solution, testing performed, and any behavior that reviewers should exercise. Keep title and commits concise and imperative, for example `fix: preserve storm quality setting`.

Do not commit `.env`, browser profiles, production build output, screenshots that are not part of the requested change, or secrets. The only documented local validation variable is `QA_URL`, and it must point to a non-sensitive local or preview URL.

## Asset and Design Changes

Read the [cinematic architecture and validation guide](docs/CINEMATIC_UPGRADE.md) before modifying the visual pipeline. Read the [asset and licence register](docs/ASSET_AND_LICENSES.md) before adding external art, audio, models, textures, or references. A contribution must not imply endorsement, historical accuracy, or affiliation.

## Getting Help

For normal usage and contribution questions, consult [SUPPORT.md](SUPPORT.md). If a proposed change exceeds the scope of this repository, explain the objective in a feature request before investing in a broad implementation.
