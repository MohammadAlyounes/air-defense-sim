import { describe, expect, it } from 'vitest';
import physics from '../../../docs/PHYSICS.md?raw';
import { CONCEPT_TITLES, conceptCard, type ConceptId } from '../data/concepts';
import { parseConceptCard, parseConceptCards, parseInline } from './cardMarkdown';

describe('parseConceptCard', () => {
  it('reads title, hook, paragraph and facts, and stops at the "more" marker', () => {
    const card = parseConceptCard(
      [
        '### Radar horizon — why low flyers hide',
        '',
        'The Earth curves away.',
        'Radio waves bend a little.',
        '',
        '- **Formula:** `d ≈ 4.12 (√h1 + √h2)`',
        '- **Example:** 43 km',
        '',
        '<!-- more -->',
        '## Going deeper',
        'Not part of the card.',
      ].join('\n'),
    );
    expect(card).toEqual({
      title: 'Radar horizon',
      hook: 'why low flyers hide',
      paragraphs: ['The Earth curves away. Radio waves bend a little.'],
      facts: [
        { label: 'Formula', text: '`d ≈ 4.12 (√h1 + √h2)`' },
        { label: 'Example', text: '43 km' },
      ],
    });
  });

  it('parses every concept card in docs/PHYSICS.md', () => {
    const cards = parseConceptCards(physics);
    expect(cards).toHaveLength(20);
    for (const card of cards) {
      expect(card.title.length).toBeGreaterThan(3);
      expect(card.hook.length).toBeGreaterThan(3);
      expect(card.paragraphs).toHaveLength(1);
      expect(card.facts.map((fact) => fact.label)).toEqual(['Formula', 'Example', 'See it']);
    }
  });

  it('keeps every card short: two sentences at most, and three one-line facts', () => {
    for (const card of parseConceptCards(physics)) {
      const [paragraph = ''] = card.paragraphs;
      const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z"])/);
      expect(sentences.length, card.title).toBeLessThanOrEqual(2);
      expect(paragraph.length, card.title).toBeLessThanOrEqual(320);
      for (const fact of card.facts) {
        expect(fact.text.length, `${card.title}: ${fact.label}`).toBeLessThanOrEqual(210);
      }
    }
  });

  it('finds the card of every concept the app opens', () => {
    for (const id of Object.keys(CONCEPT_TITLES) as ConceptId[]) {
      expect(conceptCard(id).title).toBe(CONCEPT_TITLES[id]);
    }
  });
});

describe('parseInline', () => {
  it('splits text into plain, bold and code parts', () => {
    expect(parseInline('a **b** `c` _d_ e')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'text', text: 'd' },
      { kind: 'text', text: ' e' },
    ]);
  });
});
