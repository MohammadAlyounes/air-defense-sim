import { SEA_LEVEL_DENSITY_KGM3, STANDARD_ATMOSPHERE, type Atmosphere } from './atmosphere';
import { add, cross, dot, length, normalize, scale, sub, vec3, type Vec3 } from './core/vec';

/**
 * A generic, fictional interceptor: a point mass that boosts, then coasts, and steers with
 * proportional navigation. Air drag slows it as it coasts, more in the thick air near the
 * ground than up high. Every number is an illustrative round value chosen for teaching
 * (see SAFETY.md).
 */
export interface InterceptorConfig {
  /** Speed as it leaves the launcher, m/s. */
  launchSpeedMps: number;
  /** Rocket motor burn time, s. */
  boostS: number;
  /** Acceleration along its path while the motor burns, m/s² (180 m/s² is about 18 g). */
  boostAccelMps2: number;
  /** After this long in flight it destroys itself, s. */
  maxFlightS: number;
  /** Steering limit, m/s² (300 m/s² is about 30 g). */
  maxLateralAccelMps2: number;
  /** Navigation constant N of proportional navigation (typically 3 to 5). */
  navigationConstant: number;
  /** A closest approach within this distance destroys the target, m. */
  lethalRadiusM: number;
  /** The fuze arms after this long, so it cannot go off at the launcher, s. */
  armAfterS: number;
  /** Launch at least this far above the horizon, so it clears the ground, rad. */
  minLaunchElevationRad: number;
  /**
   * Ballistic coefficient β = m / (Cd · A), kg/m²: mass over drag area. The higher it is, the
   * less the air slows it down. `Infinity` turns drag off.
   */
  ballisticCoefficientKgM2: number;
  /**
   * When true, a fuze within the lethal radius always destroys the target (kill probability 1):
   * for tests that need exact outcomes. The default uses the kill-probability model.
   */
  certainKill: boolean;
}

export const DEFAULT_INTERCEPTOR: InterceptorConfig = {
  launchSpeedMps: 40,
  boostS: 4,
  boostAccelMps2: 180,
  maxFlightS: 40,
  maxLateralAccelMps2: 300,
  navigationConstant: 4,
  lethalRadiusM: 15,
  armAfterS: 1,
  minLaunchElevationRad: (15 * Math.PI) / 180,
  ballisticCoefficientKgM2: 20_000,
  certainKill: false,
};

export const GRAVITY_MPS2 = 9.81;
const UP: Vec3 = vec3(0, 0, 1);

/** Initial velocity: straight at the aim point, but at least `minLaunchElevationRad` up. */
export function launchVelocity(from: Vec3, aim: Vec3, config: InterceptorConfig): Vec3 {
  const d = sub(aim, from);
  const ground = Math.hypot(d.x, d.y);
  const elevation = Math.max(Math.atan2(d.z, ground), config.minLaunchElevationRad);
  const heading = Math.atan2(d.x, d.y);
  const horizontal = Math.cos(elevation) * config.launchSpeedMps;
  return vec3(
    horizontal * Math.sin(heading),
    horizontal * Math.cos(heading),
    Math.sin(elevation) * config.launchSpeedMps,
  );
}

/**
 * Steering command from true proportional navigation:
 *
 *   a = N · Vc · (Ω × r̂),  with Ω = (r × v_rel) / |r|²
 *
 * where r points from the interceptor to the target, v_rel is the target's velocity relative
 * to the interceptor, Ω is how fast the line of sight turns (rad/s) and Vc the closing speed.
 * If the line of sight stops turning, the two are on a collision course and the command is
 * zero. Gravity is cancelled too, then the command is limited to sideways steering (the motor
 * alone changes speed) and to the g-limit.
 */
export function guidanceAcceleration(
  missilePos: Vec3,
  missileVel: Vec3,
  targetPos: Vec3,
  targetVel: Vec3,
  config: InterceptorConfig,
): Vec3 {
  const r = sub(targetPos, missilePos);
  const r2 = dot(r, r);
  if (r2 < 1e-6) return vec3(0, 0, 0);
  const rangeM = Math.sqrt(r2);
  const relative = sub(targetVel, missileVel);
  const losRate = scale(cross(r, relative), 1 / r2);
  const closingMps = -dot(r, relative) / rangeM;
  const command = add(
    scale(cross(losRate, scale(r, 1 / rangeM)), config.navigationConstant * closingMps),
    scale(UP, GRAVITY_MPS2),
  );
  const along = normalize(missileVel);
  const sideways = sub(command, scale(along, dot(command, along)));
  const magnitude = length(sideways);
  return magnitude > config.maxLateralAccelMps2
    ? scale(sideways, config.maxLateralAccelMps2 / magnitude)
    : sideways;
}

export interface MissileState {
  position: Vec3;
  velocity: Vec3;
}

/**
 * Deceleration from air drag, as a vector against the motion:
 *
 *   a = −(ρ · |v| / (2β)) · v,   i.e. |a| = ρ v² / (2β)
 */
export function dragAcceleration(
  velocity: Vec3,
  densityKgM3: number,
  ballisticCoefficientKgM2: number,
): Vec3 {
  if (!Number.isFinite(ballisticCoefficientKgM2)) return vec3(0, 0, 0);
  return scale(velocity, (-densityKgM3 * length(velocity)) / (2 * ballisticCoefficientKgM2));
}

/**
 * Advances the interceptor by `dt` seconds: steering, motor thrust (during the boost), air drag
 * and gravity, integrated with semi-implicit Euler (new velocity first, then position).
 */
export function stepMissile(
  missile: MissileState,
  flightS: number,
  targetPos: Vec3,
  targetVel: Vec3,
  dt: number,
  config: InterceptorConfig,
  atmosphere: Atmosphere = STANDARD_ATMOSPHERE,
): MissileState {
  const steer = guidanceAcceleration(
    missile.position,
    missile.velocity,
    targetPos,
    targetVel,
    config,
  );
  const thrust =
    flightS < config.boostS
      ? scale(normalize(missile.velocity), config.boostAccelMps2)
      : vec3(0, 0, 0);
  const drag = dragAcceleration(
    missile.velocity,
    atmosphere.densityKgM3(missile.position.z),
    config.ballisticCoefficientKgM2,
  );
  const accel = add(add(add(steer, thrust), drag), vec3(0, 0, -GRAVITY_MPS2));
  const velocity = add(missile.velocity, scale(accel, dt));
  return { velocity, position: add(missile.position, scale(velocity, dt)) };
}

/**
 * How far the interceptor can fly in `t` seconds along a straight line, through air of density
 * `densityKgM3`: speed builds up during the boost (where drag is small next to the thrust and
 * is left out), then drag slows the coast. With only drag acting, dv/dt = −k·v² with
 * k = ρ / (2β), which integrates to
 *
 *   v(τ) = v₀ / (1 + k·v₀·τ),   s(τ) = ln(1 + k·v₀·τ) / k
 *
 * The command node uses it to plan intercepts.
 */
export function reachM(
  t: number,
  config: InterceptorConfig,
  densityKgM3 = SEA_LEVEL_DENSITY_KGM3,
): number {
  const { launchSpeedMps: v0, boostS, boostAccelMps2: a } = config;
  if (t <= boostS) return v0 * t + 0.5 * a * t * t;
  const burnout = v0 + a * boostS;
  const coastS = t - boostS;
  const k = dragConstant(config, densityKgM3);
  const coast = k > 0 ? Math.log1p(k * burnout * coastS) / k : burnout * coastS;
  return v0 * boostS + 0.5 * a * boostS * boostS + coast;
}

/** Speed after `t` seconds of straight flight, with the same assumptions as `reachM`, m/s. */
export function speedAfterMps(
  t: number,
  config: InterceptorConfig,
  densityKgM3 = SEA_LEVEL_DENSITY_KGM3,
): number {
  const { launchSpeedMps: v0, boostS, boostAccelMps2: a } = config;
  if (t <= boostS) return v0 + a * t;
  const burnout = v0 + a * boostS;
  return burnout / (1 + dragConstant(config, densityKgM3) * burnout * (t - boostS));
}

/** k = ρ / (2β), 1/m: the drag deceleration is k·v². */
function dragConstant(config: InterceptorConfig, densityKgM3: number): number {
  return Number.isFinite(config.ballisticCoefficientKgM2)
    ? densityKgM3 / (2 * config.ballisticCoefficientKgM2)
    : 0;
}

/**
 * Closest approach during one short step in which both objects move in straight lines.
 * `startOffset` and `endOffset` are the target's position relative to the interceptor at the
 * start and the end of the step. Returns the fraction of the step at which they are closest
 * (0 to 1) and the distance then. A fraction below 1 means they stopped closing during the
 * step: the closest approach has been reached.
 */
export function closestApproach(
  startOffset: Vec3,
  endOffset: Vec3,
): { fraction: number; distanceM: number } {
  const change = sub(endOffset, startOffset);
  const changeSq = dot(change, change);
  const fraction =
    changeSq > 0 ? Math.min(1, Math.max(0, -dot(startOffset, change) / changeSq)) : 1;
  return { fraction, distanceM: length(add(startOffset, scale(change, fraction))) };
}
