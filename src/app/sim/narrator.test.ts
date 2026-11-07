import { describe, expect, it } from 'vitest';
import { Simulation, type SimEvent } from '../../sim';
import {
  compassPoint,
  describeEvent,
  describeNow,
  formatBearing,
  formatIn,
  formatKm,
  formatMiss,
} from './narrator';

const deg = (d: number) => (d * Math.PI) / 180;

describe('narrator formatting', () => {
  it('names compass directions', () => {
    expect(compassPoint(0)).toBe('north');
    expect(compassPoint(deg(45))).toBe('north-east');
    expect(compassPoint(deg(200))).toBe('south');
    expect(compassPoint(deg(350))).toBe('north');
  });

  it('formats bearings, ranges, durations and miss distances the way an operator reads them', () => {
    expect(formatBearing(deg(45))).toBe('045°');
    expect(formatBearing(deg(359.8))).toBe('000°');
    expect(formatKm(32_400)).toBe('32 km');
    expect(formatKm(8_400)).toBe('8.4 km');
    expect(formatIn(27.6)).toBe('28 s');
    expect(formatIn(65)).toBe('1:05');
    expect(formatMiss(0.3)).toBe('under 1 m');
    expect(formatMiss(42.4)).toBe('42 m');
    expect(formatMiss(2_100)).toBe('2.1 km');
  });
});

describe('describeEvent', () => {
  const base = { tick: 50, timeS: 1, id: 1 };

  it('tells truth, radar, command and weapon lines apart', () => {
    expect(
      describeEvent({
        ...base,
        kind: 'trafficEntered',
        type: 'airliner',
        bearingRad: deg(270),
        rangeM: 38_000,
      }),
    ).toEqual({ source: 'scenario', text: 'A civil airliner enters 38 km to the west.' });
    expect(
      describeEvent({
        ...base,
        kind: 'contactNew',
        trackId: 3,
        bearingRad: deg(90),
        rangeM: 9_500,
      }),
    ).toEqual({ source: 'radar', text: 'New contact T3 at bearing 090°, 9.5 km.' });
    expect(describeEvent({ ...base, kind: 'identified', trackId: 3, identity: 'hostile' })).toEqual(
      {
        source: 'command',
        text: 'T3 identified as hostile: no reply to the identification check.',
      },
    );
    expect(
      describeEvent({
        ...base,
        kind: 'interceptorLaunched',
        trackId: 3,
        interceptorId: 2,
        predictedTimeS: 17.9,
        predictedRangeM: 10_900,
      }),
    ).toEqual({ source: 'weapon', text: 'I2 launched at T3: intercept in 18 s, 11 km out.' });
  });

  it('says how an interceptor ended', () => {
    const result = (hit: boolean, missDistanceM: number, reason: 'passed' | 'outOfTime' | null) =>
      describeEvent({
        ...base,
        kind: 'interceptResult',
        trackId: 3,
        interceptorId: 2,
        hit,
        missDistanceM,
        reason,
      }).text;
    expect(result(true, 0.2, null)).toBe('I2 hit T3 (closest approach under 1 m).');
    expect(result(false, 42, 'passed')).toBe('I2 missed T3 by 42 m.');
    expect(result(false, 2_300, 'outOfTime')).toBe('I2 ran out of flight time, 2.3 km from T3.');
  });

  it('describes traffic present at the start differently from new arrivals', () => {
    const line = describeEvent({
      ...base,
      tick: 0,
      kind: 'trafficEntered',
      type: 'drone',
      bearingRad: deg(45),
      rangeM: 12_000,
    });
    expect(line.text).toBe('A small drone is already flying 12 km to the north-east.');
  });
});

describe('describeNow', () => {
  /** A jet 30 km north, flying at the battery, with every event recorded. */
  function jetRun() {
    const sim = new Simulation({ seed: 1, autoTraffic: false });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 0,
      northM: 30_000,
      headingRad: Math.PI,
    });
    const events: SimEvent[] = [];
    const at = (seconds: number, running = true) => {
      events.push(...sim.run(Math.round(seconds * 50) - sim.tick));
      const recent = events.filter((e) => e.timeS >= sim.timeS - 5);
      return describeNow({ running, snapshot: sim.snapshot(), recent });
    };
    return at;
  }

  it('invites the user to start when nothing has happened yet', () => {
    const at = jetRun();
    expect(at(0, false)).toMatch(/^Ready/);
  });

  it('narrates the loop, from the first echo to the confirmed kill', () => {
    const at = jetRun();
    expect(at(2)).toBe('Radar sweeping, one turn every 4 s. No contacts yet.');
    expect(at(5)).toBe('Radar sweeping, one turn every 4 s. 1 track: 1 being identified.');
    expect(at(10.5)).toBe('T1 assigned: launch in 1.0 s.');
    expect(at(20)).toMatch(/^Engaging T1: interceptor I1 in flight, intercept in \d+ s\.$/);
    expect(at(39.2)).toBe('I1 hit T1. The radar will look again to confirm the kill.');
    expect(at(41.6)).toMatch(
      /^T1 destroyed, confirmed by the radar 35 s after it was first detected\.$/,
    );
  });

  it('keeps the situation visible while paused', () => {
    const at = jetRun();
    expect(at(20, false)).toMatch(/^Paused at T\+00:20\.0 · Engaging T1/);
  });
});
