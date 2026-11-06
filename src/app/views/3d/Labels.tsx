import { useFrame } from '@react-three/fiber';
import clsx from 'clsx';
import { memo, useCallback, useRef, type ReactNode } from 'react';
import { TRAFFIC_BY_ID } from '../../data/threatCatalog';
import { formatAltitudeShort } from '../../lib/format';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { AFFILIATION_COLOR } from './aircraftModels';
import { toScene } from './coords';
import { interpolated, useAircraftRoster, type RosterEntry } from './frame';
import { anchorLabel, projectLabels } from './labelAnchors';
import {
  COMPASS_RADIUS_KM,
  RADAR_RANGE_KM,
  RING_LABEL_BEARING_RAD,
  RING_STEP_KM,
} from './sceneConstants';

/** Inside the canvas: moves the labels after the camera and the aircraft have moved. */
export function LabelProjector() {
  useFrame(({ camera, size }) => projectLabels(camera, size.width, size.height));
  return null;
}

/**
 * Text over the 3D view: aircraft name tags, range ring distances and compass letters.
 * Mouse users can click a tag; keyboard and screen-reader users have the event log and the
 * inspector, so the layer is hidden from assistive technology.
 */
export function LabelLayer() {
  return (
    // `isolate`: the labels stack among themselves, always below the view's controls.
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 isolate overflow-hidden"
    >
      <GroundLabels />
      <AircraftLabels />
    </div>
  );
}

const RINGS = Array.from(
  { length: RADAR_RANGE_KM / RING_STEP_KM },
  (_, i) => (i + 1) * RING_STEP_KM,
);
const COMPASS = [
  ['N', 0, -1],
  ['E', 1, 0],
  ['S', 0, 1],
  ['W', -1, 0],
] as const;

function GroundLabels() {
  const sin = Math.sin(RING_LABEL_BEARING_RAD);
  const cos = Math.cos(RING_LABEL_BEARING_RAD);
  return (
    <>
      {RINGS.map((radius) => (
        <FixedLabel key={radius} x={radius * sin} y={0.05} z={-radius * cos}>
          <span className="font-mono text-[10px] text-ink-300/80">{radius} km</span>
        </FixedLabel>
      ))}
      {COMPASS.map(([letter, x, z]) => (
        <FixedLabel key={letter} x={x * COMPASS_RADIUS_KM} y={0.05} z={z * COMPASS_RADIUS_KM}>
          <span className="font-mono text-[12px] font-semibold text-accent/80">{letter}</span>
        </FixedLabel>
      ))}
    </>
  );
}

/** A label pinned to a fixed point of the scene, centred on it. */
function FixedLabel({
  x,
  y,
  z,
  children,
}: {
  x: number;
  y: number;
  z: number;
  children: ReactNode;
}) {
  const anchor = useCallback(
    (element: HTMLDivElement | null) =>
      element ? anchorLabel(element, (out) => !!out.set(x, y, z)) : undefined,
    [x, y, z],
  );
  return (
    <div ref={anchor} className="invisible absolute top-0 left-0">
      <div className="-translate-x-1/2 -translate-y-1/2 whitespace-nowrap">{children}</div>
    </div>
  );
}

function AircraftLabels() {
  const roster = useAircraftRoster();
  const showLabels = useViewStore((state) => state.showLabels);
  const selectedId = useViewStore((state) => state.selectedId);
  return (
    <>
      {roster
        .filter((entry) => showLabels || entry.id === selectedId)
        .map(({ key, id, type, affiliation }) => (
          <AircraftLabel
            key={key}
            id={id}
            type={type}
            affiliation={affiliation}
            selected={id === selectedId}
          />
        ))}
    </>
  );
}

/** Name and true altitude, just above the aircraft. Clicking it selects the aircraft. */
const AircraftLabel = memo(function AircraftLabel({
  id,
  type,
  affiliation,
  selected,
}: Omit<RosterEntry, 'key'> & { selected: boolean }) {
  const controller = useSimController();
  const altitude = useRef<HTMLSpanElement>(null);

  const anchor = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return;
      let shown = '';
      return anchorLabel(
        element,
        (out) => {
          const entry = interpolated(controller.getFrame()).byId.get(id);
          if (!entry) return false;
          // Labels always show the true altitude, whatever the height stretch.
          const text = formatAltitudeShort(Math.round(entry.position.z / 10) * 10);
          if (text !== shown && altitude.current) {
            shown = text;
            altitude.current.textContent = text;
          }
          out.set(...toScene(entry.position, useViewStore.getState().heightScale));
          return true;
        },
        selected,
      );
    },
    [controller, id, selected],
  );

  return (
    <div ref={anchor} className="invisible absolute top-0 left-0" data-aircraft-label={id}>
      <button
        type="button"
        tabIndex={-1}
        onClick={() => useViewStore.getState().select(id)}
        className={clsx(
          'pointer-events-auto flex -translate-x-1/2 -translate-y-[calc(100%+18px)] items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10.5px] leading-none shadow-lg shadow-black/40 backdrop-blur-sm transition-colors',
          selected
            ? 'border-ink-100/70 bg-ink-900/90 text-ink-100'
            : 'border-ink-600/70 bg-ink-950/70 text-ink-200 hover:border-ink-400',
        )}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: AFFILIATION_COLOR[affiliation] }}
        />
        <span className="font-sans font-semibold">{TRAFFIC_BY_ID[type].shortName}</span>
        <span ref={altitude} className="tabular-nums text-ink-300" />
      </button>
    </div>
  );
});
