import { describe, expect, it } from 'vitest';
import { Rng } from './core/rng';
import {
  horizontalEllipse,
  initialState,
  innovation,
  invert3,
  measurementCovariance,
  multiply,
  predict,
  update,
  type KalmanState,
} from './kalman';

const identity3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const at = (P: readonly number[], i: number, j: number) => P[i * 6 + j] ?? NaN;

describe('Kalman filter: predict', () => {
  it('moves the estimate on at its velocity', () => {
    const state: KalmanState = { x: [100, 200, 300, 10, -20, 1], P: new Array(36).fill(0) };
    const next = predict(state, 2, { horizontal: 0, vertical: 0 });
    expect(next.x).toEqual([120, 160, 302, 10, -20, 1]);
  });

  it('grows the uncertainty: P ← F·P·Fᵀ + Q with Q = q·[[dt³/3, dt²/2], [dt²/2, dt]]', () => {
    // Velocity known to ±10 m/s, position perfect: after 2 s, position variance (10·2)² = 400.
    const P = new Array(36).fill(0);
    P[3 * 6 + 3] = 100;
    const next = predict({ x: [0, 0, 0, 0, 0, 0], P }, 2, { horizontal: 3, vertical: 0 });
    expect(at(next.P, 0, 0)).toBeCloseTo(400 + (3 * 8) / 3, 9); // + q·dt³/3 = 8
    expect(at(next.P, 0, 3)).toBeCloseTo(200 + (3 * 4) / 2, 9); // cross term: 10²·2 + q·dt²/2
    expect(at(next.P, 3, 3)).toBeCloseTo(100 + 3 * 2, 9);
    expect(at(next.P, 1, 1)).toBeCloseTo(8, 9); // north: process noise only
    expect(at(next.P, 2, 2)).toBe(0); // vertical noise 0
  });
});

describe('Kalman filter: update', () => {
  it('meets halfway when the prediction and the measurement are equally uncertain', () => {
    const state = initialState([0, 0, 0], [100, 0, 0, 0, 100, 0, 0, 0, 100], {
      horizontal: 50,
      vertical: 50,
    });
    const next = update(state, [10, -20, 4], [100, 0, 0, 0, 100, 0, 0, 0, 100]);
    expect(next.x.slice(0, 3)).toEqual([5, -10, 2]);
    // The variance halves: 1/P' = 1/100 + 1/100.
    expect(at(next.P, 0, 0)).toBeCloseTo(50, 9);
  });

  it('learns the velocity from two measurements of a moving target', () => {
    const R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    let state = initialState([0, 0, 1000], R, { horizontal: 120, vertical: 30 });
    state = update(predict(state, 4, { horizontal: 4, vertical: 4 }), [800, 0, 1000], R);
    // 800 m in 4 s: 200 m/s east, almost exactly (the measurements are nearly perfect).
    expect(state.x[3]).toBeCloseTo(200, 0);
    expect(Math.abs(state.x[4] ?? 1)).toBeLessThan(0.5);
  });

  it('is consistent: the normalized innovation averages 3 (chi-square, 3 degrees of freedom)', () => {
    const rng = new Rng(42);
    const sigma = 50;
    const R = [sigma ** 2, 0, 0, 0, sigma ** 2, 0, 0, 0, sigma ** 2];
    // The truth flies perfectly straight, so the filter is told so (almost no process noise).
    const noise = { horizontal: 1e-6, vertical: 1e-6 };
    let truth = [0, 0, 0];
    const velocity = [150, -80, 5];
    let state = initialState(truth, R, { horizontal: 200, vertical: 50 });
    let sum = 0;
    let count = 0;
    for (let k = 1; k <= 400; k++) {
      truth = truth.map((p, i) => p + (velocity[i] ?? 0) * 4);
      const z = truth.map((p) => p + rng.normal(0, sigma));
      const predicted = predict(state, 4, noise);
      if (k > 10) {
        sum += innovation(predicted, z, R).nis;
        count++;
      }
      state = update(predicted, z, R);
    }
    expect(sum / count).toBeGreaterThan(2.6);
    expect(sum / count).toBeLessThan(3.4);
  });
});

describe('measurement geometry', () => {
  it('turns range, bearing and elevation errors into an ellipse in metres', () => {
    // Due north, level, 10 km out: bearing error 0.002 rad is 20 m east-west; range error is
    // north-south; elevation error is up-down.
    const R = measurementCovariance(10_000, 0, 0, {
      rangeM: 30,
      azimuthRad: 0.002,
      elevationRad: 0.004,
    });
    expect(R[0]).toBeCloseTo(20 ** 2, 6); // east
    expect(R[4]).toBeCloseTo(30 ** 2, 6); // north
    expect(R[8]).toBeCloseTo(40 ** 2, 6); // up
    expect(R[1]).toBeCloseTo(0, 6);
  });

  it('finds the ellipse axes and the bearing of the long one', () => {
    const P = new Array(36).fill(0);
    P[0] = 400; // east variance: 20 m
    P[7] = 100; // north variance: 10 m
    const e = horizontalEllipse(P);
    expect(e.majorM).toBeCloseTo(20, 9);
    expect(e.minorM).toBeCloseTo(10, 9);
    expect(e.bearingRad).toBeCloseTo(Math.PI / 2, 9); // the long axis points east
  });

  it('inverts 3 × 3 matrices', () => {
    const m = [2, 1, 0, 1, 3, 1, 0, 1, 4];
    const inv = invert3(m);
    expect(inv).not.toBeNull();
    const product = multiply(m, inv ?? [], 3, 3, 3);
    product.forEach((v, i) => expect(v).toBeCloseTo(identity3[i] ?? NaN, 12));
    expect(invert3([1, 2, 3, 2, 4, 6, 0, 0, 1])).toBeNull();
  });
});
