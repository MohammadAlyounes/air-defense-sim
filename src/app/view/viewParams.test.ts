import { describe, expect, it } from 'vitest';
import { parseViewOptions } from './viewParams';

describe('parseViewOptions', () => {
  it('keeps the defaults when the URL says nothing', () => {
    expect(parseViewOptions('')).toEqual({ state: {}, welcome: true });
  });

  it('reads the camera, heights, selection and labels', () => {
    expect(parseViewOptions('?select=3&camera=follow&heights=4&labels=0&welcome=0')).toEqual({
      state: { selectedId: 3, cameraMode: 'follow', heightScale: 4, showLabels: false },
      welcome: false,
    });
  });

  it('reads the engagement envelope', () => {
    expect(parseViewOptions('?envelope=1').state).toEqual({ showEnvelope: true });
  });

  it('reads the truth comparison', () => {
    expect(parseViewOptions('?truth=1').state).toEqual({ compareTruth: true });
    expect(parseViewOptions('?truth=0').state).toEqual({ compareTruth: false });
  });

  it('reads the coverage overlay height', () => {
    expect(parseViewOptions('?coverage=50').state).toEqual({ coverageAltM: 50 });
    expect(parseViewOptions('?coverage=1000').state).toEqual({ coverageAltM: 1000 });
  });

  it('ignores invalid values', () => {
    expect(parseViewOptions('?select=abc&camera=sideways&heights=3&coverage=77')).toEqual({
      state: {},
      welcome: true,
    });
  });

  it('only follows when an aircraft is selected', () => {
    expect(parseViewOptions('?camera=follow').state).toEqual({});
    expect(parseViewOptions('?camera=top').state).toEqual({ cameraMode: 'top' });
  });
});
