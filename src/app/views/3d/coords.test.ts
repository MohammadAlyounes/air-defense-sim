import { describe, expect, it } from 'vitest';
import { Simulation } from '../../../sim';
import {
  headingOf,
  interpolateAircraft,
  nearestAngle,
  toScene,
  worldSizeForPixels,
  yawForHeading,
} from './coords';

describe('ENU to 3D scene mapping', () => {
  it('puts east on +x, up on +y and north into the screen (-z), in kilometres', () => {
    expect(toScene({ x: 1000, y: 2000, z: 300 }, 1)).toEqual([1, 0.3, -2]);
  });

  it('stretches only heights', () => {
    expect(toScene({ x: 1000, y: 2000, z: 300 }, 4)).toEqual([1, 1.2, -2]);
  });

  it('reads compass headings from velocity', () => {
    expect(headingOf({ x: 0, y: 1, z: 0 })).toBe(0);
    expect(headingOf({ x: 1, y: 0, z: 0 })).toBeCloseTo(Math.PI / 2);
    expect(headingOf({ x: 0, y: -1, z: 0 })).toBeCloseTo(Math.PI);
    expect(headingOf({ x: -1, y: 0, z: 0 })).toBeCloseTo((3 * Math.PI) / 2);
  });

  it('turns a north-pointing model clockwise for eastern headings', () => {
    // Nose (0, 0, -1) rotated about +y by yaw: x' = -sin(yaw)... east means +x.
    const yaw = yawForHeading(Math.PI / 2);
    const noseX = -Math.sin(yaw);
    expect(noseX).toBeCloseTo(1);
  });
});

describe('constant screen size', () => {
  it('computes the world size that covers a given number of pixels', () => {
    // 90° field of view: tan(45°) = 1, so the view is 2 × distance tall.
    expect(worldSizeForPixels(10, 90, 1000, 100)).toBeCloseTo(2);
    // Twice as far away, twice as big in the world, same size on screen.
    expect(worldSizeForPixels(20, 90, 1000, 100)).toBeCloseTo(4);
    // Zooming in 2× halves the world size needed for the same pixels.
    expect(worldSizeForPixels(20, 90, 1000, 100, 2)).toBeCloseTo(2);
  });
});

describe('nearestAngle', () => {
  it('turns the short way round', () => {
    expect(nearestAngle(0, 1.5 * Math.PI)).toBeCloseTo(-0.5 * Math.PI);
    expect(nearestAngle(4 * Math.PI, 0.25)).toBeCloseTo(4 * Math.PI + 0.25);
    expect(nearestAngle(-3, 3)).toBeCloseTo(3 - 2 * Math.PI);
  });
});

describe('interpolateAircraft', () => {
  it('blends positions between two ticks and shows new arrivals where they are', () => {
    const sim = new Simulation({ seed: 1, autoTraffic: false });
    sim.dispatch({ kind: 'spawnTraffic', type: 'jet', eastM: 0, northM: 0, headingRad: 0 });
    sim.step();
    const previous = sim.snapshot();
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 5_000, northM: 0, headingRad: 0 });
    sim.step();
    const current = sim.snapshot();

    const [jet, drone] = interpolateAircraft(previous, current, 0.5);
    const jetBefore = previous.aircraft[0]?.position.y ?? 0;
    const jetNow = current.aircraft[0]?.position.y ?? 0;
    expect(jet?.position.y).toBeCloseTo((jetBefore + jetNow) / 2);
    expect(drone?.position).toEqual(current.aircraft[1]?.position);
  });
});
