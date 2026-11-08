import { describe, expect, it } from 'vitest';
import {
  EXPONENTIAL_ATMOSPHERE as exponential,
  STANDARD_ATMOSPHERE,
  standardAtmosphere,
} from './atmosphere';

describe('exponential atmosphere', () => {
  it('starts at 1.225 kg/m³ and thins by a factor e every 8.5 km', () => {
    expect(exponential.densityKgM3(0)).toBeCloseTo(1.225, 9);
    expect(exponential.densityKgM3(8_500)).toBeCloseTo(1.225 / Math.E, 9);
    // Half the sea-level density at 8.5 km × ln 2 = 5.9 km.
    expect(exponential.densityKgM3(8_500 * Math.LN2)).toBeCloseTo(0.6125, 9);
  });
});

describe('International Standard Atmosphere', () => {
  it('matches the published table at sea level', () => {
    const air = standardAtmosphere(0);
    expect(air.temperatureK).toBeCloseTo(288.15, 9);
    expect(air.pressurePa).toBeCloseTo(101_325, 6);
    expect(air.densityKgM3).toBeCloseTo(1.225, 3);
    expect(air.speedOfSoundMps).toBeCloseTo(340.29, 1);
  });

  it('cools by 6.5 °C per km in the troposphere', () => {
    // ISA table: 5 km is 255.65 K, 54,020 Pa, 0.7364 kg/m³, 320.5 m/s.
    const air = standardAtmosphere(5_000);
    expect(air.temperatureK).toBeCloseTo(255.65, 9);
    expect(air.pressurePa).toBeCloseTo(54_020, -1);
    expect(air.densityKgM3).toBeCloseTo(0.7364, 3);
    expect(air.speedOfSoundMps).toBeCloseTo(320.5, 0);
  });

  it('holds −56.5 °C from 11 km to 20 km', () => {
    // ISA table: 11 km is 216.65 K, 22,632 Pa, 0.3639 kg/m³; 20 km is 5,475 Pa, 0.0880 kg/m³.
    const tropopause = standardAtmosphere(11_000);
    expect(tropopause.temperatureK).toBeCloseTo(216.65, 6);
    expect(tropopause.pressurePa).toBeCloseTo(22_632, -1);
    expect(tropopause.densityKgM3).toBeCloseTo(0.3639, 3);
    expect(standardAtmosphere(15_000).temperatureK).toBeCloseTo(216.65, 6);
    const twenty = standardAtmosphere(20_000);
    expect(twenty.pressurePa).toBeCloseTo(5_475, -1);
    expect(twenty.densityKgM3).toBeCloseTo(0.088, 3);
  });

  it('warms slowly above 20 km', () => {
    // ISA table: 25 km is 221.65 K, 2,511 Pa.
    const air = standardAtmosphere(25_000);
    expect(air.temperatureK).toBeCloseTo(221.65, 6);
    expect(air.pressurePa).toBeCloseTo(2_511, -1);
  });

  it('is continuous across the layer boundaries', () => {
    for (const h of [11_000, 20_000]) {
      const below = standardAtmosphere(h - 0.01).densityKgM3;
      const above = standardAtmosphere(h + 0.01).densityKgM3;
      expect(Math.abs(above - below) / below).toBeLessThan(1e-5);
    }
  });

  it('halves the density near 6.6 km, a little higher than the exponential model', () => {
    expect(STANDARD_ATMOSPHERE.densityKgM3(6_600)).toBeCloseTo(0.6125, 2);
    expect(STANDARD_ATMOSPHERE.densityKgM3(6_600)).toBeGreaterThan(exponential.densityKgM3(6_600));
  });
});
