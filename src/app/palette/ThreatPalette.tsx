import clsx from 'clsx';
import { Crosshair, MousePointerClick } from 'lucide-react';
import { AffiliationShape } from '../components/AffiliationShape';
import { Panel } from '../components/Panel';
import { TrafficIcon } from '../components/TrafficIcon';
import { AFFILIATION_STYLE } from '../data/affiliation';
import {
  altitudeBar,
  RADAR_SIZE_BAR,
  speedBar,
  TRAFFIC_CATALOG,
  type TrafficType,
} from '../data/threatCatalog';
import { formatAltitude, formatAltitudeShort, formatSpeed } from '../lib/format';

/** Cards for every kind of air traffic the user will be able to drag onto the map. */
export function ThreatPalette({ className }: { className?: string }) {
  return (
    <Panel
      title="Threat palette"
      icon={Crosshair}
      step={3}
      className={className}
      bodyClassName="overflow-y-auto"
    >
      <p className="flex items-center gap-1.5 px-3 pt-2.5 text-[11.5px] text-ink-300">
        <MousePointerClick aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
        Soon: drag a card onto the map.
      </p>
      <ul
        aria-label="Air traffic you can add"
        className="flex gap-2 overflow-x-auto p-2.5 lg:flex-col lg:gap-1.5 lg:overflow-x-visible lg:pb-6"
      >
        {TRAFFIC_CATALOG.map((type) => (
          <ThreatCard key={type.id} type={type} />
        ))}
      </ul>
      {/* Fade hinting that the list scrolls; it sits under the last card once scrolled down. */}
      <div
        aria-hidden="true"
        className="pointer-events-none sticky bottom-0 -mt-6 hidden h-6 bg-linear-to-t from-ink-900 to-transparent lg:block"
      />
    </Panel>
  );
}

function ThreatCard({ type }: { type: TrafficType }) {
  const style = AFFILIATION_STYLE[type.affiliation];
  return (
    <li className="w-64 shrink-0 lg:w-auto">
      <article
        data-traffic={type.id}
        title={type.behavior}
        className="rounded-lg border border-ink-700 bg-ink-850/80 p-2 transition-colors hover:border-ink-500 hover:bg-ink-800"
      >
        <div className="flex items-start gap-2.5">
          <div
            className={clsx(
              'grid size-10 shrink-0 place-items-center rounded-md bg-ink-950/70 ring-1 ring-inset',
              style.ring,
            )}
          >
            <TrafficIcon kind={type.id} className={clsx('size-7', style.text)} />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={clsx(
                'flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em]',
                style.text,
              )}
            >
              <AffiliationShape affiliation={type.affiliation} />
              {style.label}
            </p>
            <h3 className="truncate text-[13px] leading-tight font-semibold text-ink-100">
              {type.name}
              {type.count > 1 && (
                <span className="ml-1 font-mono text-[11px] font-normal text-ink-300">
                  ×{type.count}
                </span>
              )}
            </h3>
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-300">
              {type.insight}
            </p>
          </div>
        </div>
        <dl className="mt-1.5 grid grid-cols-3 gap-2">
          <MiniStat
            label="Speed"
            value={formatSpeed(type.speedMps)}
            fraction={speedBar(type.speedMps)}
          />
          <MiniStat
            label="Altitude"
            value={formatAltitudeShort(type.altitudeM)}
            title={formatAltitude(type.altitudeM, type.altitudeRef)}
            fraction={altitudeBar(type.altitudeM)}
          />
          <MiniStat
            label="Radar size"
            value={type.radarSize}
            fraction={RADAR_SIZE_BAR[type.radarSize]}
          />
        </dl>
      </article>
    </li>
  );
}

function MiniStat({
  label,
  value,
  fraction,
  title,
}: {
  label: string;
  value: string;
  fraction: number;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[9.5px] uppercase tracking-[0.1em] text-ink-300">{label}</dt>
      <dd className="mt-1 h-1 overflow-hidden rounded-full bg-ink-700/80" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-linear-to-r from-accent-soft to-accent"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </dd>
      <dd className="mt-1 truncate font-mono text-[10.5px] tabular-nums text-ink-200" title={title}>
        {value}
      </dd>
    </div>
  );
}
