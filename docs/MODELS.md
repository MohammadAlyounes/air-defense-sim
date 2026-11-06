# Models

Every model in the simulator: its equations, its assumptions and its limits. This file grows with each step. All parameters are illustrative round numbers chosen for teaching (see [SAFETY.md](../SAFETY.md)).

## Frames and units

- **Frame:** local East-North-Up (ENU), in metres. `x` points east, `y` north, `z` up, and the origin is the battery.
- **Units:** SI inside the simulation (m, s, rad). Names that leave the simulation carry their unit, such as `speedMps` or `altitudeM`.
- **Bearings:** compass style, with 0 at north, π/2 at east, increasing clockwise: `β = atan2(x, y)`.
- **Earth model (Step 1):** flat. Earth curvature arrives with the radar horizon in Step 5.

## Time and randomness (Step 1)

- **Fixed time step:** the simulation advances in ticks of `Δt = 1/50 s = 20 ms`.
  - Each animation frame adds `elapsed real time × speed` to an accumulator and runs one tick per whole 20 ms in it.
  - A frame processes at most 0.25 s of real time, so the simulation slows down after a stall instead of freezing.
  - The renderer blends the last two ticks with `α = leftover / Δt`.
- **Random numbers:** a single sfc32 generator, seeded through splitmix32.
  - It keeps 128 bits of state, can be saved and restored, and passes PractRand.
  - Normal samples use Box-Muller, with two uniform draws per sample and nothing cached, so the generator state alone determines what comes next.
- **Determinism:** the same seed and the same commands at the same ticks give the same run, bit for bit, within one JavaScript engine. Different engines may round `Math.sin`, `Math.atan2` and similar functions differently in the last bit.

## Kinematics (Step 1)

Aircraft fly at constant velocity:

```
p(t + Δt) = p(t) + v · Δt
```

For constant velocity one Euler step per tick is exact. The test suite checks that a fast jet at 340 m/s moves exactly 340 m in 50 ticks.

**Limitations:** no turns, climbs, wind or drag yet. Those arrive in Step 4 with the 3-DOF point-mass model.

## Scenario traffic (Step 1)

| Setting          | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| At the start     | 4 aircraft, placed 15–65% of the way along their course                    |
| Arrivals         | One new aircraft every 14–28 s while fewer than 7 are flying               |
| Entry point      | 38 km from the battery, at a random bearing                                |
| Course           | Straight, toward a random point within 14 km of the battery                |
| Mix (weights)    | Drone 3 · cruise-missile-like 2 · fast jet 2 · airliner 1.5 · friendly 1.5 |
| Leaving the area | Farther than 42 km from the battery and flying away                        |

Aim points use `r = R·√u` (with `u` uniform), which spreads them evenly over the disc instead of bunching them near the centre.

## Search radar (Step 1)

- **Antenna:** turns clockwise from north, one turn every `T = 4 s`:

  ```
  θ(t) = 2π · frac(t / T)
  ```

- **Paint condition:** in each tick the beam sweeps the arc `(θ(t − Δt), θ(t)]`, which is 1.8° wide.
  - Every aircraft whose bearing lies in that arc, and whose ground range is at most 40 km, produces one plot: its position at that tick.
  - Each bearing is swept exactly once per turn; a unit test checks this, including across north.
- **Contacts:**
  - A contact is new on its first paint.
  - It is lost after two turns (8 s) without a paint, or when the aircraft leaves the area.
- **Display:** an echo fades as `exp(−age / (0.85 T))`. Its size follows the target's radar size class (tiny, small, medium or large).

**Limitations:** detection is perfect in Step 1. There is no measurement noise, no missed detections, no false alarms, no radar horizon, no terrain masking and no clutter. Step 5 replaces this with the radar range equation, radar cross section, probabilistic detection, noise, Earth curvature, terrain masking and clutter.
