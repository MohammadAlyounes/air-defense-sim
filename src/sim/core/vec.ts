/**
 * A point or vector in the local East-North-Up frame, in metres (or metres per second).
 * x = east, y = north, z = up; the origin is the battery.
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const TWO_PI = 2 * Math.PI;

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });

/** Ground distance from the origin, ignoring altitude. */
export const groundRange = (p: Vec3): number => Math.hypot(p.x, p.y);

/** Compass bearing from the origin: 0 = north, π/2 = east, measured clockwise, in [0, 2π). */
export function bearing(p: Vec3): number {
  const b = Math.atan2(p.x, p.y);
  return b < 0 ? b + TWO_PI : b;
}

/** Unit horizontal vector for a compass heading (0 = north, clockwise). */
export const headingVector = (headingRad: number): Vec3 => ({
  x: Math.sin(headingRad),
  y: Math.cos(headingRad),
  z: 0,
});
