import type { Affiliation } from '../../sim';

/** How each affiliation is named and coloured across the UI (always with a shape, never colour alone). */
export const AFFILIATION_STYLE: Readonly<
  Record<Affiliation, { label: string; text: string; ring: string }>
> = {
  hostile: { label: 'Threat', text: 'text-hostile', ring: 'ring-hostile/25' },
  friend: { label: 'Friend', text: 'text-friend', ring: 'ring-friend/25' },
  neutral: { label: 'Civil', text: 'text-neutral', ring: 'ring-neutral/25' },
};
