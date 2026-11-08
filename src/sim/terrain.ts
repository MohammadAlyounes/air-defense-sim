/**
 * Procedural, fictional terrain: rolling hills and a few ridges around a flat valley where the
 * battery stands. Generated from a seed with value noise, so it matches no real place
 * (see SAFETY.md) and the same seed always gives the same landscape.
 *
 * Heights are metres above the battery's ground (the origin of the East-North-Up frame), so
 * the radar site is at height 0 and hills rise to several hundred metres.
 */

export interface TerrainConfig {
  /** Seed of the landscape. Independent of the simulation seed: same map, different runs. */
  seed: number;
  /** The grid covers a square of this half-width around the battery, m. */
  halfSizeM: number;
  /** Grid points per side. Heights between them are interpolated bilinearly. */
  gridSize: number;
  /** Height of the tallest hills, m. */
  reliefM: number;
  /** Size of the largest hills, m. */
  featureSizeM: number;
  /** The ground is flat within this distance of the battery, then blends into the hills, m. */
  flatRadiusM: number;
  /** Distance over which the flat valley blends into the hills, m. */
  blendM: number;
}

export const DEFAULT_TERRAIN: TerrainConfig = {
  seed: 7,
  halfSizeM: 50_000,
  gridSize: 257,
  reliefM: 900,
  featureSizeM: 16_000,
  flatRadiusM: 3_000,
  blendM: 6_000,
};

/** A height map: elevation at any ground point, from a precomputed grid. */
export interface Terrain {
  readonly config: TerrainConfig;
  /** Grid spacing, m. */
  readonly cellM: number;
  /** Grid heights, row by row from south-west (row = north index, column = east index), m. */
  readonly heights: Float32Array;
  readonly maxHeightM: number;
  /** Ground height at (east, north), m. Outside the grid the edge height continues. */
  heightAt(eastM: number, northM: number): number;
}

/** Hash of an integer lattice point and the seed to [0, 1): the random height at that point. */
function latticeValue(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

/** Smoothly interpolated value noise in [0, 1). */
function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = latticeValue(ix, iy, seed);
  const b = latticeValue(ix + 1, iy, seed);
  const c = latticeValue(ix, iy + 1, seed);
  const d = latticeValue(ix + 1, iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Height before the valley is cut out, in [0, 1]: four octaves of value noise for rolling hills,
 * plus a ridged octave (1 − |2n − 1|) that draws sharp crests, the kind that hide low flyers.
 */
function rawHeight(x: number, y: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  for (let octave = 0; octave < 4; octave++) {
    // Each octave is turned by a different angle, so no feature lines up with the lattice.
    const [u, v] = rotate(x * frequency, y * frequency, 0.6 + octave * 1.1);
    sum += amplitude * valueNoise(u, v, seed + octave * 101);
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  const [u, v] = rotate(x * 0.7 + 17.3, y * 0.7 - 5.1, 2.3);
  const ridge = 1 - Math.abs(2 * valueNoise(u, v, seed + 977) - 1);
  const hills = sum / 0.9375; // the four amplitudes add up to 0.9375
  return Math.min(1, Math.max(0, 0.55 * hills + 0.45 * ridge ** 3));
}

function rotate(x: number, y: number, angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x - s * y, s * x + c * y];
}

export function createTerrain(overrides: Partial<TerrainConfig> = {}): Terrain {
  const config: TerrainConfig = { ...DEFAULT_TERRAIN, ...overrides };
  const n = config.gridSize;
  const cellM = (2 * config.halfSizeM) / (n - 1);
  const heights = new Float32Array(n * n);
  let maxHeightM = 0;
  for (let row = 0; row < n; row++) {
    const northM = -config.halfSizeM + row * cellM;
    for (let col = 0; col < n; col++) {
      const eastM = -config.halfSizeM + col * cellM;
      const r = Math.hypot(eastM, northM);
      const blend = smoothStep01((r - config.flatRadiusM) / config.blendM);
      const base = rawHeight(
        eastM / config.featureSizeM,
        northM / config.featureSizeM,
        config.seed,
      );
      // Lower the noise floor so valleys reach the ground, then scale to the relief.
      const h = config.reliefM * blend * Math.max(0, (base - 0.18) / 0.82) ** 1.6;
      heights[row * n + col] = h;
      if (h > maxHeightM) maxHeightM = h;
    }
  }
  return {
    config,
    cellM,
    heights,
    maxHeightM,
    heightAt: (eastM, northM) => sampleGrid(heights, n, config.halfSizeM, cellM, eastM, northM),
  };
}

/** A flat world (height 0 everywhere): for tests and for comparing with the real landscape. */
export function flatTerrain(): Terrain {
  const config = { ...DEFAULT_TERRAIN, gridSize: 2, reliefM: 0 };
  return {
    config,
    cellM: 2 * config.halfSizeM,
    heights: new Float32Array(4),
    maxHeightM: 0,
    heightAt: () => 0,
  };
}

function smoothStep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function sampleGrid(
  heights: Float32Array,
  n: number,
  halfSizeM: number,
  cellM: number,
  eastM: number,
  northM: number,
): number {
  const gx = Math.min(n - 1, Math.max(0, (eastM + halfSizeM) / cellM));
  const gy = Math.min(n - 1, Math.max(0, (northM + halfSizeM) / cellM));
  const col = Math.min(n - 2, Math.floor(gx));
  const row = Math.min(n - 2, Math.floor(gy));
  const fx = gx - col;
  const fy = gy - row;
  const i = row * n + col;
  const a = heights[i] ?? 0;
  const b = heights[i + 1] ?? 0;
  const c = heights[i + n] ?? 0;
  const d = heights[i + n + 1] ?? 0;
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
