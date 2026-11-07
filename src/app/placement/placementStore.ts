import { create } from 'zustand';
import { TRAFFIC, type TrafficTypeId } from '../../sim';
import { isValidDrop, type GroundPoint } from './placement';

/**
 * UI state while traffic is being placed from the palette. Like the view store, it never
 * changes the simulation by itself: a placement ends in a `spawnTraffic` command.
 */

export type DropZoneId = 'battlespace' | 'scope';
/** Turns a screen point (client pixels) into a ground point, or null if it is off the map. */
export type GroundResolver = (clientX: number, clientY: number) => GroundPoint | null;

const zones = new Map<DropZoneId, GroundResolver>();

/** Lets a view accept drops. Returns a function that stops it. */
export function registerDropZone(zone: DropZoneId, resolve: GroundResolver): () => void {
  zones.set(zone, resolve);
  return () => {
    if (zones.get(zone) === resolve) zones.delete(zone);
  };
}

export interface PlacementTarget {
  zone: DropZoneId;
  at: GroundPoint;
  valid: boolean;
}

/** The drop zone under a screen point (marked with `data-drop-zone`) and the ground point there. */
export function resolveTarget(clientX: number, clientY: number): PlacementTarget | null {
  const element = document.elementFromPoint(clientX, clientY)?.closest('[data-drop-zone]');
  const zone = element?.getAttribute('data-drop-zone') as DropZoneId | undefined;
  const at = zone ? (zones.get(zone)?.(clientX, clientY) ?? null) : null;
  return zone && at ? { zone, at, valid: isValidDrop(at) } : null;
}

export interface PlacementState {
  /** The palette card being placed, if any. */
  type: TrafficTypeId | null;
  /** Dragging the card, or tapped it and now choosing a spot on the map. */
  mode: 'drag' | 'tap' | null;
  altitudeM: number;
  /** Pointer position while placing, client pixels. */
  pointer: { x: number; y: number } | null;
  /** Where it would go if dropped now. */
  target: PlacementTarget | null;
  /** The last placement: a ripple marks it in both views. */
  lastDrop: { at: GroundPoint; atMs: number } | null;
  /** Placements made from the keyboard, so each lands in a new spot. */
  keyboardCount: number;
  pick: (type: TrafficTypeId, mode: 'drag' | 'tap') => void;
  move: (clientX: number, clientY: number) => void;
  setAltitude: (altitudeM: number) => void;
  cancel: () => void;
  dropped: (at: GroundPoint, fromKeyboard?: boolean) => void;
}

export const usePlacementStore = create<PlacementState>()((set) => ({
  type: null,
  mode: null,
  altitudeM: 0,
  pointer: null,
  target: null,
  lastDrop: null,
  keyboardCount: 0,
  pick: (type, mode) =>
    set({ type, mode, altitudeM: TRAFFIC[type].altitudeM, target: null, pointer: null }),
  move: (x, y) => set({ pointer: { x, y }, target: resolveTarget(x, y) }),
  setAltitude: (altitudeM) => set({ altitudeM }),
  cancel: () => set({ type: null, mode: null, pointer: null, target: null }),
  dropped: (at, fromKeyboard = false) =>
    set((state) => ({
      type: null,
      mode: null,
      pointer: null,
      target: null,
      lastDrop: { at, atMs: performance.now() },
      keyboardCount: state.keyboardCount + (fromKeyboard ? 1 : 0),
    })),
}));
