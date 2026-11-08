/**
 * Search radar: a rotating antenna that paints every aircraft its beam sweeps past, as long as
 * the echo is strong enough. Step 3 adds detection range by radar size (the fourth-root law);
 * noise, false alarms, the radar horizon and terrain masking arrive in Step 4.
 */

export interface SearchRadarConfig {
  /** Seconds per antenna turn. */
  periodS: number;
  /** Instrumented range: the radar ignores echoes from farther away, metres. */
  rangeM: number;
  /** Range at which a 1 m² target is just detected, metres. */
  referenceRangeM: number;
}

export const DEFAULT_SEARCH_RADAR: SearchRadarConfig = {
  periodS: 4,
  rangeM: 40_000,
  referenceRangeM: 30_000,
};

/**
 * Farthest range at which a target with radar cross section `rcsM2` is detected.
 *
 * The radar equation says the echo's signal-to-noise ratio grows with the cross section and
 * falls with the fourth power of range (`SNR ∝ σ / R⁴`). Setting it equal to the detection
 * threshold gives `R = R_ref · (σ / 1 m²)^(1/4)`, capped by the instrumented range.
 */
export function detectionRangeM(rcsM2: number, radar: SearchRadarConfig): number {
  return Math.min(radar.rangeM, radar.referenceRangeM * Math.pow(rcsM2, 0.25));
}

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
