import { createStore, type StoreApi } from 'zustand/vanilla';
import type { AircraftType } from '../../sim';
import type { DefenseSummary } from './defenseSummary';
import type { LogSource } from './narrator';

export interface LogEntry {
  id: number;
  timeS: number;
  /** The aircraft the line is about, so the line can select it (null: a false alarm). */
  aircraftId: number | null;
  source: LogSource;
  text: string;
}

/**
 * A short summary after an engagement ends: a confirmed kill, a threat that got through, or a
 * friendly or civil aircraft shot down (an identification failure).
 */
export interface ResultCard {
  id: number;
  kind: 'kill' | 'leak' | 'idError';
  /** The defended asset a leak reached. */
  asset: string | null;
  timeS: number;
  trackId: number | null;
  /** What it really was: revealed after the fact. */
  type: AircraftType;
  detectedRangeM: number | null;
  detectionToKillS: number | null;
  interceptorsFired: number | null;
}

/**
 * What React components read about the simulation. Updated about ten times per second
 * (and immediately on play, pause, step or restart); the radar scope reads snapshots
 * directly every frame instead.
 */
export interface SimUiState {
  running: boolean;
  speed: number;
  seed: number;
  tick: number;
  timeS: number;
  contactsHeld: number;
  /** Plain-language summary for the header's NOW line. */
  now: string;
  /** Newest first. */
  log: readonly LogEntry[];
  /** Stage counts and key numbers for the analysis bar. */
  defense: DefenseSummary;
  /** Newest first, the last few. */
  results: readonly ResultCard[];
}

export type SimStore = StoreApi<SimUiState>;

export const createSimStore = (initial: SimUiState): SimStore =>
  createStore<SimUiState>()(() => initial);
