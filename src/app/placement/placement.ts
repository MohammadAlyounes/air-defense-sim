import {
  coverageAt,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  RADAR_CROSS_SECTION_M2,
  TRAFFIC,
  type Command,
  type CoverageMap,
  type Terrain,
  type TrafficTypeId,
} from '../../sim';
import { worldCoverage, worldTerrain } from '../world/world';

/**
 * Placing traffic from the palette: where it may go, how high it flies and where it heads.
 * Pure functions, shared by the drag layer, the scope and the 3D view.
 */

export interface GroundPoint {
  eastM: number;
  northM: number;
}

/** Drops closer than this to the battery would arrive already through the defense, m. */
export const MIN_DROP_RANGE_M = 3_000;
/** Drops beyond the radar's coverage would only fly in from outside the map, m. */
export const MAX_DROP_RANGE_M = 40_000;

/** Altitudes each type may be given while placing it (illustrative, see SAFETY.md), m. */
export const ALTITUDE_RANGE_M: Readonly<Record<TrafficTypeId, readonly [number, number]>> = {
  drone: [50, 1_500],
  swarm: [50, 1_500],
  cruise: [30, 150],
  jet: [300, 10_000],
  friendly: [500, 9_000],
  airliner: [8_000, 12_000],
};

const TWO_PI = 2 * Math.PI;

export const groundRangeOf = (p: GroundPoint) => Math.hypot(p.eastM, p.northM);

/** Compass bearing of the point as seen from the battery: 0 = north, clockwise. */
export function bearingOf(p: GroundPoint): number {
  const b = Math.atan2(p.eastM, p.northM);
  return b < 0 ? b + TWO_PI : b;
}

/** True if traffic may be placed there: inside the radar's coverage, not on top of the battery. */
export function isValidDrop(p: GroundPoint): boolean {
  const range = groundRangeOf(p);
  return range >= MIN_DROP_RANGE_M && range <= MAX_DROP_RANGE_M;
}

/** Heading from the point straight at the battery (the nearest, and for now only, defended asset). */
export function headingToBattery(p: GroundPoint): number {
  return (bearingOf(p) + Math.PI) % TWO_PI;
}

/** One mouse-wheel notch changes the altitude by 15%, within the type's range. */
export function stepAltitude(type: TrafficTypeId, altitudeM: number, notches: number): number {
  const [min, max] = ALTITUDE_RANGE_M[type];
  const next = altitudeM * 1.15 ** notches;
  return Math.round(Math.min(max, Math.max(min, next)) / 10) * 10;
}

/** The command that places the traffic, flying straight at the battery. */
export function spawnCommand(
  type: TrafficTypeId,
  at: GroundPoint,
  altitudeM: number,
): Extract<Command, { kind: 'spawnTraffic' }> {
  return {
    kind: 'spawnTraffic',
    type,
    eastM: Math.round(at.eastM),
    northM: Math.round(at.northM),
    headingRad: headingToBattery(at),
    altitudeM,
  };
}

/** Where keyboard placement puts the n-th threat: 30 km out, a little further round each time. */
export function keyboardSpot(n: number): GroundPoint {
  const bearing = ((45 + 70 * n) % 360) * (Math.PI / 180);
  return { eastM: 30_000 * Math.sin(bearing), northM: 30_000 * Math.cos(bearing) };
}

/** Route samples for the first-seen estimate, m. */
const ROUTE_STEP_M = 200;

/** Numbers for the placement readout. */
export function placementFacts(
  type: TrafficTypeId,
  at: GroundPoint,
  altitudeM: number = TRAFFIC[type].altitudeM,
  world: { terrain: Terrain; coverage: CoverageMap } = {
    terrain: worldTerrain(),
    coverage: worldCoverage(),
  },
) {
  const performance = TRAFFIC[type];
  const detectedFromM = detectionRangeM(
    RADAR_CROSS_SECTION_M2[performance.radarSize],
    DEFAULT_SEARCH_RADAR,
  );
  return {
    rangeM: groundRangeOf(at),
    bearingRad: bearingOf(at),
    /** Time to reach the battery flying straight at it, s. */
    timeToBatteryS: groundRangeOf(at) / performance.speedMps,
    /** Range at which the radar sees it on half of its looks, over open ground (the fourth-root law), m. */
    detectedFromM,
    /**
     * Range at which it first comes into view on its way to the battery: inside that range, and
     * not hidden by the terrain or below the horizon, m. Null if it is never in view.
     */
    firstSeenM: firstSeenOnRoute(at, altitudeM, performance.altitudeRef, detectedFromM, world),
  };
}

/**
 * Walks the straight route to the battery and returns the ground range of the first point
 * where the radar could see it: within the 50% detection range, and above the lowest visible
 * height from the coverage map. Terrain followers keep their height above the ground; the
 * others keep their altitude (but stay above the hills).
 */
function firstSeenOnRoute(
  at: GroundPoint,
  altitudeM: number,
  ref: 'AGL' | 'MSL',
  detectedFromM: number,
  { terrain, coverage }: { terrain: Terrain; coverage: CoverageMap },
): number | null {
  const range = groundRangeOf(at);
  if (range === 0) return 0;
  for (let r = Math.min(range, detectedFromM); r > 0; r -= ROUTE_STEP_M) {
    const east = (at.eastM / range) * r;
    const north = (at.northM / range) * r;
    const ground = terrain.heightAt(east, north);
    const agl = ref === 'AGL' ? altitudeM : Math.max(altitudeM, ground + 150) - ground;
    if (agl >= coverageAt(coverage, east, north)) return r;
  }
  return null;
}
