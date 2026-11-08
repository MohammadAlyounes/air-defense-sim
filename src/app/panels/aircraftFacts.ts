import {
  angleDiff,
  bearing,
  closestApproachToOrigin,
  closingSpeedMps,
  DEFAULT_ASSETS,
  coverageAt,
  DEFAULT_DEFENSE,
  DEFAULT_INTERCEPTOR,
  DEFAULT_SEARCH_RADAR,
  detectionRangeM,
  distance,
  dopplerShiftHz,
  groundRange,
  inClutter,
  inDopplerNotch,
  lookProbability,
  radarHorizonM,
  planIntercept,
  RADAR_CROSS_SECTION_M2,
  routineLoadFactor,
  TICK_S,
  trackEllipseAt,
  trackPositionAt,
  TRAFFIC,
  turnRadiusM,
  windVelocityAt,
  type Affiliation,
  type Aircraft,
  type AircraftType,
  type Snapshot,
  type Track,
  type Vec3,
  type WindConfig,
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
  /** Where the nose points; the detail adds the track over the ground when it crabs. */
  heading: string;
  headingPoint: string;
  /** The wind it meets: headwind, tailwind or crosswind, and its own airspeed. */
  wind: string;
  windDetail: string;
  /** How it flies: an evasive break, a dog-leg, or its routine turns. */
  flight: string;
  flightDetail: string;
  flightTone: FactTone;
  /** Its speed along the radar's line of sight, which sets the echo's Doppler shift. */
  doppler: string;
  dopplerDetail: string;
  dopplerTone: FactTone;
  range: string;
  bearing: string;
  /** Can the radar see it right now: in view, hidden by terrain or below the horizon. */
  radarView: string;
  radarViewDetail: string;
  radarViewTone: FactTone;
  /** The battery's track of it, if the radar has seen it. */
  track: string;
  trackDetail: string;
  /** Truth vs. perception: how far the track is from the aircraft, and how far the filter expects. */
  trackError: string | null;
  trackErrorDetail: string;
  /** "Why?": the battery's reasoning about it, one plain sentence per step of the loop. */
  why: readonly string[];
  /** What the defense is doing about it. */
  defense: string;
  defenseDetail: string;
  defenseTone: FactTone;
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const seconds = (s: number) => `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;

const IDENTITY_WORD = {
  pending: 'identifying',
  unknown: 'unknown',
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
  const heading = aircraft.headingRad;
  const groundTrack = headingOf(velocity);
  const crabDeg = Math.round((angleDiff(groundTrack, heading) * 180) / Math.PI);
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
    headingPoint:
      Math.abs(crabDeg) >= 1 ? `track ${formatBearing(groundTrack)}` : compassPoint(heading),
    ...windFacts(snapshot.wind, aircraft, Math.abs(crabDeg)),
    ...flightFacts(aircraft),
    ...dopplerFacts(aircraft),
    range: `${formatKm(groundRange(position))} ${compassPoint(bearing(position))}`,
    bearing: `bearing ${formatBearing(bearing(position))}`,
    ...radarView(position, RADAR_CROSS_SECTION_M2[aircraft.radarSize], velocity),
    track: track ? `${trackName(track.id)} · ${IDENTITY_WORD[track.identity]}` : 'Not detected',
    trackDetail: track
      ? `painted ${seconds(snapshot.timeS - track.lastPaintTick * TICK_S)} ago`
      : `seen on half the looks from ${formatKm(
          detectionRangeM(RADAR_CROSS_SECTION_M2[aircraft.radarSize], DEFAULT_SEARCH_RADAR),
        )}`,
    ...trackError(snapshot, track, position),
    why: track ? explain(snapshot, track) : [],
    ...defenseStatus(snapshot, id, aircraft.leaked),
  };
}

/**
 * Why the battery acts as it does, from what it knows: its track, never the truth. One
 * sentence each for identification, threat evaluation, the rules and the shot.
 */
export function explain(snapshot: Snapshot, track: Track): string[] {
  const lines: string[] = [];
  const checks = track.iffChecks;
  const plural = (n: number) => (n === 1 ? 'check' : 'checks');
  switch (track.identity) {
    case 'pending':
      lines.push(
        track.confirmedTick === null
          ? 'One echo so far: a second one must confirm the track before it is identified.'
          : 'Confirmed: the identification check is due 2 s after confirmation.',
      );
      break;
    case 'unknown':
      lines.push(
        `Unknown: no answer to ${checks} identification ${plural(checks)}. One more silent check and it is declared hostile.`,
      );
      break;
    case 'hostile':
      lines.push(
        `Hostile: no answer to ${checks} identification ${plural(checks)}. A friendly aircraft answers 90% of checks; a civil one broadcasts its code.`,
      );
      break;
    case 'friend':
      lines.push('Friendly: it answered the identification check, so it is never engaged.');
      return lines;
    case 'neutral':
      lines.push('Civil: it broadcasts a civil transponder code, so it is never engaged.');
      return lines;
  }
  if (track.identity === 'pending') return lines;

  const threat = track.threat;
  if (threat) {
    const asset = DEFAULT_ASSETS.find((a) => a.id === threat.assetId);
    lines.push(
      `Threat to the ${(asset?.name ?? 'battery').toLowerCase()}: its course passes ${formatKm(threat.closestApproachM)} from it, inside the ${formatKm(asset?.threatRadiusM ?? 0)} threat ring, in ${formatIn(threat.timeToClosestS)}.`,
    );
  } else if (track.velocity) {
    lines.push('Not a threat: its course does not pass close to any defended asset.');
    return lines;
  } else {
    return lines;
  }

  const { weaponsControl, operatorMode } = snapshot.rules;
  if (weaponsControl === 'HOLD') {
    lines.push('Rules: weapons are on HOLD, so the battery does not fire.');
    return lines;
  }
  if (track.identity === 'unknown' && weaponsControl === 'TIGHT') {
    lines.push(
      'Rules: weapons TIGHT allow firing at hostile tracks only, so it waits for the next check.',
    );
    return lines;
  }
  lines.push(
    weaponsControl === 'FREE'
      ? 'Rules: weapons FREE allow firing at anything not identified as friendly or civil.'
      : 'Rules: weapons TIGHT allow firing at hostile tracks.',
  );

  const engagement = snapshot.engagements.find((e) => e.id === track.engagementId);
  if (engagement && engagement.state !== 'hit' && engagement.state !== 'missed') {
    const step =
      engagement.state === 'proposed'
        ? `Proposed to the operator (${operatorMode === 'SEMI' ? 'SEMI-AUTO' : 'AUTO'})`
        : 'Shot';
    lines.push(
      `${step}: intercept ${formatKm(groundRange(engagement.predictedPoint))} out after ${seconds(engagement.predictedTimeS)} of flight, chance of a kill ${Math.round(engagement.pk * 100)}%.`,
    );
    return lines;
  }
  if (snapshot.channels.used >= snapshot.channels.total) {
    lines.push(
      `Waiting: all ${snapshot.channels.total} fire channels are busy guiding other shots (saturation).`,
    );
    return lines;
  }
  if (snapshot.launcher.ready === 0) {
    lines.push('Waiting: no interceptor is ready; one is reloaded every 30 s.');
    return lines;
  }
  const plan = planIntercept(track, snapshot.tick, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
  lines.push(
    plan
      ? `An interceptor could meet it ${formatKm(groundRange(plan.point))} out in ${seconds(plan.timeS)} (chance of a kill ${Math.round((plan.pk ?? 0) * 100)}%): it gets the next free slot.`
      : 'Out of reach for now: an interceptor launched now could not meet it within 34 s, or only inside the 1.5 km minimum range.',
  );
  return lines;
}

/** The gap between the track and the truth, next to the filter's own estimate of it. */
function trackError(
  snapshot: Snapshot,
  track: Track | undefined,
  position: Vec3,
): Pick<AircraftFacts, 'trackError' | 'trackErrorDetail'> {
  if (!track) return { trackError: null, trackErrorDetail: '' };
  const at = trackPositionAt(track, snapshot.tick);
  const errorM = Math.hypot(at.x - position.x, at.y - position.y);
  const sigmaM = trackEllipseAt(track, snapshot.tick).majorM;
  // The last echo only fitted through the wider gate kept for hard turns.
  const turn = track.maneuvering ? ' · caught up after a hard turn' : '';
  return {
    trackError: `${formatMetres(errorM)} off`,
    trackErrorDetail: `the filter expects ±${formatMetres(sigmaM)} (1σ) · ${track.paints} echoes so far${turn}`,
  };
}

const formatMetres = (m: number) =>
  m < 1000 ? `${grouped.format(Math.round(m))} m` : `${(m / 1000).toFixed(1)} km`;

/** The wind at the aircraft, split along and across its track. */
function windFacts(
  wind: WindConfig,
  aircraft: Aircraft,
  crabDeg: number,
): Pick<AircraftFacts, 'wind' | 'windDetail'> {
  const { position, trackRad, airspeedMps } = aircraft;
  const agl = position.z - worldTerrain().heightAt(position.x, position.y);
  const w = windVelocityAt(wind, agl);
  const along = w.x * Math.sin(trackRad) + w.y * Math.cos(trackRad);
  const across = w.x * Math.cos(trackRad) - w.y * Math.sin(trackRad);
  const airspeed = `airspeed ${formatSpeed(airspeedMps)}`;
  if (Math.hypot(w.x, w.y) < 0.5) return { wind: 'Calm', windDetail: airspeed };
  const value =
    Math.abs(along) >= Math.abs(across)
      ? `${along < 0 ? 'Headwind' : 'Tailwind'} ${formatSpeed(Math.abs(along))}`
      : `Crosswind ${formatSpeed(Math.abs(across))}`;
  return {
    wind: value,
    windDetail: crabDeg >= 1 ? `${airspeed} · nose ${crabDeg}° into it` : airspeed,
  };
}

/** How the aircraft is flying its route: breaking away, on a dog-leg, or straight on. */
function flightFacts(
  aircraft: Aircraft,
): Pick<AircraftFacts, 'flight' | 'flightDetail' | 'flightTone'> {
  const performance = TRAFFIC[aircraft.type];
  if (aircraft.maneuver) {
    return {
      flight: `Breaking at ${performance.breakLoadFactor} g`,
      flightDetail: `away from ${interceptorName(aircraft.maneuver.interceptorId)}`,
      flightTone: 'warn',
    };
  }
  const next = aircraft.route[0];
  if (aircraft.route.length > 1 && next) {
    return {
      flight: 'Dog-leg',
      flightDetail: `turn point in ${formatKm(Math.hypot(next.x - aircraft.position.x, next.y - aircraft.position.y))}`,
      flightTone: 'plain',
    };
  }
  const radius = turnRadiusM(aircraft.airspeedMps, routineLoadFactor(performance));
  return {
    flight: `Turns on ${formatMetres(radius)}`,
    flightDetail: `at ${performance.bankDeg}° of bank`,
    flightTone: 'plain',
  };
}

/** Its speed along the line of sight, the Doppler shift that gives, and the clutter notch. */
function dopplerFacts(
  aircraft: Aircraft,
): Pick<AircraftFacts, 'doppler' | 'dopplerDetail' | 'dopplerTone'> {
  const radar = DEFAULT_SEARCH_RADAR;
  const closing = closingSpeedMps(radarAntenna(), aircraft.position, aircraft.velocity);
  const value = `${closing >= 0 ? 'Closing' : 'Opening'} ${formatSpeed(Math.abs(closing))}`;
  if (!inDopplerNotch(closing, radar)) {
    const shift = `${grouped.format(Math.abs(dopplerShiftHz(closing, radar)))} Hz`;
    return {
      doppler: value,
      dopplerDetail: `${shift} shift · clear of the notch`,
      dopplerTone: 'plain',
    };
  }
  return inClutter(worldTerrain(), radarAntenna(), aircraft.position)
    ? {
        doppler: value,
        dopplerDetail: 'in the notch: filtered out with the clutter',
        dopplerTone: 'warn',
      }
    : { doppler: value, dopplerDetail: 'in the notch, but no clutter here', dopplerTone: 'plain' };
}

/** Whether the search radar has a clear line of sight to it, and its chance of being seen. */
function radarView(
  position: Vec3,
  rcsM2: number,
  velocity: Vec3,
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
      const closing = closingSpeedMps(radarAntenna(), position, velocity);
      if (inDopplerNotch(closing, radar) && inClutter(worldTerrain(), radarAntenna(), position)) {
        return {
          radarView: 'Lost in clutter',
          radarViewDetail: `only ${formatSpeed(Math.abs(closing))} along the line of sight: no Doppler shift to tell it from the ground`,
          radarViewTone: 'warn',
        };
      }
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
  if (track.identity === 'friend' || track.identity === 'neutral') {
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
