import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { AdditiveBlending, Color, DoubleSide, type Group, type PerspectiveCamera } from 'three';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { interpolateAzimuth } from '../scopeRenderer';
import { worldSizeForPixels, yawForHeading } from './coords';
import { RADAR_RANGE_KM as RANGE_KM } from './sceneConstants';

/** Top of the search beam's vertical fan, for drawing (a generic 20° elevation coverage). */
const BEAM_TOP_KM = RANGE_KM * Math.tan((20 * Math.PI) / 180);
const ACCENT = new Color('#22d3ee');
/** On-screen size of the site model (radar and launcher), pixels. */
const SITE_PX = 42;

/** The vertical fan of the search beam, pointing north before rotation; fades with range and height. */
const BEAM_POSITIONS = new Float32Array([0, 0, 0, 0, 0, -RANGE_KM, 0, BEAM_TOP_KM, -RANGE_KM]);
const BEAM_COLORS = new Float32Array([
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0.22],
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0.07],
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0],
]);

/**
 * The battery at the centre: radar site with its rotating antenna and sweeping beam, and the
 * launcher. The sweep's glow on the ground is drawn by the terrain shader.
 */
export function RadarSite() {
  const controller = useSimController();
  const heightScale = useViewStore((state) => state.heightScale);
  const site = useRef<Group>(null);
  const antenna = useRef<Group>(null);
  const beam = useRef<Group>(null);

  useFrame(({ camera, size }) => {
    const { previous, current, alpha } = controller.getFrame();
    const azimuth = interpolateAzimuth(previous.radar.azimuthRad, current.radar.azimuthRad, alpha);
    const yaw = yawForHeading(azimuth);
    if (antenna.current) antenna.current.rotation.y = yaw;
    if (beam.current) beam.current.rotation.y = yaw;
    if (site.current) {
      const { fov, zoom } = camera as PerspectiveCamera;
      const distance = camera.position.length();
      site.current.scale.setScalar(worldSizeForPixels(distance, fov, size.height, SITE_PX, zoom));
    }
  });

  return (
    <group>
      <group ref={beam} scale={[1, heightScale, 1]}>
        <mesh>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[BEAM_POSITIONS, 3]} />
            <bufferAttribute attach="attributes-color" args={[BEAM_COLORS, 4]} />
          </bufferGeometry>
          <meshBasicMaterial
            vertexColors
            transparent
            side={DoubleSide}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={site}>
        <mesh position-y={0.18}>
          <cylinderGeometry args={[0.22, 0.32, 0.36, 20]} />
          <meshStandardMaterial color="#16354a" emissive="#0e7490" emissiveIntensity={0.35} />
        </mesh>
        <group ref={antenna} position-y={0.42}>
          <mesh>
            <boxGeometry args={[0.7, 0.18, 0.06]} />
            <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={0.6} />
          </mesh>
        </group>
        <Launcher />
      </group>
    </group>
  );
}

/** A generic launcher next to the radar: a base and a rack of four canted tubes. */
function Launcher() {
  return (
    <group position={[0.62, 0, 0.32]} rotation-y={-0.5}>
      <mesh position-y={0.06}>
        <boxGeometry args={[0.34, 0.12, 0.44]} />
        <meshStandardMaterial color="#16354a" emissive="#0e7490" emissiveIntensity={0.25} />
      </mesh>
      <group position={[0, 0.2, 0.02]} rotation-x={0.6}>
        {[-0.065, 0.065].flatMap((x) =>
          [-0.06, 0.06].map((y) => (
            <mesh key={`${x}:${y}`} position={[x, y, 0]} rotation-x={Math.PI / 2}>
              <cylinderGeometry args={[0.05, 0.05, 0.46, 10]} />
              <meshStandardMaterial color="#cfe8f3" emissive="#22d3ee" emissiveIntensity={0.2} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}
