import clsx from 'clsx';
import { ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatIn, formatKm, trackName, TRAFFIC_NOUN, withArticle } from '../sim/narrator';
import { useSimState } from '../sim/simContext';
import type { ResultCard } from '../sim/store';

/** How long a card stays up, in real seconds (whatever the simulation speed). */
const SHOW_MS = 7_000;
const MAX_CARDS = 2;

/**
 * Result cards over the 3D view: after each confirmed kill, how the engagement went; after a
 * leak, what got through. They reveal what the target really was, like a debrief.
 */
export function ResultToasts() {
  const results = useSimState((s) => s.results);
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const firstSeen = useRef(new Map<number, number>());
  const visible = results.filter((r) => !hidden.has(r.id)).slice(0, MAX_CARDS);
  const visibleKey = visible.map((r) => r.id).join(',');

  useEffect(() => {
    const now = Date.now();
    const timers = visible.map((result) => {
      const seen = firstSeen.current.get(result.id) ?? now;
      firstSeen.current.set(result.id, seen);
      return window.setTimeout(
        () => setHidden((previous) => new Set(previous).add(result.id)),
        Math.max(0, SHOW_MS - (now - seen)),
      );
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
    // The ids say everything about which cards are up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleKey]);

  if (visible.length === 0) return null;
  return (
    <ol
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-12 z-20 flex flex-col items-center gap-2 px-2"
    >
      {visible.map((result) => (
        <li key={result.id} className="pointer-events-auto w-full max-w-md">
          <Card
            result={result}
            onClose={() => setHidden((previous) => new Set(previous).add(result.id))}
          />
        </li>
      ))}
    </ol>
  );
}

function Card({ result, onClose }: { result: ResultCard; onClose: () => void }) {
  const kill = result.kind === 'kill';
  const Icon = kill ? ShieldCheck : ShieldAlert;
  const what = withArticle(TRAFFIC_NOUN[result.type]);
  return (
    <div
      data-testid="result-card"
      data-kind={result.kind}
      className={clsx(
        'flex items-start gap-3 rounded-xl border bg-ink-900/92 px-3.5 py-2.5 shadow-2xl shadow-black/50 backdrop-blur motion-safe:animate-[toast-in_0.25s_ease-out]',
        kill ? 'border-ok/45' : 'border-alert/50',
      )}
    >
      <Icon
        aria-hidden="true"
        className={clsx('mt-0.5 size-5 shrink-0', kill ? 'text-ok' : 'text-alert')}
      />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-100">
          {kill ? `Threat destroyed · ${trackName(result.trackId ?? 0)}` : 'A threat got through'}
        </p>
        {kill ? (
          <p className="mt-0.5 text-[12px] leading-snug text-ink-200">
            Detected at {formatKm(result.detectedRangeM ?? 0)} ·{' '}
            {formatIn(result.detectionToKillS ?? 0)} from detection to intercept ·{' '}
            {result.interceptorsFired === 1
              ? '1 interceptor'
              : `${result.interceptorsFired} interceptors`}
            <span className="block text-ink-300">It was {what}.</span>
          </p>
        ) : (
          <p className="mt-0.5 text-[12px] leading-snug text-ink-200">
            {what.charAt(0).toUpperCase() + what.slice(1)} reached the battery before it could be
            stopped.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="grid size-6 shrink-0 place-items-center rounded text-ink-300 transition-colors hover:text-ink-100"
      >
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
