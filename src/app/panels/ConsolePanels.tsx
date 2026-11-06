import clsx from 'clsx';
import { Activity, ListOrdered, ScrollText } from 'lucide-react';
import { Panel } from '../components/Panel';
import { Tooltip } from '../components/Tooltip';
import { formatSimClock } from '../lib/format';
import { useSimState } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';

const TRACK_COLUMNS = ['#', 'Track', 'Type', 'Range', 'Alt', 'Speed', 'Stage'] as const;

export function TrackTablePanel({ className }: { className?: string }) {
  return (
    <Panel
      title="Track table"
      icon={ListOrdered}
      step={6}
      className={className}
      bodyClassName="overflow-auto"
    >
      <table className="w-full text-left text-[11.5px]">
        <thead className="sticky top-0 bg-ink-900 text-[10px] uppercase tracking-[0.08em] text-ink-300">
          <tr>
            {TRACK_COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-2 py-1.5 font-semibold first:pl-3 last:pr-3"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={TRACK_COLUMNS.length} className="px-3 py-6 text-center text-ink-300">
              No tracks yet. Tracks appear here, ranked by urgency, once the radar starts scanning.
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

const TELEMETRY_SERIES = ['Altitude', 'Speed', 'g-load', 'Signal'] as const;

export function TelemetryPanel() {
  return (
    <Panel title="Telemetry" icon={Activity} step={9} bodyClassName="flex flex-col">
      <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
        {TELEMETRY_SERIES.map((series) => (
          <span
            key={series}
            className="rounded border border-ink-700 px-1.5 py-0.5 text-[10.5px] text-ink-300"
          >
            {series}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        className="min-h-0 w-full flex-1 px-3 pb-2"
        aria-hidden="true"
      >
        {[20, 50, 80, 110].map((y) => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#22304f" strokeDasharray="2 4" />
        ))}
        {[80, 160, 240, 320].map((x) => (
          <line key={x} x1={x} y1="10" x2={x} y2="110" stroke="#18243f" />
        ))}
        <path
          d="M0 95 C60 95 90 60 150 58 S260 70 300 40 S370 30 400 28"
          fill="none"
          stroke="#22d3ee"
          strokeOpacity="0.25"
          strokeWidth="2"
          strokeDasharray="5 5"
        />
      </svg>
      <p className="px-3 pb-2.5 text-[11px] text-ink-300">
        Live graphs for the selected object: altitude, speed, g-load and radar signal over time.
      </p>
    </Panel>
  );
}

const SOURCE_STYLE = {
  scenario: { label: 'SCENARIO', className: 'text-ink-300' },
  radar: { label: 'RADAR', className: 'text-accent' },
} as const;

/**
 * Simulation events, newest first: what really happens (scenario) and what the radar sees.
 * Each line selects its aircraft, which makes the log the keyboard way to pick one.
 */
export function EventLogPanel() {
  const log = useSimState((state) => state.log);
  const selectedId = useViewStore((state) => state.selectedId);
  return (
    <Panel
      title="Event log"
      icon={ScrollText}
      panelId="event-log"
      bodyClassName="flex flex-col"
      actions={
        <Tooltip
          content={
            <>
              <strong className="text-ink-100">SCENARIO</strong>: what really happens in the sky.
              <br />
              <strong className="text-accent">RADAR</strong>: what the radar actually sees. The gap
              between the two is a key idea of air defense.
            </>
          }
        >
          <span
            tabIndex={0}
            className="cursor-help text-[10.5px] text-ink-300 underline decoration-dotted"
          >
            truth vs. radar
          </span>
        </Tooltip>
      }
    >
      {log.length === 0 ? (
        <p className="p-3 text-[12px] text-ink-300">Events appear here as the simulation runs.</p>
      ) : (
        <ol
          className="min-h-0 flex-1 space-y-px overflow-y-auto p-2 font-mono text-[11px] leading-snug"
          data-testid="event-log"
        >
          {log.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => useViewStore.getState().select(entry.aircraftId)}
                aria-current={entry.aircraftId === selectedId ? 'true' : undefined}
                className={clsx(
                  'flex w-full gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-ink-850',
                  entry.aircraftId === selectedId &&
                    'bg-ink-800 shadow-[inset_2px_0_0_0_var(--color-accent)]',
                )}
              >
                <span className="shrink-0 tabular-nums text-ink-300">
                  {formatSimClock(entry.timeS).slice(2)}
                </span>
                <span
                  className={`w-16 shrink-0 font-semibold ${SOURCE_STYLE[entry.source].className}`}
                >
                  {SOURCE_STYLE[entry.source].label}
                </span>
                <span className="text-ink-100">{entry.text}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
