const TICKS = Array.from({ length: 36 }, (_, i) => i * 10);
const CARDINALS = [
  { label: 'N', x: 100, y: 22 },
  { label: 'E', x: 180, y: 103 },
  { label: 'S', x: 100, y: 184 },
  { label: 'W', x: 20, y: 103 },
] as const;

/** A classic round radar display (PPI) with a rotating sweep. Live blips arrive in Step 1. */
export function RadarScopePreview() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-3">
      <div className="relative aspect-square w-full max-w-[16.5rem]">
        <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <radialGradient id="scope-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#0b2a33" />
              <stop offset="1" stopColor="#06121a" />
            </radialGradient>
          </defs>
          <circle
            cx="100"
            cy="100"
            r="96"
            fill="url(#scope-bg)"
            stroke="#22d3ee"
            strokeOpacity="0.4"
          />
          {[24, 48, 72].map((r) => (
            <circle
              key={r}
              cx="100"
              cy="100"
              r={r}
              fill="none"
              stroke="#22d3ee"
              strokeOpacity="0.16"
            />
          ))}
          <path d="M100 4V196M4 100H196" stroke="#22d3ee" strokeOpacity="0.12" />
          {TICKS.map((deg) => {
            const major = deg % 30 === 0;
            const rad = (deg * Math.PI) / 180;
            const inner = major ? 87 : 91;
            return (
              <line
                key={deg}
                x1={100 + inner * Math.sin(rad)}
                y1={100 - inner * Math.cos(rad)}
                x2={100 + 96 * Math.sin(rad)}
                y2={100 - 96 * Math.cos(rad)}
                stroke="#22d3ee"
                strokeOpacity={major ? 0.55 : 0.25}
              />
            );
          })}
          {CARDINALS.map((c) => (
            <text
              key={c.label}
              x={c.x}
              y={c.y}
              textAnchor="middle"
              fontSize="8"
              fontFamily="var(--font-mono)"
              fill="#22d3ee"
              fillOpacity="0.65"
            >
              {c.label}
            </text>
          ))}
        </svg>
        {/* The sweep: bright leading edge, fading trail behind it (clockwise rotation). */}
        <div
          className="absolute inset-[2%] animate-sweep rounded-full motion-reduce:animate-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg 300deg, color-mix(in srgb, var(--color-accent) 38%, transparent) 360deg)',
          }}
        >
          <div className="absolute top-0 left-1/2 h-1/2 w-px -translate-x-1/2 bg-linear-to-b from-accent to-accent/20" />
        </div>
        <div className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_2px] shadow-accent/60" />
      </div>
      <p className="max-w-xs text-center text-[11.5px] leading-snug text-ink-300">
        The radar&apos;s point of view: blips and tracks appear here each time the sweep passes over
        them.
      </p>
    </div>
  );
}
