import * as Popover from '@radix-ui/react-popover';
import { GraduationCap } from 'lucide-react';
import fixedTimeStep from '../../../docs/concepts/01-1-fixed-time-step.md?raw';
import antennaRotation from '../../../docs/concepts/01-2-antenna-rotation.md?raw';
import localCoordinates from '../../../docs/concepts/02-1-local-coordinates.md?raw';
import seeingScale from '../../../docs/concepts/02-2-seeing-scale.md?raw';
import detectionRange from '../../../docs/concepts/03-1-detection-range.md?raw';
import proportionalNavigation from '../../../docs/concepts/03-2-proportional-navigation.md?raw';
import radarHorizon from '../../../docs/concepts/04-1-radar-horizon.md?raw';
import terrainMasking from '../../../docs/concepts/04-2-terrain-masking.md?raw';
import detectionProbability from '../../../docs/concepts/04-3-detection-probability.md?raw';
import airDrag from '../../../docs/concepts/04-4-air-drag.md?raw';
import standardAtmosphere from '../../../docs/concepts/04-5-standard-atmosphere.md?raw';
import wind from '../../../docs/concepts/04-6-wind.md?raw';
import turnRadius from '../../../docs/concepts/04-7-turn-radius.md?raw';
import radarCrossSection from '../../../docs/concepts/04-8-radar-cross-section.md?raw';
import clutterDoppler from '../../../docs/concepts/04-9-clutter-doppler.md?raw';
import kalmanFilter from '../../../docs/concepts/05-1-kalman-filter.md?raw';
import gatingAssociation from '../../../docs/concepts/05-2-gating-association.md?raw';
import closestApproach from '../../../docs/concepts/05-3-closest-point-of-approach.md?raw';
import engagementEnvelope from '../../../docs/concepts/06-1-engagement-envelope.md?raw';
import killProbability from '../../../docs/concepts/06-2-kill-probability.md?raw';
import rulesOfEngagement from '../../../docs/concepts/06-3-rules-of-engagement.md?raw';
import { REPO_URL } from '../data/links';
import { parseConceptCard, parseInline } from '../lib/cardMarkdown';

/** Concept cards, imported from the same files the README is built from. */
const CONCEPTS = {
  fixedTimeStep: { markdown: fixedTimeStep, file: '01-1-fixed-time-step.md' },
  antennaRotation: { markdown: antennaRotation, file: '01-2-antenna-rotation.md' },
  localCoordinates: { markdown: localCoordinates, file: '02-1-local-coordinates.md' },
  seeingScale: { markdown: seeingScale, file: '02-2-seeing-scale.md' },
  detectionRange: { markdown: detectionRange, file: '03-1-detection-range.md' },
  proportionalNavigation: {
    markdown: proportionalNavigation,
    file: '03-2-proportional-navigation.md',
  },
  radarHorizon: { markdown: radarHorizon, file: '04-1-radar-horizon.md' },
  terrainMasking: { markdown: terrainMasking, file: '04-2-terrain-masking.md' },
  detectionProbability: { markdown: detectionProbability, file: '04-3-detection-probability.md' },
  airDrag: { markdown: airDrag, file: '04-4-air-drag.md' },
  standardAtmosphere: { markdown: standardAtmosphere, file: '04-5-standard-atmosphere.md' },
  wind: { markdown: wind, file: '04-6-wind.md' },
  turnRadius: { markdown: turnRadius, file: '04-7-turn-radius.md' },
  radarCrossSection: { markdown: radarCrossSection, file: '04-8-radar-cross-section.md' },
  clutterDoppler: { markdown: clutterDoppler, file: '04-9-clutter-doppler.md' },
  kalmanFilter: { markdown: kalmanFilter, file: '05-1-kalman-filter.md' },
  gatingAssociation: { markdown: gatingAssociation, file: '05-2-gating-association.md' },
  closestApproach: { markdown: closestApproach, file: '05-3-closest-point-of-approach.md' },
  engagementEnvelope: { markdown: engagementEnvelope, file: '06-1-engagement-envelope.md' },
  killProbability: { markdown: killProbability, file: '06-2-kill-probability.md' },
  rulesOfEngagement: { markdown: rulesOfEngagement, file: '06-3-rules-of-engagement.md' },
} as const;

export type ConceptId = keyof typeof CONCEPTS;

/** A small "learn" button that opens a concept card next to the feature it explains. */
export function ConceptPopover({ concept, label }: { concept: ConceptId; label: string }) {
  const { markdown, file } = CONCEPTS[concept];
  const card = parseConceptCard(markdown);
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        title={label}
        className="grid size-7 place-items-center rounded-md text-ink-300 transition-colors hover:text-accent data-[state=open]:text-accent"
      >
        <GraduationCap className="size-4" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-ink-600 bg-ink-850/95 p-4 text-[12.5px] leading-relaxed text-ink-200 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
            The physics, in plain language
          </p>
          <h3 className="mt-1 text-[15px] font-semibold text-ink-100">{card.title}</h3>
          <p className="text-[12px] text-ink-300">{card.hook}</p>
          {card.paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-2.5">
              <Inline text={paragraph} />
            </p>
          ))}
          <dl className="mt-3 space-y-1.5 border-t border-ink-700 pt-3">
            {card.facts.map((fact) => (
              <div key={fact.label}>
                <dt className="inline font-semibold text-ink-100">{fact.label}: </dt>
                <dd className="inline">
                  <Inline text={fact.text} />
                </dd>
              </div>
            ))}
          </dl>
          <a
            href={`${REPO_URL}/blob/main/docs/concepts/${file}`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[11.5px] font-semibold text-accent hover:underline"
          >
            Going deeper →
          </a>
          <Popover.Arrow className="fill-ink-600" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, i) =>
        part.kind === 'bold' ? (
          <strong key={i} className="font-semibold text-ink-100">
            {part.text}
          </strong>
        ) : part.kind === 'code' ? (
          <code
            key={i}
            className="rounded bg-ink-950/70 px-1 py-px font-mono text-[11.5px] text-accent"
          >
            {part.text}
          </code>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
