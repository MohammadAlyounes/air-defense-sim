import { describe, expect, it } from 'vitest';
import { DEFAULT_SEARCH_RADAR, detectionRangeM, IDEAL_SEARCH_RADAR } from './radar';
import { Simulation } from './simulation';

/**
 * A simulation with an empty sky over flat ground and an ideal radar (no noise, no false
 * alarms, sure detection inside the 50% range), for tests that place their own traffic.
 */
const emptySky = (seed = 1) =>
  new Simulation({
    seed,
    autoTraffic: false,
    terrain: false,
    radar: IDEAL_SEARCH_RADAR,
    wind: false,
    evasiveTurns: false,
  });

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

  it('records a trail: one position every 0.5 s, keeping the last 30 s', () => {
    const sim = emptySky();
    // Passing 20 km east of the battery: no threat, so nothing shoots it down.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 20_000,
      northM: -30_000,
      headingRad: 0,
    });
    sim.run(50); // spawn point, then samples at 0.5 s and 1 s
    let jet = sim.snapshot().aircraft[0];
    expect(jet?.trail).toHaveLength(3);
    expect(jet?.trail.at(-1)).toEqual(jet?.position);

    sim.run(50 * 60); // one more minute
    jet = sim.snapshot().aircraft[0];
    expect(jet?.trail).toHaveLength(60);
    const [first, second] = jet?.trail ?? [];
    expect((second?.y ?? 0) - (first?.y ?? 0)).toBeCloseTo(340 * 0.5, 6); // 0.5 s at 340 m/s
  });
});

describe('Simulation: search radar', () => {
  it('paints a target once per antenna turn, when the beam passes its bearing', () => {
    const sim = emptySky();
    // A slow drone 8 km due east: the beam starts at north, turns clockwise and reaches it after ~1 s.
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 8_000, northM: 0, headingRad: 0 });
    sim.run(600); // three 4-second turns
    const plots = sim.snapshot().plots;
    expect(plots).toHaveLength(3);
    plots.forEach((plot, turn) => expect(plot.timeS).toBeCloseTo(1 + 4 * turn, 0));
  });

  it('reports a new contact, then drops it when no second echo comes', () => {
    const sim = emptySky();
    // A jet is detected out to about 35.7 km (slant range, from the antenna): painted once at
    // 34.9 km, then out of reach before the next look, so the tentative track is dropped.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 34_000,
      northM: 0,
      headingRad: Math.PI / 2,
    });
    const events = sim.run(1_400);
    expect(events.map((e) => e.kind)).toEqual([
      'trafficEntered',
      'contactNew',
      'contactDropped',
      'trafficLeft',
    ]);
  });

  it('loses a confirmed track after three silent antenna turns', () => {
    const sim = emptySky();
    // Painted at 33.0 and 34.4 km (confirmed), then out of reach.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 32_700,
      northM: 0,
      headingRad: Math.PI / 2,
    });
    const events = sim.run(1_100);
    const lost = events.find((e) => e.kind === 'contactLost');
    const confirmed = events.find((e) => e.kind === 'trackConfirmed');
    expect(confirmed).toBeDefined();
    expect(lost).toBeDefined();
    // Last echo at ~5 s; lost once more than 12 s have passed without one.
    expect((lost?.timeS ?? 0) - (confirmed?.timeS ?? 0)).toBeGreaterThan(12);
    expect((lost?.timeS ?? 0) - (confirmed?.timeS ?? 0)).toBeLessThanOrEqual(16);
  });

  it('counts only the contacts the radar has actually painted', () => {
    const sim = emptySky();
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 8_000, northM: 0, headingRad: 0 });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: -8_000, northM: 0, headingRad: 0 });
    sim.run(10);
    expect(sim.snapshot().contactsHeld).toBe(0); // the beam has not reached them yet
    sim.run(200);
    expect(sim.snapshot().contactsHeld).toBe(2);
  });
});

describe('Simulation: detection range', () => {
  it('sees big targets farther than small ones: the fourth-root law', () => {
    expect(detectionRangeM(1, DEFAULT_SEARCH_RADAR)).toBeCloseTo(30_000, 6);
    expect(detectionRangeM(0.01, DEFAULT_SEARCH_RADAR)).toBeCloseTo(9_487, 0); // drone
    expect(detectionRangeM(0.1, DEFAULT_SEARCH_RADAR)).toBeCloseTo(16_870, 0); // cruise-like
    expect(detectionRangeM(2, DEFAULT_SEARCH_RADAR)).toBeCloseTo(35_676, 0); // jet
    expect(detectionRangeM(40, DEFAULT_SEARCH_RADAR)).toBe(40_000); // airliner: capped
  });

  it('paints a drone at 9 km but not at 10 km', () => {
    const sim = emptySky();
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: 9_000, northM: 0, headingRad: 0 });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM: -10_000, northM: 0, headingRad: 0 });
    sim.run(250); // more than one turn
    expect(new Set(sim.snapshot().plots.map((p) => p.truthId))).toEqual(new Set([1]));
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
