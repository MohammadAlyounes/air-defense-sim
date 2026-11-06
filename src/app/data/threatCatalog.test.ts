import { describe, expect, it } from 'vitest';
import {
  altitudeBar,
  RADAR_SIZE_BAR,
  speedBar,
  STAT_SCALE,
  TRAFFIC_CATALOG,
} from './threatCatalog';

describe('traffic catalog', () => {
  it('offers the three threat classes plus friendly and civil traffic', () => {
    const ids = TRAFFIC_CATALOG.map((t) => t.id);
    expect(ids).toEqual(['drone', 'swarm', 'cruise', 'jet', 'friendly', 'airliner']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes traffic that must never be engaged', () => {
    const nonHostile = TRAFFIC_CATALOG.filter((t) => t.affiliation !== 'hostile').map((t) => t.id);
    expect(nonHostile).toEqual(['friendly', 'airliner']);
  });

  it('keeps every value positive and within the palette scales', () => {
    for (const t of TRAFFIC_CATALOG) {
      expect(t.speedMps).toBeGreaterThan(0);
      expect(t.speedMps).toBeLessThanOrEqual(STAT_SCALE.maxSpeedMps);
      expect(t.altitudeM).toBeGreaterThan(0);
      expect(t.altitudeM).toBeLessThanOrEqual(STAT_SCALE.maxAltitudeM);
      expect(t.count).toBeGreaterThanOrEqual(1);
      // Must fit in two lines on a palette card.
      expect(t.insight.length).toBeLessThanOrEqual(60);
    }
  });

  it('spawns a swarm as a group of drones', () => {
    expect(TRAFFIC_CATALOG.find((t) => t.id === 'swarm')?.count).toBe(6);
  });
});

describe('palette stat bars', () => {
  it('maps speed linearly onto 0..1', () => {
    expect(speedBar(0)).toBe(0);
    expect(speedBar(STAT_SCALE.maxSpeedMps / 2)).toBeCloseTo(0.5);
    expect(speedBar(10_000)).toBe(1);
  });

  it('maps altitude on a square-root scale so low flyers stay visible', () => {
    expect(altitudeBar(0)).toBe(0);
    expect(altitudeBar(STAT_SCALE.maxAltitudeM)).toBe(1);
    expect(altitudeBar(STAT_SCALE.maxAltitudeM / 4)).toBeCloseTo(0.5);
    expect(altitudeBar(-50)).toBe(0);
  });

  it('orders radar sizes from tiny to large', () => {
    const { tiny, small, medium, large } = RADAR_SIZE_BAR;
    expect(tiny).toBeLessThan(small);
    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(large);
  });
});
