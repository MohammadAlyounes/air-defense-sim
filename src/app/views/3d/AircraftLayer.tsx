import { Billboard, useCursor } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Color, Vector3, type Group, type Mesh, type PerspectiveCamera } from 'three';
import type { AircraftType, Vec3 } from '../../../sim';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { AFFILIATION_COLOR, aircraftGeometry, aircraftMaterial } from './aircraftModels';
import { headingOf, toScene, worldSizeForPixels, yawForHeading } from './coords';
import { interpolated, useAircraftRoster, type RosterEntry } from './frame';
import { Polyline } from './polyline';

/** On-screen size of each model, in pixels: bigger aircraft look a little bigger. */
const MODEL_PX: Readonly<Record<AircraftType, number>> = {
  drone: 24,
  cruise: 26,
  jet: 30,
  friendly: 30,
  airliner: 36,
};
const SELECTED_GROWTH = 1.25;
const FOOT_PX = 9;

/** The simulation keeps 60 trail samples (30 s); one more point joins the trail to the model. */
const TRAIL_SAMPLES = 60;
const TRAIL_POINTS = TRAIL_SAMPLES + 1;
const TRAIL_WIDTH_PX = 2;
const TRAIL_BRIGHTNESS = 0.95;
const DROP_WIDTH_PX = 1.25;

/** Every aircraft in the sky, drawn from ground truth. */
export function AircraftLayer() {
  const roster = useAircraftRoster();
  return (
    <group>
      {roster.map(({ key, id, type, affiliation }) => (
        <AircraftMarker key={key} id={id} type={type} affiliation={affiliation} />
      ))}
    </group>
  );
}

const scratch = new Vector3();

/**
 * One aircraft: the model at a fixed on-screen size, a drop line to the ground and a fading
 * trail of the last 30 s (its name tag lives in the label layer). The frame callback moves the
 * parts directly, with no React re-render per frame.
 */
const AircraftMarker = memo(function AircraftMarker({
  id,
  type,
  affiliation,
}: Omit<RosterEntry, 'key'>) {
  const controller = useSimController();
  const selected = useViewStore((state) => state.selectedId === id);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  const color = AFFILIATION_COLOR[affiliation];
  const lineColor = useMemo(() => new Color(color), [color]);
  const [lines] = useState(() => ({
    trail: new Polyline(TRAIL_POINTS, TRAIL_WIDTH_PX),
    drop: new Polyline(2, DROP_WIDTH_PX),
  }));
  useEffect(
    () => () => {
      lines.trail.dispose();
      lines.drop.dispose();
    },
    [lines],
  );

  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const yaw = useRef<Group>(null);
  const foot = useRef<Mesh>(null);

  // Priority -1: after the camera has moved (-2), so sizes use this frame's distances.
  useFrame(({ camera, size }) => {
    const entry = interpolated(controller.getFrame()).byId.get(id);
    const group = root.current;
    if (!group) return;
    group.visible = entry !== undefined;
    if (!entry) return;

    const { heightScale } = useViewStore.getState();
    const [x, y, z] = toScene(entry.position, heightScale);
    group.position.set(x, y, z);
    if (yaw.current) yaw.current.rotation.y = yawForHeading(headingOf(entry.aircraft.velocity));

    const { fov, zoom } = camera as PerspectiveCamera;
    const pixels = MODEL_PX[type] * (selected ? SELECTED_GROWTH : 1);
    const distance = camera.position.distanceTo(group.position);
    body.current?.scale.setScalar(worldSizeForPixels(distance, fov, size.height, pixels, zoom));
    if (foot.current) {
      foot.current.position.y = -y + 0.002;
      const footDistance = camera.position.distanceTo(scratch.set(x, 0, z));
      foot.current.scale.setScalar(
        worldSizeForPixels(footDistance, fov, size.height, FOOT_PX, zoom),
      );
    }

    // Lines are drawn in the marker's own frame, so they move with it.
    const { drop, trail } = lines;
    const dropBrightness = selected ? 0.6 : 0.35;
    drop.begin();
    drop.push(0, -y, 0, lineColor, dropBrightness);
    drop.push(0, 0, 0, lineColor, dropBrightness);
    drop.end(size.width, size.height);
    writeTrail(trail, lineColor, entry.aircraft.trail, [x, y, z], heightScale);
    trail.end(size.width, size.height);
  }, -1);

  const choose = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    useViewStore.getState().select(id);
  };

  return (
    <group ref={root} visible={false}>
      <primitive object={lines.drop.object} />
      <primitive object={lines.trail.object} />
      <mesh ref={foot} rotation-x={-Math.PI / 2} renderOrder={1}>
        <ringGeometry args={[0.32, 0.5, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={selected ? 0.9 : 0.55}
          depthWrite={false}
        />
      </mesh>
      <group ref={body}>
        <group ref={yaw}>
          <mesh
            geometry={aircraftGeometry(type)}
            material={aircraftMaterial(affiliation, selected || hovered)}
            dispose={null}
          />
        </group>
        {/* A larger invisible target, so small aircraft are easy to click. */}
        <mesh
          visible={false}
          onClick={choose}
          onPointerOver={(event) => {
            event.stopPropagation();
            setHovered(true);
          }}
          onPointerOut={() => setHovered(false)}
        >
          <sphereGeometry args={[0.85, 12, 8]} />
        </mesh>
        {selected && (
          <Billboard>
            <mesh renderOrder={2}>
              <ringGeometry args={[0.78, 0.86, 48]} />
              <meshBasicMaterial color="#e4eaf5" transparent opacity={0.9} depthTest={false} />
            </mesh>
          </Billboard>
        )}
      </group>
    </group>
  );
});

/**
 * The fading trail: the last 30 s of positions, oldest first, then the live position. Each
 * point fades with its age, so the trail shows direction and speed at a glance.
 */
function writeTrail(
  trail: Polyline,
  color: Color,
  samples: readonly Vec3[],
  head: readonly [number, number, number],
  heightScale: number,
): void {
  const count = Math.min(samples.length, TRAIL_SAMPLES);
  const first = samples.length - count;
  const [hx, hy, hz] = head;
  trail.begin();
  for (let i = 0; i <= count; i++) {
    const sample = i < count ? samples[first + i] : undefined;
    const [x, y, z] = sample ? toScene(sample, heightScale) : head;
    // Points from the end: 0 for the live position, 60 for a sample taken 30 s ago.
    const age = (count - i) / TRAIL_SAMPLES;
    trail.push(x - hx, y - hy, z - hz, color, TRAIL_BRIGHTNESS * (1 - age));
  }
}
