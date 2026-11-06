import { describe, expect, it } from 'vitest';
import { DEFAULT_SEED, formatSpeedLabel, parseLaunchOptions } from './params';

describe('parseLaunchOptions', () => {
  it('starts the default run, playing, at normal speed', () => {
    expect(parseLaunchOptions('')).toEqual({
      seed: DEFAULT_SEED,
      startAtS: 0,
      paused: false,
      speed: 1,
    });
  });

  it('reads seed, start time, pause and speed from the URL', () => {
    expect(parseLaunchOptions('?seed=7&t=60&paused=1&speed=4')).toEqual({
      seed: 7,
      startAtS: 60,
      paused: true,
      speed: 4,
    });
  });

  it('ignores invalid values', () => {
    const options = parseLaunchOptions('?seed=abc&t=-5&speed=3');
    expect(options.seed).toBe(DEFAULT_SEED);
    expect(options.startAtS).toBe(0);
    expect(options.speed).toBe(1);
    expect(parseLaunchOptions('?seed=-4').seed).toBe(DEFAULT_SEED);
  });

  it('caps fast-forward at one hour', () => {
    expect(parseLaunchOptions('?t=99999').startAtS).toBe(3600);
  });

  it('starts paused for people who prefer reduced motion, unless the URL says otherwise', () => {
    expect(parseLaunchOptions('', true).paused).toBe(true);
    expect(parseLaunchOptions('?paused=0', true).paused).toBe(false);
  });
});

describe('formatSpeedLabel', () => {
  it('uses fractions for slow motion', () => {
    expect(formatSpeedLabel(0.25)).toBe('¼×');
    expect(formatSpeedLabel(0.5)).toBe('½×');
    expect(formatSpeedLabel(16)).toBe('16×');
  });
});
