import { corridorRoute, DEFAULT_CORRIDORS, type AirCorridor } from './airspace';
import { Rng } from './core/rng';
import { headingVector, vec3, type Vec3 } from './core/vec';
import { TRAFFIC, type AircraftType, type TrafficPerformance } from './traffic';

/**
 * How aircraft fly: through moving air (wind), along routes of waypoints, turning no tighter
 * than their bank angle or load factor allows. Textbook flight mechanics for a point mass in
 * level flight; every number is an illustrative round value (see SAFETY.md).
 */

export const GRAVITY_MPS2 = 9.81;
const TWO_PI = 2 * Math.PI;

// ── Wind ──────────────────────────────────────────────────────────────────────────────────

/** The wind over the area: the same direction everywhere, stronger higher up. */
export interface WindConfig {
  /** Wind speed 10 m above the ground, m/s. */
  speedMps: number;
  /** The direction it blows from, compass radians (0 = a north wind, blowing south). */
  fromRad: number;
}

/** No wind at all. */
export const CALM: WindConfig = { speedMps: 0, fromRad: 0 };

/** Height at which the wind speed is given, m. */
export const WIND_REFERENCE_HEIGHT_M = 10;
/** Exponent of the power law for wind speed with height (the classic one-seventh law). */
export const WIND_SHEAR_EXPONENT = 1 / 7;

/** Surface winds drawn for a run are between these speeds, m/s. */
export const WIND_SPEED_RANGE_MPS: readonly [number, number] = [2, 12];

/**
 * The wind for a run, drawn from its seed with a generator of its own: a seed always brings the
 * same wind, and drawing it leaves the run's main random sequence alone.
 */
export function windFromSeed(seed: number): WindConfig {
  const rng = new Rng((seed ^ 0x5bd1e995) >>> 0);
  const [min, max] = WIND_SPEED_RANGE_MPS;
  return { speedMps: rng.range(min, max), fromRad: rng.range(0, TWO_PI) };
}

/**
 * Wind speed at `aglM` above the ground: slowed by friction near the surface, it grows with
 * height as the power law `v(h) = v₁₀ · (h / 10 m)^(1/7)`. Below 1 m it is taken at 1 m.
 */
export function windSpeedAt(wind: WindConfig, aglM: number): number {
  const h = Math.max(1, aglM);
  return wind.speedMps * Math.pow(h / WIND_REFERENCE_HEIGHT_M, WIND_SHEAR_EXPONENT);
}

/** The air's velocity at `aglM` above the ground: where it blows to, m/s (horizontal). */
export function windVelocityAt(wind: WindConfig, aglM: number): Vec3 {
  const speed = windSpeedAt(wind, aglM);
  const to = headingVector(wind.fromRad + Math.PI);
  return vec3(to.x * speed, to.y * speed, 0);
}

/** What the wind triangle gives for an aircraft holding a ground track. */
export interface WindTriangle {
  /** Velocity over the ground, m/s (horizontal). */
  groundVelocity: Vec3;
  groundSpeedMps: number;
  /** Where the nose points, compass radians: turned into the wind to cancel the drift. */
  headingRad: number;
}

/**
 * The wind triangle: to fly along `trackRad` over the ground at `airspeedMps` through air
 * moving at `wind`, an aircraft turns its nose into the wind just enough to cancel the
 * crosswind. What is left of its airspeed, plus the wind along the track, is its ground speed:
 *
 *   ground speed = √(V² − w⊥²) + w∥
 *
 * A crosswind stronger than the airspeed cannot be cancelled; the aircraft then drifts.
 */
export function windTriangle(trackRad: number, airspeedMps: number, wind: Vec3): WindTriangle {
  const along = unitTrack(trackRad);
  // Unit vector to the right of the track.
  const right = vec3(along.y, -along.x, 0);
  const windCross = wind.x * right.x + wind.y * right.y;
  // The aircraft's own velocity through the air, split along and across the track.
  const airCross =
    Math.abs(windCross) < airspeedMps ? -windCross : -Math.sign(windCross) * airspeedMps;
  const airAlong = Math.sqrt(Math.max(0, airspeedMps * airspeedMps - airCross * airCross));
  const air = vec3(
    along.x * airAlong + right.x * airCross,
    along.y * airAlong + right.y * airCross,
    0,
  );
  const groundVelocity = vec3(air.x + wind.x, air.y + wind.y, 0);
  let headingRad = Math.atan2(air.x, air.y);
  if (headingRad < 0) headingRad += TWO_PI;
  return {
    groundVelocity,
    groundSpeedMps: Math.hypot(groundVelocity.x, groundVelocity.y),
    headingRad: airspeedMps > 0 ? headingRad : trackRad,
  };
}

/**
 * Unit vector along a compass track. Rounding leftovers (sin π ≈ 1.2e-16) are cleared, so an
 * aircraft flying due south stays exactly on its north-south line instead of drifting by
 * 1e-14 m per tick, which would move it across the radar beam's edge.
 */
function unitTrack(trackRad: number): Vec3 {
  const v = headingVector(trackRad);
  const clean = (c: number) => (Math.abs(c) < 1e-12 ? 0 : c);
  return vec3(clean(v.x), clean(v.y), 0);
}

// ── Turns ─────────────────────────────────────────────────────────────────────────────────

/** Load factor of a level, coordinated turn at `bankDeg` of bank: n = 1 / cos φ. */
export const loadFactorForBank = (bankDeg: number): number =>
  1 / Math.cos((bankDeg * Math.PI) / 180);

/**
 * Turn rate of a level turn at load factor `n` (lift over weight): the horizontal part of the
 * lift, `g · √(n² − 1)`, bends the path, so ω = g · √(n² − 1) / V, rad/s.
 */
export function turnRateRadS(speedMps: number, loadFactor: number): number {
  if (speedMps <= 0 || loadFactor <= 1) return 0;
  return (GRAVITY_MPS2 * Math.sqrt(loadFactor * loadFactor - 1)) / speedMps;
}

/** Radius of a level turn at load factor `n`: r = V² / (g · √(n² − 1)), m. */
export function turnRadiusM(speedMps: number, loadFactor: number): number {
  const rate = turnRateRadS(speedMps, loadFactor);
  return rate > 0 ? speedMps / rate : Number.POSITIVE_INFINITY;
}

/** The signed smallest turn from `fromRad` to `toRad`, in (−π, π]: positive is clockwise. */
export function angleDiff(toRad: number, fromRad: number): number {
  let d = (toRad - fromRad) % TWO_PI;
  if (d <= -Math.PI) d += TWO_PI;
  if (d > Math.PI) d -= TWO_PI;
  return d;
}

/** Compass bearing from `from` to `to` over the ground, in [0, 2π). */
export function bearingTo(from: Vec3, to: Vec3): number {
  const b = Math.atan2(to.x - from.x, to.y - from.y);
  return b < 0 ? b + TWO_PI : b;
}

/**
 * Is `point` inside the circle an aircraft at `position`, flying along `trackRad`, would fly
 * turning toward it at radius `radiusM`? Such a point cannot be reached by turning: the
 * aircraft would circle it for ever. It has to fly on until the point falls outside the circle.
 */
export function insideTurnCircle(
  position: Vec3,
  trackRad: number,
  point: Vec3,
  radiusM: number,
): boolean {
  if (!Number.isFinite(radiusM)) return false;
  const along = headingVector(trackRad);
  const right = vec3(along.y, -along.x, 0);
  const dx = point.x - position.x;
  const dy = point.y - position.y;
  const side = dx * right.x + dy * right.y >= 0 ? 1 : -1;
  const cx = position.x + right.x * radiusM * side;
  const cy = position.y + right.y * radiusM * side;
  return Math.hypot(point.x - cx, point.y - cy) < radiusM;
}

/** `fromRad` turned toward `toRad` by at most `maxStepRad`, in [0, 2π). */
export function turnToward(fromRad: number, toRad: number, maxStepRad: number): number {
  const d = angleDiff(toRad, fromRad);
  const next = fromRad + Math.max(-maxStepRad, Math.min(maxStepRad, d));
  return ((next % TWO_PI) + TWO_PI) % TWO_PI;
}

// ── Routes ────────────────────────────────────────────────────────────────────────────────

/** A cruise-missile-like target's dog-leg: the turn point is this far along the direct line... */
const DOG_LEG_ALONG = 0.5;
/** ...and this far to one side of it (as fractions of the direct distance). */
const DOG_LEG_ACROSS = 0.25;
/** A dog-leg needs room: only on routes at least this many turn radii long. */
const DOG_LEG_MIN_RADII = 3;

/** Routine turns use this load factor for each type (from its bank angle). */
export const routineLoadFactor = (performance: TrafficPerformance): number =>
  loadFactorForBank(performance.bankDeg);

/**
 * The ground waypoints an aircraft of `type` flies from `start` to `aim`. Most fly straight
 * at it; a cruise-missile-like target flies a dog-leg, off to one side and then back in, so
 * its first leg does not point at its target. `side` is +1 for a first leg to the right of
 * the direct line, −1 for the left. After the last waypoint it flies straight on.
 */
export function planRoute(type: AircraftType, start: Vec3, aim: Vec3, side: 1 | -1): Vec3[] {
  const target = vec3(aim.x, aim.y, 0);
  const dx = aim.x - start.x;
  const dy = aim.y - start.y;
  const length = Math.hypot(dx, dy);
  const performance = TRAFFIC[type];
  if (!performance.dogLeg || length === 0) return [target];
  const radius = turnRadiusM(performance.speedMps, routineLoadFactor(performance));
  if (length < DOG_LEG_MIN_RADII * radius) return [target];
  // Right of the direct line is (dy, −dx) / length.
  const turnPoint = vec3(
    start.x + dx * DOG_LEG_ALONG + side * DOG_LEG_ACROSS * dy,
    start.y + dy * DOG_LEG_ALONG - side * DOG_LEG_ACROSS * dx,
    0,
  );
  return [turnPoint, target];
}

/**
 * Side of the dog-leg for traffic placed by hand: fixed by where it is dropped (alternating
 * every 45° of bearing round the battery), so the placement readout can draw the same route
 * the simulation will fly.
 */
export function dropSide(start: Vec3): 1 | -1 {
  let b = Math.atan2(start.x, start.y);
  if (b < 0) b += TWO_PI;
  return Math.floor(b / (Math.PI / 4)) % 2 === 0 ? 1 : -1;
}

/**
 * The route of traffic placed by hand at `start`. With a heading, it aims at the point of its
 * heading line closest to the battery (the battery itself, for a drop aimed at it). Without
 * one, an airliner joins the nearest civil corridor and flies it out of the area (see
 * `corridorRoute`), and other traffic heads for the battery.
 */
export function dropRoute(
  type: AircraftType,
  start: Vec3,
  headingRad?: number,
  corridors: readonly AirCorridor[] = DEFAULT_CORRIDORS,
): Vec3[] {
  if (headingRad === undefined && type === 'airliner' && corridors.length > 0) {
    return corridorRoute(start, corridors);
  }
  const dir = headingVector(headingRad ?? bearingTo(start, vec3(0, 0, 0)));
  const along = Math.max(0, -(start.x * dir.x + start.y * dir.y));
  const aim = vec3(start.x + dir.x * along, start.y + dir.y * along, 0);
  if (along === 0) return [];
  return planRoute(type, start, aim, dropSide(start));
}

/** Total ground length of a route that starts at `start`, m. */
export function routeLengthM(start: Vec3, route: readonly Vec3[]): number {
  let total = 0;
  let from = start;
  for (const point of route) {
    total += Math.hypot(point.x - from.x, point.y - from.y);
    from = point;
  }
  return total;
}

/**
 * The point `distanceM` along a route that starts at `start`, the ground track there, and the
 * waypoints still ahead. Past the end it stays on the last leg's line.
 */
export function alongRoute(
  start: Vec3,
  route: readonly Vec3[],
  distanceM: number,
): { position: Vec3; trackRad: number; remaining: Vec3[] } {
  let from = start;
  let left = distanceM;
  for (let i = 0; i < route.length; i++) {
    const to = route[i] as Vec3;
    const leg = Math.hypot(to.x - from.x, to.y - from.y);
    const trackRad = bearingTo(from, to);
    if (left <= leg || i === route.length - 1) {
      const f = leg > 0 ? left / leg : 0;
      return {
        position: vec3(from.x + (to.x - from.x) * f, from.y + (to.y - from.y) * f, start.z),
        trackRad,
        remaining: f < 1 ? route.slice(i) : [],
      };
    }
    left -= leg;
    from = to;
  }
  return { position: start, trackRad: 0, remaining: [] };
}

// ── Evasive turns ─────────────────────────────────────────────────────────────────────────

/** A fast jet breaks away once an interceptor guided at it is this close, m. */
export const BREAK_RANGE_M = 6_000;
/** It holds the break this long before turning back onto its route, s. */
export const BREAK_HOLD_S = 6;

/**
 * The break turn's new track: square to the line of sight to the interceptor (it "beams" it),
 * on the side that needs the smaller turn. A target flying across the interceptor's path makes
 * it turn hardest, and flies across the search radar's beam too.
 */
export function breakTrack(trackRad: number, aircraft: Vec3, interceptor: Vec3): number {
  const los = bearingTo(aircraft, interceptor);
  const right = (los + Math.PI / 2) % TWO_PI;
  const left = (los + 1.5 * Math.PI) % TWO_PI;
  return Math.abs(angleDiff(right, trackRad)) <= Math.abs(angleDiff(left, trackRad)) ? right : left;
}
