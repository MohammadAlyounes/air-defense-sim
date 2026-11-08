import { describe, expect, it } from 'vitest';
import { Simulation, IDEAL_SEARCH_RADAR } from '../../sim';
import { aircraftFacts } from './aircraftFacts';

function jetFlyingAt(
  sim = new Simulation({
    seed: 1,
    autoTraffic: false,
    terrain: false,
    radar: IDEAL_SEARCH_RADAR,
    wind: false,
    evasiveTurns: false,
  }),
) {
  sim.dispatch({ kind: 'spawnTraffic', type: 'jet', eastM: 0, northM: -30_000, headingRad: 0 });
  return sim;
}

describe('aircraftFacts', () => {
  it('describes an aircraft in plain units', () => {
    const sim = jetFlyingAt();
    sim.run(50); // one second
    expect(aircraftFacts(sim.snapshot(), 1)).toMatchObject({
      type: 'jet',
      affiliation: 'hostile',
      speed: '340 m/s',
      speedKmh: '1,224 km/h',
      altitude: '6,000 m',
      altitudeRef: 'above sea level',
      heading: '000°',
      headingPoint: 'north',
      range: '30 km south',
      bearing: 'bearing 180°',
    });
  });

  it('says what the battery knows and does about it, stage by stage', () => {
    const sim = jetFlyingAt();
    const at = (seconds: number) => {
      sim.run(Math.round(seconds * 50) - sim.tick);
      const facts = aircraftFacts(sim.snapshot(), 1);
      return [facts?.track, facts?.defense, facts?.defenseDetail];
    };
    // Before the beam reaches the south: not detected; a jet is seen from about 36 km.
    expect(at(1)).toEqual(['Not detected', 'Not engaged', 'not detected yet']);
    expect(aircraftFacts(sim.snapshot(), 1)?.trackDetail).toBe('seen on half the looks from 36 km');
    expect(at(3)).toEqual(['T1 · identifying', 'Waiting', 'identification check']);
    // First echo at 2 s (the beam reaches the south), confirmed at 6 s (the tracker commits
    // echoes 0.2 s after the sweep). No answer to the first identification check at 8.2 s: unknown.
    expect(at(9)).toEqual(['T1 · unknown', 'Threat', 'closest approach in 1:19']);
    // No answer to the second one at 12.2 s either: hostile, assigned, launch 1.5 s later.
    expect(at(12.5)).toEqual(['T1 · hostile', 'Assigned', 'launch in 1.2 s']);
    expect(at(20)?.[1]).toBe('Engaged by I1');
  });

  it('shows friendly aircraft as never engaged', () => {
    const sim = new Simulation({
      seed: 1,
      autoTraffic: false,
      terrain: false,
      radar: IDEAL_SEARCH_RADAR,
      wind: false,
      evasiveTurns: false,
      interceptor: { certainKill: true },
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'friendly',
      eastM: 0,
      northM: -20_000,
      headingRad: 0,
    });
    sim.run(50 * 10);
    expect(aircraftFacts(sim.snapshot(), 1)).toMatchObject({
      track: 'T1 · friendly',
      defense: 'Never engaged',
      defenseDetail: 'identified friendly',
    });
  });

  it('returns null once the aircraft has gone', () => {
    const sim = jetFlyingAt();
    sim.run(1);
    expect(aircraftFacts(sim.snapshot(), 99)).toBeNull();
  });

  it('notes a track whose last echo only fitted through the wider gate for hard turns', () => {
    const sim = jetFlyingAt();
    sim.run(9 * 50);
    const snapshot = sim.snapshot();
    const detail = (maneuvering: boolean) =>
      aircraftFacts(
        { ...snapshot, tracks: snapshot.tracks.map((track) => ({ ...track, maneuvering })) },
        1,
      )?.trackErrorDetail;
    expect(detail(false)).toMatch(/echoes so far$/);
    expect(detail(true)).toMatch(/echoes so far · caught up after a hard turn$/);
  });
});
