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
- [ ] M3 — Physics & controls: telegraph speed states, rudder steering with turning inertia, keyboard input
- [ ] M4 — Icebergs & collision: procedural iceberg meshes, spawner ahead of ship, collision -> graze damage vs fatal hit, hull integrity
- [ ] M5 — Cameras: chase cam, bridge first-person cam, cinematic director (intro fly-by, orbit shots, collision/sinking sequence), smooth transitions
- [ ] M6 — Missions, rewards, scoring: distance score, near-miss detection, mission system with toasts, reward unlocks, localStorage persistence
- [ ] M7 — HUD & menus: telegraph + rudder dials, hull bar, score/mission UI, title screen, game-over screen with stats + restart
- [ ] M8 — Polish: difficulty ramp, audio (engine hum, horn, collision crunch, ambience via WebAudio), ice-field density waves, performance pass (60fps target)
- [ ] M9 — Ship it: `bun run build` clean, README, GitHub repo created + pushed, deployed to free static hosting, live URL verified

## Rules

- Bun only (never npm/yarn). TypeScript strict. snake_case filenames with file header templates.
- No backend — localStorage for persistence.
- Keep it 60fps: procedural geometry, no heavy external assets.
- If a task is blocked, fix the blocker first and note it here.
