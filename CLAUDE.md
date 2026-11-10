# CLAUDE.md

Working rules for Claude Code and human contributors on **Air Defense Simulator**. How the code fits together is in [docs/DESIGN.md](docs/DESIGN.md); the physics is in [docs/PHYSICS.md](docs/PHYSICS.md).

**Status: complete (version 1.0.0).** The simulator was built in six steps (0 to 5), each released as a git tag. There are no further steps: changes now are fixes and improvements to what is there.

## Owner requirements (non-negotiable)

1. **Polished and approachable:** simple by default, deep on demand.
2. **Drag-and-drop threats** onto the 2D scope or the 3D terrain, and the battery reacts live.
3. **Header analysis bar:** live stage counts, KPIs and a plain-language "Now" line, always visible.
4. **Easy to run:** a live demo on GitHub Pages, an animated clip in the README, and `npm install && npm run dev`.
5. **Concise docs:** few files, short sections, plain language first. Every model has a concept card.
6. **Safe and generic:** follow [SAFETY.md](SAFETY.md). Fictional equipment, textbook physics, procedural terrain.
7. **Fixed author credit.** The header shows "Created by Mohammad Alyounes" on every screen size and the footer "© 2026 Mohammad Alyounes", both from `AUTHOR` in `src/app/data/links.ts`. Never remove, hide or change them (a browser test guards this). Keep the credit in the README, `NOTICE`, `CITATION.cff` and the social preview card.

## Architecture rules

- **Pure sim core.** `src/sim/` is plain TypeScript: no DOM, React, Three.js or browser APIs.
- **Determinism.** Randomness only from the seeded RNG; never `Math.random()`, `Date.now()` or `performance.now()` in `src/sim/`.
- **Commands only.** The UI changes the sim only through recorded commands, and reads snapshots and events, so every run replays.
- **Units.** SI inside the sim; names outside carry their unit (`speedMps`, `altM`). Local East-North-Up metres, origin at the battery.

## Definition of done

1. **It works in the running app:** check it in headless Chromium, with screenshots for visual changes.
2. **Checks pass:** `npm run check` (lint, typecheck, unit tests, format); new physics has unit tests against known values.
3. **Docs updated:** a concept card in `docs/PHYSICS.md` for new physics, and a short `docs/DEVLOG.md` entry for anything beyond a small fix.
4. **Shipped:** commit and push. A release commit ends with a trailer such as `Step-Tag: v1.0.1`; once CI passes on `main`, it creates the tag and a GitHub Release from the devlog entry (`## v1.0.1 · Title`). `Step-Retag: true` moves an existing tag. The cloud session's git proxy rejects tag pushes, so never push tags by hand.

## Concept cards

The cards live in `docs/PHYSICS.md`, one `### ` heading each. The app parses them (`src/app/data/concepts.ts`) and a unit test keeps them short, so keep this exact format, with each fact on one line:

```
### <Concept> — <one-line hook>

<At most 2 plain sentences. Explain any jargon you use.>

- **Formula:** `<one line>`
- **Example:** <one concrete number example>
- **See it:** <where to see it in the sim>
```

## Commands

| Command                                      | Purpose                                                   |
| -------------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                                | Local dev server                                          |
| `npm run build` / `npm run preview`          | Production build / preview it                             |
| `npm test` / `npm run test:e2e`              | Unit tests (Vitest) / browser tests (Playwright)          |
| `npm run check`                              | Lint, typecheck, unit tests and format check              |
| `npm run format`                             | Prettier                                                  |
| `npm run media:screenshots`                  | Console screenshots (run `npm run build` first)           |
| `npm run media:gif -- --name … --selector …` | Animated GIF or WebP (`--format webp`) of part of the app |
| `npm run media:previews`                     | Social preview images                                     |

The media scripts accept `--query "seed=2026&t=75&paused=0"` for repeatable shots (options in `src/app/sim/params.ts` and `src/app/view/viewParams.ts`); `media:gif` can script the clip with `--actions`.

## Environment notes

- `@playwright/test` is pinned to the browser build preinstalled in the cloud environment; bump it together with `npx playwright install chromium`.
- TypeScript stays on 6.x until typescript-eslint supports 7.x.
- CI sets `BASE_PATH=/<repo>/` and `VITE_SITE_URL` for GitHub Pages; locally the app serves from `/`.

## Conventions

- **Code:** strict TypeScript, ESLint + Prettier, small pure functions in the sim.
- **Commits:** imperative mood, with a short area prefix (`sim:`, `app:`, `docs:`).
- **Commit author:** Mohammad Alyounes <fcbmoh98@gmail.com>. In a fresh clone, run `git config author.name "Mohammad Alyounes"` and `git config author.email "fcbmoh98@gmail.com"`, and leave the committer and signing as configured. Keep the Claude `Co-Authored-By` trailer.
- **Secrets:** never commit them.
