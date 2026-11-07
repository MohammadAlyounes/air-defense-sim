import {
  bearing,
  closestApproachToOrigin,
  coverageAt,
  DEFAULT_DEFENSE,
  DEFAULT_INTERCEPTOR,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  distance,
  groundRange,
  lookProbability,
  radarHorizonM,
  planIntercept,
  RADAR_CROSS_SECTION_M2,
  TICK_S,
  trackPositionAt,
  type Affiliation,
  type AircraftType,
  type Snapshot,
  type Vec3,
} from '../../sim';
import { formatSpeed } from '../lib/format';
import {
  compassPoint,
  formatBearing,
  formatIn,
  formatKm,
  interceptorName,
  trackName,
} from '../sim/narrator';
import { headingOf } from '../views/3d/coords';
import { radarAntenna, visibilityOf, worldCoverage, worldTerrain } from '../world/world';

export type FactTone = 'plain' | 'accent' | 'ok' | 'warn' | 'alert';

/** What the inspector shows about one aircraft, ready to display. */
export interface AircraftFacts {
  type: AircraftType;
  affiliation: Affiliation;
  speed: string;
  speedKmh: string;
  altitude: string;
  altitudeRef: string;
  heading: string;
  headingPoint: string;
  range: string;
  bearing: string;
  /** Can the radar see it right now: in view, hidden by terrain or below the horizon. */
  radarView: string;
  radarViewDetail: string;
  radarViewTone: FactTone;
  /** The battery's track of it, if the radar has seen it. */
  track: string;
  trackDetail: string;
  /** What the defense is doing about it. */
  defense: string;
  defenseDetail: string;
  defenseTone: FactTone;
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const seconds = (s: number) => `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;

const IDENTITY_WORD = {
  pending: 'identifying',
  hostile: 'hostile',
  friend: 'friendly',
  neutral: 'civil',
} as const;

/**
 * Ground truth about aircraft `id` in plain units, plus what the battery knows about it (its
 * track) and does about it (its engagement). Null once the aircraft has gone.
 */
export function aircraftFacts(snapshot: Snapshot, id: number): AircraftFacts | null {
  const aircraft = snapshot.aircraft.find((a) => a.id === id);
  if (!aircraft) return null;
  const { position, velocity } = aircraft;
  const speedMps = Math.hypot(velocity.x, velocity.y, velocity.z);
  const heading = headingOf(velocity);
  const track = snapshot.tracks.find((t) => t.truthId === id);

  return {
    type: aircraft.type,
    affiliation: aircraft.affiliation,
    speed: formatSpeed(speedMps),
    speedKmh: `${grouped.format(speedMps * 3.6)} km/h`,
    // Terrain followers are shown by their height above the ground, the others by altitude.
    altitude: `${grouped.format(
      Math.round(
        (aircraft.altitudeRef === 'AGL'
          ? position.z - worldTerrain().heightAt(position.x, position.y)
          : position.z) / 10,
      ) * 10,
    )} m`,
    altitudeRef: aircraft.altitudeRef === 'AGL' ? 'above ground' : 'above sea level',
    heading: formatBearing(heading),
    headingPoint: compassPoint(heading),
    range: `${formatKm(groundRange(position))} ${compassPoint(bearing(position))}`,
    bearing: `bearing ${formatBearing(bearing(position))}`,
    ...radarView(position, RADAR_CROSS_SECTION_M2[aircraft.radarSize]),
    track: track ? `${trackName(track.id)} · ${IDENTITY_WORD[track.identity]}` : 'Not detected',
    trackDetail: track
      ? `painted ${seconds(snapshot.timeS - track.lastPaintTick * TICK_S)} ago`
      : `seen on half the looks from ${formatKm(
          detectionRangeM(RADAR_CROSS_SECTION_M2[aircraft.radarSize], DEFAULT_SEARCH_RADAR),
        )}`,
    ...defenseStatus(snapshot, id, aircraft.leaked),
  };
}

/** Whether the search radar has a clear line of sight to it, and its chance of being seen. */
function radarView(
  position: Vec3,
  rcsM2: number,
): Pick<AircraftFacts, 'radarView' | 'radarViewDetail' | 'radarViewTone'> {
  const radar = DEFAULT_SEARCH_RADAR;
  if (groundRange(position) > radar.rangeM) {
    return { radarView: 'Out of range', radarViewDetail: 'beyond 40 km', radarViewTone: 'plain' };
  }
  const groundM = worldTerrain().heightAt(position.x, position.y);
  switch (visibilityOf(position)) {
    case 'horizon':
      return {
        radarView: 'Below the horizon',
        radarViewDetail: `at its height the horizon is ${formatKm(radarHorizonM(radar.antennaHeightM, position.z))} away`,
        radarViewTone: 'warn',
      };
    case 'terrain': {
      const minAgl = coverageAt(worldCoverage(), position.x, position.y);
      return {
        radarView: 'Hidden by terrain',
        radarViewDetail: Number.isFinite(minAgl)
          ? `visible here from ${grouped.format(Math.ceil((minAgl + 1) / 10) * 10)} m above the ground`
          : 'a hill blocks the view',
        radarViewTone: 'warn',
      };
    }
    case 'visible': {
      const chance = lookProbability(rcsM2, distance(radarAntenna(), position), radar);
      return {
        radarView: 'In view',
        radarViewDetail: `${Math.round(chance * 100)}% chance per look · ${grouped.format(Math.max(0, position.z - groundM))} m above the ground`,
        radarViewTone: chance >= 0.5 ? 'ok' : 'plain',
      };
    }
  }
}

function defenseStatus(
  snapshot: Snapshot,
  id: number,
  leaked: boolean,
): Pick<AircraftFacts, 'defense' | 'defenseDetail' | 'defenseTone'> {
  if (leaked)
    return { defense: 'Got through', defenseDetail: 'reached the battery', defenseTone: 'alert' };
  const track = snapshot.tracks.find((t) => t.truthId === id);
  if (!track)
    return { defense: 'Not engaged', defenseDetail: 'not detected yet', defenseTone: 'plain' };
  if (track.identity === 'pending') {
    return { defense: 'Waiting', defenseDetail: 'identification check', defenseTone: 'plain' };
  }
  if (track.identity !== 'hostile') {
    return {
      defense: 'Never engaged',
      defenseDetail: `identified ${IDENTITY_WORD[track.identity]}`,
      defenseTone: 'ok',
    };
  }

  const engagement = snapshot.engagements.find((e) => e.id === track.engagementId);
  switch (engagement?.state) {
    case 'assigned':
      return {
        defense: 'Assigned',
        defenseDetail: `launch in ${Math.max(0, engagement.launchTick * TICK_S - snapshot.timeS).toFixed(1)} s`,
        defenseTone: 'warn',
      };
    case 'flying':
      return {
        defense: `Engaged by ${interceptorName(engagement.interceptorId ?? 0)}`,
        defenseDetail: `intercept in ${formatIn(engagement.launchTick * TICK_S + engagement.predictedTimeS - snapshot.timeS)}`,
        defenseTone: 'accent',
      };
    case 'hit':
      return { defense: 'Hit', defenseDetail: 'radar looking again', defenseTone: 'ok' };
    case 'missed':
      return { defense: 'Missed', defenseDetail: 'radar looking again', defenseTone: 'alert' };
  }

  if (track.threat) {
    const reachable = planIntercept(track, snapshot.tick, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
    return {
      defense: 'Threat',
      defenseDetail: reachable
        ? `closest approach in ${formatIn(track.threat.timeToClosestS)}`
        : 'out of reach for now',
      defenseTone: 'warn',
    };
  }
  const pass = track.velocity
    ? closestApproachToOrigin(trackPositionAt(track, snapshot.tick), track.velocity)
    : null;
  return {
    defense: 'Not a threat',
    defenseDetail:
      pass && pass.timeS > 0 ? `passes ${formatKm(pass.distanceM)} away` : 'flying away',
    defenseTone: 'plain',
  };
}
