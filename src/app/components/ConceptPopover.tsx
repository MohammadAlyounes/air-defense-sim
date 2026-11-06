import * as Popover from '@radix-ui/react-popover';
import { GraduationCap } from 'lucide-react';
import fixedTimeStep from '../../../docs/concepts/01-1-fixed-time-step.md?raw';
import antennaRotation from '../../../docs/concepts/01-2-antenna-rotation.md?raw';
import localCoordinates from '../../../docs/concepts/02-1-local-coordinates.md?raw';
import seeingScale from '../../../docs/concepts/02-2-seeing-scale.md?raw';
import { REPO_URL } from '../data/links';
import { parseConceptCard, parseInline } from '../lib/cardMarkdown';

/** Concept cards, imported from the same files the README is built from. */
const CONCEPTS = {
  fixedTimeStep: { markdown: fixedTimeStep, file: '01-1-fixed-time-step.md' },
  antennaRotation: { markdown: antennaRotation, file: '01-2-antenna-rotation.md' },
  localCoordinates: { markdown: localCoordinates, file: '02-1-local-coordinates.md' },
  seeingScale: { markdown: seeingScale, file: '02-2-seeing-scale.md' },
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
