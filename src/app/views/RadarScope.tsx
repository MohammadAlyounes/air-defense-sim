import { useEffect, useRef, type MouseEvent } from 'react';
import { useSimController } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';
import { createScopeLayout, drawScope, pickEcho, type ScopeLayout } from './scopeRenderer';

/**
 * The live radar scope: redrawn every animation frame from the latest simulation snapshots.
 * Clicking an echo selects the aircraft behind it, everywhere in the console.
 */
export function RadarScope() {
  const controller = useSimController();
  const selectedId = useViewStore((state) => state.selectedId);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<ScopeLayout | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!container || !canvas || !ctx) return;

    const draw = () => {
      const layout = layoutRef.current;
      if (layout) drawScope(ctx, layout, controller.getFrame(), useViewStore.getState().selectedId);
    };
    const resize = () => {
      const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
      if (size <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      layoutRef.current = createScopeLayout(size, dpr, controller.getFrame().current.radar.rangeM);
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const unsubscribeFrames = controller.onFrame(draw);
    // Redraw at once when the selection changes, even while paused.
    const unsubscribeView = useViewStore.subscribe(draw);
    return () => {
      observer.disconnect();
      unsubscribeFrames();
      unsubscribeView();
    };
  }, [controller]);

  /** The aircraft behind the echo under the pointer, if any. */
  const echoAt = (event: MouseEvent<HTMLCanvasElement>): number | null => {
    const layout = layoutRef.current;
    if (!layout) return null;
    const box = event.currentTarget.getBoundingClientRect();
    const { previous, current, alpha } = controller.getFrame();
    const timeS = previous.timeS + (current.timeS - previous.timeS) * alpha;
    return pickEcho(current, timeS, layout, event.clientX - box.left, event.clientY - box.top);
  };

  return (
    <div
      ref={containerRef}
      className="relative grid aspect-square max-h-[24rem] w-full place-items-center lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <canvas
        ref={canvasRef}
        data-testid="radar-scope"
        data-selected={selectedId ?? ''}
        role="img"
        aria-label="Radar scope: the battery at the centre, north up, range rings every 10 km, with echoes from aircraft the beam has swept past. Click an echo to inspect the aircraft."
        onClick={(event) => useViewStore.getState().select(echoAt(event))}
        onMouseMove={(event) => {
          event.currentTarget.style.cursor = echoAt(event) === null ? '' : 'pointer';
        }}
      />
    </div>
  );
}
