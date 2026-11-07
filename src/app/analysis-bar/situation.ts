import type { StageId } from '../data/stages';
import type { DefenseSummary } from '../sim/defenseSummary';

/** Weapons control status: when the battery is allowed to fire. */
export type WeaponsControl = 'HOLD' | 'TIGHT' | 'FREE';
/** Who pulls the trigger: the operator, the system with confirmation, or the system alone. */
export type OperatorMode = 'MANUAL' | 'SEMI' | 'AUTO';

/**
 * Everything the header analysis bar shows. A number whose feature is not built yet is null:
 * the bar shows "—" and a tooltip names the roadmap step that brings it.
 */
export interface SituationSummary {
  stageCounts: Readonly<Record<StageId, number | null>>;
  threats: { active: number; down: number; leaked: number } | null;
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
  channels: 8,
  nextImpact: 3,
} as const;

/**
 * The header as of Step 3: the whole loop runs in a first version. Fire channels arrive with
 * the tracking radar's limits in Step 8, together with operator approval (the battery fires on
 * its own until then: AUTO, at hostiles only: weapons TIGHT).
 */
export function liveSituation(input: { defense: DefenseSummary; now: string }): SituationSummary {
  const { defense } = input;
  return {
    stageCounts: defense.stages,
    threats: defense.threats,
    interceptors: defense.interceptors,
    channels: null,
    nextImpact: defense.nextImpact,
    weaponsControl: 'TIGHT',
    operatorMode: 'AUTO',
    now: input.now,
  };
}

export const WEAPONS_CONTROL_HELP: Readonly<Record<WeaponsControl, string>> = {
  HOLD: 'Weapons HOLD: fire only in self-defense.',
  TIGHT: 'Weapons TIGHT: fire only at targets identified as hostile.',
  FREE: 'Weapons FREE: fire at anything not identified as friendly.',
};

export const OPERATOR_MODE_HELP: Readonly<Record<OperatorMode, string>> = {
  MANUAL: 'Manual: you approve every shot.',
  SEMI: 'Semi-auto: the system recommends, you confirm.',
  AUTO: 'Auto: the system engages on its own, within the rules. Step 8 lets you approve each shot.',
};

export const OPERATOR_MODE_LABEL: Readonly<Record<OperatorMode, string>> = {
  MANUAL: 'MANUAL',
  SEMI: 'SEMI-AUTO',
  AUTO: 'AUTO',
};
