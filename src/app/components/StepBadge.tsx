import clsx from 'clsx';
import { roadmapStep } from '../data/roadmap';
import { Tooltip } from './Tooltip';

/** "Arrives in Step N" marker for features that are still on the roadmap. */
export function StepBadge({ step, className }: { step: number; className?: string }) {
  const entry = roadmapStep(step);
  return (
    <Tooltip
      content={
        <>
          Arrives in <strong className="text-accent">Step {step}</strong>
          {entry ? ` · ${entry.title}. ${entry.summary}` : ''}
        </>
      }
    >
      <span
        tabIndex={0}
        className={clsx(
          'inline-flex shrink-0 cursor-help items-center gap-1.5 rounded-full border border-ink-600 bg-ink-850 px-2 py-0.5 font-mono text-[10px] font-medium text-ink-300',
          className,
        )}
      >
        <span aria-hidden="true" className="size-1.5 rounded-full bg-warn/80" />
        Step {step}
      </span>
    </Tooltip>
  );
}
