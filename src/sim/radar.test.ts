import { describe, expect, it } from 'vitest';
import { TICK_S } from './core/clock';
import { vec3 } from './core/vec';
import {
  antennaAzimuth,
  closingSpeedMps,
  DEFAULT_SEARCH_RADAR,
  detectionProbability,
  detectionRangeM,
  dopplerShiftHz,
  falseAlarmsPerTurn,
  inDopplerNotch,
  lookProbability,
  signalToNoise,
  sweptOver,
} from './radar';

const deg = (d: number) => (d * Math.PI) / 180;

describe('search radar sweep', () => {
  it('turns the antenna once per period, clockwise from north', () => {
    expect(antennaAzimuth(0, 4)).toBe(0);
    expect(antennaAzimuth(1, 4)).toBeCloseTo(Math.PI / 2);
    expect(antennaAzimuth(3, 4)).toBeCloseTo((3 * Math.PI) / 2);
    expect(antennaAzimuth(4, 4)).toBeCloseTo(0);
    expect(antennaAzimuth(5, 4)).toBeCloseTo(Math.PI / 2);
  });

  it('detects bearings inside the swept arc, including across north', () => {
    expect(sweptOver(deg(10), deg(20), deg(15))).toBe(true);
    expect(sweptOver(deg(10), deg(20), deg(20))).toBe(true); // end of the arc included
    expect(sweptOver(deg(10), deg(20), deg(10))).toBe(false); // start excluded
    expect(sweptOver(deg(10), deg(20), deg(25))).toBe(false);
    expect(sweptOver(deg(355), deg(5), deg(1))).toBe(true);
    expect(sweptOver(deg(355), deg(5), deg(358))).toBe(true);
    expect(sweptOver(deg(355), deg(5), deg(340))).toBe(false);
  });

  it('sweeps a bearing a hair past the start of the arc', () => {
    // An aircraft flying due west along the x axis drifts to a bearing one rounding step past
    // 90°. It must still fall in the arc that starts exactly at 90°, not in neither arc.
    const hair = Math.PI / 2 + 2.220446049250313e-16;
    expect(hair).toBeGreaterThan(Math.PI / 2);
    expect(sweptOver(Math.PI / 2, Math.PI / 2 + deg(1.8), hair)).toBe(true);
    expect(sweptOver(Math.PI / 2 - deg(1.8), Math.PI / 2, hair)).toBe(false);
    // Just east of north, across the jump from 360° to 0°: painted once, not twice.
    const tiny = 1e-18;
    expect(sweptOver(2 * Math.PI - deg(1.8), 0, tiny)).toBe(false);
    expect(sweptOver(0, deg(1.8), tiny)).toBe(true);
  });

  it('sweeps every bearing exactly once per turn', () => {
    const ticksPerTurn = Math.round(4 / TICK_S);
    for (const bearingRad of [0.001, 1.234, Math.PI, 6.2]) {
      let hits = 0;
      for (let tick = 1; tick <= ticksPerTurn; tick++) {
        const from = antennaAzimuth((tick - 1) * TICK_S, 4);
        const to = antennaAzimuth(tick * TICK_S, 4);
        if (sweptOver(from, to, bearingRad)) hits++;
      }
      expect(hits).toBe(1);
    }
  });
});

describe('detection probability', () => {
  it('follows Pd = Pfa^(1/(1+SNR)) for a fluctuating target', () => {
    // Pfa = 1e-6 and SNR = 20 (13 dB): Pd = 1e-6^(1/21) = 0.518.
    expect(detectionProbability(20, 1e-6)).toBeCloseTo(0.518, 3);
    // Ten times the SNR: Pd = 1e-6^(1/201) = 0.934.
    expect(detectionProbability(200, 1e-6)).toBeCloseTo(0.934, 3);
    // No signal: only noise, which crosses the threshold with probability Pfa.
    expect(detectionProbability(0, 1e-6)).toBeCloseTo(1e-6, 12);
  });

  it('detects a target on half the scans at its 50% range, more often when closer', () => {
    const radar = DEFAULT_SEARCH_RADAR;
    const drone = 0.01;
    const r50 = detectionRangeM(drone, radar); // 9.5 km
    expect(lookProbability(drone, r50, radar)).toBeCloseTo(0.5, 9);
    // SNR ∝ 1/R⁴: at 70% of the range the SNR is 4.2 times larger.
    expect(signalToNoise(drone, 0.7 * r50, radar) / signalToNoise(drone, r50, radar)).toBeCloseTo(
      1 / 0.7 ** 4,
      9,
    );
    expect(lookProbability(drone, 0.7 * r50, radar)).toBeCloseTo(0.845, 2);
    expect(lookProbability(drone, 1.3 * r50, radar)).toBeLessThan(0.3);
    expect(lookProbability(drone, 41_000, radar)).toBe(0); // beyond the instrumented range
  });

  it('expects λ = Pfa × cells false alarms per antenna turn', () => {
    expect(falseAlarmsPerTurn(DEFAULT_SEARCH_RADAR)).toBeCloseTo(0.6, 9);
  });
});

describe('Doppler and the clutter notch', () => {
  const antenna = vec3(0, 0, 12);
  const north10km = vec3(0, 10_000, 12);

  it('counts only the part of the velocity along the line of sight', () => {
    expect(closingSpeedMps(antenna, north10km, vec3(0, -40, 0))).toBeCloseTo(40, 9);
    expect(closingSpeedMps(antenna, north10km, vec3(0, 40, 0))).toBeCloseTo(-40, 9);
    // Flying across the beam: no closing speed at all.
    expect(closingSpeedMps(antenna, north10km, vec3(40, 0, 0))).toBeCloseTo(0, 9);
    // 60° off the line of sight: 40 m/s × cos 60° = 20 m/s.
    const v = vec3(40 * Math.sin(deg(60)), -40 * Math.cos(deg(60)), 0);
    expect(closingSpeedMps(antenna, north10km, v)).toBeCloseTo(20, 9);
  });

  it('shifts the echo by f = 2v / λ', () => {
    // λ = 10 cm: a 40 m/s drone shifts its echo by 800 Hz, a 340 m/s jet flying away by −6.8 kHz.
    expect(dopplerShiftHz(40, DEFAULT_SEARCH_RADAR)).toBeCloseTo(800, 9);
    expect(dopplerShiftHz(-340, DEFAULT_SEARCH_RADAR)).toBeCloseTo(-6_800, 9);
  });

  it('filters out echoes slower than the notch, coming or going', () => {
    expect(inDopplerNotch(9.9, DEFAULT_SEARCH_RADAR)).toBe(true);
    expect(inDopplerNotch(-9.9, DEFAULT_SEARCH_RADAR)).toBe(true);
    expect(inDopplerNotch(10, DEFAULT_SEARCH_RADAR)).toBe(false);
    expect(inDopplerNotch(0, { dopplerNotchMps: 0 })).toBe(false);
  });
});
