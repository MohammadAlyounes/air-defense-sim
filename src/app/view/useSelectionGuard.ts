import { useEffect } from 'react';
import { useSimController } from '../sim/simContext';
import { useViewStore } from './viewStore';

/**
 * Clears the selection when the selected aircraft leaves the area, or when the run restarts
 * (ids start again from 1, so the same id would be a different aircraft).
 */
export function useSelectionGuard(): void {
  const controller = useSimController();
  useEffect(() => {
    let lastTick = controller.getFrame().current.tick;
    return controller.onFrame(({ current }) => {
      const restarted = current.tick < lastTick;
      lastTick = current.tick;
      const { selectedId, select } = useViewStore.getState();
      if (selectedId === null) return;
      if (restarted || !current.aircraft.some((a) => a.id === selectedId)) select(null);
    });
  }, [controller]);
}
