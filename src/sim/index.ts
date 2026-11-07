/** Public API of the simulation core. The app imports from here, never from deeper files. */
export {
  closestApproachToOrigin,
  DEFAULT_DEFENSE,
  LAUNCHER_POSITION,
  planIntercept,
  predictIntercept,
  type DefenseConfig,
  type Identity,
  type Intercept,
} from './c2';
export { FixedStepClock, TICK_HZ, TICK_S } from './core/clock';
export { Rng, type RngState } from './core/rng';
export { bearing, groundRange, type Vec3 } from './core/vec';
export { DEFAULT_INTERCEPTOR, reachM, type InterceptorConfig } from './interceptor';
export {
  antennaAzimuth,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  type SearchRadarConfig,
} from './radar';
export { DEFAULT_AUTO_TRAFFIC, type AutoTrafficConfig } from './scenario';
export { Simulation, type SimConfig } from './simulation';
export { trackPositionAt } from './tracker';
export {
  RADAR_CROSS_SECTION_M2,
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
  DefenseStats,
  Effect,
  Engagement,
  EntityId,
  Interceptor,
  LauncherState,
  MissReason,
  PaintRecord,
  Plot,
  RadarView,
  RecordedCommand,
  SimEvent,
  Snapshot,
  Threat,
  Track,
} from './types';
