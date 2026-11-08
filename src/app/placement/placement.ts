import {
  bearingTo,
  CALM,
  coverageAt,
  DEFAULT_CORRIDORS,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  dropRoute,
  nearestCorridor,
  RADAR_CROSS_SECTION_M2,
  TRAFFIC,
  vec3,
  windTriangle,
  windVelocityAt,
  type AircraftType,
  type Command,
  type CoverageMap,
  type Terrain,
  type TrafficTypeId,
  type Vec3,
  type WindConfig,
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

/** Placed airliners join the nearest civil corridor; everything else heads for the battery. */
const joinsCorridor = (type: TrafficTypeId) => type === 'airliner';

/**
 * The command that places the traffic: flying straight at the battery, or for an airliner
 * with no heading at all, so the simulation sends it along the nearest civil corridor.
 */
export function spawnCommand(
  type: TrafficTypeId,
  at: GroundPoint,
  altitudeM: number,
): Extract<Command, { kind: 'spawnTraffic' }> {
  const command: Extract<Command, { kind: 'spawnTraffic' }> = {
    kind: 'spawnTraffic',
    type,
    eastM: Math.round(at.eastM),
    northM: Math.round(at.northM),
    altitudeM,
  };
  return joinsCorridor(type) ? command : { ...command, headingRad: headingToBattery(at) };
}

/** Where keyboard placement puts the n-th threat: 30 km out, a little further round each time. */
export function keyboardSpot(n: number): GroundPoint {
  const bearing = ((45 + 70 * n) % 360) * (Math.PI / 180);
  return { eastM: 30_000 * Math.sin(bearing), northM: 30_000 * Math.cos(bearing) };
}

/** Route samples for the first-seen estimate, m. */
const ROUTE_STEP_M = 200;

/** A swarm is placed as drones, so it flies a drone's route. */
const aircraftTypeOf = (type: TrafficTypeId): AircraftType => (type === 'swarm' ? 'drone' : type);

/**
 * The ground waypoints the simulation will fly from `at`: straight at the battery, or for a
 * cruise-missile-like target a dog-leg (off to one side, then back in) when there is room. An
 * airliner joins the nearest civil corridor at 45° and flies it out of the area.
 */
export function placementRoute(type: TrafficTypeId, at: GroundPoint): Vec3[] {
  const start = vec3(at.eastM, at.northM, 0);
  return joinsCorridor(type)
    ? dropRoute(aircraftTypeOf(type), start, undefined, DEFAULT_CORRIDORS)
    : dropRoute(aircraftTypeOf(type), start, headingToBattery(at));
}

/** Numbers for the placement readout. */
export function placementFacts(
  type: TrafficTypeId,
  at: GroundPoint,
  altitudeM: number = TRAFFIC[type].altitudeM,
  world: { terrain: Terrain; coverage: CoverageMap } = {
    terrain: worldTerrain(),
    coverage: worldCoverage(),
  },
  wind: WindConfig = CALM,
) {
  const performance = TRAFFIC[type];
  const detectedFromM = detectionRangeM(
    RADAR_CROSS_SECTION_M2[performance.radarSize],
    DEFAULT_SEARCH_RADAR,
  );
  const route = placementRoute(type, at);
  const start = vec3(at.eastM, at.northM, 0);
  const aglM = (east: number, north: number) => {
    const ground = world.terrain.heightAt(east, north);
    return performance.altitudeRef === 'AGL'
      ? altitudeM
      : Math.max(altitudeM, ground + 150) - ground;
  };
  const corridor = joinsCorridor(type)
    ? nearestCorridor(DEFAULT_CORRIDORS, at.eastM, at.northM)
    : null;
  return {
    rangeM: groundRangeOf(at),
    bearingRad: bearingOf(at),
    /** The waypoints it will fly: ending at the battery, or at the far end of its corridor. */
    route,
    /** Time to reach the battery along its route, through this run's wind, s (not for airliners). */
    timeToBatteryS: corridor ? null : flightTimeS(start, route, performance.speedMps, wind, aglM),
    /** The civil corridor a placed airliner joins, and the time until it joins it, s (0: on it). */
    corridor: corridor
      ? {
          name: corridor.name,
          joinInS:
            route.length > 1
              ? flightTimeS(start, route.slice(0, 1), performance.speedMps, wind, aglM)
              : 0,
        }
      : null,
    /** Range at which the radar sees it on half of its looks, over open ground (the fourth-root law), m. */
    detectedFromM,
    /**
     * Range at which it first comes into view on its way to the battery: inside that range, and
     * not hidden by the terrain or below the horizon, m. Null if it is never in view.
     */
    firstSeenM: firstSeenOnRoute(start, route, detectedFromM, world.coverage, aglM),
  };
}

/**
 * Time to fly a route at `airspeedMps` through the wind: each leg at the ground speed the wind
 * triangle gives at the aircraft's height there (taken at the leg's start), s.
 */
function flightTimeS(
  start: Vec3,
  route: readonly Vec3[],
  airspeedMps: number,
  wind: WindConfig,
  aglM: (east: number, north: number) => number,
): number {
  let total = 0;
  let from = start;
  for (const to of route) {
    const leg = Math.hypot(to.x - from.x, to.y - from.y);
    if (leg > 0) {
      const air = windVelocityAt(wind, aglM(from.x, from.y));
      const ground = windTriangle(bearingTo(from, to), airspeedMps, air).groundSpeedMps;
      total += ground > 0 ? leg / ground : Number.POSITIVE_INFINITY;
    }
    from = to;
  }
  return total;
}

/**
 * Walks the route from the drop point and returns the ground range of the first point where
 * the radar could see it: within the 50% detection range, and above the lowest visible height
 * from the coverage map. Terrain followers keep their height above the ground; the others keep
 * their altitude (but stay above the hills).
 */
function firstSeenOnRoute(
  start: Vec3,
  route: readonly Vec3[],
  detectedFromM: number,
  coverage: CoverageMap,
  aglM: (east: number, north: number) => number,
): number | null {
  let from = start;
  for (const to of route) {
    const leg = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.ceil(leg / ROUTE_STEP_M));
    for (let i = 0; i <= steps; i++) {
      const east = from.x + ((to.x - from.x) * i) / steps;
      const north = from.y + ((to.y - from.y) * i) / steps;
      const range = Math.hypot(east, north);
      if (range > detectedFromM) continue;
      if (range < 1 || aglM(east, north) >= coverageAt(coverage, east, north)) return range;
    }
    from = to;
  }
  return null;
}
