import { Crosshair, Hand } from 'lucide-react';
import type { FlightProfile, Identity } from '../../sim';
import { ConceptPopover } from '../components/ConceptPopover';
import { PROFILE_TEXT } from '../sim/identityText';
import { assetPhrase, formatIn, formatKm, trackName } from '../sim/narrator';
import { useSimController, useSimState } from '../sim/simContext';
import { useViewStore } from '../view/viewStore';

/** What the battery knows about a proposed target, in a few words. */
function evidence(identity: Identity, profile: FlightProfile | null): string {
  if (identity === 'unknown') return 'unknown (no answer yet)';
  if (identity === 'suspect') {
    return `suspect (no answer yet, and it flies like ${profile ? PROFILE_TEXT[profile].like : 'a threat'})`;
  }
  return 'hostile (never answered)';
}

/**
 * SEMI mode: the system proposes each shot and waits. The card shows the oldest proposal with
 * the evidence behind it, and the operator approves (A) or holds fire (H). Both answers are
 * recorded commands, so the run replays exactly.
 */
export function ApprovalCard() {
  const controller = useSimController();
  const proposals = useSimState((s) => s.defense.proposals);
  const proposal = proposals[0];
  if (!proposal) return null;
  const t = trackName(proposal.trackId);
  const more = proposals.length - 1;
  return (
    <div
      role="alertdialog"
      aria-labelledby="approval-title"
      data-testid="approval-card"
      className="pointer-events-auto absolute inset-x-0 bottom-11 z-20 mx-auto w-[min(26rem,calc(100%-1rem))] rounded-xl border border-accent/50 bg-ink-900/95 px-3.5 py-2.5 shadow-2xl shadow-black/50 backdrop-blur"
    >
      <p
        id="approval-title"
        className="flex items-center gap-2 text-[13px] font-semibold text-ink-100"
      >
        <Crosshair aria-hidden="true" className="size-4 text-accent" />
        Fire at {t}?
        {more > 0 && <span className="text-[11px] font-normal text-ink-300">+{more} waiting</span>}
        <span className="ml-auto">
          <ConceptPopover concept="rulesOfEngagement" label="Rules of engagement" />
        </span>
      </p>
      <p className="mt-1 text-[12px] leading-snug text-ink-200">
        <button
          type="button"
          className="font-semibold text-ink-100 underline decoration-dotted hover:text-accent"
          onClick={() => useViewStore.getState().select(proposal.aircraftId)}
        >
          {t}
        </button>{' '}
        is {evidence(proposal.identity, proposal.profile)}
        {proposal.assetId !== null && proposal.timeToClosestS !== null && (
          <>
            {' '}
            and heading for {assetPhrase(proposal.assetId)}, closest approach in{' '}
            {formatIn(proposal.timeToClosestS)}
          </>
        )}
        . Intercept {formatKm(proposal.predictedRangeM)} out in {formatIn(proposal.predictedTimeS)},
        chance of a kill <strong className="text-ink-100">{Math.round(proposal.pk * 100)}%</strong>.
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          data-testid="approve"
          onClick={() =>
            controller.dispatch({ kind: 'approveEngagement', engagementId: proposal.engagementId })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-accent/60 bg-accent/15 px-2 py-1 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/25"
        >
          <Crosshair aria-hidden="true" className="size-3.5" />
          Approve <kbd className="font-mono text-[10px] text-accent/80">A</kbd>
        </button>
        <button
          type="button"
          data-testid="hold-fire"
          onClick={() =>
            controller.dispatch({ kind: 'holdFire', engagementId: proposal.engagementId })
          }
          className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[12px] font-semibold text-ink-200 transition-colors hover:border-ink-400"
        >
          <Hand aria-hidden="true" className="size-3.5" />
          Hold fire <kbd className="font-mono text-[10px] text-ink-300">H</kbd>
        </button>
      </div>
    </div>
  );
}
