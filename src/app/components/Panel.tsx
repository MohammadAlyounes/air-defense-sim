import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { StepBadge } from './StepBadge';

interface PanelProps {
  title: string;
  icon?: LucideIcon;
  /** Roadmap step in which this panel comes to life (shows an "arrives in" badge). */
  step?: number;
  subtitle?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** The frame every console panel shares: icon, title, optional step badge, body. */
export function Panel({
  title,
  icon: Icon,
  step,
  subtitle,
  className,
  bodyClassName,
  children,
}: PanelProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={clsx(
        'flex min-h-0 flex-col overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/80 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.03)]',
        className,
      )}
    >
      <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-ink-800 px-3 py-2">
        {Icon && <Icon aria-hidden="true" className="size-4 shrink-0 text-accent" />}
        <h2
          id={headingId}
          className="shrink-0 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-200"
        >
          {title}
        </h2>
        {subtitle && <span className="truncate text-[11px] text-ink-300">{subtitle}</span>}
        {step !== undefined && <StepBadge step={step} className="ml-auto" />}
      </header>
      <div className={clsx('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
