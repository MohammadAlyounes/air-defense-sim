# Models

Every model in the simulator: its equations, its assumptions and its limits. All parameters are illustrative round numbers chosen for teaching (see [SAFETY.md](../SAFETY.md)).

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

## Kinematics (Steps 1 and 4)

Each tick an aircraft moves at its velocity over the ground:

```
p(t + Δt) = p(t) + v · Δt
```

For a straight leg in steady wind one Euler step per tick is exact. The test suite checks that a fast jet at 340 m/s in calm air moves exactly 340 m in 50 ticks. Since Step 4 the velocity comes from the aircraft's airspeed, its track and the wind (see Flight), and the track turns toward the next waypoint.

**Terrain following (Step 4):** the height follows the terrain:

- AGL traffic (drones, cruise-missile-like targets) aims for its set height above the highest ground at its position and 1.5 s and 3 s ahead.
- MSL traffic (jets, friendly aircraft, airliners) keeps its altitude, but climbs to stay at least 150 m above the hills.
- Height changes are limited by each type's climb rate (8 m/s for a drone, 60 m/s for a cruise-missile-like target, 150 m/s for a jet), and nothing flies lower than 10 m above the ground. The vertical speed is part of the aircraft's velocity.

## Atmosphere (Step 4)

The International Standard Atmosphere, first three layers, heights above the battery's ground:

| Layer              | Heights  | Temperature                    |
| ------------------ | -------- | ------------------------------ |
| Troposphere        | 0–11 km  | 288.15 K, falling 6.5 K per km |
| Lower stratosphere | 11–20 km | 216.65 K (−56.5 °C), constant  |
| Stratosphere       | 20–32 km | rising 1 K per km              |

- **Pressure** from hydrostatic balance `dp/dh = −ρ g` (g₀ = 9.80665 m/s²) with the ideal gas law, layer by layer from 101,325 Pa at the ground: `p = p_b · (T / T_b)^(−g₀ / (L·R))` where the temperature changes at rate `L`, `p = p_b · e^(−g₀ (h − h_b) / (R·T))` where it is constant.
- **Density** `ρ = p / (R·T)`, with `R = 287.053 J/(kg·K)`; **speed of sound** `a = √(γ·R·T)`, `γ = 1.4`.
- Checked against the published table at 0, 5, 11, 15, 20 and 25 km (temperature, pressure, density, speed of sound). Above 32 km the 32 km values are used.
- The exponential atmosphere `ρ = 1.225 · e^(−h / 8.5 km)` stays available behind the same interface, for comparison and tests.

## Flight: wind, turns and routes (Step 4)

- **Wind:** one direction over the whole area, steady, growing with height by the one-seventh power law `w(h) = w₁₀ · (max(h, 1 m) / 10 m)^(1/7)`, with `h` the height above the ground. Each run draws its own surface wind from the seed with a generator of its own (2–12 m/s, from any direction), so a seed always brings the same wind, whatever happens during the run.
- **Wind triangle:** an aircraft holds its ground track `ψ` at its airspeed `V`. With the wind split along the track (`w∥`) and across it (`w⊥`), its velocity through the air is `−w⊥` across and `√(V² − w⊥²)` along, so its ground speed is `√(V² − w⊥²) + w∥`, and its heading (where the nose points) is turned into the wind by `asin(w⊥ / V)`. A crosswind stronger than the airspeed is only partly cancelled: the aircraft drifts.
- **Turns:** level, coordinated turns at load factor `n`: rate `ω = g·√(n² − 1) / V`, radius `r = V / ω`. Each type turns at a routine bank angle `φ` (`n = 1 / cos φ`): drone and swarm 35°, cruise-missile-like 45°, fast jet 60°, friendly 30°, airliner 25°. The track turns toward the desired track by at most `ω·Δt` per tick.
- **Routes:** waypoints over the ground. The aircraft turns onto the next leg `r · tan(Δψ / 2)` before the waypoint (`Δψ` the change of track, capped at 2 rad), or passes it within 300 m. A waypoint inside the turn circle (unreachable by turning) is given up, unless it is the last one, which the aircraft flies on from until it can turn back in. After the last waypoint it flies straight on.
- **Dog-leg:** a cruise-missile-like target's route turns at a point half way along the direct line and a quarter of its length to one side, when the route is at least three turn radii long. Auto traffic draws the side from the route generator; traffic placed by hand takes it from the drop bearing (alternating every 45°), so the placement readout shows the same route.
- **Evasive break:** a fast jet that an interceptor is guided at breaks once it is within 6 km: it turns at 6 g onto the track square to the line of sight to the interceptor (the side needing the smaller turn), holds it for 6 s, then goes back to its route. Once per interceptor.

| Type                | Routine bank | Routine turn radius | Break       |
| ------------------- | ------------ | ------------------- | ----------- |
| Small drone         | 35°          | 233 m               | —           |
| Cruise-missile-like | 45°          | 5.9 km              | —           |
| Fast jet            | 60° (2 g)    | 6.8 km              | 6 g, 2.0 km |
| Friendly aircraft   | 30°          | 7.1 km              | —           |
| Airliner            | 25°          | 11.6 km             | —           |

**Limitations:** no gusts or turbulence; turns are flat (no climbing turns), entered at once (no roll rate), at constant airspeed (no energy lost in a hard turn).

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
- **Lit ground:** the coverage overlay's clutter view shades the ground the antenna can see (a point 0.5 m above the ground is in view): the places whose echo the Doppler filter has to remove (see Search radar).

## Scenario traffic (Steps 1, 3 and 5)

| Setting          | Value                                                                                                                                                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| At the start     | 4 aircraft, placed 15–65% of the way along their course                                                                                                                                      |
| Arrivals         | One new aircraft every 14–28 s while fewer than 7 are flying                                                                                                                                 |
| Entry point      | 38 km from the battery, at a random bearing; an airliner at the end of a civil corridor nearest that bearing                                                                                 |
| Course           | Hostiles aim within 800 m of a defended asset, airliners fly their corridor to its other end, others aim within 14 km of the battery; cruise-missile-like targets fly a dog-leg (see Flight) |
| Mix (weights)    | Drone 3 · cruise-missile-like 2 · fast jet 2 · airliner 1.5 · friendly 1.5                                                                                                                   |
| Leaving the area | Farther than 42 km from the battery and flying away                                                                                                                                          |

Aim points use `r = R·√u` (with `u` uniform), which spreads them evenly over the disc instead of bunching them near the centre. Airliners keep a random offset from the corridor's centreline, up to half of its half-width (2.5 km), all the way along it.

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

- **Doppler shift (Step 4):** only the part of a target's velocity along the line of sight shifts its echo's frequency. The closing speed is `v_r = v · (p_antenna − p) / |p_antenna − p|`, and the shift is `f_D = 2 · v_r / λ`, with a fictional wavelength `λ = 0.1 m` (200 Hz for every 10 m/s).
- **Clutter and the low-Doppler notch (Step 4):** the ground the beam lights returns a strong echo with no Doppler shift. The radar filters it out, and with it every echo closing or opening slower than 10 m/s, but only where there is clutter to remove: where the ground at the target's slant range, on the same bearing, is in view of the antenna. A target there that flies across the beam, or hovers, is not painted at all.
  - Over flat ground, the 12 m antenna lights the ground out to its smooth-Earth horizon, 14.3 km. Hills light patches farther out and hide others.
  - A high flyer at 12 km of slant range is judged by the ground at 12 km of ground range, not by the ground below it.
  - The ideal radar used by some tests has no notch.

**Limitations:** the notch is all or nothing (no clutter echoes on the scope, no sub-clutter visibility, no blind speeds); no jamming, no elevation limit to the beam. Detection does not depend on aspect or weather.

## Tracks (Steps 3 and 5)

- **Kalman filter (Step 5):** each track holds a constant-velocity estimate `x = [p, v]` (6 states) and its covariance `P`.
  - Predict over `Δt`: `x⁻ = F x`, `P⁻ = F P Fᵀ + Q`, with `F = [[I, Δt·I], [0, I]]` and, per axis, `Q = q · [[Δt³/3, Δt²/2], [Δt²/2, Δt]]` (q = 4 m²/s³ horizontally, 30 m²/s³ vertically).
  - Update with a plot `z`: `S = H P⁻ Hᵀ + R`, `K = P⁻ Hᵀ S⁻¹`, `x = x⁻ + K (z − H x⁻)`, Joseph form `P = (I − KH) P⁻ (I − KH)ᵀ + K R Kᵀ`.
  - Measurement covariance: `R = J · diag(σr², σaz², σel²) · Jᵀ`, with `J` the Jacobian of the spherical-to-Cartesian conversion at the plot (floors of 1 m and 1 mrad, so the ideal radar's R is never singular).
- **Starting a track:** the first plot gives the position (covariance R) and an unknown velocity (σ = 120 m/s horizontally, 30 m/s vertically). The second plot confirms it.
- **Position now:** the filtered position moved on at the filtered velocity: `p(t) = p̂ + v̂ · (t − t_update)`. The uncertainty ellipse is the horizontal part of `P` predicted to `t`; the scope draws it at 2σ, the track table shows the one-sigma long axis.
- **Association (Step 5):** gating plus global nearest neighbour.
  - A plot may join a track only if `d² = νᵀ S⁻¹ ν ≤ 16.27` (chi-square, 3 degrees of freedom, 99.9%), with the track predicted to the plot's tick.
  - All pairs inside their gates are sorted by `d²` and taken greedily, each plot and each track once; a track updated within the last half turn cannot take another plot.
  - Plots are matched in batches covering 10 ticks (0.2 s, 18° of sweep) and committed when they are 10 ticks old, so close neighbours compete together. Leftover plots start tentative tracks.
  - The tracker never reads the truth. Each track keeps a link to the aircraft behind its last plot (null for a false alarm), used only by the truth overlay, the tests and the physics.
- **Maneuver gate (Step 4):** a fast jet breaking at 6 g leaves the constant-velocity prediction behind: one antenna turn later its echo can be 760 m from where the track expected it, outside the gate. So plots still unassigned after the normal pass get a second chance against confirmed tracks that took no plot, predicted with a far larger process noise (q = 4,000 m²/s³ horizontally) and gated at the same 99.9%. A plot taken this way updates the track through that larger noise, so the estimate catches up at once; the inspector notes it for one antenna turn.
- **Dropped:** a tentative track whose next look brings no plot (after 1.25 turns), most often a false alarm; a confirmed track after three antenna turns (12 s) without a plot, unless an interceptor is still being guided to it or has just hit it (it is then kept until the kill assessment).

**Limitations:** constant-velocity model only, with a second, wider gate for hard turns (no turn models or interacting multiple models); nearest-neighbour association can swap tracks between targets closer than the gate, most visibly when a drone swarm first appears.

## Defended assets (Step 5)

| Asset       | Position (east, north) | Threat ring | Leak radius |
| ----------- | ---------------------- | ----------- | ----------- |
| Battery     | 0, 0                   | 5 km        | 2 km        |
| Town        | −6.5 km, 4 km          | 2.5 km      | 1.5 km      |
| Power plant | 5 km, −4.5 km          | 1.5 km      | 0.8 km      |

Scenario hostiles aim within 800 m of one of the three, picked at random. A hostile inside any asset's leak radius has got through (counted once per aircraft).

## Air corridors (Step 5)

Two fictional civil lanes, straight, 10 km wide and 8 to 13 km up, each square to the bearing at which it passes closest to the battery:

| Lane                | Closest to the battery | Direction   | Width | Heights |
| ------------------- | ---------------------- | ----------- | ----- | ------- |
| North corridor      | 18 km at bearing 10°   | 100° / 280° | 10 km | 8–13 km |
| South-west corridor | 22 km at bearing 215°  | 305° / 125° | 10 km | 8–13 km |

- **Flying a corridor:** inside the lane's width and height band, with a ground track within 30° of its direction, either way. The command node judges it from the track's filtered position and velocity.
- **Clear of the assets:** the lanes' edges stay at least 7.7 km outside every threat ring (the north lane and the town are closest), so a course along a lane never threatens an asset. The unit tests try every course within 10° of a lane's direction; at the full 30° allowed for flying it, a course from a lane's far end can point at the battery, and is evaluated like any other.
- **Scenario airliners** enter at the end of a lane nearest their entry bearing, on the 38 km circle, and fly it to its other end, 44 km out.
- **Placed airliners:** an airliner dropped without a heading joins the nearest lane at 45° and flies it toward its farther end, out of the area. Within 500 m of the centreline, or too close to that end to join first, it heads straight for the end. Its 11.6 km turn radius carries it at most 3.4 km past the centreline, still inside the lane.

## Identification (Steps 3 and 5)

- **Kinematic classifier (Step 5):** every tick, each confirmed track gets a flight profile from its filtered ground speed `v`, its height above the ground below it `h_AGL` (from the terrain map) and its altitude `h`. The tests run in this order, and the first that holds wins:

  | Profile             | Test                              | Traffic here that flies it        |
  | ------------------- | --------------------------------- | --------------------------------- |
  | Drone-like          | `v < 80 m/s`                      | drones (40 m/s)                   |
  | Cruise-missile-like | `v ≥ 120 m/s` and `h_AGL < 300 m` | cruise-missile-like (240 m/s)     |
  | Jet-like            | `v ≥ 290 m/s`                     | fast jets (340 m/s)               |
  | Airliner-like       | `v ≥ 180 m/s` and `h ≥ 8 km`      | airliners (230 m/s at 11 km)      |
  | Ordinary aircraft   | anything else                     | friendly aircraft (200 m/s, 4 km) |

  The first three are the threat profiles: no friendly or civil aircraft here flies them.

- **Corridor (Step 5):** whether the track flies a civil corridor (see Air corridors), from the same filtered state.
- **Checks (IFF):** the first 2 s after a track is confirmed, then every 4 s until it is settled (friend, civil or hostile).
- **Answers:** a friendly aircraft answers each check with probability 0.9 (its transponder can fail); a civil aircraft's code is received with probability 0.98; a hostile never answers. One random draw per check.
- **Identity:** a track is **pending** ("identifying") until its first check, and an answer settles it (friend or civil). After a silent check, counting every check so far:
  1. a track flying a corridor with the airliner-like profile is assumed civil: **unknown**, never hostile on silence alone, checked again every 4 s;
  2. otherwise, after two silent checks, **hostile**;
  3. otherwise (one silent check) **suspect** with a threat profile, **unknown** without one.

  A friendly aircraft silent on two checks (probability 0.1² = 1%) is declared hostile: the identification mistake the rules must guard against. A false track has nothing behind it to answer.

- **Odds:** silence has probability 1 from a hostile and 0.1 from a friend, so each silent check multiplies the odds that a track is hostile by 10 (by 50 against civil traffic). The checks are drawn independently; a real transponder that is broken stays broken.

**Limitations:** the classifier uses only speed and height, judged afresh at every tick (no history, no climb or turn behaviour, no radar signature). A hostile flying exactly like an airliner along a corridor stays unknown; its course is still evaluated, and under weapons FREE an unknown that threatens an asset can be engaged.

## Threat evaluation (Steps 3 and 5)

- **Closest point of approach** to each asset, from the track's ground position relative to the asset `r` and velocity `v`:

  ```
  t_cpa = −(r · v) / |v|²        d_cpa = |r + v · t_cpa|
  ```

- An unknown, suspect or hostile track is a threat to an asset if `d_cpa` is inside the asset's threat ring and `t_cpa > 0`. It is assigned to the asset it reaches soonest, and threats are ranked by `t_cpa` (the header's "next impact").

## Rules of engagement (Step 5)

- **Weapons control status:** HOLD (never fire), TIGHT (hostile tracks only; the default), FREE (hostile, suspect and unknown tracks; never one still being identified).
- **Operator mode:** AUTO (the command node fires on its own) or SEMI-AUTO (each shot is proposed and waits for the operator's approval; a proposal lapses when the shot becomes impossible or no longer allowed; holding fire blocks new proposals for that track for 20 s). Switching to AUTO approves waiting proposals.
- **Commands:** `setRules`, `approveEngagement` and `holdFire` are recorded like every other command, so runs with rule changes replay exactly.
- **Identification errors:** a friendly or civil aircraft destroyed by an interceptor is counted in `idErrors` and reported as a failure.

## Weapon assignment (Steps 3 and 5)

- **Predicted intercept point:** the earliest flight time `t` at which the interceptor can be where the track will be: `0.9 · reach(t) ≥ |p + v · t|`. It is found by scanning in 0.25 s steps, then bisecting. The 0.9 keeps a margin for turns, climbs and the drag during the boost. Since Step 4, `reach` includes drag at the air density halfway up to the target.
- **Engagement envelope:** for a target at altitude `h`, the farthest ground range is `√(R² − h²)` with `R = 0.9 · reach(34 s, ρ(h/2))`: about 17 km at ground level, 17.2 km at 3 km (the widest), 16.9 km at 6 km, closing just below 20 km up. The inner edge is the 1.5 km minimum range.
- **Rules:** assign only if the rules allow the track's identity, a fire channel is free, `t ≤ 34 s`, the point is at least 1.5 km from the launcher, and the track had a plot within the last 1.25 turns. The most urgent threat gets the next launch slot: 1.5 s to prepare, at least 2 s between launches.
- **Fire channels (Step 5):** the tracking radar guides at most 3 engagements at once (proposed, waiting to launch or in flight). More threats than channels means the rest wait: saturation.
- **Launcher:** 12 ready rounds; while not full, one round is reloaded every 30 s.
- **Shoot-look-shoot:** one interceptor per target at a time; after a shot, the battery waits for the radar's next look.

## Kill probability (Step 5)

When the fuze goes off within the 15 m lethal radius, one random draw against the single-shot kill probability decides:

```
Pk = Pk_target × clamp(v_interceptor / 600 m/s, 0.5, 1),   Pk_target = 0.95 (≤ 120 m/s), 0.85 (≤ 250 m/s), 0.75 (faster)
```

The planner predicts it with the track's speed and the interceptor's planned arrival speed (`speedAfterMps`); the fuze uses the true speeds. A failed draw is a miss with reason "survived". This is a generic teaching model: no seeker, fuze or warhead detail (SAFETY.md).

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

- **Air drag (Step 4):** `a_drag = −(ρ(h) · |v_air| / 2β) · v_air`, with `ρ(h)` from the standard atmosphere (see Atmosphere) and `v_air = v − w(h)` the interceptor's velocity through the air (the wind at its height, see Flight).
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

## Kill assessment and leaks (Steps 3 and 5)

- **Kill assessed:** after a hit, the next time the beam sweeps over the track's predicted position and finds no echo, the kill is confirmed and the track dropped (at most one turn, 4 s, later).
- **Target survived:** if the beam finds the target again after a miss, the engagement closes and the track can be assigned again.
- **Leak:** a hostile inside any defended asset's leak radius got through (2 km for the battery).
- **Score (Step 5):** "threats down" counts the confirmed kills of real hostiles, whatever the track's identity at the time (a suspect shot down under FREE counts); a friendly or civil aircraft destroyed counts as an identification error instead.

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
- **Trails:** the simulation records each aircraft's position every 0.5 s (25 ticks) and keeps the last 30 s (60 points). Trails are part of the simulation state, so replays show exactly the same trails. A point's brightness falls linearly with its age.
- **Search beam:** a vertical fan from the antenna out to 40 km and 20° up, turning with the blended antenna angle; its trail on the ground matches the scope's sweep.

- **Terrain (Step 4):** a 201 × 201 mesh over ±50 km (500 m spacing), heights stretched with the view. One shader draws the relief (lit from the north-west), contour lines every 100 m, a 10 km grid, the sweep's glow and, when switched on, the blind zones from a 256 × 256 texture. Range rings follow the ground. Drops are placed where the pointer's ray first meets the terrain (ray marching in 250 m steps, then bisection).

**Limitations:** the 20° beam is a drawing aid; the radar has no elevation limit.
