/**
 * The seven stages of the defense loop, in order. The analysis bar shows a live
 * count for each one; descriptions are written for a general audience.
 * `arrivesInStep` is the roadmap step in which the stage first works in the simulator.
 */
export const STAGES = [
  {
    id: 'detect',
    label: 'Detect',
    arrivesInStep: 1,
    description:
      'The search radar scans the sky. Any echo strong enough to stand out from the noise becomes a "blip".',
  },
  {
    id: 'track',
    label: 'Track',
    arrivesInStep: 3,
    description:
      'Blips from successive scans are linked into a track, and a filter smooths the noise to estimate position and velocity.',
  },
  {
    id: 'identify',
    label: 'Identify',
    arrivesInStep: 7,
    description:
      'What is it, and whose is it? Speed and altitude suggest the type; an identification check separates friend, civil and hostile.',
  },
  {
    id: 'evaluate',
    label: 'Evaluate',
    arrivesInStep: 7,
    description:
      'Which threat is most urgent? The command node ranks threats by how soon, and how close, they will reach a defended asset.',
  },
  {
    id: 'assign',
    label: 'Assign',
    arrivesInStep: 3,
    description:
      'Can an interceptor reach it in time? The system checks range, free radar channels and ammunition, then picks a launcher.',
  },
  {
    id: 'engage',
    label: 'Engage',
    arrivesInStep: 3,
    description:
      'The interceptor launches toward a predicted intercept point, then homes in using proportional navigation.',
  },
  {
    id: 'assess',
    label: 'Assess',
    arrivesInStep: 3,
    description:
      'Did it work? The radar watches what happens next. If the threat survives, the system engages again.',
  },
] as const;

export type Stage = (typeof STAGES)[number];
export type StageId = Stage['id'];
