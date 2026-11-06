import clsx from 'clsx';
import { History, Pause, Play, ShieldCheck, StepForward, type LucideIcon } from 'lucide-react';
import type { SituationSummary } from '../analysis-bar/situation';
import { StepBadge } from '../components/StepBadge';
import { Tooltip } from '../components/Tooltip';
import { PLAN_URL, REPO_URL, SAFETY_URL } from '../data/links';
import { formatSimClock } from '../lib/format';

/**
 * Player bar: simulation controls (Step 1) next to the replay timeline (Step 12),
 * the way a video player keeps its buttons beside the scrubber.
 */
export function TimelineBar({
  situation,
  className,
}: {
  situation: SituationSummary;
  className?: string;
}) {
  const offlineHint = situation.online ? undefined : 'Simulation controls come online in Step 1.';
  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-ink-700/70 bg-ink-900/80 px-3 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-1.5" role="group" aria-label="Simulation controls">
        <TransportButton label="Play" icon={Play} hint={offlineHint} />
        <TransportButton label="Pause" icon={Pause} hint={offlineHint} />
        <TransportButton label="Step forward" icon={StepForward} hint={offlineHint} />
        <span
          className="ml-1 rounded-md border border-ink-700 px-1.5 py-1 font-mono text-[11px] text-ink-300"
          aria-label={`Simulation speed: ${situation.speed} times real time`}
        >
          {situation.speed}×
        </span>
        <span
          className="ml-1 font-mono text-[13px] tabular-nums text-ink-100"
          aria-label="Simulation time"
        >
          {formatSimClock(situation.simTimeS)}
        </span>
      </div>
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <History aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="hidden text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-200 sm:inline">
          Timeline
        </span>
        <div className="relative h-1.5 min-w-16 flex-1 rounded-full bg-ink-800" aria-hidden="true">
          <span className="absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full border-2 border-accent bg-ink-950" />
        </div>
        <span className="hidden font-mono text-[11px] tabular-nums text-ink-300 sm:inline">
          00:00 / 00:00
        </span>
        <StepBadge step={12} />
      </div>
    </div>
  );
}

function TransportButton({
  label,
  icon: Icon,
  hint,
}: {
  label: string;
  icon: LucideIcon;
  hint?: string;
}) {
  const disabled = hint !== undefined;
  return (
    <Tooltip content={hint ?? label} side="top">
      <button
        type="button"
        aria-label={label}
        aria-disabled={disabled || undefined}
        className={clsx(
          'grid size-7 place-items-center rounded-md border border-ink-700 bg-ink-850 text-ink-200 transition-colors',
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-accent/60 hover:text-accent',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

export function Footer() {
  return (
    <footer className="shrink-0 border-t border-ink-800 px-3 py-1.5 text-[11px] text-ink-300">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="flex items-center gap-1.5">
          <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-ok" />
          Educational simulation with generic, fictional equipment and terrain. It does not model
          any real system.
        </p>
        <nav aria-label="Project links" className="flex gap-3 sm:ml-auto">
          <a className="hover:text-accent" href={PLAN_URL} target="_blank" rel="noreferrer">
            Project plan
          </a>
          <a className="hover:text-accent" href={SAFETY_URL} target="_blank" rel="noreferrer">
            Safety &amp; scope
          </a>
          <a className="hover:text-accent" href={REPO_URL} target="_blank" rel="noreferrer">
            Source code
          </a>
        </nav>
      </div>
    </footer>
  );
}
