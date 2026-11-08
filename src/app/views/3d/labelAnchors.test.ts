import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { anchorLabel, LABEL_RANK, projectLabels } from './labelAnchors';

const fakeElement = () => ({ style: {} as CSSStyleDeclaration }) as HTMLElement;

/** A label whose content covers a fixed box on screen. */
const boxedElement = (left: number, top: number, width: number, height: number) =>
  ({
    style: {} as CSSStyleDeclaration,
    firstElementChild: null,
    getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height }),
  }) as unknown as HTMLElement;

describe('projectLabels', () => {
  const camera = new PerspectiveCamera(90, 2, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  it('puts a label on its anchor, in CSS pixels from the top-left corner', () => {
    const centre = fakeElement();
    const right = fakeElement();
    const stopCentre = anchorLabel(centre, (out) => !!out.set(0, 0, 0));
    // 90° vertical field of view at 10 units: the screen spans ±10 vertically, ±20 horizontally.
    const stopRight = anchorLabel(right, (out) => !!out.set(10, 5, 0));
    projectLabels(camera, 800, 400);
    expect(centre.style.visibility).toBe('visible');
    expect(centre.style.transform).toBe('translate3d(400.0px, 200.0px, 0)');
    expect(right.style.transform).toBe('translate3d(600.0px, 100.0px, 0)');
    stopCentre();
    stopRight();
  });

  it('hides labels behind the camera, off screen or without a position', () => {
    const behind = fakeElement();
    const offScreen = fakeElement();
    const gone = fakeElement();
    const stops = [
      anchorLabel(behind, (out) => !!out.set(0, 0, 20)),
      anchorLabel(offScreen, (out) => !!out.set(80, 0, 0)),
      anchorLabel(gone, () => false),
    ];
    projectLabels(camera, 800, 400);
    expect([behind, offScreen, gone].map((e) => e.style.visibility)).toEqual([
      'hidden',
      'hidden',
      'hidden',
    ]);
    for (const stop of stops) stop();
  });

  it('stacks nearer labels above farther ones, and the front label above all', () => {
    const near = fakeElement();
    const far = fakeElement();
    const front = fakeElement();
    const stops = [
      anchorLabel(near, (out) => !!out.set(0, 0, 5)),
      anchorLabel(far, (out) => !!out.set(0, 0, -5)),
      anchorLabel(front, (out) => !!out.set(0, 0, -5), true),
    ];
    projectLabels(camera, 800, 400);
    expect(Number(near.style.zIndex)).toBeGreaterThan(Number(far.style.zIndex));
    expect(Number(front.style.zIndex)).toBeGreaterThan(Number(near.style.zIndex));
    for (const stop of stops) stop();
  });

  it('hides a lower-ranked label where a shown higher-ranked one covers it, and only there', () => {
    const tag = boxedElement(100, 100, 80, 16);
    const covered = boxedElement(150, 110, 120, 14);
    const clear = boxedElement(400, 300, 120, 14);
    const sameRank = boxedElement(400, 312, 120, 14); // overlaps `clear`, of the same rank
    const behind = boxedElement(400, 300, 120, 14); // covers `clear`, but is not on screen
    const beside = boxedElement(381, 300, 20, 14); // touches `clear` by 1 px: not covering it
    const underClear = boxedElement(450, 305, 30, 10); // a distance under a shown feature name
    const underCovered = boxedElement(200, 112, 30, 10); // only under a hidden feature name
    const { always, feature, distance } = LABEL_RANK;
    const stops = [
      anchorLabel(tag, (out) => !!out.set(0, 0, 0), false, always),
      anchorLabel(beside, (out) => !!out.set(0, 0, 0), false, always),
      anchorLabel(behind, (out) => !!out.set(0, 0, 20), false, always),
      anchorLabel(covered, (out) => !!out.set(0, 0, 0), false, feature),
      anchorLabel(clear, (out) => !!out.set(0, 0, 0), false, feature),
      anchorLabel(sameRank, (out) => !!out.set(0, 0, 0), false, feature),
      anchorLabel(underClear, (out) => !!out.set(0, 0, 0), false, distance),
      anchorLabel(underCovered, (out) => !!out.set(0, 0, 0), false, distance),
    ];
    projectLabels(camera, 800, 400);
    const visibility = (element: HTMLElement) => element.style.visibility;
    expect([tag, beside, covered, clear, sameRank].map(visibility)).toEqual([
      'visible',
      'visible',
      'hidden',
      'visible',
      'visible',
    ]);
    // `underCovered` lies only under `covered`, which is hidden: a hidden label hides nothing.
    expect([underClear, underCovered].map(visibility)).toEqual(['hidden', 'visible']);
    for (const stop of stops) stop();
  });
});
