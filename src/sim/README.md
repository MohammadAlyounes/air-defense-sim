# `src/sim` — the simulation engine

The physics and decision-making engine. The app imports it only through `index.ts`.

| File            | What it does                                                             |
| --------------- | ------------------------------------------------------------------------ |
| `core/clock.ts` | `FixedStepClock`: real time in, whole 20 ms ticks out.                   |
| `core/rng.ts`   | `Rng`: seeded sfc32 random numbers, with save and restore.               |
| `core/vec.ts`   | East-North-Up vectors, ground range and compass bearing.                 |
| `traffic.ts`    | Flight performance of every traffic type.                                |
| `radar.ts`      | Search radar sweep: antenna angle and "did the beam pass this bearing?". |
| `scenario.ts`   | Scenario traffic: entry points, courses and arrival times.               |
| `simulation.ts` | `Simulation`: commands, ticks, events, snapshots, state hash, replay.    |
| `types.ts`      | Shared types: aircraft, plots, events, commands, snapshots.              |

Rules (enforced by ESLint, see `eslint.config.js`):

- **Pure TypeScript.** No React, Three.js, DOM or browser APIs. The same code runs in a
  Web Worker, in Node for tests, and in batch (Monte Carlo) runs.
- **Deterministic.** All randomness comes from the seeded random number generator. Never
  call `Math.random()`, `Date.now()` or `new Date()`. Simulation time comes from the
  simulation clock.
- **Commands in, snapshots out.** The UI changes the simulation only through commands, and
  reads it only through snapshots and events.
- **SI units inside** (metres, seconds, radians).

Equations and limits of every model: [`docs/MODELS.md`](../../docs/MODELS.md).
