import { CameraControlsImpl } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Box3,
  MathUtils,
  Matrix4,
  Quaternion,
  Raycaster,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  Vector4,
  type PerspectiveCamera,
} from 'three';
import { useSimController } from '../../sim/simContext';
import { useViewStore, type CameraMode } from '../../view/viewStore';
import { headingOf, nearestAngle, toScene, yawForHeading } from './coords';
import { interpolated } from './frame';

CameraControlsImpl.install({
  THREE: {
    Box3,
    MathUtils: { clamp: MathUtils.clamp },
    Matrix4,
    Quaternion,
    Raycaster,
    Sphere,
    Spherical,
    Vector2,
    Vector3,
    Vector4,
  },
});

const { ACTION } = CameraControlsImpl;

/**
 * Where the default view looks from: south-west of the battery, about 25° above the ground
 * (steeper on tall, portrait screens, which would otherwise show mostly sky).
 */
const ORBIT_FROM = new Vector3(-0.6, 0.42, 0.68).normalize();
const ORBIT_FROM_PORTRAIT = new Vector3(-0.6, 0.78, 0.68).normalize();
const ORBIT_TARGET = new Vector3(0, 1.5, 0);
/** Half the width to keep in view in the top-down camera: the 40 km rings plus their labels. */
const TOP_HALF_SPAN_KM = 46;
const FOLLOW_DISTANCE_KM = 7;
/** 68° from straight up: a little above and behind the aircraft. */
const FOLLOW_POLAR = 1.19;
/** Behind and 35° to one side, so the trail and the drop line do not hide behind each other. */
const FOLLOW_SIDE_RAD = (35 * Math.PI) / 180;
/** How quickly the follow camera catches up with a newly chosen aircraft, seconds. */
const FOLLOW_SETTLE_S = 0.35;
/** The radar camera stands on a 40 m mast (stretched like every other height). */
const MAST_KM = 0.04;
const MAX_FRAME_S = 0.05;

/**
 * Camera presets for the 3D view. Every preset still lets you drag to look around; choosing
 * a preset again resets it. The controls run on demand: they request a new frame only while
 * the camera is moving.
 */
export function CameraRig() {
  const controller = useSimController();
  const camera = useThree((state) => state.camera) as PerspectiveCamera;
  const domElement = useThree(
    (state) => (state.events.connected as HTMLElement | undefined) || state.gl.domElement,
  );
  const invalidate = useThree((state) => state.invalidate);
  const size = useThree((state) => state.size);
  const cameraMode = useViewStore((state) => state.cameraMode);
  const cameraRequest = useViewStore((state) => state.cameraRequest);
  const selectedId = useViewStore((state) => state.selectedId);

  const controls = useMemo(() => {
    const instance = new CameraControlsImpl(camera);
    instance.smoothTime = 0.35;
    instance.minDistance = 0.4;
    instance.maxDistance = 260;
    // Keep the point the camera orbits over the area (and above ground), tall enough for an
    // airliner at four times its height.
    instance.setBoundary(new Box3(new Vector3(-90, 0, -90), new Vector3(90, 60, 90)));
    return instance;
  }, [camera]);

  useEffect(() => {
    controls.connect(domElement);
    return () => controls.disconnect();
  }, [controls, domElement]);

  useEffect(() => {
    const redraw = () => invalidate();
    const events = ['update', 'control', 'controlstart', 'transitionstart', 'wake'] as const;
    for (const name of events) controls.addEventListener(name, redraw);
    return () => {
      for (const name of events) controls.removeEventListener(name, redraw);
    };
  }, [controls, invalidate]);

  useEffect(() => () => controls.dispose(), [controls]);

  // The follow camera: tracks the aircraft's motion exactly and eases out the initial offset.
  const follow = useRef<{ target: Vector3; last: Vector3 } | null>(null);
  const aim = useMemo(() => new Vector3(), []);
  const step = useMemo(() => new Vector3(), []);

  const aspect = size.width / Math.max(1, size.height);
  const first = useRef(true);
  useEffect(() => {
    const animate = !first.current;
    first.current = false;
    follow.current = null;
    // The radar camera looks towards the selected aircraft, if there is one.
    const { selectedId: id, heightScale } = useViewStore.getState();
    const selected = id === null ? undefined : interpolated(controller.getFrame()).byId.get(id);
    const lookAt = selected ? new Vector3(...toScene(selected.position, heightScale)) : null;
    applyPreset(controls, cameraMode, camera, aspect, animate, lookAt);
    // Re-apply only when a camera is requested; aspect and selection are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls, cameraMode, cameraRequest]);

  // Choosing another aircraft while following flies to it.
  useEffect(() => {
    follow.current = null;
  }, [selectedId]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, MAX_FRAME_S);
    if (cameraMode === 'follow' && selectedId !== null) {
      const entry = interpolated(controller.getFrame()).byId.get(selectedId);
      if (entry) {
        aim.set(...toScene(entry.position, useViewStore.getState().heightScale));
        if (!follow.current) {
          follow.current = { target: controls.getTarget(new Vector3()), last: aim.clone() };
          const behind = yawForHeading(headingOf(entry.aircraft.velocity)) + FOLLOW_SIDE_RAD;
          void controls.rotateTo(nearestAngle(controls.azimuthAngle, behind), FOLLOW_POLAR, true);
          void controls.dollyTo(FOLLOW_DISTANCE_KM, true);
        }
        const { target, last } = follow.current;
        target.add(step.subVectors(aim, last)); // move with the aircraft...
        last.copy(aim);
        target.lerp(aim, 1 - Math.exp(-dt / FOLLOW_SETTLE_S)); // ...and close the gap
        void controls.moveTo(target.x, target.y, target.z, false);
      }
    }
    controls.update(dt);
  }, -2);

  return null;
}

function applyPreset(
  controls: CameraControlsImpl,
  mode: CameraMode,
  camera: PerspectiveCamera,
  aspect: number,
  animate: boolean,
  /** Scene position of the selected aircraft, if any. */
  lookAt: Vector3 | null,
): void {
  const radar = mode === 'radar';
  controls.dollyToCursor = mode === 'orbit' || mode === 'top';
  controls.mouseButtons.wheel = radar ? ACTION.ZOOM : ACTION.DOLLY;
  controls.mouseButtons.right = radar ? ACTION.NONE : ACTION.TRUCK;
  controls.mouseButtons.middle = radar ? ACTION.NONE : ACTION.DOLLY;
  controls.touches.two = radar ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY_TRUCK;
  controls.touches.three = radar ? ACTION.NONE : ACTION.TOUCH_TRUCK;
  controls.minZoom = 1;
  controls.maxZoom = radar ? 8 : 1;
  controls.minDistance = radar ? 0.02 : 0.4;
  controls.maxDistance = radar ? 0.02 : 260;
  // At the radar the camera may look 20° down and 70° up; elsewhere it stays above ground.
  controls.minPolarAngle = radar ? Math.PI / 2 - 0.35 : 0;
  controls.maxPolarAngle = radar ? Math.PI / 2 + 1.22 : Math.PI / 2 - 0.02;
  if (!radar) void controls.zoomTo(1, animate);

  const tanHalfFov = Math.tan(MathUtils.degToRad(camera.fov / 2));
  // Narrow (portrait) views need more distance to fit the width; phones crop the sides a little.
  const fit = Math.max(1, 1.15 / aspect);
  switch (mode) {
    case 'orbit': {
      const distance = 82 * fit;
      const from = (aspect < 1 ? ORBIT_FROM_PORTRAIT : ORBIT_FROM)
        .clone()
        .multiplyScalar(distance)
        .add(ORBIT_TARGET);
      void controls.setLookAt(from.x, from.y, from.z, ...ORBIT_TARGET.toArray(), animate);
      break;
    }
    case 'top': {
      const distance = TOP_HALF_SPAN_KM / (tanHalfFov * Math.min(1, aspect));
      // A hair south of straight down keeps north at the top of the screen.
      void controls.setLookAt(0, distance, 0.001, 0, 0, 0, animate);
      break;
    }
    case 'radar': {
      const eye = new Vector3(0, MAST_KM * useViewStore.getState().heightScale, 0);
      // Towards the selected aircraft, or north and slightly up. The camera orbits a point
      // 20 m in front of the mast, so dragging turns the view like turning your head.
      const direction = lookAt ? lookAt.clone().sub(eye) : new Vector3(0, 0.08, -1);
      const target = direction.setLength(0.02).add(eye);
      void controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, animate);
      break;
    }
    case 'follow':
      // Handled every frame (see the follow camera above).
      break;
  }
}
