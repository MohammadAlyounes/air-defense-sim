import { Canvas, useFrame } from '@react-three/fiber';
import { Info } from 'lucide-react';
import { Tooltip } from '../../components/Tooltip';
import { useViewStore } from '../../view/viewStore';
import { WelcomeCard } from '../WelcomeCard';
import { AircraftLayer } from './AircraftLayer';
import { CameraRig } from './CameraRig';
import { AssetLayer, CorridorLayer, EnvelopeLayer } from './DefenseLayer';
import { EffectsLayer } from './EffectsLayer';
import { useRedrawOnChange } from './frame';
import { LabelLayer, LabelProjector } from './Labels';
import { RadarSite } from './RadarSite';
import { InterceptorLayer } from './InterceptorLayer';
import { PlacementGhost, PlacementZone } from './PlacementGhost';
import { GroundAndRings } from './Scene';
import { TrackEstimateLayer } from './TrackEstimateLayer';
import { ViewControls } from './ViewControls';

const BACKGROUND = '#060b16';

/**
 * The 3D battlespace: ground truth around the battery, kept in step with the radar scope.
 * Loaded on demand (three.js is large), and rendered only when something changes.
 */
export default function Battlespace3D() {
  return (
    <div className="absolute inset-0" data-testid="battlespace" data-drop-zone="battlespace">
      <div className="absolute inset-0">
        <Canvas
          frameloop="demand"
          flat
          dpr={[1, 2]}
          camera={{ fov: 45, near: 0.01, far: 1500, position: [-48, 34, 52] }}
          onPointerMissed={(event) => {
            if (event.type === 'click') useViewStore.getState().select(null);
          }}
        >
          <Scene />
        </Canvas>
      </div>
      <LabelLayer />
      <ViewControls />
      <BottomBar />
      <WelcomeCard />
    </div>
  );
}

function Scene() {
  useRedrawOnChange();
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <fog attach="fog" args={[BACKGROUND, 95, 260]} />
      <hemisphereLight args={['#d6e6ff', '#0a1322', 1.15]} />
      <directionalLight position={[40, 70, 25]} intensity={1.7} />
      <GroundAndRings />
      <AssetLayer />
      <CorridorLayer />
      <EnvelopeLayer />
      <RadarSite />
      <AircraftLayer />
      <TrackEstimateLayer />
      <InterceptorLayer />
      <EffectsLayer />
      <PlacementZone />
      <PlacementGhost />
      <CameraRig />
      <LabelProjector />
      <FirstFrameSignal />
    </>
  );
}

/** Marks the canvas once it has drawn, for browser tests and the media scripts. */
function FirstFrameSignal() {
  useFrame(({ gl }) => {
    gl.domElement.dataset.rendered = 'true';
  });
  return null;
}

const HINTS = {
  orbit: 'Drag to orbit · scroll to zoom · right-drag to pan · click an aircraft',
  top: 'North is up, like the radar scope · scroll to zoom · drag to tilt',
  follow: 'Following the selected aircraft · drag to look around · scroll to zoom',
  radar: 'Standing at the radar · drag to look around · scroll to zoom in',
} as const;

function BottomBar() {
  const cameraMode = useViewStore((state) => state.cameraMode);
  const compareTruth = useViewStore((state) => state.compareTruth);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-2">
      <p className="hidden rounded-md bg-ink-950/60 px-2 py-1 text-[11px] text-ink-300 backdrop-blur-sm md:block">
        {HINTS[cameraMode]}
      </p>
      <Tooltip
        side="top"
        content={
          <>
            <strong className="text-ink-100">Ground truth</strong>: this view shows where every
            aircraft really is, even behind hills. The radar scope shows only what the radar has
            seen: noisy echoes, the odd false alarm, nothing in the blind zones. Press T (or
            &ldquo;truth&rdquo; under the scope) to add the battery&rsquo;s tracks here, each joined
            to the real aircraft by its error.
          </>
        }
      >
        <span
          tabIndex={0}
          className="pointer-events-auto ml-auto flex cursor-help items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/85 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-200 backdrop-blur"
        >
          <Info aria-hidden="true" className="size-3 text-accent" />
          {compareTruth ? 'Truth + tracks' : 'Ground truth'}
        </span>
      </Tooltip>
    </div>
  );
}
