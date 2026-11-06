import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Tooltip } from '../components/Tooltip';
import { STAGES, type StageId } from '../data/stages';

interface PipelineChipsProps {
  counts: Readonly<Record<StageId, number>>;
  online: boolean;
  className?: string;
}

/** The seven-stage defense loop with a live count of tracks in each stage. */
export function PipelineChips({ counts, online, className }: PipelineChipsProps) {
  return (
    <nav aria-label="Defense loop stages" className={clsx('overflow-x-auto', className)}>
      <ol className="flex w-max items-center gap-1 lg:mx-auto">
        {STAGES.map((stage, index) => {
          const count = counts[stage.id];
          const active = online && count > 0;
          return (
            <li key={stage.id} className="flex items-center gap-1">
              <Tooltip
                content={
                  <>
                    <strong className="text-accent">{stage.label}</strong>
                    <br />
                    {stage.description}
                  </>
                }
              >
                <button
                  type="button"
                  data-stage={stage.id}
                  className={clsx(
                    'flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors',
                    active
                      ? 'border-accent/60 bg-accent/10 text-accent'
                      : 'border-ink-700 bg-ink-900 text-ink-300 hover:border-ink-500 hover:text-ink-100',
                  )}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-[0.1em]">
                    {stage.label}
                  </span>
                  <span
                    className={clsx(
                      'min-w-5 rounded px-1 text-center font-mono text-[11px] tabular-nums',
                      active ? 'bg-accent/20 text-accent' : 'bg-ink-800 text-ink-300',
                    )}
                  >
                    {online ? count : '—'}
                  </span>
                </button>
              </Tooltip>
              {index < STAGES.length - 1 && (
                <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-ink-500" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
