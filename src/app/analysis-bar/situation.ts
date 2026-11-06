import type { StageId } from '../data/stages';

/** Weapons control status: when the battery is allowed to fire. */
export type WeaponsControl = 'HOLD' | 'TIGHT' | 'FREE';
/** Who pulls the trigger: the operator, the system with confirmation, or the system alone. */
export type OperatorMode = 'MANUAL' | 'SEMI' | 'AUTO';

/**
 * Everything the header analysis bar shows. The simulation engine fills this in
 * from Step 1 onward; until then the bar shows the standby state below.
 */
export interface SituationSummary {
  /** False until the simulation engine is running; numbers then show as "—". */
  online: boolean;
  simTimeS: number;
  speed: number;
  stageCounts: Readonly<Record<StageId, number>>;
  threats: { active: number; down: number; leaked: number };
  interceptors: { ready: number; flying: number; used: number };
  channels: { used: number; total: number };
  nextImpact: { inSeconds: number; threat: string; asset: string } | null;
  weaponsControl: WeaponsControl;
  operatorMode: OperatorMode;
  /** The command node's current top decision, in plain language. */
  now: string;
}

export const STANDBY_SITUATION: SituationSummary = {
  online: false,
  simTimeS: 0,
  speed: 1,
  stageCounts: {
    detect: 0,
    track: 0,
    identify: 0,
    evaluate: 0,
    assign: 0,
    engage: 0,
    assess: 0,
  },
  threats: { active: 0, down: 0, leaked: 0 },
  interceptors: { ready: 0, flying: 0, used: 0 },
  channels: { used: 0, total: 4 },
  nextImpact: null,
  weaponsControl: 'TIGHT',
  operatorMode: 'SEMI',
  now: 'Standing by. The simulation engine comes online in Step 1.',
};

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
