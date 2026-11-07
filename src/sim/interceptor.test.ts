import { describe, expect, it } from 'vitest';
import { predictIntercept } from './c2';
import { distance, sub, vec3, type Vec3 } from './core/vec';
import {
  closestApproach,
  DEFAULT_INTERCEPTOR as I,
  GRAVITY_MPS2,
  guidanceAcceleration,
  launchVelocity,
  reachM,
  stepMissile,
} from './interceptor';

describe('proportional navigation', () => {
  it('commands nothing but gravity compensation on a collision course', () => {
    // Head-on, same line: the line of sight never turns.
    const a = guidanceAcceleration(
      vec3(0, 0, 1000),
      vec3(0, 500, 0),
      vec3(0, 5000, 1000),
      vec3(0, -300, 0),
      I,
    );
    expect(a.x).toBeCloseTo(0, 9);
    expect(a.y).toBeCloseTo(0, 9);
    expect(a.z).toBeCloseTo(GRAVITY_MPS2, 9);
  });

  it('steers toward where the target is going: a = N · Vc · LOS rate', () => {
    // Target 5 km ahead, crossing east at 100 m/s; interceptor at 500 m/s.
    // Closing speed 500 m/s, line-of-sight rate 100 / 5000 = 0.02 rad/s:
    // a = 4 × 500 × 0.02 = 40 m/s² east, plus gravity compensation.
    const a = guidanceAcceleration(
      vec3(0, 0, 0),
      vec3(0, 500, 0),
      vec3(0, 5000, 0),
      vec3(100, 0, 0),
      I,
    );
    expect(a.x).toBeCloseTo(40, 9);
    expect(a.y).toBeCloseTo(0, 9);
    expect(a.z).toBeCloseTo(GRAVITY_MPS2, 9);
  });

  it('never steers harder than the g-limit', () => {
    const a = guidanceAcceleration(
      vec3(0, 0, 0),
      vec3(0, 800, 0),
      vec3(0, 300, 0),
      vec3(900, 0, 0),
      I,
    );
    expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(I.maxLateralAccelMps2, 9);
  });
});

describe('interceptor flight', () => {
  it('launches toward its aim point, at least 15° up', () => {
    const v = launchVelocity(vec3(0, 0, 0), vec3(0, 10_000, 100), I);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(I.launchSpeedMps, 9);
    expect(Math.atan2(v.z, Math.hypot(v.x, v.y))).toBeCloseTo(I.minLaunchElevationRad, 9);
    expect(v.x).toBeCloseTo(0, 9);
  });

  it('reaches 1.6 km by the end of a 4 s boost, then flies on at 760 m/s', () => {
    expect(reachM(4, I)).toBeCloseTo(40 * 4 + 0.5 * 180 * 16, 9); // 1,600 m
    expect(reachM(14, I)).toBeCloseTo(1_600 + 760 * 10, 9); // 9,200 m
  });

  it('finds the closest approach inside a step, analytically', () => {
    // Relative position goes from (100, 0) to (−100, 10): closest at 49.9% of the step.
    const pass = closestApproach(vec3(100, 0, 0), vec3(-100, 10, 0));
    expect(pass.fraction).toBeCloseTo(20_000 / 40_100, 9);
    expect(pass.distanceM).toBeCloseTo(4.9938, 3);
    // Still closing at the end of the step: not there yet.
    expect(closestApproach(vec3(1000, 0, 0), vec3(900, 0, 0)).fraction).toBe(1);
  });

  it('hits a crossing target: proportional navigation from launch to fuze', () => {
    const target = { position: vec3(-6_000, 12_000, 3_000), velocity: vec3(300, 0, 0) };
    const plan = predictIntercept(
      target.position,
      target.velocity,
      vec3(0, 0, 0),
      (t) => 0.9 * reachM(t, I),
      34,
    );
    expect(plan).not.toBeNull();

    let missile = {
      position: vec3(0, 0, 0),
      velocity: launchVelocity(vec3(0, 0, 0), plan?.point ?? vec3(0, 0, 0), I),
    };
    const dt = 0.002;
    let targetPos: Vec3 = target.position;
    let miss = Number.POSITIVE_INFINITY;
    let flight = 0;
    for (; flight < I.maxFlightS; flight += dt) {
      const next = stepMissile(missile, flight, targetPos, target.velocity, dt, I);
      const nextTarget = vec3(targetPos.x + 300 * dt, targetPos.y, targetPos.z);
      const pass = closestApproach(
        sub(targetPos, missile.position),
        sub(nextTarget, next.position),
      );
      missile = next;
      targetPos = nextTarget;
      if (flight >= I.armAfterS && pass.fraction < 1) {
        miss = pass.distanceM;
        break;
      }
    }
    expect(miss).toBeLessThan(I.lethalRadiusM);
    // It arrives close to the planned time (the plan keeps a 10% margin).
    expect(flight).toBeLessThan(plan?.timeS ?? 0);
    expect(distance(missile.position, targetPos)).toBeLessThan(I.lethalRadiusM * 2);
  });
});
