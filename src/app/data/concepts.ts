import physics from '../../../docs/PHYSICS.md?raw';
import { parseConceptCards, type ConceptCardData } from '../lib/cardMarkdown';
import { REPO_URL } from './links';

/** The concept cards the app opens, by the title of their card in docs/PHYSICS.md. */
export const CONCEPT_TITLES = {
  fixedTimeStep: 'Fixed time step',
  antennaRotation: 'Antenna rotation',
  localCoordinates: 'Local coordinates',
  seeingScale: 'Seeing scale',
  detectionRange: 'Detection range',
  proportionalNavigation: 'Proportional navigation',
  radarHorizon: 'Radar horizon',
  terrainMasking: 'Terrain masking',
  detectionProbability: 'Detection probability',
  airDrag: 'Air drag',
  standardAtmosphere: 'Standard atmosphere',
  wind: 'Wind',
  turnRadius: 'Turn radius',
  radarCrossSection: 'Radar cross section',
  clutterDoppler: 'Clutter and Doppler',
  kalmanFilter: 'Kalman filter',
  gatingAssociation: 'Gating and association',
  closestApproach: 'Closest point of approach',
  identification: 'Identification friend-or-foe',
  engagementEnvelope: 'Engagement envelope',
  killProbability: 'Kill probability',
  rulesOfEngagement: 'Rules of engagement',
} as const;

export type ConceptId = keyof typeof CONCEPT_TITLES;

const CARDS = parseConceptCards(physics);

/** Where the cards end in the docs: the key numbers and limits of every model. */
export const KEY_NUMBERS_URL = `${REPO_URL}/blob/main/docs/PHYSICS.md#key-numbers`;

/** A concept's card from docs/PHYSICS.md. */
export function conceptCard(id: ConceptId): ConceptCardData {
  const card = CARDS.find((candidate) => candidate.title === CONCEPT_TITLES[id]);
  if (!card) throw new Error(`No card titled "${CONCEPT_TITLES[id]}" in docs/PHYSICS.md`);
  return card;
}
