/** Playback speeds offered in the player bar (simulated seconds per real second). */
export const SPEED_PRESETS: readonly number[] = [0.25, 0.5, 1, 2, 4, 8, 16];

/** Seed used when the URL does not choose one, so every first visit sees the same run. */
export const DEFAULT_SEED = 2026;

const MAX_START_S = 3600;

/** How the simulation starts. All of it can be set from the URL, e.g. `?seed=7&t=60&paused=1`. */
export interface LaunchOptions {
  seed: number;
  /** Simulated seconds to fast-forward before the first frame. */
  startAtS: number;
  /** Start paused instead of playing. */
  paused: boolean;
  speed: number;
}

export function parseLaunchOptions(search: string, prefersReducedMotion = false): LaunchOptions {
  const params = new URLSearchParams(search);

  const seedParam = params.get('seed');
  const seed =
    seedParam !== null && /^\d{1,10}$/.test(seedParam)
      ? Number(seedParam) % 4_294_967_296
      : DEFAULT_SEED;

  const t = Number(params.get('t'));
  const startAtS = Number.isFinite(t) && t > 0 ? Math.min(t, MAX_START_S) : 0;

  const pausedParam = params.get('paused');
  const paused =
    pausedParam === null ? prefersReducedMotion : !['0', 'false', 'no'].includes(pausedParam);

  const speedParam = Number(params.get('speed'));
  const speed = SPEED_PRESETS.includes(speedParam) ? speedParam : 1;

  return { seed, startAtS, paused, speed };
}

/** "¼×", "½×", "1×", "16×". */
export function formatSpeedLabel(speed: number): string {
  if (speed === 0.25) return '¼×';
  if (speed === 0.5) return '½×';
  return `${speed}×`;
}
