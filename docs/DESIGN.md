# Design

What the simulator is for and how its code fits together. The physics is in [PHYSICS.md](PHYSICS.md), the build history in [DEVLOG.md](DEVLOG.md).

## Goal

An open-source browser sandbox where anyone can drag a threat onto a map and watch, control and question how a generic air-defense system turns radar blips into decisions.

- **For the public and students:** a quick "wow", obvious interactions and plain-language narration.
- **For specialists and teachers:** correct textbook models, visible math and clean, tested code.

A learner should come away knowing why low flyers hide, why small targets are seen late, why raw radar data must be filtered, why identification matters more than shooting, what saturation does, and why outcomes are probabilities.

## The console

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ANALYSIS BAR: pipeline counts · key numbers · rules · NOW line · version │
├───────────┬───────────────────────────────┬──────────────────────────────┤
│ THREAT    │ 3D TRUTH VIEW                 │ 2D SENSOR SCOPE              │
│ PALETTE   │ (drop threats here)           ├──────────────────────────────┤
│           │                               │ TRACK TABLE                  │
│           ├───────────────────────────────┴───┬──────────────────────────┤
│           │ INSPECTOR "WHY?"                  │ EVENT LOG                │
│           ├───────────────────────────────────┴──────────────────────────┤
│           │ PLAYER BAR: play · step · speed · clock · seed · restart     │
└───────────┴──────────────────────────────────────────────────────────────┘
```

- **Palette:** small drone, drone swarm, cruise-missile-like target, fast jet, friendly aircraft and civil airliner. Drag a card onto either view, tap a card and then the map, or press Enter twice. A ghost shows the route, the flight time and when the radar will first see it.
- **Analysis bar:** a live count for each stage of the loop, threats and interceptors, fire channels, the next impact, the rules (clickable) and a NOW line in plain words.
- **One color and shape per identity:** hostile red diamond, suspect orange diamond, unknown yellow quatrefoil, friend blue circle, civil green square.
- **Phones:** the panels stack and threats are placed by tapping.

## Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│ UI (React): analysis bar · palette · 3D view · scope · panels    │
│        ▲ snapshots + events                   │ commands         │
│        │                                      ▼                  │
│ SIM ENGINE (pure TypeScript, deterministic, 50 Hz, worker-ready) │
│  movers → radar → tracker → classify/ID → threat evaluation →    │
│  weapon assignment → guidance → fuze → kill assessment           │
└──────────────────────────────────────────────────────────────────┘
```

|            | `src/app`                          | `src/sim`                     |
| ---------- | ---------------------------------- | ----------------------------- |
| Purpose    | Everything you see and click       | Physics and decision-making   |
| Allowed    | React, Three.js, DOM, browser APIs | Plain TypeScript only         |
| Time       | Wall clock (for rendering)         | Simulation clock (fixed step) |
| Randomness | Anything                           | Seeded generator only         |
| Talks via  | Commands                           | Snapshots and events          |

ESLint enforces the `src/sim` column: no UI imports, browser globals, `Math.random()`, `Date.now()` or `new Date()`.

**Determinism.** The same seed and the same commands, each stamped with its tick, give exactly the same run. That gives exact replays (`Simulation.replay()`), shareable moments (`?seed=7&t=60`), exact tests and fair comparisons.

**One frame.** `SimController` turns real time × speed into whole 20 ms ticks, runs them, and keeps the last two snapshots. The scope and the 3D view blend those two snapshots; the 3D view draws only when something changes. About ten times a second a small UI state goes to a Zustand store for the panels.

**One tick** of `Simulation.step()`, always in this order:

1. Commands (such as a drop) and scenario arrivals.
2. Interceptors fly in ten 2 ms sub-steps, with the closest-approach fuze.
3. Aircraft move, then the radar sweeps: line of sight, detection draw, noise and false alarms.
4. Tracks update from the last 0.2 s of plots (gating, association, Kalman filter).
5. The command node classifies, identifies, evaluates threats and, within the rules and free fire channels, proposes or launches shots.
6. Reloads, leaks and departures.

The command node reads only its tracks, never the true positions or types. The truth is used by the physics and to reveal afterwards what a target really was.

**Shared state.** The terrain is generated once from its own seed and shared by the simulation, the scope, the 3D mesh and the placement readout; the wind comes from each run's seed. What you look at (selection, camera, heights, labels) lives in a separate view store, so selecting in one view selects everywhere.

## Where things are

| Path                    | Contents                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sim/core`          | Fixed-step clock, seeded random numbers (sfc32), vectors, state hash                                                                                                |
| `src/sim/*.ts`          | One model per file: traffic, terrain, propagation, atmosphere, flight, radar, kalman, tracker, classify, airspace, assets, c2 (command node), interceptor, scenario |
| `src/sim/simulation.ts` | The engine: commands, the loop each tick, events, snapshots, replay                                                                                                 |
| `src/app/sim`           | Driver, store, URL options, narrator, keyboard shortcuts                                                                                                            |
| `src/app/placement`     | Drag-and-drop: drop zones, placement store, ghost readout                                                                                                           |
| `src/app/views`         | Radar scope, result and approval cards; `3d/` holds the 3D battlespace                                                                                              |
| `src/app/panels`        | Inspector, track table, event log                                                                                                                                   |
| `src/app/analysis-bar`  | The header                                                                                                                                                          |
| `src/app/data`          | Plain data: stages, traffic text, concept cards, build history, links                                                                                               |
| `e2e`                   | Browser tests (Playwright)                                                                                                                                          |
| `scripts`               | Release notes and README media (screenshots, clips, preview images)                                                                                                 |

## Toolkit

TypeScript (strict), React 19 and Vite 8; Three.js with React Three Fiber for 3D, loaded in its own chunk; a custom canvas for the scope; Zustand for state; Tailwind CSS 4, Radix UI and Lucide for the interface; Vitest and Playwright for tests. Unity, Godot, CesiumJS (real geography) and Rust/WASM were left out because they make the project heavier or harder to fork.

## Deployment and releases

- **CI** (`.github/workflows/ci.yml`) runs lint, type-check, unit tests, format check, build and browser tests on every push and pull request.
- **Deploy** (`.github/workflows/deploy.yml`) publishes `dist/` to GitHub Pages after CI passes on `main`, with `BASE_PATH=/<repo>/` and `VITE_SITE_URL` set for the Pages URL.
- **Releases:** when a push to `main` carries a `Step-Tag:` trailer, CI creates that tag and a GitHub Release, with notes from the matching `docs/DEVLOG.md` entry (`scripts/release-step.mjs`). `Step-Retag: true` moves an existing release.
