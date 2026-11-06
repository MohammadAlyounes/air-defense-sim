const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Simulation clock, e.g. 84.27 s -> "T+01:24.2".
 * Truncates (never rounds up) so the display never shows a moment that has not happened yet.
 */
export function formatSimClock(seconds: number): string {
  const totalTenths = Math.floor(Math.max(0, seconds) * 10 + 1e-9);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(totalTenths / 10);
  return `T+${pad2(Math.floor(totalSeconds / 60))}:${pad2(totalSeconds % 60)}.${tenths}`;
}

/**
 * Countdown to an event, e.g. 41.2 s -> "00:42". Rounds up, so "00:00" means "now".
 * Returns an em dash when there is nothing to count down to.
 */
export function formatCountdown(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.ceil(seconds - 1e-9));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function formatSpeed(speedMps: number): string {
  return `${grouped.format(speedMps)} m/s`;
}

/** Compact altitude for tight spaces: "50 m", "300 m", "6 km", "11 km". */
export function formatAltitudeShort(altitudeM: number): string {
  if (altitudeM < 1000) return `${grouped.format(altitudeM)} m`;
  const km = altitudeM / 1000;
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

/** "50 m above ground" for terrain-relative altitudes, "11,000 m" for altitudes above sea level. */
export function formatAltitude(altitudeM: number, reference: 'AGL' | 'MSL'): string {
  const value = `${grouped.format(altitudeM)} m`;
  return reference === 'AGL' ? `${value} above ground` : value;
}
