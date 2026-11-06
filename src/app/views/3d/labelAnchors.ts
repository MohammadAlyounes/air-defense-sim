import { Vector3, type Camera } from 'three';

/**
 * DOM labels that follow points in the 3D scene. The labels are ordinary page elements in a
 * layer over the canvas (crisp text, normal clicks); once per rendered frame,
 * `projectLabels` moves each one onto its anchor's position on screen.
 */

/** Writes where the label points this frame (scene units) into `out`; false hides the label. */
export type LocateLabel = (out: Vector3) => boolean;

interface Anchor {
  locate: LocateLabel;
  /** Drawn above every other label (the selected aircraft). */
  front: boolean;
}

const anchors = new Map<HTMLElement, Anchor>();

/** Starts moving `element` with a point in the scene. Returns a function that stops it. */
export function anchorLabel(element: HTMLElement, locate: LocateLabel, front = false): () => void {
  anchors.set(element, { locate, front });
  return () => {
    anchors.delete(element);
  };
}

const world = new Vector3();
const view = new Vector3();

/** Places every label for this frame; viewport size in CSS pixels. */
export function projectLabels(camera: Camera, width: number, height: number): void {
  camera.updateMatrixWorld();
  for (const [element, { locate, front }] of anchors) {
    const style = element.style;
    // In front of the camera (view space looks down -z) and on screen, with a little margin.
    const shown =
      locate(world) &&
      view.copy(world).applyMatrix4(camera.matrixWorldInverse).z < 0 &&
      view.applyMatrix4(camera.projectionMatrix) &&
      Math.abs(view.x) <= 1.1 &&
      Math.abs(view.y) <= 1.1;
    if (!shown) {
      style.visibility = 'hidden';
      continue;
    }
    const x = ((view.x + 1) / 2) * width;
    const y = ((1 - view.y) / 2) * height;
    style.visibility = 'visible';
    style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    // Nearer labels on top.
    const distance = camera.position.distanceTo(world);
    style.zIndex = String(front ? 100_000 : Math.max(1, 50_000 - Math.round(distance * 100)));
  }
}
