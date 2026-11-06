/**
 * Threats and other air traffic the user can drop onto the map.
 *
 * Flight performance (speed, altitude, radar size) comes from the simulation core, so the
 * palette and the physics can never disagree. This file adds the words shown in the UI.
 */
import {
  TRAFFIC,
  TRAFFIC_IDS,
  type Affiliation,
  type AltitudeReference,
  type RadarSize,
  type TrafficPerformance,
  type TrafficTypeId,
} from '../../sim';

export type { Affiliation, AltitudeReference, RadarSize };

export interface TrafficType extends TrafficPerformance {
  name: string;
  /** For tight spaces such as the 3D labels. */
  shortName: string;
  /** One line: why it is hard to stop, or why it must not be engaged. */
  insight: string;
  behavior: string;
}

const TEXT: Readonly<
  Record<TrafficTypeId, Pick<TrafficType, 'name' | 'shortName' | 'insight' | 'behavior'>>
> = {
  drone: {
    name: 'Small drone',
    shortName: 'Drone',
    insight: 'Tiny radar size; it blends into ground clutter.',
    behavior: 'Slow and low, pushed around by the wind.',
  },
  swarm: {
    name: 'Drone swarm',
    shortName: 'Swarm',
    insight: 'Many cheap targets at once saturate the defense.',
    behavior: 'A spread-out group arriving in staggered waves.',
  },
  cruise: {
    name: 'Cruise-missile-like',
    shortName: 'Cruise-like',
    insight: 'Hugs the terrain to hide below the radar horizon.',
    behavior: 'Fast, terrain-following, dog-leg route.',
  },
  jet: {
    name: 'Fast jet',
    shortName: 'Fast jet',
    insight: 'Fast and agile; it can out-turn a tired interceptor.',
    behavior: 'High-speed run with an evasive turn when engaged.',
  },
  friendly: {
    name: 'Friendly aircraft',
    shortName: 'Friendly',
    insight: 'Must not be engaged: it answers identification checks.',
    behavior: 'Patrols the area and returns to base.',
  },
  airliner: {
    name: 'Civil airliner',
    shortName: 'Airliner',
    insight: 'Must not be engaged: it flies the civil air corridor.',
    behavior: 'Steady cruise along the corridor.',
  },
};

export const TRAFFIC_CATALOG: readonly TrafficType[] = TRAFFIC_IDS.map((id) => ({
  ...TRAFFIC[id],
  ...TEXT[id],
}));

/** Look up a type's words and performance by id. */
export const TRAFFIC_BY_ID = Object.fromEntries(
  TRAFFIC_CATALOG.map((type) => [type.id, type]),
) as Readonly<Record<TrafficTypeId, TrafficType>>;

/** Upper ends of the palette stat bars. */
export const STAT_SCALE = { maxSpeedMps: 400, maxAltitudeM: 12_000 } as const;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Speed bar: linear, so "twice as fast" looks twice as long. */
export function speedBar(speedMps: number): number {
  return clamp01(speedMps / STAT_SCALE.maxSpeedMps);
}

/**
 * Altitude bar: square-root scale, so a 50 m terrain-hugger and a 300 m drone
 * are both visible as short bars next to an 11 km airliner.
 */
export function altitudeBar(altitudeM: number): number {
  return clamp01(Math.sqrt(Math.max(0, altitudeM) / STAT_SCALE.maxAltitudeM));
}

export const RADAR_SIZE_BAR: Readonly<Record<RadarSize, number>> = {
  tiny: 0.08,
  small: 0.25,
  medium: 0.55,
  large: 0.95,
};
