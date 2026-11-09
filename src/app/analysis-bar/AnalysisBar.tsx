import clsx from 'clsx';
import { GithubMark, LogoMark } from '../components/marks';
import { Tooltip } from '../components/Tooltip';
import { BUILD_STEPS, VERSION } from '../data/buildHistory';
import { AUTHOR, BUILD_LOG_URL, REPO_URL } from '../data/links';
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
          className="order-last w-full lg:order-none lg:w-auto lg:min-w-0 lg:flex-1"
        />
        <ProjectLinks className="ml-auto lg:ml-0" />
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

/** The version pill (it links to the build log) and the source-code link. */
function ProjectLinks({ className }: { className?: string }) {
  return (
    <div className={clsx('flex shrink-0 items-center gap-2', className)}>
      <Tooltip
        content={
          <>
            <strong className="text-accent">Version {VERSION}</strong>, complete. Built in{' '}
            {BUILD_STEPS.length} steps, from the launchpad to tracking, identification and the rules
            of engagement. Every step is a tagged release with its own build-log entry.
          </>
        }
      >
        <a
          href={BUILD_LOG_URL}
          target="_blank"
          rel="noreferrer"
          data-testid="version-pill"
          className="flex items-center gap-2 rounded-full border border-ink-700 bg-ink-850 px-2.5 py-1 text-[11px] text-ink-200 transition-colors hover:border-accent/50"
        >
          <span aria-hidden="true" className="inline-flex size-2 rounded-full bg-ok" />
          <span className="font-mono text-ink-300">
            v{VERSION}
            <span className="hidden sm:inline"> · Complete</span>
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
