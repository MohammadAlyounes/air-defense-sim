import { CustomBlending, MaxEquation, type Color, type InterleavedBufferAttribute } from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

/**
 * A line with a constant width in CSS pixels (plain WebGL lines are one device pixel: hard to
 * see on high-density screens), rewritten in place every frame without new allocations.
 *
 * Each pixel keeps the brighter of the line and what is behind it (max blending), so fading a
 * point's colour towards black fades it out against the dark scene: a fade without per-point
 * transparency, which these lines do not support. Unlike adding colours, it also keeps the
 * overlapping ends of short segments from showing as bright dots.
 */
export class Polyline {
  readonly object: Line2;
  private readonly geometry: LineGeometry;
  private readonly material: LineMaterial;
  private readonly segments: Float32Array;
  private readonly segmentColors: Float32Array;
  private readonly maxPoints: number;
  private points = 0;

  constructor(maxPoints: number, widthPx: number) {
    this.maxPoints = maxPoints;
    this.geometry = new LineGeometry();
    // Allocate the buffers once, at full size; `instanceCount` limits what is drawn.
    this.geometry.setPositions(new Float32Array(maxPoints * 3));
    this.geometry.setColors(new Float32Array(maxPoints * 3));
    this.segments = (this.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data
      .array as Float32Array;
    this.segmentColors = (
      this.geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute
    ).data.array as Float32Array;
    this.material = new LineMaterial({
      linewidth: widthPx,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: MaxEquation,
    });
    this.object = new Line2(this.geometry, this.material);
    this.object.frustumCulled = false;
    this.geometry.instanceCount = 0;
  }

  /** Starts a new frame of points. */
  begin(): void {
    this.points = 0;
  }

  /** Appends a point with its colour scaled by `brightness` (0 = invisible, 1 = full colour). */
  push(x: number, y: number, z: number, color: Color, brightness: number): void {
    if (this.points >= this.maxPoints) return;
    const i = this.points++;
    const r = color.r * brightness;
    const g = color.g * brightness;
    const b = color.b * brightness;
    // Point i ends segment i-1 and starts segment i (6 numbers per segment: start, end).
    if (i > 0) this.write(i - 1, 3, x, y, z, r, g, b);
    if (i < this.maxPoints - 1) this.write(i, 0, x, y, z, r, g, b);
  }

  /** Uploads this frame's points; `viewport` in CSS pixels keeps the width right. */
  end(viewportWidth: number, viewportHeight: number): void {
    this.geometry.instanceCount = Math.max(0, this.points - 1);
    (this.geometry.getAttribute('instanceStart') as InterleavedBufferAttribute).data.needsUpdate =
      true;
    (
      this.geometry.getAttribute('instanceColorStart') as InterleavedBufferAttribute
    ).data.needsUpdate = true;
    this.material.resolution.set(viewportWidth, viewportHeight);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  private write(
    segment: number,
    offset: 0 | 3,
    x: number,
    y: number,
    z: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const at = segment * 6 + offset;
    this.segments[at] = x;
    this.segments[at + 1] = y;
    this.segments[at + 2] = z;
    this.segmentColors[at] = r;
    this.segmentColors[at + 1] = g;
    this.segmentColors[at + 2] = b;
  }
}
