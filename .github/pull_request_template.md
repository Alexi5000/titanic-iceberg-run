## Summary

Describe the problem and the focused change that resolves it. Link the related issue when applicable.

## Validation

State the commands and manual paths you ran.

- [ ] `bun run lint`
- [ ] `bun run typecheck`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `QA_URL=... bun run qa:cinematic` for rendering, interaction, UI, camera, or quality-tier changes

## Visual or Gameplay Review

Describe the player-facing behavior reviewers should exercise. Attach screenshots or a recording when visual evidence materially helps the review.

## Asset, Dependency, and Privacy Check

- [ ] No new asset, dependency, environment variable, network call, or persistent data behavior was introduced.
- [ ] If any were introduced, I documented source, license or permission, purpose, privacy implications, and validation in this pull request and updated project documentation where needed.
- [ ] I did not include secrets, personal data, private URLs, build output, or unrelated generated files.

## Checklist

- [ ] The change is focused and documented.
- [ ] I reviewed [CONTRIBUTING.md](../CONTRIBUTING.md) and followed the [Code of Conduct](../CODE_OF_CONDUCT.md).
- [ ] The quality checks above pass locally, or I explained any exception.
