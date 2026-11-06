import clsx from 'clsx';
import type { Affiliation } from '../../sim';

/** Standard-style affiliation shapes: diamond = hostile, circle = friend, square = neutral. */
export function AffiliationShape({
  affiliation,
  className,
}: {
  affiliation: Affiliation;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 10 10" className={clsx('size-2', className)} aria-hidden="true">
      {affiliation === 'hostile' && <path d="M5 0.5 9.5 5 5 9.5 0.5 5Z" fill="currentColor" />}
      {affiliation === 'friend' && <circle cx="5" cy="5" r="4.2" fill="currentColor" />}
      {affiliation === 'neutral' && <rect x="1" y="1" width="8" height="8" fill="currentColor" />}
    </svg>
  );
}
