import { describe, expect, it } from 'vitest';
import { vec3, type Vec3 } from './core/vec';
import { initialState } from './kalman';
import { associate, associateWithManeuvers, DEFAULT_TRACKER, trackPositionAt } from './tracker';
import type { Plot, Track } from './types';

const R = [100, 0, 0, 0, 100, 0, 0, 0, 100];

function track(id: number, position: Vec3, velocity: Vec3): Track {
  const estimate = initialState([position.x, position.y, position.z], R, {
    horizontal: 5,
    vertical: 5,
  });
  return {
    id,
    truthId: id,
    createdTick: 0,
    detectedRangeM: 0,
    paints: 2,
    lastPaintTick: 0,
    position,
    velocity,
    maneuvering: false,
    estimate: {
      ...estimate,
      x: [position.x, position.y, position.z, velocity.x, velocity.y, velocity.z],
    },
    confirmedTick: 0,
    profile: null,
    corridorId: null,
    identity: 'pending',
    iffChecks: 0,
    nextIffTick: null,
    threat: null,
    holdFireUntilTick: null,
    engagementId: null,
    interceptorsFired: 0,
  };
}

const plot = (tick: number, position: Vec3): Plot => ({
  tick,
  timeS: tick * 0.02,
  position,
  bearingRad: 0,
  rangeM: 0,
  radarSize: 'medium',
  truthId: null,
});

describe('association', () => {
  // Two tracks 600 m apart, flying toward each other at 100 m/s: in 4 s they have swapped sides
  // of their starting midpoint... almost.
  const a = track(1, vec3(0, 0, 1000), vec3(100, 0, 0));
  const b = track(2, vec3(600, 0, 1000), vec3(-100, 0, 0));

  it('gives each plot to the track whose prediction it fits best', () => {
    // After 2 s (100 ticks), A is predicted at 200 m and B at 400 m.
    const plots = [plot(100, vec3(395, 4, 1000)), plot(100, vec3(205, -3, 1000))];
    const owners = associate(plots, [R, R], [a, b], 50);
    expect(owners).toEqual([1, 0]);
  });

  it('leaves a plot outside every gate to start a new track', () => {
    const owners = associate([plot(100, vec3(5_000, 5_000, 1000))], [R], [a, b], 50);
    expect(owners).toEqual([-1]);
  });

  it('feeds a track at most once per antenna pass', () => {
    const fresh = { ...a, lastPaintTick: 90 };
    const owners = associate([plot(100, vec3(100, 0, 1000))], [R], [fresh], 50);
    expect(owners).toEqual([-1]);
  });

  it('lets a plot join a confirmed track through the maneuver gate after a hard turn', () => {
    // Flying east at 300 m/s, then 4 s of a 6 g turn: the echo lands about 460 m off the
    // straight-line prediction (1,200 m east), too far for the normal gate.
    const fast = track(1, vec3(0, 0, 1000), vec3(300, 0, 0));
    const turned = [plot(200, vec3(1_150, 460, 1000))];
    expect(associate(turned, [R], [fast], 50)).toEqual([0]);
    expect(associateWithManeuvers(turned, [R], [fast], 50).maneuvers).toEqual([true]);
    const normalOnly = { ...DEFAULT_TRACKER, maneuverNoise: null };
    expect(associate(turned, [R], [fast], 50, normalOnly)).toEqual([-1]);
    // A plot that fits the normal gate is no maneuver.
    const straight = [plot(200, vec3(1_203, 2, 1000))];
    expect(associateWithManeuvers(straight, [R], [fast], 50).maneuvers).toEqual([false]);
    // Tentative tracks, with no velocity yet, get no maneuver gate.
    const tentative = { ...fast, confirmedTick: null };
    expect(associate(turned, [R], [tentative], 50)).toEqual([-1]);
  });

  it('extrapolates a track at its filtered velocity', () => {
    expect(trackPositionAt(a, 150)).toEqual(vec3(300, 0, 1000)); // 3 s at 100 m/s
  });
});
