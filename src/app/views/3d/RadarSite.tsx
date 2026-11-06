import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  type Group,
  type PerspectiveCamera,
  type ShaderMaterial,
} from 'three';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { interpolateAzimuth } from '../scopeRenderer';
import { worldSizeForPixels, yawForHeading } from './coords';
import { RADAR_RANGE_KM as RANGE_KM } from './sceneConstants';

/** Top of the search beam's vertical fan, for drawing (a generic 20° elevation coverage). */
const BEAM_TOP_KM = RANGE_KM * Math.tan((20 * Math.PI) / 180);
const ACCENT = new Color('#22d3ee');
const SITE_PX = 34;

/** The vertical fan of the search beam, pointing north before rotation; fades with range and height. */
const BEAM_POSITIONS = new Float32Array([0, 0, 0, 0, 0, -RANGE_KM, 0, BEAM_TOP_KM, -RANGE_KM]);
const BEAM_COLORS = new Float32Array([
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0.22],
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0.07],
  ...[ACCENT.r, ACCENT.g, ACCENT.b, 0],
]);

/** Glowing trail on the ground behind the beam, the same sweep as on the radar scope. */
const SWEEP_VERTEX = /* glsl */ `
  varying vec2 vGround;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vGround = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const SWEEP_FRAGMENT = /* glsl */ `
  uniform float uAzimuth;
  uniform float uTrail;
  uniform float uRange;
  uniform vec3 uColor;
  varying vec2 vGround;
  const float TWO_PI = 6.28318530718;
  void main() {
    // Compass bearing of this point: east is +x, north is -z.
    float bearing = atan(vGround.x, -vGround.y);
    if (bearing < 0.0) bearing += TWO_PI;
    float behind = mod(uAzimuth - bearing + TWO_PI, TWO_PI);
    float glow = behind < uTrail ? 1.0 - behind / uTrail : 0.0;
    glow *= smoothstep(uRange, uRange - 1.5, length(vGround));
    gl_FragColor = vec4(uColor, glow * 0.22);
  }
`;

/** The battery at the centre: radar site, rotating antenna and its sweeping beam. */
export function RadarSite() {
  const controller = useSimController();
  const heightScale = useViewStore((state) => state.heightScale);
  const site = useRef<Group>(null);
  const antenna = useRef<Group>(null);
  const beam = useRef<Group>(null);
  const sweep = useRef<ShaderMaterial>(null);
  const sweepUniforms = useMemo(
    () => ({
      uAzimuth: { value: 0 },
      uTrail: { value: 0.9 },
      uRange: { value: RANGE_KM },
      uColor: { value: ACCENT },
    }),
    [],
  );

  useFrame(({ camera, size }) => {
    const { previous, current, alpha } = controller.getFrame();
    const azimuth = interpolateAzimuth(previous.radar.azimuthRad, current.radar.azimuthRad, alpha);
    const yaw = yawForHeading(azimuth);
    if (antenna.current) antenna.current.rotation.y = yaw;
    if (beam.current) beam.current.rotation.y = yaw;
    const uniform = sweep.current?.uniforms.uAzimuth;
    if (uniform) uniform.value = azimuth;
    if (site.current) {
      const { fov, zoom } = camera as PerspectiveCamera;
      const distance = camera.position.length();
      site.current.scale.setScalar(worldSizeForPixels(distance, fov, size.height, SITE_PX, zoom));
    }
  });

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position-y={0.006} renderOrder={-1}>
        <circleGeometry args={[RANGE_KM, 160]} />
        <shaderMaterial
          ref={sweep}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          uniforms={sweepUniforms}
          vertexShader={SWEEP_VERTEX}
          fragmentShader={SWEEP_FRAGMENT}
        />
      </mesh>
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
      </group>
    </group>
  );
}
