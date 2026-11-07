/**
 * A constant-velocity Kalman filter in three dimensions: the textbook way to turn noisy
 * position measurements into a smooth estimate of position and velocity, with an honest
 * measure of how uncertain that estimate is.
 *
 * State x = [px, py, pz, vx, vy, vz] (m, m/s); covariance P is 6 × 6, row-major.
 * Each cycle has two halves:
 *
 *   predict:  x ← F·x,            P ← F·P·Fᵀ + Q      (move on, grow less certain)
 *   update:   K = P·Hᵀ·S⁻¹,  x ← x + K·(z − H·x),  P ← (I − K·H)·P   (blend in the measurement)
 *
 * with S = H·P·Hᵀ + R the innovation covariance. H picks the position out of the state.
 */

export type Vector = readonly number[];
/** A square matrix, row-major. */
export type Matrix = readonly number[];

export interface KalmanState {
  /** [px, py, pz, vx, vy, vz]. */
  x: Vector;
  /** 6 × 6 covariance, row-major. */
  P: Matrix;
}

/** How much a target may change its velocity unannounced: white-noise acceleration, m²/s³. */
export interface ProcessNoise {
  horizontal: number;
  vertical: number;
}

const N = 6;

/** Matrix product of an (r × k) and a (k × c) matrix, row-major. */
export function multiply(a: Matrix, b: Matrix, r: number, k: number, c: number): number[] {
  const out = new Array<number>(r * c).fill(0);
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      let sum = 0;
      for (let m = 0; m < k; m++) sum += (a[i * k + m] ?? 0) * (b[m * c + j] ?? 0);
      out[i * c + j] = sum;
    }
  }
  return out;
}

export function transpose(a: Matrix, r: number, c: number): number[] {
  const out = new Array<number>(r * c);
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) out[j * r + i] = a[i * c + j] ?? 0;
  return out;
}

/** Inverse of a 3 × 3 matrix by cofactors; null if it is singular. */
export function invert3(m: Matrix): number[] | null {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0, i = 0] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    A * k,
    -(b * i - c * h) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    -(a * f - c * d) * k,
    C * k,
    -(a * h - b * g) * k,
    (a * e - b * d) * k,
  ];
}

/** Starts a filter at a measured position with unknown velocity. */
export function initialState(
  position: Vector,
  positionCovariance: Matrix,
  velocitySigma: { horizontal: number; vertical: number },
): KalmanState {
  const P = new Array<number>(N * N).fill(0);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) P[i * N + j] = positionCovariance[i * 3 + j] ?? 0;
  P[3 * N + 3] = velocitySigma.horizontal ** 2;
  P[4 * N + 4] = velocitySigma.horizontal ** 2;
  P[5 * N + 5] = velocitySigma.vertical ** 2;
  return { x: [position[0] ?? 0, position[1] ?? 0, position[2] ?? 0, 0, 0, 0], P };
}

/**
 * Moves the estimate on by `dt` seconds at constant velocity, and grows its uncertainty by the
 * process noise. For one axis with spectral density q:
 *
 *   Q = q · [[dt³/3, dt²/2], [dt²/2, dt]]
 */
export function predict(state: KalmanState, dt: number, noise: ProcessNoise): KalmanState {
  if (dt <= 0) return state;
  const F = identity();
  for (let i = 0; i < 3; i++) F[i * N + i + 3] = dt;
  const x = multiply(F, state.x, N, N, 1);
  const P = multiply(multiply(F, state.P, N, N, N), transpose(F, N, N), N, N, N);
  for (let axis = 0; axis < 3; axis++) {
    const q = axis === 2 ? noise.vertical : noise.horizontal;
    const p = axis;
    const v = axis + 3;
    P[p * N + p] = (P[p * N + p] ?? 0) + (q * dt ** 3) / 3;
    P[p * N + v] = (P[p * N + v] ?? 0) + (q * dt ** 2) / 2;
    P[v * N + p] = (P[v * N + p] ?? 0) + (q * dt ** 2) / 2;
    P[v * N + v] = (P[v * N + v] ?? 0) + q * dt;
  }
  return { x, P };
}

export interface Innovation {
  /** z − H·x: how far the measurement is from where the filter expected it, m. */
  y: number[];
  /** S = H·P·Hᵀ + R, 3 × 3. */
  S: number[];
  /** S⁻¹, or null if S is singular. */
  Sinv: number[] | null;
  /**
   * Normalized innovation squared, yᵀ·S⁻¹·y: the squared distance in standard deviations. For
   * a measurement that belongs to the track it follows a chi-square law with 3 degrees of freedom.
   */
  nis: number;
}

export function innovation(state: KalmanState, z: Vector, R: Matrix): Innovation {
  const y = [0, 1, 2].map((i) => (z[i] ?? 0) - (state.x[i] ?? 0));
  const S = [0, 1, 2].flatMap((i) =>
    [0, 1, 2].map((j) => (state.P[i * N + j] ?? 0) + (R[i * 3 + j] ?? 0)),
  );
  const Sinv = invert3(S);
  const nis = Sinv ? (multiply(multiply(y, Sinv, 1, 3, 3), y, 1, 3, 1)[0] ?? Infinity) : Infinity;
  return { y, S, Sinv, nis };
}

/** Blends a position measurement `z` (covariance R) into the estimate. Joseph form, for stability. */
export function update(state: KalmanState, z: Vector, R: Matrix): KalmanState {
  const { y, Sinv } = innovation(state, z, R);
  if (!Sinv) return state;
  // P·Hᵀ is the first three columns of P.
  const PHt = new Array<number>(N * 3);
  for (let i = 0; i < N; i++) for (let j = 0; j < 3; j++) PHt[i * 3 + j] = state.P[i * N + j] ?? 0;
  const K = multiply(PHt, Sinv, N, 3, 3);
  const dx = multiply(K, y, N, 3, 1);
  const x = state.x.map((v, i) => v + (dx[i] ?? 0));
  // I − K·H
  const IKH = identity();
  for (let i = 0; i < N; i++)
    for (let j = 0; j < 3; j++) IKH[i * N + j] = (IKH[i * N + j] ?? 0) - (K[i * 3 + j] ?? 0);
  const left = multiply(multiply(IKH, state.P, N, N, N), transpose(IKH, N, N), N, N, N);
  const KRKt = multiply(multiply(K, R, N, 3, 3), transpose(K, N, 3), N, 3, N);
  const P = left.map((v, i) => v + (KRKt[i] ?? 0));
  return { x, P };
}

/**
 * Measurement covariance in east-north-up metres for a radar measuring slant range, bearing
 * and elevation with independent errors: R = J · diag(σr², σaz², σel²) · Jᵀ, where J is the
 * Jacobian of the spherical-to-Cartesian conversion. Bearing errors stretch the ellipse
 * sideways, more the farther out the target is. Each sigma has a 1 m (or 1 mrad) floor.
 */
export function measurementCovariance(
  rangeM: number,
  azimuthRad: number,
  elevationRad: number,
  sigma: { rangeM: number; azimuthRad: number; elevationRad: number },
): number[] {
  const sr = Math.max(1, sigma.rangeM);
  const sa = Math.max(1e-3, sigma.azimuthRad);
  const se = Math.max(1e-3, sigma.elevationRad);
  const [ca, sa_, ce, se_] = [
    Math.cos(azimuthRad),
    Math.sin(azimuthRad),
    Math.cos(elevationRad),
    Math.sin(elevationRad),
  ];
  // Columns: ∂/∂range, ∂/∂azimuth, ∂/∂elevation.
  // prettier-ignore
  const J = [
    ce * sa_, rangeM * ce * ca, -rangeM * se_ * sa_,
    ce * ca, -rangeM * ce * sa_, -rangeM * se_ * ca,
    se_, 0, rangeM * ce,
  ];
  const D = [sr * sr, 0, 0, 0, sa * sa, 0, 0, 0, se * se];
  return multiply(multiply(J, D, 3, 3, 3), transpose(J, 3, 3), 3, 3, 3);
}

/**
 * The horizontal uncertainty ellipse from a covariance: semi-axes (one standard deviation, m)
 * and the direction of the major axis, as a compass bearing (rad).
 */
export function horizontalEllipse(P: Matrix): {
  majorM: number;
  minorM: number;
  bearingRad: number;
} {
  const a = P[0] ?? 0; // east-east
  const b = P[1] ?? 0; // east-north
  const c = P[N + 1] ?? 0; // north-north
  const mean = (a + c) / 2;
  const spread = Math.sqrt(((a - c) / 2) ** 2 + b * b);
  // Angle of the major axis from east, counter-clockwise; turned into a compass bearing.
  const fromEast = 0.5 * Math.atan2(2 * b, a - c);
  return {
    majorM: Math.sqrt(Math.max(0, mean + spread)),
    minorM: Math.sqrt(Math.max(0, mean - spread)),
    bearingRad: Math.PI / 2 - fromEast,
  };
}

function identity(): number[] {
  const I = new Array<number>(N * N).fill(0);
  for (let i = 0; i < N; i++) I[i * N + i] = 1;
  return I;
}
