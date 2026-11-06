import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStore } from './viewStore';

describe('view store', () => {
  beforeEach(() => {
    useViewStore.setState({
      selectedId: null,
      cameraMode: 'orbit',
      cameraRequest: 0,
      heightScale: 2,
    });
  });

  it('cannot follow without a selected aircraft', () => {
    useViewStore.getState().setCameraMode('follow');
    expect(useViewStore.getState().cameraMode).toBe('orbit');
    useViewStore.getState().select(7);
    useViewStore.getState().setCameraMode('follow');
    expect(useViewStore.getState().cameraMode).toBe('follow');
  });

  it('drops back to orbit when the followed aircraft is deselected', () => {
    useViewStore.getState().select(3);
    useViewStore.getState().setCameraMode('follow');
    useViewStore.getState().select(null);
    expect(useViewStore.getState().cameraMode).toBe('orbit');
  });

  it('keeps other camera modes when selection changes', () => {
    useViewStore.getState().setCameraMode('top');
    useViewStore.getState().select(4);
    useViewStore.getState().select(null);
    expect(useViewStore.getState().cameraMode).toBe('top');
  });

  it('counts camera requests, so choosing the current view again re-applies it', () => {
    const { setCameraMode } = useViewStore.getState();
    setCameraMode('top');
    setCameraMode('top');
    expect(useViewStore.getState().cameraRequest).toBe(2);
    setCameraMode('follow'); // ignored: nothing selected
    expect(useViewStore.getState().cameraRequest).toBe(2);
  });
});
