# Devlog

One short entry per step, newest first: what was built, the decisions behind it, and what comes next.

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
