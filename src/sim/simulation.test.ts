import { describe, expect, it } from 'vitest';
import { Simulation } from './simulation';

/** A simulation with an empty sky, for tests that place their own traffic. */
const emptySky = (seed = 1) => new Simulation({ seed, autoTraffic: false });

describe('Simulation: determinism', () => {
  it('produces identical runs for the same seed', () => {
    const a = new Simulation({ seed: 2026 });
    const b = new Simulation({ seed: 2026 });
    const eventsA = a.run(3000); // one minute
    const eventsB = b.run(3000);
    expect(a.stateHash()).toBe(b.stateHash());
    expect(eventsA).toEqual(eventsB);
  });

  it('produces different runs for different seeds', () => {
    const a = new Simulation({ seed: 1 });
    const b = new Simulation({ seed: 2 });
    a.run(500);
    b.run(500);
    expect(a.stateHash()).not.toBe(b.stateHash());
  });

  it('replays a run exactly from its seed and command log', () => {
    const sim = new Simulation({ seed: 9 });
    sim.run(100);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: -30_000,
      northM: 5_000,
      headingRad: Math.PI / 2,
    });
    sim.run(200);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 10_000,
      northM: 25_000,
      headingRad: Math.PI,
    });
    sim.run(700);
    expect(sim.commandLog().map((entry) => entry.tick)).toEqual([101, 301]);

    const replayed = Simulation.replay({ seed: 9 }, sim.commandLog(), sim.tick);
    expect(replayed.stateHash()).toBe(sim.stateHash());
  });
});

describe('Simulation: kinematics', () => {
  it('moves an aircraft by exactly velocity × time', () => {
    const sim = emptySky();
    sim.dispatch({ kind: 'spawnTraffic', type: 'jet', eastM: 0, northM: -20_000, headingRad: 0 });
    sim.run(50); // one second at 50 ticks per second
    const jet = sim.snapshot().aircraft[0];
    expect(jet?.position.y).toBeCloseTo(-20_000 + 340, 6); // 340 m/s for 1 s
    expect(jet?.position.x).toBeCloseTo(0, 6);
    expect(jet?.position.z).toBe(6000);
  });

  it('spawns a swarm as six drones around the drop point', () => {
    const sim = emptySky();
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 5_000,
      northM: 5_000,
      headingRad: 0,
    });
    sim.step();
    const drones = sim.snapshot().aircraft;
    expect(drones).toHaveLength(6);
    for (const drone of drones) {
      expect(drone.type).toBe('drone');
      expect(Math.abs(drone.position.x - 5_000)).toBeLessThanOrEqual(700);
    }
  });
});

describe('Simulation: search radar', () => {
  it('paints a target once per antenna turn, when the beam passes its bearing', () => {
    const sim = emptySky();
    // A slow drone 10 km due east: the beam starts at north, turns clockwise and reaches it after ~1 s.
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 10_000, northM: 0, headingRad: 0 });
    sim.run(600); // three 4-second turns
    const plots = sim.snapshot().plots;
    expect(plots).toHaveLength(3);
    plots.forEach((plot, turn) => expect(plot.timeS).toBeCloseTo(1 + 4 * turn, 0));
  });

  it('reports a new contact, then loses it when the target flies out of range', () => {
    const sim = emptySky();
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 39_000,
      northM: 0,
      headingRad: Math.PI / 2,
    });
    const events = sim.run(600);
    expect(events.map((e) => e.kind)).toEqual([
      'trafficEntered',
      'contactNew',
      'contactLost',
      'trafficLeft',
    ]);
  });

  it('counts only the contacts the radar has actually painted', () => {
    const sim = emptySky();
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 10_000, northM: 0, headingRad: 0 });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: -10_000, northM: 0, headingRad: 0 });
    sim.run(10);
    expect(sim.snapshot().contactsHeld).toBe(0); // the beam has not reached them yet
    sim.run(200);
    expect(sim.snapshot().contactsHeld).toBe(2);
  });
});

describe('Simulation: scenario traffic', () => {
  it('starts with traffic already in the area and keeps it flowing', () => {
    const sim = new Simulation({ seed: 2026 });
    const first = sim.step();
    expect(first.filter((e) => e.kind === 'trafficEntered')).toHaveLength(4);
    const later = sim.run(15_000); // five minutes
    expect(later.some((e) => e.kind === 'trafficEntered')).toBe(true);
    expect(sim.snapshot().aircraft.length).toBeLessThanOrEqual(7);
  });

  it('removes aircraft once they leave the area', () => {
    const sim = new Simulation({ seed: 5 });
    sim.run(90_000); // thirty minutes
    for (const a of sim.snapshot().aircraft) {
      expect(Math.hypot(a.position.x, a.position.y)).toBeLessThan(42_000 + 400);
    }
  });
});
