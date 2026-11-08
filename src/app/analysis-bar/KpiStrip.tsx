import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Tooltip } from '../components/Tooltip';
import { CURRENT_STEP, roadmapStep } from '../data/roadmap';
import { formatCountdown } from '../lib/format';
import { useSimController } from '../sim/simContext';
import {
  KPI_ARRIVES_IN_STEP,
  NEXT_OPERATOR_MODE,
  NEXT_WEAPONS_CONTROL,
  OPERATOR_MODE_HELP,
  OPERATOR_MODE_LABEL,
  WEAPONS_CONTROL_HELP,
  type SituationSummary,
} from './situation';

/** Second row of the analysis bar: key numbers plus the plain-language NOW line. */
export function KpiStrip({ situation: s }: { situation: SituationSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-ink-800/80 px-3 py-1.5 text-[12px]">
      {/* Phones get the pipeline and the NOW line only; the numbers start at tablet width. */}
      <div className="hidden flex-wrap items-center gap-x-5 gap-y-1.5 md:flex">
        <KpiGroup situation={s} />
      </div>
      <p
        className="flex min-w-0 basis-full items-center gap-2 xl:basis-0 xl:flex-1"
        aria-live="polite"
        data-testid="now-line"
      >
        <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.2em] text-accent">
          NOW
        </span>
        <span className="line-clamp-2 text-ink-200 md:line-clamp-1" title={s.now}>
          {s.now}
        </span>
      </p>
    </div>
  );
}

function KpiGroup({ situation: s }: { situation: SituationSummary }) {
  const controller = useSimController();
  return (
    <>
      <Kpi
        label="Threats"
        hint="Hostile tracks now, threats the radar confirmed destroyed, threats that reached a defended asset, and identification errors: friendly or civil aircraft shot down."
        arrivesInStep={KPI_ARRIVES_IN_STEP.threats}
      >
        <Num value={s.threats?.active} unit="active" />
        <Num value={s.threats?.down} unit="down" tone="ok" />
        <Num value={s.threats?.leaked} unit="leaked" tone="alert" />
        {s.threats && s.threats.idErrors > 0 && (
          <Num value={s.threats.idErrors} unit="ID errors" tone="alert" />
        )}
      </Kpi>
      <Kpi
        label="Interceptors"
        hint="Rounds ready on the launcher (one is reloaded every 30 s), in flight, and fired so far."
        arrivesInStep={KPI_ARRIVES_IN_STEP.interceptors}
      >
        <Num value={s.interceptors?.ready} unit="ready" />
        <Num value={s.interceptors?.flying} unit="flying" />
        <Num value={s.interceptors?.used} unit="used" />
      </Kpi>
      <Kpi
        label="Fire channels"
        hint="Each tracking-radar channel can guide one engagement at a time. When every channel is busy, new threats have to wait: that is saturation."
      >
        <ChannelMeter channels={s.channels} />
      </Kpi>
      <Kpi
        label="Next impact"
        hint="Time until the most urgent threat reaches its closest point to the defended asset it is heading for: the battery, the town or the power plant."
        arrivesInStep={KPI_ARRIVES_IN_STEP.nextImpact}
      >
        <span className="font-mono tabular-nums text-ink-100">
          {formatCountdown(s.nextImpact?.inSeconds ?? null)}
        </span>
        {s.nextImpact && (
          <span className="text-ink-300">
            {s.nextImpact.threat} → {s.nextImpact.asset}
          </span>
        )}
      </Kpi>
      <div className="flex items-center gap-1.5">
        <DoctrineBadge
          testId="wcs"
          label={`WCS ${s.weaponsControl}`}
          hint={WEAPONS_CONTROL_HELP[s.weaponsControl]}
          tone={
            s.weaponsControl === 'FREE' ? 'warn' : s.weaponsControl === 'HOLD' ? 'muted' : 'plain'
          }
          onClick={() =>
            controller.dispatch({
              kind: 'setRules',
              rules: { weaponsControl: NEXT_WEAPONS_CONTROL[s.weaponsControl] },
            })
          }
        />
        <DoctrineBadge
          testId="operator-mode"
          label={OPERATOR_MODE_LABEL[s.operatorMode]}
          hint={OPERATOR_MODE_HELP[s.operatorMode]}
          tone={s.operatorMode === 'SEMI' ? 'accent' : 'plain'}
          onClick={() =>
            controller.dispatch({
              kind: 'setRules',
              rules: { operatorMode: NEXT_OPERATOR_MODE[s.operatorMode] },
            })
          }
        />
      </div>
    </>
  );
}

function Kpi({
  label,
  hint,
  arrivesInStep,
  children,
}: {
  label: string;
  hint?: string;
  /** The roadmap step that builds this number; before it, the tooltip says "Arrives in Step N". */
  arrivesInStep?: number;
  children: ReactNode;
}) {
  const arrives =
    arrivesInStep === undefined || arrivesInStep <= CURRENT_STEP
      ? undefined
      : roadmapStep(arrivesInStep);
  const tooltip =
    hint || arrives ? (
      <>
        {hint}
        {arrives && (
          <span className={clsx('block text-ink-300', hint && 'mt-1.5')}>
            Arrives in Step {arrives.step} · {arrives.title}.
          </span>
        )}
      </>
    ) : null;
  const text = (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-300">
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-2">
      {tooltip ? (
        <Tooltip content={tooltip}>
          <span tabIndex={0} className="cursor-help border-b border-dotted border-ink-500">
            {text}
          </span>
        </Tooltip>
      ) : (
        text
      )}
      <div className="flex items-center gap-2.5">{children}</div>
    </div>
  );
}

function Num({ value, unit, tone }: { value?: number; unit: string; tone?: 'ok' | 'alert' }) {
  return (
    <span className="flex items-baseline gap-1">
      <span
        className={clsx(
          'font-mono tabular-nums',
          value !== undefined && tone === 'ok' && 'text-ok',
          value !== undefined && tone === 'alert' && 'text-alert',
          (value === undefined || tone === undefined) && 'text-ink-100',
        )}
      >
        {value ?? '—'}
      </span>
      <span className="text-ink-300">{unit}</span>
    </span>
  );
}

function ChannelMeter({ channels }: { channels: SituationSummary['channels'] }) {
  const total = channels?.total ?? 4;
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-3 w-1.5 rounded-sm',
              channels && i < channels.used ? 'bg-accent' : 'bg-ink-700',
            )}
          />
        ))}
      </span>
      <span className="font-mono tabular-nums text-ink-100">
        {channels ? `${channels.used}/${channels.total}` : '—'}
      </span>
    </span>
  );
}

/** A rule of engagement: click to cycle it (the change is a recorded command, so it replays). */
function DoctrineBadge({
  label,
  hint,
  tone,
  onClick,
  testId,
}: {
  label: string;
  hint: string;
  tone: 'plain' | 'warn' | 'accent' | 'muted';
  onClick: () => void;
  testId: string;
}) {
  return (
    <Tooltip
      content={
        <>
          {hint}
          <span className="mt-1.5 block text-ink-300">Click to change.</span>
        </>
      }
    >
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className={clsx(
          'rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors hover:border-accent/60',
          tone === 'plain' && 'border-ink-700 bg-ink-850 text-ink-200',
          tone === 'warn' && 'border-warn/60 bg-warn/10 text-warn',
          tone === 'accent' && 'border-accent/60 bg-accent/10 text-accent',
          tone === 'muted' && 'border-ink-600 bg-ink-900 text-ink-300',
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
}
