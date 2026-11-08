<div align="center">

<a href="https://mohammadalyounes.github.io/air-defense-sim/"><img src="docs/media/social-preview.png" alt="Air Defense Simulator: see how an air-defense system thinks" width="100%" /></a>

# Air Defense Simulator

**See how an air-defense system thinks.**<br />
Drag a drone, missile or jet onto the map and watch a generic defense battery detect, track, identify, evaluate, engage and assess it, with the physics explained in plain language.

Created by **[Mohammad Alyounes](https://github.com/MohammadAlyounes)** · Built with [Claude Code](https://claude.com/claude-code)

[**Live demo**](https://mohammadalyounes.github.io/air-defense-sim/) · [**Run it locally**](#quick-start) · [**Follow the build**](#build-log) · [**Project plan**](docs/PROJECT_PLAN.md)

[![CI](https://github.com/MohammadAlyounes/air-defense-sim/actions/workflows/ci.yml/badge.svg)](https://github.com/MohammadAlyounes/air-defense-sim/actions/workflows/ci.yml)
![Status: building in public](https://img.shields.io/badge/status-building_in_public-fbbf24)
![Progress: step 4 of 9](https://img.shields.io/badge/progress-step_4_of_9-22d3ee)
[![License: MIT](https://img.shields.io/badge/license-MIT-34d399)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black)
![Vite 8](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)

</div>

> [!NOTE]
> **Educational and generic.** Every radar, launcher and interceptor in this project is fictional, with round-number parameters chosen for teaching. The physics is textbook-level and the terrain is procedurally generated. See [SAFETY.md](SAFETY.md).

## What you'll be able to do

- **Drag threats onto the map.** Small drones, drone swarms, cruise-missile-like targets and fast jets, plus friendly and civil aircraft that must _not_ be engaged.
- **Watch the whole defense loop.** A live analysis bar follows every track through **Detect → Track → Identify → Evaluate → Assign → Engage → Assess**, with a plain-language "Now" line.
- **Ask "Why?"** Click any decision to see the reasoning: the evidence, the threat score, the intercept geometry and the chance of a hit.
- **See the physics, not magic.** Radar horizon, terrain masking, clutter and Doppler, wind, turn radius, air drag, Kalman filtering and proportional navigation, each explained in three sentences and one formula.
- **Experiment.** Tune parameters, save and share scenarios, rewind and try a different decision, or run a scenario hundreds of times to see the odds.

## Quick start

You need [Node.js 22 or newer](https://nodejs.org/).

```bash
git clone https://github.com/MohammadAlyounes/air-defense-sim.git
cd air-defense-sim
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

Nothing to install? Run it in the cloud with one click:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/MohammadAlyounes/air-defense-sim)

## How it works: the defense loop

```mermaid
flowchart LR
    A["<b>Detect</b><br/>radar finds a blip"] --> B["<b>Track</b><br/>a filter smooths the noise"]
    B --> C["<b>Identify</b><br/>friend, civil or hostile?"]
    C --> D["<b>Evaluate</b><br/>how urgent is it?"]
    D --> E["<b>Assign</b><br/>which launcher?"]
    E --> F["<b>Engage</b><br/>guide the interceptor"]
    F --> G["<b>Assess</b><br/>did it work?"]
    G -. "threat survived" .-> E
```

| Stage        | In one sentence                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| **Detect**   | The search radar scans the sky; any echo strong enough to stand out from the noise becomes a blip.    |
| **Track**    | Blips from successive scans are linked into a track, and a filter estimates position and velocity.    |
| **Identify** | Speed and altitude suggest the type; an identification check separates friend, civil and hostile.     |
| **Evaluate** | Threats are ranked by how soon, and how close, they will reach a defended asset.                      |
| **Assign**   | The system checks range, free radar channels and ammunition, then picks a launcher.                   |
| **Engage**   | The interceptor flies toward a predicted intercept point, then homes in with proportional navigation. |
| **Assess**   | The radar watches what happens next; if the threat survived, the loop goes again.                     |

## The physics, in plain language

Every step adds short concept cards: the idea in three sentences, one formula, one worked example, and where to see it in the simulator. The same cards open inside the app from the graduation-cap buttons.

<!-- concepts:start -->
<!-- Generated from docs/concepts by `npm run docs:sync`. Edit the cards there. -->

### Fixed time step — why every run can be replayed exactly

The simulation advances in identical 20 ms ticks (50 per second), no matter how fast your screen redraws. Each tick runs the same equations with the same seeded random numbers, so the same seed and the same inputs always reproduce exactly the same run. That is what makes pausing, single-stepping, replays and fair comparisons possible.

- **Formula:** `position(t + Δt) = position(t) + velocity × Δt`, with `Δt = 1/50 s`
- **Example:** a small drone flying at 40 m/s moves exactly 0.8 m per tick, whether you watch at ¼× or at 16×.
- **See it:** pause, then press Step: the clock moves by one 20 ms tick. Press Restart and the same blips reappear at the same moments.

[Going deeper →](docs/concepts/01-1-fixed-time-step.md)

### Antenna rotation — why blips jump instead of gliding

A search radar's antenna spins, so it sees each aircraft only when its beam sweeps past. Between passes the screen keeps showing the last echo, slowly fading like the phosphor of an old radar tube. A faster spin refreshes the picture more often, but leaves the beam less time on each target.

- **Formula:** `refresh interval = 360° ÷ rotation rate` (here, one turn every 4 s)
- **Example:** a fast jet at 340 m/s moves 1.36 km between two passes of the beam.
- **See it:** watch a fast-moving blip on the radar scope: each new echo lands a short jump ahead of the last one.

[Going deeper →](docs/concepts/01-2-antenna-rotation.md)

### Local coordinates — one map for the radar, the scope and the 3D view

Every position is measured in metres from the battery: east (x), north (y) and up (z). The radar measures a bearing and a range, which the simulator turns into these flat local coordinates, accurate enough over a 40 km area. The 3D view draws the very same numbers, only turned so that "up" points up on your screen.

- **Formula:** `east = range × sin(bearing)`, `north = range × cos(bearing)`
- **Example:** an echo at bearing 090° and 20 km sits at east = 20 km, north = 0.
- **See it:** click an echo on the radar scope: the 3D view highlights the same aircraft, in the same place.

[Going deeper →](docs/concepts/02-1-local-coordinates.md)

### Seeing scale — why heights are stretched and aircraft enlarged

At true scale the battlespace is a thin sheet, 80 km across but only 11 km tall at an airliner's cruising height, and a 2 m drone 30 km away would be a twentieth of a pixel. So the 3D view stretches heights (×2 by default) and draws each aircraft at a fixed size on screen, however far away it is. Labels always show the true altitude.

- **Formula:** `drawn height = true height × stretch`
- **Example:** a cruise-missile-like target flying 50 m above the ground is drawn 100 m up at ×2, and 200 m up at ×4.
- **See it:** switch the 3D view's Heights control between ×1, ×2 and ×4 and watch the drop lines grow.

[Going deeper →](docs/concepts/02-2-seeing-scale.md)

### Detection range — why small drones are seen late

A radar sees an object by the echo it sends back, and that echo weakens very fast with distance: twice as far gives one sixteenth of the signal. So the range at which an object is first detected grows only with the fourth root of its radar cross section, which is how big it looks to radar. An object with a hundredth of the cross section is seen at about a third of the range.

- **Formula:** `R_detect = R_ref × (σ / 1 m²)^(1/4)`, with `R_ref = 30 km` here
- **Example:** a small drone (σ = 0.01 m²) is first seen at 30 × 0.01^¼ ≈ 9.5 km; a fast jet (2 m²) at about 36 km.
- **See it:** drag a drone onto the map: the readout says the radar sees it from 9.5 km, and the scope stays empty until it gets there.

[Going deeper →](docs/concepts/03-1-detection-range.md)

### Proportional navigation — why the interceptor leads its target

An interceptor that always points at its target ends up in a long tail chase. Instead, it watches the line of sight to the target and turns just enough to stop that line from rotating: if the line of sight holds still while the distance shrinks, the two are on a collision course. Sailors use the same rule to spot a collision: constant bearing, decreasing range.

- **Formula:** `a = N × Vc × λ̇` (sideways acceleration = navigation constant × closing speed × line-of-sight turn rate), with `N = 4`
- **Example:** closing at 500 m/s while the line of sight turns at 0.02 rad/s, the interceptor steers at 4 × 500 × 0.02 = 40 m/s², about 4 g.
- **See it:** watch an interceptor on the scope or in the 3D view: it flies toward the cyan cross (the predicted intercept point), not toward where the target is now.

[Going deeper →](docs/concepts/03-2-proportional-navigation.md)

### Radar horizon — why the Earth's curve hides low flyers

Radar waves travel in almost straight lines, but the Earth curves away beneath them, so far enough out even open ground hides a low target. The air bends radio waves slightly back down, which the textbook "4/3 Earth" model handles by drawing the Earth a third larger than it is. The higher the antenna and the higher the target, the farther the horizon.

- **Formula:** `d ≈ 4.12 km × (√h_radar + √h_target)`, heights in metres
- **Example:** with the 12 m antenna, a target at 50 m is below the horizon beyond 4.12 × (3.5 + 7.1) ≈ 43 km; a jet at 6,000 m stays in view out to 330 km.
- **See it:** select a low aircraft far out: the inspector's "Radar view" row says when it is below the horizon.

[Going deeper →](docs/concepts/04-1-radar-horizon.md)

### Terrain masking — why hills hide what flies low behind them

A hill casts a "radar shadow", much like a shadow from a lamp at the radar's antenna. A target flying low behind the hill sits inside that shadow and cannot be seen, however strong the radar. The shadow is deeper the taller the hill, the closer it stands to the radar, and the farther the target is behind it.

- **Formula:** behind a hill of height `H` at distance `d₁`, a target at distance `d₂` is seen only above `h ≈ H × d₂ / d₁` (antenna near the ground)
- **Example:** a 400 m ridge 10 km out hides everything below about 1,200 m at 30 km, so a target flying 50 m above the ground stays hidden until it crosses the ridge.
- **See it:** switch on "Blind zones" under the scope: orange shows where the radar cannot see a target at 50 m, 300 m or 1 km above the ground.

[Going deeper →](docs/concepts/04-2-terrain-masking.md)

### Detection probability — why the radar sometimes misses, and sometimes sees ghosts

A radar decides "target or not" by checking whether the echo rises above a threshold set over the receiver's noise. A real target's echo flickers from scan to scan as it turns, so near its maximum range it is only seen on some looks. Set the threshold lower and you see more, but random noise also crosses it more often: those are false alarms.

- **Formula:** `Pd = Pfa^(1 / (1 + SNR))` for a flickering (Swerling 1) target, with `SNR ∝ σ / R⁴`
- **Example:** with a false-alarm chance Pfa = 10⁻⁶ per cell, a drone at its 9.5 km "50% range" is seen on half the looks, and on 85% of them at 6.6 km. Over 600,000 cells per turn, about 0.6 false alarms appear each turn.
- **See it:** watch for lone blips that appear once and vanish: the log calls them "dropped", because a second echo never came to confirm them.

[Going deeper →](docs/concepts/04-3-detection-probability.md)

### Air drag — why an interceptor's reach depends on altitude

Once its motor burns out, an interceptor coasts and the air slows it down. Drag grows with the square of speed and with air density, and the air thins out with height: at 6.6 km it is half as dense as at sea level. So the same interceptor reaches farther, and arrives faster, against a high target than against a low one.

- **Formula:** `a_drag = ρ(h) · v² / (2β)`, with the density `ρ(h)` of the standard atmosphere (1.225 kg/m³ at sea level) and the ballistic coefficient `β = 20,000 kg/m²`
- **Example:** at sea level and 760 m/s, drag slows it by 17.7 m/s² (almost 2 g); after 10 s of coasting it is down to 617 m/s and has flown 6.8 km instead of 7.6 km.
- **See it:** drop a fast jet high and a cruise-missile-like target low at the same distance: the low one is intercepted closer in, after a slower flight.

[Going deeper →](docs/concepts/04-4-air-drag.md)

### Standard atmosphere — why the air thins and cools with height

The air near the ground is squeezed by the weight of all the air above it, so it is densest at the bottom and thins out with height. It also cools by 6.5 °C for every kilometre up to 11 km, then stays at −56.5 °C. Thinner air means less drag, so the same interceptor flies farther and arrives faster against a high target.

- **Formula:** `ρ = p / (R · T)`, with `T = 15 °C − 6.5 °C/km × h` and the pressure `p` set by the weight of the air above
- **Example:** at 5 km the air is at −17.5 °C and 540 hPa, with 60% of its sea-level density (0.736 kg/m³); at 11 km it is down to 30% (0.364 kg/m³).
- **See it:** switch on the engagement envelope in the 3D view: for the first 3 km its edge leans outward, because the interceptor flies through thinner air.

[Going deeper →](docs/concepts/04-5-standard-atmosphere.md)

### Wind — why a drone crabs sideways

Aircraft fly through the air, and the air itself moves, so their path over the ground is their own velocity plus the wind's. To hold a track, an aircraft turns its nose partly into the wind; what is left of its airspeed, plus the wind along its track, is its speed over the ground. Near the ground the wind is slowed by friction, so it grows with height.

- **Formula:** `ground speed = √(V² − w⊥²) + w∥`, with the wind at height h `w(h) = w₁₀ · (h / 10 m)^(1/7)`
- **Example:** an 8 m/s surface wind blows at 13 m/s at a drone's 300 m. Flying into it, a 40 m/s drone covers the ground at 27 m/s, a third slower; a 240 m/s cruise-missile-like target at 50 m loses only 4%.
- **See it:** the wind arrow on the radar scope shows this run's wind. Select a drone: the inspector shows its airspeed, the wind it meets and how far its nose is turned into it.

[Going deeper →](docs/concepts/04-6-wind.md)

### Turn radius — why fast things turn wide

To turn, an aircraft banks and tilts its lift sideways, and the sideways part of the lift bends its path into a circle. At the same bank, the circle grows with the square of the speed, so fast aircraft turn wide. Pulling a higher load factor (the lift divided by the weight, counted in g) tightens the turn.

- **Formula:** `r = V² / (g · √(n² − 1))`, with the load factor `n = 1 / cos(bank)` in a level turn
- **Example:** at 340 m/s a fast jet's routine 60° bank (2 g) turns on a 6.8 km radius and a hard 6 g break on 2.0 km; a 40 m/s drone banked at 35° turns on 233 m.
- **See it:** drop a cruise-missile-like target 30 km out: it flies a dog-leg and rounds the corner on a 5.9 km arc. Drop a fast jet: when an interceptor closes to 6 km, it breaks hard away at 6 g.

[Going deeper →](docs/concepts/04-7-turn-radius.md)

### Radar cross section — why a hundred times smaller is only three times closer

The radar cross section (RCS, written σ) is how big an object looks to radar: the area of an ideal reflector that would send back the same echo. It depends on shape, material and the angle it is seen from, not just on size: flat panels facing the radar flash brightly, rounded or angled shapes scatter the energy elsewhere. Because the echo weakens with the fourth power of range, even large changes in σ move the detection range surprisingly little.

- **Formula:** `P_received = P_t · G² · λ² · σ / ((4π)³ · R⁴)`, so the detection range grows as `(P_t · σ)^(1/4)`
- **Example:** doubling the transmitter power buys only 19% more range (2^¼ = 1.19). To see a 0.01 m² drone as far out as a 2 m² jet, the radar would need 200 times the power.
- **See it:** each palette card shows its radar size; while you place one, the readout says from how far the radar should see it: about 9.5 km for a drone, 36 km for a fast jet.

[Going deeper →](docs/concepts/04-8-radar-cross-section.md)

### Clutter and Doppler — why a crossing drone vanishes

The radar's beam lights the ground as well as the sky, and the ground sends back an echo, called clutter, far stronger than a small drone's. The radar tells them apart by the Doppler shift: the echo of anything moving toward or away from the radar comes back at a slightly changed frequency, and the ground's does not. Filtering out the unshifted echoes removes the clutter, but also any target whose speed along the line of sight is too small, like one flying across the beam.

- **Formula:** `f_D = 2 · v_r / λ`, with the radial speed `v_r = v · cos(angle between its path and the line of sight)`
- **Example:** with a 10 cm wavelength, a drone flying straight at the radar at 40 m/s shifts its echo by 800 Hz. Flying across the beam 6 km out, it stays inside the ±10 m/s notch for 78 s, long enough for its track to be lost.
- **See it:** set Blind zones to "clutter" to see the ground the radar lights. Select any aircraft: the inspector's Doppler line shows its radial speed and whether the notch hides it.

[Going deeper →](docs/concepts/04-9-clutter-doppler.md)

### Kalman filter — how the tracker sees through the noise

Every radar echo is a little off, so joining the raw blips would give a jittery track and a wild velocity. A Kalman filter keeps a best guess of position and velocity, together with how unsure it is, and moves the guess forward between echoes. When a new echo arrives, it blends the guess and the echo in proportion to how much it trusts each.

- **Formula:** `x̂ ← x̂⁻ + K · (z − x̂⁻)`, with the gain `K = P⁻ / (P⁻ + R)` (in one dimension: P⁻ is the prediction's variance, R the echo's)
- **Example:** a prediction good to ±80 m and an echo good to ±80 m give K = 0.5: the new estimate lies halfway, good to ±57 m (80 / √2). After a dozen echoes a jet's speed is known to within a few m/s, where two raw echoes 4 s apart could be 30 m/s off.
- **See it:** the faint ellipse around each track on the scope is its 2σ uncertainty, and the track table's ±1σ column shrinks as echoes come in. Press T to compare tracks with the truth.

[Going deeper →](docs/concepts/05-1-kalman-filter.md)

### Gating and association — which echo belongs to which track

With several targets, false alarms and noise, the tracker must decide which new echo continues which track, without knowing what made it. It draws a "gate" around each track's predicted position, sized by its uncertainty, and only echoes inside the gate are candidates. The closest pairs, measured in standard deviations, are matched first; leftover echoes start new tentative tracks.

- **Formula:** `d² = νᵀ · S⁻¹ · ν < 16.3`, where ν is the gap between the echo and the prediction and S its expected spread (the 99.9% limit for three dimensions)
- **Example:** a track predicted to ±100 m: an echo 250 m off is 2.5 standard deviations (d² = 6.3) and joins it; one 500 m off is 5 standard deviations (d² = 25) and starts a new track instead.
- **See it:** drop a drone swarm: six echoes close together. Watch the tracks settle into one per drone after a few sweeps, and press T to see which track follows which drone.

[Going deeper →](docs/concepts/05-2-gating-association.md)

### Closest point of approach — how the battery decides what is a threat

A hostile aircraft is only a threat if its course will bring it close to something the battery defends. Projecting its track straight ahead gives the moment it will be closest to each defended asset, and how close: the closest point of approach (CPA). If that distance falls inside an asset's threat ring, and the moment is still ahead, the track is a threat, and threats are ranked by how soon they arrive.

- **Formula:** `t_cpa = −(r · v) / |v|²` and `d_cpa = |r + v · t_cpa|`, with `r` the track's position relative to the asset and `v` its velocity
- **Example:** a target 20 km east and 10 km south of the town, flying north-west at 280 m/s, is closest to the town in about 75 s, at 7 km: outside the town's 2.5 km ring, so not a threat to it. Turn it 20° toward the town and it becomes one.
- **See it:** select a hostile track: the inspector's "Why?" names the asset it threatens, how close it will pass and when. The header's "Next impact" counts down to the most urgent one.

[Going deeper →](docs/concepts/05-3-closest-point-of-approach.md)

### Engagement envelope — where the battery can reach

An interceptor can only meet a target it can reach in time, before its motor's energy is spent and air drag has slowed it down. The set of places it can reach within its longest planned flight forms a dome over the battery: the engagement envelope. A threat outside it must wait until it flies in; a threat inside the 1.5 km minimum range is already too close.

- **Formula:** `R_max(h) = √(reach(t_max, ρ(h/2))² − h²)`, where `reach` is the interceptor's straight-line reach with drag in air of density ρ, with a 10% margin
- **Example:** with a 34 s planned flight, the dome reaches about 17 km at ground level and a little farther, 17.2 km, at 3 km up, where the thinner air saps less speed; it closes over the top just below 20 km.
- **See it:** press the umbrella button in the 3D view to show the dome. Drop a jet 35 km out: the command node waits ("out of reach for now") until the jet enters it.

[Going deeper →](docs/concepts/06-1-engagement-envelope.md)

### Kill probability — why one interceptor is not always enough

Even an interceptor that passes within its lethal radius does not always destroy its target. The chance that it does is the single-shot kill probability, Pk. It is lower against fast, agile targets and when the interceptor arrives slow after a long flight. So the battery looks after every shot and fires again if the target survived, until the threat is down or it is too late.

- **Formula:** `Pk = Pk_target × clamp(v_interceptor / 600 m/s, 0.5, 1)`, with Pk_target = 0.95 (slow), 0.85 (medium) or 0.75 (above 250 m/s); two shots give `1 − (1 − Pk)²`
- **Example:** a fast jet met by an interceptor slowed to 450 m/s: Pk = 0.75 × 0.75 = 0.56. A second shot raises the chance to 1 − 0.44² = 0.81.
- **See it:** the approval card, the log and the inspector show the chance of a kill for each shot. Watch for "burst … but survived" in the event log, followed by a second launch.

[Going deeper →](docs/concepts/06-2-kill-probability.md)

### Rules of engagement — why speed and safety pull in opposite directions

Before firing, the battery must decide what a track is. It interrogates it with an identification check (IFF): friendly aircraft answer, civil aircraft broadcast a transponder code, hostiles stay silent. But a friendly transponder can fail, so silence is evidence, not proof, and the rules decide how much evidence is enough.

- **Formula:** chance a friend stays silent on `n` checks = `0.1ⁿ`; weapons TIGHT wait for 2 silent checks (1 in 100), weapons FREE fire after 1 (1 in 10)
- **Example:** FREE engages a jet 4 s sooner than TIGHT, but out of every ten friendly aircraft with a faulty transponder heading for a defended asset, about one would be shot down. Under TIGHT, about one in a hundred.
- **See it:** click "WCS TIGHT" in the header to switch to FREE or HOLD, and "AUTO" to SEMI-AUTO to approve every shot yourself (A to approve, H to hold fire).

[Going deeper →](docs/concepts/06-3-rules-of-engagement.md)

<!-- concepts:end -->

**Coming next:** identification friend-or-foe, the kinematic classifier and air corridors (Step 5) · missile energy, kill assessment and saturation (Step 6).

## Build log

Every step is a git tag and a [GitHub Release](https://github.com/MohammadAlyounes/air-defense-sim/releases), so you can check out any stage of the project, for example `git checkout step-03-first-intercept`. Newest step first. Steps 5 and 6 are still in progress, so their entries are not tagged yet.

### Steps 5 and 6 · Decide & engage (the rest of Step 5, the start of Step 6)

The command node gets things worth defending, rules to follow, limits to live with, and a reason for every decision.

- **Defended assets:** a town and a power plant join the battery, each with a threat ring. Threats are ranked by the closest point of approach to the asset they will reach soonest, and leaks are counted where they happen.
- **Identification that can go wrong:** friendly transponders fail one check in ten. A silent track is "unknown" after one check and "hostile" after two, so a friend with a dead transponder can be shot down: an identification error, counted as a failure.
- **Rules of engagement:** click the header badges to switch weapons control (TIGHT, FREE, HOLD) and the operator mode (AUTO, SEMI-AUTO). In SEMI-AUTO the battery proposes each shot with its evidence; approve with A, hold fire with H.
- **Kill probability:** a burst inside the lethal radius destroys the target only with the chance Pk, lower against fast, agile targets and with a tired interceptor. The battery looks again and fires again.
- **Fire channels and saturation:** three engagements at a time. A swarm fills them, and the NOW line says when the defense is saturated.
- **"Why?" for every decision:** the inspector explains the identity, the threatened asset, what the rules allow, and the shot and its chance of a kill. The engagement envelope can be shown as a dome in 3D.

> **Engineering note: the rules are commands too.** Rule changes, approvals and holds are recorded like drops, so a run where a friendly was shot down under weapons FREE replays exactly, ready to be studied.

_Screenshots and a clip for this step come with the v1.0 media pass._

### Step 5 · Track & identify (part 1: tracking)

The battery's picture of the sky becomes a real estimate, with an honest measure of how sure it is.

- **Kalman filter:** every track blends its prediction with each new echo, weighted by how much it trusts each. Positions jitter less than the raw echoes and velocities settle within a few m/s.
- **Association without the truth:** echoes join tracks by gating and global nearest neighbour, matched in 0.2 s batches so close neighbours like a drone swarm compete fairly. The tracker never knows which aircraft made an echo.
- **Uncertainty you can see:** a faint 2σ ellipse around each track on the scope, stretched sideways far out where bearing errors dominate, and a ±1σ column in the track table.
- **Truth vs. perception:** press T (or "truth" under the scope) to see where aircraft really are: grey crosses and error lines on the scope, the battery's tracks as rings next to the real aircraft in 3D, and the tracking error in the inspector.

> **Engineering note: a filter that checks its own honesty.** The unit tests feed the filter noisy measurements and check that its normalized innovation averages 3, the value a chi-square law with three degrees of freedom predicts. A filter that claimed to be surer than it is would fail.

_Screenshots and a clip for this step come with the v1.0 media pass._

### Step 4 · Environment & radar

<p align="center"><img src="docs/media/step-04-environment-radar.webp" alt="The 3D view seen from above, with the ground the radar lights shaded in sand. A cruise-missile-like threat is dragged onto the map: its ghost draws the dog-leg it will fly and says how long it needs through the wind. Once dropped, it flies out to one side, turns in toward the battery and is destroyed by an interceptor." width="100%" /></p>

The battlespace gets a landscape and weather, threats fly real routes, and the radar becomes honest about what it can and cannot see.

- **Procedural terrain:** fictional hills and ridges around a flat valley, generated from a seed, in 3D (with relief shading and contour lines) and as a faint relief on the scope. Drones and cruise-missile-like targets follow the ground; jets climb over it.
- **Air and wind:** the standard atmosphere sets the air density at every height, and each run draws its own wind, stronger higher up. Aircraft crab into it to hold their track: a 40 m/s drone flying into a 12 m/s headwind makes only 28 m/s over the ground.
- **Routes and turns:** every type turns at its own bank angle, a drone on a 233 m circle, a fast jet on a 6.8 km one. Cruise-missile-like targets fly a dog-leg, and a fast jet breaks away at 6 g when an interceptor closes in, then turns back. A second, wider gate keeps its track through the break.
- **Radar horizon and terrain masking:** the radar sees only along clear lines of sight over the curved Earth. Low flyers hide behind the ridges to the south and west until they are 7 to 10 km out.
- **Detection probability, noise and false alarms:** echoes flicker near the edge of range, every measurement is a little off, and noise sometimes makes a ghost blip. A single echo never becomes a track on its own, so ghosts are dropped and never engaged.
- **Clutter and Doppler:** where the beam lights the ground, the radar filters out the ground's echo by its missing Doppler shift, and with it anything that closes too slowly. A drone crossing the beam over lit ground simply vanishes.
- **Coverage maps:** one switch under the scope shades, on the scope and on the 3D terrain, where the radar cannot see a target at 50 m, 300 m or 1 km above the ground, or which ground it lights.
- **Air drag:** interceptors slow down as they coast, more in the thick air near the ground, and the command node plans with it.
- **Readouts that explain:** a wind arrow on the scope; the placement ghost draws the route a threat will fly, with its flight time through the wind; the inspector shows the wind, the turn, the Doppler shift and whether the radar can see the selected aircraft, and why not.

> **Engineering note: one terrain, many readers.** The landscape is generated once and shared by the simulation, the scope, the 3D mesh and the placement readout. The blind zones and lit ground you see are exactly the ones the radar uses, and a dropped threat flies exactly the route its ghost showed.

<img src="docs/media/step-04-environment-radar.png" alt="The console with the ground the radar lights shaded on the radar scope and the 3D terrain, the wind arrow above the scope, the header at Step 4 of 9, and the inspector following a small drone" width="100%" />

<details>
<summary>Phone layout</summary>
<br />
<img src="docs/media/step-04-environment-radar-mobile.png" alt="The Step 4 console on a phone, with the lit ground shaded on the 3D terrain" width="320" />
</details>

### Step 3 · First intercept

<p align="center"><img src="docs/media/step-03-first-intercept.webp" alt="A cruise-missile-like threat is dragged from the palette onto the 3D view; the radar tracks it, an interceptor launches and destroys it, and a result card sums up the engagement. Then a drone swarm dropped on the radar scope draws five interceptors at once." width="100%" /></p>

The first full defense loop. Drag a threat onto the map and watch the battery detect, track, identify, evaluate, assign, engage and assess it, with every stage counted live in the header.

- **Drag-and-drop threats:** drag a palette card onto the 3D view or the radar scope (or click a card, then the map; or press Enter twice). A ghost shows its route to the battery, how long it will take and when the radar will first see it; the mouse wheel sets its altitude.
- **Detection range by radar size:** small objects are seen late. A drone appears at 9.5 km, a cruise-missile-like target at 17 km, a jet at 36 km.
- **The loop, version 1:** echoes become tracks; an identification check sorts friend, civil and hostile; hostiles heading for the battery are threats; the command node predicts an intercept point and fires; the radar looks again to confirm the kill, or the battery fires again.
- **Interceptors:** boost, coast and steer by proportional navigation, with a 30 g limit, computed in 2 ms steps with an exact closest approach. Friendly and civil aircraft are never engaged.
- **Live analysis bar:** a count for each stage (the chips pulse as tracks move on), threats active, down and leaked, interceptors ready, flying and used, the next impact, and a NOW line that narrates the engagement.
- **Everywhere else:** track symbols, interceptors and predicted intercept points on the scope; a live track table; launcher, interceptor trails and intercept rings in 3D; the inspector shows what the battery knows and does about the selected aircraft; result cards after each kill.

> **Engineering note: perception drives decisions.** The command node only ever uses its tracks: positions and velocities estimated from radar echoes, never the hidden truth. The truth is used where the physics needs it (the interceptor meets the real target) and to reveal, after the fact, what a target really was. That separation is what Steps 4 and 5 build on, when noise makes perception imperfect.

<img src="docs/media/step-03-first-intercept.png" alt="The console mid-engagement: a result card for a destroyed cruise-missile-like target, two interceptors in flight, the header counting every stage, the track table and the inspector following an engaged target" width="100%" />

<details>
<summary>Phone layout</summary>
<br />
<img src="docs/media/step-03-first-intercept-mobile.png" alt="The Step 3 console on a phone, with a result card over the 3D view" width="320" />
</details>

### Step 2 · 3D scene

<p align="center"><img src="docs/media/step-02-3d-scene.webp" alt="The 3D battlespace: aircraft with fading trails cross the area while the radar beam sweeps; selecting a fast jet boxes its echo on the radar scope and fills the inspector, then the camera follows the jet and switches to the top view" width="100%" /></p>

The battlespace in 3D, in step with the radar scope: select an aircraft in one view and every view follows.

- **3D battlespace:** ground grid, range rings every 10 km, and the radar site with its turning antenna, search beam and sweep, all driven by the same simulation as the scope.
- **Aircraft:** models built from the palette silhouettes, each with a drop line to the ground, a fading 30-second trail and a tag showing its true altitude.
- **Cameras:** Orbit, Top (north up, like the scope), Follow and Radar (stand at the antenna and look out), on keys 1–4. Stretch heights ×1, ×2 or ×4; toggle labels with L.
- **One selection everywhere:** click an aircraft in 3D, an echo on the scope or a line in the event log. The scope boxes its echo, and the inspector shows the ground truth: speed, altitude, heading, range and what the radar knows. Esc clears it.
- **Shareable views:** [`?t=60&select=3&camera=follow`](https://mohammadalyounes.github.io/air-defense-sim/?t=60&select=3&camera=follow) opens the run one minute in, following the fast jet.

> **Engineering note: one truth, many views.** The scope, the 3D view and the inspector all read the same pair of simulation snapshots, so they can never disagree. The 3D view only draws when something changes (a paused run costs no GPU time), and three.js loads in its own chunk after the console is on screen.

<img src="docs/media/step-02-3d-scene.png" alt="The console with the 3D battlespace: a selected fast jet with its trail and drop line, its echo boxed on the radar scope, and its ground truth in the inspector" width="100%" />

<details>
<summary>Phone layout</summary>
<br />
<img src="docs/media/step-02-3d-scene-mobile.png" alt="The Step 2 console on a phone, with the 3D view at the top" width="320" />
</details>

### Step 1 · Simulation core

<p align="center"><img src="docs/media/step-01-sim-core.gif" alt="The live radar scope: the beam sweeps clockwise, echoes glow as it passes and fade until the next pass" width="400" /></p>

The simulator comes alive: a deterministic engine running at 50 ticks per second, a live radar scope, and controls to play, pause, step and replay.

- **Simulation engine (`src/sim`):** pure TypeScript with a fixed 20 ms time step, a seeded random-number generator, scenario traffic that crosses the area, and a search radar whose rotating beam paints each aircraft as it sweeps past.
- **Live radar scope:** a sweeping beam and echoes that fade like old phosphor; bigger aircraft return bigger blips.
- **Player bar:** play/pause (Space), step one tick (.) or one second (Shift + .), speed from ¼× to 16× (+ / −), the seed, Restart (R) and New seed.
- **Live header:** the Detect stage counts radar contacts and the NOW line describes the radar picture in plain words. Stages that arrive later say which step brings them.
- **Event log:** SCENARIO lines (what really happens) next to RADAR lines (what the radar actually sees).
- **Concept cards in the app:** the graduation-cap buttons open the same cards as this README.

> **Engineering note: replay by construction.** A run is fully defined by its seed and the commands sent to it, each stamped with its tick. Unit tests rebuild runs from their command logs and compare state hashes; a browser test restarts the same seed and checks the event log matches line for line. Any moment is a link: [`?seed=7&t=60`](https://mohammadalyounes.github.io/air-defense-sim/?seed=7&t=60) opens seed 7, one minute in.

<img src="docs/media/step-01-sim-core.png" alt="The console with the live radar scope, the Detect stage counting 7 contacts, the NOW line and the event log" width="100%" />

<details>
<summary>Phone layout</summary>
<br />
<img src="docs/media/step-01-sim-core-mobile.png" alt="The Step 1 console on a phone" width="320" />
</details>

### Step 0 · Launchpad

<img src="docs/media/step-00-launchpad.png" alt="The console shell: analysis bar, threat palette, 3D battlespace preview, radar scope and panels" width="100%" />

The foundation everything else builds on.

- **Console shell:** the header analysis bar (seven-stage pipeline, key numbers, plain-language "Now" line), the threat palette, an animated radar scope, and a panel for every future feature, each labelled with the step that brings it to life.
- **Tooling:** strict TypeScript, Vite 8, React 19, Tailwind CSS 4, ESLint, Prettier, Vitest and Playwright.
- **CI/CD:** every push is linted, type-checked, tested in a real browser and deployed to GitHub Pages.

> **Engineering note: determinism, enforced from day one.** The simulation core (`src/sim`) is not allowed to call `Math.random()`, read the wall clock or touch browser APIs, and the linter rejects any attempt. Same inputs, same outputs, every time: that is what will make exact replays, "rewind and try again" and Monte Carlo runs possible.

<details>
<summary>Phone layout</summary>
<br />
<img src="docs/media/step-00-launchpad-mobile.png" alt="The console shell on a phone" width="320" />
</details>

## Roadmap

- [x] **Step 0 · Launchpad:** project scaffold, CI, live demo and the console shell
- [x] **Step 1 · Simulation core:** deterministic clock, play/pause/step/speed, live radar scope
- [x] **Step 2 · 3D scene:** 3D ground, models, trails, labels and cameras
- [x] **Step 3 · First intercept:** the first full loop, drag-and-drop threats and the live analysis bar
- [x] **Step 4 · Environment & radar:** terrain, atmosphere, wind and drag, threat routes; radar equation, noise, horizon, terrain masking, clutter and coverage maps
- [ ] **Step 5 · Track & identify:** Kalman tracking, uncertainty ellipses, truth vs. perception; identification, civil traffic, defended assets, threat ranking with "Why?"
  - In: Kalman tracking, gating and association, uncertainty ellipses, track quality, truth vs. perception, identification with transponder failures, defended assets, threat ranking with "Why?"
  - Still to come: the kinematic classifier and air corridors
- [ ] **Step 6 · Engage & assess:** fire channels, engagement envelopes, kill probability, doctrine and operator approval; kill assessment, saturation, telemetry and the full analysis bar
  - In: fire channels, the engagement envelope, kill probability, rules of engagement and operator approval
- [ ] **Step 7 · Scenarios & replay:** save, load and share, editor and raid generator; timeline scrubbing, rewind and branch, Monte Carlo, CSV export
- [ ] **Step 8 · Learning layer:** ten guided lessons, live equations, challenges, after-action review
- [ ] **Step 9 · Polish & release v1.0:** cinematic intro, effects, sound, themes, accessibility, demo video and the v1.0 release

The full specification is in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).

## Under the hood

| Layer      | Choice                                                                 |
| ---------- | ---------------------------------------------------------------------- |
| Language   | TypeScript (strict)                                                    |
| App        | React 19, Vite 8                                                       |
| 3D         | Three.js with React Three Fiber, loaded on demand                      |
| Styling    | Tailwind CSS 4, Radix UI, Lucide icons                                 |
| Simulation | Plain TypeScript: fixed time step, seeded randomness, Web Worker ready |
| App state  | Zustand                                                                |
| Tests      | Vitest (unit), Playwright (browser)                                    |
| CI/CD      | GitHub Actions → GitHub Pages                                          |

```
src/
  sim/      The engine: pure, deterministic TypeScript (clock, traffic, radar, tracks, command node, interceptors)
  app/      React UI: analysis bar, palette, radar scope, 3D view, panels and the simulation driver
e2e/        Browser tests
docs/       Plan, architecture, models, devlog, concept cards and media
scripts/    Docs sync, screenshots, GIFs and preview images
```

| Command             | What it does                                            |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Start the dev server                                    |
| `npm run build`     | Production build into `dist/`                           |
| `npm test`          | Unit tests                                              |
| `npm run test:e2e`  | Browser tests                                           |
| `npm run check`     | Lint, type-check, unit tests, format and docs checks    |
| `npm run docs:sync` | Copy the concept cards from `docs/concepts` into README |

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) (how it fits together) and [docs/MODELS.md](docs/MODELS.md) (every equation and its limits).

## Safety and scope

This is a learning tool, not a model of any real system. Equipment and terrain are fictional, parameters are illustrative, and the physics stays at textbook level. Community scenarios must follow the same rules: read [SAFETY.md](SAFETY.md).

## Built with Claude

This project is being built in public, step by step, with [Claude Code](https://claude.com/claude-code). The rules Claude follows in this repository are in [CLAUDE.md](CLAUDE.md), and every step's decisions are logged in [docs/DEVLOG.md](docs/DEVLOG.md).

Created by [Mohammad Alyounes](https://github.com/MohammadAlyounes). Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Code: [MIT](LICENSE). Documentation, lessons and concept cards: [CC BY 4.0](LICENSE-docs.md).

If you share, fork or build on this project, please keep the credit "Created by Mohammad Alyounes" (see [NOTICE](NOTICE)). To cite it, use the **Cite this repository** button on GitHub ([CITATION.cff](CITATION.cff)).
