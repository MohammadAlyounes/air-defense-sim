import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Tooltip } from '../components/Tooltip';
import { formatCountdown } from '../lib/format';
import {
  OPERATOR_MODE_HELP,
  OPERATOR_MODE_LABEL,
  WEAPONS_CONTROL_HELP,
  type SituationSummary,
} from './situation';

/** Second row of the analysis bar: key numbers plus the plain-language NOW line. */
export function KpiStrip({ situation: s }: { situation: SituationSummary }) {
  const value = (n: number) => (s.online ? String(n) : '—');
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-ink-800/80 px-3 py-1.5 text-[12px]">
      {/* Phones get the pipeline and the NOW line only; the numbers start at tablet width. */}
      <div className="hidden flex-wrap items-center gap-x-5 gap-y-1.5 md:flex">
        <KpiGroup situation={s} value={value} />
      </div>
      <p
        className="flex min-w-0 basis-full items-center gap-2 xl:basis-0 xl:flex-1"
        aria-live="polite"
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

function KpiGroup({
  situation: s,
  value,
}: {
  situation: SituationSummary;
  value: (n: number) => string;
}) {
  return (
    <>
      <Kpi label="Threats">
        <Num value={value(s.threats.active)} unit="active" />
        <Num value={value(s.threats.down)} unit="down" tone={s.online ? 'ok' : undefined} />
        <Num value={value(s.threats.leaked)} unit="leaked" tone={s.online ? 'alert' : undefined} />
      </Kpi>
      <Kpi label="Interceptors">
        <Num value={value(s.interceptors.ready)} unit="ready" />
        <Num value={value(s.interceptors.flying)} unit="flying" />
        <Num value={value(s.interceptors.used)} unit="used" />
      </Kpi>
      <Kpi
        label="Fire channels"
        hint="Each tracking-radar channel can guide one engagement at a time. When every channel is busy, new threats have to wait: that is saturation."
      >
        <ChannelMeter used={s.channels.used} total={s.channels.total} online={s.online} />
      </Kpi>
      <Kpi label="Next impact" hint="Time until the most urgent threat reaches a defended asset.">
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
          label={`WCS ${s.weaponsControl}`}
          hint={WEAPONS_CONTROL_HELP[s.weaponsControl]}
        />
        <DoctrineBadge
          label={OPERATOR_MODE_LABEL[s.operatorMode]}
          hint={OPERATOR_MODE_HELP[s.operatorMode]}
        />
      </div>
    </>
  );
}

function Kpi({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const text = (
    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-300">
      {label}
    </span>
  );
  return (
    <div className="flex items-center gap-2">
      {hint ? (
        <Tooltip content={hint}>
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

function Num({ value, unit, tone }: { value: string; unit: string; tone?: 'ok' | 'alert' }) {
  return (
    <span className="flex items-baseline gap-1">
      <span
        className={clsx(
          'font-mono tabular-nums',
          tone === 'ok' ? 'text-ok' : tone === 'alert' ? 'text-alert' : 'text-ink-100',
        )}
      >
        {value}
      </span>
      <span className="text-ink-300">{unit}</span>
    </span>
  );
}

function ChannelMeter({ used, total, online }: { used: number; total: number; online: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-3 w-1.5 rounded-sm',
              online && i < used ? 'bg-accent' : 'bg-ink-700',
            )}
          />
        ))}
      </span>
      <span className="font-mono tabular-nums text-ink-100">
        {online ? `${used}/${total}` : '—'}
      </span>
    </span>
  );
}

function DoctrineBadge({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip content={hint}>
      <span
        tabIndex={0}
        className="cursor-help rounded-md border border-ink-700 bg-ink-850 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-200"
      >
        {label}
      </span>
    </Tooltip>
  );
}
