import { describe, expect, it } from 'vitest';
import { EXPONENTIAL_ATMOSPHERE as air } from './atmosphere';

describe('exponential atmosphere', () => {
  it('starts at 1.225 kg/m³ and thins by a factor e every 8.5 km', () => {
    expect(air.densityKgM3(0)).toBeCloseTo(1.225, 9);
    expect(air.densityKgM3(8_500)).toBeCloseTo(1.225 / Math.E, 9);
    // Half the sea-level density at 8.5 km × ln 2 = 5.9 km.
    expect(air.densityKgM3(8_500 * Math.LN2)).toBeCloseTo(0.6125, 9);
  });
});
