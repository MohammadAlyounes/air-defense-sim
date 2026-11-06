import { useEffect } from 'react';
import type { SimController } from './SimController';

/** Keys shown in tooltips; keep in sync with the handler below. */
export const SHORTCUTS = {
  playPause: 'Space',
  step: '.',
  stepSecond: 'Shift + .',
  faster: '+',
  slower: '-',
  restart: 'R',
} as const;

const INTERACTIVE = 'input, textarea, select, button, a, [contenteditable="true"], [role="slider"]';

/** Space, ".", "+", "-" and "R" control the simulation from anywhere on the page. */
export function useKeyboardShortcuts(controller: SimController): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof Element ? event.target : null;
      // A focused button already reacts to Space and Enter; do not trigger twice.
      if (target?.closest(INTERACTIVE) && (event.key === ' ' || event.key === 'Enter')) return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          controller.toggle();
          break;
        case '.':
          controller.step(event.shiftKey ? 50 : 1);
          break;
        case '>': // Shift + "." on most keyboards
          controller.step(50);
          break;
        case '+':
        case '=':
          controller.faster();
          break;
        case '-':
        case '_':
          controller.slower();
          break;
        case 'r':
        case 'R':
          controller.restart();
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controller]);
}
