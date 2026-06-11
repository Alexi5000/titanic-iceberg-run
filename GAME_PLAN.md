# GAME_PLAN.md — Titanic: Iceberg Run

GOAL: A fully playable, deployed Three.js game where the player captains the Titanic
and avoids colliding with icebergs. Cinematic + gameplay views, steering + speed
controls, missions + rewards.

The build loop takes the FIRST unchecked task each iteration, implements it,
verifies `bun run build` passes, checks it off with a one-line note, and commits.
When every task is checked AND the live deploy URL works: LOOP_COMPLETE.

## Milestones

- [x] M0 — Scaffold: Vite + TS + Three.js via bun; renderer, resize handling, RAF loop; dev server runs — DONE: vite+ts+three scaffolded, build green
- [x] M1 — World: dark ocean with animated water, night sky + stars + moon, exponential fog — DONE: shader ocean with CPU wave mirror, star dome, moon + halo, FogExp2
- [x] M2 — Ship: procedural low-poly Titanic (hull, 4 funnels, deck lights, smoke particles), bobbing on water — DONE: procedural hull/superstructure/funnels/masts, porthole lights, 3 smoking funnels, wave bobbing; browser-verified
- [x] M3 — Physics & controls: telegraph speed states, rudder steering with turning inertia, keyboard input — DONE: 6-step telegraph, rudder with self-centering + speed-scaled turn authority, turn heel, W/S A/D + arrows
- [x] M4 — Icebergs & collision: procedural iceberg meshes, spawner ahead of ship, collision -> graze damage vs fatal hit, hull integrity — DONE: pooled noisy-icosahedron bergs, corridor spawner + recycler, 5-sphere hull capsule, graze/fatal/near-miss + hull damage
- [x] M5 — Cameras: chase cam, bridge first-person cam, cinematic director (intro fly-by, orbit shots, collision/sinking sequence), smooth transitions — DONE: camera director (V cycles chase/bridge, C cinematic with 3 cycling shots), title orbit, sinking orbit + bow-first sinking animation
- [x] M6 — Missions, rewards, scoring: distance score, near-miss detection, mission system with toasts, reward unlocks, localStorage persistence — DONE: streak-multiplier scoring, 5 missions (incl. career mission), career points + best score + 2 cosmetic unlocks (searchlight, golden funnels) in localStorage
- [x] M7 — HUD & menus: telegraph + rudder dials, hull bar, score/mission UI, title screen, game-over screen with stats + restart — DONE: full DOM HUD (telegraph steps, rudder needle, hull bar, missions panel, toasts, damage vignette), title + game-over screens, Enter/click to start; browser-verified with coordinate probe
- [x] M8 — Polish: difficulty ramp, audio (engine hum, horn, collision crunch, ambience via WebAudio), ice-field density waves, performance pass (60fps target) — DONE: distance ramp + sine density waves + fog thickening, fully procedural WebAudio (ambience, engine, horn, crunch, chime), high-performance renderer hints
- [ ] M9 — Ship it: `bun run build` clean, README, GitHub repo created + pushed, deployed to free static hosting, live URL verified

## Rules

- Bun only (never npm/yarn). TypeScript strict. snake_case filenames with file header templates.
- No backend — localStorage for persistence.
- Keep it 60fps: procedural geometry, no heavy external assets.
- If a task is blocked, fix the blocker first and note it here.
