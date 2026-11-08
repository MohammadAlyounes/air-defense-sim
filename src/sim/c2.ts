import { STANDARD_ATMOSPHERE, type Atmosphere } from './atmosphere';
import { looksLikeThreat, type FlightProfile } from './classify';
import { add, distance, dot, scale, vec3, type Vec3 } from './core/vec';
import { reachM, speedAfterMps, type InterceptorConfig } from './interceptor';
import { trackPositionAt } from './tracker';
import type { DefendedAsset } from './assets';
import type { Affiliation } from './traffic';
import type { Threat, Track } from './types';

/** The launcher stands at the radar site, the origin. */
export const LAUNCHER_POSITION: Vec3 = vec3(0, 0, 0);

/**
 * The command node: it identifies tracks, decides which ones threaten a defended asset, and
 * when and whether an interceptor may be fired at them, within the rules of engagement.
 */
export interface DefenseConfig {
  /** The identification check (IFF) answers this long after a track is confirmed, s. */
  iffDelayS: number;
  /** A track that does not answer is checked again this much later, s. */
  iffRecheckS: number;
  /** Checks without an answer before a track is declared hostile. */
  iffChecks: number;
  /** Chance that a friendly aircraft answers one check (its transponder can fail). */
  friendReplyProbability: number;
  /** Chance that a civil aircraft's transponder code is received on one check. */
  civilSquawkProbability: number;
  /** Engagements the tracking radar can guide at once: its fire channels. */
  fireChannels: number;
  /** After the operator holds fire on a track, it is not proposed again for this long, s. */
  holdFireS: number;
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
  iffRecheckS: 4,
  iffChecks: 2,
  friendReplyProbability: 0.9,
  civilSquawkProbability: 0.98,
  fireChannels: 3,
  holdFireS: 20,
  minInterceptRangeM: 1_500,
  launchPrepS: 1.5,
  launchIntervalS: 2,
  launcherCapacity: 12,
  reloadS: 30,
  planningReachFactor: 0.9,
  maxPlannedFlightS: 34,
};

/**
 * What the battery believes a track is. 'pending' until the identification check has been
 * tried; 'friend' or 'neutral' (civil) once it answers. A silent track with checks left is
 * 'suspect' if it flies like a threat (see `flightProfile`) and 'unknown' otherwise; silence on
 * every check makes it 'hostile', unless it is assumed civil (see `assumedCivil`).
 */
export type Identity = 'pending' | 'unknown' | 'suspect' | 'friend' | 'neutral' | 'hostile';

/** Checked and not identified as friend or civil: the command node weighs it as a possible threat. */
export const mayThreaten = (identity: Identity): boolean =>
  identity === 'unknown' || identity === 'suspect' || identity === 'hostile';

/**
 * Weapons control status: HOLD (do not fire), TIGHT (hostile only), FREE (anything checked and
 * not identified as friend or civil: unknown and suspect tracks too).
 */
export type WeaponsControl = 'HOLD' | 'TIGHT' | 'FREE';
/** AUTO: the battery fires on its own; SEMI: it proposes each shot and the operator approves. */
export type OperatorMode = 'AUTO' | 'SEMI';

export interface Rules {
  weaponsControl: WeaponsControl;
  operatorMode: OperatorMode;
}

export const DEFAULT_RULES: Rules = { weaponsControl: 'TIGHT', operatorMode: 'AUTO' };

/** May the battery fire at a track with this identity under these rules? */
export function engageable(identity: Identity, weaponsControl: WeaponsControl): boolean {
  if (weaponsControl === 'HOLD') return false;
  if (identity === 'hostile') return true;
  return weaponsControl === 'FREE' && mayThreaten(identity);
}

/**
 * A silent track that flies like an airliner along a civil air corridor is taken for an
 * airliner whose transponder code was not received: silence alone does not make it hostile.
 */
export const assumedCivil = (profile: FlightProfile | null, corridorId: number | null): boolean =>
  profile === 'airliner' && corridorId !== null;

/**
 * The identity a track earns after `checks` identification checks without an answer: 'hostile'
 * once it has failed `iffChecks` of them; before that 'suspect' if it flies like a threat, and
 * 'unknown' otherwise. A track assumed civil (an airliner flying a corridor) stays 'unknown'.
 */
export function identityAfterSilence(
  checks: number,
  config: Pick<DefenseConfig, 'iffChecks'>,
  profile: FlightProfile | null,
  corridorId: number | null,
): 'unknown' | 'suspect' | 'hostile' {
  if (assumedCivil(profile, corridorId)) return 'unknown';
  if (checks >= config.iffChecks) return 'hostile';
  return looksLikeThreat(profile) ? 'suspect' : 'unknown';
}

/**
 * One identification check (IFF: identification friend or foe). Friendly aircraft answer the
 * interrogation, civil aircraft broadcast a civil transponder code, hostiles do neither. But
 * transponders fail now and then, so a friendly aircraft can stay silent: that is how
 * identification mistakes happen. Returns the answer, or null for silence.
 */
export function iffAnswer(
  affiliation: Affiliation,
  draw: number,
  config: Pick<DefenseConfig, 'friendReplyProbability' | 'civilSquawkProbability'>,
): 'friend' | 'neutral' | null {
  if (affiliation === 'friend') return draw < config.friendReplyProbability ? 'friend' : null;
  if (affiliation === 'neutral') return draw < config.civilSquawkProbability ? 'neutral' : null;
  return null;
}

/**
 * Closest point of approach (CPA) to a ground point along a straight course: how close the
 * course passes and how long until it gets there. A negative time means the closest point is
 * behind it (it is flying away).
 *
 *   t_cpa = −(r · v) / |v|²,   d_cpa = |r + v · t_cpa|,   with r the position relative to the point
 */
export function closestApproachTo(
  point: Vec3,
  position: Vec3,
  velocity: Vec3,
): { distanceM: number; timeS: number } {
  const p = vec3(position.x - point.x, position.y - point.y, 0);
  const v = vec3(velocity.x, velocity.y, 0);
  const speedSq = dot(v, v);
  const timeS = speedSq > 1e-9 ? -dot(p, v) / speedSq : 0;
  const closest = add(p, scale(v, timeS));
  return { distanceM: Math.hypot(closest.x, closest.y), timeS };
}

/** Closest approach to the battery (the origin). */
export const closestApproachToOrigin = (position: Vec3, velocity: Vec3) =>
  closestApproachTo(vec3(0, 0, 0), position, velocity);

/**
 * Threat evaluation: the defended asset this course threatens soonest, if any. A course is a
 * threat to an asset if it passes inside the asset's threat radius and is still approaching.
 */
export function evaluateThreat(
  position: Vec3,
  velocity: Vec3,
  assets: readonly DefendedAsset[],
): Threat | null {
  let best: Threat | null = null;
  for (const asset of assets) {
    const pass = closestApproachTo(asset.position, position, velocity);
    if (pass.timeS <= 0 || pass.distanceM >= asset.threatRadiusM) continue;
    if (!best || pass.timeS < best.timeToClosestS) {
      best = { assetId: asset.id, closestApproachM: pass.distanceM, timeToClosestS: pass.timeS };
    }
  }
  return best;
}

/**
 * Single-shot kill probability (Pk): the chance that an interceptor whose fuze goes off within
 * its lethal radius destroys the target. A generic teaching model: agile, fast targets are
 * harder (0.95 for slow targets, 0.85 for medium, 0.75 above 250 m/s), and a slow, tired
 * interceptor manoeuvres less well (scaled by its speed over 600 m/s, between 0.5 and 1).
 *
 *   Pk = Pk_target × clamp(v_interceptor / 600 m/s, 0.5, 1)
 */
export function killProbability(targetSpeedMps: number, interceptorSpeedMps: number): number {
  const base = targetSpeedMps > 250 ? 0.75 : targetSpeedMps > 120 ? 0.85 : 0.95;
  return base * Math.min(1, Math.max(0.5, interceptorSpeedMps / 600));
}

export interface Intercept {
  /** Interceptor flight time to the intercept, s. */
  timeS: number;
  /** Where the target will be then: the predicted intercept point. */
  point: Vec3;
  /** Predicted single-shot kill probability (set by `planIntercept`). */
  pk?: number;
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
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
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
  const v = track.velocity;
  const pk = killProbability(
    Math.hypot(v.x, v.y, v.z),
    speedAfterMps(plan.timeS, interceptor, density),
  );
  return { ...plan, pk };
}

/**
 * The engagement envelope: the farthest ground range at which the battery can intercept a
 * target at `altitudeM`, using the planner's reach (with drag and margin) within the longest
 * planned flight. The inner edge is the minimum intercept range.
 */
export function envelopeRangeM(
  altitudeM: number,
  defense: DefenseConfig,
  interceptor: InterceptorConfig,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): number {
  const density = atmosphere.densityKgM3(Math.max(0, altitudeM) / 2);
  const reach =
    defense.planningReachFactor * reachM(defense.maxPlannedFlightS, interceptor, density);
  return reach > altitudeM ? Math.sqrt(reach * reach - altitudeM * altitudeM) : 0;
}
