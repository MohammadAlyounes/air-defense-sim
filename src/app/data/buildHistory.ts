/**
 * How the simulator was built: the six steps of the build log (README and docs/DEVLOG.md),
 * each released as a git tag, and the version the finished project carries.
 */
export interface BuildStep {
  step: number;
  title: string;
  summary: string;
}

/** The finished project's version (package.json and the `v1.0.0` release). */
export const VERSION = '1.0.0';

export const BUILD_STEPS: readonly BuildStep[] = [
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
      'Kalman tracking, truth vs. perception, identification, civil corridors, assets, threat ranking with "Why?", and the rules of engagement.',
  },
];
