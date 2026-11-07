import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group, PerspectiveCamera } from 'three';
import { DEFAULT_ASSETS, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR, envelopeRangeM } from '../../../sim';
import { useViewStore } from '../../view/viewStore';
import { SCENE_UNITS_PER_M, worldSizeForPixels } from './coords';
import { groundSceneY } from './terrainGeometry';

/** On-screen size of an asset marker, pixels. */
const ASSET_PX = 26;
const DRAPE_LIFT_M = 25;

/** A circle around a ground point that follows the terrain, in scene units. */
function drapedCircle(eastM: number, northM: number, radiusM: number, heightScale: number) {
  const segments = 72;
  return Array.from({ length: segments + 1 }, (_, i): [number, number, number] => {
    const angle = (i / segments) * 2 * Math.PI;
    const x = eastM + radiusM * Math.sin(angle);
    const y = northM + radiusM * Math.cos(angle);
    return [
      x * SCENE_UNITS_PER_M,
      groundSceneY(x, y, heightScale) + DRAPE_LIFT_M * SCENE_UNITS_PER_M * heightScale,
      -y * SCENE_UNITS_PER_M,
    ];
  });
}

/**
 * What the battery defends: each asset's threat ring on the ground (a course passing inside it
 * is a threat), and a small marker for the town and the power plant (the battery has its own).
 */
export function AssetLayer() {
  const heightScale = useViewStore((state) => state.heightScale);
  const rings = useMemo(
    () =>
      DEFAULT_ASSETS.map((asset) => ({
        asset,
        points: drapedCircle(asset.position.x, asset.position.y, asset.threatRadiusM, heightScale),
      })),
    [heightScale],
  );
  return (
    <group>
      {rings.map(({ asset, points }) => (
        <Line
          key={asset.id}
          points={points}
          color="#fbbf24"
          lineWidth={1.4}
          dashed
          dashSize={0.4}
          gapSize={0.35}
          transparent
          depthWrite={false}
          depthTest={false}
          renderOrder={1}
          opacity={0.6}
        />
      ))}
      {DEFAULT_ASSETS.filter((asset) => asset.id !== 0).map((asset) => (
        <AssetMarker key={asset.id} eastM={asset.position.x} northM={asset.position.y} />
      ))}
    </group>
  );
}

/** A few blocks, like buildings, at a constant on-screen size. */
function AssetMarker({ eastM, northM }: { eastM: number; northM: number }) {
  const heightScale = useViewStore((state) => state.heightScale);
  const group = useRef<Group>(null);
  const position: [number, number, number] = [
    eastM * SCENE_UNITS_PER_M,
    groundSceneY(eastM, northM, heightScale),
    -northM * SCENE_UNITS_PER_M,
  ];
  useFrame(({ camera, size }) => {
    if (!group.current) return;
    const { fov, zoom } = camera as PerspectiveCamera;
    const distance = camera.position.distanceTo(group.current.position);
    group.current.scale.setScalar(worldSizeForPixels(distance, fov, size.height, ASSET_PX, zoom));
  });
  return (
    <group ref={group} position={position}>
      {[
        [-0.25, 0.3, 0, 0.6],
        [0.2, 0.22, 0.15, 0.44],
        [0.05, 0.15, -0.3, 0.3],
      ].map(([x, w, z, h], i) => (
        <mesh key={i} position={[x ?? 0, (h ?? 0) / 2, z ?? 0]}>
          <boxGeometry args={[w ?? 0, h ?? 0, w ?? 0]} />
          <meshStandardMaterial color="#fde68a" emissive="#b45309" emissiveIntensity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * The engagement envelope: for each target altitude, the farthest ground range the planner
 * accepts (reach within the longest planned flight, with drag and margin). Drawn as a dome of
 * meridians and rings, slightly wider high up where the air is thinner.
 */
export function EnvelopeLayer() {
  const show = useViewStore((state) => state.showEnvelope);
  const heightScale = useViewStore((state) => state.heightScale);
  const { meridians, rings } = useMemo(() => {
    const altitudes: number[] = [];
    for (let h = 0; ; h += 250) {
      const r = envelopeRangeM(h, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
      altitudes.push(h);
      if (r <= 0) break;
    }
    const profile = altitudes.map((h) => ({
      h,
      r: envelopeRangeM(h, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR),
    }));
    const toScene = (r: number, h: number, bearing: number): [number, number, number] => [
      r * Math.sin(bearing) * SCENE_UNITS_PER_M,
      h * SCENE_UNITS_PER_M * heightScale,
      -r * Math.cos(bearing) * SCENE_UNITS_PER_M,
    ];
    const meridians = Array.from({ length: 12 }, (_, i) => {
      const bearing = (i / 12) * 2 * Math.PI;
      return profile.map(({ h, r }) => toScene(r, h, bearing));
    });
    const rings = [0, 3_000, 6_000, 10_000, 15_000].flatMap((h) => {
      const r = envelopeRangeM(h, DEFAULT_DEFENSE, DEFAULT_INTERCEPTOR);
      if (r <= 0) return [];
      return [Array.from({ length: 97 }, (_, i) => toScene(r, h, (i / 96) * 2 * Math.PI))];
    });
    return { meridians, rings };
  }, [heightScale]);
  if (!show) return null;
  return (
    <group>
      {[...meridians, ...rings].map((points, i) => (
        <Line
          key={i}
          points={points}
          color="#22d3ee"
          lineWidth={1}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      ))}
    </group>
  );
}
