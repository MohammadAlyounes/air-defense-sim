/**
 * Search radar: a rotating antenna that paints the aircraft its beam sweeps past.
 *
 * Step 4 makes detection a matter of chance, as in the textbook radar equation: the echo's
 * signal-to-noise ratio (SNR) falls with the fourth power of range, and the chance of seeing a
 * fluctuating target (the Swerling 1 model) follows from it. Measurements carry noise, and
 * random noise spikes now and then cross the threshold: false alarms. Earth curvature and the
 * terrain can block the view entirely (`propagation.ts`). Where the radar lights the ground, the
 * ground's own echo (clutter) is filtered out by its Doppler shift, and so is any target that
 * closes or opens too slowly: the low-Doppler notch.
 */

import type { Vec3 } from './core/vec';

export type DetectionModel =
  /** Detection probability from the SNR, for a target whose echo fluctuates from scan to scan. */
  | 'swerling1'
  /** Always detected inside the 50% range, never beyond it: the Step 3 model, kept for tests. */
  | 'threshold';

export interface SearchRadarConfig {
  /** Seconds per antenna turn. */
  periodS: number;
  /** Instrumented range: the radar ignores echoes from farther away, metres. */
  rangeM: number;
  /** Range at which a 1 m² target is detected on half of the scans, metres. */
  referenceRangeM: number;
  /** Height of the antenna above the ground at the radar site, metres. */
  antennaHeightM: number;
  detectionModel: DetectionModel;
  /** Chance that noise alone crosses the detection threshold in one resolution cell. */
  falseAlarmProbability: number;
  /** Range-and-bearing cells the radar checks per antenna turn. */
  resolutionCells: number;
  /** Measurement noise, one standard deviation: range (m), bearing and elevation (rad). */
  rangeSigmaM: number;
  azimuthSigmaRad: number;
  elevationSigmaRad: number;
  /** Wavelength, metres: sets the Doppler shift of a moving target's echo, f = 2·v / λ. */
  wavelengthM: number;
  /**
   * Half-width of the low-Doppler notch, m/s. Where the radar lights the ground, echoes that
   * close or open slower than this are filtered out along with the ground's own (0: no notch).
   */
  dopplerNotchMps: number;
}

const DEG = Math.PI / 180;

export const DEFAULT_SEARCH_RADAR: SearchRadarConfig = {
  periodS: 4,
  rangeM: 40_000,
  referenceRangeM: 30_000,
  antennaHeightM: 12,
  detectionModel: 'swerling1',
  falseAlarmProbability: 1e-6,
  resolutionCells: 600_000,
  rangeSigmaM: 30,
  azimuthSigmaRad: 0.15 * DEG,
  elevationSigmaRad: 0.25 * DEG,
  wavelengthM: 0.1,
  dopplerNotchMps: 10,
};

/**
 * A radar with perfect measurements and no false alarms, fluctuation or clutter notch: the
 * Step 3 radar.
 */
export const IDEAL_SEARCH_RADAR: Partial<SearchRadarConfig> = {
  detectionModel: 'threshold',
  falseAlarmProbability: 0,
  rangeSigmaM: 0,
  azimuthSigmaRad: 0,
  elevationSigmaRad: 0,
  dopplerNotchMps: 0,
};

/**
 * Probability of detecting a Swerling 1 target (its echo strength changes randomly from scan
 * to scan) with signal-to-noise ratio `snr` (a power ratio, not decibels):
 *
 *   Pd = Pfa^(1 / (1 + SNR))
 */
export function detectionProbability(snr: number, falseAlarmProbability: number): number {
  if (falseAlarmProbability <= 0) return snr > 0 ? 1 : 0;
  return Math.pow(falseAlarmProbability, 1 / (1 + Math.max(0, snr)));
}

/** The SNR at which a Swerling 1 target is detected on half of the scans. */
export function snrForHalfDetection(falseAlarmProbability: number): number {
  const pfa = falseAlarmProbability > 0 ? falseAlarmProbability : 1e-6;
  return Math.log(pfa) / Math.log(0.5) - 1;
}

/**
 * Signal-to-noise ratio of a target with radar cross section `rcsM2` at slant range `rangeM`.
 * From the radar equation, SNR ∝ σ / R⁴; it is scaled so that a 1 m² target at the reference
 * range is detected on half of the scans.
 */
export function signalToNoise(rcsM2: number, rangeM: number, radar: SearchRadarConfig): number {
  const ratio = radar.referenceRangeM / Math.max(1, rangeM);
  return snrForHalfDetection(radar.falseAlarmProbability) * rcsM2 * ratio ** 4;
}

/** Chance that one look at a target at `rangeM` produces a detection (ignoring the terrain). */
export function lookProbability(rcsM2: number, rangeM: number, radar: SearchRadarConfig): number {
  if (rangeM > radar.rangeM) return 0;
  if (radar.detectionModel === 'threshold') return rangeM <= detectionRangeM(rcsM2, radar) ? 1 : 0;
  return detectionProbability(signalToNoise(rcsM2, rangeM, radar), radar.falseAlarmProbability);
}

/**
 * Range at which a target with radar cross section `rcsM2` is detected on half of the scans.
 *
 * The radar equation says the SNR grows with the cross section and falls with the fourth power
 * of range (`SNR ∝ σ / R⁴`). Holding the SNR fixed gives `R = R_ref · (σ / 1 m²)^(1/4)`, capped
 * by the instrumented range.
 */
export function detectionRangeM(rcsM2: number, radar: SearchRadarConfig): number {
  return Math.min(radar.rangeM, radar.referenceRangeM * Math.pow(rcsM2, 0.25));
}

/** Average number of false alarms per antenna turn: λ = Pfa × cells. */
export const falseAlarmsPerTurn = (radar: SearchRadarConfig): number =>
  radar.falseAlarmProbability * radar.resolutionCells;

/**
 * Closing speed: how fast a target at `position` moves toward the antenna along the line of
 * sight, m/s (negative when it moves away). Only this part of its velocity shifts the echo's
 * frequency; a target flying across the beam has none.
 */
export function closingSpeedMps(antenna: Vec3, position: Vec3, velocity: Vec3): number {
  const dx = antenna.x - position.x;
  const dy = antenna.y - position.y;
  const dz = antenna.z - position.z;
  const rangeM = Math.hypot(dx, dy, dz);
  return rangeM > 0 ? (velocity.x * dx + velocity.y * dy + velocity.z * dz) / rangeM : 0;
}

/** Doppler shift of the echo of a target closing at `closingSpeedMps`: f = 2·v / λ, Hz. */
export const dopplerShiftHz = (
  closingSpeedMps: number,
  radar: Pick<SearchRadarConfig, 'wavelengthM'>,
): number => (2 * closingSpeedMps) / radar.wavelengthM;

/**
 * Is an echo with this closing speed inside the low-Doppler notch? The ground does not move, so
 * its echo has no Doppler shift; the filter that removes it also removes anything this slow.
 */
export const inDopplerNotch = (
  closingSpeedMps: number,
  radar: Pick<SearchRadarConfig, 'dopplerNotchMps'>,
): boolean => Math.abs(closingSpeedMps) < radar.dopplerNotchMps;

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
  // Plain comparisons, no subtraction: neighbouring ticks share the exact same edge value, so
  // every bearing falls in exactly one tick's arc. (Subtracting first, as in (b − from) mod 2π,
  // can round a 1e-16 difference to 0 or to the whole span, so a target one rounding step from
  // an edge could be painted twice, or never.)
  const from = normalizeAngle(fromRad);
  const to = normalizeAngle(toRad);
  const b = normalizeAngle(bearingRad);
  return from <= to ? from < b && b <= to : b > from || b <= to;
}

/** An angle brought into [0, 2π). */
function normalizeAngle(rad: number): number {
  if (rad >= 0 && rad < TWO_PI) return rad;
  const a = rad - TWO_PI * Math.floor(rad / TWO_PI);
  return a >= TWO_PI ? 0 : a;
}
