/**
 * Search radar, Step 1 version: a rotating antenna that paints every aircraft its beam
 * sweeps past, within range. Detection is perfect for now; the radar equation, noise,
 * the radar horizon and terrain masking arrive in Step 5.
 */

export interface SearchRadarConfig {
  /** Seconds per antenna turn. */
  periodS: number;
  /** Maximum ground range at which the radar paints targets, metres. */
  rangeM: number;
}

export const DEFAULT_SEARCH_RADAR: SearchRadarConfig = { periodS: 4, rangeM: 40_000 };

const TWO_PI = 2 * Math.PI;

/** Antenna direction after `timeS` seconds, starting from north and turning clockwise. */
export function antennaAzimuth(timeS: number, periodS: number): number {
  const turns = timeS / periodS;
  return (turns - Math.floor(turns)) * TWO_PI;
}

/**
 * True if `bearingRad` lies in the arc the beam swept clockwise from `fromRad` (excluded) to
 * `toRad` (included). Handles the jump from 359° back to 0°.
 */
export function sweptOver(fromRad: number, toRad: number, bearingRad: number): boolean {
  const span = (((toRad - fromRad) % TWO_PI) + TWO_PI) % TWO_PI;
  const offset = (((bearingRad - fromRad) % TWO_PI) + TWO_PI) % TWO_PI;
  return offset > 0 && offset <= span;
}
