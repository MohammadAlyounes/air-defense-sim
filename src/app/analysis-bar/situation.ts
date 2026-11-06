import type { StageId } from '../data/stages';

/** Weapons control status: when the battery is allowed to fire. */
export type WeaponsControl = 'HOLD' | 'TIGHT' | 'FREE';
/** Who pulls the trigger: the operator, the system with confirmation, or the system alone. */
export type OperatorMode = 'MANUAL' | 'SEMI' | 'AUTO';

/**
 * Everything the header analysis bar shows. A `null` field is a feature that is not built
 * yet: the bar shows "—" and a tooltip names the roadmap step that brings it.
 */
export interface SituationSummary {
  stageCounts: Readonly<Record<StageId, number | null>>;
  threats: { active: number; down: number; leaked: number } | null;
  interceptors: { ready: number; flying: number; used: number } | null;
  channels: { used: number; total: number } | null;
  nextImpact: { inSeconds: number; threat: string; asset: string } | null;
  weaponsControl: WeaponsControl;
  operatorMode: OperatorMode;
  /** What is happening right now, in plain language. */
  now: string;
}

/** Roadmap step in which each header number comes to life. */
export const KPI_ARRIVES_IN_STEP = {
  threats: 7,
  interceptors: 3,
  channels: 8,
  nextImpact: 7,
} as const;

/** The header as of Step 1: the radar is live; the rest of the defense loop is still to come. */
export function liveSituation(input: { contactsHeld: number; now: string }): SituationSummary {
  return {
    stageCounts: {
      detect: input.contactsHeld,
      track: null,
      identify: null,
      evaluate: null,
      assign: null,
      engage: null,
      assess: null,
    },
    threats: null,
    interceptors: null,
    channels: null,
    nextImpact: null,
    weaponsControl: 'TIGHT',
    operatorMode: 'SEMI',
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
  AUTO: 'Auto: the system engages on its own, within the rules.',
};

export const OPERATOR_MODE_LABEL: Readonly<Record<OperatorMode, string>> = {
  MANUAL: 'MANUAL',
  SEMI: 'SEMI-AUTO',
  AUTO: 'AUTO',
};
