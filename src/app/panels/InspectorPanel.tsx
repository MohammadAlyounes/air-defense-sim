import clsx from 'clsx';
import { ChevronRight, Crosshair, ScanSearch, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { AffiliationShape } from '../components/AffiliationShape';
import { ConceptPopover } from '../components/ConceptPopover';
import { Panel } from '../components/Panel';
import { StepBadge } from '../components/StepBadge';
import { Tooltip } from '../components/Tooltip';
import { TrafficIcon } from '../components/TrafficIcon';
import { AFFILIATION_STYLE } from '../data/affiliation';
import { TRAFFIC_BY_ID } from '../data/threatCatalog';
import { useSimController } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';
import { aircraftFacts, type AircraftFacts, type FactTone } from './aircraftFacts';

const TONE: Readonly<Record<FactTone, string>> = {
  plain: 'text-ink-100',
  accent: 'text-accent',
  ok: 'text-ok',
  warn: 'text-warn',
  alert: 'text-alert',
};

const UPDATE_MS = 100;

/** Live facts about one aircraft, refreshed about ten times per second. */
function useAircraftFacts(id: number): AircraftFacts | null {
  const controller = useSimController();
  const [facts, setFacts] = useState(() => aircraftFacts(controller.getFrame().current, id));
  useEffect(() => {
    let lastKey = '';
    let lastMs = Number.NEGATIVE_INFINITY;
    return controller.onFrame((frame) => {
      const nowMs = performance.now();
      if (nowMs - lastMs < UPDATE_MS) return;
      lastMs = nowMs;
      const next = aircraftFacts(frame.current, id);
      const key = JSON.stringify(next);
      if (key === lastKey) return;
      lastKey = key;
      setFacts(next);
    });
  }, [controller, id]);
  return facts;
}

const LATER = [
  'Identity, and the evidence behind it',
  'Threat score, factor by factor',
  'Why this launcher, and the chance of a hit',
] as const;

/** What the selected aircraft is and what it is doing; "why the system acts" comes in Step 6. */
export function InspectorPanel() {
  const selectedId = useViewStore((state) => state.selectedId);
  return (
    <Panel
      title="Inspector · Why?"
      icon={ScanSearch}
      panelId="inspector"
      bodyClassName="overflow-y-auto"
      actions={
        <ConceptPopover
          concept="proportionalNavigation"
          label="How an interceptor steers to its target"
        />
      }
    >
      {selectedId === null ? <Empty /> : <Details key={selectedId} id={selectedId} />}
    </Panel>
  );
}

function Empty() {
  return (
    <div className="space-y-2.5 p-3 text-[12px] leading-relaxed text-ink-300">
      <p>
        Click an aircraft in the 3D view, an echo on the radar scope or a line in the event log to
        see what it is and what it is doing.
      </p>
      <div>
        <p className="flex items-center gap-2 text-[11px] text-ink-300">
          Then, <strong className="font-semibold text-ink-100">why</strong> the system acts:
          <StepBadge step={6} />
        </p>
        <ul className="mt-1.5 space-y-1">
          {LATER.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Details({ id }: { id: number }) {
  const facts = useAircraftFacts(id);
  const following = useViewStore((state) => state.cameraMode === 'follow');
  const { select, setCameraMode } = useViewStore.getState();

  if (!facts) {
    return <p className="p-3 text-[12px] text-ink-300">This aircraft has left the area.</p>;
  }
  const style = AFFILIATION_STYLE[facts.affiliation];
  return (
    <div className="flex flex-col gap-2.5 p-3" data-testid="inspector" data-aircraft={id}>
      <div className="flex items-start gap-2.5">
        <div
          className={clsx(
            'grid size-9 shrink-0 place-items-center rounded-md bg-ink-950/70 ring-1 ring-inset',
            style.ring,
          )}
        >
          <TrafficIcon kind={facts.type} className={clsx('size-6', style.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={clsx(
              'flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em]',
              style.text,
            )}
          >
            <AffiliationShape affiliation={facts.affiliation} />
            {style.label}
            <span className="font-medium text-ink-300">· ground truth</span>
          </p>
          <h3 className="truncate text-[14px] leading-tight font-semibold text-ink-100">
            {TRAFFIC_BY_ID[facts.type].name}
          </h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="Fly behind it in the 3D view (key 3)">
            <button
              type="button"
              aria-pressed={following}
              onClick={() => setCameraMode(following ? 'orbit' : 'follow')}
              className={clsx(
                'flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium transition-colors',
                following
                  ? 'border-accent/60 bg-accent/15 text-accent'
                  : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-accent/60 hover:text-accent',
              )}
            >
              <Crosshair aria-hidden="true" className="size-3.5" />
              Follow
            </button>
          </Tooltip>
          <Tooltip content="Clear the selection (Esc)">
            <button
              type="button"
              aria-label="Clear the selection"
              onClick={() => select(null)}
              className="grid size-7 place-items-center rounded-md border border-ink-700 bg-ink-850 text-ink-200 transition-colors hover:border-accent/60 hover:text-accent"
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-2">
        <Fact label="Speed" value={facts.speed} detail={facts.speedKmh} />
        <Fact label="Altitude" value={facts.altitude} detail={facts.altitudeRef} />
        <Fact label="Heading" value={facts.heading} detail={facts.headingPoint} />
        <Fact label="Range" value={facts.range} detail={facts.bearing} />
        <Fact label="Track" value={facts.track} detail={facts.trackDetail} />
        <Fact
          label="Defense"
          value={facts.defense}
          detail={facts.defenseDetail}
          tone={TONE[facts.defenseTone]}
        />
        <Fact
          label="Radar view"
          value={facts.radarView}
          detail={facts.radarViewDetail}
          tone={TONE[facts.radarViewTone]}
          wide
        />
      </dl>
    </div>
  );
}

function Fact({
  label,
  value,
  detail,
  tone = 'text-ink-100',
  wide = false,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  tone?: string;
  /** Spans the whole row. */
  wide?: boolean;
}) {
  return (
    <div className={clsx('min-w-0', wide && 'col-span-3')} data-fact={label}>
      <dt className="truncate text-[9.5px] uppercase tracking-[0.1em] text-ink-300">{label}</dt>
      <dd className={clsx('truncate font-mono text-[12px] tabular-nums', tone)}>{value}</dd>
      {detail && <dd className="truncate text-[10.5px] text-ink-300">{detail}</dd>}
    </div>
  );
}
