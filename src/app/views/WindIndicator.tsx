import { useEffect, useState } from 'react';
import { windSpeedAt, type WindConfig } from '../../sim';
import { Tooltip } from '../components/Tooltip';
import { useSimController } from '../sim/simContext';
import { compassPoint } from '../sim/narrator';

const TWO_PI = 2 * Math.PI;

/** This run's wind in plain words: the indicator's text and its tooltip. */
function windSummary(wind: WindConfig) {
  const at300 = windSpeedAt(wind, 300);
  return {
    calm: wind.speedMps < 0.5,
    speed: `${Math.round(wind.speedMps)} m/s`,
    from: compassPoint(wind.fromRad),
    /** Where the air moves to, compass degrees: the arrow's direction. */
    towardDeg: Math.round((((wind.fromRad + Math.PI) % TWO_PI) * 180) / Math.PI),
    at300: Math.round(at300),
    at6km: Math.round(windSpeedAt(wind, 6_000)),
    /** How much of a 40 m/s drone's speed over the ground a head- or tailwind at 300 m changes. */
    dronePercent: Math.round((at300 / 40) * 100),
  };
}

/** Same wind, same object: the indicator only re-renders when a new run brings a new wind. */
const sameWind = (a: WindConfig, b: WindConfig) =>
  a.speedMps === b.speedMps && a.fromRad === b.fromRad;

/**
 * The run's wind next to the radar scope: an arrow pointing where the air moves, and its speed
 * 10 m above the ground. The tooltip says how it grows with height and what it does to traffic.
 */
export function WindIndicator() {
  const controller = useSimController();
  const [wind, setWind] = useState(() => controller.getFrame().current.wind);
  useEffect(
    () =>
      controller.onFrame((frame) => {
        const next = frame.current.wind;
        setWind((previous) => (sameWind(previous, next) ? previous : next));
      }),
    [controller],
  );
  const summary = windSummary(wind);
  const tip = summary.calm
    ? 'No wind in this run.'
    : `Wind from the ${summary.from} at ${summary.speed}, 10 m above the ground. It grows with height: ${summary.at300} m/s at 300 m, where drones fly, and ${summary.at6km} m/s at 6 km. Flying into it, a 40 m/s drone loses ${summary.dronePercent}% of its speed over the ground (and gains as much downwind); fast aircraft hardly notice.`;
  return (
    <Tooltip content={tip}>
      <span
        tabIndex={0}
        data-testid="wind"
        data-wind-speed={wind.speedMps.toFixed(1)}
        data-wind-toward={summary.towardDeg}
        className="flex h-6 cursor-help items-center gap-1 rounded-md border border-ink-700 bg-ink-950/60 px-1.5 font-mono text-[10.5px] tabular-nums text-ink-200"
      >
        {!summary.calm && (
          <svg
            viewBox="0 0 12 12"
            className="size-3 text-accent"
            style={{ transform: `rotate(${summary.towardDeg}deg)` }}
            aria-hidden="true"
          >
            <path
              d="M6 10.5V1.8M2.9 4.9 6 1.8l3.1 3.1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <span className="sr-only">Wind: </span>
        {summary.calm ? 'calm' : summary.speed}
        {!summary.calm && <span className="sr-only"> from the {summary.from}</span>}
      </span>
    </Tooltip>
  );
}
