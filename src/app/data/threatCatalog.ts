/**
 * Threats and other air traffic the user can drop onto the map.
 *
 * All numbers are illustrative, round values chosen for teaching. They describe
 * generic object classes, not any real system (see SAFETY.md).
 */

export type Affiliation = 'hostile' | 'friend' | 'neutral';
export type RadarSize = 'tiny' | 'small' | 'medium' | 'large';
export type AltitudeReference = 'AGL' | 'MSL';

export interface TrafficType {
  id: 'drone' | 'swarm' | 'cruise' | 'jet' | 'friendly' | 'airliner';
  name: string;
  affiliation: Affiliation;
  /** Typical cruise speed, metres per second. */
  speedMps: number;
  /** Typical flight altitude, metres. */
  altitudeM: number;
  /** AGL = above ground level, MSL = above mean sea level. */
  altitudeRef: AltitudeReference;
  radarSize: RadarSize;
  /** Objects spawned by one drop (a swarm is several drones). */
  count: number;
  /** One line: why it is hard to stop, or why it must not be engaged. */
  insight: string;
  behavior: string;
}

export const TRAFFIC_CATALOG: readonly TrafficType[] = [
  {
    id: 'drone',
    name: 'Small drone',
    affiliation: 'hostile',
    speedMps: 40,
    altitudeM: 300,
    altitudeRef: 'AGL',
    radarSize: 'tiny',
    count: 1,
    insight: 'Tiny radar size; it blends into ground clutter.',
    behavior: 'Slow and low, pushed around by the wind.',
  },
  {
    id: 'swarm',
    name: 'Drone swarm',
    affiliation: 'hostile',
    speedMps: 40,
    altitudeM: 300,
    altitudeRef: 'AGL',
    radarSize: 'tiny',
    count: 6,
    insight: 'Many cheap targets at once saturate the defense.',
    behavior: 'A spread-out group arriving in staggered waves.',
  },
  {
    id: 'cruise',
    name: 'Cruise-missile-like',
    affiliation: 'hostile',
    speedMps: 240,
    altitudeM: 50,
    altitudeRef: 'AGL',
    radarSize: 'small',
    count: 1,
    insight: 'Hugs the terrain to hide below the radar horizon.',
    behavior: 'Fast, terrain-following, dog-leg route.',
  },
  {
    id: 'jet',
    name: 'Fast jet',
    affiliation: 'hostile',
    speedMps: 340,
    altitudeM: 6000,
    altitudeRef: 'MSL',
    radarSize: 'medium',
    count: 1,
    insight: 'Fast and agile; it can out-turn a tired interceptor.',
    behavior: 'High-speed run with an evasive turn when engaged.',
  },
  {
    id: 'friendly',
    name: 'Friendly aircraft',
    affiliation: 'friend',
    speedMps: 200,
    altitudeM: 4000,
    altitudeRef: 'MSL',
    radarSize: 'medium',
    count: 1,
    insight: 'Must not be engaged: it answers identification checks.',
    behavior: 'Patrols the area and returns to base.',
  },
  {
    id: 'airliner',
    name: 'Civil airliner',
    affiliation: 'neutral',
    speedMps: 230,
    altitudeM: 11000,
    altitudeRef: 'MSL',
    radarSize: 'large',
    count: 1,
    insight: 'Must not be engaged: it flies the civil air corridor.',
    behavior: 'Steady cruise along the corridor.',
  },
];

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
