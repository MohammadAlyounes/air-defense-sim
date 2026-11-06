import type { RadarSize } from '../../sim';
import type { RenderFrame } from '../sim/SimController';

/**
 * Draws the radar scope (a PPI: plan position indicator). The battery is at the centre,
 * north is up and distance from the centre is ground range. Static parts (rings, ticks,
 * labels) are drawn once per resize into an offscreen layer; each frame adds the sweep and
 * the fading echoes.
 */

export interface ScopeLayout {
  /** Canvas size in CSS pixels (the canvas is square). */
  size: number;
  dpr: number;
  radiusPx: number;
  rangeM: number;
  staticLayer: HTMLCanvasElement;
}

const TWO_PI = 2 * Math.PI;
const RING_STEP_M = 10_000;
const SWEEP_TRAIL_RAD = 0.9;
/** Echo radius by radar size: bigger objects return stronger, larger blips. */
const BLIP_RADIUS_PX: Readonly<Record<RadarSize, number>> = {
  tiny: 1.7,
  small: 2.2,
  medium: 2.8,
  large: 3.4,
};

export function createScopeLayout(size: number, dpr: number, rangeM: number): ScopeLayout {
  const radiusPx = size / 2 - 4;
  const staticLayer = document.createElement('canvas');
  staticLayer.width = Math.round(size * dpr);
  staticLayer.height = Math.round(size * dpr);
  const ctx = staticLayer.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawStatic(ctx, size, radiusPx, rangeM);
  }
  return { size, dpr, radiusPx, rangeM, staticLayer };
}

/** Screen position of a compass bearing at a given pixel radius. */
const polar = (c: number, bearingRad: number, r: number) => ({
  x: c + r * Math.sin(bearingRad),
  y: c - r * Math.cos(bearingRad),
});

function drawStatic(ctx: CanvasRenderingContext2D, size: number, radius: number, rangeM: number) {
  const c = size / 2;

  const background = ctx.createRadialGradient(c, c, 0, c, c, radius);
  background.addColorStop(0, '#0b2a33');
  background.addColorStop(1, '#06121a');
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, TWO_PI);
  ctx.fill();

  // Range rings every 10 km, labelled along the north-north-east radial.
  ctx.font = '9px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let ringM = RING_STEP_M; ringM <= rangeM; ringM += RING_STEP_M) {
    const r = (ringM / rangeM) * radius;
    ctx.strokeStyle = ringM === rangeM ? 'rgba(34, 211, 238, 0.45)' : 'rgba(34, 211, 238, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, r, 0, TWO_PI);
    ctx.stroke();
    if (ringM < rangeM) {
      const label = polar(c, 0.35, r);
      ctx.fillStyle = 'rgba(143, 160, 191, 0.85)';
      ctx.fillText(`${ringM / 1000}`, label.x + 3, label.y);
    }
  }

  // Cross hairs and azimuth ticks every 10°, longer every 30°.
  ctx.strokeStyle = 'rgba(34, 211, 238, 0.10)';
  ctx.beginPath();
  ctx.moveTo(c, c - radius);
  ctx.lineTo(c, c + radius);
  ctx.moveTo(c - radius, c);
  ctx.lineTo(c + radius, c);
  ctx.stroke();
  for (let deg = 0; deg < 360; deg += 10) {
    const bearingRad = (deg * Math.PI) / 180;
    const major = deg % 30 === 0;
    const inner = polar(c, bearingRad, radius - (major ? 9 : 5));
    const outer = polar(c, bearingRad, radius);
    ctx.strokeStyle = major ? 'rgba(34, 211, 238, 0.55)' : 'rgba(34, 211, 238, 0.25)';
    ctx.beginPath();
    ctx.moveTo(inner.x, inner.y);
    ctx.lineTo(outer.x, outer.y);
    ctx.stroke();
  }

  ctx.font = '600 10px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(34, 211, 238, 0.7)';
  for (const [label, bearingRad] of [
    ['N', 0],
    ['E', Math.PI / 2],
    ['S', Math.PI],
    ['W', (3 * Math.PI) / 2],
  ] as const) {
    const p = polar(c, bearingRad, radius - 18);
    ctx.fillText(label, p.x, p.y);
  }

  // The battery at the centre.
  ctx.fillStyle = '#22d3ee';
  ctx.beginPath();
  ctx.moveTo(c, c - 5);
  ctx.lineTo(c + 4.5, c + 3.5);
  ctx.lineTo(c - 4.5, c + 3.5);
  ctx.closePath();
  ctx.fill();
}

/** Blends two antenna angles, always moving forward (clockwise). */
export function interpolateAzimuth(fromRad: number, toRad: number, alpha: number): number {
  const delta = (((toRad - fromRad) % TWO_PI) + TWO_PI) % TWO_PI;
  return (fromRad + delta * alpha) % TWO_PI;
}

export function drawScope(ctx: CanvasRenderingContext2D, layout: ScopeLayout, frame: RenderFrame) {
  const { size, dpr, radiusPx, rangeM } = layout;
  const c = size / 2;
  const { previous, current, alpha } = frame;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(layout.staticLayer, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const timeS = previous.timeS + (current.timeS - previous.timeS) * alpha;
  const azimuth = interpolateAzimuth(previous.radar.azimuthRad, current.radar.azimuthRad, alpha);

  // Sweep: a fading trail behind the beam (canvas angles start east; radar angles start north).
  if (typeof ctx.createConicGradient === 'function') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, radiusPx, 0, TWO_PI);
    ctx.clip();
    const start = azimuth - Math.PI / 2 - SWEEP_TRAIL_RAD;
    const trail = ctx.createConicGradient(start, c, c);
    const end = SWEEP_TRAIL_RAD / TWO_PI;
    trail.addColorStop(0, 'rgba(34, 211, 238, 0)');
    trail.addColorStop(end, 'rgba(34, 211, 238, 0.32)');
    trail.addColorStop(Math.min(1, end + 0.0005), 'rgba(34, 211, 238, 0)');
    trail.addColorStop(1, 'rgba(34, 211, 238, 0)');
    ctx.fillStyle = trail;
    ctx.fillRect(c - radiusPx, c - radiusPx, radiusPx * 2, radiusPx * 2);
    ctx.restore();
  }
  const tip = polar(c, azimuth, radiusPx);
  ctx.strokeStyle = 'rgba(165, 243, 252, 0.9)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(c, c);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  // Echoes: bright when painted, fading like phosphor until the beam comes round again.
  const scale = radiusPx / rangeM;
  const fadeS = current.radar.periodS * 0.85;
  for (const plot of current.plots) {
    const age = timeS - plot.timeS;
    if (age < 0) continue;
    const glow = Math.exp(-age / fadeS);
    if (glow < 0.04) continue;
    const x = c + plot.position.x * scale;
    const y = c - plot.position.y * scale;
    const r = BLIP_RADIUS_PX[plot.radarSize];
    ctx.fillStyle = `rgba(167, 243, 208, ${0.2 * glow})`;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.6, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = `rgba(220, 255, 240, ${0.95 * glow})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }
}
