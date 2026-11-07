/** Public API of the simulation core. The app imports from here, never from deeper files. */
export { DEFAULT_ASSETS, nearestAsset, type DefendedAsset } from './assets';
export {
  closestApproachTo,
  closestApproachToOrigin,
  DEFAULT_DEFENSE,
  DEFAULT_RULES,
  engageable,
  envelopeRangeM,
  evaluateThreat,
  killProbability,
  LAUNCHER_POSITION,
  planIntercept,
  predictIntercept,
  type DefenseConfig,
  type Identity,
  type Intercept,
  type OperatorMode,
  type Rules,
  type WeaponsControl,
} from './c2';
export {
  EXPONENTIAL_ATMOSPHERE,
  SCALE_HEIGHT_M,
  SEA_LEVEL_DENSITY_KGM3,
  type Atmosphere,
} from './atmosphere';
export { FixedStepClock, TICK_HZ, TICK_S } from './core/clock';
export { Rng, type RngState } from './core/rng';
export { bearing, distance, groundRange, vec3, type Vec3 } from './core/vec';
export { DEFAULT_INTERCEPTOR, reachM, speedAfterMps, type InterceptorConfig } from './interceptor';
export {
  coverageAt,
  coverageMap,
  curvatureDropM,
  EFFECTIVE_EARTH_RADIUS_M,
  lineOfSight,
  radarHorizonM,
  type CoverageMap,
  type Visibility,
} from './propagation';
export {
  antennaAzimuth,
  DEFAULT_SEARCH_RADAR,
  detectionProbability,
  detectionRangeM,
  falseAlarmsPerTurn,
  IDEAL_SEARCH_RADAR,
  lookProbability,
  signalToNoise,
  type DetectionModel,
  type SearchRadarConfig,
} from './radar';
export { DEFAULT_AUTO_TRAFFIC, type AutoTrafficConfig } from './scenario';
export { Simulation, type SimConfig } from './simulation';
export {
  createTerrain,
  DEFAULT_TERRAIN,
  flatTerrain,
  type Terrain,
  type TerrainConfig,
} from './terrain';
export {
  DEFAULT_TRACKER,
  estimateAt,
  trackEllipseAt,
  trackPositionAt,
  type TrackerConfig,
} from './tracker';
export { horizontalEllipse, type KalmanState } from './kalman';
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
