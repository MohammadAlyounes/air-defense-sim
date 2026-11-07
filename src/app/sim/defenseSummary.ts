import {
  groundRange,
  trackEllipseAt,
  trackPositionAt,
  type Engagement,
  type Identity,
  type Snapshot,
  type Track,
} from '../../sim';
import type { StageId } from '../data/stages';
import { trackName } from './narrator';

/** The header's numbers, computed from one snapshot of the battery's picture. */
export interface DefenseSummary {
  /**
   * How many current tracks have reached each stage of the loop (a funnel: every track that
   * is being engaged has also been detected, tracked, identified, evaluated and assigned).
   */
  stages: Readonly<Record<StageId, number>>;
  threats: { active: number; down: number; leaked: number };
  interceptors: { ready: number; flying: number; used: number };
  /** The most urgent threat's time to its closest approach to the battery. */
  nextImpact: { inSeconds: number; threat: string; asset: string } | null;
  /** Every track, most urgent first: threats by time to closest approach, then the rest by range. */
  tracks: readonly TrackRow[];
}

/** One line of the track table: the battery's picture of one aircraft. */
export interface TrackRow {
  id: number;
  /** The aircraft behind the track, so a row can select it (null: a false alarm). */
  truthId: number | null;
  identity: Identity;
  rangeM: number;
  altitudeM: number;
  speedMps: number | null;
  /** How sure the tracker is of its position: one-sigma error along the ellipse's long axis, m. */
  sigmaM: number;
  /** The furthest stage of the loop this track has reached. */
  stage: StageId;
  /** Time to its closest approach to the battery, s, for threats. */
  threatInS: number | null;
}

/** The furthest stage of the loop a track has reached (the same rule as the header's funnel). */
export function trackStage(track: Track, engagement: Engagement | undefined): StageId {
  if (engagement?.state === 'hit' || engagement?.state === 'missed') return 'assess';
  if (engagement?.state === 'flying') return 'engage';
  if (track.identity === 'hostile' && (engagement || track.threat)) return 'assign';
  if (track.identity === 'hostile') return 'evaluate';
  if (track.identity !== 'pending') return 'identify';
  return track.confirmedTick !== null ? 'track' : 'detect';
}

export function summarizeDefense(snapshot: Snapshot): DefenseSummary {
  const { tracks, engagements, launcher, interceptors, stats } = snapshot;
  const engagementOf = (id: number | null) =>
    id === null ? undefined : engagements.find((e) => e.id === id);

  let track = 0;
  let identify = 0;
  let evaluate = 0;
  let assign = 0;
  let engage = 0;
  let assess = 0;
  for (const t of tracks) {
    if (t.confirmedTick !== null) track += 1;
    if (t.identity !== 'pending') identify += 1;
    if (t.identity !== 'hostile') continue;
    evaluate += 1;
    const engagement = engagementOf(t.engagementId);
    if (t.threat || engagement) assign += 1;
    if (engagement && engagement.state !== 'assigned') engage += 1;
    if (engagement?.state === 'hit' || engagement?.state === 'missed') assess += 1;
  }

  const urgent = tracks
    .filter((t) => t.threat)
    .sort((a, b) => (a.threat?.timeToClosestS ?? 0) - (b.threat?.timeToClosestS ?? 0))[0];

  const rows = tracks.map((t): TrackRow => {
    const at = trackPositionAt(t, snapshot.tick);
    return {
      id: t.id,
      truthId: t.truthId,
      identity: t.identity,
      rangeM: groundRange(at),
      altitudeM: at.z,
      speedMps: t.velocity ? Math.hypot(t.velocity.x, t.velocity.y, t.velocity.z) : null,
      sigmaM: trackEllipseAt(t, snapshot.tick).majorM,
      stage: trackStage(t, engagementOf(t.engagementId)),
      threatInS: t.threat?.timeToClosestS ?? null,
    };
  });
  rows.sort(
    (a, b) =>
      (a.threatInS ?? Infinity) - (b.threatInS ?? Infinity) ||
      Number(b.identity === 'hostile') - Number(a.identity === 'hostile') ||
      a.rangeM - b.rangeM,
  );

  return {
    stages: { detect: tracks.length, track, identify, evaluate, assign, engage, assess },
    threats: {
      active: tracks.filter((t) => t.identity === 'hostile').length,
      down: stats.threatsDown,
      leaked: stats.threatsLeaked,
    },
    interceptors: {
      ready: launcher.ready,
      flying: interceptors.length,
      used: stats.interceptorsFired,
    },
    nextImpact: urgent?.threat
      ? {
          inSeconds: urgent.threat.timeToClosestS,
          threat: trackName(urgent.id),
          asset: 'battery',
        }
      : null,
    tracks: rows,
  };
}
