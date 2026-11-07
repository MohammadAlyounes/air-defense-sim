# Devlog

One short entry per step, newest first: what was built, the decisions behind it, and what comes next.

## Step 6 · Decide & engage (2026-11-07)

**Built**

- **Defended assets (`src/sim/assets.ts`):** the battery, a town and a power plant, each with a threat ring and a leak radius. Scenario hostiles head for one of them; leaks name the asset reached.
- **Threat evaluation:** the closest point of approach to every asset, from the filtered track. A threat is assigned to the asset it reaches soonest, for hostile and unknown tracks alike.
- **Identification with mistakes:**
  - Up to two IFF checks, 4 s apart. Friendly transponders answer 90% of checks and civil codes are received 98% of the time.
  - Silence on the first check makes a track **unknown**, on both **hostile**.
  - A friendly aircraft destroyed is an identification error: counted in the stats, shown in the header and on a result card.
- **Rules of engagement:**
  - Weapons control HOLD, TIGHT or FREE, and operator mode AUTO or SEMI-AUTO, set with a recorded `setRules` command.
  - In SEMI-AUTO each shot is proposed and waits for `approveEngagement` or `holdFire`; proposals lapse when the shot becomes impossible.
  - The header badges are clickable, and A and H answer from the keyboard.
- **Fire channels:** at most three engagements at once (proposed, waiting or flying). The header meter is live, and the NOW line reports saturation.
- **Kill probability:** a fuze within the lethal radius kills with `Pk = Pk_target × clamp(v / 600, 0.5, 1)`. It is predicted at assignment and drawn at the fuze (miss reason "survived"). `certainKill` keeps exact tests exact.
- **Engagement envelope:** `envelopeRangeM(h)` from the planner's reach, drawn as a dome in 3D (umbrella button, `?envelope=1`).
- **Views:**
  - An approval card with the evidence (identity, threatened asset, intercept point, chance of a kill).
  - A "Why?" section in the inspector, one sentence per step: identity, threat, rules, shot or reason for waiting.
  - Assets on the scope and in 3D (threat rings that follow the ground, markers, labels).
  - The narrator learns every new event: unknown and hostile identifications, the threatened asset, proposals, approvals, holds, rule changes, "burst … but survived", ID errors.
- **Concept cards:** closest point of approach, engagement envelope, kill probability, rules of engagement.
- **Tests:** 19 new unit tests and 3 new browser tests, 187 unit and 28 browser tests in all.
  - Unit tests cover IFF answers, the rules, Pk values, the envelope, CPA to any point and the asset ranking.
  - Simulation tests cover approval, holding fire and switching back to AUTO, HOLD, FREE engaging one check sooner, a friendly with a dead transponder shot down and counted, fire-channel limits, leaks at the power plant, survivals under Pk, and replay of rule changes.
  - Browser tests cycle the rule badges, approve a shot in SEMI-AUTO, and read the inspector's "Why?" and the envelope toggle.

**Decisions**

- **Silence is evidence, not proof.** "Unknown" between the two checks gives weapons control something real to decide. FREE fires one check (4 s) sooner, at ten times the risk to a friend with a faulty transponder. The lesson is the trade-off, so neither setting is "right".
- **Rules as recorded commands.** Clicking a header badge dispatches `setRules`, so a run where a friendly was shot down replays exactly.
- **A generic kill probability.** Two textbook trends (agile targets are harder, slow interceptors steer worse) and nothing about real seekers or warheads. Jets now survive a first shot a third of the time or more, which makes shoot-look-shoot visible.
- **Drops still aim at the battery.** Scenario hostiles spread over the three assets; dropped threats keep flying at the battery, so the placement readout stays simple.

**Next: Step 7 · Scenarios & lessons.** A built-in scenario library with share-by-link, a few short guided lessons, an after-action review, telemetry graphs and the timeline.

## Step 5 · Tracking (2026-11-07)

**Built**

- **Kalman filter (`src/sim/kalman.ts`):** a 6-state constant-velocity filter (position and velocity in 3D) with white-noise-acceleration process noise and a Joseph-form update. The radar's range, bearing and elevation errors become a measurement covariance in metres through the Jacobian. Includes the innovation and its normalized square (NIS) for gating, and the horizontal uncertainty ellipse.
- **Tracker (`src/sim/tracker.ts`):**
  - Gating at `d² ≤ 16.27` (chi-square, 3 degrees of freedom, 99.9%) and global nearest-neighbour association, with every track predicted to each plot's own tick.
  - At most one plot per track per antenna pass.
  - The truth link is gone from association: a track's `truthId` now only records which aircraft made its last echo, for the overlay, tests and physics.
- **Batched association:** plots are matched in 0.2 s (18°) batches and committed 0.2 s late, and kill assessment looks at the same lagged arc.
- **Views:**
  - A 2σ uncertainty ellipse around every track on the scope.
  - A ±1σ column in the track table.
  - A truth vs. perception toggle: the "truth" button under the scope, the T key or `?truth=1`. It shows grey true positions and dashed error lines on the scope, the battery's tracks as identity-coloured rings with error lines in 3D, and a "Track vs truth" row in the inspector with the real error next to the filter's own estimate.
- **Concept cards:** the Kalman filter, and gating and association (also opened from the track table).
- **Tests:** 16 new unit tests and 2 new browser tests, 168 unit and 25 browser tests in all.
  - The filter is checked against hand-worked values: prediction and process noise, the halfway update, velocity from two plots, measurement geometry, ellipse axes and a 3 × 3 inverse. A consistency test checks that the NIS averages 3 over 390 updates.
  - Association tests cover crossing tracks, the gate and the once-per-pass rule.
  - Simulation tests check that tracks beat raw echoes, that velocities settle within a few m/s, and that a swarm ends with one track per drone.

**Decisions**

- **Batches to stop track theft.** Matching each echo as it arrived let the first echo of a swarm grab the wide gate of a neighbour's brand-new track, and the swarm's tracks never settled. Matching 18° of sweep together, and committing late, fixes it at a cost of 0.2 s.
- **Truth still guides interceptors in view.** The fire-control picture stays perfect while the target is visible. Kill probability, and so misses, arrives in Step 6. Guiding by the 4-second search track would turn every shot into a near miss for reasons that have nothing to do with the lesson.
- **A filter that tests its own honesty.** The NIS consistency test fails if the filter claims to be surer (or less sure) than it really is, which catches wrong Q or R much better than a single error threshold.
- **σ, not Σ.** CSS upper-casing turned the column header's σ into Σ; that header opts out.

**Next: Step 6 · Decide & engage.** Defended assets, identification mistakes, a "Why?" for every decision, the engagement envelope, kill probability, fire channels, operator approval and saturation.

## Step 4 · Terrain & radar (2026-11-07)

**Built**

- **Core roadmap (plan v0.3):** the eleven remaining steps became five: terrain & radar, tracking, decide & engage, scenarios & lessons, and the v1.0 release. Everything else moved to a "Later" list in `docs/PROJECT_PLAN.md`.
- **Procedural terrain (`src/sim/terrain.ts`):** seeded value noise with rotated octaves and one ridged octave, flat within 3 km of the battery, rising to about 750 m. A 257 × 257 grid, sampled bilinearly, generated once and shared by everything.
- **Line of sight, horizon and coverage (`src/sim/propagation.ts`):** the 4/3 Earth model, a sampled line of sight that tells "below the horizon" from "masked by terrain", and a radial-sweep coverage map of the lowest visible height at every bearing and range.
- **Radar realism (`src/sim/radar.ts`):**
  - Swerling 1 detection probability from the SNR (`Pd = Pfa^(1/(1+SNR))`), with the old ranges now meaning "seen on half the looks".
  - Gaussian noise on range, bearing and elevation.
  - False alarms at `λ = Pfa × cells = 0.6` per turn.
- **Tracks:** a tentative track is dropped if the next look brings nothing (the log says "dropped", usually a false alarm); confirmed tracks survive three silent turns. The command node only fires at tracks seen within the last look.
- **Terrain following:** drones and cruise-missile-like targets hold their height above the ground ahead, jets keep their altitude but clear the hills, all within a climb rate per type.
- **Air drag:** an exponential atmosphere and a ballistic coefficient slow the coasting interceptor. The planner's reach uses the closed form `s = ln(1 + k·v₀·t)/k`, at the air density halfway up to the target.
- **Guidance out of sight:** while terrain hides the target, the interceptor steers toward the track's extrapolated position; it can now hit the ground.
- **Views:**
  - The 3D terrain mesh is drawn by one shader: relief, contours, a 10 km grid, the sweep's glow and the blind zones. Range rings follow the ground, and drops land where the pointer's ray meets the terrain.
  - The scope gets a faint relief layer and the blind-zone overlay. The switch (off, 50 m, 300 m, 1 km) is shared with 3D and the URL (`?coverage=50`).
  - The placement readout predicts where on its route the radar first sees the threat and warns when the terrain hides it. The inspector gains a "Radar view" row: in view (with the chance per look), hidden by terrain (and from what height it would show), or below the horizon.
- **Concept cards:** radar horizon, terrain masking, detection probability, air drag.
- **Tests:** 31 new unit tests and 3 new browser tests, 152 unit and 23 browser tests in all.
  - The physics is checked against hand-computed values: the horizon, curvature drop, ridge shadows, Pd, the 50% range, λ, air density, drag deceleration and the analytic coast (including step-by-step integration against it).
  - Simulation-level tests cover masking behind a ridge, terrain following, the noise level, false alarms that never confirm, detection odds near and far, the full loop over terrain, and replay.
  - Browser tests switch the blind zones on and off, open them from a link, check the inspector's radar view and the placement warning.

**Decisions**

- **An "ideal" radar for exact tests.** `IDEAL_SEARCH_RADAR` (threshold detection, no noise, no false alarms) with `terrain: false` keeps the Step 3 tests exact. New tests cover the realistic radar separately.
- **The terrain has its own seed.** Every run uses the same map, so a scenario's geometry doesn't change when you press "New seed", and the app builds the terrain and coverage once.
- **Masking where it matters.** A first landscape hid little inside 17 km (the cruise-missile-like target's detection range). The hills now start 6 km out, so the south and west hide low flyers until 7 to 10 km out, while the north and east stay open. The contrast is the lesson.
- **False alarms are honest.** They start real tentative tracks, which the M-of-N rule (here: two echoes in a row) drops. The tracker never "knows" which echoes are false.
- **Kill assessment survives masking.** A hit target's track is kept until the beam comes round, even if the target was last seen several turns earlier. Without that, kills behind a ridge went unconfirmed.
- **No screenshots for this step.** The owner will capture all media in one pass once the v1.0 features are in.

**Next: Step 5 · Tracking.** A Kalman filter for position and velocity, gating and nearest-neighbour association instead of the truth link, uncertainty ellipses, track quality, and a truth vs. perception toggle.

## Step 3 · First intercept (2026-11-07)

**Built**

- **Drag-and-drop threats (`src/app/placement`):**
  - Drag a palette card onto the 3D view or the radar scope; or click a card, then the map (this also works on touch screens); or press Enter twice.
  - While placing, a ghost shows the route to the battery in both views, with a readout of range, bearing, altitude, time to the battery and the range at which the radar will first see it. The mouse wheel sets the altitude.
  - Each drop becomes a recorded `spawnTraffic` command, so drops replay exactly.
- **Detection range by radar size:** every size class has an illustrative radar cross section, and the detection range follows the fourth-root law, `R = 30 km × (σ / 1 m²)^¼`. A drone is first seen at 9.5 km, a jet at 36 km.
- **The defense loop, version 1 (`src/sim`):**
  - **Track:** the first echo creates a tentative track; the second confirms it and gives its velocity.
  - **Identify:** an identification check 2 s later: friends answer, civil aircraft broadcast a transponder code, anything else is hostile.
  - **Evaluate:** a hostile whose course passes within 5 km of the battery is a threat, ranked by time to its closest approach.
  - **Assign:** the command node solves for the predicted intercept point and gives the most urgent reachable threat the next launch slot (1.5 s preparation, 2 s between launches, 12 rounds, one reloaded every 30 s).
  - **Engage:** interceptors boost, coast and steer by true proportional navigation with a 30 g limit, integrated in 2 ms sub-steps; the fuze goes off at the analytically computed closest approach, lethal within 15 m.
  - **Assess:** on its next look the radar confirms the kill (no echo where the track should be), or sees the target again and the battery fires another interceptor.
  - **Leaks:** a hostile that comes within 2 km of the battery got through.
  - Scenario hostiles now head for the battery; friendly and civil traffic still passes by.
- **Analysis bar v1:** a live count for each stage (as a funnel; a chip pulses when a track moves on), threats active, down and leaked, interceptors ready, flying and used, the next impact, and a NOW line that narrates the engagement from the battery's point of view.
- **Views:** identity symbols, track numbers, velocity leaders, interceptors and predicted intercept points on the scope; a live track table; a launcher, interceptor models with trails and boost glow, intercept rings and the defended area in 3D; result cards after each kill or leak; the inspector shows the selected aircraft's track and what the defense is doing about it.
- **Concept cards:** detection range, and proportional navigation.
- **Tests:** 32 new unit tests and 4 new browser tests.
  - Unit tests check proportional navigation against hand-computed commands, a full flight from launch to fuze, the analytic closest approach, the intercept solver, detection ranges, the whole loop (including shoot-look-shoot after a miss, leaks, launch intervals, and never engaging friendly or civil traffic), replays with engagements, the header funnel, the track table, the NOW line and the placement rules.
  - Browser tests drag a threat onto the map and wait for its confirmed kill, check the stage counts, and place threats from the keyboard and by tapping.

**Decisions**

- **The command node only sees its tracks.** Identification, evaluation and the intercept solution use the battery's perception, never the truth. Two simplifications remain, both marked in the code: echoes are linked to tracks by the true identity of their source (Step 6 replaces this with gating), and the interceptor is guided to the real target, as if the tracking radar were perfect (Steps 5 and 6 add noise).
- **One visible step at a time.** A track needs a second echo (4 s) to be confirmed, identification takes 2 s, and a launch 1.5 s more. Instant decisions would be unrealistic, and every stage of the analysis bar would flash past in one tick.
- **Shoot-look-shoot.** After a shot the battery waits for the radar's next look before firing again at the same target, so interceptors are not wasted on targets that are already destroyed.
- **Exact endgames.** At closing speeds near 1 km/s a 20 ms tick is 20 m, more than the lethal radius. Interceptors move in 2 ms sub-steps, and the closest approach inside each sub-step is solved in closed form, so a fast pair cannot skip past each other.
- **Perfect hits, for now.** With perfect tracking and no drag, proportional navigation hits a non-maneuvering target almost dead centre. Misses arrive with radar noise, drag and maneuvering targets in later steps; the shoot-look-shoot path is already tested by forcing a miss.
- **Touch places by tapping.** A finger dragging a card would fight the palette's scrolling, so on touch screens you tap a card, then the map. Mouse and pen can do both; the keyboard can place too.
- **Media as animated WebP.** The Step 3 clip shows the whole console, so it uses WebP (2.3 MB) like Step 2. The clip script can now script drags.

**Next: Step 4 · Environment.** Procedural terrain, the standard atmosphere, wind and drag; threat behaviors with routes, terrain following and evasive turns.

## Step 2 · 3D scene (2026-11-06)

**Built**

- **3D battlespace (`src/app/views/3d`):** React Three Fiber, loaded on demand.
  - The ground grid, range rings every 10 km and compass letters.
  - The radar site with its turning antenna, the search beam and the beam's sweep on the ground, all driven by the same snapshots as the radar scope.
- **Aircraft:**
  - models extruded from the palette silhouettes (the drone is built from simple parts);
  - drawn at a fixed size on screen, with a drop line to the ground and a fading 30-second trail;
  - name tags that show the true altitude.
- **Trails in the simulation:** each aircraft keeps its position every 0.5 s for the last 30 s, so trails are part of the deterministic state.
- **Cameras:** Orbit, Top (north up, like the scope), Follow (behind the selected aircraft) and Radar (stand at the antenna and look out), on keys 1–4. Heights can be stretched ×1, ×2 or ×4, and the labels can be toggled (L).
- **One selection everywhere:**
  - Click an aircraft in 3D, an echo on the scope or a line in the event log.
  - The scope boxes the aircraft's newest echo, and the inspector shows its ground truth: speed, altitude, heading, range, and what the radar knows about it.
  - Esc clears the selection.
- **Shareable views:** `?select=3&camera=follow&heights=4`, next to the simulation's `?seed=7&t=60`.
- **Welcome card** for first-time visitors (dismissed once, it stays dismissed). The 3D view falls back to a drawing while it loads, or when the browser has no WebGL.
- **Concept cards:** local coordinates (one map for the scope and the 3D view) and seeing scale (why heights are stretched and aircraft enlarged).
- **Tests:** 28 new unit tests and 7 new browser tests.
  - Unit tests cover the ENU-to-scene mapping, constant screen size, interpolation, trails, label projection, echo picking, the inspector's facts, the view store and URL view options.
  - Browser tests cover rendering and the welcome card, selection from the 3D view, the scope and the event log, the cameras, heights and labels, and view links. The scope test runs the same seed in Node to know exactly where to click.

**Decisions**

- **Truth in 3D, perception on the scope.** The 3D view is labelled "Ground truth": it shows where aircraft really are, while the scope shows only what the radar painted. When tracking arrives (Step 6), the 3D view will show tracks next to the truth.
- **Readable beats true to scale.** At true scale, a drone 30 km away is a twentieth of a pixel and the airspace is a thin sheet. So heights are stretched (×2 by default) and aircraft keep a fixed size on screen, while labels and the inspector always show true values. A concept card explains it.
- **Draw only when something changes.** The canvas renders on demand: a new simulation frame, a view change or a camera move. A paused simulation costs no GPU time.
- **Camera controls with a clamped clock.** drei's component passes the raw time since the last drawing to the camera controls. After a pause that time is seconds long, and camera transitions would jump to the end. The rig owns its camera-controls instance and clamps the step to 50 ms.
- **Labels are one DOM layer, moved every frame.** drei's `Html` gives each label its own React root, which logged unmount errors as aircraft came and went. Labels are now ordinary elements, projected onto their anchors after the camera moves: crisp text, normal clicks, one pass.
- **Trails are fat lines that fade to black.** Plain WebGL lines are one device pixel wide, which is barely visible on high-density screens. Wide lines in three.js have no per-point transparency, so a trail fades its colour towards black and uses max blending. On the dark scene that looks like transparency, and it avoids the bright dots that adding colours leaves where short segments overlap.
- **Ground layers do not write depth.** From 100 km away, the depth buffer cannot separate layers a few metres apart, so they flickered. The ground, grid, sweep and rings are drawn in a fixed order instead; nothing is ever below the ground.
- **three.js loads in its own chunk** (about 270 kB compressed) after the console is on screen, and stays cached between deploys because it rarely changes.
- **A ready signal for tests.** The extra start-up work made one browser test press a key before React was listening. The app now sets `html[data-app-ready]`, and the tests and media scripts wait for it.
- **Phones start without labels.** Seven tags crowd a small screen; tapping an aircraft shows its tag.

**Next: Step 3 · First intercept.** Drag threats onto the map and run the first full loop, from detection to an interceptor guided by proportional navigation, with the analysis bar counting every stage.

## Step 1 · Simulation core (2026-11-06)

**Built**

- **Simulation engine (`src/sim`):**
  - a fixed 20 ms time step (`FixedStepClock`) and seeded random numbers (sfc32, with save and restore);
  - traffic performance data;
  - scenario traffic that crosses the area;
  - a search radar whose rotating beam paints each aircraft as it sweeps past.
  - Commands are applied at tick boundaries and logged, and `Simulation.replay()` rebuilds any run from its seed and command log.
- **Driver (`SimController`):**
  - turns animation frames into whole ticks at the chosen speed;
  - blends the antenna angle between ticks for smooth motion;
  - publishes UI state about ten times per second;
  - reads `seed`, `t`, `paused` and `speed` from the URL.
- **Live radar scope:** a canvas PPI with a sweeping beam and echoes that fade like phosphor. Echo size follows radar size.
- **Live player bar:** play, pause, step (one tick or one second), speed ¼× to 16×, seed, restart and new seed, all with keyboard shortcuts.
- **Live header:** Detect counts radar contacts, and the NOW line narrates the radar picture. Features that arrive later show "—" plus the step that brings them.
- **Event log:** fed by simulation events, split into SCENARIO lines (truth) and RADAR lines (perception).
- **First concept cards (fixed time step, antenna rotation):** they appear in the README through `npm run docs:sync` and in the app through popovers. CI fails if the README falls out of sync.
- **Tests:** 43 new unit tests and 5 new browser tests.
  - Unit tests cover random numbers, the clock, the radar sweep, determinism, replay, kinematics, contacts, scenario traffic, the narrator, URL options and the card parser.
  - Browser tests cover the controls, the keyboard shortcuts, radar contacts, same-seed replay and the concept cards.

**Decisions**

- **The scope shows what the radar painted, not the truth.** Only aircraft the beam has swept past appear. That makes the gap between truth and perception visible from the first step, and the event log labels both sides.
- **Main thread for now.** The engine already has a worker-ready interface (commands in, snapshots out) but runs on the main thread. It moves to a Web Worker when Monte Carlo runs arrive in Step 12.
- **Auto-play, unless the visitor prefers reduced motion.** First-time visitors see the radar working immediately; people who prefer reduced motion start paused.
- **Physics data lives in the sim.** The palette reads speed, altitude and radar size from `src/sim/traffic.ts`, so the interface and the physics cannot disagree.
- **Determinism has one limit.** Runs are identical within one JavaScript engine, but browsers may differ in the last bits of `Math.sin` and similar functions. Replays across different browsers will therefore rely on recorded snapshots.

**Next: Step 2 · 3D scene.** Three.js ground, aircraft models, trails, labels and cameras, kept in sync with the radar scope.

## Step 0 · Launchpad (2026-11-06)

**Built**

- Project scaffold: Vite 8, React 19, TypeScript 6 (strict), Tailwind CSS 4, ESLint, Prettier, Vitest 5 and Playwright.
- Console shell: the header analysis bar (seven-stage pipeline, KPIs, plain-language Now line), the threat palette with six traffic types, an animated radar scope, a 3D battlespace illustration, and placeholders for the track table, inspector, telemetry, event log and timeline. Each placeholder names the step that brings it to life.
- CI/CD: lint, type-check, unit tests, format check, build and browser tests on every push; `main` deploys to GitHub Pages.
- Media scripts: README screenshots and social preview images, rendered with Playwright.
- Docs: README, project plan, architecture, safety, contributing and CLAUDE.md.
- Author credit: "Created by Mohammad Alyounes" is a fixed part of the header on every screen size. It also appears in the footer (© 2026), the README, the social preview card, `NOTICE` and `CITATION.cff`.

**Decisions**

- **TypeScript 6, not 7.** TypeScript 7 (the native compiler) is out, but typescript-eslint supports TypeScript only up to 6.0 today. We will move when the linter does.
- **Playwright pinned to 1.63.0,** the version whose browser build is preinstalled in the cloud dev environment. In CI, browser tests run inside Playwright's official `v1.63.0-noble` container, so nothing is downloaded (installing Chromium on a bare runner took over eight minutes on the first run).
- **CI and deploy are separate workflows.** `CI` checks the code; `Deploy` publishes to GitHub Pages only after CI passes on `main`. The CI badge therefore reports code health, not hosting.
- **Tags and releases come from CI.** This cloud session can push branches but its git proxy rejects tag pushes (HTTP 403). The final commit of each step carries a `Step-Tag:` trailer, and CI creates the tag and a GitHub Release with notes taken from this devlog. Adding `Step-Retag: true` moves an existing step release to the new commit; Step 0 used it once, when the author credit was added.
- **License stays MIT** (owner's choice): maximum reuse. Attribution rests on the copyright notice in LICENSE, plus `NOTICE` and `CITATION.cff`. In this repository, the credit is protected by a browser test and `CODEOWNERS`.
- **Commits are authored by Mohammad Alyounes,** with Claude as co-author. Commits stay signed, so GitHub keeps showing them as verified.
- **Determinism is enforced by the linter.** `src/sim` cannot import UI libraries or call `Math.random()`, `Date.now()`, `new Date()` or browser APIs.
- **The header belongs to the analysis bar.** Play, pause, step and the clock live in the bottom player bar, next to the timeline, like a video player.
- **Deploy paths come from the environment.** CI sets `BASE_PATH=/<repo>/` and `VITE_SITE_URL`, so forks deploy to their own GitHub Pages without code changes.
- **Codespaces first.** The README offers a one-click GitHub Codespaces button (devcontainer with Node 22). A StackBlitz button will be added once it is verified to run Vite 8.

**Next: Step 1 · Simulation core.** A deterministic fixed-step clock, seeded random numbers, entities and events; play, pause, step and speed controls; and the first target moving on the 2D scope.
