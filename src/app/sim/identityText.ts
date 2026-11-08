import {
  AIRLINER_FROM_M,
  AIRLINER_FROM_MPS,
  assumedCivil,
  DEFAULT_CORRIDORS,
  FAST_FROM_MPS,
  LOW_BELOW_M,
  LOW_FAST_FROM_MPS,
  SLOW_BELOW_MPS,
  type FlightProfile,
  type Identity,
} from '../../sim';

/**
 * Plain words for what the battery believes about a track: its identity, what the kinematic
 * classifier says it flies like, and the civil corridor it flies. Shared by the event log, the
 * NOW line, the track table, the inspector and the approval card.
 */

/** One word for each identity, as the console says it. */
export const IDENTITY_WORD: Readonly<Record<Identity, string>> = {
  pending: 'identifying',
  unknown: 'unknown',
  suspect: 'suspect',
  hostile: 'hostile',
  friend: 'friendly',
  neutral: 'civil',
};

/** What each flight profile looks like, and the rule that gives it (see `flightProfile`). */
export const PROFILE_TEXT: Readonly<Record<FlightProfile, { like: string; rule: string }>> = {
  slow: { like: 'a drone', rule: `under ${SLOW_BELOW_MPS} m/s` },
  lowFast: {
    like: 'a cruise missile',
    rule: `${LOW_FAST_FROM_MPS} m/s or more, under ${LOW_BELOW_M} m above the ground`,
  },
  fast: { like: 'a jet', rule: `${FAST_FROM_MPS} m/s or more` },
  airliner: {
    like: 'an airliner',
    rule: `${AIRLINER_FROM_MPS} m/s or more at ${AIRLINER_FROM_M / 1000} km or higher`,
  },
  aircraft: { like: 'an ordinary aircraft', rule: 'no drone, cruise-missile or jet profile' },
};

/** "North corridor", from a corridor id; null for none. */
export const corridorName = (id: number | null): string | null =>
  id === null ? null : (DEFAULT_CORRIDORS.find((lane) => lane.id === id)?.name ?? null);

/**
 * Why a silent track is assumed civil, if it is: "it flies like an airliner along the North
 * corridor"; null otherwise.
 */
export function assumedCivilReason(
  profile: FlightProfile | null,
  corridorId: number | null,
): string | null {
  const lane = corridorName(corridorId);
  return assumedCivil(profile, corridorId) && lane
    ? `it flies like an airliner along the ${lane}`
    : null;
}
