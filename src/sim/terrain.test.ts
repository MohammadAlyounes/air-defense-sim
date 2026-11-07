import { describe, expect, it } from 'vitest';
import { createTerrain, DEFAULT_TERRAIN, flatTerrain } from './terrain';

describe('procedural terrain', () => {
  const terrain = createTerrain();

  it('is the same landscape for the same seed, and a different one for another seed', () => {
    const again = createTerrain();
    const other = createTerrain({ seed: 8 });
    expect(again.heights).toEqual(terrain.heights);
    expect(other.heights).not.toEqual(terrain.heights);
  });

  it('keeps the battery on flat ground at height 0', () => {
    expect(terrain.heightAt(0, 0)).toBe(0);
    expect(terrain.heightAt(1_200, -1_600)).toBe(0);
  });

  it('rises into hills of a few hundred metres, never above the relief', () => {
    expect(terrain.maxHeightM).toBeGreaterThan(400);
    expect(terrain.maxHeightM).toBeLessThanOrEqual(DEFAULT_TERRAIN.reliefM);
    for (let i = 0; i < terrain.heights.length; i += 97) {
      expect(terrain.heights[i]).toBeGreaterThanOrEqual(0);
    }
  });

  it('interpolates smoothly between grid points', () => {
    const cell = terrain.cellM;
    const a = terrain.heightAt(20_000, 20_000);
    const b = terrain.heightAt(20_000 + cell / 10, 20_000);
    expect(Math.abs(b - a)).toBeLessThan(40);
  });

  it('can be flat, for tests and comparisons', () => {
    expect(flatTerrain().heightAt(12_345, -6_789)).toBe(0);
  });
});
