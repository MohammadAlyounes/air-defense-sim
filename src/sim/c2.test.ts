import { describe, expect, it } from 'vitest';
import { closestApproachToOrigin, iffAnswer, predictIntercept } from './c2';
import { vec3 } from './core/vec';

describe('identification', () => {
  it('trusts the identification answer: friends reply, civil aircraft squawk, others are hostile', () => {
    expect(iffAnswer('friend')).toBe('friend');
    expect(iffAnswer('neutral')).toBe('neutral');
    expect(iffAnswer('hostile')).toBe('hostile');
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
