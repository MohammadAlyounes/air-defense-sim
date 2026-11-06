import { describe, expect, it } from 'vitest';
import { TICK_S } from './core/clock';
import { antennaAzimuth, sweptOver } from './radar';

const deg = (d: number) => (d * Math.PI) / 180;

describe('search radar sweep', () => {
  it('turns the antenna once per period, clockwise from north', () => {
    expect(antennaAzimuth(0, 4)).toBe(0);
    expect(antennaAzimuth(1, 4)).toBeCloseTo(Math.PI / 2);
    expect(antennaAzimuth(3, 4)).toBeCloseTo((3 * Math.PI) / 2);
    expect(antennaAzimuth(4, 4)).toBeCloseTo(0);
    expect(antennaAzimuth(5, 4)).toBeCloseTo(Math.PI / 2);
  });

  it('detects bearings inside the swept arc, including across north', () => {
    expect(sweptOver(deg(10), deg(20), deg(15))).toBe(true);
    expect(sweptOver(deg(10), deg(20), deg(20))).toBe(true); // end of the arc included
    expect(sweptOver(deg(10), deg(20), deg(10))).toBe(false); // start excluded
    expect(sweptOver(deg(10), deg(20), deg(25))).toBe(false);
    expect(sweptOver(deg(355), deg(5), deg(1))).toBe(true);
    expect(sweptOver(deg(355), deg(5), deg(358))).toBe(true);
    expect(sweptOver(deg(355), deg(5), deg(340))).toBe(false);
  });

  it('sweeps every bearing exactly once per turn', () => {
    const ticksPerTurn = Math.round(4 / TICK_S);
    for (const bearingRad of [0.001, 1.234, Math.PI, 6.2]) {
      let hits = 0;
      for (let tick = 1; tick <= ticksPerTurn; tick++) {
        const from = antennaAzimuth((tick - 1) * TICK_S, 4);
        const to = antennaAzimuth(tick * TICK_S, 4);
        if (sweptOver(from, to, bearingRad)) hits++;
      }
      expect(hits).toBe(1);
    }
  });
});
