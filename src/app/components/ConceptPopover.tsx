import * as Popover from '@radix-ui/react-popover';
import { GraduationCap } from 'lucide-react';
import { conceptCard, KEY_NUMBERS_URL, type ConceptId } from '../data/concepts';
import { parseInline } from '../lib/cardMarkdown';

export type { ConceptId };

/** A small "learn" button that opens a concept card next to the feature it explains. */
export function ConceptPopover({ concept, label }: { concept: ConceptId; label: string }) {
  const card = conceptCard(concept);
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
            href={KEY_NUMBERS_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[11.5px] font-semibold text-accent hover:underline"
          >
            Key numbers and limits →
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
