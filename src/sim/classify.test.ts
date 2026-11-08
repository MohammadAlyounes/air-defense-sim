import { describe, expect, it } from 'vitest';
import { flightProfile, looksLikeThreat, THREAT_PROFILES } from './classify';
import { TRAFFIC, type AircraftType } from './traffic';

describe('the kinematic classifier', () => {
  it('sorts each traffic type by its own speed and height', () => {
    const profileOf = (type: AircraftType) => {
      const { speedMps, altitudeM } = TRAFFIC[type];
      // Over flat ground at the battery's height, height above the ground equals altitude.
      return flightProfile(speedMps, altitudeM, altitudeM);
    };
    expect(profileOf('drone')).toBe('slow'); // 40 m/s
    expect(profileOf('cruise')).toBe('lowFast'); // 240 m/s, 50 m above the ground
    expect(profileOf('jet')).toBe('fast'); // 340 m/s
    expect(profileOf('airliner')).toBe('airliner'); // 230 m/s at 11 km
    expect(profileOf('friendly')).toBe('aircraft'); // 200 m/s at 4 km
  });

  it('draws each line at its threshold', () => {
    expect(flightProfile(79.9, 1_000, 1_000)).toBe('slow');
    expect(flightProfile(80, 1_000, 1_000)).toBe('aircraft');
    expect(flightProfile(120, 299, 299)).toBe('lowFast');
    expect(flightProfile(119, 50, 50)).toBe('aircraft');
    expect(flightProfile(150, 300, 300)).toBe('aircraft');
    expect(flightProfile(290, 5_000, 5_000)).toBe('fast');
    expect(flightProfile(289, 5_000, 5_000)).toBe('aircraft');
    expect(flightProfile(180, 8_000, 8_000)).toBe('airliner');
    expect(flightProfile(179, 8_000, 8_000)).toBe('aircraft');
    expect(flightProfile(230, 7_999, 7_999)).toBe('aircraft');
  });

  it('applies the tests in order: slow first, then low and fast, then fast', () => {
    // A slow track is slow at any height, even an airliner's.
    expect(flightProfile(60, 11_000, 11_000)).toBe('slow');
    // A fast track low over the ground is low and fast, even at a jet's speed.
    expect(flightProfile(340, 100, 100)).toBe('lowFast');
    // A jet's speed at an airliner's height is still fast.
    expect(flightProfile(300, 11_000, 11_000)).toBe('fast');
  });

  it('judges "low" by the height above the ground below, "airliner" by the altitude', () => {
    // 240 m/s, 1,100 m above the battery but 100 m above a hill: low and fast.
    expect(flightProfile(240, 100, 1_100)).toBe('lowFast');
    // 230 m/s, 8.5 km above the battery and 7.5 km above a mountain: still an airliner's height.
    expect(flightProfile(230, 7_500, 8_500)).toBe('airliner');
  });

  it('calls only the slow, low-and-fast and fast profiles threat-like', () => {
    expect(THREAT_PROFILES).toEqual(['slow', 'lowFast', 'fast']);
    expect(looksLikeThreat('slow')).toBe(true);
    expect(looksLikeThreat('lowFast')).toBe(true);
    expect(looksLikeThreat('fast')).toBe(true);
    expect(looksLikeThreat('airliner')).toBe(false);
    expect(looksLikeThreat('aircraft')).toBe(false);
    expect(looksLikeThreat(null)).toBe(false);
  });
});
