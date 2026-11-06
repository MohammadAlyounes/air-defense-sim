import {
  bearing,
  groundRange,
  TICK_S,
  TRAFFIC,
  type Affiliation,
  type AircraftType,
  type Snapshot,
} from '../../sim';
import { formatSpeed } from '../lib/format';
import { compassPoint, formatBearing, formatKm } from '../sim/narrator';
import { headingOf } from '../views/3d/coords';

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
  radar: string;
  radarDetail: string;
  inArea: string;
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const seconds = (s: number) => `${s < 10 ? s.toFixed(1) : Math.round(s)} s`;
/** "1:05": whole minutes and seconds, never rounded up. */
const duration = (s: number) => {
  const whole = Math.floor(s + 1e-9);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/**
 * Ground truth about aircraft `id` in plain units, or null once it has left. The radar line
 * says what the radar knows about it: held, lost or not seen yet.
 */
export function aircraftFacts(snapshot: Snapshot, id: number): AircraftFacts | null {
  const aircraft = snapshot.aircraft.find((a) => a.id === id);
  if (!aircraft) return null;
  const { position, velocity, lastPaint } = aircraft;
  const speedMps = Math.hypot(velocity.x, velocity.y, velocity.z);
  const heading = headingOf(velocity);
  const rangeM = groundRange(position);

  let radar: string;
  let radarDetail: string;
  if (lastPaint) {
    const ageS = snapshot.timeS - lastPaint.tick * TICK_S;
    radar = aircraft.contactHeld ? 'Contact held' : 'Contact lost';
    radarDetail = `${aircraft.contactHeld ? 'painted' : 'last painted'} ${seconds(ageS)} ago`;
  } else {
    radar = 'Not seen yet';
    radarDetail = rangeM > snapshot.radar.rangeM ? 'beyond radar range' : 'waiting for the beam';
  }

  return {
    type: aircraft.type,
    affiliation: aircraft.affiliation,
    speed: formatSpeed(speedMps),
    speedKmh: `${grouped.format(speedMps * 3.6)} km/h`,
    altitude: `${grouped.format(Math.round(position.z / 10) * 10)} m`,
    altitudeRef: TRAFFIC[aircraft.type].altitudeRef === 'AGL' ? 'above ground' : 'above sea level',
    heading: formatBearing(heading),
    headingPoint: compassPoint(heading),
    range: `${formatKm(rangeM)} ${compassPoint(bearing(position))}`,
    bearing: `bearing ${formatBearing(bearing(position))}`,
    radar,
    radarDetail,
    inArea: duration((snapshot.tick - aircraft.spawnTick) * TICK_S),
  };
}
