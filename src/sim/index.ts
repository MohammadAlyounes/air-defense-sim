/** Public API of the simulation core. The app imports from here, never from deeper files. */
export {
  CORRIDOR_HEADING_TOLERANCE_RAD,
  corridorFlown,
  corridorFrame,
  corridorHalfLengthM,
  corridorPoint,
  corridorRoute,
  DEFAULT_CORRIDORS,
  fliesCorridor,
  nearestCorridor,
  type AirCorridor,
} from './airspace';
export { DEFAULT_ASSETS, nearestAsset, type DefendedAsset } from './assets';
export {
  assumedCivil,
  closestApproachTo,
  closestApproachToOrigin,
  DEFAULT_DEFENSE,
  DEFAULT_RULES,
  engageable,
  envelopeRangeM,
  evaluateThreat,
  identityAfterSilence,
  killProbability,
  LAUNCHER_POSITION,
  mayThreaten,
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
  STANDARD_ATMOSPHERE,
  standardAtmosphere,
  type AirState,
  type Atmosphere,
} from './atmosphere';
export {
  AIRLINER_FROM_M,
  AIRLINER_FROM_MPS,
  FAST_FROM_MPS,
  flightProfile,
  LOW_BELOW_M,
  LOW_FAST_FROM_MPS,
  looksLikeThreat,
  SLOW_BELOW_MPS,
  THREAT_PROFILES,
  type FlightProfile,
} from './classify';
export { FixedStepClock, TICK_HZ, TICK_S } from './core/clock';
export {
  angleDiff,
  bearingTo,
  BREAK_HOLD_S,
  BREAK_RANGE_M,
  CALM,
  dropRoute,
  dropSide,
  GRAVITY_MPS2,
  loadFactorForBank,
  routeLengthM,
  routineLoadFactor,
  turnRadiusM,
  turnRateRadS,
  windFromSeed,
  windSpeedAt,
  windTriangle,
  windVelocityAt,
  WIND_SPEED_RANGE_MPS,
  type WindConfig,
  type WindTriangle,
} from './flight';
export { Rng, type RngState } from './core/rng';
export { bearing, distance, groundRange, vec3, type Vec3 } from './core/vec';
export { DEFAULT_INTERCEPTOR, reachM, speedAfterMps, type InterceptorConfig } from './interceptor';
export {
  coverageAt,
  coverageMap,
  curvatureDropM,
  EFFECTIVE_EARTH_RADIUS_M,
  groundLit,
  inClutter,
  lineOfSight,
  radarHorizonM,
  type CoverageMap,
  type Visibility,
} from './propagation';
export {
  antennaAzimuth,
  closingSpeedMps,
  DEFAULT_SEARCH_RADAR,
  detectionProbability,
  detectionRangeM,
  dopplerShiftHz,
  falseAlarmsPerTurn,
  IDEAL_SEARCH_RADAR,
  inDopplerNotch,
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
