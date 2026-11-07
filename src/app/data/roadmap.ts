/**
 * The public build roadmap (docs/PROJECT_PLAN.md, section 16: the v0.3 core roadmap). The UI uses it for
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
    title: 'Terrain & radar',
    summary:
      'Terrain, radar horizon and masking, detection probability, noise, drag, coverage map.',
  },
  {
    step: 5,
    title: 'Tracking',
    summary: 'Kalman tracking, association, uncertainty ellipses, truth vs. perception.',
  },
  {
    step: 6,
    title: 'Decide & engage',
    summary: 'Defended assets, "Why?", kill probability, fire channels and operator approval.',
  },
  {
    step: 7,
    title: 'Scenarios & lessons',
    summary: 'Scenario library, share-by-link, guided lessons, after-action review, timeline.',
  },
  {
    step: 8,
    title: 'Release v1.0',
    summary: 'Onboarding, accessibility, demo video and the launch.',
  },
];

/** The step the repository is currently on. Bump this when a step ships. */
export const CURRENT_STEP = 6;

export const LAST_STEP = ROADMAP[ROADMAP.length - 1]?.step ?? 0;

export function roadmapStep(step: number): RoadmapStep | undefined {
  return ROADMAP.find((entry) => entry.step === step);
}
