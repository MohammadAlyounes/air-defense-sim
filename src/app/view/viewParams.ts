import { HEIGHT_SCALES, type HeightScale } from '../views/3d/coords';
import { COVERAGE_ALTITUDES_M, type CoverageAltitude } from '../world/world';
import { CAMERA_MODES, type CameraMode, type ViewState } from './viewStore';

/**
 * View settings from the URL, so a link can open a particular view, e.g.
 * `?t=75&select=3&camera=follow&heights=4&coverage=50`. Unknown or invalid values are ignored.
 */
export interface ViewOptions {
  state: Partial<
    Pick<ViewState, 'cameraMode' | 'heightScale' | 'selectedId' | 'showLabels' | 'coverageAltM'>
  >;
  /** `welcome=0` hides the first-visit welcome card (screenshots, embeds). */
  welcome: boolean;
}

const OFF = ['0', 'false', 'no', 'off'];

export function parseViewOptions(search: string): ViewOptions {
  const params = new URLSearchParams(search);
  const state: ViewOptions['state'] = {};

  const select = params.get('select');
  if (select !== null && /^\d{1,9}$/.test(select)) state.selectedId = Number(select);

  const camera = params.get('camera');
  const mode = CAMERA_MODES.find((entry) => entry.id === camera)?.id as CameraMode | undefined;
  // Following needs a selected aircraft.
  if (mode && (mode !== 'follow' || state.selectedId !== undefined)) state.cameraMode = mode;

  const heights = Number(params.get('heights'));
  if ((HEIGHT_SCALES as readonly number[]).includes(heights)) {
    state.heightScale = heights as HeightScale;
  }

  const labels = params.get('labels');
  if (labels !== null) state.showLabels = !OFF.includes(labels);

  const coverage = Number(params.get('coverage'));
  if ((COVERAGE_ALTITUDES_M as readonly number[]).includes(coverage)) {
    state.coverageAltM = coverage as CoverageAltitude;
  }

  const welcome = params.get('welcome');
  return { state, welcome: welcome === null || !OFF.includes(welcome) };
}
