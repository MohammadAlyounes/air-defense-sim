import { add, cross, dot, length, normalize, scale, sub, vec3, type Vec3 } from './core/vec';

/**
 * A generic, fictional interceptor: a point mass that boosts, then coasts, and steers with
 * proportional navigation. Every number is an illustrative round value chosen for teaching
 * (see SAFETY.md). Air drag arrives with the atmosphere in Step 4; until then the interceptor
 * only loses speed by climbing.
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
 * Advances the interceptor by `dt` seconds: steering, motor thrust (during the boost) and
 * gravity, integrated with semi-implicit Euler (new velocity first, then position).
 */
export function stepMissile(
  missile: MissileState,
  flightS: number,
  targetPos: Vec3,
  targetVel: Vec3,
  dt: number,
  config: InterceptorConfig,
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
  const accel = add(add(steer, thrust), vec3(0, 0, -GRAVITY_MPS2));
  const velocity = add(missile.velocity, scale(accel, dt));
  return { velocity, position: add(missile.position, scale(velocity, dt)) };
}

/**
 * How far the interceptor can fly in `t` seconds along a straight line: speed builds up during
 * the boost, then stays constant. The command node uses it to plan intercepts.
 */
export function reachM(t: number, config: InterceptorConfig): number {
  const { launchSpeedMps: v0, boostS, boostAccelMps2: a } = config;
  if (t <= boostS) return v0 * t + 0.5 * a * t * t;
  const burnout = v0 + a * boostS;
  return v0 * boostS + 0.5 * a * boostS * boostS + burnout * (t - boostS);
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
