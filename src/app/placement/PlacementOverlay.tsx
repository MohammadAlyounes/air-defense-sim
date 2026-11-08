import clsx from 'clsx';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { TrafficIcon } from '../components/TrafficIcon';
import { AFFILIATION_STYLE } from '../data/affiliation';
import { TRAFFIC_BY_ID } from '../data/threatCatalog';
import { compassPoint, formatBearing, formatIn, formatKm } from '../sim/narrator';
import { useSimController } from '../sim/simContext';
import { MAX_DROP_RANGE_M, placementFacts } from './placement';
import { usePlacementStore } from './placementStore';
import { usePlacementControls } from './usePlacement';

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Everything that floats over the page while traffic is being placed: the card under the
 * pointer, a readout of where it would go, and a hint bar in tap mode.
 */
export function PlacementOverlay() {
  usePlacementControls();
  const type = usePlacementStore((s) => s.type);
  const mode = usePlacementStore((s) => s.mode);
  const pointer = usePlacementStore((s) => s.pointer);
  const target = usePlacementStore((s) => s.target);
  const altitudeM = usePlacementStore((s) => s.altitudeM);
  if (!type) return null;
  const info = TRAFFIC_BY_ID[type];
  const style = AFFILIATION_STYLE[info.affiliation];

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50" data-testid="placement">
      {mode === 'drag' && pointer && (
        <div
          className={clsx(
            'absolute grid size-11 place-items-center rounded-lg border bg-ink-900/90 shadow-xl shadow-black/50 backdrop-blur',
            target?.valid ? 'border-accent/70' : 'border-ink-500',
          )}
          style={{ left: pointer.x - 22, top: pointer.y - 22 }}
        >
          <TrafficIcon kind={type} className={clsx('size-7', style.text)} />
        </div>
      )}

      {pointer && target && (
        <Readout
          x={pointer.x}
          y={pointer.y}
          type={type}
          altitudeM={altitudeM}
          mode={mode ?? 'tap'}
          target={target}
        />
      )}

      {mode === 'tap' && (
        <div
          role="status"
          className="pointer-events-auto absolute bottom-4 left-1/2 flex w-max max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-accent/40 bg-ink-900/95 px-3.5 py-2 text-[12.5px] text-ink-200 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <TrafficIcon kind={type} className={clsx('size-5 shrink-0', style.text)} />
          <span>
            <strong className="font-semibold text-ink-100">Placing: {info.name}.</strong> Click the
            3D view or the radar scope. Enter places it 30 km out.
          </span>
          <button
            type="button"
            onClick={() => usePlacementStore.getState().cancel()}
            className="flex items-center gap-1 rounded-md border border-ink-600 px-2 py-1 text-[11.5px] text-ink-100 hover:border-accent/60"
          >
            <X aria-hidden="true" className="size-3.5" />
            Esc
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}

function Readout({
  x,
  y,
  type,
  altitudeM,
  mode,
  target,
}: {
  x: number;
  y: number;
  type: NonNullable<ReturnType<typeof usePlacementStore.getState>['type']>;
  altitudeM: number;
  mode: 'drag' | 'tap';
  target: NonNullable<ReturnType<typeof usePlacementStore.getState>['target']>;
}) {
  const info = TRAFFIC_BY_ID[type];
  const wind = useSimController().getFrame().current.wind;
  const facts = placementFacts(type, target.at, altitudeM, undefined, wind);
  const dogLeg = facts.route.length > 1;
  const masked = facts.firstSeenM === null || facts.firstSeenM < facts.detectedFromM - 1_000;
  const tooFar = facts.rangeM > MAX_DROP_RANGE_M;
  // Keep the card on screen: flip to the left or above near the edges.
  const left = x + 300 > window.innerWidth ? x - 296 : x + 22;
  const top = y + 140 > window.innerHeight ? y - 132 : y + 22;
  return (
    <div
      data-testid="placement-readout"
      className={clsx(
        'absolute w-[17rem] rounded-lg border bg-ink-900/95 px-3 py-2 text-[11.5px] leading-snug shadow-2xl shadow-black/50 backdrop-blur',
        target.valid ? 'border-ink-600 text-ink-200' : 'border-alert/50 text-ink-300',
      )}
      style={{ left, top }}
    >
      <p className="font-semibold text-ink-100">{info.name}</p>
      {target.valid ? (
        <>
          <p className="mt-0.5 font-mono tabular-nums">
            {formatKm(facts.rangeM)} {compassPoint(facts.bearingRad)} ·{' '}
            {formatBearing(facts.bearingRad)} · {grouped.format(altitudeM)} m
          </p>
          <p className="mt-0.5">
            {dogLeg ? 'Flies a dog-leg and reaches' : 'Reaches'} the battery in{' '}
            {formatIn(facts.timeToBatteryS)} ·{' '}
            {facts.firstSeenM === null ? (
              'the radar never sees it on this route'
            ) : (
              <>the radar should see it from {formatKm(facts.firstSeenM)}</>
            )}
          </p>
          {masked && facts.firstSeenM !== null && (
            <p className="mt-0.5 text-warn" data-testid="placement-masked">
              Terrain hides it until then: over open ground it would be seen from{' '}
              {formatKm(facts.detectedFromM)}.
            </p>
          )}
          <p className="mt-1 text-[10.5px] text-ink-300">
            Scroll: altitude · {mode === 'drag' ? 'release' : 'click'} to place
          </p>
        </>
      ) : (
        <p className="mt-0.5 text-alert">
          {tooFar ? 'Outside the radar coverage (40 km).' : 'Too close to the battery.'}
        </p>
      )}
    </div>
  );
}
