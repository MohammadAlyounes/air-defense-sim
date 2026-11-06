import { Activity, ChevronRight, ListOrdered, ScanSearch, ScrollText } from 'lucide-react';
import { Panel } from '../components/Panel';
import { CURRENT_STEP, ROADMAP, roadmapStep } from '../data/roadmap';

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

const INSPECTOR_POINTS = [
  'Identity, and the evidence behind it',
  'Threat score, factor by factor',
  'Why this launcher, and the chance of a hit',
] as const;

export function InspectorPanel() {
  return (
    <Panel title="Inspector · Why?" icon={ScanSearch} step={9}>
      <div className="space-y-2.5 p-3 text-[12px] leading-relaxed text-ink-300">
        <p>
          Click any track, interceptor or decision to see what it is and{' '}
          <strong className="font-semibold text-ink-100">why</strong> the system acted.
        </p>
        <ul className="space-y-1.5">
          {INSPECTOR_POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
              {point}
            </li>
          ))}
        </ul>
      </div>
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

export function EventLogPanel() {
  const done = ROADMAP.filter((entry) => entry.step <= CURRENT_STEP);
  const next = roadmapStep(CURRENT_STEP + 1);
  return (
    <Panel
      title="Event log"
      subtitle="build events for now"
      icon={ScrollText}
      step={9}
      bodyClassName="overflow-y-auto"
    >
      <ol className="space-y-1 p-2.5 font-mono text-[11px] leading-snug">
        {done.map((entry) => (
          <li key={entry.step} className="flex gap-2 rounded-md bg-ink-850/70 px-2 py-1.5">
            <span className="shrink-0 font-semibold text-ok">BUILD</span>
            <span className="text-ink-200">
              Step {entry.step} · {entry.title}.{' '}
              <span className="text-ink-300">{entry.summary}</span>
            </span>
          </li>
        ))}
        {next && (
          <li className="flex gap-2 rounded-md px-2 py-1.5">
            <span className="shrink-0 font-semibold text-warn">NEXT</span>
            <span className="text-ink-200">
              Step {next.step} · {next.title}. <span className="text-ink-300">{next.summary}</span>
            </span>
          </li>
        )}
      </ol>
    </Panel>
  );
}
