import clsx from 'clsx';
import { useEffect, useRef, type MouseEvent } from 'react';
import { ConceptPopover } from '../components/ConceptPopover';
import { Tooltip } from '../components/Tooltip';
import { placementFacts } from '../placement/placement';
import { registerDropZone, usePlacementStore } from '../placement/placementStore';
import { useSimController } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';
import { COVERAGE_VIEWS, worldCoverage, worldTerrain, type CoverageView } from '../world/world';
import {
  CLUTTER_RGB,
  createCoverageLayer,
  createScopeLayout,
  drawPlacement,
  drawScope,
  groundPointAt,
  IDENTITY_COLOR,
  pickEcho,
  type ScopeLayout,
} from './scopeRenderer';

/** A placement ripple lasts this long, milliseconds. */
const RIPPLE_MS = 1_200;

/**
 * The live radar scope: redrawn every animation frame from the latest simulation snapshots.
 * Clicking an echo selects the aircraft behind it, everywhere in the console.
 */
export function RadarScope() {
  const controller = useSimController();
  const selectedId = useViewStore((state) => state.selectedId);
  const coverage = useViewStore((state) => state.coverage);
  const compareTruth = useViewStore((state) => state.compareTruth);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<ScopeLayout | null>(null);
  /** Coverage layers for the current layout, one per target height (and one for clutter). */
  const coverageRef = useRef(new Map<CoverageView, HTMLCanvasElement>());

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!container || !canvas || !ctx) return;

    const coverageLayer = (layout: ScopeLayout, view: CoverageView | null) => {
      if (view === null) return null;
      let layer = coverageRef.current.get(view);
      if (!layer) {
        layer = createCoverageLayer(layout, worldCoverage(), view);
        coverageRef.current.set(view, layer);
      }
      return layer;
    };
    const draw = () => {
      const layout = layoutRef.current;
      if (!layout) return;
      const view = useViewStore.getState();
      drawScope(
        ctx,
        layout,
        controller.getFrame(),
        view.selectedId,
        coverageLayer(layout, view.coverage),
        view.compareTruth,
      );
      const { type, target, lastDrop, altitudeM } = usePlacementStore.getState();
      const facts =
        type && target
          ? placementFacts(
              type,
              target.at,
              altitudeM,
              undefined,
              controller.getFrame().current.wind,
            )
          : null;
      const ghost =
        type && target && facts
          ? {
              type,
              at: target.at,
              valid: target.valid,
              timeToBatteryS: facts.timeToBatteryS,
              corridorName: facts.corridor?.name ?? null,
              route: facts.route,
            }
          : null;
      const ripple = lastDrop
        ? { at: lastDrop.at, progress: (performance.now() - lastDrop.atMs) / RIPPLE_MS }
        : null;
      drawPlacement(ctx, layout, ghost, ripple);
    };
    const resize = () => {
      const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
      if (size <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      layoutRef.current = createScopeLayout(
        size,
        dpr,
        controller.getFrame().current.radar.rangeM,
        undefined,
        worldTerrain(),
      );
      coverageRef.current.clear();
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    // Traffic can be dropped onto the scope, inside the radar's coverage.
    const unregisterZone = registerDropZone('scope', (clientX, clientY) => {
      const layout = layoutRef.current;
      if (!layout) return null;
      const box = canvas.getBoundingClientRect();
      return groundPointAt(layout, clientX - box.left, clientY - box.top);
    });
    const unsubscribeFrames = controller.onFrame(draw);
    // Redraw at once when the selection changes, even while paused.
    const unsubscribeView = useViewStore.subscribe(draw);
    return () => {
      observer.disconnect();
      unsubscribeFrames();
      unsubscribeView();
      unregisterZone();
    };
  }, [controller]);

  /** The aircraft behind the echo under the pointer, if any. */
  const echoAt = (event: MouseEvent<HTMLCanvasElement>): number | null => {
    const layout = layoutRef.current;
    if (!layout) return null;
    const box = event.currentTarget.getBoundingClientRect();
    const { previous, current, alpha } = controller.getFrame();
    const timeS = previous.timeS + (current.timeS - previous.timeS) * alpha;
    return pickEcho(current, timeS, layout, event.clientX - box.left, event.clientY - box.top);
  };

  return (
    <div
      ref={containerRef}
      className="relative grid aspect-square max-h-[24rem] w-full place-items-center lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <canvas
        ref={canvasRef}
        data-testid="radar-scope"
        data-selected={selectedId ?? ''}
        data-coverage={coverage ?? ''}
        data-truth={compareTruth ? 'on' : 'off'}
        data-drop-zone="scope"
        role="img"
        aria-label="Radar scope: the battery at the centre, north up, range rings every 10 km over a faint relief map, with echoes from aircraft the beam has swept past. Click an echo to inspect the aircraft."
        onClick={(event) => useViewStore.getState().select(echoAt(event))}
        onMouseMove={(event) => {
          event.currentTarget.style.cursor = echoAt(event) === null ? '' : 'pointer';
        }}
      />
    </div>
  );
}

const DIAMOND = 'M6 1.5 10.5 6 6 10.5 1.5 6Z';
/** Four half-circle lobes, as on the scope (`traceIdentityShape`). */
const QUATREFOIL =
  'M3.75 3.75A2.25 2.25 0 0 1 8.25 3.75A2.25 2.25 0 0 1 8.25 8.25A2.25 2.25 0 0 1 3.75 8.25A2.25 2.25 0 0 1 3.75 3.75Z';

const LEGEND = [
  { label: 'hostile', color: IDENTITY_COLOR.hostile, shape: DIAMOND },
  { label: 'suspect', color: IDENTITY_COLOR.suspect, shape: DIAMOND, dashed: true },
  { label: 'unknown', color: IDENTITY_COLOR.unknown, shape: QUATREFOIL },
  {
    label: 'friend',
    color: IDENTITY_COLOR.friend,
    shape: 'M6 1.8a4.2 4.2 0 1 1 0 8.4 4.2 4.2 0 0 1 0-8.4Z',
  },
  { label: 'civil', color: IDENTITY_COLOR.neutral, shape: 'M2.2 2.2h7.6v7.6H2.2Z' },
  { label: 'identifying', color: IDENTITY_COLOR.pending, shape: QUATREFOIL, dashed: true },
] as const;

const COVERAGE_LABEL: Readonly<Record<CoverageView, string>> = {
  50: '50 m',
  300: '300 m',
  1000: '1 km',
  clutter: 'clutter',
};

/**
 * The coverage overlay switch: shade where the radar cannot see a target flying at a chosen
 * height above the ground, behind hills or below the horizon, or the ground it lights, where
 * slow and crossing targets are filtered out with the clutter. Shared with the 3D view.
 */
export function CoverageControl() {
  const coverage = useViewStore((state) => state.coverage);
  const setCoverage = useViewStore((state) => state.setCoverage);
  const options: readonly (CoverageView | null)[] = [null, ...COVERAGE_VIEWS];
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-ink-300">
      <Tooltip content="Shade where the radar cannot see a target flying this high above the ground: behind hills, or below the radar horizon. 'clutter' shades the ground the radar lights instead: there a target closing or opening slower than 10 m/s is filtered out with the ground's echo. Also shown on the 3D terrain.">
        <span tabIndex={0} className="cursor-help font-medium text-ink-200">
          Blind zones
        </span>
      </Tooltip>
      <div
        role="radiogroup"
        aria-label="Blind zones for a target flying at"
        className="flex rounded-md border border-ink-700 bg-ink-950/60 p-0.5"
      >
        {options.map((option) => {
          const active = option === coverage;
          return (
            <button
              key={option ?? 'off'}
              type="button"
              role="radio"
              aria-checked={active}
              data-coverage-option={option ?? 'off'}
              onClick={() => setCoverage(option)}
              className={clsx(
                'rounded px-1.5 py-0.5 font-mono text-[10.5px] transition-colors',
                active ? 'bg-accent/20 text-accent' : 'text-ink-300 hover:text-ink-100',
              )}
            >
              {option === null ? 'off' : COVERAGE_LABEL[option]}
            </button>
          );
        })}
      </div>
      {coverage === 'clutter' ? (
        <ConceptPopover
          concept="clutterDoppler"
          label="Why slow and crossing targets vanish over lit ground"
        />
      ) : (
        <ConceptPopover concept="terrainMasking" label="Why low flyers can hide behind hills" />
      )}
      <TruthToggle />
    </div>
  );
}

/** Truth vs. perception: shows where aircraft really are next to the battery's tracks. */
function TruthToggle() {
  const compareTruth = useViewStore((state) => state.compareTruth);
  const setCompareTruth = useViewStore((state) => state.setCompareTruth);
  return (
    <Tooltip content="Truth vs. perception (T): grey crosses show where aircraft really are, dashed lines the tracking error, and the 3D view adds the battery's tracks next to the truth.">
      <button
        type="button"
        aria-pressed={compareTruth}
        data-truth-toggle
        onClick={() => setCompareTruth(!compareTruth)}
        className={clsx(
          'rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] transition-colors',
          compareTruth
            ? 'border-accent/60 bg-accent/15 text-accent'
            : 'border-ink-700 bg-ink-950/60 text-ink-300 hover:text-ink-100',
        )}
      >
        truth
      </button>
    </Tooltip>
  );
}

/** What the scope's symbols mean, in one line. */
export function ScopeLegend() {
  const coverage = useViewStore((state) => state.coverage);
  const compareTruth = useViewStore((state) => state.compareTruth);
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10.5px] text-ink-300">
      {LEGEND.map((item) => (
        <li key={item.label} className="flex items-center gap-1">
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
            <path
              d={item.shape}
              fill="none"
              stroke={item.color}
              strokeWidth="1.5"
              strokeDasharray={'dashed' in item ? '2 1.6' : undefined}
            />
          </svg>
          {item.label}
        </li>
      ))}
      <li className="flex items-center gap-1">
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
          <path d="M3 3 9 9M9 3 3 9" stroke="#22d3ee" strokeWidth="1.5" />
        </svg>
        predicted intercept
      </li>
      <li className="flex items-center gap-1">
        <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden="true">
          <path d="M1 6h14" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="2.5 2" />
        </svg>
        defended assets
      </li>
      <li className="flex items-center gap-1">
        <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden="true">
          <rect x="0.5" y="3" width="15" height="6" fill="#4ade80" fillOpacity="0.12" />
          <path d="M0.5 3h15M0.5 9h15" stroke="#4ade80" strokeOpacity="0.6" strokeDasharray="3 2" />
        </svg>
        civil corridor
      </li>
      <li className="flex items-center gap-1">
        <svg viewBox="0 0 16 12" className="h-3 w-4" aria-hidden="true">
          <ellipse cx="8" cy="6" rx="6.5" ry="3" fill="none" stroke="#facc15" strokeOpacity="0.7" />
        </svg>
        uncertainty (2σ)
      </li>
      {compareTruth && (
        <li className="flex items-center gap-1">
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden="true">
            <path d="M6 2v8M2 6h8" stroke="#cbd5e1" strokeWidth="1.5" />
          </svg>
          true position
        </li>
      )}
      {coverage === 'clutter' && (
        <li className="flex items-center gap-1">
          <span
            className="size-3 rounded-sm"
            style={{ backgroundColor: `rgba(${CLUTTER_RGB.join(', ')}, 0.5)` }}
            aria-hidden="true"
          />
          lit ground (clutter)
        </li>
      )}
      {coverage !== null && coverage !== 'clutter' && (
        <li className="flex items-center gap-1">
          <span className="size-3 rounded-sm bg-[rgba(251,146,60,0.45)]" aria-hidden="true" />
          blind below {COVERAGE_LABEL[coverage]}
        </li>
      )}
    </ul>
  );
}
