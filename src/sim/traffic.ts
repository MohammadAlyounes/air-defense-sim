/**
 * Flight performance of every kind of air traffic in the simulator.
 *
 * All numbers are illustrative round values chosen for teaching. They describe generic object
 * classes, not any real system (see SAFETY.md).
 */

export type TrafficTypeId = 'drone' | 'swarm' | 'cruise' | 'jet' | 'friendly' | 'airliner';
/** A swarm is a group of drones, so a single aircraft is never of type 'swarm'. */
export type AircraftType = Exclude<TrafficTypeId, 'swarm'>;
export type Affiliation = 'hostile' | 'friend' | 'neutral';
/** How big the object looks to radar (its radar cross section, in broad classes). */
export type RadarSize = 'tiny' | 'small' | 'medium' | 'large';

/**
 * Radar cross section assumed for each size class, m²: how much radar energy the object sends
 * back, compared with a 1 m² reference. Illustrative round numbers, one per decade or so.
 */
export const RADAR_CROSS_SECTION_M2: Readonly<Record<RadarSize, number>> = {
  tiny: 0.01,
  small: 0.1,
  medium: 2,
  large: 40,
};
/** AGL = above ground level, MSL = above mean sea level. */
export type AltitudeReference = 'AGL' | 'MSL';

export interface TrafficPerformance {
  id: TrafficTypeId;
  affiliation: Affiliation;
  /** Typical cruise speed, m/s. */
  speedMps: number;
  /** Typical flight altitude, m. */
  altitudeM: number;
  altitudeRef: AltitudeReference;
  radarSize: RadarSize;
  /** Number of aircraft one spawn creates (a swarm is several drones). */
  count: number;
}

export const TRAFFIC: Readonly<Record<TrafficTypeId, TrafficPerformance>> = {
  drone: {
    id: 'drone',
    affiliation: 'hostile',
    speedMps: 40,
    altitudeM: 300,
    altitudeRef: 'AGL',
    radarSize: 'tiny',
    count: 1,
  },
  swarm: {
    id: 'swarm',
    affiliation: 'hostile',
    speedMps: 40,
    altitudeM: 300,
    altitudeRef: 'AGL',
    radarSize: 'tiny',
    count: 6,
  },
  cruise: {
    id: 'cruise',
    affiliation: 'hostile',
    speedMps: 240,
    altitudeM: 50,
    altitudeRef: 'AGL',
    radarSize: 'small',
    count: 1,
  },
  jet: {
    id: 'jet',
    affiliation: 'hostile',
    speedMps: 340,
    altitudeM: 6000,
    altitudeRef: 'MSL',
    radarSize: 'medium',
    count: 1,
  },
  friendly: {
    id: 'friendly',
    affiliation: 'friend',
    speedMps: 200,
    altitudeM: 4000,
    altitudeRef: 'MSL',
    radarSize: 'medium',
    count: 1,
  },
  airliner: {
    id: 'airliner',
    affiliation: 'neutral',
    speedMps: 230,
    altitudeM: 11000,
    altitudeRef: 'MSL',
    radarSize: 'large',
    count: 1,
  },
};

export const TRAFFIC_IDS: readonly TrafficTypeId[] = [
  'drone',
  'swarm',
  'cruise',
  'jet',
  'friendly',
  'airliner',
];
