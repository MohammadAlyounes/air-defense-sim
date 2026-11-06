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

## One frame, start to finish

1. `requestAnimationFrame` calls `SimController`, which measures the real time since the last frame.
2. `FixedStepClock` multiplies that time by the playback speed and returns a whole number of 20 ms ticks.
3. The controller calls `Simulation.step()` that many times and keeps the last two snapshots.
4. The radar scope redraws from those two snapshots, blended by the clock's leftover fraction `α`.
5. The 3D canvas (React Three Fiber) renders on demand: a new frame from the controller, a change of view settings or a camera move asks for one drawing, and a paused simulation costs nothing. In each drawing, the camera moves first, then every aircraft marker places itself from the same blended snapshots (no React re-render), then the DOM labels are moved onto their anchors.
6. About ten times per second, the controller publishes a small UI state (clock, contacts, NOW line, event log) to a Zustand store; React components read it from there.

User actions (play, step, restart, and later "spawn here") call controller methods. Anything that changes the simulation itself becomes a `Command`, applied at the next tick and logged with its tick number.

## Selection and view state (Step 2)

What you look at is not simulation state. The selected aircraft, the camera, the height stretch and the labels live in a separate store (`useViewStore`), shared by the 3D view, the scope, the inspector and the event log, so selecting in one selects everywhere:

- **3D view:** clicking a model (or its tag) selects it; clicking empty ground clears the selection.
- **Scope:** a click picks the nearest visible echo (`pickEcho`) and follows that plot's ground-truth link to the aircraft. The radar picture itself never shows that link.
- **Event log:** each line carries the id of the aircraft it is about, so it doubles as the keyboard way to select.
- **Guard:** when the aircraft leaves, or the run restarts (ids start again from 1), the selection is cleared.

A URL can preset the view (`?select=3&camera=follow&heights=4`), next to the simulation options (`?seed=7&t=60`).

## Current state (Step 2)

| Path                    | Contents                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `src/sim/core`          | `FixedStepClock`, seeded `Rng` (sfc32), vectors, state hash.                                  |
| `src/sim/traffic.ts`    | Flight performance of every traffic type (single source for the palette too).                 |
| `src/sim/radar.ts`      | Search radar sweep: antenna angle and the "beam swept past this bearing" test.                |
| `src/sim/scenario.ts`   | Scenario traffic: entry points, straight courses, arrival times.                              |
| `src/sim/simulation.ts` | The engine: commands, ticks, events, snapshots, state hash, replay.                           |
| `src/app/sim`           | Driver (`SimController`), store, React provider, URL options, narrator, keyboard shortcuts.   |
| `src/app/views`         | Live radar scope (canvas, click to select), welcome card, loading and no-WebGL fallback.      |
| `src/app/views/3d`      | The 3D battlespace (loaded on demand): scene, aircraft, radar site, cameras, label layer.     |
| `src/app/view`          | View state shared by every view: selection, camera, heights, labels, URL view options.        |
| `src/app/analysis-bar`  | Header: pipeline chips, KPIs, NOW line. `null` values show "—" and the step that brings them. |
| `src/app/layout`        | Player bar (controls, seed, timeline) and footer.                                             |
| `src/app/panels`        | Inspector (live ground truth), event log (lines select), track table and telemetry.           |
| `src/app/components`    | Panel frame, tooltip, step badge, icons, concept-card popover.                                |
| `src/app/data`          | Plain, unit-tested data: stages, traffic text, roadmap, links.                                |
| `docs/concepts`         | Concept cards; copied into the README by `npm run docs:sync` and shown in the app.            |

The models and their equations are in [MODELS.md](MODELS.md).

## Deployment

Two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: lint, type-check, unit tests, format check, build, and browser tests in Playwright's container. When the head commit carries a `Step-Tag:` trailer, it also creates the step's tag and GitHub Release (`scripts/release-step.mjs`); a `Step-Retag: true` trailer moves an existing step release to the new commit.
- **Deploy** (`.github/workflows/deploy.yml`) runs after CI succeeds on `main`. It builds with two environment variables and publishes `dist/` to GitHub Pages:
  - `BASE_PATH=/<repo>/`, the sub-path GitHub Pages serves the site from;
  - `VITE_SITE_URL=https://<owner>.github.io/<repo>/`, the absolute URL that social preview tags need.
