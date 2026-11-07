import { EXPONENTIAL_ATMOSPHERE, type Atmosphere } from './atmosphere';
import { add, distance, dot, scale, vec3, type Vec3 } from './core/vec';
import { reachM, type InterceptorConfig } from './interceptor';
import { trackPositionAt } from './tracker';
import type { Affiliation } from './traffic';
import type { Track } from './types';

/** The launcher stands at the radar site, the origin. */
export const LAUNCHER_POSITION: Vec3 = vec3(0, 0, 0);

/**
 * The command node, Step 3 version: it identifies tracks, decides which ones threaten the
 * battery and when an interceptor can reach them. Identification becomes richer in Step 5,
 * and engagement rules (operator approval, doctrine, fire channels) arrive in Step 6.
 */
export interface DefenseConfig {
  /** The identification check (IFF) answers this long after a track is confirmed, s. */
  iffDelayS: number;
  /** A hostile whose course passes this close to the battery is a threat, m. */
  threatRadiusM: number;
  /** A hostile this close to the battery has got through the defense, m. */
  leakRadiusM: number;
  /** Interceptors cannot engage closer than this to the launcher, m. */
  minInterceptRangeM: number;
  /** From assignment to launch: the launcher turns and the interceptor is readied, s. */
  launchPrepS: number;
  /** Time between two launches from the launcher, s. */
  launchIntervalS: number;
  /** Ready rounds on a full launcher. */
  launcherCapacity: number;
  /** One round is reloaded every this many seconds while the launcher is not full. */
  reloadS: number;
  /** Plans with this share of the interceptor's straight-line reach (turns and climbs cost). */
  planningReachFactor: number;
  /** Only launch if the predicted flight is at most this long, s. */
  maxPlannedFlightS: number;
}

export const DEFAULT_DEFENSE: DefenseConfig = {
  iffDelayS: 2,
  threatRadiusM: 5_000,
  leakRadiusM: 2_000,
  minInterceptRangeM: 1_500,
  launchPrepS: 1.5,
  launchIntervalS: 2,
  launcherCapacity: 12,
  reloadS: 30,
  planningReachFactor: 0.9,
  maxPlannedFlightS: 34,
};

/** What the battery believes a track is. 'pending' until the identification check answers. */
export type Identity = 'pending' | 'friend' | 'neutral' | 'hostile';

/**
 * The identification check, Step 3 version: friendly aircraft answer the IFF interrogation,
 * civil aircraft broadcast civil transponder codes, and anything that does neither is treated
 * as hostile. Step 5 adds mistakes, a kinematic classifier and air corridors.
 */
export function iffAnswer(affiliation: Affiliation): Exclude<Identity, 'pending'> {
  return affiliation;
}

/**
 * Closest approach to the battery (the origin) along a straight course, on the ground:
 * how close the course passes and how long until it gets there. A negative time means the
 * closest point is behind it (it is flying away).
 */
export function closestApproachToOrigin(
  position: Vec3,
  velocity: Vec3,
): { distanceM: number; timeS: number } {
  const p = vec3(position.x, position.y, 0);
  const v = vec3(velocity.x, velocity.y, 0);
  const speedSq = dot(v, v);
  const timeS = speedSq > 1e-9 ? -dot(p, v) / speedSq : 0;
  const closest = add(p, scale(v, timeS));
  return { distanceM: Math.hypot(closest.x, closest.y), timeS };
}

export interface Intercept {
  /** Interceptor flight time to the intercept, s. */
  timeS: number;
  /** Where the target will be then: the predicted intercept point. */
  point: Vec3;
}

/**
 * Predicted intercept point: the earliest time `t` at which an interceptor launched now from
 * `launcher` can be where a target flying in a straight line will be:
 *
 *   reach(t) ≥ |target(0) + v · t − launcher|
 *
 * Scans in quarter-second steps, then narrows the crossing down by bisection. Returns null if
 * the interceptor cannot get there within `maxTimeS`.
 */
export function predictIntercept(
  targetPos: Vec3,
  targetVel: Vec3,
  launcher: Vec3,
  reach: (timeS: number) => number,
  maxTimeS: number,
): Intercept | null {
  const gap = (t: number) => reach(t) - distance(add(targetPos, scale(targetVel, t)), launcher);
  const step = 0.25;
  let before = 0;
  for (let t = step; t <= maxTimeS + 1e-9; t += step) {
    if (gap(t) < 0) {
      before = t;
      continue;
    }
    let low = before;
    let high = t;
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      if (gap(mid) < 0) low = mid;
      else high = mid;
    }
    return { timeS: high, point: add(targetPos, scale(targetVel, high)) };
  }
  return null;
}

/**
 * The command node's firing solution for a track at `tick`, or null when no interceptor
 * launched now could reach it in time (or the meeting point is inside the minimum range).
 * Plans with the track's estimated position and velocity: perception, not truth. Drag is
 * taken at the air density halfway up to the target, the average the interceptor flies through.
 */
export function planIntercept(
  track: Track,
  tick: number,
  defense: DefenseConfig,
  interceptor: InterceptorConfig,
  atmosphere: Atmosphere = EXPONENTIAL_ATMOSPHERE,
): Intercept | null {
  if (!track.velocity) return null;
  const position = trackPositionAt(track, tick);
  const density = atmosphere.densityKgM3(Math.max(0, position.z) / 2);
  const plan = predictIntercept(
    position,
    track.velocity,
    LAUNCHER_POSITION,
    (t) => defense.planningReachFactor * reachM(t, interceptor, density),
    defense.maxPlannedFlightS,
  );
  if (!plan || distance(plan.point, LAUNCHER_POSITION) < defense.minInterceptRangeM) return null;
  return plan;
}
