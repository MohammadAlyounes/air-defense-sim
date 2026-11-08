import { describe, expect, it } from 'vitest';
import { distance, sub } from './core/vec';
import { Simulation } from './simulation';
import { trackEllipseAt, trackPositionAt } from './tracker';

/** A noisy radar over flat ground, no other traffic. */
const sky = (seed: number) => new Simulation({ seed, autoTraffic: false, terrain: false });

describe('Step 5 tracking: the Kalman filter at work', () => {
  it('estimates positions better than the raw echoes', () => {
    const sim = sky(11);
    // An airliner crossing 25 km north of the battery: never engaged, always detected.
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: -20_000,
      northM: 25_000,
      headingRad: Math.PI / 2,
    });
    let plotSq = 0;
    let trackSq = 0;
    let n = 0;
    for (let turn = 0; turn < 40; turn++) {
      sim.run(200);
      const s = sim.snapshot();
      const truth = s.aircraft[0];
      const track = s.tracks[0];
      const lastPlot = s.plots.filter((p) => p.truthId !== null).at(-1);
      if (!truth || !track || !lastPlot || turn < 5) continue;
      // Compare both with the truth at the time of the last echo.
      const back = (s.tick - track.lastPaintTick) * 0.02;
      const then = sub(truth.position, {
        x: truth.velocity.x * back,
        y: truth.velocity.y * back,
        z: 0,
      });
      plotSq += distance(lastPlot.position, then) ** 2;
      trackSq += distance(track.position, then) ** 2;
      n++;
    }
    expect(n).toBeGreaterThan(20);
    expect(Math.sqrt(trackSq / n)).toBeLessThan(0.75 * Math.sqrt(plotSq / n));
  });

  it('knows its velocity to within a few metres per second after a minute', () => {
    const sim = sky(12);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: -20_000,
      northM: 25_000,
      headingRad: Math.PI / 2,
    });
    sim.run(50 * 60);
    const s = sim.snapshot();
    const truth = s.aircraft[0];
    const track = s.tracks[0];
    expect(truth && track?.velocity).toBeTruthy();
    if (!truth || !track?.velocity) return;
    const error = sub(track.velocity, truth.velocity);
    // Horizontally within a few m/s; vertically looser, since elevation is the noisiest measurement.
    expect(Math.hypot(error.x, error.y)).toBeLessThan(8);
    expect(Math.abs(error.z)).toBeLessThan(25);
    // And it is honest about it: the true position sits inside its 3-sigma ellipse (roughly).
    const miss = distance(trackPositionAt(track, s.tick), truth.position);
    expect(miss).toBeLessThan(3 * trackEllipseAt(track, s.tick).majorM + 50);
  });

  it('sorts out a drone swarm: a confirmed track for (almost) every drone', () => {
    const sim = sky(13);
    sim.dispatch({
      kind: 'spawnTraffic',
      type: 'swarm',
      eastM: 3_000,
      northM: 6_000,
      headingRad: 0.25 * Math.PI,
    });
    sim.run(50 * 30);
    const s = sim.snapshot();
    const confirmed = s.tracks.filter(
      (t) => t.confirmedTick !== null && s.tick - t.lastPaintTick < 250,
    );
    const sources = new Set(confirmed.map((t) => t.truthId));
    // Two of these six drones fly 33 m apart, closer than the radar can tell apart, so one of
    // them may share a track for a while.
    expect(sources.size).toBeGreaterThanOrEqual(5);
  });
});
