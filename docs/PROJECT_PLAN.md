# Air Defense Simulator — Project Plan

**Version 0.3 · 2026-11-07** · Steps 0–3 are built; v0.3 folds the remaining steps into a five-step core roadmap (section 16).

v0.2 adds four things:

- portfolio and LinkedIn requirements;
- the drag-and-drop threat palette;
- the header analysis bar;
- the README rule to explain the physics at every step.

---

## 1. Owner requirements

1. **Portfolio-grade and shareable on LinkedIn.** Attractive and intuitive for the general public, credible for specialists: _simple by default, deep on demand_.
2. **Drag-and-drop threats.** Pick any drone, missile or jet in the interface, drag it onto the map, and watch the battery respond live.
3. **Full analysis bar in the header.** An always-visible live summary of the whole defense loop and its key numbers.
4. **Demo video, plus source code that is easy to clone and run.**
5. **A README that is easy to read and teaches.** Every development step adds a short, plain-language explanation of the physics it introduced.
6. **Useful, educational, real, attractive.** Real physics principles at textbook level, fictional equipment, polished visuals.
7. **Generic, non-operational and safe** (Section 13).
8. **Fixed author credit.** "Created by Mohammad Alyounes" is a permanent part of the header on every screen size, and appears in the footer, README, `NOTICE`, `CITATION.cff` and the social preview card.

## 2. Vision and audience

**One-liner:** an open-source browser sandbox where anyone can drag a threat onto a map and watch, control and question how a generic air-defense system turns radar blips into decisions — and see why it succeeds or fails.

| Audience                                     | What they need                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| General public, LinkedIn visitors, students  | A 10-second "wow", obvious interactions, plain-language narration      |
| Specialists, engineers, recruiters, teachers | Correct models, visible math, telemetry and exports, clean tested code |

**Learning outcomes.** After using the simulator, a learner can explain:

- why low flyers hide behind the Earth's curve and behind terrain;
- why small targets are hard to see: detection range ∝ RCS^¼, so a target with 16× less radar cross section is seen at half the range;
- why raw radar data must be filtered, and what track uncertainty looks like;
- why identification matters more than shooting;
- how threats get ranked and weapons assigned when resources run out (saturation);
- why "lead the target" guidance beats pure pursuit, and why missiles run out of energy;
- why outcomes are probabilities, not certainties.

## 3. The first minute (signature experience)

1. **Intro.** The visitor opens the live demo and a ~20-second cinematic intro plays with captions. A drone swarm and a cruise-missile-like target approach, and the battery detects, tracks and intercepts them.
2. **Invitation.** An overlay says: _"Drag a threat onto the map to see how the defense reacts."_ An animated hint points at the threat palette.
3. **First drop.** The visitor drags a cruise-missile-like card onto the map. A ghost route aims at the nearest town automatically, and the visitor releases it.
4. **The loop runs.** The analysis bar lights up stage by stage, and the **Now** line narrates what is happening in plain words.
5. **Result.** After the intercept, a result card sums up the engagement: _detected at 38 km · 41 s from detection to intercept · 1 interceptor used_.
6. **Going deeper.** Curious visitors click **Why?** or open a lesson. Specialists switch to **Expert** mode for equations, telemetry and exports.

## 4. Hero interaction A — drag-and-drop threat palette

**The palette** is a dock on the left, or a tray at the bottom on small screens. Each card shows:

- an icon and a name;
- three stat bars: speed, altitude and radar size;
- one line on why the threat is hard to stop.

| Card                | Default behavior                     | Why it is hard to stop                         |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| Small drone         | slow, low, pushed by wind            | tiny radar size, blends into ground clutter    |
| Drone swarm ×6      | spread group, staggered arrival      | saturates radar channels and launchers         |
| Cruise-missile-like | fast, hugs terrain, dog-leg route    | hides below the radar horizon and behind hills |
| Fast jet            | very fast, evasive turn when engaged | outruns and outturns a tired interceptor       |
| Friendly aircraft   | answers identification checks        | must **not** be engaged                        |
| Civil airliner      | flies the air corridor               | must **not** be engaged                        |

**Gestures:**

- **Drag** a card onto the 2D map or the 3D terrain. A ghost marker appears with a predicted route aimed at the nearest defended asset, plus a range and bearing readout.
- **While dragging,** the mouse wheel (or a slider in a small popover) sets the altitude. Hold Shift to aim manually.
- **Release** to spawn the threat with a ripple effect. The simulation keeps running and the battery reacts at once.
- **After the drop:**
  - drag the route's arrowhead or waypoints to reshape it;
  - click the threat to inspect it and edit its speed or altitude;
  - press Delete (or long-press) to remove it.
- **Touch:** tap a card, tap the map, then drag to aim.
- **Keyboard:** select a card, press Enter, move with the arrow keys, and press Enter to place.
- **Defender units too:** the same mechanism moves radars, launchers and assets. Coverage maps update live, which makes radar siting a hands-on lesson.

**Implementation:**

- A custom pointer-event drag layer handles both mouse and touch.
- 3D drops raycast onto the terrain; 2D drops use the inverse view transform.
- Each drop becomes a `spawnThreat` command into the deterministic sim, so it is recorded and can be replayed.

## 5. Hero interaction B — header analysis bar

```
▶ ❚❚ ⏭ 2×  T+01:24 │ DETECT 4 › TRACK 4 › IDENTIFY 3 › EVALUATE 3 › ASSIGN 2 › ENGAGE 2 › ASSESS 1
Threats 5 active · 3 down · 0 leaked │ Interceptors 6 ready · 2 flying │ Channels 2/4 │ Next impact 00:42 (T3 → Town)
WCS TIGHT · SEMI-AUTO │ NOW: Engaging T3 (cruise missile) — intercept in 12 s, kill probability 0.82
```

- **Pipeline chips:** a live count for each stage.
  - A chip pulses when a track enters that stage.
  - Clicking a chip highlights those tracks.
  - Hovering shows a one-line definition of the stage.
- **KPI tiles:**
  - threats: active, down, leaked;
  - interceptors: ready, flying, used;
  - fire channels, shown as a saturation meter;
  - next-impact countdown: the most urgent threat and the asset it is heading for;
  - weapons control status and operator mode, as clickable toggles.
- **Now line:** the command node's current top decision in plain language.
- **Expert mode adds:**
  - time spent per stage;
  - predicted vs. achieved kill probability;
  - cost-exchange ratio;
  - false-track count.
- **Mobile:** collapses to the pipeline and the Now line; tap to expand.
- **Grows with the build:** the first version ships at Step 3 and is complete by Step 6.

## 6. Toolkit (versions checked on npm, 2026-11-03)

| Layer              | Choice                                                                         | Why                                                                         |
| ------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| Language           | TypeScript 6.0, strict (7.x once typescript-eslint supports it)                | Type-safe math and state; readable for the community                        |
| Dev server / build | Vite 8                                                                         | Instant `npm run dev`, Web Worker support, static build for free hosting    |
| UI                 | React 19                                                                       | Largest ecosystem; first-class 3D bindings                                  |
| 3D                 | Three.js r187 + React Three Fiber 9 + drei 10 + postprocessing                 | Cameras, labels, lines, instancing and glow effects out of the box          |
| 2D scope           | Custom Canvas renderer + milsymbol 3                                           | Authentic radar screen (sweep, phosphor fade); standard-style track symbols |
| Simulation         | Plain TypeScript with no DOM, fixed step, seeded RNG, Web Worker via Comlink 4 | Deterministic, testable headless, faster than real time, Monte Carlo        |
| State              | Zustand 5                                                                      | Tiny; the render loop reads it without React re-renders                     |
| UI kit             | Tailwind CSS 4 + Radix UI + lucide icons                                       | Accessible controls; dark console and light projector themes                |
| Layout             | react-resizable-panels 4                                                       | Resizable console with layout presets                                       |
| Charts             | uPlot 1.6                                                                      | Live 60 fps telemetry with a tiny footprint                                 |
| Equations          | KaTeX 0.19                                                                     | Live formulas in concept and lesson cards                                   |
| Scenarios          | Zod 4 + lz-string + idb-keyval                                                 | Versioned, validated files; share links; autosave                           |
| Terrain            | simplex-noise 4                                                                | Seeded, procedural, fictional terrain                                       |
| Tests              | Vitest 5 + fast-check 4 + Playwright 1.64                                      | Physics unit tests, determinism tests, browser tests, screenshots           |
| CI / hosting       | GitHub Actions → GitHub Pages                                                  | Every push tested and deployed; an always-live demo URL                     |
| Media              | Playwright + ffmpeg                                                            | Screenshots, GIFs and the demo video, rendered frame by frame               |
| Dev only           | Leva                                                                           | Live tuning of physics constants                                            |
| Optional           | vite-plugin-pwa, Web Audio, i18next                                            | Offline classroom use, sound cues, translations                             |

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
│   Telemetry · Lessons · Timeline                                 │
│        ▲ snapshots + events (~30 Hz)          │ commands         │
│        │                                      ▼                  │
│ SIM ENGINE (Web Worker, pure TypeScript, deterministic, 50 Hz)   │
│  Environment → Movers → Sensors → Tracker → Classify/ID →        │
│  Threat Eval → Weapon Assign → Launch/Guidance → Fuze →          │
│  Kill Assessment → Recorder (snapshots + event stream)           │
└──────────────────────────────────────────────────────────────────┘
```

- **One-way boundaries.** The sim never imports UI code. The UI changes the sim only through commands such as `spawnThreat`, `setParam`, `approveEngagement` and `seek`.
- **Determinism.** The same seed, scenario and command log always produce the same run. Save files stay tiny, and rewinding means restoring the nearest snapshot and re-simulating from there.
- **Smooth rendering.** The renderer interpolates between sim ticks, so motion stays at 60 fps at any simulation speed.
- **Endgame accuracy.** Miss distance is computed analytically inside each step, and extra sub-steps run near the intercept. A fast missile cannot jump past its target between ticks.
- **Swappable models.** The atmosphere, radar, tracker, guidance and fuze models each sit behind a small interface.

```
src/sim/   core · math · environment · entities · sensors · c2 · weapons · scenario · recorder
src/app/   analysis-bar · palette · views/3d · views/2d · panels · controls · lessons · store · theme
docs/      PROJECT_PLAN · ARCHITECTURE · MODELS · SCENARIO_FORMAT · DEVLOG · concepts/
scenarios/ tutorials · challenges · sandbox
```

## 8. Simulation model

### 8.1 Physics and environment (textbook level, 3-DOF point mass)

| Model            | Approach                                                                                                                                   | What it teaches                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Earth and frame  | Local East-North-Up frame (~120 km box). Line-of-sight uses Earth curvature with a 4/3 radius to account for radar refraction              | Flat maps work locally; radar still sees a curved Earth               |
| Radar horizon    | `d ≈ 4.12 (√h_radar + √h_target)` km, heights in metres                                                                                    | A target at 50 m vanishes beyond ~43 km from a 12 m mast              |
| Terrain          | Seeded procedural heightmap; ray-marched line-of-sight                                                                                     | Valleys hide threats; radar siting matters                            |
| Atmosphere       | International Standard Atmosphere → density, temperature, speed of sound                                                                   | Thin air means less drag, but also less missile agility               |
| Gravity and drag | `F = ½ ρ v² C_d(Mach) A`, measured relative to the wind                                                                                    | Energy is finite; coasting missiles slow down                         |
| Wind             | Altitude profile plus gusts                                                                                                                | Huge for a 40 m/s drone, minor for a 250 m/s missile                  |
| Maneuver limits  | Max g-load gives the turn radius `R = v²/a`; climb and speed limits                                                                        | Fast things turn wide                                                 |
| Detection        | Normalized radar equation (`SNR ∝ RCS / R⁴`), Swerling-I detection `Pd = Pfa^(1/(1+SNR))`, false alarms, ground clutter, low-Doppler notch | Detection is a probability; crossing or hovering targets can fade out |
| Measurement      | Range, azimuth and elevation noise                                                                                                         | Why raw tracks wobble                                                 |
| Tracking         | Gating, nearest-neighbor association, M-of-N confirmation, Kalman filter, coast/drop                                                       | Estimating position from noisy data                                   |
| Guidance         | Boost → midcourse toward the predicted intercept point → terminal proportional navigation (`a = N·Vc·λ̇`); pure pursuit for comparison      | Why leading the target works                                          |
| Fuze and outcome | Analytic closest approach → kill probability as a function of miss distance                                                                | Probability, not certainty                                            |

### 8.2 Defender battery (fictional, round-number parameters)

- **Search radar:** rotating, 360°, long range, coarse accuracy. It detects targets and hands them to the tracking radar.
- **Tracking radar:** covers a limited sector, updates fast, very precise.
  - It has a limited number of target and missile channels, which is where the saturation lesson comes from.
  - It guides interceptors by datalink.
- **Command node:** runs tracking, identification, threat evaluation and weapon assignment, following the doctrine set by the user:
  - **Weapons control:** Hold (self-defense only), Tight (confirmed hostiles only), or Free (anything not identified as friendly).
  - **Firing doctrine:** Shoot-Look-Shoot (fire one, check the result, fire again) or a salvo (fire two at once).
  - **Operator mode:** Manual (you approve every shot), Semi-auto (the system recommends, you confirm), or Auto.
- **Launchers:** ready rounds, reload time, launch interval.
- **Interceptor:** a generic missile that boosts and then coasts. It has a burn time, fuel use, a g-limit and a maximum flight time.
- **Defended assets:** a town, power station, airfield, and so on, placed by the user, each with an importance weight.

### 8.3 Threats and other traffic (illustrative ranges)

| Type                | Speed       | Altitude              | Radar size   | Behavior                                     | Teaching role                                     |
| ------------------- | ----------- | --------------------- | ------------ | -------------------------------------------- | ------------------------------------------------- |
| Small drone         | 25–60 m/s   | 50–1,500 m            | tiny         | waypoints, loitering, swarms; pushed by wind | small targets, clutter, saturation, cost-exchange |
| Cruise-missile-like | 200–270 m/s | 30–100 m above ground | small        | follows terrain, dog-leg route               | horizon and masking, short warning time           |
| Fast fixed-wing     | 250–400 m/s | 0.3–10 km             | medium–large | inbound run, evasive turn when engaged       | maneuvering vs. missile energy                    |
| Friendly aircraft   | varies      | varies                | medium       | answers identification checks                | avoiding friendly fire                            |
| Civil airliner      | ~230 m/s    | 9–12 km               | large        | flies an air corridor                        | identification and rules of engagement            |

### 8.4 The defense loop

| Stage               | What the sim does                                                                                                   | What the learner sees                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Detect              | Scan, signal-to-noise ratio, probability of detection, horizon, masking, clutter                                    | Sweep line, blips, coverage shading, "why not detected?"       |
| Track               | Blip-to-track association, M-of-N confirmation, Kalman filter                                                       | Track symbol, history trail, uncertainty ellipse               |
| Classify / Identify | Kinematic classifier + identification check + air corridors → Pending, Unknown, Friend, Neutral, Suspect or Hostile | Symbol and color change, evidence list                         |
| Evaluate            | Closest approach and time-to-arrival for each asset → threat score                                                  | Ranked threat list with a bar for each factor                  |
| Assign              | Can a missile reach it? Predicted intercept point, kill probability, free channels, ammunition, doctrine            | Recommendation card, launch-window countdown, Approve/Deny     |
| Engage              | Handover to the tracking radar, launch, guidance phases, datalink                                                   | Missile trail, phase label, intercept marker, g-meter          |
| Assess              | Fuze result → the system judges a kill from radar data → re-engages if needed                                       | Hit or miss, "kill assessed", alert when a threat gets through |

## 9. Features

### 9.1 Signature features

1. **Drag-and-drop threat palette** (Section 4).
2. **Header analysis bar** with the plain-language Now line (Section 5).
3. **Truth vs. perception toggle:** shows missed detections, false tracks and position errors. In challenges, the truth stays hidden until the after-action review.
4. **"Why?" on every decision.** For example: _"Assigned Launcher 2: the intercept point is within range, kill probability 0.78, flight time 18 s; Launcher 1 is empty."_
5. **Live coverage maps:** a target-altitude slider shows instantly where the radar can and cannot see. One radial sweep per radar computes the lowest visible altitude everywhere, and a shader colors the map from it.
6. **Rewind and try again:** scrub back, change one decision, branch a new outcome, and compare the two runs side by side.
7. **Monte Carlo mode:** run the same scenario hundreds of times in the background and see histograms of outcomes.
8. **Live equations:** formulas filled in with the selected object's real numbers.

### 9.2 Prioritized feature list

> **v0.3 note:** the core roadmap in section 16 decides what ships in v1.0. Items below that it does not list (for example ten lessons, seven cameras, the scenario editor) move to its "Later" list.

**Must have (v1.0)**

- Drag-and-drop threat palette and header analysis bar.
- First-visit cinematic intro, onboarding hints, result cards.
- **Controls:**
  - play, pause, and step (one tick, one radar scan, or jump to the next event);
  - speed from 0.1× to 20×;
  - automatic slow motion near intercepts.
- **3D view:**
  - shaded terrain with contours, vertical exaggeration and altitude drop-lines;
  - constant-size icons, because a 2 m drone is smaller than a pixel in a 100 km scene;
  - radar beams, missile trails and engagement-envelope domes.
- **Cameras:** orbit, top-down, follow target, chase interceptor, missile's-eye view, radar-site view, automatic director.
- **2D scope:** sweep with phosphor fade, range rings, standard-style symbols, velocity leaders.
- **Panels:** track table, filterable event log (click an entry to jump there), telemetry graphs.
- **Rules:** operator modes, weapons control status, firing doctrine.
- **Scenarios:** save/load, autosave, share-by-link, built-in library, screenshot button.
- **Lessons:** 10 guided lessons with pause-and-explain cards and prediction questions.
- **After-action review:**
  - detection ranges and time spent per stage;
  - missiles per kill, and predicted vs. actual kill probability;
  - threats that got through, and identification errors.
- **Skill levels:** Beginner and Expert modes.
- **Accessibility:** color-blind-safe palette, shape plus color, keyboard shortcuts, reduced motion.

**Should have (v1.x)**

- Scenario editor with route drawing and a raid generator.
- Scored challenges: assets saved, missiles used, cost-exchange ratio, no identification mistakes.
- Line-of-sight and terrain-profile ruler.
- CSV/JSON telemetry export for classroom analysis.
- Command palette (Ctrl+K) and layout presets (Classroom, Operator, Analyst).
- Offline install (PWA) and teacher-written lessons in Markdown.

**Could have (stretch)**

- Layered defense with several batteries and a short-range point-defense weapon.
- Radar jamming and a burn-through-range lesson.
- A camera picture-in-picture for visually confirming drones.
- "Ask Claude" tutor and a natural-language scenario generator. These are off by default and use the visitor's own API key.
- Translations (including right-to-left), a WebXR view, embeddable lesson widgets.

## 10. UI layout and visual language

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ANALYSIS BAR: transport · pipeline counts · KPIs · NOW line              │
├───────────┬───────────────────────────────┬──────────────────────────────┤
│ THREAT    │                               │ 2D SENSOR SCOPE              │
│ PALETTE   │   3D TRUTH VIEW               │                              │
│           │   (drop threats here)         ├──────────────────────────────┤
│ drone     │                               │ TRACK TABLE                  │
│ swarm     ├───────────────┬───────────────┴──────────────┬───────────────┤
│ cruise    │ INSPECTOR     │ TELEMETRY                    │ EVENT LOG /   │
│ jet       │ "WHY?"        │                              │ LESSON CARD   │
│ friendly  ├───────────────┴──────────────────────────────┴───────────────┤
│ airliner  │ TIMELINE  ──●────|launch|──|splash|─────── scrub · bookmarks │
└───────────┴──────────────────────────────────────────────────────────────┘
```

- **Themes:** a dark "operations console" theme (charcoal and navy, cyan accents, glow on beams and missile exhaust) and a light projector theme for classrooms.
- **One color language everywhere:** hostile red, unknown yellow, friend blue, neutral green, suspect orange. Each color always comes with a matching shape.
- **Motion:** smooth camera transitions and restrained effects.
- **Devices:** desktop first; phones get a view-only mode.

## 11. Scenarios and lessons

```json
{
  "schema": "ads-scenario/1",
  "meta": { "title": "Lesson 2 — The Radar Horizon", "seed": 42 },
  "environment": {
    "terrain": { "seed": 7, "relief": "hills" },
    "wind": { "speedMps": 8, "fromDeg": 270 }
  },
  "defender": {
    "sites": [
      { "kind": "searchRadar", "posM": [0, 0], "mastM": 12 },
      { "kind": "launcher", "posM": [400, -200], "ready": 4 }
    ],
    "doctrine": { "wcs": "TIGHT", "mode": "SEMI", "fire": "SLS" }
  },
  "assets": [{ "name": "Town", "posM": [-6000, 2500], "value": 10 }],
  "threats": [
    {
      "type": "cruiseLike",
      "spawnS": 10,
      "aglM": 50,
      "route": [
        [60000, 12000],
        [-6000, 2500]
      ]
    }
  ]
}
```

**Lessons:**

1. Meet the battery
2. The radar horizon
3. Hiding in valleys (terrain masking)
4. Small and slow (radar size and clutter)
5. From blips to tracks (filtering)
6. Friend or foe (the airliner)
7. Who goes first? (threat ranking)
8. Lead the target (guidance)
9. Energy and launch windows
10. The swarm (saturation and doctrine)

There will also be scored challenges and an open sandbox.

## 12. Quality bar

- **Tests:**
  - physics checks against known values: atmosphere tables, horizon formula, turn radius, terminal velocity;
  - filter consistency;
  - guidance hitting a straight-flying target;
  - determinism: the same seed gives the same state hash;
  - golden-scenario regression tests;
  - Playwright browser tests with screenshots.
- **Performance targets:**
  - 60 fps with about 200 live objects;
  - under 2 ms per sim tick;
  - at least 100 Monte Carlo runs per minute in a worker.
- **Docs:** README, ARCHITECTURE, MODELS (every equation, assumption and limitation, with public textbook references), SCENARIO_FORMAT, CONTRIBUTING, SAFETY, DEVLOG.
- **License:** MIT for the code, CC BY 4.0 for docs and lessons.

## 13. Safety guardrails

- **Generic, fictional equipment only:** no real system names, specifications or performance data. Parameters are round numbers chosen for teaching.
- **Textbook-level physics only:** 3-DOF point mass and public equations. No real seeker, warhead or propulsion detail.
- **Fictional terrain:** generated procedurally. No real-world bases, cities or borders.
- **Defensive framing:** non-graphic effects. Identification and rules-of-engagement mistakes count as failures.
- **Visible rules:** a disclaimer on the start screen, and `SAFETY.md` with content rules for community scenarios (no recreations of real sites, no real-system parameter sheets).

## 14. Portfolio and LinkedIn launch kit

- **An always-live demo.** GitHub Pages, deployed by CI on every push from Step 0, so there is always a link to share.
- **A fast first impression.**
  - The cinematic intro and onboarding hint from Section 3.
  - The 3D code is split out so the page loads quickly.
  - Phones get a view-only mode.
- **Rich link previews.**
  - The demo site gets Open Graph tags with a 1200×627 preview image, the size LinkedIn uses for link cards.
  - The GitHub repo gets a 1280×640 social preview image, which the owner uploads in the repo settings.
- **Demo video (60–90 s).**
  - It is rendered frame by frame from a scripted, deterministic scenario, so it plays smoothly even without a GPU.
  - It can be re-recorded with `npm run demo:record`.
  - Captions are burned in, because LinkedIn autoplays muted.
  - The hook comes in the first 3 seconds; an end card shows the repo and demo links.
  - Two cuts: 16:9 for GitHub and YouTube, 1:1 for the LinkedIn feed.
- **README media.** Light GIFs or animated WebP for each feature. The full MP4 is attached through GitHub's web editor so it plays inline.
- **Clone and run.**
  - Four commands (below), Node 22+, npm only.
  - _Open in GitHub Codespaces_ and _Open in StackBlitz_ buttons for running without installing anything.
- **Follow the build.** Every step is a git tag (for example `step-04-terrain-radar`), so anyone can check out a step and watch the project grow. Each tag has a build-log entry with a screenshot.
- **Signals for specialists.** CI badges, strict TypeScript, physics tests, the ARCHITECTURE and MODELS docs, and a clean commit history.
- **LinkedIn post draft.** Written at release: hook, what it does, three things learned, tech stack, links, hashtags. The owner posts it.
- **Built with Claude.** `CLAUDE.md` and `docs/DEVLOG.md` show how the project was built with Claude Code.

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
npm install
npm run dev
```

## 15. README and documentation plan

**README outline, top to bottom:**

1. Title, one-liner, hero GIF.
2. Buttons: Live demo · Watch the video · Run locally.
3. Badges: build, tests, license, tech stack.
4. What you can do: five bullets with mini GIFs.
5. Quick start: four commands.
6. How it works: the 7-stage defense loop as one diagram.
7. **The physics, in plain language:** concept cards. This section grows with every step.
8. **Build log:** one short entry per step, with a screenshot and its git tag.
9. Architecture: a diagram, linking to `docs/ARCHITECTURE.md`.
10. Safety and scope.
11. Roadmap · Contributing · Built with Claude · License.

**Writing rules:**

- Plain language first, math second.
- At most three sentences per concept and at most one formula per card.
- Every card ends with "See it in the sim".
- Derivations and references go in `docs/MODELS.md`, not the README.

**Concept card format (example):**

> **Radar horizon — why low flyers hide**
>
> The Earth curves away, so a radar cannot see targets below its horizon. Radio waves bend slightly around the curve, so we model an Earth 4/3 larger than the real one.
>
> - **Formula:** `d ≈ 4.12 × (√h_radar + √h_target)` km, heights in metres
> - **Example:** a radar mast of 12 m sees a target flying at 50 m only within ~43 km.
> - **See it:** Lesson 2, or drag the target-altitude slider on the coverage map.

**One source of truth:** the concept texts live in `docs/concepts/*.md`. The app imports them for tooltips and lesson cards, and a small sync script (`npm run docs:sync`) copies the short cards into the README. The README, docs and app therefore never disagree.

## 16. Build roadmap

**v0.3 (2026-11-07): the core roadmap.** After Step 3 the remaining eleven steps were folded into five, so v1.0 ships the core and everything else moves to the "Later" list below. Each step ends with a working demo, passing tests, at least one README concept card (where there is new physics) and a git tag.

| Step | Tag                         | What you will see                                                                                                                                       | Concepts added to the README                                       |
| ---- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0    | `step-00-launchpad`         | Repo, tooling, CI, live demo URL (app shell), README skeleton, CLAUDE.md, Codespaces/StackBlitz                                                         | —                                                                  |
| 1    | `step-01-sim-core`          | Deterministic clock, play/pause/step/speed, a target moving on the 2D scope                                                                             | Fixed time step and determinism                                    |
| 2    | `step-02-3d-scene`          | 3D ground, models, trails, labels, cameras; 2D↔3D selection sync                                                                                        | Local coordinates (ENU) and scale                                  |
| 3    | `step-03-first-intercept`   | First full loop + **drag-and-drop palette v1** + **analysis bar v1**                                                                                    | Detection range; proportional navigation                           |
| 4    | `step-04-terrain-radar`     | Procedural terrain, radar horizon and terrain masking, probabilistic detection, measurement noise, false alarms, air drag, coverage map                 | Radar horizon; terrain masking; detection probability; air density |
| 5    | `step-05-tracking`          | Kalman filter, gating and nearest-neighbour association, uncertainty ellipses, track quality, truth vs. perception toggle                               | Noise and the Kalman filter                                        |
| 6    | `step-06-decide-engage`     | Defended assets, identification mistakes, "Why?" on every decision, engagement envelope, kill probability, fire channels, operator approval, saturation | Closest point of approach; engagement envelope; kill probability   |
| 7    | `step-07-scenarios-lessons` | Built-in scenario library, share-by-link, short guided lessons, after-action review, telemetry and timeline                                             | —                                                                  |
| 8    | `v1.0.0`                    | Onboarding hints, accessibility basics, demo video, GIFs, preview images, final README, release                                                         | —                                                                  |

### Later (v1.x and beyond)

Kept from the original plan, but not needed for v1.0:

- **Environment:** wind, the full standard-atmosphere model, terrain-following and evasive threat routes.
- **Radar:** clutter and Doppler filtering, a separate tracking radar model.
- **Identification:** a kinematic classifier and air corridors.
- **Engage:** detailed missile phases, launcher channels, the full firing-doctrine menu.
- **Scenarios:** scenario editor with route drawing, raid generator, dragging defenders, scored challenges, skill levels.
- **Analysis:** rewind and branch, run comparison, Monte Carlo mode, CSV/JSON export, live equations.
- **Polish:** cinematic intro, sound, light theme, command palette, layout presets, PWA.
- **Stretch:** layered defense, jamming, the "Ask Claude" tutor, translations, WebXR.

**Workflow for every step:**

1. Build the feature.
2. Run tests, lint and typecheck until they pass.
3. Run the app in headless Chromium and capture screenshots or a GIF (from Step 4 on, screenshots and clips are captured by the owner once all v1.0 features are in).
4. Update the README (concept cards, build log, progress) and `docs/DEVLOG.md`.
5. Commit, push and tag.
6. The owner reviews, then the next step starts.

## 17. Risks and mitigations

| Risk                                     | Mitigation                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| Scope creep                              | Must/Should/Could tiers; a working demo at every step                       |
| Overwhelming beginners                   | Beginner/Expert modes, progressive disclosure, layout presets, the Now line |
| Physics bugs at high closing speed       | Analytic closest approach, endgame sub-steps, unit tests                    |
| Performance (line-of-sight, Monte Carlo) | Precomputed masking maps, worker thread, instanced rendering                |
| Slow software rendering in the cloud     | Frame-by-frame capture for screenshots and video                            |
| Drift toward real-world realism          | Fictional parameters; every model change checked against the safety rules   |

## 18. Decisions and defaults

| Decision                  | Default (unless the owner says otherwise)                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Repository                | [`MohammadAlyounes/air-defense-sim`](https://github.com/MohammadAlyounes/air-defense-sim), public |
| Name                      | "Air Defense Simulator" (no real system names)                                                    |
| License                   | MIT (code) + CC BY 4.0 (docs, lessons): confirmed by the owner                                    |
| Author credit             | "Created by Mohammad Alyounes", fixed in the header; commits authored by Mohammad Alyounes        |
| UI language               | English for v1; UI text kept in one place so translations can be added later                      |
| Visual style              | Dark operations-console theme + light projector theme                                             |
| Claude features           | Optional "Ask Claude" tutor and scenario generator after v1.0                                     |
| Package manager / runtime | npm / Node 22+                                                                                    |

## 19. Verified build environment (2026-11-06)

Node 22.23 · npm 10.9 · git 2.43 · headless Chromium with WebGL2 (SwiftShader) · Playwright · ffmpeg 6.1.

This is enough to build, test, capture 3D screenshots, and render the demo video in the cloud session.
