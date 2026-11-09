# CLAUDE.md

This is the working guide for Claude Code and human contributors on **Air Defense Simulator**.
The full specification is in [`docs/PROJECT_PLAN.md`](docs/PROJECT_PLAN.md). Read it before changing the simulator.

**Status: complete (version 1.0.0).** The simulator was built in six steps (0 to 5), each released as a git tag. There are no further steps: changes now are fixes and improvements to what is there.

## What we are building

An open-source, browser-based, educational air-defense simulator.

- **The defender:** a generic battery made of a search radar, a tracking radar, a command node, launchers and interceptors. It protects assets on the map.
- **The threats:** small drones, cruise-missile-like targets and fast jets.
- **The interaction:** users drag any threat onto the map and watch the full loop live: Detect → Track → Classify/Identify → Evaluate → Assign → Engage → Assess.
- **The header:** an always-visible analysis bar summarizes the loop and its key numbers.

## Owner requirements (non-negotiable)

1. **Polished and approachable.** Attractive and intuitive for the general public, credible for specialists: simple by default, deep on demand.
2. **Drag-and-drop threats.** Palette cards (drone, swarm, cruise-missile-like, fast jet, friendly aircraft, airliner) are dropped on the 2D map or the 3D terrain, and the battery reacts live.
3. **Header analysis bar.** Live counts for each stage, KPIs, and a plain-language "Now" line, always visible.
4. **Easy to run.** A live demo on GitHub Pages, animated clips in the README, and `npm install && npm run dev`.
5. **A README that teaches.** Easy to scan. Every model has a concise physics concept card, and every step has a build-log entry.
6. **Safe and generic.** See the safety guardrails below.
7. **Fixed author credit.** The header always shows "Created by Mohammad Alyounes" on every screen size, and the footer shows "© 2026 Mohammad Alyounes". Both come from `AUTHOR` in `src/app/data/links.ts`. Never remove, hide or change them; a browser test fails CI if you do. Keep the credit in the README, `NOTICE`, `CITATION.cff` and the social preview card too.

## Architecture rules

- **Pure sim core.** `src/sim/` is plain TypeScript: no DOM, React, Three.js or browser APIs. It must run in a Web Worker and in Node (for tests).
- **Determinism.** Randomness comes only from the seeded RNG. Never use `Math.random()`, `Date.now()` or `performance.now()` inside `src/sim/`.
- **Time step.** A fixed 50 Hz step, with sub-steps near intercepts. The UI interpolates between snapshots.
- **Commands only.** The UI changes the sim only through commands (`spawnThreat`, `setParam`, `approveEngagement`, `seek`, …). The sim emits snapshots and events. Every command is recorded, so every run can be replayed.
- **Units.**
  - Inside the sim, use SI units (m, s, kg, rad).
  - Configs and the UI name their units explicitly (`speedMps`, `altM`, `headingDeg`).
- **World frame.** Local East-North-Up metres, with the origin at the battery. Earth curvature is applied to line-of-sight and the radar horizon.
- **Swappable models.** The atmosphere, radar, tracker, guidance and fuze models each sit behind a small interface.

## Safety guardrails

- **Fictional equipment only.** No real system names, specifications or performance data. Use round numbers chosen for teaching.
- **Textbook-level physics.** A 3-DOF point mass and public equations. No real seeker, warhead or propulsion detail.
- **Fictional terrain.** Generated procedurally. No real-world locations, bases or borders.
- **Defensive framing.** Effects stay non-graphic. Identification and rules-of-engagement mistakes count as failures.
- **Community scenarios** follow the same rules (`SAFETY.md`).

## Definition of done (every change)

1. **It works in the running app.** Verify it in headless Chromium and capture screenshots, plus an animated clip for visual features (GIF, or WebP when most of the picture moves).
2. **Checks pass.** `npm run lint`, `npm run typecheck` and `npm test` all pass, and new physics has unit tests against known values.
3. **README updated.** A concept card for any new physics, and the build log and screenshots where the change shows.
4. **Devlog entry.** For anything beyond a small fix, add an entry to `docs/DEVLOG.md`: what was built and the key decisions.
5. **Shipped.** Commit and push to `main`. A release commit ends with a trailer such as `Step-Tag: v1.0.1` (step releases used `Step-Tag: step-NN-<slug>`; one commit may carry several). Once CI passes, the `release-step` job creates the tag and a GitHub Release, from the devlog entry, for every trailer in the pushed commits. (The cloud session's git proxy rejects tag pushes, so never push tags by hand from there.) To move an already released tag to a newer commit, add `Step-Retag: true` as well.

## Concept card format (README, docs and in-app)

```
### <Concept> — <one-line hook>

<At most 3 plain sentences. Explain any jargon you use.>

- **Formula:** `<one line>`
- **Example:** <one concrete number example>
- **See it:** <where to see it in the sim>
```

The full concept texts live in `docs/concepts/NN-M-slug.md` (step `NN`, order `M`). The part above `<!-- more -->` is the card. The app imports the files (`ConceptPopover`), and `npm run docs:sync` copies the cards into the README between the `concepts:start` and `concepts:end` markers. CI runs `npm run docs:check` and fails if the README is out of date.

## README style

- **Hero first:** title, one-liner, preview image, buttons (Live demo · Run it locally · Build log · Project plan), badges.
- **Easy to scan:** short sections and bullets, one idea per paragraph. Plain language first, math second.
- **Quick start** in four commands or fewer. Deep math goes in `docs/MODELS.md`, not the README.

## Commands

| Command                                              | Purpose                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                        | Local dev server                                             |
| `npm run build` / `npm run preview`                  | Build for production / preview the build                     |
| `npm test`                                           | Unit tests (Vitest)                                          |
| `npm run test:e2e`                                   | Browser tests (Playwright)                                   |
| `npm run lint` / `npm run typecheck`                 | Code quality                                                 |
| `npm run format` / `npm run format:check`            | Prettier                                                     |
| `npm run check`                                      | Lint, typecheck, unit tests, format and docs checks          |
| `npm run docs:sync` / `npm run docs:check`           | Copy concept cards into the README / verify they match       |
| `npm run media:screenshots -- --name step-NN-<slug>` | README screenshots (run `npm run build` first)               |
| `npm run media:gif -- --name … --selector …`         | Animated GIF or WebP (`--format webp`) of part of the app    |
| `npm run media:previews`                             | Social preview images from `scripts/media/preview-card.html` |

Both media scripts accept `--query "seed=2026&t=75&paused=0"` for repeatable shots: simulation options from `src/app/sim/params.ts`, view options (`select`, `camera`, `heights`, `labels`, `welcome=0`) from `src/app/view/viewParams.ts`. `media:gif` can also script the clip with `--actions` (timed key presses and clicks).

## Environment notes

- `@playwright/test` is pinned to the version whose browser build is preinstalled in the cloud dev environment. Bump it together with `npx playwright install chromium`.
- TypeScript stays on 6.x until typescript-eslint supports 7.x.
- CI sets `BASE_PATH=/<repo>/` and `VITE_SITE_URL` for GitHub Pages; locally the app serves from `/`.

## Conventions

- **Code:** strict TypeScript, ESLint + Prettier, small pure functions in the sim.
- **Commits:** imperative mood. Build-step commits were prefixed with their step (`step-05: add radar horizon model`); later changes use a short area prefix (`sim:`, `app:`, `docs:`).
- **Commit author:** Mohammad Alyounes <fcbmoh98@gmail.com>. In a fresh clone, run `git config author.name "Mohammad Alyounes"` and `git config author.email "fcbmoh98@gmail.com"`, and leave the committer and signing as configured. Keep the Claude `Co-Authored-By` trailer.
- **Secrets:** never commit them. The optional Claude tutor uses the visitor's own API key, never a key stored in the repo.
