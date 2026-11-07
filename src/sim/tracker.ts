import { TICK_S } from './core/clock';
import { add, scale, type Vec3 } from './core/vec';
import type { Track } from './types';

/**
 * Where the battery believes a track is at `tick`: its last echo, moved on at the velocity
 * estimated from the last two echoes. Step 6 replaces this with a Kalman filter's estimate.
 */
export function trackPositionAt(track: Track, tick: number): Vec3 {
  if (!track.velocity) return track.position;
  return add(track.position, scale(track.velocity, (tick - track.lastPaintTick) * TICK_S));
}
