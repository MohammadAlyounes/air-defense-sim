import { describe, expect, it } from 'vitest';
import { IDEAL_SEARCH_RADAR } from './radar';
import { Simulation, type SimConfig } from './simulation';
import type { SimEvent } from './types';

/**
 * Flat ground, an ideal radar and interceptors that always kill within their lethal radius, so
 * the loop's order and timing are exact.
 */
const emptySky = (extra: Partial<SimConfig> = {}) =>
  new Simulation({
    seed: 1,
    autoTraffic: false,
    terrain: false,
    radar: IDEAL_SEARCH_RADAR,
    wind: false,
    evasiveTurns: false,
    ...extra,
    interceptor: { certainKill: true, ...extra.interceptor },
  });

const kinds = (events: readonly SimEvent[]) => events.map((e) => e.kind);
const ofKind = <K extends SimEvent['kind']>(events: readonly SimEvent[], kind: K) =>
  events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);

/** A fast jet 30 km north, flying straight at the battery. */
function jetInbound(sim: Simulation) {
  sim.dispatch({
    kind: 'spawnTraffic',
    type: 'jet',
    eastM: 0,
    northM: 30_000,
    headingRad: Math.PI,
  });
}

describe('the defense loop', () => {
  it('detects, tracks, identifies, evaluates, engages and assesses a jet heading for the battery', () => {
    const sim = emptySky();
    jetInbound(sim);
    const events = sim.run(50 * 60);

    const loop = kinds(events).filter((k) => k !== 'trafficEntered');
    expect(loop).toEqual([
      'contactNew',
      'trackConfirmed',
      'identified', // unknown: no answer to the first check
      'threatEvaluated',
      'identified', // hostile: no answer to the second check either
      'engagementAssigned',
      'interceptorLaunched',
      'interceptResult',
      'killAssessed',
    ]);

    const [first, second] = ofKind(events, 'identified');
    expect(first).toMatchObject({ identity: 'unknown', evidence: 'noReply', checks: 1 });
    expect(second).toMatchObject({ identity: 'hostile', evidence: 'noReply', checks: 2 });
    // Assigned, then launched once the launcher is ready: 1.5 s later.
    const [assigned] = ofKind(events, 'engagementAssigned');
    const [launched] = ofKind(events, 'interceptorLaunched');
    expect((launched?.timeS ?? 0) - (assigned?.timeS ?? 0)).toBeCloseTo(1.5, 6);
    const [result] = ofKind(events, 'interceptResult');
    expect(result?.hit).toBe(true);
    expect(result?.missDistanceM).toBeLessThan(15);

    // The radar confirms the kill on its next look: within one antenna turn.
    const [kill] = ofKind(events, 'killAssessed');
    expect((kill?.timeS ?? 0) - (result?.timeS ?? 0)).toBeLessThanOrEqual(4);
    expect(kill).toMatchObject({ type: 'jet', interceptorsFired: 1 });

    const snapshot = sim.snapshot();
    expect(snapshot.aircraft).toHaveLength(0);
    expect(snapshot.tracks).toHaveLength(0);
    expect(snapshot.stats).toMatchObject({
      threatsDown: 1,
      threatsLeaked: 0,
      interceptorsFired: 1,
      hits: 1,
    });
  });

  it('plans the intercept: the interceptor arrives about when and where it was predicted', () => {
    const sim = emptySky();
    jetInbound(sim);
    const events = sim.run(50 * 60);
    const [launch] = ofKind(events, 'interceptorLaunched');
    const [result] = ofKind(events, 'interceptResult');
    const flightS = (result?.timeS ?? 0) - (launch?.timeS ?? 0);
    // The plan keeps a 10% margin on reach, which roughly pays for the climb and the drag
    // during the boost that the straight-line reach leaves out.
    expect(flightS).toBeLessThanOrEqual(1.05 * (launch?.predictedTimeS ?? 0));
    expect(flightS).toBeGreaterThan(0.8 * (launch?.predictedTimeS ?? 0));
  });

  it('never engages friendly or civil aircraft, even flying straight over the battery', () => {
    const sim = emptySky();
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'friendly',
      eastM: 0,
      northM: 30_000,
      headingRad: Math.PI,
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: 30_000,
      northM: 0,
      headingRad: -Math.PI / 2,
    });
    const events = sim.run(50 * 180);
    expect(
      ofKind(events, 'identified')
        .map((e) => e.identity)
        .sort(),
    ).toEqual(['friend', 'neutral']);
    expect(ofKind(events, 'threatEvaluated')).toHaveLength(0);
    expect(ofKind(events, 'interceptorLaunched')).toHaveLength(0);
  });

  it('leaves hostiles alone when their course does not come near the battery', () => {
    const sim = emptySky();
    // Crossing 15 km east of the battery: identified hostile, but not a threat.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 15_000,
      northM: -30_000,
      headingRad: 0,
    });
    const events = sim.run(50 * 120);
    expect(ofKind(events, 'identified').map((e) => e.identity)).toEqual(['unknown', 'hostile']);
    expect(ofKind(events, 'interceptorLaunched')).toHaveLength(0);
  });

  it('counts a leak when a hostile reaches the battery', () => {
    const sim = emptySky({ defense: { launcherCapacity: 0 } });
    jetInbound(sim);
    const events = sim.run(50 * 100);
    expect(ofKind(events, 'threatLeaked')).toHaveLength(1);
    expect(sim.snapshot().stats.threatsLeaked).toBe(1);
  });

  it('looks again after a miss, then fires another interceptor (shoot-look-shoot)', () => {
    // A fuze that never goes off close enough: every shot misses.
    const sim = emptySky({ interceptor: { lethalRadiusM: 0 } });
    jetInbound(sim);
    const events = sim.run(50 * 60);
    const order = kinds(events).filter((k) =>
      ['interceptorLaunched', 'interceptResult', 'targetSurvived'].includes(k),
    );
    expect(order.slice(0, 4)).toEqual([
      'interceptorLaunched',
      'interceptResult',
      'targetSurvived',
      'interceptorLaunched',
    ]);
    const [miss] = ofKind(events, 'interceptResult');
    expect(miss).toMatchObject({ hit: false, reason: 'passed' });
    // Proportional navigation still gets within a few metres.
    expect(miss?.missDistanceM).toBeLessThan(15);
  });

  it('fires one interceptor at a time, spaced by the launch interval, and reloads', () => {
    const sim = emptySky({ defense: { launcherCapacity: 3, reloadS: 30 } });
    // A drone swarm 8 km out, heading for the battery.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 0,
      northM: 8_000,
      headingRad: Math.PI,
    });
    const events = sim.run(50 * 20);
    const launches = ofKind(events, 'interceptorLaunched');
    expect(launches).toHaveLength(3); // the whole launcher, then empty
    for (let i = 1; i < launches.length; i++) {
      expect((launches[i]?.tick ?? 0) - (launches[i - 1]?.tick ?? 0)).toBeGreaterThanOrEqual(100);
    }
    expect(sim.snapshot().launcher.ready).toBe(0);
    sim.run(50 * 30);
    expect(sim.snapshot().stats.interceptorsFired).toBeGreaterThanOrEqual(4); // reloaded, fired again
  });

  it('replays a run with engagements exactly', () => {
    const sim = new Simulation({ seed: 2026 });
    sim.run(50 * 30);
    jetInbound(sim);
    sim.run(50 * 60);
    expect(sim.snapshot().stats.interceptorsFired).toBeGreaterThan(0);
    const replayed = Simulation.replay({ seed: 2026 }, sim.commandLog(), sim.tick);
    expect(replayed.stateHash()).toBe(sim.stateHash());
  });
});
