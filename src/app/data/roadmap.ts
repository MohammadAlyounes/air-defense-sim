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
    title: 'Environment',
    summary: 'Terrain, atmosphere, wind and drag; three threat types with routes.',
  },
  {
    step: 5,
    title: 'Radar realism',
    summary: 'Radar equation, noise, horizon, terrain masking, clutter and coverage maps.',
  },
  {
    step: 6,
    title: 'Tracking',
    summary: 'Kalman tracking, uncertainty ellipses, track quality, truth vs. perception.',
  },
  {
    step: 7,
    title: 'Identify & evaluate',
    summary: 'Identification, friendly and civil traffic, threat ranking with "Why?".',
  },
  {
    step: 8,
    title: 'Engage',
    summary: 'Engagement envelopes, kill probability, doctrine and missile phases.',
  },
  {
    step: 9,
    title: 'Assess',
    summary: 'Kill assessment and re-engagement; full analysis bar, log, telemetry, inspector.',
  },
  { step: 10, title: 'Scenarios', summary: 'Save, load and share; editor and raid generator.' },
  {
    step: 11,
    title: 'Learning layer',
    summary: 'Ten guided lessons, live equations, challenges, after-action review.',
  },
  {
    step: 12,
    title: 'Replay & analysis',
    summary: 'Timeline scrubbing, rewind and branch, Monte Carlo, CSV export.',
  },
  { step: 13, title: 'Polish', summary: 'Cinematic intro, effects, sound, themes, accessibility.' },
  { step: 14, title: 'Release v1.0', summary: 'Demo video, final README and the launch kit.' },
];

/** The step the repository is currently on. Bump this when a step ships. */
export const CURRENT_STEP = 3;

export const LAST_STEP = ROADMAP[ROADMAP.length - 1]?.step ?? 0;

export function roadmapStep(step: number): RoadmapStep | undefined {
  return ROADMAP.find((entry) => entry.step === step);
}
