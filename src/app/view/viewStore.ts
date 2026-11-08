import { create } from 'zustand';
import type { HeightScale } from '../views/3d/coords';
import type { CoverageView } from '../world/world';

/**
 * View settings shared by the 3D view, the radar scope and the inspector. This is UI state
 * only: it never changes the simulation.
 */
export type CameraMode = 'orbit' | 'top' | 'follow' | 'radar';

export const CAMERA_MODES: readonly { id: CameraMode; label: string; hint: string; key: string }[] =
  [
    { id: 'orbit', label: 'Orbit', hint: 'Free camera: drag to orbit, scroll to zoom', key: '1' },
    { id: 'top', label: 'Top', hint: 'Straight down, north up: like the radar scope', key: '2' },
    { id: 'follow', label: 'Follow', hint: 'Fly behind the selected aircraft', key: '3' },
    { id: 'radar', label: 'Radar', hint: 'Stand at the radar and look out', key: '4' },
  ];

export interface ViewState {
  /** Id of the selected aircraft (ground truth), or null. */
  selectedId: number | null;
  cameraMode: CameraMode;
  /** Counts camera requests, so choosing the current mode again re-applies its view. */
  cameraRequest: number;
  heightScale: HeightScale;
  /** Name and altitude tags next to each aircraft (the selected one always has its tag). */
  showLabels: boolean;
  /**
   * Coverage overlay: shade where the radar cannot see a target flying this high above the
   * ground, or the ground it lights (`clutter`); null: off.
   */
  coverage: CoverageView | null;
  /**
   * Truth vs. perception: show where aircraft really are next to the battery's tracks, with the
   * error between them (scope, 3D view and inspector).
   */
  compareTruth: boolean;
  /** The engagement envelope: where the battery can reach, drawn as a dome in 3D. */
  showEnvelope: boolean;
  select: (id: number | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setHeightScale: (scale: HeightScale) => void;
  setShowLabels: (show: boolean) => void;
  setCoverage: (coverage: CoverageView | null) => void;
  setCompareTruth: (compare: boolean) => void;
  setShowEnvelope: (show: boolean) => void;
}

export const useViewStore = create<ViewState>()((set) => ({
  selectedId: null,
  cameraMode: 'orbit',
  cameraRequest: 0,
  heightScale: 2,
  showLabels: true,
  coverage: null,
  compareTruth: false,
  showEnvelope: false,
  select: (selectedId) =>
    set((state) => {
      if (selectedId === state.selectedId) return state;
      // Following needs something to follow.
      if (selectedId === null && state.cameraMode === 'follow') {
        return { selectedId, cameraMode: 'orbit', cameraRequest: state.cameraRequest + 1 };
      }
      return { selectedId };
    }),
  setCameraMode: (cameraMode) =>
    set((state) =>
      cameraMode === 'follow' && state.selectedId === null
        ? state
        : { cameraMode, cameraRequest: state.cameraRequest + 1 },
    ),
  setHeightScale: (heightScale) => set({ heightScale }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setCoverage: (coverage) => set({ coverage }),
  setCompareTruth: (compareTruth) => set({ compareTruth }),
  setShowEnvelope: (showEnvelope) => set({ showEnvelope }),
}));
