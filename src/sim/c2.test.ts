import { describe, expect, it } from 'vitest';
import { STANDARD_ATMOSPHERE } from './atmosphere';
import { DEFAULT_ASSETS } from './assets';
import {
  closestApproachTo,
  closestApproachToOrigin,
  DEFAULT_DEFENSE,
  engageable,
  envelopeRangeM,
  evaluateThreat,
  iffAnswer,
  killProbability,
  predictIntercept,
} from './c2';
import { vec3 } from './core/vec';
import { DEFAULT_INTERCEPTOR, reachM } from './interceptor';

describe('identification', () => {
  const config = { friendReplyProbability: 0.9, civilSquawkProbability: 0.98 };

  it('hears friends reply and civil aircraft squawk, unless the transponder fails', () => {
    expect(iffAnswer('friend', 0.5, config)).toBe('friend');
    expect(iffAnswer('friend', 0.95, config)).toBeNull(); // the 10% of checks it misses
    expect(iffAnswer('neutral', 0.5, config)).toBe('neutral');
    expect(iffAnswer('neutral', 0.99, config)).toBeNull();
  });

  it('never hears a hostile', () => {
    expect(iffAnswer('hostile', 0, config)).toBeNull();
  });
});

describe('rules of engagement', () => {
  it('fires at hostiles when weapons are tight, also at unknowns when free, never on hold', () => {
    expect(engageable('hostile', 'TIGHT')).toBe(true);
    expect(engageable('unknown', 'TIGHT')).toBe(false);
    expect(engageable('unknown', 'FREE')).toBe(true);
    expect(engageable('friend', 'FREE')).toBe(false);
    expect(engageable('neutral', 'FREE')).toBe(false);
    expect(engageable('hostile', 'HOLD')).toBe(false);
  });
});

describe('kill probability', () => {
  it('is highest against slow targets with a fast interceptor', () => {
    expect(killProbability(40, 700)).toBeCloseTo(0.95, 9);
    expect(killProbability(240, 700)).toBeCloseTo(0.85, 9);
    expect(killProbability(340, 700)).toBeCloseTo(0.75, 9);
  });

  it('falls as the interceptor tires: × v / 600 m/s, at least half', () => {
    expect(killProbability(340, 450)).toBeCloseTo(0.75 * 0.75, 9);
    expect(killProbability(40, 100)).toBeCloseTo(0.95 * 0.5, 9);
  });
});

describe('engagement envelope', () => {
  it('reaches as far as the planned reach in the longest planned flight, minus the altitude', () => {
    const low = envelopeRangeM(0, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
    expect(low).toBeCloseTo(
      0.9 * reachM(34, DEFAULT_INTERCEPTOR, STANDARD_ATMOSPHERE.densityKgM3(0)),
      3,
    );
    // Higher up the air is thinner, so the interceptor flies farther in the same time...
    const at = (altitudeM: number) =>
      envelopeRangeM(altitudeM, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
    expect(Math.hypot(at(6_000), 6_000)).toBeGreaterThan(low);
    expect(Math.hypot(at(10_000), 10_000)).toBeGreaterThan(Math.hypot(at(6_000), 6_000));
    // ...which wins over the climb up to about 3 km; above that, the altitude eats the range.
    expect(at(3_000)).toBeGreaterThan(low);
    expect(at(6_000)).toBeLessThan(at(3_000));
    expect(at(40_000)).toBe(0);
  });
});

describe('threat evaluation', () => {
  it('finds how close a straight course passes the battery, and when', () => {
    // 10 km east, 20 km south, flying north at 300 m/s: passes 10 km east in 66.7 s.
    const pass = closestApproachToOrigin(vec3(10_000, -20_000, 5_000), vec3(0, 300, 0));
    expect(pass.distanceM).toBeCloseTo(10_000, 6);
    expect(pass.timeS).toBeCloseTo(20_000 / 300, 6);
  });

  it('gives a negative time for traffic flying away', () => {
    expect(closestApproachToOrigin(vec3(0, 5_000, 0), vec3(0, 100, 0)).timeS).toBeLessThan(0);
  });

  it('measures the closest approach to any point', () => {
    // Flying east along y = 3 km, from x = −10 km: passes 1 km from (0, 2 km) in 50 s at 200 m/s.
    const pass = closestApproachTo(vec3(0, 2_000, 0), vec3(-10_000, 3_000, 500), vec3(200, 0, 0));
    expect(pass.distanceM).toBeCloseTo(1_000, 6);
    expect(pass.timeS).toBeCloseTo(50, 6);
  });

  it('names the defended asset a course threatens soonest', () => {
    // Heading straight for the town from 20 km east of it, at 250 m/s.
    const town = DEFAULT_ASSETS[1]?.position ?? vec3(0, 0, 0);
    const threat = evaluateThreat(
      vec3(town.x + 20_000, town.y, 50),
      vec3(-250, 0, 0),
      DEFAULT_ASSETS,
    );
    // It passes the battery's 5 km zone first? The battery is 6.5 km east of the town and 4 km
    // south of this course: inside its threat radius, and reached sooner.
    expect(threat?.assetId).toBe(0);
    // Far to the north of everything, it threatens nothing.
    expect(evaluateThreat(vec3(20_000, 30_000, 50), vec3(-250, 0, 0), DEFAULT_ASSETS)).toBeNull();
    // Coming at the power plant from the south-east, it threatens the power plant only.
    const plant = DEFAULT_ASSETS[2]?.position ?? vec3(0, 0, 0);
    const pass = evaluateThreat(
      vec3(plant.x + 10_000, plant.y - 10_000, 50),
      vec3(-200, 200, 0),
      DEFAULT_ASSETS,
    );
    expect(pass?.assetId).toBe(2);
    expect(pass?.timeToClosestS).toBeCloseTo(50, 6);
  });
});

describe('predicted intercept point', () => {
  const reach = (t: number) => 1_000 * t; // a simple 1 km/s interceptor

  it('meets a head-on target where the two distances add up', () => {
    // 30 km away, closing at 500 m/s: they meet after 30 / (1 + 0.5) = 20 s, 20 km out.
    const plan = predictIntercept(vec3(0, 30_000, 0), vec3(0, -500, 0), vec3(0, 0, 0), reach, 40);
    expect(plan?.timeS).toBeCloseTo(20, 6);
    expect(plan?.point.y).toBeCloseTo(20_000, 3);
  });

  it('gives up when the interceptor cannot get there in time', () => {
    expect(predictIntercept(vec3(0, 30_000, 0), vec3(0, -500, 0), vec3(0, 0, 0), reach, 10)).toBe(
      null,
    );
  });
});
