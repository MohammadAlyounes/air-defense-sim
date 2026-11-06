import clsx from 'clsx';
import { GithubMark, LogoMark } from '../components/marks';
import { Tooltip } from '../components/Tooltip';
import { AUTHOR, REPO_URL, ROADMAP_URL } from '../data/links';
import { CURRENT_STEP, LAST_STEP, roadmapStep } from '../data/roadmap';
import { KpiStrip } from './KpiStrip';
import { PipelineChips } from './PipelineChips';
import type { SituationSummary } from './situation';

/** The always-visible header: brand, defense-loop pipeline and key numbers. */
export function AnalysisBar({ situation }: { situation: SituationSummary }) {
  return (
    <header className="z-30 shrink-0 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 pt-2 pb-1.5 lg:flex-nowrap">
        <Brand />
        <PipelineChips
          counts={situation.stageCounts}
          online={situation.online}
          className="order-last w-full lg:order-none lg:w-auto lg:min-w-0 lg:flex-1"
        />
        <BuildProgress className="ml-auto lg:ml-0" />
      </div>
      <KpiStrip situation={situation} />
    </header>
  );
}

/** Logo, title and the author credit. The credit is a fixed part of the header on every screen. */
function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <LogoMark className="size-7 text-accent" />
      <div className="leading-tight">
        <h1 className="text-[14px] font-semibold tracking-tight text-ink-100">
          Air Defense Simulator
        </h1>
        <p className="text-[11px] text-ink-300" data-testid="author-credit">
          Created by{' '}
          <a
            href={AUTHOR.url}
            target="_blank"
            rel="noreferrer author"
            className="font-semibold text-ink-100 transition-colors hover:text-accent"
          >
            {AUTHOR.name}
          </a>
        </p>
      </div>
    </div>
  );
}

function BuildProgress({ className }: { className?: string }) {
  const current = roadmapStep(CURRENT_STEP);
  const next = roadmapStep(CURRENT_STEP + 1);
  return (
    <div className={clsx('flex shrink-0 items-center gap-2', className)}>
      <Tooltip
        content={
          next ? (
            <>
              Building in public. Next up:{' '}
              <strong className="text-accent">
                Step {next.step} · {next.title}
              </strong>
              . {next.summary}
            </>
          ) : (
            'Every step on the roadmap is complete.'
          )
        }
      >
        <a
          href={ROADMAP_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] text-ink-200 transition-colors hover:border-accent/50"
        >
          <span className="relative flex size-2" aria-hidden="true">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn/60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-warn" />
          </span>
          <span className="hidden 2xl:inline">Building in public</span>
          <span className="font-mono text-ink-300">
            Step {CURRENT_STEP}/{LAST_STEP}
            {current && <span className="hidden sm:inline"> · {current.title}</span>}
          </span>
        </a>
      </Tooltip>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Source code on GitHub"
        className="grid size-7 place-items-center rounded-md border border-ink-700 bg-ink-850 text-ink-200 transition-colors hover:border-accent/50 hover:text-accent"
      >
        <GithubMark className="size-3.5" />
      </a>
    </div>
  );
}
