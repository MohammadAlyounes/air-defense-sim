/**
 * The public build roadmap (docs/PROJECT_PLAN.md, section 16). The UI uses it for
 * "arrives in Step N" badges and the build-progress pill in the header.
 */
export interface RoadmapStep {
  step: number;
  title: string;
  summary: string;
}

export const ROADMAP: readonly RoadmapStep[] = [
  {
    step: 0,
    title: 'Launchpad',
    summary: 'Project scaffold, CI, live demo and the console shell.',
  },
  {
    step: 1,
    title: 'Simulation core',
    summary: 'Deterministic clock, play/pause/step/speed, a target on the 2D scope.',
  },
  { step: 2, title: '3D scene', summary: '3D ground, models, trails, labels and cameras.' },
  {
    step: 3,
    title: 'First intercept',
    summary: 'The first full loop, drag-and-drop threats and the live analysis bar.',
  },
  {
    step: 4,
    title: 'Environment & radar',
    summary:
      'Terrain, atmosphere, wind and drag, threat routes; radar equation, noise, horizon, masking, clutter, coverage maps.',
  },
  {
    step: 5,
    title: 'Track & identify',
    summary:
      'Kalman tracking, uncertainty ellipses, truth vs. perception; identification, civil traffic, assets, threat ranking with "Why?".',
  },
  {
    step: 6,
    title: 'Engage & assess',
    summary:
      'Fire channels, envelopes, kill probability, doctrine, operator approval; kill assessment, saturation, telemetry.',
  },
  {
    step: 7,
    title: 'Scenarios & replay',
    summary:
      'Save, load and share scenarios, editor, raid generator; timeline scrubbing, rewind and branch, Monte Carlo, CSV export.',
  },
  {
    step: 8,
    title: 'Learning layer',
    summary: 'Ten guided lessons, live equations, skill levels, challenges, after-action review.',
  },
  {
    step: 9,
    title: 'Polish & release v1.0',
    summary:
      'Cinematic intro, effects, sound, themes, accessibility, demo video and the v1.0 release.',
  },
];

/** The step the repository is currently on. Bump this when a step ships. */
export const CURRENT_STEP = 3;

export const LAST_STEP = ROADMAP[ROADMAP.length - 1]?.step ?? 0;

export function roadmapStep(step: number): RoadmapStep | undefined {
  return ROADMAP.find((entry) => entry.step === step);
}
