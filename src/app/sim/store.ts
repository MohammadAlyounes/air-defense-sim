import { createStore, type StoreApi } from 'zustand/vanilla';
import type { LogSource } from './narrator';

export interface LogEntry {
  id: number;
  timeS: number;
  source: LogSource;
  text: string;
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
}

export type SimStore = StoreApi<SimUiState>;

export const createSimStore = (initial: SimUiState): SimStore =>
  createStore<SimUiState>()(() => initial);
