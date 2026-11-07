# Models

Every model in the simulator: its equations, its assumptions and its limits. This file grows with each step. All parameters are illustrative round numbers chosen for teaching (see [SAFETY.md](../SAFETY.md)).

## Frames and units

- **Frame:** local East-North-Up (ENU), in metres. `x` points east, `y` north, `z` up, and the origin is the battery.
- **Units:** SI inside the simulation (m, s, rad). Names that leave the simulation carry their unit, such as `speedMps` or `altitudeM`.
- **Bearings:** compass style, with 0 at north, π/2 at east, increasing clockwise: `β = atan2(x, y)`.
- **Earth model (Step 4):** positions live on a flat local map, accurate to a few metres over 40 km. Earth curvature (the 4/3 Earth model) is applied to every line of sight, which gives the radar horizon.
- **Heights:** metres above the battery's ground, which is the datum ("sea level" in the UI). Terrain heights use the same datum.

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

**Terrain following (Step 4):** ground speed and heading stay constant, and the height follows the terrain:

- AGL traffic (drones, cruise-missile-like targets) aims for its set height above the highest ground at its position and 1.5 s and 3 s ahead.
- MSL traffic (jets, friendly aircraft, airliners) keeps its altitude, but climbs to stay at least 150 m above the hills.
- Height changes are limited by each type's climb rate (8 m/s for a drone, 60 m/s for a cruise-missile-like target, 150 m/s for a jet), and nothing flies lower than 10 m above the ground. The vertical speed is part of the aircraft's velocity.

**Limitations:** no turns, wind or evasive manoeuvres (on the "Later" list).

## Terrain (Step 4)

- **Procedural and fictional:** value noise on a hashed integer lattice (smootherstep interpolation), four octaves each turned by a different angle, plus one ridged octave `1 − |2n − 1|` cubed for sharp crests. Seed 7; no real place.
- **Shape:** flat within 3 km of the battery, then blended into the hills over 6 km (smoothstep). Heights reach about 750 m.
- **Storage:** a 257 × 257 grid over ±50 km (390 m spacing), sampled bilinearly. It is generated once (about 66,000 noise evaluations) and shared by the simulation, the scope, the 3D view and the placement readout.

## Line of sight, horizon and coverage (Step 4)

- **Effective Earth radius:** `R = 4/3 × 6,371 km = 8,495 km`, the textbook allowance for radio waves bending down in the lower atmosphere.
- **Curvature drop:** at ground distance `d`, the Earth's surface lies `d² / 2R` below the flat map (94 m at 40 km).
- **Line of sight:** sample the straight line from the antenna (12 m above the site) to the target every 150 m of ground distance. With every height lowered by its curvature drop, the line is blocked if the ground rises above it anywhere. If the smooth Earth alone blocks it, the target is **below the horizon**; otherwise, if a hill blocks it, it is **masked by terrain**.
- **Smooth-Earth horizon:** `d = √(2R·h₁) + √(2R·h₂) ≈ 4.12 km × (√h₁ + √h₂)`.
- **Coverage map:** for each of 720 bearings, walk out in 200 m steps, keeping the steepest slope `(h − d²/2R − h_antenna) / d` seen so far. The lowest visible height at distance `d` is `h_antenna + slope_max · d + d²/2R`, minus the ground height there. The scope and the 3D view shade where that is above the chosen target height (50 m, 300 m or 1 km).

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

## Search radar (Steps 1, 3 and 4)

- **Antenna:** turns clockwise from north, one turn every `T = 4 s`:

  ```
  θ(t) = 2π · frac(t / T)
  ```

- **Paint condition:** in each tick the beam sweeps the arc `(θ(t − Δt), θ(t)]`, which is 1.8° wide.
  - Every aircraft whose bearing lies in that arc, and whose ground range is within its detection range (below), produces one plot: its position at that tick.
  - Each bearing is swept exactly once per turn; a unit test checks this, including across north.
- **Contacts:** a track starts at the first paint (see Tracks).
- **Display:** an echo fades as `exp(−age / (0.85 T))`. Its size follows the target's radar size class (tiny, small, medium or large).

- **Detection range (Step 3):** from the radar equation, the signal-to-noise ratio falls as `σ / R⁴`, so the farthest detection range grows with the fourth root of the radar cross section `σ`:

  ```
  R_detect = min(40 km, 30 km × (σ / 1 m²)^(1/4))
  ```

  | Radar size | σ (illustrative) | Example             | 50% range      |
  | ---------- | ---------------- | ------------------- | -------------- |
  | tiny       | 0.01 m²          | small drone         | 9.5 km         |
  | small      | 0.1 m²           | cruise-missile-like | 16.9 km        |
  | medium     | 2 m²             | fast jet, friendly  | 35.7 km        |
  | large      | 40 m²            | airliner            | 40 km (capped) |

- **Line of sight (Step 4):** an aircraft is painted only if the line of sight is clear (see above).
- **Detection probability (Step 4):** the "first detected" ranges above are now the ranges at which a target is seen on half of the looks. The signal-to-noise ratio uses the slant range `R` from the antenna:

  ```
  SNR = SNR₅₀ · σ · (30 km / R)⁴        Pd = Pfa^(1 / (1 + SNR))   (Swerling 1)
  ```

  With `Pfa = 10⁻⁶`, `SNR₅₀ = ln(Pfa) / ln(0.5) − 1 ≈ 18.9` (12.8 dB). One random draw per look decides the detection.

- **Measurement noise (Step 4):** slant range, bearing and elevation each get Gaussian noise (σ = 30 m, 0.15°, 0.25°), then turn back into a position. The plot's position, bearing and range are the measured ones.
- **False alarms (Step 4):** `λ = Pfa × 600,000 cells = 0.6` per antenna turn. In each tick, with probability `λ · Δt / T`, one false plot appears in the swept arc, uniform over the area between 1 km and 40 km, at an elevation of 0–15°.

**Limitations:** no clutter, no Doppler processing, no jamming, no elevation limit to the beam. Detection does not depend on aspect or weather.

## Tracks (Step 3)

- **Tentative, then confirmed:** the first plot of an aircraft creates a track (T1, T2, …); the second confirms it. A tentative track whose next look brings no plot (after 1.25 turns) is dropped: most often a false alarm.
- **Velocity:** the difference between the last two plots, divided by the time between them (4 s). Noisy since Step 4: a 0.15° bearing error at 30 km is 80 m, so velocities can be off by tens of m/s. Step 5 adds a Kalman filter.
- **Position now:** the last plot moved on at the estimated velocity: `p(t) = p_last + v · (t − t_last)`.
- **Association:** each plot joins the track of the aircraft that produced it. This uses the plot's link to the truth, a stand-in until Step 5 adds gating and nearest-neighbour association. A false alarm has no source, so it always starts a new tentative track.
- **Dropped:** a confirmed track after three antenna turns (12 s) without a plot, unless an interceptor is still being guided to it or has just hit it (it is then kept until the kill assessment).

## Identification and threat evaluation (Step 3)

- **Identification:** 2 s after a track is confirmed, the identification check answers: friendly aircraft reply (friend), civil aircraft broadcast a civil transponder code (civil), anything else is treated as hostile. Step 6 adds mistakes.
- **Threat:** a hostile track whose straight course passes within 5 km of the battery, still approaching. With the track's ground position `p` and velocity `v`:

  ```
  t_cpa = −(p · v) / |v|²        d_cpa = |p + v · t_cpa|
  ```

  It is a threat if `d_cpa < 5 km` and `t_cpa > 0`. Threats are ranked by `t_cpa`, which is also the header's "next impact".

## Weapon assignment (Step 3)

- **Predicted intercept point:** the earliest flight time `t` at which the interceptor can be where the track will be: `0.9 · reach(t) ≥ |p + v · t|`. It is found by scanning in 0.25 s steps, then bisecting. The 0.9 keeps a margin for turns, climbs and the drag during the boost. Since Step 4, `reach` includes drag at the air density halfway up to the target.
- **Rules:** assign only if `t ≤ 34 s`, the point is at least 1.5 km from the launcher, and the track had a plot within the last 1.25 turns (the battery does not fire at a stale track). The most urgent unengaged threat gets the next launch slot: 1.5 s to prepare, at least 2 s between launches.
- **Launcher:** 12 ready rounds; while not full, one round is reloaded every 30 s.
- **Shoot-look-shoot:** one interceptor per target at a time; after a shot, the battery waits for the radar's next look.

## Interceptor and guidance (Step 3)

A generic, fictional interceptor, modelled as a point mass (round numbers chosen for teaching):

| Parameter       | Value                    |
| --------------- | ------------------------ |
| Launch speed    | 40 m/s, at least 15° up  |
| Boost           | 4 s at 180 m/s² (≈ 18 g) |
| Burnout speed   | 760 m/s, then drag       |
| Ballistic coef. | β = 20,000 kg/m²         |
| Steering limit  | 300 m/s² (≈ 30 g)        |
| Navigation gain | N = 4                    |
| Lethal radius   | 15 m                     |
| Maximum flight  | 40 s                     |

- **Air drag (Step 4):** `a_drag = −(ρ(h) · |v| / 2β) · v`, with the exponential atmosphere `ρ(h) = 1.225 kg/m³ · e^(−h / 8,500 m)`.
- **Reach** (straight line): `v₀ t + ½ a t²` during the boost (drag left out), then the coast with drag alone, `dv/dt = −k v²` with `k = ρ / 2β`:

  ```
  v(τ) = v₀ / (1 + k·v₀·τ)        s(τ) = ln(1 + k·v₀·τ) / k
  ```

  At sea level, 10 s of coasting from 760 m/s ends at 617 m/s after 6.83 km (7.6 km without drag).

- **True proportional navigation:** with `r` from interceptor to target and `v_rel` the target's velocity relative to the interceptor,

  ```
  Ω = (r × v_rel) / |r|²        Vc = −(r · v_rel) / |r|        a = N · Vc · (Ω × r̂) + g
  ```

  The command (plus a term cancelling gravity) is kept sideways to the interceptor's velocity and limited to 30 g; thrust acts along the velocity during the boost; drag and gravity always act.

- **Guidance out of sight (Step 4):** each tick, the radar checks its line of sight to the target. While the target is hidden (terrain or horizon), the interceptor steers toward the track's extrapolated position instead of the real target.

- **Integration:** semi-implicit Euler in 2 ms sub-steps (ten per tick). Within each sub-step the target moves at constant velocity.
- **Fuze:** in each sub-step both paths are straight lines, so the closest approach has a closed form. With the relative position `r₀` at the start and `r₁` at the end, and `Δr = r₁ − r₀`:

  ```
  s* = clamp(−(r₀ · Δr) / |Δr|², 0, 1)        miss = |r₀ + s* · Δr|
  ```

  When `s* < 1` the two have stopped closing: the fuze goes off. Within 15 m the target is destroyed; otherwise the shot is a miss. The fuze arms after 1 s of flight.

- **Self-destruct:** after 40 s of flight, on hitting the terrain, or if the target is gone.

**Limitations:** no guidance phases and, while it sees the target, a perfect tracking radar: the interceptor is guided to the real target. Against non-maneuvering targets in view, proportional navigation hits almost dead centre. The steering limit does not depend on air density.

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

- **Terrain (Step 4):** a 201 × 201 mesh over ±50 km (500 m spacing), heights stretched with the view. One shader draws the relief (lit from the north-west), contour lines every 100 m, a 10 km grid, the sweep's glow and, when switched on, the blind zones from a 256 × 256 texture. Range rings follow the ground. Drops are placed where the pointer's ray first meets the terrain (ray marching in 250 m steps, then bisection).

**Limitations:** the 20° beam is a drawing aid; the radar has no elevation limit.
