import {
  coverageAt,
  DEFAULT_ASSETS,
  TICK_S,
  trackEllipseAt,
  trackPositionAt,
  TRAFFIC,
  type CoverageMap,
  type DefendedAsset,
  type Effect,
  type Identity,
  type RadarSize,
  type Snapshot,
  type Terrain,
  type Track,
  type TrafficTypeId,
  type Vec3,
} from '../../sim';
import type { RenderFrame } from '../sim/SimController';

/**
 * Draws the radar scope (a PPI: plan position indicator). The battery is at the centre,
 * north is up and distance from the centre is ground range. Static parts (rings, ticks,
 * labels, the defended area) are drawn once per resize into an offscreen layer; each frame
 * adds the sweep, the fading echoes, and the battery's picture: its tracks, its interceptors
 * and where they are heading.
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
/** Echoes fade like phosphor: brightness exp(-age / fade), with the fade 85% of a turn. */
const FADE_TURNS = 0.85;
/** Below this brightness an echo is no longer drawn (nor clickable). */
const MIN_GLOW = 0.04;
/** How close to an echo or a track a click must land to pick it, in CSS pixels. */
export const PICK_RADIUS_PX = 14;
/** Velocity leaders show where each track will be in this many seconds. */
const LEADER_S = 30;

/** Track symbol colours: the same colour language as the rest of the console. */
export const IDENTITY_COLOR: Readonly<Record<Identity, string>> = {
  pending: '#facc15',
  unknown: '#fb923c',
  hostile: '#f87171',
  friend: '#60a5fa',
  neutral: '#4ade80',
};

const EFFECT_STYLE: Readonly<Record<Effect['kind'], { color: string; seconds: number }>> = {
  launch: { color: '34, 211, 238', seconds: 0.8 },
  intercept: { color: '228, 234, 245', seconds: 1.6 },
  miss: { color: '143, 160, 191', seconds: 1.2 },
  leak: { color: '251, 113, 133', seconds: 2.5 },
};

export function createScopeLayout(
  size: number,
  dpr: number,
  rangeM: number,
  /** Defended assets: each drawn with its threat radius (dashed); courses passing inside are threats. */
  assets: readonly DefendedAsset[] = DEFAULT_ASSETS,
  /** Drawn as a faint relief map under the rings. */
  terrain: Terrain | null = null,
): ScopeLayout {
  const radiusPx = size / 2 - 4;
  const staticLayer = document.createElement('canvas');
  staticLayer.width = Math.round(size * dpr);
  staticLayer.height = Math.round(size * dpr);
  const ctx = staticLayer.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    drawStatic(ctx, size, radiusPx, rangeM, assets, terrain);
  }
  return { size, dpr, radiusPx, rangeM, staticLayer };
}

/** Relief colours: contour lines every 100 m, slopes lit from the north-west. */
const CONTOUR_M = 100;

/**
 * Paints the terrain inside the scope's circle, one pixel at a time: a little brighter with
 * height, shaded by slope, with thin contour lines. It stays faint, so echoes stand out.
 */
function terrainImage(
  ctx: CanvasRenderingContext2D,
  size: number,
  radius: number,
  rangeM: number,
  terrain: Terrain,
): ImageData {
  const px = ctx.canvas.width;
  const scale = px / size;
  const metresPerPx = rangeM / (radius * scale);
  const c = px / 2;
  const heights = new Float32Array(px * px);
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      heights[y * px + x] = terrain.heightAt((x - c) * metresPerPx, (c - y) * metresPerPx);
    }
  }
  const image = ctx.createImageData(px, px);
  const data = image.data;
  const maxH = Math.max(1, terrain.maxHeightM);
  const r2 = (radius * scale) ** 2;
  for (let y = 1; y < px - 1; y++) {
    for (let x = 1; x < px - 1; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > r2) continue;
      const i = y * px + x;
      const h = heights[i] ?? 0;
      const dx = ((heights[i + 1] ?? h) - (heights[i - 1] ?? h)) / (2 * metresPerPx);
      const dy = ((heights[i + px] ?? h) - (heights[i - px] ?? h)) / (2 * metresPerPx);
      // Light from the north-west: slopes facing it brighten, the others darken.
      const light = Math.max(-1, Math.min(1, (-dx + dy) * 6));
      const band = Math.floor(h / CONTOUR_M);
      const contour =
        h > 1 &&
        (band !== Math.floor((heights[i + 1] ?? h) / CONTOUR_M) ||
          band !== Math.floor((heights[i + px] ?? h) / CONTOUR_M));
      const lift = (h / maxH) * 0.55;
      const alpha = Math.max(
        0,
        Math.min(1, 0.08 + 0.55 * lift + 0.12 * light + (contour ? 0.22 : 0)),
      );
      const o = i * 4;
      data[o] = 120;
      data[o + 1] = 190;
      data[o + 2] = 175;
      data[o + 3] = Math.round(alpha * 120);
    }
  }
  return image;
}

/**
 * Where the radar cannot see a target flying `altitudeM` above the ground: a translucent
 * orange shade over the scope, from the coverage map. Drawn once per altitude and size.
 */
export function createCoverageLayer(
  layout: ScopeLayout,
  map: CoverageMap,
  altitudeM: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const px = layout.staticLayer.width;
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const scale = px / layout.size;
  const metresPerPx = layout.rangeM / (layout.radiusPx * scale);
  const c = px / 2;
  const r2 = (layout.radiusPx * scale) ** 2;
  const image = ctx.createImageData(px, px);
  const data = image.data;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      if ((x - c) ** 2 + (y - c) ** 2 > r2) continue;
      const blind = coverageAt(map, (x - c) * metresPerPx, (c - y) * metresPerPx) > altitudeM;
      if (!blind) continue;
      const o = (y * px + x) * 4;
      data[o] = 251;
      data[o + 1] = 146;
      data[o + 2] = 60;
      data[o + 3] = 64;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type ScopeGeometry = Pick<ScopeLayout, 'size' | 'radiusPx' | 'rangeM'>;

/** Where a ground position (metres east and north of the battery) appears on the scope, in CSS pixels. */
export function scopePoint(layout: ScopeGeometry, eastM: number, northM: number) {
  const c = layout.size / 2;
  const scale = layout.radiusPx / layout.rangeM;
  return { x: c + eastM * scale, y: c - northM * scale };
}

/** Brightness of an echo `ageS` seconds after the paint (0 when not yet painted). */
export const echoGlow = (ageS: number, periodS: number): number =>
  ageS < 0 ? 0 : Math.exp(-ageS / (periodS * FADE_TURNS));

/**
 * The aircraft behind the track symbol or visible echo nearest to a click at (x, y), in CSS
 * pixels from the scope's top-left corner, or null when nothing is close enough. This uses
 * the ground-truth link of each track and plot; the radar picture itself never shows it.
 */
export function pickEcho(
  snapshot: Pick<Snapshot, 'plots' | 'radar'> & Partial<Pick<Snapshot, 'tracks'>>,
  timeS: number,
  layout: ScopeGeometry,
  x: number,
  y: number,
): number | null {
  let best: number | null = null;
  let bestDistance = PICK_RADIUS_PX;
  for (const track of snapshot.tracks ?? []) {
    const at = trackPositionAt(track, timeS / TICK_S);
    const p = scopePoint(layout, at.x, at.y);
    const distance = Math.hypot(p.x - x, p.y - y);
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = track.truthId;
    }
  }
  for (const plot of snapshot.plots) {
    if (echoGlow(timeS - plot.timeS, snapshot.radar.periodS) < MIN_GLOW) continue;
    const p = scopePoint(layout, plot.position.x, plot.position.y);
    const distance = Math.hypot(p.x - x, p.y - y);
    // `<=`: on a tie, the newer echo (plots are oldest first) wins.
    if (distance <= bestDistance) {
      bestDistance = distance;
      best = plot.truthId;
    }
  }
  return best;
}

/** Screen position of a compass bearing at a given pixel radius. */
const polar = (c: number, bearingRad: number, r: number) => ({
  x: c + r * Math.sin(bearingRad),
  y: c - r * Math.cos(bearingRad),
});

function drawStatic(
  ctx: CanvasRenderingContext2D,
  size: number,
  radius: number,
  rangeM: number,
  assets: readonly DefendedAsset[],
  terrain: Terrain | null,
) {
  const c = size / 2;

  const background = ctx.createRadialGradient(c, c, 0, c, c, radius);
  background.addColorStop(0, '#0b2a33');
  background.addColorStop(1, '#06121a');
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.arc(c, c, radius, 0, TWO_PI);
  ctx.fill();

  if (terrain && terrain.maxHeightM > 0) {
    // putImageData ignores the transform, so the relief goes through a layer of its own.
    const layer = document.createElement('canvas');
    layer.width = ctx.canvas.width;
    layer.height = ctx.canvas.height;
    const layerCtx = layer.getContext('2d');
    if (layerCtx) {
      layerCtx.putImageData(terrainImage(layerCtx, size, radius, rangeM, terrain), 0, 0);
      ctx.drawImage(layer, 0, 0, size, size);
    }
  }

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

  // Defended assets: hostiles whose course passes inside a dashed ring are threats to it.
  const scale = radius / rangeM;
  ctx.save();
  ctx.font = '600 9px Inter Variable, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const asset of assets) {
    const x = c + asset.position.x * scale;
    const y = c - asset.position.y * scale;
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
    ctx.beginPath();
    ctx.arc(x, y, asset.threatRadiusM * scale, 0, TWO_PI);
    ctx.stroke();
    ctx.setLineDash([]);
    if (asset.id === 0) continue; // the battery has its own symbol
    ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = 'rgba(253, 230, 138, 0.85)';
    ctx.fillText(asset.name, x + 6, y - 6);
  }
  ctx.restore();

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

export function drawScope(
  ctx: CanvasRenderingContext2D,
  layout: ScopeLayout,
  frame: RenderFrame,
  /** Aircraft selected in the UI: its track gets a highlight box. */
  selectedId: number | null = null,
  /** Blind-zone shading from `createCoverageLayer`, or null. */
  coverage: HTMLCanvasElement | null = null,
  /** Truth vs. perception: mark where aircraft really are, and each track's error. */
  compareTruth = false,
) {
  const { size, dpr, radiusPx } = layout;
  const c = size / 2;
  const { previous, current, alpha } = frame;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(layout.staticLayer, 0, 0);
  if (coverage) ctx.drawImage(coverage, 0, 0);
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
  for (const plot of current.plots) {
    const glow = echoGlow(timeS - plot.timeS, current.radar.periodS);
    if (glow < MIN_GLOW) continue;
    const { x, y } = scopePoint(layout, plot.position.x, plot.position.y);
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

  const tick = previous.tick + (current.tick - previous.tick) * alpha;
  drawEffects(ctx, layout, current.effects, timeS);
  drawEngagements(ctx, layout, frame);
  for (const track of current.tracks) drawTrack(ctx, layout, track, tick);
  if (compareTruth) drawTruth(ctx, layout, frame, tick);

  // The selected aircraft: a box around its track symbol.
  const selected =
    selectedId === null ? undefined : current.tracks.find((t) => t.truthId === selectedId);
  if (selected) {
    const at = trackPositionAt(selected, tick);
    drawSelectionBox(ctx, scopePoint(layout, at.x, at.y));
  }
}

/** One track: its identity symbol, a velocity leader and its number. */
function drawTrack(ctx: CanvasRenderingContext2D, layout: ScopeLayout, track: Track, tick: number) {
  const at = trackPositionAt(track, tick);
  const { x, y } = scopePoint(layout, at.x, at.y);
  const scale = layout.radiusPx / layout.rangeM;
  const color = IDENTITY_COLOR[track.identity];
  const confirmed = track.confirmedTick !== null;
  ctx.save();
  ctx.globalAlpha = confirmed ? 1 : 0.55;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;

  // The 2-sigma uncertainty ellipse: the tracker is about 86% sure the target is inside.
  const ellipse = trackEllipseAt(track, tick);
  const major = 2 * ellipse.majorM * scale;
  if (major >= 2.5) {
    ctx.save();
    ctx.globalAlpha *= 0.45;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Canvas angles run clockwise from east; a compass bearing runs clockwise from north.
    ctx.ellipse(
      x,
      y,
      major,
      Math.max(1, 2 * ellipse.minorM * scale),
      ellipse.bearingRad - Math.PI / 2,
      0,
      TWO_PI,
    );
    ctx.stroke();
    ctx.restore();
  }

  if (track.velocity) {
    ctx.globalAlpha *= 0.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + track.velocity.x * LEADER_S * scale, y - track.velocity.y * LEADER_S * scale);
    ctx.stroke();
    ctx.globalAlpha = confirmed ? 1 : 0.55;
  }

  const r = confirmed ? 5 : 4;
  ctx.beginPath();
  switch (track.identity) {
    case 'hostile':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      break;
    case 'friend':
      ctx.arc(x, y, r, 0, TWO_PI);
      break;
    case 'neutral':
      ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'pending':
      ctx.setLineDash([2, 2]);
      ctx.arc(x, y, r, 0, TWO_PI);
      break;
  }
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '600 9px "JetBrains Mono Variable", ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`T${track.id}`, x + 7, y - 7);
  ctx.restore();
}

/**
 * Truth vs. perception: a grey cross where every aircraft really is (including those the radar
 * has not seen), and a thin line from each track to the aircraft behind it: the tracking error.
 */
function drawTruth(
  ctx: CanvasRenderingContext2D,
  layout: ScopeLayout,
  frame: RenderFrame,
  tick: number,
) {
  const { previous, current, alpha } = frame;
  const before = new Map(previous.aircraft.map((a) => [a.id, a.position]));
  const truth = new Map<number, { x: number; y: number }>();
  ctx.save();
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)';
  ctx.lineWidth = 1.2;
  for (const aircraft of current.aircraft) {
    const old = before.get(aircraft.id);
    const at = old ? lerp(old, aircraft.position, alpha) : aircraft.position;
    const p = scopePoint(layout, at.x, at.y);
    truth.set(aircraft.id, p);
    ctx.beginPath();
    ctx.moveTo(p.x - 3, p.y);
    ctx.lineTo(p.x + 3, p.y);
    ctx.moveTo(p.x, p.y - 3);
    ctx.lineTo(p.x, p.y + 3);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(203, 213, 225, 0.5)';
  ctx.setLineDash([2, 2]);
  for (const track of current.tracks) {
    const real = track.truthId === null ? undefined : truth.get(track.truthId);
    if (!real) continue;
    const at = trackPositionAt(track, tick);
    const p = scopePoint(layout, at.x, at.y);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(real.x, real.y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Interceptors in flight (the battery knows where its own are), and where they are heading. */
function drawEngagements(ctx: CanvasRenderingContext2D, layout: ScopeLayout, frame: RenderFrame) {
  const { previous, current, alpha } = frame;
  const before = new Map(previous.interceptors.map((i) => [i.id, i.position]));
  for (const missile of current.interceptors) {
    const old = before.get(missile.id);
    const at = old ? lerp(old, missile.position, alpha) : missile.position;
    const head = scopePoint(layout, at.x, at.y);
    const engagement = current.engagements.find((e) => e.id === missile.engagementId);

    // Dotted line to the predicted intercept point, marked with a small cross.
    if (engagement) {
      const aim = scopePoint(layout, engagement.predictedPoint.x, engagement.predictedPoint.y);
      ctx.save();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.setLineDash([1.5, 3]);
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(aim.x, aim.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.85)';
      ctx.beginPath();
      ctx.moveTo(aim.x - 3.5, aim.y - 3.5);
      ctx.lineTo(aim.x + 3.5, aim.y + 3.5);
      ctx.moveTo(aim.x + 3.5, aim.y - 3.5);
      ctx.lineTo(aim.x - 3.5, aim.y + 3.5);
      ctx.stroke();
      ctx.restore();
    }

    // The last two seconds of its path, fading out.
    const recent = missile.trail.slice(-20);
    for (let i = 1; i < recent.length; i++) {
      const a = recent[i - 1];
      const b = recent[i];
      if (!a || !b) continue;
      const pa = scopePoint(layout, a.x, a.y);
      const pb = scopePoint(layout, b.x, b.y);
      ctx.strokeStyle = `rgba(34, 211, 238, ${(0.6 * i) / recent.length})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 4, 0, TWO_PI);
    ctx.fill();
    ctx.fillStyle = '#e6fdff';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 1.8, 0, TWO_PI);
    ctx.fill();
  }
}

/** Launches, intercepts, misses and leaks: a ring that grows and fades. */
function drawEffects(
  ctx: CanvasRenderingContext2D,
  layout: ScopeLayout,
  effects: readonly Effect[],
  timeS: number,
) {
  for (const effect of effects) {
    const style = EFFECT_STYLE[effect.kind];
    const t = (timeS - effect.tick * TICK_S) / style.seconds;
    if (t < 0 || t > 1) continue;
    const { x, y } = scopePoint(layout, effect.position.x, effect.position.y);
    ctx.strokeStyle = `rgba(${style.color}, ${1 - t})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 4 + 14 * t, 0, TWO_PI);
    ctx.stroke();
  }
}

const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Corner brackets around the selected aircraft's track. */
function drawSelectionBox(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }) {
  const half = 9;
  const arm = 4.5;
  ctx.strokeStyle = 'rgba(228, 234, 245, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const cx = x + sx * half;
    const cy = y + sy * half;
    ctx.moveTo(cx - sx * arm, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy - sy * arm);
  }
  ctx.stroke();
}

/** Ground point of a screen position on the scope (CSS pixels from its corner), metres. */
export function groundPointAt(layout: ScopeGeometry, x: number, y: number) {
  const c = layout.size / 2;
  const scale = layout.radiusPx / layout.rangeM;
  return { eastM: (x - c) / scale, northM: (c - y) / scale };
}

export interface ScopeGhost {
  type: TrafficTypeId;
  at: { eastM: number; northM: number };
  valid: boolean;
  /** Time to reach the battery, s, shown next to the ghost. */
  timeToBatteryS: number;
}

/**
 * Traffic being placed: a ghost symbol with its route to the battery, and a ripple where the
 * last one was placed. Drawn over the scope by the same frame.
 */
export function drawPlacement(
  ctx: CanvasRenderingContext2D,
  layout: ScopeLayout,
  ghost: ScopeGhost | null,
  ripple: { at: { eastM: number; northM: number }; progress: number } | null,
) {
  const c = layout.size / 2;
  if (ghost) {
    const p = scopePoint(layout, ghost.at.eastM, ghost.at.northM);
    const color = ghost.valid ? IDENTITY_COLOR[TRAFFIC[ghost.type].affiliation] : '#8fa0bf';
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(c, c);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, TWO_PI);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    if (ghost.valid) {
      ctx.globalAlpha = 1;
      ctx.font = '600 10px "JetBrains Mono Variable", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const s = Math.round(ghost.timeToBatteryS);
      const time = s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      ctx.fillText(time, p.x + 10, p.y - 10);
    }
    ctx.restore();
  }
  if (ripple && ripple.progress < 1) {
    const p = scopePoint(layout, ripple.at.eastM, ripple.at.northM);
    ctx.strokeStyle = `rgba(34, 211, 238, ${1 - ripple.progress})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5 + 22 * ripple.progress, 0, TWO_PI);
    ctx.stroke();
  }
}
