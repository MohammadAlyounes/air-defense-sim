import type { Vec3 } from './core/vec';
import type { Affiliation, AircraftType, RadarSize, TrafficTypeId } from './traffic';

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
  spawnTick: number;
  /** True while the radar keeps painting it (dropped after two antenna turns without a paint). */
  contactHeld: boolean;
  lastPaint: PaintRecord | null;
}

/** One radar detection: where the beam saw an echo, and when. */
export interface Plot {
  tick: number;
  timeS: number;
  /** Measured position. Perfect in Step 1; measurement noise arrives in Step 5. */
  position: Vec3;
  bearingRad: number;
  rangeM: number;
  /** Echo strength class: bigger objects return stronger echoes. */
  radarSize: RadarSize;
  /** Ground-truth link for tests and the truth overlay. The radar picture never shows it. */
  truthId: EntityId;
}

interface EventBase {
  tick: number;
  timeS: number;
  id: EntityId;
}

/** Things that happened during a tick. Structured data only; the UI turns them into words. */
export type SimEvent =
  | (EventBase & { kind: 'trafficEntered'; type: AircraftType; bearingRad: number; rangeM: number })
  | (EventBase & { kind: 'trafficLeft'; type: AircraftType })
  | (EventBase & { kind: 'contactNew'; bearingRad: number; rangeM: number })
  | (EventBase & { kind: 'contactLost'; bearingRad: number; rangeM: number });

/** The only way to change a running simulation from outside. Every command is logged. */
export type Command =
  | {
      kind: 'spawnTraffic';
      type: TrafficTypeId;
      eastM: number;
      northM: number;
      /** Compass heading: 0 = north, clockwise. */
      headingRad: number;
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
}

/** A read-only picture of the simulation at one tick, for rendering. */
export interface Snapshot {
  tick: number;
  timeS: number;
  seed: number;
  radar: RadarView;
  aircraft: readonly Aircraft[];
  plots: readonly Plot[];
  contactsHeld: number;
}
