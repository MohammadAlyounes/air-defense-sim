import { vec3, type Vec3 } from './core/vec';

/**
 * Civil air corridors: straight lanes at airliner heights that civil traffic is expected to
 * fly. A track that flies like an airliner, inside a lane and along it, is assumed to be civil:
 * silence on the identification check alone does not make it hostile. The lanes are fictional
 * and keep well clear of the defended assets (see SAFETY.md).
 */
export interface AirCorridor {
  id: number;
  name: string;
  /** The point of the centreline closest to the battery, ground m (east, north; z unused). */
  centre: Vec3;
  /** Compass direction of the centreline, radians. The lane runs both ways. */
  axisRad: number;
  /** Half the lane's width, m. */
  halfWidthM: number;
  /** Lowest and highest altitude of the lane, m. */
  floorM: number;
  ceilingM: number;
}

const DEG = Math.PI / 180;
const TWO_PI = 2 * Math.PI;

/**
 * A lane whose centreline passes `distanceM` from the battery, at compass bearing `bearingDeg`
 * from it, and runs square to that bearing.
 */
function corridor(id: number, name: string, distanceM: number, bearingDeg: number): AirCorridor {
  const b = bearingDeg * DEG;
  return {
    id,
    name,
    centre: vec3(distanceM * Math.sin(b), distanceM * Math.cos(b), 0),
    axisRad: (b + Math.PI / 2) % TWO_PI,
    halfWidthM: 5_000,
    floorM: 8_000,
    ceilingM: 13_000,
  };
}

/** Two lanes: one 18 km to the north, one 22 km to the south-west. */
export const DEFAULT_CORRIDORS: readonly AirCorridor[] = [
  corridor(1, 'North corridor', 18_000, 10),
  corridor(2, 'South-west corridor', 22_000, 215),
];

/** A track flying within this angle of the lane's direction (either way) flies along it. */
export const CORRIDOR_HEADING_TOLERANCE_RAD = 30 * DEG;

/**
 * Where a ground point lies relative to a lane: `alongM` along the centreline from its point
 * closest to the battery (positive in the direction `axisRad`), and `acrossM` to the right of
 * it, m.
 */
export function corridorFrame(
  lane: AirCorridor,
  eastM: number,
  northM: number,
): { alongM: number; acrossM: number } {
  const ax = Math.sin(lane.axisRad);
  const ay = Math.cos(lane.axisRad);
  const dx = eastM - lane.centre.x;
  const dy = northM - lane.centre.y;
  return { alongM: dx * ax + dy * ay, acrossM: dx * ay - dy * ax };
}

/** The ground point `alongM` along the lane and `acrossM` to the right of its centreline. */
export function corridorPoint(lane: AirCorridor, alongM: number, acrossM = 0): Vec3 {
  const ax = Math.sin(lane.axisRad);
  const ay = Math.cos(lane.axisRad);
  return vec3(
    lane.centre.x + ax * alongM + ay * acrossM,
    lane.centre.y + ay * alongM - ax * acrossM,
    0,
  );
}

/**
 * How far along the centreline, either way from its point closest to the battery, the lane
 * reaches a circle of radius `radiusM` around the battery, m (0 if it never does).
 */
export function corridorHalfLengthM(lane: AirCorridor, radiusM: number): number {
  const d = Math.hypot(lane.centre.x, lane.centre.y);
  return radiusM > d ? Math.sqrt(radiusM * radiusM - d * d) : 0;
}

/**
 * True if an aircraft at `position` with ground track `trackRad` flies the lane: inside its
 * width and height band, and along it (within 30° of its direction, either way).
 */
export function fliesCorridor(lane: AirCorridor, position: Vec3, trackRad: number): boolean {
  if (position.z < lane.floorM || position.z > lane.ceilingM) return false;
  if (Math.abs(corridorFrame(lane, position.x, position.y).acrossM) > lane.halfWidthM) return false;
  // The angle between the track and the lane's line, ignoring which way along it: [0, π).
  const off = (((trackRad - lane.axisRad) % Math.PI) + Math.PI) % Math.PI;
  return Math.min(off, Math.PI - off) <= CORRIDOR_HEADING_TOLERANCE_RAD;
}

/** The lane an aircraft flies, if any (see `fliesCorridor`). */
export function corridorFlown(
  lanes: readonly AirCorridor[],
  position: Vec3,
  trackRad: number,
): AirCorridor | null {
  return lanes.find((lane) => fliesCorridor(lane, position, trackRad)) ?? null;
}

/** The lane whose centreline passes closest to a ground point. */
export function nearestCorridor(
  lanes: readonly AirCorridor[],
  eastM: number,
  northM: number,
): AirCorridor | null {
  let best: AirCorridor | null = null;
  let bestM = Infinity;
  for (const lane of lanes) {
    const acrossM = Math.abs(corridorFrame(lane, eastM, northM).acrossM);
    if (acrossM < bestM) {
      best = lane;
      bestM = acrossM;
    }
  }
  return best;
}

/** Lanes are left this far from the battery: just outside the area, so the airliner leaves. */
export const CORRIDOR_EXIT_RANGE_M = 44_000;

/**
 * The route of a civil airliner placed at `start`: it joins the nearest lane at 45° (at once,
 * if it is already on the centreline) and flies it out of the area, toward the lane's farther
 * end, so it crosses as much of the area as it can.
 */
export function corridorRoute(start: Vec3, lanes: readonly AirCorridor[]): Vec3[] {
  const lane = nearestCorridor(lanes, start.x, start.y);
  if (!lane) return [];
  const { alongM, acrossM } = corridorFrame(lane, start.x, start.y);
  const direction = alongM <= 0 ? 1 : -1;
  const endAlongM = direction * corridorHalfLengthM(lane, CORRIDOR_EXIT_RANGE_M);
  const joinAlongM = alongM + direction * Math.abs(acrossM);
  const end = corridorPoint(lane, endAlongM);
  const joinsBeforeTheEnd = direction * (endAlongM - joinAlongM) > 0;
  return Math.abs(acrossM) > 500 && joinsBeforeTheEnd
    ? [corridorPoint(lane, joinAlongM), end]
    : [end];
}
