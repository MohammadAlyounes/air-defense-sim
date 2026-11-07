import { BufferAttribute, BufferGeometry, Vector3, type DataTexture, type Ray } from 'three';
import { coverageAt } from '../../../sim';
import { worldCoverage, worldTerrain } from '../../world/world';
import { SCENE_UNITS_PER_M } from './coords';
import { RADAR_RANGE_KM } from './sceneConstants';

/** Terrain helpers for the 3D view: heights in scene units, the mesh, blind zones, picking. */

/** Height of the ground below a point, in scene units, with heights stretched. */
export function groundSceneY(eastM: number, northM: number, heightScale: number): number {
  return worldTerrain().heightAt(eastM, northM) * SCENE_UNITS_PER_M * heightScale;
}

/** A square grid over the terrain: positions in km (y up), true heights in metres. */
export function buildTerrainGeometry(segments: number, halfKm: number): BufferGeometry {
  const terrain = worldTerrain();
  const n = segments + 1;
  const positions = new Float32Array(n * n * 3);
  const heights = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    const northKm = -halfKm + (row / segments) * 2 * halfKm;
    for (let col = 0; col < n; col++) {
      const eastKm = -halfKm + (col / segments) * 2 * halfKm;
      const i = row * n + col;
      heights[i] = terrain.heightAt(eastKm * 1000, northKm * 1000);
      positions[i * 3] = eastKm;
      positions[i * 3 + 2] = -northKm;
    }
  }
  const index = new Uint32Array(segments * segments * 6);
  let k = 0;
  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * n + col;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      // Counter-clockwise seen from above (north is -z).
      index.set([a, b, c, b, d, c], k);
      k += 6;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('aHeight', new BufferAttribute(heights, 1));
  geometry.setIndex(new BufferAttribute(index, 1));
  return geometry;
}

/** 1 where the radar cannot see a target `altitudeM` above the ground, else 0. */
export function fillCoverageTexture(texture: DataTexture, size: number, altitudeM: number) {
  const map = worldCoverage();
  const data = texture.image.data as Uint8Array;
  const half = RADAR_RANGE_KM * 1000;
  for (let row = 0; row < size; row++) {
    const north = ((row + 0.5) / size) * 2 * half - half;
    for (let col = 0; col < size; col++) {
      const east = ((col + 0.5) / size) * 2 * half - half;
      data[row * size + col] = coverageAt(map, east, north) > altitudeM ? 255 : 0;
    }
  }
  texture.needsUpdate = true;
}

/**
 * Where a ray from the camera first meets the terrain: march along it in short steps until it
 * dips below the ground, then narrow the crossing down by bisection. Null if it never does
 * (pointing at the sky). Scene units: km, y up, north is -z.
 */
export function rayTerrainHit(ray: Ray, heightScale: number, maxKm = 400): Vector3 | null {
  const terrain = worldTerrain();
  const point = new Vector3();
  const above = (t: number) => {
    ray.at(t, point);
    const ground = terrain.heightAt(point.x * 1000, -point.z * 1000) * SCENE_UNITS_PER_M;
    return point.y - ground * heightScale;
  };
  const step = 0.25;
  let before = 0;
  for (let t = step; t <= maxKm; t += step) {
    if (above(t) > 0) {
      before = t;
      continue;
    }
    let low = before;
    let high = t;
    for (let i = 0; i < 20; i++) {
      const mid = (low + high) / 2;
      if (above(mid) > 0) low = mid;
      else high = mid;
    }
    return ray.at(high, new Vector3());
  }
  return null;
}
