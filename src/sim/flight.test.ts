import { describe, expect, it } from 'vitest';
import { vec3 } from './core/vec';
import {
  alongRoute,
  angleDiff,
  breakTrack,
  CALM,
  dropRoute,
  dropSide,
  GRAVITY_MPS2,
  insideTurnCircle,
  loadFactorForBank,
  planRoute,
  routeLengthM,
  turnRadiusM,
  turnRateRadS,
  turnToward,
  windFromSeed,
  windSpeedAt,
  windTriangle,
  windVelocityAt,
  WIND_SPEED_RANGE_MPS,
} from './flight';

const deg = (d: number) => (d * Math.PI) / 180;

describe('wind', () => {
  it('grows with height by the one-seventh power law', () => {
    const wind = { speedMps: 10, fromRad: 0 };
    expect(windSpeedAt(wind, 10)).toBeCloseTo(10, 9);
    // 300 m: 10 × 30^(1/7) = 16.26 m/s. 6 km: 10 × 600^(1/7) = 24.9 m/s.
    expect(windSpeedAt(wind, 300)).toBeCloseTo(16.26, 2);
    expect(windSpeedAt(wind, 6_000)).toBeCloseTo(24.94, 2);
    // At the surface it is taken 1 m up.
    expect(windSpeedAt(wind, 0)).toBeCloseTo(windSpeedAt(wind, 1), 9);
    expect(windSpeedAt(CALM, 5_000)).toBe(0);
  });

  it('blows away from the direction it comes from', () => {
    // A west wind (from 270°) blows toward the east.
    const w = windVelocityAt({ speedMps: 10, fromRad: deg(270) }, 10);
    expect(w.x).toBeCloseTo(10, 9);
    expect(w.y).toBeCloseTo(0, 9);
  });

  it('draws a run its own wind from the seed, within the set range', () => {
    expect(windFromSeed(2026)).toEqual(windFromSeed(2026));
    expect(windFromSeed(1)).not.toEqual(windFromSeed(2));
    for (let seed = 0; seed < 50; seed++) {
      const wind = windFromSeed(seed);
      expect(wind.speedMps).toBeGreaterThanOrEqual(WIND_SPEED_RANGE_MPS[0]);
      expect(wind.speedMps).toBeLessThan(WIND_SPEED_RANGE_MPS[1]);
      expect(wind.fromRad).toBeGreaterThanOrEqual(0);
      expect(wind.fromRad).toBeLessThan(2 * Math.PI);
    }
  });
});

describe('the wind triangle', () => {
  it('slows an aircraft flying into a headwind and speeds it up downwind', () => {
    const north = 0;
    const fromNorth = vec3(0, -10, 0); // air moving south
    expect(windTriangle(north, 40, fromNorth).groundSpeedMps).toBeCloseTo(30, 9);
    expect(windTriangle(Math.PI, 40, fromNorth).groundSpeedMps).toBeCloseTo(50, 9);
  });

  it('turns the nose into a crosswind to hold the track', () => {
    // Flying north at 40 m/s, wind 10 m/s blowing east: crab 14.5° to the west.
    const t = windTriangle(0, 40, vec3(10, 0, 0));
    expect(t.groundVelocity.x).toBeCloseTo(0, 9);
    expect(t.groundSpeedMps).toBeCloseTo(Math.sqrt(40 ** 2 - 10 ** 2), 9);
    expect(angleDiff(t.headingRad, 0)).toBeCloseTo(-Math.asin(10 / 40), 9);
  });

  it('drifts when the crosswind is stronger than the airspeed', () => {
    const t = windTriangle(0, 10, vec3(25, 0, 0));
    // Nose straight into the wind (west), still carried east at 15 m/s.
    expect(t.groundVelocity.x).toBeCloseTo(15, 9);
    expect(t.groundVelocity.y).toBeCloseTo(0, 9);
  });

  it('keeps an aircraft on a north-south line exactly', () => {
    const t = windTriangle(Math.PI, 340, vec3(0, 0, 0));
    expect(t.groundVelocity.x).toBe(0);
    expect(t.groundVelocity.y).toBe(-340);
  });
});

describe('turns', () => {
  it('turns tighter at a higher load factor, wider at a higher speed', () => {
    // r = V² / (g √(n² − 1)): a fast jet at 6 g turns on a 2 km circle...
    expect(turnRadiusM(340, 6)).toBeCloseTo(340 ** 2 / (GRAVITY_MPS2 * Math.sqrt(35)), 6);
    expect(turnRadiusM(340, 6)).toBeCloseTo(1_992, 0);
    // ...but at its routine 60° bank (2 g) on a 6.8 km one.
    expect(loadFactorForBank(60)).toBeCloseTo(2, 9);
    expect(turnRadiusM(340, 2)).toBeCloseTo(6_803, 0);
    // A cruise-missile-like target at 45° of bank: 5.9 km. A small drone at 35°: 233 m.
    expect(turnRadiusM(240, loadFactorForBank(45))).toBeCloseTo(5_872, 0);
    expect(turnRadiusM(40, loadFactorForBank(35))).toBeCloseTo(233, 0);
    expect(turnRateRadS(340, 6) * turnRadiusM(340, 6)).toBeCloseTo(340, 9);
    expect(turnRadiusM(340, 1)).toBe(Number.POSITIVE_INFINITY);
  });

  it('turns the short way round, no faster than allowed', () => {
    expect(angleDiff(deg(10), deg(350))).toBeCloseTo(deg(20), 9);
    expect(angleDiff(deg(350), deg(10))).toBeCloseTo(deg(-20), 9);
    expect(turnToward(deg(350), deg(10), deg(5))).toBeCloseTo(deg(355), 9);
    expect(turnToward(deg(350), deg(10), deg(50))).toBeCloseTo(deg(10), 9);
  });

  it('knows a point inside its turn circle cannot be reached by turning', () => {
    // Flying north at the origin with a 1 km turn radius: the right circle is centred 1 km east.
    const here = vec3(0, 0, 0);
    expect(insideTurnCircle(here, 0, vec3(1_500, 0, 0), 1_000)).toBe(true);
    expect(insideTurnCircle(here, 0, vec3(-1_500, 0, 0), 1_000)).toBe(true);
    expect(insideTurnCircle(here, 0, vec3(2_500, 0, 0), 1_000)).toBe(false);
    // Straight ahead or far behind: reachable.
    expect(insideTurnCircle(here, 0, vec3(0, 3_000, 0), 1_000)).toBe(false);
    expect(insideTurnCircle(here, 0, vec3(500, -3_000, 0), 1_000)).toBe(false);
    expect(insideTurnCircle(here, 0, vec3(500, 0, 0), Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('breaks square to the interceptor, on the side that needs the smaller turn', () => {
    // Flying north; an interceptor ahead and a little to the right: break to the west or east.
    const track = breakTrack(0, vec3(0, 0, 0), vec3(500, 5_000, 0));
    expect(Math.abs(angleDiff(track, 0))).toBeLessThanOrEqual(Math.PI / 2 + 1e-9);
    const los = Math.atan2(500, 5_000);
    expect(Math.abs(Math.abs(angleDiff(track, los)) - Math.PI / 2)).toBeLessThan(1e-9);
  });
});

describe('routes', () => {
  it('flies most traffic straight at its aim point', () => {
    expect(planRoute('jet', vec3(0, 30_000, 0), vec3(0, 0, 0), 1)).toEqual([vec3(0, 0, 0)]);
  });

  it('gives a cruise-missile-like target a dog-leg: half way along, a quarter off to one side', () => {
    const route = planRoute('cruise', vec3(0, 38_000, 0), vec3(0, 0, 0), 1);
    // Flying south, "right" is west.
    expect(route).toHaveLength(2);
    expect(route[0]?.x).toBeCloseTo(-9_500, 6);
    expect(route[0]?.y).toBeCloseTo(19_000, 6);
    expect(route[1]).toEqual(vec3(0, 0, 0));
    expect(planRoute('cruise', vec3(0, 38_000, 0), vec3(0, 0, 0), -1)[0]?.x).toBeCloseTo(9_500, 6);
    // Its first leg points 26.6° away from the target.
    const first = Math.atan2(-9_500, -19_000) + 2 * Math.PI;
    expect(Math.abs(angleDiff(first, Math.PI))).toBeCloseTo(Math.atan(0.5), 9);
  });

  it('flies short routes straight: a dog-leg needs room to turn', () => {
    // Under three turn radii (3 × 5.9 km), no dog-leg.
    expect(planRoute('cruise', vec3(0, 15_000, 0), vec3(0, 0, 0), 1)).toHaveLength(1);
  });

  it('routes a dropped threat at the battery, with a dog-leg side fixed by where it is dropped', () => {
    const start = vec3(0, 30_000, 0);
    const route = dropRoute('cruise', start, Math.PI);
    expect(route[route.length - 1]?.x).toBeCloseTo(0, 6);
    expect(route[route.length - 1]?.y).toBeCloseTo(0, 6);
    expect(route).toHaveLength(2);
    expect(dropSide(start)).toBe(dropSide(vec3(1_000, 30_000, 0)));
    // Either side of the 45° bearing line, the dog-leg turns the other way.
    expect(dropSide(vec3(29_000, 30_000, 0))).not.toBe(dropSide(vec3(30_000, 29_000, 0)));
    expect(dropRoute('drone', start, Math.PI)).toHaveLength(1);
  });

  it('finds a point part-way along a route, with the waypoints still ahead', () => {
    const start = vec3(0, 0, 100);
    const route = [vec3(0, 1_000, 0), vec3(1_000, 1_000, 0)];
    expect(routeLengthM(start, route)).toBeCloseTo(2_000, 9);
    const half = alongRoute(start, route, 1_500);
    expect(half.position.x).toBeCloseTo(500, 9);
    expect(half.position.y).toBeCloseTo(1_000, 9);
    expect(half.position.z).toBe(100);
    expect(half.trackRad).toBeCloseTo(Math.PI / 2, 9);
    expect(half.remaining).toEqual([vec3(1_000, 1_000, 0)]);
    expect(alongRoute(start, route, 0).remaining).toHaveLength(2);
  });
});
