# Architecture

This document grows with the project. It explains how the pieces fit together and the rules that keep them that way.

## The big picture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│ UI (React): Analysis Bar · Threat Palette · 3D Truth View ·      │
│   2D Sensor Scope · Track Table · Inspector "Why?" · Event Log · │
│   Telemetry · Lessons · Timeline                                 │
│        ▲ snapshots + events (~30 Hz)          │ commands         │
│        │                                      ▼                  │
│ SIM ENGINE (Web Worker, pure TypeScript, deterministic, 50 Hz)   │
│  Environment → Movers → Sensors → Tracker → Classify/ID →        │
│  Threat Eval → Weapon Assign → Launch/Guidance → Fuze →          │
│  Kill Assessment → Recorder (snapshots + event stream)           │
└──────────────────────────────────────────────────────────────────┘
```

## Two worlds, one boundary

|                        | `src/app`                          | `src/sim`                     |
| ---------------------- | ---------------------------------- | ----------------------------- |
| Purpose                | Everything you see and click       | Physics and decision-making   |
| Allowed                | React, Three.js, DOM, browser APIs | Plain TypeScript only         |
| Time                   | Wall clock (for rendering)         | Simulation clock (fixed step) |
| Randomness             | Anything                           | Seeded generator only         |
| Talks to the other via | Commands                           | Snapshots and events          |

ESLint enforces the right-hand column: inside `src/sim`, importing UI libraries, using browser globals, or calling `Math.random()`, `Date.now()` or `new Date()` is an error.

## Why determinism matters

Give the simulation the same scenario, the same random seed and the same list of user commands (each stamped with the tick it happened on), and it produces exactly the same run. That buys four things:

- **Tiny save files.** A saved run is its setup plus a command log, not a recording.
- **Rewind and branch.** Jump back to a snapshot, change one decision, re-simulate.
- **Trustworthy tests.** A test can assert the exact state after N ticks.
- **Monte Carlo.** Change only the seed to explore the odds.

## Current state (Step 0)

| Folder                 | Contents                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/app/analysis-bar` | Header: pipeline chips, KPI strip, Now line. Driven by a `SituationSummary` object (standby until Step 1). |
| `src/app/palette`      | Threat palette cards, built from `data/threatCatalog.ts`.                                                  |
| `src/app/views`        | 3D battlespace illustration and radar scope preview.                                                       |
| `src/app/panels`       | Track table, inspector, telemetry and event log panels.                                                    |
| `src/app/layout`       | Player bar (transport controls and timeline) and footer.                                                   |
| `src/app/components`   | Shared pieces: panel frame, tooltip, step badge, icons.                                                    |
| `src/app/data`         | Plain, unit-tested data: defense-loop stages, traffic catalog, roadmap, links.                             |
| `src/sim`              | Rules only for now. The engine starts in Step 1.                                                           |

## Deployment

Two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: lint, type-check, unit tests, format check, build, and browser tests in Playwright's container. When the head commit carries a `Step-Tag:` trailer, it also creates the step's tag and GitHub Release (`scripts/release-step.mjs`); a `Step-Retag: true` trailer moves an existing step release to the new commit.
- **Deploy** (`.github/workflows/deploy.yml`) runs after CI succeeds on `main`. It builds with two environment variables and publishes `dist/` to GitHub Pages:
  - `BASE_PATH=/<repo>/`, the sub-path GitHub Pages serves the site from;
  - `VITE_SITE_URL=https://<owner>.github.io/<repo>/`, the absolute URL that social preview tags need.
