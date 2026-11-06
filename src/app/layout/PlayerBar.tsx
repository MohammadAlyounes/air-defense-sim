import clsx from 'clsx';
import { History, Minus, Pause, Play, Plus, RotateCcw, Shuffle, StepForward } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { ConceptPopover } from '../components/ConceptPopover';
import { StepBadge } from '../components/StepBadge';
import { Tooltip } from '../components/Tooltip';
import { formatSimClock } from '../lib/format';
import { formatSpeedLabel, SPEED_PRESETS } from '../sim/params';
import { useSimController, useSimState } from '../sim/simContext';
import { SHORTCUTS } from '../sim/useKeyboardShortcuts';

/**
 * Player bar: simulation controls next to the replay timeline (Step 12), the way a video
 * player keeps its buttons beside the scrubber.
 */
export function PlayerBar({ className }: { className?: string }) {
  const controller = useSimController();
  const running = useSimState((s) => s.running);
  const speed = useSimState((s) => s.speed);
  const seed = useSimState((s) => s.seed);
  const tick = useSimState((s) => s.tick);
  const timeS = useSimState((s) => s.timeS);

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-700/70 bg-ink-900/80 px-3 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-1.5" role="group" aria-label="Simulation controls">
        <ControlButton
          label={running ? 'Pause' : 'Play'}
          hint={`${running ? 'Pause' : 'Play'} (${SHORTCUTS.playPause})`}
          onClick={() => controller.toggle()}
          highlight={!running}
        >
          {running ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
        </ControlButton>
        <ControlButton
          label="Step forward"
          hint={
            <>
              Advance one 20 ms tick ({SHORTCUTS.step}).
              <br />
              Hold Shift for one second.
            </>
          }
          onClick={(event) => controller.step(event.shiftKey ? 50 : 1)}
        >
          <StepForward aria-hidden="true" />
        </ControlButton>
        <div
          className="ml-1 flex items-center rounded-md border border-ink-700 bg-ink-850"
          role="group"
          aria-label="Playback speed"
        >
          <ControlButton
            label="Slower"
            hint={`Slower (${SHORTCUTS.slower})`}
            onClick={() => controller.slower()}
            disabled={speed === SPEED_PRESETS[0]}
            bare
          >
            <Minus aria-hidden="true" />
          </ControlButton>
          <span
            className="w-8 text-center font-mono text-[11px] text-ink-100"
            data-testid="sim-speed"
            aria-label={`Speed: ${speed} times real time`}
          >
            {formatSpeedLabel(speed)}
          </span>
          <ControlButton
            label="Faster"
            hint={`Faster (${SHORTCUTS.faster})`}
            onClick={() => controller.faster()}
            disabled={speed === SPEED_PRESETS.at(-1)}
            bare
          >
            <Plus aria-hidden="true" />
          </ControlButton>
        </div>
        <span
          className="ml-1 font-mono text-[13px] tabular-nums text-ink-100"
          data-testid="sim-clock"
          data-tick={tick}
          aria-label="Simulation time"
        >
          {formatSimClock(timeS)}
        </span>
        <ConceptPopover concept="fixedTimeStep" label="How the simulation clock works" />
      </div>

      <div className="flex items-center gap-1.5" role="group" aria-label="Run">
        <Tooltip content="The seed fixes every random choice in the run. Same seed, same run.">
          <span tabIndex={0} className="cursor-help font-mono text-[11px] text-ink-300">
            Seed{' '}
            <span className="text-ink-100" data-testid="sim-seed">
              {seed}
            </span>
          </span>
        </Tooltip>
        <ControlButton
          label="Restart"
          hint={`Restart this run (${SHORTCUTS.restart}). With the same seed, everything happens again exactly the same way.`}
          onClick={() => controller.restart()}
        >
          <RotateCcw aria-hidden="true" />
        </ControlButton>
        <ControlButton
          label="New seed"
          hint="Start a different run with a new random seed."
          onClick={() => controller.newSeed()}
        >
          <Shuffle aria-hidden="true" />
        </ControlButton>
      </div>

      <div className="flex min-w-48 flex-1 items-center gap-3">
        <History aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="hidden text-[11.5px] font-semibold uppercase tracking-[0.12em] text-ink-200 sm:inline">
          Timeline
        </span>
        <div className="relative h-1.5 min-w-16 flex-1 rounded-full bg-ink-800" aria-hidden="true">
          <span className="absolute top-1/2 left-0 size-3 -translate-y-1/2 rounded-full border-2 border-accent bg-ink-950" />
        </div>
        <StepBadge step={12} />
      </div>
    </div>
  );
}

function ControlButton({
  label,
  hint,
  onClick,
  disabled,
  highlight,
  bare,
  children,
}: {
  label: string;
  hint: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Draws attention to the button (Play while paused). */
  highlight?: boolean;
  /** No border, for buttons inside a group. */
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <Tooltip content={hint} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className={clsx(
          'grid size-7 place-items-center rounded-md text-ink-200 transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:size-3.5',
          !bare && 'border border-ink-700 bg-ink-850 hover:border-accent/60',
          highlight && 'border-accent/60 bg-accent/15 text-accent',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
