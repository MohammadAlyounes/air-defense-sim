import { BookOpen } from 'lucide-react';
import { GithubMark } from '../components/marks';
import { PLAN_URL, REPO_URL } from '../data/links';
import { CURRENT_STEP, LAST_STEP, roadmapStep } from '../data/roadmap';

const WIDTH = 1000;
const HEIGHT = 640;
const HORIZON_Y = 380;
const VANISHING_X = WIDTH / 2;
/** Floor lines converging on the vanishing point, plus perspective-spaced cross lines. */
const FLOOR_RAYS = Array.from({ length: 41 }, (_, i) => -1500 + i * 100);
const FLOOR_ROWS = Array.from(
  { length: 16 },
  (_, k) => HORIZON_Y + (HEIGHT - HORIZON_Y) / (1 + k * 0.6),
);

/**
 * Placeholder for the 3D battlespace (Step 2): a stylized illustration of what the view
 * will show (terrain, radar coverage dome, a threat track and an interceptor).
 */
export function BattlespacePreview() {
  const next = roadmapStep(CURRENT_STEP + 1);
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[linear-gradient(to_bottom,#060b16,#0a1428_55%,#0b1a2e)]">
      <BattlespaceIllustration />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center px-6 pt-8 text-center sm:pt-10">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
          Building in public · Step {CURRENT_STEP} of {LAST_STEP}
        </span>
        <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-ink-100 sm:text-4xl">
          See how an <span className="whitespace-nowrap">air-defense</span> system thinks.
        </h2>
        <p className="mt-3 max-w-xl text-balance text-[15px] leading-relaxed text-ink-200">
          Drag a drone, missile or jet onto the map and watch a generic defense battery detect,
          track, identify, evaluate, engage and assess it, with the physics explained in plain
          language.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-semibold text-ink-950 shadow-lg shadow-accent/20 transition hover:brightness-110"
          >
            <GithubMark className="size-4" />
            Follow the build on GitHub
          </a>
          <a
            href={PLAN_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-900/80 px-3.5 py-2 text-[13px] font-semibold text-ink-100 transition hover:border-accent/50"
          >
            <BookOpen aria-hidden="true" className="size-4 text-accent" />
            Read the project plan
          </a>
        </div>
        {next && (
          <p className="mt-4 text-[12px] text-ink-300">
            Next up:{' '}
            <strong className="text-ink-100">
              Step {next.step} · {next.title}
            </strong>
            . {next.summary}
          </p>
        )}
      </div>

      {/* Keeps room for the illustration below the text on narrow screens. */}
      <div className="min-h-56 flex-1 lg:min-h-0" />
      <p className="relative z-10 px-3 pb-2 text-[10.5px] text-ink-300">
        Illustration: the live 3D view arrives in Step 2.
      </p>
    </div>
  );
}

function BattlespaceIllustration() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      className="absolute inset-0 size-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="floor-fade"
          x1="0"
          y1={HORIZON_Y}
          x2="0"
          y2={HEIGHT}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.45" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="floor-mask">
          <rect
            x="-3000"
            y={HORIZON_Y}
            width="7000"
            height={HEIGHT - HORIZON_Y}
            fill="url(#floor-fade)"
          />
        </mask>
        <radialGradient id="dome-glow" cx="50%" cy="100%" r="100%">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.16" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="horizon-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#22d3ee" stopOpacity="0.3" />
          <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Horizon glow and a fictional ridge line. */}
      <ellipse cx="500" cy={HORIZON_Y} rx="560" ry="70" fill="url(#horizon-glow)" />
      <path
        d="M-400 382 L0 380 L60 368 L120 374 L190 356 L260 370 L330 360 L400 376 L470 366 L540 372 L610 352 L690 370 L760 362 L840 374 L910 358 L1000 370 L1400 378 L1400 384 L-400 384 Z"
        fill="#0a1428"
        stroke="#22d3ee"
        strokeOpacity="0.3"
      />

      {/* Perspective floor grid. */}
      <g mask="url(#floor-mask)" stroke="#22d3ee" strokeOpacity="0.22">
        {FLOOR_RAYS.map((x) => (
          <line key={`r${x}`} x1={VANISHING_X} y1={HORIZON_Y} x2={x} y2={HEIGHT} />
        ))}
        {FLOOR_ROWS.map((y) => (
          <line key={`h${y}`} x1="-3000" y1={y} x2="4000" y2={y} />
        ))}
      </g>

      {/* Radar coverage dome and the smaller engagement envelope around the battery. */}
      <path d="M220 585 A280 190 0 0 1 780 585 Z" fill="url(#dome-glow)" />
      <path d="M220 585 A280 190 0 0 1 780 585" fill="none" stroke="#22d3ee" strokeOpacity="0.5" />
      <ellipse
        cx="500"
        cy="585"
        rx="280"
        ry="40"
        fill="none"
        stroke="#22d3ee"
        strokeOpacity="0.28"
        strokeDasharray="4 6"
      />
      <path
        d="M350 585 A150 105 0 0 1 650 585"
        fill="none"
        stroke="#34d399"
        strokeOpacity="0.55"
        strokeDasharray="6 5"
      />
      <ellipse
        cx="500"
        cy="585"
        rx="150"
        ry="22"
        fill="none"
        stroke="#34d399"
        strokeOpacity="0.3"
        strokeDasharray="3 5"
      />

      {/* Battery site. */}
      <path d="M491 592 L500 575 L509 592 Z" fill="#22d3ee" />

      {/* Illustrative threat track (red diamond) and the interceptor arc meeting it. */}
      <path
        d="M60 420 Q240 455 392 515"
        fill="none"
        stroke="#f87171"
        strokeWidth="2"
        strokeDasharray="2 7"
        strokeLinecap="round"
      />
      <path d="M392 506 L401 515 L392 524 L383 515 Z" fill="#f87171" />
      <path
        d="M500 577 Q474 494 408 512"
        fill="none"
        stroke="#22d3ee"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx="404"
        cy="513"
        r="15"
        fill="none"
        stroke="#e4eaf5"
        strokeOpacity="0.7"
        className="animate-pulse motion-reduce:animate-none"
      />
    </svg>
  );
}
