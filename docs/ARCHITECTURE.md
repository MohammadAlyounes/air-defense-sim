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
6. About ten times per second, the controller publishes a small UI state (clock, stage counts and key numbers, NOW line, event log, result cards, track table) to a Zustand store; React components read it from there.

User actions (play, step, restart, drop a threat) call controller methods. Anything that changes the simulation itself becomes a `Command`, applied at the next tick and logged with its tick number. While paused, the controller runs that tick at once, so a dropped threat appears straight away.

## One tick of the defense loop (Step 3)

`Simulation.step()` runs the loop in a fixed order, so every run is reproducible:

1. **Commands** (for example `spawnTraffic` from a drop) and scenario arrivals.
2. **Interceptors fly** first, in ten 2 ms sub-steps against the targets' start-of-tick motion, with the analytic closest-approach fuze.
3. **Aircraft move**, then the **search radar sweeps** and paints what it can detect.
4. **Tracks** update from the new plots: new contacts, confirmations, kill assessments, lost tracks.
5. The **command node** identifies, evaluates threats, assigns launch slots and launches.
6. **Reloads, leaks** and departures; old plots and effects are pruned.

The command node works only from tracks (`src/sim/c2.ts`, `src/sim/tracker.ts`): it never reads an aircraft's true position. The truth is used only by the physics (interceptors meet the real target, the radar paints real positions) and to reveal what a target was after the engagement.

## Placing traffic (Step 3)

Drag-and-drop lives in `src/app/placement`. Each view registers a **drop zone**: a function that turns a screen point into a ground point (the scope inverts its drawing transform; the 3D view casts a ray from the camera onto the ground). While a card is being placed, a small store holds the type, altitude and target point, and both views draw the ghost from it. A drop ends in one `spawnTraffic` command aimed at the battery, so it is recorded and replays like everything else.

## Selection and view state (Step 2)

What you look at is not simulation state. The selected aircraft, the camera, the height stretch and the labels live in a separate store (`useViewStore`), shared by the 3D view, the scope, the inspector and the event log, so selecting in one selects everywhere:

- **3D view:** clicking a model (or its tag) selects it; clicking empty ground clears the selection.
- **Scope:** a click picks the nearest visible echo (`pickEcho`) and follows that plot's ground-truth link to the aircraft. The radar picture itself never shows that link.
- **Event log:** each line carries the id of the aircraft it is about, so it doubles as the keyboard way to select.
- **Guard:** when the aircraft leaves, or the run restarts (ids start again from 1), the selection is cleared.

A URL can preset the view (`?select=3&camera=follow&heights=4`), next to the simulation options (`?seed=7&t=60`).

## Current state (Step 3)

| Path                     | Contents                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `src/sim/core`           | `FixedStepClock`, seeded `Rng` (sfc32), vectors, state hash.                                  |
| `src/sim/traffic.ts`     | Flight performance of every traffic type (single source for the palette too).                 |
| `src/sim/radar.ts`       | Search radar: antenna angle, the sweep test and detection range by radar cross section.       |
| `src/sim/tracker.ts`     | Track estimate: where a track is now, from its last echo and velocity.                        |
| `src/sim/c2.ts`          | Command node: identification, threat evaluation, predicted intercept point, firing solution.  |
| `src/sim/interceptor.ts` | Interceptor point mass: boost and coast, proportional navigation, closest-approach fuze.      |
| `src/sim/scenario.ts`    | Scenario traffic: entry points, straight courses, arrival times.                              |
| `src/sim/simulation.ts`  | The engine: commands, the defense loop each tick, events, snapshots, state hash, replay.      |
| `src/app/sim`            | Driver, store, provider, URL options, narrator, defense summary, keyboard shortcuts.          |
| `src/app/placement`      | Drag-and-drop: drop zones, placement store, card gestures, ghost readout.                     |
| `src/app/views`          | Radar scope (tracks, interceptors, drops), result cards, welcome card, fallback.              |
| `src/app/views/3d`       | 3D battlespace (on demand): aircraft, interceptors, effects, launcher, ghost, cameras.        |
| `src/app/view`           | View state shared by every view: selection, camera, heights, labels, URL view options.        |
| `src/app/analysis-bar`   | Header: pipeline chips, KPIs, NOW line. `null` values show "—" and the step that brings them. |
| `src/app/layout`         | Player bar (controls, seed, timeline) and footer.                                             |
| `src/app/panels`         | Inspector (truth and defense status), live track table, event log, telemetry placeholder.     |
| `src/app/components`     | Panel frame, tooltip, step badge, icons, concept-card popover.                                |
| `src/app/data`           | Plain, unit-tested data: stages, traffic text, roadmap, links.                                |
| `docs/concepts`          | Concept cards; copied into the README by `npm run docs:sync` and shown in the app.            |

The models and their equations are in [MODELS.md](MODELS.md).

## Deployment

Two GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`) runs on every push and pull request: lint, type-check, unit tests, format check, build, and browser tests in Playwright's container. When the head commit carries a `Step-Tag:` trailer, it also creates the step's tag and GitHub Release (`scripts/release-step.mjs`); a `Step-Retag: true` trailer moves an existing step release to the new commit.
- **Deploy** (`.github/workflows/deploy.yml`) runs after CI succeeds on `main`. It builds with two environment variables and publishes `dist/` to GitHub Pages:
  - `BASE_PATH=/<repo>/`, the sub-path GitHub Pages serves the site from;
  - `VITE_SITE_URL=https://<owner>.github.io/<repo>/`, the absolute URL that social preview tags need.
