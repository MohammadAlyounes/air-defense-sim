# Air Defense Simulator — Project Plan

**Version 1.0 · 2026-11-09** · Complete. The simulator was built in six steps (0 to 5), and version 1.0.0 is the finished project.

This plan describes the simulator as built: what it is for, how it works and how it was made. The models and their equations are in [MODELS.md](MODELS.md), the code structure in [ARCHITECTURE.md](ARCHITECTURE.md), and the build decisions in [DEVLOG.md](DEVLOG.md).

---

## 1. Owner requirements

1. **Polished and approachable.** Attractive and intuitive for the general public, credible for specialists: _simple by default, deep on demand_.
2. **Drag-and-drop threats.** Pick any drone, missile or jet in the interface, drag it onto the map, and watch the battery respond live.
3. **Full analysis bar in the header.** An always-visible live summary of the whole defense loop and its key numbers.
4. **Easy to see and to run.** A live demo, animated clips in the README, and source code that is easy to clone and run.
5. **A README that is easy to read and teaches.** Every model comes with a short, plain-language explanation of its physics.
6. **Useful, educational, real, attractive.** Real physics principles at textbook level, fictional equipment, polished visuals.
7. **Generic, non-operational and safe** (Section 11).
8. **Fixed author credit.** "Created by Mohammad Alyounes" is a permanent part of the header on every screen size, and appears in the footer, README, `NOTICE`, `CITATION.cff` and the social preview card.

## 2. Vision and audience

**One-liner:** an open-source browser sandbox where anyone can drag a threat onto a map and watch, control and question how a generic air-defense system turns radar blips into decisions — and see why it succeeds or fails.

| Audience                         | What they need                                                    |
| -------------------------------- | ----------------------------------------------------------------- |
| General public, students         | A 10-second "wow", obvious interactions, plain-language narration |
| Specialists, engineers, teachers | Correct models, visible math, clean tested code                   |

**Learning outcomes.** After using the simulator, a learner can explain:

- why low flyers hide behind the Earth's curve and behind terrain;
- why small targets are hard to see: detection range ∝ RCS^¼, so a target with 16× less radar cross section is seen at half the range;
- why raw radar data must be filtered, and what track uncertainty looks like;
- why identification matters more than shooting;
- how threats get ranked and fire channels assigned when there are more threats than channels (saturation);
- why "lead the target" guidance works, and why a coasting interceptor's reach is limited;
- why outcomes are probabilities, not certainties.

## 3. The first minute

1. **Welcome.** The visitor opens the live demo. Scenario traffic is already crossing the area, and a welcome card over the 3D view says what to try first.
2. **First drop.** The visitor drags a cruise-missile-like card onto the 3D view or the radar scope. A ghost shows its route to the battery, how long it will take and when the radar will first see it.
3. **The loop runs.** The analysis bar counts the track through every stage, and the **Now** line narrates what is happening in plain words.
4. **Result.** After the intercept, a result card sums up the engagement: when it was detected, how long the battery took and how many interceptors it used.
5. **Going deeper.** Curious visitors select the track and read the inspector's **Why?**, open a concept card from a graduation-cap button, or switch to SEMI-AUTO and approve every shot themselves.

## 4. Hero interaction A — drag-and-drop threat palette

**The palette** is a dock on the left, or a row under the 3D view on phones. Each card shows an icon, a name, three stat bars (speed, altitude and radar size) and one line on why the threat is hard to stop.

| Card                | Default behavior                                  | Why it is hard to stop                         |
| ------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Small drone         | slow, low, follows the ground, pushed by the wind | tiny radar size, can vanish in ground clutter  |
| Drone swarm ×6      | spread group, staggered arrival                   | fills the fire channels                        |
| Cruise-missile-like | fast, hugs terrain, dog-leg route                 | hides below the radar horizon and behind hills |
| Fast jet            | very fast, evasive break turn when engaged        | outruns and outturns a tired interceptor       |
| Friendly aircraft   | answers identification checks                     | must **not** be engaged                        |
| Civil airliner      | flies a civil air corridor                        | must **not** be engaged                        |

**Gestures:**

- **Drag** a card onto the 3D view or the radar scope (mouse and pen). A ghost shows the route to the battery, the flight time through the wind and when the radar will first see it; the mouse wheel sets the altitude.
- **Click (or tap) a card, then the map:** the same placement, and the way to place on touch screens.
- **Keyboard:** press Enter on a card to pick it up, and Enter again to place it 30 km out.
- **An airliner** placed by hand joins the nearest civil corridor, and its ghost points the way.
- Every placement becomes a recorded `spawnTraffic` command, so it replays exactly.

**Implementation:** a custom pointer-event layer for mouse, pen and touch; 3D drops cast a ray onto the terrain, scope drops invert the scope's drawing transform.

## 5. Hero interaction B — header analysis bar

```
DETECT 4 › TRACK 4 › IDENTIFY 3 › EVALUATE 3 › ASSIGN 2 › ENGAGE 2 › ASSESS 1        v1.0.0 · Complete
Threats 5 active · 3 down · 0 leaked │ Interceptors 9 ready · 2 flying │ Fire channels 2/3 │ Next impact 00:42 (T3 → Town)
WCS TIGHT · AUTO │ NOW: Engaging T3 (cruise missile) — intercept in 12 s, kill probability 0.82
```

- **Pipeline chips:** a live count for each stage. A chip pulses when a track enters that stage, and hovering shows a one-line definition of the stage.
- **Key numbers:**
  - threats: active, down, leaked, and identification errors when there are any;
  - interceptors: ready, flying, used;
  - fire channels, shown as a saturation meter;
  - next-impact countdown: the most urgent threat and the asset it is heading for;
  - weapons control status and operator mode, as clickable toggles.
- **Now line:** the command node's current top decision in plain language.
- **Phones:** the pipeline and the Now line; the numbers start at tablet width.

## 6. Toolkit

| Layer              | Choice                                                  | Why                                                                     |
| ------------------ | ------------------------------------------------------- | ----------------------------------------------------------------------- |
| Language           | TypeScript 6.0, strict                                  | Type-safe math and state; readable for the community                    |
| Dev server / build | Vite 8                                                  | Instant `npm run dev`, static build for free hosting                    |
| UI                 | React 19                                                | Largest ecosystem; first-class 3D bindings                              |
| 3D                 | Three.js r187 + React Three Fiber 9 + drei 10           | Cameras, labels, lines and instancing out of the box                    |
| 2D scope           | Custom Canvas renderer                                  | Authentic radar screen (sweep, phosphor fade) with its own track shapes |
| Simulation         | Plain TypeScript with no DOM, fixed step, seeded RNG    | Deterministic, testable headless, ready for a Web Worker                |
| State              | Zustand 5                                               | Tiny; the render loop reads it without React re-renders                 |
| UI kit             | Tailwind CSS 4 + Radix UI (tooltip, popover) + Lucide   | Accessible controls; a dark console theme                               |
| Tests              | Vitest 5 + Playwright 1.63                              | Physics unit tests, determinism tests, browser tests, screenshots       |
| CI / hosting       | GitHub Actions → GitHub Pages                           | Every push tested and deployed; an always-live demo URL                 |
| Media              | Playwright scripts (screenshots, GIF and animated WebP) | Repeatable README media from scripted, seeded runs                      |

**Not chosen:**

- **Unity or Godot web builds:** heavy, and hard to fork.
- **CesiumJS:** a real globe means real geography, which conflicts with the safety goal.
- **Babylon.js:** a smaller React ecosystem.
- **Rust/WASM:** raises the barrier for contributors.

## 7. Architecture

```
┌──────────────────────────── Browser ─────────────────────────────┐
│ UI (React): Analysis Bar · Threat Palette · 3D Truth View ·      │
│   2D Sensor Scope · Track Table · Inspector "Why?" · Event Log · │
│   Player Bar                                                     │
│        ▲ snapshots + events (~30 Hz)          │ commands         │
│        │                                      ▼                  │
│ SIM ENGINE (pure TypeScript, deterministic, 50 Hz, worker-ready) │
│  Environment → Movers → Sensors → Tracker → Classify/ID →        │
│  Threat Eval → Weapon Assign → Launch/Guidance → Fuze →          │
│  Kill Assessment → Recorder (snapshots + event stream)           │
└──────────────────────────────────────────────────────────────────┘
```

- **One-way boundaries.** The sim never imports UI code. The UI changes the sim only through commands such as `spawnTraffic`, `setRules`, `approveEngagement` and `holdFire`.
- **Determinism.** The same seed and command log always produce the same run, so any run can be replayed exactly and any moment shared as a link (`?seed=7&t=60`).
- **Smooth rendering.** The renderer interpolates between sim ticks, so motion stays smooth at any simulation speed.
- **Endgame accuracy.** Interceptors fly in 2 ms sub-steps, and the miss distance is computed analytically inside each one, so a fast interceptor cannot jump past its target between ticks.
- **Swappable models.** The atmosphere, radar, tracker, guidance and fuze models each sit behind a small interface.

```
src/sim/   core · traffic · terrain · propagation · atmosphere · flight · radar · kalman · tracker ·
           classify · airspace · assets · c2 · interceptor · scenario · simulation
src/app/   analysis-bar · palette · placement · views (scope, 3D) · panels · layout · sim · view · world
docs/      PROJECT_PLAN · ARCHITECTURE · MODELS · DEVLOG · concepts/ · media/
```

## 8. Simulation model

### 8.1 Physics and environment (textbook level, 3-DOF point mass)

| Model            | Approach                                                                                                                                   | What it teaches                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Earth and frame  | Local East-North-Up frame. Line of sight uses Earth curvature with a 4/3 radius to account for radar refraction                            | Flat maps work locally; radar still sees a curved Earth               |
| Radar horizon    | `d ≈ 4.12 (√h_radar + √h_target)` km, heights in metres                                                                                    | A target at 50 m vanishes beyond ~43 km from a 12 m mast              |
| Terrain          | Seeded procedural heightmap; line of sight over it                                                                                         | Valleys hide threats                                                  |
| Atmosphere       | International Standard Atmosphere → density with height                                                                                    | Thin air means less drag                                              |
| Gravity and drag | `F = ½ ρ v² C_d A` on the interceptor                                                                                                      | Energy is finite; coasting interceptors slow down                     |
| Wind             | Per-run wind, stronger higher up                                                                                                           | Huge for a 40 m/s drone, minor for a 240 m/s missile                  |
| Maneuver limits  | Bank angle and g-load give the turn radius `R = v²/a`; climb limits                                                                        | Fast things turn wide                                                 |
| Detection        | Normalized radar equation (`SNR ∝ RCS / R⁴`), Swerling-I detection `Pd = Pfa^(1/(1+SNR))`, false alarms, ground clutter, low-Doppler notch | Detection is a probability; crossing or hovering targets can fade out |
| Measurement      | Range, azimuth and elevation noise                                                                                                         | Why raw tracks wobble                                                 |
| Tracking         | Gating, global nearest-neighbour association, two-plot confirmation, Kalman filter, coasting and dropping                                  | Estimating position from noisy data                                   |
| Guidance         | Boost, then coast, steered by proportional navigation (`a = N·Vc·λ̇`) toward a predicted intercept point                                    | Why leading the target works                                          |
| Fuze and outcome | Analytic closest approach → kill probability inside the lethal radius                                                                      | Probability, not certainty                                            |

### 8.2 Defender battery (fictional, round-number parameters)

- **Search radar:** rotating, 360°, one turn every 4 s. It detects targets and feeds the tracker.
- **Tracking radar:** three fire channels, each guiding one engagement at a time, which is where the saturation lesson comes from.
- **Command node:** runs tracking, identification, threat evaluation and weapon assignment, following the rules set by the user:
  - **Weapons control:** HOLD (never fire), TIGHT (hostile tracks only; the default) or FREE (anything not identified as friendly or civil).
  - **Firing doctrine:** shoot-look-shoot (fire one, check the result, fire again).
  - **Operator mode:** AUTO, or SEMI-AUTO (the system proposes each shot, you approve or hold fire).
- **Launcher:** 12 ready rounds; one is reloaded every 30 s while it is not full.
- **Interceptor:** a generic missile that boosts and then coasts, with a 30 g steering limit and a 34 s longest planned flight.
- **Defended assets:** the battery, a town and a power plant, each with a threat ring.

### 8.3 Threats and other traffic (illustrative values)

| Type                | Speed   | Altitude           | Radar size | Behavior                                   | Teaching role                           |
| ------------------- | ------- | ------------------ | ---------- | ------------------------------------------ | --------------------------------------- |
| Small drone         | 40 m/s  | 300 m above ground | tiny       | follows the ground, pushed by wind; swarms | small targets, clutter, saturation      |
| Cruise-missile-like | 240 m/s | 50 m above ground  | small      | follows terrain, dog-leg route             | horizon and masking, short warning time |
| Fast jet            | 340 m/s | 6 km               | medium     | inbound run, evasive break when engaged    | maneuvering vs. interceptor energy      |
| Friendly aircraft   | 200 m/s | 4 km               | medium     | answers identification checks              | avoiding friendly fire                  |
| Civil airliner      | 230 m/s | 11 km              | large      | flies a civil air corridor                 | identification and rules of engagement  |

### 8.4 The defense loop

| Stage               | What the sim does                                                                                                            | What the learner sees                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Detect              | Scan, signal-to-noise ratio, probability of detection, horizon, masking, clutter                                             | Sweep line, blips, coverage shading, "why not detected?"                      |
| Track               | Plot-to-track association, two-plot confirmation, Kalman filter                                                              | Track symbol, uncertainty ellipse, track table                                |
| Classify / Identify | Kinematic classifier + identification checks + civil air corridors → identifying, unknown, suspect, hostile, friend or civil | Symbol shape and color, the evidence in "Why?"                                |
| Evaluate            | Closest point of approach and time to it for each asset → threat ranking                                                     | Ranked track table, next-impact countdown                                     |
| Assign              | Can an interceptor reach it? Predicted intercept point, kill probability, free channels, ammunition, rules                   | Approval card in SEMI-AUTO, the shot or the reason for waiting                |
| Engage              | Launch, boost and coast, proportional navigation                                                                             | Interceptor trail, predicted intercept point                                  |
| Assess              | Fuze result → the radar confirms the kill → re-engages if the target survived                                                | Hit or miss, "kill assessed", a result card, leaks when a threat gets through |

## 9. Features

1. **Drag-and-drop threat palette** (Section 4).
2. **Header analysis bar** with the plain-language Now line (Section 5).
3. **Truth vs. perception:** a toggle shows where the aircraft really are next to the battery's tracks, with their errors.
4. **"Why?" on every decision:** the inspector explains, one sentence per step, a track's identity, the threat it poses, the rules, and the shot or the reason for waiting.
5. **Coverage maps:** one switch under the scope shades, on the scope and on the 3D terrain, where the radar cannot see a target at 50 m, 300 m or 1 km above the ground, or which ground it lights.
6. **Rules you control:** weapons control, operator approval, fire channels, kill probability and the engagement envelope, shown as a dome in 3D.
7. **Two views of one world:** a 3D battlespace (orbit, top, follow and radar cameras; height stretch; labels) and a radar scope with phosphor fade, both in step with the inspector, the track table and the event log.
8. **Controls:** play, pause, step one tick or one second, speed from ¼× to 16×, restart and new seed, all with keyboard shortcuts.
9. **Concept cards in the app:** the graduation-cap buttons open the same cards as the README.
10. **Shareable moments:** URL options for the seed, the time and the view (`?seed=7&t=60&select=3&camera=follow`).

## 10. UI layout and visual language

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ANALYSIS BAR: pipeline counts · key numbers · rules · NOW line · version │
├───────────┬───────────────────────────────┬──────────────────────────────┤
│ THREAT    │                               │ 2D SENSOR SCOPE              │
│ PALETTE   │   3D TRUTH VIEW               │                              │
│           │   (drop threats here)         ├──────────────────────────────┤
│ drone     │                               │ TRACK TABLE                  │
│ swarm     ├───────────────────────────────┴───┬──────────────────────────┤
│ cruise    │ INSPECTOR "WHY?"                  │ EVENT LOG                │
│ jet       ├───────────────────────────────────┴──────────────────────────┤
│ friendly  │ PLAYER BAR: play · step · speed · clock · seed · restart     │
│ airliner  │                                                              │
└───────────┴──────────────────────────────────────────────────────────────┘
```

- **Theme:** a dark "operations console" theme: charcoal and navy, cyan accents.
- **One color language everywhere:** hostile red, suspect orange, unknown yellow, friend blue, civil green. Each color always comes with a matching shape (diamond, quatrefoil, circle, square).
- **Motion:** restrained effects; the pulses and pings respect the reduced-motion setting.
- **Devices:** desktop first; on phones the panels stack, and threats are placed by tapping.

## 11. Safety guardrails

- **Generic, fictional equipment only:** no real system names, specifications or performance data. Parameters are round numbers chosen for teaching.
- **Textbook-level physics only:** 3-DOF point mass and public equations. No real seeker, warhead or propulsion detail.
- **Fictional terrain and airspace:** generated procedurally, with invented air corridors. No real-world bases, cities, borders or air routes.
- **Defensive framing:** non-graphic effects. Identification and rules-of-engagement mistakes count as failures.
- **Visible rules:** a note in the README and `SAFETY.md` with the rules for contributions (no recreations of real sites, no real-system parameter sheets).

## 12. Quality bar

- **Tests:**
  - physics checks against known values: atmosphere tables, horizon formula, turn radius, radar equation, Kalman filter steps;
  - filter consistency (the normalized innovation averages 3);
  - guidance hitting a straight-flying target;
  - determinism: the same seed and commands give the same state hash;
  - Playwright browser tests of the whole console.
- **Performance targets:** 60 fps with the full scenario traffic and under 2 ms per sim tick; the 3D code is split out so the console loads first, and the 3D view draws only when something changes.
- **Docs:** README, ARCHITECTURE, MODELS (every equation, assumption and limitation), CONTRIBUTING, SAFETY, DEVLOG and the concept cards.
- **License:** MIT for the code, CC BY 4.0 for the docs and concept cards.

## 13. Release kit

- **An always-live demo.** GitHub Pages, deployed by CI on every push to `main`.
- **A fast first impression.** A welcome card, scenario traffic from the first second, and the 3D code loaded in its own chunk.
- **Rich link previews.** Open Graph tags with a link-preview image for the demo site, and a social preview image for the GitHub repository.
- **README media.** A screenshot, a phone screenshot and a GIF or animated WebP for every step, made by scripts from seeded runs.
- **Clone and run.** Four commands (below), Node 22+, npm only, and an _Open in GitHub Codespaces_ button for running without installing anything.
- **Every step a release.** Each step is a git tag and a GitHub Release (for example `step-04-environment-radar`), so anyone can check out a step and see how the project grew. Version 1.0.0 is the complete simulator.
- **Signals for specialists.** CI badges, strict TypeScript, physics tests, the ARCHITECTURE and MODELS docs, and a clean commit history.
- **Built with Claude.** `CLAUDE.md` and `docs/DEVLOG.md` show how the project was built with Claude Code.

```bash
git clone https://github.com/MohammadAlyounes/air-defense-sim.git
cd air-defense-sim
npm install
npm run dev
```

## 14. README and documentation

**README outline, top to bottom:**

1. Title, one-liner, social preview image.
2. Buttons: Live demo · Run it locally · Build log · Project plan.
3. Badges: build, status, version, license, tech stack.
4. What you can do.
5. Quick start: four commands.
6. How it works: the 7-stage defense loop as one diagram.
7. **The physics, in plain language:** the concept cards.
8. **Build log:** one entry per step, with a clip, a screenshot and its git tag.
9. Status · Under the hood · Safety and scope · Built with Claude · License.

**Writing rules:**

- Plain language first, math second.
- At most three sentences per concept and at most one formula per card.
- Every card ends with where to see it in the simulator.
- Derivations and references go in `docs/MODELS.md`, not the README.

**Concept card format (example):**

> **Radar horizon — why low flyers hide**
>
> The Earth curves away, so a radar cannot see targets below its horizon. Radio waves bend slightly around the curve, so we model an Earth 4/3 larger than the real one.
>
> - **Formula:** `d ≈ 4.12 × (√h_radar + √h_target)` km, heights in metres
> - **Example:** a radar mast of 12 m sees a target flying at 50 m only within ~43 km.
> - **See it:** select a low aircraft far out: the inspector's "Radar view" row says when it is below the horizon.

**One source of truth:** the concept texts live in `docs/concepts/*.md`. The app imports them for its concept cards, and a small sync script (`npm run docs:sync`) copies the short cards into the README. The README, docs and app therefore never disagree.

## 15. How it was built

Each step ended with a working demo, passing tests, concept cards for its new physics and a git tag. All six are done.

| Step | Tag                         | What it added                                                                                                                                                                                                                     | Concept cards                                                                                                                                              |
| ---- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 ✓  | `step-00-launchpad`         | Repo, tooling, CI, live demo URL (app shell), README, CLAUDE.md, Codespaces                                                                                                                                                       | —                                                                                                                                                          |
| 1 ✓  | `step-01-sim-core`          | Deterministic clock, play/pause/step/speed, scenario traffic on the 2D scope                                                                                                                                                      | Fixed time step and determinism; antenna rotation                                                                                                          |
| 2 ✓  | `step-02-3d-scene`          | 3D ground, models, trails, labels, cameras; 2D↔3D selection sync                                                                                                                                                                  | Local coordinates (ENU); seeing scale                                                                                                                      |
| 3 ✓  | `step-03-first-intercept`   | First full loop + drag-and-drop palette + analysis bar                                                                                                                                                                            | Detection range; proportional navigation                                                                                                                   |
| 4 ✓  | `step-04-environment-radar` | Terrain, atmosphere, wind, drag; threat routes and terrain following; radar equation, false alarms, noise, horizon, masking, clutter; coverage maps                                                                               | Radar horizon; terrain masking; detection probability; air drag; standard atmosphere; wind; turn radius; radar cross section; clutter and Doppler          |
| 5 ✓  | `step-05-track-identify`    | Kalman tracking, gating, uncertainty ellipses, truth vs. perception; identification, classifier, corridors, assets, threat ranking with "Why?"; rules of engagement, operator approval, fire channels, kill probability, envelope | Kalman filter; gating and association; closest point of approach; identification friend-or-foe; engagement envelope; kill probability; rules of engagement |

Version **1.0.0** is released together with Step 5.

**Workflow for every step:**

1. Build the feature.
2. Run tests, lint and typecheck until they pass.
3. Run the app in headless Chromium and capture screenshots or a clip.
4. Update the README (concept cards, build log, status) and `docs/DEVLOG.md`.
5. Commit and push; CI creates the tag and the GitHub Release.
6. The owner reviews.

## 16. Risks and mitigations

| Risk                                 | Mitigation                                                                |
| ------------------------------------ | ------------------------------------------------------------------------- |
| Scope creep                          | A fixed set of steps, each with a working demo                            |
| Overwhelming beginners               | Progressive disclosure, the Now line, tooltips and concept cards          |
| Physics bugs at high closing speed   | Analytic closest approach, endgame sub-steps, unit tests                  |
| Performance (line of sight)          | Coverage maps computed once, a 3D view that draws only on change          |
| Slow software rendering in the cloud | Seeded, scripted runs for screenshots and clips                           |
| Drift toward real-world realism      | Fictional parameters; every model change checked against the safety rules |

## 17. Decisions and defaults

| Decision                  | Default                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Repository                | [`MohammadAlyounes/air-defense-sim`](https://github.com/MohammadAlyounes/air-defense-sim), public |
| Name                      | "Air Defense Simulator" (no real system names)                                                    |
| License                   | MIT (code) + CC BY 4.0 (docs, concept cards): confirmed by the owner                              |
| Author credit             | "Created by Mohammad Alyounes", fixed in the header; commits authored by Mohammad Alyounes        |
| UI language               | English, with UI text kept in one place                                                           |
| Visual style              | Dark operations-console theme                                                                     |
| Scope                     | Complete at Step 5, released as version 1.0.0                                                     |
| Package manager / runtime | npm / Node 22+                                                                                    |

## 18. Verified build environment (2026-11-06)

Node 22.23 · npm 10.9 · git 2.43 · headless Chromium with WebGL2 (SwiftShader) · Playwright · ffmpeg 6.1.

This is enough to build, test, and capture 3D screenshots and clips in the cloud session.
