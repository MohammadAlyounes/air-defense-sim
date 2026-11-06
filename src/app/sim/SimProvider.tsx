import { useEffect, useState, type ReactNode } from 'react';
import { parseLaunchOptions, type LaunchOptions } from './params';
import { SimContext } from './simContext';
import { SimController } from './SimController';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Creates the simulation for the page, starts its render loop and enables keyboard shortcuts. */
export function SimProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: LaunchOptions;
}) {
  const [controller] = useState(
    () =>
      new SimController(
        options ?? parseLaunchOptions(window.location.search, prefersReducedMotion()),
      ),
  );

  useEffect(() => {
    controller.start();
    return () => controller.stop();
  }, [controller]);

  useKeyboardShortcuts(controller);

  return <SimContext.Provider value={controller}>{children}</SimContext.Provider>;
}
