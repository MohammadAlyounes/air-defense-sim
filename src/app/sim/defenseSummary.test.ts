import { describe, expect, it } from 'vitest';
import { Simulation } from '../../sim';
import { summarizeDefense } from './defenseSummary';

function jetInbound() {
  const sim = new Simulation({ seed: 1, autoTraffic: false });
  sim.dispatch({
    kind: 'spawnTraffic',
    type: 'jet',
    eastM: 0,
    northM: 30_000,
    headingRad: Math.PI,
  });
  return sim;
}

describe('summarizeDefense', () => {
  it('follows one track down the funnel, stage by stage', () => {
    const sim = jetInbound();
    const stagesAt = (seconds: number) => {
      sim.run(Math.round(seconds * 50) - sim.tick);
      return Object.values(summarizeDefense(sim.snapshot()).stages);
    };
    //                       detect track identify evaluate assign engage assess
    expect(stagesAt(5)).toEqual([1, 0, 0, 0, 0, 0, 0]); // first echo at 4 s
    expect(stagesAt(9)).toEqual([1, 1, 0, 0, 0, 0, 0]); // confirmed at 8 s
    expect(stagesAt(10.5)).toEqual([1, 1, 1, 1, 1, 0, 0]); // identified, threat, assigned
    expect(stagesAt(20)).toEqual([1, 1, 1, 1, 1, 1, 0]); // interceptor in flight
    expect(stagesAt(40)).toEqual([0, 0, 0, 0, 0, 0, 0]); // destroyed and assessed
  });

  it('counts threats, interceptors and the next impact', () => {
    const sim = jetInbound();
    sim.run(50 * 20);
    const summary = summarizeDefense(sim.snapshot());
    expect(summary.threats).toEqual({ active: 1, down: 0, leaked: 0 });
    expect(summary.interceptors).toEqual({ ready: 11, flying: 1, used: 1 });
    expect(summary.nextImpact?.threat).toBe('T1');
    // 30 km out at 340 m/s, 20 s later: (30,000 − 6,800) / 340 = 68.2 s to go.
    expect(summary.nextImpact?.inSeconds).toBeCloseTo((30_000 - 340 * 20) / 340, 1);

    sim.run(50 * 30);
    expect(summarizeDefense(sim.snapshot()).threats).toEqual({ active: 0, down: 1, leaked: 0 });
  });

  it('lists tracks for the track table, threats first', () => {
    const sim = new Simulation({ seed: 1, autoTraffic: false });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'friendly',
      eastM: 8_000,
      northM: 8_000,
      headingRad: 0,
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 0,
      northM: 30_000,
      headingRad: Math.PI,
    });
    sim.run(50 * 11);
    const rows = summarizeDefense(sim.snapshot()).tracks;
    expect(rows.map((r) => [r.id, r.identity, r.stage])).toEqual([
      [2, 'hostile', 'assign'], // the jet: a threat, first
      [1, 'friend', 'identify'],
    ]);
    expect(rows[0]?.speedMps).toBeCloseTo(340, 6);
    expect(rows[0]?.altitudeM).toBe(6_000);
  });
});
