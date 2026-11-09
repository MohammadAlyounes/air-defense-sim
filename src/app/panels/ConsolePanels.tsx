import clsx from 'clsx';
import { ListOrdered, ScrollText } from 'lucide-react';
import { ConceptPopover } from '../components/ConceptPopover';
import { Panel } from '../components/Panel';
import { Tooltip } from '../components/Tooltip';
import { STAGES } from '../data/stages';
import { formatSimClock } from '../lib/format';
import { IDENTITY_WORD } from '../sim/identityText';
import { formatKm } from '../sim/narrator';
import { useSimState } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';

const TRACK_COLUMNS = ['Track', 'Identity', 'Range', 'Alt', 'Speed', '±1σ', 'Stage'] as const;

const COLUMN_HINT: Partial<Record<(typeof TRACK_COLUMNS)[number], string>> = {
  '±1σ':
    'How sure the tracker is of the position: one standard deviation along the long axis of its uncertainty ellipse. It shrinks as echoes come in and grows while the track coasts.',
};

const IDENTITY_TEXT = {
  pending: { label: IDENTITY_WORD.pending, className: 'text-unknown/70' },
  unknown: { label: IDENTITY_WORD.unknown, className: 'text-unknown' },
  suspect: { label: IDENTITY_WORD.suspect, className: 'text-suspect' },
  hostile: { label: IDENTITY_WORD.hostile, className: 'text-hostile' },
  friend: { label: IDENTITY_WORD.friend, className: 'text-friend' },
  neutral: { label: IDENTITY_WORD.neutral, className: 'text-neutral' },
} as const;

/** "±45 m", "±1.2 km". */
function formatSigma(metres: number): string {
  return metres < 1000
    ? `±${grouped.format(Math.round(metres))} m`
    : `±${(metres / 1000).toFixed(1)} km`;
}

const STAGE_LABEL = Object.fromEntries(STAGES.map((stage) => [stage.id, stage.label]));
const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * The battery's tracks, most urgent first: threats by time to their closest approach, then the
 * rest by range. A row selects its aircraft. The ±1σ column shows how sure the tracker is.
 */
export function TrackTablePanel({ className }: { className?: string }) {
  const rows = useSimState((state) => state.defense.tracks);
  const selectedId = useViewStore((state) => state.selectedId);
  return (
    <Panel
      title="Track table"
      icon={ListOrdered}
      panelId="tracks"
      className={className}
      bodyClassName="overflow-auto"
      actions={
        <>
          <ConceptPopover concept="gatingAssociation" label="How echoes are matched to tracks" />
          <ConceptPopover concept="kalmanFilter" label="How the tracker sees through the noise" />
          <ConceptPopover concept="identification" label="How the battery tells friend from foe" />
        </>
      }
    >
      <table className="w-full text-left text-[11.5px]" data-testid="track-table">
        <thead className="sticky top-0 bg-ink-900 text-[10px] uppercase tracking-[0.08em] text-ink-300">
          <tr>
            {TRACK_COLUMNS.map((column) => (
              <th
                key={column}
                scope="col"
                className="px-2 py-1.5 font-semibold first:pl-3 last:pr-3"
              >
                {COLUMN_HINT[column] ? (
                  <Tooltip content={COLUMN_HINT[column]}>
                    {/* normal-case: an upper-case σ would turn into Σ. */}
                    <span
                      tabIndex={0}
                      className="cursor-help normal-case underline decoration-dotted"
                    >
                      {column}
                    </span>
                  </Tooltip>
                ) : (
                  column
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums whitespace-nowrap">
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={TRACK_COLUMNS.length}
                className="px-3 py-6 text-center font-sans text-ink-300"
              >
                No tracks yet: the radar has not detected anything. Drag a threat onto the map.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const identity = IDENTITY_TEXT[row.identity];
              const busy = row.stage === 'engage' || row.stage === 'assess';
              return (
                <tr
                  key={row.id}
                  onClick={() => useViewStore.getState().select(row.truthId)}
                  className={clsx(
                    'cursor-pointer border-t border-ink-800/70 transition-colors hover:bg-ink-850',
                    row.truthId !== null && row.truthId === selectedId && 'bg-ink-800',
                  )}
                >
                  <td className="py-1 pr-2 pl-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        useViewStore.getState().select(row.truthId);
                      }}
                      aria-current={
                        row.truthId !== null && row.truthId === selectedId ? 'true' : undefined
                      }
                      className="font-semibold text-ink-100 hover:text-accent"
                    >
                      T{row.id}
                    </button>
                  </td>
                  <td className={clsx('px-2 py-1 font-sans', identity.className)}>
                    {identity.label}
                  </td>
                  <td className="px-2 py-1 text-ink-200">{formatKm(row.rangeM)}</td>
                  <td className="px-2 py-1 text-ink-200">{grouped.format(row.altitudeM)} m</td>
                  <td className="px-2 py-1 text-ink-200">
                    {row.speedMps === null ? '—' : `${grouped.format(row.speedMps)} m/s`}
                  </td>
                  <td className="px-2 py-1 text-ink-300" data-sigma={Math.round(row.sigmaM)}>
                    {formatSigma(row.sigmaM)}
                  </td>
                  <td
                    className={clsx(
                      'py-1 pr-3 pl-2 font-sans',
                      busy ? 'text-accent' : row.threatInS !== null ? 'text-warn' : 'text-ink-300',
                    )}
                  >
                    {STAGE_LABEL[row.stage]}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </Panel>
  );
}

const SOURCE_STYLE = {
  scenario: { label: 'SCENARIO', className: 'text-ink-300' },
  radar: { label: 'RADAR', className: 'text-accent' },
  command: { label: 'COMMAND', className: 'text-warn' },
  weapon: { label: 'WEAPON', className: 'text-ok' },
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
              <strong className="text-accent">RADAR</strong>: what the radar actually sees.
              <br />
              <strong className="text-warn">COMMAND</strong>: what the command node decides.
              <br />
              <strong className="text-ok">WEAPON</strong>: what the interceptors do.
              <br />
              The gap between truth and what the radar sees is a key idea of air defense.
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
                aria-current={
                  entry.aircraftId !== null && entry.aircraftId === selectedId ? 'true' : undefined
                }
                className={clsx(
                  'flex w-full gap-2 rounded px-1.5 py-1 text-left transition-colors hover:bg-ink-850',
                  entry.aircraftId !== null &&
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
