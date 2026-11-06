import { useEffect } from 'react';
import { CAMERA_MODES, useViewStore } from './viewStore';

/** Keys shown in tooltips and the welcome card; keep in sync with the handler below. */
export const VIEW_SHORTCUTS = {
  cameras: '1–4',
  clearSelection: 'Esc',
  labels: 'L',
} as const;

const TYPING = 'input, textarea, select, [contenteditable="true"], [role="slider"]';

/** 1–4 choose a camera, Esc clears the selection and L toggles the aircraft labels. */
export function useViewShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Popovers handle (and mark) their own Escape first, so it does not clear the selection.
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof Element && event.target.closest(TYPING)) return;
      const view = useViewStore.getState();
      const mode = CAMERA_MODES.find((entry) => entry.key === event.key);
      if (mode) view.setCameraMode(mode.id);
      else if (event.key === 'Escape') view.select(null);
      else if (event.key === 'l' || event.key === 'L') view.setShowLabels(!view.showLabels);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
