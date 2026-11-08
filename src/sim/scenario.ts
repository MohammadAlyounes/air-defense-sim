import { TICK_S } from './core/clock';
import type { Rng } from './core/rng';
import { DEFAULT_ASSETS, type DefendedAsset } from './assets';
import { vec3, type Vec3 } from './core/vec';
import { alongRoute, planRoute, routeLengthM } from './flight';
import { TRAFFIC, type AircraftType } from './traffic';

/** Scenario traffic that arrives on its own, so the sky is never empty. */
export interface AutoTrafficConfig {
  /** Aircraft already flying when the simulation starts. */
  initialCount: number;
  maxAircraft: number;
  /** A new aircraft arrives every `[min, max]` seconds while there is room. */
  arrivalEveryS: readonly [number, number];
  /** New arrivals appear this far from the battery, metres. */
  entryRangeM: number;
  /** Each aircraft flies straight toward a random point this close to the battery. */
  aimRadiusM: number;
  /** Hostile traffic heads for a defended asset (picked at random): it aims this close to it. */
  hostileAimRadiusM: number;
  mix: readonly { value: AircraftType; weight: number }[];
}

export const DEFAULT_AUTO_TRAFFIC: AutoTrafficConfig = {
  initialCount: 4,
  maxAircraft: 7,
  arrivalEveryS: [14, 28],
  entryRangeM: 38_000,
  aimRadiusM: 14_000,
  hostileAimRadiusM: 800,
  mix: [
    { value: 'drone', weight: 3 },
    { value: 'cruise', weight: 2 },
    { value: 'jet', weight: 2 },
    { value: 'airliner', weight: 1.5 },
    { value: 'friendly', weight: 1.5 },
  ],
};

export interface PlannedFlight {
  type: AircraftType;
  position: Vec3;
  /** Ground track at `position`, compass radians. */
  trackRad: number;
  /** Waypoints still ahead (see `planRoute`). */
  route: Vec3[];
}

const TWO_PI = 2 * Math.PI;

/**
 * Picks a type, an entry point on the edge of the area and a route across it: hostiles head for
 * a defended asset, other traffic for a point near the battery. Most fly straight; a
 * cruise-missile-like target flies a dog-leg, to a side chosen by `routeRng` (a generator of
 * its own, so drawing a side leaves the main random sequence alone). Aircraft that are already
 * flying when the run starts are placed part-way along their route.
 */
export function planFlight(
  rng: Rng,
  config: AutoTrafficConfig,
  underway: boolean,
  assets: readonly DefendedAsset[] = DEFAULT_ASSETS,
  routeRng: Rng = rng,
): PlannedFlight {
  const type = rng.weighted(config.mix);
  const performance = TRAFFIC[type];

  const entryBearing = rng.range(0, TWO_PI);
  const entryX = config.entryRangeM * Math.sin(entryBearing);
  const entryY = config.entryRangeM * Math.cos(entryBearing);

  const hostile = performance.affiliation === 'hostile';
  const centre = hostile
    ? (assets[rng.int(0, assets.length - 1)]?.position ?? vec3(0, 0, 0))
    : vec3(0, 0, 0);
  // sqrt keeps aim points evenly spread over the disc instead of bunched in the middle.
  const radius = hostile ? config.hostileAimRadiusM : config.aimRadiusM;
  const aimRange = radius * Math.sqrt(rng.next());
  const aimBearing = rng.range(0, TWO_PI);
  const aim = vec3(
    centre.x + aimRange * Math.sin(aimBearing),
    centre.y + aimRange * Math.cos(aimBearing),
    0,
  );

  const progress = underway ? rng.range(0.15, 0.65) : 0;
  const entry = vec3(entryX, entryY, performance.altitudeM);
  const side = performance.dogLeg ? (routeRng.next() < 0.5 ? 1 : -1) : 1;
  const route = planRoute(type, entry, aim, side);
  const at = alongRoute(entry, route, progress * routeLengthM(entry, route));
  return { type, position: at.position, trackRad: at.trackRad, route: at.remaining };
}

/** Tick at which the next aircraft should arrive. */
export function nextArrivalTick(rng: Rng, config: AutoTrafficConfig, fromTick: number): number {
  const [minS, maxS] = config.arrivalEveryS;
  return fromTick + Math.max(1, Math.round(rng.range(minS, maxS) / TICK_S));
}
