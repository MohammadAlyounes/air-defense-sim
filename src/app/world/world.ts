import {
  coverageMap,
  createTerrain,
  DEFAULT_SEARCH_RADAR,
  lineOfSight,
  vec3,
  type CoverageMap,
  type Terrain,
  type Vec3,
  type Visibility,
} from '../../sim';

/**
 * The fictional landscape every run uses, and the radar's coverage over it. Both are fixed
 * (the terrain has its own seed), so they are built once, on first use, and shared by the
 * simulation, the 3D view, the scope and the placement readout.
 */

let terrain: Terrain | null = null;
let coverage: CoverageMap | null = null;

export function worldTerrain(): Terrain {
  terrain ??= createTerrain();
  return terrain;
}

/** Lowest visible height above the ground, per bearing and range, for the search radar. */
export function worldCoverage(): CoverageMap {
  coverage ??= coverageMap(
    worldTerrain(),
    DEFAULT_SEARCH_RADAR.antennaHeightM,
    DEFAULT_SEARCH_RADAR.rangeM,
    720,
    200,
  );
  return coverage;
}

/** The search radar's antenna, in the simulation's frame. */
export function radarAntenna(): Vec3 {
  return vec3(0, 0, worldTerrain().heightAt(0, 0) + DEFAULT_SEARCH_RADAR.antennaHeightM);
}

/** Can the radar see this point, or is it hidden below the horizon or behind a hill? */
export function visibilityOf(position: Vec3): Visibility {
  return lineOfSight(worldTerrain(), radarAntenna(), position);
}

/** Target heights offered by the coverage overlay: low flyer, drone, aircraft. */
export const COVERAGE_ALTITUDES_M = [50, 300, 1_000] as const;
export type CoverageAltitude = (typeof COVERAGE_ALTITUDES_M)[number];
