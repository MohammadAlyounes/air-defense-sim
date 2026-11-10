import clsx from 'clsx';
import { Crosshair, Eye, Map as MapIcon, Orbit, Tags, Umbrella } from 'lucide-react';
import type { ReactNode } from 'react';
import { ConceptPopover } from '../../components/ConceptPopover';
import { Tooltip } from '../../components/Tooltip';
import { CAMERA_MODES, useViewStore, type CameraMode } from '../../view/viewStore';
import { HEIGHT_SCALES } from './coords';

const CAMERA_ICON: Readonly<Record<CameraMode, typeof Orbit>> = {
  orbit: Orbit,
  top: MapIcon,
  follow: Crosshair,
  radar: Eye,
};

/** Camera presets, height stretch and label toggle, floating over the 3D view. */
export function ViewControls() {
  const cameraMode = useViewStore((state) => state.cameraMode);
  const hasSelection = useViewStore((state) => state.selectedId !== null);
  const heightScale = useViewStore((state) => state.heightScale);
  const showLabels = useViewStore((state) => state.showLabels);
  const showEnvelope = useViewStore((state) => state.showEnvelope);
  const setShowEnvelope = useViewStore((state) => state.setShowEnvelope);
  const { setCameraMode, setHeightScale, setShowLabels } = useViewStore.getState();

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-2 p-2">
      <Group label="Camera">
        {CAMERA_MODES.map((mode) => {
          const Icon = CAMERA_ICON[mode.id];
          const disabled = mode.id === 'follow' && !hasSelection;
          return (
            <Tooltip
              key={mode.id}
              side="bottom"
              content={
                disabled ? (
                  'Select an aircraft first, then follow it.'
                ) : (
                  <>
                    {mode.hint}. Key <Kbd>{mode.key}</Kbd>
                  </>
                )
              }
            >
              <button
                type="button"
                aria-pressed={cameraMode === mode.id}
                aria-disabled={disabled}
                data-camera={mode.id}
                onClick={() => !disabled && setCameraMode(mode.id)}
                className={segment(cameraMode === mode.id, disabled)}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                <span className="hidden sm:inline">{mode.label}</span>
                <span className="sr-only sm:hidden">{mode.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </Group>

      <div className="pointer-events-auto flex items-center gap-1.5">
        <Group label="Height stretch">
          <span className="hidden px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-300 sm:inline">
            Heights
          </span>
          {HEIGHT_SCALES.map((scale) => (
            <Tooltip
              key={scale}
              side="bottom"
              content={
                scale === 1
                  ? 'True heights: the battlespace is a thin sheet.'
                  : `Heights drawn ${scale}× taller than they are. Labels always show the true altitude.`
              }
            >
              <button
                type="button"
                aria-pressed={heightScale === scale}
                aria-label={`Heights ×${scale}`}
                onClick={() => setHeightScale(scale)}
                className={clsx(segment(heightScale === scale, false), 'font-mono')}
              >
                ×{scale}
              </button>
            </Tooltip>
          ))}
        </Group>
        <Tooltip
          side="bottom"
          content={
            <>
              Name and altitude tags. Key <Kbd>L</Kbd>
            </>
          }
        >
          <button
            type="button"
            aria-pressed={showLabels}
            aria-label="Aircraft labels"
            onClick={() => setShowLabels(!showLabels)}
            className={clsx(
              'grid size-7 place-items-center rounded-lg border bg-ink-900/85 shadow-lg shadow-black/30 backdrop-blur transition-colors',
              showLabels
                ? 'border-accent/50 text-accent'
                : 'border-ink-600 text-ink-300 hover:text-ink-100',
            )}
          >
            <Tags aria-hidden="true" className="size-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Engagement envelope: the dome the interceptors can reach within their longest planned flight, wider high up where the air is thin.">
          <button
            type="button"
            aria-pressed={showEnvelope}
            aria-label="Engagement envelope"
            data-envelope-toggle
            onClick={() => setShowEnvelope(!showEnvelope)}
            className={clsx(
              'grid size-7 place-items-center rounded-lg border bg-ink-900/85 shadow-lg shadow-black/30 backdrop-blur transition-colors',
              showEnvelope
                ? 'border-accent/50 text-accent'
                : 'border-ink-600 text-ink-300 hover:text-ink-100',
            )}
          >
            <Umbrella aria-hidden="true" className="size-3.5" />
          </button>
        </Tooltip>
        <div className="flex rounded-lg border border-ink-600 bg-ink-900/85 shadow-lg shadow-black/30 backdrop-blur">
          <ConceptPopover concept="engagementEnvelope" label="Where the battery can reach" />
          <ConceptPopover concept="airDrag" label="Why reach depends on altitude" />
          <ConceptPopover concept="seeingScale" label="Why heights are stretched" />
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-ink-600 bg-ink-900/85 p-0.5 shadow-lg shadow-black/30 backdrop-blur"
    >
      {children}
    </div>
  );
}

const segment = (active: boolean, disabled: boolean) =>
  clsx(
    'flex h-6 items-center gap-1.5 rounded-md px-2 text-[11.5px] font-medium transition-colors',
    active ? 'bg-accent/15 text-accent' : 'text-ink-200 hover:text-ink-100',
    disabled && 'cursor-not-allowed opacity-40 hover:text-ink-200',
  );

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-ink-500 bg-ink-900 px-1 font-mono text-[10.5px] text-ink-100">
      {children}
    </kbd>
  );
}
