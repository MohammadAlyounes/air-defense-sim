import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_EXIT_RANGE_M,
  corridorFrame,
  DEFAULT_CORRIDORS,
  fliesCorridor,
  type AirCorridor,
} from './airspace';
import { DEFAULT_ASSETS } from './assets';
import { Rng } from './core/rng';
import { corridorFlight, DEFAULT_AUTO_TRAFFIC, planFlight } from './scenario';

const DEG = Math.PI / 180;
const [north, southWest] = DEFAULT_CORRIDORS as [AirCorridor, AirCorridor];
const compass = (p: { x: number; y: number }) => {
  const b = Math.atan2(p.x, p.y) / DEG;
  return b < 0 ? b + 360 : b;
};

describe('scenario airliners', () => {
  it('enter at the end of a lane closest to their entry bearing, and fly to its other end', () => {
    // The lanes meet the 38 km circle at 72° and 308° (north) and at 160° and 270° (south-west).
    const cases = [
      { entryDeg: 80, lane: north, endDeg: 71.7 },
      { entryDeg: 330, lane: north, endDeg: 308.3 },
      { entryDeg: 150, lane: southWest, endDeg: 160.4 },
      { entryDeg: 250, lane: southWest, endDeg: 269.6 },
    ];
    for (const { entryDeg, lane, endDeg } of cases) {
      const flight = corridorFlight(DEFAULT_CORRIDORS, entryDeg * DEG, 38_000, 0);
      expect(flight.corridor).toBe(lane);
      expect(compass(flight.entry)).toBeCloseTo(endDeg, 0);
      expect(Math.hypot(flight.entry.x, flight.entry.y)).toBeCloseTo(38_000, 6);
      // It leaves at the other end, 44 km out: just outside the area, so it flies out of it.
      const entry = corridorFrame(lane, flight.entry.x, flight.entry.y);
      const exit = corridorFrame(lane, flight.exit.x, flight.exit.y);
      expect(Math.sign(exit.alongM)).toBe(-Math.sign(entry.alongM));
      expect(Math.hypot(flight.exit.x, flight.exit.y)).toBeCloseTo(CORRIDOR_EXIT_RANGE_M, 6);
    }
  });

  it('keep within half of the lane’s half-width of its centreline', () => {
    for (const offset of [-1, 1]) {
      const flight = corridorFlight(DEFAULT_CORRIDORS, 80 * DEG, 38_000, offset);
      const entry = corridorFrame(north, flight.entry.x, flight.entry.y);
      const exit = corridorFrame(north, flight.exit.x, flight.exit.y);
      expect(entry.acrossM).toBeCloseTo(offset * 2_500, 6);
      expect(exit.acrossM).toBeCloseTo(offset * 2_500, 6);
    }
  });

  it('always fly a corridor, at the start of a run and as they arrive', () => {
    const config = { ...DEFAULT_AUTO_TRAFFIC, mix: [{ value: 'airliner' as const, weight: 1 }] };
    const rng = new Rng(7);
    for (let i = 0; i < 40; i++) {
      const underway = i % 2 === 0;
      const flight = planFlight(rng, config, underway, DEFAULT_ASSETS, rng);
      expect(flight.position.z).toBe(11_000);
      const lane = DEFAULT_CORRIDORS.find((l) =>
        fliesCorridor(l, flight.position, flight.trackRad),
      );
      expect(lane).toBeDefined();
      const exit = flight.route.at(-1);
      expect(Math.hypot(exit?.x ?? 0, exit?.y ?? 0)).toBeGreaterThan(42_000);
      // New arrivals enter on the edge of the area (a little inside it when off the centreline).
      const rangeM = Math.hypot(flight.position.x, flight.position.y);
      if (!underway) expect(Math.abs(rangeM - 38_000)).toBeLessThan(1_500);
    }
  });

  it('fall back to flying across the area when there are no corridors', () => {
    const config = { ...DEFAULT_AUTO_TRAFFIC, mix: [{ value: 'airliner' as const, weight: 1 }] };
    const flight = planFlight(new Rng(7), config, false, DEFAULT_ASSETS, new Rng(8), []);
    const aim = flight.route.at(-1);
    expect(Math.hypot(aim?.x ?? 0, aim?.y ?? 0)).toBeLessThanOrEqual(14_000);
  });
});
