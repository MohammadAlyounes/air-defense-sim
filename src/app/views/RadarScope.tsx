import { useEffect, useRef } from 'react';
import { useSimController } from '../sim/simContext';
import { createScopeLayout, drawScope, type ScopeLayout } from './scopeRenderer';

/** The live radar scope: redrawn every animation frame from the latest simulation snapshots. */
export function RadarScope() {
  const controller = useSimController();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!container || !canvas || !ctx) return;

    let layout: ScopeLayout | null = null;
    const draw = () => {
      if (layout) drawScope(ctx, layout, controller.getFrame());
    };
    const resize = () => {
      const size = Math.floor(Math.min(container.clientWidth, container.clientHeight));
      if (size <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      layout = createScopeLayout(size, dpr, controller.getFrame().current.radar.rangeM);
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    const unsubscribe = controller.onFrame(draw);
    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [controller]);

  return (
    <div
      ref={containerRef}
      className="relative grid aspect-square max-h-[24rem] w-full place-items-center lg:aspect-auto lg:max-h-none lg:min-h-0 lg:flex-1"
    >
      <canvas
        ref={canvasRef}
        data-testid="radar-scope"
        role="img"
        aria-label="Radar scope: the battery at the centre, north up, range rings every 10 km, with echoes from aircraft the beam has swept past."
      />
    </div>
  );
}
