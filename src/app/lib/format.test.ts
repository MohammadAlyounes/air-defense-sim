import { describe, expect, it } from 'vitest';
import {
  formatAltitude,
  formatAltitudeShort,
  formatCountdown,
  formatSimClock,
  formatSpeed,
} from './format';

describe('formatSimClock', () => {
  it('shows minutes, seconds and tenths', () => {
    expect(formatSimClock(0)).toBe('T+00:00.0');
    expect(formatSimClock(84.27)).toBe('T+01:24.2');
    expect(formatSimClock(3600)).toBe('T+60:00.0');
  });

  it('never rounds up into a moment that has not happened yet', () => {
    expect(formatSimClock(59.99)).toBe('T+00:59.9');
  });

  it('clamps negative time to zero', () => {
    expect(formatSimClock(-5)).toBe('T+00:00.0');
  });
});

describe('formatCountdown', () => {
  it('rounds up, so 00:00 means "now"', () => {
    expect(formatCountdown(41.2)).toBe('00:42');
    expect(formatCountdown(60)).toBe('01:00');
    expect(formatCountdown(0)).toBe('00:00');
  });

  it('shows a dash when there is nothing to count down to', () => {
    expect(formatCountdown(null)).toBe('—');
    expect(formatCountdown(Number.POSITIVE_INFINITY)).toBe('—');
  });
});

describe('speed and altitude', () => {
  it('formats with units and digit grouping', () => {
    expect(formatSpeed(240)).toBe('240 m/s');
    expect(formatAltitude(11_000, 'MSL')).toBe('11,000 m');
    expect(formatAltitude(50, 'AGL')).toBe('50 m above ground');
  });

  it('shortens altitudes for tight spaces', () => {
    expect(formatAltitudeShort(50)).toBe('50 m');
    expect(formatAltitudeShort(6000)).toBe('6 km');
    expect(formatAltitudeShort(1500)).toBe('1.5 km');
  });
});
