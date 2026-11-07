import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial, PerspectiveCamera } from 'three';
import { TICK_S, type Effect } from '../../../sim';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { toScene, worldSizeForPixels } from './coords';

/** Enough rings for a busy moment; older effects simply wait their turn. */
const POOL = 16;

/**
 * Each kind of moment gets a ring that grows and fades: deliberately abstract, never graphic
 * (see SAFETY.md). Sizes are on-screen pixels.
 */
const STYLE: Readonly<
  Record<Effect['kind'], { color: string; seconds: number; fromPx: number; toPx: number }>
> = {
  launch: { color: '#22d3ee', seconds: 0.8, fromPx: 6, toPx: 36 },
  intercept: { color: '#f8fafc', seconds: 1.6, fromPx: 10, toPx: 96 },
  miss: { color: '#8fa0bf', seconds: 1.2, fromPx: 6, toPx: 40 },
  leak: { color: '#fb7185', seconds: 2.5, fromPx: 12, toPx: 80 },
};

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Launches, intercepts, misses and leaks, drawn from the simulation's recent effects. */
export function EffectsLayer() {
  const controller = useSimController();
  const anchors = useRef<(Group | null)[]>([]);
  const rings = useRef<(Mesh | null)[]>([]);

  useFrame(({ camera, size }) => {
    const { previous, current, alpha } = controller.getFrame();
    const timeS = previous.timeS + (current.timeS - previous.timeS) * alpha;
    const { heightScale } = useViewStore.getState();
    const { fov, zoom } = camera as PerspectiveCamera;
    let used = 0;
    for (const effect of current.effects) {
      const style = STYLE[effect.kind];
      const t = (timeS - effect.tick * TICK_S) / style.seconds;
      const anchor = anchors.current[used];
      const ring = rings.current[used];
      if (t < 0 || t > 1 || !anchor || !ring) continue;
      used += 1;
      anchor.visible = true;
      anchor.position.set(...toScene(effect.position, heightScale));
      const pixels = style.fromPx + (style.toPx - style.fromPx) * easeOut(t);
      const distance = camera.position.distanceTo(anchor.position);
      ring.scale.setScalar(worldSizeForPixels(distance, fov, size.height, pixels, zoom) / 2);
      const material = ring.material as MeshBasicMaterial;
      material.color.set(style.color);
      material.opacity = 0.9 * (1 - t);
    }
    for (let i = used; i < POOL; i++) {
      const anchor = anchors.current[i];
      if (anchor) anchor.visible = false;
    }
  });

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group
          key={i}
          visible={false}
          ref={(group) => {
            anchors.current[i] = group;
          }}
        >
          <Billboard>
            <mesh
              renderOrder={4}
              ref={(mesh) => {
                rings.current[i] = mesh;
              }}
            >
              <ringGeometry args={[0.82, 1, 48]} />
              <meshBasicMaterial transparent depthWrite={false} depthTest={false} />
            </mesh>
          </Billboard>
        </group>
      ))}
    </group>
  );
}
