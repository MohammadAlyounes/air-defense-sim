import { Line } from '@react-three/drei';
import { useMemo } from 'react';
import { useViewStore } from '../../view/viewStore';
import { DEFENDED_RADIUS_KM, RADAR_RANGE_KM, RING_STEP_KM } from './sceneConstants';
import { TerrainLayer } from './Terrain';
import { groundSceneY } from './terrainGeometry';

/** Lines drawn over the terrain float this far above it, m, before the height stretch. */
const DRAPE_LIFT_M = 25;

/** A circle around the battery that follows the ground, in scene units. */
function drapedCircle(radiusKm: number, heightScale: number, segments = 160) {
  return Array.from({ length: segments + 1 }, (_, i): [number, number, number] => {
    const angle = (i / segments) * 2 * Math.PI;
    const eastM = radiusKm * 1000 * Math.sin(angle);
    const northM = radiusKm * 1000 * Math.cos(angle);
    const y = groundSceneY(eastM, northM, heightScale) + (DRAPE_LIFT_M / 1000) * heightScale;
    return [eastM / 1000, y, -northM / 1000];
  });
}

/**
 * The ground: procedural terrain (with the radar sweep and blind zones drawn on it), and range
 * rings every 10 km that follow the hills, like the scope (their labels are in Labels.tsx).
 *
 * The rings are drawn after the terrain without a depth test, so a ring a few metres above a
 * slope never flickers in and out of it from 100 km away.
 */
export function GroundAndRings() {
  const heightScale = useViewStore((state) => state.heightScale);
  const rings = useMemo(
    () =>
      Array.from({ length: RADAR_RANGE_KM / RING_STEP_KM }, (_, i) => {
        const radius = (i + 1) * RING_STEP_KM;
        return { radius, points: drapedCircle(radius, heightScale) };
      }),
    [heightScale],
  );
  const defended = useMemo(() => drapedCircle(DEFENDED_RADIUS_KM, heightScale, 96), [heightScale]);

  return (
    <group>
      <TerrainLayer />
      {rings.map(({ radius, points }) => (
        <Line
          key={radius}
          points={points}
          color="#22d3ee"
          lineWidth={radius === RADAR_RANGE_KM ? 1.6 : 1}
          transparent
          depthWrite={false}
          depthTest={false}
          renderOrder={1}
          opacity={radius === RADAR_RANGE_KM ? 0.55 : 0.25}
        />
      ))}
      {/* The defended area: hostiles whose course passes inside it are threats. */}
      <Line
        points={defended}
        color="#fbbf24"
        lineWidth={1.4}
        dashed
        dashSize={0.5}
        gapSize={0.4}
        transparent
        depthWrite={false}
        depthTest={false}
        renderOrder={1}
        opacity={0.6}
      />
    </group>
  );
}
