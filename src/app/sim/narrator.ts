import { TICK_S, type AircraftType, type SimEvent, type Snapshot } from '../../sim';
import { formatSimClock } from '../lib/format';

/**
 * Turns simulation data into plain language: event-log lines and the header's NOW line.
 * The NOW line describes what the battery perceives (its tracks), never the hidden truth.
 */

const TWO_PI = 2 * Math.PI;
const COMPASS = [
  'north',
  'north-east',
  'east',
  'south-east',
  'south',
  'south-west',
  'west',
  'north-west',
] as const;

const normalize = (rad: number) => ((rad % TWO_PI) + TWO_PI) % TWO_PI;

/** "north-east" for 45°. */
export function compassPoint(bearingRad: number): string {
  return COMPASS[Math.round(normalize(bearingRad) / (Math.PI / 4)) % 8] ?? 'north';
}

/** "045°" (three digits, like a radar operator says it). */
export function formatBearing(bearingRad: number): string {
  const degrees = Math.round((normalize(bearingRad) * 180) / Math.PI) % 360;
  return `${String(degrees).padStart(3, '0')}°`;
}

/** "32 km", or "8.4 km" below ten kilometres. */
export function formatKm(rangeM: number): string {
  const km = rangeM / 1000;
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

/** "28 s" under a minute, "1:05" above. */
export function formatIn(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "under 1 m", "4 m", "1.2 km". */
export function formatMiss(metres: number): string {
  if (metres < 1) return 'under 1 m';
  return metres < 1000 ? `${Math.round(metres)} m` : formatKm(metres);
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** Track and interceptor names, as shown everywhere in the UI. */
export const trackName = (id: number) => `T${id}`;
export const interceptorName = (id: number) => `I${id}`;

export const TRAFFIC_NOUN: Readonly<Record<AircraftType, string>> = {
  drone: 'small drone',
  cruise: 'cruise-missile-like target',
  jet: 'fast jet',
  friendly: 'friendly aircraft',
  airliner: 'civil airliner',
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
export const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

/**
 * Where an event-log line comes from: the scenario (ground truth), the radar (what it sees),
 * the command node (its decisions) or the weapon (interceptors).
 */
export type LogSource = 'scenario' | 'radar' | 'command' | 'weapon';

export interface LogLine {
  source: LogSource;
  text: string;
}

const IDENTITY_LINE = {
  hostile: 'identified as hostile: no reply to the identification check.',
  friend: 'identified as friendly: it answered the identification check.',
  neutral: 'identified as civil: it broadcasts a civil transponder code.',
} as const;

export function describeEvent(event: SimEvent): LogLine {
  switch (event.kind) {
    case 'trafficEntered': {
      const who = capitalize(withArticle(TRAFFIC_NOUN[event.type]));
      const where = `${formatKm(event.rangeM)} to the ${compassPoint(event.bearingRad)}`;
      return {
        source: 'scenario',
        text: event.tick === 0 ? `${who} is already flying ${where}.` : `${who} enters ${where}.`,
      };
    }
    case 'trafficLeft':
      return { source: 'scenario', text: `The ${TRAFFIC_NOUN[event.type]} leaves the area.` };
    case 'threatLeaked':
      return {
        source: 'scenario',
        text: `${capitalize(withArticle(TRAFFIC_NOUN[event.type]))} reached the battery: it got through.`,
      };
    case 'contactNew':
      return {
        source: 'radar',
        text: `New contact ${trackName(event.trackId)} at bearing ${formatBearing(event.bearingRad)}, ${formatKm(event.rangeM)}.`,
      };
    case 'contactLost':
      return {
        source: 'radar',
        text: `Contact ${trackName(event.trackId)} lost at bearing ${formatBearing(event.bearingRad)}, ${formatKm(event.rangeM)}.`,
      };
    case 'trackConfirmed':
      return {
        source: 'radar',
        text: `${trackName(event.trackId)} confirmed as a track: ${grouped.format(event.speedMps)} m/s at ${grouped.format(event.altitudeM)} m.`,
      };
    case 'identified':
      return {
        source: 'command',
        text: `${trackName(event.trackId)} ${IDENTITY_LINE[event.identity]}`,
      };
    case 'threatEvaluated':
      return {
        source: 'command',
        text:
          event.closestApproachM < 500
            ? `${trackName(event.trackId)} is flying straight at the battery: closest approach in ${formatIn(event.timeToClosestS)}.`
            : `${trackName(event.trackId)} is heading for the battery: it passes ${formatKm(event.closestApproachM)} away in ${formatIn(event.timeToClosestS)}.`,
      };
    case 'engagementAssigned':
      return {
        source: 'command',
        text: `${trackName(event.trackId)} assigned to the launcher: launch in ${event.launchInS.toFixed(1)} s, intercept ${formatKm(event.predictedRangeM)} out.`,
      };
    case 'engagementCancelled':
      return {
        source: 'command',
        text: `Shot at ${trackName(event.trackId)} cancelled: it can no longer be reached.`,
      };
    case 'interceptorLaunched':
      return {
        source: 'weapon',
        text: `${interceptorName(event.interceptorId)} launched at ${trackName(event.trackId)}: intercept in ${formatIn(event.predictedTimeS)}, ${formatKm(event.predictedRangeM)} out.`,
      };
    case 'interceptResult':
      return { source: 'weapon', text: describeResult(event) };
    case 'killAssessed':
      return {
        source: 'radar',
        text: `Kill assessed: no echo where ${trackName(event.trackId)} should be.`,
      };
    case 'targetSurvived':
      return {
        source: 'radar',
        text: `${trackName(event.trackId)} is still flying: the radar sees it again.`,
      };
  }
}

function describeResult(event: Extract<SimEvent, { kind: 'interceptResult' }>): string {
  const i = interceptorName(event.interceptorId);
  const t = trackName(event.trackId);
  const miss = event.missDistanceM === null ? '' : formatMiss(event.missDistanceM);
  if (event.hit) return `${i} hit ${t} (closest approach ${miss}).`;
  switch (event.reason) {
    case 'outOfTime':
      return `${i} ran out of flight time, ${miss} from ${t}.`;
    case 'ground':
      return `${i} hit the ground short of ${t}.`;
    case 'targetGone':
      return `${i} destroyed itself: ${t} is gone.`;
    default:
      return `${i} missed ${t} by ${miss}.`;
  }
}

export interface NowInput {
  running: boolean;
  snapshot: Snapshot;
  /** Events from the last few seconds, oldest first. */
  recent: readonly SimEvent[];
}

const RECENT_RESULT_S = 3;
const RECENT_KILL_S = 4;

/** The plain-language NOW line in the header: the battery's most important activity. */
export function describeNow({ running, snapshot, recent }: NowInput): string {
  if (!running && snapshot.tick === 0) {
    return 'Ready. Press Play (Space) to start the simulation.';
  }
  const situation = describeSituation(snapshot, recent);
  return running ? situation : `Paused at ${formatSimClock(snapshot.timeS)} · ${situation}`;
}

function describeSituation(snapshot: Snapshot, recent: readonly SimEvent[]): string {
  const { timeS } = snapshot;
  const latest = <K extends SimEvent['kind']>(kind: K, withinS: number) =>
    recent.findLast(
      (e): e is Extract<SimEvent, { kind: K }> => e.kind === kind && timeS - e.timeS <= withinS,
    );

  const kill = latest('killAssessed', RECENT_KILL_S);
  if (kill) {
    return `${trackName(kill.trackId)} destroyed, confirmed by the radar ${formatIn(kill.detectionToKillS)} after it was first detected.`;
  }
  const result = latest('interceptResult', RECENT_RESULT_S);
  if (result) {
    const i = interceptorName(result.interceptorId);
    const t = trackName(result.trackId);
    return result.hit
      ? `${i} hit ${t}. The radar will look again to confirm the kill.`
      : `${i} missed ${t}. The radar will look again before firing another.`;
  }
  if (latest('threatLeaked', RECENT_KILL_S)) {
    return 'A hostile reached the battery: the defense was too late.';
  }

  const flying = snapshot.engagements
    .filter((e) => e.state === 'flying')
    .map((e) => ({ e, inS: e.launchTick * TICK_S + e.predictedTimeS - timeS }))
    .sort((a, b) => a.inS - b.inS);
  const first = flying[0];
  if (first) {
    const more = flying.length > 1 ? ` ${flying.length - 1} more in flight.` : '';
    return `Engaging ${trackName(first.e.trackId)}: interceptor ${interceptorName(first.e.interceptorId ?? 0)} in flight, intercept in ${formatIn(first.inS)}.${more}`;
  }
  const assigned = snapshot.engagements.find((e) => e.state === 'assigned');
  if (assigned) {
    return `${trackName(assigned.trackId)} assigned: launch in ${Math.max(0, assigned.launchTick * TICK_S - timeS).toFixed(1)} s.`;
  }
  const threat = snapshot.tracks
    .filter((t) => t.threat && t.engagementId === null)
    .sort((a, b) => (a.threat?.timeToClosestS ?? 0) - (b.threat?.timeToClosestS ?? 0))[0];
  if (threat?.threat) {
    const head = `${trackName(threat.id)} is heading for the battery (closest approach in ${formatIn(threat.threat.timeToClosestS)})`;
    return snapshot.launcher.ready === 0
      ? `${head}, but no interceptors are ready.`
      : `${head}: waiting until an interceptor can reach it.`;
  }
  return describePicture(snapshot);
}

function describePicture(snapshot: Snapshot): string {
  const sweep = `Radar sweeping, one turn every ${snapshot.radar.periodS} s.`;
  const { tracks } = snapshot;
  if (tracks.length === 0) return `${sweep} No contacts yet.`;
  const count = (identity: string) => tracks.filter((t) => t.identity === identity).length;
  const parts = [
    [count('hostile'), 'hostile'],
    [count('friend'), 'friendly'],
    [count('neutral'), 'civil'],
    [count('pending'), 'being identified'],
  ] as const;
  const detail = parts
    .filter(([n]) => n > 0)
    .map(([n, label]) => `${n} ${label}`)
    .join(', ');
  const noun = tracks.length === 1 ? 'track' : 'tracks';
  return `${sweep} ${tracks.length} ${noun}: ${detail}.`;
}
