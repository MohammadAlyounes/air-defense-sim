import { TICK_S } from './core/clock';
import { add, scale, sub, vec3, type Vec3 } from './core/vec';
import {
  horizontalEllipse,
  initialState,
  innovation,
  measurementCovariance,
  predict,
  update,
  type KalmanState,
  type ProcessNoise,
} from './kalman';
import type { SearchRadarConfig } from './radar';
import type { Plot, Track } from './types';

/**
 * The tracker: turns radar plots into tracks. Each track carries a Kalman filter's estimate of
 * position and velocity and its covariance. New plots are matched to tracks by gating and
 * nearest-neighbour association, using only what the radar measured: the tracker never knows
 * which aircraft (if any) made an echo.
 */
export interface TrackerConfig {
  processNoise: ProcessNoise;
  /** Velocity uncertainty of a brand-new track (one plot, velocity unknown), m/s. */
  initialVelocitySigma: { horizontal: number; vertical: number };
  /**
   * A plot may join a track only if its normalized innovation squared is below this: the
   * chi-square value that a plot from the track itself exceeds only 0.1% of the time (3 degrees
   * of freedom).
   */
  gate: number;
}

export const DEFAULT_TRACKER: TrackerConfig = {
  processNoise: { horizontal: 4, vertical: 30 },
  initialVelocitySigma: { horizontal: 120, vertical: 30 },
  gate: 16.27,
};

/** Where the battery believes a track is at `tick`: its filtered position, moved on at its filtered velocity. */
export function trackPositionAt(track: Track, tick: number): Vec3 {
  if (!track.velocity) return track.position;
  return add(track.position, scale(track.velocity, (tick - track.lastPaintTick) * TICK_S));
}

/** The track's estimate predicted to `tick`. */
export function estimateAt(
  track: Track,
  tick: number,
  config: TrackerConfig = DEFAULT_TRACKER,
): KalmanState {
  return predict(track.estimate, (tick - track.lastPaintTick) * TICK_S, config.processNoise);
}

/** The track's horizontal uncertainty at `tick`: one-sigma ellipse, m, major axis as a bearing. */
export function trackEllipseAt(
  track: Track,
  tick: number,
  config: TrackerConfig = DEFAULT_TRACKER,
) {
  return horizontalEllipse(estimateAt(track, tick, config).P);
}

/** Measurement covariance of a plot, from the radar's noise levels and the plot's geometry. */
export function plotCovariance(plot: Plot, antenna: Vec3, radar: SearchRadarConfig): number[] {
  const rel = sub(plot.position, antenna);
  const slant = Math.max(1, Math.hypot(rel.x, rel.y, rel.z));
  return measurementCovariance(slant, Math.atan2(rel.x, rel.y), Math.asin(rel.z / slant), {
    rangeM: radar.rangeSigmaM,
    azimuthRad: radar.azimuthSigmaRad,
    elevationRad: radar.elevationSigmaRad,
  });
}

export const toVector = (p: Vec3): number[] => [p.x, p.y, p.z];

/** Starts a tentative track's filter from its first plot. */
export function startEstimate(
  plot: Plot,
  R: readonly number[],
  config: TrackerConfig = DEFAULT_TRACKER,
): KalmanState {
  return initialState(toVector(plot.position), R, config.initialVelocitySigma);
}

/** Predicts the track to the plot's tick, then blends the plot in. */
export function updateEstimate(
  track: Track,
  plot: Plot,
  R: readonly number[],
  config: TrackerConfig = DEFAULT_TRACKER,
): KalmanState {
  return update(estimateAt(track, plot.tick, config), toVector(plot.position), R);
}

export const positionOf = (state: KalmanState): Vec3 =>
  vec3(state.x[0] ?? 0, state.x[1] ?? 0, state.x[2] ?? 0);
export const velocityOf = (state: KalmanState): Vec3 =>
  vec3(state.x[3] ?? 0, state.x[4] ?? 0, state.x[5] ?? 0);

/**
 * Global nearest-neighbour association for a batch of plots. Every (plot, track) pair inside the
 * gate is a candidate, with the track predicted to the plot's own tick; the closest pairs (in
 * standard deviations) are taken first, each plot and each track at most once. A track updated
 * less than `minGapTicks` before a plot cannot take it, so one antenna pass never feeds a track
 * twice. Returns the track index for each plot, or -1 when it would start a new track.
 */
export function associate(
  plots: readonly Plot[],
  covariances: readonly (readonly number[])[],
  tracks: readonly Track[],
  minGapTicks: number,
  config: TrackerConfig = DEFAULT_TRACKER,
): number[] {
  const pairs: { plot: number; track: number; nis: number }[] = [];
  tracks.forEach((track, t) => {
    plots.forEach((plot, p) => {
      if (plot.tick - track.lastPaintTick < minGapTicks) return;
      const predicted = estimateAt(track, plot.tick, config);
      const { nis } = innovation(predicted, toVector(plot.position), covariances[p] ?? []);
      if (nis <= config.gate) pairs.push({ plot: p, track: t, nis });
    });
  });
  pairs.sort((a, b) => a.nis - b.nis || a.track - b.track || a.plot - b.plot);
  const result = plots.map(() => -1);
  const used = new Set<number>();
  for (const pair of pairs) {
    if (result[pair.plot] !== -1 || used.has(pair.track)) continue;
    result[pair.plot] = pair.track;
    used.add(pair.track);
  }
  return result;
}
