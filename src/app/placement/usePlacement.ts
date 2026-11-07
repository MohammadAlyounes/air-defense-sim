import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { TrafficTypeId } from '../../sim';
import { useSimController } from '../sim/simContext';
import { keyboardSpot, spawnCommand, stepAltitude, type GroundPoint } from './placement';
import { usePlacementStore } from './placementStore';

/** A drag starts once the pointer has moved this far from where it was pressed, pixels. */
const DRAG_START_PX = 6;

/** Places traffic: sends the spawn command and ends the placement. */
export function usePlace() {
  const controller = useSimController();
  return (type: TrafficTypeId, at: GroundPoint, altitudeM: number, fromKeyboard = false) => {
    controller.dispatch(spawnCommand(type, at, altitudeM));
    usePlacementStore.getState().dropped(at, fromKeyboard);
  };
}

/**
 * Gestures for one palette card:
 * - drag it onto the 3D view or the radar scope (mouse and pen);
 * - or click (tap) it, then click (tap) the map, which also works on touch screens;
 * - or press Enter to pick it up and Enter again to place it 30 km out.
 */
export function usePaletteCard(type: TrafficTypeId) {
  const place = usePlace();
  const pressed = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      // Touch screens scroll the palette with a finger: they place by tapping instead.
      if (event.pointerType === 'touch' || event.button !== 0) return;
      pressed.current = { x: event.clientX, y: event.clientY };
      dragged.current = false;
      // Keep receiving the pointer even if a fast flick leaves the card before the drag starts.
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const start = pressed.current;
      if (!start || dragged.current) return;
      if (Math.hypot(event.clientX - start.x, event.clientY - start.y) < DRAG_START_PX) return;
      dragged.current = true;
      const placement = usePlacementStore.getState();
      placement.pick(type, 'drag');
      placement.move(event.clientX, event.clientY);
    },
    onPointerUp() {
      pressed.current = null;
    },
    onClick(event: ReactMouseEvent<HTMLElement>) {
      // The click that ends a drag is not a tap.
      if (dragged.current) {
        dragged.current = false;
        event.preventDefault();
        return;
      }
      const placement = usePlacementStore.getState();
      if (placement.type === type && placement.mode === 'tap') placement.cancel();
      else placement.pick(type, 'tap');
    },
    onKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      const placement = usePlacementStore.getState();
      if (placement.type === type) {
        place(type, keyboardSpot(placement.keyboardCount), placement.altitudeM, true);
      } else {
        placement.pick(type, 'tap');
      }
    },
  };
}

/** While placing: follow the pointer, drop on release or tap, wheel for altitude, Esc to cancel. */
export function usePlacementControls(): void {
  const place = usePlace();
  const placeRef = useRef(place);
  useEffect(() => {
    placeRef.current = place;
  });

  useEffect(() => {
    const store = usePlacementStore;
    const finish = (x: number, y: number) => {
      const { type, altitudeM, move } = store.getState();
      move(x, y);
      const { target } = store.getState();
      if (type && target?.valid) placeRef.current(type, target.at, altitudeM);
      else store.getState().cancel();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (store.getState().type) store.getState().move(event.clientX, event.clientY);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (store.getState().mode === 'drag') finish(event.clientX, event.clientY);
    };
    // Tap mode: a press on the map belongs to the placement, not to the camera or selection.
    const onPointerDown = (event: PointerEvent) => {
      if (store.getState().mode !== 'tap') return;
      if ((event.target as Element | null)?.closest('[data-drop-zone]')) event.stopPropagation();
    };
    const onClick = (event: MouseEvent) => {
      const { mode, move } = store.getState();
      if (mode !== 'tap' || !(event.target as Element | null)?.closest('[data-drop-zone]')) return;
      event.stopPropagation();
      event.preventDefault();
      move(event.clientX, event.clientY);
      if (store.getState().target?.valid) finish(event.clientX, event.clientY);
    };
    const onWheel = (event: WheelEvent) => {
      const { type, target, altitudeM, setAltitude } = store.getState();
      if (!type || !target) return;
      event.preventDefault();
      event.stopPropagation();
      setAltitude(stepAltitude(type, altitudeM, event.deltaY < 0 ? 1 : -1));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && store.getState().type) {
        event.preventDefault();
        store.getState().cancel();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });
    // Capture phase: Esc ends the placement before it can clear the selection too.
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);
}
