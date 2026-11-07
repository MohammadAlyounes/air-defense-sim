import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  DataTexture,
  LinearFilter,
  RedFormat,
  UniformsLib,
  UniformsUtils,
  type BufferAttribute,
  type ShaderMaterial,
} from 'three';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { worldTerrain } from '../../world/world';
import { interpolateAzimuth } from '../scopeRenderer';
import { SCENE_UNITS_PER_M } from './coords';
import { RADAR_RANGE_KM } from './sceneConstants';
import { buildTerrainGeometry, fillCoverageTexture } from './terrainGeometry';

/** The terrain mesh covers this half-width around the battery, km. */
const HALF_KM = 50;
/** Grid cells per side: 500 m apart, 40,000 vertices. */
const SEGMENTS = 200;
/** The blind-zone texture covers the radar's range at this resolution per side. */
const COVERAGE_SIZE = 256;
const ACCENT = new Color('#22d3ee');
const BLIND = new Color('#fb923c');

const VERTEX = /* glsl */ `
  attribute float aHeight;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec2 vGround;
  #include <fog_pars_vertex>
  void main() {
    vHeight = aHeight;
    vNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vGround = world.xz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

/**
 * Relief shading lit from the north-west, contour lines every 100 m, a faint 10 km grid, the
 * radar's sweep glowing on the ground behind the beam, and (when switched on) the blind zones
 * tinted orange.
 */
const FRAGMENT = /* glsl */ `
  uniform float uAzimuth;
  uniform float uTrail;
  uniform float uRange;
  uniform float uMaxHeight;
  uniform vec3 uAccent;
  uniform vec3 uBlind;
  uniform sampler2D uCoverage;
  uniform float uCoverageOn;
  uniform float uCoverageHalf;
  varying float vHeight;
  varying vec3 vNormal;
  varying vec2 vGround;
  #include <fog_pars_fragment>
  const float TWO_PI = 6.28318530718;
  void main() {
    vec3 n = normalize(vNormal);
    float light = clamp(dot(n, normalize(vec3(-0.5, 0.8, -0.45))), 0.0, 1.0);
    float t = clamp(vHeight / uMaxHeight, 0.0, 1.0);
    vec3 base = mix(vec3(0.030, 0.066, 0.118), vec3(0.105, 0.205, 0.215), t);
    vec3 color = base * (0.55 + 0.7 * light);

    float c = vHeight / 100.0;
    float w = max(fwidth(c), 1e-4);
    float f = fract(c);
    float contour = 1.0 - smoothstep(0.0, 1.2 * w, min(f, 1.0 - f));
    color += vec3(0.04, 0.14, 0.17) * contour * step(5.0, vHeight);

    vec2 g = vGround / 10.0;
    vec2 gw = max(fwidth(g), vec2(1e-4));
    vec2 gl = abs(fract(g - 0.5) - 0.5) / gw;
    float grid = 1.0 - min(min(gl.x, gl.y), 1.0);
    color += vec3(0.03, 0.12, 0.16) * grid * 0.7;

    float r = length(vGround);
    float bearing = atan(vGround.x, -vGround.y);
    if (bearing < 0.0) bearing += TWO_PI;
    float behind = mod(uAzimuth - bearing + TWO_PI, TWO_PI);
    float glow = behind < uTrail ? 1.0 - behind / uTrail : 0.0;
    glow *= smoothstep(uRange, uRange - 1.5, r);
    color += uAccent * glow * 0.2;

    if (uCoverageOn > 0.5 && r < uRange) {
      vec2 uv = vec2(vGround.x, -vGround.y) / (2.0 * uCoverageHalf) + 0.5;
      float blind = texture2D(uCoverage, uv).r;
      color = mix(color, uBlind, blind * 0.3);
    }
    gl_FragColor = vec4(color, 1.0);
    #include <fog_fragment>
  }
`;

/**
 * The fictional landscape in 3D. Heights follow the view's height stretch; the shading,
 * contours, sweep and blind zones are all drawn by one shader.
 */
export function TerrainLayer() {
  const controller = useSimController();
  const heightScale = useViewStore((state) => state.heightScale);
  const coverageAltM = useViewStore((state) => state.coverageAltM);
  const material = useRef<ShaderMaterial>(null);
  const geometry = useMemo(() => buildTerrainGeometry(SEGMENTS, HALF_KM), []);
  const texture = useMemo(() => {
    const t = new DataTexture(
      new Uint8Array(COVERAGE_SIZE * COVERAGE_SIZE),
      COVERAGE_SIZE,
      COVERAGE_SIZE,
      RedFormat,
    );
    t.magFilter = LinearFilter;
    t.minFilter = LinearFilter;
    return t;
  }, []);
  const uniforms = useMemo(() => {
    const merged = UniformsUtils.merge([
      UniformsLib.fog,
      {
        uAzimuth: { value: 0 },
        uTrail: { value: 0.9 },
        uRange: { value: RADAR_RANGE_KM },
        uMaxHeight: { value: Math.max(1, worldTerrain().maxHeightM) },
        uAccent: { value: ACCENT },
        uBlind: { value: BLIND },
        uCoverageOn: { value: 0 },
        uCoverageHalf: { value: RADAR_RANGE_KM },
      },
    ]);
    // Added after the merge, which would otherwise copy the texture.
    merged.uCoverage = { value: texture };
    return merged;
  }, [texture]);

  // Stretch the heights in place, then recompute the normals for the shading.
  useEffect(() => {
    const positions = geometry.getAttribute('position') as BufferAttribute;
    const heights = geometry.getAttribute('aHeight') as BufferAttribute;
    for (let i = 0; i < heights.count; i++) {
      positions.setY(i, heights.getX(i) * SCENE_UNITS_PER_M * heightScale);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
  }, [geometry, heightScale]);

  useEffect(() => {
    if (coverageAltM !== null) fillCoverageTexture(texture, COVERAGE_SIZE, coverageAltM);
  }, [coverageAltM, texture]);

  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );

  useFrame(() => {
    const shader = material.current;
    if (!shader) return;
    const { previous, current, alpha } = controller.getFrame();
    const { uAzimuth, uCoverageOn } = shader.uniforms;
    if (uAzimuth) {
      uAzimuth.value = interpolateAzimuth(
        previous.radar.azimuthRad,
        current.radar.azimuthRad,
        alpha,
      );
    }
    if (uCoverageOn) uCoverageOn.value = useViewStore.getState().coverageAltM === null ? 0 : 1;
  });

  return (
    <mesh geometry={geometry} renderOrder={-3}>
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={VERTEX}
        fragmentShader={FRAGMENT}
        fog
      />
    </mesh>
  );
}
