import { describe, expect, it } from 'vitest';
import { Simulation } from '../../sim';
import { aircraftFacts } from './aircraftFacts';

function jetFlyingNorth() {
  const sim = new Simulation({ seed: 1, autoTraffic: false });
  sim.dispatch({ kind: 'spawnTraffic', type: 'jet', eastM: 0, northM: -30_000, headingRad: 0 });
  return sim;
}

describe('aircraftFacts', () => {
  it('describes an aircraft in plain units', () => {
    const sim = jetFlyingNorth();
    sim.run(50); // one second
    const facts = aircraftFacts(sim.snapshot(), 1);
    expect(facts).toMatchObject({
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
      inArea: '0:00',
    });
  });

  it('says what the radar knows: not seen yet, then held', () => {
    const sim = jetFlyingNorth();
    sim.run(50);
    expect(aircraftFacts(sim.snapshot(), 1)).toMatchObject({
      radar: 'Not seen yet',
      radarDetail: 'waiting for the beam',
    });
    // The beam starts north and turns clockwise in 4 s: it reaches the south at t = 2 s.
    sim.run(75);
    expect(aircraftFacts(sim.snapshot(), 1)).toMatchObject({
      radar: 'Contact held',
      radarDetail: 'painted 0.5 s ago',
    });
  });

  it('returns null once the aircraft has gone', () => {
    const sim = jetFlyingNorth();
    sim.run(1);
    expect(aircraftFacts(sim.snapshot(), 99)).toBeNull();
  });
});
