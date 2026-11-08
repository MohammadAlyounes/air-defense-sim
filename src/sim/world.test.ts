import { describe, expect, it } from 'vitest';
import { TICK_S } from './core/clock';
import { distance, vec3 } from './core/vec';
import {
  angleDiff,
  CALM,
  dropRoute,
  loadFactorForBank,
  turnRateRadS,
  windFromSeed,
  windSpeedAt,
} from './flight';
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
        // Flying in toward the radar, so the clutter notch never hides it.
        sim.dispatch({
          kind: 'spawnTraffic',
          type: 'drone',
          eastM,
          northM: 0,
          headingRad: -Math.PI / 2,
        });
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

describe('Step 4 world: wind, routes and evasive turns', () => {
  /** Flies the sim `seconds` on, sampling every aircraft's track every `every` ticks. */
  function tracksOf(sim: Simulation, seconds: number, every = 5) {
    const samples: { id: number; trackRad: number; x: number; y: number }[][] = [];
    for (let t = 0; t < seconds / TICK_S / every; t++) {
      sim.run(every);
      samples.push(
        sim.snapshot().aircraft.map((a) => ({
          id: a.id,
          trackRad: a.trackRad,
          x: a.position.x,
          y: a.position.y,
        })),
      );
    }
    return samples;
  }

  /** The largest change of track between two samples, for aircraft `id`. */
  function sharpestTurn(samples: ReturnType<typeof tracksOf>, id: number): number {
    let sharpest = 0;
    for (let i = 1; i < samples.length; i++) {
      const before = samples[i - 1]?.find((a) => a.id === id);
      const after = samples[i]?.find((a) => a.id === id);
      if (before && after) {
        sharpest = Math.max(sharpest, Math.abs(angleDiff(after.trackRad, before.trackRad)));
      }
    }
    return sharpest;
  }

  it('flies a cruise-missile-like target round its dog-leg, turning no tighter than its bank allows', () => {
    const sim = new Simulation({
      seed: 5,
      autoTraffic: false,
      terrain: false,
      wind: false,
      evasiveTurns: false,
    });
    sim.dispatch({ kind: 'setRules', rules: { weaponsControl: 'HOLD' } });
    const start = vec3(0, 38_000, 0);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'cruise',
      eastM: 0,
      northM: 38_000,
      headingRad: Math.PI,
    });
    const turnPoint = dropRoute('cruise', start, Math.PI)[0] ?? start;
    const samples = tracksOf(sim, 185);
    const path = samples.map((s) => s[0]).filter((a) => a !== undefined);
    // It passes close by the turn point (cutting the corner by a few hundred metres)...
    const nearest = Math.min(...path.map((a) => Math.hypot(a.x - turnPoint.x, a.y - turnPoint.y)));
    expect(nearest).toBeLessThan(1_000);
    // ...and then comes back in to the battery.
    const closest = Math.min(...path.map((a) => Math.hypot(a.x, a.y)));
    expect(closest).toBeLessThan(500);
    // It never turns faster than a 45° bank allows: 0.041 rad/s at 240 m/s.
    const maxRate = turnRateRadS(240, loadFactorForBank(45));
    expect(sharpestTurn(samples, 1)).toBeLessThanOrEqual(maxRate * 5 * TICK_S + 1e-9);
    expect(sharpestTurn(samples, 1)).toBeGreaterThan(0.9 * maxRate * 5 * TICK_S);
  });

  it('breaks hard away once an interceptor closes on a fast jet, once per interceptor', () => {
    const run = (evasiveTurns: boolean) => {
      const sim = new Simulation({ seed: 2026, autoTraffic: false, evasiveTurns });
      sim.dispatch({
        kind: 'spawnTraffic',
        type: 'jet',
        eastM: 0,
        northM: 30_000,
        headingRad: Math.PI,
      });
      const events: SimEvent[] = [];
      const samples: ReturnType<typeof tracksOf> = [];
      for (let s = 0; s < 90 * 10; s++) {
        events.push(...sim.run(5));
        samples.push(
          sim.snapshot().aircraft.map((a) => ({
            id: a.id,
            trackRad: a.trackRad,
            x: a.position.x,
            y: a.position.y,
          })),
        );
      }
      return { events, samples };
    };
    const { events, samples } = run(true);
    const breaks = ofKind(events, 'evasiveTurn');
    const launched = ofKind(events, 'interceptorLaunched').map((e) => e.interceptorId);
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    for (const b of breaks) {
      expect(b.loadFactor).toBe(6);
      expect(launched).toContain(b.interceptorId);
    }
    expect(new Set(breaks.map((b) => b.interceptorId)).size).toBe(breaks.length);
    // In the break it pulls far more than its routine 2 g, but never more than 6 g.
    const sharpest = sharpestTurn(samples, 1);
    expect(sharpest).toBeGreaterThan(2 * turnRateRadS(340, 2) * 5 * TICK_S);
    expect(sharpest).toBeLessThanOrEqual(turnRateRadS(340, 6) * 5 * TICK_S + 1e-9);
    // Without evasive turns it flies its route at the routine bank and never breaks.
    expect(ofKind(run(false).events, 'evasiveTurn')).toHaveLength(0);
  });

  it("keeps the jet's track through its 6 g break, through the tracker's maneuver gate", () => {
    const fly = (maneuverGate: boolean) => {
      const sim = new Simulation({
        seed: 2026,
        autoTraffic: false,
        tracker: maneuverGate ? {} : { maneuverNoise: null },
      });
      sim.dispatch({
        kind: 'spawnTraffic',
        type: 'jet',
        eastM: 0,
        northM: 28_000,
        headingRad: Math.PI,
        altitudeM: 1_000,
      });
      const events: SimEvent[] = [];
      let maneuvering = false;
      for (let s = 0; s < 60 * 5; s++) {
        events.push(...sim.run(10));
        if (sim.snapshot().tracks.some((t) => t.truthId === 1 && t.maneuvering)) maneuvering = true;
      }
      const first = ofKind(events, 'trackConfirmed').find((e) => e.id === 1)?.trackId;
      const lost = ofKind(events, 'contactLost').filter((e) => e.trackId === first);
      return { breaks: ofKind(events, 'evasiveTurn').length, maneuvering, lost: lost.length };
    };
    // Its first track lives on through the break, so the battery never has to identify it again.
    expect(fly(true)).toEqual({ breaks: expect.any(Number), maneuvering: true, lost: 0 });
    expect(fly(true).breaks).toBeGreaterThan(0);
    // With the normal gate alone, the break throws the echoes out of it: the track is lost.
    expect(fly(false).lost).toBe(1);
  });

  it('flies slower over the ground into a headwind, faster downwind, and crabs in a crosswind', () => {
    // A north wind of 8 m/s at 10 m: at a drone's 300 m it is 8 × 30^(1/7) = 13 m/s.
    const wind = { speedMps: 8, fromRad: 0 };
    const sim = new Simulation({ seed: 1, autoTraffic: false, terrain: false, wind });
    sim.dispatch({ kind: 'setRules', rules: { weaponsControl: 'HOLD' } });
    const spawn = (eastM: number, northM: number, headingRad: number) =>
      sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM, northM, headingRad });
    spawn(0, 20_000, Math.PI); // flying south, downwind
    spawn(0, -20_000, 0); // flying north, into the wind
    spawn(-20_000, 5_000, Math.PI / 2); // flying east, across it
    sim.run(50 * 5);
    const w = windSpeedAt(wind, 300);
    const [downwind, upwind, across] = sim.snapshot().aircraft;
    const speed = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);
    expect(speed(downwind?.velocity ?? vec3(0, 0, 0))).toBeCloseTo(40 + w, 6);
    expect(speed(upwind?.velocity ?? vec3(0, 0, 0))).toBeCloseTo(40 - w, 6);
    // Across the wind it holds its track east, nose turned north into the wind.
    expect(across?.velocity.y ?? 1).toBeCloseTo(0, 6);
    expect(angleDiff(across?.headingRad ?? 0, Math.PI / 2)).toBeCloseTo(-Math.asin(w / 40), 6);
  });

  it("draws each run's wind from its seed without changing anything else in the run", () => {
    const windy = new Simulation({ seed: 9 });
    const calm = new Simulation({ seed: 9, wind: false });
    expect(windy.snapshot().wind).toEqual(windFromSeed(9));
    expect(calm.snapshot().wind).toEqual(CALM);
    const where = (sim: Simulation) =>
      sim.snapshot().aircraft.map((a) => [a.type, a.position.x, a.position.y, a.trackRad]);
    expect(where(windy)).toEqual(where(calm));
    expect(where(windy).length).toBeGreaterThan(0);
  });
});

describe('Step 4 world: clutter and Doppler', () => {
  // The ideal radar with the clutter notch, reaching far enough to see a drone at 32 km.
  const radar = { ...IDEAL_SEARCH_RADAR, dopplerNotchMps: 10, referenceRangeM: 100_000 };

  /** How often the radar paints a drone dropped at (east, north) in a minute, over flat land. */
  function paintsInAMinute(eastM: number, northM: number, headingRad: number): number {
    const sim = new Simulation({
      seed: 6,
      autoTraffic: false,
      terrain: false,
      radar,
      wind: false,
      evasiveTurns: false,
    });
    sim.dispatch({ kind: 'setRules', rules: { weaponsControl: 'HOLD' } });
    sim.dispatch({ kind: 'spawnTraffic', type: 'drone', eastM, northM, headingRad });
    const paints = new Set<number>();
    for (let s = 0; s < 60; s++) {
      sim.run(50);
      const tick = sim.snapshot().aircraft[0]?.lastPaint?.tick;
      if (tick !== undefined) paints.add(tick);
    }
    return paints.size;
  }

  it('loses a drone flying across the beam over lit ground', () => {
    // 6 km north, flying east: closing slower than 10 m/s while within 1.55 km of due north.
    expect(paintsInAMinute(-1_500, 6_000, Math.PI / 2)).toBe(0);
  });

  it('still sees it flying straight at the radar over the same ground', () => {
    expect(paintsInAMinute(0, 6_000, Math.PI)).toBe(15);
  });

  it('sees an airliner crossing high above, where the ground at its distance is in shadow', () => {
    const sim = new Simulation({
      seed: 6,
      autoTraffic: false,
      terrain: false,
      radar: { ...radar, dopplerNotchMps: 300 },
      wind: false,
      evasiveTurns: false,
    });
    // 12 km north at 10 km: 15.6 km away. Every echo is inside a 300 m/s notch, yet it is seen.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: -1_000,
      northM: 12_000,
      headingRad: Math.PI / 2,
      altitudeM: 10_000,
    });
    sim.run(50 * 9);
    expect(sim.snapshot().aircraft[0]?.lastPaint).not.toBeNull();
  });

  it('sees the crossing drone where the ground is in shadow, beyond the 14 km ground horizon', () => {
    // Every turn: 14 or 15 paints in a minute, as it crosses north between two of them.
    expect(paintsInAMinute(-1_500, 20_000, Math.PI / 2)).toBeGreaterThanOrEqual(14);
  });
});
