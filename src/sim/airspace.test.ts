import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_EXIT_RANGE_M,
  corridorFrame,
  corridorHalfLengthM,
  corridorPoint,
  corridorRoute,
  DEFAULT_CORRIDORS,
  fliesCorridor,
  nearestCorridor,
  type AirCorridor,
} from './airspace';
import { DEFAULT_ASSETS } from './assets';
import { evaluateThreat } from './c2';
import { headingVector, scale, vec3 } from './core/vec';
import { bearingTo } from './flight';

const DEG = Math.PI / 180;
const [north, southWest] = DEFAULT_CORRIDORS as [AirCorridor, AirCorridor];
/** A point `alongM` along the north lane, `acrossM` to its right, at height `z`. */
const onNorth = (alongM: number, acrossM = 0, z = 11_000) => {
  const p = corridorPoint(north, alongM, acrossM);
  return vec3(p.x, p.y, z);
};

describe('civil air corridors', () => {
  it('lay two lanes square to their bearing from the battery, 18 and 22 km out', () => {
    expect(north.centre.x).toBeCloseTo(18_000 * Math.sin(10 * DEG), 6); // 3,126 m east
    expect(north.centre.y).toBeCloseTo(18_000 * Math.cos(10 * DEG), 6); // 17,727 m north
    expect(north.axisRad).toBeCloseTo(100 * DEG, 12);
    expect(Math.hypot(southWest.centre.x, southWest.centre.y)).toBeCloseTo(22_000, 6);
    expect(southWest.axisRad).toBeCloseTo(305 * DEG, 12);
    for (const lane of DEFAULT_CORRIDORS) {
      expect(lane.halfWidthM).toBe(5_000);
      expect([lane.floorM, lane.ceilingM]).toEqual([8_000, 13_000]);
    }
  });

  it('measures along and across a lane, and back', () => {
    const centre = corridorFrame(north, north.centre.x, north.centre.y);
    expect(centre.alongM).toBeCloseTo(0, 9);
    expect(centre.acrossM).toBeCloseTo(0, 9);
    const p = corridorPoint(north, 12_000, -3_000);
    const frame = corridorFrame(north, p.x, p.y);
    expect(frame.alongM).toBeCloseTo(12_000, 6);
    expect(frame.acrossM).toBeCloseTo(-3_000, 6);
    // Looking along the lane (100°, east-south-east), the battery is 18 km to the right.
    const battery = corridorFrame(north, 0, 0);
    expect(battery.alongM).toBeCloseTo(0, 6);
    expect(battery.acrossM).toBeCloseTo(18_000, 6);
  });

  it('reaches a circle round the battery √(R² − d²) either way from its closest point', () => {
    expect(corridorHalfLengthM(north, 38_000)).toBeCloseTo(Math.sqrt(38_000 ** 2 - 18_000 ** 2), 6);
    expect(corridorHalfLengthM(north, 38_000)).toBeCloseTo(33_466, 0);
    expect(corridorHalfLengthM(north, 10_000)).toBe(0);
  });

  it('is flown inside its width and height band, along it either way within 30°', () => {
    const along = north.axisRad;
    expect(fliesCorridor(north, onNorth(0), along)).toBe(true);
    expect(fliesCorridor(north, onNorth(0), along + Math.PI)).toBe(true);
    expect(fliesCorridor(north, onNorth(0), along + 29 * DEG)).toBe(true);
    expect(fliesCorridor(north, onNorth(0), along - 29 * DEG + Math.PI)).toBe(true);
    expect(fliesCorridor(north, onNorth(0), along + 31 * DEG)).toBe(false);
    expect(fliesCorridor(north, onNorth(0), along + 90 * DEG)).toBe(false);
    expect(fliesCorridor(north, onNorth(10_000, 4_900), along)).toBe(true);
    expect(fliesCorridor(north, onNorth(10_000, -5_100), along)).toBe(false);
    expect(fliesCorridor(north, onNorth(0, 0, 7_900), along)).toBe(false);
    expect(fliesCorridor(north, onNorth(0, 0, 13_100), along)).toBe(false);
  });

  it('picks the lane whose centreline passes closest', () => {
    expect(nearestCorridor(DEFAULT_CORRIDORS, 0, 0)?.id).toBe(1); // 18 km against 22 km
    expect(nearestCorridor(DEFAULT_CORRIDORS, -15_000, -15_000)?.id).toBe(2);
    expect(nearestCorridor([], 0, 0)).toBeNull();
  });

  it('keeps clear of the defended assets: no course along a lane threatens one', () => {
    // Within 10° of the lane's direction, anywhere in it out to the radar's range. (A course at
    // the full 30° allowed for flying the lane can point at the battery from a lane's far end:
    // the corridor only changes what silence means, the course is still evaluated.)
    let checked = 0;
    for (const lane of DEFAULT_CORRIDORS) {
      const half = corridorHalfLengthM(lane, 40_000);
      for (let alongM = -half; alongM <= half; alongM += 2_000) {
        for (const acrossM of [-lane.halfWidthM, 0, lane.halfWidthM]) {
          const at = corridorPoint(lane, alongM, acrossM);
          for (const offDeg of [-10, 0, 10, 170, 180, 190]) {
            const velocity = scale(headingVector(lane.axisRad + offDeg * DEG), 230);
            expect(evaluateThreat(vec3(at.x, at.y, 11_000), velocity, DEFAULT_ASSETS)).toBeNull();
            checked += 1;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });
});

describe('an airliner placed by hand', () => {
  const exitAlongM = Math.sqrt(CORRIDOR_EXIT_RANGE_M ** 2 - 18_000 ** 2); // 40.2 km

  it('flies straight out along the lane when it starts on the centreline', () => {
    const route = corridorRoute(onNorth(-20_000), DEFAULT_CORRIDORS);
    expect(route).toHaveLength(1);
    const end = corridorFrame(north, route[0]?.x ?? 0, route[0]?.y ?? 0);
    // Toward the farther end, so it crosses as much of the area as it can.
    expect(end.alongM).toBeCloseTo(exitAlongM, 6);
    expect(end.acrossM).toBeCloseTo(0, 6);
  });

  it('joins the nearest lane at 45°, then flies it out of the area', () => {
    const start = onNorth(-10_000, 3_000);
    const [join, end] = corridorRoute(start, DEFAULT_CORRIDORS);
    const joinFrame = corridorFrame(north, join?.x ?? 0, join?.y ?? 0);
    expect(joinFrame.alongM).toBeCloseTo(-7_000, 6);
    expect(joinFrame.acrossM).toBeCloseTo(0, 6);
    expect(corridorFrame(north, end?.x ?? 0, end?.y ?? 0).alongM).toBeCloseTo(exitAlongM, 6);
    // The joining leg crosses the lane at 45° to its direction.
    const legRad = bearingTo(start, join ?? start);
    expect(Math.abs(legRad - north.axisRad)).toBeCloseTo(45 * DEG, 6);
  });

  it('flies the other way from the far side of the battery', () => {
    const route = corridorRoute(onNorth(10_000), DEFAULT_CORRIDORS);
    const end = corridorFrame(north, route[0]?.x ?? 0, route[0]?.y ?? 0);
    expect(end.alongM).toBeCloseTo(-exitAlongM, 6);
  });

  it('heads straight for the end when it would only join the lane beyond it', () => {
    // 42 km to the side, 1 km back: a 45° join would meet the lane 41 km along, past its end.
    const route = corridorRoute(onNorth(-1_000, 42_000), [north]);
    expect(route).toHaveLength(1);
    expect(corridorFrame(north, route[0]?.x ?? 0, route[0]?.y ?? 0).alongM).toBeCloseTo(
      exitAlongM,
      6,
    );
  });

  it('has nowhere to go without lanes', () => {
    expect(corridorRoute(onNorth(0), [])).toEqual([]);
  });
});
