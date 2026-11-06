import { PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { anchorLabel, projectLabels } from './labelAnchors';

const fakeElement = () => ({ style: {} as CSSStyleDeclaration }) as HTMLElement;

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
});
