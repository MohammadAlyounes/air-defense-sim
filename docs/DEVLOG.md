# Devlog

One short entry per step: what was built, the decisions behind it, and what comes next.

## Step 0 · Launchpad (2026-11-06)

**Built**

- Project scaffold: Vite 8, React 19, TypeScript 6 (strict), Tailwind CSS 4, ESLint, Prettier, Vitest 5 and Playwright.
- Console shell: the header analysis bar (seven-stage pipeline, KPIs, plain-language Now line), the threat palette with six traffic types, an animated radar scope, a 3D battlespace illustration, and placeholders for the track table, inspector, telemetry, event log and timeline. Each placeholder names the step that brings it to life.
- CI/CD: lint, type-check, unit tests, format check, build and browser tests on every push; `main` deploys to GitHub Pages.
- Media scripts: README screenshots and social preview images, rendered with Playwright.
- Docs: README, project plan, architecture, safety, contributing and CLAUDE.md.
- Author credit: "Created by Mohammad Alyounes" is a fixed part of the header on every screen size. It also appears in the footer (© 2026), the README, the social preview card, `NOTICE` and `CITATION.cff`.

**Decisions**

- **TypeScript 6, not 7.** TypeScript 7 (the native compiler) is out, but typescript-eslint supports TypeScript only up to 6.0 today. We will move when the linter does.
- **Playwright pinned to 1.63.0,** the version whose browser build is preinstalled in the cloud dev environment. In CI, browser tests run inside Playwright's official `v1.63.0-noble` container, so nothing is downloaded (installing Chromium on a bare runner took over eight minutes on the first run).
- **CI and deploy are separate workflows.** `CI` checks the code; `Deploy` publishes to GitHub Pages only after CI passes on `main`. The CI badge therefore reports code health, not hosting.
- **Tags and releases come from CI.** This cloud session can push branches but its git proxy rejects tag pushes (HTTP 403). The final commit of each step carries a `Step-Tag:` trailer, and CI creates the tag and a GitHub Release with notes taken from this devlog. Adding `Step-Retag: true` moves an existing step release to the new commit; Step 0 used it once, when the author credit was added.
- **License stays MIT** (owner's choice): maximum reuse. Attribution rests on the copyright notice in LICENSE, plus `NOTICE` and `CITATION.cff`. In this repository, the credit is protected by a browser test and `CODEOWNERS`.
- **Commits are authored by Mohammad Alyounes,** with Claude as co-author. Commits stay signed, so GitHub keeps showing them as verified.
- **Determinism is enforced by the linter.** `src/sim` cannot import UI libraries or call `Math.random()`, `Date.now()`, `new Date()` or browser APIs.
- **The header belongs to the analysis bar.** Play, pause, step and the clock live in the bottom player bar, next to the timeline, like a video player.
- **Deploy paths come from the environment.** CI sets `BASE_PATH=/<repo>/` and `VITE_SITE_URL`, so forks deploy to their own GitHub Pages without code changes.
- **Codespaces first.** The README offers a one-click GitHub Codespaces button (devcontainer with Node 22). A StackBlitz button will be added once it is verified to run Vite 8.

**Next: Step 1 · Simulation core.** A deterministic fixed-step clock, seeded random numbers, entities and events; play, pause, step and speed controls; and the first target moving on the 2D scope.
