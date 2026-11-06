import { describe, expect, it } from 'vitest';
import { Simulation } from '../../sim';
import {
  compassPoint,
  describeEvent,
  describeNow,
  formatBearing,
  formatKm,
  nearestRecentEcho,
} from './narrator';

const deg = (d: number) => (d * Math.PI) / 180;

describe('narrator formatting', () => {
  it('names compass directions', () => {
    expect(compassPoint(0)).toBe('north');
    expect(compassPoint(deg(45))).toBe('north-east');
    expect(compassPoint(deg(200))).toBe('south');
    expect(compassPoint(deg(350))).toBe('north');
  });

  it('formats bearings and ranges the way an operator reads them', () => {
    expect(formatBearing(deg(45))).toBe('045°');
    expect(formatBearing(deg(359.8))).toBe('000°');
    expect(formatKm(32_400)).toBe('32 km');
    expect(formatKm(8_400)).toBe('8.4 km');
  });
});

describe('describeEvent', () => {
  it('tells scenario events and radar events apart', () => {
    expect(
      describeEvent({
        kind: 'trafficEntered',
        tick: 120,
        timeS: 2.4,
        id: 1,
        type: 'airliner',
        bearingRad: deg(270),
        rangeM: 38_000,
      }),
    ).toEqual({ source: 'scenario', text: 'A civil airliner enters 38 km to the west.' });

    expect(
      describeEvent({
        kind: 'contactNew',
        tick: 50,
        timeS: 1,
        id: 1,
        bearingRad: deg(90),
        rangeM: 9_500,
      }),
    ).toEqual({ source: 'radar', text: 'New contact at bearing 090°, 9.5 km.' });
  });

  it('describes traffic present at the start differently from new arrivals', () => {
    const line = describeEvent({
      kind: 'trafficEntered',
      tick: 0,
      timeS: 0,
      id: 2,
      type: 'drone',
      bearingRad: deg(45),
      rangeM: 12_000,
    });
    expect(line.text).toBe('A small drone is already flying 12 km to the north-east.');
  });
});

describe('describeNow', () => {
  const base = { tick: 500, timeS: 10, periodS: 4, contactsHeld: 3, nearest: null };

  it('invites the user to start when nothing has happened yet', () => {
    expect(describeNow({ ...base, running: false, tick: 0, timeS: 0 })).toMatch(/^Ready/);
  });

  it('explains how to step while paused', () => {
    expect(describeNow({ ...base, running: false })).toMatch(/^Paused at T\+00:10\.0/);
  });

  it('summarizes the radar picture while running', () => {
    expect(
      describeNow({ ...base, running: true, nearest: { rangeM: 18_000, bearingRad: deg(40) } }),
    ).toBe(
      'Radar sweeping, one turn every 4 s. 3 contacts on the scope; the nearest is 18 km to the north-east.',
    );
    expect(describeNow({ ...base, running: true, contactsHeld: 0 })).toBe(
      'Radar sweeping, one turn every 4 s. No contacts yet.',
    );
  });

  it('finds the nearest echo from the last antenna turn only', () => {
    const sim = new Simulation({ seed: 1, autoTraffic: false });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 0, northM: 5_000, headingRad: 0 });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 20_000, northM: 0, headingRad: 0 });
    sim.run(200); // one full turn: both painted
    // The beam starts at north, so the northern drone is painted as the first turn completes
    // (t = 4 s), after flying 160 m further north at 40 m/s.
    expect(nearestRecentEcho(sim.snapshot())?.rangeM).toBeCloseTo(5_000 + 40 * 4, 0);
  });
});
