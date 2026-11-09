# Devlog

One short entry per release, newest first: what was built and the key decisions. Each entry also becomes the notes of its GitHub Release.

## v1.0.0 · The complete simulator (2026-11-09)

The simulator is complete, released together with Step 5. It covers the whole loop from detection to kill assessment, an honest radar over fictional terrain, tracking and identification that can go wrong, rules the user controls, 22 concept cards and exact replays.

- The header shows "v1.0.0 · Complete"; the step badges and the two placeholder panels (telemetry, replay timeline) are gone.
- The release job reads every commit of a push, so one rebase merge can release several tags, each at its own commit.
- 267 unit and 35 browser tests.

**Decision:** finish at Step 5. The simulator already teaches what it set out to, and the console keeps only what works.

## Step 5 · Track & identify (2026-11-08)

Tracks become honest estimates, identities come with their evidence, and the command node gets rules, limits and odds.

- **Tracking:** a 6-state Kalman filter, gating and nearest-neighbour association in 0.2 s batches, uncertainty ellipses and a truth vs. perception toggle (T).
- **Identification:** IFF checks that friendly transponders fail one time in ten, a kinematic classifier (drone-, cruise-missile-, jet- or airliner-like), a "suspect" identity and two civil air corridors.
- **Threats:** a town and a power plant join the battery; threats are ranked by their closest point of approach, and "Why?" explains every decision.
- **Rules:** weapons control (TIGHT, FREE, HOLD), AUTO or SEMI-AUTO approval, three fire channels, kill probability with shoot-look-shoot, and the engagement envelope.

**Decisions**

- **Batches stop track theft:** matching 18° of sweep together lets a swarm's tracks settle, at a cost of 0.2 s.
- **Silence is evidence, not proof:** FREE fires one check sooner than TIGHT, at ten times the risk to a friend with a faulty transponder. Neither setting is "right".
- **The classifier adds evidence, never a verdict:** only the checks declare a track hostile.
- **Truth still guides interceptors in view:** misses come from the kill probability, not from a blurry fire-control picture.
- **A filter that tests its own honesty:** its normalized innovation must average 3.

## Step 4 · Environment & radar (2026-11-08)

The battlespace gets terrain and weather, threats fly real routes, and the radar becomes honest about what it cannot see.

- **World:** procedural terrain, the standard atmosphere, a per-run wind, turn radii, dog-leg routes and a 6 g evasive break for jets.
- **Radar:** the horizon, terrain masking, detection probability, measurement noise, false alarms, clutter and the Doppler notch, with coverage maps on the scope and in 3D.
- **Interceptors:** air drag, and guidance toward the track while the target is hidden.

**Decisions**

- **The terrain has its own seed,** so every run shares one map; the wind comes from the run's seed.
- **False alarms are honest:** they start real tentative tracks, which need a second echo to survive.
- **Clutter at the target's own range,** not below it, so high flyers are not buried in ground echo.
- **A wider second gate, not a new filter,** keeps a jet's track through its break.

## Step 3 · First intercept (2026-11-07)

The first full defense loop: drag a threat onto the map and watch the battery detect, track, identify, evaluate, assign, engage and assess it.

- Drag-and-drop threats with a ghost readout; detection range by radar size; interceptors with proportional navigation and an exact closest-approach fuze.
- The live analysis bar, track table, result cards and inspector.

**Decisions**

- **The command node only sees its tracks,** never the truth.
- **One visible step at a time:** confirmation, identification and launch each take seconds, so every stage shows.
- **Exact endgames:** 2 ms sub-steps and a closed-form closest approach, so fast pairs cannot skip past each other.

## Step 2 · 3D scene (2026-11-06)

The battlespace in 3D, in step with the radar scope.

- Terrain grid, radar site, aircraft with trails, four cameras, height stretch and labels.
- One selection across the 3D view, the scope, the inspector and the event log; shareable view links.

**Decisions**

- **Readable beats true to scale:** heights are stretched and aircraft keep a fixed size on screen; labels show true values.
- **Draw only when something changes,** and load three.js in its own chunk.

## Step 1 · Simulation core (2026-11-06)

A deterministic engine at 50 ticks per second, a live radar scope, and play, pause, step and replay controls.

- Fixed 20 ms step, seeded random numbers, scenario traffic and a rotating search radar.
- The first concept cards, in the README and in the app.

**Decisions**

- **The scope shows what the radar painted,** not the truth.
- **Determinism has one limit:** runs are identical within one JavaScript engine.

## Step 0 · Launchpad (2026-11-06)

The foundation: Vite, React, strict TypeScript, Tailwind, ESLint, Prettier, Vitest and Playwright; CI and GitHub Pages; the console shell; and the fixed author credit.

**Decisions**

- **Tags and releases come from CI,** from a `Step-Tag:` trailer, because the cloud session cannot push tags.
- **Determinism is enforced by the linter** in `src/sim`.
- **Playwright is pinned** to the version preinstalled in the cloud environment.
