/** Saved generator state: four 32-bit words. Restoring it replays the exact same numbers. */
export type RngState = readonly [number, number, number, number];

const UINT32 = 4294967296;

/**
 * Seeded pseudo-random number generator (sfc32, "Small Fast Counter").
 *
 * The only source of randomness allowed inside `src/sim`: the same seed always produces the
 * same sequence, which is what makes every run repeatable. sfc32 passes the PractRand test
 * suite, keeps 128 bits of state and needs only 32-bit integer arithmetic.
 */
export class Rng {
  private a = 0;
  private b = 0;
  private c = 0;
  private d = 0;

  constructor(seed: number) {
    // Expand the 32-bit seed into 128 bits of state with splitmix32, then warm up.
    let s = seed >>> 0;
    const splitmix32 = () => {
      s = (s + 0x9e3779b9) | 0;
      let t = s ^ (s >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t ^= t >>> 15;
      t = Math.imul(t, 0x735a2d97);
      return (t ^ (t >>> 15)) >>> 0;
    };
    this.a = splitmix32();
    this.b = splitmix32();
    this.c = splitmix32();
    this.d = splitmix32();
    for (let i = 0; i < 12; i++) this.nextUint32();
  }

  /** Recreates a generator from a saved state. */
  static fromState(state: RngState): Rng {
    const rng = new Rng(0);
    [rng.a, rng.b, rng.c, rng.d] = state;
    return rng;
  }

  state(): RngState {
    return [this.a, this.b, this.c, this.d];
  }

  /** Next raw 32-bit unsigned integer. */
  nextUint32(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / UINT32;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max], both ends included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /**
   * Normally distributed sample (Box-Muller). Uses two uniforms per call and caches nothing,
   * so the generator state alone fully describes what comes next.
   */
  normal(mean = 0, sd = 1): number {
    const u1 = 1 - this.next(); // (0, 1]: avoids log(0)
    const u2 = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Picks one value, with probability proportional to its weight. */
  weighted<T>(items: readonly { value: T; weight: number }[]): T {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let r = this.next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r < 0) return item.value;
    }
    const last = items.at(-1);
    if (!last) throw new Error('Rng.weighted needs at least one item');
    return last.value;
  }
}
