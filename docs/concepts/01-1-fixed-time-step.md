### Fixed time step — why every run can be replayed exactly

The simulation advances in identical 20 ms ticks (50 per second), no matter how fast your screen redraws. Each tick runs the same equations with the same seeded random numbers, so the same seed and the same inputs always reproduce exactly the same run. That is what makes pausing, single-stepping, replays and fair comparisons possible.

- **Formula:** `position(t + Δt) = position(t) + velocity × Δt`, with `Δt = 1/50 s`
- **Example:** a small drone flying at 40 m/s moves exactly 0.8 m per tick, whether you watch at ¼× or at 16×.
- **See it:** pause, then press Step: the clock moves by one 20 ms tick. Press Restart and the same blips reappear at the same moments.

<!-- more -->

## Going deeper

**Real time versus simulated time.** The browser draws frames whenever it can (about 60 per second, sometimes fewer). Each frame, the app measures how much real time has passed, multiplies it by the playback speed, and adds it to an _accumulator_. While the accumulator holds at least 20 ms, it runs one tick and subtracts 20 ms. The leftover is carried to the next frame. The simulation never sees the frame rate, only whole ticks.

**Smooth motion.** Because ticks and frames do not line up, the renderer draws a blend of the last two ticks: `shown = previous + α × (current − previous)`, where `α` is the leftover time divided by 20 ms. Motion looks smooth at any speed, and the simulation still only ever advances in exact steps.

**No freezing after a stall.** If the tab sleeps for a while, the app processes at most a quarter of a second of real time per frame. The simulation briefly runs slower than real time instead of trying to catch up thousands of ticks at once.

**Seeded randomness.** Scenario traffic is "random", but every random number comes from one seeded generator (sfc32). It produces the same sequence for the same seed, and its whole state is four 32-bit numbers, so a run can be saved and replayed exactly. The simulation core is not allowed to use `Math.random()` or read the clock; the linter rejects both.

**Commands, not edits.** The interface never changes the simulation directly. It sends commands (such as "spawn a drone here"), which are applied at the start of the next tick and logged with that tick number. Seed plus command log is a complete recording of a run.
