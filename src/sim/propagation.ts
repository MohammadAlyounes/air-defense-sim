import type { Vec3 } from './core/vec';
import type { Terrain } from './terrain';

/**
 * Where the radar can see: Earth curvature and terrain block the straight line from the
 * antenna to a target. Radio waves bend slightly downward in the lower atmosphere, which the
 * textbook "4/3 Earth" model handles by using an Earth one third larger than the real one.
 */

export const EARTH_RADIUS_M = 6_371_000;
/** Effective Earth radius for radio waves (4/3 model), m. */
export const EFFECTIVE_EARTH_RADIUS_M = (4 / 3) * EARTH_RADIUS_M;

/** How far the Earth's surface has curved away below a flat map at ground distance `d`, m. */
export const curvatureDropM = (groundDistanceM: number): number =>
  (groundDistanceM * groundDistanceM) / (2 * EFFECTIVE_EARTH_RADIUS_M);

/**
 * Radar horizon over a smooth Earth: the farthest ground distance at which an antenna at
 * `antennaHeightM` can see a target at `targetHeightM`, m.
 *
 *   d = √(2·R·h₁) + √(2·R·h₂)   (≈ 4.12 km × (√h₁ + √h₂), heights in metres)
 */
export function radarHorizonM(antennaHeightM: number, targetHeightM: number): number {
  const twoR = 2 * EFFECTIVE_EARTH_RADIUS_M;
  return (
    Math.sqrt(twoR * Math.max(0, antennaHeightM)) + Math.sqrt(twoR * Math.max(0, targetHeightM))
  );
}

/** Whether the radar has a clear line of sight to a point, and if not, what is in the way. */
export type Visibility = 'visible' | 'horizon' | 'terrain';

/** Ground spacing of the samples along a line of sight, m. */
const LOS_STEP_M = 150;

/**
 * Line of sight from the antenna to a target, over curved Earth and terrain.
 *
 * Everything is measured as height above a flat plane through the antenna's foot, minus the
 * curvature drop: the Earth (and every hill) sinks by d²/2R at distance d. The ray is then a
 * straight line from the antenna to the target, and it is blocked if any sample of the ground
 * rises above it. If the smooth Earth alone blocks it, the target is below the radar horizon.
 */
export function lineOfSight(terrain: Terrain, antenna: Vec3, target: Vec3): Visibility {
  const dx = target.x - antenna.x;
  const dy = target.y - antenna.y;
  const distanceM = Math.hypot(dx, dy);
  if (distanceM < LOS_STEP_M) return 'visible';
  const targetHeight = target.z - curvatureDropM(distanceM);
  const samples = Math.floor(distanceM / LOS_STEP_M);
  let blockedByTerrain = false;
  for (let i = 1; i < samples; i++) {
    const f = i / samples;
    const d = f * distanceM;
    const ray = antenna.z + (targetHeight - antenna.z) * f;
    const drop = curvatureDropM(d);
    if (-drop > ray) return 'horizon';
    if (
      !blockedByTerrain &&
      terrain.heightAt(antenna.x + dx * f, antenna.y + dy * f) - drop > ray
    ) {
      blockedByTerrain = true;
    }
  }
  return blockedByTerrain ? 'terrain' : 'visible';
}

/**
 * Does the radar light the ground at (east, north)? Where it does, the ground sends back its own
 * echo (clutter) from the same range as a target flying over it, far stronger than a small
 * target's, and only the Doppler filter can tell the two apart. Ground behind a hill or below
 * the radar horizon is in shadow and sends nothing back.
 */
export function groundLit(terrain: Terrain, antenna: Vec3, eastM: number, northM: number): boolean {
  const ground = { x: eastM, y: northM, z: terrain.heightAt(eastM, northM) };
  return lineOfSight(terrain, antenna, ground) === 'visible';
}

/**
 * Does the echo of a target at `position` arrive together with clutter? The search radar's beam
 * is a tall fan, so it also lights the ground at the target's distance on the same bearing,
 * and that ground's echo comes back at the same time. For a low flyer this is the ground just
 * below it; for a high one, ground farther out.
 */
export function inClutter(terrain: Terrain, antenna: Vec3, position: Vec3): boolean {
  const dx = position.x - antenna.x;
  const dy = position.y - antenna.y;
  const groundM = Math.hypot(dx, dy);
  // Straight above the radar: the ground all around it is lit.
  if (groundM < 1) return true;
  const scale = Math.hypot(groundM, position.z - antenna.z) / groundM;
  return groundLit(terrain, antenna, antenna.x + dx * scale, antenna.y + dy * scale);
}

/** For each bearing and range, the lowest height above the ground at which the radar sees a target. */
export interface CoverageMap {
  /** Number of bearings, evenly spaced clockwise from north. */
  bearings: number;
  /** Ground distance between range samples, m. The first sample is one step out. */
  rangeStepM: number;
  ranges: number;
  /** Lowest visible height above the ground, m, at index `bearing * ranges + range`. */
  minVisibleAglM: Float32Array;
}

/**
 * Coverage map by radial sweep: walking out along each bearing, it keeps the steepest angle
 * from the antenna to any ground seen so far (with curvature). A target farther out is
 * visible only above that angle, which gives the lowest visible height at every range.
 * One pass per bearing: about 70,000 height samples for the whole map.
 */
export function coverageMap(
  terrain: Terrain,
  antennaHeightM: number,
  maxRangeM: number,
  bearings = 360,
  rangeStepM = 200,
): CoverageMap {
  const ranges = Math.floor(maxRangeM / rangeStepM);
  const minVisibleAglM = new Float32Array(bearings * ranges);
  for (let b = 0; b < bearings; b++) {
    const bearing = (b / bearings) * 2 * Math.PI;
    const east = Math.sin(bearing);
    const north = Math.cos(bearing);
    let maxSlope = Number.NEGATIVE_INFINITY;
    for (let r = 0; r < ranges; r++) {
      const d = (r + 1) * rangeStepM;
      const ground = terrain.heightAt(east * d, north * d);
      const drop = curvatureDropM(d);
      const lowestVisible = Number.isFinite(maxSlope)
        ? antennaHeightM + maxSlope * d + drop
        : Number.NEGATIVE_INFINITY;
      minVisibleAglM[b * ranges + r] = Math.max(0, lowestVisible - ground);
      maxSlope = Math.max(maxSlope, (ground - drop - antennaHeightM) / d);
    }
  }
  return { bearings, rangeStepM, ranges, minVisibleAglM };
}

/** Lowest visible height above the ground at (east, north), from a coverage map, m. */
export function coverageAt(map: CoverageMap, eastM: number, northM: number): number {
  const range = Math.hypot(eastM, northM);
  const r = Math.round(range / map.rangeStepM) - 1;
  if (r < 0) return 0;
  if (r >= map.ranges) return Number.POSITIVE_INFINITY;
  let bearing = Math.atan2(eastM, northM);
  if (bearing < 0) bearing += 2 * Math.PI;
  const b = Math.round((bearing / (2 * Math.PI)) * map.bearings) % map.bearings;
  return map.minVisibleAglM[b * map.ranges + r] ?? 0;
}
