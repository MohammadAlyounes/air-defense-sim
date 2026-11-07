import type { Identity } from './c2';
import type { Vec3 } from './core/vec';
import type {
  Affiliation,
  AircraftType,
  AltitudeReference,
  RadarSize,
  TrafficTypeId,
} from './traffic';

export type EntityId = number;

/** Where and when the radar last painted an aircraft. */
export interface PaintRecord {
  tick: number;
  bearingRad: number;
  rangeM: number;
}

/** One aircraft or drone flying through the area: the ground truth. */
export interface Aircraft {
  id: EntityId;
  type: AircraftType;
  affiliation: Affiliation;
  radarSize: RadarSize;
  /** Metres, East-North-Up, origin at the battery. */
  position: Vec3;
  /** Metres per second. */
  velocity: Vec3;
  /** AGL: it follows the terrain at a set height above the ground; MSL: a set altitude. */
  altitudeRef: AltitudeReference;
  /** The height it flies at: above the ground (AGL) or above the datum (MSL), m. */
  cruiseAltitudeM: number;
  spawnTick: number;
  /** The radar's last paint of it, if any. */
  lastPaint: PaintRecord | null;
  /** Where it has been: positions sampled every 0.5 s, oldest first, last 30 s. */
  trail: readonly Vec3[];
  /** A hostile that came within the leak radius of the battery: it got through. */
  leaked: boolean;
}

/** One radar detection: where the beam saw an echo, and when. */
export interface Plot {
  tick: number;
  timeS: number;
  /** Measured position: the true one plus measurement noise. */
  position: Vec3;
  /** Measured bearing and ground range. */
  bearingRad: number;
  rangeM: number;
  /** Echo strength class: bigger objects return stronger echoes. */
  radarSize: RadarSize;
  /**
   * Ground-truth link for tests and the truth overlay: the aircraft that made the echo, or null
   * for a false alarm (noise that crossed the threshold). The radar picture never shows it.
   */
  truthId: EntityId | null;
}

/**
 * The battery's picture of one aircraft, built from radar plots: perception, not truth.
 * A track starts tentative at the first echo and is confirmed by the second.
 */
export interface Track {
  /** Track number, shown as T1, T2, … */
  id: EntityId;
  /**
   * The aircraft whose echoes feed this track, or null for a track started by a false alarm.
   * Until Step 5 each echo is linked to its track by it (perfect association); Step 5 replaces
   * that with gating and nearest-neighbour association.
   */
  truthId: EntityId | null;
  createdTick: number;
  /** Ground range at the first echo, m. */
  detectedRangeM: number;
  paints: number;
  lastPaintTick: number;
  /** Position of the last echo. */
  position: Vec3;
  /** Estimated from the last two echoes; null until the second one. */
  velocity: Vec3 | null;
  confirmedTick: number | null;
  identity: Identity;
  /** Set while the track's course passes close to the battery. */
  threat: Threat | null;
  /** The engagement in progress: interceptor in flight, or waiting for the radar to assess. */
  engagementId: EntityId | null;
  /** Interceptors launched at this track so far. */
  interceptorsFired: number;
}

export interface Threat {
  /** How close the course passes the battery, m. */
  closestApproachM: number;
  /** Time until it gets there, s. */
  timeToClosestS: number;
}

/** An interceptor in flight: a point mass guided by proportional navigation. */
export interface Interceptor {
  /** Interceptor number, shown as I1, I2, … */
  id: EntityId;
  engagementId: EntityId;
  trackId: EntityId;
  /** The aircraft the tracking radar guides it to. */
  targetId: EntityId;
  launchTick: number;
  position: Vec3;
  velocity: Vec3;
  /**
   * False while terrain or the horizon hides the target from the radar: the interceptor then
   * steers toward where the track says the target should be.
   */
  targetInView: boolean;
  /** Recent positions, every 0.1 s, oldest first, last 6 s. */
  trail: readonly Vec3[];
}

export type MissReason = 'passed' | 'outOfTime' | 'ground' | 'targetGone';

/**
 * The command node's record of one shot: assigned to a launch slot, then flying, then a hit
 * or a miss, kept until the radar has assessed the result.
 */
export interface Engagement {
  id: EntityId;
  trackId: EntityId;
  targetId: EntityId;
  /** What the target really is: revealed in the result card, never used by the defense. */
  targetType: AircraftType;
  assignedTick: number;
  /** Planned launch tick while assigned; the actual one once launched. */
  launchTick: number;
  interceptorId: EntityId | null;
  state: 'assigned' | 'flying' | 'hit' | 'missed';
  /** Predicted intercept point and flight time: planned at assignment, updated at launch. */
  predictedPoint: Vec3;
  predictedTimeS: number;
  endTick: number | null;
  /** Closest approach to the target, m (once the interceptor has passed it). */
  missDistanceM: number | null;
  missReason: MissReason | null;
}

export interface LauncherState {
  ready: number;
  capacity: number;
  nextLaunchTick: number;
  /** When the next round will be ready, while reloading. */
  nextReloadTick: number | null;
}

/** Brief visual markers for the views: launches, intercepts, misses and leaks. */
export interface Effect {
  kind: 'launch' | 'intercept' | 'miss' | 'leak';
  tick: number;
  position: Vec3;
}

export interface DefenseStats {
  /** Hostile tracks the radar confirmed destroyed. */
  threatsDown: number;
  /** Hostiles that reached the battery. */
  threatsLeaked: number;
  interceptorsFired: number;
  hits: number;
  misses: number;
}

interface EventBase {
  tick: number;
  timeS: number;
  /** The aircraft the event is about (ground truth), so the UI can select it; null for a false alarm. */
  id: EntityId | null;
}

interface TrackEventBase extends EventBase {
  trackId: EntityId;
}

/** Things that happened during a tick. Structured data only; the UI turns them into words. */
export type SimEvent =
  | (EventBase & { kind: 'trafficEntered'; type: AircraftType; bearingRad: number; rangeM: number })
  | (EventBase & { kind: 'trafficLeft'; type: AircraftType })
  | (EventBase & { kind: 'threatLeaked'; type: AircraftType })
  | (TrackEventBase & { kind: 'contactNew'; bearingRad: number; rangeM: number })
  | (TrackEventBase & { kind: 'contactLost'; bearingRad: number; rangeM: number })
  /** A tentative track whose second echo never came: most often a false alarm. */
  | (TrackEventBase & { kind: 'contactDropped'; bearingRad: number; rangeM: number })
  | (TrackEventBase & { kind: 'trackConfirmed'; speedMps: number; altitudeM: number })
  | (TrackEventBase & { kind: 'identified'; identity: Exclude<Identity, 'pending'> })
  | (TrackEventBase & { kind: 'threatEvaluated'; closestApproachM: number; timeToClosestS: number })
  | (TrackEventBase & {
      kind: 'engagementAssigned';
      /** Time until its launch slot, s. */
      launchInS: number;
      predictedTimeS: number;
      predictedRangeM: number;
    })
  | (TrackEventBase & { kind: 'engagementCancelled' })
  | (TrackEventBase & {
      kind: 'interceptorLaunched';
      interceptorId: EntityId;
      predictedTimeS: number;
      predictedRangeM: number;
    })
  | (TrackEventBase & {
      kind: 'interceptResult';
      interceptorId: EntityId;
      hit: boolean;
      /** Closest approach, m; null if the target was already gone. */
      missDistanceM: number | null;
      reason: MissReason | null;
    })
  | (TrackEventBase & {
      kind: 'killAssessed';
      type: AircraftType;
      detectedRangeM: number;
      /** From the first echo to the intercept, s. */
      detectionToKillS: number;
      interceptorsFired: number;
    })
  | (TrackEventBase & { kind: 'targetSurvived' });

/** The only way to change a running simulation from outside. Every command is logged. */
export type Command =
  | {
      kind: 'spawnTraffic';
      type: TrafficTypeId;
      eastM: number;
      northM: number;
      /** Compass heading: 0 = north, clockwise. */
      headingRad: number;
      /** Above the ground for terrain-following types (drones, cruise), above the datum otherwise. */
      altitudeM?: number;
    }
  | { kind: 'removeAircraft'; id: EntityId };

export interface RecordedCommand {
  tick: number;
  command: Command;
}

export interface RadarView {
  /** Antenna direction: 0 = north, clockwise. */
  azimuthRad: number;
  periodS: number;
  rangeM: number;
  /** Range at which a 1 m² target is detected on half of the scans, m. */
  referenceRangeM: number;
  /** Antenna height above the ground, m. */
  antennaHeightM: number;
}

/** A read-only picture of the simulation at one tick, for rendering. */
export interface Snapshot {
  tick: number;
  timeS: number;
  seed: number;
  radar: RadarView;
  aircraft: readonly Aircraft[];
  plots: readonly Plot[];
  /** Number of tracks the radar holds (tentative and confirmed). */
  contactsHeld: number;
  tracks: readonly Track[];
  interceptors: readonly Interceptor[];
  engagements: readonly Engagement[];
  launcher: LauncherState;
  effects: readonly Effect[];
  stats: DefenseStats;
}
