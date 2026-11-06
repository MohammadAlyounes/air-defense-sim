/** Public API of the simulation core. The app imports from here, never from deeper files. */
export { FixedStepClock, TICK_HZ, TICK_S } from './core/clock';
export { Rng, type RngState } from './core/rng';
export { bearing, groundRange, type Vec3 } from './core/vec';
export { antennaAzimuth, DEFAULT_SEARCH_RADAR, type SearchRadarConfig } from './radar';
export { DEFAULT_AUTO_TRAFFIC, type AutoTrafficConfig } from './scenario';
export { Simulation, type SimConfig } from './simulation';
export {
  TRAFFIC,
  TRAFFIC_IDS,
  type Affiliation,
  type AircraftType,
  type AltitudeReference,
  type RadarSize,
  type TrafficPerformance,
  type TrafficTypeId,
} from './traffic';
export type {
  Aircraft,
  Command,
  EntityId,
  PaintRecord,
  Plot,
  RadarView,
  RecordedCommand,
  SimEvent,
  Snapshot,
} from './types';
