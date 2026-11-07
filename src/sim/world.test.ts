import { describe, expect, it } from 'vitest';
import { distance, vec3 } from './core/vec';
import { IDEAL_SEARCH_RADAR } from './radar';
import { Simulation } from './simulation';
import { createTerrain, flatTerrain, type Terrain } from './terrain';
import type { SimEvent } from './types';

const ofKind = <K extends SimEvent['kind']>(events: readonly SimEvent[], kind: K) =>
  events.filter((e): e is Extract<SimEvent, { kind: K }> => e.kind === kind);

/** Flat ground with a 400 m ridge running north-south, 8 to 9 km east of the battery. */
const ridge: Terrain = {
  ...flatTerrain(),
  maxHeightM: 400,
  heightAt: (east) => (east > 8_000 && east < 9_000 ? 400 : 0),
};

describe('Step 4 world: terrain masking', () => {
  it('cannot see a low cruise-missile-like target behind a ridge until it crosses it', () => {
    const sim = new Simulation({
      seed: 3,
      autoTraffic: false,
      terrain: ridge,
      radar: IDEAL_SEARCH_RADAR,
    });
    // 15 km east, 50 m above the ground, flying west at the battery.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'cruise',
      eastM: 15_000,
      northM: 0,
      headingRad: -Math.PI / 2,
    });
    const events = sim.run(50 * 40);
    const [first] = ofKind(events, 'contactNew');
    expect(first).toBeDefined();
    // Only seen once it is over or past the ridge, never from 15 km out.
    expect(first?.rangeM ?? Infinity).toBeLessThan(9_100);
  });

  it('sees the same target from its full detection range over flat ground', () => {
    const sim = new Simulation({
      seed: 3,
      autoTraffic: false,
      terrain: false,
      radar: IDEAL_SEARCH_RADAR,
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'cruise',
      eastM: 15_000,
      northM: 0,
      headingRad: -Math.PI / 2,
    });
    const [first] = ofKind(sim.run(50 * 10), 'contactNew');
    expect(first?.rangeM ?? 0).toBeGreaterThan(14_000);
  });
});

describe('Step 4 world: terrain following', () => {
  it('keeps drones and cruise-like targets near their height above the hills', () => {
    const terrain = createTerrain();
    const sim = new Simulation({ seed: 4, autoTraffic: false, terrain });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'drone',
      eastM: -30_000,
      northM: 20_000,
      headingRad: Math.PI / 2,
    });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'cruise',
      eastM: 25_000,
      northM: -25_000,
      headingRad: -Math.PI / 4,
    });
    for (let s = 0; s < 60; s++) {
      sim.run(50);
      for (const a of sim.snapshot().aircraft) {
        const agl = a.position.z - terrain.heightAt(a.position.x, a.position.y);
        expect(agl).toBeGreaterThanOrEqual(9.9); // never into the ground
        if (a.type === 'drone') expect(Math.abs(agl - 300)).toBeLessThan(150);
      }
    }
  });

  it('keeps jets at their set altitude above the hills', () => {
    const sim = new Simulation({ seed: 4, autoTraffic: false });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 0,
      northM: -30_000,
      headingRad: 0,
      altitudeM: 6_000,
    });
    sim.run(50 * 20);
    expect(sim.snapshot().aircraft[0]?.position.z).toBe(6_000);
  });
});

describe('Step 4 world: a noisy radar', () => {
  it('measures positions with errors of the configured size', () => {
    const sim = new Simulation({ seed: 5, autoTraffic: false, terrain: false });
    // An airliner 20 km north, flying east: always detected, painted every 4 s.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: -10_000,
      northM: 20_000,
      headingRad: Math.PI / 2,
    });
    const errors: number[] = [];
    for (let turn = 0; turn < 30; turn++) {
      sim.run(200);
      const snapshot = sim.snapshot();
      const plot = snapshot.plots.filter((p) => p.truthId !== null).at(-1);
      const truth = snapshot.aircraft[0];
      if (plot && truth) {
        // Compare with where the aircraft was at the plot's tick.
        const back = (snapshot.tick - plot.tick) * 0.02;
        const then = vec3(
          truth.position.x - truth.velocity.x * back,
          truth.position.y,
          truth.position.z,
        );
        errors.push(distance(plot.position, then));
      }
    }
    const rms = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
    // Bearing noise 0.15° at ~23 km is ~60 m, elevation noise 0.25° is ~100 m: tens of metres
    // to a couple of hundred, never perfect.
    expect(rms).toBeGreaterThan(40);
    expect(rms).toBeLessThan(250);
  });

  it('produces about 0.6 false alarms per antenna turn, which never become confirmed tracks', () => {
    const sim = new Simulation({ seed: 6, autoTraffic: false, terrain: false });
    const events = sim.run(50 * 4 * 200); // 200 turns
    const contacts = ofKind(events, 'contactNew');
    expect(contacts.length).toBeGreaterThan(80);
    expect(contacts.length).toBeLessThan(170);
    expect(ofKind(events, 'trackConfirmed')).toHaveLength(0);
    expect(ofKind(events, 'contactDropped')).toHaveLength(
      contacts.length - sim.snapshot().tracks.length,
    );
    expect(ofKind(events, 'interceptorLaunched')).toHaveLength(0);
  });

  it('sometimes misses a drone at its 50% range, but rarely up close', () => {
    let far = 0;
    let near = 0;
    const looks = 40;
    for (let seed = 1; seed <= looks; seed++) {
      for (const [eastM, counter] of [
        [9_490, 'far'],
        [4_000, 'near'],
      ] as const) {
        const sim = new Simulation({
          seed,
          autoTraffic: false,
          terrain: false,
          radar: { falseAlarmProbability: 1e-6, resolutionCells: 0 },
        });
        sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM, northM: 0, headingRad: 0 });
        sim.run(60); // one look, ~1 s in
        const seen = sim.snapshot().plots.length > 0;
        if (seen && counter === 'far') far++;
        if (seen && counter === 'near') near++;
      }
    }
    expect(far / looks).toBeGreaterThan(0.25);
    expect(far / looks).toBeLessThan(0.75);
    expect(near / looks).toBeGreaterThan(0.9);
  });
});

describe('Step 4 world: the full loop', () => {
  it('still detects, engages and destroys a jet heading for the battery, over terrain and with noise', () => {
    const sim = new Simulation({ seed: 2026, autoTraffic: false });
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'jet',
      eastM: 0,
      northM: 30_000,
      headingRad: Math.PI,
    });
    const events = sim.run(50 * 90);
    expect(ofKind(events, 'killAssessed')).toHaveLength(1);
    expect(sim.snapshot().stats.threatsLeaked).toBe(0);
  });

  it('replays a realistic run exactly', () => {
    const sim = new Simulation({ seed: 77 });
    sim.run(50 * 20);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 6_000,
      northM: 6_000,
      headingRad: 1.25 * Math.PI,
    });
    sim.run(50 * 60);
    const replayed = Simulation.replay({ seed: 77 }, sim.commandLog(), sim.tick);
    expect(replayed.stateHash()).toBe(sim.stateHash());
  });
});
