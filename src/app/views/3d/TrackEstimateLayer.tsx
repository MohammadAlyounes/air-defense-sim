import { useFrame } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { Color, Vector3, type PerspectiveCamera } from 'three';
import { trackPositionAt, type Identity } from '../../../sim';
import { useSimController } from '../../sim/simContext';
import { useViewStore } from '../../view/viewStore';
import { IDENTITY_COLOR } from '../scopeRenderer';
import { toScene, worldSizeForPixels } from './coords';
import { interpolated } from './frame';
import { Polyline } from './polyline';

/** Points for up to 40 tracks: a 16-sided ring and an error line each, with breaks between. */
const RING_SIDES = 16;
const POINTS_PER_TRACK = RING_SIDES + 1 + 6;
const MAX_POINTS = 40 * POINTS_PER_TRACK;
/** On-screen radius of a track's ring, pixels. */
const RING_PX = 9;

const COLORS = Object.fromEntries(
  Object.entries(IDENTITY_COLOR).map(([identity, hex]) => [identity, new Color(hex)]),
) as Record<Identity, Color>;
const ERROR_COLOR = new Color('#cbd5e1');

/**
 * Truth vs. perception in 3D: while the comparison is on, every track the battery holds is
 * drawn as a ring in its identity colour where the tracker believes the aircraft is, joined by
 * a thin line to where it really is. Everything else in this view is ground truth.
 */
export function TrackEstimateLayer() {
  const controller = useSimController();
  const [line] = useState(() => new Polyline(MAX_POINTS, 1.6));
  useEffect(() => () => line.dispose(), [line]);

  useFrame(({ camera, size }) => {
    const { compareTruth, heightScale } = useViewStore.getState();
    line.begin();
    if (compareTruth) {
      const frame = controller.getFrame();
      const { previous, current, alpha } = frame;
      const tick = previous.tick + (current.tick - previous.tick) * alpha;
      const truth = interpolated(frame).byId;
      const { fov, zoom } = camera as PerspectiveCamera;
      const centre = new Vector3();
      let last: [number, number, number] | null = null;
      /** Starts a new piece: invisible segments hide the jump from the previous one. */
      const jump = (to: [number, number, number], color: Color) => {
        if (last) line.push(last[0], last[1], last[2], color, 0);
        line.push(to[0], to[1], to[2], color, 0);
      };
      for (const track of current.tracks) {
        const [x, y, z] = toScene(trackPositionAt(track, tick), heightScale);
        const color = COLORS[track.identity];
        const r = worldSizeForPixels(
          camera.position.distanceTo(centre.set(x, y, z)),
          fov,
          size.height,
          RING_PX,
          zoom,
        );
        jump([x + r, y, z], color);
        for (let i = 0; i <= RING_SIDES; i++) {
          const angle = (i / RING_SIDES) * 2 * Math.PI;
          line.push(x + r * Math.cos(angle), y, z + r * Math.sin(angle), color, 0.9);
        }
        last = [x + r, y, z];
        const real = track.truthId === null ? undefined : truth.get(track.truthId);
        if (!real) continue;
        const [tx, ty, tz] = toScene(real.position, heightScale);
        jump([x, y, z], ERROR_COLOR);
        line.push(x, y, z, ERROR_COLOR, 0.7);
        line.push(tx, ty, tz, ERROR_COLOR, 0.7);
        last = [tx, ty, tz];
      }
    }
    line.end(size.width, size.height);
  });

  return <primitive object={line.object} />;
}
