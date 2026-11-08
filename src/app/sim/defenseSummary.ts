import {
  DEFAULT_ASSETS,
  engageable,
  groundRange,
  mayThreaten,
  trackEllipseAt,
  trackPositionAt,
  type Engagement,
  type FlightProfile,
  type Identity,
  type Rules,
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
  threats: { active: number; down: number; leaked: number; idErrors: number };
  interceptors: { ready: number; flying: number; used: number };
  /** Fire channels in use and in all. */
  channels: { used: number; total: number };
  /** Threats the rules allow firing at, waiting for a fire channel while every channel is busy. */
  waiting: number;
  rules: Rules;
  /** SEMI mode: shots waiting for the operator, oldest first. */
  proposals: readonly Proposal[];
  /** The most urgent threat's time to its closest approach to the asset it threatens. */
  nextImpact: { inSeconds: number; threat: string; asset: string } | null;
  /** Every track, most urgent first: threats by time to closest approach, then the rest by range. */
  tracks: readonly TrackRow[];
}

/** A shot the system proposes in SEMI mode, waiting for the operator. */
export interface Proposal {
  engagementId: number;
  trackId: number;
  /** Ground-truth link, so the card can select the aircraft. */
  aircraftId: number;
  identity: Identity;
  /** What the track flies like (the kinematic classifier), if known. */
  profile: FlightProfile | null;
  /** The defended asset it threatens, if any. */
  assetId: number | null;
  timeToClosestS: number | null;
  predictedTimeS: number;
  predictedRangeM: number;
  pk: number;
}

/** Name of a defended asset, from its id. */
export function assetName(id: number): string {
  return DEFAULT_ASSETS.find((asset) => asset.id === id)?.name ?? 'Battery';
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

/** Among tracks equally urgent, hostile ones are listed first, then suspect, then unknown. */
const SEVERITY: Readonly<Record<Identity, number>> = {
  hostile: 3,
  suspect: 2,
  unknown: 1,
  pending: 0,
  friend: 0,
  neutral: 0,
};

/** The furthest stage of the loop a track has reached (the same rule as the header's funnel). */
export function trackStage(track: Track, engagement: Engagement | undefined): StageId {
  if (engagement?.state === 'hit' || engagement?.state === 'missed') return 'assess';
  if (engagement?.state === 'flying') return 'engage';
  const weighed = mayThreaten(track.identity);
  if (weighed && (engagement || track.threat)) return 'assign';
  if (weighed) return 'evaluate';
  if (track.identity !== 'pending') return 'identify';
  return track.confirmedTick !== null ? 'track' : 'detect';
}

export function summarizeDefense(snapshot: Snapshot): DefenseSummary {
  const { tracks, engagements, launcher, interceptors, stats, channels, rules } = snapshot;
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
    // Unknown, suspect and hostile tracks are evaluated as possible threats.
    if (!mayThreaten(t.identity)) continue;
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
      SEVERITY[b.identity] - SEVERITY[a.identity] ||
      a.rangeM - b.rangeM,
  );

  return {
    stages: { detect: tracks.length, track, identify, evaluate, assign, engage, assess },
    threats: {
      active: tracks.filter((t) => t.identity === 'hostile').length,
      down: stats.threatsDown,
      leaked: stats.threatsLeaked,
      idErrors: stats.idErrors,
    },
    channels,
    waiting:
      channels.used >= channels.total
        ? tracks.filter(
            (t) =>
              t.threat && t.engagementId === null && engageable(t.identity, rules.weaponsControl),
          ).length
        : 0,
    rules,
    proposals: engagements
      .filter((e) => e.state === 'proposed')
      .map((e): Proposal => {
        const track = tracks.find((t) => t.id === e.trackId);
        return {
          engagementId: e.id,
          trackId: e.trackId,
          aircraftId: e.targetId,
          identity: track?.identity ?? 'hostile',
          profile: track?.profile ?? null,
          assetId: track?.threat?.assetId ?? null,
          timeToClosestS: track?.threat?.timeToClosestS ?? null,
          predictedTimeS: e.predictedTimeS,
          predictedRangeM: groundRange(e.predictedPoint),
          pk: e.pk,
        };
      }),
    interceptors: {
      ready: launcher.ready,
      flying: interceptors.length,
      used: stats.interceptorsFired,
    },
    nextImpact: urgent?.threat
      ? {
          inSeconds: urgent.threat.timeToClosestS,
          threat: trackName(urgent.id),
          asset: assetName(urgent.threat.assetId).toLowerCase(),
        }
      : null,
    tracks: rows,
  };
}
