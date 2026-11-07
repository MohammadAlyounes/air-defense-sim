import { useMemo } from 'react';
import { useSimState } from '../sim/simContext';
import { liveSituation, type SituationSummary } from './situation';

/** The header's summary of the running simulation. */
export function useLiveSituation(): SituationSummary {
  const defense = useSimState((s) => s.defense);
  const now = useSimState((s) => s.now);
  return useMemo(() => liveSituation({ defense, now }), [defense, now]);
}
