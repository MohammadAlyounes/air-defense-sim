import type { AircraftType, SimEvent, Snapshot } from '../../sim';
import { formatSimClock } from '../lib/format';

/**
 * Turns simulation data into plain language: event-log lines and the header's NOW line.
 * The NOW line describes what the radar perceives, never the hidden ground truth.
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

const TRAFFIC_NOUN: Readonly<Record<AircraftType, string>> = {
  drone: 'small drone',
  cruise: 'cruise-missile-like target',
  jet: 'fast jet',
  friendly: 'friendly aircraft',
  airliner: 'civil airliner',
};

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? 'an' : 'a'} ${noun}`;

/** Where an event-log line comes from: the scenario (ground truth) or the radar (perception). */
export type LogSource = 'scenario' | 'radar';

export interface LogLine {
  source: LogSource;
  text: string;
}

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
    case 'contactNew':
      return {
        source: 'radar',
        text: `New contact at bearing ${formatBearing(event.bearingRad)}, ${formatKm(event.rangeM)}.`,
      };
    case 'contactLost':
      return {
        source: 'radar',
        text: `Contact lost at bearing ${formatBearing(event.bearingRad)}, ${formatKm(event.rangeM)}.`,
      };
  }
}

/** Nearest echo painted during the last antenna turn: what the radar sees, not the truth. */
export function nearestRecentEcho(
  snapshot: Snapshot,
): { rangeM: number; bearingRad: number } | null {
  const since = snapshot.timeS - snapshot.radar.periodS;
  let nearest: { rangeM: number; bearingRad: number } | null = null;
  for (const plot of snapshot.plots) {
    if (plot.timeS > since && (nearest === null || plot.rangeM < nearest.rangeM)) {
      nearest = { rangeM: plot.rangeM, bearingRad: plot.bearingRad };
    }
  }
  return nearest;
}

export interface NowInput {
  running: boolean;
  tick: number;
  timeS: number;
  periodS: number;
  contactsHeld: number;
  nearest: { rangeM: number; bearingRad: number } | null;
}

/** The plain-language NOW line in the header. */
export function describeNow(input: NowInput): string {
  if (!input.running && input.tick === 0) {
    return 'Ready. Press Play (Space) to start the simulation.';
  }
  if (!input.running) {
    return `Paused at ${formatSimClock(input.timeS)}. Step moves one 20 ms tick (Shift: one second); Play continues.`;
  }
  const sweep = `Radar sweeping, one turn every ${input.periodS} s.`;
  if (input.contactsHeld === 0) return `${sweep} No contacts yet.`;
  const contacts = input.contactsHeld === 1 ? '1 contact' : `${input.contactsHeld} contacts`;
  const nearest = input.nearest
    ? `; the nearest is ${formatKm(input.nearest.rangeM)} to the ${compassPoint(input.nearest.bearingRad)}`
    : '';
  return `${sweep} ${contacts} on the scope${nearest}.`;
}
