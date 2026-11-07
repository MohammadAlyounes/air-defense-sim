import type { OperatorMode, WeaponsControl } from '../../sim';
import type { StageId } from '../data/stages';
import type { DefenseSummary } from '../sim/defenseSummary';

export type { OperatorMode, WeaponsControl };

/**
 * Everything the header analysis bar shows. A number whose feature is not built yet is null:
 * the bar shows "—" and a tooltip names the roadmap step that brings it.
 */
export interface SituationSummary {
  stageCounts: Readonly<Record<StageId, number | null>>;
  threats: { active: number; down: number; leaked: number; idErrors: number } | null;
  interceptors: { ready: number; flying: number; used: number } | null;
  channels: { used: number; total: number } | null;
  /** Null when no threat is inbound. */
  nextImpact: { inSeconds: number; threat: string; asset: string } | null;
  weaponsControl: WeaponsControl;
  operatorMode: OperatorMode;
  /** What is happening right now, in plain language. */
  now: string;
}

/** Roadmap step in which each header number comes to life. */
export const KPI_ARRIVES_IN_STEP = {
  threats: 3,
  interceptors: 3,
  channels: 6,
  nextImpact: 3,
} as const;

/** The header from the battery's summary: every number is live since Step 6. */
export function liveSituation(input: { defense: DefenseSummary; now: string }): SituationSummary {
  const { defense } = input;
  return {
    stageCounts: defense.stages,
    threats: defense.threats,
    interceptors: defense.interceptors,
    channels: defense.channels,
    nextImpact: defense.nextImpact,
    weaponsControl: defense.rules.weaponsControl,
    operatorMode: defense.rules.operatorMode,
    now: input.now,
  };
}

export const WEAPONS_CONTROL_HELP: Readonly<Record<WeaponsControl, string>> = {
  HOLD: 'Weapons HOLD: do not fire.',
  TIGHT:
    'Weapons TIGHT: fire only at targets identified as hostile (silent on every identification check).',
  FREE: 'Weapons FREE: fire at anything not identified as friendly or civil, even after one silent check. Faster, but a friend with a faulty transponder can be shot down.',
};

export const OPERATOR_MODE_HELP: Readonly<Record<OperatorMode, string>> = {
  SEMI: 'Semi-auto: the system proposes each shot and you approve it (A) or hold fire (H).',
  AUTO: 'Auto: the system engages on its own, within the rules.',
};

export const OPERATOR_MODE_LABEL: Readonly<Record<OperatorMode, string>> = {
  SEMI: 'SEMI-AUTO',
  AUTO: 'AUTO',
};

/** The order the header badges cycle through when clicked. */
export const NEXT_WEAPONS_CONTROL: Readonly<Record<WeaponsControl, WeaponsControl>> = {
  TIGHT: 'FREE',
  FREE: 'HOLD',
  HOLD: 'TIGHT',
};
export const NEXT_OPERATOR_MODE: Readonly<Record<OperatorMode, OperatorMode>> = {
  AUTO: 'SEMI',
  SEMI: 'AUTO',
};
