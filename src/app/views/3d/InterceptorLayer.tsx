import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
  type PerspectiveCamera,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DEFAULT_INTERCEPTOR, TICK_S, type Vec3 } from '../../../sim';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { toScene, worldSizeForPixels } from './coords';
import { interpolatedInterceptors, useInterceptorIds } from './frame';
import { Polyline } from './polyline';

const MODEL_PX = 20;
const AIM_PX = 14;
/** The simulation keeps 60 trail samples (6 s); one more point joins the trail to the model. */
const TRAIL_SAMPLES = 60;
const TRAIL_WIDTH_PX = 2.5;
const CYAN = new Color('#22d3ee');
/** Models point their nose along -z. */
const NOSE = new Vector3(0, 0, -1);

let geometry: BufferGeometry | null = null;
let material: MeshStandardMaterial | null = null;

/** A slim body with a pointed nose, about one unit long, nose toward -z. */
function interceptorGeometry(): BufferGeometry {
  if (!geometry) {
    const body = new CylinderGeometry(0.06, 0.06, 0.75, 12);
    body.rotateX(Math.PI / 2);
    body.translate(0, 0, 0.1);
    const nose = new ConeGeometry(0.06, 0.25, 12);
    nose.rotateX(-Math.PI / 2);
    nose.translate(0, 0, -0.4);
    const fins = new CylinderGeometry(0.16, 0.16, 0.02, 4);
    fins.rotateX(Math.PI / 2);
    fins.translate(0, 0, 0.42);
    geometry = mergeGeometries([body, nose, fins].map((part) => part.toNonIndexed()));
    geometry?.computeVertexNormals();
  }
  if (!geometry) throw new Error('Could not build the interceptor model');
  return geometry;
}

function interceptorMaterial(): MeshStandardMaterial {
  material ??= new MeshStandardMaterial({
    color: '#e6fdff',
    emissive: '#22d3ee',
    emissiveIntensity: 0.6,
    metalness: 0.2,
    roughness: 0.4,
  });
  return material;
}

/** Interceptors in flight, from the launcher to the intercept. */
export function InterceptorLayer() {
  const ids = useInterceptorIds();
  return (
    <group>
      {ids.map((id) => (
        <InterceptorMarker key={id} id={id} />
      ))}
    </group>
  );
}

const scratch = new Vector3();

/**
 * One interceptor: its model along its velocity at a fixed on-screen size, a glow while the
 * motor burns, a fading trail of the last 6 s, and a cross where it was told to meet the
 * target (the predicted intercept point).
 */
const InterceptorMarker = memo(function InterceptorMarker({ id }: { id: number }) {
  const controller = useSimController();
  const [trail] = useState(() => new Polyline(TRAIL_SAMPLES + 1, TRAIL_WIDTH_PX));
  useEffect(() => () => trail.dispose(), [trail]);
  const direction = useMemo(() => new Vector3(), []);

  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const glow = useRef<Mesh>(null);
  const aim = useRef<Group>(null);

  useFrame(({ camera, size }) => {
    const frame = controller.getFrame();
    const entry = interpolatedInterceptors(frame).get(id);
    const group = root.current;
    if (!group) return;
    group.visible = entry !== undefined;
    if (!entry) return;

    const { heightScale } = useViewStore.getState();
    const [x, y, z] = toScene(entry.position, heightScale);
    group.position.set(x, y, z);
    const { velocity, launchTick, engagementId } = entry.interceptor;
    direction.set(velocity.x, velocity.z * heightScale, -velocity.y).normalize();

    const { fov, zoom } = camera as PerspectiveCamera;
    const distance = camera.position.distanceTo(group.position);
    if (body.current) {
      body.current.quaternion.setFromUnitVectors(NOSE, direction);
      body.current.scale.setScalar(worldSizeForPixels(distance, fov, size.height, MODEL_PX, zoom));
    }
    const flightS = (frame.current.tick - launchTick) * TICK_S;
    if (glow.current) glow.current.visible = flightS < DEFAULT_INTERCEPTOR.boostS;

    writeTrail(trail, entry.interceptor.trail, [x, y, z], heightScale);
    trail.end(size.width, size.height);

    const engagement = frame.current.engagements.find((e) => e.id === engagementId);
    if (aim.current) {
      aim.current.visible = engagement !== undefined;
      if (engagement) {
        const [ax, ay, az] = toScene(engagement.predictedPoint, heightScale);
        aim.current.position.set(ax - x, ay - y, az - z);
        const aimDistance = camera.position.distanceTo(scratch.set(ax, ay, az));
        aim.current.scale.setScalar(
          worldSizeForPixels(aimDistance, fov, size.height, AIM_PX, zoom),
        );
      }
    }
  }, -1);

  return (
    <group ref={root} visible={false}>
      <primitive object={trail.object} />
      <group ref={body}>
        <mesh geometry={interceptorGeometry()} material={interceptorMaterial()} dispose={null} />
        {/* The rocket motor's glow, behind the tail. */}
        <mesh ref={glow} position={[0, 0, 0.62]}>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshBasicMaterial
            color="#fde68a"
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={aim} visible={false}>
        <Billboard>
          {[Math.PI / 4, -Math.PI / 4].map((angle) => (
            <mesh key={angle} rotation-z={angle} renderOrder={3}>
              <planeGeometry args={[1, 0.14]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} depthTest={false} />
            </mesh>
          ))}
        </Billboard>
      </group>
    </group>
  );
});

/** The last 6 s of the interceptor's path, fading with age, relative to the model. */
function writeTrail(
  trail: Polyline,
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
    const age = (count - i) / TRAIL_SAMPLES;
    trail.push(x - hx, y - hy, z - hz, CYAN, 0.95 * (1 - age));
  }
}
