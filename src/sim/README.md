# `src/sim` — the simulation core

This folder holds the physics and decision-making engine. It starts in Step 1.

Rules (enforced by ESLint, see `eslint.config.js`):

- **Pure TypeScript.** No React, Three.js, DOM or browser APIs. The same code runs in a
  Web Worker, in Node for tests, and in batch (Monte Carlo) runs.
- **Deterministic.** All randomness comes from the seeded random number generator. Never
  call `Math.random()`, `Date.now()` or `new Date()`. Simulation time comes from the
  simulation clock.
- **Commands in, snapshots out.** The UI changes the simulation only through commands, and
  reads it only through snapshots and events.
- **SI units inside** (metres, seconds, kilograms, radians).
