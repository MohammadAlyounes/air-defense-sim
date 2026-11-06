import { useMemo } from 'react';
import { useSimState } from '../sim/simContext';
import { liveSituation, type SituationSummary } from './situation';

/** The header's summary of the running simulation. */
export function useLiveSituation(): SituationSummary {
  const contactsHeld = useSimState((s) => s.contactsHeld);
  const now = useSimState((s) => s.now);
  return useMemo(() => liveSituation({ contactsHeld, now }), [contactsHeld, now]);
}
