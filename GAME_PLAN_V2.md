# GAME_PLAN_V2.md — Titanic: Iceberg Run v2 "Toy Atlantic" + Cards

GOAL: Bruno Simon-grade colorful, juicy, collectible game. The loop takes the FIRST
unchecked task, implements it fully, verifies `bun run build` passes with zero errors,
browser smoke-tests visual/interactive changes, checks the task off with a note,
commits with a conventional message, and pushes at each drop boundary (auto-deploys
Vercel + GitHub Pages). When all tasks are checked AND live URLs verified: LOOP_COMPLETE.

## Drop 1 — Look and Feel ("Bruno-fication")

- [x] D1.1 Palette system: `src/world/palette.ts` config drives ocean/sky/fog/berg/ship accents; 3 moods (Dusk default, Night, Aurora); gradient sky dome shader — DONE: palette config + persistence, gradient dome with aurora ribbons, P key cycles moods live
- [x] D1.2 Stylized shading: gradient-ramp lighting on ship + bergs, warm rim light, saturated ice — DONE: shared 5-step toon gradient on all ship/berg materials, faceted non-indexed bergs with seeded noise, rim light in sky rig
- [x] D1.3 Post-processing: EffectComposer bloom + vignette, quality toggle to disable — DONE: bloom + animated vignette with pulse hook for slow-mo, Q key toggles + persists, falls back to direct render
- [x] D1.4 Juice pass: screen shake on graze, near-miss hit-stop + slow-mo + FOV punch + audio sweep, wake foam trail, bow spray, ice-shard burst, springy HUD, bounce intro, reduced-motion toggle — DONE: JuiceSystem (slow-mo/shake/FOV/intro bounce), WakeEffects pools (foam/spray/shards), master lowpass sweep, HUD thunk/wobble/overshoot, M key reduced motion
- [x] D1.5 Bumpable flotsam: ice chunks shoved aside by the bow with fake impulse physics — DONE: 16 toon ice chunks + crates with bow impulse, spin, wave bobbing, recycle ahead
- [x] D1.6 Drop 1 QA + push + verify both live URLs — DONE: browser QA passed (palettes, intro bounce, foam/spray, flotsam, toon look, postfx, zero console errors), pushed

## Drop 2 — Cards + Onboarding

- [x] D2.1 Card core: 24 cards / 3 suits / 4 rarities, deterministic trigger detectors, persistence `tir.cards.v1` with v1 save migration — DONE: CardDetector with event + frame triggers, career stats store, quota-safe persistence, v1 keys untouched
- [x] D2.2 Card art: procedural render-to-texture vignettes per suit + rarity border treatments (flat/foil/aurora/holo) — DONE: freeze-frame canvas capture for Moments/Ships, 2D-canvas medallion emblems for Feats, CSS foil/aurora/holo borders
- [x] D2.3 Card UI: earn toasts (Legendary freeze-frame), game-over flip reveal with stings, gallery (tabs, silhouettes + hints, collection %, inspect with tilt) — DONE: rarity stings, staggered flip reveals on game over, G-key gallery with tabs/silhouettes/parallax inspect
- [x] D2.4 Onboarding: first-run guided intro, contextual prompts dismissing on use, forgiving first berg, guaranteed first card, skippable — DONE: 3-step prompts (telegraph/steer/near-miss), 0.45 density cap during tutorial, first near miss celebrated + grants Close Shave card, X skips, never repeats
- [ ] D2.5 Card-gated cosmetics: 4 ship skins via card-set completion + equip screen; grandfather v1 unlocks
- [ ] D2.6 Drop 2 QA + push + verify deploys

## Drop 3 — Audience expanders

- [ ] D3.1 Mobile/touch: telegraph slider, rudder drag, tap camera toggle, responsive HUD, auto quality-down
- [ ] D3.2 Daily Voyage: date-seeded berg field, one scored attempt/day, streaks, daily-exclusive card variants
- [ ] D3.3 Records board: local top-10 per mode + NEW BEST confetti/fanfare
- [ ] D3.4 Music layer: procedural pentatonic motif scaling with ice density + rarity stings
- [ ] D3.5 Metrics: `tir.metrics.v1` blob + `?debug=metrics` panel (runs/session, play days, collection engagement)
- [ ] D3.6 Final QA (desktop + mobile) + push + verify live URLs -> LOOP_COMPLETE

## Rules

- Bun only, strict TS, snake_case filenames + file header templates
- 100% procedural assets (no downloads), 60fps desktop / 30fps mobile
- No backend; localStorage only; reduced motion respected
- Non-goals locked: no online leaderboards, no RNG packs, no gameplay-power cards, no multiplayer, no monetization, no TSL/WebGPU
