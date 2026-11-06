import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  MeshStandardMaterial,
  type Material,
} from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Affiliation, AircraftType } from '../../../sim';
import { AIRLINER_ENGINES, SILHOUETTES } from '../../data/silhouettes';

/**
 * 3D aircraft models, built once and shared. Fixed-wing types are the palette silhouettes,
 * extruded; the drone is built from simple parts. Every model is about 1 unit wide with its
 * nose toward -z (north), so it can be scaled to a constant on-screen size and turned to
 * any heading.
 */

const ICON_BOX = 32;

function extrudeSilhouette(pathD: string, extras: string): BufferGeometry {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path d="${pathD}"/>${extras}</svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((path) => path.toShapes());
  const geometry = new ExtrudeGeometry(shapes, {
    depth: 2,
    bevelEnabled: true,
    bevelThickness: 0.5,
    bevelSize: 0.35,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geometry.translate(-ICON_BOX / 2, -ICON_BOX / 2, -1);
  // The icon's y axis points down the page (nose at the top). Rotating it flat maps
  // icon (x, y) to scene (x, z), so the nose ends up toward -z: north.
  geometry.rotateX(Math.PI / 2);
  geometry.scale(1 / ICON_BOX, 1 / ICON_BOX, 1 / ICON_BOX);
  geometry.computeVertexNormals();
  return geometry;
}

function buildDrone(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const body = new BoxGeometry(0.22, 0.08, 0.22);
  parts.push(body);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const arm = new BoxGeometry(0.06, 0.04, 0.95);
    arm.rotateY(angle);
    parts.push(arm);
  }
  for (const [x, z] of [
    [0.33, 0.33],
    [-0.33, 0.33],
    [0.33, -0.33],
    [-0.33, -0.33],
  ] as const) {
    const rotor = new CylinderGeometry(0.17, 0.17, 0.03, 20);
    rotor.translate(x, 0.05, z);
    parts.push(rotor);
  }
  const merged = mergeGeometries(parts.map((part) => part.toNonIndexed()));
  if (!merged) throw new Error('Could not build the drone model');
  merged.computeVertexNormals();
  return merged;
}

let cache: Record<AircraftType, BufferGeometry> | null = null;

/** Shared model geometry for each aircraft type (built on first use, in the browser). */
export function aircraftGeometry(type: AircraftType): BufferGeometry {
  if (!cache) {
    const engines = AIRLINER_ENGINES.map(
      ([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}"/>`,
    ).join('');
    cache = {
      drone: buildDrone(),
      cruise: extrudeSilhouette(SILHOUETTES.cruise, ''),
      jet: extrudeSilhouette(SILHOUETTES.jet, ''),
      friendly: extrudeSilhouette(SILHOUETTES.friendly, ''),
      airliner: extrudeSilhouette(SILHOUETTES.airliner, engines),
    };
  }
  return cache[type];
}

/** Affiliation colors, matching the palette and the rest of the UI. */
export const AFFILIATION_COLOR: Readonly<Record<Affiliation, string>> = {
  hostile: '#f87171',
  friend: '#60a5fa',
  neutral: '#4ade80',
};

const materials = new Map<string, Material>();

/** Shared material per affiliation; selected aircraft glow brighter. */
export function aircraftMaterial(affiliation: Affiliation, selected: boolean): Material {
  const key = `${affiliation}:${selected}`;
  let material = materials.get(key);
  if (!material) {
    const color = AFFILIATION_COLOR[affiliation];
    material = new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: selected ? 0.9 : 0.4,
      metalness: 0.15,
      roughness: 0.55,
    });
    materials.set(key, material);
  }
  return material;
}
