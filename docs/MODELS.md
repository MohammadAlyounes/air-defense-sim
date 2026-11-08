# Models

Every model in the simulator: its equations, its assumptions and its limits. This file grows with each step. All parameters are illustrative round numbers chosen for teaching (see [SAFETY.md](../SAFETY.md)).

## Frames and units

- **Frame:** local East-North-Up (ENU), in metres. `x` points east, `y` north, `z` up, and the origin is the battery.
- **Units:** SI inside the simulation (m, s, rad). Names that leave the simulation carry their unit, such as `speedMps` or `altitudeM`.
- **Bearings:** compass style, with 0 at north, π/2 at east, increasing clockwise: `β = atan2(x, y)`.
- **Earth model (Step 1):** flat. Earth curvature arrives with the radar horizon in Step 4.

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

## Scenario traffic (Steps 1 and 3)

| Setting          | Value                                                                      |
| ---------------- | -------------------------------------------------------------------------- |
| At the start     | 4 aircraft, placed 15–65% of the way along their course                    |
| Arrivals         | One new aircraft every 14–28 s while fewer than 7 are flying               |
| Entry point      | 38 km from the battery, at a random bearing                                |
| Course           | Straight: hostiles aim within 1.5 km of the battery, others within 14 km   |
| Mix (weights)    | Drone 3 · cruise-missile-like 2 · fast jet 2 · airliner 1.5 · friendly 1.5 |
| Leaving the area | Farther than 42 km from the battery and flying away                        |

Aim points use `r = R·√u` (with `u` uniform), which spreads them evenly over the disc instead of bunching them near the centre.

## Search radar (Steps 1 and 3)

- **Antenna:** turns clockwise from north, one turn every `T = 4 s`:

  ```
  θ(t) = 2π · frac(t / T)
  ```

- **Paint condition:** in each tick the beam sweeps the arc `(θ(t − Δt), θ(t)]`, which is 1.8° wide.
  - Every aircraft whose bearing lies in that arc, and whose ground range is within its detection range (below), produces one plot: its position at that tick.
  - Each bearing is swept exactly once per turn; a unit test checks this, including across north.
- **Contacts:** a track starts at the first paint and is dropped after two turns (8 s) without one (see Tracks).
- **Display:** an echo fades as `exp(−age / (0.85 T))`. Its size follows the target's radar size class (tiny, small, medium or large).

- **Detection range (Step 3):** from the radar equation, the signal-to-noise ratio falls as `σ / R⁴`, so the farthest detection range grows with the fourth root of the radar cross section `σ`:

  ```
  R_detect = min(40 km, 30 km × (σ / 1 m²)^(1/4))
  ```

  | Radar size | σ (illustrative) | Example             | First detected |
  | ---------- | ---------------- | ------------------- | -------------- |
  | tiny       | 0.01 m²          | small drone         | 9.5 km         |
  | small      | 0.1 m²           | cruise-missile-like | 16.9 km        |
  | medium     | 2 m²             | fast jet, friendly  | 35.7 km        |
  | large      | 40 m²            | airliner            | 40 km (capped) |

**Limitations:** inside its range a target is always detected, and positions are exact. There is no measurement noise, no missed detections, no false alarms, no radar horizon, no terrain masking and no clutter. Step 4 replaces this with probabilistic detection, noise, Earth curvature, terrain masking and clutter.

## Tracks (Step 3)

- **Tentative, then confirmed:** the first plot of an aircraft creates a track (T1, T2, …); the second confirms it.
- **Velocity:** the difference between the last two plots, divided by the time between them (4 s). Exact while plots are exact.
- **Position now:** the last plot moved on at the estimated velocity: `p(t) = p_last + v · (t − t_last)`.
- **Association:** each plot joins the track of the aircraft that produced it. This uses the plot's link to the truth, a stand-in until Step 5 adds gating and nearest-neighbour association.
- **Dropped** after two antenna turns without a plot, unless an interceptor is still being guided to it.

## Identification and threat evaluation (Step 3)

- **Identification:** 2 s after a track is confirmed, the identification check answers: friendly aircraft reply (friend), civil aircraft broadcast a civil transponder code (civil), anything else is treated as hostile. Step 5 adds mistakes, a kinematic classifier and air corridors.
- **Threat:** a hostile track whose straight course passes within 5 km of the battery, still approaching. With the track's ground position `p` and velocity `v`:

  ```
  t_cpa = −(p · v) / |v|²        d_cpa = |p + v · t_cpa|
  ```

  It is a threat if `d_cpa < 5 km` and `t_cpa > 0`. Threats are ranked by `t_cpa`, which is also the header's "next impact".

## Weapon assignment (Step 3)

- **Predicted intercept point:** the earliest flight time `t` at which the interceptor can be where the track will be: `0.9 · reach(t) ≥ |p + v · t|`. It is found by scanning in 0.25 s steps, then bisecting. The 0.9 keeps a margin for turns and climbs.
- **Rules:** assign only if `t ≤ 34 s` and the point is at least 1.5 km from the launcher. The most urgent unengaged threat gets the next launch slot: 1.5 s to prepare, at least 2 s between launches.
- **Launcher:** 12 ready rounds; while not full, one round is reloaded every 30 s.
- **Shoot-look-shoot:** one interceptor per target at a time; after a shot, the battery waits for the radar's next look.

## Interceptor and guidance (Step 3)

A generic, fictional interceptor, modelled as a point mass (round numbers chosen for teaching):

| Parameter       | Value                    |
| --------------- | ------------------------ |
| Launch speed    | 40 m/s, at least 15° up  |
| Boost           | 4 s at 180 m/s² (≈ 18 g) |
| Burnout speed   | 760 m/s (no drag yet)    |
| Steering limit  | 300 m/s² (≈ 30 g)        |
| Navigation gain | N = 4                    |
| Lethal radius   | 15 m                     |
| Maximum flight  | 40 s                     |

- **Reach** (straight line): `v₀ t + ½ a t²` during the boost, then `1,600 m + 760 m/s × (t − 4 s)`.
- **True proportional navigation:** with `r` from interceptor to target and `v_rel` the target's velocity relative to the interceptor,

  ```
  Ω = (r × v_rel) / |r|²        Vc = −(r · v_rel) / |r|        a = N · Vc · (Ω × r̂) + g
  ```

  The command (plus a term cancelling gravity) is kept sideways to the interceptor's velocity and limited to 30 g; thrust acts along the velocity during the boost; gravity always acts.

- **Integration:** semi-implicit Euler in 2 ms sub-steps (ten per tick). Within each sub-step the target moves at constant velocity.
- **Fuze:** in each sub-step both paths are straight lines, so the closest approach has a closed form. With the relative position `r₀` at the start and `r₁` at the end, and `Δr = r₁ − r₀`:

  ```
  s* = clamp(−(r₀ · Δr) / |Δr|², 0, 1)        miss = |r₀ + s* · Δr|
  ```

  When `s* < 1` the two have stopped closing: the fuze goes off. Within 15 m the target is destroyed; otherwise the shot is a miss. The fuze arms after 1 s of flight.

- **Self-destruct:** after 40 s of flight, on hitting the ground, or if the target is gone.

**Limitations:** no air drag (Step 4), no guidance phases (Step 6) and a perfect tracking radar: the interceptor is guided to the real target. Against non-maneuvering targets with perfect information, proportional navigation hits almost dead centre.

## Kill assessment and leaks (Step 3)

- **Kill assessed:** after a hit, the next time the beam sweeps over the track's predicted position and finds no echo, the kill is confirmed and the track dropped (at most one turn, 4 s, later).
- **Target survived:** if the beam finds the target again after a miss, the engagement closes and the track can be assigned again.
- **Leak:** a hostile that comes within 2 km of the battery got through.

## Drawing the 3D view (Step 2)

The 3D view only draws; it never changes the simulation.

- **Scene coordinates:** kilometres with `y` up, as three.js expects: `scene = (east, up × stretch, −north) / 1000`. North points into the screen in the default camera.
- **Height stretch:** `stretch` is 1, 2 (default) or 4, applied only when drawing. Labels and the inspector always show true altitudes.
- **Constant on-screen size:** every frame, each aircraft model and the radar site is scaled to cover a fixed number of pixels:

  ```
  s = 2 · d · tan(θ/2) · pixels / (screen height · zoom)
  ```

  where `d` is the distance from the camera and `θ` the vertical field of view.

- **Smooth motion:** positions are blended between the last two ticks with the clock's `α`, like the scope's antenna angle.
- **Trails:** the simulation records each aircraft's position every 0.5 s (25 ticks) and keeps the last 30 s (60 points). Trails are part of the simulation state, so replays (and, later, rewinds) show exactly the same trails. A point's brightness falls linearly with its age.
- **Search beam:** a vertical fan from the antenna out to 40 km and 20° up, turning with the blended antenna angle; its trail on the ground matches the scope's sweep.

**Limitations:** the 20° beam is a drawing aid; the Step 1 radar has no elevation limit. The ground is flat until procedural terrain arrives in Step 4.
