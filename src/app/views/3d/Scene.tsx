import { Grid, Line } from '@react-three/drei';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Material, Mesh } from 'three';
import { RADAR_RANGE_KM, RING_STEP_KM } from './sceneConstants';

function circlePoints(radius: number, segments = 128): [number, number, number][] {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = (i / segments) * 2 * Math.PI;
    return [radius * Math.sin(angle), 0.004, -radius * Math.cos(angle)];
  });
}

/**
 * Ground grid and range rings every 10 km, like the scope (their labels are in Labels.tsx).
 *
 * The ground layers sit a few metres apart, which a depth buffer cannot separate from 100 km
 * away, so they skip depth writes and are drawn in a fixed order instead: ground, grid,
 * radar sweep, rings. Nothing is ever below the ground, so nothing needs hiding by it.
 */
export function GroundAndRings() {
  const grid = useRef<Mesh>(null);
  useLayoutEffect(() => {
    const material = grid.current?.material as Material | undefined;
    if (material) material.depthWrite = false;
  }, []);
  const rings = useMemo(
    () =>
      Array.from({ length: RADAR_RANGE_KM / RING_STEP_KM }, (_, i) => {
        const radius = (i + 1) * RING_STEP_KM;
        return { radius, points: circlePoints(radius) };
      }),
    [],
  );

  return (
    <group>
      {/* Solid ground under the grid, so drop lines have something to land on. */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01} renderOrder={-3}>
        <circleGeometry args={[160, 96]} />
        <meshStandardMaterial color="#07101d" roughness={1} metalness={0} depthWrite={false} />
      </mesh>
      <Grid
        ref={grid}
        renderOrder={-2}
        position={[0, 0, 0]}
        args={[320, 320]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#0f2a3e"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#16506a"
        fadeDistance={150}
        fadeStrength={1.4}
        infiniteGrid
      />
      {rings.map(({ radius, points }) => (
        <Line
          key={radius}
          points={points}
          color="#22d3ee"
          lineWidth={radius === RADAR_RANGE_KM ? 1.6 : 1}
          transparent
          depthWrite={false}
          opacity={radius === RADAR_RANGE_KM ? 0.55 : 0.25}
        />
      ))}
    </group>
  );
}
