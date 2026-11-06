import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

const take = (n: number, draw: () => number) => Array.from({ length: n }, draw);

describe('Rng (seeded random numbers)', () => {
  it('repeats exactly the same sequence for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    expect(take(1000, () => a.next())).toEqual(take(1000, () => b.next()));
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    expect(take(10, () => a.nextUint32())).not.toEqual(take(10, () => b.nextUint32()));
  });

  it('keeps uniform values in [0, 1) with a mean near 0.5', () => {
    const rng = new Rng(7);
    let min = 1;
    let max = 0;
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const x = rng.next();
      min = Math.min(min, x);
      max = Math.max(max, x);
      sum += x;
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThan(1);
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('resumes exactly from a saved state', () => {
    const rng = new Rng(99);
    rng.next();
    rng.next();
    const saved = rng.state();
    const expected = take(5, () => rng.next());
    const restored = Rng.fromState(saved);
    expect(take(5, () => restored.next())).toEqual(expected);
  });

  it('draws normal samples with the requested mean and spread', () => {
    const rng = new Rng(3);
    const n = 50_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = rng.normal(10, 2);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    expect(mean).toBeCloseTo(10, 1);
    expect(Math.sqrt(sumSq / n - mean * mean)).toBeCloseTo(2, 1);
  });

  it('covers every integer of an inclusive range', () => {
    const rng = new Rng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(rng.int(1, 6));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('picks weighted items in proportion to their weights', () => {
    const rng = new Rng(11);
    const items = [
      { value: 'a', weight: 3 },
      { value: 'b', weight: 1 },
    ];
    let heavy = 0;
    for (let i = 0; i < 10_000; i++) if (rng.weighted(items) === 'a') heavy++;
    expect(heavy / 10_000).toBeCloseTo(0.75, 1);
  });
});
