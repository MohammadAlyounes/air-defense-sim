import { describe, expect, it } from 'vitest';
import { vec3 } from './core/vec';
import {
  coverageAt,
  coverageMap,
  curvatureDropM,
  EFFECTIVE_EARTH_RADIUS_M,
  groundLit,
  inClutter,
  lineOfSight,
  radarHorizonM,
} from './propagation';
import { createTerrain, flatTerrain, type Terrain } from './terrain';

/** Flat ground with one 300 m wall running north-south, 10 km east of the radar. */
function wall(): Terrain {
  const flat = flatTerrain();
  return {
    ...flat,
    maxHeightM: 300,
    heightAt: (east) => (east > 9_900 && east < 10_100 ? 300 : 0),
  };
}

describe('radar horizon', () => {
  it('uses an Earth one third larger than the real one (the 4/3 model)', () => {
    expect(EFFECTIVE_EARTH_RADIUS_M).toBeCloseTo(8_494_667, 0);
    // Over 40 km the curved Earth falls 94 m below a flat map.
    expect(curvatureDropM(40_000)).toBeCloseTo(94.2, 1);
  });

  it('matches d ≈ 4.12 km × (√h₁ + √h₂)', () => {
    // A 12 m mast and a target at 50 m: 4.12 × (3.46 + 7.07) ≈ 43.4 km.
    expect(radarHorizonM(12, 50) / 1000).toBeCloseTo(4.122 * (Math.sqrt(12) + Math.sqrt(50)), 1);
    expect(radarHorizonM(12, 50)).toBeCloseTo(43_430, -2);
    // Higher targets are seen from much farther away.
    expect(radarHorizonM(12, 6_000)).toBeGreaterThan(300_000);
  });

  it('hides a low target beyond the horizon over smooth ground', () => {
    const antenna = vec3(0, 0, 12);
    // 30 m above the ground at 40 km: 4.12 × (√12 + √30) = 36.9 km, so it is below the horizon.
    const low = vec3(0, 40_000, 30);
    expect(lineOfSight(flatTerrain(), antenna, low)).toBe('horizon');
    // Raised to 150 m it comes into view (horizon 64.8 km).
    expect(lineOfSight(flatTerrain(), antenna, vec3(0, 40_000, 150))).toBe('visible');
  });
});

describe('terrain masking', () => {
  const antenna = vec3(0, 0, 12);

  it('blocks a target behind a ridge, but not one above its shadow', () => {
    // The wall at 10 km, 300 m tall: behind it at 20 km, the shadow reaches ~590 m
    // (twice the wall's height above the antenna, plus the curvature drop).
    expect(lineOfSight(wall(), antenna, vec3(20_000, 0, 400))).toBe('terrain');
    expect(lineOfSight(wall(), antenna, vec3(20_000, 0, 700))).toBe('visible');
    // In front of the wall, low targets are fine.
    expect(lineOfSight(wall(), antenna, vec3(8_000, 0, 50))).toBe('visible');
  });

  it('computes the lowest visible height behind the ridge in the coverage map', () => {
    const map = coverageMap(wall(), 12, 40_000, 360, 200);
    // Due east (bearing 90°), 20 km out: shadow height = 12 + (300 − 12) × 20/10 + drop terms.
    const expected =
      12 + ((300 - curvatureDropM(10_000) - 12) / 10_000) * 20_000 + curvatureDropM(20_000);
    expect(coverageAt(map, 20_000, 0)).toBeCloseTo(expected, -1);
    // Due north there is no wall: only the Earth's curve.
    expect(coverageAt(map, 0, 20_000)).toBeLessThan(10);
  });

  it('agrees with the line-of-sight check over the generated terrain', () => {
    const terrain = createTerrain();
    const map = coverageMap(terrain, 12, 40_000);
    let agree = 0;
    let total = 0;
    for (let b = 0; b < 360; b += 7) {
      for (const r of [8_000, 15_000, 25_000, 35_000]) {
        const east = r * Math.sin((b * Math.PI) / 180);
        const north = r * Math.cos((b * Math.PI) / 180);
        const minAgl = coverageAt(map, east, north);
        const ground = terrain.heightAt(east, north);
        // Well clear of the shadow's edge, both methods must give the same answer.
        for (const agl of [minAgl - 60, minAgl + 60]) {
          if (agl < 5) continue;
          total++;
          const visible = lineOfSight(terrain, vec3(0, 0, 12), vec3(east, north, ground + agl));
          if ((visible === 'visible') === agl > minAgl) agree++;
        }
      }
    }
    expect(agree / total).toBeGreaterThan(0.95);
  });
});

describe('ground clutter', () => {
  const antenna = vec3(0, 0, 12);

  it("lights flat ground out to the antenna's own horizon: 14.3 km from a 12 m mast", () => {
    expect(radarHorizonM(12, 0)).toBeCloseTo(14_278, -1);
    expect(groundLit(flatTerrain(), antenna, 0, 10_000)).toBe(true);
    expect(groundLit(flatTerrain(), antenna, 10_000, 10_000)).toBe(true);
    expect(groundLit(flatTerrain(), antenna, 0, 14_000)).toBe(true);
    expect(groundLit(flatTerrain(), antenna, 0, 14_500)).toBe(false);
  });

  it('lights the ground in front of a ridge and its top, but not the ground in its shadow', () => {
    expect(groundLit(wall(), antenna, 8_000, 0)).toBe(true);
    expect(groundLit(wall(), antenna, 10_000, 0)).toBe(true);
    expect(groundLit(wall(), antenna, 12_000, 0)).toBe(false);
    // Beside the ridge, the flat ground is lit as usual.
    expect(groundLit(wall(), antenna, -12_000, 0)).toBe(true);
  });

  it('puts a target in clutter when lit ground lies at its distance on the same bearing', () => {
    const flat = flatTerrain();
    // Low, 6 km out: the ground below it is lit.
    expect(inClutter(flat, antenna, vec3(0, 6_000, 300))).toBe(true);
    // 3 km up, 12 km out: 12.4 km away, where the ground is still lit.
    expect(inClutter(flat, antenna, vec3(0, 12_000, 3_000))).toBe(true);
    // 10 km up, 12 km out: 15.6 km away, where the ground is below the horizon.
    expect(inClutter(flat, antenna, vec3(0, 12_000, 10_000))).toBe(false);
    // Low, far out: no lit ground either.
    expect(inClutter(flat, antenna, vec3(0, 20_000, 50))).toBe(false);
    expect(inClutter(flat, antenna, vec3(0, 0, 2_000))).toBe(true);
  });

  it('agrees with the coverage map, where the lowest visible height is the ground itself', () => {
    const terrain = createTerrain();
    const map = coverageMap(terrain, 12, 40_000);
    let agree = 0;
    let total = 0;
    for (let b = 0; b < 360; b += 5) {
      for (const r of [3_000, 6_000, 10_000, 14_000, 20_000, 30_000]) {
        const east = r * Math.sin((b * Math.PI) / 180);
        const north = r * Math.cos((b * Math.PI) / 180);
        const minAgl = coverageAt(map, east, north);
        // Only clear cases: lit, or in a shadow deeper than 20 m.
        if (minAgl > 0.5 && minAgl < 20) continue;
        total++;
        if (groundLit(terrain, vec3(0, 0, 12), east, north) === minAgl <= 0.5) agree++;
      }
    }
    expect(total).toBeGreaterThan(200);
    expect(agree / total).toBeGreaterThan(0.95);
  });
});
