import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { SimController } from './SimController';
import type { SimUiState } from './store';

export const SimContext = createContext<SimController | null>(null);

/** The running simulation's controller (play, pause, step, speed, restart). */
export function useSimController(): SimController {
  const controller = useContext(SimContext);
  if (!controller) throw new Error('useSimController must be used inside <SimProvider>');
  return controller;
}

/**
 * Reads one piece of simulation state and re-renders when it changes.
 * Select existing values (not new objects or arrays), so renders stay cheap.
 */
export function useSimState<T>(selector: (state: SimUiState) => T): T {
  return useStore(useSimController().store, selector);
}
