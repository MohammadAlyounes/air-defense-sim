/**
 * The kinematic classifier: what a track flies like, judged from its filtered speed and height
 * alone, before (and besides) any answer to the identification check. Like the rest of the
 * command node it never reads the truth. The thresholds are illustrative round numbers chosen
 * to separate the simulator's generic traffic classes (see SAFETY.md).
 */
export type FlightProfile =
  /** Slower than any aircraft here: drone-like. */
  | 'slow'
  /** Fast and close to the ground: cruise-missile-like. */
  | 'lowFast'
  /** Faster than any civil or friendly aircraft here: jet-like. */
  | 'fast'
  /** Airliner speed at airliner height. */
  | 'airliner'
  /** None of the above: an ordinary aircraft. */
  | 'aircraft';

/** Below this ground speed a track is "slow", m/s. */
export const SLOW_BELOW_MPS = 80;
/** A track this fast or faster, and this low above the ground, is "low and fast". */
export const LOW_FAST_FROM_MPS = 120;
export const LOW_BELOW_M = 300;
/** From this ground speed a track is "fast", m/s. */
export const FAST_FROM_MPS = 290;
/** Airliners cruise at least this fast, and at least this high (above the battery), m/s and m. */
export const AIRLINER_FROM_MPS = 180;
export const AIRLINER_FROM_M = 8_000;

/**
 * The flight profile of a track flying at ground speed `speedMps`, `heightAboveGroundM` above
 * the ground below it and `altitudeM` above the battery. The tests run in this order, so a slow
 * track is "slow" at any height and a low, fast one is "low and fast" at any speed above 120 m/s.
 */
export function flightProfile(
  speedMps: number,
  heightAboveGroundM: number,
  altitudeM: number,
): FlightProfile {
  if (speedMps < SLOW_BELOW_MPS) return 'slow';
  if (speedMps >= LOW_FAST_FROM_MPS && heightAboveGroundM < LOW_BELOW_M) return 'lowFast';
  if (speedMps >= FAST_FROM_MPS) return 'fast';
  if (speedMps >= AIRLINER_FROM_MPS && altitudeM >= AIRLINER_FROM_M) return 'airliner';
  return 'aircraft';
}

/** Profiles no civil or friendly aircraft here flies: a silent track flying one is suspect. */
export const THREAT_PROFILES: readonly FlightProfile[] = ['slow', 'lowFast', 'fast'];

export const looksLikeThreat = (profile: FlightProfile | null): boolean =>
  profile !== null && THREAT_PROFILES.includes(profile);
