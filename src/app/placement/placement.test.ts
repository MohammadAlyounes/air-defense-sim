import { describe, expect, it } from 'vitest';
import {
  corridorFrame,
  coverageMap,
  DEFAULT_CORRIDORS,
  fliesCorridor,
  flatTerrain,
  vec3,
  type AirCorridor,
} from '../../sim';
import {
  headingToBattery,
  isValidDrop,
  keyboardSpot,
  placementFacts,
  spawnCommand,
  stepAltitude,
} from './placement';

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('placement', () => {
  it('aims dropped traffic straight at the battery', () => {
    expect(deg(headingToBattery({ eastM: 0, northM: 20_000 }))).toBeCloseTo(180); // from the north: fly south
    expect(deg(headingToBattery({ eastM: 20_000, northM: 0 }))).toBeCloseTo(270); // from the east: fly west
    expect(deg(headingToBattery({ eastM: -10_000, northM: -10_000 }))).toBeCloseTo(45);
  });

  it('accepts drops inside the radar coverage, but not on top of the battery', () => {
    expect(isValidDrop({ eastM: 0, northM: 20_000 })).toBe(true);
    expect(isValidDrop({ eastM: 1_000, northM: 1_000 })).toBe(false);
    expect(isValidDrop({ eastM: 30_000, northM: 30_000 })).toBe(false); // 42 km
  });

  it('changes altitude 15% per wheel notch, within the type limits', () => {
    expect(stepAltitude('jet', 6_000, 1)).toBe(6_900);
    expect(stepAltitude('jet', 6_000, -1)).toBe(5_220);
    expect(stepAltitude('cruise', 50, 10)).toBe(150); // capped: terrain-huggers stay low
    expect(stepAltitude('airliner', 11_000, -5)).toBe(8_000);
  });

  it('builds the spawn command the simulation records', () => {
    expect(spawnCommand('cruise', { eastM: 12_000.4, northM: -5_000 }, 50)).toEqual({
      kind: 'spawnTraffic',
      type: 'cruise',
      eastM: 12_000,
      northM: -5_000,
      headingRad: headingToBattery({ eastM: 12_000.4, northM: -5_000 }),
      altitudeM: 50,
    });
  });

  it('lets a placed airliner choose its own way: no heading, so it joins a civil corridor', () => {
    const command = spawnCommand('airliner', { eastM: 0, northM: 10_000 }, 11_000);
    expect(command).toEqual({
      kind: 'spawnTraffic',
      type: 'airliner',
      eastM: 0,
      northM: 10_000,
      altitudeM: 11_000,
    });
    expect('headingRad' in command).toBe(false);
  });

  it('sends an airliner to the nearest corridor at 45°, then along it out of the area', () => {
    const north = DEFAULT_CORRIDORS[0] as AirCorridor;
    const at = { eastM: 0, northM: 10_000 };
    const facts = placementFacts('airliner', at);
    expect(facts.timeToBatteryS).toBeNull();
    // 18 km − 10 km × cos 10° = 8.15 km south of the north lane: a 45° join of 8.15 km × √2,
    // at 230 m/s.
    const { acrossM } = corridorFrame(north, at.eastM, at.northM);
    expect(acrossM).toBeCloseTo(18_000 - 10_000 * Math.cos((10 * Math.PI) / 180), 6);
    expect(facts.corridor?.name).toBe('North corridor');
    expect(facts.corridor?.joinInS).toBeCloseTo((acrossM * Math.SQRT2) / 230, 6);
    const [join, end] = facts.route;
    expect(corridorFrame(north, join?.x ?? 0, join?.y ?? 0).acrossM).toBeCloseTo(0, 6);
    const exit = vec3(end?.x ?? 0, end?.y ?? 0, 11_000);
    expect(Math.hypot(exit.x, exit.y)).toBeCloseTo(44_000, 6);
    expect(fliesCorridor(north, exit, north.axisRad)).toBe(true);
    // Other traffic still heads for the battery.
    expect(placementFacts('jet', at).corridor).toBeNull();
  });

  it('places keyboard threats 30 km out, further round each time', () => {
    const first = keyboardSpot(0);
    expect(Math.hypot(first.eastM, first.northM)).toBeCloseTo(30_000);
    expect(deg(Math.atan2(first.eastM, first.northM))).toBeCloseTo(45);
    expect(deg(Math.atan2(keyboardSpot(1).eastM, keyboardSpot(1).northM))).toBeCloseTo(115);
  });

  it('routes a cruise-missile-like target round a dog-leg, and a drone straight in', () => {
    const cruise = placementFacts('cruise', { eastM: 0, northM: 30_000 });
    expect(cruise.route).toHaveLength(2);
    expect(cruise.route[1]?.x).toBeCloseTo(0, 6);
    expect(cruise.route[1]?.y).toBeCloseTo(0, 6);
    // 30 km direct, 33.5 km round the dog-leg (two legs of √(15² + 7.5²) km), at 240 m/s.
    expect(cruise.timeToBatteryS).toBeCloseTo((2 * Math.hypot(15_000, 7_500)) / 240, 6);
    expect(placementFacts('swarm', { eastM: 0, northM: 12_000 }).route).toHaveLength(1);
  });

  it('times the flight through the wind', () => {
    // A north wind of 8 m/s: 13 m/s at a drone's 300 m. Dropped north of the battery, the
    // drone flies south with it; dropped south, it flies into it.
    const wind = { speedMps: 8, fromRad: 0 };
    const world = { terrain: flatTerrain(), coverage: coverageMap(flatTerrain(), 12, 40_000) };
    const downwind = placementFacts('drone', { eastM: 0, northM: 12_000 }, 300, world, wind);
    const upwind = placementFacts('drone', { eastM: 0, northM: -12_000 }, 300, world, wind);
    expect(downwind.timeToBatteryS).toBeCloseTo(12_000 / (40 + 13.005), 1);
    expect(upwind.timeToBatteryS).toBeCloseTo(12_000 / (40 - 13.005), 1);
  });

  it('tells how long it will take and when the radar will see it', () => {
    const facts = placementFacts('drone', { eastM: 0, northM: 12_000 });
    expect(facts.timeToBatteryS).toBeCloseTo(300); // 12 km at 40 m/s
    expect(facts.detectedFromM).toBeCloseTo(9_487, 0); // a tiny radar size
    // Over the generated terrain it is first seen no farther out than over open ground.
    expect(facts.firstSeenM).not.toBeNull();
    expect(facts.firstSeenM ?? Infinity).toBeLessThanOrEqual(facts.detectedFromM);
  });
});

describe('first sighting on the route', () => {
  const flat = flatTerrain();
  const ridge = {
    ...flat,
    // A 400 m ridge 8 to 9 km north of the battery.
    heightAt: (_east: number, north: number) => (north > 8_000 && north < 9_000 ? 400 : 0),
  };
  const world = (terrain: typeof flat) => ({ terrain, coverage: coverageMap(terrain, 12, 40_000) });

  it('over open ground, is the 50% detection range', () => {
    const facts = placementFacts('cruise', { eastM: 0, northM: 30_000 }, 50, world(flat));
    expect(facts.firstSeenM).toBeCloseTo(facts.detectedFromM, -3);
  });

  it('behind a ridge, comes only once the target has crossed it', () => {
    const facts = placementFacts('cruise', { eastM: 0, northM: 30_000 }, 50, world(ridge));
    // Its dog-leg brings it back in from the north-west, over the ridge about 10 km out.
    expect(facts.route).toHaveLength(2);
    expect(facts.firstSeenM).toBeLessThanOrEqual(10_100);
    expect(facts.firstSeenM).toBeGreaterThan(8_900);
    // A jet high above the ridge is in view at once: it is dropped inside its detection range.
    const jet = placementFacts('jet', { eastM: 0, northM: 30_000 }, 6_000, world(ridge));
    expect(jet.firstSeenM).toBe(30_000);
  });
});
