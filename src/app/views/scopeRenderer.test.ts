import { describe, expect, it } from 'vitest';
import type { Plot } from '../../sim';
import { echoGlow, interpolateAzimuth, pickEcho, scopePoint } from './scopeRenderer';

// A 400 px scope showing 40 km: 5 px per kilometre around the centre (200, 200).
const layout = { size: 400, radiusPx: 200, rangeM: 40_000 };
const radar = { azimuthRad: 0, periodS: 4, rangeM: 40_000 };

const plot = (truthId: number, eastM: number, northM: number, timeS: number): Plot => ({
  tick: Math.round(timeS * 50),
  timeS,
  position: { x: eastM, y: northM, z: 300 },
  bearingRad: Math.atan2(eastM, northM),
  rangeM: Math.hypot(eastM, northM),
  radarSize: 'small',
  truthId,
});

describe('scope geometry', () => {
  it('draws north up and east to the right', () => {
    expect(scopePoint(layout, 0, 0)).toEqual({ x: 200, y: 200 });
    expect(scopePoint(layout, 10_000, 0)).toEqual({ x: 250, y: 200 });
    expect(scopePoint(layout, 0, 20_000)).toEqual({ x: 200, y: 100 });
  });

  it('fades echoes like phosphor: about a third as bright after 85% of a turn', () => {
    expect(echoGlow(0, 4)).toBe(1);
    expect(echoGlow(3.4, 4)).toBeCloseTo(Math.exp(-1));
    expect(echoGlow(-1, 4)).toBe(0); // not painted yet
  });

  it('blends antenna angles forward across north', () => {
    expect(interpolateAzimuth(6.2, 0.1, 0.5)).toBeCloseTo(
      (6.2 + 0.1 + 2 * Math.PI) / 2 - 2 * Math.PI,
    );
  });
});

describe('pickEcho', () => {
  const plots = [plot(1, 10_000, 0, 9), plot(2, 0, 20_000, 9.5), plot(1, 10_100, 0, 13)];

  it('finds the aircraft behind the nearest visible echo', () => {
    expect(pickEcho({ plots, radar }, 14, layout, 251, 201)).toBe(1);
    expect(pickEcho({ plots, radar }, 14, layout, 203, 104)).toBe(2);
  });

  it('ignores clicks away from every echo', () => {
    expect(pickEcho({ plots, radar }, 14, layout, 300, 300)).toBeNull();
  });

  it('ignores echoes that have faded out or are not painted yet', () => {
    expect(pickEcho({ plots: [plot(3, 0, 0, 1)], radar }, 30, layout, 200, 200)).toBeNull();
    expect(pickEcho({ plots: [plot(3, 0, 0, 20)], radar }, 14, layout, 200, 200)).toBeNull();
  });
});
