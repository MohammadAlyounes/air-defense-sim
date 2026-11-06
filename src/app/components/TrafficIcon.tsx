import type { SVGProps } from 'react';
import { AIRLINER_ENGINES, SILHOUETTES } from '../data/silhouettes';
import type { TrafficType } from '../data/threatCatalog';

function Quadcopter({ x = 16, y = 16, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) translate(-16 -16)`}>
      <g fill="none" stroke="currentColor" strokeWidth={1.8 / scale} strokeLinecap="round">
        <path d="M10.5 10.5 21.5 21.5M21.5 10.5 10.5 21.5" />
        <circle cx="8" cy="8" r="4.2" />
        <circle cx="24" cy="8" r="4.2" />
        <circle cx="8" cy="24" r="4.2" />
        <circle cx="24" cy="24" r="4.2" />
      </g>
      <rect x="13" y="13" width="6" height="6" rx="1.6" fill="currentColor" />
    </g>
  );
}

export function TrafficIcon({
  kind,
  ...props
}: { kind: TrafficType['id'] } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...props}>
      {kind === 'drone' && <Quadcopter />}
      {kind === 'swarm' && (
        <>
          <Quadcopter x={9.5} y={10} scale={0.5} />
          <Quadcopter x={23} y={9} scale={0.42} />
          <Quadcopter x={17} y={22.5} scale={0.55} />
        </>
      )}
      {kind !== 'drone' && kind !== 'swarm' && (
        <path d={SILHOUETTES[kind]} fill="currentColor" fillOpacity={0.92} />
      )}
      {kind === 'airliner' && (
        <g fill="currentColor">
          {AIRLINER_ENGINES.map(([x, y, width, height]) => (
            <rect key={x} x={x} y={y} width={width} height={height} rx={width / 2} />
          ))}
        </g>
      )}
    </svg>
  );
}
