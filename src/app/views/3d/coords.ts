import type { Aircraft, Snapshot, Vec3 } from '../../../sim';

/**
 * Bridges the simulation's coordinates to the 3D scene.
 *
 * The simulation measures everything in metres in a local East-North-Up frame (x east,
 * y north, z up). three.js uses y for "up" and the camera looks down -z by default, so the
 * scene uses: x = east, y = up, z = -north (north points into the screen). Scene units are
 * kilometres, which keeps numbers small for a 40 km area.
 */

export const SCENE_UNITS_PER_M = 1 / 1000;

/** Height stretch options offered in the 3D view. Labels always show true heights. */
export const HEIGHT_SCALES = [1, 2, 4] as const;
export type HeightScale = (typeof HEIGHT_SCALES)[number];

const TWO_PI = 2 * Math.PI;

/** Simulation position (ENU, metres) to scene position (km, y up), with heights stretched. */
export function toScene(p: Vec3, heightScale: number): [number, number, number] {
  return [p.x * SCENE_UNITS_PER_M, p.z * SCENE_UNITS_PER_M * heightScale, -p.y * SCENE_UNITS_PER_M];
}

/** Compass heading of a velocity vector: 0 = north, clockwise, in [0, 2π). */
export function headingOf(v: Vec3): number {
  const heading = Math.atan2(v.x, v.y);
  return heading < 0 ? heading + TWO_PI : heading;
}

/** Rotation about the scene's vertical axis that turns a model's nose (toward -z, north) onto a compass heading. */
export const yawForHeading = (headingRad: number): number => -headingRad;

export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/**
 * Size in world units that appears `pixels` tall at `distance` from a perspective camera.
 * Used to draw aircraft at a constant on-screen size: a 2 m drone 30 km away would otherwise be
 * a twentieth of a pixel.
 */
export function worldSizeForPixels(
  distance: number,
  fovDeg: number,
  viewportHeightPx: number,
  pixels: number,
  /** Camera zoom: 2 shows everything twice as large (half the field of view's tangent). */
  zoom = 1,
): number {
  return (2 * distance * Math.tan((fovDeg * Math.PI) / 360) * pixels) / (viewportHeightPx * zoom);
}

/** The angle equivalent to `to` that is closest to `from`, so a camera turns the short way round. */
export function nearestAngle(from: number, to: number): number {
  const TWO_PI = 2 * Math.PI;
  const delta = ((((to - from) % TWO_PI) + TWO_PI + Math.PI) % TWO_PI) - Math.PI;
  return from + delta;
}

export interface InterpolatedAircraft {
  aircraft: Aircraft;
  /** Position blended between the last two ticks, metres (ENU). */
  position: Vec3;
}

/** Positions between two snapshots, matched by id. New arrivals appear at their current position. */
export function interpolateAircraft(
  previous: Snapshot,
  current: Snapshot,
  alpha: number,
): InterpolatedAircraft[] {
  const before = new Map(previous.aircraft.map((a) => [a.id, a]));
  return current.aircraft.map((aircraft) => {
    const old = before.get(aircraft.id);
    return {
      aircraft,
      position: old ? lerpVec(old.position, aircraft.position, alpha) : aircraft.position,
    };
  });
}
