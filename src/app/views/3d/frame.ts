import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import type { Affiliation, AircraftType, Interceptor, Snapshot, Vec3 } from '../../../sim';
import type { RenderFrame } from '../../sim/SimController';
import { useSimController } from '../../sim/simContext';
import { usePlacementStore } from '../../placement/placementStore';
import { useViewStore } from '../../view/viewStore';
import { interpolateAircraft, lerpVec, type InterpolatedAircraft } from './coords';

/**
 * Glue between the simulation driver and the 3D canvas. The canvas renders on demand, so it
 * draws a new frame only when the simulation moves, the view settings change, traffic is
 * being placed, or the camera moves.
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
    const unsubscribePlacement = usePlacementStore.subscribe(() => invalidate());
    return () => {
      unsubscribeSim();
      unsubscribeView();
      unsubscribePlacement();
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

export interface InterpolatedInterceptor {
  interceptor: Interceptor;
  position: Vec3;
}

let interceptorCache: { key: RenderFrame; value: Map<number, InterpolatedInterceptor> } | null =
  null;

/** Interceptor positions blended between the last two ticks, by id; computed once per frame. */
export function interpolatedInterceptors(frame: RenderFrame): Map<number, InterpolatedInterceptor> {
  const key = interceptorCache?.key;
  if (
    interceptorCache &&
    key?.current === frame.current &&
    key.previous === frame.previous &&
    key.alpha === frame.alpha
  ) {
    return interceptorCache.value;
  }
  const before = new Map(frame.previous.interceptors.map((i) => [i.id, i.position]));
  const value = new Map(
    frame.current.interceptors.map((interceptor) => {
      const old = before.get(interceptor.id);
      const position = old ? lerpVec(old, interceptor.position, frame.alpha) : interceptor.position;
      return [interceptor.id, { interceptor, position }] as const;
    }),
  );
  interceptorCache = { key: frame, value };
  return value;
}

/** Ids of the interceptors in flight; re-renders only when one launches or ends. */
export function useInterceptorIds(): readonly number[] {
  const controller = useSimController();
  const [ids, setIds] = useState(() => controller.getFrame().current.interceptors.map((i) => i.id));
  useEffect(
    () =>
      controller.onFrame((frame) => {
        const next = frame.current.interceptors;
        setIds((previous) =>
          previous.length === next.length && previous.every((id, i) => id === next[i]?.id)
            ? previous
            : next.map((i) => i.id),
        );
      }),
    [controller],
  );
  return ids;
}
