import { Vector3, type Camera } from 'three';

/**
 * DOM labels that follow points in the 3D scene. The labels are ordinary page elements in a
 * layer over the canvas (crisp text, normal clicks); once per rendered frame,
 * `projectLabels` moves each one onto its anchor's position on screen.
 */

/** Writes where the label points this frame (scene units) into `out`; false hides the label. */
export type LocateLabel = (out: Vector3) => boolean;

/**
 * How readily a label steps aside for others. `always` labels are always shown; a label of a
 * lower rank is hidden wherever a shown label of a higher rank covers part of it.
 */
export const LABEL_RANK = {
  /** Aircraft tags, compass letters, defended assets. */
  always: 0,
  /** Names of the map's features: the civil corridors. */
  feature: 1,
  /** Distances on the range rings. */
  distance: 2,
} as const;

export type LabelRank = (typeof LABEL_RANK)[keyof typeof LABEL_RANK];

interface Anchor {
  locate: LocateLabel;
  /** Drawn above every other label (the selected aircraft). */
  front: boolean;
  rank: LabelRank;
}

const anchors = new Map<HTMLElement, Anchor>();

/** Starts moving `element` with a point in the scene. Returns a function that stops it. */
export function anchorLabel(
  element: HTMLElement,
  locate: LocateLabel,
  front = false,
  rank: LabelRank = LABEL_RANK.always,
): () => void {
  anchors.set(element, { locate, front, rank });
  return () => {
    anchors.delete(element);
  };
}

const world = new Vector3();
const view = new Vector3();

/** Places every label for this frame; viewport size in CSS pixels. */
export function projectLabels(camera: Camera, width: number, height: number): void {
  camera.updateMatrixWorld();
  const shown: { element: HTMLElement; rank: LabelRank }[] = [];
  for (const [element, { locate, front, rank }] of anchors) {
    const style = element.style;
    // In front of the camera (view space looks down -z) and on screen, with a little margin.
    const onScreen =
      locate(world) &&
      view.copy(world).applyMatrix4(camera.matrixWorldInverse).z < 0 &&
      view.applyMatrix4(camera.projectionMatrix) &&
      Math.abs(view.x) <= 1.1 &&
      Math.abs(view.y) <= 1.1;
    if (!onScreen) {
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
    shown.push({ element, rank });
  }
  declutter(shown);
}

/**
 * Hides each label that a shown label of a higher rank covers, rank by rank, so a hidden label
 * hides nothing. Labels of the same rank may overlap.
 */
function declutter(shown: readonly { element: HTMLElement; rank: LabelRank }[]): void {
  if (shown.every(({ rank }) => rank === LABEL_RANK.always)) return;
  // Every label has moved, so one layout pass serves all the boxes read below.
  const labels = shown.map(({ element, rank }) => ({ element, rank, box: boxOf(element) }));
  const kept = labels.filter(({ rank }) => rank === LABEL_RANK.always);
  for (const rank of [LABEL_RANK.feature, LABEL_RANK.distance]) {
    const free = labels.filter(
      (label) => label.rank === rank && !kept.some((cover) => overlap(label.box, cover.box)),
    );
    for (const label of labels) {
      if (label.rank === rank && !free.includes(label)) label.element.style.visibility = 'hidden';
    }
    kept.push(...free);
  }
}

/** The on-screen box of a label's content (the anchor element itself is a zero-size point). */
const boxOf = (element: HTMLElement): DOMRect =>
  (element.firstElementChild ?? element).getBoundingClientRect();

/** True if two boxes overlap by more than a sliver (2 px): labels may touch. */
const overlap = (a: DOMRect, b: DOMRect): boolean =>
  a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2;
