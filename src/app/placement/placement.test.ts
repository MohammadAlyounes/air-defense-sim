import { describe, expect, it } from 'vitest';
import { coverageMap, flatTerrain } from '../../sim';
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

  it('places keyboard threats 30 km out, further round each time', () => {
    const first = keyboardSpot(0);
    expect(Math.hypot(first.eastM, first.northM)).toBeCloseTo(30_000);
    expect(deg(Math.atan2(first.eastM, first.northM))).toBeCloseTo(45);
    expect(deg(Math.atan2(keyboardSpot(1).eastM, keyboardSpot(1).northM))).toBeCloseTo(115);
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
    expect(facts.firstSeenM).toBeLessThanOrEqual(9_000);
    // A jet high above the ridge is in view at once: it is dropped inside its detection range.
    const jet = placementFacts('jet', { eastM: 0, northM: 30_000 }, 6_000, world(ridge));
    expect(jet.firstSeenM).toBe(30_000);
  });
});
