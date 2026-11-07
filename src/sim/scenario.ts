import { TICK_S } from './core/clock';
import type { Rng } from './core/rng';
import { vec3, type Vec3 } from './core/vec';
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
  /** Hostile traffic heads for the battery itself: it aims this close to it. */
  hostileAimRadiusM: number;
  mix: readonly { value: AircraftType; weight: number }[];
}

export const DEFAULT_AUTO_TRAFFIC: AutoTrafficConfig = {
  initialCount: 4,
  maxAircraft: 7,
  arrivalEveryS: [14, 28],
  entryRangeM: 38_000,
  aimRadiusM: 14_000,
  hostileAimRadiusM: 1_500,
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
  velocity: Vec3;
}

const TWO_PI = 2 * Math.PI;

/**
 * Picks a type, an entry point on the edge of the area and a straight course across it.
 * Aircraft that are already flying when the run starts are placed part-way along their course.
 */
export function planFlight(rng: Rng, config: AutoTrafficConfig, underway: boolean): PlannedFlight {
  const type = rng.weighted(config.mix);
  const performance = TRAFFIC[type];

  const entryBearing = rng.range(0, TWO_PI);
  const entryX = config.entryRangeM * Math.sin(entryBearing);
  const entryY = config.entryRangeM * Math.cos(entryBearing);

  // sqrt keeps aim points evenly spread over the disc instead of bunched in the middle.
  const radius =
    performance.affiliation === 'hostile' ? config.hostileAimRadiusM : config.aimRadiusM;
  const aimRange = radius * Math.sqrt(rng.next());
  const aimBearing = rng.range(0, TWO_PI);
  const dx = aimRange * Math.sin(aimBearing) - entryX;
  const dy = aimRange * Math.cos(aimBearing) - entryY;
  const length = Math.hypot(dx, dy);

  const progress = underway ? rng.range(0.15, 0.65) : 0;
  return {
    type,
    position: vec3(entryX + dx * progress, entryY + dy * progress, performance.altitudeM),
    velocity: vec3((dx / length) * performance.speedMps, (dy / length) * performance.speedMps, 0),
  };
}

/** Tick at which the next aircraft should arrive. */
export function nextArrivalTick(rng: Rng, config: AutoTrafficConfig, fromTick: number): number {
  const [minS, maxS] = config.arrivalEveryS;
  return fromTick + Math.max(1, Math.round(rng.range(minS, maxS) / TICK_S));
}
