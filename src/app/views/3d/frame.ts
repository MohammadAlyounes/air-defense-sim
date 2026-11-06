import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { Affiliation, AircraftType, Snapshot } from '../../../sim';
import type { RenderFrame } from '../../sim/SimController';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { interpolateAircraft, type InterpolatedAircraft } from './coords';

/**
 * Glue between the simulation driver and the 3D canvas. The canvas renders on demand, so it
 * draws a new frame only when the simulation moves, the view settings change or the camera
 * moves.
 */
export function useRedrawOnChange(): void {
  const controller = useSimController();
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    let lastTick = -1;
    let lastAlpha = -1;
    const unsubscribeSim = controller.onFrame((frame) => {
      if (frame.current.tick === lastTick && frame.alpha === lastAlpha) return;
      lastTick = frame.current.tick;
      lastAlpha = frame.alpha;
      invalidate();
    });
    const unsubscribeView = useViewStore.subscribe(() => invalidate());
    return () => {
      unsubscribeSim();
      unsubscribeView();
    };
  }, [controller, invalidate]);
}

interface Interpolated {
  list: InterpolatedAircraft[];
  byId: Map<number, InterpolatedAircraft>;
}

let cache: { key: RenderFrame; value: Interpolated } | null = null;

/** Interpolated aircraft for this frame, computed once and shared by every marker. */
export function interpolated(frame: RenderFrame): Interpolated {
  const hit =
    cache &&
    cache.key.current === frame.current &&
    cache.key.previous === frame.previous &&
    cache.key.alpha === frame.alpha;
  if (hit && cache) return cache.value;
  const list = interpolateAircraft(frame.previous, frame.current, frame.alpha);
  const value = { list, byId: new Map(list.map((entry) => [entry.aircraft.id, entry])) };
  cache = { key: frame, value };
  return value;
}

export interface RosterEntry {
  /** Stable React key: an id can come back as a different aircraft after a restart. */
  key: string;
  id: number;
  type: AircraftType;
  affiliation: Affiliation;
}

const rosterOf = (snapshot: Snapshot): RosterEntry[] =>
  snapshot.aircraft.map(({ id, type, affiliation }) => ({
    key: `${id}:${type}`,
    id,
    type,
    affiliation,
  }));

/** The aircraft currently flying; re-renders only when one arrives or leaves. */
export function useAircraftRoster(): readonly RosterEntry[] {
  const controller = useSimController();
  const [roster, setRoster] = useState(() => rosterOf(controller.getFrame().current));
  useEffect(
    () =>
      controller.onFrame((frame) => {
        const next = frame.current.aircraft;
        setRoster((previous) =>
          previous.length === next.length &&
          previous.every((entry, i) => entry.id === next[i]?.id && entry.type === next[i]?.type)
            ? previous
            : rosterOf(frame.current),
        );
      }),
    [controller],
  );
  return roster;
}
