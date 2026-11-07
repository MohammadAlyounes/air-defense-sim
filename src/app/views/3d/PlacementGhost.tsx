import { Line } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  MeshBasicMaterial,
  Raycaster,
  Vector2,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from 'three';
import { TRAFFIC, type TrafficTypeId } from '../../../sim';
import { headingToBattery } from '../../placement/placement';
import { registerDropZone, usePlacementStore } from '../../placement/placementStore';
import { useViewStore } from '../../view/viewStore';
import { AFFILIATION_COLOR, aircraftGeometry } from './aircraftModels';
import { worldTerrain } from '../../world/world';
import { toScene, worldSizeForPixels, yawForHeading } from './coords';
import { groundSceneY, rayTerrainHit } from './terrainGeometry';

const GHOST_PX = 30;
const RIPPLE_MS = 1_200;
const INVALID_COLOR = '#8fa0bf';

/** Height of the ghost above the datum, m: what the simulation will fly it at. */
function ghostAltitudeM(type: TrafficTypeId, eastM: number, northM: number, altitudeM: number) {
  const ground = worldTerrain().heightAt(eastM, northM);
  return TRAFFIC[type].altitudeRef === 'AGL'
    ? ground + altitudeM
    : Math.max(altitudeM, ground + 150);
}

/** Lets traffic be dropped onto the 3D terrain: a ray from the camera through the pointer. */
export function PlacementZone() {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    return registerDropZone('battlespace', (clientX, clientY) => {
      const box = canvas.getBoundingClientRect();
      pointer.set(
        ((clientX - box.left) / box.width) * 2 - 1,
        -((clientY - box.top) / box.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = rayTerrainHit(raycaster.ray, useViewStore.getState().heightScale);
      if (!hit) return null;
      // Scene kilometres back to the simulation's metres east and north.
      return { eastM: hit.x * 1000, northM: -hit.z * 1000 };
    });
  }, [camera, canvas]);
  return null;
}

/**
 * The traffic being placed, seen in 3D: a see-through model at its altitude, its route
 * straight to the battery and a line down to the ground. After a drop, a ripple marks the spot.
 */
export function PlacementGhost() {
  const type = usePlacementStore((s) => s.type);
  const target = usePlacementStore((s) => s.target);
  const altitudeM = usePlacementStore((s) => s.altitudeM);
  const heightScale = useViewStore((s) => s.heightScale);
  const invalidate = useThree((state) => state.invalidate);
  const model = useRef<Group>(null);
  const ripple = useRef<Mesh>(null);

  const color =
    type && target?.valid ? AFFILIATION_COLOR[TRAFFIC[type].affiliation] : INVALID_COLOR;
  const material = useMemo(
    () => new MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false }),
    [color],
  );
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ camera, size }) => {
    const { fov, zoom } = camera as PerspectiveCamera;
    if (model.current?.parent) {
      const distance = camera.position.distanceTo(model.current.parent.position);
      model.current.scale.setScalar(worldSizeForPixels(distance, fov, size.height, GHOST_PX, zoom));
    }
    const { lastDrop } = usePlacementStore.getState();
    const mesh = ripple.current;
    if (!mesh) return;
    const progress = lastDrop ? (performance.now() - lastDrop.atMs) / RIPPLE_MS : 1;
    mesh.visible = lastDrop !== null && progress < 1;
    if (!lastDrop || progress >= 1) return;
    const groundY = groundSceneY(
      lastDrop.at.eastM,
      lastDrop.at.northM,
      useViewStore.getState().heightScale,
    );
    mesh.position.set(lastDrop.at.eastM / 1000, groundY + 0.02, -lastDrop.at.northM / 1000);
    const distance = camera.position.distanceTo(mesh.position);
    mesh.scale.setScalar(
      worldSizeForPixels(distance, fov, size.height, 12 + 60 * progress, zoom) / 2,
    );
    (mesh.material as MeshBasicMaterial).opacity = 0.9 * (1 - progress);
    invalidate(); // keep the ripple moving even while paused
  });

  const at = target?.at;
  const position =
    at && type
      ? toScene(
          { x: at.eastM, y: at.northM, z: ghostAltitudeM(type, at.eastM, at.northM, altitudeM) },
          heightScale,
        )
      : null;
  const dropTo = at && position ? groundSceneY(at.eastM, at.northM, heightScale) - position[1] : 0;

  return (
    <group>
      {type && position && at && (
        <group position={position}>
          <group ref={model} rotation-y={yawForHeading(headingToBattery(at))}>
            <mesh
              geometry={aircraftGeometry(type === 'swarm' ? 'drone' : type)}
              material={material}
              dispose={null}
            />
          </group>
          <Line
            points={[
              [0, 0, 0],
              [-position[0], 0, -position[2]],
            ]}
            color={color}
            lineWidth={1.6}
            dashed
            dashSize={0.6}
            gapSize={0.45}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
          <Line
            points={[
              [0, 0, 0],
              [0, dropTo, 0],
            ]}
            color={color}
            lineWidth={1.2}
            transparent
            opacity={0.5}
            depthWrite={false}
          />
        </group>
      )}
      <mesh ref={ripple} rotation-x={-Math.PI / 2} visible={false} renderOrder={5}>
        <ringGeometry args={[0.85, 1, 48]} />
        <meshBasicMaterial color="#22d3ee" transparent depthWrite={false} depthTest={false} />
      </mesh>
    </group>
  );
}
