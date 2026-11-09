# Physics

The ideas behind the simulator, one short card each: the idea in plain words, one formula, one worked example, and where to see it. The graduation-cap buttons in the app open these same cards. All numbers are illustrative round values chosen for teaching ([SAFETY.md](../SAFETY.md)).

- [Time and space](#time-and-space): fixed time step · antenna rotation · local coordinates · seeing scale
- [Radar](#radar): detection range · radar cross section · radar horizon · terrain masking · detection probability · clutter and Doppler
- [Air and flight](#air-and-flight): standard atmosphere · air drag · wind · turn radius
- [Tracking and identification](#tracking-and-identification): Kalman filter · gating and association · identification friend-or-foe
- [Engagement](#engagement): closest point of approach · engagement envelope · proportional navigation · kill probability · rules of engagement
- [Key numbers](#key-numbers) and [limits](#limits)

## Time and space

### Fixed time step — why every run can be replayed exactly

The simulation advances in identical 20 ms ticks (50 per second), no matter how fast your screen redraws. Each tick runs the same equations with the same seeded random numbers, so the same seed and the same inputs always reproduce exactly the same run. That is what makes pausing, single-stepping, replays and fair comparisons possible.

- **Formula:** `position(t + Δt) = position(t) + velocity × Δt`, with `Δt = 1/50 s`
- **Example:** a small drone flying at 40 m/s moves exactly 0.8 m per tick, whether you watch at ¼× or at 16×.
- **See it:** pause, then press Step: the clock moves by one 20 ms tick. Press Restart and the same blips reappear at the same moments.

### Antenna rotation — why blips jump instead of gliding

A search radar's antenna spins, so it sees each aircraft only when its beam sweeps past. Between passes the screen keeps showing the last echo, slowly fading like the phosphor of an old radar tube. A faster spin refreshes the picture more often, but leaves the beam less time on each target.

- **Formula:** `refresh interval = 360° ÷ rotation rate` (here, one turn every 4 s)
- **Example:** a fast jet at 340 m/s moves 1.36 km between two passes of the beam.
- **See it:** watch a fast-moving blip on the radar scope: each new echo lands a short jump ahead of the last one.

### Local coordinates — one map for the radar, the scope and the 3D view

Every position is measured in metres from the battery: east (x), north (y) and up (z). The radar measures a bearing and a range, which the simulator turns into these flat local coordinates, accurate enough over a 40 km area. The 3D view draws the very same numbers, only turned so that "up" points up on your screen.

- **Formula:** `east = range × sin(bearing)`, `north = range × cos(bearing)`
- **Example:** an echo at bearing 090° and 20 km sits at east = 20 km, north = 0.
- **See it:** click an echo on the radar scope: the 3D view highlights the same aircraft, in the same place.

### Seeing scale — why heights are stretched and aircraft enlarged

At true scale the battlespace is a thin sheet, 80 km across but only 11 km tall at an airliner's cruising height, and a 2 m drone 30 km away would be a twentieth of a pixel. So the 3D view stretches heights (×2 by default) and draws each aircraft at a fixed size on screen, however far away it is. Labels always show the true altitude.

- **Formula:** `drawn height = true height × stretch`
- **Example:** a cruise-missile-like target flying 50 m above the ground is drawn 100 m up at ×2, and 200 m up at ×4.
- **See it:** switch the 3D view's Heights control between ×1, ×2 and ×4 and watch the drop lines grow.

## Radar

### Detection range — why small drones are seen late

A radar sees an object by the echo it sends back, and that echo weakens very fast with distance: twice as far gives one sixteenth of the signal. So the range at which an object is first detected grows only with the fourth root of its radar cross section, which is how big it looks to radar. An object with a hundredth of the cross section is seen at about a third of the range.

- **Formula:** `R_detect = R_ref × (σ / 1 m²)^(1/4)`, with `R_ref = 30 km` here
- **Example:** a small drone (σ = 0.01 m²) is first seen at 30 × 0.01^¼ ≈ 9.5 km; a fast jet (2 m²) at about 36 km.
- **See it:** drag a drone onto the map: the readout says the radar sees it from 9.5 km, and the scope stays empty until it gets there.

### Radar cross section — why a hundred times smaller is only three times closer

The radar cross section (RCS, written σ) is how big an object looks to radar: the area of an ideal reflector that would send back the same echo. It depends on shape, material and the angle it is seen from, not just on size: flat panels facing the radar flash brightly, rounded or angled shapes scatter the energy elsewhere. Because the echo weakens with the fourth power of range, even large changes in σ move the detection range surprisingly little.

- **Formula:** `P_received = P_t · G² · λ² · σ / ((4π)³ · R⁴)`, so the detection range grows as `(P_t · σ)^(1/4)`
- **Example:** doubling the transmitter power buys only 19% more range (2^¼ = 1.19). To see a 0.01 m² drone as far out as a 2 m² jet, the radar would need 200 times the power.
- **See it:** each palette card shows its radar size; while you place one, the readout says from how far the radar should see it: about 9.5 km for a drone, 36 km for a fast jet.

### Radar horizon — why the Earth's curve hides low flyers

Radar waves travel in almost straight lines, but the Earth curves away beneath them, so far enough out even open ground hides a low target. The air bends radio waves slightly back down, which the textbook "4/3 Earth" model handles by drawing the Earth a third larger than it is. The higher the antenna and the higher the target, the farther the horizon.

- **Formula:** `d ≈ 4.12 km × (√h_radar + √h_target)`, heights in metres
- **Example:** with the 12 m antenna, a target at 50 m is below the horizon beyond 4.12 × (3.5 + 7.1) ≈ 43 km; a jet at 6,000 m stays in view out to 330 km.
- **See it:** select a low aircraft far out: the inspector's "Radar view" row says when it is below the horizon.

### Terrain masking — why hills hide what flies low behind them

A hill casts a "radar shadow", much like a shadow from a lamp at the radar's antenna. A target flying low behind the hill sits inside that shadow and cannot be seen, however strong the radar. The shadow is deeper the taller the hill, the closer it stands to the radar, and the farther the target is behind it.

- **Formula:** behind a hill of height `H` at distance `d₁`, a target at distance `d₂` is seen only above `h ≈ H × d₂ / d₁` (antenna near the ground)
- **Example:** a 400 m ridge 10 km out hides everything below about 1,200 m at 30 km, so a target flying 50 m above the ground stays hidden until it crosses the ridge.
- **See it:** switch on "Blind zones" under the scope: orange shows where the radar cannot see a target at 50 m, 300 m or 1 km above the ground.

### Detection probability — why the radar sometimes misses, and sometimes sees ghosts

A radar decides "target or not" by checking whether the echo rises above a threshold set over the receiver's noise. A real target's echo flickers from scan to scan as it turns, so near its maximum range it is only seen on some looks. Set the threshold lower and you see more, but random noise also crosses it more often: those are false alarms.

- **Formula:** `Pd = Pfa^(1 / (1 + SNR))` for a flickering (Swerling 1) target, with `SNR ∝ σ / R⁴`
- **Example:** with a false-alarm chance Pfa = 10⁻⁶ per cell, a drone at its 9.5 km "50% range" is seen on half the looks, and on 85% of them at 6.6 km. Over 600,000 cells per turn, about 0.6 false alarms appear each turn.
- **See it:** watch for lone blips that appear once and vanish: the log calls them "dropped", because a second echo never came to confirm them.

### Clutter and Doppler — why a crossing drone vanishes

The radar's beam lights the ground as well as the sky, and the ground sends back an echo, called clutter, far stronger than a small drone's. The radar tells them apart by the Doppler shift: the echo of anything moving toward or away from the radar comes back at a slightly changed frequency, and the ground's does not. Filtering out the unshifted echoes removes the clutter, but also any target whose speed along the line of sight is too small, like one flying across the beam.

- **Formula:** `f_D = 2 · v_r / λ`, with the radial speed `v_r = v · cos(angle between its path and the line of sight)`
- **Example:** with a 10 cm wavelength, a drone flying straight at the radar at 40 m/s shifts its echo by 800 Hz. Flying across the beam 6 km out, it stays inside the ±10 m/s notch for 78 s, long enough for its track to be lost.
- **See it:** set Blind zones to "clutter" to see the ground the radar lights. Select any aircraft: the inspector's Doppler line shows its radial speed and whether the notch hides it.

## Air and flight

### Standard atmosphere — why the air thins and cools with height

The air near the ground is squeezed by the weight of all the air above it, so it is densest at the bottom and thins out with height. It also cools by 6.5 °C for every kilometre up to 11 km, then stays at −56.5 °C. Thinner air means less drag, so the same interceptor flies farther and arrives faster against a high target.

- **Formula:** `ρ = p / (R · T)`, with `T = 15 °C − 6.5 °C/km × h` and the pressure `p` set by the weight of the air above
- **Example:** at 5 km the air is at −17.5 °C and 540 hPa, with 60% of its sea-level density (0.736 kg/m³); at 11 km it is down to 30% (0.364 kg/m³).
- **See it:** switch on the engagement envelope in the 3D view: for the first 3 km its edge leans outward, because the interceptor flies through thinner air.

### Air drag — why an interceptor's reach depends on altitude

Once its motor burns out, an interceptor coasts and the air slows it down. Drag grows with the square of speed and with air density, and the air thins out with height: at 6.6 km it is half as dense as at sea level. So the same interceptor reaches farther, and arrives faster, against a high target than against a low one.

- **Formula:** `a_drag = ρ(h) · v² / (2β)`, with the density `ρ(h)` of the standard atmosphere (1.225 kg/m³ at sea level) and the ballistic coefficient `β = 20,000 kg/m²`
- **Example:** at sea level and 760 m/s, drag slows it by 17.7 m/s² (almost 2 g); after 10 s of coasting it is down to 617 m/s and has flown 6.8 km instead of 7.6 km.
- **See it:** drop a fast jet high and a cruise-missile-like target low at the same distance: the low one is intercepted closer in, after a slower flight.

### Wind — why a drone crabs sideways

Aircraft fly through the air, and the air itself moves, so their path over the ground is their own velocity plus the wind's. To hold a track, an aircraft turns its nose partly into the wind; what is left of its airspeed, plus the wind along its track, is its speed over the ground. Near the ground the wind is slowed by friction, so it grows with height.

- **Formula:** `ground speed = √(V² − w⊥²) + w∥`, with the wind at height h `w(h) = w₁₀ · (h / 10 m)^(1/7)`
- **Example:** an 8 m/s surface wind blows at 13 m/s at a drone's 300 m. Flying into it, a 40 m/s drone covers the ground at 27 m/s, a third slower; a 240 m/s cruise-missile-like target at 50 m loses only 4%.
- **See it:** the wind arrow on the radar scope shows this run's wind. Select a drone: the inspector shows its airspeed, the wind it meets and how far its nose is turned into it.

### Turn radius — why fast things turn wide

To turn, an aircraft banks and tilts its lift sideways, and the sideways part of the lift bends its path into a circle. At the same bank, the circle grows with the square of the speed, so fast aircraft turn wide. Pulling a higher load factor (the lift divided by the weight, counted in g) tightens the turn.

- **Formula:** `r = V² / (g · √(n² − 1))`, with the load factor `n = 1 / cos(bank)` in a level turn
- **Example:** at 340 m/s a fast jet's routine 60° bank (2 g) turns on a 6.8 km radius and a hard 6 g break on 2.0 km; a 40 m/s drone banked at 35° turns on 233 m.
- **See it:** drop a cruise-missile-like target 30 km out: it flies a dog-leg and rounds the corner on a 5.9 km arc. Drop a fast jet: when an interceptor closes to 6 km, it breaks hard away at 6 g.

## Tracking and identification

### Kalman filter — how the tracker sees through the noise

Every radar echo is a little off, so joining the raw blips would give a jittery track and a wild velocity. A Kalman filter keeps a best guess of position and velocity, together with how unsure it is, and moves the guess forward between echoes. When a new echo arrives, it blends the guess and the echo in proportion to how much it trusts each.

- **Formula:** `x̂ ← x̂⁻ + K · (z − x̂⁻)`, with the gain `K = P⁻ / (P⁻ + R)` (in one dimension: P⁻ is the prediction's variance, R the echo's)
- **Example:** a prediction good to ±80 m and an echo good to ±80 m give K = 0.5: the new estimate lies halfway, good to ±57 m (80 / √2). After a dozen echoes a jet's speed is known to within a few m/s, where two raw echoes 4 s apart could be 30 m/s off.
- **See it:** the faint ellipse around each track on the scope is its 2σ uncertainty, and the track table's ±1σ column shrinks as echoes come in. Press T to compare tracks with the truth.

### Gating and association — which echo belongs to which track

With several targets, false alarms and noise, the tracker must decide which new echo continues which track, without knowing what made it. It draws a "gate" around each track's predicted position, sized by its uncertainty, and only echoes inside the gate are candidates. The closest pairs, measured in standard deviations, are matched first; leftover echoes start new tentative tracks.

- **Formula:** `d² = νᵀ · S⁻¹ · ν < 16.3`, where ν is the gap between the echo and the prediction and S its expected spread (the 99.9% limit for three dimensions)
- **Example:** a track predicted to ±100 m: an echo 250 m off is 2.5 standard deviations (d² = 6.3) and joins it; one 500 m off is 5 standard deviations (d² = 25) and starts a new track instead.
- **See it:** drop a drone swarm: six echoes close together. Watch the tracks settle into one per drone after a few sweeps, and press T to see which track follows which drone.

### Identification friend-or-foe — why silence is evidence, not proof

The battery interrogates every confirmed track by radio: a friendly aircraft's transponder (a radio that replies on its own) answers, a civil one broadcasts its code, a hostile stays silent. A transponder can fail, so each silent check only makes "hostile" more likely, and it takes two in a row to declare it. What the track flies like adds evidence: silent and flying like a drone, a cruise missile or a jet, it is "suspect" at once; silent but flying like an airliner along a civil corridor, it is never called hostile on silence alone.

- **Formula:** `odds(hostile after n silent checks) = odds(hostile before) × 10ⁿ`, because a hostile is always silent and a friend only on 1 check in 10
- **Example:** starting from even odds, one silent check makes a track 10 to 1 hostile (91%) and two make it 100 to 1 (99%): there the battery declares it hostile.
- **See it:** select any track: the inspector's "Classifier" line says what it flies like, and "Why?" counts its silent checks. The green lanes on the scope are the civil corridors.

## Engagement

### Closest point of approach — how the battery decides what is a threat

A hostile aircraft is only a threat if its course will bring it close to something the battery defends. Projecting its track straight ahead gives the moment it will be closest to each defended asset, and how close: the closest point of approach (CPA). If that distance falls inside an asset's threat ring, and the moment is still ahead, the track is a threat, and threats are ranked by how soon they arrive.

- **Formula:** `t_cpa = −(r · v) / |v|²` and `d_cpa = |r + v · t_cpa|`, with `r` the track's position relative to the asset and `v` its velocity
- **Example:** a target 20 km east and 10 km south of the town, flying north-west at 280 m/s, is closest to the town in about 75 s, at 7 km: outside the town's 2.5 km ring, so not a threat to it. Turn it 20° toward the town and it becomes one.
- **See it:** select a hostile track: the inspector's "Why?" names the asset it threatens, how close it will pass and when. The header's "Next impact" counts down to the most urgent one.

### Engagement envelope — where the battery can reach

An interceptor can only meet a target it can reach in time, before its motor's energy is spent and air drag has slowed it down. The set of places it can reach within its longest planned flight forms a dome over the battery: the engagement envelope. A threat outside it must wait until it flies in; a threat inside the 1.5 km minimum range is already too close.

- **Formula:** `R_max(h) = √(reach(t_max, ρ(h/2))² − h²)`, where `reach` is the interceptor's straight-line reach with drag in air of density ρ, with a 10% margin
- **Example:** with a 34 s planned flight, the dome reaches about 17 km at ground level and a little farther, 17.2 km, at 3 km up, where the thinner air saps less speed; it closes over the top just below 20 km.
- **See it:** press the umbrella button in the 3D view to show the dome. Drop a jet 35 km out: the command node waits ("out of reach for now") until the jet enters it.

### Proportional navigation — why the interceptor leads its target

An interceptor that always points at its target ends up in a long tail chase. Instead, it watches the line of sight to the target and turns just enough to stop that line from rotating: if the line of sight holds still while the distance shrinks, the two are on a collision course. Sailors use the same rule to spot a collision: constant bearing, decreasing range.

- **Formula:** `a = N × Vc × λ̇` (sideways acceleration = navigation constant × closing speed × line-of-sight turn rate), with `N = 4`
- **Example:** closing at 500 m/s while the line of sight turns at 0.02 rad/s, the interceptor steers at 4 × 500 × 0.02 = 40 m/s², about 4 g.
- **See it:** watch an interceptor on the scope or in the 3D view: it flies toward the cyan cross (the predicted intercept point), not toward where the target is now.

### Kill probability — why one interceptor is not always enough

Even an interceptor that passes within its lethal radius does not always destroy its target. The chance that it does is the single-shot kill probability, Pk. It is lower against fast, agile targets and when the interceptor arrives slow after a long flight. So the battery looks after every shot and fires again if the target survived, until the threat is down or it is too late.

- **Formula:** `Pk = Pk_target × clamp(v_interceptor / 600 m/s, 0.5, 1)`, with Pk_target = 0.95 (slow), 0.85 (medium) or 0.75 (above 250 m/s); two shots give `1 − (1 − Pk)²`
- **Example:** a fast jet met by an interceptor slowed to 450 m/s: Pk = 0.75 × 0.75 = 0.56. A second shot raises the chance to 1 − 0.44² = 0.81.
- **See it:** the approval card, the log and the inspector show the chance of a kill for each shot. Watch for "burst … but survived" in the event log, followed by a second launch.

### Rules of engagement — why speed and safety pull in opposite directions

Before firing, the battery must decide what a track is. It interrogates it with an identification check (IFF): friendly aircraft answer, civil aircraft broadcast a transponder code, hostiles stay silent. But a friendly transponder can fail, so silence is evidence, not proof, and the rules decide how much evidence is enough.

- **Formula:** chance a friend stays silent on `n` checks = `0.1ⁿ`; weapons TIGHT wait for 2 silent checks (1 in 100), weapons FREE fire after 1 (1 in 10)
- **Example:** FREE engages a jet 4 s sooner than TIGHT, but out of every ten friendly aircraft with a faulty transponder heading for a defended asset, about one would be shot down. Under TIGHT, about one in a hundred.
- **See it:** click "WCS TIGHT" in the header to switch to FREE or HOLD, and "AUTO" to SEMI-AUTO to approve every shot yourself (A to approve, H to hold fire).

## Key numbers

| Model          | Values                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Time           | 20 ms ticks (50 Hz); interceptors fly in 2 ms sub-steps; one seeded sfc32 random generator                                                     |
| Frame          | East-North-Up metres from the battery; the 4/3 Earth (8,495 km radius) for every line of sight                                                 |
| Terrain        | Procedural and fictional (seed 7): flat within 3 km, hills up to ~750 m, a 257 × 257 grid over ±50 km                                          |
| Air            | International Standard Atmosphere to 32 km; one steady wind per run, 2–12 m/s at 10 m, stronger higher up (1/7 power law)                      |
| Search radar   | 12 m antenna, one turn every 4 s; 50% range `30 km × σ^¼`, capped at 40 km; Pfa = 10⁻⁶; noise 30 m, 0.15°, 0.25°; ±10 m/s notch                |
| Tracker        | Constant-velocity Kalman filter; gate `d² ≤ 16.27`; nearest-neighbour matching in 0.2 s batches; confirmed by a second echo                    |
| Identification | First check 2 s after confirmation, then every 4 s; friends answer 90% of checks, civil codes arrive 98% of the time                           |
| Assets         | Battery (5 km threat ring), town (2.5 km), power plant (1.5 km); two civil corridors, 10 km wide and 8–13 km up                                |
| Battery        | 3 fire channels; 12 rounds, one reloaded every 30 s; minimum range 1.5 km; longest planned flight 34 s                                         |
| Interceptor    | 4 s boost at 180 m/s² to 760 m/s, then coasts with drag (β = 20,000 kg/m²); 30 g limit; N = 4; lethal radius 15 m; kill probability up to 0.95 |

| Traffic             | Speed   | Height             | Radar cross section | Routine bank       |
| ------------------- | ------- | ------------------ | ------------------- | ------------------ |
| Small drone         | 40 m/s  | 300 m above ground | 0.01 m²             | 35°                |
| Cruise-missile-like | 240 m/s | 50 m above ground  | 0.1 m²              | 45°                |
| Fast jet            | 340 m/s | 6 km               | 2 m²                | 60° (6 g to break) |
| Friendly aircraft   | 200 m/s | 4 km               | 2 m²                | 30°                |
| Civil airliner      | 230 m/s | 11 km              | 40 m²               | 25°                |

## Limits

- **Point masses** on a flat local map; the Earth's curve counts only for lines of sight.
- **Calm, simple flight:** no gusts or turbulence; turns are level, entered at once and flown at constant speed.
- **A simple radar:** the clutter notch is all or nothing; no jamming, no beam elevation limit, no dependence on aspect or weather.
- **A simple tracker:** constant velocity only, with a wider second gate for hard turns; nearest-neighbour matching can swap tracks closer than the gate.
- **A simple classifier:** speed and height only. A hostile flying exactly like an airliner along a corridor stays "unknown".
- **Perfect fire control:** while the target is in sight the interceptor is guided to the real target; misses come from the kill probability.
- **Determinism** is exact within one JavaScript engine; browsers may round `Math.sin` and similar functions differently in the last bit.
